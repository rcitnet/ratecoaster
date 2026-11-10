import { CONTACT_EMAIL } from "@/lib/contact";
import { breadcrumbSchema, jsonLd, pageMetadata, SITE_NAME, SITE_URL } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Contact RateCoaster",
  description:
    "How to reach RateCoaster about a wrong price, a correction to a guide, your account, a privacy request, or advertising and partnerships.",
  path: "/contact",
});

function mailto(subject: string): string {
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`;
}

const TOPICS = [
  {
    title: "A price looks wrong",
    subject: "Price report",
    body:
      "Tell us the hotel or product, the date, the rate type and what you saw at the official checkout. A screenshot helps. Remember that rates here are per night before tax.",
  },
  {
    title: "A correction to a guide",
    subject: "Guide correction",
    body:
      "Send the guide's title, the sentence in question and, if you have one, a link to Universal's current wording. Guides are corrected and re-dated when a rule changes.",
  },
  {
    title: "Help with your account",
    subject: "Account help",
    body:
      "For sign-in links that do not arrive, watches and alerts. Write from the email address on the account.",
  },
  {
    title: "Privacy and deletion requests",
    subject: "Privacy request",
    body:
      "To see, correct or delete the information tied to your account. We may need to confirm that the request comes from the account holder.",
  },
  {
    title: "Advertising, partnerships and press",
    subject: "Business enquiry",
    body:
      "For advertising questions, data or partnership proposals, and media enquiries.",
  },
] as const;

export default function ContactPage() {
  const contactSchema = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    name: `Contact ${SITE_NAME}`,
    url: `${SITE_URL}/contact`,
    mainEntity: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
      email: CONTACT_EMAIL,
    },
  };

  return (
    <main className="section legal-page page-refresh">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(contactSchema) }} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Contact", path: "/contact" }])),
        }}
      />
      <p className="eyebrow">Contact</p>
      <h1>Contact RateCoaster</h1>

      <p className="lede">
        RateCoaster is a small independent site, and messages go to the person who runs it. Email
        is the way to reach us: <a href={mailto("RateCoaster")}><b>{CONTACT_EMAIL}</b></a>
      </p>

      <h2>What to write about</h2>
      <div className="grid grid-2 contact-topics">
        {TOPICS.map((topic) => (
          <div key={topic.title} className="card">
            <h3>{topic.title}</h3>
            <p className="muted">{topic.body}</p>
            <a className="refresh-text-link" href={mailto(topic.subject)}>Email about this →</a>
          </div>
        ))}
      </div>

      <h2>What we cannot help with</h2>
      <p>
        RateCoaster does not sell rooms or tickets and has no access to bookings. For a reservation,
        a refund, a ticket problem or anything else about a purchase, contact the company you
        booked with. For Universal Orlando hotel and ticket bookings that is Universal Orlando
        Resort guest services, and for bookings made through another seller it is that seller.
      </p>
      <p>
        RateCoaster is not affiliated with Universal Destinations &amp; Experiences, NBCUniversal or
        Loews Hotels and cannot pass messages to them.
      </p>

      <h2>Before you write</h2>
      <ul>
        <li>
          Why a price differs at checkout is answered in{" "}
          <a href="/guides/how-ratecoaster-compares-prices">How RateCoaster compares Universal prices</a>.
        </li>
        <li>Who runs the site and how it is funded is on the <a href="/about">About page</a>.</li>
        <li>How personal information is handled is in the <a href="/privacy">privacy policy</a>.</li>
      </ul>
    </main>
  );
}
