# Release Notes

## Version Log

### v1.0.4 - 2026-02-19

**Install Script, Confirm Dialogs, and Database Fix**

#### Overview
This release adds a first-time `install.sh` setup script, fixes the "Clear All Records" database error caused by a UUID type mismatch, and replaces all native browser `confirm()` dialogs with styled modal dialogs for a consistent user experience.

#### Changes

**install.sh - First-Time Setup Script**
- Created `install.sh` in the project root for first-time installation
- Script is executable (`chmod +x`) and handles the full setup sequence:
  - Sets `chmod +x` on all `.sh` files in project root and `backend/`
  - Copies `.env.example` to `.env` if no `.env` exists yet
  - Detects existing `udpst` binary or attempts to build from source using `cmake` + `make`
  - Falls back gracefully with clear instructions when build tools are unavailable
  - Runs `backend/setup-logging.sh` to create log directories
  - Installs backend, frontend, and root npm dependencies
  - Prints a summary with next steps and a firewall reminder for the UDP ephemeral port range

**Database Fix - Clear All Records**
- Fixed `deleteAllTests()` in `backend/src/services/database.js`
- Root cause: `.neq('id', 0)` fails with a Postgres type error because `id` is a UUID column and cannot be compared to an integer
- Fix: replaced `.neq('id', 0)` with `.not('id', 'is', null)` on both `test_results` and `tests` tables
- "Clear All" in Test History now works correctly without errors

**Styled Confirm Dialogs**
- Replaced native browser `confirm()` popup for single-test deletion with a styled modal dialog matching the existing "Clear All" dialog
- The modal shows the test ID being deleted so the user knows exactly what will be removed
- Both dialogs (single delete and clear all) now use the same consistent design: overlay backdrop, card panel, descriptive message, Cancel / Delete action buttons
- Removed all `alert()` / `confirm()` browser API calls from `HistoryPage.jsx`

#### Fixed Issues
1. "Clear All Tests" button throwing a database error due to UUID vs integer type mismatch
2. Single test delete using a plain browser popup instead of a styled in-app dialog

---

### v1.0.3 - 2026-01-26

**Test Management and Logging Features**

#### Overview
This release adds comprehensive test history management, production-grade logging with automatic rotation, and improved error handling for failed tests.

#### Changes

**Test History Management**
- Added DELETE endpoint for individual tests: `DELETE /api/test/:testId`
- Added DELETE endpoint to clear all tests: `DELETE /api/test`
- Added delete buttons in History page UI with confirmation dialogs
- Individual test delete buttons appear on hover
- "Clear All" button with modal confirmation to prevent accidental deletion
- Automatic refresh after deletion operations

**Production Logging (Winston)**
- Installed winston and winston-daily-rotate-file for structured logging
- Logs written to `/var/log/udpst/` with automatic daily rotation
- Separate log files for general application logs and errors
- HTTP request logging with method, path, status code, duration, and IP
- Process lifecycle logging for all UDPST operations
- Configurable log level via `LOG_LEVEL` environment variable
- Console logging with colors for development
- File logging with structured JSON metadata for production
- Log retention: 14 days for application logs, 30 days for errors
- Automatic compression of rotated logs
- Created `LOGGING_GUIDE.md` with complete documentation
- Included logrotate configuration for system-level rotation

**Error Handling Improvements**
- Fixed hanging issue when tests fail with verbose output enabled
- Added timeout protection (test duration + 60 seconds)
- Better process error handling with dedicated error event handler
- Prevents duplicate exit handlers with `processExited` flag
- Captures both stdout and stderr for better error messages
- Signal handling for SIGTERM (user stop) vs other signals
- Improved error messages showing actual output from failed tests

**Database Service**
- Added `deleteTest(testId)` function to remove individual tests and results
- Added `deleteAllTests()` function to clear all test history
- Cascade deletion: removes test results before removing tests
- Proper error handling for missing tests

**Frontend API Service**
- Added `test.delete(testId)` method
- Added `test.deleteAll()` method
- Consistent error handling across all API methods

#### Fixed Critical Issues
1. Tests with verbose output hanging at 100% when server unavailable
2. No way to clean up old test records from history
3. Lack of production logging for troubleshooting
4. Process timeout not enforced causing zombie tests
5. Duplicate process.on('exit') handlers causing issues

#### Logging Features
- **Startup**: Configuration, binary validation, network binding
- **Requests**: All API calls with timing and response codes
- **Tests**: Start, completion, failure, timeout with test IDs
- **Processes**: spawn, exit codes, signals, errors
- **Database**: Operations, errors, deletions
- **Errors**: Stack traces, context, structured metadata

#### Log Files
```
/var/log/udpst/
├── udpst-api-2026-01-26.log        # General application log
├── udpst-api-error-2026-01-26.log  # Errors only
└── [older rotated logs].gz         # Compressed archived logs
```

#### Breaking Changes
None

#### Migration Notes
- **Logging is automatically configured** when starting the backend
- The start scripts (`start-local.sh`, `start-local-backend.sh`) automatically run `backend/setup-logging.sh`
- Log directory is created with proper permissions on first run
- For Docker deployments, logs are stored in a persistent volume
- All configuration is controlled via `.env` file (`LOG_DIR` and `LOG_LEVEL`)
- Review `LOGGING_GUIDE.md` for detailed logging documentation
- Review `INSTALLATION.md` for complete setup guide
- Old test records can now be deleted via UI

#### Environment Variables

New optional variables:
```bash
# Log directory (default: /var/log/udpst)
LOG_DIR=/var/log/udpst

# Log level: error, warn, info, debug (default: info)
LOG_LEVEL=info
```

#### New Files and Documentation
- `backend/src/utils/logger.js` - Winston logger configuration
- `backend/setup-logging.sh` - Automatic logging setup script
- `backend/logrotate.conf` - System logrotate configuration
- `LOGGING_GUIDE.md` - Complete logging documentation
- `INSTALLATION.md` - Comprehensive installation guide
- Updated `.env.example` with logging configuration
- Updated `docker-compose.yml` with logging volume
- Updated `Dockerfile` with log directory setup

---

### v1.0.2 - 2026-01-26

**Binary Path Resolution Fix**

#### Overview
This release fixes a critical issue where the backend could not find the UDPST binary when running from the `start-local.sh` script due to incorrect working directory path resolution.

#### Changes

**Configuration Improvements (backend/src/config.js)**
- Added proper project root detection using `__dirname` path resolution
- New `resolveBinaryPath()` function that correctly resolves both relative and absolute paths
- Relative paths now always resolved from project root, not current working directory
- Added binary existence validation at startup with helpful warning messages
- Exposed `projectRoot` in config for debugging and path resolution

**Environment Configuration (.env, .env.example)**
- Updated `.env.example` with clearer documentation about path resolution
- Changed recommendation to leave `UDPST_BINARY_PATH` commented for automatic detection
- Documented that relative paths are resolved from project root

**UDPST Service Improvements (backend/src/services/udpst.js)**
- Added `ensureBinaryExists()` pre-check before spawning processes
- Prevents cryptic ENOENT errors with clear error messages
- Enhanced `checkBinary()` function returns project root and actionable hints
- Better error handling distinguishing between "not found" and "not executable"

#### Fixed Critical Issues
1. `Error: spawn ./udpst ENOENT` when using `start-local.sh`
2. Binary path incorrectly resolved relative to `backend/` instead of project root
3. Unhelpful error messages when binary is missing

#### Breaking Changes
None

#### Migration Notes
- If you have `UDPST_BINARY_PATH=./udpst` in your `.env` file, either:
  - Comment it out (recommended) to use automatic detection
  - Change to absolute path: `UDPST_BINARY_PATH=/opt/obudpst/udpst`
  - Keep relative paths - they now resolve from project root

---

### v1.0.1 - 2026-01-26

**Documentation and Installation Improvements**

#### Overview
This release focuses on fixing critical issues in the Debian 13 installation documentation and verification script, ensuring accurate detection across bare metal, KVM/QEMU (Proxmox), and VMware environments.

#### Changes

**Installation Documentation (WEB_GUI_README.md)**
- Fixed package installation order: system utilities (curl, wget, lsb-release) now installed first before being used
- Removed incorrect `virtio-win` package that doesn't exist on Debian
- Corrected Proxmox VM guest packages: `qemu-guest-agent` and `qemu-utils` properly installed together
- Added repository clone instructions with GitHub classic token authentication example
- Reorganized Quick Start section with proper step numbering (1-5)
- Added clear instructions for creating GitHub personal access tokens

**Verification Script Improvements**
- Fixed virtualization detection: now uses `systemd-detect-virt` as primary method instead of incorrect `/sys/hypervisor/type` check
- Proper hypervisor classification: KVM/QEMU, VMware, Hyper-V, Xen, VirtualBox, and bare metal
- Conditional guest tools verification based on detected platform
- Enhanced QEMU Guest Agent validation: checks both service state and virtio device presence (`/dev/virtio-ports/org.qemu.guest_agent.0`)
- VirtIO network interface detection with clarification that "Speed: Unknown" is normal
- Tool availability checks for all commands before execution (gcc, cmake, node, npm, ethtool, etc.)
- Error and warning tracking with accurate exit codes
- Node.js version validation (warns if < v18)
- OpenSSL development libraries verification
- BBR module load verification
- Network optimization config file presence check
- Conditional status messages based on actual verification results

**Fixed Critical Issues**
1. Incorrect VM detection that reported KVM/QEMU VMs as bare metal
2. Missing curl dependency before NodeSource installation
3. Package installation errors on Proxmox VMs
4. Misleading "Setup Complete" message regardless of errors
5. Missing repository clone instructions in Quick Start

#### Breaking Changes
None

#### Migration Notes
- Users following previous installation instructions should re-run the verification script
- Proxmox VM users should uninstall any incorrectly installed packages and follow updated instructions
- The verification script now requires systemd (already standard on Debian 13)

#### Known Issues
None

### v1.0.0 - 2025-01-23

**Initial Release: Web GUI and Control API forc**

#### Overview
First production release of the web-based orchestration layer for OB-UDPST. This release provides a complete control plane with modern web interface, REST API, and database persistence.

#### New Features

**Frontend (React + Vite)**
- Modern, responsive web interface built with React and Tailwind CSS
- Server mode management page
  - Start/stop OB-UDPST server instances
  - Configure control port, interface binding, authentication
  - Real-time server status monitoring
  - Process uptime tracking
- Client test execution page
  - Upstream and downstream test configuration
  - Support for all major OB-UDPST parameters
  - Multiple server selection
  - Real-time progress monitoring
  - Results visualization (throughput, packet loss, latency, jitter)
  - JSON export functionality
- Test history page
  - Browse all executed tests
  - Filter by status (completed, running, failed)
  - View detailed test results
  - Access raw JSON output
- About page
  - Binary status and capability detection
  - Documentation and reference links
  - Architecture information

**Backend (Node.js + Express)**
- RESTful API for OB-UDPST orchestration
- Process management
  - Spawn and monitor OB-UDPST processes
  - Capture stdout/stderr
  - Handle process lifecycle
  - Clean termination on stop
- JSON output parsing
  - Extract throughput, loss, latency, jitter
  - Store raw output for analysis
  - Flexible parser supporting multiple output formats
- Database integration
  - Store test configurations
  - Track execution state
  - Persist results and metadata
  - Server instance tracking
- Error handling and validation
  - Input parameter validation
  - Meaningful error messages
  - Graceful failure handling

**Database (Supabase/PostgreSQL)**
- Complete schema for test management
  - `tests` table: Configuration and execution metadata
  - `test_results` table: Parsed metrics and raw output
  - `server_instances` table: Running server tracking
- Row Level Security (RLS) policies
- Indexes for performance
- Foreign key relationships

**API Endpoints**
- `POST /api/server/start` - Start OB-UDPST server
- `POST /api/server/stop` - Stop running server
- `GET /api/server/status` - Get server status
- `POST /api/client/start` - Execute client test
- `GET /api/test/status/:id` - Get test status
- `GET /api/test/results/:id` - Get test results
- `POST /api/test/stop/:id` - Stop running test
- `GET /api/test/list` - List all tests with filtering
- `GET /api/binary/info` - Get OB-UDPST binary information

#### Architecture

**Design Principles**
- OB-UDPST binary remains the sole UDP traffic generator
- No reimplementation of measurement logic
- Clean separation between orchestration and execution
- Minimal performance overhead

**Technology Stack**
- Frontend: React 18, Vite, Tailwind CSS, React Router
- Backend: Node.js, Express, Supabase JS Client
- Database: Supabase (PostgreSQL)
- Test Engine: OB-UDPST C binary

**Deployment Model**
- Initial target: Bare-metal Debian systems
- Backend as systemd service
- Frontend as static build
- Database as managed Supabase instance

#### Configuration

**Backend Environment Variables**
- `SUPABASE_URL` - Database connection
- `SUPABASE_ANON_KEY` - Database authentication
- `PORT` - API server port (default: 3000)
- `UDPST_BINARY_PATH` - Path to udpst binary
- `NODE_ENV` - Environment mode

**Supported OB-UDPST Parameters**
- Test type (upstream/downstream)
- Server addresses (single or multiple)
- Control port
- Test duration (5-3600 seconds)
- Number of connections (1-24)
- Bandwidth requirement
- IP version (IPv4/IPv6)
- Jumbo frames (enable/disable)
- Authentication key
- Verbose output

#### Documentation

**Included Documentation**
- `WEB_GUI_README.md` - Complete setup and usage guide
- `API_SPECIFICATION.md` - REST API reference
- `RELEASE_NOTE.md` - This file

**Documentation Coverage**
- Quick start guide
- Detailed setup instructions
- Architecture explanation
- API endpoint documentation
- Configuration reference
- Deployment guide
- Troubleshooting section

#### Testing

**Validation Performed**
- OB-UDPST binary integration
- Process spawning and management
- JSON output parsing
- Database operations
- API endpoint functionality
- Frontend component rendering

**Test Scenarios**
- Server start/stop
- Upstream test execution
- Downstream test execution
- Multiple concurrent connections
- Test history retrieval
- Results export

#### Known Limitations

**Phase 1 Constraints**
- No Docker support (bare-metal Debian only)
- No authentication on API endpoints
- No user management
- No role-based access control
- Single-tenant deployment model

**Planned for Future Releases**
- Docker containerization
- API authentication (JWT)
- Multi-tenant support
- Advanced visualization (charts, graphs)
- Real-time WebSocket updates
- Scheduled/automated tests
- Email notifications
- Comparative analysis
- Export to multiple formats (CSV, PDF)

#### Installation

**Prerequisites**
- Debian 11+
- Node.js 18+
- CMake 3.x
- GCC compiler
- OpenSSL development libraries

**Build Steps**

1. Build OB-UDPST:
```bash
cmake .
make
sudo cp udpst /usr/local/bin/
```

2. Install backend:
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your configuration
npm start
```

3. Install frontend:
```bash
cd frontend
npm install
npm run dev
```

#### Deployment

**Production Deployment**

1. Build frontend:
```bash
cd frontend
npm run build
# Serve dist/ with nginx or Apache
```

2. Run backend with systemd:
```bash
sudo systemctl enable udpst-api
sudo systemctl start udpst-api
```

3. Configure reverse proxy (optional):
```nginx
location /api {
    proxy_pass http://localhost:3000;
}
```

#### Security Notes

**Security Considerations**
- Run backend as non-root user
- Configure firewall for required ports only
- Use OB-UDPST authentication in production
- Enable HTTPS for web interface
- Review Supabase RLS policies
- Validate all user inputs

**Required Ports**
- UDP 25000 (OB-UDPST control, configurable)
- UDP 32768-60999 (ephemeral ports for data)
- TCP 3000 (backend API, configurable)
- TCP 5173 (frontend dev server)

#### Performance

**Resource Requirements**
- Backend: ~50MB RAM idle, varies with active tests
- Frontend: Static files, ~2MB gzipped
- Database: Scales with test history
- OB-UDPST: Per process requirements (see OB-UDPST docs)

**Scalability**
- Single backend supports 10 concurrent tests (configurable)
- Database handles thousands of test records
- Frontend is stateless and cacheable

#### Breaking Changes

N/A - Initial release

#### Migration Guide

N/A - Initial release

#### Contributors

Web GUI and Control API developed as orchestration layer for OB-UDPST.

Original OB-UDPST by Broadband Forum and contributors.

#### References

- Broadband Forum TR-471 Issue 4 (2024)
- ITU-T Recommendation Y.1540 (2023)
- IETF RFC 9097
- OB-UDPST project documentation
