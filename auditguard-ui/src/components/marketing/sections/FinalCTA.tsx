import Link from 'next/link';

export function FinalCTA() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-blue-700 via-blue-600 to-purple-700">
      <div className="absolute inset-y-0 right-0 hidden w-1/2 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.2),_transparent)] lg:block" />
      <div className="relative mx-auto max-w-5xl px-4 py-24 text-center text-white sm:px-6 lg:px-8">
        <p className="text-sm font-semibold uppercase tracking-[0.4em] text-white/70">Ready?</p>
        <h2 className="mt-4 text-4xl font-bold sm:text-5xl">Transform your compliance workflow today</h2>
        <p className="mt-4 text-base text-white/80">
          Join 3,000+ organizations automating audits, frameworks, and remediation with AI.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
          <Link href="/register" className="rounded-full bg-white px-10 py-3 text-base font-semibold text-blue-700 shadow-xl">
            Start Free Trial
          </Link>
          <Link
            href="/company/contact"
            className="rounded-full border border-white/30 px-10 py-3 text-base font-semibold text-white"
          >
            Talk to Sales
          </Link>
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-6 text-xs text-white/60">
          <p>✓ 14-day Professional trial</p>
          <p>✓ Voice AI assistant included</p>
          <p>✓ WorkOS SSO & Stripe billing</p>
          <p>✓ Built on Raindrop Platform</p>
        </div>
      </div>
    </section>
  );
}
