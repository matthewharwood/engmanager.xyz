# Web API Experiences — Comprehensive Plan

**One-line goal:** touch every Web API in the user's list (~145 entries) with a
real, subtle micro-experience that a curious reader can discover, threaded
together by a single "Web API Receipt" easter-egg printed to DevTools on
every page load.

**Aesthetic:** brutalist + futuristic. Same chunky-bordered, hard-shadow,
Catppuccin-Latte language the rest of the site speaks.

**One-PR scope:** complete coverage (every API has at minimum a stub +
manifest row + console-receipt line), ~25 substantive micro-experiences,
Service Worker registration unlocking the PWA cluster, three small visible
additions in the article-meta header, a Rust `#[test]` that guards
manifest ↔ JS parity.

---

## 1. Architecture

### 1.1 Files

```
_docs/web-api-experiences-plan.md         (this file)
website/experiences/manifest.toml         canonical list — id, name, group
website/src/experiences.rs                Rust loader + #[test] parity guard
website/js/src/experiences.js             single registry; ~145 entries
website/js/src/sw.js                      service worker (unlocks PWA cluster)
website/assets/manifest.webmanifest       PWA manifest (Badging, Launch Handler)
```

### 1.2 Registry contract

Every entry in `experiences.js` matches this shape:

```js
register({
  id: "battery-status",           // matches manifest.toml row
  name: "Battery Status API",     // display name
  group: "device",                // bucket for the receipt
  isSupported: () => "getBattery" in navigator,
  init: async (ctx) => {
    const b = await navigator.getBattery();
    ctx.log("level", `${Math.round(b.level * 100)}%${b.charging ? " ⚡" : ""}`);
  },
});
```

A shared `ctx` exposes:

- `ctx.log(label, value)` — adds a sub-line under this API in the receipt
- `ctx.defer(fn)` — `scheduler.postTask(fn, { priority: "background" })`
  with `requestIdleCallback` fallback
- `ctx.onInteraction(fn)` — runs once on the first user gesture, used to
  warm experiences that need a user-activation gesture

Each entry's `status` is set by the runner: `unsupported | active |
passive | error`. Errors thrown inside `init` are caught.

### 1.3 Runtime flow

```
DOMContentLoaded
   ↓
for each registered entry (in declaration order):
   ↓ isSupported() === false  →  status = "unsupported"
   ↓ await init(ctx)
       returns false           →  status = "passive"
       throws                  →  status = "error"
       otherwise               →  status = "active"
   ↓
printReceipt()  (deferred via scheduler.postTask, background priority)
```

### 1.4 Console receipt

One collapsed group at INFO level so it doesn't clutter normal devtools.

```
⌬ engmanager.xyz · 145 Web APIs · 91 supported · 24 active
   device      ▾  9 entries · 7 supported
   input       ▾ 12 entries · 9 supported
   storage     ▾  8 entries · 8 supported
   network     ▾  6 entries · 4 supported
   background  ▾  6 entries · 5 supported
   media       ▾ 17 entries · 6 supported
   graphics    ▾ 12 entries · 12 supported
   security    ▾  7 entries · 6 supported
   pwa         ▾  5 entries · 5 supported
   hardware    ▾ 13 entries · 1 supported
   privacy     ▾ 10 entries · 3 supported
   meta        ▾ 40 entries · 25 supported
```

Each group expands to show:

```
● Battery Status API
    level: 87% ⚡
● Network Information API
    effectiveType: 4g · downlink: 5.2 Mbps
○ Device Memory API
    deviceMemory: 8 GB
· Web Bluetooth API   (unsupported)
```

Glyphs: `●` active · `○` passive (feature-detected, not invoked) ·
`·` unsupported · `×` errored.

### 1.5 Regression test

`website/src/experiences.rs`:

```rust
#[test]
fn manifest_parity() {
    let toml = include_str!("../experiences/manifest.toml");
    let js   = include_str!("../js/src/experiences.js");

    let ids: Vec<&str> = toml
        .lines()
        .filter_map(|l| l.trim().strip_prefix("id = \""))
        .filter_map(|l| l.split('"').next())
        .collect();

    assert!(!ids.is_empty(), "manifest is empty");

    for id in &ids {
        let needle = format!("id: \"{id}\"");
        assert!(js.contains(&needle), "experiences.js missing entry: {id}");
    }
}
```

This catches "added to manifest, forgot to add to JS" at `cargo test`
time. Cheap, no JS runtime needed.

### 1.6 Wire-up

`<script src="js/experiences.js" defer>` added to **both** layouts. One
file, OXC-minified, brotli-compressed in transit. Estimated cost:

- raw: ~16 KB
- minified: ~6 KB
- brotli: ~2 KB

Service worker registers itself on `load`, scoped to `/`.

---

## 2. The Connective Tissue

Single hidden artifact: the **Web API Receipt** in DevTools.

A power user opens the console, sees the colored brutalist header,
expands a group, and learns that the site has wired ~150 APIs.
That's the easter egg they earn for looking.

Optional (stretch): keyboard shortcut `Cmd+Shift+/` opens a brutalist
fullscreen Popover-API modal that visualizes the receipt with
hatched ghost-slots for unsupported APIs, animated in via View
Transitions. Same data, on-screen. Marks every API as discoverable
even without opening DevTools. **In-scope for this PR.**

---

## 3. API Catalog

145 entries from the user's list. Treatment per entry below.

Legend:
- **🟢 used** — already integrated in this codebase; register and link
- **🟣 build** — substantive new micro-experience this PR adds
- **🔵 detect** — feature-detect + receipt line only (no permission, no
  hardware required, no auto-invoke)
- **⚪ note** — deprecated, alias, or genuinely cannot be invoked

Counts: **used 18 · build 27 · detect 95 · note 5 = 145**

### 3.1 device (10)

| Status | API | Treatment |
|---|---|---|
| 🟣 build | Battery Status API | Receipt: `level X% [⚡]`. If <20% + not charging → dim marquees via body class |
| 🟣 build | Network Information API | Receipt: `effectiveType + downlink`. If "slow-2g"/"2g" → set `data-net="slow"` on body, CSS pauses marquees |
| 🟣 build | Device Memory API | Receipt: `deviceMemory GB`. If <4 → set `data-mem="low"`, CSS skips Houdini paint |
| 🔵 detect | Device orientation events | Receipt only |
| 🔵 detect | Device Posture API | Receipt: posture if available |
| 🔵 detect | Screen Orientation API | Receipt: orientation.type |
| 🔵 detect | Sensor APIs | Receipt: lists supported sensor classes |
| 🔵 detect | Window Management API | Receipt: `getScreenDetails` present |
| 🔵 detect | User-Agent Client Hints | Receipt: platform + brands from `navigator.userAgentData` |
| 🔵 detect | Compute Pressure API | Receipt only |

### 3.2 input (12)

| Status | API | Treatment |
|---|---|---|
| 🟢 used | Pointer events | `nav-dropdown.js`, etc. |
| 🟢 used | UI Events | Every click handler |
| 🟢 used | Selection API | Used implicitly |
| 🟣 build | EyeDropper API | `Cmd+E` opens the eyedropper; picked color logged + flashed on the favicon orb briefly |
| 🟣 build | HTML Drag and Drop API | The bottom-right avatar becomes draggable; its xy persists in localStorage |
| 🟣 build | Web Share API | "Share" button in article-meta (mobile shows native sheet, desktop falls back to clipboard copy of URL) |
| 🔵 detect | Touch events | Receipt only |
| 🔵 detect | Force Touch events | Receipt only |
| 🔵 detect | Keyboard API | Receipt only |
| 🔵 detect | VirtualKeyboard API | Receipt only |
| 🔵 detect | EditContext API | Receipt only |
| 🔵 detect | Ink API | Receipt only |
| 🔵 detect | InputDeviceCapabilities API | Receipt only |
| 🔵 detect | Pointer Lock API | Receipt only |
| 🔵 detect | Gamepad API | Receipt: lists gamepads if connected |
| 🔵 detect | Contact Picker API | Receipt only (Android-only, permission-gated) |

(That's 16, not 12. Recount: 12 was my estimate, actual is 16. Plan is
elastic — categories aren't fixed counts.)

### 3.3 storage (8)

| Status | API | Treatment |
|---|---|---|
| 🟢 used | Web Storage API | `localStorage` in `visited-articles.js` |
| 🟣 build | Cookie Store API | Sets `last-visit` cookie; receipt shows iso8601 |
| 🟣 build | Storage API | `navigator.storage.estimate()` → receipt shows `used / quota` |
| 🟣 build | Cache API | Via service worker; receipt shows cache entry count |
| 🔵 detect | IndexedDB API | Receipt only |
| 🔵 detect | File API | Receipt only |
| 🔵 detect | File System API | Receipt only |
| 🔵 detect | File and Directory Entries API | Receipt only |
| 🔵 detect | Shared Storage API | Receipt only |
| 🔵 detect | Storage Access API | Receipt only |

### 3.4 network (8)

| Status | API | Treatment |
|---|---|---|
| 🟢 used | Fetch API | `discord.rs` (server) |
| 🟢 used | Streams API | Inside fetch |
| 🟣 build | Beacon API | `navigator.sendBeacon("/health")` on `pagehide` with `{ slug, duration }` JSON |
| 🟣 build | URL Pattern API | Receipt demos `new URLPattern({ pathname: "/articles/:slug" }).exec(location.href)` |
| 🟢 used | URL API | Implicit |
| 🟣 build | URL Fragment Text Directives | Each `.article blockquote` gets a "Share quote" hover-button generating a `#:~:text=...` link |
| 🔵 detect | WebSocket API | Receipt only |
| 🔵 detect | WebTransport API | Receipt only |
| 🔵 detect | WebRTC API | Receipt only |
| 🔵 detect | Server-sent events | Receipt only |

### 3.5 background (7)

| Status | API | Treatment |
|---|---|---|
| 🟣 build | Service Worker API | Register `/sw.js` scoped to `/` |
| 🟣 build | Background Tasks API | `requestIdleCallback` wraps the receipt print |
| 🟣 build | Prioritized Task Scheduler API | Used where supported (preferred over rIC) for receipt |
| 🟣 build | Web Workers API | Spawn a 200-line worker that computes SHA-256 of article body off-main-thread |
| 🔵 detect | Background Fetch API | Receipt — needs SW |
| 🔵 detect | Background Synchronization API | Receipt — needs SW |
| 🔵 detect | Web Periodic Background Synchronization API | Receipt — needs SW |
| 🔵 detect | JS Self-Profiling API | Receipt only |

### 3.6 media (17)

| Status | API | Treatment |
|---|---|---|
| 🟢 used | Canvas API | `auteurs-shader.js` |
| 🟢 used | WebGL: 2D and 3D graphics for the web | `auteurs-shader.js` uses WebGL |
| 🟣 build | Web Audio API | 8-bit "beep" (30ms, -20dBFS) on first brutalist-checkbox toggle |
| 🟣 build | Web Speech API (synthesis) | "Read aloud" button in article-meta. Click to start, click to stop |
| 🔵 detect | WebGPU API | Receipt only |
| 🔵 detect | WebCodecs API | Receipt only |
| 🔵 detect | Media Capabilities API | Receipt only |
| 🔵 detect | Media Capture and Streams API | Receipt only |
| 🔵 detect | Media Session API | Receipt only |
| 🔵 detect | Media Source API | Receipt only |
| 🔵 detect | MediaStream Recording API | Receipt only |
| 🔵 detect | MediaStream Image Capture API | Receipt only |
| 🔵 detect | Insertable Streams for MediaStreamTrack API | Receipt only |
| 🔵 detect | Encrypted Media Extensions API | Receipt only |
| 🔵 detect | Picture-in-Picture API | Receipt only (no video on site) |
| 🟣 build | Document Picture-in-Picture API | Article-page button: open the article meta block in a Document PiP window |
| 🔵 detect | Remote Playback API | Receipt only |
| 🔵 detect | Audio Output Devices API | Receipt only |
| 🔵 detect | Audio Session API | Receipt only |
| 🔵 detect | Web Speech API (recognition) | Receipt only — separate from synthesis |
| 🔵 detect | WebVTT API | Receipt only |
| ⚪ note | WebVR API | Receipt: `deprecated, see WebXR` |

### 3.7 graphics (12)

| Status | API | Treatment |
|---|---|---|
| 🟢 used | Web Animations API | anime.js v4 uses WAAPI under the hood |
| 🟢 used | View Transition API | `view-transitions.js` + cross-doc VT |
| 🟢 used | Resize Observer API | `fit-text.js` |
| 🟢 used | Intersection Observer API | `toc-waypoints.js` |
| 🟢 used | SVG API | favicon, fluid-display-svg, illustrations |
| 🟢 used | CSS Object Model (CSSOM) | Every CSS rule |
| 🟢 used | CSS Font Loading API | `document.fonts.ready` in fit-text.js |
| 🟢 used | Geometry interfaces | `DOMRect` in fit-text.js |
| 🟣 build | CSS Painting API | Custom paint worklet `brutalist-hatch` — used as the `filter-chip-placeholder` background (replaces current `repeating-linear-gradient` with a worklet-drawn version where supported) |
| 🟣 build | CSS Properties and Values API | `@property --accent` and `@property --title-h` registrations so they animate cleanly |
| 🟣 build | CSS Custom Highlight API | `Cmd+H` highlights all occurrences of any selected word in the article body via the Highlight registry |
| 🟣 build | CSS Typed Object Model | Read computed `--title-h` via `element.computedStyleMap().get('--title-h')` in receipt |
| 🔵 detect | CSSOM view API | Receipt: current `scrollY` + `visualViewport` |
| 🔵 detect | Houdini APIs | Receipt aggregates Painting + Properties registration status |

### 3.8 security (7)

| Status | API | Treatment |
|---|---|---|
| 🟣 build | Web Crypto API | SHA-256 of each article body computed in a Web Worker; first 8 hex chars appended as `data-content-hash` on `<article>`, also in receipt |
| 🟣 build | Trusted Types API | Define a no-op `policy` named `engmanager` (registers presence) |
| 🟣 build | Encoding API | `TextEncoder` powers the Web Crypto hash + the Compression Streams demo |
| 🟣 build | HTML Sanitizer API | Sanitize a hardcoded `<img onerror>` string in receipt to demo the API working |
| 🔵 detect | Web Authentication API | Receipt only |
| 🔵 detect | Credential Management API | Receipt only |
| 🔵 detect | Federated Credential Management (FedCM) API | Receipt only |
| 🔵 detect | Fenced Frame API | Receipt only |

### 3.9 pwa (5 + service worker)

| Status | API | Treatment |
|---|---|---|
| 🟣 build | Notifications API | Receipt shows `Notification.permission`. No auto-request |
| 🔵 detect | Badging API | Receipt only |
| 🔵 detect | Launch Handler API | Receipt only |
| 🔵 detect | Content Index API | Receipt only |
| 🔵 detect | Window Controls Overlay API | Receipt only |
| 🔵 detect | Push API | Receipt only — would need SW + server |

### 3.10 hardware (13, mostly detect-only)

| Status | API | Treatment |
|---|---|---|
| 🔵 detect | Web Bluetooth API | Receipt only |
| 🔵 detect | Web USB API | Receipt only |
| 🔵 detect | Web Serial API | Receipt only |
| 🔵 detect | Web HID API | Receipt only |
| 🔵 detect | Web NFC API | Receipt only (Android Chrome) |
| 🔵 detect | Web MIDI API | Receipt only |
| 🔵 detect | WebXR Device API | Receipt only |
| 🔵 detect | WebOTP API | Receipt only |
| 🔵 detect | Local Font Access API | Receipt only (permission-gated) |
| 🔵 detect | Geolocation API | Receipt only — never auto-prompt |
| 🔵 detect | Idle Detection API | Receipt only — permission-gated |
| 🔵 detect | Screen Capture API | Receipt only |
| 🟣 build | Vibration API | 25ms pulse when the brutalist checkbox toggles, on touch devices only |

### 3.11 privacy & ads (8)

All detect-only. Privacy Sandbox era — we don't actually want to invoke
any of these silently.

| Status | API | Treatment |
|---|---|---|
| 🔵 detect | Attribution Reporting API | Receipt only |
| 🔵 detect | Topics API | Receipt only |
| 🔵 detect | Private State Token API | Receipt only |
| 🔵 detect | Storage Access API | Already counted in storage |
| 🔵 detect | Shared Storage API | Already counted in storage |
| 🔵 detect | Permissions API | Queries 6 common permissions, receipt shows their state |
| 🔵 detect | Reporting API | Receipt: registers a no-op `ReportingObserver` |
| 🔵 detect | Presentation API | Receipt only |

### 3.12 meta (40+)

| Status | API | Treatment |
|---|---|---|
| 🟢 used | Console API | Receipt itself |
| 🟢 used | DOM | Receipt: just a marker entry |
| 🟢 used | HTML DOM API | Marker — alias of DOM |
| 🟢 used | Document Object Model (DOM) | Marker — alias |
| 🟢 used | Popover API | `#bio` popover on homepage, plus Cmd+Shift+/ receipt modal |
| 🟢 used | History API | Implicit on every navigation |
| 🟣 build | Navigation API | Listens for `navigate` events; receipt counts cross-doc transitions per session |
| 🟢 used | URL API | Implicit |
| 🟣 build | Channel Messaging API | `MessageChannel` between page and Web Worker (used by Web Crypto experience) |
| 🟣 build | Broadcast Channel API | Sync of visited-articles state across open tabs — strike-through propagates instantly |
| 🟣 build | Web Locks API | Wraps the `visited-articles` localStorage write inside `navigator.locks.request("visited-articles")` so concurrent tabs don't race |
| 🟢 used | Performance APIs | New: `PerformanceObserver` for `longtask` entries → receipt counts the number observed |
| 🟣 build | Performance Observer | Subset — counts long tasks |
| 🟣 build | Page Visibility API | `visibilitychange` → adds `data-tab-state="hidden"` to body, CSS pauses marquees |
| 🟣 build | Screen Wake Lock API | When article scroll passes 30%, request screen wake; release on `visibilitychange` or back-up scroll |
| 🟣 build | Speculation Rules API | `<script type="speculationrules">` JSON prerenders all `/articles/*` links |
| 🟣 build | Fullscreen API | Article-page button: toggle fullscreen for distraction-free reading |
| 🟣 build | Compression Streams API | Hidden `window.__compress(text)` helper using `new CompressionStream('gzip')` |
| 🟣 build | User Preferences API | Receipt aggregates `prefers-color-scheme`, `prefers-reduced-motion`, `prefers-contrast`, `prefers-reduced-transparency` |
| 🔵 detect | Summarizer API | Receipt only (Chrome built-in AI, behind a flag for now) |
| 🔵 detect | Translator and Language Detector APIs | Receipt only |
| 🔵 detect | Barcode Detection API | Receipt only |
| 🔵 detect | Invoker Commands API | Receipt only (very new) |
| 🔵 detect | Payment Request API | Receipt only |
| 🔵 detect | Web-based Payment Handler API | Receipt only |
| 🔵 detect | Viewport Segments API | Receipt only |
| 🔵 detect | Window Management API | Already counted in device |

Plus the `meta` category catches the duplicates (DOM ≈ HTML DOM ≈ Document
Object Model) — they each get their own row in the manifest for
completeness but their `init` is a marker.

---

## 4. Visible additions (the only DOM/CSS changes)

1. **Article-meta header gains a small toolbar** (right-aligned, after
   the date pill):
   - `↗ Share` — Web Share API on mobile, clipboard fallback on desktop
   - `▶ Read aloud` — Speech Synthesis. Toggles play/stop
   - `⛶ Fullscreen` — Fullscreen API on the `<article>` element
   - `↗ Pop out` — Document Picture-in-Picture (supporting browsers only,
     hidden otherwise)

   All four are small mono-font ghost buttons matching the existing
   `.article-meta-date` pill style. None of them block content if
   unsupported.

2. **Homepage avatar becomes draggable.** HTML Drag and Drop wired so
   the user can drag the avatar to any corner; position persists in
   localStorage.

3. **Cmd+Shift+/ opens a brutalist receipt modal.** Reuses Popover API;
   View Transition API animates the open; lists every API with its
   status as a scrollable brutalist table.

4. **Cmd+H** activates a custom-highlight overlay for the article body.
   Type to search; CSS Custom Highlight API paints matches.

5. **Cmd+E** invokes the EyeDropper. Picked color flashes briefly on
   the favicon orb, then prints to console.

Nothing on the homepage layout changes besides #2. Articles get the
toolbar (#1) and the shortcuts. Marquees stay marquees.

---

## 5. Service Worker scope

`website/js/src/sw.js` registers itself from `experiences.js` on `load`
when supported. Routes:

- HTML (`*.html`, `/`, `/articles/*`) — network-first, fall back to
  cache, populate cache on success. TTL respected from `Cache-Control`.
- Assets (`/assets/*`) — cache-first (we already serve them with
  `immutable; max-age=1y`, the URL is content-hashed). Network on miss.
- Everything else — pass through.

Just enabling the SW unlocks "supported" status for:
- Background Fetch API
- Background Synchronization API
- Web Periodic Background Synchronization API
- Push API (still unsupported in our receipt until we have a server
  endpoint — that's correct)
- Cache API (we use it for the runtime cache)

**Cloudflare interaction:** the SW is served at `/sw.js` with `scope=/`.
We need `Service-Worker-Allowed: /` on the response. Add to
`asset_handler`. Single header change.

---

## 6. Phasing (single PR)

Inside one PR, in this order:

1. Write `manifest.toml` with all ~145 entries.
2. Write `experiences.js` framework (registry, ctx, printReceipt).
3. Add all ~145 entries (stubs first, then upgrade the 25 substantive
   ones).
4. Add `sw.js` + Cloudflare header.
5. Add visible additions (toolbar in article-meta, drag-avatar, modal,
   Cmd+H, Cmd+E).
6. Wire `<script src="js/experiences.js" defer>` into both layouts.
7. Add `experiences.rs` + `#[test]`.
8. `cargo test` + `cargo build` + render check both pages.
9. Commit + PR.

---

## 7. Risk & guardrails

| Risk | Mitigation |
|---|---|
| Bundle bloat from 145 entries | OXC + brotli → expected total ~2 KB over the wire |
| Service Worker stuck on old version | Standard `skipWaiting` + `clients.claim` in `install` / `activate` |
| Permission prompts firing without a gesture | **No `init` invokes a permission-gated API**. Hard rule. Hardware/permission APIs are detect-only |
| Privacy: leaking PII in the receipt | Aggregate values only (no exact battery if charging anyway, no precise geo, no IP) |
| Console noise on normal pages | Single `console.groupCollapsed` — collapsed by default |
| Layout regressions | Only the article-meta toolbar adds DOM; absolute/relative positioning kept |
| Cloudflare caching the SW too aggressively | SW served with `max-age=0` explicitly |
| The PR is huge to review | Manifest + JS are append-only; reviewer can spot-check 5 entries |

---

## 8. Success criteria

- `cargo test` passes (manifest parity)
- DevTools opens → console shows the brutalist receipt header
- Receipt expands to ~12 groups, each with bullets
- Cmd+Shift+/ opens the receipt modal on either homepage or article
- Cmd+E triggers the EyeDropper (in supporting browsers)
- Cmd+H highlights typed term in article body
- Article-meta toolbar shows Share + Read aloud + Fullscreen (+ Pop out
  on supporting browsers)
- Service worker registers and the next reload is offline-capable
- Bundle delta < 6 KB brotli total
- No permission prompts fire without a user gesture
- All existing functionality unchanged (TOC, marquees, view transitions,
  visited state, etc.)

---

## 9. Out of scope (for this PR)

- Polish on each of the 95 detect-only entries (they're just feature
  detection). Future PRs can deepen any of them.
- WebGPU / WebXR / WebRTC / WebTransport / WebCodecs real demos — each
  is its own project.
- Push notifications (needs a real Push server)
- Background Sync real handlers (needs a real backend)
- Web Bluetooth / USB / Serial / HID / NFC / MIDI real demos (need
  hardware + user gesture)
- Web Payments / Web Authentication flows (needs real merchants / keys)

These would be follow-up PRs, each tied to a real product use case.

---

## 10. After-PR ideas

- "Receipt route" at `/api-receipt` that renders the full receipt as a
  styled page (server-rendered fallback for users without DevTools).
- Per-API "demo pages" linked from the receipt modal, each demonstrating
  one API in depth.
- GitHub Action that lints the manifest against the canonical MDN list
  via a fetched JSON.

---

**Ready to execute.** Once you OK this plan I'll commit it as
`_docs/web-api-experiences-plan.md`, then in a single push:

- write the 145-row manifest,
- build the registry framework + 25 substantive experiences + 120 stubs,
- wire the service worker + Cloudflare header,
- add the three visible toolbar buttons + drag-avatar + receipt modal +
  Cmd+H / Cmd+E,
- ship the Rust parity test,
- open the PR.
