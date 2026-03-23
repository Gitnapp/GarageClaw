import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CreditBalanceResponse, CreditHistoryItem, PlatformAuthStatus } from '@garageclaw/shared/api-types';
import { AlertCircle, ExternalLink, RefreshCw, Unplug } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { EmbeddedWebView } from '@/components/platform/EmbeddedWebView';
import {
  disconnectPlatform,
  fetchPlatformAuthStatus,
  fetchPlatformCreditBalance,
  fetchPlatformCreditHistory,
  type PlatformRouteTarget,
} from '@/lib/platform';

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '--';
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function Profile() {
  const { t } = useTranslation('platform');
  const [status, setStatus] = useState<PlatformAuthStatus | null>(null);
  const [balance, setBalance] = useState<CreditBalanceResponse | null>(null);
  const [history, setHistory] = useState<CreditHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEmbeddedView, setShowEmbeddedView] = useState(false);
  const [embeddedRoute, setEmbeddedRoute] = useState<PlatformRouteTarget>('profile');

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const authStatus = await fetchPlatformAuthStatus();
      setStatus(authStatus);

      if (!authStatus.connected) {
        setBalance(null);
        setHistory([]);
        setEmbeddedRoute('login');
        return;
      }

      const [nextBalance, nextHistory] = await Promise.all([
        fetchPlatformCreditBalance(),
        fetchPlatformCreditHistory(),
      ]);
      setBalance(nextBalance);
      setHistory(nextHistory);
      setEmbeddedRoute((current) => (current === 'login' ? 'profile' : current));
    } catch (nextError) {
      setError(String(nextError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const profileCards = useMemo(() => ([
    {
      label: t('profile.displayName'),
      value: status?.user?.display_name || '--',
      detail: t('profile.role'),
      detailValue: status?.user?.role || '--',
    },
    {
      label: t('profile.email'),
      value: status?.user?.email || '--',
      detail: t('profile.balance'),
      detailValue: balance ? `${balance.balance.toFixed(2)} ${balance.currency}` : '--',
    },
  ]), [balance, status, t]);

  const avatarFallback = status?.user?.display_name?.slice(0, 1)
    || status?.user?.email?.slice(0, 1)
    || '?';

  return (
    <div className="flex flex-col gap-6 pb-6">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1
            className="text-5xl md:text-6xl font-serif text-foreground mb-3 font-normal tracking-tight"
            style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", Times, serif' }}
          >
            {t('profile.title')}
          </h1>
          <p className="text-[17px] text-foreground/70 font-medium">{t('profile.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:mt-2">
          <Button
            variant="outline"
            onClick={() => void loadProfile()}
            className="h-9 text-[13px] font-medium rounded-full px-4"
          >
            <RefreshCw className="mr-2 h-3.5 w-3.5" />
            {t('profile.refresh')}
          </Button>
          {status?.connected ? (
            <Button
              variant="outline"
              onClick={() => {
                setEmbeddedRoute('profile');
                setShowEmbeddedView((current) => !current);
              }}
              className="h-9 text-[13px] font-medium rounded-full px-4"
            >
              {showEmbeddedView ? t('profile.hideEmbed') : t('profile.manageEmbed')}
            </Button>
          ) : (
            <Button
              onClick={() => {
                setEmbeddedRoute('login');
                setShowEmbeddedView(true);
              }}
              className="h-9 text-[13px] font-medium rounded-full px-4 shadow-none"
            >
              {t('profile.connect')}
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[320px] items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <>
          {error ? (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
              </div>
            </div>
          ) : null}

          <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-[1.75rem] border border-black/10 bg-white/70 p-6 shadow-[0_16px_45px_rgba(20,33,43,0.08)] dark:border-white/10 dark:bg-card">
              <div className="flex items-start gap-4">
                {status?.user?.avatar_url ? (
                  <img
                    src={status.user.avatar_url}
                    alt={status.user.display_name || status.user.email || 'Profile'}
                    className="h-16 w-16 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-xl font-semibold text-primary">
                    {avatarFallback}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-semibold text-foreground">
                      {status?.user?.display_name || status?.user?.email || t('profile.disconnected')}
                    </span>
                    <span className="rounded-full bg-black/[0.04] px-3 py-1 text-xs font-medium text-foreground/70 dark:bg-white/[0.08]">
                      {status?.connected ? t('profile.connected') : t('profile.disconnected')}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-foreground/70">
                    {status?.connected ? t('profile.desktopBridgeDesc') : t('profile.loginHint')}
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {profileCards.map((card) => (
                  <article
                    key={card.label}
                    className="rounded-2xl border border-black/10 bg-white/75 px-4 py-4 dark:border-white/10 dark:bg-white/5"
                  >
                    <div className="text-xs font-mono uppercase tracking-[0.16em] text-muted-foreground">
                      {card.label}
                    </div>
                    <div className="mt-3 break-words text-lg font-semibold text-foreground">
                      {card.value}
                    </div>
                    <div className="mt-2 text-sm text-muted-foreground">
                      {card.detail}: {card.detailValue}
                    </div>
                  </article>
                ))}
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  className="rounded-full"
                  disabled={!status?.profile_url}
                  onClick={() => {
                    if (status?.profile_url) {
                      void window.electron.openExternal(status.profile_url);
                    }
                  }}
                >
                  <ExternalLink className="mr-2 h-3.5 w-3.5" />
                  {t('profile.openWebProfile')}
                </Button>
                <Button
                  variant="outline"
                  className="rounded-full"
                  disabled={!status?.credits_url}
                  onClick={() => {
                    setEmbeddedRoute('credits');
                    setShowEmbeddedView(true);
                  }}
                >
                  {t('profile.openCredits')}
                </Button>
                {status?.connected ? (
                  <Button
                    variant="outline"
                    className="rounded-full text-destructive hover:text-destructive"
                    onClick={() => {
                      void disconnectPlatform().then(() => loadProfile());
                    }}
                  >
                    <Unplug className="mr-2 h-3.5 w-3.5" />
                    {t('profile.disconnect')}
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-black/10 bg-white/70 p-6 shadow-[0_16px_45px_rgba(20,33,43,0.08)] dark:border-white/10 dark:bg-card">
              <h2 className="text-xl font-semibold text-foreground">{t('profile.billingHistory')}</h2>
              <div className="mt-5 space-y-3">
                {history.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-black/10 bg-white/60 px-4 py-5 text-sm text-muted-foreground dark:border-white/10 dark:bg-white/5">
                    {t('profile.noHistory')}
                  </div>
                ) : (
                  history.map((item) => (
                    <article
                      key={item.id}
                      className="rounded-2xl border border-black/10 bg-white/75 px-4 py-4 dark:border-white/10 dark:bg-white/5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="font-medium text-foreground">
                            {item.description || item.type}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {formatDateTime(item.created_at)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-foreground">
                            {item.amount > 0 ? '+' : ''}
                            {item.amount}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            balance {item.balance_after}
                          </div>
                        </div>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-black/10 bg-white/70 p-6 shadow-[0_16px_45px_rgba(20,33,43,0.08)] dark:border-white/10 dark:bg-card">
            <h2 className="text-xl font-semibold text-foreground">{t('profile.desktopBridge')}</h2>
            <p className="mt-3 text-sm leading-7 text-foreground/70">{t('profile.desktopBridgeDesc')}</p>
          </section>

          {showEmbeddedView ? (
            <EmbeddedWebView
              className="h-[620px]"
              route={embeddedRoute}
              title={embeddedRoute === 'credits' ? t('profile.openCredits') : t('profile.title')}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
