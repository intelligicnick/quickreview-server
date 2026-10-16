import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { CounterSaleProvisionerContext } from '../guards/counter-sale-provisioner.guard';

export const CounterSaleProvisioner = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CounterSaleProvisionerContext => {
    const request = ctx.switchToHttp().getRequest<{ counterSaleProvisioner: CounterSaleProvisionerContext }>();
    return request.counterSaleProvisioner;
  },
);
