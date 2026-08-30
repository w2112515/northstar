import { redirect } from "next/navigation";

// Reorganized: the machinery lives on Research (evolution, mining,
// validation) and Strategies (catalog, instances).
export default function Page() {
  redirect("/research");
}
