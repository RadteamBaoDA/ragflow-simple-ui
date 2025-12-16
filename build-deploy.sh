#!/bin/bash
set -e

echo "=========================================="
echo "Knowledge Base - Build & Deploy Script"
echo "=========================================="

# 1. Build applications locally
echo "Step 1: Building applications (Backend & Frontend)..."
npm install
npm run build:prod

# 2. Build Docker image for backend
echo "Step 2: Building Backend Docker image..."
cd be
npm install --production --prefix .
docker build -t knowledge-base-backend:latest .
cd ..
