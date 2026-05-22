type EnvMap = Partial<Record<string, string | undefined>>;

function stripTrailingSlash(value: string) {
  return value.replace(/\/$/, "");
}

function isInvalidBrowserHost(hostname: string) {
  return hostname === "0.0.0.0" || hostname === "::" || hostname === "[::]";
}

export function getAppBaseUrl(requestUrl?: string, env: EnvMap = process.env) {
  const configured = env.APP_URL?.trim();
  if (configured) return stripTrailingSlash(configured);

  if (requestUrl) {
    const requestOrigin = new URL(requestUrl).origin;
    const requestHostname = new URL(requestOrigin).hostname;
    if (!isInvalidBrowserHost(requestHostname)) return requestOrigin;
  }

  return "http://localhost:3000";
}

export function createAppUrl(path: string, requestUrl?: string, env: EnvMap = process.env) {
  return new URL(path, getAppBaseUrl(requestUrl, env));
}
