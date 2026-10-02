import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { checkAmsAccess, enforceAmsMfa } from "@/lib/academic-ams-service";
import { supabaseAdmin } from "@/lib/supabase-admin";
import ExcelJS from "exceljs";

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_ROWS = 2000;

// Allowed MIME types â€” no Excel macros (.xlsm), no XML (.xml) workbooks
const ALLOWED_MIME_TYPES = [
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "text/plain",
];

/**
 * POST /api/ams/eligibility/import
 * Validates and commits a student eligibility import for a given cycle.
 *
 * Steps enforced server-side:
 *   1. Authenticate & AMS-authorize caller.
 *   2. Reject oversized / wrong MIME files.
 *   3. Parse CSV rows (no formula execution).
 *   4. Validate each row: email format, domain match, duplicate detection.
 *   5. In preview=true mode: return parsed rows + errors without committing.
 *   6. In preview=false mode: commit eligibility rows idempotently.
 *   7. Return import result summary.
 *
 * Invariants:
 *   - Importing an email does NOT create an authenticated account.
 *   - Imported names NEVER overwrite SkillLinkr profile fields.
 *   - No eligibility record = no cycle access.
 *   - is_all_domains=true only if the "allowed_domains" field is exactly "*".
 *   - Omitted update field means unchanged.
 *   - Invalid domain or parsing error never means ALL.
 *   - Repeated confirmed imports are idempotent.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => request.cookies.getAll(), setAll: () => {} } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

    // MFA STEP-UP: Ensure AAL2 for AMS administrative actions
    await enforceAmsMfa(supabase);

    const access = await checkAmsAccess(user.id);
    if (!access.isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const cycleId = formData.get("cycle_id") as string | null;
    const preview = formData.get("preview") === "true";
    const operation = (formData.get("operation") as string) || "upsert"; // upsert | revoke

    if (!file || !cycleId) {
      return NextResponse.json({ error: "file and cycle_id are required" }, { status: 400 });
    }

    // Bound file size
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: `File too large. Maximum is ${MAX_FILE_BYTES / 1024 / 1024}MB` }, { status: 413 });
    }

    // MIME type guard â€” reject macros, XML, binary
    if (!ALLOWED_MIME_TYPES.includes(file.type) && !file.name.endsWith(".csv") && !file.name.endsWith(".xlsx")) {
      return NextResponse.json({ error: "Unsupported file type. Only .csv or .xlsx files are accepted." }, { status: 415 });
    }

    // Verify cycle belongs to Admin's institution
    const { data: cycle } = await supabaseAdmin
      .from("academic_cycles")
      .select("id, university_domain, allowed_domains, status")
      .eq("id", cycleId)
      .maybeSingle();

    if (!cycle) {
      return NextResponse.json({ error: "Cycle not found" }, { status: 404 });
    }

    if (!access.isSuperAdmin && cycle.university_domain !== access.domain) {
      return NextResponse.json({ error: "Cycle does not belong to your institution" }, { status: 403 });
    }

    let lines: string[] = [];

    if (file.name.endsWith(".xlsx") || file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
      const buffer = Buffer.from(await file.arrayBuffer());
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as any);
      const worksheet = workbook.worksheets[0];
      
      if (!worksheet) {
        return NextResponse.json({ error: "Excel file has no worksheets" }, { status: 400 });
      }

      worksheet.eachRow({ includeEmpty: false }, (row) => {
        // Handle formulas or rich text by taking the raw value or text representation
        const rowValues = (row.values as any[]).slice(1).map(v => {
          if (v === null || v === undefined) return "";
          if (typeof v === 'object') {
            if (v.result !== undefined) return String(v.result); // Formula result
            if (v.text !== undefined) return String(v.text); // Rich text
            return "";
          }
          return String(v);
        });
        lines.push(rowValues.join(","));
      });
    } else {
      // Parse CSV content (no formula execution â€” read as plain text)
      const rawText = await file.text();
      lines = rawText.split(/\r?\n/).filter(l => l.trim());
    }

    if (lines.length < 2) {
      return NextResponse.json({ error: "File has no data rows" }, { status: 400 });
    }

    // Parse header
    const header = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/["']/g, ""));
    const emailIdx = header.indexOf("email");
    const domainsIdx = header.indexOf("allowed_domains");

    if (emailIdx === -1) {
      return NextResponse.json({ error: "Required column 'email' is missing from header" }, { status: 400 });
    }

    const dataRows = lines.slice(1, MAX_ROWS + 1);

    if (lines.length - 1 > MAX_ROWS) {
      return NextResponse.json({ error: `File exceeds maximum of ${MAX_ROWS} data rows` }, { status: 400 });
    }

    const validRows: { email: string; allowed_domains: string[]; is_all_domains: boolean }[] = [];
    const errors: { row: number; email: string; error: string }[] = [];
    const seenEmails = new Set<string>();

    for (let i = 0; i < dataRows.length; i++) {
      const rowNum = i + 2; // 1-indexed + header
      const cols = dataRows[i].split(",").map(c => c.trim().replace(/^["']|["']$/g, ""));

      const email = (cols[emailIdx] || "").toLowerCase().trim();

      // Skip blank rows
      if (!email) continue;

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        errors.push({ row: rowNum, email, error: "Invalid email format" });
        continue;
      }

      // Validate institution domain unless Super Admin
      const emailDomain = email.split("@")[1];
      if (!access.isSuperAdmin && emailDomain !== access.domain) {
        errors.push({ row: rowNum, email, error: `Email domain '${emailDomain}' does not match institution domain '${access.domain}'` });
        continue;
      }

      // Duplicate within file
      if (seenEmails.has(email)) {
        errors.push({ row: rowNum, email, error: "Duplicate email in import file" });
        continue;
      }
      seenEmails.add(email);

      // Parse allowed_domains
      let allowedDomains: string[] = [];
      let isAllDomains = false;

      if (domainsIdx !== -1 && cols[domainsIdx]) {
        const rawDomains = cols[domainsIdx].trim();

        // EXPLICIT all-domains: must be exactly "*"
        if (rawDomains === "*") {
          isAllDomains = true;
          allowedDomains = [];
        } else {
          // Parse comma-separated domain list
          const parsed = rawDomains.split("|").map(d => d.trim().toLowerCase()).filter(d => {
            // Validate each domain is a reasonable domain string
            return /^[a-z0-9-]+(\.[a-z0-9-]+)*$/.test(d);
          });

          // Invalid domain or parsing error NEVER means ALL
          if (parsed.length === 0 && rawDomains !== "") {
            errors.push({ row: rowNum, email, error: `Invalid domain value '${rawDomains}'. Leave blank to use cycle defaults, or use '*' for all, or use pipe-separated domain list (e.g. 'cse|ece').` });
            continue;
          }

          // Validate domains are a subset of the cycle's allowed_domains
          if (cycle.allowed_domains && cycle.allowed_domains.length > 0) {
            const invalidDoms = parsed.filter((d: string) => !cycle.allowed_domains.includes(d));
            if (invalidDoms.length > 0) {
              errors.push({ row: rowNum, email, error: `Domains [${invalidDoms.join(", ")}] are not in this cycle's allowed domain list [${cycle.allowed_domains.join(", ")}]` });
              continue;
            }
          }

          allowedDomains = parsed;
          isAllDomains = false;
        }
      }

      validRows.push({ email, allowed_domains: allowedDomains, is_all_domains: isAllDomains });
    }

    // Preview mode: return parsed rows + errors without committing
    if (preview) {
      return NextResponse.json({
        preview: true,
        operation,
        valid_count: validRows.length,
        error_count: errors.length,
        valid_rows: validRows,
        errors,
      });
    }

    // Commit mode: idempotent upsert
    if (errors.length > 0) {
      return NextResponse.json({
        error: "Import aborted: validation errors present. Re-run with preview=true to review errors before committing.",
        error_count: errors.length,
        errors,
      }, { status: 422 });
    }

    let inserted = 0;
    let updated = 0;
    let revoked = 0;

    for (const row of validRows) {
      if (operation === "revoke") {
        const { error: revokeErr } = await supabaseAdmin
          .from("academic_student_eligibility")
          .update({ status: "revoked", updated_at: new Date().toISOString() })
          .eq("cycle_id", cycleId)
          .eq("student_id", row.email);

        if (!revokeErr) revoked++;
      } else {
        // Check existing
        const { data: existing } = await supabaseAdmin
          .from("academic_student_eligibility")
          .select("id, allowed_domains, is_all_domains")
          .eq("cycle_id", cycleId)
          .eq("student_id", row.email)
          .maybeSingle();

        if (existing) {
          // Only update fields that were explicitly present in the file
          const updatePayload: Record<string, any> = { updated_at: new Date().toISOString(), status: "active" };
          if (domainsIdx !== -1) {
            updatePayload.allowed_domains = row.allowed_domains;
            updatePayload.is_all_domains = row.is_all_domains;
          }

          await supabaseAdmin
            .from("academic_student_eligibility")
            .update(updatePayload)
            .eq("id", existing.id);
          updated++;
        } else {
          await supabaseAdmin.from("academic_student_eligibility").insert({
            cycle_id: cycleId,
            student_id: row.email,
            allowed_domains: row.allowed_domains,
            is_all_domains: row.is_all_domains,
            status: "active",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          inserted++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      operation,
      inserted,
      updated,
      revoked,
      error_count: 0,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * GET /api/ams/eligibility/import
 * Download CSV template for student eligibility import.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => request.cookies.getAll(), setAll: () => {} } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

    const access = await checkAmsAccess(user.id);
    if (!access.isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const template = [
      "email,allowed_domains",
      "student@kiit.ac.in,cse|ece",
      "another@kiit.ac.in,*",
      "# allowed_domains: pipe-separated list (cse|ece) OR * for all OR leave blank for cycle defaults",
    ].join("\r\n");

    return new NextResponse(template, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="eligibility_import_template.csv"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

