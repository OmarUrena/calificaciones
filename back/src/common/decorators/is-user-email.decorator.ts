import { isEmail, ValidateBy, ValidationOptions } from 'class-validator';

// Institutional accounts may end their local part with one dot before @.
const INSTITUTIONAL_EMAIL =
  /^[a-z0-9!#$%&'*+/=?^_\x60{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_\x60{|}~-]+)*\.@docente\.edu\.do$/i;

export function isUserEmail(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  return isEmail(value) || (INSTITUTIONAL_EMAIL.test(value) && value.indexOf('@') <= 64);
}

export function IsUserEmail(options?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isUserEmail',
      validator: {
        validate: isUserEmail,
        defaultMessage: () => 'Introduce un correo válido.',
      },
    },
    options,
  );
}
