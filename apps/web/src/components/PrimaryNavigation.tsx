"use client";

import { usePathname } from "next/navigation";

export function PrimaryNavigation({ items }: { items: readonly { href: string; label: string }[] }) {
  const pathname = usePathname();
  function active(href: string) { return href === "/" ? pathname === "/" : pathname.startsWith(href); }
  return <nav className="nav refresh-navigation" aria-label="Primary navigation">
    {items.map((item) => <a key={item.href} href={item.href} aria-current={active(item.href) ? "page" : undefined}>{item.label}</a>)}
  </nav>;
}
