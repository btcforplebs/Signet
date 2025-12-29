import React from 'react';
import styles from './PageHeader.module.css';

interface PageHeaderProps {
  title: string;
  count?: number;
  action?: React.ReactNode;
}

export function PageHeader({ title, count, action }: PageHeaderProps) {
  return (
    <div className={styles.container}>
      <h1 className={styles.header}>
        {title}
        {count !== undefined && (
          <span className={styles.count}>({count})</span>
        )}
      </h1>
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
