import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function DashboardLoading() {
  return (
    <div className="flex-1 w-full flex flex-col gap-8 pb-10 animate-pulse">
      {/* Top Banner Skeleton */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-border">
        <div className="space-y-2">
          <div className="h-8 w-64 bg-muted rounded-md" />
          <div className="h-4 w-96 bg-muted/60 rounded-md" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-28 bg-muted rounded-md" />
          <div className="h-9 w-28 bg-muted rounded-md" />
        </div>
      </div>

      {/* 4 Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="h-4 w-24 bg-muted rounded" />
              <div className="h-8 w-8 bg-muted rounded-md" />
            </CardHeader>
            <CardContent className="space-y-3 pt-2">
              <div className="h-8 w-16 bg-muted rounded" />
              <div className="h-3 w-32 bg-muted/60 rounded" />
              <div className="pt-3 border-t border-border flex justify-between">
                <div className="h-3 w-20 bg-muted/40 rounded" />
                <div className="h-3 w-16 bg-muted/40 rounded" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Activity Skeleton */}
      <div className="space-y-4">
        <div className="h-6 w-48 bg-muted rounded" />
        <Card className="p-6">
          <div className="space-y-3">
            <div className="h-10 bg-muted/40 rounded" />
            <div className="h-12 bg-muted/20 rounded" />
            <div className="h-12 bg-muted/20 rounded" />
            <div className="h-12 bg-muted/20 rounded" />
          </div>
        </Card>
      </div>
    </div>
  );
}
