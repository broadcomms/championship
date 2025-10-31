#!/usr/bin/env zx
// filepath: /Users/dstaley/Work/liquidmetal/apps/demo-sql-app/scripts/seed-sql.mts
// This script seeds a memory D1 database and then generates SQL files that will work with the D1 database.

import { $, chalk, fs } from 'zx';

console.log('🔍 Looking for database name in raindrop.manifest...');

try {
  // Read raindrop.manifest file
  const manifestContent = await fs.readFile('raindrop.manifest', 'utf-8');

  // Extract database name using regex
  const dbNameMatch = manifestContent.match(/sql_database\s+"([^"]+)"/);

  if (!dbNameMatch || !dbNameMatch[1]) {
    console.error(chalk.red('❌ Error: Could not find database name in raindrop.manifest'));
    process.exit(1);
  }

  const dbName = dbNameMatch[1];
  console.log(chalk.green(`🔍 Found database: ${dbName}`));
  console.log(chalk.blue('🌱 Running seed script'));

  // Run the TypeScript seed script with D1 database binding
  await $`DB_NAME=${dbName} npx tsx ./scripts/seed.ts`;

  console.log(chalk.green('✅ Seeding complete!'));
} catch (error) {
  console.error(chalk.red(`❌ Error: ${error instanceof Error ? error.message : String(error)}`));
  process.exit(1);
}
