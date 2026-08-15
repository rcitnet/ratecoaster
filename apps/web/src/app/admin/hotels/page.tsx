import { getProperties } from "@/lib/admin";
import { PropertyControls } from "@/components/AdminControls";
import { TIER_LABELS } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function AdminHotels() {
  const properties = await getProperties();

  const byDestination = new Map<string, typeof properties>();
  for (const p of properties) {
    if (!byDestination.has(p.destination)) byDestination.set(p.destination, []);
    byDestination.get(p.destination)!.push(p);
  }

  return (
    <>
      <div className="notice notice-warn">
        <b>The Express Pass flag drives real spending decisions.</b> A family choosing between a
        $550 Premier room and a $250 Prime Value room is really deciding whether free Express
        Unlimited for their party is worth $300 a night. Verify each one against the official hotel
        page before launch — Universal changes these, and the Epic Universe hotels are new enough
        that public sources disagree.
      </div>

      {[...byDestination.entries()].map(([destination, rows]) => (
        <section key={destination}>
          <h2 style={{ marginTop: 30 }}>{destination.replace(/-/g, " ")}</h2>
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table>
              <thead>
                <tr>
                  <th>Hotel</th>
                  <th>Tier</th>
                  <th>Source</th>
                  <th>Code &amp; perks</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const cfg = (p.collectorConfig ?? {}) as Record<string, unknown>;
                  const code = typeof cfg.hotelCode === "string" ? cfg.hotelCode : "";
                  const adapter = typeof cfg.adapter === "string" ? cfg.adapter : "—";
                  return (
                    <tr key={p.id}>
                      <td>
                        <b>{p.name}</b>
                        <div className="tiny muted">
                          {p.operator}
                          {p.roomCount ? ` · ${p.roomCount.toLocaleString()} rooms` : ""}
                        </div>
                      </td>
                      <td><span className="badge">{TIER_LABELS[p.tier] ?? p.tier}</span></td>
                      <td className="tiny muted">{adapter}</td>
                      <td>
                        <PropertyControls
                          id={p.id}
                          hotelCode={code}
                          includesExpressPass={p.includesExpressPass}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </>
  );
}
