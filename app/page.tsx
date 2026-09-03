import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import LandingPage from "@/components/landing/LandingPage";

// The root is the public storefront. Anyone can browse the catalogue here
// without an account; signing in is only required at the point of ordering.
// Someone already signed in skips it and goes straight to their dashboard.
export default async function RootPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (token) {
    const payload = await verifyToken(token);
    if (payload) redirect(`/dashboard/${payload.role}`);
  }
  return <LandingPage />;
}
