---
description: how to restart the backend server after code changes
---

The server is managed by **PM2** (`restaurante-backend`). Plain node process kills won't work — PM2 will just restart the process.

// turbo-all
1. Restart the backend server:
```
pm2 restart restaurante-backend
```

2. Verify it came back online:
```
pm2 list
```
Look for `restaurante-backend` with status `online` and a new PID (uptime will reset to 0s).

3. Optionally, tail the logs to confirm no errors:
```
pm2 logs restaurante-backend --lines 30
```
