#!/bin/bash

# Deploy PostgreSQL API endpoints to Vultr VM
# This script uploads the new API routes and restarts the service

set -e

VM_HOST="66.42.84.126"
VM_USER="root"
SSH_KEY="/tmp/vultr_ssh_key"
SERVICE_DIR="/opt/embedding-service"

echo "🚀 Deploying PostgreSQL API endpoints..."

# Upload new files
echo "📤 Uploading new routes..."
scp -i $SSH_KEY -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
    app/routes/documents.py \
    $VM_USER@$VM_HOST:$SERVICE_DIR/app/routes/

scp -i $SSH_KEY -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
    app/services/database.py \
    $VM_USER@$VM_HOST:$SERVICE_DIR/app/services/

scp -i $SSH_KEY -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
    app/main.py \
    $VM_USER@$VM_HOST:$SERVICE_DIR/app/

# Install psycopg2 if not already installed
echo "📦 Installing PostgreSQL driver..."
ssh -i $SSH_KEY -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
    $VM_USER@$VM_HOST \
    "cd $SERVICE_DIR && source venv/bin/activate && pip install psycopg2-binary"

# Restart the service
echo "🔄 Restarting embedding service..."
ssh -i $SSH_KEY -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
    $VM_USER@$VM_HOST \
    "systemctl restart embedding-service"

# Wait for service to start
echo "⏳ Waiting for service to start..."
sleep 3

# Test the new endpoints
echo "🧪 Testing new API endpoints..."
ssh -i $SSH_KEY -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
    $VM_USER@$VM_HOST \
    "curl -s http://localhost:8080/health"

echo ""
echo "✅ Deployment complete!"
echo ""
echo "New endpoints available:"
echo "  GET  https://auditrig.com/api/v1/documents/{doc_id}/status"
echo "  GET  https://auditrig.com/api/v1/documents/{doc_id}/vector-status"
echo "  GET  https://auditrig.com/api/v1/documents/{doc_id}/chunks"
echo "  GET  https://auditrig.com/api/v1/documents/{doc_id}/embedding-stats"
echo ""
