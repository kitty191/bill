import {
  AESEncryptionKey,
  AESSealedData,
  aesDecryptAsync,
  aesEncryptAsync,
  getRandomBytesAsync,
} from 'expo-crypto';
import { pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { assertBackupTextSize, utf8ByteLength } from './backup';
import { type Ledger, validateLedger } from './ledger';

const format = 'qingzhang-encrypted-backup-v1';
export type EncryptedBackup = {
  format: typeof format;
  salt: string;
  sealed: string;
};

export function parseEncryptedBackup(value: unknown): EncryptedBackup | null {
  if (
    !value ||
    typeof value !== 'object' ||
    !('format' in value) ||
    value.format !== format
  )
    return null;
  const { salt, sealed } = value as EncryptedBackup;
  if (
    typeof salt !== 'string' ||
    !/^[a-f0-9]{32}$/.test(salt) ||
    typeof sealed !== 'string' ||
    sealed.length < 40 ||
    sealed.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(sealed)
  )
    throw new Error('加密备份文件格式无效');
  return { format, salt, sealed };
}

async function deriveKey(password: string, salt: Uint8Array) {
  if (password.length < 12 || password.length > 128)
    throw new Error('备份密码应为 12 至 128 个字符');
  const bytes = await pbkdf2Async(sha256, password, salt, {
    c: 600_000,
    dkLen: 32,
  });
  try {
    return await AESEncryptionKey.import(bytes);
  } finally {
    bytes.fill(0);
  }
}

const authenticatedFormat = () => new TextEncoder().encode(format);

export async function encryptLedger(
  ledger: Ledger,
  password: string,
): Promise<string> {
  const text = JSON.stringify(validateLedger(ledger));
  if (text.length > 47_999_800 || utf8ByteLength(text) > 47_999_800)
    throw new Error('加密导出支持小于 48 MB 的账本');
  const salt = await getRandomBytesAsync(16);
  const key = await deriveKey(password, salt);
  const encrypted = await aesEncryptAsync(new TextEncoder().encode(text), key, {
    nonce: { bytes: await getRandomBytesAsync(12) },
    tagLength: 16,
    additionalData: authenticatedFormat(),
  });
  const result = JSON.stringify({
    format,
    salt: Array.from(salt, (byte) => byte.toString(16).padStart(2, '0')).join(
      '',
    ),
    sealed: await encrypted.combined('base64'),
  });
  assertBackupTextSize(result);
  return result;
}

export async function decryptLedger(
  value: EncryptedBackup,
  password: string,
): Promise<Ledger> {
  const salt = Uint8Array.from(value.salt.match(/../g)!, (hex) =>
    Number.parseInt(hex, 16),
  );
  const key = await deriveKey(password, salt);
  let bytes: Uint8Array;
  try {
    const encrypted = AESSealedData.fromCombined(value.sealed, {
      ivLength: 12,
      tagLength: 16,
    });
    bytes = await aesDecryptAsync(encrypted, key, {
      additionalData: authenticatedFormat(),
    });
  } catch {
    throw new Error('密码不正确或加密备份已损坏');
  }
  try {
    return validateLedger(JSON.parse(new TextDecoder().decode(bytes)));
  } finally {
    bytes.fill(0);
  }
}
