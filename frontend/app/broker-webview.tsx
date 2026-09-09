/**
 * In-app WebView OAuth broker connect.
 *
 * The server's callback page at /broker/<id>/callback does NOT redirect to a
 * custom scheme — it just renders a success HTML card. To detect the
 * completion we open the broker URL inside an in-app WebView and watch:
 *
 *   1. `onShouldStartLoadWithRequest` + `onNavigationStateChange` for the
 *      callback URL itself (Zerodha `request_token`, Fyers/Upstox `auth_code`
 *      or `code`, 5paisa `RequestToken`, Aliceblue `authCode`, Dhan `tokenId`).
 *
 *   2. `onMessage` for `window.ReactNativeWebView.postMessage(...)` — Dhan's
 *      callback explicitly posts {type:"DHAN_OAUTH_TOKEN",tokenId,status}
 *      and Kite posts {type:"KITE_OAUTH_TOKEN",requestToken,status} to the
 *      ReactNativeWebView bridge.
 *
 * Once we see the token we stop the WebView, POST it to the right consume
 * endpoint, then poll /broker/active until the server reports connected:true.
 */

import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  BackHandler,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { WebView } from "react-native-webview";
import { colors, spacing, radius } from "../src/lib/theme";
import { request } from "../src/lib/api";
import {
  brokerConsumePath,
  brokerActivePath,
  brokerExchangePath,
  API_BASE,
} from "../src/broker/brokerPaths";
import { showToast } from "../src/lib/toast";

const REDIRECT_PREFIX = `${API_BASE}/broker/`;

type ExtractedToken = {
  tokenId?: string;
  requestToken?: string;
  authCode?: string;
  userId?: string;
  rawCode?: string;
  state?: string;
};

/**
 * Extract the auth token from a broker callback URL.
 * Different brokers put their token in different query params:
 *   - Zerodha: request_token
 *   - Upstox:  code
 *   - Fyers:   auth_code
 *   - Dhan:    tokenId
 *   - 5paisa:  RequestToken
 *   - Aliceblue: authCode + userId
 */
function extractToken(brokerId: string, url: string): ExtractedToken | null {
  if (!url || !url.startsWith(REDIRECT_PREFIX)) return null;
  let params: URLSearchParams;
  try {
    params = new URL(url).searchParams;
  } catch {
    return null;
  }

  if (brokerId === "dhan") {
    const tokenId = params.get("tokenId");
    return tokenId ? { tokenId } : null;
  }
  if (brokerId === "zerodha" || brokerId === "kite") {
    const requestToken = params.get("request_token");
    return requestToken ? { requestToken } : null;
  }
  if (brokerId === "upstox") {
    const code = params.get("code");
    return code ? { rawCode: code } : null;
  }
  if (brokerId === "fyers") {
    const authCode = params.get("auth_code") || params.get("code");
    const state = params.get("state");
    return authCode ? { rawCode: authCode, state: state || undefined } : null;
  }
  if (brokerId === "5paisa" || brokerId === "fivepaisa") {
    const requestToken = params.get("RequestToken");
    return requestToken ? { requestToken } : null;
  }
  if (brokerId === "aliceblue") {
    const authCode = params.get("authCode");
    const userId = params.get("userId");
    return authCode ? { authCode, userId: userId || undefined } : null;
  }
  // Generic fallback
  const anyTok =
    params.get("request_token") ||
    params.get("auth_code") ||
    params.get("code") ||
    params.get("tokenId") ||
    params.get("RequestToken") ||
    params.get("authCode");
  return anyTok ? { requestToken: anyTok } : null;
}

async function consumeAndPoll(
  brokerId: string,
  token: ExtractedToken | null,
  onProgress: (msg: string) => void
): Promise<boolean> {
  const authCode =
    token?.rawCode ||
    token?.requestToken ||
    token?.tokenId ||
    token?.authCode ||
    "";

  if (authCode && brokerId === "dhan") {
    try {
      onProgress("Submitting Dhan token…");
      await request("POST", brokerConsumePath(brokerId), { tokenId: authCode });
    } catch (e: any) {
      console.warn(`[BROKER_WEBVIEW] Dhan consume: ${e?.message || e}`);
    }
  } else if (authCode && (brokerId === "zerodha" || brokerId === "kite")) {
    try {
      onProgress("Submitting Zerodha request token…");
      await request("POST", brokerConsumePath(brokerId), { requestToken: authCode });
    } catch (e: any) {
      console.warn(`[BROKER_WEBVIEW] Zerodha consume: ${e?.message || e}`);
    }
  } else if (authCode && (brokerId === "5paisa" || brokerId === "fivepaisa")) {
    try {
      onProgress("Submitting 5paisa request token…");
      await request("POST", brokerExchangePath(brokerId), { RequestToken: authCode });
    } catch (e: any) {
      console.warn(`[BROKER_WEBVIEW] 5paisa consume: ${e?.message || e}`);
    }
  } else if (authCode && brokerId === "aliceblue") {
    try {
      onProgress("Submitting Aliceblue auth code…");
      await request("POST", brokerExchangePath(brokerId), {
        authCode,
        userId: token?.userId,
      });
    } catch (e: any) {
      console.warn(`[BROKER_WEBVIEW] Aliceblue consume: ${e?.message || e}`);
    }
  } else if (authCode && brokerId === "fyers") {
    try {
      onProgress("Submitting Fyers auth code…");
      const qs = new URLSearchParams();
      if (token?.authCode) qs.set("authCode", token.authCode);
      if (token?.rawCode) qs.set("authCode", token.rawCode);
      if (token?.requestToken) qs.set("authCode", token.requestToken);
      const state = token?.state;
      if (state) qs.set("state", state);
      await request("POST", brokerConsumePath(brokerId), Object.fromEntries(qs));
    } catch (e: any) {
      console.warn(`[BROKER_WEBVIEW] Fyers consume: ${e?.message || e}`);
    }
  } else if (authCode) {
    console.log(`[BROKER_WEBVIEW] intercepted auth code (${authCode.length} chars), polling for connection`);
  } else {
    onProgress("Verifying session…");
  }

  const start = Date.now();
  const totalMs = 60000;
  let interval = 1000;
  while (Date.now() - start < totalMs) {
    try {
      const s: any = await request("GET", brokerActivePath());
      const active = (s?.activeBroker || "").toLowerCase();
      const want = brokerId.toLowerCase();
      if (active === want && s?.connected === true) {
        return true;
      }
    } catch {
      /* keep polling */
    }
    const elapsed = Date.now() - start;
    if (elapsed > 30000 && interval < 2000) interval = 2000;
    await new Promise((r) => setTimeout(r, interval));
  }
  return false;
}

export default function BrokerWebViewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const url = String((params as any)?.url || "");
  const brokerId = String((params as any)?.brokerId || "");
  const brokerName = String((params as any)?.brokerName || "broker");

  const webViewRef = useRef<WebView>(null);
  const handledRef = useRef(false);
  const [progress, setProgress] = useState("Loading broker login…");

  useEffect(() => {
    if (!url || !brokerId) {
      console.error(`[BROKER_WEBVIEW] missing url=${!!url} brokerId=${brokerId}`);
      showToast("Missing broker URL");
      router.replace("/(tabs)/broker");
    }
  }, [url, brokerId, router]);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      router.replace("/(tabs)/broker");
      return true;
    });
    return () => sub.remove();
  }, [router]);

  const finishWithToken = (token: ExtractedToken | null) => {
    if (handledRef.current) return;
    handledRef.current = true;
    try {
      webViewRef.current?.stopLoading();
    } catch {
      /* ignore */
    }
    setProgress("Finishing connection…");
    consumeAndPoll(brokerId, token, setProgress).then((ok) => {
      if (ok) {
        console.log(`[BROKER_WEBVIEW] connected ✓ brokerId=${brokerId}`);
        setProgress("Connected!");
        request("POST", brokerActivePath(), { broker: brokerId }).catch((e: any) =>
          console.warn(`[BROKER_WEBVIEW] activate broker failed: ${e?.message || e}`)
        );
        setTimeout(() => {
          router.replace(`/(tabs)/broker?justConnected=${encodeURIComponent(brokerId)}` as any);
        }, 600);
      } else {
        console.warn(`[BROKER_WEBVIEW] poll timed out brokerId=${brokerId}`);
        setProgress("Server didn't confirm. You can paste the URL manually.");
        setTimeout(() => {
          router.replace(`/(tabs)/broker?pasteRequired=${encodeURIComponent(brokerId)}` as any);
        }, 1200);
      }
    });
  };

  const tryHandleUrl = (u: string): boolean => {
    if (!u || !u.startsWith(REDIRECT_PREFIX)) return false;
    if (
      u.includes("/callback") &&
      (u.includes("request_token=") ||
        u.includes("tokenId=") ||
        u.includes("RequestToken=") ||
        u.includes("authCode=") ||
        u.includes("auth_code=") ||
        u.includes("code=") ||
        u.includes("/fyers/callback") ||
        u.includes("/upstox/callback"))
    ) {
      if (handledRef.current) return true;
      console.log(`[BROKER_WEBVIEW] intercepted callback ${u.slice(0, 220)}`);
      const token = extractToken(brokerId, u);
      finishWithToken(token);
      return true;
    }
    return false;
  };

  const onShouldStart = (req: any): boolean => {
    const u: string = req?.url || "";
    return !tryHandleUrl(u);
  };

  const onNavStateChange = (navState: any) => {
    const u: string = navState?.url || "";
    tryHandleUrl(u);
  };

  /**
   * Handle `window.ReactNativeWebView.postMessage(...)` — Dhan's and
   * Kite's callback pages both post JSON messages here.
   */
  const onMessage = (event: any) => {
    const raw: string = event?.nativeEvent?.data || "";
    if (!raw) return;
    console.log(`[BROKER_WEBVIEW] onMessage ${raw.slice(0, 200)}`);
    let msg: any = null;
    try {
      msg = JSON.parse(raw);
    } catch {
      msg = null;
    }
    if (!msg || typeof msg !== "object") return;
    // Dhan posts {type:"DHAN_OAUTH_TOKEN", tokenId, status}
    if (msg.type === "DHAN_OAUTH_TOKEN" && msg.tokenId) {
      finishWithToken({ tokenId: String(msg.tokenId) });
      return;
    }
    // Kite posts {type:"KITE_OAUTH_TOKEN", requestToken, status}
    if (msg.type === "KITE_OAUTH_TOKEN" && msg.requestToken) {
      finishWithToken({ requestToken: String(msg.requestToken) });
      return;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.replace("/(tabs)/broker")}
          style={styles.backBtn}
          accessibilityLabel="Cancel broker login"
        >
          <Ionicons name="close" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{brokerName} login</Text>
        <View style={styles.backBtn} />
      </View>

      <View style={styles.progressBar}>
        <ActivityIndicator size="small" color="#00FF66" />
        <Text style={styles.progressText}>{progress}</Text>
      </View>

      {url ? (
        <WebView
          ref={webViewRef}
          source={{ uri: url }}
          onShouldStartLoadWithRequest={onShouldStart as any}
          onNavigationStateChange={onNavStateChange}
          onMessage={onMessage}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
          mixedContentMode="always"
          originWhitelist={["*"]}
          style={styles.webview}
        />
      ) : (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color="#7C5CFF" />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: colors.bg.secondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  progressBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    backgroundColor: "rgba(0,255,102,0.05)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,255,102,0.2)",
  },
  progressText: {
    color: "#00FF66",
    fontSize: 12,
    fontWeight: "700",
    flex: 1,
  },
  webview: { flex: 1, backgroundColor: colors.bg.primary },
});
