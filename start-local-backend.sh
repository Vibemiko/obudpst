#!/bin/bash

set -e

echo "=========================================="
echo "OB-UDPST Backend - Local Startup"
echo "=========================================="
echo ""

if [ ! -f .env ]; then
    echo "Error: .env file not found!"
    echo "Please copy .env.example to .env and configure it."
    exit 1
fi

source .env

if [ -z "$SUPABASE_URL" ] || [ "$SUPABASE_URL" = "your_supabase_url_here" ]; then
    echo "Error: SUPABASE_URL not configured in .env file"
    exit 1
fi

if [ ! -d "backend/node_modules" ]; then
    echo "Installing backend dependencies..."
    cd backend && npm install && cd ..
fi

echo "Setting up logging..."
bash backend/setup-logging.sh
echo ""

echo "Starting backend server..."
echo "Backend will be accessible on ${HOST:-0.0.0.0}:${PORT:-3000}"
echo ""
echo "API endpoints:"
echo "  - Health check: http://${HOST:-0.0.0.0}:${PORT:-3000}/health"
echo "  - API base: http://${HOST:-0.0.0.0}:${PORT:-3000}/api"
echo ""
echo "Press Ctrl+C to stop"
echo "=========================================="
echo ""

cd backend && npm start
