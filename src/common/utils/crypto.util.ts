import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/**
 * Criptografia simétrica em repouso para segredos de integração (client_secret,
 * tokens de API, webhook secrets, chave privada mTLS) guardados no MongoDB.
 *
 * Usa AES-256-GCM. A chave vem de APP_ENCRYPTION_KEY (32 bytes), aceita em
 * base64, hex ou texto puro de 32 caracteres. Formato do texto cifrado:
 *
 *   enc:v1:<iv base64>:<authTag base64>:<ciphertext base64>
 *
 * Gere a chave com:  openssl rand -base64 32
 */

const PREFIX = 'enc:v1:';

function loadKey(): Buffer {
  const raw = process.env.APP_ENCRYPTION_KEY;
  if (!raw || raw.trim().length === 0) {
    throw new Error(
      'APP_ENCRYPTION_KEY não configurada. Defina uma chave de 32 bytes (openssl rand -base64 32) ' +
        'antes de salvar segredos de pagamento.',
    );
  }
  const value = raw.trim();

  const tryBuffers: Buffer[] = [];
  if (/^[A-Za-z0-9+/]+={0,2}$/.test(value))
    tryBuffers.push(Buffer.from(value, 'base64'));
  if (/^[0-9a-fA-F]+$/.test(value)) tryBuffers.push(Buffer.from(value, 'hex'));
  tryBuffers.push(Buffer.from(value, 'utf8'));

  const key = tryBuffers.find((b) => b.length === 32);
  if (!key) {
    throw new Error(
      'APP_ENCRYPTION_KEY inválida: precisa decodificar para exatamente 32 bytes ' +
        '(ex.: saída de "openssl rand -base64 32").',
    );
  }
  return key;
}

export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

export function encryptSecret(plain: string): string {
  const key = loadKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plain, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return (
    PREFIX +
    [
      iv.toString('base64'),
      authTag.toString('base64'),
      ciphertext.toString('base64'),
    ].join(':')
  );
}

export function decryptSecret(payload: string): string {
  if (!isEncrypted(payload)) {
    throw new Error('Valor não está no formato esperado de segredo cifrado.');
  }
  const key = loadKey();
  const [ivB64, tagB64, dataB64] = payload.slice(PREFIX.length).split(':');
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error('Segredo cifrado malformado.');
  }
  const decipher = createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(ivB64, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

/** Descriptografa se estiver cifrado; caso contrário devolve como veio (tolera dados legados em texto puro). */
export function decryptMaybe(
  value: string | null | undefined,
): string | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  return isEncrypted(value) ? decryptSecret(value) : value;
}
