/**
 * Vultr S3 Storage Service
 * Handles uploads, downloads, and pre-signed URLs for original document files
 */

import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export class VultrStorageService {
  private s3Client: S3Client;
  private bucketName: string;
  private env: any;

  constructor(env: any) {
    this.env = env;
    this.bucketName = env.VULTR_S3_BUCKET;

    // Initialize S3 client with Vultr endpoint
    this.s3Client = new S3Client({
      endpoint: env.VULTR_S3_ENDPOINT,
      region: env.VULTR_S3_REGION,
      credentials: {
        accessKeyId: env.VULTR_S3_ACCESS_KEY,
        secretAccessKey: env.VULTR_S3_SECRET_KEY,
      },
      forcePathStyle: true, // Required for some S3-compatible services
    });

    this.env.logger?.info('Vultr S3 Storage Service initialized', {
      bucket: this.bucketName,
      region: env.VULTR_S3_REGION,
      endpoint: env.VULTR_S3_ENDPOINT,
    });
  }

  /**
   * Upload original document to Vultr S3
   * @param key - S3 object key (path)
   * @param file - File content as Buffer
   * @param contentType - MIME type
   * @returns S3 key of uploaded file
   */
  async uploadDocument(key: string, file: Buffer, contentType: string): Promise<string> {
    this.env.logger?.info('Uploading document to Vultr S3', {
      key,
      contentType,
      size: file.length,
    });

    try {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Body: file,
          ContentType: contentType,
        })
      );

      this.env.logger?.info('Document uploaded successfully to Vultr S3', {
        key,
        size: file.length,
      });

      return key;
    } catch (error) {
      this.env.logger?.error('Failed to upload document to Vultr S3', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`Vultr S3 upload failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generate pre-signed download URL (expires in 1 hour)
   * @param key - S3 object key
   * @returns Pre-signed URL
   */
  async getDownloadUrl(key: string): Promise<string> {
    this.env.logger?.info('Generating pre-signed download URL', {
      key,
      expiresIn: 3600,
    });

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const url = await getSignedUrl(this.s3Client, command, { expiresIn: 3600 });

      this.env.logger?.info('Pre-signed URL generated successfully', {
        key,
        urlLength: url.length,
      });

      return url;
    } catch (error) {
      this.env.logger?.error('Failed to generate pre-signed URL', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`Failed to generate download URL: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get document from Vultr S3 (for text extraction)
   * @param key - S3 object key
   * @returns File content as Buffer
   */
  async getDocument(key: string): Promise<Buffer> {
    this.env.logger?.info('Downloading document from Vultr S3', {
      key,
    });

    try {
      const response = await this.s3Client.send(
        new GetObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        })
      );

      // Stream to Buffer
      const chunks: Uint8Array[] = [];
      const stream = response.Body as any;

      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      const buffer = Buffer.concat(chunks);

      this.env.logger?.info('Document downloaded successfully from Vultr S3', {
        key,
        size: buffer.length,
      });

      return buffer;
    } catch (error) {
      this.env.logger?.error('Failed to download document from Vultr S3', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`Vultr S3 download failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Delete document from Vultr S3 (cleanup)
   * @param key - S3 object key
   */
  async deleteDocument(key: string): Promise<void> {
    this.env.logger?.info('Deleting document from Vultr S3', {
      key,
    });

    try {
      const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        })
      );

      this.env.logger?.info('Document deleted successfully from Vultr S3', {
        key,
      });
    } catch (error) {
      this.env.logger?.error('Failed to delete document from Vultr S3', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`Vultr S3 delete failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
