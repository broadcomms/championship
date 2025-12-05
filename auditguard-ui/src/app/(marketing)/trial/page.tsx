import { buildMarketingMetadata } from '@/lib/seo';
import Link from 'next/link';
import { CheckCircle, ArrowRight, Clock, CreditCard, Zap } from 'lucide-react';

export const metadata = buildMarketingMetadata({
  title: 'Start Your Free Trial | AuditGuardX',
  description: 'Get started with AuditGuardX Professional plan free for 14 days. No credit card required. Full access to AI-powered compliance automation.',
  path: '/trial',
});

export default function TrialPage() {
  return (
    <div className="bg-gradient-to-b from-white to-gray-50">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-purple-700 py-20 sm:py-28">
        <div className="absolute inset-0 bg-[url('/images/grid.svg')] opacity-10"></div>
        <div className="relative mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm">
            <Zap className="h-4 w-4" />
            Start Your 14-Day Free Trial
          </div>
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
            Experience AI-Powered Compliance Automation
          </h1>
          <p className="mt-6 text-lg text-white/90 sm:text-xl">
            Get full access to AuditGuardX Professional for 14 days. No credit card required. 
            Cancel anytime. Start automating SOC 2, GDPR, HIPAA, and 17+ frameworks today.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/register"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-8 py-4 text-base font-semibold text-blue-600 shadow-lg transition hover:bg-gray-50 sm:w-auto"
            >
              Start Free Trial
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border-2 border-white/30 px-8 py-4 text-base font-semibold text-white backdrop-blur-sm transition hover:border-white/50 hover:bg-white/10 sm:w-auto"
            >
              View Pricing
            </Link>
          </div>
          <div className="mt-8 flex items-center justify-center gap-6 text-sm text-white/80">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              14-day trial
            </div>
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              No credit card
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Full features
            </div>
          </div>
        </div>
      </section>

      {/* What&apos;s Included Section */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">
              What&apos;s Included
            </p>
            <h2 className="mt-2 text-3xl font-bold text-gray-900 sm:text-4xl">
              Full access to Professional features
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Experience everything AuditGuardX has to offer during your trial period.
            </p>
          </div>

          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => (
              <div
                key={index}
                className="flex min-h-[380px] flex-col rounded-3xl border border-gray-200 bg-white p-8 shadow-sm transition hover:shadow-md"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
                  {feature.icon}
                </div>
                <h3 className="mt-6 text-xl font-semibold text-gray-900">{feature.title}</h3>
                <p className="mt-2 text-gray-600">{feature.description}</p>
                <ul className="mt-4 flex-1 space-y-2">
                  {feature.items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="bg-gray-50 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">
              Simple Process
            </p>
            <h2 className="mt-2 text-3xl font-bold text-gray-900 sm:text-4xl">
              Get started in 3 easy steps
            </h2>
          </div>

          <div className="mt-16 grid gap-8 md:grid-cols-3">
            {steps.map((step, index) => (
              <div key={index} className="relative">
                <div className="flex flex-col items-center text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-2xl font-bold text-white">
                    {index + 1}
                  </div>
                  <h3 className="mt-6 text-xl font-semibold text-gray-900">{step.title}</h3>
                  <p className="mt-2 text-gray-600">{step.description}</p>
                </div>
                {index < steps.length - 1 && (
                  <div className="absolute right-0 top-8 hidden w-full md:block">
                    <ArrowRight className="mx-auto h-8 w-8 text-gray-300" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof Section */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl bg-gradient-to-br from-blue-600 to-purple-700 p-12 text-center text-white">
            <h2 className="text-3xl font-bold sm:text-4xl">
              Join teams automating compliance worldwide
            </h2>
            <div className="mt-12 grid gap-8 sm:grid-cols-3">

            <div>
                <p className="text-5xl font-bold">20+</p>
                <p className="mt-2 text-white/80">International Frameworks</p>
              </div>
              <div>
                <p className="text-5xl font-bold">70%</p>
                <p className="mt-2 text-white/80">Cost Reduction</p>
              </div>

              <div>
                <p className="text-5xl font-bold">98%</p>
                <p className="mt-2 text-white/80">Accuracy</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">
              Questions
            </p>
            <h2 className="mt-2 text-3xl font-bold text-gray-900 sm:text-4xl">
              Frequently asked questions
            </h2>
          </div>

          <div className="mt-12 space-y-6">
            {faqs.map((faq, index) => (
              <div key={index} className="rounded-2xl border border-gray-200 bg-gray-50 p-6">
                <h3 className="text-lg font-semibold text-gray-900">{faq.question}</h3>
                <p className="mt-2 text-gray-600">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="bg-gradient-to-br from-blue-600 to-purple-700 py-16 sm:py-24">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">
            Ready to automate your compliance?
          </h2>
          <p className="mt-4 text-lg text-white/90">
            Start your 14-day free trial today. No credit card required.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/register"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-8 py-4 text-base font-semibold text-blue-600 shadow-lg transition hover:bg-gray-50 sm:w-auto"
            >
              Start Free Trial
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border-2 border-white/30 px-8 py-4 text-base font-semibold text-white backdrop-blur-sm transition hover:border-white/50 hover:bg-white/10 sm:w-auto"
            >
              Contact Sales
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

const features = [
  {
    icon: <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    title: 'AI Compliance Assistant',
    description: 'Voice-enabled AI assistant with hands-free mode',
    items: [
      'Natural language queries',
      'Voice commands & responses',
      'Real-time compliance analysis',
      '0.12s response latency'
    ]
  },
  {
    icon: <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
    title: 'Document Intelligence',
    description: 'Automated document processing & evidence mapping',
    items: [
      'Upload unlimited documents',
      'Automatic framework mapping',
      'Evidence gap detection',
      'Smart recommendations'
    ]
  },
  {
    icon: <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
    title: 'Multi-Framework Support',
    description: 'Support for 17+ compliance frameworks',
    items: [
      'SOC 2 Type I & II',
      'GDPR & HIPAA',
      'ISO 27001 & PCI DSS',
      'Custom frameworks'
    ]
  },
  {
    icon: <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
    title: 'Real-Time Analytics',
    description: 'Comprehensive compliance dashboards',
    items: [
      'Live compliance scores',
      'Risk heat maps',
      'Trend analysis',
      'Executive reports'
    ]
  },
  {
    icon: <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
    title: 'Team Collaboration',
    description: 'Built for compliance teams',
    items: [
      'Unlimited team members',
      'Role-based access control',
      'Shared workspaces',
      'Activity tracking'
    ]
  },
  {
    icon: <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
    title: 'Enterprise Security',
    description: 'Bank-grade security & compliance',
    items: [
      'WorkOS SSO integration',
      'SOC 2 Type II certified',
      '99.9% uptime SLA',
      'Encrypted data storage'
    ]
  }
];

const steps = [
  {
    title: 'Sign up for free',
    description: 'Create your account in under 60 seconds. No credit card required to start your trial.'
  },
  {
    title: 'Upload documents',
    description: 'Import your policies, procedures, and evidence. Our AI automatically maps them to frameworks.'
  },
  {
    title: 'Get insights',
    description: 'Receive instant compliance analysis, gap reports, and remediation recommendations.'
  }
];

const faqs = [
  {
    question: 'Do I need a credit card to start my trial?',
    answer: 'No, you can start your 14-day free trial without entering any payment information. We only ask for billing details when you decide to continue with a paid plan.'
  },
  {
    question: 'What happens after my trial ends?',
    answer: 'After 14 days, your trial automatically ends. You can choose to upgrade to a paid plan to continue using AuditGuardX. Your data will be preserved for 30 days if you decide to upgrade later.'
  },
  {
    question: 'Can I cancel my trial anytime?',
    answer: 'Yes, you can cancel your trial at any time with no obligations. Simply go to your account settings and cancel your trial.'
  },
  {
    question: 'Will I have access to all Professional features?',
    answer: 'Yes, during your trial you get full access to all Professional plan features including the AI assistant, unlimited document uploads, all frameworks, and team collaboration tools.'
  },
  {
    question: 'Can I upgrade to Enterprise during my trial?',
    answer: 'Absolutely! Contact our sales team anytime during your trial to discuss Enterprise plan features like custom frameworks, dedicated support, and volume discounts.'
  },
  {
    question: 'Is my data secure during the trial?',
    answer: 'Yes, trial accounts receive the same enterprise-grade security as paid accounts, including encrypted data storage, SOC 2 Type II compliance, and 99.9% uptime guarantee.'
  }
];
