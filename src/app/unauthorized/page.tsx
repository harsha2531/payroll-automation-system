import Link from "next/link";
import { Suspense } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "@/components/logout-button";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { AuthService } from "@/services/auth.service";

async function UnauthorizedUserNotice() {
  const { user, profile } = await AuthService.getCurrentUserWithProfile();

  if (!user || !profile) {
    return (
      <p className="text-sm text-muted-foreground">
        You are not authorized to view the requested administrator resource.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="p-3 bg-muted rounded-md text-xs space-y-1">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Account:</span>
          <span className="font-medium text-foreground">{profile.email}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Current Role:</span>
          <span className="font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            {profile.role}
          </span>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        Your account does not have administrator privileges. Only authorized system administrators are permitted to access the application dashboard and payroll management features.
      </p>
    </div>
  );
}

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-md">
        <Card className="border-amber-200 dark:border-amber-900 shadow-lg">
          <CardHeader>
            <div className="flex items-center gap-2.5 text-amber-600 dark:text-amber-500">
              <ShieldAlert className="h-6 w-6 flex-shrink-0" />
              <CardTitle className="text-xl">Access Restricted</CardTitle>
            </div>
            <CardDescription>
              Administrator privileges required to access this resource.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<p className="text-sm text-muted-foreground">Loading session details...</p>}>
              <UnauthorizedUserNotice />
            </Suspense>
          </CardContent>
          <CardFooter className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button asChild variant="outline" className="w-full sm:w-auto flex-1">
              <Link href="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Return to Home
              </Link>
            </Button>
            <LogoutButton variant="default" className="w-full sm:w-auto flex-1" />
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
