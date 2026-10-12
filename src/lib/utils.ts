import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// This check can be removed, it is just for tutorial purposes
export const hasEnvVars = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
    process.env.NEXT_PUBLIC_SUPABASE_URL !== "your-project-url" &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY !== "your-publishable-or-anon-key" &&
    (process.env.NEXT_PUBLIC_SUPABASE_URL.startsWith("http://") ||
      process.env.NEXT_PUBLIC_SUPABASE_URL.startsWith("https://"))
);

