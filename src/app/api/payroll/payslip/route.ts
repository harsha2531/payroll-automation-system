// src/app/api/payroll/payslip/route.ts
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { generatePayslipPdf } from "@/lib/payrollPdfService";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const path = url.searchParams.get("path");
  const bucket = url.searchParams.get("bucket") || "payslips";
  const employeeId = url.searchParams.get("employeeId");
  const yearParam = url.searchParams.get("year");
  const monthParam = url.searchParams.get("month");

  if (!path) {
    return NextResponse.json({ error: "Missing path parameter" }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();

    // 1. Try to generate a signed URL from storage
    const { data: signed, error: signError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 60 * 60 * 24);

    if (signed?.signedUrl) {
      return NextResponse.redirect(signed.signedUrl, 302);
    }

    // 2. If object does not exist yet and we have employee details, generate on-the-fly
    if (employeeId && yearParam && monthParam) {
      const year = parseInt(yearParam, 10);
      const month = parseInt(monthParam, 10);
      try {
        const freshUrl = await generatePayslipPdf(employeeId, year, month);
        if (freshUrl && freshUrl.startsWith("http")) {
          return NextResponse.redirect(freshUrl, 302);
        }
      } catch (genErr) {
        console.error("On-the-fly payslip generation failed:", genErr);
      }
    }

    // 3. Fallback: Attempt to download the file directly and stream it
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(bucket)
      .download(path);

    if (downloadError || !fileData) {
      return NextResponse.json(
        { error: `Payslip not found: ${signError?.message || downloadError?.message || "File not found"}` },
        { status: 404 }
      );
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const fileName = path.split("/").pop() || "payslip.pdf";

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("Error serving payslip:", error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

