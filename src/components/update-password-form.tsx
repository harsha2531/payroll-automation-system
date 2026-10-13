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
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updatePasswordAction } from "@/features/auth/actions";
import { validateUpdatePasswordInput } from "@/features/auth/validation";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

export function UpdatePasswordForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSuccess, setIsSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleUpdatePassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const clientValidation = validateUpdatePasswordInput({
      password,
      confirmPassword,
    });

    if (!clientValidation.success) {
      setFieldErrors(clientValidation.errors);
      return;
    }

    startTransition(async () => {
      try {
        const result = await updatePasswordAction({
          password,
          confirmPassword,
        });

        if (!result.success) {
          if (result.fieldErrors) {
            setFieldErrors(result.fieldErrors);
          }
          setError(result.error ?? "Failed to update password.");
          return;
        }

        setIsSuccess(true);
        setTimeout(() => {
          router.push("/protected");
          router.refresh();
        }, 1200);
      } catch (err: unknown) {
        setError(
          err instanceof Error
            ? err.message
            : "An unexpected error occurred while updating your password."
        );
      }
    });
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="shadow-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold tracking-tight">Set New Password</CardTitle>
          <CardDescription>
            Choose a new secure password for your payroll account
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isSuccess ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500 animate-in zoom-in" />
              <p className="text-sm font-medium text-foreground">
                Password updated successfully!
              </p>
              <p className="text-xs text-muted-foreground">
                Redirecting to your dashboard...
              </p>
            </div>
          ) : (
            <form onSubmit={handleUpdatePassword} noValidate>
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
                  <Label htmlFor="password">New Password</Label>
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
                  <Label htmlFor="confirm-password">Confirm New Password</Label>
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
                      Saving password...
                    </>
                  ) : (
                    "Save New Password"
                  )}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
