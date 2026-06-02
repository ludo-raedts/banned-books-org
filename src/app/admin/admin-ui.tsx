'use client'

// Shared admin UI primitives — a toast stack and a promise-based confirm modal,
// exposed via context so any admin client component can call ui.toast(...) /
// await ui.confirm(...) instead of rolling its own inline banner or falling back
// to the browser's native alert()/confirm(). No external dependency.

import { createContext, useCallback, useContext, useRef, useState } from 'react'

type ToastType = 'success' | 'error' | 'info'
type Toast = { id: number; message: string; type: ToastType }

type ConfirmOpts = {
  title: string
  body?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

type AdminUi = {
  toast: (message: string, type?: ToastType) => void
  confirm: (opts: ConfirmOpts) => Promise<boolean>
}

const Ctx = createContext<AdminUi | null>(null)

export function useAdminUi(): AdminUi {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAdminUi must be used within AdminUiProvider')
  return ctx
}

export function AdminUiProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [confirmState, setConfirmState] =
    useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null)
  const idRef = useRef(0)

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++idRef.current
    setToasts(t => [...t, { id, message, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000)
  }, [])

  const confirm = useCallback((opts: ConfirmOpts) => {
    return new Promise<boolean>(resolve => setConfirmState({ ...opts, resolve }))
  }, [])

  function closeConfirm(result: boolean) {
    confirmState?.resolve(result)
    setConfirmState(null)
  }

  return (
    <Ctx.Provider value={{ toast, confirm }}>
      {children}

      {/* Toast stack */}
      <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto max-w-sm rounded-lg px-4 py-2.5 text-sm shadow-lg border ${
              t.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : t.type === 'error'
                ? 'bg-red-50 border-red-200 text-red-800'
                : 'bg-gray-900 border-gray-900 text-white'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>

      {/* Confirm modal */}
      {confirmState && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 px-4"
          onClick={() => closeConfirm(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 flex flex-col gap-4"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-gray-900">{confirmState.title}</h2>
            {confirmState.body && (
              <p className="text-sm text-gray-600 whitespace-pre-line">{confirmState.body}</p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => closeConfirm(false)}
                className="px-4 py-2 rounded-lg border border-gray-200 text-sm hover:bg-gray-50 transition-colors"
              >
                {confirmState.cancelLabel ?? 'Cancel'}
              </button>
              <button
                autoFocus
                onClick={() => closeConfirm(true)}
                className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90 ${
                  confirmState.danger ? 'bg-red-600' : 'bg-gray-900'
                }`}
              >
                {confirmState.confirmLabel ?? 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  )
}
