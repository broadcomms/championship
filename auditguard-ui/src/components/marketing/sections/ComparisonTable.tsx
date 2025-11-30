import { comparisonTable } from '@/config/marketing';

export function ComparisonTable() {
  return (
    <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-xl">
      <table className="w-full table-fixed text-sm text-gray-700">
        <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-6 py-4">Evaluation Criteria</th>
            <th className="px-6 py-4 text-blue-600">AuditGuardX</th>
            <th className="px-6 py-4">Vanta</th>
            <th className="px-6 py-4">Drata</th>
            <th className="px-6 py-4">Consultants</th>
          </tr>
        </thead>
        <tbody>
          {comparisonTable.map((row) => (
            <tr key={row.label} className="border-t border-gray-100">
              <td className="px-6 py-4 font-semibold text-gray-900">{row.label}</td>
              <td className="px-6 py-4 font-semibold text-blue-600">{row.values.auditguardx}</td>
              <td className="px-6 py-4 text-gray-600">{row.values.vanta}</td>
              <td className="px-6 py-4 text-gray-600">{row.values.drata}</td>
              <td className="px-6 py-4 text-gray-600">{row.values.consultants}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
