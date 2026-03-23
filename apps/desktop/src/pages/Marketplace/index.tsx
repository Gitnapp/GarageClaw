import { useTranslation } from 'react-i18next';
import { EmbeddedWebView } from '@/components/platform/EmbeddedWebView';

export function Marketplace() {
  const { t } = useTranslation('platform');

  return (
    <div className="flex h-[calc(100vh-5.5rem)] flex-col gap-6">
      <div className="shrink-0">
        <h1
          className="text-5xl md:text-6xl font-serif text-foreground mb-3 font-normal tracking-tight"
          style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", Times, serif' }}
        >
          {t('marketplace.title')}
        </h1>
        <p className="text-[17px] text-foreground/70 font-medium">{t('marketplace.subtitle')}</p>
      </div>

      <EmbeddedWebView
        className="min-h-0 flex-1"
        route="marketplace"
        title={t('marketplace.title')}
      />
    </div>
  );
}
