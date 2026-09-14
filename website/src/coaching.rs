//! Coaching domain: the 1:1 session offer, its weekly availability window,
//! the engineer ↔ designer audience spectrum, the Google Calendar booking
//! page, and the Icebreakers intake doc. Pure data + smart constructors —
//! page rendering lives in `pages::coach`, which imports from here.
//!
//! Scheduling and payment are NOT implemented in this binary: a Google
//! Calendar appointment schedule (with "Require payment when booking" backed
//! by the connected Stripe account) owns availability, checkout, the Meet
//! link, and the calendar event. This module is the single source of truth
//! that the page renders AND that the schedule must be configured to match
//! (see `_docs/coach-subdomain-runbook.md`).

use std::sync::LazyLock;

use crate::catalog::PriceCents;

/// Canonical public origin of the coaching subdomain.
pub const COACH_ORIGIN: &str = "https://coach.engmanager.xyz";

/// Env override for the Google Calendar appointment-schedule booking page.
pub const BOOKING_URL_ENV_VAR: &str = "COACH_BOOKING_URL";

/// Booking page baked into the binary, used when `COACH_BOOKING_URL` is unset.
/// `None` until the appointment schedule exists — the page then renders the
/// "calendar is being connected" notice instead of an embed.
const DEFAULT_BOOKING_URL: Option<&str> = None;

/// The Icebreakers template every client duplicates after booking. Shared as
/// "anyone with the link can view", which is what makes `/copy` work.
const INTAKE_DOC_ID: &str = "1uTPB3l9oJ5rCKHiqUYOv_EKfcrtLNUtKn6hIBO-Lbn8";

/// Minutes-since-midnight wall-clock time in the offer's time zone.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct ClockTime(u16);

impl ClockTime {
    pub const fn new(hour: u16, minute: u16) -> Self {
        assert!(hour < 24 && minute < 60, "ClockTime out of range");
        Self(hour * 60 + minute)
    }

    pub const fn minutes(self) -> u16 {
        self.0
    }

    const fn plus(self, minutes: u16) -> Self {
        Self(self.0 + minutes)
    }

    /// 24-hour `HH:MM`, the shape the client-side local-time hint parses.
    pub fn hhmm(self) -> String {
        format!("{:02}:{:02}", self.0 / 60, self.0 % 60)
    }

    /// 12-hour display label: `10am`, `12:20pm`, `2pm`.
    pub fn label(self) -> String {
        let (hour, minute) = (self.0 / 60, self.0 % 60);
        let suffix = if hour < 12 { "am" } else { "pm" };
        let hour12 = match hour % 12 {
            0 => 12,
            h => h,
        };
        if minute == 0 {
            format!("{hour12}{suffix}")
        } else {
            format!("{hour12}:{minute:02}{suffix}")
        }
    }
}

/// The one coaching product. Every field is mirrored by the Google Calendar
/// appointment schedule's settings.
pub struct CoachingOffer {
    pub name: &'static str,
    pub price: PriceCents,
    pub session_minutes: u16,
    /// Gap Google inserts between back-to-back appointments.
    pub buffer_minutes: u16,
    pub weekday: &'static str,
    pub time_zone: &'static str,
    pub time_zone_label: &'static str,
    pub window_start: ClockTime,
    pub window_end: ClockTime,
    pub meeting: &'static str,
}

pub const OFFER: CoachingOffer = CoachingOffer {
    name: "1:1 Career Coaching",
    price: PriceCents::from_dollars(100),
    session_minutes: 35,
    buffer_minutes: 0,
    weekday: "Friday",
    time_zone: "America/Los_Angeles",
    time_zone_label: "PT",
    window_start: ClockTime::new(10, 0),
    window_end: ClockTime::new(14, 0),
    meeting: "Google Meet",
};

impl CoachingOffer {
    pub fn duration_label(&self) -> String {
        format!("{} min", self.session_minutes)
    }

    /// `Fridays · 10am–2pm PT`
    pub fn window_label(&self) -> String {
        format!(
            "{}s · {}–{} {}",
            self.weekday,
            self.window_start.label(),
            self.window_end.label(),
            self.time_zone_label
        )
    }

    /// Every bookable start time in one weekly window: sessions run back to
    /// back (plus the buffer) and the last one must END by `window_end`.
    pub fn slot_starts(&self) -> Vec<ClockTime> {
        let step = self.session_minutes + self.buffer_minutes;
        let mut slots = Vec::new();
        let mut start = self.window_start;
        while step > 0 && start.plus(self.session_minutes) <= self.window_end {
            slots.push(start);
            start = start.plus(step);
        }
        slots
    }

    /// Stripe amount in the major unit with two decimals (`100.00`), the shape
    /// schema.org `Offer.price` expects.
    pub fn price_decimal(&self) -> String {
        let cents = self.price.cents();
        format!("{}.{:02}", cents / 100, cents % 100)
    }
}

/// One stop on the engineer ↔ designer slider. `min..=max` partition 0..=100
/// with no gaps or overlaps (pinned by a test), so every slider value maps to
/// exactly one persona — client and server share this table via the page's
/// data island.
pub struct Persona {
    pub id: &'static str,
    pub label: &'static str,
    pub min: u8,
    pub max: u8,
    pub headline: &'static str,
    pub focus: [&'static str; 3],
}

pub const PERSONAS: &[Persona] = &[
    Persona {
        id: "engineer",
        label: "Engineer",
        min: 0,
        max: 33,
        headline: "Ship with more leverage, less heroics.",
        focus: [
            "Scoping work, estimating it, and getting it through code review",
            "Web performance, reliability, and owning an on-call rotation",
            "Getting from junior to mid-level: visibility, promo packets, feedback",
        ],
    },
    Persona {
        id: "design-engineer",
        label: "Design engineer",
        min: 34,
        max: 66,
        headline: "Live in the seam between Figma and production.",
        focus: [
            "Design systems, component APIs, and prototyping in real code",
            "Motion, accessibility, and performance as craft, not afterthoughts",
            "Carving out a design-engineering role on a team that lacks one",
        ],
    },
    Persona {
        id: "designer",
        label: "Designer",
        min: 67,
        max: 100,
        headline: "Make your work land with the engineers who build it.",
        focus: [
            "Handoffs, specs, and design reviews engineers actually use",
            "Learning just enough code to prototype and earn trust",
            "Portfolio and case-study storytelling for product teams",
        ],
    },
];

/// Where the slider starts before a visitor touches it.
pub const DEFAULT_SPECTRUM: u8 = 50;

/// The persona for a slider value (values past 100 clamp to the last stop).
pub fn persona_for(value: u8) -> &'static Persona {
    let value = value.min(100);
    PERSONAS
        .iter()
        .find(|persona| (persona.min..=persona.max).contains(&value))
        .unwrap_or(&PERSONAS[PERSONAS.len() - 1])
}

/// `/copy` forces Google Docs' "Make a copy" dialog, so the client ends up
/// with their own editable Icebreakers doc.
pub fn intake_copy_url() -> String {
    format!("https://docs.google.com/document/d/{INTAKE_DOC_ID}/copy")
}

pub fn intake_preview_url() -> String {
    format!("https://docs.google.com/document/d/{INTAKE_DOC_ID}/preview")
}

/// A validated Google Calendar appointment-schedule booking page
/// (rust-core-patterns "smart constructors"). Only Google's own booking hosts
/// are accepted, because the URL is spliced into an `<iframe src>` and a link
/// on a page that takes money — an env typo must not frame an arbitrary site.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct BookingPage {
    href: String,
    embeddable: bool,
}

#[derive(Debug, PartialEq, Eq, thiserror::Error)]
pub enum BookingUrlError {
    #[error("booking URL must be https")]
    NotHttps,
    #[error(
        "booking URL must be a calendar.google.com/calendar/appointments/schedules/… or calendar.app.google/… link"
    )]
    UnsupportedHost,
    #[error("booking URL is missing the schedule id")]
    MissingScheduleId,
    #[error("booking URL contains characters that are not allowed")]
    InvalidCharacters,
}

const SCHEDULE_PREFIX: &str = "https://calendar.google.com/calendar/appointments/schedules/";
const SHORT_LINK_PREFIX: &str = "https://calendar.app.google/";

impl BookingPage {
    pub fn parse(raw: &str) -> Result<Self, BookingUrlError> {
        let raw = raw.trim();
        if !raw.starts_with("https://") {
            return Err(BookingUrlError::NotHttps);
        }
        // Schedule ids are URL-safe base64-ish tokens; the only query we keep
        // is Google's own (e.g. `gv=true`). Rejecting quotes, spaces, angle
        // brackets, and fragments keeps the attribute value boring.
        let allowed = |c: char| c.is_ascii_alphanumeric() || "-_./:?=&%".contains(c);
        if !raw.chars().all(allowed) {
            return Err(BookingUrlError::InvalidCharacters);
        }
        let (prefix, embeddable) = if raw.starts_with(SCHEDULE_PREFIX) {
            (SCHEDULE_PREFIX, true)
        } else if raw.starts_with(SHORT_LINK_PREFIX) {
            // Short share links redirect to the schedule page; they work as a
            // link but are not a documented embed target.
            (SHORT_LINK_PREFIX, false)
        } else {
            return Err(BookingUrlError::UnsupportedHost);
        };
        let id = raw[prefix.len()..].split(['?', '/']).next().unwrap_or("");
        if id.is_empty() {
            return Err(BookingUrlError::MissingScheduleId);
        }
        Ok(Self {
            href: raw.to_string(),
            embeddable,
        })
    }

    /// The link visitors open in a new tab.
    pub fn href(&self) -> &str {
        &self.href
    }

    /// The `<iframe src>` Google's "Website embed" snippet uses: the schedule
    /// URL with `gv=true`. `None` for short links.
    pub fn embed_src(&self) -> Option<String> {
        if !self.embeddable {
            return None;
        }
        if self.href.contains("gv=true") {
            return Some(self.href.clone());
        }
        let separator = if self.href.contains('?') { '&' } else { '?' };
        Some(format!("{}{separator}gv=true", self.href))
    }
}

/// Resolve the booking page: `COACH_BOOKING_URL` wins, else the baked-in
/// default. An invalid value is logged and treated as "not connected yet".
pub fn booking_page_from(env_value: Option<&str>) -> Option<BookingPage> {
    let (raw, source) = match env_value.map(str::trim).filter(|v| !v.is_empty()) {
        Some(value) => (value, BOOKING_URL_ENV_VAR),
        None => (DEFAULT_BOOKING_URL?, "DEFAULT_BOOKING_URL"),
    };
    match BookingPage::parse(raw) {
        Ok(page) => Some(page),
        Err(err) => {
            tracing::warn!(source, %err, "ignoring invalid coaching booking URL");
            None
        }
    }
}

/// Process-wide booking page, resolved once from the environment.
pub static BOOKING_PAGE: LazyLock<Option<BookingPage>> =
    LazyLock::new(|| booking_page_from(std::env::var(BOOKING_URL_ENV_VAR).ok().as_deref()));

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn offer_matches_the_published_terms() {
        assert_eq!(OFFER.price.cents(), 10_000);
        assert_eq!(OFFER.price.label(), "$100");
        assert_eq!(OFFER.price_decimal(), "100.00");
        assert_eq!(OFFER.duration_label(), "35 min");
        assert_eq!(OFFER.weekday, "Friday");
        assert_eq!(OFFER.time_zone, "America/Los_Angeles");
        assert_eq!(OFFER.window_label(), "Fridays · 10am–2pm PT");
    }

    #[test]
    fn slots_run_back_to_back_and_end_inside_the_window() {
        let slots = OFFER.slot_starts();
        let labels: Vec<String> = slots.iter().map(|s| s.label()).collect();
        assert_eq!(
            labels,
            [
                "10am", "10:35am", "11:10am", "11:45am", "12:20pm", "12:55pm"
            ]
        );
        let last = slots.last().expect("at least one slot");
        assert!(last.minutes() + OFFER.session_minutes <= OFFER.window_end.minutes());
        // A seventh session (1:30pm) would run past 2pm.
        assert!(
            ClockTime::new(13, 30).minutes() + OFFER.session_minutes > OFFER.window_end.minutes()
        );
    }

    #[test]
    fn slots_respect_a_buffer() {
        let offer = CoachingOffer {
            buffer_minutes: 25,
            ..OFFER
        };
        let labels: Vec<String> = offer.slot_starts().iter().map(|s| s.hhmm()).collect();
        assert_eq!(labels, ["10:00", "11:00", "12:00", "13:00"]);
    }

    #[test]
    fn clock_labels_cover_noon_and_midnight() {
        assert_eq!(ClockTime::new(0, 5).label(), "12:05am");
        assert_eq!(ClockTime::new(12, 0).label(), "12pm");
        assert_eq!(ClockTime::new(14, 0).label(), "2pm");
        assert_eq!(ClockTime::new(9, 7).hhmm(), "09:07");
    }

    #[test]
    fn personas_partition_the_whole_slider_range() {
        assert_eq!(PERSONAS.first().map(|p| p.min), Some(0));
        assert_eq!(PERSONAS.last().map(|p| p.max), Some(100));
        for pair in PERSONAS.windows(2) {
            assert_eq!(
                pair[0].max + 1,
                pair[1].min,
                "gap/overlap at {}",
                pair[1].id
            );
        }
        for value in 0..=100u8 {
            let hits = PERSONAS
                .iter()
                .filter(|p| (p.min..=p.max).contains(&value))
                .count();
            assert_eq!(hits, 1, "value {value} must map to exactly one persona");
        }
    }

    #[test]
    fn persona_lookup_hits_each_stop() {
        assert_eq!(persona_for(0).id, "engineer");
        assert_eq!(persona_for(33).id, "engineer");
        assert_eq!(persona_for(34).id, "design-engineer");
        assert_eq!(persona_for(DEFAULT_SPECTRUM).id, "design-engineer");
        assert_eq!(persona_for(67).id, "designer");
        assert_eq!(persona_for(255).id, "designer");
    }

    #[test]
    fn intake_links_point_at_the_icebreakers_template() {
        assert_eq!(
            intake_copy_url(),
            "https://docs.google.com/document/d/1uTPB3l9oJ5rCKHiqUYOv_EKfcrtLNUtKn6hIBO-Lbn8/copy"
        );
        assert!(intake_preview_url().ends_with("/preview"));
    }

    #[test]
    fn booking_page_accepts_google_schedule_links_and_builds_the_embed() {
        let page = BookingPage::parse(
            "https://calendar.google.com/calendar/appointments/schedules/AcZssZ1abc_DEF-2",
        )
        .expect("schedule link parses");
        assert_eq!(
            page.embed_src().as_deref(),
            Some(
                "https://calendar.google.com/calendar/appointments/schedules/AcZssZ1abc_DEF-2?gv=true"
            )
        );

        let with_query = BookingPage::parse(
            " https://calendar.google.com/calendar/appointments/schedules/AcZssZ1?hl=en ",
        )
        .expect("query + whitespace tolerated");
        assert_eq!(
            with_query.embed_src().as_deref(),
            Some(
                "https://calendar.google.com/calendar/appointments/schedules/AcZssZ1?hl=en&gv=true"
            )
        );

        let already = BookingPage::parse(
            "https://calendar.google.com/calendar/appointments/schedules/AcZssZ1?gv=true",
        )
        .expect("embed link parses");
        assert_eq!(already.embed_src().as_deref(), Some(already.href()));

        let short = BookingPage::parse("https://calendar.app.google/xYz123").expect("short link");
        assert_eq!(short.href(), "https://calendar.app.google/xYz123");
        assert_eq!(short.embed_src(), None);
    }

    #[test]
    fn booking_page_rejects_anything_that_is_not_a_google_booking_link() {
        use BookingUrlError::*;
        let cases = [
            (
                "http://calendar.google.com/calendar/appointments/schedules/x",
                NotHttps,
            ),
            ("javascript:alert(1)", NotHttps),
            (
                "https://evil.example/calendar/appointments/schedules/x",
                UnsupportedHost,
            ),
            (
                "https://calendar.google.com.evil.example/x",
                UnsupportedHost,
            ),
            (
                "https://calendar.google.com/calendar/u/0/r",
                UnsupportedHost,
            ),
            (
                "https://calendar.google.com/calendar/appointments/schedules/",
                MissingScheduleId,
            ),
            ("https://calendar.app.google/", MissingScheduleId),
            (
                "https://calendar.google.com/calendar/appointments/schedules/x\" onload=\"alert(1)",
                InvalidCharacters,
            ),
            ("https://calendar.app.google/x#frag", InvalidCharacters),
        ];
        for (raw, expected) in cases {
            assert_eq!(BookingPage::parse(raw), Err(expected), "{raw}");
        }
    }

    #[test]
    fn booking_page_resolution_prefers_a_valid_env_value() {
        let env = "https://calendar.google.com/calendar/appointments/schedules/AcZssZEnv";
        assert_eq!(
            booking_page_from(Some(env)).map(|p| p.href().to_string()),
            Some(env.to_string())
        );
        // Invalid or blank env values fall back to the baked-in default.
        assert_eq!(
            booking_page_from(Some("https://evil.example/")),
            None,
            "an invalid env value must never be rendered"
        );
        assert_eq!(
            booking_page_from(Some("   ")),
            DEFAULT_BOOKING_URL.and_then(|raw| BookingPage::parse(raw).ok())
        );
    }
}
