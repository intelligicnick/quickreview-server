import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessMember } from './business-member.entity';
import { MembersService } from './members.service';

@Module({
  imports: [TypeOrmModule.forFeature([BusinessMember])],
  providers: [MembersService],
  exports: [MembersService, TypeOrmModule],
})
export class MembersModule {}
