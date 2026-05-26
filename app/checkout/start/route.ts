import { NextResponse } from "next/server";

import { createAppUrl } from "../../lib/app-url";
import { getCurrentUser } from "../../lib/auth";
import { verifyCsrfToken } from "../../lib/csrf";
import { getHostGameAccess } from "../../lib/game-access";
import { createPaymentCheckoutSession, createPendingOrderForProduct } from "../../lib/payments";
import { prisma } from "../../lib/prisma";
import { checkRateLimit } from "../../lib/rate-limit";

function getFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(createAppUrl("/login", request.url), 303);
  }
  const rateLimit = await checkRateLimit({
    scope: "checkout-start",
    key: user.id,
    limit: 10,
    windowSeconds: 10 * 60
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: "Too many checkout attempts. Please wait before trying again.",
        resetAt: rateLimit.resetAt.toISOString()
      },
      { status: 429 }
    );
  }

  const formData = await request.formData();
  if (!(await verifyCsrfToken(formData))) {
    return NextResponse.json({ error: "Invalid CSRF token." }, { status: 403 });
  }
  const productId = getFormValue(formData, "productId");
  if (!productId) {
    return NextResponse.json({ error: "Missing productId." }, { status: 400 });
  }

  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      status: "ACTIVE"
    },
    include: {
      game: {
        select: {
          id: true,
          slug: true
        }
      }
    }
  });

  if (!product) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 });
  }

  const access = await getHostGameAccess({
    userId: user.id,
    gameId: product.gameId,
    allowDevelopmentBypass: false
  });

  if (access.canHost) {
    return NextResponse.redirect(createAppUrl(`/host/create?game=${product.game.slug}`, request.url), 303);
  }

  const checkout = await createPendingOrderForProduct({
    productId: product.id,
    userId: user.id,
    email: user.email
  });
  if (!checkout) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 });
  }

  const session = await createPaymentCheckoutSession({
    order: checkout.order,
    product: checkout.product,
    requestUrl: request.url
  });

  if (session.status === "REDIRECT") {
    return NextResponse.redirect(session.url, 303);
  }

  return NextResponse.json(
    {
      error: session.message,
      orderId: session.orderId,
      product: {
        id: product.id,
        name: product.name,
        priceCents: product.priceCents,
        currency: product.currency
      }
    },
    { status: session.status === "FAILED" ? 502 : 501 }
  );
}
