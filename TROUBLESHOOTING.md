# Troubleshooting Guide

## Common Issues and Solutions

### Health Check Shows Port as Closed But Tests Work

**Symptom**: The health check reports "Port 25000 is closed or not accepting connections" but tests run successfully and collect valid data.

**Cause**: Previously, the health check was using TCP to test a UDP port (UDPST uses UDP protocol). TCP connectivity tests don't work on UDP-only services.

**Solution**:
- **Fixed in v1.0.7+**: Health check now uses UDP protocol to properly test UDPST server connectivity
- If you see this on older versions, ignore the health check and verify the server is running via:
  ```bash
  ps aux | grep udpst
  ```
- Check server logs to confirm it's receiving and processing requests

**How to verify server is actually working**:
1. Run a short test (5-10 seconds)
2. Check if sub-intervals are collected in the output
3. If you see "Sub-Interval[1]", "Sub-Interval[2]", etc., the server IS working
4. Server logs should show: "Test connection received from [client IP]"

### Downstream Tests Show "Completed with Warnings"

**Symptom**: Downstream tests complete successfully, collect all expected data, but show warnings like:
```
LOCAL WARNING: Incoming traffic has completely stopped
ERROR: Minimum required connections unavailable
```

**Cause**: This is **normal UDPST behavior** for downstream tests. The warning appears AFTER data collection completes and indicates the server has finished sending data.

**Solution**:
- **This is not an error!** Check if the test collected the expected number of sub-intervals
- For a 10-second test, you should see Sub-Interval[1] through Sub-Interval[10]
- If all intervals are present with valid data (100% delivery), the test was successful
- The Web GUI now correctly shows these as `completed_warnings` (amber badge) instead of `failed`

**Why this happens**:
1. In downstream tests, the **server** sends data to the client
2. After the test duration ends, the server stops sending and closes the connection
3. The client detects this and reports "incoming traffic stopped"
4. UDPST exits with ErrorStatus 200 even though the test data is valid

**When to be concerned**:
- If NO sub-intervals were collected (test never started)
- If intervals are missing (e.g., only 3 out of 10 intervals)
- If packet loss is high (>5%)
- If status shows `failed` (red badge) instead of `completed_warnings`

### Test Stops Before Completing All Intervals

**Symptom**: Requested a 10-second test but only 6 sub-intervals were collected, followed by "incoming traffic stopped" warning.

**Cause**: The server terminated the test early. This can happen if:
1. Server process was manually stopped
2. Server encountered an error
3. Server configuration has a different test duration limit
4. Network interruption caused server to stop sending

**Solution**:
1. **Check server logs** for error messages or early termination notices
2. **Verify server is still running**: `ps aux | grep udpst`
3. **Check server resources**: Ensure server has adequate CPU/memory
4. **Try upstream test**: Upstream tests don't have this termination pattern
5. **Check network stability**: Look for packet loss or connection issues
6. **Review server command line**: Ensure server was started with correct parameters

**Data validity**:
- If you collected 6 out of 10 intervals with 100% delivery, those 6 intervals are valid
- The Web GUI will show this as `completed_warnings` with partial results
- You can still use this data for analysis, understanding it's a shortened test

### Both Upstream and Downstream Show Connection Warnings

**Symptom**: Both test directions show "incoming traffic stopped" warnings after completion.

**Normal behavior**:
- **Downstream**: Connection warnings are expected (see "Downstream Tests Show Warnings" above)
- **Upstream**: Should complete cleanly with summary statistics, no warnings

**If upstream also shows warnings**:
1. **Check server logs**: Server may be terminating early
2. **Verify test duration**: Ensure server allows the requested test duration
3. **Check if server has timeouts**: Some configurations limit maximum test duration
4. **Review firewall rules**: Ensure bidirectional UDP traffic is allowed
5. **Try shorter test**: Test with 5 seconds instead of 10 to see if duration is the issue

### Connection Count Recommendations

**Why 2+ connections?**
- Single connection tests can show more frequent warnings
- Multiple connections provide better stability
- 2-4 connections is optimal for most scenarios
- Production testing should use 2+ connections

**When to use 1 connection**:
- Quick connectivity tests
- Bandwidth-limited scenarios
- When testing basic reachability
- Understanding that warnings may appear more frequently

### Error Status Codes

The Web GUI intelligently classifies UDPST error codes:

| ErrorStatus | Meaning | Classification |
|-------------|---------|----------------|
| 0 | Clean success | `completed` |
| 200 (with data) | Connection warning after test completion | `completed_warnings` |
| 200 (no data) | True connection failure | `failed` |
| 1-2 | Test inconclusive | `completed_warnings` if data exists |
| 3 | Connection issues | `completed_warnings` if data exists, `failed` if not |
| 4-5 | Protocol/auth error | `failed` |

**Key point**: The presence of valid sub-interval data is more important than the ErrorStatus code.

## Diagnostic Commands

### Check if server is running
```bash
ps aux | grep udpst
```

### Check server logs (if running via Web GUI)
Check the backend logs or server page in the Web GUI

### Run manual test to verify connectivity
```bash
# Downstream test (server sends to you)
/opt/obudpst/udpst -d -t 5 SERVER_IP -4 -C 2

# Upstream test (you send to server)
/opt/obudpst/udpst -u -t 5 SERVER_IP -4 -C 2
```

### Check firewall rules
```bash
# Linux
sudo ufw status
sudo iptables -L -n -v | grep 25000

# Check if UDP port is listening (on server)
sudo ss -ulnp | grep 25000
sudo netstat -ulnp | grep 25000
```

### Verify network path
```bash
# Basic ping
ping SERVER_IP

# Traceroute
traceroute SERVER_IP

# Check if host is reachable on specific port (note: nc uses TCP by default)
nc -vz -u SERVER_IP 25000
```

## Web GUI Specific Issues

### Results Not Displaying

**Check**:
1. Test status - should be `completed` or `completed_warnings`, not `failed`
2. Browser console for JavaScript errors
3. Backend logs for parsing errors
4. Database to verify results were saved

### Status Badge Colors

- **Green** (`completed`): Clean success, no issues
- **Amber** (`completed_warnings`): Success with non-critical warnings (still usable results)
- **Red** (`failed`): True failure, no usable data

### Warning Messages Not Clear

The Web GUI provides context-specific warnings:
- Downstream tests get an explanation about normal termination behavior
- Recommendations include using 2+ connections
- Test type (upstream/downstream) is considered in the warning message

## Best Practices

1. **Always run health check first** - Verify server is reachable
2. **Start with short tests** - Use 5-second tests to verify basic connectivity
3. **Use 2+ connections** - Reduces warning frequency
4. **Check sub-intervals** - Count intervals to verify test completed
5. **Review server logs** - Helps diagnose server-side issues
6. **Use upstream for verification** - Cleaner completion makes troubleshooting easier
7. **Understand warnings vs failures** - Amber badges with data are successes

## Getting Help

If issues persist:

1. **Collect diagnostic information**:
   - Health check results
   - Test output (CLI and Web GUI)
   - Server logs
   - Network configuration
   - UDPST version

2. **Check documentation**:
   - `DOWNSTREAM_TEST_BEHAVIOR.md` - Detailed explanation of termination patterns
   - `IMPLEMENTATION_SUMMARY_v1.0.7.md` - Technical implementation details
   - `SERVER_HEALTH_CHECK_GUIDE.md` - Server setup and verification

3. **Verify basics**:
   - Is server actually running?
   - Are firewalls configured correctly?
   - Is network path clear (ping succeeds)?
   - Are you using compatible UDPST versions?

## Version-Specific Notes

### v1.0.7 Changes
- Health check now uses UDP instead of TCP (accurate port testing)
- Intelligent error classification (distinguishes warnings from failures)
- New status: `completed_warnings` for successful tests with cosmetic warnings
- Default connections changed from 1 to 2
- Warning messages explain expected downstream behavior

### Before v1.0.7
- Health check used TCP on UDP port (always failed)
- All downstream tests marked as `failed`
- No distinction between warnings and true failures
- Default was 1 connection (more warnings)
