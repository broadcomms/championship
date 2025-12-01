/**
 * Cleanup script to mark all stuck compliance checks as failed
 * This is needed after deploying the fix to allow users to retry with new code
 */

import { Kysely } from 'kysely';
import { D1Dialect } from './src/common/kysely-d1';
import { DB } from './src/db/auditguard-db/types';

async function cleanupStuckChecks() {
  // This will be run via raindrop CLI, so we'll use environment bindings
  const db = new Kysely<DB>({
    dialect: new D1Dialect({ database: (globalThis as any).AUDITGUARD_DB }),
  });

  // Find all checks stuck in processing for more than 10 minutes
  const tenMinutesAgo = Date.now() - 10 * 60 * 1000;

  const stuckChecks = await db
    .selectFrom('compliance_checks')
    .select(['id', 'created_at', 'framework', 'document_id'])
    .where('status', '=', 'processing')
    .where('created_at', '<', tenMinutesAgo)
    .execute();

  console.log(`Found ${stuckChecks.length} stuck checks to mark as failed`);

  for (const check of stuckChecks) {
    await db
      .updateTable('compliance_checks')
      .set({
        status: 'failed',
        completed_at: Date.now(),
      })
      .where('id', '=', check.id)
      .execute();

    console.log(`✅ Marked check ${check.id} as failed (framework: ${check.framework})`);
  }

  console.log(`\n✅ Cleanup complete! ${stuckChecks.length} checks marked as failed.`);
  console.log('Users can now retry these checks with the new fixed code.');
}

cleanupStuckChecks().catch(console.error);
