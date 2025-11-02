/**
 * Vultr S3 Storage Service
 * Handles uploads, downloads, and pre-signed URLs for original document files
 *
 * Worker-Compatible Implementation:
 * - Uses fetch() instead of AWS SDK (no DOMParser dependency)
 * - AWS Signature V4 signing using Web Crypto API
 * - No Node.js dependencies
 */

export class VultrStorageService {
  private bucketName: string;
  private endpoint: string;
  private region: string;
  private accessKeyId: string;
  private secretAccessKey: string;
  private env: any;

  constructor(env: any) {
    this.env = env;
    this.bucketName = env.VULTR_S3_BUCKET;
    this.endpoint = env.VULTR_S3_ENDPOINT;
    this.region = env.VULTR_S3_REGION;
    this.accessKeyId = env.VULTR_S3_ACCESS_KEY;
    this.secretAccessKey = env.VULTR_S3_SECRET_KEY;

    this.env.logger?.info('Vultr S3 Storage Service initialized (Worker-compatible)', {
      bucket: this.bucketName,
      region: this.region,
      endpoint: this.endpoint,
    });
  }

  /**
   * AWS Signature V4 signing using Web Crypto API
   */
  private async sign(key: ArrayBuffer, message: string): Promise<ArrayBuffer> {
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    return await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message));
  }

  private async sha256(message: string): Promise<string> {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  private async getSignatureKey(
    dateStamp: string,
    regionName: string,
    serviceName: string
  ): Promise<ArrayBuffer> {
    const kDate = await this.sign(
      new TextEncoder().encode('AWS4' + this.secretAccessKey).buffer,
      dateStamp
    );
    const kRegion = await this.sign(kDate, regionName);
    const kService = await this.sign(kRegion, serviceName);
    const kSigning = await this.sign(kService, 'aws4_request');
    return kSigning;
  }

  /**
   * Generate AWS Signature V4 headers for S3 request
   */
  private async getSignedHeaders(
    method: string,
    path: string,
    queryString: string,
    headers: Record<string, string>,
    payloadHash: string
  ): Promise<Record<string, string>> {
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);

    // Canonical request
    const canonicalHeaders = Object.keys(headers)
      .sort()
      .map((key) => `${key.toLowerCase()}:${headers[key].trim()}`)
      .join('\n');
    const signedHeaders = Object.keys(headers)
      .sort()
      .map((key) => key.toLowerCase())
      .join(';');

    const canonicalRequest = [
      method,
      path,
      queryString,
      canonicalHeaders + '\n',
      signedHeaders,
      payloadHash,
    ].join('\n');

    // String to sign
    const algorithm = 'AWS4-HMAC-SHA256';
    const credentialScope = `${dateStamp}/${this.region}/s3/aws4_request`;
    const canonicalRequestHash = await this.sha256(canonicalRequest);
    const stringToSign = [algorithm, amzDate, credentialScope, canonicalRequestHash].join('\n');

    // Signature
    const signingKey = await this.getSignatureKey(dateStamp, this.region, 's3');
    const signatureBuffer = await this.sign(signingKey, stringToSign);
    const signature = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    // Authorization header
    const authorizationHeader = `${algorithm} Credential=${this.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    return {
      ...headers,
      'x-amz-date': amzDate,
      Authorization: authorizationHeader,
    };
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
      // Calculate payload hash
      const payloadHash = await this.sha256Hash(file);

      // Build URL (path-style for S3-compatible services)
      const host = new URL(this.endpoint).host;
      const path = `/${this.bucketName}/${key}`;
      const url = `${this.endpoint}/${this.bucketName}/${key}`;

      // Build headers
      const headers: Record<string, string> = {
        host: host,
        'content-type': contentType,
        'x-amz-content-sha256': payloadHash,
      };

      // Sign request
      const signedHeaders = await this.getSignedHeaders('PUT', path, '', headers, payloadHash);

      // Upload using fetch
      const response = await fetch(url, {
        method: 'PUT',
        headers: signedHeaders,
        body: file,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`S3 upload failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

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
   * Calculate SHA256 hash of buffer
   */
  private async sha256Hash(data: Buffer): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Generate pre-signed download URL (expires in 1 hour)
   * @param key - S3 object key
   * @returns Pre-signed URL
   */
  async getDownloadUrl(key: string, expiresIn: number = 3600): Promise<string> {
    this.env.logger?.info('Generating pre-signed download URL', {
      key,
      expiresIn,
    });

    try {
      const now = new Date();
      const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
      const dateStamp = amzDate.slice(0, 8);
      const expiresInSeconds = String(expiresIn);

      // Build query string for pre-signed URL
      const algorithm = 'AWS4-HMAC-SHA256';
      const credentialScope = `${dateStamp}/${this.region}/s3/aws4_request`;
      const credential = `${this.accessKeyId}/${credentialScope}`;

      const queryParams = new URLSearchParams({
        'X-Amz-Algorithm': algorithm,
        'X-Amz-Credential': credential,
        'X-Amz-Date': amzDate,
        'X-Amz-Expires': expiresInSeconds,
        'X-Amz-SignedHeaders': 'host',
      });

      const queryString = queryParams.toString();
      const host = new URL(this.endpoint).host;
      const path = `/${this.bucketName}/${key}`;

      // Canonical request for pre-signed URL
      const canonicalHeaders = `host:${host}`;
      const signedHeaders = 'host';
      const payloadHash = 'UNSIGNED-PAYLOAD';

      const canonicalRequest = [
        'GET',
        path,
        queryString,
        canonicalHeaders + '\n',
        signedHeaders,
        payloadHash,
      ].join('\n');

      // String to sign
      const canonicalRequestHash = await this.sha256(canonicalRequest);
      const stringToSign = [algorithm, amzDate, credentialScope, canonicalRequestHash].join('\n');

      // Signature
      const signingKey = await this.getSignatureKey(dateStamp, this.region, 's3');
      const signatureBuffer = await this.sign(signingKey, stringToSign);
      const signature = Array.from(new Uint8Array(signatureBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      // Build final URL
      const url = `${this.endpoint}${path}?${queryString}&X-Amz-Signature=${signature}`;

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
      // Build URL
      const host = new URL(this.endpoint).host;
      const path = `/${this.bucketName}/${key}`;
      const url = `${this.endpoint}/${this.bucketName}/${key}`;

      // Build headers
      const payloadHash = 'UNSIGNED-PAYLOAD';
      const headers: Record<string, string> = {
        host: host,
      };

      // Sign request
      const signedHeaders = await this.getSignedHeaders('GET', path, '', headers, payloadHash);

      // Download using fetch
      const response = await fetch(url, {
        method: 'GET',
        headers: signedHeaders,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`S3 download failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      // Convert to Buffer
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

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
      // Build URL
      const host = new URL(this.endpoint).host;
      const path = `/${this.bucketName}/${key}`;
      const url = `${this.endpoint}/${this.bucketName}/${key}`;

      // Build headers
      const payloadHash = 'UNSIGNED-PAYLOAD';
      const headers: Record<string, string> = {
        host: host,
      };

      // Sign request
      const signedHeaders = await this.getSignedHeaders('DELETE', path, '', headers, payloadHash);

      // Delete using fetch
      const response = await fetch(url, {
        method: 'DELETE',
        headers: signedHeaders,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`S3 delete failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

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
