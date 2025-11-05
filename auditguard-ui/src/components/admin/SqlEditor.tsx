'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Play, Download, AlertCircle, Clock, Loader2 } from 'lucide-react';

interface QueryResult {
  columns: string[];
  rows: any[];
  rowCount: number;
  executionTime: number;
  warning?: string;
}

export function SqlEditor() {
  const [sql, setSql] = useState('SELECT * FROM users LIMIT 10;');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const executeMutation = useMutation({
    mutationFn: async (query: string) => {
      const response = await fetch('/api/admin/database/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sql: query }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Query failed');
      }
      return response.json();
    },
    onSuccess: (data) => {
      setResult(data);
      setError(null);
    },
    onError: (err: any) => {
      setError(err.message);
      setResult(null);
    },
  });

  const handleExecute = () => {
    if (!sql.trim()) {
      setError('Please enter a SQL query');
      return;
    }
    executeMutation.mutate(sql);
  };

  const handleExport = (format: 'json' | 'csv') => {
    if (!result) return;

    let content: string;
    let filename: string;

    if (format === 'json') {
      content = JSON.stringify(result.rows, null, 2);
      filename = `query_result_${Date.now()}.json`;
    } else {
      // CSV format
      const headers = result.columns.join(',');
      const rows = result.rows.map((row) =>
        result.columns
          .map((col) => {
            const value = row[col];
            if (value === null || value === undefined) return '';
            const str = String(value);
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          })
          .join(',')
      );
      content = [headers, ...rows].join('\n');
      filename = `query_result_${Date.now()}.csv`;
    }

    const blob = new Blob([content], {
      type: format === 'json' ? 'application/json' : 'text/csv',
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  return (
    <div className="space-y-4">
      {/* Editor */}
      <div className="bg-white rounded-lg shadow border border-gray-200">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">SQL Query Editor</h3>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleExecute}
              disabled={executeMutation.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 text-sm font-medium"
            >
              {executeMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Executing...</span>
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  <span>Execute</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="p-4">
          <div className="bg-gray-50 rounded-lg border border-gray-300 overflow-hidden">
            <textarea
              value={sql}
              onChange={(e) => setSql(e.target.value)}
              placeholder="Enter your SQL query here..."
              className="w-full h-48 p-4 bg-transparent font-mono text-sm focus:outline-none resize-none"
              spellCheck={false}
            />
          </div>
          <p className="mt-2 text-xs text-gray-500">
            <strong>Note:</strong> Only SELECT queries are allowed for safety.
            Results are limited to 1000 rows.
          </p>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-red-900">Query Error</h4>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="bg-white rounded-lg shadow border border-gray-200">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h3 className="text-lg font-semibold text-gray-900">Query Results</h3>
              <div className="flex items-center space-x-4 text-sm text-gray-600">
                <span className="flex items-center space-x-1">
                  <Clock className="h-4 w-4" />
                  <span>{result.executionTime}ms</span>
                </span>
                <span>{result.rowCount} rows</span>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleExport('json')}
                className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center space-x-2"
              >
                <Download className="h-4 w-4" />
                <span>JSON</span>
              </button>
              <button
                onClick={() => handleExport('csv')}
                className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center space-x-2"
              >
                <Download className="h-4 w-4" />
                <span>CSV</span>
              </button>
            </div>
          </div>

          {result.warning && (
            <div className="px-4 py-3 bg-yellow-50 border-b border-yellow-200 flex items-center space-x-2 text-sm text-yellow-800">
              <AlertCircle className="h-4 w-4" />
              <span>{result.warning}</span>
            </div>
          )}

          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  {result.columns.map((column) => (
                    <th
                      key={column}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {result.rows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    {result.columns.map((column) => (
                      <td
                        key={column}
                        className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                      >
                        {row[column] === null ? (
                          <span className="text-gray-400 italic">null</span>
                        ) : typeof row[column] === 'object' ? (
                          <span className="text-xs font-mono text-gray-600">
                            {JSON.stringify(row[column])}
                          </span>
                        ) : (
                          <span className="truncate max-w-xs block">
                            {String(row[column])}
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
