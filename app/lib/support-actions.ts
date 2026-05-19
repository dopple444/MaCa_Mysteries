"use server";

import { redirect } from "next/navigation";

import { getCurrentUser } from "./auth";
import { verifyCsrfToken } from "./csrf";
import { checkRateLimit } from "./rate-limit";
import { createSupportTicket } from "./support-service";

function getFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function submitSupportTicket(formData: FormData) {
  if (!(await verifyCsrfToken(formData))) {
    redirect("/support?error=missing");
  }
  const user = await getCurrentUser();
  const email = getFormValue(formData, "email") || user?.email || "";
  const subject = getFormValue(formData, "subject");
  const message = getFormValue(formData, "message");
  const rateLimit = await checkRateLimit({
    scope: "support",
    key: email,
    limit: 5,
    windowSeconds: 60 * 60
  });

  if (!rateLimit.allowed) {
    redirect("/support?error=rate-limited");
  }

  const ticket = await createSupportTicket({
    userId: user?.id,
    email,
    subject,
    message
  });

  if (!ticket) {
    redirect("/support?error=missing");
  }

  redirect("/support?submitted=1");
}
