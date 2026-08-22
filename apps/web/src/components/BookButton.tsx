import { merchantLabel } from "@/lib/api";
import { AffiliateDisclosure } from "@/components/AffiliateDisclosure";

/**
 * The affiliate Book CTA.
 *
 * Two things make this correct rather than just a link: `rel="sponsored nofollow
 * noopener noreferrer"` (Google requires `sponsored` on paid/affiliate links,
 * and `noopener` closes the tab-nabbing hole on `target="_blank"`), and the FTC
 * disclosure rendered immediately beneath it so the relationship is disclosed
 * right where the click happens, never only in the footer.
 *
 * Renders nothing when there is no URL, so pages can drop it in unconditionally
 * and it simply lights up once a feed has populated the product's booking link.
 */
export function BookButton({
  url,
  merchant,
  size = "sm",
  label,
}: {
  url: string | null | undefined;
  merchant?: string | null;
  size?: "sm" | "lg";
  /** Overrides "Book on X" where the action is comparing rather than booking. */
  label?: string;
}) {
  if (!url) return null;

  return (
    <div className="book-cta">
      <a
        href={url}
        target="_blank"
        rel="sponsored nofollow noopener noreferrer"
        className={`btn btn-book ${size === "lg" ? "btn-lg" : "btn-sm"}`}
      >
        {label ?? `Book on ${merchantLabel(merchant)}`}
        <span aria-hidden="true"> ↗</span>
      </a>
      <AffiliateDisclosure variant="inline" merchant={merchant} />
    </div>
  );
}
