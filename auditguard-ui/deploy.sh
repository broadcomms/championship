#!/bin/bash

echo "🚀 AuditGuardX Production Deployment Script"
echo "==========================================="
echo ""

# Check if site is linked
if [ ! -f ".netlify/state.json" ]; then
    echo "⚠️  Site not linked to Netlify"
    echo ""
    echo "Please choose an option:"
    echo "  1) Link to existing Netlify site: netlify link"
    echo "  2) Deploy with site name: netlify deploy --prod --site=YOUR_SITE_NAME"
    echo ""
    exit 1
fi

# Clean build artifacts
echo "🧹 Cleaning build artifacts..."
rm -rf .next

# Build the application
echo "📦 Building Next.js application..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

echo "✅ Build successful!"
echo ""

# Deploy to Netlify
echo "🚀 Deploying to Netlify production..."
netlify deploy --prod

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Deployment successful!"
    echo "🌐 Your site is now live!"
else
    echo ""
    echo "❌ Deployment failed!"
    exit 1
fi
