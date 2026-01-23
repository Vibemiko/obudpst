# OB-UDPST Web GUI - Quick Start Guide

Get up and running with the OB-UDPST Web Control Panel in minutes.

## Prerequisites

- Debian 11+ system
- Node.js 18+
- CMake and build tools
- Supabase account (database provided)

## Installation Steps

### 1. Build OB-UDPST Binary

```bash
cd /path/to/ob-udpst
cmake .
make

# Verify
./udpst -?
```

### 2. Start Backend API

```bash
cd backend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
nano .env
```

Edit `.env` with your settings:
```env
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_key
UDPST_BINARY_PATH=../udpst
```

Start the server:
```bash
npm start
```

Backend will run at: http://localhost:3000

### 3. Start Frontend

Open a new terminal:

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Frontend will run at: http://localhost:5173

## First Test

### Run Server Mode

1. Open browser to http://localhost:5173
2. Navigate to **Server** page
3. Click **Start Server**
4. Server will start on port 25000

### Run Client Test

1. Navigate to **Client Test** page
2. Configure:
   - Test Type: **Downstream**
   - Server: `localhost` (or IP of server machine)
   - Duration: `10` seconds
3. Click **Start Test**
4. Watch results appear in real-time

## What's Next?

- Review [WEB_GUI_README.md](./WEB_GUI_README.md) for complete documentation
- Check [API_SPECIFICATION.md](./API_SPECIFICATION.md) for API details
- Follow [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for production setup

## Common Issues

**Binary not found**
```bash
export UDPST_BINARY_PATH=/full/path/to/udpst
```

**Database connection failed**
- Verify Supabase credentials in `.env`
- Check network connectivity

**Port already in use**
- Change `PORT` in backend `.env`
- Kill existing process: `pkill -f "node server.js"`

## Project Structure

```
ob-udpst/
├── backend/           # Node.js API server
├── frontend/          # React web interface
├── supabase/          # Database migrations
├── udpst              # C binary (after build)
└── [C source files]   # OB-UDPST source
```

## Key Features

- **Server Control**: Start/stop OB-UDPST server instances
- **Client Tests**: Execute upstream and downstream tests
- **Real-time Monitoring**: Watch test progress live
- **Results Export**: Download JSON results
- **Test History**: Browse past test executions
- **Multiple Servers**: Test with distributed server instances
- **Multi-connection**: Utilize multiple UDP flows

## Architecture

```
React Frontend ─→ Express API ─→ OB-UDPST Binary
                       ↓
                  Supabase DB
```

- Frontend: React + Vite + Tailwind CSS
- Backend: Node.js + Express
- Database: Supabase (PostgreSQL)
- Test Engine: OB-UDPST C binary

## Default Ports

- Backend API: 3000
- Frontend Dev: 5173
- OB-UDPST Server: 25000 (UDP)
- Ephemeral ports: 32768-60999 (UDP)

## Configuration Overview

### Backend (`backend/.env`)
```env
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
PORT=3000
UDPST_BINARY_PATH=../udpst
NODE_ENV=development
```

### Frontend (via Vite proxy)
Automatically proxies `/api` requests to backend.

## Test Parameters

### Server Mode
- Control port (default: 25000)
- Interface binding (optional)
- Authentication key (optional)
- Daemon mode
- Verbose output

### Client Mode
- Test type: upstream or downstream
- Server addresses (one or more)
- Duration: 5-3600 seconds
- Connections: 1-24
- Bandwidth: Mbps requirement
- IP version: IPv4 or IPv6
- Jumbo frames: enable/disable
- Verbose output

## API Endpoints

```
POST /api/server/start       Start server
POST /api/server/stop        Stop server
GET  /api/server/status      Server status

POST /api/client/start       Start test
GET  /api/test/status/:id    Test status
GET  /api/test/results/:id   Test results
GET  /api/test/list          List tests
```

## Development vs Production

### Development
- Frontend: `npm run dev` (Vite dev server)
- Backend: `npm start` (Node.js)
- Hot reload enabled
- Debug logging

### Production
- Frontend: `npm run build` (static files)
- Backend: systemd service
- Nginx reverse proxy
- HTTPS enabled
- Security hardening

## Security Notes

For development:
- No authentication required
- Public database access (RLS policies)
- HTTP only

For production:
- Enable firewall rules
- Use HTTPS
- Configure authentication
- Restrict database access
- Run as non-root user

## Performance Tips

- Use jumbo frames when supported
- Adjust number of connections based on capacity
- Monitor system resources during tests
- Clean test history periodically
- Use SSD for better I/O

## Troubleshooting

### Backend won't start
```bash
# Check logs
npm start

# Verify config
cat .env

# Check port
netstat -tulpn | grep 3000
```

### Frontend can't connect to backend
```bash
# Verify backend is running
curl http://localhost:3000/health

# Check proxy config
cat frontend/vite.config.js
```

### Test fails immediately
- Verify server is running on specified port
- Check network connectivity
- Review firewall rules
- Test binary manually: `./udpst -d <server>`

## Resources

- [WEB_GUI_README.md](./WEB_GUI_README.md) - Complete documentation
- [API_SPECIFICATION.md](./API_SPECIFICATION.md) - REST API reference
- [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) - Production deployment
- [RELEASE_NOTE.md](./RELEASE_NOTE.md) - Version history
- [README.md](./README.md) - OB-UDPST core documentation

## Support

- Check logs for errors
- Review documentation
- Verify configuration
- Test components individually
- Use verbose mode for debugging

## Next Steps

1. Familiarize with the web interface
2. Run test campaigns
3. Export and analyze results
4. Set up production deployment
5. Configure monitoring
6. Implement backups

## Example Workflow

### Upstream Test

1. Start server on machine A:
   ```bash
   # Server page → Start Server
   ```

2. Run client from machine B:
   ```bash
   # Client page → Configure → Start Test
   Test Type: Upstream
   Server: <machine-A-IP>
   Duration: 10
   ```

3. View results when complete
4. Export JSON for analysis

### Downstream Test

1. Start server on machine A
2. Run client from machine A (loopback test):
   ```bash
   Test Type: Downstream
   Server: localhost
   ```

### Multi-connection Test

1. Configure multiple servers or connections:
   ```bash
   Servers: 192.168.1.100, 192.168.1.101
   Connections: 4
   ```

2. Observe aggregated throughput

## Getting Help

- Review error messages in GUI
- Check backend logs: `npm start` output
- Verify binary works: `./udpst -?`
- Test API: `curl http://localhost:3000/api/binary/info`
- Read documentation files
- Check Supabase dashboard for database issues

## Production Deployment

For production setup, follow these guides in order:

1. [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) - Complete deployment
2. Build OB-UDPST binary
3. Configure systemd service
4. Set up Nginx reverse proxy
5. Enable firewall rules
6. Configure monitoring
7. Implement backups
8. Security hardening

## License

BSD-3-Clause (same as OB-UDPST)
