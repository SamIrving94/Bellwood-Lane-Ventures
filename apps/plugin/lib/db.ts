/**
 * Lazy access to @repo/database.
 *
 * Importing @repo/database validates DATABASE_URL at module load. The
 * public plugin's planning tools never touch the database, so a top-level
 * import would make it fail to build or boot on a project without database
 * config. ask_kept_to_call and the Pro routes load it on first use instead:
 * the planning tools work on their own, and the rest start working once
 * DATABASE_URL is set.
 */

type Database = typeof import('@repo/database')['database'];

let cached: Promise<Database> | null = null;

export function db(): Promise<Database> {
  cached ??= import('@repo/database').then((m) => m.database);
  return cached;
}
