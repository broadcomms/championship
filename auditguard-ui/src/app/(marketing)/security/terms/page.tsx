export const metadata = {
  title: 'Terms of Service | AuditGuardX',
  description: 'Customer agreement outlining service access, billing, and acceptable use.',
};

export default function TermsPage() {
  return (
    <div className="space-y-6 pt-28">
      <section className="bg-white">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">Terms</p>
          <h1 className="mt-4 text-4xl font-bold text-gray-900">Terms of Service</h1>
          <p className="mt-4 text-sm text-gray-600">
            Standard agreement covering subscriptions, usage, and liability. Enterprise paper and custom MSAs available on
            request.
          </p>
          <div className="mt-8 space-y-4 text-sm text-gray-600">
            <p>
              By using AuditGuardX you agree to comply with all applicable regulations and keep login credentials secure. You
              retain ownership of uploaded content. AuditGuardX acts as a processor for customer data per GDPR Article 28.
            </p>
            <p>
              Billing is handled via Stripe. Subscriptions renew automatically each month/year until cancelled. Refunds are
              available within 30 days for annual subscriptions if the platform fails to meet contractual SLAs.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
