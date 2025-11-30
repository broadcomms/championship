export const metadata = {
  title: 'GDPR Commitment | AuditGuardX',
  description: 'Details about our GDPR readiness, DPA, and data subject workflows.',
};

export default function GdprPage() {
  return (
    <div className="space-y-6 pt-28">
      <section className="bg-white">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">GDPR</p>
          <h1 className="mt-4 text-4xl font-bold text-gray-900">GDPR Commitment</h1>
          <p className="mt-4 text-sm text-gray-600">
            AuditGuardX is built for global privacy frameworks including GDPR, CCPA, and LGPD.
          </p>
          <div className="mt-8 space-y-4 text-sm text-gray-600">
            <p>
              We provide Data Processing Agreements, maintain Article 30 records, and support data subject access requests
              within 72 hours. Our platform logs every access and change to ensure accountability.
            </p>
            <p>
              Contact privacy@auditguardx.com to execute a DPA or request data residency in the EU (Vultr Amsterdam or Frankfurt).
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
