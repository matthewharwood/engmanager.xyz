//! Inventory safety uses the exact parsed helpers executed by build.rs.
#[path = "../build/inventory.rs"]
mod inventory;

use std::collections::BTreeSet;

fn names(values: &[&str]) -> BTreeSet<String> {
    values.iter().map(|value| (*value).to_owned()).collect()
}

#[test]
fn unknown_selectors_decode_unicode_escapes_and_nested_identifiers() {
    let classes = inventory::css_classes(
        r".foo,.café,.cafe\301,.unused,.prefix-active,:is(.nested,.other){color:red}",
    );
    let mut reserved = BTreeSet::new();
    for value in [
        r".f\6f o",
        ".café",
        "cafe\u{301}",
        r":is(.nested):not(.other)",
        "prefix-",
    ] {
        inventory::reserve_unknown(value, &classes, &mut reserved);
    }
    assert_eq!(
        reserved,
        names(&[
            "foo",
            "café",
            "cafe\u{301}",
            "nested",
            "other",
            "prefix-active"
        ])
    );
    assert!(!reserved.contains("unused"));
}

#[test]
fn ambiguous_class_attribute_and_escaped_fragments_pin_all_names() {
    let classes = names(&["foo", "bar", "café"]);
    for value in [
        r#":is([ClAsS*="f\6f o"]):hover"#,
        ".f\\",
        r#"<div CLASS = 'caf&eacute;'>"#,
        r#"<div class="prefix-{value}">"#,
    ] {
        let mut reserved = BTreeSet::new();
        inventory::reserve_unknown(value, &classes, &mut reserved);
        assert_eq!(reserved, classes, "unmanaged reference {value:?}");
    }
}

#[test]
fn html_inventory_handles_case_spacing_unicode_and_raw_script_text() {
    let source = "<div CLASS \n = 'café foo' data-class=bar><span class=bar></span><script>const fake='<div class=unused>';</script></div>";
    let values: Vec<_> = inventory::html_class_ranges(source)
        .into_iter()
        .map(|(start, end)| &source[start..end])
        .collect();
    assert_eq!(values, ["café foo", "bar"]);
    let script = inventory::html_script_ranges(source);
    assert_eq!(script.len(), 1);
    assert_eq!(
        &source[script[0].0..script[0].1],
        "const fake='<div class=unused>';"
    );
    let classes = names(&["foo", "bar", "café", "unused"]);
    let mut reserved = BTreeSet::new();
    inventory::reserve_unknown(source, &classes, &mut reserved);
    assert!(reserved.is_superset(&names(&["foo", "bar", "café"])));
}

#[test]
fn markdown_binds_all_real_html_but_preserves_prose_and_fenced_examples() {
    let source = "# Heading {.heading-class}\n\n<div CLASS \n = \"café\">\nblock\n</div>\n\nA <span CLASS   = 'foo'>word</span>.\n\n```html\n<div CLASS=\"example\">\n```\n\nclass=\"prose\"\n";
    let (ranges, heading_classes) = inventory::markdown_inventory(source);
    let actual_html = ranges
        .iter()
        .map(|range| &source[range.clone()])
        .collect::<Vec<_>>()
        .join("");
    let attributes: Vec<_> = ranges
        .iter()
        .flat_map(|range| {
            let block = &source[range.clone()];
            inventory::html_class_ranges(block)
                .into_iter()
                .map(move |(start, end)| &block[start..end])
        })
        .collect();
    assert_eq!(
        attributes,
        ["café", "foo"],
        "multi-line opening tags remain complete rewriter inputs"
    );
    assert!(actual_html.contains("CLASS \n = \"café\""));
    assert!(actual_html.contains("CLASS   = 'foo'"));
    assert!(!actual_html.contains("example"));
    assert!(!actual_html.contains("prose"));
    assert_eq!(heading_classes, names(&["heading-class"]));
}

#[test]
fn html_text_contexts_never_rewrite_lookalike_markup() {
    for tag in [
        "style", "textarea", "title", "xmp", "iframe", "noembed", "noframes", "noscript",
    ] {
        let source = format!(
            "<{tag} class=outer><span class=fake><script>invalid javascript text</script></{tag}><span class=actual>"
        );
        let values: Vec<_> = inventory::html_class_ranges(&source)
            .into_iter()
            .map(|(start, end)| &source[start..end])
            .collect();
        assert_eq!(values, ["outer", "actual"], "raw/RCDATA {tag}");
        assert!(
            inventory::html_script_ranges(&source).is_empty(),
            "script-looking text inside {tag}"
        );
    }
    let plaintext = "<plaintext class=outer><span class=fake></plaintext><span class=also-text>";
    let values: Vec<_> = inventory::html_class_ranges(plaintext)
        .into_iter()
        .map(|(start, end)| &plaintext[start..end])
        .collect();
    assert_eq!(values, ["outer"]);
    let real_script = "<script SRC   = 'external.js'>invalid javascript</script><script TYPE = 'application/json'>{}</script><script>const actual=1;</script>";
    let scripts = inventory::html_script_ranges(real_script);
    assert_eq!(scripts.len(), 1);
    assert_eq!(&real_script[scripts[0].0..scripts[0].1], "const actual=1;");
}

#[test]
fn markdown_inventory_matches_production_without_math_extension() {
    let source = "$<span CLASS = 'foo'>word</span>$";
    let (ranges, _) = inventory::markdown_inventory(source);
    let actual = ranges
        .into_iter()
        .map(|range| &source[range])
        .collect::<Vec<_>>()
        .join("");
    assert!(actual.contains("CLASS = 'foo'"));
}
