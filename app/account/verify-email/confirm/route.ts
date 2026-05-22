import { NextResponse } from "next/server";

import { getCurrentUser } from "../../../lib/auth";
import { verifyUserEmail } from "../../../lib/account-security";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const result = token ? await verifyUserEmail(token) : { verified: false, userId: null };
  if (!result.verified) {
    return NextResponse.redirect(new URL("/account/verify-email?error=invalid", request.url), 303);
  }

  const currentUser = await getCurrentUser();
  const destination =
    currentUser?.id === result.userId ? "/account/verify-email?verified=1" : "/login?verified=1";
  return NextResponse.redirect(new URL(destination, request.url), 303);
}
