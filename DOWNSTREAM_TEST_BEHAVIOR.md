# Downstream Test Behavior and Error Handling

## Overview

This document explains the expected behavior of UDPST downstream tests and how the Web GUI handles the characteristic "connection unavailable" warnings that appear after test completion.

## Background

### UDPST Test Types

UDPST supports two test directions:

1. **Upstream (`-u`)**: Client sends data to server. Client controls the data flow and can cleanly terminate the connection.
2. **Downstream (`-d`)**: Client receives data from server. Server controls the data flow, leading to different termination behavior.

### The Downstream Termination Issue

When running downstream tests, UDPST consistently displays the following warnings after the test completes:

```
LOCAL WARNING: Incoming traffic has completely stopped [Server 192.168.0.54:25000]
ERROR: Minimum required connections (N) unavailable
```

**This is normal behavior, not an actual failure.**

#### Why This Happens

1. During a downstream test, the server sends UDP packets to the client
2. The client collects data for the configured test duration (e.g., 5 seconds)
3. After collecting all sub-intervals, the client expects the server to stop sending
4. The server terminates its send loop and closes the connection
5. The client detects the connection closure and reports "incoming traffic stopped"
6. UDPST exits with ErrorStatus 200 even though the test data is valid

This is a **cosmetic issue** in UDPST's client-server termination handshake for downstream tests. The test data collected during the test duration is completely valid and should be used.

### Upstream vs Downstream Completion

**Upstream tests complete cleanly:**
```
Upstream Summary Delivered(%): 100.00, Loss/OoO/Dup: 0/0/0, ...
Upstream Maximum Mbps(L3/IP): 893.76, ...
```

**Downstream tests show warnings:**
```
Sub-Interval[5](sec):   5, Delivered(%): 100.00, Loss/OoO/Dup: 0/0/0, ...
LOCAL WARNING: Incoming traffic has completely stopped [Server 192.168.0.54:25000]
ERROR: Minimum required connections (1) unavailable
```

**Both tests collected valid data!** The downstream warning is about connection cleanup, not data quality.

## Web GUI Solution

### Architecture

The Web GUI implements a comprehensive error classification system to distinguish between:

1. **Fatal errors** - No usable test data (true failures)
2. **Warnings** - Test completed with valid data but non-critical issues
3. **Info** - Expected behavior that appears as errors in UDPST output

### Key Components

#### 1. Result Quality Assessment (`backend/src/utils/parser.js`)

```javascript
export function assessResultQuality(results, expectedDuration)
```

Evaluates test data quality based on:
- Number of sub-intervals collected
- Expected vs actual interval count
- Data completeness percentage

Returns quality scores:
- `COMPLETE` (95%+ data collected)
- `PARTIAL_GOOD` (80-95% data)
- `PARTIAL_POOR` (50-80% data)
- `INSUFFICIENT` (<50% data)
- `NO_DATA` (no valid data)

#### 2. Error Severity Classification (`backend/src/utils/parser.js`)

```javascript
export function classifyErrorSeverity(errorStatus, errorMessage2, results, testType)
```

Classifies ErrorStatus codes based on context:

- **INFO**: Normal behavior (e.g., downstream completion warning with valid data)
- **WARNING**: Non-critical issues with usable data
- **FATAL**: True failures with no usable data

Special handling for ErrorStatus 200:
- If `testType === 'downstream'` AND `hasValidData === true` AND message contains "incoming traffic stopped"
  - Severity: **INFO**
  - Reason: Normal downstream test completion pattern
- If `hasValidData === false`
  - Severity: **FATAL**
  - Reason: True connection failure

#### 3. Enhanced Test Status

The database now supports three completion states:

- `completed` - Clean success, no warnings
- `completed_warnings` - Success with non-critical warnings
- `failed` - Failure with no usable data

#### 4. Frontend Display

The UI distinguishes between status types:

- **Green badge**: `completed` - Clean success
- **Amber badge with warning icon**: `completed_warnings` - Success with warnings
- **Red badge**: `failed` - True failure

For `completed_warnings` tests:
- Results are displayed normally
- Warning banner explains the situation
- Special note for downstream tests: "Connection warnings after downstream test completion are normal behavior"

## Usage Guidelines

### For Users

1. **Don't panic if you see downstream warnings** - Check if the test results are displayed. If they are, the test was successful.

2. **Use 2+ connections** - While 1 connection works, using 2 or more connections can reduce the frequency of connection warnings.

3. **Upstream tests are cleaner** - If you need to verify basic connectivity without warnings, run an upstream test first.

4. **Check the sub-intervals** - If you see 5 sub-intervals for a 5-second test, the test completed successfully regardless of warnings.

### For Developers

1. **Always check `hasValidData`** before treating ErrorStatus as fatal

2. **Consider test type** when interpreting errors - Downstream tests have different termination behavior

3. **Assess result quality** - A test with ErrorStatus 200 but COMPLETE quality should be treated as successful

4. **Preserve all data** - Save test results even when ErrorStatus is non-zero if data exists

## Configuration

### Connection Count

**Default**: 2 connections (changed from 1)

**Rationale**:
- 1 connection is valid but may increase warning frequency
- 2+ connections provide better connection stability
- Matches production testing best practices

**CLI flag**: Always include `-C` flag explicitly, even for 1 connection

### Status Threshold

Tests are marked `completed_warnings` if:
- ErrorStatus is 200 (or other warning codes)
- Result quality is COMPLETE or PARTIAL_GOOD (80%+ data collected)
- Error severity is INFO or WARNING

Tests are marked `failed` if:
- ErrorStatus is non-zero AND result quality is insufficient
- Error severity is FATAL
- No valid data was collected

## Technical Details

### Sub-Interval Data Extraction

The parser extracts sub-interval information from UDPST JSON output:

```javascript
function extractSubIntervalData(json) {
  // Check IncrementalResult array
  if (json.IncrementalResult && Array.isArray(json.IncrementalResult)) {
    intervalCount = json.IncrementalResult.length;
    hasData = intervalCount > 0;
  }

  // Calculate completion percentage
  const completionPercentage = (intervalCount / expectedDuration) * 100;
}
```

### Exit Handler Logic

The `proc.on('exit')` handler in `backend/src/services/udpst.js` now:

1. Parses UDPST output
2. Extracts ErrorStatus and ErrorMessage2
3. Assesses result quality based on expected duration
4. Classifies error severity based on test type and data presence
5. Determines final status (completed, completed_warnings, or failed)
6. Saves results if any valid data exists
7. Stores warning messages separately from fatal errors

### Database Schema

New field added to `tests` table:
- `warning_messages` (text) - Stores non-fatal warning context

Updated status constraint:
```sql
CHECK (status IN ('pending', 'running', 'completed', 'completed_warnings', 'failed', 'stopped'))
```

## Testing

### Verify Downstream Behavior

Run a simple downstream test:
```bash
/opt/obudpst/udpst -d -t 5 192.168.0.54 -4 -C 1
```

Expected output:
```
Sub-Interval[1-5]: 100% delivery, valid metrics
LOCAL WARNING: Incoming traffic has completely stopped
ERROR: Minimum required connections (1) unavailable
```

**In Web GUI**: Should show status `completed_warnings` with results displayed

### Verify Upstream Behavior

Run a simple upstream test:
```bash
/opt/obudpst/udpst -u -t 5 192.168.0.54 -4 -C 1
```

Expected output:
```
Sub-Interval[1-5]: 100% delivery, valid metrics
Upstream Summary Delivered(%): 100.00
```

**In Web GUI**: Should show status `completed` (clean success)

## Troubleshooting

### "Test shows completed_warnings but I want clean completion"

This is expected for downstream tests. You can:
1. Run upstream tests instead
2. Increase connection count to 2+
3. Accept that downstream warnings are cosmetic

### "Test marked as failed but I see sub-interval data in logs"

Check:
1. Was ErrorStatus 200 with valid sub-intervals? Should be completed_warnings
2. Check server logs - was server stable throughout test?
3. Verify result quality score - may need threshold adjustment

### "Web GUI shows different results than CLI"

The Web GUI applies intelligent error classification. The CLI shows raw UDPST output including cosmetic warnings. If the Web GUI shows results, the test was successful.

## References

- UDPST Protocol: See `udpst_protocol.h` for ErrorStatus codes
- Error Descriptions: See `describeErrorStatus()` in `backend/src/services/udpst.js`
- Parser Logic: See `backend/src/utils/parser.js`
- Frontend Status Display: See `frontend/src/components/StatusBadge.jsx`
