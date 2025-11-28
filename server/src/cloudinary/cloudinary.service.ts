// cloudinary.service.ts

import { Injectable } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryResponse } from './cloudinary-response';
const streamifier = require('streamifier');

@Injectable()
export class CloudinaryService {
  async uploadFile(file: Express.Multer.File): Promise<CloudinaryResponse> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: process.env.CLOUDINARY_FOLDER, resource_type: 'auto' },
        (error, result) => {
          if (error) return reject(error);
          resolve({
            publicId: result.public_id,
            url: result.url,
          });
        }
      );
      streamifier.createReadStream(file.buffer).pipe(uploadStream);
    });
  }

  async uploadFiles(
    files: Express.Multer.File[]
  ): Promise<CloudinaryResponse[]> {
    const uploadPromises = files.map((file) => this.uploadFile(file));

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

  async deleteFile(publicId: string): Promise<void> {
    if(!publicId) return;
    await cloudinary.uploader.destroy(publicId);
  }
}
