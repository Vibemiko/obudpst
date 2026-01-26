# OB-UDPST Web GUI and Control API

Production-grade web-based orchestration layer for the OB-UDPST (Open Broadband UDP Speed Test) command-line tool.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Detailed Setup](#detailed-setup)
- [Usage Guide](#usage-guide)
- [API Documentation](#api-documentation)
- [Project Structure](#project-structure)
- [Configuration](#configuration)
- [Deployment](#deployment)

## Overview

This project provides a complete web-based control plane for OB-UDPST, enabling:

- **Web GUI**: Modern React-based interface for configuring and executing tests
- **REST API**: Node.js backend for orchestrating OB-UDPST binary execution
- **Database**: Supabase (PostgreSQL) for storing test configurations and results
- **Real-time Monitoring**: Live test status updates and progress tracking
- **Results Visualization**: Charts and metrics display with export capabilities
- **Test History**: Complete audit trail of all executed tests

### Critical Design Principles

- OB-UDPST C binary is the ONLY component generating UDP traffic
- No reimplementation of timing, packet pacing, or measurement logic
- Clean separation between orchestration layer and test execution
- Minimal overhead on test performance

## Architecture

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│                 │         │                  │         │                 │
│  React Frontend │────────▶│  Node.js Backend │────────▶│  OB-UDPST       │
│  (Vite + Tailwind)        │  (Express API)   │         │  C Binary       │
│                 │         │                  │         │                 │
└─────────────────┘         └────────┬─────────┘         └─────────────────┘
                                     │
                                     ▼
                            ┌─────────────────┐
                            │                 │
                            │    Supabase     │
                            │   (PostgreSQL)  │
                            │                 │
                            └─────────────────┘
```

### Component Responsibilities

#### Frontend (React)
- User interface for test configuration
- Real-time status monitoring
- Results visualization and export
- Test history browsing

#### Backend (Node.js)
- REST API endpoints
- Request validation
- Process management (spawn/kill OB-UDPST)
- Output parsing and storage
- Database operations

#### OB-UDPST Binary
- UDP traffic generation
- Packet pacing and timing
- Measurement algorithms
- JSON output generation

#### Database (Supabase)
- Test configurations
- Execution metadata
- Results storage
- Historical data

## Prerequisites

### System Requirements

- **Operating System**: Debian 11+ (bare-metal or VM)
- **Node.js**: v18.x or higher
- **npm**: v9.x or higher
- **CMake**: 3.x or higher (for building OB-UDPST)
- **GCC**: For compiling OB-UDPST
- **OpenSSL Development Libraries**: For OB-UDPST authentication

### Hardware Requirements

#### OB-UDPST Binary (Core Testing Engine)

The OB-UDPST binary performs high-precision UDP traffic generation and measurement. Hardware requirements scale with test load:

**Minimum Configuration (1-10 Gbps testing):**
- **CPU**: 2 physical cores / 4 threads
- **CPU Instructions**: SSE4.2 or higher
- **Base Frequency**: 2.0 GHz minimum
- **Memory**: 512 MB RAM
- **Network**: 1 Gbps NIC with hardware timestamping support

**Recommended Configuration (10-40 Gbps testing):**
- **CPU**: 4 physical cores / 8 threads
- **CPU Instructions**: AVX or AVX2 (significantly improves packet processing)
- **Base Frequency**: 2.5 GHz or higher
- **Memory**: 2 GB RAM
- **Network**: 10 Gbps NIC with multi-queue support and hardware offload

**High-Performance Configuration (40+ Gbps testing):**
- **CPU**: 8+ physical cores / 16+ threads
- **CPU Instructions**: AVX2 or AVX-512 (optimal for packet operations)
- **Base Frequency**: 3.0 GHz or higher, boost to 4.0+ GHz
- **Memory**: 4+ GB RAM
- **Network**: 25/40/100 Gbps NIC with DPDK compatibility, SR-IOV support

**CPU Architecture Notes:**
- OB-UDPST benefits from modern x86-64 instruction sets for efficient packet manipulation
- **SSE4.2**: Basic support, adequate for gigabit testing
- **AVX/AVX2**: Recommended for multi-gigabit workloads, improves throughput by 20-40%
- **AVX-512**: Optimal for 40+ Gbps testing on supported platforms

#### Web GUI + Backend (Orchestration Layer)

The Node.js backend and React frontend have minimal overhead and can run alongside OB-UDPST:

**Minimum Configuration:**
- **CPU**: 1 physical core / 2 threads (can share with OB-UDPST on low-load systems)
- **CPU Instructions**: x86-64 baseline (no special requirements)
- **Memory**: 256 MB RAM
- **Storage**: 500 MB for Node.js runtime + application

**Recommended Configuration:**
- **CPU**: 2 physical cores (separate from OB-UDPST cores)
- **Memory**: 512 MB RAM
- **Storage**: 1 GB for logs and temporary files

#### Bare Metal Deployment

**Entry-Level Server (1-10 Gbps):**
- **Example**: Intel Xeon E3-1230 v3 or AMD Ryzen 5 3600
- **Cores**: 4 cores / 8 threads
- **Instructions**: AVX2
- **Base/Boost**: 3.3 GHz / 3.8 GHz
- **Memory**: 8 GB DDR4 ECC
- **NIC**: Intel X520 (10GbE)

**Mid-Range Server (10-40 Gbps):**
- **Example**: Intel Xeon E5-2630 v4 or AMD EPYC 7302P
- **Cores**: 8-16 cores / 16-32 threads
- **Instructions**: AVX2
- **Base/Boost**: 2.5 GHz / 3.5+ GHz
- **Memory**: 16-32 GB DDR4 ECC
- **NIC**: Mellanox ConnectX-4 (25/40GbE)

**High-End Server (40-100 Gbps):**
- **Example**: Intel Xeon Gold 6248R or AMD EPYC 7502
- **Cores**: 16-32 cores / 32-64 threads
- **Instructions**: AVX-512 (Intel) or AVX2 (AMD)
- **Base/Boost**: 3.0 GHz / 4.0+ GHz
- **Memory**: 64+ GB DDR4 ECC
- **NIC**: Mellanox ConnectX-5/6 (100GbE) or Intel E810 (100GbE)

#### Virtual Machine Deployment (Proxmox VE)

When running in VMs, CPU instruction set passthrough and core pinning are critical for performance:

**VM Configuration for 1-10 Gbps Testing:**
- **Host CPU Minimum**: Intel Sandy Bridge (2011+) or AMD Bulldozer (2011+)
- **vCPU**: 2-4 vCPUs with CPU pinning
- **CPU Type**: host or x86-64-v2-AES (enables AES-NI, AVX)
- **Memory**: 2 GB RAM
- **Network**: VirtIO with vhost-net or SR-IOV passthrough

**VM Configuration for 10-40 Gbps Testing:**
- **Host CPU Recommended**: Intel Haswell (2013+) or AMD Zen (2017+)
- **vCPU**: 4-8 vCPUs with dedicated core pinning
- **CPU Type**: host or x86-64-v3 (enables AVX2, BMI2, FMA)
- **Memory**: 4 GB RAM
- **Network**: SR-IOV VF passthrough (strongly recommended)
- **NUMA**: Pin VM to single NUMA node

**VM Configuration for 40+ Gbps Testing:**
- **Host CPU Required**: Intel Skylake-SP (2017+) or AMD Zen 2 (2019+)
- **vCPU**: 8-16 vCPUs with exclusive core reservation
- **CPU Type**: host (full instruction passthrough including AVX-512)
- **Memory**: 8+ GB RAM with hugepages enabled
- **Network**: SR-IOV or VFIO PCI passthrough (mandatory)
- **NUMA**: Strict NUMA pinning with local memory

**Proxmox CPU Type Selection:**
```
# For maximum performance (requires homogeneous cluster)
cpu: host

# For AVX2 support with migration compatibility
cpu: x86-64-v3

# For basic compatibility with AVX
cpu: x86-64-v2-AES

# Legacy systems (avoid if possible)
cpu: kvm64
```

**Critical VM Performance Settings:**
- Enable CPU pinning: prevents vCPU migration, reduces jitter
- Enable hugepages: improves memory performance for packet buffers
- Use SR-IOV or passthrough: bypasses virtual network stack overhead
- Disable CPU hotplug: ensures consistent performance
- Set CPU scheduler to performance mode on host

#### Socket/Core Allocation Examples

**Scenario 1: Dedicated Test Server (Bare Metal)**
- **CPU**: Dual Intel Xeon Silver 4214 (2×12 cores = 24 cores / 48 threads)
- **Allocation**:
  - Cores 0-15: OB-UDPST testing processes (Socket 0)
  - Cores 16-19: Web GUI + Backend (Socket 1)
  - Cores 20-23: System + monitoring (Socket 1)

**Scenario 2: Shared Hypervisor (Proxmox)**
- **CPU**: Single AMD EPYC 7402 (24 cores / 48 threads)
- **Allocation**:
  - VM 1 (OB-UDPST): 8 vCPUs pinned to cores 0-7
  - VM 2 (Web GUI): 2 vCPUs pinned to cores 8-9
  - Other VMs: cores 10-23

**Scenario 3: Multi-Tenant Environment**
- **CPU**: Dual Intel Xeon Gold 6248 (2×20 cores = 40 cores / 80 threads)
- **Allocation per tenant**:
  - OB-UDPST VM: 4-8 vCPUs (dedicated cores)
  - GUI/Backend: 1-2 vCPUs (can be shared)
  - Total: ~6-10 cores per isolated test environment

#### Network Interface Considerations

- **Driver Support**: Intel (ixgbe, i40e, ice), Mellanox (mlx4, mlx5)
- **Multi-Queue**: Enables parallel packet processing across cores
- **RSS/RPS**: Receive Side Scaling for load distribution
- **Hardware Offload**: TSO, GSO, GRO (can reduce CPU load)
- **Timestamping**: Hardware timestamps for precise measurements

#### Performance Scaling

| Test Speed | Min Cores | Rec Cores | Min RAM | Rec RAM | CPU Instructions |
|------------|-----------|-----------|---------|---------|-----------------|
| 1 Gbps     | 2         | 4         | 512 MB  | 1 GB    | SSE4.2          |
| 10 Gbps    | 4         | 8         | 1 GB    | 2 GB    | AVX             |
| 25 Gbps    | 6         | 12        | 2 GB    | 4 GB    | AVX2            |
| 40 Gbps    | 8         | 16        | 2 GB    | 4 GB    | AVX2            |
| 100 Gbps   | 16        | 32        | 4 GB    | 8 GB    | AVX-512         |

**Note**: Actual requirements depend on:
- Number of simultaneous connections
- Packet size (jumbo frames reduce CPU load)
- Test duration and logging verbosity
- Background system load

### Network Requirements

- Server: UDP port 25000 (default) + ephemeral ports (32768-60999)
- Backend API: TCP port 3000 (default)
- Frontend: TCP port 5173 (development) or as configured

### Debian 13 (Trixie) Installation

Complete package installation for both bare metal and virtualized environments.

#### Base System Packages (All Deployments)

```bash
# Update package list
sudo apt-get update

# Install essential system utilities first (needed for other installations)
sudo apt-get install -y \
    curl \
    wget \
    vim \
    nano \
    screen \
    tmux \
    rsync \
    lsb-release

# Install build essentials for OB-UDPST
sudo apt-get install -y \
    build-essential \
    cmake \
    gcc \
    g++ \
    make \
    pkg-config \
    git

# Install OpenSSL development libraries (required for OB-UDPST authentication)
sudo apt-get install -y \
    libssl-dev \
    openssl

# Install Node.js and npm (required for Web GUI + Backend)
# Option 1: From Debian repositories (may be older version)
sudo apt-get install -y nodejs npm

# Option 2: Install latest LTS from NodeSource (recommended)
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify Node.js version (should be v18.x or higher)
node --version
npm --version

# Install network utilities
sudo apt-get install -y \
    net-tools \
    iproute2 \
    ethtool \
    iperf3 \
    tcpdump \
    wireshark-common \
    netcat-openbsd

# Install performance monitoring tools
sudo apt-get install -y \
    htop \
    iotop \
    nethogs \
    iftop \
    sysstat \
    dstat
```

#### Network Performance Optimization Packages

```bash
# Install tools for network stack tuning
sudo apt-get install -y \
    tuned \
    irqbalance \
    numactl

# Install PCI utilities (useful for identifying NICs)
sudo apt-get install -y \
    pciutils \
    usbutils \
    lshw

# Enable performance governor (for bare metal)
sudo apt-get install -y cpufrequtils
echo 'GOVERNOR="performance"' | sudo tee /etc/default/cpufrequtils
sudo systemctl restart cpufrequtils

# Enable irqbalance for multi-core systems
sudo systemctl enable irqbalance
sudo systemctl start irqbalance
```

#### Bare Metal Specific Packages

```bash
# Hardware monitoring and sensors
sudo apt-get install -y \
    lm-sensors \
    smartmontools \
    dmidecode

# Detect hardware sensors
sudo sensors-detect --auto

# RAID utilities (if using hardware RAID)
sudo apt-get install -y \
    mdadm \
    lvm2

# NIC firmware and drivers (Intel)
sudo apt-get install -y \
    firmware-linux \
    firmware-linux-nonfree \
    firmware-misc-nonfree

# Enable hardware timestamping support
sudo ethtool -T eth0  # Replace eth0 with your interface
```

#### Proxmox VM Guest Packages

```bash
# Install QEMU Guest Agent and utilities (enables better VM management)
sudo apt-get install -y \
    qemu-guest-agent \
    qemu-utils

# Enable and start the agent
sudo systemctl enable qemu-guest-agent
sudo systemctl start qemu-guest-agent

# Verify guest agent is running
sudo systemctl status qemu-guest-agent

# Install cloud-init (optional, for automated provisioning)
sudo apt-get install -y cloud-init

# Disable unnecessary services to reduce overhead
sudo systemctl disable bluetooth.service
sudo systemctl disable cups.service
sudo systemctl disable avahi-daemon.service

# Optimize for VM environment
echo "# VM optimizations" | sudo tee -a /etc/sysctl.conf
echo "vm.swappiness = 10" | sudo tee -a /etc/sysctl.conf
echo "vm.dirty_ratio = 10" | sudo tee -a /etc/sysctl.conf
echo "vm.dirty_background_ratio = 5" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

#### VMware VM Guest Packages

```bash
# Install open-vm-tools (VMware guest utilities)
sudo apt-get install -y \
    open-vm-tools \
    open-vm-tools-desktop

# Enable and start VMware tools
sudo systemctl enable open-vm-tools
sudo systemctl start open-vm-tools

# Install VMware-specific network drivers (if needed)
sudo apt-get install -y linux-headers-$(uname -r)

# Verify VMware tools are running
sudo systemctl status open-vm-tools
```

#### Network Stack Optimization (All Deployments)

```bash
# Create network tuning configuration
sudo tee /etc/sysctl.d/99-udpst-network.conf <<EOF
# Network buffer sizes
net.core.rmem_max = 134217728
net.core.wmem_max = 134217728
net.core.rmem_default = 16777216
net.core.wmem_default = 16777216
net.ipv4.tcp_rmem = 4096 87380 67108864
net.ipv4.tcp_wmem = 4096 65536 67108864

# Network device queue length
net.core.netdev_max_backlog = 250000
net.core.netdev_budget = 3000
net.core.netdev_budget_usecs = 8000

# UDP buffer sizes
net.ipv4.udp_rmem_min = 8192
net.ipv4.udp_wmem_min = 8192

# Connection tracking (if needed)
net.netfilter.nf_conntrack_max = 1048576

# TCP optimizations
net.ipv4.tcp_congestion_control = bbr
net.ipv4.tcp_notsent_lowat = 16384
net.ipv4.tcp_slow_start_after_idle = 0

# Disable IPv6 (optional, if not used)
# net.ipv6.conf.all.disable_ipv6 = 1
# net.ipv6.conf.default.disable_ipv6 = 1

# Enable BBR congestion control
net.core.default_qdisc = fq
EOF

# Apply sysctl settings
sudo sysctl -p /etc/sysctl.d/99-udpst-network.conf

# Load BBR module
sudo modprobe tcp_bbr
echo "tcp_bbr" | sudo tee -a /etc/modules
```

#### NIC Driver Configuration (High-Performance)

```bash
# For Intel NICs (ixgbe, i40e, ice)
# Increase ring buffer sizes
sudo ethtool -G eth0 rx 4096 tx 4096

# Enable multi-queue (adjust based on CPU cores)
sudo ethtool -L eth0 combined 8

# Enable hardware offloads
sudo ethtool -K eth0 rx on tx on tso on gso on gro on

# Enable flow control (if supported)
sudo ethtool -A eth0 rx on tx on

# Create persistent configuration
sudo tee /etc/network/if-up.d/ethtool-tuning <<'EOF'
#!/bin/bash
IFACE=$1
if [ "$IFACE" = "eth0" ]; then
    /sbin/ethtool -G $IFACE rx 4096 tx 4096 2>/dev/null || true
    /sbin/ethtool -L $IFACE combined 8 2>/dev/null || true
    /sbin/ethtool -K $IFACE rx on tx on tso on gso on gro on 2>/dev/null || true
fi
EOF
sudo chmod +x /etc/network/if-up.d/ethtool-tuning
```

#### Firewall Configuration

```bash
# Install firewall (if not already installed)
sudo apt-get install -y ufw

# Allow SSH
sudo ufw allow 22/tcp

# Allow OB-UDPST server port
sudo ufw allow 25000/udp

# Allow backend API port
sudo ufw allow 3000/tcp

# Allow frontend port (development)
sudo ufw allow 5173/tcp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status verbose
```

#### Optional: Docker Support (for containerized deployment)

```bash
# Install Docker
sudo apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release

# Add Docker GPG key
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg | \
    sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Add Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/debian \
  $(lsb_release -cs) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine
sudo apt-get update
sudo apt-get install -y \
    docker-ce \
    docker-ce-cli \
    containerd.io \
    docker-buildx-plugin \
    docker-compose-plugin

# Add user to docker group
sudo usermod -aG docker $USER

# Enable Docker service
sudo systemctl enable docker
sudo systemctl start docker
```

#### Verification Steps

```bash
#!/bin/bash
# OB-UDPST Debian 13 Installation Verification Script
# This script validates the installation and detects the runtime environment

set +e
ERRORS=0
WARNINGS=0

echo "=========================================="
echo "OB-UDPST Installation Verification"
echo "=========================================="

# Check systemd availability
if ! command -v systemctl &> /dev/null; then
    echo "ERROR: systemd is not available. This script requires systemd."
    ERRORS=$((ERRORS + 1))
    exit 1
fi

# System Information
echo -e "\n=== System Information ==="
if command -v uname &> /dev/null; then
    uname -a
else
    echo "WARNING: uname not found"
    WARNINGS=$((WARNINGS + 1))
fi

if command -v lsb_release &> /dev/null; then
    lsb_release -a 2>/dev/null
else
    echo "WARNING: lsb_release not found. Install lsb-release package."
    WARNINGS=$((WARNINGS + 1))
    if [ -f /etc/os-release ]; then
        cat /etc/os-release
    fi
fi

# Hypervisor Detection (Primary Method)
echo -e "\n=== Virtualization Detection ==="
if command -v systemd-detect-virt &> /dev/null; then
    VIRT_TYPE=$(systemd-detect-virt)
    VIRT_EXIT=$?

    if [ $VIRT_EXIT -eq 0 ] && [ "$VIRT_TYPE" != "none" ]; then
        echo "Environment: Virtual Machine"
        echo "Hypervisor: $VIRT_TYPE"
        IS_VM=true

        case "$VIRT_TYPE" in
            kvm|qemu)
                echo "Platform: KVM/QEMU (likely Proxmox or libvirt)"
                PLATFORM="proxmox"
                ;;
            vmware)
                echo "Platform: VMware ESXi/Workstation"
                PLATFORM="vmware"
                ;;
            microsoft)
                echo "Platform: Microsoft Hyper-V"
                PLATFORM="hyperv"
                ;;
            xen)
                echo "Platform: Xen"
                PLATFORM="xen"
                ;;
            oracle)
                echo "Platform: Oracle VirtualBox"
                PLATFORM="virtualbox"
                ;;
            *)
                echo "Platform: Other ($VIRT_TYPE)"
                PLATFORM="other"
                ;;
        esac
    else
        echo "Environment: Bare Metal"
        IS_VM=false
        PLATFORM="baremetal"
    fi
else
    echo "ERROR: systemd-detect-virt not found. Cannot detect virtualization."
    ERRORS=$((ERRORS + 1))
    IS_VM=false
    PLATFORM="unknown"
fi

# CPU Information
echo -e "\n=== CPU Information ==="
if command -v lscpu &> /dev/null; then
    lscpu | grep -E "Model name|Architecture|CPU\(s\)|Thread|Core|Socket|Virtualization"

    echo -e "\n--- CPU Instruction Sets ---"
    AVAILABLE_INSTRUCTIONS=$(lscpu | grep -oE 'sse4_2|avx|avx2|avx512f' | sort -u | tr '\n' ' ')
    if [ -n "$AVAILABLE_INSTRUCTIONS" ]; then
        echo "Available: $AVAILABLE_INSTRUCTIONS"
    else
        echo "No advanced SIMD instructions detected (SSE4.2, AVX, AVX2, AVX-512)"
    fi

    if [ "$IS_VM" = true ]; then
        echo "NOTE: In virtualized environments, CPU features depend on hypervisor passthrough."
    fi
else
    echo "WARNING: lscpu not found"
    WARNINGS=$((WARNINGS + 1))
fi

# Memory Information
echo -e "\n=== Memory Information ==="
if command -v free &> /dev/null; then
    free -h
else
    echo "WARNING: free command not found"
    WARNINGS=$((WARNINGS + 1))
fi

# Network Interfaces
echo -e "\n=== Network Interfaces ==="
if command -v ip &> /dev/null; then
    ip link show

    echo -e "\n--- NIC Capabilities ---"
    if command -v ethtool &> /dev/null; then
        for iface in $(ls /sys/class/net/ 2>/dev/null | grep -v lo); do
            echo "Interface: $iface"

            DRIVER=$(readlink /sys/class/net/$iface/device/driver 2>/dev/null | xargs basename 2>/dev/null)
            if [ "$DRIVER" = "virtio_net" ] || [ "$DRIVER" = "virtio-pci" ]; then
                echo "  Driver: $DRIVER (VirtIO - virtualized NIC)"
                echo "  Note: Speed/Duplex may show 'Unknown' - this is normal for VirtIO"
            else
                echo "  Driver: ${DRIVER:-Unknown}"
            fi

            SPEED=$(ethtool $iface 2>/dev/null | grep "Speed:" | awk '{print $2}')
            DUPLEX=$(ethtool $iface 2>/dev/null | grep "Duplex:" | awk '{print $2}')
            LINK=$(ethtool $iface 2>/dev/null | grep "Link detected:" | awk '{print $3}')

            echo "  Speed: ${SPEED:-Unknown}"
            echo "  Duplex: ${DUPLEX:-Unknown}"
            echo "  Link: ${LINK:-Unknown}"
            echo "---"
        done
    else
        echo "WARNING: ethtool not found. Install ethtool package."
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo "WARNING: ip command not found"
    WARNINGS=$((WARNINGS + 1))
fi

# Build Tools Verification
echo -e "\n=== Build Tools ==="
if command -v gcc &> /dev/null; then
    echo "gcc: $(gcc --version | head -n1)"
else
    echo "ERROR: gcc not found. Install build-essential package."
    ERRORS=$((ERRORS + 1))
fi

if command -v g++ &> /dev/null; then
    echo "g++: $(g++ --version | head -n1)"
else
    echo "ERROR: g++ not found. Install build-essential package."
    ERRORS=$((ERRORS + 1))
fi

if command -v make &> /dev/null; then
    echo "make: $(make --version | head -n1)"
else
    echo "ERROR: make not found. Install build-essential package."
    ERRORS=$((ERRORS + 1))
fi

if command -v cmake &> /dev/null; then
    echo "cmake: $(cmake --version | head -n1)"
else
    echo "ERROR: cmake not found. Install cmake package."
    ERRORS=$((ERRORS + 1))
fi

# Node.js and npm
echo -e "\n=== Node.js & npm ==="
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "Node.js: $NODE_VERSION"

    NODE_MAJOR=$(echo $NODE_VERSION | sed 's/v\([0-9]*\).*/\1/')
    if [ "$NODE_MAJOR" -lt 18 ]; then
        echo "WARNING: Node.js < v18. Consider upgrading for best compatibility."
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo "ERROR: Node.js not found. Install nodejs package."
    ERRORS=$((ERRORS + 1))
fi

if command -v npm &> /dev/null; then
    echo "npm: $(npm --version)"
else
    echo "ERROR: npm not found. Install npm package."
    ERRORS=$((ERRORS + 1))
fi

# OpenSSL
echo -e "\n=== OpenSSL ==="
if command -v openssl &> /dev/null; then
    echo "OpenSSL: $(openssl version)"
else
    echo "ERROR: OpenSSL not found. Install openssl package."
    ERRORS=$((ERRORS + 1))
fi

if [ -f /usr/include/openssl/ssl.h ]; then
    echo "OpenSSL dev libraries: Installed"
else
    echo "ERROR: OpenSSL dev libraries not found. Install libssl-dev package."
    ERRORS=$((ERRORS + 1))
fi

# Hypervisor-Specific Guest Tools Verification
echo -e "\n=== Guest Tools Verification ==="
if [ "$IS_VM" = true ]; then
    case "$PLATFORM" in
        proxmox)
            echo "Detected Proxmox/KVM environment"

            if systemctl is-active --quiet qemu-guest-agent 2>/dev/null; then
                echo "✓ QEMU Guest Agent service: Active"

                if [ -e /dev/virtio-ports/org.qemu.guest_agent.0 ]; then
                    echo "✓ QEMU Guest Agent device: Present"
                else
                    echo "WARNING: QEMU Guest Agent service active but virtio device not found."
                    WARNINGS=$((WARNINGS + 1))
                fi
            elif systemctl list-unit-files qemu-guest-agent.service &>/dev/null; then
                echo "✗ QEMU Guest Agent: Installed but not active"
                WARNINGS=$((WARNINGS + 1))
            else
                echo "✗ QEMU Guest Agent: Not installed (recommended)"
                WARNINGS=$((WARNINGS + 1))
            fi
            ;;

        vmware)
            echo "Detected VMware environment"

            if systemctl is-active --quiet open-vm-tools 2>/dev/null; then
                echo "✓ VMware Tools (open-vm-tools): Active"
            elif systemctl list-unit-files open-vm-tools.service &>/dev/null; then
                echo "✗ VMware Tools: Installed but not active"
                WARNINGS=$((WARNINGS + 1))
            else
                echo "✗ VMware Tools: Not installed (recommended)"
                WARNINGS=$((WARNINGS + 1))
            fi
            ;;

        *)
            echo "Environment: $VIRT_TYPE"
            echo "No specific guest tools check for this hypervisor."
            ;;
    esac
else
    echo "Running on bare metal - guest tools not applicable"
fi

# Network Stack Optimization
echo -e "\n=== Network Optimization ==="
if command -v sysctl &> /dev/null; then
    echo "Current network buffer settings:"
    sysctl net.core.rmem_max net.core.wmem_max 2>/dev/null || echo "Not configured"

    echo -e "\nTCP congestion control:"
    sysctl net.ipv4.tcp_congestion_control 2>/dev/null || echo "Not configured"

    if lsmod | grep -q tcp_bbr 2>/dev/null; then
        echo "✓ BBR module: Loaded"
    else
        echo "✗ BBR module: Not loaded"
        WARNINGS=$((WARNINGS + 1))
    fi

    if [ -f /etc/sysctl.d/99-udpst-network.conf ]; then
        echo "✓ Network optimization config: Present"
    else
        echo "✗ Network optimization config: Not found"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo "WARNING: sysctl not found"
    WARNINGS=$((WARNINGS + 1))
fi

# Performance Tools
echo -e "\n=== Performance Monitoring Tools ==="
PERF_TOOLS=("htop" "iotop" "iftop" "nethogs" "tcpdump")
for tool in "${PERF_TOOLS[@]}"; do
    if command -v $tool &> /dev/null; then
        echo "✓ $tool: Installed"
    else
        echo "○ $tool: Not installed (optional)"
    fi
done

# Summary
echo -e "\n=========================================="
echo "VERIFICATION SUMMARY"
echo "=========================================="
echo "Environment: $PLATFORM"
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo "Status: ✓ ALL CHECKS PASSED"
    echo "System is ready for OB-UDPST installation."
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo "Status: ⚠ WARNINGS DETECTED ($WARNINGS)"
    echo "System is functional but has non-critical issues."
    exit 0
else
    echo "Status: ✗ ERRORS DETECTED"
    echo "Errors: $ERRORS | Warnings: $WARNINGS"
    echo "Please address the errors above before proceeding."
    exit 1
fi
```

**Save this script for easy re-verification:**

```bash
# Create the verification script
sudo tee /usr/local/bin/verify-udpst-install.sh > /dev/null <<'SCRIPT_EOF'
#!/bin/bash
# Copy the entire script above starting from "set +e" to the final "fi"
SCRIPT_EOF

# Make it executable
sudo chmod +x /usr/local/bin/verify-udpst-install.sh

# Run the verification
verify-udpst-install.sh
```

#### Post-Installation Notes

**For Bare Metal:**
- Disable CPU frequency scaling: `sudo cpupower frequency-set -g performance`
- Enable IOMMU in BIOS if using SR-IOV or DPDK
- Disable C-states in BIOS for consistent latency
- Consider isolating CPUs for OB-UDPST: add `isolcpus=0-7` to kernel command line

**For Proxmox VMs:**
- Set CPU type to `host` in VM configuration for instruction set passthrough
- Enable CPU pinning in Proxmox: `qm set <vmid> --cpuunits 1024 --cores 4 --vcpus 4`
- Add SR-IOV VF: `qm set <vmid> --hostpci0 01:10.0`
- Enable hugepages on host: `echo 2048 > /sys/kernel/mm/hugepages/hugepages-2048kB/nr_hugepages`

**For VMware VMs:**
- Set CPU reservation equal to allocation for consistent performance
- Disable memory ballooning if possible
- Use VMXNET3 adapter for best performance
- Enable hardware-assisted virtualization (VT-x/AMD-V)

## Quick Start

### 1. Clone the Repository

First, clone the OB-UDPST repository from GitHub. You can authenticate using a classic personal access token:

```bash
# Clone using HTTPS with classic token
# Replace YOUR_TOKEN with your GitHub classic personal access token
git clone https://<YOUR_TOKEN>@github.com/Vibemiko/obudpst.git

# Or clone using SSH (if you have SSH keys configured)
git clone git@github.com:Vibemiko/obudpst.git

# Navigate to the project directory
cd obudpst
```

**Note**: To create a GitHub classic personal access token:
1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Select the `repo` scope for full repository access
4. Generate and copy the token
5. Use it in the clone command above

### 2. Build OB-UDPST Binary

```bash
# Build the binary
cmake .
make
```

Verify the binary:
```bash
./udpst -?
```

### 3. Set Up Supabase

The database is already configured. Environment variables are available in the project.

### 4. Install and Run Backend

```bash
cd backend
npm install
```

**IMPORTANT - Environment Configuration:**

The backend requires its own `.env` file in the `backend/` directory. This file is NOT committed to Git (for security), so you must create it:

```bash
# Copy the example file
cp .env.example .env

# Edit with your Supabase credentials
nano .env
```

Configure the following variables in `backend/.env`:
```env
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
PORT=3000
UDPST_BINARY_PATH=../udpst
NODE_ENV=development
```

**Note**: The backend uses `backend/.env` (no `VITE_` prefix), while the frontend uses the root `.env` file (with `VITE_` prefix). These are separate files with different variables.

Start the backend:
```bash
npm start
```

### 5. Install and Run Frontend

```bash
cd frontend

npm install

npm run dev
```

Access the GUI at: http://localhost:5173

## Detailed Setup

### Building OB-UDPST on Debian

```bash
sudo apt-get update
sudo apt-get install -y build-essential cmake libssl-dev

cd /path/to/ob-udpst
cmake .
make

sudo cp udpst /usr/local/bin/
```

### Backend Configuration

The backend requires the following environment variables:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

PORT=3000

UDPST_BINARY_PATH=/usr/local/bin/udpst

NODE_ENV=production
```

### Frontend Configuration

The frontend proxies API requests to the backend. Update `vite.config.js` if needed:

```javascript
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
});
```

### Database Schema

The database schema is automatically created via Supabase migration. It includes:

- `tests`: Test configurations and execution metadata
- `test_results`: Parsed test results and raw JSON output
- `server_instances`: Running OB-UDPST server process tracking

## Usage Guide

### Starting a Server

1. Navigate to **Server** page
2. Configure:
   - Control port (default: 25000)
   - Interface IP (optional, leave empty for all interfaces)
   - Authentication key (optional)
   - Daemon mode (run in background)
   - Verbose output
3. Click **Start Server**

### Running a Client Test

1. Navigate to **Client Test** page
2. Select test type:
   - **Upstream**: Client to server
   - **Downstream**: Server to client
3. Configure parameters:
   - Server addresses (comma-separated for multiple)
   - Port (default: 25000)
   - Duration (5-3600 seconds)
   - Number of connections
   - Bandwidth requirement
   - IP version (IPv4/IPv6)
   - Jumbo frames (enable/disable)
4. Click **Start Test**
5. Monitor progress in real-time
6. View results when complete
7. Export results as JSON

### Viewing Test History

1. Navigate to **History** page
2. Filter by status (All, Completed, Running, Failed)
3. Click on any test to view details
4. Review metrics and raw output

## API Documentation

See [API_SPECIFICATION.md](./API_SPECIFICATION.md) for complete REST API documentation.

### Key Endpoints

```
POST   /api/server/start      - Start OB-UDPST server
POST   /api/server/stop       - Stop OB-UDPST server
GET    /api/server/status     - Get server status

POST   /api/client/start      - Start client test
GET    /api/test/status/:id   - Get test status
GET    /api/test/results/:id  - Get test results
POST   /api/test/stop/:id     - Stop running test
GET    /api/test/list         - List all tests

GET    /api/binary/info       - Get binary information
```

## Project Structure

```
.
├── backend/                    # Node.js backend
│   ├── src/
│   │   ├── api/
│   │   │   └── routes.js      # API route handlers
│   │   ├── services/
│   │   │   ├── database.js    # Supabase operations
│   │   │   └── udpst.js       # OB-UDPST process management
│   │   ├── utils/
│   │   │   └── parser.js      # JSON output parser
│   │   └── config.js          # Configuration loader
│   ├── server.js              # Express server entry point
│   ├── package.json
│   └── .env.example
│
├── frontend/                   # React frontend
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   │   ├── Button.jsx
│   │   │   ├── Card.jsx
│   │   │   ├── Input.jsx
│   │   │   ├── Select.jsx
│   │   │   └── StatusBadge.jsx
│   │   ├── pages/             # Page components
│   │   │   ├── ServerPage.jsx
│   │   │   ├── ClientPage.jsx
│   │   │   ├── HistoryPage.jsx
│   │   │   └── AboutPage.jsx
│   │   ├── services/
│   │   │   └── api.js         # API client
│   │   ├── App.jsx            # Main app component
│   │   ├── main.jsx           # Entry point
│   │   └── index.css          # Tailwind styles
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
│
├── supabase/
│   └── migrations/            # Database migrations
│
├── API_SPECIFICATION.md       # REST API documentation
├── WEB_GUI_README.md         # This file
└── [OB-UDPST C source files]
```

## Configuration

### Backend Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SUPABASE_URL` | Supabase project URL | Required |
| `SUPABASE_ANON_KEY` | Supabase anonymous key | Required |
| `PORT` | Backend API port | 3000 |
| `UDPST_BINARY_PATH` | Path to udpst binary | ./udpst |
| `NODE_ENV` | Environment mode | development |

### OB-UDPST Parameters

All OB-UDPST command-line parameters are supported via the GUI:

- Test type (upstream/downstream)
- Server addresses
- Control port
- Test duration
- Number of connections
- Bandwidth requirements
- IP version (IPv4/IPv6)
- Jumbo frames
- Authentication
- Verbose output

## Deployment

### Production Build

#### Backend

```bash
cd backend
npm install --production
NODE_ENV=production node server.js
```

#### Frontend

```bash
cd frontend
npm install
npm run build
```

Serve the `dist/` directory with a web server (nginx, Apache, etc.)

### Process Management

Use systemd or PM2 to manage the backend process:

**systemd service example** (`/etc/systemd/system/udpst-api.service`):

```ini
[Unit]
Description=OB-UDPST Control API
After=network.target

[Service]
Type=simple
User=udpst
WorkingDirectory=/opt/ob-udpst/backend
Environment=NODE_ENV=production
ExecStart=/usr/bin/node server.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable udpst-api
sudo systemctl start udpst-api
```

### Security Considerations

- Run backend and OB-UDPST processes as non-root user
- Configure firewall rules for required ports only
- Use authentication for OB-UDPST server
- Enable HTTPS for production deployments
- Restrict Supabase RLS policies for production
- Validate all user inputs

### Monitoring

- Backend logs: stdout/stderr or systemd journal
- Database: Supabase dashboard
- System resources: htop, iotop, nethogs
- OB-UDPST processes: ps, pgrep

## Troubleshooting

### Binary Not Found

**Error**: `BINARY_NOT_FOUND`

**Solution**:
```bash
which udpst
export UDPST_BINARY_PATH=/path/to/udpst
```

### Server Already Running

**Error**: `ALREADY_RUNNING`

**Solution**: Stop existing server first or check for stale processes:
```bash
pkill udpst
```

### Database Connection Failed

**Error**: `supabaseUrl is required` or `Configuration errors: SUPABASE_URL is required`

**Solution**:

This error occurs when the backend cannot find Supabase credentials. On Bolt.new, ensure that:

1. The `backend/.env` file exists (not just the root `.env`)
2. The file contains `SUPABASE_URL` and `SUPABASE_ANON_KEY` (without `VITE_` prefix)
3. The values match your Supabase project credentials

The backend looks for `.env` in its own directory (`backend/.env`), not the root directory. The root `.env` file with `VITE_*` variables is only for the frontend.

### Test Fails to Start

**Possible causes**:
- Server not running on specified port
- Network connectivity issues
- Firewall blocking UDP ports
- Invalid server address

**Debug steps**:
1. Check server status in GUI
2. Verify network connectivity: `ping <server>`
3. Check firewall: `sudo ufw status`
4. Test manually: `./udpst -d <server>`

## Version Log

For version history and changelog, see [RELEASE_NOTE.md](./RELEASE_NOTE.md).

**Current Version:** v1.0.0 (2025-01-23)

## License

This web GUI and control API are provided under the same BSD-3-Clause license as OB-UDPST.

## Support

For issues related to:
- **OB-UDPST core**: See original README.md
- **Web GUI/API**: Check API_SPECIFICATION.md and this guide
- **Supabase**: https://supabase.com/docs
