# V8 Engine Optimization Deep Dive

Complete guide to Rules 22a-27: Advanced V8 optimization techniques

## Rule 22a: Profile V8 Optimization — Use Chrome DevTools Performance Profiler

**Why It Matters**: Understanding what V8 optimizes (and why it deoptimizes) is essential for writing fast code. Chrome DevTools reveals optimization opportunities.

**How to Profile in Browser**:
```javascript
// 1. Open Chrome DevTools → Performance tab
// 2. Click Record button (or Cmd+E / Ctrl+E)
// 3. Run your performance-critical code
// 4. Stop recording
// 5. Analyze flame graph and call tree

// Use Performance API for precise timing
const start = performance.now();
hotFunction();
const end = performance.now();
console.log(`Execution time: ${end - start}ms`);

// Use console.profile for automatic profiling
console.profile('HotPath');
for (let i = 0; i < 100_000; i++) {
  criticalFunction();
}
console.profileEnd('HotPath');
```

**Best Practice - Performance Baseline Testing**:
```javascript
// ✅ CORRECT - Measure performance improvement from warmup
const measurePerformance = (fn, iterations = 100_000) => {
  // Cold run
  const coldStart = performance.now();
  fn();
  const coldEnd = performance.now();
  const coldTime = coldEnd - coldStart;

  // Warm up
  for (let i = 0; i < iterations; i++) {
    fn();
  }

  // Hot run
  const hotStart = performance.now();
  fn();
  const hotEnd = performance.now();
  const hotTime = hotEnd - hotStart;

  return {
    coldTime,
    hotTime,
    improvement: ((coldTime - hotTime) / coldTime) * 100,
    likelyOptimized: hotTime < coldTime * 0.5,
  };
};

// Test function
const add = (a, b) => a + b;

// Test
const result = measurePerformance(() => {
  let sum = 0;
  for (let i = 0; i < 10_000; i++) {
    sum += add(i, i + 1);
  }
  return sum;
});

console.log('Performance:', result);
// { coldTime: 2.1ms, hotTime: 0.8ms, improvement: 62%, likelyOptimized: true }
```

**Pattern: Optimization Testing**:
```javascript
// ✅ ADVANCED - Systematic performance testing

class PerformanceTester {
  #fn;
  #name;

  constructor(fn, name) {
    this.#fn = fn;
    this.#name = name;
  }

  warmup(iterations = 10_000) {
    console.log(`Warming up ${this.#name}...`);
    for (let i = 0; i < iterations; i++) {
      this.#fn();
    }
  }

  test() {
    console.log(`\n=== Testing ${this.#name} ===`);
    this.warmup();

    // Measure cold vs hot performance
    const coldStart = performance.now();
    this.#fn();
    const coldTime = performance.now() - coldStart;

    // Additional warmup
    this.warmup(50_000);

    const hotStart = performance.now();
    this.#fn();
    const hotTime = performance.now() - hotStart;

    const improvement = ((coldTime - hotTime) / coldTime) * 100;

    console.log(`Cold time: ${coldTime.toFixed(4)}ms`);
    console.log(`Hot time: ${hotTime.toFixed(4)}ms`);
    console.log(`Improvement: ${improvement.toFixed(1)}%`);
    console.log(
      `Status: ${improvement > 50 ? 'Likely optimized' : 'Not optimized'}`
    );
  }

  benchmark(iterations = 1_000_000) {
    this.warmup();

    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      this.#fn();
    }
    const end = performance.now();

    const duration = end - start;
    const opsPerSecond = (iterations / duration) * 1_000;

    console.log(`\n=== Benchmark ${this.#name} ===`);
    console.log(`Duration: ${duration.toFixed(2)}ms`);
    console.log(`Operations: ${iterations.toLocaleString()}`);
    console.log(`Ops/sec: ${opsPerSecond.toLocaleString()}`);

    return { duration, opsPerSecond };
  }
}

// Usage
const monomorphicAdd = (a, b) => a + b;
const polymorphicAdd = (a, b) => a + b;

// Test monomorphic version
const testerMono = new PerformanceTester(
  () => monomorphicAdd(1, 2),
  'monomorphic'
);
for (let i = 0; i < 10_000; i++) {
  monomorphicAdd(i, i); // Always numbers
}
testerMono.test();
testerMono.benchmark();

// Test polymorphic version
const testerPoly = new PerformanceTester(
  () => polymorphicAdd(1, 2),
  'polymorphic'
);
for (let i = 0; i < 10_000; i++) {
  if (i % 3 === 0) {
    polymorphicAdd(i, i); // Numbers
  } else if (i % 3 === 1) {
    polymorphicAdd('a', 'b'); // Strings
  } else {
    polymorphicAdd([i], [i]); // Arrays
  }
}
testerPoly.test();
testerPoly.benchmark();

// Monomorphic will be much faster
```

**Real-World Example - Hot Path Analysis**:
```javascript
// ✅ PRODUCTION - Identify performance characteristics

class PerformanceAnalyzer {
  #functions = new Map();

  register(name, fn) {
    this.#functions.set(name, fn);
  }

  analyzeAll() {
    console.log('\n=== Performance Analysis ===\n');

    for (const [name, fn] of this.#functions) {
      console.log(`Function: ${name}`);

      // Measure cold performance
      const coldStart = performance.now();
      fn(1, 2);
      const coldTime = performance.now() - coldStart;

      // Warmup
      for (let i = 0; i < 10_000; i++) {
        fn(i, i * 2);
      }

      // Measure hot performance
      const hotStart = performance.now();
      for (let i = 0; i < 100_000; i++) {
        fn(i, i * 2);
      }
      const hotTime = performance.now() - hotStart;

      const opsPerSec = (100_000 / hotTime) * 1_000;
      const improvement = ((coldTime - hotTime / 100_000) / coldTime) * 100;

      console.log(`  Cold: ${coldTime.toFixed(4)}ms`);
      console.log(`  Hot (100k): ${hotTime.toFixed(2)}ms`);
      console.log(`  Ops/sec: ${opsPerSec.toLocaleString()}`);
      console.log(
        `  Status: ${improvement > 50 ? '✓ Optimized' : '⚠️  Not optimized'}`
      );
      console.log('');
    }
  }
}

// Register hot path functions
const analyzer = new PerformanceAnalyzer();

analyzer.register('add', (a, b) => a + b);
analyzer.register('multiply', (a, b) => a * b);
analyzer.register('format', (a, b) => `${a}:${b}`);

analyzer.analyzeAll();
```

---

## Rule 23: Keep Array Types Consistent — PACKED_SMI > PACKED_DOUBLE > PACKED_ELEMENTS

*[Covered in SKILL_PART2.md - Rule 21]*

See SKILL_PART2.md for complete documentation on array type consistency.

---

## Rule 24: Monomorphic Over Polymorphic — Single Types at Call Sites

**Why It Matters**: V8 optimizes for monomorphic call sites (single type). Polymorphic sites (2-4 types) are slower. Megamorphic sites (5+ types) are very slow.

**The Problem - Polymorphism**:
```javascript
// ❌ WRONG - Polymorphic function
function getValue(obj) {
  return obj.value; // Called with different object shapes
}

// Different shapes passed to same function
getValue({ value: 1 });                    // Shape 1
getValue({ value: 2, extra: 'data' });     // Shape 2
getValue({ name: 'test', value: 3 });      // Shape 3
getValue({ value: 4, x: 1, y: 2 });        // Shape 4
getValue({ a: 1, b: 2, value: 5 });        // Shape 5 - MEGAMORPHIC!

// V8 gives up on optimization after 5 different shapes
```

**Best Practice - Monomorphic Functions**:
```javascript
// ✅ CORRECT - Monomorphic (single shape)
const getPointValue = (point) => {
  return point.value; // Always Point shape
};

class Point {
  #value;
  #x;
  #y;

  constructor(value, x = 0, y = 0) {
    this.#value = value; // Always same shape
    this.#x = x;
    this.#y = y;
  }

  get value() {
    return this.#value;
  }

  get x() {
    return this.#x;
  }

  get y() {
    return this.#y;
  }
}

// All objects have identical shape
const p1 = new Point(1, 0, 0);
const p2 = new Point(2, 5, 10);
const p3 = new Point(3, -1, -1);

// Optimized - monomorphic call site
console.log(getPointValue(p1));
console.log(getPointValue(p2));
console.log(getPointValue(p3));
```

**Pattern: Type-Specific Functions**:
```javascript
// ✅ ADVANCED - Separate functions for different types

// Instead of polymorphic toString
const toString = (value) => {
  return value.toString(); // Polymorphic!
};

// Use type-specific functions
const numberToString = (num) => {
  return String(num);
};

const objectToString = (obj) => {
  return JSON.stringify(obj);
};

const arrayToString = (arr) => {
  return arr.join(',');
};

// Dispatch based on type (once)
const convertToString = (value) => {
  if (typeof value === 'number') {
    return numberToString(value);
  } else if (Array.isArray(value)) {
    return arrayToString(value);
  } else if (typeof value === 'object') {
    return objectToString(value);
  }
  return String(value);
};

// Each called function is monomorphic
```

**Real-World Example - Data Processing**:
```javascript
// ✅ PRODUCTION - Monomorphic pipeline

class DataProcessor {
  // Separate methods for different data types
  processNumbers(numbers) {
    // Monomorphic - only numbers
    return numbers.map(n => this.transformNumber(n));
  }

  processStrings(strings) {
    // Monomorphic - only strings
    return strings.map(s => this.transformString(s));
  }

  processObjects(objects) {
    // Monomorphic - only objects with same shape
    return objects.map(obj => this.transformObject(obj));
  }

  transformNumber(num) {
    return num * 2;
  }

  transformString(str) {
    return str.toUpperCase();
  }

  transformObject(obj) {
    return { ...obj, processed: true };
  }

  // Dispatch to type-specific method
  process(data) {
    if (data.every(item => typeof item === 'number')) {
      return this.processNumbers(data);
    } else if (data.every(item => typeof item === 'string')) {
      return this.processStrings(data);
    } else {
      return this.processObjects(data);
    }
  }
}

const processor = new DataProcessor();

// Each call site is monomorphic
const numbers = processor.processNumbers([1, 2, 3, 4, 5]);
const strings = processor.processStrings(['a', 'b', 'c']);

// Much faster than mixed-type processing
```

**Benchmark: Monomorphic vs Polymorphic**:
```javascript
// Demonstrate performance difference

// Polymorphic version
const polymorphicSum = (items) => {
  let sum = 0;
  for (const item of items) {
    sum += item.value; // Different shapes!
  }
  return sum;
};

// Monomorphic version
const monomorphicSum = (items) => {
  let sum = 0;
  for (const item of items) {
    sum += item.value; // Same shape!
  }
  return sum;
};

// Test data
const polyData = [
  { value: 1 },
  { value: 2, x: 0 },
  { value: 3, y: 0 },
  { value: 4, x: 0, y: 0 },
  { value: 5, z: 0 },
];

class Item {
  #value;

  constructor(value) {
    this.#value = value;
  }

  get value() {
    return this.#value;
  }
}

const monoData = [
  new Item(1),
  new Item(2),
  new Item(3),
  new Item(4),
  new Item(5),
];

// Warm up
for (let i = 0; i < 10_000; i++) {
  polymorphicSum(polyData);
  monomorphicSum(monoData);
}

// Benchmark
console.time('Polymorphic');
for (let i = 0; i < 1_000_000; i++) {
  polymorphicSum(polyData);
}
console.timeEnd('Polymorphic');

console.time('Monomorphic');
for (let i = 0; i < 1_000_000; i++) {
  monomorphicSum(monoData);
}
console.timeEnd('Monomorphic');

// Monomorphic is typically 2-10x faster
```

---

## Rule 25: Avoid Hidden Class Transitions

**Why It Matters**: Hidden class transitions deoptimize property access. Each object should have a stable shape throughout its lifetime.

**Hidden Class Basics**:
```javascript
// V8 creates "hidden classes" (shapes) to optimize property access

function Point(x, y) {
  this.x = x; // Hidden class: {x}
  this.y = y; // Hidden class: {x, y}
}

// All Point instances share the same hidden class
const p1 = new Point(1, 2);
const p2 = new Point(3, 4);
// p1 and p2 have same hidden class - optimized!

// ❌ Transition: Adding property later
p1.z = 5; // Hidden class transition: {x, y} -> {x, y, z}
// Now p1 and p2 have DIFFERENT hidden classes - slower!
```

**Best Practice - Initialize All Properties**:
```javascript
// ✅ CORRECT - All properties initialized
class Point {
  #x;
  #y;
  #z;

  constructor(x, y, z = 0) {
    this.#x = x;
    this.#y = y;
    this.#z = z; // Always initialized, even if 0
  }

  get x() {
    return this.#x;
  }

  get y() {
    return this.#y;
  }

  get z() {
    return this.#z;
  }

  set z(value) {
    this.#z = value;
  }
}

// All instances share same hidden class
const p1 = new Point(1, 2);
const p2 = new Point(3, 4);
const p3 = new Point(5, 6, 7);

// No hidden class transitions
p1.z = 10; // Just changes value, not shape
```

**Pattern: Object Pools with Consistent Shapes**:
```javascript
// ✅ ADVANCED - Reuse objects with same shape

class ObjectPool {
  #factory;
  #available = [];
  #inUse = new Set();

  constructor(factory, size = 100) {
    this.#factory = factory;

    // Pre-create objects with consistent shape
    for (let i = 0; i < size; i++) {
      this.#available.push(factory());
    }
  }

  acquire() {
    let obj;

    if (this.#available.length > 0) {
      obj = this.#available.pop();
    } else {
      obj = this.#factory();
    }

    this.#inUse.add(obj);
    return obj;
  }

  release(obj) {
    if (!this.#inUse.has(obj)) {
      throw new Error('Object not from this pool');
    }

    this.#inUse.delete(obj);
    this.#reset(obj);
    this.#available.push(obj);
  }

  #reset(obj) {
    // Reset to initial state without changing shape
    for (const key of Object.keys(obj)) {
      const value = obj[key];
      if (typeof value === 'number') {
        obj[key] = 0;
      } else if (typeof value === 'string') {
        obj[key] = '';
      } else if (typeof value === 'boolean') {
        obj[key] = false;
      } else if (value === null) {
        obj[key] = null;
      }
    }
  }
}

// Usage
const pointPool = new ObjectPool(
  () => ({ x: 0, y: 0, z: 0 }),
  1_000
);

// All objects have same hidden class
const p1 = pointPool.acquire();
p1.x = 10;
p1.y = 20;

pointPool.release(p1); // Returns to pool, resets values but keeps shape
```

**Real-World Example - Game Entities**:
```javascript
// ✅ PRODUCTION - Entity system with stable shapes

class Entity {
  #type;
  #id = 0;
  #active = false;
  #x = 0;
  #y = 0;
  #z = 0;
  #vx = 0;
  #vy = 0;
  #vz = 0;
  #sprite = null;
  #visible = true;
  #opacity = 1;
  #health = 100;
  #maxHealth = 100;
  #aiState = 'idle';
  #target = null;

  constructor(type) {
    this.#type = type;
  }

  get type() {
    return this.#type;
  }

  get x() {
    return this.#x;
  }

  set x(value) {
    this.#x = value;
  }

  get y() {
    return this.#y;
  }

  set y(value) {
    this.#y = value;
  }

  get vx() {
    return this.#vx;
  }

  set vx(value) {
    this.#vx = value;
  }

  get vy() {
    return this.#vy;
  }

  set vy(value) {
    this.#vy = value;
  }

  get aiState() {
    return this.#aiState;
  }

  get target() {
    return this.#target;
  }

  // Type-specific behavior, but same shape
  update(deltaTime) {
    switch (this.#type) {
      case 'player':
        this.#updatePlayer(deltaTime);
        break;
      case 'enemy':
        this.#updateEnemy(deltaTime);
        break;
      case 'projectile':
        this.#updateProjectile(deltaTime);
        break;
    }
  }

  #updatePlayer(deltaTime) {
    // Player logic uses: x, y, vx, vy, health
    this.#x += this.#vx * deltaTime;
    this.#y += this.#vy * deltaTime;
  }

  #updateEnemy(deltaTime) {
    // Enemy logic uses: x, y, aiState, target, health
    if (this.#aiState === 'chase' && this.#target) {
      const dx = this.#target.x - this.#x;
      const dy = this.#target.y - this.#y;
      // Move toward target
    }
  }

  #updateProjectile(deltaTime) {
    // Projectile logic uses: x, y, vx, vy
    this.#x += this.#vx * deltaTime;
    this.#y += this.#vy * deltaTime;
  }
}

// All entities have identical hidden class - very fast!
const entities = [
  new Entity('player'),
  new Entity('enemy'),
  new Entity('enemy'),
  new Entity('projectile'),
];

// Hot loop is optimized - monomorphic, no transitions
const updateAll = (entities, deltaTime) => {
  for (let i = 0; i < entities.length; i++) {
    entities[i].update(deltaTime);
  }
};
```

---

## Rule 26: Monomorphic Over Polymorphic (Call Sites)

*[Covered above in Rule 24]*

---

## Rule 27: Use Typed Arrays for Numerics

*[Covered in SKILL_PART2.md - Rule 22]*

See SKILL_PART2.md for complete documentation on typed arrays.

---

## V8 Optimization Checklist

### High Priority (Always Do)
- ✅ Initialize all properties in constructor
- ✅ Avoid `delete` operator
- ✅ Avoid `arguments` object (use rest params)
- ✅ Never use `with` statement
- ✅ Never use `eval`
- ✅ Keep object shapes consistent

### Medium Priority (Hot Paths)
- ✅ Move try-catch out of hot loops
- ✅ Keep call sites monomorphic
- ✅ Avoid mixing types in arrays
- ✅ Use typed arrays for numeric operations
- ✅ Avoid holes in arrays

### Low Priority (Micro-optimizations)
- ✅ Profile with --trace-opt --trace-deopt
- ✅ Use object pools for frequently created objects
- ✅ Prefer for loops over forEach in hot paths
- ✅ Inline small functions manually if needed

## Debugging V8 Issues

### Check Optimization Status
```javascript
// Use Chrome DevTools Performance tab
// 1. Open DevTools → Performance
// 2. Record a profile
// 3. Look for red triangles (deoptimizations)
// 4. Analyze flame graph for hot spots

// Use Performance API for timing
const iterations = 100_000;
const start = performance.now();
for (let i = 0; i < iterations; i++) {
  myFunction();
}
const duration = performance.now() - start;
console.log(`${iterations} iterations in ${duration.toFixed(2)}ms`);
console.log(`${((iterations / duration) * 1_000).toLocaleString()} ops/sec`);
```

### Trace Optimization
```javascript
// Use console.profile in browser
console.profile('FunctionName');
for (let i = 0; i < 100_000; i++) {
  myFunction();
}
console.profileEnd('FunctionName');

// Use Performance Observer for detailed metrics
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    console.log(`${entry.name}: ${entry.duration}ms`);
  }
});
observer.observe({ entryTypes: ['measure'] });

performance.mark('start');
myFunction();
performance.mark('end');
performance.measure('myFunction', 'start', 'end');
```

### Common Deopt Reasons
- "Wrong map" - Hidden class changed
- "Not a heap number" - Expected number, got something else
- "Not a Smi" - Expected small integer
- "Deopt from holey array" - Array has holes
- "Insufficient type feedback" - Not enough type info

## Performance Tips Summary

1. **Object Shapes**: Initialize all properties upfront
2. **Monomorphic**: Single type at each call site
3. **Arrays**: Keep types consistent, avoid holes
4. **Typed Arrays**: Use for numeric computation
5. **No Deopt Triggers**: Avoid delete, arguments, eval, with, try-catch in hot paths
6. **Profile First**: Use --trace-opt and --trace-deopt to find bottlenecks

## When to Apply V8 Optimizations

**Always**:
- Initialize all properties
- Avoid deopt triggers (delete, eval, with, arguments)

**Hot Paths Only** (>10k iterations/sec):
- Monomorphic call sites
- Array type consistency
- Typed arrays
- Object pooling

**Never** (Premature Optimization):
- Before profiling
- In code that runs infrequently
- At the cost of readability
- When the bottleneck is I/O or network

## Further Reading

- [V8 Blog - Fast Properties](https://v8.dev/blog/fast-properties)
- [V8 Blog - Elements Kinds](https://v8.dev/blog/elements-kinds)
- [V8 Blog - TurboFan JIT](https://v8.dev/docs/turbofan)
- [Mathias Bynens - JavaScript Engine Fundamentals](https://mathiasbynens.be/notes/shapes-ics)
