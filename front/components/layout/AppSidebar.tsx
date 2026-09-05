"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import type { CurrentUser } from "@/types/auth";
import { getNavItems } from "./RoleBasedNav";

export function AppSidebar({ user, mobile = false, onNavigate }: {
  user?: CurrentUser | null;
  mobile?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const items = getNavItems(user);

  return (
    <aside className={cn("shrink-0 bg-white", mobile ? "w-full" : "hidden w-64 border-r border-border md:block")}>
      <div className="border-b border-border px-5 py-5">
        <p className="text-xl font-semibold text-primary">CalifApp</p>
        <p className="text-sm text-institutional-gray">Panel administrativo</p>
      </div>

      <nav aria-label="Navegación principal" className="space-y-1 px-3 py-4">
        {items.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <Link
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2.5 text-base font-medium text-institutional-gray-dark hover:bg-institutional-blue-light hover:text-primary",
                isActive && "bg-institutional-blue-light text-primary",
              )}
              href={item.href}
              key={item.href}
              aria-current={isActive ? "page" : undefined}
              onClick={onNavigate}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
