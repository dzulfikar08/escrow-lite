export function getDb(env: any): D1Database {
  if (!env.DB) {
    throw new Error('D1 database binding not found');
  }
  return env.DB;
}
