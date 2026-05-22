type LogLevel = "info" | "warn" | "error";

type LogMetadata = Record<string, unknown>;

function safeMetadata(metadata: LogMetadata) {
  return Object.fromEntries(
    Object.entries(metadata).filter(([key]) => !key.toLowerCase().includes("secret") && !key.toLowerCase().includes("key"))
  );
}

export function logPaymentEvent(level: LogLevel, event: string, metadata: LogMetadata = {}) {
  const payload = {
    area: "payment",
    event,
    ...safeMetadata(metadata),
    timestamp: new Date().toISOString()
  };

  console[level](JSON.stringify(payload));
}
