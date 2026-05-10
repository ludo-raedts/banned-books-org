// Temporary SSR timing instrumentation. Remove once homepage perf work lands.
// Toggle off with HOMEPAGE_TIMING=0.

const ENABLED = process.env.HOMEPAGE_TIMING !== '0'

type Extra = Record<string, string | number>

export function newTimer(scope: string) {
  const id = Math.random().toString(36).slice(2, 6)
  const start = performance.now()

  return {
    async wrap<T>(label: string, work: () => PromiseLike<T> | T, extra?: Extra): Promise<T> {
      if (!ENABLED) return work() as Promise<T>
      const t0 = performance.now()
      try {
        return (await work()) as T
      } finally {
        const ms = (performance.now() - t0).toFixed(0)
        const tail = extra ? ' ' + fmt(extra) : ''
        console.log(`[time/${scope}/${id}] ${label} ${ms}ms${tail}`)
      }
    },
    mark(label: string, extra?: Extra) {
      if (!ENABLED) return
      const elapsed = (performance.now() - start).toFixed(0)
      const tail = extra ? ' ' + fmt(extra) : ''
      console.log(`[time/${scope}/${id}] ${label} +${elapsed}ms${tail}`)
    },
    end(label = 'page-fn-end') {
      if (!ENABLED) return
      const ms = (performance.now() - start).toFixed(0)
      console.log(`[time/${scope}/${id}] ${label} ${ms}ms`)
    },
  }
}

function fmt(extra: Extra): string {
  return Object.entries(extra).map(([k, v]) => `${k}=${v}`).join(' ')
}
