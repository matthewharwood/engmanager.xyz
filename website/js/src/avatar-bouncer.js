// Explicit build-time CSS bindings; no runtime class registry.
var cssSelector = value => value, cssToken = value => value;

(() => {
    'use strict';
    if (window.__engAvatarBouncer) { window.__engAvatarBouncer.mount(); return; }
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const poses = new WeakMap();
    let current;
    function mount() {
        const node = document.querySelector('[data-avatar-bouncer]');
        if (current?.node === node) return;
        current?.dispose(); current = null;
        if (node && !document.prerendering) current = create(node);
    }
    function create(node) {
        const bio = document.getElementById('bio'), holds = new Set(), cleanups = [];
        const bounds = node.getBoundingClientRect();
        let saved = poses.get(node);
        if (!saved) {
            try {
                const stored = JSON.parse(localStorage.getItem('engmanager.avatar-position') || 'null');
                if (Number.isFinite(stored?.x) && Number.isFinite(stored?.y)) saved = stored;
            } catch {}
        }
        const pose = { x: saved?.x ?? (motion.matches ? bounds.left : window.innerWidth * .72),
            y: saved?.y ?? (motion.matches ? bounds.top : window.innerHeight * .3),
            vx: saved?.vx ?? 38, vy: saved?.vy ?? 27 };
        let width = bounds.width, height = bounds.height, viewportWidth = window.innerWidth, viewportHeight = window.innerHeight;
        let frame = 0, last = 0, stopped = false, intersecting = true;
        let exposed = document.body.classList.contains(cssToken('journey-revealing'));
        let floating = saved?.floating ?? (Boolean(saved) || !motion.matches);
        const listen = (target, type, callback) => {
            if (!target) return;
            target.addEventListener(type, callback);
            cleanups.push(() => target.removeEventListener(type, callback));
        };
        const limits = () => ({ x: Math.max(0, Math.floor(viewportWidth - width)), y: Math.max(0, Math.floor(viewportHeight - height)) });
        function paint() {
            const max = limits();
            pose.x = Math.max(0, Math.min(max.x, pose.x)); pose.y = Math.max(0, Math.min(max.y, pose.y));
            if (!floating) return;
            node.setAttribute('data-avatar-floating', '');
            node.style.transform = `translate3d(${Math.round(pose.x)}px, ${Math.round(pose.y)}px, 0)`;
        }
        function active() {
            const max = limits();
            return !stopped && !motion.matches && !document.hidden && node.isConnected && intersecting
                && !exposed && !window.__engNav?.busy && !holds.size && (max.x > 0 || max.y > 0);
        }
        function sync() {
            cancelAnimationFrame(frame); frame = 0; last = 0;
            const moving = active(); node.toggleAttribute('data-avatar-moving', moving);
            if (moving) frame = requestAnimationFrame(tick);
        }
        function hold(reason, value) { value ? holds.add(reason) : holds.delete(reason); sync(); }
        function tick(now) {
            frame = 0;
            if (!active()) { node.removeAttribute('data-avatar-moving'); return; }
            const dt = last ? Math.min(.05, (now - last) / 1000) : 0; last = now;
            const max = limits();
            pose.x += pose.vx * dt; pose.y += pose.vy * dt;
            if (max.x && (pose.x <= 0 || pose.x >= max.x)) pose.vx *= -1;
            if (max.y && (pose.y <= 0 || pose.y >= max.y)) pose.vy *= -1;
            paint(); frame = requestAnimationFrame(tick);
        }
        function resize() {
            viewportWidth = window.innerWidth; viewportHeight = window.innerHeight; paint(); sync();
        }
        function preference() {
            if (!floating && !motion.matches) floating = true;
            paint(); sync();
        }
        listen(node, 'pointerenter', () => hold('hover', true));
        listen(node, 'pointerleave', () => hold('hover', false));
        listen(node, 'focus', () => hold('focus', node.matches(':focus-visible')));
        listen(node, 'blur', () => hold('focus', false));
        listen(bio, 'beforetoggle', event => hold('bio', event.newState === 'open'));
        if (bio?.matches(':popover-open')) holds.add('bio');
        if (node.matches(':hover')) holds.add('hover');
        if (node.matches(':focus-visible')) holds.add('focus');
        const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(entries => {
            if (stopped) return;
            const entry = entries[0], box = entry.borderBoxSize?.[0];
            width = box?.inlineSize ?? entry.contentRect.width; height = box?.blockSize ?? entry.contentRect.height;
            paint(); sync();
        });
        resizeObserver?.observe(node);
        const visibilityObserver = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => {
            if (stopped) return;
            intersecting = entries.some(entry => entry.isIntersecting); sync();
        });
        visibilityObserver?.observe(node);
        for (const property of ['left', 'right', 'top', 'bottom']) node.style.removeProperty(property);
        paint(); sync();
        return { node, sync, resize, preference, hold,
            expose(value) { exposed = value; sync(); },
            place(x, y) {
                if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
                floating = true; pose.x = x; pose.y = y; paint(); sync();
                return { x: pose.x, y: pose.y };
            },
            dispose() {
                stopped = true; cancelAnimationFrame(frame); frame = 0;
                poses.set(node, { ...pose, floating }); node.removeAttribute('data-avatar-moving');
                resizeObserver?.disconnect(); visibilityObserver?.disconnect(); cleanups.forEach(cleanup => cleanup());
            },
        };
    }
    window.__engAvatarBouncer = {
        mount,
        hold(node, value) { if (current?.node === node) current.hold('drag', value); },
        place(node, x, y) { return current?.node === node ? current.place(x, y) : false; },
    };
    window.addEventListener('resize', () => current?.resize());
    document.addEventListener('visibilitychange', () => current?.sync());
    motion.addEventListener('change', () => current?.preference());
    window.addEventListener('eng:journeyexposure', event => current?.expose(event.detail?.active === true));
    window.addEventListener('eng:journeysettled', () => current?.sync());
    window.addEventListener('pagehide', () => { current?.dispose(); current = null; });
    window.addEventListener('pageshow', event => { if (event.persisted) mount(); });
    document.addEventListener('prerenderingchange', mount, { once: true });
    window.__engNav?.onBeforeSwap?.(() => { current?.dispose(); current = null; });
    window.__engNav?.onSwap?.(mount);
    mount();
})();
