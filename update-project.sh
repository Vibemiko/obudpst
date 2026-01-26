#!/bin/bash

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_step() {
    echo -e "${BLUE}==>${NC} ${1}"
}

print_success() {
    echo -e "${GREEN}✓${NC} ${1}"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} ${1}"
}

print_error() {
    echo -e "${RED}✗${NC} ${1}"
}

echo -e "${BLUE}"
echo "=========================================="
echo "  OB-UDPST Web GUI Update Script"
echo "=========================================="
echo -e "${NC}"

print_step "Checking for uncommitted changes..."
if [ -n "$(git status --porcelain)" ]; then
    print_warning "You have uncommitted changes. Stashing them..."
    git stash save "Auto-stash before update - $(date +%Y%m%d-%H%M%S)"
    STASHED=true
    print_success "Changes stashed"
else
    print_success "Working directory is clean"
    STASHED=false
fi

print_step "Clearing git cache..."
git rm -r --cached . 2>/dev/null || true
git reset --hard HEAD
print_success "Git cache cleared"

print_step "Fetching latest changes from repository..."
git fetch origin
CURRENT_BRANCH=$(git branch --show-current)
print_success "Current branch: ${CURRENT_BRANCH}"

print_step "Pulling latest changes..."
if git pull origin ${CURRENT_BRANCH}; then
    print_success "Successfully pulled latest changes"
else
    print_error "Failed to pull changes. Please resolve conflicts manually."
    exit 1
fi

if [ "$STASHED" = true ]; then
    print_warning "You have stashed changes. To restore them later, run: git stash pop"
fi

print_step "Clearing npm cache..."
npm cache clean --force
print_success "npm cache cleared"

print_step "Removing all node_modules directories..."
rm -rf node_modules
rm -rf backend/node_modules
rm -rf frontend/node_modules
print_success "node_modules removed"

print_step "Clearing build artifacts..."
rm -rf frontend/dist
rm -rf frontend/.vite
rm -rf backend/dist
print_success "Build artifacts cleared"

print_step "Installing backend dependencies..."
cd backend
if npm install; then
    print_success "Backend dependencies installed"
else
    print_error "Failed to install backend dependencies"
    exit 1
fi
cd ..

print_step "Installing frontend dependencies..."
cd frontend
if npm install; then
    print_success "Frontend dependencies installed"
else
    print_error "Failed to install frontend dependencies"
    exit 1
fi
cd ..

print_step "Installing root dependencies..."
if npm install; then
    print_success "Root dependencies installed"
else
    print_error "Failed to install root dependencies"
    exit 1
fi

print_step "Building frontend..."
if npm run build:frontend; then
    print_success "Frontend built successfully"
else
    print_error "Frontend build failed"
    exit 1
fi

echo ""
echo -e "${GREEN}"
echo "=========================================="
echo "  Update Completed Successfully!"
echo "=========================================="
echo -e "${NC}"
echo ""
print_success "Your project has been updated to the latest version"
echo ""
echo "Next steps:"
echo "  1. Review the CHANGELOG.md for changes"
echo "  2. Update your .env files if needed"
echo "  3. Start the backend: npm run start:backend"
echo "  4. Start the frontend: npm run start:frontend"
echo ""
if [ "$STASHED" = true ]; then
    print_warning "Remember to restore your stashed changes: git stash pop"
fi
echo ""
