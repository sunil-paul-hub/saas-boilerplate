import { PipeTransform } from '@nestjs/common';
import type { ZodTypeAny } from 'zod';

export class ZodPipe implements PipeTransform {
  constructor(private readonly schema: ZodTypeAny) {}
  transform(value: unknown) {
    return this.schema.parse(value ?? {});
  }
}
