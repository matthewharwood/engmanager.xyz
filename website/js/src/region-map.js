const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION =
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const METERS_PER_MILE = 1609.344;
const THEME_EVENT = "engmanager:themechange";
const THEME_COLOR_VARS = [
    "--color-primary",
    "--color-secondary",
    "--color-accent",
    "--color-success",
    "--color-warning",
];
const instances = new Set();
let themeRefreshQueued = false;

function onReady(callback) {
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", callback, { once: true });
        return;
    }
    callback();
}

function readConfig(root) {
    const configNode = root.querySelector("[data-region-map-config]");
    if (!configNode) {
        return null;
    }

    try {
        return JSON.parse(configNode.textContent || "{}");
    } catch (_error) {
        return null;
    }
}

function setStatus(root, message) {
    const status = root.querySelector("[data-region-map-status]");
    if (status) {
        status.textContent = message;
    }
}

function cssVar(styles, name, fallback) {
    const value = styles.getPropertyValue(name).trim();
    return value || fallback;
}

function readThemePalette(root) {
    const styles = getComputedStyle(document.documentElement);
    return {
        accent: cssVar(styles, "--accent", "#e64553"),
        base: cssVar(styles, "--ctp-base", "#eff1f5"),
        crust: cssVar(styles, "--ctp-crust", "#11111b"),
        overlay: cssVar(styles, "--ctp-overlay1", "#8c8fa1"),
        surface: cssVar(styles, "--ctp-surface1", "#ccd0da"),
        text: cssVar(styles, "--ctp-text", "#11111b"),
        pinFills: THEME_COLOR_VARS.map((name) => cssVar(styles, name, ""))
            .filter(Boolean),
        theme: document.documentElement.getAttribute("data-theme") || "auto",
        tileFilter: getComputedStyle(root)
            .getPropertyValue("--region-map-tile-filter")
            .trim(),
    };
}

function pinCoords(pin) {
    if (!pin || !Array.isArray(pin.coords) || pin.coords.length !== 2) {
        return null;
    }

    const lat = Number(pin.coords[0]);
    const lng = Number(pin.coords[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return null;
    }
    return [lat, lng];
}

function radiusMeters(pin) {
    if (Number.isFinite(Number(pin.radiusMeters))) {
        return Number(pin.radiusMeters);
    }
    if (Number.isFinite(Number(pin.radiusMiles))) {
        return Number(pin.radiusMiles) * METERS_PER_MILE;
    }
    return 0;
}

function popupFor(pin) {
    const wrapper = document.createElement("div");
    wrapper.className = "region-map-popup";

    const name = document.createElement("strong");
    name.textContent = pin.name || "Operator";

    const role = document.createElement("span");
    role.textContent = pin.role || "";

    const city = document.createElement("span");
    city.textContent = pin.city || "";

    wrapper.append(name, role, city);
    return wrapper;
}

function pinFill(palette, index) {
    if (!palette.pinFills.length) {
        return palette.accent;
    }
    return palette.pinFills[index % palette.pinFills.length];
}

function markerStyle(palette, index) {
    return {
        color: palette.crust,
        fillColor: pinFill(palette, index),
        fillOpacity: 0.95,
        radius: 8,
        weight: 3,
    };
}

function radiusStyle(palette, index) {
    return {
        color: pinFill(palette, index),
        fillColor: pinFill(palette, index),
        fillOpacity: 0.08,
        weight: 1.5,
    };
}

function applyMapTheme(instance) {
    const palette = readThemePalette(instance.root);
    instance.root.dataset.regionMapTheme = palette.theme;
    instance.map.getContainer().style.backgroundColor = palette.base;

    instance.markers.forEach(({ layer, index }) => {
        layer.setStyle(markerStyle(palette, index));
    });
    instance.radii.forEach(({ layer, index }) => {
        layer.setStyle(radiusStyle(palette, index));
    });

    instance.root.regionMap.colors = palette;
    instance.map.invalidateSize({ pan: false });
}

function refreshAllMapThemes() {
    themeRefreshQueued = false;
    instances.forEach(applyMapTheme);
}

function scheduleMapThemeRefresh() {
    if (themeRefreshQueued) {
        return;
    }
    themeRefreshQueued = true;
    requestAnimationFrame(refreshAllMapThemes);
}

function initRegionMap(root) {
    const canvas = root.querySelector("[data-region-map-canvas]");
    const config = readConfig(root);
    if (!canvas || !config) {
        setStatus(root, "Map configuration unavailable");
        return;
    }

    if (!window.L) {
        setStatus(root, "Map library unavailable");
        return;
    }

    const palette = readThemePalette(root);
    const pins = Array.isArray(config.pins) ? config.pins : [];
    const validPins = pins
        .map((pin) => ({ pin, coords: pinCoords(pin) }))
        .filter((entry) => entry.coords);

    const map = window.L.map(canvas, {
        attributionControl: true,
        keyboard: true,
        maxZoom: Number(config.maxZoom) || 12,
        minZoom: Number(config.minZoom) || 3,
        preferCanvas: true,
        scrollWheelZoom: false,
        touchZoom: true,
        zoomControl: true,
    });

    map.createPane("regionRadiusPane");
    map.getPane("regionRadiusPane").style.zIndex = 350;
    map.getPane("regionRadiusPane").style.pointerEvents = "none";

    const tileLayer = window.L.tileLayer(TILE_URL, {
        attribution: TILE_ATTRIBUTION,
        maxZoom: 19,
    });

    let loaded = false;
    const markLoaded = () => {
        if (loaded) {
            return;
        }
        loaded = true;
        root.classList.add("is-loaded");
        setStatus(root, "Interactive map loaded");
        map.invalidateSize({ pan: false });
    };

    tileLayer.on("tileload", markLoaded);
    tileLayer.on("load", markLoaded);
    tileLayer.on("tileerror", () => {
        if (!loaded) {
            setStatus(root, "Map tiles failed to load");
        }
    });
    tileLayer.addTo(map);

    const radiusLayer = window.L.layerGroup().addTo(map);
    const markerLayer = window.L.layerGroup().addTo(map);
    const markers = [];
    const radii = [];

    validPins.forEach(({ pin, coords }, index) => {
        const radius = radiusMeters(pin);
        if (radius > 0) {
            const radiusCircle = window.L.circle(coords, {
                className: "region-map-radius",
                interactive: false,
                pane: "regionRadiusPane",
                radius,
                ...radiusStyle(palette, index),
            }).addTo(radiusLayer);
            radii.push({ index, layer: radiusCircle });
        }

        const marker = window.L.circleMarker(coords, {
            className: "region-map-marker",
            ...markerStyle(palette, index),
        })
            .bindPopup(popupFor(pin))
            .addTo(markerLayer);
        markers.push({ index, layer: marker });
    });

    if (validPins.length > 0) {
        const bounds = window.L.latLngBounds(validPins.map((entry) => entry.coords));
        map.fitBounds(bounds, {
            maxZoom: Number(config.zoom) || 4,
            padding: [42, 42],
        });
    } else {
        map.setView(config.center || [39.8283, -98.5795], Number(config.zoom) || 4);
    }

    map.on("click", () => map.scrollWheelZoom.enable());
    map.on("mouseout", () => map.scrollWheelZoom.disable());

    if ("ResizeObserver" in window) {
        const observer = new ResizeObserver(() => map.invalidateSize({ pan: false }));
        observer.observe(root);
    }

    setTimeout(() => {
        if (!loaded) {
            setStatus(root, "Map tiles are still loading");
        }
    }, 4000);

    const instance = {
        map,
        markerLayer,
        markers,
        radii,
        radiusLayer,
        root,
        tileLayer,
    };

    // Expose the layer groups for later heat-map or blast-radius controls.
    root.regionMap = {
        colors: palette,
        map,
        markerLayer,
        radiusLayer,
        refreshTheme: () => applyMapTheme(instance),
        tileLayer,
    };
    instances.add(instance);
    applyMapTheme(instance);
}

onReady(() => {
    document.querySelectorAll("[data-region-map]").forEach(initRegionMap);
});

window.addEventListener(THEME_EVENT, scheduleMapThemeRefresh);

if ("MutationObserver" in window) {
    const observer = new MutationObserver((records) => {
        if (records.some((record) => record.attributeName === "data-theme")) {
            scheduleMapThemeRefresh();
        }
    });
    observer.observe(document.documentElement, {
        attributeFilter: ["data-theme"],
        attributes: true,
    });
}

const colorScheme = window.matchMedia?.("(prefers-color-scheme: dark)");
if (colorScheme) {
    if (colorScheme.addEventListener) {
        colorScheme.addEventListener("change", scheduleMapThemeRefresh);
    } else {
        colorScheme.addListener?.(scheduleMapThemeRefresh);
    }
}
