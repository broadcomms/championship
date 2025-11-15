#!/bin/bash

# Script to manually sync subscription status from Stripe
# Usage: ./sync-subscription.sh <workspace_id> <session_token>

WORKSPACE_ID=${1:-"wks_1763152161110_wlltb"}
API_URL="https://svc-01ka207rnhxjkfs7x39r5f129j.01k8njsj98qqesz0ppxff2yq4n.lmapp.run"

# Get session token from browser (you'll need to provide this)
if [ -z "$2" ]; then
    echo "Error: Please provide session token as second argument"
    echo "Usage: $0 <workspace_id> <session_token>"
    echo ""
    echo "To get your session token:"
    echo "1. Open browser DevTools (F12)"
    echo "2. Go to Application/Storage -> Cookies"
    echo "3. Find 'session' cookie and copy its value"
    exit 1
fi

SESSION_TOKEN="$2"

echo "Syncing subscription for workspace: $WORKSPACE_ID"
echo ""

# Sync subscription status
echo "Calling sync endpoint..."
SYNC_RESPONSE=$(curl -s -X POST \
  "$API_URL/api/workspaces/$WORKSPACE_ID/subscription/sync" \
  -H "Cookie: session=$SESSION_TOKEN" \
  -H "Content-Type: application/json")

echo "Sync response: $SYNC_RESPONSE"
echo ""

# Get updated subscription
echo "Fetching updated subscription..."
SUB_RESPONSE=$(curl -s -X GET \
  "$API_URL/api/workspaces/$WORKSPACE_ID/subscription" \
  -H "Cookie: session=$SESSION_TOKEN" \
  -H "Content-Type: application/json")

echo "Subscription details: $SUB_RESPONSE"
echo ""

# Parse and display status
STATUS=$(echo $SUB_RESPONSE | grep -oP '"status":"[^"]*"' | cut -d'"' -f4)
PLAN=$(echo $SUB_RESPONSE | grep -oP '"planName":"[^"]*"' | cut -d'"' -f4)

if [ ! -z "$STATUS" ]; then
    echo "==================================="
    echo "Current Status: $STATUS"
    echo "Current Plan: $PLAN"
    echo "==================================="
else
    echo "Could not parse subscription status"
fi
