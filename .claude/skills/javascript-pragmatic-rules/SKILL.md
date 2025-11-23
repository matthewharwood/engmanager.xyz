---
name: javascript-pragmatic-rules
description: 30 pragmatic rules for production JavaScript covering async operations, V8 optimization, memory management, testing, error handling, and performance. Use when writing JavaScript, optimizing performance, handling promises, or building production-grade applications. Includes promise rejection handling, V8 hidden classes, memory leak prevention, and structured testing patterns.
allowed-tools: Read, Write, Edit, Grep, Glob, Bash, WebFetch, WebSearch
---

# JavaScript Pragmatic Rules

A comprehensive guide to 30 battle-tested principles for production
JavaScript, organized by category with deep analysis and real-world
examples.

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

**Why It Matters**: Unhandled promise rejections are silent failures that
corrupt application state and make debugging impossible. They violate the
principle of explicit error handling.

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
      const statusText = response.statusText;
      const status = response.status;
      throw new Error(
        `Failed to fetch user ${userId}: ${status} ${statusText}`,
      );
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    // Add context before propagating (ES2022+)
    throw new Error(`User fetch failed for ${userId}`, { cause: error });
  }
}

// At the call site - always handle
async function loadUserProfile(userId) {
  try {
    const result = await fetchUserData(userId);
    displayProfile(result.data);
  } catch (error) {
    const cause = error.cause || {};
    console.error('Profile load failed:', cause, error.message);
    showErrorToUser('Unable to load profile. Please try again.');
  }
}
```

**Global Safety Net**:
```javascript
// Install global handlers for unhandled rejections (Browser only)
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', {
    reason: event.reason,
    promise: event.promise,
  });

  // Log to monitoring service
  logToSentry({
    level: 'error',
    message: 'Unhandled Promise Rejection',
    extra: { reason: event.reason },
  });

  // Prevent default to avoid console noise
  event.preventDefault();
});
```

**Pattern: Result Type**:
```javascript
// Type-safe error handling without exceptions
async function safeUserFetch(userId) {
  try {
    const response = await fetch(`/api/users/${userId}`);

    if (!response.ok) {
      const status = response.status;
      const statusText = response.statusText;
      return {
        ok: false,
        error: `HTTP ${status}: ${statusText}`,
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

**Why It Matters**: Network requests, database queries, and external APIs
can hang indefinitely. Timeouts prevent resource exhaustion and provide
predictable failure modes.

**The Problem**:
```javascript
// ❌ WRONG - Can hang forever
async function fetchData(url) {
  const response = await fetch(url);
  return response.json();
}
```

**Best Practice - AbortController (Modern)**:
```javascript
// ✅ CORRECT - Using AbortController for cancellable fetch
async function fetchWithTimeout(url, timeoutMs = 5_000) {
  const controller = new AbortController();
  const signal = controller.signal;

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, { signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const status = response.status;
      throw new Error(`HTTP ${status}`);
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);

    if (error.name === 'AbortError') {
      throw new Error(
        `Request to ${url} timed out after ${timeoutMs}ms`,
      );
    }

    throw error;
  }
}
```

**Pattern: Configurable Timeout with Retry**:
```javascript
// ✅ ADVANCED - Timeout with exponential backoff retry
async function fetchWithRetry(url, options = {}) {
  const timeout = options.timeout ?? 5_000;
  const maxRetries = options.maxRetries ?? 3;
  const retryDelay = options.retryDelay ?? 1_000;
  const retryOn = options.retryOn ?? [
    408,
    429,
    500,
    502,
    503,
    504,
  ];

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        return await response.json();
      }

      const status = response.status;
      const statusText = response.statusText;

      // Check if should retry
      if (!retryOn.includes(status)) {
        throw new Error(`HTTP ${status}: ${statusText}`);
      }

      lastError = new Error(`HTTP ${status}`);
    } catch (error) {
      clearTimeout(timeoutId);
      lastError = error;

      if (error.name === 'AbortError') {
        lastError = new Error(`Timeout after ${timeout}ms`);
      }
    }

    // Wait before retry (exponential backoff)
    if (attempt < maxRetries) {
      const delay = retryDelay * (2 ** attempt);
      await new Promise((resolve) => {
        setTimeout(resolve, delay);
      });
    }
  }

  const message = `Failed after ${maxRetries} retries`;
  throw new Error(message, { cause: lastError });
}
```

**Real-World Example - API Client**:
```javascript
class APIClient {
  #baseURL;
  #defaultTimeout;

  constructor(baseURL, defaultTimeout = 10_000) {
    this.#baseURL = baseURL;
    this.#defaultTimeout = defaultTimeout;
  }

  async request(endpoint, options = {}) {
    const url = `${this.#baseURL}${endpoint}`;
    const timeout = options.timeout ?? this.#defaultTimeout;

    return this.#withTimeout(
      fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      }),
      timeout,
      `API request to ${endpoint} timed out`,
    );
  }

  async #withTimeout(promise, timeoutMs, errorMessage) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    try {
      const result = await Promise.race([
        promise,
        new Promise((_, reject) => {
          controller.signal.addEventListener('abort', () => {
            reject(new Error(errorMessage));
          });
        }),
      ]);

      clearTimeout(timeoutId);
      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }
}

const api = new APIClient('https://api.example.com', 5_000);
const data = await api.request('/users/123');
```

---

### Rule 3: Limit Concurrent Operations — Promise Pools

**Why It Matters**: Unbounded concurrency exhausts file descriptors,
memory, API rate limits, and database connections. Controlled concurrency
prevents cascading failures.

**The Problem**:
```javascript
// ❌ WRONG - Launches 10,000 concurrent requests
async function processAllUsers(userIds) {
  const promises = userIds.map((id) => {
    return fetch(`/api/users/${id}`);
  });

  // Memory spike, connection exhaustion
  return await Promise.all(promises);
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
      batch.map((item) => {
        return processor(item);
      }),
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
    },
  );
}
```

**Best Practice - Promise Pool with Semaphore**:
```javascript
// ✅ CORRECT - Promise pool with semaphore
class PromisePool {
  #concurrency;
  #running;
  #queue;

  constructor(concurrency) {
    this.#concurrency = concurrency;
    this.#running = 0;
    this.#queue = [];
  }

  async run(fn) {
    while (this.#running >= this.#concurrency) {
      await new Promise((resolve) => {
        this.#queue.push(resolve);
      });
    }

    this.#running++;

    try {
      return await fn();
    } finally {
      this.#running--;
      const resolve = this.#queue.shift();

      if (resolve) {
        resolve();
      }
    }
  }
}

// Usage
async function processAllUsers(userIds) {
  const pool = new PromisePool(10); // Max 10 concurrent

  const promises = userIds.map((id) => {
    return pool.run(async () => {
      const response = await fetch(`/api/users/${id}`);
      return response.json();
    });
  });

  return await Promise.all(promises);
}
```

**Advanced Pattern - Rate Limiting**:
```javascript
// ✅ ADVANCED - Rate limiter with token bucket
class RateLimiter {
  #tokensPerSecond;
  #tokens;
  #maxTokens;
  #lastRefill;
  #queue;

  constructor(tokensPerSecond, burstSize = tokensPerSecond) {
    this.#tokensPerSecond = tokensPerSecond;
    this.#tokens = burstSize;
    this.#maxTokens = burstSize;
    this.#lastRefill = Date.now();
    this.#queue = [];
  }

  #refill() {
    const now = Date.now();
    const elapsed = (now - this.#lastRefill) / 1_000;
    const tokensToAdd = elapsed * this.#tokensPerSecond;

    this.#tokens = Math.min(this.#maxTokens, this.#tokens + tokensToAdd);
    this.#lastRefill = now;
  }

  async acquire() {
    this.#refill();

    if (this.#tokens >= 1) {
      this.#tokens -= 1;
      return;
    }

    // Wait for next token
    const timeToWait = (1 - this.#tokens) / this.#tokensPerSecond * 1_000;

    await new Promise((resolve) => {
      setTimeout(resolve, timeToWait);
    });

    this.#refill();
    this.#tokens -= 1;
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
  const concurrency = options.concurrency ?? 5;
  const onProgress = options.onProgress ?? (() => {});
  const onError = options.onError ?? ((err) => {
    console.error(err);
  });

  const pool = new PromisePool(concurrency);
  const results = [];
  let completed = 0;

  const promises = filePaths.map((path, index) => {
    return pool.run(async () => {
      try {
        const result = await processFile(path);
        completed++;
        onProgress({
          completed,
          total: filePaths.length,
          path,
        });
        return { success: true, path, result };
      } catch (error) {
        onError(error, path);
        return {
          success: false,
          path,
          error: error.message,
        };
      }
    });
  });

  return await Promise.all(promises);
}

// Usage
const results = await processFiles(
  ['file1.txt', 'file2.txt'],
  {
    concurrency: 10,
    onProgress: ({ completed, total }) => {
      console.log(`Progress: ${completed}/${total}`);
    },
  },
);
```

---

### Rule 4: No Orphaned Timers/Listeners — Clear Timeouts, Remove Listeners

**Why It Matters**: Orphaned resources cause memory leaks, duplicate event
handlers, and unexpected behavior. Proper cleanup is essential for
long-running applications.

**The Problem**:
```javascript
// ❌ WRONG - Memory leak in Web Component
class TimerComponent extends HTMLElement {
  connectedCallback() {
    setInterval(() => {
      this.textContent = Date.now();
    }, 1_000);
    // Missing cleanup - interval continues after disconnectedCallback
  }
}
```

**Best Practice - Web Component Cleanup**:
```javascript
// ✅ CORRECT - Proper cleanup in Web Component
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

**Best Practice - Event Listeners**:
```javascript
// ✅ CORRECT - Remove event listeners
class EventManager {
  #listeners;

  constructor() {
    this.#listeners = new Map();
  }

  addEventListener(element, event, handler, options) {
    element.addEventListener(event, handler, options);

    // Track for cleanup
    if (!this.#listeners.has(element)) {
      this.#listeners.set(element, []);
    }

    this.#listeners.get(element).push({
      event,
      handler,
      options,
    });
  }

  removeAllListeners(element) {
    const handlers = this.#listeners.get(element);

    if (!handlers) {
      return;
    }

    for (const item of handlers) {
      element.removeEventListener(item.event, item.handler, item.options);
    }

    this.#listeners.delete(element);
  }

  destroy() {
    for (const [element] of this.#listeners) {
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
  #cleanups;

  constructor() {
    this.#cleanups = [];
  }

  registerTimeout(callback, delay) {
    const id = setTimeout(callback, delay);

    this.#cleanups.push(() => {
      clearTimeout(id);
    });

    return id;
  }

  registerInterval(callback, delay) {
    const id = setInterval(callback, delay);

    this.#cleanups.push(() => {
      clearInterval(id);
    });

    return id;
  }

  registerListener(element, event, handler, options) {
    element.addEventListener(event, handler, options);

    this.#cleanups.push(() => {
      element.removeEventListener(event, handler, options);
    });
  }

  registerCleanup(fn) {
    this.#cleanups.push(fn);
  }

  cleanup() {
    for (const fn of this.#cleanups) {
      fn();
    }

    this.#cleanups = [];
  }
}

// Usage in component
class MyComponent extends HTMLElement {
  #cleanup = new CleanupRegistry();

  connectedCallback() {
    // Auto-tracked timeout
    this.#cleanup.registerTimeout(() => {
      console.log('Delayed action');
    }, 1_000);

    // Auto-tracked listener
    this.#cleanup.registerListener(
      window,
      'resize',
      this.#handleResize.bind(this),
    );

    // Custom cleanup
    const subscription = observable.subscribe(this.#handleData);

    this.#cleanup.registerCleanup(() => {
      subscription.unsubscribe();
    });
  }

  disconnectedCallback() {
    this.#cleanup.cleanup(); // Cleanup everything
  }

  #handleResize() {
    // Handle resize
  }

  #handleData(data) {
    // Handle data
  }
}
```

**Real-World Example - Polling**:
```javascript
// ✅ PRODUCTION - Cancellable polling with cleanup
class Poller {
  #fn;
  #interval;
  #immediate;
  #onError;
  #timeoutId;
  #isActive;

  constructor(fn, interval, options = {}) {
    this.#fn = fn;
    this.#interval = interval;
    this.#immediate = options.immediate ?? true;
    this.#onError = options.onError ?? console.error;
    this.#timeoutId = null;
    this.#isActive = false;
  }

  async #poll() {
    if (!this.#isActive) {
      return;
    }

    try {
      await this.#fn();
    } catch (error) {
      this.#onError(error);
    }

    if (this.#isActive) {
      this.#timeoutId = setTimeout(() => {
        queueMicrotask(() => {
          this.#poll();
        });
      }, this.#interval);
    }
  }

  start() {
    if (this.#isActive) {
      return;
    }

    this.#isActive = true;

    if (this.#immediate) {
      queueMicrotask(() => {
        this.#poll();
      });
    } else {
      this.#timeoutId = setTimeout(() => {
        queueMicrotask(() => {
          this.#poll();
        });
      }, this.#interval);
    }
  }

  stop() {
    this.#isActive = false;

    if (this.#timeoutId) {
      clearTimeout(this.#timeoutId);
      this.#timeoutId = null;
    }
  }
}

// Usage
const poller = new Poller(
  async () => {
    const response = await fetch('/api/status');
    const status = await response.json();
    updateUI(status);
  },
  5_000,
  { immediate: true },
);

poller.start();
// Later...
poller.stop(); // Clean shutdown
```

---

## Object Design & Immutability

### Rule 4a: Consistent Object Shapes — Initialize All Properties

**Why It Matters**: V8 creates 'hidden classes' (shapes) for objects.
Adding properties dynamically causes shape transitions, deoptimizing
property access from fast ICs (inline caches) to slow dictionary mode.

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
user2.setAge(30);                    // Transition 1→3 (different!)
user2.setEmail('bob@example.com');   // Transition 3→4

// Now user1 and user2 have different shapes, preventing optimization
```

**Best Practice**:
```javascript
// ✅ CORRECT - Initialize all properties upfront
class User {
  #name;
  #email;
  #age;

  constructor(name, email = null, age = null) {
    // All properties defined immediately
    this.#name = name;
    this.#email = email;
    this.#age = age;
    // Shape is stable: {#name, #email, #age}
  }

  setEmail(email) {
    this.#email = email; // No shape transition, just value change
  }

  setAge(age) {
    this.#age = age; // No shape transition
  }

  getName() {
    return this.#name;
  }

  getEmail() {
    return this.#email;
  }

  getAge() {
    return this.#age;
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
const points = Array.from({ length: 1_000 }, (_, i) => {
  return createPoint(i, i * 2, i * 3);
});

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
  #id;
  #name;
  #price;
  #description;
  #category;
  #isInStock;
  #tags;
  #createdAt;
  #updatedAt;

  constructor(data = {}) {
    // Initialize ALL properties, even if null
    this.#id = data.id ?? null;
    this.#name = data.name ?? '';
    this.#price = data.price ?? 0;
    this.#description = data.description ?? '';
    this.#category = data.category ?? '';
    this.#isInStock = data.inStock ?? false;
    this.#tags = data.tags ?? [];
    this.#createdAt = data.createdAt ?? Date.now();
    this.#updatedAt = data.updatedAt ?? Date.now();
  }

  update(changes) {
    // Only modify existing properties
    const allowedKeys = [
      'name',
      'price',
      'description',
      'category',
      'inStock',
      'tags',
    ];

    for (const key of allowedKeys) {
      if (Object.hasOwn(changes, key)) {
        const privateKey = `#${key === 'inStock' ? 'isInStock' : key}`;
        this[privateKey] = changes[key];
      }
    }

    this.#updatedAt = Date.now();
  }

  toJSON() {
    return {
      id: this.#id,
      name: this.#name,
      price: this.#price,
      description: this.#description,
      category: this.#category,
      inStock: this.#isInStock,
      tags: this.#tags,
      createdAt: this.#createdAt,
      updatedAt: this.#updatedAt,
    };
  }
}

// All Product instances share the same optimized shape
const products = apiData.map((data) => {
  return new Product(data);
});
```

---

### Rule 5: Prefer Immutability — Use ES2023 Immutable Methods

**Why It Matters**: Immutability prevents bugs from shared mutable state,
enables time-travel debugging, optimizes reconciliation, and makes code
predictable and testable.

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
    total: cart.total + item.price,
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
        ...newAddress,
      },
    },
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
      zip: '97201',
    },
  },
};

const updated = updateUserAddress(user, {
  city: 'Seattle',
  zip: '98101',
});
// user.profile.address unchanged
// updated.profile.address has new city and zip
```

**Pattern: ES2023 Immutable Array Operations**:
```javascript
// ✅ CORRECT - ES2023 immutable methods
const numbers = [5, 2, 8, 1, 9];

// Immutable sort (ES2023)
const sorted = numbers.toSorted();
console.log(numbers); // [5, 2, 8, 1, 9] - unchanged
console.log(sorted);  // [1, 2, 5, 8, 9]

// Immutable reverse (ES2023)
const reversed = numbers.toReversed();
console.log(numbers);  // [5, 2, 8, 1, 9] - unchanged
console.log(reversed); // [9, 1, 8, 2, 5]

// Immutable splice (ES2023)
const spliced = numbers.toSpliced(1, 2, 99, 100);
console.log(numbers); // [5, 2, 8, 1, 9] - unchanged
console.log(spliced); // [5, 99, 100, 1, 9]

// Immutable update at index (ES2023)
const updated = numbers.with(2, 999);
console.log(numbers); // [5, 2, 8, 1, 9] - unchanged
console.log(updated); // [5, 2, 999, 1, 9]
```

**Pattern: Deep Cloning**:
```javascript
// ✅ CORRECT - Deep cloning with structuredClone (ES2021+)
const original = {
  name: 'Alice',
  tags: ['admin', 'user'],
  metadata: {
    created: new Date(),
    settings: { theme: 'dark' },
  },
};

// Deep clone - handles dates, maps, sets, etc.
const copy = structuredClone(original);

copy.tags.push('moderator');
copy.metadata.settings.theme = 'light';

console.log(original.tags);                    // ['admin', 'user']
console.log(original.metadata.settings.theme); // 'dark'
console.log(copy.tags);                        // ['admin', 'user', 'moderator']
console.log(copy.metadata.settings.theme);     // 'light'
```

**Real-World Example - State Updates**:
```javascript
// ✅ PRODUCTION - Immutable state updates
const initialState = {
  todos: [],
  filter: 'all',
  isLoading: false,
};

function todosReducer(state = initialState, action) {
  if (action.type === 'ADD_TODO') {
    return {
      ...state,
      todos: [...state.todos, {
        id: Date.now(),
        text: action.text,
        isCompleted: false,
      }],
    };
  }

  if (action.type === 'TOGGLE_TODO') {
    return {
      ...state,
      todos: state.todos.map((todo) => {
        if (todo.id === action.id) {
          return { ...todo, isCompleted: !todo.isCompleted };
        }
        return todo;
      }),
    };
  }

  if (action.type === 'DELETE_TODO') {
    return {
      ...state,
      todos: state.todos.filter((todo) => {
        return todo.id !== action.id;
      }),
    };
  }

  if (action.type === 'SET_FILTER') {
    return {
      ...state,
      filter: action.filter,
    };
  }

  return state;
}
```

---

### Rule 6: Design for Cancellation — AbortController for Operations

**Why It Matters**: Users navigate away, components unmount, and
requirements change. Cancellation prevents wasted work, race conditions,
and memory leaks from completed-but-obsolete requests.

**The Problem**:
```javascript
// ❌ WRONG - No cancellation, causes race conditions
class SearchComponent extends HTMLElement {
  #query = '';
  #results = [];

  async #search() {
    const response = await fetch(`/api/search?q=${this.#query}`);
    const data = await response.json();
    this.#results = data; // May set stale results if query changed!
    this.render();
  }

  // Race condition: Fast typing causes responses to arrive out of order
  // 'a' -> 'ab' -> 'abc' might resolve as 'abc' -> 'a' -> 'ab'
}
```

**Best Practice - AbortController**:
```javascript
// ✅ CORRECT - Cancellable fetch
class SearchComponent extends HTMLElement {
  #query = '';
  #results = [];
  #abortController = null;

  async #search() {
    // Cancel previous request
    if (this.#abortController) {
      this.#abortController.abort();
    }

    this.#abortController = new AbortController();
    const signal = this.#abortController.signal;

    try {
      const response = await fetch(
        `/api/search?q=${this.#query}`,
        { signal },
      );

      if (!response.ok) {
        const status = response.status;
        throw new Error(`HTTP ${status}`);
      }

      const data = await response.json();
      this.#results = data; // Only sets if not aborted
      this.render();
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Search cancelled');
        return; // Ignore cancellation
      }

      console.error('Search failed:', error);
    }
  }

  disconnectedCallback() {
    // Cleanup: Cancel when component removed
    if (this.#abortController) {
      this.#abortController.abort();
    }
  }

  render() {
    // Render results
  }
}
```

**Pattern: Cancellable Promise**:
```javascript
// ✅ ADVANCED - Generic cancellable async function
function makeCancellable(asyncFn) {
  let isCancelled = false;
  const controller = new AbortController();

  const promise = (async () => {
    try {
      const result = await asyncFn(controller.signal);

      if (isCancelled) {
        throw new Error('Cancelled');
      }

      return result;
    } catch (error) {
      if (isCancelled || error.name === 'AbortError') {
        throw new Error('Cancelled');
      }

      throw error;
    }
  })();

  return {
    promise,
    cancel: () => {
      isCancelled = true;
      controller.abort();
    },
  };
}

// Usage
const cancellable = makeCancellable(async (signal) => {
  const response = await fetch('/api/data', { signal });
  return response.json();
});

// Later...
cancellable.cancel(); // Abort the request
```

**Real-World Example - Long-Running Task**:
```javascript
// ✅ PRODUCTION - Cancellable data processing
class DataProcessor {
  #currentOperation = null;

  async process(data, onProgress) {
    // Cancel previous operation
    if (this.#currentOperation) {
      this.#currentOperation.cancel();
    }

    const controller = new AbortController();
    const signal = controller.signal;

    this.#currentOperation = {
      cancel: () => {
        controller.abort();
      },
    };

    try {
      const total = data.length;
      const results = [];

      for (let i = 0; i < total; i++) {
        // Check cancellation
        if (signal.aborted) {
          throw new Error('Processing cancelled');
        }

        const result = await this.#processItem(data[i]);
        results.push(result);

        // Report progress
        if (onProgress) {
          onProgress({ completed: i + 1, total });
        }

        // Yield to event loop (ES2025)
        await new Promise((resolve) => {
          queueMicrotask(resolve);
        });
      }

      this.#currentOperation = null;
      return results;
    } catch (error) {
      this.#currentOperation = null;

      if (error.message === 'Processing cancelled') {
        console.log('Processing was cancelled');
        return null;
      }

      throw error;
    }
  }

  async #processItem(item) {
    // Expensive operation
    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });

    return item * 2;
  }

  cancel() {
    if (this.#currentOperation) {
      this.#currentOperation.cancel();
    }
  }
}

// Usage
const processor = new DataProcessor();

const result = await processor.process(
  Array.from({ length: 1_000 }, (_, i) => {
    return i;
  }),
  ({ completed, total }) => {
    console.log(`Progress: ${completed}/${total}`);
  },
);

// User action triggers cancellation
processor.cancel();
```

---

### Rule 7: Graceful Error Boundaries — Contain Failures

**Why It Matters**: Unhandled errors in components crash the entire tree.
Error boundaries contain failures, preserve working UI, and provide
recovery mechanisms.

**Best Practice - Error Boundary Pattern**:
```javascript
// ✅ CORRECT - Error boundary for Web Components
class ErrorBoundary extends HTMLElement {
  #hasError = false;
  #error = null;
  #errorInfo = null;

  connectedCallback() {
    window.addEventListener('error', this.#handleError.bind(this));
    window.addEventListener(
      'unhandledrejection',
      this.#handleRejection.bind(this),
    );
  }

  disconnectedCallback() {
    window.removeEventListener('error', this.#handleError.bind(this));
    window.removeEventListener(
      'unhandledrejection',
      this.#handleRejection.bind(this),
    );
  }

  #handleError(event) {
    this.#hasError = true;
    this.#error = event.error;
    this.#errorInfo = {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    };

    this.#render();

    // Log to error tracking service
    if (window.errorTracker) {
      window.errorTracker.captureException(event.error, {
        extra: this.#errorInfo,
      });
    }

    event.preventDefault();
  }

  #handleRejection(event) {
    this.#hasError = true;
    this.#error = event.reason;
    this.#errorInfo = {
      type: 'unhandledRejection',
      reason: event.reason,
    };

    this.#render();

    event.preventDefault();
  }

  #resetError() {
    this.#hasError = false;
    this.#error = null;
    this.#errorInfo = null;
    this.#render();
  }

  #render() {
    if (this.#hasError) {
      this.innerHTML = `
        <div role="alert">
          <h2>Something went wrong</h2>
          <details>
            <summary>Error Details</summary>
            <pre>${this.#error?.toString() ?? 'Unknown error'}</pre>
            <pre>${JSON.stringify(this.#errorInfo, null, 2)}</pre>
          </details>
          <button>Try again</button>
        </div>
      `;

      const button = this.querySelector('button');

      if (button) {
        button.addEventListener('click', () => {
          this.#resetError();
        });
      }
    }
  }
}

customElements.define('error-boundary', ErrorBoundary);

// Usage - Wrap risky components
// <error-boundary>
//   <user-profile user-id="123"></user-profile>
// </error-boundary>
```

**Pattern: Granular Error Boundaries**:
```javascript
// ✅ ADVANCED - Multiple boundaries for isolated failures
class Dashboard extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <div class="dashboard">
        <error-boundary>
          <app-header></app-header>
        </error-boundary>

        <div class="content">
          <error-boundary>
            <app-sidebar></app-sidebar>
          </error-boundary>

          <main>
            <error-boundary>
              <sales-chart></sales-chart>
            </error-boundary>

            <error-boundary>
              <recent-orders></recent-orders>
            </error-boundary>
          </main>
        </div>
      </div>
    `;
  }
}

// If SalesChart fails, only it shows error - rest of dashboard works
```

**Real-World Example - Async Error Handling**:
```javascript
// ✅ PRODUCTION - Combine error boundary with async error handling
class AsyncDataComponent extends HTMLElement {
  #data = null;
  #isLoading = true;
  #error = null;

  async connectedCallback() {
    await this.#fetchData();
  }

  async #fetchData() {
    const url = this.getAttribute('url');

    if (!url) {
      return;
    }

    try {
      const response = await fetch(url);

      if (!response.ok) {
        const status = response.status;
        const statusText = response.statusText;
        throw new Error(`HTTP ${status}: ${statusText}`);
      }

      const data = await response.json();

      this.#data = data;
      this.#isLoading = false;
      this.#error = null;
      this.#render();
    } catch (error) {
      this.#data = null;
      this.#isLoading = false;
      this.#error = error;
      this.#render();
    }
  }

  #render() {
    if (this.#isLoading) {
      this.innerHTML = '<loading-spinner></loading-spinner>';
      return;
    }

    if (this.#error) {
      // Controlled error - show inline
      this.innerHTML = `
        <div class="error-message">
          <p>Failed to load data: ${this.#error.message}</p>
          <button>Retry</button>
        </div>
      `;

      const button = this.querySelector('button');

      if (button) {
        button.addEventListener('click', () => {
          this.#isLoading = true;
          this.#render();
          queueMicrotask(() => {
            this.#fetchData();
          });
        });
      }

      return;
    }

    // If rendering data throws, error boundary catches it
    this.innerHTML = `<data-display></data-display>`;
    const display = this.querySelector('data-display');

    if (display) {
      display.data = this.#data;
    }
  }
}

// Wrap with boundary for unhandled errors
// <error-boundary>
//   <async-data-component url="/api/dashboard"></async-data-component>
// </error-boundary>
```

---

## Error Handling & Resilience

### Rule 8: Zero Uncaught Exceptions — Global Error Handlers

**Why It Matters**: Uncaught exceptions crash the application, corrupt
state, and provide no observability. Global handlers ensure all errors are
logged and handled gracefully.

**Best Practice - Global Error Handlers**:
```javascript
// ✅ CORRECT - Comprehensive error handling setup
class GlobalErrorHandler {
  #logger;
  #onError;

  constructor(options = {}) {
    this.#logger = options.logger ?? console;
    this.#onError = options.onError ?? (() => {});
    this.#setupHandlers();
  }

  #setupHandlers() {
    // Synchronous errors
    window.addEventListener('error', (event) => {
      this.#handleError({
        type: 'error',
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error,
        timestamp: Date.now(),
      });

      event.preventDefault();
    });

    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.#handleError({
        type: 'unhandledRejection',
        reason: event.reason,
        promise: event.promise,
        timestamp: Date.now(),
      });

      event.preventDefault();
    });

    // Handled but re-rejected promises
    window.addEventListener('rejectionhandled', (event) => {
      this.#logger.info('Promise rejection was handled:', event.promise);
    });
  }

  #handleError(errorInfo) {
    // Log locally
    this.#logger.error('Global error caught:', errorInfo);

    // Send to error tracking service
    this.#reportToService(errorInfo);

    // Notify application
    this.#onError(errorInfo);

    // Show user-friendly message
    this.#showErrorToUser(errorInfo);
  }

  #reportToService(errorInfo) {
    // Send to Sentry, Bugsnag, etc.
    if (window.errorTracker) {
      const error = errorInfo.error ?? errorInfo.reason;

      window.errorTracker.captureException(error, {
        extra: errorInfo,
      });
    }

    // Use keepalive to ensure delivery
    if (navigator.sendBeacon) {
      const payload = JSON.stringify(errorInfo);
      navigator.sendBeacon('/api/errors', payload);
    }
  }

  #showErrorToUser(errorInfo) {
    // Only show user-facing errors for critical failures
    if (this.#isCritical(errorInfo)) {
      // Show toast notification or modal
      const message = this.#getUserFriendlyMessage(errorInfo);
      this.#showNotification(message);
    }
  }

  #isCritical(errorInfo) {
    // Determine if error should be shown to user
    const criticalPatterns = [
      /network/i,
      /timeout/i,
      /server error/i,
    ];

    const message = errorInfo.message ?? String(errorInfo.reason);

    return criticalPatterns.some((pattern) => {
      return pattern.test(message);
    });
  }

  #getUserFriendlyMessage(errorInfo) {
    // Map technical errors to user-friendly messages
    const message = errorInfo.message ?? String(errorInfo.reason);

    if (/network/i.test(message)) {
      return 'Unable to connect. Please check your internet connection.';
    }

    if (/timeout/i.test(message)) {
      return 'The request took too long. Please try again.';
    }

    return 'An unexpected error occurred. Our team has been notified.';
  }

  #showNotification(message) {
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
  },
});
```

---

### Rule 9: Small Module Interfaces — 1-3 Exports, Clear Contracts

**Why It Matters**: Large interfaces couple consumers to implementation
details, making refactoring difficult and testing complex. Small, focused
modules are easier to understand, test, and maintain.

**The Problem**:
```javascript
// ❌ WRONG - Kitchen sink module
// user_utils.js
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

// user_repository.js - Data access (1 export)
export class UserRepository {
  async findById(id) { /* ... */ }
  async save(user) { /* ... */ }
  async delete(id) { /* ... */ }
}

// user_validator.js - Validation (1 export)
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
    errors,
  };
}

// user_formatter.js - Presentation (2 exports)
export function formatUserName(user) {
  return `${user.firstName} ${user.lastName}`;
}

export function formatUserForDisplay(user) {
  return {
    displayName: formatUserName(user),
    role: user.role,
    memberSince: formatDate(user.createdAt),
  };
}

// user_auth.js - Authentication (1 export)
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
  #payment;
  #inventory;
  #shipping;
  #tax;

  constructor() {
    this.#payment = new PaymentProcessor();
    this.#inventory = new InventoryManager();
    this.#shipping = new ShippingCalculator();
    this.#tax = new TaxCalculator();
  }

  // Clean, high-level interface
  async createOrder(orderData) {
    // Coordinates internal modules
    const inventoryCheck = await this.#inventory.reserve(orderData.items);

    if (!inventoryCheck.success) {
      throw new Error('Items not available');
    }

    const shippingCost = await this.#shipping.calculate(
      orderData.address,
    );

    const taxAmount = await this.#tax.calculate(
      orderData.items,
      orderData.address,
    );

    const subtotal = orderData.subtotal;
    const total = subtotal + shippingCost + taxAmount;

    const payment = await this.#payment.charge(
      orderData.paymentMethod,
      total,
    );

    return {
      orderId: payment.orderId,
      total,
      shipping: shippingCost,
      tax: taxAmount,
    };
  }
}

// Consumers only see simple interface
import { OrderService } from './order_service.js';

const orders = new OrderService();
const order = await orders.createOrder(orderData);
```

**Real-World Example - API Client**:
```javascript
// ✅ PRODUCTION - Minimal API client interface

// api_client.js (2 exports)
class APIClient {
  #baseURL;
  #headers;
  #timeout;

  constructor(baseURL, options = {}) {
    this.#baseURL = baseURL;
    this.#headers = options.headers ?? {};
    this.#timeout = options.timeout ?? 10_000;
  }

  async request(endpoint, options = {}) {
    const url = `${this.#baseURL}${endpoint}`;
    const controller = new AbortController();

    const timeoutId = setTimeout(() => {
      controller.abort();
    }, this.#timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...this.#headers,
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const status = response.status;
        const statusText = response.statusText;
        throw new Error(`HTTP ${status}: ${statusText}`);
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
      body: JSON.stringify(data),
    });
  }
}

export function createAPIClient(baseURL, options) {
  return new APIClient(baseURL, options);
}

// Usage - simple, focused interface
import { createAPIClient } from './api_client.js';

const api = createAPIClient('https://api.example.com');
const users = await api.get('/users');
```

---

### Rule 10: Map Errors to User Messages — Error Codes to Human-Readable

**Why It Matters**: Technical error messages confuse users and leak
implementation details. User-friendly messages improve UX and reduce
support load.

**Best Practice - Error Mapping**:
```javascript
// ✅ CORRECT - Map errors to user-friendly messages
class ErrorMapper {
  #errorMap;

  constructor() {
    this.#errorMap = new Map([
      // Network errors
      ['NETWORK_ERROR', {
        title: 'Connection Problem',
        message: 'Unable to connect. Please check your internet.',
        action: 'Retry',
      }],
      ['TIMEOUT', {
        title: 'Request Timeout',
        message: 'The request took too long. Please try again.',
        action: 'Retry',
      }],

      // Auth errors
      ['UNAUTHORIZED', {
        title: 'Sign In Required',
        message: 'Your session has expired. Please sign in again.',
        action: 'Sign In',
      }],
      ['FORBIDDEN', {
        title: 'Access Denied',
        message: 'You don\'t have permission for this action.',
        action: null,
      }],

      // Validation errors
      ['VALIDATION_ERROR', {
        title: 'Invalid Input',
        message: 'Please check your input and try again.',
        action: 'Edit',
      }],
      ['DUPLICATE_ENTRY', {
        title: 'Already Exists',
        message: 'This item already exists. Use a different value.',
        action: null,
      }],

      // Server errors
      ['SERVER_ERROR', {
        title: 'Server Error',
        message: 'Something went wrong. Our team has been notified.',
        action: 'Contact Support',
      }],
      ['NOT_FOUND', {
        title: 'Not Found',
        message: 'The requested resource could not be found.',
        action: 'Go Back',
      }],
    ]);
  }

  mapError(errorCode, context = {}) {
    const mapped = this.#errorMap.get(errorCode);

    if (!mapped) {
      return {
        title: 'Unexpected Error',
        message: 'An unexpected error occurred. Please try again.',
        action: 'Retry',
      };
    }

    // Interpolate context into message
    let message = mapped.message;

    for (const key of Object.keys(context)) {
      message = message.replaceAll(`{${key}}`, context[key]);
    }

    return {
      ...mapped,
      message,
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
      504: 'TIMEOUT',
    };

    const errorCode = statusMap[status] ?? 'SERVER_ERROR';
    return this.mapError(errorCode, context);
  }
}

// Usage
const errorMapper = new ErrorMapper();

async function fetchUser(userId) {
  try {
    const response = await fetch(`/api/users/${userId}`);

    if (!response.ok) {
      const status = response.status;
      const error = errorMapper.fromHTTPStatus(status, {
        resource: 'user',
        id: userId,
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
const VALIDATION_MESSAGES = {
  required: (field) => {
    return `${field} is required`;
  },
  email: (field) => {
    return 'Please enter a valid email address';
  },
  minLength: (field, min) => {
    return `${field} must be at least ${min} characters`;
  },
  maxLength: (field, max) => {
    return `${field} must be no more than ${max} characters`;
  },
  pattern: (field, pattern) => {
    return `${field} format is invalid`;
  },
  min: (field, min) => {
    return `${field} must be at least ${min}`;
  },
  max: (field, max) => {
    return `${field} must be no more than ${max}`;
  },
  match: (field, other) => {
    return `${field} must match ${other}`;
  },
};

function validateForm(formData, rules) {
  const errors = {};

  for (const field of Object.keys(rules)) {
    const value = formData[field];
    const fieldRules = rules[field];
    const fieldName = fieldRules.label ?? field;

    // Required
    if (fieldRules.required && !value) {
      errors[field] = VALIDATION_MESSAGES.required(fieldName);
      continue;
    }

    if (!value) {
      continue; // Skip other validations if empty
    }

    // Email
    if (fieldRules.email && !isValidEmail(value)) {
      errors[field] = VALIDATION_MESSAGES.email(fieldName);
      continue;
    }

    // Min/max length
    if (fieldRules.minLength && value.length < fieldRules.minLength) {
      const min = fieldRules.minLength;
      errors[field] = VALIDATION_MESSAGES.minLength(fieldName, min);
      continue;
    }

    if (fieldRules.maxLength && value.length > fieldRules.maxLength) {
      const max = fieldRules.maxLength;
      errors[field] = VALIDATION_MESSAGES.maxLength(fieldName, max);
      continue;
    }

    // Pattern
    if (fieldRules.pattern && !fieldRules.pattern.test(value)) {
      errors[field] = VALIDATION_MESSAGES.pattern(fieldName);
      continue;
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

// Usage
const formRules = {
  email: {
    label: 'Email',
    required: true,
    email: true,
  },
  password: {
    label: 'Password',
    required: true,
    minLength: 8,
  },
  name: {
    label: 'Full Name',
    required: true,
    minLength: 2,
    maxLength: 50,
  },
};

const result = validateForm(formData, formRules);

if (!result.isValid) {
  // Show user-friendly messages
  for (const field of Object.keys(result.errors)) {
    showFieldError(field, result.errors[field]);
  }
}
```

---

## Logging & Observability

### Rule 11: Structured Logging — JSON Logs with Context

**Why It Matters**: Plain text logs are hard to query, aggregate, and
analyze. Structured logs enable powerful filtering, metrics extraction,
and debugging in production.

**Best Practice - Structured Logger**:
```javascript
// ✅ CORRECT - Structured logging with context
class Logger {
  #serviceName;
  #environment;
  #minimumLevel;
  #levels;

  constructor(options = {}) {
    this.#serviceName = options.serviceName ?? 'app';
    this.#environment = options.environment ?? 'development';
    this.#minimumLevel = options.minimumLevel ?? 'info';
    this.#levels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
    };
  }

  log(level, message, context = {}) {
    if (this.#levels[level] < this.#levels[this.#minimumLevel]) {
      return;
    }

    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.#serviceName,
      environment: this.#environment,
      message,
      ...context,
      // Add correlation ID if available
      correlationId: this.#getCorrelationId(),
      // Add user context if available
      userId: this.#getUserId(),
      // Add request context if available
      requestId: this.#getRequestId(),
    };

    // In production, send to logging service
    if (this.#environment === 'production') {
      this.#sendToLoggingService(logEntry);
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
        name: error.name,
      },
    });
  }

  #getCorrelationId() {
    // Implement correlation ID tracking
    return globalThis.correlationId ?? null;
  }

  #getUserId() {
    // Get current user ID from auth context
    return globalThis.currentUserId ?? null;
  }

  #getRequestId() {
    // Get request ID from headers or generate
    return globalThis.currentRequestId ?? null;
  }

  #sendToLoggingService(logEntry) {
    // Send to DataDog, Splunk, ELK, etc. (keepalive: true)
    if (navigator.sendBeacon) {
      const payload = JSON.stringify(logEntry);
      navigator.sendBeacon('/api/logs', payload);
    }
  }
}

// Usage
const logger = new Logger({
  serviceName: 'user-service',
  environment: 'production',
  minimumLevel: 'info',
});

logger.info('User logged in', {
  userId: 123,
  ipAddress: '192.168.1.1',
  userAgent: navigator.userAgent,
});

logger.error('Failed to fetch user data', error, {
  userId: 123,
  endpoint: '/api/users/123',
  duration: 5_234,
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
      const measures = performance.getEntriesByName(timerId);
      const measure = measures.at(0);

      if (measure) {
        this.info('Operation completed', {
          operation,
          duration: measure.duration,
          ...context,
        });
      }

      // Clean up
      performance.clearMarks(`${timerId}_start`);
      performance.clearMarks(`${timerId}_end`);
      performance.clearMeasures(timerId);

      return measure ? measure.duration : null;
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
  { endpoint: '/api/users' },
);
```

---

### Rule 12: Table-Driven Tests — Comprehensive Coverage

**Why It Matters**: Repetitive test code is error-prone and hard to
maintain. Table-driven tests make it easy to add cases, see patterns, and
achieve comprehensive coverage.

**Best Practice - Table-Driven Tests**:
```javascript
// ✅ CORRECT - Table-driven tests
describe('calculateDiscount', () => {
  const testCases = [
    // [price, quantity, expected, description]
    [100, 1, 0, 'No discount for single item'],
    [100, 5, 10, '10% discount for 5 items'],
    [100, 10, 20, '20% discount for 10 items'],
    [100, 20, 30, '30% discount for 20+ items'],
    [0, 10, 0, 'Zero price returns zero discount'],
    [100, 0, 0, 'Zero quantity returns zero discount'],
    [50, 15, 15, 'Discount applies to lower prices'],
  ];

  for (const [price, quantity, expected, description] of testCases) {
    test(`${description}: calculateDiscount(${price}, ${quantity}) = ${expected}`, () => {
      expect(calculateDiscount(price, quantity)).toBe(expected);
    });
  }
});

// ✅ CORRECT - Complex test cases
describe('validateEmail', () => {
  const testCases = [
    ['user@example.com', true],
    ['user.name@example.com', true],
    ['user+tag@example.co.uk', true],
    ['user_name@example-domain.com', true],
    ['', false],
    ['invalid', false],
    ['@example.com', false],
    ['user@', false],
    ['user @example.com', false],
    ['user@example', false],
  ];

  for (const [email, expected] of testCases) {
    test(`validateEmail("${email}") should return ${expected}`, () => {
      expect(validateEmail(email)).toBe(expected);
    });
  }
});
```

**Real-World Example - Complex Business Logic**:
```javascript
// ✅ PRODUCTION - Shipping calculation tests
describe('calculateShipping', () => {
  const testCases = [
    {
      weight: 1,
      distance: 100,
      isExpress: false,
      expected: 5.00,
      description: 'Standard shipping, 1kg, 100km',
    },
    {
      weight: 5,
      distance: 100,
      isExpress: false,
      expected: 10.00,
      description: 'Standard shipping, 5kg, 100km',
    },
    {
      weight: 1,
      distance: 500,
      isExpress: false,
      expected: 8.00,
      description: 'Standard shipping, 1kg, 500km',
    },
    {
      weight: 1,
      distance: 100,
      isExpress: true,
      expected: 15.00,
      description: 'Express shipping, 1kg, 100km',
    },
    {
      weight: 10,
      distance: 1_000,
      isExpress: true,
      expected: 50.00,
      description: 'Express shipping, 10kg, 1000km',
    },
  ];

  for (const testCase of testCases) {
    test(testCase.description, () => {
      const result = calculateShipping({
        weight: testCase.weight,
        distance: testCase.distance,
        express: testCase.isExpress,
      });

      expect(result).toBeCloseTo(testCase.expected, 2);
    });
  }
});
```

---

**Note**: Due to the comprehensive nature of the 30 rules, the remaining
rules (13-30) covering Testing Strategy, Performance Optimization, and V8
Engine Optimization are documented in `SKILL_PART2.md`. This split ensures
manageable file sizes while maintaining complete coverage of all
production JavaScript best practices.

For the complete ruleset, refer to both SKILL.md and SKILL_PART2.md files.
