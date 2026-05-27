const CART_KEY = "engmanager.shop.cart";
const EMPTY_STATE = "Your cap stack is empty.";

const catalog = window.__shopProducts || { products: [] };
const products = Array.isArray(catalog.products) ? catalog.products : [];
const productBySlug = new Map(products.map((product) => [product.slug, product]));

const selectors = {
    grid: document.querySelector("[data-shop-grid]"),
    panel: document.querySelector("[data-product-panel]"),
    backdrop: document.querySelector("[data-shop-backdrop]"),
    productTitle: document.querySelector("[data-product-title]"),
    productKicker: document.querySelector("[data-product-kicker]"),
    productCopyTitle: document.querySelector("[data-product-copy-title]"),
    productPrice: document.querySelector("[data-product-price]"),
    productDescription: document.querySelector("[data-product-description]"),
    imageStage: document.querySelector("[data-image-advance]"),
    productImage: document.querySelector("[data-product-image]"),
    imageCaption: document.querySelector("[data-image-caption]"),
    imageThumbs: document.querySelector("[data-image-thumbs]"),
    sizeSheet: document.querySelector("[data-size-sheet]"),
    sizeToggle: document.querySelector("[data-size-toggle]"),
    sizePrice: document.querySelector("[data-size-price]"),
    sizeInfo: document.querySelector("[data-size-info]"),
    sizeInfoCopy: document.querySelector("[data-size-info-copy]"),
    quantityValue: document.querySelector("[data-quantity-value]"),
    cartToggles: document.querySelectorAll("[data-cart-toggle]"),
    cartDrawer: document.querySelector("[data-cart-drawer]"),
    cartCounts: document.querySelectorAll("[data-cart-count]"),
    cartItems: document.querySelector("[data-cart-items]"),
    cartTotal: document.querySelector("[data-cart-total]"),
};

let currentProduct = null;
let currentImageIndex = 0;
let selectedSize = "2";
let quantity = 1;
let cart = readCart();
let activeCarouselAnimation = null;
let carouselMotion = { x: 0, scale: 1, rotate: 0, opacity: 1 };
let dragState = null;
let suppressNextImageAdvance = false;
let activeProductFlight = null;
let productTransitionActive = false;
let lastOpenedProductSlug = null;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function readCart() {
    try {
        const parsed = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function writeCart() {
    try {
        localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch {}
}

function getProductFromLocation() {
    const params = new URLSearchParams(window.location.search);
    const pathMatch = window.location.pathname.match(/^\/products\/([^/]+)\/?$/);
    const slug = pathMatch ? decodeURIComponent(pathMatch[1]) : params.get("product");
    if (!slug || !productBySlug.has(slug)) return null;
    return {
        product: productBySlug.get(slug),
        imageId: params.get("image") || "front",
    };
}

function productUrl(product, imageId) {
    const url = new URL(window.location.href);
    url.pathname = `/products/${encodeURIComponent(product.slug)}`;
    url.search = "";
    url.searchParams.set("image", imageId || "front");
    url.hash = "";
    return url;
}

function homeUrl() {
    const url = new URL(window.location.href);
    url.pathname = "/";
    url.search = "";
    url.hash = "";
    return url;
}

function showBackdrop() {
    if (!selectors.backdrop) return;
    selectors.backdrop.hidden = false;
}

function maybeHideBackdrop() {
    if (!selectors.backdrop) return;
    if (isProductOpen() || isCartOpen()) return;
    selectors.backdrop.hidden = true;
}

function isProductOpen() {
    return selectors.panel && !selectors.panel.hidden;
}

function isCartOpen() {
    return selectors.cartDrawer && !selectors.cartDrawer.hidden;
}

function nextFrame() {
    return new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
}

function waitForImageReady(image) {
    if (!image || (image.complete && image.naturalWidth > 0)) return Promise.resolve();
    return new Promise((resolve) => {
        const finish = () => resolve();
        image.addEventListener("load", finish, { once: true });
        image.addEventListener("error", finish, { once: true });
        window.setTimeout(finish, 180);
    });
}

function slugSelector(slug) {
    const escaped = window.CSS?.escape ? CSS.escape(slug) : slug.replace(/"/g, '\\"');
    return `[data-slug="${escaped}"]`;
}

function cardForSlug(slug) {
    return slug ? selectors.grid?.querySelector(slugSelector(slug)) : null;
}

function cardImageForSlug(slug) {
    return cardForSlug(slug)?.querySelector("img") || null;
}

function rectForElement(element) {
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
    };
}

function hideForProductFlight(element, hidden) {
    element?.classList.toggle("is-shop-transition-hidden", hidden);
}

function runShopViewTransition(update, afterReady) {
    const startViewTransition = document.startViewTransition?.bind(document);
    if (!startViewTransition) {
        update();
        afterReady?.();
        return;
    }

    let transition = null;
    try {
        transition = startViewTransition(update);
    } catch {
        update();
        afterReady?.();
        return;
    }
    transition.ready.then(() => afterReady?.()).catch(() => afterReady?.());
    transition.finished.catch(() => {});
}

function stopProductFlight() {
    activeProductFlight?.pause?.();
    activeProductFlight?.cancel?.();
    activeProductFlight = null;
}

async function animateProductFlight(options) {
    const {
        sourceElement = null,
        targetElement = null,
        fromRect,
        toRect = null,
        imageSrc,
        direction = "open",
    } = options;

    if (reduceMotion.matches || !fromRect) return;
    await waitForImageReady(targetElement);
    await nextFrame();

    const targetRect = toRect || rectForElement(targetElement);
    if (!targetRect) return;

    stopProductFlight();
    productTransitionActive = true;
    document.body.classList.add("shop-view-transitioning");

    const clone = document.createElement("img");
    clone.className = "shop-transition-image";
    clone.alt = "";
    clone.decoding = "async";
    clone.src = imageSrc || sourceElement?.currentSrc || sourceElement?.src || targetElement?.currentSrc || targetElement?.src || "";
    clone.style.inlineSize = `${fromRect.width}px`;
    clone.style.blockSize = `${fromRect.height}px`;
    document.body.append(clone);

    hideForProductFlight(sourceElement, true);
    hideForProductFlight(targetElement, true);

    const state = {
        x: fromRect.left,
        y: fromRect.top,
        scaleX: 1,
        scaleY: 1,
        rotate: direction === "open" ? -0.8 : 0.65,
        opacity: 0.96,
    };
    const end = {
        x: targetRect.left,
        y: targetRect.top,
        scaleX: targetRect.width / fromRect.width,
        scaleY: targetRect.height / fromRect.height,
        rotate: 0,
        opacity: 1,
    };
    const render = () => {
        clone.style.opacity = String(state.opacity);
        clone.style.transform = [
            `translate3d(${state.x}px, ${state.y}px, 0)`,
            `scale(${state.scaleX}, ${state.scaleY})`,
            `rotate(${state.rotate}deg)`,
        ].join(" ");
        clone.style.filter = `drop-shadow(0 ${Math.max(8, 20 * state.scaleY)}px ${Math.max(14, 24 * state.scaleY)}px rgb(25 28 40 / 0.12))`;
    };
    const cleanup = () => {
        hideForProductFlight(sourceElement, false);
        hideForProductFlight(targetElement, false);
        clone.remove();
        activeProductFlight = null;
        productTransitionActive = false;
        document.body.classList.remove("shop-view-transitioning");
    };

    render();
    const duration = direction === "open" ? 640 : 520;
    const ease = direction === "open" ? "out(4)" : "inOut(3)";
    const animeApi = window.anime;

    if (animeApi?.animate) {
        activeProductFlight = animeApi.animate(state, {
            x: end.x,
            y: end.y,
            scaleX: end.scaleX,
            scaleY: end.scaleY,
            rotate: end.rotate,
            opacity: end.opacity,
            duration,
            ease,
            onUpdate: render,
            onComplete: cleanup,
        });
        return;
    }

    if (typeof animeApi === "function") {
        activeProductFlight = animeApi({
            targets: state,
            x: end.x,
            y: end.y,
            scaleX: end.scaleX,
            scaleY: end.scaleY,
            rotate: end.rotate,
            opacity: end.opacity,
            duration,
            easing: direction === "open" ? "easeOutQuart" : "easeInOutCubic",
            update: render,
            complete: cleanup,
        });
        return;
    }

    clone.animate(
        [
            {
                transform: `translate3d(${fromRect.left}px, ${fromRect.top}px, 0) scale(1, 1) rotate(${state.rotate}deg)`,
                opacity: 0.96,
            },
            {
                transform: `translate3d(${end.x}px, ${end.y}px, 0) scale(${end.scaleX}, ${end.scaleY}) rotate(0deg)`,
                opacity: 1,
            },
        ],
        { duration, easing: "cubic-bezier(.22,.9,.2,1)" },
    ).addEventListener("finish", cleanup, { once: true });
}

function openProductFromCard(product, imageId, card, options = {}) {
    if (productTransitionActive) return;
    const sourceImage = card?.querySelector("img");
    const fromRect = rectForElement(sourceImage);
    const imageSrc = sourceImage?.currentSrc || sourceImage?.src;
    lastOpenedProductSlug = product.slug;

    runShopViewTransition(
        () => openProduct(product, imageId, options),
        () => {
            animateProductFlight({
                sourceElement: sourceImage,
                targetElement: selectors.productImage,
                fromRect,
                imageSrc,
                direction: "open",
            });
        },
    );
}

function closeProductWithTransition(options = {}) {
    if (productTransitionActive) return;
    const product = currentProduct;
    const slug = product?.slug || lastOpenedProductSlug;
    const sourceImage = selectors.productImage;
    const targetImage = cardImageForSlug(slug);
    const fromRect = rectForElement(sourceImage);
    const toRect = rectForElement(targetImage);
    const imageSrc = sourceImage?.currentSrc || sourceImage?.src;
    const willAnimate = Boolean(fromRect && toRect && !reduceMotion.matches);

    if (willAnimate) {
        hideForProductFlight(targetImage, true);
    }

    runShopViewTransition(
        () => closeProduct(options),
        () => {
            animateProductFlight({
                sourceElement: sourceImage,
                targetElement: targetImage,
                fromRect,
                toRect,
                imageSrc,
                direction: "close",
            });
        },
    );
}

function openProduct(product, imageId = "front", options = {}) {
    if (!product || !selectors.panel) return;
    const { replace = false, push = true } = options;
    currentProduct = product;
    currentImageIndex = imageIndex(product, imageId);
    selectedSize = selectedSize || "2";
    quantity = Math.max(1, quantity || 1);

    renderProduct(product);
    selectImage(currentImageIndex, { updateUrl: false });
    setCarouselMotion(0, 1, 0, 1);
    syncSizeControls();
    closeSizeSheet();

    selectors.panel.hidden = false;
    selectors.panel.setAttribute("aria-hidden", "false");
    document.body.classList.add("shop-panel-open");
    showBackdrop();

    if (push) {
        const url = productUrl(product, product.images[currentImageIndex]?.id);
        window.history[replace ? "replaceState" : "pushState"](
            { shopProduct: product.slug },
            "",
            url,
        );
    }
}

function closeProduct(options = {}) {
    const { push = true } = options;
    if (!selectors.panel) return;
    closeSizeSheet();
    selectors.panel.hidden = true;
    selectors.panel.setAttribute("aria-hidden", "true");
    document.body.classList.remove("shop-panel-open");
    currentProduct = null;
    maybeHideBackdrop();
    if (push) {
        window.history.pushState({}, "", homeUrl());
    }
}

function renderProduct(product) {
    setText(selectors.productTitle, product.name);
    setText(selectors.productKicker, "Dad cap");
    setText(selectors.productCopyTitle, product.name);
    setText(selectors.productPrice, product.priceLabel);
    setText(selectors.productDescription, product.description);
    setText(selectors.sizePrice, product.priceLabel);
    setText(
        selectors.sizeInfoCopy,
        `Size 1 is snug, 2 is everyday, 3 is big-brim energy. ${product.phrase} ships here as a storefront concept.`,
    );
    renderThumbs(product);
}

function renderThumbs(product) {
    if (!selectors.imageThumbs) return;
    selectors.imageThumbs.textContent = "";
    product.images.forEach((image, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "shop-thumb";
        button.dataset.imageIndex = String(index);
        button.setAttribute("aria-label", `Show ${image.label} view`);
        button.setAttribute("aria-selected", index === currentImageIndex ? "true" : "false");

        const thumb = document.createElement("img");
        thumb.src = image.url;
        thumb.alt = "";
        thumb.width = 180;
        thumb.height = 180;
        thumb.loading = "lazy";
        thumb.decoding = "async";

        const label = document.createElement("span");
        label.textContent = image.label;

        button.append(thumb, label);
        selectors.imageThumbs.append(button);
    });
}

function imageIndex(product, imageId) {
    const index = product.images.findIndex((image) => image.id === imageId);
    return index >= 0 ? index : 0;
}

function selectImage(index, options = {}) {
    if (!currentProduct || !selectors.productImage) return;
    const { updateUrl = true, resetMotion = true } = options;
    const images = currentProduct.images;
    currentImageIndex = (index + images.length) % images.length;
    const image = images[currentImageIndex];
    selectors.productImage.src = image.url;
    selectors.productImage.alt = `${currentProduct.name} embroidered dad cap ${image.label.toLowerCase()} view`;
    setText(selectors.imageCaption, image.caption);

    selectors.imageThumbs?.querySelectorAll("[data-image-index]").forEach((button) => {
        button.setAttribute(
            "aria-selected",
            button.dataset.imageIndex === String(currentImageIndex) ? "true" : "false",
        );
    });

    if (updateUrl) {
        window.history.replaceState(
            { shopProduct: currentProduct.slug, image: image.id },
            "",
            productUrl(currentProduct, image.id),
        );
    }

    if (resetMotion) {
        setCarouselMotion(0, 1, 0, 1);
    }
}

function carouselWidth() {
    return selectors.imageStage?.getBoundingClientRect().width || 320;
}

function setCarouselMotion(x, scale = 1, rotate = 0, opacity = 1) {
    carouselMotion = { x, scale, rotate, opacity };
    if (!selectors.imageStage) return;
    selectors.imageStage.style.transform = `translate3d(${x}px, 0, 0) scale(${scale}) rotate(${rotate}deg)`;
    selectors.imageStage.style.opacity = String(opacity);
}

function stopCarouselAnimation() {
    activeCarouselAnimation?.pause?.();
    activeCarouselAnimation?.cancel?.();
    activeCarouselAnimation = null;
}

function animateCarouselMotion(to, options = {}) {
    stopCarouselAnimation();
    const from = { ...carouselMotion };
    const duration = options.duration ?? 320;
    const ease = options.ease ?? "out(3)";
    const complete = () => {
        activeCarouselAnimation = null;
        options.onComplete?.();
    };

    if (reduceMotion.matches) {
        setCarouselMotion(to.x ?? 0, to.scale ?? 1, to.rotate ?? 0, to.opacity ?? 1);
        complete();
        return null;
    }

    const animeApi = window.anime;
    if (animeApi?.animate) {
        activeCarouselAnimation = animeApi.animate(from, {
            x: to.x ?? 0,
            scale: to.scale ?? 1,
            rotate: to.rotate ?? 0,
            opacity: to.opacity ?? 1,
            duration,
            ease,
            onUpdate: () => setCarouselMotion(from.x, from.scale, from.rotate, from.opacity),
            onComplete: complete,
        });
        return activeCarouselAnimation;
    }

    if (typeof animeApi === "function") {
        activeCarouselAnimation = animeApi({
            targets: from,
            x: to.x ?? 0,
            scale: to.scale ?? 1,
            rotate: to.rotate ?? 0,
            opacity: to.opacity ?? 1,
            duration,
            easing: "easeOutCubic",
            update: () => setCarouselMotion(from.x, from.scale, from.rotate, from.opacity),
            complete,
        });
        return activeCarouselAnimation;
    }

    selectors.imageStage
        ?.animate(
            [
                {
                    transform: `translate3d(${carouselMotion.x}px,0,0) scale(${carouselMotion.scale}) rotate(${carouselMotion.rotate}deg)`,
                    opacity: carouselMotion.opacity,
                },
                {
                    transform: `translate3d(${to.x ?? 0}px,0,0) scale(${to.scale ?? 1}) rotate(${to.rotate ?? 0}deg)`,
                    opacity: to.opacity ?? 1,
                },
            ],
            {
                duration,
                easing: "cubic-bezier(.22,.9,.2,1)",
            },
        )
        ?.addEventListener("finish", complete, { once: true });
    setCarouselMotion(to.x ?? 0, to.scale ?? 1, to.rotate ?? 0, to.opacity ?? 1);
    return null;
}

function transitionToImage(index, direction, options = {}) {
    if (!currentProduct) return;
    const images = currentProduct.images;
    const nextIndex = (index + images.length) % images.length;
    if (nextIndex === currentImageIndex) {
        animateCarouselMotion({ x: 0, scale: 1, rotate: 0, opacity: 1 }, { duration: 220 });
        return;
    }

    if (reduceMotion.matches) {
        selectImage(nextIndex);
        return;
    }

    const width = carouselWidth();
    const travel = options.travel ?? width * 0.34;
    const exitX = direction > 0 ? -travel : travel;
    const enterX = direction > 0 ? width * 0.18 : -width * 0.18;

    animateCarouselMotion(
        {
            x: exitX,
            scale: 0.985,
            rotate: direction > 0 ? -1.4 : 1.4,
            opacity: 0.84,
        },
        {
            duration: options.exitDuration ?? 150,
            ease: "out(3)",
            onComplete: () => {
                selectImage(nextIndex, { updateUrl: true, resetMotion: false });
                setCarouselMotion(enterX, 0.988, direction > 0 ? 1.2 : -1.2, 0.86);
                animateCarouselMotion(
                    {
                        x: 0,
                        scale: 1,
                        rotate: 0,
                        opacity: 1,
                    },
                    {
                        duration: options.enterDuration ?? 360,
                        ease: "out(4)",
                    },
                );
            },
        },
    );
}

function stepImage(delta, options = {}) {
    const direction = delta > 0 ? 1 : -1;
    transitionToImage(currentImageIndex + delta, direction, options);
}

function captureCarouselPointer(pointerId) {
    try {
        selectors.imageStage?.setPointerCapture?.(pointerId);
    } catch {}
}

function releaseCarouselPointer(pointerId) {
    try {
        selectors.imageStage?.releasePointerCapture?.(pointerId);
    } catch {}
}

function onCarouselPointerDown(event) {
    if (!selectors.imageStage || !currentProduct || event.button > 0 || event.pointerType === "mouse") {
        return;
    }
    stopCarouselAnimation();
    dragState = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        lastX: event.clientX,
        lastTime: performance.now(),
        velocityX: 0,
        dragging: false,
    };
    captureCarouselPointer(event.pointerId);
}

function onCarouselPointerMove(event) {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    const dx = event.clientX - dragState.startX;
    const dy = event.clientY - dragState.startY;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (!dragState.dragging) {
        if (absX < 8) return;
        if (absY > absX * 1.15) {
            releaseCarouselPointer(event.pointerId);
            dragState = null;
            return;
        }
        dragState.dragging = true;
        selectors.imageStage?.classList.add("is-dragging");
    }

    event.preventDefault();
    const now = performance.now();
    const dt = Math.max(16, now - dragState.lastTime);
    dragState.velocityX = (event.clientX - dragState.lastX) / dt;
    dragState.lastX = event.clientX;
    dragState.lastTime = now;

    const width = carouselWidth();
    const limit = width * 0.42;
    const eased = limit * Math.tanh(dx / limit);
    const progress = Math.min(1, Math.abs(eased) / limit);
    setCarouselMotion(
        eased,
        1 - progress * 0.018,
        (eased / width) * -2.2,
        1 - progress * 0.12,
    );
}

function onCarouselPointerEnd(event) {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    const state = dragState;
    dragState = null;
    selectors.imageStage?.classList.remove("is-dragging");
    releaseCarouselPointer(event.pointerId);

    if (!state.dragging) return;
    suppressNextImageAdvance = true;
    window.setTimeout(() => {
        suppressNextImageAdvance = false;
    }, 180);

    const width = carouselWidth();
    const dx = event.clientX - state.startX;
    const projected = dx + state.velocityX * 190;
    const threshold = Math.max(44, width * 0.18);

    if (projected < -threshold) {
        stepImage(1, { travel: width * 0.48, exitDuration: 120, enterDuration: 380 });
    } else if (projected > threshold) {
        stepImage(-1, { travel: width * 0.48, exitDuration: 120, enterDuration: 380 });
    } else {
        animateCarouselMotion(
            {
                x: 0,
                scale: 1,
                rotate: 0,
                opacity: 1,
            },
            {
                duration: 420,
                ease: "out(4)",
            },
        );
    }
}

function openSizeSheet() {
    if (!selectors.sizeSheet) return;
    selectors.sizeSheet.hidden = false;
    selectors.sizeToggle?.setAttribute("aria-expanded", "true");
    selectors.panel?.classList.add("is-sizing");
    syncSizeControls();
    selectors.sizeSheet.querySelector("[data-size-option].is-selected")?.focus();
}

function closeSizeSheet() {
    if (!selectors.sizeSheet) return;
    selectors.sizeSheet.hidden = true;
    selectors.sizeToggle?.setAttribute("aria-expanded", "false");
    selectors.panel?.classList.remove("is-sizing");
}

function syncSizeControls() {
    selectors.sizeSheet?.querySelectorAll("[data-size-option]").forEach((button) => {
        const isSelected = button.dataset.sizeOption === selectedSize;
        button.classList.toggle("is-selected", isSelected);
        button.setAttribute("aria-checked", isSelected ? "true" : "false");
    });
    setText(selectors.quantityValue, String(quantity));
}

function changeQuantity(delta) {
    quantity = Math.min(9, Math.max(1, quantity + delta));
    syncSizeControls();
}

function addCurrentToCart() {
    if (!currentProduct) return;
    const existing = cart.find(
        (item) => item.slug === currentProduct.slug && item.size === selectedSize,
    );
    if (existing) {
        existing.quantity = Math.min(99, existing.quantity + quantity);
    } else {
        cart.push({
            slug: currentProduct.slug,
            size: selectedSize,
            quantity,
        });
    }
    writeCart();
    renderCart();
    openCart();
}

function openCart() {
    if (!selectors.cartDrawer) return;
    renderCart();
    selectors.cartDrawer.hidden = false;
    selectors.cartDrawer.setAttribute("aria-hidden", "false");
    selectors.cartToggles.forEach((toggle) => toggle.setAttribute("aria-expanded", "true"));
    document.body.classList.add("shop-cart-open");
    showBackdrop();
    selectors.cartDrawer.querySelector("[data-close-cart]")?.focus({ preventScroll: true });
}

function closeCart() {
    if (!selectors.cartDrawer) return;
    selectors.cartDrawer.hidden = true;
    selectors.cartDrawer.setAttribute("aria-hidden", "true");
    selectors.cartToggles.forEach((toggle) => toggle.setAttribute("aria-expanded", "false"));
    document.body.classList.remove("shop-cart-open");
    maybeHideBackdrop();
}

function renderCart() {
    const count = cart.reduce((total, item) => total + Number(item.quantity || 0), 0);
    const total = cart.reduce((sum, item) => {
        const product = productBySlug.get(item.slug);
        return sum + (product ? product.price * Number(item.quantity || 0) : 0);
    }, 0);

    selectors.cartCounts.forEach((cartCount) => {
        cartCount.textContent = String(count);
        cartCount.dataset.empty = count === 0 ? "true" : "false";
    });
    setText(selectors.cartTotal, `$${total}`);

    if (!selectors.cartItems) return;
    selectors.cartItems.textContent = "";
    if (!cart.length) {
        const empty = document.createElement("p");
        empty.className = "shop-cart-empty";
        empty.textContent = EMPTY_STATE;
        selectors.cartItems.append(empty);
        return;
    }

    const list = document.createElement("ul");
    list.className = "shop-cart-list";
    cart.forEach((item) => {
        const product = productBySlug.get(item.slug);
        if (!product) return;
        const row = document.createElement("li");
        row.className = "shop-cart-item";

        const title = document.createElement("strong");
        title.textContent = product.name;

        const meta = document.createElement("span");
        meta.textContent = `Size ${item.size} x ${item.quantity} - $${product.price * item.quantity}`;

        row.append(title, meta);
        list.append(row);
    });
    selectors.cartItems.append(list);
}

function setText(element, value) {
    if (element) element.textContent = value;
}

function handleGridClick(event) {
    const card = event.target.closest("[data-product-card]");
    if (!card) return;
    const product = productBySlug.get(card.dataset.slug);
    if (!product) return;
    event.preventDefault();
    openProductFromCard(product, "front", card);
}

function handleGridKeydown(event) {
    if (event.key !== " ") return;
    const card = event.target.closest("[data-product-card]");
    if (!card) return;
    const product = productBySlug.get(card.dataset.slug);
    if (!product) return;
    event.preventDefault();
    openProductFromCard(product, "front", card);
}

selectors.grid?.addEventListener("click", handleGridClick);
selectors.grid?.addEventListener("keydown", handleGridKeydown);

document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    if (target.closest("[data-close-product]")) {
        closeProductWithTransition();
        return;
    }

    if (target.closest("[data-image-prev]")) {
        stepImage(-1);
        return;
    }

    if (target.closest("[data-image-next], [data-image-advance]")) {
        if (suppressNextImageAdvance) return;
        stepImage(1);
        return;
    }

    const thumb = target.closest("[data-image-index]");
    if (thumb) {
        const nextIndex = Number(thumb.dataset.imageIndex || 0);
        transitionToImage(nextIndex, nextIndex > currentImageIndex ? 1 : -1);
        return;
    }

    if (target.closest("[data-size-toggle]")) {
        openSizeSheet();
        return;
    }

    if (target.closest("[data-close-size]")) {
        closeSizeSheet();
        selectors.sizeToggle?.focus();
        return;
    }

    const sizeButton = target.closest("[data-size-option]");
    if (sizeButton) {
        selectedSize = sizeButton.dataset.sizeOption || "2";
        syncSizeControls();
        return;
    }

    if (target.closest("[data-quantity-minus]")) {
        changeQuantity(-1);
        return;
    }

    if (target.closest("[data-quantity-plus]")) {
        changeQuantity(1);
        return;
    }

    if (target.closest("[data-info-toggle], [data-shop-panel-help]")) {
        selectors.sizeInfo?.classList.toggle("is-collapsed");
        return;
    }

    if (target.closest("[data-add-cart]")) {
        addCurrentToCart();
        return;
    }

    if (target.closest("[data-cart-toggle]")) {
        if (isCartOpen()) closeCart();
        else openCart();
        return;
    }

    if (target.closest("[data-close-cart]")) {
        closeCart();
        return;
    }

    if (target.closest("[data-cart-clear]")) {
        cart = [];
        writeCart();
        renderCart();
        return;
    }

    if (target === selectors.backdrop) {
        if (isCartOpen()) closeCart();
        if (isProductOpen()) closeProductWithTransition();
    }
});

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        if (selectors.sizeSheet && !selectors.sizeSheet.hidden) {
            closeSizeSheet();
            selectors.sizeToggle?.focus();
            return;
        }
        if (isCartOpen()) {
            closeCart();
            selectors.cartToggles[0]?.focus();
            return;
        }
        if (isProductOpen()) {
            closeProductWithTransition();
            return;
        }
    }

    if (!isProductOpen()) return;

    if (event.key === "ArrowLeft") {
        event.preventDefault();
        stepImage(-1);
    } else if (event.key === "ArrowRight") {
        event.preventDefault();
        stepImage(1);
    } else if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        openSizeSheet();
    } else if (event.key.toLowerCase() === "i") {
        selectors.sizeInfo?.classList.toggle("is-collapsed");
    }
});

window.addEventListener("popstate", () => {
    const match = getProductFromLocation();
    if (match) {
        openProduct(match.product, match.imageId, { push: false });
    } else if (isProductOpen()) {
        closeProductWithTransition({ push: false });
    }
});

renderCart();

selectors.imageStage?.addEventListener("pointerdown", onCarouselPointerDown);
selectors.imageStage?.addEventListener("pointermove", onCarouselPointerMove);
selectors.imageStage?.addEventListener("pointerup", onCarouselPointerEnd);
selectors.imageStage?.addEventListener("pointercancel", onCarouselPointerEnd);

const initial = getProductFromLocation();
if (initial) {
    openProduct(initial.product, initial.imageId, { replace: true });
}
