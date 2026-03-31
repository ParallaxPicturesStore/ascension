/**
 * Runs Ascension database migrations against Supabase.
 * Usage: node scripts/migrate.js <DATABASE_URL>
 *
 * Get your DATABASE_URL from:
 * Supabase Dashboard → Settings → Database → Connection string → URI (Direct connection)
 * It looks like: postgresql://postgres:[PASSWORD]@db.flrllorqzmbztvtccvab.supabase.co:5432/postgres
 */

const { Client } = require("pg");

const MIGRATIONS = [
  {
    name: "add_subscription_lapse_columns",
    sql: `
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS subscription_lapse_date TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS app_disabled BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS lapse_reminders_sent JSONB DEFAULT '[]';
    `,
  },
];

async function run() {
  const dbUrl = process.argv[2] || process.env.DATABASE_URL;

  if (!dbUrl) {
    console.error(
      "Usage: node scripts/migrate.js <DATABASE_URL>\n" +
        "Get your connection string from: Supabase → Settings → Database → Connection string (URI)"
    );
    process.exit(1);
  }

  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();
    console.log("Connected to database\n");

    for (const migration of MIGRATIONS) {
      console.log(`Running: ${migration.name}...`);
      await client.query(migration.sql);
      console.log(`  Done\n`);
    }

    // Verify columns exist
    const result = await client.query(
      `SELECT column_name, data_type
       FROM information_schema.columns
       WHERE table_name = 'users'
       AND column_name IN ('subscription_lapse_date', 'app_disabled', 'lapse_reminders_sent')
       ORDER BY column_name`
    );

    console.log("Columns verified:");
    result.rows.forEach((r) => console.log(`  ${r.column_name} (${r.data_type})`));
    console.log("\nMigration complete.");
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
