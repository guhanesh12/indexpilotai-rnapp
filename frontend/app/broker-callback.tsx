import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { useRouter, useLocalSearchParams, useNavigation } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { colors, spacing } from "../src/lib/theme";
import { useBroker } from "../src/broker/BrokerContext";
import { extractRedirectToken, consumeRedirectToken, pollConnected } from "../src/broker/connectOAuth";
import { API_BASE } from "../src/broker/brokerPaths";

export default function BrokerCallbackScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams();
  const { activeBroker, refresh } = useBroker();
  const [status, setStatus] = useState<string>("Processing…");

  useFocusEffect(
    React.useCallback(() => {
      let cancelled = false;

      async function handleCallback() {
        try {
          // Build the redirect URL from params
          const query = new URLSearchParams();
          Object.entries(params).forEach(([k, v]) => {
            if (v && typeof v === "string") query.set(k, v);
          });
          const brokerId = String((params as any)?.broker || activeBroker || "");
          const url = `${API_BASE}/broker/${brokerId}/callback?${query.toString()}`;

          const extracted = extractRedirectToken(brokerId, url);
          if (!extracted) {
            setStatus("No token found in redirect URL");
            setTimeout(() => router.replace("/(tabs)/broker"), 1500);
            return;
          }

          setStatus("Completing connection…");
          await consumeRedirectToken(brokerId, extracted);

          const connected = await pollConnected(brokerId, 13);
          if (connected && !cancelled) {
            setStatus("Connected!");
            await refresh();
            setTimeout(() => {
              router.replace("/(tabs)/broker");
            }, 800);
          } else if (!cancelled) {
            setStatus("Connection not confirmed — retry from the Broker screen.");
            setTimeout(() => router.replace("/(tabs)/broker"), 1500);
          }
        } catch (e: any) {
          if (!cancelled) {
            setStatus(e?.message || "Callback failed");
            setTimeout(() => router.replace("/(tabs)/broker"), 1500);
          }
        }
      }

      handleCallback();

      return () => {
        cancelled = true;
      };
    }, [activeBroker, params, refresh, router, navigation])
  );

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#7C5CFF" />
      <Text style={styles.status}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  status: {
    color: colors.text.secondary,
    fontSize: 14,
    marginTop: spacing.base,
    textAlign: "center",
  },
});
