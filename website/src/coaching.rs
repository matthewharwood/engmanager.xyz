//! Coaching domain: the 1:1 session offer, its weekly availability window,
//! the hardware ↔ physical-design audience spectrum and its speed-reader
//! copy, the Google Calendar booking
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

/// The page's promise, and the first line of every speed-reader loop.
pub fn headline() -> String {
    format!(
        "Spend {} minutes. Save a year of searching.",
        OFFER.session_minutes
    )
}

/// Speed-reader speeds, in words per minute. The last one is the default.
pub const READER_SPEEDS: [u16; 3] = [200, 300, 400];
pub const READER_DEFAULT_WPM: u16 = 400;

/// One stop on the "where do you live?" spectrum, hardware on the left to
/// physical design on the right. Its copy is written for about a 7th-grade
/// reading level (pinned by a test). Client and server share this table via
/// the page's data island; the slider's value is the index into it.
pub struct Persona {
    pub id: &'static str,
    /// Short label under the slider's pip.
    pub label: &'static str,
    /// Who the stop speaks to, for the slider's accessible value text.
    pub audience: &'static str,
    /// First paragraph: why job hunting is slow for this person.
    pub problem: &'static str,
    /// The one "how it works" sentence that is specific to this stop.
    pub plan: &'static str,
}

impl Persona {
    /// The two paragraphs the speed reader loops after the headline.
    pub fn paragraphs(&self) -> [String; 2] {
        [
            self.problem.to_string(),
            format!(
                "Here is how it works. You pick a Friday, pay {price}, and send me your resume with a short Icebreakers doc. I read both before we talk. I lead engineering teams at Uber and I hire people, so I know what makes a hiring manager say yes. In {minutes} minutes, I will tell you exactly what I see. {plan} You will leave with a clear plan instead of another year of guessing.",
                price = OFFER.price.label(),
                minutes = OFFER.session_minutes,
                plan = self.plan,
            ),
        ]
    }
}

pub const PERSONAS: &[Persona] = &[
    Persona {
        id: "hardware",
        label: "Hardware",
        audience: "Hardware engineers",
        problem: "You build the parts most people never see, like boards, chips, and firmware that have to work the first time. The trouble is that a resume can hide all of that. Hiring teams skim for a few seconds, and if they can’t see what you built, they move on. I lead software teams, not hardware teams, but a strong resume works the same way everywhere.",
        plan: "We will make the hard things you built easy to see.",
    },
    Persona {
        id: "backend",
        label: "Backend",
        audience: "Backend engineers",
        problem: "You build systems that stay up, and nobody cheers when a server doesn’t crash. That is the problem. Your best work is quiet, so your resume has to be loud about it. Numbers do the talking: how fast, how big, and how much money it saved. Without them, you look like everyone else in the pile.",
        plan: "We will turn your tasks into results with real numbers.",
    },
    Persona {
        id: "frontend",
        label: "Frontend",
        audience: "Frontend engineers",
        problem: "You build the part of the product people actually touch, which is good news, because you can show it. The trouble is that most frontend resumes sound the same: React, TypeScript, Tailwind. A list of tools is not a story. Hiring managers want to know what you made better, and who it helped.",
        plan: "We will turn your tool list into proof of what you built.",
    },
    Persona {
        id: "design-engineer",
        label: "Design engineer",
        audience: "Design engineers",
        problem: "You live between design and code, and that is a rare skill. A lot of teams still don’t know how to hire for it, so you have to explain it for them. Show the prototype. Show the feature that only shipped because you could do both. Make it easy for someone to say yes to you.",
        plan: "We will shape your story so teams see where you fit.",
    },
    Persona {
        id: "product-designer",
        label: "Product designer",
        audience: "Product designers",
        problem: "You solve problems, not just screens, but a portfolio full of pretty pictures can hide how you think. Hiring teams want the story behind the work. What was broken, what did you try, and what changed? If your case studies skip that part, you might wait a long time for a call back.",
        plan: "We will sharpen your case studies so your thinking shows.",
    },
    Persona {
        id: "visual-designer",
        label: "Visual designer",
        audience: "Visual designers",
        problem: "Your eye is your edge: type, color, layout, and brand. But taste is hard to prove on a resume. The trick is to connect your craft to what it did for people. Did more people sign up? Did the brand finally feel real? Say it in plain words, then show the proof.",
        plan: "We will tie your craft to results people care about.",
    },
    Persona {
        id: "physical-designer",
        label: "Physical designer",
        audience: "Industrial designers, architects, and anyone who designs physical things",
        problem: "You design things people can hold, sit in, or walk through. Your work lives in the real world, so it can be hard to show on a screen. I lead software teams, so I won’t pretend to know your tools. Hiring works the same way everywhere, though: show the problem, the making, and the result.",
        plan: "We will make your process easy to see on a screen.",
    },
];

/// The stop the slider starts on before a visitor touches it: the middle.
pub const DEFAULT_PERSONA_ID: &str = "design-engineer";

pub fn persona_by_id(id: &str) -> Option<&'static Persona> {
    PERSONAS.iter().find(|persona| persona.id == id)
}

/// Index of the default stop in [`PERSONAS`] (the slider's initial value).
pub fn default_persona_index() -> usize {
    PERSONAS
        .iter()
        .position(|persona| persona.id == DEFAULT_PERSONA_ID)
        .unwrap_or(0)
}

/// Split a word around its optimal recognition point (the letter the eye
/// should land on), the way the speed reader pins it under the reticle notch.
/// Mirrors `orpIndex` in `js/coach.js`: leading/trailing punctuation is
/// ignored, and the pivot moves right as the word gets longer.
pub fn orp_split(word: &str) -> (String, String, String) {
    let chars: Vec<char> = word.chars().collect();
    let is_letter = |c: &char| c.is_alphanumeric();
    let Some(first) = chars.iter().position(is_letter) else {
        return (String::new(), word.to_string(), String::new());
    };
    let last = chars.iter().rposition(is_letter).unwrap_or(first);
    let offset = match last - first + 1 {
        0..=1 => 0,
        2..=5 => 1,
        6..=9 => 2,
        10..=13 => 3,
        _ => 4,
    };
    let pivot = first + offset;
    (
        chars[..pivot].iter().collect(),
        chars[pivot].to_string(),
        chars[pivot + 1..].iter().collect(),
    )
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
    fn spectrum_runs_from_hardware_to_physical_design() {
        let ids: Vec<&str> = PERSONAS.iter().map(|p| p.id).collect();
        assert_eq!(
            ids,
            [
                "hardware",
                "backend",
                "frontend",
                "design-engineer",
                "product-designer",
                "visual-designer",
                "physical-designer",
            ]
        );
        let default = &PERSONAS[default_persona_index()];
        assert_eq!(default.id, DEFAULT_PERSONA_ID);
        assert_eq!(persona_by_id("backend").map(|p| p.label), Some("Backend"));
        assert!(persona_by_id("engineer").is_none());
        for persona in PERSONAS {
            let [problem, help] = persona.paragraphs();
            assert!(!problem.is_empty() && help.contains(persona.plan));
            assert!(help.contains("$100") && help.contains("35 minutes"));
        }
    }

    #[test]
    fn reader_defaults_to_its_fastest_speed() {
        assert_eq!(READER_SPEEDS.last(), Some(&READER_DEFAULT_WPM));
        assert!(READER_SPEEDS.windows(2).all(|pair| pair[0] < pair[1]));
        assert_eq!(headline(), "Spend 35 minutes. Save a year of searching.");
    }

    #[test]
    fn orp_pivots_right_as_words_get_longer() {
        let split = |word: &str| orp_split(word);
        let owned = |a: &str, b: &str, c: &str| (a.to_string(), b.to_string(), c.to_string());
        assert_eq!(split("I"), owned("", "I", ""));
        assert_eq!(split("Spend"), owned("S", "p", "end"));
        assert_eq!(split("minutes."), owned("mi", "n", "utes."));
        assert_eq!(split("“Hiring"), owned("“Hi", "r", "ing"));
        assert_eq!(split("engineering"), owned("eng", "i", "neering"));
        assert_eq!(split("—"), owned("", "—", ""));
    }

    /// Flesch–Kincaid grade with a vowel-group syllable estimate. Rough, but
    /// stable enough to catch copy drifting past a 7th-grade reading level.
    fn reading_grade(text: &str) -> f64 {
        fn syllables(word: &str) -> usize {
            let letters: String = word
                .chars()
                .filter(char::is_ascii_alphabetic)
                .map(|c| c.to_ascii_lowercase())
                .collect();
            if letters.len() <= 3 {
                return usize::from(!letters.is_empty());
            }
            let trimmed = letters
                .strip_suffix("es")
                .or_else(|| letters.strip_suffix("ed"))
                .or_else(|| letters.strip_suffix('e'))
                .unwrap_or(&letters);
            let mut groups = 0;
            let mut in_vowel = false;
            for c in trimmed.chars() {
                let vowel = "aeiouy".contains(c);
                if vowel && !in_vowel {
                    groups += 1;
                }
                in_vowel = vowel;
            }
            groups.max(1)
        }
        let words: Vec<&str> = text.split_whitespace().collect();
        let sentences = text.matches(['.', '?', '!']).count().max(1);
        let syllable_count: usize = words.iter().map(|w| syllables(w)).sum();
        let words_len = words.len().max(1) as f64;
        0.39 * words_len / sentences as f64 + 11.8 * syllable_count as f64 / words_len - 15.59
    }

    #[test]
    fn spectrum_copy_reads_at_or_below_seventh_grade() {
        for persona in PERSONAS {
            let [problem, help] = persona.paragraphs();
            let text = format!("{} {problem} {help}", headline());
            let grade = reading_grade(&text);
            assert!(grade <= 7.0, "{} reads at grade {grade:.1}", persona.id);
        }
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
