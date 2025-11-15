#!/bin/bash
# Complete a test subscription payment manually using Stripe CLI

SUBSCRIPTION_ID=$1

if [ -z "$SUBSCRIPTION_ID" ]; then
  echo "Usage: $0 <subscription-id>"
  echo "Example: $0 sub_1STZOeHSX3RgJL1c7z1erQL6"
  exit 1
fi

echo "🔄 Completing test subscription: $SUBSCRIPTION_ID"
echo ""

# Get the subscription details
echo "📊 Fetching subscription..."
stripe subscriptions retrieve $SUBSCRIPTION_ID

echo ""
echo "💳 To complete this subscription, you need to:"
echo "1. Go to Stripe Dashboard: https://dashboard.stripe.com/test/subscriptions/$SUBSCRIPTION_ID"
echo "2. Click 'Complete payment' or update payment method"
echo ""
echo "Or use this command to simulate payment:"
echo "stripe subscriptions update $SUBSCRIPTION_ID --default_payment_method=pm_card_visa"
echo ""
echo "Or trigger the invoice payment:"
INVOICE_ID=$(stripe subscriptions retrieve $SUBSCRIPTION_ID --format json | grep -o '"latest_invoice":"[^"]*"' | cut -d'"' -f4)
echo "stripe invoices pay $INVOICE_ID"
