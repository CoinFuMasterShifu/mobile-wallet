// TransactionHistory.tsx — FIXED SCROLLING + NO NESTING WARNING
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, RefreshControl, ActivityIndicator,
} from 'react-native';
import axios from 'axios';
import * as Clipboard from 'expo-clipboard';

interface Props {
  address: string;
  node: string;
  onRefresh: () => void;
}

const TransactionHistory: React.FC<Props> = ({ address, node, onRefresh }) => {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [blockCounts, setBlockCounts] = useState({
    '24h': 0, week: 0, month: 0,
    rewards24h: [] as string[],
    rewardsWeek: [] as string[],
    rewardsMonth: [] as string[],
  });

  const abbreviate = (str: string) => str ? `${str.slice(0,6)}...${str.slice(-4)}` : 'N/A';

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${node}/account/${address}/history/4294967295`);
      const raw = res.data.data || res.data;
      const allTxs: any[] = [];

      if (raw.perBlock) {
        raw.perBlock.forEach((block: any) => {
          const txs = [
            ...(block.transactions?.transfers || []),
            ...(block.transactions?.rewards || [])
          ];
          txs.forEach(tx => {
            allTxs.push({
              ...tx,
              height: block.height,
              confirmations: block.confirmations,
              timestamp: tx.timestamp || block.timestamp,
              txid: tx.txHash,
            });
          });
        });
      }

      // Fetch timestamps for tx without them (e.g., unconfirmed)
      await Promise.all(allTxs.map(async (tx: any) => {
        if (!tx.timestamp) {
          try {
            const txRes = await axios.get(`${node}/transaction/${tx.txid}`);
            const txData = txRes.data.data || txRes.data;
            tx.timestamp = txData.timestamp || txData.blockTimestamp;
          } catch (e) {
            // Ignore errors, keep as is
          }
        }
      }));

      setHistory(allTxs);

      const now = Date.now() / 1000;
      const rewards = allTxs.filter((tx: any) => !tx.fromAddress);
      setBlockCounts({
        '24h': rewards.filter((tx: any) => tx.timestamp >= now - 86400).length,
        week: rewards.filter((tx: any) => tx.timestamp >= now - 604800).length,
        month: rewards.filter((tx: any) => tx.timestamp >= now - 2592000).length,
        rewards24h: rewards.filter((tx: any) => tx.timestamp >= now - 86400).map((tx: any) => tx.txid),
        rewardsWeek: rewards.filter((tx: any) => tx.timestamp >= now - 604800).map((tx: any) => tx.txid),
        rewardsMonth: rewards.filter((tx: any) => tx.timestamp >= now - 2592000).map((tx: any) => tx.txid),
      });
    } catch (err: any) {
      Alert.alert('History Error', err.message || 'Node returned 502 – try backup node');
    } finally {
      setLoading(false);
    }
  }, [address, node]);

  useEffect(() => {
    if (address) fetchHistory();
  }, [address, node]);

  const onPullRefresh = async () => {
    setRefreshing(true);
    await fetchHistory();
    onRefresh();
    setRefreshing(false);
  };

  const copy = (text: string, label: string) => {
    Clipboard.setStringAsync(text);
    Alert.alert('Copied!', `${label} copied`);
  };

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>Transaction History</Text>
        <TouchableOpacity onPress={fetchHistory} style={styles.refreshBtn}>
          <Text style={styles.refreshText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.rewardRow}>
        <TouchableOpacity onPress={() => {}} style={styles.rewardPill}><Text style={styles.rewardText}>24h: {blockCounts['24h']}</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => {}} style={styles.rewardPill}><Text style={styles.rewardText}>Week: {blockCounts.week}</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => {}} style={styles.rewardPill}><Text style={styles.rewardText}>Month: {blockCounts.month}</Text></TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.list}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onPullRefresh} colors={['#FFC107']} />}
      >
        {loading && <ActivityIndicator size="large" color="#FFC107" style={{ margin: 30 }} />}

        {history.length === 0 && !loading && <Text style={styles.noTx}>No transactions yet</Text>}

        {history.map((tx, index) => (
          <View key={index} style={styles.txCard}>
            <View style={styles.row}><Text style={styles.label}>TxID</Text><TouchableOpacity onPress={() => copy(tx.txid, 'TxID')}><Text style={styles.value}>{abbreviate(tx.txid)}</Text></TouchableOpacity></View>
            <View style={styles.row}><Text style={styles.label}>From</Text><TouchableOpacity onPress={() => tx.fromAddress && copy(tx.fromAddress, 'From')}><Text style={styles.value}>{tx.fromAddress ? abbreviate(tx.fromAddress) : 'Block Reward'}</Text></TouchableOpacity></View>
            <View style={styles.row}><Text style={styles.label}>To</Text><TouchableOpacity onPress={() => copy(tx.toAddress || '', 'To')}><Text style={styles.value}>{abbreviate(tx.toAddress || 'N/A')}</Text></TouchableOpacity></View>
            <View style={styles.row}><Text style={styles.label}>Amount</Text><Text style={styles.value}>{parseFloat(tx.amount || 0).toFixed(8)} WART</Text></View>
            <View style={styles.row}><Text style={styles.label}>Height</Text><Text style={styles.value}>{tx.height}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Confirmations</Text><Text style={styles.value}>{tx.confirmations}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Date</Text><Text style={styles.value}>{tx.confirmations === 0 ? 'Pending' : tx.timestamp ? new Date(tx.timestamp * 1000).toLocaleString() : 'N/A'}</Text></View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  section: { marginTop: 30 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  title: { fontSize: 22, color: '#FFC107', fontWeight: '700' },
  refreshBtn: { backgroundColor: '#474747', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  refreshText: { color: '#FFECB3', fontWeight: '600' },
  rewardRow: { flexDirection: 'row', gap: 10, marginBottom: 15 },
  rewardPill: { backgroundColor: '#1C2526', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#FFC107' },
  rewardText: { color: '#FFECB3', fontWeight: '600' },
  list: { maxHeight: 600 }, // you can make this bigger if you want
  txCard: { backgroundColor: '#1C2526', padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 2, borderColor: '#FFC107' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  label: { color: '#FFECB3', fontSize: 14 },
  value: { color: '#FFFFFF', fontSize: 14, textAlign: 'right', flexShrink: 1 },
  noTx: { color: '#FFECB3', textAlign: 'center', marginTop: 30, fontSize: 16 },
});

export default TransactionHistory;
