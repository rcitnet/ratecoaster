import { NAMED_LINKS } from "@ratecoaster/shared";
import { BookButton } from "@/components/BookButton";

/**
 * A CTA for one of the named destinations in the affiliate registry.
 *
 * Thin wrapper over BookButton so `rel="sponsored"` and the FTC disclosure keep
 * coming from a single component — the moment a second page hand-rolls its own
 * anchor, one of them will eventually ship without the disclosure.
 *
 * Renders nothing for an unknown key rather than throwing: a bad key is a
 * developer mistake, and taking a whole page down over a missing CTA would be a
 * worse outcome for the visitor than a page with one fewer button.
 */
export function CompareButton({
  linkKey,
  size = "sm",
  label,
}: {
  linkKey: keyof typeof NAMED_LINKS | string;
  size?: "sm" | "lg";
  label?: string;
}) {
  const link = NAMED_LINKS[linkKey];
  if (!link) return null;

  return (
    <BookButton
      url={`/go/l/${link.key}`}
      merchant={link.merchant}
      size={size}
      label={label ?? link.label}
    />
  );
}
