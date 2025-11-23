# JavaScript Pragmatic Rules - Part 2

**Continuation of rules 13-30. See SKILL.md for rules 1-12.**

---

## Testing Strategy (Continued)

### Rule 13: Integration with Real APIs — Realistic Network Mocking

**Why It Matters**: Unit tests with mocks don't catch integration issues,
API contract changes, or network behavior. Realistic API tests provide
confidence that the system works end-to-end.

**Best Practice - Network-Level Mocking**:
```javascript
// ✅ CORRECT - Mock API at the network level

// mocks/handlers.js
export const handlers = [
  {
    method: 'GET',
    path: '/api/users/:id',
    handler: (params, body) => {
      const id = params.id;

      if (id === '999') {
        return {
          status: 404,
          body: { error: 'User not found' },
        };
      }

      return {
        status: 200,
        body: {
          id,
          name: 'Test User',
          email: 'test@example.com',
        },
      };
    },
  },

  {
    method: 'POST',
    path: '/api/users',
    handler: (params, body) => {
      if (!body.email) {
        return {
          status: 400,
          body: { error: 'Email is required' },
        };
      }

      return {
        status: 201,
        body: {
          id: '123',
          ...body,
        },
      };
    },
  },

  {
    method: 'GET',
    path: '/api/slow',
    handler: async () => {
      // Simulate network delay
      await new Promise((resolve) => {
        setTimeout(resolve, 2_000);
      });

      return {
        status: 200,
        body: { data: 'slow response' },
      };
    },
  },

  {
    method: 'GET',
    path: '/api/error',
    handler: () => {
      return {
        status: 500,
        body: { error: 'Internal server error' },
      };
    },
  },
];
```

**Pattern: Environment-Based Testing**:
```javascript
// ✅ ADVANCED - Configuration-based API client

class APIClient {
  #baseURL;
  #headers;
  #timeout;

  constructor(options = {}) {
    this.#baseURL = options.baseURL ?? 'https://api.example.com';
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

  async get(endpoint, options) {
    return this.request(endpoint, { ...options, method: 'GET' });
  }

  async post(endpoint, data, options) {
    return this.request(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}

// Unit tests - use mock server
describe('Unit: UserService', () => {
  const api = new APIClient({ baseURL: 'http://localhost:3000' });

  test('fetches user', async () => {
    const user = await api.get('/api/users/123');
    expect(user.id).toBe('123');
  });
});

// E2E tests - use real test server
describe('E2E: User Flow', () => {
  const api = new APIClient({ baseURL: 'http://localhost:4000' });

  test('complete user registration flow', async () => {
    const user = await api.post('/api/users', {
      email: 'test@example.com',
      password: 'password123',
    });

    expect(user.id).toBeDefined();

    const fetchedUser = await api.get(`/api/users/${user.id}`);
    expect(fetchedUser.email).toBe('test@example.com');
  });
});
```

---

### Rule 14: Property Tests for Algorithms — Validate Invariants

**Why It Matters**: Example-based tests only cover known cases.
Property-based tests generate hundreds of random inputs, finding edge
cases and validating invariants automatically.

**Best Practice - Property Tests**:
```javascript
// ✅ CORRECT - Property-based testing

describe('Array sorting', () => {
  // Property: sorted array should be in ascending order
  test('sort produces ascending order', () => {
    for (let i = 0; i < 100; i++) {
      const arr = generateRandomArray();
      const sorted = arr.toSorted((a, b) => {
        return a - b;
      });

      for (let j = 1; j < sorted.length; j++) {
        expect(sorted[j]).toBeGreaterThanOrEqual(sorted[j - 1]);
      }
    }
  });

  // Property: sorted array contains same elements
  test('sort preserves all elements', () => {
    for (let i = 0; i < 100; i++) {
      const arr = generateRandomArray();
      const sorted = arr.toSorted((a, b) => {
        return a - b;
      });

      expect(sorted).toHaveLength(arr.length);

      for (const item of sorted) {
        expect(arr.includes(item)).toBe(true);
      }
    }
  });

  // Property: sorting twice gives same result (idempotence)
  test('sort is idempotent', () => {
    for (let i = 0; i < 100; i++) {
      const arr = generateRandomArray();
      const sorted1 = arr.toSorted((a, b) => {
        return a - b;
      });
      const sorted2 = sorted1.toSorted((a, b) => {
        return a - b;
      });

      expect(sorted1).toEqual(sorted2);
    }
  });
});

function generateRandomArray() {
  const length = Math.floor(Math.random() * 100);
  return Array.from({ length }, () => {
    return Math.floor(Math.random() * 1_000) - 500;
  });
}

describe('String reversal', () => {
  // Property: reversing twice returns original
  test('reverse is self-inverse', () => {
    for (let i = 0; i < 100; i++) {
      const str = generateRandomString();
      const reversed = str.split('').toReversed().join('');
      const doubleReversed = reversed.split('').toReversed().join('');

      expect(doubleReversed).toBe(str);
    }
  });

  // Property: length is preserved
  test('reverse preserves length', () => {
    for (let i = 0; i < 100; i++) {
      const str = generateRandomString();
      const reversed = str.split('').toReversed().join('');

      expect(reversed).toHaveLength(str.length);
    }
  });
});

function generateRandomString() {
  const length = Math.floor(Math.random() * 50);
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';

  return Array.from({ length }, () => {
    const idx = Math.floor(Math.random() * chars.length);
    return chars[idx];
  }).join('');
}
```

**Real-World Example - Discount Calculator**:
```javascript
// ✅ PRODUCTION - Property tests for business logic

function calculateDiscount(price, quantity) {
  if (quantity >= 20) {
    return price * 0.3;
  }

  if (quantity >= 10) {
    return price * 0.2;
  }

  if (quantity >= 5) {
    return price * 0.1;
  }

  return 0;
}

describe('Discount calculator properties', () => {
  // Property: discount never exceeds price
  test('discount never exceeds price', () => {
    for (let i = 0; i < 100; i++) {
      const price = Math.random() * 10_000;
      const quantity = Math.floor(Math.random() * 100);
      const discount = calculateDiscount(price, quantity);

      expect(discount).toBeLessThanOrEqual(price);
    }
  });

  // Property: discount is monotonically increasing with quantity
  test('discount increases with quantity', () => {
    for (let i = 0; i < 100; i++) {
      const price = Math.random() * 10_000 + 1;
      const quantity = Math.floor(Math.random() * 50);
      const discount1 = calculateDiscount(price, quantity);
      const discount2 = calculateDiscount(price, quantity + 1);

      expect(discount2).toBeGreaterThanOrEqual(discount1);
    }
  });

  // Property: zero price or quantity gives zero discount
  test('zero inputs give zero discount', () => {
    expect(calculateDiscount(0, 10)).toBe(0);
    expect(calculateDiscount(100, 0)).toBe(0);
  });

  // Property: discount is deterministic
  test('same inputs give same discount', () => {
    for (let i = 0; i < 100; i++) {
      const price = Math.random() * 10_000;
      const quantity = Math.floor(Math.random() * 100);
      const discount1 = calculateDiscount(price, quantity);
      const discount2 = calculateDiscount(price, quantity);

      expect(discount1).toBe(discount2);
    }
  });
});
```

---

## Performance Optimization

### Rule 15: Debounce/Throttle UI Events — Prevent Excessive Calls

**Why It Matters**: High-frequency events (scroll, resize, input) can fire
hundreds of times per second, causing performance issues and wasted API
calls.

**Best Practice - Debounce**:
```javascript
// ✅ CORRECT - Debounce implementation

function debounce(fn, delay) {
  let timeoutId = null;

  return (...args) => {
    // Clear previous timer
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    // Set new timer
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delay);
  };
}

// Usage - Search input
const searchInput = document.getElementById('search');

const debouncedSearch = debounce(async (query) => {
  const response = await fetch(`/api/search?q=${query}`);
  const results = await response.json();
  displayResults(results);
}, 300);

searchInput.addEventListener('input', (event) => {
  debouncedSearch(event.target.value);
});
```

**Best Practice - Throttle**:
```javascript
// ✅ CORRECT - Throttle implementation

function throttle(fn, limit) {
  let inThrottle = false;
  let lastResult = null;

  return (...args) => {
    if (!inThrottle) {
      lastResult = fn(...args);
      inThrottle = true;

      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }

    return lastResult;
  };
}

// Usage - Scroll handler
const throttledScroll = throttle(() => {
  const scrollY = window.scrollY;
  const isVisible = scrollY > 500;

  const backToTop = document.getElementById('back-to-top');
  backToTop.style.display = isVisible ? 'block' : 'none';
}, 100);

window.addEventListener('scroll', throttledScroll);
```

**Pattern: Debounce with Immediate Option**:
```javascript
// ✅ ADVANCED - Debounce with leading/trailing execution

function debounce(fn, delay, options = {}) {
  const isLeading = options.leading ?? false;
  const isTrailing = options.trailing ?? true;

  let timeoutId = null;
  let lastCallTime = 0;

  return (...args) => {
    const now = Date.now();
    const timeSinceLastCall = now - lastCallTime;

    // Clear previous timer
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    // Leading edge execution
    if (isLeading && timeSinceLastCall >= delay) {
      fn(...args);
      lastCallTime = now;
      return;
    }

    // Trailing edge execution
    if (isTrailing) {
      timeoutId = setTimeout(() => {
        fn(...args);
        lastCallTime = Date.now();
        timeoutId = null;
      }, delay);
    }

    lastCallTime = now;
  };
}

// Usage - Button click with immediate feedback
const button = document.getElementById('submit');

const debouncedSubmit = debounce(
  async () => {
    await submitForm();
  },
  1_000,
  { leading: true, trailing: false },
);

button.addEventListener('click', debouncedSubmit);
```

**Real-World Example - Auto-save**:
```javascript
// ✅ PRODUCTION - Auto-save with debounce

class AutoSave {
  #saveFn;
  #delay;
  #onSaving;
  #onSaved;
  #onError;
  #debouncedSave;
  #isDirty;

  constructor(saveFn, options = {}) {
    this.#saveFn = saveFn;
    this.#delay = options.delay ?? 2_000;
    this.#onSaving = options.onSaving ?? (() => {});
    this.#onSaved = options.onSaved ?? (() => {});
    this.#onError = options.onError ?? console.error;
    this.#isDirty = false;

    this.#debouncedSave = debounce(async () => {
      await this.#performSave();
    }, this.#delay);
  }

  async #performSave() {
    if (!this.#isDirty) {
      return;
    }

    this.#onSaving();

    try {
      await this.#saveFn();
      this.#isDirty = false;
      this.#onSaved();
    } catch (error) {
      this.#onError(error);
    }
  }

  markDirty() {
    this.#isDirty = true;
    this.#debouncedSave();
  }

  async saveNow() {
    if (this.#isDirty) {
      await this.#performSave();
    }
  }
}

// Usage
const autoSave = new AutoSave(
  async () => {
    const data = getFormData();

    await fetch('/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },
  {
    delay: 2_000,
    onSaving: () => {
      showStatus('Saving...');
    },
    onSaved: () => {
      showStatus('Saved');
    },
    onError: () => {
      showStatus('Save failed');
    },
  },
);

// Trigger auto-save on input
const inputs = document.querySelectorAll('input, textarea');

for (const input of inputs) {
  input.addEventListener('input', () => {
    autoSave.markDirty();
  });
}

// Force save on page unload
window.addEventListener('beforeunload', (event) => {
  if (autoSave.isDirty) {
    autoSave.saveNow();
    event.preventDefault();
    event.returnValue = '';
  }
});
```

---

### Rule 16: Profile Before Optimizing — Measure, Don't Guess

**Why It Matters**: Premature optimization wastes time on irrelevant code.
Profiling identifies actual bottlenecks with data, not guesswork.

**Best Practice - Performance Profiling**:
```javascript
// ✅ CORRECT - Built-in performance API

class PerformanceMonitor {
  #name;
  #marks;

  constructor(name) {
    this.#name = name;
    this.#marks = new Map();
  }

  start(label = 'default') {
    const markName = `${this.#name}_${label}_start`;
    performance.mark(markName);
    this.#marks.set(label, markName);
  }

  end(label = 'default') {
    const startMark = this.#marks.get(label);

    if (!startMark) {
      console.warn(`No start mark found for ${label}`);
      return null;
    }

    const endMark = `${this.#name}_${label}_end`;
    performance.mark(endMark);

    const measureName = `${this.#name}_${label}`;
    performance.measure(measureName, startMark, endMark);

    const measures = performance.getEntriesByName(measureName);
    const measure = measures.at(0);
    const duration = measure.duration;

    // Log if slow
    if (duration > 100) {
      const formatted = duration.toFixed(2);
      console.warn(`Slow operation: ${measureName} took ${formatted}ms`);
    }

    // Clean up
    performance.clearMarks(startMark);
    performance.clearMarks(endMark);
    performance.clearMeasures(measureName);
    this.#marks.delete(label);

    return duration;
  }

  measure(label, fn) {
    this.start(label);
    const result = fn();
    this.end(label);
    return result;
  }

  async measureAsync(label, fn) {
    this.start(label);

    try {
      return await fn();
    } finally {
      this.end(label);
    }
  }
}

// Usage
const monitor = new PerformanceMonitor('DataProcessing');

// Synchronous measurement
monitor.start('filtering');
const filtered = data.filter((item) => {
  return item.isActive;
});
monitor.end('filtering');

// Async measurement
const results = await monitor.measureAsync('api_call', async () => {
  const response = await fetch('/api/data');
  return response.json();
});
```

**Pattern: Custom Performance Markers**:
```javascript
// ✅ ADVANCED - Comprehensive performance tracking

class PerformanceTracker {
  #isEnabled;
  #threshold;
  #onSlow;

  constructor(options = {}) {
    this.#isEnabled = options.enabled ?? true;
    this.#threshold = options.threshold ?? 100;
    this.#onSlow = options.onSlow ?? console.warn;
  }

  track(name, fn, context = {}) {
    if (!this.#isEnabled) {
      return fn();
    }

    const startTime = performance.now();
    const startMemory = this.#getMemoryUsage();

    try {
      const result = fn();

      // Handle both sync and async
      if (result instanceof Promise) {
        return result.finally(() => {
          this.#recordMetrics(name, startTime, startMemory, context);
        });
      }

      this.#recordMetrics(name, startTime, startMemory, context);
      return result;
    } catch (error) {
      this.#recordMetrics(name, startTime, startMemory, {
        ...context,
        error: error.message,
      });

      throw error;
    }
  }

  #recordMetrics(name, startTime, startMemory, context) {
    const duration = performance.now() - startTime;
    const endMemory = this.#getMemoryUsage();
    const memoryDelta = endMemory - startMemory;

    const metrics = {
      name,
      duration: duration.toFixed(2),
      memory: this.#formatBytes(memoryDelta),
      timestamp: Date.now(),
      ...context,
    };

    if (duration > this.#threshold) {
      this.#onSlow(metrics);
    }

    // Send to analytics
    this.#sendMetrics(metrics);
  }

  #getMemoryUsage() {
    return performance.memory?.usedJSHeapSize ?? 0;
  }

  #formatBytes(bytes) {
    if (bytes === 0) {
      return '0 B';
    }

    const k = 1_024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const formatted = (bytes / (k ** i)).toFixed(2);

    return `${formatted} ${sizes[i]}`;
  }

  #sendMetrics(metrics) {
    if (navigator.sendBeacon) {
      const payload = JSON.stringify(metrics);
      navigator.sendBeacon('/api/metrics', payload);
    }
  }
}

// Usage
const tracker = new PerformanceTracker({
  threshold: 50,
  onSlow: (metrics) => {
    console.warn('Slow operation detected:', metrics);
  },
});

// Track function execution
const results = tracker.track(
  'processLargeDataset',
  () => {
    return data.map(transform).filter(validate);
  },
  { dataSize: data.length },
);
```

---

### Rule 17: Avoid Memory Leaks — Cleanup Resources

**Why It Matters**: Memory leaks degrade performance over time, causing
crashes in long-running applications. Proper cleanup is essential for SPAs
and dynamic UIs.

**Best Practice - Web Component Cleanup**:
```javascript
// ✅ CORRECT - Comprehensive cleanup

class DataFetcher extends HTMLElement {
  #data = null;
  #abortController = null;

  async connectedCallback() {
    const url = this.getAttribute('url');

    if (!url) {
      return;
    }

    this.#abortController = new AbortController();
    const signal = this.#abortController.signal;

    try {
      const response = await fetch(url, { signal });
      const data = await response.json();

      if (!signal.aborted) {
        this.#data = data;
        this.#render();
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Fetch failed:', error);
      }
    }
  }

  disconnectedCallback() {
    // Cleanup: abort pending requests
    if (this.#abortController) {
      this.#abortController.abort();
      this.#abortController = null;
    }
  }

  #render() {
    if (this.#data) {
      this.innerHTML = JSON.stringify(this.#data);
    }
  }
}

customElements.define('data-fetcher', DataFetcher);
```

**Pattern: Subscription Manager**:
```javascript
// ✅ ADVANCED - Centralized subscription cleanup

class SubscriptionManager {
  #subscriptions;

  constructor() {
    this.#subscriptions = [];
  }

  add(unsubscribe) {
    this.#subscriptions.push(unsubscribe);

    return () => {
      this.remove(unsubscribe);
    };
  }

  remove(unsubscribe) {
    const index = this.#subscriptions.indexOf(unsubscribe);

    if (index >= 0) {
      this.#subscriptions.splice(index, 1);
      unsubscribe();
    }
  }

  clear() {
    for (const unsubscribe of this.#subscriptions) {
      unsubscribe();
    }

    this.#subscriptions = [];
  }
}

// Usage in Web Component
class ComplexComponent extends HTMLElement {
  #subscriptions = new SubscriptionManager();

  connectedCallback() {
    // Add multiple subscriptions
    this.#subscriptions.add(
      eventBus.on('user.updated', this.#handleUserUpdate.bind(this)),
    );

    this.#subscriptions.add(
      websocket.subscribe('notifications', this.#handleNotification.bind(this)),
    );

    this.#subscriptions.add(
      store.subscribe(() => {
        this.#updateFromStore(store.getState());
      }),
    );
  }

  disconnectedCallback() {
    // Single cleanup for all subscriptions
    this.#subscriptions.clear();
  }

  #handleUserUpdate(user) {
    // Handle update
  }

  #handleNotification(notification) {
    // Handle notification
  }

  #updateFromStore(state) {
    // Update component
  }
}
```

**Real-World Example - Comprehensive Cleanup**:
```javascript
// ✅ PRODUCTION - Web Component with multiple cleanup tasks

class DataTable extends HTMLElement {
  #cleanup = [];
  #intervalId = null;
  #observer = null;
  #ws = null;

  connectedCallback() {
    // Event listeners
    const handleResize = () => {
      this.#updateLayout();
    };

    window.addEventListener('resize', handleResize);

    this.#cleanup.push(() => {
      window.removeEventListener('resize', handleResize);
    });

    // Intersection observer
    this.#observer = new IntersectionObserver((entries) => {
      this.#handleIntersection(entries);
    });

    this.#observer.observe(this);

    this.#cleanup.push(() => {
      this.#observer.disconnect();
    });

    // Polling
    this.#intervalId = setInterval(() => {
      this.#fetchUpdates();
    }, 5_000);

    this.#cleanup.push(() => {
      clearInterval(this.#intervalId);
    });

    // Mutation observer
    const mutationObserver = new MutationObserver((mutations) => {
      this.#handleMutations(mutations);
    });

    mutationObserver.observe(this, {
      childList: true,
      subtree: true,
    });

    this.#cleanup.push(() => {
      mutationObserver.disconnect();
    });

    // WebSocket
    this.#ws = new WebSocket('wss://api.example.com/updates');

    this.#ws.onmessage = (event) => {
      this.#handleMessage(event);
    };

    this.#cleanup.push(() => {
      if (this.#ws.readyState === WebSocket.OPEN) {
        this.#ws.close();
      }
    });
  }

  disconnectedCallback() {
    // Execute all cleanup functions
    for (const fn of this.#cleanup) {
      fn();
    }

    this.#cleanup = [];
  }

  #handleIntersection(entries) {
    // Implementation
  }

  #handleMutations(mutations) {
    // Implementation
  }

  #handleMessage(event) {
    // Implementation
  }

  #fetchUpdates() {
    // Implementation
  }

  #updateLayout() {
    // Implementation
  }
}

customElements.define('data-table', DataTable);
```

---

### Rule 18: Use Web Workers for CPU Work — Offload Heavy Computation

**Why It Matters**: Heavy computation blocks the main thread, freezing the
UI. Web Workers enable true parallelism, keeping the UI responsive.

**Best Practice - Web Worker**:
```javascript
// ✅ CORRECT - Offload computation to worker

// worker.js
self.onmessage = (event) => {
  const { type, data } = event.data;

  if (type === 'PROCESS_DATA') {
    const result = processLargeDataset(data);
    self.postMessage({ type: 'RESULT', result });
    return;
  }

  if (type === 'CALCULATE') {
    const sum = expensiveCalculation(data);
    self.postMessage({ type: 'CALCULATION_DONE', sum });
    return;
  }

  self.postMessage({
    type: 'ERROR',
    error: 'Unknown command',
  });
};

function processLargeDataset(data) {
  // CPU-intensive work
  return data.map((item) => {
    let result = item;

    for (let i = 0; i < 1_000; i++) {
      result = transform(result);
    }

    return result;
  });
}

function expensiveCalculation(numbers) {
  return numbers.reduce((sum, n) => {
    // Simulate heavy computation
    let temp = n;

    for (let i = 0; i < 10_000; i++) {
      temp = Math.sqrt(temp * temp + 1);
    }

    return sum + temp;
  }, 0);
}

function transform(value) {
  return value * 2 + 1;
}

// main.js
class WorkerPool {
  #workers;
  #queue;
  #activeJobs;

  constructor(workerPath, poolSize = navigator.hardwareConcurrency ?? 4) {
    this.#workers = [];
    this.#queue = [];
    this.#activeJobs = new Map();

    for (let i = 0; i < poolSize; i++) {
      const worker = new Worker(workerPath);

      worker.onmessage = (event) => {
        this.#handleMessage(worker, event);
      };

      worker.onerror = (error) => {
        this.#handleError(worker, error);
      };

      this.#workers.push({ worker, isBusy: false });
    }
  }

  async execute(type, data) {
    return new Promise((resolve, reject) => {
      const job = { type, data, resolve, reject };
      this.#queue.push(job);
      this.#processQueue();
    });
  }

  #processQueue() {
    if (this.#queue.length === 0) {
      return;
    }

    const availableWorker = this.#workers.find((w) => {
      return !w.isBusy;
    });

    if (!availableWorker) {
      return;
    }

    const job = this.#queue.shift();
    availableWorker.isBusy = true;

    this.#activeJobs.set(availableWorker.worker, job);

    availableWorker.worker.postMessage({
      type: job.type,
      data: job.data,
    });
  }

  #handleMessage(worker, event) {
    const job = this.#activeJobs.get(worker);

    if (!job) {
      return;
    }

    const workerInfo = this.#workers.find((w) => {
      return w.worker === worker;
    });

    if (workerInfo) {
      workerInfo.isBusy = false;
    }

    this.#activeJobs.delete(worker);

    if (event.data.type === 'ERROR') {
      job.reject(new Error(event.data.error));
    } else {
      job.resolve(event.data);
    }

    this.#processQueue();
  }

  #handleError(worker, error) {
    const job = this.#activeJobs.get(worker);

    if (job) {
      job.reject(error);
      this.#activeJobs.delete(worker);
    }

    const workerInfo = this.#workers.find((w) => {
      return w.worker === worker;
    });

    if (workerInfo) {
      workerInfo.isBusy = false;
    }

    this.#processQueue();
  }

  terminate() {
    for (const { worker } of this.#workers) {
      worker.terminate();
    }

    this.#workers = [];
    this.#queue = [];
    this.#activeJobs.clear();
  }
}

// Usage
const workerPool = new WorkerPool('./worker.js', 4);

async function processDataWithWorkers(largeDataset) {
  // UI remains responsive
  showSpinner();

  try {
    const response = await workerPool.execute('PROCESS_DATA', largeDataset);
    displayResults(response.result);
  } catch (error) {
    console.error('Processing failed:', error);
    showError('Failed to process data');
  } finally {
    hideSpinner();
  }
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  workerPool.terminate();
});
```

---

## V8 Engine Optimization

### Rule 19: Avoid Deoptimization Triggers — Keep Hot Paths Clean

**Why It Matters**: V8 optimizes hot functions with TurboFan JIT compiler.
Certain patterns trigger deoptimization, falling back to slow interpreter
mode.

**Deoptimization Triggers to Avoid**:
```javascript
// ❌ WRONG - Triggers deoptimization

// 1. Using 'delete' operator
function badDelete(obj) {
  delete obj.property; // Deoptimizes!
  return obj;
}

// 2. Using 'arguments' object
function badArguments() {
  console.log(arguments); // Deoptimizes!

  return Array.from(arguments).reduce((a, b) => {
    return a + b;
  });
}

// 3. Using 'with' statement (syntax error in strict mode)
// with (obj) { ... } // Never use!

// 4. Using 'try-catch' in hot path
function badTryCatch(x) {
  try {
    return x * 2; // Entire function deoptimized
  } catch (error) {
    return 0;
  }
}
```

**Best Practice - Optimizable Code**:
```javascript
// ✅ CORRECT - Optimization-friendly patterns

// 1. Set to undefined instead of delete
function goodDelete(obj) {
  obj.property = undefined; // Preserves hidden class
  return obj;
}

// Or use Map for dynamic keys
const cache = new Map();
cache.set('key', value);
cache.delete('key'); // OK with Map

// 2. Use rest parameters instead of arguments
function goodArguments(...args) {
  return args.reduce((a, b) => {
    return a + b;
  }, 0);
}

// 3. Never use 'with' - use destructuring
function goodWith(obj) {
  const { value } = obj;
  return value * 2;
}

// 4. Move try-catch out of hot path
function goodTryCatch(x) {
  return calculate(x); // Hot path is optimizable
}

function calculate(x) {
  return x * 2; // Can be inlined and optimized
}

// Wrap in try-catch at call site only if needed
try {
  const result = goodTryCatch(value);
} catch (error) {
  // Handle error
}
```

**Pattern: Monomorphic Call Sites**:
```javascript
// ✅ ADVANCED - Keep call sites monomorphic

// ❌ WRONG - Polymorphic (multiple types)
function polymorphic(value) {
  return value.toString(); // Called with different types
}

polymorphic(123);        // Number
polymorphic('hello');    // String
polymorphic([1, 2, 3]);  // Array
// V8 sees multiple shapes, harder to optimize

// ✅ CORRECT - Monomorphic (single type)
function numberToString(value) {
  return String(value); // Always called with numbers
}

function processNumbers(numbers) {
  return numbers.map((n) => {
    return numberToString(n);
  }); // Monomorphic
}

// Separate functions for different types
function stringLength(str) {
  return str.length;
}

function arrayLength(arr) {
  return arr.length;
}

// Don't mix types
processNumbers([1, 2, 3]); // Good - consistent types
```

**Real-World Example - Hot Loop Optimization**:
```javascript
// ✅ PRODUCTION - Optimized data processing

// ❌ WRONG - Deoptimization in hot loop
function processDataSlow(items) {
  const results = [];

  for (let i = 0; i < items.length; i++) {
    try {
      // Try-catch in loop - deoptimizes entire function
      const item = items[i];
      results.push(item.value * 2);
    } catch (error) {
      results.push(0);
    }
  }

  return results;
}

// ✅ CORRECT - Separate error handling
function processDataFast(items) {
  const results = new Array(items.length); // Pre-allocate

  for (let i = 0; i < items.length; i++) {
    results[i] = processItem(items[i]); // Hot path optimizable
  }

  return results;
}

function processItem(item) {
  // No try-catch here - let errors bubble
  return item.value * 2;
}

// Wrap entire operation if needed
function safeProcessData(items) {
  try {
    return processDataFast(items);
  } catch (error) {
    console.error('Processing failed:', error);
    return [];
  }
}
```

---

### Rule 20: Prefer requestAnimationFrame — For Visual Updates

**Why It Matters**: setTimeout/setInterval aren't synchronized with display
refresh, causing jank and wasted work. requestAnimationFrame ensures smooth
60fps animations.

**Best Practice - requestAnimationFrame**:
```javascript
// ✅ CORRECT - Smooth animation

class Animator {
  #rafId = null;
  #isRunning = false;

  animate(callback) {
    if (this.#isRunning) {
      return;
    }

    this.#isRunning = true;
    let lastTime = performance.now();

    const loop = (currentTime) => {
      if (!this.#isRunning) {
        return;
      }

      const deltaTime = currentTime - lastTime;
      lastTime = currentTime;

      callback(deltaTime, currentTime);

      this.#rafId = requestAnimationFrame(loop);
    };

    this.#rafId = requestAnimationFrame(loop);
  }

  stop() {
    this.#isRunning = false;

    if (this.#rafId) {
      cancelAnimationFrame(this.#rafId);
      this.#rafId = null;
    }
  }
}

// Usage - Smooth scroll animation
const animator = new Animator();

function smoothScroll(targetY, duration = 1_000) {
  const startY = window.scrollY;
  const distance = targetY - startY;
  const startTime = performance.now();

  animator.animate((delta, currentTime) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Easing function
    const eased = easeInOutCubic(progress);
    const newY = startY + distance * eased;

    window.scrollTo(0, newY);

    if (progress >= 1) {
      animator.stop();
    }
  });
}

function easeInOutCubic(t) {
  if (t < 0.5) {
    return 4 * t * t * t;
  }

  return 1 - ((-2 * t + 2) ** 3) / 2;
}
```

**Real-World Example - Progress Bar**:
```javascript
// ✅ PRODUCTION - Smooth progress animation

class ProgressBar {
  #element;
  #currentProgress = 0;
  #targetProgress = 0;
  #rafId = null;

  constructor(element) {
    this.#element = element;
  }

  setProgress(value) {
    this.#targetProgress = Math.max(0, Math.min(100, value));

    if (!this.#rafId) {
      this.#startAnimation();
    }
  }

  #startAnimation() {
    const animate = () => {
      const diff = this.#targetProgress - this.#currentProgress;

      if (Math.abs(diff) < 0.1) {
        this.#currentProgress = this.#targetProgress;
        this.#updateUI();
        this.#rafId = null;
        return;
      }

      // Smooth interpolation
      this.#currentProgress += diff * 0.1;
      this.#updateUI();

      this.#rafId = requestAnimationFrame(animate);
    };

    this.#rafId = requestAnimationFrame(animate);
  }

  #updateUI() {
    this.#element.style.width = `${this.#currentProgress}%`;

    const rounded = Math.round(this.#currentProgress);
    this.#element.setAttribute('aria-valuenow', String(rounded));
  }

  destroy() {
    if (this.#rafId) {
      cancelAnimationFrame(this.#rafId);
    }
  }
}
```

---

### Rule 21: Keep Array Types Consistent — Avoid Mixed Types & Holes

**Why It Matters**: V8 uses specialized array representations for
performance. Mixing types downgrades arrays to slower generic mode.

**Array Element Types (Fastest to Slowest)**:
```javascript
// ✅ PACKED_SMI_ELEMENTS (Fastest)
const integers = [1, 2, 3, 4, 5];
// All small integers (31-bit), no holes

// ✅ PACKED_DOUBLE_ELEMENTS (Fast)
const doubles = [1.5, 2.7, 3.14, 4.2];
// All doubles, no holes

// ⚠️ PACKED_ELEMENTS (Slower)
const mixed = [1, 'string', {}, null];
// Mixed types, no holes

// ❌ HOLEY_SMI_ELEMENTS (Slow)
const holey = [1, 2, , 4, 5];
// Has holes (empty slots)

// ❌ HOLEY_ELEMENTS (Slowest)
const worst = [1, , 'string', , {}];
// Mixed types AND holes
```

**Best Practice - Keep Arrays Homogeneous**:
```javascript
// ✅ CORRECT - Type-consistent arrays

// Integer array
const ids = [1, 2, 3, 4, 5];

// Double array
const prices = [19.99, 29.99, 39.99];

// Object array (same shape)
const users = [
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' },
  { id: 3, name: 'Charlie' },
];

// String array
const names = ['Alice', 'Bob', 'Charlie'];

// ❌ WRONG - Mixed types
const mixed = [1, 'two', { three: 3 }, [4]];
// Forces PACKED_ELEMENTS mode
```

**Pattern: Avoid Holes**:
```javascript
// ❌ WRONG - Creating holes
const array = new Array(100); // Creates HOLEY array
array[0] = 1;
array[50] = 2;

// ✅ CORRECT - Pre-fill or use push
const array1 = new Array(100).fill(0); // PACKED_SMI

const array2 = [];

for (let i = 0; i < 100; i++) {
  array2.push(i); // PACKED_SMI
}

// ❌ WRONG - Deleting creates holes
const arr = [1, 2, 3, 4, 5];
delete arr[2]; // Now HOLEY

// ✅ CORRECT - Splice to remove
const arr2 = [1, 2, 3, 4, 5];
arr2.splice(2, 1); // Still PACKED
```

**Real-World Example - Performance-Critical Array**:
```javascript
// ✅ PRODUCTION - Optimized array operations

// Point cloud processing (millions of points)
class PointCloud {
  #xs;
  #ys;
  #zs;
  #count = 0;

  constructor(capacity) {
    // Separate arrays for each coordinate (PACKED_DOUBLE)
    this.#xs = new Float64Array(capacity);
    this.#ys = new Float64Array(capacity);
    this.#zs = new Float64Array(capacity);
  }

  addPoint(x, y, z) {
    if (this.#count >= this.#xs.length) {
      this.#resize();
    }

    this.#xs[this.#count] = x;
    this.#ys[this.#count] = y;
    this.#zs[this.#count] = z;
    this.#count++;
  }

  // Fast iteration - monomorphic, no holes
  transform(fn) {
    for (let i = 0; i < this.#count; i++) {
      const transformed = fn(this.#xs[i], this.#ys[i], this.#zs[i]);
      const [x, y, z] = transformed;

      this.#xs[i] = x;
      this.#ys[i] = y;
      this.#zs[i] = z;
    }
  }

  #resize() {
    const newCapacity = this.#xs.length * 2;
    const newXs = new Float64Array(newCapacity);
    const newYs = new Float64Array(newCapacity);
    const newZs = new Float64Array(newCapacity);

    newXs.set(this.#xs);
    newYs.set(this.#ys);
    newZs.set(this.#zs);

    this.#xs = newXs;
    this.#ys = newYs;
    this.#zs = newZs;
  }
}

// Fast, cache-friendly, optimized by V8
const cloud = new PointCloud(1_000_000);

cloud.transform((x, y, z) => {
  return [x * 2, y * 2, z * 2];
});
```

---

### Rule 22: Use Typed Arrays for Numerics — Native Memory Layout

**Why It Matters**: Typed arrays provide native memory layout, enabling
SIMD operations and cache-friendly access. 10-100x faster than regular
arrays for numeric computation.

**Best Practice - Typed Arrays**:
```javascript
// ✅ CORRECT - Typed arrays for numeric data

// Image processing
class ImageProcessor {
  #width;
  #height;
  #data;

  constructor(width, height) {
    this.#width = width;
    this.#height = height;
    // RGBA: 4 bytes per pixel
    this.#data = new Uint8ClampedArray(width * height * 4);
  }

  getPixel(x, y) {
    const index = (y * this.#width + x) * 4;

    return {
      r: this.#data[index],
      g: this.#data[index + 1],
      b: this.#data[index + 2],
      a: this.#data[index + 3],
    };
  }

  setPixel(x, y, r, g, b, a = 255) {
    const index = (y * this.#width + x) * 4;

    this.#data[index] = r;
    this.#data[index + 1] = g;
    this.#data[index + 2] = b;
    this.#data[index + 3] = a;
  }

  // Fast grayscale conversion
  toGrayscale() {
    for (let i = 0; i < this.#data.length; i += 4) {
      const gray = (
        this.#data[i] * 0.299 +
        this.#data[i + 1] * 0.587 +
        this.#data[i + 2] * 0.114
      );

      this.#data[i] = gray;
      this.#data[i + 1] = gray;
      this.#data[i + 2] = gray;
    }
  }
}

// Audio processing
class AudioBuffer {
  #sampleRate;
  #length;
  #samples;

  constructor(sampleRate, duration) {
    this.#sampleRate = sampleRate;
    this.#length = Math.floor(sampleRate * duration);
    this.#samples = new Float32Array(this.#length);
  }

  // Generate sine wave
  generateTone(frequency) {
    const omega = 2 * Math.PI * frequency / this.#sampleRate;

    for (let i = 0; i < this.#length; i++) {
      this.#samples[i] = Math.sin(omega * i);
    }
  }

  // Apply gain
  amplify(gain) {
    for (let i = 0; i < this.#length; i++) {
      this.#samples[i] *= gain;
    }
  }
}

// Physics simulation
class ParticleSystem {
  #positions;
  #velocities;
  #masses;
  #count;

  constructor(count) {
    // Structure of Arrays (SoA) for cache efficiency
    this.#positions = new Float64Array(count * 3); // x, y, z
    this.#velocities = new Float64Array(count * 3);
    this.#masses = new Float64Array(count);
    this.#count = count;
  }

  update(deltaTime) {
    for (let i = 0; i < this.#count; i++) {
      const idx = i * 3;

      // Update position based on velocity
      this.#positions[idx] += this.#velocities[idx] * deltaTime;
      this.#positions[idx + 1] += this.#velocities[idx + 1] * deltaTime;
      this.#positions[idx + 2] += this.#velocities[idx + 2] * deltaTime;

      // Apply gravity
      this.#velocities[idx + 1] -= 9.8 * deltaTime;
    }
  }

  applyForce(particleIndex, fx, fy, fz) {
    const mass = this.#masses[particleIndex];
    const idx = particleIndex * 3;

    this.#velocities[idx] += fx / mass;
    this.#velocities[idx + 1] += fy / mass;
    this.#velocities[idx + 2] += fz / mass;
  }
}
```

**Real-World Example - Matrix Operations**:
```javascript
// ✅ PRODUCTION - Fast matrix math with typed arrays

class Matrix4 {
  #elements;

  constructor() {
    // Column-major order for WebGL compatibility
    this.#elements = new Float32Array(16);
    this.identity();
  }

  identity() {
    this.#elements.fill(0);
    this.#elements[0] = 1;
    this.#elements[5] = 1;
    this.#elements[10] = 1;
    this.#elements[15] = 1;
    return this;
  }

  multiply(other) {
    const result = new Matrix4();
    const a = this.#elements;
    const b = other.#elements;
    const c = result.#elements;

    // Optimized matrix multiplication
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        c[i * 4 + j] =
          a[i * 4 + 0] * b[0 * 4 + j] +
          a[i * 4 + 1] * b[1 * 4 + j] +
          a[i * 4 + 2] * b[2 * 4 + j] +
          a[i * 4 + 3] * b[3 * 4 + j];
      }
    }

    return result;
  }

  translate(x, y, z) {
    const m = this.#elements;

    m[12] += m[0] * x + m[4] * y + m[8] * z;
    m[13] += m[1] * x + m[5] * y + m[9] * z;
    m[14] += m[2] * x + m[6] * y + m[10] * z;

    return this;
  }

  scale(x, y, z) {
    const m = this.#elements;

    m[0] *= x;
    m[4] *= y;
    m[8] *= z;
    m[1] *= x;
    m[5] *= y;
    m[9] *= z;
    m[2] *= x;
    m[6] *= y;
    m[10] *= z;

    return this;
  }

  getElements() {
    return this.#elements;
  }
}

// 10-100x faster than regular arrays for graphics math
```

---

## Summary

These 30 rules (13-30 in this file, 1-12 in SKILL.md) form a comprehensive
foundation for production JavaScript.

### Quick Reference (Rules 13-30)

**Testing (13-15)**:
- Mock at network level for realistic tests
- Use property-based tests for invariants
- Debounce/throttle UI events

**Performance (16-22)**:
- Profile before optimizing
- Clean up in disconnectedCallback
- Use Web Workers for CPU work
- Avoid deoptimization triggers
- Use requestAnimationFrame for animations
- Keep array types consistent
- Use typed arrays for numerics

### When to Apply These Rules

**Always**:
- Resource cleanup (17)
- Debounce/throttle (15)

**Hot Paths Only**:
- V8 optimization rules (19-22)
- Web Workers (18)
- Typed arrays (22)

**When Needed**:
- Property tests (14)
- Performance profiling (16)

For complete coverage of all 30 rules, refer to both SKILL.md and
SKILL_PART2.md files.
