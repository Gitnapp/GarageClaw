import Link from "next/link";

const embedNav = [
  { href: "/embed/marketplace", label: "Marketplace" },
  { href: "/embed/profile", label: "Profile" },
  { href: "/embed/credits", label: "Credits" },
] as const;

export default function EmbedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <main className="min-h-screen px-5 py-5 sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-6xl flex-col rounded-lg border bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b px-6 py-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Desktop Embed
            </div>
            <div className="mt-1 text-lg font-semibold">
              GarageClaw Platform
            </div>
          </div>
          <nav className="flex flex-wrap items-center gap-2">
            {embedNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg border bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex-1 px-6 py-6">{children}</div>
      </div>
    </main>
  );
}
