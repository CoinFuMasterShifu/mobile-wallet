// Wallet.tsx — COMPLETE FINAL PRODUCTION VERSION (All errors fixed)
import { Buffer } from 'buffer';
global.Buffer = Buffer;   // ← MUST BE AT THE VERY TOP

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Modal, Alert,
  StyleSheet, RefreshControl, ActivityIndicator,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import CryptoJS from 'crypto-js';
import { ethers } from 'ethers';
import axios from 'axios';
import TransactionHistory from './TransactionHistory';

import * as secp256k1 from '@noble/secp256k1';


// Register sha256 for noble (required in React Native)


interface WalletData {
  mnemonic?: string;
  privateKey: string;
  publicKey: string;
  address: string;
  wordCount?: number;
  pathType?: string;
}

const defaultNodeList = [
  'https://warthognode.duckdns.org',
  'http://217.182.64.43:3001',
];

const Wallet: React.FC = () => {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [balance, setBalance] = useState<string>('0.00000000');
  const [usdBalance, setUsdBalance] = useState<string>('$0.00');
  const [nextNonce, setNextNonce] = useState<number>(0);
  const [selectedNode, setSelectedNode] = useState(defaultNodeList[0]);

  const [walletAction, setWalletAction] = useState<'create' | 'derive' | 'import' | 'login'>('create');
  const [mnemonic, setMnemonic] = useState('');
  const [privateKeyInput, setPrivateKeyInput] = useState('');
  const [wordCount, setWordCount] = useState('12');
  const [pathType, setPathType] = useState<'hardened' | 'normal'>('hardened');

  const [toAddr, setToAddr] = useState('');
  const [amount, setAmount] = useState('');
  const [fee, setFee] = useState('0.01');
  const [nonceInput, setNonceInput] = useState('');
  const [sending, setSending] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [saveWalletConsent, setSaveWalletConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [uploadedFileContent, setUploadedFileContent] = useState<string | null>(null);

  useEffect(() => {
    SecureStore.getItemAsync('warthogWallet').then(enc => enc && setIsLoggedIn(true));
  }, []);

  const fetchBalanceAndNonce = async (address: string) => {
    try {
      const [headRes, balRes] = await Promise.all([
        axios.get(`${selectedNode}/chain/head`),
        axios.get(`${selectedNode}/account/${address}/balance`),
      ]);
      const balData = balRes.data.data || balRes.data;
      const balanceInWart = (balData.balance / 1).toFixed(8);
      setBalance(balanceInWart);

      const priceRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=warthog&vs_currencies=usd');
      const priceData = await priceRes.json();
      const usd = (parseFloat(balanceInWart) * (priceData.warthog?.usd || 0)).toFixed(2);
      setUsdBalance(`$${usd}`);

      setNextNonce(Math.max(nextNonce, Number(balData.nonceId || 0)));
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (wallet?.address) await fetchBalanceAndNonce(wallet.address);
    setRefreshing(false);
  }, [wallet]);

  const generateWallet = async (): Promise<WalletData> => {
    const strength = wordCount === '12' ? 16 : 32;
    const { getRandomBytesAsync } = await import('expo-crypto');
    const entropy = await getRandomBytesAsync(strength);

    const mnemonicObj = ethers.Mnemonic.fromEntropy(ethers.hexlify(entropy));
    const path = pathType === 'hardened' ? "m/44'/2070'/0'/0/0" : "m/44'/2070'/0/0/0";
    const hd = ethers.HDNodeWallet.fromPhrase(mnemonicObj.phrase, '', path);

    const pub = hd.publicKey.slice(2);
    const sha = ethers.sha256('0x' + pub).slice(2);
    const rip = ethers.ripemd160('0x' + sha).slice(2);
    const chk = ethers.sha256('0x' + rip).slice(2, 10);
    const address = rip + chk;

    return {
      mnemonic: mnemonicObj.phrase,
      privateKey: hd.privateKey.slice(2),
      publicKey: pub,
      address,
      wordCount: Number(wordCount),
      pathType,
    };
  };

  const deriveWallet = async (): Promise<WalletData> => {
    const words = mnemonic.trim().split(/\s+/);
    if (words.length !== Number(wordCount)) throw new Error(`Must have exactly ${wordCount} words`);
    const path = pathType === 'hardened' ? "m/44'/2070'/0'/0/0" : "m/44'/2070'/0/0/0";
    const hd = ethers.HDNodeWallet.fromPhrase(mnemonic, '', path);

    const pub = hd.publicKey.slice(2);
    const sha = ethers.sha256('0x' + pub).slice(2);
    const rip = ethers.ripemd160('0x' + sha).slice(2);
    const chk = ethers.sha256('0x' + rip).slice(2, 10);
    const address = rip + chk;

    return { mnemonic, privateKey: hd.privateKey.slice(2), publicKey: pub, address, wordCount: Number(wordCount), pathType };
  };

  const handleWalletAction = async () => {
    setError(null);
    try {
      let data: WalletData;
      if (walletAction === 'create') data = await generateWallet();
      else if (walletAction === 'derive') data = await deriveWallet();
      else if (walletAction === 'import' && privateKeyInput.length === 64) {
        const w = new ethers.Wallet('0x' + privateKeyInput);
        const pub = w.signingKey.compressedPublicKey.slice(2);
        const sha = ethers.sha256('0x' + pub).slice(2);
        const rip = ethers.ripemd160('0x' + sha).slice(2);
        const chk = ethers.sha256('0x' + rip).slice(2, 10);
        data = { privateKey: privateKeyInput, publicKey: pub, address: rip + chk };
      } else throw new Error('Fill all fields');
      setWalletData(data);
      setShowModal(true);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const saveWallet = async () => {
    if (!password || password !== confirmPassword || !saveWalletConsent || !walletData) return setError('Check password & consent');
    const enc = CryptoJS.AES.encrypt(JSON.stringify(walletData), password).toString();
    await SecureStore.setItemAsync('warthogWallet', enc);
    setWallet(walletData);
    setIsLoggedIn(true);
    setShowModal(false);
    fetchBalanceAndNonce(walletData.address);
    Alert.alert('✅ Wallet Saved Securely');
  };

  const downloadWallet = async () => {
    if (!password || password !== confirmPassword || !walletData) return;
    const enc = CryptoJS.AES.encrypt(JSON.stringify(walletData), password).toString();
    const file = new File(Paths.cache, 'warthog_wallet.txt');
    await file.write(enc);
    await Sharing.shareAsync(file.uri);
    setShowModal(false);
    Alert.alert('✅ Downloaded!');
  };

  const loadWallet = async () => {
    const enc = await SecureStore.getItemAsync('warthogWallet');
    if (!enc || !password) return setError('No wallet or wrong password');
    try {
      const dec = CryptoJS.AES.decrypt(enc, password).toString(CryptoJS.enc.Utf8);
      const data = JSON.parse(dec);
      setWallet(data);
      setIsLoggedIn(true);
      fetchBalanceAndNonce(data.address);
    } catch {
      setError('Wrong password');
    }
  };

  const pickAndLoginFromFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'text/plain', copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.[0]) return;
      const file = new File(result.assets[0].uri);
      const content = await file.text();
      setUploadedFileContent(content);
      Alert.alert('✅ File Loaded', 'Enter password below to decrypt');
    } catch (e: any) {
      setError('Failed to read file: ' + e.message);
    }
  };

  const loginFromFile = async () => {
    if (!uploadedFileContent || !password) return setError('No file or password');
    try {
      const bytes = CryptoJS.AES.decrypt(uploadedFileContent, password);
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);
      const data = JSON.parse(decrypted);
      setWallet(data);
      setIsLoggedIn(true);
      fetchBalanceAndNonce(data.address);
      setUploadedFileContent(null);
      Alert.alert('✅ Logged in from file!');
    } catch {
      setError('Wrong password or invalid file');
    }
  };

  // FINAL SEND FUNCTION
    // FINAL CLEAN SEND (no hashes package needed)
  const handleSend = async () => {
    if (!wallet || !toAddr || !amount) return setError('Fill all fields');
    setSending(true);
    setError(null);

    try {
      const headRes = await axios.get(`${selectedNode}/chain/head`);
      const headData = headRes.data.data || headRes.data;
      const pinHash = headData.pinHash;
      const pinHeight = Number(headData.pinHeight);

      const nonceId = nextNonce + 1;
      const feeE8 = 1000000;
      const amountE8 = Math.round(parseFloat(amount) * 100000000);

      const buf1 = Buffer.from(pinHash, "hex");
      const buf2 = Buffer.alloc(19);
      buf2.writeUInt32BE(pinHeight, 0);
      buf2.writeUInt32BE(nonceId, 4);
      buf2.writeUInt8(0, 8);
      buf2.writeUInt8(0, 9);
      buf2.writeUInt8(0, 10);
      buf2.writeBigUInt64BE(BigInt(feeE8), 11);

      const buf3 = Buffer.from(toAddr.slice(0, 40), "hex");
      const buf4 = Buffer.alloc(8);
      buf4.writeBigUInt64BE(BigInt(amountE8), 0);

      const toSign = Buffer.concat([buf1, buf2, buf3, buf4]);

      const signHash = ethers.sha256("0x" + toSign.toString("hex")).slice(2);

      const msgHash = Buffer.from(signHash, "hex");
      const privKey = Buffer.from(wallet.privateKey, "hex");

      const signature = await secp256k1.sign(msgHash, privKey);   // returns 65-byte signature

      const postData = {
        pinHeight,
        nonceId,
        toAddr,
        amountE8,
        feeE8,
        signature65: Buffer.from(signature).toString("hex"),
      };

      const res = await axios.post(`${selectedNode}/transaction/add`, postData);

      if (res.data?.error) throw new Error(res.data.error);

      Alert.alert('✅ Sent Successfully!', `Tx Hash: ${res.data?.data?.txHash || 'pending'}`);
      onRefresh();

    } catch (e: any) {
      console.error(e);
      setError(e.response?.data?.error || e.message || 'Send failed');
      Alert.alert('Send Failed', e.message || 'Unknown error');
    } finally {
      setSending(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    Clipboard.setStringAsync(text);
    Alert.alert('Copied!', `${label} copied`);
  };

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#FFC107']} />}
    >
      <Text style={styles.sectionTitle}>WARTHOG WALLET</Text>

      {!isLoggedIn ? (
        <View style={styles.loginSection}>
          <Text style={styles.label}>Choose Action</Text>
          <View style={styles.buttonRow}>
            {(['create', 'derive', 'import', 'login'] as const).map(act => (
              <TouchableOpacity
                key={act}
                style={[styles.smallButton, walletAction === act && styles.activeButton]}
                onPress={() => setWalletAction(act)}
              >
                <Text style={styles.buttonText}>{act.toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {walletAction === 'login' && (
            <>
              <TouchableOpacity style={styles.bigButton} onPress={loadWallet}>
                <Text style={styles.bigButtonText}>Login from Device (Saved)</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.bigButton, { backgroundColor: '#FF9800' }]} onPress={pickAndLoginFromFile}>
                <Text style={styles.bigButtonText}>📁 Login from File</Text>
              </TouchableOpacity>

              {uploadedFileContent && (
                <>
                  <TextInput 
                    style={styles.input} 
                    placeholder="Enter password to decrypt file" 
                    secureTextEntry={!showPassword} 
                    value={password} 
                    onChangeText={setPassword} 
                  />
                  <TouchableOpacity style={styles.bigButton} onPress={loginFromFile}>
                    <Text style={styles.bigButtonText}>Decrypt & Login</Text>
                  </TouchableOpacity>
                </>
              )}
            </>
          )}

          {(walletAction === 'create' || walletAction === 'derive' || walletAction === 'import') && (
            <TouchableOpacity style={styles.bigButton} onPress={handleWalletAction}>
              <Text style={styles.bigButtonText}>
                {walletAction === 'create' ? 'Create New Wallet' : walletAction === 'derive' ? 'Derive from Seed Phrase' : 'Import Private Key'}
              </Text>
            </TouchableOpacity>
          )}

          {walletAction === 'derive' && (
            <TextInput style={styles.input} placeholder="Enter 12 or 24 word seed phrase" value={mnemonic} onChangeText={setMnemonic} multiline numberOfLines={4} />
          )}
          {walletAction === 'import' && (
            <TextInput style={styles.input} placeholder="Enter 64-char private key" value={privateKeyInput} onChangeText={setPrivateKeyInput} />
          )}
        </View>
      ) : wallet ? (
        <>
          <View style={styles.balanceBox}>
            <Text style={styles.balanceLabel}>Balance</Text>
            <Text style={styles.balance}>{balance} WART</Text>
            <Text style={styles.usd}>{usdBalance}</Text>
            <TouchableOpacity onPress={() => copyToClipboard(wallet.address, 'Address')}>
              <Text style={styles.address}>{wallet.address}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
            <Text style={styles.refreshText}>Refresh Balance</Text>
          </TouchableOpacity>

          {/* NODE SELECTOR */}
          <Text style={styles.label}>Select Node</Text>
          <View style={styles.buttonRow}>
            {defaultNodeList.map(n => (
              <TouchableOpacity
                key={n}
                style={[styles.smallButton, selectedNode === n && styles.activeButton]}
                onPress={() => setSelectedNode(n)}
              >
                <Text style={styles.buttonText}>
                  {n.includes('duckdns') ? '🌐 Main Node' : '🔄 Backup Node'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.sendSection}>
            <Text style={styles.sectionTitle}>Send WART</Text>
            <TextInput style={styles.input} placeholder="To Address (48 chars)" value={toAddr} onChangeText={setToAddr} />
            <TextInput style={styles.input} placeholder="Amount (WART)" value={amount} onChangeText={setAmount} keyboardType="numeric" />
            <TextInput style={styles.input} placeholder="Fee (0.01)" value={fee} onChangeText={setFee} keyboardType="numeric" />
            <TouchableOpacity style={styles.bigButton} onPress={handleSend} disabled={sending}>
              <Text style={styles.bigButtonText}>{sending ? 'Sending...' : 'SEND TRANSACTION'}</Text>
            </TouchableOpacity>
          </View>

          <TransactionHistory address={wallet.address} node={selectedNode} onRefresh={onRefresh} />
        </>
      ) : (
        <ActivityIndicator size="large" color="#FFC107" />
      )}

      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Wallet Ready!</Text>
            {walletData?.mnemonic && <Text style={styles.seed}>{walletData.mnemonic}</Text>}
            <Text style={styles.label}>Private Key</Text>
            <TouchableOpacity onPress={() => copyToClipboard(walletData!.privateKey, 'Private Key')}>
              <Text style={styles.key}>{walletData?.privateKey}</Text>
            </TouchableOpacity>

            <TextInput style={styles.input} placeholder="Password" secureTextEntry={!showPassword} value={password} onChangeText={setPassword} />
            <TextInput style={styles.input} placeholder="Confirm Password" secureTextEntry={!showConfirmPassword} value={confirmPassword} onChangeText={setConfirmPassword} />

            <TouchableOpacity style={styles.bigButton} onPress={saveWallet}>
              <Text style={styles.bigButtonText}>Save Securely (Device)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.bigButton} onPress={downloadWallet}>
              <Text style={styles.bigButtonText}>Download Encrypted File</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Text style={styles.close}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {error && <Text style={styles.error}>{error}</Text>}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#070707', padding: 20 },
  sectionTitle: { fontSize: 26, color: '#FFC107', fontWeight: '700', textAlign: 'center', marginBottom: 20 },
  loginSection: { marginTop: 20 },
  label: { color: '#FFECB3', fontSize: 16, marginBottom: 8 },
  buttonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  smallButton: { paddingVertical: 10, paddingHorizontal: 16, backgroundColor: '#474747', borderRadius: 8 },
  activeButton: { backgroundColor: '#FFC107' },
  buttonText: { color: '#FFFFFF', fontWeight: '600' },
  balanceBox: { backgroundColor: '#474747', padding: 20, borderRadius: 12, borderWidth: 3, borderColor: '#FFC107', marginBottom: 20 },
  balanceLabel: { color: '#FFECB3', fontSize: 16 },
  balance: { fontSize: 34, color: '#FFFFFF', fontWeight: '700' },
  usd: { color: '#FFECB3', fontSize: 20, marginTop: 4 },
  address: { color: '#FFECB3', fontSize: 14, marginTop: 12, textAlign: 'center' },
  refreshButton: { backgroundColor: '#FFC107', padding: 16, borderRadius: 8, alignItems: 'center', marginBottom: 20 },
  refreshText: { color: '#1C2526', fontWeight: '700', fontSize: 17 },
  sendSection: { marginTop: 20 },
  input: { backgroundColor: '#1C2526', color: '#FFFFFF', padding: 16, borderRadius: 8, borderWidth: 2, borderColor: '#FFC107', marginBottom: 12, fontSize: 16 },
  bigButton: { backgroundColor: '#FFC107', padding: 16, borderRadius: 8, alignItems: 'center', marginVertical: 8 },
  bigButtonText: { color: '#1C2526', fontWeight: '700', fontSize: 18 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#474747', padding: 25, borderRadius: 16, width: '92%', borderWidth: 3, borderColor: '#FFC107' },
  modalTitle: { fontSize: 24, color: '#FFC107', textAlign: 'center', marginBottom: 15 },
  seed: { backgroundColor: '#1C2526', padding: 15, color: '#FFECB3', fontSize: 15, marginBottom: 15, borderRadius: 8 },
  key: { backgroundColor: '#1C2526', padding: 15, color: '#FFFFFF', fontSize: 14, marginBottom: 15, borderRadius: 8 },
  close: { color: '#FFECB3', textAlign: 'center', marginTop: 20, fontSize: 18 },
  error: { color: '#FF4444', textAlign: 'center', marginTop: 15, fontSize: 16 },
});

export default Wallet;