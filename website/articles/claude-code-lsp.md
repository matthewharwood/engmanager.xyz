I asked Claude to refactor a function used in 47 places across our monorepo.

### Before LSP

- Found 31 usages via grep
- Missed 16 (aliased imports, re-exports, interface implementations)

### After LSP

- Found all 47
- Understood that `UserService` implements `IUserService` which extends `BaseService`

**That's the difference between searching text and understanding code.**

## The one-sentence explanation

LSP gives Claude Code the same "Go to Definition" and "Find All References" powers your IDE has.

When you Ctrl+Click in VS Code? That's LSP.

Now Claude Code can do it too.

## Five capabilities unlocked

- **Go to Definition** — jump to where code is defined
- **Find References** — every usage across the repo
- **Hover** — type hints and documentation
- **Document Symbols** — list all symbols in a file
- **Workspace Symbols** — search symbols project-wide

Plus real-time diagnostics after every edit.

## TypeScript setup (4 steps, ~5 minutes)

**Step 1: Enable LSP tools** — add this to your `.bashrc` or `.zshrc`:

```bash
export ENABLE_LSP_TOOLS=1
```

**Step 2: Install the language server**

```bash
npm install -g @vtsls/language-server typescript
```

**Step 3: Install the plugin**

- Open Claude Code
- Type `/plugin`
- Find `vtsls` or `typescript-lsp`
- Install

**Step 4: Restart Claude Code**

Ask Claude: "What tools do you have?"

You should see the five LSP operations. You now have IDE-grade intelligence in your terminal.

## When LSP really helps

Use it when:

- Your codebase has hundreds of files
- You're tracing function calls across modules
- You need exact type signatures
- You're refactoring and need to know what breaks

For quick string searches, grep is still faster. For semantic navigation, LSP wins.

## First thing to try

Pick the most tangled function in your codebase.

Ask Claude:

> "Find all references to this function using LSP and explain how it's used in each context."

This is where you'll feel the difference.

## The shift

Before LSP, Claude Code did sophisticated text manipulation.

Now it queries the same semantic understanding your IDE uses. It knows about type hierarchies, interface implementations, and re-exports — the structure grep can't see.

If you're working in a Python, TypeScript, or Rust codebase of any real size, the five-minute setup changes things.

## Drop-in Claude Code skill

Here's a Claude Code skill you can copy directly:

````md
---
name: navigating-with-lsp
description: Navigates codebases using Language Server Protocol for semantic understanding instead of text search. Use when finding references, jumping to definitions, or tracing type hierarchies in TypeScript or Rust.
---

# LSP Codebase Navigation

**Updated**: December 2025

> **Why LSP over grep?** grep searches text. LSP understands code. When you need "find all usages of this function," grep misses aliased imports, re-exports, and interface implementations. LSP finds them all because it queries the same semantic graph your IDE uses.

## When to Use LSP vs Text Search

| Task | Use LSP | Use Grep/Glob |
|------|---------|---------------|
| Find all references to a function | `lsp_find_references` | - |
| Jump to function definition | `lsp_go_to_definition` | - |
| Trace interface implementations | `lsp_find_references` | - |
| Get type signature | `lsp_hover` | - |
| List exports in a file | `lsp_document_symbols` | - |
| Search for a string literal | - | `Grep` |
| Find files by naming pattern | - | `Glob` |
| Quick keyword search | - | `Grep` |

**Rule**: Semantic navigation → LSP. Text pattern matching → Grep.

## Available LSP Operations

### `lsp_go_to_definition`

Jump to where a symbol is defined.

```typescript
// Usage: Position cursor on symbol, call lsp_go_to_definition
import { createUser } from '@/services/user';
//       ^^^^^^^^^^
// lsp_go_to_definition → jumps to user.ts:42 where createUser is defined
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `filePath` | string | Absolute path to the file |
| `line` | number | 0-indexed line number |
| `character` | number | 0-indexed character position |

### `lsp_find_references`

Find every usage of a symbol across the codebase.

```typescript
// In user-service.ts:15
export function createUser(data: UserData): User { ... }
//              ^^^^^^^^^^
// lsp_find_references finds:
// - api/routes/users.ts:23 (direct import)
// - services/admin.ts:45 (re-exported as adminCreateUser)
// - tests/user.test.ts:12 (test usage)
// - types/index.ts:8 (type reference via ReturnType<typeof createUser>)
```

**Why this beats grep**: `grep "createUser"` would miss the `adminCreateUser` alias and the `ReturnType<>` usage.

### `lsp_hover`

Get type information and documentation for a symbol.

```typescript
const result = await fetchUser(id);
//    ^^^^^^
// lsp_hover returns:
// const result: Promise<User | null>
// @param id - The user's unique identifier
// @returns The user object or null if not found
```

### `lsp_document_symbols`

List all symbols (functions, classes, types, variables) in a file.

```typescript
// lsp_document_symbols on user-service.ts returns:
// - createUser (Function) line 15
// - updateUser (Function) line 42
// - deleteUser (Function) line 78
// - UserService (Class) line 95
// - UserData (Interface) line 5
```

### `lsp_workspace_symbols`

Search for symbols across the entire project.

```typescript
// lsp_workspace_symbols("UserService") finds:
// - services/user-service.ts:95 (Class)
// - services/admin/user-service.ts:12 (Class)
// - types/services.ts:34 (Interface IUserService)
```

## TypeScript Patterns

### Tracing Type Hierarchies

```typescript
// Given: UserService implements IUserService extends BaseService
// To find all implementations of IUserService:

// 1. Go to IUserService definition
lsp_go_to_definition("types/services.ts", 34, 10)

// 2. Find all references (includes implementations)
lsp_find_references("types/services.ts", 34, 10)
// Returns: UserService, AdminUserService, MockUserService
```

### Finding Re-exports

```typescript
// index.ts re-exports:
export { createUser } from './user-service';
export { createUser as create } from './user-service';

// lsp_find_references on the original createUser finds both exports
// grep would miss the alias
```

### Tracing Generic Type Usage

```typescript
// Finding all usages of a generic type parameter
type Result<T> = { data: T; error: null } | { data: null; error: Error };
//          ^
// lsp_find_references shows where Result is instantiated:
// - Result<User>
// - Result<Order[]>
// - Result<void>
```

## Refactoring Workflow

### Before Refactoring Any Symbol

```
1. POSITION   → Identify the symbol's definition location
2. REFERENCES → lsp_find_references to find ALL usages
3. ANALYZE    → Review each reference for context
4. PLAN       → Create change manifest for all affected files
5. EXECUTE    → Edit in dependency order
6. VERIFY     → Re-run lsp_find_references to confirm changes
```

### Example: Renaming a Function

```typescript
// Task: Rename createUser → createNewUser

// Step 1: Find definition
lsp_go_to_definition("api/users.ts", 23, 15)
// → services/user-service.ts:15

// Step 2: Find all references
lsp_find_references("services/user-service.ts", 15, 16)
// Returns 47 locations across 12 files

// Step 3: Create change manifest
// File                          | Line | Change
// -----------------------------|------|--------
// services/user-service.ts     | 15   | Definition
// services/index.ts            | 3    | Re-export
// api/routes/users.ts          | 23   | Import + usage
// ... (44 more)

// Step 4: Execute changes in order
// Step 5: Verify with lsp_find_references("createNewUser")
```

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Using grep for "find all usages" | Use `lsp_find_references` |
| Grepping function name misses aliases | LSP traces through re-exports |
| Missing interface implementations | `lsp_find_references` on interface finds all `implements` |
| Searching for type usage with grep | `lsp_find_references` finds generic instantiations |
| Editing without finding all references | Always `lsp_find_references` before refactoring |

## Best Practices

1. **Always lsp_find_references before refactoring** - Never assume you know all usages
2. **Use lsp_hover to verify types** - Don't guess at function signatures
3. **Check lsp_document_symbols first** - Understand file structure before diving in
4. **Combine with grep for text patterns** - LSP for semantics, grep for literals
5. **Trust LSP over assumptions** - If LSP says 47 references, there are 47 references

## Rust Support

LSP works identically for Rust via `rust-analyzer`:

```rust
// Find all usages of a trait method
impl UserRepository for PostgresRepo {
    fn create_user(&self, data: UserData) -> Result<User> { ... }
//      ^^^^^^^^^^^
// lsp_find_references finds:
// - Trait definition
// - All implementations
// - All call sites
}
```

## Evaluation

```bash
# Check LSP is enabled
echo $ENABLE_LSP_TOOLS
# Expected: 1

# Check vtsls is installed (TypeScript)
which vtsls && echo "vtsls installed" || echo "vtsls missing"

# Check rust-analyzer is installed (Rust)
which rust-analyzer && echo "rust-analyzer installed" || echo "rust-analyzer missing"

# Verify LSP tools are available
# Ask Claude: "What LSP tools do you have?"
# Expected: lsp_go_to_definition, lsp_find_references, lsp_hover, lsp_document_symbols, lsp_workspace_symbols

# Test LSP on a known function (replace with actual path)
# lsp_find_references on a commonly-used utility should return multiple results
```
````
