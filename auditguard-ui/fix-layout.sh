#!/bin/bash

# Script to fix layout for all workspace pages

pages=(
  "/home/patrick/championship/auditguard-ui/src/app/org/[id]/workspace/[wsId]/compliance/page.tsx"
  "/home/patrick/championship/auditguard-ui/src/app/org/[id]/workspace/[wsId]/issues/page.tsx"
  "/home/patrick/championship/auditguard-ui/src/app/org/[id]/workspace/[wsId]/analytics/page.tsx"
  "/home/patrick/championship/auditguard-ui/src/app/org/[id]/workspace/[wsId]/assistant/page.tsx"
  "/home/patrick/championship/auditguard-ui/src/app/org/[id]/workspace/[wsId]/members/page.tsx"
  "/home/patrick/championship/auditguard-ui/src/app/org/[id]/workspace/[wsId]/settings/page.tsx"
  "/home/patrick/championship/auditguard-ui/src/app/org/[id]/workspace/[wsId]/compliance/run/page.tsx"
)

for page in "${pages[@]}"; do
  echo "Processing: $page"

  # Check if file uses MultiLevelSidebar
  if grep -q "MultiLevelSidebar" "$page"; then
    echo "  - Found MultiLevelSidebar, needs fixing"

    # Check if OrganizationLayout is already imported
    if ! grep -q "OrganizationLayout" "$page"; then
      echo "  - Adding OrganizationLayout import"
    fi

    # Check if useAuth is imported
    if ! grep -q "useAuth" "$page"; then
      echo "  - Missing useAuth import"
    fi
  else
    echo "  - Already uses proper layout or doesn't use MultiLevelSidebar"
  fi
  echo ""
done
