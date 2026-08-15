"use client";

import { useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8787";

async function call(path: string, method: string, body?: unknown) {
  const res = await fetch(`${API}${path}`, {
    method,
    credentials: "include",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(data?.error?.message ?? `HTTP ${res.status}`);
  return data;
}

function useAction() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const run = async (fn: () => Promise<unknown>, successText: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: true, text: successText });
      // Reload so the server-rendered values reflect what just changed, rather
      // than leaving the page showing stale state next to a success message.
      setTimeout(() => window.location.reload(), 700);
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };

  return { busy, msg, run };
}

function Feedback({ msg }: { msg: { ok: boolean; text: string } | null }) {
  if (!msg) return null;
  return (
    <span className="tiny" style={{ marginLeft: 10, color: msg.ok ? "#077368" : "#b03514" }}>
      {msg.text}
    </span>
  );
}

/* ---------- collectors ---------- */

export function CollectorControls({
  name,
  dryRun,
  enabled,
  ready,
}: {
  name: string;
  dryRun: boolean;
  enabled: boolean;
  ready: boolean;
}) {
  const { busy, msg, run } = useAction();

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <button
        className="btn btn-ghost btn-sm"
        disabled={busy}
        onClick={() => run(() => call(`/v1/admin/collectors/${name}/run`, "POST"), "Started")}
      >
        Run now
      </button>

      <button
        className="btn btn-ghost btn-sm"
        disabled={busy}
        onClick={() =>
          run(
            () => call(`/v1/admin/collectors/${name}`, "PATCH", { enabled: !enabled }),
            enabled ? "Disabled" : "Enabled"
          )
        }
      >
        {enabled ? "Disable" : "Enable"}
      </button>

      {dryRun ? (
        <button
          className="btn btn-primary btn-sm"
          disabled={busy || !ready}
          title={
            ready
              ? "Start sending real requests to the third-party site"
              : "Configure a price source for this collector first"
          }
          onClick={() => {
            // Going live means real traffic to someone else's booking engine.
            // Worth one deliberate confirmation rather than a stray click.
            if (
              !window.confirm(
                `Turn OFF dry run for ${name}?\n\nIt will start sending real requests to the ` +
                  `third-party site. Only do this once a test request has returned sensible prices.`
              )
            ) {
              return;
            }
            void run(
              () => call(`/v1/admin/collectors/${name}`, "PATCH", { dryRun: false }),
              "Now live"
            );
          }}
        >
          Go live
        </button>
      ) : (
        <button
          className="btn btn-ghost btn-sm"
          disabled={busy}
          onClick={() =>
            run(() => call(`/v1/admin/collectors/${name}`, "PATCH", { dryRun: true }), "Back to dry run")
          }
        >
          Back to dry run
        </button>
      )}

      <Feedback msg={msg} />
    </div>
  );
}

/* ---------- property row ---------- */

export function PropertyControls({
  id,
  hotelCode,
  includesExpressPass,
}: {
  id: string;
  hotelCode: string;
  includesExpressPass: boolean;
}) {
  const [code, setCode] = useState(hotelCode);
  const { busy, msg, run } = useAction();

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <input
        className="field"
        style={{ width: 150, padding: "7px 12px", fontSize: 14 }}
        value={code}
        placeholder="hotel code"
        onChange={(e) => setCode(e.target.value)}
      />
      <button
        className="btn btn-ghost btn-sm"
        disabled={busy || code === hotelCode}
        onClick={() =>
          run(
            () => call(`/v1/admin/properties/${id}`, "PATCH", { hotelCode: code || null }),
            "Saved"
          )
        }
      >
        Save code
      </button>
      <button
        className={`btn btn-sm ${includesExpressPass ? "btn-primary" : "btn-ghost"}`}
        disabled={busy}
        title="Whether this hotel includes free Express Unlimited — the highest-value field on the site"
        onClick={() =>
          run(
            () =>
              call(`/v1/admin/properties/${id}`, "PATCH", {
                includesExpressPass: !includesExpressPass,
              }),
            "Updated"
          )
        }
      >
        Express {includesExpressPass ? "✓" : "✗"}
      </button>
      <Feedback msg={msg} />
    </div>
  );
}

/* ---------- user tier ---------- */

export function UserTierControl({ id, tier }: { id: string; tier: string }) {
  const { busy, msg, run } = useAction();

  return (
    <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
      {(["free", "pro", "admin"] as const).map((t) => (
        <button
          key={t}
          className={`btn btn-sm ${tier === t ? "btn-blue" : "btn-ghost"}`}
          disabled={busy || tier === t}
          onClick={() => run(() => call(`/v1/admin/users/${id}`, "PATCH", { tier: t }), "Updated")}
        >
          {t}
        </button>
      ))}
      <Feedback msg={msg} />
    </span>
  );
}
