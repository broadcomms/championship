export const metadata = {
  title: 'Security & Trust Center | AuditGuardX',
  description: 'Overview of our platform security, compliance controls, and infrastructure partners.',
};

const controls = [
  'SOC 2 Type II controls in place and audited annually',
  'WorkOS SSO, SCIM, and SAML for enterprise customers',
  'Stripe billing with PCI DSS Level 1 compliance',
  'Data residency options powered by Vultr services',
  'Cerebras inference for low-latency, encrypted AI workloads',
];

export default function SecurityPage() {
  return (
    <div className="space-y-12 pt-28">
      <section className="bg-white">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">Security</p>
          <h1 className="mt-4 text-4xl font-bold text-gray-900 sm:text-5xl">Trust center</h1>
          <p className="mt-4 text-base text-gray-600">
            Feel confident running audits on AuditGuardX. Our platform uses modern encryption, strict access controls, and
            layered monitoring.
          </p>
        </div>
      </section>
      <section className="bg-white">
        <div className="mx-auto max-w-5xl px-4 pb-24 sm:px-6 lg:px-8">
          <div className="rounded-3xl border border-gray-100 p-8 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">Controls</p>
            <ul className="mt-6 space-y-3 text-sm text-gray-600">
              {controls.map((control) => (
                <li key={control} className="flex gap-3">
                  <span className="text-blue-600">✓</span>
                  <span>{control}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
