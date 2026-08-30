import { redirect } from "next/navigation";

// Renamed: the wizard lives at /start.
export default function Page() {
  redirect("/start");
}
