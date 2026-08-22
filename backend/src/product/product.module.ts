import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProductController } from './product.controller';

@Module({
  imports: [AuthModule],
  controllers: [ProductController],
})
export class ProductModule {}
