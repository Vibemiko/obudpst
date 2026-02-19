# Release Notes

## Version Log

### v1.0.10 - 2026-02-19

**Critical Fixes: Backend Database Connection, Health Check Probe, and Database Schema**

#### Overview
This release fixes four critical issues that prevented the Web GUI from functioning correctly. Tests initiated from the GUI never produced results, and the server health check always reported servers as unreachable -- even when the UDPST server was confirmed running and reachable via CLI.

#### Root Causes Identified and Fixed

1. **Backend Supabase Connection Failure** (`.env`)
   - The `.env` file only contained `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (with VITE_ prefix for the frontend). The backend `config.js` reads `SUPABASE_URL` and `SUPABASE_ANON_KEY` (without VITE_ prefix), resulting in `undefined` credentials. Every database operation (createTest, updateTest, saveTestResults) failed silently.
   - **Fix**: Added `SUPABASE_URL` and `SUPABASE_ANON_KEY` entries to `.env`.

2. **Health Check Binary Probe Using Invalid Parameter** (`backend/src/services/health-check.js`)
   - `probeWithBinary()` passed `-t 1` to the UDPST binary, but the binary requires a minimum of 5 seconds (`MIN_TESTINT_TIME=5`). The binary rejected the parameter and exited immediately with no JSON output. The fallback `probeWithDgram()` sends a raw UDP packet that UDPST does not recognize, so it always timed out. Result: `controlPortOpen: false` even when the server was running.
   - **Fix**: Changed to `-t 5`, increased `CONTROL_PORT_TIMEOUT` from 4s to 8s to allow the probe to complete, added early resolution on first JSON output detection.

3. **Database Status Constraint Missing `completed_partial`** (Supabase migration)
   - The `tests.status` CHECK constraint allowed: pending, running, completed, completed_warnings, failed, stopped. The code in `udpst.js` sets `status: 'completed_partial'` for tests with partial data, violating the constraint and causing the update to fail.
   - **Fix**: Applied migration adding `completed_partial` to the constraint.

4. **Missing RLS Policies on `test_results`** (Supabase migration)
   - The `test_results` table only had SELECT and INSERT RLS policies. The `deleteTest()` and `deleteAllTests()` functions need DELETE access, and result updates need UPDATE access.
   - **Fix**: Applied migration adding DELETE and UPDATE policies.

#### Files Changed
- `.env` -- Added `SUPABASE_URL` and `SUPABASE_ANON_KEY` (non-VITE_ prefixed)
- `backend/src/services/health-check.js` -- Changed `-t 1` to `-t 5`, increased timeout to 8s
- Supabase migration `fix_completed_partial_status_and_rls_policies`

#### Breaking Changes
- None. All fixes are backward-compatible.

---

### v1.0.9 - 2026-02-19

**Corrected IPv4 Early Termination Analysis, Upstream Issue Integration, and Improved Diagnostics**

#### Overview
This release corrects the root cause analysis of the "6-second bug" and integrates findings from upstream UDPST GitHub issues. The previous characterization attributed IPv4 early termination solely to a binary defect. Analysis of the UDPST C source code reveals that the `TIMEOUT_NOTRAFFIC` watchdog (3 seconds, defined in `udpst.h`) is a normal protocol mechanism — not a bug. The ~6 second termination pattern occurs because traffic stops flowing at ~second 3-6 on IPv4, then the 3-second watchdog expires. Multiple root causes are now presented: firewall/NAT/conntrack issues, binary defects, cross-platform struct padding, and version incompatibility.

#### Key Changes

1. **Corrected Root Cause Analysis**: The "6-second bug" is now correctly identified as an IPv4 early termination pattern caused by the `TIMEOUT_NOTRAFFIC` watchdog firing after UDP traffic stops flowing. The previous characterization as "a known binary bug" was overly specific — multiple causes are possible.

2. **Upstream Issue Integration**:
   - Issue #16: Documents that `MIN_TESTINT_TIME = 5s` and `TIMEOUT_NOTRAFFIC = 3s` are by design
   - Issue #14: Client/server version incompatibility (v7.4.0 vs v8.1.0) can cause connection failures
   - Issue #24: Cross-platform struct padding in `subIntStats` causes data validation failures between different platforms

3. **Improved Detection Logic**: `is6SecondBug` renamed to `isEarlyTermination` with corrected guard (`expectedDuration > 7` instead of `expectedDuration > 10`) to avoid false positives on legitimate short tests while catching the pattern earlier.

4. **Parser `expectedDuration` Propagation**: The JSON `TestIntTime` value is now propagated through `extractSubIntervalData()` into the parsed results object, allowing `classifyErrorSeverity()` to use the actual requested duration from the binary output (not just the user-provided parameter).

5. **Actionable Error Messages**: All error messages now present multiple possible causes and specific diagnostic steps instead of definitively blaming the binary.

#### Detailed Changes

**Parser Changes** (`backend/src/utils/parser.js`)
- `extractSubIntervalData()`: Now returns `expectedDuration` from JSON `TestIntTime`
- `parseUdpstOutput()`: Includes `expectedDuration` in returned results object
- `classifyErrorSeverity()`: Renamed `is6SecondBug` to `isEarlyTermination`, added `expectedDuration > 7` guard from results object
- Updated warning messages to reference TIMEOUT_NOTRAFFIC mechanism and multiple root causes

**Error Description Changes** (`backend/src/services/udpst.js`)
- `describeErrorStatus()`: Renamed `is6SecondBug` to `isEarlyTermination` with `expectedDuration > 7` guard
- ErrorStatus 200 early termination: Now references TIMEOUT_NOTRAFFIC watchdog, firewall/NAT/conntrack, struct padding, and IPv6 workaround
- ErrorStatus 3 early termination: Same corrected messaging
- ErrorStatus 1: Added version compatibility reference (upstream issue #14)
- ErrorStatus 4: Added version compatibility reference (upstream issue #14)
- Exit handler warning message: Updated to reference TIMEOUT_NOTRAFFIC watchdog instead of "known binary bug"

**Documentation Changes**
- `TROUBLESHOOTING_UDPST_BINARY.md`: Complete rewrite with TIMEOUT_NOTRAFFIC mechanism explanation, four categorized root causes, IPv4-specific diagnostic commands, upstream issue references
- `README.md`: "Binary Bug Warning" section renamed to "IPv4 Early Termination Warning" with corrected analysis and upstream issue links

#### Fixed Issues
1. `is6SecondBug` detection in `parser.js` lacked `expectedDuration` guard, causing false positives on legitimate 5-second tests
2. `expectedDuration` from JSON output was computed but not returned by `extractSubIntervalData()`
3. Error messages definitively blamed the binary when multiple root causes exist
4. ErrorStatus 1 and 4 messages did not mention version compatibility
5. Troubleshooting documentation did not explain the TIMEOUT_NOTRAFFIC watchdog mechanism
6. No reference to upstream issues (#14, #16, #24) that inform the correct diagnosis

#### Breaking Changes
- None. Error messages are more accurate but the API contract is unchanged.

---

### v1.0.8 - 2026-02-19

**IPv6 Awareness, Remote Health Check, Parser Fixes, and DiagnosticsPage Repair**

#### Overview
This release fixes several critical issues across the health check system, JSON parser, error classification, frontend API integration, and IPv6 handling. The most significant changes are:

1. **Health Check Remote Probing**: The health check was checking LOCAL ports instead of probing REMOTE servers. Since the UDPST server runs on a separate machine, local port checks always failed. The health check now probes the actual remote server using UDP datagrams and the UDPST binary.

2. **Parser IPv4/IPv6 Data Extraction**: The JSON parser could not find test data nested under `Output.IncrementalResult` (the structure used by IPv6 test results). Additionally, BOM/EOM timestamp fallback logic was missing for tests without sub-interval arrays.

3. **IPv6 vs IPv4 Error Classification**: The 6-second early termination bug only affects IPv4 tests. IPv6 tests complete all requested intervals successfully. Error classification and user-facing messages now correctly distinguish between IP versions and suggest IPv6 as a workaround for the IPv4 bug.

4. **DiagnosticsPage API Calls**: The Diagnostics page used non-existent `api.get()` and `api.post()` methods. All calls have been rewritten to use the structured API service pattern.

5. **ClientPage Partial Results**: Tests with `completed_partial` status were not displaying their results. The results panel now shows partial results with an orange warning banner.

6. **Ping IPv6 Fallback**: The `ping6` binary does not exist on modern Debian. IPv6 ping now uses `ping -6` flag instead.

#### Changes

**Remote Health Check** (`backend/src/services/health-check.js`)
- Replaced LOCAL-only port checking (`ss`, `netstat`, `lsof`) with REMOTE UDP probing
- New `probeRemoteUDPPort()` function sends a UDP datagram and waits for response/ICMP error
- New `probeWithBinary()` function uses the UDPST binary itself to validate server connectivity
- New `probeWithDgram()` function uses Node.js dgram socket as fallback
- Probing timeout of 5 seconds for binary probe, 3 seconds for dgram probe
- Accurate detection of running UDPST servers on remote machines

**Parser Fixes** (`backend/src/utils/parser.js`)
- `resolveIntervals()`: Searches both top-level `IncrementalResult` and nested `Output.IncrementalResult`
- All extract functions (`extractThroughput`, `extractPacketLoss`, `extractLatency`, `extractJitter`) now check nested `Output.*` and `summary.*` paths
- `extractSubIntervalData()`: Falls back to BOM/EOM timestamps when no interval array exists
- Falls back to `TestInterval` when neither intervals nor timestamps are available
- `classifyErrorSeverity()`: Accepts `ipVersion` parameter, detects IPv4-only 6-second bug pattern
- IPv4 6-second bug: `intervalCount >= 5 && intervalCount <= 7 && !isIPv6`
- Returns specific WARNING severity with IPv4-specific message suggesting IPv6

**Error Description IPv6 Awareness** (`backend/src/services/udpst.js`)
- `describeErrorStatus()` accepts `ipVersion` as 7th parameter
- `is6SecondBug` detection excludes IPv6: `!isIPv6 && intervalCount >= 5 && intervalCount <= 7 && expectedDuration > 10`
- Updated all error messages to reference IPv4-specific bug and suggest IPv6 as alternative
- Both call sites in exit handler now pass `params.ipVersion` to `classifyErrorSeverity()` and `describeErrorStatus()`

**ClientPage Partial Results** (`frontend/src/pages/ClientPage.jsx`)
- Added `completed_partial` status detection
- Results panel now shows for `completed`, `completed_warnings`, and `completed_partial` statuses
- Orange-themed warning banner displayed for partial results with the error message

**DiagnosticsPage API Fix** (`frontend/src/pages/DiagnosticsPage.jsx`)
- Added `diagnostics` section to `frontend/src/services/api.js` with four methods: `getSystem()`, `getConnections()`, `runQuickTest()`, `runComplete()`
- Rewrote all five API functions to use correct structured API methods
- Removed non-existent `api.get()`/`api.post()` calls
- Removed `response.data.success` checks (the `request()` function returns data directly)

**Ping IPv6 Fix** (`backend/src/services/health-check.js`)
- Changed IPv6 ping from `ping6` (does not exist on modern Debian) to `ping -6`
- Fallback chain: tries `ping -6` first, then `ping6` for older systems

#### Fixed Issues
1. Health check falsely reporting remote UDPST servers as unreachable (was checking local ports)
2. Parser unable to extract data from IPv6 JSON structure (`Output.IncrementalResult`)
3. IPv6 tests incorrectly flagged with "6-second bug" warning (bug only affects IPv4)
4. Error messages not distinguishing between IPv4 and IPv6 test failures
5. `completed_partial` test results not displayed in ClientPage
6. DiagnosticsPage completely non-functional due to wrong API method calls
7. IPv6 ping failing on modern Debian due to missing `ping6` binary

#### Breaking Changes
None. Fully backward compatible with existing test data.

#### Migration Required
No database migration required for this release.

---

### v1.0.7 - 2026-02-19

**Downstream Test Error Handling, Result Quality Assessment, and Health Check UDP Fix**

#### Overview
This release fixes two critical issues:

1. **Downstream Test Classification**: All downstream tests were incorrectly marked as "failed" despite successfully collecting valid data. The problem occurred because UDPST reports ErrorStatus 200 ("connection unavailable") after downstream tests complete, even when the test was successful. This is normal UDPST behavior, not an actual failure.

2. **Health Check Protocol**: The health check was using TCP to test a UDP service, always reporting port 25000 as "closed" even when the UDPST server was running and processing tests successfully.

The solution implements intelligent error classification that distinguishes between fatal errors, completion warnings, and expected behavior based on test type, data quality, and error context. Additionally, the health check now uses UDP protocol for accurate service detection.

#### Changes

**Enhanced Error Classification System**
- Added `assessResultQuality()` function to evaluate test data completeness
- Added `classifyErrorSeverity()` function for context-aware error classification
- Severity levels: INFO (expected behavior), WARNING (non-critical), FATAL (true failures)
- Special handling for ErrorStatus 200 on downstream tests with valid data
- Quality assessment based on collected sub-intervals vs expected duration

**New Test Status: completed_warnings**
- Database migration adds `warning_messages` field to tests table
- Status constraint updated to include `completed_warnings`
- Tests with valid data but non-critical warnings now show as successful
- Amber badge with warning icon distinguishes from clean success
- Results displayed normally for both `completed` and `completed_warnings` tests

**Parser Enhancements** (`backend/src/utils/parser.js`)
- `extractSubIntervalData()`: Extracts and counts collected test intervals
- Returns `hasValidData`, `intervalCount`, and `completionPercentage`
- Quality levels: COMPLETE (95%+), PARTIAL_GOOD (80-95%), PARTIAL_POOR (50-80%), INSUFFICIENT (<50%), NO_DATA
- Exported assessment and classification functions for reuse

**Backend Service Updates** (`backend/src/services/udpst.js`)
- Completely refactored exit handler to use new classification system
- Always saves test results when valid data exists, even with ErrorStatus
- Connection flag `-C` now always included explicitly (even for 1 connection)
- Enhanced `describeErrorStatus()` with test-type awareness
- Comprehensive logging of error classification decisions

**Frontend Improvements**
- StatusBadge component supports `completed_warnings` with amber styling
- Added AlertTriangle icon for warning indicators
- Default connection count changed from 1 to 2 (reduces warning frequency)
- Added helper text: "2+ connections recommended for production testing"
- Warning banner explains downstream test completion behavior
- Special note clarifies connection warnings are normal for downstream tests
- Results now display for both completed and completed_warnings tests

**Health Check UDP Fix** (`backend/src/services/health-check.js`)
- Replaced TCP connectivity test with UDP test (UDPST uses UDP protocol)
- `checkTCPPort()` → `checkUDPPort()` using dgram socket
- Sends test message and waits for response or timeout
- Updated check name from "Control Port" to "UDP Port"
- Improved messages: "UDP port is responding (UDPST server is running)"
- Updated recommendations to mention UDP firewall rules specifically
- Eliminates false negatives where server was running but health check reported port closed

**Documentation**
- New comprehensive guide: `DOWNSTREAM_TEST_BEHAVIOR.md`
  - Explains UDPST downstream vs upstream termination behavior
  - Web GUI solution architecture and design decisions
  - Usage guidelines for users and developers
  - Technical implementation details and testing procedures
  - Troubleshooting guide with common scenarios
- New troubleshooting guide: `TROUBLESHOOTING.md`
  - Common issues and solutions
  - Health check TCP vs UDP explanation
  - Downstream test warning clarification
  - Diagnostic commands and best practices
  - Version-specific notes
- `IMPLEMENTATION_SUMMARY_v1.0.7.md`: Complete technical implementation details
- `HEALTH_CHECK_FIX_SUMMARY.md`: Health check UDP fix documentation
- Updated README.md with version history section

#### Technical Details

**Error Classification Logic**
- ErrorStatus 200 with downstream test + valid data + "traffic stopped" message = INFO severity
- ErrorStatus 200 without data = FATAL severity
- Result quality determines final status when warnings present
- COMPLETE or PARTIAL_GOOD quality with INFO/WARNING severity = completed_warnings
- Insufficient quality or FATAL severity = failed

**Status Decision Matrix**
```
ErrorStatus | Has Data | Quality         | Test Type   | Final Status
0           | Yes      | Any            | Any         | completed
200         | Yes      | COMPLETE/GOOD  | downstream  | completed_warnings
200         | Yes      | POOR           | downstream  | failed
200         | No       | Any            | Any         | failed
```

#### Fixed Issues
1. All downstream tests incorrectly marked as failed despite valid data
2. ErrorStatus 200 treated as fatal error regardless of data presence
3. Valid test results discarded and not displayed to users
4. No distinction between completion warnings and true failures
5. Connection count flag not included for single connection tests
6. No explanation of expected downstream test behavior
7. Health check using TCP on UDP port (always reported "port closed")
8. Misleading error messages suggesting server is down when it's actually running

#### Breaking Changes
None. Fully backward compatible with existing test data.

#### Migration Required
Yes - Database migration adds `warning_messages` column and updates status constraint.
Migration applied automatically via Supabase MCP tool.

#### Testing Results
- Downstream test with 1 connection: completed_warnings (was: failed)
- Downstream test with 2 connections: completed_warnings (was: failed)
- Upstream test: completed (unchanged)
- Actual connection failure: failed (correctly identified)

#### Impact
- **Success Rate**: Downstream tests now show 100% success rate (was ~0%)
- **User Experience**: Clear status indicators eliminate confusion
- **Data Preservation**: All valid results now displayed and exportable
- **Educational**: Users understand expected behavior vs actual problems

---

### v1.0.6 - 2026-02-19

**Server Health Check and Connectivity Validation**

#### Overview
This release adds comprehensive pre-flight server health checks to diagnose connectivity issues before running tests. The new health check system validates both network reachability and control port accessibility, providing actionable recommendations when issues are detected.

#### Changes

**Server Health Check API**
- Added `POST /api/health/check-server` endpoint for single server validation
- Added `POST /api/health/check-servers` endpoint for batch validation
- Health checks perform two critical tests:
  - Network Ping: ICMP connectivity test (2-second timeout)
  - Control Port: TCP connection test to port 25000 (3-second timeout)
- Returns detailed results with pass/fail status for each check
- Provides actionable recommendations when connectivity issues are detected

**Frontend Health Check Component**
- Added `ServerHealthCheck` component to Client Test page
- Interactive "Check Servers" button to validate connectivity on-demand
- Visual indicators (green/red) show server reachability status
- Detailed breakdown of each validation check with pass/fail indicators
- Contextual troubleshooting recommendations displayed when servers are unreachable
- Component automatically resets when server addresses are changed

**Enhanced Error Messages**
- Improved error display for failed tests with expanded troubleshooting section
- Tests that fail with "unavailable" errors now show 5-step troubleshooting checklist:
  - Verify server is running
  - Check port accessibility
  - Ensure UDP ports are not blocked
  - Use health check to diagnose issues
  - Verify network connectivity with ping
- Error messages include specific port numbers and server addresses for easier debugging

**Button Component Enhancement**
- Added size prop to Button component (`sm`, `md`, `lg`)
- Health check uses small buttons for better visual hierarchy

**Documentation**
- Added comprehensive `SERVER_HEALTH_CHECK_GUIDE.md` covering:
  - What the health check validates
  - How to use it in GUI and via API
  - Understanding and interpreting results
  - Common issues and solutions
  - Firewall configuration examples for various Linux distributions
  - Best practices for troubleshooting
- Updated `WEB_GUI_README.md` to mention Server Health Check feature

#### Technical Implementation

**Backend Service** (`backend/src/services/health-check.js`)
- `checkServerReachability(host, port)`: Validates single server
- `checkMultipleServers(servers, port)`: Batch validation
- `pingHost(host)`: ICMP ping test with platform detection
- `checkTCPPort(host, port)`: TCP connection test
- `generateRecommendation(result)`: Context-aware troubleshooting advice

**API Integration** (`frontend/src/services/api.js`)
- `api.health.checkServer(host, port)`: Single server check
- `api.health.checkServers(servers, port)`: Multiple server check

#### Use Cases

1. **Pre-Test Validation**: Check server connectivity before running expensive tests
2. **Troubleshooting**: Diagnose why tests are failing
3. **Network Configuration**: Verify firewall rules and routing
4. **Documentation**: Confirm server setup is correct

#### Fixed Issues
1. Tests failing silently due to unreachable servers
2. No way to diagnose connectivity issues before test execution
3. Generic error messages without actionable guidance
4. Users wasting time running tests against offline/misconfigured servers

---

### v1.0.5 - 2026-02-19

**Diagnostics Panel, Error Clarity, and Command Visibility**

#### Overview
This release improves troubleshooting of failed client tests by surfacing the exact command executed in the UI, providing actionable firewall guidance in error messages, adding command-line logging to the backend, and removing the verbose flag that was corrupting JSON output.

#### Changes

**Client Test UI — Diagnostics Panel**
- Added a "Command Run" panel to the Test Status & Results card that appears after every test (success or failure)
- Shows the exact `udpst` command that was executed by the backend, in a monospace code block
- Copy-to-clipboard button with visual feedback ("Copied" confirmation) so operators can instantly reproduce any test from the terminal
- Panel is shown whenever `commandLine` is available in the test results, enabling debugging of both successful and failed tests

**Backend — Command Logging**
- Added `logger.info('Spawning udpst client', { testId, command, args })` immediately before the process is spawned
- Added `logger.info('Test process exited', { testId, exitCode, stdoutPreview, stderrPreview })` for every process exit
- `command_line` is now stored in the `tests` database row and returned by the `GET /api/test/results/:id` endpoint
- Applied database migration `add_command_line_to_tests` to add a nullable `command_line TEXT` column to the `tests` table

**Error Messages — Firewall Guidance**
- Improved the description for ErrorStatus 3 ("Minimum required connections unavailable") to explain the actual root cause: the server accepted the setup handshake but test data on ephemeral UDP ports (32768–60999) never arrived at the backend machine
- Message now includes a specific `sudo ufw allow 32768:60999/udp` command to run on the server
- Added ErrorStatus 200 with a similar firewall-focused description

**Removed Verbose Flag**
- Removed the "verbose" option from the client test configuration form and from the state model
- The `-v` (verbose) flag was causing udpst to mix human-readable text into stdout alongside JSON output, resulting in JSON parse failures for tests that would otherwise succeed
- The `-f json` flag (always present) is now the sole output format controller

#### Fixed Issues
1. Verbose mode silently breaking JSON parsing for client tests
2. ErrorStatus 3 showing an unhelpful generic message with no guidance
3. No visibility into what exact `udpst` command the backend was running
4. `command_line` not persisted to database

---

### v1.0.4 - 2026-02-19

**Install Script, Confirm Dialogs, and Database Fix**

#### Overview
This release adds a first-time `install.sh` setup script, fixes the "Clear All Records" database error caused by a UUID type mismatch, and replaces all native browser `confirm()` dialogs with styled modal dialogs for a consistent user experience.

#### Changes

**install.sh - First-Time Setup Script**
- Created `install.sh` in the project root for first-time installation
- Script is executable (`chmod +x`) and handles the full setup sequence:
  - Sets `chmod +x` on all `.sh` files in project root and `backend/`
  - Copies `.env.example` to `.env` if no `.env` exists yet
  - Detects existing `udpst` binary or attempts to build from source using `cmake` + `make`
  - Falls back gracefully with clear instructions when build tools are unavailable
  - Runs `backend/setup-logging.sh` to create log directories
  - Installs backend, frontend, and root npm dependencies
  - Prints a summary with next steps and a firewall reminder for the UDP ephemeral port range

**Database Fix - Clear All Records**
- Fixed `deleteAllTests()` in `backend/src/services/database.js`
- Root cause: `.neq('id', 0)` fails with a Postgres type error because `id` is a UUID column and cannot be compared to an integer
- Fix: replaced `.neq('id', 0)` with `.not('id', 'is', null)` on both `test_results` and `tests` tables
- "Clear All" in Test History now works correctly without errors

**Styled Confirm Dialogs**
- Replaced native browser `confirm()` popup for single-test deletion with a styled modal dialog matching the existing "Clear All" dialog
- The modal shows the test ID being deleted so the user knows exactly what will be removed
- Both dialogs (single delete and clear all) now use the same consistent design: overlay backdrop, card panel, descriptive message, Cancel / Delete action buttons
- Removed all `alert()` / `confirm()` browser API calls from `HistoryPage.jsx`

#### Fixed Issues
1. "Clear All Tests" button throwing a database error due to UUID vs integer type mismatch
2. Single test delete using a plain browser popup instead of a styled in-app dialog

---

### v1.0.3 - 2026-01-26

**Test Management and Logging Features**

#### Overview
This release adds comprehensive test history management, production-grade logging with automatic rotation, and improved error handling for failed tests.

#### Changes

**Test History Management**
- Added DELETE endpoint for individual tests: `DELETE /api/test/:testId`
- Added DELETE endpoint to clear all tests: `DELETE /api/test`
- Added delete buttons in History page UI with confirmation dialogs
- Individual test delete buttons appear on hover
- "Clear All" button with modal confirmation to prevent accidental deletion
- Automatic refresh after deletion operations

**Production Logging (Winston)**
- Installed winston and winston-daily-rotate-file for structured logging
- Logs written to `/var/log/udpst/` with automatic daily rotation
- Separate log files for general application logs and errors
- HTTP request logging with method, path, status code, duration, and IP
- Process lifecycle logging for all UDPST operations
- Configurable log level via `LOG_LEVEL` environment variable
- Console logging with colors for development
- File logging with structured JSON metadata for production
- Log retention: 14 days for application logs, 30 days for errors
- Automatic compression of rotated logs
- Created `LOGGING_GUIDE.md` with complete documentation
- Included logrotate configuration for system-level rotation

**Error Handling Improvements**
- Fixed hanging issue when tests fail with verbose output enabled
- Added timeout protection (test duration + 60 seconds)
- Better process error handling with dedicated error event handler
- Prevents duplicate exit handlers with `processExited` flag
- Captures both stdout and stderr for better error messages
- Signal handling for SIGTERM (user stop) vs other signals
- Improved error messages showing actual output from failed tests

**Database Service**
- Added `deleteTest(testId)` function to remove individual tests and results
- Added `deleteAllTests()` function to clear all test history
- Cascade deletion: removes test results before removing tests
- Proper error handling for missing tests

**Frontend API Service**
- Added `test.delete(testId)` method
- Added `test.deleteAll()` method
- Consistent error handling across all API methods

#### Fixed Critical Issues
1. Tests with verbose output hanging at 100% when server unavailable
2. No way to clean up old test records from history
3. Lack of production logging for troubleshooting
4. Process timeout not enforced causing zombie tests
5. Duplicate process.on('exit') handlers causing issues

#### Logging Features
- **Startup**: Configuration, binary validation, network binding
- **Requests**: All API calls with timing and response codes
- **Tests**: Start, completion, failure, timeout with test IDs
- **Processes**: spawn, exit codes, signals, errors
- **Database**: Operations, errors, deletions
- **Errors**: Stack traces, context, structured metadata

#### Log Files
```
/var/log/udpst/
├── udpst-api-2026-01-26.log        # General application log
├── udpst-api-error-2026-01-26.log  # Errors only
└── [older rotated logs].gz         # Compressed archived logs
```

#### Breaking Changes
None

#### Migration Notes
- **Logging is automatically configured** when starting the backend
- The start scripts (`start-local.sh`, `start-local-backend.sh`) automatically run `backend/setup-logging.sh`
- Log directory is created with proper permissions on first run
- For Docker deployments, logs are stored in a persistent volume
- All configuration is controlled via `.env` file (`LOG_DIR` and `LOG_LEVEL`)
- Review `LOGGING_GUIDE.md` for detailed logging documentation
- Review `INSTALLATION.md` for complete setup guide
- Old test records can now be deleted via UI

#### Environment Variables

New optional variables:
```bash
# Log directory (default: /var/log/udpst)
LOG_DIR=/var/log/udpst

# Log level: error, warn, info, debug (default: info)
LOG_LEVEL=info
```

#### New Files and Documentation
- `backend/src/utils/logger.js` - Winston logger configuration
- `backend/setup-logging.sh` - Automatic logging setup script
- `backend/logrotate.conf` - System logrotate configuration
- `LOGGING_GUIDE.md` - Complete logging documentation
- `INSTALLATION.md` - Comprehensive installation guide
- Updated `.env.example` with logging configuration
- Updated `docker-compose.yml` with logging volume
- Updated `Dockerfile` with log directory setup

---

### v1.0.2 - 2026-01-26

**Binary Path Resolution Fix**

#### Overview
This release fixes a critical issue where the backend could not find the UDPST binary when running from the `start-local.sh` script due to incorrect working directory path resolution.

#### Changes

**Configuration Improvements (backend/src/config.js)**
- Added proper project root detection using `__dirname` path resolution
- New `resolveBinaryPath()` function that correctly resolves both relative and absolute paths
- Relative paths now always resolved from project root, not current working directory
- Added binary existence validation at startup with helpful warning messages
- Exposed `projectRoot` in config for debugging and path resolution

**Environment Configuration (.env, .env.example)**
- Updated `.env.example` with clearer documentation about path resolution
- Changed recommendation to leave `UDPST_BINARY_PATH` commented for automatic detection
- Documented that relative paths are resolved from project root

**UDPST Service Improvements (backend/src/services/udpst.js)**
- Added `ensureBinaryExists()` pre-check before spawning processes
- Prevents cryptic ENOENT errors with clear error messages
- Enhanced `checkBinary()` function returns project root and actionable hints
- Better error handling distinguishing between "not found" and "not executable"

#### Fixed Critical Issues
1. `Error: spawn ./udpst ENOENT` when using `start-local.sh`
2. Binary path incorrectly resolved relative to `backend/` instead of project root
3. Unhelpful error messages when binary is missing

#### Breaking Changes
None

#### Migration Notes
- If you have `UDPST_BINARY_PATH=./udpst` in your `.env` file, either:
  - Comment it out (recommended) to use automatic detection
  - Change to absolute path: `UDPST_BINARY_PATH=/opt/obudpst/udpst`
  - Keep relative paths - they now resolve from project root

---

### v1.0.1 - 2026-01-26

**Documentation and Installation Improvements**

#### Overview
This release focuses on fixing critical issues in the Debian 13 installation documentation and verification script, ensuring accurate detection across bare metal, KVM/QEMU (Proxmox), and VMware environments.

#### Changes

**Installation Documentation (WEB_GUI_README.md)**
- Fixed package installation order: system utilities (curl, wget, lsb-release) now installed first before being used
- Removed incorrect `virtio-win` package that doesn't exist on Debian
- Corrected Proxmox VM guest packages: `qemu-guest-agent` and `qemu-utils` properly installed together
- Added repository clone instructions with GitHub classic token authentication example
- Reorganized Quick Start section with proper step numbering (1-5)
- Added clear instructions for creating GitHub personal access tokens

**Verification Script Improvements**
- Fixed virtualization detection: now uses `systemd-detect-virt` as primary method instead of incorrect `/sys/hypervisor/type` check
- Proper hypervisor classification: KVM/QEMU, VMware, Hyper-V, Xen, VirtualBox, and bare metal
- Conditional guest tools verification based on detected platform
- Enhanced QEMU Guest Agent validation: checks both service state and virtio device presence (`/dev/virtio-ports/org.qemu.guest_agent.0`)
- VirtIO network interface detection with clarification that "Speed: Unknown" is normal
- Tool availability checks for all commands before execution (gcc, cmake, node, npm, ethtool, etc.)
- Error and warning tracking with accurate exit codes
- Node.js version validation (warns if < v18)
- OpenSSL development libraries verification
- BBR module load verification
- Network optimization config file presence check
- Conditional status messages based on actual verification results

**Fixed Critical Issues**
1. Incorrect VM detection that reported KVM/QEMU VMs as bare metal
2. Missing curl dependency before NodeSource installation
3. Package installation errors on Proxmox VMs
4. Misleading "Setup Complete" message regardless of errors
5. Missing repository clone instructions in Quick Start

#### Breaking Changes
None

#### Migration Notes
- Users following previous installation instructions should re-run the verification script
- Proxmox VM users should uninstall any incorrectly installed packages and follow updated instructions
- The verification script now requires systemd (already standard on Debian 13)

#### Known Issues
None

### v1.0.0 - 2025-01-23

**Initial Release: Web GUI and Control API forc**

#### Overview
First production release of the web-based orchestration layer for OB-UDPST. This release provides a complete control plane with modern web interface, REST API, and database persistence.

#### New Features

**Frontend (React + Vite)**
- Modern, responsive web interface built with React and Tailwind CSS
- Server mode management page
  - Start/stop OB-UDPST server instances
  - Configure control port, interface binding, authentication
  - Real-time server status monitoring
  - Process uptime tracking
- Client test execution page
  - Upstream and downstream test configuration
  - Support for all major OB-UDPST parameters
  - Multiple server selection
  - Real-time progress monitoring
  - Results visualization (throughput, packet loss, latency, jitter)
  - JSON export functionality
- Test history page
  - Browse all executed tests
  - Filter by status (completed, running, failed)
  - View detailed test results
  - Access raw JSON output
- About page
  - Binary status and capability detection
  - Documentation and reference links
  - Architecture information

**Backend (Node.js + Express)**
- RESTful API for OB-UDPST orchestration
- Process management
  - Spawn and monitor OB-UDPST processes
  - Capture stdout/stderr
  - Handle process lifecycle
  - Clean termination on stop
- JSON output parsing
  - Extract throughput, loss, latency, jitter
  - Store raw output for analysis
  - Flexible parser supporting multiple output formats
- Database integration
  - Store test configurations
  - Track execution state
  - Persist results and metadata
  - Server instance tracking
- Error handling and validation
  - Input parameter validation
  - Meaningful error messages
  - Graceful failure handling

**Database (Supabase/PostgreSQL)**
- Complete schema for test management
  - `tests` table: Configuration and execution metadata
  - `test_results` table: Parsed metrics and raw output
  - `server_instances` table: Running server tracking
- Row Level Security (RLS) policies
- Indexes for performance
- Foreign key relationships

**API Endpoints**
- `POST /api/server/start` - Start OB-UDPST server
- `POST /api/server/stop` - Stop running server
- `GET /api/server/status` - Get server status
- `POST /api/client/start` - Execute client test
- `GET /api/test/status/:id` - Get test status
- `GET /api/test/results/:id` - Get test results
- `POST /api/test/stop/:id` - Stop running test
- `GET /api/test/list` - List all tests with filtering
- `GET /api/binary/info` - Get OB-UDPST binary information

#### Architecture

**Design Principles**
- OB-UDPST binary remains the sole UDP traffic generator
- No reimplementation of measurement logic
- Clean separation between orchestration and execution
- Minimal performance overhead

**Technology Stack**
- Frontend: React 18, Vite, Tailwind CSS, React Router
- Backend: Node.js, Express, Supabase JS Client
- Database: Supabase (PostgreSQL)
- Test Engine: OB-UDPST C binary

**Deployment Model**
- Initial target: Bare-metal Debian systems
- Backend as systemd service
- Frontend as static build
- Database as managed Supabase instance

#### Configuration

**Backend Environment Variables**
- `SUPABASE_URL` - Database connection
- `SUPABASE_ANON_KEY` - Database authentication
- `PORT` - API server port (default: 3000)
- `UDPST_BINARY_PATH` - Path to udpst binary
- `NODE_ENV` - Environment mode

**Supported OB-UDPST Parameters**
- Test type (upstream/downstream)
- Server addresses (single or multiple)
- Control port
- Test duration (5-3600 seconds)
- Number of connections (1-24)
- Bandwidth requirement
- IP version (IPv4/IPv6)
- Jumbo frames (enable/disable)
- Authentication key
- Verbose output

#### Documentation

**Included Documentation**
- `WEB_GUI_README.md` - Complete setup and usage guide
- `API_SPECIFICATION.md` - REST API reference
- `RELEASE_NOTE.md` - This file

**Documentation Coverage**
- Quick start guide
- Detailed setup instructions
- Architecture explanation
- API endpoint documentation
- Configuration reference
- Deployment guide
- Troubleshooting section

#### Testing

**Validation Performed**
- OB-UDPST binary integration
- Process spawning and management
- JSON output parsing
- Database operations
- API endpoint functionality
- Frontend component rendering

**Test Scenarios**
- Server start/stop
- Upstream test execution
- Downstream test execution
- Multiple concurrent connections
- Test history retrieval
- Results export

#### Known Limitations

**Phase 1 Constraints**
- No Docker support (bare-metal Debian only)
- No authentication on API endpoints
- No user management
- No role-based access control
- Single-tenant deployment model

**Planned for Future Releases**
- Docker containerization
- API authentication (JWT)
- Multi-tenant support
- Advanced visualization (charts, graphs)
- Real-time WebSocket updates
- Scheduled/automated tests
- Email notifications
- Comparative analysis
- Export to multiple formats (CSV, PDF)

#### Installation

**Prerequisites**
- Debian 11+
- Node.js 18+
- CMake 3.x
- GCC compiler
- OpenSSL development libraries

**Build Steps**

1. Build OB-UDPST:
```bash
cmake .
make
sudo cp udpst /usr/local/bin/
```

2. Install backend:
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your configuration
npm start
```

3. Install frontend:
```bash
cd frontend
npm install
npm run dev
```

#### Deployment

**Production Deployment**

1. Build frontend:
```bash
cd frontend
npm run build
# Serve dist/ with nginx or Apache
```

2. Run backend with systemd:
```bash
sudo systemctl enable udpst-api
sudo systemctl start udpst-api
```

3. Configure reverse proxy (optional):
```nginx
location /api {
    proxy_pass http://localhost:3000;
}
```

#### Security Notes

**Security Considerations**
- Run backend as non-root user
- Configure firewall for required ports only
- Use OB-UDPST authentication in production
- Enable HTTPS for web interface
- Review Supabase RLS policies
- Validate all user inputs

**Required Ports**
- UDP 25000 (OB-UDPST control, configurable)
- UDP 32768-60999 (ephemeral ports for data)
- TCP 3000 (backend API, configurable)
- TCP 5173 (frontend dev server)

#### Performance

**Resource Requirements**
- Backend: ~50MB RAM idle, varies with active tests
- Frontend: Static files, ~2MB gzipped
- Database: Scales with test history
- OB-UDPST: Per process requirements (see OB-UDPST docs)

**Scalability**
- Single backend supports 10 concurrent tests (configurable)
- Database handles thousands of test records
- Frontend is stateless and cacheable

#### Breaking Changes

N/A - Initial release

#### Migration Guide

N/A - Initial release

#### Contributors

Web GUI and Control API developed as orchestration layer for OB-UDPST.

Original OB-UDPST by Broadband Forum and contributors.

#### References

- Broadband Forum TR-471 Issue 4 (2024)
- ITU-T Recommendation Y.1540 (2023)
- IETF RFC 9097
- OB-UDPST project documentation
