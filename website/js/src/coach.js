// coach.engmanager.xyz — spectrum slider + booking sheet.
//
// Data: window.__coach (see pages/coach.rs `island_json`).
// URL state mirrors the shop's `?bag=`: `?book=calendar|icebreakers` opens the
// booking sheet (every transition is a history entry; popstate reconciles),
// and `?at=0..100` deep-links a spectrum position.

(() => {
    const COACH = window.__coach || {};
    const PERSONAS = Array.isArray(COACH.personas) ? COACH.personas : [];
    const STORAGE_KEY = "engmanager.coach.spectrum";
    const BOOK_STATES = new Set(["calendar", "icebreakers"]);

    const els = {
        slider: document.querySelector("[data-spectrum]"),
        input: document.querySelector("[data-spectrum-input]"),
        stops: document.querySelectorAll("[data-spectrum-stop]"),
        persona: document.querySelector("[data-persona]"),
        personaLabel: document.querySelector("[data-persona-label]"),
        personaHeadline: document.querySelector("[data-persona-headline]"),
        personaFocus: document.querySelector("[data-persona-focus]"),
        recap: document.querySelector("[data-spectrum-recap]"),
        localWindow: document.querySelector("[data-local-window]"),
        booking: document.querySelector("[data-booking]"),
        frame: document.querySelector("[data-booking-frame]"),
        stamp: document.querySelector("[data-booking-stamp]"),
        openers: document.querySelectorAll("[data-book-open]"),
        views: document.querySelectorAll("[data-booking-view]"),
    };

    // --- spectrum ---------------------------------------------------------

    function clampSpectrum(value) {
        const n = Math.round(Number(value));
        if (!Number.isFinite(n)) return null;
        return Math.min(100, Math.max(0, n));
    }

    function personaFor(value) {
        return (
            PERSONAS.find((p) => value >= p.min && value <= p.max) ||
            PERSONAS[PERSONAS.length - 1] ||
            null
        );
    }

    function readStoredSpectrum() {
        try {
            return clampSpectrum(window.localStorage.getItem(STORAGE_KEY) ?? NaN);
        } catch {
            return null;
        }
    }

    function storeSpectrum(value) {
        try {
            window.localStorage.setItem(STORAGE_KEY, String(value));
        } catch {}
    }

    function recapText(value, persona) {
        return `Your spectrum: ${100 - value}% engineering · ${value}% design — ${persona.label}. Tell me why in your Icebreakers doc.`;
    }

    function applySpectrum(value, { animate = false } = {}) {
        const persona = personaFor(value);
        if (!persona || !els.input) return;
        els.input.value = String(value);
        els.input.setAttribute("aria-valuetext", `${persona.label}, ${value}% designer`);
        els.slider?.style.setProperty("--spectrum", `${value}%`);
        els.stops.forEach((stop) => {
            stop.dataset.active = String(stop.dataset.spectrumStop === persona.id);
        });
        if (els.recap) els.recap.textContent = recapText(value, persona);

        if (!els.persona || els.persona.dataset.persona === persona.id) return;
        els.persona.dataset.persona = persona.id;
        if (els.personaLabel) els.personaLabel.textContent = persona.label;
        if (els.personaHeadline) els.personaHeadline.textContent = persona.headline;
        if (els.personaFocus) {
            els.personaFocus.replaceChildren(
                ...persona.focus.map((item) => {
                    const li = document.createElement("li");
                    li.textContent = item;
                    return li;
                }),
            );
        }
        if (animate) {
            els.persona.classList.remove("is-swapping");
            // Force a reflow so re-adding the class restarts the animation.
            void els.persona.offsetWidth;
            els.persona.classList.add("is-swapping");
        }
    }

    function initialSpectrum() {
        const fromUrl = new URL(window.location.href).searchParams.get("at");
        const urlValue = fromUrl === null ? null : clampSpectrum(fromUrl);
        return urlValue ?? readStoredSpectrum() ?? clampSpectrum(COACH.defaultSpectrum) ?? 50;
    }

    els.input?.addEventListener("input", () => {
        const value = clampSpectrum(els.input.value);
        if (value === null) return;
        applySpectrum(value, { animate: true });
        storeSpectrum(value);
    });

    // --- local-time hint ----------------------------------------------------

    // Offset (minutes) of `timeZone` from UTC at `date`.
    function zoneOffsetMinutes(date, timeZone) {
        const parts = new Intl.DateTimeFormat("en-US", {
            timeZone,
            hourCycle: "h23",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        }).formatToParts(date);
        const get = (type) => Number(parts.find((p) => p.type === type)?.value);
        const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
        return Math.round((asUtc - date.getTime()) / 60000);
    }

    // The UTC instant of wall-clock `hhmm` on `ymd` in `timeZone`.
    function zonedInstant(ymd, hhmm, timeZone) {
        const [h, m] = hhmm.split(":").map(Number);
        const guess = Date.UTC(ymd.year, ymd.month - 1, ymd.day, h, m);
        const offset = zoneOffsetMinutes(new Date(guess), timeZone);
        return new Date(guess - offset * 60000);
    }

    function nextWindow(offer, now = new Date()) {
        const parts = new Intl.DateTimeFormat("en-US", {
            timeZone: offer.timeZone,
            year: "numeric",
            month: "numeric",
            day: "numeric",
            weekday: "short",
        }).formatToParts(now);
        const get = (type) => parts.find((p) => p.type === type)?.value;
        const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const today = weekdays.indexOf(get("weekday"));
        let daysAhead = (offer.weekday - today + 7) % 7;
        const base = { year: Number(get("year")), month: Number(get("month")), day: Number(get("day")) };
        const endToday = zonedInstant(base, offer.end, offer.timeZone);
        if (daysAhead === 0 && now >= endToday) daysAhead = 7;
        const target = new Date(Date.UTC(base.year, base.month - 1, base.day + daysAhead));
        const ymd = {
            year: target.getUTCFullYear(),
            month: target.getUTCMonth() + 1,
            day: target.getUTCDate(),
        };
        return {
            start: zonedInstant(ymd, offer.start, offer.timeZone),
            end: zonedInstant(ymd, offer.end, offer.timeZone),
        };
    }

    function renderLocalWindow() {
        const offer = COACH.offer;
        if (!els.localWindow || !offer) return;
        try {
            const viewerZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            const { start, end } = nextWindow(offer);
            const day = new Intl.DateTimeFormat(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
                timeZone: offer.timeZone,
            }).format(start);
            const time = (date, timeZone) =>
                new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", timeZone }).format(date);
            let text = `Next window: ${day}, ${time(start, offer.timeZone)}–${time(end, offer.timeZone)} ${offer.timeZoneLabel}`;
            if (viewerZone && zoneOffsetMinutes(start, viewerZone) !== zoneOffsetMinutes(start, offer.timeZone)) {
                text += ` · ${time(start, viewerZone)}–${time(end, viewerZone)} your time`;
            }
            els.localWindow.textContent = `${text}.`;
            els.localWindow.hidden = false;
        } catch {
            // Intl without time-zone support: the static PT window still shows.
        }
    }

    // --- booking sheet -------------------------------------------------------

    function bookingState() {
        return els.booking?.dataset.bookingState || "closed";
    }

    function bookFromUrl() {
        const value = new URL(window.location.href).searchParams.get("book");
        return BOOK_STATES.has(value) ? value : null;
    }

    function bookingUrl(state) {
        const url = new URL(window.location.href);
        if (state) url.searchParams.set("book", state);
        else url.searchParams.delete("book");
        return `${url.pathname}${url.search}${url.hash}`;
    }

    function setBooking(next, { replace = false } = {}) {
        const target = BOOK_STATES.has(next) ? next : null;
        window.history[replace ? "replaceState" : "pushState"](
            { ...(window.history.state || {}), book: target },
            "",
            bookingUrl(target),
        );
        applyBooking(target);
    }

    function loadFrame() {
        if (els.frame && !els.frame.getAttribute("src") && els.frame.dataset.src) {
            els.frame.setAttribute("src", els.frame.dataset.src);
        }
    }

    function focusables(root) {
        return [
            ...root.querySelectorAll(
                'a[href], button:not([disabled]), iframe, input, select, textarea, [tabindex]:not([tabindex="-1"])',
            ),
        ].filter((el) => !el.closest("[hidden]") && el.getClientRects().length > 0);
    }

    // Idempotent: reconcile the sheet DOM to a desired state (user actions via
    // setBooking, and popstate after the URL already changed).
    function applyBooking(next) {
        if (!els.booking) return;
        const prev = bookingState();
        const target = BOOK_STATES.has(next) ? next : null;

        if (!target) {
            if (prev === "closed") return;
            els.booking.dataset.bookingState = "closed";
            els.booking.hidden = true;
            els.booking.setAttribute("aria-hidden", "true");
            els.openers.forEach((el) => el.setAttribute("aria-expanded", "false"));
            document.body.classList.remove("shop-cart-open");
            document.querySelector(".coach-book-chip")?.focus({ preventScroll: true });
            return;
        }

        els.booking.hidden = false;
        els.booking.setAttribute("aria-hidden", "false");
        els.booking.dataset.bookingState = target;
        els.openers.forEach((el) => el.setAttribute("aria-expanded", "true"));
        document.body.classList.add("shop-cart-open");
        els.views.forEach((view) => {
            view.hidden = view.dataset.bookingView !== target;
        });

        if (target === "calendar") {
            loadFrame();
            if (els.stamp) els.stamp.dataset.show = "false";
        } else if (els.stamp && prev !== "icebreakers") {
            requestAnimationFrame(() => {
                els.stamp.dataset.show = "true";
            });
        }

        if (prev !== target) {
            const view = els.booking.querySelector(`[data-booking-view="${target}"]`);
            const first =
                target === "icebreakers"
                    ? view?.querySelector("[data-intake-copy]")
                    : els.booking.querySelector("[data-booking-close]");
            first?.focus({ preventScroll: true });
        }
    }

    document.addEventListener("click", (event) => {
        const target = event.target instanceof Element ? event.target : null;
        if (!target) return;

        const opener = target.closest("[data-book-open]");
        if (opener) {
            // Modified clicks keep the native link behavior (new tab).
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.button === 1) return;
            event.preventDefault();
            if (bookingState() === "closed") setBooking("calendar");
            else setBooking(null);
            return;
        }
        if (target.closest("[data-booking-close]") || target.closest("[data-booking-scrim]")) {
            setBooking(null);
            return;
        }
        if (target.closest("[data-booking-next]")) {
            setBooking("icebreakers");
            return;
        }
        if (target.closest("[data-booking-back]")) {
            setBooking("calendar");
        }
    });

    document.addEventListener("keydown", (event) => {
        if (bookingState() === "closed") return;
        if (event.key === "Escape") {
            event.preventDefault();
            setBooking(bookingState() === "icebreakers" ? "calendar" : null);
            return;
        }
        if (event.key !== "Tab") return;
        const items = focusables(els.booking);
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    });

    window.addEventListener("popstate", () => applyBooking(bookFromUrl()));

    // --- boot ------------------------------------------------------------------

    applySpectrum(initialSpectrum());
    renderLocalWindow();
    const initialBook = bookFromUrl();
    if (initialBook) applyBooking(initialBook);
    document.documentElement.dataset.coachReady = "true";
})();
