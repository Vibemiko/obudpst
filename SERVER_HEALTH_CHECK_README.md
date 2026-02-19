# Server Health Check - Complete Documentation

## Quick Links

- **[Quick Start Guide](HEALTH_CHECK_QUICKSTART.md)** - 5-minute intro, get started fast
- **[Comprehensive Guide](SERVER_HEALTH_CHECK_GUIDE.md)** - Full documentation with examples
- **[Flow Diagrams](HEALTH_CHECK_FLOW.md)** - Visual architecture and decision trees
- **[Testing Guide](HEALTH_CHECK_TESTING.md)** - Test cases and validation procedures
- **[Implementation Details](IMPLEMENTATION_SUMMARY_v1.0.6.md)** - Technical implementation summary

## What Is This?

The Server Health Check is a pre-flight validation system that checks UDPST server connectivity before running tests. It answers two critical questions:

1. **Can I reach the server?** (Network connectivity)
2. **Is the server listening?** (Control port accessibility)

## Why Use It?

**Without Health Check:**
```
User: *clicks Start Test*
*waits 10 seconds*
Error: "Minimum required connections unavailable"
User: "What does that mean? Is the server down? Is my firewall wrong?"
*spends 30 minutes troubleshooting*
```

**With Health Check:**
```
User: *clicks Check Servers*
*waits 3 seconds*
Result: "Port 25000 is closed. Start the server with: udpst -4 -x 192.168.0.54"
User: *starts server*
User: *clicks Start Test*
*test succeeds*
```

## How It Works

### Simple Version

1. Click "Check Servers" button
2. System pings the server (network test)
3. System tries to connect to port 25000 (port test)
4. See green ✓ or red ✗ for each test
5. Get specific recommendations if anything fails

### Technical Version

```
Frontend Component
      ↓
API Request (POST /api/health/check-servers)
      ↓
Backend Service
      ├─→ ICMP Ping Test (2s timeout)
      └─→ TCP Port Test (3s timeout)
      ↓
Generate Recommendations
      ↓
Return Detailed Results
      ↓
Display in UI with Color Coding
```

## When To Use

### Always Use When:
- Running tests after server restart
- Testing a new server for the first time
- Troubleshooting failed tests
- After changing firewall rules
- After network configuration changes

### Optional But Recommended:
- Before every important test
- When documenting server setup
- When training new users

### Not Needed When:
- You just ran a successful test
- Server status is being monitored externally
- Running automated test suites (API handles it)

## Common Scenarios

### Scenario 1: New Server Setup

**Problem:** Setting up a new UDPST server, want to verify it's working.

**Solution:**
1. Start server: `udpst -4 -x 192.168.0.54`
2. Open web GUI
3. Enter IP: `192.168.0.54`
4. Click "Check Servers"
5. Verify both checks pass ✓
6. Proceed with actual test

**Time Saved:** 5-10 minutes of trial and error

---

### Scenario 2: Test Keeps Failing

**Problem:** Tests always fail with "connections unavailable" error.

**Solution:**
1. Click "Check Servers" before next test
2. Review failed checks
3. Follow the specific recommendations
4. Re-check until all pass ✓
5. Run test with confidence

**Time Saved:** 20-30 minutes of blind troubleshooting

---

### Scenario 3: Multiple Servers

**Problem:** Running tests against 5 servers, some are working, some aren't.

**Solution:**
1. Enter all 5 IPs: `192.168.0.1, 192.168.0.2, ...`
2. Click "Check Servers"
3. See exactly which servers are reachable
4. Fix the failing ones specifically
5. Re-check all
6. Run test when all pass ✓

**Time Saved:** 15-20 minutes identifying which servers have issues

---

### Scenario 4: Firewall Configuration

**Problem:** Just updated firewall rules, not sure if they're correct.

**Solution:**
1. Update firewall rules
2. Click "Check Servers"
3. If port check fails, rules are wrong
4. If port check passes, rules are correct ✓
5. Immediate validation without full test

**Time Saved:** 10-15 minutes of verification

---

## Understanding Results

### All Green ✓
```
✓ Network Ping: Host is reachable
✓ Control Port: Port is open
```
**Meaning:** Server is ready. Safe to run tests.
**Action:** Click "Start Test"

### Red Network, Red Port ✗
```
✗ Network Ping: Host not reachable
✗ Control Port: Port closed
```
**Meaning:** Can't reach server at all.
**Action:** Check IP address, verify server is on, test with `ping`

### Green Network, Red Port ✗
```
✓ Network Ping: Host is reachable
✗ Control Port: Port closed
```
**Meaning:** Network is OK, but server isn't running or port is blocked.
**Action:** Start server or open firewall port

## Quick Commands

### Start UDPST Server
```bash
# IPv4
/opt/obudpst/udpst -4 -x 192.168.0.54

# IPv6
/opt/obudpst/udpst -6 -x 2001:db8::1

# Non-standard port
/opt/obudpst/udpst -4 -p 30000 -x 192.168.0.54
```

### Allow Firewall (Ubuntu/Debian)
```bash
# Control port
sudo ufw allow 25000/tcp
sudo ufw allow 25000/udp

# UDP data ports (for actual tests)
sudo ufw allow 32768:60999/udp

# Check status
sudo ufw status
```

### Allow Firewall (RHEL/CentOS)
```bash
# Control port
sudo firewall-cmd --add-port=25000/tcp --permanent
sudo firewall-cmd --add-port=25000/udp --permanent

# UDP data ports
sudo firewall-cmd --add-port=32768-60999/udp --permanent

# Reload
sudo firewall-cmd --reload
```

### Verify Server Is Running
```bash
# Check process
ps aux | grep udpst

# Check port
netstat -tulpn | grep 25000
# or
ss -tulpn | grep 25000
```

### Test Network Connectivity
```bash
# Ping test
ping -c 3 192.168.0.54

# Port test
nc -vz 192.168.0.54 25000
# or
telnet 192.168.0.54 25000
```

## API Examples

### Check Single Server
```bash
curl -X POST http://localhost:3001/api/health/check-server \
  -H "Content-Type: application/json" \
  -d '{"host": "192.168.0.54", "port": 25000}'
```

### Check Multiple Servers
```bash
curl -X POST http://localhost:3001/api/health/check-servers \
  -H "Content-Type: application/json" \
  -d '{"servers": ["192.168.0.54", "192.168.0.55"], "port": 25000}'
```

### JavaScript/Node.js
```javascript
const response = await fetch('/api/health/check-server', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    host: '192.168.0.54',
    port: 25000
  })
});

const result = await response.json();
console.log(result.reachable ? 'Server OK' : 'Server issues');
```

## Limitations

### What It Tests ✓
- Network connectivity (ICMP ping)
- Control port accessibility (TCP port 25000)
- Basic server reachability

### What It Doesn't Test ✗
- UDP data ports (32768-60999) - tested during actual UDPST execution
- Authentication keys - tested during actual test
- Server capacity/load - tested during actual test
- Server performance - tested during actual test

**Important:** A passing health check means the server is **reachable and listening**. It does NOT guarantee the test will succeed (UDP ports, auth, capacity can still cause failures).

## Troubleshooting

### Health Check Times Out
- Increase timeout in `backend/src/services/health-check.js`
- Check for high network latency: `ping -c 10 192.168.0.54`
- Verify no packet loss

### Health Check Passes But Test Fails
- Check UDP data ports: `sudo ufw allow 32768:60999/udp`
- Verify authentication keys match
- Check server logs for capacity issues

### Can't Ping But Port Check Passes
- Server might block ICMP (ping) packets
- Health check will still work if port test passes
- Consider server firewall allows TCP but blocks ICMP

## Performance

- **Single Server:** 2-5 seconds
- **Multiple Servers:** 2-5 seconds (parallel execution)
- **Network Timeout:** 2 seconds
- **Port Timeout:** 3 seconds

## Files Reference

### Backend
- `backend/src/services/health-check.js` - Core validation logic
- `backend/src/api/routes.js` - API endpoints

### Frontend
- `frontend/src/components/ServerHealthCheck.jsx` - UI component
- `frontend/src/pages/ClientPage.jsx` - Integration
- `frontend/src/services/api.js` - API client

### Documentation
- `SERVER_HEALTH_CHECK_GUIDE.md` - Comprehensive guide
- `HEALTH_CHECK_QUICKSTART.md` - Quick start
- `HEALTH_CHECK_FLOW.md` - Architecture diagrams
- `HEALTH_CHECK_TESTING.md` - Test procedures
- `IMPLEMENTATION_SUMMARY_v1.0.6.md` - Implementation details

## Support

Having issues? Check these resources:

1. **Quick Start:** [HEALTH_CHECK_QUICKSTART.md](HEALTH_CHECK_QUICKSTART.md)
2. **Full Guide:** [SERVER_HEALTH_CHECK_GUIDE.md](SERVER_HEALTH_CHECK_GUIDE.md)
3. **Testing:** [HEALTH_CHECK_TESTING.md](HEALTH_CHECK_TESTING.md)
4. **Flow Diagrams:** [HEALTH_CHECK_FLOW.md](HEALTH_CHECK_FLOW.md)
5. **Installation:** [INSTALLATION.md](INSTALLATION.md)
6. **General Help:** [WEB_GUI_README.md](WEB_GUI_README.md)

## Version

**Current Version:** v1.0.6
**Release Date:** 2026-02-19
**Status:** Production Ready

## License

Same as parent project (BSD-3-Clause)
