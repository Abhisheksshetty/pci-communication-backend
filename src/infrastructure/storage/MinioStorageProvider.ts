import { IStorageProvider } from './IStorageProvider.js';
import * as Minio from 'minio';
import { Readable } from 'stream';

export class MinioStorageProvider implements IStorageProvider {
  private client: Minio.Client;
  private bucketName: string;
  private baseUrl: string;

  constructor(config?: {
    endPoint?: string;
    port?: number;
    useSSL?: boolean;
    accessKey?: string;
    secretKey?: string;
    bucketName?: string;
    baseUrl?: string;
  }) {
    this.client = new Minio.Client({
      endPoint: config?.endPoint || process.env.MINIO_ENDPOINT || 'localhost',
      port: config?.port || parseInt(process.env.MINIO_PORT || '9000'),
      useSSL: config?.useSSL || process.env.MINIO_USE_SSL === 'true',
      accessKey: config?.accessKey || process.env.MINIO_ACCESS_KEY || 'minioadmin',
      secretKey: config?.secretKey || process.env.MINIO_SECRET_KEY || 'minioadmin123'
    });

    this.bucketName = config?.bucketName || process.env.MINIO_BUCKET || 'sports-app';
    this.baseUrl = config?.baseUrl || process.env.MINIO_BASE_URL || 'http://localhost:9000';
    
    this.ensureBucket();
  }

  private async ensureBucket(): Promise<void> {
    try {
      const exists = await this.client.bucketExists(this.bucketName);
      if (!exists) {
        await this.client.makeBucket(this.bucketName, 'us-east-1');
        
        // Set bucket policy to allow public read for certain paths if needed
        const policy = {
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Principal: { AWS: ['*'] },
              Action: ['s3:GetObject'],
              Resource: [`arn:aws:s3:::${this.bucketName}/public/*`]
            }
          ]
        };
        
        await this.client.setBucketPolicy(this.bucketName, JSON.stringify(policy));
      }
    } catch (error) {
      console.error('Error ensuring bucket:', error);
    }
  }

  async upload(file: Buffer, filePath: string, metadata?: Record<string, any>): Promise<string> {
    const stream = Readable.from(file);
    const metaData = {
      'Content-Type': metadata?.contentType || 'application/octet-stream',
      ...metadata
    };

    await this.client.putObject(
      this.bucketName,
      filePath,
      stream,
      file.length,
      metaData
    );

    return `${this.baseUrl}/${this.bucketName}/${filePath}`;
  }

  async download(filePath: string): Promise<Buffer> {
    const stream = await this.client.getObject(this.bucketName, filePath);
    const chunks: Buffer[] = [];
    
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }

  async delete(filePath: string): Promise<void> {
    await this.client.removeObject(this.bucketName, filePath);
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      await this.client.statObject(this.bucketName, filePath);
      return true;
    } catch (error) {
      if ((error as any).code === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  async getSignedUrl(filePath: string, expiresIn: number = 3600): Promise<string> {
    return await this.client.presignedGetObject(
      this.bucketName,
      filePath,
      expiresIn
    );
  }

  async listFiles(prefix: string): Promise<string[]> {
    const files: string[] = [];
    const stream = this.client.listObjectsV2(this.bucketName, prefix, true);
    
    return new Promise((resolve, reject) => {
      stream.on('data', (obj: Minio.BucketItem) => {
        if (obj.name) {
          files.push(obj.name);
        }
      });
      stream.on('end', () => resolve(files));
      stream.on('error', reject);
    });
  }

  async getMetadata(filePath: string): Promise<Record<string, any>> {
    try {
      const stat = await this.client.statObject(this.bucketName, filePath);
      return stat.metaData || {};
    } catch {
      return {};
    }
  }

  async copy(sourcePath: string, destinationPath: string): Promise<void> {
    await this.client.copyObject(
      this.bucketName,
      destinationPath,
      `/${this.bucketName}/${sourcePath}`
    );
  }

  async move(sourcePath: string, destinationPath: string): Promise<void> {
    await this.copy(sourcePath, destinationPath);
    await this.delete(sourcePath);
  }

  async uploadStream(
    stream: Readable,
    filePath: string,
    size: number,
    metadata?: Record<string, any>
  ): Promise<string> {
    const metaData = {
      'Content-Type': metadata?.contentType || 'application/octet-stream',
      ...metadata
    };

    await this.client.putObject(
      this.bucketName,
      filePath,
      stream,
      size,
      metaData
    );

    return `${this.baseUrl}/${this.bucketName}/${filePath}`;
  }

  async getPublicUrl(filePath: string): Promise<string> {
    return `${this.baseUrl}/${this.bucketName}/${filePath}`;
  }
}