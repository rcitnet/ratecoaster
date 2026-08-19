import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — RateCoaster",
  description: "How RateCoaster collects, uses, stores, and protects personal information.",
};

export default function PrivacyPage() {
  return (
    <main className="section legal-page">
      <p className="eyebrow">Legal</p>
      <h1>Privacy Policy</h1>
      <p className="muted">Effective August 19, 2026</p>

      <p className="lede">
        RateCoaster helps travelers compare Universal hotel, admission, Express Pass, and attraction
        wait-time information. This policy explains what personal information we collect, why we use
        it, and the choices available to you.
      </p>

      <h2>Information we collect</h2>
      <h3>Information you provide</h3>
      <ul>
        <li>Your email address when you create an account or request a sign-in link.</li>
        <li>Trip dates, watched hotels, rate preferences, and alert settings you choose to save.</li>
        <li>Messages you send when contacting RateCoaster for support or a privacy request.</li>
      </ul>

      <h3>Google sign-in information</h3>
      <p>
        If you choose to sign in with Google, we receive the basic identity information you authorize
        Google to share. This may include your name, email address, email-verification status, and a
        stable Google account identifier.
      </p>
      <p>
        RateCoaster uses this information only to create or locate your account, verify your identity,
        prevent duplicate accounts, and keep you signed in. We do not request or access your Google
        contacts, Drive files, calendar, messages, photos, or other unrelated Google account data.
      </p>

      <h3>Information collected automatically</h3>
      <p>
        When you use the site, our servers may receive standard technical information such as your IP
        address, browser type, device type, requested pages, timestamps, referring page, and security
        or error logs. We also use an essential session cookie to keep signed-in users authenticated.
        RateCoaster does not currently use advertising cookies.
      </p>

      <h2>How we use information</h2>
      <ul>
        <li>Provide accounts, saved trips, extended pricing calendars, and requested alerts.</li>
        <li>Authenticate users and protect accounts from fraud, abuse, and unauthorized access.</li>
        <li>Operate, troubleshoot, secure, and improve RateCoaster.</li>
        <li>Send transactional messages, such as sign-in links and alerts you requested.</li>
        <li>Comply with legal obligations and enforce our terms.</li>
      </ul>

      <h2>How we share information</h2>
      <p>
        We do not sell or rent personal information or Google user data. We may share the minimum
        information necessary with service providers that help us host the site, operate the database,
        deliver email, monitor reliability, or provide authentication. These providers may process
        information only to perform services for RateCoaster and under appropriate confidentiality and
        security obligations.
      </p>
      <p>
        We may also disclose information when reasonably necessary to comply with law, protect users or
        the public, investigate abuse, enforce our agreements, or complete a merger, acquisition, or
        transfer of the service subject to appropriate notice and protections.
      </p>

      <h2>Google user data</h2>
      <p>
        RateCoaster&apos;s use and transfer of information received from Google APIs will adhere to the
        Google API Services User Data Policy, including its Limited Use requirements. Google identity
        data is used only for account authentication, security, and user-requested RateCoaster features.
      </p>

      <h2>Data retention</h2>
      <p>
        Account information and saved preferences are retained while your account remains active and as
        reasonably necessary to provide the service, resolve disputes, protect the service, and meet
        legal obligations. Authentication sessions expire, and security logs may be kept for a limited
        period appropriate to their purpose. We delete or de-identify information when it is no longer
        reasonably needed, subject to backups and legal requirements.
      </p>

      <h2>Your choices and deletion requests</h2>
      <p>
        You may stop alerts, sign out, or revoke Google access through your Google Account controls. You
        may request access to, correction of, or deletion of your RateCoaster account and associated
        personal information by emailing{" "}
        <a href="mailto:rcitnet@gmail.com">rcitnet@gmail.com</a>. We may need to verify your identity
        before completing a request. Revoking provider access does not itself delete your RateCoaster
        account, so contact us if you also want the account deleted.
      </p>

      <h2>Security</h2>
      <p>
        We use reasonable administrative, technical, and organizational safeguards designed to protect
        personal information. No internet service can guarantee absolute security, so please contact us
        if you believe your account or information has been compromised.
      </p>

      <h2>Children&apos;s privacy</h2>
      <p>
        RateCoaster is intended for trip planners and is not directed to children under 13. We do not
        knowingly collect personal information from children under 13. Contact us if you believe a child
        has provided personal information so we can investigate and delete it when appropriate.
      </p>

      <h2>Third-party websites</h2>
      <p>
        RateCoaster links to official booking sites and other third-party services. Their privacy
        practices are governed by their own policies, and this policy does not apply after you leave
        RateCoaster.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        We may update this policy as RateCoaster changes. The effective date above will be revised when
        material updates are published. If a change materially affects how we use personal information,
        we will provide additional notice when appropriate.
      </p>

      <h2>Contact</h2>
      <p>
        Questions or privacy requests may be sent to{" "}
        <a href="mailto:rcitnet@gmail.com">rcitnet@gmail.com</a>.
      </p>
    </main>
  );
}
