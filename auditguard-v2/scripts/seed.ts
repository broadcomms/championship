import { Kysely } from 'kysely';
import { DB } from '../src/db/auditguard-db/types';
import { D1Dialect } from 'kysely-d1';
import { makeD1Database } from '@liquidmetal-ai/in-memory-d1';
import fs from 'fs';
import path from 'path';

//get the DB name from the env variable
const dbName = process.env.DB_NAME;
const migrationFilePath = `./db/${dbName}`;
console.log(dbName);

async function seed() {
  // When running with in-memory D1 for testing
  console.log('Using in-memory D1 database');
  const db = new Kysely<DB>({
    dialect: new D1Dialect({ database: await makeD1Database({ migrations: migrationFilePath }) }),
  });

  console.log('🌱 Creating Seed SQL');

  //Seed Data goes here

  console.log('✅ Seed completed successfully!');
  console.log('🌱 Generating SQL');
  //have the outcome of each dump data into string varables that you then concatenate into a single SQL file
  const table1 = ''
  const table2 = ''

   // Combine and log all SQL
  const allSql = `-- table1\n${table1}\n\n-- table2\n${table2}`;
  //write to the db migrations folder as the last thing to update
  // Import filesystem module

  // Get all the migration files in the directory
  const migrationFiles = fs.readdirSync(migrationFilePath);

  // Sort the migration files to find the last one
  const lastMigrationFile = migrationFiles
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .pop();
  // Keep this, as it is used to generate the SQL file
  if (lastMigrationFile) {
    // Generate a new migration filename with a higher number
    const lastFileNumber = parseInt(lastMigrationFile.split('-')[0] || '0');
    const newFileNumber = (lastFileNumber + 1).toString().padStart(4, '0');
    const newFilename = `${newFileNumber}_seed-data.sql`;
    const outputPath = path.join(migrationFilePath, newFilename);

    // Write the SQL to the new file
    fs.writeFileSync(outputPath, allSql);
    console.log(`Seed SQL written to: ${outputPath}`);
  } else {
    // If no migration files found, create first one
    const outputPath = path.join(migrationFilePath, '001_seed-data.sql');
    fs.writeFileSync(outputPath, allSql);
    console.log(`Seed SQL written to: ${outputPath}`);
  }
  await db.destroy();
  console.log('🌱 SQL generation completed!');
  process.exit(0);
}

// Run the seed function
seed().catch((error) => {
  console.error('Error during seeding:', error);
  process.exit(1);
});
