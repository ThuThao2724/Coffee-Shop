import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { CommonModule } from '../../common/common.module';
import { KafkaModule } from '../../kafka/kafka.module';
import { ReportsController } from './reports.controller';
import { ReportsHealthController } from './reports-health.controller';
import { ReportsService } from './reports.service';
import { ReportsRealtimeService } from './reports-realtime.service';
import { ReportAggregationService } from './report-aggregation.service';

@Module({
  imports: [PrismaModule, CommonModule, KafkaModule],
  controllers: [ReportsController, ReportsHealthController],
  providers: [ReportsService, ReportsRealtimeService, ReportAggregationService],
})
export class ReportsModule {}

