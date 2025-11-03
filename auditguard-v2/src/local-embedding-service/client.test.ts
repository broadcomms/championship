/**
 * Local Embedding Service Integration Tests
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { LocalEmbeddingClient } from './client';

// Configure test timeout (embeddings can take a few seconds)
const TEST_TIMEOUT = 30000;

describe('LocalEmbeddingClient', () => {
  let client: LocalEmbeddingClient;
  const serviceUrl = process.env.LOCAL_EMBEDDING_SERVICE_URL || 'http://localhost:8080';

  beforeAll(() => {
    client = new LocalEmbeddingClient(serviceUrl);
  });

  it('should connect to the service', async () => {
    const result = await client.testConnection();
    expect(result.connected).toBe(true);
    expect(result.healthy).toBe(true);
    expect(result.latency_ms).toBeLessThan(1000);
  }, TEST_TIMEOUT);

  it('should generate 384-dimensional embeddings', async () => {
    const texts = [
      'This is a test document about compliance.',
      'Another test sentence about security policies.',
    ];

    const embeddings = await client.generateEmbeddings(texts);

    expect(embeddings).toHaveLength(2);
    expect(embeddings[0]).toHaveLength(384);
    expect(embeddings[1]).toHaveLength(384);

    // Check values are normalized (should be close to 1.0)
    const norm0 = Math.sqrt(embeddings[0].reduce((sum, val) => sum + val * val, 0));
    expect(norm0).toBeCloseTo(1.0, 2);
  }, TEST_TIMEOUT);

  it('should handle batch processing', async () => {
    const batchSizes = [1, 5, 10, 20, 32];

    for (const batchSize of batchSizes) {
      const texts = Array(50).fill('Test sentence for batch processing');
      const embeddings = await client.generateEmbeddings(texts, batchSize);

      expect(embeddings).toHaveLength(50);
      embeddings.forEach((emb) => {
        expect(emb).toHaveLength(384);
      });
    }
  }, TEST_TIMEOUT);

  it('should generate single embedding', async () => {
    const text = 'Single test document';
    const embedding = await client.generateSingleEmbedding(text);

    expect(embedding).toHaveLength(384);
    expect(Array.isArray(embedding)).toBe(true);
  }, TEST_TIMEOUT);

  it('should handle empty input', async () => {
    const embeddings = await client.generateEmbeddings([]);
    expect(embeddings).toHaveLength(0);
  }, TEST_TIMEOUT);

  it('should get health status', async () => {
    const health = await client.getHealth();

    expect(health.status).toBe('healthy');
    expect(health.dimensions).toBe(384);
    expect(health.ready).toBe(true);
    expect(health.model).toBe('sentence-transformers/all-MiniLM-L6-v2');
  }, TEST_TIMEOUT);

  it('should get metrics', async () => {
    const metrics = await client.getMetrics();

    expect(metrics.model_loaded).toBe(true);
    expect(metrics.dimensions).toBe(384);
    expect(metrics.total_requests).toBeGreaterThan(0);
  }, TEST_TIMEOUT);

  it('should handle errors gracefully', async () => {
    const badClient = new LocalEmbeddingClient('http://invalid-url:9999');

    const result = await badClient.testConnection();
    expect(result.connected).toBe(false);
    expect(result.error).toBeDefined();
  }, TEST_TIMEOUT);

  it('should timeout on slow requests', async () => {
    const slowClient = new LocalEmbeddingClient(serviceUrl, 100); // 100ms timeout

    // Generate a large batch that will take longer than 100ms
    const texts = Array(1000).fill('Test text');

    await expect(
      slowClient.generateEmbeddings(texts)
    ).rejects.toThrow(/timeout/i);
  }, TEST_TIMEOUT);

  it('should produce consistent embeddings', async () => {
    const text = 'Consistent test document';

    const embedding1 = await client.generateEmbeddings([text]);
    const embedding2 = await client.generateEmbeddings([text]);

    // Same text should produce identical embeddings
    expect(embedding1[0]).toEqual(embedding2[0]);
  }, TEST_TIMEOUT);

  it('should handle special characters', async () => {
    const texts = [
      'Text with "quotes" and symbols: @#$%^&*()',
      'Unicode: 你好世界 🚀',
      'Newlines\nand\ttabs',
    ];

    const embeddings = await client.generateEmbeddings(texts);

    expect(embeddings).toHaveLength(3);
    embeddings.forEach((emb) => {
      expect(emb).toHaveLength(384);
    });
  }, TEST_TIMEOUT);
});
