# OB-UDPST Web GUI and Control API

Production-grade web-based orchestration layer for the OB-UDPST (Open Broadband UDP Speed Test) command-line tool.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Detailed Setup](#detailed-setup)
- [Usage Guide](#usage-guide)
- [API Documentation](#api-documentation)
- [Project Structure](#project-structure)
- [Configuration](#configuration)
- [Deployment](#deployment)

## Overview

This project provides a complete web-based control plane for OB-UDPST, enabling:

- **Web GUI**: Modern React-based interface for configuring and executing tests
- **REST API**: Node.js backend for orchestrating OB-UDPST binary execution
- **Database**: Supabase (PostgreSQL) for storing test configurations and results
- **Real-time Monitoring**: Live test status updates and progress tracking
- **Results Visualization**: Charts and metrics display with export capabilities
- **Test History**: Complete audit trail of all executed tests

### Critical Design Principles

- OB-UDPST C binary is the ONLY component generating UDP traffic
- No reimplementation of timing, packet pacing, or measurement logic
- Clean separation between orchestration layer and test execution
- Minimal overhead on test performance

## Architecture

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│                 │         │                  │         │                 │
│  React Frontend │────────▶│  Node.js Backend │────────▶│  OB-UDPST       │
│  (Vite + Tailwind)        │  (Express API)   │         │  C Binary       │
│                 │         │                  │         │                 │
└─────────────────┘         └────────┬─────────┘         └─────────────────┘
                                     │
                                     ▼
                            ┌─────────────────┐
                            │                 │
                            │    Supabase     │
                            │   (PostgreSQL)  │
                            │                 │
                            └─────────────────┘
```

### Component Responsibilities

#### Frontend (React)
- User interface for test configuration
- Real-time status monitoring
- Results visualization and export
- Test history browsing

#### Backend (Node.js)
- REST API endpoints
- Request validation
- Process management (spawn/kill OB-UDPST)
- Output parsing and storage
- Database operations

#### OB-UDPST Binary
- UDP traffic generation
- Packet pacing and timing
- Measurement algorithms
- JSON output generation

#### Database (Supabase)
- Test configurations
- Execution metadata
- Results storage
- Historical data

## Prerequisites

### System Requirements

- **Operating System**: Debian 11+ (bare-metal or VM)
- **Node.js**: v18.x or higher
- **npm**: v9.x or higher
- **CMake**: 3.x or higher (for building OB-UDPST)
- **GCC**: For compiling OB-UDPST
- **OpenSSL Development Libraries**: For OB-UDPST authentication

### Network Requirements

- Server: UDP port 25000 (default) + ephemeral ports (32768-60999)
- Backend API: TCP port 3000 (default)
- Frontend: TCP port 5173 (development) or as configured

## Quick Start

### 1. Build OB-UDPST Binary

```bash
cd /path/to/ob-udpst
cmake .
make
```

Verify the binary:
```bash
./udpst -?
```

### 2. Set Up Supabase

The database is already configured. Environment variables are available in the project.

### 3. Install and Run Backend

```bash
cd backend
npm install
```

**IMPORTANT - Environment Configuration:**

The backend requires its own `.env` file in the `backend/` directory. This file is NOT committed to Git (for security), so you must create it:

```bash
# Copy the example file
cp .env.example .env

# Edit with your Supabase credentials
nano .env
```

Configure the following variables in `backend/.env`:
```env
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
PORT=3000
UDPST_BINARY_PATH=../udpst
NODE_ENV=development
```

**Note**: The backend uses `backend/.env` (no `VITE_` prefix), while the frontend uses the root `.env` file (with `VITE_` prefix). These are separate files with different variables.

Start the backend:
```bash
npm start
```

### 4. Install and Run Frontend

```bash
cd frontend

npm install

npm run dev
```

Access the GUI at: http://localhost:5173

## Detailed Setup

### Building OB-UDPST on Debian

```bash
sudo apt-get update
sudo apt-get install -y build-essential cmake libssl-dev

cd /path/to/ob-udpst
cmake .
make

sudo cp udpst /usr/local/bin/
```

### Backend Configuration

The backend requires the following environment variables:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

PORT=3000

UDPST_BINARY_PATH=/usr/local/bin/udpst

NODE_ENV=production
```

### Frontend Configuration

The frontend proxies API requests to the backend. Update `vite.config.js` if needed:

```javascript
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
});
```

### Database Schema

The database schema is automatically created via Supabase migration. It includes:

- `tests`: Test configurations and execution metadata
- `test_results`: Parsed test results and raw JSON output
- `server_instances`: Running OB-UDPST server process tracking

## Usage Guide

### Starting a Server

1. Navigate to **Server** page
2. Configure:
   - Control port (default: 25000)
   - Interface IP (optional, leave empty for all interfaces)
   - Authentication key (optional)
   - Daemon mode (run in background)
   - Verbose output
3. Click **Start Server**

### Running a Client Test

1. Navigate to **Client Test** page
2. Select test type:
   - **Upstream**: Client to server
   - **Downstream**: Server to client
3. Configure parameters:
   - Server addresses (comma-separated for multiple)
   - Port (default: 25000)
   - Duration (5-3600 seconds)
   - Number of connections
   - Bandwidth requirement
   - IP version (IPv4/IPv6)
   - Jumbo frames (enable/disable)
4. Click **Start Test**
5. Monitor progress in real-time
6. View results when complete
7. Export results as JSON

### Viewing Test History

1. Navigate to **History** page
2. Filter by status (All, Completed, Running, Failed)
3. Click on any test to view details
4. Review metrics and raw output

## API Documentation

See [API_SPECIFICATION.md](./API_SPECIFICATION.md) for complete REST API documentation.

### Key Endpoints

```
POST   /api/server/start      - Start OB-UDPST server
POST   /api/server/stop       - Stop OB-UDPST server
GET    /api/server/status     - Get server status

POST   /api/client/start      - Start client test
GET    /api/test/status/:id   - Get test status
GET    /api/test/results/:id  - Get test results
POST   /api/test/stop/:id     - Stop running test
GET    /api/test/list         - List all tests

GET    /api/binary/info       - Get binary information
```

## Project Structure

```
.
├── backend/                    # Node.js backend
│   ├── src/
│   │   ├── api/
│   │   │   └── routes.js      # API route handlers
│   │   ├── services/
│   │   │   ├── database.js    # Supabase operations
│   │   │   └── udpst.js       # OB-UDPST process management
│   │   ├── utils/
│   │   │   └── parser.js      # JSON output parser
│   │   └── config.js          # Configuration loader
│   ├── server.js              # Express server entry point
│   ├── package.json
│   └── .env.example
│
├── frontend/                   # React frontend
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   │   ├── Button.jsx
│   │   │   ├── Card.jsx
│   │   │   ├── Input.jsx
│   │   │   ├── Select.jsx
│   │   │   └── StatusBadge.jsx
│   │   ├── pages/             # Page components
│   │   │   ├── ServerPage.jsx
│   │   │   ├── ClientPage.jsx
│   │   │   ├── HistoryPage.jsx
│   │   │   └── AboutPage.jsx
│   │   ├── services/
│   │   │   └── api.js         # API client
│   │   ├── App.jsx            # Main app component
│   │   ├── main.jsx           # Entry point
│   │   └── index.css          # Tailwind styles
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
│
├── supabase/
│   └── migrations/            # Database migrations
│
├── API_SPECIFICATION.md       # REST API documentation
├── WEB_GUI_README.md         # This file
└── [OB-UDPST C source files]
```

## Configuration

### Backend Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SUPABASE_URL` | Supabase project URL | Required |
| `SUPABASE_ANON_KEY` | Supabase anonymous key | Required |
| `PORT` | Backend API port | 3000 |
| `UDPST_BINARY_PATH` | Path to udpst binary | ./udpst |
| `NODE_ENV` | Environment mode | development |

### OB-UDPST Parameters

All OB-UDPST command-line parameters are supported via the GUI:

- Test type (upstream/downstream)
- Server addresses
- Control port
- Test duration
- Number of connections
- Bandwidth requirements
- IP version (IPv4/IPv6)
- Jumbo frames
- Authentication
- Verbose output

## Deployment

### Production Build

#### Backend

```bash
cd backend
npm install --production
NODE_ENV=production node server.js
```

#### Frontend

```bash
cd frontend
npm install
npm run build
```

Serve the `dist/` directory with a web server (nginx, Apache, etc.)

### Process Management

Use systemd or PM2 to manage the backend process:

**systemd service example** (`/etc/systemd/system/udpst-api.service`):

```ini
[Unit]
Description=OB-UDPST Control API
After=network.target

[Service]
Type=simple
User=udpst
WorkingDirectory=/opt/ob-udpst/backend
Environment=NODE_ENV=production
ExecStart=/usr/bin/node server.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable udpst-api
sudo systemctl start udpst-api
```

### Security Considerations

- Run backend and OB-UDPST processes as non-root user
- Configure firewall rules for required ports only
- Use authentication for OB-UDPST server
- Enable HTTPS for production deployments
- Restrict Supabase RLS policies for production
- Validate all user inputs

### Monitoring

- Backend logs: stdout/stderr or systemd journal
- Database: Supabase dashboard
- System resources: htop, iotop, nethogs
- OB-UDPST processes: ps, pgrep

## Troubleshooting

### Binary Not Found

**Error**: `BINARY_NOT_FOUND`

**Solution**:
```bash
which udpst
export UDPST_BINARY_PATH=/path/to/udpst
```

### Server Already Running

**Error**: `ALREADY_RUNNING`

**Solution**: Stop existing server first or check for stale processes:
```bash
pkill udpst
```

### Database Connection Failed

**Error**: `supabaseUrl is required` or `Configuration errors: SUPABASE_URL is required`

**Solution**:

This error occurs when the backend cannot find Supabase credentials. On Bolt.new, ensure that:

1. The `backend/.env` file exists (not just the root `.env`)
2. The file contains `SUPABASE_URL` and `SUPABASE_ANON_KEY` (without `VITE_` prefix)
3. The values match your Supabase project credentials

The backend looks for `.env` in its own directory (`backend/.env`), not the root directory. The root `.env` file with `VITE_*` variables is only for the frontend.

### Test Fails to Start

**Possible causes**:
- Server not running on specified port
- Network connectivity issues
- Firewall blocking UDP ports
- Invalid server address

**Debug steps**:
1. Check server status in GUI
2. Verify network connectivity: `ping <server>`
3. Check firewall: `sudo ufw status`
4. Test manually: `./udpst -d <server>`

## Version Log

For version history and changelog, see [RELEASE_NOTE.md](./RELEASE_NOTE.md).

**Current Version:** v1.0.0 (2025-01-23)

## License

This web GUI and control API are provided under the same BSD-3-Clause license as OB-UDPST.

## Support

For issues related to:
- **OB-UDPST core**: See original README.md
- **Web GUI/API**: Check API_SPECIFICATION.md and this guide
- **Supabase**: https://supabase.com/docs
