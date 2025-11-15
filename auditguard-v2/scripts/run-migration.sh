#!/bin/bash
# Run a specific migration against the production database

MIGRATION_FILE=$1

if [ -z "$MIGRATION_FILE" ]; then
  echo "Usage: $0 <migration-file.sql>"
  echo "Example: $0 db/auditguard-db/0005_make_subscription_periods_nullable.sql"
  exit 1
fi

if [ ! -f "$MIGRATION_FILE" ]; then
  echo "Error: Migration file not found: $MIGRATION_FILE"
  exit 1
fi

echo "🔄 Running migration: $MIGRATION_FILE"
echo "⚠️  This will be applied to the production database"
echo ""
read -p "Continue? (y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Migration cancelled"
  exit 0
fi

# Read the SQL file and execute it via the raindrop CLI
echo "📤 Executing migration..."

# Extract the database name from the path (e.g., auditguard-db)
DB_NAME=$(echo "$MIGRATION_FILE" | sed -n 's|^db/\([^/]*\)/.*|\1|p')

if [ -z "$DB_NAME" ]; then
  echo "Error: Could not extract database name from path"
  exit 1
fi

echo "Database: $DB_NAME"

# Read the migration file
SQL_CONTENT=$(cat "$MIGRATION_FILE")

# Execute the SQL using the raindrop CLI
# Note: This assumes you have a SQL execution endpoint or CLI command
# You may need to adjust this based on your actual Raindrop CLI capabilities

echo "$SQL_CONTENT" | raindrop sql execute --database "$DB_NAME" || {
  echo "❌ Migration failed"
  exit 1
}

echo "✅ Migration completed successfully"
