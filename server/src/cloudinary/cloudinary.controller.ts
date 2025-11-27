import {
  Controller,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
} from '@nestjs/swagger';
import { FilesUploadDto } from '../common/dto/file-upload.dto';
import { ApiResponse, ApiResponseError } from '../common/dto/reponse.dto';
import { CloudinaryResponse } from './cloudinary-response';
import { CloudinaryService } from './cloudinary.service';

@Controller('files')
export class CloudinaryController {
  constructor(private readonly cloudinaryService: CloudinaryService) {}

  @Post('uploads')
  @ApiOkResponse({
    type: ApiResponse<CloudinaryResponse[]>,
  })
  @ApiBadRequestResponse({
    description: 'Bad request',
    type: ApiResponseError,
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    type: FilesUploadDto,
  })
  @UseInterceptors(FilesInterceptor('files'))
  upload(@UploadedFiles() files: Express.Multer.File[]) {
    return this.cloudinaryService.uploadFiles(files);
  }
}
