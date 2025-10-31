#!/usr/bin/env zx
// How to write scripts with zx: https://google.github.io/zx/
import { $, glob, chalk, argv, tmpfile, fs } from 'zx';
import { makeD1Database } from '@liquidmetal-ai/in-memory-d1';
import Database from 'better-sqlite3';

// Get the database name from the db folder tree
const dbFolders = await fs.readdir('./db');

if (dbFolders.length === 0) {
  console.error('No database folder found under ./db');
  process.exit(1);
}

// Use the first folder found as the database name
// This assumes there's only one database or we want the first one

for (const dbName of dbFolders) {
  console.log(`Using database: ${chalk.blue(dbName)}`);
  const migrationFolderBasepath = `./db/${dbName}`;

  // first, check to see if anything is in the folder based on migrationFolderBasepath
  const migrationFiles = await glob(`${migrationFolderBasepath}/*.sql`);
  if (migrationFiles.length === 0) {
    console.log('No migrations found. Creating migration folder and files.');
    // Create the directory if it doesn't exist
    await fs.mkdir(migrationFolderBasepath, { recursive: true });

    // generate a prisma migration from empty
    await $`npx prisma migrate diff --from-empty --to-schema-datamodel ./prisma/${dbName}/schema.prisma --script --output ${migrationFolderBasepath}/0000_init.sql`;
    process.exit(0);
  }

  const database1 = await makeD1Database({
    migrations: migrationFolderBasepath,
  });
  const sqlData = await database1
    .prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%';`)
    .raw();

  console.log('Creating SQLite database file for Prisma');
  // // Create a temporary directory using Node's os.tmpdir()
  const randomId = Math.random().toString(36).substring(2, 10);
  const tempFile = tmpfile(`prisma-diff-${randomId}`);

  // Need to create a new database file for Prisma to compare against
  const db = new Database(tempFile);
  // Create the tables in the database
  for (const [sql] of sqlData) {
    db.exec(sql as string);
  }
  db.close();

  // Generate migration name: use argv._[0] or next number with Unix timestamp
  let migrationName: string;
  if (argv._[0]) {
    migrationName = argv._[0];
  } else {
    // Find the highest numbered migration to get the next number
    const existingMigrations = await glob(`${migrationFolderBasepath}/*.sql`);
    const migrationNumbers = existingMigrations
      .map((file) => {
        const match = file.match(/(\d+)_/);
        return match ? parseInt(match[1]!) : -1;
      })
      .filter((num) => num >= 0);

    const nextNumber = Math.max(...migrationNumbers, -1) + 1;
    const timestamp = Math.floor(Date.now() / 1000); // Unix timestamp
    migrationName = `${nextNumber.toString().padStart(4, '0')}_${timestamp}`;
  }

  console.log(`Migration name: ${migrationName}`);
  const migrationFilePath = `${migrationFolderBasepath}/${migrationName}.sql`;

  console.log('Created migration: ' + chalk.green(migrationFilePath));

  // Use `npx prisma migrate diff` to generate a SQL script that takes the difference
  // between your database and the Prisma schema, then saves it to the migration file.
  const diffFlags = [
    '--from-url',
    `file:${tempFile}`,
    '--to-schema-datamodel',
    `./prisma/${dbName}/schema.prisma`,
    '--script',
    '--output',
    migrationFilePath,
  ];

  await $`npx prisma migrate diff ${diffFlags}`;
  console.log(`Migration created: ${migrationFilePath}`);

  // Clean up the temporary directory
  await fs.rm(tempFile, { recursive: true, force: true });
}

process.exit(0);
