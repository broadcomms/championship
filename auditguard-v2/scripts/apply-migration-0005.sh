#!/bin/bash
# Apply the subscription periods nullable migration

echo "🔄 Applying migration: Make subscription periods nullable"
echo "This will update the subscriptions table schema"
echo ""

cd /home/patrick/championship/auditguard-v2

# Build and deploy the migration runner
echo "📦 Building migration runner..."
npm run build

echo ""
echo "🚀 Deploying to Raindrop..."
raindrop build deploy

echo ""
echo "✅ Migration deployed"
echo ""
echo "Now you need to:"
echo "1. Call the migration-runner endpoint with proper authentication"
echo "2. Or manually run the SQL from: db/auditguard-db/0005_make_subscription_periods_nullable.sql"
