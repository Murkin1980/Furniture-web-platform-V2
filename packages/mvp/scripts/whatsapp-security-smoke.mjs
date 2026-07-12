import { verifyWhatsAppSignature } from "../src/whatsapp/verify-signature.js";
import { normalizePlainTextPreview, withUpdatedAt } from "../src/shared/store-utils.js";

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${message}`);
  } else {
    failed += 1;
    console.log(`  ✗ ${message}`);
  }
}

async function signBody(body, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(signature))
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

console.log("WhatsApp signature verification");

const secret = "test-meta-app-secret";
const body = JSON.stringify({ phone_number: "+77001234567", text: "Привет" });
const validSignature = await signBody(body, secret);

const validRequest = new Request("https://example.test/api/whatsapp/webhook", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Hub-Signature-256": `sha256=${validSignature}`
  },
  body
});

assert(await verifyWhatsAppSignature(validRequest, secret), "accepts a valid Meta HMAC signature");
assert(await validRequest.json().then(value => value.text === "Привет"), "signature verification preserves the original request body");

const missingSignatureRequest = new Request("https://example.test/api/whatsapp/webhook", {
  method: "POST",
  body
});
assert(!(await verifyWhatsAppSignature(missingSignatureRequest, secret)), "rejects a missing signature");

const malformedSignatureRequest = new Request("https://example.test/api/whatsapp/webhook", {
  method: "POST",
  headers: { "X-Hub-Signature-256": "sha256=not-hex" },
  body
});
assert(!(await verifyWhatsAppSignature(malformedSignatureRequest, secret)), "rejects a malformed signature");

const invalidSignatureRequest = new Request("https://example.test/api/whatsapp/webhook", {
  method: "POST",
  headers: { "X-Hub-Signature-256": `sha256=${"0".repeat(64)}` },
  body
});
assert(!(await verifyWhatsAppSignature(invalidSignatureRequest, secret)), "rejects an incorrect signature");
assert(!(await verifyWhatsAppSignature(validRequest.clone(), "")), "rejects an empty app secret");

console.log("\nPlain-text preview normalization");

const xssPayload = "  <img src=x onerror=alert(1)>\u0000 client text  ";
const preview = normalizePlainTextPreview(xssPayload, 200);
assert(preview.includes("<img src=x onerror=alert(1)>") , "keeps data as plain text instead of storing HTML entities");
assert(!preview.includes("\u0000"), "removes control characters");
assert(preview.length <= 200, "enforces the preview length limit");

console.log("\nupdated_at helper");
const clauses = withUpdatedAt(["status = ?"]);
assert(clauses.includes("updated_at = CURRENT_TIMESTAMP"), "adds updated_at to dynamic UPDATE clauses");
const unchanged = withUpdatedAt(["status = ?", "updated_at = CURRENT_TIMESTAMP"]);
assert(unchanged.filter(item => item === "updated_at = CURRENT_TIMESTAMP").length === 1, "does not duplicate updated_at");

console.log(`\n${passed + failed} total, ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
