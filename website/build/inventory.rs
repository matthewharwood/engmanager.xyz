//! Parsed source inventory shared by the website build and its regression tests.
use lightningcss::selector::{Component, Selector, SelectorList};
use lightningcss::stylesheet::{ParserOptions, StyleSheet};
use lightningcss::traits::ParseWithOptions;
use lightningcss::visitor::{Visit, VisitTypes, Visitor};
use pulldown_cmark::{Event, Parser, Tag};
use std::collections::BTreeSet;
use std::ops::Range;

fn collect_selector(selector: &Selector<'_>, found: &mut BTreeSet<String>) {
    for component in selector.iter_raw_match_order() {
        match component {
            Component::Class(name) => {
                found.insert(name.0.to_string());
            }
            Component::Is(items)
            | Component::Where(items)
            | Component::Negation(items)
            | Component::Has(items)
            | Component::Any(_, items) => {
                for item in items.iter() {
                    collect_selector(item, found);
                }
            }
            Component::Slotted(item) | Component::Host(Some(item)) => collect_selector(item, found),
            Component::NthOf(items) => {
                for item in items.selectors() {
                    collect_selector(item, found);
                }
            }
            _ => {}
        }
    }
}

/// Reserve unknown references rather than rewriting guessed semantics.
pub fn reserve_unknown(value: &str, classes: &BTreeSet<String>, reserved: &mut BTreeSet<String>) {
    // A parser decodes escaped identifiers and preserves Unicode identifiers.
    // Attribute selectors may observe partial/exact class attributes, so an
    // unmanaged class-attribute query conservatively pins the entire namespace.
    let escaped_fragment = value.trim_end().ends_with('\\')
        && (value.trim_start().starts_with('.') || value.contains("[class"));
    if escaped_fragment {
        reserved.extend(classes.iter().cloned());
    }
    if let Ok(selectors) = SelectorList::parse_string_with_options(value, ParserOptions::default())
    {
        let mut found = BTreeSet::new();
        for selector in &selectors.0 {
            collect_selector(selector, &mut found);
            if observes_class_attribute(selector) {
                reserved.extend(classes.iter().cloned());
            }
        }
        reserved.extend(found.into_iter().filter(|name| classes.contains(name)));
    } else if value.contains('\\')
        && (value.trim_start().starts_with('.') || value.contains("[class"))
    {
        // An incomplete escaped selector could be completed dynamically. Its
        // eventual identifier cannot be inferred safely from a string segment.
        reserved.extend(classes.iter().cloned());
    }
    // HTML attributes are a separate grammar; names and arbitrary spacing are
    // case-insensitive. Encoded/dynamically interpolated attribute values remain
    // untouched and pin all names instead of pretending their inventory is complete.
    for (start, end) in html_class_ranges(value) {
        let attribute = &value[start..end];
        if attribute.contains(['&', '{', '\\']) {
            reserved.extend(classes.iter().cloned());
        } else {
            reserved.extend(
                attribute
                    .split_ascii_whitespace()
                    .filter(|name| classes.contains(*name))
                    .map(str::to_owned),
            );
        }
    }
    // Exact raw tokens include combining marks and other valid non-ASCII code
    // points. The lexical fallback only RESERVES names/prefixes; it never rewrites.
    reserved.extend(
        value
            .split_ascii_whitespace()
            .filter(|name| classes.contains(*name))
            .map(str::to_owned),
    );
    for token in
        value.split(|c: char| !(c.is_alphanumeric() || c == '-' || c == '_' || !c.is_ascii()))
    {
        if classes.contains(token) {
            reserved.insert(token.to_owned());
        } else if token.ends_with('-') || token.ends_with('_') {
            reserved.extend(
                classes
                    .iter()
                    .filter(|class| class.starts_with(token))
                    .cloned(),
            );
        }
    }
}

fn observes_class_attribute(selector: &Selector<'_>) -> bool {
    selector
        .iter_raw_match_order()
        .any(|component| match component {
            Component::AttributeInNoNamespace { local_name, .. }
            | Component::AttributeInNoNamespaceExists { local_name, .. } => {
                local_name.0.eq_ignore_ascii_case("class")
            }
            Component::AttributeOther(attribute) => {
                attribute.local_name.0.eq_ignore_ascii_case("class")
            }
            Component::Is(items)
            | Component::Where(items)
            | Component::Negation(items)
            | Component::Has(items)
            | Component::Any(_, items) => items.iter().any(observes_class_attribute),
            Component::Slotted(item) | Component::Host(Some(item)) => {
                observes_class_attribute(item)
            }
            Component::NthOf(items) => items.selectors().iter().any(observes_class_attribute),
            _ => false,
        })
}

/// Return every actual HTML event, keeping fenced code and prose unmodified.
/// Heading attributes are generated by Markdown, so pin their class names until
/// a dedicated heading binding adapter can rewrite those generated attributes.
pub fn markdown_inventory(source: &str) -> (Vec<Range<usize>>, BTreeSet<String>) {
    let mut html: Vec<Range<usize>> = Vec::new();
    let mut classes = BTreeSet::new();
    for (event, range) in Parser::new_ext(
        source,
        pulldown_cmark::Options::ENABLE_TABLES
            | pulldown_cmark::Options::ENABLE_STRIKETHROUGH
            | pulldown_cmark::Options::ENABLE_TASKLISTS
            | pulldown_cmark::Options::ENABLE_HEADING_ATTRIBUTES,
    )
    .into_offset_iter()
    {
        match event {
            Event::Html(_) | Event::InlineHtml(_) => {
                // Pulldown may emit one HTML block as adjacent line events.
                // Keep multi-line opening tags intact for the HTML rewriter.
                if let Some(previous) = html
                    .last_mut()
                    .filter(|previous| previous.end == range.start)
                {
                    previous.end = range.end;
                } else {
                    html.push(range);
                }
            }
            Event::Start(Tag::Heading {
                classes: heading_classes,
                ..
            }) => {
                classes.extend(heading_classes.into_iter().map(|name| name.to_string()));
            }
            _ => {}
        }
    }
    (html, classes)
}

pub fn css_classes(source: &str) -> BTreeSet<String> {
    struct Collect(BTreeSet<String>);
    impl<'i> Visitor<'i> for Collect {
        type Error = std::convert::Infallible;
        fn visit_types(&self) -> VisitTypes {
            VisitTypes::SELECTORS
        }
        fn visit_selector(&mut self, selector: &mut Selector<'i>) -> Result<(), Self::Error> {
            collect_selector(selector, &mut self.0);
            Ok(())
        }
    }
    let mut sheet =
        StyleSheet::parse(source, ParserOptions::default()).expect("parse CSS inventory");
    let mut visitor = Collect(BTreeSet::new());
    sheet.visit(&mut visitor).expect("infallible CSS inventory");
    visitor.0
}

/// Tokenize actual HTML attributes while retaining source offsets. Raw-text
/// and RCDATA elements use browser parsing boundaries, never nested markup.
/// Noscript is raw text with the website's enabled scripting mode.
#[derive(Default)]
struct HtmlInventory {
    classes: Vec<(usize, usize)>,
    scripts: Vec<(usize, usize)>,
}

pub fn html_class_ranges(source: &str) -> Vec<(usize, usize)> {
    html_inventory(source).classes
}

pub fn html_script_ranges(source: &str) -> Vec<(usize, usize)> {
    html_inventory(source).scripts
}

fn raw_text_end(source: &str, cursor: usize, name: &str) -> usize {
    let lower = source.to_ascii_lowercase();
    let needle = format!("</{name}");
    let mut at = cursor;
    while let Some(offset) = lower[at..].find(&needle) {
        let found = at + offset;
        let next = found + needle.len();
        if lower
            .as_bytes()
            .get(next)
            .is_none_or(|byte| byte.is_ascii_whitespace() || matches!(byte, b'>' | b'/'))
        {
            return found;
        }
        at = next;
    }
    source.len()
}

fn html_inventory(source: &str) -> HtmlInventory {
    let bytes = source.as_bytes();
    let mut result = HtmlInventory::default();
    let mut cursor = 0;
    let fragment = source
        .trim_start()
        .get(..5)
        .is_some_and(|name| name.eq_ignore_ascii_case("class"));
    while cursor < bytes.len() {
        let tag = if fragment && cursor == 0 {
            0
        } else {
            let Some(offset) = source[cursor..].find('<') else {
                break;
            };
            cursor + offset + 1
        };
        cursor = tag;
        if source[tag..].starts_with("!--") {
            cursor = source[tag..]
                .find("-->")
                .map_or(bytes.len(), |end| tag + end + 3);
            continue;
        }
        if !fragment || tag != 0 {
            while cursor < bytes.len()
                && !bytes[cursor].is_ascii_whitespace()
                && bytes[cursor] != b'>'
            {
                cursor += 1;
            }
        }
        let name = source[tag..cursor]
            .trim_end_matches('/')
            .to_ascii_lowercase();
        let mut external_script = false;
        let mut script_type = String::new();
        while cursor < bytes.len() && bytes[cursor] != b'>' {
            while cursor < bytes.len() && bytes[cursor].is_ascii_whitespace() {
                cursor += 1;
            }
            let start = cursor;
            while cursor < bytes.len()
                && !bytes[cursor].is_ascii_whitespace()
                && !matches!(bytes[cursor], b'=' | b'>')
            {
                cursor += 1;
            }
            let attr = &source[start..cursor];
            if attr.eq_ignore_ascii_case("src") {
                external_script = true;
            }
            while cursor < bytes.len() && bytes[cursor].is_ascii_whitespace() {
                cursor += 1;
            }
            if cursor >= bytes.len() || bytes[cursor] != b'=' {
                if cursor == start {
                    cursor += 1;
                }
                continue;
            }
            cursor += 1;
            while cursor < bytes.len() && bytes[cursor].is_ascii_whitespace() {
                cursor += 1;
            }
            if cursor >= bytes.len() {
                break;
            }
            let quote = matches!(bytes[cursor], b'\'' | b'"').then_some(bytes[cursor]);
            if quote.is_some() {
                cursor += 1;
            }
            let value_start = cursor;
            while cursor < bytes.len()
                && if let Some(quote) = quote {
                    bytes[cursor] != quote
                } else {
                    !bytes[cursor].is_ascii_whitespace() && bytes[cursor] != b'>'
                }
            {
                cursor += 1;
            }
            if attr.eq_ignore_ascii_case("class") {
                result.classes.push((value_start, cursor));
            }
            if attr.eq_ignore_ascii_case("type") {
                script_type = source[value_start..cursor].trim().to_ascii_lowercase();
            }
            if quote.is_some() && cursor < bytes.len() {
                cursor += 1;
            }
        }
        cursor = (cursor + 1).min(bytes.len());
        if name == "plaintext" {
            break;
        }
        if matches!(
            name.as_str(),
            "script"
                | "style"
                | "textarea"
                | "title"
                | "xmp"
                | "iframe"
                | "noembed"
                | "noframes"
                | "noscript"
        ) {
            let end = raw_text_end(source, cursor, &name);
            if name == "script"
                && !external_script
                && matches!(
                    script_type.as_str(),
                    "" | "module"
                        | "text/javascript"
                        | "application/javascript"
                        | "text/ecmascript"
                        | "application/ecmascript"
                )
            {
                result.scripts.push((cursor, end));
            }
            cursor = end;
        }
    }
    result
}
