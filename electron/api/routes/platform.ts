import type { IncomingMessage, ServerResponse } from 'http';
import type {
  CreditBalanceResponse,
  CreditHistoryItem,
  PlatformAuthStatus,
  ProfileSummary,
} from '@garageclaw/shared/api-types';
import type { HostApiContext } from '../context';
import { sendJson } from '../route-utils';
import {
  clearPlatformSession,
  getPlatformBaseUrl,
  getPlatformUrlMap,
  platformJson,
} from '../../utils/platform';

function buildDisconnectedStatus(): PlatformAuthStatus {
  const urls = getPlatformUrlMap();
  return {
    base_url: getPlatformBaseUrl(),
    connected: false,
    credits_url: urls.credits,
    login_url: urls.login,
    marketplace_url: urls.marketplace,
    profile_url: urls.profile,
    user: null,
  };
}

async function buildAuthStatus(): Promise<PlatformAuthStatus> {
  const meResult = await platformJson<ProfileSummary>('/api/me');
  const urls = getPlatformUrlMap();

  if (!meResult.ok || !meResult.data) {
    return {
      ...buildDisconnectedStatus(),
      connected: false,
    };
  }

  return {
    base_url: getPlatformBaseUrl(),
    connected: true,
    credits_url: urls.credits,
    login_url: urls.login,
    marketplace_url: urls.marketplace,
    profile_url: urls.profile,
    user: meResult.data,
  };
}

export async function handlePlatformRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  _url: URL,
  _ctx: HostApiContext,
): Promise<boolean> {
  const url = _url;

  if (url.pathname === '/api/platform/config' && req.method === 'GET') {
    const urls = getPlatformUrlMap();
    sendJson(res, 200, {
      base_url: getPlatformBaseUrl(),
      credits_url: urls.credits,
      login_url: urls.login,
      marketplace_url: urls.marketplace,
      profile_url: urls.profile,
    });
    return true;
  }

  if (url.pathname === '/api/platform/auth/status' && req.method === 'GET') {
    sendJson(res, 200, await buildAuthStatus());
    return true;
  }

  if (url.pathname === '/api/platform/me' && req.method === 'GET') {
    const result = await platformJson<ProfileSummary>('/api/me');
    sendJson(
      res,
      result.status,
      result.data ?? { error: result.error || 'Failed to resolve platform profile.' },
    );
    return true;
  }

  if (url.pathname === '/api/platform/credits/balance' && req.method === 'GET') {
    const result = await platformJson<CreditBalanceResponse>('/api/credits/balance');
    sendJson(
      res,
      result.status,
      result.data ?? { error: result.error || 'Failed to resolve platform credit balance.' },
    );
    return true;
  }

  if (url.pathname === '/api/platform/credits/history' && req.method === 'GET') {
    const query = url.search ? `/api/credits/history${url.search}` : '/api/credits/history';
    const result = await platformJson<CreditHistoryItem[]>(query);
    sendJson(
      res,
      result.status,
      result.data ?? { error: result.error || 'Failed to resolve platform credit history.' },
    );
    return true;
  }

  if (url.pathname === '/api/platform/auth/disconnect' && req.method === 'POST') {
    await clearPlatformSession();
    sendJson(res, 200, { success: true });
    return true;
  }

  return false;
}
