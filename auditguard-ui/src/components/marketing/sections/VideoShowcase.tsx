import Link from 'next/link';

export function VideoShowcase() {
  return (
    <section className="bg-gray-950">
      <div className="mx-auto max-w-5xl px-4 py-20 text-white sm:px-6 lg:px-8">
        <div className="space-y-6 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-300">
            See AuditGuardX in action
          </p>
          <h2 className="text-3xl font-bold sm:text-4xl">Watch how teams compress SOC 2 to 90 minutes</h2>
          <p className="text-base text-white/70">
            Live footage from the AuditGuardX assistant analyzing 600+ controls, generating remediation plans, and answering
            voice-mode questions in real time.
          </p>
        </div>
        <div className="mt-10 overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-2xl">
          <div className="aspect-video w-full bg-gradient-to-br from-blue-600 to-purple-600 p-8">
            <div className="flex h-full w-full flex-col justify-between rounded-2xl bg-black/30 p-6">
              <div className="flex items-center gap-3 text-sm text-white/80">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-lg font-semibold">▶</span>
                02:13 Demo Recording • Voice Mode, Evidence Mapping, Live Remediation
              </div>
              <div className="grid gap-4 text-sm text-white/80 lg:grid-cols-4">
                <div>
                  <p className="text-3xl font-bold text-white">90s</p>
                  <p>Average analysis time</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-white">1,000+</p>
                  <p>Documents processed per customer</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-white">20+</p>
                  <p>Frameworks mapped automatically</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-white">0.12s</p>
                  <p>Voice response latency</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-8 text-center">
          <Link
            href="/demo/video"
            className="inline-flex items-center justify-center rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white transition hover:border-white"
          >
            Watch the full demo →
          </Link>
        </div>
      </div>
    </section>
  );
}
