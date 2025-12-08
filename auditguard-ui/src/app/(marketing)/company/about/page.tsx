export const metadata = {
  title: 'About | AuditGuardX',
  description: 'Discover the story, mission, and leadership team powering AuditGuardX compliance automation.',
};

const stats = [
  { value: '1K+', label: 'Enterprise Users', subtext: 'Modern teams in regulated industries' },
  { value: '10K+', label: 'Documents Managed', subtext: 'Continuously monitored for compliance' },
  { value: '99.9%', label: 'Platform Uptime', subtext: 'Trusted infrastructure and support' },
  { value: '78%', label: 'Faster Audits', subtext: 'Automation-first workflows' },
];

const values = [
  {
    title: 'Integrity',
    description:
      'We maintain the highest ethical standards in everything we do, ensuring transparency and honesty in all relationships.',
  },
  {
    title: 'Innovation',
    description: "We push the boundaries of what's possible in compliance technology, delivering cutting-edge solutions.",
  },
  {
    title: 'Collaboration',
    description: 'We partner closely with customers to achieve shared success across every audit and framework.',
  },
  {
    title: 'Excellence',
    description: 'We strive for excellence in our platform, services, and the experiences we create for customers.',
  },
];

const timeline = [
  {
    month: 'June',
    year: '2025',
    title: 'Foundation',
    description:
      'AuditGuardX launched a vision to revolutionize compliance and risk management through intelligent automation and enterprise architecture design.',
  },
  {
    month: 'December',
    year: '2025',
    title: 'Platform Release',
    description:
      'AuditGuardX released the preview of its core document compliance analysis platform, serving enterprise customers across high-regulation industries.',
  },
];

const leadership = [
  {
    name: 'Patrick Ejelle-Ndille',
    role: 'Founder & CEO',
    bio: 'Technology visionary with deep expertise in AI, machine learning, and enterprise platform architecture focused on information security and regulatory compliance automation.',
  },

];

export default function AboutPage() {
  return (
    <div className="bg-gray-50 pb-24 pt-28">
      <section className="mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">About Us</p>
        <h1 className="mt-4 text-4xl font-bold text-gray-900 sm:text-5xl">Automated compliance for the modern enterprise</h1>
        <p className="mt-4 text-lg text-gray-600">
          AuditGuardX is the enterprise compliance and audit management platform trusted by organizations worldwide to
          streamline regulatory processes and ensure continuous compliance.
        </p>
      </section>

      <section className="mx-auto mt-12 max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-white/60 bg-white/90 p-6 shadow-sm">
              <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
              <p className="mt-1 text-sm font-semibold uppercase tracking-wide text-blue-600">{stat.label}</p>
              <p className="mt-2 text-sm text-gray-500">{stat.subtext}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-16 grid max-w-6xl gap-8 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
        <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">Our Mission</p>
          <h2 className="mt-4 text-2xl font-bold text-gray-900">
            Empower organizations with intelligent compliance solutions that transform regulatory burden into competitive advantage.
          </h2>
          <p className="mt-4 text-sm text-gray-600">
            We help teams focus on growth while upholding the highest standards of governance and risk management.
          </p>
        </div>
        <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">Our Vision</p>
          <h2 className="mt-4 text-2xl font-bold text-gray-900">
            Become the global leader in compliance technology, seamlessly integrating regulatory requirements into daily operations.
          </h2>
          <p className="mt-4 text-sm text-gray-600">
            We imagine a world where innovation flourishes alongside transparency and accountability.
          </p>
        </div>
      </section>

      <section className="mx-auto mt-16 max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-white p-10 shadow-sm">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">Our Story</p>
            <p className="mt-4 text-base text-gray-600">
              AuditGuardX was founded in June 2025 by Patrick Ejelle-Ndille, a technology innovator and seasoned Information security professional with deep expertise in GRC and cybersecurity. 
              AuditGuardX emerged from firsthand experience, watching organizations struggle as traditional compliance evaluation methods failed to keep pace with the rapidly evolving complexities of the regulatory landscape.
            </p>
          </div>
          <div className="mt-10 space-y-6">
            {timeline.map((item) => (
              <div key={`${item.month}-${item.year}`} className="flex flex-col gap-4 rounded-2xl border border-gray-100 p-6 sm:flex-row sm:items-start">
                <div className="flex-shrink-0">
                  <div className="flex h-20 w-20 flex-col items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 shadow-lg shadow-blue-500/30">
                    <span className="text-xs font-semibold uppercase tracking-wider text-blue-100">
                      {item.month}
                    </span>
                    <span className="text-2xl font-bold text-white">
                      {item.year}
                    </span>
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-lg font-bold text-gray-900">{item.title}</p>
                  <p className="mt-2 text-sm leading-relaxed text-gray-600">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto mt-16 max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-gray-100 bg-white p-10 shadow-sm">
          <h2 className="text-center text-3xl font-bold text-gray-900">Leadership</h2>
          <p className="mt-3 text-center text-sm text-gray-600">
            Meet the expert driving innovation in compliance technology.
          </p>
          <div className="mt-10 grid gap-6 sm:grid-cols-1">
            {leadership.map((leader) => (
              <div key={leader.name} className="rounded-2xl border border-gray-100 p-6">
                <p className="text-lg font-semibold text-gray-900">{leader.name}</p>
                <p className="text-sm font-medium text-blue-600">{leader.role}</p>
                <p className="mt-3 text-sm text-gray-600">{leader.bio}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto mt-16 max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-white p-10 shadow-sm">
          <p className="text-center text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">Our Core Values</p>
          <p className="mt-2 text-center text-base text-gray-600">The principles that guide everything we do.</p>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {values.map((value) => (
              <div key={value.title} className="rounded-2xl border border-gray-100 p-6">
                <p className="text-lg font-semibold text-gray-900">{value.title}</p>
                <p className="mt-2 text-sm text-gray-600">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto mt-16 max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-gradient-to-br from-blue-600 via-blue-500 to-purple-500 p-10 text-center text-white shadow-xl">
          <h2 className="text-3xl font-bold">Join Our Mission</h2>
          <p className="mt-3 text-base text-white/90">
            Ready to transform your compliance processes? Partner with us to build a more efficient, transparent, and secure future.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <a
              href="/demo/video"
              className="rounded-full border border-white/30 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              See Platform Demo
            </a>
            <a
              href="/company/contact"
              className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-blue-600 transition hover:bg-blue-50"
            >
              Start Conversation
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
