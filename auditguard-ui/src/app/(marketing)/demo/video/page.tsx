export const metadata = {
  title: 'Product Demo | AuditGuardX',
  description: 'Watch the 2-minute walkthrough covering voice mode, frameworks, and analytics.',
};

export default function DemoVideoPage() {
  return (
    <div className="space-y-12 pt-28">
      <section className="bg-white">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">Demo</p>
          <h1 className="mt-4 text-4xl font-bold text-gray-900 sm:text-5xl">See AuditGuardX in action</h1>
          <p className="mt-4 text-base text-gray-600">Voice Mode • Evidence Automation • Executive Dashboards</p>
        </div>
      </section>
      <section className="bg-gray-50">
        <div className="mx-auto max-w-5xl px-4 pb-24 sm:px-6 lg:px-8">
          <div className="aspect-video overflow-hidden rounded-3xl border border-gray-100 bg-black shadow-2xl">
            <iframe
              className="h-full w-full"
              src="https://www.youtube.com/embed/_9A2lXJcon8"
              title="AuditGuardX Demo"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
          <div className="mt-6 grid gap-6 rounded-3xl border border-gray-100 bg-white p-6 text-sm text-gray-600 md:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Duration</p>
              <p className="text-lg font-semibold text-gray-900">02:13</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Frameworks</p>
              <p>SOC 2, GDPR, HIPAA, ISO 27001</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Highlights</p>
              <p>Voice Mode, Cerebras latency, WorkOS SSO flow, Stripe billing</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
