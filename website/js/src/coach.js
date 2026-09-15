// coach.engmanager.xyz — speed reader, spectrum slider, booking sheet.
//
// Data: window.__coach (see pages/coach.rs `island_json`).
// URL state mirrors the shop's `?bag=`: `?book=calendar|icebreakers` opens the
// booking sheet (every transition is a history entry; popstate reconciles),
// and `?role=<persona id>` deep-links a spectrum stop.

(() => {
    const COACH = window.__coach || {};
    const PERSONAS = Array.isArray(COACH.personas) ? COACH.personas : [];
    const BOOK_STATES = new Set(["calendar", "icebreakers"]);
    const STORAGE = {
        role: "engmanager.coach.role",
        mode: "engmanager.coach.mode",
        wpm: "engmanager.coach.wpm",
    };

    const els = {
        reader: document.querySelector("[data-reader]"),
        word: document.querySelector("[data-reader-word]"),
        pre: document.querySelector("[data-reader-pre]"),
        pivot: document.querySelector("[data-reader-pivot]"),
        post: document.querySelector("[data-reader-post]"),
        progress: document.querySelector("[data-reader-progress]"),
        text: document.querySelector("[data-reader-text]"),
        toggle: document.querySelector("[data-reader-toggle]"),
        modeOptions: document.querySelectorAll("[data-reader-mode-option]"),
        speedOptions: document.querySelectorAll("[data-reader-speed]"),
        spectrum: document.querySelector("[data-spectrum]"),
        input: document.querySelector("[data-spectrum-input]"),
        stops: document.querySelectorAll("[data-spectrum-stop]"),
        current: document.querySelector("[data-spectrum-current]"),
        recap: document.querySelector("[data-spectrum-recap]"),
        localWindow: document.querySelector("[data-local-window]"),
        booking: document.querySelector("[data-booking]"),
        frame: document.querySelector("[data-booking-frame]"),
        stamp: document.querySelector("[data-booking-stamp]"),
        openers: document.querySelectorAll("[data-book-open]"),
        views: document.querySelectorAll("[data-booking-view]"),
    };

    function readStored(key) {
        try {
            return window.localStorage.getItem(key);
        } catch {
            return null;
        }
    }

    function store(key, value) {
        try {
            window.localStorage.setItem(key, String(value));
        } catch {}
    }

    // --- speed reader --------------------------------------------------------
    //
    // Spritz-style RSVP: one word at a time, positioned so its optimal
    // recognition point (ORP) sits under the reticle notch, so the eye never
    // moves. Longer words and punctuation hold a little longer.

    const LETTER = /[\p{L}\p{N}]/u;
    const SPEEDS = (Array.isArray(COACH.reader?.speeds) ? COACH.reader.speeds : [400]).map(Number);
    const DEFAULT_WPM = Number(COACH.reader?.defaultWpm) || SPEEDS[SPEEDS.length - 1];
    const LOOP_GAP_BEATS = 5;
    const START_DELAY_MS = 700;
    const BACK_MS = 5000;

    const reader = {
        tokens: [],
        // elapsed[i] = ms from the start of the loop until token i shows.
        elapsed: [],
        total: 0,
        index: 0,
        wpm: DEFAULT_WPM,
        mode: "speed",
        wantsPlay: true,
        // Reasons playback is on hold regardless of intent: "booking",
        // "offscreen", "hidden".
        holds: new Set(),
        timer: 0,
    };

    // Mirrors `orp_split` in coaching.rs.
    function pivotIndex(chars) {
        const first = chars.findIndex((c) => LETTER.test(c));
        if (first < 0) return 0;
        let last = chars.length - 1;
        while (last > first && !LETTER.test(chars[last])) last -= 1;
        const length = last - first + 1;
        const offset = length <= 1 ? 0 : length <= 5 ? 1 : length <= 9 ? 2 : length <= 13 ? 3 : 4;
        return first + offset;
    }

    function tokenize(blocks) {
        const tokens = [];
        blocks.forEach((block) => {
            const words = String(block).split(/\s+/).filter(Boolean);
            words.forEach((word, i) => {
                let pause = "none";
                if (i === words.length - 1) pause = "block";
                else if (/[.!?]["”’)]*$/.test(word)) pause = "sentence";
                else if (/[,;:—–]["”’)]*$/.test(word)) pause = "clause";
                tokens.push({ chars: Array.from(word), pause });
            });
        });
        return tokens;
    }

    function tokenMs(token, wpm) {
        const beat = 60000 / wpm;
        const letters = token.chars.filter((c) => LETTER.test(c)).length;
        let factor = 1 + Math.min(0.6, Math.max(0, letters - 7) * 0.1);
        if (token.pause === "clause") factor += 0.6;
        else if (token.pause === "sentence") factor += 1.4;
        else if (token.pause === "block") factor += 2.4;
        return beat * factor;
    }

    function retime() {
        let at = 0;
        reader.elapsed = reader.tokens.map((token) => {
            const start = at;
            at += tokenMs(token, reader.wpm);
            return start;
        });
        reader.total = at;
    }

    function setProgress(fraction) {
        els.progress?.style.setProperty("--reader-progress", String(Math.min(1, Math.max(0, fraction))));
    }

    function showToken(index) {
        const token = reader.tokens[index];
        if (!token || !els.pre || !els.pivot || !els.post) return;
        const at = pivotIndex(token.chars);
        els.pre.textContent = token.chars.slice(0, at).join("");
        els.pivot.textContent = token.chars[at] ?? "";
        els.post.textContent = token.chars.slice(at + 1).join("");
        setProgress(reader.total ? reader.elapsed[index] / reader.total : 0);
    }

    function showBlank() {
        if (els.pre) els.pre.textContent = "";
        if (els.pivot) els.pivot.textContent = "";
        if (els.post) els.post.textContent = "";
        setProgress(1);
    }

    function isPlaying() {
        return reader.mode === "speed" && reader.wantsPlay && reader.holds.size === 0 && reader.tokens.length > 0;
    }

    function schedule(extraMs = 0) {
        window.clearTimeout(reader.timer);
        if (!isPlaying()) return;
        const token = reader.tokens[reader.index];
        if (!token) return;
        reader.timer = window.setTimeout(advance, tokenMs(token, reader.wpm) + extraMs);
    }

    function advance() {
        if (reader.index >= reader.tokens.length - 1) {
            // End of the loop: an empty reticle for a beat, then start over.
            reader.index = 0;
            showBlank();
            reader.timer = window.setTimeout(
                () => {
                    showToken(0);
                    schedule();
                },
                (60000 / reader.wpm) * LOOP_GAP_BEATS,
            );
            return;
        }
        reader.index += 1;
        showToken(reader.index);
        schedule();
    }

    // Reconcile the timer and the play/pause button with the current state.
    function syncPlayback(extraMs = 0) {
        window.clearTimeout(reader.timer);
        const playing = isPlaying();
        if (els.reader) els.reader.dataset.readerPlaying = String(playing);
        if (els.toggle) {
            els.toggle.dataset.playing = String(reader.wantsPlay);
            els.toggle.setAttribute("aria-label", reader.wantsPlay ? "Pause" : "Play");
        }
        if (playing) {
            showToken(reader.index);
            schedule(extraMs);
        }
    }

    function hold(reason, on) {
        if (on) reader.holds.add(reason);
        else reader.holds.delete(reason);
        syncPlayback();
    }

    function setMode(mode, { remember = true } = {}) {
        reader.mode = mode === "read" ? "read" : "speed";
        if (els.reader) els.reader.dataset.readerMode = reader.mode;
        els.modeOptions.forEach((button) => {
            button.setAttribute("aria-pressed", String(button.dataset.readerModeOption === reader.mode));
        });
        if (remember) store(STORAGE.mode, reader.mode);
        syncPlayback();
    }

    function setWpm(wpm, { remember = true } = {}) {
        const next = SPEEDS.includes(Number(wpm)) ? Number(wpm) : DEFAULT_WPM;
        reader.wpm = next;
        els.speedOptions.forEach((button) => {
            button.setAttribute("aria-pressed", String(Number(button.dataset.readerSpeed) === next));
        });
        if (remember) store(STORAGE.wpm, next);
        retime();
        syncPlayback();
    }

    function restart() {
        reader.index = 0;
        reader.wantsPlay = true;
        showToken(0);
        syncPlayback();
    }

    function back() {
        let spent = 0;
        let index = reader.index;
        while (index > 0 && spent < BACK_MS) {
            index -= 1;
            spent += tokenMs(reader.tokens[index], reader.wpm);
        }
        reader.index = index;
        showToken(index);
        syncPlayback();
    }

    function togglePlay() {
        reader.wantsPlay = !reader.wantsPlay;
        syncPlayback();
    }

    // --- spectrum --------------------------------------------------------------

    function personaIndex(id) {
        return PERSONAS.findIndex((persona) => persona.id === id);
    }

    function recapText(persona) {
        return `You picked ${persona.label.toLowerCase()} on the spectrum. Tell me why in your Icebreakers doc.`;
    }

    function renderParagraphs(persona, { animate }) {
        if (!els.text) return;
        els.text.replaceChildren(
            ...persona.paragraphs.map((paragraph) => {
                const p = document.createElement("p");
                p.textContent = paragraph;
                return p;
            }),
        );
        if (animate) {
            els.text.classList.remove("is-swapping");
            // Force a reflow so re-adding the class restarts the animation.
            void els.text.offsetWidth;
            els.text.classList.add("is-swapping");
        }
    }

    function applyPersona(index, { animate = false } = {}) {
        const persona = PERSONAS[index];
        if (!persona) return;
        if (els.input) {
            els.input.value = String(index);
            els.input.setAttribute("aria-valuetext", persona.audience);
        }
        els.spectrum?.style.setProperty("--value", String(index));
        els.stops.forEach((stop) => {
            stop.dataset.active = String(stop.dataset.spectrumStop === persona.id);
        });
        if (els.current) els.current.textContent = persona.label;
        if (els.recap) els.recap.textContent = recapText(persona);
        if (els.reader?.dataset.readerPersona === persona.id) return;
        if (els.reader) els.reader.dataset.readerPersona = persona.id;

        renderParagraphs(persona, { animate });
        reader.tokens = tokenize([COACH.headline, ...persona.paragraphs]);
        retime();
        reader.index = 0;
        showToken(0);
        syncPlayback();
    }

    function initialPersonaIndex() {
        const fromUrl = personaIndex(new URL(window.location.href).searchParams.get("role"));
        if (fromUrl >= 0) return fromUrl;
        const stored = personaIndex(readStored(STORAGE.role));
        if (stored >= 0) return stored;
        return Math.max(0, personaIndex(COACH.defaultPersona));
    }

    els.input?.addEventListener("input", () => {
        const index = Math.round(Number(els.input.value));
        if (!PERSONAS[index]) return;
        applyPersona(index, { animate: true });
        store(STORAGE.role, PERSONAS[index].id);
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
            hold("booking", false);
            document.querySelector(".coach-book-chip")?.focus({ preventScroll: true });
            return;
        }

        els.booking.hidden = false;
        els.booking.setAttribute("aria-hidden", "false");
        els.booking.dataset.bookingState = target;
        els.openers.forEach((el) => el.setAttribute("aria-expanded", "true"));
        document.body.classList.add("shop-cart-open");
        hold("booking", true);
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
            return;
        }

        const mode = target.closest("[data-reader-mode-option]");
        if (mode) {
            setMode(mode.dataset.readerModeOption);
            return;
        }
        const speed = target.closest("[data-reader-speed]");
        if (speed) {
            setWpm(speed.dataset.readerSpeed);
            return;
        }
        if (target.closest("[data-reader-restart]")) {
            restart();
            return;
        }
        if (target.closest("[data-reader-back]")) {
            back();
            return;
        }
        if (target.closest("[data-reader-toggle]")) {
            togglePlay();
            return;
        }
        // Pip labels are a pointer shortcut; keyboards use the slider itself.
        const stop = target.closest("[data-spectrum-stop]");
        if (stop) {
            const index = personaIndex(stop.dataset.spectrumStop);
            if (index < 0) return;
            applyPersona(index, { animate: true });
            store(STORAGE.role, PERSONAS[index].id);
        }
    });

    document.addEventListener("keydown", (event) => {
        if (bookingState() === "closed") {
            // Space pauses and ← rewinds, but only when nothing else wants the key.
            if (reader.mode !== "speed" || reader.holds.has("offscreen")) return;
            if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
            const target = event.target instanceof Element ? event.target : null;
            if (target?.closest("input, textarea, select, button, a, [contenteditable]")) return;
            if (event.key === " ") {
                event.preventDefault();
                togglePlay();
            } else if (event.key === "ArrowLeft") {
                event.preventDefault();
                back();
            }
            return;
        }
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

    document.addEventListener("visibilitychange", () => hold("hidden", document.hidden));

    // Don't flash words at someone who has scrolled down to read the posts.
    if (els.reader && "IntersectionObserver" in window) {
        new IntersectionObserver(
            ([entry]) => hold("offscreen", !entry || entry.intersectionRatio < 0.35),
            { threshold: [0, 0.35, 1] },
        ).observe(els.reader);
    }

    // --- boot ------------------------------------------------------------------

    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const storedMode = readStored(STORAGE.mode);

    applyPersona(initialPersonaIndex());
    setWpm(readStored(STORAGE.wpm) ?? DEFAULT_WPM, { remember: false });
    setMode(storedMode === "speed" || storedMode === "read" ? storedMode : reduceMotion ? "read" : "speed", {
        remember: false,
    });
    // Let the first word land before the loop starts moving.
    syncPlayback(START_DELAY_MS);
    renderLocalWindow();
    const initialBook = bookFromUrl();
    if (initialBook) applyBooking(initialBook);
    if (els.reader) els.reader.dataset.readerReady = "true";
    document.documentElement.dataset.coachReady = "true";
})();
