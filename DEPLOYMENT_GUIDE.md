# OB-UDPST Web GUI - Deployment Guide

Complete step-by-step guide for deploying the OB-UDPST Web GUI and Control API on bare-metal Debian systems.

## Table of Contents

1. [System Preparation](#system-preparation)
2. [Building OB-UDPST Binary](#building-ob-udpst-binary)
3. [Backend Deployment](#backend-deployment)
4. [Frontend Deployment](#frontend-deployment)
5. [Database Configuration](#database-configuration)
6. [Process Management](#process-management)
7. [Web Server Configuration](#web-server-configuration)
8. [Security Hardening](#security-hardening)
9. [Monitoring and Logging](#monitoring-and-logging)
10. [Troubleshooting](#troubleshooting)

## System Preparation

### Prerequisites

**Operating System**: Debian 11 (Bullseye) or Debian 12 (Bookworm)

**System Requirements**:
- CPU: 2+ cores recommended
- RAM: 2GB minimum, 4GB recommended
- Disk: 10GB minimum
- Network: Static IP recommended

### Install Required Packages

```bash
sudo apt-get update
sudo apt-get upgrade -y

sudo apt-get install -y \
    build-essential \
    cmake \
    libssl-dev \
    curl \
    git \
    nginx \
    ufw
```

### Install Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

node --version
npm --version
```

## Building OB-UDPST Binary

### Clone/Copy Project

If project is not already present:

```bash
cd /opt
sudo mkdir -p ob-udpst
sudo chown $USER:$USER ob-udpst
cd ob-udpst

# Copy project files here
```

### Build Binary

```bash
cd /opt/ob-udpst

cmake .
make

# Verify build
./udpst -?
```

### Install Binary System-Wide

```bash
sudo cp udpst /usr/local/bin/
sudo chmod +x /usr/local/bin/udpst

# Verify installation
which udpst
udpst -?
```

## Backend Deployment

### Create Service User

```bash
sudo useradd -r -s /bin/bash -d /opt/ob-udpst -m udpst-api
```

### Install Backend

```bash
cd /opt/ob-udpst/backend

# Install dependencies
npm install --production

# Create environment file
sudo cp .env.example .env
sudo chown udpst-api:udpst-api .env
sudo chmod 600 .env
```

### Configure Environment

Edit `/opt/ob-udpst/backend/.env`:

```bash
sudo nano /opt/ob-udpst/backend/.env
```

Set the following:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here

PORT=3000

UDPST_BINARY_PATH=/usr/local/bin/udpst

NODE_ENV=production
```

### Test Backend

```bash
cd /opt/ob-udpst/backend
node server.js
```

Press Ctrl+C to stop after verifying it starts.

## Frontend Deployment

### Build Frontend

```bash
cd /opt/ob-udpst/frontend

# Install dependencies
npm install

# Build for production
npm run build
```

The build output is in `frontend/dist/`.

### Deploy Frontend Files

```bash
sudo mkdir -p /var/www/ob-udpst
sudo cp -r /opt/ob-udpst/frontend/dist/* /var/www/ob-udpst/
sudo chown -R www-data:www-data /var/www/ob-udpst
```

## Database Configuration

Database schema is already applied via Supabase migration. Verify tables exist:

```bash
# Check via Supabase dashboard or CLI
# Expected tables: tests, test_results, server_instances
```

### Row Level Security

The migration has already configured RLS with public access policies for development. For production, review and tighten policies:

1. Log into Supabase Dashboard
2. Navigate to Database → Policies
3. Review policies on `tests`, `test_results`, `server_instances`
4. Consider implementing authentication-based policies

## Process Management

### Create systemd Service

Create `/etc/systemd/system/udpst-api.service`:

```bash
sudo nano /etc/systemd/system/udpst-api.service
```

Content:

```ini
[Unit]
Description=OB-UDPST Control API
Documentation=https://github.com/your-repo/ob-udpst
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=udpst-api
Group=udpst-api
WorkingDirectory=/opt/ob-udpst/backend
Environment=NODE_ENV=production
EnvironmentFile=/opt/ob-udpst/backend/.env
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/ob-udpst/backend

[Install]
WantedBy=multi-user.target
```

### Enable and Start Service

```bash
sudo systemctl daemon-reload
sudo systemctl enable udpst-api
sudo systemctl start udpst-api

# Check status
sudo systemctl status udpst-api

# View logs
sudo journalctl -u udpst-api -f
```

## Web Server Configuration

### Configure Nginx

Create `/etc/nginx/sites-available/ob-udpst`:

```bash
sudo nano /etc/nginx/sites-available/ob-udpst
```

Content:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Frontend
    root /var/www/ob-udpst;
    index index.html;

    # Compression
    gzip on;
    gzip_vary on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Frontend routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Static file caching
    location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### Enable Site

```bash
sudo ln -s /etc/nginx/sites-available/ob-udpst /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Optional: HTTPS with Let's Encrypt

```bash
sudo apt-get install -y certbot python3-certbot-nginx

sudo certbot --nginx -d your-domain.com

# Auto-renewal test
sudo certbot renew --dry-run
```

## Security Hardening

### Firewall Configuration

```bash
# Enable UFW
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH (adjust port if non-standard)
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow OB-UDPST ports
sudo ufw allow 25000/udp
sudo ufw allow 32768:60999/udp

# Enable firewall
sudo ufw enable
sudo ufw status
```

### System User Permissions

```bash
# Backend should not run as root
sudo chown -R udpst-api:udpst-api /opt/ob-udpst/backend

# Restrict .env file
sudo chmod 600 /opt/ob-udpst/backend/.env
```

### OB-UDPST Authentication

For production, enable authentication:

```bash
# Generate key
openssl rand -hex 32

# Add to server configuration and clients
```

### Disable Debug/Verbose Modes

In production, set:
- `NODE_ENV=production` in backend `.env`
- Disable verbose output in OB-UDPST commands
- Review log levels

## Monitoring and Logging

### Backend Logs

```bash
# View live logs
sudo journalctl -u udpst-api -f

# View recent logs
sudo journalctl -u udpst-api -n 100

# View logs from specific time
sudo journalctl -u udpst-api --since "1 hour ago"
```

### Nginx Logs

```bash
# Access logs
sudo tail -f /var/log/nginx/access.log

# Error logs
sudo tail -f /var/log/nginx/error.log
```

### Database Monitoring

Monitor via Supabase Dashboard:
- Database size
- Query performance
- Connection pool usage
- Error rates

### System Resources

```bash
# CPU and memory
htop

# Network
nethogs

# Disk I/O
iotop

# Active processes
ps aux | grep udpst
```

### Log Rotation

Configure log rotation for backend if needed:

Create `/etc/logrotate.d/udpst-api`:

```
/var/log/udpst-api/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 udpst-api udpst-api
    sharedscripts
    postrotate
        systemctl reload udpst-api > /dev/null
    endscript
}
```

## Troubleshooting

### Backend Won't Start

**Check status**:
```bash
sudo systemctl status udpst-api
sudo journalctl -u udpst-api -n 50
```

**Common issues**:
- Missing `.env` file
- Incorrect Supabase credentials
- Port 3000 already in use
- Node.js version incompatible

**Solutions**:
```bash
# Check port
sudo netstat -tulpn | grep :3000

# Verify Node.js version
node --version

# Check file permissions
ls -la /opt/ob-udpst/backend/.env
```

### Frontend Shows Blank Page

**Check**:
- Nginx configuration
- File permissions
- Browser console for errors

**Verify**:
```bash
ls -la /var/www/ob-udpst/
sudo nginx -t
curl http://localhost/
```

### API Requests Failing

**Check**:
- Backend is running
- Nginx proxy configuration
- Firewall rules

**Test API**:
```bash
curl http://localhost:3000/api/binary/info
curl http://localhost/api/binary/info
```

### OB-UDPST Binary Not Found

**Verify**:
```bash
which udpst
ls -la /usr/local/bin/udpst

# Check backend config
cat /opt/ob-udpst/backend/.env | grep UDPST_BINARY_PATH
```

### Database Connection Errors

**Verify**:
- Supabase URL and key in `.env`
- Network connectivity to Supabase
- RLS policies

**Test**:
```bash
# Check from backend server
curl -I https://your-project.supabase.co
```

### UDP Port Issues

**Check if ports are open**:
```bash
sudo ufw status
sudo netstat -ulpn | grep udpst
```

**Test UDP connectivity**:
```bash
# From client machine
nc -u -v server-ip 25000
```

### High CPU/Memory Usage

**Identify culprit**:
```bash
top -u udpst-api
ps aux --sort=-%cpu | head -10
ps aux --sort=-%mem | head -10
```

**Common causes**:
- Multiple concurrent tests
- Memory leaks
- Zombie OB-UDPST processes

**Solutions**:
```bash
# Kill zombie processes
pkill -9 udpst

# Restart backend
sudo systemctl restart udpst-api

# Adjust test concurrency limits
```

## Health Checks

### Automated Health Check Script

Create `/opt/ob-udpst/health-check.sh`:

```bash
#!/bin/bash

echo "=== OB-UDPST Health Check ==="

echo "1. Backend service:"
systemctl is-active --quiet udpst-api && echo "   ✓ Running" || echo "   ✗ Not running"

echo "2. Backend API:"
curl -s http://localhost:3000/health > /dev/null && echo "   ✓ Responding" || echo "   ✗ Not responding"

echo "3. Nginx:"
systemctl is-active --quiet nginx && echo "   ✓ Running" || echo "   ✗ Not running"

echo "4. OB-UDPST binary:"
[ -x /usr/local/bin/udpst ] && echo "   ✓ Available" || echo "   ✗ Not found"

echo "5. Disk space:"
df -h / | tail -1 | awk '{print "   " $4 " available"}'

echo "6. Memory:"
free -h | grep Mem | awk '{print "   " $4 " available"}'
```

Make executable:
```bash
chmod +x /opt/ob-udpst/health-check.sh
```

Run periodically via cron or monitoring system.

## Backup and Recovery

### Backup Strategy

**Database**:
- Automated via Supabase (daily snapshots)
- Export critical data periodically

**Configuration**:
```bash
tar -czf /backup/ob-udpst-config-$(date +%Y%m%d).tar.gz \
    /opt/ob-udpst/backend/.env \
    /etc/nginx/sites-available/ob-udpst \
    /etc/systemd/system/udpst-api.service
```

**Application**:
```bash
tar -czf /backup/ob-udpst-app-$(date +%Y%m%d).tar.gz \
    /opt/ob-udpst/backend \
    /var/www/ob-udpst
```

### Recovery

1. Restore configuration files
2. Restore application files
3. Restart services
4. Verify database connectivity
5. Test functionality

## Maintenance

### Regular Tasks

**Daily**:
- Review logs for errors
- Check disk space
- Monitor active tests

**Weekly**:
- Review test history
- Check for security updates
- Verify backups

**Monthly**:
- Update dependencies
- Review performance metrics
- Clean old test data if needed

### Updates

**Backend/Frontend**:
```bash
cd /opt/ob-udpst
git pull  # or copy new files

cd backend
npm install --production

cd ../frontend
npm install
npm run build
sudo cp -r dist/* /var/www/ob-udpst/

sudo systemctl restart udpst-api
```

**OB-UDPST Binary**:
```bash
cd /opt/ob-udpst
make clean
cmake .
make
sudo cp udpst /usr/local/bin/
```

## Performance Tuning

### System Limits

Edit `/etc/security/limits.conf`:

```
udpst-api soft nofile 65536
udpst-api hard nofile 65536
```

### Node.js Optimization

In systemd service file:

```ini
Environment="NODE_OPTIONS=--max-old-space-size=2048"
```

### Nginx Tuning

In `/etc/nginx/nginx.conf`:

```nginx
worker_processes auto;
worker_connections 1024;
keepalive_timeout 65;
client_max_body_size 10M;
```

## Production Checklist

- [ ] OB-UDPST binary built and installed
- [ ] Backend dependencies installed
- [ ] Frontend built and deployed
- [ ] Database schema created
- [ ] Environment variables configured
- [ ] Systemd service created and enabled
- [ ] Nginx configured and running
- [ ] Firewall rules configured
- [ ] HTTPS certificate installed (optional)
- [ ] Log rotation configured
- [ ] Monitoring setup
- [ ] Backup strategy implemented
- [ ] Health checks automated
- [ ] Documentation reviewed

## Support

For issues:
- Review logs: `sudo journalctl -u udpst-api -f`
- Check API: `curl http://localhost:3000/api/binary/info`
- Test binary: `udpst -?`
- Verify database: Check Supabase dashboard

For OB-UDPST core issues, refer to the main README.md.
