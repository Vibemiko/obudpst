# Configuration Examples

This directory contains example configuration files for different deployment scenarios.

## Available Configurations

### 1. local-development.env
For running both frontend and backend on the same machine during development.

**Use When:**
- Developing on a single machine
- Testing without network access
- Quick local development

**Setup:**
```bash
cp config-examples/local-development.env .env
# Edit .env with your Supabase credentials
./start-local.sh
```

**Access:**
- Frontend: http://localhost:5173
- Backend: http://localhost:3000

---

### 2. network-access.env
For accessing the application from other devices on your network.

**Use When:**
- Testing on mobile devices
- Accessing from other computers on LAN
- Demonstrating to team members

**Setup:**
```bash
cp config-examples/network-access.env .env
# Edit .env:
#   1. Add your Supabase credentials
#   2. Replace YOUR_SERVER_IP with your actual IP
ip addr show  # Linux - find your IP
./start-local.sh
```

**Find Your IP:**
- Linux: `ip addr show` or `hostname -I`
- macOS: `ifconfig | grep inet`
- Windows: `ipconfig`

**Access:**
- From server: http://localhost:5173
- From network: http://YOUR_SERVER_IP:5173

**Firewall Configuration (Debian/Ubuntu):**
```bash
sudo ufw allow 3000/tcp
sudo ufw allow 5173/tcp
```

---

### 3. docker-deployment.env
For running in Docker containers with Docker Compose.

**Use When:**
- Production deployment
- Isolated environment needed
- Testing container orchestration
- Deploying to cloud/server

**Setup:**
```bash
cp config-examples/docker-deployment.env .env
# Edit .env with your Supabase credentials
./start-docker.sh
```

**Access:**
- Frontend: http://localhost
- Backend: http://localhost:3000

---

## Quick Comparison

| Feature | Local Dev | Network Access | Docker |
|---------|-----------|----------------|--------|
| Use Case | Development | Testing on LAN | Production |
| Network Access | Same machine | All devices | Isolated containers |
| Setup Complexity | Simple | Medium | Medium |
| Dependencies | Node.js | Node.js | Docker only |
| Hot Reload | Yes | Yes | No (rebuild needed) |
| Isolation | None | None | Full |

---

## Environment Variables Explained

### Required Variables
- `VITE_SUPABASE_URL`: Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anonymous key
- `SUPABASE_URL`: Same as above (for backend)
- `SUPABASE_ANON_KEY`: Same as above (for backend)

### Network Configuration
- `HOST`: Backend listening interface (0.0.0.0 or localhost)
- `PORT`: Backend port (default: 3000)
- `VITE_HOST`: Frontend listening interface
- `VITE_PORT`: Frontend port (default: 5173)

### API Connection
- `VITE_API_URL`: How frontend connects to backend
  - Empty/commented: Use Vite proxy (local development)
  - Set to IP: Direct connection (network access)
  - Empty in Docker: Nginx proxy handles it

### Binary Path
- `UDPST_BINARY_PATH`: Path to udpst binary
  - Local: `./udpst` (relative to project root)
  - Docker: `/app/udpst` (inside container)

---

## Switching Between Configurations

1. **Stop all running services** (Ctrl+C or docker-compose down)
2. **Copy desired configuration:**
   ```bash
   cp config-examples/[configuration].env .env
   ```
3. **Edit `.env`** with your specific values
4. **Start services** using appropriate script

---

## Troubleshooting

### Cannot connect from network
- Check firewall settings
- Verify HOST=0.0.0.0 in .env
- Confirm VITE_API_URL points to correct IP
- Ensure router/network allows connections

### Frontend can't reach backend
- Verify backend is running (check http://localhost:3000/health)
- Check VITE_API_URL is correctly set
- Ensure ports aren't blocked

### Docker containers won't start
- Check .env has valid Supabase credentials
- Verify Docker is installed and running
- Check udpst binary exists in project root
- Review logs: `docker-compose logs`

---

## Additional Resources

- Main Documentation: ../WEB_GUI_README.md
- Docker Documentation: https://docs.docker.com/
- Vite Documentation: https://vitejs.dev/
