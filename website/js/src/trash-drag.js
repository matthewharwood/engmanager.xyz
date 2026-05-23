// Trash-can drag-and-drop for homepage ephemera.
//
// Two surfaces feed the same bottom-right trash can:
//   - marquee chips: draggable from the topic marquees, hidden across
//     every marquee clone when dropped.
//   - visited article rows: only the checkbox hotspot is draggable.
//     The row is cloned, the original is kept invisible in-flow so the
//     stack does not collapse, and the clone shrinks/rotates into the
//     reader's hand until dropped.
//   - the background DVD logo: pointer-transparent, coordinate-caught,
//     and draggable into the same can.

const TRASH_SELECTOR = ".trash-can";
const CHIP_SELECTOR = ".marquee .chip";
const ARTICLE_CHECK_SELECTOR = ".article-fluid-link.is-visited .article-check";
const ARTICLE_LINK_SELECTOR = ".article-fluid-link.is-visited";
const DVD_SELECTOR = "[data-dvd-bouncer]";
const DVD_PROTECTED_TARGETS = ".trash, .quick-actions, .avatar-button, .home-search, #bio, #article-reveal, #api-receipt-modal";
const ACCEPT_RADIUS_PX = 110;
const GLOW_RADIUS_PX = 200;
const ARTICLE_GHOST_SCALE = 0.18;
const DVD_SPEED_X = 38;
const DVD_SPEED_Y = 27;
const DVD_CATCH_PAD_PX = 2;

let drag = null;
let suppressNextArticleClick = false;
let dvdState = null;

// During an active drag the original element is hidden but must stay
// in the hit-test tree so pointer capture remains valid on its
// captured descendant. `visibility:hidden` breaks that on iOS — use
// opacity + pointer-events instead. Resets are paired in showOriginal.
function hideOriginal(el) {
    el.style.opacity = "0";
    el.style.pointerEvents = "none";
}

function showOriginal(el) {
    el.style.opacity = "";
    el.style.pointerEvents = "";
}

function startDrag(event) {
    if (event.button !== undefined && event.button !== 0) return;

    if (isDvdCatch(event) && !event.target.closest?.(DVD_PROTECTED_TARGETS)) {
        startDvdDrag(event);
        return;
    }

    const articleCheck = event.target.closest?.(ARTICLE_CHECK_SELECTOR);
    const article = articleCheck?.closest(ARTICLE_LINK_SELECTOR);
    if (article && article.dataset.trashed !== "true") {
        startArticleDrag(event, article, articleCheck);
        return;
    }

    const chip = event.target.closest?.(CHIP_SELECTOR);
    if (!chip) return;
    if (chip.dataset.trashed === "true") return;
    if (chip.getAttribute("aria-hidden") === "true") return; // skip clone copies
    startChipDrag(event, chip);
}

function isDvdCatch(event) {
    const logo = dvdState?.node || document.querySelector(DVD_SELECTOR);
    if (!logo || logo.dataset.trashed === "true") return false;
    const rect = logo.getBoundingClientRect();
    return (
        event.clientX >= rect.left - DVD_CATCH_PAD_PX &&
        event.clientX <= rect.right + DVD_CATCH_PAD_PX &&
        event.clientY >= rect.top - DVD_CATCH_PAD_PX &&
        event.clientY <= rect.bottom + DVD_CATCH_PAD_PX
    );
}

function startChipDrag(event, chip) {
    event.preventDefault();

    const rect = chip.getBoundingClientRect();
    const ghost = chip.cloneNode(true);
    ghost.classList.add("chip-ghost");
    Object.assign(ghost.style, {
        position: "fixed",
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        margin: "0",
        zIndex: "1000",
        pointerEvents: "none",
    });
    document.body.appendChild(ghost);

    // Use opacity (not visibility) so the original stays interactive
    // enough for pointer capture on its descendants — iOS Safari drops
    // the capture if the captured node cascades into visibility:hidden,
    // and the touch then falls through to body where touch-action:auto
    // turns the drag into a scroll.
    hideOriginal(chip);
    beginDrag({
        type: "chip",
        original: chip,
        ghost,
        origin: rect,
        offset: { x: event.clientX - rect.left, y: event.clientY - rect.top },
        pointerId: event.pointerId,
        captureTarget: event.target,
    });
}

function startArticleDrag(event, article, articleCheck) {
    event.preventDefault();
    event.stopPropagation();
    suppressNextArticleClick = true;

    const rect = article.getBoundingClientRect();
    const ghost = article.cloneNode(true);
    ghost.classList.add("article-trash-ghost");
    ghost.setAttribute("aria-hidden", "true");
    Object.assign(ghost.style, {
        position: "fixed",
        left: `${event.clientX - rect.width / 2}px`,
        top: `${event.clientY - rect.height / 2}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        margin: "0",
        zIndex: "1000",
        pointerEvents: "none",
        transform: `scale(${ARTICLE_GHOST_SCALE}) rotate(-45deg)`,
        transformOrigin: "center",
    });
    document.body.appendChild(ghost);

    hideOriginal(article);
    beginDrag({
        type: "article",
        original: article,
        ghost,
        origin: rect,
        offset: { x: rect.width / 2, y: rect.height / 2 },
        pointerId: event.pointerId,
        captureTarget: articleCheck,
    });
}

function startDvdDrag(event) {
    const logo = dvdState?.node || document.querySelector(DVD_SELECTOR);
    if (!logo || logo.dataset.trashed === "true") return;

    event.preventDefault();
    event.stopPropagation();
    pauseDvdBouncer();

    const rect = logo.getBoundingClientRect();
    const ghost = logo.cloneNode(true);
    ghost.classList.add("dvd-bouncer-ghost");
    ghost.removeAttribute("data-dvd-bouncer");
    ghost.removeAttribute("data-caught");
    Object.assign(ghost.style, {
        position: "fixed",
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        margin: "0",
        zIndex: "1000",
        pointerEvents: "none",
        transform: "scale(1.08) rotate(-3deg)",
        transformOrigin: "center",
    });
    document.body.appendChild(ghost);

    hideOriginal(logo);
    beginDrag({
        type: "dvd",
        original: logo,
        ghost,
        origin: rect,
        offset: { x: event.clientX - rect.left, y: event.clientY - rect.top },
        pointerId: event.pointerId,
        captureTarget: document.body,
    });
}

function beginDrag(session) {
    drag = session;
    document.body.dataset.dragging = "true";

    try {
        session.captureTarget?.setPointerCapture?.(session.pointerId);
    } catch {}

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("blur", cancelDrag);
}

function onMove(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const x = event.clientX - drag.offset.x;
    const y = event.clientY - drag.offset.y;
    drag.ghost.style.left = `${x}px`;
    drag.ghost.style.top = `${y}px`;
    updateTrashGlow(event);
}

async function onUp(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const session = drag;
    drag = null;
    removeDragListeners();
    releasePointerCapture(session);

    const { original, ghost, origin, type } = session;
    const trash = document.querySelector(TRASH_SELECTOR);
    const inRange = trash ? isInTrashRange(event, trash) : false;
    document.documentElement.style.setProperty("--trash-glow", "0");
    finishDragState(type);

    try {
        if (inRange && trash) {
            await consume(ghost, trash, original, type);
        } else {
            await flyBack(ghost, origin, original, type);
        }
    } catch {
        ghost.remove();
        showOriginal(original);
        if (type === "dvd") resumeDvdBouncer(origin);
    }
}

function onCancel(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    void cancelDrag();
}

async function cancelDrag() {
    if (!drag) return;
    const session = drag;
    drag = null;
    removeDragListeners();
    releasePointerCapture(session);
    document.documentElement.style.setProperty("--trash-glow", "0");
    finishDragState(session.type);

    try {
        await flyBack(session.ghost, session.origin, session.original, session.type);
    } catch {
        session.ghost.remove();
        showOriginal(session.original);
        if (session.type === "dvd") resumeDvdBouncer(session.origin);
    }
}

function removeDragListeners() {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onCancel);
    window.removeEventListener("blur", cancelDrag);
}

function releasePointerCapture(session) {
    try {
        session.captureTarget?.releasePointerCapture?.(session.pointerId);
    } catch {}
}

function finishDragState(type) {
    delete document.body.dataset.dragging;
    if (type === "article") {
        setTimeout(() => {
            suppressNextArticleClick = false;
        }, 0);
    }
}

function updateTrashGlow(event) {
    const trash = document.querySelector(TRASH_SELECTOR);
    if (!trash) return;
    const tr = trash.getBoundingClientRect();
    const tx = tr.left + tr.width / 2;
    const ty = tr.top + tr.height / 2;
    const dist = Math.hypot(event.clientX - tx, event.clientY - ty);
    const intensity = Math.max(0, Math.min(1, 1 - dist / GLOW_RADIUS_PX));
    document.documentElement.style.setProperty("--trash-glow", intensity.toFixed(3));
}

function isInTrashRange(event, trash) {
    const tr = trash.getBoundingClientRect();
    const tx = tr.left + tr.width / 2;
    const ty = tr.top + tr.height / 2;
    const dist = Math.hypot(event.clientX - tx, event.clientY - ty);
    return dist <= ACCEPT_RADIUS_PX;
}

async function consume(ghost, trash, original, type) {
    const tr = trash.getBoundingClientRect();
    const width = parseFloat(ghost.style.width || "0");
    const height = parseFloat(ghost.style.height || "0");
    const dropX = tr.left + tr.width / 2 - width / 2;
    const dropY =
        type === "chip" ? tr.top - 4 : tr.top + tr.height / 2 - height / 2;
    const startTransform =
        ghost.style.transform ||
        (type === "article"
            ? `scale(${ARTICLE_GHOST_SCALE}) rotate(-45deg)`
            : "scale(1) rotate(0deg)");
    const endTransform =
        type === "article"
            ? "scale(0.035) rotate(18deg)"
            : type === "dvd"
              ? "scale(0.04) rotate(560deg)"
              : "scale(0.18) rotate(380deg)";

    await ghost.animate(
        [
            {
                left: ghost.style.left,
                top: ghost.style.top,
                transform: startTransform,
                opacity: 1,
            },
            {
                left: `${dropX}px`,
                top: `${dropY}px`,
                transform: endTransform,
                opacity: 0,
            },
        ],
        { duration: 360, easing: "cubic-bezier(0.5, 0, 0.8, 0.5)", fill: "forwards" },
    ).finished;

    ghost.remove();

    if (type === "chip") {
        hideChipCopies(original);
    } else if (type === "dvd") {
        original.style.visibility = "hidden";
        original.dataset.trashed = "true";
        stopDvdBouncer();
    } else {
        original.style.visibility = "hidden";
        original.dataset.trashed = "true";
        original.setAttribute("aria-hidden", "true");
        original.tabIndex = -1;
    }

    bumpTrashCounter();
    shakeTrash(trash);
    playTrashSfx();
}

function hideChipCopies(original) {
    const id = original.dataset.chipId;
    if (id) {
        document
            .querySelectorAll(`${CHIP_SELECTOR}[data-chip-id="${CSS.escape(id)}"]`)
            .forEach((chip) => {
                chip.style.visibility = "hidden";
                chip.dataset.trashed = "true";
            });
    } else {
        original.style.visibility = "hidden";
        original.dataset.trashed = "true";
    }
}

function bumpTrashCounter() {
    const countEl = document.querySelector("[data-trash-count]");
    if (!countEl) return;
    const next = parseInt(countEl.textContent || "0", 10) + 1;
    countEl.textContent = String(next);
    countEl.dataset.trashCount = String(next);
    countEl.animate(
        [
            { transform: "scale(1)" },
            { transform: "scale(1.5)" },
            { transform: "scale(1)" },
        ],
        { duration: 360, easing: "cubic-bezier(0.5, 1.6, 0.5, 1)" },
    );
}

function shakeTrash(trash) {
    trash.animate(
        [
            { transform: "rotate(0)" },
            { transform: "rotate(-9deg) scale(1.12)" },
            { transform: "rotate(5deg) scale(1.06)" },
            { transform: "rotate(0) scale(1)" },
        ],
        { duration: 360, easing: "cubic-bezier(0.5, 1.6, 0.5, 1)" },
    );
}

function playTrashSfx() {
    window.__engAudio?.play("trash", window.__engSfxUrls?.trash);
}

async function flyBack(ghost, origin, original, type) {
    const keyframes =
        type === "article"
            ? [
                  {
                      left: ghost.style.left,
                      top: ghost.style.top,
                      transform: ghost.style.transform,
                  },
                  {
                      left: `${origin.left}px`,
                      top: `${origin.top}px`,
                      transform: "scale(1) rotate(0deg)",
                  },
              ]
            : type === "dvd"
              ? [
                    {
                        left: ghost.style.left,
                        top: ghost.style.top,
                        transform: ghost.style.transform,
                    },
                    {
                        left: `${origin.left}px`,
                        top: `${origin.top}px`,
                        transform: "scale(1) rotate(0deg)",
                    },
                ]
            : [
                  { left: ghost.style.left, top: ghost.style.top },
                  { left: `${origin.left}px`, top: `${origin.top}px` },
              ];

    await ghost.animate(keyframes, {
        duration: 420,
        easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
        fill: "forwards",
    }).finished;
    ghost.remove();
    showOriginal(original);
    if (type === "dvd") resumeDvdBouncer(origin);
}

function initDvdBouncer() {
    const node = document.querySelector(DVD_SELECTOR);
    if (!node) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
        node.hidden = true;
        return;
    }

    dvdState = {
        node,
        x: Math.max(20, window.innerWidth * 0.16),
        y: Math.max(20, window.innerHeight * 0.18),
        vx: DVD_SPEED_X,
        vy: DVD_SPEED_Y,
        last: performance.now(),
        raf: 0,
        paused: false,
        tone: 0,
    };

    clampDvdBouncer();
    setDvdPosition();
    dvdState.raf = requestAnimationFrame(tickDvdBouncer);

    window.addEventListener("resize", () => {
        clampDvdBouncer();
        setDvdPosition();
    }, { passive: true });

    document.addEventListener("pointermove", updateDvdCatchState, { passive: true });
    document.addEventListener("pointerleave", () => {
        node.removeAttribute("data-caught");
    });
}

function tickDvdBouncer(now) {
    if (!dvdState || dvdState.node.dataset.trashed === "true") return;
    if (dvdState.paused || document.hidden) {
        dvdState.last = now;
        dvdState.raf = requestAnimationFrame(tickDvdBouncer);
        return;
    }

    const dt = Math.min(0.05, (now - dvdState.last) / 1000);
    dvdState.last = now;
    const { maxX, maxY } = dvdLimits();
    let bounced = false;

    dvdState.x += dvdState.vx * dt;
    dvdState.y += dvdState.vy * dt;

    if (dvdState.x <= 0 || dvdState.x >= maxX) {
        dvdState.x = Math.max(0, Math.min(maxX, dvdState.x));
        dvdState.vx *= -1;
        bounced = true;
    }
    if (dvdState.y <= 0 || dvdState.y >= maxY) {
        dvdState.y = Math.max(0, Math.min(maxY, dvdState.y));
        dvdState.vy *= -1;
        bounced = true;
    }

    if (bounced) bumpDvdTone();
    setDvdPosition();
    dvdState.raf = requestAnimationFrame(tickDvdBouncer);
}

function dvdLimits() {
    const rect = dvdState.node.getBoundingClientRect();
    return {
        maxX: Math.max(0, window.innerWidth - rect.width),
        maxY: Math.max(0, window.innerHeight - rect.height),
    };
}

function clampDvdBouncer() {
    if (!dvdState) return;
    const { maxX, maxY } = dvdLimits();
    dvdState.x = Math.max(0, Math.min(maxX, dvdState.x));
    dvdState.y = Math.max(0, Math.min(maxY, dvdState.y));
}

function setDvdPosition() {
    if (!dvdState) return;
    dvdState.node.style.setProperty("--dvd-x", `${Math.round(dvdState.x)}px`);
    dvdState.node.style.setProperty("--dvd-y", `${Math.round(dvdState.y)}px`);
    dvdState.node.style.setProperty(
        "--dvd-tilt",
        `${dvdState.vx > 0 ? -2 : 2}deg`,
    );
}

function bumpDvdTone() {
    if (!dvdState) return;
    dvdState.tone = (dvdState.tone + 1) % 5;
    dvdState.node.dataset.tone = String(dvdState.tone);
}

function pauseDvdBouncer() {
    if (!dvdState) return;
    dvdState.paused = true;
    dvdState.node.removeAttribute("data-caught");
}

function resumeDvdBouncer(origin) {
    if (!dvdState) return;
    dvdState.x = origin.left;
    dvdState.y = origin.top;
    clampDvdBouncer();
    setDvdPosition();
    dvdState.node.removeAttribute("data-caught");
    dvdState.last = performance.now();
    dvdState.paused = false;
}

function stopDvdBouncer() {
    if (!dvdState) return;
    dvdState.paused = true;
    cancelAnimationFrame(dvdState.raf);
    dvdState.node.removeAttribute("data-caught");
}

function updateDvdCatchState(event) {
    if (!dvdState || dvdState.node.dataset.trashed === "true" || dvdState.paused) return;
    dvdState.node.toggleAttribute("data-caught", isDvdCatch(event));
}

document.addEventListener("pointerdown", startDrag);
initDvdBouncer();

document.addEventListener(
    "click",
    (event) => {
        if (!suppressNextArticleClick) return;
        if (!event.target.closest?.(".article-fluid-link")) {
            suppressNextArticleClick = false;
            return;
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        suppressNextArticleClick = false;
    },
    true,
);
