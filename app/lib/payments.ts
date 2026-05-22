import type { Prisma } from "@prisma/client";

import { getAppBaseUrl } from "./app-url";
import { prisma } from "./prisma";
import { logPaymentEvent } from "./server-logging";

type EnvMap = Partial<Record<string, string | undefined>>;

type Fetcher = (
  input: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body: URLSearchParams;
  }
) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
}>;

type CheckoutProduct = Prisma.ProductGetPayload<{
  include: {
    game: {
      select: {
        slug: true;
        title: true;
      };
    };
  };
}>;

type CheckoutOrder = Prisma.OrderGetPayload<{
  include: {
    items: true;
  };
}>;

type CreatePendingOrderInput = {
  productId: string;
  userId: string;
  email: string;
};

type CreatePaymentCheckoutSessionInput = {
  order: CheckoutOrder;
  product: CheckoutProduct;
  requestUrl: string;
  env?: EnvMap;
  fetcher?: Fetcher;
};

export function getPaymentProvider(env: EnvMap = process.env) {
  return env.PAYMENT_PROVIDER?.trim().toLowerCase() || null;
}

function getStripeSecretKey(env: EnvMap) {
  return env.STRIPE_SECRET_KEY?.trim() || null;
}

function getStringField(value: unknown, field: string) {
  if (!value || typeof value !== "object" || !(field in value)) return "";
  const result = (value as Record<string, unknown>)[field];
  return typeof result === "string" ? result : "";
}

async function markCheckoutOrderFailed(orderId: string, provider: string, reason: string) {
  await prisma.order.updateMany({
    where: {
      id: orderId,
      status: "PENDING"
    },
    data: {
      status: "FAILED",
      paymentProvider: provider
    }
  });
  logPaymentEvent("warn", "checkout.session.failed", {
    orderId,
    provider: provider || "none",
    reason
  });
}

export async function createPendingOrderForProduct(input: CreatePendingOrderInput) {
  const product = await prisma.product.findFirst({
    where: {
      id: input.productId,
      status: "ACTIVE"
    },
    include: {
      game: {
        select: {
          slug: true,
          title: true
        }
      }
    }
  });

  if (!product) return null;

  const order = await prisma.order.create({
    data: {
      userId: input.userId,
      email: input.email,
      status: "PENDING",
      paymentProvider: getPaymentProvider() ?? "",
      subtotalCents: product.priceCents,
      totalCents: product.priceCents,
      currency: product.currency,
      items: {
        create: {
          productId: product.id,
          quantity: 1,
          unitPriceCents: product.priceCents,
          totalPriceCents: product.priceCents
        }
      }
    },
    include: {
      items: true
    }
  });

  return { order, product };
}

export async function createPaymentCheckoutSession(input: CreatePaymentCheckoutSessionInput) {
  const env = input.env ?? process.env;
  const provider = getPaymentProvider(env);
  if (provider !== "stripe") {
    await markCheckoutOrderFailed(input.order.id, provider ?? "", "provider_not_configured");
    return {
      status: "NOT_CONFIGURED" as const,
      orderId: input.order.id,
      message: "Payment provider is not configured yet."
    };
  }

  const secretKey = getStripeSecretKey(env);
  if (!secretKey) {
    await markCheckoutOrderFailed(input.order.id, "stripe", "missing_stripe_secret_key");
    return {
      status: "NOT_CONFIGURED" as const,
      orderId: input.order.id,
      message: "Stripe is selected, but STRIPE_SECRET_KEY is not configured."
    };
  }

  const baseUrl = getAppBaseUrl(input.requestUrl, env);
  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("client_reference_id", input.order.id);
  params.set("customer_email", input.order.email);
  params.set("success_url", `${baseUrl}/host/create?game=${input.product.game.slug}&checkout=success`);
  params.set("cancel_url", `${baseUrl}/games/${input.product.game.slug}?checkout=cancelled`);
  params.set("metadata[orderId]", input.order.id);
  params.set("metadata[userId]", input.order.userId ?? "");
  params.set("line_items[0][quantity]", "1");
  params.set("line_items[0][price_data][currency]", input.product.currency.toLowerCase());
  params.set("line_items[0][price_data][unit_amount]", String(input.product.priceCents));
  params.set("line_items[0][price_data][product_data][name]", input.product.name);
  params.set("line_items[0][price_data][product_data][description]", input.product.game.title);

  const fetcher = input.fetcher ?? fetch;
  const response = await fetcher("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params
  });

  if (!response.ok) {
    const message = await response.text();
    await markCheckoutOrderFailed(input.order.id, "stripe", `stripe_response_${response.status}`);
    return {
      status: "FAILED" as const,
      orderId: input.order.id,
      message
    };
  }

  const payload = await response.json();
  const sessionId = getStringField(payload, "id");
  const url = getStringField(payload, "url");
  if (!sessionId || !url) {
    await markCheckoutOrderFailed(input.order.id, "stripe", "stripe_missing_checkout_url");
    return {
      status: "FAILED" as const,
      orderId: input.order.id,
      message: "Stripe did not return a checkout URL."
    };
  }

  await prisma.order.update({
    where: { id: input.order.id },
    data: {
      paymentProvider: "stripe",
      paymentReference: sessionId
    }
  });

  logPaymentEvent("info", "checkout.session.created", {
    orderId: input.order.id,
    provider: "stripe",
    sessionId
  });

  return {
    status: "REDIRECT" as const,
    orderId: input.order.id,
    url
  };
}
