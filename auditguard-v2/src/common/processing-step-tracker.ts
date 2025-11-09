/**
 * Processing Step Tracker
 *
 * Provides explicit step-by-step tracking for document processing pipeline.
 * This replaces the scattered status field approach with a clean, sequential system.
 */

export interface ProcessingStep {
  id: string;
  documentId: string;
  stepName: string;
  stepOrder: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  startedAt?: number;
  completedAt?: number;
  progressCurrent?: number;
  progressTotal?: number;
  metadata?: any;
  errorMessage?: string;
  createdAt: number;
  updatedAt: number;
}

export interface StepDefinition {
  name: string;
  order: number;
  label: string;
}

export interface Logger {
  info(message: string, fields?: any): void;
  error(message: string, fields?: any): void;
  warn(message: string, fields?: any): void;
}

export class ProcessingStepTracker {
  private db: any;
  private logger: Logger;

  // Define all processing steps in order
  private readonly STEPS: StepDefinition[] = [
    { name: 'extraction', order: 1, label: 'Text Extraction' },
    { name: 'chunking', order: 2, label: 'Document Chunking' },
    { name: 'embedding', order: 3, label: 'Vector Embeddings' },
    { name: 'indexing', order: 4, label: 'Vector Indexing' },
    { name: 'enrichment', order: 5, label: 'AI Enrichment' },
  ];

  constructor(db: any, logger: Logger) {
    this.db = db;
    this.logger = logger;
  }

  /**
   * Initialize all processing steps for a document
   * Call this when document processing starts
   */
  async initializeSteps(documentId: string): Promise<void> {
    this.logger.info('Initializing processing steps', { documentId });

    const now = Date.now();

    for (const step of this.STEPS) {
      const stepId = `step_${documentId}_${step.name}`;

      try {
        await this.db.prepare(
          `INSERT INTO document_processing_steps
           (id, document_id, step_name, step_order, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'pending', ?, ?)
           ON CONFLICT(document_id, step_name) DO NOTHING`
        ).bind(
          stepId,
          documentId,
          step.name,
          step.order,
          now,
          now
        ).run();
      } catch (error) {
        // If table doesn't exist yet (migration not run), log warning but continue
        if (error instanceof Error && error.message?.includes('no such table')) {
          this.logger.warn('Processing steps table not found - migration pending', {
            documentId,
            step: step.name,
          });
          return; // Exit early, can't initialize steps
        }
        throw error;
      }
    }

    this.logger.info('Processing steps initialized', {
      documentId,
      totalSteps: this.STEPS.length,
    });
  }

  /**
   * Mark a step as started (processing)
   */
  async startStep(documentId: string, stepName: string): Promise<void> {
    const now = Date.now();

    this.logger.info('Starting processing step', { documentId, stepName });

    try {
      await this.db.prepare(
        `UPDATE document_processing_steps
         SET status = 'processing',
             started_at = ?,
             updated_at = ?
         WHERE document_id = ? AND step_name = ?`
      ).bind(now, now, documentId, stepName).run();
    } catch (error) {
      if (error instanceof Error && error.message?.includes('no such table')) {
        // Table doesn't exist, skip gracefully
        return;
      }
      throw error;
    }
  }

  /**
   * Update progress for a step (e.g., embeddings 5/10)
   */
  async updateStepProgress(
    documentId: string,
    stepName: string,
    current: number,
    total: number
  ): Promise<void> {
    const now = Date.now();

    try {
      await this.db.prepare(
        `UPDATE document_processing_steps
         SET progress_current = ?,
             progress_total = ?,
             updated_at = ?
         WHERE document_id = ? AND step_name = ?`
      ).bind(current, total, now, documentId, stepName).run();
    } catch (error) {
      if (error instanceof Error && error.message?.includes('no such table')) {
        return;
      }
      // Log but don't fail on progress updates
      this.logger.warn('Failed to update step progress', {
        documentId,
        stepName,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Mark a step as completed
   */
  async completeStep(
    documentId: string,
    stepName: string,
    metadata?: any
  ): Promise<void> {
    const now = Date.now();

    this.logger.info('Completing processing step', {
      documentId,
      stepName,
      metadata,
    });

    try {
      await this.db.prepare(
        `UPDATE document_processing_steps
         SET status = 'completed',
             completed_at = ?,
             meta_info = ?,
             updated_at = ?
         WHERE document_id = ? AND step_name = ?`
      ).bind(
        now,
        metadata ? JSON.stringify(metadata) : null,
        now,
        documentId,
        stepName
      ).run();
    } catch (error) {
      if (error instanceof Error && error.message?.includes('no such table')) {
        return;
      }
      throw error;
    }
  }

  /**
   * Mark a step as failed
   */
  async failStep(
    documentId: string,
    stepName: string,
    errorMessage: string
  ): Promise<void> {
    const now = Date.now();

    this.logger.error('Processing step failed', {
      documentId,
      stepName,
      error: errorMessage,
    });

    try {
      await this.db.prepare(
        `UPDATE document_processing_steps
         SET status = 'failed',
             error_message = ?,
             updated_at = ?
         WHERE document_id = ? AND step_name = ?`
      ).bind(errorMessage, now, documentId, stepName).run();
    } catch (error) {
      if (error instanceof Error && error.message?.includes('no such table')) {
        return;
      }
      throw error;
    }
  }

  /**
   * Get all processing steps for a document
   */
  async getSteps(documentId: string): Promise<ProcessingStep[]> {
    try {
      const result = await this.db.prepare(
        `SELECT * FROM document_processing_steps
         WHERE document_id = ?
         ORDER BY step_order ASC`
      ).bind(documentId).all();

      return (result.results || []).map((row: any) => ({
        id: row.id,
        documentId: row.document_id,
        stepName: row.step_name,
        stepOrder: row.step_order,
        status: row.status,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        progressCurrent: row.progress_current,
        progressTotal: row.progress_total,
        metadata: row.meta_info ? JSON.parse(row.meta_info) : null,
        errorMessage: row.error_message,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    } catch (error) {
      if (error instanceof Error && error.message?.includes('no such table')) {
        // Table doesn't exist, return empty array
        return [];
      }
      throw error;
    }
  }

  /**
   * Reset all steps for a document (used when reprocessing)
   */
  async resetSteps(documentId: string): Promise<void> {
    this.logger.info('Resetting processing steps for reprocessing', { documentId });

    try {
      // Delete existing steps
      await this.db.prepare(
        `DELETE FROM document_processing_steps WHERE document_id = ?`
      ).bind(documentId).run();

      // Re-initialize
      await this.initializeSteps(documentId);
    } catch (error) {
      if (error instanceof Error && error.message?.includes('no such table')) {
        return;
      }
      throw error;
    }
  }

  /**
   * Get step definition by name
   */
  getStepDefinition(stepName: string): StepDefinition | undefined {
    return this.STEPS.find(s => s.name === stepName);
  }

  /**
   * Get all step definitions
   */
  getAllStepDefinitions(): StepDefinition[] {
    return [...this.STEPS];
  }
}
