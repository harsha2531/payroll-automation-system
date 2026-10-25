"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, RefreshCw } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard render error:", error);
  }, [error]);

  return (
    <div className="flex-1 w-full flex items-center justify-center p-6 min-h-[50vh]">
      <Card className="max-w-md w-full border-destructive/20 shadow-md">
        <CardHeader>
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-6 w-6 shrink-0" />
            <CardTitle>Error Loading Dashboard</CardTitle>
          </div>
          <CardDescription>
            An error occurred while loading payroll metrics and activity.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground bg-muted p-3 rounded-md font-mono break-all">
            {error.message || "An unexpected error occurred while fetching dashboard data."}
          </p>
          <Button onClick={reset} className="w-full">
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
