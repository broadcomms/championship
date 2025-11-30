export const metadata = {
  title: 'About | AuditGuardX',
  description: 'Learn about the mission, values, and team building the AuditGuardX compliance platform.',
};

const values = [
  { title: 'Ship compliance superpowers', description: 'Every launch removes toil from compliance, legal, and security teams.' },
  { title: 'Default to clarity', description: 'Complex frameworks deserve simple explanations and transparent roadmaps.' },
  { title: 'Bias for credibility', description: 'Pair measurable outcomes with trust signals, audits, and certifications.' },
];

const timeline = [
  { year: '2023', event: 'Prototype voice-first compliance assistant with ElevenLabs + Raindrop Smart Components.' },
  { year: '2024', event: 'Launch AuditGuardX v2 with WorkOS SSO, Stripe billing, and Vultr global infrastructure.' },
  { year: '2025', event: '3,000+ organizations onboarded, 20+ frameworks supported, Cerebras-powered inference.' },
];

export default function AboutPage() {
  return (
    <div className="space-y-16 pt-28">
      <section className="bg-white">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">Company</p>
          <h1 className="mt-4 text-4xl font-bold text-gray-900 sm:text-5xl">Compliance automation for ambitious teams</h1>
          <p className="mt-4 text-base text-gray-600">
            AuditGuardX unifies document intelligence, remediation workflows, and conversational AI so compliance leaders can
            move at the speed of product teams.
          </p>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 pb-12 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div className="rounded-3xl border border-gray-100 p-8 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">Mission</p>
            <p className="mt-4 text-2xl font-bold text-gray-900">Deliver enterprise-grade compliance at startup speed.</p>
            <p className="mt-4 text-sm text-gray-600">
              We integrate Raindrop Smart Components, Vultr services, WorkOS authentication, Stripe billing, and ElevenLabs
              voice to automate every audit milestone.
            </p>
          </div>
          <div className="rounded-3xl border border-gray-100 p-8 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">Team</p>
            <p className="mt-4 text-sm text-gray-600">
              Distributed across New York, Toronto, and Lisbon with alumni from top compliance consultancies, AI research labs,
              and YC-backed startups.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-gray-600">
              <li>• Compliance & Legal Ops</li>
              <li>• AI Research & Platform</li>
              <li>• Product, Brand, & Community</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="bg-gray-50">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">Values</p>
          <div className="mt-6 grid gap-6 md:grid-cols-3">
            {values.map((value) => (
              <div key={value.title} className="rounded-3xl border border-gray-100 bg-white p-8 shadow-sm">
                <p className="text-lg font-semibold text-gray-900">{value.title}</p>
                <p className="mt-3 text-sm text-gray-600">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">Timeline</p>
          <div className="mt-6 space-y-6">
            {timeline.map((item) => (
              <div key={item.year} className="flex flex-col gap-4 rounded-3xl border border-gray-100 p-6 shadow-sm sm:flex-row sm:items-center">
                <div className="text-3xl font-bold text-blue-600">{item.year}</div>
                <p className="text-sm text-gray-600">{item.event}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
