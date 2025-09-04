import sharp from 'sharp';
import { IStorageProvider } from '../infrastructure/storage/IStorageProvider.js';
import { createProviderFactory } from '../infrastructure/ProviderFactory.js';

export interface ImageSize {
  width: number;
  height: number;
  suffix: string;
}

export interface ImageOptimizationOptions {
  quality?: number;
  format?: 'jpeg' | 'webp' | 'png' | 'avif';
  sizes?: ImageSize[];
}

export class ImageService {
  private storage: IStorageProvider;
  
  private readonly defaultSizes: ImageSize[] = [
    { width: 150, height: 150, suffix: 'thumb' },
    { width: 400, height: 400, suffix: 'small' },
    { width: 800, height: 800, suffix: 'medium' },
    { width: 1200, height: 1200, suffix: 'large' }
  ];

  constructor(storage?: IStorageProvider) {
    this.storage = storage || createProviderFactory().getStorageProvider();
  }

  async optimizeImage(
    buffer: Buffer,
    filename: string,
    options: ImageOptimizationOptions = {}
  ): Promise<{ original: string; optimized: Record<string, string> }> {
    const quality = options.quality || 80;
    const format = options.format || 'webp';
    const sizes = options.sizes || this.defaultSizes;
    
    const baseName = filename.replace(/\.[^/.]+$/, '');
    const timestamp = Date.now();
    const optimized: Record<string, string> = {};

    // Upload original
    const originalPath = `images/original/${timestamp}_${filename}`;
    const originalUrl = await this.storage.upload(buffer, originalPath, {
      contentType: `image/${this.getOriginalFormat(filename)}`
    });

    // Generate and upload optimized versions
    for (const size of sizes) {
      try {
        const optimizedBuffer = await sharp(buffer)
          .resize(size.width, size.height, {
            fit: 'inside',
            withoutEnlargement: true
          })
          .toFormat(format, { quality })
          .toBuffer();

        const optimizedPath = `images/optimized/${timestamp}_${baseName}_${size.suffix}.${format}`;
        const url = await this.storage.upload(optimizedBuffer, optimizedPath, {
          contentType: `image/${format}`,
          width: size.width,
          height: size.height
        });

        optimized[size.suffix] = url;
      } catch (error) {
        console.error(`Error optimizing image for size ${size.suffix}:`, error);
      }
    }

    return { original: originalUrl, optimized };
  }

  async generateThumbnail(
    buffer: Buffer,
    width: number = 200,
    height: number = 200
  ): Promise<Buffer> {
    return await sharp(buffer)
      .resize(width, height, {
        fit: 'cover',
        position: 'center'
      })
      .toBuffer();
  }

  async cropImage(
    buffer: Buffer,
    crop: { x: number; y: number; width: number; height: number }
  ): Promise<Buffer> {
    return await sharp(buffer)
      .extract({
        left: crop.x,
        top: crop.y,
        width: crop.width,
        height: crop.height
      })
      .toBuffer();
  }

  async rotateImage(buffer: Buffer, angle: number): Promise<Buffer> {
    return await sharp(buffer)
      .rotate(angle)
      .toBuffer();
  }

  async getImageMetadata(buffer: Buffer): Promise<sharp.Metadata> {
    return await sharp(buffer).metadata();
  }

  async compressImage(
    buffer: Buffer,
    targetSizeKB: number
  ): Promise<Buffer> {
    let quality = 90;
    let compressed = buffer;
    let currentSize = buffer.length / 1024; // Convert to KB

    while (currentSize > targetSizeKB && quality > 10) {
      compressed = await sharp(buffer)
        .jpeg({ quality })
        .toBuffer();
      
      currentSize = compressed.length / 1024;
      quality -= 10;
    }

    return compressed;
  }

  async watermarkImage(
    buffer: Buffer,
    watermarkBuffer: Buffer,
    position: 'center' | 'northwest' | 'northeast' | 'southwest' | 'southeast' = 'southeast'
  ): Promise<Buffer> {
    const image = sharp(buffer);
    const metadata = await image.metadata();
    
    // Resize watermark to be proportional to the main image
    const watermarkSize = Math.min(metadata.width! * 0.2, 200);
    const resizedWatermark = await sharp(watermarkBuffer)
      .resize(watermarkSize, watermarkSize, { fit: 'inside' })
      .toBuffer();

    return await image
      .composite([{
        input: resizedWatermark,
        gravity: position
      }])
      .toBuffer();
  }

  async convertFormat(
    buffer: Buffer,
    toFormat: 'jpeg' | 'png' | 'webp' | 'avif',
    options?: { quality?: number }
  ): Promise<Buffer> {
    const sharpInstance = sharp(buffer);
    
    switch (toFormat) {
      case 'jpeg':
        return await sharpInstance.jpeg({ quality: options?.quality || 80 }).toBuffer();
      case 'png':
        return await sharpInstance.png({ quality: options?.quality || 90 }).toBuffer();
      case 'webp':
        return await sharpInstance.webp({ quality: options?.quality || 80 }).toBuffer();
      case 'avif':
        return await sharpInstance.avif({ quality: options?.quality || 50 }).toBuffer();
      default:
        throw new Error(`Unsupported format: ${toFormat}`);
    }
  }

  private getOriginalFormat(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'jpg':
      case 'jpeg':
        return 'jpeg';
      case 'png':
        return 'png';
      case 'gif':
        return 'gif';
      case 'webp':
        return 'webp';
      case 'svg':
        return 'svg+xml';
      default:
        return 'jpeg';
    }
  }

  async processProfileImage(buffer: Buffer, userId: string): Promise<string> {
    // Generate a square profile image
    const processedBuffer = await sharp(buffer)
      .resize(400, 400, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ quality: 85 })
      .toBuffer();

    const filename = `profiles/${userId}_${Date.now()}.jpg`;
    return await this.storage.upload(processedBuffer, filename, {
      contentType: 'image/jpeg',
      purpose: 'profile'
    });
  }

  async generateImageVariants(
    buffer: Buffer,
    baseFilename: string
  ): Promise<Record<string, string>> {
    const variants: Record<string, string> = {};
    const timestamp = Date.now();
    const baseName = baseFilename.replace(/\.[^/.]+$/, '');

    // Original
    variants.original = await this.storage.upload(
      buffer,
      `images/original/${timestamp}_${baseFilename}`
    );

    // WebP variant for modern browsers
    const webpBuffer = await sharp(buffer)
      .webp({ quality: 85 })
      .toBuffer();
    variants.webp = await this.storage.upload(
      webpBuffer,
      `images/variants/${timestamp}_${baseName}.webp`,
      { contentType: 'image/webp' }
    );

    // AVIF variant for next-gen browsers
    const avifBuffer = await sharp(buffer)
      .avif({ quality: 50 })
      .toBuffer();
    variants.avif = await this.storage.upload(
      avifBuffer,
      `images/variants/${timestamp}_${baseName}.avif`,
      { contentType: 'image/avif' }
    );

    return variants;
  }
}