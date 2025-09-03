import { IStorageProvider } from './IStorageProvider.js';

export class AzureBlobProvider implements IStorageProvider {
  private connectionString: string;
  private containerName: string;

  constructor(connectionString: string, containerName: string) {
    this.connectionString = connectionString;
    this.containerName = containerName;
  }

  async upload(file: Buffer, path: string, metadata?: Record<string, any>): Promise<string> {
    console.log('Azure Blob Storage upload - to be implemented');
    throw new Error('Azure Blob Storage provider not yet implemented');
  }

  async download(path: string): Promise<Buffer> {
    console.log('Azure Blob Storage download - to be implemented');
    throw new Error('Azure Blob Storage provider not yet implemented');
  }

  async delete(path: string): Promise<void> {
    console.log('Azure Blob Storage delete - to be implemented');
    throw new Error('Azure Blob Storage provider not yet implemented');
  }

  async exists(path: string): Promise<boolean> {
    console.log('Azure Blob Storage exists - to be implemented');
    throw new Error('Azure Blob Storage provider not yet implemented');
  }

  async getSignedUrl(path: string, expiresIn?: number): Promise<string> {
    console.log('Azure Blob Storage getSignedUrl - to be implemented');
    throw new Error('Azure Blob Storage provider not yet implemented');
  }

  async listFiles(prefix: string): Promise<string[]> {
    console.log('Azure Blob Storage listFiles - to be implemented');
    throw new Error('Azure Blob Storage provider not yet implemented');
  }

  async getMetadata(path: string): Promise<Record<string, any>> {
    console.log('Azure Blob Storage getMetadata - to be implemented');
    throw new Error('Azure Blob Storage provider not yet implemented');
  }

  async copy(sourcePath: string, destinationPath: string): Promise<void> {
    console.log('Azure Blob Storage copy - to be implemented');
    throw new Error('Azure Blob Storage provider not yet implemented');
  }

  async move(sourcePath: string, destinationPath: string): Promise<void> {
    console.log('Azure Blob Storage move - to be implemented');
    throw new Error('Azure Blob Storage provider not yet implemented');
  }
}