/**
 * WebAuthn / Passkey helper utilities for Podacium.
 * Handles buffer <-> base64url conversions and browser credential ceremonies.
 */

export function base64urlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4;
  const padded = pad ? base64 + "=".repeat(4 - pad) : base64;
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export function bufferToBase64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Executes navigator.credentials.get with transformed PublicKeyCredentialRequestOptions
 */
export async function getWebAuthnAssertion(rawOptions: any): Promise<any> {
  if (typeof window === "undefined" || !navigator.credentials?.get) {
    throw new Error("WebAuthn is not supported in this browser environment");
  }

  const publicKeyOptions: PublicKeyCredentialRequestOptions = {
    ...rawOptions,
    challenge:
      typeof rawOptions.challenge === "string"
        ? base64urlToBuffer(rawOptions.challenge)
        : rawOptions.challenge,
    allowCredentials: rawOptions.allowCredentials?.map((cred: any) => ({
      ...cred,
      id: typeof cred.id === "string" ? base64urlToBuffer(cred.id) : cred.id,
    })),
  };

  const credential = (await navigator.credentials.get({
    publicKey: publicKeyOptions,
  })) as any;

  if (!credential) {
    throw new Error("WebAuthn assertion failed or was cancelled");
  }

  return {
    id: credential.id,
    rawId: bufferToBase64url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: bufferToBase64url(credential.response.clientDataJSON),
      authenticatorData: bufferToBase64url(
        credential.response.authenticatorData,
      ),
      signature: bufferToBase64url(credential.response.signature),
      userHandle: credential.response.userHandle
        ? bufferToBase64url(credential.response.userHandle)
        : null,
    },
  };
}
