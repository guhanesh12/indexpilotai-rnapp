import React, { useMemo } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

export type RazorpayOrder = {
  orderId: string;
  amount: number; // in paise
  currency?: string;
  keyId: string;
  name?: string;
  description?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  themeColor?: string;
};

type Props = {
  visible: boolean;
  order: RazorpayOrder | null;
  onSuccess: (resp: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => void;
  onFailure: (err: any) => void;
  onClose: () => void;
};

function buildHtml(o: RazorpayOrder): string {
  const safe = (s: any) => String(s || '').replace(/[\\"']/g, '');
  return `<!doctype html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
<meta charset="utf-8" />
<style>
  html,body{margin:0;padding:0;background:#0a0a0a;color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;height:100%;overflow:hidden}
  .wrap{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;text-align:center;padding:24px;box-sizing:border-box}
  .logo{font-size:34px;font-weight:900;background:linear-gradient(90deg,#7C5CFF,#FF4DD2);-webkit-background-clip:text;-webkit-text-fill-color:transparent;letter-spacing:-1px;margin-bottom:8px}
  .amt{font-size:42px;font-weight:900;margin:8px 0;letter-spacing:-1px}
  .hint{color:#888;font-size:13px;margin-top:14px;line-height:1.5}
  .btn{margin-top:24px;background:linear-gradient(90deg,#00B4FF,#7C5CFF);color:#fff;border:0;padding:14px 30px;border-radius:10px;font-size:15px;font-weight:800;letter-spacing:.5px;cursor:pointer;box-shadow:0 6px 20px rgba(124,92,255,.4)}
</style>
</head>
<body>
<div class="wrap">
  <div class="logo">IndexPilot AI</div>
  <div style="color:#aaa;font-size:11px;font-weight:700;letter-spacing:2px">PAYING SECURELY</div>
  <div class="amt">₹${(o.amount/100).toLocaleString('en-IN', {maximumFractionDigits: 2})}</div>
  <div class="hint">Powered by Razorpay · 100% Secure<br/>Cards · UPI · NetBanking · Wallets</div>
  <button class="btn" id="pay">Open Payment</button>
</div>
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
<script>
  function post(payload){ if(window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(payload)); }
  var options = {
    key: "${safe(o.keyId)}",
    amount: ${o.amount},
    currency: "${safe(o.currency || 'INR')}",
    order_id: "${safe(o.orderId)}",
    name: "${safe(o.name || 'IndexPilot AI')}",
    description: "${safe(o.description || 'Wallet Recharge')}",
    image: "https://customer-assets.emergentagent.com/job_index-zen-flow/artifacts/u20oeoa3_white-only.png",
    prefill: {
      name: "${safe(o.prefill && o.prefill.name)}",
      email: "${safe(o.prefill && o.prefill.email)}",
      contact: "${safe(o.prefill && o.prefill.contact)}"
    },
    theme: { color: "${safe(o.themeColor || '#7C5CFF')}" },
    handler: function(response){ post({type:'success', data: response}); },
    modal: {
      ondismiss: function(){ post({type:'dismiss'}); },
      escape: false,
      backdropclose: false,
      confirm_close: true
    }
  };
  function start(){
    try{
      var rzp = new Razorpay(options);
      rzp.on('payment.failed', function(resp){ post({type:'failure', data: resp.error}); });
      rzp.open();
    } catch(e){ post({type:'error', message: e && e.message}); }
  }
  document.getElementById('pay').addEventListener('click', start);
  window.addEventListener('load', function(){ setTimeout(start, 350); });
</script>
</body>
</html>`;
}

export function RazorpayModal({ visible, order, onSuccess, onFailure, onClose }: Props) {
  const html = useMemo(() => (order ? buildHtml(order) : ''), [order]);

  const handle = (e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === 'success') onSuccess(msg.data);
      else if (msg.type === 'failure') onFailure(msg.data);
      else if (msg.type === 'dismiss') onClose();
      else if (msg.type === 'error') onFailure(msg);
    } catch {}
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <LinearGradient colors={['#0a0a0a', '#000']} style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>Add Funds</Text>
          <View style={{ width: 36 }} />
        </LinearGradient>
        {order ? (
          Platform.OS === 'web' ? (
            <View style={styles.webFallback}>
              <Ionicons name="information-circle" size={48} color="#7C5CFF" />
              <Text style={styles.webText}>Payment requires the mobile app</Text>
              <Text style={styles.webSub}>Please open IndexPilot AI on your iPhone or Android device to complete the payment.</Text>
              <TouchableOpacity style={styles.okBtn} onPress={onClose}>
                <Text style={styles.okBtnText}>OK</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <WebView
              originWhitelist={['*']}
              source={{ html, baseUrl: 'https://checkout.razorpay.com' }}
              onMessage={handle}
              javaScriptEnabled
              domStorageEnabled
              startInLoadingState
              renderLoading={() => (
                <View style={styles.loader}>
                  <ActivityIndicator size="large" color="#7C5CFF" />
                  <Text style={{ color: '#888', marginTop: 12, fontSize: 13 }}>Opening secure payment…</Text>
                </View>
              )}
              style={{ flex: 1, backgroundColor: '#0a0a0a' }}
            />
          )
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { color: '#fff', fontSize: 16, fontWeight: '800' },
  loader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#0a0a0a',
  },
  webFallback: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: 40, backgroundColor: '#0a0a0a',
  },
  webText: { color: '#fff', fontSize: 18, fontWeight: '800', marginTop: 16, textAlign: 'center' },
  webSub: { color: '#888', fontSize: 13, marginTop: 8, textAlign: 'center', lineHeight: 20 },
  okBtn: {
    marginTop: 24,
    backgroundColor: '#7C5CFF',
    paddingHorizontal: 32, paddingVertical: 12, borderRadius: 8,
  },
  okBtnText: { color: '#fff', fontWeight: '800' },
});

export default RazorpayModal;
