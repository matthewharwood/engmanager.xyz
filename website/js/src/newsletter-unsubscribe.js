// A newsletter link opens an inert page; the visible page makes the change
// with POST. Native form submission remains the fallback when JS is absent.
(() => {
    const form = document.querySelector('[data-unsubscribe-form]');
    const main = document.querySelector('[data-unsubscribe-state]');
    const heading = document.querySelector('[data-unsubscribe-heading]');
    const message = document.querySelector('[data-unsubscribe-message]');
    const mark = document.querySelector('[data-unsubscribe-mark]');
    const button = document.querySelector('[data-unsubscribe-submit]');
    if (!form || !main || !heading || !message || !button) return;
    if (typeof fetch !== 'function' || typeof FormData !== 'function'
        || typeof URLSearchParams !== 'function' || typeof AbortController !== 'function') return;

    let inFlight = false;
    let finished = false;

    async function unsubscribe() {
        if (inFlight || finished) return;
        inFlight = true;
        button.disabled = true;
        button.textContent = 'Unsubscribing…';
        main.dataset.unsubscribeState = 'processing';
        main.setAttribute('aria-busy', 'true');
        message.setAttribute('role', 'status');
        heading.textContent = 'Unsubscribing…';
        message.textContent = 'Please wait a moment while your newsletter preference is updated.';
        const body = new URLSearchParams(new FormData(form));
        // Keep the token in the form only for a possible explicit retry. It
        // must not stay in browser history or appear in a copied page URL.
        try { history.replaceState(null, '', '/unsubscribe'); } catch {}
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        try {
            const response = await fetch('/api/newsletter/unsubscribe', {
                method: 'POST',
                headers: { Accept: 'application/json' },
                body,
                credentials: 'omit',
                mode: 'same-origin',
                redirect: 'error',
                cache: 'no-store',
                referrerPolicy: 'no-referrer',
                signal: controller.signal,
            });
            const result = await response.json();
            if (response.status === 400) {
                finished = true;
                main.dataset.unsubscribeState = 'invalid';
                heading.textContent = 'This link isn’t valid.';
                message.textContent = 'Open the unsubscribe link in a newsletter email. If you need help, contact Matthew below.';
                form.remove();
                return;
            }
            if (!response.ok || result.status !== 'unsubscribed') throw new Error('Unsubscribe not confirmed');
            finished = true;
            main.dataset.unsubscribeState = 'success';
            document.title = 'Unsubscribed · ENGMANAGER.XYZ';
            heading.textContent = 'You’re unsubscribed.';
            message.textContent = 'Your ENGMANAGER newsletter subscription is turned off. You can close this page.';
            if (mark) mark.textContent = '✓';
            form.remove();
        } catch {
            main.dataset.unsubscribeState = 'error';
            message.setAttribute('role', 'alert');
            heading.textContent = 'We couldn’t confirm the change.';
            message.textContent = 'Please try again, or contact Matthew below for help.';
            button.disabled = false;
            button.textContent = 'Try unsubscribing again';
        } finally {
            clearTimeout(timeout);
            inFlight = false;
            main.removeAttribute('aria-busy');
        }
    }

    form.addEventListener('submit', event => {
        event.preventDefault();
        unsubscribe();
    });
    // Speculative loading must never change a subscriber's preference.
    if (document.prerendering) {
        document.addEventListener('prerenderingchange', unsubscribe, { once: true });
    } else {
        unsubscribe();
    }
})();
