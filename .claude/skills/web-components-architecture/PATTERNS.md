# Common Patterns & Solutions

## State Management Patterns

### Pattern: Attribute as Single Source of Truth

```javascript
class StatefulComponent extends HTMLElement {
  static get observedAttributes() {
    return ['value', 'mode', 'status'];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;

    // Attribute changes trigger updates
    switch(name) {
      case 'value':
        this.handleValueChange(newValue);
        break;
      case 'mode':
        this.handleModeChange(newValue);
        break;
      case 'status':
        this.handleStatusChange(newValue);
        break;
    }
  }

  // Never store state in properties - always use attributes
  setValue(value) {
    // ✓ Correct
    this.setAttribute('value', value);

    // ✗ Wrong - don't use internal state
    // this._value = value;
  }
}
```

### Pattern: Computed Attributes

```javascript
class ComputedAttributes extends HTMLElement {
  static get observedAttributes() {
    return ['min', 'max', 'current'];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;

    if (name === 'min' || name === 'max' || name === 'current') {
      this.updateComputedAttributes();
    }
  }

  updateComputedAttributes() {
    const min = parseInt(this.getAttribute('min'), 10) || 0;
    const max = parseInt(this.getAttribute('max'), 10) || 100;
    const current = parseInt(this.getAttribute('current'), 10) || 0;

    // Compute percentage
    const percentage = ((current - min) / (max - min)) * 100;
    this.setAttribute('percentage', String(Math.round(percentage)));

    // Compute status
    if (percentage < 33) {
      this.setAttribute('level', 'low');
    } else if (percentage < 66) {
      this.setAttribute('level', 'medium');
    } else {
      this.setAttribute('level', 'high');
    }

    // CSS can react to these computed attributes
  }
}
```

### Pattern: State Validation

```javascript
class ValidatedState extends HTMLElement {
  static get observedAttributes() {
    return ['status'];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'status') {
      // Validate state transitions
      if (!this.isValidTransition(oldValue, newValue)) {
        console.warn(`Invalid state transition: ${oldValue} -> ${newValue}`);
        // Revert to old value
        this.setAttribute('status', oldValue);
        return;
      }

      this.handleStatusChange(newValue);
    }
  }

  isValidTransition(from, to) {
    const validTransitions = {
      'idle': ['loading', 'error'],
      'loading': ['success', 'error'],
      'success': ['idle', 'loading'],
      'error': ['idle', 'loading']
    };

    return validTransitions[from]?.includes(to) ?? true;
  }

  setStatus(newStatus) {
    this.setAttribute('status', newStatus);
  }
}
```

## Event Communication Patterns

### Pattern: Event Bubbling Chain

```javascript
// Child component
class ChildComponent extends HTMLElement {
  notifyParent(data) {
    this.dispatchEvent(new CustomEvent('child-event', {
      bubbles: true,      // Bubble up the DOM
      composed: true,     // Cross shadow DOM boundaries
      detail: data
    }));
  }
}

// Parent component
class ParentComponent extends HTMLElement {
  connectedCallback() {
    this.addEventListener('child-event', this);
  }

  handleEvent(e) {
    if (e.type === 'child-event') {
      console.log('Received from child:', e.detail);

      // Transform and re-emit
      this.dispatchEvent(new CustomEvent('parent-event', {
        bubbles: true,
        composed: true,
        detail: {
          childData: e.detail,
          parentContext: this.getAttribute('context')
        }
      }));
    }
  }
}
```

### Pattern: Event Cancellation

```javascript
class CancellableAction extends HTMLElement {
  async performAction() {
    // Dispatch cancellable event
    const event = new CustomEvent('action-requested', {
      bubbles: true,
      cancelable: true,
      detail: { action: 'delete' }
    });

    const shouldContinue = this.dispatchEvent(event);

    if (!shouldContinue) {
      // Event was cancelled by a listener
      console.log('Action cancelled');
      return;
    }

    // Proceed with action
    await this.executeAction();

    // Notify completion
    this.dispatchEvent(new CustomEvent('action-completed', {
      bubbles: true,
      detail: { success: true }
    }));
  }
}

// Usage
document.addEventListener('action-requested', (e) => {
  if (!confirm('Are you sure?')) {
    e.preventDefault(); // Cancel the action
  }
});
```

### Pattern: Event Delegation Router

```javascript
class EventRouter extends HTMLElement {
  connectedCallback() {
    // Single listener for all events
    this.addEventListener('click', this);
    this.addEventListener('submit', this);
    this.addEventListener('input', this);
  }

  handleEvent(e) {
    // Route based on event type and target
    const handler = this.getHandler(e);
    if (handler) {
      handler.call(this, e);
    }
  }

  getHandler(e) {
    const handlers = {
      'click': {
        '[data-action="save"]': this.handleSave,
        '[data-action="cancel"]': this.handleCancel,
        '[data-toggle]': this.handleToggle
      },
      'submit': {
        'form': this.handleSubmit
      },
      'input': {
        '[data-filter]': this.handleFilter
      }
    };

    const typeHandlers = handlers[e.type];
    if (!typeHandlers) return null;

    for (const [selector, handler] of Object.entries(typeHandlers)) {
      if (e.target.matches?.(selector) || e.target.closest?.(selector)) {
        return handler;
      }
    }

    return null;
  }

  handleSave(e) {
    console.log('Save clicked');
  }

  handleCancel(e) {
    console.log('Cancel clicked');
  }

  handleToggle(e) {
    const key = e.target.getAttribute('data-toggle');
    const current = this.getAttribute(key) === 'true';
    this.setAttribute(key, String(!current));
  }

  handleSubmit(e) {
    e.preventDefault();
    console.log('Form submitted');
  }

  handleFilter(e) {
    this.setAttribute('filter', e.target.value);
  }
}
```

## Styling Patterns

### Pattern: CSS Custom Properties API

```javascript
class ThemedComponent extends HTMLElement {
  connectedCallback() {
    // Read CSS custom properties
    const style = getComputedStyle(this);
    const primaryColor = style.getPropertyValue('--primary-color').trim();

    // Set CSS custom properties
    this.style.setProperty('--computed-contrast', this.getContrast(primaryColor));
  }

  getContrast(color) {
    // Calculate contrast color
    return '#ffffff'; // Simplified
  }

  static get observedAttributes() {
    return ['theme'];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'theme') {
      // Update CSS custom properties based on theme
      const themes = {
        'light': {
          '--bg': '#ffffff',
          '--text': '#000000'
        },
        'dark': {
          '--bg': '#000000',
          '--text': '#ffffff'
        }
      };

      const props = themes[newValue];
      if (props) {
        Object.entries(props).forEach(([prop, value]) => {
          this.style.setProperty(prop, value);
        });
      }
    }
  }
}
```

### Pattern: Attribute Selectors for State Styling

```html
<template shadowrootmode="open">
  <style>
    /* Base state */
    :host {
      display: block;
      opacity: 1;
      transition: opacity 0.2s;
    }

    /* Loading state */
    :host([loading="true"]) {
      opacity: 0.5;
      pointer-events: none;
    }

    /* Error state */
    :host([error]) {
      border-color: red;
    }

    /* Disabled state */
    :host([disabled]) {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* Size variants */
    :host([size="small"]) {
      font-size: 0.875rem;
      padding: 0.25rem 0.5rem;
    }

    :host([size="large"]) {
      font-size: 1.25rem;
      padding: 0.75rem 1.5rem;
    }

    /* Combine states */
    :host([type="primary"][disabled]) {
      background: #ccc;
    }

    /* Nested attribute selectors */
    button[aria-busy="true"] {
      cursor: wait;
    }

    input:invalid {
      border-color: red;
    }
  </style>

  <!-- Component content -->
</template>
```

### Pattern: Part-Based Theming

```html
<!-- Component definition -->
<my-component>
  <template shadowrootmode="open">
    <style>
      .header { /* internal styles */ }
      .body { /* internal styles */ }
      .footer { /* internal styles */ }
    </style>

    <div class="header" part="header">
      <slot name="title"></slot>
    </div>

    <div class="body" part="body">
      <slot></slot>
    </div>

    <div class="footer" part="footer">
      <slot name="actions"></slot>
    </div>
  </template>
</my-component>

<!-- External styling -->
<style>
  /* Theme all instances */
  my-component::part(header) {
    background: var(--header-bg, #f3f4f6);
    padding: 1rem;
  }

  my-component::part(body) {
    padding: 1rem;
  }

  my-component::part(footer) {
    border-top: 1px solid #e5e7eb;
    padding: 1rem;
  }

  /* Theme specific instances */
  .card my-component::part(header) {
    border-radius: 8px 8px 0 0;
  }
</style>
```

## Performance Patterns

### Pattern: Debounced Attribute Updates

```javascript
class DebouncedComponent extends HTMLElement {
  constructor() {
    super();
    this.debounceTimers = new Map();
  }

  connectedCallback() {
    this.addEventListener('input', this);
  }

  handleEvent(e) {
    if (e.type === 'input') {
      // Debounce the attribute update
      this.debouncedSetAttribute('search-query', e.target.value, 300);
    }
  }

  debouncedSetAttribute(name, value, delay) {
    // Clear existing timer
    if (this.debounceTimers.has(name)) {
      clearTimeout(this.debounceTimers.get(name));
    }

    // Set new timer
    const timer = setTimeout(() => {
      this.setAttribute(name, value);
      this.debounceTimers.delete(name);
    }, delay);

    this.debounceTimers.set(name, timer);
  }

  disconnectedCallback() {
    // Clear all timers
    this.debounceTimers.forEach(timer => clearTimeout(timer));
    this.debounceTimers.clear();
  }
}
```

### Pattern: Lazy Initialization

```javascript
class LazyComponent extends HTMLElement {
  connectedCallback() {
    this.setupIntersectionObserver();
  }

  setupIntersectionObserver() {
    this.observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          this.initialize();
          this.observer.disconnect();
        }
      });
    }, { rootMargin: '50px' });

    this.observer.observe(this);
  }

  initialize() {
    // Only initialize when visible
    const dataUrl = this.getAttribute('data-url');
    if (dataUrl) {
      this.loadData(dataUrl);
    }

    this.setAttribute('initialized', 'true');
  }

  async loadData(url) {
    this.setAttribute('loading', 'true');

    try {
      const response = await fetch(url);
      const data = await response.json();

      this.setAttribute('loading', 'false');
      this.dispatchEvent(new CustomEvent('data-loaded', {
        bubbles: true,
        detail: { data }
      }));
    } catch (error) {
      this.setAttribute('loading', 'false');
      this.setAttribute('error', error.message);
    }
  }

  disconnectedCallback() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }
}
```

### Pattern: Virtual Scrolling (Simplified)

```javascript
class VirtualList extends HTMLElement {
  connectedCallback() {
    this.addEventListener('scroll', this);
    this.itemHeight = parseInt(this.getAttribute('item-height'), 10) || 50;
    this.updateVisibleItems();
  }

  handleEvent(e) {
    if (e.type === 'scroll') {
      this.updateVisibleItems();
    }
  }

  updateVisibleItems() {
    const scrollTop = this.scrollTop;
    const clientHeight = this.clientHeight;

    const startIndex = Math.floor(scrollTop / this.itemHeight);
    const endIndex = Math.ceil((scrollTop + clientHeight) / this.itemHeight);

    this.setAttribute('visible-start', String(startIndex));
    this.setAttribute('visible-end', String(endIndex));

    this.dispatchEvent(new CustomEvent('visible-range-changed', {
      bubbles: true,
      detail: { startIndex, endIndex }
    }));
  }

  static get observedAttributes() {
    return ['item-height', 'total-items'];
  }
}
```

## Accessibility Patterns

### Pattern: Focus Management

```javascript
class FocusManager extends HTMLElement {
  connectedCallback() {
    this.addEventListener('keydown', this);

    // Make focusable
    if (!this.hasAttribute('tabindex')) {
      this.setAttribute('tabindex', '0');
    }
  }

  handleEvent(e) {
    if (e.type === 'keydown') {
      switch(e.key) {
        case 'Enter':
        case ' ':
          e.preventDefault();
          this.activate();
          break;
        case 'Escape':
          this.deactivate();
          this.focus(); // Return focus
          break;
        case 'Tab':
          this.handleTab(e);
          break;
      }
    }
  }

  activate() {
    this.setAttribute('active', 'true');
    this.setAttribute('aria-expanded', 'true');

    // Move focus to first interactive element
    const firstFocusable = this.querySelector('button, a, input, [tabindex="0"]');
    if (firstFocusable) {
      firstFocusable.focus();
    }
  }

  deactivate() {
    this.removeAttribute('active');
    this.setAttribute('aria-expanded', 'false');
  }

  handleTab(e) {
    const focusableElements = Array.from(
      this.querySelectorAll('button, a, input, [tabindex="0"]')
    );

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (e.shiftKey && document.activeElement === firstElement) {
      e.preventDefault();
      lastElement.focus();
    } else if (!e.shiftKey && document.activeElement === lastElement) {
      e.preventDefault();
      firstElement.focus();
    }
  }
}
```

### Pattern: ARIA Live Regions

```javascript
class LiveRegion extends HTMLElement {
  connectedCallback() {
    // Set up ARIA live region
    this.setAttribute('role', 'status');
    this.setAttribute('aria-live', this.getAttribute('aria-live') || 'polite');
    this.setAttribute('aria-atomic', this.getAttribute('aria-atomic') || 'true');
  }

  announce(message, priority = 'polite') {
    // Temporarily change priority if needed
    const currentPriority = this.getAttribute('aria-live');
    if (priority !== currentPriority) {
      this.setAttribute('aria-live', priority);
    }

    // Update content (will be announced)
    this.setAttribute('message', message);
    this.textContent = message;

    // Restore priority
    if (priority !== currentPriority) {
      setTimeout(() => {
        this.setAttribute('aria-live', currentPriority);
      }, 100);
    }
  }

  static get observedAttributes() {
    return ['message'];
  }
}

// Usage
const liveRegion = document.querySelector('live-region');
liveRegion.announce('Item added to cart', 'polite');
liveRegion.announce('Error: Connection lost', 'assertive');
```

### Pattern: Semantic Roles

```javascript
class SemanticButton extends HTMLButtonElement {
  connectedCallback() {
    // Ensure proper ARIA
    if (!this.hasAttribute('type')) {
      this.setAttribute('type', 'button');
    }

    this.addEventListener('click', this);
  }

  handleEvent(e) {
    if (e.type === 'click') {
      const isDisabled = this.hasAttribute('disabled') ||
                        this.getAttribute('aria-disabled') === 'true';

      if (isDisabled) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }

      this.dispatchEvent(new CustomEvent('activated', {
        bubbles: true,
        detail: { button: this }
      }));
    }
  }

  disable() {
    this.setAttribute('disabled', '');
    this.setAttribute('aria-disabled', 'true');
  }

  enable() {
    this.removeAttribute('disabled');
    this.setAttribute('aria-disabled', 'false');
  }
}

customElements.define('semantic-button', SemanticButton, { extends: 'button' });
```

## Error Handling Patterns

### Pattern: Graceful Degradation

```javascript
class ResilientComponent extends HTMLElement {
  async connectedCallback() {
    try {
      await this.initialize();
    } catch (error) {
      this.handleInitializationError(error);
    }
  }

  async initialize() {
    // Risky initialization
    const dataUrl = this.getAttribute('data-url');
    if (!dataUrl) {
      throw new Error('data-url attribute is required');
    }

    await this.loadData(dataUrl);
  }

  handleInitializationError(error) {
    console.error('Component initialization failed:', error);

    // Set error state
    this.setAttribute('error', 'true');
    this.setAttribute('error-message', error.message);

    // Dispatch error event
    this.dispatchEvent(new CustomEvent('initialization-error', {
      bubbles: true,
      detail: { error }
    }));

    // Show fallback content (via CSS)
    // :host([error="true"]) will show error slot
  }

  async loadData(url) {
    this.setAttribute('loading', 'true');

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      this.setAttribute('loading', 'false');
      this.removeAttribute('error');

      this.dispatchEvent(new CustomEvent('data-loaded', {
        bubbles: true,
        detail: { data }
      }));

      return data;
    } catch (error) {
      this.setAttribute('loading', 'false');
      this.setAttribute('error', 'true');
      this.setAttribute('error-message', error.message);

      this.dispatchEvent(new CustomEvent('data-error', {
        bubbles: true,
        detail: { error }
      }));

      throw error;
    }
  }
}
```

### Pattern: Retry Logic

```javascript
class RetryableComponent extends HTMLElement {
  async loadWithRetry(url, maxRetries = 3) {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.setAttribute('attempt', String(attempt));
        this.setAttribute('loading', 'true');

        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();

        this.setAttribute('loading', 'false');
        this.removeAttribute('error');
        this.removeAttribute('attempt');

        return data;
      } catch (error) {
        lastError = error;
        console.warn(`Attempt ${attempt} failed:`, error);

        if (attempt < maxRetries) {
          // Exponential backoff
          const delay = Math.pow(2, attempt) * 1_000;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    // All retries failed
    this.setAttribute('loading', 'false');
    this.setAttribute('error', 'true');
    this.setAttribute('error-message', `Failed after ${maxRetries} attempts`);

    throw lastError;
  }
}
```

## Testing Patterns

### Pattern: Testable Component

```javascript
// component.js
class TestableComponent extends HTMLElement {
  connectedCallback() {
    this.addEventListener('click', this);
  }

  handleEvent(e) {
    if (e.type === 'click') {
      const count = parseInt(this.getAttribute('count'), 10) || 0;
      this.setAttribute('count', String(count + 1));

      this.dispatchEvent(new CustomEvent('clicked', {
        bubbles: true,
        detail: { count: count + 1 }
      }));
    }
  }

  // Expose methods for testing
  reset() {
    this.setAttribute('count', '0');
  }

  getCount() {
    return parseInt(this.getAttribute('count'), 10) || 0;
  }

  static get observedAttributes() {
    return ['count'];
  }
}

customElements.define('testable-component', TestableComponent);
```

```html
<!-- test.html -->
<!DOCTYPE html>
<html>
<head>
  <script type="module" src="./component.js"></script>
</head>
<body>
  <testable-component id="test"></testable-component>

  <script type="module">
    const component = document.getElementById('test');

    // Test initial state
    console.assert(component.getCount() === 0, 'Initial count should be 0');

    // Test click
    let clickedCount = 0;
    component.addEventListener('clicked', (e) => {
      clickedCount = e.detail.count;
    });

    component.click();
    console.assert(component.getCount() === 1, 'Count should be 1 after click');
    console.assert(clickedCount === 1, 'Event should fire with count 1');

    // Test reset
    component.reset();
    console.assert(component.getCount() === 0, 'Count should be 0 after reset');

    console.log('✓ All tests passed');
  </script>
</body>
</html>
```

## Summary

These patterns demonstrate:

1. **State Management**: Attributes as single source of truth, computed values, validation
2. **Events**: Bubbling chains, cancellation, delegation routing
3. **Styling**: CSS custom properties, attribute selectors, part-based theming
4. **Performance**: Debouncing, lazy loading, virtual scrolling
5. **Accessibility**: Focus management, ARIA live regions, semantic roles
6. **Error Handling**: Graceful degradation, retry logic
7. **Testing**: Testable components with observable behavior

All patterns follow the core principles:
- Zero DOM selection
- Attribute-driven state
- Event-based communication
- HandleEvent pattern
- No external dependencies
