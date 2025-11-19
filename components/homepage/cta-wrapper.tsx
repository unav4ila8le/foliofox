import { fetchOptionalProfile } from "@/server/profile/actions";

export async function CTAWrapper({ cta = "Get started" }: { cta?: string }) {
  const data = await fetchOptionalProfile();
  return data?.profile ? "Dashboard" : cta;
}
