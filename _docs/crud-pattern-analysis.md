# CRUD Pattern Analysis for Axum Applications

*Comprehensive research for designing a reusable, trait-based CRUD pattern*

---

## 1. Executive Summary

This document presents a comprehensive analysis and design for a **trait-based CRUD repository pattern** for Axum applications. The pattern:

- **Works with JSON files initially** but is architected for database migration
- **Is configuration-focused** with explicit trait implementations (not convention-based like Rails)
- **Scales to any number of entities** with consistent patterns and contract testing
- **Integrates with the existing feature-based architecture** in `src/core/`, `src/features/`, `src/pages/`
- **Follows Rust best practices** for type safety, error handling, and testability

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Async traits | Native (Rust 1.75+) | Zero macro overhead, simpler code |
| Read/Write separation | Yes | Interface Segregation Principle |
| AppState integration | Concrete types + FromRef | Compile-time selection, no runtime dispatch |
| Error handling | Layered error types | Storage → Repository → API |
| Validation | Newtype wrappers | Compile-time guarantees |
| Backend switching | Feature flags | Zero-cost abstraction |

### Trade-offs

**Pros:**
- Type-safe at compile time
- Easy to test with contract tests
- Clear separation of concerns
- Minimal runtime overhead

**Cons:**
- More upfront boilerplate per entity
- No "magic" auto-generation of handlers
- Requires explicit trait implementations

---

## 2. Current State Analysis

### persistence.rs Patterns (Lines 77-86, 266-288)

The current `Route` entity demonstrates the existing approach:

```rust
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq, Eq)]
pub struct Route {
    pub path: String,
    pub name: String,
    #[serde(rename = "blockIds")]
    pub block_ids: Vec<String>,
}
```

**What Works Well:**
- Clean entity definition with serde derives
- Proper error handling with fallback to defaults
- Separation between loading and saving functions
- Path-based file organization

**What Needs Abstraction:**
- Functions are entity-specific (`load_routes`, `save_routes`)
- No trait-based polymorphism for testing
- Error types use `Box<dyn Error>` (not typed)
- Concurrent access not explicitly handled
- No validation before persistence

### admin/api.rs Patterns

Current handler pattern:

```rust
pub async fn update_route(
    Path(route_name): Path<String>,
    Json(data): Json<HomepageData>,
) -> Result<String, String>
```

**Issues to Address:**
- Returns `Result<String, String>` (not typed errors)
- No validation before save
- Tightly coupled to persistence functions
- No state injection (uses module-level functions)

### Integration Points

```
┌─────────────────────────────────────────────────────────────┐
│                     Admin Page (Pages)                       │
│                   src/pages/admin/mod.rs                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Admin API Handlers                         │
│                  src/pages/admin/api.rs                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Persistence Layer                          │
│                 src/core/persistence.rs                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     JSON Files                               │
│               data/routes.json, data/content/               │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. CRUD Trait Design

### Core Repository Traits

```rust
use std::future::Future;

/// Read-only operations (useful for replicas, caching layers)
pub trait ReadRepository<T, ID>: Send + Sync {
    /// Find an entity by its primary key
    fn find_by_id(&self, id: &ID) -> impl Future<Output = Result<Option<T>, RepositoryError>> + Send;

    /// List all entities
    fn find_all(&self) -> impl Future<Output = Result<Vec<T>, RepositoryError>> + Send;

    /// Check if an entity exists
    fn exists(&self, id: &ID) -> impl Future<Output = Result<bool, RepositoryError>> + Send;
}

/// Write operations (master database only)
pub trait WriteRepository<T, ID>: Send + Sync {
    /// Create a new entity (fails if already exists)
    fn create(&self, entity: &T) -> impl Future<Output = Result<T, RepositoryError>> + Send;

    /// Update an existing entity (fails if not found)
    fn update(&self, entity: &T) -> impl Future<Output = Result<T, RepositoryError>> + Send;

    /// Delete an entity by ID (returns true if deleted)
    fn delete(&self, id: &ID) -> impl Future<Output = Result<bool, RepositoryError>> + Send;
}

/// Full CRUD = Read + Write
pub trait CrudRepository<T, ID>: ReadRepository<T, ID> + WriteRepository<T, ID> {}

// Blanket implementation
impl<T, ID, R> CrudRepository<T, ID> for R
where
    R: ReadRepository<T, ID> + WriteRepository<T, ID>
{}
```

### Type Parameters and Constraints

```rust
/// Required bounds for CRUD entities
pub trait Entity: Clone + Send + Sync + 'static {
    /// The type used as the primary key
    type Id: Clone + Eq + std::hash::Hash + Send + Sync + std::fmt::Display;

    /// Extract the entity's primary key
    fn id(&self) -> &Self::Id;
}

/// Entities that can be persisted to JSON files
pub trait JsonEntity: Entity + serde::Serialize + serde::de::DeserializeOwned {}

// Blanket implementation
impl<T> JsonEntity for T where T: Entity + serde::Serialize + serde::de::DeserializeOwned {}
```

### Query Parameters (Optional Extension)

```rust
/// Sort direction for queries
#[derive(Debug, Clone, Copy, Default)]
pub enum SortOrder {
    #[default]
    Ascending,
    Descending,
}

/// Query parameters for list operations
#[derive(Debug, Clone, Default)]
pub struct QueryParams {
    pub limit: Option<usize>,
    pub offset: Option<usize>,
    pub sort_by: Option<String>,
    pub sort_order: SortOrder,
}

/// Extended query capabilities (optional trait)
pub trait QueryableRepository<T, ID, F>: ReadRepository<T, ID> {
    fn find_by(&self, filter: F, params: QueryParams)
        -> impl Future<Output = Result<Vec<T>, RepositoryError>> + Send;

    fn count(&self, filter: F)
        -> impl Future<Output = Result<usize, RepositoryError>> + Send;
}
```

---

## 4. Service Layer Architecture

### How CRUD Repositories Integrate with Axum

```
┌────────────────────────────────────────────────────────────────┐
│                        Router (Axum)                           │
│   .route("/routes", get(list).post(create))                   │
│   .route("/routes/:id", get(get).put(update).delete(delete))  │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│                    Handler (HTTP concerns)                     │
│   - Extract path params, query params, JSON body              │
│   - Validate request                                          │
│   - Map Result to HTTP response                               │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│                 Repository (Data access)                       │
│   - CRUD operations                                            │
│   - Storage abstraction                                        │
│   - Error handling                                             │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│                    Storage (JSON/Database)                     │
│   - File I/O or database queries                              │
│   - Atomic operations                                          │
│   - Concurrent access handling                                │
└────────────────────────────────────────────────────────────────┘
```

### AppState Configuration

```rust
use axum::extract::FromRef;
use std::sync::Arc;

/// Primary application state
#[derive(Clone, FromRef)]
pub struct AppState {
    /// Route repository (JSON-backed)
    pub routes: Arc<JsonRouteRepository>,

    /// Block repository (JSON-backed)
    pub blocks: Arc<JsonBlockRepository>,

    /// Application configuration
    pub config: Arc<Config>,
}

impl AppState {
    /// Initialize with concrete dependencies
    pub fn new(config: Config) -> Self {
        let data_dir = PathBuf::from(&config.data_directory);

        Self {
            routes: Arc::new(JsonRouteRepository::new(
                data_dir.join("routes.json")
            )),
            blocks: Arc::new(JsonBlockRepository::new(
                data_dir.join("content")
            )),
            config: Arc::new(config),
        }
    }
}

/// FromRef enables extracting sub-dependencies
impl FromRef<AppState> for Arc<JsonRouteRepository> {
    fn from_ref(state: &AppState) -> Self {
        state.routes.clone()
    }
}
```

### Router Setup

```rust
use axum::{Router, routing::{get, post, put, delete}};

pub fn admin_api_routes() -> Router<AppState> {
    Router::new()
        // Route CRUD
        .route("/routes", get(routes_api::list).post(routes_api::create))
        .route("/routes/:path",
            get(routes_api::get_one)
            .put(routes_api::update)
            .delete(routes_api::delete)
        )
        // Block CRUD
        .route("/blocks/:route", get(blocks_api::list).post(blocks_api::save))
}
```

### Middleware Considerations

No special middleware required for CRUD. Standard middleware stack applies:
- `TraceLayer` for request logging
- `TimeoutLayer` for request timeouts
- Optional: `CorsLayer` for cross-origin requests

---

## 5. Entity Definition Patterns

### Route Entity with Entity Trait

```rust
use serde::{Serialize, Deserialize};

/// Route definition with path as primary key
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Route {
    /// URL path (primary key), e.g., "/", "/about"
    pub path: String,

    /// Route name for admin display, e.g., "homepage", "about"
    pub name: String,

    /// Associated content file paths
    #[serde(rename = "blockIds")]
    pub block_ids: Vec<String>,
}

impl Entity for Route {
    type Id = String;

    fn id(&self) -> &Self::Id {
        &self.path
    }
}
```

### Primary Key Strategies

**String-based IDs (current):**
```rust
// Simple, human-readable, good for URL paths
impl Entity for Route {
    type Id = String;
    fn id(&self) -> &Self::Id { &self.path }
}
```

**UUID-based IDs (recommended for new entities):**
```rust
use uuid::Uuid;

/// Newtype for type-safe UUIDs
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct BlockId(Uuid);

impl BlockId {
    pub fn new() -> Self {
        Self(Uuid::new_v4())
    }

    pub fn from_str(s: &str) -> Result<Self, uuid::Error> {
        Ok(Self(Uuid::parse_str(s)?))
    }
}

impl std::fmt::Display for BlockId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}
```

### Validation with Smart Constructors

```rust
use thiserror::Error;

/// Validation errors for Route entity
#[derive(Debug, Error)]
pub enum RouteValidationError {
    #[error("path must start with /")]
    InvalidPath,

    #[error("name cannot be empty")]
    EmptyName,

    #[error("name contains invalid characters")]
    InvalidName,
}

/// Validated route - cannot be constructed with invalid data
pub struct ValidatedRoute(Route);

impl ValidatedRoute {
    /// Smart constructor validates before construction
    pub fn new(route: Route) -> Result<Self, RouteValidationError> {
        // Path must start with /
        if !route.path.starts_with('/') {
            return Err(RouteValidationError::InvalidPath);
        }

        // Name must be non-empty
        if route.name.trim().is_empty() {
            return Err(RouteValidationError::EmptyName);
        }

        // Name must be alphanumeric with hyphens
        if !route.name.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '_') {
            return Err(RouteValidationError::InvalidName);
        }

        Ok(Self(route))
    }

    /// Unwrap the validated route
    pub fn into_inner(self) -> Route {
        self.0
    }

    /// Borrow the inner route
    pub fn as_inner(&self) -> &Route {
        &self.0
    }
}
```

---

## 6. File vs. Database Implementation

### JsonCrudRepository Implementation

```rust
use std::path::PathBuf;
use tokio::sync::RwLock;

/// JSON file-backed repository for any entity
pub struct JsonCrudRepository<T> {
    /// Path to the JSON file
    file_path: PathBuf,

    /// Read-write lock for concurrent access
    lock: RwLock<()>,

    /// Phantom data for type parameter
    _marker: std::marker::PhantomData<T>,
}

impl<T> JsonCrudRepository<T>
where
    T: JsonEntity,
{
    pub fn new(file_path: PathBuf) -> Self {
        Self {
            file_path,
            lock: RwLock::new(()),
            _marker: std::marker::PhantomData,
        }
    }

    /// Atomic write: write to temp file, then rename
    async fn write_atomic(&self, entities: &[T]) -> Result<(), RepositoryError> {
        let temp_path = self.file_path.with_extension("tmp");

        let json = serde_json::to_string_pretty(entities)
            .map_err(|e| RepositoryError::Serialization(e))?;

        tokio::fs::write(&temp_path, &json).await
            .map_err(|e| RepositoryError::Storage(StorageError::Io(e)))?;

        tokio::fs::rename(&temp_path, &self.file_path).await
            .map_err(|e| RepositoryError::Storage(StorageError::Io(e)))?;

        Ok(())
    }

    /// Read all entities from file
    async fn read_all(&self) -> Result<Vec<T>, RepositoryError> {
        match tokio::fs::read_to_string(&self.file_path).await {
            Ok(contents) => {
                if contents.trim().is_empty() {
                    Ok(vec![])
                } else {
                    serde_json::from_str(&contents)
                        .map_err(|e| RepositoryError::Serialization(e))
                }
            }
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
                Ok(vec![])
            }
            Err(e) => Err(RepositoryError::Storage(StorageError::Io(e))),
        }
    }
}

impl<T> ReadRepository<T, T::Id> for JsonCrudRepository<T>
where
    T: JsonEntity,
{
    async fn find_by_id(&self, id: &T::Id) -> Result<Option<T>, RepositoryError> {
        let _guard = self.lock.read().await;
        let entities = self.read_all().await?;
        Ok(entities.into_iter().find(|e| e.id() == id))
    }

    async fn find_all(&self) -> Result<Vec<T>, RepositoryError> {
        let _guard = self.lock.read().await;
        self.read_all().await
    }

    async fn exists(&self, id: &T::Id) -> Result<bool, RepositoryError> {
        Ok(self.find_by_id(id).await?.is_some())
    }
}

impl<T> WriteRepository<T, T::Id> for JsonCrudRepository<T>
where
    T: JsonEntity,
{
    async fn create(&self, entity: &T) -> Result<T, RepositoryError> {
        let _guard = self.lock.write().await;
        let mut entities = self.read_all().await?;

        // Check for duplicates
        if entities.iter().any(|e| e.id() == entity.id()) {
            return Err(RepositoryError::AlreadyExists {
                entity_type: std::any::type_name::<T>().to_string(),
                id: entity.id().to_string(),
            });
        }

        entities.push(entity.clone());
        self.write_atomic(&entities).await?;

        Ok(entity.clone())
    }

    async fn update(&self, entity: &T) -> Result<T, RepositoryError> {
        let _guard = self.lock.write().await;
        let mut entities = self.read_all().await?;

        let idx = entities
            .iter()
            .position(|e| e.id() == entity.id())
            .ok_or_else(|| RepositoryError::NotFound {
                entity_type: std::any::type_name::<T>().to_string(),
                id: entity.id().to_string(),
            })?;

        entities[idx] = entity.clone();
        self.write_atomic(&entities).await?;

        Ok(entity.clone())
    }

    async fn delete(&self, id: &T::Id) -> Result<bool, RepositoryError> {
        let _guard = self.lock.write().await;
        let mut entities = self.read_all().await?;
        let original_len = entities.len();

        entities.retain(|e| e.id() != id);

        if entities.len() < original_len {
            self.write_atomic(&entities).await?;
            Ok(true)
        } else {
            Ok(false)
        }
    }
}
```

### Database Considerations

When migrating to a database:

**Connection Pooling:**
```rust
use sqlx::PgPool;

pub struct PostgresRouteRepository {
    pool: PgPool,
}

impl PostgresRouteRepository {
    pub async fn new(database_url: &str) -> Result<Self, sqlx::Error> {
        let pool = PgPool::connect(database_url).await?;
        Ok(Self { pool })
    }
}
```

**Transactions:**
```rust
pub trait TransactionalRepository<T, ID>: CrudRepository<T, ID> {
    type Transaction<'a>: CrudRepository<T, ID> where Self: 'a;

    fn begin(&self) -> impl Future<Output = Result<Self::Transaction<'_>, RepositoryError>> + Send;
}
```

**Migrations:**
- Use `sqlx-cli` for SQL migrations
- Store migration files in `migrations/`
- Run migrations on application startup

### Swappability Pattern

Use feature flags for backend selection:

```toml
# Cargo.toml
[features]
default = ["json-backend"]
json-backend = []
postgres-backend = ["sqlx"]
```

```rust
// src/core/repository/mod.rs

#[cfg(feature = "json-backend")]
pub type RouteRepository = JsonCrudRepository<Route>;

#[cfg(feature = "postgres-backend")]
pub type RouteRepository = PostgresRouteRepository;
```

---

## 7. Configuration-Focused Design

### Explicit vs. Implicit Patterns

**Rails Convention (what we're NOT doing):**
```ruby
# Magic: Model name -> table name -> controller name
class User < ApplicationRecord
  # Automatically creates CRUD for 'users' table
end
```

**Our Configuration Approach:**
```rust
// Explicit: Every relationship is visible in code

// 1. Entity definition
pub struct Route { ... }

// 2. Explicit Entity trait implementation
impl Entity for Route {
    type Id = String;
    fn id(&self) -> &Self::Id { &self.path }
}

// 3. Explicit repository configuration
pub fn new_route_repository(path: PathBuf) -> JsonCrudRepository<Route> {
    JsonCrudRepository::new(path)
}

// 4. Explicit AppState wiring
impl AppState {
    pub fn new(config: Config) -> Self {
        Self {
            routes: Arc::new(new_route_repository(
                config.data_dir.join("routes.json")
            )),
            // ... other repositories
        }
    }
}

// 5. Explicit handler definitions
pub async fn list_routes(
    State(repo): State<Arc<JsonCrudRepository<Route>>>,
) -> Result<Json<Vec<Route>>, ApiError> {
    // ...
}
```

### Type-Safe Configuration

```rust
use serde::Deserialize;
use std::path::PathBuf;

/// Application configuration (validated at startup)
#[derive(Debug, Clone, Deserialize)]
pub struct Config {
    /// Directory for JSON data files
    pub data_directory: PathBuf,

    /// Server binding address
    pub bind_address: String,

    /// Server port
    pub port: u16,
}

impl Config {
    pub fn load() -> Result<Self, ConfigError> {
        // Load from environment or file
        let config = envy::from_env::<Config>()?;

        // Validate at startup
        config.validate()?;

        Ok(config)
    }

    fn validate(&self) -> Result<(), ConfigError> {
        if !self.data_directory.exists() {
            return Err(ConfigError::MissingDataDirectory(
                self.data_directory.clone()
            ));
        }

        if self.port == 0 {
            return Err(ConfigError::InvalidPort);
        }

        Ok(())
    }
}
```

### Benefits of Configuration Focus

| Rails Convention | Rust Configuration | Trade-off |
|-----------------|-------------------|-----------|
| Less boilerplate | More explicit code | Clarity over brevity |
| Magic method dispatch | Type-checked at compile time | Safety over convenience |
| Runtime errors | Compile-time errors | Earlier error detection |
| Global state | Explicit dependency injection | Testability |
| DSL learning curve | Standard Rust patterns | Transferable skills |

---

## 8. Scaling to Multiple Entities

### Step-by-Step Guide for Adding a New CRUD Entity

**Step 1: Define the Entity**
```rust
// src/core/entities/post.rs
use serde::{Serialize, Deserialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Post {
    pub id: Uuid,
    pub title: String,
    pub content: String,
    pub route_path: String,  // Foreign key to Route
    pub created_at: chrono::DateTime<chrono::Utc>,
}

impl Entity for Post {
    type Id = Uuid;

    fn id(&self) -> &Self::Id {
        &self.id
    }
}
```

**Step 2: Create Validation Wrapper**
```rust
// src/core/entities/post.rs (continued)
pub struct ValidatedPost(Post);

impl ValidatedPost {
    pub fn new(post: Post) -> Result<Self, PostValidationError> {
        if post.title.trim().is_empty() {
            return Err(PostValidationError::EmptyTitle);
        }
        if post.title.len() > 200 {
            return Err(PostValidationError::TitleTooLong);
        }
        Ok(Self(post))
    }

    pub fn into_inner(self) -> Post { self.0 }
}
```

**Step 3: Add Repository to AppState**
```rust
// src/core/state.rs
#[derive(Clone, FromRef)]
pub struct AppState {
    pub routes: Arc<JsonCrudRepository<Route>>,
    pub posts: Arc<JsonCrudRepository<Post>>,  // Add new repository
    pub config: Arc<Config>,
}

impl AppState {
    pub fn new(config: Config) -> Self {
        let data_dir = PathBuf::from(&config.data_directory);

        Self {
            routes: Arc::new(JsonCrudRepository::new(
                data_dir.join("routes.json")
            )),
            posts: Arc::new(JsonCrudRepository::new(
                data_dir.join("posts.json")  // New file
            )),
            config: Arc::new(config),
        }
    }
}
```

**Step 4: Create Handlers**
```rust
// src/pages/admin/posts_api.rs
pub async fn list_posts(
    State(repo): State<Arc<JsonCrudRepository<Post>>>,
) -> Result<Json<Vec<Post>>, ApiError> {
    let posts = repo.find_all().await?;
    Ok(Json(posts))
}

pub async fn create_post(
    State(repo): State<Arc<JsonCrudRepository<Post>>>,
    Json(input): Json<CreatePostInput>,
) -> Result<(StatusCode, Json<Post>), ApiError> {
    let post = Post {
        id: Uuid::new_v4(),
        title: input.title,
        content: input.content,
        route_path: input.route_path,
        created_at: chrono::Utc::now(),
    };

    let validated = ValidatedPost::new(post)?;
    let created = repo.create(validated.as_inner()).await?;

    Ok((StatusCode::CREATED, Json(created)))
}

// ... get_post, update_post, delete_post
```

**Step 5: Register Routes**
```rust
// src/pages/admin/mod.rs
pub fn admin_api_routes() -> Router<AppState> {
    Router::new()
        .nest("/routes", routes_api::router())
        .nest("/posts", posts_api::router())  // Add new routes
}
```

**Step 6: Add Contract Tests**
```rust
// tests/posts_repository_tests.rs
#[tokio::test]
async fn post_repository_satisfies_crud_contract() {
    let temp_dir = tempfile::tempdir().unwrap();
    let repo = JsonCrudRepository::<Post>::new(
        temp_dir.path().join("posts.json")
    );

    repository_contract_tests::test_crud_contract(repo).await;
}
```

### Boilerplate Reduction with Macros (Optional)

For teams with many entities, a macro can generate handlers:

```rust
macro_rules! crud_handlers {
    ($entity:ty, $validated:ty, $input:ty) => {
        pub async fn list(
            State(repo): State<Arc<JsonCrudRepository<$entity>>>,
        ) -> Result<Json<Vec<$entity>>, ApiError> {
            let entities = repo.find_all().await?;
            Ok(Json(entities))
        }

        pub async fn create(
            State(repo): State<Arc<JsonCrudRepository<$entity>>>,
            Json(input): Json<$input>,
        ) -> Result<(StatusCode, Json<$entity>), ApiError> {
            let entity = <$entity>::from(input);
            let validated = <$validated>::new(entity)?;
            let created = repo.create(validated.as_inner()).await?;
            Ok((StatusCode::CREATED, Json(created)))
        }

        // ... get, update, delete
    };
}

// Usage
mod posts_api {
    crud_handlers!(Post, ValidatedPost, CreatePostInput);
}
```

**Recommendation:** Start without macros. Only add them when you have 5+ similar entities and see clear patterns.

---

## 9. Error Handling Strategy

### CrudError Type Design

```rust
use thiserror::Error;

/// Low-level storage errors
#[derive(Debug, Error)]
pub enum StorageError {
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),

    #[error("file locked for writing")]
    Locked,

    #[error("database error: {0}")]
    Database(#[source] Box<dyn std::error::Error + Send + Sync>),
}

/// Repository-layer errors
#[derive(Debug, Error)]
pub enum RepositoryError {
    #[error("entity not found: {entity_type} with id {id}")]
    NotFound { entity_type: String, id: String },

    #[error("entity already exists: {entity_type} with id {id}")]
    AlreadyExists { entity_type: String, id: String },

    #[error("storage error: {0}")]
    Storage(#[from] StorageError),

    #[error("serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("concurrent modification detected")]
    ConcurrentModification,
}

/// API-layer errors (includes validation)
#[derive(Debug, Error)]
pub enum ApiError {
    #[error("repository error: {0}")]
    Repository(#[from] RepositoryError),

    #[error("validation error: {0}")]
    Validation(String),

    #[error("bad request: {0}")]
    BadRequest(String),
}
```

### HTTP Status Code Mapping

```rust
use axum::{
    response::{IntoResponse, Response},
    http::StatusCode,
    Json,
};
use serde_json::json;

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, error_type, message) = match &self {
            // 404 Not Found
            ApiError::Repository(RepositoryError::NotFound { .. }) => {
                (StatusCode::NOT_FOUND, "not_found", self.to_string())
            }

            // 409 Conflict
            ApiError::Repository(RepositoryError::AlreadyExists { .. }) => {
                (StatusCode::CONFLICT, "already_exists", self.to_string())
            }
            ApiError::Repository(RepositoryError::ConcurrentModification) => {
                (StatusCode::CONFLICT, "concurrent_modification", self.to_string())
            }

            // 400 Bad Request
            ApiError::Validation(msg) => {
                (StatusCode::BAD_REQUEST, "validation_error", msg.clone())
            }
            ApiError::BadRequest(msg) => {
                (StatusCode::BAD_REQUEST, "bad_request", msg.clone())
            }

            // 500 Internal Server Error (hide internal details)
            ApiError::Repository(RepositoryError::Storage(_)) |
            ApiError::Repository(RepositoryError::Serialization(_)) => {
                (StatusCode::INTERNAL_SERVER_ERROR, "internal_error",
                 "An internal error occurred".to_string())
            }
        };

        let body = Json(json!({
            "error": {
                "type": error_type,
                "message": message,
            }
        }));

        (status, body).into_response()
    }
}
```

### Error Context and Logging

```rust
use tracing::{error, warn, instrument};

impl<T> WriteRepository<T, T::Id> for JsonCrudRepository<T>
where
    T: JsonEntity,
{
    #[instrument(skip(self, entity), fields(entity_id = %entity.id()))]
    async fn create(&self, entity: &T) -> Result<T, RepositoryError> {
        let _guard = self.lock.write().await;

        match self.create_internal(entity).await {
            Ok(created) => {
                tracing::info!("Entity created successfully");
                Ok(created)
            }
            Err(e) => {
                error!(error = %e, "Failed to create entity");
                Err(e)
            }
        }
    }
}
```

---

## 10. Production Considerations

### Observability

**Tracing with spans:**
```rust
use tracing::{instrument, info_span, Instrument};

impl<T> ReadRepository<T, T::Id> for JsonCrudRepository<T>
where
    T: JsonEntity,
{
    #[instrument(skip(self), fields(repository = %std::any::type_name::<T>()))]
    async fn find_all(&self) -> Result<Vec<T>, RepositoryError> {
        let span = info_span!("json_read", file = %self.file_path.display());

        async {
            let _guard = self.lock.read().await;
            self.read_all().await
        }
        .instrument(span)
        .await
    }
}
```

**Metrics (optional):**
```rust
use metrics::{counter, histogram};

async fn create(&self, entity: &T) -> Result<T, RepositoryError> {
    let start = std::time::Instant::now();

    let result = self.create_internal(entity).await;

    let duration = start.elapsed();
    histogram!("repository_operation_duration_seconds",
        "operation" => "create",
        "entity" => std::any::type_name::<T>()
    ).record(duration.as_secs_f64());

    match &result {
        Ok(_) => counter!("repository_operations_total",
            "operation" => "create",
            "status" => "success"
        ).increment(1),
        Err(_) => counter!("repository_operations_total",
            "operation" => "create",
            "status" => "error"
        ).increment(1),
    }

    result
}
```

### Testing Strategies

**Unit Tests (in-memory):**
```rust
#[derive(Default)]
pub struct InMemoryRepository<T: Entity> {
    data: RwLock<HashMap<T::Id, T>>,
}

impl<T: Entity + Clone> ReadRepository<T, T::Id> for InMemoryRepository<T> {
    async fn find_all(&self) -> Result<Vec<T>, RepositoryError> {
        Ok(self.data.read().await.values().cloned().collect())
    }
    // ...
}
```

**Contract Tests:**
```rust
pub async fn test_crud_contract<R, T>(repo: R)
where
    R: CrudRepository<T, T::Id>,
    T: Entity + Clone + PartialEq + std::fmt::Debug,
{
    // Test 1: Create returns the entity
    let entity = create_test_entity();
    let created = repo.create(&entity).await.unwrap();
    assert_eq!(created, entity);

    // Test 2: Find returns the created entity
    let found = repo.find_by_id(entity.id()).await.unwrap();
    assert_eq!(found, Some(entity.clone()));

    // Test 3: Duplicate create fails
    let duplicate = repo.create(&entity).await;
    assert!(matches!(duplicate, Err(RepositoryError::AlreadyExists { .. })));

    // Test 4: Update modifies the entity
    let mut updated = entity.clone();
    // ... modify updated
    let result = repo.update(&updated).await.unwrap();
    assert_eq!(result, updated);

    // Test 5: Delete removes the entity
    let deleted = repo.delete(entity.id()).await.unwrap();
    assert!(deleted);

    // Test 6: Find returns None after delete
    let not_found = repo.find_by_id(entity.id()).await.unwrap();
    assert!(not_found.is_none());
}
```

**Integration Tests:**
```rust
#[tokio::test]
async fn json_repository_integration() {
    let temp_dir = tempfile::tempdir().unwrap();
    let repo = JsonCrudRepository::<Route>::new(
        temp_dir.path().join("routes.json")
    );

    // Run full contract tests
    test_crud_contract(repo).await;
}
```

### Performance Considerations

- **File locking:** `RwLock` allows concurrent reads, serialized writes
- **Atomic writes:** Temp file + rename prevents corruption
- **Caching:** For read-heavy workloads, add an in-memory cache layer
- **Batch operations:** Consider `create_many`, `update_many` for bulk ops

### Security

- **Input validation:** Always use `ValidatedEntity` wrappers
- **Path traversal:** Validate file paths don't escape data directory
- **Sensitive data:** Never log passwords, tokens, or PII
- **Authorization:** Add auth middleware before CRUD handlers

---

## 11. Code Examples

### Complete Working Example: Route CRUD

**Entity (src/core/entities/route.rs):**
```rust
use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Route {
    pub path: String,
    pub name: String,
    #[serde(rename = "blockIds")]
    pub block_ids: Vec<String>,
}

impl Entity for Route {
    type Id = String;
    fn id(&self) -> &Self::Id { &self.path }
}

// Validation
pub struct ValidatedRoute(Route);

impl ValidatedRoute {
    pub fn new(route: Route) -> Result<Self, RouteValidationError> {
        if !route.path.starts_with('/') {
            return Err(RouteValidationError::InvalidPath);
        }
        if route.name.trim().is_empty() {
            return Err(RouteValidationError::EmptyName);
        }
        Ok(Self(route))
    }

    pub fn into_inner(self) -> Route { self.0 }
    pub fn as_inner(&self) -> &Route { &self.0 }
}
```

**Handlers (src/pages/admin/routes_api.rs):**
```rust
use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use std::sync::Arc;

/// GET /admin/api/routes
pub async fn list(
    State(repo): State<Arc<JsonCrudRepository<Route>>>,
) -> Result<Json<Vec<Route>>, ApiError> {
    let routes = repo.find_all().await?;
    Ok(Json(routes))
}

/// GET /admin/api/routes/:path
pub async fn get_one(
    State(repo): State<Arc<JsonCrudRepository<Route>>>,
    Path(path): Path<String>,
) -> Result<Json<Route>, ApiError> {
    let decoded_path = urlencoding::decode(&path)
        .map_err(|_| ApiError::BadRequest("Invalid path encoding".into()))?;

    let route = repo.find_by_id(&decoded_path.to_string()).await?
        .ok_or_else(|| ApiError::Repository(RepositoryError::NotFound {
            entity_type: "Route".into(),
            id: decoded_path.to_string(),
        }))?;

    Ok(Json(route))
}

/// POST /admin/api/routes
pub async fn create(
    State(repo): State<Arc<JsonCrudRepository<Route>>>,
    Json(input): Json<CreateRouteInput>,
) -> Result<(StatusCode, Json<Route>), ApiError> {
    let route = Route {
        path: input.path,
        name: input.name,
        block_ids: input.block_ids.unwrap_or_default(),
    };

    let validated = ValidatedRoute::new(route)
        .map_err(|e| ApiError::Validation(e.to_string()))?;

    let created = repo.create(validated.as_inner()).await?;
    Ok((StatusCode::CREATED, Json(created)))
}

/// PUT /admin/api/routes/:path
pub async fn update(
    State(repo): State<Arc<JsonCrudRepository<Route>>>,
    Path(path): Path<String>,
    Json(input): Json<UpdateRouteInput>,
) -> Result<Json<Route>, ApiError> {
    let decoded_path = urlencoding::decode(&path)
        .map_err(|_| ApiError::BadRequest("Invalid path encoding".into()))?;

    let mut route = repo.find_by_id(&decoded_path.to_string()).await?
        .ok_or_else(|| ApiError::Repository(RepositoryError::NotFound {
            entity_type: "Route".into(),
            id: decoded_path.to_string(),
        }))?;

    // Apply updates
    if let Some(name) = input.name {
        route.name = name;
    }
    if let Some(block_ids) = input.block_ids {
        route.block_ids = block_ids;
    }

    let validated = ValidatedRoute::new(route)
        .map_err(|e| ApiError::Validation(e.to_string()))?;

    let updated = repo.update(validated.as_inner()).await?;
    Ok(Json(updated))
}

/// DELETE /admin/api/routes/:path
pub async fn delete(
    State(repo): State<Arc<JsonCrudRepository<Route>>>,
    Path(path): Path<String>,
) -> Result<StatusCode, ApiError> {
    let decoded_path = urlencoding::decode(&path)
        .map_err(|_| ApiError::BadRequest("Invalid path encoding".into()))?;

    let deleted = repo.delete(&decoded_path.to_string()).await?;

    if deleted {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(ApiError::Repository(RepositoryError::NotFound {
            entity_type: "Route".into(),
            id: decoded_path.to_string(),
        }))
    }
}

/// Router for route CRUD operations
pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(list).post(create))
        .route("/:path", get(get_one).put(update).delete(delete))
}
```

**AppState (src/core/state.rs):**
```rust
use axum::extract::FromRef;
use std::sync::Arc;
use std::path::PathBuf;

#[derive(Clone, FromRef)]
pub struct AppState {
    pub routes: Arc<JsonCrudRepository<Route>>,
    pub config: Arc<Config>,
}

impl AppState {
    pub fn new(config: Config) -> Self {
        let data_dir = PathBuf::from(&config.data_directory);

        Self {
            routes: Arc::new(JsonCrudRepository::new(
                data_dir.join("routes.json")
            )),
            config: Arc::new(config),
        }
    }
}

impl FromRef<AppState> for Arc<JsonCrudRepository<Route>> {
    fn from_ref(state: &AppState) -> Self {
        state.routes.clone()
    }
}
```

**Router (src/pages/admin/mod.rs):**
```rust
use axum::Router;

pub mod routes_api;

pub fn admin_api_routes() -> Router<AppState> {
    Router::new()
        .nest("/routes", routes_api::router())
}
```

---

## 12. Implementation Roadmap

### Phase 1: Core Infrastructure
1. Create `src/core/repository/` module structure
2. Define `Entity` trait and bounds
3. Implement `RepositoryError` and `StorageError`
4. Implement `ApiError` with `IntoResponse`

### Phase 2: JSON Repository
1. Implement generic `JsonCrudRepository<T>`
2. Add atomic write support
3. Add concurrent access handling with `RwLock`
4. Write unit tests

### Phase 3: Route CRUD Migration
1. Implement `Entity` for `Route`
2. Create `ValidatedRoute` wrapper
3. Update `AppState` to use new repository
4. Create new handlers in `routes_api.rs`
5. Update router to use new endpoints
6. Write integration tests

### Phase 4: Generalize Pattern
1. Document the pattern in skill file
2. Create second entity (e.g., `Block`) using same pattern
3. Refine based on learnings
4. Consider macro generation for boilerplate

### Migration Strategy from Current Code

1. **Keep existing code working** during migration
2. Create new repository alongside existing `persistence.rs`
3. Add new routes with `/v2/` prefix for testing
4. Once validated, switch over and remove old code
5. Remove `/v2/` prefix

---

## 13. Skill Document Outline

The final skill document should include:

### Structure
```
.claude/skills/axum-crud-repository/
  SKILL.md
```

### Proposed Sections

1. **When to Use This Skill**
   - Adding CRUD for a new entity
   - Migrating from ad-hoc persistence to repository pattern
   - Setting up JSON-based data storage

2. **Core Concepts**
   - Entity trait and bounds
   - Repository traits (Read, Write, CRUD)
   - Error types and HTTP mapping

3. **Patterns**
   - JSON file repository implementation
   - AppState integration with FromRef
   - Handler patterns for CRUD operations
   - Validation with newtype wrappers

4. **Step-by-Step Guide**
   - Adding a new CRUD entity (checklist)
   - Migrating existing entities
   - Testing strategies

5. **Code Templates**
   - Entity definition template
   - Repository setup template
   - Handler templates
   - Test templates

6. **Related Skills**
   - `axum-service-architecture` - layered design
   - `axum-web-framework` - Axum patterns
   - `rust-core-patterns` - newtypes, validation
   - `rust-error-handling` - error types

---

## Appendix: Related Reading

- [Axum Documentation](https://docs.rs/axum)
- [Tower Documentation](https://docs.rs/tower)
- [Rust Error Handling](https://doc.rust-lang.org/book/ch09-00-error-handling.html)
- [Repository Pattern](https://martinfowler.com/eaaCatalog/repository.html)
