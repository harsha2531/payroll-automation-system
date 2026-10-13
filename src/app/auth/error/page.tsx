import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { Suspense } from "react";

async function ErrorContent({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="space-y-3">
      {params?.error ? (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive font-mono">
          {params.error}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          An unspecified authentication error occurred. Please try again or return to the sign-in page.
        </p>
      )}
    </div>
  );
}

export default function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <CardTitle className="text-xl">Authentication Error</CardTitle>
            </div>
            <CardDescription>
              We encountered an issue while processing your authentication request.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<p className="text-sm text-muted-foreground">Loading error details...</p>}>
              <ErrorContent searchParams={searchParams} />
            </Suspense>
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            <Button asChild className="w-full">
              <Link href="/auth/login">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Return to Sign In
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
