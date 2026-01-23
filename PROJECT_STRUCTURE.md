# OB-UDPST Web GUI - Project Structure

Complete overview of the project directory structure and file organization.

## Directory Tree

```
ob-udpst/
│
├── backend/                           # Node.js backend API server
│   ├── src/
│   │   ├── api/
│   │   │   └── routes.js             # Express route handlers
│   │   ├── services/
│   │   │   ├── database.js           # Supabase database operations
│   │   │   └── udpst.js              # OB-UDPST process management
│   │   ├── utils/
│   │   │   └── parser.js             # JSON output parser
│   │   └── config.js                 # Configuration loader
│   ├── .env                          # Environment variables (not in git)
│   ├── .env.example                  # Environment template
│   ├── package.json                  # Node.js dependencies
│   └── server.js                     # Express server entry point
│
├── frontend/                          # React web interface
│   ├── src/
│   │   ├── components/               # Reusable UI components
│   │   │   ├── Button.jsx           # Button component
│   │   │   ├── Card.jsx             # Card container component
│   │   │   ├── Input.jsx            # Input field component
│   │   │   ├── Select.jsx           # Select dropdown component
│   │   │   └── StatusBadge.jsx      # Status badge component
│   │   ├── pages/                   # Page components
│   │   │   ├── AboutPage.jsx        # About and info page
│   │   │   ├── ClientPage.jsx       # Client test execution page
│   │   │   ├── HistoryPage.jsx      # Test history page
│   │   │   └── ServerPage.jsx       # Server control page
│   │   ├── services/
│   │   │   └── api.js               # API client wrapper
│   │   ├── App.jsx                  # Main application component
│   │   ├── index.css                # Global styles (Tailwind)
│   │   └── main.jsx                 # React entry point
│   ├── dist/                        # Production build (generated)
│   ├── index.html                   # HTML template
│   ├── package.json                 # Frontend dependencies
│   ├── postcss.config.js            # PostCSS configuration
│   ├── tailwind.config.js           # Tailwind CSS configuration
│   └── vite.config.js               # Vite build configuration
│
├── supabase/
│   └── migrations/                  # Database migrations
│       └── [timestamp]_create_udpst_schema.sql
│
├── docs/                            # Additional documentation
│
├── tests/                           # Existing OB-UDPST tests
│   ├── ci-test.sh
│   ├── conftest.py
│   ├── docker-compose.yml
│   ├── Dockerfile
│   ├── netem_parser.py
│   ├── README.md
│   ├── requirements.txt
│   ├── setup.sh
│   ├── test_cases.yaml
│   ├── test_cases_sample.yaml
│   └── test_udpst.py
│
├── [OB-UDPST C Source Files]        # Original OB-UDPST source
│   ├── cJSON.c / cJSON.h
│   ├── udpst.c / udpst.h
│   ├── udpst_common.h
│   ├── udpst_control.c / udpst_control.h
│   ├── udpst_data.c / udpst_data.h
│   ├── udpst_protocol.h
│   ├── udpst_srates.c / udpst_srates.h
│   ├── CMakeLists.txt
│   └── config.h.cmake
│
├── [Documentation Files]
│   ├── API_SPECIFICATION.md         # REST API documentation
│   ├── DEPLOYMENT_GUIDE.md          # Production deployment guide
│   ├── PROJECT_STRUCTURE.md         # This file
│   ├── QUICKSTART.md                # Quick start guide
│   ├── README.md                    # Original OB-UDPST README
│   ├── RELEASE_NOTE.md              # Version history
│   └── WEB_GUI_README.md            # Web GUI documentation
│
├── [Configuration Files]
│   ├── .clang-format
│   ├── .dockerignore
│   ├── .env                         # Project environment (Supabase)
│   ├── .gitignore
│   └── udpst.keys                   # Authentication keys example
│
├── [Sample JSON Files]
│   ├── udpst-fjsonb-s_concise.json
│   ├── udpst-fjsonf_defaults.json
│   ├── udpst-fjsonf_server_disc.json
│   ├── udpst-fjsonf_server_down.json
│   └── udpst-fjsonf-i4-Eeno1_bi_intf.json
│
├── [Metadata Files]
│   ├── BEST_PRACTICES.md
│   ├── CHANGELOG.MD
│   ├── CONTRIBUTING.md
│   ├── LICENSE
│   └── ob-udpst_output_mapping.pdf
│
└── udpst                            # Compiled binary (after build)
```

## Component Description

### Backend (Node.js + Express)

**Purpose**: REST API server for orchestrating OB-UDPST binary execution

**Key Files**:

- `server.js`: Express application entry point
- `src/config.js`: Environment configuration management
- `src/api/routes.js`: REST endpoint definitions and handlers
- `src/services/database.js`: Supabase database operations (CRUD)
- `src/services/udpst.js`: Process spawning, monitoring, and management
- `src/utils/parser.js`: JSON output parsing and metric extraction

**Dependencies**:
- express: Web framework
- @supabase/supabase-js: Database client
- cors: Cross-origin resource sharing
- dotenv: Environment variable management

**Environment Variables**:
- SUPABASE_URL: Database connection URL
- SUPABASE_ANON_KEY: Database authentication key
- PORT: API server port
- UDPST_BINARY_PATH: Path to compiled udpst binary
- NODE_ENV: Environment mode (development/production)

### Frontend (React + Vite)

**Purpose**: Modern web interface for test configuration and monitoring

**Key Files**:

- `src/main.jsx`: React application entry point
- `src/App.jsx`: Root component with routing
- `src/pages/*.jsx`: Page-level components
- `src/components/*.jsx`: Reusable UI components
- `src/services/api.js`: Backend API client
- `vite.config.js`: Build and dev server configuration
- `tailwind.config.js`: Tailwind CSS theming

**Pages**:
- ServerPage: Server instance management
- ClientPage: Test configuration and execution
- HistoryPage: Test history and results
- AboutPage: System information and documentation

**Components**:
- Button: Styled button with variants
- Card: Container with optional title
- Input: Form input with label
- Select: Dropdown selector
- StatusBadge: Colored status indicator

**Dependencies**:
- react: UI library
- react-dom: React DOM bindings
- react-router-dom: Client-side routing
- lucide-react: Icon library
- vite: Build tool
- tailwindcss: Utility-first CSS framework

### Database (Supabase)

**Purpose**: Persistent storage for test configurations and results

**Tables**:

1. `tests`
   - Test configurations
   - Execution metadata
   - Status tracking

2. `test_results`
   - Parsed metrics (throughput, loss, latency, jitter)
   - Raw JSON output
   - Foreign key to tests

3. `server_instances`
   - Running server processes
   - Configuration
   - Status tracking

**Schema Location**: `supabase/migrations/`

### OB-UDPST Binary

**Purpose**: Core UDP speed test engine

**Source Files**:
- `udpst.c/h`: Main program and configuration
- `udpst_control.c/h`: Control protocol implementation
- `udpst_data.c/h`: Data plane operations
- `udpst_srates.c/h`: Sending rate tables
- `udpst_common.h`: Common definitions
- `udpst_protocol.h`: Protocol structures
- `cJSON.c/h`: JSON library

**Build System**: CMake

**Output**: `udpst` executable

### Documentation

**User Documentation**:
- `QUICKSTART.md`: Quick start guide
- `WEB_GUI_README.md`: Comprehensive web GUI documentation
- `API_SPECIFICATION.md`: REST API reference
- `DEPLOYMENT_GUIDE.md`: Production deployment instructions
- `RELEASE_NOTE.md`: Version history and changelog

**Developer Documentation**:
- `PROJECT_STRUCTURE.md`: This file
- `README.md`: Original OB-UDPST documentation
- `BEST_PRACTICES.md`: Development guidelines

## File Relationships

### Execution Flow

```
1. User → Frontend (React)
2. Frontend → Backend API (Express)
3. Backend → OB-UDPST Binary (spawn process)
4. Binary → stdout (JSON)
5. Backend → Parser (extract metrics)
6. Backend → Database (store results)
7. Frontend → Database (query results)
8. Frontend → User (display)
```

### Data Flow

```
Test Configuration:
Frontend → Backend → Database

Test Execution:
Backend → Binary (spawn with args)
Binary → stdout (JSON output)
Backend → Parser (extract metrics)

Results Storage:
Parser → Backend → Database

Results Display:
Frontend → Backend → Database → Frontend
```

### Authentication Flow

```
Frontend API Requests:
Headers: None (Phase 1)

Backend → Database:
Supabase client with anon key

Backend → Binary:
Command-line arguments
```

## Build Artifacts

### Development

**Backend**: `node_modules/` (ignored by git)
**Frontend**: `node_modules/`, `dist/` (ignored by git)
**Binary**: `udpst` (ignored by git)

### Production

**Backend**: Installed to `/opt/ob-udpst/backend/`
**Frontend**: Built to `dist/`, deployed to `/var/www/ob-udpst/`
**Binary**: Installed to `/usr/local/bin/udpst`

## Configuration Files

### Backend Configuration

**File**: `backend/.env`
**Format**: Environment variables
**Security**: Should be .gitignored, mode 600

### Frontend Configuration

**Build-time**: `vite.config.js`
**Runtime**: API proxy in Vite dev server
**Production**: Nginx reverse proxy

### Database Configuration

**Schema**: Supabase migrations
**Credentials**: Environment variables in backend

## API Endpoints to File Mapping

| Endpoint | Handler Location |
|----------|-----------------|
| `POST /api/server/start` | `backend/src/api/routes.js` |
| `POST /api/server/stop` | `backend/src/api/routes.js` |
| `GET /api/server/status` | `backend/src/api/routes.js` |
| `POST /api/client/start` | `backend/src/api/routes.js` |
| `GET /api/test/status/:id` | `backend/src/api/routes.js` |
| `GET /api/test/results/:id` | `backend/src/api/routes.js` |
| `POST /api/test/stop/:id` | `backend/src/api/routes.js` |
| `GET /api/test/list` | `backend/src/api/routes.js` |
| `GET /api/binary/info` | `backend/src/api/routes.js` |

## Frontend Routes to Component Mapping

| Route | Component | File |
|-------|-----------|------|
| `/` | ClientPage | `frontend/src/pages/ClientPage.jsx` |
| `/server` | ServerPage | `frontend/src/pages/ServerPage.jsx` |
| `/client` | ClientPage | `frontend/src/pages/ClientPage.jsx` |
| `/history` | HistoryPage | `frontend/src/pages/HistoryPage.jsx` |
| `/about` | AboutPage | `frontend/src/pages/AboutPage.jsx` |

## Database Tables to Service Mapping

| Table | CRUD Operations | File |
|-------|----------------|------|
| `tests` | createTest, updateTest, getTest, listTests | `backend/src/services/database.js` |
| `test_results` | saveTestResults | `backend/src/services/database.js` |
| `server_instances` | createServerInstance, updateServerInstance, getServerInstance | `backend/src/services/database.js` |

## Process Management

**Backend Process**:
- Started by: systemd (production) or npm (development)
- Managed by: systemd service file
- Logs: journalctl

**OB-UDPST Processes**:
- Started by: Backend via child_process.spawn()
- Tracked in: runningProcesses Map + database
- Logs: Captured by backend (stdout/stderr)

## Security Boundaries

**Public Access**:
- Frontend static files
- Backend API endpoints (Phase 1)
- Database (via RLS policies)

**Private/Internal**:
- Backend .env file
- Database connection strings
- OB-UDPST binary execution

## Deployment Locations

### Development

```
~/project/
├── backend/
├── frontend/
└── udpst (binary)
```

### Production

```
/opt/ob-udpst/
├── backend/
└── udpst (symlink to /usr/local/bin/udpst)

/var/www/ob-udpst/
└── [frontend build output]

/usr/local/bin/
└── udpst

/etc/systemd/system/
└── udpst-api.service

/etc/nginx/sites-available/
└── ob-udpst
```

## Version Control

**Tracked**:
- Source code
- Configuration templates (.env.example)
- Documentation
- Database migrations

**Ignored (.gitignore)**:
- node_modules/
- dist/
- .env
- udpst (binary)
- Build artifacts

## Dependencies Overview

### Backend Dependencies

```json
{
  "@supabase/supabase-js": "Database client",
  "express": "Web framework",
  "cors": "CORS middleware",
  "dotenv": "Environment loader"
}
```

### Frontend Dependencies

```json
{
  "react": "UI library",
  "react-dom": "React DOM",
  "react-router-dom": "Routing",
  "lucide-react": "Icons",
  "vite": "Build tool",
  "tailwindcss": "CSS framework"
}
```

## File Permissions

### Development

Default user permissions are sufficient.

### Production

```
/opt/ob-udpst/backend/          udpst-api:udpst-api  755
/opt/ob-udpst/backend/.env      udpst-api:udpst-api  600
/var/www/ob-udpst/              www-data:www-data    755
/usr/local/bin/udpst            root:root            755
```

## Logs and Monitoring

**Backend Logs**:
- Development: stdout
- Production: systemd journal

**Frontend Logs**:
- Browser console

**Database Logs**:
- Supabase dashboard

**OB-UDPST Logs**:
- Captured by backend (stdout/stderr)

## Environment-Specific Files

### Development Only

- `frontend/node_modules/`
- `backend/node_modules/`
- Vite dev server

### Production Only

- `frontend/dist/`
- systemd service file
- Nginx configuration
- Log rotation config
