# JavaScript Pragmatic Rules - Part 2

## Testing Strategy (Continued)

### Rule 13: Integration with Real APIs — MSW for Mocking, Real Services in E2E

**Why It Matters**: Unit tests with mocks don't catch integration issues, API contract changes, or network behavior. Real API tests provide confidence that the system works end-to-end.

**Best Practice - MSW (Mock Service Worker)**:
```javascript
// ✅ CORRECT - Mock API at the network level
// mocks/handlers.js
import { rest } from 'msw';

export const handlers = [
  rest.get('/api/users/:id', (req, res, ctx) => {
    const { id } = req.params;

    if (id === '999') {
      return res(
        ctx.status(404),
        ctx.json({ error: 'User not found' })
      );
    }

    return res(
      ctx.status(200),
      ctx.json({
        id,
        name: 'Test User',
        email: 'test@example.com'
      })
    );
  }),

  rest.post('/api/users', async (req, res, ctx) => {
    const body = await req.json();

    if (!body.email) {
      return res(
        ctx.status(400),
        ctx.json({ error: 'Email is required' })
      );
    }

    return res(
      ctx.status(201),
      ctx.json({
        id: '123',
        ...body
      })
    );
  }),

  // Simulate network delay
  rest.get('/api/slow', (req, res, ctx) => {
    return res(
      ctx.delay(2000),
      ctx.json({ data: 'slow response' })
    );
  }),

  // Simulate error
  rest.get('/api/error', (req, res, ctx) => {
    return res(
      ctx.status(500),
      ctx.json({ error: 'Internal server error' })
    );
  })
];

// setupTests.js
import { setupServer } from 'msw/node';
import { handlers } from './mocks/handlers';

const server = setupServer(...handlers);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Test file
describe('UserAPI', () => {
  test('fetches user successfully', async () => {
    const user = await fetchUser('123');

    expect(user).toEqual({
      id: '123',
      name: 'Test User',
      email: 'test@example.com'
    });
  });

  test('handles 404 error', async () => {
    await expect(fetchUser('999')).rejects.toThrow('User not found');
  });

  test('handles network timeout', async () => {
    server.use(
      rest.get('/api/users/:id', (req, res, ctx) => {
        return res(ctx.delay('infinite'));
      })
    );

    await expect(
      fetchUser('123', { timeout: 1000 })
    ).rejects.toThrow('timeout');
  });
});
```

**Pattern: Environment-Based Testing**:
```javascript
// ✅ ADVANCED - Real API in E2E, mocks in unit tests
class APIClient {
  constructor(options = {}) {
    this.baseURL = options.baseURL || this.getDefaultBaseURL();
    this.useMocks = options.useMocks ?? this.shouldUseMocks();
  }

  getDefaultBaseURL() {
    const env = process.env.NODE_ENV;

    if (env === 'test' && !process.env.USE_REAL_API) {
      return 'http://localhost:3000'; // MSW intercepts
    }

    if (env === 'e2e') {
      return 'http://localhost:4000'; // Real test server
    }

    return process.env.API_URL || 'https://api.example.com';
  }

  shouldUseMocks() {
    return process.env.NODE_ENV === 'test' && !process.env.USE_REAL_API;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      // Enhanced error logging in test environment
      if (process.env.NODE_ENV === 'test') {
        console.error('API request failed:', {
          endpoint,
          method: options.method,
          error: error.message
        });
      }
      throw error;
    }
  }
}

// Unit tests - use MSW mocks
describe('Unit: UserService', () => {
  const api = new APIClient({ useMocks: true });

  test('fetches user', async () => {
    const user = await api.request('/api/users/123');
    expect(user.id).toBe('123');
  });
});

// E2E tests - use real API
describe('E2E: User Flow', () => {
  const api = new APIClient({ baseURL: 'http://localhost:4000' });

  test('complete user registration flow', async () => {
    const user = await api.request('/api/users', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'password123'
      })
    });

    expect(user.id).toBeDefined();

    const fetchedUser = await api.request(`/api/users/${user.id}`);
    expect(fetchedUser.email).toBe('test@example.com');
  });
});
```

---

### Rule 14: Property Tests for Algorithms — fast-check for Invariants

**Why It Matters**: Example-based tests only cover known cases. Property-based tests generate hundreds of random inputs, finding edge cases and validating invariants automatically.

**Best Practice - Property Tests**:
```javascript
// ✅ CORRECT - Property-based testing with fast-check
import fc from 'fast-check';

describe('Array sorting', () => {
  // Property: sorted array should be in ascending order
  test('sort produces ascending order', () => {
    fc.assert(
      fc.property(fc.array(fc.integer()), (arr) => {
        const sorted = [...arr].sort((a, b) => a - b);

        for (let i = 1; i < sorted.length; i++) {
          expect(sorted[i]).toBeGreaterThanOrEqual(sorted[i - 1]);
        }
      })
    );
  });

  // Property: sorted array contains same elements
  test('sort preserves all elements', () => {
    fc.assert(
      fc.property(fc.array(fc.integer()), (arr) => {
        const sorted = [...arr].sort((a, b) => a - b);

        expect(sorted).toHaveLength(arr.length);
        expect(sorted.every(x => arr.includes(x))).toBe(true);
      })
    );
  });

  // Property: sorting twice gives same result (idempotence)
  test('sort is idempotent', () => {
    fc.assert(
      fc.property(fc.array(fc.integer()), (arr) => {
        const sorted1 = [...arr].sort((a, b) => a - b);
        const sorted2 = [...sorted1].sort((a, b) => a - b);

        expect(sorted1).toEqual(sorted2);
      })
    );
  });
});

describe('String reversal', () => {
  // Property: reversing twice returns original
  test('reverse is self-inverse', () => {
    fc.assert(
      fc.property(fc.string(), (str) => {
        const reversed = str.split('').reverse().join('');
        const doubleReversed = reversed.split('').reverse().join('');

        expect(doubleReversed).toBe(str);
      })
    );
  });

  // Property: length is preserved
  test('reverse preserves length', () => {
    fc.assert(
      fc.property(fc.string(), (str) => {
        const reversed = str.split('').reverse().join('');
        expect(reversed).toHaveLength(str.length);
      })
    );
  });
});
```

**Real-World Example - Discount Calculator**:
```javascript
// ✅ PRODUCTION - Property tests for business logic
function calculateDiscount(price, quantity) {
  if (quantity >= 20) return price * 0.3;
  if (quantity >= 10) return price * 0.2;
  if (quantity >= 5) return price * 0.1;
  return 0;
}

describe('Discount calculator properties', () => {
  // Property: discount never exceeds price
  test('discount never exceeds price', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 10000 }),
        fc.integer({ min: 0, max: 100 }),
        (price, quantity) => {
          const discount = calculateDiscount(price, quantity);
          expect(discount).toBeLessThanOrEqual(price);
        }
      )
    );
  });

  // Property: discount is monotonically increasing with quantity
  test('discount increases with quantity', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 1, max: 10000 }),
        fc.integer({ min: 0, max: 50 }),
        (price, quantity) => {
          const discount1 = calculateDiscount(price, quantity);
          const discount2 = calculateDiscount(price, quantity + 1);

          expect(discount2).toBeGreaterThanOrEqual(discount1);
        }
      )
    );
  });

  // Property: zero price or quantity gives zero discount
  test('zero inputs give zero discount', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant({ price: 0, quantity: fc.sample(fc.integer({ min: 0 })) }),
          fc.constant({ price: fc.sample(fc.float({ min: 0 })), quantity: 0 })
        ),
        ({ price, quantity }) => {
          const discount = calculateDiscount(price, quantity);
          expect(discount).toBe(0);
        }
      )
    );
  });

  // Property: discount is deterministic
  test('same inputs give same discount', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 10000 }),
        fc.integer({ min: 0, max: 100 }),
        (price, quantity) => {
          const discount1 = calculateDiscount(price, quantity);
          const discount2 = calculateDiscount(price, quantity);

          expect(discount1).toBe(discount2);
        }
      )
    );
  });
});
```

---

## Performance Optimization

### Rule 15: Debounce/Throttle UI Events — Prevent Excessive Calls

**Why It Matters**: High-frequency events (scroll, resize, input) can fire hundreds of times per second, causing performance issues and wasted API calls.

**Best Practice - Debounce**:
```javascript
// ✅ CORRECT - Debounce implementation
function debounce(fn, delay) {
  let timeoutId = null;

  return function debounced(...args) {
    // Clear previous timer
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    // Set new timer
    timeoutId = setTimeout(() => {
      fn.apply(this, args);
      timeoutId = null;
    }, delay);
  };
}

// Usage - Search input
const searchInput = document.getElementById('search');
const debouncedSearch = debounce(async (query) => {
  const results = await fetch(`/api/search?q=${query}`).then(r => r.json());
  displayResults(results);
}, 300);

searchInput.addEventListener('input', (e) => {
  debouncedSearch(e.target.value);
});
```

**Best Practice - Throttle**:
```javascript
// ✅ CORRECT - Throttle implementation
function throttle(fn, limit) {
  let inThrottle = false;
  let lastResult = null;

  return function throttled(...args) {
    if (!inThrottle) {
      lastResult = fn.apply(this, args);
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
  const showBackToTop = scrollY > 500;

  document.getElementById('back-to-top').style.display =
    showBackToTop ? 'block' : 'none';
}, 100);

window.addEventListener('scroll', throttledScroll);
```

**Pattern: Debounce with Immediate Option**:
```javascript
// ✅ ADVANCED - Debounce with leading/trailing execution
function debounce(fn, delay, options = {}) {
  const { leading = false, trailing = true } = options;
  let timeoutId = null;
  let lastCallTime = 0;

  return function debounced(...args) {
    const now = Date.now();
    const timeSinceLastCall = now - lastCallTime;

    // Clear previous timer
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    // Leading edge execution
    if (leading && timeSinceLastCall >= delay) {
      fn.apply(this, args);
      lastCallTime = now;
      return;
    }

    // Trailing edge execution
    if (trailing) {
      timeoutId = setTimeout(() => {
        fn.apply(this, args);
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
  1000,
  { leading: true, trailing: false } // Execute immediately, ignore subsequent
);

button.addEventListener('click', debouncedSubmit);
```

**Real-World Example - Auto-save**:
```javascript
// ✅ PRODUCTION - Auto-save with debounce
class AutoSave {
  constructor(saveFn, options = {}) {
    this.saveFn = saveFn;
    this.delay = options.delay || 2000;
    this.onSaving = options.onSaving || (() => {});
    this.onSaved = options.onSaved || (() => {});
    this.onError = options.onError || console.error;

    this.debouncedSave = debounce(async () => {
      await this.performSave();
    }, this.delay);

    this.lastSavedState = null;
    this.isDirty = false;
  }

  async performSave() {
    if (!this.isDirty) return;

    this.onSaving();

    try {
      await this.saveFn();
      this.isDirty = false;
      this.onSaved();
    } catch (error) {
      this.onError(error);
    }
  }

  markDirty() {
    this.isDirty = true;
    this.debouncedSave();
  }

  async saveNow() {
    if (this.isDirty) {
      await this.performSave();
    }
  }
}

// Usage
const autoSave = new AutoSave(
  async () => {
    const data = getFormData();
    await fetch('/api/save', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },
  {
    delay: 2000,
    onSaving: () => showStatus('Saving...'),
    onSaved: () => showStatus('Saved'),
    onError: (err) => showStatus('Save failed')
  }
);

// Trigger auto-save on input
document.querySelectorAll('input, textarea').forEach(el => {
  el.addEventListener('input', () => autoSave.markDirty());
});

// Force save on page unload
window.addEventListener('beforeunload', (e) => {
  if (autoSave.isDirty) {
    autoSave.saveNow();
    e.preventDefault();
    e.returnValue = '';
  }
});
```

---

### Rule 16: Profile Before Optimizing — Chrome DevTools, React Profiler

**Why It Matters**: Premature optimization wastes time on irrelevant code. Profiling identifies actual bottlenecks with data, not guesswork.

**Best Practice - Performance Profiling**:
```javascript
// ✅ CORRECT - Built-in performance API
class PerformanceMonitor {
  constructor(name) {
    this.name = name;
    this.marks = new Map();
  }

  start(label = 'default') {
    const markName = `${this.name}_${label}_start`;
    performance.mark(markName);
    this.marks.set(label, markName);
  }

  end(label = 'default') {
    const startMark = this.marks.get(label);
    if (!startMark) {
      console.warn(`No start mark found for ${label}`);
      return null;
    }

    const endMark = `${this.name}_${label}_end`;
    performance.mark(endMark);

    const measureName = `${this.name}_${label}`;
    performance.measure(measureName, startMark, endMark);

    const measure = performance.getEntriesByName(measureName)[0];
    const duration = measure.duration;

    // Log if slow
    if (duration > 100) {
      console.warn(`Slow operation: ${measureName} took ${duration.toFixed(2)}ms`);
    }

    // Clean up
    performance.clearMarks(startMark);
    performance.clearMarks(endMark);
    performance.clearMeasures(measureName);
    this.marks.delete(label);

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
const filtered = data.filter(item => item.active);
monitor.end('filtering');

// Async measurement
const results = await monitor.measureAsync('api_call', async () => {
  return await fetch('/api/data').then(r => r.json());
});
```

**Real-World Example - React Profiler**:
```javascript
// ✅ PRODUCTION - React performance profiling
import { Profiler } from 'react';

function onRenderCallback(
  id,
  phase,
  actualDuration,
  baseDuration,
  startTime,
  commitTime,
  interactions
) {
  // Log to analytics
  console.log({
    component: id,
    phase, // "mount" or "update"
    actualDuration, // Time spent rendering
    baseDuration, // Estimated time without memoization
    startTime,
    commitTime,
    interactions: Array.from(interactions)
  });

  // Alert on slow renders
  if (actualDuration > 16) { // Slower than 60fps
    console.warn(`Slow render in ${id}: ${actualDuration.toFixed(2)}ms`);
  }

  // Send to monitoring service
  if (window.analytics) {
    window.analytics.track('Component Render', {
      component: id,
      duration: actualDuration,
      phase
    });
  }
}

function App() {
  return (
    <Profiler id="App" onRender={onRenderCallback}>
      <Profiler id="Header" onRender={onRenderCallback}>
        <Header />
      </Profiler>

      <Profiler id="DataTable" onRender={onRenderCallback}>
        <DataTable />
      </Profiler>

      <Profiler id="Footer" onRender={onRenderCallback}>
        <Footer />
      </Profiler>
    </Profiler>
  );
}
```

**Pattern: Custom Performance Markers**:
```javascript
// ✅ ADVANCED - Comprehensive performance tracking
class PerformanceTracker {
  constructor(options = {}) {
    this.enabled = options.enabled ?? true;
    this.threshold = options.threshold || 100;
    this.onSlow = options.onSlow || console.warn;
  }

  track(name, fn, context = {}) {
    if (!this.enabled) {
      return fn();
    }

    const startTime = performance.now();
    const startMemory = this.getMemoryUsage();

    try {
      const result = fn();

      // Handle both sync and async
      if (result instanceof Promise) {
        return result.finally(() => {
          this.recordMetrics(name, startTime, startMemory, context);
        });
      }

      this.recordMetrics(name, startTime, startMemory, context);
      return result;
    } catch (error) {
      this.recordMetrics(name, startTime, startMemory, {
        ...context,
        error: error.message
      });
      throw error;
    }
  }

  recordMetrics(name, startTime, startMemory, context) {
    const duration = performance.now() - startTime;
    const endMemory = this.getMemoryUsage();
    const memoryDelta = endMemory - startMemory;

    const metrics = {
      name,
      duration: duration.toFixed(2),
      memory: this.formatBytes(memoryDelta),
      timestamp: Date.now(),
      ...context
    };

    if (duration > this.threshold) {
      this.onSlow(metrics);
    }

    // Send to analytics
    this.sendMetrics(metrics);
  }

  getMemoryUsage() {
    return performance.memory?.usedJSHeapSize || 0;
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  }

  sendMetrics(metrics) {
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/metrics', JSON.stringify(metrics));
    }
  }
}

// Usage
const tracker = new PerformanceTracker({
  threshold: 50,
  onSlow: (metrics) => {
    console.warn('Slow operation detected:', metrics);
  }
});

// Track function execution
const results = tracker.track(
  'processLargeDataset',
  () => {
    return data.map(transform).filter(validate);
  },
  { dataSize: data.length }
);
```

---

### Rule 17: Avoid Memory Leaks — Cleanup in useEffect, disconnectedCallback

**Why It Matters**: Memory leaks degrade performance over time, causing crashes in long-running applications. Proper cleanup is essential for SPAs and dynamic UIs.

**Best Practice - React useEffect Cleanup**:
```javascript
// ✅ CORRECT - Comprehensive cleanup
function DataFetcher({ url }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function fetchData() {
      try {
        const response = await fetch(url, { signal: controller.signal });
        const json = await response.json();

        if (!cancelled) {
          setData(json);
        }
      } catch (error) {
        if (error.name !== 'AbortError' && !cancelled) {
          console.error('Fetch failed:', error);
        }
      }
    }

    fetchData();

    // Cleanup function
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [url]);

  return data ? <DataDisplay data={data} /> : <Loading />;
}
```

**Pattern: Subscription Manager**:
```javascript
// ✅ ADVANCED - Centralized subscription cleanup
class SubscriptionManager {
  constructor() {
    this.subscriptions = [];
  }

  add(unsubscribe) {
    this.subscriptions.push(unsubscribe);
    return () => this.remove(unsubscribe);
  }

  remove(unsubscribe) {
    const index = this.subscriptions.indexOf(unsubscribe);
    if (index >= 0) {
      this.subscriptions.splice(index, 1);
      unsubscribe();
    }
  }

  clear() {
    this.subscriptions.forEach(unsubscribe => unsubscribe());
    this.subscriptions = [];
  }
}

// Usage in React
function ComplexComponent() {
  const subsRef = useRef(new SubscriptionManager());

  useEffect(() => {
    const subs = subsRef.current;

    // Add multiple subscriptions
    subs.add(
      eventBus.on('user.updated', handleUserUpdate)
    );

    subs.add(
      websocket.subscribe('notifications', handleNotification)
    );

    subs.add(
      store.subscribe(() => {
        setStoreData(store.getState());
      })
    );

    // Single cleanup for all subscriptions
    return () => subs.clear();
  }, []);

  return <div>...</div>;
}
```

**Real-World Example - Web Component Cleanup**:
```javascript
// ✅ PRODUCTION - Comprehensive cleanup in custom elements
class DataTable extends HTMLElement {
  constructor() {
    super();
    this.cleanup = [];
    this.intervalId = null;
    this.observer = null;
  }

  connectedCallback() {
    // Event listeners
    const handleResize = () => this.updateLayout();
    window.addEventListener('resize', handleResize);
    this.cleanup.push(() => window.removeEventListener('resize', handleResize));

    // Intersection observer
    this.observer = new IntersectionObserver(
      entries => this.handleIntersection(entries)
    );
    this.observer.observe(this);
    this.cleanup.push(() => this.observer.disconnect());

    // Polling
    this.intervalId = setInterval(() => this.fetchUpdates(), 5000);
    this.cleanup.push(() => clearInterval(this.intervalId));

    // Mutation observer
    const mutationObserver = new MutationObserver(
      mutations => this.handleMutations(mutations)
    );
    mutationObserver.observe(this, { childList: true, subtree: true });
    this.cleanup.push(() => mutationObserver.disconnect());

    // WebSocket
    this.ws = new WebSocket('wss://api.example.com/updates');
    this.ws.onmessage = (event) => this.handleMessage(event);
    this.cleanup.push(() => {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.close();
      }
    });
  }

  disconnectedCallback() {
    // Execute all cleanup functions
    this.cleanup.forEach(fn => fn());
    this.cleanup = [];
  }

  handleIntersection(entries) {
    // Implementation
  }

  handleMutations(mutations) {
    // Implementation
  }

  handleMessage(event) {
    // Implementation
  }

  fetchUpdates() {
    // Implementation
  }

  updateLayout() {
    // Implementation
  }
}
```

---

### Rule 18: Use Web Workers for CPU Work — Offload Heavy Computation

**Why It Matters**: Heavy computation blocks the main thread, freezing the UI. Web Workers enable true parallelism, keeping the UI responsive.

**Best Practice - Web Worker**:
```javascript
// ✅ CORRECT - Offload computation to worker

// worker.js
self.onmessage = function(e) {
  const { type, data } = e.data;

  switch (type) {
    case 'PROCESS_DATA':
      const result = processLargeDataset(data);
      self.postMessage({ type: 'RESULT', result });
      break;

    case 'CALCULATE':
      const sum = expensiveCalculation(data);
      self.postMessage({ type: 'CALCULATION_DONE', sum });
      break;

    default:
      self.postMessage({ type: 'ERROR', error: 'Unknown command' });
  }
};

function processLargeDataset(data) {
  // CPU-intensive work
  return data.map(item => {
    let result = item;
    for (let i = 0; i < 1000; i++) {
      result = transform(result);
    }
    return result;
  });
}

function expensiveCalculation(numbers) {
  return numbers.reduce((sum, n) => {
    // Simulate heavy computation
    let temp = n;
    for (let i = 0; i < 10000; i++) {
      temp = Math.sqrt(temp * temp + 1);
    }
    return sum + temp;
  }, 0);
}

// main.js
class WorkerPool {
  constructor(workerPath, poolSize = navigator.hardwareConcurrency || 4) {
    this.workers = [];
    this.queue = [];
    this.activeJobs = new Map();

    for (let i = 0; i < poolSize; i++) {
      const worker = new Worker(workerPath);
      worker.onmessage = (e) => this.handleMessage(worker, e);
      worker.onerror = (error) => this.handleError(worker, error);
      this.workers.push({ worker, busy: false });
    }
  }

  async execute(type, data) {
    return new Promise((resolve, reject) => {
      const job = { type, data, resolve, reject };
      this.queue.push(job);
      this.processQueue();
    });
  }

  processQueue() {
    if (this.queue.length === 0) return;

    const availableWorker = this.workers.find(w => !w.busy);
    if (!availableWorker) return;

    const job = this.queue.shift();
    availableWorker.busy = true;

    this.activeJobs.set(availableWorker.worker, job);
    availableWorker.worker.postMessage({
      type: job.type,
      data: job.data
    });
  }

  handleMessage(worker, event) {
    const job = this.activeJobs.get(worker);
    if (!job) return;

    const workerInfo = this.workers.find(w => w.worker === worker);
    if (workerInfo) {
      workerInfo.busy = false;
    }

    this.activeJobs.delete(worker);

    if (event.data.type === 'ERROR') {
      job.reject(new Error(event.data.error));
    } else {
      job.resolve(event.data);
    }

    this.processQueue();
  }

  handleError(worker, error) {
    const job = this.activeJobs.get(worker);
    if (job) {
      job.reject(error);
      this.activeJobs.delete(worker);
    }

    const workerInfo = this.workers.find(w => w.worker === worker);
    if (workerInfo) {
      workerInfo.busy = false;
    }

    this.processQueue();
  }

  terminate() {
    this.workers.forEach(({ worker }) => worker.terminate());
    this.workers = [];
    this.queue = [];
    this.activeJobs.clear();
  }
}

// Usage
const workerPool = new WorkerPool('./worker.js', 4);

async function processDataWithWorkers(largeDataset) {
  // UI remains responsive
  showSpinner();

  try {
    const result = await workerPool.execute('PROCESS_DATA', largeDataset);
    displayResults(result.result);
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

### Rule 19: Avoid Deoptimization Triggers — No delete, arguments, with, eval in Hot Paths

**Why It Matters**: V8 optimizes hot functions with TurboFan JIT compiler. Certain patterns trigger deoptimization, falling back to slow interpreter mode.

**Deoptimization Triggers**:
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
  return Array.from(arguments).reduce((a, b) => a + b);
}

// 3. Using 'with' statement
function badWith(obj) {
  with (obj) { // Deoptimizes!
    return value * 2;
  }
}

// 4. Using 'eval'
function badEval(code) {
  eval(code); // Deoptimizes!
}

// 5. Using 'try-catch' in hot path
function badTryCatch(x) {
  try {
    return x * 2; // Entire function deoptimized
  } catch (e) {
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
  return args.reduce((a, b) => a + b, 0);
}

// 3. Never use 'with' - use destructuring
function goodWith(obj) {
  const { value } = obj;
  return value * 2;
}

// 4. Never use 'eval' - use Function constructor if needed
function goodEval(expr) {
  const fn = new Function('return ' + expr);
  return fn();
}

// 5. Move try-catch out of hot path
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
polymorphic("hello");    // String
polymorphic([1, 2, 3]);  // Array
// V8 sees multiple shapes, harder to optimize

// ✅ CORRECT - Monomorphic (single type)
function numberToString(value) {
  return String(value); // Always called with numbers
}

function processNumbers(numbers) {
  return numbers.map(n => numberToString(n)); // Monomorphic
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

**Why It Matters**: setTimeout/setInterval aren't synchronized with display refresh, causing jank and wasted work. requestAnimationFrame ensures smooth 60fps animations.

**Best Practice - requestAnimationFrame**:
```javascript
// ✅ CORRECT - Smooth animation
class Animator {
  constructor() {
    this.rafId = null;
    this.isRunning = false;
  }

  animate(callback) {
    if (this.isRunning) return;

    this.isRunning = true;
    let lastTime = performance.now();

    const loop = (currentTime) => {
      if (!this.isRunning) return;

      const deltaTime = currentTime - lastTime;
      lastTime = currentTime;

      callback(deltaTime, currentTime);

      this.rafId = requestAnimationFrame(loop);
    };

    this.rafId = requestAnimationFrame(loop);
  }

  stop() {
    this.isRunning = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
}

// Usage - Smooth scroll animation
const animator = new Animator();

function smoothScroll(targetY, duration = 1000) {
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
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
```

**Real-World Example - Progress Bar**:
```javascript
// ✅ PRODUCTION - Smooth progress animation
class ProgressBar {
  constructor(element) {
    this.element = element;
    this.currentProgress = 0;
    this.targetProgress = 0;
    this.rafId = null;
  }

  setProgress(value) {
    this.targetProgress = Math.max(0, Math.min(100, value));

    if (!this.rafId) {
      this.startAnimation();
    }
  }

  startAnimation() {
    const animate = () => {
      const diff = this.targetProgress - this.currentProgress;

      if (Math.abs(diff) < 0.1) {
        this.currentProgress = this.targetProgress;
        this.updateUI();
        this.rafId = null;
        return;
      }

      // Smooth interpolation
      this.currentProgress += diff * 0.1;
      this.updateUI();

      this.rafId = requestAnimationFrame(animate);
    };

    this.rafId = requestAnimationFrame(animate);
  }

  updateUI() {
    this.element.style.width = `${this.currentProgress}%`;
    this.element.setAttribute('aria-valuenow', Math.round(this.currentProgress));
  }

  destroy() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }
  }
}
```

---

### Rule 21: Keep Array Types Consistent — PACKED_SMI > PACKED_DOUBLE > PACKED_ELEMENTS

**Why It Matters**: V8 uses specialized array representations for performance. Mixing types downgrades arrays to slower generic mode.

**Array Element Types (Fastest to Slowest)**:
```javascript
// ✅ PACKED_SMI_ELEMENTS (Fastest)
const integers = [1, 2, 3, 4, 5];
// All small integers (31-bit), no holes

// ✅ PACKED_DOUBLE_ELEMENTS (Fast)
const doubles = [1.5, 2.7, 3.14, 4.2];
// All doubles, no holes

// ⚠️ PACKED_ELEMENTS (Slower)
const mixed = [1, "string", {}, null];
// Mixed types, no holes

// ❌ HOLEY_SMI_ELEMENTS (Slow)
const holey = [1, 2, , 4, 5];
// Has holes (empty slots)

// ❌ HOLEY_ELEMENTS (Slowest)
const worst = [1, , "string", , {}];
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
  { id: 3, name: 'Charlie' }
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
  constructor(capacity) {
    // Separate arrays for each coordinate (PACKED_DOUBLE)
    this.xs = new Float64Array(capacity);
    this.ys = new Float64Array(capacity);
    this.zs = new Float64Array(capacity);
    this.count = 0;
  }

  addPoint(x, y, z) {
    if (this.count >= this.xs.length) {
      this.resize();
    }

    this.xs[this.count] = x;
    this.ys[this.count] = y;
    this.zs[this.count] = z;
    this.count++;
  }

  // Fast iteration - monomorphic, no holes
  transform(fn) {
    for (let i = 0; i < this.count; i++) {
      const [x, y, z] = fn(this.xs[i], this.ys[i], this.zs[i]);
      this.xs[i] = x;
      this.ys[i] = y;
      this.zs[i] = z;
    }
  }

  resize() {
    const newCapacity = this.xs.length * 2;
    const newXs = new Float64Array(newCapacity);
    const newYs = new Float64Array(newCapacity);
    const newZs = new Float64Array(newCapacity);

    newXs.set(this.xs);
    newYs.set(this.ys);
    newZs.set(this.zs);

    this.xs = newXs;
    this.ys = newYs;
    this.zs = newZs;
  }
}

// Fast, cache-friendly, optimized by V8
const cloud = new PointCloud(1000000);
cloud.transform((x, y, z) => [x * 2, y * 2, z * 2]);
```

---

### Rule 22: Use Typed Arrays for Numerics — Int32Array, Float64Array for Math

**Why It Matters**: Typed arrays provide native memory layout, enabling SIMD operations and cache-friendly access. 10-100x faster than regular arrays for numeric computation.

**Best Practice - Typed Arrays**:
```javascript
// ✅ CORRECT - Typed arrays for numeric data

// Image processing
class ImageProcessor {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    // RGBA: 4 bytes per pixel
    this.data = new Uint8ClampedArray(width * height * 4);
  }

  getPixel(x, y) {
    const index = (y * this.width + x) * 4;
    return {
      r: this.data[index],
      g: this.data[index + 1],
      b: this.data[index + 2],
      a: this.data[index + 3]
    };
  }

  setPixel(x, y, r, g, b, a = 255) {
    const index = (y * this.width + x) * 4;
    this.data[index] = r;
    this.data[index + 1] = g;
    this.data[index + 2] = b;
    this.data[index + 3] = a;
  }

  // Fast grayscale conversion
  toGrayscale() {
    for (let i = 0; i < this.data.length; i += 4) {
      const gray = (
        this.data[i] * 0.299 +
        this.data[i + 1] * 0.587 +
        this.data[i + 2] * 0.114
      );

      this.data[i] = gray;
      this.data[i + 1] = gray;
      this.data[i + 2] = gray;
    }
  }
}

// Audio processing
class AudioBuffer {
  constructor(sampleRate, duration) {
    this.sampleRate = sampleRate;
    this.length = Math.floor(sampleRate * duration);
    this.samples = new Float32Array(this.length);
  }

  // Generate sine wave
  generateTone(frequency) {
    const omega = 2 * Math.PI * frequency / this.sampleRate;

    for (let i = 0; i < this.length; i++) {
      this.samples[i] = Math.sin(omega * i);
    }
  }

  // Apply gain
  amplify(gain) {
    for (let i = 0; i < this.length; i++) {
      this.samples[i] *= gain;
    }
  }
}

// Physics simulation
class ParticleSystem {
  constructor(count) {
    // Structure of Arrays (SoA) for cache efficiency
    this.positions = new Float64Array(count * 3); // x, y, z
    this.velocities = new Float64Array(count * 3);
    this.masses = new Float64Array(count);
    this.count = count;
  }

  update(deltaTime) {
    for (let i = 0; i < this.count; i++) {
      const idx = i * 3;

      // Update position based on velocity
      this.positions[idx] += this.velocities[idx] * deltaTime;
      this.positions[idx + 1] += this.velocities[idx + 1] * deltaTime;
      this.positions[idx + 2] += this.velocities[idx + 2] * deltaTime;

      // Apply gravity
      this.velocities[idx + 1] -= 9.8 * deltaTime;
    }
  }

  applyForce(particleIndex, fx, fy, fz) {
    const mass = this.masses[particleIndex];
    const idx = particleIndex * 3;

    this.velocities[idx] += fx / mass;
    this.velocities[idx + 1] += fy / mass;
    this.velocities[idx + 2] += fz / mass;
  }
}
```

**Real-World Example - Matrix Operations**:
```javascript
// ✅ PRODUCTION - Fast matrix math with typed arrays
class Matrix4 {
  constructor() {
    // Column-major order for WebGL compatibility
    this.elements = new Float32Array(16);
    this.identity();
  }

  identity() {
    this.elements.fill(0);
    this.elements[0] = 1;
    this.elements[5] = 1;
    this.elements[10] = 1;
    this.elements[15] = 1;
    return this;
  }

  multiply(other) {
    const result = new Matrix4();
    const a = this.elements;
    const b = other.elements;
    const c = result.elements;

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
    const m = this.elements;
    m[12] += m[0] * x + m[4] * y + m[8] * z;
    m[13] += m[1] * x + m[5] * y + m[9] * z;
    m[14] += m[2] * x + m[6] * y + m[10] * z;
    return this;
  }

  scale(x, y, z) {
    const m = this.elements;
    m[0] *= x; m[4] *= y; m[8] *= z;
    m[1] *= x; m[5] *= y; m[9] *= z;
    m[2] *= x; m[6] *= y; m[10] *= z;
    return this;
  }
}

// 10-100x faster than regular arrays for graphics math
```

---

## Summary

These 30 rules form a comprehensive foundation for production JavaScript. Each rule is backed by real-world experience and measurable performance impact.

### Quick Reference

**Async (1-4)**:
- Handle all promise rejections
- Add timeouts to all async operations
- Limit concurrency
- Clean up timers and listeners

**Objects (4a-7)**:
- Initialize all properties in constructors
- Prefer immutability
- Design for cancellation
- Use error boundaries

**Errors (8-10)**:
- Install global error handlers
- Keep modules focused (1-3 exports)
- Map errors to user messages

**Logging (11-12)**:
- Use structured JSON logs
- Write table-driven tests

**Testing (13-15)**:
- Mock at network level (MSW)
- Use property-based tests
- Debounce/throttle UI events

**Performance (16-22)**:
- Profile before optimizing
- Clean up in useEffect/disconnectedCallback
- Use Web Workers for CPU work
- Avoid deoptimization triggers
- Use requestAnimationFrame for animations

**V8 (22a-27)**:
- Keep array types consistent
- Avoid holes in arrays
- Use typed arrays for numerics
- Keep call sites monomorphic
- Avoid hidden class transitions
- Maintain stable object shapes

### When to Apply These Rules

**Always**:
- Promise rejection handling (1)
- Timeout all async (2)
- Clean up resources (4)
- Global error handlers (8)

**Hot Paths Only**:
- V8 optimization rules (19-27)
- Web Workers (18)
- Typed arrays (27)

**When Needed**:
- Concurrency limits (3)
- Immutability (5)
- Cancellation (6)
- Error boundaries (7)
