import React, { act } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';
import { emptyLedger } from '../src/domain/ledger';

const mocks = vi.hoisted(() => ({
  visible: true,
  ledger: null as unknown,
  update: vi.fn(),
}));
vi.mock('react-native', () => ({
  View: 'View',
  TextInput: 'TextInput',
  ScrollView: 'ScrollView',
  Switch: 'Switch',
  Keyboard: { dismiss: vi.fn() },
}));
vi.mock('expo-haptics', () => ({
  notificationAsync: vi.fn(),
  NotificationFeedbackType: { Success: 1 },
}));
vi.mock('../src/state/LedgerProvider', () => ({
  useLedger: () => ({
    ledger: mocks.ledger,
    saving: false,
    update: mocks.update,
    removeEntry: vi.fn(),
  }),
}));
vi.mock('../src/theme', () => ({
  useTheme: () => ({
    text: '#123456',
    muted: '#123456',
    surfaceAlt: '#123456',
    accent: '#123456',
    surface: '#123456',
    border: '#123456',
    background: '#123456',
  }),
}));
vi.mock('../src/components/Sheet', () => ({
  Sheet: ({ children }: { children: React.ReactNode }) =>
    mocks.visible ? <>{children}</> : null,
}));
vi.mock('../src/components/ui', () => ({
  styles: { row: {} },
  Txt: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Icon: () => null,
  Button: ({
    children,
    onPress,
    label,
    disabled,
  }: {
    children: React.ReactNode;
    onPress: () => void;
    label?: string;
    disabled?: boolean;
  }) =>
    React.createElement(
      'button',
      {
        onPress,
        accessibilityLabel:
          label ?? (typeof children === 'string' ? children : ''),
        disabled,
      },
      children,
    ),
}));
import { EntryEditor } from '../src/components/EntryEditor';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;
let renderer: ReactTestRenderer;
afterEach(async () => {
  await act(async () => renderer.unmount());
});
it('retains an unapplied calculation when the locked native modal unmounts and returns', async () => {
  mocks.ledger = emptyLedger();
  mocks.update.mockReset();
  mocks.visible = true;
  const props = { onClose: vi.fn(), onRefund: vi.fn(), onSaved: vi.fn() };
  await act(async () => {
    renderer = create(<EntryEditor {...props} />);
  });
  await act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: '金额' })
      .props.onChangeText('8');
  });
  await act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: '打开金额计算器' })
      .props.onPress();
  });
  await act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: '计算表达式' })
      .props.onChangeText('(26+15)/2');
  });
  mocks.visible = false;
  await act(async () => {
    renderer.update(<EntryEditor {...props} />);
  });
  expect(
    renderer.root.findAllByProps({ accessibilityLabel: '计算表达式' }),
  ).toHaveLength(0);
  mocks.visible = true;
  await act(async () => {
    renderer.update(<EntryEditor {...props} />);
  });
  expect(
    renderer.root.findByProps({ accessibilityLabel: '计算表达式' }).props.value,
  ).toBe('(26+15)/2');
  await act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: '使用计算结果' })
      .props.onPress();
  });
  expect(
    renderer.root.findByProps({ accessibilityLabel: '金额' }).props.value,
  ).toBe('20.50');
  expect(mocks.update).not.toHaveBeenCalled();
});
