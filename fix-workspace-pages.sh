#!/bin/bash

# Function to fix a workspace page
fix_page() {
  local file=$1
  echo "Fixing: $file"

  # 1. Replace MultiLevelSidebar import with OrganizationLayout
  sed -i "s/import { MultiLevelSidebar } from '@\/components\/sidebar\/MultiLevelSidebar';/import { OrganizationLayout } from '@\/components\/layout\/OrganizationLayout';/" "$file"

  # 2. Add useAuth import if not present
  if ! grep -q "import { useAuth }" "$file"; then
    # Add after the last import statement
    sed -i "/^import.*from.*$/a import { useAuth } from '@/contexts/AuthContext';" "$file" | head -1
  fi

  # 3. Add accountId variable
  sed -i "s/const orgId = params.id as string;/const { user } = useAuth();\n  const orgId = params.id as string;\n  const accountId = user?.userId;/" "$file"

  # 4. Replace MultiLevelSidebar usage with OrganizationLayout in loading state
  sed -i 's/<div className="flex h-screen">\s*<MultiLevelSidebar.*\/>\s*<div className="flex-1 flex items-center justify-center">/<OrganizationLayout accountId={accountId} orgId={orgId} workspaceId={wsId}>\n        <div className="flex items-center justify-center p-8">/g' "$file"

  # 5. Replace main return MultiLevelSidebar with OrganizationLayout
  sed -i 's/<div className="flex h-screen">\s*<MultiLevelSidebar.*\/>\s*<div className="flex-1 overflow-y-auto bg-gray-50">\s*<div className="max-w-7xl mx-auto p-8">/<OrganizationLayout accountId={accountId} orgId={orgId} workspaceId={wsId}>\n      <div className="p-8">/g' "$file"

  # 6. Fix closing tags (replace last 3 closing divs with OrganizationLayout close)
  # This is tricky with sed, so we'll leave it for manual fixing

  echo "  - Imports updated"
  echo "  - Variables added"
  echo "  - Layout structure updated (please verify closing tags manually)"
}

# Fix each page
fix_page "/home/patrick/championship/auditguard-ui/src/app/org/[id]/workspace/[wsId]/issues/page.tsx"
fix_page "/home/patrick/championship/auditguard-ui/src/app/org/[id]/workspace/[wsId]/analytics/page.tsx"
fix_page "/home/patrick/championship/auditguard-ui/src/app/org/[id]/workspace/[wsId]/assistant/page.tsx"
fix_page "/home/patrick/championship/auditguard-ui/src/app/org/[id]/workspace/[wsId]/members/page.tsx"
fix_page "/home/patrick/championship/auditguard-ui/src/app/org/[id]/workspace/[wsId]/settings/page.tsx"
fix_page "/home/patrick/championship/auditguard-ui/src/app/org/[id]/workspace/[wsId]/compliance/run/page.tsx"

echo "Done! Please verify all pages and fix closing tags manually."
