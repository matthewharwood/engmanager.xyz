# Troubleshooting Guide

## Common Issues and Solutions

### Issue: Component Not Registering

**Symptom**: CustomElement doesn't appear to work or shows as `HTMLUnknownElement`

**Causes & Solutions**:

1. **Invalid element name**
   ```javascript
   // ❌ Wrong - missing hyphen
   customElements.define('mybutton', MyButton);

   // ✓ Correct - must contain hyphen
   customElements.define('my-button', MyButton);
   ```

2. **Already defined**
   ```javascript
   // Check if already defined
   if (!customElements.get('my-button')) {
     customElements.define('my-button', MyButton);
   }
   ```

3. **Script not loaded**
   ```html
   <!-- ❌ Wrong - loads after HTML -->
   <my-button>Click me</my-button>
   <script type="module" src="./my-button.js"></script>

   <!-- ✓ Correct - loads before or use defer -->
   <script type="module" src="./my-button.js"></script>
   <my-button>Click me</my-button>

   <!-- ✓ Also correct - module scripts defer by default -->
   <my-button>Click me</my-button>
   <script type="module" src="./my-button.js"></script>
   ```

4. **Customized built-in not supported**
   ```javascript
   // Check support
   if ('customElements' in window && customElements.define) {
     // Supported
   }

   // Safari doesn't support customized built-ins
   // Use polyfill or switch to autonomous elements
   ```

### Issue: Events Not Firing

**Symptom**: CustomEvent listeners don't receive events

**Causes & Solutions**:

1. **Event not bubbling**
   ```javascript
   // ❌ Wrong - doesn't bubble
   this.dispatchEvent(new CustomEvent('my-event', {
     detail: { data: 'test' }
   }));

   // ✓ Correct - bubbles up
   this.dispatchEvent(new CustomEvent('my-event', {
     bubbles: true,
     detail: { data: 'test' }
   }));
   ```

2. **Shadow DOM boundary**
   ```javascript
   // ❌ Wrong - stops at shadow boundary
   this.dispatchEvent(new CustomEvent('my-event', {
     bubbles: true
   }));

   // ✓ Correct - crosses shadow DOM
   this.dispatchEvent(new CustomEvent('my-event', {
     bubbles: true,
     composed: true  // Key for shadow DOM
   }));
   ```

3. **Listener added too late**
   ```javascript
   // ❌ Wrong - event fires before listener added
   const el = document.createElement('my-button');
   el.click(); // Event fires
   el.addEventListener('clicked', handler); // Too late

   // ✓ Correct - add listener first
   const el = document.createElement('my-button');
   el.addEventListener('clicked', handler);
   document.body.appendChild(el);
   ```

4. **Event propagation stopped**
   ```javascript
   // Check if event is being stopped somewhere
   document.addEventListener('my-event', (e) => {
     e.stopPropagation(); // This prevents bubbling
   });
   ```

### Issue: Attributes Not Updating

**Symptom**: `attributeChangedCallback` not called

**Causes & Solutions**:

1. **Attribute not observed**
   ```javascript
   class MyElement extends HTMLElement {
     // ❌ Wrong - 'value' not in observedAttributes
     static get observedAttributes() {
       return ['count'];
     }

     // ✓ Correct - include all observed attributes
     static get observedAttributes() {
       return ['count', 'value', 'status'];
     }

     attributeChangedCallback(name, oldValue, newValue) {
       // Now called for count, value, AND status
     }
   }
   ```

2. **Setting same value**
   ```javascript
   attributeChangedCallback(name, oldValue, newValue) {
     // Always check if value actually changed
     if (oldValue === newValue) return;

     // Now handle the change
   }
   ```

3. **Setting attribute in constructor**
   ```javascript
   class MyElement extends HTMLElement {
     constructor() {
       super();
       // ❌ Wrong - callback not ready yet
       this.setAttribute('initialized', 'true');
     }

     connectedCallback() {
       // ✓ Correct - safe to set attributes here
       if (!this.hasAttribute('initialized')) {
         this.setAttribute('initialized', 'true');
       }
     }
   }
   ```

4. **Boolean attributes**
   ```javascript
   // Boolean attributes work differently
   // Presence = true, Absence = false

   // ❌ Wrong
   element.setAttribute('disabled', 'false'); // Still true!

   // ✓ Correct
   element.setAttribute('disabled', ''); // true
   element.removeAttribute('disabled'); // false

   // Check boolean attributes
   const isDisabled = element.hasAttribute('disabled');
   ```

### Issue: Styles Not Applying

**Symptom**: CSS in shadow DOM or ::part() not working

**Causes & Solutions**:

1. **Shadow DOM not attached**
   ```html
   <!-- ❌ Wrong - no shadow DOM -->
   <my-element>
     <style>/* Won't work */</style>
   </my-element>

   <!-- ✓ Correct - Declarative Shadow DOM -->
   <my-element>
     <template shadowrootmode="open">
       <style>/* Works */</style>
       <slot></slot>
     </template>
   </my-element>
   ```

2. **Part not exposed**
   ```html
   <template shadowrootmode="open">
     <!-- ❌ Wrong - no 'part' attribute -->
     <button class="action">Click</button>
   </template>

   <!-- Can't style from outside -->
   <style>
     my-element::part(action) { /* Won't work */ }
   </style>

   <!-- ✓ Correct - expose part -->
   <template shadowrootmode="open">
     <button class="action" part="action">Click</button>
   </template>

   <style>
     my-element::part(action) { /* Works */ }
   </style>
   ```

3. **CSS custom property not inherited**
   ```css
   /* ❌ Wrong - property doesn't inherit into shadow DOM */
   my-element {
     color: blue; /* Won't inherit */
   }

   /* ✓ Correct - use CSS custom properties */
   my-element {
     --text-color: blue;
   }
   ```

   ```html
   <template shadowrootmode="open">
     <style>
       .text {
         color: var(--text-color, black);
       }
     </style>
   </template>
   ```

4. **Specificity issues**
   ```css
   /* Shadow DOM styles have different specificity context */

   /* ❌ Wrong - external style can't override shadow styles */
   my-element::part(button) {
     background: red; /* May not win */
   }

   /* ✓ Correct - use !important or higher specificity in shadow DOM */
   <template shadowrootmode="open">
     <style>
       button[part="button"] {
         background: blue; /* Lower specificity, easier to override */
       }
     </style>
   </template>
   ```

### Issue: Memory Leaks

**Symptom**: Page gets slower over time, memory usage increases

**Causes & Solutions**:

1. **Event listeners not removed**
   ```javascript
   class LeakyElement extends HTMLElement {
     connectedCallback() {
       this.addEventListener('click', this);
     }

     // ❌ Wrong - missing cleanup
     // disconnectedCallback not implemented
   }

   class CleanElement extends HTMLElement {
     connectedCallback() {
       this.addEventListener('click', this);
     }

     // ✓ Correct - cleanup listeners
     disconnectedCallback() {
       this.removeEventListener('click', this);
     }
   }
   ```

2. **Timers not cleared**
   ```javascript
   class TimerElement extends HTMLElement {
     connectedCallback() {
       // ❌ Wrong - timer continues after disconnect
       setInterval(() => {
         console.log('tick');
       }, 1_000);
     }
   }

   class CleanTimerElement extends HTMLElement {
     connectedCallback() {
       // ✓ Correct - store timer ID
       this.intervalId = setInterval(() => {
         console.log('tick');
       }, 1_000);
     }

     disconnectedCallback() {
       // ✓ Correct - clear timer
       if (this.intervalId) {
         clearInterval(this.intervalId);
       }
     }
   }
   ```

3. **Observers not disconnected**
   ```javascript
   class ObserverElement extends HTMLElement {
     connectedCallback() {
       this.observer = new IntersectionObserver(() => {
         // ...
       });
       this.observer.observe(this);
     }

     // ❌ Wrong - observer continues
     // disconnectedCallback not implemented

     // ✓ Correct - disconnect observer
     disconnectedCallback() {
       if (this.observer) {
         this.observer.disconnect();
       }
     }
   }
   ```

4. **External references**
   ```javascript
   // ❌ Wrong - global reference prevents garbage collection
   const globalElements = new Set();

   class ReferencedElement extends HTMLElement {
     connectedCallback() {
       globalElements.add(this); // Leak!
     }
   }

   // ✓ Correct - use WeakSet or clean up
   const globalElements = new WeakSet();

   class CleanReferencedElement extends HTMLElement {
     connectedCallback() {
       globalElements.add(this); // Can be garbage collected
     }
   }
   ```

### Issue: Performance Problems

**Symptom**: Component is slow or causes jank

**Causes & Solutions**:

1. **Too many attribute changes**
   ```javascript
   // ❌ Wrong - triggers callback 3 times
   element.setAttribute('x', '10');
   element.setAttribute('y', '20');
   element.setAttribute('z', '30');

   // ✓ Correct - batch updates or use data attribute
   element.setAttribute('position', JSON.stringify({ x: 10, y: 20, z: 30 }));

   // Or debounce updates
   debouncedSetAttribute(name, value, delay) {
     clearTimeout(this.debounceTimer);
     this.debounceTimer = setTimeout(() => {
       this.setAttribute(name, value);
     }, delay);
   }
   ```

2. **Expensive operations in callbacks**
   ```javascript
   class SlowElement extends HTMLElement {
     attributeChangedCallback(name, oldValue, newValue) {
       // ❌ Wrong - heavy computation in callback
       this.processLargeDataset();
       this.recomputeEverything();
     }
   }

   class FastElement extends HTMLElement {
     attributeChangedCallback(name, oldValue, newValue) {
       // ✓ Correct - defer heavy work
       if (this.updateTimer) {
         cancelAnimationFrame(this.updateTimer);
       }

       this.updateTimer = requestAnimationFrame(() => {
         this.processUpdate();
       });
     }
   }
   ```

3. **Forced reflows**
   ```javascript
   // ❌ Wrong - causes layout thrashing
   elements.forEach(el => {
     const height = el.offsetHeight; // Read
     el.style.height = height + 10 + 'px'; // Write
   });

   // ✓ Correct - batch reads and writes
   const heights = elements.map(el => el.offsetHeight);
   elements.forEach((el, i) => {
     el.style.height = heights[i] + 10 + 'px';
   });
   ```

4. **Large DOM in shadow**
   ```javascript
   // ❌ Wrong - render everything
   class HugeList extends HTMLElement {
     connectedCallback() {
       const shadow = this.attachShadow({ mode: 'open' });
       shadow.innerHTML = this.items.map(item => `
         <div>${item}</div>
       `).join(''); // 10,000 items!
     }
   }

   // ✓ Correct - use virtual scrolling or lazy rendering
   class OptimizedList extends HTMLElement {
     connectedCallback() {
       this.observer = new IntersectionObserver(this.handleIntersection);
       this.renderVisibleItems();
     }

     renderVisibleItems() {
       // Only render items in viewport
     }
   }
   ```

### Issue: Accessibility Problems

**Symptom**: Screen readers don't announce content, keyboard navigation doesn't work

**Causes & Solutions**:

1. **Missing ARIA attributes**
   ```javascript
   // ❌ Wrong - no accessibility info
   class CustomButton extends HTMLElement {
     connectedCallback() {
       this.addEventListener('click', this);
     }
   }

   // ✓ Correct - add ARIA attributes
   class AccessibleButton extends HTMLElement {
     connectedCallback() {
       this.setAttribute('role', 'button');
       this.setAttribute('tabindex', '0');
       this.addEventListener('click', this);
       this.addEventListener('keydown', this);
     }

     handleEvent(e) {
       if (e.type === 'keydown' && (e.key === 'Enter' || e.key === ' ')) {
         e.preventDefault();
         this.click();
       }
     }
   }
   ```

2. **Shadow DOM hiding content from screen readers**
   ```html
   <!-- ❌ Wrong - icon not announced -->
   <template shadowrootmode="open">
     <svg><!-- icon --></svg>
   </template>

   <!-- ✓ Correct - provide text alternative -->
   <template shadowrootmode="open">
     <svg aria-hidden="true"><!-- icon --></svg>
     <span class="sr-only">Icon description</span>
   </template>

   <style>
     .sr-only {
       position: absolute;
       width: 1px;
       height: 1px;
       padding: 0;
       margin: -1px;
       overflow: hidden;
       clip: rect(0, 0, 0, 0);
       white-space: nowrap;
       border-width: 0;
     }
   </style>
   ```

3. **Focus not visible**
   ```css
   /* ❌ Wrong - removes focus outline */
   :host {
     outline: none;
   }

   /* ✓ Correct - style focus appropriately */
   :host(:focus) {
     outline: 2px solid blue;
     outline-offset: 2px;
   }

   /* Or use :focus-visible for keyboard-only focus */
   :host(:focus-visible) {
     outline: 2px solid blue;
   }
   ```

4. **Dynamic content not announced**
   ```javascript
   // ❌ Wrong - changes not announced
   class StatusDisplay extends HTMLElement {
     updateStatus(message) {
       this.textContent = message;
     }
   }

   // ✓ Correct - use ARIA live region
   class AccessibleStatus extends HTMLElement {
     connectedCallback() {
       this.setAttribute('role', 'status');
       this.setAttribute('aria-live', 'polite');
       this.setAttribute('aria-atomic', 'true');
     }

     updateStatus(message) {
       this.textContent = message; // Now announced
     }
   }
   ```

### Issue: Browser Compatibility

**Symptom**: Component doesn't work in some browsers

**Causes & Solutions**:

1. **Declarative Shadow DOM not supported**
   ```javascript
   // Feature detection
   const supportsDSD = 'shadowRootMode' in HTMLTemplateElement.prototype;

   if (!supportsDSD) {
     // Polyfill or fallback
     (function() {
       const templates = document.querySelectorAll('template[shadowrootmode]');
       templates.forEach(template => {
         const mode = template.getAttribute('shadowrootmode');
         const shadowRoot = template.parentNode.attachShadow({ mode });
         shadowRoot.appendChild(template.content);
         template.remove();
       });
     })();
   }
   ```

2. **Customized built-ins not supported (Safari)**
   ```javascript
   // Check support
   const supportsCustomizedBuiltIns = 'customElements' in window &&
     typeof customElements.define === 'function';

   if (supportsCustomizedBuiltIns) {
     // Use customized built-in
     customElements.define('fancy-button', FancyButton, { extends: 'button' });
   } else {
     // Fallback to autonomous element
     class FancyButtonFallback extends HTMLElement {
       // Wrap a button instead
     }
     customElements.define('fancy-button', FancyButtonFallback);
   }
   ```

3. **CSS features not supported**
   ```css
   /* Use @supports for progressive enhancement */

   /* Base styling (works everywhere) */
   :host {
     display: block;
   }

   /* Enhanced styling (modern browsers) */
   @supports (container-type: inline-size) {
     :host {
       container-type: inline-size;
     }
   }

   @supports (selector(:has(> *))) {
     :host:has(> [slot="icon"]) {
       /* Enhanced layout */
     }
   }
   ```

### Issue: State Management Confusion

**Symptom**: Component state gets out of sync

**Causes & Solutions**:

1. **Mixing internal state with attributes**
   ```javascript
   // ❌ Wrong - state split between attribute and property
   class ConfusedElement extends HTMLElement {
     connectedCallback() {
       this._internalValue = 'foo';
       this.setAttribute('value', 'bar');
       // Which is the source of truth?
     }
   }

   // ✓ Correct - attribute is always the source of truth
   class ClearElement extends HTMLElement {
     getValue() {
       return this.getAttribute('value') || '';
     }

     setValue(value) {
       this.setAttribute('value', value);
     }

     static get observedAttributes() {
       return ['value'];
     }

     attributeChangedCallback(name, oldValue, newValue) {
       // Attribute is always the source of truth
       // React to changes here
     }
   }
   ```

2. **Not validating state transitions**
   ```javascript
   // ✓ Correct - validate before setting
   class ValidatedElement extends HTMLElement {
     setState(newState) {
       if (!this.isValidState(newState)) {
         console.error('Invalid state:', newState);
         return false;
       }

       this.setAttribute('state', newState);
       return true;
     }

     isValidState(state) {
       const validStates = ['idle', 'loading', 'success', 'error'];
       return validStates.includes(state);
     }
   }
   ```

## Debugging Tools

### Browser DevTools

```javascript
// Inspect custom element in console
const el = document.querySelector('my-element');

// Check if it's properly defined
console.log(el.constructor.name); // Should show your class name

// Inspect observed attributes
console.log(el.constructor.observedAttributes);

// Check current attributes
console.log([...el.attributes].map(a => `${a.name}="${a.value}"`));

// Check shadow root
console.log(el.shadowRoot);
console.log(el.shadowRoot?.innerHTML);

// Monitor attribute changes
const observer = new MutationObserver((mutations) => {
  mutations.forEach(mutation => {
    console.log('Attribute changed:', mutation.attributeName,
                'from', mutation.oldValue,
                'to', mutation.target.getAttribute(mutation.attributeName));
  });
});

observer.observe(el, {
  attributes: true,
  attributeOldValue: true
});
```

### Event Debugging

```javascript
// Log all events
['click', 'change', 'input', 'custom-event'].forEach(eventType => {
  document.addEventListener(eventType, (e) => {
    console.log(eventType, {
      target: e.target,
      currentTarget: e.currentTarget,
      detail: e.detail,
      bubbles: e.bubbles,
      composed: e.composed
    });
  }, true); // Use capture to see all events
});
```

### Performance Debugging

```javascript
// Monitor attribute changes for performance
class DebugElement extends HTMLElement {
  attributeChangedCallback(name, oldValue, newValue) {
    const start = performance.now();

    // Your code
    this.handleAttributeChange(name, oldValue, newValue);

    const end = performance.now();
    console.log(`Attribute ${name} change took ${end - start}ms`);
  }
}

// Monitor render time
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    console.log('Render time:', entry.duration);
  }
});

observer.observe({ entryTypes: ['measure'] });

class MeasuredElement extends HTMLElement {
  connectedCallback() {
    performance.mark('element-start');
    this.render();
    performance.mark('element-end');
    performance.measure('element-render', 'element-start', 'element-end');
  }
}
```

## Quick Checklist

When debugging, check:

- [ ] Element name contains hyphen
- [ ] `customElements.define()` is called
- [ ] Attributes are in `observedAttributes` array
- [ ] Events have `bubbles: true` and `composed: true`
- [ ] Event listeners are removed in `disconnectedCallback`
- [ ] Shadow DOM has `<template shadowrootmode="open">`
- [ ] Parts are exposed with `part` attribute
- [ ] ARIA attributes are set for accessibility
- [ ] No `querySelector` or DOM selection is used
- [ ] No external dependencies are imported
