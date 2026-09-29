import { X } from 'lucide-react'
import { useUi } from '@/state/ui-store'
import './Toasts.css'

export function Toasts() {
  const toasts = useUi((s) => s.toasts)
  const dismissToast = useUi((s) => s.dismissToast)

  if (toasts.length === 0) return null

  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast toast--${toast.kind}`}
          role={toast.kind === 'error' ? 'alert' : 'status'}
        >
          <span className="toast__message">{toast.message}</span>
          {toast.action && (
            <button
              type="button"
              className="toast__action"
              onClick={() => {
                toast.action?.run()
                dismissToast(toast.id)
              }}
            >
              {toast.action.label}
            </button>
          )}
          <button
            type="button"
            className="toast__close"
            aria-label="Dismiss notification"
            onClick={() => dismissToast(toast.id)}
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
