import { SignUpForm } from "@/components/sign-up-form";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";

async function AuthCheck() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (data?.claims) {
    redirect("/protected");
  }

  return null;
}

export default function SignUpPage() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <Suspense fallback={null}>
        <AuthCheck />
      </Suspense>
      <div className="w-full max-w-sm">
        <SignUpForm />
      </div>
    </div>
  );
}
