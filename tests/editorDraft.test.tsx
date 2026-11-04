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
  notificationAsync: vi.fn(() => Promise.resolve()),
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
  Sheet: ({
    children,
    footer,
  }: {
    children: React.ReactNode;
    footer?: React.ReactNode;
  }) =>
    mocks.visible ? (
      <>
        {children}
        {footer}
      </>
    ) : null,
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
  expect(
    renderer.root.findAllByProps({ accessibilityLabel: '打开金额计算器' }),
  ).toHaveLength(0);
  await act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: '金额' })
      .props.onChangeText('(26+15)/2');
  });
  mocks.visible = false;
  await act(async () => {
    renderer.update(<EntryEditor {...props} />);
  });
  expect(
    renderer.root.findAllByProps({ accessibilityLabel: '金额' }),
  ).toHaveLength(0);
  mocks.visible = true;
  await act(async () => {
    renderer.update(<EntryEditor {...props} />);
  });
  expect(
    renderer.root.findByProps({ accessibilityLabel: '金额' }).props.value,
  ).toBe('(26+15)/2');
  await act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: '计算结果' })
      .props.onPress();
  });
  expect(
    renderer.root.findByProps({ accessibilityLabel: '金额' }).props.value,
  ).toBe('20.50');
  expect(mocks.update).not.toHaveBeenCalled();
});

it('records an expression directly with the primary button, without an equals or apply step', async () => {
  mocks.ledger = emptyLedger();
  mocks.visible = true;
  mocks.update.mockImplementation(async (change) => {
    mocks.ledger = change(mocks.ledger);
  });
  const props = { onClose: vi.fn(), onRefund: vi.fn(), onSaved: vi.fn() };
  await act(async () => {
    renderer = create(<EntryEditor {...props} />);
  });
  await act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: '金额' })
      .props.onChangeText('(26+15)/2');
  });
  await act(async () => {
    await renderer.root
      .findByProps({ accessibilityLabel: '记好了' })
      .props.onPress();
  });
  expect(
    (mocks.ledger as ReturnType<typeof emptyLedger>).entries[0]?.amount,
  ).toBe(2050);
  expect(props.onClose).toHaveBeenCalledOnce();
  const recorded = (mocks.ledger as ReturnType<typeof emptyLedger>).entries[0]!;
  expect(props.onSaved).toHaveBeenCalledWith(
    '已记好',
    recorded.date,
    recorded.id,
  );
});

it('does not expose a saved-entry action on write failure, and targets the actual saved record after retry', async () => {
  mocks.ledger = emptyLedger();
  mocks.visible = true;
  mocks.update.mockReset();
  mocks.update
    .mockRejectedValueOnce(new Error('存储空间不足'))
    .mockImplementation(async (change) => {
      mocks.ledger = change(mocks.ledger);
    });
  const props = { onClose: vi.fn(), onRefund: vi.fn(), onSaved: vi.fn() };
  await act(async () => {
    renderer = create(<EntryEditor {...props} />);
  });
  await act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: '金额' })
      .props.onChangeText('12.34');
  });
  await act(async () => {
    await renderer.root
      .findByProps({ accessibilityLabel: '记好了' })
      .props.onPress();
  });
  expect(props.onSaved).not.toHaveBeenCalled();
  expect(props.onClose).not.toHaveBeenCalled();
  expect((mocks.ledger as ReturnType<typeof emptyLedger>).entries).toHaveLength(
    0,
  );
  await act(async () => {
    await renderer.root
      .findByProps({ accessibilityLabel: '记好了' })
      .props.onPress();
  });
  const recorded = (mocks.ledger as ReturnType<typeof emptyLedger>).entries[0]!;
  expect(recorded.amount).toBe(1234);
  expect(props.onSaved).toHaveBeenCalledExactlyOnceWith(
    '已记好',
    recorded.date,
    recorded.id,
  );
});

it('commits one entry when save is pressed twice before persistence or the exit animation completes', async () => {
  mocks.ledger = emptyLedger();
  mocks.visible = true;
  mocks.update.mockReset();
  let finish: () => void = () => {};
  mocks.update.mockImplementation(
    (change) =>
      new Promise<void>((resolve) => {
        finish = () => {
          mocks.ledger = change(mocks.ledger);
          resolve();
        };
      }),
  );
  const props = { onClose: vi.fn(), onRefund: vi.fn(), onSaved: vi.fn() };
  await act(async () => {
    renderer = create(<EntryEditor {...props} />);
  });
  await act(async () =>
    renderer.root
      .findByProps({ accessibilityLabel: '金额' })
      .props.onChangeText('12.34'),
  );
  const save = renderer.root.findByProps({ accessibilityLabel: '记好了' }).props
    .onPress;
  await act(async () => {
    save();
    save();
  });
  expect(mocks.update).toHaveBeenCalledOnce();
  await act(async () => finish());
  await act(async () => save());
  expect((mocks.ledger as ReturnType<typeof emptyLedger>).entries).toHaveLength(
    1,
  );
  expect(mocks.update).toHaveBeenCalledOnce();
  expect(props.onSaved).toHaveBeenCalledOnce();
  expect(props.onClose).toHaveBeenCalledOnce();
});
