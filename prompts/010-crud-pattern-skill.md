# Create CRUD Pattern Skill Document

<objective>
Create a production-quality skill document for implementing reusable CRUD patterns in Axum applications, based on the research conducted in the previous step.

This skill will enable developers to rapidly add CRUD operations for any entity while maintaining type safety, testability, and database portability.
</objective>

<context>
## Research Foundation

Read the comprehensive research document:
@./research/crud-pattern-analysis.md

This research provides:
- Trait designs
- Architecture patterns
- Implementation strategies
- Code examples
- Best practices

Your task is to transform this research into a clear, actionable skill document.

## Target Audience

Developers who need to:
- Add CRUD operations for new entities (routes, users, posts, etc.)
- Migrate from JSON files to databases
- Maintain type safety and testability
- Follow Axum service architecture patterns

## Related Skills

The CRUD skill should integrate with:
- axum-service-architecture (layered design, AppState, FromRef)
- axum-web-framework (handlers, extractors, error handling)
- rust-core-patterns (newtypes, traits, type states)
- rust-error-handling (error types, HTTP mapping)
- rust-feature-architecture (organizing CRUD within features)
</context>

<requirements>
## Skill Document Structure

Create: `.claude/skills/axum-crud-patterns/SKILL.md`

The skill must include:

### 1. Frontmatter
```yaml
---
name: axum-crud-patterns
description: Reusable CRUD patterns for Axum with trait-based repositories, JSON file storage, and database portability. Use when adding CRUD operations for entities, migrating from files to databases, or building admin interfaces.
---
```

### 2. Overview Section
- What problem this skill solves
- When to use it
- Key benefits (type safety, portability, testability)
- Version context (Axum, Tokio, async-trait versions)

### 3. Core Concepts

**CRUD Trait Hierarchy:**
- `CrudRepository<T, ID>` - The main trait
- `Entity` - Trait for CRUD entities
- `CrudError` - Error type with HTTP mapping
- Type parameters and constraints

**Repository Pattern:**
- Why repository pattern?
- Abstraction benefits
- Dependency injection

### 4. Entity Definition

How to define CRUD entities:
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Route {
    pub path: String,      // Primary key
    pub name: String,
    pub block_ids: Vec<String>,
}

impl Entity for Route {
    type Id = String;
    fn id(&self) -> &Self::Id {
        &self.path
    }
}
```

### 5. CrudRepository Trait

Complete trait definition with:
- Async methods (create, read, update, delete, list)
- Error handling
- Documentation
- Type constraints

### 6. JSON File Implementation

`JsonCrudRepository<T>` implementation:
- File path management
- JSON serialization/deserialization
- Error handling with fallbacks
- Atomic writes

Complete working example for routes.

### 7. Service Layer Integration

How to use CRUD repositories in services:
```rust
pub struct RouteService<R: CrudRepository<Route, String>> {
    repository: Arc<R>,
}
```

### 8. Handler Layer Integration

Axum handlers that use CRUD services:
```rust
async fn create_route(
    State(service): State<Arc<RouteService<JsonCrudRepository<Route>>>>,
    Json(route): Json<Route>,
) -> Result<Json<Route>, CrudError> {
    let created = service.create(route).await?;
    Ok(Json(created))
}
```

### 9. AppState Configuration

Setting up dependency injection:
```rust
#[derive(Clone, FromRef)]
pub struct AppState {
    pub route_repository: Arc<JsonCrudRepository<Route>>,
    pub route_service: Arc<RouteService<JsonCrudRepository<Route>>>,
}
```

### 10. Router Setup

Complete router configuration:
```rust
pub fn admin_routes() -> Router<AppState> {
    Router::new()
        .route("/api/routes", get(list_routes).post(create_route))
        .route("/api/routes/:id", get(get_route).put(update_route).delete(delete_route))
}
```

### 11. Error Handling

`CrudError` enum with:
- Variants (NotFound, AlreadyExists, InvalidInput, StorageError)
- IntoResponse implementation
- HTTP status mapping
- Context and logging

### 12. Database Portability

How to implement `PostgresCrudRepository<T>`:
- Connection pooling
- SQL queries (sqlx examples)
- Transaction handling
- Migration considerations

Show how to swap implementations without changing business logic.

### 13. Adding a New Entity

Step-by-step guide:
1. Define entity struct with Entity trait
2. Create repository instance
3. Create service (optional)
4. Create handlers
5. Wire up in AppState
6. Register routes
7. Test

Complete walkthrough with code examples.

### 14. Validation Patterns

Entity validation:
- Smart constructors
- Validation trait
- Error handling
- Integration with create/update operations

### 15. Testing Strategies

- Unit tests (repository logic)
- Integration tests (HTTP endpoints)
- Mock repositories for testing services
- Contract tests for trait implementations

### 16. Production Patterns

**Observability:**
- Tracing instrumentation
- Metrics collection
- Structured logging

**Security:**
- Input validation
- SQL injection prevention
- Authorization hooks

**Performance:**
- Connection pooling
- Caching strategies
- Pagination

### 17. Advanced Patterns

**Filtering and Pagination:**
```rust
async fn list(&self, filter: QueryFilter) -> Result<Page<T>, CrudError>;
```

**Soft Deletes:**
```rust
async fn soft_delete(&self, id: ID) -> Result<(), CrudError>;
```

**Audit Logging:**
```rust
async fn create_with_audit(&self, entity: T, user: UserId) -> Result<T, CrudError>;
```

### 18. Best Practices

DO:
- Use traits for abstraction
- Validate at entity construction
- Handle errors explicitly
- Test repository implementations
- Use Arc for shared repositories

DON'T:
- Mix storage concerns in handlers
- Ignore validation errors
- Use unwrap() in production code
- Hard-code storage paths
- Skip error logging

### 19. Common Dependencies

```toml
[dependencies]
axum = { version = "0.8", features = ["macros"] }
tokio = { version = "1", features = ["full"] }
async-trait = "0.1"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
thiserror = "2"
uuid = { version = "1", features = ["v4", "serde"] }
sqlx = { version = "0.8", features = ["postgres", "runtime-tokio-rustls"], optional = true }
```

### 20. Complete Example

Full working implementation of routes CRUD:
- Entity definition
- Repository implementation
- Service layer
- Handlers
- AppState
- Router
- Error handling
- Tests

This should be production-ready code that developers can copy and adapt.
</requirements>

<implementation>
## Writing Guidelines

**Tone and Style:**
- Clear, concise, and practical
- Production-focused (not academic)
- Code-first with explanations
- Follow patterns from existing skills

**Code Quality:**
- All code examples must be production-grade
- Include error handling
- Use proper type annotations
- Follow Rust naming conventions
- Add documentation comments

**Organization:**
- Use clear headings and subheadings
- Progressive disclosure (simple → advanced)
- Cross-reference related skills
- Include "When to Use" sections

**Examples:**
- Complete, runnable examples
- Show both JSON and database implementations
- Demonstrate error handling
- Include tests

## Validation

Use @agent-graydon-rust-engineer to review:
- Trait designs are sound
- Error handling is production-grade
- Examples follow best practices
- Security considerations are addressed
- Testing patterns are comprehensive
</implementation>

<output>
Create the skill file at:
`./. claude/skills/axum-crud-patterns/SKILL.md`

The skill document should be:
- Comprehensive (2500+ lines)
- Production-ready
- Immediately actionable
- Well-organized
- Rich with examples
</output>

<success_criteria>
- Skill document follows existing skill format and style
- All code examples are complete and correct
- Trait-based design enables swappable implementations
- JSON file implementation is production-ready
- Database migration path is clear
- Adding new entities is straightforward
- Error handling is robust
- Testing patterns are comprehensive
- Integrates with existing architecture
- Reviewed by graydon-rust-engineer agent
</success_criteria>

<verification>
Before completing, verify:
- [ ] Research document has been read and incorporated
- [ ] All 20 required sections are present
- [ ] Code examples compile conceptually
- [ ] Complete routes CRUD example is included
- [ ] Database portability is demonstrated
- [ ] Graydon-rust-engineer has reviewed
- [ ] File is saved to .claude/skills/axum-crud-patterns/SKILL.md
- [ ] Frontmatter includes accurate description
- [ ] Related skills are referenced
- [ ] Production considerations are covered
</verification>
