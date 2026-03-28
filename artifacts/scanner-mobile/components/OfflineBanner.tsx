import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useNetworkStatus } from "@/lib/network";
import { useScanQueue } from "@/contexts/ScanQueue";

export function OfflineBanner() {
  const { isOnline, isChecking } = useNetworkStatus();
  const { pendingCount, failedCount } = useScanQueue();

  if (isChecking) return null;

  if (!isOnline) {
    return (
      <View style={styles.offlineBanner}>
        <Feather name="wifi-off" size={14} color="#fff" />
        <Text style={styles.offlineText}>Sem conexão — documentos serão enviados quando a internet voltar</Text>
      </View>
    );
  }

  if (pendingCount > 0) {
    return (
      <View style={styles.syncingBanner}>
        <Feather name="upload-cloud" size={14} color="#fff" />
        <Text style={styles.syncingText}>
          {pendingCount} documento{pendingCount !== 1 ? "s" : ""} aguardando envio
        </Text>
      </View>
    );
  }

  if (failedCount > 0) {
    return (
      <View style={styles.failedBanner}>
        <Feather name="alert-triangle" size={14} color="#fff" />
        <Text style={styles.failedText}>
          {failedCount} envio{failedCount !== 1 ? "s" : ""} com falha — toque na galeria para tentar novamente
        </Text>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  offlineBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#DC2626",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  offlineText: {
    flex: 1,
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    lineHeight: 16,
  },
  syncingBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#2563EB",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  syncingText: {
    flex: 1,
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  failedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#D97706",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  failedText: {
    flex: 1,
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
});
