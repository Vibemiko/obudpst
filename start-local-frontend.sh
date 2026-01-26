#!/bin/bash

set -e

echo "=========================================="
echo "OB-UDPST Frontend - Local Startup"
echo "=========================================="
echo ""

if [ ! -f .env ]; then
    echo "Error: .env file not found!"
    echo "Please copy .env.example to .env and configure it."
    exit 1
fi

source .env

if [ ! -d "frontend/node_modules" ]; then
    echo "Installing frontend dependencies..."
    cd frontend && npm install && cd ..
fi

echo "Starting frontend development server..."
echo "Frontend will be accessible on ${VITE_HOST:-0.0.0.0}:${VITE_PORT:-5173}"
echo ""

if [ -z "$VITE_API_URL" ]; then
    echo "Using Vite proxy to connect to backend at http://localhost:${PORT:-3000}"
    echo "Make sure the backend is running!"
else
    echo "Connecting to backend at: $VITE_API_URL"
fi

echo ""
echo "Press Ctrl+C to stop"
echo "=========================================="
echo ""

cd frontend && npm run dev
