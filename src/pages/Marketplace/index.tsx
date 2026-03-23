import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePlatformStore } from '@/stores/platform';

export function Marketplace() {
  const { t } = useTranslation('common');
  const agents = usePlatformStore((s) => s.agents);
  const skills = usePlatformStore((s) => s.skills);
  const loadMarketplace = usePlatformStore((s) => s.loadMarketplace);

  useEffect(() => {
    loadMarketplace();
  }, [loadMarketplace]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t('sidebar.marketplace', 'Marketplace')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            浏览公开的 Agents 和 Skills
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => loadMarketplace()}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          刷新
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        {/* Agents */}
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Agents</h2>
          <div className="mt-4 space-y-2">
            {agents.length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                还没有公开 Agent。
              </div>
            ) : (
              agents.map((agent) => (
                <div key={agent.id} className="rounded-md border bg-background p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium">{agent.name}</span>
                    <Badge variant="secondary">{agent.pricing_type ?? 'free'}</Badge>
                  </div>
                  <div className="mt-1.5 text-sm text-muted-foreground">
                    {agent.description || '暂无描述'}
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">{agent.model}</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Skills */}
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Skills</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {skills.length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground sm:col-span-2">
                Skills 目录为空。
              </div>
            ) : (
              skills.map((skill) => (
                <div key={skill.id} className="rounded-md border bg-background p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{skill.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {skill.is_builtin ? 'builtin' : skill.category || 'skill'}
                    </span>
                  </div>
                  <div className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {skill.description || '暂无描述'}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
