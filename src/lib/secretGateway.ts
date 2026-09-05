/**
 * Internal security helper for the administrative authentication gateway.
 * The endpoint path is dynamically resolved and obfuscated in compiled code.
 */

// Obfuscated payload representing the default access segment (base64 encoded)
const _O_SEG = 'eW91cmRhZGR5'; // 'yourdaddy'

/**
 * Resolves the active secret gateway identifier.
 * Prioritizes environment variable if defined, otherwise falls back to obfuscated token.
 */
export function getSecretGatewayToken(): string {
  const envPath = (import.meta as any).env?.VITE_ADMIN_GATEWAY_PATH;
  if (envPath && typeof envPath === 'string' && envPath.trim().length > 0) {
    return envPath.trim().replace(/^\/+|\/+$/g, '').toLowerCase();
  }
  try {
    return atob(_O_SEG).toLowerCase();
  } catch {
    // Fallback character code mapping [121, 111, 117, 114, 100, 97, 100, 100, 121]
    return String.fromCharCode(121, 111, 117, 114, 100, 97, 100, 100, 121);
  }
}

/**
 * Checks whether a given URL path or hash matches the secret admin gateway.
 * Strictly prevents standard public paths like '/login' from revealing or opening the gateway.
 */
export function isSecretGatewayPath(pathOrHash: string): boolean {
  if (!pathOrHash) return false;
  const clean = pathOrHash.replace(/^[/#]+|[/#]+$/g, '').trim().toLowerCase();
  
  // Standard '/login' is explicitly disabled
  if (clean === 'login' || clean === 'admin/login') {
    return false;
  }

  const token = getSecretGatewayToken();
  return clean === token;
}
