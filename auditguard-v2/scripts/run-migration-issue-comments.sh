#!/bin/bash

# Run migration to add issue_comments table
# This script uses the Raindrop admin API to execute SQL migrations

echo "🔄 Running migration: add-issue-comments-table"
echo "================================================"

# Read the SQL migration file
MIGRATION_SQL=$(cat src/sql/add-issue-comments-table.sql)

# Execute the migration using the admin database query API
# You'll need to update the session token with a valid admin session

curl -X POST http://localhost:3000/api/admin/database/query \
  -H "Content-Type: application/json" \
  -H "Cookie: session=YOUR_ADMIN_SESSION_HERE" \
  -d "{\"sql\": $(echo "$MIGRATION_SQL" | jq -Rs .)}"

echo ""
echo "✅ Migration complete"
echo ""
echo "Next steps:"
echo "1. Verify the table was created:"
echo "   SELECT name FROM sqlite_master WHERE type='table' AND name='issue_comments';"
echo ""
echo "2. Check indexes:"
echo "   SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='issue_comments';"
