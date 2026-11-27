"use client";

import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8787";

export interface ClientSessionState {
  loaded: boolean;
  signedIn: boolean;
  isAdmin: boolean;
}

const INITIAL: ClientSessionState = { loaded: false, signedIn: false, isAdmin: false };

let cachedState: ClientSessionState | null = null;
let inflight: Promise<ClientSessionState> | null = null;

function fetchClientSession(): Promise<ClientSessionState> {
  if (cachedState) return Promise.resolve(cachedState);
  if (!inflight) {
    inflight = fetch(`${API}/v1/auth/me`, { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) return { loaded: true, signedIn: false, isAdmin: false };
        const data = (await res.json()) as {
          user?: unknown;
          entitlements?: { admin?: boolean };
        };
        return {
          loaded: true,
          signedIn: Boolean(data?.user),
          isAdmin: data?.entitlements?.admin === true,
        };
      })
      .catch(() => ({ loaded: true, signedIn: false, isAdmin: false }))
      .then((state) => {
        cachedState = state;
        return state;
      });
  }
  return inflight;
}

/**
 * Resolves the visitor's session on the client so the root layout and public
 * pages stay free of `cookies()` and can use Next.js static generation & ISR.
 */
export function useClientSession(): ClientSessionState {
  const [state, setState] = useState<ClientSessionState>(cachedState ?? INITIAL);

  useEffect(() => {
    let active = true;
    void fetchClientSession().then((next) => {
      if (active) setState(next);
    });
    return () => {
      active = false;
    };
  }, []);

  return state;
}

export function HeaderAccountActions() {
  const { signedIn, isAdmin } = useClientSession();

  if (!signedIn) {
    return (
      <a href="/join" className="btn btn-ghost btn-sm">
        Sign up free
      </a>
    );
  }

  return (
    <>
      {isAdmin ? (
        <a href="/admin" className="badge badge-hot" style={{ textDecoration: "none" }}>
          Admin
        </a>
      ) : (
        <span className="badge badge-blue">Free account</span>
      )}
      <a href="/account" className="btn btn-ghost btn-sm">
        Account
      </a>
    </>
  );
}
