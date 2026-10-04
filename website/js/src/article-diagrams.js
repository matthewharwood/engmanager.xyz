// Diagrams are content; rendering belongs to the same mount lifecycle as the
// article's other enhancements. Retained pages keep their original sources.
(() => {
    const MERMAID_URL = "https://cdn.jsdelivr.net/npm/mermaid@11.16.0/dist/mermaid.esm.min.mjs";
    const sources = new WeakMap();
    const renderedKeys = new WeakMap();
    let active = null;
    let modulePromise = null;
    let renderQueue = Promise.resolve();
    let diagramId = 0;

    const loadMermaid = () => (modulePromise ||= import(MERMAID_URL).catch((error) => {
        modulePromise = null;
        throw error;
    }));

    function themeVariables() {
        const styles = getComputedStyle(document.documentElement);
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 1;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        // Mermaid's color parser does not understand our OKLCH theme tokens.
        // A browser-painted pixel normalizes every supported CSS color to sRGB.
        const color = (name, fallback, backdrop = "#ffffff") => {
            if (!context) return fallback;
            try {
                context.clearRect(0, 0, 1, 1);
                // Hex cannot carry our translucent surface/line tokens. Paint
                // them over the page first rather than discarding their alpha.
                context.fillStyle = backdrop;
                context.fillRect(0, 0, 1, 1);
                context.fillStyle = fallback;
                context.fillStyle = styles.getPropertyValue(name).trim() || fallback;
                context.fillRect(0, 0, 1, 1);
                const rgba = context.getImageData(0, 0, 1, 1).data;
                return `#${Array.from(rgba).slice(0, 3).map((value) => value.toString(16).padStart(2, "0")).join("")}`;
            } catch { return fallback; }
        };
        const base = color("--ctp-base", "#1e1e2e");
        const accent = color("--accent", "#e64553", base);
        const text = color("--ctp-text", "#cdd6f4", base);
        const surface = color("--ctp-surface0", "#313244", base);
        const mantle = color("--ctp-mantle", "#181825", base);
        const line = color("--ctp-subtext0", "#a6adc8", base);
        return {
            background: base,
            primaryColor: surface, primaryTextColor: text, primaryBorderColor: accent,
            secondaryColor: mantle, secondaryTextColor: text, secondaryBorderColor: line,
            tertiaryColor: mantle, tertiaryTextColor: text, tertiaryBorderColor: line,
            lineColor: line, defaultLinkColor: line, textColor: text,
            nodeTextColor: text, nodeBorder: accent, mainBkg: surface,
            clusterBkg: mantle, clusterBorder: line, titleColor: text,
            edgeLabelBackground: base,
            noteBkgColor: mantle, noteTextColor: text, noteBorderColor: line,
            actorBkg: surface, actorTextColor: text, actorBorder: accent,
            signalColor: line, signalTextColor: text,
            labelBoxBkgColor: surface, labelTextColor: text, loopTextColor: text,
            fontFamily: styles.getPropertyValue("--font-mono").trim() || "ui-monospace, monospace",
            fontSize: "14px",
        };
    }

    function unmount() {
        active?.dispose();
        active = null;
    }

    function mount() {
        const nodes = [...document.querySelectorAll(".article .mermaid")];
        const surface = nodes[0]?.closest("[data-eng-page]") || nodes[0]?.closest(".article");
        if (active?.surface === surface) return;
        unmount();
        if (!surface || !nodes.length) return;
        const lifetime = new AbortController();
        const scratchNodes = new Set();
        const pending = new Set(nodes), visible = new Set(), prepared = new Map();
        let disposed = false;
        let revision = 0;
        let idle = 0, retry = 0, rendering = false, observer;
        let activityAt = performance.now(), touching = false;
        const compact = matchMedia("(max-width: 42rem)");
        const dark = matchMedia("(prefers-color-scheme: dark)");
        const appearanceKey = () => [document.documentElement.getAttribute("data-theme") || "", dark.matches, compact.matches,
            getComputedStyle(document.documentElement).getPropertyValue("--font-mono")].join("|");
        const viewer = document.createElement("dialog");
        viewer.className = "diagram-viewer";
        viewer.setAttribute("aria-label", "Expanded diagram");
        viewer.innerHTML = `<div class="diagram-viewer-bar"><span>Diagram</span><div class="diagram-zoom" aria-label="Diagram zoom"><button type="button" data-zoom="out" aria-label="Zoom out">−</button><output>100%</output><button type="button" data-zoom="in" aria-label="Zoom in">+</button></div><button type="button" class="diagram-close" aria-label="Close diagram">✕</button></div><div class="diagram-viewport"><div class="diagram-canvas"></div></div>`;
        document.body.append(viewer);
        const viewport = viewer.querySelector(".diagram-viewport");
        const canvas = viewer.querySelector(".diagram-canvas");
        const zoomLevels = [1, 1.5, 2, 3, 4];
        let zoomIndex = 0;
        let opener = null;
        let selectedNode = null;
        function setZoom(index) {
            const center = (viewport.scrollLeft + viewport.clientWidth / 2) / zoomLevels[zoomIndex];
            zoomIndex = Math.max(0, Math.min(index, zoomLevels.length - 1));
            canvas.style.setProperty("--diagram-zoom", zoomLevels[zoomIndex]);
            viewport.scrollLeft = center * zoomLevels[zoomIndex] - viewport.clientWidth / 2;
            viewer.querySelector("output").textContent = `${Math.round(zoomLevels[zoomIndex] * 100)}%`;
            viewer.querySelector('[data-zoom="out"]').disabled = zoomIndex === 0;
            viewer.querySelector('[data-zoom="in"]').disabled = zoomIndex === zoomLevels.length - 1;
        }
        viewer.querySelector(".diagram-zoom").addEventListener("click", (event) => {
            const direction = event.target.closest("button")?.dataset.zoom;
            if (direction) setZoom(zoomIndex + (direction === "in" ? 1 : -1));
        });
        viewer.querySelector(".diagram-close").addEventListener("click", () => viewer.close());
        viewer.addEventListener("close", () => {
            canvas.replaceChildren();
            selectedNode = null;
            opener?.focus();
            opener = null;
        });
        nodes.forEach((node) => {
            if (!sources.has(node)) sources.set(node, node.textContent);
        });

        function bindExpand(node) {
            if (!node.querySelector("svg") || node.parentElement.querySelector(".diagram-expand")) return;
            const expand = document.createElement("button");
            expand.type = "button";
            expand.className = "diagram-expand";
            expand.textContent = "Expand diagram ↗";
            node.after(expand);
            expand.addEventListener("click", () => {
                const diagram = node.querySelector("svg");
                if (!diagram) return;
                opener = expand;
                selectedNode = node;
                canvas.replaceChildren(diagram.cloneNode(true));
                zoomIndex = 0;
                canvas.style.removeProperty("--diagram-zoom");
                viewport.scrollTo(0, 0);
                viewer.showModal();
                setZoom(0);
            }, { signal: lifetime.signal });
        }
        nodes.forEach((node) => {
            bindExpand(node);
            if (node.querySelector("svg") && renderedKeys.get(node) === appearanceKey()) pending.delete(node);
        });

        const showFallback = () => {
            if (disposed) return;
            nodes.forEach((node) => {
                if (node.querySelector("svg")) return;
                node.textContent = sources.get(node);
                node.style.visibility = "visible";
            });
        };
        const fallbackTimer = setTimeout(showFallback, 4000);

        function intersects(node) {
            if (observer) return visible.has(node);
            // Older browsers still enhance visible diagrams, without measuring
            // their layout in every scroll handler.
            const bounds = node.getBoundingClientRect();
            return bounds.bottom > 0 && bounds.top < innerHeight && bounds.right > 0 && bounds.left < innerWidth;
        }
        const suspended = () => document.hidden || touching || window.__engNav?.busy
            || document.body.classList.contains("journey-revealing");
        const eligible = (node, version) => !disposed && version === revision && node.isConnected
            && intersects(node) && !suspended() && performance.now() - activityAt >= 180;

        function commit(node, svg, version) {
            if (!eligible(node, version)) return;
            node.innerHTML = svg;
            node.dataset.processed = "true";
            node.style.visibility = "";
            renderedKeys.set(node, appearanceKey());
            pending.delete(node); prepared.delete(node);
            bindExpand(node);
            if (viewer.open && selectedNode === node) canvas.replaceChildren(node.querySelector("svg").cloneNode(true));
        }

        function waitFor(promise) {
            if (disposed) return Promise.resolve();
            return new Promise((resolve, reject) => {
                const finish = (error, value) => {
                    lifetime.signal.removeEventListener("abort", abort);
                    error ? reject(error) : resolve(value);
                };
                const abort = () => finish();
                lifetime.signal.addEventListener("abort", abort, { once: true });
                Promise.resolve(promise).then((value) => finish(null, value), (error) => finish(error));
            });
        }

        async function render(node, version) {
            if (!eligible(node, version)) return;
            try {
                if (prepared.has(node)) { commit(node, prepared.get(node), version); return; }
                const module = await waitFor(loadMermaid());
                if (disposed || version !== revision) return;
                const typography = window.__engTypography;
                await waitFor(typography ? Promise.all([typography.ready, typography.displayReady]) : document.fonts?.ready);
                // An import/font download may finish during a later gesture
                // or handoff. Do not let its continuation start graph layout.
                if (!eligible(node, version)) return;
                const { default: mermaid } = module;
                const variables = themeVariables();
                mermaid.initialize({
                    startOnLoad: false,
                    securityLevel: "strict",
                    theme: "base",
                    // Plain authored labels use SVG text. Mermaid 11.16's
                    // HTML wrapping uses exact fractional-width equality and
                    // can clip long labels during transformed section reveals.
                    htmlLabels: false,
                    fontFamily: variables.fontFamily,
                    flowchart: { curve: "basis", useMaxWidth: true, htmlLabels: false },
                    themeVariables: variables,
                });
                if (eligible(node, version)) {
                    // Supply a page-owned rendering container: an in-flight
                    // render can never append runtime nodes to a later page.
                    const scratch = document.createElement("div");
                    scratch.setAttribute("aria-hidden", "true");
                    scratch.style.cssText = `position:absolute;left:-100000px;visibility:hidden;width:${node.getBoundingClientRect().width}px`;
                    scratch.style.fontFamily = variables.fontFamily;
                    scratch.style.fontSize = variables.fontSize;
                    node.parentElement.append(scratch);
                    scratchNodes.add(scratch);
                    try {
                        const source = sources.get(node).replace(/^\s*(flowchart|graph)\s+LR\b/m, (match, kind) => compact.matches ? `${kind} TD` : match);
                        const { svg } = await mermaid.render(`article-diagram-${++diagramId}`, source, scratch);
                        if (disposed || version !== revision || !node.isConnected) return;
                        // A completed graph can wait for the next quiet turn
                        // without repeating its expensive layout after input.
                        prepared.set(node, svg);
                        commit(node, svg, version);
                    } catch {
                        if (!disposed && version === revision && !node.querySelector("svg")) {
                            node.textContent = sources.get(node);
                            node.style.visibility = "visible";
                        }
                        if (!disposed && version === revision) pending.delete(node);
                    } finally {
                        scratch.remove();
                        scratchNodes.delete(scratch);
                    }
                }
            } catch {
                showFallback();
                if (!disposed && version === revision) pending.delete(node);
            }
        }

        function cancelScheduled() {
            if (idle) cancelIdleCallback(idle);
            idle = 0; clearTimeout(retry); retry = 0;
        }
        function work(deadline) {
            idle = retry = 0;
            if (disposed) return;
            const node = [...pending].find((node) => node.isConnected && intersects(node));
            if (!node) return;
            const quiet = 180 - (performance.now() - activityAt);
            if (suspended() || quiet > 0 || (deadline && deadline.timeRemaining() < 10)) {
                retry = setTimeout(() => { retry = 0; schedule(); }, Math.max(120, quiet));
                return;
            }
            rendering = true;
            const version = revision;
            // Mermaid's configuration and scratch layout remain serialized
            // across pages, but each idle turn handles only one visible figure.
            renderQueue = renderQueue.then(() => render(node, version), () => render(node, version))
                .finally(() => { rendering = false; schedule(); });
        }
        function schedule() {
            if (disposed || rendering || idle || retry || !pending.size) return;
            if (observer && ![...pending].some((node) => visible.has(node))) return;
            if (window.requestIdleCallback) idle = requestIdleCallback(work);
            else retry = setTimeout(() => work(null), 32);
        }
        const activity = () => { activityAt = performance.now(); schedule(); };
        window.addEventListener("scroll", activity, { passive: true, signal: lifetime.signal });
        window.addEventListener("wheel", activity, { passive: true, signal: lifetime.signal });
        window.addEventListener("touchstart", (event) => { touching = event.touches.length > 0; activity(); }, { passive: true, signal: lifetime.signal });
        window.addEventListener("touchmove", activity, { passive: true, signal: lifetime.signal });
        const touchEnd = (event) => { touching = event.touches.length > 0; activity(); };
        window.addEventListener("touchend", touchEnd, { passive: true, signal: lifetime.signal });
        window.addEventListener("touchcancel", touchEnd, { passive: true, signal: lifetime.signal });
        window.addEventListener("keydown", (event) => {
            if (["PageDown", "PageUp", "Home", "End", "ArrowDown", "ArrowUp", " "].includes(event.key)) activity();
        }, { signal: lifetime.signal });
        window.addEventListener("eng:journeyexposure", (event) => {
            if (event.detail?.active) cancelScheduled(); else schedule();
        }, { signal: lifetime.signal });
        window.addEventListener("eng:journeysettled", schedule, { signal: lifetime.signal });
        document.addEventListener("visibilitychange", () => {
            if (document.hidden) cancelScheduled(); else activity();
        }, { signal: lifetime.signal });
        if (typeof IntersectionObserver !== "undefined") {
            observer = new IntersectionObserver((entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) visible.add(entry.target); else visible.delete(entry.target);
                }
                schedule();
            });
            nodes.forEach((node) => observer.observe(node));
        }
        const invalidate = () => {
            revision++; prepared.clear();
            nodes.forEach((node) => pending.add(node));
            schedule();
        };
        window.addEventListener("engmanager:themechange", invalidate, { signal: lifetime.signal });
        window.addEventListener("engmanager:fontchange", () => {
            const key = appearanceKey();
            if (nodes.some((node) => node.querySelector("svg") && renderedKeys.get(node) !== key)) invalidate();
        }, { signal: lifetime.signal });
        dark.addEventListener("change", invalidate, { signal: lifetime.signal });
        compact.addEventListener("change", invalidate, { signal: lifetime.signal });
        active = { surface, dispose() {
            disposed = true;
            lifetime.abort();
            cancelScheduled(); observer?.disconnect();
            pending.clear(); visible.clear(); prepared.clear();
            clearTimeout(fallbackTimer);
            viewer.remove();
            nodes.forEach((node) => node.parentElement?.querySelector(".diagram-expand")?.remove());
            scratchNodes.forEach((node) => node.remove());
            scratchNodes.clear();
        } };
        schedule();
    }

    mount();
    window.__engNav?.onBeforeSwap?.(unmount);
    window.__engNav?.onSwap?.(mount);
})();
