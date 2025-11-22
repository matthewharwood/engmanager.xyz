---
allowed-tools: Bash(lsof:*), Bash(xargs kill -9)
description: Kill all processes running on port 3000
---

# Kill Port 3000

Find and terminate all processes running on port 3000.

## Current processes on port 3000

!`lsof -ti:3000 2>/dev/null || echo "No processes found on port 3000"`

## Action

Kill all processes found on port 3000 using:

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null || echo "No processes to kill"
```

After killing, verify the port is free.
