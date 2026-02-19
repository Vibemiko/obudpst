# Server Health Check - Testing Guide

## Overview

This guide provides comprehensive testing procedures for the Server Health Check feature to verify correct functionality in various scenarios.

## Prerequisites

- OB-UDPST Web GUI running (backend + frontend)
- At least one UDPST server machine for testing
- Network access between test client and server
- Firewall control on server machine (for testing blocked scenarios)

## Test Environment Setup

### Machine A (Client - Web GUI)
- Running: Node.js backend + React frontend
- IP: 192.168.0.231 (example)
- Role: Initiates health checks and tests

### Machine B (Server - UDPST)
- Running: UDPST server binary
- IP: 192.168.0.54 (example)
- Role: Target server for health checks

## Test Cases

### Test 1: Server Running and Accessible (Happy Path)

**Setup:**
```bash
# On Machine B (192.168.0.54)
/opt/obudpst/udpst -4 -x 192.168.0.54

# Verify server is listening
netstat -tulpn | grep 25000
```

**Test Steps:**
1. Open Web GUI in browser
2. Navigate to "Client Test" page
3. Enter server IP: `192.168.0.54`
4. Click "Check Servers" button
5. Wait for results

**Expected Result:**
```
✓ All servers are reachable (1 of 1)

✓ 192.168.0.54:25000                    [Reachable]
  ✓ Network Ping: Host 192.168.0.54 is reachable
  ✓ Control Port: Port 25000 is open and accepting connections
```

**Verification:**
- Green success banner displayed
- Both checks show green checkmarks
- "Reachable" badge is green
- No error messages or recommendations

---

### Test 2: Server Not Running

**Setup:**
```bash
# On Machine B (192.168.0.54)
pkill udpst

# Verify no server is running
ps aux | grep udpst
```

**Test Steps:**
1. Open Web GUI in browser
2. Navigate to "Client Test" page
3. Enter server IP: `192.168.0.54`
4. Click "Check Servers" button
5. Wait for results

**Expected Result:**
```
✗ No servers are reachable (0 of 1)

✗ 192.168.0.54:25000                    [Unreachable]
  ✓ Network Ping: Host 192.168.0.54 is reachable
  ✗ Control Port: Port 25000 is closed or not accepting connections

Recommendation:
Port 25000 is not accessible on 192.168.0.54. Ensure the UDPST
server is running on that machine. Start the server with:
udpst -4 -x 192.168.0.54 (for IPv4) or udpst -6 -x 192.168.0.54
(for IPv6). Also check firewall rules to allow incoming connections
on port 25000.
```

**Verification:**
- Red error banner displayed
- Network Ping shows green checkmark (pass)
- Control Port shows red X (fail)
- "Unreachable" badge is red
- Recommendation section provides startup command
- Recommendation includes port 25000

---

### Test 3: Invalid IP Address (Network Unreachable)

**Setup:**
- No setup needed
- Use non-existent IP: `192.168.99.99`

**Test Steps:**
1. Open Web GUI in browser
2. Navigate to "Client Test" page
3. Enter server IP: `192.168.99.99`
4. Click "Check Servers" button
5. Wait for results (may take full 5 seconds due to timeouts)

**Expected Result:**
```
✗ No servers are reachable (0 of 1)

✗ 192.168.99.99:25000                   [Unreachable]
  ✗ Network Ping: Host 192.168.99.99 is not reachable via ping
  ✗ Control Port: Port 25000 is closed or not accepting connections

Recommendation:
The server at 192.168.99.99 is not reachable. Verify the IP address
is correct and the server machine is powered on. Check network
connectivity between this machine and the server.
```

**Verification:**
- Red error banner displayed
- Both checks show red X (fail)
- "Unreachable" badge is red
- Recommendation mentions verifying IP address
- Recommendation suggests checking if server is powered on

---

### Test 4: Firewall Blocking Port

**Setup:**
```bash
# On Machine B (192.168.0.54)
# Ensure server is running
/opt/obudpst/udpst -4 -x 192.168.0.54

# Block port 25000 with firewall
sudo ufw deny 25000/tcp
sudo ufw deny 25000/udp

# Verify firewall rules
sudo ufw status
```

**Test Steps:**
1. Open Web GUI in browser
2. Navigate to "Client Test" page
3. Enter server IP: `192.168.0.54`
4. Click "Check Servers" button
5. Wait for results

**Expected Result:**
```
✗ No servers are reachable (0 of 1)

✗ 192.168.0.54:25000                    [Unreachable]
  ✓ Network Ping: Host 192.168.0.54 is reachable
  ✗ Control Port: Port 25000 is closed or not accepting connections

Recommendation:
Port 25000 is not accessible on 192.168.0.54. Ensure the UDPST
server is running on that machine. [...]
```

**Cleanup:**
```bash
# On Machine B - unblock port
sudo ufw allow 25000/tcp
sudo ufw allow 25000/udp
```

**Verification:**
- Network Ping passes (host is reachable)
- Control Port fails (port is blocked)
- Recommendation includes firewall check

---

### Test 5: Multiple Servers (Mixed Results)

**Setup:**
```bash
# Machine B (192.168.0.54) - Server running
/opt/obudpst/udpst -4 -x 192.168.0.54

# Machine C (192.168.0.55) - No server running
pkill udpst
```

**Test Steps:**
1. Open Web GUI in browser
2. Navigate to "Client Test" page
3. Enter server IPs: `192.168.0.54, 192.168.0.55`
4. Click "Check Servers" button
5. Wait for results

**Expected Result:**
```
✗ Some servers are not reachable (1 of 2)

✓ 192.168.0.54:25000                    [Reachable]
  ✓ Network Ping: Host 192.168.0.54 is reachable
  ✓ Control Port: Port 25000 is open and accepting connections

✗ 192.168.0.55:25000                    [Unreachable]
  ✓ Network Ping: Host 192.168.0.55 is reachable
  ✗ Control Port: Port 25000 is closed or not accepting connections
```

**Verification:**
- Banner shows "Some servers are not reachable"
- Count shows "1 of 2 servers are accessible"
- First server shows all green
- Second server shows mixed (ping pass, port fail)
- Each server has independent status

---

### Test 6: Non-Standard Port

**Setup:**
```bash
# On Machine B - run server on port 30000
/opt/obudpst/udpst -4 -p 30000 -x 192.168.0.54
```

**Test Steps:**
1. Open Web GUI in browser
2. Navigate to "Client Test" page
3. Enter server IP: `192.168.0.54`
4. Change port to: `30000`
5. Click "Check Servers" button
6. Wait for results

**Expected Result:**
```
✓ All servers are reachable (1 of 1)

✓ 192.168.0.54:30000                    [Reachable]
  ✓ Network Ping: Host 192.168.0.54 is reachable
  ✓ Control Port: Port 30000 is open and accepting connections
```

**Verification:**
- Health check uses port 30000 (not default 25000)
- All checks pass
- Port number displayed correctly in results

---

### Test 7: IPv6 Server

**Setup:**
```bash
# On Machine B - run IPv6 server
/opt/obudpst/udpst -6 -x 2001:db8::1

# Verify IPv6 address
ip -6 addr show
```

**Test Steps:**
1. Open Web GUI in browser
2. Navigate to "Client Test" page
3. Select IP Version: `IPv6`
4. Enter server IPv6: `2001:db8::1`
5. Click "Check Servers" button
6. Wait for results

**Expected Result:**
```
✓ All servers are reachable (1 of 1)

✓ 2001:db8::1:25000                     [Reachable]
  ✓ Network Ping: Host 2001:db8::1 is reachable
  ✓ Control Port: Port 25000 is open and accepting connections
```

**Verification:**
- Uses `ping6` command (not `ping`)
- IPv6 address displayed correctly
- All checks pass for IPv6

---

### Test 8: API Direct Testing

**Test with curl:**

```bash
# Single server check
curl -X POST http://localhost:3001/api/health/check-server \
  -H "Content-Type: application/json" \
  -d '{"host": "192.168.0.54", "port": 25000}' \
  | jq .

# Multiple servers check
curl -X POST http://localhost:3001/api/health/check-servers \
  -H "Content-Type: application/json" \
  -d '{"servers": ["192.168.0.54", "192.168.0.55"], "port": 25000}' \
  | jq .
```

**Expected Response (Success):**
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

**Verification:**
- Response is valid JSON
- All expected fields present
- Boolean flags match check results

---

### Test 9: Performance Testing

**Test concurrent checks:**

```bash
# Run 10 health checks in parallel
for i in {1..10}; do
  curl -X POST http://localhost:3001/api/health/check-server \
    -H "Content-Type: application/json" \
    -d '{"host": "192.168.0.54", "port": 25000}' &
done
wait
```

**Expected Result:**
- All requests complete within 5-6 seconds
- No timeout errors
- All return same result
- Server handles concurrent load

---

### Test 10: Integration with Test Execution

**Test the full workflow:**

1. Run health check on server (should pass)
2. Click "Start Test" immediately after
3. Verify test succeeds

Then:

1. Stop the server
2. Run health check (should fail)
3. Click "Start Test" anyway
4. Verify test fails with clear error message

**Expected Result:**
- Health check accurately predicts test outcome
- Test failures show same connectivity issues detected by health check
- Error messages are consistent

---

## Automated Testing Script

```bash
#!/bin/bash
# health-check-test.sh

API_URL="http://localhost:3001/api/health"
TEST_HOST="192.168.0.54"
TEST_PORT="25000"

echo "=== Server Health Check Automated Tests ==="
echo

# Test 1: Valid server
echo "Test 1: Checking valid server..."
curl -s -X POST "$API_URL/check-server" \
  -H "Content-Type: application/json" \
  -d "{\"host\": \"$TEST_HOST\", \"port\": $TEST_PORT}" \
  | jq -r 'if .reachable then "✓ PASS" else "✗ FAIL" end'
echo

# Test 2: Invalid host
echo "Test 2: Checking invalid host..."
curl -s -X POST "$API_URL/check-server" \
  -H "Content-Type: application/json" \
  -d '{"host": "192.168.99.99", "port": 25000}' \
  | jq -r 'if .reachable == false then "✓ PASS" else "✗ FAIL" end'
echo

# Test 3: Multiple servers
echo "Test 3: Checking multiple servers..."
curl -s -X POST "$API_URL/check-servers" \
  -H "Content-Type: application/json" \
  -d "{\"servers\": [\"$TEST_HOST\", \"192.168.0.55\"], \"port\": $TEST_PORT}" \
  | jq -r '"Total: \(.totalServers), Reachable: \(.reachableServers)"'
echo

echo "=== Tests Complete ==="
```

## Troubleshooting Test Failures

### Health Check Always Fails

**Check:**
1. Is backend running? `netstat -tulpn | grep 3001`
2. Can you reach backend? `curl http://localhost:3001/api/health/check-server`
3. Are ping/TCP tests working manually?

### Health Check Passes But Test Fails

**Possible causes:**
1. UDP data ports (32768-60999) are blocked
2. Authentication key mismatch
3. Server capacity exceeded

**Solution:**
```bash
# Allow UDP data ports
sudo ufw allow 32768:60999/udp
```

### Timeout Issues

**If health checks take too long:**
1. Check network latency
2. Verify no packet loss
3. Consider increasing timeouts in health-check.js

## Success Criteria

All test cases should:
- Complete within expected timeouts (2-5 seconds)
- Return accurate results matching actual server state
- Display appropriate UI feedback (colors, messages)
- Provide actionable recommendations for failures
- Work consistently across multiple runs
- Handle edge cases gracefully

## Regression Testing

After any changes to health check code, re-run:
1. Test 1 (happy path)
2. Test 2 (server not running)
3. Test 3 (invalid IP)
4. Test 5 (multiple servers)

These four tests cover the primary use cases and should always pass.
