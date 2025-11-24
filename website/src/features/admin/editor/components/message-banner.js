// Message Banner Web Component
// Displays success/error messages with auto-dismiss functionality
// Using web-components-architecture and javascript-pragmatic-rules skills

// Using attribute-driven state pattern from web-components-architecture
class MessageBanner extends HTMLElement {
  #timeoutId = null;
  #defaultDuration = 5_000;

  // Principle 2: Attribute-Driven State from web-components-architecture
  static get observedAttributes() {
    return ['message', 'type', 'duration', 'show'];
  }

  // Lifecycle callback from web-components-architecture
  connectedCallback() {
    // Using handleEvent pattern from web-components-architecture
    this.addEventListener('click', this);

    // Set initial ARIA attributes for accessibility
    this.setAttribute('role', 'status');
    this.setAttribute('aria-live', 'polite');
    this.setAttribute('aria-atomic', 'true');

    this.render();
  }

  // Rule 4 from javascript-pragmatic-rules: Clean up resources
  disconnectedCallback() {
    this.removeEventListener('click', this);
    if (this.#timeoutId) {
      clearTimeout(this.#timeoutId);
      this.#timeoutId = null;
    }
  }

  // Principle 2: React to attribute changes from web-components-architecture
  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;

    switch (name) {
      case 'message':
      case 'type':
        this.render();
        break;
      case 'show':
        if (newValue !== null) {
          this.show();
        } else {
          this.hide();
        }
        break;
      case 'duration':
        // Duration changed, restart timer if showing
        if (this.hasAttribute('show')) {
          this.#startAutoDismiss();
        }
        break;
    }
  }

  // Principle 3: HandleEvent pattern from web-components-architecture
  handleEvent(e) {
    switch (e.type) {
      case 'click':
        this.#handleClick(e);
        break;
    }
  }

  #handleClick(e) {
    // Dismiss on click
    if (e.target.closest('[data-dismiss]')) {
      this.dismiss();
    }
  }

  // Public API: Show message
  showMessage(text, type = 'info') {
    this.setAttribute('message', text);
    this.setAttribute('type', type);
    this.setAttribute('show', '');
  }

  // Public API: Dismiss message
  dismiss() {
    this.removeAttribute('show');

    // Principle 4: Events are the ONLY output from web-components-architecture
    this.dispatchEvent(new CustomEvent('message-dismissed', {
      bubbles: true,
      composed: true,
      detail: { message: this.getAttribute('message') }
    }));
  }

  show() {
    this.classList.add('show');
    this.#startAutoDismiss();
  }

  hide() {
    this.classList.remove('show');
    // Rule 4 from javascript-pragmatic-rules: Clean up resources
    if (this.#timeoutId) {
      clearTimeout(this.#timeoutId);
      this.#timeoutId = null;
    }
  }

  #startAutoDismiss() {
    // Rule 4 from javascript-pragmatic-rules: Clean up previous timeout
    if (this.#timeoutId) {
      clearTimeout(this.#timeoutId);
      this.#timeoutId = null;
    }

    const duration = parseInt(this.getAttribute('duration'), 10) || this.#defaultDuration;

    // Rule 4 from javascript-pragmatic-rules: Register cleanup
    this.#timeoutId = setTimeout(() => {
      this.dismiss();
      this.#timeoutId = null;
    }, duration);
  }

  render() {
    const message = this.getAttribute('message') || '';
    const type = this.getAttribute('type') || 'info';

    if (!message) {
      this.textContent = '';
      return;
    }

    // Principle 1: Zero DOM Selection from web-components-architecture
    // Create elements directly without querySelector
    const container = document.createElement('div');
    container.className = `message-content ${type}`;

    const icon = document.createElement('span');
    icon.className = 'message-icon';
    icon.textContent = this.#getIcon(type);
    icon.setAttribute('aria-hidden', 'true');

    const textNode = document.createElement('span');
    textNode.className = 'message-text';
    textNode.textContent = message;

    const dismissBtn = document.createElement('button');
    dismissBtn.className = 'message-dismiss';
    dismissBtn.setAttribute('data-dismiss', '');
    dismissBtn.setAttribute('type', 'button');
    dismissBtn.setAttribute('aria-label', 'Dismiss message');
    dismissBtn.textContent = '×';

    container.appendChild(icon);
    container.appendChild(textNode);
    container.appendChild(dismissBtn);

    // Clear and replace content
    this.textContent = '';
    this.appendChild(container);
  }

  #getIcon(type) {
    const icons = {
      success: '✓',
      error: '✗',
      warning: '⚠',
      info: 'ℹ'
    };
    return icons[type] || icons.info;
  }
}

// Register the custom element
customElements.define('message-banner', MessageBanner);

export { MessageBanner };
