import React, { useEffect, useCallback } from 'react';
import { FocusTrap } from 'focus-trap-react';
import styles from './ConfirmDialog.module.css';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  disabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  disabled = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  // Handle Escape key to close dialog
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      onCancel();
    }
  }, [onCancel]);

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevent body scroll when dialog is open
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <FocusTrap
      focusTrapOptions={{
        initialFocus: false,
        allowOutsideClick: true,
        escapeDeactivates: false, // We handle escape manually
      }}
    >
      <div
        className={styles.overlay}
        onClick={onCancel}
        role="presentation"
      >
        <div
          className={styles.dialog}
          onClick={e => e.stopPropagation()}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          aria-describedby="confirm-dialog-message"
        >
          <h3 id="confirm-dialog-title" className={styles.title}>{title}</h3>
          <div id="confirm-dialog-message" className={styles.message}>{message}</div>
          <div className={styles.actions}>
            <button className={styles.cancelButton} onClick={onCancel}>
              {cancelLabel}
            </button>
            <button
              className={`${styles.confirmButton} ${danger ? styles.danger : ''}`}
              onClick={onConfirm}
              disabled={disabled}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </FocusTrap>
  );
}
