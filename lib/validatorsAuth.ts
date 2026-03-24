import { z } from "zod";

export const PASSWORD_POLICY_ITEMS = [
  "Minimo de 12 caracteres.",
  "Pelo menos uma letra minuscula.",
  "Pelo menos uma letra maiuscula.",
  "Pelo menos um numero.",
  "Pelo menos um simbolo.",
] as const;

export const PASSWORD_POLICY_HINT = PASSWORD_POLICY_ITEMS.join(" ");

export const strongPasswordSchema = z
  .string()
  .trim()
  .min(12, "A senha deve ter no minimo 12 caracteres.")
  .max(72, "A senha pode ter no maximo 72 caracteres.")
  .regex(/[a-z]/, "A senha deve conter ao menos uma letra minuscula.")
  .regex(/[A-Z]/, "A senha deve conter ao menos uma letra maiuscula.")
  .regex(/\d/, "A senha deve conter ao menos um numero.")
  .regex(/[^A-Za-z0-9]/, "A senha deve conter ao menos um simbolo.");

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().email().toLowerCase().trim(),
  password: strongPasswordSchema,
});

export const loginSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(1).max(72),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
