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
import { PengkurbanService } from './pengkurban.service';
import { PublicRegisterDto } from './dto/public-register.dto';
import { PRICING } from '../common/pricing.constants';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

@Controller('api/public')
export class PublicPengkurbanController {
  constructor(private pengkurbanService: PengkurbanService) {}

  @Post('register')
  register(@Body() dto: PublicRegisterDto) {
    return this.pengkurbanService.registerPublic(dto);
  }

  @Post('register/:id/payment-proof')
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
  uploadPaymentProof(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('File bukti pembayaran wajib diunggah');
    }
    return this.pengkurbanService.attachPaymentProof(id, file);
  }

  @Get('register/by-phone/:phone')
  getByPhone(@Param('phone') phone: string) {
    return this.pengkurbanService.findByPhone(phone);
  }

  @Get('register/:id')
  getStatus(@Param('id', ParseUUIDPipe) id: string) {
    return this.pengkurbanService.findPublicStatus(id);
  }

  @Get('pricing')
  getPricing() {
    return PRICING;
  }
}
