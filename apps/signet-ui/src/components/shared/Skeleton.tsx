import React from 'react';
import styles from './Skeleton.module.css';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string;
  className?: string;
}

export function Skeleton({ width, height, borderRadius, className }: SkeletonProps) {
  return (
    <div
      className={`${styles.skeleton} ${className ?? ''}`}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        borderRadius,
      }}
    />
  );
}

export function SkeletonText({ lines = 1, className }: { lines?: number; className?: string }) {
  return (
    <div className={`${styles.textContainer} ${className ?? ''}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height={14}
          width={i === lines - 1 && lines > 1 ? '70%' : '100%'}
          borderRadius="var(--radius-sm)"
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={`${styles.card} ${className ?? ''}`}>
      <div className={styles.cardHeader}>
        <Skeleton width={8} height={8} borderRadius="50%" />
        <Skeleton height={16} width="30%" borderRadius="var(--radius-sm)" />
        <Skeleton height={14} width="20%" borderRadius="var(--radius-sm)" className={styles.cardMeta} />
      </div>
    </div>
  );
}

export function SkeletonStatCard() {
  return (
    <div className={styles.statCard}>
      <Skeleton width={48} height={48} borderRadius="var(--radius-lg)" />
      <div className={styles.statContent}>
        <Skeleton height={24} width={40} borderRadius="var(--radius-sm)" />
        <Skeleton height={14} width={60} borderRadius="var(--radius-sm)" />
      </div>
    </div>
  );
}
