// cloudinary.service.ts

import { Injectable } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { CloudinaryResponse } from './cloudinary-response';
const streamifier = require('streamifier');

@Injectable()
export class CloudinaryService {
  async uploadFile(file: Express.Multer.File): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: process.env.CLOUDINARY_FOLDER, resource_type: 'auto' },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      );
      streamifier.createReadStream(file.buffer).pipe(uploadStream);
    });
  }

  async uploadFiles(
    files: Express.Multer.File[]
  ): Promise<CloudinaryResponse[]> {
    const uploadPromises = files.map((file, index) =>
      this.uploadFile(file).then((result) => ({
        url: result.secure_url,
        publicId: result.public_id,
        sortOrder: file.mimetype.startsWith('image/') ? index : null,
      }))
    );

    return await Promise.all(uploadPromises);
  }

  async deleteMultipleFiles(publicIds: string[]): Promise<void> {
    if (publicIds.length === 0) return;
    const deletePromises = publicIds.map((id) =>
      cloudinary.uploader
        .destroy(id)
        .catch((err) => console.error(`Failed to delete ${id}:`, err))
    );
    await Promise.allSettled(deletePromises);
  }
}
