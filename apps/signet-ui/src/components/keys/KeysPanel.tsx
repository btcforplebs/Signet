import React, { useState, useMemo } from 'react';
import type { KeyInfo, ConnectedApp } from '@signet/types';
import { LoadingSpinner } from '../shared/LoadingSpinner.js';
import { ConfirmDialog } from '../shared/ConfirmDialog.js';
import { QRModal } from '../shared/QRModal.js';
import { PageHeader } from '../shared/PageHeader.js';
import { Key } from 'lucide-react';
import { CreateKeyForm } from './CreateKeyForm.js';
import { KeyCard } from './KeyCard.js';
import styles from './KeysPanel.module.css';

interface KeysPanelProps {
  keys: KeyInfo[];
  apps: ConnectedApp[];
  loading: boolean;
  error: string | null;
  creating: boolean;
  deleting: boolean;
  unlocking: string | null;
  locking: string | null;
  renaming: boolean;
  settingPassphrase: boolean;
  onCreateKey: (data: { keyName: string; passphrase?: string; nsec?: string }) => Promise<KeyInfo | null>;
  onDeleteKey: (keyName: string, passphrase?: string) => Promise<{ success: boolean; revokedApps?: number }>;
  onUnlockKey: (keyName: string, passphrase: string) => Promise<boolean>;
  onLockKey: (keyName: string) => Promise<boolean>;
  onRenameKey: (keyName: string, newName: string) => Promise<boolean>;
  onSetPassphrase: (keyName: string, passphrase: string) => Promise<boolean>;
  onClearError: () => void;
}

export function KeysPanel({
  keys,
  apps,
  loading,
  error,
  creating,
  deleting,
  unlocking,
  locking,
  renaming,
  settingPassphrase,
  onCreateKey,
  onDeleteKey,
  onUnlockKey,
  onLockKey,
  onRenameKey,
  onSetPassphrase,
  onClearError,
}: KeysPanelProps) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<KeyInfo | null>(null);
  const [deletePassphrase, setDeletePassphrase] = useState('');
  const [qrModal, setQrModal] = useState<{ value: string; title: string } | null>(null);

  const now = useMemo(() => Date.now(), [keys]);

  const getAppsForKey = (keyName: string): ConnectedApp[] => {
    return apps.filter(app => app.keyName === keyName);
  };

  const isKeyEncrypted = (key: KeyInfo): boolean => {
    return key.status === 'locked';
  };

  const handleCreateKey = async (data: { keyName: string; passphrase?: string; nsec?: string }): Promise<boolean> => {
    const result = await onCreateKey(data);
    if (result) {
      setShowCreateForm(false);
      return true;
    }
    return false;
  };

  const handleDeleteClick = (key: KeyInfo) => {
    setDeleteConfirm(key);
    setDeletePassphrase('');
    onClearError();
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;

    const needsPassphrase = isKeyEncrypted(deleteConfirm);
    if (needsPassphrase && !deletePassphrase.trim()) {
      return;
    }

    const result = await onDeleteKey(
      deleteConfirm.name,
      needsPassphrase ? deletePassphrase : undefined
    );

    if (result.success) {
      setDeleteConfirm(null);
      setDeletePassphrase('');
      setExpandedKey(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirm(null);
    setDeletePassphrase('');
    onClearError();
  };

  const handleToggleExpand = (keyName: string) => {
    setExpandedKey(expandedKey === keyName ? null : keyName);
  };

  const handleRename = async (keyName: string, newName: string): Promise<boolean> => {
    const success = await onRenameKey(keyName, newName);
    if (success) {
      setExpandedKey(newName);
    }
    return success;
  };

  if (loading && keys.length === 0) {
    return <LoadingSpinner text="Loading keys..." />;
  }

  return (
    <div className={styles.container}>
      <PageHeader
        title="Keys"
        count={keys.length}
        action={
          <button
            type="button"
            className={styles.addButton}
            onClick={() => {
              setShowCreateForm(!showCreateForm);
              onClearError();
            }}
          >
            {showCreateForm ? 'Cancel' : '+ Add Key'}
          </button>
        }
      />

      {error && <div className={styles.error}>{error}</div>}

      {showCreateForm && (
        <CreateKeyForm
          creating={creating}
          onSubmit={handleCreateKey}
          onCancel={() => setShowCreateForm(false)}
        />
      )}

      {keys.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <Key size={48} />
          </div>
          <p>No keys configured</p>
          <p className={styles.emptyHint}>Add your first key to get started</p>
        </div>
      ) : (
        <div className={styles.keyList}>
          {keys.map(key => (
            <KeyCard
              key={key.name}
              keyInfo={key}
              apps={getAppsForKey(key.name)}
              expanded={expandedKey === key.name}
              now={now}
              unlocking={unlocking}
              locking={locking}
              renaming={renaming}
              settingPassphrase={settingPassphrase}
              onToggleExpand={() => handleToggleExpand(key.name)}
              onUnlock={(passphrase) => onUnlockKey(key.name, passphrase)}
              onLock={() => onLockKey(key.name)}
              onRename={(newName) => handleRename(key.name, newName)}
              onSetPassphrase={(passphrase) => onSetPassphrase(key.name, passphrase)}
              onDelete={() => handleDeleteClick(key)}
              onShowQR={(value, title) => setQrModal({ value, title })}
              onClearError={onClearError}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={deleteConfirm !== null}
        title="Delete Key"
        message={
          deleteConfirm ? (
            <div className={styles.deleteConfirmContent}>
              <p>
                Are you sure you want to delete the key <strong>{deleteConfirm.name}</strong>?
              </p>
              {deleteConfirm.userCount > 0 && (
                <p className={styles.deleteWarning}>
                  This will revoke access for {deleteConfirm.userCount} connected app{deleteConfirm.userCount !== 1 ? 's' : ''}.
                </p>
              )}
              <p className={styles.deleteWarning}>
                This action cannot be undone.
              </p>
              {isKeyEncrypted(deleteConfirm) && (
                <div className={styles.deletePassphraseInput}>
                  <label htmlFor="delete-passphrase">Enter passphrase to confirm:</label>
                  <input
                    id="delete-passphrase"
                    type="password"
                    value={deletePassphrase}
                    onChange={(e) => setDeletePassphrase(e.target.value)}
                    placeholder="Enter key passphrase"
                    className={styles.input}
                    autoComplete="off"
                  />
                </div>
              )}
              {error && <p className={styles.deleteError}>{error}</p>}
            </div>
          ) : ''
        }
        confirmLabel={deleting ? 'Deleting...' : 'Delete Key'}
        danger
        disabled={deleting || (deleteConfirm !== null && isKeyEncrypted(deleteConfirm) && !deletePassphrase.trim())}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />

      <QRModal
        open={qrModal !== null}
        onClose={() => setQrModal(null)}
        value={qrModal?.value ?? ''}
        title={qrModal?.title}
      />
    </div>
  );
}
