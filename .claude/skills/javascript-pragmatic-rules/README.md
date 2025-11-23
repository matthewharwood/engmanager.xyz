# JavaScript Pragmatic Rules - Skill Documentation

A comprehensive Claude Code skill covering 30 battle-tested rules for production JavaScript development.

## Overview

This skill provides deep, research-backed guidance on writing production-grade JavaScript. Each rule includes:
- **Why it matters** - Performance impact and real-world implications
- **The problem** - Anti-patterns and common mistakes
- **Best practices** - Production-ready solutions with examples
- **Real-world examples** - Complete, working implementations
- **Patterns** - Advanced techniques and optimizations

## Skill Files

### SKILL.md
Main documentation covering Rules 1-12:
- **Async Operations (1-4)**: Promise handling, timeouts, concurrency, cleanup
- **Object Design (4a-7)**: Hidden classes, immutability, cancellation, error boundaries
- **Error Handling (8-10)**: Global handlers, module design, error mapping
- **Logging (11-12)**: Structured logging, table-driven tests

### SKILL_PART2.md
Continuation with Rules 13-22:
- **Testing (13-15)**: MSW mocking, property tests, debouncing
- **Performance (16-22)**: Profiling, memory leaks, Web Workers, deoptimization, requestAnimationFrame

### V8_OPTIMIZATION.md
Deep dive into Rules 22a-27:
- **V8 Profiling (22a)**: --trace-opt, --trace-deopt flags
- **Array Optimization (23)**: PACKED_SMI, PACKED_DOUBLE, PACKED_ELEMENTS
- **Monomorphic Code (24)**: Single types at call sites
- **Hidden Classes (25)**: Avoid shape transitions
- **Typed Arrays (27)**: Int32Array, Float64Array for performance

## The 30 Rules

### Async Operations & Promises (1-4)
1. **Never ignore Promise rejections** - Handle or propagate with context
2. **Time-bound all async operations** - Promise.race with timeout
3. **Limit concurrent operations** - p-limit, promise pools
4. **No orphaned timers/listeners** - Clear timeouts, remove listeners

### Object Design & Immutability (4a-7)
4a. **Consistent object shapes** - Initialize all properties in constructors for V8 hidden classes
5. **Prefer immutability** - Spread operators, Immer for complex updates
6. **Design for cancellation** - AbortController for fetch, async operations
7. **Graceful error boundaries** - React error boundaries, fallback UI

### Error Handling & Resilience (8-10)
8. **Zero uncaught exceptions** - Global error handlers, window.onerror
9. **Small module interfaces** - 1-3 exports, clear contracts
10. **Map errors to user messages** - Error codes to human-readable text

### Logging & Observability (11-12)
11. **Structured logging** - JSON logs with context
12. **Table-driven tests** - Jest test.each for comprehensive coverage

### Testing Strategy (13-15)
13. **Integration with real APIs** - MSW for mocking, real services in E2E
14. **Property tests for algorithms** - fast-check for invariants
15. **Debounce/throttle UI events** - Prevent excessive calls

### Performance Optimization (16-22)
16. **Profile before optimizing** - Chrome DevTools, React Profiler
17. **Avoid memory leaks** - Cleanup in useEffect, disconnectedCallback
18. **Use Web Workers for CPU work** - Offload heavy computation
19. **Avoid deoptimization triggers** - No delete, arguments, with, eval in hot paths
20. **Prefer requestAnimationFrame** - For visual updates
21. **Keep array types consistent** - PACKED_SMI > PACKED_DOUBLE > PACKED_ELEMENTS
22. **Use typed arrays for numerics** - Int32Array, Float64Array for math

### V8 Engine Optimization (22a-27)
22a. **Profile V8 optimization** - Use --trace-opt, --trace-deopt flags
23. **Keep array types consistent** - PACKED_SMI > PACKED_DOUBLE > PACKED_ELEMENTS
24. **Monomorphic over polymorphic** - Single types at call sites
25. **Avoid hidden class transitions** - Stable object shapes
26. **Monomorphic call sites** - Single type at each call location
27. **Use typed arrays for numerics** - Int32Array, Float64Array for performance

## When Claude Uses This Skill

Claude will automatically activate this skill when:
- Writing or optimizing JavaScript code
- Handling promises and async operations
- Implementing error handling
- Writing tests
- Optimizing performance
- Working with V8 engine
- Building production applications

## Quick Start

### Basic Example - Async with Timeout
```javascript
// Rule 2: Time-bound all async operations
async function fetchWithTimeout(url, timeoutMs = 5000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw error;
  }
}
```

### Intermediate Example - Promise Pool
```javascript
// Rule 3: Limit concurrent operations
class PromisePool {
  constructor(concurrency) {
    this.concurrency = concurrency;
    this.running = 0;
    this.queue = [];
  }

  async run(fn) {
    while (this.running >= this.concurrency) {
      await new Promise(resolve => this.queue.push(resolve));
    }

    this.running++;

    try {
      return await fn();
    } finally {
      this.running--;
      const resolve = this.queue.shift();
      if (resolve) resolve();
    }
  }
}
```

### Advanced Example - V8 Optimization
```javascript
// Rule 4a: Consistent object shapes
class Point {
  constructor(x, y, z = 0) {
    // Initialize ALL properties - creates stable hidden class
    this.x = x;
    this.y = y;
    this.z = z;
  }
}

// All instances share same optimized hidden class
const points = Array.from({ length: 10000 }, (_, i) =>
  new Point(i, i * 2, i * 3)
);

// V8 can inline and optimize this loop
let sum = 0;
for (const point of points) {
  sum += point.x + point.y + point.z; // Monomorphic access
}
```

## Rule Categories

### Always Apply (Critical)
Rules that should be followed in all JavaScript code:
- Rule 1: Handle promise rejections
- Rule 2: Timeout async operations
- Rule 4: Clean up resources
- Rule 8: Global error handlers
- Rule 4a: Initialize all properties

### Hot Paths Only (Performance)
Rules for performance-critical code (>10k ops/sec):
- Rules 19-27: V8 optimization techniques
- Rule 18: Web Workers
- Rule 21-22: Array/typed array optimization

### As Needed (Situational)
Rules to apply when specific needs arise:
- Rule 3: Concurrency limits (API rate limits, resource constraints)
- Rule 5: Immutability (React, Redux, state management)
- Rule 6: Cancellation (user navigation, async operations)
- Rule 7: Error boundaries (React applications)

## Performance Impact

### High Impact (10-100x improvement)
- Rule 22: Typed arrays for numeric computation
- Rule 24: Monomorphic vs polymorphic code
- Rule 3: Concurrency control prevents resource exhaustion

### Medium Impact (2-10x improvement)
- Rule 21: Array type consistency
- Rule 25: Avoid hidden class transitions
- Rule 19: Avoid deoptimization triggers

### Low Impact (1.5-2x improvement)
- Rule 15: Debounce/throttle
- Rule 20: requestAnimationFrame
- Rule 5: Immutability (enables other optimizations)

## Testing Recommendations

### Unit Tests
- Rule 12: Table-driven tests with test.each
- Rule 14: Property-based tests with fast-check

### Integration Tests
- Rule 13: MSW for API mocking
- Real API calls in E2E tests

### Performance Tests
- Rule 16: Profile before optimizing
- Rule 22a: Use V8 flags to verify optimization

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

## Tool Recommendations

### Async/Testing
- MSW (Mock Service Worker)
- fast-check (property-based testing)
- Jest (test.each)

### Logging
- winston, pino (structured logging)
- Sentry, Bugsnag (error tracking)

### Performance
- Chrome DevTools Performance tab
- React Profiler
- V8 flags: --trace-opt, --trace-deopt

### Concurrency
- p-limit (concurrency control)
- AbortController (cancellation)

## Browser Compatibility

### Universal (All Modern Browsers)
- Most rules (1-15)
- Promise-based patterns
- Error handling
- Testing strategies

### Modern Browsers Only
- Rule 6: AbortController (polyfill available)
- Rule 18: Web Workers
- Rule 20: requestAnimationFrame

### V8-Specific
- Rules 22a-27: V8 optimization (Chrome, Edge, Node.js)
- Other engines benefit indirectly from good practices

## Migration Guide

### From Callbacks to Promises
```javascript
// Old
function fetchData(callback) {
  setTimeout(() => callback(null, data), 1000);
}

// New (Rule 2: with timeout)
async function fetchData() {
  return withTimeout(
    new Promise(resolve => setTimeout(() => resolve(data), 1000)),
    5000
  );
}
```

### From Mutable to Immutable
```javascript
// Old
function addItem(cart, item) {
  cart.items.push(item);
  return cart;
}

// New (Rule 5)
function addItem(cart, item) {
  return {
    ...cart,
    items: [...cart.items, item]
  };
}
```

### From Polymorphic to Monomorphic
```javascript
// Old
function getValue(obj) {
  return obj.value; // Polymorphic!
}

// New (Rule 24)
class Point {
  constructor(value) {
    this.value = value;
    this.x = 0;
    this.y = 0;
  }
}

function getPointValue(point) {
  return point.value; // Monomorphic!
}
```

## Further Reading

### Official Documentation
- [MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
- [V8 Blog](https://v8.dev/blog)
- [TC39 Proposals](https://github.com/tc39/proposals)

### Performance
- [JavaScript Engine Fundamentals](https://mathiasbynens.be/notes/shapes-ics)
- [Fast Properties in V8](https://v8.dev/blog/fast-properties)
- [Elements Kinds in V8](https://v8.dev/blog/elements-kinds)

### Testing
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [fast-check Documentation](https://github.com/dubzzz/fast-check)
- [MSW Documentation](https://mswjs.io/docs/)

### Async Patterns
- [Promise Anti-patterns](https://github.com/petkaantonov/bluebird/wiki/Promise-anti-patterns)
- [AbortController](https://developer.mozilla.org/en-US/docs/Web/API/AbortController)

## Contributing

This skill is designed to be prescriptive and opinionated, based on production experience and measurable performance data. All rules are backed by:
- Real-world usage
- Performance benchmarks
- Industry best practices
- V8 engine behavior

## License

This skill documentation is part of the Claude Code skills library.
