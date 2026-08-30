import { redirect } from "next/navigation";

// Renamed: the ledger is the Journal.
export default function Page() {
  redirect("/journal");
}
