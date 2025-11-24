// JSON Editor Web Component
// JSON editing with real-time validation
// Using web-components-architecture and javascript-pragmatic-rules skills

// Using attribute-driven state pattern from web-components-architecture
class JsonEditor extends HTMLElement {
  #textarea = null;
  #validationTimeout = null;
  #validationDelay = 500; // Debounce validation

  // Principle 2: Attribute-Driven State from web-components-architecture
  static get observedAttributes() {
    return ['value', 'readonly'];
  }

  // Lifecycle callback from web-components-architecture
  connectedCallback() {
    // Using handleEvent pattern from web-components-architecture
    this.addEventListener('input', this);
    this.addEventListener('change', this);

    // Set ARIA attributes for accessibility
    this.setAttribute('role', 'group');
    this.setAttribute('aria-label', 'JSON editor');

    this.render();
  }

  // Rule 4 from javascript-pragmatic-rules: Clean up resources
  disconnectedCallback() {
    this.removeEventListener('input', this);
    this.removeEventListener('change', this);

    if (this.#validationTimeout) {
      clearTimeout(this.#validationTimeout);
      this.#validationTimeout = null;
    }
  }

  // Principle 2: React to attribute changes from web-components-architecture
  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;

    switch (name) {
      case 'value':
        this.#updateTextareaValue(newValue);
        break;
      case 'readonly':
        this.#updateReadonly(newValue !== null);
        break;
    }
  }

  // Principle 3: HandleEvent pattern from web-components-architecture
  handleEvent(e) {
    switch (e.type) {
      case 'input':
        this.#handleInput(e);
        break;
      case 'change':
        this.#handleChange(e);
        break;
    }
  }

  #handleInput(e) {
    // Principle 1: Zero DOM Selection - use direct reference from web-components-architecture
    if (e.target !== this.#textarea) return;

    // Rule 15 from javascript-pragmatic-rules: Debounce validation
    if (this.#validationTimeout) {
      clearTimeout(this.#validationTimeout);
    }

    this.#validationTimeout = setTimeout(() => {
      this.#validateJson();
      this.#validationTimeout = null;
    }, this.#validationDelay);
  }

  #handleChange(e) {
    if (e.target !== this.#textarea) return;

    // Force immediate validation on change
    if (this.#validationTimeout) {
      clearTimeout(this.#validationTimeout);
      this.#validationTimeout = null;
    }

    this.#validateJson();
  }

  #validateJson() {
    const value = this.#textarea.value;

    // Rule 1 from javascript-pragmatic-rules: Handle promise rejections
    try {
      const parsed = JSON.parse(value);

      // Valid JSON
      this.removeAttribute('error');
      this.setAttribute('valid', '');

      // Update internal value attribute
      this.setAttribute('value', value);

      // Principle 4: Events are the ONLY output from web-components-architecture
      this.dispatchEvent(new CustomEvent('json-valid', {
        bubbles: true,
        composed: true,
        detail: {
          value,
          parsed
        }
      }));

      // Update ARIA for accessibility
      this.#textarea.setAttribute('aria-invalid', 'false');
      if (this.#textarea.hasAttribute('aria-errormessage')) {
        this.#textarea.removeAttribute('aria-errormessage');
      }

    } catch (error) {
      // Invalid JSON
      this.removeAttribute('valid');
      this.setAttribute('error', error.message);

      // Principle 4: Events are the ONLY output from web-components-architecture
      this.dispatchEvent(new CustomEvent('json-invalid', {
        bubbles: true,
        composed: true,
        detail: {
          value,
          error: error.message
        }
      }));

      // Update ARIA for accessibility
      this.#textarea.setAttribute('aria-invalid', 'true');
      this.#textarea.setAttribute('aria-errormessage', 'json-error');
    }
  }

  #updateTextareaValue(newValue) {
    if (!this.#textarea) return;

    const currentValue = this.#textarea.value;
    if (currentValue !== newValue && newValue !== null) {
      this.#textarea.value = newValue;
      this.#validateJson();
    }
  }

  #updateReadonly(isReadonly) {
    if (!this.#textarea) return;

    if (isReadonly) {
      this.#textarea.setAttribute('readonly', '');
      this.#textarea.setAttribute('aria-readonly', 'true');
    } else {
      this.#textarea.removeAttribute('readonly');
      this.#textarea.removeAttribute('aria-readonly');
    }
  }

  // Public API: Get parsed JSON
  getParsedValue() {
    try {
      return JSON.parse(this.#textarea.value);
    } catch (error) {
      return null;
    }
  }

  // Public API: Set formatted JSON
  setFormattedValue(obj) {
    try {
      const formatted = JSON.stringify(obj, null, 2);
      this.setAttribute('value', formatted);
    } catch (error) {
      // Rule 1 from javascript-pragmatic-rules: Handle errors with context
      console.error('Failed to format JSON:', error);

      this.dispatchEvent(new CustomEvent('json-format-error', {
        bubbles: true,
        composed: true,
        detail: { error: error.message }
      }));
    }
  }

  render() {
    // Principle 1: Zero DOM Selection from web-components-architecture
    // Create elements directly without querySelector

    const container = document.createElement('div');
    container.className = 'json-editor-container';

    // Create textarea
    this.#textarea = document.createElement('textarea');
    this.#textarea.className = 'json-textarea';
    this.#textarea.setAttribute('spellcheck', 'false');
    this.#textarea.setAttribute('autocomplete', 'off');
    this.#textarea.setAttribute('autocorrect', 'off');
    this.#textarea.setAttribute('autocapitalize', 'off');
    this.#textarea.setAttribute('aria-label', 'JSON content');

    // Set initial value
    const initialValue = this.getAttribute('value') || '';
    this.#textarea.value = initialValue;

    // Set readonly state
    if (this.hasAttribute('readonly')) {
      this.#textarea.setAttribute('readonly', '');
      this.#textarea.setAttribute('aria-readonly', 'true');
    }

    container.appendChild(this.#textarea);

    // Error message container
    const errorDiv = document.createElement('div');
    errorDiv.id = 'json-error';
    errorDiv.className = 'json-error';
    errorDiv.setAttribute('role', 'alert');
    errorDiv.setAttribute('aria-live', 'assertive');
    container.appendChild(errorDiv);

    // Clear and replace content
    this.textContent = '';
    this.appendChild(container);

    // Initial validation
    if (initialValue) {
      this.#validateJson();
    }
  }
}

// Register the custom element
customElements.define('json-editor', JsonEditor);

export { JsonEditor };
