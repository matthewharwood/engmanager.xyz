---
allowed-tools: Bash(lsof:*), Bash(xargs kill -9)
argument-hint: [port-number]
description: Kill all processes running on a specified port
---

# Kill Port $ARGUMENTS

Find and terminate all processes running on port **$ARGUMENTS**.

## Current processes on port $ARGUMENTS

!`lsof -ti:$ARGUMENTS 2>/dev/null || echo "No processes found on port $ARGUMENTS"`

## Action

Kill all processes found on port $ARGUMENTS using:

```bash
lsof -ti:$ARGUMENTS | xargs kill -9 2>/dev/null || echo "No processes to kill on port $ARGUMENTS"
```

After killing, verify the port is free.
