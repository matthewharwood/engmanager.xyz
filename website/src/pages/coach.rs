//! `coach.engmanager.xyz` — the 1:1 coaching booking page.
//!
//! Same UI language as the shop (topbar chevron + theme picker, the
//! right-docked bag sheet, the pink CTA), but the "checkout" is a Google
//! Calendar appointment schedule embedded in the sheet: Google owns the live
//! Friday availability and hands payment to the connected Stripe account.
//! After booking, the sheet's second view walks the client through
//! duplicating the Icebreakers intake doc.
//!
//! JS contract (`js/coach.js`, reads `window.__coach`):
//!   - `[data-spectrum-input]` range 0..=100 → swaps `[data-persona-*]` copy
//!     from the island's persona table; `?at=NN` deep-links a position.
//!   - `[data-book-open]` / `?book=calendar|icebreakers` drive
//!     `[data-booking]`'s `data-booking-state` (closed | calendar |
//!     icebreakers) with history entries, exactly like the shop's `?bag=`.
//!   - `[data-booking-frame]` gets its `src` from `data-src` on first open.

use axum::response::{Html, IntoResponse, Redirect, Response};
use eng_domain::HtmlFragment;
use eng_markup::view;
use serde_json::json;

use super::shell::{MetaTags, PageShell, json_ld_island};
use super::{AVATAR_SRC, avatar_srcset};
use crate::coaching::{
    BOOKING_PAGE, BookingPage, COACH_ORIGIN, DEFAULT_SPECTRUM, OFFER, PERSONAS, Persona,
    intake_copy_url, intake_preview_url, persona_for,
};
use crate::components::quick_actions::theme_picker;
use crate::components::{Head, script_islands};

const COACH_TITLE: &str = "1:1 Coaching · ENGMANAGER.XYZ";
const COACH_DESCRIPTION: &str = "35-minute 1:1 coaching for early-career engineers, designers, and design engineers with Matthew Harwood, Engineering Manager at Uber. Fridays 10am–2pm PT, $100.";

const X_SVG: &str = r##"<svg class="shop-chevron" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path class="shop-chevron-path" d="M5 5 L11 11 M11 5 L5 11" pathLength="1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>"##;
const CHEVRON_SVG: &str = r##"<svg class="shop-chevron" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path class="shop-chevron-path" d="M10.5 3.5 L5.5 8 L10.5 12.5" pathLength="1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>"##;

pub async fn index() -> Response {
    Html(page(BOOKING_PAGE.as_ref())).into_response()
}

/// `engmanager.xyz/coaching` → the subdomain (308, method-preserving).
pub async fn redirect() -> Redirect {
    Redirect::permanent(&format!("{COACH_ORIGIN}/"))
}

pub(crate) fn page(booking: Option<&BookingPage>) -> String {
    let canonical = format!("{COACH_ORIGIN}/");
    let data = script_islands(&[("__coach", &island_json(booking))]);

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
        <main id="main" class="coach-shell">
            { render_hero(booking) }
            { render_spectrum() }
            { render_about() }
            { render_steps() }
        </main>
        { render_booking_sheet(booking) }
    };

    PageShell::new(COACH_TITLE, "shop-page coach-page")
        .meta(MetaTags {
            description: Some(COACH_DESCRIPTION.to_string()),
            canonical: Some(canonical.clone()),
            robots: Some("index,follow"),
            og_title: Some(COACH_TITLE.to_string()),
            og_type: Some("website"),
            og_url: Some(canonical),
            twitter_card: Some("summary"),
            json_ld: vec![json_ld_island(&service_json_ld())],
            ..MetaTags::default()
        })
        .assets(assets)
        .scripts(scripts)
        .skip_link(Some("Skip to coaching"))
        .render(body)
}

fn render_hero(booking: Option<&BookingPage>) -> HtmlFragment {
    let slots = OFFER
        .slot_starts()
        .iter()
        .map(|slot| slot.label())
        .collect::<Vec<_>>()
        .join(" · ");
    // No-JS visitors follow the CTA straight to Google's booking page; with JS
    // the click is intercepted and opens the booking sheet instead.
    let cta_href = booking
        .map(|page| page.href().to_string())
        .unwrap_or_else(|| "/?book=calendar".to_string());

    view! {
        <section class="coach-hero" aria-labelledby="coach-title">
            <div class="coach-hero-copy">
                <p class="coach-kicker">"1:1 COACHING · FRIDAYS · 35 MIN"</p>
                <h1 id="coach-title" class="coach-title">"Grow your craft with a manager who still ships."</h1>
                <p class="coach-lede">
                    "I’m Matthew Harwood, an Engineering Manager at Uber, where my teams run Uber.com and the authoring tools Uber publishes with. For 12 years I’ve shipped web platforms — at R/GA and AKQA for Google, Apple, and Target, then at Uber. These sessions are for engineers, designers, and design engineers early in their careers who want a straight answer from someone who hires, manages, and still writes code."
                </p>
            </div>
            <aside class="coach-ticket" aria-label="Session details">
                <div class="coach-ticket-head">
                    <img class="coach-avatar"
                         src=AVATAR_SRC
                         srcset={ avatar_srcset(&[96, 192]) }
                         sizes="3rem"
                         alt="Matthew Harwood"
                         width="96"
                         height="96"
                         decoding="async" />
                    <div>
                        <p class="coach-ticket-name">"Matthew Harwood"</p>
                        <p class="coach-ticket-role">"Engineering Manager @ Uber"</p>
                    </div>
                </div>
                <dl class="coach-specs">
                    <div>
                        <dt>"Session"</dt>
                        <dd data-offer-duration>{ OFFER.duration_label() }</dd>
                    </div>
                    <div>
                        <dt>"Price"</dt>
                        <dd data-offer-price>{ OFFER.price.label() }</dd>
                    </div>
                    <div>
                        <dt>"When"</dt>
                        <dd data-offer-window>{ OFFER.window_label() }</dd>
                    </div>
                    <div>
                        <dt>"Starts"</dt>
                        <dd>{ slots }</dd>
                    </div>
                    <div>
                        <dt>"Where"</dt>
                        <dd>{ OFFER.meeting }</dd>
                    </div>
                </dl>
                <p class="coach-local-window" data-local-window hidden></p>
                <a class="shop-cart-checkout coach-cta"
                   href={ cta_href }
                   data-book-open
                   aria-controls="coach-booking">
                    { format!("Book a Friday · {}", OFFER.price.label()) }
                </a>
                <p class="shop-checkout-hint coach-ticket-hint">"Pick a slot on Google Calendar, pay securely with Stripe."</p>
            </aside>
        </section>
    }
}

fn render_spectrum() -> HtmlFragment {
    let persona = persona_for(DEFAULT_SPECTRUM);
    let stops: HtmlFragment = PERSONAS
        .iter()
        .map(|stop| view! { <span data-spectrum-stop={ stop.id }>{ stop.label }</span> })
        .collect();

    view! {
        <section class="coach-spectrum" aria-labelledby="coach-spectrum-title">
            <p class="coach-kicker">"WHO IT’S FOR"</p>
            <h2 id="coach-spectrum-title" class="coach-h2">"Where do you live on the spectrum?"</h2>
            <p class="coach-sub">"Drag to place yourself between engineering and design. We’ll aim the session at your end of it."</p>
            <div class="coach-slider" style={ format!("--spectrum: {DEFAULT_SPECTRUM}%") } data-spectrum>
                <label class="sr-only" for="coach-spectrum-input">"Where you are between engineer and designer"</label>
                <input id="coach-spectrum-input"
                       class="coach-slider-input"
                       type="range"
                       min="0"
                       max="100"
                       step="1"
                       value={ DEFAULT_SPECTRUM }
                       aria-valuetext={ persona.label }
                       data-spectrum-input />
                <div class="coach-slider-stops" aria-hidden="true">{ stops }</div>
            </div>
            { render_persona(persona) }
        </section>
    }
}

fn render_persona(persona: &Persona) -> HtmlFragment {
    let focus: HtmlFragment = persona
        .focus
        .iter()
        .map(|item| view! { <li>{ *item }</li> })
        .collect();
    view! {
        <article class="coach-persona" data-persona={ persona.id } aria-live="polite">
            <p class="coach-persona-label" data-persona-label>{ persona.label }</p>
            <h3 class="coach-persona-headline" data-persona-headline>{ persona.headline }</h3>
            <ul class="coach-persona-focus" data-persona-focus>{ focus }</ul>
        </article>
    }
}

fn render_about() -> HtmlFragment {
    view! {
        <section class="coach-about" aria-labelledby="coach-about-title">
            <p class="coach-kicker">"WHY ME"</p>
            <h2 id="coach-about-title" class="coach-h2">"Receipts, not platitudes."</h2>
            <ul class="coach-proof">
                <li>
                    <strong>"99%"</strong>
                    <span>"Cut Uber.com’s infrastructure bill from roughly $2M to under $100K a year."</span>
                </li>
                <li>
                    <strong>"Seconds"</strong>
                    <span>"Built a bot-defense framework that took DDoS response from minutes to seconds and cut unwanted automated traffic ~60%."</span>
                </li>
                <li>
                    <strong>"12 yrs"</strong>
                    <span>"Web platforms for Google, Apple, and Target at R/GA and AKQA, then Uber — leading engineers, PMs, and designers together."</span>
                </li>
            </ul>
            <p class="coach-sub">
                "More on "
                <a class="coach-text-link" href="https://www.linkedin.com/in/matthewcharwood/" rel="noopener" target="_blank">"LinkedIn"</a>
                " and in the "
                <a class="coach-text-link" href="https://engmanager.xyz/articles/">"articles"</a>
                "."
            </p>
        </section>
    }
}

fn render_steps() -> HtmlFragment {
    view! {
        <section class="coach-steps" aria-labelledby="coach-steps-title">
            <p class="coach-kicker">"HOW IT WORKS"</p>
            <h2 id="coach-steps-title" class="coach-h2">"Three steps to Friday."</h2>
            <ol class="coach-step-list">
                <li class="coach-step">
                    <span class="coach-step-num" aria-hidden="true">"1"</span>
                    <h3>"Pick a Friday slot"</h3>
                    <p>{ format!("Google Calendar shows my live availability, {}. Every session is {} on {}.", OFFER.window_label(), OFFER.duration_label(), OFFER.meeting) }</p>
                </li>
                <li class="coach-step">
                    <span class="coach-step-num" aria-hidden="true">"2"</span>
                    <h3>{ format!("Pay {}", OFFER.price.label()) }</h3>
                    <p>"Stripe takes the payment — card, Apple Pay, or Google Pay. The invite and Meet link land on both our calendars."</p>
                </li>
                <li class="coach-step">
                    <span class="coach-step-num" aria-hidden="true">"3"</span>
                    <h3>"Duplicate the Icebreakers doc"</h3>
                    <p>"Make your own copy of the intake doc, fill it out, and share it back before we meet so we skip straight to the good part."</p>
                </li>
            </ol>
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

fn render_booking_sheet(booking: Option<&BookingPage>) -> HtmlFragment {
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
            <div class="shop-bag-sheet coach-booking-sheet">
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
                        { render_calendar(booking) }
                        <footer class="coach-booking-foot">
                            <p class="shop-checkout-hint">"Payment runs on Google’s booking page through Stripe. Your confirmation email has the Meet link."</p>
                            <button class="shop-cart-checkout" type="button" data-booking-next>"I booked · Next step"</button>
                        </footer>
                    </div>
                    <div class="coach-booking-view coach-icebreakers" data-booking-view="icebreakers" hidden>
                        <div class="shop-bag-stamp coach-stamp" data-booking-stamp aria-hidden="true">"BOOKED"</div>
                        <p class="coach-kicker">"LAST STEP · BEFORE WE MEET"</p>
                        <h3 class="coach-h3">"Duplicate your Icebreakers doc"</h3>
                        <ol class="coach-intake-steps">
                            <li>"Open the template and click “Make a copy”."</li>
                            <li>"Fill it out: your links, what you build, the ultimate project, two truths and a lie."</li>
                            <li>"Share your copy back by replying to your booking confirmation email."</li>
                        </ol>
                        <p class="coach-recap" data-spectrum-recap>"Tell me where you placed yourself on the spectrum, and why."</p>
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

/// The `window.__coach` island: the persona table (so the slider and the
/// server share one source of truth), the weekly window for the local-time
/// hint, and whether/where the booking calendar lives.
fn island_json(booking: Option<&BookingPage>) -> String {
    let personas = PERSONAS
        .iter()
        .map(|persona| {
            json!({
                "id": persona.id,
                "label": persona.label,
                "min": persona.min,
                "max": persona.max,
                "headline": persona.headline,
                "focus": persona.focus,
            })
        })
        .collect::<Vec<_>>();
    json!({
        "personas": personas,
        "defaultSpectrum": DEFAULT_SPECTRUM,
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

fn service_json_ld() -> String {
    json!({
        "@context": "https://schema.org",
        "@type": "Service",
        "name": OFFER.name,
        "serviceType": "Career coaching",
        "url": format!("{COACH_ORIGIN}/"),
        "description": COACH_DESCRIPTION,
        "audience": {
            "@type": "Audience",
            "audienceType": "Early-career software engineers, designers, and design engineers",
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
    fn coach_page_renders_offer_spectrum_and_intake_step() {
        let html = page(Some(&booking()));

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
        // Offer terms.
        assert!(html.contains("35 min"));
        assert!(html.contains("$100"));
        assert!(html.contains("Fridays · 10am–2pm PT"));
        assert!(html.contains("10am · 10:35am · 11:10am · 11:45am · 12:20pm · 12:55pm"));
        // Spectrum slider defaults to the design-engineer stop.
        assert!(html.contains(r#"type="range""#));
        assert!(html.contains(r#"data-persona="design-engineer""#));
        for persona in PERSONAS {
            assert!(html.contains(&format!(r#"data-spectrum-stop="{}""#, persona.id)));
        }
        // Booking embed is lazy (data-src, no src) and has a new-tab fallback.
        assert!(html.contains(
            r#"data-src="https://calendar.google.com/calendar/appointments/schedules/AcZssZTest123?gv=true""#
        ));
        assert!(!html.contains(r#"<iframe class="coach-calendar-frame" src="#));
        assert!(html.contains(
            r#"href="https://calendar.google.com/calendar/appointments/schedules/AcZssZTest123" target="_blank""#
        ));
        assert!(!html.contains("data-booking-unavailable"));
        // Icebreakers: the /copy link.
        assert!(html.contains(&intake_copy_url()));
        // Structured data prices the offer.
        assert!(html.contains(r#""price":"100.00""#));
        assert!(html.contains(r#""priceCurrency":"USD""#));
        assert!(!html.contains("<style>"));
    }

    #[test]
    fn coach_page_without_a_booking_page_shows_the_notice_and_no_frame() {
        let html = page(None);
        assert!(html.contains("data-booking-unavailable"));
        assert!(!html.contains("data-booking-frame"));
        assert!(!html.contains("calendar.google.com/calendar/appointments"));
        assert!(html.contains(r#"href="/?book=calendar""#));
        assert!(html.contains(r#""booking":null"#));
    }

    #[test]
    fn short_links_render_as_a_link_not_a_frame() {
        let short = BookingPage::parse("https://calendar.app.google/abc123").expect("short link");
        let html = page(Some(&short));
        assert!(!html.contains("data-booking-frame"));
        assert!(html.contains(r#"href="https://calendar.app.google/abc123""#));
    }

    #[test]
    fn island_carries_the_persona_table_and_window() {
        let island: serde_json::Value =
            serde_json::from_str(&island_json(Some(&booking()))).expect("island is JSON");
        assert_eq!(
            island["personas"].as_array().map(Vec::len),
            Some(PERSONAS.len())
        );
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
