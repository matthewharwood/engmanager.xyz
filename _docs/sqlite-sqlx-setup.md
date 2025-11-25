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

Add SQLx to your project's `Cargo.toml`:

```toml
[dependencies]
sqlx = { version = "0.8", features = ["runtime-tokio", "sqlite"] }
tokio = { version = "1", features = ["full"] }
```

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

## Part 5: Creating Your First Database

### The DATABASE_URL Environment Variable

SQLx needs to know where your database is. For SQLite, this is a file path:

```bash
export DATABASE_URL="sqlite:./data/app.db"
```

The format is: `sqlite:` followed by the file path.

### Create the Database

```bash
# Create the directory first
mkdir -p data

# Create the database
sqlx database create
```

### What Just Happened?

SQLx created:

```
data/
  app.db      # Your SQLite database file
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

SQLx expects migrations in a `migrations/` directory:

```bash
sqlx migrate add create_routes_table
```

This creates:

```
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

```bash
sqlx migrate run
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

```bash
cargo sqlx prepare
```

This creates:

```
.sqlx/
  query-a1b2c3d4e5f6.json
  query-f6e5d4c3b2a1.json
  ...
```

These files describe your queries. During compilation without a database, SQLx uses these files instead.

### Enable Offline Mode

Add to your `Cargo.toml`:

```toml
[dependencies]
sqlx = { version = "0.8", features = ["runtime-tokio", "sqlite", "offline"] }
```

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
DATABASE_URL="sqlite:./data/app.db" cargo check
```

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
use sqlx::sqlite::{SqlitePool, SqlitePoolOptions};

async fn create_pool() -> Result<SqlitePool, sqlx::Error> {
    let database_url = std::env::var("DATABASE_URL")
        .expect("DATABASE_URL must be set");

    SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await
}
```

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
use sqlx::sqlite::SqlitePool;

#[tokio::main]
async fn main() -> Result<(), sqlx::Error> {
    // Load DATABASE_URL from environment
    let database_url = std::env::var("DATABASE_URL")
        .expect("DATABASE_URL must be set");

    // Create connection pool
    let pool = SqlitePool::connect(&database_url).await?;

    // Test the connection with a simple query
    let row: (i64,) = sqlx::query_as("SELECT 1")
        .fetch_one(&pool)
        .await?;

    println!("Connection test: {}", row.0);
    assert_eq!(row.0, 1);

    // Query the routes table
    let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM routes")
        .fetch_one(&pool)
        .await?;

    println!("Routes in database: {}", count.0);

    println!("All connection tests passed!");
    Ok(())
}
```

Run:

```bash
DATABASE_URL="sqlite:./data/app.db" cargo run
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
use sqlx::{FromRow, sqlite::SqlitePool};

#[derive(Debug, Clone, FromRow)]
pub struct Route {
    pub path: String,
    pub name: String,
    pub created_at: String,
    pub updated_at: String,
}

#[tokio::main]
async fn main() -> Result<(), sqlx::Error> {
    let database_url = std::env::var("DATABASE_URL")
        .expect("DATABASE_URL must be set");

    let pool = SqlitePool::connect(&database_url).await?;

    // Insert a test route
    sqlx::query(
        "INSERT OR REPLACE INTO routes (path, name) VALUES ('/test', 'Test Route')"
    )
    .execute(&pool)
    .await?;

    // Query it back as a struct
    let route: Route = sqlx::query_as(
        "SELECT path, name, created_at, updated_at FROM routes WHERE path = '/test'"
    )
    .fetch_one(&pool)
    .await?;

    println!("Found route: {:?}", route);
    assert_eq!(route.path, "/test");
    assert_eq!(route.name, "Test Route");

    // Clean up
    sqlx::query("DELETE FROM routes WHERE path = '/test'")
        .execute(&pool)
        .await?;

    println!("FromRow test passed!");
    Ok(())
}
```

Run:

```bash
DATABASE_URL="sqlite:./data/app.db" cargo run
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
use sqlx::{FromRow, sqlite::SqlitePool};

#[derive(Debug, Clone, FromRow)]
pub struct Route {
    pub path: String,
    pub name: String,
    pub created_at: String,
    pub updated_at: String,
}

#[tokio::main]
async fn main() -> Result<(), sqlx::Error> {
    // Connect
    let pool = SqlitePool::connect("sqlite:./data/app.db").await?;

    // Create
    sqlx::query("INSERT INTO routes (path, name) VALUES ($1, $2)")
        .bind("/about")
        .bind("About Page")
        .execute(&pool)
        .await?;
    println!("Created route");

    // Read
    let route: Route = sqlx::query_as(
        "SELECT path, name, created_at, updated_at FROM routes WHERE path = $1"
    )
    .bind("/about")
    .fetch_one(&pool)
    .await?;
    println!("Read route: {:?}", route);

    // Update
    sqlx::query("UPDATE routes SET name = $1, updated_at = datetime('now') WHERE path = $2")
        .bind("About Us")
        .bind("/about")
        .execute(&pool)
        .await?;
    println!("Updated route");

    // Delete
    sqlx::query("DELETE FROM routes WHERE path = $1")
        .bind("/about")
        .execute(&pool)
        .await?;
    println!("Deleted route");

    println!("All CRUD operations successful!");
    Ok(())
}
```

### Run It

```bash
# Set up
export DATABASE_URL="sqlite:./data/app.db"
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
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let pool = SqlitePool::connect(&std::env::var("DATABASE_URL")?).await?;

    // Run migrations on startup
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await?;

    // Start your server...
    Ok(())
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

```bash
# Install CLI
cargo install sqlx-cli --features sqlite

# Create database
export DATABASE_URL="sqlite:./data/app.db"
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

### Dependencies

```toml
[dependencies]
sqlx = { version = "0.8", features = ["runtime-tokio", "sqlite"] }
tokio = { version = "1", features = ["full"] }
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

```bash
export DATABASE_URL="sqlite:./data/app.db"
```

### "no such table: routes"

Run migrations:

```bash
sqlx migrate run
```

### "database is locked"

SQLite allows only one writer at a time. If you see this:
- Make sure no other process has the database open
- In your app, use a connection pool (single pool, multiple readers)

### Compile errors about query!

The `query!` macro needs database access at compile time:

```bash
# Make sure DATABASE_URL is set
export DATABASE_URL="sqlite:./data/app.db"

# Make sure database exists and migrations are run
sqlx database create
sqlx migrate run

# Then compile
cargo build
```

### "error: no `DATABASE_URL` in env" during CI

Generate offline data locally:

```bash
cargo sqlx prepare
```

Commit the `.sqlx/` directory. CI will use these files instead of a live database.
