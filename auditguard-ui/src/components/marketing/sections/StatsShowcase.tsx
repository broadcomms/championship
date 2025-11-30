"use client";

import { useEffect, useState } from 'react';
import { Coins, ShieldCheck, Timer, Users } from 'lucide-react';
import { stats } from '@/config/marketing';

const statIcons = {
  Users,
  ShieldCheck,
  Coins,
  Timer,
};

export function StatsShowcase() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
          }
        });
      },
      { threshold: 0.3 }
    );

    const section = document.getElementById('stats-section');
    if (section) {
      observer.observe(section);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <section id="stats-section" className="bg-gray-900">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-white/10 bg-gradient-to-r from-blue-700 to-gray-900 p-10 text-white shadow-2xl">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat, index) => {
              const Icon = statIcons[stat.icon as keyof typeof statIcons] ?? Users;
              return (
                <div key={stat.label} className="space-y-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10">
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="text-4xl font-bold">
                    {visible ? stat.value : index % 2 === 0 ? '0' : '--'}
                  </p>
                  <p className="text-sm uppercase tracking-wide text-white/70">{stat.label}</p>
                  <p className="text-sm text-white/60">{stat.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
