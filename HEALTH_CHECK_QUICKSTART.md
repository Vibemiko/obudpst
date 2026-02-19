# Server Health Check - Quick Start

## What Is It?

The Server Health Check validates that UDPST servers are reachable and ready before you run a test. It catches connectivity problems early, saving you time and frustration.

## How to Use It

### In the Web GUI

1. Go to **Client Test** page
2. Enter your server IP address(es)
3. Click **"Check Servers"** button (appears below the Start Test button)
4. Wait 2-5 seconds for results
5. Review the status:
   - ✅ **Green** = Server is ready, proceed with confidence
   - ❌ **Red** = Server has issues, fix them before testing

### What Gets Checked

**Network Ping**
- Can the server be reached on the network?
- Uses ICMP ping to verify connectivity

**Control Port**
- Is port 25000 open and accepting connections?
- Uses TCP connection test

## Common Scenarios

### ✅ All Green - Ready to Test
```
✓ Network Ping: Host 192.168.0.54 is reachable
✓ Control Port: Port 25000 is open and accepting connections
```
**Action:** Click "Start Test"

### ❌ Port Not Open - Start the Server
```
✓ Network Ping: Host 192.168.0.54 is reachable
✗ Control Port: Port 25000 is closed or not accepting connections
```
**Fix:**
```bash
# On the server machine (192.168.0.54)
/opt/obudpst/udpst -4 -x 192.168.0.54
```

### ❌ Network Unreachable - Check IP Address
```
✗ Network Ping: Host 192.168.0.54 is not reachable via ping
✗ Control Port: Port 25000 is closed or not accepting connections
```
**Fix:**
1. Verify IP address is correct
2. Check if server is powered on
3. Test with: `ping 192.168.0.54`

### ❌ Firewall Blocking - Open Port
```
✓ Network Ping: Host 192.168.0.54 is reachable
✗ Control Port: Port 25000 is closed or not accepting connections
```
**And server is running but still fails:**

```bash
# On server machine - allow control port
sudo ufw allow 25000/tcp
sudo ufw allow 25000/udp

# Also allow UDP data ports for actual tests
sudo ufw allow 32768:60999/udp
```

## Pro Tips

1. **Check before every test** to catch issues early
2. **Use after network changes** (firewall updates, IP changes)
3. **Document results** when reporting issues
4. **Remember:** Health check only tests the control port - UDP data ports (32768-60999) are tested during actual UDPST execution

## What If Health Check Passes But Test Still Fails?

The health check validates the **control protocol** connectivity. If tests still fail after a successful health check:

1. **UDP data ports may be blocked:**
   ```bash
   sudo ufw allow 32768:60999/udp
   ```

2. **Authentication key mismatch:**
   - Ensure client and server use the same key, or none at all

3. **Server at capacity:**
   - Check if too many tests are running simultaneously

See [SERVER_HEALTH_CHECK_GUIDE.md](SERVER_HEALTH_CHECK_GUIDE.md) for detailed troubleshooting.

## API Usage

```bash
# Check a single server
curl -X POST http://localhost:3001/api/health/check-server \
  -H "Content-Type: application/json" \
  -d '{"host": "192.168.0.54", "port": 25000}'

# Check multiple servers
curl -X POST http://localhost:3001/api/health/check-servers \
  -H "Content-Type: application/json" \
  -d '{"servers": ["192.168.0.54", "192.168.0.55"], "port": 25000}'
```

## Need More Help?

- Full documentation: [SERVER_HEALTH_CHECK_GUIDE.md](SERVER_HEALTH_CHECK_GUIDE.md)
- Installation guide: [INSTALLATION.md](INSTALLATION.md)
- General troubleshooting: [WEB_GUI_README.md](WEB_GUI_README.md)
