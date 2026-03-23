import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LogOut, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePlatformStore } from '@/stores/platform';

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '--';
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  } catch {
    return value;
  }
}

function LoginForm() {
  const signIn = usePlatformStore((s) => s.signIn);
  const loading = usePlatformStore((s) => s.loading);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const err = await signIn(email, password);
    if (err) setError(err);
  };

  return (
    <div className="mx-auto max-w-sm">
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold">登录平台账号</h2>
        <p className="mt-1 text-sm text-muted-foreground">使用邮箱和密码登录</p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium">邮箱</label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className="mt-1"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium">密码</label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="mt-1"
            />
          </div>

          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? '登录中...' : '登录'}
          </Button>
        </form>
      </div>
    </div>
  );
}

function ProfileView() {
  const user = usePlatformStore((s) => s.user);
  const profile = usePlatformStore((s) => s.profile);
  const balance = usePlatformStore((s) => s.balance);
  const history = usePlatformStore((s) => s.history);
  const signOut = usePlatformStore((s) => s.signOut);
  const loadProfile = usePlatformStore((s) => s.loadProfile);
  const loadCredits = usePlatformStore((s) => s.loadCredits);

  useEffect(() => {
    loadCredits();
  }, [loadCredits]);

  const cards = [
    { label: 'Display Name', value: profile?.display_name ?? '未设置' },
    { label: 'Email', value: user?.email ?? '未设置' },
    { label: 'Role', value: profile?.role ?? 'user' },
    { label: 'Credits', value: balance.toFixed(2) },
  ];

  return (
    <div className="space-y-6">
      {/* User info cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-lg border bg-card p-5 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {card.label}
            </div>
            <div className="mt-2 break-words text-lg font-semibold">{card.value}</div>
          </div>
        ))}
      </div>

      {/* Credits history */}
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Credits 历史</h2>
          <Button variant="ghost" size="sm" onClick={() => loadCredits()}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            刷新
          </Button>
        </div>
        <div className="mt-4 space-y-2">
          {history.length === 0 ? (
            <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              还没有 credits 记录。
            </div>
          ) : (
            history.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 rounded-md border bg-background p-3">
                <div>
                  <div className="text-sm font-medium">{item.description || item.type}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{formatDateTime(item.created_at)}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold">
                    {item.amount > 0 ? '+' : ''}{item.amount}
                  </div>
                  <div className="text-xs text-muted-foreground">余额 {item.balance_after}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => loadProfile()}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          刷新资料
        </Button>
        <Button variant="outline" size="sm" onClick={() => signOut()}>
          <LogOut className="mr-1.5 h-3.5 w-3.5" />
          退出登录
        </Button>
      </div>
    </div>
  );
}

export function Profile() {
  const { t } = useTranslation('common');
  const user = usePlatformStore((s) => s.user);
  const loading = usePlatformStore((s) => s.loading);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t('sidebar.profile', '账号与平台')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          管理平台账号、查看 credits 余额和账单历史
        </p>
      </div>

      {loading ? (
        <div className="flex min-h-[200px] items-center justify-center text-sm text-muted-foreground">
          加载中...
        </div>
      ) : user ? (
        <ProfileView />
      ) : (
        <LoginForm />
      )}
    </div>
  );
}
