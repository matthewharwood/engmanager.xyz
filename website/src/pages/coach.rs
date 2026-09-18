//! `coach.engmanager.xyz` — the 1:1 coaching booking page.
//!
//! Same UI language as the shop (topbar chevron + theme picker, the
//! right-docked bag sheet, the primary CTA), but the "checkout" is a Google
//! Calendar appointment schedule embedded in the sheet: Google owns the live
//! Friday availability and hands payment to the connected Stripe account.
//! After booking, the sheet's second view walks the client through
//! duplicating the Icebreakers intake doc.
//!
//! The hero is a full-bleed speed reader: one word at a time, pinned on its
//! optimal recognition point, looping the headline plus two paragraphs for
//! whichever spectrum stop the visitor picks. Without JS it is just those
//! paragraphs; `@media (scripting: enabled)` shows the reticle before the
//! script boots so there is no flash of paragraphs.
//!
//! JS contract (`js/coach.js`, reads `window.__coach`):
//!   - `[data-reader]` gets `data-reader-mode` (speed | read) and plays the
//!     island's `headline` + persona `paragraphs` through `[data-reader-word]`;
//!     `[data-reader-mode-option]`, `[data-reader-speed]`,
//!     `[data-reader-restart|back|toggle]` are its controls.
//!   - `[data-spectrum-input]` range 0..PERSONAS.len() picks the persona and
//!     restarts the loop; `?role=<id>` deep-links a stop.
//!   - `[data-book-open]` / `?book=calendar|icebreakers` drive
//!     `[data-booking]`'s `data-booking-state` (closed | calendar |
//!     icebreakers) with history entries, exactly like the shop's `?bag=`.
//!   - `[data-booking-frame]` gets its `src` from `data-src` on first open.

use axum::extract::Query;
use axum::response::{Html, IntoResponse, Redirect, Response};
use eng_domain::HtmlFragment;
use eng_markup::view;
use serde_json::json;

use super::shell::{MetaTags, PageShell, json_ld_island};
use crate::asset_url;
use crate::coaching::{
    BOOKING_PAGE, BookingPage, COACH_ORIGIN, DEFAULT_PERSONA_ID, LINKEDIN_RECOMMENDATIONS_URL,
    OFFER, PERSONAS, READER_DEFAULT_WPM, READER_SPEEDS, SessionMode, TESTIMONIALS, Testimonial,
    cta_label, default_persona_index, group_disclaimer, headline, intake_copy_url,
    intake_preview_url, orp_split,
};
use crate::components::quick_actions::theme_picker;
use crate::components::{Head, script_islands};
use crate::content::article_by_slug;
use crate::pages::{SHARE_CARD_SIZE, share_card};

const COACH_DESCRIPTION: &str = "Spend 35 minutes, save a year of searching. A 1:1 resume review and career call for engineers and designers, from hardware to physical design, with Matthew Harwood, Engineering Manager at Uber. Fridays 10am–2pm PT, $100.";
const GROUP_DESCRIPTION: &str = "Bring your friends into the same 35 minutes. A group resume review and career call for engineers and designers with Matthew Harwood, Engineering Manager at Uber. One person books and pays $100 total, then forwards the Google Meet invite. Fridays 10am–2pm PT.";

const SITE_ORIGIN: &str = "https://engmanager.xyz";

/// Intrinsic box of a recommender's headshot, in CSS px. Mirrors
/// `--coach-avatar` in `coach.css`; the files themselves are 192px so the
/// circle stays sharp on a 3x display. Rendered as `width`/`height` so the
/// card reserves the space before the image arrives (no layout shift).
const AVATAR_PX: u16 = 56;

const X_SVG: &str = r##"<svg class="shop-chevron" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path class="shop-chevron-path" d="M5 5 L11 11 M11 5 L5 11" pathLength="1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>"##;
const CHEVRON_SVG: &str = r##"<svg class="shop-chevron" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path class="shop-chevron-path" d="M10.5 3.5 L5.5 8 L10.5 12.5" pathLength="1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>"##;
const RESTART_SVG: &str = r##"<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M4.5 10a5.5 5.5 0 1 0 1.6-3.9M4.5 3.5v2.8h2.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>"##;
const BACK_SVG: &str = r##"<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M9.5 5 4.5 10l5 5M15.5 5l-5 5 5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>"##;
const PAUSE_SVG: &str = r##"<svg class="coach-icon-pause" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M7 4.5v11M13 4.5v11" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>"##;
const PLAY_SVG: &str = r##"<svg class="coach-icon-play" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M6.5 4.5v11l9-5.5z" fill="currentColor" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>"##;

/// Posts worth reading before a session, with a plain-language reason each.
/// Titles and dates come from the article registry.
struct CoachRead {
    slug: &'static str,
    blurb: &'static str,
}

const COACH_READS: [CoachRead; 3] = [
    CoachRead {
        slug: "talking-not-typing",
        blurb: "I build real apps by talking to AI instead of typing. The tools are changing fast, and so is what teams expect from new hires.",
    },
    CoachRead {
        slug: "vibe-coding-a-shop",
        blurb: "One person, some AI, and a real store that takes real money. A good lesson in shipping a whole thing from start to finish.",
    },
    CoachRead {
        slug: "project-foottraffic",
        blurb: "Need a portfolio project that matters? Help the small shops near you look as good as they really are.",
    },
];

/// `?group=1` renders the group framing. It is a real URL, not client-side
/// state, so a shared link posts the group title and the group share card.
#[derive(Debug, Default, serde::Deserialize)]
pub struct CoachQuery {
    group: Option<String>,
}

pub async fn index(Query(query): Query<CoachQuery>) -> Response {
    let mode = SessionMode::from_query(query.group.as_deref());
    Html(page(BOOKING_PAGE.as_ref(), mode)).into_response()
}

/// `engmanager.xyz/coaching` → the subdomain (308, method-preserving).
pub async fn redirect() -> Redirect {
    Redirect::permanent(&format!("{COACH_ORIGIN}/"))
}

pub(crate) fn page(booking: Option<&BookingPage>, mode: SessionMode) -> String {
    // Canonical always points at the 1:1 URL: `?group=1` is the same page with
    // different framing, not a second page to be indexed separately. The OG
    // tags below still describe the variant actually being served, which is
    // what a scraper reads when someone shares the group link.
    let canonical = format!("{COACH_ORIGIN}/");
    let data = script_islands(&[("__coach", &island_json(booking, mode))]);

    let mut assets = Head::new();
    assets.add_css("css/shop.css");
    assets.add_css("css/coach.css");

    let mut scripts = Head::new();
    scripts.add_inline(data);
    scripts.add_js("js/audio.js");
    scripts.add_js("js/coach.js");

    let body = view! {
        <header class="shop-topbar coach-topbar" aria-label="Coaching controls">
            <a class="shop-home-link" href="https://engmanager.xyz/" aria-label="Back to ENGMANAGER.XYZ">
                { HtmlFragment::new(CHEVRON_SVG.to_string()) }
            </a>
            { theme_picker() }
            <div class="shop-top-actions">
                <button class="coach-book-chip"
                        type="button"
                        data-book-open
                        aria-controls="coach-booking"
                        aria-expanded="false">
                    "Book"
                </button>
            </div>
        </header>
        <main id="main" class="coach-main">
            { render_reader(booking, mode) }
            <div class="coach-below">
                { render_testimonials() }
                { render_reads() }
                { render_community() }
            </div>
        </main>
        { render_booking_sheet(booking, mode) }
    };

    let description = if mode.is_group() {
        GROUP_DESCRIPTION.to_string()
    } else {
        COACH_DESCRIPTION.to_string()
    };
    let card_alt = if mode.is_group() {
        format!(
            "Same {} minutes, bring your friends — one booking, {} total, one person pays.",
            OFFER.session_minutes,
            OFFER.price.label()
        )
    } else {
        "Spend 35 minutes, save a year of searching — 1:1 coaching, $100, recommended on LinkedIn by engineers I managed."
            .to_string()
    };

    PageShell::new(mode.page_title(), "shop-page coach-page")
        .meta(MetaTags {
            description: Some(description),
            canonical: Some(canonical.clone()),
            robots: Some("index,follow"),
            og_title: Some(mode.page_title().to_string()),
            og_type: Some("website"),
            og_image: Some(share_card(COACH_ORIGIN, mode.share_card())),
            og_image_alt: Some(card_alt),
            og_image_size: Some(SHARE_CARD_SIZE),
            og_site_name: Some("ENGMANAGER.XYZ"),
            og_url: Some(format!("{COACH_ORIGIN}{}", mode.href())),
            twitter_card: Some("summary_large_image"),
            json_ld: vec![json_ld_island(&service_json_ld())],
            ..MetaTags::default()
        })
        .assets(assets)
        .scripts(scripts)
        .skip_link(Some("Skip to coaching"))
        .render(body)
}

/// The one piece of UI for "who is coming": a two-option segmented control
/// that defaults to 1:1, plus the disclaimer on hover or focus.
///
/// The options are ANCHORS, not buttons. Each is a real URL the server renders
/// in full, so the control works with JS off, the back button behaves, and —
/// the reason it matters here — a shared link carries the mode into the
/// LinkedIn card.
fn render_mode_switch(mode: SessionMode) -> HtmlFragment {
    let options: HtmlFragment = [SessionMode::Solo, SessionMode::Group]
        .iter()
        .map(|option| {
            let current = *option == mode;
            view! {
                <a class="coach-mode-option"
                   href={ option.href() }
                   data-active={ if current { "true" } else { "false" } }
                   aria-current={ if current { "page" } else { "false" } }>
                    { option.label() }
                </a>
            }
        })
        .collect();

    view! {
        <div class="coach-mode" data-mode={ if mode.is_group() { "group" } else { "solo" } }>
            <span class="coach-mode-caption" id="coach-mode-caption">"Who is coming?"</span>
            <div class="coach-mode-options" role="group" aria-labelledby="coach-mode-caption">
                { options }
            </div>
            // Hover reveals it, focus reveals it, and tapping the button
            // focuses it — so touch works without a line of JavaScript.
            <span class="coach-mode-info">
                <button class="coach-mode-info-trigger"
                        type="button"
                        aria-describedby="coach-group-note"
                        aria-label="How group sessions work">
                    "i"
                </button>
                <span class="coach-mode-note" id="coach-group-note" role="tooltip">
                    { group_disclaimer() }
                </span>
            </span>
        </div>
    }
}

fn render_reader(booking: Option<&BookingPage>, mode: SessionMode) -> HtmlFragment {
    let persona = &PERSONAS[default_persona_index()];
    let [problem, help] = persona.paragraphs();
    let title = headline(mode);
    // The reticle shows the loop's first word before the script takes over.
    let first_word = title.split_whitespace().next().unwrap_or_default();
    let (pre, pivot, post) = orp_split(first_word);
    // No-JS visitors follow the CTA straight to Google's booking page; with JS
    // the click is intercepted and opens the booking sheet instead.
    let cta_href = booking
        .map(|page| page.href().to_string())
        .unwrap_or_else(|| {
            if mode.is_group() {
                "/?group=1&book=calendar".to_string()
            } else {
                "/?book=calendar".to_string()
            }
        });
    let speeds: HtmlFragment = READER_SPEEDS
        .iter()
        .map(|wpm| {
            view! {
                <button class="coach-pill"
                        type="button"
                        data-reader-speed={ *wpm }
                        aria-pressed={ if *wpm == READER_DEFAULT_WPM { "true" } else { "false" } }>
                    { wpm.to_string() }
                </button>
            }
        })
        .collect();

    view! {
        <section class="coach-reader" data-reader aria-labelledby="coach-title">
            <div class="coach-reader-stage">
                <p class="coach-kicker coach-reader-kicker">{ mode.kicker() }</p>
                <h1 id="coach-title" class="coach-reader-title">{ title }</h1>
                <div class="coach-rsvp" aria-hidden="true">
                    <span class="coach-rsvp-line"></span>
                    <p class="coach-rsvp-word" data-reader-word>
                        <span class="coach-rsvp-pre" data-reader-pre>{ pre }</span>
                        <span class="coach-rsvp-pivot" data-reader-pivot>{ pivot }</span>
                        <span class="coach-rsvp-post" data-reader-post>{ post }</span>
                    </p>
                    <span class="coach-rsvp-line coach-rsvp-line-end">
                        <span class="coach-rsvp-progress" data-reader-progress></span>
                    </span>
                </div>
                <div class="coach-reader-text" data-reader-text>
                    <p>{ problem }</p>
                    <p>{ help }</p>
                </div>
                <div class="coach-reader-actions">
                    { render_mode_switch(mode) }
                    <a class="shop-cart-checkout coach-cta"
                       href={ cta_href }
                       data-book-open
                       aria-controls="coach-booking">
                        { cta_label(mode) }
                    </a>
                    <p class="coach-reader-meta">
                        { format!("{} · {} · {}", OFFER.duration_label(), OFFER.window_label(), OFFER.meeting) }
                    </p>
                    <p class="coach-local-window" data-local-window hidden></p>
                </div>
            </div>
            <div class="coach-reader-rail" role="group" aria-label="Reader settings">
                <div class="coach-rail-group">
                    <span class="coach-rail-caption" aria-hidden="true">"Mode"</span>
                    <div class="coach-pills" role="group" aria-label="How to read">
                        <button class="coach-pill" type="button" data-reader-mode-option="speed" aria-pressed="true">"Speed"</button>
                        <button class="coach-pill" type="button" data-reader-mode-option="read" aria-pressed="false">"Read"</button>
                    </div>
                </div>
                <div class="coach-rail-group coach-rail-speed">
                    <span class="coach-rail-caption" aria-hidden="true">"WPM"</span>
                    <div class="coach-pills" role="group" aria-label="Words per minute">{ speeds }</div>
                </div>
                <div class="coach-rail-group coach-rail-transport">
                    <span class="coach-rail-caption" aria-hidden="true">"Play"</span>
                    <div class="coach-transport" role="group" aria-label="Playback">
                        <button class="coach-round" type="button" data-reader-restart aria-label="Restart from the beginning">
                            { HtmlFragment::new(RESTART_SVG.to_string()) }
                        </button>
                        <button class="coach-round" type="button" data-reader-back aria-label="Back 5 seconds">
                            { HtmlFragment::new(BACK_SVG.to_string()) }
                        </button>
                        <button class="coach-round coach-round-primary" type="button" data-reader-toggle data-playing="true" aria-label="Pause">
                            { HtmlFragment::new(PAUSE_SVG.to_string()) }
                            { HtmlFragment::new(PLAY_SVG.to_string()) }
                        </button>
                    </div>
                </div>
            </div>
            { render_spectrum() }
        </section>
    }
}

fn render_spectrum() -> HtmlFragment {
    let index = default_persona_index();
    let persona = &PERSONAS[index];
    let last = PERSONAS.len() - 1;
    let pips: HtmlFragment = PERSONAS
        .iter()
        .enumerate()
        .map(|(i, stop)| {
            view! {
                <span class="coach-pip"
                      data-spectrum-stop={ stop.id }
                      data-active={ if i == index { "true" } else { "false" } }
                      style={ format!("--i: {i}") }>
                    <span class="coach-pip-label">{ stop.label }</span>
                </span>
            }
        })
        .collect();

    view! {
        <div class="coach-spectrum" data-spectrum style={ format!("--last: {last}; --value: {index}") }>
            <div class="coach-spectrum-head">
                <label class="coach-kicker" for="coach-spectrum-input">"Where do you live?"</label>
                <span id="coach-spectrum-hint" class="coach-spectrum-hint">"Drag to change the story"</span>
                <span class="coach-spectrum-current" data-spectrum-current aria-hidden="true">{ persona.label }</span>
            </div>
            <div class="coach-spectrum-track">
                <span class="coach-spectrum-rule" aria-hidden="true"></span>
                <input id="coach-spectrum-input"
                       class="coach-spectrum-input"
                       type="range"
                       min="0"
                       max={ last }
                       step="1"
                       value={ index }
                       aria-describedby="coach-spectrum-hint"
                       aria-valuetext={ persona.audience }
                       data-spectrum-input />
                <div class="coach-spectrum-pips" aria-hidden="true">{ pips }</div>
            </div>
        </div>
    }
}

fn render_testimonials() -> HtmlFragment {
    let cards: HtmlFragment = TESTIMONIALS.iter().map(render_testimonial).collect();

    view! {
        <section class="coach-proof" aria-labelledby="coach-proof-title">
            <p class="coach-kicker">"Proof · LinkedIn recommendations"</p>
            <h2 id="coach-proof-title" class="coach-h2">"Don’t take it from me."</h2>
            <p class="coach-sub">"Two engineers who reported to me wrote these on LinkedIn, under their own names, on their own profiles. Quoted in full, nothing trimmed — click through and check."</p>
            <ul class="coach-proof-list">{ cards }</ul>
        </section>
    }
}

/// One recommendation card: my one-line takeaway as the heading, then the
/// quote verbatim, then who said it and how to check.
fn render_testimonial(person: &'static Testimonial) -> HtmlFragment {
    // The monogram is always in the markup, UNDER the photo. If the image
    // ever fails to load, the reader sees initials rather than a broken-image
    // icon — no JS, no `onerror`. The photo itself is a self-hosted,
    // content-addressed asset, never a hotlinked `media.licdn.com` URL
    // (those are signed and expire).
    let photo = match person.photo {
        Some(path) => view! {
            <img class="coach-proof-photo"
                 src={ asset_url(path) }
                 alt=""
                 width={ AVATAR_PX }
                 height={ AVATAR_PX }
                 loading="lazy"
                 decoding="async" />
        },
        None => HtmlFragment::empty(),
    };
    // Decorative: the name sits right next to it, so AT gets nothing useful
    // from the picture.
    let avatar = view! {
        <span class="coach-proof-avatar" aria-hidden="true">
            <span class="coach-proof-monogram">{ person.initials }</span>
            { photo }
        </span>
    };
    let paragraphs: HtmlFragment = person
        .quote
        .iter()
        .map(|paragraph| view! { <p>{ *paragraph }</p> })
        .collect();

    view! {
        <li class="coach-proof-card" id={ format!("proof-{}", person.id) }>
            <h3 class="coach-proof-takeaway">{ person.takeaway }</h3>
            <figure class="coach-proof-figure">
                <blockquote class="coach-proof-quote" cite={ LINKEDIN_RECOMMENDATIONS_URL }>
                    { paragraphs }
                </blockquote>
                <figcaption class="coach-proof-who">
                    { avatar }
                    <span class="coach-proof-id">
                        <a class="coach-proof-name"
                           href={ person.profile_url }
                           target="_blank"
                           rel="noopener">
                            { person.name }
                        </a>
                        <span class="coach-proof-headline">{ person.headline }</span>
                        <span class="coach-proof-school">{ person.school }</span>
                    </span>
                </figcaption>
            </figure>
            <p class="coach-proof-meta">
                { person.relationship }
                " · "
                <time datetime={ person.date_iso }>{ person.date_label }</time>
            </p>
            <a class="coach-text-link coach-proof-link"
               href={ LINKEDIN_RECOMMENDATIONS_URL }
               target="_blank"
               rel="noopener">
                { format!("Read {}’s recommendation on LinkedIn ↗", person.first_name()) }
            </a>
        </li>
    }
}

fn render_reads() -> HtmlFragment {
    let cards: HtmlFragment = COACH_READS
        .iter()
        .filter_map(|read| article_by_slug(read.slug).map(|article| (article, read.blurb)))
        .map(|(article, blurb)| {
            view! {
                <li>
                    <a class="coach-read-card" href={ format!("{SITE_ORIGIN}/articles/{}", article.slug) }>
                        <time class="coach-read-date" datetime={ article.date.iso() }>{ article.date.label() }</time>
                        <h3 class="coach-read-title">{ article.title }</h3>
                        <p class="coach-read-blurb">{ blurb }</p>
                        <span class="coach-read-more" aria-hidden="true">"Read the post →"</span>
                    </a>
                </li>
            }
        })
        .collect();

    view! {
        <section class="coach-reads" aria-labelledby="coach-reads-title">
            <p class="coach-kicker">"Free reading"</p>
            <h2 id="coach-reads-title" class="coach-h2">"Start here, for free."</h2>
            <ul class="coach-read-list">{ cards }</ul>
        </section>
    }
}

fn render_community() -> HtmlFragment {
    let invite = format!("https://discord.gg/{}", crate::AUTEURS_INVITE_CODE);
    view! {
        <section class="coach-community" aria-labelledby="coach-community-title">
            <div class="coach-community-copy">
                <p class="coach-kicker">"Auteurs · free Discord"</p>
                <h2 id="coach-community-title" class="coach-h2">"Don’t job hunt alone."</h2>
                <p class="coach-sub">"Auteurs is my Discord group for engineers, designers, and product people. We share what we are building, trade feedback, and keep each other going. It is free, and you can join today."</p>
            </div>
            <div class="coach-community-actions">
                <a class="coach-secondary-cta" href={ invite } target="_blank" rel="noopener">"Join the Discord"</a>
                <a class="coach-text-link" href={ format!("{SITE_ORIGIN}/articles/auteurs") }>"What is Auteurs?"</a>
            </div>
        </section>
    }
}

fn render_calendar(booking: Option<&BookingPage>) -> HtmlFragment {
    let Some(booking) = booking else {
        return view! {
            <div class="shop-checkout-notice coach-notice" data-booking-unavailable>
                <p>"The booking calendar is being connected. Friday slots open here shortly."</p>
            </div>
        };
    };
    let external = view! {
        <a class="coach-text-link coach-external"
           href={ booking.href() }
           target="_blank"
           rel="noopener"
           data-booking-external>
            "Open the booking page in a new tab ↗"
        </a>
    };
    match booking.embed_src() {
        Some(src) => view! {
            <div class="coach-calendar" data-booking-calendar>
                <iframe class="coach-calendar-frame"
                        title="Google Calendar booking page for 1:1 coaching"
                        data-booking-frame
                        data-src={ src }
                        referrerpolicy="strict-origin-when-cross-origin"></iframe>
            </div>
            { external }
        },
        None => view! {
            <div class="coach-calendar coach-calendar-link" data-booking-calendar>
                <p>"Friday slots live on my Google Calendar booking page."</p>
                { external }
            </div>
        },
    }
}

fn render_booking_sheet(booking: Option<&BookingPage>, mode: SessionMode) -> HtmlFragment {
    view! {
        <aside id="coach-booking"
               class="shop-bag coach-booking"
               data-booking
               data-booking-state="closed"
               role="dialog"
               aria-modal="true"
               aria-labelledby="coach-booking-title"
               aria-hidden="true"
               hidden>
            <div class="shop-bag-scrim" data-booking-scrim></div>
            // Always light: Google's booking embed has no dark theme, so the
            // sheet matches it instead of framing a white page in dark chrome.
            <div class="shop-bag-sheet coach-booking-sheet" data-theme="light">
                <section class="coach-booking-pane">
                    <header class="shop-cart-head">
                        <h2 id="coach-booking-title">"Book a session"</h2>
                        <button class="shop-icon-button" type="button" data-booking-close aria-label="Close booking">
                            { HtmlFragment::new(X_SVG.to_string()) }
                        </button>
                    </header>
                    <ol class="coach-progress" aria-label="Booking steps">
                        <li data-progress-step="calendar">"1 · Pick a Friday"</li>
                        <li data-progress-step="calendar">{ format!("2 · Pay {}", OFFER.price.label()) }</li>
                        <li data-progress-step="icebreakers">"3 · Icebreakers"</li>
                    </ol>
                    <div class="coach-booking-view" data-booking-view="calendar">
                        { if mode.is_group() {
                            view! {
                                <p class="coach-group-note" data-group-note>
                                    <strong>"Booking for a group."</strong>
                                    " "
                                    { group_disclaimer() }
                                </p>
                            }
                        } else {
                            HtmlFragment::empty()
                        } }
                        { render_calendar(booking) }
                        <footer class="coach-booking-foot">
                            <p class="shop-checkout-hint">"Payment runs on Google’s booking page through Stripe. Your confirmation email has the Meet link."</p>
                            <button class="shop-cart-checkout" type="button" data-booking-next>"I booked · Next step"</button>
                        </footer>
                    </div>
                    <div class="coach-booking-view coach-icebreakers" data-booking-view="icebreakers" hidden>
                        <div class="shop-bag-stamp coach-stamp" data-booking-stamp aria-hidden="true">"BOOKED"</div>
                        <p class="coach-kicker">"LAST STEP · BEFORE WE MEET"</p>
                        <h3 class="coach-h3">"Send your resume and Icebreakers doc"</h3>
                        <ol class="coach-intake-steps">
                            <li>"Open the template and click “Make a copy”."</li>
                            <li>"Fill it out, and paste in a link to your resume."</li>
                            <li>"Reply to your booking confirmation email with your copy."</li>
                            { if mode.is_group() {
                                view! { <li>"Everyone joining sends their own copy, and you forward them the Meet invite."</li> }
                            } else {
                                HtmlFragment::empty()
                            } }
                        </ol>
                        <p class="coach-recap" data-spectrum-recap>"Tell me where you live on the spectrum, and why."</p>
                        <a class="shop-cart-checkout"
                           href={ intake_copy_url() }
                           target="_blank"
                           rel="noopener"
                           data-intake-copy>
                            "Make my copy"
                        </a>
                        <div class="coach-icebreakers-links">
                            <a class="coach-text-link" href={ intake_preview_url() } target="_blank" rel="noopener">"Preview the template"</a>
                            <button class="coach-text-button" type="button" data-booking-back>"Back to the calendar"</button>
                        </div>
                    </div>
                </section>
            </div>
        </aside>
    }
}

/// The `window.__coach` island: the speed reader's headline, speeds, and the
/// persona table (so the slider and the server share one source of truth),
/// the weekly window for the local-time hint, and whether/where the booking
/// calendar lives.
fn island_json(booking: Option<&BookingPage>, mode: SessionMode) -> String {
    let personas = PERSONAS
        .iter()
        .map(|persona| {
            json!({
                "id": persona.id,
                "label": persona.label,
                "audience": persona.audience,
                "paragraphs": persona.paragraphs(),
            })
        })
        .collect::<Vec<_>>();
    json!({
        "headline": headline(mode),
        "mode": if mode.is_group() { "group" } else { "solo" },
        "personas": personas,
        "defaultPersona": DEFAULT_PERSONA_ID,
        "reader": {
            "speeds": READER_SPEEDS,
            "defaultWpm": READER_DEFAULT_WPM,
        },
        "offer": {
            "weekday": 5,
            "timeZone": OFFER.time_zone,
            "timeZoneLabel": OFFER.time_zone_label,
            "start": OFFER.window_start.hhmm(),
            "end": OFFER.window_end.hhmm(),
            "minutes": OFFER.session_minutes,
            "priceLabel": OFFER.price.label(),
        },
        "booking": booking.map(|page| json!({
            "href": page.href(),
            "embed": page.embed_src(),
        })),
        "intakeCopyUrl": intake_copy_url(),
    })
    .to_string()
}

/// The two LinkedIn recommendations as schema.org `Review`s on the service.
///
/// Deliberately NO `reviewRating`: a LinkedIn recommendation carries no stars,
/// and inventing a 5/5 would be fabricating data the recommender never gave.
/// That also means Google will not render these as review rich results (its
/// policy excludes self-serving reviews about your own business anyway) — the
/// markup is here so machines read the page the way a person does.
fn review_json_ld() -> Vec<serde_json::Value> {
    TESTIMONIALS
        .iter()
        .map(|person| {
            json!({
                "@type": "Review",
                "datePublished": person.date_iso,
                "reviewBody": person.quote.join("\n\n"),
                "author": {
                    "@type": "Person",
                    "name": person.name,
                    "jobTitle": person.headline,
                    // `sameAs` + `alumniOf` are what let a machine resolve
                    // the author to a real person rather than a first name.
                    "sameAs": person.profile_url,
                    "alumniOf": {
                        "@type": "CollegeOrUniversity",
                        "name": person.school_name,
                    },
                    "image": person.photo.map(|path| format!("{COACH_ORIGIN}{}", asset_url(path))),
                },
                "itemReviewed": {
                    "@type": "Person",
                    "name": "Matthew Harwood",
                },
                "publisher": {
                    "@type": "Organization",
                    "name": "LinkedIn",
                    "url": LINKEDIN_RECOMMENDATIONS_URL,
                },
            })
        })
        .collect()
}

fn service_json_ld() -> String {
    json!({
        "@context": "https://schema.org",
        "@type": "Service",
        "name": OFFER.name,
        "serviceType": "Career coaching and resume review",
        "url": format!("{COACH_ORIGIN}/"),
        "description": COACH_DESCRIPTION,
        "audience": {
            "@type": "Audience",
            "audienceType": "Engineers and designers, from hardware to physical design",
        },
        "provider": {
            "@type": "Person",
            "name": "Matthew Harwood",
            "jobTitle": "Engineering Manager",
            "sameAs": ["https://www.linkedin.com/in/matthewcharwood/", "https://engmanager.xyz/"],
        },
        "offers": {
            "@type": "Offer",
            "price": OFFER.price_decimal(),
            "priceCurrency": "USD",
            "availability": "https://schema.org/InStock",
        },
        "review": review_json_ld(),
    })
    .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn booking() -> BookingPage {
        BookingPage::parse(
            "https://calendar.google.com/calendar/appointments/schedules/AcZssZTest123",
        )
        .expect("test booking URL parses")
    }

    #[test]
    fn coach_page_renders_reader_spectrum_reads_and_intake_step() {
        let html = page(Some(&booking()), SessionMode::Solo);

        assert!(html.contains("<title>1:1 Coaching · ENGMANAGER.XYZ</title>"));
        assert!(html.contains(r#"<link rel="canonical" href="https://coach.engmanager.xyz/">"#));
        assert!(html.contains(r#"<meta name="robots" content="index,follow">"#));
        assert!(html.contains(r#"<body class="shop-page coach-page">"#));
        // Same UI system as the shop: its stylesheet, the theme picker, the bag sheet.
        assert!(html.contains("/assets/css/shop."));
        assert!(html.contains("/assets/css/coach."));
        assert!(html.contains("/assets/js/coach."));
        assert!(html.contains("data-theme-cycle"));
        assert!(html.contains(r#"class="shop-bag coach-booking""#));
        // The booking sheet is pinned light to match Google's embed.
        assert!(html.contains(r#"class="shop-bag-sheet coach-booking-sheet" data-theme="light""#));
        // Offer terms.
        assert!(html.contains("35 min"));
        assert!(html.contains("$100"));
        assert!(html.contains("Fridays · 10am–2pm PT"));
        assert!(html.contains("Book 35 minutes · $100"));
        // Speed reader: headline, the reticle pre-filled with the first word
        // split on its pivot letter, the default stop's paragraphs, controls.
        assert!(html.contains("Spend 35 minutes. Save a year of searching."));
        assert!(html.contains(r#"data-reader-pre>S</span>"#));
        assert!(html.contains(r#"data-reader-pivot>p</span>"#));
        assert!(html.contains(r#"data-reader-post>end</span>"#));
        let [problem, _] = PERSONAS[default_persona_index()].paragraphs();
        assert!(html.contains(&problem));
        for control in [
            r#"data-reader-mode-option="speed""#,
            r#"data-reader-mode-option="read""#,
            r#"data-reader-speed="400" aria-pressed="true""#,
            r#"data-reader-speed="200" aria-pressed="false""#,
            "data-reader-restart",
            "data-reader-back",
            "data-reader-toggle",
        ] {
            assert!(html.contains(control), "missing {control}");
        }
        // Spectrum: a stepped slider over every stop, starting on the default.
        assert!(html.contains(r#"type="range""#));
        assert!(html.contains(r#"max="6""#));
        assert!(html.contains(r#"value="3""#));
        for persona in PERSONAS {
            assert!(html.contains(&format!(r#"data-spectrum-stop="{}""#, persona.id)));
        }
        assert!(html.contains(r#"data-spectrum-stop="design-engineer" data-active="true""#));
        // Below the fold: three posts and the Auteurs Discord.
        for read in &COACH_READS {
            assert!(html.contains(&format!(
                r#"href="https://engmanager.xyz/articles/{}""#,
                read.slug
            )));
        }
        // Social proof: both recommendations, quoted whole, each attributable.
        for person in TESTIMONIALS {
            assert!(html.contains(person.name), "missing {}", person.name);
            assert!(
                html.contains(person.school),
                "missing {}'s school",
                person.name
            );
            assert!(
                html.contains(&format!(r#"href="{}" target="_blank""#, person.profile_url)),
                "{} is not linked to their profile",
                person.name
            );
            for paragraph in person.quote {
                assert!(html.contains(paragraph), "{} is quoted short", person.name);
            }
        }
        assert!(html.contains(LINKEDIN_RECOMMENDATIONS_URL));
        assert!(html.contains("Read Edison’s recommendation on LinkedIn ↗"));
        // Nothing points at LinkedIn's expiring image CDN.
        assert!(!html.contains("licdn.com"));
        assert!(html.contains(r#"href="https://discord.gg/sTzQBrbnBM""#));
        assert!(html.contains(r#"href="https://engmanager.xyz/articles/auteurs""#));
        // Booking embed is lazy (data-src, no src) and has a new-tab fallback.
        assert!(html.contains(
            r#"data-src="https://calendar.google.com/calendar/appointments/schedules/AcZssZTest123?gv=true""#
        ));
        assert!(!html.contains(r#"<iframe class="coach-calendar-frame" src="#));
        assert!(html.contains(
            r#"href="https://calendar.google.com/calendar/appointments/schedules/AcZssZTest123" target="_blank""#
        ));
        assert!(!html.contains("data-booking-unavailable"));
        // Icebreakers: the /copy link, and the resume ask.
        assert!(html.contains(&intake_copy_url()));
        assert!(html.contains("link to your resume"));
        // Structured data prices the offer.
        assert!(html.contains(r#""price":"100.00""#));
        assert!(html.contains(r#""priceCurrency":"USD""#));
        assert!(!html.contains("<style>"));
    }

    /// Every headshot must resolve to a real embedded asset. `asset_url`
    /// falls back to the FLAT `/assets/{path}` when the file isn't embedded,
    /// so a hashed URL is proof the bytes shipped — this is what stops a
    /// typo'd path from going live as a broken image.
    #[test]
    fn every_headshot_is_a_real_embedded_asset() {
        for person in TESTIMONIALS {
            let Some(path) = person.photo else { continue };
            let url = asset_url(path);
            assert_ne!(
                url,
                format!("/assets/{path}"),
                "{} points at {path}, which is not in website/assets/",
                person.name
            );
            assert!(
                url.ends_with(".webp"),
                "{}'s headshot should be webp, got {url}",
                person.name
            );
        }
    }

    #[test]
    fn headshots_render_with_reserved_space_and_a_monogram_underneath() {
        let html = page(Some(&booking()), SessionMode::Solo);
        for person in TESTIMONIALS {
            // The monogram ships even when there is a photo: it is the
            // fallback the reader sees if the image never arrives.
            assert!(
                html.contains(&format!(
                    r#"<span class="coach-proof-monogram">{}</span>"#,
                    person.initials
                )),
                "{} has no monogram underneath their photo",
                person.name
            );
            let Some(path) = person.photo else { continue };
            assert!(html.contains(&asset_url(path)));
        }
        // Explicit box on every headshot, so the card never reflows when the
        // image lands.
        assert_eq!(
            html.matches(r#"width="56" height="56" loading="lazy" decoding="async""#)
                .count(),
            TESTIMONIALS.iter().filter(|p| p.photo.is_some()).count()
        );
        // Decorative: the name is right beside it, so the img carries no alt
        // text and the wrapper is hidden from assistive tech.
        assert!(html.contains(r#"<span class="coach-proof-avatar" aria-hidden="true">"#));
    }

    #[test]
    fn reviews_are_marked_up_without_inventing_a_rating() {
        let reviews = review_json_ld();
        assert_eq!(reviews.len(), TESTIMONIALS.len());
        for (review, person) in reviews.iter().zip(TESTIMONIALS) {
            assert_eq!(review["author"]["name"], person.name);
            assert_eq!(review["author"]["sameAs"], person.profile_url);
            assert_eq!(review["datePublished"], person.date_iso);
            assert!(
                review.get("reviewRating").is_none(),
                "a LinkedIn recommendation has no stars — don't invent one"
            );
            assert!(
                review["reviewBody"]
                    .as_str()
                    .is_some_and(|body| body.contains(person.quote[0]))
            );
            // Entity signals: the school as a resolvable org, and an
            // ABSOLUTE image URL (a relative one is useless to a crawler).
            assert_eq!(review["author"]["alumniOf"]["name"], person.school_name);
            let image = review["author"]["image"].as_str().unwrap_or_default();
            assert!(
                image.starts_with("https://coach.engmanager.xyz/assets/"),
                "{}'s review image must be absolute, got {image}",
                person.name
            );
        }
    }

    #[test]
    fn the_page_defaults_to_one_on_one() {
        // A visitor who touches nothing must get 1:1 — in the copy, the CTA,
        // the title and the share card.
        let html = page(Some(&booking()), SessionMode::Solo);
        assert!(html.contains("Spend 35 minutes. Save a year of searching."));
        assert!(html.contains("Book 35 minutes · $100"));
        assert!(html.contains("<title>1:1 Coaching · ENGMANAGER.XYZ</title>"));
        assert!(html.contains("/assets/og/coach."));
        assert!(!html.contains("/assets/og/coach-group."));
        assert!(html.contains(r#"<div class="coach-mode" data-mode="solo">"#));
        assert!(html.contains(r#"href="/" data-active="true""#));
        // No group-only copy leaks into the default page.
        assert!(!html.contains("Booking for a group."));
        assert!(!html.contains("Everyone joining sends their own copy"));

        assert_eq!(SessionMode::default(), SessionMode::Solo);
        for query in [None, Some(""), Some("0"), Some("no"), Some("groupon")] {
            assert_eq!(
                SessionMode::from_query(query),
                SessionMode::Solo,
                "{query:?}"
            );
        }
        assert_eq!(SessionMode::from_query(Some("1")), SessionMode::Group);
    }

    #[test]
    fn group_mode_changes_the_verbiage_the_title_and_the_share_card() {
        let html = page(Some(&booking()), SessionMode::Group);

        // Headline, kicker and CTA all switch.
        assert!(html.contains("Same 35 minutes. Bring your friends."));
        assert!(html.contains("Group coaching · Matthew Harwood"));
        assert!(html.contains("Book for your group · $100 total"));
        assert!(!html.contains("Book 35 minutes · $100"));

        // What a shared link posts: group title, group description, group card.
        assert!(html.contains("<title>Group Coaching · ENGMANAGER.XYZ</title>"));
        assert!(
            html.contains(
                r#"<meta property="og:title" content="Group Coaching · ENGMANAGER.XYZ">"#
            )
        );
        assert!(html.contains("/assets/og/coach-group."));
        assert!(html.contains(
            r#"<meta property="og:url" content="https://coach.engmanager.xyz/?group=1">"#
        ));
        assert!(html.contains("One person books and pays $100 total"));

        // Canonical still points at the 1:1 URL — this is one page with two
        // framings, not two pages to be indexed.
        assert!(html.contains(r#"<link rel="canonical" href="https://coach.engmanager.xyz/">"#));

        // The switch reflects the state, and the sheet carries the disclaimer
        // where the money actually changes hands.
        assert!(html.contains(r#"<div class="coach-mode" data-mode="group">"#));
        assert!(html.contains(r#"href="/?group=1" data-active="true""#));
        assert!(html.contains("Booking for a group."));
        assert!(html.contains("Everyone joining sends their own copy"));
    }

    #[test]
    fn the_disclaimer_never_promises_a_split_payment() {
        let note = group_disclaimer();
        // The whole point of the note: one payer, no split, forwarded invite.
        assert!(note.contains("there is no split payment"));
        assert!(note.contains("One person books and pays"));
        assert!(note.contains("Forward the Google Meet invite"));

        // It is reachable without JavaScript, from both the hover tooltip and
        // the booking sheet.
        let html = page(Some(&booking()), SessionMode::Group);
        assert_eq!(html.matches(&note).count(), 2);
        assert!(
            html.contains(r#"<span class="coach-mode-note" id="coach-group-note" role="tooltip">"#)
        );
        assert!(html.contains(r#"aria-describedby="coach-group-note""#));
        assert!(!html.contains("<style>"));
    }

    #[test]
    fn the_switch_is_links_so_it_works_without_javascript() {
        // Anchors, not buttons: the mode survives a share, the back button
        // behaves, and the page works with scripting off.
        for mode in [SessionMode::Solo, SessionMode::Group] {
            let html = page(Some(&booking()), mode);
            assert!(html.contains(r#"<a class="coach-mode-option" href="/""#));
            assert!(html.contains(r#"<a class="coach-mode-option" href="/?group=1""#));
        }
        // With no booking page configured the CTA is a plain link, and it has
        // to carry the mode with it.
        assert!(page(None, SessionMode::Group).contains(r#"href="/?group=1&amp;book=calendar""#));
        assert!(page(None, SessionMode::Solo).contains(r#"href="/?book=calendar""#));
    }

    #[test]
    fn coach_reads_are_published_articles() {
        for read in &COACH_READS {
            let article = article_by_slug(read.slug)
                .unwrap_or_else(|| panic!("{} is not in the article registry", read.slug));
            assert!(article.indexed, "{} is not published", read.slug);
        }
    }

    #[test]
    fn coach_page_without_a_booking_page_shows_the_notice_and_no_frame() {
        let html = page(None, SessionMode::Solo);
        assert!(html.contains("data-booking-unavailable"));
        assert!(!html.contains("data-booking-frame"));
        assert!(!html.contains("calendar.google.com/calendar/appointments"));
        assert!(html.contains(r#"href="/?book=calendar""#));
        assert!(html.contains(r#""booking":null"#));
    }

    #[test]
    fn short_links_render_as_a_link_not_a_frame() {
        let short = BookingPage::parse("https://calendar.app.google/abc123").expect("short link");
        let html = page(Some(&short), SessionMode::Solo);
        assert!(!html.contains("data-booking-frame"));
        assert!(html.contains(r#"href="https://calendar.app.google/abc123""#));
    }

    #[test]
    fn island_carries_the_reader_personas_and_window() {
        let island: serde_json::Value =
            serde_json::from_str(&island_json(Some(&booking()), SessionMode::Solo))
                .expect("island is JSON");
        assert_eq!(
            island["personas"].as_array().map(Vec::len),
            Some(PERSONAS.len())
        );
        assert_eq!(
            island["personas"][1]["paragraphs"].as_array().map(Vec::len),
            Some(2)
        );
        assert_eq!(island["defaultPersona"], "design-engineer");
        assert_eq!(
            island["headline"],
            "Spend 35 minutes. Save a year of searching."
        );
        assert_eq!(island["reader"]["defaultWpm"], 400);
        assert_eq!(island["reader"]["speeds"], json!([200, 300, 400]));
        assert_eq!(island["offer"]["start"], "10:00");
        assert_eq!(island["offer"]["end"], "14:00");
        assert_eq!(island["offer"]["weekday"], 5);
        assert_eq!(island["offer"]["timeZone"], "America/Los_Angeles");
        assert_eq!(
            island["booking"]["embed"],
            "https://calendar.google.com/calendar/appointments/schedules/AcZssZTest123?gv=true"
        );
    }
}
