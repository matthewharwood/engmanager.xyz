# JavaScript Pragmatic Rules - Quick Reference

Condensed reference for all 30 rules with code examples.

## Async Operations (1-4)

### 1. Handle Promise Rejections
```javascript
// ✅ Always handle
try {
  const result = await fetchData();
} catch (error) {
  console.error('Failed:', error);
}

// ✅ Global handler
window.addEventListener('unhandledrejection', (e) => {
  console.error('Unhandled:', e.reason);
  e.preventDefault();
});
```

### 2. Timeout Async Operations
```javascript
// ✅ With AbortController
const controller = new AbortController();
setTimeout(() => controller.abort(), 5_000);

const response = await fetch(url, { signal: controller.signal });
```

### 3. Limit Concurrency
```javascript
// ✅ Process in batches
async function processInBatches(items, batchSize, processor) {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await Promise.all(batch.map(processor));
  }
}
```

### 4. Clean Up Resources
```javascript
// ✅ React cleanup
useEffect(() => {
  const id = setInterval(() => {}, 1_000);
  return () => clearInterval(id);
}, []);

// ✅ Web Component cleanup
disconnectedCallback() {
  this.removeEventListener('click', this);
  clearInterval(this.intervalId);
}
```

---

## Object Design (4a-7)

### 4a. Initialize All Properties
```javascript
// ✅ Stable hidden class
class User {
  #name;
  #email = null;
  #age = null;
  #role = 'user';

  constructor(name) {
    this.#name = name;
  }

  get name() {
    return this.#name;
  }

  get email() {
    return this.#email;
  }

  get age() {
    return this.#age;
  }

  get role() {
    return this.#role;
  }
}
```

### 5. Prefer Immutability
```javascript
// ✅ Create new objects
const newState = {
  ...state,
  items: [...state.items, newItem]
};

// ✅ Immutable update
const updated = state.users.map(u =>
  u.id === id ? { ...u, active: true } : u
);
```

### 6. Design for Cancellation
```javascript
// ✅ Cancellable operation
useEffect(() => {
  const controller = new AbortController();

  const fetchData = async () => {
    try {
      const response = await fetch(url, {
        signal: controller.signal,
      });
      const data = await response.json();
      setData(data);
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Fetch failed:', error);
      }
    }
  };

  fetchData();

  return () => controller.abort();
}, [url]);
```

### 7. Error Boundaries
```javascript
// ✅ React error boundary
class ErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    logError(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback />;
    }
    return this.props.children;
  }
}
```

---

## Error Handling (8-10)

### 8. Global Error Handlers
```javascript
// ✅ Setup on init
window.addEventListener('error', (e) => {
  console.error('Error:', e.message, e.filename, e.lineno);
  sendToMonitoring(e);
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('Unhandled Promise:', e.reason);
  sendToMonitoring(e.reason);
});
```

### 9. Small Module Interfaces
```javascript
// ✅ Focused module (1-3 exports)
export class UserRepository {
  async findById(id) { /* ... */ }
  async save(user) { /* ... */ }
  async delete(id) { /* ... */ }
}

// ❌ Kitchen sink module
// export { fn1, fn2, fn3, fn4, fn5, fn6, fn7, fn8, fn9, fn10 };
```

### 10. Map Errors to User Messages
```javascript
// ✅ User-friendly mapping
const errorMessages = {
  'NETWORK_ERROR': 'Please check your internet connection',
  'UNAUTHORIZED': 'Please sign in again',
  'NOT_FOUND': 'The item could not be found'
};

function showError(errorCode) {
  const message = errorMessages[errorCode] || 'An error occurred';
  toast.error(message);
}
```

---

## Logging & Testing (11-15)

### 11. Structured Logging
```javascript
// ✅ JSON logs with context
logger.info('User logged in', {
  userId: 123,
  timestamp: Date.now(),
  ipAddress: req.ip,
  userAgent: req.headers['user-agent']
});
```

### 12. Table-Driven Tests
```javascript
// ✅ Jest test.each
test.each([
  [0, 0, 0],
  [1, 1, 2],
  [5, 3, 8],
  [-1, 1, 0]
])('add(%i, %i) = %i', (a, b, expected) => {
  expect(add(a, b)).toBe(expected);
});
```

### 13. Mock with MSW
```javascript
// ✅ Network-level mocking
import { rest } from 'msw.js';

export const handlers = [
  rest.get('/api/users/:id', (req, res, ctx) => {
    return res(
      ctx.json({ id: req.params.id, name: 'Test' })
    );
  }),
];
```

### 14. Property-Based Tests
```javascript
// ✅ fast-check
import fc from 'fast-check.js';

test('reverse is self-inverse', () => {
  fc.assert(
    fc.property(fc.string(), (str) => {
      const reversed = reverse(reverse(str));
      expect(reversed).toBe(str);
    })
  );
});
```

### 15. Debounce/Throttle
```javascript
// ✅ Debounce
const debounce = (fn, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
};

const debouncedSearch = debounce(search, 300);
```

---

## Performance (16-22)

### 16. Profile First
```javascript
// ✅ Performance API
const start = performance.now();
expensiveOperation();
const end = performance.now();
console.log(`Took ${end - start}ms`);

// ✅ React Profiler
<Profiler id="App" onRender={onRender}>
  <App />
</Profiler>
```

### 17. Cleanup Memory Leaks
```javascript
// ✅ useEffect cleanup
useEffect(() => {
  const subscription = observable.subscribe(handler);
  return () => subscription.unsubscribe();
}, []);

// ✅ Custom element cleanup
disconnectedCallback() {
  this.observer?.disconnect();
  clearInterval(this.intervalId);
  this.removeEventListener('click', this);
}
```

### 18. Web Workers for CPU Work
```javascript
// ✅ Offload to worker
const worker = new Worker('worker.js');
worker.postMessage({ data: largeDataset });
worker.onmessage = (e) => {
  displayResults(e.data);
};
```

### 19. Avoid Deoptimization
```javascript
// ❌ Triggers deopt
delete obj.prop;
function bad() { console.log(arguments); }
eval(code);
with (obj) { }

// ✅ Optimization-friendly
obj.prop = undefined;
function good(...args) { console.log(args); }
new Function(code)();
const { value } = obj;
```

### 20. requestAnimationFrame
```javascript
// ✅ Smooth animation
function animate() {
  updatePosition();
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

// ❌ Janky
setInterval(updatePosition, 16);
```

### 21. Consistent Array Types
```javascript
// ✅ PACKED_SMI (fastest)
const numbers = [1, 2, 3, 4, 5];

// ✅ PACKED_DOUBLE
const doubles = [1.5, 2.7, 3.14];

// ❌ Mixed types (slow)
const mixed = [1, 'two', {}];

// ❌ Holes (slow)
const holey = [1, 2, , 4];
```

### 22. Typed Arrays for Math
```javascript
// ✅ Fast numeric operations
const buffer = new Float64Array(1_000);
for (let i = 0; i < buffer.length; i++) {
  buffer[i] = Math.sin(i);
}

// ✅ Image processing
const pixels = new Uint8ClampedArray(width * height * 4);
```

---

## V8 Optimization (22a-27)

### 22a. Profile V8
```javascript
// ✅ Chrome DevTools Performance Profiler
// 1. Open DevTools -> Performance tab
// 2. Click Record
// 3. Run your hot path code
// 4. Stop recording
// 5. Analyze flame graph for optimization opportunities

// ✅ Use Performance API for timing
const start = performance.now();
for (let i = 0; i < 100_000; i++) {
  hotFunction();
}
const end = performance.now();
console.log(`Hot path: ${end - start}ms`);
```

### 23. Array Type Consistency
```javascript
// ✅ Same types (PACKED_SMI)
const ids = [1, 2, 3, 4, 5];

// ✅ Pre-fill (no holes)
const arr = new Array(100).fill(0);

// ❌ Mixed (PACKED_ELEMENTS)
const mixed = [1, 'two', {}];
```

### 24. Monomorphic Call Sites
```javascript
// ✅ Single type
const getPointValue = (point) => {
  return point.value; // Always Point
};

class Point {
  #value;

  constructor(value) {
    this.#value = value;
  }

  get value() {
    return this.#value;
  }
}

// All points have same shape
const points = [new Point(1), new Point(2)];
```

### 25. Avoid Shape Transitions
```javascript
// ✅ Initialize all properties
class Entity {
  #type;
  #x = 0;
  #y = 0;
  #health = 0;

  constructor(type) {
    this.#type = type;
  }

  get type() {
    return this.#type;
  }

  get x() {
    return this.#x;
  }

  get y() {
    return this.#y;
  }

  get health() {
    return this.#health;
  }
}

// ❌ Adding properties later would require redesign with private fields
// With private fields, you cannot dynamically add properties
```

### 26. Monomorphic Over Polymorphic
```javascript
// ✅ Type-specific functions
const processNumbers = (nums) => {
  return nums.map((n) => n * 2);
};

const processStrings = (strs) => {
  return strs.map((s) => s.toUpperCase());
};

// ❌ Polymorphic
const process = (items) => {
  return items.map((x) => transform(x));
};
```

### 27. Typed Arrays
```javascript
// ✅ Physics simulation
class Particles {
  #positions;
  #velocities;

  constructor(count) {
    this.#positions = new Float64Array(count * 3);
    this.#velocities = new Float64Array(count * 3);
  }

  update(dt) {
    for (let i = 0; i < this.#positions.length; i++) {
      this.#positions[i] += this.#velocities[i] * dt;
    }
  }

  get positions() {
    return this.#positions;
  }

  get velocities() {
    return this.#velocities;
  }
}
```

---

## Priority Matrix

### Always Apply
- Rule 1: Handle rejections
- Rule 2: Timeout async
- Rule 4: Clean up
- Rule 4a: Init properties
- Rule 8: Global errors

### Hot Paths Only (>10k ops/sec)
- Rules 19-27: V8 optimization
- Rule 18: Web Workers
- Rule 21-22: Array optimization

### As Needed
- Rule 3: Concurrency limits
- Rule 5: Immutability
- Rule 6: Cancellation
- Rule 7: Error boundaries

---

## Cheat Sheet

### Async
```javascript
// Timeout
const controller = new AbortController();
setTimeout(() => controller.abort(), 5_000);

// Pool
const pool = new PromisePool(10);
await pool.run(() => fetch(url));

// Cleanup
return () => controller.abort();
```

### Objects
```javascript
// Init all
this.prop1 = value1;
this.prop2 = value2 || null;

// Immutable
const next = { ...state, updated: true };

// Cancel
const controller = new AbortController();
return () => controller.abort();
```

### Performance
```javascript
// Profile
const start = performance.now();
work();
console.log(performance.now() - start);

// Typed array
const buffer = new Float64Array(1_000);

// Monomorphic
class Point {
  #x;
  #y;

  constructor(x, y) {
    this.#x = x;
    this.#y = y;
  }

  get x() {
    return this.#x;
  }

  get y() {
    return this.#y;
  }
}
```

---

## Common Gotchas

### ❌ Don't
```javascript
delete obj.prop;              // Use obj.prop = undefined
function f() { arguments }    // Use rest params
eval(code);                   // Use Function()
with (obj) { }                // Use destructuring
const arr = [1, , 3];         // No holes
const mixed = [1, 'two'];     // Keep types consistent
```

### ✅ Do
```javascript
obj.prop = undefined;
const f = (...args) => { };
new Function(code)();
const { value } = obj;
const arr = [1, 0, 3];
const numbers = [1, 2, 3];
```

---

## Benchmarking Template

```javascript
// Warm up
for (let i = 0; i < 10_000; i++) {
  fn();
}

// Benchmark
const iterations = 1_000_000;
const start = performance.now();
for (let i = 0; i < iterations; i++) {
  fn();
}
const end = performance.now();

console.log(`${iterations} ops in ${end - start}ms`);
const opsPerSec = (iterations / (end - start)) * 1_000;
console.log(`${opsPerSec.toLocaleString()} ops/sec`);
```

---

## Further Reading

- **V8**: [v8.dev/blog](https://v8.dev/blog)
- **MDN**: [developer.mozilla.org](https://developer.mozilla.org)
- **Performance**: [web.dev/fast](https://web.dev/fast)
- **Testing**: [jestjs.io](https://jestjs.io)
