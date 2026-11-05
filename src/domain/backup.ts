/** A shared byte limit keeps native, web and self-exported JSON consistent. */
export const MAX_BACKUP_BYTES = 64_000_000;
export function assertBackupSize(bytes: number) {
  if (bytes > MAX_BACKUP_BYTES) throw new Error('备份文件不能超过 64 MB');
}
export function utf8ByteLength(text: string): number {
  let bytes = 0;
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    if (code <= 0x7f) bytes++;
    else if (code <= 0x7ff) bytes += 2;
    else if (
      code >= 0xd800 &&
      code <= 0xdbff &&
      index + 1 < text.length &&
      text.charCodeAt(index + 1) >= 0xdc00 &&
      text.charCodeAt(index + 1) <= 0xdfff
    ) {
      bytes += 4;
      index++;
    } else bytes += 3;
  }
  return bytes;
}
export function assertBackupTextSize(text: string) {
  assertBackupSize(text.length);
  assertBackupSize(utf8ByteLength(text));
}
