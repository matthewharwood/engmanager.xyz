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

function openProduct(product, imageId = "front", options = {}) {
    if (!product || !selectors.panel) return;
    const { replace = false, push = true } = options;
    currentProduct = product;
    currentImageIndex = imageIndex(product, imageId);
    selectedSize = selectedSize || "2";
    quantity = Math.max(1, quantity || 1);

    renderProduct(product);
    selectImage(currentImageIndex, { updateUrl: false });
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
    const { updateUrl = true } = options;
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
    openProduct(product, "front");
}

function handleGridKeydown(event) {
    if (event.key !== " ") return;
    const card = event.target.closest("[data-product-card]");
    if (!card) return;
    const product = productBySlug.get(card.dataset.slug);
    if (!product) return;
    event.preventDefault();
    openProduct(product, "front");
}

selectors.grid?.addEventListener("click", handleGridClick);
selectors.grid?.addEventListener("keydown", handleGridKeydown);

document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    if (target.closest("[data-close-product]")) {
        closeProduct();
        return;
    }

    if (target.closest("[data-image-prev]")) {
        selectImage(currentImageIndex - 1);
        return;
    }

    if (target.closest("[data-image-next], [data-image-advance]")) {
        selectImage(currentImageIndex + 1);
        return;
    }

    const thumb = target.closest("[data-image-index]");
    if (thumb) {
        selectImage(Number(thumb.dataset.imageIndex || 0));
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
        if (isProductOpen()) closeProduct();
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
            closeProduct();
            return;
        }
    }

    if (!isProductOpen()) return;

    if (event.key === "ArrowLeft") {
        event.preventDefault();
        selectImage(currentImageIndex - 1);
    } else if (event.key === "ArrowRight") {
        event.preventDefault();
        selectImage(currentImageIndex + 1);
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
        closeProduct({ push: false });
    }
});

renderCart();

const initial = getProductFromLocation();
if (initial) {
    openProduct(initial.product, initial.imageId, { replace: true });
}
