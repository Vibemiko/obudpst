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
    echo -e "${GREEN}[OK]${NC} ${1}"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} ${1}"
}

print_error() {
    echo -e "${RED}[ERR]${NC} ${1}"
}

echo -e "${BLUE}"
echo "=========================================="
echo "  OB-UDPST Web GUI - First-Time Install"
echo "=========================================="
echo -e "${NC}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

print_step "Setting executable permissions on all shell scripts..."
chmod +x *.sh 2>/dev/null || true
chmod +x backend/*.sh 2>/dev/null || true
print_success "Script permissions set (chmod +x)"

print_step "Checking for .env file..."
if [ -f ".env" ]; then
    print_success ".env file already exists - skipping copy"
else
    if [ -f ".env.example" ]; then
        cp .env.example .env
        print_success ".env created from .env.example"
        print_warning "Please edit .env and set your SUPABASE_URL and SUPABASE_ANON_KEY before starting"
    else
        print_warning ".env.example not found - you will need to create .env manually"
    fi
fi

print_step "Checking for udpst binary..."
if [ -f "./udpst" ] && [ -x "./udpst" ]; then
    print_success "udpst binary found and is executable"
elif [ -f "./udpst" ]; then
    chmod +x ./udpst
    print_success "udpst binary found - set executable permission"
else
    print_warning "udpst binary not found - attempting to build from source..."

    if ! command -v cmake &>/dev/null; then
        print_warning "cmake not found. Install it with: sudo apt-get install cmake"
        print_warning "Skipping udpst build. You can build manually later:"
        echo "  cmake ."
        echo "  make"
    else
        echo ""
        echo "  Building udpst with cmake..."
        if cmake . -B build_tmp -DCMAKE_BUILD_TYPE=Release 2>&1; then
            if cmake --build build_tmp 2>&1; then
                if [ -f "build_tmp/udpst" ]; then
                    cp build_tmp/udpst ./udpst
                    chmod +x ./udpst
                    rm -rf build_tmp
                    print_success "udpst built and placed in project root"
                elif [ -f "./udpst" ]; then
                    chmod +x ./udpst
                    print_success "udpst built successfully"
                else
                    print_warning "Build succeeded but udpst binary location unclear - check build output"
                fi
            else
                print_warning "cmake build failed - try building manually:"
                echo "  cmake ."
                echo "  make"
            fi
        else
            print_warning "cmake configuration failed - trying legacy make..."
            if command -v make &>/dev/null; then
                if cmake . && make; then
                    if [ -f "./udpst" ]; then
                        chmod +x ./udpst
                        print_success "udpst built successfully using make"
                    else
                        print_warning "make completed but udpst binary not found in project root"
                    fi
                else
                    print_warning "make failed - you may need: sudo apt-get install cmake build-essential libssl-dev"
                fi
            else
                print_warning "make not found either. Install build tools with:"
                echo "  sudo apt-get install cmake build-essential libssl-dev"
            fi
        fi
    fi
fi

print_step "Setting up logging directories..."
if bash backend/setup-logging.sh; then
    print_success "Logging setup complete"
else
    print_warning "Logging setup encountered issues - check output above"
fi

print_step "Installing backend dependencies..."
cd backend
if npm install; then
    print_success "Backend dependencies installed"
else
    print_error "Failed to install backend dependencies"
    exit 1
fi
cd "$SCRIPT_DIR"

print_step "Installing frontend dependencies..."
cd frontend
if npm install; then
    print_success "Frontend dependencies installed"
else
    print_error "Failed to install frontend dependencies"
    exit 1
fi
cd "$SCRIPT_DIR"

print_step "Installing root dependencies..."
if npm install; then
    print_success "Root dependencies installed"
else
    print_error "Failed to install root dependencies"
    exit 1
fi

echo ""
echo -e "${GREEN}"
echo "=========================================="
echo "  Installation Complete!"
echo "=========================================="
echo -e "${NC}"
echo ""

if [ ! -f ".env" ] || grep -q "your_supabase_url_here" .env 2>/dev/null; then
    print_warning "IMPORTANT: Edit .env and configure your Supabase credentials before starting"
    echo ""
fi

echo "Next steps:"
echo "  1. Edit .env with your Supabase URL and keys (if not already done)"
echo "  2. Start the application:  bash start-local.sh"
echo "  3. Backend API available at:  http://localhost:3000"
echo "  4. Frontend UI available at:  http://localhost:5173"
echo ""
echo "Network note:"
echo "  The udpst server requires inbound UDP on port 25000 (control) AND"
echo "  the OS ephemeral UDP port range (32768-60999) for data connections."
echo "  If using UFW, run:"
echo "    sudo ufw allow 25000/udp"
echo "    sudo ufw allow 32768:60999/udp"
echo ""
