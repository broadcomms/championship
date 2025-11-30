export const heroContent = {
  eyebrow: 'AI-Powered Compliance Automation',
  heading: 'Enterprise-Grade Compliance at Startup-Friendly Prices',
  description:
    'Reduce compliance costs by 70% and compress audit timelines from weeks to hours. Automate SOC 2, GDPR, HIPAA, and 17+ more frameworks with AI-powered document intelligence.',
  primaryCta: { label: 'Start Free Trial', href: '/register' },
  secondaryCta: { label: 'Watch Demo (2 min)', href: '/demo/video' },
  trustBadge: '14-day Professional trial • No credit card required',
};

export const customerLogos = [
  { name: 'Raindrop Platform', logo: '/images/logos/logo-raindrop.svg', tagline: 'Smart Components • MCP' },
  { name: 'Cerebras Labs', logo: '/images/logos/logo-cerebras.svg', tagline: 'Ultra-low latency AI' },
  { name: 'ElevenLabs Health', logo: '/images/logos/logo-elevenlabs.svg', tagline: 'Voice AI partner' },
  { name: 'Northwind Financial', logo: '/images/logos/logo-northwind.svg', tagline: 'FinTech security' },
  { name: 'Acme BioTech', logo: '/images/logos/logo-acme.svg', tagline: 'Healthcare data trust' },
  { name: 'Atlas Legal', logo: '/images/logos/logo-atlas.svg', tagline: 'Global privacy ops' },
];

export const valueProps = [
  {
    title: '70% Cost Reduction',
    description:
      'Replace $50K+/year legacy compliance tools with plans that start at $49/month. Zero consultants required.',
    linkLabel: 'See pricing →',
    href: '/pricing',
    icon: 'PiggyBank',
  },
  {
    title: '90% Faster Audits',
    description:
      'Analyze 100-page policies in 90 seconds with ultra-low latency AI (〈200ms) powered by Cerebras.',
    linkLabel: 'View platform speed →',
    href: '/features',
    icon: 'Zap',
  },
  {
    title: '98% Accuracy',
    description:
      'AI-powered analysis with evidence citations, explainability, and coverage for 20+ frameworks.',
    linkLabel: 'Explore frameworks →',
    href: '/solutions/enterprise',
    icon: 'Target',
  },
];

export const stats = [
  { value: '3,000+', label: 'Organizations automated', description: 'Startups, scaleups, and enterprises', icon: 'Users' },
  { value: '20+', label: 'Frameworks supported', description: 'SOC 2, GDPR, HIPAA, ISO 27001, more', icon: 'ShieldCheck' },
  { value: '70%', label: 'Average cost savings', description: 'Vs. consultants and legacy tools', icon: 'Coins' },
  { value: '<2.5s', label: 'Largest content LCP', description: 'Performance tuned for conversions', icon: 'Timer' },
];

export const featureHighlights = [
  {
    title: 'Intelligent Document Analysis',
    description:
      'Upload any policy, procedure, or control evidence and let AI map it to every applicable requirement instantly.',
    bullets: [
      'PDF, Word, spreadsheet, and image OCR support',
      'Semantic chunking preserves context',
      'Confidence scoring with evidence citations',
    ],
  },
  {
    title: '20+ Frameworks in One Platform',
    description:
      'Switch between SOC 2, GDPR, HIPAA, ISO 27001, NIST CSF, PCI-DSS, and more without juggling tools.',
    bullets: [
      'Financial, privacy, and security coverage',
      'Pre-built mapping templates',
      'Automatic gap analysis by framework',
    ],
  },
  {
    title: 'Voice-First Compliance Assistant',
    description:
      'Ask questions hands-free and get ElevenLabs-powered explanations tuned for policy, security, and legal teams.',
    bullets: [
      'Push-to-talk or hands-free modes',
      'Responds in 50-200ms with Cerebras',
      'Understands full document context',
    ],
  },
  {
    title: 'Issue Management & Collaboration',
    description:
      'Assign owners, track remediation, and keep auditors aligned with shared workspaces and notifications.',
    bullets: [
      'Kanban boards with SLA tracking',
      'Comment threads and @mentions',
      'Automated reminders for blockers',
    ],
  },
  {
    title: 'Executive Reporting & Dashboards',
    description:
      'Share real-time compliance scorecards with leadership and export board-ready reports in one click.',
    bullets: [
      'Risk heatmaps and remediation trends',
      'SOC 2 & HIPAA-ready PDF exports',
      'API access for BI tooling',
    ],
  },
  {
    title: 'Enterprise-Grade Security',
    description:
      'WorkOS SSO, Stripe billing, audit trails, and secure Vultr infrastructure keep data safe and compliant.',
    bullets: [
      'SOC 2 Type II controls',
      'Role-based access controls',
      'Encryption in transit and at rest',
    ],
  },
];

export const testimonialContent = [
  {
    quote:
      'We replaced a $45K consultant with AuditGuardX and finished SOC 2 readiness in 10 weeks. The AI assistant is on-call 24/7.',
    author: 'Sarah Chen',
    title: 'Director of Compliance, TechFlow',
  },
  {
    quote:
      'Voice Mode lets our legal team review GDPR controls while multitasking. 40 hours per month saved instantly.',
    author: 'Jennifer Park',
    title: 'General Counsel, CloudBridge Software',
  },
  {
    quote:
      'AuditGuardX mapped 600+ policies to HIPAA in under two hours. The ROI calculator was spot-on for the board.',
    author: 'Michael Rodriguez',
    title: 'CEO, DataSync Health',
  },
];

export const pricingPlans = [
  {
    name: 'Starter',
    price: 49,
    description: 'Perfect for solo compliance leads and seed-stage startups.',
    includes: ['50 documents', '100 AI checks / month', 'Email support'],
    highlight: 'Get started →',
  },
  {
    name: 'Professional',
    price: 149,
    description: 'Most popular plan for growing teams that need coverage across frameworks.',
    includes: ['1,000 documents', '1,000 AI checks / month', 'Voice mode + automation'],
    badge: 'Most Popular',
    highlight: 'Start trial →',
  },
  {
    name: 'Business',
    price: 399,
    description: 'Established organizations with dedicated security and legal functions.',
    includes: ['5,000 documents', '10,000 AI checks / month', 'Priority support + SSO'],
    highlight: 'Talk to sales →',
  },
];

export const comparisonTable = [
  {
    label: 'Monthly price',
    values: {
      auditguardx: '$149',
      vanta: '$2,500+',
      drata: '$3,000+',
      consultants: '$15K-$50K/engagement',
    },
  },
  {
    label: 'Framework coverage',
    values: {
      auditguardx: '20+',
      vanta: '3-5',
      drata: '5-6',
      consultants: 'Limited, expensive add-ons',
    },
  },
  {
    label: 'Voice AI assistant',
    values: {
      auditguardx: 'Included',
      vanta: 'Not available',
      drata: 'Not available',
      consultants: 'Not available',
    },
  },
  {
    label: 'Time to first audit',
    values: {
      auditguardx: 'Hours',
      vanta: 'Weeks',
      drata: 'Weeks',
      consultants: 'Months',
    },
  },
];

export const roiDefaults = {
  manualHours: 120,
  hourlyRate: 150,
  frameworks: 3,
  auditsPerYear: 4,
};

export const faqEntries = [
  {
    question: 'Can I change plans later?',
    answer: 'Yes. Upgrade, downgrade, or cancel anytime. Changes take effect immediately and are prorated.',
  },
  {
    question: 'Do you offer a free trial?',
    answer: 'Every paid plan includes a 14-day Professional trial with no credit card required.',
  },
  {
    question: 'How secure is AuditGuardX?',
    answer: 'We run on Raindrop Platform with WorkOS SSO, Stripe billing, Vultr infrastructure, and enterprise-grade encryption.',
  },
  {
    question: 'Do you support consultants and partners?',
    answer: 'Yes. Partner dashboards and revenue sharing are available for MSPs and compliance firms.',
  },
];

export const frameworksCatalog = [
  {
    name: 'SOC 2 Type II',
    coverage: 'Security • Availability • Confidentiality',
    industries: ['SaaS', 'FinTech'],
    automation: 'Policy generation, evidence reminders, auditor exports',
  },
  {
    name: 'HIPAA / HITECH',
    coverage: 'Privacy • Security • Breach notification',
    industries: ['Healthcare', 'Life Sciences'],
    automation: 'BAA templates, PHI redaction, incident logs',
  },
  {
    name: 'GDPR + UK GDPR',
    coverage: 'Article mapping • RoPA • DPIA',
    industries: ['Global SaaS', 'E-commerce'],
    automation: 'Data map sync, subject request workflows',
  },
  {
    name: 'PCI-DSS',
    coverage: 'Network • Access • Monitoring',
    industries: ['FinTech', 'Payments'],
    automation: 'Control monitoring, gateway evidence collectors',
  },
  {
    name: 'ISO 27001',
    coverage: 'Annex A controls',
    industries: ['Enterprise', 'Government'],
    automation: 'Risk register sync, control health scoring',
  },
];

type SolutionEntry = {
  title: string;
  subtitle: string;
  pains: string[];
  outcomes: string[];
  testimonial: (typeof testimonialContent)[number];
  slug: string;
  category: 'startups' | 'enterprise' | 'industries';
};

export const solutionsContent: Record<string, SolutionEntry> = {
  startups: {
    title: 'Launch SOC 2 readiness before Series A',
    subtitle: 'Ship enterprise security faster than the diligence process.',
    pains: [
      'Investors expect SOC 2 before wiring money.',
      'Consultants cost more than your compliance budget.',
      'Founders and ops teams are stretched thin.',
    ],
    outcomes: [
      'Automated gap analysis and policy templates.',
      'Guided remediation with AI-generated tasks.',
      'Board-ready progress dashboards.',
    ],
    testimonial: testimonialContent[1],
    slug: 'solutions/startups',
    category: 'startups',
  },
  enterprise: {
    title: 'Global compliance for complex teams',
    subtitle: 'Map thousands of controls across every jurisdiction in one workspace.',
    pains: [
      'Multiple frameworks and subsidiaries to maintain.',
      'Fragmented tooling across risk, legal, and security.',
      'Limited visibility for executives and auditors.',
    ],
    outcomes: [
      'Multi-workspace governance with RBAC.',
      'Advanced analytics and executive reporting.',
      'Voice-mode assistant for every control owner.',
    ],
    testimonial: testimonialContent[0],
    slug: 'solutions/enterprise',
    category: 'enterprise',
  },
  healthcare: {
    title: 'HIPAA & HITECH compliance without consultants',
    subtitle: 'Protect PHI and document safeguards with AI-powered workflows.',
    pains: [
      'Clinical teams need plain-language guidance.',
      'Manual risk assessments slow down care delivery.',
      'Auditors expect evidence trails for every safeguard.',
    ],
    outcomes: [
      'Healthcare-ready templates and BAAs.',
      'Automated incident documentation.',
      'Live dashboards for privacy officers.',
    ],
    testimonial: testimonialContent[2],
    slug: 'solutions/industries/healthcare',
    category: 'industries',
  },
  fintech: {
    title: 'PCI-DSS and SOC 2 for FinTech scale-ups',
    subtitle: 'Deliver bank-grade trust with one intelligent compliance stack.',
    pains: [
      'Payment partners require quarterly evidence.',
      'Security teams battle ticket backlogs.',
      'Legacy auditors slow down releases.',
    ],
    outcomes: [
      'Continuous monitoring for critical controls.',
      'API integrations with issue trackers.',
      'Executive-ready issue burndown charts.',
    ],
    testimonial: testimonialContent[0],
    slug: 'solutions/industries/fintech',
    category: 'industries',
  },
} satisfies Record<string, SolutionEntry>;

export const blogPosts = [
  {
    slug: 'compliance-automation-playbook-2025',
    title: 'Compliance Automation Playbook for 2025',
    category: 'Guides',
    readingTime: '8 min read',
    excerpt: 'A practical roadmap for rolling out AI across audit prep, evidence requests, and remediation.',
    author: 'Patrick Summers',
    publishedAt: '2025-10-03',
    heroImage: '/images/marketing/blog-playbook.svg',
    content: `## Modern compliance runs on AI

Legacy audits were written for clipboards and conference rooms. The 2025 playbook focuses on:

1. **Centralizing evidence** inside collaborative workspaces
2. **Automating gap analysis** with explainable AI
3. **Giving executives telemetry** that mirrors product dashboards

Teams that pilot automation across just one audit cycle reclaim 400+ hours and cut external spend by 60%.`,
  },
  {
    slug: 'voice-ai-in-regulated-industries',
    title: 'Voice AI in Regulated Industries',
    category: 'Product',
    readingTime: '6 min read',
    excerpt: 'Why ElevenLabs + AuditGuardX is the first hands-free compliance assistant.',
    author: 'Maya Thompson',
    publishedAt: '2025-09-18',
    heroImage: '/images/marketing/blog-voice.svg',
    content: `## Hands-free coordination

Voice mode sits on top of Raindrop Smart Components and Cerebras inference so risk, legal, and engineering teams can:

* Ask "What HIPAA controls are blocked?" and get an answer with citations
* Record approvals while commuting, complete with transcript and audit trail
* Trigger remediation workflows using natural language

The result: policy reviews move 3x faster without sacrificing traceability.`,
  },
  {
    slug: 'framework-mapping-templates',
    title: 'Framework Mapping Templates',
    category: 'Templates',
    readingTime: '5 min read',
    excerpt: 'Download ready-to-use SOC 2, GDPR, and HIPAA templates to speed up control mapping.',
    author: 'Derek Patel',
    publishedAt: '2025-08-11',
    heroImage: '/images/marketing/blog-frameworks.svg',
    content: `## Eliminate blank-page syndrome

AuditGuardX ships mapping templates for 20+ frameworks. Each template includes:

- Control intent and auditor notes
- Sample evidence artifacts
- Automation triggers for notifications and Jira issues

Teams can remix these templates or import their own spreadsheets in a few clicks.`,
  },
];

export const guideDownloads = [
  {
    title: 'SOC 2 Fast-Track Kit',
    description: 'Everything you need to prep for SOC 2 in 10 weeks.',
  },
  {
    title: 'GDPR for SaaS Founders',
    description: 'A practical walkthrough with copy-paste policies.',
  },
  {
    title: 'HIPAA Evidence Checklist',
    description: '50+ safeguards you can implement this quarter.',
  },
];

export const contactChannels = [
  {
    label: 'Sales',
    value: 'sales@auditguardx.com',
    subtext: 'Enterprise pilots, procurement, compliance reviews',
  },
  {
    label: 'Support',
    value: 'support@auditguardx.com',
    subtext: 'Response within 24 hours, 7 days a week',
  },
];
