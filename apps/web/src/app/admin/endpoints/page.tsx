import { getEndpoints } from "@/lib/admin";
import { relativeTime } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function AdminEndpoints() {
  const endpoints = await getEndpoints();

  return (
    <>
      <p className="lede" style={{ marginBottom: 20 }}>
        A price source is one booking or ticket page we know how to read. Each is configured once
        from a browser capture, and re-captured whenever the site changes underneath it.
      </p>

      <div className="grid grid-2">
        {endpoints.map((e) => (
          <a key={e.name} href={`/admin/endpoints/${e.name}`}>
            <div className="card card-hover">
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <h3 style={{ fontSize: 16 }}>{e.name}</h3>
                {e.configured ? (
                  e.lastTestOk === true ? (
                    <span className="badge badge-deal">Tested OK</span>
                  ) : e.lastTestOk === false ? (
                    <span className="badge badge-coral">Test failed</span>
                  ) : (
                    <span className="badge badge-express">Untested</span>
                  )
                ) : (
                  <span className="badge">Not set up</span>
                )}
              </div>

              {e.lastTestMessage ? (
                <div className="tiny muted" style={{ marginTop: 8 }}>{e.lastTestMessage}</div>
              ) : (
                <div className="tiny muted" style={{ marginTop: 8 }}>
                  Upload a capture to configure this source.
                </div>
              )}

              {e.updatedAt ? (
                <div className="tiny muted" style={{ marginTop: 6 }}>
                  Updated {relativeTime(e.updatedAt)}
                </div>
              ) : null}
            </div>
          </a>
        ))}
      </div>

      {endpoints.length === 0 ? (
        <div className="notice">
          No price sources referenced yet. Hotels and ticket products declare which adapter they
          use; seed the database first.
        </div>
      ) : null}
    </>
  );
}
