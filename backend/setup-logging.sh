#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

source "$PROJECT_ROOT/.env" 2>/dev/null || true

LOG_DIR="${LOG_DIR:-/var/log/udpst}"

echo "Setting up logging..."
echo "Log directory: $LOG_DIR"

if [ -d "$LOG_DIR" ]; then
    if [ -w "$LOG_DIR" ]; then
        echo "✓ Log directory exists and is writable"
    else
        echo "⚠ Log directory exists but is not writable by current user"
        echo "  Attempting to fix permissions..."

        if sudo chown -R $USER:$USER "$LOG_DIR" 2>/dev/null; then
            echo "✓ Permissions fixed"
        else
            echo "⚠ Could not fix permissions. Logging will be console-only."
            echo "  Run: sudo chown -R $USER:$USER $LOG_DIR"
        fi
    fi
else
    echo "Creating log directory..."

    if mkdir -p "$LOG_DIR" 2>/dev/null; then
        echo "✓ Log directory created"
    else
        echo "⚠ Could not create log directory without sudo"
        echo "  Attempting with sudo..."

        if sudo mkdir -p "$LOG_DIR" && sudo chown -R $USER:$USER "$LOG_DIR"; then
            echo "✓ Log directory created with proper permissions"
        else
            echo "⚠ Could not create log directory. Logging will be console-only."
            echo "  Manually run: sudo mkdir -p $LOG_DIR && sudo chown -R $USER:$USER $LOG_DIR"
        fi
    fi
fi

if [ -f "$SCRIPT_DIR/logrotate.conf" ]; then
    echo ""
    echo "Optional: Install logrotate configuration for system-level log rotation"
    echo "  sudo cp $SCRIPT_DIR/logrotate.conf /etc/logrotate.d/udpst-api"
    echo "  sudo chmod 644 /etc/logrotate.d/udpst-api"
fi

echo ""
echo "Logging setup complete!"
echo "Logs will be written to: $LOG_DIR"
echo "Log level: ${LOG_LEVEL:-info}"
