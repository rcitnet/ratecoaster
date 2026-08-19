"use client";

import { useEffect, useRef, useState } from "react";

type NavItem = {
  href: string;
  label: string;
};

export function MobileMenu({
  items,
  signedIn,
  isAdmin,
}: {
  items: readonly NavItem[];
  signedIn: boolean;
  isAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnScroll = () => setOpen(false);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("scroll", closeOnScroll, { capture: true, passive: true });
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("scroll", closeOnScroll, true);
    };
  }, [open]);

  return (
    <div className={`mobile-menu ${open ? "open" : ""}`} ref={rootRef}>
      <button
        type="button"
        ref={triggerRef}
        aria-expanded={open}
        aria-controls="mobile-site-navigation"
        aria-label={open ? "Close site navigation" : "Open site navigation"}
        onClick={() => setOpen((current) => !current)}
      >
        <span aria-hidden="true">{open ? "×" : "☰"}</span>
        Menu
      </button>

      {open ? (
        <nav id="mobile-site-navigation" className="mobile-nav" aria-label="Mobile navigation">
          {items.map((item) => (
            <a key={item.href} href={item.href} onClick={() => setOpen(false)}>
              {item.label}
              <span aria-hidden="true">›</span>
            </a>
          ))}
          <div className="mobile-nav-account">
            {signedIn ? (
              <>
                {isAdmin ? (
                  <a href="/admin" className="btn btn-primary" onClick={() => setOpen(false)}>
                    Admin dashboard
                  </a>
                ) : null}
                <a href="/account" className="btn btn-ghost" onClick={() => setOpen(false)}>
                  Account
                </a>
              </>
            ) : (
              <a href="/join" className="btn btn-primary" onClick={() => setOpen(false)}>
                Sign up free
              </a>
            )}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
