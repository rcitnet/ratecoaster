import { getUsers } from "@/lib/admin";
import { relativeTime } from "@/lib/api";
import { UserTierControl } from "@/components/AdminControls";

export const dynamic = "force-dynamic";

export default async function AdminUsers() {
  const users = await getUsers();
  const byTier = users.reduce<Record<string, number>>((acc, u) => {
    acc[u.tier] = (acc[u.tier] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <>
      <div className="grid grid-4">
        {(["free", "pro", "admin"] as const).map((tier) => (
          <div className="card" key={tier}>
            <div className="tiny muted" style={{ fontWeight: 700 }}>{tier.toUpperCase()}</div>
            <div className="cal-price" style={{ fontSize: 28 }}>{byTier[tier] ?? 0}</div>
          </div>
        ))}
      </div>

      <div className="table-wrap" style={{ marginTop: 24 }}>
        <table>
          <thead>
            <tr><th>Email</th><th>Joined</th><th>Last seen</th><th>Tier</th></tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr><td colSpan={4} className="muted">No accounts yet.</td></tr>
            ) : users.map((u) => (
              <tr key={u.id}>
                <td>{u.email ?? <span className="muted">anonymous</span>}</td>
                <td className="tiny muted">{relativeTime(u.createdAt)}</td>
                <td className="tiny muted">{u.lastSeenAt ? relativeTime(u.lastSeenAt) : "—"}</td>
                <td><UserTierControl id={u.id} tier={u.tier} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="tiny muted" style={{ marginTop: 14 }}>
        You can&apos;t remove your own admin access here — that would lock you out with no way back
        except the server. Use <code>npm run -w @ratecoaster/api admin:grant -- email --revoke</code>.
      </p>
    </>
  );
}
