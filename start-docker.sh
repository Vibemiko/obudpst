#!/bin/bash

set -e

echo "=========================================="
echo "OB-UDPST - Docker Deployment"
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

if ! command -v docker &> /dev/null; then
    echo "Error: Docker is not installed or not in PATH"
    echo "Please install Docker: https://docs.docker.com/get-docker/"
    exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "Error: Docker Compose is not installed or not available"
    echo "Please install Docker Compose"
    exit 1
fi

echo "Building and starting Docker containers..."
echo ""
echo "Services:"
echo "  - Backend: http://localhost:3000"
echo "  - Frontend: http://localhost:80"
echo ""
echo "This will take a few minutes on first run..."
echo "=========================================="
echo ""

if docker compose version &> /dev/null; then
    docker compose up --build
else
    docker-compose up --build
fi
