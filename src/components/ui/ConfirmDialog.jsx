import { AlertTriangle } from 'lucide-react'
import Modal from './Modal'

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Delete',
  danger = true,
  submitting = false,
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <div className="flex gap-3">
        <span
          className={`h-9 w-9 shrink-0 rounded-full flex items-center justify-center ${
            danger ? 'bg-rust-light text-rust' : 'bg-amber-light text-ink'
          }`}
        >
          <AlertTriangle size={17} />
        </span>
        <p className="text-sm text-ink-soft pt-1.5">{message}</p>
      </div>
      <div className="flex items-center justify-end gap-2 mt-5">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-lg text-sm font-medium text-ink-soft hover:bg-paper"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={submitting}
          className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-60 ${
            danger ? 'bg-rust hover:bg-rust/90' : 'bg-blueprint-dark hover:bg-blueprint'
          }`}
        >
          {submitting ? 'Working…' : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
