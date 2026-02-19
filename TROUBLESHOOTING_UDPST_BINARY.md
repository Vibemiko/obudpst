# UDPST Binary & IPv4 Early Termination Troubleshooting Guide

## IPv4 Early Termination Pattern (~6 Seconds)

### Problem Description

Tests consistently terminate after approximately **5-7 seconds** (5-7 intervals) regardless of the requested test duration. This pattern occurs **only on IPv4** — IPv6 tests complete all requested intervals successfully. The behavior is identical in both CLI (`./udpst`) and the Web GUI.

### Symptoms

- Test requested for 100 seconds but stops after ~6 seconds
- Both upstream and downstream tests exhibit identical behavior
- Error status 200 (or 3): "Minimum required connections unavailable"
- Valid data collected for intervals 1-6, then connection terminates
- Identical behavior in CLI (direct `./udpst` execution) and Web GUI
- IPv6 tests to the same server complete normally
- Error message: "Incoming traffic has completely stopped"

### How UDPST Connection Termination Works

The UDPST binary uses a **no-traffic watchdog timer** defined in `udpst.h`:

```c
#define WARNING_NOTRAFFIC 1    // Receive traffic stopped warning threshold (sec)
#define TIMEOUT_NOTRAFFIC (WARNING_NOTRAFFIC + 2)  // = 3 seconds
```

When the binary receives no PDU (Protocol Data Unit) for **3 consecutive seconds**, it considers the connection dead and terminates. This watchdog is **reset on every received PDU** (see `udpst_data.c` line 730-732). This is normal protocol behavior, not a bug in itself.

The ~6 second termination pattern means:
1. **Seconds 1-3**: Data flows normally, ~3 intervals collected
2. **Seconds 3-6**: Traffic stops arriving on one side (the root cause)
3. **Second 6**: The 3-second `TIMEOUT_NOTRAFFIC` watchdog expires, connection terminated
4. **Result**: 5-7 valid intervals collected, then ErrorStatus 200 or 3

### Understanding the Root Cause

The key question is: **Why does UDP return traffic stop flowing at ~3-6 seconds on IPv4 but not IPv6?**

There are multiple possible causes:

#### Cause 1: IPv4 Firewall / NAT / Conntrack Issues

Even "downstream" tests require bidirectional UDP:

1. **Setup Phase**: Client -> Server (control messages on port 25000)
2. **Test Phase**: Server -> Client (data on ephemeral ports 32768-60999)
3. **Acknowledgment Phase**: Client -> Server (status/PDV feedback on ephemeral ports)

IPv4-specific networking layers (NAT, conntrack state tracking, iptables/nftables rules) can silently drop the return path UDP traffic. IPv6 bypasses many of these layers, which explains why it works.

**Diagnostic steps:**
```bash
# Check conntrack table during a test
conntrack -L -p udp | grep <server_ip>

# Check for dropped packets
iptables -L -v -n | grep DROP
nft list ruleset | grep drop

# Check NAT rules
iptables -t nat -L -v -n

# Verify conntrack timeouts are adequate
sysctl net.netfilter.nf_conntrack_udp_timeout
sysctl net.netfilter.nf_conntrack_udp_timeout_stream
# Should be at least 30 and 120 respectively

# Check if conntrack table is full (causes silent drops)
sysctl net.netfilter.nf_conntrack_count
sysctl net.netfilter.nf_conntrack_max
```

#### Cause 2: Binary Build Issue

A defective or development binary may have IPv4-specific code path bugs. Check:
```bash
./udpst -V
```

**Warning signs:**
- Build date in the future (system clock was wrong during compilation)
- Missing optimizations (SendMMsg+GSO, RecvMMsg+Trunc)
- Protocol version < 10

#### Cause 3: Cross-Platform Struct Padding (Upstream Issue #24)

If client and server binaries are compiled on different platforms (e.g., ARM vs x86, or different compilers), the `subIntStats` struct may have inconsistent memory layouts due to compiler-specific padding. The `sizeof(struct statusHdr)` can vary, causing received data size validation to fail.

See: https://github.com/BroadbandForum/obudpst/issues/24

**Fix:** Ensure both client and server binaries are compiled on the same platform/architecture, or apply `#pragma pack` as suggested in the upstream issue.

#### Cause 4: Client/Server Version Mismatch (Upstream Issue #14)

UDPST client v7.4.0 cannot communicate with server v8.1.0, producing "Timeout awaiting server response." Ensure both sides use compatible versions.

See: https://github.com/BroadbandForum/obudpst/issues/14

### Minimum Test Duration Context (Upstream Issue #16)

The UDPST binary enforces a minimum test duration of 5 seconds (`MIN_TESTINT_TIME = 5` in `udpst.h`). This was chosen to allow ramp-up time across a wide range of bandwidths. The `TIMEOUT_NOTRAFFIC` of 3 seconds means a 5-second test only has a 2-second margin before the watchdog could trigger if traffic is momentarily disrupted.

See: https://github.com/BroadbandForum/obudpst/issues/16

## Solutions

### Solution 1: Use IPv6 Mode (Immediate Workaround)

IPv6 does not exhibit this termination pattern. If your server supports IPv6:
```bash
./udpst -d -p 25000 -t 100 -6 <server_ipv6_address>
```

In the Web GUI, select "IPv6" in the IP Version dropdown.

### Solution 2: Fix IPv4 Network Path

**Verify and fix firewall/NAT/conntrack:**
```bash
# Ensure ephemeral UDP ports are open bidirectionally
sudo ufw allow 32768:60999/udp

# Increase conntrack timeouts
sudo sysctl -w net.netfilter.nf_conntrack_udp_timeout=60
sudo sysctl -w net.netfilter.nf_conntrack_udp_timeout_stream=180

# Ensure conntrack table is not full
sudo sysctl -w net.netfilter.nf_conntrack_max=262144

# Disable any NAT/masquerade on the test path if possible
# Check for carrier-grade NAT (CGNAT) between client and server

# Verify socket buffers
sudo sysctl -w net.core.rmem_max=134217728
sudo sysctl -w net.core.wmem_max=134217728
```

### Solution 3: Obtain a Verified Binary

**Option A: Compile from source on matching platforms**
```bash
git clone https://github.com/BroadbandForum/obudpst.git
cd obudpst

# Ensure system time is correct
date

# Compile
cmake -DCMAKE_BUILD_TYPE=Release .
make

# Verify
./udpst -V
```

Compile both client and server on the same platform/architecture to avoid struct padding issues (upstream issue #24).

**Option B: Download official release**
```bash
# Check UDPST project repository for stable releases
wget https://github.com/BroadbandForum/obudpst/releases/download/vX.X.X/udpst
chmod +x udpst
```

### Solution 4: Run Multiple Short Tests

While diagnosing the root cause, collect data in 5-second chunks:
```bash
# Instead of one 100-second test:
for i in {1..20}; do
  ./udpst -d -t 5 10.50.3.1
  sleep 1
done
```

5-second tests complete before the termination pattern triggers (~3 seconds of data + 3 second watchdog = 6 seconds needed to trigger).

## Using the Web GUI

### Web GUI Features for This Issue

1. **Early Termination Detection**: Automatically detects the 5-7 interval IPv4 pattern
2. **Partial Result Success**: Tests with 5+ valid intervals are marked "completed_partial" or "completed_warnings" instead of "failed"
3. **Actionable Error Messages**: Identifies the pattern and suggests checking firewall/NAT/conntrack and trying IPv6
4. **Diagnostics Page**: Tools to verify network config and binary info

### Interpreting Test Results

When you see:
```
Status: completed_partial
Warning: Test collected 6 intervals of data before the UDPST no-traffic watchdog
terminated the connection. This IPv4 early termination pattern may be caused by
firewall/NAT/conntrack issues or a binary defect. Try IPv6 mode.
```

**This means:**
- The 6 seconds of data collected is valid and displayed
- The connection was terminated by the TIMEOUT_NOTRAFFIC watchdog (3s of silence)
- Something stopped UDP traffic on the IPv4 path at ~second 3-6
- IPv6 mode is a verified workaround

### Using Diagnostics Page

1. Navigate to **Diagnostics** in the Web GUI
2. Click **Binary Info** tab
   - Check for future build date warning
   - Verify optimizations are present
   - Note protocol version for compatibility checks
3. Click **System Config** tab
   - Verify ephemeral ports (should be 32768-60999)
   - Verify socket buffers (should be >= 2MB)
   - Check conntrack settings
4. Click **Quick Test** tab
   - Run a 5-second test to verify basic connectivity
   - Compare IPv4 vs IPv6 results

## FAQ

**Q: Why does netcat (nc) not work for testing UDP?**

A: Netcat sends/receives raw UDP packets without implementing the UDPST protocol. UDPST requires specific message formats (control setup, load adjustment, measurement), PDV feedback, and bidirectional communication with timing requirements. Use `./udpst` CLI or the Web GUI "Quick Test" feature instead.

**Q: The Web GUI says "ErrorStatus 200" - is that success?**

A: No. ErrorStatus 0 = success. ErrorStatus 200 = "minimum required connections unavailable". However, if valid data was collected, the Web GUI treats this as "partial success" and displays the results.

**Q: Can I increase TIMEOUT_NOTRAFFIC to fix this?**

A: Increasing the timeout would delay the termination but would not fix the underlying cause of traffic loss. The 3-second timeout is a reasonable watchdog value. If traffic genuinely stops for 3 seconds during a speed test, something is wrong with the network path or the binary. Fix the root cause instead.

**Q: Why does the server log show "Connection from X.X.X.X lost"?**

A: When the client stops sending acknowledgments (either because its watchdog fired, or because return traffic is being dropped), the server detects a lost connection. Check both directions of the IPv4 UDP path.

**Q: Why does IPv6 work but IPv4 does not?**

A: IPv6 typically bypasses several IPv4-specific network layers: NAT (IPv6 generally uses end-to-end addressing), conntrack state tracking (less aggressive for IPv6), and IPv4-specific firewall rules. Additionally, some binary bugs or struct padding issues may only manifest in IPv4 code paths.

## Verification Steps

After applying a fix, verify it works:

### 1. Check Binary Info
```bash
./udpst -V
# Verify: build date is reasonable, protocol version >= 10, optimizations present
```

### 2. Run Extended IPv4 Test
```bash
./udpst -d -t 30 -f json YOUR_SERVER_IP
```

Check the output:
```json
{
  "TestIntTime": 30,
  "IncrementalResult": [
    // Should see ~30 entries, not just 5-7
  ]
}
```

### 3. Compare IPv4 vs IPv6
```bash
# IPv4
./udpst -d -t 10 -f json SERVER_IPV4
# IPv6
./udpst -d -t 10 -f json -6 SERVER_IPV6
# Both should produce ~10 intervals
```

## Additional Resources

- **UDPST Project**: https://github.com/BroadbandForum/obudpst
- **Upstream Issue #16**: Minimum test interval (5s) and TIMEOUT_NOTRAFFIC context
- **Upstream Issue #14**: Client/server version compatibility
- **Upstream Issue #24**: Cross-platform struct padding inconsistency
- **Protocol Documentation**: See `API_SPECIFICATION.md` in project root
- **Network Setup Guide**: See `QUICKSTART.md` in project root
- **Web GUI Logs**: `/path/to/project/backend/logs/`

## Summary

- **Pattern**: IPv4 tests terminate after ~6 seconds (5-7 intervals), IPv6 works fine
- **Mechanism**: UDPST `TIMEOUT_NOTRAFFIC` watchdog (3s) fires after traffic stops flowing
- **Possible causes**: IPv4 firewall/NAT/conntrack, binary build defect, cross-platform struct padding, version mismatch
- **Immediate fix**: Use IPv6 mode
- **Diagnosis**: Check conntrack state, firewall rules, NAT configuration on IPv4 path
- **Web GUI**: Detects this pattern automatically, shows partial results, suggests solutions
