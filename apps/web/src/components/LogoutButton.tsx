"use client";

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8787";

export function LogoutButton() {
  return (
    <button
      className="btn btn-ghost btn-sm"
      onClick={async () => {
        await fetch(`${API}/v1/auth/logout`, { method: "POST", credentials: "include" });
        window.location.href = "/";
      }}
    >
      Sign out
    </button>
  );
}
