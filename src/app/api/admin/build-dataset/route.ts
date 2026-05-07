import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { spawn } from 'node:child_process'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST() {
  const cookieStore = await cookies()
  const session = cookieStore.get('admin_session')?.value
  const secret = process.env.ADMIN_SECRET
  if (!secret || session !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Vercel's runtime filesystem is read-only — rebuilds happen at deploy time
  // via the build command. We surface that explicitly rather than fail with ENOENT.
  if (process.env.VERCEL === '1') {
    return NextResponse.json({
      error: 'In production the dataset rebuilds on every deploy. Trigger a redeploy to refresh.',
    }, { status: 400 })
  }

  try {
    const { stdout, stderr, code } = await runBuild()
    if (code !== 0) {
      return NextResponse.json({
        error: 'Build script exited non-zero',
        code, stderr: stderr.slice(-2000),
      }, { status: 500 })
    }
    return NextResponse.json({
      message: 'Dataset rebuilt.',
      output: stdout.slice(-500),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

function runBuild() {
  return new Promise<{ stdout: string; stderr: string; code: number }>((resolve, reject) => {
    const child = spawn('pnpm', ['build:dataset'], {
      cwd: process.cwd(),
      env: process.env,
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d) => { stdout += d.toString() })
    child.stderr.on('data', (d) => { stderr += d.toString() })
    child.on('error', reject)
    child.on('close', (code) => resolve({ stdout, stderr, code: code ?? -1 }))
  })
}
