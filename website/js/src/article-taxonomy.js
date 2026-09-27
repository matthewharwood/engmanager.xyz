// Two identical runs, measured after layout, keep the seam at exactly one run.
// The fixed category never joins the moving track.
(() => {
    if (window.__engTaxonomyInstalled) return;
    window.__engTaxonomyInstalled = true;
    let dispose = () => {};

    function mount() {
        dispose();
        const page = document.querySelector('[data-journey-current]') || document;
        const cleanups = [...page.querySelectorAll('.article-tags')].map(viewport => {
            const originals = [...viewport.children];
            if (!originals.length) return () => {};
            const lifetime = new AbortController();
            const signal = lifetime.signal;
            const motion = matchMedia('(prefers-reduced-motion: reduce)');
            const fillers = ['still writing', 'more to explore', 'work in progress'];
            let timer = 0;
            let disposed = false;
            const reset = () => {
                viewport.replaceChildren(...originals);
                delete viewport.dataset.marquee;
                viewport.style.removeProperty('--tag-loop-distance');
                viewport.style.removeProperty('--tag-loop-duration');
            };
            const build = () => {
                if (disposed || !viewport.isConnected) return;
                reset();
                if (motion.matches || viewport.clientWidth <= 0) return;
                const track = document.createElement('div');
                track.className = 'article-tag-track';
                const run = document.createElement('div');
                run.className = 'article-tag-run';
                run.append(...originals);
                track.append(run);
                viewport.replaceChildren(track);
                // Include the trailing inter-tag gap in the measured distance.
                for (let i = 0; run.getBoundingClientRect().width < viewport.clientWidth && i < 256; i++) {
                    const placeholder = document.createElement('span');
                    placeholder.className = 'article-tag article-tag-placeholder';
                    placeholder.textContent = fillers[i % fillers.length];
                    placeholder.setAttribute('aria-hidden', 'true');
                    run.append(placeholder);
                }
                const distance = run.getBoundingClientRect().width;
                if (!distance) { reset(); return; }
                const copy = run.cloneNode(true);
                copy.setAttribute('aria-hidden', 'true');
                track.append(copy);
                viewport.style.setProperty('--tag-loop-distance', `${distance}px`);
                viewport.style.setProperty('--tag-loop-duration', `${distance / 12}s`);
                viewport.dataset.marquee = 'ready';
            };
            const schedule = () => { clearTimeout(timer); timer = setTimeout(build, 120); };
            const toggle = () => {
                if (motion.matches) return;
                viewport.toggleAttribute('data-paused');
            };
            viewport.tabIndex = 0;
            viewport.setAttribute('role', 'group');
            viewport.setAttribute('aria-label', 'Tags. Focus or hover to pause. Tap or press Space to keep paused.');
            viewport.addEventListener('click', toggle, { signal });
            viewport.addEventListener('keydown', event => {
                if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); toggle(); }
            }, { signal });
            window.addEventListener('resize', schedule, { signal });
            window.addEventListener('engmanager:themechange', schedule, { signal });
            window.addEventListener('engmanager:fontchange', schedule, { signal });
            document.fonts?.addEventListener('loadingdone', schedule, { signal });
            motion.addEventListener('change', schedule, { signal });
            const observer = new ResizeObserver(schedule);
            observer.observe(viewport);
            build();
            document.fonts?.ready.then(() => { if (!disposed) schedule(); });
            return () => {
                disposed = true;
                clearTimeout(timer);
                lifetime.abort();
                observer.disconnect();
                reset();
                delete viewport.dataset.paused;
                viewport.removeAttribute('tabindex');
                viewport.removeAttribute('role');
                viewport.setAttribute('aria-label', 'Tags');
            };
        });
        dispose = () => cleanups.forEach(cleanup => cleanup());
    }
    mount();
    window.__engNav?.onBeforeSwap?.(() => dispose());
    window.__engNav?.onSwap?.(mount);
})();
