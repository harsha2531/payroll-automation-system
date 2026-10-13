"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useState, useTransition } from "react";
import { forgotPasswordAction } from "@/features/auth/actions";
import { validateForgotPasswordInput } from "@/features/auth/validation";
import { AlertCircle, CheckCircle2, Loader2, ArrowLeft } from "lucide-react";

export function ForgotPasswordForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSuccess, setIsSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleForgotPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const clientValidation = validateForgotPasswordInput({ email });
    if (!clientValidation.success) {
      setFieldErrors(clientValidation.errors);
      return;
    }

    startTransition(async () => {
      try {
        const result = await forgotPasswordAction({ email });

        if (!result.success) {
          if (result.fieldErrors) {
            setFieldErrors(result.fieldErrors);
          }
          setError(result.error ?? "Failed to request password reset.");
          return;
        }

        setIsSuccess(true);
      } catch (err: unknown) {
        setError(
          err instanceof Error
            ? err.message
            : "An unexpected error occurred while processing your request."
        );
      }
    });
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      {isSuccess ? (
        <Card className="shadow-md">
          <CardHeader className="space-y-1">
            <div className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
              <CardTitle className="text-xl font-bold">Check Your Email</CardTitle>
            </div>
            <CardDescription>
              Password reset link has been dispatched
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground leading-relaxed">
              If an account with the email <strong>{email}</strong> exists, you will receive an email shortly with a secure link to reset your password.
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link href="/auth/login" className="flex items-center justify-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Return to Login
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-md">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold tracking-tight">Reset Password</CardTitle>
            <CardDescription>
              Enter your email address and we&apos;ll send you a password recovery link
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleForgotPassword} noValidate>
              <div className="flex flex-col gap-5">
                {error && (
                  <div
                    role="alert"
                    className="flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive"
                  >
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@company.com"
                    autoComplete="email"
                    required
                    disabled={isPending}
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (fieldErrors.email) {
                        setFieldErrors((prev) => ({ ...prev, email: "" }));
                      }
                    }}
                    className={cn(fieldErrors.email && "border-destructive focus-visible:ring-destructive")}
                  />
                  {fieldErrors.email && (
                    <p className="text-xs text-destructive">{fieldErrors.email}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full mt-1"
                  disabled={isPending}
                >
                  {isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending reset link...
                    </>
                  ) : (
                    "Send Reset Link"
                  )}
                </Button>
              </div>

              <div className="mt-5 text-center text-xs text-muted-foreground">
                Remember your password?{" "}
                <Link
                  href="/auth/login"
                  className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
                >
                  Login
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
