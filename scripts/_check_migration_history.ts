import { Client } from 'pg'
async function main() {
  const url = process.env.DIRECT_URL!
  const c = new Client({ connectionString: url })
  await c.connect()
  const r = await c.query(
    "SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version"
  )
  console.log(`row count: ${r.rows.length}`)
  for (const row of r.rows) console.log('  ', row.version, '|', row.name ?? '(null name)')
  await c.end()
}
main().catch(e => { console.error(e.message); process.exit(1) })
