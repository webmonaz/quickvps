#!/usr/bin/env bash
# install.sh — Deploy quickvps binary and systemd service
set -euo pipefail

BINARY_SRC="${1:-quickvps-linux}"
BINARY_DST="/usr/local/bin/quickvps"
SERVICE_SRC="$(dirname "$0")/quickvps.service"
SERVICE_DST="/etc/systemd/system/quickvps.service"

if [[ $EUID -ne 0 ]]; then
  echo "Error: this script must be run as root (sudo)" >&2
  exit 1
fi

echo "Installing binary → $BINARY_DST"
cp "$BINARY_SRC" "$BINARY_DST"
chmod +x "$BINARY_DST"

echo "Installing systemd unit → $SERVICE_DST"
cp "$SERVICE_SRC" "$SERVICE_DST"

systemctl daemon-reload
systemctl enable quickvps
systemctl restart quickvps

sleep 1
if systemctl is-active --quiet quickvps; then
  echo "✓ quickvps is running"
else
  echo "✗ quickvps failed to start — check: journalctl -u quickvps" >&2
  exit 1
fi

# Print access URL
IP=$(ip -4 route get 8.8.8.8 2>/dev/null | awk '{print $7; exit}' || hostname -I | awk '{print $1}')
echo ""
echo "Access QuickVPS at: http://$IP:8080"
echo "Default credentials: admin / changeme"
echo "(Change credentials in $SERVICE_DST then: systemctl restart quickvps)"
