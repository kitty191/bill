import React, { useState } from 'react';
import { TextInput } from 'react-native';
import { type EncryptedBackup } from '../domain/encryptedBackup';
import { type Ledger } from '../domain/ledger';
import { exportEncryptedLedger } from '../storage/backup';
import { useTheme } from '../theme';
import { Sheet } from './Sheet';
import { Button, Txt } from './ui';

type PasswordAction =
  | { ledger: Ledger; onExport: () => Promise<void> }
  | {
      encrypted: EncryptedBackup;
      onDecode: (ledger: Ledger) => void;
    };

export function BackupPasswordSheet({
  action,
  onClose,
}: {
  action: PasswordAction;
  onClose: () => void;
}) {
  const t = useTheme();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const exporting = 'ledger' in action;
  const input = {
    minHeight: 46,
    color: t.text,
    backgroundColor: t.surfaceAlt,
    borderRadius: 13,
    paddingHorizontal: 13,
    marginBottom: 10,
  };
  const submit = async () => {
    if (busy) return;
    if (exporting && password !== confirmation) {
      setError('两次输入的密码不同');
      return;
    }
    setBusy(true);
    setError('');
    try {
      if ('ledger' in action) {
        await exportEncryptedLedger(action.ledger, password);
        await action.onExport();
      } else {
        const { decryptLedger } = await import('../domain/encryptedBackup');
        action.onDecode(await decryptLedger(action.encrypted, password));
      }
      onClose();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : '处理加密备份失败');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet
      visible
      title={exporting ? '导出加密备份' : '解锁加密备份'}
      onClose={onClose}
      dismissible={!busy}
    >
      {exporting && (
        <Txt size={12} style={{ marginBottom: 10 }}>
          使用至少 12 个字符。恢复时需要原密码，请妥善保存。
        </Txt>
      )}
      <TextInput
        accessibilityLabel="备份密码"
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
        editable={!busy}
        maxLength={128}
        value={password}
        onChangeText={setPassword}
        style={input}
      />
      {exporting && (
        <TextInput
          accessibilityLabel="再次输入备份密码"
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          editable={!busy}
          maxLength={128}
          value={confirmation}
          onChangeText={setConfirmation}
          style={input}
        />
      )}
      {!!error && (
        <Txt size={12} color={t.danger} style={{ marginBottom: 8 }}>
          {error}
        </Txt>
      )}
      <Button disabled={busy || !password} onPress={() => void submit()}>
        {busy ? '正在处理…' : exporting ? '加密并导出' : '解锁并预览'}
      </Button>
    </Sheet>
  );
}
