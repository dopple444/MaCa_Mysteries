import crypto from "crypto";

type StripeSignatureOptions = {
  toleranceSeconds?: number;
  nowSeconds?: number;
};

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function parseStripeSignature(header: string) {
  return header.split(",").reduce(
    (result, part) => {
      const [key, value] = part.split("=");
      if (key === "t" && value) result.timestamp = Number(value);
      if (key === "v1" && value) result.signatures.push(value);
      return result;
    },
    { timestamp: 0, signatures: [] as string[] }
  );
}

export function createStripeTestSignature(rawBody: string, secret: string, timestamp: number) {
  const signature = crypto.createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

export function verifyStripeWebhookSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
  options: StripeSignatureOptions = {}
) {
  if (!rawBody || !signatureHeader || !secret) return false;

  const { timestamp, signatures } = parseStripeSignature(signatureHeader);
  if (!Number.isFinite(timestamp) || !signatures.length) return false;

  const nowSeconds = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  const toleranceSeconds = options.toleranceSeconds ?? 5 * 60;
  if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) return false;

  const expected = crypto.createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  return signatures.some((signature) => safeEqual(signature, expected));
}
