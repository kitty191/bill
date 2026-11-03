import { createContext, useContext } from 'react';

export const PagerScrollLock = createContext({
  lock: () => {},
  unlock: () => {},
});
export const usePagerScrollLock = () => useContext(PagerScrollLock);
