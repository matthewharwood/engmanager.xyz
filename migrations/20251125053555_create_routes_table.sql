-- Add migration script here
CREATE TABLE IF NOT EXISTS routes
(
    path       TEXT PRIMARY KEY NOT NULL,
    name       TEXT             NOT NULL,
    created_at TEXT             NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT             NOT NULL DEFAULT (datetime('now'))
);

-- Create an index for faster lookups by name
CREATE INDEX IF NOT EXISTS idx_routes_name ON ROUTES (name);
