# Release Notes

## Version Log

### v1.0.0 - 2025-01-23

**Initial Release: Web GUI and Control API for OB-UDPST**

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
