import { redirect } from "next/navigation";

export default function Home() {
  redirect("/auth/login");
  return null; // This line will never be reached
}
