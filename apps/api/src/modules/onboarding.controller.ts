import { Body, Controller, HttpCode, Inject, Post } from '@nestjs/common';
import { onboardingRequestBody, type OnboardingRequestBody } from '@base/contracts';
import { Public, Req0, type ApiRequest } from '../common/context.js';
import { ApiError } from '../common/errors.js';
import { RateLimiter } from '../common/rate-limit.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { DbService } from '../db/db.service.js';

@Controller('onboarding')
export class OnboardingController {
  private readonly limiter = new RateLimiter(10, 60 * 60 * 1000);
  constructor(@Inject(DbService) private readonly db: DbService) {}

  @Public() @Post('requests') @HttpCode(201)
  async submit(@Body(new ZodPipe(onboardingRequestBody)) b: OnboardingRequestBody, @Req0() req: ApiRequest) {
    const key = req.ip ?? 'anon';
    if (this.limiter.blocked(key)) throw new ApiError(429, 'rate_limited', 'Too many requests. Try again later.');
    this.limiter.fail(key);
    const r = await this.db.app.query('SELECT app_private.submit_onboarding_request($1,$2,$3,$4) AS id',
      [b.orgName, b.contactName, b.contactEmail, JSON.stringify(b.details ?? {})]);
    return { id: r.rows[0].id as string, status: 'pending' };
  }
}
