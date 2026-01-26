# Logging Guide

## Overview

The OB-UDPST Web GUI backend uses Winston for structured logging with automatic log rotation. Logs are written to both console (for development) and files (for production).

## Log Locations

All backend logs are written to:
- **Directory**: `/var/log/udpst/`
- **Application logs**: `udpst-api-YYYY-MM-DD.log`
- **Error logs**: `udpst-api-error-YYYY-MM-DD.log`

## Log Levels

- **error**: Critical errors that require immediate attention
- **warn**: Warning conditions that should be reviewed
- **info**: General informational messages about application flow
- **debug**: Detailed information for debugging (disabled by default)

## Configuration

### Environment Variables

```bash
# Log directory (default: /var/log/udpst)
LOG_DIR=/var/log/udpst

# Log level (default: info)
# Options: error, warn, info, debug
LOG_LEVEL=info
```

### Setting Up Log Directory

1. Create the log directory:
```bash
sudo mkdir -p /var/log/udpst
sudo chown $USER:$USER /var/log/udpst
```

2. For production with systemd service:
```bash
sudo mkdir -p /var/log/udpst
sudo chown www-data:www-data /var/log/udpst
sudo chmod 755 /var/log/udpst
```

## Log Rotation

Winston automatically rotates logs daily with the following settings:

- **Rotation**: Daily (at midnight)
- **Retention**:
  - Application logs: 14 days
  - Error logs: 30 days
- **Max size per file**: 20MB
- **Compression**: Automatic after rotation

### Additional logrotate Configuration

For system-level logrotate, copy the configuration:

```bash
sudo cp backend/logrotate.conf /etc/logrotate.d/udpst-api
sudo chmod 644 /etc/logrotate.d/udpst-api
```

Test the configuration:
```bash
sudo logrotate -d /etc/logrotate.d/udpst-api
```

## What Gets Logged

### Application Startup
- Server initialization
- Configuration loaded
- Binary path validation
- Network interface binding

### API Requests
- All HTTP requests with:
  - Method and path
  - Status code
  - Response time
  - Client IP

### UDPST Operations
- Server start/stop
- Test execution start
- Test completion/failure
- Process lifecycle events
- Timeout events

### Database Operations
- Test creation
- Results storage
- Test deletion
- Query errors

### Errors
- Configuration errors
- Process spawn failures
- Database connection issues
- API errors
- Unhandled exceptions

## Log Format

```
YYYY-MM-DD HH:mm:ss [LEVEL]: message {"key":"value",...}
```

Example:
```
2026-01-26 15:30:42 [INFO]: Client test started {"testId":"test_1738000242123"}
2026-01-26 15:30:45 [INFO]: Test completed successfully {"testId":"test_1738000242123","throughput":945.23}
2026-01-26 15:31:10 [ERROR]: Test process error {"testId":"test_1738000270456","error":"Connection refused"}
```

## Viewing Logs

### Real-time monitoring:
```bash
# All logs
tail -f /var/log/udpst/udpst-api-$(date +%Y-%m-%D).log

# Errors only
tail -f /var/log/udpst/udpst-api-error-$(date +%Y-%m-%D).log
```

### Search for specific test:
```bash
grep "test_1738000242123" /var/log/udpst/udpst-api-*.log
```

### View last 100 lines:
```bash
tail -n 100 /var/log/udpst/udpst-api-$(date +%Y-%m-%D).log
```

### Filter by log level:
```bash
grep "\[ERROR\]" /var/log/udpst/udpst-api-*.log
grep "\[WARN\]" /var/log/udpst/udpst-api-*.log
```

## Development vs Production

### Development
- Logs to console with colors
- More verbose output
- Immediate feedback
- No log files (unless LOG_DIR is writable)

### Production
- Logs to console and files
- Structured JSON metadata
- Automatic rotation
- Long-term retention

## Troubleshooting

### Logs not being written to files

Check directory permissions:
```bash
ls -ld /var/log/udpst
# Should be writable by the user running the service
```

Check disk space:
```bash
df -h /var/log
```

Check application output:
```bash
# The logger prints initialization status to console
# Look for: "Logger initialized (level: info, directory: /var/log/udpst, file logging: true)"
```

### Log files growing too large

Adjust rotation settings in `backend/src/utils/logger.js`:
- Change `maxSize` (default: 20MB)
- Change `maxFiles` (default: 14d for app, 30d for errors)

### Missing log entries

Check log level:
```bash
# Set LOG_LEVEL=debug in .env for more verbose logging
LOG_LEVEL=debug npm start
```

## Best Practices

1. **Use appropriate log levels**:
   - `error` for failures requiring attention
   - `warn` for concerning but non-critical issues
   - `info` for normal application flow
   - `debug` for detailed troubleshooting

2. **Include context**:
   - Test IDs for correlation
   - Process IDs for tracking
   - User identifiers (when added)

3. **Monitor error logs**:
   - Set up alerting for error log entries
   - Review errors daily in production

4. **Regular cleanup**:
   - Old logs are automatically deleted
   - Monitor disk usage periodically

5. **Security**:
   - Never log sensitive data (passwords, keys)
   - Restrict log file permissions
   - Review logs for exposed information
