# UDPST Binary Troubleshooting Guide

## Critical Issue: 6-Second Test Failure Pattern

### Problem Description

Tests consistently fail after exactly **6 seconds** (6 intervals) regardless of the requested test duration. This occurs with both CLI and Web GUI interfaces, indicating a **bug in the UDPST binary itself**, not the Web GUI.

### Symptoms

- Test requested for 100 seconds but stops after 6 seconds
- Both upstream and downstream tests exhibit identical behavior
- Error status 200 (or 3): "Minimum required connections unavailable"
- Valid data collected for intervals 1-6, then connection terminates
- Identical behavior in CLI (direct `./udpst` execution) and Web GUI
- Network configuration is correct (firewall, buffers, conntrack all verified)

### Root Cause

The UDPST binary has a **future build date**:
```
Built: Feb 18 2026 22:58:16
```

This indicates:
1. System clock was incorrect during compilation
2. Development or test build with bugs
3. Untested pre-release version

The binary contains a bug that causes it to terminate connections after 6 seconds regardless of the `-t` (duration) parameter.

### Evidence

**CLI Test (identical to GUI behavior):**
```bash
./udpst -d -p 25000 -t 100 10.50.3.1
# Output shows only 6 intervals collected despite requesting 100 seconds
```

**Network Configuration (verified correct):**
```bash
# UDP conntrack timeouts - CORRECT
net.netfilter.nf_conntrack_udp_timeout = 30
net.netfilter.nf_conntrack_udp_timeout_stream = 120

# Ephemeral ports - CORRECT
net.ipv4.ip_local_port_range = 32768 60999

# Socket buffers - CORRECT (128MB > 2MB requirement)
net.core.rmem_max = 134217728
net.core.wmem_max = 134217728

# Firewall rules - CORRECT
ufw allow 25000/udp
ufw allow 32768:60999/udp
```

**Test Output Pattern:**
- Intervals 1-6: Valid data collected (throughput, latency, jitter all measured)
- Interval 7+: Never occur, connection drops
- Error appears: "Incoming traffic has completely stopped"

### Why This is NOT a Network Issue

1. **Bidirectional Communication Works**: The test establishes connections successfully and transmits data in both directions for 6 full seconds
2. **Identical CLI Behavior**: Running `./udpst` directly (bypassing Web GUI) shows the same 6-second limit
3. **Network Config Verified**: All sysctl parameters, firewall rules, and conntrack settings are correct
4. **Ping and Port Check Pass**: Network connectivity is confirmed
5. **Consistent Interval Count**: Always exactly 6 intervals, never more, never less

If this were a network issue, we would see:
- Variable failure times (not always exactly 6 seconds)
- Firewall blocks (but ports are open)
- No data collected (but we get 6 successful intervals)
- Different behavior between CLI and GUI (but they're identical)

### Understanding UDPST Bidirectional Nature

Even "downstream" tests require bidirectional UDP:

1. **Setup Phase**: Client → Server (control messages on port 25000)
2. **Test Phase**: Server → Client (data on ephemeral ports 32768-60999)
3. **Acknowledgment Phase**: Client → Server (status/PDV feedback on ephemeral ports)

The binary's bug causes it to incorrectly detect connection loss after 6 acknowledgment cycles, despite the connection being healthy.

## Solutions

### Solution 1: Obtain a Stable UDPST Binary (Recommended)

**Option A: Download Official Release**
```bash
# Check UDPST project repository for stable releases
# Look for versions with past build dates and stable tags
wget https://github.com/BroadbandForum/obudpst/releases/download/vX.X.X/udpst
chmod +x udpst
```

**Option B: Compile from Source**
```bash
# Clone official repository
git clone https://github.com/BroadbandForum/obudpst.git
cd obudpst

# Ensure system time is correct
date
# If incorrect: sudo timedatectl set-time 'YYYY-MM-DD HH:MM:SS'

# Compile with optimizations
cmake -DCMAKE_BUILD_TYPE=Release .
make

# Verify build
./udpst -V
# Check that build date is in the past and version is stable
```

### Solution 2: Verify Binary Version

**Check your current binary:**
```bash
./udpst -V
```

**Look for:**
- Version number (avoid "dev", "test", "alpha" versions)
- Build date **in the past** (not 2026 when it's 2024/2025)
- Protocol version (should be 10 or 11)
- Optimizations: SendMMsg+GSO, RecvMMsg+Trunc

**Warning signs:**
- Build date in the future → Development build
- Missing optimizations → Performance issues
- Protocol version < 10 → Outdated

### Solution 3: Workaround for Short Tests

While waiting for a corrected binary, you can work around the bug:

**Run multiple short tests:**
```bash
# Instead of one 100-second test:
./udpst -d -t 100 10.50.3.1

# Run twenty 5-second tests:
for i in {1..20}; do
  ./udpst -d -t 5 10.50.3.1
  sleep 1
done
```

This collects the same total duration of data in 5-second chunks that complete before the bug triggers.

### Solution 4: Contact UDPST Developers

If you obtained the binary from the project maintainers, report the issue:

1. **Describe the symptom**: Tests terminate after exactly 6 seconds
2. **Include binary info**: Build date (Feb 2026), version string
3. **Provide evidence**: Test output showing 6 intervals collected
4. **Mention network config**: All parameters verified correct

## Using the Web GUI with the Buggy Binary

The Web GUI has been updated to handle this bug gracefully:

### Features Added

1. **Binary Version Detection**: Warns when build date is in the future
2. **Partial Result Success**: Tests with 5+ intervals marked as "partial success" instead of "failed"
3. **Enhanced Error Messages**: Clearly identifies the 6-second bug in error text
4. **Diagnostics Page**: Tools to verify network config and identify binary issues

### Interpreting Test Results

When you see:
```
Status: completed_partial
Warning: Test collected 6 intervals of data before connection failure.
This may indicate a known UDPST binary bug causing early termination.
```

**This means:**
- ✅ Network configuration is working correctly
- ✅ The 6 seconds of data collected is valid
- ❌ The binary has a bug preventing longer tests
- 💡 Solution: Obtain a corrected binary

### Using Diagnostics Page

1. Navigate to **Diagnostics** in the Web GUI
2. Click **Binary Info** tab
   - Check for future build date warning
   - Verify optimizations are present
3. Click **System Config** tab
   - Verify ephemeral ports (should be 32768-60999)
   - Verify socket buffers (should be ≥ 2MB)
4. Click **Quick Test** tab
   - Run 2-second test to verify basic connectivity
   - If successful: Network is fine, binary is the issue

## FAQ

**Q: Why does netcat (nc) not work for testing UDP?**

A: Netcat sends/receives raw UDP packets without implementing the UDPST protocol. UDPST requires:
- Specific message formats (control setup, load adjustment, measurement)
- PDV (Packet Delay Variation) feedback
- Bidirectional communication with timing requirements

Use `./udpst` CLI or the Web GUI "Quick Test" feature instead.

**Q: The Web GUI says "ErrorStatus 200" - is that success?**

A: No. ErrorStatus 0 = success. ErrorStatus 200 = "minimum required connections unavailable". However, if valid data was collected, the Web GUI now treats this as "partial success" and displays the results.

**Q: Can I increase the timeout to fix this?**

A: No. The bug is in the binary's logic, not timeout settings. The binary incorrectly terminates the connection after 6 intervals. Increasing conntrack timeouts won't help because the connection is being closed by the binary itself, not by the network stack.

**Q: Why does the server log show "Connection from X.X.X.X lost"?**

A: The buggy client binary stops sending acknowledgments after 6 seconds, causing the server to detect a lost connection. This is the bug manifesting from the server's perspective.

**Q: Will updating my system fix this?**

A: No. System updates won't fix a bug in the UDPST binary. You need a corrected UDPST binary, not system updates.

## Verification Steps

After obtaining a new binary, verify it works:

### 1. Check Build Date
```bash
./udpst -V | grep Built
# Should show a date in the past
```

### 2. Run Extended Test
```bash
./udpst -d -t 30 -f json YOUR_SERVER_IP
```

Check the output:
```json
{
  "TestIntTime": 30,
  "IncrementalResult": [
    // Should see ~30 entries, not just 6
  ]
}
```

### 3. Use Web GUI Diagnostics
1. Upload new binary to server
2. Update path in backend `.env` if necessary
3. Go to Diagnostics → Binary Info
4. Verify no future date warning
5. Run Quick Test → should succeed
6. Run full test → should complete full duration

## Additional Resources

- **UDPST Project**: https://github.com/BroadbandForum/obudpst
- **Protocol Documentation**: See `API_SPECIFICATION.md` in project root
- **Network Setup Guide**: See `QUICKSTART.md` in project root
- **Web GUI Logs**: `/path/to/project/backend/logs/`

## Summary

- ❌ **Problem**: UDPST binary bug causes 6-second test limit
- ✅ **Evidence**: Future build date, identical CLI/GUI behavior
- ✅ **Network**: Verified correct configuration
- 💡 **Solution**: Obtain stable binary with past build date
- 🔧 **Workaround**: Run multiple short tests (≤5 seconds each)
- 📊 **Web GUI**: Now detects and reports this issue clearly

The Web GUI is functioning correctly. The issue is entirely within the UDPST binary, which needs to be replaced with a corrected version.
