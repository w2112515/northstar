import { redirect } from "next/navigation";

// Reorganized: the evolution lab lives on Research.
export default function Page() {
  redirect("/research");
}
