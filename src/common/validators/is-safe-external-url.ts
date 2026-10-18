import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { isSafeExternalUrl } from '../utils/safe-external-url';

@ValidatorConstraint({ name: 'isSafeExternalUrl', async: false })
class IsSafeExternalUrlConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && isSafeExternalUrl(value);
  }

  defaultMessage(): string {
    return 'url must use http, https, mailto, or tel';
  }
}

export function IsSafeExternalUrl(options?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options,
      constraints: [],
      validator: IsSafeExternalUrlConstraint,
    });
  };
}
