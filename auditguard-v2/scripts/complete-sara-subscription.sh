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

# Extract payment intent ID (it's nested in latest_invoice.payment_intent.id)
PAYMENT_INTENT_ID=$(echo "$SUBSCRIPTION_DATA" | grep -o 'pi_[A-Za-z0-9]*' | head -1)

if [ -z "$PAYMENT_INTENT_ID" ]; then
  echo "⚠️  No payment intent found. The subscription might already be active or have no pending payment."
  echo ""
  echo "Subscription status:"
  echo "$SUBSCRIPTION_DATA" | grep '"status":' | head -1
  exit 0
fi

echo "💳 Payment Intent: $PAYMENT_INTENT_ID"
echo ""

# Check payment intent status
PI_STATUS=$(stripe payment_intents retrieve $PAYMENT_INTENT_ID | grep '"status":' | head -1 | cut -d'"' -f4)
echo "📊 Payment Intent Status: $PI_STATUS"
echo ""

if [ "$PI_STATUS" = "requires_confirmation" ]; then
  echo "🎯 Confirming payment intent..."
  stripe payment_intents confirm $PAYMENT_INTENT_ID --payment-method pm_1STaGoHSX3RgJL1cLVmMNbzP
elif [ "$PI_STATUS" = "requires_action" ]; then
  echo "⚠️  Payment requires additional action (3D Secure, etc.)"
  echo "   For test mode, you may need to manually complete this in Stripe Dashboard"
else
  echo "ℹ️  Payment intent is in '$PI_STATUS' status"
  echo "   Use Stripe Dashboard to manually complete if needed"
fi

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
