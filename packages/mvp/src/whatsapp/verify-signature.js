function timingSafeEqualHex(left, right) {
  if (left.length !== right.length) return false;

  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

/**
 * Verifies the X-Hub-Signature-256 header sent by Meta.
 * The request is cloned so the original body remains available for JSON parsing.
 */
export async function verifyWhatsAppSignature(request, appSecret) {
  if (!appSecret) return false;

  const signature = request.headers.get("X-Hub-Signature-256") || "";
  if (!signature.startsWith("sha256=")) return false;

  const expected = signature.slice("sha256=".length).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(expected)) return false;

  const body = await request.clone().arrayBuffer();
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBuffer = await crypto.subtle.sign("HMAC", key, body);
  const computed = Array.from(new Uint8Array(signatureBuffer))
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");

  return timingSafeEqualHex(computed, expected);
}
