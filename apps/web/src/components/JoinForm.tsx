"use client";

import { useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8787";

/**
 * Sign-up form. Magic link first, social second.
 *
 * Ordering is deliberate: email is the thing this product actually needs, since
 * rate-drop alerts are the reason people come back. Social buttons are offered
 * for speed, but the primary path collects a verified address either way.
 */
export function JoinForm({ next = "/" }: { next?: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    try {
      const res = await fetch(`${API}/v1/auth/magic-link`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        // Required so the session cookie is actually stored by the browser.
        credentials: "include",
        body: JSON.stringify({ email, redirectTo: next }),
      });
      const data = await res.json();

      if (!res.ok) {
        setState("error");
        setMessage(data?.error?.message ?? "Something went wrong. Try again?");
        return;
      }

      setState("sent");
      setMessage(data.message ?? "Check your email for a sign-in link.");

      // In demo mode the API signs you in immediately, so reload to pick up the
      // new tier rather than leaving a stale anonymous page on screen.
      if (data.demo) setTimeout(() => (window.location.href = next), 900);
    } catch {
      setState("error");
      setMessage("Something went wrong at our end. Please try again in a moment.");
    }
  }

  if (state === "sent") {
    return (
      <div className="card" style={{ textAlign: "center", padding: 32 }}>
        <div style={{ fontSize: 40, lineHeight: 1 }} aria-hidden="true">
          ✦
        </div>
        <h3 style={{ marginTop: 12 }}>Check your inbox</h3>
        <p className="muted" style={{ margin: "8px 0 0" }}>
          {message}
        </p>
      </div>
    );
  }

  return (
    <div>
      <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
        <input
          className="field"
          type="email"
          required
          placeholder="you@ratecoaster.net"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-label="Email address"
        />
        <button className="btn btn-primary btn-lg" type="submit" disabled={state === "sending"}>
          {state === "sending" ? "Sending…" : "Email me a sign-in link"}
        </button>
      </form>

      {state === "error" ? (
        <p className="tiny" style={{ color: "#b03514", marginTop: 10 }}>
          {message}
        </p>
      ) : null}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          margin: "22px 0",
          color: "var(--ink-mute)",
          fontSize: 13,
        }}
      >
        <span style={{ flex: 1, height: 1, background: "var(--line)" }} />
        or
        <span style={{ flex: 1, height: 1, background: "var(--line)" }} />
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        <a
          className="btn btn-ghost"
          href={`${API}/v1/auth/oauth/google?redirectTo=${encodeURIComponent(next)}`}
        >
          Continue with Google
        </a>
      </div>

      <p className="tiny muted" style={{ marginTop: 18, textAlign: "center" }}>
        No password to remember. We only email you about rates you ask us to watch.
      </p>
    </div>
  );
}
