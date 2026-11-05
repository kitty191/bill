import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { emptyLedger, type Ledger } from '../src/domain/ledger';

const mocks = vi.hoisted(() => ({
  platform: { OS: 'android' },
  pick: vi.fn(),
  read: vi.fn(),
  write: vi.fn(),
  share: vi.fn(),
}));
vi.mock('react-native', () => ({ Platform: mocks.platform }));
vi.mock('expo-document-picker', () => ({ getDocumentAsync: mocks.pick }));
vi.mock('expo-sharing', () => ({
  isAvailableAsync: async () => true,
  shareAsync: mocks.share,
}));
vi.mock('expo-file-system', () => ({
  Paths: { cache: '/cache' },
  File: class {
    uri = 'memory://backup.json';
    write = mocks.write;
    text = mocks.read;
  },
}));
import { exportLedger, importLedger } from '../src/storage/backup';
import { MAX_BACKUP_BYTES, utf8ByteLength } from '../src/domain/backup';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.platform.OS = 'android';
  mocks.pick.mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'memory://backup.json' }],
  });
  mocks.read.mockResolvedValue(JSON.stringify(emptyLedger()));
});
afterEach(() => vi.unstubAllGlobals());

it('can restore its own 50000-record JSON export with long Chinese notes', async () => {
  const ledger: Ledger = {
    ...emptyLedger(),
    entries: Array.from({ length: 50000 }, (_, i) => ({
      id: `entry-${i}`,
      kind: 'expense',
      amount: 101,
      categoryId: 'food',
      accountId: 'wechat',
      date: '2026-11-04',
      note: '记'.repeat(120),
      createdAt: '2026-11-04T04:00:00.000Z',
    })),
  };
  await exportLedger(ledger, 'json');
  const content = mocks.write.mock.calls[0]![0] as string;
  const bytes = Buffer.byteLength(content);
  expect(bytes).toBeGreaterThan(10_000_000);
  mocks.pick.mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'memory://backup.json', size: bytes }],
  });
  mocks.read.mockResolvedValue(content);
  const restored = await importLedger();
  expect(restored).toEqual(ledger);
  expect(mocks.share).toHaveBeenCalledOnce();
});

it.each(['android', 'web'])(
  'accepts a UTF-8 BOM on %s without changing the ledger',
  async (platform) => {
    mocks.platform.OS = platform;
    const ledger = emptyLedger();
    ledger.monthBudgets['2026-11'] = 12345;
    mocks.read.mockResolvedValue('\uFEFF' + JSON.stringify(ledger));
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, text: mocks.read })),
    );
    expect(await importLedger()).toEqual(ledger);
  },
);

it('rejects files over the shared byte limit before reading, including an unreported multibyte payload', async () => {
  mocks.pick.mockResolvedValueOnce({
    canceled: false,
    assets: [{ uri: 'memory://backup.json', size: MAX_BACKUP_BYTES + 1 }],
  });
  await expect(importLedger()).rejects.toThrow('64 MB');
  expect(mocks.read).not.toHaveBeenCalled();
  mocks.read.mockResolvedValue('汉'.repeat(22_000_000));
  await expect(importLedger()).rejects.toThrow('64 MB');
  expect(mocks.write).not.toHaveBeenCalled();
});

it('counts UTF-8 consistently for Chinese, emoji, control characters and unmatched surrogates', () => {
  for (const text of ['早餐😀', '\u0000\n', '\uD800x', '\uDC00', '普通备注']) {
    expect(utf8ByteLength(text)).toBe(Buffer.byteLength(text));
  }
});

it('rejects an unsupported version and a cancelled picker without writing data', async () => {
  mocks.read.mockResolvedValue(
    JSON.stringify({ ...emptyLedger(), version: 999 }),
  );
  await expect(importLedger()).rejects.toThrow('不支持此备份版本');
  mocks.pick.mockResolvedValue({ canceled: true });
  expect(await importLedger()).toBeNull();
  expect(mocks.write).not.toHaveBeenCalled();
});
