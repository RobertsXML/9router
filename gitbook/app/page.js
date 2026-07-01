import { redirect } from "next/navigation";
import { DEFAULT_LANG } from "@/constants/languages";

// Static-friendly redirect to default language
export const metadata = {
  title: "Redirecting...",
};

export default function HomePage() {
  redirect(`/${DEFAULT_LANG}/`);
}
