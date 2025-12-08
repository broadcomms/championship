import { featureHighlights } from '@/config/marketing';
import {
  FileSearch,
  ShieldCheck,
  MicVocal,
  Kanban,
  LayoutDashboard,
  Shield,
  Sparkles,
  Cloud,
  Check,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react';

// Icon mapping for each feature
const iconMap: Record<string, LucideIcon> = {
  'Intelligent Document Analysis': FileSearch,
  '20+ Frameworks in One Platform': ShieldCheck,
  'Voice-First Compliance Assistant': MicVocal,
  'Issue Management & Collaboration': Kanban,
  'Executive Reporting & Dashboards': LayoutDashboard,
  'Enterprise-Grade Security': Shield,
  'AI Document Correction': Sparkles,
  'Private Cloud Deployment': Cloud,
};

// Theme configuration for each feature category
interface FeatureTheme {
  gradient: string;
  shadow: string;
  badge: string;
  badgeColor: string;
  hoverBorder: string;
}

const themeMap: Record<string, FeatureTheme> = {
  'Intelligent Document Analysis': {
    gradient: 'from-purple-500 to-purple-600',
    shadow: 'shadow-purple-500/30',
    badge: 'AI-Powered',
    badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
    hoverBorder: 'hover:border-purple-200',
  },
  '20+ Frameworks in One Platform': {
    gradient: 'from-blue-600 to-blue-700',
    shadow: 'shadow-blue-500/30',
    badge: 'Compliance',
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
    hoverBorder: 'hover:border-blue-200',
  },
  'Voice-First Compliance Assistant': {
    gradient: 'from-emerald-500 to-emerald-600',
    shadow: 'shadow-emerald-500/30',
    badge: 'Voice AI',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    hoverBorder: 'hover:border-emerald-200',
  },
  'Issue Management & Collaboration': {
    gradient: 'from-orange-500 to-orange-600',
    shadow: 'shadow-orange-500/30',
    badge: 'Workflow',
    badgeColor: 'bg-orange-50 text-orange-700 border-orange-200',
    hoverBorder: 'hover:border-orange-200',
  },
  'Executive Reporting & Dashboards': {
    gradient: 'from-indigo-500 to-indigo-600',
    shadow: 'shadow-indigo-500/30',
    badge: 'Analytics',
    badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    hoverBorder: 'hover:border-indigo-200',
  },
  'Enterprise-Grade Security': {
    gradient: 'from-blue-700 to-blue-800',
    shadow: 'shadow-blue-600/30',
    badge: 'Security',
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
    hoverBorder: 'hover:border-blue-300',
  },
  'AI Document Correction': {
    gradient: 'from-purple-600 to-purple-700',
    shadow: 'shadow-purple-600/30',
    badge: 'AI-Powered',
    badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
    hoverBorder: 'hover:border-purple-200',
  },
  'Private Cloud Deployment': {
    gradient: 'from-slate-600 to-slate-700',
    shadow: 'shadow-slate-500/30',
    badge: 'Infrastructure',
    badgeColor: 'bg-slate-50 text-slate-700 border-slate-200',
    hoverBorder: 'hover:border-slate-200',
  },
};

export function FeatureHighlights() {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-600">
            Platform
          </p>
          <h2 className="mt-4 text-3xl font-bold text-gray-900 sm:text-4xl">
            Powerful features for every compliance moment
          </h2>
          <p className="mt-3 text-base text-gray-600">
            Built with Raindrop Smart Components, Vultr infrastructure, WorkOS SSO, and Stripe
            billing for enterprise scaling.
          </p>
        </div>

        {/* Feature Cards Grid */}
        <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {featureHighlights.map((feature, index) => {
            const Icon = iconMap[feature.title] ?? FileSearch;
            const theme = themeMap[feature.title] ?? themeMap['Intelligent Document Analysis'];

            return (
              <div
                key={feature.title}
                className={`group relative rounded-2xl border border-gray-200 bg-white p-8 shadow-md
                          transition-all duration-300 hover:shadow-xl ${theme.hoverBorder}
                          hover:-translate-y-1`}
                style={{
                  animationDelay: `${index * 50}ms`,
                }}
              >
                {/* Icon Container with Gradient */}
                <div
                  className={`mb-6 flex h-14 w-14 items-center justify-center rounded-xl
                            bg-gradient-to-br ${theme.gradient} shadow-lg ${theme.shadow}
                            transition-transform duration-300 group-hover:scale-110`}
                >
                  <Icon className="h-7 w-7 text-white" strokeWidth={2} />
                </div>

                {/* Category Badge */}
                <div
                  className={`mb-4 inline-flex items-center rounded-full border px-3 py-1
                            text-xs font-medium ${theme.badgeColor}`}
                >
                  {theme.badge}
                </div>

                {/* Feature Title Heading */}
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-900">
                  {feature.title}
                </h3>

                {/* Feature Description */}
                <p className="mb-4 text-base leading-relaxed text-gray-700">
                  {feature.description}
                </p>

                {/* Feature Bullets */}
                <ul className="mb-6 space-y-3">
                  {feature.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-start gap-3">
                      <Check
                        className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-500"
                        strokeWidth={2.5}
                      />
                      <span className="text-sm leading-relaxed text-gray-700">{bullet}</span>
                    </li>
                  ))}
                </ul>

                {/* Learn More Link */}
                <button
                  className="mt-auto flex items-center gap-2 text-sm font-semibold text-blue-600
                            transition-colors hover:text-blue-700"
                  aria-label={`Learn more about ${feature.title}`}
                >
                  Learn more
                  <ArrowRight
                    className="h-4 w-4 transition-transform group-hover:translate-x-1"
                    strokeWidth={2.5}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
