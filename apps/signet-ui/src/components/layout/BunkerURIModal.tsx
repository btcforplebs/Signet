import React, { useState, useEffect, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Link2, Loader2, Copy, RefreshCw } from 'lucide-react';
import { generateConnectionToken } from '../../lib/api-client.js';
import { copyToClipboard } from '../../lib/clipboard.js';
import styles from './BunkerURIModal.module.css';

interface BunkerURIModalProps {
  open: boolean;
  keyName: string;
  onClose: () => void;
}

export function BunkerURIModal({
  open,
  keyName,
  onClose,
}: BunkerURIModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bunkerUri, setBunkerUri] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [copied, setCopied] = useState(false);

  const generateToken = useCallback(async () => {
    setLoading(true);
    setError(null);
    setCopied(false);
    try {
      const result = await generateConnectionToken(keyName);
      if (result.ok && result.bunkerUri) {
        setBunkerUri(result.bunkerUri);
        if (result.expiresAt) {
          setExpiresAt(new Date(result.expiresAt));
        }
      } else {
        setError(result.error ?? 'Failed to generate token');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate token');
    } finally {
      setLoading(false);
    }
  }, [keyName]);

  // Generate token when modal opens
  useEffect(() => {
    if (open) {
      generateToken();
    } else {
      // Reset state when closed
      setBunkerUri(null);
      setExpiresAt(null);
      setRemainingSeconds(0);
      setError(null);
      setCopied(false);
    }
  }, [open, generateToken]);

  // Countdown timer
  useEffect(() => {
    if (!expiresAt) return;

    const updateRemaining = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((expiresAt.getTime() - now) / 1000));
      setRemainingSeconds(remaining);
    };

    updateRemaining();
    const interval = setInterval(updateRemaining, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const handleCopy = useCallback(async () => {
    if (bunkerUri) {
      const success = await copyToClipboard(bunkerUri);
      if (success) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  }, [bunkerUri]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  if (!open) return null;

  const isExpired = remainingSeconds <= 0 && expiresAt !== null;
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const timerClass = remainingSeconds <= 60 ? styles.timerWarning : styles.timer;

  return (
    <div className={styles.overlay} onClick={onClose} onKeyDown={handleKeyDown}>
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bunker-uri-modal-title"
      >
        <div className={styles.header}>
          <div className={styles.icon}>
            <Link2 size={20} />
          </div>
          <div>
            <h2 id="bunker-uri-modal-title" className={styles.title}>
              Bunker URI
            </h2>
            <p className={styles.keyName}>{keyName}</p>
          </div>
        </div>

        <div className={styles.content}>
          {loading ? (
            <div className={styles.qrPlaceholder}>
              <Loader2 size={32} className={styles.spinning} />
              <span className={styles.loadingText}>Generating...</span>
            </div>
          ) : error ? (
            <div className={styles.qrPlaceholder}>
              <span className={styles.errorText}>{error}</span>
              <button
                type="button"
                className={styles.retryButton}
                onClick={generateToken}
              >
                <RefreshCw size={14} />
                Retry
              </button>
            </div>
          ) : bunkerUri ? (
            <>
              <div className={`${styles.qrContainer} ${isExpired ? styles.qrExpired : ''}`}>
                <QRCodeSVG
                  value={bunkerUri}
                  size={200}
                  level="M"
                  bgColor="#ffffff"
                  fgColor="#000000"
                />
                {isExpired && (
                  <div className={styles.expiredOverlay}>
                    <span>Expired</span>
                  </div>
                )}
              </div>

              {isExpired ? (
                <p className={styles.expiredText}>Token expired</p>
              ) : (
                <p className={timerClass}>
                  Expires in {minutes}:{seconds.toString().padStart(2, '0')}
                </p>
              )}

              <div className={styles.actions}>
                {isExpired ? (
                  <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={generateToken}
                  >
                    <RefreshCw size={14} />
                    Generate New
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className={`${styles.secondaryButton} ${copied ? styles.copied : ''}`}
                      onClick={handleCopy}
                    >
                      <Copy size={14} />
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                    <button
                      type="button"
                      className={styles.primaryButton}
                      onClick={generateToken}
                    >
                      <RefreshCw size={14} />
                      New
                    </button>
                  </>
                )}
              </div>
            </>
          ) : null}
        </div>

        <button
          type="button"
          className={styles.closeButton}
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>
  );
}
