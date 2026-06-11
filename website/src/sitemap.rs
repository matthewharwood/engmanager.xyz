use axum::http::header;
use axum::response::{IntoResponse, Response};

use crate::content::{ArticleDate, public_articles};

const SITE_ORIGIN: &str = "https://engmanager.xyz";
const SITEMAP_PATH: &str = "/sitemap.xml";

pub async fn sitemap_handler() -> Response {
    (
        [
            (
                header::CONTENT_TYPE,
                "application/xml; charset=utf-8".to_string(),
            ),
            (
                header::CACHE_CONTROL,
                "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400".to_string(),
            ),
        ],
        render_sitemap(),
    )
        .into_response()
}

pub async fn robots_handler() -> Response {
    (
        [
            (
                header::CONTENT_TYPE,
                "text/plain; charset=utf-8".to_string(),
            ),
            (
                header::CACHE_CONTROL,
                "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400".to_string(),
            ),
        ],
        format!("User-agent: *\nAllow: /\nSitemap: {SITE_ORIGIN}{SITEMAP_PATH}\n"),
    )
        .into_response()
}

fn render_sitemap() -> String {
    let latest_article_date = latest_public_article_date()
        .map(ArticleDate::iso)
        .unwrap_or_else(|| "2026-05-17".to_string());

    let mut xml = String::from(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
"#,
    );

    push_url(&mut xml, "/", Some(&latest_article_date), "weekly", "1.0");
    push_url(
        &mut xml,
        "/articles/",
        Some(&latest_article_date),
        "weekly",
        "0.8",
    );

    for article in public_articles() {
        let path = format!("/articles/{}", article.slug);
        push_url(&mut xml, &path, Some(&article.date.iso()), "monthly", "0.7");
    }

    xml.push_str("</urlset>\n");
    xml
}

fn latest_public_article_date() -> Option<ArticleDate> {
    public_articles()
        .map(|article| article.date)
        .max_by_key(|date| (date.year, date.month, date.day))
}

fn push_url(xml: &mut String, path: &str, lastmod: Option<&str>, changefreq: &str, priority: &str) {
    xml.push_str("  <url>\n");
    xml.push_str("    <loc>");
    xml_escape_into(xml, SITE_ORIGIN);
    xml_escape_into(xml, path);
    xml.push_str("</loc>\n");

    if let Some(lastmod) = lastmod {
        xml.push_str("    <lastmod>");
        xml_escape_into(xml, lastmod);
        xml.push_str("</lastmod>\n");
    }

    xml.push_str("    <changefreq>");
    xml_escape_into(xml, changefreq);
    xml.push_str("</changefreq>\n");
    xml.push_str("    <priority>");
    xml_escape_into(xml, priority);
    xml.push_str("</priority>\n");
    xml.push_str("  </url>\n");
}

fn xml_escape_into(out: &mut String, value: &str) {
    for c in value.chars() {
        match c {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&apos;"),
            _ => out.push(c),
        }
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashSet;

    use super::*;
    use crate::content::ARTICLES;

    const SITEMAP_NS: &str = "http://www.sitemaps.org/schemas/sitemap/0.9";

    #[test]
    fn sitemap_xml_stays_valid_and_complete() {
        let xml = render_sitemap();
        let doc = roxmltree::Document::parse(&xml).expect("sitemap must be valid XML");
        let root = doc.root_element();
        assert_eq!(root.tag_name().name(), "urlset");
        assert_eq!(root.tag_name().namespace(), Some(SITEMAP_NS));

        let urls: Vec<_> = root
            .children()
            .filter(|node| is_sitemap_element(*node, "url"))
            .collect();
        let locs: Vec<&str> = urls.iter().map(|url| child_text(*url, "loc")).collect();

        let mut expected_locs = vec![
            format!("{SITE_ORIGIN}/"),
            format!("{SITE_ORIGIN}/articles/"),
        ];
        expected_locs.extend(
            public_articles().map(|article| format!("{SITE_ORIGIN}/articles/{}", article.slug)),
        );

        assert_eq!(
            locs,
            expected_locs.iter().map(String::as_str).collect::<Vec<_>>(),
            "sitemap should expose the homepage, article index, and every public article in order",
        );

        let unique_locs: HashSet<_> = locs.iter().copied().collect();
        assert_eq!(
            unique_locs.len(),
            locs.len(),
            "sitemap contains duplicate <loc> values"
        );

        for article in ARTICLES {
            let loc = format!("{SITE_ORIGIN}/articles/{}", article.slug);
            if article.indexed {
                assert!(
                    unique_locs.contains(loc.as_str()),
                    "indexed article `{}` missing from sitemap",
                    article.slug,
                );
            } else {
                assert!(
                    !unique_locs.contains(loc.as_str()),
                    "noindex article `{}` leaked into sitemap",
                    article.slug,
                );
            }
        }

        for url in urls {
            let loc = child_text(url, "loc");
            assert!(
                loc.starts_with("https://"),
                "sitemap loc must be absolute HTTPS: {loc}"
            );
            assert_iso_date(child_text(url, "lastmod"));

            let changefreq = child_text(url, "changefreq");
            assert!(
                matches!(changefreq, "weekly" | "monthly"),
                "unexpected changefreq `{changefreq}` for {loc}",
            );

            let priority = child_text(url, "priority");
            assert!(
                matches!(priority, "1.0" | "0.8" | "0.7"),
                "unexpected priority `{priority}` for {loc}",
            );
        }
    }

    fn is_sitemap_element(node: roxmltree::Node<'_, '_>, name: &str) -> bool {
        node.is_element()
            && node.tag_name().name() == name
            && node.tag_name().namespace() == Some(SITEMAP_NS)
    }

    fn child_text<'a, 'input>(url: roxmltree::Node<'a, 'input>, name: &str) -> &'a str {
        url.children()
            .find(|node| is_sitemap_element(*node, name))
            .and_then(|node| node.text())
            .unwrap_or_else(|| {
                panic!(
                    "sitemap <url> missing <{}>: {}",
                    name,
                    url.text().unwrap_or_default()
                )
            })
    }

    fn assert_iso_date(value: &str) {
        let bytes = value.as_bytes();
        assert_eq!(bytes.len(), 10, "lastmod must be YYYY-MM-DD: {value}");
        assert_eq!(bytes[4], b'-', "lastmod must be YYYY-MM-DD: {value}");
        assert_eq!(bytes[7], b'-', "lastmod must be YYYY-MM-DD: {value}");
        assert!(
            bytes
                .iter()
                .enumerate()
                .all(|(index, byte)| matches!(index, 4 | 7) || byte.is_ascii_digit()),
            "lastmod must be YYYY-MM-DD: {value}",
        );
    }
}
