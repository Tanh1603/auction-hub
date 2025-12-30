import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UserService } from './user.service'; // Keep for promotion functionality
import { AuthController } from './auth.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [PrismaModule, SupabaseModule],
  providers: [AuthService, UserService], // Keep UserService for admin promotion
  controllers: [AuthController],
  exports: [AuthService, UserService],
})
export class AuthModule {}
