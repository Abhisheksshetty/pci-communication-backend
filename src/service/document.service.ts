import { IStorageProvider } from '../infrastructure/storage/IStorageProvider.js';
import { createProviderFactory } from '../infrastructure/ProviderFactory.js';
import crypto from 'crypto';
import path from 'path';

export interface DocumentMetadata {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
  uploadedAt: Date;
  category?: string;
  tags?: string[];
  checksum?: string;
  version?: number;
  parentId?: string;
}

export interface DocumentSearchCriteria {
  userId?: string;
  category?: string;
  tags?: string[];
  mimeType?: string;
  dateFrom?: Date;
  dateTo?: Date;
  minSize?: number;
  maxSize?: number;
}

export class DocumentService {
  private storage: IStorageProvider;
  private documents: Map<string, DocumentMetadata> = new Map();

  constructor(storage?: IStorageProvider) {
    this.storage = storage || createProviderFactory().getStorageProvider();
  }

  async uploadDocument(
    buffer: Buffer,
    originalName: string,
    userId: string,
    metadata?: Partial<DocumentMetadata>
  ): Promise<DocumentMetadata> {
    const documentId = this.generateDocumentId();
    const fileExtension = path.extname(originalName);
    const checksum = this.calculateChecksum(buffer);
    
    // Check for duplicates
    const existingDoc = await this.findByChecksum(checksum);
    if (existingDoc) {
      return existingDoc;
    }

    const filename = `${documentId}${fileExtension}`;
    const storagePath = `documents/${userId}/${this.getYearMonth()}/${filename}`;
    
    const docMetadata: DocumentMetadata = {
      id: documentId,
      filename: storagePath,
      originalName,
      mimeType: metadata?.mimeType || this.getMimeType(fileExtension),
      size: buffer.length,
      uploadedBy: userId,
      uploadedAt: new Date(),
      category: metadata?.category || 'general',
      tags: metadata?.tags || [],
      checksum,
      version: 1,
      parentId: metadata?.parentId
    };

    // Upload to storage
    await this.storage.upload(buffer, storagePath, {
      contentType: docMetadata.mimeType,
      originalName,
      uploadedBy: userId,
      checksum
    });

    // Store metadata
    this.documents.set(documentId, docMetadata);
    await this.saveMetadata(docMetadata);

    return docMetadata;
  }

  async getDocument(documentId: string): Promise<{ buffer: Buffer; metadata: DocumentMetadata }> {
    const metadata = await this.getMetadata(documentId);
    if (!metadata) {
      throw new Error('Document not found');
    }

    const buffer = await this.storage.download(metadata.filename);
    return { buffer, metadata };
  }

  async deleteDocument(documentId: string, userId: string): Promise<void> {
    const metadata = await this.getMetadata(documentId);
    if (!metadata) {
      throw new Error('Document not found');
    }

    if (metadata.uploadedBy !== userId) {
      throw new Error('Unauthorized to delete this document');
    }

    await this.storage.delete(metadata.filename);
    this.documents.delete(documentId);
    await this.removeMetadata(documentId);
  }

  async createVersion(
    documentId: string,
    buffer: Buffer,
    userId: string
  ): Promise<DocumentMetadata> {
    const parentDoc = await this.getMetadata(documentId);
    if (!parentDoc) {
      throw new Error('Parent document not found');
    }

    const newVersion = (parentDoc.version || 1) + 1;
    const versionedDoc = await this.uploadDocument(
      buffer,
      parentDoc.originalName,
      userId,
      {
        ...parentDoc,
        parentId: documentId,
        version: newVersion,
        category: parentDoc.category,
        tags: parentDoc.tags
      }
    );

    return versionedDoc;
  }

  async searchDocuments(criteria: DocumentSearchCriteria): Promise<DocumentMetadata[]> {
    const results: DocumentMetadata[] = [];
    
    for (const doc of this.documents.values()) {
      if (this.matchesCriteria(doc, criteria)) {
        results.push(doc);
      }
    }

    return results.sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
  }

  async getDocumentsByCategory(category: string): Promise<DocumentMetadata[]> {
    return this.searchDocuments({ category });
  }

  async getDocumentsByUser(userId: string): Promise<DocumentMetadata[]> {
    return this.searchDocuments({ userId });
  }

  async getDocumentVersions(documentId: string): Promise<DocumentMetadata[]> {
    const versions: DocumentMetadata[] = [];
    
    for (const doc of this.documents.values()) {
      if (doc.parentId === documentId || doc.id === documentId) {
        versions.push(doc);
      }
    }

    return versions.sort((a, b) => (a.version || 0) - (b.version || 0));
  }

  async shareDocument(
    documentId: string,
    userId: string,
    targetUserId: string,
    permissions: string[]
  ): Promise<string> {
    const metadata = await this.getMetadata(documentId);
    if (!metadata) {
      throw new Error('Document not found');
    }

    if (metadata.uploadedBy !== userId) {
      throw new Error('Unauthorized to share this document');
    }

    // Generate a signed URL for sharing
    const signedUrl = await this.storage.getSignedUrl(metadata.filename, 86400); // 24 hours
    
    // Here you would typically store the share information in a database
    // For now, we'll just return the URL
    return signedUrl;
  }

  async getDocumentUrl(documentId: string, expiresIn: number = 3600): Promise<string> {
    const metadata = await this.getMetadata(documentId);
    if (!metadata) {
      throw new Error('Document not found');
    }

    return await this.storage.getSignedUrl(metadata.filename, expiresIn);
  }

  async addTags(documentId: string, tags: string[]): Promise<void> {
    const metadata = await this.getMetadata(documentId);
    if (!metadata) {
      throw new Error('Document not found');
    }

    metadata.tags = [...new Set([...(metadata.tags || []), ...tags])];
    await this.saveMetadata(metadata);
  }

  async removeTags(documentId: string, tags: string[]): Promise<void> {
    const metadata = await this.getMetadata(documentId);
    if (!metadata) {
      throw new Error('Document not found');
    }

    metadata.tags = (metadata.tags || []).filter(tag => !tags.includes(tag));
    await this.saveMetadata(metadata);
  }

  async updateCategory(documentId: string, category: string): Promise<void> {
    const metadata = await this.getMetadata(documentId);
    if (!metadata) {
      throw new Error('Document not found');
    }

    metadata.category = category;
    await this.saveMetadata(metadata);
  }

  async getStatistics(userId?: string): Promise<{
    totalDocuments: number;
    totalSize: number;
    byCategory: Record<string, number>;
    byMimeType: Record<string, number>;
  }> {
    let documents = Array.from(this.documents.values());
    
    if (userId) {
      documents = documents.filter(doc => doc.uploadedBy === userId);
    }

    const stats = {
      totalDocuments: documents.length,
      totalSize: documents.reduce((sum, doc) => sum + doc.size, 0),
      byCategory: {} as Record<string, number>,
      byMimeType: {} as Record<string, number>
    };

    for (const doc of documents) {
      // By category
      const category = doc.category || 'uncategorized';
      stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
      
      // By mime type
      stats.byMimeType[doc.mimeType] = (stats.byMimeType[doc.mimeType] || 0) + 1;
    }

    return stats;
  }

  private generateDocumentId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  private calculateChecksum(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  private async findByChecksum(checksum: string): Promise<DocumentMetadata | null> {
    for (const doc of this.documents.values()) {
      if (doc.checksum === checksum) {
        return doc;
      }
    }
    return null;
  }

  private getYearMonth(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}/${month}`;
  }

  private getMimeType(extension: string): string {
    const mimeTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.txt': 'text/plain',
      '.csv': 'text/csv',
      '.json': 'application/json',
      '.xml': 'application/xml',
      '.zip': 'application/zip',
      '.rar': 'application/x-rar-compressed',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.mp4': 'video/mp4',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav'
    };

    return mimeTypes[extension.toLowerCase()] || 'application/octet-stream';
  }

  private matchesCriteria(doc: DocumentMetadata, criteria: DocumentSearchCriteria): boolean {
    if (criteria.userId && doc.uploadedBy !== criteria.userId) {
      return false;
    }

    if (criteria.category && doc.category !== criteria.category) {
      return false;
    }

    if (criteria.tags && criteria.tags.length > 0) {
      const docTags = doc.tags || [];
      if (!criteria.tags.some(tag => docTags.includes(tag))) {
        return false;
      }
    }

    if (criteria.mimeType && !doc.mimeType.includes(criteria.mimeType)) {
      return false;
    }

    if (criteria.dateFrom && doc.uploadedAt < criteria.dateFrom) {
      return false;
    }

    if (criteria.dateTo && doc.uploadedAt > criteria.dateTo) {
      return false;
    }

    if (criteria.minSize && doc.size < criteria.minSize) {
      return false;
    }

    if (criteria.maxSize && doc.size > criteria.maxSize) {
      return false;
    }

    return true;
  }

  private async saveMetadata(metadata: DocumentMetadata): Promise<void> {
    // In production, this would save to a database
    // For now, we're using in-memory storage
    this.documents.set(metadata.id, metadata);
  }

  private async getMetadata(documentId: string): Promise<DocumentMetadata | null> {
    // In production, this would fetch from a database
    return this.documents.get(documentId) || null;
  }

  private async removeMetadata(documentId: string): Promise<void> {
    // In production, this would delete from a database
    this.documents.delete(documentId);
  }
}