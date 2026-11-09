import { useState } from "react";

type LegalTab = "privacy" | "terms" | "refunds";

type LegalScreenProps = {
  initialTab?: LegalTab;
  onBack: () => void;
};

const TABS: { id: LegalTab; label: string }[] = [
  { id: "privacy", label: "Privacy" },
  { id: "terms", label: "Terms" },
  { id: "refunds", label: "Refunds" },
];

const EFFECTIVE_DATE = "8 November 2026";
const COMPANY = "[COMPANY NAME]";
const CONTACT_EMAIL = "[CONTACT EMAIL]";
const ADDRESS = "[REGISTERED ADDRESS]";

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
          Legal
        </h1>
        <p className="mt-2 text-xs text-text-muted">
          Effective {EFFECTIVE_DATE}. These are plain-language templates and
          should be reviewed by a qualified adviser before launch.
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
          <div role="tabpanel">
            <Section title="Who we are">
              <p>
                Loggi is operated by {COMPANY}, {ADDRESS}. You can contact us at{" "}
                {CONTACT_EMAIL}.
              </p>
            </Section>
            <Section title="What we collect">
              <p>
                Account email, household and dog details you enter, care events,
                weight logs, and billing information processed by Stripe. We do
                not sell your data or show advertising.
              </p>
            </Section>
            <Section title="Why we process it">
              <p>
                To provide the care log, sync it with your household, process
                subscriptions, provide support, and keep the service secure.
                Our legal bases are contract, legitimate interests and, where
                required, consent.
              </p>
            </Section>
            <Section title="Processors and transfers">
              <p>
                We use Supabase for authentication, database and storage, Vercel
                for hosting, Stripe for payments, and monitoring providers for
                errors. Where data leaves the EEA, we rely on appropriate
                safeguards such as standard contractual clauses.
              </p>
            </Section>
            <Section title="Retention and your rights">
              <p>
                We keep account data while your account is active and for a
                reasonable period afterwards for legal and accounting purposes.
                You can request access, correction, export or deletion at{" "}
                {CONTACT_EMAIL}. You may also complain to the Irish Data
                Protection Commission or your local supervisory authority.
              </p>
            </Section>
          </div>
        )}

        {tab === "terms" && (
          <div role="tabpanel">
            <Section title="The service">
              <p>
                Loggi helps a household record and share dog-care events. It is
                not veterinary advice. Always contact a vet for medical
                concerns.
              </p>
            </Section>
            <Section title="Your account">
              <p>
                Keep your login secure and only invite people you trust. You are
                responsible for activity under your account and for the accuracy
                of the information you enter.
              </p>
            </Section>
            <Section title="Subscriptions">
              <p>
                Paid plans are billed through Stripe. Monthly and yearly plans
                renew automatically until cancelled. The founding lifetime plan
                is a one-time payment for access to the Release 1 feature set and
                future household features, subject to fair use and service
                availability.
              </p>
            </Section>
            <Section title="Cancellation and changes">
              <p>
                You can cancel from the billing portal. Access continues until
                the end of the paid period. We may change or discontinue features
                with reasonable notice and will not remove paid access without a
                refund or alternative remedy where required by law.
              </p>
            </Section>
            <Section title="Liability and governing law">
              <p>
                Nothing in these terms limits rights you have under mandatory
                consumer law. These terms are governed by the laws of Ireland,
                and Irish courts have non-exclusive jurisdiction.
              </p>
            </Section>
          </div>
        )}

        {tab === "refunds" && (
          <div role="tabpanel">
            <Section title="14-day trial">
              <p>
                New subscriptions start with a 14-day free trial. You will not be
                charged if you cancel before the trial ends.
              </p>
            </Section>
            <Section title="EU/EEA cancellation rights">
              <p>
                As a consumer, you generally have 14 days to withdraw from a
                digital subscription. If you ask us to start the service
                immediately, you may lose that right once the service has been
                fully provided. Contact {CONTACT_EMAIL} to exercise it.
              </p>
            </Section>
            <Section title="Lifetime purchases">
              <p>
                Founding lifetime purchases are refundable within 14 days if you
                have not made substantial use of the paid features. After that,
                refunds are at our discretion, except where required by law.
              </p>
            </Section>
            <Section title="How to request a refund">
              <p>
                Email {CONTACT_EMAIL} with your account email and Stripe receipt.
                We aim to respond within five working days.
              </p>
            </Section>
          </div>
        )}
      </div>
    </div>
  );
}
