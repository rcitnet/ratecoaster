"use client";

import { useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8787";

/**
 * The HAR → config → test → save loop, as a screen.
 *
 * This replaces the command-line dance of exporting a HAR, scp-ing it to the
 * server, running an importer, editing JSON in nano, and running a verify
 * script. Same steps, same safety checks, but you can see what each one did.
 */
export function EndpointWizard({ name }: { name: string }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [guess, setGuess] = useState<{
    config: Record<string, unknown>;
    sample: Record<string, unknown>;
    sourceUrl: string;
    warnings: string[];
    candidateCount: number;
  } | null>(null);

  const [configText, setConfigText] = useState("");
  const [hotelCode, setHotelCode] = useState("");
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
    rateCodeApplied?: boolean;
    offers?: Array<{ roomCode: string; roomName: string; nightlyCents: number }>;
  } | null>(null);

  async function onHarSelected(file: File) {
    setBusy(true);
    setError(null);
    try {
      const text = await file.text();
      const res = await fetch(`${API}/v1/admin/endpoints/${name}/guess`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "text/plain" },
        body: text,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Couldn't read that HAR");
      setGuess(data);
      setConfigText(JSON.stringify(data.config, null, 2));
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const config = JSON.parse(configText);
      const res = await fetch(`${API}/v1/admin/endpoints/${name}`, {
        method: "PUT",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ config }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Config rejected");
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    setError(null);
    setTestResult(null);
    try {
      const res = await fetch(`${API}/v1/admin/endpoints/${name}/test`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ hotelCode, rateCode: "APH" }),
      });
      setTestResult(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ padding: 24 }}>
      <div className="chips" style={{ marginTop: 0 }}>
        <span className={`chip ${step === 1 ? "on" : ""}`}>1 · Capture</span>
        <span className={`chip ${step === 2 ? "on" : ""}`}>2 · Check</span>
        <span className={`chip ${step === 3 ? "on" : ""}`}>3 · Test</span>
      </div>

      {error ? (
        <div className="notice notice-warn" style={{ marginTop: 16 }}>
          {error}
        </div>
      ) : null}

      {step === 1 ? (
        <div style={{ marginTop: 8 }}>
          <h3>Upload a HAR capture</h3>
          <p className="muted" style={{ fontSize: 15, marginTop: 8 }}>
            In your browser, open the booking page, press F12, go to <b>Network</b>, filter to{" "}
            <b>Fetch/XHR</b>, and run a search with <code>APH</code> in the promo field. Right-click
            the request that returned prices and choose <b>Copy as HAR</b> — or save all with
            content. Then drop the file here.
          </p>
          <input
            type="file"
            accept=".har,application/json,text/plain"
            disabled={busy}
            style={{ marginTop: 14 }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onHarSelected(file);
            }}
          />
          <p className="tiny muted" style={{ marginTop: 12 }}>
            The file is read and discarded — only the resulting config is stored, with cookie and
            authorization headers stripped.
          </p>
        </div>
      ) : null}

      {step === 2 && guess ? (
        <div style={{ marginTop: 8 }}>
          <h3>Check what it inferred</h3>
          <p className="muted tiny" style={{ marginTop: 6 }}>
            Best of {guess.candidateCount} candidate responses. Source:{" "}
            <code style={{ wordBreak: "break-all" }}>{guess.sourceUrl.slice(0, 120)}</code>
          </p>

          {guess.warnings.length > 0 ? (
            <div className="notice notice-warn" style={{ marginTop: 14 }}>
              <b>Before you save:</b>
              <ul style={{ margin: "8px 0 0", paddingLeft: 20 }}>
                {guess.warnings.map((w) => (
                  <li key={w} style={{ fontSize: 14 }}>
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="grid grid-2" style={{ marginTop: 16, alignItems: "start" }}>
            <div>
              <div className="tiny muted" style={{ fontWeight: 700, marginBottom: 6 }}>
                CONFIG — edit freely
              </div>
              <textarea
                className="field"
                style={{
                  minHeight: 360,
                  fontFamily: "ui-monospace, monospace",
                  fontSize: 12,
                  borderRadius: 12,
                  lineHeight: 1.5,
                }}
                value={configText}
                onChange={(e) => setConfigText(e.target.value)}
              />
            </div>
            <div>
              <div className="tiny muted" style={{ fontWeight: 700, marginBottom: 6 }}>
                SAMPLE ROW IT READ — check the field paths against this
              </div>
              <pre
                style={{
                  background: "var(--cream)",
                  padding: 14,
                  borderRadius: 12,
                  fontSize: 12,
                  maxHeight: 360,
                  overflow: "auto",
                  margin: 0,
                }}
              >
                {JSON.stringify(guess.sample, null, 2)}
              </pre>
            </div>
          </div>

          <button className="btn btn-primary" style={{ marginTop: 16 }} disabled={busy} onClick={save}>
            Save config
          </button>
        </div>
      ) : null}

      {step === 3 ? (
        <div style={{ marginTop: 8 }}>
          <h3>Send one test request</h3>
          <p className="muted" style={{ fontSize: 15, marginTop: 6 }}>
            This sends a single real request 45 days out and shows what came back. Nothing is
            written to the price tables.
          </p>

          <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
            <input
              className="field"
              style={{ width: 220 }}
              placeholder="hotel code (e.g. PBH)"
              value={hotelCode}
              onChange={(e) => setHotelCode(e.target.value)}
            />
            <button className="btn btn-blue" disabled={busy} onClick={test}>
              {busy ? "Testing…" : "Run test"}
            </button>
          </div>

          {testResult ? (
            <div
              className="notice"
              style={{
                marginTop: 18,
                background: testResult.ok ? "var(--teal-tint)" : "var(--coral-tint)",
                color: testResult.ok ? "#077368" : "#b03514",
              }}
            >
              <b>{testResult.message}</b>
              {testResult.rateCodeApplied === false ? (
                <p style={{ margin: "8px 0 0", fontSize: 14 }}>
                  The promo code wasn&apos;t applied, so these are public rates. Storing them as
                  passholder prices would show a discount that doesn&apos;t exist — the collector
                  discards them. Fix <code>rateCodeAppliedPath</code>, or try a date where the
                  passholder rate is published.
                </p>
              ) : null}
            </div>
          ) : null}

          {testResult?.offers?.length ? (
            <div className="table-wrap" style={{ marginTop: 16 }}>
              <table>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Room</th>
                    <th className="num">Nightly</th>
                  </tr>
                </thead>
                <tbody>
                  {testResult.offers.map((o, i) => (
                    <tr key={`${o.roomCode}-${i}`}>
                      <td className="tiny">{o.roomCode}</td>
                      <td>{o.roomName}</td>
                      <td className="num">${(o.nightlyCents / 100).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          <p className="tiny muted" style={{ marginTop: 16 }}>
            Once these look right, go to <a href="/admin/collectors"><b>Collectors</b></a> and switch
            the matching collector off dry run.
          </p>
        </div>
      ) : null}
    </div>
  );
}
