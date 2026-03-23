import Link from "next/link";
import { redirect } from "next/navigation";
import { signOutAction } from "@/app/actions/auth";
import { hasSupabaseEnv } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const navItems = [
  { href: "/dashboard", label: "Overview" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/credits", label: "Credits" },
  { href: "/profile", label: "Profile" },
  { href: "/settings", label: "Settings" },
] as const;

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  if (!hasSupabaseEnv()) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center px-6 py-10">
        <div className="rounded-[2rem] border border-line bg-panel p-8 shadow-[0_24px_90px_rgba(20,33,43,0.08)]">
          <h1 className="text-2xl font-semibold text-foreground">缺少环境变量</h1>
          <p className="mt-3 text-sm leading-7 text-muted">
            先在 `apps/web/.env.local` 中补齐 Supabase 配置，再继续使用控制台页面。
          </p>
        </div>
      </main>
    );
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-transparent">
      <div className="mx-auto grid min-h-screen w-full max-w-7xl gap-6 px-6 py-6 lg:grid-cols-[260px_1fr] lg:px-8">
        <aside className="rounded-[2rem] border border-line bg-panel p-6 shadow-[0_16px_45px_rgba(20,33,43,0.05)]">
          <div className="font-mono text-xs uppercase tracking-[0.22em] text-accent">
            ClawX Console
          </div>
          <div className="mt-5 rounded-3xl bg-white/70 p-4">
            <div className="text-sm font-medium text-foreground">
              {user.email ?? "当前用户"}
            </div>
            <div className="mt-1 text-xs text-muted">Week 1 基建已接入 session 保护</div>
          </div>

          <nav className="mt-8 space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center justify-between rounded-2xl px-4 py-3 text-sm text-foreground transition hover:bg-white/70"
              >
                <span>{item.label}</span>
                <span className="font-mono text-xs text-muted">/</span>
              </Link>
            ))}
          </nav>

          <form action={signOutAction} className="mt-8">
            <button
              type="submit"
              className="w-full rounded-full border border-line bg-white px-4 py-3 text-sm font-medium text-foreground transition hover:bg-[#fff8f0]"
            >
              退出登录
            </button>
          </form>
        </aside>

        <main className="py-2">{children}</main>
      </div>
    </div>
  );
}
