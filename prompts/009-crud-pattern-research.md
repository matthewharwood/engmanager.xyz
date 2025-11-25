# Deep Research: Reusable CRUD Pattern for Axum

<objective>
Conduct comprehensive research to design a reusable, trait-based CRUD pattern for Axum applications that:
- Works with JSON files initially but is extensible to databases
- Is configuration-focused (not convention-based like Rails)
- Scales to any number of entities
- Integrates with existing feature-based architecture
- Follows Rust best practices for type safety and abstraction

This research will inform the creation of a production-quality skill document.
</objective>

<context>
## Current Codebase State

The application uses:
- **Feature-based architecture**: `src/core/`, `src/features/`, `src/pages/`
- **JSON file persistence**: Routes and content stored in `data/` directory
- **Axum service patterns**: Layered architecture (Router → Handler → Service → Repository)
- **Type-safe blocks**: Enum-based content system with serde serialization

## Existing Patterns to Study

@.claude/skills/axum-service-architecture/SKILL.md
@.claude/skills/axum-web-framework/SKILL.md
@.claude/skills/rust-core-patterns/SKILL.md
@.claude/skills/rust-feature-architecture.md

## Current Implementation

@website/src/core/persistence.rs - Shows current JSON file operations
@website/src/pages/admin/api.rs - Shows current API endpoints
@data/routes.json - Example entity to CRUD

The `Route` struct and persistence functions demonstrate the existing pattern that needs to be abstracted.
</context>

<research_requirements>
## 1. Analyze Existing Patterns

Thoroughly examine the current codebase to understand:
- How `Route` is currently stored and retrieved (persistence.rs:77-86, 266-288)
- How admin API endpoints work (api.rs)
- How the feature-based architecture organizes CRUD operations
- What patterns exist that can be generalized

## 2. Study Axum Service Architecture

Review the skills to identify:
- How service layers should be structured (Router → Handler → Service → Repository)
- How AppState and FromRef enable dependency injection
- How to use traits for swappable implementations (database vs. file)
- Error handling patterns with thiserror and IntoResponse

## 3. Research CRUD Abstraction Patterns

Investigate how to create a **trait-based CRUD system** that:
- Defines operations: Create, Read, Update, Delete, List
- Abstracts storage backend (JSON files, PostgreSQL, SQLite, etc.)
- Uses Rust's type system for compile-time safety
- Supports async operations (required for database drivers)
- Handles errors gracefully with proper HTTP mapping

Consider patterns like:
```rust
#[async_trait]
pub trait CrudRepository<T, ID> {
    async fn create(&self, entity: T) -> Result<T, CrudError>;
    async fn read(&self, id: ID) -> Result<T, CrudError>;
    async fn update(&self, id: ID, entity: T) -> Result<T, CrudError>;
    async fn delete(&self, id: ID) -> Result<(), CrudError>;
    async fn list(&self) -> Result<Vec<T>, CrudError>;
}
```

## 4. Design for Database Portability

Research how to structure the system so:
- File-based implementation works now (JSON in `data/`)
- Database implementation can be swapped later (sqlx, diesel, sea-orm)
- Entity definitions are storage-agnostic
- Migrations and schema management are considered

## 5. Configuration vs. Convention

Define what "configuration-focused" means:
- Explicit trait implementations (not magic macros)
- Clear dependency wiring in AppState
- Type-safe route registration
- Explicit error handling

Compare to Rails conventions and explain the Rust approach.

## 6. Integration with Feature Architecture

Determine how CRUD fits into:
- `src/core/` - Should CRUD traits live here?
- `src/features/admin/` - Should CRUD handlers live here?
- `src/pages/` - How do pages consume CRUD operations?

## 7. Scalability to Multiple Entities

Design patterns for:
- Adding new entities (User, Post, Comment, etc.)
- Reusing CRUD boilerplate
- Entity-specific validation
- Relationships between entities

## 8. Use Graydon-Rust-Engineer Agent

Leverage @agent-graydon-rust-engineer to:
- Review production-grade patterns for Axum services
- Validate trait design for type safety
- Suggest error handling approaches
- Recommend testing strategies
- Ensure alignment with Rust best practices
</research_requirements>

<deliverables>
Create a comprehensive research document saved to: `./research/crud-pattern-analysis.md`

The document should include:

## 1. Executive Summary
- High-level overview of the proposed CRUD pattern
- Key design decisions and trade-offs
- Why this approach fits the existing architecture

## 2. Current State Analysis
- Detailed breakdown of existing persistence.rs patterns
- What works well and what needs abstraction
- Dependencies and integration points

## 3. CRUD Trait Design
- Complete trait definitions with documentation
- Type parameters and their constraints
- Error types and handling strategy
- Example implementations (JsonCrudRepository, PostgresCrudRepository)

## 4. Service Layer Architecture
- How CRUD repositories integrate with Axum handlers
- AppState configuration for dependency injection
- Router setup and endpoint registration
- Middleware considerations

## 5. Entity Definition Patterns
- How to define CRUD entities (traits, derives, validations)
- Primary key strategies (UUIDs, auto-increment, composite keys)
- Serialization requirements (serde)
- Validation patterns (smart constructors, newtypes)

## 6. File vs. Database Implementation
- JsonCrudRepository: Full implementation for routes.json
- Database considerations: Connection pooling, transactions, migrations
- Swappability: How to change backends without touching business logic

## 7. Configuration-Focused Design
- Explicit vs. implicit patterns
- Type-safe configuration
- Comparison to Rails conventions
- Benefits of the Rust approach

## 8. Scaling to Multiple Entities
- Step-by-step guide for adding a new CRUD entity
- Code generation considerations (macros vs. manual)
- Boilerplate reduction strategies
- Testing patterns

## 9. Error Handling Strategy
- CrudError type design
- HTTP status code mapping
- Context and logging
- User-facing vs. internal errors

## 10. Production Considerations
- Observability (tracing, metrics)
- Testing strategies (unit, integration, contract tests)
- Performance considerations
- Security (validation, sanitization, authorization)

## 11. Code Examples
- Complete working example for routes CRUD
- Handler, service, and repository layers
- AppState setup
- Router configuration
- Admin API endpoints

## 12. Implementation Roadmap
- Recommended order of implementation
- What to build first vs. what can wait
- Migration strategy from current code
- Testing checkpoints

## 13. Skill Document Outline
- Proposed structure for the final skill
- Key sections and patterns to document
- Usage examples
- Related skills to reference
</deliverables>

<methodology>
1. **Read all referenced files** to understand current patterns
2. **Use @agent-graydon-rust-engineer** for expert Rust/Axum guidance
3. **Think deeply** about abstraction boundaries and type safety
4. **Consider multiple approaches** and document trade-offs
5. **Provide concrete examples** with actual code
6. **Be systematic** - cover all aspects methodically
7. **Go beyond basics** - this should be production-grade research
</methodology>

<success_criteria>
- Research document is comprehensive (3000+ words)
- Includes working code examples that compile conceptually
- Addresses all requirements in the deliverables section
- Provides clear guidance for implementing the pattern
- Considers edge cases and production concerns
- Integrates seamlessly with existing architecture
- Can directly inform skill document creation
</success_criteria>

<verification>
Before completing, verify:
- [ ] All existing files have been read and analyzed
- [ ] Graydon-rust-engineer agent has been consulted
- [ ] Trait designs are sound and follow Rust best practices
- [ ] Examples are concrete and detailed
- [ ] Database portability is clearly addressed
- [ ] Scaling strategy is well-defined
- [ ] Error handling is production-grade
- [ ] Research document is saved to ./research/crud-pattern-analysis.md
</verification>
