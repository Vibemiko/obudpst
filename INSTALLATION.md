# OB-UDPST Web GUI - Installation Guide

## Quick Start

1. **Copy and configure environment file:**
   ```bash
   cp .env.example .env
   ```

2. **Edit `.env` file with your Supabase credentials:**
   ```bash
   nano .env
   # Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
   # Set SUPABASE_URL and SUPABASE_ANON_KEY
   ```

3. **Start the application:**
   ```bash
   ./start-local.sh
   ```

The logging will be automatically configured on first run.

## Environment Configuration

### Required Settings

Edit `.env` and configure:

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

### Optional Settings

#### Network Configuration
```bash
# Backend server binding (default: 0.0.0.0)
HOST=0.0.0.0
PORT=3000

# Frontend dev server (default: 0.0.0.0)
VITE_HOST=0.0.0.0
VITE_PORT=5173
```

#### Logging Configuration
```bash
# Log directory (default: /var/log/udpst)
LOG_DIR=/var/log/udpst

# Log level: error, warn, info, debug (default: info)
LOG_LEVEL=info
```

#### UDPST Binary
```bash
# Path to UDPST binary (optional, auto-detected by default)
# UDPST_BINARY_PATH=/path/to/udpst
```

## Logging Setup

### Automatic Setup (Recommended)

When you run `start-local.sh` or `start-local-backend.sh`, the logging is configured automatically:

1. Creates `/var/log/udpst` directory
2. Sets proper permissions for current user
3. Uses sudo if needed (will prompt for password)
4. Falls back to console-only logging if directory creation fails

### Manual Setup

If automatic setup fails or you prefer manual configuration:

```bash
# Create log directory
sudo mkdir -p /var/log/udpst

# Set ownership to your user
sudo chown -R $USER:$USER /var/log/udpst

# Verify permissions
ls -ld /var/log/udpst
# Should show: drwxr-xr-x ... your-user your-group ... /var/log/udpst
```

### Docker Deployment

Logging is pre-configured in Docker:
- Logs are stored in a named volume `udpst-logs`
- Accessible via: `docker exec obudpst-backend cat /var/log/udpst/udpst-api-$(date +%Y-%m-%d).log`
- Logs persist between container restarts
- Automatically configured on container start

### Logrotate Configuration (Optional)

For system-level log rotation:

```bash
sudo cp backend/logrotate.conf /etc/logrotate.d/udpst-api
sudo chmod 644 /etc/logrotate.d/udpst-api
sudo logrotate -d /etc/logrotate.d/udpst-api  # Test configuration
```

## Installation Methods

### Method 1: Local Development (Recommended)

Perfect for development and testing on your local machine.

```bash
# 1. Copy environment file
cp .env.example .env

# 2. Edit .env with your configuration
nano .env

# 3. Start both frontend and backend
./start-local.sh
```

Access:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000
- Logs: `/var/log/udpst/`

### Method 2: Backend Only

Run only the backend API server.

```bash
# 1. Configure .env file
cp .env.example .env
nano .env

# 2. Start backend
./start-local-backend.sh
```

Access:
- Backend API: http://localhost:3000
- Logs: `/var/log/udpst/`

### Method 3: Docker Deployment

Production-ready containerized deployment.

```bash
# 1. Configure .env file
cp .env.example .env
nano .env

# 2. Build and start containers
docker-compose up -d

# 3. Check logs
docker-compose logs -f

# 4. Access application logs
docker exec obudpst-backend cat /var/log/udpst/udpst-api-$(date +%Y-%m-%d).log
```

Access:
- Frontend: http://localhost
- Backend API: http://localhost:3000
- Logs: Inside `udpst-logs` Docker volume

### Method 4: Network Testing

Access from other devices on your network.

```bash
# 1. Get your IP address
ip addr show | grep "inet " | grep -v 127.0.0.1

# 2. Configure .env
cp .env.example .env
nano .env

# Set:
# HOST=0.0.0.0
# VITE_HOST=0.0.0.0
# VITE_API_URL=http://YOUR_IP:3000

# 3. Start services
./start-local.sh
```

Access from other devices:
- Frontend: http://YOUR_IP:5173
- Backend API: http://YOUR_IP:3000

## Verifying Installation

### 1. Check Backend Status

```bash
curl http://localhost:3000/health
# Should return: {"status":"ok","timestamp":"..."}
```

### 2. Check Logs

```bash
# View today's logs
tail -f /var/log/udpst/udpst-api-$(date +%Y-%m-%d).log

# View errors only
tail -f /var/log/udpst/udpst-api-error-$(date +%Y-%m-%d).log

# Check log initialization
grep "Logger initialized" /var/log/udpst/udpst-api-*.log
```

### 3. Check UDPST Binary

The backend will check the binary on startup. Look for:
```
OB-UDPST Control API started
Binary path: /path/to/udpst
```

If binary is missing, you'll see an error in logs.

## Troubleshooting

### Logs Not Being Written

**Problem:** No log files in `/var/log/udpst`

**Solutions:**
1. Check directory permissions:
   ```bash
   ls -ld /var/log/udpst
   ```

2. Manually create directory:
   ```bash
   sudo mkdir -p /var/log/udpst
   sudo chown -R $USER:$USER /var/log/udpst
   ```

3. Check disk space:
   ```bash
   df -h /var/log
   ```

4. Verify LOG_DIR in .env:
   ```bash
   grep LOG_DIR .env
   ```

### Permission Errors

**Problem:** "Permission denied" when creating log directory

**Solutions:**
1. Run setup script manually:
   ```bash
   bash backend/setup-logging.sh
   ```

2. The script will attempt to use sudo automatically

3. Or manually set up:
   ```bash
   sudo mkdir -p /var/log/udpst
   sudo chown -R $USER:$USER /var/log/udpst
   ```

### Console-Only Logging

**Problem:** Application says "file logging: false"

This means logging is only to console (not an error). To enable file logging:

1. Ensure log directory exists and is writable
2. Restart the backend
3. Check for "file logging: true" in startup message

### Database Connection Issues

**Problem:** Application can't connect to Supabase

**Solutions:**
1. Verify Supabase credentials in .env:
   ```bash
   grep SUPABASE .env
   ```

2. Check Supabase project status in dashboard

3. Verify network connectivity:
   ```bash
   curl -I https://your-project.supabase.co
   ```

### UDPST Binary Not Found

**Problem:** Binary path errors in logs

**Solutions:**
1. Check if binary exists:
   ```bash
   ls -l ./udpst
   ```

2. Make it executable:
   ```bash
   chmod +x ./udpst
   ```

3. Specify custom path in .env:
   ```bash
   UDPST_BINARY_PATH=/full/path/to/udpst
   ```

### Port Already in Use

**Problem:** "EADDRINUSE" error

**Solutions:**
1. Check what's using the port:
   ```bash
   sudo lsof -i :3000  # For backend
   sudo lsof -i :5173  # For frontend
   ```

2. Change port in .env:
   ```bash
   PORT=3001
   VITE_PORT=5174
   ```

3. Stop conflicting service:
   ```bash
   # Find process ID from lsof, then:
   kill -9 <PID>
   ```

## Updating

To update to the latest version:

```bash
# 1. Stop services
Ctrl+C (if running)
# Or for Docker:
docker-compose down

# 2. Pull latest changes
git pull origin main

# 3. Update dependencies
cd backend && npm install && cd ..
cd frontend && npm install && cd ..

# 4. Restart services
./start-local.sh
# Or for Docker:
docker-compose up -d --build
```

## Uninstalling

### Remove Application

```bash
# Stop services
docker-compose down  # If using Docker

# Remove application files
cd ..
rm -rf ob-udpst-web-gui
```

### Remove Logs

```bash
# Remove log directory
sudo rm -rf /var/log/udpst

# Remove logrotate config (if installed)
sudo rm -f /etc/logrotate.d/udpst-api
```

### Remove Docker Resources

```bash
# Remove containers, networks, and volumes
docker-compose down -v

# Remove images
docker rmi obudpst-backend obudpst-frontend
```

## Next Steps

1. Review [LOGGING_GUIDE.md](LOGGING_GUIDE.md) for detailed logging information
2. Read [README.md](README.md) for usage instructions
3. Check [API_SPECIFICATION.md](API_SPECIFICATION.md) for API documentation
4. See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for production deployment

## Support

- Check logs in `/var/log/udpst/` for errors
- Review error log: `/var/log/udpst/udpst-api-error-$(date +%Y-%m-%d).log`
- Enable debug logging: Set `LOG_LEVEL=debug` in .env
- Check GitHub issues for known problems
