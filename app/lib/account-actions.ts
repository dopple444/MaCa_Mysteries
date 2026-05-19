"use server";

import { redirect } from "next/navigation";

import { requireUser } from "./auth";
import { verifyCsrfToken } from "./csrf";
import { prisma } from "./prisma";

function getFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function normalizePhoneNumber(value: string) {
  return value.replace(/[^\d+]/g, "");
}

export async function updateNotificationPreferences(formData: FormData) {
  if (!(await verifyCsrfToken(formData))) {
    redirect("/account/notifications?error=csrf");
  }

  const user = await requireUser();
  const phoneNumber = normalizePhoneNumber(getFormValue(formData, "phoneNumber"));
  const emailOptIn = formData.get("emailOptIn") === "on";
  const smsOptIn = formData.get("smsOptIn") === "on";

  if (smsOptIn && phoneNumber.length < 10) {
    redirect("/account/notifications?error=phone");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      phoneNumber,
      notificationPrefs: {
        emailOptIn,
        smsOptIn
      }
    }
  });

  redirect("/account/notifications?saved=1");
}
