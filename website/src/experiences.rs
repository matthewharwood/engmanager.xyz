// Web API Experiences manifest loader + parity guard.
//
// Embeds the manifest file at compile time so the binary doesn't need
// to find it at runtime. The `manifest_parity` test asserts that every
// `id` in `website/experiences/manifest.toml` has a matching entry in
// `website/js/src/experiences.js`. Adding a new API to the manifest
// without wiring it up in JS fails `cargo test`.

const MANIFEST: &str = include_str!("../experiences/manifest.toml");

pub struct Experience<'a> {
    pub id: &'a str,
    pub name: &'a str,
    pub group: &'a str,
}

// Tiny TOML reader for `[[api]]` blocks — the manifest is hand-curated
// and only uses three string keys, so a real toml crate would be
// overkill. We just scan for `id = "..."` / `name = "..."` /
// `group = "..."` and produce one Experience per `[[api]]` marker.
pub fn parse(input: &str) -> Vec<Experience<'_>> {
    let mut out: Vec<Experience<'_>> = Vec::new();
    let mut id: Option<&str> = None;
    let mut name: Option<&str> = None;
    let mut group: Option<&str> = None;

    for line in input.lines() {
        let trimmed = line.trim();
        if trimmed == "[[api]]" {
            push_entry(&mut out, id, name, group);
            id = None;
            name = None;
            group = None;
            continue;
        }
        if let Some(value) = parse_kv(trimmed, "id") {
            id = Some(value);
        } else if let Some(value) = parse_kv(trimmed, "name") {
            name = Some(value);
        } else if let Some(value) = parse_kv(trimmed, "group") {
            group = Some(value);
        }
    }
    push_entry(&mut out, id, name, group);
    out
}

fn push_entry<'a>(
    out: &mut Vec<Experience<'a>>,
    id: Option<&'a str>,
    name: Option<&'a str>,
    group: Option<&'a str>,
) {
    if let (Some(id), Some(name), Some(group)) = (id, name, group) {
        out.push(Experience { id, name, group });
    }
}

fn parse_kv<'a>(line: &'a str, key: &str) -> Option<&'a str> {
    let prefix = format!("{key} = \"");
    let rest = line.strip_prefix(&prefix)?;
    rest.strip_suffix('"')
}

pub fn all() -> Vec<Experience<'static>> {
    parse(MANIFEST)
}

#[cfg(test)]
mod tests {
    use super::*;

    const JS: &str = include_str!("../js/src/experiences.js");

    #[test]
    fn manifest_is_non_empty() {
        let entries = all();
        assert!(
            entries.len() >= 144,
            "expected at least 144 manifest entries, got {}",
            entries.len()
        );
    }

    #[test]
    fn manifest_parity() {
        let entries = all();
        for entry in &entries {
            let needle = format!("id: \"{}\"", entry.id);
            assert!(
                JS.contains(&needle),
                "experiences.js missing entry for `{}` (name: {})",
                entry.id,
                entry.name
            );
        }
    }

    #[test]
    fn manifest_ids_unique() {
        let mut seen = std::collections::HashSet::new();
        for entry in all() {
            assert!(seen.insert(entry.id), "duplicate manifest id: {}", entry.id);
        }
    }

    #[test]
    fn groups_are_known() {
        const VALID: &[&str] = &[
            "device",
            "input",
            "storage",
            "network",
            "background",
            "media",
            "graphics",
            "security",
            "pwa",
            "hardware",
            "privacy",
            "meta",
        ];
        for entry in all() {
            assert!(
                VALID.contains(&entry.group),
                "unknown group `{}` for entry `{}`",
                entry.group,
                entry.id
            );
        }
    }
}
