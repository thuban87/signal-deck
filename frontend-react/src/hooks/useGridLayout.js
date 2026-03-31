import { useState, useCallback, useMemo } from 'react';
import useLocalStorage from './useLocalStorage';
import { isMobile } from '../utils/formatters';

export default function useGridLayout(layoutKey, defaultLayout) {
  const mobileKey = layoutKey + '_mobile';
  const currentKey = isMobile() ? mobileKey : layoutKey;
  const [savedLayout, setSavedLayout] = useLocalStorage(currentKey, null);
  const [editMode, setEditMode] = useState(false);

  const layout = useMemo(() => {
    if (!savedLayout) return defaultLayout;
    // Merge in any widgets from defaults that aren't in the saved layout
    const savedKeys = new Set(savedLayout.map(item => item.i));
    const missing = defaultLayout.filter(item => !savedKeys.has(item.i));
    return missing.length > 0 ? [...savedLayout, ...missing] : savedLayout;
  }, [savedLayout, defaultLayout]);

  const onLayoutChange = useCallback(
    (newLayout) => {
      setSavedLayout(newLayout);
    },
    [setSavedLayout]
  );

  const toggleEditMode = useCallback(() => {
    setEditMode((prev) => !prev);
  }, []);

  const resetLayout = useCallback(() => {
    setSavedLayout(null);
    localStorage.removeItem(currentKey);
  }, [setSavedLayout, currentKey]);

  return {
    layout,
    editMode,
    onLayoutChange,
    toggleEditMode,
    resetLayout,
  };
}
