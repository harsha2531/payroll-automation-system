import Link from "next/link";
import { AuthService } from "@/services/auth.service";
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
  Lock,
} from "lucide-react";

export default async function ProtectedPage() {
  // Server-side authorization check: strictly enforces admin role outside of Suspense
  const { profile } = await AuthService.requireAdmin();

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
            <Badge variant="default" className="capitalize bg-emerald-600 hover:bg-emerald-700">
              <Lock className="h-3 w-3 mr-1" />
              {profile.role}
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Payroll Automation System &bull; Secure Administrator Dashboard
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

      {/* Session & Authorization Status Banner */}
      <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 flex items-center gap-3 text-emerald-800 dark:text-emerald-200 text-sm">
        <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
        <div>
          <span className="font-semibold">Administrator Authorization Verified</span>
          <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
            Your identity and admin permissions are verified server-side against the trusted database profiles table with Row Level Security.
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
              <CardTitle>Administrator Profile</CardTitle>
            </div>
            <CardDescription>
              Verified credentials from trusted public.profiles database table
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
              <span className="text-muted-foreground">Authorization Role</span>
              <Badge variant="outline" className="capitalize font-semibold text-emerald-600 dark:text-emerald-400 border-emerald-500">
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
              <CardTitle>Security &amp; Privilege Guard</CardTitle>
            </div>
            <CardDescription>
              Session details and server-side privilege level
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
              <span className="text-muted-foreground">Access Control</span>
              <span className="font-medium text-foreground">Server-enforced RBAC + RLS</span>
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
