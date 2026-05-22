import { NextResponse } from "next/server";

import { verifyCsrfToken } from "../../lib/csrf";
import { requireGuest } from "../../lib/guest-auth";
import { attemptPlayerCodeUnlock } from "../../lib/player-tools";
import { checkRateLimit } from "../../lib/rate-limit";

function getFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function redirectToPlay(request: Request, unlock?: string) {
  const url = new URL("/play", request.url);
  if (unlock) url.searchParams.set("unlock", unlock);
  return NextResponse.redirect(url, 303);
}

export async function POST(request: Request) {
  const guest = await requireGuest();
  const formData = await request.formData();
  if (!(await verifyCsrfToken(formData))) {
    return redirectToPlay(request, "invalid");
  }

  const rateLimit = await checkRateLimit({
    scope: "player-code-unlock",
    key: guest.id,
    limit: 8,
    windowSeconds: 10 * 60
  });
  if (!rateLimit.allowed) {
    return redirectToPlay(request, "rate-limited");
  }

  const result = await attemptPlayerCodeUnlock({
    guestId: guest.id,
    unlockRuleId: getFormValue(formData, "unlockRuleId"),
    code: getFormValue(formData, "code")
  });

  if (result.status === "UNLOCKED") {
    return redirectToPlay(request, "success");
  }

  return redirectToPlay(request, result.reason);
}
