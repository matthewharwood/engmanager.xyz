// Trash-can drag-and-drop for marquee chips.
//
// Pointer Events (mouse + touch + pen) — pointerdown on a chip clones
// it into a fixed-position ghost, hides the original, freezes the
// marquees (body[data-dragging="true"]) and shows a dashed blast
// radius around the trashcan. On pointermove we update the ghost's
// position and write `--trash-glow` based on proximity. On pointerup:
//   - inside accept zone → consume (animate into trash, hide all
//     instances of the chip across every marquee copy, increment the
//     counter, play the trash-drop SFX via ElevenLabs, shake the can)
//   - outside → fly the ghost back to the chip's original position
//     with a spring easing, then restore the original.
//
// Chip identity for cross-copy hide: dataset.chipId (server-rendered
// per chip). The marquee renders 4 copies of each group; hiding one
// instance would leave a gap in copy 1 but not 2-4, breaking the
// seamless loop, so we hide ALL copies with the same id.

const TRASH_SELECTOR = ".trash-can";
const DRAGGABLE_SELECTOR = ".marquee .chip";
const ACCEPT_RADIUS_PX = 110;
const GLOW_RADIUS_PX = 200;

let drag = null;

function startDrag(event) {
    if (event.button !== undefined && event.button !== 0) return;
    const chip = event.target.closest(DRAGGABLE_SELECTOR);
    if (!chip) return;
    if (chip.dataset.trashed === "true") return;
    if (chip.getAttribute("aria-hidden") === "true") return; // skip clone copies
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
    document.body.dataset.dragging = "true";

    drag = {
        chip,
        ghost,
        origin: rect,
        offset: { x: event.clientX - rect.left, y: event.clientY - rect.top },
        pointerId: event.pointerId,
    };

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
}

function onMove(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const x = event.clientX - drag.offset.x;
    const y = event.clientY - drag.offset.y;
    drag.ghost.style.left = `${x}px`;
    drag.ghost.style.top = `${y}px`;

    const trash = document.querySelector(TRASH_SELECTOR);
    if (!trash) return;
    const tr = trash.getBoundingClientRect();
    const tx = tr.left + tr.width / 2;
    const ty = tr.top + tr.height / 2;
    const dist = Math.hypot(event.clientX - tx, event.clientY - ty);
    const intensity = Math.max(0, Math.min(1, 1 - dist / GLOW_RADIUS_PX));
    document.documentElement.style.setProperty("--trash-glow", intensity.toFixed(3));
}

async function onUp(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    document.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerup", onUp);
    document.removeEventListener("pointercancel", onUp);

    const { chip, ghost, origin } = drag;
    drag = null;

    const trash = document.querySelector(TRASH_SELECTOR);
    let inRange = false;
    if (trash) {
        const tr = trash.getBoundingClientRect();
        const tx = tr.left + tr.width / 2;
        const ty = tr.top + tr.height / 2;
        const dist = Math.hypot(event.clientX - tx, event.clientY - ty);
        inRange = dist <= ACCEPT_RADIUS_PX;
    }

    document.documentElement.style.setProperty("--trash-glow", "0");

    if (inRange && trash) {
        await consume(ghost, trash, chip);
    } else {
        await flyBack(ghost, origin, chip);
    }

    delete document.body.dataset.dragging;
}

async function consume(ghost, trash, original) {
    const tr = trash.getBoundingClientRect();
    const dropX = tr.left + tr.width / 2 - parseFloat(ghost.style.width || "0") / 2;
    const dropY = tr.top - 4;

    await ghost.animate(
        [
            {
                left: ghost.style.left,
                top: ghost.style.top,
                transform: "scale(1) rotate(0deg)",
                opacity: 1,
            },
            {
                left: `${dropX}px`,
                top: `${dropY}px`,
                transform: "scale(0.18) rotate(380deg)",
                opacity: 0,
            },
        ],
        { duration: 360, easing: "cubic-bezier(0.5, 0, 0.8, 0.5)", fill: "forwards" },
    ).finished;

    ghost.remove();

    // Hide every copy of this chip across the marquee so the loop
    // stays balanced (4 copies per group, all need to disappear).
    const id = original.dataset.chipId;
    if (id) {
        document
            .querySelectorAll(`${DRAGGABLE_SELECTOR}[data-chip-id="${CSS.escape(id)}"]`)
            .forEach((c) => {
                c.style.visibility = "hidden";
                c.dataset.trashed = "true";
            });
    } else {
        original.style.visibility = "hidden";
        original.dataset.trashed = "true";
    }

    const countEl = document.querySelector("[data-trash-count]");
    if (countEl) {
        const next = parseInt(countEl.textContent || "0", 10) + 1;
        countEl.textContent = String(next);
        countEl.animate(
            [
                { transform: "scale(1)" },
                { transform: "scale(1.5)" },
                { transform: "scale(1)" },
            ],
            { duration: 360, easing: "cubic-bezier(0.5, 1.6, 0.5, 1)" },
        );
    }

    trash.animate(
        [
            { transform: "rotate(0)" },
            { transform: "rotate(-9deg) scale(1.12)" },
            { transform: "rotate(5deg) scale(1.06)" },
            { transform: "rotate(0) scale(1)" },
        ],
        { duration: 360, easing: "cubic-bezier(0.5, 1.6, 0.5, 1)" },
    );

    const sfxUrl = window.__engUrls?.trashSfx;
    if (sfxUrl) {
        try {
            const audio = new Audio(sfxUrl);
            audio.volume = 0.5;
            audio.play().catch(() => {});
        } catch {}
    }
}

async function flyBack(ghost, origin, original) {
    await ghost.animate(
        [
            { left: ghost.style.left, top: ghost.style.top },
            { left: `${origin.left}px`, top: `${origin.top}px` },
        ],
        {
            duration: 420,
            easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
            fill: "forwards",
        },
    ).finished;
    ghost.remove();
    original.style.visibility = "";
}

document.addEventListener("pointerdown", startDrag);
