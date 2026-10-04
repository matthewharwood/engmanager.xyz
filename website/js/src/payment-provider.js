// Loading a payment provider is a checkout action, not a storefront mount.
(() => {
    if (window.__engPayments) return;
    let loading;
    function loadStripe() {
        if (typeof window.Stripe === 'function') return Promise.resolve();
        if (loading) return loading;
        const script = document.createElement('script');
        script.src = 'https://js.stripe.com/v3';
        script.async = true;
        const attempt = new Promise((resolve, reject) => {
            const timer = setTimeout(() => finish(new Error('Payment provider timed out')), 15000);
            function finish(error) {
                clearTimeout(timer);
                script.onload = script.onerror = null;
                if (error) { script.remove(); reject(error); }
                else resolve();
            }
            script.onload = () => finish(typeof window.Stripe === 'function'
                ? null : new Error('Payment provider did not initialize'));
            script.onerror = () => finish(new Error('Payment provider could not load'));
            document.head.append(script);
        });
        loading = attempt;
        attempt.catch(() => { if (loading === attempt) loading = null; });
        return attempt;
    }
    window.__engPayments = { loadStripe };
})();
