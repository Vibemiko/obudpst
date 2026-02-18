# DOCUMENTATION MAP — OB-UDPST Web GUI

> **Purpose:** Single reference that maps every file in the codebase to its role,
> exported symbols, API contract, and data-flow relationships.
> Keep this file in sync when adding, renaming, or removing files.

---

## Table of Contents

1. [Repository Layout](#1-repository-layout)
2. [Environment Variables](#2-environment-variables)
3. [Database Schema](#3-database-schema)
4. [Backend](#4-backend)
   - [Entry Point](#41-entry-point--backendserverjs)
   - [Configuration](#42-configuration--backendsrcconfigjs)
   - [API Routes](#43-api-routes--backendsrcapiroutesjs)
   - [Service: UDPST](#44-service-udpst--backendsrcservicesudpstjs)
   - [Service: Database](#45-service-database--backendsrcservicesdatabasejs)
   - [Utility: Logger](#46-utility-logger--backendsrcutilsloggerjs)
   - [Utility: Parser](#47-utility-parser--backendsrcutilsparserjs)
5. [Frontend](#5-frontend)
   - [Entry & Router](#51-entry--router--frontendsrcappjsx)
   - [API Client](#52-api-client--frontendservicesapijs)
   - [Pages](#53-pages)
   - [Components](#54-reusable-components)
6. [Infrastructure](#6-infrastructure)
   - [Docker Compose](#61-docker-compose--docker-composeyml)
   - [Backend Dockerfile](#62-backend-dockerfile--backenddockerfile)
   - [Frontend Dockerfile](#63-frontend-dockerfile--frontenddockerfile)
   - [Nginx Config](#64-nginx-config--frontendnginxconf)
7. [Data-Flow Diagrams](#7-data-flow-diagrams)
8. [Error Codes Reference](#8-error-codes-reference)
9. [Test Lifecycle State Machine](#9-test-lifecycle-state-machine)

---

## 1. Repository Layout

```
project/
├── backend/                        # Node.js + Express API server
│   ├── server.js                   # Express app entry point
│   ├── package.json
│   ├── Dockerfile
│   ├── src/
│   │   ├── config.js               # Env vars, paths, machine-ID resolution
│   │   ├── api/
│   │   │   └── routes.js           # All REST route handlers
│   │   ├── services/
│   │   │   ├── udpst.js            # UDPST process orchestration
│   │   │   └── database.js         # Supabase CRUD operations
│   │   └── utils/
│   │       ├── logger.js           # Winston logger + request middleware
│   │       └── parser.js           # UDPST JSON output parser
│   └── .env.example
│
├── frontend/                       # React + Vite + Tailwind CSS SPA
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── Dockerfile
│   ├── nginx.conf
│   └── src/
│       ├── main.jsx                # React DOM mount
│       ├── App.jsx                 # Router + nav shell
│       ├── index.css               # Tailwind directives
│       ├── components/
│       │   ├── Button.jsx
│       │   ├── Card.jsx
│       │   ├── Input.jsx
│       │   ├── Select.jsx
│       │   └── StatusBadge.jsx
│       ├── pages/
│       │   ├── ServerPage.jsx
│       │   ├── ClientPage.jsx
│       │   ├── HistoryPage.jsx
│       │   └── AboutPage.jsx
│       └── services/
│           └── api.js              # Fetch-based API client
│
├── supabase/
│   └── migrations/
│       ├── 20260123232944_create_udpst_schema.sql
│       └── 20260218154311_add_machine_id_to_server_instances.sql
│
├── docker-compose.yml
├── .env                            # Runtime secrets (git-ignored)
├── .env.example
├── udpst                           # Compiled C binary (git-ignored)
├── udpst.keys                      # Optional auth key file
│
├── CMakeLists.txt                  # C source build config
├── udpst.c / udpst.h               # UDPST C source files
├── udpst_*.c / udpst_*.h
├── cJSON.c / cJSON.h
│
├── config-examples/                # Sample .env files for each deploy mode
│   ├── docker-deployment.env
│   ├── local-development.env
│   ├── network-access.env
│   └── README.md
│
└── tests/                          # Python integration test suite
    ├── test_udpst.py
    ├── conftest.py
    ├── test_cases.yaml
    └── ...
```

---

## 2. Environment Variables

### Backend (`.env` or Docker `environment:`)

| Variable             | Required | Default       | Description                                                  |
|----------------------|----------|---------------|--------------------------------------------------------------|
| `SUPABASE_URL`       | YES      | —             | Supabase project REST URL                                    |
| `SUPABASE_ANON_KEY`  | YES      | —             | Supabase anon/public key                                     |
| `HOST`               | no       | `0.0.0.0`     | Express listen address                                       |
| `PORT`               | no       | `3000`        | Express listen port                                          |
| `NODE_ENV`           | no       | `development` | `production` disables dev-only logs                          |
| `UDPST_BINARY_PATH`  | no       | `./udpst`     | Absolute or relative path to the compiled UDPST binary       |
| `MACHINE_ID`         | no       | auto-detected | Explicit machine identifier for multi-node deployments       |
| `LOG_DIR`            | no       | `./logs`      | Directory for rotating log files                             |
| `LOG_LEVEL`          | no       | `info`        | Winston level: `error` `warn` `info` `debug`                 |

Machine ID resolution order (see `backend/src/config.js:28`):
1. `MACHINE_ID` env var
2. `/sys/class/dmi/id/product_uuid` (Linux bare-metal / VMs)
3. `os.hostname()` fallback

### Frontend (build-time `VITE_*`)

| Variable                | Required | Description                                          |
|-------------------------|----------|------------------------------------------------------|
| `VITE_SUPABASE_URL`     | no       | Supabase URL (only needed if frontend calls Supabase directly) |
| `VITE_SUPABASE_ANON_KEY`| no       | Supabase anon key (same caveat)                      |
| `VITE_API_URL`          | no       | Backend base URL; empty string means same-origin proxy |

---

## 3. Database Schema

Managed via Supabase migrations in `supabase/migrations/`.

### `tests`

Stores one row per client test execution.

| Column          | Type        | Constraints          | Description                                    |
|-----------------|-------------|----------------------|------------------------------------------------|
| `id`            | uuid        | PK, default gen      | Internal row ID                                |
| `test_id`       | text        | UNIQUE NOT NULL      | Application-level ID (`test_<timestamp>`)      |
| `test_type`     | text        | NOT NULL             | `upstream` or `downstream`                     |
| `status`        | text        | default `pending`    | `pending` `running` `completed` `failed` `stopped` |
| `servers`       | text[]      |                      | Array of target server addresses               |
| `config`        | jsonb       |                      | Full params object sent to the binary          |
| `pid`           | integer     |                      | OS PID of the UDPST child process              |
| `error_message` | text        |                      | Set on failure/stop                            |
| `created_at`    | timestamptz | default `now()`      |                                                |
| `started_at`    | timestamptz |                      | When the process actually spawned              |
| `completed_at`  | timestamptz |                      | When the process exited                        |

RLS: public `SELECT`, `INSERT`, `UPDATE`, `DELETE` (see migration for exact policies).

### `test_results`

One-to-one with `tests`; stores parsed performance metrics.

| Column                | Type    | Description                              |
|-----------------------|---------|------------------------------------------|
| `id`                  | uuid    | PK                                       |
| `test_id`             | text    | FK → `tests.test_id`                     |
| `throughput_mbps`     | numeric | IP-layer capacity in Mbps                |
| `packet_loss_percent` | numeric | Loss ratio × 100                         |
| `latency_ms`          | numeric | One-way / RTT minimum delay in ms        |
| `jitter_ms`           | numeric | PDV or (max_delay − min_delay) in ms     |
| `raw_output`          | jsonb   | Full parsed JSON from the UDPST binary   |
| `created_at`          | timestamptz |                                      |

### `server_instances`

Tracks running server processes, scoped per machine.

| Column       | Type        | Description                                       |
|--------------|-------------|---------------------------------------------------|
| `id`         | uuid        | PK                                                |
| `process_id` | text        | App-level ID (`server_<timestamp>`)               |
| `pid`        | integer     | OS PID                                            |
| `status`     | text        | `running` or `stopped`                            |
| `port`       | integer     | Listening port                                    |
| `interface`  | text        | Bound interface IP                                |
| `config`     | jsonb       | Params passed to binary                           |
| `machine_id` | text        | Identifies which host owns this record (migration 2) |
| `started_at` | timestamptz |                                                   |
| `stopped_at` | timestamptz |                                                   |

Index: `(machine_id, status)` for efficient active-server lookup.

### Migration Files

| File                                                       | Purpose                                              |
|------------------------------------------------------------|------------------------------------------------------|
| `20260123232944_create_udpst_schema.sql`                   | Initial schema: all three tables, RLS, indexes       |
| `20260218154311_add_machine_id_to_server_instances.sql`    | Adds `machine_id` column + composite index           |

---

## 4. Backend

### 4.1 Entry Point — `backend/server.js`

**Responsibilities:**
- Creates Express app
- Registers middleware: `cors`, `express.json`, request logging
- Mounts `router` at `/api`
- `GET /health` → `{ status: "ok", timestamp }`
- Global error handler (500 fallback)
- Calls `validateConfig()` before `app.listen()`

**Key imports:**

| Symbol         | Source                         |
|----------------|--------------------------------|
| `router`       | `./src/api/routes.js`          |
| `config`       | `./src/config.js`              |
| `validateConfig` | `./src/config.js`            |
| `logger`       | `./src/utils/logger.js`        |
| `requestLogger`| `./src/utils/logger.js`        |

---

### 4.2 Configuration — `backend/src/config.js`

**Exports:**

| Symbol           | Type     | Description                                           |
|------------------|----------|-------------------------------------------------------|
| `config`         | object   | Resolved runtime configuration object (see below)    |
| `validateConfig` | function | Throws if required env vars are missing; warns if binary absent |

**`config` object shape:**

```js
{
  host: string,           // Express bind host
  port: number,           // Express bind port
  supabase: {
    url: string,
    anonKey: string
  },
  udpst: {
    binaryPath: string,   // Resolved absolute path to binary
    defaultPort: 25000,
    maxConcurrentTests: 10
  },
  machineId: string,      // Unique identifier for this host
  projectRoot: string,    // Absolute path two levels above config.js
  nodeEnv: string
}
```

**Internal helpers (not exported):**

| Function            | Behavior                                                     |
|---------------------|--------------------------------------------------------------|
| `resolveBinaryPath` | Resolves `UDPST_BINARY_PATH` to absolute; defaults to `<projectRoot>/udpst` |
| `resolveMachineId`  | Reads DMI UUID → hostname fallback                           |

---

### 4.3 API Routes — `backend/src/api/routes.js`

All routes are prefixed with `/api` (mounted in `server.js`).

#### Server Management

| Method | Path             | Body / Query                               | Success Response                                      | Error Codes              |
|--------|------------------|--------------------------------------------|-------------------------------------------------------|--------------------------|
| POST   | `/server/start`  | `{ port, interface, daemon, authKey, verbose }` | `{ success, processId, pid, message, config }` | `ALREADY_RUNNING`, `EXECUTION_FAILED` |
| POST   | `/server/stop`   | —                                          | `{ success, message }`                                | `NOT_RUNNING`            |
| GET    | `/server/status` | —                                          | `{ success, running, processId?, pid?, uptime?, config?, machineId }` | `INTERNAL_ERROR` |

#### Client Tests

| Method | Path                  | Body / Query                                                       | Success Response                              | Error Codes               |
|--------|-----------------------|--------------------------------------------------------------------|-----------------------------------------------|---------------------------|
| POST   | `/client/start`       | `{ testType, servers[], port, duration, connections, interface, ipVersion, jumboFrames, bandwidth, verbose, jsonOutput }` | `{ success, testId, status, message }` | `INVALID_PARAMETERS`, `EXECUTION_FAILED` |
| GET    | `/test/status/:testId`| —                                                                  | `{ success, testId, status, progress, startTime }` | `NOT_FOUND`          |
| GET    | `/test/results/:testId`| —                                                                 | `{ success, testId, status, results?, rawOutput?, completedAt, errorMessage }` | `NOT_FOUND` |
| POST   | `/test/stop/:testId`  | —                                                                  | `{ success, message }`                        | `NOT_RUNNING`             |
| GET    | `/test/list`          | `?status=&limit=50&offset=0`                                       | `{ success, tests[], total, limit, offset }`  | `INTERNAL_ERROR`          |
| DELETE | `/test/:testId`       | —                                                                  | `{ success, message }`                        | `NOT_FOUND`, `INTERNAL_ERROR` |
| DELETE | `/test`               | —                                                                  | `{ success, message }`                        | `INTERNAL_ERROR`          |

#### Binary Info

| Method | Path           | Success Response                                                  |
|--------|----------------|-------------------------------------------------------------------|
| GET    | `/binary/info` | `{ success, available, path, projectRoot, capabilities: { authentication, gso, jumboFrames } }` |

---

### 4.4 Service: UDPST — `backend/src/services/udpst.js`

Orchestrates child processes. Maintains an in-memory `Map<processId, { process, type, startTime }>`.

> **Important:** The `runningProcesses` map is in-memory. On backend restart all tracked PIDs are lost; stale `server_instances` rows may remain in `running` status until the next `stopServer` call or manual cleanup.

**Exported functions:**

| Function                         | Signature                          | Description                                                                                       |
|----------------------------------|------------------------------------|---------------------------------------------------------------------------------------------------|
| `checkBinary()`                  | `() => Promise<BinaryInfo>`        | Verifies binary exists and is executable; returns `{ available, path, projectRoot, error?, hint? }` |
| `startServer(params)`            | `(ServerParams) => Promise<{processId, pid, config}>` | Spawns UDPST in server mode; records in `server_instances`              |
| `stopServer()`                   | `() => Promise<{success}>`         | SIGTERMs the active server for `config.machineId`; updates DB record     |
| `getServerStatus()`              | `() => Promise<ServerStatus>`      | Returns `{ running, processId?, pid?, uptime?, config?, machineId }`     |
| `startClientTest(params)`        | `(ClientParams) => Promise<{testId, status}>` | Spawns UDPST in client mode; saves test record; attaches stdout/stderr handlers; sets timeout |
| `getTestStatus(testId)`          | `(string) => Promise<TestStatus>`  | Returns `{ testId, status, progress, startTime }` with computed `progress` % |
| `getTestResults(testId)`         | `(string) => Promise<TestResults>` | Returns test + parsed metrics from DB                                    |
| `stopTest(testId)`               | `(string) => Promise<{success}>`   | SIGTERMs running test process; marks DB record as `stopped`              |
| `listTests(params)`              | `(ListParams) => Promise<{tests, total}>` | Delegates directly to `db.listTests`                              |

**Binary CLI flags mapped from params:**

| Param            | Flag(s)                |
|------------------|------------------------|
| `testType=upstream` | `-u`                |
| `testType=downstream` | `-d`              |
| `port`           | `-p <port>`            |
| `connections > 1`| `-C <n>`               |
| `duration`       | `-t <sec>`             |
| `bandwidth`      | `-B <mbps>`            |
| `ipVersion=ipv4` | `-4`                   |
| `ipVersion=ipv6` | `-6`                   |
| `jumboFrames=false` | `-j`               |
| `verbose`        | `-v`                   |
| `jsonOutput`     | `-f json`              |
| `servers`        | positional args (last) |

**Server mode flags:**

| Param       | Flag    |
|-------------|---------|
| `port`      | `-p`    |
| `daemon`    | `-x`    |
| `authKey`   | `-a`    |
| `verbose`   | `-v`    |
| `interface` | positional (last) |

**Test timeout:** `(duration_seconds + 60) × 1000 ms`. Process is SIGTERMed and marked `failed` if exceeded.

---

### 4.5 Service: Database — `backend/src/services/database.js`

Wraps `@supabase/supabase-js`. Supabase client is initialized once from `config.supabase`.

**Test operations:**

| Function                        | Parameters                    | Returns                          |
|---------------------------------|-------------------------------|----------------------------------|
| `createTest(data)`              | `{ testId, testType, servers, config }` | Created row                |
| `updateTest(testId, updates)`   | `testId: string, updates: object` | Updated row              |
| `getTest(testId)`               | `testId: string`              | Row or `null`                    |
| `getTestWithResults(testId)`    | `testId: string`              | Row with `test_results[]` joined |
| `deleteTest(testId)`            | `testId: string`              | Throws if not found              |
| `deleteAllTests()`              | —                             | Deletes all rows in `tests`      |
| `listTests(params)`             | `{ status?, limit, offset }`  | `{ tests: Row[], total: number }`|

**Results operations:**

| Function              | Parameters                                           | Returns       |
|-----------------------|------------------------------------------------------|---------------|
| `saveTestResults(testId, results)` | `results: { throughput, packetLoss, latency, jitter, rawOutput }` | Created row |

**Server instance operations:**

| Function                          | Parameters                                                    | Returns               |
|-----------------------------------|---------------------------------------------------------------|-----------------------|
| `createServerInstance(data)`      | `{ processId, pid, port, interface, config, machineId }`     | Created row           |
| `updateServerInstance(processId, updates)` | `processId: string, updates: object`               | Updated row           |
| `getServerInstance(processId)`    | `processId: string`                                           | Row or `null`         |
| `getActiveServerInstance(machineId)` | `machineId: string`                                       | Row or `null` — queries `status = 'running'` filtered by `machine_id` |

---

### 4.6 Utility: Logger — `backend/src/utils/logger.js`

Built on `winston` + `winston-daily-rotate-file`.

**Exports:**

| Symbol           | Type                      | Description                                               |
|------------------|---------------------------|-----------------------------------------------------------|
| `logger`         | `winston.Logger`          | Main logger; transports: Console + rotating file          |
| `requestLogger`  | Express middleware        | Logs `METHOD PATH status duration_ms` at `info` level     |

**Transport config:**

| Transport         | Level   | Format             | Rotation / Destination                |
|-------------------|---------|--------------------|---------------------------------------|
| Console           | configurable | `colorize + simple` | stdout                           |
| DailyRotateFile   | `info`  | JSON               | `<LOG_DIR>/app-%DATE%.log`, 14d retain |
| DailyRotateFile   | `error` | JSON               | `<LOG_DIR>/error-%DATE%.log`, 30d retain |

Falls back gracefully (console only) if the log directory is unavailable.

---

### 4.7 Utility: Parser — `backend/src/utils/parser.js`

**Exports:**

| Function              | Signature                        | Description                                            |
|-----------------------|----------------------------------|--------------------------------------------------------|
| `parseUdpstOutput(raw)` | `(string) => ParsedResults`    | Extracts metrics from UDPST stdout; throws on parse failure |

**`ParsedResults` shape:**

```js
{
  throughput: number,    // Mbps — from IPLayerCapacity or AvgRate
  packetLoss: number,    // % — from LossRatio × 100 or (1 − Delivered) × 100
  latency: number,       // ms — from MinDelay or RTTMin
  jitter: number,        // ms — from PDV or (MaxDelay − MinDelay)
  rawOutput: object      // The full parsed JSON object
}
```

Field extraction priority (tries each in order, uses first truthy value):

| Metric      | Primary field          | Fallback field            |
|-------------|------------------------|---------------------------|
| Throughput  | `IPLayerCapacity`      | `AvgRate`                 |
| Packet loss | `LossRatio × 100`      | `(1 − Delivered) × 100`   |
| Latency     | `MinDelay`             | `RTTMin`                  |
| Jitter      | `PDV`                  | `MaxDelay − MinDelay`     |

---

## 5. Frontend

### 5.1 Entry & Router — `frontend/src/App.jsx`

- Wraps the app in `<BrowserRouter>`
- Renders top navigation bar with links to all four pages
- Uses `lucide-react` icons in the nav
- Route table:

| Path       | Component       |
|------------|-----------------|
| `/`        | `ServerPage`    |
| `/client`  | `ClientPage`    |
| `/history` | `HistoryPage`   |
| `/about`   | `AboutPage`     |

---

### 5.2 API Client — `frontend/src/services/api.js`

Single exported `api` object. Base URL resolved from `VITE_API_URL` (defaults to `/api`).

**`api.server`**

| Method          | HTTP              | Description                      |
|-----------------|-------------------|----------------------------------|
| `start(params)` | `POST /server/start` | Start UDPST server            |
| `stop()`        | `POST /server/stop`  | Stop running server           |
| `getStatus()`   | `GET /server/status` | Poll server running state     |

**`api.client`**

| Method          | HTTP                | Description                    |
|-----------------|---------------------|--------------------------------|
| `start(params)` | `POST /client/start`| Launch a client speed test     |

**`api.test`**

| Method              | HTTP                        | Description                          |
|---------------------|-----------------------------|--------------------------------------|
| `getStatus(testId)` | `GET /test/status/:testId`  | Poll status + progress               |
| `getResults(testId)`| `GET /test/results/:testId` | Fetch final metrics                  |
| `stop(testId)`      | `POST /test/stop/:testId`   | Cancel a running test                |
| `list(params)`      | `GET /test/list`            | Paginated list with optional filter  |
| `delete(testId)`    | `DELETE /test/:testId`      | Remove single test record            |
| `deleteAll()`       | `DELETE /test`              | Remove all test records              |

**`api.binary`**

| Method      | HTTP              | Description                     |
|-------------|-------------------|---------------------------------|
| `getInfo()` | `GET /binary/info`| Binary availability + capabilities |

All methods throw an `Error` with the server's `error` message string on non-2xx responses.

---

### 5.3 Pages

#### `frontend/src/pages/ServerPage.jsx`

**Purpose:** Start / stop the UDPST server on the current host.

| State variable    | Type     | Description                                 |
|-------------------|----------|---------------------------------------------|
| `serverStatus`    | object   | Latest `/server/status` response            |
| `config`          | object   | Form state: `{ port, interface, daemon, authKey, verbose }` |
| `loading`         | boolean  | Disables buttons during API calls           |
| `error`           | string   | Inline error banner                         |

**Polling:** `setInterval(fetchServerStatus, 3000)` — auto-refreshes on mount.

**Displayed server info:** `machineId`, PID, uptime (formatted via local `formatUptime`), port, interface.

---

#### `frontend/src/pages/ClientPage.jsx`

**Purpose:** Configure and execute a UDP speed test; show live progress and final results.

| State variable   | Type     | Description                                          |
|------------------|----------|------------------------------------------------------|
| `config`         | object   | Form state with all test params                      |
| `currentTest`    | object   | `{ testId, status, progress }` — null when idle      |
| `testResults`    | object   | Final results from `api.test.getResults`             |
| `loading`        | boolean  | Spinner during start call                            |
| `error`          | string   | Error banner                                         |

**Polling:** `setInterval(pollTestStatus, 1000)` while `currentTest.status === 'running'`.

**Export:** Creates a `Blob` from `rawOutput` JSON and triggers a download link.

**Sub-component:** `ResultItem({ icon, label, value })` — row in the results panel.

**Default form values:**

| Field         | Default         |
|---------------|-----------------|
| `testType`    | `downstream`    |
| `servers`     | `192.168.1.100` |
| `port`        | `25000`         |
| `duration`    | `10`            |
| `connections` | `1`             |
| `ipVersion`   | `ipv4`          |
| `jumboFrames` | `true`          |
| `bandwidth`   | `1000`          |
| `verbose`     | `false`         |

---

#### `frontend/src/pages/HistoryPage.jsx`

**Purpose:** Browse, inspect, and delete past test records.

| State variable        | Type     | Description                                     |
|-----------------------|----------|-------------------------------------------------|
| `tests`               | array    | List rows from `api.test.list`                  |
| `selectedTest`        | object   | Full results for the clicked row                |
| `filter`              | string   | `all` / `completed` / `running` / `failed`      |
| `deleting`            | string   | `testId` of row being deleted (shows spinner)   |
| `showClearAllConfirm` | boolean  | Shows confirmation modal                        |

**Sub-component:** `FilterButton({ active, onClick, children })` — styled tab pill.

**Re-fetches** on `filter` change via `useEffect`.

---

#### `frontend/src/pages/AboutPage.jsx`

**Purpose:** Display binary availability, capabilities, architecture info, and standards references.

| State variable | Type   | Description                            |
|----------------|--------|----------------------------------------|
| `binaryInfo`   | object | Response from `api.binary.getInfo()`   |

**Sub-component:** `CapabilityItem({ enabled, label })` — icon + label row.

---

### 5.4 Reusable Components

#### `Button.jsx`

```
Props: children, variant?, disabled?, onClick?, type?, className?
variant: 'primary' | 'secondary' | 'danger' | 'success'
```

#### `Card.jsx`

```
Props: title?, children, className?
Renders a white rounded panel with optional header.
```

#### `Input.jsx`

```
Props: label?, type?, value, onChange, placeholder?, required?, min?, max?, disabled?, className?
```

#### `Select.jsx`

```
Props: label?, value, onChange, options[{ value, label }], required?, disabled?, className?
```

#### `StatusBadge.jsx`

```
Props: status
status → color mapping:
  pending   → gray
  running   → blue
  completed → green
  failed    → red
  stopped   → yellow
```

---

## 6. Infrastructure

### 6.1 Docker Compose — `docker-compose.yml`

| Service    | Image built from     | Port mapping | Depends on            |
|------------|----------------------|--------------|-----------------------|
| `backend`  | `./backend`          | `3000:3000`  | —                     |
| `frontend` | `./frontend`         | `80:80`      | `backend` (healthy)   |

**Named volumes:** `udpst-logs` → `/var/log/udpst` inside backend container.

**Bind mounts (read-only):**
- `./udpst` → `/app/udpst`  (the compiled binary)
- `./udpst.keys` → `/app/udpst.keys`

**Network:** `obudpst-network` (bridge).

**Required `.env` vars for compose:**
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

**Health checks:**
- Backend: `node -e` HTTP GET to `/health`
- Frontend: `wget` to `http://localhost/`

---

### 6.2 Backend Dockerfile — `backend/Dockerfile`

Base: `node:20-slim` (Debian-slim).
- Copies `package*.json`, runs `npm ci --production`
- Copies source
- `EXPOSE 3000`
- `CMD ["node", "server.js"]`

---

### 6.3 Frontend Dockerfile — `frontend/Dockerfile`

Multi-stage:
1. **Build stage** (`node:20-slim`) — `npm ci && npm run build`; accepts `VITE_*` build args
2. **Serve stage** (`nginx:stable-alpine`) — copies `dist/` to nginx root; copies `nginx.conf`

`EXPOSE 80`

---

### 6.4 Nginx Config — `frontend/nginx.conf`

- Serves static files from `/usr/share/nginx/html`
- `try_files $uri $uri/ /index.html` — SPA fallback for client-side routing
- Proxies `/api/` → `http://backend:3000/api/` — same-origin API calls from the SPA

---

## 7. Data-Flow Diagrams

### Client Test — Happy Path

```
User (Browser)
  │
  ├─ POST /api/client/start  ──►  routes.js
  │                                  │
  │                                  ▼
  │                            udpst.js::startClientTest
  │                                  │
  │                            ┌─────┴──────────────────┐
  │                            │  db.createTest()        │
  │                            │  spawn(udpst binary)    │
  │                            │  db.updateTest(running) │
  │                            └─────┬──────────────────┘
  │                                  │
  │◄── { testId, status:"running" } ─┘
  │
  ├─ GET /api/test/status/:testId  (every 1s)
  │      ◄── { status, progress }
  │
  │  [process exits with code 0]
  │       │
  │       ▼ (in udpst.js exit handler)
  │   parser.js::parseUdpstOutput(stdout)
  │       │
  │       ▼
  │   db.saveTestResults()
  │   db.updateTest(completed)
  │
  ├─ GET /api/test/results/:testId
  │      ◄── { results: { throughput, packetLoss, latency, jitter } }
  │
  └─ [Display results in ClientPage]
```

### Server Start

```
User (Browser)
  │
  ├─ POST /api/server/start  ──►  routes.js
  │                                  │
  │                                  ▼
  │                          udpst.js::startServer
  │                                  │
  │                          db.getActiveServerInstance(machineId)
  │                          spawn(udpst binary -server flags)
  │                          db.createServerInstance(...)
  │                                  │
  │◄── { processId, pid, config } ───┘
  │
  └─ ServerPage polls GET /api/server/status every 3s
```

---

## 8. Error Codes Reference

All error responses follow `{ success: false, error: string, code: string }`.

| Code                | HTTP | Trigger                                            |
|---------------------|------|----------------------------------------------------|
| `ALREADY_RUNNING`   | 400  | `POST /server/start` when server already active    |
| `EXECUTION_FAILED`  | 400  | Binary spawn failure                               |
| `NOT_RUNNING`       | 400  | `POST /server/stop` or `POST /test/stop` with no active process |
| `INVALID_PARAMETERS`| 400  | Missing/invalid `testType` or `servers` array      |
| `NOT_FOUND`         | 404  | `testId` not in database                           |
| `INTERNAL_ERROR`    | 500  | Unexpected database or service error               |

---

## 9. Test Lifecycle State Machine

```
         ┌─────────┐
         │ pending │  (created on POST /client/start)
         └────┬────┘
              │ process spawns successfully
              ▼
         ┌─────────┐
         │ running │  (progress 0→100%)
         └────┬────┘
       ┌──────┼──────┐
       │      │      │
       ▼      ▼      ▼
  ┌─────────┐ ┌───────┐ ┌─────────┐
  │completed│ │failed │ │ stopped │
  └─────────┘ └───────┘ └─────────┘
       (exit 0) (exit≠0   (SIGTERM /
                 timeout   user stop)
                 parse err)
```

Terminal states: `completed`, `failed`, `stopped`.
Only `running` tests can be stopped via `POST /test/stop/:testId`.
