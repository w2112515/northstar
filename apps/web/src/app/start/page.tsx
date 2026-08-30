import { redirect } from "next/navigation";

// Renamed: the wizard lives at /onboarding.
export default function Page() {
  redirect("/onboarding");
}
