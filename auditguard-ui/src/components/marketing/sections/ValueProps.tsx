import Link from 'next/link';
import { Coins, PiggyBank, ShieldCheck, Target, Timer, Users, Zap } from 'lucide-react';
import { valueProps } from '@/config/marketing';

const iconMap = {
  PiggyBank,
  Zap,
  Target,
  Users,
  ShieldCheck,
  Coins,
  Timer,
};

export function ValueProps() {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-600">
            Why teams switch to AuditGuardX
          </p>
          <h2 className="mt-4 text-3xl font-bold text-gray-900 sm:text-4xl">
            Built for cost, speed, and audit confidence
          </h2>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {valueProps.map((item) => {
            const Icon = iconMap[item.icon as keyof typeof iconMap] ?? PiggyBank;
            return (
              <div key={item.title} className="rounded-3xl border border-gray-100 bg-gray-50/60 p-8">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-6 text-2xl font-semibold text-gray-900">{item.title}</h3>
                <p className="mt-4 text-sm text-gray-600">{item.description}</p>
                <Link href={item.href} className="mt-6 inline-flex items-center text-sm font-semibold text-blue-600">
                  {item.linkLabel}
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
