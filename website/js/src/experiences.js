// Web API Experiences — every entry in website/experiences/manifest.toml
// has a matching `register({ id: "..." })` below. The Rust unit test in
// website/src/experiences.rs enforces parity at `cargo test` time.
//
// Architecture (see _docs/web-api-experiences-plan.md):
//   - A single `registry` of entries, each shaped
//     `{ id, name, group, isSupported, init }`.
//   - A per-API `ctx` exposes `log(label, value)` for the receipt,
//     plus shared `defer` / `onInteraction`.
//   - At DOMContentLoaded we run each `init` if `isSupported()` returns
//     true, catching errors. Statuses: unsupported | active | passive |
//     error.
//   - A single collapsed `console.groupCollapsed` prints the receipt.
//     The connective tissue: one easter egg, the API receipt that
//     rewards a reader who opens DevTools.
//   - The brutalist receipt modal (`#api-receipt-modal`) is opened by
//     pressing `?` anywhere on the site. Same data, on-screen.
//
// Hard rule: no `init` invokes a permission-gated API. Anything that
// would surface a prompt (Bluetooth/USB/HID/MIDI/NFC/Geolocation/
// Notifications/IdleDetection/Contacts/ScreenCapture/LocalFontAccess)
// is detect-only — we report support, never request.

const STATUS = {
    UNSUPPORTED: "unsupported",
    ACTIVE: "active",
    PASSIVE: "passive",
    ERROR: "error",
};

const registry = { items: [], byId: new Map() };

function register(entry) {
    registry.items.push(entry);
    registry.byId.set(entry.id, entry);
}

// =============================================================================
// SCAVENGER HUNT — `discoveries` is a localStorage-backed Set of API ids
// the reader has *actively triggered* (clicked Share, dragged the avatar,
// scrolled past 30%, typed the konami code, etc.). The receipt chip in
// the corner shows `⌬ N FOUND`, the modal marks each entry DISCOVERED /
// SUPPORTED / UNSUPPORTED, and a brutalist toast slides in from the
// bottom-right when a new id is added to the set. Discoveries persist.
// =============================================================================

const DISCOVERY_KEY = "engmanager.discoveries";

const discoveries = (() => {
    try {
        const raw = localStorage.getItem(DISCOVERY_KEY);
        return new Set(raw ? JSON.parse(raw) : []);
    } catch {
        return new Set();
    }
})();

function persistDiscoveries() {
    try {
        localStorage.setItem(DISCOVERY_KEY, JSON.stringify([...discoveries]));
    } catch {}
}

const toastQueue = [];
let toastShowing = false;

function showNextToast() {
    if (toastShowing) return;
    const next = toastQueue.shift();
    if (!next) return;
    const root = document.querySelector("[data-discovery-toasts]");
    if (!root) return;
    toastShowing = true;
    const node = document.createElement("div");
    node.className = "discovery-toast";
    node.innerHTML =
        `<span class="discovery-toast-glyph" aria-hidden="true">⌬</span>` +
        `<span class="discovery-toast-tag">Found</span>` +
        `<span class="discovery-toast-name">${escape(next.name)}</span>` +
        `<span class="discovery-toast-count">${discoveries.size}/${registry.items.length}</span>`;
    root.appendChild(node);
    // Force layout, then animate in.
    void node.offsetWidth;
    node.classList.add("is-visible");
    setTimeout(() => {
        node.classList.remove("is-visible");
        node.addEventListener(
            "transitionend",
            () => {
                node.remove();
                toastShowing = false;
                showNextToast();
            },
            { once: true },
        );
    }, 2600);
}

function discover(id) {
    if (discoveries.has(id)) return;
    discoveries.add(id);
    persistDiscoveries();
    const entry = registry.byId.get(id);
    if (entry) entry.discovered = true;
    refreshChip();
    refreshModal();
    if (entry) {
        toastQueue.push({ id, name: entry.name });
        showNextToast();
    }
}

function refreshChip() {
    const chipCount = document.querySelector("[data-hunt-chip-count]");
    if (!chipCount) return;
    const value = String(discoveries.size);
    chipCount.textContent = value;
    // Mirror the count into the attribute value so CSS can dim the
    // badge when nothing has been discovered yet.
    chipCount.dataset.huntChipCount = value;
}

// Background-priority scheduler with rIC fallback.
const defer = (fn) => {
    if ("scheduler" in globalThis && globalThis.scheduler?.postTask) {
        return globalThis.scheduler.postTask(fn, { priority: "background" });
    }
    if ("requestIdleCallback" in globalThis) {
        return globalThis.requestIdleCallback(fn);
    }
    return setTimeout(fn, 0);
};

// First-interaction warm-up hook.
const interactionHandlers = [];
const fireInteraction = () => {
    while (interactionHandlers.length) {
        try { interactionHandlers.shift()(); } catch {}
    }
    ["pointerdown", "keydown", "touchstart"].forEach((ev) =>
        window.removeEventListener(ev, fireInteraction, { capture: true }),
    );
};
["pointerdown", "keydown", "touchstart"].forEach((ev) =>
    window.addEventListener(ev, fireInteraction, { once: true, capture: true }),
);
const onInteraction = (fn) => interactionHandlers.push(fn);

// Soft-navigation re-sync (JS_ROUTER_CONSTRAINTS §2.15). Experiences
// that hold page-scoped references register a hook here; ONE
// window.__engNav.onSwap registration (see the bootstrap at the bottom
// of this file) drains the list after every swap. NOTHING else re-runs
// on a soft navigation — runAll, SW registration, RUM observers and
// every document/window listener execute exactly once per real load.
const softNavHooks = [];
const onSoftNav = (fn) => softNavHooks.push(fn);

const receipt = []; // { api, label, value }

function upsertReceipt(api, label, value) {
    const stringValue = String(value);
    const existing = receipt.find((row) => row.api === api && row.label === label);
    if (existing) {
        existing.value = stringValue;
    } else {
        receipt.push({ api, label, value: stringValue });
    }
}

const rumState = {
    vitals: {},
    navigation: {},
    sentReasons: new Set(),
};

function recordRumMetric(name, value, detail = {}) {
    if (value == null || Number.isNaN(value)) return;
    const rounded = typeof value === "number" ? Math.round(value) : value;
    rumState.vitals[name] = { value: rounded, ...detail };
    upsertReceipt("Web Vitals", name, rounded);
    refreshModal();
}

function sendRum(reason) {
    if (rumState.sentReasons.has(reason)) return;
    rumState.sentReasons.add(reason);
    const payload = JSON.stringify({
        reason,
        path: location.pathname,
        href: location.href,
        visibilityState: document.visibilityState,
        connection: navigator.connection
            ? {
                effectiveType: navigator.connection.effectiveType,
                saveData: navigator.connection.saveData,
                downlink: navigator.connection.downlink,
            }
            : null,
        vitals: rumState.vitals,
        navigation: rumState.navigation,
        sentAt: new Date().toISOString(),
    });
    try {
        if ("sendBeacon" in navigator) {
            const blob = new Blob([payload], { type: "application/json" });
            if (navigator.sendBeacon("/__rum", blob)) return;
        }
        fetch("/__rum", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: payload,
            keepalive: true,
        }).catch(() => {});
    } catch {}
}

function makeCtx(entry) {
    return {
        id: entry.id,
        name: entry.name,
        log: (label, value) => receipt.push({ api: entry.name, label, value: String(value) }),
        defer,
        onInteraction,
        // The experience calls `api.discover()` from inside its trigger
        // handler (e.g. button click). discover() is idempotent —
        // safe to call on every click.
        discover: () => discover(entry.id),
    };
}

async function runAll() {
    // Hydrate previously-discovered ids onto the live entries first
    // so the receipt + chip reflect persisted state from the very
    // first paint.
    for (const id of discoveries) {
        const entry = registry.byId.get(id);
        if (entry) entry.discovered = true;
    }

    for (const entry of registry.items) {
        try {
            if (typeof entry.isSupported === "function" && !entry.isSupported()) {
                entry.status = STATUS.UNSUPPORTED;
                continue;
            }
            if (typeof entry.init !== "function") {
                entry.status = STATUS.PASSIVE;
                continue;
            }
            const result = await entry.init(makeCtx(entry));
            entry.status = result === false ? STATUS.PASSIVE : STATUS.ACTIVE;
        } catch (err) {
            entry.status = STATUS.ERROR;
            entry.error = err?.message ?? String(err);
        }
    }
    defer(() => printReceipt());
    defer(() => renderReceiptModal());
    defer(() => refreshChip());
    defer(() => mountScavengerHooks());
}

function refreshModal() {
    renderReceiptModal();
}

function printReceipt() {
    const total = registry.items.length;
    const supported = registry.items.filter(
        (e) => e.status !== STATUS.UNSUPPORTED,
    ).length;
    const active = registry.items.filter(
        (e) => e.status === STATUS.ACTIVE,
    ).length;

    const header = `%c⌬ engmanager.xyz · ${total} Web APIs · ${supported} supported · ${active} active`;
    const headStyle =
        "font-family:ui-monospace,Menlo,monospace;color:#e64553;font-weight:700;font-size:12px;padding:2px 0";
    console.groupCollapsed(header, headStyle);
    console.log(
        "%cPress ? on the page for the brutalist receipt modal · plan: /_docs/web-api-experiences-plan.md",
        "color:#6c6f85;font-family:ui-monospace,Menlo,monospace;font-size:11px",
    );

    const groups = {};
    for (const e of registry.items) {
        (groups[e.group] ||= []).push(e);
    }
    const groupOrder = [
        "device", "input", "storage", "network", "background",
        "media", "graphics", "security", "pwa", "hardware",
        "privacy", "meta",
    ];
    for (const group of groupOrder) {
        const entries = groups[group];
        if (!entries) continue;
        const groupSupported = entries.filter(
            (e) => e.status !== STATUS.UNSUPPORTED,
        ).length;
        console.groupCollapsed(
            `%c${group.padEnd(10)} %c${entries.length} entries · ${groupSupported} supported`,
            "color:#4c4f69;font-family:ui-monospace,Menlo,monospace;font-weight:700;font-size:11px",
            "color:#8c8fa1;font-family:ui-monospace,Menlo,monospace;font-size:11px",
        );
        for (const e of entries) {
            const glyph =
                e.status === STATUS.ACTIVE
                    ? "●"
                    : e.status === STATUS.PASSIVE
                      ? "○"
                      : e.status === STATUS.ERROR
                        ? "×"
                        : "·";
            const color =
                e.status === STATUS.ACTIVE
                    ? "#40a02b"
                    : e.status === STATUS.PASSIVE
                      ? "#1e66f5"
                      : e.status === STATUS.ERROR
                        ? "#d20f39"
                        : "#9ca0b0";
            console.log(
                `%c${glyph} %c${e.name}`,
                `color:${color};font-family:ui-monospace,Menlo,monospace`,
                "color:#4c4f69;font-family:ui-monospace,Menlo,monospace",
            );
            for (const line of receipt.filter((r) => r.api === e.name)) {
                console.log(
                    `   %c${line.label}: %c${line.value}`,
                    "color:#8c8fa1;font-family:ui-monospace,Menlo,monospace;font-size:10px",
                    "color:#4c4f69;font-family:ui-monospace,Menlo,monospace;font-size:10px",
                );
            }
            if (e.status === STATUS.ERROR && e.error) {
                console.log(
                    `   %cerror: %c${e.error}`,
                    "color:#d20f39;font-family:ui-monospace,Menlo,monospace;font-size:10px",
                    "color:#4c4f69;font-family:ui-monospace,Menlo,monospace;font-size:10px",
                );
            }
        }
        console.groupEnd();
    }
    console.groupEnd();
}

const DISCOVERY_GUIDES = {
    "background-tasks": {
        hint: "Move once, then let the tab sit still for 30 seconds.",
        answer: "You idled after interacting; the background chore clocked in.",
    },
    "broadcast-channel": {
        hint: "Open the homepage twice, then mark an article in one tab.",
        answer: "Another tab heard the visited-article broadcast.",
    },
    "channel-messaging": {
        hint: "Triple-click the receipt glyph. The little sigil has a stash.",
        answer: "The receipt glyph spilled its hidden message-channel bundle.",
    },
    "compression-streams": {
        hint: "Triple-click the receipt glyph; it likes compact secrets.",
        answer: "The glyph stash unlocked the compression helper clue.",
    },
    "css-custom-highlight": {
        hint: "On an article, select a word that appears more than once.",
        answer: "Your selection echoed across matching words.",
    },
    "cssom-view": {
        hint: "Resize the window after the page settles.",
        answer: "The viewport moved; CSSOM View noticed.",
    },
    "encoding": {
        hint: "Triple-click the receipt glyph. Tiny text becomes bytes.",
        answer: "The glyph stash revealed the byte counter.",
    },
    "eyedropper": {
        hint: "On an article, tap the dropper in the toolbar.",
        answer: "You sampled a color and bent the accent to it.",
    },
    "fetch": {
        hint: "Hover an article or nav link; the site sniffs ahead.",
        answer: "A hover-prefetch pulled the thread.",
    },
    "fullscreen": {
        hint: "On an article, hit the fullscreen tool.",
        answer: "The article went big-screen.",
    },
    "html-drag-and-drop": {
        hint: "Drag the floating avatar and leave it somewhere rude.",
        answer: "You dragged the avatar into a new corner.",
    },
    "html-sanitizer": {
        hint: "Triple-click the receipt glyph. It cleans up nicely.",
        answer: "The glyph stash exposed the sanitizer probe.",
    },
    "intersection-observer": {
        hint: "Scroll past the deep marker. Keep going.",
        answer: "You crossed the scroll tripwire.",
    },
    "invoker-commands": {
        hint: "Enter the old-school code: up up down down left right left right B A.",
        answer: "The Konami route opened the command cabinet.",
    },
    "keyboard": {
        hint: "Press ? anywhere outside a form field.",
        answer: "You opened the receipt from the keyboard.",
    },
    "page-visibility": {
        hint: "Switch away from the tab, then come back.",
        answer: "You vanished from the page and returned.",
    },
    "pointer-events": {
        hint: "Triple-click anywhere, or long-press on touch.",
        answer: "Three quick clicks woke the pointer stack.",
    },
    "popover": {
        hint: "Press ? or poke the receipt chip.",
        answer: "This popover receipt is the scene of the crime.",
    },
    "prioritized-task-scheduling": {
        hint: "Interact once, then let the tab breathe for 30 seconds.",
        answer: "The post-interaction idle task got scheduled.",
    },
    "reporting": {
        hint: "Enter the Konami code. Yes, that one.",
        answer: "The Konami route revealed the reporting shelf.",
    },
    "resize-observer": {
        hint: "Resize the window after the page settles.",
        answer: "The layout watcher caught the resize.",
    },
    "screen-wake-lock": {
        hint: "Read 30% down an article. Commitment has perks.",
        answer: "The reader lock kept the screen awake.",
    },
    "selection": {
        hint: "On an article, highlight a repeat word.",
        answer: "Your selected text became the signal.",
    },
    "speculation-rules": {
        hint: "Hover article links or navigate between pages.",
        answer: "The page peeked ahead before you arrived.",
    },
    "touch-events": {
        hint: "On a touch screen, long-press the page.",
        answer: "A long press on glass found it.",
    },
    "trusted-types": {
        hint: "Enter the Konami code; the safety gear is hidden there.",
        answer: "The Konami route checked the trusted-types lock.",
    },
    "ui-events": {
        hint: "Triple-click anywhere. Loudly enough for the DOM to hear.",
        answer: "A click streak lit up the UI event trail.",
    },
    "url-fragment-text-directives": {
        hint: "Find an article quote and tap Share quote.",
        answer: "You minted a link straight to the quote.",
    },
    "vibration": {
        hint: "Tap a homepage article check on a device that can buzz.",
        answer: "The checkbox gave a tiny haptic nod.",
    },
    "view-transition": {
        hint: "Navigate between pages; let the scene swap do its trick.",
        answer: "A page transition carried you across.",
    },
    "web-audio": {
        hint: "Tap the first homepage article check and listen close.",
        answer: "The checkbox chirped a tiny square-wave beep.",
    },
    "web-crypto": {
        hint: "Triple-click the receipt glyph, or inspect an article hash.",
        answer: "The glyph stash revealed the crypto hash work.",
    },
    "web-locks": {
        hint: "Triple-click the receipt glyph. This one likes exclusivity.",
        answer: "The glyph stash showed the brief init lock.",
    },
    "web-share": {
        hint: "On an article, tap the share tool.",
        answer: "The native share sheet opened from the article.",
    },
    "web-speech": {
        hint: "On an article, hit Read aloud.",
        answer: "The browser started narrating the article.",
    },
    "web-workers": {
        hint: "Triple-click the receipt glyph, then look for hash work.",
        answer: "The glyph stash pointed at the hash worker.",
    },
};

const DISCOVERY_GROUP_GUIDES = {
    background: {
        hint: (name) => `Look behind the page: ${name} hides in background support.`,
        answer: (name) => `The background probe found ${name} waiting backstage.`,
    },
    device: {
        hint: (name) => `Bring the right device/browser; ${name} lives in hardware tells.`,
        answer: (name) => `The device probe spotted ${name} in the cabinet.`,
    },
    graphics: {
        hint: (name) => `Watch the surface: ${name} is tucked into paint, layout, or motion.`,
        answer: (name) => `The visual layer gave up ${name}.`,
    },
    hardware: {
        hint: (name) => `Hardware shelf: ${name} appears only when the browser exposes it.`,
        answer: (name) => `The hardware probe saw ${name}; no scary prompt fired.`,
    },
    input: {
        hint: (name) => `Hands on the page: click, type, select, drag, or tap for ${name}.`,
        answer: (name) => `Your input trail led to ${name}.`,
    },
    media: {
        hint: (name) => `Media shelf: ${name} shows up around sound, canvas, video, or voice.`,
        answer: (name) => `The media probe caught ${name} in the stack.`,
    },
    meta: {
        hint: (name) => `Site machinery: ${name} is tucked into receipts, popovers, or navigation.`,
        answer: (name) => `The site machinery exposed ${name}.`,
    },
    network: {
        hint: (name) => `Follow the URLs: ${name} hides in links, requests, and exits.`,
        answer: (name) => `The network trail led to ${name}.`,
    },
    privacy: {
        hint: (name) => `Privacy vault: ${name} is support-checked, not poked.`,
        answer: (name) => `The privacy probe found ${name} without opening the vault.`,
    },
    pwa: {
        hint: (name) => `App-shell shelf: ${name} lights up in install-minded browsers.`,
        answer: (name) => `The PWA probe found ${name} in the app shell.`,
    },
    security: {
        hint: (name) => `Security drawer: ${name} appears in hashes, policies, or credentials.`,
        answer: (name) => `The security probe found ${name} locked and labeled.`,
    },
    storage: {
        hint: (name) => `State stash: ${name} hides where visits and preferences stick.`,
        answer: (name) => `The storage stash gave up ${name}.`,
    },
};

function apiGuideName(entry) {
    return entry.name
        .replace(/\s*\([^)]*\)/g, "")
        .replace(/\s+API$/i, "")
        .replace(/\s+APIs$/i, "")
        .trim();
}

function discoveryGuideFor(entry) {
    const exact = DISCOVERY_GUIDES[entry.id];
    if (exact) return exact;
    const fallback = DISCOVERY_GROUP_GUIDES[entry.group] || DISCOVERY_GROUP_GUIDES.meta;
    const name = apiGuideName(entry);
    return {
        hint: fallback.hint(name),
        answer: fallback.answer(name),
    };
}

function renderGuideButton(entry) {
    const guide = discoveryGuideFor(entry);
    const tooltipId = `api-hint-${entry.id}`;
    const ariaLabel = entry.discovered
        ? `Hint for ${entry.name}. ${guide.hint} Answer: ${guide.answer}`
        : `Hint for ${entry.name}. ${guide.hint}`;
    const answer = entry.discovered
        ? `<span class="api-cell-tooltip-label">Answer</span>` +
          `<span class="api-cell-tooltip-text">${escape(guide.answer)}</span>`
        : "";
    return `<button class="api-cell-hint" type="button" ` +
        `aria-label="${escape(ariaLabel)}" aria-describedby="${escape(tooltipId)}">` +
        `<span aria-hidden="true">?</span>` +
        `<span class="api-cell-tooltip" role="tooltip" id="${escape(tooltipId)}">` +
        `<span class="api-cell-tooltip-label">Hint</span>` +
        `<span class="api-cell-tooltip-text">${escape(guide.hint)}</span>` +
        answer +
        `</span></button>`;
}

// Renders the brutalist on-page receipt modal (Popover API). Triggered
// by pressing `?` anywhere on the page. The modal lives in both layouts
// at #api-receipt-modal and is populated by this function.
function renderReceiptModal() {
    const modal = document.getElementById("api-receipt-modal");
    if (!modal) return;

    const statsEl = modal.querySelector("[data-api-receipt-stats]");
    const gridEl = modal.querySelector("[data-api-receipt-grid]");
    if (!statsEl || !gridEl) return;

    const total = registry.items.length;
    const supported = registry.items.filter(
        (e) => e.status !== STATUS.UNSUPPORTED,
    ).length;
    const active = registry.items.filter(
        (e) => e.status === STATUS.ACTIVE,
    ).length;

    const discoveredCount = registry.items.filter((e) => e.discovered).length;
    statsEl.innerHTML =
        `<span><strong>${discoveredCount}</strong>/${total} found</span>` +
        `<span><strong>${supported}</strong> supported</span>` +
        `<span><strong>${active}</strong> active</span>`;

    const groups = {};
    for (const e of registry.items) (groups[e.group] ||= []).push(e);
    const order = [
        "device", "input", "storage", "network", "background",
        "media", "graphics", "security", "pwa", "hardware",
        "privacy", "meta",
    ];
    const parts = [];
    for (const group of order) {
        const entries = groups[group];
        if (!entries) continue;
        const items = entries
            .map((e) => {
                const cls = `api-cell api-cell-${e.status}${e.discovered ? " api-cell-discovered" : ""}`;
                const lines = receipt
                    .filter((r) => r.api === e.name)
                    .map((r) => `${r.label}: ${r.value}`)
                    .join(" · ");
                const check = `<span class="api-cell-check" aria-hidden="true">` +
                    `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" ` +
                    `stroke-width="3" stroke-linecap="round" stroke-linejoin="round">` +
                    `<path d="M3 8 L7 12 L13 4"/></svg></span>`;
                return `<li class="${cls}" data-api-id="${escape(e.id)}">` +
                    `${renderGuideButton(e)}<div class="api-cell-row">${check}` +
                    `<span class="api-cell-name">${escape(e.name)}</span></div>` +
                    `${lines ? `<span class="api-cell-meta">${escape(lines)}</span>` : ""}</li>`;
            })
            .join("");
        parts.push(
            `<section class="api-section"><h3 class="api-section-title">${escape(group)}</h3><ul class="api-section-list">${items}</ul></section>`,
        );
    }
    gridEl.innerHTML = parts.join("");
}

function escape(s) {
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

// Receipt modal lifecycle.
//
//   - `?` anywhere on the page toggles the modal (ignored when an
//     input is focused).
//   - `?receipt` in the URL on load opens the modal automatically —
//     deep-linkable.
//   - Opening/closing the modal pushes/pops the `?receipt` query param
//     so a shared URL re-opens for the recipient.
//   - popstate (back/forward) syncs the modal to the URL.
const RECEIPT_PARAM = "receipt";

function urlHasReceipt() {
    try {
        return new URL(location.href).searchParams.has(RECEIPT_PARAM);
    } catch {
        return false;
    }
}

function setReceiptInUrl(open) {
    try {
        const url = new URL(location.href);
        if (open) url.searchParams.set(RECEIPT_PARAM, "");
        else url.searchParams.delete(RECEIPT_PARAM);
        // Use `replaceState` for toggles within the same page so we
        // don't pile up history entries; `pushState` only when opening
        // from a fresh URL so back-button closes.
        if (open && !urlHasReceipt()) history.pushState({}, "", url);
        else history.replaceState({}, "", url);
    } catch {}
}

function openReceipt() {
    const modal = document.getElementById("api-receipt-modal");
    if (!modal || modal.matches(":popover-open")) return;
    modal.showPopover();
}

function closeReceipt() {
    const modal = document.getElementById("api-receipt-modal");
    if (!modal || !modal.matches(":popover-open")) return;
    modal.hidePopover();
}

window.addEventListener("keydown", (event) => {
    if (event.key !== "?" && event.key !== "/") return;
    const tag = document.activeElement?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (document.activeElement?.isContentEditable) return;
    const modal = document.getElementById("api-receipt-modal");
    if (!modal) return;
    event.preventDefault();
    if (modal.matches(":popover-open")) closeReceipt();
    else openReceipt();
});

window.addEventListener("popstate", () => {
    const should = urlHasReceipt();
    const modal = document.getElementById("api-receipt-modal");
    if (!modal) return;
    const isOpen = modal.matches(":popover-open");
    if (should && !isOpen) modal.showPopover();
    else if (!should && isOpen) modal.hidePopover();
});

// Bind the URL-sync toggle listener to the CURRENT modal node. The modal
// lives inside data-swap-region="receipt", so every soft navigation replaces
// the node and drops its listeners — same lifecycle as the nav cluster.
// Re-resolved lazily with a data-bound guard (JS_ROUTER_CONSTRAINTS §2.15);
// the `?` keydown and popstate handlers above already re-resolve by id per
// event, so only this per-node binding needs the re-bind.
function bindReceiptModal() {
    const modal = document.getElementById("api-receipt-modal");
    if (!modal || modal.dataset.receiptBound) return modal;
    modal.dataset.receiptBound = "true";
    // Sync URL ↔ modal whenever the popover toggles itself (close
    // button, Esc, outside click, our showPopover/hidePopover calls).
    modal.addEventListener("toggle", (event) => {
        setReceiptInUrl(event.newState === "open");
    });
    return modal;
}

document.addEventListener("DOMContentLoaded", () => {
    const modal = bindReceiptModal();
    if (!modal) return;
    // Deep-link entry.
    if (urlHasReceipt()) {
        // Wait one frame so renderReceiptModal has had a chance to
        // populate before we show the dialog.
        requestAnimationFrame(() => modal.showPopover());
    }
});

// Soft navigation: the swapped-in receipt region arrives server-fresh
// (unbound, unpopulated, closed; an OPEN modal that gets swapped out is
// hidden by the platform without firing toggle, so no stray URL write).
// Re-bind, re-render receipt + chip from live state, then sync the popover
// to the URL — a traversal back to a `?receipt` entry must re-open it.
onSoftNav(() => {
    const modal = bindReceiptModal();
    renderReceiptModal();
    refreshChip();
    if (!modal) return;
    const should = urlHasReceipt();
    const isOpen = modal.matches(":popover-open");
    if (should && !isOpen) modal.showPopover();
    else if (!should && isOpen) modal.hidePopover();
});

// =============================================================================
// REGISTRATIONS — alphabetical by name to match the user's source list.
// =============================================================================

// --- Attribution Reporting ---
register({
    id: "attribution-reporting",
    name: "Attribution Reporting API",
    group: "privacy",
    isSupported: () => "attributionReporting" in document,
});

// --- Audio Output Devices ---
register({
    id: "audio-output-devices",
    name: "Audio Output Devices API",
    group: "media",
    isSupported: () => "setSinkId" in HTMLMediaElement.prototype,
});

// --- Audio Session ---
register({
    id: "audio-session",
    name: "Audio Session API",
    group: "media",
    isSupported: () => "audioSession" in navigator,
});

// --- Background Fetch ---
register({
    id: "background-fetch",
    name: "Background Fetch API",
    group: "background",
    isSupported: () =>
        "serviceWorker" in navigator &&
        "BackgroundFetchManager" in globalThis,
});

// --- Background Synchronization ---
register({
    id: "background-synchronization",
    name: "Background Synchronization API",
    group: "background",
    isSupported: () =>
        "serviceWorker" in navigator && "SyncManager" in globalThis,
});

// --- Background Tasks ---
register({
    id: "background-tasks",
    name: "Background Tasks API",
    group: "background",
    isSupported: () => "requestIdleCallback" in globalThis,
    init: (api) => {
        api.log("rIC", "available");
    },
});

// --- Badging ---
register({
    id: "badging",
    name: "Badging API",
    group: "pwa",
    isSupported: () => "setAppBadge" in navigator,
});

// --- Barcode Detection ---
register({
    id: "barcode-detection",
    name: "Barcode Detection API",
    group: "meta",
    isSupported: () => "BarcodeDetector" in globalThis,
    init: async (api) => {
        try {
            const formats = await BarcodeDetector.getSupportedFormats();
            api.log("formats", formats.length);
        } catch {}
    },
});

// --- Battery Status ---
register({
    id: "battery-status",
    name: "Battery Status API",
    group: "device",
    isSupported: () => "getBattery" in navigator,
    init: async (api) => {
        const b = await navigator.getBattery();
        api.log("level", `${Math.round(b.level * 100)}%${b.charging ? " ⚡" : ""}`);
        if (b.level < 0.2 && !b.charging) {
            document.body.dataset.battery = "low";
        }
    },
});

// --- Beacon ---
register({
    id: "beacon",
    name: "Beacon API",
    group: "network",
    isSupported: () => "sendBeacon" in navigator,
    init: (api) => {
        // Send a tiny ping on pagehide so the API is actually exercised.
        const sent = { value: false };
        window.addEventListener("pagehide", () => {
            // A discarded speculative prerender fires pagehide too —
            // never beacon from a page that was never shown
            // (JS_ROUTER_CONSTRAINTS §3).
            if (document.prerendering) return;
            if (sent.value) return;
            try {
                const payload = JSON.stringify({
                    p: location.pathname,
                    t: Date.now(),
                });
                navigator.sendBeacon("/health", payload);
                sent.value = true;
            } catch {}
        });
        api.log("target", "/health");
    },
});

// --- Broadcast Channel ---
register({
    id: "broadcast-channel",
    name: "Broadcast Channel API",
    group: "meta",
    isSupported: () => "BroadcastChannel" in globalThis,
    init: (api) => {
        // Sync visited-articles state across open tabs in real time.
        // When this tab adds a slug to visited, broadcast; other tabs
        // apply the strike-through immediately.
        const channel = new BroadcastChannel("engmanager.visited");
        channel.addEventListener("message", (event) => {
            const slug = event.data?.slug;
            if (!slug) return;
            document
                .querySelectorAll(`.article-fluid-link[data-slug="${CSS.escape(slug)}"]`)
                .forEach((link) => link.classList.add("is-visited"));
            // Receiving from another tab proves cross-tab sync works.
            api.discover();
        });
        // Hook into the existing click handler by listening for our
        // own custom event dispatched by visited-articles.js.
        document.addEventListener("engmanager:visited", (event) => {
            try {
                channel.postMessage({ slug: event.detail?.slug });
            } catch {}
        });
        api.log("channel", "engmanager.visited");
    },
});

// --- CSS Custom Highlight ---
register({
    id: "css-custom-highlight",
    name: "CSS Custom Highlight API",
    group: "graphics",
    isSupported: () => "Highlight" in globalThis && "highlights" in CSS,
    init: (api) => {
        // On selection inside an article body, paint every other
        // occurrence of the selected word with a custom highlight.
        // `article` is page-scoped: soft navigations re-query it
        // (JS_ROUTER_CONSTRAINTS §2.15c). setUp() runs at most once —
        // on a non-article first load it is deferred until a swap
        // first lands on an article page.
        let article = document.querySelector(".article");
        let ready = false;
        const setUp = () => {
            if (ready) return;
            ready = true;
            const highlight = new Highlight();
            CSS.highlights.set("engmanager-echo", highlight);
            document.addEventListener("selectionchange", () => {
                if (!article) return;
                const sel = document.getSelection();
                highlight.clear();
                if (!sel || sel.isCollapsed) return;
                const text = sel.toString().trim();
                if (text.length < 3) return;
                const walker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT);
                const needle = text.toLowerCase();
                let matches = 0;
                let node;
                while ((node = walker.nextNode())) {
                    const haystack = node.nodeValue.toLowerCase();
                    let from = 0;
                    while ((from = haystack.indexOf(needle, from)) !== -1) {
                        try {
                            const range = new Range();
                            range.setStart(node, from);
                            range.setEnd(node, from + needle.length);
                            highlight.add(range);
                            matches++;
                        } catch {}
                        from += needle.length;
                    }
                }
                // Selection echo with multiple matches → user is using the
                // highlight feature, not just selecting one word.
                if (matches > 1) api.discover();
            });
            api.log("registry", "engmanager-echo");
        };

        onSoftNav((root) => {
            article = root.querySelector(".article");
            if (article) setUp();
        });

        if (!article) return false;
        setUp();
    },
});

// --- CSS Font Loading ---
register({
    id: "css-font-loading",
    name: "CSS Font Loading API",
    group: "graphics",
    isSupported: () => "fonts" in document,
    init: async (api) => {
        await document.fonts.ready;
        api.log("status", document.fonts.status);
        api.log("families", document.fonts.size);
    },
});

// --- CSS Painting ---
register({
    id: "css-painting",
    name: "CSS Painting API",
    group: "graphics",
    isSupported: () => "paintWorklet" in CSS,
    init: async (api) => {
        const url = window.__engUrls?.paintHatch;
        if (!url) return false;
        await CSS.paintWorklet.addModule(url);
        document.body.dataset.paint = "hatch";
        api.log("worklet", "brutalist-hatch");
    },
});

// --- CSS Properties and Values ---
register({
    id: "css-properties-and-values",
    name: "CSS Properties and Values API",
    group: "graphics",
    isSupported: () => "registerProperty" in CSS,
    init: (api) => {
        // Already registered statically in critical.css. Re-register
        // is a no-op (browsers throw, we swallow).
        try {
            CSS.registerProperty({
                name: "--engmanager-pulse",
                syntax: "<number>",
                inherits: false,
                initialValue: "0",
            });
        } catch {}
        api.log("registered", "--engmanager-pulse");
    },
});

// --- CSS Typed Object Model ---
register({
    id: "css-typed-object-model",
    name: "CSS Typed Object Model API",
    group: "graphics",
    isSupported: () => "computedStyleMap" in Element.prototype,
    init: (api) => {
        const root = document.documentElement;
        try {
            const accent = root.computedStyleMap().get("--accent");
            api.log("--accent", accent?.toString() ?? "unset");
        } catch {}
    },
});

// --- CSSOM ---
register({
    id: "cssom",
    name: "CSS Object Model (CSSOM)",
    group: "graphics",
    isSupported: () => "styleSheets" in document,
    init: (api) => {
        api.log("sheets", document.styleSheets.length);
    },
});

// --- CSSOM view ---
register({
    id: "cssom-view",
    name: "CSSOM view API",
    group: "graphics",
    isSupported: () => "visualViewport" in window,
    init: (api) => {
        const vv = window.visualViewport;
        api.log("viewport", `${Math.round(vv.width)}×${Math.round(vv.height)}`);
    },
});

// --- Canvas ---
register({
    id: "canvas",
    name: "Canvas API",
    group: "media",
    isSupported: () => !!document.createElement("canvas").getContext,
    init: (api) => {
        // The auteurs article ships a real WebGL canvas; here we
        // just confirm 2D context availability.
        const ctx = document.createElement("canvas").getContext("2d");
        api.log("ctx", ctx ? "2d" : "none");
    },
});

// --- Channel Messaging ---
register({
    id: "channel-messaging",
    name: "Channel Messaging API",
    group: "meta",
    isSupported: () => "MessageChannel" in globalThis,
    init: (api) => {
        // Round-trip a single message through a MessageChannel to
        // prove it works without spawning a worker.
        const channel = new MessageChannel();
        return new Promise((resolve) => {
            channel.port1.onmessage = (event) => {
                api.log("roundtrip", `${event.data} µs`);
                resolve();
            };
            const start = performance.now();
            channel.port2.postMessage(`${Math.round((performance.now() - start) * 1000)}`);
        });
    },
});

// --- Clipboard ---
register({
    id: "clipboard",
    name: "Clipboard API",
    group: "input",
    isSupported: () => "clipboard" in navigator,
    init: (api) => {
        // copy-code.js already uses this. We just report support.
        api.log("read", "clipboard.readText" in navigator.clipboard ? "yes" : "no");
        api.log("write", "clipboard.writeText" in navigator.clipboard ? "yes" : "no");
    },
});

// --- Compression Streams ---
register({
    id: "compression-streams",
    name: "Compression Streams API",
    group: "meta",
    isSupported: () => "CompressionStream" in globalThis,
    init: (api) => {
        // Hidden helper for console-spelunkers.
        window.__compress = async (text) => {
            const stream = new Response(
                new Blob([text]).stream().pipeThrough(new CompressionStream("gzip")),
            ).arrayBuffer();
            const buf = new Uint8Array(await stream);
            return btoa(String.fromCharCode(...buf));
        };
        api.log("helper", "window.__compress(text)");
    },
});

// --- Compute Pressure ---
register({
    id: "compute-pressure",
    name: "Compute Pressure API",
    group: "device",
    isSupported: () => "PressureObserver" in globalThis,
});

// --- Console ---
register({
    id: "console",
    name: "Console API",
    group: "meta",
    isSupported: () => "console" in globalThis,
    init: (api) => {
        api.log("output", "this very receipt");
    },
});

// --- Contact Picker ---
register({
    id: "contact-picker",
    name: "Contact Picker API",
    group: "input",
    isSupported: () => "contacts" in navigator && "ContactsManager" in globalThis,
});

// --- Content Index ---
register({
    id: "content-index",
    name: "Content Index API",
    group: "pwa",
    isSupported: () =>
        "serviceWorker" in navigator &&
        "index" in (navigator.serviceWorker || {}),
});

// --- Cookie Store ---
register({
    id: "cookie-store",
    name: "Cookie Store API",
    group: "storage",
    isSupported: () => "cookieStore" in globalThis,
    init: async (api) => {
        try {
            await cookieStore.set({
                name: "eng-last-visit",
                value: new Date().toISOString(),
                sameSite: "lax",
                expires: Date.now() + 1000 * 60 * 60 * 24 * 30,
            });
            const cookie = await cookieStore.get("eng-last-visit");
            api.log("last-visit", cookie?.value?.slice(0, 19) || "unset");
        } catch (err) {
            api.log("error", err.message);
        }
    },
});

// --- Credential Management ---
register({
    id: "credential-management",
    name: "Credential Management API",
    group: "security",
    isSupported: () => "credentials" in navigator,
});

// --- DOM ---
register({
    id: "dom",
    name: "Document Object Model (DOM)",
    group: "meta",
    isSupported: () => "document" in globalThis,
    init: (api) => {
        api.log("nodes", document.querySelectorAll("*").length);
    },
});

// --- Device Memory ---
register({
    id: "device-memory",
    name: "Device Memory API",
    group: "device",
    isSupported: () => "deviceMemory" in navigator,
    init: (api) => {
        const mem = navigator.deviceMemory;
        api.log("deviceMemory", `${mem} GB`);
        if (mem < 4) document.body.dataset.memory = "low";
    },
});

// --- Device orientation events ---
register({
    id: "device-orientation-events",
    name: "Device orientation events",
    group: "device",
    isSupported: () => "DeviceOrientationEvent" in globalThis,
});

// --- Device Posture ---
register({
    id: "device-posture",
    name: "Device Posture API",
    group: "device",
    isSupported: () => "devicePosture" in navigator,
    init: (api) => {
        api.log("posture", navigator.devicePosture.type);
    },
});

// --- Document Picture-in-Picture ---
register({
    id: "document-picture-in-picture",
    name: "Document Picture-in-Picture API",
    group: "media",
    isSupported: () => "documentPictureInPicture" in globalThis,
    init: (api) => {
        // Surfaces a "Pop out" button on article pages (see article-meta
        // toolbar). Here we just confirm support.
        api.log("api", "documentPictureInPicture.requestWindow");
    },
});

// --- EditContext ---
register({
    id: "edit-context",
    name: "EditContext API",
    group: "input",
    isSupported: () => "EditContext" in globalThis,
});

// --- Encoding ---
register({
    id: "encoding",
    name: "Encoding API",
    group: "security",
    isSupported: () => "TextEncoder" in globalThis,
    init: (api) => {
        const bytes = new TextEncoder().encode("engmanager.xyz").length;
        api.log("encoded", `${bytes} bytes`);
    },
});

// --- Encrypted Media Extensions ---
register({
    id: "encrypted-media-extensions",
    name: "Encrypted Media Extensions API",
    group: "media",
    isSupported: () => "requestMediaKeySystemAccess" in navigator,
});

// --- EyeDropper ---
register({
    id: "eyedropper",
    name: "EyeDropper API",
    group: "input",
    isSupported: () => "EyeDropper" in globalThis,
    init: (api) => {
        // Wires to the article-meta toolbar button if present.
        const button = document.querySelector("[data-eyedropper]");
        if (button) {
            button.hidden = false;
            button.addEventListener("click", async () => {
                try {
                    const result = await new EyeDropper().open();
                    document.documentElement.style.setProperty(
                        "--accent",
                        result.sRGBHex,
                    );
                    console.log(
                        `%c⌬ EyeDropper picked %c${result.sRGBHex}`,
                        "color:#8c8fa1;font-family:ui-monospace,Menlo,monospace",
                        `color:${result.sRGBHex};font-weight:700;font-family:ui-monospace,Menlo,monospace`,
                    );
                    api.discover();
                } catch {}
            });
        }
        api.log("status", "ready");
    },
});

// --- Federated Credential Management ---
register({
    id: "federated-credential-management",
    name: "Federated Credential Management (FedCM) API",
    group: "security",
    isSupported: () =>
        "credentials" in navigator && "IdentityCredential" in globalThis,
});

// --- Fenced Frame ---
register({
    id: "fenced-frame",
    name: "Fenced Frame API",
    group: "security",
    isSupported: () => "HTMLFencedFrameElement" in globalThis,
});

// --- Fetch ---
register({
    id: "fetch",
    name: "Fetch API",
    group: "network",
    isSupported: () => "fetch" in globalThis,
    init: (api) => {
        api.log("server", "discord widget proxy");
    },
});

// --- File ---
register({
    id: "file",
    name: "File API",
    group: "storage",
    isSupported: () => "File" in globalThis && "FileReader" in globalThis,
});

// --- File System ---
register({
    id: "file-system",
    name: "File System API",
    group: "storage",
    isSupported: () => "showOpenFilePicker" in globalThis,
});

// --- File and Directory Entries ---
register({
    id: "file-and-directory-entries",
    name: "File and Directory Entries API",
    group: "storage",
    isSupported: () => "FileSystemEntry" in globalThis,
});

// --- Force Touch events ---
register({
    id: "force-touch-events",
    name: "Force Touch events",
    group: "input",
    isSupported: () => "webkitForce" in MouseEvent.prototype,
});

// --- Fullscreen ---
register({
    id: "fullscreen",
    name: "Fullscreen API",
    group: "meta",
    isSupported: () => "requestFullscreen" in Element.prototype,
    init: (api) => {
        const button = document.querySelector("[data-fullscreen]");
        const target = document.querySelector(".article");
        if (button && target) {
            button.hidden = false;
            button.addEventListener("click", () => {
                if (document.fullscreenElement) document.exitFullscreen();
                else target.requestFullscreen?.();
                api.discover();
            });
        }
        api.log("target", target ? "article" : "—");
    },
});

// --- Gamepad ---
register({
    id: "gamepad",
    name: "Gamepad API",
    group: "input",
    isSupported: () => "getGamepads" in navigator,
    init: (api) => {
        const pads = navigator.getGamepads?.().filter(Boolean) ?? [];
        api.log("connected", pads.length);
    },
});

// --- Geolocation ---
register({
    id: "geolocation",
    name: "Geolocation API",
    group: "hardware",
    isSupported: () => "geolocation" in navigator,
    // Detect-only: never auto-prompt.
});

// --- Geometry interfaces ---
register({
    id: "geometry-interfaces",
    name: "Geometry interfaces",
    group: "graphics",
    isSupported: () => "DOMRect" in globalThis,
    init: (api) => {
        api.log("used", "fit-text.js getBoundingClientRect");
    },
});

// --- HTML DOM API ---
register({
    id: "html-dom",
    name: "HTML DOM API",
    group: "meta",
    isSupported: () => "HTMLElement" in globalThis,
});

// --- HTML Drag and Drop ---
register({
    id: "html-drag-and-drop",
    name: "HTML Drag and Drop API",
    group: "input",
    isSupported: () => "draggable" in HTMLElement.prototype,
    init: (api) => {
        // Bottom-right avatar becomes draggable; position persists.
        const button = document.querySelector(".avatar-button");
        if (!button) return false;
        button.draggable = true;
        const STORAGE = "engmanager.avatar-position";
        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE) || "null");
            if (saved && typeof saved.x === "number") {
                button.style.right = "auto";
                button.style.bottom = "auto";
                button.style.left = `${saved.x}px`;
                button.style.top = `${saved.y}px`;
            }
        } catch {}
        let offsetX = 0;
        let offsetY = 0;
        button.addEventListener("dragstart", (event) => {
            const rect = button.getBoundingClientRect();
            offsetX = event.clientX - rect.left;
            offsetY = event.clientY - rect.top;
            try {
                event.dataTransfer.setDragImage(new Image(), 0, 0);
            } catch {}
        });
        button.addEventListener("dragend", (event) => {
            if (!event.clientX && !event.clientY) return;
            const x = Math.max(8, event.clientX - offsetX);
            const y = Math.max(8, event.clientY - offsetY);
            button.style.right = "auto";
            button.style.bottom = "auto";
            button.style.left = `${x}px`;
            button.style.top = `${y}px`;
            try {
                localStorage.setItem(STORAGE, JSON.stringify({ x, y }));
            } catch {}
            api.discover();
        });
        api.log("target", ".avatar-button");
    },
});

// --- HTML Sanitizer ---
register({
    id: "html-sanitizer",
    name: "HTML Sanitizer API",
    group: "security",
    isSupported: () => "Sanitizer" in globalThis,
    init: (api) => {
        try {
            const tmp = document.createElement("div");
            tmp.setHTML?.('<img src=x onerror=alert(1)><p>ok</p>');
            api.log("removed", "onerror handler");
        } catch {}
    },
});

// --- History ---
register({
    id: "history",
    name: "History API",
    group: "meta",
    isSupported: () => "history" in window,
    init: (api) => {
        api.log("length", history.length);
    },
});

// --- Houdini APIs ---
register({
    id: "houdini-apis",
    name: "Houdini APIs",
    group: "graphics",
    isSupported: () =>
        "registerProperty" in CSS || "paintWorklet" in CSS,
    init: (api) => {
        const features = [];
        if ("paintWorklet" in CSS) features.push("paint");
        if ("registerProperty" in CSS) features.push("properties");
        if ("animationWorklet" in CSS) features.push("animation");
        api.log("worklets", features.join(", ") || "none");
    },
});

// --- Idle Detection ---
register({
    id: "idle-detection",
    name: "Idle Detection API",
    group: "hardware",
    isSupported: () => "IdleDetector" in globalThis,
    // Detect-only: requires user permission.
});

// --- IndexedDB ---
register({
    id: "indexeddb",
    name: "IndexedDB API",
    group: "storage",
    isSupported: () => "indexedDB" in globalThis,
});

// --- Ink ---
register({
    id: "ink",
    name: "Ink API",
    group: "input",
    isSupported: () => "ink" in navigator,
});

// --- InputDeviceCapabilities ---
register({
    id: "input-device-capabilities",
    name: "InputDeviceCapabilities API",
    group: "input",
    isSupported: () => "InputDeviceCapabilities" in globalThis,
});

// --- Insertable Streams for MediaStreamTrack ---
register({
    id: "insertable-streams",
    name: "Insertable Streams for MediaStreamTrack API",
    group: "media",
    isSupported: () => "MediaStreamTrackProcessor" in globalThis,
});

// --- Intersection Observer ---
register({
    id: "intersection-observer",
    name: "Intersection Observer API",
    group: "graphics",
    isSupported: () => "IntersectionObserver" in globalThis,
    init: (api) => {
        api.log("used", "c-article-toc.js");
    },
});

// --- Invoker Commands ---
register({
    id: "invoker-commands",
    name: "Invoker Commands API",
    group: "meta",
    isSupported: () => "command" in HTMLButtonElement.prototype,
});

// --- JS Self-Profiling ---
register({
    id: "js-self-profiling",
    name: "JS Self-Profiling API",
    group: "background",
    isSupported: () => "Profiler" in globalThis,
});

// --- Keyboard ---
register({
    id: "keyboard",
    name: "Keyboard API",
    group: "input",
    isSupported: () => "keyboard" in navigator,
});

// --- Launch Handler ---
register({
    id: "launch-handler",
    name: "Launch Handler API",
    group: "pwa",
    isSupported: () => "launchQueue" in globalThis,
});

// --- Local Font Access ---
register({
    id: "local-font-access",
    name: "Local Font Access API",
    group: "hardware",
    isSupported: () => "queryLocalFonts" in globalThis,
});

// --- MediaStream Image Capture ---
register({
    id: "mediastream-image-capture",
    name: "MediaStream Image Capture API",
    group: "media",
    isSupported: () => "ImageCapture" in globalThis,
});

// --- Media Capabilities ---
register({
    id: "media-capabilities",
    name: "Media Capabilities API",
    group: "media",
    isSupported: () => "mediaCapabilities" in navigator,
});

// --- Media Capture and Streams ---
register({
    id: "media-capture-and-streams",
    name: "Media Capture and Streams API",
    group: "media",
    isSupported: () => "mediaDevices" in navigator,
});

// --- Media Session ---
register({
    id: "media-session",
    name: "Media Session API",
    group: "media",
    isSupported: () => "mediaSession" in navigator,
});

// --- Media Source ---
register({
    id: "media-source",
    name: "Media Source API",
    group: "media",
    isSupported: () => "MediaSource" in globalThis,
});

// --- MediaStream Recording ---
register({
    id: "mediastream-recording",
    name: "MediaStream Recording API",
    group: "media",
    isSupported: () => "MediaRecorder" in globalThis,
});

// --- Navigation ---
register({
    id: "navigation",
    name: "Navigation API",
    group: "meta",
    isSupported: () => "navigation" in globalThis,
    init: (api) => {
        let count = 0;
        navigation.addEventListener("navigate", () => {
            count++;
            api.log("events", count);
        });
        api.log("currentEntry", navigation.currentEntry?.url?.split("/").pop() || "/");
    },
});

// --- Network Information ---
register({
    id: "network-information",
    name: "Network Information API",
    group: "device",
    isSupported: () => "connection" in navigator,
    init: (api) => {
        const c = navigator.connection;
        api.log("type", c.effectiveType || "unknown");
        if (typeof c.downlink === "number") api.log("downlink", `${c.downlink} Mbps`);
        if (c.saveData) document.body.dataset.saveData = "on";
        if (c.effectiveType === "slow-2g" || c.effectiveType === "2g") {
            document.body.dataset.net = "slow";
        }
    },
});

// --- Notifications ---
register({
    id: "notifications",
    name: "Notifications API",
    group: "pwa",
    isSupported: () => "Notification" in globalThis,
    init: (api) => {
        api.log("permission", Notification.permission);
    },
});

// --- Page Visibility ---
register({
    id: "page-visibility",
    name: "Page Visibility API",
    group: "meta",
    isSupported: () => "visibilityState" in document,
    init: (api) => {
        const sync = () => {
            document.body.dataset.tabState = document.visibilityState;
        };
        document.addEventListener("visibilitychange", sync);
        sync();
        api.log("state", document.visibilityState);
    },
});

// --- Payment Request ---
register({
    id: "payment-request",
    name: "Payment Request API",
    group: "meta",
    isSupported: () => "PaymentRequest" in globalThis,
});

// --- Performance APIs ---
register({
    id: "performance",
    name: "Performance APIs",
    group: "meta",
    isSupported: () => "performance" in globalThis,
    init: (api) => {
        let longTasks = 0;
        let cls = 0;
        let inp = 0;
        // Prerendered pages: paint/LCP timestamps are relative to the
        // PRERENDER's timeOrigin, which can be long before the page was
        // ever shown. Clamp to activationStart so the reported vitals
        // are user-perceived values (JS_ROUTER_CONSTRAINTS §3) — 0 on
        // normal loads, so non-prerendered metrics are unchanged.
        const activationStart =
            performance.getEntriesByType("navigation")[0]?.activationStart || 0;
        const sinceActivation = (t) => Math.max(0, t - activationStart);
        try {
            const po = new PerformanceObserver((list) => {
                longTasks += list.getEntries().length;
            });
            po.observe({ type: "longtask", buffered: true });
            // Read after a short delay to capture initial bursts.
            setTimeout(() => {
                api.log("longTasks", longTasks);
                recordRumMetric("longTasks", longTasks);
            }, 2000);
        } catch {}

        try {
            const lcpObserver = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                const last = entries[entries.length - 1];
                if (last) {
                    recordRumMetric("LCP", sinceActivation(last.startTime), {
                        element: last.element?.tagName || null,
                    });
                }
            });
            lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });
        } catch {}

        try {
            const clsObserver = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    if (!entry.hadRecentInput) cls += entry.value;
                }
                recordRumMetric("CLS", Math.round(cls * 1000) / 1000);
            });
            clsObserver.observe({ type: "layout-shift", buffered: true });
        } catch {}

        try {
            const inpObserver = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    if (entry.interactionId && entry.duration > inp) {
                        inp = entry.duration;
                    }
                }
                if (inp) recordRumMetric("INP", inp);
            });
            inpObserver.observe({ type: "event", buffered: true, durationThreshold: 16 });
        } catch {}

        try {
            const paint = performance.getEntriesByType("paint");
            const fcp = paint.find((entry) => entry.name === "first-contentful-paint");
            if (fcp) recordRumMetric("FCP", sinceActivation(fcp.startTime));
            const nav = performance.getEntriesByType("navigation")[0];
            if (nav) {
                const ttfb = nav.responseStart - nav.requestStart;
                rumState.navigation = {
                    type: nav.type,
                    transferSize: nav.transferSize,
                    encodedBodySize: nav.encodedBodySize,
                    decodedBodySize: nav.decodedBodySize,
                    notRestoredReasons: nav.notRestoredReasons || null,
                };
                recordRumMetric("TTFB", ttfb);
                api.log("nav", nav.type);
                if (nav.notRestoredReasons) {
                    api.log("bfcache-blockers", JSON.stringify(nav.notRestoredReasons));
                }
            }
        } catch {}

        window.addEventListener("pageshow", (event) => {
            const status = event.persisted ? "restored" : "normal";
            upsertReceipt("Performance APIs", "bfcache", status);
            rumState.navigation.bfcache = status;
            refreshModal();
        });
        // Prerender guards (JS_ROUTER_CONSTRAINTS §3): a DISCARDED
        // speculative prerender fires pagehide (and is "hidden" for its
        // whole life) — never report RUM for a page that was never
        // shown. Discarded prerenders never flip the flag.
        window.addEventListener("pagehide", (event) => {
            if (document.prerendering) return;
            rumState.navigation.pagehidePersisted = event.persisted;
            sendRum("pagehide");
        });
        document.addEventListener("visibilitychange", () => {
            if (document.prerendering) return;
            if (document.visibilityState === "hidden") sendRum("hidden");
        });
        setTimeout(() => sendRum("settled"), 5000);
        api.log("now", `${Math.round(performance.now())} ms`);
    },
});

// --- Permissions ---
register({
    id: "permissions",
    name: "Permissions API",
    group: "privacy",
    isSupported: () => "permissions" in navigator,
    init: async (api) => {
        const names = [
            "geolocation", "notifications", "camera", "microphone",
            "clipboard-read", "clipboard-write",
        ];
        const results = [];
        for (const name of names) {
            try {
                const status = await navigator.permissions.query({ name });
                if (status.state !== "prompt") {
                    results.push(`${name}:${status.state}`);
                }
            } catch {}
        }
        api.log("queried", names.length);
        if (results.length) api.log("granted/denied", results.join(", "));
    },
});

// --- Picture-in-Picture ---
register({
    id: "picture-in-picture",
    name: "Picture-in-Picture API",
    group: "media",
    isSupported: () => "pictureInPictureEnabled" in document,
});

// --- Pointer events ---
register({
    id: "pointer-events",
    name: "Pointer events",
    group: "input",
    isSupported: () => "PointerEvent" in globalThis,
    init: (api) => {
        api.log("used", "nav-dropdown, marquees");
    },
});

// --- Pointer Lock ---
register({
    id: "pointer-lock",
    name: "Pointer Lock API",
    group: "input",
    isSupported: () => "requestPointerLock" in Element.prototype,
});

// --- Popover ---
register({
    id: "popover",
    name: "Popover API",
    group: "meta",
    isSupported: () => "popover" in HTMLElement.prototype,
    init: (api) => {
        api.log("used", "#bio + #api-receipt-modal");
    },
});

// --- Presentation ---
register({
    id: "presentation",
    name: "Presentation API",
    group: "privacy",
    isSupported: () => "presentation" in navigator,
});

// --- Prioritized Task Scheduling ---
register({
    id: "prioritized-task-scheduling",
    name: "Prioritized Task Scheduling API",
    group: "background",
    isSupported: () => "scheduler" in globalThis && "postTask" in scheduler,
    init: (api) => {
        api.log("priorities", "user-blocking · user-visible · background");
    },
});

// --- Private State Token ---
register({
    id: "private-state-token",
    name: "Private State Token API",
    group: "privacy",
    isSupported: () => "hasPrivateToken" in document,
});

// --- Push ---
register({
    id: "push",
    name: "Push API",
    group: "pwa",
    isSupported: () =>
        "serviceWorker" in navigator && "PushManager" in globalThis,
});

// --- Remote Playback ---
register({
    id: "remote-playback",
    name: "Remote Playback API",
    group: "media",
    isSupported: () => "RemotePlayback" in globalThis,
});

// --- Reporting ---
register({
    id: "reporting",
    name: "Reporting API",
    group: "privacy",
    isSupported: () => "ReportingObserver" in globalThis,
    init: (api) => {
        let count = 0;
        try {
            const observer = new ReportingObserver(
                (reports) => {
                    count += reports.length;
                },
                { buffered: true },
            );
            observer.observe();
            setTimeout(() => api.log("reports", count), 2000);
        } catch {}
    },
});

// --- Resize Observer ---
register({
    id: "resize-observer",
    name: "Resize Observer API",
    group: "graphics",
    isSupported: () => "ResizeObserver" in globalThis,
    init: (api) => {
        api.log("used", "fit-text.js title-h sync");
    },
});

// --- SVG ---
register({
    id: "svg",
    name: "SVG API",
    group: "graphics",
    isSupported: () => "SVGSVGElement" in globalThis,
    init: (api) => {
        api.log("in-tree", document.querySelectorAll("svg").length);
    },
});

// --- Screen Capture ---
register({
    id: "screen-capture",
    name: "Screen Capture API",
    group: "hardware",
    isSupported: () =>
        "mediaDevices" in navigator && "getDisplayMedia" in navigator.mediaDevices,
});

// --- Screen Orientation ---
register({
    id: "screen-orientation",
    name: "Screen Orientation API",
    group: "device",
    isSupported: () => "orientation" in screen,
    init: (api) => {
        api.log("type", screen.orientation.type);
    },
});

// --- Screen Wake Lock ---
register({
    id: "screen-wake-lock",
    name: "Screen Wake Lock API",
    group: "meta",
    isSupported: () => "wakeLock" in navigator,
    init: (api) => {
        // Only acquire on article pages, and only when the user has
        // scrolled at least 30% — keeps the screen on once we know
        // the reader has committed.
        const article = document.querySelector(".article");
        if (!article) return false;
        let sentinel = null;
        const acquire = async () => {
            if (sentinel || document.visibilityState !== "visible") return;
            try {
                sentinel = await navigator.wakeLock.request("screen");
                sentinel.addEventListener("release", () => {
                    sentinel = null;
                });
                api.discover();
            } catch {}
        };
        const release = async () => {
            try {
                await sentinel?.release();
            } catch {}
            sentinel = null;
        };
        const onScroll = () => {
            const ratio =
                window.scrollY / (article.scrollHeight - window.innerHeight || 1);
            if (ratio > 0.3) {
                acquire();
                window.removeEventListener("scroll", onScroll);
            }
        };
        window.addEventListener("scroll", onScroll, { passive: true });
        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "hidden") release();
        });
        api.log("trigger", "30% scroll");
    },
});

// --- Selection ---
register({
    id: "selection",
    name: "Selection API",
    group: "input",
    isSupported: () => "getSelection" in window,
});

// --- Sensor APIs ---
register({
    id: "sensor",
    name: "Sensor APIs",
    group: "device",
    isSupported: () =>
        "Accelerometer" in globalThis ||
        "Gyroscope" in globalThis ||
        "LinearAccelerationSensor" in globalThis,
    init: (api) => {
        const sensors = [
            "Accelerometer", "Gyroscope", "LinearAccelerationSensor",
            "AbsoluteOrientationSensor", "RelativeOrientationSensor",
            "AmbientLightSensor", "GravitySensor", "Magnetometer",
        ].filter((s) => s in globalThis);
        api.log("classes", sensors.length);
    },
});

// --- Server-sent events ---
register({
    id: "server-sent-events",
    name: "Server-sent events",
    group: "network",
    isSupported: () => "EventSource" in globalThis,
});

// --- Service Worker ---
register({
    id: "service-worker",
    name: "Service Worker API",
    group: "background",
    isSupported: () =>
        "serviceWorker" in navigator && location.protocol !== "file:",
    init: async (api) => {
        // Dev mode (built with `--features dev`, i.e. `just dev`):
        // unregister any installed SW + nuke every cache so source
        // edits show up on next reload without manual DevTools work.
        // The dev marker is emitted by render_dev_meta() in pages/mod.rs.
        const isDev =
            document.querySelector('meta[name="engmanager-mode"]')?.content ===
            "dev";
        if (isDev) {
            try {
                const regs = await navigator.serviceWorker.getRegistrations();
                await Promise.all(regs.map((r) => r.unregister()));
                if ("caches" in window) {
                    const keys = await caches.keys();
                    await Promise.all(keys.map((k) => caches.delete(k)));
                }
                api.log(
                    "dev",
                    `SW purged · ${regs.length} reg · caches cleared`,
                );
            } catch (err) {
                api.log("dev-purge-error", err.message);
            }
            return false; // passive — no SW in dev
        }

        try {
            const reg = await navigator.serviceWorker.register("/sw.js", {
                scope: "/",
            });
            api.log("scope", reg.scope);
            api.log("state", reg.active?.state ?? reg.installing?.state ?? "registering");
            if ("navigationPreload" in reg) {
                const enabled = await reg.navigationPreload.getState();
                api.log("navigationPreload", enabled.enabled ? "enabled" : "disabled");
            }
        } catch (err) {
            api.log("error", err.message);
            throw err;
        }
    },
});

// --- Shared Storage ---
register({
    id: "shared-storage",
    name: "Shared Storage API",
    group: "privacy",
    isSupported: () => "sharedStorage" in window,
});

// --- Speculation Rules ---
register({
    id: "speculation-rules",
    name: "Speculation Rules API",
    group: "meta",
    isSupported: () =>
        HTMLScriptElement.supports?.("speculationrules") ?? false,
    init: (api) => {
        const sameOriginPath = (href) => {
            try {
                const url = new URL(href, location.href);
                return url.origin === location.origin ? url.pathname : null;
            } catch {
                return null;
            }
        };
        let injected = null;
        // Build + inject rules from the CURRENT document's links.
        // Returns a summary string, or false when there are no
        // candidates (nothing injected).
        const inject = () => {
            const articleNavUrls = [
                ...document.querySelectorAll(
                    'a[rel="next"], a[rel="prev"], .article-related-link',
                ),
            ]
                .map((link) => sameOriginPath(link.href))
                .filter(Boolean);
            const navPrefetchUrls = [...document.querySelectorAll(".nav-dropdown-item")]
                .slice(0, 3)
                .map((link) => sameOriginPath(link.href))
                .filter(Boolean);
            const unique = (items) => [...new Set(items)].filter((url) => url !== location.pathname);
            const prerenderUrls = unique(articleNavUrls).slice(0, 3);
            const prefetchUrls = unique(navPrefetchUrls).slice(0, 3);
            if (!prerenderUrls.length && !prefetchUrls.length) {
                return false;
            }
            const script = document.createElement("script");
            script.type = "speculationrules";
            const rules = {};
            if (prerenderUrls.length) {
                rules.prerender = [{ urls: prerenderUrls, eagerness: "moderate" }];
            }
            if (prefetchUrls.length) {
                rules.prefetch = [{ urls: prefetchUrls, eagerness: "conservative" }];
            }
            script.textContent = JSON.stringify(rules);
            document.head.appendChild(script);
            injected = script;
            return `${prerenderUrls.length} prerender · ${prefetchUrls.length} prefetch`;
        };

        // Soft navigation (JS_ROUTER_CONSTRAINTS §2.15a): rebuild from
        // the new page's links — but ONLY when no server-provided
        // island (data-server marker, ledger #14) owns the rules; the
        // server island is inline head content and persists across
        // swaps. Drop our own stale script first so old-page URLs
        // never linger.
        onSoftNav(() => {
            if (
                document.querySelector(
                    'script[type="speculationrules"][data-server]',
                )
            ) {
                return;
            }
            injected?.remove();
            injected = null;
            inject();
        });

        // Server island present (ledger #17: defer, never inject a
        // duplicate). The API-hunt detection/registration above stays
        // exactly as before.
        if (document.querySelector('script[type="speculationrules"]')) {
            api.log("rules", "server-provided");
            return;
        }
        const summary = inject();
        if (summary === false) {
            api.log("rules", "no candidates");
            return false;
        }
        api.log("rules", summary);
    },
});

// --- Storage ---
register({
    id: "storage",
    name: "Storage API",
    group: "storage",
    isSupported: () => "storage" in navigator && "estimate" in navigator.storage,
    init: async (api) => {
        const est = await navigator.storage.estimate();
        const mb = (n) => `${Math.round(n / 1024 / 1024)} MB`;
        api.log("usage", `${mb(est.usage)} / ${mb(est.quota)}`);
        if ("persisted" in navigator.storage) {
            const persisted = await navigator.storage.persisted();
            api.log("persisted", persisted ? "yes" : "no");
        }
    },
});

// --- Storage Access ---
register({
    id: "storage-access",
    name: "Storage Access API",
    group: "storage",
    isSupported: () => "hasStorageAccess" in document,
});

// --- Streams ---
register({
    id: "streams",
    name: "Streams API",
    group: "network",
    isSupported: () => "ReadableStream" in globalThis,
    init: (api) => {
        api.log("under", "fetch + CompressionStream");
    },
});

// --- Summarizer ---
register({
    id: "summarizer",
    name: "Summarizer API",
    group: "meta",
    isSupported: () =>
        "ai" in globalThis && globalThis.ai && "summarizer" in globalThis.ai,
});

// --- Topics ---
register({
    id: "topics",
    name: "Topics API",
    group: "privacy",
    isSupported: () => "browsingTopics" in document,
});

// --- Touch events ---
register({
    id: "touch-events",
    name: "Touch events",
    group: "input",
    isSupported: () => "ontouchstart" in window,
});

// --- Translator and Language Detector APIs ---
register({
    id: "translator-language-detector",
    name: "Translator and Language Detector APIs",
    group: "meta",
    isSupported: () =>
        "ai" in globalThis &&
        globalThis.ai &&
        ("translator" in globalThis.ai || "languageDetector" in globalThis.ai),
});

// --- Trusted Types ---
register({
    id: "trusted-types",
    name: "Trusted Types API",
    group: "security",
    isSupported: () => "trustedTypes" in window,
    init: (api) => {
        try {
            trustedTypes.createPolicy("engmanager-noop", {
                createHTML: (s) => s,
                createScript: (s) => s,
                createScriptURL: (s) => s,
            });
            api.log("policy", "engmanager-noop");
        } catch {
            api.log("policy", "exists");
        }
    },
});

// --- UI Events ---
register({
    id: "ui-events",
    name: "UI Events",
    group: "input",
    isSupported: () => "UIEvent" in globalThis,
});

// --- URL ---
register({
    id: "url",
    name: "URL API",
    group: "network",
    isSupported: () => "URL" in globalThis,
    init: (api) => {
        api.log("here", new URL(location.href).pathname);
    },
});

// --- URL Fragment Text Directives ---
register({
    id: "url-fragment-text-directives",
    name: "URL Fragment Text Directives",
    group: "network",
    isSupported: () => "fragmentDirective" in document,
    init: (api) => {
        // Add a "Share quote" button to every blockquote in articles.
        document
            .querySelectorAll(".article blockquote")
            .forEach((quote) => {
                const button = document.createElement("button");
                button.type = "button";
                button.className = "share-quote";
                button.textContent = "Share quote";
                button.addEventListener("click", async () => {
                    const text = quote.textContent.trim().slice(0, 300);
                    const fragment = encodeURIComponent(text);
                    const url = `${location.origin}${location.pathname}#:~:text=${fragment}`;
                    try {
                        if (navigator.share) {
                            await navigator.share({ url, text });
                        } else {
                            await navigator.clipboard.writeText(url);
                            button.textContent = "Copied";
                            setTimeout(() => (button.textContent = "Share quote"), 1500);
                        }
                        api.discover();
                    } catch {}
                });
                quote.appendChild(button);
            });
        api.log("blockquotes", document.querySelectorAll(".article blockquote").length);
    },
});

// --- URL Pattern ---
register({
    id: "url-pattern",
    name: "URL Pattern API",
    group: "network",
    isSupported: () => "URLPattern" in globalThis,
    init: (api) => {
        const pattern = new URLPattern({ pathname: "/articles/:slug" });
        const match = pattern.exec(location.href);
        api.log("match", match?.pathname?.groups?.slug ?? "—");
    },
});

// --- User Preferences ---
register({
    id: "user-preferences",
    name: "User Preferences API",
    group: "meta",
    isSupported: () => "matchMedia" in window,
    init: (api) => {
        const prefs = [
            ["color-scheme", "prefers-color-scheme"],
            ["motion", "prefers-reduced-motion"],
            ["contrast", "prefers-contrast"],
            ["transparency", "prefers-reduced-transparency"],
        ];
        for (const [name, query] of prefs) {
            const m = matchMedia(`(${query}: reduce)`);
            const v = matchMedia(`(${query}: more)`).matches
                ? "more"
                : matchMedia(`(${query}: less)`).matches
                  ? "less"
                  : matchMedia(`(${query}: reduce)`).matches
                    ? "reduce"
                    : matchMedia(`(${query}: dark)`).matches
                      ? "dark"
                      : matchMedia(`(${query}: light)`).matches
                        ? "light"
                        : "no-preference";
            void m;
            api.log(name, v);
        }
    },
});

// --- User-Agent Client Hints ---
register({
    id: "user-agent-client-hints",
    name: "User-Agent Client Hints API",
    group: "device",
    isSupported: () => "userAgentData" in navigator,
    init: (api) => {
        const ua = navigator.userAgentData;
        api.log("platform", ua.platform || "—");
        if (ua.brands?.length) {
            api.log("brands", ua.brands.map((b) => b.brand).join(" · "));
        }
    },
});

// --- Vibration ---
register({
    id: "vibration",
    name: "Vibration API",
    group: "hardware",
    isSupported: () => "vibrate" in navigator,
    init: (api) => {
        document.addEventListener("click", (event) => {
            if (event.target.closest(".article-fluid-link .article-check")) {
                try {
                    navigator.vibrate(25);
                    api.discover();
                } catch {}
            }
        });
        api.log("trigger", "checkbox tap");
    },
});

// --- View Transition ---
register({
    id: "view-transition",
    name: "View Transition API",
    group: "graphics",
    isSupported: () => "startViewTransition" in document,
    init: (api) => {
        api.log("mode", "cross-document + same-doc");
    },
});

// --- Viewport Segments ---
register({
    id: "viewport-segments",
    name: "Viewport Segments API",
    group: "meta",
    isSupported: () => "segments" in (window.visualViewport || {}),
});

// --- VirtualKeyboard ---
register({
    id: "virtual-keyboard",
    name: "VirtualKeyboard API",
    group: "input",
    isSupported: () => "virtualKeyboard" in navigator,
});

// --- Web Bluetooth ---
register({
    id: "web-bluetooth",
    name: "Web Bluetooth API",
    group: "hardware",
    isSupported: () => "bluetooth" in navigator,
});

// --- Web Periodic Background Synchronization ---
register({
    id: "web-periodic-background-synchronization",
    name: "Web Periodic Background Synchronization API",
    group: "background",
    isSupported: () =>
        "serviceWorker" in navigator &&
        "PeriodicSyncManager" in globalThis,
});

// --- Web Animations ---
register({
    id: "web-animations",
    name: "Web Animations API",
    group: "graphics",
    isSupported: () => "animate" in Element.prototype,
    init: (api) => {
        api.log("used", "anime.js v4 + WAAPI pseudoElement");
    },
});

// --- Web Audio ---
register({
    id: "web-audio",
    name: "Web Audio API",
    group: "media",
    isSupported: () => "AudioContext" in globalThis || "webkitAudioContext" in globalThis,
    init: (api) => {
        // 8-bit "beep" on the first checkbox toggle (gesture-gated;
        // browsers won't let us play audio without one).
        let played = false;
        document.addEventListener("click", (event) => {
            if (played) return;
            if (!event.target.closest(".article-fluid-link .article-check")) return;
            played = true;
            try {
                const Ctx = window.AudioContext || window.webkitAudioContext;
                const ctx = new Ctx();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = "square";
                osc.frequency.value = 880;
                gain.gain.value = 0.04;
                osc.connect(gain).connect(ctx.destination);
                osc.start();
                osc.stop(ctx.currentTime + 0.04);
                setTimeout(() => ctx.close(), 200);
                api.discover();
            } catch {}
        });
        api.log("trigger", "first checkbox tap");
    },
});

// --- Web Authentication ---
register({
    id: "web-authentication",
    name: "Web Authentication API",
    group: "security",
    isSupported: () => "PublicKeyCredential" in globalThis,
});

// --- Web Components ---
register({
    id: "web-components",
    name: "Web Components",
    group: "graphics",
    isSupported: () => "customElements" in window,
    init: (api) => {
        api.log("registry", "customElements available");
    },
});

// --- Web Crypto ---
register({
    id: "web-crypto",
    name: "Web Crypto API",
    group: "security",
    isSupported: () => "crypto" in window && "subtle" in crypto,
    init: async (api) => {
        // Hash the article body off-main-thread if a worker URL was
        // injected by the page; otherwise hash inline.
        const article = document.querySelector(".article");
        if (!article) {
            // Hash the page title instead so every page emits a hash.
            const bytes = new TextEncoder().encode(document.title);
            const digest = await crypto.subtle.digest("SHA-256", bytes);
            const hex = Array.from(new Uint8Array(digest).slice(0, 4))
                .map((b) => b.toString(16).padStart(2, "0"))
                .join("");
            api.log("title-sha", hex);
            return;
        }
        const url = window.__engUrls?.cryptoWorker;
        const text = article.textContent;
        if (url && "Worker" in window) {
            try {
                const worker = new Worker(url);
                const channel = new MessageChannel();
                const hex = await new Promise((resolve, reject) => {
                    channel.port1.onmessage = (event) => resolve(event.data);
                    setTimeout(() => reject(new Error("worker timeout")), 4000);
                    worker.postMessage({ text }, [channel.port2]);
                });
                article.dataset.contentHash = hex;
                api.log("content-sha", hex.slice(0, 8));
                worker.terminate();
                return;
            } catch {}
        }
        const bytes = new TextEncoder().encode(text);
        const digest = await crypto.subtle.digest("SHA-256", bytes);
        const hex = Array.from(new Uint8Array(digest).slice(0, 4))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
        article.dataset.contentHash = hex;
        api.log("content-sha", hex);
    },
});

// --- Web Locks ---
register({
    id: "web-locks",
    name: "Web Locks API",
    group: "meta",
    isSupported: () => "locks" in navigator,
    init: async (api) => {
        await navigator.locks.request("engmanager-init", async () => {
            api.log("held", "engmanager-init (briefly)");
        });
    },
});

// --- Web MIDI ---
register({
    id: "web-midi",
    name: "Web MIDI API",
    group: "hardware",
    isSupported: () => "requestMIDIAccess" in navigator,
});

// --- Web NFC ---
register({
    id: "web-nfc",
    name: "Web NFC API",
    group: "hardware",
    isSupported: () => "NDEFReader" in globalThis,
});

// --- Web Serial ---
register({
    id: "web-serial",
    name: "Web Serial API",
    group: "hardware",
    isSupported: () => "serial" in navigator,
});

// --- Web Share ---
register({
    id: "web-share",
    name: "Web Share API",
    group: "meta",
    isSupported: () => "share" in navigator,
    init: (api) => {
        const button = document.querySelector("[data-share]");
        if (!button) return false;
        button.hidden = false;
        button.addEventListener("click", async () => {
            try {
                await navigator.share({
                    title: document.title,
                    url: location.href,
                });
                api.discover();
            } catch {}
        });
        api.log("target", document.title);
    },
});

// --- Web Speech ---
register({
    id: "web-speech",
    name: "Web Speech API",
    group: "media",
    isSupported: () => "speechSynthesis" in window,
    init: (api) => {
        const button = document.querySelector("[data-read-aloud]");
        const article = document.querySelector(".article");
        if (!button || !article) return false;
        button.hidden = false;
        let speaking = false;
        let utterance = null;
        const stop = () => {
            speechSynthesis.cancel();
            speaking = false;
            button.dataset.state = "idle";
            button.textContent = button.dataset.idleLabel;
        };
        button.dataset.idleLabel = button.textContent;
        button.addEventListener("click", () => {
            if (speaking) return stop();
            const text = article.textContent.slice(0, 4000);
            utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 1.05;
            utterance.onend = stop;
            speechSynthesis.speak(utterance);
            speaking = true;
            button.dataset.state = "playing";
            button.textContent = "Stop";
            api.discover();
        });
        api.log("voices", speechSynthesis.getVoices().length);
    },
});

// --- Web Storage ---
register({
    id: "web-storage",
    name: "Web Storage API",
    group: "storage",
    isSupported: () => "localStorage" in window,
    init: (api) => {
        api.log("used", "visited-articles + avatar-position");
    },
});

// --- Web Workers ---
register({
    id: "web-workers",
    name: "Web Workers API",
    group: "background",
    isSupported: () => "Worker" in globalThis,
    init: (api) => {
        api.log("used", "web-crypto SHA-256 worker");
    },
});

// --- Web-based Payment Handler ---
register({
    id: "web-based-payment-handler",
    name: "Web-based Payment Handler API",
    group: "meta",
    isSupported: () =>
        "serviceWorker" in navigator && "PaymentManager" in globalThis,
});

// --- WebCodecs ---
register({
    id: "webcodecs",
    name: "WebCodecs API",
    group: "media",
    isSupported: () => "VideoEncoder" in globalThis,
});

// --- WebGL ---
register({
    id: "webgl",
    name: "WebGL: 2D and 3D graphics for the web",
    group: "media",
    isSupported: () => {
        const c = document.createElement("canvas");
        return !!(c.getContext("webgl") || c.getContext("webgl2"));
    },
    init: (api) => {
        api.log("used", "auteurs-shader.js");
    },
});

// --- WebGPU ---
register({
    id: "webgpu",
    name: "WebGPU API",
    group: "media",
    isSupported: () => "gpu" in navigator,
});

// --- WebHID ---
register({
    id: "webhid",
    name: "WebHID API",
    group: "hardware",
    isSupported: () => "hid" in navigator,
});

// --- WebOTP ---
register({
    id: "webotp",
    name: "WebOTP API",
    group: "hardware",
    isSupported: () =>
        "OTPCredential" in globalThis ||
        ("credentials" in navigator && "preventSilentAccess" in navigator.credentials),
});

// --- WebRTC ---
register({
    id: "webrtc",
    name: "WebRTC API",
    group: "media",
    isSupported: () => "RTCPeerConnection" in globalThis,
});

// --- WebSocket ---
register({
    id: "websocket",
    name: "WebSocket API",
    group: "network",
    isSupported: () => "WebSocket" in globalThis,
});

// --- WebTransport ---
register({
    id: "webtransport",
    name: "WebTransport API",
    group: "network",
    isSupported: () => "WebTransport" in globalThis,
});

// --- WebUSB ---
register({
    id: "webusb",
    name: "WebUSB API",
    group: "hardware",
    isSupported: () => "usb" in navigator,
});

// --- WebVR ---
register({
    id: "webvr",
    name: "WebVR API",
    group: "media",
    isSupported: () => "getVRDisplays" in navigator,
    init: (api) => {
        api.log("status", "deprecated → WebXR");
    },
});

// --- WebVTT ---
register({
    id: "webvtt",
    name: "WebVTT API",
    group: "media",
    isSupported: () => "VTTCue" in globalThis,
});

// --- WebXR ---
register({
    id: "webxr",
    name: "WebXR Device API",
    group: "hardware",
    isSupported: () => "xr" in navigator,
});

// --- Window Controls Overlay ---
register({
    id: "window-controls-overlay",
    name: "Window Controls Overlay API",
    group: "pwa",
    isSupported: () => "windowControlsOverlay" in navigator,
});

// --- Window Management ---
register({
    id: "window-management",
    name: "Window Management API",
    group: "device",
    isSupported: () => "getScreenDetails" in window,
});

// =============================================================================
// Scavenger hunt hooks.
//
// Quiet, discoverable interactions scattered across the site. Each one
// awards one or more API discoveries only after the reader does
// something: a hidden gesture, real browsing, navigation, or a tool click.
// The page can exercise APIs on boot for the receipt, but first-load
// activity must not count as scavenger-hunt progress.
// =============================================================================

function mountScavengerHooks() {
    // ── Konami code ──────────────────────────────────────────────
    // ↑ ↑ ↓ ↓ ← → ← → B A  ⇒ discovers Keyboard API + Trusted Types
    // + Reporting + Invoker Commands (the keyboard handler is the
    // canonical "I used the keyboard" gesture).
    const konami = [
        "ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown",
        "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight",
        "b", "a",
    ];
    let konamiCursor = 0;
    window.addEventListener("keydown", (event) => {
        const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
        if (key === konami[konamiCursor]) {
            konamiCursor++;
            if (konamiCursor === konami.length) {
                konamiCursor = 0;
                ["keyboard", "trusted-types", "reporting", "invoker-commands"].forEach(
                    discover,
                );
                // Flash the receipt chip + open the modal for the
                // dopamine hit.
                document
                    .getElementById("api-receipt-modal")
                    ?.showPopover();
            }
        } else {
            konamiCursor = key === konami[0] ? 1 : 0;
        }
    });

    // ── Triple-click anywhere ────────────────────────────────────
    // Discovers Pointer Events + UI Events.
    let clickStreak = 0;
    let clickResetTimer = null;
    document.addEventListener("click", (event) => {
        if (event.target.closest(".api-cell-hint")) return;
        clickStreak++;
        clearTimeout(clickResetTimer);
        clickResetTimer = setTimeout(() => (clickStreak = 0), 400);
        if (clickStreak >= 3) {
            clickStreak = 0;
            discover("pointer-events");
            discover("ui-events");
        }
    });

    // ── Long-press (touch) ───────────────────────────────────────
    let pressTimer = null;
    document.addEventListener("pointerdown", (event) => {
        if (event.pointerType !== "touch") return;
        pressTimer = setTimeout(() => {
            discover("touch-events");
            discover("pointer-events");
        }, 600);
    });
    ["pointerup", "pointercancel", "pointermove"].forEach((type) =>
        document.addEventListener(type, () => {
            clearTimeout(pressTimer);
        }),
    );

    // ── Resize the window ────────────────────────────────────────
    // Discovers Resize Observer + CSSOM view (visualViewport reads).
    let resizeFlag = false;
    let resizeReady = false;
    let lastViewportSize = `${window.innerWidth}x${window.innerHeight}`;
    setTimeout(() => (resizeReady = true), 1000);
    window.addEventListener(
        "resize",
        () => {
            const nextViewportSize = `${window.innerWidth}x${window.innerHeight}`;
            if (!resizeReady || nextViewportSize === lastViewportSize) {
                lastViewportSize = nextViewportSize;
                return;
            }
            if (resizeFlag) return;
            resizeFlag = true;
            lastViewportSize = nextViewportSize;
            discover("resize-observer");
            discover("cssom-view");
        },
        { passive: true },
    );

    // ── Tab away and come back ───────────────────────────────────
    // Discovers Page Visibility. (Visibility listener already runs
    // synchronously, but we only mark on actual change.)
    document.addEventListener("visibilitychange", () => {
        discover("page-visibility");
    });

    // ── Idle after interaction ───────────────────────────────────
    // Discovers Background Tasks + Prioritized Task Scheduling once
    // the reader has actually browsed or interacted, then pauses.
    let idleTimer = null;
    const scheduleIdleDiscovery = () => {
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
            discover("background-tasks");
            discover("prioritized-task-scheduling");
        }, 30_000);
    };
    ["pointermove", "keydown", "scroll", "click"].forEach((type) =>
        window.addEventListener(
            type,
            scheduleIdleDiscovery,
            { passive: true },
        ),
    );

    // ── Scroll past 1000px ───────────────────────────────────────
    // Discovers Intersection Observer (it's been firing all along).
    let scrollFlag = false;
    window.addEventListener(
        "scroll",
        () => {
            if (scrollFlag || window.scrollY < 1000) return;
            scrollFlag = true;
            discover("intersection-observer");
        },
        { passive: true },
    );

    // ── Cross-document navigation ─────────────────────────────────
    // Discovers View Transition during real navigations. `pagereveal`
    // may fire for initial presentation, so require an actual transition.
    window.addEventListener("pageswap", () => discover("view-transition"));
    window.addEventListener("pagereveal", (event) => {
        if (!event.viewTransition) return;
        discover("view-transition");
        discover("speculation-rules");
    });

    // ── `?` already opens the modal (handler above). Doing it
    // discovers Popover + Keyboard.
    window.addEventListener("keydown", (event) => {
        if (event.key === "?" || event.key === "/") {
            const tag = document.activeElement?.tagName;
            if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
            if (document.activeElement?.isContentEditable) return;
            discover("popover");
            discover("keyboard");
        }
    });

    // ── Triple-click the ⌬ glyph in the modal ─────────────────────
    // The "secret" interaction — opens up the easter egg of marking
    // a handful of dormant APIs as "found" all at once.
    let glyphStreak = 0;
    document.addEventListener("click", (event) => {
        const target = event.target.closest(".api-receipt-glyph");
        if (!target) return;
        glyphStreak++;
        if (glyphStreak >= 3) {
            glyphStreak = 0;
            [
                "compression-streams", "encoding", "web-crypto",
                "web-locks", "channel-messaging", "web-workers",
                "html-sanitizer",
            ].forEach(discover);
        }
        setTimeout(() => (glyphStreak = 0), 800);
    });

    // ── Hover-prefetch happens on its own ─────────────────────────
    // The hover-prefetch experience (not registered as an API)
    // already exists; we mark Speculation Rules + Fetch as found
    // on the first link hover. The {once:true} bindings are
    // per-element, so soft navigations re-bind against the swapped-in
    // links (discover() is idempotent — a stray double bind on a
    // surviving node is harmless).
    const bindHoverDiscover = (root) =>
        root.querySelectorAll(".article-fluid-link, .nav-dropdown-item").forEach(
            (link) =>
                link.addEventListener(
                    "pointerenter",
                    () => {
                        discover("speculation-rules");
                        discover("fetch");
                    },
                    { once: true },
                ),
        );
    bindHoverDiscover(document);
    onSoftNav(bindHoverDiscover);
}

// =============================================================================
// Bootstrap.
// =============================================================================

// Prerender gate (JS_ROUTER_CONSTRAINTS §3, ledger #17): a speculatively
// prerendered page must not register the service worker, open a
// BroadcastChannel, read the battery, attach RUM observers or inject
// speculation rules — defer the whole bootstrap until activation.
// Discarded prerenders then never run anything.
if (document.prerendering) {
    document.addEventListener("prerenderingchange", runAll, { once: true });
} else if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", runAll, { once: true });
} else {
    runAll();
}

// Soft navigation: drain the per-experience re-sync hooks (speculation
// rebuild, hover-discover re-bind, .article re-query). The single
// registration point for this whole bundle.
window.__engNav?.onSwap?.((root) => {
    for (const fn of softNavHooks) {
        try {
            fn(root);
        } catch {}
    }
});
