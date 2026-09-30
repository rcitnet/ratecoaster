"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

export function PrimaryNavigation({ items }: { items: readonly { href: string; label: string }[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const primary = items.filter((item) => ["/", "/hotels", "/waits"].includes(item.href));
  const more = items.filter((item) => !primary.includes(item));
  function active(href: string) { return href === "/" ? pathname === "/" : pathname.startsWith(href); }
  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) { if (!root.current?.contains(event.target as Node)) setOpen(false); }
    function escape(event: KeyboardEvent) { if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); } }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);
  return <nav className="nav refresh-navigation" aria-label="Primary navigation">
    {primary.map((item) => <a key={item.href} href={item.href} aria-current={active(item.href) ? "page" : undefined}>{item.label}</a>)}
    <div className="refresh-nav-more" ref={root}>
      <button ref={trigger} aria-expanded={open} aria-controls="more-site-navigation" onClick={() => setOpen(!open)}>More <span aria-hidden="true">⌄</span></button>
      {open && <div id="more-site-navigation" className="refresh-nav-dropdown">
        {more.map((item) => <a key={item.href} href={item.href} aria-current={active(item.href) ? "page" : undefined} onClick={() => setOpen(false)}>{item.label}</a>)}
      </div>}
    </div>
  </nav>;
}
