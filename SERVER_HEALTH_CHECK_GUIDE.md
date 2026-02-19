# Server Health Check Guide

## Overview

The Server Health Check feature helps diagnose connectivity issues between the UDPST client and server before running tests. This prevents failed tests due to network or configuration problems.

## What It Checks

The health check performs two critical validation tests:

### 1. Network Ping Test
- Verifies basic network connectivity to the server host
- Uses ICMP ping to test if the server is reachable
- Timeout: 2 seconds

### 2. Control Port Test
- Verifies that the UDPST control port (default: 25000) is open and accepting connections
- Uses TCP connection attempt to test port accessibility
- Timeout: 3 seconds

## How to Use

### In the Web GUI

1. Navigate to the **Client Test** page
2. Enter one or more server IP addresses in the "Server Addresses" field
3. Configure the port (default: 25000)
4. Click the **"Check Servers"** button in the "Server Health Check" section
5. Review the results:
   - **Green** = Server is reachable and ready
   - **Red** = Server has connectivity issues

### Via API

```javascript
// Check a single server
const result = await fetch('/api/health/check-server', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    host: '192.168.0.54',
    port: 25000
  })
});

// Check multiple servers
const result = await fetch('/api/health/check-servers', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    servers: ['192.168.0.54', '192.168.0.55'],
    port: 25000
  })
});
```

## Understanding Results

### All Checks Pass
```
✓ Network Ping: Host 192.168.0.54 is reachable
✓ Control Port: Port 25000 is open and accepting connections
```
**Status:** Ready to run tests

### Network Unreachable
```
✗ Network Ping: Host 192.168.0.54 is not reachable via ping
✗ Control Port: Port 25000 is closed or not accepting connections
```
**Recommendation:**
- Verify the IP address is correct
- Ensure the server machine is powered on
- Check network connectivity between machines
- Verify there are no routing issues

### Port Not Accessible
```
✓ Network Ping: Host 192.168.0.54 is reachable
✗ Control Port: Port 25000 is closed or not accepting connections
```
**Recommendation:**
- Start the UDPST server on the target machine
- Check firewall rules allow incoming connections on port 25000
- Verify the server is listening on the correct interface

## Common Issues and Solutions

### Issue: "Host is not reachable"

**Possible Causes:**
- Incorrect IP address
- Server machine is offline
- Network cable unplugged
- Different subnet/VLAN

**Solutions:**
1. Verify IP address: `ip addr show` (Linux) or `ipconfig` (Windows)
2. Test connectivity: `ping 192.168.0.54`
3. Check physical network connection
4. Verify routing: `traceroute 192.168.0.54` (Linux) or `tracert 192.168.0.54` (Windows)

### Issue: "Port 25000 is not accessible"

**Possible Causes:**
- UDPST server not running
- Firewall blocking port 25000
- Server listening on wrong interface

**Solutions:**

1. **Start the server:**
   ```bash
   # IPv4
   /opt/obudpst/udpst -4 -x 192.168.0.54

   # IPv6
   /opt/obudpst/udpst -6 -x 2001:db8::1
   ```

2. **Check if server is running:**
   ```bash
   ps aux | grep udpst
   netstat -tulpn | grep 25000
   ```

3. **Allow port through firewall:**
   ```bash
   # UFW (Ubuntu/Debian)
   sudo ufw allow 25000/tcp
   sudo ufw allow 25000/udp

   # Firewalld (RHEL/CentOS)
   sudo firewall-cmd --add-port=25000/tcp --permanent
   sudo firewall-cmd --add-port=25000/udp --permanent
   sudo firewall-cmd --reload

   # iptables
   sudo iptables -A INPUT -p tcp --dport 25000 -j ACCEPT
   sudo iptables -A INPUT -p udp --dport 25000 -j ACCEPT
   ```

4. **Verify server is listening:**
   ```bash
   # Should show LISTEN on port 25000
   ss -tulpn | grep 25000
   ```

### Issue: "Server passes health check but test still fails"

**Possible Causes:**
- UDP data ports (32768-60999) are blocked
- Authentication key mismatch
- Server capacity limits reached

**Solutions:**

1. **Allow UDP data ports:**
   ```bash
   # UFW
   sudo ufw allow 32768:60999/udp

   # Firewalld
   sudo firewall-cmd --add-port=32768-60999/udp --permanent
   sudo firewall-cmd --reload

   # iptables
   sudo iptables -A INPUT -p udp --dport 32768:60999 -j ACCEPT
   ```

2. **Check authentication:**
   - Ensure client and server use the same authentication key
   - Or remove authentication from both

3. **Check server logs:**
   ```bash
   tail -f /var/log/udpst/udpst-server.log
   ```

## Best Practices

1. **Always run health check before important tests**
   - Catches configuration issues early
   - Saves time debugging failed tests

2. **Run health check after network changes**
   - After firewall rule updates
   - After server restarts
   - After IP address changes

3. **Document your server configuration**
   - Keep track of server IPs
   - Note any special firewall rules
   - Record authentication keys (securely)

4. **Use consistent port numbers**
   - Default 25000 is recommended
   - If changed, update both client and server

## API Response Format

### Single Server Check
```json
{
  "success": true,
  "host": "192.168.0.54",
  "port": 25000,
  "reachable": true,
  "pingSuccessful": true,
  "controlPortOpen": true,
  "checks": [
    {
      "name": "Network Ping",
      "passed": true,
      "message": "Host 192.168.0.54 is reachable"
    },
    {
      "name": "Control Port",
      "passed": true,
      "message": "Port 25000 is open and accepting connections"
    }
  ]
}
```

### Multiple Servers Check
```json
{
  "success": true,
  "allReachable": true,
  "totalServers": 2,
  "reachableServers": 2,
  "unreachableServers": 0,
  "servers": [
    {
      "host": "192.168.0.54",
      "port": 25000,
      "reachable": true,
      "pingSuccessful": true,
      "controlPortOpen": true,
      "checks": [...]
    },
    {
      "host": "192.168.0.55",
      "port": 25000,
      "reachable": true,
      "pingSuccessful": true,
      "controlPortOpen": true,
      "checks": [...]
    }
  ]
}
```

## Integration with Tests

The health check is designed to be used **before** running UDPST tests:

1. User enters server configuration
2. User clicks "Check Servers" (optional but recommended)
3. System validates connectivity
4. If issues found, user fixes them
5. User clicks "Start Test" with confidence

## Limitations

- Health check only validates **control port** connectivity (TCP)
- Does not test **UDP data ports** (32768-60999) - these are tested during actual UDPST execution
- Cannot detect server capacity or load issues
- Cannot verify authentication keys (requires actual test attempt)

## See Also

- [Installation Guide](INSTALLATION.md) - Server setup instructions
- [Deployment Guide](DEPLOYMENT_GUIDE.md) - Production deployment
- [Troubleshooting](#common-issues-and-solutions) - Common problems and fixes
