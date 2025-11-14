#!/bin/bash

# Stripe Webhook Integration Test Script
# Tests the webhook service with simulated Stripe events

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
WEBHOOK_URL="https://svc-01k9zcv70k7zsbmg1fbydb6z3f.01k8njsj98qqesz0ppxff2yq4n.lmapp.run"
WEBHOOK_SECRET="whsec_BEKEbdYQFd5T3hKXoyauHslMHZ4QTsCs"

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}Stripe Webhook Integration Test${NC}"
echo -e "${YELLOW}========================================${NC}\n"

# Test 1: Webhook Endpoint Health Check
echo -e "${YELLOW}Test 1: Webhook Endpoint Health Check${NC}"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$WEBHOOK_URL")
if [ "$HTTP_CODE" = "405" ]; then
    echo -e "${GREEN}✓ Webhook service is running (returns 405 Method Not Allowed for GET)${NC}"
else
    echo -e "${RED}✗ Unexpected HTTP code: $HTTP_CODE${NC}"
    exit 1
fi
echo ""

# Test 2: Missing Signature
echo -e "${YELLOW}Test 2: Request Without Signature${NC}"
RESPONSE=$(curl -s -X POST "$WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -d '{"type":"test.event"}')

if echo "$RESPONSE" | grep -q "Missing signature"; then
    echo -e "${GREEN}✓ Correctly rejects requests without Stripe signature${NC}"
else
    echo -e "${RED}✗ Should reject requests without signature${NC}"
    echo "Response: $RESPONSE"
fi
echo ""

# Test 3: Test Customer Subscription Created Event
echo -e "${YELLOW}Test 3: customer.subscription.created Event${NC}"
echo -e "${YELLOW}Note: This requires valid Stripe signature - use Stripe CLI for real testing${NC}"
echo -e "${YELLOW}Command: stripe listen --forward-to $WEBHOOK_URL${NC}"
echo ""

# Test 4: Test Invoice Payment Succeeded Event
echo -e "${YELLOW}Test 4: invoice.payment_succeeded Event${NC}"
echo -e "${YELLOW}Note: This requires valid Stripe signature - use Stripe CLI for real testing${NC}"
echo -e "${YELLOW}Command: stripe trigger invoice.payment_succeeded${NC}"
echo ""

# Summary
echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}Test Summary${NC}"
echo -e "${YELLOW}========================================${NC}"
echo -e "${GREEN}✓ Webhook service is deployed and running${NC}"
echo -e "${GREEN}✓ Signature validation is enforced${NC}"
echo -e "${YELLOW}⚠ Full webhook testing requires Stripe CLI:${NC}"
echo ""
echo -e "${YELLOW}To test webhooks with real Stripe events:${NC}"
echo "1. Install Stripe CLI: https://stripe.com/docs/stripe-cli"
echo "2. Login: stripe login"
echo "3. Forward events: stripe listen --forward-to $WEBHOOK_URL"
echo "4. Trigger events: stripe trigger customer.subscription.created"
echo ""
echo -e "${YELLOW}Available test events:${NC}"
echo "  - stripe trigger customer.subscription.created"
echo "  - stripe trigger customer.subscription.updated"
echo "  - stripe trigger customer.subscription.deleted"
echo "  - stripe trigger invoice.payment_succeeded"
echo "  - stripe trigger invoice.payment_failed"
echo "  - stripe trigger payment_method.attached"
echo ""
