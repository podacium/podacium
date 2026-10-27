#!/bin/bash
set -euo pipefail

# Creates a 4GB swap file to replace the current 2GB.
# Run as root on the VPS.

SWAP_SIZE_GB=4
SWAP_FILE=/swapfile

echo "=== Swap Setup ==="
echo "Current swap:"
swapon --show || echo "No swap active"

echo "Disabling existing swap..."
swapoff -a 2>/dev/null || true

echo "Creating ${SWAP_SIZE_GB}GB swap file..."
dd if=/dev/zero of=$SWAP_FILE bs=1M count=$((SWAP_SIZE_GB * 1024)) status=progress
chmod 600 $SWAP_FILE
mkswap $SWAP_FILE
swapon $SWAP_FILE

echo "Adding to /etc/fstab if not present..."
grep -q "$SWAP_FILE" /etc/fstab || echo "$SWAP_FILE none swap sw 0 0" >> /etc/fstab

echo "Setting swappiness..."
sysctl vm.swappiness=10
echo "vm.swappiness=10" > /etc/sysctl.d/99-swap.conf

echo "Done. New swap:"
swapon --show
free -h
