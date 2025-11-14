#!/bin/bash

# Deploy AuditGuardX with TEST MODE Stripe keys
# This script sets the environment variables and deploys

# Usage:
#  
# cd /home/patrick/championship/auditguard-v2
#  ./deploy-with-test-stripe.sh

echo "======================================"
echo "Deploying with TEST MODE Stripe keys"
echo "======================================"

# Set TEST MODE Stripe keys as environment variables
# IMPORTANT: Replace these with your actual test mode keys

export STRIPE_SECRET_KEY="sk_test_51ISqyeHSX3RgJL1cYATfAtUz2mTheWpXfHE6CarZVJlLAsthLPSkMywCU4R4igxVYYtP2YDNCMq15ACNNewhnudb005xDmDDxm"
export STRIPE_PUBLISHABLE_KEY="pk_test_51ISqyeHSX3RgJL1cNBI3GDLEaomO6LCFeaApwS8SRCYZBqoiZlINfWZTYvtlb2opnYz77pKF6nKQesyAaJ70hCeP00EisXd9v8"
export STRIPE_WEBHOOK_SECRET="whsec_Fo1fpb5o9dbv0sAPjy2uopzCq1Ny6FYU"

echo ""
echo "Environment variables set:"
echo "STRIPE_SECRET_KEY: ${STRIPE_SECRET_KEY:0:20}..."
echo "STRIPE_PUBLISHABLE_KEY: ${STRIPE_PUBLISHABLE_KEY:0:20}..."
echo "STRIPE_WEBHOOK_SECRET: ${STRIPE_WEBHOOK_SECRET:0:20}..."
echo ""

# Deploy with the test keys
echo "Starting deployment..."
NODE_OPTIONS="--no-warnings" raindrop build deploy

echo ""
echo "======================================"
echo "Deployment complete!"
echo "Your backend now uses TEST MODE Stripe keys"
echo "======================================"
