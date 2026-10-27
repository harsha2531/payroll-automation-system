import { AuthService } from "@/services/auth.service";
import MonthlyPayrollClient from "./MonthlyPayrollClient";


export default async function MonthlyPayrollPage() {
  await AuthService.requireAdmin();
  return <MonthlyPayrollClient />;
}
