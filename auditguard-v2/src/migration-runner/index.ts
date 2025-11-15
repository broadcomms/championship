// Migration runner: Make subscription periods nullable
// Run this once to apply the database migration

interface Env {
  DB: any;
  ADMIN_SECRET?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Simple authentication check
    const authHeader = request.headers.get('Authorization');
    if (authHeader !== `Bearer ${env.ADMIN_SECRET}`) {
      return new Response('Unauthorized', { status: 401 });
    }

    const db = env.DB;

    try {
      console.log('Starting migration: Make subscription periods nullable');

      // Create new table with nullable period fields
      await db.exec(`
        CREATE TABLE subscriptions_new (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          plan_id TEXT NOT NULL REFERENCES subscription_plans(id),
          stripe_customer_id TEXT,
          stripe_subscription_id TEXT,
          status TEXT NOT NULL CHECK(status IN ('active', 'canceled', 'incomplete', 'incomplete_expired', 'past_due', 'trialing', 'paused')),
          current_period_start INTEGER,
          current_period_end INTEGER,
          cancel_at_period_end INTEGER DEFAULT 0,
          trial_end INTEGER,
          stripe_price_id TEXT,
          canceled_at INTEGER,
          trial_start INTEGER,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )
      `);
      console.log('Created new subscriptions table');

      // Copy existing data
      await db.exec(`
        INSERT INTO subscriptions_new
        SELECT id, workspace_id, plan_id, stripe_customer_id, stripe_subscription_id,
               status, current_period_start, current_period_end, cancel_at_period_end,
               trial_end, stripe_price_id, canceled_at, trial_start,
               created_at, updated_at
        FROM subscriptions
      `);
      console.log('Copied existing data');

      // Drop old table
      await db.exec('DROP TABLE subscriptions');
      console.log('Dropped old table');

      // Rename new table
      await db.exec('ALTER TABLE subscriptions_new RENAME TO subscriptions');
      console.log('Renamed new table');

      // Recreate indexes
      await db.exec('CREATE INDEX idx_subscriptions_workspace ON subscriptions(workspace_id)');
      await db.exec('CREATE INDEX idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id)');
      console.log('Recreated indexes');

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Migration completed: subscription periods are now nullable',
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );
    } catch (error: any) {
      console.error('Migration failed:', error);
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message,
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  },
};
