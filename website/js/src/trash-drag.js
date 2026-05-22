// Trash-can drag-and-drop for homepage ephemera.
//
// Two surfaces feed the same bottom-right trash can:
//   - marquee chips: draggable from the topic marquees, hidden across
//     every marquee clone when dropped.
//   - visited article rows: only the checkbox hotspot is draggable.
//     The row is cloned, the original is kept invisible in-flow so the
//     stack does not collapse, and the clone shrinks/rotates into the
//     reader's hand until dropped.

const TRASH_SELECTOR = ".trash-can";
const CHIP_SELECTOR = ".marquee .chip";
const ARTICLE_CHECK_SELECTOR = ".article-fluid-link.is-visited .article-check";
const ARTICLE_LINK_SELECTOR = ".article-fluid-link.is-visited";
const ACCEPT_RADIUS_PX = 110;
const GLOW_RADIUS_PX = 200;
const ARTICLE_GHOST_SCALE = 0.18;

let drag = null;
let suppressNextArticleClick = false;

function startDrag(event) {
    if (event.button !== undefined && event.button !== 0) return;

    const articleCheck = event.target.closest?.(ARTICLE_CHECK_SELECTOR);
    const article = articleCheck?.closest(ARTICLE_LINK_SELECTOR);
    if (article && article.dataset.trashed !== "true") {
        startArticleDrag(event, article);
        return;
    }

    const chip = event.target.closest?.(CHIP_SELECTOR);
    if (!chip) return;
    if (chip.dataset.trashed === "true") return;
    if (chip.getAttribute("aria-hidden") === "true") return; // skip clone copies
    startChipDrag(event, chip);
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

    chip.style.visibility = "hidden";
    beginDrag({
        type: "chip",
        original: chip,
        ghost,
        origin: rect,
        offset: { x: event.clientX - rect.left, y: event.clientY - rect.top },
        pointerId: event.pointerId,
    });
}

function startArticleDrag(event, article) {
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

    article.style.visibility = "hidden";
    beginDrag({
        type: "article",
        original: article,
        ghost,
        origin: rect,
        offset: { x: rect.width / 2, y: rect.height / 2 },
        pointerId: event.pointerId,
    });
}

function beginDrag(session) {
    drag = session;
    document.body.dataset.dragging = "true";

    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
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
    document.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerup", onUp);
    document.removeEventListener("pointercancel", onUp);

    const { original, ghost, origin, type } = drag;
    drag = null;

    const trash = document.querySelector(TRASH_SELECTOR);
    const inRange = trash ? isInTrashRange(event, trash) : false;
    document.documentElement.style.setProperty("--trash-glow", "0");

    if (inRange && trash) {
        await consume(ghost, trash, original, type);
    } else {
        await flyBack(ghost, origin, original, type);
    }

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
        type === "article" ? tr.top + tr.height / 2 - height / 2 : tr.top - 4;
    const startTransform =
        ghost.style.transform ||
        (type === "article"
            ? `scale(${ARTICLE_GHOST_SCALE}) rotate(-45deg)`
            : "scale(1) rotate(0deg)");
    const endTransform =
        type === "article"
            ? "scale(0.035) rotate(18deg)"
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
    const sfxUrl = window.__engUrls?.trashSfx;
    if (!sfxUrl) return;
    try {
        const audio = new Audio(sfxUrl);
        audio.volume = 0.5;
        audio.play().catch(() => {});
    } catch {}
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
    original.style.visibility = "";
}

document.addEventListener("pointerdown", startDrag);

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
