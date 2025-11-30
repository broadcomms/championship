export const metadata = {
  title: 'API Overview | AuditGuardX',
  description: 'High-level overview of upcoming AuditGuardX API and webhook surface area.',
};

export default function ApiOverviewPage() {
  return (
    <div className="space-y-6 pt-28">
      <section className="bg-white">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">API</p>
          <h1 className="mt-4 text-4xl font-bold text-gray-900">AuditGuardX API</h1>
          <p className="mt-4 text-sm text-gray-600">
            REST + Webhook tooling is rolling out with programmatic access to documents, evidence, frameworks, and analytics. Join
            the waitlist inside the product to gain early access.
          </p>
          <div className="mt-8 grid gap-4 text-sm text-gray-600 md:grid-cols-2">
            <div className="rounded-3xl border border-gray-100 p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">REST endpoints</p>
              <ul className="mt-3 space-y-2">
                <li>• /v1/workspaces</li>
                <li>• /v1/documents</li>
                <li>• /v1/issues</li>
              </ul>
            </div>
            <div className="rounded-3xl border border-gray-100 p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Webhooks</p>
              <ul className="mt-3 space-y-2">
                <li>• Evidence processed</li>
                <li>• Issue assigned/resolved</li>
                <li>• Billing + usage events</li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
