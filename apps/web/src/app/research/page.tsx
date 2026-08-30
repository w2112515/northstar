import { redirect } from "next/navigation";

// Reorganized: the research workbench is split between Activity (live
// context) and System (evolution, mining, validation).
export default function Page() {
  redirect("/system");
}
