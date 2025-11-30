import { faqEntries } from '@/config/marketing';

export function FAQAccordion() {
  return (
    <div className="divide-y divide-gray-200 rounded-3xl border border-gray-100 bg-white">
      {faqEntries.map((faq) => (
        <details key={faq.question} className="group">
          <summary className="flex cursor-pointer items-center justify-between px-6 py-5 text-left text-sm font-semibold text-gray-900">
            {faq.question}
            <span className="text-gray-400 transition group-open:rotate-45">+</span>
          </summary>
          <div className="px-6 pb-6 text-sm text-gray-600">{faq.answer}</div>
        </details>
      ))}
    </div>
  );
}
