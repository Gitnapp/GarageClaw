import Link from "next/link";
import { redirect } from "next/navigation";
import { signOutAction } from "@/app/actions/auth";
import { hasSupabaseEnv } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const navItems = [
  { href: "/credits", label: "Credits" },
  { href: "/marketplace", label: "Marketplace" },
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
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h1 className="text-2xl font-semibold">缺少环境变量</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            先在 apps/web/.env.local 中补齐 Supabase 配置，再继续使用控制台页面。
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
    <div className="min-h-screen">
      <div className="mx-auto grid min-h-screen w-full max-w-7xl gap-6 px-6 py-6 lg:grid-cols-[240px_1fr] lg:px-8">
        <aside className="flex flex-col rounded-lg border bg-card p-4 shadow-sm">
          <div className="px-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            GarageClaw
          </div>
          <div className="mt-4 rounded-lg bg-secondary p-3">
            <div className="text-sm font-medium">
              {user.email ?? "当前用户"}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">已登录</div>
          </div>

          <nav className="mt-6 flex flex-col gap-0.5">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center rounded-lg px-2.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <form action={signOutAction} className="mt-auto pt-6">
            <button
              type="submit"
              className="w-full rounded-lg border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
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
