import { useSyncExternalStore } from 'react';

const listeners = new Set<() => void>();
let now = Date.now();
let timer: number | undefined;
const snapshot = () => now;
const inactive = () => () => {};

const tick = () => {
  now = Date.now();
  listeners.forEach(listener => listener());
};

// All task counters share one clock; hidden tabs sleep and catch up on return.
const sync = () => {
  if (document.hidden) {
    window.clearInterval(timer);
    timer = undefined;
  } else {
    tick();
    timer ??= window.setInterval(tick, 1000);
  }
};

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('focus', sync);
    sync();
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      window.clearInterval(timer);
      timer = undefined;
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('focus', sync);
    }
  };
}

export function useDeadlineClock(active: boolean) {
  return useSyncExternalStore(active ? subscribe : inactive, snapshot, snapshot);
}
