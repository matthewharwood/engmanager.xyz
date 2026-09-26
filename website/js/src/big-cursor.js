// Homepage/feed cursor controller. Blender models and GPU resources are loaded
// only after mouse input; native cursors remain until a frame is ready.
(() => {
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const mouse = matchMedia('(pointer: fine) and (hover: hover)');
    const contrast = matchMedia('(forced-colors: active)');
    const INTERACTIVE = 'a[href],button,summary,[role="button"],label,select';
    const NATIVE = 'input,textarea,[contenteditable]:not([contenteditable="false"]),iframe,[data-native-cursor]';
    let dispose = null;

    function eligible() {
        return document.body?.classList.contains('homepage') && navigator.gpu
            && mouse.matches && !motion.matches && !contrast.matches
            && !navigator.connection?.saveData;
    }

    function init() {
        if (dispose || !eligible() || !window.__engCursorRenderer) return;
        const config = document.querySelector('[data-journey-current] [data-cursor-models]')
            || document.querySelector('[data-cursor-models]');
        if (!config) return;

        const body = document.body;
        const abort = new AbortController();
        const cursor = document.createElement('div');
        cursor.className = 'big-cursor';
        cursor.dataset.cursorOverlay = '';
        cursor.dataset.mode = 'arrow';
        cursor.setAttribute('aria-hidden', 'true');
        // A manual popover keeps fixed coordinates above other top-layer UI,
        // without inheriting a modal's transforms or intercepting its clicks.
        if (typeof cursor.showPopover === 'function') cursor.setAttribute('popover', 'manual');
        const canvas = document.createElement('canvas');
        cursor.append(canvas);
        body.append(cursor);

        let renderer = null, loading = false, failed = false, disposed = false;
        let frame = 0, lastTime = 0, modeTimer = 0, loadTimer = 0;
        let x = -300, y = -300, inPage = false, native = false, down = false;
        let targetTiltX = 0, targetTiltY = 0, lastMove = 0;
        let tiltX = 0, tiltY = 0, velocityX = 0, velocityY = 0;
        let press = 0, pressVelocity = 0, grip = 0;
        const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

        function hide() {
            body.classList.remove('cursor-3d-active');
            cursor.dataset.visible = 'false';
            if (cursor.matches(':popover-open')) cursor.hidePopover();
            cancelAnimationFrame(frame);
            frame = 0;
            lastTime = 0;
        }

        function fail() {
            if (disposed || failed) return;
            failed = true;
            clearTimeout(loadTimer);
            abort.abort();
            hide();
            renderer?.dispose();
            renderer = null;
        }

        function wake() {
            if (!frame && renderer && inPage && !native && !document.hidden && !failed && !disposed) {
                frame = requestAnimationFrame(paint);
            }
        }

        function paint(time) {
            frame = 0;
            if (!renderer || disposed || failed || !inPage || native || document.hidden) return;
            const dt = Math.min((time - (lastTime || time - 16.67)) / 1000, 1 / 30);
            lastTime = time;
            // Damped springs affect orientation only. Translation is exact so
            // inertia never changes the actual click/drop point.
            const decay = Math.exp(-dt * 13);
            targetTiltX *= decay;
            targetTiltY *= decay;
            velocityX += ((targetTiltX - tiltX) * 240 - velocityX * 24) * dt;
            velocityY += ((targetTiltY - tiltY) * 240 - velocityY * 24) * dt;
            tiltX += velocityX * dt;
            tiltY += velocityY * dt;
            const pressed = down || cursor.dataset.mode === 'grab' ? 1 : 0;
            pressVelocity += ((pressed - press) * 340 - pressVelocity * 26) * dt;
            press += pressVelocity * dt;
            const gripping = cursor.dataset.mode === 'grab' ? 1 : 0;
            grip += (gripping - grip) * (1 - Math.exp(-dt * 18));
            const hotspot = renderer.hotspot;
            cursor.style.transform = `translate3d(${x - hotspot.x}px, ${y - hotspot.y}px, 0)`;
            try {
                if (renderer.render({ mode: cursor.dataset.mode, tiltX, tiltY, press, grip }) === false) {
                    fail();
                    return;
                }
                if (failed) return;
                if (cursor.hasAttribute('popover') && !cursor.matches(':popover-open')) cursor.showPopover();
                cursor.dataset.visible = 'true';
                body.classList.add('cursor-3d-active');
            } catch {
                fail();
                return;
            }
            // No permanent GPU loop: stop after movement/click/grip settles.
            const energy = Math.abs(tiltX) + Math.abs(tiltY) + Math.abs(velocityX)
                + Math.abs(velocityY) + Math.abs(pressVelocity) + Math.abs(pressed - press)
                + Math.abs(gripping - grip);
            if (energy > 0.001) wake();
            else lastTime = 0;
        }

        async function load() {
            if (loading || renderer || failed || disposed) return;
            loading = true;
            loadTimer = setTimeout(fail, 10000);
            try {
                const ready = await window.__engCursorRenderer.create(canvas, {
                    pointerUrl: config.dataset.pointerUrl,
                    handUrl: config.dataset.handUrl,
                    signal: abort.signal,
                    onFailure: fail,
                });
                if (disposed || failed) { ready.dispose(); return; }
                renderer = ready;
                clearTimeout(loadTimer);
                cursor.style.width = `${ready.size}px`;
                cursor.style.height = `${ready.size}px`;
                wake();
            } catch {
                fail();
            }
        }

        function overDvd() {
            const logo = document.querySelector('[data-journey-current] [data-dvd-bouncer]')
                || document.querySelector('[data-dvd-bouncer]');
            if (!logo || logo.hidden || logo.dataset.trashed === 'true') return false;
            const rect = logo.getBoundingClientRect();
            return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
        }

        function detectMode(target) {
            if (body.dataset.dragging === 'true') return 'grab';
            if (overDvd()) return 'open';
            const chip = target?.closest?.('.marquee .chip');
            if (chip && chip.dataset.trashed !== 'true') return 'open';
            if (target?.closest?.('.article-fluid-link.is-visited .article-check')) return 'open';
            if (target?.closest?.(INTERACTIVE) && !target.closest(':disabled,[aria-disabled="true"]')) return 'open';
            return 'arrow';
        }

        function setMode(mode) {
            if (mode === cursor.dataset.mode) {
                clearTimeout(modeTimer);
                modeTimer = 0;
                return;
            }
            if (cursor.dataset.mode === 'open' && mode === 'arrow') {
                if (!modeTimer) modeTimer = setTimeout(() => {
                    modeTimer = 0;
                    cursor.dataset.mode = 'arrow';
                    wake();
                }, 100);
                return;
            }
            clearTimeout(modeTimer);
            modeTimer = 0;
            cursor.dataset.mode = mode;
            wake();
        }

        function updateTarget(target) {
            native = !!target?.closest?.(NATIVE);
            if (native) hide();
            setMode(detectMode(target));
        }

        function onMove(event) {
            if (event.pointerType !== 'mouse') { inPage = false; hide(); return; }
            const now = performance.now();
            const elapsed = Math.max(now - lastMove, 8);
            if (inPage) {
                targetTiltY = clamp((event.clientX - x) / elapsed * 0.14, -0.18, 0.18);
                targetTiltX = clamp((event.clientY - y) / elapsed * 0.12, -0.15, 0.15);
            }
            x = event.clientX;
            y = event.clientY;
            lastMove = now;
            inPage = true;
            updateTarget(event.target);
            if (!native) { load(); wake(); }
        }

        function onDown(event) {
            if (event.pointerType !== 'mouse' || event.button !== 0) return;
            onMove(event);
            down = true;
            wake();
        }

        function onUp(event) {
            if (event.pointerType !== 'mouse') return;
            down = false;
            updateTarget(document.elementFromPoint(x, y));
            wake();
        }

        function leave() {
            inPage = false;
            down = false;
            targetTiltX = targetTiltY = tiltX = tiltY = velocityX = velocityY = 0;
            press = pressVelocity = 0;
            hide();
        }

        function onScroll() {
            if (!inPage) return;
            updateTarget(document.elementFromPoint(x, y));
            wake();
        }

        function onVisibility() {
            if (document.hidden) leave();
        }

        function onToggle(event) {
            if (event.target === cursor || event.newState !== 'open' || !renderer || !inPage || native) return;
            // Raise the cursor after a modal/popover enters the top layer.
            if (cursor.matches(':popover-open')) cursor.hidePopover();
            wake();
        }

        const listen = (target, name, handler, options = {}) => target.addEventListener(name, handler, { ...options, signal: abort.signal });
        listen(window, 'pointermove', onMove, { passive: true });
        listen(window, 'pointerdown', onDown, { capture: true, passive: true });
        listen(window, 'pointerup', onUp, { capture: true, passive: true });
        listen(window, 'pointercancel', leave, { capture: true });
        listen(window, 'blur', leave);
        listen(window, 'pagehide', leave);
        listen(window, 'scroll', onScroll, { capture: true, passive: true });
        listen(window, 'resize', onScroll, { passive: true });
        listen(document, 'pointerleave', leave);
        listen(document, 'visibilitychange', onVisibility);
        listen(document, 'toggle', onToggle, { capture: true });
        const observer = new MutationObserver(() => {
            updateTarget(document.elementFromPoint(x, y));
            wake();
        });
        observer.observe(body, { attributes: true, attributeFilter: ['data-dragging'] });

        dispose = () => {
            if (disposed) return;
            disposed = true;
            clearTimeout(modeTimer);
            clearTimeout(loadTimer);
            abort.abort();
            observer.disconnect();
            hide();
            renderer?.dispose();
            renderer = null;
            cursor.remove();
        };
    }

    function reset() {
        dispose?.();
        dispose = null;
    }
    for (const query of [motion, mouse, contrast]) query.addEventListener('change', () => { reset(); init(); });
    window.__engNav?.onBeforeSwap?.(reset);
    window.__engNav?.onSwap?.(init);
    init();
})();
