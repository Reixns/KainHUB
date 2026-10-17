/*
  Schema-tolerant writes.

  The app writes a handful of columns that a not-yet-migrated database may not
  have (profiles.cover_image, posts.image_url / author_avatar, the orders detail
  columns). PostgREST rejects the *whole statement* when it meets an unknown
  column, so one missing optional field was blocking every other field on the
  same row from saving -- a profile save that could not store a full_name also
  failed to store a mobile number.

  On PGRST204 we learn which column the server does not have, drop just that
  column, and retry. The result is that existing data keeps persisting instead
  of the entire write being lost, and the developer still gets one clear,
  actionable message about the migration that would remove the limitation.

  This is a fallback, not a substitute: the correct fix is to apply
  supabase/schema.sql, after which the first attempt
  succeeds and nothing is dropped.
*/

// PostgREST upsert/insert: Could not find the 'cover_image' column of 'profiles' in the schema cache
const PGRST204_COLUMN = /'([a-z0-9_]+)'\s+column\s+of\s+'([a-z0-9_]+)'/i;
// Postgres/PostgREST select: column profiles.cover_image does not exist
const PG42703_COLUMN = /column\s+([a-z0-9_]+)\.([a-z0-9_]+)\s+does\s+not\s+exist/i;

// Both spellings mean "this server has no such column". The code differs by
// which layer rejects the statement, so accept either rather than only the one
// seen in a given session.
const UNSUPPORTED_COLUMN_CODES = new Set(['PGRST204', '42703']);

// table -> Set of columns this server does not have
const unsupported = new Map();

/** Columns known to be absent for a table. Useful for diagnostics. */
export function unsupportedColumns(table) {
  return [...(unsupported.get(table) || [])];
}

/** True once every value in `values` is supported, i.e. nothing will be dropped. */
export function isFullySupported(table) {
  return !unsupported.has(table);
}

function stripUnsupported(table, values) {
  const skip = unsupported.get(table);
  if (!skip || skip.size === 0) return values;
  const out = { ...values };
  let removed = 0;
  for (const column of skip) {
    if (column in out) {
      delete out[column];
      removed++;
    }
  }
  return removed === 0 ? values : out;
}

/**
 * Identify which column a schema error is complaining about.
 * Returns `{ column, table }` or null. Exported for diagnostics and tests.
 */
export function parseUnsupportedColumn(table, error) {
  if (!UNSUPPORTED_COLUMN_CODES.has(error?.code)) return null;
  const message = error.message || '';

  const pgRest = PGRST204_COLUMN.exec(message);
  if (pgRest) return { column: pgRest[1], table: pgRest[2] };

  const pg = PG42703_COLUMN.exec(message);
  if (pg) return { table: pg[1], column: pg[2] };

  return null;
}

// Returns the learned column name, or null if this was not a learnable
// "unknown column" failure.
function learnMissingColumn(table, error) {
  const found = parseUnsupportedColumn(table, error);
  if (!found || found.table !== table) return null;
  if (!unsupported.has(table)) unsupported.set(table, new Set());
  unsupported.get(table).add(found.column);
  return found.column;
}

const warned = new Set();

/**
 * Run a write, retrying without any column the server reports it does not have.
 *
 * @param {object} options
 * @param {string} options.table       Table being written, used to scope learning.
 * @param {object} options.values      The full row/record to write.
 * @param {(values: object) => PromiseLike<any>} options.run
 *        Builds and executes a fresh request. Must be called once per attempt,
 *        because a PostgREST builder cannot be re-executed after it resolves.
 * @param {(error: any) => void} [options.onError]
 *        Called only for errors that retrying cannot fix.
 * @param {number} [options.maxPasses] Safety valve; one per distinct column.
 */
export async function writeTolerant({ table, values, run, onError, maxPasses = 8 }) {
  let last = { data: null, error: null };
  for (let pass = 0; pass < maxPasses; pass++) {
    try {
      last = await run(stripUnsupported(table, values));
    } catch (err) {
      // Network/transport failures: treat as error without retrying for column
      // mismatches, and surface it via onError so callers can handle it.
      onError?.(err);
      return { data: null, error: err };
    }
    const error = last?.error;
    if (!error) return last;

    const column = learnMissingColumn(table, error);
    if (!column) {
      // Not something a retry can fix. Report it.
      onError?.(error);
      return last;
    }

    if (!warned.has(table)) {
      warned.add(table);
      console.warn(
        `[supabase] "${table}" has no "${column}" column, so it is being skipped for this session. ` +
        'Other fields on this row still save. Run supabase/schema.sql ' +
        'in the Supabase SQL editor to store it properly.'
      );
    }  }
  // Exhausted: should be unreachable, but surface whatever we last saw.
  if (last?.error) onError?.(last.error);
  return last;
}

/**
 * Upsert a notification keyed by its recipient and legacy id.
 *
 * Postgres refuses `ON CONFLICT` with SQLSTATE 42P10 when the matching unique
 * index is missing, so fall back to an explicit lookup and write while the
 * schema is being migrated.
 */
export async function upsertNotification(client, values, onError) {
  const merged = await client
    .from('notifications')
    .upsert(values, { onConflict: 'user_id,legacy_id' });

  if (!merged.error) return merged;

  if (merged.error.code !== '42P10') {
    onError?.(merged.error);
    return merged;
  }

  const key = 'notifications:user_id,legacy_id';
  if (!warned.has(key)) {
    warned.add(key);
    console.warn(
      '[supabase] "notifications(user_id, legacy_id)" has no unique index, so the upsert was split into ' +
      'read-then-write. Run supabase/schema.sql in the Supabase ' +
      'SQL editor to restore a single-statement upsert.'
    );
  }

  const { data: existing, error: lookupError } = await client
    .from('notifications')
    .select('id')
    .eq('user_id', values.user_id)
    .eq('legacy_id', values.legacy_id)
    .maybeSingle();

  if (lookupError) {
    onError?.(lookupError);
    return { data: null, error: lookupError };
  }

  const result = existing
    ? await client.from('notifications').update(values).eq('id', existing.id)
    : await client.from('notifications').insert(values);

  if (result.error) onError?.(result.error);
  return result;
}
