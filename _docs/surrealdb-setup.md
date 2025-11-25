# SurrealDB Setup Guide

*A comprehensive guide for developers who have struggled with SurrealDB provisioning, installation, and authentication*

---

## Why This Guide Exists

If you have ever:

- Started SurrealDB and wondered why you cannot connect
- Been confused by "namespace", "database", and "root" authentication
- Tried to run queries and got cryptic permission errors
- Given up because the authentication system felt overwhelming

This guide is for you.

SurrealDB can be as simple as SQLite (embedded, no server) or as powerful as PostgreSQL (multi-user, authenticated). This guide starts simple and builds up.

---

## Part 1: What is SurrealDB?

### The Mental Model

SurrealDB is a **multi-model database** that can operate in multiple modes:

```
Mode 1: Embedded (like SQLite)
Your App  -->  File on Disk
                (That's it)

Mode 2: Server (like PostgreSQL)
Your App  -->  Network  -->  SurrealDB Server  -->  Files on Disk
              (WebSocket)    (Running process)       (Data storage)
```

### Key Characteristics

| Feature | Description |
|---------|-------------|
| Multi-model | Documents, graphs, key-value, and relations in one database |
| Embedded or Server | Run as a library (no server) or as a standalone server |
| SurrealQL | SQL-like query language with graph and document extensions |
| Real-time | Built-in WebSocket subscriptions |
| Authentication | Multi-layer auth system (root, namespace, database, record) |

### When to Use SurrealDB

SurrealDB is excellent for:

- Applications needing both document and relational data
- Graph-like relationships (followers, friends, connections)
- Prototyping with flexible schemas
- When you want embedding simplicity with server optionality
- Real-time applications needing live queries

### SurrealDB vs SQLite

| Feature | SQLite | SurrealDB |
|---------|--------|-----------|
| Authentication | None (file permissions) | Multi-layer system |
| Schema | Strict (required) | Schemaless or strict |
| Nested data | JSON as TEXT | Native documents |
| Relationships | Foreign keys | Native graph edges |
| Query language | Standard SQL | SurrealQL (SQL-like) |
| Embedded mode | Yes | Yes |
| Server mode | No | Yes |

---

## Part 2: Installing the SurrealDB CLI

The SurrealDB CLI is the primary tool for running the database server and executing queries.

### macOS (with Homebrew)

```bash
brew install surrealdb/tap/surreal
```

### Linux

```bash
curl -sSf https://install.surrealdb.com | sh
```

### Verify Installation

```bash
surreal version
```

Expected output:

```
surreal 2.x.x for macOS on aarch64
```

(Version numbers will vary)

### Quick Test

Start an in-memory database and run a query:

```bash
surreal sql --endpoint memory --ns test --db test --pretty
```

This opens an interactive SQL shell. Type:

```sql
SELECT 'SurrealDB is working!' AS message;
```

Expected output:

```json
[
    {
        "message": "SurrealDB is working!"
    }
]
```

Type `exit` or press Ctrl+D to quit.

If you see this, the SurrealDB CLI is installed correctly.

---

## Part 3: Installing Surrealist (GUI)

Surrealist is the official GUI for SurrealDB. Think of it like pgAdmin for PostgreSQL or DBeaver for databases in general.

### Download

Visit [surrealist.app](https://surrealist.app) and download the desktop application for your platform.

Alternatively, use the web version at [surrealist.app](https://surrealist.app) directly in your browser.

### What Surrealist Does

- Visual query editor with syntax highlighting
- Schema explorer (see tables, fields, indexes)
- Live query results
- Connection management for multiple databases
- Query history

### Connecting to a Local Instance

After starting SurrealDB (which you will do in Part 4), configure Surrealist:

1. Click "New Connection" or the + button
2. Enter connection details:
   - **Protocol**: WebSocket (ws) for local, Secure WebSocket (wss) for production
   - **Hostname**: localhost
   - **Port**: 8000 (SurrealDB default)
   - **Namespace**: your namespace (e.g., "dev")
   - **Database**: your database (e.g., "app")
   - **Authentication**: Root, Namespace, Database, or Anonymous depending on your setup
3. Click "Connect"

Do not worry about connecting yet. First, you need a running SurrealDB instance.

---

## Part 4: Running SurrealDB Locally

SurrealDB can run in several modes. Understanding these modes is crucial.

### Mode 1: Memory (for Testing)

Data exists only while the server runs. Perfect for tests.

```bash
surreal start memory --user root --pass root --allow-all
```

The server runs at `ws://localhost:8000`.

### Mode 2: File-Based (like SQLite)

Data persists to a directory. This is the embedded equivalent.

```bash
# Create data directory
mkdir -p data

# Start with file storage
surreal start file:./data/surreal.db --user root --pass root --allow-all
```

The database files are stored in `./data/surreal.db/`.

### Mode 3: Server with Authentication

For production-like environments:

```bash
surreal start file:./data/surreal.db \
  --user root \
  --pass your-secure-password \
  --bind 0.0.0.0:8000 \
  --log info
```

### Understanding the Flags

| Flag | Purpose |
|------|---------|
| `memory` or `file:./path` | Storage backend |
| `--user root` | Root username |
| `--pass <password>` | Root password |
| `--allow-all` | Disable strict mode (allows all operations) |
| `--bind <addr:port>` | Network binding (default: 0.0.0.0:8000) |
| `--log <level>` | Log verbosity (error, warn, info, debug, trace) |

### Checkpoint: Server Starts

Start the server:

```bash
surreal start memory --user root --pass root --allow-all
```

Expected output:

```
 .d8888b.                                             888 8888888b.  888888b.
d88P  Y88b                                            888 888  'Y88b 888  '88b
Y88b.                                                 888 888    888 888  .88P
 'Y888b.   888  888 888d888 888d888  .d88b.   8888b.  888 888    888 8888888K.
    'Y88b. 888  888 888P'   888P'   d8P  Y8b     '88b 888 888    888 888  'Y88b
      '888 888  888 888     888     88888888 .d888888 888 888    888 888    888
Y88b  d88P Y88b 888 888     888     Y8b.     888  888 888 888  .d88P 888   d88P
 'Y8888P'   'Y88888 888     888      'Y8888  'Y888888 888 8888888P'  8888888P'

2024-xx-xx ... Started web server on 0.0.0.0:8000
```

Leave this terminal running. Open a new terminal for the next steps.

---

## Part 5: Understanding SurrealDB's Structure

SurrealDB has a hierarchical structure that can be confusing at first. Here is the mental model:

```
Root (server level)
└── Namespace (like a schema or tenant)
    └── Database (like a database)
        └── Table (like a table)
            └── Record (like a row)
```

### Concrete Example

```
Root: Your SurrealDB server
└── Namespace: "production"
    ├── Database: "website"
    │   ├── Table: "routes"
    │   │   ├── Record: routes:homepage
    │   │   └── Record: routes:about
    │   └── Table: "content"
    └── Database: "analytics"
        └── Table: "events"
└── Namespace: "development"
    └── Database: "website"
        └── Table: "routes"
```

### Why This Structure?

1. **Multi-tenancy**: Different namespaces for different customers or environments
2. **Isolation**: Complete separation between namespaces
3. **Permissions**: Grant access at any level (root, namespace, database, table)

### For Simple Applications

If you are building a single application, use:

- One namespace (e.g., "app")
- One database (e.g., "main")
- Multiple tables as needed

Do not overthink it. This is similar to using a single PostgreSQL database with multiple tables.

---

## Part 6: Authentication Deep Dive

This is where most developers struggle. SurrealDB has multiple authentication layers.

### The Authentication Hierarchy

```
Root User
├── Can do anything on the server
├── Create/delete namespaces
└── Create namespace users

Namespace User
├── Can access one namespace
├── Create/delete databases within that namespace
└── Create database users

Database User
├── Can access one database
├── CRUD operations on tables
└── Cannot create other users

Record User (via DEFINE ACCESS)
├── For end-user authentication
├── Sign up, sign in via your app
└── Access controlled by PERMISSIONS
```

### Root Authentication

When you start with `--user root --pass root`, you have root access:

```bash
# Connect as root
surreal sql --endpoint ws://localhost:8000 --user root --pass root --ns test --db test
```

Root users can:
- Create namespaces: `DEFINE NAMESPACE production;`
- Create databases: `DEFINE DATABASE website;`
- Create other users

### Namespace Users

Create a namespace-level user:

```sql
-- As root, define a namespace user
DEFINE USER admin ON NAMESPACE PASSWORD 'admin-password' ROLES OWNER;
```

Connect as namespace user:

```bash
surreal sql --endpoint ws://localhost:8000 --user admin --pass admin-password --ns test --db test
```

### Database Users

Create a database-level user:

```sql
-- As root or namespace user
DEFINE USER app_user ON DATABASE PASSWORD 'app-password' ROLES EDITOR;
```

### Record-Level Access (for End Users)

For application users (sign up, sign in), use `DEFINE ACCESS`:

```sql
-- Define how users can sign up and sign in
DEFINE ACCESS user ON DATABASE TYPE RECORD
  SIGNUP (
    CREATE user SET
      email = $email,
      password = crypto::argon2::generate($password)
  )
  SIGNIN (
    SELECT * FROM user WHERE
      email = $email AND
      crypto::argon2::compare(password, $password)
  )
  DURATION FOR SESSION 24h
;
```

This is for building login/signup features. You do not need this for development.

### Development Setup (No Auth Complexity)

For learning and development, use the simplest setup:

```bash
surreal start memory --user root --pass root --allow-all
```

Then connect:

```bash
surreal sql --endpoint ws://localhost:8000 --user root --pass root --ns dev --db app
```

The `--allow-all` flag disables strict permission checking. This is fine for local development.

### Why Not `--allow-all` in Production?

The `--allow-all` flag:
- Allows all network origins (CORS)
- Disables some permission checks
- Is insecure for production

In production, remove `--allow-all` and properly configure:
- CORS origins
- User permissions
- Namespace/database access

---

## Part 7: Your First Queries

With the server running, open a SQL shell:

```bash
surreal sql --endpoint ws://localhost:8000 --user root --pass root --ns dev --db app --pretty
```

### Creating Tables (Implicit)

Unlike SQL databases, you do not need to CREATE TABLE first. Just insert:

```sql
CREATE routes:homepage SET name = 'Home Page', path = '/';
```

This creates:
- The `routes` table (if it does not exist)
- A record with ID `routes:homepage`
- Fields `name` and `path`

### Record IDs

SurrealDB uses a `table:id` format for record IDs:

```sql
-- Specific ID (you choose)
CREATE routes:about SET name = 'About', path = '/about';

-- Auto-generated ID (SurrealDB chooses)
CREATE routes SET name = 'Contact', path = '/contact';
-- Returns something like: routes:7b3a9f2c...
```

### Querying Records

```sql
-- Select all routes
SELECT * FROM routes;

-- Select specific record
SELECT * FROM routes:homepage;

-- Select with condition
SELECT * FROM routes WHERE path = '/about';
```

### Updating Records

```sql
-- Update specific record
UPDATE routes:homepage SET name = 'Homepage';

-- Update with condition
UPDATE routes SET updated_at = time::now() WHERE path = '/about';
```

### Deleting Records

```sql
-- Delete specific record
DELETE routes:about;

-- Delete with condition
DELETE FROM routes WHERE path = '/old';
```

### Checkpoint: CRUD Works

Run these commands in the SQL shell:

```sql
-- Create
CREATE routes:test SET name = 'Test Route', path = '/test';

-- Read
SELECT * FROM routes:test;

-- Update
UPDATE routes:test SET name = 'Updated Test';

-- Read again
SELECT * FROM routes:test;

-- Delete
DELETE routes:test;

-- Verify deleted
SELECT * FROM routes:test;
```

Expected: The final SELECT returns an empty result.

---

## Part 8: Defining Schema (Optional)

SurrealDB is schemaless by default, but you can add schema definitions for validation.

### Define a Table with Schema

```sql
DEFINE TABLE routes SCHEMAFULL;

DEFINE FIELD path ON TABLE routes TYPE string ASSERT $value != NONE;
DEFINE FIELD name ON TABLE routes TYPE string ASSERT $value != NONE;
DEFINE FIELD created_at ON TABLE routes TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at ON TABLE routes TYPE datetime DEFAULT time::now();
```

### Schemafull vs Schemaless

| Mode | Behavior |
|------|----------|
| `SCHEMALESS` (default) | Any fields allowed, no validation |
| `SCHEMAFULL` | Only defined fields allowed, type checked |

### Field Types

```sql
DEFINE FIELD name ON TABLE x TYPE string;
DEFINE FIELD count ON TABLE x TYPE int;
DEFINE FIELD price ON TABLE x TYPE float;
DEFINE FIELD active ON TABLE x TYPE bool;
DEFINE FIELD tags ON TABLE x TYPE array;
DEFINE FIELD data ON TABLE x TYPE object;
DEFINE FIELD created ON TABLE x TYPE datetime;
```

### Assertions (Validation)

```sql
-- Not empty
DEFINE FIELD path ON TABLE routes TYPE string ASSERT $value != NONE AND $value != '';

-- Pattern match
DEFINE FIELD email ON TABLE users TYPE string ASSERT string::is::email($value);

-- Range
DEFINE FIELD age ON TABLE users TYPE int ASSERT $value >= 0 AND $value <= 150;
```

### Indexes

```sql
-- Create index
DEFINE INDEX idx_routes_path ON TABLE routes FIELDS path UNIQUE;
DEFINE INDEX idx_routes_name ON TABLE routes FIELDS name;
```

---

## Part 9: Adding surrealdb Crate to Rust

Now let us connect from Rust.

### Cargo.toml Configuration

```toml
[dependencies]
surrealdb = { version = "2", features = ["kv-rocksdb"] }
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
```

### Understanding the Features

- `kv-rocksdb`: Enables embedded file-based storage (like SQLite mode)
- `kv-mem`: In-memory storage for testing
- `protocol-ws`: WebSocket client for connecting to a server

For embedded development (no server):

```toml
surrealdb = { version = "2", features = ["kv-rocksdb"] }
```

For connecting to a server:

```toml
surrealdb = { version = "2", features = ["protocol-ws"] }
```

For both:

```toml
surrealdb = { version = "2", features = ["kv-rocksdb", "protocol-ws"] }
```

### Checkpoint: SurrealDB Compiles

Create a minimal `src/main.rs`:

```rust
use surrealdb::Surreal;
use surrealdb::engine::local::Mem;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("SurrealDB crate is configured correctly!");
    Ok(())
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

If this compiles, the SurrealDB crate is configured correctly.

---

## Part 10: Your First Rust Connection

SurrealDB supports two connection modes from Rust.

### Mode 1: Embedded (No Server Needed)

This is the SQLite-equivalent experience. No server process required.

```rust
use surrealdb::Surreal;
use surrealdb::engine::local::{Db, File};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Create embedded database (file-based)
    let db: Surreal<Db> = Surreal::init();
    db.connect::<File>("./data/surreal.db").await?;

    // Use namespace and database
    db.use_ns("app").use_db("main").await?;

    println!("Connected to embedded SurrealDB!");
    Ok(())
}
```

For in-memory (tests):

```rust
use surrealdb::engine::local::Mem;

let db: Surreal<Db> = Surreal::init();
db.connect::<Mem>(()).await?;
db.use_ns("test").use_db("test").await?;
```

### Mode 2: Server Connection

Connect to a running SurrealDB server:

```rust
use surrealdb::Surreal;
use surrealdb::engine::remote::ws::{Ws, Client};
use surrealdb::opt::auth::Root;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Connect to server
    let db: Surreal<Client> = Surreal::init();
    db.connect::<Ws>("localhost:8000").await?;

    // Authenticate
    db.signin(Root {
        username: "root",
        password: "root",
    }).await?;

    // Select namespace and database
    db.use_ns("app").use_db("main").await?;

    println!("Connected to SurrealDB server!");
    Ok(())
}
```

### Checkpoint: Connection Works

Test embedded connection:

```rust
use surrealdb::Surreal;
use surrealdb::engine::local::{Db, Mem};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let db: Surreal<Db> = Surreal::init();
    db.connect::<Mem>(()).await?;
    db.use_ns("test").use_db("test").await?;

    // Test with a simple query
    let result: Vec<serde_json::Value> = db
        .query("RETURN 'Connection works!'")
        .await?
        .take(0)?;

    println!("Result: {:?}", result);
    assert!(!result.is_empty());

    println!("All connection tests passed!");
    Ok(())
}
```

Run:

```bash
cargo run
```

Expected output:

```
Result: [String("Connection works!")]
All connection tests passed!
```

---

## Part 11: Basic CRUD Operations in Rust

### Define Your Entity

```rust
use serde::{Deserialize, Serialize};
use surrealdb::sql::Thing;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Route {
    pub id: Option<Thing>,  // SurrealDB record ID
    pub path: String,
    pub name: String,
}
```

The `Thing` type is SurrealDB's record ID format (`table:id`).

### Create Records

```rust
use surrealdb::Surreal;
use surrealdb::engine::local::{Db, Mem};

// Create with auto-generated ID
let created: Option<Route> = db
    .create("routes")
    .content(Route {
        id: None,
        path: "/about".to_string(),
        name: "About Page".to_string(),
    })
    .await?;

// Create with specific ID
let created: Option<Route> = db
    .create(("routes", "homepage"))
    .content(Route {
        id: None,
        path: "/".to_string(),
        name: "Home".to_string(),
    })
    .await?;
```

### Read Records

```rust
// Get all routes
let routes: Vec<Route> = db.select("routes").await?;

// Get specific route by ID
let route: Option<Route> = db.select(("routes", "homepage")).await?;
```

### Update Records

```rust
// Update specific record
let updated: Option<Route> = db
    .update(("routes", "homepage"))
    .content(Route {
        id: None,
        path: "/".to_string(),
        name: "Homepage".to_string(),
    })
    .await?;

// Merge (partial update)
let updated: Option<Route> = db
    .update(("routes", "homepage"))
    .merge(serde_json::json!({ "name": "New Homepage" }))
    .await?;
```

### Delete Records

```rust
// Delete specific record
let deleted: Option<Route> = db.delete(("routes", "homepage")).await?;

// Delete all records in table
let deleted: Vec<Route> = db.delete("routes").await?;
```

### Using SurrealQL Queries

For complex queries, use raw SurrealQL:

```rust
// Query with parameters
let routes: Vec<Route> = db
    .query("SELECT * FROM routes WHERE path = $path")
    .bind(("path", "/about"))
    .await?
    .take(0)?;

// Multiple statements
let mut result = db
    .query("
        LET $count = (SELECT count() FROM routes GROUP ALL);
        SELECT * FROM routes ORDER BY name;
    ")
    .await?;

let count: Option<serde_json::Value> = result.take(0)?;
let routes: Vec<Route> = result.take(1)?;
```

### Checkpoint: CRUD Operations Work

```rust
use serde::{Deserialize, Serialize};
use surrealdb::Surreal;
use surrealdb::engine::local::{Db, Mem};

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Route {
    path: String,
    name: String,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let db: Surreal<Db> = Surreal::init();
    db.connect::<Mem>(()).await?;
    db.use_ns("test").use_db("test").await?;

    // Create
    let _: Option<Route> = db
        .create(("routes", "test"))
        .content(Route {
            path: "/test".to_string(),
            name: "Test".to_string(),
        })
        .await?;
    println!("Created route");

    // Read
    let route: Option<Route> = db.select(("routes", "test")).await?;
    println!("Read route: {:?}", route);
    assert!(route.is_some());

    // Update
    let _: Option<Route> = db
        .update(("routes", "test"))
        .content(Route {
            path: "/test".to_string(),
            name: "Updated Test".to_string(),
        })
        .await?;
    println!("Updated route");

    // Verify update
    let route: Option<Route> = db.select(("routes", "test")).await?;
    assert_eq!(route.unwrap().name, "Updated Test");

    // Delete
    let _: Option<Route> = db.delete(("routes", "test")).await?;
    println!("Deleted route");

    // Verify deletion
    let route: Option<Route> = db.select(("routes", "test")).await?;
    assert!(route.is_none());

    println!("All CRUD operations successful!");
    Ok(())
}
```

---

## Part 12: Connecting from Surrealist

Now that you understand both CLI and Rust connections, use Surrealist for visual exploration.

### Start SurrealDB

```bash
surreal start file:./data/surreal.db --user root --pass root --allow-all
```

### Configure Surrealist Connection

1. Open Surrealist
2. Create new connection:
   - **Protocol**: ws
   - **Hostname**: localhost
   - **Port**: 8000
   - **Username**: root
   - **Password**: root
   - **Namespace**: dev (or your namespace)
   - **Database**: app (or your database)
3. Click Connect

### Explore Your Data

- **Explorer Tab**: Browse tables and records visually
- **Query Tab**: Write and execute SurrealQL queries
- **Designer Tab**: View and modify schema definitions
- **Authentication Tab**: Manage users and access

### Useful Queries in Surrealist

```sql
-- Show all tables
INFO FOR DB;

-- Show table structure
INFO FOR TABLE routes;

-- Count records
SELECT count() FROM routes GROUP ALL;

-- Show all data
SELECT * FROM routes;
```

---

## Part 13: Production Setup for render.com

### Directory Structure

```
your-project/
├── Cargo.toml
├── src/
│   └── main.rs
├── data/           # Created at runtime on persistent disk
└── render.yaml
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

### Application Startup

```rust
use surrealdb::Surreal;
use surrealdb::engine::local::{Db, File};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let db_path = std::env::var("SURREAL_PATH")
        .unwrap_or_else(|_| "./data/surreal.db".to_string());
    let ns = std::env::var("SURREAL_NS")
        .unwrap_or_else(|_| "dev".to_string());
    let db_name = std::env::var("SURREAL_DB")
        .unwrap_or_else(|_| "app".to_string());

    let db: Surreal<Db> = Surreal::init();
    db.connect::<File>(&db_path).await?;
    db.use_ns(&ns).use_db(&db_name).await?;

    // Define schema on startup (idempotent)
    db.query("
        DEFINE TABLE IF NOT EXISTS routes SCHEMAFULL;
        DEFINE FIELD IF NOT EXISTS path ON TABLE routes TYPE string;
        DEFINE FIELD IF NOT EXISTS name ON TABLE routes TYPE string;
        DEFINE INDEX IF NOT EXISTS idx_path ON TABLE routes FIELDS path UNIQUE;
    ").await?;

    println!("Database initialized");

    // Start your server...
    Ok(())
}
```

### Key Points

1. **Persistent disk**: The SurrealDB files survive deployments
2. **Schema on startup**: Define tables/fields idempotently with `IF NOT EXISTS`
3. **No separate server**: Embedded mode means no SurrealDB process to manage

### Health Check

```rust
pub async fn health_check(db: &Surreal<Db>) -> bool {
    db.query("RETURN true").await.is_ok()
}
```

---

## Part 14: Future - Surreal Cloud

Surreal Cloud is the managed hosting service for SurrealDB.

### What is Surreal Cloud?

- Fully managed SurrealDB instances
- No server maintenance
- Automatic backups
- Global distribution

### Migration Path

1. Develop locally with embedded SurrealDB
2. Deploy to render.com with file-based SurrealDB
3. When you need scaling, migrate to Surreal Cloud

The migration is straightforward because:
- Same query language (SurrealQL)
- Same schema definitions
- Just change the connection string

### Do Not Worry About This Now

Start with embedded SurrealDB. It handles significant traffic. Move to Surreal Cloud when you need:
- Managed infrastructure
- Automatic scaling
- Global distribution

---

## Summary: Your SurrealDB Toolkit

### Commands to Remember

```bash
# Install CLI
brew install surrealdb/tap/surreal

# Start memory database (testing)
surreal start memory --user root --pass root --allow-all

# Start file database (development/production)
surreal start file:./data/surreal.db --user root --pass root --allow-all

# Connect to SQL shell
surreal sql --endpoint ws://localhost:8000 --user root --pass root --ns dev --db app --pretty

# Version check
surreal version
```

### Dependencies

```toml
# Embedded only
[dependencies]
surrealdb = { version = "2", features = ["kv-rocksdb"] }
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }

# Server connection
[dependencies]
surrealdb = { version = "2", features = ["protocol-ws"] }

# Both modes
[dependencies]
surrealdb = { version = "2", features = ["kv-rocksdb", "protocol-ws"] }
```

### What You Have Learned

1. **SurrealDB structure**: Root > Namespace > Database > Table > Record
2. **Authentication layers**: Root, namespace, database, and record-level
3. **Running locally**: Memory mode, file mode, server mode
4. **Embedded in Rust**: No server needed, just files
5. **Basic CRUD**: create, select, update, delete operations
6. **Schema definitions**: Optional but available when needed

You are now ready to build the CRUD pattern with SurrealDB. Proceed to the CRUD tutorial.

---

## Troubleshooting

### "There was a problem with the database: ..."

Usually authentication or namespace/database not set:

```rust
// Make sure you set namespace and database
db.use_ns("app").use_db("main").await?;
```

### "Table does not exist"

SurrealDB creates tables implicitly on first insert. But if you use SCHEMAFULL mode, you must define the table first:

```sql
DEFINE TABLE routes SCHEMAFULL;
```

### Connection refused

Make sure the server is running:

```bash
surreal start memory --user root --pass root --allow-all
```

### Authentication failed

Check username and password:

```rust
db.signin(Root {
    username: "root",
    password: "root",  // Must match --pass flag
}).await?;
```

### "Cannot perform operation" permission errors

You are likely missing the `--allow-all` flag in development, or you have not authenticated:

```bash
surreal start memory --user root --pass root --allow-all
```

### Embedded database locked

Only one process can access an embedded file-based database at a time. Make sure no other instance is running:

```bash
# Check for running surreal processes
ps aux | grep surreal
```
