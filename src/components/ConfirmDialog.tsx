import type { ReactNode } from "react";
import Modal from "./Modal.tsx";

type ConfirmDialogProps = {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
};

/**
 * Accessible replacement for window.confirm.
 *
 * `Modal` already provides role=dialog, focus trapping, Escape handling and
 * focus restoration. This wrapper standardises the confirm/cancel footer so
 * destructive actions are consistent across the app.
 */
export default function ConfirmDialog({
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  tone = "default",
  pending = false,
  onConfirm,
  onCancel,
  children,
}: ConfirmDialogProps) {
  const confirmClass =
    tone === "danger"
      ? "bg-rose-600 hover:bg-rose-700"
      : "bg-warm-brown hover:opacity-90";

  return (
    <Modal
      title={title}
      description={description}
      onClose={() => {
        if (!pending) onCancel();
      }}
      size="sm"
      footer={
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="flex-1 rounded-xl border border-warm-brown/20 py-2.5 text-sm font-medium text-warm-brown disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className={`flex-1 rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-50 ${confirmClass}`}
          >
            {pending ? "Working…" : confirmLabel}
          </button>
        </div>
      }
    >
      {children}
    </Modal>
  );
}
