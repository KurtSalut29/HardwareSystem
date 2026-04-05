import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";

const ROLE_ROUTES: Record<string, string[]> = {
  "/dashboard/admin": ["admin"],
  "/dashboard/cashier": ["cashier"],
  "/dashboard/customer": ["customer"],
  "/categories": ["admin"],
  "/users": ["admin"],
  "/products": ["admin"],
  "/transactions": ["admin", "cashier"],
  "/orders": ["admin", "customer"],
  "/pos": ["cashier"],
  "/shop": ["customer"],
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
    "/transactions/:path*",
    "/orders/:path*",
    "/pos/:path*",
    "/shop/:path*",
  ],
};
