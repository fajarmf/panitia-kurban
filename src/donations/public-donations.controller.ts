import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { DonationsService } from './donations.service';
import { CreateDonationDto } from './dto/create-donation.dto';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

@Controller('api/public')
export class PublicDonationsController {
  constructor(private donationsService: DonationsService) {}

  @Post('donate')
  @UseInterceptors(
    FileInterceptor('paymentProof', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException(
              'Hanya file gambar (jpeg, png, webp) yang diizinkan',
            ),
            false,
          );
        }
      },
    }),
  )
  submit(
    @Body() dto: CreateDonationDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.donationsService.submitPublic(dto, file);
  }

  @Get('donate/:id')
  getStatus(@Param('id', ParseUUIDPipe) id: string) {
    return this.donationsService.findPublicStatus(id);
  }
}
