#!/bin/bash

set -e

echo "=========================================="
echo "OB-UDPST Web GUI - Local Startup"
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

echo "Checking dependencies..."
if [ ! -d "backend/node_modules" ]; then
    echo "Installing backend dependencies..."
    cd backend && npm install && cd ..
fi

if [ ! -d "frontend/node_modules" ]; then
    echo "Installing frontend dependencies..."
    cd frontend && npm install && cd ..
fi

echo ""
echo "Starting OB-UDPST services..."
echo "Backend will be accessible on ${HOST:-0.0.0.0}:${PORT:-3000}"
echo "Frontend will be accessible on ${VITE_HOST:-0.0.0.0}:${VITE_PORT:-5173}"
echo ""
echo "Press Ctrl+C to stop both services"
echo "=========================================="
echo ""

trap 'kill $(jobs -p)' EXIT

cd backend && npm start &
cd frontend && npm run dev &

wait
