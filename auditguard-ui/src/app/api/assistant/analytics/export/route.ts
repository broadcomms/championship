import { NextRequest, NextResponse } from 'next/server';

interface TimeRange {
  start: string;
  end: string;
}

interface AnalyticsExportRequest {
  workspaceId: string;
  format?: 'csv' | 'json';
  timeRange?: TimeRange;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as AnalyticsExportRequest;
    const {
      workspaceId,
      format = 'csv',
      timeRange,
    } = body;

    if (format !== 'csv') {
      return NextResponse.json(
        { error: 'Only CSV export is currently supported' },
        { status: 400 }
      );
    }

    // Generate CSV export data
    const csvData = generateCSV(workspaceId, timeRange);

    return new NextResponse(csvData, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename=analytics-${Date.now()}.csv`,
      },
    });
  } catch (error) {
    console.error('Export API error:', error);
    return NextResponse.json(
      { error: 'Failed to export analytics' },
      { status: 500 }
    );
  }
}

function generateCSV(workspaceId: string, timeRange?: TimeRange): string {
  const rows = [
    ['Metric', 'Value', 'Change', 'Trend'],
    ['Conversations', '248', '+15.3%', 'Up'],
    ['Response Time', '1.2s', '-20.0%', 'Down'],
    ['Satisfaction', '4.8/5', '+4.3%', 'Up'],
    ['Active Users', '87', '+10.1%', 'Up'],
    [''],
    ['Tool Usage', 'Count', 'Percentage'],
    ['Compliance Check', '145', '35.3%'],
    ['Document Search', '98', '23.9%'],
    ['Knowledge Query', '76', '18.5%'],
    ['Issue Analysis', '52', '12.7%'],
    ['Report Generation', '41', '10.0%'],
    [''],
    ['Compliance Intelligence', 'Issues Detected', 'Issues Resolved', 'Resolution Rate'],
    ['GDPR', '12', '10', '83%'],
    ['SOC2', '8', '6', '75%'],
    ['ISO27001', '5', '5', '100%'],
    ['HIPAA', '3', '2', '67%'],
    ['PCI', '7', '5', '71%'],
  ];

  if (timeRange) {
    rows.unshift(['Workspace', workspaceId, `${timeRange.start} - ${timeRange.end}`, '']);
  } else {
    rows.unshift(['Workspace', workspaceId, 'All Time', '']);
  }

  return rows.map((row) => row.join(',')).join('\n');
}
