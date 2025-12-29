import React, { useState } from 'react';
import type { DisplayRequest, RequestMeta, TrustLevel } from '@signet/types';
import { getEventKindLabel, getMethodInfo, getTrustLevelInfo } from '../../lib/event-labels.js';
import { formatTtl, truncateContent } from '../../lib/formatters.js';
import styles from './RequestCard.module.css';

interface RequestCardProps {
  request: DisplayRequest;
  meta: RequestMeta;
  password: string;
  selectionMode: boolean;
  selected: boolean;
  onPasswordChange: (password: string) => void;
  onApprove: (trustLevel?: TrustLevel, alwaysAllow?: boolean) => void;
  onSelect: () => void;
  onViewDetails: () => void;
}

export function RequestCard({
  request,
  meta,
  password,
  selectionMode,
  selected,
  onPasswordChange,
  onApprove,
  onSelect,
  onViewDetails,
}: RequestCardProps) {
  const [selectedTrustLevel, setSelectedTrustLevel] = useState<TrustLevel>('reasonable');
  const [alwaysAllow, setAlwaysAllow] = useState(false);

  const { Icon: MethodIcon, category } = getMethodInfo(request.method);
  const isApproving = meta.state === 'approving';
  const isPending = request.state === 'pending';
  const canApprove = isPending && !isApproving;

  const trustLevels: TrustLevel[] = ['paranoid', 'reasonable', 'full'];

  // For completed events, show event kind inline
  const eventKindLabel = request.eventPreview ? getEventKindLabel(request.eventPreview.kind) : null;
  const showCompact = !isPending;

  return (
    <div className={`${styles.card} ${styles[request.state]} ${showCompact ? styles.compact : ''}`}>
      <div className={styles.header}>
        {selectionMode && isPending && (
          <input
            type="checkbox"
            checked={selected}
            onChange={onSelect}
            className={styles.checkbox}
            aria-label={`Select request ${request.id}`}
          />
        )}
        <div className={styles.method}>
          <span className={styles.methodIcon} aria-hidden="true">
            <MethodIcon size={16} />
          </span>
          <span className={styles.methodName}>
            {request.method}
            {eventKindLabel && <span className={styles.eventKindInline}>({eventKindLabel})</span>}
          </span>
        </div>
        <div className={styles.headerRight}>
          <button
            className={styles.detailsButton}
            onClick={onViewDetails}
            aria-label="View request details"
          >
            Details
          </button>
          <div className={styles.status}>
            {request.state === 'pending' && (
              <span className={styles.ttl}>{formatTtl(request.ttl)}</span>
            )}
            {request.state === 'expired' && (
              <span className={styles.expired}>Expired</span>
            )}
            {request.state === 'approved' && (
              <span className={styles.approved}>Approved</span>
            )}
          </div>
        </div>
      </div>

      <div className={styles.details}>
        <div className={styles.meta}>
          {request.keyName && (
            <span className={styles.keyName}>{request.keyName}</span>
          )}
          <span className={styles.separator}>•</span>
          <span className={styles.npub} title={request.remotePubkey}>
            {request.npub.slice(0, 12)}...{request.npub.slice(-6)}
          </span>
          <span className={styles.separator}>•</span>
          <span className={styles.time}>{request.createdLabel}</span>
        </div>

        {isPending && request.eventPreview && (
          <div className={styles.eventPreview}>
            <div className={styles.eventKind}>
              {getEventKindLabel(request.eventPreview.kind)}
            </div>
            {request.eventPreview.content && (
              <div className={styles.eventContent}>
                {truncateContent(request.eventPreview.content)}
              </div>
            )}
          </div>
        )}
      </div>

      {isPending && (
        <div className={styles.actions}>
          {request.requiresPassword && (
            <input
              type="password"
              placeholder="Key passphrase"
              value={password}
              onChange={(e) => onPasswordChange(e.target.value)}
              className={styles.passwordInput}
              disabled={isApproving}
              aria-label="Key passphrase"
            />
          )}
          {request.method === 'connect' ? (
            <div className={styles.connectActions}>
              <div className={styles.trustOptions}>
                <span className={styles.trustLabel}>Trust level:</span>
                {trustLevels.map((level) => {
                  const info = getTrustLevelInfo(level);
                  return (
                    <label key={level} className={styles.trustOption}>
                      <input
                        type="radio"
                        name={`trust-${request.id}`}
                        value={level}
                        checked={selectedTrustLevel === level}
                        onChange={() => setSelectedTrustLevel(level)}
                        disabled={isApproving}
                        className={styles.trustRadio}
                      />
                      <span className={`${styles.trustOptionLabel} ${styles[level]}`}>
                        <info.Icon size={14} aria-hidden="true" />
                        <span>{info.label}</span>
                      </span>
                      <span className={styles.trustDescription}>{info.description}</span>
                    </label>
                  );
                })}
              </div>
              <button
                className={styles.connectButton}
                onClick={() => onApprove(selectedTrustLevel)}
                disabled={!canApprove}
              >
                {isApproving ? 'Connecting...' : 'Connect'}
              </button>
            </div>
          ) : (
            <div className={styles.approveActions}>
              <label className={styles.alwaysAllowLabel}>
                <input
                  type="checkbox"
                  checked={alwaysAllow}
                  onChange={(e) => setAlwaysAllow(e.target.checked)}
                  disabled={isApproving}
                  className={styles.alwaysAllowCheckbox}
                />
                <span>Always allow this action</span>
              </label>
              <button
                className={styles.approveButton}
                onClick={() => onApprove(undefined, alwaysAllow)}
                disabled={!canApprove}
              >
                {isApproving ? 'Approving...' : 'Approve'}
              </button>
            </div>
          )}
        </div>
      )}

      {meta.state === 'error' && (
        <div className={styles.error} role="alert">{meta.message}</div>
      )}
    </div>
  );
}
