import { nip19 } from 'nostr-tools';

export const toNpub = (hex: string): string => {
  try {
    return nip19.npubEncode(hex);
  } catch {
    return hex;
  }
};

export const formatRelativeTime = (iso: string, now: number): string => {
  const timestamp = Date.parse(iso);
  if (!Number.isFinite(timestamp)) {
    return '';
  }

  const diffSeconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (diffSeconds < 1) return 'just now';
  if (diffSeconds < 60) return `${diffSeconds}s ago`;

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  const diffWeeks = Math.floor(diffDays / 7);
  return `${diffWeeks}w ago`;
};

export const formatTtl = (seconds: number): string => {
  if (seconds <= 0) return 'Expired';
  if (seconds < 60) return `${seconds}s remaining`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}m ${secs.toString().padStart(2, '0')}s remaining`;
};

export const truncateContent = (content: string, maxLength: number = 200): string => {
  if (content.length <= maxLength) return content;
  return content.substring(0, maxLength) + '…';
};

export const buildErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return fallback;
  }
};

export interface HelpfulError {
  message: string;
  action?: string;
  canRetry?: boolean;
}

/**
 * Maps common error messages to helpful user-friendly versions
 */
export const getHelpfulErrorMessage = (error: string, context?: string): HelpfulError => {
  const errorLower = error.toLowerCase();

  // Key/passphrase related
  if (errorLower.includes('key is locked') || errorLower.includes('encrypted key')) {
    return {
      message: 'This key is locked',
      action: 'Enter the passphrase to unlock this key',
      canRetry: false,
    };
  }

  if (errorLower.includes('invalid password') || errorLower.includes('wrong password')) {
    return {
      message: 'Incorrect passphrase',
      action: 'Please check your passphrase and try again',
      canRetry: false,
    };
  }

  // Rate limiting
  if (errorLower.includes('rate limit') || errorLower.includes('too many requests') || errorLower.includes('429')) {
    return {
      message: 'Too many requests',
      action: 'Please wait a moment before trying again',
      canRetry: true,
    };
  }

  // Network errors
  if (errorLower.includes('network') || errorLower.includes('fetch') || errorLower.includes('no api endpoints')) {
    return {
      message: 'Unable to connect to server',
      action: 'Check your network connection and try again',
      canRetry: true,
    };
  }

  if (errorLower.includes('timeout')) {
    return {
      message: 'Request timed out',
      action: 'The server took too long to respond. Try again.',
      canRetry: true,
    };
  }

  // Authorization
  if (errorLower.includes('expired') || errorLower.includes('request expired')) {
    return {
      message: 'This request has expired',
      action: 'Ask the app to send a new request',
      canRetry: false,
    };
  }

  if (errorLower.includes('unauthorized') || errorLower.includes('authentication required') || errorLower.includes('401')) {
    return {
      message: 'Session expired',
      action: 'Please refresh the page and try again',
      canRetry: false,
    };
  }

  if (errorLower.includes('not found') || errorLower.includes('404')) {
    return {
      message: 'Request not found',
      action: 'This request may have already been processed',
      canRetry: false,
    };
  }

  // Server errors
  if (errorLower.includes('500') || errorLower.includes('internal server error')) {
    return {
      message: 'Server error',
      action: 'Please try again in a moment',
      canRetry: true,
    };
  }

  if (errorLower.includes('502') || errorLower.includes('bad gateway')) {
    return {
      message: 'Server is temporarily unavailable',
      action: 'Please try again in a few moments',
      canRetry: true,
    };
  }

  // Default - just return the error as-is
  return {
    message: error,
    canRetry: true,
  };
};
