"use client";

import { useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8787";

/**
 * "Watch this date" for admission — tickets and Express Pass.
 *
 * Separate from WatchButton, which watches a stay. A stay has two dates and a
 * hotel; admission has one date and a product. Forcing both through one
 * component would mean a form where half the fields are hidden depending on a
 * prop, which is how a control ends up submitting a check-out date for a
 * one-day ticket.
 */
export function WatchDateButton({
  kind,
  productId,
  productName,
  destination,
  signedIn,
  returnTo,
  defaultDate,
}: {
  kind: "ticket" | "express";
  /** Null for Express Pass, which is priced per destination rather than per product. */
  productId: string | null;
  productName: string;
  destination: string;
  signedIn: boolean;
  returnTo: string;
  defaultDate?: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const fallback = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  const [date, setDate] = useState(defaultDate ?? fallback);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(2);

  if (!signedIn) {
    return (
      <a href={`/join?next=${encodeURIComponent(returnTo)}`} className="btn btn-ghost btn-sm">
        Watch this price — free
      </a>
    );
  }

  async function create() {
    setBusy(true);
    setMsg(null);
    try {
      /*
       * checkOut is the day after the watched date. Admission is a single day,
       * but the stored range has to stay valid — the table and its validation
       * are shared with hotel stays.
       */
      const next = new Date(`${date}T00:00:00Z`);
      next.setUTCDate(next.getUTCDate() + 1);

      const res = await fetch(`${API}/v1/watches`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          thresholdCents: null,
          bookedNightlyCents: null,
          channels: ["email"],
          target: {
            kind,
            propertyId: null,
            ticketProductId: kind === "ticket" ? productId : null,
            destination,
            rateCode: "STANDARD",
            checkIn: date,
            checkOut: next.toISOString().slice(0, 10),
            adults,
            children,
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message ?? `Couldn't save that (${res.status})`);
      setMsg({ ok: true, text: "Watching. We'll email you if it drops." });
      setOpen(false);
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: 12 }}>
      {!open ? (
        <button className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>
          Watch this price
        </button>
      ) : (
        <div className="card" style={{ padding: 16, maxWidth: 440 }}>
          <div className="tiny muted" style={{ fontWeight: 700, marginBottom: 8 }}>
            EMAIL ME IF {productName.toUpperCase()} DROPS
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <label style={{ flex: 2, minWidth: 150 }}>
              <div className="tiny muted">Park date</div>
              <input
                type="date"
                className="field"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <label style={{ flex: 1, minWidth: 90 }}>
              <div className="tiny muted">Adults</div>
              <select
                className="field"
                value={adults}
                onChange={(e) => setAdults(Number(e.target.value))}
              >
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ flex: 1, minWidth: 90 }}>
              <div className="tiny muted">Children</div>
              <select
                className="field"
                value={children}
                onChange={(e) => setChildren(Number(e.target.value))}
              >
                {[0, 1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button className="btn btn-primary btn-sm" disabled={busy} onClick={create}>
              {busy ? "Saving…" : "Watch it"}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
          <p className="tiny muted" style={{ margin: "10px 0 0" }}>
            We price the whole party, and email at most once a day — only on a real drop.
          </p>
        </div>
      )}

      {msg ? (
        <p className="tiny" style={{ marginTop: 8, color: msg.ok ? "#077368" : "#b03514" }}>
          {msg.text}
        </p>
      ) : null}
    </div>
  );
}
