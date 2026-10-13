/**
 * Secure Administrator Provisioning Script
 *
 * This script is intended for infrastructure / DevOps administrators to securely
 * promote an existing user to the initial 'admin' role.
 *
 * Usage:
 *   npx tsx scripts/provision-admin.ts <user-email>
 *
 * Security:
 * - Requires server-only SUPABASE_SERVICE_ROLE_KEY.
 * - This script has NO public HTTP endpoint or client-accessible surface.
 * - Cannot be invoked by browser clients.
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// Load .env.local without requiring external dotenv package
function loadEnvFile() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const [key, ...values] = trimmed.split("=");
      const val = values.join("=").replace(/(^["']|["']$)/g, "");
      if (key && !process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

loadEnvFile();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Error: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const inputEmail = process.argv[2] || process.env.INITIAL_ADMIN_EMAIL;

if (!inputEmail) {
  console.error("Usage: npx tsx scripts/provision-admin.ts <user-email>");
  console.error("   or: set INITIAL_ADMIN_EMAIL in your environment");
  process.exit(1);
}

const targetEmail: string = inputEmail;

const adminSupabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

async function provisionAdmin() {
  console.log(`[Provisioning] Searching for user with email: ${targetEmail}...`);

  // 1. Locate user in auth.users
  const { data: usersData, error: listError } = await adminSupabase.auth.admin.listUsers();
  if (listError) {
    console.error(`Error querying users: ${listError.message}`);
    process.exit(1);
  }

  const targetUser = usersData.users.find(
    (u) => u.email?.toLowerCase() === targetEmail.toLowerCase()
  );

  if (!targetUser) {
    console.error(`Error: User with email "${targetEmail}" was not found.`);
    console.error("Make sure the user has already signed up before promoting them to admin.");
    process.exit(1);
  }

  console.log(`[Provisioning] Found user ${targetUser.id}. Promoting to 'admin'...`);

  // 2. Update role in public.profiles table
  const { error: profileError } = await adminSupabase
    .from("profiles")
    .update({
      role: "admin",
      updated_at: new Date().toISOString(),
    })
    .eq("id", targetUser.id);

  if (profileError) {
    console.error(`Error updating public.profiles: ${profileError.message}`);
    process.exit(1);
  }

  // 3. Update app_metadata so Supabase Auth claims reflect admin role
  const { error: authError } = await adminSupabase.auth.admin.updateUserById(targetUser.id, {
    app_metadata: { role: "admin" },
  });

  if (authError) {
    console.warn(`Warning updating app_metadata: ${authError.message}`);
  }

  console.log(`[Success] User "${targetEmail}" (${targetUser.id}) has been successfully provisioned as administrator!`);
}

provisionAdmin().catch((err) => {
  console.error("Unexpected error during provisioning:", err);
  process.exit(1);
});
