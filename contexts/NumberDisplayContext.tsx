import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  BrandColorStyles,
  DEFAULT_NUMBER_DISPLAY_PREFS,
  NumberDisplayMode,
  NumberDisplayPrefs,
  detectNumberDisplayMode,
  formatDisplayBalance,
  formatDisplayNumber,
  getBrandColorStyles,
  loadNumberDisplayPrefs,
  prefsForNumberDisplayMode,
  saveNumberDisplayPrefs,
} from '../utils/numberDisplay';

interface NumberDisplayContextValue {
  prefs: NumberDisplayPrefs;
  ready: boolean;
  setPrefs: (next: Partial<NumberDisplayPrefs> | ((prev: NumberDisplayPrefs) => Partial<NumberDisplayPrefs>)) => void;
  resetPrefs: () => void;
  applyMode: (modeId: NumberDisplayMode) => void;
  activeMode: NumberDisplayMode | null;
  numberColor: string;
  balanceColor: string;
  limitOrderBuyStyles: BrandColorStyles;
  limitOrderSellStyles: BrandColorStyles;
  liquidityPoolStyles: BrandColorStyles;
  formatNumber: (
    value: unknown,
    overrides?: { fallback?: string; maxDecimals?: number | null }
  ) => string;
  formatBalance: (
    value: unknown,
    overrides?: { fallback?: string; maxDecimals?: number | null }
  ) => string;
}

const NumberDisplayContext = createContext<NumberDisplayContextValue | null>(null);

export function NumberDisplayProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefsState] = useState<NumberDisplayPrefs>(DEFAULT_NUMBER_DISPLAY_PREFS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    loadNumberDisplayPrefs().then((loaded) => {
      if (mounted) {
        setPrefsState(loaded);
        setReady(true);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const setPrefs = useCallback(
    (next: Partial<NumberDisplayPrefs> | ((prev: NumberDisplayPrefs) => Partial<NumberDisplayPrefs>)) => {
      setPrefsState((prev) => {
        const patch = typeof next === 'function' ? next(prev) : next;
        const merged = { ...prev, ...patch };
        void saveNumberDisplayPrefs(merged);
        return merged;
      });
    },
    []
  );

  const resetPrefs = useCallback(() => {
    const defaults = { ...DEFAULT_NUMBER_DISPLAY_PREFS };
    setPrefsState(defaults);
    void saveNumberDisplayPrefs(defaults);
  }, []);

  const applyMode = useCallback((modeId: NumberDisplayMode) => {
    setPrefsState((prev) => {
      const next = {
        ...prefsForNumberDisplayMode(modeId),
        numberColor: prev.numberColor,
        balanceColor: prev.balanceColor,
        limitOrderBuyColor: prev.limitOrderBuyColor,
        limitOrderSellColor: prev.limitOrderSellColor,
        liquidityPoolColor: prev.liquidityPoolColor,
      };
      void saveNumberDisplayPrefs(next);
      return next;
    });
  }, []);

  const formatNumber = useCallback(
    (value: unknown, overrides?: { fallback?: string; maxDecimals?: number | null }) =>
      formatDisplayNumber(value, prefs, overrides),
    [prefs]
  );

  const formatBalance = useCallback(
    (value: unknown, overrides?: { fallback?: string; maxDecimals?: number | null }) =>
      formatDisplayBalance(value, prefs, overrides),
    [prefs]
  );

  const numberColor = useMemo(() => getBrandColorStyles(prefs.numberColor).text, [prefs.numberColor]);
  const balanceColor = useMemo(() => getBrandColorStyles(prefs.balanceColor).text, [prefs.balanceColor]);
  const limitOrderBuyStyles = useMemo(
    () => getBrandColorStyles(prefs.limitOrderBuyColor),
    [prefs.limitOrderBuyColor]
  );
  const limitOrderSellStyles = useMemo(
    () => getBrandColorStyles(prefs.limitOrderSellColor),
    [prefs.limitOrderSellColor]
  );
  const liquidityPoolStyles = useMemo(
    () => getBrandColorStyles(prefs.liquidityPoolColor),
    [prefs.liquidityPoolColor]
  );
  const activeMode = useMemo(() => detectNumberDisplayMode(prefs), [prefs]);

  const value = useMemo(
    () => ({
      prefs,
      ready,
      setPrefs,
      resetPrefs,
      applyMode,
      activeMode,
      numberColor,
      balanceColor,
      limitOrderBuyStyles,
      limitOrderSellStyles,
      liquidityPoolStyles,
      formatNumber,
      formatBalance,
    }),
    [
      prefs,
      ready,
      setPrefs,
      resetPrefs,
      applyMode,
      activeMode,
      numberColor,
      balanceColor,
      limitOrderBuyStyles,
      limitOrderSellStyles,
      liquidityPoolStyles,
      formatNumber,
      formatBalance,
    ]
  );

  return (
    <NumberDisplayContext.Provider value={value}>{children}</NumberDisplayContext.Provider>
  );
}

export function useNumberDisplay(): NumberDisplayContextValue {
  const ctx = useContext(NumberDisplayContext);
  if (!ctx) {
    throw new Error('useNumberDisplay must be used within NumberDisplayProvider');
  }
  return ctx;
}