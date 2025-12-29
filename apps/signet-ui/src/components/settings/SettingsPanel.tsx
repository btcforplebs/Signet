import React from 'react';
import { useSettings } from '../../contexts/SettingsContext.js';
import styles from './SettingsPanel.module.css';

type NotificationPermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

interface SettingsPanelProps {
  notificationPermission: NotificationPermissionState;
  onRequestNotificationPermission: () => void;
}

const REFRESH_OPTIONS = [
  { value: 15, label: '15 seconds' },
  { value: 30, label: '30 seconds' },
  { value: 60, label: '1 minute' },
  { value: 120, label: '2 minutes' },
];

export function SettingsPanel({
  notificationPermission,
  onRequestNotificationPermission,
}: SettingsPanelProps) {
  const { settings, updateSettings } = useSettings();

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Settings</h2>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Auto-Refresh</h3>

        <div className={styles.setting}>
          <div className={styles.settingInfo}>
            <span className={styles.settingLabel}>Enable auto-refresh</span>
            <span className={styles.settingDescription}>
              Automatically fetch new requests and updates
            </span>
          </div>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={settings.autoRefresh}
              onChange={(e) => updateSettings({ autoRefresh: e.target.checked })}
            />
            <span className={styles.toggleSlider} />
          </label>
        </div>

        {settings.autoRefresh && (
          <div className={styles.setting}>
            <div className={styles.settingInfo}>
              <span className={styles.settingLabel}>Refresh interval</span>
              <span className={styles.settingDescription}>
                How often to check for updates
              </span>
            </div>
            <select
              className={styles.select}
              value={settings.refreshInterval}
              onChange={(e) => updateSettings({ refreshInterval: Number(e.target.value) })}
            >
              {REFRESH_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Notifications</h3>

        <div className={styles.setting}>
          <div className={styles.settingInfo}>
            <span className={styles.settingLabel}>Browser notifications</span>
            <span className={styles.settingDescription}>
              Get notified when new requests arrive
            </span>
          </div>

          {notificationPermission === 'unsupported' ? (
            <span className={styles.unsupported}>Not supported</span>
          ) : notificationPermission === 'denied' ? (
            <span className={styles.denied}>Blocked by browser</span>
          ) : notificationPermission === 'granted' ? (
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={settings.notificationsEnabled}
                onChange={(e) => updateSettings({ notificationsEnabled: e.target.checked })}
              />
              <span className={styles.toggleSlider} />
            </label>
          ) : (
            <button
              className={styles.enableButton}
              onClick={onRequestNotificationPermission}
            >
              Enable
            </button>
          )}
        </div>
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>About</h3>
        <div className={styles.about}>
          <p>
            <strong>Signet</strong> is a NIP-46 remote signer for Nostr.
          </p>
          <p className={styles.version}>
            Version 0.10.5
          </p>
          <p>
            <a
              href="https://github.com/Letdown2491/signet"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.link}
            >
              GitHub Repository
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
