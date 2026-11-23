'use client';
import { useEffect, useRef } from 'react';

/** Native <dialog> → focus trap, Esc to close and backdrop for free; used for every irreversible action. */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  danger,
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog ref={ref} className="confirm" onCancel={(e) => { e.preventDefault(); onCancel(); }} aria-labelledby="confirm-title">
      <h2 id="confirm-title" style={{ fontSize: '1.25rem' }}>{title}</h2>
      <div className="muted" style={{ marginBottom: '1.25rem' }}>{children}</div>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn" onClick={onCancel} disabled={busy} autoFocus>Cancel</button>
        <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm} disabled={busy}>
          {busy ? 'Working…' : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
