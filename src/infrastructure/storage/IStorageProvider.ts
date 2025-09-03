export interface IStorageProvider {
  upload(file: Buffer, path: string, metadata?: Record<string, any>): Promise<string>;
  download(path: string): Promise<Buffer>;
  delete(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  getSignedUrl(path: string, expiresIn?: number): Promise<string>;
  listFiles(prefix: string): Promise<string[]>;
  getMetadata(path: string): Promise<Record<string, any>>;
  copy(sourcePath: string, destinationPath: string): Promise<void>;
  move(sourcePath: string, destinationPath: string): Promise<void>;
}

export interface StorageConfig {
  provider: 'local' | 'azure' | 's3' | 'gcs';
  connectionString?: string;
  containerName?: string;
  bucketName?: string;
  region?: string;
  accessKey?: string;
  secretKey?: string;
  baseUrl?: string;
}