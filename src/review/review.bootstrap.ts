import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { newReviewCode } from '../common/utils/review-code';
import { Location } from '../locations/location.entity';

@Injectable()
export class ReviewBootstrap implements OnModuleInit {
  private readonly logger = new Logger(ReviewBootstrap.name);

  constructor(
    @InjectRepository(Location)
    private readonly locations: Repository<Location>,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.config.get<string>('NODE_ENV') === 'test') return;

    const missing = await this.locations.find({ where: { reviewCode: IsNull() }, take: 200 });
    for (const row of missing) {
      row.reviewCode = await this.uniqueCode();
      await this.locations.save(row);
    }
    if (missing.length) {
      this.logger.log(`Assigned review codes to ${missing.length} location(s)`);
    }
  }

  private async uniqueCode(): Promise<string> {
    for (let attempt = 0; attempt < 8; attempt++) {
      const code = newReviewCode();
      const exists = await this.locations.exist({ where: { reviewCode: code } });
      if (!exists) return code;
    }
    return newReviewCode(10);
  }
}
