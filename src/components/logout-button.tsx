"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/features/auth/actions";
import { Loader2, LogOut } from "lucide-react";

interface LogoutButtonProps {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  showIcon?: boolean;
}

export function LogoutButton({
  variant = "outline",
  size = "sm",
  className,
  showIcon = true,
}: LogoutButtonProps) {
  const [isPending, startTransition] = useTransition();

  const handleLogout = () => {
    startTransition(async () => {
      await logoutAction();
    });
  };

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={handleLogout}
      disabled={isPending}
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
      ) : showIcon ? (
        <LogOut className="h-4 w-4 mr-1.5" />
      ) : null}
      {isPending ? "Logging out..." : "Logout"}
    </Button>
  );
}

