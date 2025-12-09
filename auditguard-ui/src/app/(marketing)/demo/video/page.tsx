import Link from 'next/link';
import { CheckCircle, Clock, Shield, Zap } from 'lucide-react';

export const metadata = {
  title: 'Product Demo | AuditGuardX',
  description: 'Watch how AuditGuardX transforms compliance workflows. From document upload to GDPR compliance in under 3 minutes with AI-powered analysis and voice mode.',
};

export default function DemoVideoPage() {
  return (
    <div className="space-y-0">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-600 to-purple-700 pt-20">
        <div className="mx-auto max-w-5xl px-4 py-16 text-center sm:px-6 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-white/90">Product Demo</p>
          <h1 className="mt-4 text-4xl font-bold text-white sm:text-5xl lg:text-6xl">
            From Upload to GDPR Compliance in Under 3 Minutes
          </h1>
          <p className="mt-6 text-lg text-white/90">
            Watch AuditGuardX analyze policy documents against 37 GDPR controls, identify compliance gaps,
            generate corrected documents, and answer questions via voice—all in real time.
          </p>
        </div>
      </section>

      {/* Video Section */}
      <section className="bg-gray-950">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-2xl">
            <div className="aspect-video w-full">
              <iframe
                className="h-full w-full"
                src="https://www.youtube.com/embed/SllNrBds3M4"
                title="AuditGuardX Full Demo - GDPR Compliance in 3 Minutes"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          </div>

          {/* Video Stats */}
          <div className="mt-12 grid gap-6 sm:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-white">
              <Clock className="mx-auto mb-3 h-8 w-8 text-blue-400" />
              <p className="text-3xl font-bold">60s</p>
              <p className="mt-1 text-sm text-white/70">Document processing time</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-white">
              <Shield className="mx-auto mb-3 h-8 w-8 text-blue-400" />
              <p className="text-3xl font-bold">37</p>
              <p className="mt-1 text-sm text-white/70">GDPR controls checked</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-white">
              <CheckCircle className="mx-auto mb-3 h-8 w-8 text-blue-400" />
              <p className="text-3xl font-bold">9</p>
              <p className="mt-1 text-sm text-white/70">Issues identified instantly</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-white">
              <Zap className="mx-auto mb-3 h-8 w-8 text-blue-400" />
              <p className="text-3xl font-bold">0.12s</p>
              <p className="mt-1 text-sm text-white/70">Voice response latency</p>
            </div>
          </div>
        </div>
      </section>

      {/* What You'll See Section */}
      <section className="bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">Demo Walkthrough</p>
            <h2 className="mt-2 text-3xl font-bold text-gray-900 sm:text-4xl">
              What you&apos;ll see in this demo
            </h2>
          </div>

          <div className="mt-16 grid gap-8 md:grid-cols-2">
            <div className="rounded-3xl border border-gray-200 bg-gray-50 p-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-2xl font-bold text-blue-600">
                1
              </div>
              <h3 className="mt-6 text-xl font-semibold text-gray-900">Workspace Creation & Document Upload</h3>
              <p className="mt-2 text-gray-600">
                Create a compliance workspace in seconds and upload policy documents. Watch as documents are instantly
                processed and stored securely in Vultr S3-Compatible Object Storage with encryption at rest.
              </p>
              <ul className="mt-4 space-y-2 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                  <span>Upload 3 company policy documents</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                  <span>Processing completes in under 60 seconds</span>
                </li>
              </ul>
            </div>

            <div className="rounded-3xl border border-gray-200 bg-gray-50 p-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-2xl font-bold text-blue-600">
                2
              </div>
              <h3 className="mt-6 text-xl font-semibold text-gray-900">GDPR Compliance Analysis</h3>
              <p className="mt-2 text-gray-600">
                Run a compliance check against GDPR framework. Raindrop SmartInference orchestrates AI agents for
                embedding generation, requirements mapping, and gap identification across all 37 GDPR controls.
              </p>
              <ul className="mt-4 space-y-2 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                  <span>15% compliance score revealed</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                  <span>9 critical issues identified</span>
                </li>
              </ul>
            </div>

            <div className="rounded-3xl border border-gray-200 bg-gray-50 p-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-2xl font-bold text-blue-600">
                3
              </div>
              <h3 className="mt-6 text-xl font-semibold text-gray-900">Issue Deep Dive & Remediation</h3>
              <p className="mt-2 text-gray-600">
                Examine the most critical issue: &quot;Lack of formally appointed Data Protection Officer.&quot;
                See exactly which GDPR article is violated, view impact assessments, and get actionable remediation steps.
              </p>
              <ul className="mt-4 space-y-2 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                  <span>Article 37 violation highlighted</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                  <span>Specific remediation steps provided</span>
                </li>
              </ul>
            </div>

            <div className="rounded-3xl border border-gray-200 bg-gray-50 p-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-2xl font-bold text-blue-600">
                4
              </div>
              <h3 className="mt-6 text-xl font-semibold text-gray-900">Voice Mode Interaction</h3>
              <p className="mt-2 text-gray-600">
                Experience hands-free Voice Mode powered by ElevenLabs. Ask natural language questions about compliance
                requirements and receive instant, contextual answers with Raindrop SmartMemory.
              </p>
              <ul className="mt-4 space-y-2 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                  <span>Natural conversational AI assistant</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                  <span>Context-aware responses with 0.12s latency</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Technology Stack Section */}
      <section className="bg-gray-50 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">Powered By</p>
            <h2 className="mt-2 text-3xl font-bold text-gray-900 sm:text-4xl">
              Enterprise-grade technology stack
            </h2>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-6">
              <h3 className="font-semibold text-gray-900">Raindrop SmartInference</h3>
              <p className="mt-2 text-sm text-gray-600">
                Multi-agent AI orchestration for compliance analysis
              </p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-6">
              <h3 className="font-semibold text-gray-900">Cerebras Ultra-Low-Latency AI</h3>
              <p className="mt-2 text-sm text-gray-600">
                Document generation with blazing fast performance
              </p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-6">
              <h3 className="font-semibold text-gray-900">ElevenLabs Voice</h3>
              <p className="mt-2 text-sm text-gray-600">
                Natural conversational AI for hands-free compliance queries
              </p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-6">
              <h3 className="font-semibold text-gray-900">Vultr Infrastructure</h3>
              <p className="mt-2 text-sm text-gray-600">
                S3-compatible object storage with encryption at rest
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-br from-blue-600 to-purple-700 py-16 sm:py-24">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">
            Ready to transform your compliance workflow?
          </h2>
          <p className="mt-4 text-lg text-white/90">
            Start your 14-day free trial today. No credit card required.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/trial"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-8 py-4 text-base font-semibold text-blue-600 shadow-lg transition hover:bg-gray-50 sm:w-auto"
            >
              Start Free Trial
            </Link>
            <Link
              href="/pricing"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border-2 border-white/30 px-8 py-4 text-base font-semibold text-white backdrop-blur-sm transition hover:border-white/50 hover:bg-white/10 sm:w-auto"
            >
              View Pricing
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
