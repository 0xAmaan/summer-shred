"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Trophy, FileScan, Users, Scale, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/admin/challenges", label: "Challenges", icon: Trophy },
  { href: "/admin/scans", label: "DEXA scans", icon: FileScan },
  { href: "/admin/participants", label: "Participants", icon: Users },
  { href: "/admin/weigh-ins", label: "Weigh-ins", icon: Scale },
];

export function Sidebar() {
  const pathname = usePathname();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  return (
    <aside className="hidden md:flex w-60 flex-col border-r border-border bg-card">
      <div className="px-5 py-5 border-b border-border">
        <Link href="/" className="block group">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground group-hover:text-foreground transition-colors">
            Summer Shred
          </p>
          <p className="mt-1 text-base font-semibold tracking-tight text-foreground">
            Admin console
          </p>
        </Link>
      </div>

      <nav className="flex-1 flex flex-col gap-0.5 px-3 py-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex items-center gap-3 rounded-md px-3 py-2 text-[14px] font-medium transition-colors",
                isActive
                  ? "bg-foreground/[0.06] text-foreground"
                  : "text-muted-foreground hover:bg-foreground/[0.03] hover:text-foreground"
              )}
            >
              {isActive && (
                <span
                  aria-hidden
                  className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-foreground"
                />
              )}
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border px-3 py-3">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-[14px] font-medium text-muted-foreground hover:bg-foreground/[0.03] hover:text-foreground transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </div>
    </aside>
  );
}
