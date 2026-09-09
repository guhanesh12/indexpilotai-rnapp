import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Image,
  RefreshControl,
  Clipboard,
  Linking,
  AppState,
  TextInput,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { useRouter, useFocusEffect, useLocalSearchParams } from "expo-router";
import { setStringAsync } from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { Card, Heading, Body, Button, Input } from "../../src/components/Primitives";
import { colors, spacing, radius } from "../../src/lib/theme";
import { request } from "../../src/lib/api";
import { useBroker, BrokerDef } from "../../src/broker/BrokerContext";
import {
  brokerStatusPath,
  brokerInstrumentsStatusPath,
  brokerActivePath,
  brokerFundLimitsPath,
  redirectUrlFor,
} from "../../src/broker/brokerPaths";
import { BrokerLogo } from "../../src/broker/brokerLogos";
import { getBrokerForm, Field } from "../../src/broker/brokerForms";
import {
  connectOAuth,
  pollConnected,
  verifyConnectionAfterPoll,
  extractRedirectToken,
  consumeRedirectToken,
  BROKER_CALLBACK_SCHEME,
} from "../../src/broker/connectOAuth";
import { mapBrokerStatus, getRedirectUrl } from "../../src/broker/brokerStatus";
import { showToast } from "../../src/lib/toast";

const BROKER_LABEL: Record<string, string> = {
  dhan: "Dhan",
  zerodha: "Zerodha",
  upstox: "Upstox",
  fyers: "Fyers",
  groww: "Groww",
  angelone: "Angel One",
  aliceblue: "Alice Blue",
  "5paisa": "5paisa",
};

function labelOf(id: string): string {
  return BROKER_LABEL[id] || id.charAt(0).toUpperCase() + id.slice(1);
}

export default function BrokerTab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const {
    status,
    brokers,
    activeBroker,
    activeBrokerName,
    chosen,
    connected,
    available,
    refresh,
    switchBroker,
    disconnect,
    clearFunds,
    clearPositions,
    loadFunds,
    loadPositions,
    syncInstruments,
    lastError,
    pollUntilConnected,
  } = useBroker();

  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);
  const [switchingBroker, setSwitchingBroker] = useState<BrokerDef | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [connectingLabel, setConnectingLabel] = useState<string>("");
  const [connectingStep, setConnectingStep] = useState<string>("");
  const [successBroker, setSuccessBroker] = useState<string | null>(null);
  const [brokerExtras, setBrokerExtras] = useState<any>(null);
  const [instrumentSync, setInstrumentSync] = useState<any>(null);
  const [funds, setFunds] = useState<any>(null);
  const [pendingDeepLink, setPendingDeepLink] = useState<string | null>(null);
  const [loginNotConfirmed, setLoginNotConfirmed] = useState<string | null>(null);
  const pollAbortRef = useRef<{ cancelled: boolean } | null>(null);

  const [brokerStatuses, setBrokerStatuses] = useState<Record<string, any>>({});
  const brokerStatusesRef = useRef<Record<string, any>>({});
  const [searchQuery, setSearchQuery] = useState("");

  const fetchBrokerStatuses = useCallback(async () => {
    const prev = brokerStatusesRef.current;
    const statuses: Record<string, any> = {};
    await Promise.all(
      (brokers || []).map(async (b) => {
        try {
          const s: any = await request("GET", brokerStatusPath(b.id));
          statuses[b.id] = s;
        } catch {
          statuses[b.id] = prev[b.id] ?? null;
        }
      })
    );
    brokerStatusesRef.current = statuses;
    setBrokerStatuses(statuses);
  }, [brokers]);

  useEffect(() => {
    fetchBrokerStatuses();
  }, [fetchBrokerStatuses]);

  const liveBrokers = (brokers || []).filter((b: BrokerDef) => b.status === "live" && b.enabled);

  const sortedBrokers = useCallback(() => {
    const q = (searchQuery || "").trim().toLowerCase();
    let list = [...(brokers || [])];
    if (q) {
      list = list.filter((b) => {
        const hay = [b.name, b.short, b.id, ...(b.features || [])].join(" ").toLowerCase();
        return hay.includes(q);
      });
    }
    list.sort((a, b) => {
      if (a.id === activeBroker) return -1;
      if (b.id === activeBroker) return 1;
      return 0;
    });
    return list.filter((b) => b.enabled);
  }, [brokers, activeBroker, searchQuery]);

  useFocusEffect(
    useCallback(() => {
      refresh();
      fetchBrokerStatuses();
      setLoginNotConfirmed(null);
      setSearchQuery("");
    }, [refresh, fetchBrokerStatuses])
  );

  // Update extras when active broker status changes
  useEffect(() => {
    if (!expandedId && activeBroker) {
      setBrokerExtras({ connected, chosen });
    }
  }, [activeBroker, expandedId, connected, chosen]);

  // Load funds for active broker
  useEffect(() => {
    if (!activeBroker || !chosen) {
      setFunds(null);
      return;
    }
    if (!connected) {
      setFunds(null);
      return;
    }
    let alive = true;
    request("GET", brokerFundLimitsPath())
      .then((res: any) => {
        if (!alive) return;
        const brokerField = String(res?.broker || "").toLowerCase();
        if (brokerField && brokerField !== String(activeBroker).toLowerCase()) return;
        const f = res?.funds || res?.data || res;
        setFunds(f?.availableBalance !== undefined ? f : null);
      })
      .catch(() => { /* keep last known */ });
    return () => { alive = false; };
  }, [activeBroker, chosen, connected]);

  // Handle deep link after OAuth (when broker-callback returns to the tab via deep link)
  useEffect(() => {
    if (!pendingDeepLink) return;
    let alive = true;
    (async () => {
      try {
        const brokerId = activeBroker || "";
        const extracted = extractRedirectToken(brokerId, pendingDeepLink);
        if (extracted) {
          await consumeRedirectToken(brokerId, extracted);
        }
        const ok = await pollConnected(brokerId, 12);
        if (ok && alive) {
          showToast(`${labelOf(brokerId)} connected successfully`);
          await refresh();
        } else if (alive) {
          setLoginNotConfirmed(brokerId);
        }
      } catch (e: any) {
        if (alive) showToast(e?.message || "Could not complete connection");
      } finally {
        if (alive) setPendingDeepLink(null);
      }
    })();
    return () => { alive = false; };
  }, [pendingDeepLink, activeBroker, refresh]);

  // dhan-oauth returns here with ?token=...&autoConnect=true — consume it.
  // broker-webview returns here with ?justConnected=<broker> or ?pasteRequired=<broker>.
  useEffect(() => {
    const justConnected = String((params as any)?.justConnected || "");
    const pasteRequired = String((params as any)?.pasteRequired || "");
    if (justConnected) {
      console.log(`[BROKER_UI] justConnected=${justConnected}`);
      setSuccessBroker(justConnected);
      showToast(`${labelOf(justConnected)} connected successfully`);
      setLoginNotConfirmed(null);
      router.replace("/(tabs)/broker" as any);
      return;
    }
    if (pasteRequired) {
      console.log(`[BROKER_UI] pasteRequired=${pasteRequired}`);
      setLoginNotConfirmed(pasteRequired);
      setExpandedId(pasteRequired);
      router.replace("/(tabs)/broker" as any);
      return;
    }

    const autoConnect = String((params as any)?.autoConnect || "") === "true";
    const tokenId = String((params as any)?.token || "");
    const brokerId = String((params as any)?.broker || "dhan");
    if (!autoConnect || !tokenId) return;
    let alive = true;
    (async () => {
      try {
        await consumeRedirectToken(brokerId, { tokenId });
        const ok = await pollUntilConnected(brokerId, { timeoutMs: 60000, intervalMs: 2000 });
        if (ok && alive) {
          showToast(`${labelOf(brokerId)} connected successfully`);
          await refresh();
        } else if (alive) {
          setLoginNotConfirmed(brokerId);
        }
      } catch (e: any) {
        if (alive) showToast(e?.message || "Could not complete connection");
      } finally {
        if (alive) {
          router.replace("/(tabs)/broker" as any);
        }
      }
    })();
    return () => { alive = false; };
  }, [params, pollUntilConnected, refresh, router]);

  // Refetch on AppState active — also poll for 10s in case user returned manually
  useEffect(() => {
    let postFgTimer: ReturnType<typeof setTimeout> | null = null;
    let postFgInterval: ReturnType<typeof setInterval> | null = null;
    const sub = AppState.addEventListener("change", (st) => {
      console.log(`[BROKER_UI] AppState -> ${st}`);
      if (st === "active") {
        refresh();
        if (postFgTimer) clearTimeout(postFgTimer);
        if (postFgInterval) clearInterval(postFgInterval);
        postFgInterval = setInterval(() => refresh(), 1500);
        postFgTimer = setTimeout(() => {
          if (postFgInterval) {
            clearInterval(postFgInterval);
            postFgInterval = null;
          }
        }, 10000);
      }
    });
    return () => {
      sub.remove();
      if (postFgTimer) clearTimeout(postFgTimer);
      if (postFgInterval) clearInterval(postFgInterval);
    };
  }, [refresh]);

  // When the active broker transitions to "connected" while the user is on
  // this screen, surface a success toast and clear any pending amber card.
  // This catches the case where the user closes the OAuth browser, the
  // BrokerContext polls in the background, and we want immediate feedback.
  const prevConnectedRef = useRef<boolean>(connected);
  useEffect(() => {
    console.log(`[BROKER_UI] connected watcher: prev=${prevConnectedRef.current} now=${connected} activeBroker=${activeBroker}`);
    if (!prevConnectedRef.current && connected && activeBroker) {
      console.log(`[BROKER_UI] CONNECTED transition detected for ${activeBroker}`);
      setSuccessBroker(activeBroker);
      showToast(`${labelOf(activeBroker)} connected successfully`);
      setLoginNotConfirmed(null);
      if (pollAbortRef.current) {
        pollAbortRef.current.cancelled = true;
        pollAbortRef.current = null;
      }
      setConnecting(null);
      setConnectingLabel("");
      setConnectingStep("");
      setExpandedId(null);
      setTimeout(() => {
        setSuccessBroker((curr) => (curr === activeBroker ? null : curr));
      }, 2500);
    }
    prevConnectedRef.current = connected;
  }, [connected, activeBroker]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const handleSwitch = async (b: BrokerDef) => {
    setSwitchingTo(b.id);
    setSwitchingBroker(b);
    try {
      await switchBroker(b.id);
      showToast(`Switched to ${b.name}. Please log in to ${b.name}.`);
      setLoginNotConfirmed(b.id);
    } catch (e: any) {
      showToast(e?.message || "Could not switch broker");
    } finally {
      setSwitchingTo(null);
      setSwitchingBroker(null);
    }
  };

  const handleConnect = async (brokerId: string, keys: Record<string, string>) => {
    console.log(`[BROKER_UI] handleConnect START brokerId=${brokerId} keys=${Object.keys(keys).join(",")}`);
    const form = getBrokerForm(brokerId);
    console.log(`[BROKER_UI] form.flow=${form.flow} form.save=${form.save}`);
    setConnecting(brokerId);
    setConnectingLabel(labelOf(brokerId));
    setConnectingStep("Saving credentials…");
    setLoginNotConfirmed(null);
    const abort = { cancelled: false };
    pollAbortRef.current = abort;
    try {
      if (form.flow === "oauth" || form.flow === "token") {
        setConnectingStep(`Opening ${labelOf(brokerId)} login…`);
        const result = await connectOAuth(brokerId, keys, () => {
          console.log(`[BROKER_UI] onBrowserOpened fired — dismissing spinner`);
          if (pollAbortRef.current === abort) {
            pollAbortRef.current = null;
            setConnecting(null);
            setConnectingLabel("");
            setConnectingStep("");
          }
        });
        if (abort.cancelled) return;

        // If connectOAuth returned a loginUrl, open it in our in-app
        // WebView screen which intercepts the redirect and consumes the
        // token automatically. This is the only way to detect the
        // server's callback in RN — the HTML page doesn't redirect to
        // a custom scheme.
        if (result.loginUrl) {
          console.log(`[BROKER_UI] navigating to in-app WebView for ${brokerId}`);
          if (pollAbortRef.current === abort) {
            pollAbortRef.current = null;
            setConnecting(null);
            setConnectingLabel("");
            setConnectingStep("");
          }
          router.push({
            pathname: "/broker-webview" as any,
            params: {
              url: result.loginUrl,
              brokerId,
              brokerName: labelOf(brokerId),
            } as any,
          });
          return;
        }

        if (result.connected) {
          setSuccessBroker(brokerId);
          showToast(`${labelOf(brokerId)} connected successfully`);
          await refresh();
          setExpandedId(null);
          setLoginNotConfirmed(null);
          setTimeout(() => {
            setSuccessBroker((curr) => (curr === brokerId ? null : curr));
          }, 2500);
        } else {
          setLoginNotConfirmed(brokerId);
        }
      } else if (form.flow === "login") {
        const payload = { ...keys };
        if (brokerId === "angelone") {
          const totpValue = keys.totp || "";
          if (totpValue) {
            if (/^\d{6}$/.test(totpValue)) {
              payload.totp = totpValue;
            } else {
              payload.totpSecret = totpValue;
            }
            delete payload.totp;
          }
        }
        setConnectingStep("Authenticating…");
        await request("POST", form.save, payload);
        if (abort.cancelled) return;
        setConnectingStep("Verifying session…");
        const ok = await pollUntilConnected(brokerId, { timeoutMs: 30000, intervalMs: 1000 });
        if (abort.cancelled) return;
        if (ok) {
          setSuccessBroker(brokerId);
          showToast(`${labelOf(brokerId)} connected successfully`);
          await refresh();
          setExpandedId(null);
          setLoginNotConfirmed(null);
          setTimeout(() => {
            setSuccessBroker((curr) => (curr === brokerId ? null : curr));
          }, 2500);
        } else {
          setLoginNotConfirmed(brokerId);
        }
      } else {
        setConnectingStep("Saving token…");
        await request("POST", form.save, keys);
        if (abort.cancelled) return;
        setConnectingStep("Verifying session…");
        const ok = await pollUntilConnected(brokerId, { timeoutMs: 30000, intervalMs: 1000 });
        if (abort.cancelled) return;
        if (ok) {
          setSuccessBroker(brokerId);
          showToast(`${labelOf(brokerId)} connected successfully`);
          await refresh();
          setExpandedId(null);
          setLoginNotConfirmed(null);
          setTimeout(() => {
            setSuccessBroker((curr) => (curr === brokerId ? null : curr));
          }, 2500);
        } else {
          setLoginNotConfirmed(brokerId);
        }
      }
    } catch (e: any) {
      console.error(`[BROKER_UI] handleConnect THREW: ${e?.message || e}`);
      showToast(e?.message || "Connection failed");
      setLoginNotConfirmed(brokerId);
    } finally {
      if (pollAbortRef.current === abort) {
        pollAbortRef.current = null;
        setConnecting(null);
        setConnectingLabel("");
        setConnectingStep("");
      }
    }
  };

  const cancelConnecting = () => {
    console.log(`[BROKER_UI] cancelConnecting called`);
    if (pollAbortRef.current) {
      pollAbortRef.current.cancelled = true;
      pollAbortRef.current = null;
    }
    setConnecting(null);
    setConnectingLabel("");
    setConnectingStep("");
    setLoginNotConfirmed(null);
  };

  const handleUseThisBroker = async (id: string) => {
    try {
      const r: any = await request("POST", brokerActivePath(), { broker: id });
      if (r?.instrumentSync) {
        setInstrumentSync(r.instrumentSync);
      }
      await refresh();
      showToast(`Switched to ${r?.activeBrokerName || labelOf(id)}. Please log in to ${labelOf(id)}.`);
      setLoginNotConfirmed(id);
    } catch (e: any) {
      showToast(e?.message || "Could not switch broker");
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await setStringAsync(text);
      showToast("Copied to clipboard");
    } catch {
      showToast("Could not copy");
    }
  };

  const renderBrokerCard = (b: BrokerDef) => {
    const isActive = b.id === activeBroker;
    const isExpanded = expandedId === b.id;
    const form = getBrokerForm(b.id);
    const rawStatus = brokerStatuses[b.id];
    const status = mapBrokerStatus(rawStatus, b.id);
    const isConnected = status.connected;

    return (
      <View
        key={b.id}
        style={[
          styles.brokerCard,
          { borderColor: (isActive ? b.color : "transparent") + "44" },
        ]}
      >
        {/* Header row */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setExpandedId(isExpanded ? null : b.id)}
          style={{ flex: 1 }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <BrokerLogo id={b.id} name={b.name} color={b.color} size={48} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <Text style={styles.brokerName}>{b.name}</Text>
                <View style={[styles.shortChip, { borderColor: b.color + "44" }]}>
                  <Text style={[styles.shortChipText, { color: b.color }]}>{b.short}</Text>
                </View>
                {isActive && (
                  <View style={[styles.activeBadge, { backgroundColor: b.color + "22", borderColor: b.color + "88" }]}>
                    <Text style={[styles.activeBadgeText, { color: b.color }]}>ACTIVE</Text>
                  </View>
                )}
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                {(b.features || []).map((f: string) => (
                  <View key={f} style={styles.featureChip}>
                    <Text style={styles.featureChipText}>{f}</Text>
                  </View>
                ))}
              </View>
            </View>
            <Ionicons
              name={isExpanded ? "chevron-up" : "chevron-down"}
              size={18}
              color={colors.text.secondary}
            />
          </View>
        </TouchableOpacity>

        {/* Expanded form area */}
        {isExpanded && (
          <View style={{ marginTop: spacing.base }}>
            {isActive && (
              <Card style={{ marginBottom: spacing.base }}>
                <Text style={styles.sectionLabel}>ACTIVE BROKER DETAILS</Text>
                {brokerExtras ? (
                  <View>
                    {brokerExtras?.clientId && (
                      <Text style={styles.infoRow}>Client ID: <Text style={{ color: colors.text.primary, fontWeight: "700" }}>{brokerExtras.clientId}</Text></Text>
                    )}
                    {brokerExtras?.expiresAt && (
                      <Text style={styles.infoRow}>Token expires: <Text style={{ color: colors.text.primary, fontWeight: "700" }}>{new Date(brokerExtras.expiresAt).toLocaleString()}</Text></Text>
                    )}
                    {brokerExtras?.accessTokenSet !== undefined && (
                      <Text style={styles.infoRow}>Access token: <Text style={{ color: brokerExtras.accessTokenSet ? "#34D399" : "#FF3344", fontWeight: "700" }}>{brokerExtras.accessTokenSet ? "Set" : "Not set"}</Text></Text>
                    )}
                    {brokerExtras?.lastError && (
                      <Text style={styles.infoRow}>Last error: <Text style={{ color: "#FF3344" }}>{brokerExtras.lastError}</Text></Text>
                    )}
                  </View>
                ) : null}

                {/* Funds */}
                {funds && isActive && (
                  <View style={styles.fundsBox}>
                    <Text style={styles.fundsLabel}>{activeBrokerName.toUpperCase()} BALANCE</Text>
                    <View style={{ flexDirection: "row", marginTop: 8 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text.disabled, fontSize: 9, fontWeight: "700" }}>AVAILABLE</Text>
                        <Text style={{ color: "#00FF66", fontSize: 16, fontWeight: "800", marginTop: 2 }}>
                          ₹{Number(funds.availableBalance || 0).toLocaleString("en-IN")}
                        </Text>
                      </View>
                      <View style={{ flex: 1, borderLeftWidth: 1, borderLeftColor: "rgba(255,255,255,0.06)", paddingLeft: 12 }}>
                        <Text style={{ color: colors.text.disabled, fontSize: 9, fontWeight: "700" }}>UTILIZED</Text>
                        <Text style={{ color: "#FFB800", fontSize: 16, fontWeight: "800", marginTop: 2 }}>
                          ₹{Number(funds.utilizedAmount || 0).toLocaleString("en-IN")}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}

                {/* Instrument sync chip */}
                {instrumentSync && (
                  <View style={styles.syncChip}>
                    <Ionicons
                      name={instrumentSync.synced ? "checkmark-circle" : "sync"}
                      size={14}
                      color={instrumentSync.synced ? "#00FF66" : "#FFB800"}
                    />
                    <Text style={{ color: instrumentSync.synced ? "#00FF66" : "#FFB800", fontSize: 11, fontWeight: "600", marginLeft: 6 }}>
                      {instrumentSync.synced
                        ? `Instruments mapped (${instrumentSync.mappedCount || 0})`
                        : instrumentSync.error
                        ? `Sync failed: ${instrumentSync.error}`
                        : "Mapping instruments…"}
                    </Text>
                    {instrumentSync.error && (
                      <TouchableOpacity onPress={() => syncInstruments(b.id)} style={{ marginLeft: 8 }}>
                        <Text style={{ color: "#7C5CFF", fontSize: 11, fontWeight: "700" }}>Retry</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {/* Actions */}
                {isActive && !isConnected && status.status !== "keys_saved" && (
                  <View style={{ marginTop: spacing.sm }}>
                    <Button
                      title={`Connect ${b.name}`}
                      onPress={() => setExpandedId(b.id)}
                      testID={`broker-connect-${b.id}`}
                    />
                  </View>
                )}
                {isActive && status.status === "keys_saved" && (
                  <View style={{ marginTop: spacing.sm }}>
                    <Button
                      title={`Login ${b.name}`}
                      onPress={() => setExpandedId(b.id)}
                      testID={`broker-login-${b.id}`}
                    />
                  </View>
                )}
              </Card>
            )}

            {/* Connect form for this broker */}
            <ConnectForm
              brokerId={b.id}
              brokerName={b.name}
              isActive={isActive}
              onConnect={(keys) => handleConnect(b.id, keys)}
              onUseBroker={() => handleUseThisBroker(b.id)}
              onCopyUrl={(url) => copyToClipboard(url)}
              connected={isConnected}
              redirectUrl={getRedirectUrl(b.id, {})}
              connecting={connecting === b.id}
              initialApiKey={(brokerExtras as any)?.clientId || undefined}
              brokerStatus={rawStatus}
              brokerState={status.status}
              onDisconnect={async () => { await disconnect(b.id); }}
            />
          </View>
        )}
      </View>
        );
  };

  if (status === "loading" && !refreshing) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg.primary }} edges={["top"]}>
        <View style={{ alignItems: "center", paddingVertical: 60 }}>
          <ActivityIndicator size="large" color="#7C5CFF" />
          <Text style={{ color: colors.text.secondary, marginTop: 12, fontWeight: "700" }}>Loading brokers…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg.primary }} edges={["top"]}>
        {/* Amber "Login not confirmed" card — shown after a connect attempt that timed out */}
        {loginNotConfirmed && !connected && (
          <View style={styles.amberCard}>
            <Ionicons name="alert-circle" size={18} color="#FFB800" />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={{ color: "#FFB800", fontWeight: "800", fontSize: 13 }}>
                Login not confirmed for {labelOf(loginNotConfirmed)}
              </Text>
              <Text style={{ color: colors.text.secondary, fontSize: 11, marginTop: 2 }}>
                Open the broker login URL below in any browser, log in, then paste the
                final URL (with the token) into the form.
              </Text>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                <TouchableOpacity
                  onPress={async () => {
                    const id = loginNotConfirmed;
                    try {
                      const start: any = await request("GET", `/broker/${id}/login-url`);
                      const u = start?.url || start?.loginUrl;
                      if (u) {
                        await setStringAsync(u);
                        showToast("Login URL copied — open it in any browser");
                      } else {
                        showToast("Could not get login URL");
                      }
                    } catch (e: any) {
                      showToast(e?.message || "Could not get login URL");
                    }
                  }}
                  style={styles.amberBtn}
                >
                  <Text style={{ color: "#FFB800", fontWeight: "700", fontSize: 12 }}>Copy login URL</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setExpandedId(loginNotConfirmed)}
                  style={styles.amberBtn}
                >
                  <Text style={{ color: "#FFB800", fontWeight: "700", fontSize: 12 }}>Paste redirect</Text>
                </TouchableOpacity>
              </View>
            </View>
            <TouchableOpacity onPress={() => setLoginNotConfirmed(null)}>
              <Ionicons name="close" size={18} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>
        )}
        <ScrollView
          contentContainerStyle={{ padding: spacing.base, paddingBottom: insets.bottom + 80 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
        >
          <Heading variant="h3" style={{ marginBottom: spacing.base }}>Brokers</Heading>

          <View style={styles.searchRow}>
            <Ionicons name="search" size={18} color={colors.text.disabled} style={{ marginRight: 10 }} />
            <TextInput
              placeholder="Search brokers..."
              placeholderTextColor={colors.text.disabled}
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={styles.searchInput}
              testID="broker-search"
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery("")} style={{ paddingHorizontal: 6 }}>
                <Ionicons name="close-circle" size={18} color={colors.text.secondary} />
              </TouchableOpacity>
            ) : null}
          </View>

        {connected && (
          <View style={styles.singleBrokerBanner}>
            <Ionicons name="information-circle" size={16} color="#7C5CFF" />
            <Text style={{ color: colors.text.secondary, fontSize: 12, flex: 1, marginLeft: 8 }}>
              Only one broker can be active at a time. Switch brokers to disconnect the current one.
            </Text>
          </View>
        )}

        {sortedBrokers().length === 0 ? (
          <Card>
            <Body style={{ textAlign: "center" }}>No brokers available yet. Check back soon.</Body>
          </Card>
        ) : (
          sortedBrokers().map((b: BrokerDef) => renderBrokerCard(b))
        )}
      </ScrollView>

      {/* Switching loader modal */}
      <Modal visible={!!switchingTo} transparent animationType="fade">
        <View style={styles.switchBackdrop}>
          <View style={styles.switchCard}>
            <ActivityIndicator size="large" color={switchingBroker?.color || "#7C5CFF"} />
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16, marginTop: 16 }}>
              Preparing {switchingBroker?.name || ""} contracts…
            </Text>
            <Text style={{ color: colors.text.secondary, fontSize: 12, marginTop: 6, textAlign: "center" }}>
              Syncing instruments & clearing previous broker session
            </Text>
          </View>
        </View>
      </Modal>

      {/* Connecting loader modal */}
      <Modal visible={!!connecting} transparent animationType="fade">
        <View style={styles.switchBackdrop}>
          <View style={styles.switchCard}>
            <ActivityIndicator size="large" color="#00FF66" />
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16, marginTop: 16 }}>
              {connectingLabel ? `Connecting to ${connectingLabel}…` : "Connecting to broker…"}
            </Text>
            <Text style={{ color: colors.text.secondary, fontSize: 12, marginTop: 6, textAlign: "center" }}>
              {connectingStep || "Complete the login in the browser, then come back here.\nWe'll detect your session automatically."}
            </Text>
            <TouchableOpacity
              onPress={cancelConnecting}
              style={{ marginTop: 16, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" }}
            >
              <Text style={{ color: colors.text.secondary, fontSize: 12, fontWeight: "700" }}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Connection-confirmed popup — green, auto-dismiss in 2.5s */}
      <Modal visible={!!successBroker} transparent animationType="fade">
        <View style={styles.switchBackdrop}>
          <View style={[styles.switchCard, { borderColor: "rgba(0,255,102,0.5)" }]}>
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                backgroundColor: "rgba(0,255,102,0.15)",
                borderWidth: 2,
                borderColor: "#00FF66",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="checkmark" size={42} color="#00FF66" />
            </View>
            <Text style={{ color: "#00FF66", fontWeight: "800", fontSize: 18, marginTop: 16 }}>
              {successBroker ? `${labelOf(successBroker)} connected successfully` : "Connected"}
            </Text>
            <Text style={{ color: colors.text.secondary, fontSize: 12, marginTop: 6, textAlign: "center" }}>
              Your broker session is active. Funds, positions and the engine will use this connection.
            </Text>
            <TouchableOpacity
              onPress={() => setSuccessBroker(null)}
              style={{ marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8, backgroundColor: "#00FF66" }}
            >
              <Text style={{ color: "#020010", fontSize: 13, fontWeight: "800" }}>
                Continue
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────
// REDIRECT URL CARD
// ─────────────────────────────────────────────
function RedirectUrlCard({ url, onCopy }: { url: string; onCopy: (url: string) => void }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await onCopy(url);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <View style={styles.redirectCard}>
      <Text style={styles.redirectLabel}>REDIRECT URL — paste this in the broker portal</Text>
      <Text selectable numberOfLines={2} style={styles.redirectUrl}>
        {url}
      </Text>
      <TouchableOpacity onPress={copy} style={styles.redirectBtn} accessibilityLabel="Copy redirect URL">
        <Ionicons name={copied ? "checkmark" : "copy"} size={16} color={copied ? "#00FF66" : "#7C5CFF"} />
        <Text style={{ color: copied ? "#00FF66" : "#7C5CFF", fontSize: 12, fontWeight: "700", marginLeft: 6 }}>
          {copied ? "Copied" : "Copy"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ─────────────────────────────────────────────
// CONNECT FORM
// ─────────────────────────────────────────────
function ConnectForm({
  brokerId,
  brokerName,
  isActive,
  onConnect,
  onUseBroker,
  onCopyUrl,
  connected,
  redirectUrl,
  connecting,
  initialApiKey,
  brokerStatus,
  brokerState,
  onDisconnect,
}: {
  brokerId: string;
  brokerName: string;
  isActive: boolean;
  onConnect: (keys: Record<string, string>) => void;
  onUseBroker: () => void;
  onCopyUrl: (url: string) => void;
  connected: boolean;
  redirectUrl?: string;
  connecting?: boolean;
  initialApiKey?: string;
  brokerStatus?: any;
  brokerState?: string;
  onDisconnect?: () => void;
}) {
  const router = useRouter();
  const [keys, setKeys] = useState<Record<string, string>>(() => {
    if (initialApiKey && (brokerId === "zerodha" || brokerId === "upstox" || brokerId === "fyers" || brokerId === "5paisa" || brokerId === "aliceblue" || brokerId === "groww")) {
      const keyFieldMap: Record<string, string> = {
        zerodha: "apiKey",
        upstox: "apiKey",
        fyers: "appId",
        "5paisa": "appKey",
        fivepaisa: "appKey",
        aliceblue: "appCode",
        groww: "apiKey",
      };
      const f = keyFieldMap[brokerId];
      if (f) return { [f]: initialApiKey };
    }
    return {};
  });
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<"oauth" | "keys">("oauth");
  const [pasteUrl, setPasteUrl] = useState("");
  const [showPaste, setShowPaste] = useState(false);

  const form = getBrokerForm(brokerId);
  const flow = form.flow;
  const isConnecting = connecting || saving;

  useEffect(() => {
    if (flow === "login") {
      setMode("keys");
    }
  }, [flow]);

  const handleConnect = async () => {
    setSaving(true);
    try {
      await onConnect(keys);
    } finally {
      setSaving(false);
    }
  };

  const handlePasteRedirect = async () => {
    if (!pasteUrl) return showToast("Paste the redirect URL");
    setSaving(true);
    try {
      const extracted = extractRedirectToken(brokerId, pasteUrl);
      if (!extracted) {
        throw new Error("Could not extract token from the pasted URL");
      }
      await consumeRedirectToken(brokerId, extracted);
      showToast("Token submitted — verifying…");
      // Poll
      let connected = await pollConnected(brokerId, 10);
      if (!connected) {
        await new Promise((r) => setTimeout(r, 1500));
        connected = await verifyConnectionAfterPoll(brokerId);
      }
      if (connected) {
        showToast("Connected successfully");
        onConnect(keys);
      } else {
        showToast("Could not verify connection after pasting URL.");
      }
    } catch (e: any) {
      showToast(e?.message || "Could not process redirect URL");
    } finally {
      setSaving(false);
      setShowPaste(false);
      setPasteUrl("");
    }
  };

  if (connected && !isActive) {
    return (
      <View>
        <Button
          title={`Use ${brokerName}`}
          onPress={onUseBroker}
          testID={`broker-use-${brokerId}`}
          style={{ marginTop: spacing.sm }}
        />
      </View>
    );
  }

  return (
    <Card style={{ marginTop: spacing.sm }}>
      <Heading variant="h4">
        {connected
          ? `${brokerName} Connected`
          : brokerState === "keys_saved"
          ? `${brokerName} — Keys Saved`
          : (connected ? `Update ${brokerName} Credentials` : `Connect ${brokerName}`)}
      </Heading>

      {connected ? (
        <View style={{ marginTop: spacing.base }}>
          <Body style={{ marginBottom: spacing.base }}>{brokerName} is connected and active.</Body>
          <Button title="Disconnect" onPress={() => onDisconnect?.()} testID={`broker-disconnect-${brokerId}`} />
        </View>
      ) : flow === "token" && brokerId === "dhan" ? (
        <View style={{ marginTop: spacing.base }}>
          <Body style={{ marginBottom: spacing.base }}>
            Paste your Dhan access token below. Token is valid for ~24 hours.
          </Body>
          {brokerStatus?.clientId ? (
            <View style={{ marginBottom: spacing.base }}>
              <Text style={{ color: colors.text.secondary, fontSize: 12, marginBottom: 4 }}>Client ID saved</Text>
              <Text style={{ color: colors.text.primary, fontSize: 14, fontWeight: '600' }}>
                {'•'.repeat(Math.max(0, (brokerStatus.clientId || '').length - 3))}{(brokerStatus.clientId || '').slice(-3)}
              </Text>
            </View>
          ) : (
            <Input
              key="dhanClientId"
              label="Client ID"
              value={keys.dhanClientId || ""}
              onChangeText={(v: string) => setKeys((p) => ({ ...p, dhanClientId: v }))}
              placeholder={`${brokerName} Client ID`}
              testID={`broker-dhanClientId-input-${brokerId}`}
            />
          )}
          {form.fields.filter((f: Field) => f.key !== "dhanClientId").map((f: Field) => (
            <Input
              key={f.key}
              label={f.label}
              value={keys[f.key] || ""}
              onChangeText={(v: string) => setKeys((p) => ({ ...p, [f.key]: v }))}
              placeholder={`${brokerName} ${f.label}`}
              secureTextEntry={f.secret}
              multiline={f.multiline}
              keyboardType={f.key === "totp" || f.keyboard === "number-pad" ? "number-pad" : "default"}
              testID={`broker-${f.key}-input-${brokerId}`}
            />
          ))}
          <Button
            title="Open Dhan to Get Token"
            onPress={async () => {
              router.push('/dhan-token' as any);
            }}
            testID="dhan-get-token-btn"
            style={{ marginBottom: spacing.sm }}
          />
          <Button title={connected ? "Update Credentials" : form.cta} onPress={handleConnect} loading={isConnecting} disabled={isConnecting} testID={`broker-manual-save-${brokerId}`} />
        </View>
      ) : brokerState === "keys_saved" ? (
        <View style={{ marginTop: spacing.base }}>
          <Body style={{ marginBottom: spacing.base }}>Your {brokerName} credentials are saved. Log in to complete the connection.</Body>
          <Button title={`Login with ${brokerName}`} onPress={handleConnect} loading={isConnecting} disabled={isConnecting} testID={`broker-login-keys-saved-${brokerId}`} />
          <TouchableOpacity style={{ marginTop: spacing.sm, alignItems: "center" }} onPress={() => setMode("keys")}>
            <Text style={{ color: colors.text.secondary, fontSize: 12 }}>Edit saved keys</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View>
          {flow === "oauth" && form.needsRedirect && redirectUrl && (
            <RedirectUrlCard url={redirectUrl} onCopy={onCopyUrl} />
          )}

          {flow === "oauth" && (
            <View style={styles.modeRow}>
              <TouchableOpacity
                style={[styles.modeTab, mode === "oauth" && styles.modeTabActive]}
                onPress={() => setMode("oauth")}
              >
                <Text style={{ color: mode === "oauth" ? "#050505" : colors.text.primary, fontWeight: "700", fontSize: 12 }}>
                  Auto Connect
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeTab, mode === "keys" && styles.modeTabActive]}
                onPress={() => setMode("keys")}
              >
                <Text style={{ color: mode === "keys" ? "#050505" : colors.text.primary, fontWeight: "700", fontSize: 12 }}>
                  Manual
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {mode === "oauth" && flow === "oauth" ? (
            <View style={{ marginTop: spacing.base }}>
              <Body style={{ marginBottom: spacing.base }}>
                We&apos;ll open {brokerName}&apos;s login page. After you authorize, you&apos;ll be brought back automatically.
              </Body>
              {/* Credential fields — required so we can save them before opening the broker. */}
              {form.fields.map((f: Field) => (
                <Input
                  key={f.key}
                  label={f.label}
                  value={keys[f.key] || ""}
                  onChangeText={(v: string) => setKeys((p) => ({ ...p, [f.key]: v }))}
                  placeholder={`${brokerName} ${f.label}`}
                  secureTextEntry={f.secret}
                  keyboardType={f.key === "totp" || f.keyboard === "number-pad" ? "number-pad" : "default"}
                  testID={`broker-${f.key}-input-${brokerId}`}
                />
              ))}
              {form.fields.find((f) => f.hint) && (
                <Text style={{ color: colors.text.disabled, fontSize: 11, marginBottom: spacing.base }}>
                  {form.fields.find((f) => f.hint)?.hint}
                </Text>
              )}
              <Button
                title={`Connect with ${brokerName}`}
                onPress={handleConnect}
                loading={isConnecting}
                disabled={isConnecting}
                testID={`broker-oauth-btn-${brokerId}`}
              />
              <TouchableOpacity
                style={{ marginTop: spacing.sm, alignItems: "center" }}
                onPress={() => setShowPaste(true)}
              >
                <Text style={{ color: colors.text.secondary, fontSize: 12 }}>Paste redirect URL</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ marginTop: spacing.base }}>
              {form.fields.map((f: Field) => {
                if (f.key === "totp" && brokerId === "angelone") {
                  return (
                    <Input
                      key={f.key}
                      label={f.label}
                      value={keys[f.key] || ""}
                      onChangeText={(v: string) => setKeys((p) => ({ ...p, [f.key]: v }))}
                      placeholder={f.hint || `${brokerName} ${f.label}`}
                      secureTextEntry={f.secret}
                      keyboardType={f.keyboard === "number-pad" ? "number-pad" : "default"}
                      testID={`broker-${f.key}-input-${brokerId}`}
                    />
                  );
                }
                if (f.copyable && keys[f.key]) {
                  return (
                    <View key={f.key} style={{ marginBottom: spacing.base }}>
                      <Text style={{ color: colors.text.secondary, fontSize: 11, marginBottom: spacing.sm, fontWeight: "700", letterSpacing: 1 }}>
                        {f.label}
                      </Text>
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <View style={{ flex: 1 }}>
                          <Input
                            value={keys[f.key] || ""}
                            onChangeText={(v: string) => setKeys((p) => ({ ...p, [f.key]: v }))}
                            placeholder={`${brokerName} ${f.label}`}
                            secureTextEntry={f.secret}
                            testID={`broker-${f.key}-input-${brokerId}`}
                          />
                        </View>
                        <TouchableOpacity
                          style={styles.copyBtn}
                          onPress={() => onCopyUrl(keys[f.key] || "")}
                        >
                          <Ionicons name="copy-outline" size={18} color="#7C5CFF" />
                        </TouchableOpacity>
                      </View>
                      {f.hint && <Text style={{ color: colors.text.disabled, fontSize: 11, marginTop: 4 }}>{f.hint}</Text>}
                    </View>
                  );
                }
                return (
                  <Input
                    key={f.key}
                    label={f.label}
                    value={keys[f.key] || ""}
                    onChangeText={(v: string) => setKeys((p) => ({ ...p, [f.key]: v }))}
                    placeholder={`${brokerName} ${f.label}`}
                    secureTextEntry={f.secret}
                    keyboardType={f.keyboard === "number-pad" ? "number-pad" : "default"}
                    testID={`broker-${f.key}-input-${brokerId}`}
                  />
                );
              })}
              {form.fields.find((f) => f.hint) && !form.fields.find((f) => f.copyable) && (
                <Text style={{ color: colors.text.disabled, fontSize: 11, marginBottom: spacing.base }}>
                  {form.fields.find((f) => f.hint)?.hint}
                </Text>
              )}
              <Button title={connected ? "Update Credentials" : form.cta} onPress={handleConnect} loading={isConnecting} disabled={isConnecting} testID={`broker-manual-save-${brokerId}`} />
            </View>
          )}
        </View>
      )}

      {/* Paste redirect URL modal */}
      <Modal visible={showPaste} transparent animationType="fade">
        <View style={styles.switchBackdrop}>
          <View style={styles.switchCard}>
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16, marginBottom: spacing.base }}>
              Paste Redirect URL
            </Text>
            <Input
              label="Redirect URL"
              value={pasteUrl}
              onChangeText={setPasteUrl}
              placeholder="https://api.indexpilotai.com/.../callback?tokenId=..."
              testID={`broker-paste-url-${brokerId}`}
            />
            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.base }}>
              <View style={{ flex: 1 }}>
                <Button title="Cancel" variant="ghost" onPress={() => setShowPaste(false)} testID={`broker-paste-cancel-${brokerId}`} />
              </View>
              <View style={{ flex: 1 }}>
                <Button title="Submit" onPress={handlePasteRedirect} loading={isConnecting} disabled={isConnecting} testID={`broker-paste-submit-${brokerId}`} />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </Card>
  );
}

const styles = StyleSheet.create({
  brokerCard: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.base,
    marginBottom: spacing.base,
  },
  brokerName: { color: colors.text.primary, fontSize: 16, fontWeight: "800" },
  shortChip: {
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 1,
  },
  shortChipText: { fontSize: 10, fontWeight: "700" },
  activeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  activeBadgeText: { fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  featureChip: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  featureChipText: { color: colors.text.secondary, fontSize: 10, fontWeight: "600" },
  balanceText: { color: "#00FF66", fontSize: 12, fontWeight: "700" },
  hintText: { color: colors.text.disabled, fontSize: 11, marginTop: 2 },
  sectionLabel: { color: colors.text.disabled, fontSize: 10, fontWeight: "800", letterSpacing: 1.5, marginBottom: spacing.sm },
  infoRow: { color: colors.text.secondary, fontSize: 12, marginBottom: 4 },
  fundsBox: {
    backgroundColor: "rgba(0,180,255,0.05)",
    borderRadius: radius.md,
    padding: spacing.base,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: "rgba(0,180,255,0.15)",
  },
  fundsLabel: { color: "#00B4FF", fontSize: 10, fontWeight: "800", letterSpacing: 1.5 },
  syncChip: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.sm,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  redirectCard: {
    backgroundColor: "rgba(124,92,255,0.08)",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(124,92,255,0.25)",
    padding: spacing.base,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  redirectLabel: { color: colors.text.disabled, fontSize: 10, fontWeight: "800", letterSpacing: 1, marginBottom: spacing.sm },
  redirectUrl: { color: colors.text.primary, fontSize: 12, fontWeight: "600", marginBottom: spacing.sm },
  redirectBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
    backgroundColor: "rgba(124,92,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(124,92,255,0.4)",
  },
  modeRow: {
    flexDirection: "row",
    backgroundColor: colors.bg.primary,
    borderRadius: radius.sm,
    padding: 4,
    marginTop: spacing.base,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  modeTab: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: radius.sm - 2 },
  modeTabActive: { backgroundColor: colors.brand.primary },
  switchBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  switchCard: {
    backgroundColor: "#0A0820",
    borderRadius: radius.xl,
    padding: spacing.lg,
    alignItems: "center",
    width: "100%",
    maxWidth: 320,
    borderWidth: 1,
    borderColor: "rgba(124,92,255,0.3)",
  },
  copyBtn: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: "rgba(124,92,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(124,92,255,0.3)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.base,
  },
  singleBrokerBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(124,92,255,0.08)",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(124,92,255,0.2)",
    padding: spacing.sm,
    marginBottom: spacing.base,
  },
  amberCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "rgba(255,184,0,0.08)",
    borderColor: "rgba(255,184,0,0.4)",
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.base,
    marginHorizontal: spacing.base,
    marginTop: spacing.base,
  },
  amberBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: "rgba(255,184,0,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,184,0,0.4)",
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bg.primary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    marginBottom: spacing.base,
  },
  searchInput: {
    flex: 1,
    color: colors.text.primary,
    fontSize: 15,
    paddingVertical: 0,
  },
});
