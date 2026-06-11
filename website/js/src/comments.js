// Inline comments for article pages: select text inside the article to
// open a floating comment form; existing comments render as cards in
// the side panel with <mark> highlights over their quoted ranges.
//
// Lifecycle (JS_ROUTER_CONSTRAINTS §2.13 — correctness-critical):
// everything is closed over PER ARTICLE inside init(), including the
// slug, the body-appended popover form, the document listeners and the
// comments-list fetch. A soft navigation MUST dispose() before
// re-init or the popover would keep posting comments to the PREVIOUS
// article's slug. dispose() removes the popover node, unbinds the
// document listeners and aborts an in-flight list fetch.
//
// Prerender gate (JS_ROUTER_CONSTRAINTS §3): the list fetch fires one
// GET per page at script eval — deferred to prerenderingchange so up
// to 3 speculatively prerendered articles don't each hit the API.

(() => {
    let dispose = null;

    function init(root) {
        if (dispose) return;

        const article = root.querySelector("[data-commentable-article]");
        const panel = root.querySelector("[data-comments-panel]");
        if (!article || !panel) return;

        const slug = article.dataset.articleSlug;
        const list = panel.querySelector("[data-comments-list]");
        const comments = new Map();
        let activeSelection = null;

        const popover = document.createElement("form");
        popover.className = "inline-comment-popover";
        popover.hidden = true;
        popover.setAttribute("aria-label", "Leave an inline comment");

        const nameLabel = document.createElement("label");
        const nameText = document.createElement("span");
        nameText.textContent = "Name";
        const nameInput = document.createElement("input");
        nameInput.type = "text";
        nameInput.name = "author_name";
        nameInput.maxLength = 80;
        nameInput.autocomplete = "name";
        nameLabel.append(nameText, nameInput);

        const bodyLabel = document.createElement("label");
        const bodyText = document.createElement("span");
        bodyText.textContent = "Comment";
        const bodyInput = document.createElement("textarea");
        bodyInput.name = "body";
        bodyInput.maxLength = 2000;
        bodyInput.rows = 4;
        bodyLabel.append(bodyText, bodyInput);

        const sliderLabel = document.createElement("label");
        sliderLabel.className = "comment-slider-label";
        const sliderText = document.createElement("span");
        sliderText.textContent = "Slide to publish";
        const slider = document.createElement("input");
        slider.type = "range";
        slider.min = "0";
        slider.max = "100";
        slider.value = "0";
        slider.className = "comment-slider";
        sliderLabel.append(sliderText, slider);

        const status = document.createElement("p");
        status.className = "inline-comment-status";
        status.setAttribute("role", "status");

        popover.append(nameLabel, bodyLabel, sliderLabel, status);
        document.body.append(popover);

        const closePopover = () => {
            popover.hidden = true;
            slider.value = "0";
            status.textContent = "";
            activeSelection = null;
        };

        const selectionInsideArticle = () => {
            const selection = window.getSelection();
            if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;
            const range = selection.getRangeAt(0);
            if (
                !article.contains(range.commonAncestorContainer) &&
                !article.contains(range.startContainer)
            ) {
                return null;
            }
            const quote = selection.toString().trim();
            if (quote.length < 2) return null;

            const preStart = document.createRange();
            preStart.selectNodeContents(article);
            preStart.setEnd(range.startContainer, range.startOffset);

            const preEnd = document.createRange();
            preEnd.selectNodeContents(article);
            preEnd.setEnd(range.endContainer, range.endOffset);

            const start = preStart.toString().length;
            const end = preEnd.toString().length;
            const text = article.textContent || "";
            return {
                quote,
                start,
                end,
                prefix: text.slice(Math.max(0, start - 120), start),
                suffix: text.slice(end, end + 120),
                rect: range.getBoundingClientRect(),
            };
        };

        const openPopover = () => {
            const selected = selectionInsideArticle();
            if (!selected) return;
            activeSelection = selected;
            const left = Math.min(
                window.innerWidth - 320,
                Math.max(16, selected.rect.left + selected.rect.width / 2 - 160),
            );
            const top = Math.min(
                window.innerHeight - 280,
                Math.max(16, selected.rect.bottom + 12),
            );
            popover.style.left = `${left}px`;
            popover.style.top = `${top}px`;
            popover.hidden = false;
            status.textContent = "";
            slider.value = "0";
            bodyInput.focus();
        };

        const renderComment = (comment) => {
            if (!list || comments.has(comment.comment_id)) return;
            comments.set(comment.comment_id, comment);

            const card = document.createElement("article");
            card.className = "comment-card";
            card.id = `comment-${comment.comment_id}`;

            const header = document.createElement("header");
            const author = document.createElement("strong");
            author.textContent = comment.author_name;
            header.append(author);

            const quote = document.createElement("blockquote");
            quote.textContent = comment.quote_exact;

            const body = document.createElement("p");
            body.textContent = comment.body;

            card.append(header, quote, body);
            list.append(card);
            applyHighlight(comment);
        };

        const applyHighlight = (comment) => {
            const start = Number(comment.start_char);
            const end = Number(comment.end_char);
            if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) return;

            const segments = [];
            const walker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT);

            let position = 0;
            while (walker.nextNode()) {
                const node = walker.currentNode;
                const length = node.nodeValue.length;
                const nodeStart = position;
                const nodeEnd = position + length;
                const parent = node.parentElement;
                const canWrap =
                    parent &&
                    !parent.closest("pre, code, button, input, textarea, mark") &&
                    node.nodeValue.trim();
                if (canWrap && nodeEnd > start && nodeStart < end) {
                    segments.push({
                        node,
                        start: Math.max(0, start - nodeStart),
                        end: Math.min(length, end - nodeStart),
                    });
                }
                position = nodeEnd;
            }

            segments.reverse().forEach((segment) => {
                if (segment.start >= segment.end) return;
                const range = document.createRange();
                range.setStart(segment.node, segment.start);
                range.setEnd(segment.node, segment.end);
                const mark = document.createElement("mark");
                mark.className = "comment-highlight";
                mark.dataset.commentId = comment.comment_id;
                mark.tabIndex = 0;
                mark.addEventListener("click", () => focusComment(comment.comment_id));
                mark.addEventListener("keydown", (event) => {
                    if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        focusComment(comment.comment_id);
                    }
                });
                try {
                    range.surroundContents(mark);
                } catch {
                    mark.textContent = range.toString();
                    range.deleteContents();
                    range.insertNode(mark);
                }
            });
        };

        const focusComment = (id) => {
            const card = document.getElementById(`comment-${id}`);
            if (!card) return;
            card.classList.add("is-active");
            card.scrollIntoView({ block: "center", behavior: "smooth" });
            setTimeout(() => card.classList.remove("is-active"), 1600);
        };

        const submitComment = async () => {
            if (!activeSelection) return;
            const body = bodyInput.value.trim();
            if (!body) {
                status.textContent = "Write a comment first.";
                slider.value = "0";
                bodyInput.focus();
                return;
            }

            slider.disabled = true;
            status.textContent = "Publishing...";
            try {
                const response = await fetch(`/api/articles/${encodeURIComponent(slug)}/comments`, {
                    method: "POST",
                    headers: {
                        Accept: "application/json",
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        author_name: nameInput.value,
                        body,
                        quote_exact: activeSelection.quote,
                        quote_prefix: activeSelection.prefix,
                        quote_suffix: activeSelection.suffix,
                        start_char: activeSelection.start,
                        end_char: activeSelection.end,
                        human_check: true,
                    }),
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || "Comment failed");
                renderComment(data);
                nameInput.value = "";
                bodyInput.value = "";
                window.getSelection()?.removeAllRanges();
                closePopover();
            } catch (error) {
                status.textContent = error.message;
                slider.value = "0";
            } finally {
                slider.disabled = false;
            }
        };

        slider.addEventListener("input", () => {
            if (Number(slider.value) >= 98) submitComment();
        });

        popover.addEventListener("submit", (event) => {
            event.preventDefault();
        });

        const onPointerUp = () => {
            setTimeout(openPopover, 0);
        };
        const onKeyUp = (event) => {
            if (event.key === "Escape") {
                closePopover();
            } else {
                setTimeout(openPopover, 0);
            }
        };
        const onPointerDown = (event) => {
            if (!popover.hidden && !popover.contains(event.target)) {
                const selection = window.getSelection();
                if (!selection || selection.isCollapsed) closePopover();
            }
        };
        document.addEventListener("pointerup", onPointerUp);
        document.addEventListener("keyup", onKeyUp);
        document.addEventListener("pointerdown", onPointerDown);

        const controller = new AbortController();
        fetch(`/api/articles/${encodeURIComponent(slug)}/comments`, {
            headers: { Accept: "application/json" },
            signal: controller.signal,
        })
            .then((response) => (response.ok ? response.json() : []))
            .then((records) => records.forEach(renderComment))
            .catch(() => {});

        dispose = () => {
            controller.abort();
            document.removeEventListener("pointerup", onPointerUp);
            document.removeEventListener("keyup", onKeyUp);
            document.removeEventListener("pointerdown", onPointerDown);
            popover.remove();
        };
    }

    function start() {
        init(document);
        window.__engNav?.onSwap?.((root) => {
            if (dispose) {
                dispose();
                dispose = null;
            }
            init(root);
        });
    }

    if (document.prerendering) {
        document.addEventListener("prerenderingchange", start, { once: true });
    } else {
        start();
    }
})();
