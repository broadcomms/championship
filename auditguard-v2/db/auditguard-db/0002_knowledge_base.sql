-- Migration: Add knowledge_base table for AI assistant
-- SQLite (D1) compatible schema

CREATE TABLE IF NOT EXISTS knowledge_base (
  id TEXT PRIMARY KEY DEFAULT ('kb_' || lower(hex(randomblob(6)))),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('framework_guide', 'compliance_article', 'best_practice')),
  framework TEXT CHECK (framework IN ('gdpr', 'soc2', 'hipaa', 'iso27001', 'nist_csf', 'pci_dss')),
  tags TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  created_by TEXT REFERENCES users(id),
  is_active INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_kb_category ON knowledge_base(category) WHERE is_active = 1;
CREATE INDEX IF NOT EXISTS idx_kb_framework ON knowledge_base(framework) WHERE is_active = 1;
CREATE INDEX IF NOT EXISTS idx_kb_active ON knowledge_base(is_active);

CREATE TRIGGER IF NOT EXISTS update_kb_timestamp 
AFTER UPDATE ON knowledge_base
BEGIN
  UPDATE knowledge_base SET updated_at = unixepoch() WHERE id = NEW.id;
END;

-- Seed data: Framework Guides (5)
INSERT INTO knowledge_base (id, title, content, category, framework, tags, sort_order) VALUES
('kb_guide_gdpr', 'GDPR Quick Reference', 
'GDPR (General Data Protection Regulation) Quick Reference

KEY PRINCIPLES:
1. Lawfulness, fairness, transparency
2. Purpose limitation
3. Data minimization
4. Accuracy
5. Storage limitation
6. Integrity and confidentiality
7. Accountability

COMMON REQUIREMENTS:
- Lawful basis for processing
- Data subject rights (access, erasure, portability)
- Data breach notification (72 hours)
- Privacy by design and default
- Data Protection Impact Assessments (DPIAs)

PENALTIES: Up to €20M or 4% of global annual turnover', 
'framework_guide', 'gdpr', '["GDPR","data_protection","privacy","regulation","EU"]', 1),

('kb_guide_soc2', 'SOC 2 Quick Reference',
'SOC 2 (System and Organization Controls 2) Quick Reference

TRUST SERVICE CRITERIA:
1. Security - Protection against unauthorized access
2. Availability - System available for operation/use
3. Processing Integrity - Complete, valid, accurate, timely
4. Confidentiality - Protected as committed/agreed
5. Privacy - Personal information collection, use, retention, disclosure, disposal

AUDIT TYPES:
- Type I: Point-in-time assessment
- Type II: 6-12 month period assessment (most common)

EVIDENCE REQUIRED:
- Policies and procedures
- System descriptions
- Risk assessments
- Access controls
- Change management logs', 
'framework_guide', 'soc2', '["SOC2","audit","compliance","trust_services","security"]', 2),

('kb_guide_hipaa', 'HIPAA Quick Reference',
'HIPAA (Health Insurance Portability and Accountability Act) Quick Reference

KEY RULES:
1. Privacy Rule - PHI protections
2. Security Rule - ePHI safeguards
3. Breach Notification Rule

SAFEGUARDS REQUIRED:
Administrative:
- Risk assessments
- Workforce training
- Incident response procedures

Physical:
- Facility access controls
- Workstation security
- Device/media controls

Technical:
- Access control
- Audit controls
- Integrity controls
- Transmission security

BUSINESS ASSOCIATE AGREEMENTS (BAA):
Required for third parties handling PHI', 
'framework_guide', 'hipaa', '["HIPAA","healthcare","PHI","ePHI","privacy","security"]', 3),

('kb_guide_iso27001', 'ISO 27001 Quick Reference',
'ISO 27001 (Information Security Management System) Quick Reference

ISMS COMPONENTS:
1. Leadership and commitment
2. Information security policy
3. Risk assessment methodology
4. Risk treatment plan
5. Statement of Applicability (SoA)

ANNEX A CONTROLS: 93 controls across:
- Organizational controls (37)
- People controls (8)
- Physical controls (14)
- Technological controls (34)

CERTIFICATION PROCESS:
- Stage 1: Documentation review
- Stage 2: Implementation audit
- Surveillance audits (annual)
- Recertification (every 3 years)

KEY REQUIREMENTS:
- Context of organization
- Interested parties needs
- Scope of ISMS
- Risk assessment and treatment', 
'framework_guide', 'iso27001', '["ISO27001","ISMS","information_security","certification"]', 4),

('kb_guide_nist', 'NIST CSF Quick Reference',
'NIST Cybersecurity Framework (CSF) Quick Reference

FIVE CORE FUNCTIONS:

1. IDENTIFY
- Asset management
- Business environment
- Governance
- Risk assessment
- Risk management strategy

2. PROTECT
- Access control
- Awareness and training
- Data security
- Protective technology

3. DETECT
- Anomalies and events
- Security continuous monitoring
- Detection processes

4. RESPOND
- Response planning
- Communications
- Analysis
- Mitigation
- Improvements

5. RECOVER
- Recovery planning
- Improvements
- Communications

IMPLEMENTATION TIERS:
- Tier 1: Partial
- Tier 2: Risk Informed
- Tier 3: Repeatable
- Tier 4: Adaptive', 
'framework_guide', 'nist_csf', '["NIST","CSF","cybersecurity","framework"]', 5);

-- Seed data: Compliance Articles (8)
INSERT INTO knowledge_base (id, title, content, category, framework, tags, sort_order) VALUES
('kb_gdpr_data_min', 'GDPR Article 5 - Data Minimization',
'GDPR Data Minimization Principle (Article 5(1)(c))

REQUIREMENT:
Personal data must be adequate, relevant, and limited to what is necessary for the purposes for which they are processed.

KEY ASPECTS:
1. Collect only necessary data
2. Avoid excessive data collection
3. Review data needs regularly
4. Delete unnecessary data
5. Document data necessity

PRACTICAL APPLICATION:
- Default forms to minimum fields
- Optional vs required field designation
- Regular data audits
- Purpose-based data collection
- Privacy by design

PENALTIES FOR NON-COMPLIANCE:
Up to €20M or 4% of global annual turnover

DOCUMENTATION:
- Data mapping
- Purpose statements
- Necessity assessments
- Retention schedules', 
'compliance_article', 'gdpr', '["GDPR","data_minimization","data_protection","privacy"]', 10),

('kb_gdpr_breach', 'GDPR Data Breach Notification Requirements',
'GDPR Data Breach Notification (Article 33 & 34)

72-HOUR NOTIFICATION REQUIREMENT:
Organizations must notify the supervisory authority within 72 hours of becoming aware of a personal data breach.

NOTIFICATION MUST INCLUDE:
1. Nature of breach (categories, approximate number of data subjects)
2. Name and contact details of DPO or other contact point
3. Likely consequences of the breach
4. Measures taken or proposed to address the breach and mitigate effects

INDIVIDUAL NOTIFICATION:
Required when breach likely to result in high risk to rights and freedoms of data subjects. Must include:
- Clear and plain language description
- Name and contact of DPO
- Likely consequences
- Mitigation measures taken

DOCUMENTATION REQUIREMENTS:
- Document all breaches (regardless of notification requirement)
- Facts relating to breach
- Effects and remedial action taken
- Available for supervisory authority review

PENALTIES:
Up to €10M or 2% of global annual turnover for notification failures

EXEMPTIONS:
- Encrypted data (key not compromised)
- Subsequent measures render data unintelligible
- Disproportionate effort (public communication accepted)', 
'compliance_article', 'gdpr', '["GDPR","data_breach","notification","72_hours","incident_response","DPO"]', 11),

('kb_soc2_evidence', 'SOC 2 Type II Evidence Requirements',
'SOC 2 Type II Audit Evidence

EVIDENCE CATEGORIES:

1. ACCESS CONTROL EVIDENCE
- User access reviews (quarterly)
- Termination logs
- Access request approvals
- Role assignments
- Privileged access reviews

2. CHANGE MANAGEMENT
- Change tickets with approvals
- Code review documentation
- Deployment logs
- Rollback procedures
- Emergency change justifications

3. INCIDENT MANAGEMENT
- Incident tickets
- Response timelines
- Root cause analyses
- Communication records
- Lessons learned

4. SECURITY AWARENESS
- Training completion records
- Training content/materials
- Phishing simulation results
- Policy acknowledgments

5. VULNERABILITY MANAGEMENT
- Scan results (monthly/quarterly)
- Patching records
- Risk acceptance documentation
- Remediation timelines

6. MONITORING & LOGGING
- Log retention evidence
- SIEM alerts
- Log review documentation
- Anomaly investigations

7. GOVERNANCE
- Policy review/approval
- Board/management meeting minutes
- Risk assessment updates
- Vendor assessments

AUDIT PERIOD:
Typically 6-12 months of continuous evidence

COMMON GAPS:
- Incomplete quarterly access reviews
- Missing change approvals
- Insufficient training records
- Gaps in vulnerability scanning
- Incomplete incident documentation', 
'compliance_article', 'soc2', '["SOC2","Type_II","audit","evidence","controls"]', 12),

('kb_hipaa_baa', 'HIPAA Business Associate Agreement Requirements',
'HIPAA Business Associate Agreement (BAA) Requirements

WHEN REQUIRED:
Any third party that creates, receives, maintains, or transmits PHI on behalf of a covered entity must sign a BAA.

MANDATORY PROVISIONS:

1. Permitted Uses and Disclosures
- Specify authorized uses of PHI
- Limit to purposes stated in agreement

2. Safeguards
- BA must implement appropriate safeguards
- Prevent unauthorized use/disclosure

3. Subcontractors
- BA must ensure subcontractors agree to same restrictions
- BA responsible for subcontractor compliance

4. Access Rights
- BA must provide access to PHI to covered entity
- Within timeframe specified by Privacy Rule

5. Amendment Rights
- BA must incorporate amendments to PHI

6. Accounting
- BA must track disclosures
- Provide accounting when required

7. Breach Notification
- BA must report breaches to covered entity
- No unreasonable delay (typically 60 days)

TERMINATION PROVISIONS:
- Termination upon breach
- Return or destruction of PHI
- Survival of certain provisions

PENALTIES FOR OPERATING WITHOUT BAA:
Both covered entity and business associate liable
Up to $1.5M per violation category per year

COMMON SERVICES REQUIRING BAA:
- Cloud storage providers
- Email services with PHI
- Billing companies
- IT support with PHI access
- Legal services reviewing PHI
- Transcription services', 
'compliance_article', 'hipaa', '["HIPAA","BAA","business_associate","PHI","contracts"]', 13),

('kb_iso_risk', 'ISO 27001 Risk Assessment Methodology',
'ISO 27001 Risk Assessment and Treatment

RISK ASSESSMENT PROCESS:

1. IDENTIFY ASSETS
- Information assets
- IT assets (hardware, software)
- Services
- People
- Physical assets

2. IDENTIFY THREATS
- Malicious (hackers, malware, insiders)
- Accidental (human error, system failures)
- Environmental (natural disasters)

3. IDENTIFY VULNERABILITIES
- Technical vulnerabilities
- Organizational weaknesses
- Process gaps
- Physical security weaknesses

4. ASSESS EXISTING CONTROLS
- Technical controls
- Administrative controls
- Physical controls

5. DETERMINE LIKELIHOOD
- Consider threat frequency
- Ease of exploitation
- Existing control effectiveness

6. DETERMINE IMPACT
- Confidentiality impact
- Integrity impact
- Availability impact
- Financial impact
- Reputational impact

RISK CALCULATION:
Risk = Likelihood × Impact

RISK TREATMENT OPTIONS:

1. MODIFY (Mitigate)
- Implement new controls
- Improve existing controls
- Most common approach

2. RETAIN (Accept)
- Document acceptance
- Require senior management approval
- Review periodically

3. AVOID (Eliminate)
- Stop the activity
- Remove the asset
- Change the process

4. SHARE (Transfer)
- Insurance
- Outsourcing with contractual protection
- Cloud services with appropriate agreements

DOCUMENTATION REQUIREMENTS:
- Risk register
- Risk treatment plan
- Statement of Applicability (SoA)
- Risk acceptance records
- Residual risk assessment

REVIEW FREQUENCY:
- Annual reviews mandatory
- After significant changes
- After incidents
- When new threats emerge', 
'compliance_article', 'iso27001', '["ISO27001","risk_assessment","ISMS","risk_management"]', 14),

('kb_access_control', 'Cross-Framework Access Control Best Practices',
'Access Control Best Practices (GDPR, SOC2, HIPAA, ISO27001, NIST CSF)

PRINCIPLE OF LEAST PRIVILEGE:
- Grant minimum necessary access
- Time-limited elevated privileges
- Regular access reviews

ROLE-BASED ACCESS CONTROL (RBAC):
- Define roles based on job functions
- Assign permissions to roles, not individuals
- Document role definitions
- Review role assignments quarterly

MULTI-FACTOR AUTHENTICATION (MFA):
- Required for:
  * Administrative access
  * Remote access
  * Sensitive data access
  * Cloud services

ACCESS REVIEW PROCESS:
Quarterly reviews should include:
- Active user list
- Current permissions
- Last login dates
- Terminated user verification
- Contractor access validation

TERMINATION PROCEDURES:
- Immediate access revocation
- HR notification triggers
- Asset return
- Account disablement checklist
- Quarterly terminated user audits

PRIVILEGED ACCESS MANAGEMENT (PAM):
- Separate admin accounts
- Just-in-time access
- Session recording
- Approval workflows
- Emergency access procedures

AUDIT LOGGING:
Log all:
- Authentication attempts
- Permission changes
- Admin actions
- Access to sensitive data
- Failed access attempts

FRAMEWORK-SPECIFIC REQUIREMENTS:

GDPR:
- Data subject access restrictions
- Processing purpose alignment
- Technical and organizational measures

SOC2:
- Quarterly user access reviews
- Segregation of duties
- Change management controls

HIPAA:
- Minimum necessary standard
- Role-based access to ePHI
- Emergency access procedures
- Workforce clearance procedures

ISO27001:
- Access control policy (A.9)
- User access management (A.9.2)
- User responsibilities (A.9.3)
- System and application access control (A.9.4)

NIST CSF:
- PR.AC-1: Identities and credentials managed
- PR.AC-3: Remote access managed
- PR.AC-4: Access permissions managed
- PR.AC-6: Identities proofed and bound', 
'best_practice', NULL, '["access_control","RBAC","MFA","least_privilege","cross_framework"]', 20),

('kb_data_retention', 'Data Retention Policy Guidelines',
'Data Retention Policy Guidelines (Multi-Framework)

RETENTION PRINCIPLES:

1. LEGAL REQUIREMENTS
- Comply with applicable laws
- Industry-specific regulations
- Contractual obligations

2. BUSINESS NEEDS
- Operational requirements
- Historical analysis
- Customer support

3. DATA MINIMIZATION
- Retain only as long as necessary
- Regular review and deletion
- Documented justification

FRAMEWORK-SPECIFIC REQUIREMENTS:

GDPR:
- Storage limitation principle
- Retain only for specified purposes
- Regular review obligations
- Right to erasure considerations

HIPAA:
- Minimum 6 years for most records
- Business associate agreements
- Accounting of disclosures (6 years)
- HIPAA authorization (6 years)

SOC2:
- Audit logs (7 years typical)
- Security events (1 year minimum)
- Access reviews (3 years)
- Incident records (3 years)

SAMPLE RETENTION SCHEDULE:

CUSTOMER DATA:
- Active customer: Duration of relationship + 7 years
- Inactive customer: 2-7 years based on requirements
- Marketing data: Until opt-out + 30 days

EMPLOYEE DATA:
- Personnel files: Termination + 7 years
- Payroll records: 7 years
- I-9 forms: Termination + 3 years
- Training records: Employment + 3 years

SYSTEM LOGS:
- Security logs: 1-2 years
- Audit logs: 7 years
- Application logs: 90 days - 1 year
- Network logs: 90 days - 1 year

FINANCIAL RECORDS:
- Invoices: 7 years
- Tax records: 7 years
- Contracts: Termination + 7 years

IMPLEMENTATION STEPS:

1. Data Inventory
- Identify all data types
- Document current retention
- Map to legal requirements

2. Policy Development
- Define retention periods
- Approval process
- Exceptions process

3. Technical Implementation
- Automated deletion
- Archive procedures
- Backup considerations

4. Training and Communication
- Staff awareness
- Data owner responsibilities
- Customer notifications

5. Monitoring and Review
- Annual policy review
- Compliance monitoring
- Update as regulations change

DELETION BEST PRACTICES:
- Secure deletion methods
- Verification of deletion
- Document deletion activities
- Consider backup retention', 
'best_practice', NULL, '["data_retention","privacy","records_management","GDPR","HIPAA"]', 21),

('kb_incident_response', 'Incident Response Plan Components',
'Incident Response Plan (SOC2, ISO27001, GDPR, NIST CSF)

SIX PHASES OF INCIDENT RESPONSE:

1. PREPARATION
- Incident response team roles
- Contact lists (internal/external)
- Communication templates
- Tool setup and access
- Training and drills

2. DETECTION AND ANALYSIS
- Monitoring and alerting
- Log analysis
- Threat intelligence
- Severity classification
- Initial assessment

3. CONTAINMENT
Short-term:
- Isolate affected systems
- Preserve evidence
- Implement temporary fixes

Long-term:
- Apply security patches
- Change credentials
- Remove malware

4. ERADICATION
- Remove threat actors
- Delete malware
- Close vulnerabilities
- Verify threat removal

5. RECOVERY
- Restore systems from clean backups
- Rebuild compromised systems
- Verify system integrity
- Monitor for reinfection
- Gradual service restoration

6. POST-INCIDENT
- Lessons learned meeting
- Incident report documentation
- Process improvements
- Training updates
- Metrics analysis

COMMUNICATION PLAN:

INTERNAL:
- Executive leadership
- IT and security teams
- Legal and compliance
- Public relations
- Human resources

EXTERNAL:
- Law enforcement (if applicable)
- Customers (if data breach)
- Regulators (GDPR 72 hours)
- Insurance provider
- Third-party vendors

SEVERITY CLASSIFICATION:

CRITICAL (P1):
- Active data breach
- Ransomware
- Complete service outage
- Response: Immediate (24/7)

HIGH (P2):
- Potential data breach
- Significant service degradation
- Response: 2 hours during business hours

MEDIUM (P3):
- Security policy violations
- Minor service issues
- Response: 8 hours

LOW (P4):
- Security warnings
- No immediate impact
- Response: 48 hours

DOCUMENTATION REQUIREMENTS:
- Incident timeline
- Actions taken
- Evidence collected
- Communications sent
- Impact assessment
- Root cause analysis
- Corrective actions

METRICS TO TRACK:
- Mean Time to Detect (MTTD)
- Mean Time to Respond (MTTR)
- Number of incidents by severity
- Incident categories/trends
- False positive rate

COMPLIANCE MAPPING:

SOC2:
- CC7.3: Incident response
- CC7.4: Incident detection
- CC7.5: Incident analysis

ISO27001:
- A.16.1: Incident management
- A.16.2: Evidence collection

GDPR:
- Article 33: Breach notification
- Article 34: Communication to data subjects

NIST CSF:
- DE.AE: Anomalies and events
- RS: Respond function
- RC: Recovery function', 
'best_practice', NULL, '["incident_response","security","breach","SOC2","ISO27001","GDPR","NIST"]', 22);
