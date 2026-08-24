"use client";

import { useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8787";

/**
 * "Watch these dates" — the control behind the site's rate-drop promise.
 *
 * Deliberately a small form rather than a one-click toggle. A watch without
 * dates cannot be priced, and a watch the user did not mean to create becomes
 * an email they did not want, which is the fastest route to the spam folder.
 */
export function WatchButton({
  propertyId,
  propertyName,
  destination,
  rateCode,
  signedIn,
  returnTo,
}: {
  propertyId: string;
  propertyName: string;
  destination: string;
  rateCode: string;
  signedIn: boolean;
  returnTo: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const today = new Date();
  const defaultIn = new Date(today.getTime() + 30 * 86_400_000).toISOString().slice(0, 10);
  const defaultOut = new Date(today.getTime() + 34 * 86_400_000).toISOString().slice(0, 10);

  const [checkIn, setCheckIn] = useState(defaultIn);
  const [checkOut, setCheckOut] = useState(defaultOut);

  if (!signedIn) {
    return (
      <a href={`/join?next=${encodeURIComponent(returnTo)}`} className="btn btn-ghost btn-sm">
        Watch these dates — free
      </a>
    );
  }

  async function create() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`${API}/v1/watches`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          thresholdCents: null,
          bookedNightlyCents: null,
          channels: ["email"],
          target: {
            propertyId,
            destination,
            rateCode,
            checkIn,
            checkOut,
            adults: 2,
            children: 0,
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error?.message ?? `Couldn't save that (${res.status})`);
      }
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
          Watch these dates
        </button>
      ) : (
        <div className="card" style={{ padding: 16, maxWidth: 420 }}>
          <div className="tiny muted" style={{ fontWeight: 700, marginBottom: 8 }}>
            EMAIL ME IF {propertyName.toUpperCase()} DROPS
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <label style={{ flex: 1, minWidth: 140 }}>
              <div className="tiny muted">Check in</div>
              <input
                type="date"
                className="field"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
              />
            </label>
            <label style={{ flex: 1, minWidth: 140 }}>
              <div className="tiny muted">Check out</div>
              <input
                type="date"
                className="field"
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
              />
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
            At most one email per day per trip, and only when the price actually falls.
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
