import { comparisonTable } from '@/config/marketing';

export function ComparisonTable() {
  return (
    <div className="overflow-hidden rounded-[32px] bg-white/90 p-1 shadow-2xl shadow-blue-100">
      <div className="overflow-x-auto rounded-[28px] border border-gray-100">
        <table className="w-full min-w-[720px] text-sm text-gray-700">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
            <tr>
              <th className="px-6 py-4">Evaluation Criteria</th>
              <th className="px-6 py-4 text-center text-blue-600">AuditGuardX</th>
              <th className="px-6 py-4 text-center">Vanta</th>
              <th className="px-6 py-4 text-center">Drata</th>
              <th className="px-6 py-4 text-center">Consultants</th>
            </tr>
          </thead>
          <tbody>
            {comparisonTable.map((row, index) => (
              <tr key={row.label} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}>
                <td className="px-6 py-4 text-sm font-semibold text-gray-900">{row.label}</td>
                <td className="px-6 py-4 text-center font-semibold text-blue-700">
                  <span className="inline-flex items-center justify-center rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
                    {row.values.auditguardx}
                  </span>
                </td>
                <td className="px-6 py-4 text-center text-gray-600">{row.values.vanta}</td>
                <td className="px-6 py-4 text-center text-gray-600">{row.values.drata}</td>
                <td className="px-6 py-4 text-center text-gray-600">{row.values.consultants}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
