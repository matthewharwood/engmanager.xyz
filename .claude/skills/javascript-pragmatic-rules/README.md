# JavaScript Pragmatic Rules

30 battle-tested rules for production JavaScript covering async operations, V8 optimization, memory management, testing, error handling, and performance.

## Overview

Rules organized by category:
- **Async Operations (1-4)**: Promise handling, timeouts, concurrency, cleanup
- **Object Design (4a-7)**: Hidden classes, immutability, cancellation, error boundaries
- **Error Handling (8-10)**: Global handlers, module design, error mapping
- **Logging (11-12)**: Structured logging, table-driven tests
- **Testing (13-15)**: Realistic API testing, property tests, debouncing
- **Performance (16-22)**: Profiling, memory leaks, Web Workers, deoptimization, requestAnimationFrame, arrays, typed arrays

See V8_OPTIMIZATION.md for advanced V8 optimization techniques (Rules 22a-27).

## When Claude Uses This Skill

Auto-activates when:
- Writing or optimizing JavaScript
- Handling promises and async operations
- Implementing error handling
- Writing tests
- Optimizing performance
- Building production applications

## Example Triggers

**Async patterns:**
```
"Handle this promise rejection properly"
"Add a timeout to this fetch request"
"Limit concurrency for these API calls"
"Fix this memory leak from the timer"
```

**Object design:**
```
"Initialize all properties in the constructor"
"Make this update immutable"
"Add cancellation to this async operation"
"Create an error boundary for this component"
```

**Performance:**
```
"Profile this function before optimizing"
"Move this heavy computation to a worker"
"Optimize this hot loop"
"Use typed arrays for this numeric computation"
```

**Testing:**
```
"Write table-driven tests for this function"
"Add property-based tests for this algorithm"
"Mock this API endpoint"
```

## Rule Categories

### Always Apply (Critical)
- Rule 1: Handle promise rejections
- Rule 2: Timeout async operations
- Rule 4: Clean up resources
- Rule 4a: Initialize all properties
- Rule 8: Global error handlers

### Hot Paths Only (Performance)
Rules for performance-critical code (>10k ops/sec):
- Rules 19-22: V8 optimization
- Rule 18: Web Workers
- Rule 21-22: Array/typed array optimization

### As Needed (Situational)
- Rule 3: Concurrency limits (API rate limits, resource constraints)
- Rule 5: Immutability (state management)
- Rule 6: Cancellation (user navigation, async operations)
- Rule 7: Error boundaries (component trees)
- Rules 13-15: Testing strategies
- Rule 16-17: Performance monitoring and cleanup

## Performance Impact

**High Impact (10-100x improvement):**
- Rule 22: Typed arrays for numeric computation
- Rule 24: Monomorphic vs polymorphic code
- Rule 3: Concurrency control

**Medium Impact (2-10x improvement):**
- Rule 21: Array type consistency
- Rule 25: Avoid hidden class transitions
- Rule 19: Avoid deoptimization triggers

**Low Impact (1.5-2x improvement):**
- Rule 15: Debounce/throttle
- Rule 20: requestAnimationFrame
- Rule 5: Immutability

## Files

- **SKILL.md**: Complete guide to Rules 1-22
- **V8_OPTIMIZATION.md**: Advanced V8 optimization (Rules 22a-27)

## Quick Examples

### Async with Timeout
```javascript
async function fetchWithTimeout(url, timeoutMs = 5_000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') throw new Error(`Timeout after ${timeoutMs}ms`);
    throw error;
  }
}
```

### Web Component Cleanup
```javascript
class TimerComponent extends HTMLElement {
  #intervalId = null;

  connectedCallback() {
    this.#intervalId = setInterval(() => {
      this.textContent = Date.now();
    }, 1_000);
  }

  disconnectedCallback() {
    if (this.#intervalId) {
      clearInterval(this.#intervalId);
      this.#intervalId = null;
    }
  }
}
```

### Initialize All Properties
```javascript
class User {
  #name;
  #email;
  #age;

  constructor(name, email = null, age = null) {
    this.#name = name;
    this.#email = email;
    this.#age = age;
  }
}
```

### Promise Pool
```javascript
class PromisePool {
  #concurrency;
  #running = 0;
  #queue = [];

  constructor(concurrency) {
    this.#concurrency = concurrency;
  }

  async run(fn) {
    while (this.#running >= this.#concurrency) {
      await new Promise(resolve => this.#queue.push(resolve));
    }
    this.#running++;
    try {
      return await fn();
    } finally {
      this.#running--;
      const resolve = this.#queue.shift();
      if (resolve) resolve();
    }
  }
}
```

## Common Pitfalls

### Async/Promises
- ❌ Ignoring promise rejections
- ❌ No timeout on fetch requests
- ❌ Unbounded concurrency
- ❌ Not cleaning up timers

### Objects
- ❌ Adding properties after construction
- ❌ Using `delete` operator
- ❌ Mutating state directly
- ❌ Not initializing all properties

### Performance
- ❌ Optimizing before profiling
- ❌ Using `eval`, `with`, `arguments`
- ❌ Mixing types in arrays
- ❌ Creating holes in arrays
- ❌ Not using typed arrays for numbers

## Browser Compatibility

**Universal (All Modern Browsers):**
- Most rules (1-15)
- Promise-based patterns
- Error handling
- Testing strategies

**Modern Browsers Only:**
- Rule 6: AbortController
- Rule 18: Web Workers
- Rule 20: requestAnimationFrame

**V8-Specific:**
- Rules 22a-27: V8 optimization (Chrome, Edge, Node.js)
- Other engines benefit indirectly

## Further Reading

- [V8 Blog - Fast Properties](https://v8.dev/blog/fast-properties)
- [V8 Blog - Elements Kinds](https://v8.dev/blog/elements-kinds)
- [MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
