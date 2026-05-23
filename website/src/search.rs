use std::collections::HashMap;
use std::sync::{Mutex, RwLock};

use anyhow::{Context, Result};
use pulldown_cmark::Event;
use serde::Serialize;
use tantivy::collector::TopDocs;
use tantivy::query::{Query, QueryParser};
use tantivy::schema::document::Value;
use tantivy::schema::{
    Field, IndexRecordOption, STORED, STRING, Schema, TEXT, TextFieldIndexing, TextOptions,
};
use tantivy::tokenizer::{LowerCaser, NgramTokenizer, TextAnalyzer};
use tantivy::{Index, IndexReader, IndexWriter, TantivyDocument};

use crate::comments::CommentRecord;
use crate::pages::articles::{
    Article, ArticleDate, Category, Tag, article_markdown, public_articles,
};

const ARTICLE_SEARCH_LIMIT: usize = 1_000;
const COMMENT_SEARCH_LIMIT: usize = 1_000;
const PAGE_SIZE: usize = 20;

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
    title_prefix: Field,
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
    pub total_articles: usize,
    pub total_comments: usize,
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
        let (article_index, article_fields) = build_article_index_schema()?;
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
        for record in comments.iter().filter(|record| record.status == "visible") {
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

    pub fn index_comment(&self, record: &CommentRecord) -> Result<()> {
        if record.status != "visible" {
            return Ok(());
        }
        let Some(doc) = comment_doc_from_record(record, &self.articles) else {
            return Ok(());
        };

        let mut writer = self.comment_writer.lock().expect("comment index lock");
        writer
            .add_document(comment_to_tantivy_doc(&self.comment_fields, &doc))
            .context("index new comment")?;
        writer.commit().context("commit new comment")?;
        self.comment_reader
            .reload()
            .context("reload comment reader")?;
        self.comments
            .write()
            .expect("comment metadata lock")
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
                .expect("comment metadata lock")
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

        hits.sort_by(|a, b| a.0.cmp(&b.0).then_with(|| a.1.title.cmp(&b.1.title)));
        hits.into_iter().take(limit).map(|(_, hit)| hit).collect()
    }

    pub fn search(&self, query: &SearchQuery) -> Result<SearchResults> {
        let article_matches = self.article_matches(query)?;
        let comment_matches = self.comment_matches(query)?;
        let facets = facet_counts(&article_matches);

        let page = query.page.max(1);
        let start = (page - 1) * PAGE_SIZE;
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

        Ok(SearchResults {
            total_articles: article_matches.len(),
            total_comments: comment_matches.len(),
            article_hits,
            comment_hits,
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
            docs.sort_by(|a, b| article_date_key(b.date).cmp(&article_date_key(a.date)));
        }
        Ok(docs)
    }

    fn comment_matches(&self, query: &SearchQuery) -> Result<Vec<CommentDoc>> {
        let comments = self.comments.read().expect("comment metadata lock");
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
            docs.sort_by(|a, b| b.created_at_ms.cmp(&a.created_at_ms));
        }
        Ok(docs)
    }
}

fn build_article_index_schema() -> Result<(Index, ArticleFields)> {
    let mut builder = Schema::builder();
    let slug = builder.add_text_field("slug", STRING | STORED);
    let title = builder.add_text_field("title", TEXT | STORED);
    let title_prefix = builder.add_text_field(
        "title_prefix",
        TextOptions::default().set_indexing_options(
            TextFieldIndexing::default()
                .set_tokenizer("title_prefix")
                .set_index_option(IndexRecordOption::Basic),
        ),
    );
    let summary = builder.add_text_field("summary", TEXT | STORED);
    let body = builder.add_text_field("body", TEXT);
    let schema = builder.build();
    let index = Index::create_in_ram(schema);
    let prefix_tokenizer =
        TextAnalyzer::builder(NgramTokenizer::prefix_only(2, 15).context("prefix tokenizer")?)
            .filter(LowerCaser)
            .build();
    index
        .tokenizers()
        .register("title_prefix", prefix_tokenizer);
    Ok((
        index,
        ArticleFields {
            slug,
            title,
            title_prefix,
            summary,
            body,
        },
    ))
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
    doc.add_text(fields.title_prefix, &article.title);
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
