#!/usr/bin/env node

/**
 * SmartMemory Initialization Script
 * 
 * This script initializes the SmartMemory system with the AI Assistant's
 * system prompt and procedural knowledge.
 * 
 * Run this once after deploying the backend:
 *   node scripts/init-smartmemory.js
 */

const SYSTEM_PROMPT = `You are an AI compliance assistant for AuditGuardX, helping users manage regulatory compliance.

CAPABILITIES:
- Document analysis and compliance checking
- Framework requirement matching (GDPR, SOC2, HIPAA, ISO 27001)
- Risk assessment and gap analysis
- Report generation and executive summaries

PERSONALITY:
- Professional but friendly
- Proactive in identifying issues
- Provide clear, actionable recommendations
- Acknowledge when you need more information

TOOLS AVAILABLE:
- analyze_document: Check document compliance against frameworks
- search_documents: Find relevant documents using semantic search
- get_compliance_status: Retrieve current compliance scores
- get_compliance_issues: Get list of unresolved compliance issues
- get_document_info: Get detailed information about a specific document

RESPONSE GUIDELINES:
1. Always use tools when appropriate rather than making up information
2. Cite specific document names and compliance scores when available
3. Provide actionable next steps
4. Keep responses concise but informative
5. Use a professional but approachable tone

ERROR HANDLING:
- If a tool fails, acknowledge it and provide alternative approaches
- Don't hallucinate data - if you don't have information, say so
- Guide users to relevant pages if you can't directly help`;

const GDPR_QUICK_GUIDE = `GDPR (General Data Protection Regulation) Quick Reference

KEY PRINCIPLES:
1. Lawfulness, fairness, and transparency
2. Purpose limitation
3. Data minimization
4. Accuracy
5. Storage limitation
6. Integrity and confidentiality
7. Accountability

COMMON REQUIREMENTS:
- Consent management
- Data subject rights (access, rectification, erasure, portability)
- Data breach notification (72 hours)
- Privacy by design and default
- Data Protection Impact Assessments (DPIA)
- Records of processing activities

PENALTIES:
- Up to €20 million or 4% of global annual turnover (whichever is higher)`;

const SOC2_QUICK_GUIDE = `SOC 2 (Service Organization Control 2) Quick Reference

TRUST SERVICE CRITERIA:
1. Security (required)
2. Availability (optional)
3. Processing Integrity (optional)
4. Confidentiality (optional)
5. Privacy (optional)

KEY FOCUS AREAS:
- Access controls
- Change management
- System operations
- Risk mitigation
- Incident response
- Monitoring and logging

AUDIT TYPES:
- Type I: Design effectiveness at a point in time
- Type II: Operating effectiveness over a period (6-12 months)`;

async function initializeSmartMemory() {
  console.log('🧠 Initializing SmartMemory for AI Assistant...');
  
  try {
    // Note: This script needs to be adapted to call the actual Raindrop API
    // or run within the Raindrop environment
    
    console.log('\n📝 System Prompt:');
    console.log('─'.repeat(80));
    console.log(SYSTEM_PROMPT);
    console.log('─'.repeat(80));
    
    console.log('\n📚 GDPR Guide:');
    console.log('─'.repeat(80));
    console.log(GDPR_QUICK_GUIDE);
    console.log('─'.repeat(80));
    
    console.log('\n🔒 SOC 2 Guide:');
    console.log('─'.repeat(80));
    console.log(SOC2_QUICK_GUIDE);
    console.log('─'.repeat(80));
    
    console.log('\n✅ SmartMemory content prepared!');
    console.log('\n📌 Next Steps:');
    console.log('1. Deploy a one-time initialization service to Raindrop');
    console.log('2. Use the assistant-service to store these in procedural memory:');
    console.log('   - await proceduralMemory.putProcedure("system_prompt", SYSTEM_PROMPT)');
    console.log('   - await proceduralMemory.putProcedure("gdpr_guide", GDPR_QUICK_GUIDE)');
    console.log('   - await proceduralMemory.putProcedure("soc2_guide", SOC2_QUICK_GUIDE)');
    console.log('\nOr run this via the Raindrop CLI:');
    console.log('   cd auditguard-v2');
    console.log('   raindrop run assistant-service initialize');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Export for use in Raindrop service
module.exports = {
  SYSTEM_PROMPT,
  GDPR_QUICK_GUIDE,
  SOC2_QUICK_GUIDE
};

// Run if called directly
if (require.main === module) {
  initializeSmartMemory();
}
