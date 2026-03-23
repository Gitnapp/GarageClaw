import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ExternalLink, Globe, Loader2, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { fetchPlatformConfig, getPlatformRouteUrl, type PlatformConfig, type PlatformRouteTarget } from '@/lib/platform';
import type { ElectronWebviewElement } from '@/types/electron';

interface EmbeddedWebViewProps {
  className?: string;
  route: PlatformRouteTarget;
  title: string;
}

function isAllowedUrl(config: PlatformConfig | null, target: string): boolean {
  if (!config) return false;
  try {
    const targetUrl = new URL(target);
    const baseUrl = new URL(config.base_url);
    return targetUrl.origin === baseUrl.origin;
  } catch {
    return false;
  }
}

export function EmbeddedWebView({ className, route, title }: EmbeddedWebViewProps) {
  const webviewRef = useRef<ElectronWebviewElement | null>(null);
  const [config, setConfig] = useState<PlatformConfig | null>(null);
  const [currentUrl, setCurrentUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDomReady, setIsDomReady] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchPlatformConfig()
      .then((nextConfig) => {
        if (cancelled) return;
        setConfig(nextConfig);
        setCurrentUrl(getPlatformRouteUrl(nextConfig, route));
        setError(null);
        setIsDomReady(false);
        setCanGoBack(false);
        setCanGoForward(false);
      })
      .catch((nextError) => {
        if (cancelled) return;
        setError(String(nextError));
      });

    return () => {
      cancelled = true;
    };
  }, [route]);

  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview || !config) return;

    const updateNavigationState = () => {
      if (!isDomReady) return;
      setCanGoBack(webview.canGoBack());
      setCanGoForward(webview.canGoForward());
      setCurrentUrl(webview.getURL() || getPlatformRouteUrl(config, route));
    };

    const handleDomReady = () => {
      setIsDomReady(true);
      setLoading(false);
      setError(null);
      updateNavigationState();
    };
    const handleStartLoading = () => {
      setLoading(true);
      setError(null);
    };
    const handleStopLoading = () => {
      setLoading(false);
      updateNavigationState();
    };
    const handleNavigate = (event: Event) => {
      const nextUrl = (event as Event & { url?: string }).url;
      if (!nextUrl) return;
      if (!isAllowedUrl(config, nextUrl)) {
        void window.electron.openExternal(nextUrl);
        webview.stop();
        webview.loadURL(getPlatformRouteUrl(config, route));
        return;
      }
      setCurrentUrl(nextUrl);
      updateNavigationState();
    };
    const handleWindowOpen = (event: Event) => {
      const nextUrl = (event as Event & { url?: string; preventDefault?: () => void }).url;
      if ((event as Event & { preventDefault?: () => void }).preventDefault) {
        (event as Event & { preventDefault?: () => void }).preventDefault?.();
      }
      if (nextUrl) {
        void window.electron.openExternal(nextUrl);
      }
    };
    const handleFailLoad = (event: Event) => {
      const details = event as Event & { errorDescription?: string; validatedURL?: string };
      if (details.validatedURL?.startsWith('http')) {
        setError(details.errorDescription || 'Failed to load embedded page.');
      }
      setLoading(false);
    };

    webview.addEventListener('dom-ready', handleDomReady);
    webview.addEventListener('did-start-loading', handleStartLoading);
    webview.addEventListener('did-stop-loading', handleStopLoading);
    webview.addEventListener('did-navigate', handleNavigate);
    webview.addEventListener('did-navigate-in-page', handleNavigate);
    webview.addEventListener('will-navigate', handleNavigate);
    webview.addEventListener('new-window', handleWindowOpen);
    webview.addEventListener('did-fail-load', handleFailLoad);

    return () => {
      webview.removeEventListener('dom-ready', handleDomReady);
      webview.removeEventListener('did-start-loading', handleStartLoading);
      webview.removeEventListener('did-stop-loading', handleStopLoading);
      webview.removeEventListener('did-navigate', handleNavigate);
      webview.removeEventListener('did-navigate-in-page', handleNavigate);
      webview.removeEventListener('will-navigate', handleNavigate);
      webview.removeEventListener('new-window', handleWindowOpen);
      webview.removeEventListener('did-fail-load', handleFailLoad);
    };
  }, [config, isDomReady, route]);

  const sourceUrl = useMemo(() => {
    if (!config) return '';
    return currentUrl || getPlatformRouteUrl(config, route);
  }, [config, currentUrl, route]);

  return (
    <div className={cn('flex min-h-0 flex-col overflow-hidden rounded-[1.75rem] border border-black/10 bg-white/70 shadow-[0_16px_45px_rgba(20,33,43,0.08)] dark:border-white/10 dark:bg-card', className)}>
      <div className="flex flex-wrap items-center gap-2 border-b border-black/10 px-4 py-3 dark:border-white/10">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground/80">
          <Globe className="h-4 w-4 text-primary" />
          <span>{title}</span>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={!isDomReady || !canGoBack}
            onClick={() => {
              if (isDomReady) {
                webviewRef.current?.goBack();
              }
            }}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={!isDomReady || !canGoForward}
            onClick={() => {
              if (isDomReady) {
                webviewRef.current?.goForward();
              }
            }}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={!isDomReady}
            onClick={() => {
              if (isDomReady) {
                webviewRef.current?.reload();
              }
            }}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={!sourceUrl}
            onClick={() => {
              if (sourceUrl) {
                void window.electron.openExternal(sourceUrl);
              }
            }}
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {error ? (
        <div className="border-b border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        </div>
      ) : null}

      <div className="relative flex-1 bg-[#f4f1ea] dark:bg-background">
        {!config ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading platform...
          </div>
        ) : (
          <>
            <webview
              ref={webviewRef}
              className="h-full w-full"
              partition="persist:garageclaw-platform"
              src={sourceUrl}
            />
            {loading ? (
              <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-center py-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center rounded-full border border-black/10 bg-background/90 px-3 py-1 shadow-sm dark:border-white/10">
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  Syncing platform surface...
                </span>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
