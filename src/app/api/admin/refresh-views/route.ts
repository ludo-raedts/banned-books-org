import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { adminClient } from '@/lib/supabase'

export async function POST() {
  const cookieStore = await cookies()
  const session = cookieStore.get('admin_session')?.value
  const secret = process.env.ADMIN_SECRET
  if (!secret || session !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = adminClient()
  const { error } = await supabase.rpc('refresh_all_materialized_views')
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ message: 'Materialized views refreshed.' })
}
