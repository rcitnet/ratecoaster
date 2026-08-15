import { EndpointWizard } from "@/components/EndpointWizard";

export const dynamic = "force-dynamic";

export default async function EndpointSetup({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;

  return (
    <>
      <a href="/admin/endpoints" className="tiny muted">← All price sources</a>
      <h2 style={{ marginTop: 10, marginBottom: 16 }}>{name}</h2>
      <EndpointWizard name={name} />
    </>
  );
}
