import { merchantLabel } from "@/lib/api";

/**
 * FTC affiliate disclosure — the single source of truth for the wording.
 *
 * The US FTC requires an affiliate relationship to be disclosed "clearly and
 * conspicuously" and close to the affiliate link, not buried. So the same text
 * lives in two placements: `inline` sits right under each Book button, and
 * `footer` is the site-wide statement. Keeping both here means the wording is
 * edited in one place. (Worth a lawyer's eye before launch.)
 */
export function AffiliateDisclosure({
  variant = "inline",
  merchant,
}: {
  variant?: "inline" | "footer";
  merchant?: string | null;
}) {
  if (variant === "footer") {
    return (
      <p style={{ margin: "0 0 6px" }}>
        Some links to tickets and hotels are affiliate links. If you book through
        one, we may earn a commission at no extra cost to you — it helps keep this
        site running. We only ever link prices we have actually tracked, and a
        commission never changes which deals we surface or how we rank them.
      </p>
    );
  }

  return (
    <p className="affiliate-note">
      Affiliate link{merchant ? ` to ${merchantLabel(merchant)}` : ""}. We may earn
      a commission if you book, at no extra cost to you.
    </p>
  );
}
