#!/bin/bash

# Database Reset Script
# This script will completely reset the database and prepare for fresh testing

set -e

echo "🔄 Starting database reset..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Admin session for API calls
ADMIN_SESSION="ses_1763180900080_3n1gw"
API_URL="http://localhost:3001/api/admin/database/query"

echo -e "${YELLOW}⚠️  WARNING: This will delete ALL data except admin user!${NC}"
echo -e "${YELLOW}Press Ctrl+C within 5 seconds to cancel...${NC}"
sleep 5

# Helper function to execute SQL
execute_sql() {
    local sql="$1"
    local description="$2"
    
    curl -s "$API_URL" \
        -H "Cookie: session=$ADMIN_SESSION" \
        -H "Content-Type: application/json" \
        -d "{\"sql\": \"$sql\"}" | jq -r '.rowCount // .error' > /tmp/sql_result.txt
    
    local result=$(cat /tmp/sql_result.txt)
    if [[ "$result" == *"error"* ]] || [[ "$result" == "null" ]]; then
        echo "⚠️  $description (might not exist or already empty)"
    else
        echo "✓ $description (affected: $result rows)"
    fi
}

echo ""
echo -e "${GREEN}Step 1: Clearing billing and subscription data...${NC}"

execute_sql "DELETE FROM billing_history" "Cleared billing_history"
execute_sql "DELETE FROM stripe_webhooks" "Cleared stripe_webhooks"
execute_sql "DELETE FROM stripe_payment_methods" "Cleared stripe_payment_methods"
execute_sql "DELETE FROM subscriptions" "Cleared subscriptions"
execute_sql "DELETE FROM stripe_customers" "Cleared stripe_customers"

echo ""
echo -e "${GREEN}Step 2: Clearing workspace and user data...${NC}"

execute_sql "DELETE FROM workspace_members WHERE user_id != 'usr_bootstrap_admin'" "Cleared workspace_members"
execute_sql "DELETE FROM workspaces WHERE id != 'wks_bootstrap'" "Cleared workspaces"
execute_sql "DELETE FROM sessions WHERE user_id != 'usr_bootstrap_admin'" "Cleared sessions"
execute_sql "DELETE FROM users WHERE id != 'usr_bootstrap_admin'" "Cleared users"

echo ""
echo -e "${GREEN}Step 3: Clearing document and compliance data...${NC}"

execute_sql "DELETE FROM document_chunks" "Cleared document_chunks"
execute_sql "DELETE FROM documents" "Cleared documents"
execute_sql "DELETE FROM compliance_checks" "Cleared compliance_checks"
execute_sql "DELETE FROM compliance_reports" "Cleared compliance_reports"

echo ""
echo -e "${GREEN}Step 4: Clearing analytics and other data...${NC}"

execute_sql "DELETE FROM usage_logs" "Cleared usage_logs"
execute_sql "DELETE FROM api_usage_logs" "Cleared api_usage_logs"
execute_sql "DELETE FROM assistant_conversations" "Cleared assistant_conversations"
execute_sql "DELETE FROM issue_assignments" "Cleared issue_assignments"
execute_sql "DELETE FROM issues" "Cleared issues"

echo ""
echo -e "${GREEN}Step 5: Verifying cleanup...${NC}"

RESULT=$(curl -s "$API_URL" \
    -H "Cookie: session=$ADMIN_SESSION" \
    -H "Content-Type: application/json" \
    -d '{"sql": "SELECT '\''users'\'' as table_name, COUNT(*) as count FROM users UNION ALL SELECT '\''workspaces'\'', COUNT(*) FROM workspaces UNION ALL SELECT '\''stripe_customers'\'', COUNT(*) FROM stripe_customers UNION ALL SELECT '\''billing_history'\'', COUNT(*) FROM billing_history UNION ALL SELECT '\''stripe_webhooks'\'', COUNT(*) FROM stripe_webhooks UNION ALL SELECT '\''documents'\'', COUNT(*) FROM documents"}')

echo "$RESULT" | jq -r '.rows[]? | "\(.table_name): \(.count)"'

echo ""
echo -e "${GREEN}✅ Database reset complete!${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Create a new test user (sara@auditguardx.com)"
echo "2. Create a new workspace"
echo "3. Subscribe to a plan via Stripe"
echo "4. Test plan changes and verify billing history appears"
echo ""
echo -e "${GREEN}You can now proceed with fresh testing!${NC}"

rm -f /tmp/sql_result.txt
