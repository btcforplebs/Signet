const CSRF_COOKIE_NAME = 'signet_csrf';

function getCsrfTokenFromCookie(): string | null {
  const match = document.cookie.match(new RegExp(`${CSRF_COOKIE_NAME}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

async function ensureCsrfToken(): Promise<string> {
  const existing = getCsrfTokenFromCookie();
  if (existing) return existing;

  // Fetch sets the cookie as a side effect
  await callApi('/csrf-token');
  const token = getCsrfTokenFromCookie();
  if (!token) throw new Error('Failed to obtain CSRF token');
  return token;
}

const buildApiBases = (): string[] => {
  const bases: string[] = [];
  const seen = new Set<string>();

  const add = (value: string | null | undefined) => {
    if (value === undefined || value === null) {
      return;
    }
    const trimmed = value === '' ? '' : value.replace(/\/+$/, '');
    if (seen.has(trimmed)) {
      return;
    }
    seen.add(trimmed);
    bases.push(trimmed);
  };

  const envBase = import.meta.env.VITE_DAEMON_API_URL ?? import.meta.env.VITE_BUNKER_API_URL;
  if (typeof envBase === 'string' && envBase.trim().length > 0) {
    add(envBase.trim());
  }

  add('');

  if (typeof window !== 'undefined') {
    try {
      const current = new URL(window.location.href);
      const protocol = current.protocol || 'http:';
      const hostname = current.hostname || 'localhost';
      const defaultHost = `${protocol}//${hostname}`;

      add(`${defaultHost}:3000`);
      add(defaultHost);

      if (hostname !== 'localhost') {
        add(`${protocol}//localhost:3000`);
      }
      if (hostname !== '127.0.0.1') {
        add(`${protocol}//127.0.0.1:3000`);
      }
    } catch {
      add('http://localhost:3000');
    }
  } else {
    add('http://localhost:3000');
  }

  return bases;
};

const apiBases = buildApiBases();

function composeUrl(base: string, path: string): string {
  if (!base) {
    return path.startsWith('/') ? path : `/${path}`;
  }
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

export interface ApiOptions {
  expectJson?: boolean;
}

export async function callApi(
  path: string,
  init?: RequestInit,
  options?: ApiOptions
): Promise<Response> {
  const attempts: string[] = [];

  for (const base of apiBases) {
    const target = composeUrl(base, path);
    try {
      const response = await fetch(target, {
        ...init,
        credentials: 'include',
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        const detail = `${response.status} ${response.statusText}${body ? ` – ${body}` : ''}`;
        if ([404, 502, 503].includes(response.status)) {
          attempts.push(`${target}: ${detail}`);
          continue;
        }
        throw new Error(`${target}: ${detail}`);
      }

      if (options?.expectJson) {
        const contentType = response.headers.get('content-type') ?? '';
        if (!contentType.toLowerCase().includes('application/json')) {
          const body = await response.text().catch(() => '');
          const detail = body || 'Unexpected non-JSON response';
          attempts.push(`${target}: ${detail}`);
          continue;
        }
      }

      return response;
    } catch (error) {
      if (error instanceof TypeError) {
        attempts.push(`${target}: ${error.message}`);
        continue;
      }
      throw error;
    }
  }

  throw new Error(attempts.length ? attempts.join('; ') : 'No API endpoints reachable');
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await callApi(path, undefined, { expectJson: true });
  return response.json();
}

async function mutationRequest(
  path: string,
  method: string,
  body?: unknown,
  isRetry = false
): Promise<Response> {
  const csrfToken = await ensureCsrfToken();

  try {
    const response = await callApi(
      path,
      {
        method,
        headers: {
          ...(body ? { 'Content-Type': 'application/json' } : {}),
          'X-CSRF-Token': csrfToken,
        },
        body: body ? JSON.stringify(body) : undefined,
      },
      { expectJson: true }
    );
    return response;
  } catch (error) {
    // If CSRF failed and not already retrying, refresh token and retry once
    if (!isRetry && error instanceof Error && error.message.includes('403')) {
      const isCsrfError =
        error.message.includes('CSRF') ||
        error.message.includes('csrf');
      if (isCsrfError) {
        await callApi('/csrf-token'); // Refresh cookie
        return mutationRequest(path, method, body, true);
      }
    }
    throw error;
  }
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const response = await mutationRequest(path, 'POST', body);
  return response.json();
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const response = await mutationRequest(path, 'PATCH', body);
  return response.json();
}

export async function apiDelete<T>(path: string, body?: unknown): Promise<T> {
  const response = await mutationRequest(path, 'DELETE', body);
  return response.json();
}
