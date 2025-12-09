export const metadata = {
  title: 'Privacy Policy | AuditGuardX',
  description: 'How AuditGuardX collects, uses, and stores personal data.',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="space-y-6 pt-28">
      <section className="bg-white">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">Privacy</p>
          <h1 className="mt-4 text-4xl font-bold text-gray-900">Privacy Policy</h1>
          <p className="mt-4 text-sm text-gray-600">
            Last updated: November 11, 2025. This living document summarizes how we process personal data across the AuditGuardX
            platform. For data processing agreements, email privacy@auditguardx.com.
          </p>
          <div className="mt-8 space-y-4 text-sm text-gray-600">
            <p>
              We collect account information (name, work email, company, billing details) to provide access to the platform. We
              process compliance documents solely to deliver the AuditGuardX service. Customer data is encrypted at rest and in
              transit, isolated per workspace, and removed within 30 days of contract termination.
            </p>
            <p>
              Subprocessors include Raindrop Platform, Vultr, Stripe, WorkOS, ElevenLabs, and Cerebras. Data transfers outside
              the EEA rely on Standard Contractual Clauses.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
