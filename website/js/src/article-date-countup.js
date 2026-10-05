// Build-time CSS bindings. Identity forms keep direct-source tests readable;
// build.rs replaces calls with literals and Oxc removes unused helpers.
var cssClasses = value => value, cssSelector = value => value, cssToken = value => value, cssHtml = value => value;

// A short trip from Matthew's birthday to each article's published date.
// One shared RAF, no timers/imports/promises; each mount owns its observer,
// listeners and rolling animations, and releases them even when interrupted.
(() => {
    const SELECTOR = 'time.article-meta-date[datetime]';
    const DAY_MS = 86400000;
    const BIRTHDAY = Date.UTC(1985, 8, 3) / DAY_MS; // September 3, 1985.
    const DURATION_MS = 3000;
    const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let dispose = null;

    function format(day) {
        const date = new Date(day * DAY_MS);
        return `${MONTHS[date.getUTCMonth()]} ${String(date.getUTCDate()).padStart(2, '0')}, ${date.getUTCFullYear()}`;
    }
    function unmount() {
        dispose?.();
        dispose = null;
    }
    function mount(root = document) {
        unmount();
        if (document.hidden || document.prerendering) {
            // A background/prerendered document owns no date nodes, observer,
            // animation or RAF. Only an abortable activation listener waits.
            const activation = new AbortController();
            dispose = () => activation.abort();
            const resume = () => {
                if (document.hidden || document.prerendering) return;
                activation.abort();
                mount();
            };
            document.addEventListener('visibilitychange', resume, { signal: activation.signal });
            document.addEventListener('prerenderingchange', resume, { once: true, signal: activation.signal });
            return;
        }
        const nodes = [...root.querySelectorAll(SELECTOR)].filter(node =>
            node.dataset.dateCountup !== 'done' && !node.closest(cssSelector('[inert], [hidden], [aria-hidden="true"]')));
        if (!nodes.length) return;
        const lifetime = new AbortController(), { signal } = lifetime;
        const records = new Map();
        let observer = null, raf = 0, disposed = false;
        function finish(record) {
            record.animation?.cancel();
            record.animation = null;
            record.node.textContent = record.original;
            record.node.dataset.dateCountup = 'done';
            record.node.style.removeProperty('--date-countup-sweep');
            observer?.unobserve(record.node);
            records.delete(record.node);
            // Completed/detached dates are never kept by the document hooks.
            if (!records.size) cleanup();
        }
        function cleanup() {
            if (disposed) return;
            disposed = true;
            cancelAnimationFrame(raf); raf = 0;
            observer?.disconnect(); observer = null;
            lifetime.abort();
            for (const record of [...records.values()]) finish(record);
            records.clear();
            if (dispose === cleanup) dispose = null;
        }
        dispose = cleanup;
        function tick(now) {
            raf = 0;
            if (disposed) return;
            if (document.hidden || reduced.matches) { cleanup(); return; }
            let running = false;
            for (const record of [...records.values()]) {
                if (!record.node.isConnected) { finish(record); continue; }
                if (record.started === null) continue;
                const elapsed = now - record.started;
                if (elapsed >= DURATION_MS) { finish(record); continue; }
                running = true;
                // Hold the birthday briefly, then race through years and
                // ease into days. UTC day arithmetic never invents a date.
                const progress = Math.max(0, (elapsed - 160) / (DURATION_MS - 160));
                const eased = 1 - Math.pow(1 - progress, 3);
                const day = Math.floor(BIRTHDAY + (record.target - BIRTHDAY) * eased);
                if (day !== record.day && elapsed - record.updated >= 80) {
                    record.day = day; record.updated = elapsed;
                    record.label.textContent = format(day);
                    record.animation?.cancel();
                    record.animation = record.label.animate?.([
                        { transform: 'translateY(45%)', opacity: 0.35, filter: 'blur(0.7px)' },
                        { transform: 'translateY(0)', opacity: 1, filter: 'blur(0)' },
                    ], { duration: Math.min(80, DURATION_MS - elapsed), easing: 'cubic-bezier(.16,1,.3,1)' }) || null;
                }
                record.node.style.setProperty('--date-countup-sweep', `${(elapsed / DURATION_MS * 260 - 130).toFixed(2)}%`);
            }
            if (running && !disposed) raf = requestAnimationFrame(tick);
        }
        function start(record) {
            if (disposed || record.started !== null || document.hidden || document.prerendering) return;
            record.started = performance.now();
            record.label.textContent = format(BIRTHDAY);
            record.node.dataset.dateCountup = 'running';
            if (!raf) raf = requestAnimationFrame(tick);
        }
        function visible(node) {
            const rect = node.getBoundingClientRect();
            return rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth;
        }

        for (const node of nodes) {
            const iso = node.getAttribute('datetime');
            const milliseconds = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? Date.parse(`${iso}T00:00:00Z`) : NaN;
            const target = milliseconds / DAY_MS;
            if (!Number.isFinite(target) || new Date(milliseconds).toISOString().slice(0, 10) !== iso || target <= BIRTHDAY || reduced.matches) {
                node.dataset.dateCountup = 'done';
                continue;
            }
            const original = node.textContent;
            const accessible = document.createElement('span');
            accessible.className = cssClasses('article-date-countup-accessible sr-only');
            accessible.textContent = original;
            const label = document.createElement('span');
            label.className = cssClasses('article-date-countup-label');
            label.setAttribute('aria-hidden', 'true');
            label.textContent = original;
            node.replaceChildren(accessible, label);
            node.dataset.dateCountup = 'pending';
            records.set(node, { node, original, label, target, started: null, updated: 0, day: BIRTHDAY, animation: null });
        }
        if (!records.size) { cleanup(); return; }
        if ('IntersectionObserver' in window) {
            observer = new IntersectionObserver(entries => {
                if (disposed) return;
                for (const entry of entries) {
                    const record = records.get(entry.target);
                    if (!record) continue;
                    if (entry.isIntersecting) start(record);
                    else if (record.started !== null) finish(record);
                }
            }, { threshold: 0.25 });
            for (const node of records.keys()) observer.observe(node);
        } else {
            // Without observation, animate the visible tags and settle the
            // others instead of attaching polling or scroll listeners.
            for (const record of [...records.values()]) {
                if (visible(record.node)) start(record); else finish(record);
            }
        }
        document.addEventListener('visibilitychange', () => { if (document.hidden) cleanup(); }, { signal });
        reduced.addEventListener('change', () => { if (reduced.matches) cleanup(); }, { signal });
    }

    mount();
    // These document-lifetime hooks capture only mount/unmount, never a date
    // node. Per-mount listeners above are aborted on completion or disposal.
    window.addEventListener('pagehide', unmount);
    window.addEventListener('pageshow', event => { if (event.persisted) mount(); });
    // The router keeps the incoming page inert until its entrance ends,
    // after onSwap. Start then, without ever enhancing an inert preview.
    window.addEventListener('eng:journeysettled', () => mount());
    window.__engNav?.onBeforeSwap?.(unmount);
    window.__engNav?.onSwap?.(mount);
})();
