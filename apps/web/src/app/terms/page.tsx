import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — RateCoaster",
  description: "The terms that apply when using RateCoaster.",
};

export default function TermsPage() {
  return (
    <main className="section legal-page">
      <p className="eyebrow">Legal</p>
      <h1>Terms of Service</h1>
      <p className="muted">Effective August 19, 2026</p>

      <p className="lede">
        These terms govern your use of RateCoaster. By accessing or using the site, you agree to these
        terms. If you do not agree, please do not use RateCoaster.
      </p>

      <h2>What RateCoaster provides</h2>
      <p>
        RateCoaster is an independent travel-planning and price-tracking service. It displays observed
        hotel rates, ticket and Express Pass prices, attraction wait times, historical information, and
        planning estimates. RateCoaster is not a hotel, ticket seller, travel agency, or booking service.
      </p>
      <p>
        RateCoaster is not affiliated with, endorsed by, or sponsored by Universal Destinations &amp;
        Experiences, NBCUniversal, Loews Hotels, or other destinations and merchants referenced on the
        site. Names and trademarks belong to their respective owners.
      </p>

      <h2>Prices, availability, and planning estimates</h2>
      <p>
        Prices and availability can change at any time and may differ because of taxes, fees, occupancy,
        eligibility rules, inventory changes, promotions, technical delays, or source updates. Wait times
        are estimates and may be delayed or inaccurate. Trip-planning results are informational estimates,
        not reservations, quotes, or guarantees.
      </p>
      <p>
        Always confirm the final price, eligibility requirements, cancellation terms, availability, and
        product details with the official hotel, destination, or merchant before purchasing or traveling.
      </p>

      <h2>Accounts</h2>
      <p>
        You are responsible for activity under your account and for keeping access to your email and
        connected sign-in providers secure. Information you provide must be accurate and lawful. Notify us
        promptly at <a href="mailto:rcitnet@gmail.com">rcitnet@gmail.com</a> if you believe your account
        has been compromised.
      </p>

      <h2>Alerts</h2>
      <p>
        Price and availability alerts are provided as a convenience. Delivery may be delayed, blocked, or
        unavailable, and a price may change before you act. You remain responsible for verifying every
        purchase directly with the merchant.
      </p>

      <h2>Acceptable use</h2>
      <p>You may not:</p>
      <ul>
        <li>Use RateCoaster for unlawful, fraudulent, deceptive, or abusive activity.</li>
        <li>Attempt to access another user&apos;s account or restricted administrative systems.</li>
        <li>Interfere with the site, bypass access controls, or introduce malicious code.</li>
        <li>Use automated requests at a volume that disrupts or unreasonably burdens the service.</li>
        <li>Copy, resell, or republish substantial portions of the service in a misleading manner.</li>
      </ul>

      <h2>Third-party services and links</h2>
      <p>
        RateCoaster may link to third-party booking, destination, identity, or informational services. We
        do not control their content, availability, prices, security, or policies. Your interactions with
        those services are between you and the applicable third party.
      </p>

      <h2>Advertising</h2>
      <p>
        RateCoaster may display third-party advertising to help keep the service free. Ads are
        labeled and are not recommendations or endorsements. Advertisers do not control the prices,
        comparisons, deal rankings, wait times, or planning results shown by RateCoaster. Your
        interaction with an advertisement is between you and the advertiser.
      </p>

      <h2>Intellectual property</h2>
      <p>
        RateCoaster&apos;s original software, design, branding, and written content are protected by applicable
        intellectual-property laws. Public facts, third-party trademarks, and source data remain subject to
        the rights and terms of their respective owners and providers.
      </p>

      <h2>Service changes and account termination</h2>
      <p>
        We may modify, suspend, or discontinue features and may restrict or terminate access when reasonably
        necessary to protect RateCoaster, its users, third parties, or legal compliance. You may stop using
        the service at any time and may request account deletion as described in the{" "}
        <a href="/privacy">Privacy Policy</a>.
      </p>

      <h2>Disclaimer of warranties</h2>
      <p>
        To the maximum extent permitted by law, RateCoaster is provided “as is” and “as available,” without
        warranties of any kind, express or implied. We do not warrant that the service will be uninterrupted,
        error-free, complete, or that displayed prices, availability, estimates, or alerts will be accurate.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, RateCoaster and its operators will not be liable for indirect,
        incidental, special, consequential, exemplary, or punitive damages, lost savings, lost profits, travel
        costs, or losses arising from reliance on displayed information, inability to access the service, or
        transactions with third parties.
      </p>

      <h2>Changes to these terms</h2>
      <p>
        We may update these terms as the service changes. The effective date above will be revised when an
        updated version is published. Continued use after an update means you accept the revised terms.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms may be sent to{" "}
        <a href="mailto:rcitnet@gmail.com">rcitnet@gmail.com</a>.
      </p>
    </main>
  );
}
