#!/bin/bash

# Deployment script for embedding service
# This script updates the embedding service on the production server

set -e  # Exit on error

echo "========================================="
echo "Embedding Service Deployment Script"
echo "========================================="
echo ""

# Configuration
REMOTE_HOST="auditrig.com"
REMOTE_USER="root"
LOCAL_FILE="/home/patrick/championship/embedding-service/app/routes/admin.py"
REMOTE_DIR="/root/embedding-service/app/routes"  # Adjust this path
SERVICE_DIR="/root/embedding-service"  # Adjust this path

echo "Checking if SSH connection is available..."
if ssh -o BatchMode=yes -o ConnectTimeout=5 "${REMOTE_USER}@${REMOTE_HOST}" echo "SSH connection successful" 2>/dev/null; then
    echo "✅ SSH connection established"
    echo ""

    echo "Step 1: Backing up current admin.py..."
    ssh "${REMOTE_USER}@${REMOTE_HOST}" "cp ${REMOTE_DIR}/admin.py ${REMOTE_DIR}/admin.py.backup.$(date +%Y%m%d_%H%M%S)" || {
        echo "⚠️  Backup failed, but continuing..."
    }

    echo "Step 2: Copying updated admin.py to production..."
    scp "${LOCAL_FILE}" "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/admin.py" || {
        echo "❌ Failed to copy file"
        exit 1
    }

    echo "Step 3: Restarting embedding service..."
    ssh "${REMOTE_USER}@${REMOTE_HOST}" << 'EOF'
        # Kill existing uvicorn processes
        pkill -f "uvicorn app.main:app" || echo "No existing process found"

        # Wait for process to stop
        sleep 2

        # Start the service
        cd /root/embedding-service
        nohup uvicorn app.main:app --host 0.0.0.0 --port 8080 > /var/log/embedding-service.log 2>&1 &

        echo "Service restarted with PID: $!"

        # Wait for service to start
        sleep 3
EOF

    echo ""
    echo "Step 4: Verifying deployment..."
    sleep 2

    # Test the endpoint
    RESPONSE=$(curl -s -X POST "https://auditrig.com/api/v1/admin/cleanup/orphaned-embeddings" \
        -H "X-API-Key: test-api-key-1234567890abcdef" \
        -H "Content-Type: application/json" \
        -d '{"validDocumentIds": ["test-doc-1"]}')

    echo "Response from production:"
    echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"

    # Check if response contains new fields
    if echo "$RESPONSE" | grep -q "orphanedDocuments"; then
        echo ""
        echo "✅ Deployment successful! New code is running."
        echo ""
        echo "Next steps:"
        echo "1. Go to https://auditrig.com/admin/vectors"
        echo "2. Click 'Cleanup Orphaned' button"
        echo "3. Should see 16 orphaned documents being cleaned up"
    else
        echo ""
        echo "⚠️  Warning: Response doesn't contain new fields"
        echo "The service might still be starting up or there was an issue"
        echo "Check logs: ssh ${REMOTE_USER}@${REMOTE_HOST} 'tail -50 /var/log/embedding-service.log'"
    fi

else
    echo "❌ SSH connection failed"
    echo ""
    echo "Manual deployment required:"
    echo ""
    echo "1. Copy the file manually:"
    echo "   scp ${LOCAL_FILE} ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/admin.py"
    echo ""
    echo "2. SSH to server and restart service:"
    echo "   ssh ${REMOTE_USER}@${REMOTE_HOST}"
    echo "   pkill -f 'uvicorn app.main:app'"
    echo "   cd ${SERVICE_DIR}"
    echo "   uvicorn app.main:app --host 0.0.0.0 --port 8080 &"
    echo ""
    echo "OR if you don't have SSH access:"
    echo "   - Contact your system administrator"
    echo "   - Provide them with the updated admin.py file"
    echo "   - Share the deployment instructions from URGENT_EMBEDDING_SERVICE_DEPLOY.md"

    exit 1
fi

echo ""
echo "========================================="
echo "Deployment complete!"
echo "========================================="
