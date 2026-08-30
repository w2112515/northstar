import { redirect } from "next/navigation";

// Renamed: the journal is the Proof ledger.
export default function Page() {
  redirect("/proof");
}
