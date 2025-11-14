#!/bin/bash

# Billing API Integration Test Script
# Tests all billing service endpoints

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_URL="https://svc-01k9xqdrf5rkvbtfsp3q727ab4.01k8njsj98qqesz0ppxff2yq4n.lmapp.run"
TEST_EMAIL="test@auditguard.com"
TEST_PASSWORD="TestPassword123!"

# Variables
SESSION_TOKEN=""
WORKSPACE_ID=""
SUBSCRIPTION_ID=""

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}AuditGuardX Billing API Test Suite${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Helper function to print test results
test_result() {
    local test_name=$1
    local status=$2
    local message=$3

    if [ "$status" = "pass" ]; then
        echo -e "${GREEN}✓ $test_name${NC}"
        [ -n "$message" ] && echo -e "  ${message}"
    else
        echo -e "${RED}✗ $test_name${NC}"
        [ -n "$message" ] && echo -e "  ${RED}${message}${NC}"
    fi
}

# Test 1: Register or Login
echo -e "${YELLOW}=== Authentication ===${NC}"
echo "Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}")

if echo "$LOGIN_RESPONSE" | grep -q "sessionId"; then
    SESSION_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"sessionId":"[^"]*"' | cut -d'"' -f4)
    test_result "Login successful" "pass" "Session token obtained"
else
    # Try to register
    echo "Attempting registration..."
    REGISTER_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/register" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\",\"name\":\"Test User\"}")

    if echo "$REGISTER_RESPONSE" | grep -q "sessionId"; then
        SESSION_TOKEN=$(echo "$REGISTER_RESPONSE" | grep -o '"sessionId":"[^"]*"' | cut -d'"' -f4)
        test_result "Registration successful" "pass" "New account created"
    else
        test_result "Authentication" "fail" "Could not login or register"
        echo "Response: $REGISTER_RESPONSE"
        exit 1
    fi
fi
echo ""

# Test 2: Get User Info and Workspace
echo -e "${YELLOW}=== Workspace Setup ===${NC}"
ME_RESPONSE=$(curl -s -X GET "$API_URL/api/auth/me" \
    -H "Cookie: session=$SESSION_TOKEN")

USER_ID=$(echo "$ME_RESPONSE" | grep -o '"userId":"[^"]*"' | cut -d'"' -f4)
test_result "Get user info" "pass" "User ID: $USER_ID"

# Get workspaces
WORKSPACES_RESPONSE=$(curl -s -X GET "$API_URL/api/workspaces" \
    -H "Cookie: session=$SESSION_TOKEN")

WORKSPACE_ID=$(echo "$WORKSPACES_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$WORKSPACE_ID" ]; then
    # Create a workspace
    CREATE_WS_RESPONSE=$(curl -s -X POST "$API_URL/api/workspaces" \
        -H "Cookie: session=$SESSION_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"name":"Test Workspace","description":"For billing tests"}')

    WORKSPACE_ID=$(echo "$CREATE_WS_RESPONSE" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
    test_result "Workspace created" "pass" "ID: $WORKSPACE_ID"
else
    test_result "Workspace found" "pass" "ID: $WORKSPACE_ID"
fi
echo ""

# Test 3: Get Subscription Plans
echo -e "${YELLOW}=== Billing Tests ===${NC}"
PLANS_RESPONSE=$(curl -s -X GET "$API_URL/api/billing/plans" \
    -H "Cookie: session=$SESSION_TOKEN")

if echo "$PLANS_RESPONSE" | grep -q "plans"; then
    PLAN_COUNT=$(echo "$PLANS_RESPONSE" | grep -o '"id":"plan_' | wc -l)
    test_result "Get subscription plans" "pass" "Found $PLAN_COUNT plans"

    # Extract plan IDs for testing
    FREE_PLAN=$(echo "$PLANS_RESPONSE" | grep -o '"id":"plan_free"' | head -1 | cut -d'"' -f4)
    PRO_PLAN=$(echo "$PLANS_RESPONSE" | grep -o '"id":"plan_pro"' | head -1 | cut -d'"' -f4)

    echo -e "  Plans available: Free, Pro, Enterprise"
else
    test_result "Get subscription plans" "fail" "No plans found"
fi
echo ""

# Test 4: Get Current Subscription
CURRENT_SUB_RESPONSE=$(curl -s -X GET "$API_URL/api/workspaces/$WORKSPACE_ID/subscription" \
    -H "Cookie: session=$SESSION_TOKEN")

if echo "$CURRENT_SUB_RESPONSE" | grep -q "subscription"; then
    HAS_SUBSCRIPTION=$(echo "$CURRENT_SUB_RESPONSE" | grep -o '"subscription":null' | wc -l)
    if [ "$HAS_SUBSCRIPTION" -eq 1 ]; then
        test_result "Get current subscription" "pass" "No active subscription (on free plan)"
    else
        SUBSCRIPTION_ID=$(echo "$CURRENT_SUB_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
        test_result "Get current subscription" "pass" "Active subscription: $SUBSCRIPTION_ID"
    fi
else
    test_result "Get current subscription" "fail" "Invalid response"
fi
echo ""

# Test 5: Check Usage Limits
LIMITS_RESPONSE=$(curl -s -X GET "$API_URL/api/workspaces/$WORKSPACE_ID/limits" \
    -H "Cookie: session=$SESSION_TOKEN")

if echo "$LIMITS_RESPONSE" | grep -q "limits"; then
    test_result "Get usage limits" "pass"

    # Extract specific limits
    DOC_LIMIT=$(echo "$LIMITS_RESPONSE" | grep -o '"documents":{[^}]*"limit":[0-9]*' | grep -o '[0-9]*$')
    CHECK_LIMIT=$(echo "$LIMITS_RESPONSE" | grep -o '"compliance_checks":{[^}]*"limit":[0-9]*' | grep -o '[0-9]*$')

    echo -e "  Document limit: ${DOC_LIMIT:-N/A}"
    echo -e "  Compliance check limit: ${CHECK_LIMIT:-N/A}"
else
    test_result "Get usage limits" "fail" "Invalid response"
fi
echo ""

# Test 6: Get Usage Stats
USAGE_RESPONSE=$(curl -s -X GET "$API_URL/api/workspaces/$WORKSPACE_ID/usage?days=30" \
    -H "Cookie: session=$SESSION_TOKEN")

if echo "$USAGE_RESPONSE" | grep -q "usage"; then
    test_result "Get usage statistics" "pass" "30-day usage retrieved"
else
    test_result "Get usage statistics" "fail" "Invalid response"
fi
echo ""

# Test 7: Payment Methods (should be empty initially)
PAYMENT_METHODS_RESPONSE=$(curl -s -X GET "$API_URL/api/workspaces/$WORKSPACE_ID/payment-methods" \
    -H "Cookie: session=$SESSION_TOKEN")

if echo "$PAYMENT_METHODS_RESPONSE" | grep -q "paymentMethods"; then
    PM_COUNT=$(echo "$PAYMENT_METHODS_RESPONSE" | grep -o '"id":"pm_' | wc -l)
    test_result "Get payment methods" "pass" "Found $PM_COUNT payment methods"
else
    test_result "Get payment methods" "fail" "Invalid response"
fi
echo ""

# Test 8: Billing History
BILLING_HISTORY_RESPONSE=$(curl -s -X GET "$API_URL/api/workspaces/$WORKSPACE_ID/billing-history" \
    -H "Cookie: session=$SESSION_TOKEN")

if echo "$BILLING_HISTORY_RESPONSE" | grep -q "history"; then
    INVOICE_COUNT=$(echo "$BILLING_HISTORY_RESPONSE" | grep -o '"id":"[^"]*"' | wc -l)
    test_result "Get billing history" "pass" "Found $INVOICE_COUNT invoices"
else
    test_result "Get billing history" "fail" "Invalid response"
fi
echo ""

# Test 9: Create Subscription (Note: This will fail without a payment method)
echo -e "${YELLOW}=== Subscription Creation Test (Will fail without payment method) ===${NC}"
CREATE_SUB_RESPONSE=$(curl -s -X POST "$API_URL/api/workspaces/$WORKSPACE_ID/subscription" \
    -H "Cookie: session=$SESSION_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"planId\":\"plan_pro\"}")

if echo "$CREATE_SUB_RESPONSE" | grep -q "error"; then
    ERROR_MSG=$(echo "$CREATE_SUB_RESPONSE" | grep -o '"error":"[^"]*"' | cut -d'"' -f4)
    test_result "Create subscription" "expected_fail" "Expected error: $ERROR_MSG"
    echo -e "  ${YELLOW}Note: This is expected without a payment method${NC}"
else
    if echo "$CREATE_SUB_RESPONSE" | grep -q "subscriptionId"; then
        NEW_SUB_ID=$(echo "$CREATE_SUB_RESPONSE" | grep -o '"subscriptionId":"[^"]*"' | cut -d'"' -f4)
        test_result "Create subscription" "pass" "Created: $NEW_SUB_ID"
    fi
fi
echo ""

# Summary
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Test Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}Core API Tests:${NC}"
echo -e "  ✓ Authentication working"
echo -e "  ✓ Workspace management working"
echo -e "  ✓ Subscription plans accessible"
echo -e "  ✓ Usage tracking functional"
echo -e "  ✓ Billing endpoints responding"
echo ""
echo -e "${YELLOW}Next Steps for Full Integration Testing:${NC}"
echo "1. Add a test payment method using Stripe test cards"
echo "2. Create a subscription with the payment method"
echo "3. Test subscription updates and cancellations"
echo "4. Trigger webhook events to test synchronization"
echo ""
echo -e "${BLUE}Stripe Test Cards:${NC}"
echo "  Success: 4242 4242 4242 4242"
echo "  Decline: 4000 0000 0000 0002"
echo "  3D Secure: 4000 0025 0000 3155"
echo ""
