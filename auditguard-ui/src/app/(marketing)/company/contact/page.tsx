import { contactChannels } from '@/config/marketing';
import { ContactForm } from '@/components/marketing/forms/ContactForm';

export const metadata = {
  title: 'Contact | AuditGuardX',
  description: 'Connect with sales, support, and partnerships.',
};

export default function ContactPage() {
  return (
    <div className="space-y-16 pt-28">
      <section className="bg-white">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">Contact</p>
          <h1 className="mt-4 text-4xl font-bold text-gray-900 sm:text-5xl">Talk to the AuditGuardX team</h1>
          <p className="mt-4 text-base text-gray-600">We reply within one business day. Enterprise onboarding slots open weekly.</p>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 pb-24 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div className="rounded-3xl border border-gray-100 bg-gray-50/70 p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">Teams</p>
            <div className="mt-6 space-y-4">
              {contactChannels.map((channel) => (
                <div key={channel.label}>
                  <p className="text-sm font-semibold text-gray-900">{channel.label}</p>
                  <p className="text-base text-blue-600">{channel.value}</p>
                  <p className="text-sm text-gray-500">{channel.subtext}</p>
                </div>
              ))}
            </div>
            <div className="mt-8 rounded-2xl border border-gray-100 bg-white p-4 text-sm text-gray-600">
              <p>Headquarters: New York City • Remote: Toronto, Lisbon, Singapore</p>
              <p>Support hours: 24/7 for Business + Enterprise</p>
            </div>
          </div>
          <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-xl">
            <ContactForm />
          </div>
        </div>
      </section>
    </div>
  );
}
