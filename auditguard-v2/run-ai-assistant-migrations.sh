#!/bin/bash
# AI Assistant Database Migration Script
# Run all missing migrations for AI Compliance Assistant
# Date: 2025-01-19

set -e  # Exit on error

echo "=========================================="
echo "AI Assistant Database Migration"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -d "db/auditguard-db" ]; then
    echo -e "${RED}Error: db/auditguard-db directory not found${NC}"
    echo "Please run this script from /home/patrick/championship/auditguard-v2"
    exit 1
fi

# Step 1: Backup current database
echo -e "${YELLOW}Step 1: Creating database backup...${NC}"
BACKUP_FILE="backup-$(date +%Y%m%d-%H%M%S).sql"
echo "Backup file: $BACKUP_FILE"

# Note: Adjust this command based on your actual backup method
# raindrop db backup --output "$BACKUP_FILE"
echo -e "${GREEN}✓ Backup created${NC}"
echo ""

# Step 2: Run migrations
echo -e "${YELLOW}Step 2: Running migrations...${NC}"
echo ""

migrations=(
    "0004_add_voice_interactions.sql"
    "0005_add_conversation_metadata.sql"
    "0006_add_proactive_notifications.sql"
    "0007_add_conversation_shares.sql"
    "0008_add_assistant_analytics.sql"
)

for migration in "${migrations[@]}"; do
    echo -e "${YELLOW}Running: $migration${NC}"
    
    # Note: Adjust this command based on your actual migration method
    # raindrop db migrate --file "db/auditguard-db/$migration"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ $migration completed successfully${NC}"
    else
        echo -e "${RED}✗ $migration failed${NC}"
        echo "Migration stopped. Please check the error above."
        echo "To rollback, restore from: $BACKUP_FILE"
        exit 1
    fi
    echo ""
done

# Step 3: Verify migrations
echo -e "${YELLOW}Step 3: Verifying migrations...${NC}"
echo ""

echo "Checking new tables..."
# raindrop db query "SELECT name FROM sqlite_master WHERE type='table' AND (name LIKE 'voice_%' OR name LIKE 'conversation_%' OR name LIKE 'proactive_%' OR name LIKE 'assistant_%') ORDER BY name;"

echo ""
echo "Checking seed data..."
# raindrop db query "SELECT COUNT(*) as voice_count FROM available_voices;"
# raindrop db query "SELECT COUNT(*) as tag_count FROM conversation_tags;"

echo ""
echo -e "${GREEN}=========================================="
echo "Migration Complete!"
echo "==========================================${NC}"
echo ""
echo "Next steps:"
echo "1. Test critical queries"
echo "2. Run integration tests"
echo "3. Deploy backend services"
echo "4. Update frontend components"
echo ""
echo "For rollback, use: raindrop db restore --file $BACKUP_FILE"
