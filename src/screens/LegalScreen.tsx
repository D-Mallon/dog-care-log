import { useState } from "react";
import { SUPPORT_EMAIL, SUPPORT_URL } from "../lib/support.ts";

export type LegalTab = "privacy" | "terms";

type LegalScreenProps = {
  initialTab?: LegalTab;
  onBack: () => void;
};

const TABS: { id: LegalTab; label: string }[] = [
  { id: "privacy", label: "Privacy" },
  { id: "terms", label: "Terms" },
];

const EFFECTIVE_DATE = "19 November 2026";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-lg font-bold font-fraunces text-warm-brown">
        {title}
      </h2>
      <div className="space-y-2 text-sm leading-relaxed text-text-dark">
        {children}
      </div>
    </section>
  );
}

function SupportLink() {
  return (
    <a
      href={SUPPORT_URL}
      className="font-semibold text-warm-brown underline underline-offset-2 hover:opacity-70"
    >
      {SUPPORT_EMAIL}
    </a>
  );
}

export default function LegalScreen({
  initialTab = "privacy",
  onBack,
}: LegalScreenProps) {
  const [tab, setTab] = useState<LegalTab>(initialTab);

  return (
    <div className="pt-4">
      <button
        type="button"
        onClick={onBack}
        className="mb-6 flex items-center gap-1.5 text-sm font-medium text-warm-brown transition-opacity hover:opacity-70"
      >
        ← Back
      </button>

      <div className="mb-6">
        <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-text-muted">
          the important bits
        </p>
        <h1 className="text-4xl font-bold font-fraunces text-warm-brown">
          Privacy & terms
        </h1>
        <p className="mt-2 text-xs text-text-muted">
          Effective {EFFECTIVE_DATE}. Written in plain language.
        </p>
      </div>

      <div
        role="tablist"
        aria-label="Legal documents"
        className="mb-6 flex gap-2"
      >
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
              tab === item.id
                ? "bg-warm-brown text-white"
                : "border border-warm-brown/20 text-warm-brown hover:bg-light-tan"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="rounded-3xl border border-warm-brown/10 bg-white p-6">
        {tab === "privacy" && (
          <div role="tabpanel" aria-label="Privacy policy">
            <Section title="Who we are">
              <p>
                Loggi is an independent app for households that share dog care.
                In this policy, “we” and “us” mean the team that operates
                Loggi. You can reach us at <SupportLink />.
              </p>
            </Section>

            <Section title="What we collect">
              <p>
                We collect the email address you sign up with, your household
                and dog profiles, the care events and weights you record, dog
                and profile photos, and the preferences you save.
              </p>
              <p>
                Payments are processed by Stripe. We receive confirmation of
                your plan and subscription status, but we do not see or store
                your full card details.
              </p>
            </Section>

            <Section title="How we use it">
              <p>
                We use your information to provide and sync the care log,
                authenticate you, manage subscriptions, respond to support
                requests, keep the service secure, and understand how the app
                is working so we can improve it.
              </p>
              <p>
                We do not sell your data, show advertising, or use your care
                records to train third-party advertising models.
              </p>
            </Section>

            <Section title="Our legal bases">
              <p>
                Depending on the activity, we rely on performance of our
                contract with you, our legitimate interests in running and
                improving a safe service, your consent where we ask for it,
                and legal obligations such as tax and accounting.
              </p>
            </Section>

            <Section title="Who we share it with">
              <p>
                We use service providers to run Loggi: Supabase for
                authentication, database and file storage; Vercel for hosting;
                Stripe for payments; and an email provider for transactional
                messages such as password resets. These providers process data
                on our instructions.
              </p>
              <p>
                We may also disclose information if required by law or to
                protect the rights, safety and security of our users.
              </p>
            </Section>

            <Section title="International transfers">
              <p>
                Some providers may process data outside the EEA. Where that
                happens, we rely on appropriate safeguards such as standard
                contractual clauses or an adequacy decision.
              </p>
            </Section>

            <Section title="How long we keep it">
              <p>
                We keep account and care data while your account is active. If
                you delete your account, we remove or anonymise your data,
                except where we need to keep limited records for legal,
                accounting or security reasons. Residual copies may remain in
                backups for a limited period before they are overwritten.
              </p>
            </Section>

            <Section title="Your rights">
              <p>
                You can ask for a copy of your data, correct it, export it,
                delete it, restrict or object to some processing, or withdraw
                consent where we rely on it. Email <SupportLink /> and we will
                respond within the time required by law.
              </p>
              <p>
                You can also complain to the Irish Data Protection Commission
                (dataprotection.ie) or your local supervisory authority.
              </p>
            </Section>

            <Section title="Cookies and local storage">
              <p>
                Loggi uses browser storage for your sign-in session and a
                local cache of recent care data so the app can open offline. We
                do not currently use advertising cookies or third-party
                analytics. If that changes, we will update this policy and ask
                for consent where required.
              </p>
            </Section>

            <Section title="Children">
              <p>
                Loggi is intended for adults managing a household. It is not
                directed at children under 16, and we do not knowingly collect
                their personal data.
              </p>
            </Section>

            <Section title="Changes to this policy">
              <p>
                We may update this policy as the app changes. The effective
                date at the top will change, and we will give notice in the app
                for material changes.
              </p>
            </Section>
          </div>
        )}

        {tab === "terms" && (
          <div role="tabpanel" aria-label="Terms of service">
            <Section title="The service">
              <p>
                Loggi helps a household record and share dog-care events such
                as feeding, walks, toilet breaks, medication and weight. It is
                a record-keeping and coordination tool, not veterinary advice.
                If you are worried about a dog’s health, contact a vet.
              </p>
            </Section>

            <Section title="Your account">
              <p>
                Keep your login secure and give accurate information. You are
                responsible for activity under your account and for the people
                you invite to your household. Do not share your invite code
                with anyone you do not trust.
              </p>
            </Section>

            <Section title="Households and shared data">
              <p>
                A household owner controls membership, billing and deletion.
                Members can see and add to the household’s shared care
                records. If you leave or are removed from a household, you
                lose access to its data, but records you added may remain in
                the household history.
              </p>
            </Section>

            <Section title="Subscriptions and trials">
              <p>
                Paid plans are billed through Stripe. New monthly and yearly
                subscriptions start with a 14-day free trial. After the trial,
                they renew automatically at the price shown at checkout until
                cancelled. The founding lifetime plan is a one-time payment for
                lifetime access, subject to fair use and service availability.
              </p>
              <p>
                Prices are shown in euro and include VAT where applicable. You
                can cancel from the billing portal; access continues until the
                end of the paid period unless the law requires otherwise.
              </p>
            </Section>

            <Section title="Cancellation, refunds and EU/EEA rights">
              <p>
                As a consumer, you generally have 14 days to withdraw from a
                digital subscription. If you ask us to start the service
                immediately, you may lose that right once the service has been
                fully provided. Email <SupportLink /> to
                exercise it.
              </p>
              <p>
                Founding lifetime purchases are refundable within 14 days if
                you have not made substantial use of the paid features. After
                that, refunds are at our discretion, except where required by
                law. Nothing in these terms limits your mandatory consumer
                rights.
              </p>
            </Section>

            <Section title="Acceptable use">
              <p>
                Do not use Loggi unlawfully, abuse other users, upload illegal
                or harmful content, scrape the service, or try to bypass
                access controls, paywalls or household permissions. We may
                suspend accounts that put other users or the service at risk.
              </p>
            </Section>

            <Section title="Availability and changes">
              <p>
                We work to keep Loggi available, but the service may be
                interrupted by maintenance, network problems or providers we
                rely on. We may add, change or remove features with reasonable
                notice. We will not remove paid access without a refund or
                alternative remedy where the law requires one.
              </p>
            </Section>

            <Section title="Liability">
              <p>
                Nothing in these terms excludes liability that cannot be
                excluded by law, including your mandatory consumer rights. To
                the extent permitted by law, we are not liable for indirect or
                consequential loss, or for decisions you make about a dog’s
                care or health. Always seek veterinary advice for medical
                concerns.
              </p>
            </Section>

            <Section title="Governing law">
              <p>
                These terms are governed by the laws of Ireland, and the Irish
                courts have non-exclusive jurisdiction. If you live elsewhere
                in the EU/EEA, you also keep the protection of the mandatory
                laws of your country of residence.
              </p>
            </Section>

            <Section title="Contact and changes">
              <p>
                Questions about these terms? Email <SupportLink />. We may
                update these terms as the service changes; the effective date
                above will change and we will give notice in the app for
                material changes.
              </p>
            </Section>
          </div>
        )}
      </div>
    </div>
  );
}
