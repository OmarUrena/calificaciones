import { NextResponse, type NextRequest } from "next/server";

const PRIVATE_ROUTES = [
  "/dashboard",
  "/schools",
  "/school-years",
  "/courses",
  "/students",
  "/teachers",
  "/subjects",
  "/assignments",
  "/my-subjects",
  "/grades",
  "/imports",
  "/reports",
  "/settings",
];

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isPrivateRoute = PRIVATE_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  if (!isPrivateRoute) {
    return NextResponse.next();
  }

  const token = request.cookies.get("califapp_token")?.value;

  if (token) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname);

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/schools/:path*",
    "/school-years/:path*",
    "/courses/:path*",
    "/students/:path*",
    "/teachers/:path*",
    "/subjects/:path*",
    "/assignments/:path*",
    "/my-subjects/:path*",
    "/grades/:path*",
    "/imports/:path*",
    "/reports/:path*",
    "/settings/:path*",
  ],
};
