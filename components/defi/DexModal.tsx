import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { defiStyles } from './defiStyles';
import DefiModalShell from './DefiModalShell';
import { isValidAssetHash } from '../../utils/warthogFormat';
import { computePoolSpotPrice, fetchDexMarket, fetchLiquidityBalance } from '../../utils/defiApi';
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

  const [liqMode, setLiqMode] = useState<'deposit' | 'withdraw'>('deposit');
  const [assetAmount, setAssetAmount] = useState('');
  const [wartAmount, setWartAmount] = useState('');
  const [lpShares, setLpShares] = useState('');

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

  const loadMarket = async () => {
    if (!isValidAssetHash(assetHash)) {
      Alert.alert('Invalid hash', 'Enter a 64-character asset hash');
      return;
    }
    await loadMarketForHash(assetHash);
  };

  const getNonce = () => (manualNonce ? parseInt(manualNonce, 10) : nextNonce);

  const handleLimitOrder = async () => {
    if (!limitAmount || !limitEncoded.trim()) {
      Alert.alert('Missing fields', 'Amount and encoded limit price are required');
      return;
    }
    setLoading(true);
    try {
      const result = await submitLimitSwap({
        node: selectedNode,
        wallet,
        nonceId: getNonce(),
        fee,
        assetHash,
        isBuy: limitMode === 'buy',
        amount: limitAmount,
        assetDecimals: parseInt(decimals, 10) || 8,
        limitHex: limitEncoded.trim(),
      });
      await onSuccess(result.nonce + 1);
      Alert.alert('Submitted', `${limitMode === 'buy' ? 'Buy' : 'Sell'} order: ${result.txHash.slice(0, 20)}…`);
      setLimitAmount('');
      setLimitPriceHuman('');
      setLimitEncoded('');
      setManualNonce('');
    } catch (e: any) {
      Alert.alert('Failed', e.message);
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
      Alert.alert('Failed', e.message);
    } finally {
      setLoading(false);
    }
  };

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
              <Text style={defiStyles.label}>{limitMode === 'buy' ? 'WART amount' : `${assetName || 'Token'} amount`}</Text>
              <TextInput style={defiStyles.input} value={limitAmount} onChangeText={setLimitAmount} keyboardType="decimal-pad" placeholderTextColor={theme.colors.textMuted} />

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
                  <Text style={defiStyles.label}>{assetName || 'Asset'} amount</Text>
                  <TextInput style={defiStyles.input} value={assetAmount} onChangeText={setAssetAmount} keyboardType="decimal-pad" placeholderTextColor={theme.colors.textMuted} />
                  <Text style={defiStyles.label}>WART amount</Text>
                  <TextInput style={defiStyles.input} value={wartAmount} onChangeText={setWartAmount} keyboardType="decimal-pad" placeholderTextColor={theme.colors.textMuted} />
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