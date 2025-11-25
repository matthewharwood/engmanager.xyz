# Building a Trait-Based CRUD Pattern with SurrealDB

*A test-driven tutorial on designing storage-agnostic data layers*

---

## Prerequisites

Before starting this tutorial, complete the [SurrealDB Setup Guide](./surrealdb-setup.md). You should have:

- SurrealDB CLI installed (`surreal version`)
- Understanding of SurrealDB's namespace/database structure
- Ability to run embedded SurrealDB from Rust

---

## What You Will Learn

By the end of this tutorial, you will understand:

1. Why the repository pattern exists and what problems it solves
2. How Rust traits enable swappable storage backends
3. How to implement a SurrealDB repository with type-safe operations
4. How to wire dependencies through Axum's state system
5. How to build a minimal, working CRUD system from scratch

This is a **test-driven learning** tutorial. After each section, you will:

1. Write the code
2. Run a test
3. See it pass
4. Know you can proceed

---

## Part 1: Project Setup

### Standalone Workspace Structure

The CRUD pattern exists as its own Cargo workspace, **separate from any application**. This allows:

- Independent development and testing
- Clear dependency boundaries
- Reusability across projects

Create this structure:

```
your-project/
├── crates/
│   └── crud/                  # Standalone CRUD library
│       ├── Cargo.toml
│       └── src/
│           ├── lib.rs
│           ├── entity.rs
│           ├── repository.rs
│           ├── surreal.rs
│           └── error.rs
├── website/                   # Your application (later)
│   └── Cargo.toml
└── Cargo.toml                 # Workspace root
```

### Step 1: Create the Workspace Root

Create `Cargo.toml` at the project root:

```toml
[workspace]
members = [
    "crates/crud",
    # "website",  # Uncomment when ready to integrate
]
resolver = "2"

[workspace.dependencies]
surrealdb = { version = "2", features = ["kv-rocksdb"] }
tokio = { version = "1", features = ["full"] }
thiserror = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

### Step 2: Create the CRUD Crate

Create `crates/crud/Cargo.toml`:

```toml
[package]
name = "crud"
version = "0.1.0"
edition = "2021"

[dependencies]
surrealdb = { workspace = true }
tokio = { workspace = true }
thiserror = { workspace = true }
serde = { workspace = true }
serde_json = { workspace = true }

[dev-dependencies]
tokio = { workspace = true }
```

Create `crates/crud/src/lib.rs`:

```rust
//! A trait-based CRUD pattern for storage-agnostic data layers.

pub mod entity;
pub mod error;
pub mod repository;
pub mod surreal;

pub use entity::Entity;
pub use error::{RepositoryError, StorageError};
pub use repository::{ReadRepository, WriteRepository, CrudRepository};
pub use surreal::SurrealRepository;
```

### Checkpoint: Verify Project Compiles

Create placeholder files:

```bash
mkdir -p crates/crud/src
touch crates/crud/src/entity.rs
touch crates/crud/src/error.rs
touch crates/crud/src/repository.rs
touch crates/crud/src/surreal.rs
```

Run:

```bash
cargo check -p crud
```

Expected output:

```
    Checking crud v0.1.0 (...)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.XXs
```

If this compiles, your workspace structure is correct.

---

## Part 2: The Problem

### The Coupling Trap

Imagine you have an admin panel that manages "routes" (URL paths on your website). Today, you write database calls directly in your handler:

```rust
pub async fn update_route(
    State(db): State<Surreal<Db>>,
    Json(route): Json<Route>,
) -> Result<String, String> {
    let _: Option<Route> = db
        .update(("routes", &route.path))
        .content(&route)
        .await
        .map_err(|e| e.to_string())?;
    Ok("Updated".into())
}
```

This works. But notice the problems:

1. **Tight coupling**: The handler contains raw database operations. If you switch to PostgreSQL, you change the handler.

2. **Testing difficulty**: How do you test `update_route` without a real database? You cannot easily inject a fake storage layer.

3. **Error types are stringly-typed**: `Result<String, String>` tells you nothing about what went wrong.

4. **No validation boundary**: Where do you validate that a route's path starts with `/`? In the handler? In the query? Both?

### The Goal

We want handlers like this:

```rust
pub async fn update_route(
    State(repo): State<Arc<RouteRepository>>,  // Injected dependency
    Path(id): Path<String>,
    Json(route): Json<Route>,
) -> Result<Json<Route>, ApiError> {  // Typed errors
    let updated = repo.update(&route).await?;  // Async, storage-agnostic
    Ok(Json(updated))
}
```

The handler does not know or care whether `RouteRepository` stores data in SurrealDB, SQLite, or Redis.

---

## Part 3: Mental Models

### The Onion Architecture

Picture an onion with four layers:

```
    +-------------------------------------+
    |           HTTP Layer                |  <- Axum Router + Handlers
    |  (knows about requests/responses)   |
    +-------------------------------------+
                    |
                    v
    +-------------------------------------+
    |          Service Layer              |  <- Business logic (optional)
    |    (knows about domain rules)       |
    +-------------------------------------+
                    |
                    v
    +-------------------------------------+
    |        Repository Layer             |  <- CRUD operations
    |   (knows about data operations)     |
    +-------------------------------------+
                    |
                    v
    +-------------------------------------+
    |         Storage Layer               |  <- SurrealDB, SQLite
    |    (knows about persistence)        |
    +-------------------------------------+
```

**The rule**: Each layer only talks to the layer directly below it.

**The benefit**: You can swap the storage layer without changing anything above it.

### Plug and Socket

Traits in Rust are like electrical sockets:

```
    +--------------+
    |   Handler    |  "I need something that can find_all() and create()"
    |  (Appliance) |
    +------+-------+
           |
           v
    ===============  <- Trait (Socket): CrudRepository<Route, String>
           |
           |  (Any implementation that fits can plug in)
           |
    +------+-------+     +--------------+     +--------------+
    | SurrealCrud  |     | SqliteCrud   |     | InMemoryCrud |
    | Repository   |     | Repository   |     | Repository   |
    |  (Plug A)    |     |   (Plug B)   |     |  (Plug C)    |
    +--------------+     +--------------+     +--------------+
```

The handler declares: "I need a `CrudRepository`." In production, connect the SurrealDB plug. In tests, connect the InMemory plug.

---

## Part 4: The Entity Trait

The `Entity` trait defines what it means to be a storable thing.

### Write the Code

Create `crates/crud/src/entity.rs`:

```rust
//! The Entity trait for identifiable, storable types.

use std::fmt::Display;
use std::hash::Hash;

/// An entity that can be stored and retrieved.
///
/// Entities have a primary key (ID) that uniquely identifies them.
pub trait Entity: Clone + Send + Sync + 'static {
    /// The type of the primary key.
    type Id: Clone + Eq + Hash + Send + Sync + Display;

    /// Return this entity's primary key.
    fn id(&self) -> &Self::Id;
}
```

Why these bounds?

- `Clone`: Repositories often return owned copies
- `Send + Sync + 'static`: Required for async Rust and sharing across threads
- `Id: Eq + Hash`: So we can use IDs in HashMaps and compare them
- `Id: Display`: So we can include IDs in error messages

Note: We do not require `Serialize + Deserialize` here. That is an implementation detail of specific repositories.

### Checkpoint: Verify Entity Trait Works

Add this test to the bottom of `crates/crud/src/entity.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    /// A sample entity for testing.
    #[derive(Debug, Clone, PartialEq, Eq)]
    struct Route {
        path: String,
        name: String,
    }

    impl Entity for Route {
        type Id = String;

        fn id(&self) -> &Self::Id {
            &self.path
        }
    }

    #[test]
    fn entity_returns_correct_id() {
        let route = Route {
            path: "/about".to_string(),
            name: "About Page".to_string(),
        };

        assert_eq!(route.id(), "/about");
    }

    #[test]
    fn entity_id_is_hashable() {
        use std::collections::HashMap;

        let route = Route {
            path: "/contact".to_string(),
            name: "Contact".to_string(),
        };

        let mut map: HashMap<String, Route> = HashMap::new();
        map.insert(route.id().clone(), route.clone());

        assert!(map.contains_key("/contact"));
    }

    #[test]
    fn entity_id_is_displayable() {
        let route = Route {
            path: "/home".to_string(),
            name: "Home".to_string(),
        };

        let message = format!("Entity ID: {}", route.id());
        assert_eq!(message, "Entity ID: /home");
    }
}
```

Run with:

```bash
cargo test -p crud entity
```

Expected output:

```
running 3 tests
test entity::tests::entity_returns_correct_id ... ok
test entity::tests::entity_id_is_hashable ... ok
test entity::tests::entity_id_is_displayable ... ok

test result: ok. 3 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out
```

If all tests pass, proceed to Part 5.

---

## Part 5: The Repository Traits

Repository traits define the contract for data operations.

### Write the Code

Create `crates/crud/src/repository.rs`:

```rust
//! Repository traits for CRUD operations.

use crate::error::RepositoryError;
use std::future::Future;

/// Read-only operations.
pub trait ReadRepository<T, ID>: Send + Sync {
    /// Find an entity by its ID.
    fn find_by_id(&self, id: &ID) -> impl Future<Output = Result<Option<T>, RepositoryError>> + Send;

    /// Find all entities.
    fn find_all(&self) -> impl Future<Output = Result<Vec<T>, RepositoryError>> + Send;
}

/// Write operations.
pub trait WriteRepository<T, ID>: Send + Sync {
    /// Create a new entity. Returns error if ID already exists.
    fn create(&self, entity: &T) -> impl Future<Output = Result<T, RepositoryError>> + Send;

    /// Update an existing entity. Returns error if ID not found.
    fn update(&self, entity: &T) -> impl Future<Output = Result<T, RepositoryError>> + Send;

    /// Delete an entity by ID. Returns true if deleted, false if not found.
    fn delete(&self, id: &ID) -> impl Future<Output = Result<bool, RepositoryError>> + Send;
}

/// Full CRUD = Read + Write.
pub trait CrudRepository<T, ID>: ReadRepository<T, ID> + WriteRepository<T, ID> {}

// Blanket implementation: anything that implements both gets CrudRepository for free.
impl<T, ID, R> CrudRepository<T, ID> for R
where
    R: ReadRepository<T, ID> + WriteRepository<T, ID>,
{}
```

Why split Read and Write?

1. **Read replicas**: Reads might go to replicas, writes to primary
2. **Caching layers**: A cache might implement only `ReadRepository`
3. **Interface Segregation**: Not every consumer needs all operations

The `impl Future<...> + Send` syntax is Rust 1.75+ native async traits. No `#[async_trait]` macro needed.

### Checkpoint: Traits Compile

This checkpoint verifies compile-time correctness. There is no runtime test - if it compiles, the traits are correct.

Temporarily add this to `crates/crud/src/repository.rs` to verify the blanket impl works:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::Entity;

    #[derive(Clone)]
    struct MockEntity { id: String }

    impl Entity for MockEntity {
        type Id = String;
        fn id(&self) -> &Self::Id { &self.id }
    }

    // This struct will implement both traits
    struct MockRepo;

    impl ReadRepository<MockEntity, String> for MockRepo {
        async fn find_by_id(&self, _id: &String) -> Result<Option<MockEntity>, RepositoryError> {
            Ok(None)
        }
        async fn find_all(&self) -> Result<Vec<MockEntity>, RepositoryError> {
            Ok(vec![])
        }
    }

    impl WriteRepository<MockEntity, String> for MockRepo {
        async fn create(&self, entity: &MockEntity) -> Result<MockEntity, RepositoryError> {
            Ok(entity.clone())
        }
        async fn update(&self, entity: &MockEntity) -> Result<MockEntity, RepositoryError> {
            Ok(entity.clone())
        }
        async fn delete(&self, _id: &String) -> Result<bool, RepositoryError> {
            Ok(true)
        }
    }

    // This function requires CrudRepository - if it compiles, blanket impl works
    fn accepts_crud_repo<R: CrudRepository<MockEntity, String>>(_repo: R) {}

    #[test]
    fn blanket_impl_provides_crud_repository() {
        let repo = MockRepo;
        accepts_crud_repo(repo);  // Would not compile without blanket impl
    }
}
```

Run with:

```bash
cargo test -p crud blanket_impl
```

Expected output:

```
running 1 test
test repository::tests::blanket_impl_provides_crud_repository ... ok

test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out
```

If this compiles and the test passes, the trait hierarchy is correct.

---

## Part 6: Error Types

Errors flow up through the layers. Each layer has its own error type.

### Write the Code

Create `crates/crud/src/error.rs`:

```rust
//! Error types for the CRUD pattern.

use thiserror::Error;

/// Low-level storage errors (database connections, I/O).
#[derive(Debug, Error)]
pub enum StorageError {
    #[error("database error: {0}")]
    Database(#[from] surrealdb::Error),

    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),
}

/// Repository-layer errors (business logic violations).
#[derive(Debug, Error)]
pub enum RepositoryError {
    #[error("not found: {entity_type} with id '{id}'")]
    NotFound { entity_type: String, id: String },

    #[error("already exists: {entity_type} with id '{id}'")]
    AlreadyExists { entity_type: String, id: String },

    #[error("storage error: {0}")]
    Storage(#[from] StorageError),

    #[error("serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
}

impl From<surrealdb::Error> for RepositoryError {
    fn from(err: surrealdb::Error) -> Self {
        RepositoryError::Storage(StorageError::Database(err))
    }
}
```

### Checkpoint: Verify Error Types

Add tests to `crates/crud/src/error.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn not_found_error_displays_correctly() {
        let err = RepositoryError::NotFound {
            entity_type: "Route".to_string(),
            id: "/about".to_string(),
        };

        assert_eq!(err.to_string(), "not found: Route with id '/about'");
    }

    #[test]
    fn already_exists_error_displays_correctly() {
        let err = RepositoryError::AlreadyExists {
            entity_type: "Route".to_string(),
            id: "/home".to_string(),
        };

        assert_eq!(err.to_string(), "already exists: Route with id '/home'");
    }

    #[test]
    fn io_error_converts_to_storage_error() {
        let io_err = std::io::Error::new(std::io::ErrorKind::NotFound, "file not found");
        let storage_err: StorageError = io_err.into();

        assert!(storage_err.to_string().contains("I/O error"));
    }

    #[test]
    fn storage_error_converts_to_repository_error() {
        let io_err = std::io::Error::new(std::io::ErrorKind::PermissionDenied, "access denied");
        let storage_err = StorageError::Io(io_err);
        let repo_err: RepositoryError = storage_err.into();

        assert!(repo_err.to_string().contains("storage error"));
    }

    #[test]
    fn json_error_converts_to_repository_error() {
        let json_err = serde_json::from_str::<String>("not valid json").unwrap_err();
        let repo_err: RepositoryError = json_err.into();

        assert!(repo_err.to_string().contains("serialization error"));
    }
}
```

Run with:

```bash
cargo test -p crud error
```

Expected output:

```
running 5 tests
test error::tests::already_exists_error_displays_correctly ... ok
test error::tests::io_error_converts_to_storage_error ... ok
test error::tests::json_error_converts_to_repository_error ... ok
test error::tests::not_found_error_displays_correctly ... ok
test error::tests::storage_error_converts_to_repository_error ... ok

test result: ok. 5 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out
```

If all tests pass, proceed to Part 7.

---

## Part 7: SurrealDB Repository Implementation

Now the real implementation. This is a complete, working, type-safe SurrealDB repository.

### Understanding SurrealDB Record IDs

SurrealDB uses a `table:id` format for record IDs. The `Thing` type represents this:

```rust
use surrealdb::sql::Thing;

// A Thing has table and id
let thing = Thing::from(("routes", "homepage"));
// Represents: routes:homepage
```

When working with SurrealDB in Rust, you can:
- Use `Thing` directly for record references
- Use tuples `("table", "id")` for convenience
- Use string IDs and let the repository handle conversion

### Write the Code

Create `crates/crud/src/surreal.rs`:

```rust
//! SurrealDB repository implementation.

use crate::error::RepositoryError;
use crate::repository::{ReadRepository, WriteRepository};
use serde::{Deserialize, Serialize};
use surrealdb::engine::local::Db;
use surrealdb::Surreal;

/// A route entity stored in SurrealDB.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Route {
    pub id: Option<String>,  // SurrealDB can auto-generate or we provide
    pub path: String,
    pub name: String,
    #[serde(default)]
    pub created_at: Option<String>,
    #[serde(default)]
    pub updated_at: Option<String>,
}

impl crate::Entity for Route {
    type Id = String;
    fn id(&self) -> &Self::Id {
        &self.path
    }
}

/// Input for creating a route (without timestamps or ID).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateRoute {
    pub path: String,
    pub name: String,
}

/// Input for updating a route.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateRoute {
    pub path: String,
    pub name: String,
}

/// A repository that stores routes in SurrealDB.
pub struct SurrealRepository {
    db: Surreal<Db>,
    table: String,
}

impl SurrealRepository {
    /// Create a new SurrealDB repository.
    pub fn new(db: Surreal<Db>, table: impl Into<String>) -> Self {
        Self {
            db,
            table: table.into(),
        }
    }

    /// Get a reference to the database connection.
    pub fn db(&self) -> &Surreal<Db> {
        &self.db
    }

    /// Initialize the table schema.
    ///
    /// SurrealDB is schemaless by default, but we can optionally define schema.
    /// This is idempotent - safe to call on every startup.
    pub async fn init_schema(&self) -> Result<(), RepositoryError> {
        // Define table with schema (optional but recommended)
        let query = format!(
            r#"
            DEFINE TABLE IF NOT EXISTS {} SCHEMAFULL;
            DEFINE FIELD IF NOT EXISTS path ON TABLE {} TYPE string;
            DEFINE FIELD IF NOT EXISTS name ON TABLE {} TYPE string;
            DEFINE FIELD IF NOT EXISTS created_at ON TABLE {} TYPE option<datetime> DEFAULT time::now();
            DEFINE FIELD IF NOT EXISTS updated_at ON TABLE {} TYPE option<datetime> DEFAULT time::now();
            DEFINE INDEX IF NOT EXISTS idx_path ON TABLE {} FIELDS path UNIQUE;
            "#,
            self.table, self.table, self.table, self.table, self.table, self.table
        );

        self.db.query(&query).await?;
        Ok(())
    }

    /// Convert a path to a SurrealDB-safe ID.
    ///
    /// SurrealDB IDs cannot contain `/` or other special characters.
    fn path_to_id(path: &str) -> String {
        // Replace / with _ and remove leading _
        path.replace('/', "_").trim_start_matches('_').to_string()
    }

    /// Convert an ID back to a path.
    fn id_to_path(id: &str) -> String {
        format!("/{}", id.replace('_', "/").trim_start_matches('/'))
    }
}

impl ReadRepository<Route, String> for SurrealRepository {
    async fn find_by_id(&self, path: &String) -> Result<Option<Route>, RepositoryError> {
        let id = Self::path_to_id(path);

        let route: Option<Route> = self.db
            .select((&self.table as &str, &id as &str))
            .await?;

        Ok(route)
    }

    async fn find_all(&self) -> Result<Vec<Route>, RepositoryError> {
        let routes: Vec<Route> = self.db
            .select(&self.table as &str)
            .await?;

        Ok(routes)
    }
}

impl WriteRepository<Route, String> for SurrealRepository {
    async fn create(&self, entity: &Route) -> Result<Route, RepositoryError> {
        // Check if already exists
        let existing = self.find_by_id(&entity.path).await?;
        if existing.is_some() {
            return Err(RepositoryError::AlreadyExists {
                entity_type: "Route".to_string(),
                id: entity.path.clone(),
            });
        }

        let id = Self::path_to_id(&entity.path);

        // Create with specific ID
        let created: Option<Route> = self.db
            .create((&self.table as &str, &id as &str))
            .content(entity)
            .await?;

        created.ok_or_else(|| RepositoryError::NotFound {
            entity_type: "Route".to_string(),
            id: entity.path.clone(),
        })
    }

    async fn update(&self, entity: &Route) -> Result<Route, RepositoryError> {
        // Check if exists
        let existing = self.find_by_id(&entity.path).await?;
        if existing.is_none() {
            return Err(RepositoryError::NotFound {
                entity_type: "Route".to_string(),
                id: entity.path.clone(),
            });
        }

        let id = Self::path_to_id(&entity.path);

        // Update with merge to preserve created_at
        let updated: Option<Route> = self.db
            .update((&self.table as &str, &id as &str))
            .merge(serde_json::json!({
                "name": entity.name,
                "updated_at": chrono::Utc::now().to_rfc3339(),
            }))
            .await?;

        updated.ok_or_else(|| RepositoryError::NotFound {
            entity_type: "Route".to_string(),
            id: entity.path.clone(),
        })
    }

    async fn delete(&self, path: &String) -> Result<bool, RepositoryError> {
        let existing = self.find_by_id(path).await?;
        if existing.is_none() {
            return Ok(false);
        }

        let id = Self::path_to_id(path);

        let _: Option<Route> = self.db
            .delete((&self.table as &str, &id as &str))
            .await?;

        Ok(true)
    }
}

impl SurrealRepository {
    /// Create a route from input (convenience method).
    pub async fn create_from_input(&self, input: CreateRoute) -> Result<Route, RepositoryError> {
        let route = Route {
            id: None,
            path: input.path,
            name: input.name,
            created_at: None,  // Will be set by database
            updated_at: None,  // Will be set by database
        };
        self.create(&route).await
    }

    /// Update a route from input (convenience method).
    pub async fn update_from_input(&self, input: UpdateRoute) -> Result<Route, RepositoryError> {
        let route = Route {
            id: None,
            path: input.path,
            name: input.name,
            created_at: None,
            updated_at: None,
        };
        self.update(&route).await
    }
}
```

**Note**: The above uses `chrono` for timestamps. Add it to your dependencies:

```toml
[dependencies]
chrono = { version = "0.4", features = ["serde"] }
```

Or use a simpler approach without chrono:

```rust
// In update, just use a simple timestamp string
"updated_at": time::now().to_string(),
```

### Checkpoint: Verify SurrealDB Repository

Add comprehensive tests to `crates/crud/src/surreal.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::repository::{ReadRepository, WriteRepository};
    use surrealdb::engine::local::Mem;
    use std::sync::atomic::{AtomicUsize, Ordering};

    // Counter for unique database names
    static TEST_COUNTER: AtomicUsize = AtomicUsize::new(0);

    /// Create a test repository with an in-memory SurrealDB.
    async fn test_repo() -> SurrealRepository {
        let count = TEST_COUNTER.fetch_add(1, Ordering::SeqCst);

        let db: Surreal<Db> = Surreal::init();
        db.connect::<Mem>(()).await.expect("Failed to connect");
        db.use_ns("test").use_db(&format!("test_{}", count)).await.expect("Failed to use ns/db");

        let repo = SurrealRepository::new(db, "routes");
        repo.init_schema().await.expect("Failed to init schema");

        repo
    }

    fn sample_route(path: &str, name: &str) -> Route {
        Route {
            id: None,
            path: path.to_string(),
            name: name.to_string(),
            created_at: None,
            updated_at: None,
        }
    }

    #[tokio::test]
    async fn create_and_read_round_trip() {
        let repo = test_repo().await;

        let route = sample_route("/about", "About Page");

        // Create
        let created = repo.create(&route).await.expect("create failed");
        assert_eq!(created.path, "/about");
        assert_eq!(created.name, "About Page");

        // Read back
        let found = repo.find_by_id(&"/about".to_string()).await.expect("find failed");
        assert!(found.is_some());
        let found = found.unwrap();
        assert_eq!(found.path, "/about");
        assert_eq!(found.name, "About Page");
    }

    #[tokio::test]
    async fn create_duplicate_returns_already_exists() {
        let repo = test_repo().await;

        let route = sample_route("/home", "Home");

        repo.create(&route).await.expect("first create failed");

        // Second create should fail
        let result = repo.create(&route).await;

        match result {
            Err(RepositoryError::AlreadyExists { id, .. }) => {
                assert_eq!(id, "/home");
            }
            other => panic!("Expected AlreadyExists, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn find_nonexistent_returns_none() {
        let repo = test_repo().await;

        let found = repo.find_by_id(&"/nonexistent".to_string()).await.expect("find failed");
        assert!(found.is_none());
    }

    #[tokio::test]
    async fn update_existing_entity() {
        let repo = test_repo().await;

        let route = sample_route("/blog", "Old Name");
        repo.create(&route).await.expect("create failed");

        let updated_route = sample_route("/blog", "New Name");
        let result = repo.update(&updated_route).await.expect("update failed");
        assert_eq!(result.name, "New Name");

        let found = repo.find_by_id(&"/blog".to_string()).await.expect("find failed");
        assert_eq!(found.unwrap().name, "New Name");
    }

    #[tokio::test]
    async fn update_nonexistent_returns_not_found() {
        let repo = test_repo().await;

        let route = sample_route("/nonexistent", "Does Not Exist");

        let result = repo.update(&route).await;

        match result {
            Err(RepositoryError::NotFound { id, .. }) => {
                assert_eq!(id, "/nonexistent");
            }
            other => panic!("Expected NotFound, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn delete_existing_entity() {
        let repo = test_repo().await;

        let route = sample_route("/delete-me", "To Delete");
        repo.create(&route).await.expect("create failed");

        let deleted = repo.delete(&"/delete-me".to_string()).await.expect("delete failed");
        assert!(deleted);

        let found = repo.find_by_id(&"/delete-me".to_string()).await.expect("find failed");
        assert!(found.is_none());
    }

    #[tokio::test]
    async fn delete_nonexistent_returns_false() {
        let repo = test_repo().await;

        let deleted = repo.delete(&"/nonexistent".to_string()).await.expect("delete failed");
        assert!(!deleted);
    }

    #[tokio::test]
    async fn find_all_returns_all_entities() {
        let repo = test_repo().await;

        let routes = vec![
            sample_route("/a", "A"),
            sample_route("/b", "B"),
            sample_route("/c", "C"),
        ];

        for route in &routes {
            repo.create(route).await.expect("create failed");
        }

        let all = repo.find_all().await.expect("find_all failed");
        assert_eq!(all.len(), 3);
    }

    #[tokio::test]
    async fn create_from_input_works() {
        let repo = test_repo().await;

        let input = CreateRoute {
            path: "/input-test".to_string(),
            name: "Input Test".to_string(),
        };

        let created = repo.create_from_input(input).await.expect("create failed");
        assert_eq!(created.path, "/input-test");
        assert_eq!(created.name, "Input Test");
    }
}
```

Run with:

```bash
cargo test -p crud surreal
```

Expected output:

```
running 9 tests
test surreal::tests::create_and_read_round_trip ... ok
test surreal::tests::create_duplicate_returns_already_exists ... ok
test surreal::tests::create_from_input_works ... ok
test surreal::tests::delete_existing_entity ... ok
test surreal::tests::delete_nonexistent_returns_false ... ok
test surreal::tests::find_all_returns_all_entities ... ok
test surreal::tests::find_nonexistent_returns_none ... ok
test surreal::tests::update_existing_entity ... ok
test surreal::tests::update_nonexistent_returns_not_found ... ok

test result: ok. 9 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out
```

If all tests pass, you have a working SurrealDB repository. Proceed to Part 8.

---

## Part 8: Validation with Smart Constructors

Instead of validating in handlers, create wrapper types that enforce invariants.

### Write the Code

Add validation to your entity module. Add to `crates/crud/src/entity.rs`:

```rust
// Add to crates/crud/src/entity.rs

/// Error type for route validation.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ValidationError {
    /// Path must start with '/'.
    InvalidPath(String),
    /// Name cannot be empty.
    EmptyName,
}

impl std::fmt::Display for ValidationError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ValidationError::InvalidPath(path) => {
                write!(f, "path must start with '/': got '{}'", path)
            }
            ValidationError::EmptyName => write!(f, "name cannot be empty"),
        }
    }
}

impl std::error::Error for ValidationError {}

/// A validated route path.
///
/// The only way to create this is through `ValidatedPath::new()`,
/// which enforces that the path starts with '/'.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ValidatedPath(String);

impl ValidatedPath {
    /// Create a new validated path.
    ///
    /// Returns an error if path does not start with '/'.
    pub fn new(path: String) -> Result<Self, ValidationError> {
        if !path.starts_with('/') {
            return Err(ValidationError::InvalidPath(path));
        }
        Ok(Self(path))
    }

    /// Get the path as a string slice.
    pub fn as_str(&self) -> &str {
        &self.0
    }

    /// Consume and return the inner string.
    pub fn into_inner(self) -> String {
        self.0
    }
}

impl std::fmt::Display for ValidatedPath {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

/// A validated route name.
///
/// The only way to create this is through `ValidatedName::new()`,
/// which enforces that the name is not empty.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ValidatedName(String);

impl ValidatedName {
    /// Create a new validated name.
    ///
    /// Returns an error if name is empty or whitespace-only.
    pub fn new(name: String) -> Result<Self, ValidationError> {
        if name.trim().is_empty() {
            return Err(ValidationError::EmptyName);
        }
        Ok(Self(name))
    }

    /// Get the name as a string slice.
    pub fn as_str(&self) -> &str {
        &self.0
    }

    /// Consume and return the inner string.
    pub fn into_inner(self) -> String {
        self.0
    }
}

impl std::fmt::Display for ValidatedName {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

/// A fully validated route input.
///
/// Use this to ensure routes are valid before passing to the repository.
#[derive(Debug, Clone)]
pub struct ValidatedRouteInput {
    pub path: ValidatedPath,
    pub name: ValidatedName,
}

impl ValidatedRouteInput {
    /// Create a new validated route input.
    pub fn new(path: String, name: String) -> Result<Self, ValidationError> {
        Ok(Self {
            path: ValidatedPath::new(path)?,
            name: ValidatedName::new(name)?,
        })
    }
}
```

### Checkpoint: Verify Validation Works

Add these tests to the test module in `crates/crud/src/entity.rs`:

```rust
    // Add to the existing #[cfg(test)] mod tests { ... } block

    use super::{ValidatedPath, ValidatedName, ValidatedRouteInput, ValidationError};

    #[test]
    fn validated_path_accepts_valid_path() {
        let result = ValidatedPath::new("/about".to_string());
        assert!(result.is_ok());
        assert_eq!(result.unwrap().as_str(), "/about");
    }

    #[test]
    fn validated_path_rejects_path_without_leading_slash() {
        let result = ValidatedPath::new("about".to_string());

        match result {
            Err(ValidationError::InvalidPath(path)) => {
                assert_eq!(path, "about");
            }
            other => panic!("Expected InvalidPath, got {:?}", other),
        }
    }

    #[test]
    fn validated_path_rejects_empty_path() {
        let result = ValidatedPath::new("".to_string());
        assert!(matches!(result, Err(ValidationError::InvalidPath(_))));
    }

    #[test]
    fn validated_name_accepts_valid_name() {
        let result = ValidatedName::new("About Page".to_string());
        assert!(result.is_ok());
        assert_eq!(result.unwrap().as_str(), "About Page");
    }

    #[test]
    fn validated_name_rejects_empty_name() {
        let result = ValidatedName::new("".to_string());
        assert!(matches!(result, Err(ValidationError::EmptyName)));
    }

    #[test]
    fn validated_name_rejects_whitespace_only_name() {
        let result = ValidatedName::new("   ".to_string());
        assert!(matches!(result, Err(ValidationError::EmptyName)));
    }

    #[test]
    fn validated_route_input_validates_both_fields() {
        let result = ValidatedRouteInput::new("/test".to_string(), "Test".to_string());
        assert!(result.is_ok());

        let input = result.unwrap();
        assert_eq!(input.path.as_str(), "/test");
        assert_eq!(input.name.as_str(), "Test");
    }

    #[test]
    fn validated_route_input_fails_on_invalid_path() {
        let result = ValidatedRouteInput::new("no-slash".to_string(), "Valid Name".to_string());
        assert!(matches!(result, Err(ValidationError::InvalidPath(_))));
    }

    #[test]
    fn validated_route_input_fails_on_empty_name() {
        let result = ValidatedRouteInput::new("/valid".to_string(), "".to_string());
        assert!(matches!(result, Err(ValidationError::EmptyName)));
    }
```

Run with:

```bash
cargo test -p crud validated
```

Expected output:

```
running 9 tests
test entity::tests::validated_name_accepts_valid_name ... ok
test entity::tests::validated_name_rejects_empty_name ... ok
test entity::tests::validated_name_rejects_whitespace_only_name ... ok
test entity::tests::validated_path_accepts_valid_path ... ok
test entity::tests::validated_path_rejects_empty_path ... ok
test entity::tests::validated_path_rejects_path_without_leading_slash ... ok
test entity::tests::validated_route_input_fails_on_empty_name ... ok
test entity::tests::validated_route_input_fails_on_invalid_path ... ok
test entity::tests::validated_route_input_validates_both_fields ... ok

test result: ok. 9 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out
```

---

## Part 9: Contract Testing

The last mental model: **contract testing**.

A trait is a contract. Any implementation must satisfy the contract. We can write tests that verify any implementation:

### Write the Contract Test

Add a new file `crates/crud/src/contract.rs`:

```rust
//! Contract tests for repository implementations.
//!
//! These tests verify that any repository implementation
//! correctly implements the CrudRepository contract.

use crate::entity::Entity;
use crate::error::RepositoryError;
use crate::repository::CrudRepository;

/// Verify that a repository implementation satisfies the CRUD contract.
///
/// Call this with any repository and a sample entity to verify
/// the implementation is correct.
pub async fn verify_crud_contract<R, T>(repo: &R, sample_entity: T)
where
    R: CrudRepository<T, T::Id>,
    T: Entity + Clone + PartialEq + std::fmt::Debug,
{
    // Contract 1: Create returns the entity (with possibly modified fields like timestamps)
    let created = repo.create(&sample_entity).await
        .expect("Contract 1 failed: create should succeed");
    assert_eq!(created.id(), sample_entity.id(), "Contract 1: created entity should have same ID");

    // Contract 2: Find returns what was created
    let found = repo.find_by_id(sample_entity.id()).await
        .expect("Contract 2 failed: find_by_id should succeed");
    assert!(found.is_some(), "Contract 2: should find created entity");
    assert_eq!(found.unwrap().id(), sample_entity.id());

    // Contract 3: Duplicate create fails with AlreadyExists
    let duplicate = repo.create(&sample_entity).await;
    match duplicate {
        Err(RepositoryError::AlreadyExists { .. }) => {}
        other => panic!("Contract 3: duplicate create should return AlreadyExists, got {:?}", other),
    }

    // Contract 4: Find all includes the entity
    let all = repo.find_all().await
        .expect("Contract 4 failed: find_all should succeed");
    assert!(all.iter().any(|e| e.id() == sample_entity.id()), "Contract 4: find_all should contain the entity");

    // Contract 5: Delete removes the entity
    let deleted = repo.delete(sample_entity.id()).await
        .expect("Contract 5 failed: delete should succeed");
    assert!(deleted, "Contract 5: delete should return true for existing entity");

    // Contract 6: Find after delete returns None
    let gone = repo.find_by_id(sample_entity.id()).await
        .expect("Contract 6 failed: find_by_id should succeed after delete");
    assert!(gone.is_none(), "Contract 6: entity should be gone after delete");

    // Contract 7: Delete non-existent returns false
    let delete_again = repo.delete(sample_entity.id()).await
        .expect("Contract 7 failed: delete should succeed for non-existent");
    assert!(!delete_again, "Contract 7: delete non-existent should return false");
}

/// Additional contract: Update behavior
pub async fn verify_update_contract<R, T, F>(repo: &R, sample_entity: T, modify: F)
where
    R: CrudRepository<T, T::Id>,
    T: Entity + Clone + PartialEq + std::fmt::Debug,
    F: FnOnce(T) -> T,
{
    // Setup: create the entity
    let created = repo.create(&sample_entity).await
        .expect("Setup failed: could not create entity");

    // Contract 8: Update returns modified entity
    let modified = modify(created);
    let updated = repo.update(&modified).await
        .expect("Contract 8 failed: update should succeed");
    assert_eq!(updated.id(), sample_entity.id(), "Contract 8: update should preserve ID");

    // Contract 9: Find returns updated entity
    let found = repo.find_by_id(sample_entity.id()).await
        .expect("Contract 9 failed: find_by_id should succeed")
        .expect("Contract 9 failed: entity should exist");
    assert_eq!(found.id(), sample_entity.id(), "Contract 9: find should return entity with same ID");

    // Cleanup
    repo.delete(sample_entity.id()).await.ok();
}

/// Contract: Update non-existent fails
pub async fn verify_update_nonexistent_contract<R, T>(repo: &R, sample_entity: T)
where
    R: CrudRepository<T, T::Id>,
    T: Entity + Clone + std::fmt::Debug,
{
    // Contract 10: Update non-existent fails with NotFound
    let result = repo.update(&sample_entity).await;
    match result {
        Err(RepositoryError::NotFound { .. }) => {}
        other => panic!("Contract 10: update non-existent should return NotFound, got {:?}", other),
    }
}
```

Update `crates/crud/src/lib.rs`:

```rust
//! A trait-based CRUD pattern for storage-agnostic data layers.

pub mod entity;
pub mod error;
pub mod repository;
pub mod surreal;
pub mod contract;

pub use entity::{Entity, ValidationError, ValidatedPath, ValidatedName, ValidatedRouteInput};
pub use error::{RepositoryError, StorageError};
pub use repository::{ReadRepository, WriteRepository, CrudRepository};
pub use surreal::{SurrealRepository, Route, CreateRoute, UpdateRoute};
pub use contract::{verify_crud_contract, verify_update_contract, verify_update_nonexistent_contract};
```

### Checkpoint: Run Contract Tests Against SurrealDB Implementation

Add tests to `crates/crud/src/contract.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::surreal::{SurrealRepository, Route};
    use surrealdb::engine::local::{Db, Mem};
    use surrealdb::Surreal;
    use std::sync::atomic::{AtomicUsize, Ordering};

    static TEST_COUNTER: AtomicUsize = AtomicUsize::new(1000);

    async fn create_test_repo() -> SurrealRepository {
        let count = TEST_COUNTER.fetch_add(1, Ordering::SeqCst);

        let db: Surreal<Db> = Surreal::init();
        db.connect::<Mem>(()).await.expect("Failed to connect");
        db.use_ns("contract").use_db(&format!("test_{}", count)).await.expect("Failed to use ns/db");

        let repo = SurrealRepository::new(db, "routes");
        repo.init_schema().await.expect("Failed to init schema");

        repo
    }

    fn sample_route(suffix: &str) -> Route {
        Route {
            id: None,
            path: format!("/test-{}", suffix),
            name: format!("Test {}", suffix),
            created_at: None,
            updated_at: None,
        }
    }

    #[tokio::test]
    async fn surreal_repository_satisfies_crud_contract() {
        let repo = create_test_repo().await;
        let entity = sample_route("crud-contract");

        verify_crud_contract(&repo, entity).await;
    }

    #[tokio::test]
    async fn surreal_repository_satisfies_update_contract() {
        let repo = create_test_repo().await;
        let entity = sample_route("update-contract");

        verify_update_contract(&repo, entity, |mut e| {
            e.name = "Modified Name".to_string();
            e
        }).await;
    }

    #[tokio::test]
    async fn surreal_repository_satisfies_update_nonexistent_contract() {
        let repo = create_test_repo().await;
        let entity = sample_route("nonexistent");

        verify_update_nonexistent_contract(&repo, entity).await;
    }
}
```

Run with:

```bash
cargo test -p crud contract
```

Expected output:

```
running 3 tests
test contract::tests::surreal_repository_satisfies_crud_contract ... ok
test contract::tests::surreal_repository_satisfies_update_contract ... ok
test contract::tests::surreal_repository_satisfies_update_nonexistent_contract ... ok

test result: ok. 3 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out
```

If all contract tests pass, your implementation is correct and any future implementation (SQLite, Redis, In-Memory) can be verified with the same tests.

---

## Part 10: Run All Tests

Now run the complete test suite:

```bash
cargo test -p crud
```

Expected output:

```
running 26 tests
test contract::tests::surreal_repository_satisfies_crud_contract ... ok
test contract::tests::surreal_repository_satisfies_update_contract ... ok
test contract::tests::surreal_repository_satisfies_update_nonexistent_contract ... ok
test entity::tests::entity_id_is_displayable ... ok
test entity::tests::entity_id_is_hashable ... ok
test entity::tests::entity_returns_correct_id ... ok
test entity::tests::validated_name_accepts_valid_name ... ok
test entity::tests::validated_name_rejects_empty_name ... ok
test entity::tests::validated_name_rejects_whitespace_only_name ... ok
test entity::tests::validated_path_accepts_valid_path ... ok
test entity::tests::validated_path_rejects_empty_path ... ok
test entity::tests::validated_path_rejects_path_without_leading_slash ... ok
test entity::tests::validated_route_input_fails_on_empty_name ... ok
test entity::tests::validated_route_input_fails_on_invalid_path ... ok
test entity::tests::validated_route_input_validates_both_fields ... ok
test error::tests::already_exists_error_displays_correctly ... ok
test error::tests::io_error_converts_to_storage_error ... ok
test error::tests::json_error_converts_to_repository_error ... ok
test error::tests::not_found_error_displays_correctly ... ok
test error::tests::storage_error_converts_to_repository_error ... ok
test repository::tests::blanket_impl_provides_crud_repository ... ok
test surreal::tests::create_and_read_round_trip ... ok
test surreal::tests::create_duplicate_returns_already_exists ... ok
test surreal::tests::create_from_input_works ... ok
test surreal::tests::delete_existing_entity ... ok
test surreal::tests::delete_nonexistent_returns_false ... ok
test surreal::tests::find_all_returns_all_entities ... ok
test surreal::tests::find_nonexistent_returns_none ... ok
test surreal::tests::update_existing_entity ... ok
test surreal::tests::update_nonexistent_returns_not_found ... ok

test result: ok. 26+ passed; 0 failed; 0 ignored; 0 measured; 0 filtered out
```

---

## Part 11: Adding a Second Entity (Content)

Let us add a `Content` entity that stores document blocks. This demonstrates SurrealDB's native document capabilities - no JSON-as-TEXT hack like SQLite.

### Understanding SurrealDB's Document Nature

Unlike SQLite where you must store JSON as TEXT and parse it manually, SurrealDB stores nested objects natively:

```rust
// SurrealDB stores this directly - no serialization needed
pub struct Content {
    pub id: String,
    pub route_path: String,
    pub blocks: Vec<Block>,  // Stored as native array
}

pub struct Block {
    pub block_type: String,
    pub content: String,
}
```

### Add Content Entity and Repository

Add to `crates/crud/src/surreal.rs`:

```rust
// Add these after the Route types

/// A content block in a page.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Block {
    pub block_type: String,
    pub content: String,
}

/// Content entity with document blocks.
///
/// Unlike SQLite, SurrealDB stores nested documents natively.
/// No need for JSON-as-TEXT workarounds.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Content {
    pub id: Option<String>,
    pub route_path: String,
    pub blocks: Vec<Block>,  // Native nested documents
    #[serde(default)]
    pub created_at: Option<String>,
    #[serde(default)]
    pub updated_at: Option<String>,
}

impl crate::Entity for Content {
    type Id = String;
    fn id(&self) -> &Self::Id {
        self.id.as_ref().unwrap_or(&self.route_path)
    }
}

impl Content {
    /// Create a new Content with blocks.
    pub fn new(id: String, route_path: String, blocks: Vec<Block>) -> Self {
        Self {
            id: Some(id),
            route_path,
            blocks,
            created_at: None,
            updated_at: None,
        }
    }
}

/// Repository for Content entities.
pub struct ContentRepository {
    db: Surreal<Db>,
    table: String,
}

impl ContentRepository {
    pub fn new(db: Surreal<Db>) -> Self {
        Self {
            db,
            table: "content".to_string(),
        }
    }

    /// Initialize the content table schema.
    pub async fn init_schema(&self) -> Result<(), RepositoryError> {
        let query = r#"
            DEFINE TABLE IF NOT EXISTS content SCHEMAFULL;
            DEFINE FIELD IF NOT EXISTS route_path ON TABLE content TYPE string;
            DEFINE FIELD IF NOT EXISTS blocks ON TABLE content TYPE array;
            DEFINE FIELD IF NOT EXISTS blocks.* ON TABLE content TYPE object;
            DEFINE FIELD IF NOT EXISTS blocks.*.block_type ON TABLE content TYPE string;
            DEFINE FIELD IF NOT EXISTS blocks.*.content ON TABLE content TYPE string;
            DEFINE FIELD IF NOT EXISTS created_at ON TABLE content TYPE option<datetime> DEFAULT time::now();
            DEFINE FIELD IF NOT EXISTS updated_at ON TABLE content TYPE option<datetime> DEFAULT time::now();
            DEFINE INDEX IF NOT EXISTS idx_route ON TABLE content FIELDS route_path;
        "#;

        self.db.query(query).await?;
        Ok(())
    }

    /// Find all content for a specific route.
    pub async fn find_by_route(&self, route_path: &str) -> Result<Vec<Content>, RepositoryError> {
        let content: Vec<Content> = self.db
            .query("SELECT * FROM content WHERE route_path = $route_path ORDER BY id")
            .bind(("route_path", route_path))
            .await?
            .take(0)?;

        Ok(content)
    }
}

impl ReadRepository<Content, String> for ContentRepository {
    async fn find_by_id(&self, id: &String) -> Result<Option<Content>, RepositoryError> {
        let content: Option<Content> = self.db
            .select((&self.table as &str, id as &str))
            .await?;

        Ok(content)
    }

    async fn find_all(&self) -> Result<Vec<Content>, RepositoryError> {
        let content: Vec<Content> = self.db
            .select(&self.table as &str)
            .await?;

        Ok(content)
    }
}

impl WriteRepository<Content, String> for ContentRepository {
    async fn create(&self, entity: &Content) -> Result<Content, RepositoryError> {
        let id = entity.id.as_ref().ok_or_else(|| RepositoryError::NotFound {
            entity_type: "Content".to_string(),
            id: "missing".to_string(),
        })?;

        // Check if already exists
        let existing = self.find_by_id(id).await?;
        if existing.is_some() {
            return Err(RepositoryError::AlreadyExists {
                entity_type: "Content".to_string(),
                id: id.clone(),
            });
        }

        let created: Option<Content> = self.db
            .create((&self.table as &str, id as &str))
            .content(entity)
            .await?;

        created.ok_or_else(|| RepositoryError::NotFound {
            entity_type: "Content".to_string(),
            id: id.clone(),
        })
    }

    async fn update(&self, entity: &Content) -> Result<Content, RepositoryError> {
        let id = entity.id.as_ref().ok_or_else(|| RepositoryError::NotFound {
            entity_type: "Content".to_string(),
            id: "missing".to_string(),
        })?;

        let existing = self.find_by_id(id).await?;
        if existing.is_none() {
            return Err(RepositoryError::NotFound {
                entity_type: "Content".to_string(),
                id: id.clone(),
            });
        }

        let updated: Option<Content> = self.db
            .update((&self.table as &str, id as &str))
            .content(entity)
            .await?;

        updated.ok_or_else(|| RepositoryError::NotFound {
            entity_type: "Content".to_string(),
            id: id.clone(),
        })
    }

    async fn delete(&self, id: &String) -> Result<bool, RepositoryError> {
        let existing = self.find_by_id(id).await?;
        if existing.is_none() {
            return Ok(false);
        }

        let _: Option<Content> = self.db
            .delete((&self.table as &str, id as &str))
            .await?;

        Ok(true)
    }
}
```

Update exports in `crates/crud/src/lib.rs`:

```rust
pub use surreal::{SurrealRepository, Route, CreateRoute, UpdateRoute, Content, Block, ContentRepository};
```

### Checkpoint: Test Content Repository

Add to `crates/crud/src/surreal.rs` tests:

```rust
    // Add these tests to the existing tests module

    async fn test_content_repo() -> ContentRepository {
        let count = TEST_COUNTER.fetch_add(1, Ordering::SeqCst);

        let db: Surreal<Db> = Surreal::init();
        db.connect::<Mem>(()).await.expect("Failed to connect");
        db.use_ns("test").use_db(&format!("content_test_{}", count)).await.expect("Failed to use ns/db");

        let repo = ContentRepository::new(db);
        repo.init_schema().await.expect("Failed to init schema");

        repo
    }

    #[tokio::test]
    async fn content_create_and_read() {
        let repo = test_content_repo().await;

        let blocks = vec![
            Block { block_type: "heading".to_string(), content: "Hello".to_string() },
            Block { block_type: "paragraph".to_string(), content: "World".to_string() },
        ];

        let content = Content::new("content-1".to_string(), "/test".to_string(), blocks.clone());

        let created = repo.create(&content).await.expect("create failed");
        assert_eq!(created.id, Some("content-1".to_string()));
        assert_eq!(created.blocks.len(), 2);
        assert_eq!(created.blocks[0].block_type, "heading");
    }

    #[tokio::test]
    async fn content_nested_blocks_preserved() {
        let repo = test_content_repo().await;

        let blocks = vec![
            Block { block_type: "code".to_string(), content: "fn main() {}".to_string() },
            Block { block_type: "text".to_string(), content: "Some explanation".to_string() },
            Block { block_type: "code".to_string(), content: "println!(\"Hello\")".to_string() },
        ];

        let content = Content::new("multi-block".to_string(), "/tutorial".to_string(), blocks);

        repo.create(&content).await.expect("create failed");

        let found = repo.find_by_id(&"multi-block".to_string()).await
            .expect("find failed")
            .expect("should exist");

        assert_eq!(found.blocks.len(), 3);
        assert_eq!(found.blocks[0].block_type, "code");
        assert_eq!(found.blocks[1].block_type, "text");
        assert_eq!(found.blocks[2].content, "println!(\"Hello\")");
    }

    #[tokio::test]
    async fn content_find_by_route() {
        let repo = test_content_repo().await;

        // Create content for different routes
        let content1 = Content::new("c1".to_string(), "/route-a".to_string(), vec![]);
        let content2 = Content::new("c2".to_string(), "/route-a".to_string(), vec![]);
        let content3 = Content::new("c3".to_string(), "/route-b".to_string(), vec![]);

        repo.create(&content1).await.unwrap();
        repo.create(&content2).await.unwrap();
        repo.create(&content3).await.unwrap();

        let route_a_content = repo.find_by_route("/route-a").await.expect("find failed");
        assert_eq!(route_a_content.len(), 2);

        let route_b_content = repo.find_by_route("/route-b").await.expect("find failed");
        assert_eq!(route_b_content.len(), 1);
    }

    #[tokio::test]
    async fn content_update_blocks() {
        let repo = test_content_repo().await;

        let initial = Content::new(
            "update-test".to_string(),
            "/page".to_string(),
            vec![Block { block_type: "text".to_string(), content: "Initial".to_string() }]
        );

        repo.create(&initial).await.expect("create failed");

        let updated = Content::new(
            "update-test".to_string(),
            "/page".to_string(),
            vec![
                Block { block_type: "heading".to_string(), content: "Title".to_string() },
                Block { block_type: "text".to_string(), content: "Updated content".to_string() },
            ]
        );

        let result = repo.update(&updated).await.expect("update failed");
        assert_eq!(result.blocks.len(), 2);
        assert_eq!(result.blocks[0].block_type, "heading");
    }
```

Run:

```bash
cargo test -p crud content
```

---

## Part 12: Axum Integration

Once the CRUD crate is complete and tested, integrate it with your application.

### Add Dependencies to Your Website

In your website's `Cargo.toml`:

```toml
[dependencies]
crud = { path = "../crates/crud" }
axum = "0.8"
tokio = { version = "1", features = ["full"] }
surrealdb = { version = "2", features = ["kv-rocksdb"] }
serde_json = "1"
```

### Create AppState

```rust
use axum::extract::FromRef;
use crud::{SurrealRepository, ContentRepository};
use surrealdb::engine::local::{Db, File};
use surrealdb::Surreal;
use std::sync::Arc;

#[derive(Clone, FromRef)]
pub struct AppState {
    pub routes: Arc<SurrealRepository>,
    pub content: Arc<ContentRepository>,
}

impl AppState {
    pub async fn new(db_path: &str) -> Result<Self, Box<dyn std::error::Error>> {
        let db: Surreal<Db> = Surreal::init();
        db.connect::<File>(db_path).await?;
        db.use_ns("app").use_db("main").await?;

        let routes_repo = SurrealRepository::new(db.clone(), "routes");
        routes_repo.init_schema().await?;

        let content_repo = ContentRepository::new(db);
        content_repo.init_schema().await?;

        Ok(Self {
            routes: Arc::new(routes_repo),
            content: Arc::new(content_repo),
        })
    }
}
```

### Handlers

```rust
use axum::{extract::{Path, State}, Json, http::StatusCode};
use crud::{ReadRepository, WriteRepository, RepositoryError, Route, CreateRoute};
use std::sync::Arc;

/// GET /routes
pub async fn list_routes(
    State(repo): State<Arc<SurrealRepository>>,
) -> Result<Json<Vec<Route>>, AppError> {
    let routes = repo.find_all().await?;
    Ok(Json(routes))
}

/// GET /routes/:path
pub async fn get_route(
    State(repo): State<Arc<SurrealRepository>>,
    Path(path): Path<String>,
) -> Result<Json<Route>, AppError> {
    let route = repo.find_by_id(&format!("/{}", path)).await?
        .ok_or(AppError::NotFound)?;
    Ok(Json(route))
}

/// POST /routes
pub async fn create_route(
    State(repo): State<Arc<SurrealRepository>>,
    Json(input): Json<CreateRoute>,
) -> Result<(StatusCode, Json<Route>), AppError> {
    let created = repo.create_from_input(input).await?;
    Ok((StatusCode::CREATED, Json(created)))
}
```

### Error Mapping

```rust
use axum::{response::{IntoResponse, Response}, http::StatusCode, Json};
use crud::RepositoryError;
use serde_json::json;

pub enum AppError {
    Repository(RepositoryError),
    NotFound,
}

impl From<RepositoryError> for AppError {
    fn from(err: RepositoryError) -> Self {
        AppError::Repository(err)
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, message) = match self {
            AppError::NotFound => (StatusCode::NOT_FOUND, "not found".to_string()),
            AppError::Repository(RepositoryError::NotFound { .. }) => {
                (StatusCode::NOT_FOUND, "not found".to_string())
            }
            AppError::Repository(RepositoryError::AlreadyExists { id, .. }) => {
                (StatusCode::CONFLICT, format!("already exists: {}", id))
            }
            AppError::Repository(err) => {
                (StatusCode::INTERNAL_SERVER_ERROR, err.to_string())
            }
        };

        let body = Json(json!({ "error": message }));
        (status, body).into_response()
    }
}
```

### Router Setup

```rust
use axum::{routing::{get, post}, Router};

pub fn routes_router() -> Router<AppState> {
    Router::new()
        .route("/routes", get(list_routes).post(create_route))
        .route("/routes/*path", get(get_route))
}
```

### Main Function

```rust
use std::net::SocketAddr;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let db_path = std::env::var("SURREAL_PATH")
        .unwrap_or_else(|_| "./data/surreal.db".to_string());

    let state = AppState::new(&db_path).await?;

    let app = Router::new()
        .merge(routes_router())
        .with_state(state);

    let addr = SocketAddr::from(([127, 0, 0, 1], 3000));
    println!("Listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
```

---

## Part 13: Deployment on render.com

### render.yaml

```yaml
services:
  - type: web
    name: my-website
    runtime: rust
    buildCommand: cargo build --release
    startCommand: ./target/release/website
    envVars:
      - key: SURREAL_PATH
        value: /var/data/surreal.db
      - key: SURREAL_NS
        value: production
      - key: SURREAL_DB
        value: app
    disk:
      name: data
      mountPath: /var/data
      sizeGB: 1
```

### Key Points

1. **Persistent disk**: The SurrealDB files survive deployments
2. **Schema on startup**: Your app initializes schema automatically
3. **No database server**: Embedded mode means just your app and files

### Health Check Endpoint

Add a health check that verifies database connectivity:

```rust
/// GET /health
pub async fn health_check(
    State(repo): State<Arc<SurrealRepository>>,
) -> StatusCode {
    match repo.find_all().await {
        Ok(_) => StatusCode::OK,
        Err(_) => StatusCode::SERVICE_UNAVAILABLE,
    }
}
```

Add to router:

```rust
.route("/health", get(health_check))
```

---

## Conclusion

You now understand:

1. **The Problem**: Tight coupling between handlers and storage makes code hard to test and change.

2. **The Solution**: The repository pattern with trait abstraction.

3. **The Mental Models**:
   - Onion Architecture: layers only talk to adjacent layers
   - Plug and Socket: traits are sockets, implementations are plugs
   - Contract Testing: verify implementations against the trait contract

4. **The Implementation**: A complete, working, type-safe CRUD system with SurrealDB.

5. **The Workflow**: Write code, run test, see it pass, proceed.

6. **SurrealDB Benefits**:
   - Embedded like SQLite, no server needed
   - Native document storage (no JSON-as-TEXT)
   - Schemaless or schemafull as needed
   - Graph capabilities when you need them
   - Same code works embedded or with server

The pattern is simple once you see it. The power is in the discipline.

---

## Appendix: Complete File Listing

```
crates/crud/
  Cargo.toml
  src/
    lib.rs              # Public API exports
    entity.rs           # Entity trait + validation
    error.rs            # RepositoryError, StorageError
    repository.rs       # Trait definitions
    surreal.rs          # SurrealDB implementation
    contract.rs         # Contract test helpers
```

Each file is small, focused, and testable. Run `cargo test -p crud` to verify everything works.

---

## Appendix: Key Differences from SQLite

### No Migrations

SurrealDB is schemaless by default. You can add schema with `DEFINE TABLE` and `DEFINE FIELD`, but you do not need a migrations directory or `sqlx migrate run`.

Schema is defined on startup:

```rust
repo.init_schema().await?;  // Idempotent, safe to call every time
```

### Record IDs

SurrealDB uses `table:id` format instead of separate primary key columns:

```rust
// SQLite: SELECT * FROM routes WHERE path = '/about'
// SurrealDB: SELECT * FROM routes:about
```

### Document-Native

JSON/nested structures are first-class:

```rust
// SQLite: Store as TEXT, parse manually
pub struct Content {
    blocks: String,  // JSON encoded
}

// SurrealDB: Store directly
pub struct Content {
    blocks: Vec<Block>,  // Native nested documents
}
```

### Graph Capabilities

SurrealDB can model relationships as graph edges. Not covered here, but available when needed:

```sql
-- Create a relationship
RELATE user:john->follows->user:jane;

-- Query relationships
SELECT ->follows->user FROM user:john;
```

### Authentication

SurrealDB has a multi-layer auth system (root, namespace, database, record). For embedded mode in development, this is not relevant. For server mode in production, configure appropriately.

---

## Appendix: Migration from SQLite

If you have an existing SQLite + SQLx implementation:

1. The Entity trait and Repository traits remain unchanged
2. Create a new `surreal.rs` implementation
3. Update your AppState to use `SurrealRepository`
4. Export your SQLite data and import into SurrealDB
5. Test with contract tests (same tests work for both implementations)

The repository traits provide the abstraction that makes this migration safe.
