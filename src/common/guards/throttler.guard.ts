import { ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';
import { Injectable, ExecutionContext } from '@nestjs/common';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  protected async throwThrottlingException(
    context: ExecutionContext,
    throttlerLimitDetail: any,
  ): Promise<void> {
    throw new ThrottlerException(
      `Rate limit exceeded. Try again in ${Math.ceil(
        throttlerLimitDetail.timeToExpire / 1000,
      )} seconds.`,
    );
  }

  // Use IP + user ID as key when authenticated
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const userId = req.user?.sub;
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    return userId ? `${userId}:${ip}` : ip;
  }
}