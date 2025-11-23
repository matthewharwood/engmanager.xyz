# V8 Engine Optimization Deep Dive

Complete guide to Rules 22a-27: Advanced V8 optimization techniques

## Rule 22a: Profile V8 Optimization — Use --trace-opt, --trace-deopt Flags

**Why It Matters**: Understanding what V8 optimizes (and why it deoptimizes) is essential for writing fast code. These flags reveal V8's internal decisions.

**How to Use V8 Flags**:
```bash
# Node.js
node --trace-opt --trace-deopt app.js

# Chrome
chrome --js-flags="--trace-opt --trace-deopt"

# Useful combinations
node --trace-opt --trace-deopt --trace-ic app.js
```

**Understanding Output**:
```
[optimizing 0x2a1f8b042b1 <JSFunction add> - took 0.123 ms]
[deoptimizing (DEOPT soft): begin 0x2a1f8b042b1 <JSFunction add>]
```

**Best Practice - Optimization Checker**:
```javascript
// ✅ CORRECT - Check if function is optimized
function isOptimized(fn) {
  // V8 only - requires --allow-natives-syntax flag
  try {
    %OptimizeFunctionOnNextCall(fn);
    fn(); // Call to trigger optimization
    return %GetOptimizationStatus(fn) === 1;
  } catch (error) {
    // Fallback for non-V8 environments
    return null;
  }
}

// Test function
function add(a, b) {
  return a + b;
}

// Warm up (call multiple times)
for (let i = 0; i < 10000; i++) {
  add(i, i + 1);
}

console.log('Is optimized:', isOptimized(add));
```

**Pattern: Optimization Testing**:
```javascript
// ✅ ADVANCED - Systematic optimization testing

class OptimizationTester {
  constructor(fn, name) {
    this.fn = fn;
    this.name = name;
    this.hasNativesSyntax = this.checkNativesSupport();
  }

  checkNativesSupport() {
    try {
      eval('%OptimizeFunctionOnNextCall');
      return true;
    } catch {
      return false;
    }
  }

  warmup(iterations = 10000) {
    console.log(`Warming up ${this.name}...`);
    for (let i = 0; i < iterations; i++) {
      this.fn();
    }
  }

  getOptimizationStatus() {
    if (!this.hasNativesSyntax) {
      return 'Unknown (no natives syntax support)';
    }

    try {
      const status = eval(`%GetOptimizationStatus(${this.fn})`);
      const statusMap = {
        1: 'Optimized',
        2: 'Not optimized',
        3: 'Always optimized',
        4: 'Never optimized',
        6: 'Maybe deoptimized',
        7: 'TurboFan optimized'
      };
      return statusMap[status] || `Unknown status: ${status}`;
    } catch (error) {
      return 'Error checking status';
    }
  }

  forceOptimization() {
    if (!this.hasNativesSyntax) {
      console.warn('Native syntax not available');
      return false;
    }

    try {
      eval(`%OptimizeFunctionOnNextCall(${this.fn})`);
      this.fn(); // Trigger optimization
      return true;
    } catch (error) {
      console.error('Failed to force optimization:', error);
      return false;
    }
  }

  test() {
    console.log(`\n=== Testing ${this.name} ===`);

    this.warmup();

    const status = this.getOptimizationStatus();
    console.log('Status:', status);

    if (status !== 'Optimized' && status !== 'TurboFan optimized') {
      console.log('Attempting to force optimization...');
      this.forceOptimization();
      console.log('New status:', this.getOptimizationStatus());
    }
  }

  benchmark(iterations = 1000000) {
    this.warmup();

    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      this.fn();
    }
    const end = performance.now();

    const opsPerSecond = (iterations / (end - start)) * 1000;

    console.log(`\n=== Benchmark ${this.name} ===`);
    console.log(`Duration: ${(end - start).toFixed(2)}ms`);
    console.log(`Operations: ${iterations.toLocaleString()}`);
    console.log(`Ops/sec: ${opsPerSecond.toLocaleString()}`);
    console.log(`Status: ${this.getOptimizationStatus()}`);

    return { duration: end - start, opsPerSecond };
  }
}

// Usage
function monomorphicAdd(a, b) {
  return a + b;
}

function polymorphicAdd(a, b) {
  return a + b;
}

// Test monomorphic version
const testerMono = new OptimizationTester(monomorphicAdd, 'monomorphic');
for (let i = 0; i < 10000; i++) {
  monomorphicAdd(i, i); // Always numbers
}
testerMono.test();
testerMono.benchmark();

// Test polymorphic version
const testerPoly = new OptimizationTester(polymorphicAdd, 'polymorphic');
for (let i = 0; i < 10000; i++) {
  if (i % 3 === 0) polymorphicAdd(i, i);      // Numbers
  else if (i % 3 === 1) polymorphicAdd('a', 'b'); // Strings
  else polymorphicAdd([i], [i]);              // Arrays
}
testerPoly.test();
testerPoly.benchmark();

// Monomorphic will be much faster
```

**Real-World Example - Hot Path Analysis**:
```javascript
// ✅ PRODUCTION - Identify optimization bottlenecks

// Run with: node --trace-opt --trace-deopt --trace-ic script.js

class PerformanceAnalyzer {
  constructor() {
    this.functions = new Map();
  }

  register(name, fn) {
    this.functions.set(name, fn);
  }

  analyzeAll() {
    console.log('\n=== V8 Optimization Analysis ===\n');

    for (const [name, fn] of this.functions) {
      console.log(`Function: ${name}`);

      // Warmup
      for (let i = 0; i < 10000; i++) {
        fn(i, i * 2);
      }

      // Check optimization
      try {
        const status = eval(`%GetOptimizationStatus(${fn})`);
        console.log(`  Status: ${this.getStatusName(status)}`);

        if (status !== 1) {
          console.log(`  ⚠️  Not optimized! Check for deopt triggers.`);
        }
      } catch {
        console.log(`  Unable to check status (natives syntax required)`);
      }

      console.log('');
    }
  }

  getStatusName(status) {
    const names = {
      1: '✓ Optimized',
      2: '✗ Not optimized',
      3: '✓ Always optimized',
      4: '✗ Never optimized',
      6: '⚠️  Maybe deoptimized',
      7: '✓ TurboFan optimized'
    };
    return names[status] || `Unknown (${status})`;
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
function getPointValue(point) {
  return point.value; // Always Point shape
}

class Point {
  constructor(value, x = 0, y = 0) {
    this.value = value; // Always same shape
    this.x = x;
    this.y = y;
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
function toString(value) {
  return value.toString(); // Polymorphic!
}

// Use type-specific functions
function numberToString(num) {
  return String(num);
}

function objectToString(obj) {
  return JSON.stringify(obj);
}

function arrayToString(arr) {
  return arr.join(',');
}

// Dispatch based on type (once)
function convertToString(value) {
  if (typeof value === 'number') {
    return numberToString(value);
  } else if (Array.isArray(value)) {
    return arrayToString(value);
  } else if (typeof value === 'object') {
    return objectToString(value);
  }
  return String(value);
}

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
function polymorphicSum(items) {
  let sum = 0;
  for (const item of items) {
    sum += item.value; // Different shapes!
  }
  return sum;
}

// Monomorphic version
function monomorphicSum(items) {
  let sum = 0;
  for (const item of items) {
    sum += item.value; // Same shape!
  }
  return sum;
}

// Test data
const polyData = [
  { value: 1 },
  { value: 2, x: 0 },
  { value: 3, y: 0 },
  { value: 4, x: 0, y: 0 },
  { value: 5, z: 0 }
];

class Item {
  constructor(value) {
    this.value = value;
  }
}

const monoData = [
  new Item(1),
  new Item(2),
  new Item(3),
  new Item(4),
  new Item(5)
];

// Warm up
for (let i = 0; i < 10000; i++) {
  polymorphicSum(polyData);
  monomorphicSum(monoData);
}

// Benchmark
console.time('Polymorphic');
for (let i = 0; i < 1000000; i++) {
  polymorphicSum(polyData);
}
console.timeEnd('Polymorphic');

console.time('Monomorphic');
for (let i = 0; i < 1000000; i++) {
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
  constructor(x, y, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z; // Always initialized, even if 0
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
  constructor(factory, size = 100) {
    this.factory = factory;
    this.available = [];
    this.inUse = new Set();

    // Pre-create objects with consistent shape
    for (let i = 0; i < size; i++) {
      this.available.push(factory());
    }
  }

  acquire() {
    let obj;

    if (this.available.length > 0) {
      obj = this.available.pop();
    } else {
      obj = this.factory();
    }

    this.inUse.add(obj);
    return obj;
  }

  release(obj) {
    if (!this.inUse.has(obj)) {
      throw new Error('Object not from this pool');
    }

    this.inUse.delete(obj);
    this.reset(obj);
    this.available.push(obj);
  }

  reset(obj) {
    // Reset to initial state without changing shape
    Object.keys(obj).forEach(key => {
      if (typeof obj[key] === 'number') {
        obj[key] = 0;
      } else if (typeof obj[key] === 'string') {
        obj[key] = '';
      } else if (typeof obj[key] === 'boolean') {
        obj[key] = false;
      } else if (obj[key] === null) {
        obj[key] = null;
      }
    });
  }
}

// Usage
const pointPool = new ObjectPool(
  () => ({ x: 0, y: 0, z: 0 }),
  1000
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
  constructor(type) {
    // Initialize ALL properties for all entity types
    this.type = type;
    this.id = 0;
    this.active = false;

    // Position (all entities)
    this.x = 0;
    this.y = 0;
    this.z = 0;

    // Physics (all entities)
    this.vx = 0;
    this.vy = 0;
    this.vz = 0;

    // Rendering (all entities)
    this.sprite = null;
    this.visible = true;
    this.opacity = 1;

    // Health (all entities, even if not used)
    this.health = 100;
    this.maxHealth = 100;

    // AI (all entities, even if not used)
    this.aiState = 'idle';
    this.target = null;
  }

  // Type-specific behavior, but same shape
  update(deltaTime) {
    switch (this.type) {
      case 'player':
        this.updatePlayer(deltaTime);
        break;
      case 'enemy':
        this.updateEnemy(deltaTime);
        break;
      case 'projectile':
        this.updateProjectile(deltaTime);
        break;
    }
  }

  updatePlayer(deltaTime) {
    // Player logic uses: x, y, vx, vy, health
    this.x += this.vx * deltaTime;
    this.y += this.vy * deltaTime;
  }

  updateEnemy(deltaTime) {
    // Enemy logic uses: x, y, aiState, target, health
    if (this.aiState === 'chase' && this.target) {
      const dx = this.target.x - this.x;
      const dy = this.target.y - this.y;
      // Move toward target
    }
  }

  updateProjectile(deltaTime) {
    // Projectile logic uses: x, y, vx, vy
    this.x += this.vx * deltaTime;
    this.y += this.vy * deltaTime;
  }
}

// All entities have identical hidden class - very fast!
const entities = [
  new Entity('player'),
  new Entity('enemy'),
  new Entity('enemy'),
  new Entity('projectile')
];

// Hot loop is optimized - monomorphic, no transitions
function updateAll(entities, deltaTime) {
  for (let i = 0; i < entities.length; i++) {
    entities[i].update(deltaTime);
  }
}
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
```bash
# Node.js with natives syntax
node --allow-natives-syntax script.js

# Check if function is optimized
%OptimizeFunctionOnNextCall(myFunction);
myFunction();
const status = %GetOptimizationStatus(myFunction);
```

### Trace Optimization
```bash
# See what gets optimized
node --trace-opt script.js

# See what gets deoptimized
node --trace-deopt script.js

# See inline cache status
node --trace-ic script.js

# Combined
node --trace-opt --trace-deopt --trace-ic script.js
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
