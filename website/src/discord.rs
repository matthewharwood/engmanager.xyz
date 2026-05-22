// Discord server widget + invite metadata, polled in the background and
// served from an in-memory snapshot. The Axum handler does zero I/O —
// it `.await`s a tokio RwLock read and renders the cached fragment.
//
// Why two endpoints:
//   - Widget (`/guilds/{id}/widget.json`) gives presence count, a sample
//     of online members with avatars, and the list of voice channels.
//     Requires "Enable Server Widget" in the server's settings.
//   - Invite (`/invites/{code}?with_counts=true`) gives approximate total
//     member count. Always available; used to discover the guild ID on
//     startup and to enrich the widget snapshot with a member total.
//
// If the widget endpoint 403s (widget disabled), we log once and fall back
// to invite-only snapshots — the card still shows online + member counts.

use std::sync::Arc;
use std::sync::LazyLock;
use std::time::Duration;

use eng_domain::HtmlFragment;
use eng_markup::view;
use reqwest::Client;
use reqwest::StatusCode;
use serde::Deserialize;
use tokio::sync::RwLock;

const WIDGET_REFRESH_INTERVAL: Duration = Duration::from_secs(60);
const STARTUP_RETRY_INTERVAL: Duration = Duration::from_secs(30);
const HTTP_TIMEOUT: Duration = Duration::from_secs(5);
const DISCORD_API: &str = "https://discord.com/api/v10";

// How many avatars we render in the overlapping-circles row. Anything
// beyond this collapses into a "+N more" counter.
const AVATARS_VISIBLE: usize = 10;

#[derive(Clone, Debug)]
pub struct DiscordSnapshot {
    pub guild_name: String,
    pub instant_invite: String,
    pub member_count: Option<u32>,
    pub online_count: u32,
    pub members: Vec<MemberPreview>,
    pub voice_channels: Vec<VoiceChannel>,
}

#[derive(Clone, Debug)]
pub struct MemberPreview {
    pub username: String,
    pub avatar_url: Option<String>,
}

#[derive(Clone, Debug)]
pub struct VoiceChannel {
    pub name: String,
}

static SNAPSHOT: LazyLock<Arc<RwLock<Option<DiscordSnapshot>>>> =
    LazyLock::new(|| Arc::new(RwLock::new(None)));

// reqwest::Client is internally Arc'd over its connection pool, so a
// single shared client is the right shape for the refresh loop.
static HTTP_CLIENT: LazyLock<Client> = LazyLock::new(|| {
    Client::builder()
        .timeout(HTTP_TIMEOUT)
        .user_agent("engmanager.xyz/1.0 (+https://engmanager.xyz)")
        .build()
        .expect("build reqwest client")
});

pub async fn snapshot() -> Option<DiscordSnapshot> {
    SNAPSHOT.read().await.clone()
}

// Spawned at startup. Discovers the guild ID from the invite once, then
// polls the invite plus the optional widget every WIDGET_REFRESH_INTERVAL.
pub async fn refresh_loop(invite_code: &'static str) {
    let fallback_invite_url = format!("https://discord.gg/{invite_code}");

    // Resolve the guild ID. Retry until it works — the rest of the loop
    // depends on it.
    let guild_id = loop {
        match fetch_invite(invite_code).await {
            Ok(invite) => match invite.guild {
                Some(g) => break g.id,
                None => eprintln!("discord: invite {invite_code} returned no guild"),
            },
            Err(e) => eprintln!("discord: invite lookup failed: {e}"),
        }
        tokio::time::sleep(STARTUP_RETRY_INTERVAL).await;
    };

    let mut widget_enabled = true;

    loop {
        let fetch =
            fetch_snapshot(&guild_id, invite_code, &fallback_invite_url, widget_enabled).await;
        if fetch.widget_disabled && widget_enabled {
            eprintln!(
                "discord: server widget is disabled for guild {guild_id}; using invite counts only"
            );
            widget_enabled = false;
        }
        if let Some(snap) = fetch.snapshot {
            *SNAPSHOT.write().await = Some(snap);
        }
        tokio::time::sleep(WIDGET_REFRESH_INTERVAL).await;
    }
}

struct SnapshotFetch {
    snapshot: Option<DiscordSnapshot>,
    widget_disabled: bool,
}

async fn fetch_snapshot(
    guild_id: &str,
    invite_code: &str,
    fallback_invite_url: &str,
    widget_enabled: bool,
) -> SnapshotFetch {
    let widget_fetch = async {
        if widget_enabled {
            fetch_widget(guild_id).await
        } else {
            WidgetFetch::Disabled
        }
    };
    let (widget, invite) = tokio::join!(widget_fetch, fetch_invite(invite_code));

    let widget_disabled = matches!(widget, WidgetFetch::Disabled);
    let widget = match widget {
        WidgetFetch::Available(widget) => Some(widget),
        WidgetFetch::Disabled => None,
        WidgetFetch::Failed(e) => {
            eprintln!("discord: widget fetch failed: {e}");
            None
        }
    };
    let invite = invite
        .map_err(|e| eprintln!("discord: invite fetch failed: {e}"))
        .ok();

    if widget.is_none() && invite.is_none() {
        return SnapshotFetch {
            snapshot: None,
            widget_disabled,
        };
    }

    let guild_name = widget
        .as_ref()
        .map(|w| w.name.clone())
        .or_else(|| {
            invite
                .as_ref()
                .and_then(|i| i.guild.as_ref().map(|g| g.name.clone()))
        })
        .unwrap_or_default();

    let instant_invite = widget
        .as_ref()
        .and_then(|w| w.instant_invite.clone())
        .unwrap_or_else(|| fallback_invite_url.to_string());

    let online_count = widget
        .as_ref()
        .map(|w| w.presence_count)
        .or_else(|| invite.as_ref().and_then(|i| i.approximate_presence_count))
        .unwrap_or(0);

    let member_count = invite.as_ref().and_then(|i| i.approximate_member_count);

    let members = widget
        .as_ref()
        .map(|w| {
            w.members
                .iter()
                .map(|m| MemberPreview {
                    username: m.username.clone(),
                    avatar_url: m.avatar_url.clone(),
                })
                .collect()
        })
        .unwrap_or_default();

    let voice_channels = widget
        .as_ref()
        .map(|w| {
            w.channels
                .iter()
                .map(|c| VoiceChannel {
                    name: c.name.clone(),
                })
                .collect()
        })
        .unwrap_or_default();

    SnapshotFetch {
        snapshot: Some(DiscordSnapshot {
            guild_name,
            instant_invite,
            member_count,
            online_count,
            members,
            voice_channels,
        }),
        widget_disabled,
    }
}

enum WidgetFetch {
    Available(WidgetResponse),
    Disabled,
    Failed(reqwest::Error),
}

async fn fetch_widget(guild_id: &str) -> WidgetFetch {
    let url = format!("{DISCORD_API}/guilds/{guild_id}/widget.json");
    let response = match HTTP_CLIENT.get(url).send().await {
        Ok(response) => response,
        Err(e) => return WidgetFetch::Failed(e),
    };

    if response.status() == StatusCode::FORBIDDEN {
        return WidgetFetch::Disabled;
    }

    let response = match response.error_for_status() {
        Ok(response) => response,
        Err(e) => return WidgetFetch::Failed(e),
    };

    match response.json().await {
        Ok(widget) => WidgetFetch::Available(widget),
        Err(e) => WidgetFetch::Failed(e),
    }
}

async fn fetch_invite(invite_code: &str) -> Result<InviteResponse, reqwest::Error> {
    let url = format!("{DISCORD_API}/invites/{invite_code}?with_counts=true");
    HTTP_CLIENT
        .get(url)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await
}

#[derive(Deserialize)]
struct WidgetResponse {
    name: String,
    instant_invite: Option<String>,
    presence_count: u32,
    #[serde(default)]
    members: Vec<WidgetMember>,
    #[serde(default)]
    channels: Vec<WidgetChannel>,
}

#[derive(Deserialize)]
struct WidgetMember {
    username: String,
    avatar_url: Option<String>,
}

#[derive(Deserialize)]
struct WidgetChannel {
    name: String,
}

#[derive(Deserialize)]
struct InviteResponse {
    guild: Option<InviteGuild>,
    approximate_member_count: Option<u32>,
    approximate_presence_count: Option<u32>,
}

#[derive(Deserialize)]
struct InviteGuild {
    id: String,
    name: String,
}

// Renders the cached snapshot into the Vercel-style card. Caller decides
// what to do when the snapshot is missing (we just return an empty
// fragment; the auteurs article's existing QR/link block stays in place
// as the fallback join path).
pub fn render(snapshot: &DiscordSnapshot) -> HtmlFragment {
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

    view! {
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
    }
}
