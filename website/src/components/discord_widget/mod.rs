//! Live Discord widget card — co-located component.
//!
//! Renders the cached [`DiscordSnapshot`] into the Vercel-style card spliced
//! into the auteurs article (the `<!--auteurs-discord-widget-->` sentinel).
//! Pure render: the snapshot is hoisted by the caller (the article detail
//! handler reads the watch-channel cache), so this component does no I/O and
//! touches no `static`s. The caller decides what to do when the snapshot is
//! missing — the article's static QR/invite block stays as the fallback join
//! path. `discord.rs` keeps ONLY the service (snapshot + refresh loop).
//!
//! No JS: the card is static server-rendered content (the pip pulse is CSS).
//!
//! Styles: the co-located `style.css` carries the `.discord-widget*` rules
//! verbatim from `articles.css` (ledger #8), un-layered like their source.
//! Tier: `critical_css` — the tier rule reserves `deferred_css` for elements
//! hidden at first paint, and this card is ordinary in-flow article content
//! (below the fold on auteurs, but not hidden), so its sheet stays a
//! render-blocking link, emitted immediately after `articles.css` on both
//! article surfaces (the rules lived in `articles.css`, which the index also
//! loads — per-page selector sets stay unchanged).

use eng_domain::HtmlFragment;
use eng_markup::view;

use super::Rendered;
use crate::discord::{DiscordSnapshot, MemberPreview};

/// Dist asset emitted by `build.rs` from this folder's `style.css` — a
/// generated const (no `SCRIPT`: this component ships no `script.js`), so a
/// renamed folder fails compilation instead of 404ing.
pub use super::asset_names::discord_widget::STYLE;

// How many avatars we render in the overlapping-circles row. Anything
// beyond this collapses into a "+N more" counter.
const AVATARS_VISIBLE: usize = 10;

/// Pure render: `&DiscordSnapshot -> Rendered`. Markup byte-identical to the
/// pre-P4 `discord::render`.
pub fn render(snapshot: &DiscordSnapshot) -> Rendered {
    let initial = snapshot
        .guild_name
        .chars()
        .next()
        .map(|c| c.to_ascii_uppercase().to_string())
        .unwrap_or_else(|| "·".to_string());

    let online_text = format!("{} online", snapshot.online_count);
    let member_text = snapshot
        .member_count
        .map(|n| format!("{n} members"))
        .unwrap_or_default();

    let visible: Vec<&MemberPreview> = snapshot
        .members
        .iter()
        .filter(|m| m.avatar_url.is_some())
        .take(AVATARS_VISIBLE)
        .collect();

    let overflow = snapshot
        .members
        .iter()
        .filter(|m| m.avatar_url.is_some())
        .count()
        .saturating_sub(visible.len());

    let avatars: HtmlFragment = visible
        .into_iter()
        .map(|m| {
            view! {
                <img class="discord-widget-avatar"
                     src={ m.avatar_url.clone().unwrap_or_default() }
                     alt={ m.username.clone() }
                     loading="lazy"
                     width="28"
                     height="28" />
            }
        })
        .collect();

    let overflow_node = if overflow > 0 {
        view! { <span class="discord-widget-avatars-more">{ format!("+{overflow}") }</span> }
    } else {
        HtmlFragment::empty()
    };

    let avatars_row = if snapshot.members.is_empty() {
        HtmlFragment::empty()
    } else {
        view! {
            <div class="discord-widget-avatars" aria-label="Members currently online">
                { avatars }
                { overflow_node }
            </div>
        }
    };

    let voice_row = if snapshot.voice_channels.is_empty() {
        HtmlFragment::empty()
    } else {
        let chips: HtmlFragment = snapshot
            .voice_channels
            .iter()
            .map(|c| {
                view! {
                    <span class="discord-widget-channel">
                        <span class="discord-widget-channel-icon" aria-hidden="true">"#"</span>
                        { c.name.clone() }
                    </span>
                }
            })
            .collect();
        view! {
            <div class="discord-widget-channels" aria-label="Voice channels">
                { chips }
            </div>
        }
    };

    let member_count_node = if member_text.is_empty() {
        HtmlFragment::empty()
    } else {
        view! { <span class="discord-widget-members">{ member_text }</span> }
    };

    let markup = view! {
        <aside class="discord-widget" aria-label="Live Discord server stats">
            <div class="discord-widget-header">
                <div class="discord-widget-icon" aria-hidden="true">{ initial }</div>
                <div class="discord-widget-title">
                    <div class="discord-widget-name">{ snapshot.guild_name.clone() }</div>
                    { member_count_node }
                </div>
                <div class="discord-widget-online">
                    <span class="discord-widget-pip" aria-hidden="true"></span>
                    { online_text }
                </div>
            </div>
            { avatars_row }
            { voice_row }
            <a class="discord-widget-join"
               href={ snapshot.instant_invite.clone() }
               target="_blank"
               rel="noopener">
                "Join the Discord"
                <span class="discord-widget-join-arrow" aria-hidden="true">"↗"</span>
            </a>
        </aside>
    };

    Rendered {
        markup,
        critical_css: vec![STYLE],
        deferred_css: Vec::new(),
        js_deps: Vec::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::discord::VoiceChannel;

    fn snapshot() -> DiscordSnapshot {
        DiscordSnapshot {
            guild_name: "auteurs".to_string(),
            instant_invite: "https://discord.gg/sTzQBrbnBM".to_string(),
            member_count: Some(420),
            online_count: 13,
            members: vec![
                MemberPreview {
                    username: "ada".to_string(),
                    avatar_url: Some("https://cdn.example/a.png".to_string()),
                },
                MemberPreview {
                    username: "grace".to_string(),
                    avatar_url: None,
                },
            ],
            voice_channels: vec![VoiceChannel {
                name: "studio".to_string(),
            }],
        }
    }

    #[test]
    fn renders_card_from_snapshot() {
        let html = render(&snapshot()).markup.into_string();
        assert!(
            html.contains(
                r#"<aside class="discord-widget" aria-label="Live Discord server stats">"#
            )
        );
        // Guild initial, counts, avatar row (avatar-less members excluded),
        // voice chips, and the join CTA.
        assert!(html.contains(r#"<div class="discord-widget-icon" aria-hidden="true">A</div>"#));
        assert!(html.contains("13 online"));
        assert!(html.contains("420 members"));
        assert!(html.contains(r#"alt="ada""#));
        assert!(!html.contains("grace"));
        assert!(html.contains(r#"class="discord-widget-channel""#));
        assert!(html.contains("Join the Discord"));
        assert!(html.contains(r#"href="https://discord.gg/sTzQBrbnBM""#));
    }

    #[test]
    fn styles_are_critical_no_js() {
        // Tier rule: the card is visible in-flow content (not hidden at
        // load), so its sheet is render-blocking, never deferred.
        let rendered = render(&snapshot());
        assert_eq!(rendered.critical_css, vec![STYLE]);
        assert!(rendered.deferred_css.is_empty());
        assert!(rendered.js_deps.is_empty());
    }
}
