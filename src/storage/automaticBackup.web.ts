import {
  defaultBackupPreferences,
  validateBackupPreferences,
  type BackupFiles,
  type BackupPreferences,
} from '../domain/automaticBackup';
import { id } from '../domain/ledger';
type DirectoryHandle = FileSystemDirectoryHandle & {
  queryPermission: (options: { mode: 'readwrite' }) => Promise<PermissionState>;
  values: () => AsyncIterableIterator<FileSystemHandle>;
};
type Picker = (options: {
  mode: 'readwrite';
  id: string;
}) => Promise<DirectoryHandle>;
const key = 'qingzhang.automatic-backup.v1';
export const automaticBackupSupported = () =>
  typeof (window as unknown as { showDirectoryPicker?: Picker })
    .showDirectoryPicker === 'function' && typeof indexedDB !== 'undefined';
export async function loadBackupPreferences() {
  const raw = localStorage.getItem(key);
  return raw === null
    ? defaultBackupPreferences()
    : validateBackupPreferences(JSON.parse(raw));
}
export async function saveBackupPreferences(value: BackupPreferences) {
  localStorage.setItem(key, JSON.stringify(validateBackupPreferences(value)));
}
async function directoryRecord(
  token: string,
  value?: DirectoryHandle,
): Promise<DirectoryHandle> {
  const connection = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('qingzhang.backup-directories', 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore('directories');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
  try {
    return await new Promise<DirectoryHandle>((resolve, reject) => {
      const transaction = connection.transaction(
        'directories',
        value ? 'readwrite' : 'readonly',
      );
      const store = transaction.objectStore('directories');
      const request = value ? store.put(value, token) : store.get(token);
      let result: DirectoryHandle;
      request.onsuccess = () => {
        result = value ?? request.result;
      };
      transaction.oncomplete = () =>
        result
          ? resolve(result)
          : reject(new Error('备份目录授权已失效，请重新选择目录'));
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () =>
        reject(transaction.error ?? new Error('无法保存目录授权'));
    });
  } finally {
    connection.close();
  }
}
async function directory(token: string) {
  const handle = await directoryRecord(token);
  if ((await handle.queryPermission({ mode: 'readwrite' })) !== 'granted')
    throw new Error('备份目录需要重新授权，请在设置中选择目录');
  return handle;
}
export async function pickBackupDirectory() {
  const picker = (window as unknown as { showDirectoryPicker?: Picker })
    .showDirectoryPicker;
  if (!picker)
    throw new Error('此浏览器不支持目录自动写入，请使用导出 JSON 备份');
  try {
    const handle = await picker({ mode: 'readwrite', id: 'qingzhang-backups' });
    const token = `directory-${id()}`;
    await directoryRecord(token, handle);
    return {
      directory: token,
      name: handle.name.slice(0, 120) || '所选文件夹',
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError')
      return null;
    throw error;
  }
}
const location = (file: { uri: string }) => {
  const split = file.uri.lastIndexOf('/');
  return {
    token: file.uri.slice(0, split),
    name: decodeURIComponent(file.uri.slice(split + 1)),
  };
};
export const backupFiles: BackupFiles = {
  async write(token, name, payload) {
    const handle = await directory(token);
    const file = await handle.getFileHandle(name, { create: true });
    let writer: FileSystemWritableFileStream | undefined;
    try {
      writer = await file.createWritable();
      await writer.write(payload);
      await writer.close();
    } catch (error) {
      await writer?.abort().catch(() => {});
      await handle.removeEntry(name).catch(() => {});
      throw error;
    }
    return { name, uri: `${token}/${encodeURIComponent(name)}` };
  },
  async read(file) {
    const { token, name } = location(file);
    return (
      await (await (await directory(token)).getFileHandle(name)).getFile()
    ).text();
  },
  async list(token) {
    const files = [];
    for await (const entry of (await directory(token)).values())
      if (entry.kind === 'file')
        files.push({
          name: entry.name,
          uri: `${token}/${encodeURIComponent(entry.name)}`,
        });
    return files;
  },
  async remove(file) {
    const { token, name } = location(file);
    await (await directory(token)).removeEntry(name);
  },
};
