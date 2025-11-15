#!/bin/bash

# Complete Sara's Test Subscription Payment
# Subscription: sub_1STaGqHSX3RgJL1cI3v5SGRM
# Customer: cus_TQR9Zlxidp5WuB
# Workspace: wks_1763177225949_hrcbe

set -e

echo "🔍 Retrieving subscription details..."
SUBSCRIPTION_DATA=$(stripe subscriptions retrieve sub_1STaGqHSX3RgJL1cI3v5SGRM --expand latest_invoice.payment_intent 2>&1)

if [ $? -ne 0 ]; then
  echo "❌ Failed to retrieve subscription. Make sure you're authenticated with Stripe CLI."
  echo "$SUBSCRIPTION_DATA"
  exit 1
fi

echo "✅ Subscription retrieved"
echo ""

# Extract payment intent ID
PAYMENT_INTENT_ID=$(echo "$SUBSCRIPTION_DATA" | grep -o '"payment_intent": "pi_[^"]*"' | cut -d'"' -f4)

if [ -z "$PAYMENT_INTENT_ID" ]; then
  echo "⚠️  No payment intent found. The subscription might already be active or have no pending payment."
  echo ""
  echo "Subscription status:"
  echo "$SUBSCRIPTION_DATA" | grep -A 2 '"status":'
  exit 0
fi

echo "💳 Payment Intent: $PAYMENT_INTENT_ID"
echo ""

echo "🎯 Marking payment as succeeded (test mode)..."
stripe payment_intents succeed $PAYMENT_INTENT_ID

echo ""
echo "✅ Payment marked as succeeded!"
echo ""

echo "🔄 Waiting 2 seconds for webhooks to process..."
sleep 2

echo ""
echo "📊 Final subscription status:"
stripe subscriptions retrieve sub_1STaGqHSX3RgJL1cI3v5SGRM | grep -A 1 '"status":'

echo ""
echo "✨ Done! Subscription should now be active."
echo "🌐 Check the billing dashboard: http://localhost:3000/workspaces/wks_1763177225949_hrcbe/billing"
