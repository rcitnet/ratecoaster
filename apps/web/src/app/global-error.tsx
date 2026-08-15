"use client";

/**
 * Last-resort error boundary, used when the root layout itself throws.
 *
 * It has to render its own <html> and <body> because at this point the layout
 * that normally provides them has failed. Styles are inline for the same
 * reason — globals.css is imported by that layout.
 */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "Inter, system-ui, sans-serif",
          display: "grid",
          placeItems: "center",
          minHeight: "100vh",
          margin: 0,
          color: "#16123c",
          textAlign: "center",
          padding: 24,
        }}
      >
        <div>
          <h1 style={{ fontSize: 30, marginBottom: 10 }}>Something broke on our end</h1>
          <p style={{ color: "#7d76a3", marginBottom: 22 }}>
            Not your fault. Try again in a moment.
          </p>
          <button
            onClick={reset}
            style={{
              background: "#e6218c",
              color: "#fff",
              border: "none",
              padding: "12px 24px",
              borderRadius: 999,
              fontSize: 16,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
