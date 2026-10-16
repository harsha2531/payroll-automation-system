import Link from "next/link";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { LogoutButton } from "./logout-button";
import { AuthService } from "@/services/auth.service";

export async function AuthButton() {
  const { user, profile } = await AuthService.getCurrentUserWithProfile();

  return user && profile ? (
    <div className="flex items-center gap-3">
      <span className="text-sm text-muted-foreground hidden sm:inline">
        Signed in as <strong className="text-foreground font-medium">{profile.email}</strong>
      </span>
      {profile.role === "admin" && (
        <Badge
          variant="outline"
          className="capitalize text-xs font-semibold text-emerald-600 dark:text-emerald-400 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
        >
          admin
        </Badge>
      )}
      <LogoutButton />
    </div>
  ) : (
    <div className="flex gap-2">
      <Button asChild size="sm" variant={"outline"}>
        <Link href="/auth/login">Sign in</Link>
      </Button>
      <Button asChild size="sm" variant={"default"}>
        <Link href="/auth/sign-up">Sign up</Link>
      </Button>
    </div>
  );
}
