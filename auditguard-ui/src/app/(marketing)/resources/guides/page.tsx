import { guideDownloads } from '@/config/marketing';
import { ContactForm } from '@/components/marketing/forms/ContactForm';
import { buildMarketingMetadata } from '@/lib/seo';

export const metadata = buildMarketingMetadata({
  title: 'Guides & Templates | AuditGuardX',
  description: 'Download SOC 2, GDPR, and HIPAA guides curated by the AuditGuardX team.',
  path: '/resources/guides',
});

export default function GuidesPage() {
  return (
    <div className="space-y-12 pt-28">
      <section className="bg-white">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">Resources</p>
          <h1 className="mt-4 text-4xl font-bold text-gray-900 sm:text-5xl">Guides, checklists, and templates</h1>
          <p className="mt-4 text-base text-gray-600">Download the same assets we use to onboard customers every day.</p>
        </div>
      </section>
      <section className="bg-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 pb-16 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div className="space-y-4">
            {guideDownloads.map((guide) => (
              <div key={guide.title} className="rounded-3xl border border-gray-100 p-8 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-600">Guide</p>
                <h2 className="mt-3 text-2xl font-semibold text-gray-900">{guide.title}</h2>
                <p className="mt-2 text-sm text-gray-600">{guide.description}</p>
              </div>
            ))}
          </div>
          <div className="rounded-3xl border border-gray-100 bg-gray-50/70 p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">Request a guide</p>
            <p className="mt-3 text-sm text-gray-600">Tell us what you’re planning and we’ll email the bundle.</p>
            <div className="mt-6 rounded-2xl bg-white p-4 shadow-xl">
              <ContactForm />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
