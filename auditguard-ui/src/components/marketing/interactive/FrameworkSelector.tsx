'use client';

import { useMemo, useState } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { frameworksCatalog } from '@/config/marketing';

const industries = Array.from(new Set(frameworksCatalog.flatMap((framework) => framework.industries)));

export function FrameworkSelector() {
  const [query, setQuery] = useState('');
  const [activeIndustry, setActiveIndustry] = useState<string>('All');

  const filteredFrameworks = useMemo(() => {
    return frameworksCatalog.filter((framework) => {
      const matchesQuery = framework.name.toLowerCase().includes(query.toLowerCase());
      const matchesIndustry =
        activeIndustry === 'All' || framework.industries.includes(activeIndustry);
      return matchesQuery && matchesIndustry;
    });
  }, [activeIndustry, query]);

  return (
    <section className="rounded-3xl border border-gray-100 bg-white p-8 shadow-xl">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between lg:gap-10">
        <div className="w-full lg:max-w-lg">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">Framework explorer</p>
          <h2 className="mt-3 text-2xl font-bold text-gray-900">20+ frameworks, one workflow</h2>
          <p className="mt-2 text-sm text-gray-600">
            Filter by industry or search for a framework to see automation coverage.
          </p>
          <div className="relative mt-4 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search frameworks"
              className="w-full rounded-2xl border border-gray-200 px-10 py-2 text-sm focus:border-blue-500 focus:outline-none"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 lg:flex-1 lg:justify-end">
          <button
            type="button"
            className={`inline-flex items-center gap-1 rounded-full border px-4 py-2 text-xs font-semibold transition ${
              activeIndustry === 'All'
                ? 'border-blue-600 bg-blue-50 text-blue-700'
                : 'border-gray-200 text-gray-500 hover:border-blue-200 hover:text-blue-600'
            }`}
            onClick={() => setActiveIndustry('All')}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            All industries
          </button>
          {industries.map((industry) => (
            <button
              key={industry}
              type="button"
              className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                activeIndustry === industry
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-gray-200 text-gray-500 hover:border-blue-200 hover:text-blue-600'
              }`}
              onClick={() => setActiveIndustry(industry)}
            >
              {industry}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {filteredFrameworks.map((framework) => (
          <article key={framework.name} className="rounded-2xl border border-gray-100 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500">{framework.name}</p>
            <p className="mt-2 text-sm text-gray-600">{framework.coverage}</p>
            <p className="mt-3 text-xs uppercase tracking-wide text-blue-600">
              Industries: {framework.industries.join(', ')}
            </p>
            <p className="mt-3 text-sm text-gray-600">{framework.automation}</p>
          </article>
        ))}
        {filteredFrameworks.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-500">
            No frameworks match that filter yet. Try another search term.
          </div>
        )}
      </div>
    </section>
  );
}
