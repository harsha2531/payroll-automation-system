import { NextResponse } from "next/server";
import { checkSupabaseConnection } from "@/lib/supabase/connection-check";

export async function GET() {
  const result = await checkSupabaseConnection();

  const statusCode = result.configured && result.connected ? 200 : 503;

  return NextResponse.json(result, {
    status: statusCode,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
