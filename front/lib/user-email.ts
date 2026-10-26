import { z } from "zod";

const standardEmail = z.string().email();
// Keep this institutional exception aligned with the backend user validator.
const INSTITUTIONAL_EMAIL = /^[a-z0-9!#$%&'*+/=?^_\x60{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_\x60{|}~-]+)*\.@docente\.edu\.do$/i;

export function isUserEmail(value: string): boolean {
  return standardEmail.safeParse(value).success ||
    (INSTITUTIONAL_EMAIL.test(value) && value.indexOf("@") <= 64);
}

export const userEmailSchema = z.string().trim().toLowerCase().refine(isUserEmail, "Introduce un correo válido.");
