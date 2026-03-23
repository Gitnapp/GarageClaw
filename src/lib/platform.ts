import type {
  CreditBalanceResponse,
  CreditHistoryItem,
  PlatformAuthStatus,
  ProfileSummary,
} from '@garageclaw/shared/api-types';
import { hostApiFetch } from '@/lib/host-api';

export type PlatformRouteTarget = 'credits' | 'login' | 'marketplace' | 'profile';

export type PlatformConfig = Pick<
  PlatformAuthStatus,
  'base_url' | 'credits_url' | 'login_url' | 'marketplace_url' | 'profile_url'
>;

export async function fetchPlatformConfig(): Promise<PlatformConfig> {
  return hostApiFetch<PlatformConfig>('/api/platform/config');
}

export async function fetchPlatformAuthStatus(): Promise<PlatformAuthStatus> {
  return hostApiFetch<PlatformAuthStatus>('/api/platform/auth/status');
}

export async function fetchPlatformProfile(): Promise<ProfileSummary> {
  return hostApiFetch<ProfileSummary>('/api/platform/me');
}

export async function fetchPlatformCreditBalance(): Promise<CreditBalanceResponse> {
  return hostApiFetch<CreditBalanceResponse>('/api/platform/credits/balance');
}

export async function fetchPlatformCreditHistory(limit = 12): Promise<CreditHistoryItem[]> {
  return hostApiFetch<CreditHistoryItem[]>(`/api/platform/credits/history?limit=${encodeURIComponent(String(limit))}`);
}

export async function disconnectPlatform(): Promise<void> {
  await hostApiFetch('/api/platform/auth/disconnect', {
    method: 'POST',
  });
}

export function getPlatformRouteUrl(
  config: PlatformConfig,
  route: PlatformRouteTarget,
): string {
  if (route === 'credits') return config.credits_url;
  if (route === 'login') return config.login_url;
  if (route === 'profile') return config.profile_url;
  return config.marketplace_url;
}
