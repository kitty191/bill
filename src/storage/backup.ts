import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import {
  type Entry,
  type Ledger,
  csv,
  localDate,
  validateLedger,
} from '../domain/ledger';
import { assertBackupSize, assertBackupTextSize, utf8ByteLength } from '../domain/backup';
import { MAX_CSV_BYTES } from '../domain/importCsv';
import { type EncryptedBackup } from '../domain/encryptedBackup';

export async function exportLedger(ledger: Ledger, format: 'json' | 'csv') {
  const content =
    format === 'json' ? JSON.stringify(ledger, null, 2) : csv(ledger);
  const name = `qingzhang-${localDate()}.${format}`;
  await exportContent(
    content,
    name,
    format === 'json' ? 'application/json' : 'text/csv',
  );
}

export async function exportFilteredEntries(
  ledger: Ledger,
  entries: readonly Entry[],
) {
  await exportContent(
    csv(ledger, entries),
    `qingzhang-filtered-${localDate()}.csv`,
    'text/csv',
  );
}

export async function exportLegacyBackup(content: string) {
  validateLedger(JSON.parse(content));
  await exportContent(
    content,
    `qingzhang-before-upgrade-v${JSON.parse(content).version}-${localDate()}.json`,
    'application/json',
  );
}
export async function exportSnapshot(content: string, snapshotId: string) {
  const ledger = validateLedger(JSON.parse(content));
  await exportContent(
    JSON.stringify(ledger, null, 2),
    `qingzhang-${snapshotId.replace(/[^a-zA-Z0-9-]/g, '')}.json`,
    'application/json',
  );
}

async function exportContent(content: string, name: string, mimeType: string) {
  if (mimeType === 'application/json') assertBackupTextSize(content);
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(
      new Blob([content], { type: `${mimeType};charset=utf-8` }),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } else {
    if (!(await Sharing.isAvailableAsync()))
      throw new Error('此设备暂不支持分享文件');
    const file = new File(Paths.cache, name);
    await file.write(content);
    await Sharing.shareAsync(file.uri, {
      mimeType,
      dialogTitle: '导出清账数据',
      UTI:
        mimeType === 'application/json'
          ? 'public.json'
          : 'public.comma-separated-values-text',
    });
  }
}

export async function importLedger(onEncrypted?: (backup: EncryptedBackup) => void): Promise<Ledger | null> {
  const text = await pickTextFile(['application/json', 'text/plain'], assertBackupSize);
  if (text === null) return null;
  try {
    const value: unknown = JSON.parse(text.replace(/^\uFEFF/, ''));
    if (value && typeof value === 'object' && 'format' in value) {
      const { parseEncryptedBackup } = await import('../domain/encryptedBackup');
      const encrypted = parseEncryptedBackup(value);
      if (encrypted) {
        if (!onEncrypted) throw new Error('请选择需要密码的恢复入口');
        onEncrypted(encrypted);
        return null;
      }
    }
    return validateLedger(value);
  } catch (error) {
    throw new Error(
      `无法导入：${error instanceof Error ? error.message : '文件格式无效'}`,
    );
  }
}

export async function exportEncryptedLedger(ledger: Ledger, password: string) {
  const { encryptLedger } = await import('../domain/encryptedBackup');
  await exportContent(await encryptLedger(ledger, password), `qingzhang-${localDate()}.encrypted.json`, 'application/json');
}

export async function exportCsvTemplate(ledger: Ledger) {
  await exportContent(csv(ledger, []), 'qingzhang-template.csv', 'text/csv');
}

export async function pickCsv() {
  return pickTextFile(['text/csv', 'application/vnd.ms-excel', 'text/plain'], (size) => {
    if (size > MAX_CSV_BYTES) throw new Error('CSV 文件不能超过 5 MB');
  });
}

async function pickTextFile(type: string[], assertSize: (size: number) => void) {
  const result = await DocumentPicker.getDocumentAsync({
    type,
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset) return null;
  if (asset.size !== undefined) assertSize(asset.size);
  let text: string;
  if (Platform.OS === 'web') {
    const response = await fetch(asset.uri);
    if (!response.ok) throw new Error('无法读取备份文件，请重新选择');
    text = await response.text();
  } else text = await new File(asset.uri).text();
  assertSize(text.length);
  assertSize(utf8ByteLength(text));
  return text;
}
