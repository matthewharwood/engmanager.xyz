use std::cmp::Reverse;
use std::collections::HashMap;
use std::sync::{Arc, Mutex, PoisonError, RwLock};

use anyhow::{Context, Result};
use pulldown_cmark::Event;
use serde::Serialize;
use tantivy::collector::TopDocs;
use tantivy::query::{Query, QueryParser};
use tantivy::schema::document::Value;
use tantivy::schema::{Field, STORED, STRING, Schema, TEXT};
use tantivy::{Index, IndexReader, IndexWriter, TantivyDocument};

use crate::catalog::{PriceCents, SHOP_PRODUCTS, ShopProduct};
use crate::comments::{CommentRecord, CommentStatus};
use crate::content::{Article, ArticleDate, Category, Tag, article_markdown, public_articles};

// Shop products live on the dedicated shop host; search results link there with
// `?image=front`, and shop.js's deep-link init opens that product's view.
const SHOP_PRODUCT_ORIGIN: &str = "https://shop.engmanager.xyz";

const ARTICLE_SEARCH_LIMIT: usize = 1_000;
const COMMENT_SEARCH_LIMIT: usize = 1_000;
const PAGE_SIZE: usize = 20;
// Upper bound for the client-supplied page param: keeps the pagination
// arithmetic far from overflow and is absurdly beyond the real corpus.
const MAX_PAGE: usize = 10_000;

#[derive(Clone, Debug)]
struct ArticleDoc {
    slug: String,
    title: String,
    summary: String,
    body: String,
    category: Category,
    tags: Vec<Tag>,
    date: ArticleDate,
}

#[derive(Clone, Debug)]
struct CommentDoc {
    comment_id: String,
    article_slug: String,
    article_title: String,
    author_name: String,
    body: String,
    quote_exact: String,
    created_at_ms: i64,
}

#[derive(Clone, Copy)]
struct ArticleFields {
    slug: Field,
    title: Field,
    summary: Field,
    body: Field,
}

#[derive(Clone, Copy)]
struct CommentFields {
    comment_id: Field,
    article_slug: Field,
    author_name: Field,
    body: Field,
    quote_exact: Field,
}

pub struct SearchEngine {
    article_index: Index,
    article_reader: IndexReader,
    article_fields: ArticleFields,
    articles: HashMap<String, ArticleDoc>,
    comment_index: Index,
    comment_reader: IndexReader,
    comment_writer: Mutex<IndexWriter<TantivyDocument>>,
    comment_fields: CommentFields,
    comments: RwLock<HashMap<String, CommentDoc>>,
}

#[derive(Clone, Debug, Default)]
pub struct SearchQuery {
    pub q: String,
    pub categories: Vec<Category>,
    pub tags: Vec<Tag>,
    pub date_from: Option<ArticleDate>,
    pub date_to: Option<ArticleDate>,
    pub page: usize,
}

#[derive(Clone, Debug, Serialize)]
pub struct TypeaheadHit {
    pub kind: &'static str,
    pub title: String,
    pub detail: String,
    pub url: String,
}

#[derive(Clone, Debug)]
pub struct SearchResults {
    pub article_hits: Vec<ArticleSearchHit>,
    pub comment_hits: Vec<CommentSearchHit>,
    pub product_hits: Vec<ProductSearchHit>,
    pub total_articles: usize,
    pub total_comments: usize,
    pub total_products: usize,
    pub facets: FacetCounts,
    pub page: usize,
    pub page_size: usize,
}

#[derive(Clone, Debug)]
pub struct ArticleSearchHit {
    pub slug: String,
    pub title: String,
    pub snippet: String,
    pub category: Category,
    pub tags: Vec<Tag>,
    pub date: ArticleDate,
}

#[derive(Clone, Debug)]
pub struct CommentSearchHit {
    pub comment_id: String,
    pub article_slug: String,
    pub article_title: String,
    pub author_name: String,
    pub snippet: String,
    pub quote_exact: String,
    pub created_at_ms: i64,
}

#[derive(Clone, Debug)]
pub struct ProductSearchHit {
    pub name: String,
    pub description: String,
    pub price: PriceCents,
    pub url: String,
    pub cap_color: String,
    pub thread_color: String,
    pub accent_color: String,
}

#[derive(Clone, Debug, Default)]
pub struct FacetCounts {
    pub categories: Vec<(Category, usize)>,
    pub tags: Vec<(Tag, usize)>,
}

impl SearchEngine {
    pub fn build_in_memory(
        articles: &'static [Article],
        comments: &[CommentRecord],
    ) -> Result<SearchEngine> {
        let (article_index, article_fields) = build_article_index_schema();
        let mut article_writer = article_index
            .writer_with_num_threads(1, 50_000_000)
            .context("create article index writer")?;

        let mut article_docs = HashMap::new();
        for article in articles.iter().filter(|article| article.indexed) {
            let markdown = article_markdown(article.slug).unwrap_or_default();
            let body = markdown_to_plaintext(&markdown);
            let title = article.title_alias.unwrap_or(article.title).to_string();
            let doc = ArticleDoc {
                slug: article.slug.to_string(),
                title: title.clone(),
                summary: article.summary.to_string(),
                body: body.clone(),
                category: article.category,
                tags: article.tags.to_vec(),
                date: article.date,
            };
            article_writer
                .add_document(article_to_tantivy_doc(&article_fields, &doc))
                .context("index article document")?;
            article_docs.insert(doc.slug.clone(), doc);
        }
        article_writer.commit().context("commit article index")?;
        let article_reader = article_index.reader().context("create article reader")?;

        let (comment_index, comment_fields) = build_comment_index_schema();
        let mut comment_writer = comment_index
            .writer_with_num_threads(1, 50_000_000)
            .context("create comment index writer")?;
        let mut comment_docs = HashMap::new();
        for record in comments
            .iter()
            .filter(|record| record.status == CommentStatus::Visible.as_str())
        {
            if let Some(doc) = comment_doc_from_record(record, &article_docs) {
                comment_writer
                    .add_document(comment_to_tantivy_doc(&comment_fields, &doc))
                    .context("index comment document")?;
                comment_docs.insert(doc.comment_id.clone(), doc);
            }
        }
        comment_writer.commit().context("commit comment index")?;
        let comment_reader = comment_index.reader().context("create comment reader")?;

        Ok(SearchEngine {
            article_index,
            article_reader,
            article_fields,
            articles: article_docs,
            comment_index,
            comment_reader,
            comment_writer: Mutex::new(comment_writer),
            comment_fields,
            comments: RwLock::new(comment_docs),
        })
    }

    /// Index a freshly created comment. The tantivy commit + reader reload do
    /// blocking I/O, so the work runs on the blocking pool (rust-async-runtime
    /// "spawn_blocking") and the handler awaits the result. Indexing is
    /// BEST-EFFORT: the comment is already durably stored, callers log a
    /// failure and still return 201 — the index rebuilds from the store at
    /// the next boot.
    pub async fn index_comment(self: &Arc<Self>, record: &CommentRecord) -> Result<()> {
        let engine = Arc::clone(self);
        let record = record.clone();
        tokio::task::spawn_blocking(move || engine.index_comment_blocking(&record))
            .await
            .context("comment indexing task panicked")?
    }

    fn index_comment_blocking(&self, record: &CommentRecord) -> Result<()> {
        if record.status != CommentStatus::Visible.as_str() {
            return Ok(());
        }
        let Some(doc) = comment_doc_from_record(record, &self.articles) else {
            return Ok(());
        };

        // Poisoned lock = a previous indexing thread panicked mid-write; the
        // writer state is still usable, so recover instead of cascading.
        let mut writer = self
            .comment_writer
            .lock()
            .unwrap_or_else(PoisonError::into_inner);
        writer
            .add_document(comment_to_tantivy_doc(&self.comment_fields, &doc))
            .context("index new comment")?;
        writer.commit().context("commit new comment")?;
        self.comment_reader
            .reload()
            .context("reload comment reader")?;
        self.comments
            .write()
            // Poison recovery: the map insert below can't observe torn state.
            .unwrap_or_else(PoisonError::into_inner)
            .insert(doc.comment_id.clone(), doc);
        Ok(())
    }

    pub fn typeahead(&self, q: &str, limit: usize) -> Vec<TypeaheadHit> {
        let needle = q.trim().to_lowercase();
        if needle.len() < 2 {
            return Vec::new();
        }

        let mut hits: Vec<(u8, TypeaheadHit)> = self
            .articles
            .values()
            .filter_map(|article| {
                let title = article.title.to_lowercase();
                let summary = article.summary.to_lowercase();
                let rank = if title.starts_with(&needle) {
                    0
                } else if title.contains(&needle) {
                    1
                } else if summary.contains(&needle) {
                    2
                } else {
                    return None;
                };
                Some((
                    rank,
                    TypeaheadHit {
                        kind: "article",
                        title: article.title.clone(),
                        detail: article.summary.clone(),
                        url: format!("/articles/{}", article.slug),
                    },
                ))
            })
            .collect();

        hits.extend(
            self.comments
                .read()
                // Poison recovery: read-only view; a poisoned map is still valid.
                .unwrap_or_else(PoisonError::into_inner)
                .values()
                .filter_map(|comment| {
                    let body = comment.body.to_lowercase();
                    let quote = comment.quote_exact.to_lowercase();
                    let rank = if body.contains(&needle) {
                        3
                    } else if quote.contains(&needle) {
                        4
                    } else {
                        return None;
                    };
                    Some((
                        rank,
                        TypeaheadHit {
                            kind: "comment",
                            title: format!("Comment on {}", comment.article_title),
                            detail: comment.body.clone(),
                            url: format!(
                                "/articles/{}#comment-{}",
                                comment.article_slug, comment.comment_id
                            ),
                        },
                    ))
                }),
        );

        hits.extend(
            matching_products(&needle)
                .into_iter()
                .map(|(rank, product)| {
                    (
                        rank,
                        TypeaheadHit {
                            kind: "product",
                            title: product.name.to_string(),
                            detail: product.description.to_string(),
                            url: product_url(product.slug),
                        },
                    )
                }),
        );

        hits.sort_by(|a, b| a.0.cmp(&b.0).then_with(|| a.1.title.cmp(&b.1.title)));
        hits.into_iter().take(limit).map(|(_, hit)| hit).collect()
    }

    pub fn search(&self, query: &SearchQuery) -> Result<SearchResults> {
        let article_matches = self.article_matches(query)?;
        let comment_matches = self.comment_matches(query)?;
        let facets = facet_counts(&article_matches);

        // Clamp the client-supplied page so `(page - 1) * PAGE_SIZE` can never
        // overflow on a hostile `?page=` value; saturating math as belt-and-braces.
        let page = query.page.clamp(1, MAX_PAGE);
        let start = page.saturating_sub(1).saturating_mul(PAGE_SIZE);
        let article_hits = article_matches
            .iter()
            .skip(start)
            .take(PAGE_SIZE)
            .map(|article| ArticleSearchHit {
                slug: article.slug.clone(),
                title: article.title.clone(),
                snippet: snippet_for(&article.summary, &article.body, &query.q),
                category: article.category,
                tags: article.tags.clone(),
                date: article.date,
            })
            .collect();
        let comment_hits = comment_matches
            .iter()
            .skip(start)
            .take(PAGE_SIZE)
            .map(|comment| CommentSearchHit {
                comment_id: comment.comment_id.clone(),
                article_slug: comment.article_slug.clone(),
                article_title: comment.article_title.clone(),
                author_name: comment.author_name.clone(),
                snippet: snippet_for(&comment.body, &comment.quote_exact, &query.q),
                quote_exact: comment.quote_exact.clone(),
                created_at_ms: comment.created_at_ms,
            })
            .collect();

        // Products are a small fixed set — match by substring (no index needed).
        // Only surfaced for an actual text query, not when browsing/ filtering.
        let (product_hits, total_products) = if query.q.trim().is_empty() {
            (Vec::new(), 0)
        } else {
            let needle = query.q.trim().to_lowercase();
            let mut matches = matching_products(&needle);
            matches.sort_by(|a, b| a.0.cmp(&b.0).then_with(|| a.1.name.cmp(b.1.name)));
            let total = matches.len();
            let hits = matches
                .into_iter()
                .take(PAGE_SIZE)
                .map(|(_, product)| ProductSearchHit {
                    name: product.name.to_string(),
                    description: product.description.to_string(),
                    price: product.price,
                    url: product_url(product.slug),
                    cap_color: product.cap_color.to_string(),
                    thread_color: product.thread_color.to_string(),
                    accent_color: product.accent_color.to_string(),
                })
                .collect();
            (hits, total)
        };

        Ok(SearchResults {
            total_articles: article_matches.len(),
            total_comments: comment_matches.len(),
            total_products,
            article_hits,
            comment_hits,
            product_hits,
            facets,
            page,
            page_size: PAGE_SIZE,
        })
    }

    fn article_matches(&self, query: &SearchQuery) -> Result<Vec<ArticleDoc>> {
        let mut docs = if query.q.trim().is_empty() {
            self.articles.values().cloned().collect::<Vec<_>>()
        } else {
            let searcher = self.article_reader.searcher();
            let mut parser = QueryParser::for_index(
                &self.article_index,
                vec![
                    self.article_fields.title,
                    self.article_fields.summary,
                    self.article_fields.body,
                ],
            );
            parser.set_field_boost(self.article_fields.title, 3.0);
            parser.set_field_boost(self.article_fields.summary, 2.0);
            let parsed = parser.parse_query_lenient(query.q.trim()).0;
            searcher
                .search(
                    parsed.as_ref(),
                    &TopDocs::with_limit(ARTICLE_SEARCH_LIMIT).order_by_score(),
                )
                .context("search article index")?
                .into_iter()
                .filter_map(|(_, address)| {
                    let doc: TantivyDocument = searcher.doc(address).ok()?;
                    let slug = doc.get_first(self.article_fields.slug)?.as_str()?;
                    self.articles.get(slug).cloned()
                })
                .collect::<Vec<_>>()
        };

        docs.retain(|article| article_matches_filters(article, query));
        if query.q.trim().is_empty() {
            docs.sort_by_key(|doc| Reverse(article_date_key(doc.date)));
        }
        Ok(docs)
    }

    fn comment_matches(&self, query: &SearchQuery) -> Result<Vec<CommentDoc>> {
        // Poison recovery: read-only view; a poisoned map is still valid.
        let comments = self.comments.read().unwrap_or_else(PoisonError::into_inner);
        let mut docs = if query.q.trim().is_empty() {
            comments.values().cloned().collect::<Vec<_>>()
        } else {
            let searcher = self.comment_reader.searcher();
            let mut parser = QueryParser::for_index(
                &self.comment_index,
                vec![
                    self.comment_fields.body,
                    self.comment_fields.quote_exact,
                    self.comment_fields.author_name,
                ],
            );
            parser.set_field_boost(self.comment_fields.body, 2.0);
            let parsed: Box<dyn Query> = parser.parse_query_lenient(query.q.trim()).0;
            searcher
                .search(
                    parsed.as_ref(),
                    &TopDocs::with_limit(COMMENT_SEARCH_LIMIT).order_by_score(),
                )
                .context("search comment index")?
                .into_iter()
                .filter_map(|(_, address)| {
                    let doc: TantivyDocument = searcher.doc(address).ok()?;
                    let id = doc.get_first(self.comment_fields.comment_id)?.as_str()?;
                    comments.get(id).cloned()
                })
                .collect::<Vec<_>>()
        };
        drop(comments);

        docs.retain(|comment| {
            self.articles
                .get(&comment.article_slug)
                .map(|article| article_matches_filters(article, query))
                .unwrap_or(false)
        });
        if query.q.trim().is_empty() {
            docs.sort_by_key(|doc| Reverse(doc.created_at_ms));
        }
        Ok(docs)
    }
}

// The old `title_prefix` ngram field was never queried (typeahead matches the
// in-memory ArticleDoc map by substring, the page QueryParser only targets
// title/summary/body) — deleted along with its tokenizer registration, which
// also makes the schema build infallible.
fn build_article_index_schema() -> (Index, ArticleFields) {
    let mut builder = Schema::builder();
    let slug = builder.add_text_field("slug", STRING | STORED);
    let title = builder.add_text_field("title", TEXT | STORED);
    let summary = builder.add_text_field("summary", TEXT | STORED);
    let body = builder.add_text_field("body", TEXT);
    let schema = builder.build();
    let index = Index::create_in_ram(schema);
    (
        index,
        ArticleFields {
            slug,
            title,
            summary,
            body,
        },
    )
}

fn build_comment_index_schema() -> (Index, CommentFields) {
    let mut builder = Schema::builder();
    let comment_id = builder.add_text_field("comment_id", STRING | STORED);
    let article_slug = builder.add_text_field("article_slug", STRING | STORED);
    let author_name = builder.add_text_field("author_name", TEXT | STORED);
    let body = builder.add_text_field("body", TEXT | STORED);
    let quote_exact = builder.add_text_field("quote_exact", TEXT | STORED);
    let schema = builder.build();
    let index = Index::create_in_ram(schema);
    (
        index,
        CommentFields {
            comment_id,
            article_slug,
            author_name,
            body,
            quote_exact,
        },
    )
}

fn article_to_tantivy_doc(fields: &ArticleFields, article: &ArticleDoc) -> TantivyDocument {
    let mut doc = TantivyDocument::new();
    doc.add_text(fields.slug, &article.slug);
    doc.add_text(fields.title, &article.title);
    doc.add_text(fields.summary, &article.summary);
    doc.add_text(fields.body, &article.body);
    doc
}

fn comment_to_tantivy_doc(fields: &CommentFields, comment: &CommentDoc) -> TantivyDocument {
    let mut doc = TantivyDocument::new();
    doc.add_text(fields.comment_id, &comment.comment_id);
    doc.add_text(fields.article_slug, &comment.article_slug);
    doc.add_text(fields.author_name, &comment.author_name);
    doc.add_text(fields.body, &comment.body);
    doc.add_text(fields.quote_exact, &comment.quote_exact);
    doc
}

fn comment_doc_from_record(
    record: &CommentRecord,
    articles: &HashMap<String, ArticleDoc>,
) -> Option<CommentDoc> {
    let article = articles.get(&record.article_slug)?;
    Some(CommentDoc {
        comment_id: record.comment_id.clone(),
        article_slug: record.article_slug.clone(),
        article_title: article.title.clone(),
        author_name: record.author_name.clone(),
        body: record.body.clone(),
        quote_exact: record.quote_exact.clone(),
        created_at_ms: record.created_at_ms,
    })
}

fn article_matches_filters(article: &ArticleDoc, query: &SearchQuery) -> bool {
    (query.categories.is_empty() || query.categories.contains(&article.category))
        && (query.tags.is_empty()
            || query
                .tags
                .iter()
                .all(|selected| article.tags.contains(selected)))
        && query
            .date_from
            .map(|from| article_date_key(article.date) >= article_date_key(from))
            .unwrap_or(true)
        && query
            .date_to
            .map(|to| article_date_key(article.date) <= article_date_key(to))
            .unwrap_or(true)
}

fn facet_counts(articles: &[ArticleDoc]) -> FacetCounts {
    let mut category_counts: HashMap<Category, usize> = HashMap::new();
    let mut tag_counts: HashMap<Tag, usize> = HashMap::new();
    for article in articles {
        *category_counts.entry(article.category).or_default() += 1;
        for tag in &article.tags {
            *tag_counts.entry(*tag).or_default() += 1;
        }
    }

    let categories = Category::ALL
        .iter()
        .filter_map(|category| {
            category_counts
                .get(category)
                .map(|count| (*category, *count))
        })
        .collect();
    let tags = Tag::ALL
        .iter()
        .filter_map(|tag| tag_counts.get(tag).map(|count| (*tag, *count)))
        .collect();
    FacetCounts { categories, tags }
}

pub fn markdown_to_plaintext(markdown: &str) -> String {
    let mut options = pulldown_cmark::Options::empty();
    options.insert(pulldown_cmark::Options::ENABLE_TABLES);
    options.insert(pulldown_cmark::Options::ENABLE_STRIKETHROUGH);
    options.insert(pulldown_cmark::Options::ENABLE_TASKLISTS);
    options.insert(pulldown_cmark::Options::ENABLE_HEADING_ATTRIBUTES);

    let mut output = String::with_capacity(markdown.len());
    for event in pulldown_cmark::Parser::new_ext(markdown, options) {
        match event {
            Event::Text(text) | Event::Code(text) => {
                if output
                    .chars()
                    .last()
                    .map(|character| !character.is_whitespace())
                    .unwrap_or(false)
                {
                    output.push(' ');
                }
                output.push_str(&text);
            }
            Event::SoftBreak | Event::HardBreak => output.push(' '),
            _ => {}
        }
    }
    output.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// Match shop products by substring across name/phrase/description/slug plus a
/// few synthetic keywords ("dad cap", "hat", …). Returns (rank, product) with a
/// lower rank = stronger match. Shared by the typeahead and the full search page.
fn matching_products(needle: &str) -> Vec<(u8, &'static ShopProduct)> {
    if needle.is_empty() {
        return Vec::new();
    }
    SHOP_PRODUCTS
        .iter()
        .filter_map(|product| {
            let name = product.name.to_lowercase();
            let phrase = product.phrase.to_lowercase();
            let slug_words = product.slug.replace('-', " ");
            let rank = if name.starts_with(needle) || slug_words.starts_with(needle) {
                0
            } else if name.contains(needle) || phrase.contains(needle) {
                1
            } else {
                let haystack = format!(
                    "{name} {phrase} {} {slug_words} dad cap caps hat hats embroidered merch store",
                    product.description.to_lowercase()
                );
                if haystack.contains(needle) {
                    2
                } else {
                    return None;
                }
            };
            Some((rank, product))
        })
        .collect()
}

fn product_url(slug: &str) -> String {
    format!("{SHOP_PRODUCT_ORIGIN}/products/{slug}?image=front")
}

fn snippet_for(primary: &str, fallback: &str, q: &str) -> String {
    let source = if !primary.trim().is_empty() {
        primary
    } else {
        fallback
    };
    let trimmed = source.trim();
    if trimmed.is_empty() {
        return String::new();
    }

    let needle = q.split_whitespace().next().unwrap_or("").to_lowercase();
    let lower = trimmed.to_lowercase();
    let start = if needle.len() >= 2 {
        lower.find(&needle).map(|index| index.saturating_sub(60))
    } else {
        None
    }
    .unwrap_or(0);
    let start = previous_char_boundary(trimmed, start);
    let end = next_char_boundary(trimmed, (start + 180).min(trimmed.len()));
    let mut snippet = trimmed[start..end].to_string();
    if start > 0 {
        snippet.insert_str(0, "...");
    }
    if end < trimmed.len() {
        snippet.push_str("...");
    }
    snippet
}

fn previous_char_boundary(text: &str, mut index: usize) -> usize {
    while index > 0 && !text.is_char_boundary(index) {
        index -= 1;
    }
    index
}

fn next_char_boundary(text: &str, mut index: usize) -> usize {
    while index < text.len() && !text.is_char_boundary(index) {
        index += 1;
    }
    index
}

fn article_date_key(date: ArticleDate) -> i32 {
    date.year * 10_000 + i32::from(date.month) * 100 + i32::from(date.day)
}

pub fn parse_article_date(value: &str) -> Option<ArticleDate> {
    let mut parts = value.split('-');
    let year = parts.next()?.parse().ok()?;
    let month = parts.next()?.parse().ok()?;
    let day = parts.next()?.parse().ok()?;
    if parts.next().is_some() {
        return None;
    }
    Some(ArticleDate { year, month, day })
}

pub fn all_indexed_article_tags() -> Vec<Tag> {
    let mut tags = Vec::new();
    for article in public_articles() {
        for tag in article.tags {
            if !tags.contains(tag) {
                tags.push(*tag);
            }
        }
    }
    tags
}

#[cfg(test)]
mod tests {
    use super::{MAX_PAGE, SearchEngine, SearchQuery};
    use crate::content::ARTICLES;

    // A hostile `?page=` value must clamp instead of overflowing
    // `(page - 1) * PAGE_SIZE` (which panics in debug, wraps in release).
    #[test]
    fn hostile_page_param_cannot_overflow_pagination() {
        let engine =
            SearchEngine::build_in_memory(ARTICLES, &[]).expect("search engine builds in memory");
        let query = SearchQuery {
            page: usize::MAX,
            ..SearchQuery::default()
        };
        let results = engine.search(&query).expect("search succeeds");
        assert_eq!(results.page, MAX_PAGE);
        assert!(results.article_hits.is_empty());
        assert!(results.comment_hits.is_empty());
    }
}
