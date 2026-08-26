import { SocialDeliveryControls, SocialRunControls, SocialSettingControls } from "@/components/AdminControls";
import { getSocial } from "@/lib/admin";
import { relativeTime } from "@/lib/api";

const PLATFORM_LABELS = { threads: "Threads", bluesky: "Bluesky", x: "X" } as const;

export default async function AdminSocialPage() {
  const data = await getSocial();
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h2>Social publishing</h2>
          <p className="muted" style={{ marginTop: 6, maxWidth: 760 }}>
            Threads and Bluesky can publish through their official APIs. X stays human-approved:
            RateCoaster prepares the post, then opens the official composer for you to confirm.
          </p>
        </div>
        <SocialRunControls />
      </div>

      <div className="grid grid-3" style={{ marginTop: 22 }}>
        {data.settings.map((setting) => (
          <article className="card" key={setting.platform} style={{ padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <h3>{PLATFORM_LABELS[setting.platform]}</h3>
              <span className={`badge ${setting.enabled ? "badge-deal" : ""}`}>
                {setting.enabled ? (setting.automatic && setting.dryRun ? "Dry run" : "Enabled") : "Off"}
              </span>
            </div>
            <p className="tiny muted" style={{ minHeight: 42 }}>{setting.detail}</p>
            <SocialSettingControls {...setting} />
          </article>
        ))}
      </div>

      <h2 style={{ marginTop: 34 }}>Publishing queue</h2>
      {data.deliveries.length === 0 ? (
        <div className="notice" style={{ marginTop: 14 }}>
          No posts have been generated yet. During park hours, Generate now will prepare the current
          shortest-waits update. The daily hotel deal is prepared at 8 AM Eastern.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 14, marginTop: 14 }}>
          {data.deliveries.map((delivery, index) => (
            <article className="card" key={`${delivery.postId}-${delivery.deliveryId ?? index}`} style={{ padding: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <span className="badge">{delivery.kind}</span>{" "}
                  {delivery.platform ? <span className="badge">{PLATFORM_LABELS[delivery.platform]}</span> : null}{" "}
                  {delivery.status ? <span className={`badge ${delivery.status === "published" ? "badge-deal" : delivery.status === "failed" ? "badge-coral" : ""}`}>{delivery.status}</span> : null}
                </div>
                <span className="tiny muted">created {relativeTime(delivery.createdAt)}</span>
              </div>
              <pre style={{ whiteSpace: "pre-wrap", font: "inherit", margin: "14px 0", lineHeight: 1.55 }}>
                {delivery.fullText}
              </pre>
              {delivery.lastError ? <p className="tiny" style={{ color: "#b03514" }}>{delivery.lastError}</p> : null}
              {delivery.externalUrl ? <p className="tiny"><a href={delivery.externalUrl} target="_blank" rel="noopener noreferrer">View published post ↗</a></p> : null}
              {delivery.deliveryId && delivery.platform && delivery.status ? (
                <SocialDeliveryControls
                  id={delivery.deliveryId}
                  platform={delivery.platform}
                  status={delivery.status}
                  fullText={delivery.fullText}
                />
              ) : null}
            </article>
          ))}
        </div>
      )}
    </>
  );
}
