import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { type Ledger, csv, localDate, validateLedger } from '../domain/ledger';

export async function exportLedger(ledger: Ledger, format: 'json' | 'csv') {
  const content =
    format === 'json' ? JSON.stringify(ledger, null, 2) : csv(ledger);
  const mimeType = format === 'json' ? 'application/json' : 'text/csv';
  const name = `qingzhang-${localDate()}.${format}`;
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
    file.write(content);
    await Sharing.shareAsync(file.uri, {
      mimeType,
      dialogTitle: '导出清账数据',
      UTI:
        format === 'json'
          ? 'public.json'
          : 'public.comma-separated-values-text',
    });
  }
}

export async function importLedger(): Promise<Ledger | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain'],
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset) return null;
  if (asset.size && asset.size > 10_000_000)
    throw new Error('备份文件不能超过 10 MB');
  let text: string;
  if (Platform.OS === 'web') {
    const response = await fetch(asset.uri);
    text = await response.text();
  } else text = await new File(asset.uri).text();
  if (text.length > 10_000_000) throw new Error('备份文件不能超过 10 MB');
  try {
    return validateLedger(JSON.parse(text));
  } catch (error) {
    throw new Error(
      `无法导入：${error instanceof Error ? error.message : '文件格式无效'}`,
    );
  }
}
