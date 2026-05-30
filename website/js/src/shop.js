const CART_KEY = "engmanager.shop.cart";
const EMPTY_STATE = "Your cap stack is empty.";

const catalog = window.__shopProducts || { products: [] };
const products = Array.isArray(catalog.products) ? catalog.products : [];
const productBySlug = new Map(products.map((product) => [product.slug, product]));
const CAMERA_OPEN_DURATION = 390;
const CAMERA_OPEN_BACKGROUND_FADE_DURATION = 340;
const CAMERA_OPEN_BACKGROUND_FADE_DELAY = CAMERA_OPEN_DURATION * 0.72;
const CAMERA_OPEN_FOCUS_FADE_DURATION = 220;
const CAMERA_OPEN_FOCUS_FADE_DELAY = CAMERA_OPEN_DURATION * 0.9;
const CAMERA_CLOSE_DURATION = 390;
const CAMERA_OPEN_EASING = "cubic-bezier(.2,.8,.2,1)";
const CAMERA_CLOSE_HANDOFF_DELAY = 50;
const GRID_TEXT_REVEAL_DURATION = 300;
const GRID_TEXT_REVEAL_STAGGER = 40;
const CAMERA_VIEWPORT_MARGIN = 220;
const MOTION_EASING = "cubic-bezier(.22,.9,.2,1)";

const selectors = {
    skipLink: document.querySelector(".skip-link"),
    topbar: document.querySelector(".shop-topbar"),
    shell: document.querySelector(".shop-shell"),
    grid: document.querySelector("[data-shop-grid]"),
    panel: document.querySelector("[data-product-panel]"),
    backdrop: document.querySelector("[data-shop-backdrop]"),
    productTitle: document.querySelector("[data-product-title]"),
    productKicker: document.querySelector("[data-product-kicker]"),
    productFrame: document.querySelector(".shop-product-frame"),
    productLayout: document.querySelector(".shop-product-layout"),
    productCopyTitle: document.querySelector("[data-product-copy-title]"),
    productPrice: document.querySelector("[data-product-price]"),
    productDescription: document.querySelector("[data-product-description]"),
    imageStage: document.querySelector("[data-image-advance]"),
    carouselTrack: document.querySelector("[data-carousel-track]"),
    productImage: document.querySelector('[data-cell="main"]'),
    cellPrev: document.querySelector('[data-cell="prev"]'),
    cellNext: document.querySelector('[data-cell="next"]'),
    imageCaption: document.querySelector("[data-image-caption]"),
    imageThumbs: document.querySelector("[data-image-thumbs]"),
    imagePrev: document.querySelector("[data-image-prev]"),
    imageNext: document.querySelector("[data-image-next]"),
    edgeArrowUp: document.querySelector('[data-edge-arrow="up"]'),
    edgeArrowDown: document.querySelector('[data-edge-arrow="down"]'),
    cartToggles: document.querySelectorAll("[data-cart-toggle]"),
    cartCounts: document.querySelectorAll("[data-cart-count]"),
    cartItems: document.querySelector("[data-cart-items]"),
    cartTotal: document.querySelector("[data-cart-total]"),
    cartClear: document.querySelector("[data-cart-clear]"),
    cartFoot: document.querySelector("[data-cart-foot]"),
    bag: document.querySelector("[data-bag]"),
    bagSheet: document.querySelector(".shop-bag-sheet"),
    bagCart: document.querySelector("[data-bag-cart]"),
    bagCheckoutPane: document.querySelector("[data-bag-checkout-pane]"),
    bagScrim: document.querySelector("[data-bag-scrim]"),
    bagCheckoutBtn: document.querySelector("[data-bag-checkout]"),
};

let currentProduct = null;
let currentImageIndex = 0;
let selectedSize = "ONE SIZE";
let quantity = 1;
let cart = readCart();
// Inline checkout (Stripe Elements in the bag's right pane) — lazily mounted.
const CHECKOUT = window.__checkout || {};
let stripe = null;
let elements = null;
let paymentElement = null;
let addressElement = null;
let checkoutMounted = false;
let checkoutReady = false;
let checkoutBusy = false;
let checkoutAmount = 0;
let amountUpdateTimer = null;
let activeCarouselAnimation = null;
let carouselMotion = { x: 0, scale: 1, rotate: 0, opacity: 1 };
let dragState = null;
let suppressNextImageAdvance = false;
let activeCameraAnimation = null;
let preparedCloseCamera = null;
let preparedCloseCameraSlug = null;
let prepareCloseCameraTask = null;
let gridTextRevealTimer = null;
let activeProductSwitchAnimation = null;
let productTransitionActive = false;
let productSwitching = false;
let productSwipeState = null;
let lastOpenedProductSlug = null;
let productModalBoundaryActive = false;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
// At/below this width the bag opens full-screen (see shop.css), so adding to
// cart there flies a cap into the cart icon instead of taking over the screen.
const compactViewport = window.matchMedia("(max-width: 53rem)");

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

// The bag (cart/checkout) and the product (path) are orthogonal URL dimensions.
// Each URL builder preserves the other dimension so back/forward stays coherent.
function currentBagFromUrl() {
    const bag = new URLSearchParams(window.location.search).get("bag");
    return bag === "cart" || bag === "checkout" ? bag : null;
}

function productUrl(product, imageId) {
    const url = new URL(window.location.href);
    const bag = currentBagFromUrl();
    url.pathname = `/products/${encodeURIComponent(product.slug)}`;
    url.search = "";
    url.searchParams.set("image", imageId || "front");
    if (bag) url.searchParams.set("bag", bag);
    url.hash = "";
    return url;
}

function homeUrl() {
    const url = new URL(window.location.href);
    const bag = currentBagFromUrl();
    url.pathname = "/";
    url.search = "";
    if (bag) url.searchParams.set("bag", bag);
    url.hash = "";
    return url;
}

// Toggle only the bag dimension, preserving the product path/image.
function bagUrl(next) {
    const url = new URL(window.location.href);
    const params = new URLSearchParams(url.search);
    if (next) params.set("bag", next);
    else params.delete("bag");
    url.search = params.toString();
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
    // "Cart open" now means the bag sheet (cart or checkout pane) is open.
    return selectors.bag && !selectors.bag.hidden;
}

function bagState() {
    return selectors.bag?.dataset.bagState || "closed";
}

function backgroundFocusRoots() {
    return [selectors.skipLink, selectors.topbar, selectors.shell].filter(Boolean);
}

function setBackgroundInert(active) {
    if (productModalBoundaryActive === active) return;
    productModalBoundaryActive = active;
    backgroundFocusRoots().forEach((element) => {
        element.inert = active;
        if (active) {
            element.setAttribute("aria-hidden", "true");
        } else {
            element.removeAttribute("aria-hidden");
        }
    });
}

function focusProductDialog() {
    selectors.panel?.focus({ preventScroll: true });
}

function focusGridCard(slug) {
    const card = cardForSlug(slug);
    if (!card) return;
    card.focus({ preventScroll: true });
}

function isVisibleFocusable(element) {
    if (!(element instanceof HTMLElement)) return false;
    if (element.matches("[disabled], [hidden], [aria-hidden='true']")) return false;
    return element.getClientRects().length > 0;
}

function focusableElementsIn(container) {
    if (!container) return [];
    return Array.from(
        container.querySelectorAll(
            "a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex='-1'])",
        ),
    ).filter(isVisibleFocusable);
}

function trapFocusIn(container, event) {
    if (!container) return;
    const focusable = focusableElementsIn(container);
    if (!focusable.length) {
        event.preventDefault();
        container.focus?.({ preventScroll: true });
        return;
    }

    const active = document.activeElement;
    if (!container.contains(active)) {
        event.preventDefault();
        focusable[event.shiftKey ? focusable.length - 1 : 0].focus({ preventScroll: true });
        return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus({ preventScroll: true });
    } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus({ preventScroll: true });
    }
}

function activeFocusTrapContainer() {
    // Trapping over the whole bag covers both panes; hidden-pane controls are
    // filtered out by isVisibleFocusable, so cart-only state traps just the cart.
    if (isCartOpen()) return selectors.bag;
    if (isProductOpen()) return selectors.panel;
    return null;
}

function focusPrimaryCartToggle() {
    const toggle = isProductOpen()
        ? selectors.panel?.querySelector("[data-cart-toggle]")
        : selectors.cartToggles[0];
    toggle?.focus({ preventScroll: true });
}

function updateOverlayScrollGutter(options = {}) {
    if (!options.force && document.body.style.getPropertyValue("--shop-scrollbar-gutter")) return;
    const gutter = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
    document.body.style.setProperty("--shop-scrollbar-gutter", `${gutter}px`);
}

function clearOverlayScrollGutterIfIdle() {
    if (isProductOpen() || isCartOpen()) return;
    document.body.style.removeProperty("--shop-scrollbar-gutter");
}

function hideGridTextForClose() {
    if (gridTextRevealTimer) {
        window.clearTimeout(gridTextRevealTimer);
        gridTextRevealTimer = null;
    }
    document.body.classList.remove("shop-grid-text-revealing");
    document.body.classList.add("shop-grid-text-hidden");
}

function prepareGridTextReveal() {
    if (!selectors.grid) return 0;
    const columns = gridColumnCount();
    let maxDelay = 0;
    selectors.grid.querySelectorAll(".shop-card-meta").forEach((meta, index) => {
        const row = Math.floor(index / columns);
        const column = index % columns;
        const delay = (row + column) * GRID_TEXT_REVEAL_STAGGER;
        maxDelay = Math.max(maxDelay, delay);
        meta.style.setProperty("--shop-text-reveal-delay", `${delay}ms`);
    });
    return maxDelay;
}

function clearGridTextRevealDelays() {
    selectors.grid
        ?.querySelectorAll(".shop-card-meta")
        .forEach((meta) => meta.style.removeProperty("--shop-text-reveal-delay"));
}

function revealGridTextAfterClose() {
    if (gridTextRevealTimer) window.clearTimeout(gridTextRevealTimer);
    const maxDelay = prepareGridTextReveal();
    document.body.classList.add("shop-grid-text-revealing");
    document.body.classList.remove("shop-grid-text-hidden");
    gridTextRevealTimer = window.setTimeout(() => {
        document.body.classList.remove("shop-grid-text-revealing");
        clearGridTextRevealDelays();
        gridTextRevealTimer = null;
    }, GRID_TEXT_REVEAL_DURATION + maxDelay);
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

function stopCameraAnimation() {
    activeCameraAnimation?.cancel?.();
    activeCameraAnimation = null;
}

function cancelPrepareCloseCameraTask() {
    if (!prepareCloseCameraTask) return;
    if (prepareCloseCameraTask.type === "idle") {
        window.cancelIdleCallback?.(prepareCloseCameraTask.id);
    } else {
        window.clearTimeout(prepareCloseCameraTask.id);
    }
    prepareCloseCameraTask = null;
}

function disposePreparedCloseCamera(camera = preparedCloseCamera) {
    cancelPrepareCloseCameraTask();
    if (!camera) return;
    if (camera === preparedCloseCamera) {
        preparedCloseCamera = null;
        preparedCloseCameraSlug = null;
    }
    camera.stage.remove();
}

function rectCenter(rect) {
    return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
    };
}

function intersectsViewport(rect, margin = 0) {
    return (
        rect.left < window.innerWidth + margin &&
        rect.left + rect.width > -margin &&
        rect.top < window.innerHeight + margin &&
        rect.top + rect.height > -margin
    );
}

function cloneCameraWorld(focusImage = null) {
    if (!selectors.grid) return null;
    const stage = document.createElement("div");
    const world = document.createElement("div");
    const backgroundLayer = document.createElement("div");
    const focusLayer = document.createElement("div");
    const images = selectors.grid.querySelectorAll("[data-product-card] img");
    const focusImages = [];
    const backgroundImages = [];
    stage.className = "shop-camera-stage";
    stage.setAttribute("aria-hidden", "true");
    world.className = "shop-camera-world";
    backgroundLayer.className = "shop-camera-layer is-background";
    focusLayer.className = "shop-camera-layer is-focus";

    images.forEach((image) => {
        const rect = rectForElement(image);
        if (!rect || (image !== focusImage && !intersectsViewport(rect, CAMERA_VIEWPORT_MARGIN))) return;

        const clone = document.createElement("img");
        clone.className = "shop-camera-image";
        clone.alt = "";
        clone.decoding = "async";
        clone.src = image.currentSrc || image.src;
        clone.style.inlineSize = `${rect.width}px`;
        clone.style.blockSize = `${rect.height}px`;
        clone.style.transform = `translate3d(${rect.left}px, ${rect.top}px, 0)`;
        if (image === focusImage) {
            clone.classList.add("is-focus");
            focusImages.push(clone);
            focusLayer.append(clone);
        } else {
            backgroundImages.push(clone);
            backgroundLayer.append(clone);
        }
    });

    if (!focusLayer.childElementCount && !backgroundLayer.childElementCount) return null;
    if (backgroundLayer.childElementCount) world.append(backgroundLayer);
    if (focusLayer.childElementCount) world.append(focusLayer);
    stage.append(world);
    document.body.append(stage);
    return { stage, world, backgroundLayer, focusLayer, focusImages, backgroundImages };
}

function prepareCloseCamera(slug, camera = null) {
    cancelPrepareCloseCameraTask();
    if (!slug || reduceMotion.matches) {
        if (camera) camera.stage.remove();
        return;
    }

    if (preparedCloseCamera && preparedCloseCamera !== camera) {
        disposePreparedCloseCamera(preparedCloseCamera);
    }

    const nextCamera = camera || cloneCameraWorld(cardImageForSlug(slug));
    if (!nextCamera) return;

    nextCamera.stage.classList.add("is-prepared");
    nextCamera.world.getAnimations().forEach((animation) => animation.cancel());
    nextCamera.world.style.opacity = "";
    nextCamera.world.style.transform = "";
    document.body.append(nextCamera.stage);
    preparedCloseCamera = nextCamera;
    preparedCloseCameraSlug = slug;
}

function schedulePrepareCloseCamera(slug) {
    cancelPrepareCloseCameraTask();
    if (!slug || reduceMotion.matches) return;

    const run = () => {
        prepareCloseCameraTask = null;
        if (isProductOpen()) prepareCloseCamera(slug);
    };

    if ("requestIdleCallback" in window) {
        prepareCloseCameraTask = {
            type: "idle",
            id: window.requestIdleCallback(run, { timeout: 450 }),
        };
    } else {
        prepareCloseCameraTask = {
            type: "timeout",
            id: window.setTimeout(run, 80),
        };
    }
}

function takePreparedCloseCamera(slug) {
    cancelPrepareCloseCameraTask();
    if (!preparedCloseCamera || preparedCloseCameraSlug !== slug) {
        disposePreparedCloseCamera();
        return null;
    }

    const camera = preparedCloseCamera;
    preparedCloseCamera = null;
    preparedCloseCameraSlug = null;
    camera.stage.classList.remove("is-prepared");
    camera.world.getAnimations().forEach((animation) => animation.cancel());
    camera.world.style.opacity = "";
    camera.world.style.transform = "";
    document.body.append(camera.stage);
    return camera;
}

function cameraTransformForFocus(focusRect, visibleRect) {
    const itemFocus = rectCenter(focusRect);
    const visibleFocus = rectCenter(visibleRect);
    const zoom = Math.max(
        0.001,
        Math.max(visibleRect.width / focusRect.width, visibleRect.height / focusRect.height),
    );

    return `translate3d(${visibleFocus.x - itemFocus.x * zoom}px, ${visibleFocus.y - itemFocus.y * zoom}px, 0) scale(${zoom})`;
}

function crossfadeProductImageToFront() {
    if (!currentProduct || !selectors.productImage) return null;
    const frontIndex = imageIndex(currentProduct, "front");
    if (currentImageIndex === frontIndex) return null;

    // Center the track before measuring — productImage (the main cell) may be
    // mid-drag/peek, which would misposition the crossfade overlay.
    stopCarouselAnimation();
    setCarouselMotion(0, 1, 0, 1);
    const rect = rectForElement(selectors.productImage);
    const currentSrc = selectors.productImage.currentSrc || selectors.productImage.src;
    if (!rect || !currentSrc) {
        selectImage(frontIndex, { updateUrl: false, resetMotion: false });
        return null;
    }

    const overlay = document.createElement("img");
    overlay.className = "shop-product-image-crossfade";
    overlay.alt = "";
    overlay.decoding = "async";
    overlay.src = currentSrc;
    overlay.style.inlineSize = `${rect.width}px`;
    overlay.style.blockSize = `${rect.height}px`;
    overlay.style.transform = `translate3d(${rect.left}px, ${rect.top}px, 0)`;
    document.body.append(overlay);

    selectImage(frontIndex, { updateUrl: false, resetMotion: false });

    const animation = overlay.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: 180,
        easing: CAMERA_OPEN_EASING,
        fill: "both",
    });
    animation.finished.finally(() => overlay.remove()).catch(() => {});
    return animation;
}

async function animateProductCameraOpen(options) {
    const { product, imageId = "front", card, sourceElement, options: openOptions = {} } = options;
    const sourceRect = rectForElement(sourceElement || card);

    if (reduceMotion.matches || !sourceRect || !selectors.panel) {
        openProduct(product, imageId, openOptions);
        return;
    }

    stopCameraAnimation();
    productTransitionActive = true;
    openProduct(product, imageId, openOptions);
    selectors.panel.style.opacity = "0";
    selectors.productLayout?.classList.add("is-camera-opening");
    setProductSwitchMotion(0, 1, 1);

    await waitForImageReady(selectors.productImage);

    // Ensure the track is centered before measuring the zoom target.
    setCarouselMotion(0, 1, 0, 1);
    const targetRect = rectForElement(selectors.productImage);
    const camera = targetRect ? cloneCameraWorld(sourceElement || card?.querySelector("img")) : null;
    if (!camera || !targetRect) {
        selectors.panel.style.opacity = "";
        selectors.productLayout?.classList.remove("is-camera-opening");
        setProductSwitchMotion(0, 1, 1);
        camera?.stage.remove();
        activeCameraAnimation = null;
        productTransitionActive = false;
        document.body.classList.remove("shop-camera-transitioning");
        return;
    }

    if (selectors.grid) selectors.grid.style.opacity = "0";
    document.body.classList.add("shop-camera-transitioning");

    const endTransform = cameraTransformForFocus(sourceRect, targetRect);
    const animations = [
        camera.world.animate(
            [
                { transform: "translate3d(0, 0, 0) scale(1)" },
                { transform: endTransform },
            ],
            {
                duration: CAMERA_OPEN_DURATION,
                easing: CAMERA_OPEN_EASING,
                fill: "both",
            },
        ),
        selectors.panel.animate([{ opacity: 0 }, { opacity: 1 }], {
            duration: 300,
            delay: 170,
            easing: CAMERA_OPEN_EASING,
            fill: "both",
        }),
    ];

    if (camera.backgroundLayer.childElementCount) {
        animations.push(
            camera.backgroundLayer.animate([{ opacity: 1 }, { opacity: 0 }], {
                duration: CAMERA_OPEN_BACKGROUND_FADE_DURATION,
                delay: CAMERA_OPEN_BACKGROUND_FADE_DELAY,
                easing: CAMERA_OPEN_EASING,
                fill: "both",
            }),
        );
    }

    const focusLayer = camera.focusLayer.childElementCount ? camera.focusLayer : camera.backgroundLayer;
    if (focusLayer.childElementCount) {
        animations.push(
            focusLayer.animate([{ opacity: 1 }, { opacity: 0 }], {
                duration: CAMERA_OPEN_FOCUS_FADE_DURATION,
                delay: CAMERA_OPEN_FOCUS_FADE_DELAY,
                easing: CAMERA_OPEN_EASING,
                fill: "both",
            }),
        );
    }

    let cleanedUp = false;
    const cleanup = () => {
        if (cleanedUp) return;
        cleanedUp = true;
        const shouldPrepareClose = currentProduct?.slug === product.slug && isProductOpen();
        selectors.panel.style.opacity = "1";
        setProductSwitchMotion(0, 1, 1);
        camera.stage.remove();
        animations.forEach((animation) => animation.cancel());
        selectors.panel.style.opacity = "";
        selectors.productLayout?.classList.remove("is-camera-opening");
        activeCameraAnimation = null;
        productTransitionActive = false;
        document.body.classList.remove("shop-camera-transitioning");
        if (shouldPrepareClose) schedulePrepareCloseCamera(product.slug);
    };
    activeCameraAnimation = {
        cancel: cleanup,
        pause: () => animations.forEach((animation) => animation.pause()),
    };
    Promise.allSettled(animations.map((animation) => animation.finished)).then(cleanup);
}

function animateProductCameraClose(options = {}) {
    const product = currentProduct;
    const slug = product?.slug || lastOpenedProductSlug;
    // Center the carousel before measuring the zoom source rect (the main cell
    // may be offset mid-drag/peek, which would zoom from the wrong place).
    stopCarouselAnimation();
    setCarouselMotion(0, 1, 0, 1);
    const sourceImage = selectors.productImage;
    const targetImage = cardImageForSlug(slug);
    const sourceRect = rectForElement(sourceImage);
    const targetRect = rectForElement(targetImage);

    if (reduceMotion.matches) {
        if (currentProduct) {
            selectImage(imageIndex(currentProduct, "front"), { updateUrl: false, resetMotion: false });
        }
        disposePreparedCloseCamera();
        closeProduct(options);
        return;
    }

    if (!selectors.panel || !sourceRect || !targetRect) {
        crossfadeProductImageToFront();
        disposePreparedCloseCamera();
        closeProduct(options);
        return;
    }

    stopCameraAnimation();
    stopCarouselAnimation();
    stopProductSwitchAnimation();
    productTransitionActive = true;
    document.body.classList.add("shop-camera-transitioning");
    selectors.productLayout?.classList.add("is-camera-opening");

    const camera = takePreparedCloseCamera(slug) || cloneCameraWorld(targetImage);
    const crossfade = crossfadeProductImageToFront();
    if (!camera) {
        crossfade?.cancel();
        selectors.productLayout?.classList.remove("is-camera-opening");
        productTransitionActive = false;
        document.body.classList.remove("shop-camera-transitioning");
        closeProduct(options);
        return;
    }

    hideGridTextForClose();
    if (selectors.grid) selectors.grid.style.opacity = "0";

    const startTransform = cameraTransformForFocus(targetRect, sourceRect);
    const cameraTransform = camera.world.animate(
        [
            { transform: startTransform },
            { transform: "translate3d(0, 0, 0) scale(1)" },
        ],
        {
            duration: CAMERA_CLOSE_DURATION,
            easing: CAMERA_OPEN_EASING,
            fill: "both",
        },
    );
    const animations = [
        cameraTransform,
        selectors.panel.animate([{ opacity: 1 }, { opacity: 0 }], {
            duration: 220,
            delay: 90,
            easing: CAMERA_OPEN_EASING,
            fill: "both",
        }),
    ];

    let cleanedUp = false;
    let handoffTimer = null;
    const restoreGridUnderCamera = () => {
        if (selectors.grid) selectors.grid.style.opacity = "1";
    };
    const cleanup = () => {
        if (cleanedUp) return;
        cleanedUp = true;
        if (handoffTimer) {
            window.clearTimeout(handoffTimer);
            handoffTimer = null;
        }
        restoreGridUnderCamera();
        selectors.panel.style.opacity = "0";
        camera.stage.remove();
        crossfade?.cancel();
        closeProduct(options);
        animations.forEach((animation) => animation.cancel());
        if (selectors.grid) selectors.grid.style.opacity = "";
        selectors.panel.style.opacity = "";
        selectors.productLayout?.classList.remove("is-camera-opening");
        setProductSwitchMotion(0, 1, 1);
        activeCameraAnimation = null;
        productTransitionActive = false;
        document.body.classList.remove("shop-camera-transitioning");
        revealGridTextAfterClose();
    };
    cameraTransform.finished
        .then(() => {
            if (cleanedUp) return;
            restoreGridUnderCamera();
            handoffTimer = window.setTimeout(cleanup, CAMERA_CLOSE_HANDOFF_DELAY);
        })
        .catch(() => {});
    activeCameraAnimation = {
        cancel: cleanup,
        pause: () => animations.forEach((animation) => animation.pause()),
    };
}

function openProductFromCard(product, imageId, card, options = {}) {
    if (productTransitionActive) return;
    disposePreparedCloseCamera();
    const sourceImage = card?.querySelector("img");
    lastOpenedProductSlug = product.slug;

    animateProductCameraOpen({
        product,
        imageId,
        card,
        sourceElement: sourceImage,
        options,
    });
}

function closeProductWithTransition(options = {}) {
    if (productTransitionActive) return;
    animateProductCameraClose(options);
}

function stopProductSwitchAnimation() {
    activeProductSwitchAnimation?.pause?.();
    activeProductSwitchAnimation?.cancel?.();
    activeProductSwitchAnimation = null;
}

function setProductSwitching(active) {
    selectors.productFrame?.classList.toggle("is-product-switching", active);
    selectors.productLayout?.classList.toggle("is-product-swiping", active);
}

function setProductSwitchMotion(y = 0, scale = 1, opacity = 1, x = 0) {
    if (!selectors.productLayout) return;
    selectors.productLayout.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
    selectors.productLayout.style.opacity = String(opacity);
}

function animateProductSwitchMotion(to, options = {}) {
    stopProductSwitchAnimation();
    const from = {
        x: Number(options.fromX ?? 0),
        y: Number(options.fromY ?? 0),
        scale: Number(options.fromScale ?? 1),
        opacity: Number(options.fromOpacity ?? 1),
    };
    const complete = () => {
        activeProductSwitchAnimation = null;
        options.onComplete?.();
    };

    if (reduceMotion.matches) {
        setProductSwitchMotion(to.y ?? 0, to.scale ?? 1, to.opacity ?? 1, to.x ?? 0);
        complete();
        return null;
    }

    const animation = selectors.productLayout?.animate(
        [
            {
                transform: `translate3d(${from.x}px, ${from.y}px, 0) scale(${from.scale})`,
                opacity: from.opacity,
            },
            {
                transform: `translate3d(${to.x ?? 0}px, ${to.y ?? 0}px, 0) scale(${to.scale ?? 1})`,
                opacity: to.opacity ?? 1,
            },
        ],
        {
            duration: options.duration ?? 320,
            easing: MOTION_EASING,
            fill: "both",
        },
    );

    if (!animation) {
        setProductSwitchMotion(to.y ?? 0, to.scale ?? 1, to.opacity ?? 1, to.x ?? 0);
        complete();
        return null;
    }

    activeProductSwitchAnimation = {
        cancel: () => {
            animation.cancel();
            activeProductSwitchAnimation = null;
        },
        pause: () => animation.pause(),
    };
    animation.finished
        .then(() => {
            setProductSwitchMotion(to.y ?? 0, to.scale ?? 1, to.opacity ?? 1, to.x ?? 0);
            animation.cancel();
            complete();
        })
        .catch(() => {});
    return activeProductSwitchAnimation;
}

function productIndex(product) {
    return products.findIndex((candidate) => candidate.slug === product?.slug);
}

function gridColumnCount() {
    if (!selectors.grid) return 1;
    const cards = Array.from(selectors.grid.querySelectorAll("[data-product-card]"));
    if (cards.length) {
        const firstRect = rectForElement(cards[0]);
        if (firstRect) {
            const columns = cards.reduce((count, card) => {
                const rect = rectForElement(card);
                return rect && Math.abs(rect.top - firstRect.top) < 2 ? count + 1 : count;
            }, 0);
            if (columns > 0) return columns;
        }
    }

    const columns = window
        .getComputedStyle(selectors.grid)
        .gridTemplateColumns.split(/\s+/)
        .filter(Boolean);
    return Math.max(1, columns.length || 1);
}

function productByGridRows(rowDelta) {
    if (!currentProduct || !products.length) return null;
    const index = productIndex(currentProduct);
    if (index < 0) return null;
    const step = gridColumnCount() * rowDelta;
    return products[(index + step + products.length * 10) % products.length];
}

function productByIndexDelta(delta) {
    if (!currentProduct || !products.length) return null;
    const index = productIndex(currentProduct);
    if (index < 0) return null;
    return products[(index + delta + products.length * 10) % products.length];
}

function firstImageId(product) {
    return product?.images?.[0]?.id || "front";
}

function imageIdForProduct(product, imageId) {
    if (!product?.images?.length) return "front";
    return product.images.some((image) => image.id === imageId) ? imageId : product.images[0].id;
}

function commitProductSwitch(nextProduct, imageId, enterMotion, enterOptions = {}) {
    const nextImageId = imageIdForProduct(nextProduct, imageId);
    openProduct(nextProduct, nextImageId, { push: false, focus: false });
    window.history.replaceState(
        { shopProduct: nextProduct.slug, image: nextImageId },
        "",
        productUrl(nextProduct, nextImageId),
    );
    lastOpenedProductSlug = nextProduct.slug;
    setProductSwitchMotion(
        enterMotion.y ?? 0,
        enterMotion.scale ?? 1,
        enterMotion.opacity ?? 1,
        enterMotion.x ?? 0,
    );
    animateProductSwitchMotion(
        { x: 0, y: 0, scale: 1, opacity: 1 },
        {
            fromX: enterMotion.x ?? 0,
            fromY: enterMotion.y ?? 0,
            fromScale: enterMotion.scale ?? 1,
            fromOpacity: enterMotion.opacity ?? 1,
            duration: enterOptions.duration ?? 430,
            onComplete: () => {
                productSwitching = false;
                setProductSwitching(false);
                setProductSwitchMotion(0, 1, 1);
                schedulePrepareCloseCamera(nextProduct.slug);
            },
        },
    );
}

function switchProductByGridRows(rowDelta, options = {}) {
    if (productSwitching || productTransitionActive || !currentProduct) return;
    const nextProduct = productByGridRows(rowDelta);
    if (!nextProduct) return;
    preloadProductImages(nextProduct);

    const travel = selectors.productLayout?.getBoundingClientRect().height || window.innerHeight || 720;
    const exitY = rowDelta > 0 ? travel * 0.22 : -travel * 0.22;
    const enterY = rowDelta > 0 ? -travel * 0.18 : travel * 0.18;
    const imageId = firstImageId(nextProduct);
    const fromY = Number(options.fromY ?? 0);
    productSwitching = true;
    setProductSwitching(true);

    // Dissolve, not cut: fade the outgoing content all the way out over the
    // panel's stable surface, swap while it's invisible (no pop), then fade the
    // incoming content in. Eager preload + reserved aspect mean no CLS mid-swap.
    animateProductSwitchMotion(
        { y: exitY, scale: 0.992, opacity: 0 },
        {
            fromY,
            fromScale: options.fromScale ?? 1,
            fromOpacity: options.fromOpacity ?? 1,
            duration: 170,
            onComplete: () => {
                commitProductSwitch(
                    nextProduct,
                    imageId,
                    { y: enterY, scale: 0.992, opacity: 0 },
                    { duration: 360 },
                );
            },
        },
    );
}

function switchProductByIndexDelta(delta, options = {}) {
    if (productSwitching || productTransitionActive || !currentProduct) return;
    const nextProduct = productByIndexDelta(delta);
    if (!nextProduct) return;
    preloadProductImages(nextProduct);

    const travel = selectors.productLayout?.getBoundingClientRect().width || window.innerWidth || 720;
    const exitX = delta > 0 ? -travel * 0.18 : travel * 0.18;
    const enterX = delta > 0 ? travel * 0.14 : -travel * 0.14;
    const imageId = options.imageId ?? firstImageId(nextProduct);
    const fromX = Number(options.fromX ?? 0);
    productSwitching = true;
    setProductSwitching(true);

    animateProductSwitchMotion(
        { x: exitX, scale: 0.992, opacity: 0 },
        {
            fromX,
            fromScale: options.fromScale ?? 1,
            fromOpacity: options.fromOpacity ?? 1,
            duration: 160,
            onComplete: () => {
                commitProductSwitch(
                    nextProduct,
                    imageId,
                    { x: enterX, scale: 0.992, opacity: 0 },
                    { duration: 340 },
                );
            },
        },
    );
}

function captureProductPointer(pointerId) {
    try {
        selectors.productLayout?.setPointerCapture?.(pointerId);
    } catch {}
}

function releaseProductPointer(pointerId) {
    try {
        selectors.productLayout?.releasePointerCapture?.(pointerId);
    } catch {}
}

function onProductPointerDown(event) {
    if (
        !selectors.productLayout ||
        !isProductOpen() ||
        productSwitching ||
        productTransitionActive ||
        isCartOpen() ||
        event.button > 0
    ) {
        // Works for touch, pen, AND mouse (desktop vertical drag to paginate).
        return;
    }

    const target = event.target;
    if (!(target instanceof Element)) return;
    const interactive = target.closest("button, a, input, select, textarea");
    if (interactive && !interactive.matches("[data-image-advance]")) return;

    productSwipeState = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        lastY: event.clientY,
        lastTime: performance.now(),
        velocityY: 0,
        y: 0,
        scale: 1,
        opacity: 1,
        dragging: false,
        captured: false,
        // Cache the layout height once per gesture (no per-move reflow).
        height: selectors.productLayout?.getBoundingClientRect().height || window.innerHeight || 720,
    };
}

function onProductPointerMove(event) {
    if (!productSwipeState || event.pointerId !== productSwipeState.pointerId) return;
    const dy = event.clientY - productSwipeState.startY;
    const dx = event.clientX - productSwipeState.startX;
    const absY = Math.abs(dy);
    const absX = Math.abs(dx);

    if (!productSwipeState.dragging) {
        if (absY < 10) return;
        if (absX > absY * 1.12) {
            releaseProductPointer(event.pointerId);
            productSwipeState = null;
            return;
        }
        productSwipeState.dragging = true;
        productSwipeState.captured = true;
        captureProductPointer(event.pointerId);
        stopProductSwitchAnimation();
        setProductSwitching(true);
    }

    event.preventDefault();
    const now = performance.now();
    const dt = Math.max(16, now - productSwipeState.lastTime);
    productSwipeState.velocityY = (event.clientY - productSwipeState.lastY) / dt;
    productSwipeState.lastY = event.clientY;
    productSwipeState.lastTime = now;

    const height = productSwipeState.height || window.innerHeight || 720;
    const limit = Math.max(110, height * 0.2);
    const eased = limit * Math.tanh(dy / limit);
    const progress = Math.min(1, Math.abs(eased) / limit);
    productSwipeState.y = eased;
    productSwipeState.scale = 1 - progress * 0.018;
    productSwipeState.opacity = 1 - progress * 0.16;
    setProductSwitchMotion(productSwipeState.y, productSwipeState.scale, productSwipeState.opacity);
    // Column pagination feedback: reveal the up/down arrow as you pull.
    revealVerticalArrow(dy > 0 ? "down" : "up", progress);
}

function onProductPointerEnd(event) {
    if (!productSwipeState || event.pointerId !== productSwipeState.pointerId) return;
    const state = productSwipeState;
    productSwipeState = null;
    if (state.captured) releaseProductPointer(event.pointerId);
    clearVerticalArrows();

    if (!state.dragging) return;

    const height = state.height || window.innerHeight || 720;
    const dy = event.clientY - state.startY;
    const projected = dy + state.velocityY * 220;
    const threshold = Math.max(58, height * 0.12);

    if (projected > threshold) {
        switchProductByGridRows(1, {
            fromY: state.y,
            fromScale: state.scale,
            fromOpacity: state.opacity,
        });
    } else if (projected < -threshold) {
        switchProductByGridRows(-1, {
            fromY: state.y,
            fromScale: state.scale,
            fromOpacity: state.opacity,
        });
    } else {
        animateProductSwitchMotion(
            { y: 0, scale: 1, opacity: 1 },
            {
                fromY: state.y,
                fromScale: state.scale,
                fromOpacity: state.opacity,
                duration: 360,
                ease: "out(4)",
                onComplete: () => {
                    setProductSwitching(false);
                    setProductSwitchMotion(0, 1, 1);
                },
            },
        );
    }
}

// Force-resolve any in-flight drag without committing a switch. Fires when the
// pointer is lost in a way that never delivers pointerup — released outside the
// browser window, capture yanked away, or the tab backgrounded mid-swipe. This
// is the desktop "drag past the edge and let go off-screen" safety net.
function cancelActiveDrags() {
    if (dragState) {
        const id = dragState.pointerId;
        const wasDragging = dragState.dragging;
        dragState = null;
        selectors.imageStage?.classList.remove("is-dragging");
        selectors.imageThumbs?.removeAttribute("data-thumb-drag");
        releaseCarouselPointer(id);
        clearEdgeArrows();
        if (wasDragging) {
            paintThumbs(currentImageIndex);
            animateCarouselMotion({ x: 0, scale: 1, rotate: 0, opacity: 1 }, { duration: 320 });
        }
    }
    if (productSwipeState) {
        const state = productSwipeState;
        productSwipeState = null;
        if (state.captured) releaseProductPointer(state.pointerId);
        clearVerticalArrows();
        if (state.dragging) {
            animateProductSwitchMotion(
                { y: 0, scale: 1, opacity: 1 },
                {
                    fromY: state.y,
                    fromScale: state.scale,
                    fromOpacity: state.opacity,
                    duration: 320,
                    onComplete: () => {
                        setProductSwitching(false);
                        setProductSwitchMotion(0, 1, 1);
                    },
                },
            );
        }
    }
}

// --- eager image loading ----------------------------------------------------
// Warm the browser cache so navigating images / paginating products snaps in
// without a flash. Cheap — just detached Image() objects warming HTTP cache.
const preloadedImages = new Set();

function preloadImage(url) {
    if (!url || preloadedImages.has(url)) return;
    preloadedImages.add(url);
    const img = new Image();
    img.decoding = "async";
    img.src = url;
}

function preloadProductImages(product) {
    product?.images?.forEach((image) => preloadImage(image.url));
}

function preloadNeighborProducts() {
    // Front image of every product a swipe could jump to, so the first
    // pagination snaps clean even before the in-swipe preload kicks in.
    [
        productByIndexDelta(1),
        productByIndexDelta(-1),
        productByGridRows(1),
        productByGridRows(-1),
    ].forEach((product) => preloadImage(product?.images?.[0]?.url));
}

function openProduct(product, imageId = "front", options = {}) {
    if (!product || !selectors.panel) return;
    const { replace = false, push = true, focus = true } = options;
    currentProduct = product;
    currentImageIndex = imageIndex(product, imageId);
    selectedSize = selectedSize || "ONE SIZE";
    quantity = 1;

    // Eagerly warm this product's full image set + neighbors' front images.
    preloadProductImages(product);
    preloadNeighborProducts();

    renderProduct(product);
    selectImage(currentImageIndex, { updateUrl: false });
    setCarouselMotion(0, 1, 0, 1);

    updateOverlayScrollGutter();
    selectors.panel.hidden = false;
    selectors.panel.setAttribute("aria-hidden", "false");
    setBackgroundInert(true);
    document.body.classList.add("shop-panel-open");
    showBackdrop();
    if (focus) focusProductDialog();

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
    const { push = true, restoreFocus = true } = options;
    if (!selectors.panel) return;
    const returnSlug = lastOpenedProductSlug || currentProduct?.slug;
    disposePreparedCloseCamera();
    clearEdgeArrows();
    clearVerticalArrows();
    productSwitching = false;
    setProductSwitching(false);
    selectors.panel.hidden = true;
    selectors.panel.setAttribute("aria-hidden", "true");
    setBackgroundInert(false);
    document.body.classList.remove("shop-panel-open");
    currentProduct = null;
    maybeHideBackdrop();
    clearOverlayScrollGutterIfIdle();
    if (push) {
        window.history.pushState({}, "", homeUrl());
    }
    if (restoreFocus) focusGridCard(returnSlug);
}

function renderProduct(product) {
    setText(selectors.productTitle, product.name);
    setText(selectors.productKicker, "Dad cap");
    setText(selectors.productCopyTitle, product.name);
    setText(selectors.productPrice, product.priceLabel);
    setText(selectors.productDescription, product.description);
    renderThumbs(product);
}

function renderThumbs(product) {
    if (!selectors.imageThumbs) return;
    selectors.imageThumbs.textContent = "";
    // Fresh product → fresh dots; never inherit a stale drag flag.
    selectors.imageThumbs.removeAttribute("data-thumb-drag");
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

// Spread "active" weight (0..1) across the dots for a fractional position, so
// the highlight glides continuously between dots while dragging instead of
// snapping only when the image commits. activeFloat = whole index at rest.
function paintThumbs(activeFloat) {
    const thumbs = selectors.imageThumbs?.children;
    if (!thumbs) return;
    for (let i = 0; i < thumbs.length; i++) {
        const weight = Math.max(0, 1 - Math.abs(i - activeFloat));
        thumbs[i].style.setProperty("--active", weight.toFixed(3));
    }
}

function imageIndex(product, imageId) {
    const index = product.images.findIndex((image) => image.id === imageId);
    return index >= 0 ? index : 0;
}

// Peek cells flank the centered main cell so dragging reveals the adjacent
// image. Empty (boundary) cells stay in layout via visibility:hidden so the
// main cell never shifts off-center.
function setCell(cell, image) {
    if (!cell) return;
    if (image) {
        if (cell.getAttribute("src") !== image.url) cell.src = image.url;
        cell.style.visibility = "visible";
    } else {
        cell.removeAttribute("src");
        cell.style.visibility = "hidden";
    }
}

function setCells() {
    const images = currentProduct?.images || [];
    setCell(selectors.cellPrev, images[currentImageIndex - 1]);
    setCell(selectors.cellNext, images[currentImageIndex + 1]);
}

function selectImage(index, options = {}) {
    if (!currentProduct || !selectors.productImage) return;
    const { updateUrl = true, resetMotion = true } = options;
    const images = currentProduct.images;
    // Within a product the index never wraps — overshooting a boundary
    // paginates to an adjacent product instead (handled by the gesture logic).
    currentImageIndex = Math.max(0, Math.min(index, images.length - 1));
    const image = images[currentImageIndex];
    selectors.productImage.src = image.url;
    selectors.productImage.alt = `${currentProduct.name} embroidered dad cap ${image.label.toLowerCase()} view`;
    selectors.productImage.style.visibility = "visible";
    setCells();
    setText(selectors.imageCaption, image.caption);

    selectors.imageThumbs?.querySelectorAll("[data-image-index]").forEach((button) => {
        button.setAttribute(
            "aria-selected",
            button.dataset.imageIndex === String(currentImageIndex) ? "true" : "false",
        );
    });
    paintThumbs(currentImageIndex);

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
    if (!selectors.carouselTrack) return;
    // Base offset of -100% centers the main cell; x is the live drag delta (px).
    selectors.carouselTrack.style.transform = `translate3d(calc(-100% + ${x}px), 0, 0) scale(${scale}) rotate(${rotate}deg)`;
    selectors.carouselTrack.style.opacity = String(opacity);
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
    const complete = () => {
        activeCarouselAnimation = null;
        options.onComplete?.();
    };

    if (reduceMotion.matches) {
        setCarouselMotion(to.x ?? 0, to.scale ?? 1, to.rotate ?? 0, to.opacity ?? 1);
        complete();
        return null;
    }

    const animation = selectors.carouselTrack?.animate(
        [
            {
                transform: `translate3d(calc(-100% + ${from.x}px), 0, 0) scale(${from.scale}) rotate(${from.rotate}deg)`,
                opacity: from.opacity,
            },
            {
                transform: `translate3d(calc(-100% + ${to.x ?? 0}px), 0, 0) scale(${to.scale ?? 1}) rotate(${to.rotate ?? 0}deg)`,
                opacity: to.opacity ?? 1,
            },
        ],
        {
            duration,
            easing: MOTION_EASING,
            fill: "both",
        },
    );

    if (!animation) {
        setCarouselMotion(to.x ?? 0, to.scale ?? 1, to.rotate ?? 0, to.opacity ?? 1);
        complete();
        return null;
    }

    activeCarouselAnimation = {
        cancel: () => {
            animation.cancel();
            activeCarouselAnimation = null;
        },
        pause: () => animation.pause(),
    };
    animation.finished
        .then(() => {
            setCarouselMotion(to.x ?? 0, to.scale ?? 1, to.rotate ?? 0, to.opacity ?? 1);
            animation.cancel();
            complete();
        })
        .catch(() => {});
    return activeCarouselAnimation;
}

function transitionToImage(index, _direction, options = {}) {
    if (!currentProduct) return;
    const images = currentProduct.images || [];
    const target = Math.max(0, Math.min(index, images.length - 1));
    if (target === currentImageIndex) {
        animateCarouselMotion({ x: 0, scale: 1, rotate: 0, opacity: 1 }, { duration: 240 });
        return;
    }
    if (reduceMotion.matches) {
        selectImage(target);
        return;
    }
    // Slide the track one cell toward the target, then rebase. The target cell
    // is already centered + preloaded, so re-centering main is seamless.
    const width = carouselWidth();
    const slideX = target > currentImageIndex ? -width : width;
    animateCarouselMotion(
        { x: slideX, scale: 1, rotate: 0, opacity: 1 },
        {
            duration: options.duration ?? 300,
            onComplete: () => selectImage(target, { updateUrl: true }),
        },
    );
}

function stepImage(delta, options = {}) {
    const direction = delta > 0 ? 1 : -1;
    transitionToImage(currentImageIndex + delta, direction, options);
}

function stepImageOrProduct(delta) {
    if (productSwitching || productTransitionActive || !currentProduct) return;
    const images = currentProduct.images || [];
    if (!images.length) return;

    if (delta > 0 && currentImageIndex < images.length - 1) {
        stepImage(1);
        return;
    }

    if (delta < 0 && currentImageIndex > 0) {
        stepImage(-1);
        return;
    }

    switchProductByIndexDelta(delta);
}

// --- pagination arrows (boundary feedback) ----------------------------------
// JS sets opacity + a --reveal (0..1) custom prop; CSS uses --reveal for the
// elastic scale-in so the base centering transform is preserved.
function setArrow(arrow, reveal) {
    if (!arrow) return;
    // One property write per frame — CSS derives both opacity and the elastic
    // scale from --reveal, keeping this a single compositor-friendly mutation.
    arrow.style.setProperty("--reveal", String(Math.max(0, Math.min(1, reveal))));
}

function clearEdgeArrows() {
    // Reuses the existing carousel nav buttons (no separate floating arrow).
    setArrow(selectors.imagePrev, 0);
    setArrow(selectors.imageNext, 0);
}

function clearVerticalArrows() {
    setArrow(selectors.edgeArrowUp, 0);
    setArrow(selectors.edgeArrowDown, 0);
}

function revealEdgeArrow(dir, reveal) {
    // Light up whichever existing carousel arrow matches the pagination
    // direction — the glow/scale comes from CSS reading --reveal.
    setArrow(selectors.imagePrev, dir === "prev" ? reveal : 0);
    setArrow(selectors.imageNext, dir === "next" ? reveal : 0);
}

function revealVerticalArrow(dir, reveal) {
    setArrow(selectors.edgeArrowUp, dir === "up" ? reveal : 0);
    setArrow(selectors.edgeArrowDown, dir === "down" ? reveal : 0);
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
    // Works for touch, pen, AND mouse (desktop click-drag).
    if (!selectors.imageStage || !currentProduct || event.button > 0) {
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
        // Cache the viewport width once per gesture — the size can't change
        // mid-drag, so the move handler stays read-free (no layout thrash).
        width: carouselWidth(),
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
        // Drop the dot's transition so it tracks the finger 1:1 (re-enabled on
        // release for the settle/commit ease).
        selectors.imageThumbs?.setAttribute("data-thumb-drag", "true");
    }

    event.preventDefault();
    const now = performance.now();
    const dt = Math.max(16, now - dragState.lastTime);
    dragState.velocityX = (event.clientX - dragState.lastX) / dt;
    dragState.lastX = event.clientX;
    dragState.lastTime = now;

    const width = dragState.width || carouselWidth();
    const len = currentProduct?.images?.length || 1;
    const atStart = currentImageIndex === 0;
    const atEnd = currentImageIndex === len - 1;
    // Beyond the first image (pulling right) or the last (pulling left) there's
    // no neighbor image — that gesture paginates to an adjacent product.
    const boundary = dx > 0 && atStart ? "prev" : dx < 0 && atEnd ? "next" : null;

    if (boundary) {
        // Stiff elastic resistance + a growing pagination arrow (the "tissue"
        // stretch); release past threshold switches product.
        const limit = width * 0.55;
        const eased = limit * Math.tanh(dx / (limit * 1.7));
        const progress = Math.min(1, Math.abs(dx) / (width * 0.42));
        dragState.boundary = boundary;
        setCarouselMotion(eased, 1 - progress * 0.02, 0, 1);
        revealEdgeArrow(boundary, progress);
    } else {
        // Free-form peek within the product — near 1:1 so the neighbor image
        // tracks the finger, with gentle damping only at large offsets.
        dragState.boundary = null;
        clearEdgeArrows();
        const limit = width * 1.15;
        const eased = limit * Math.tanh(dx / limit);
        setCarouselMotion(eased, 1, 0, 1);
        // Glide the pagination dot with the image (no commit delay).
        paintThumbs(Math.max(0, Math.min(len - 1, currentImageIndex - eased / width)));
    }
}

function onCarouselPointerEnd(event) {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    const state = dragState;
    dragState = null;
    selectors.imageStage?.classList.remove("is-dragging");
    // Re-enable the dot transition so it eases to its resting/committed spot.
    selectors.imageThumbs?.removeAttribute("data-thumb-drag");
    releaseCarouselPointer(event.pointerId);
    clearEdgeArrows();

    if (!state.dragging) return;
    suppressNextImageAdvance = true;
    window.setTimeout(() => {
        suppressNextImageAdvance = false;
    }, 180);

    const width = state.width || carouselWidth();
    const len = currentProduct?.images?.length || 1;
    const dx = event.clientX - state.startX;
    const projected = dx + state.velocityX * 190;

    // At an image boundary, a far-enough pull paginates to the adjacent product
    // (preloaded → snaps); otherwise it elastically snaps back.
    if (state.boundary) {
        if (Math.abs(projected) > width * 0.32) {
            switchProductByIndexDelta(state.boundary === "next" ? 1 : -1);
            setCarouselMotion(0, 1, 0, 1);
        } else {
            paintThumbs(currentImageIndex);
            animateCarouselMotion({ x: 0, scale: 1, rotate: 0, opacity: 1 }, { duration: 420 });
        }
        return;
    }

    const threshold = Math.max(44, width * 0.18);
    if (projected < -threshold && currentImageIndex < len - 1) {
        // Glide the dot to the incoming image while it slides in (stepImage
        // re-confirms via selectImage on completion).
        paintThumbs(currentImageIndex + 1);
        stepImage(1, { duration: 300 });
    } else if (projected > threshold && currentImageIndex > 0) {
        paintThumbs(currentImageIndex - 1);
        stepImage(-1, { duration: 300 });
    } else {
        paintThumbs(currentImageIndex);
        animateCarouselMotion({ x: 0, scale: 1, rotate: 0, opacity: 1 }, { duration: 420 });
    }
}

function addCurrentToCart() {
    if (!currentProduct) return;
    quantity = 1;
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

    // On a narrow screen the bag opens full-width and would bury the product,
    // so adding stays put with a fly-to-cart flourish (shoppers can stack
    // several caps). Desktop keeps the docked side bag — there's room for it.
    // Snapshot BEFORE the DOM mutates: the + button position (fly origin) and
    // the cart badge's current label (so the count ticks up when the cap lands).
    const compact = compactViewport.matches && isProductOpen();
    const cartToggle = compact
        ? selectors.panel?.querySelector("[data-cart-toggle]") || selectors.cartToggles[0]
        : null;
    const sourceRect = compact ? plusButtonRect() : null;
    const badge = cartToggle?.querySelector("[data-cart-count]");
    const prevLabel = badge ? badge.textContent : null;
    const colors = currentProduct?.colors;

    writeCart();
    renderCart();

    if (compact && cartToggle) {
        celebrateAddToCart({ sourceRect, cartToggle, badge, prevLabel, colors });
    } else if (!compact) {
        openCart();
    }
}

function plusButtonRect() {
    const btn = selectors.panel?.querySelector("[data-size-toggle]");
    return btn ? btn.getBoundingClientRect() : null;
}

// Mobile add-to-cart feedback: a mini-cap arcs from the + button into the cart
// icon, the cart badge ticks up, and an "Added to cart" popover flashes — all
// compositor-only (transform/opacity, WAAPI) so it stays smooth on weak phones.
function celebrateAddToCart({ sourceRect, cartToggle, badge, prevLabel, colors }) {
    const newLabel = badge ? badge.textContent : null;
    const animate = !reduceMotion.matches && !!sourceRect;
    // Hold the displayed count (unless it was 0 → first item, where the badge
    // simply appearing is the cue) so the flying cap delivers the increment.
    if (animate && badge && prevLabel != null && prevLabel !== "0") {
        badge.textContent = prevLabel;
    }
    const land = () => {
        if (badge && newLabel != null) badge.textContent = newLabel;
        bumpCartTarget(cartToggle);
        flashAddedPopover(cartToggle);
    };
    if (!animate) {
        land();
        return;
    }
    flyCapToCart(sourceRect, cartToggle, colors, land);
}

function flyCapToCart(sourceRect, targetEl, colors, onArrive) {
    const targetRect = targetEl.getBoundingClientRect();
    const startX = sourceRect.left + sourceRect.width / 2;
    const startY = sourceRect.top + sourceRect.height / 2;
    const dx = targetRect.left + targetRect.width / 2 - startX;
    const dy = targetRect.top + targetRect.height / 2 - startY;

    const flyer = miniCap(colors);
    flyer.classList.add("shop-fly-cap");
    flyer.style.left = `${startX}px`;
    flyer.style.top = `${startY}px`;
    document.body.append(flyer);

    // Bow the path upward so the cap lobs into the cart instead of sliding flat.
    const lift = Math.min(150, Math.max(54, Math.hypot(dx, dy) * 0.3));
    const animation = flyer.animate(
        [
            { transform: "translate(-50%, -50%) translate(0px, 0px) scale(0.65)", opacity: 0, offset: 0 },
            { transform: `translate(-50%, -50%) translate(${dx * 0.16}px, ${dy * 0.16 - lift * 0.66}px) scale(1.5)`, opacity: 1, offset: 0.16 },
            { transform: `translate(-50%, -50%) translate(${dx * 0.6}px, ${dy * 0.6 - lift}px) scale(1.32)`, opacity: 1, offset: 0.6 },
            { transform: `translate(-50%, -50%) translate(${dx}px, ${dy}px) scale(0.3)`, opacity: 0.3, offset: 1 },
        ],
        { duration: 640, easing: "cubic-bezier(0.45, 0, 0.25, 1)", fill: "forwards" },
    );

    let settled = false;
    const settle = () => {
        if (settled) return;
        settled = true;
        flyer.remove();
        onArrive?.();
    };
    animation.addEventListener("finish", settle);
    animation.addEventListener("cancel", settle);
    // Safety net so the flyer is always cleaned up + the cart still reacts.
    window.setTimeout(settle, 760);
}

function bumpCartTarget(targetEl) {
    if (reduceMotion.matches) return;
    targetEl.animate(
        [
            { transform: "scale(1)" },
            { transform: "scale(1.16)", offset: 0.4 },
            { transform: "scale(1)" },
        ],
        { duration: 340, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
    );
    const badge = targetEl.querySelector("[data-cart-count]");
    if (badge) {
        badge.animate(
            [
                { transform: "translateY(0) scale(1)" },
                { transform: "translateY(-32%) scale(1.55)", offset: 0.4 },
                { transform: "translateY(0) scale(1)" },
            ],
            { duration: 460, easing: "cubic-bezier(0.2, 0.85, 0.25, 1)" },
        );
    }
}

function flashAddedPopover(targetEl) {
    // One popover at a time, so rapid taps refresh rather than stack.
    document.querySelectorAll(".shop-added-pop").forEach((node) => node.remove());
    const rect = targetEl.getBoundingClientRect();
    const pop = document.createElement("div");
    pop.className = "shop-added-pop";
    pop.setAttribute("role", "status");
    pop.setAttribute("aria-live", "polite");
    pop.textContent = "Added to cart";
    document.body.append(pop);
    // Anchor just under the cart button, clamped inside the right edge.
    pop.style.top = `${rect.bottom + 10}px`;
    pop.style.right = `${Math.max(10, window.innerWidth - rect.right)}px`;

    if (reduceMotion.matches) {
        pop.style.opacity = "1";
        window.setTimeout(() => pop.remove(), 1400);
        return;
    }

    pop.animate(
        [
            { opacity: 0, transform: "translateY(-6px) scale(0.92)" },
            { opacity: 1, transform: "translateY(0) scale(1)" },
        ],
        { duration: 220, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)", fill: "forwards" },
    );
    window.setTimeout(() => {
        const out = pop.animate(
            [
                { opacity: 1, transform: "translateY(0) scale(1)" },
                { opacity: 0, transform: "translateY(-6px) scale(0.96)" },
            ],
            { duration: 260, easing: "ease", fill: "forwards" },
        );
        out.addEventListener("finish", () => pop.remove());
        out.addEventListener("cancel", () => pop.remove());
    }, 1250);
}

// --- bag (cart + inline checkout) navigation --------------------------------
// Every transition pushes a history entry, so the URL + back/forward walk
// closed → cart → checkout. popstate reconciles the DOM back to the URL.

function setBag(next, options = {}) {
    const { replace = false } = options;
    const target = next === "cart" || next === "checkout" ? next : null;
    window.history[replace ? "replaceState" : "pushState"](
        { ...(window.history.state || {}), bag: target },
        "",
        bagUrl(target),
    );
    applyBag(target);
}

// Idempotent: reconcile the bag DOM to a desired state. Safe to call from both
// user actions (via setBag) and popstate (which has already changed the URL).
function applyBag(next) {
    if (!selectors.bag) return;
    const prev = bagState();
    const target = next === "cart" || next === "checkout" ? next : null;

    if (!target) {
        if (prev === "closed") return;
        selectors.bag.dataset.bagState = "closed";
        selectors.bag.hidden = true;
        selectors.bag.setAttribute("aria-hidden", "true");
        selectors.cartToggles.forEach((toggle) => toggle.setAttribute("aria-expanded", "false"));
        document.body.classList.remove("shop-cart-open", "shop-bag-checkout");
        // Hand interaction back to the product panel if the bag opened over it.
        if (selectors.panel) selectors.panel.inert = false;
        maybeHideBackdrop();
        clearOverlayScrollGutterIfIdle();
        focusPrimaryCartToggle();
        return;
    }

    updateOverlayScrollGutter();
    renderCart();
    selectors.bag.hidden = false;
    selectors.bag.setAttribute("aria-hidden", "false");
    selectors.cartToggles.forEach((toggle) => toggle.setAttribute("aria-expanded", "true"));
    document.body.classList.add("shop-cart-open");
    showBackdrop();
    // The bag is a modal above the product panel — inert the panel so focus
    // can't escape into it while the bag is open.
    if (isProductOpen()) selectors.panel.inert = true;

    const checkout = target === "checkout";
    selectors.bag.dataset.bagState = target;
    document.body.classList.toggle("shop-bag-checkout", checkout);
    // The pink CTA opens checkout; once you're in the checkout pane it's a no-op,
    // so render it disabled (still visible in the two-pane desktop layout).
    if (selectors.bagCheckoutBtn) selectors.bagCheckoutBtn.disabled = checkout;
    if (selectors.bagCheckoutPane) {
        // The pane stays in the DOM (rendered off-screen — see .shop-bag-checkout)
        // so Stripe can mount + warm up ahead of time. `inert` keeps its fields
        // out of the tab order + a11y tree while it's staged off-screen.
        selectors.bagCheckoutPane.inert = !checkout;
        selectors.bagCheckoutPane.setAttribute("aria-hidden", checkout ? "false" : "true");
    }

    // Warm the Stripe Elements off-screen the moment the bag opens, so reaching
    // checkout is instant + shift-free. Entering checkout directly (deep link /
    // fast click) mounts now; otherwise we mount during idle so it never janks
    // the cart-open on weak devices. mountCheckout is idempotent.
    if (checkout) requestAnimationFrame(mountCheckout);
    else scheduleEagerCheckoutMount();

    if (prev === "closed" && !checkout) {
        selectors.bag.querySelector("[data-close-bag]")?.focus({ preventScroll: true });
    } else if (checkout && prev !== "checkout") {
        selectors.bagCheckoutPane
            ?.querySelector("[data-bag-back]")
            ?.focus({ preventScroll: true });
    } else if (!checkout && prev === "checkout") {
        selectors.bagCheckoutBtn?.focus({ preventScroll: true });
    }
}

function openCart() {
    setBag("cart");
}

function closeCart() {
    setBag(null);
}

function cartLineCount() {
    return cart.reduce((total, item) => total + Number(item.quantity || 0), 0);
}

function cartTotalDollars() {
    return cart.reduce((sum, item) => {
        const product = productBySlug.get(item.slug);
        return sum + (product ? product.price * Number(item.quantity || 0) : 0);
    }, 0);
}

// A tiny embroidered-cap chip drawn from the product's own three colors.
function miniCap(colors) {
    const cap = document.createElement("span");
    cap.className = "mini-cap";
    cap.setAttribute("aria-hidden", "true");
    if (colors) {
        cap.style.setProperty("--cap", colors.cap);
        cap.style.setProperty("--thread", colors.thread);
        cap.style.setProperty("--accent", colors.accent);
    }
    const crown = document.createElement("span");
    crown.className = "mini-cap-crown";
    const brim = document.createElement("span");
    brim.className = "mini-cap-brim";
    const dot = document.createElement("span");
    dot.className = "mini-cap-dot";
    cap.append(crown, brim, dot);
    return cap;
}

function cartIconButton(content, ariaLabel, onClick) {
    const btn = document.createElement("button");
    btn.type = "button";
    if (content instanceof Node) btn.append(content);
    else btn.textContent = content;
    btn.setAttribute("aria-label", ariaLabel);
    btn.addEventListener("click", onClick);
    return btn;
}

// Crisp, perfectly-centred control glyphs (minus / plus / close) drawn as SVG
// strokes — same language as the nav chevrons. Text glyphs sit off-centre in
// their line box across fonts; a viewBox-centred path never does.
const CONTROL_ICON_PATHS = {
    minus: "M4 8 H12",
    plus: "M8 4 V12 M4 8 H12",
    close: "M5 5 L11 11 M11 5 L5 11",
};

function controlIcon(name) {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 16 16");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.classList.add("shop-control-icon");
    const path = document.createElementNS(ns, "path");
    path.setAttribute("d", CONTROL_ICON_PATHS[name]);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "currentColor");
    path.setAttribute("stroke-width", "2");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    svg.append(path);
    return svg;
}

function changeCartQty(slug, delta) {
    const item = cart.find((i) => i.slug === slug);
    if (!item) return;
    item.quantity = Math.max(1, Math.min(99, Number(item.quantity || 1) + delta));
    writeCart();
    // Targeted update: refresh only this row's qty + price instead of rebuilding
    // the whole list, so rapid +/- clicks stay cheap (keeps INP low).
    const product = productBySlug.get(slug);
    const row = selectors.cartItems?.querySelector(".shop-cart-item" + slugSelector(slug));
    const qtyEl = row?.querySelector(".shop-cart-qty-val");
    const priceEl = row?.querySelector(".shop-cart-item-price");
    if (product && qtyEl && priceEl) {
        qtyEl.textContent = String(item.quantity);
        priceEl.textContent = `$${product.price * item.quantity}`;
        syncCartChrome();
    } else {
        renderCart();
    }
}

function removeCartItem(slug) {
    cart = cart.filter((i) => i.slug !== slug);
    writeCart();
    const row = selectors.cartItems?.querySelector(".shop-cart-item" + slugSelector(slug));
    if (cart.length && row) {
        row.remove();
        syncCartChrome();
    } else {
        renderCart();
    }
    // Editing the bag down to empty while paying drops back to the cart pane.
    if (!cart.length && bagState() === "checkout") setBag("cart");
}

function cartRow(item, product) {
    const row = document.createElement("li");
    row.className = "shop-cart-item";
    row.dataset.slug = item.slug;

    const top = document.createElement("div");
    top.className = "shop-cart-item-top";
    const head = document.createElement("div");
    head.className = "shop-cart-item-head";
    head.append(miniCap(product.colors));
    const title = document.createElement("strong");
    title.textContent = product.name;
    head.append(title);
    const price = document.createElement("span");
    price.className = "shop-cart-item-price";
    price.textContent = `$${product.price * Number(item.quantity || 1)}`;
    top.append(head, price);

    const controls = document.createElement("div");
    controls.className = "shop-cart-qty";
    controls.setAttribute("role", "group");
    controls.setAttribute("aria-label", `Quantity for ${product.name}`);
    const minus = cartIconButton(controlIcon("minus"), `Decrease ${product.name}`, () => changeCartQty(item.slug, -1));
    minus.className = "shop-cart-qty-btn";
    const qty = document.createElement("span");
    qty.className = "shop-cart-qty-val";
    qty.textContent = String(item.quantity);
    const plus = cartIconButton(controlIcon("plus"), `Increase ${product.name}`, () => changeCartQty(item.slug, 1));
    plus.className = "shop-cart-qty-btn";
    const remove = cartIconButton(controlIcon("close"), `Remove ${product.name}`, () => removeCartItem(item.slug));
    remove.className = "shop-cart-remove";
    controls.append(minus, qty, plus, remove);

    row.append(top, controls);
    return row;
}

// Add an arbitrary product (used by the empty-bag recommendation). No fly
// flourish — the shopper is already looking at the bag.
function addProductToCart(slug) {
    const product = productBySlug.get(slug);
    if (!product) return;
    const existing = cart.find((i) => i.slug === slug && i.size === selectedSize);
    if (existing) existing.quantity = Math.min(99, existing.quantity + 1);
    else cart.push({ slug, size: selectedSize, quantity: 1 });
    writeCart();
    renderCart();
}

function recommendedProduct() {
    return products[0] || null;
}

// Empty-bag nudge: one featured cap instead of a bare message + a pointless
// Clear button. Adding it re-runs renderCart, the bag is no longer empty, and
// the card is replaced by the real line item.
function recommendationCard() {
    const product = recommendedProduct();
    if (!product) return null;

    const card = document.createElement("div");
    card.className = "shop-cart-reco";

    const kicker = document.createElement("p");
    kicker.className = "shop-cart-reco-kicker";
    kicker.textContent = "You might like";

    const body = document.createElement("div");
    body.className = "shop-cart-reco-body";

    const img = document.createElement("img");
    img.className = "shop-cart-reco-img";
    img.src = product.images?.[0]?.url || "";
    img.alt = "";
    img.width = 900;
    img.height = 1100;
    img.loading = "lazy";
    img.decoding = "async";

    const info = document.createElement("div");
    info.className = "shop-cart-reco-info";
    const name = document.createElement("strong");
    name.textContent = product.name;
    const price = document.createElement("span");
    price.className = "shop-cart-reco-price";
    price.textContent = product.priceLabel;
    info.append(name, price);

    body.append(img, info);

    const add = document.createElement("button");
    add.type = "button";
    add.className = "shop-cart-reco-add";
    add.textContent = "Add to bag";
    add.setAttribute("aria-label", `Add ${product.name} to bag`);
    add.addEventListener("click", () => addProductToCart(product.slug));

    card.append(kicker, body, add);
    return card;
}

// The cart "chrome" — counts, total, CTA visibility, Stripe amount, pay button.
// Split out from the list build so targeted row edits can refresh it without a
// full <ul> rebuild.
function syncCartChrome() {
    const count = cartLineCount();
    const total = cartTotalDollars();
    checkoutAmount = total * 100;

    selectors.cartCounts.forEach((cartCount) => {
        cartCount.textContent = String(count);
        cartCount.dataset.empty = count === 0 ? "true" : "false";
    });
    setText(selectors.cartTotal, `$${total}`);
    // Empty bag → no footer at all (the total/Clear are meaningless, and the
    // recommendation card below takes that space instead). Reveal otherwise.
    const empty = cart.length === 0;
    if (selectors.cartFoot) selectors.cartFoot.hidden = empty;
    if (selectors.cartClear) selectors.cartClear.hidden = empty;
    if (selectors.bagCheckoutBtn) selectors.bagCheckoutBtn.hidden = empty;

    // Keep the inline Stripe amount in sync, debounced so a burst of stepper
    // clicks triggers a single Elements update.
    if (checkoutReady) scheduleCheckoutAmountUpdate();
    refreshPayButton();
}

function renderCart() {
    if (selectors.cartItems) {
        selectors.cartItems.textContent = "";
        if (!cart.length) {
            const empty = document.createElement("p");
            empty.className = "shop-cart-empty";
            empty.textContent = EMPTY_STATE;
            selectors.cartItems.append(empty);
            // Don't nudge inside the checkout pane (it's visible beside the
            // cart on desktop, and shows the post-payment confirmation).
            const reco = bagState() === "checkout" ? null : recommendationCard();
            if (reco) selectors.cartItems.append(reco);
        } else {
            const list = document.createElement("ul");
            list.className = "shop-cart-list";
            const frag = document.createDocumentFragment();
            cart.forEach((item) => {
                const product = productBySlug.get(item.slug);
                if (product) frag.append(cartRow(item, product));
            });
            list.append(frag);
            selectors.cartItems.append(list);
        }
    }
    syncCartChrome();
}

function setText(element, value) {
    if (element) element.textContent = value;
}

function handleGridClick(event) {
    if (isProductOpen() || productTransitionActive) {
        event.preventDefault();
        return;
    }
    const card = event.target.closest("[data-product-card]");
    if (!card) return;
    const product = productBySlug.get(card.dataset.slug);
    if (!product) return;
    event.preventDefault();
    openProductFromCard(product, "front", card);
}

function handleGridKeydown(event) {
    if (event.key !== " ") return;
    if (isProductOpen() || productTransitionActive) {
        event.preventDefault();
        return;
    }
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
        stepImageOrProduct(-1);
        return;
    }

    if (target.closest("[data-image-next]")) {
        stepImageOrProduct(1);
        return;
    }

    if (target.closest("[data-image-advance]")) {
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
        // This store has no sizes — the plus button is a direct add-to-cart,
        // no size sheet, no transition.
        addCurrentToCart();
        return;
    }


    if (target.closest("[data-cart-toggle]")) {
        if (isCartOpen()) setBag(null);
        else setBag("cart");
        return;
    }

    if (target.closest("[data-close-bag]")) {
        setBag(null);
        return;
    }

    if (target.closest("[data-bag-scrim]")) {
        setBag(null);
        return;
    }

    if (target.closest("[data-bag-checkout]")) {
        setBag("checkout");
        return;
    }

    if (target.closest("[data-bag-back]")) {
        setBag("cart");
        return;
    }

    if (target.closest("[data-bag-done-close]")) {
        setBag(null);
        return;
    }

    if (target.closest("[data-cart-clear]")) {
        cart = [];
        writeCart();
        renderCart();
        if (bagState() === "checkout") setBag("cart");
        return;
    }

    if (target === selectors.backdrop) {
        if (isCartOpen()) setBag(null);
        if (isProductOpen()) closeProductWithTransition();
    }
});

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        if (isCartOpen()) {
            // Step back one level: checkout → cart → closed.
            if (bagState() === "checkout") setBag("cart");
            else setBag(null);
            return;
        }
        if (isProductOpen()) {
            closeProductWithTransition();
            return;
        }
    }

    if (event.key === "Tab") {
        const trapContainer = activeFocusTrapContainer();
        if (trapContainer) trapFocusIn(trapContainer, event);
        return;
    }

    if (!isProductOpen()) return;

    if (event.key === "ArrowLeft") {
        event.preventDefault();
        stepImageOrProduct(-1);
    } else if (event.key === "ArrowRight") {
        event.preventDefault();
        stepImageOrProduct(1);
    } else if (event.key === "ArrowUp") {
        event.preventDefault();
        switchProductByGridRows(-1);
    } else if (event.key === "ArrowDown") {
        event.preventDefault();
        switchProductByGridRows(1);
    } else if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        addCurrentToCart();
    }
});

window.addEventListener("popstate", () => {
    const match = getProductFromLocation();
    if (match) {
        // Only (re)open if the product actually changed — a bag-only URL change
        // (cart↔checkout while a product is open) must not re-run the camera.
        if (!isProductOpen() || currentProduct?.slug !== match.product.slug) {
            openProduct(match.product, match.imageId, { push: false });
            schedulePrepareCloseCamera(match.product.slug);
        }
    } else if (isProductOpen()) {
        closeProductWithTransition({ push: false });
    }
    applyBag(currentBagFromUrl());
});

window.addEventListener("resize", () => {
    const slug = currentProduct?.slug;
    if (document.body.classList.contains("shop-panel-open") || document.body.classList.contains("shop-cart-open")) {
        updateOverlayScrollGutter({ force: true });
    }
    disposePreparedCloseCamera();
    if (slug && isProductOpen()) schedulePrepareCloseCamera(slug);
});

renderCart();

// Gestures START on their element but are TRACKED and ENDED on the window. With
// a mouse you can yank the cursor past the image/viewport — or out of the
// browser entirely — faster than pointer-capture redelivers; binding move/up to
// the window guarantees we still observe the move and, above all, the release,
// so a big desktop swipe can never strand a gesture mid-drag. The move handlers
// call preventDefault() while dragging, so they must be non-passive.
selectors.imageStage?.addEventListener("pointerdown", onCarouselPointerDown);
selectors.productLayout?.addEventListener("pointerdown", onProductPointerDown);
window.addEventListener("pointermove", onCarouselPointerMove, { passive: false });
window.addEventListener("pointermove", onProductPointerMove, { passive: false });
window.addEventListener("pointerup", onCarouselPointerEnd);
window.addEventListener("pointerup", onProductPointerEnd);
window.addEventListener("pointercancel", onCarouselPointerEnd);
window.addEventListener("pointercancel", onProductPointerEnd);
// NOTE: deliberately NOT listening to `lostpointercapture`. Arming a vertical
// swipe transfers pointer capture from the image stage to the product layout,
// which fires lostpointercapture mid-gesture — using it as a "drag lost" signal
// cancelled the swipe the instant it started. pointerup/pointercancel below
// already terminate every real release; blur/visibilitychange cover the rest.
window.addEventListener("blur", cancelActiveDrags);
document.addEventListener("visibilitychange", () => {
    if (document.hidden) cancelActiveDrags();
});

const initial = getProductFromLocation();
if (initial) {
    openProduct(initial.product, initial.imageId, { replace: true, focus: false });
    schedulePrepareCloseCamera(initial.product.slug);
}

// ---------------------------------------------------------------------------
// Inline checkout (Stripe Elements in the bag's right pane)
//
// Deferred PaymentIntent: mount Payment + Address Elements with a target amount,
// then at pay time elements.submit() → POST /api/checkout/intent (server prices
// the cart) → stripe.confirmPayment(redirect:"if_required"). Card payments
// confirm on-page (the bag stamps PAID); a 3DS redirect returns to ?bag=checkout
// and we finalize inline. Elements are themed off the live oklch tokens.
// ---------------------------------------------------------------------------

function coEl(sel) {
    return selectors.bagCheckoutPane ? selectors.bagCheckoutPane.querySelector(sel) : null;
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

function payLabel() {
    return checkoutAmount > 0 ? `Pay ${money(checkoutAmount)}` : "Pay";
}

function refreshPayButton() {
    const btn = coEl("[data-checkout-pay]");
    if (!btn) return;
    const label = coEl("[data-pay-label]");
    if (label && !checkoutBusy) label.textContent = payLabel();
    btn.disabled = checkoutBusy || !checkoutReady || cart.length === 0 || checkoutAmount < 50;
}

function setPayBusy(value) {
    checkoutBusy = value;
    const label = coEl("[data-pay-label]");
    const spinner = coEl("[data-pay-spinner]");
    if (label) label.textContent = value ? "Processing…" : payLabel();
    if (spinner) spinner.hidden = !value;
    refreshPayButton();
}

function showCheckoutError(message) {
    const el = coEl("[data-checkout-error]");
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
}

function clearCheckoutError() {
    const el = coEl("[data-checkout-error]");
    if (el) {
        el.textContent = "";
        el.hidden = true;
    }
}

function clearCheckoutSkeleton(sel) {
    const host = coEl(sel);
    const skeleton = host && host.querySelector(".shop-checkout-skeleton");
    if (skeleton) skeleton.remove();
}

// --- theme → Stripe Appearance bridge (resolve oklch tokens via canvas) ---

let _coProbe;
let _coCtx;

function coProbe() {
    if (_coProbe && _coProbe.isConnected) return _coProbe;
    _coProbe = document.createElement("span");
    _coProbe.setAttribute("aria-hidden", "true");
    _coProbe.style.cssText =
        "position:absolute;left:-9999px;top:-9999px;width:0;height:0;opacity:0;pointer-events:none;";
    document.body.appendChild(_coProbe);
    return _coProbe;
}

function coToHex(color) {
    try {
        if (!_coCtx) _coCtx = document.createElement("canvas").getContext("2d");
        _coCtx.fillStyle = "#000";
        _coCtx.fillStyle = color;
        const normalized = _coCtx.fillStyle;
        if (typeof normalized === "string" && normalized.startsWith("#")) return normalized;
        _coCtx.fillRect(0, 0, 1, 1);
        const [r, g, b] = _coCtx.getImageData(0, 0, 1, 1).data;
        return "#" + [r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("");
    } catch {
        return null;
    }
}

function coColor(varName, fallback) {
    const p = coProbe();
    p.style.color = `var(${varName})`;
    const resolved = getComputedStyle(p).color;
    if (!resolved || resolved === "currentcolor") return fallback;
    return coToHex(resolved) || fallback;
}

function coRadius(varName, fallback) {
    const p = coProbe();
    p.style.borderTopLeftRadius = `var(${varName})`;
    const r = getComputedStyle(p).borderTopLeftRadius;
    return /px|rem|em/.test(r) ? r : fallback;
}

function coAlpha(hex, alpha) {
    const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || "");
    if (!m) return hex;
    const [r, g, b] = [m[1], m[2], m[3]].map((h) => parseInt(h, 16));
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function buildAppearance() {
    const surface1 = coColor("--surface-1", "#ffffff");
    const surface2 = coColor("--surface-2", "#f4f4f5");
    const text1 = coColor("--text-1", "#111111");
    const text2 = coColor("--text-2", "#555555");
    const muted = coColor("--text-muted", "#8a8a8a");
    const primary = coColor("--color-primary", "#4c4fdd");
    const danger = coColor("--color-error", "#e5484d");
    const border = coColor("--border-muted", "#dcdcdc");
    const radius = coRadius("--radius-field", "10px");

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
            fontFamily: '"Archivo", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
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
                boxShadow: `0 0 0 3px ${coAlpha(primary, 0.25)}`,
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

// Eagerly mount the Stripe Elements during idle (off-screen, into the staged
// checkout pane) so checkout is instant + shift-free. Idle so it never competes
// with the cart-open animation on weak devices; idempotent via checkoutMounted.
function scheduleEagerCheckoutMount() {
    if (checkoutMounted) return;
    if ("requestIdleCallback" in window) {
        window.requestIdleCallback(() => mountCheckout(), { timeout: 1200 });
    } else {
        window.setTimeout(() => mountCheckout(), 200);
    }
}

function mountCheckout() {
    if (checkoutMounted) return;
    checkoutMounted = true;

    if (!CHECKOUT.enabled || !CHECKOUT.publishableKey || typeof window.Stripe !== "function") {
        const notice = coEl("[data-checkout-disabled]");
        if (notice) notice.hidden = false;
        const form = coEl("[data-checkout-form]");
        if (form) form.hidden = true;
        return;
    }

    stripe = window.Stripe(CHECKOUT.publishableKey);
    checkoutAmount = cartTotalDollars() * 100;
    elements = stripe.elements({
        mode: "payment",
        amount: Math.max(50, checkoutAmount),
        currency: CHECKOUT.currency || "usd",
        appearance: buildAppearance(),
    });

    addressElement = elements.create("address", { mode: "shipping" });
    const addressHost = coEl("[data-address-element]");
    if (addressHost) addressElement.mount(addressHost);
    addressElement.on("ready", () => clearCheckoutSkeleton("[data-address-element]"));

    paymentElement = elements.create("payment", { layout: { type: "tabs" } });
    const paymentHost = coEl("[data-payment-element]");
    if (paymentHost) paymentElement.mount(paymentHost);
    paymentElement.on("ready", () => {
        clearCheckoutSkeleton("[data-payment-element]");
        checkoutReady = true;
        refreshPayButton();
    });

    const form = coEl("[data-checkout-form]");
    if (form) form.addEventListener("submit", payCheckout);
}

function scheduleCheckoutAmountUpdate() {
    // Coalesce a burst of stepper clicks into a single Stripe Elements update
    // (each update is a cross-iframe message — not free).
    if (amountUpdateTimer) clearTimeout(amountUpdateTimer);
    amountUpdateTimer = setTimeout(() => {
        amountUpdateTimer = null;
        updateCheckoutAmount();
    }, 120);
}

function updateCheckoutAmount() {
    // Keep Elements in sync with the cart on every edit. Stripe needs a >=50¢
    // floor; the pay button stays gated below the real minimum elsewhere.
    if (!elements || checkoutAmount <= 0) return;
    try {
        elements.update({ amount: Math.max(50, checkoutAmount) });
    } catch {}
}

async function payCheckout(event) {
    event.preventDefault();
    if (checkoutBusy || !checkoutReady) return;
    clearCheckoutError();

    const emailInput = coEl("[data-checkout-email]");
    const email = (emailInput && emailInput.value.trim()) || "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showCheckoutError("Enter a valid email so we can send your confirmation.");
        emailInput?.focus();
        return;
    }
    if (!cart.length) {
        setBag("cart");
        return;
    }

    setPayBusy(true);

    const submitResult = await elements.submit();
    if (submitResult.error) {
        showCheckoutError(submitResult.error.message || "Double-check your details and try again.");
        setPayBusy(false);
        return;
    }

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

    let data;
    try {
        const resp = await fetch("/api/checkout/intent", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                items: cart.map((i) => ({ slug: i.slug, quantity: i.quantity })),
                email,
                shipping,
            }),
        });
        data = await resp.json().catch(() => ({}));
        if (!resp.ok || !data.clientSecret) {
            showCheckoutError(data.error || "We couldn’t start the payment. Please try again.");
            setPayBusy(false);
            return;
        }
    } catch {
        showCheckoutError("Network hiccup. Check your connection and try again.");
        setPayBusy(false);
        return;
    }

    const returnUrl = new URL(CHECKOUT.returnPath || "/", window.location.origin);
    returnUrl.searchParams.set("bag", "checkout");
    const result = await stripe.confirmPayment({
        elements,
        clientSecret: data.clientSecret,
        confirmParams: { return_url: returnUrl.toString(), receipt_email: email },
        redirect: "if_required",
    });

    if (result.error) {
        showCheckoutError(result.error.message || "Your payment couldn’t be completed.");
        setPayBusy(false);
        return;
    }
    onCheckoutPaid(result.paymentIntent, email);
}

function onCheckoutPaid(paymentIntent, email) {
    cart = [];
    writeCart();
    renderCart();

    const stamp = selectors.bag?.querySelector("[data-bag-stamp]");
    if (stamp) stamp.dataset.show = "true";
    const form = coEl("[data-checkout-form]");
    if (form) form.hidden = true;
    const done = coEl("[data-checkout-done]");
    if (done) done.hidden = false;
    const sub = coEl("[data-checkout-done-sub]");
    const receiptEmail = email || (paymentIntent && paymentIntent.receipt_email) || "";
    if (sub) {
        sub.textContent = receiptEmail
            ? `A receipt is on its way to ${receiptEmail}.`
            : "Your order is confirmed.";
    }
    setPayBusy(false);
}

async function finalizeCheckoutReturn(clientSecret) {
    if (!clientSecret) return;
    if (typeof window.Stripe !== "function" || !CHECKOUT.publishableKey) return;
    if (!stripe) stripe = window.Stripe(CHECKOUT.publishableKey);
    try {
        const { paymentIntent } = await stripe.retrievePaymentIntent(clientSecret);
        if (
            paymentIntent &&
            (paymentIntent.status === "succeeded" || paymentIntent.status === "processing")
        ) {
            onCheckoutPaid(paymentIntent, paymentIntent.receipt_email || "");
        }
    } catch {}
}

window.addEventListener("engmanager:themechange", () => {
    if (elements) {
        try {
            elements.update({ appearance: buildAppearance() });
        } catch {}
    }
});

// Bag deep-link + Stripe redirect return, applied after the product initial state.
(() => {
    const params = new URLSearchParams(window.location.search);
    const clientSecret = params.get("payment_intent_client_secret");
    const bag = currentBagFromUrl();
    if (bag) applyBag(bag);
    if (clientSecret) finalizeCheckoutReturn(clientSecret);
})();
