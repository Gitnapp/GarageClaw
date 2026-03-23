import { session } from 'electron';

export const PLATFORM_SESSION_PARTITION = 'persist:garageclaw-platform';

type PlatformRouteKey = 'credits' | 'login' | 'marketplace' | 'profile';

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

export function getPlatformBaseUrl(): string {
  const configured = process.env.GARAGECLAW_PLATFORM_URL || process.env.VITE_PLATFORM_URL;
  if (configured && configured.trim()) {
    return trimTrailingSlash(configured.trim());
  }

  if (!process.env.NODE_ENV || process.env.NODE_ENV === 'development' || process.env.VITE_DEV_SERVER_URL) {
    return 'http://127.0.0.1:3000';
  }

  return 'https://claw-x.com';
}

export function buildPlatformUrl(path = '/'): string {
  return new URL(path, `${getPlatformBaseUrl()}/`).toString();
}

export function getPlatformUrlMap(): Record<PlatformRouteKey, string> {
  return {
    credits: buildPlatformUrl('/embed/credits'),
    login: buildPlatformUrl('/login?next=/embed/profile'),
    marketplace: buildPlatformUrl('/embed/marketplace'),
    profile: buildPlatformUrl('/embed/profile'),
  };
}

export function isAllowedPlatformUrl(target: string): boolean {
  try {
    const targetUrl = new URL(target);
    const baseUrl = new URL(getPlatformBaseUrl());
    return targetUrl.origin === baseUrl.origin;
  } catch {
    return false;
  }
}

export function getPlatformSession() {
  return session.fromPartition(PLATFORM_SESSION_PARTITION);
}

async function getCookieHeader(targetUrl: string): Promise<string> {
  const cookies = await getPlatformSession().cookies.get({ url: targetUrl });
  return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
}

export async function clearPlatformSession(): Promise<void> {
  await getPlatformSession().clearStorageData({
    storages: ['cookies', 'localstorage', 'indexdb', 'serviceworkers', 'cachestorage'],
  });
}

export async function platformFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const targetUrl = buildPlatformUrl(path);
  const headers = new Headers(init?.headers);
  const cookieHeader = await getCookieHeader(targetUrl);

  if (cookieHeader) {
    headers.set('cookie', cookieHeader);
  }
  if (!headers.has('accept')) {
    headers.set('accept', 'application/json');
  }
  if (init?.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  return fetch(targetUrl, {
    ...init,
    headers,
    redirect: 'manual',
  });
}

export async function platformJson<T>(
  path: string,
  init?: RequestInit,
): Promise<{ status: number; ok: boolean; data: T | null; error?: string }> {
  const response = await platformFetch(path, init);
  const text = await response.text();

  if (!text) {
    return {
      status: response.status,
      ok: response.ok,
      data: null,
    };
  }

  try {
    return {
      status: response.status,
      ok: response.ok,
      data: JSON.parse(text) as T,
    };
  } catch {
    return {
      status: response.status,
      ok: response.ok,
      data: null,
      error: text,
    };
  }
}
