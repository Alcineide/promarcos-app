import { Feather } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/src/legacy/FileSystem";
import { EncodingType } from "expo-file-system/src/legacy/FileSystem.types";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as Print from "expo-print";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useScanQueue } from "@/contexts/ScanQueue";

const TIPO_MAP: Record<string, string> = {
  "folha-rosto": "Folha de Rosto",
  procuracao: "Procuração",
  "docs-pessoais": "Docs Pessoais",
  residencia: "Residência",
  "fato-gerador": "Fato Gerador",
  "cert-casamento": "Cert. Casamento",
  "cert-obito": "Cert. Óbito",
  "provas-rurais": "Provas Rurais",
  "laudo-medico": "Laudo Médico",
  outros: "Outros",
};

function makeId() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

interface ScannedPage {
  id: string;
  uri: string;
}

export default function ScannerScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    clienteId: string;
    clienteNome: string;
    categoria: string;
    categoriaNome: string;
  }>();

  const { clienteId, clienteNome, categoria, categoriaNome } = params;
  const tipoPromarcos = TIPO_MAP[categoria] ?? categoriaNome ?? "Documento";

  const { addToQueue } = useScanQueue();
  const [pages, setPages] = useState<ScannedPage[]>([]);
  const [scanning, setScanning] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  async function handleScanDocument() {
    setScanning(true);
    try {
      // On native: try the document scanner plugin first (works in release builds)
      if (Platform.OS !== "web") {
        try {
          const DocumentScanner = (await import("react-native-document-scanner-plugin")).default;
          const { scannedImages } = await DocumentScanner.scanDocument({
            croppedImageQuality: 90,
          });
          if (scannedImages && scannedImages.length > 0) {
            const newPages: ScannedPage[] = scannedImages.map((uri) => ({
              id: makeId(),
              uri,
            }));
            setPages((prev) => [...prev, ...newPages]);
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            return;
          }
        } catch (pluginErr) {
          const msg = pluginErr instanceof Error ? pluginErr.message : String(pluginErr);
          // Only fall through if it's not a user cancel
          if (
            msg.toLowerCase().includes("cancel") ||
            msg.toLowerCase().includes("user cancel")
          ) {
            return;
          }
          // Plugin not available (Expo Go) — fall through to camera with editing
        }
      }

      // Fallback: camera with cropping UI (Expo Go compatible)
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permissão de câmera necessária",
          "Permita o acesso à câmera nas configurações do dispositivo."
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 0.92,
        allowsEditing: true,
        aspect: [3, 4],
        exif: false,
      });

      if (!result.canceled && result.assets.length > 0) {
        const newPages: ScannedPage[] = result.assets.map((a) => ({
          id: makeId(),
          uri: a.uri,
        }));
        setPages((prev) => [...prev, ...newPages]);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } finally {
      setScanning(false);
    }
  }

  async function handlePickFromGallery() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permissão necessária", "Permita o acesso à galeria nas configurações.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
      allowsMultipleSelection: true,
      selectionLimit: 20,
    });

    if (!result.canceled && result.assets.length > 0) {
      const newPages: ScannedPage[] = result.assets.map((a) => ({
        id: makeId(),
        uri: a.uri,
      }));
      setPages((prev) => [...prev, ...newPages]);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }

  function handleRemovePage(id: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPages((prev) => prev.filter((p) => p.id !== id));
  }

  const [building, setBuilding] = useState(false);

  async function handleAddToQueue() {
    if (pages.length === 0) return;
    setBuilding(true);
    try {
      const base64Images = await Promise.all(
        pages.map(async (page) => {
          const b64 = await FileSystem.readAsStringAsync(page.uri, { encoding: EncodingType.Base64 });
          const ext = page.uri.split(".").pop()?.toLowerCase() ?? "jpg";
          const mime = ext === "png" ? "image/png" : "image/jpeg";
          return { b64, mime };
        })
      );

      const pageHtml = base64Images.map(
        ({ b64, mime }) =>
          `<div style="page-break-after:always;width:100%;height:100vh;display:flex;align-items:center;justify-content:center;margin:0;padding:0;">
            <img src="data:${mime};base64,${b64}" style="max-width:100%;max-height:100vh;object-fit:contain;" />
          </div>`
      );

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>*{margin:0;padding:0;box-sizing:border-box;}body{background:#fff;}</style></head><body>${pageHtml.join("")}</body></html>`;
      const { uri } = await Print.printToFileAsync({ html });
      const pdfBase64 = await FileSystem.readAsStringAsync(uri, { encoding: EncodingType.Base64 });

      const safeName = (clienteNome ?? "cliente").toUpperCase().replace(/\s+/g, "_");
      const pdfFileName = `${safeName}_${tipoPromarcos.replace(/\s+/g, "_")}_${Date.now()}.pdf`;

      addToQueue({
        clienteId,
        clienteNome,
        categoria,
        categoriaNome: tipoPromarcos,
        pages: [...pages],
        pdfBase64,
        pdfFileName,
        pageCount: pages.length,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (err) {
      Alert.alert("Erro", "Não foi possível preparar o PDF. Tente novamente.");
    } finally {
      setBuilding(false);
    }
  }

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Feather name="x" size={22} color={Colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerCategory}>{tipoPromarcos}</Text>
          <Text style={styles.headerClient} numberOfLines={1}>{clienteNome}</Text>
        </View>
        {pages.length > 0 ? (
          <View style={styles.pageCountBadge}>
            <Text style={styles.pageCountText}>{pages.length}p</Text>
          </View>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {/* Scan mode hint bar */}
      <View style={styles.scanHintBar}>
        <Feather name="aperture" size={14} color={Colors.primary} />
        <Text style={styles.scanHintText}>
          MODO SCANNER — Posicione o documento dentro da câmera e toque em Escanear
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad + 130 }]}
      >
        {pages.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.docFrameHint}>
              {/* Decorative document outline */}
              <View style={styles.docFrameCornerTL} />
              <View style={styles.docFrameCornerTR} />
              <View style={styles.docFrameCornerBL} />
              <View style={styles.docFrameCornerBR} />
              <Feather name="file-text" size={52} color={Colors.primary + "60"} />
            </View>
            <Text style={styles.emptyTitle}>Nenhuma página ainda</Text>
            <Text style={styles.emptyText}>
              Toque em <Text style={{ fontFamily: "Inter_700Bold", color: Colors.primary }}>Escanear</Text> para capturar um documento.{"\n"}
              O scanner detecta as bordas automaticamente.
            </Text>
          </View>
        ) : (
          <View style={styles.pagesGrid}>
            {pages.map((page, idx) => (
              <View key={page.id} style={styles.pageCard}>
                <Image source={{ uri: page.uri }} style={styles.pageImg} resizeMode="cover" />
                <View style={styles.pageBadge}>
                  <Text style={styles.pageBadgeText}>Pág. {idx + 1}</Text>
                </View>
                <Pressable
                  style={styles.pageRemoveBtn}
                  onPress={() => handleRemovePage(page.id)}
                  hitSlop={8}
                >
                  <Feather name="x" size={14} color="#fff" />
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Bottom action bar */}
      <View style={[styles.bottomBar, { paddingBottom: bottomPad + 12 }]}>
        {/* Gallery */}
        <Pressable style={styles.iconBtn} onPress={handlePickFromGallery}>
          <Feather name="image" size={22} color={Colors.primary} />
          <Text style={styles.iconBtnLabel}>Galeria</Text>
        </Pressable>

        {/* Scan (main CTA) */}
        <Pressable
          style={[styles.scanBtn, scanning && styles.scanBtnDisabled]}
          onPress={handleScanDocument}
          disabled={scanning}
        >
          {scanning ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Feather name="aperture" size={30} color="#fff" />
          )}
          <Text style={styles.scanBtnLabel}>
            {scanning ? "Aguarde..." : pages.length === 0 ? "Escanear" : "+ Escanear"}
          </Text>
        </Pressable>

        {/* Add to queue / Done */}
        <Pressable
          style={[styles.iconBtn, (pages.length === 0 || building) && styles.iconBtnDisabled]}
          onPress={handleAddToQueue}
          disabled={pages.length === 0 || building}
        >
          {building ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <Feather
              name="check-circle"
              size={22}
              color={pages.length > 0 ? Colors.success : Colors.textMuted}
            />
          )}
          <Text style={[styles.iconBtnLabel, (pages.length === 0 || building) && { color: Colors.textMuted }]}>
            {building ? "Preparando..." : "Confirmar"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 4,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: { flex: 1, alignItems: "center" },
  headerCategory: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  headerClient: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    maxWidth: 200,
  },
  pageCountBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  pageCountText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },

  scanHintBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.primary + "12",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.primary + "20",
  },
  scanHintText: {
    flex: 1,
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: Colors.primary,
    lineHeight: 16,
  },

  scrollContent: { padding: 16, flexGrow: 1 },

  emptyState: {
    alignItems: "center",
    paddingTop: 48,
    paddingHorizontal: 32,
  },
  docFrameHint: {
    width: 140,
    height: 180,
    borderRadius: 12,
    backgroundColor: Colors.primary + "08",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
    position: "relative",
  },
  docFrameCornerTL: {
    position: "absolute",
    top: 10,
    left: 10,
    width: 24,
    height: 24,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: Colors.primary,
    borderTopLeftRadius: 4,
  },
  docFrameCornerTR: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 24,
    height: 24,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: Colors.primary,
    borderTopRightRadius: 4,
  },
  docFrameCornerBL: {
    position: "absolute",
    bottom: 10,
    left: 10,
    width: 24,
    height: 24,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderColor: Colors.primary,
    borderBottomLeftRadius: 4,
  },
  docFrameCornerBR: {
    position: "absolute",
    bottom: 10,
    right: 10,
    width: 24,
    height: 24,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },

  pagesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  pageCard: {
    width: "47%",
    aspectRatio: 3 / 4,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: Colors.card,
    position: "relative",
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  pageImg: { width: "100%", height: "100%" },
  pageBadge: {
    position: "absolute",
    bottom: 6,
    left: 6,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  pageBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  pageRemoveBtn: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(239,68,68,0.85)",
    alignItems: "center",
    justifyContent: "center",
  },

  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-evenly",
    paddingTop: 16,
    paddingHorizontal: 20,
    backgroundColor: Colors.card,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 10,
  },
  iconBtn: {
    alignItems: "center",
    gap: 4,
    padding: 8,
  },
  iconBtnDisabled: { opacity: 0.4 },
  iconBtnLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.primary,
  },
  scanBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 56,
    width: 120,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  scanBtnDisabled: { opacity: 0.6 },
  scanBtnLabel: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
});
