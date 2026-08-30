import { redirect } from "next/navigation";

// Reorganized: the strategy catalog lives on System.
export default function Page() {
  redirect("/system");
}
