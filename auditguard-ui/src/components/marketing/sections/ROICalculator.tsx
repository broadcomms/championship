"use client";

import { useMemo, useState } from 'react';
import { roiDefaults } from '@/config/marketing';

export function ROICalculator() {
  const [inputs, setInputs] = useState({
    manualHours: roiDefaults.manualHours,
    hourlyRate: roiDefaults.hourlyRate,
    frameworks: roiDefaults.frameworks,
    auditsPerYear: roiDefaults.auditsPerYear,
  });

  const result = useMemo(() => {
    const manualCost = inputs.manualHours * inputs.hourlyRate * inputs.auditsPerYear;
    const automatedCost = 149 * 12; // assume Professional plan yearly
    const savings = manualCost - automatedCost;
    const timeSaved = inputs.manualHours * 0.9; // 90% faster
    return {
      manualCost,
      automatedCost,
      savings,
      timeSaved,
    };
  }, [inputs]);

  return (
    <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-xl">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">ROI calculator</p>
          <h3 className="mt-2 text-2xl font-bold text-gray-900">Estimate your savings</h3>
        </div>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <label className="block text-sm font-medium text-gray-700">
            Manual hours per audit
            <input
              type="number"
              min={10}
              value={inputs.manualHours}
              onChange={(event) => setInputs((prev) => ({ ...prev, manualHours: Number(event.target.value) }))}
              className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm focus:border-blue-600 focus:outline-none"
            />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Average hourly cost ($)
            <input
              type="number"
              min={25}
              value={inputs.hourlyRate}
              onChange={(event) => setInputs((prev) => ({ ...prev, hourlyRate: Number(event.target.value) }))}
              className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm focus:border-blue-600 focus:outline-none"
            />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Frameworks supported
            <input
              type="number"
              min={1}
              value={inputs.frameworks}
              onChange={(event) => setInputs((prev) => ({ ...prev, frameworks: Number(event.target.value) }))}
              className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm focus:border-blue-600 focus:outline-none"
            />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Audits per year
            <input
              type="number"
              min={1}
              value={inputs.auditsPerYear}
              onChange={(event) => setInputs((prev) => ({ ...prev, auditsPerYear: Number(event.target.value) }))}
              className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm focus:border-blue-600 focus:outline-none"
            />
          </label>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 p-6 text-white">
          <div className="space-y-4">
            <div>
              <p className="text-sm uppercase tracking-wide text-white/70">Manual compliance cost</p>
              <p className="text-3xl font-bold">${result.manualCost.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm uppercase tracking-wide text-white/70">AuditGuardX annual cost</p>
              <p className="text-3xl font-bold">${result.automatedCost.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm uppercase tracking-wide text-white/70">Projected savings</p>
              <p className="text-4xl font-bold text-green-200">${result.savings.toLocaleString()}</p>
              <p className="text-sm text-white/70">+ {result.timeSaved.toFixed(0)} hours back per audit</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
