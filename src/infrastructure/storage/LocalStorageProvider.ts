import { IStorageProvider } from './IStorageProvider.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import crypto from 'crypto';

export class LocalStorageProvider implements IStorageProvider {
  private basePath: string;
  private baseUrl: string;

  constructor(basePath: string = './uploads', baseUrl: string = '/api/files') {
    this.basePath = path.resolve(basePath);
    this.baseUrl = baseUrl;
    this.ensureBaseDirectory();
  }

  private async ensureBaseDirectory(): Promise<void> {
    try {
      await fs.access(this.basePath);
    } catch {
      await fs.mkdir(this.basePath, { recursive: true });
    }
  }

  async upload(file: Buffer, filePath: string, metadata?: Record<string, any>): Promise<string> {
    const fullPath = path.join(this.basePath, filePath);
    const directory = path.dirname(fullPath);

    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(fullPath, file);

    if (metadata) {
      const metaPath = `${fullPath}.meta.json`;
      await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2));
    }

    return `${this.baseUrl}/${filePath.replace(/\\/g, '/')}`;
  }

  async download(filePath: string): Promise<Buffer> {
    const fullPath = path.join(this.basePath, filePath);
    return await fs.readFile(fullPath);
  }

  async delete(filePath: string): Promise<void> {
    const fullPath = path.join(this.basePath, filePath);
    
    try {
      await fs.unlink(fullPath);
      
      const metaPath = `${fullPath}.meta.json`;
      try {
        await fs.unlink(metaPath);
      } catch {}
    } catch (error) {
      if ((error as any).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async exists(filePath: string): Promise<boolean> {
    const fullPath = path.join(this.basePath, filePath);
    
    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  async getSignedUrl(filePath: string, expiresIn: number = 3600): Promise<string> {
    const token = crypto.randomBytes(16).toString('hex');
    const expiry = Date.now() + (expiresIn * 1000);
    
    return `${this.baseUrl}/${filePath.replace(/\\/g, '/')}?token=${token}&expires=${expiry}`;
  }

  async listFiles(prefix: string): Promise<string[]> {
    const fullPath = path.join(this.basePath, prefix);
    const files: string[] = [];

    async function walkDir(dir: string, baseDir: string): Promise<void> {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const entryPath = path.join(dir, entry.name);
          
          if (entry.isDirectory()) {
            await walkDir(entryPath, baseDir);
          } else if (!entry.name.endsWith('.meta.json')) {
            const relativePath = path.relative(baseDir, entryPath);
            files.push(relativePath.replace(/\\/g, '/'));
          }
        }
      } catch (error) {
        if ((error as any).code !== 'ENOENT') {
          throw error;
        }
      }
    }

    await walkDir(fullPath, this.basePath);
    return files;
  }

  async getMetadata(filePath: string): Promise<Record<string, any>> {
    const fullPath = path.join(this.basePath, filePath);
    const metaPath = `${fullPath}.meta.json`;
    
    try {
      const metaContent = await fs.readFile(metaPath, 'utf-8');
      return JSON.parse(metaContent);
    } catch {
      return {};
    }
  }

  async copy(sourcePath: string, destinationPath: string): Promise<void> {
    const sourceFullPath = path.join(this.basePath, sourcePath);
    const destFullPath = path.join(this.basePath, destinationPath);
    const destDirectory = path.dirname(destFullPath);

    await fs.mkdir(destDirectory, { recursive: true });
    await fs.copyFile(sourceFullPath, destFullPath);

    const metaSourcePath = `${sourceFullPath}.meta.json`;
    const metaDestPath = `${destFullPath}.meta.json`;
    
    try {
      await fs.copyFile(metaSourcePath, metaDestPath);
    } catch {}
  }

  async move(sourcePath: string, destinationPath: string): Promise<void> {
    const sourceFullPath = path.join(this.basePath, sourcePath);
    const destFullPath = path.join(this.basePath, destinationPath);
    const destDirectory = path.dirname(destFullPath);

    await fs.mkdir(destDirectory, { recursive: true });
    await fs.rename(sourceFullPath, destFullPath);

    const metaSourcePath = `${sourceFullPath}.meta.json`;
    const metaDestPath = `${destFullPath}.meta.json`;
    
    try {
      await fs.rename(metaSourcePath, metaDestPath);
    } catch {}
  }
}