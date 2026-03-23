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
    <main className="min-h-screen bg-transparent px-5 py-5 sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-6xl flex-col rounded-[2rem] border border-line bg-panel/95 shadow-[0_24px_90px_rgba(20,33,43,0.08)] backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-6 py-5">
          <div>
            <div className="font-mono text-xs uppercase tracking-[0.22em] text-accent">
              Desktop Embed
            </div>
            <div className="mt-2 text-lg font-semibold text-foreground">
              ClawX Platform Surface
            </div>
          </div>
          <nav className="flex flex-wrap items-center gap-2">
            {embedNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full border border-line bg-white/75 px-4 py-2 text-sm font-medium text-foreground transition hover:bg-white"
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
