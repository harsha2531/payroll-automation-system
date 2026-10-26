"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setEmployeeStatusAction } from "@/features/employees/actions";
import type { EmployeeStatus } from "@/types/payroll";

interface EmployeeStatusToggleProps {
  employeeId: string;
  status: EmployeeStatus;
}

export function EmployeeStatusToggle({
  employeeId,
  status,
}: EmployeeStatusToggleProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isActive = status === "active";
  const nextStatus = isActive ? "inactive" : "active";
  const label = isActive ? "Deactivate" : "Activate";

  const handleClick = () => {
    setError(null);
    startTransition(async () => {
      const result = await setEmployeeStatusAction(employeeId, nextStatus);
      if (!result.success) {
        setError(result.error ?? "Failed to update status.");
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant={isActive ? "outline" : "default"}
        size="sm"
        disabled={isPending}
        onClick={handleClick}
      >
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Updating…
          </>
        ) : (
          label
        )}
      </Button>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
