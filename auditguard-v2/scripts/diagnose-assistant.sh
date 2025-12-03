#!/bin/bash

# Diagnostic script for AuditGuard AI Assistant
# This script helps diagnose issues with the assistant service

set -e

API_URL="${API_URL:-https://svc-01kbdgk0wre3s9fazye2sbbdwj.01k8njsj98qqesz0ppxff2yq4n.lmapp.run}"

# Get workspace ID from environment or use a test one
WORKSPACE_ID="${WORKSPACE_ID:-}"

if [ -z "$WORKSPACE_ID" ]; then
  echo "❌ Error: WORKSPACE_ID environment variable is required"
  echo "Usage: WORKSPACE_ID=wks_xxx ./scripts/diagnose-assistant.sh"
  exit 1
fi

echo "🔍 AuditGuard AI Assistant Diagnostics"
echo "======================================"
echo "API URL: $API_URL"
echo "Workspace ID: $WORKSPACE_ID"
echo ""

# Test 1: Simple greeting
echo "📝 Test 1: Simple greeting"
echo "Question: 'hello'"
RESPONSE=$(curl -s -X POST "$API_URL/chat" \
  -H "Content-Type: application/json" \
  -d "{\"workspaceId\":\"$WORKSPACE_ID\",\"message\":\"hello\"}")

echo "Response: $RESPONSE" | jq -r '.message // .'
echo ""

# Test 2: Compliance score question (the problematic one from screenshot)
echo "📝 Test 2: Compliance score question"
echo "Question: 'what is my average compliance score?'"
RESPONSE=$(curl -s -X POST "$API_URL/chat" \
  -H "Content-Type: application/json" \
  -d "{\"workspaceId\":\"$WORKSPACE_ID\",\"message\":\"what is my average compliance score?\"}")

echo "Response: $RESPONSE" | jq -r '.message // .'

# Check for issues
if echo "$RESPONSE" | grep -qi "haven't run any\|no compliance checks"; then
  echo "⚠️  WARNING: AI says no checks exist - this might be wrong!"
else
  echo "✅ Response mentions data"
fi

echo ""

# Test 3: Issues question
echo "📝 Test 3: Issues question"
echo "Question: 'what issues do I have?'"
RESPONSE=$(curl -s -X POST "$API_URL/chat" \
  -H "Content-Type: application/json" \
  -d "{\"workspaceId\":\"$WORKSPACE_ID\",\"message\":\"what issues do I have?\"}")

echo "Response: $RESPONSE" | jq -r '.message // .'

# Check for technical terms
if echo "$RESPONSE" | grep -qi "tool\|field\|based on the data"; then
  echo "⚠️  WARNING: Response contains technical terms!"
else
  echo "✅ Response is user-friendly"
fi

echo ""
echo "======================================"
echo "✅ Diagnostics complete"
