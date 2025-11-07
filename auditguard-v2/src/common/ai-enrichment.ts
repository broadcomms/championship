/**
 * Shared AI Enrichment Utility
 * 
 * Provides AI-powered document enrichment capabilities that can be used across services:
 * - Title generation
 * - Description/summary generation
 * - Category classification (policy, procedure, evidence, other)
 * - Compliance framework detection (SOX, GDPR, HIPAA, PCI-DSS, ISO27001, NIST)
 * 
 * @module common/ai-enrichment
 */

// ============================================================================
// Type Definitions
// ============================================================================

export type DocumentCategory = 'policy' | 'procedure' | 'evidence' | 'other';

export interface ComplianceFramework {
  id: number;
  name: string;
  displayName: string;
  description: string;
}

export interface EnrichmentResult {
  title: string;
  description: string;
  category: DocumentCategory;
  complianceFrameworkId: number | null;
  confidence: {
    title: number;
    description: number;
    category: number;
    framework: number;
  };
}

export interface EnrichmentInput {
  filename: string;
  contentType: string;
  text: string;
  wordCount: number;
  pageCount?: number;
}

export interface EnrichmentDependencies {
  AI: any;
  AUDITGUARD_DB: any;
  logger: any;
}

// ============================================================================
// AI Enrichment Functions
// ============================================================================

/**
 * Enriches a document using AI analysis
 */
export async function enrichDocument(
  input: EnrichmentInput,
  deps: EnrichmentDependencies
): Promise<EnrichmentResult> {
  deps.logger.info('🤖 Starting AI document enrichment', {
    filename: input.filename,
    wordCount: input.wordCount,
    textLength: input.text.length,
  });

  try {
    // Get available compliance frameworks
    const frameworks = await getComplianceFrameworks(deps.AUDITGUARD_DB);
    
    // Build comprehensive AI prompt
    const prompt = buildEnrichmentPrompt(input, frameworks);
    
    // Call AI model
    const aiResponse = await callAiModel(prompt, deps.AI, deps.logger);
    
    // Parse and validate response
    const result = parseAiResponse(aiResponse, input, frameworks, deps.logger);
    
    deps.logger.info('✅ AI enrichment completed successfully', {
      filename: input.filename,
      category: result.category,
      framework: result.complianceFrameworkId,
    });
    
    return result;
    
  } catch (error) {
    deps.logger.error('❌ AI enrichment failed, using fallback', {
      filename: input.filename,
      error: error instanceof Error ? error.message : String(error),
    });
    
    // Return fallback enrichment
    return getFallbackEnrichment(input, deps.logger);
  }
}

/**
 * Retrieves available compliance frameworks from database
 */
async function getComplianceFrameworks(db: any): Promise<ComplianceFramework[]> {
  const result = await db.prepare(
    `SELECT id, name, display_name as displayName, description
     FROM compliance_frameworks
     WHERE is_active = 1
     ORDER BY name ASC`
  ).all();

  return result.results || [];
}

/**
 * Builds the AI enrichment prompt
 */
function buildEnrichmentPrompt(
  input: EnrichmentInput,
  frameworks: ComplianceFramework[]
): string {
  const textPreview = input.text.substring(0, 4000);
  
  const frameworkList = frameworks.map(f => 
    `- ${f.name}: ${f.displayName} (${f.description})`
  ).join('\n');

  return `Analyze this document and extract metadata in JSON format.

**Document Information:**
- Filename: ${input.filename}
- Content Type: ${input.contentType}
- Word Count: ${input.wordCount}
${input.pageCount ? `- Page Count: ${input.pageCount}` : ''}

**Document Content:**
${textPreview}

**Task:**
Analyze the document and provide the following:

1. **Title**: A clear, descriptive title (max 50 characters)
2. **Description**: A 2-3 sentence summary of the document's purpose and content
3. **Category**: Classify the document into ONE of these categories:
   - "policy": Official policies, guidelines, rules, or standards
   - "procedure": Step-by-step instructions, processes, or workflows
   - "evidence": Audit logs, reports, certificates, or proof documents
   - "other": General documents that don't fit the above categories

4. **Compliance Framework**: Detect if the document relates to ANY of these compliance frameworks:
${frameworkList}
   - Return the framework NAME (e.g., "gdpr", "hipaa", "sox")
   - Return null if no framework is detected
   - Look for keywords, regulations, standards, or compliance requirements

**Response Format (MUST be valid JSON):**
{
  "title": "Document Title Here",
  "description": "Brief summary of the document content and purpose.",
  "category": "policy|procedure|evidence|other",
  "framework": "framework_name|null",
  "confidence": {
    "title": 0.95,
    "description": 0.90,
    "category": 0.85,
    "framework": 0.80
  }
}

**Important:**
- Respond with ONLY the JSON object, no additional text
- Use double quotes for all strings
- Framework must be one of the listed names or null
- Category must be exactly one of: policy, procedure, evidence, other
- Confidence scores should be 0.0 to 1.0`;
}

/**
 * Calls the AI model with the prompt
 */
async function callAiModel(prompt: string, AI: any, logger: any): Promise<any> {
  logger.info('📤 Calling AI model for enrichment', {
    model: 'llama-3.1-8b-instruct-fast',
    promptLength: prompt.length,
  });

  const aiResponse = await AI.run('llama-3.1-8b-instruct-fast', {
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2, // Lower temperature for more consistent structured output
    max_tokens: 400, // Increased for framework detection
  });

  logger.info('📥 AI response received', {
    responseType: typeof aiResponse,
  });

  return aiResponse;
}

/**
 * Parses and validates the AI response
 */
function parseAiResponse(
  aiResponse: any,
  input: EnrichmentInput,
  frameworks: ComplianceFramework[],
  logger: any
): EnrichmentResult {
  // Handle different response formats
  let parsed: any;
  if (typeof aiResponse === 'string') {
    // Clean up response - remove markdown code blocks if present
    const cleaned = aiResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    parsed = JSON.parse(cleaned);
  } else if ((aiResponse as any).response) {
    const cleaned = (aiResponse as any).response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    parsed = JSON.parse(cleaned);
  } else {
    parsed = aiResponse;
  }

  // Validate required fields
  if (!parsed.title || !parsed.description || !parsed.category) {
    throw new Error('AI response missing required fields');
  }

  // Validate and normalize category
  const category = validateCategory(parsed.category, logger);

  // Find compliance framework ID
  const frameworkId = resolveFrameworkId(parsed.framework, frameworks, logger);

  // Validate confidence scores
  const confidence = {
    title: validateConfidence(parsed.confidence?.title),
    description: validateConfidence(parsed.confidence?.description),
    category: validateConfidence(parsed.confidence?.category),
    framework: validateConfidence(parsed.confidence?.framework),
  };

  return {
    title: parsed.title.substring(0, 200).trim(),
    description: parsed.description.substring(0, 500).trim(),
    category,
    complianceFrameworkId: frameworkId,
    confidence,
  };
}

/**
 * Validates and normalizes document category
 */
function validateCategory(category: string, logger: any): DocumentCategory {
  const normalized = category.toLowerCase().trim();
  const validCategories: DocumentCategory[] = ['policy', 'procedure', 'evidence', 'other'];
  
  if (validCategories.includes(normalized as DocumentCategory)) {
    return normalized as DocumentCategory;
  }
  
  logger.warn('⚠️ Invalid category detected, defaulting to "other"', {
    providedCategory: category,
  });
  
  return 'other';
}

/**
 * Resolves framework name to database ID
 */
function resolveFrameworkId(
  frameworkName: string | null,
  frameworks: ComplianceFramework[],
  logger: any
): number | null {
  if (!frameworkName || frameworkName === 'null') {
    return null;
  }

  const normalized = frameworkName.toLowerCase().trim();
  const framework = frameworks.find(f => f.name.toLowerCase() === normalized);

  if (framework) {
    logger.info('✅ Compliance framework detected', {
      framework: framework.displayName,
      name: framework.name,
      id: framework.id,
    });
    return framework.id;
  }

  logger.warn('⚠️ Unknown framework name, ignoring', {
    providedFramework: frameworkName,
  });

  return null;
}

/**
 * Validates confidence score (0.0 to 1.0)
 */
function validateConfidence(score: any): number {
  if (typeof score === 'number' && score >= 0 && score <= 1) {
    return score;
  }
  return 0.5; // Default medium confidence
}

/**
 * Provides fallback enrichment when AI fails
 */
function getFallbackEnrichment(input: EnrichmentInput, logger: any): EnrichmentResult {
  logger.info('🔄 Using fallback enrichment', {
    filename: input.filename,
  });

  return {
    title: input.filename.replace(/\.(pdf|docx|txt|md)$/i, ''),
    description: `${input.contentType} document with ${input.wordCount} words${input.pageCount ? `, ${input.pageCount} pages` : ''}.`,
    category: 'other',
    complianceFrameworkId: null,
    confidence: {
      title: 0.5,
      description: 0.5,
      category: 0.5,
      framework: 0.0,
    },
  };
}
