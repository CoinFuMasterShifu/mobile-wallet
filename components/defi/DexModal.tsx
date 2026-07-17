import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { defiStyles } from './defiStyles';
import DefiModalShell from './DefiModalShell';
import SpendableBalanceDisplay from '../SpendableBalanceDisplay';
import {
  amountExceedsAvailable,
  formatBalanceBreakdown,
  insufficientFreeBalanceMessage,
  isValidAssetHash,
  normalizeAssetHash,
} from '../../utils/warthogFormat';
import {
  computePoolSpotPrice,
  fetchAssetBalanceForAddress,
  fetchDexMarket,
  fetchLiquidityBalance,
} from '../../utils/defiApi';
import { createWarthogApi } from '../../utils/api';
import DexPoolMarketCard from './DexPoolMarketCard';
import DexLpSharesCard from './DexLpSharesCard';
import {
  submitLimitSwap,
  submitLiquidityDeposit,
  submitLiquidityWithdraw,
} from '../../utils/defiSubmit';
import { DEFAULT_FEE } from '../../constants';
import type { DexPoolPrefill, WalletData } from '../../types';
import { theme } from '../../theme';
import LimitPriceEncoder from './LimitPriceEncoder';

interface Props {
  visible: boolean;
  onClose: () => void;
  wallet: WalletData;
  selectedNode: string;
  nextNonce: number;
  poolPrefill: DexPoolPrefill | null;
  onPrefillConsumed: () => void;
  onSuccess: (nonce: number) => Promise<void>;
}

type DexTab = 'limit' | 'liquidity' | 'market';

type LimitSpendable = {
  side: 'buy' | 'sell';
  unit: string;
  available: string;
  locked: string;
  total: string;
  hasLocked: boolean;
  decimals?: number;
};

const DEX_TABS: { id: DexTab; label: string }[] = [
  { id: 'limit', label: 'Limit Order' },
  { id: 'liquidity', label: 'Liquidity' },
  { id: 'market', label: 'Market' },
];

const DexModal: React.FC<Props> = ({
  visible,
  onClose,
  wallet,
  selectedNode,
  nextNonce,
  poolPrefill,
  onPrefillConsumed,
  onSuccess,
}) => {
  const [tab, setTab] = useState<DexTab>('limit');
  const [assetHash, setAssetHash] = useState('');
  const [assetName, setAssetName] = useState('');
  const [decimals, setDecimals] = useState('8');
  const [fee, setFee] = useState(DEFAULT_FEE);
  const [manualNonce, setManualNonce] = useState('');
  const [loading, setLoading] = useState(false);
  const [marketData, setMarketData] = useState<any>(null);
  const [lpBalance, setLpBalance] = useState<string | null>(null);

  const [limitMode, setLimitMode] = useState<'buy' | 'sell'>('buy');
  const [limitAmount, setLimitAmount] = useState('');
  const [limitPriceHuman, setLimitPriceHuman] = useState('');
  const [limitEncoded, setLimitEncoded] = useState('');
  const [limitSpendable, setLimitSpendable] = useState<LimitSpendable | null>(null);
  const [limitSpendableLoading, setLimitSpendableLoading] = useState(false);

  // Deposit form free balances
  const [depositWartFree, setDepositWartFree] = useState<LimitSpendable | null>(null);
  const [depositAssetFree, setDepositAssetFree] = useState<LimitSpendable | null>(null);

  const [liqMode, setLiqMode] = useState<'deposit' | 'withdraw'>('deposit');
  const [assetAmount, setAssetAmount] = useState('');
  const [wartAmount, setWartAmount] = useState('');
  const [lpShares, setLpShares] = useState('');

  const refreshLimitSpendable = useCallback(
    async ({ silent = false } = {}): Promise<LimitSpendable | null> => {
      if (!wallet?.address || !selectedNode) {
        setLimitSpendable(null);
        return null;
      }

      const isBuy = limitMode === 'buy';
      const hash = normalizeAssetHash(assetHash);
      if (!isBuy && !isValidAssetHash(hash)) {
        setLimitSpendable(null);
        return null;
      }

      if (!silent) setLimitSpendableLoading(true);
      try {
        if (isBuy) {
          const api = createWarthogApi(selectedNode);
          const res = await api.getAccountWartBalance(wallet.address);
          if (!res.success) throw new Error(res.error || 'Failed to fetch WART balance');
          const data = res.data as { wart?: unknown };
          const breakdown = formatBalanceBreakdown(data?.wart, { kind: 'wart' });
          const info: LimitSpendable = {
            side: 'buy',
            unit: 'WART',
            available: breakdown.available,
            locked: breakdown.locked,
            total: breakdown.total,
            hasLocked: breakdown.hasLocked,
            decimals: 8,
          };
          setLimitSpendable(info);
          return info;
        }

        const bal = await fetchAssetBalanceForAddress(
          selectedNode,
          wallet.address,
          hash,
          assetName
        );
        const info: LimitSpendable = {
          side: 'sell',
          unit: bal.name || assetName || 'asset',
          available: bal.available,
          locked: bal.locked,
          total: bal.balance,
          hasLocked: Boolean(bal.hasLocked),
          decimals: bal.decimals,
        };
        setLimitSpendable(info);
        if (bal.name) setAssetName(bal.name);
        if (bal.decimals != null) setDecimals(String(bal.decimals));
        return info;
      } catch {
        setLimitSpendable(null);
        return null;
      } finally {
        if (!silent) setLimitSpendableLoading(false);
      }
    },
    [wallet?.address, selectedNode, limitMode, assetHash, assetName]
  );

  const refreshDepositBalances = useCallback(async (): Promise<{
    wart: LimitSpendable | null;
    asset: LimitSpendable | null;
  }> => {
    if (!wallet?.address || !selectedNode) {
      return { wart: null, asset: null };
    }
    let wart: LimitSpendable | null = null;
    let asset: LimitSpendable | null = null;
    try {
      const api = createWarthogApi(selectedNode);
      const wartRes = await api.getAccountWartBalance(wallet.address);
      if (wartRes.success) {
        const data = wartRes.data as { wart?: unknown };
        const breakdown = formatBalanceBreakdown(data?.wart, { kind: 'wart' });
        wart = {
          side: 'buy',
          unit: 'WART',
          available: breakdown.available,
          locked: breakdown.locked,
          total: breakdown.total,
          hasLocked: breakdown.hasLocked,
        };
        setDepositWartFree(wart);
      }
      const hash = normalizeAssetHash(assetHash);
      if (isValidAssetHash(hash)) {
        const bal = await fetchAssetBalanceForAddress(
          selectedNode,
          wallet.address,
          hash,
          assetName
        );
        asset = {
          side: 'sell',
          unit: bal.name || assetName || 'asset',
          available: bal.available,
          locked: bal.locked,
          total: bal.balance,
          hasLocked: Boolean(bal.hasLocked),
          decimals: bal.decimals,
        };
        setDepositAssetFree(asset);
      }
    } catch {
      // non-fatal
    }
    return { wart, asset };
  }, [wallet?.address, selectedNode, assetHash, assetName]);

  const loadMarketForHash = useCallback(async (hashInput: string) => {
    const hash = hashInput.trim();
    if (!isValidAssetHash(hash)) return;

    setLoading(true);
    setMarketData(null);
    setLpBalance(null);
    try {
      const [market, lp] = await Promise.all([
        fetchDexMarket(selectedNode, hash),
        fetchLiquidityBalance(selectedNode, wallet.address, hash),
      ]);
      setMarketData(market);
      if (lp) {
        setLpBalance(lp.balance);
        setAssetName(lp.name);
        setDecimals(String(lp.decimals));
      }
      const asset = (market as any)?.asset || (market as any)?.baseAsset;
      if (asset?.name) setAssetName(asset.name);
      if (asset?.decimals != null) setDecimals(String(asset.decimals));
      const spotPrice = computePoolSpotPrice(market as any);
      if (spotPrice != null && spotPrice > 0) {
        setLimitPriceHuman(String(spotPrice));
      }
    } catch (e: any) {
      Alert.alert('Failed', e.message);
    } finally {
      setLoading(false);
    }
  }, [selectedNode, wallet.address]);

  useEffect(() => {
    if (!visible) return;
    if (poolPrefill) {
      setAssetHash(poolPrefill.hash);
      setAssetName(poolPrefill.name);
      setTab('liquidity');
      onPrefillConsumed();
      loadMarketForHash(poolPrefill.hash);
      return;
    }
    setTab('limit');
  }, [visible, poolPrefill, onPrefillConsumed, loadMarketForHash]);

  // Refresh free/locked when limit tab mode/hash changes
  useEffect(() => {
    if (!visible || tab !== 'limit') return;
    const t = setTimeout(() => {
      refreshLimitSpendable({ silent: true });
    }, 250);
    return () => clearTimeout(t);
  }, [visible, tab, limitMode, assetHash, selectedNode, refreshLimitSpendable]);

  useEffect(() => {
    if (!visible || tab !== 'liquidity' || liqMode !== 'deposit') return;
    const t = setTimeout(() => {
      refreshDepositBalances();
    }, 250);
    return () => clearTimeout(t);
  }, [visible, tab, liqMode, assetHash, selectedNode, refreshDepositBalances]);

  const loadMarket = async () => {
    if (!isValidAssetHash(assetHash)) {
      Alert.alert('Invalid hash', 'Enter a 64-character asset hash');
      return;
    }
    await loadMarketForHash(assetHash);
    await refreshLimitSpendable({ silent: true });
    if (tab === 'liquidity') await refreshDepositBalances();
  };

  const getNonce = () => (manualNonce ? parseInt(manualNonce, 10) : nextNonce);

  const handleLimitOrder = async () => {
    if (!limitAmount || !limitEncoded.trim()) {
      Alert.alert('Missing fields', 'Amount and encoded limit price are required');
      return;
    }
    setLoading(true);
    try {
      // Live free-balance check before signing
      const spendable = await refreshLimitSpendable({ silent: true });
      const amountStr = limitAmount.trim();
      if (spendable && amountExceedsAvailable(amountStr, spendable.available)) {
        const msg = insufficientFreeBalanceMessage({
          available: spendable.available,
          locked: spendable.locked,
          unit: spendable.unit,
        });
        setLimitAmount(spendable.available);
        Alert.alert('Insufficient free balance', msg);
        return;
      }

      let assetDecimals = parseInt(decimals, 10) || 8;
      if (spendable?.decimals != null && limitMode === 'sell') {
        assetDecimals = spendable.decimals;
      }

      const result = await submitLimitSwap({
        node: selectedNode,
        wallet,
        nonceId: getNonce(),
        fee,
        assetHash,
        isBuy: limitMode === 'buy',
        amount: amountStr,
        assetDecimals,
        limitHex: limitEncoded.trim(),
      });
      await onSuccess(result.nonce + 1);
      Alert.alert(
        'Submitted',
        `${limitMode === 'buy' ? 'Buy' : 'Sell'} order: ${result.txHash.slice(0, 20)}…\nBalance may stay locked until the order fills.`
      );
      setLimitAmount('');
      setLimitPriceHuman('');
      setLimitEncoded('');
      setManualNonce('');
      refreshLimitSpendable({ silent: true });
    } catch (e: any) {
      let message = e.message || 'Failed';
      if (/insufficient\s+(token\s+)?balance/i.test(message)) {
        const spendable = limitSpendable || (await refreshLimitSpendable({ silent: true }));
        if (spendable) {
          message = insufficientFreeBalanceMessage({
            available: spendable.available,
            locked: spendable.locked,
            unit: spendable.unit,
          });
        }
      }
      Alert.alert('Failed', message);
    } finally {
      setLoading(false);
    }
  };

  const handleLiquidity = async () => {
    setLoading(true);
    try {
      let result;
      if (liqMode === 'deposit') {
        if (!assetAmount || !wartAmount) throw new Error('Asset and WART amounts required');
        const liveDeposit = await refreshDepositBalances();
        if (
          liveDeposit.wart &&
          amountExceedsAvailable(wartAmount.trim(), liveDeposit.wart.available)
        ) {
          const msg = insufficientFreeBalanceMessage({
            available: liveDeposit.wart.available,
            locked: liveDeposit.wart.locked,
            unit: 'WART',
          });
          setWartAmount(liveDeposit.wart.available);
          Alert.alert('Insufficient free balance', msg);
          return;
        }
        if (
          liveDeposit.asset &&
          amountExceedsAvailable(assetAmount.trim(), liveDeposit.asset.available)
        ) {
          const msg = insufficientFreeBalanceMessage({
            available: liveDeposit.asset.available,
            locked: liveDeposit.asset.locked,
            unit: liveDeposit.asset.unit,
          });
          setAssetAmount(liveDeposit.asset.available);
          Alert.alert('Insufficient free balance', msg);
          return;
        }
        result = await submitLiquidityDeposit({
          node: selectedNode,
          wallet,
          nonceId: getNonce(),
          fee,
          assetHash,
          assetAmount,
          decimals: parseInt(decimals, 10) || 8,
          wartAmount,
        });
      } else {
        if (!lpShares) throw new Error('LP shares amount required');
        result = await submitLiquidityWithdraw({
          node: selectedNode,
          wallet,
          nonceId: getNonce(),
          fee,
          assetHash,
          shares: lpShares,
        });
      }
      await onSuccess(result.nonce + 1);
      Alert.alert('Submitted', `Liquidity ${liqMode}: ${result.txHash.slice(0, 20)}…`);
      setAssetAmount('');
      setWartAmount('');
      setLpShares('');
      setManualNonce('');
      await loadMarket();
    } catch (e: any) {
      let message = e.message || 'Failed';
      if (/insufficient\s+(token\s+)?balance/i.test(message)) {
        message = 'Insufficient free balance — some funds may be locked in open orders.';
      }
      Alert.alert('Failed', message);
    } finally {
      setLoading(false);
    }
  };

  const freeForLimit = limitSpendable?.available;
  const unitForLimit =
    limitMode === 'buy' ? 'WART' : limitSpendable?.unit || assetName || 'Token';

  return (
    <DefiModalShell
      visible={visible}
      onClose={onClose}
      title="DEX"
      subtitle="Limit orders: enter price + decimals, tap Encode, then submit the 6-char hex"
    >
          <View style={defiStyles.tabRow}>
            {DEX_TABS.map((t) => (
              <TouchableOpacity key={t.id} style={[defiStyles.tab, tab === t.id && defiStyles.tabActive]} onPress={() => setTab(t.id)}>
                <Text style={[defiStyles.tabText, tab === t.id && defiStyles.tabTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={defiStyles.label}>Asset Hash</Text>
          <TextInput style={defiStyles.input} value={assetHash} onChangeText={setAssetHash} autoCapitalize="none" placeholderTextColor={theme.colors.textMuted} />
          <TouchableOpacity style={defiStyles.btn} onPress={loadMarket} disabled={loading}>
            <Text style={defiStyles.btnText}>{loading ? 'Loading…' : 'Load Market'}</Text>
          </TouchableOpacity>

          {marketData ? (
            <>
              <DexPoolMarketCard marketData={marketData} assetName={assetName} assetHash={assetHash} />
              <DexLpSharesCard lpBalance={lpBalance} assetName={assetName} />
            </>
          ) : null}

          {tab === 'market' && (
            <Text style={{ color: theme.colors.textMuted, fontSize: theme.typography.caption }}>
              Load a market above to view pool reserves and spot price. Use Limit Order or Liquidity tabs to trade.
            </Text>
          )}

          {tab === 'limit' && (
            <View>
              <View style={defiStyles.tabRow}>
                <TouchableOpacity style={[defiStyles.tab, limitMode === 'buy' && defiStyles.tabActive]} onPress={() => setLimitMode('buy')}>
                  <Text style={[defiStyles.tabText, limitMode === 'buy' && defiStyles.tabTextActive]}>Buy (WART→Asset)</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[defiStyles.tab, limitMode === 'sell' && defiStyles.tabActive]} onPress={() => setLimitMode('sell')}>
                  <Text style={[defiStyles.tabText, limitMode === 'sell' && defiStyles.tabTextActive]}>Sell (Asset→WART)</Text>
                </TouchableOpacity>
              </View>

              {limitSpendableLoading ? (
                <ActivityIndicator color={theme.colors.primary} style={{ marginBottom: theme.spacing.sm }} />
              ) : limitSpendable ? (
                <SpendableBalanceDisplay
                  available={limitSpendable.available}
                  locked={limitSpendable.locked}
                  total={limitSpendable.total}
                  unit={limitSpendable.unit}
                  label={limitMode === 'buy' ? 'Available WART' : `Available ${limitSpendable.unit}`}
                  layout="stack"
                />
              ) : null}

              <Text style={defiStyles.label}>
                {limitMode === 'buy' ? 'WART amount' : `${assetName || 'Token'} amount`}
              </Text>
              <TextInput style={defiStyles.input} value={limitAmount} onChangeText={setLimitAmount} keyboardType="decimal-pad" placeholderTextColor={theme.colors.textMuted} />
              {freeForLimit ? (
                <TouchableOpacity
                  style={[defiStyles.btn, defiStyles.btnSecondary]}
                  onPress={() => setLimitAmount(freeForLimit)}
                >
                  <Text style={defiStyles.btnTextSecondary}>Use available ({unitForLimit})</Text>
                </TouchableOpacity>
              ) : null}

              <LimitPriceEncoder
                assetName={assetName}
                price={limitPriceHuman}
                decimals={decimals}
                encoded={limitEncoded}
                onPriceChange={setLimitPriceHuman}
                onDecimalsChange={setDecimals}
                onEncodedChange={setLimitEncoded}
                accent={limitMode === 'buy' ? 'buy' : 'sell'}
              />

              <Text style={defiStyles.label}>Fee • Nonce (auto: {nextNonce})</Text>
              <TextInput style={defiStyles.input} value={fee} onChangeText={setFee} keyboardType="decimal-pad" placeholderTextColor={theme.colors.textMuted} />
              <TextInput style={defiStyles.input} value={manualNonce} onChangeText={setManualNonce} keyboardType="number-pad" placeholder="Optional nonce" placeholderTextColor={theme.colors.textMuted} />
              <TouchableOpacity style={defiStyles.btn} onPress={handleLimitOrder} disabled={loading}>
                <Text style={defiStyles.btnText}>Place {limitMode === 'buy' ? 'Buy' : 'Sell'} Order</Text>
              </TouchableOpacity>
            </View>
          )}

          {tab === 'liquidity' && (
            <View>
              <View style={defiStyles.tabRow}>
                <TouchableOpacity style={[defiStyles.tab, liqMode === 'deposit' && defiStyles.tabActive]} onPress={() => setLiqMode('deposit')}>
                  <Text style={[defiStyles.tabText, liqMode === 'deposit' && defiStyles.tabTextActive]}>Deposit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[defiStyles.tab, liqMode === 'withdraw' && defiStyles.tabActive]} onPress={() => setLiqMode('withdraw')}>
                  <Text style={[defiStyles.tabText, liqMode === 'withdraw' && defiStyles.tabTextActive]}>Withdraw</Text>
                </TouchableOpacity>
              </View>
              <Text style={defiStyles.label}>Asset decimals / precision</Text>
              <TextInput
                style={defiStyles.input}
                value={decimals}
                onChangeText={setDecimals}
                keyboardType="number-pad"
                placeholderTextColor={theme.colors.textMuted}
              />

              {liqMode === 'deposit' ? (
                <>
                  {depositAssetFree ? (
                    <SpendableBalanceDisplay
                      available={depositAssetFree.available}
                      locked={depositAssetFree.locked}
                      total={depositAssetFree.total}
                      unit={depositAssetFree.unit}
                      label={`Available ${depositAssetFree.unit}`}
                      layout="stack"
                    />
                  ) : null}
                  <Text style={defiStyles.label}>{assetName || 'Asset'} amount</Text>
                  <TextInput style={defiStyles.input} value={assetAmount} onChangeText={setAssetAmount} keyboardType="decimal-pad" placeholderTextColor={theme.colors.textMuted} />
                  {depositAssetFree?.available ? (
                    <TouchableOpacity
                      style={[defiStyles.btn, defiStyles.btnSecondary]}
                      onPress={() => setAssetAmount(depositAssetFree.available)}
                    >
                      <Text style={defiStyles.btnTextSecondary}>Use available asset</Text>
                    </TouchableOpacity>
                  ) : null}

                  {depositWartFree ? (
                    <SpendableBalanceDisplay
                      available={depositWartFree.available}
                      locked={depositWartFree.locked}
                      total={depositWartFree.total}
                      unit="WART"
                      label="Available WART"
                      layout="stack"
                    />
                  ) : null}
                  <Text style={defiStyles.label}>WART amount</Text>
                  <TextInput style={defiStyles.input} value={wartAmount} onChangeText={setWartAmount} keyboardType="decimal-pad" placeholderTextColor={theme.colors.textMuted} />
                  {depositWartFree?.available ? (
                    <TouchableOpacity
                      style={[defiStyles.btn, defiStyles.btnSecondary]}
                      onPress={() => setWartAmount(depositWartFree.available)}
                    >
                      <Text style={defiStyles.btnTextSecondary}>Use available WART</Text>
                    </TouchableOpacity>
                  ) : null}
                </>
              ) : (
                <>
                  <Text style={defiStyles.label}>LP shares to withdraw {lpBalance ? `(you have ${lpBalance})` : ''}</Text>
                  <TextInput style={defiStyles.input} value={lpShares} onChangeText={setLpShares} keyboardType="decimal-pad" placeholderTextColor={theme.colors.textMuted} />
                  {lpBalance ? (
                    <TouchableOpacity style={[defiStyles.btn, defiStyles.btnSecondary]} onPress={() => setLpShares(lpBalance)}>
                      <Text style={defiStyles.btnTextSecondary}>Max</Text>
                    </TouchableOpacity>
                  ) : null}
                </>
              )}
              <Text style={defiStyles.label}>Fee • Nonce (auto: {nextNonce})</Text>
              <TextInput style={defiStyles.input} value={fee} onChangeText={setFee} keyboardType="decimal-pad" placeholderTextColor={theme.colors.textMuted} />
              <TextInput style={defiStyles.input} value={manualNonce} onChangeText={setManualNonce} keyboardType="number-pad" placeholder="Optional nonce" placeholderTextColor={theme.colors.textMuted} />
              <TouchableOpacity style={defiStyles.btn} onPress={handleLiquidity} disabled={loading}>
                <Text style={defiStyles.btnText}>{liqMode === 'deposit' ? 'Deposit Liquidity' : 'Withdraw Liquidity'}</Text>
              </TouchableOpacity>
            </View>
          )}

          {loading && <ActivityIndicator color={theme.colors.primary} style={{ marginTop: theme.spacing.md }} />}
    </DefiModalShell>
  );
};

export default DexModal;
