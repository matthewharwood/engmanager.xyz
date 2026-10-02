// The outgoing page ends in torn paper. Small independent springs let that
// edge lag behind a scroll, then fall back to its original cut. No canvas,
// layout reads during animation, or animation work outside the reveal.
(() => {
    const nav = window.__engNav;
    if (!nav || window.__engCurtain) return;
    const NS = 'http://www.w3.org/2000/svg';
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    let curtain = null, frame = 0, lastFrame = 0, lastScroll = scrollY;
    let scrollAt = performance.now(), speed = 0, visible = false;
    let observer = null;

    function random(i) {
        const value = Math.sin(i * 127.1 + 31.7) * 43758.5453;
        return value - Math.floor(value);
    }

    // Adjacent shallow cuts and occasional longer tears, rather than a
    // repeating sawtooth. Endpoints stay on the page boundaries.
    function points() {
        return Array.from({ length: 81 }, (_, i) => ({
            x: i * 15,
            rest: 22 + random(i) * 24 + (i % 11 === 6 ? 23 : 0),
            y: 0, velocity: 0,
            weight: .7 + random(i + 150) * .8,
        }));
    }

    function paint() {
        if (!curtain) return;
        const nodes = curtain.nodes;
        const edge = nodes.map((p) => `${p.x.toFixed(1)},${(p.rest + p.y).toFixed(2)}`).join(' L');
        curtain.fill.setAttribute('d', `M0,-2 H1200 V${(nodes.at(-1).rest + nodes.at(-1).y).toFixed(2)} L${[...nodes].reverse().map((p) => `${p.x.toFixed(1)},${(p.rest + p.y).toFixed(2)}`).join(' L')} Z`);
        curtain.edge.setAttribute('d', `M${edge}`);
        // A few short exposed fibers make the edge read as torn material.
        curtain.fibers.setAttribute('d', nodes.filter((_, i) => i % 7 === 3).map((p) => `M${p.x},${(p.rest + p.y - 2).toFixed(2)} l2,4 l-1,3`).join(' '));
    }

    function cancel() {
        cancelAnimationFrame(frame);
        frame = 0; lastFrame = 0; speed = 0;
        if (curtain) {
            for (const node of curtain.nodes) { node.y = 0; node.velocity = 0; }
            delete curtain.svg.dataset.moving;
            paint();
        }
    }

    function run(now) {
        frame = 0;
        if (!curtain || !visible || motion.matches || document.hidden) { cancel(); return; }
        const dt = Math.min((now - (lastFrame || now - 16)) / 1000, .032);
        lastFrame = now;
        // Scroll velocity is a brief force; gravity/spring tension remains
        // after input stops, so the rag settles even without more scrolls.
        const force = now - scrollAt < 90 ? Math.max(-18, Math.min(18, -speed * .012)) : 0;
        let energy = 0;
        for (const node of curtain.nodes) {
            const step = dt / 4;
            for (let i = 0; i < 4; i++) {
                node.velocity += ((force * node.weight - node.y) * 85 - node.velocity * 16) * step;
                node.y += node.velocity * step;
            }
            node.y = Math.max(-19, Math.min(24, node.y));
            energy = Math.max(energy, Math.abs(node.y), Math.abs(node.velocity) * .05);
        }
        paint();
        if (force || energy > .035) {
            curtain.svg.dataset.moving = 'true';
            frame = requestAnimationFrame(run);
        } else cancel();
    }

    function wake() {
        if (!frame && visible && !motion.matches && !document.hidden) frame = requestAnimationFrame(run);
    }

    function inspectVisibility() {
        if (!curtain) return;
        const rect = curtain.svg.getBoundingClientRect();
        const next = rect.bottom >= -100 && rect.top <= innerHeight + 100;
        if (!next && visible) cancel();
        visible = next;
    }

    function dispose() {
        cancel(); observer?.disconnect(); observer = null;
        curtain?.svg.remove(); curtain = null; visible = false;
        lastScroll = scrollY; scrollAt = performance.now();
    }

    function mount() {
        dispose();
        const page = document.querySelector('[data-journey-current][data-eng-next]');
        if (!page) return;
        // Previous-page snapshots must never carry a live duplicate curtain.
        page.querySelectorAll('[data-journey-curtain]').forEach((node) => node.remove());
        const svg = document.createElementNS(NS, 'svg');
        svg.classList.add('journey-curtain'); svg.dataset.journeyCurtain = '';
        svg.setAttribute('viewBox', '0 0 1200 100');
        svg.setAttribute('preserveAspectRatio', 'none');
        svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
        const fill = document.createElementNS(NS, 'path'); fill.classList.add('journey-curtain-paper');
        const edge = document.createElementNS(NS, 'path'); edge.classList.add('journey-curtain-edge');
        const fibers = document.createElementNS(NS, 'path'); fibers.classList.add('journey-curtain-fibers');
        svg.append(fill, edge, fibers); page.append(svg);
        curtain = { svg, fill, edge, fibers, nodes: points() };
        paint(); inspectVisibility();
        if ('IntersectionObserver' in window) {
            observer = new IntersectionObserver((entries) => {
                visible = entries.some((entry) => entry.isIntersecting);
                if (!visible) cancel();
            }, { rootMargin: '100px 0px' });
            observer.observe(svg);
        }
    }

    window.addEventListener('scroll', () => {
        const now = performance.now(), delta = scrollY - lastScroll;
        const elapsed = Math.max(16, now - scrollAt);
        lastScroll = scrollY; scrollAt = now;
        speed = Math.max(-2200, Math.min(2200, delta * 1000 / elapsed));
        // One bounding-box read per scroll; the spring loop writes SVG only.
        inspectVisibility();
        if (Math.abs(delta) > .2) wake();
    }, { passive: true });
    window.addEventListener('resize', () => { inspectVisibility(); });
    motion.addEventListener('change', cancel);
    document.addEventListener('visibilitychange', cancel);
    window.addEventListener('pagehide', dispose);
    window.addEventListener('pageshow', mount);
    nav.onBeforeSwap(dispose);
    nav.onSwap(mount);
    window.__engCurtain = { ready: true };
    mount();
})();
