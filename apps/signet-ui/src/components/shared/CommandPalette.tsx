import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Home, Zap, Clock, Settings, Key, Search, ArrowRight } from 'lucide-react';
import type { NavItem } from '../layout/Sidebar.js';
import type { KeyInfo, ConnectedApp } from '@signet/types';
import styles from './CommandPalette.module.css';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (nav: NavItem) => void;
  keys: KeyInfo[];
  apps: ConnectedApp[];
}

interface Command {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  action: () => void;
  category: 'navigation' | 'key' | 'app';
}

export function CommandPalette({
  open,
  onClose,
  onNavigate,
  keys,
  apps,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Build command list
  const commands = useMemo<Command[]>(() => {
    const navCommands: Command[] = [
      {
        id: 'nav-home',
        label: 'Go to Home',
        description: 'View pending requests',
        icon: <Home size={16} />,
        action: () => { onNavigate('home'); onClose(); },
        category: 'navigation',
      },
      {
        id: 'nav-apps',
        label: 'Go to Apps',
        description: 'Manage connected apps',
        icon: <Zap size={16} />,
        action: () => { onNavigate('apps'); onClose(); },
        category: 'navigation',
      },
      {
        id: 'nav-activity',
        label: 'Go to Activity',
        description: 'View request history',
        icon: <Clock size={16} />,
        action: () => { onNavigate('activity'); onClose(); },
        category: 'navigation',
      },
      {
        id: 'nav-settings',
        label: 'Go to Settings',
        description: 'Configure preferences',
        icon: <Settings size={16} />,
        action: () => { onNavigate('settings'); onClose(); },
        category: 'navigation',
      },
    ];

    const keyCommands: Command[] = keys.map((key) => ({
      id: `key-${key.name}`,
      label: key.name,
      description: `${key.userCount} app${key.userCount !== 1 ? 's' : ''} · ${key.status}`,
      icon: <Key size={16} />,
      action: () => { onNavigate('apps'); onClose(); },
      category: 'key',
    }));

    const appCommands: Command[] = apps.map((app) => ({
      id: `app-${app.id}`,
      label: app.description || `App ${app.id}`,
      description: app.keyName,
      icon: <Zap size={16} />,
      action: () => { onNavigate('apps'); onClose(); },
      category: 'app',
    }));

    return [...navCommands, ...keyCommands, ...appCommands];
  }, [keys, apps, onNavigate, onClose]);

  // Filter commands by query
  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands;

    const lowerQuery = query.toLowerCase();
    return commands.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(lowerQuery) ||
        (cmd.description?.toLowerCase().includes(lowerQuery))
    );
  }, [commands, query]);

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Reset when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((i) =>
            i < filteredCommands.length - 1 ? i + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((i) =>
            i > 0 ? i - 1 : filteredCommands.length - 1
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            filteredCommands[selectedIndex].action();
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [filteredCommands, selectedIndex, onClose]
  );

  // Scroll selected item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const selectedEl = list.children[selectedIndex] as HTMLElement;
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // Close on click outside
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  if (!open) return null;

  // Group commands by category
  const navCommands = filteredCommands.filter((c) => c.category === 'navigation');
  const keyCommands = filteredCommands.filter((c) => c.category === 'key');
  const appCommands = filteredCommands.filter((c) => c.category === 'app');

  let globalIndex = -1;

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={styles.palette} onKeyDown={handleKeyDown}>
        <div className={styles.inputWrapper}>
          <Search size={18} className={styles.searchIcon} />
          <input
            ref={inputRef}
            type="text"
            className={styles.input}
            placeholder="Type a command or search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />
          <kbd className={styles.escKey}>esc</kbd>
        </div>

        <div className={styles.list} ref={listRef}>
          {filteredCommands.length === 0 && (
            <div className={styles.empty}>No results found</div>
          )}

          {navCommands.length > 0 && (
            <>
              <div className={styles.sectionLabel}>Navigation</div>
              {navCommands.map((cmd) => {
                globalIndex++;
                const isSelected = globalIndex === selectedIndex;
                return (
                  <button
                    key={cmd.id}
                    className={`${styles.item} ${isSelected ? styles.selected : ''}`}
                    onClick={cmd.action}
                    onMouseEnter={() => setSelectedIndex(globalIndex)}
                  >
                    <span className={styles.itemIcon}>{cmd.icon}</span>
                    <span className={styles.itemContent}>
                      <span className={styles.itemLabel}>{cmd.label}</span>
                      {cmd.description && (
                        <span className={styles.itemDescription}>{cmd.description}</span>
                      )}
                    </span>
                    <ArrowRight size={14} className={styles.itemArrow} />
                  </button>
                );
              })}
            </>
          )}

          {keyCommands.length > 0 && (
            <>
              <div className={styles.sectionLabel}>Keys</div>
              {keyCommands.map((cmd) => {
                globalIndex++;
                const isSelected = globalIndex === selectedIndex;
                return (
                  <button
                    key={cmd.id}
                    className={`${styles.item} ${isSelected ? styles.selected : ''}`}
                    onClick={cmd.action}
                    onMouseEnter={() => setSelectedIndex(globalIndex)}
                  >
                    <span className={styles.itemIcon}>{cmd.icon}</span>
                    <span className={styles.itemContent}>
                      <span className={styles.itemLabel}>{cmd.label}</span>
                      {cmd.description && (
                        <span className={styles.itemDescription}>{cmd.description}</span>
                      )}
                    </span>
                    <ArrowRight size={14} className={styles.itemArrow} />
                  </button>
                );
              })}
            </>
          )}

          {appCommands.length > 0 && (
            <>
              <div className={styles.sectionLabel}>Apps</div>
              {appCommands.map((cmd) => {
                globalIndex++;
                const isSelected = globalIndex === selectedIndex;
                return (
                  <button
                    key={cmd.id}
                    className={`${styles.item} ${isSelected ? styles.selected : ''}`}
                    onClick={cmd.action}
                    onMouseEnter={() => setSelectedIndex(globalIndex)}
                  >
                    <span className={styles.itemIcon}>{cmd.icon}</span>
                    <span className={styles.itemContent}>
                      <span className={styles.itemLabel}>{cmd.label}</span>
                      {cmd.description && (
                        <span className={styles.itemDescription}>{cmd.description}</span>
                      )}
                    </span>
                    <ArrowRight size={14} className={styles.itemArrow} />
                  </button>
                );
              })}
            </>
          )}
        </div>

        <div className={styles.footer}>
          <span className={styles.hint}>
            <kbd>↑</kbd><kbd>↓</kbd> navigate
          </span>
          <span className={styles.hint}>
            <kbd>↵</kbd> select
          </span>
          <span className={styles.hint}>
            <kbd>esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}
