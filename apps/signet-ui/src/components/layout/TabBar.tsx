import React from 'react';
import type { ComponentType } from 'react';
import type { LucideProps } from 'lucide-react';
import {
  DashboardIcon,
  RequestsIcon,
  KeyIcon,
  AppsIcon,
  SettingsIcon,
} from '../shared/Icons.js';
import styles from './TabBar.module.css';

export type Tab = 'dashboard' | 'requests' | 'keys' | 'apps' | 'settings';

interface TabBarProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  pendingCount?: number;
}

const TABS: Array<{ id: Tab; label: string; Icon: ComponentType<LucideProps> }> = [
  { id: 'dashboard', label: 'Dashboard', Icon: DashboardIcon },
  { id: 'requests', label: 'Requests', Icon: RequestsIcon },
  { id: 'keys', label: 'Keys', Icon: KeyIcon },
  { id: 'apps', label: 'Apps', Icon: AppsIcon },
  { id: 'settings', label: 'Settings', Icon: SettingsIcon },
];

export function TabBar({ activeTab, onTabChange, pendingCount = 0 }: TabBarProps) {
  return (
    <nav className={styles.tabBar} role="tablist" aria-label="Main navigation">
      {TABS.map(tab => (
        <button
          key={tab.id}
          className={`${styles.tab} ${activeTab === tab.id ? styles.active : ''}`}
          onClick={() => onTabChange(tab.id)}
          role="tab"
          aria-selected={activeTab === tab.id}
          aria-controls={`${tab.id}-panel`}
        >
          <span className={styles.icon} aria-hidden="true">
            <tab.Icon size={18} />
          </span>
          <span className={styles.label}>{tab.label}</span>
          {tab.id === 'requests' && pendingCount > 0 && (
            <span className={styles.badge} aria-label={`${pendingCount} pending requests`}>
              {pendingCount}
            </span>
          )}
        </button>
      ))}
    </nav>
  );
}
