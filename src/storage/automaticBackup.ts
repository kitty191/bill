import { Directory, File, FileMode } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import {
  defaultBackupPreferences,
  validateBackupPreferences,
  type BackupFiles,
  type BackupPreferences,
} from '../domain/automaticBackup';
const key = 'qingzhang.automatic-backup.v1';
export const automaticBackupSupported = () => true;
export async function loadBackupPreferences() {
  const raw = await SecureStore.getItemAsync(key);
  return raw === null
    ? defaultBackupPreferences()
    : validateBackupPreferences(JSON.parse(raw));
}
export async function saveBackupPreferences(value: BackupPreferences) {
  await SecureStore.setItemAsync(
    key,
    JSON.stringify(validateBackupPreferences(value)),
    { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY },
  );
}
export async function pickBackupDirectory(): Promise<{
  directory: string;
  name: string;
} | null> {
  try {
    const selected = await Directory.pickDirectoryAsync(
      Platform.OS === 'android'
        ? 'content://com.android.externalstorage.documents/document/primary%3ADocuments'
        : undefined,
    );
    let name = selected.name;
    try {
      name = decodeURIComponent(name).split(':').pop()!.split('/').pop()!;
    } catch {
      /* Keep the picker name. */
    }
    return {
      directory: selected.uri,
      name: (name || '所选文件夹').slice(0, 120),
    };
  } catch (error) {
    if (error instanceof Error && /cancel/i.test(error.message)) return null;
    throw error;
  }
}
export const backupFiles: BackupFiles = {
  async write(directory, name, payload) {
    const file = new Directory(directory).createFile(name, 'application/json');
    try {
      const handle = file.open(FileMode.WriteOnly);
      try {
        await handle.writeBytes(new TextEncoder().encode(payload));
      } finally {
        handle.close();
      }
      return { name: file.name, uri: file.uri };
    } catch (error) {
      try {
        file.delete();
      } catch {
        /* Keep existing archives. */
      }
      throw error;
    }
  },
  read: async (file) => new File(file.uri).text(),
  list: async (directory) =>
    new Directory(directory)
      .list()
      .filter((item): item is File => item instanceof File)
      .map((file) => ({ name: file.name, uri: file.uri })),
  remove: async (file) => {
    new File(file.uri).delete();
  },
};
