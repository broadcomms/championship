#!/bin/bash

# Script to reprocess all documents in a workspace to extract AI-based titles and descriptions
# Usage: ./reprocess-documents.sh <API_URL> <SESSION_COOKIE> <WORKSPACE_ID>

set -e

API_URL="${1:-http://localhost:8787}"
SESSION_COOKIE="${2}"
WORKSPACE_ID="${3}"

if [ -z "$SESSION_COOKIE" ] || [ -z "$WORKSPACE_ID" ]; then
    echo "Usage: $0 <API_URL> <SESSION_COOKIE> <WORKSPACE_ID>"
    echo "Example: $0 http://localhost:8787 'abc123session' wks_123456"
    exit 1
fi

echo "========================================"
echo "Reprocessing Documents"
echo "========================================"
echo "API URL: $API_URL"
echo "Workspace ID: $WORKSPACE_ID"
echo ""

# Get all documents for the workspace
echo "Fetching documents for workspace $WORKSPACE_ID..."
DOCUMENTS_RESPONSE=$(curl -s -X GET \
  "$API_URL/api/workspaces/$WORKSPACE_ID/documents" \
  -H "Cookie: session=$SESSION_COOKIE" \
  -H "Content-Type: application/json")

# Extract document IDs using jq (or parse manually if jq not available)
if command -v jq &> /dev/null; then
    DOCUMENT_IDS=$(echo "$DOCUMENTS_RESPONSE" | jq -r '.documents[].id')
    DOCUMENT_COUNT=$(echo "$DOCUMENT_IDS" | wc -l)

    echo "Found $DOCUMENT_COUNT documents to reprocess"
    echo ""

    # Counter for progress
    CURRENT=0

    # Loop through each document and trigger reprocessing
    while IFS= read -r DOC_ID; do
        if [ -n "$DOC_ID" ]; then
            CURRENT=$((CURRENT + 1))
            echo "[$CURRENT/$DOCUMENT_COUNT] Processing document: $DOC_ID"

            # Trigger reprocessing
            RESULT=$(curl -s -X POST \
              "$API_URL/api/workspaces/$WORKSPACE_ID/documents/$DOC_ID/process" \
              -H "Cookie: session=$SESSION_COOKIE" \
              -H "Content-Type: application/json")

            # Check if successful
            if echo "$RESULT" | jq -e '.success' > /dev/null 2>&1; then
                TITLE=$(echo "$RESULT" | jq -r '.title // "N/A"')
                echo "  ✓ Success! Title: $TITLE"
            else
                ERROR=$(echo "$RESULT" | jq -r '.error // "Unknown error"')
                echo "  ✗ Failed: $ERROR"
            fi

            # Small delay to avoid overwhelming the API
            sleep 1
        fi
    done <<< "$DOCUMENT_IDS"

    echo ""
    echo "========================================"
    echo "Reprocessing Complete!"
    echo "========================================"
else
    echo "Error: jq is not installed. Please install jq to use this script."
    echo "On Ubuntu/Debian: sudo apt-get install jq"
    echo "On macOS: brew install jq"
    exit 1
fi
