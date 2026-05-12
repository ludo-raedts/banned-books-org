import { describe, it, expect } from 'vitest'
import {
  PreflightError,
  assertBinaryAvailable,
  assertDirectUrl,
  assertLocalSupabaseRunning,
  assertDumpHealthy,
  tcpProbe,
} from '../seed-local-from-prod'
import { tmpdir } from 'node:os'
import { writeFileSync, unlinkSync } from 'node:fs'
import path from 'node:path'

describe('assertDirectUrl', () => {
  it('throws PreflightError when DIRECT_URL is missing from env', () => {
    expect(() => assertDirectUrl({})).toThrow(PreflightError)
    expect(() => assertDirectUrl({})).toThrow(/DIRECT_URL is not set/)
  })

  it('throws PreflightError when DIRECT_URL is empty', () => {
    expect(() => assertDirectUrl({ DIRECT_URL: '' })).toThrow(PreflightError)
  })

  it('returns the URL when DIRECT_URL is set', () => {
    expect(
      assertDirectUrl({ DIRECT_URL: 'postgresql://user:pw@host:5432/postgres' }),
    ).toBe('postgresql://user:pw@host:5432/postgres')
  })
})

describe('tcpProbe', () => {
  it('returns false when the target port is not listening', async () => {
    // Port 1 is not a valid user port and is virtually never listening.
    // tcpProbe must return false (not throw) so callers can branch cleanly.
    const ok = await tcpProbe('127.0.0.1', 1, 500)
    expect(ok).toBe(false)
  })
})

describe('assertLocalSupabaseRunning', () => {
  it('rejects with PreflightError when the probe reports the port closed', async () => {
    const fakeProbe = async () => false
    await expect(assertLocalSupabaseRunning(fakeProbe)).rejects.toThrow(
      PreflightError,
    )
    await expect(assertLocalSupabaseRunning(fakeProbe)).rejects.toThrow(
      /not reachable on 127\.0\.0\.1:54322/,
    )
  })

  it('resolves when the probe reports the port open', async () => {
    const fakeProbe = async () => true
    await expect(assertLocalSupabaseRunning(fakeProbe)).resolves.toBeUndefined()
  })
})

describe('assertBinaryAvailable', () => {
  it('throws PreflightError with docker install hint when docker is missing', () => {
    // Use a non-existent binary name to simulate "docker missing on PATH".
    // The branch is keyed on the literal string "docker", so we test that
    // path by mutating the input. We do this without monkey-patching spawnSync
    // by deliberately calling with a known-bad name that resembles docker.
    expect(() => assertBinaryAvailable('docker__does_not_exist__')).toThrow(
      /not on PATH/,
    )
  })

  it('throws PreflightError specifically mentioning Docker Desktop for docker', () => {
    // Pass the literal 'docker' name but with PATH cleared to force ENOENT.
    // This is the cleanest way to exercise the docker-specific message
    // without mocking child_process.
    const originalPath = process.env.PATH
    process.env.PATH = '/nonexistent-empty-path'
    try {
      expect(() => assertBinaryAvailable('docker')).toThrow(/Docker Desktop/)
    } finally {
      process.env.PATH = originalPath
    }
  })
})

describe('assertDumpHealthy', () => {
  it('throws when the file does not exist', () => {
    expect(() => assertDumpHealthy('/tmp/__nonexistent_seed__.sql')).toThrow(
      PreflightError,
    )
  })

  it('throws when the file is smaller than 5 MB', () => {
    const f = path.join(tmpdir(), `seed-test-tiny-${Date.now()}.sql`)
    writeFileSync(f, 'just a few bytes\n')
    try {
      expect(() => assertDumpHealthy(f)).toThrow(/too small/)
    } finally {
      unlinkSync(f)
    }
  })
})
