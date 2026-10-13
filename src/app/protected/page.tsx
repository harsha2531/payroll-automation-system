import { redirect } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { mapUserProfile } from "@/features/auth/profile";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "@/components/logout-button";
import {
  CheckCircle2,
  KeyRound,
  Mail,
  ShieldCheck,
  User as UserIcon,
  Calendar,
} from "lucide-react";

async function ProtectedDashboardContent() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/auth/login");
  }

  const profile = mapUserProfile(user);

  const formattedCreatedAt = profile.createdAt
    ? new Date(profile.createdAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Unknown";

  const formattedLastSignIn = profile.lastSignInAt
    ? new Date(profile.lastSignInAt).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "First session";

  return (
    <div className="flex-1 w-full flex flex-col gap-8">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">
              Welcome back, {profile.displayName}
            </h1>
            <Badge variant="secondary" className="capitalize">
              {profile.role}
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Payroll Automation System &bull; Secure authenticated dashboard
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="sm">
            <Link href="/auth/update-password">
              <KeyRound className="h-4 w-4 mr-2" />
              Change Password
            </Link>
          </Button>
          <LogoutButton />
        </div>
      </div>

      {/* Session Status Banner */}
      <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 flex items-center gap-3 text-emerald-800 dark:text-emerald-200 text-sm">
        <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
        <div>
          <span className="font-semibold">Authenticated Session Verified</span>
          <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
            Your session cookies are validated server-side by Supabase SSR with encrypted cookie refresh.
          </p>
        </div>
      </div>

      {/* Profile & Account Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* User Profile Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <UserIcon className="h-5 w-5 text-primary" />
              <CardTitle>User Profile</CardTitle>
            </div>
            <CardDescription>
              Basic profile information retrieved from Supabase Auth
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between py-2 border-b text-sm">
              <span className="text-muted-foreground">Display Name</span>
              <span className="font-medium text-foreground">{profile.displayName}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b text-sm">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Mail className="h-4 w-4" />
                Email
              </span>
              <span className="font-medium text-foreground">{profile.email}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b text-sm">
              <span className="text-muted-foreground">System Role</span>
              <Badge variant="outline" className="capitalize">
                {profile.role}
              </Badge>
            </div>
            <div className="flex items-center justify-between py-2 text-sm">
              <span className="text-muted-foreground">User ID</span>
              <span className="font-mono text-xs text-muted-foreground truncate max-w-[220px]" title={profile.id}>
                {profile.id}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Security & Activity Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <CardTitle>Security &amp; Activity</CardTitle>
            </div>
            <CardDescription>
              Authentication status and session details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between py-2 border-b text-sm">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                Account Created
              </span>
              <span className="font-medium text-foreground">{formattedCreatedAt}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b text-sm">
              <span className="text-muted-foreground">Last Sign-in</span>
              <span className="font-medium text-foreground">{formattedLastSignIn}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b text-sm">
              <span className="text-muted-foreground">Authentication Method</span>
              <span className="font-medium text-foreground">Email &amp; Password (SSR)</span>
            </div>
            <div className="pt-2 flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Manage Credentials</span>
              <Link
                href="/auth/update-password"
                className="text-primary hover:underline text-xs font-medium"
              >
                Update password &rarr;
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function ProtectedPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 w-full flex items-center justify-center p-12 text-sm text-muted-foreground">
          Loading protected session...
        </div>
      }
    >
      <ProtectedDashboardContent />
    </Suspense>
  );
}
