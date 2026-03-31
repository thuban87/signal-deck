import { useState, useCallback } from 'react';

export default function useLocalStorage(key, defaultValue) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  const set = useCallback(
    (newValue) => {
      setValue((prev) => {
        const val = typeof newValue === 'function' ? newValue(prev) : newValue;
        localStorage.setItem(key, JSON.stringify(val));
        return val;
      });
    },
    [key]
  );

  const remove = useCallback(() => {
    localStorage.removeItem(key);
    setValue(defaultValue);
  }, [key, defaultValue]);

  return [value, set, remove];
}
