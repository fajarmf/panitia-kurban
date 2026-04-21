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
    return {
      domba: [
        { size: 'Tipe A', weight: '30 kg', price: 2950000 },
        { size: 'Tipe B', weight: '40 kg', price: 3950000 },
        { size: 'Tipe C', weight: '50 kg', price: 4950000 },
        {
          size: 'Super',
          weight: '60-90 kg',
          priceMin: 5600000,
          priceMax: 9000000,
        },
        { size: 'Istimewa', weight: '>100 kg', priceNote: 'hubungi panitia' },
      ],
      kambing: [
        { size: 'Tipe A', weight: '30 kg', price: 3000000 },
        { size: 'Tipe B', weight: '40 kg', price: 3950000 },
        { size: 'Tipe C', weight: '50 kg', price: 5000000 },
        {
          size: 'Super',
          weight: '60-90 kg',
          priceMin: 5650000,
          priceMax: 9200000,
        },
        { size: 'Istimewa', weight: '>100 kg', priceNote: 'hubungi panitia' },
      ],
      sapiKolektif: {
        perOrang: 4000000,
        orangPerEkor: 7,
        beratSapi: '350-400 kg',
        jenisSapi: 'Sapi Bali',
      },
      sapiPerorangan: {
        pricePerKg: { min: 65000, max: 80000 },
        note: 'Kisaran harga Rp 65.000 – 80.000/kg',
      },
      infaqOperasional: {
        dombaKambing: 300000,
        sapiKolektifPerOrang: 300000,
        sapiPerorangan: 1750000,
      },
      rekening: {
        bank: 'Bank Muamalat',
        nomor: '12 1010 4479',
        atasNama: 'Masjid Al Hijrah CGE 11',
      },
    };
  }
}
