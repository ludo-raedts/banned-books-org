import { Client } from 'pg'

async function main() {
  const url = process.env.DIRECT_URL!
  const c = new Client({ connectionString: url })
  await c.connect()
  const r = await c.query(`SELECT e.extname, n.nspname AS schema, e.extversion FROM pg_extension e JOIN pg_namespace n ON e.extnamespace = n.oid ORDER BY e.extname`)
  for (const row of r.rows) console.log(row.extname.padEnd(20), row.schema.padEnd(15), row.extversion)
  await c.end()
}
main().catch(e => { console.error(e.message); process.exit(1) })
