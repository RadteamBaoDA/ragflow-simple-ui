#!/bin/bash
# ============================================================================
# Converter Worker — WSL start script
#
# Runs the document converter worker inside WSL (Ubuntu).
# Configuration is loaded from .env file by the Python worker.
#
# Prerequisites (run once in WSL):
#   sudo apt-get update && sudo apt-get install -y \
#     libreoffice-calc libreoffice-writer libreoffice-impress \
#     python3 python3-pip python3-uno
#   pip3 install --break-system-packages -r requirements.txt
# ============================================================================

set -e

# Resolve script directory (works even when called from Windows via wsl)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "============================================"
echo "  Document Converter Worker (WSL)"
echo "============================================"
echo "  Config:   .env"
echo "============================================"

# Check LibreOffice is available
if ! command -v libreoffice &> /dev/null; then
    echo ""
    echo "ERROR: LibreOffice not found in WSL."
    echo "Install it with:"
    echo "  sudo apt-get update && sudo apt-get install -y libreoffice-calc libreoffice-writer libreoffice-impress python3-uno"
    exit 1
fi

# Check Python dependencies
if ! python3 -c "import redis; import dotenv" &> /dev/null; then
    echo ""
    echo "Installing Python dependencies..."
    pip3 install --break-system-packages -r requirements.txt
fi

# Run the worker (config loaded from .env by python-dotenv)
echo ""
echo "Starting converter worker..."
exec python3 -m src.worker
