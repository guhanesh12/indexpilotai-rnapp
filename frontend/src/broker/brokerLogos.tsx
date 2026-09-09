/**
 * Broker logos — bundled locally, keyed by broker id.
 *
 * Unknown/new broker id → coloured initial fallback using `color`.
 * Never crash.
 */

import { Image, View, Text, StyleSheet } from "react-native";

export const BROKER_LOGOS: Record<string, any> = {
  dhan: require("../assets/brokers/dhan.png"),
  zerodha: require("../assets/brokers/zerodha.png"),
  kite: require("../assets/brokers/zerodha.png"),
  groww: require("../assets/brokers/groww.png"),
  upstox: require("../assets/brokers/upstox.png"),
  angelone: require("../assets/brokers/angelone.png"),
  fyers: require("../assets/brokers/fyers.png"),
  aliceblue: require("../assets/brokers/aliceblue.png"),
  "5paisa": require("../assets/brokers/fivepaisa.png"),
  fivepaisa: require("../assets/brokers/fivepaisa.png"),
};

export function BrokerLogo({
  id,
  name,
  color = "#64748b",
  size = 40,
}: {
  id?: string;
  name?: string;
  color?: string;
  size?: number;
}) {
  const key = String(id || "").toLowerCase();
  const src = BROKER_LOGOS[key];

  if (!src) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: 12,
          backgroundColor: color,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text
          style={{
            color: "#fff",
            fontWeight: "800",
            fontSize: size * 0.42,
          }}
        >
          {(name || id || "?").slice(0, 1).toUpperCase()}
        </Text>
      </View>
    );
  }

  return (
    <Image
      source={src}
      style={{ width: size, height: size, borderRadius: 12 }}
      resizeMode="contain"
    />
  );
}
