#!/bin/bash
set -e

echo "=========================================="
echo "Knowledge Base - Build & Deploy Script"
echo "=========================================="

# 1. Build applications locally
echo "Step 1: install dependencies..."
npm i --only=production --verbose

# 2. Build Docker image for backend
echo "Step 2: Building Backend Docker image..."
docker build -t knowledge-base-backend:latest .
