# OB-UDPST Web Control API Specification

## Overview

REST API for orchestrating OB-UDPST binary execution, capturing results, and managing test configurations.

## Base URL

```
http://localhost:3000/api
```

## Authentication

Not implemented in Phase 1 (bare-metal Debian deployment).

## Endpoints

### 1. Start Server Mode

**POST** `/server/start`

Start OB-UDPST in server mode.

**Request Body:**
```json
{
  "port": 25000,
  "interface": "192.168.1.100",
  "daemon": false,
  "authKey": "",
  "verbose": true
}
```

**Response:**
```json
{
  "success": true,
  "processId": "server_1234567890",
  "pid": 12345,
  "message": "Server started successfully",
  "config": {
    "port": 25000,
    "interface": "192.168.1.100"
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Server already running",
  "code": "ALREADY_RUNNING"
}
```

### 2. Stop Server Mode

**POST** `/server/stop`

Stop running OB-UDPST server.

**Response:**
```json
{
  "success": true,
  "message": "Server stopped successfully"
}
```

### 3. Start Client Test

**POST** `/client/start`

Execute OB-UDPST client test.

**Request Body:**
```json
{
  "testType": "upstream",
  "servers": ["192.168.1.100"],
  "port": 25000,
  "duration": 10,
  "connections": 1,
  "interface": "",
  "ipVersion": "ipv4",
  "jumboFrames": true,
  "bandwidth": 1000,
  "verbose": true,
  "jsonOutput": true
}
```

**Response:**
```json
{
  "success": true,
  "testId": "test_1234567890",
  "status": "running",
  "message": "Test started successfully"
}
```

### 4. Get Test Status

**GET** `/test/status/:testId`

Get current status of a running test.

**Response:**
```json
{
  "success": true,
  "testId": "test_1234567890",
  "status": "running",
  "progress": 45,
  "startTime": "2025-01-23T10:30:00Z"
}
```

**Status values:**
- `pending`: Test queued but not started
- `running`: Test in progress
- `completed`: Test finished successfully
- `failed`: Test failed with error
- `stopped`: Test manually stopped

### 5. Get Test Results

**GET** `/test/results/:testId`

Retrieve test results (available after completion).

**Response:**
```json
{
  "success": true,
  "testId": "test_1234567890",
  "status": "completed",
  "results": {
    "throughput": 950.5,
    "packetLoss": 0.02,
    "latency": 15.3,
    "jitter": 2.1,
    "duration": 10,
    "connections": 1
  },
  "rawOutput": "{ ... JSON from OB-UDPST ... }",
  "completedAt": "2025-01-23T10:30:15Z"
}
```

### 6. Stop Running Test

**POST** `/test/stop/:testId`

Terminate a running test.

**Response:**
```json
{
  "success": true,
  "message": "Test stopped successfully"
}
```

### 7. List Tests

**GET** `/test/list`

Get list of all tests with optional filtering.

**Query Parameters:**
- `status`: Filter by status (running, completed, failed)
- `limit`: Number of results (default: 50)
- `offset`: Pagination offset

**Response:**
```json
{
  "success": true,
  "tests": [
    {
      "testId": "test_1234567890",
      "testType": "upstream",
      "status": "completed",
      "startTime": "2025-01-23T10:30:00Z",
      "duration": 10
    }
  ],
  "total": 150,
  "limit": 50,
  "offset": 0
}
```

### 8. Get Server Status

**GET** `/server/status`

Check if server mode is running.

**Response:**
```json
{
  "success": true,
  "running": true,
  "processId": "server_1234567890",
  "pid": 12345,
  "uptime": 3600,
  "config": {
    "port": 25000,
    "interface": "192.168.1.100"
  }
}
```

### 9. Get Binary Info

**GET** `/binary/info`

Get OB-UDPST binary information and availability.

**Response:**
```json
{
  "success": true,
  "available": true,
  "path": "/usr/local/bin/udpst",
  "version": "8.2.0",
  "capabilities": {
    "authentication": true,
    "gso": true,
    "jumboFrames": true
  }
}
```

## Error Codes

- `ALREADY_RUNNING`: Server or test already running
- `NOT_RUNNING`: Requested process not running
- `BINARY_NOT_FOUND`: OB-UDPST binary not found
- `INVALID_PARAMETERS`: Invalid request parameters
- `EXECUTION_FAILED`: Binary execution failed
- `INTERNAL_ERROR`: Server internal error

## OB-UDPST CLI Argument Mapping

### Server Mode
- `-p <port>`: Control port
- `-x`: Daemon mode
- `-a <key>`: Authentication key
- `-v`: Verbose output
- `<interface>`: Local IP address

### Client Mode
- `-u <server>`: Upstream test
- `-d <server>`: Downstream test
- `-p <port>`: Server control port
- `-C <count>`: Connection count
- `-t <time>`: Test duration (seconds)
- `-B <mbps>`: Bandwidth requirement
- `-4`: IPv4 only
- `-6`: IPv6 only
- `-j`: Disable jumbo frames
- `-f json`: JSON output format
- `-v`: Verbose output
