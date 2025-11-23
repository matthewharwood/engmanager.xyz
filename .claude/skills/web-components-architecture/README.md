# Web Components Architecture Skill

A comprehensive Claude Code skill for building web components using strict architectural principles.

## Overview

This skill teaches and enforces a pristine web component architecture based on:

- **Zero DOM Selection**: Never use `querySelector` or similar methods
- **Attribute-Driven State**: All state flows through HTML attributes
- **Event-Based Communication**: Components communicate only via CustomEvents
- **HandleEvent Pattern**: Use `handleEvent()` for memory-efficient event delegation
- **Declarative Shadow DOM**: Server-renderable components with instant styling
- **Progressive Enhancement**: Components work (degraded) without JavaScript
- **No External Dependencies**: Pure Web Platform APIs only

## Skill Files

### SKILL.md (Main Documentation)
The primary skill file containing:
- Core principles and architecture
- Component lifecycle patterns
- Attribute-driven state management
- Event communication patterns
- Styling APIs (CSS custom properties, ::part())
- Accessibility patterns with ARIA
- Form integration with ElementInternals
- Complete implementation examples

### EXAMPLES.md
Real-world, complete component implementations:
1. **Counter Button** - Simplest example demonstrating core principles
2. **Tab Panel System** - Multiple components coordinating via events
3. **Data Table** - Async data loading and sorting
4. **Form Input** - Native form integration with validation
5. **Infinite Scroll List** - Performance with IntersectionObserver
6. **Toast Notifications** - Global notification system

All examples are production-ready and follow every principle.

### PATTERNS.md
Common patterns and solutions for:
- **State Management**: Single source of truth, computed attributes, validation
- **Event Communication**: Bubbling chains, cancellation, delegation routing
- **Styling**: CSS custom properties API, attribute selectors, ::part() theming
- **Performance**: Debouncing, lazy initialization, virtual scrolling
- **Accessibility**: Focus management, ARIA live regions, semantic roles
- **Error Handling**: Graceful degradation, retry logic
- **Testing**: Testable components with observable behavior

### TROUBLESHOOTING.md
Debug guide for common issues:
- Component not registering
- Events not firing
- Attributes not updating
- Styles not applying
- Memory leaks
- Performance problems
- Accessibility issues
- Browser compatibility
- State management confusion

Includes debugging tools and a quick checklist.

## When Claude Uses This Skill

Claude will automatically use this skill when you:

- Ask to create web components or custom elements
- Request component-based architecture
- Want to build reusable UI components
- Need accessible, progressively enhanced components
- Mention Declarative Shadow DOM
- Ask about extending HTML elements
- Request server-side renderable components

## Key Principles Enforced

### 1. Zero DOM Selection
```javascript
// ❌ NEVER
this.querySelector('button').addEventListener(...)

// ✅ ALWAYS
this.addEventListener('click', this)
```

### 2. Attribute-Driven State
```javascript
// ❌ NEVER
this._state = 'loading'

// ✅ ALWAYS
this.setAttribute('state', 'loading')
```

### 3. Event-Based Output
```javascript
// ❌ NEVER
document.getElementById('result').textContent = 'Done'

// ✅ ALWAYS
this.dispatchEvent(new CustomEvent('completed', {
  bubbles: true,
  detail: { result: 'Done' }
}))
```

### 4. HandleEvent Pattern
```javascript
// ✅ ALWAYS
class MyElement extends HTMLElement {
  connectedCallback() {
    this.addEventListener('click', this)
  }

  handleEvent(e) {
    if (e.type === 'click') {
      // Handle click
    }
  }

  disconnectedCallback() {
    this.removeEventListener('click', this)
  }
}
```

### 5. Declarative Shadow DOM
```html
<my-component>
  <template shadowrootmode="open">
    <style>
      :host { display: block; }
    </style>
    <slot></slot>
  </template>
</my-component>
```

## Architecture Benefits

1. **Server-Side Rendering**: Declarative Shadow DOM renders instantly
2. **Progressive Enhancement**: Works without JavaScript (degraded)
3. **Memory Efficient**: HandleEvent pattern prevents memory leaks
4. **Maintainable**: Clear state flow through attributes
5. **Testable**: Observable behavior via attributes and events
6. **Accessible**: Built-in support for ARIA and keyboard navigation
7. **Performant**: No DOM queries, efficient event delegation
8. **Composable**: Components communicate via standard events

## Quick Start

### Create a Simple Component

```javascript
class MyButton extends HTMLButtonElement {
  connectedCallback() {
    this.addEventListener('click', this)
  }

  handleEvent(e) {
    if (e.type === 'click') {
      const count = parseInt(this.getAttribute('count') || '0', 10)
      this.setAttribute('count', String(count + 1))

      this.dispatchEvent(new CustomEvent('counted', {
        bubbles: true,
        detail: { count: count + 1 }
      }))
    }
  }

  disconnectedCallback() {
    this.removeEventListener('click', this)
  }
}

customElements.define('my-button', MyButton, { extends: 'button' })
```

### Use It in HTML

```html
<button is="my-button" count="0">
  Click me
</button>

<script>
  document.addEventListener('counted', (e) => {
    console.log('Count:', e.detail.count)
  })
</script>
```

## Anti-Patterns (Never Do)

This skill will prevent you from:

1. Using `querySelector` or `querySelectorAll`
2. Using `innerHTML` for dynamic content
3. Storing state in class properties instead of attributes
4. Modifying external DOM from components
5. Using global state
6. Importing external libraries
7. Creating Shadow DOM imperatively (use DSD)
8. Missing cleanup in `disconnectedCallback`

## Compatibility

- ✅ Chrome/Edge: Full support
- ✅ Firefox: Full support
- ⚠️ Safari: No customized built-ins (use polyfill or autonomous elements)
- ❌ IE11: Not supported (no polyfills in this architecture)

## References

- [Custom Elements Spec](https://html.spec.whatwg.org/multipage/custom-elements.html)
- [Declarative Shadow DOM](https://web.dev/declarative-shadow-dom/)
- [ElementInternals API](https://developer.mozilla.org/en-US/docs/Web/API/ElementInternals)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)

## Contributing

This skill is designed to be prescriptive and opinionated. All examples and patterns must strictly adhere to the core principles.
