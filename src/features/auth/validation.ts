import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Email is required")
  .email("Please enter a valid email address");

export const passwordSchema = z
  .string()
  .min(6, "Password must be at least 6 characters long")
  .max(72, "Password must not exceed 72 characters");

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

export const signUpSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Please confirm your password"),
    fullName: z.string().trim().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const updatePasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>;

export type ValidationResult<T> =
  | { success: true; data: T; errors?: never }
  | { success: false; errors: Record<string, string>; data?: never };

export function validateLoginInput(input: unknown): ValidationResult<LoginInput> {
  const result = loginSchema.safeParse(input);
  if (!result.success) {
    const errors: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const field = issue.path[0]?.toString() || "form";
      if (!errors[field]) {
        errors[field] = issue.message;
      }
    }
    return { success: false, errors };
  }
  return { success: true, data: result.data };
}

export function validateSignUpInput(input: unknown): ValidationResult<SignUpInput> {
  const result = signUpSchema.safeParse(input);
  if (!result.success) {
    const errors: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const field = issue.path[0]?.toString() || "form";
      if (!errors[field]) {
        errors[field] = issue.message;
      }
    }
    return { success: false, errors };
  }
  return { success: true, data: result.data };
}

export function validateForgotPasswordInput(
  input: unknown
): ValidationResult<ForgotPasswordInput> {
  const result = forgotPasswordSchema.safeParse(input);
  if (!result.success) {
    const errors: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const field = issue.path[0]?.toString() || "form";
      if (!errors[field]) {
        errors[field] = issue.message;
      }
    }
    return { success: false, errors };
  }
  return { success: true, data: result.data };
}

export function validateUpdatePasswordInput(
  input: unknown
): ValidationResult<UpdatePasswordInput> {
  const result = updatePasswordSchema.safeParse(input);
  if (!result.success) {
    const errors: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const field = issue.path[0]?.toString() || "form";
      if (!errors[field]) {
        errors[field] = issue.message;
      }
    }
    return { success: false, errors };
  }
  return { success: true, data: result.data };
}
