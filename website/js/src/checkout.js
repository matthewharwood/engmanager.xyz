// On-site Stripe Elements checkout + confirmation.
//
// Two modes, switched on <body data-checkout-mode>:
//   "checkout" — mounts the Payment + Address Elements, prices the cart on the
//                server (deferred PaymentIntent), confirms inline.
//   "success"  — re-verifies the PaymentIntent and renders the confirmed
//                receipt (with a PAID stamp).
//
// The Stripe Appearance is built from the live CSS theme tokens (resolved via a
// hidden probe + a canvas so any of the 10 oklch themes converts cleanly to a
// color Stripe accepts), and re-applied whenever the theme picker fires
// `engmanager:themechange`.

const CONFIG = window.__checkout || {};
const CATALOG = window.__shopProducts || { products: [] };
const CART_KEY = "engmanager.shop.cart";
const ORDER_KEY = "engmanager.shop.lastOrder";

const productBySlug = new Map((CATALOG.products || []).map((p) => [p.slug, p]));

// --- small helpers --------------------------------------------------------

function $(sel) {
    return document.querySelector(sel);
}

function money(cents) {
    const dollars = Math.round(cents) / 100;
    return (
        "$" +
        (Number.isInteger(dollars)
            ? dollars.toLocaleString("en-US")
            : dollars.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
              }))
    );
}

function isEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function iconButton(label, ariaLabel, onClick) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = label;
    btn.setAttribute("aria-label", ariaLabel);
    btn.addEventListener("click", onClick);
    return btn;
}

// --- cart -----------------------------------------------------------------

function readCart() {
    try {
        const parsed = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

// Persist back in the EXACT { slug, size, quantity } shape shop.js reads/writes
// (CART_KEY) so the cart stays in sync across the shop and checkout. Size is
// fixed at "ONE SIZE" on both sides today; if real sizes land, both must carry it.
function writeCartModel(model) {
    try {
        localStorage.setItem(
            CART_KEY,
            JSON.stringify(
                model.map((i) => ({ slug: i.slug, size: "ONE SIZE", quantity: i.quantity })),
            ),
        );
    } catch {}
}

// Collapse the raw cart into [{ slug, quantity, product }], merging duplicate
// slugs and dropping anything no longer in the catalog.
function resolveCart() {
    const byslug = new Map();
    for (const item of readCart()) {
        const product = productBySlug.get(item.slug);
        if (!product) continue;
        const qty = Math.max(1, Math.min(99, Number(item.quantity) || 1));
        if (byslug.has(item.slug)) {
            byslug.get(item.slug).quantity = Math.min(99, byslug.get(item.slug).quantity + qty);
        } else {
            byslug.set(item.slug, { slug: item.slug, quantity: qty, product });
        }
    }
    return [...byslug.values()];
}

function subtotalCents(model) {
    return model.reduce((sum, i) => sum + Number(i.product.price) * 100 * i.quantity, 0);
}

// --- theme → Stripe Appearance bridge ------------------------------------

let _probe;
let _ctx;

function probe() {
    if (_probe && _probe.isConnected) return _probe;
    _probe = document.createElement("span");
    _probe.setAttribute("aria-hidden", "true");
    _probe.style.cssText =
        "position:absolute;left:-9999px;top:-9999px;width:0;height:0;opacity:0;pointer-events:none;";
    document.body.appendChild(_probe);
    return _probe;
}

function toHex(color) {
    try {
        if (!_ctx) _ctx = document.createElement("canvas").getContext("2d");
        _ctx.fillStyle = "#000";
        _ctx.fillStyle = color; // canvas parses oklch/rgb/hsl → normalized form
        const normalized = _ctx.fillStyle;
        if (typeof normalized === "string" && normalized.startsWith("#")) return normalized;
        _ctx.fillRect(0, 0, 1, 1);
        const [r, g, b] = _ctx.getImageData(0, 0, 1, 1).data;
        return "#" + [r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("");
    } catch {
        return null;
    }
}

function readColor(varName, fallback) {
    const p = probe();
    p.style.color = `var(${varName})`;
    const resolved = getComputedStyle(p).color;
    if (!resolved || resolved === "currentcolor") return fallback;
    return toHex(resolved) || fallback;
}

function readRadius(varName, fallback) {
    const p = probe();
    p.style.borderTopLeftRadius = `var(${varName})`;
    const r = getComputedStyle(p).borderTopLeftRadius;
    return /px|rem|em/.test(r) ? r : fallback;
}

function withAlpha(hex, alpha) {
    const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || "");
    if (!m) return hex;
    const [r, g, b] = [m[1], m[2], m[3]].map((h) => parseInt(h, 16));
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function buildAppearance() {
    const surface1 = readColor("--surface-1", "#ffffff");
    const surface2 = readColor("--surface-2", "#f4f4f5");
    const text1 = readColor("--text-1", "#111111");
    const text2 = readColor("--text-2", "#555555");
    const muted = readColor("--text-muted", "#8a8a8a");
    const primary = readColor("--color-primary", "#4c4fdd");
    const danger = readColor("--color-error", "#e5484d");
    const border = readColor("--border-muted", "#dcdcdc");
    const radius = readRadius("--radius-field", "10px");

    return {
        theme: "stripe",
        variables: {
            colorPrimary: primary,
            colorBackground: surface1,
            colorText: text1,
            colorTextSecondary: text2,
            colorTextPlaceholder: muted,
            colorDanger: danger,
            colorIconTabSelected: primary,
            fontFamily:
                '"Archivo", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
            fontSizeBase: "16px",
            borderRadius: radius,
            spacingUnit: "4px",
        },
        rules: {
            ".Input": {
                backgroundColor: surface2,
                border: `1px solid ${border}`,
                boxShadow: "none",
                color: text1,
            },
            ".Input:focus": {
                border: `1px solid ${primary}`,
                boxShadow: `0 0 0 3px ${withAlpha(primary, 0.25)}`,
            },
            ".Input--invalid": { border: `1px solid ${danger}`, color: text1 },
            ".Label": {
                color: text2,
                fontWeight: "700",
                fontSize: "0.78rem",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
            },
            ".Tab": { backgroundColor: surface2, border: `1px solid ${border}`, color: text1 },
            ".Tab--selected": { borderColor: primary, color: primary },
            ".Error": { color: danger },
        },
    };
}

// --- receipt rendering (shared by both modes) -----------------------------

function miniCap(colors) {
    const cap = document.createElement("span");
    cap.className = "mini-cap";
    cap.setAttribute("aria-hidden", "true");
    cap.style.setProperty("--cap", colors.cap);
    cap.style.setProperty("--thread", colors.thread);
    cap.style.setProperty("--accent", colors.accent);
    const crown = document.createElement("span");
    crown.className = "mini-cap-crown";
    const brim = document.createElement("span");
    brim.className = "mini-cap-brim";
    const dot = document.createElement("span");
    dot.className = "mini-cap-dot";
    cap.append(crown, brim, dot);
    return cap;
}

function setText(sel, value) {
    const el = $(sel);
    if (el) el.textContent = value;
}

function updateTotals(model) {
    const subtotal = subtotalCents(model);
    setText("[data-receipt-subtotal]", money(subtotal));
    setText("[data-receipt-shipping]", "Free");
    setText("[data-receipt-tax]", "—");
    setText("[data-receipt-total]", money(subtotal));
    return subtotal;
}

// --- checkout mode --------------------------------------------------------

let stripe;
let elements;
let paymentElement;
let addressElement;
let cartModel = [];
let currentAmount = 0;
let busy = false;
let elementsReady = false;

const STATES = {
    loading: "[data-checkout-loading]",
    disabled: "[data-checkout-disabled]",
    empty: "[data-checkout-empty]",
    grid: "[data-checkout-grid]",
};

function showState(name) {
    for (const [key, sel] of Object.entries(STATES)) {
        const el = $(sel);
        if (el) el.hidden = key !== name;
    }
}

function payLabel() {
    return `Pay ${money(currentAmount)}`;
}

function refreshPayButton() {
    const btn = $("[data-checkout-pay]");
    if (!btn) return;
    const label = $("[data-pay-label]");
    if (label && !busy) label.textContent = payLabel();
    btn.disabled = busy || !elementsReady || cartModel.length === 0 || currentAmount < 50;
}

function setBusy(value) {
    busy = value;
    const btn = $("[data-checkout-pay]");
    const label = $("[data-pay-label]");
    const spinner = $("[data-pay-spinner]");
    if (label) label.textContent = value ? "Processing…" : payLabel();
    if (spinner) spinner.hidden = !value;
    refreshPayButton();
}

function showError(message) {
    const el = $("[data-checkout-error]");
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
    el.scrollIntoView({ block: "nearest", behavior: prefersReducedMotion() ? "auto" : "smooth" });
}

function clearError() {
    const el = $("[data-checkout-error]");
    if (el) {
        el.textContent = "";
        el.hidden = true;
    }
}

function clearSkeleton(sel) {
    const host = $(sel);
    const skeleton = host && host.querySelector(".checkout-element-skeleton");
    if (skeleton) skeleton.remove();
}

function renderReceipt() {
    const linesEl = $("[data-receipt-lines]");
    if (linesEl) {
        linesEl.textContent = "";
        for (const item of cartModel) {
            linesEl.append(receiptLine(item));
        }
    }
    currentAmount = updateTotals(cartModel);
    refreshPayButton();
}

function receiptLine(item) {
    const li = document.createElement("li");
    li.className = "receipt-line";

    const head = document.createElement("div");
    head.className = "receipt-line-head";
    head.append(miniCap(item.product.colors));
    const name = document.createElement("span");
    name.className = "receipt-line-name";
    name.textContent = item.product.name;
    head.append(name);

    const price = document.createElement("span");
    price.className = "receipt-line-price";
    price.textContent = money(item.product.price * 100 * item.quantity);

    const controls = document.createElement("div");
    controls.className = "receipt-qty";
    controls.setAttribute("role", "group");
    controls.setAttribute("aria-label", `Quantity for ${item.product.name}`);
    const minus = iconButton("–", `Decrease ${item.product.name}`, () =>
        changeQty(item.slug, -1),
    );
    minus.className = "receipt-qty-btn";
    const qty = document.createElement("span");
    qty.className = "receipt-qty-val";
    qty.textContent = String(item.quantity);
    const plus = iconButton("+", `Increase ${item.product.name}`, () => changeQty(item.slug, 1));
    plus.className = "receipt-qty-btn";
    const remove = iconButton("×", `Remove ${item.product.name}`, () => removeItem(item.slug));
    remove.className = "receipt-remove";
    controls.append(minus, qty, plus, remove);

    const top = document.createElement("div");
    top.className = "receipt-line-top";
    top.append(head, price);

    li.append(top, controls);
    return li;
}

function changeQty(slug, delta) {
    const item = cartModel.find((i) => i.slug === slug);
    if (!item) return;
    item.quantity = Math.max(1, Math.min(99, item.quantity + delta));
    persistAndSync();
}

function removeItem(slug) {
    cartModel = cartModel.filter((i) => i.slug !== slug);
    persistAndSync();
    if (!cartModel.length) showState("empty");
}

function persistAndSync() {
    writeCartModel(cartModel);
    renderReceipt();
    if (elements && currentAmount >= 50) {
        try {
            elements.update({ amount: currentAmount });
        } catch {}
    }
}

async function initCheckout() {
    cartModel = resolveCart();

    if (!CONFIG.enabled || !CONFIG.publishableKey || typeof window.Stripe !== "function") {
        showState("disabled");
        return;
    }
    if (!cartModel.length) {
        showState("empty");
        return;
    }

    stripe = window.Stripe(CONFIG.publishableKey);
    renderReceipt();
    showState("grid");

    elements = stripe.elements({
        mode: "payment",
        amount: currentAmount,
        currency: CONFIG.currency || "usd",
        appearance: buildAppearance(),
    });

    addressElement = elements.create("address", { mode: "shipping" });
    addressElement.mount("[data-address-element]");
    addressElement.on("ready", () => clearSkeleton("[data-address-element]"));

    paymentElement = elements.create("payment", { layout: { type: "tabs" } });
    paymentElement.mount("[data-payment-element]");
    paymentElement.on("ready", () => {
        clearSkeleton("[data-payment-element]");
        elementsReady = true;
        refreshPayButton();
    });

    const form = $("[data-checkout-form]");
    if (form) form.addEventListener("submit", onPay);

    window.addEventListener("engmanager:themechange", () => {
        if (elements) {
            try {
                elements.update({ appearance: buildAppearance() });
            } catch {}
        }
    });
}

async function onPay(event) {
    event.preventDefault();
    if (busy) return;
    clearError();

    const emailInput = $("[data-checkout-email]");
    const email = (emailInput && emailInput.value.trim()) || "";
    if (!isEmail(email)) {
        showError("Enter a valid email so we can send your confirmation.");
        if (emailInput) emailInput.focus();
        return;
    }
    cartModel = resolveCart();
    if (!cartModel.length) {
        showState("empty");
        return;
    }

    setBusy(true);

    // 1) Validate the mounted Elements before creating the intent.
    const submitResult = await elements.submit();
    if (submitResult.error) {
        showError(submitResult.error.message || "Double-check your details and try again.");
        setBusy(false);
        return;
    }

    // 2) Read the shipping address (best-effort).
    let shipping = null;
    try {
        const addr = await addressElement.getValue();
        if (addr && addr.value && addr.value.address) {
            const v = addr.value;
            shipping = {
                name: v.name || null,
                line1: v.address.line1 || null,
                line2: v.address.line2 || null,
                city: v.address.city || null,
                state: v.address.state || null,
                postal_code: v.address.postal_code || null,
                country: v.address.country || null,
            };
        }
    } catch {}

    // 3) Mint the PaymentIntent server-side (server prices the cart).
    let data;
    try {
        const resp = await fetch("/api/checkout/intent", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                items: cartModel.map((i) => ({ slug: i.slug, quantity: i.quantity })),
                email,
                shipping,
            }),
        });
        data = await resp.json().catch(() => ({}));
        if (!resp.ok || !data.clientSecret) {
            showError(data.error || "We couldn’t start the payment. Please try again.");
            setBusy(false);
            return;
        }
    } catch {
        showError("Network hiccup. Check your connection and try again.");
        setBusy(false);
        return;
    }

    // Hand the order to the success page (survives a same-tab 3DS redirect).
    stashOrder(data, email, shipping);

    // 4) Confirm. redirect:"if_required" keeps card payments on-page; methods
    //    that need a redirect bounce to return_url and resolve there.
    const returnUrl = new URL(
        CONFIG.returnPath || "/checkout/success",
        window.location.origin,
    ).toString();
    const result = await stripe.confirmPayment({
        elements,
        clientSecret: data.clientSecret,
        confirmParams: { return_url: returnUrl, receipt_email: email },
        redirect: "if_required",
    });

    if (result.error) {
        showError(result.error.message || "Your payment couldn’t be completed.");
        setBusy(false);
        return;
    }
    onPaid(result.paymentIntent, data);
}

function stashOrder(data, email, shipping) {
    try {
        const order = {
            paymentIntentId: data.paymentIntentId || "",
            clientSecret: data.clientSecret || "",
            amount: data.amount || subtotalCents(cartModel),
            email,
            shipping,
            items: cartModel.map((i) => ({
                slug: i.slug,
                name: i.product.name,
                quantity: i.quantity,
                price: i.product.price,
                colors: i.product.colors,
            })),
            when: new Date().toISOString(),
        };
        sessionStorage.setItem(ORDER_KEY, JSON.stringify(order));
    } catch {}
}

function onPaid(paymentIntent, data) {
    writeCartModel([]);
    stampReceipt();
    const done = $("[data-checkout-done]");
    if (done) done.hidden = false;
    setText("[data-done-text]", "Payment confirmed — preparing your receipt…");

    const id = (paymentIntent && paymentIntent.id) || data.paymentIntentId || "";
    const cs = (paymentIntent && paymentIntent.client_secret) || data.clientSecret || "";
    const url =
        "/checkout/success?payment_intent=" +
        encodeURIComponent(id) +
        "&payment_intent_client_secret=" +
        encodeURIComponent(cs) +
        "&redirect_status=succeeded";
    window.setTimeout(
        () => window.location.assign(url),
        prefersReducedMotion() ? 250 : 1400,
    );
}

function stampReceipt() {
    const stamp = $("[data-receipt-stamp]");
    if (stamp) stamp.dataset.show = "true";
    setText("[data-receipt-meta]", "PAID");
}

// --- success mode ---------------------------------------------------------

function readStash() {
    try {
        const raw = sessionStorage.getItem(ORDER_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function clearStash() {
    try {
        sessionStorage.removeItem(ORDER_KEY);
    } catch {}
}

function showConfirm(name) {
    const map = {
        loading: "[data-confirm-loading]",
        error: "[data-confirm-error]",
        ok: "[data-confirm-ok]",
    };
    for (const [key, sel] of Object.entries(map)) {
        const el = $(sel);
        if (el) el.hidden = key !== name;
    }
}

function showConfirmError(message) {
    setText("[data-confirm-error-msg]", message);
    showConfirm("error");
}

function shortOrderId(piId) {
    if (!piId) return "—";
    const tail = piId.replace(/^pi_/, "").slice(-8).toUpperCase();
    return `#${tail}`;
}

function renderConfirmed(stash, paymentIntent) {
    const linesEl = $("[data-receipt-lines]");
    let subtotal = 0;

    if (stash && Array.isArray(stash.items) && stash.items.length) {
        if (linesEl) linesEl.textContent = "";
        for (const item of stash.items) {
            const product = productBySlug.get(item.slug) || {
                name: item.name,
                colors: item.colors || { cap: "#ccc", thread: "#333", accent: "#888" },
            };
            const qty = Number(item.quantity) || 1;
            const price = Number(item.price) || 0;
            subtotal += price * 100 * qty;
            if (linesEl) {
                linesEl.append(
                    receiptLine({ slug: item.slug, quantity: qty, product }),
                );
            }
        }
        // Confirmation receipts are read-only — strip the qty controls.
        document.querySelectorAll("[data-receipt-lines] .receipt-qty").forEach((c) => c.remove());
    }

    const amount =
        (paymentIntent && typeof paymentIntent.amount === "number" && paymentIntent.amount) ||
        (stash && stash.amount) ||
        subtotal;
    setText("[data-receipt-subtotal]", money(amount));
    setText("[data-receipt-shipping]", "Free");
    setText("[data-receipt-tax]", "—");
    setText("[data-receipt-total]", money(amount));

    const piId = (paymentIntent && paymentIntent.id) || (stash && stash.paymentIntentId) || "";
    setText("[data-receipt-meta]", `ORDER ${shortOrderId(piId)}`);
    setText("[data-receipt-foot]", "PAID IN FULL · THANK YOU");
    stampReceipt();

    const email = (stash && stash.email) || "";
    let lede = email ? `A receipt is on its way to ${email}.` : "Your order is confirmed.";
    if (stash && stash.shipping && stash.shipping.name) {
        const city = stash.shipping.city ? `, ${stash.shipping.city}` : "";
        lede += ` Shipping to ${stash.shipping.name}${city}.`;
    }
    setText("[data-confirm-email]", lede);

    showConfirm("ok");
    clearStash();
}

async function initSuccess() {
    const params = new URLSearchParams(window.location.search);
    const clientSecret = params.get("payment_intent_client_secret");
    const stash = readStash();

    const haveStripe = CONFIG.publishableKey && typeof window.Stripe === "function";
    if (!haveStripe || !clientSecret) {
        if (stash) {
            renderConfirmed(stash, null);
        } else if (clientSecret) {
            // We have a payment reference but can't verify it here (Stripe.js
            // blocked); don't claim the link is broken.
            showConfirmError(
                "We couldn’t load the confirmation here, but your payment may have gone through — check your email for a receipt.",
            );
        } else {
            showConfirmError("This confirmation link is missing its payment reference.");
        }
        return;
    }

    stripe = window.Stripe(CONFIG.publishableKey);
    try {
        const { paymentIntent, error } = await stripe.retrievePaymentIntent(clientSecret);
        if (error || !paymentIntent) {
            if (stash) renderConfirmed(stash, null);
            else showConfirmError("We couldn’t look up this order.");
            return;
        }
        if (paymentIntent.status === "succeeded" || paymentIntent.status === "processing") {
            renderConfirmed(stash, paymentIntent);
        } else if (paymentIntent.status === "requires_payment_method") {
            showConfirmError("That payment didn’t go through. Your card was not charged.");
        } else {
            showConfirmError(`This payment is currently ${paymentIntent.status.replace(/_/g, " ")}.`);
        }
    } catch {
        if (stash) renderConfirmed(stash, null);
        else showConfirmError("We couldn’t confirm this order automatically.");
    }
}

// --- boot -----------------------------------------------------------------

function boot() {
    const mode = document.body.dataset.checkoutMode || CONFIG.mode || "checkout";
    const run = mode === "success" ? initSuccess : initCheckout;
    // Catch both sync throws and async rejections so a failure never strands the
    // page in its loading state.
    Promise.resolve()
        .then(run)
        .catch((err) => {
            console.error("checkout init failed:", err);
            if (mode === "success") showConfirmError("We couldn’t load this confirmation.");
            else showState("disabled");
        });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
} else {
    boot();
}
