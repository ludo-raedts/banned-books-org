import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { adminClient } from '@/lib/supabase'

export async function POST() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const supabase = adminClient()
  const { error } = await supabase.rpc('refresh_all_materialized_views')
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ message: 'Materialized views refreshed.' })
}
