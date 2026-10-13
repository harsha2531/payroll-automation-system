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
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { signUpAction } from "@/features/auth/actions";
import { validateSignUpInput } from "@/features/auth/validation";
import { AlertCircle, Loader2 } from "lucide-react";

export function SignUpForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const clientValidation = validateSignUpInput({
      email,
      fullName,
      password,
      confirmPassword,
    });

    if (!clientValidation.success) {
      setFieldErrors(clientValidation.errors);
      return;
    }

    startTransition(async () => {
      try {
        const result = await signUpAction({
          email,
          fullName,
          password,
          confirmPassword,
        });

        if (!result.success) {
          if (result.fieldErrors) {
            setFieldErrors(result.fieldErrors);
          }
          setError(result.error ?? "Failed to create account. Please try again.");
          return;
        }

        if (result.data?.emailConfirmationRequired) {
          router.push("/auth/sign-up-success");
        } else {
          router.push("/protected");
          router.refresh();
        }
      } catch (err: unknown) {
        setError(
          err instanceof Error
            ? err.message
            : "An unexpected error occurred during registration."
        );
      }
    });
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="shadow-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold tracking-tight">Create Account</CardTitle>
          <CardDescription>
            Register to join the payroll automation system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignUp} noValidate>
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
                <Label htmlFor="full-name">Full Name (Optional)</Label>
                <Input
                  id="full-name"
                  type="text"
                  placeholder="Jane Doe"
                  autoComplete="name"
                  disabled={isPending}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>

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

              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                  disabled={isPending}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (fieldErrors.password) {
                      setFieldErrors((prev) => ({ ...prev, password: "" }));
                    }
                  }}
                  className={cn(fieldErrors.password && "border-destructive focus-visible:ring-destructive")}
                />
                {fieldErrors.password && (
                  <p className="text-xs text-destructive">{fieldErrors.password}</p>
                )}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                  disabled={isPending}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (fieldErrors.confirmPassword) {
                      setFieldErrors((prev) => ({ ...prev, confirmPassword: "" }));
                    }
                  }}
                  className={cn(
                    fieldErrors.confirmPassword && "border-destructive focus-visible:ring-destructive"
                  )}
                />
                {fieldErrors.confirmPassword && (
                  <p className="text-xs text-destructive">{fieldErrors.confirmPassword}</p>
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
                    Creating account...
                  </>
                ) : (
                  "Create Account"
                )}
              </Button>
            </div>

            <div className="mt-5 text-center text-xs text-muted-foreground">
              Already have an account?{" "}
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
    </div>
  );
}
