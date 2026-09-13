import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";

const ROLE_ROUTES: Record<string, string[]> = {
  "/dashboard/admin": ["admin"],
  "/dashboard/cashier": ["cashier"],
  "/dashboard/customer": ["customer"],
  "/dashboard/driver": ["driver"],
  "/categories": ["admin"],
  "/users": ["admin"],
  "/products": ["admin"],
  "/restocks": ["admin"],
  "/transactions": ["admin", "cashier"],
  "/orders": ["admin", "cashier", "customer"],
  "/reports": ["admin", "cashier"],
  "/pos": ["cashier"],
  "/shop": ["customer"],
  "/deliveries": ["driver"],
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get("token")?.value;

  if (pathname === "/login" || pathname === "/signup") {
    if (token) {
      const payload = await verifyToken(token);
      if (payload) return NextResponse.redirect(new URL(`/dashboard/${payload.role}`, req.url));
    }
    return NextResponse.next();
  }

  const matchedBase = Object.keys(ROLE_ROUTES).find((base) => pathname.startsWith(base));
  if (!matchedBase) return NextResponse.next();

  if (!token) return NextResponse.redirect(new URL("/login", req.url));

  const payload = await verifyToken(token);
  if (!payload) return NextResponse.redirect(new URL("/login", req.url));

  if (!ROLE_ROUTES[matchedBase].includes(payload.role)) {
    return NextResponse.redirect(new URL(`/dashboard/${payload.role}`, req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/login",
    "/signup",
    "/dashboard/:path*",
    "/users/:path*",
    "/categories/:path*",
    "/products/:path*",
    "/restocks/:path*",
    "/transactions/:path*",
    "/orders/:path*",
    "/reports/:path*",
    "/pos/:path*",
    "/shop/:path*",
    "/deliveries/:path*",
  ],
};
