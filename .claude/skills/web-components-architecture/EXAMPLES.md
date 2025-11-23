# Complete Web Component Examples

## Example 1: Counter Button (Simplest)

A minimal example demonstrating core principles.

**counter-button.js**
```javascript
class CounterButton extends HTMLButtonElement {
  connectedCallback() {
    // Initialize count from attribute
    if (!this.hasAttribute('count')) {
      this.setAttribute('count', '0');
    }

    this.addEventListener('click', this);
    this.updateDisplay();
  }

  handleEvent(e) {
    if (e.type === 'click') {
      const currentCount = parseInt(this.getAttribute('count'), 10);
      const newCount = currentCount + 1;

      // State change via attribute
      this.setAttribute('count', String(newCount));

      // Output via event
      this.dispatchEvent(new CustomEvent('count-changed', {
        bubbles: true,
        detail: { count: newCount }
      }));

      this.updateDisplay();
    }
  }

  updateDisplay() {
    const count = this.getAttribute('count');
    this.textContent = `Clicked ${count} times`;
  }

  static get observedAttributes() {
    return ['count'];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'count' && oldValue !== newValue) {
      this.updateDisplay();
    }
  }

  disconnectedCallback() {
    this.removeEventListener('click', this);
  }
}

customElements.define('counter-button', CounterButton, { extends: 'button' });
```

**Usage:**
```html
<!DOCTYPE html>
<html>
<head>
  <script type="module" src="./counter-button.js"></script>
</head>
<body>
  <button is="counter-button" count="0"></button>

  <script>
    document.addEventListener('count-changed', (e) => {
      console.log('Count is now:', e.detail.count);
    });
  </script>
</body>
</html>
```

---

## Example 2: Tab Panel System

Demonstrates multiple components working together via events and attributes.

**tab-panel.js**
```javascript
// Container component
class TabContainer extends HTMLElement {
  connectedCallback() {
    this.addEventListener('tab-selected', this);

    // Set initial active tab
    if (!this.hasAttribute('active-tab')) {
      this.setAttribute('active-tab', '0');
    }
  }

  handleEvent(e) {
    if (e.type === 'tab-selected') {
      this.setAttribute('active-tab', e.detail.index);
    }
  }

  static get observedAttributes() {
    return ['active-tab'];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'active-tab' && oldValue !== newValue) {
      // Update all children based on active tab
      const tabs = Array.from(this.querySelectorAll('[slot^="tab-"]'));
      const panels = Array.from(this.querySelectorAll('[slot^="panel-"]'));

      tabs.forEach((tab, index) => {
        if (String(index) === newValue) {
          tab.setAttribute('aria-selected', 'true');
          tab.removeAttribute('tabindex');
        } else {
          tab.setAttribute('aria-selected', 'false');
          tab.setAttribute('tabindex', '-1');
        }
      });

      panels.forEach((panel, index) => {
        if (String(index) === newValue) {
          panel.removeAttribute('hidden');
        } else {
          panel.setAttribute('hidden', '');
        }
      });
    }
  }
}

// Tab button component
class TabButton extends HTMLButtonElement {
  connectedCallback() {
    this.addEventListener('click', this);

    // Set ARIA attributes
    if (!this.hasAttribute('role')) {
      this.setAttribute('role', 'tab');
    }
  }

  handleEvent(e) {
    if (e.type === 'click') {
      const index = this.getAttribute('data-index');

      this.dispatchEvent(new CustomEvent('tab-selected', {
        bubbles: true,
        detail: { index }
      }));
    }
  }

  disconnectedCallback() {
    this.removeEventListener('click', this);
  }
}

customElements.define('tab-container', TabContainer);
customElements.define('tab-button', TabButton, { extends: 'button' });
```

**Usage:**
```html
<tab-container active-tab="0">
  <template shadowrootmode="open">
    <style>
      :host {
        display: block;
      }

      .tabs {
        display: flex;
        gap: 0.25rem;
        border-bottom: 2px solid #e5e7eb;
      }

      ::slotted(button[aria-selected="true"]) {
        border-bottom: 2px solid #6200ea;
        color: #6200ea;
      }

      .panels {
        padding: 1rem 0;
      }

      ::slotted([hidden]) {
        display: none;
      }
    </style>

    <div class="tabs" role="tablist">
      <slot name="tab-0"></slot>
      <slot name="tab-1"></slot>
      <slot name="tab-2"></slot>
    </div>

    <div class="panels">
      <slot name="panel-0"></slot>
      <slot name="panel-1"></slot>
      <slot name="panel-2"></slot>
    </div>
  </template>

  <!-- Tabs -->
  <button is="tab-button" slot="tab-0" data-index="0">Overview</button>
  <button is="tab-button" slot="tab-1" data-index="1">Details</button>
  <button is="tab-button" slot="tab-2" data-index="2">Reviews</button>

  <!-- Panels -->
  <div slot="panel-0" role="tabpanel">
    <h3>Overview</h3>
    <p>Product overview content...</p>
  </div>

  <div slot="panel-1" role="tabpanel" hidden>
    <h3>Details</h3>
    <p>Detailed specifications...</p>
  </div>

  <div slot="panel-2" role="tabpanel" hidden>
    <h3>Reviews</h3>
    <p>Customer reviews...</p>
  </div>
</tab-container>
```

---

## Example 3: Data Table with Sorting

Real-world example with async data loading and sorting.

**data-table.js**
```javascript
class DataTable extends HTMLElement {
  connectedCallback() {
    this.addEventListener('click', this);

    const dataUrl = this.getAttribute('data-url');
    if (dataUrl) {
      this.loadData(dataUrl);
    }
  }

  handleEvent(e) {
    if (e.type === 'click') {
      // Only handle clicks on sortable headers
      const header = e.target.closest('[data-sort]');
      if (header) {
        const column = header.getAttribute('data-sort');
        this.sortByColumn(column);
      }
    }
  }

  async loadData(url) {
    this.setAttribute('loading', 'true');

    try {
      const response = await fetch(url);
      const data = await response.json();

      this.setAttribute('loading', 'false');
      this.setAttribute('row-count', String(data.length));

      this.dispatchEvent(new CustomEvent('data-loaded', {
        bubbles: true,
        detail: { data }
      }));
    } catch (error) {
      this.setAttribute('loading', 'false');
      this.setAttribute('error', error.message);

      this.dispatchEvent(new CustomEvent('data-error', {
        bubbles: true,
        detail: { error: error.message }
      }));
    }
  }

  sortByColumn(column) {
    const currentSort = this.getAttribute('sort-column');
    const currentDirection = this.getAttribute('sort-direction') || 'asc';

    let newDirection = 'asc';
    if (currentSort === column && currentDirection === 'asc') {
      newDirection = 'desc';
    }

    this.setAttribute('sort-column', column);
    this.setAttribute('sort-direction', newDirection);

    this.dispatchEvent(new CustomEvent('sort-changed', {
      bubbles: true,
      detail: { column, direction: newDirection }
    }));
  }

  static get observedAttributes() {
    return ['data-url', 'loading', 'sort-column', 'sort-direction'];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;

    if (name === 'data-url' && newValue) {
      this.loadData(newValue);
    }
  }

  disconnectedCallback() {
    this.removeEventListener('click', this);
  }
}

customElements.define('data-table', DataTable);
```

**Usage:**
```html
<data-table data-url="/api/products">
  <template shadowrootmode="open">
    <style>
      :host {
        display: block;
      }

      :host([loading="true"]) table {
        opacity: 0.5;
        pointer-events: none;
      }

      table {
        width: 100%;
        border-collapse: collapse;
      }

      th {
        cursor: pointer;
        user-select: none;
      }

      th[data-sort]:hover {
        background: #f3f4f6;
      }

      /* Sort indicator */
      th[data-sort]::after {
        content: '';
        display: inline-block;
        margin-left: 0.5rem;
      }

      :host([sort-column="name"][sort-direction="asc"]) th[data-sort="name"]::after {
        content: '↑';
      }

      :host([sort-column="name"][sort-direction="desc"]) th[data-sort="name"]::after {
        content: '↓';
      }

      td, th {
        padding: 0.75rem;
        text-align: left;
        border-bottom: 1px solid #e5e7eb;
      }
    </style>

    <table>
      <thead>
        <tr>
          <th data-sort="name">Name</th>
          <th data-sort="price">Price</th>
          <th data-sort="stock">Stock</th>
        </tr>
      </thead>
      <tbody>
        <slot></slot>
      </tbody>
    </table>

    <div part="status">
      <slot name="loading">Loading...</slot>
      <slot name="error"></slot>
    </div>
  </template>

  <tr>
    <td>Product 1</td>
    <td>$99.99</td>
    <td>42</td>
  </tr>
  <tr>
    <td>Product 2</td>
    <td>$149.99</td>
    <td>17</td>
  </tr>
</data-table>

<script>
  const table = document.querySelector('data-table');

  table.addEventListener('data-loaded', (e) => {
    console.log('Loaded rows:', e.detail.data.length);

    // Update table rows (append to default slot)
    e.detail.data.forEach(item => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${item.name}</td>
        <td>$${item.price}</td>
        <td>${item.stock}</td>
      `;
      table.appendChild(row);
    });
  });

  table.addEventListener('sort-changed', (e) => {
    console.log('Sort by:', e.detail.column, e.detail.direction);
    // Re-order rows based on sort...
  });
</script>
```

---

## Example 4: Form Input with Validation

Using ElementInternals for native form integration.

**validated-input.js**
```javascript
class ValidatedInput extends HTMLElement {
  static formAssociated = true;

  constructor() {
    super();
    this.internals = this.attachInternals();
  }

  connectedCallback() {
    this.addEventListener('input', this);
    this.addEventListener('blur', this);

    // Initialize
    const initialValue = this.getAttribute('value') || '';
    this.updateValue(initialValue, false);
  }

  handleEvent(e) {
    if (e.type === 'input') {
      this.updateValue(e.target.value, false);
    } else if (e.type === 'blur') {
      this.validate();
    }
  }

  updateValue(value, shouldValidate = true) {
    this.setAttribute('value', value);
    this.internals.setFormValue(value);

    if (shouldValidate) {
      this.validate();
    }

    this.dispatchEvent(new CustomEvent('value-changed', {
      bubbles: true,
      detail: { value }
    }));
  }

  validate() {
    const value = this.getAttribute('value');
    const required = this.hasAttribute('required');
    const pattern = this.getAttribute('pattern');
    const minLength = parseInt(this.getAttribute('minlength'), 10);

    // Required check
    if (required && !value) {
      this.internals.setValidity(
        { valueMissing: true },
        'This field is required',
        this.inputElement
      );
      this.setAttribute('invalid', '');
      return false;
    }

    // Min length check
    if (minLength && value.length < minLength) {
      this.internals.setValidity(
        { tooShort: true },
        `Minimum ${minLength} characters required`,
        this.inputElement
      );
      this.setAttribute('invalid', '');
      return false;
    }

    // Pattern check
    if (pattern && value) {
      const regex = new RegExp(pattern);
      if (!regex.test(value)) {
        this.internals.setValidity(
          { patternMismatch: true },
          'Invalid format',
          this.inputElement
        );
        this.setAttribute('invalid', '');
        return false;
      }
    }

    // Valid
    this.internals.setValidity({});
    this.removeAttribute('invalid');
    return true;
  }

  get inputElement() {
    // For setValidity anchor (must be in light DOM)
    return this;
  }

  formResetCallback() {
    this.updateValue('');
  }

  formDisabledCallback(disabled) {
    if (disabled) {
      this.setAttribute('disabled', '');
    } else {
      this.removeAttribute('disabled');
    }
  }

  static get observedAttributes() {
    return ['value', 'required', 'pattern', 'minlength'];
  }

  disconnectedCallback() {
    this.removeEventListener('input', this);
    this.removeEventListener('blur', this);
  }
}

customElements.define('validated-input', ValidatedInput);
```

**Usage:**
```html
<form>
  <validated-input
    required
    minlength="3"
    pattern="^[a-zA-Z]+$">
    <template shadowrootmode="open">
      <style>
        :host {
          display: block;
          margin-bottom: 1rem;
        }

        input {
          width: 100%;
          padding: 0.5rem;
          border: 1px solid #d1d5db;
          border-radius: 4px;
        }

        :host([invalid]) input {
          border-color: #ef4444;
        }

        .error {
          color: #ef4444;
          font-size: 0.875rem;
          margin-top: 0.25rem;
          display: none;
        }

        :host([invalid]) .error {
          display: block;
        }
      </style>

      <label>
        <slot name="label">Input</slot>
      </label>

      <input
        type="text"
        part="input"
        aria-invalid="false">

      <div class="error" part="error">
        <slot name="error">Invalid input</slot>
      </div>
    </template>

    <span slot="label">Username</span>
    <span slot="error">Username must be at least 3 letters</span>
  </validated-input>

  <button type="submit">Submit</button>
</form>

<script>
  const form = document.querySelector('form');
  const input = document.querySelector('validated-input');

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    if (input.validate()) {
      console.log('Form is valid!', input.getAttribute('value'));
    }
  });
</script>
```

---

## Example 5: Infinite Scroll List

Demonstrates performance with intersection observer.

**infinite-list.js**
```javascript
class InfiniteList extends HTMLElement {
  connectedCallback() {
    this.setupIntersectionObserver();

    const initialUrl = this.getAttribute('data-url');
    if (initialUrl) {
      this.loadPage(initialUrl);
    }
  }

  setupIntersectionObserver() {
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            this.loadNextPage();
          }
        });
      },
      { rootMargin: '100px' }
    );

    // Observe the sentinel (must be in light DOM)
    const sentinel = this.querySelector('[data-sentinel]');
    if (sentinel) {
      this.observer.observe(sentinel);
    }
  }

  async loadPage(url) {
    if (this.getAttribute('loading') === 'true') return;

    this.setAttribute('loading', 'true');

    try {
      const response = await fetch(url);
      const data = await response.json();

      this.setAttribute('loading', 'false');

      const currentPage = parseInt(this.getAttribute('page') || '0', 10);
      this.setAttribute('page', String(currentPage + 1));

      if (data.nextUrl) {
        this.setAttribute('next-url', data.nextUrl);
      } else {
        this.removeAttribute('next-url');
        this.setAttribute('complete', 'true');
      }

      this.dispatchEvent(new CustomEvent('page-loaded', {
        bubbles: true,
        detail: {
          items: data.items,
          page: currentPage + 1,
          hasMore: !!data.nextUrl
        }
      }));
    } catch (error) {
      this.setAttribute('loading', 'false');
      this.setAttribute('error', error.message);

      this.dispatchEvent(new CustomEvent('load-error', {
        bubbles: true,
        detail: { error: error.message }
      }));
    }
  }

  loadNextPage() {
    const nextUrl = this.getAttribute('next-url');
    const isComplete = this.hasAttribute('complete');
    const isLoading = this.getAttribute('loading') === 'true';

    if (nextUrl && !isComplete && !isLoading) {
      this.loadPage(nextUrl);
    }
  }

  disconnectedCallback() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }

  static get observedAttributes() {
    return ['data-url', 'loading', 'page'];
  }
}

customElements.define('infinite-list', InfiniteList);
```

**Usage:**
```html
<infinite-list data-url="/api/items?page=1">
  <template shadowrootmode="open">
    <style>
      :host {
        display: block;
      }

      .list {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .loading {
        text-align: center;
        padding: 2rem;
        display: none;
      }

      :host([loading="true"]) .loading {
        display: block;
      }
    </style>

    <div class="list">
      <slot></slot>
    </div>

    <div class="loading" part="loading">
      Loading more...
    </div>

    <div part="complete">
      <slot name="complete"></slot>
    </div>
  </template>

  <!-- Initial items -->
  <div class="item">Item 1</div>
  <div class="item">Item 2</div>

  <!-- Sentinel for intersection observer -->
  <div data-sentinel></div>

  <div slot="complete">No more items</div>
</infinite-list>

<script>
  const list = document.querySelector('infinite-list');

  list.addEventListener('page-loaded', (e) => {
    const { items, page, hasMore } = e.detail;

    items.forEach((item, index) => {
      const div = document.createElement('div');
      div.className = 'item';
      div.textContent = `Item ${page * 10 + index + 1}: ${item.name}`;

      // Insert before sentinel
      const sentinel = list.querySelector('[data-sentinel]');
      list.insertBefore(div, sentinel);
    });

    console.log(`Page ${page} loaded. Has more: ${hasMore}`);
  });
</script>
```

---

## Example 6: Toast Notification System

Global notification system with auto-dismiss.

**toast-notification.js**
```javascript
class ToastNotification extends HTMLElement {
  connectedCallback() {
    this.addEventListener('click', this);

    // Auto-dismiss
    const duration = parseInt(this.getAttribute('duration'), 10) || 5000;
    if (duration > 0) {
      this.timeoutId = setTimeout(() => {
        this.dismiss();
      }, duration);
    }

    // Announce to screen readers
    this.setAttribute('role', 'status');
    this.setAttribute('aria-live', 'polite');
  }

  handleEvent(e) {
    if (e.type === 'click') {
      const dismissBtn = e.target.closest('[data-dismiss]');
      if (dismissBtn) {
        this.dismiss();
      }
    }
  }

  dismiss() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }

    this.setAttribute('dismissing', 'true');

    // Wait for animation
    setTimeout(() => {
      this.dispatchEvent(new CustomEvent('dismissed', {
        bubbles: true
      }));

      this.remove();
    }, 300);
  }

  disconnectedCallback() {
    this.removeEventListener('click', this);

    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
  }
}

class ToastContainer extends HTMLElement {
  connectedCallback() {
    this.setAttribute('aria-live', 'polite');
    this.setAttribute('aria-atomic', 'false');
  }

  addToast(message, type = 'info', duration = 5000) {
    const toast = document.createElement('toast-notification');
    toast.setAttribute('type', type);
    toast.setAttribute('duration', String(duration));
    toast.textContent = message;

    this.appendChild(toast);

    return toast;
  }
}

customElements.define('toast-notification', ToastNotification);
customElements.define('toast-container', ToastContainer);
```

**Usage:**
```html
<!DOCTYPE html>
<html>
<head>
  <script type="module" src="./toast-notification.js"></script>
</head>
<body>
  <toast-container>
    <template shadowrootmode="open">
      <style>
        :host {
          position: fixed;
          top: 1rem;
          right: 1rem;
          z-index: 9999;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        ::slotted(toast-notification) {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 1rem;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          animation: slideIn 0.3s ease-out;
          min-width: 300px;
        }

        ::slotted(toast-notification[type="success"]) {
          border-left: 4px solid #10b981;
        }

        ::slotted(toast-notification[type="error"]) {
          border-left: 4px solid #ef4444;
        }

        ::slotted(toast-notification[type="warning"]) {
          border-left: 4px solid #f59e0b;
        }

        ::slotted(toast-notification[dismissing="true"]) {
          animation: slideOut 0.3s ease-in;
        }

        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        @keyframes slideOut {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(100%);
            opacity: 0;
          }
        }
      </style>

      <slot></slot>
    </template>
  </toast-container>

  <button id="show-toast">Show Toast</button>

  <script>
    const container = document.querySelector('toast-container');
    const btn = document.getElementById('show-toast');

    btn.addEventListener('click', () => {
      const types = ['info', 'success', 'error', 'warning'];
      const type = types[Math.floor(Math.random() * types.length)];

      container.addToast(
        `This is a ${type} message!`,
        type,
        3000
      );
    });
  </script>
</body>
</html>
```

---

## Key Patterns Demonstrated

1. **Attribute-Driven State**: All examples use attributes for input state
2. **Event-Based Output**: All components communicate via CustomEvents
3. **HandleEvent Pattern**: Every component uses `handleEvent()` for delegation
4. **Zero DOM Selection**: No `querySelector` in any example
5. **Declarative Shadow DOM**: All styling and layout uses DSD
6. **Progressive Enhancement**: Components degrade gracefully
7. **Accessibility**: ARIA attributes and keyboard support throughout
8. **Form Integration**: ElementInternals for native form support
9. **Performance**: IntersectionObserver for efficient scrolling
10. **Memory Management**: Proper cleanup in `disconnectedCallback`
