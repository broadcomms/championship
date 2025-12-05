import Link from 'next/link';

export function VideoShowcase() {
  return (
    <section className="bg-gray-950">
      <div className="mx-auto max-w-5xl px-4 py-20 text-white sm:px-6 lg:px-8">
        <div className="space-y-6 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-300">
            See AuditGuardX in action
          </p>
          <h2 className="text-3xl font-bold sm:text-4xl">From Upload to GDPR Compliance in Under 3 Minutes</h2>
          <p className="text-base text-white/70">
             Watch AuditGuardX analyze policy documents against 37 GDPR controls, identify 
            compliance gaps, generate corrected documents, and answer questions via 
            voice—all in real time.
          </p>
        </div>
        <div className="mt-10 overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-2xl">
          <div className="aspect-video w-full">
            <iframe
              width="100%"
              height="100%"
              src="https://www.youtube.com/embed/T2caZzwCNrM"
              title="AuditGuardX Demo"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="h-full w-full"
            ></iframe>
          </div>
        </div>
        <div className="mt-12 grid gap-6 text-center sm:grid-cols-4">
          <div>
            <p className="text-3xl font-bold text-white">30s</p>
            <p className="text-sm text-white/70">Document processing time</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-white">39</p>
            <p className="text-sm text-white/70">GDPR controls checks</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-white">9</p>
            <p className="text-sm text-white/70">Issues instantly identified</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-white">20+</p>
            <p className="text-sm text-white/70">Compliance frameworks supported</p>
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
