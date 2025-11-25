# engmanager.xyz

A production-quality engineering management website built with Rust, Axum, and Maud.

## Tech Stack

- **Rust** - Systems programming language
- **Axum 0.8** - Async web framework
- **Maud** - Compile-time HTML templating
- **SQLite + SQLx** - Database with compile-time query checking
- **Tokio** - Async runtime

## Prerequisites

- [Rust](https://rustup.rs/) (latest stable)
- [SQLite](https://sqlite.org/) CLI
- [sqlx-cli](https://github.com/launchbadge/sqlx/tree/main/sqlx-cli)

## Getting Started

### 1. Install Rust

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### 2. Install SQLite CLI

```bash
# macOS
brew install sqlite

# Verify
sqlite3 --version
```

### 3. Install sqlx-cli

```bash
cargo install sqlx-cli --features sqlite
```

This takes a few minutes (compiling from source).

Verify:

```bash
sqlx --version
```

### 4. Set Up the Database

```bash
# Set the database URL
export DATABASE_URL="sqlite:./data/app.db"

# Create the data directory
mkdir -p data

# Create the database file
sqlx database create

# Run migrations
sqlx migrate run
```

### 5. Run the Server

```bash
cd website
cargo run
```

Visit http://127.0.0.1:3000

## Project Structure

```
engmanager.xyz/
├── website/                 # Main application
│   ├── src/
│   │   ├── main.rs         # Server setup, routes
│   │   ├── core/           # Shared types and operations
│   │   ├── features/       # Feature modules (vertical slices)
│   │   └── pages/          # Route handlers
│   └── assets/             # Static files (CSS, JS, images)
├── migrations/             # SQLx database migrations
├── data/                   # SQLite database (gitignored)
└── _docs/                  # Internal documentation
```

## Database Commands

```bash
# Create a new migration
sqlx migrate add <migration_name>

# Run pending migrations
sqlx migrate run

# Check migration status
sqlx migrate info

# Inspect database
sqlite3 data/app.db ".tables"
sqlite3 data/app.db ".schema <table_name>"
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | SQLite connection string | Required |
| `PORT` | Server port | `3000` |

## Development Tips

### Compile-Time Query Checking

SQLx verifies your SQL queries at compile time. If you change the schema:

1. Run migrations: `sqlx migrate run`
2. Rebuild: `cargo build`

### Offline Mode (CI/CD)

Generate query metadata for builds without database access:

```bash
cargo sqlx prepare
```

Commit the `.sqlx/` directory. CI will use these files instead of a live database.

### Common Issues

**"DATABASE_URL must be set"**

```bash
export DATABASE_URL="sqlite:./data/app.db"
```

**"no such table"**

```bash
sqlx migrate run
```

**"database is locked"**

SQLite allows one writer at a time. Close other connections (sqlite3 CLI, DB browsers).

## Architecture

See `_docs/ARCHITECTURE.md` for traffic flow and deployment details.

The application follows a feature-based architecture:
- **Core**: Shared types, persistence, render traits
- **Features**: Vertical slices (header, hero, admin)
- **Pages**: Route handlers that compose features
