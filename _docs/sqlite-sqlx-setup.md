# SQLite + SQLx Setup Guide

*A comprehensive guide for developers who have struggled with SQL databases*

---

## Why This Guide Exists

If you have ever:

- Tried to install PostgreSQL and got lost in authentication settings
- Wondered why your database connection keeps timing out
- Spent hours configuring usernames, passwords, and permissions
- Given up on SQL and stuck with JSON files

This guide is for you.

SQLite eliminates all of that complexity. There is no server. No authentication. No configuration. The database is a single file on your disk.

---

## Part 1: What is SQLite?

### The Mental Model

Traditional databases (PostgreSQL, MySQL) work like this:

```
Your App  -->  Network  -->  Database Server  -->  Files on Disk
              (TCP/IP)       (Running process)      (Data storage)
```

SQLite works like this:

```
Your App  -->  Files on Disk
              (That's it)
```

### Key Differences from PostgreSQL/MySQL

| Feature | PostgreSQL/MySQL | SQLite |
|---------|-----------------|--------|
| Server process | Required | None |
| Network connection | Required | None |
| Authentication | Users, passwords, permissions | None (file permissions only) |
| Installation | Complex | One file |
| Configuration | Many options | Almost none |
| Concurrent writes | Many clients | One writer at a time |
| Database location | Server's data directory | Any file you choose |

### When to Use SQLite

SQLite is perfect for:

- Learning SQL without infrastructure complexity
- Single-server web applications
- Prototyping before migrating to PostgreSQL
- Embedded applications
- Development and testing

SQLite handles millions of rows and thousands of requests per second. It is not a toy database.

### When NOT to Use SQLite

- Multiple servers writing to the same database
- Very high write concurrency (hundreds of simultaneous writes)
- When you need PostgreSQL-specific features (JSONB, full-text search, etc.)

For most web applications starting out, SQLite is more than enough.

---

## Part 2: Installing the SQLite CLI

The SQLite CLI lets you inspect and query your database files directly. This is invaluable for debugging.

### macOS (with Homebrew)

```bash
brew install sqlite
```

### Verify Installation

```bash
sqlite3 --version
```

Expected output:

```
3.43.0 2023-08-24 ...
```

(Version numbers will vary)

### Quick Test

Create a temporary database and run a query:

```bash
sqlite3 :memory: "SELECT 'SQLite is working!' AS message;"
```

Expected output:

```
SQLite is working!
```

If you see this, SQLite CLI is installed correctly.

---

## Part 3: Adding SQLx to Your Rust Project

SQLx is a Rust library for working with SQL databases. It has a killer feature: **compile-time SQL checking**. Your SQL queries are verified against your actual database schema at compile time.

### Cargo.toml Configuration

Add SQLx and dotenvy to your project's `Cargo.toml`:

```toml
[dependencies]
sqlx = { version = "0.8", features = ["runtime-tokio", "sqlite"] }
tokio = { version = "1", features = ["full"] }
dotenvy = "0.15"
```

**Why dotenvy?** The `sqlx-cli` tool automatically reads `.env` files, but your Rust code does not. The `dotenvy` crate loads environment variables from `.env` files at runtime. Without it, `std::env::var("DATABASE_URL")` will fail even if `.env` exists.

### Understanding the Features

- `runtime-tokio`: SQLx needs an async runtime. Tokio is the most common choice.
- `sqlite`: Enables SQLite support. You could also use `postgres` or `mysql`.

### Checkpoint: Verify SQLx Compiles

Create a minimal `src/main.rs`:

```rust
use sqlx::sqlite::SqlitePool;

#[tokio::main]
async fn main() {
    println!("SQLx is configured correctly!");
}
```

Run:

```bash
cargo check
```

Expected output:

```
    Checking your-project v0.1.0 (...)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in X.XXs
```

If this compiles, SQLx is configured correctly.

---

## Part 4: Installing sqlx-cli

The `sqlx-cli` tool manages your database and migrations from the command line.

### Install

```bash
cargo install sqlx-cli --features sqlite
```

This takes a few minutes. You are compiling the CLI tool from source.

### Verify Installation

```bash
sqlx --version
```

Expected output:

```
sqlx-cli 0.8.x
```

### What sqlx-cli Does

- `sqlx database create` - Creates the database file
- `sqlx migrate add` - Creates new migration files
- `sqlx migrate run` - Applies pending migrations
- `sqlx prepare` - Generates offline query data for CI

---

## Working with Cargo Workspaces

If your project uses a Cargo workspace (multiple crates in one repository), SQLx commands need to run from the right location. This section explains the differences.

### Typical Workspace Structure

```
my-project/               # Workspace root
  Cargo.toml              # [workspace] members = ["website", "shared"]
  .env                    # DATABASE_URL goes here (ONLY here, not in members)
  data/
    app.db                # Database at workspace root
  website/                # Member with SQLx queries
    Cargo.toml
    src/
    migrations/           # Migrations go in the member using SQLx
  shared/                 # Other members
    Cargo.toml
    src/
```

### Key Differences from Single-Package Projects

| Operation | Single Package | Workspace |
|-----------|---------------|-----------|
| `.env` file location | Project root | Workspace root (ONLY here) |
| `data/app.db` location | Project root | Workspace root |
| `migrations/` location | Project root | Member directory that uses SQLx |
| `cargo sqlx prepare` | `cargo sqlx prepare` | `cargo sqlx prepare --workspace` |
| `sqlx migrate run` | From project root | From member directory, or use `--manifest-path` |

### Why This Matters

The `sqlx-cli` tool needs to find:

1. **DATABASE_URL**: Read from `.env` in the current directory or parent directories
2. **Cargo.toml**: To identify the package and find SQLx queries
3. **migrations/**: To apply schema changes

In a workspace, these files are split between the workspace root and member directories. The commands throughout this guide show both single-package and workspace variants where they differ.

> **Note:** Since `sqlx-cli` searches parent directories for `.env`, placing it at the workspace root means it will be found whether you run commands from the workspace root or from a member directory like `website/`.

---

## Part 5: Creating Your First Database

### The DATABASE_URL Environment Variable

SQLx needs to know where your database is. For SQLite, this is a file path.

> **WARNING: Create only ONE .env file.**
>
> - Single-package project: `.env` in the project root
> - Workspace project: `.env` in the workspace root only
>
> Do NOT create `.env` files in both locations. The `sqlx` CLI searches parent directories, so a workspace `.env` will be found from any member directory.

**Single-package project:** Create a `.env` file in your project root:

```bash
# .env (in project root)
DATABASE_URL=sqlite:./data/app.db
```

**Workspace project:** Create a `.env` file in the workspace root:

```bash
# .env (in workspace root, e.g., my-project/.env)
DATABASE_URL=sqlite:./data/app.db
```

Keep the database at the workspace root (`./data/app.db`) for simplicity. The migrations live in the member directory, but the database itself belongs at the workspace root where you run most commands.

The format is: `sqlite:` followed by the file path.

The `sqlx` CLI automatically reads from `.env` files, so you do not need to export the variable manually. This is cleaner than using `export` because:

1. The setting persists across terminal sessions
2. It is consistent for all developers (just copy `.env.example`)
3. Your Rust code can also read from it

**Important:** Add `.env` to your `.gitignore` to avoid committing secrets.

### Create the Database

**Single-package project:**

```bash
# Create the directory first
mkdir -p data

# Create the database (sqlx reads DATABASE_URL from .env)
sqlx database create
```

**Workspace project:**

```bash
# Create the directory at the workspace root
mkdir -p data

# Create the database (run from workspace root)
sqlx database create
```

### What Just Happened?

SQLx created:

```
data/
  app.db      # Your SQLite database file (at workspace root)
```

That file IS your database. There is no server. No process. Just a file.

### Checkpoint: Verify Database Exists

```bash
ls -la data/
```

Expected output:

```
total 8
drwxr-xr-x  3 user  staff   96 Jan  1 12:00 .
drwxr-xr-x 10 user  staff  320 Jan  1 12:00 ..
-rw-r--r--  1 user  staff 8192 Jan  1 12:00 app.db
```

The file is small (8KB) because it only contains schema metadata.

### Inspect with SQLite CLI

```bash
sqlite3 data/app.db ".tables"
```

Expected output: (nothing, because we have no tables yet)

This is correct. The database exists but is empty.

---

## Part 6: Understanding Migrations

### What is a Migration?

A migration is a versioned change to your database schema. Instead of manually running `CREATE TABLE` commands, you write migration files that:

1. Are version-controlled (in git)
2. Can be applied automatically
3. Can be rolled back if needed
4. Keep all environments in sync

### Create a Migrations Directory

SQLx expects migrations in a `migrations/` directory.

**Single-package project:**

```bash
sqlx migrate add create_routes_table
```

This creates:

```
migrations/
  20240101120000_create_routes_table.sql
```

**Workspace project:** The `migrations/` directory belongs in the member that uses SQLx:

```bash
# From workspace root, specify the member
cd website && sqlx migrate add create_routes_table

# Or use --manifest-path
sqlx migrate add create_routes_table --manifest-path website/Cargo.toml
```

This creates:

```
website/
  migrations/
    20240101120000_create_routes_table.sql
```

The timestamp prefix ensures migrations run in order.

### Write Your First Migration

Open the generated file and add:

```sql
-- Create the routes table
CREATE TABLE IF NOT EXISTS routes (
    path TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Create an index for faster lookups by name
CREATE INDEX IF NOT EXISTS idx_routes_name ON routes(name);
```

### Run the Migration

**Single-package project:**

```bash
sqlx migrate run
```

**Workspace project:**

```bash
# From the member directory
cd website && sqlx migrate run

# Or from workspace root with --manifest-path
sqlx migrate run --manifest-path website/Cargo.toml
```

Expected output:

```
Applied 20240101120000/migrate create_routes_table (XXms)
```

### What Just Happened?

SQLx:

1. Read the migration file
2. Executed the SQL against your database
3. Recorded the migration in a special `_sqlx_migrations` table
4. Will never run this migration again (it tracks what has been applied)

### Checkpoint: Verify Table Exists

```bash
sqlite3 data/app.db ".tables"
```

Expected output:

```
_sqlx_migrations  routes
```

Two tables:
- `_sqlx_migrations` - SQLx's internal tracking table
- `routes` - Your table

### Inspect Table Schema

```bash
sqlite3 data/app.db ".schema routes"
```

Expected output:

```sql
CREATE TABLE routes (
    path TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_routes_name ON routes(name);
```

---

## Part 7: Compile-Time Query Checking

This is SQLx's killer feature. Your SQL queries are verified at compile time.

### The Problem with Runtime SQL

Most SQL libraries check queries at runtime:

```rust
// This compiles fine, but crashes at runtime
let rows = conn.query("SELECT nonexistent_column FROM routes").await?;
```

You only discover the error when the code runs. Maybe in production.

### SQLx's Solution

SQLx checks queries at compile time:

```rust
// This will NOT compile if the column doesn't exist
let routes = sqlx::query!("SELECT path, name FROM routes")
    .fetch_all(&pool)
    .await?;
```

If `path` or `name` do not exist, **cargo build fails**. You catch SQL errors before your code ever runs.

### How It Works

During compilation, SQLx:

1. Connects to your database (using `DATABASE_URL`)
2. Asks the database to parse your SQL
3. Verifies columns exist and types match
4. Generates Rust types based on query results

### The .sqlx Directory (Offline Mode)

What about CI/CD where there is no database?

SQLx can generate query metadata in a `.sqlx/` directory:

**Single-package project:**

```bash
cargo sqlx prepare
```

**Workspace project:** Use `--workspace` to prepare all members:

```bash
cargo sqlx prepare --workspace
```

This creates `.sqlx/` directories containing query metadata:

```
.sqlx/
  query-a1b2c3d4e5f6.json
  query-f6e5d4c3b2a1.json
  ...
```

These files describe your queries. During compilation without a database, SQLx uses these files instead.

**SQLx 0.8 Changes:**

- **Offline mode is automatic.** In SQLx 0.8, the `offline` feature flag was removed. Offline support is now enabled unconditionally - you do not need to add it to your `Cargo.toml` features.
- **One file per query.** The `.sqlx/` directory now stores each query in a separate JSON file (rather than a single large file). This reduces git merge conflicts when multiple developers add queries.
- **SQLX_OFFLINE environment variable.** Set `SQLX_OFFLINE=true` in your CI/CD environment to ensure builds never attempt to connect to a live database. This is recommended for reproducible builds.

### Checkpoint: Verify Compile-Time Checking

Create a test file to verify compile-time checking works:

```rust
// src/test_queries.rs (temporary test file)
use sqlx::sqlite::SqlitePool;

async fn test_valid_query(pool: &SqlitePool) {
    // This should compile - columns exist
    let routes = sqlx::query!("SELECT path, name FROM routes")
        .fetch_all(pool)
        .await;
}

async fn test_invalid_query(pool: &SqlitePool) {
    // This should NOT compile - column doesn't exist
    // Uncomment to see the compile error:
    // let routes = sqlx::query!("SELECT nonexistent FROM routes")
    //     .fetch_all(pool)
    //     .await;
}
```

Run:

```bash
cargo check
```

(The `.env` file provides `DATABASE_URL` automatically.)

If it compiles, your valid query is correct. Uncomment the invalid query to see compile-time checking catch the error.

---

## Part 8: Connection Pooling

### Why Pools Matter

Opening a database connection is expensive. A connection pool:

1. Opens connections once
2. Reuses them for multiple queries
3. Manages connection limits
4. Handles connection failures

### Create a Connection Pool

```rust
use dotenvy::dotenv;
use std::env;
use std::time::Duration;
use sqlx::sqlite::{SqlitePool, SqlitePoolOptions};

#[tokio::main]
async fn main() {
    // Load .env file (if present)
    // The .ok() ignores errors - in production, .env might not exist
    // and that's fine if env vars are set directly in the environment
    dotenv().ok();

    let pool = create_pool().await.expect("Failed to create database pool");
    // ... rest of your application
}

async fn create_pool() -> Result<SqlitePool, sqlx::Error> {
    let database_url = env::var("DATABASE_URL")
        .expect("DATABASE_URL must be set");

    SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await
}
```

**Important:** Call `dotenv().ok()` at the very beginning of `main()`, before any calls to `env::var()`. This ensures the `.env` file is loaded before your code tries to read environment variables.

### Connection Options

```rust
SqlitePoolOptions::new()
    .max_connections(5)           // Maximum pool size
    .min_connections(1)           // Keep at least 1 connection open
    .acquire_timeout(Duration::from_secs(3))  // Timeout when pool is full
    .connect(&database_url)
    .await
```

### Checkpoint: Test Connection

Create `src/main.rs`:

```rust
use std::env;
use axum::{routing::get, Router};
use sqlx::sqlite::SqlitePool;
use tokio::net::TcpListener;

#[tokio::main]
async fn main() {
    // Create database pool
    let pool = create_pool().await.expect("Failed to create database pool");

    // Test the connection with a simple query
    let row: (i64,) = sqlx::query_as("SELECT 1")
        .fetch_one(&pool)
        .await
        .expect("Failed to run test query");

    println!("Connection test: {}", row.0);
    assert_eq!(row.0, 1);

    // Query the routes table
    let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM routes")
        .fetch_one(&pool)
        .await
        .expect("Failed to count routes");

    println!("Routes in database: {}", count.0);
    println!("All connection tests passed!");

    // Build router with database pool as state
    let app = Router::new()
        .route("/", get(|| async { "Hello, World!" }))
        .with_state(pool);

    // Start server
    let listener = TcpListener::bind("127.0.0.1:3000")
        .await
        .expect("Failed to bind");

    println!("Listening on http://127.0.0.1:3000");

    if let Err(e) = axum::serve(listener, app).await {
        eprintln!("Server error: {}", e);
        std::process::exit(1);
    }
}

async fn create_pool() -> Result<SqlitePool, sqlx::Error> {
    let database_url = env::var("DATABASE_URL")
        .expect("DATABASE_URL must be set");
    SqlitePool::connect(&database_url).await
}
```

Run:

```bash
cargo run
```

Expected output:

```
Connection test: 1
Routes in database: 0
All connection tests passed!
```

---

## Part 9: The FromRow Derive

SQLx can automatically deserialize query results into your Rust structs.

### Define Your Entity

```rust
use sqlx::FromRow;

#[derive(Debug, Clone, FromRow)]
pub struct Route {
    pub path: String,
    pub name: String,
    pub created_at: String,
    pub updated_at: String,
}
```

### Query Into Struct

```rust
// Using query_as! with compile-time checking
let routes: Vec<Route> = sqlx::query_as!(
    Route,
    "SELECT path, name, created_at, updated_at FROM routes"
)
.fetch_all(&pool)
.await?;

// Or using query_as with runtime type checking
let routes: Vec<Route> = sqlx::query_as::<_, Route>(
    "SELECT path, name, created_at, updated_at FROM routes"
)
.fetch_all(&pool)
.await?;
```

### Checkpoint: FromRow Works

Add to `src/main.rs`:

```rust
use std::env;
use axum::{routing::get, Router, extract::State};
use sqlx::{FromRow, sqlite::SqlitePool};
use tokio::net::TcpListener;

#[derive(Debug, Clone, FromRow)]
pub struct Route {
    pub path: String,
    pub name: String,
    pub created_at: String,
    pub updated_at: String,
}

#[tokio::main]
async fn main() {
    // Create database pool
    let pool = create_pool().await.expect("Failed to create database pool");

    // Insert a test route
    sqlx::query(
        "INSERT OR REPLACE INTO routes (path, name) VALUES ('/test', 'Test Route')"
    )
    .execute(&pool)
    .await
    .expect("Failed to insert test route");

    // Query it back as a struct
    let route: Route = sqlx::query_as(
        "SELECT path, name, created_at, updated_at FROM routes WHERE path = '/test'"
    )
    .fetch_one(&pool)
    .await
    .expect("Failed to fetch route");

    println!("Found route: {:?}", route);
    assert_eq!(route.path, "/test");
    assert_eq!(route.name, "Test Route");

    // Clean up
    sqlx::query("DELETE FROM routes WHERE path = '/test'")
        .execute(&pool)
        .await
        .expect("Failed to clean up test route");

    println!("FromRow test passed!");

    // Build router with database pool as state
    let app = Router::new()
        .route("/", get(|| async { "FromRow works!" }))
        .with_state(pool);

    // Start server
    let listener = TcpListener::bind("127.0.0.1:3000")
        .await
        .expect("Failed to bind");

    println!("Listening on http://127.0.0.1:3000");

    if let Err(e) = axum::serve(listener, app).await {
        eprintln!("Server error: {}", e);
        std::process::exit(1);
    }
}

async fn create_pool() -> Result<SqlitePool, sqlx::Error> {
    let database_url = env::var("DATABASE_URL")
        .expect("DATABASE_URL must be set");
    SqlitePool::connect(&database_url).await
}
```

Run:

```bash
cargo run
```

Expected output:

```
Found route: Route { path: "/test", name: "Test Route", created_at: "...", updated_at: "..." }
FromRow test passed!
```

---

## Part 10: Complete Working Example

Here is a complete, working example that ties everything together:

### Cargo.toml

```toml
[package]
name = "sqlite-demo"
version = "0.1.0"
edition = "2021"

[dependencies]
axum = "0.8"
sqlx = { version = "0.8", features = ["runtime-tokio", "sqlite"] }
tokio = { version = "1", features = ["full"] }
```

### migrations/20240101000000_create_routes.sql

```sql
CREATE TABLE IF NOT EXISTS routes (
    path TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### src/main.rs

```rust
use std::env;
use axum::{routing::get, Router, extract::State, response::Json};
use sqlx::{FromRow, sqlite::SqlitePool};
use tokio::net::TcpListener;

#[derive(Debug, Clone, FromRow, serde::Serialize)]
pub struct Route {
    pub path: String,
    pub name: String,
    pub created_at: String,
    pub updated_at: String,
}

#[tokio::main]
async fn main() {
    // Create database pool
    let pool = create_pool().await.expect("Failed to create database pool");

    // Run migrations on startup
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("Failed to run migrations");

    // Seed test data
    seed_data(&pool).await;

    // Build router with database pool as state
    let app = Router::new()
        .route("/", get(|| async { "SQLite + Axum Demo" }))
        .route("/routes", get(list_routes))
        .with_state(pool);

    // Start server
    let listener = TcpListener::bind("127.0.0.1:3000")
        .await
        .expect("Failed to bind");

    println!("Listening on http://127.0.0.1:3000");

    if let Err(e) = axum::serve(listener, app).await {
        eprintln!("Server error: {}", e);
        std::process::exit(1);
    }
}

async fn create_pool() -> Result<SqlitePool, sqlx::Error> {
    let database_url = env::var("DATABASE_URL")
        .expect("DATABASE_URL must be set");
    SqlitePool::connect(&database_url).await
}

async fn seed_data(pool: &SqlitePool) {
    // Insert test route if it doesn't exist
    sqlx::query("INSERT OR IGNORE INTO routes (path, name) VALUES ($1, $2)")
        .bind("/about")
        .bind("About Page")
        .execute(pool)
        .await
        .expect("Failed to seed data");
    println!("Database seeded");
}

async fn list_routes(State(pool): State<SqlitePool>) -> Json<Vec<Route>> {
    let routes: Vec<Route> = sqlx::query_as(
        "SELECT path, name, created_at, updated_at FROM routes"
    )
    .fetch_all(&pool)
    .await
    .unwrap_or_default();

    Json(routes)
}
```

### Run It

```bash
# Create .env file
echo 'DATABASE_URL=sqlite:./data/app.db' > .env

# Set up database
mkdir -p data
sqlx database create
sqlx migrate run

# Run
cargo run
```

---

## Part 11: Deployment on render.com

### How SQLite Works in Production

On render.com, your SQLite file lives on the server's persistent disk:

```
/var/data/app.db    # Persistent across deployments
```

### render.yaml Configuration

```yaml
services:
  - type: web
    name: my-app
    runtime: rust
    buildCommand: cargo build --release
    startCommand: ./target/release/my-app
    envVars:
      - key: DATABASE_URL
        value: sqlite:/var/data/app.db
    disk:
      name: data
      mountPath: /var/data
      sizeGB: 1
```

### Key Points

1. **Persistent disk**: The `disk` section creates persistent storage that survives deployments
2. **DATABASE_URL**: Points to the file on persistent disk
3. **Migrations on startup**: Your app should run migrations on startup

### Startup Script Pattern

```rust
use std::env;
use axum::{routing::get, Router};
use sqlx::sqlite::SqlitePool;
use tokio::net::TcpListener;

#[tokio::main]
async fn main() {
    // Create database pool
    let pool = create_pool().await.expect("Failed to create database pool");

    // Run migrations on startup
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("Failed to run migrations");

    // Build router with database pool as state
    let app = Router::new()
        .route("/", get(handler))
        .with_state(pool);

    // Start server
    let listener = TcpListener::bind("127.0.0.1:3000")
        .await
        .expect("Failed to bind");

    println!("Listening on http://127.0.0.1:3000");

    if let Err(e) = axum::serve(listener, app).await {
        eprintln!("Server error: {}", e);
        std::process::exit(1);
    }
}

async fn create_pool() -> Result<SqlitePool, sqlx::Error> {
    let database_url = env::var("DATABASE_URL")
        .expect("DATABASE_URL must be set");
    SqlitePool::connect(&database_url).await
}
```

The `sqlx::migrate!` macro embeds migrations in your binary, so they deploy with your app.

### Backup Strategies

SQLite is a single file. Backup options:

1. **Copy the file**: During low-traffic periods, copy `app.db` to backup storage
2. **SQLite online backup API**: Allows backups without stopping the app
3. **Litestream**: Continuous replication to S3 (advanced)

For getting started, manual periodic copies are sufficient.

---

## Part 12: Future Migration to Cloudflare D1

Cloudflare D1 is SQLite at the edge. It uses the same SQL syntax.

### Why D1?

- Global distribution (runs at edge locations worldwide)
- Same SQLite syntax you already know
- Seamless migration path

### Migration Path

1. Develop with local SQLite (this guide)
2. Deploy to render.com with SQLite (production ready)
3. When you need global distribution, migrate to D1

The migration is straightforward because D1 uses SQLite syntax. Your queries stay the same.

### Do Not Worry About This Now

D1 is for when you need:
- Global edge deployment
- Sub-100ms latency worldwide
- Cloudflare Workers integration

Start with local SQLite. Migrate when you have the need.

---

## Summary: Your SQLite + SQLx Toolkit

### Commands to Remember

**Single-Package Project:**

```bash
# Install CLI
cargo install sqlx-cli --features sqlite

# Create .env file (one time)
echo 'DATABASE_URL=sqlite:./data/app.db' > .env

# Create database
mkdir -p data
sqlx database create

# Create migration
sqlx migrate add <name>

# Run migrations
sqlx migrate run

# Prepare for offline mode (CI/CD)
cargo sqlx prepare

# Inspect database
sqlite3 data/app.db ".tables"
sqlite3 data/app.db ".schema routes"
```

**Workspace Project:**

```bash
# Install CLI
cargo install sqlx-cli --features sqlite

# Create .env file in workspace root ONLY (one time)
# WARNING: Do NOT create a second .env in member directories
echo 'DATABASE_URL=sqlite:./data/app.db' > .env

# Create database at workspace root
mkdir -p data
sqlx database create

# Create migration (run from member directory)
cd website && sqlx migrate add <name>

# Run migrations (from member directory or with --manifest-path)
cd website && sqlx migrate run
# Or: sqlx migrate run --manifest-path website/Cargo.toml

# Prepare for offline mode (CI/CD) - from workspace root
cargo sqlx prepare --workspace

# Inspect database (from workspace root)
sqlite3 data/app.db ".tables"
sqlite3 data/app.db ".schema routes"
```

### Dependencies

```toml
[dependencies]
sqlx = { version = "0.8", features = ["runtime-tokio", "sqlite"] }
tokio = { version = "1", features = ["full"] }
dotenvy = "0.15"
```

### What You Have Learned

1. **SQLite is simple**: No server, no auth, just a file
2. **Migrations are versioned**: Schema changes are tracked and reproducible
3. **Compile-time checking**: SQL errors caught before runtime
4. **Connection pools**: Efficient database access
5. **Deployment**: SQLite works in production on render.com

You are now ready to build the CRUD pattern with SQLite. Proceed to the CRUD tutorial.

---

## Troubleshooting

### "DATABASE_URL must be set"

This error means your Rust code cannot find the `DATABASE_URL` environment variable. There are two common causes:

**1. Missing .env file:** Create a `.env` file:

```bash
# Single-package project (in project root)
echo 'DATABASE_URL=sqlite:./data/app.db' > .env

# Workspace project (in workspace root ONLY - do NOT create in member directories)
echo 'DATABASE_URL=sqlite:./data/app.db' > .env
```

**2. Missing dotenvy:** Your Rust code needs to load the `.env` file. The `sqlx-cli` tool reads `.env` automatically, but your application does not. Add `dotenvy` to your dependencies and call `dotenv().ok()` at the start of `main()`:

```rust
use dotenvy::dotenv;

#[tokio::main]
async fn main() {
    // Load .env file (if present)
    dotenv().ok();

    // Now env::var("DATABASE_URL") will work
    let pool = create_pool().await.expect("Failed to create database pool");
    // ...
}
```

> **If you have TWO .env files:** Delete the one in the member directory (e.g., `website/.env`). Keep only the one at the workspace root.

### "no such table: routes"

Run migrations:

```bash
# Single-package project
sqlx migrate run

# Workspace project (from member directory)
cd website && sqlx migrate run
```

### "database is locked"

SQLite allows only one writer at a time. If you see this:
- Make sure no other process has the database open
- In your app, use a connection pool (single pool, multiple readers)

### Compile errors about query!

The `query!` macro needs database access at compile time:

```bash
# Make sure .env file exists with DATABASE_URL
cat .env  # Should show: DATABASE_URL=sqlite:./data/app.db

# Make sure database exists and migrations are run
sqlx database create
sqlx migrate run

# Then compile
cargo build
```

### "error: no `DATABASE_URL` in env" during CI

Generate offline data locally:

```bash
# Single-package project
cargo sqlx prepare

# Workspace project
cargo sqlx prepare --workspace
```

Commit the `.sqlx/` directory. CI will use these files instead of a live database.

---

## IDE Setup: JetBrains (RustRover, IntelliJ)

JetBrains IDEs may show SQL errors like "Unable to resolve table 'routes'" in your query strings. This is because the IDE doesn't know about your SQLite database. The code compiles and runs correctly - this is purely an IDE issue.

### Connect RustRover to Your Database

1. Open **View → Tool Windows → Database**
2. Click **+** → **Data Source** → **SQLite**
3. In the **File** field, enter the full path to your database:

**Single-package project:**
```
/path/to/your-project/data/app.db
```

**Workspace project:**
```
/path/to/workspace-root/data/app.db
```

4. Click **Test Connection** to verify
5. Click **OK**

The IDE will now recognize your tables and the red squiggles will disappear.

### Alternative: Disable SQL Inspection

If you prefer not to configure the database connection:

1. Open **Settings → Editor → Inspections**
2. Search for "SQL"
3. Uncheck **SQL → Unresolved reference**
4. Click **OK**

This hides the warnings without affecting your code.
