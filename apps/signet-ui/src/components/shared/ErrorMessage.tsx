import React from 'react';
import { getHelpfulErrorMessage } from '../../lib/formatters.js';
import { ErrorIcon, RefreshIcon } from './Icons.js';
import styles from './ErrorMessage.module.css';

interface ErrorMessageProps {
  error: string;
  onRetry?: () => void;
  retrying?: boolean;
}

export function ErrorMessage({ error, onRetry, retrying = false }: ErrorMessageProps) {
  const helpful = getHelpfulErrorMessage(error);

  return (
    <div className={styles.container} role="alert">
      <div className={styles.iconWrapper}>
        <ErrorIcon size={20} className={styles.icon} aria-hidden="true" />
      </div>
      <div className={styles.content}>
        <span className={styles.message}>{helpful.message}</span>
        {helpful.action && (
          <span className={styles.action}>{helpful.action}</span>
        )}
      </div>
      {onRetry && helpful.canRetry && (
        <button
          className={styles.retryButton}
          onClick={onRetry}
          disabled={retrying}
          aria-label="Retry"
        >
          <RefreshIcon size={16} className={retrying ? styles.spinning : ''} aria-hidden="true" />
          {retrying ? 'Retrying...' : 'Retry'}
        </button>
      )}
    </div>
  );
}
