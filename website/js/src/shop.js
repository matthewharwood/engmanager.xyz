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
    sizeSummary: document.querySelector("[data-size-summary]"),
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
let selectedSize = "ONE SIZE";
let quantity = 1;
let cart = readCart();
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
    if (isCartOpen()) return selectors.cartDrawer;
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

    const travel = selectors.productLayout?.getBoundingClientRect().height || window.innerHeight || 720;
    const exitY = rowDelta > 0 ? travel * 0.22 : -travel * 0.22;
    const enterY = rowDelta > 0 ? -travel * 0.18 : travel * 0.18;
    const imageId = firstImageId(nextProduct);
    const fromY = Number(options.fromY ?? 0);
    productSwitching = true;
    setProductSwitching(true);

    animateProductSwitchMotion(
        { y: exitY, scale: 0.986, opacity: 0.72 },
        {
            fromY,
            fromScale: options.fromScale ?? 1,
            fromOpacity: options.fromOpacity ?? 1,
            duration: 150,
            onComplete: () => {
                commitProductSwitch(nextProduct, imageId, {
                    y: enterY,
                    scale: 0.988,
                    opacity: 0.76,
                });
            },
        },
    );
}

function switchProductByIndexDelta(delta, options = {}) {
    if (productSwitching || productTransitionActive || !currentProduct) return;
    const nextProduct = productByIndexDelta(delta);
    if (!nextProduct) return;

    const travel = selectors.productLayout?.getBoundingClientRect().width || window.innerWidth || 720;
    const exitX = delta > 0 ? -travel * 0.18 : travel * 0.18;
    const enterX = delta > 0 ? travel * 0.14 : -travel * 0.14;
    const imageId = options.imageId ?? firstImageId(nextProduct);
    const fromX = Number(options.fromX ?? 0);
    productSwitching = true;
    setProductSwitching(true);

    animateProductSwitchMotion(
        { x: exitX, scale: 0.988, opacity: 0.74 },
        {
            fromX,
            fromScale: options.fromScale ?? 1,
            fromOpacity: options.fromOpacity ?? 1,
            duration: 140,
            onComplete: () => {
                commitProductSwitch(nextProduct, imageId, {
                    x: enterX,
                    scale: 0.99,
                    opacity: 0.76,
                });
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
        event.button > 0 ||
        event.pointerType === "mouse"
    ) {
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

    const height = selectors.productLayout?.getBoundingClientRect().height || window.innerHeight || 720;
    const limit = Math.max(110, height * 0.2);
    const eased = limit * Math.tanh(dy / limit);
    const progress = Math.min(1, Math.abs(eased) / limit);
    productSwipeState.y = eased;
    productSwipeState.scale = 1 - progress * 0.018;
    productSwipeState.opacity = 1 - progress * 0.16;
    setProductSwitchMotion(productSwipeState.y, productSwipeState.scale, productSwipeState.opacity);
}

function onProductPointerEnd(event) {
    if (!productSwipeState || event.pointerId !== productSwipeState.pointerId) return;
    const state = productSwipeState;
    productSwipeState = null;
    if (state.captured) releaseProductPointer(event.pointerId);

    if (!state.dragging) return;

    const height = selectors.productLayout?.getBoundingClientRect().height || window.innerHeight || 720;
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

function openProduct(product, imageId = "front", options = {}) {
    if (!product || !selectors.panel) return;
    const { replace = false, push = true, focus = true } = options;
    currentProduct = product;
    currentImageIndex = imageIndex(product, imageId);
    selectedSize = selectedSize || "ONE SIZE";
    quantity = 1;

    renderProduct(product);
    selectImage(currentImageIndex, { updateUrl: false });
    setCarouselMotion(0, 1, 0, 1);
    syncSizeControls();
    closeSizeSheet();

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
    closeSizeSheet();
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
    setText(selectors.sizePrice, product.priceLabel);
    setText(
        selectors.sizeInfoCopy,
        `Low-profile dad cap with front embroidery, adjustable back strap, and one-size fit. ${product.phrase} ships here as a storefront concept.`,
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
    const complete = () => {
        activeCarouselAnimation = null;
        options.onComplete?.();
    };

    if (reduceMotion.matches) {
        setCarouselMotion(to.x ?? 0, to.scale ?? 1, to.rotate ?? 0, to.opacity ?? 1);
        complete();
        return null;
    }

    const animation = selectors.imageStage?.animate(
        [
            {
                transform: `translate3d(${from.x}px, 0, 0) scale(${from.scale}) rotate(${from.rotate}deg)`,
                opacity: from.opacity,
            },
            {
                transform: `translate3d(${to.x ?? 0}px, 0, 0) scale(${to.scale ?? 1}) rotate(${to.rotate ?? 0}deg)`,
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
    selectors.sizeSummary?.setAttribute("aria-hidden", "true");
    if (selectors.sizeSummary) selectors.sizeSummary.inert = true;
    selectors.sizeInfo?.classList.add("is-collapsed");
    selectors.sizeToggle?.setAttribute("aria-expanded", "true");
    selectors.panel?.classList.add("is-sizing");
    syncSizeControls();
    selectors.sizeSheet.focus({ preventScroll: true });
}

function closeSizeSheet() {
    if (!selectors.sizeSheet) return;
    selectors.sizeSheet.hidden = true;
    selectors.sizeSummary?.removeAttribute("aria-hidden");
    if (selectors.sizeSummary) selectors.sizeSummary.inert = false;
    selectors.sizeInfo?.classList.add("is-collapsed");
    selectors.sizeToggle?.setAttribute("aria-expanded", "false");
    selectors.panel?.classList.remove("is-sizing");
}

function syncSizeControls() {
    selectors.sizeSheet?.querySelectorAll("[data-size-option]").forEach((button) => {
        const isSelected = button.dataset.sizeOption === selectedSize;
        button.classList.toggle("is-selected", isSelected);
        if (button.getAttribute("role") === "radio") {
            button.setAttribute("aria-checked", isSelected ? "true" : "false");
        }
    });
    setText(selectors.quantityValue, String(quantity));
}

function changeQuantity(delta) {
    quantity = Math.min(9, Math.max(1, quantity + delta));
    syncSizeControls();
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
    writeCart();
    renderCart();
    openCart();
}

function openCart() {
    if (!selectors.cartDrawer) return;
    updateOverlayScrollGutter();
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
    clearOverlayScrollGutterIfIdle();
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
        const sizeLabel = item.size === "ONE SIZE" ? "One size" : `Size ${item.size}`;
        meta.textContent = `${sizeLabel} x ${item.quantity} - $${product.price * item.quantity}`;

        row.append(title, meta);
        list.append(row);
    });
    selectors.cartItems.append(list);
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
        selectedSize = sizeButton.dataset.sizeOption || "ONE SIZE";
        syncSizeControls();
        if (sizeButton.matches("[data-size-add]")) {
            addCurrentToCart();
        }
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
            focusPrimaryCartToggle();
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
        openSizeSheet();
    } else if (event.key.toLowerCase() === "i") {
        selectors.sizeInfo?.classList.toggle("is-collapsed");
    }
});

window.addEventListener("popstate", () => {
    const match = getProductFromLocation();
    if (match) {
        openProduct(match.product, match.imageId, { push: false });
        schedulePrepareCloseCamera(match.product.slug);
    } else if (isProductOpen()) {
        closeProductWithTransition({ push: false });
    }
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

selectors.imageStage?.addEventListener("pointerdown", onCarouselPointerDown);
selectors.imageStage?.addEventListener("pointermove", onCarouselPointerMove);
selectors.imageStage?.addEventListener("pointerup", onCarouselPointerEnd);
selectors.imageStage?.addEventListener("pointercancel", onCarouselPointerEnd);
selectors.productLayout?.addEventListener("pointerdown", onProductPointerDown);
selectors.productLayout?.addEventListener("pointermove", onProductPointerMove);
selectors.productLayout?.addEventListener("pointerup", onProductPointerEnd);
selectors.productLayout?.addEventListener("pointercancel", onProductPointerEnd);

const initial = getProductFromLocation();
if (initial) {
    openProduct(initial.product, initial.imageId, { replace: true, focus: false });
    schedulePrepareCloseCamera(initial.product.slug);
}
