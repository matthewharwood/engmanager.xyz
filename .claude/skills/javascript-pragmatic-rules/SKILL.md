---
name: javascript-pragmatic-rules
description: 30 pragmatic rules for production JavaScript covering async operations, V8 optimization, memory management, testing, error handling, and performance. Use when writing JavaScript, optimizing performance, handling promises, or building production-grade applications. Includes promise rejection handling, V8 hidden classes, memory leak prevention, and structured testing patterns.
allowed-tools: Read, Write, Edit, Grep, Glob, Bash, WebFetch, WebSearch
---

# JavaScript Pragmatic Rules

A comprehensive guide to 30 battle-tested principles for production JavaScript, organized by category with deep analysis and real-world examples.

## Table of Contents

1. [Async Operations & Promises](#async-operations--promises) (Rules 1-4)
2. [Object Design & Immutability](#object-design--immutability) (Rules 4a-7)
3. [Error Handling & Resilience](#error-handling--resilience) (Rules 8-10)
4. [Logging & Observability](#logging--observability) (Rules 11-12)
5. [Testing Strategy](#testing-strategy) (Rules 13-15)
6. [Performance Optimization](#performance-optimization) (Rules 16-22)
7. [V8 Engine Optimization](#v8-engine-optimization) (Rules 22a-27)

---

## Async Operations & Promises

### Rule 1: Never Ignore Promise Rejections — Handle or Propagate with Context

**Why It Matters**: Unhandled promise rejections are silent failures that corrupt application state and make debugging impossible. They violate the principle of explicit error handling.

**The Problem**:
```javascript
// ❌ WRONG - Silent failure
async function fetchUserData(userId) {
  const response = await fetch(`/api/users/${userId}`);
  const data = await response.json();
  return data;
}

// If fetch fails, error is swallowed
fetchUserData(123); // Promise rejection goes unnoticed
```

**Best Practice**:
```javascript
// ✅ CORRECT - Explicit error handling with context
async function fetchUserData(userId) {
  try {
    const response = await fetch(`/api/users/${userId}`);

    if (!response.ok) {
      throw new Error(
        `Failed to fetch user ${userId}: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    // Add context before propagating
    error.context = { userId, timestamp: Date.now() };
    throw error;
  }
}

// At the call site - always handle
async function loadUserProfile(userId) {
  try {
    const result = await fetchUserData(userId);
    displayProfile(result.data);
  } catch (error) {
    console.error('Profile load failed:', error.context, error.message);
    showErrorToUser('Unable to load profile. Please try again.');
  }
}
```

**Global Safety Net**:
```javascript
// Install global handlers for unhandled rejections
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', {
      reason: event.reason,
      promise: event.promise
    });

    // Log to monitoring service
    logToSentry({
      level: 'error',
      message: 'Unhandled Promise Rejection',
      extra: { reason: event.reason }
    });

    // Prevent default to avoid console noise
    event.preventDefault();
  });
}

// Node.js
if (typeof process !== 'undefined') {
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Don't exit in production, log and continue
  });
}
```

**Pattern: Result Type**:
```javascript
// Type-safe error handling without exceptions
async function safeUserFetch(userId) {
  try {
    const response = await fetch(`/api/users/${userId}`);
    if (!response.ok) {
      return {
        ok: false,
        error: `HTTP ${response.status}: ${response.statusText}`
      };
    }
    const data = await response.json();
    return { ok: true, value: data };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

// Usage - forced to check result
const result = await safeUserFetch(123);
if (result.ok) {
  console.log('User:', result.value);
} else {
  console.error('Failed:', result.error);
}
```

---

### Rule 2: Time-Bound All Async Operations — Promise.race with Timeout

**Why It Matters**: Network requests, database queries, and external APIs can hang indefinitely. Timeouts prevent resource exhaustion and provide predictable failure modes.

**The Problem**:
```javascript
// ❌ WRONG - Can hang forever
async function fetchData(url) {
  const response = await fetch(url);
  return response.json();
}
```

**Best Practice - Timeout Wrapper**:
```javascript
// ✅ CORRECT - Timeout utility
function withTimeout(promise, timeoutMs, errorMessage) {
  let timeoutId;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(errorMessage || `Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise])
    .finally(() => clearTimeout(timeoutId));
}

// Usage
async function fetchData(url) {
  try {
    const response = await withTimeout(
      fetch(url),
      5000,
      `Fetch to ${url} timed out after 5s`
    );
    return await response.json();
  } catch (error) {
    if (error.message.includes('timed out')) {
      console.error('Timeout error:', error);
      // Handle timeout specifically
    }
    throw error;
  }
}
```

**Best Practice - AbortController (Modern)**:
```javascript
// ✅ CORRECT - Using AbortController for cancellable fetch
async function fetchWithTimeout(url, timeoutMs = 5000) {
  const controller = new AbortController();
  const { signal } = controller;

  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);

    if (error.name === 'AbortError') {
      throw new Error(`Request to ${url} timed out after ${timeoutMs}ms`);
    }
    throw error;
  }
}
```

**Pattern: Configurable Timeout with Retry**:
```javascript
// ✅ ADVANCED - Timeout with exponential backoff retry
async function fetchWithRetry(url, options = {}) {
  const {
    timeout = 5000,
    maxRetries = 3,
    retryDelay = 1000,
    retryOn = [408, 429, 500, 502, 503, 504]
  } = options;

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (response.ok) {
        return await response.json();
      }

      // Check if should retry
      if (!retryOn.includes(response.status)) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      clearTimeout(timeoutId);
      lastError = error;

      if (error.name === 'AbortError') {
        lastError = new Error(`Timeout after ${timeout}ms`);
      }
    }

    // Wait before retry (exponential backoff)
    if (attempt < maxRetries) {
      const delay = retryDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error(`Failed after ${maxRetries} retries: ${lastError.message}`);
}
```

**Real-World Example - API Client**:
```javascript
class APIClient {
  constructor(baseURL, defaultTimeout = 10000) {
    this.baseURL = baseURL;
    this.defaultTimeout = defaultTimeout;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const timeout = options.timeout || this.defaultTimeout;

    return withTimeout(
      fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      }),
      timeout,
      `API request to ${endpoint} timed out`
    );
  }
}

const api = new APIClient('https://api.example.com', 5000);
const data = await api.request('/users/123');
```

---

### Rule 3: Limit Concurrent Operations — p-limit, Promise Pools

**Why It Matters**: Unbounded concurrency exhausts file descriptors, memory, API rate limits, and database connections. Controlled concurrency prevents cascading failures.

**The Problem**:
```javascript
// ❌ WRONG - Launches 10,000 concurrent requests
async function processAllUsers(userIds) {
  const promises = userIds.map(id => fetch(`/api/users/${id}`));
  return await Promise.all(promises); // Memory spike, connection exhaustion
}
```

**Best Practice - Manual Concurrency Control**:
```javascript
// ✅ CORRECT - Batch processing with concurrency limit
async function processInBatches(items, batchSize, processor) {
  const results = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(item => processor(item))
    );
    results.push(...batchResults);
  }

  return results;
}

// Usage
async function processAllUsers(userIds) {
  return await processInBatches(
    userIds,
    10, // Process 10 at a time
    async (id) => {
      const response = await fetch(`/api/users/${id}`);
      return response.json();
    }
  );
}
```

**Best Practice - p-limit Pattern (No Dependencies)**:
```javascript
// ✅ CORRECT - Promise pool with semaphore
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

// Usage
async function processAllUsers(userIds) {
  const pool = new PromisePool(10); // Max 10 concurrent

  const promises = userIds.map(id =>
    pool.run(async () => {
      const response = await fetch(`/api/users/${id}`);
      return response.json();
    })
  );

  return await Promise.all(promises);
}
```

**Advanced Pattern - Rate Limiting**:
```javascript
// ✅ ADVANCED - Rate limiter with token bucket
class RateLimiter {
  constructor(tokensPerSecond, burstSize = tokensPerSecond) {
    this.tokensPerSecond = tokensPerSecond;
    this.tokens = burstSize;
    this.maxTokens = burstSize;
    this.lastRefill = Date.now();
    this.queue = [];
  }

  refill() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    const tokensToAdd = elapsed * this.tokensPerSecond;

    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  async acquire() {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }

    // Wait for next token
    const timeToWait = (1 - this.tokens) / this.tokensPerSecond * 1000;
    await new Promise(resolve => setTimeout(resolve, timeToWait));

    this.refill();
    this.tokens -= 1;
  }

  async run(fn) {
    await this.acquire();
    return fn();
  }
}

// Usage - Respect API rate limits
const limiter = new RateLimiter(10); // 10 requests per second

async function fetchUser(id) {
  return limiter.run(async () => {
    const response = await fetch(`/api/users/${id}`);
    return response.json();
  });
}
```

**Real-World Example - File Processing**:
```javascript
// ✅ PRODUCTION - Process files with concurrency + progress
async function processFiles(filePaths, options = {}) {
  const {
    concurrency = 5,
    onProgress = () => {},
    onError = (err) => console.error(err)
  } = options;

  const pool = new PromisePool(concurrency);
  const results = [];
  let completed = 0;

  const promises = filePaths.map((path, index) =>
    pool.run(async () => {
      try {
        const result = await processFile(path);
        completed++;
        onProgress({ completed, total: filePaths.length, path });
        return { success: true, path, result };
      } catch (error) {
        onError(error, path);
        return { success: false, path, error: error.message };
      }
    })
  );

  return await Promise.all(promises);
}

// Usage
const results = await processFiles(
  ['file1.txt', 'file2.txt', /* ... */],
  {
    concurrency: 10,
    onProgress: ({ completed, total }) => {
      console.log(`Progress: ${completed}/${total}`);
    }
  }
);
```

---

### Rule 4: No Orphaned Timers/Listeners — Clear Timeouts, Remove Listeners

**Why It Matters**: Orphaned resources cause memory leaks, duplicate event handlers, and unexpected behavior. Proper cleanup is essential for long-running applications.

**The Problem**:
```javascript
// ❌ WRONG - Memory leak in React component
function Timer() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    setInterval(() => {
      setCount(c => c + 1);
    }, 1000);
    // Missing cleanup - interval continues after unmount
  }, []);

  return <div>{count}</div>;
}
```

**Best Practice - React Cleanup**:
```javascript
// ✅ CORRECT - Proper cleanup in useEffect
function Timer() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setCount(c => c + 1);
    }, 1000);

    // Cleanup function
    return () => clearInterval(intervalId);
  }, []);

  return <div>{count}</div>;
}
```

**Best Practice - Event Listeners**:
```javascript
// ✅ CORRECT - Remove event listeners
class EventManager {
  constructor() {
    this.listeners = new Map();
  }

  addEventListener(element, event, handler, options) {
    element.addEventListener(event, handler, options);

    // Track for cleanup
    if (!this.listeners.has(element)) {
      this.listeners.set(element, []);
    }
    this.listeners.get(element).push({ event, handler, options });
  }

  removeAllListeners(element) {
    const handlers = this.listeners.get(element);
    if (!handlers) return;

    handlers.forEach(({ event, handler, options }) => {
      element.removeEventListener(event, handler, options);
    });

    this.listeners.delete(element);
  }

  destroy() {
    for (const [element] of this.listeners) {
      this.removeAllListeners(element);
    }
  }
}

// Usage
const manager = new EventManager();
manager.addEventListener(button, 'click', handleClick);
// Later...
manager.destroy(); // Cleanup all
```

**Pattern: Cleanup Registry**:
```javascript
// ✅ ADVANCED - Automatic cleanup tracking
class CleanupRegistry {
  constructor() {
    this.cleanups = [];
  }

  registerTimeout(callback, delay) {
    const id = setTimeout(callback, delay);
    this.cleanups.push(() => clearTimeout(id));
    return id;
  }

  registerInterval(callback, delay) {
    const id = setInterval(callback, delay);
    this.cleanups.push(() => clearInterval(id));
    return id;
  }

  registerListener(element, event, handler, options) {
    element.addEventListener(event, handler, options);
    this.cleanups.push(() =>
      element.removeEventListener(event, handler, options)
    );
  }

  registerCleanup(fn) {
    this.cleanups.push(fn);
  }

  cleanup() {
    this.cleanups.forEach(fn => fn());
    this.cleanups = [];
  }
}

// Usage in component
class MyComponent {
  constructor() {
    this.cleanup = new CleanupRegistry();
  }

  mount() {
    // Auto-tracked timeout
    this.cleanup.registerTimeout(() => {
      console.log('Delayed action');
    }, 1000);

    // Auto-tracked listener
    this.cleanup.registerListener(
      window,
      'resize',
      this.handleResize
    );

    // Custom cleanup
    const subscription = observable.subscribe(this.handleData);
    this.cleanup.registerCleanup(() => subscription.unsubscribe());
  }

  unmount() {
    this.cleanup.cleanup(); // Cleanup everything
  }
}
```

**Real-World Example - Polling**:
```javascript
// ✅ PRODUCTION - Cancellable polling with cleanup
class Poller {
  constructor(fn, interval, options = {}) {
    this.fn = fn;
    this.interval = interval;
    this.immediate = options.immediate ?? true;
    this.onError = options.onError || console.error;
    this.timeoutId = null;
    this.isActive = false;
  }

  async poll() {
    if (!this.isActive) return;

    try {
      await this.fn();
    } catch (error) {
      this.onError(error);
    }

    if (this.isActive) {
      this.timeoutId = setTimeout(() => this.poll(), this.interval);
    }
  }

  start() {
    if (this.isActive) return;

    this.isActive = true;

    if (this.immediate) {
      this.poll();
    } else {
      this.timeoutId = setTimeout(() => this.poll(), this.interval);
    }
  }

  stop() {
    this.isActive = false;
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}

// Usage
const poller = new Poller(
  async () => {
    const status = await fetch('/api/status').then(r => r.json());
    updateUI(status);
  },
  5000,
  { immediate: true }
);

poller.start();
// Later...
poller.stop(); // Clean shutdown
```

---

## Object Design & Immutability

### Rule 4a: Consistent Object Shapes — Initialize All Properties in Constructors for V8 Hidden Classes

**Why It Matters**: V8 creates "hidden classes" (shapes) for objects. Adding properties dynamically causes shape transitions, deoptimizing property access from fast ICs (inline caches) to slow dictionary mode.

**The Problem**:
```javascript
// ❌ WRONG - Dynamic property addition causes shape transitions
class User {
  constructor(name) {
    this.name = name;
    // Shape 1: {name}
  }

  setEmail(email) {
    this.email = email; // Shape transition to {name, email}
  }

  setAge(age) {
    this.age = age; // Shape transition to {name, email, age}
  }
}

// Each instance has different shape timeline
const user1 = new User('Alice');
user1.setEmail('alice@example.com'); // Transition 1→2

const user2 = new User('Bob');
user2.setAge(30);                    // Transition 1→3 (different shape!)
user2.setEmail('bob@example.com');   // Transition 3→4

// Now user1 and user2 have different shapes, preventing optimization
```

**Best Practice**:
```javascript
// ✅ CORRECT - Initialize all properties upfront
class User {
  constructor(name, email = null, age = null) {
    // All properties defined immediately
    this.name = name;
    this.email = email;
    this.age = age;
    // Shape is stable: {name, email, age}
  }

  setEmail(email) {
    this.email = email; // No shape transition, just value change
  }

  setAge(age) {
    this.age = age; // No shape transition
  }
}

// All instances share the same hidden class
const user1 = new User('Alice');
const user2 = new User('Bob');
// Both have identical shape, enabling IC optimization
```

**Pattern: Factory with Complete Initialization**:
```javascript
// ✅ CORRECT - Factory ensures consistent shapes
function createPoint(x = 0, y = 0, z = 0) {
  return { x, y, z }; // All properties initialized
}

// All points have identical shape
const p1 = createPoint(1, 2, 3);
const p2 = createPoint(5);        // {x: 5, y: 0, z: 0}

// Array of monomorphic objects - very fast
const points = Array.from({ length: 1000 }, (_, i) =>
  createPoint(i, i * 2, i * 3)
);

// Optimized loop - V8 knows exact shape
let sum = 0;
for (const point of points) {
  sum += point.x + point.y + point.z; // Fast property access
}
```

**Real-World Example - Data Models**:
```javascript
// ✅ PRODUCTION - Consistent model shape
class Product {
  constructor(data = {}) {
    // Initialize ALL properties, even if null
    this.id = data.id ?? null;
    this.name = data.name ?? '';
    this.price = data.price ?? 0;
    this.description = data.description ?? '';
    this.category = data.category ?? '';
    this.inStock = data.inStock ?? false;
    this.tags = data.tags ?? [];
    this.createdAt = data.createdAt ?? Date.now();
    this.updatedAt = data.updatedAt ?? Date.now();
  }

  update(changes) {
    // Only modify existing properties
    Object.keys(changes).forEach(key => {
      if (this.hasOwnProperty(key)) {
        this[key] = changes[key];
      }
    });
    this.updatedAt = Date.now();
  }
}

// All Product instances share the same optimized shape
const products = apiData.map(data => new Product(data));
```

**Performance Benchmark**:
```javascript
// Demonstrate shape consistency impact
function benchmarkShapeConsistency() {
  // Inconsistent shapes
  const inconsistent = [];
  for (let i = 0; i < 10000; i++) {
    const obj = { x: i };
    if (i % 2 === 0) obj.y = i * 2;      // Half have 'y'
    if (i % 3 === 0) obj.z = i * 3;      // Third have 'z'
    inconsistent.push(obj);
  }

  // Consistent shapes
  const consistent = [];
  for (let i = 0; i < 10000; i++) {
    consistent.push({
      x: i,
      y: i % 2 === 0 ? i * 2 : null,
      z: i % 3 === 0 ? i * 3 : null
    });
  }

  // Benchmark property access
  console.time('Inconsistent');
  let sum1 = 0;
  for (const obj of inconsistent) {
    sum1 += obj.x + (obj.y || 0) + (obj.z || 0);
  }
  console.timeEnd('Inconsistent'); // ~2-3x slower

  console.time('Consistent');
  let sum2 = 0;
  for (const obj of consistent) {
    sum2 += obj.x + (obj.y || 0) + (obj.z || 0);
  }
  console.timeEnd('Consistent'); // Faster due to IC optimization
}
```

---

### Rule 5: Prefer Immutability — Spread Operators, Immer for Complex Updates

**Why It Matters**: Immutability prevents bugs from shared mutable state, enables time-travel debugging, optimizes React reconciliation, and makes code predictable and testable.

**The Problem**:
```javascript
// ❌ WRONG - Mutation causes bugs
function addItemToCart(cart, item) {
  cart.items.push(item);              // Mutates original!
  cart.total += item.price;           // Side effect
  return cart;                        // Returns same reference
}

const myCart = { items: [], total: 0 };
const updatedCart = addItemToCart(myCart, { id: 1, price: 10 });

console.log(myCart === updatedCart);  // true - same object!
console.log(myCart.total);            // 10 - original mutated
```

**Best Practice - Shallow Immutability**:
```javascript
// ✅ CORRECT - Create new objects
function addItemToCart(cart, item) {
  return {
    ...cart,
    items: [...cart.items, item],
    total: cart.total + item.price
  };
}

const myCart = { items: [], total: 0 };
const updatedCart = addItemToCart(myCart, { id: 1, price: 10 });

console.log(myCart === updatedCart);  // false - new object
console.log(myCart.total);            // 0 - original unchanged
```

**Best Practice - Deep Updates**:
```javascript
// ✅ CORRECT - Immutable deep update
function updateUserAddress(user, newAddress) {
  return {
    ...user,
    profile: {
      ...user.profile,
      address: {
        ...user.profile.address,
        ...newAddress
      }
    }
  };
}

const user = {
  id: 1,
  name: 'Alice',
  profile: {
    email: 'alice@example.com',
    address: {
      street: '123 Main St',
      city: 'Portland',
      zip: '97201'
    }
  }
};

const updated = updateUserAddress(user, { city: 'Seattle', zip: '98101' });
// user.profile.address unchanged
// updated.profile.address has new city and zip
```

**Pattern: Immer-Style Producer (No Dependencies)**:
```javascript
// ✅ ADVANCED - Immer-like immutable updates
function produce(baseState, recipe) {
  // Simple implementation of structural sharing
  const draft = JSON.parse(JSON.stringify(baseState));
  recipe(draft);
  return draft;
}

// Usage
const state = {
  users: [
    { id: 1, name: 'Alice', active: true },
    { id: 2, name: 'Bob', active: false }
  ],
  settings: { theme: 'dark' }
};

const newState = produce(state, draft => {
  // Mutate draft freely
  draft.users[0].active = false;
  draft.users.push({ id: 3, name: 'Charlie', active: true });
  draft.settings.theme = 'light';
});

// Original unchanged
console.log(state.users.length);        // 2
console.log(state.settings.theme);      // 'dark'

// New state updated
console.log(newState.users.length);     // 3
console.log(newState.settings.theme);   // 'light'
```

**Real-World Example - Redux Reducer**:
```javascript
// ✅ PRODUCTION - Immutable state updates
const initialState = {
  todos: [],
  filter: 'all',
  loading: false
};

function todosReducer(state = initialState, action) {
  switch (action.type) {
    case 'ADD_TODO':
      return {
        ...state,
        todos: [...state.todos, {
          id: Date.now(),
          text: action.text,
          completed: false
        }]
      };

    case 'TOGGLE_TODO':
      return {
        ...state,
        todos: state.todos.map(todo =>
          todo.id === action.id
            ? { ...todo, completed: !todo.completed }
            : todo
        )
      };

    case 'DELETE_TODO':
      return {
        ...state,
        todos: state.todos.filter(todo => todo.id !== action.id)
      };

    case 'SET_FILTER':
      return {
        ...state,
        filter: action.filter
      };

    default:
      return state;
  }
}
```

**Pattern: Immutable Array Operations**:
```javascript
// ✅ CORRECT - Immutable array helpers
const ImmutableArray = {
  // Add item
  append: (arr, item) => [...arr, item],

  // Add item at start
  prepend: (arr, item) => [item, ...arr],

  // Update by index
  updateAt: (arr, index, value) => [
    ...arr.slice(0, index),
    value,
    ...arr.slice(index + 1)
  ],

  // Update by predicate
  updateWhere: (arr, predicate, updater) =>
    arr.map(item => predicate(item) ? updater(item) : item),

  // Remove by index
  removeAt: (arr, index) => [
    ...arr.slice(0, index),
    ...arr.slice(index + 1)
  ],

  // Remove by predicate
  removeWhere: (arr, predicate) =>
    arr.filter(item => !predicate(item)),

  // Insert at index
  insertAt: (arr, index, item) => [
    ...arr.slice(0, index),
    item,
    ...arr.slice(index)
  ]
};

// Usage
let numbers = [1, 2, 3, 4, 5];
numbers = ImmutableArray.updateAt(numbers, 2, 99);   // [1, 2, 99, 4, 5]
numbers = ImmutableArray.removeWhere(numbers, n => n < 3); // [99, 4, 5]
numbers = ImmutableArray.insertAt(numbers, 1, 50);   // [99, 50, 4, 5]
```

---

### Rule 6: Design for Cancellation — AbortController for Fetch, Async Operations

**Why It Matters**: Users navigate away, components unmount, and requirements change. Cancellation prevents wasted work, race conditions, and memory leaks from completed-but-obsolete requests.

**The Problem**:
```javascript
// ❌ WRONG - No cancellation, causes race conditions
function SearchComponent() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);

  useEffect(() => {
    async function search() {
      const response = await fetch(`/api/search?q=${query}`);
      const data = await response.json();
      setResults(data); // May set stale results if query changed!
    }

    if (query) search();
  }, [query]);

  // Race condition: Fast typing causes responses to arrive out of order
  // "a" -> "ab" -> "abc" might resolve as "abc" -> "a" -> "ab"
}
```

**Best Practice - AbortController**:
```javascript
// ✅ CORRECT - Cancellable fetch
function SearchComponent() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    async function search() {
      try {
        const response = await fetch(`/api/search?q=${query}`, { signal });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        setResults(data); // Only sets if not aborted
      } catch (error) {
        if (error.name === 'AbortError') {
          console.log('Search cancelled');
          return; // Ignore cancellation
        }
        console.error('Search failed:', error);
      }
    }

    if (query) search();

    // Cleanup: Cancel previous request when query changes
    return () => controller.abort();
  }, [query]);

  return (
    <div>
      <input value={query} onChange={(e) => setQuery(e.target.value)} />
      <ul>
        {results.map(result => <li key={result.id}>{result.name}</li>)}
      </ul>
    </div>
  );
}
```

**Pattern: Cancellable Promise**:
```javascript
// ✅ ADVANCED - Generic cancellable async function
function makeCancellable(asyncFn) {
  let cancelled = false;
  const controller = new AbortController();

  const promise = (async () => {
    try {
      const result = await asyncFn(controller.signal);
      if (cancelled) {
        throw new Error('Cancelled');
      }
      return result;
    } catch (error) {
      if (cancelled || error.name === 'AbortError') {
        throw new Error('Cancelled');
      }
      throw error;
    }
  })();

  return {
    promise,
    cancel: () => {
      cancelled = true;
      controller.abort();
    }
  };
}

// Usage
const { promise, cancel } = makeCancellable(async (signal) => {
  const response = await fetch('/api/data', { signal });
  return response.json();
});

// Later...
cancel(); // Abort the request
```

**Real-World Example - Long-Running Task**:
```javascript
// ✅ PRODUCTION - Cancellable data processing
class DataProcessor {
  constructor() {
    this.currentOperation = null;
  }

  async process(data, onProgress) {
    // Cancel previous operation
    if (this.currentOperation) {
      this.currentOperation.cancel();
    }

    const controller = new AbortController();
    const { signal } = controller;

    this.currentOperation = { cancel: () => controller.abort() };

    try {
      const total = data.length;
      const results = [];

      for (let i = 0; i < total; i++) {
        // Check cancellation
        if (signal.aborted) {
          throw new Error('Processing cancelled');
        }

        const result = await this.processItem(data[i]);
        results.push(result);

        // Report progress
        if (onProgress) {
          onProgress({ completed: i + 1, total });
        }

        // Yield to event loop
        await new Promise(resolve => setTimeout(resolve, 0));
      }

      this.currentOperation = null;
      return results;
    } catch (error) {
      this.currentOperation = null;
      if (error.message === 'Processing cancelled') {
        console.log('Processing was cancelled');
        return null;
      }
      throw error;
    }
  }

  async processItem(item) {
    // Expensive operation
    await new Promise(resolve => setTimeout(resolve, 100));
    return item * 2;
  }

  cancel() {
    if (this.currentOperation) {
      this.currentOperation.cancel();
    }
  }
}

// Usage
const processor = new DataProcessor();

const result = await processor.process(
  Array.from({ length: 1000 }, (_, i) => i),
  ({ completed, total }) => {
    console.log(`Progress: ${completed}/${total}`);
  }
);

// User action triggers cancellation
processor.cancel();
```

**Pattern: Cancellation Token**:
```javascript
// ✅ ADVANCED - Cancellation token pattern
class CancellationToken {
  constructor() {
    this.cancelled = false;
    this.listeners = [];
  }

  cancel() {
    if (this.cancelled) return;
    this.cancelled = true;
    this.listeners.forEach(fn => fn());
  }

  onCancelled(callback) {
    if (this.cancelled) {
      callback();
      return () => {};
    }

    this.listeners.push(callback);
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index >= 0) this.listeners.splice(index, 1);
    };
  }

  throwIfCancelled() {
    if (this.cancelled) {
      throw new Error('Operation cancelled');
    }
  }
}

// Usage
async function longTask(token) {
  for (let i = 0; i < 1000; i++) {
    token.throwIfCancelled();
    await expensiveOperation(i);
  }
}

const token = new CancellationToken();
longTask(token).catch(err => console.log(err.message));

// Later...
token.cancel(); // Cancels the task
```

---

### Rule 7: Graceful Error Boundaries — React Error Boundaries, Fallback UI

**Why It Matters**: Unhandled errors in components crash the entire React tree. Error boundaries contain failures, preserve working UI, and provide recovery mechanisms.

**The Problem**:
```javascript
// ❌ WRONG - Error crashes entire app
function UserProfile({ userId }) {
  const user = useQuery(`/api/users/${userId}`);

  // If API fails, entire app shows blank screen
  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
    </div>
  );
}
```

**Best Practice - Error Boundary**:
```javascript
// ✅ CORRECT - Error boundary contains failures
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo });

    // Log to error tracking service
    console.error('Error caught by boundary:', error, errorInfo);

    // Report to Sentry, Bugsnag, etc.
    if (window.errorTracker) {
      window.errorTracker.captureException(error, {
        extra: { errorInfo }
      });
    }
  }

  resetError = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return this.props.fallback ? (
        this.props.fallback(this.state.error, this.resetError)
      ) : (
        <div role="alert">
          <h2>Something went wrong</h2>
          <details style={{ whiteSpace: 'pre-wrap' }}>
            {this.state.error && this.state.error.toString()}
            <br />
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </details>
          <button onClick={this.resetError}>Try again</button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Usage - Wrap risky components
function App() {
  return (
    <ErrorBoundary fallback={(error, reset) => (
      <div>
        <h1>Profile failed to load</h1>
        <p>{error.message}</p>
        <button onClick={reset}>Retry</button>
      </div>
    )}>
      <UserProfile userId={123} />
    </ErrorBoundary>
  );
}
```

**Pattern: Granular Error Boundaries**:
```javascript
// ✅ ADVANCED - Multiple boundaries for isolated failures
function Dashboard() {
  return (
    <div className="dashboard">
      <ErrorBoundary fallback={<HeaderError />}>
        <Header />
      </ErrorBoundary>

      <div className="content">
        <ErrorBoundary fallback={<SidebarError />}>
          <Sidebar />
        </ErrorBoundary>

        <main>
          <ErrorBoundary fallback={<ChartError />}>
            <SalesChart />
          </ErrorBoundary>

          <ErrorBoundary fallback={<TableError />}>
            <RecentOrders />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

// If SalesChart fails, only it shows error - rest of dashboard works
```

**Real-World Example - Async Error Handling**:
```javascript
// ✅ PRODUCTION - Combine error boundary with async error handling
function AsyncDataComponent({ url }) {
  const [state, setState] = useState({
    data: null,
    loading: true,
    error: null
  });

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (!cancelled) {
          setState({ data, loading: false, error: null });
        }
      } catch (error) {
        if (!cancelled) {
          setState({ data: null, loading: false, error });
        }
      }
    }

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [url]);

  if (state.loading) {
    return <LoadingSpinner />;
  }

  if (state.error) {
    // Controlled error - show inline
    return (
      <div className="error-message">
        <p>Failed to load data: {state.error.message}</p>
        <button onClick={() => setState(s => ({ ...s, loading: true }))}>
          Retry
        </button>
      </div>
    );
  }

  // If rendering data throws, error boundary catches it
  return <DataDisplay data={state.data} />;
}

// Wrap with boundary for unhandled errors
function App() {
  return (
    <ErrorBoundary>
      <AsyncDataComponent url="/api/dashboard" />
    </ErrorBoundary>
  );
}
```

---

## Error Handling & Resilience

### Rule 8: Zero Uncaught Exceptions — Global Error Handlers, window.onerror

**Why It Matters**: Uncaught exceptions crash the application, corrupt state, and provide no observability. Global handlers ensure all errors are logged and handled gracefully.

**Best Practice - Global Error Handlers**:
```javascript
// ✅ CORRECT - Comprehensive error handling setup
class GlobalErrorHandler {
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.onError = options.onError || (() => {});
    this.setupHandlers();
  }

  setupHandlers() {
    // Synchronous errors
    window.addEventListener('error', (event) => {
      this.handleError({
        type: 'error',
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error,
        timestamp: Date.now()
      });

      event.preventDefault();
    });

    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError({
        type: 'unhandledRejection',
        reason: event.reason,
        promise: event.promise,
        timestamp: Date.now()
      });

      event.preventDefault();
    });

    // Handled but re-rejected promises
    window.addEventListener('rejectionhandled', (event) => {
      this.logger.info('Promise rejection was handled:', event.promise);
    });
  }

  handleError(errorInfo) {
    // Log locally
    this.logger.error('Global error caught:', errorInfo);

    // Send to error tracking service
    this.reportToService(errorInfo);

    // Notify application
    this.onError(errorInfo);

    // Show user-friendly message
    this.showErrorToUser(errorInfo);
  }

  reportToService(errorInfo) {
    // Send to Sentry, Bugsnag, etc.
    if (window.errorTracker) {
      window.errorTracker.captureException(errorInfo.error || errorInfo.reason, {
        extra: errorInfo
      });
    }
  }

  showErrorToUser(errorInfo) {
    // Only show user-facing errors for critical failures
    if (this.isCritical(errorInfo)) {
      // Show toast notification or modal
      const message = this.getUserFriendlyMessage(errorInfo);
      this.showNotification(message);
    }
  }

  isCritical(errorInfo) {
    // Determine if error should be shown to user
    const criticalPatterns = [
      /network/i,
      /timeout/i,
      /server error/i
    ];

    const message = errorInfo.message || String(errorInfo.reason);
    return criticalPatterns.some(pattern => pattern.test(message));
  }

  getUserFriendlyMessage(errorInfo) {
    // Map technical errors to user-friendly messages
    const message = errorInfo.message || String(errorInfo.reason);

    if (/network/i.test(message)) {
      return 'Unable to connect to the server. Please check your internet connection.';
    }

    if (/timeout/i.test(message)) {
      return 'The request took too long. Please try again.';
    }

    return 'An unexpected error occurred. Our team has been notified.';
  }

  showNotification(message) {
    // Implementation depends on UI framework
    console.error('User notification:', message);
  }
}

// Initialize on app start
const errorHandler = new GlobalErrorHandler({
  logger: console,
  onError: (errorInfo) => {
    // App-specific error handling
    if (errorInfo.type === 'unhandledRejection') {
      // Handle promise rejections
    }
  }
});
```

**Real-World Example - React Integration**:
```javascript
// ✅ PRODUCTION - React error handling
function ErrorProvider({ children }) {
  const [globalError, setGlobalError] = useState(null);

  useEffect(() => {
    const handleError = (event) => {
      const error = event.error || event.reason;
      setGlobalError({
        message: error.message,
        stack: error.stack,
        timestamp: Date.now()
      });

      event.preventDefault();
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleError);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleError);
    };
  }, []);

  if (globalError) {
    return (
      <div className="global-error">
        <h1>Something went wrong</h1>
        <p>{globalError.message}</p>
        <button onClick={() => window.location.reload()}>
          Reload Page
        </button>
      </div>
    );
  }

  return children;
}
```

---

### Rule 9: Small Module Interfaces — 1-3 Exports, Clear Contracts

**Why It Matters**: Large interfaces couple consumers to implementation details, making refactoring difficult and testing complex. Small, focused modules are easier to understand, test, and maintain.

**The Problem**:
```javascript
// ❌ WRONG - Kitchen sink module
// userUtils.js
export function getUser(id) { /* ... */ }
export function createUser(data) { /* ... */ }
export function updateUser(id, data) { /* ... */ }
export function deleteUser(id) { /* ... */ }
export function validateEmail(email) { /* ... */ }
export function hashPassword(password) { /* ... */ }
export function generateToken(userId) { /* ... */ }
export function formatUserName(user) { /* ... */ }
export function isAdmin(user) { /* ... */ }
export function getUserPermissions(user) { /* ... */ }
// 10+ exports - unclear responsibilities
```

**Best Practice - Focused Modules**:
```javascript
// ✅ CORRECT - Single responsibility modules

// userRepository.js - Data access (1-3 exports)
export class UserRepository {
  async findById(id) { /* ... */ }
  async save(user) { /* ... */ }
  async delete(id) { /* ... */ }
}

// userValidator.js - Validation (1 export)
export function validateUser(user) {
  const errors = [];

  if (!user.email || !isValidEmail(user.email)) {
    errors.push('Invalid email');
  }

  if (!user.password || user.password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

// userFormatter.js - Presentation (2 exports)
export function formatUserName(user) {
  return `${user.firstName} ${user.lastName}`;
}

export function formatUserForDisplay(user) {
  return {
    displayName: formatUserName(user),
    role: user.role,
    memberSince: formatDate(user.createdAt)
  };
}

// userAuth.js - Authentication (1 export)
export class UserAuth {
  async hashPassword(password) { /* ... */ }
  async verifyPassword(password, hash) { /* ... */ }
  generateToken(userId) { /* ... */ }
}
```

**Pattern: Facade for Complex Subsystems**:
```javascript
// ✅ ADVANCED - Facade pattern for clean interface

// Internal modules (not exported)
class PaymentProcessor { /* ... */ }
class InventoryManager { /* ... */ }
class ShippingCalculator { /* ... */ }
class TaxCalculator { /* ... */ }

// Public facade (single export)
export class OrderService {
  constructor() {
    this.payment = new PaymentProcessor();
    this.inventory = new InventoryManager();
    this.shipping = new ShippingCalculator();
    this.tax = new TaxCalculator();
  }

  // Clean, high-level interface
  async createOrder(orderData) {
    // Coordinates internal modules
    const inventoryCheck = await this.inventory.reserve(orderData.items);
    if (!inventoryCheck.success) {
      throw new Error('Items not available');
    }

    const shippingCost = await this.shipping.calculate(orderData.address);
    const taxAmount = await this.tax.calculate(orderData.items, orderData.address);
    const total = orderData.subtotal + shippingCost + taxAmount;

    const payment = await this.payment.charge(orderData.paymentMethod, total);

    return {
      orderId: payment.orderId,
      total,
      shipping: shippingCost,
      tax: taxAmount
    };
  }
}

// Consumers only see simple interface
import { OrderService } from './orderService';

const orders = new OrderService();
const order = await orders.createOrder(orderData);
```

**Real-World Example - API Client**:
```javascript
// ✅ PRODUCTION - Minimal API client interface

// apiClient.js (2 exports)
class APIClient {
  constructor(baseURL, options = {}) {
    this.baseURL = baseURL;
    this.headers = options.headers || {};
    this.timeout = options.timeout || 10000;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...this.headers,
          ...options.headers
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  get(endpoint, options) {
    return this.request(endpoint, { ...options, method: 'GET' });
  }

  post(endpoint, data, options) {
    return this.request(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data)
    });
  }
}

export function createAPIClient(baseURL, options) {
  return new APIClient(baseURL, options);
}

// Usage - simple, focused interface
const api = createAPIClient('https://api.example.com');
const users = await api.get('/users');
```

---

### Rule 10: Map Errors to User Messages — Error Codes to Human-Readable Text

**Why It Matters**: Technical error messages confuse users and leak implementation details. User-friendly messages improve UX and reduce support load.

**Best Practice - Error Mapping**:
```javascript
// ✅ CORRECT - Map errors to user-friendly messages
class ErrorMapper {
  constructor() {
    this.errorMap = new Map([
      // Network errors
      ['NETWORK_ERROR', {
        title: 'Connection Problem',
        message: 'Unable to connect to the server. Please check your internet connection and try again.',
        action: 'Retry'
      }],
      ['TIMEOUT', {
        title: 'Request Timeout',
        message: 'The request took too long to complete. Please try again.',
        action: 'Retry'
      }],

      // Auth errors
      ['UNAUTHORIZED', {
        title: 'Sign In Required',
        message: 'Your session has expired. Please sign in again.',
        action: 'Sign In'
      }],
      ['FORBIDDEN', {
        title: 'Access Denied',
        message: 'You don\'t have permission to perform this action.',
        action: null
      }],

      // Validation errors
      ['VALIDATION_ERROR', {
        title: 'Invalid Input',
        message: 'Please check your input and try again.',
        action: 'Edit'
      }],
      ['DUPLICATE_ENTRY', {
        title: 'Already Exists',
        message: 'This item already exists. Please use a different value.',
        action: null
      }],

      // Server errors
      ['SERVER_ERROR', {
        title: 'Server Error',
        message: 'Something went wrong on our end. Our team has been notified.',
        action: 'Contact Support'
      }],
      ['NOT_FOUND', {
        title: 'Not Found',
        message: 'The requested resource could not be found.',
        action: 'Go Back'
      }]
    ]);
  }

  mapError(errorCode, context = {}) {
    const mapped = this.errorMap.get(errorCode);

    if (!mapped) {
      return {
        title: 'Unexpected Error',
        message: 'An unexpected error occurred. Please try again or contact support.',
        action: 'Retry'
      };
    }

    // Interpolate context into message
    let message = mapped.message;
    Object.keys(context).forEach(key => {
      message = message.replace(`{${key}}`, context[key]);
    });

    return {
      ...mapped,
      message
    };
  }

  fromHTTPStatus(status, context) {
    const statusMap = {
      400: 'VALIDATION_ERROR',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      408: 'TIMEOUT',
      409: 'DUPLICATE_ENTRY',
      429: 'RATE_LIMITED',
      500: 'SERVER_ERROR',
      502: 'SERVER_ERROR',
      503: 'SERVER_ERROR',
      504: 'TIMEOUT'
    };

    const errorCode = statusMap[status] || 'SERVER_ERROR';
    return this.mapError(errorCode, context);
  }
}

// Usage
const errorMapper = new ErrorMapper();

async function fetchUser(userId) {
  try {
    const response = await fetch(`/api/users/${userId}`);

    if (!response.ok) {
      const error = errorMapper.fromHTTPStatus(response.status, {
        resource: 'user',
        id: userId
      });
      throw new Error(JSON.stringify(error));
    }

    return await response.json();
  } catch (error) {
    const userError = JSON.parse(error.message);
    showErrorToUser(userError);
    throw error;
  }
}
```

**Real-World Example - Form Validation**:
```javascript
// ✅ PRODUCTION - User-friendly validation messages
const validationMessages = {
  required: (field) => `${field} is required`,
  email: (field) => `Please enter a valid email address`,
  minLength: (field, min) => `${field} must be at least ${min} characters`,
  maxLength: (field, max) => `${field} must be no more than ${max} characters`,
  pattern: (field, pattern) => `${field} format is invalid`,
  min: (field, min) => `${field} must be at least ${min}`,
  max: (field, max) => `${field} must be no more than ${max}`,
  match: (field, other) => `${field} must match ${other}`
};

function validateForm(formData, rules) {
  const errors = {};

  Object.keys(rules).forEach(field => {
    const value = formData[field];
    const fieldRules = rules[field];
    const fieldName = fieldRules.label || field;

    // Required
    if (fieldRules.required && !value) {
      errors[field] = validationMessages.required(fieldName);
      return;
    }

    if (!value) return; // Skip other validations if empty

    // Email
    if (fieldRules.email && !isValidEmail(value)) {
      errors[field] = validationMessages.email(fieldName);
      return;
    }

    // Min/max length
    if (fieldRules.minLength && value.length < fieldRules.minLength) {
      errors[field] = validationMessages.minLength(fieldName, fieldRules.minLength);
      return;
    }

    if (fieldRules.maxLength && value.length > fieldRules.maxLength) {
      errors[field] = validationMessages.maxLength(fieldName, fieldRules.maxLength);
      return;
    }

    // Pattern
    if (fieldRules.pattern && !fieldRules.pattern.test(value)) {
      errors[field] = validationMessages.pattern(fieldName);
      return;
    }
  });

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

// Usage
const formRules = {
  email: {
    label: 'Email',
    required: true,
    email: true
  },
  password: {
    label: 'Password',
    required: true,
    minLength: 8
  },
  name: {
    label: 'Full Name',
    required: true,
    minLength: 2,
    maxLength: 50
  }
};

const result = validateForm(formData, formRules);
if (!result.isValid) {
  // Show user-friendly messages
  Object.keys(result.errors).forEach(field => {
    showFieldError(field, result.errors[field]);
  });
}
```

---

## Logging & Observability

### Rule 11: Structured Logging — JSON Logs with Context

**Why It Matters**: Plain text logs are hard to query, aggregate, and analyze. Structured logs enable powerful filtering, metrics extraction, and debugging in production.

**Best Practice - Structured Logger**:
```javascript
// ✅ CORRECT - Structured logging with context
class Logger {
  constructor(options = {}) {
    this.serviceName = options.serviceName || 'app';
    this.environment = options.environment || 'development';
    this.minimumLevel = options.minimumLevel || 'info';
    this.levels = { debug: 0, info: 1, warn: 2, error: 3 };
  }

  log(level, message, context = {}) {
    if (this.levels[level] < this.levels[this.minimumLevel]) {
      return;
    }

    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.serviceName,
      environment: this.environment,
      message,
      ...context,
      // Add correlation ID if available
      correlationId: this.getCorrelationId(),
      // Add user context if available
      userId: this.getUserId(),
      // Add request context if available
      requestId: this.getRequestId()
    };

    // In production, send to logging service
    if (this.environment === 'production') {
      this.sendToLoggingService(logEntry);
    }

    // Also log to console
    console[level](JSON.stringify(logEntry));
  }

  debug(message, context) {
    this.log('debug', message, context);
  }

  info(message, context) {
    this.log('info', message, context);
  }

  warn(message, context) {
    this.log('warn', message, context);
  }

  error(message, error, context = {}) {
    this.log('error', message, {
      ...context,
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      }
    });
  }

  getCorrelationId() {
    // Implement correlation ID tracking
    return globalThis.correlationId || null;
  }

  getUserId() {
    // Get current user ID from auth context
    return globalThis.currentUserId || null;
  }

  getRequestId() {
    // Get request ID from headers or generate
    return globalThis.currentRequestId || null;
  }

  sendToLoggingService(logEntry) {
    // Send to DataDog, Splunk, ELK, etc.
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/logs', JSON.stringify(logEntry));
    }
  }
}

// Usage
const logger = new Logger({
  serviceName: 'user-service',
  environment: process.env.NODE_ENV,
  minimumLevel: 'info'
});

logger.info('User logged in', {
  userId: 123,
  ipAddress: '192.168.1.1',
  userAgent: navigator.userAgent
});

logger.error('Failed to fetch user data', error, {
  userId: 123,
  endpoint: '/api/users/123',
  duration: 5234
});
```

**Real-World Example - Performance Logging**:
```javascript
// ✅ PRODUCTION - Performance monitoring with structured logs
class PerformanceLogger extends Logger {
  startTimer(operation) {
    const timerId = `${operation}_${Date.now()}`;
    performance.mark(`${timerId}_start`);
    return timerId;
  }

  endTimer(timerId, operation, context = {}) {
    performance.mark(`${timerId}_end`);

    try {
      performance.measure(timerId, `${timerId}_start`, `${timerId}_end`);
      const measure = performance.getEntriesByName(timerId)[0];

      this.info('Operation completed', {
        operation,
        duration: measure.duration,
        ...context
      });

      // Clean up
      performance.clearMarks(`${timerId}_start`);
      performance.clearMarks(`${timerId}_end`);
      performance.clearMeasures(timerId);

      return measure.duration;
    } catch (error) {
      this.error('Failed to measure performance', error);
      return null;
    }
  }

  async measureAsync(operation, fn, context = {}) {
    const timerId = this.startTimer(operation);

    try {
      const result = await fn();
      this.endTimer(timerId, operation, { ...context, success: true });
      return result;
    } catch (error) {
      this.endTimer(timerId, operation, { ...context, success: false });
      throw error;
    }
  }
}

// Usage
const perfLogger = new PerformanceLogger({ serviceName: 'api' });

const users = await perfLogger.measureAsync(
  'fetch_users',
  async () => {
    const response = await fetch('/api/users');
    return response.json();
  },
  { endpoint: '/api/users' }
);
```

---

### Rule 12: Table-Driven Tests — Jest test.each for Comprehensive Coverage

**Why It Matters**: Repetitive test code is error-prone and hard to maintain. Table-driven tests make it easy to add cases, see patterns, and achieve comprehensive coverage.

**Best Practice - Jest test.each**:
```javascript
// ✅ CORRECT - Table-driven tests
describe('calculateDiscount', () => {
  test.each([
    // [price, quantity, expected, description]
    [100, 1, 0, 'No discount for single item'],
    [100, 5, 10, '10% discount for 5 items'],
    [100, 10, 20, '20% discount for 10 items'],
    [100, 20, 30, '30% discount for 20+ items'],
    [0, 10, 0, 'Zero price returns zero discount'],
    [100, 0, 0, 'Zero quantity returns zero discount'],
    [50, 15, 15, 'Discount applies to lower prices']
  ])('calculateDiscount(%i, %i) = %i: %s', (price, quantity, expected, description) => {
    expect(calculateDiscount(price, quantity)).toBe(expected);
  });
});

// ✅ CORRECT - Complex test cases
describe('validateEmail', () => {
  test.each([
    ['user@example.com', true],
    ['user.name@example.com', true],
    ['user+tag@example.co.uk', true],
    ['user_name@example-domain.com', true],
    ['', false],
    ['invalid', false],
    ['@example.com', false],
    ['user@', false],
    ['user @example.com', false],
    ['user@example', false]
  ])('validateEmail("%s") should return %s', (email, expected) => {
    expect(validateEmail(email)).toBe(expected);
  });
});
```

**Real-World Example - Complex Business Logic**:
```javascript
// ✅ PRODUCTION - Shipping calculation tests
describe('calculateShipping', () => {
  test.each([
    {
      weight: 1,
      distance: 100,
      express: false,
      expected: 5.00,
      description: 'Standard shipping, 1kg, 100km'
    },
    {
      weight: 5,
      distance: 100,
      express: false,
      expected: 10.00,
      description: 'Standard shipping, 5kg, 100km'
    },
    {
      weight: 1,
      distance: 500,
      express: false,
      expected: 8.00,
      description: 'Standard shipping, 1kg, 500km'
    },
    {
      weight: 1,
      distance: 100,
      express: true,
      expected: 15.00,
      description: 'Express shipping, 1kg, 100km'
    },
    {
      weight: 10,
      distance: 1000,
      express: true,
      expected: 50.00,
      description: 'Express shipping, 10kg, 1000km'
    }
  ])('$description', ({ weight, distance, express, expected }) => {
    const result = calculateShipping({ weight, distance, express });
    expect(result).toBeCloseTo(expected, 2);
  });
});
```

---

Due to length limits, I'll continue in a second file. Let me create the continuation with the remaining 18 rules.
