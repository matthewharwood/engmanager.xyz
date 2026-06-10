// Injects a small "Copy" button into every <pre> code block on article pages,
// then wires it up to copy the code to the clipboard via the Clipboard API.
//
// Independent of Prism — runs whenever, copies plain textContent.
//
// Button DOM (matches CSS rules for .code-copy in styles.css):
//   <button class="code-copy" type="button" aria-label="Copy code">
//     <svg class="code-copy-icon" .../>
//     <span>Copy</span>
//   </button>

const ICON_SVG = `
<svg class="code-copy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
     stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
</svg>`.trim();

function makeButton() {
    const button = document.createElement("button");
    button.className = "code-copy";
    button.type = "button";
    button.setAttribute("aria-label", "Copy code");
    button.innerHTML = `${ICON_SVG}<span>Copy</span>`;
    return button;
}

async function copyCode(button, codeEl) {
    const text = codeEl.innerText || codeEl.textContent || "";
    try {
        await navigator.clipboard.writeText(text);
    } catch (_err) {
        // Fall back to the legacy execCommand path for older browsers.
        const range = document.createRange();
        range.selectNodeContents(codeEl);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        try {
            document.execCommand("copy");
        } catch (_err2) {
            return;
        } finally {
            sel.removeAllRanges();
        }
    }
    const label = button.querySelector("span");
    const original = label?.textContent;
    if (label) label.textContent = "Copied";
    button.classList.add("is-copied");
    setTimeout(() => {
        if (label && original) label.textContent = original;
        button.classList.remove("is-copied");
    }, 1500);
}

// Set on the first soft navigation, never at load: Prism's autoloader pass
// already highlights the document on a real page load, so the load-time
// install() below must not re-highlight (double work, flicker). Swapped-in
// article content arrives unhighlighted — only then do we ask Prism again.
let softNavigated = false;

function install() {
    const pres = document.querySelectorAll(".article pre");
    pres.forEach((pre) => {
        if (pre.querySelector(".code-copy")) return;
        const code = pre.querySelector("code");
        if (!code) return;
        const button = makeButton();
        button.addEventListener("click", () => copyCode(button, code));
        pre.appendChild(button);
    });
    // Swap-time only (see softNavigated). Guarded so pages without Prism
    // (or with the CDN blocked) are unaffected; highlightAllUnder routes
    // new languages through the autoloader exactly like the load pass.
    if (softNavigated && window.Prism && Prism.highlightAllUnder) {
        Prism.highlightAllUnder(document);
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install, { once: true });
} else {
    install();
}

// Soft navigation: install() is already idempotent (skips <pre>s that
// have a .code-copy) — re-run it, and re-highlight the swapped-in code
// (JS_ROUTER_CONSTRAINTS §2.10).
window.__engNav?.onSwap?.(() => {
    softNavigated = true;
    install();
});
