# Server Health Check Flow

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Web GUI (React)                              │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │                    ClientPage Component                     │   │
│  │                                                              │   │
│  │  ┌──────────────────────────────────────────────────────┐ │   │
│  │  │        ServerHealthCheck Component                    │ │   │
│  │  │                                                        │ │   │
│  │  │  [Server IP: 192.168.0.54]                           │ │   │
│  │  │  [Port: 25000]                                       │ │   │
│  │  │                                                        │ │   │
│  │  │  [Check Servers Button] ◄─ User clicks here         │ │   │
│  │  │                                                        │ │   │
│  │  └────────────────┬───────────────────────────────────┘ │   │
│  │                   │                                        │   │
│  └───────────────────┼────────────────────────────────────────┘   │
│                      │                                              │
└──────────────────────┼──────────────────────────────────────────────┘
                       │ POST /api/health/check-servers
                       │ { servers: ["192.168.0.54"], port: 25000 }
                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Backend API (Express)                             │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │           routes.js - Health Check Endpoints                │   │
│  │                                                              │   │
│  │  POST /api/health/check-server                             │   │
│  │  POST /api/health/check-servers  ◄─ Request arrives here  │   │
│  │                                                              │   │
│  └────────────────┬───────────────────────────────────────────┘   │
│                   │                                                  │
│                   │ Call checkMultipleServers()                    │
│                   ▼                                                  │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │         health-check.js - Validation Service                │   │
│  │                                                              │   │
│  │  checkMultipleServers(["192.168.0.54"], 25000)            │   │
│  │         │                                                    │   │
│  │         ├─► checkServerReachability("192.168.0.54", 25000) │   │
│  │         │        │                                          │   │
│  │         │        ├─► pingHost("192.168.0.54")             │   │
│  │         │        │   ┌──────────────────────────────────┐ │   │
│  │         │        │   │  spawn("ping", ["-c", "1", ...]) │ │   │
│  │         │        │   │  Timeout: 2 seconds              │ │   │
│  │         │        │   │  Returns: true/false             │ │   │
│  │         │        │   └──────────────────────────────────┘ │   │
│  │         │        │                                          │   │
│  │         │        └─► checkTCPPort("192.168.0.54", 25000) │   │
│  │         │            ┌──────────────────────────────────┐ │   │
│  │         │            │  net.Socket.connect(25000, ...)  │ │   │
│  │         │            │  Timeout: 3 seconds              │ │   │
│  │         │            │  Returns: true/false             │ │   │
│  │         │            └──────────────────────────────────┘ │   │
│  │         │                                                    │   │
│  │         └─► generateRecommendation(result)                │   │
│  │                                                              │   │
│  └────────────────┬───────────────────────────────────────────┘   │
│                   │                                                  │
└───────────────────┼──────────────────────────────────────────────────┘
                    │ Return JSON response
                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Response Example                              │
│                                                                      │
│  {                                                                   │
│    "success": true,                                                 │
│    "allReachable": true,                                            │
│    "totalServers": 1,                                               │
│    "reachableServers": 1,                                           │
│    "unreachableServers": 0,                                         │
│    "servers": [                                                     │
│      {                                                               │
│        "host": "192.168.0.54",                                      │
│        "port": 25000,                                               │
│        "reachable": true,                                           │
│        "pingSuccessful": true,                                      │
│        "controlPortOpen": true,                                     │
│        "checks": [                                                  │
│          {                                                           │
│            "name": "Network Ping",                                  │
│            "passed": true,                                          │
│            "message": "Host 192.168.0.54 is reachable"             │
│          },                                                          │
│          {                                                           │
│            "name": "Control Port",                                  │
│            "passed": true,                                          │
│            "message": "Port 25000 is open and accepting..."        │
│          }                                                           │
│        ]                                                             │
│      }                                                               │
│    ]                                                                 │
│  }                                                                   │
│                                                                      │
└──────────────────┬───────────────────────────────────────────────────┘
                   │ Response rendered in UI
                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Web GUI Display                                 │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  ✓ All servers are reachable                                 │  │
│  │                                                                │  │
│  │  ┌──────────────────────────────────────────────────────┐   │  │
│  │  │  ✓ 192.168.0.54:25000              [Reachable]       │   │  │
│  │  │                                                        │   │  │
│  │  │  ✓ Network Ping: Host 192.168.0.54 is reachable      │   │  │
│  │  │  ✓ Control Port: Port 25000 is open and accepting... │   │  │
│  │  │                                                        │   │  │
│  │  └──────────────────────────────────────────────────────┘   │  │
│  │                                                                │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

## Detailed Check Sequence

### 1. Network Ping Test

```
┌─────────────────────────────────────────────────────────────────┐
│  pingHost("192.168.0.54")                                        │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  1. Detect IP version (IPv4 vs IPv6)                      │  │
│  │     - Contains ':'? → IPv6, use ping6                     │  │
│  │     - Otherwise → IPv4, use ping                          │  │
│  │                                                            │  │
│  │  2. Build platform-specific arguments                     │  │
│  │     Windows: ['-n', '1', '-w', '2000', host]             │  │
│  │     Unix:    ['-c', '1', '-W', '2', host]                │  │
│  │                                                            │  │
│  │  3. Spawn ping process                                    │  │
│  │     spawn(pingCmd, args, { stdio: 'pipe', timeout })     │  │
│  │                                                            │  │
│  │  4. Wait for result (max 2 seconds)                      │  │
│  │     - Exit code 0 → Host reachable                       │  │
│  │     - Exit code ≠ 0 → Host unreachable                   │  │
│  │     - Timeout → Host unreachable                         │  │
│  │                                                            │  │
│  │  5. Return: true (success) or false (failure)            │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Control Port Test

```
┌─────────────────────────────────────────────────────────────────┐
│  checkTCPPort("192.168.0.54", 25000)                             │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  1. Create TCP socket                                      │  │
│  │     const socket = new net.Socket()                       │  │
│  │                                                            │  │
│  │  2. Set timeout (3 seconds)                               │  │
│  │     socket.setTimeout(3000)                               │  │
│  │                                                            │  │
│  │  3. Attempt connection                                    │  │
│  │     socket.connect(25000, "192.168.0.54")                │  │
│  │                                                            │  │
│  │  4. Wait for events                                       │  │
│  │     ├─ 'connect' → Port open, return true                │  │
│  │     ├─ 'timeout' → Port not responding, return false     │  │
│  │     ├─ 'error'   → Connection failed, return false       │  │
│  │     └─ timeout   → No response, return false             │  │
│  │                                                            │  │
│  │  5. Cleanup                                               │  │
│  │     socket.destroy()                                      │  │
│  │     clearTimeout(timeoutId)                               │  │
│  │                                                            │  │
│  │  6. Return: true (port open) or false (port closed)      │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Decision Tree

```
                    User clicks "Check Servers"
                              │
                              ▼
                    Extract server list from input
                              │
                              ▼
                    For each server in parallel:
                              │
            ┌─────────────────┴─────────────────┐
            │                                   │
            ▼                                   ▼
    Run Network Ping Test           Run Control Port Test
            │                                   │
            ▼                                   ▼
      Ping successful?                  Port accessible?
        │         │                        │         │
       YES       NO                       YES       NO
        │         │                        │         │
        └─────────┴────────────────────────┴─────────┘
                              │
                              ▼
                  Combine results for server
                              │
                    ┌─────────┴─────────┐
                    │                   │
            Both tests pass?      At least one fails?
                    │                   │
                    ▼                   ▼
            reachable: true     reachable: false
                    │                   │
                    ▼                   ▼
         Generate success       Generate recommendations
              message             based on failure type
                    │                   │
                    └─────────┬─────────┘
                              ▼
                Return complete result to frontend
                              │
                              ▼
                    Display in UI with color coding
```

## Error Scenarios

### Scenario 1: Server Not Running

```
Checks:
✓ Network Ping: Success (host is reachable)
✗ Control Port: Failure (port 25000 closed)

Diagnosis:
- Network connectivity is OK
- Server process is not running OR
- Server is listening on wrong port OR
- Firewall is blocking port 25000

Recommendation:
"Start the UDPST server with:
 udpst -4 -x 192.168.0.54
 Also check firewall rules to allow port 25000"
```

### Scenario 2: Network Unreachable

```
Checks:
✗ Network Ping: Failure (host not reachable)
✗ Control Port: Failure (cannot connect)

Diagnosis:
- Host is offline OR
- IP address is incorrect OR
- Network routing issue OR
- Host firewall blocking ICMP

Recommendation:
"Verify IP address is correct and server is powered on.
 Check network connectivity with: ping 192.168.0.54"
```

### Scenario 3: Firewall Blocking

```
Checks:
✓ Network Ping: Success (host is reachable)
✗ Control Port: Failure (port 25000 closed)
AND server process is confirmed running

Diagnosis:
- Firewall is blocking port 25000

Recommendation:
"Check firewall rules:
 sudo ufw allow 25000/tcp
 sudo ufw allow 25000/udp"
```

## Performance Characteristics

- **Single server check**: 2-5 seconds
- **Multiple servers**: Runs in parallel, still 2-5 seconds
- **Network timeout**: 2 seconds (ping)
- **Port timeout**: 3 seconds (TCP connect)
- **Total timeout per server**: ~5 seconds maximum

## Integration Points

1. **User Input** → Health Check Component
2. **Health Check Component** → API Client
3. **API Client** → Backend Routes
4. **Backend Routes** → Health Check Service
5. **Health Check Service** → System (ping, TCP)
6. **Results** → API Response
7. **API Response** → Component State
8. **Component State** → UI Rendering
