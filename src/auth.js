export const AUTH_SCOPES = Object.freeze({
  READ: "read",
  WRITE: "write",
  OPS: "ops"
});

const TOKEN_ENV_BY_SCOPE = Object.freeze({
  [AUTH_SCOPES.READ]: "ADMIN_READ_TOKEN",
  [AUTH_SCOPES.WRITE]: "ADMIN_WRITE_TOKEN",
  [AUTH_SCOPES.OPS]: "OPS_TOKEN"
});

export function getRequestToken(request) {
  const authorization = request?.headers?.get?.("Authorization") || "";
  if (authorization.startsWith("Bearer ")) {
    return authorization.slice(7);
  }

  return request?.headers?.get?.("X-Admin-Token") || "";
}

export function authorizeRequest(request, env = {}, requiredScope = AUTH_SCOPES.READ) {
  if (!TOKEN_ENV_BY_SCOPE[requiredScope]) {
    return authFailure(500, "invalid_auth_scope", "Required authorization scope is invalid.");
  }

  const configured = getConfiguredTokens(env);
  if (!configured.length) {
    return authFailure(503, "auth_not_configured", "Scoped admin authorization is not configured.");
  }

  const requestToken = getRequestToken(request);
  const matched = configured.find(({ token }) => token === requestToken);

  if (!matched || !scopeAllows(matched.scope, requiredScope)) {
    return authFailure(401, "unauthorized", "Token is invalid or does not allow this action.");
  }

  return {
    ok: true,
    scope: matched.scope,
    legacy: matched.legacy
  };
}

export function scopeAllows(grantedScope, requiredScope) {
  if (grantedScope === "legacy") return true;
  if (requiredScope === AUTH_SCOPES.READ) {
    return grantedScope === AUTH_SCOPES.READ || grantedScope === AUTH_SCOPES.WRITE;
  }
  return grantedScope === requiredScope;
}

function getConfiguredTokens(env) {
  const configured = Object.entries(TOKEN_ENV_BY_SCOPE)
    .filter(([, envName]) => typeof env[envName] === "string" && env[envName])
    .map(([scope, envName]) => ({ scope, token: env[envName], legacy: false }));

  if (typeof env.ADMIN_TOKEN === "string" && env.ADMIN_TOKEN) {
    configured.push({ scope: "legacy", token: env.ADMIN_TOKEN, legacy: true });
  }

  return configured;
}

function authFailure(status, error, message) {
  return {
    ok: false,
    status,
    error,
    message
  };
}
