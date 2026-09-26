// Diagrams are content; rendering belongs to the same mount lifecycle as the
// article's other enhancements. Retained pages keep their original sources.
(() => {
    const MERMAID_URL = "https://cdn.jsdelivr.net/npm/mermaid@11.16.0/dist/mermaid.esm.min.mjs";
    const sources = new WeakMap();
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
        const color = (name, fallback) => {
            if (!context) return fallback;
            try {
                context.clearRect(0, 0, 1, 1);
                context.fillStyle = fallback;
                context.fillStyle = styles.getPropertyValue(name).trim() || fallback;
                context.fillRect(0, 0, 1, 1);
                const rgba = context.getImageData(0, 0, 1, 1).data;
                return `#${Array.from(rgba).slice(0, 3).map((value) => value.toString(16).padStart(2, "0")).join("")}`;
            } catch { return fallback; }
        };
        const accent = color("--accent", "#e64553");
        const text = color("--ctp-text", "#cdd6f4");
        const base = color("--ctp-base", "#1e1e2e");
        const surface = color("--ctp-surface0", "#313244");
        const mantle = color("--ctp-mantle", "#181825");
        const line = color("--ctp-overlay1", "#7f849c");
        return {
            background: base,
            primaryColor: surface, primaryTextColor: text, primaryBorderColor: accent,
            secondaryColor: mantle, secondaryTextColor: text, secondaryBorderColor: line,
            tertiaryColor: mantle, tertiaryTextColor: text, tertiaryBorderColor: line,
            lineColor: line, textColor: text, nodeBorder: accent, clusterBkg: mantle,
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
        let disposed = false;
        let revision = 0;
        const compact = matchMedia("(max-width: 42rem)");
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

        const showFallback = () => {
            if (disposed) return;
            nodes.forEach((node) => {
                if (node.querySelector("svg")) return;
                node.textContent = sources.get(node);
                node.style.visibility = "visible";
            });
        };
        const fallbackTimer = setTimeout(showFallback, 4000);

        async function render(version) {
            if (disposed || version !== revision) return;
            try {
                const { default: mermaid } = await loadMermaid();
                await document.fonts?.ready;
                if (disposed || version !== revision) return;
                mermaid.initialize({
                    startOnLoad: false,
                    securityLevel: "strict",
                    theme: "base",
                    flowchart: { curve: "basis", useMaxWidth: true },
                    themeVariables: themeVariables(),
                });
                for (const node of nodes) {
                    if (disposed || version !== revision || !node.isConnected) return;
                    // Supply a page-owned rendering container: an in-flight
                    // render can never append runtime nodes to a later page.
                    const scratch = document.createElement("div");
                    scratch.setAttribute("aria-hidden", "true");
                    scratch.style.cssText = `position:absolute;left:-100000px;visibility:hidden;width:${node.getBoundingClientRect().width}px`;
                    node.parentElement.append(scratch);
                    scratchNodes.add(scratch);
                    try {
                        const source = sources.get(node).replace(/^\s*(flowchart|graph)\s+LR\b/m, (match, kind) => compact.matches ? `${kind} TD` : match);
                        const { svg } = await mermaid.render(`article-diagram-${++diagramId}`, source, scratch);
                        if (disposed || version !== revision || !node.isConnected) return;
                        node.innerHTML = svg;
                        node.dataset.processed = "true";
                        node.style.visibility = "";
                        let expand = node.parentElement.querySelector(".diagram-expand");
                        if (!expand) {
                            expand = document.createElement("button");
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
                        if (viewer.open && selectedNode === node) {
                            canvas.replaceChildren(node.querySelector("svg").cloneNode(true));
                        }
                    } catch {
                        if (!disposed && version === revision && !node.querySelector("svg")) {
                            node.textContent = sources.get(node);
                            node.style.visibility = "visible";
                        }
                    } finally {
                        scratch.remove();
                        scratchNodes.delete(scratch);
                    }
                }
            } catch {
                showFallback();
            }
        }

        const schedule = () => {
            const version = ++revision;
            // Mermaid's shared configuration must not overlap another render,
            // including one started on the page we just left.
            renderQueue = renderQueue.then(() => render(version), () => render(version));
        };
        window.addEventListener("engmanager:themechange", schedule, { signal: lifetime.signal });
        matchMedia("(prefers-color-scheme: dark)").addEventListener("change", schedule, { signal: lifetime.signal });
        compact.addEventListener("change", schedule, { signal: lifetime.signal });
        active = { surface, dispose() {
            disposed = true;
            lifetime.abort();
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
