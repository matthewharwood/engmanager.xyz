// Presentation routing is local. No response-bearing URL or release identifier
// is ever sent to a lookup service or turned into a module URL.
export function presentationForURL(href) {
  const url = new URL(href);
  const fragment = new URLSearchParams(url.hash.slice(1));
  return ['s', 'r', 'e'].some(key => url.searchParams.has(key) || fragment.has(key)) ? 'v1' : 'v4';
}

export async function bootPresentation(href, {document: doc, load} = {}) {
  const version = presentationForURL(href);
  const stylesheet = doc?.getElementById('personality-presentation-style');
  if (stylesheet) stylesheet.media = version === 'v4' ? 'all' : 'not all';
  if (doc?.body) doc.body.dataset.personalityPresentation = version;
  // Even malformed shared packets use the frozen decoder and its existing
  // fail-closed error view. Selecting a presentation never accepts a packet.
  if (load) await load(version);
  else if (version === 'v1') await import('../v1/app.mjs');
  else await import('./app.mjs');
  return version;
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  bootPresentation(window.location.href, {document}).catch(error => {
    const status = document.getElementById('save-status');
    if (status) status.textContent = 'Unable to open this release';
    const main = document.getElementById('personality-app');
    if (main) {
      const message = document.createElement('p');
      message.textContent = 'The assessment files could not be opened. Reconnect and reload; saved answers have not been changed.';
      main.replaceChildren(message);
    }
    console.error('Assessment presentation failed to load.', error);
  });
}
