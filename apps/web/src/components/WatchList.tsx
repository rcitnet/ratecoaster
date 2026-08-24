"use client";

import { useState } from "react";
import type { WatchView } from "@ratecoaster/shared";

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8787";

/**
 * The watchlist, with a working remove button.
 *
 * An account page that lists watches but cannot delete one is how people end up
 * marking the emails as spam instead — which costs the sending domain's
 * reputation far more than the unsubscribe would have.
 */
export function WatchList({ watches }: { watches: WatchView[] }) {
  const [removing, setRemoving] = useState<string | null>(null);
  const [gone, setGone] = useState<Set<string>>(new Set());

  const visible = watches.filter((w) => !gone.has(w.id));

  if (visible.length === 0) {
    return (
      <div className="notice">
        <b>No trips watched yet.</b> Open any hotel and choose{" "}
        <b>Watch these dates</b> — we&apos;ll email you if the price falls.{" "}
        <a href="/hotels">Browse hotels</a>
      </div>
    );
  }

  async function remove(id: string) {
    setRemoving(id);
    try {
      const res = await fetch(`${API}/v1/watches/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) setGone((prev) => new Set(prev).add(id));
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Watching</th>
            <th>Dates</th>
            <th>Price type</th>
            <th>Last alert</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {visible.map((w) => (
            <tr key={w.id}>
              <td>
                {w.target.kind === "hotel" && w.propertySlug ? (
                  <a href={`/hotels/${w.propertySlug}`}>{w.propertyName}</a>
                ) : (
                  w.ticketProductName ?? w.propertyName ?? "Destination hotels"
                )}
              </td>
              <td className="tiny muted">
                {w.target.kind === "hotel"
                  ? `${w.target.checkIn} → ${w.target.checkOut}`
                  : w.target.checkIn}
              </td>
              <td className="tiny muted">
                {w.target.kind === "hotel"
                  ? w.target.rateCode
                  : w.target.kind === "express"
                    ? "Express Pass"
                    : "Admission"}
              </td>
              <td className="tiny muted">
                {w.lastNotifiedCents !== null
                  ? `$${(w.lastNotifiedCents / 100).toFixed(2)}`
                  : "none yet"}
              </td>
              <td className="num">
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={removing === w.id}
                  onClick={() => remove(w.id)}
                >
                  {removing === w.id ? "…" : "Remove"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
