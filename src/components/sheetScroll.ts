import {
  createContext,
  useContext,
  type RefObject,
  type ComponentRef,
} from 'react';
import type { View } from 'react-native';

export type SheetView = ComponentRef<typeof View>;
export const SheetScrollContext = createContext<
  (target: RefObject<SheetView | null>) => void
>(() => {});
export const useSheetScroll = () => useContext(SheetScrollContext);
