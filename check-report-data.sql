-- Check the report data structure
SELECT 
  id,
  name,
  created_at,
  frameworks,
  report_period,
  substr(summary, 1, 200) as summary_preview,
  status
FROM compliance_reports
LIMIT 1;
