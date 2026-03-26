import { Feather } from "@expo/vector-icons";
import { File, documentDirectory, makeDirectoryAsync, copyAsync, getInfoAsync } from "expo-file-system";
import * as Haptics from "expo-haptics";
import * as MediaLibrary from "expo-media-library";
import * as Print from "expo-print";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiPost } from "@/config/api";
import Colors from "@/constants/colors";
import { QueuedDoc, useScanQueue } from "@/contexts/ScanQueue";

const CATEGORIAS = [
  { id: "folha-rosto", label: "Folha de Rosto", icon: "file-text", color: "#6366F1" },
  { id: "procuracao", label: "Procuração", icon: "shield", color: "#0EA5E9" },
  { id: "docs-pessoais", label: "Docs Pessoais", icon: "user", color: "#10B981" },
  { id: "residencia", label: "Residência", icon: "home", color: "#F59E0B" },
  { id: "fato-gerador", label: "Fato Gerador", icon: "alert-circle", color: "#EF4444" },
  { id: "cert-casamento", label: "Cert. Casamento", icon: "heart", color: "#EC4899" },
  { id: "cert-obito", label: "Cert. Óbito", icon: "book", color: "#6B7280" },
  { id: "provas-rurais", label: "Provas Rurais", icon: "sun", color: "#84CC16" },
  { id: "laudo-medico", label: "Laudo Médico", icon: "activity", color: "#14B8A6" },
  { id: "outros", label: "Outros", icon: "more-horizontal", color: "#8B5CF6" },
] as const;

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

async function buildPdfForDoc(doc: QueuedDoc): Promise<{ uri: string; fileName: string }> {
  const base64Images = await Promise.all(
    doc.pages.map(async (page) => {
      const file = new File(page.uri);
      const b64 = await file.base64();
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

  const nomeCliente = (doc.clienteNome ?? "cliente").toUpperCase().replace(/\s+/g, "_");
  const fileName = `${nomeCliente}_${doc.categoriaNome.replace(/\s+/g, "_")}_${Date.now()}.pdf`;

  return { uri, fileName };
}

async function saveToDevice(pdfUri: string, pdfFileName: string, clienteNome: string): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const safeName = clienteNome
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\s]/g, "")
      .trim()
      .substring(0, 60);
    const folder = `${documentDirectory}MendesAdvocacia/${safeName}/`;
    await makeDirectoryAsync(folder, { intermediates: true });
    const dest = folder + pdfFileName;
    const info = await getInfoAsync(dest);
    if (!info.exists) await copyAsync({ from: pdfUri, to: dest });
    if (Platform.OS === "android") {
      try {
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status === "granted") {
          const asset = await MediaLibrary.createAssetAsync(dest);
          const albumName = `Mendes Advocacia - ${safeName}`;
          const existing = await MediaLibrary.getAlbumAsync(albumName);
          if (existing) {
            await MediaLibrary.addAssetsToAlbumAsync([asset], existing, false);
          } else {
            await MediaLibrary.createAlbumAsync(albumName, asset, false);
          }
        }
      } catch {
        // Ignore silently
      }
    }
  } catch {
    // Non-critical
  }
}

export default function ClienteScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string; nome: string; cpf: string }>();
  const { id, nome, cpf } = params;

  const { queue, removeFromQueue, clearClientQueue } = useScanQueue();
  const clientQueue = queue.filter((d) => d.clienteId === id);
  const totalPages = clientQueue.reduce((acc, d) => acc + d.pages.length, 0);

  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [doneCount, setDoneCount] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const clienteSafeName = (nome ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, "")
    .trim()
    .substring(0, 60);
  const clienteDir = `${documentDirectory}MendesAdvocacia/${clienteSafeName}/`;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  function handleCategoria(catId: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: "/scanner",
      params: {
        clienteId: id,
        clienteNome: nome,
        categoria: catId,
        categoriaNome: CATEGORIAS.find((c) => c.id === catId)?.label ?? catId,
      },
    });
  }

  async function handleEnviarTodos() {
    if (clientQueue.length === 0) return;
    setSending(true);
    setShowSuccess(false);
    setDoneCount(0);

    let successCount = 0;
    for (let i = 0; i < clientQueue.length; i++) {
      const doc = clientQueue[i];
      setProgress({ current: i + 1, total: clientQueue.length });
      try {
        const { uri: pdfUri, fileName: pdfFileName } = await buildPdfForDoc(doc);

        const pdfFile = new File(pdfUri);
        const pdfBase64 = await pdfFile.base64();

        await apiPost("/promarcos/arquivo", {
          pessoaCodigo: parseInt(doc.clienteId, 10),
          fileName: pdfFileName,
          fileBase64: pdfBase64,
          tipo: doc.categoriaNome,
          nome: `${doc.categoriaNome} - ${doc.clienteNome}`,
          mimeType: "application/pdf",
        });

        await saveToDevice(pdfUri, pdfFileName, doc.clienteNome);
        removeFromQueue(doc.id);
        successCount++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro desconhecido";
        Alert.alert(`Erro ao enviar "${doc.categoriaNome}"`, msg, [{ text: "OK" }]);
      }
    }

    setSending(false);
    setProgress(null);
    setDoneCount(successCount);
    if (successCount > 0) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 4000);
    }
  }

  function handleRemoveDoc(docId: string) {
    Alert.alert(
      "Remover documento",
      "Deseja remover este documento da fila de envio?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Remover",
          style: "destructive",
          onPress: () => {
            removeFromQueue(docId);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          },
        },
      ]
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Feather name="arrow-left" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>Documentos</Text>
        {Platform.OS !== "web" ? (
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/galeria",
                params: { dir: clienteDir, titulo: clienteSafeName || nome },
              })
            }
            style={styles.galeriaBtn}
            hitSlop={10}
          >
            <Feather name="folder" size={20} color={Colors.primary} />
          </Pressable>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPad + (clientQueue.length > 0 ? 120 : 24) }}
      >
        {/* Client info card */}
        <View style={styles.clientCard}>
          <View style={styles.clientAvatar}>
            <Text style={styles.clientAvatarText}>{initials(nome ?? "?")}</Text>
          </View>
          <View style={styles.clientInfo}>
            <Text style={styles.clientName} numberOfLines={2}>{nome}</Text>
            {cpf ? <Text style={styles.clientCpf}>CPF: {cpf}</Text> : null}
            <View style={styles.badge}>
              <Feather name="folder" size={12} color={Colors.accent} />
              <Text style={styles.badgeText}>Arquivos Promarcos</Text>
            </View>
          </View>
        </View>

        {/* Success banner */}
        {showSuccess && (
          <View style={styles.successBanner}>
            <Feather name="check-circle" size={18} color="#fff" />
            <Text style={styles.successBannerText}>
              {doneCount} documento{doneCount !== 1 ? "s" : ""} enviado{doneCount !== 1 ? "s" : ""} com sucesso!
            </Text>
          </View>
        )}

        {/* Queue preview */}
        {clientQueue.length > 0 && (
          <View style={styles.queueSection}>
            <View style={styles.queueHeader}>
              <View style={styles.queueHeaderLeft}>
                <Feather name="layers" size={16} color={Colors.primary} />
                <Text style={styles.queueTitle}>Na fila para envio</Text>
                <View style={styles.queueBadge}>
                  <Text style={styles.queueBadgeText}>{totalPages} pág.</Text>
                </View>
              </View>
            </View>
            {clientQueue.map((doc) => (
              <View key={doc.id} style={styles.queueItem}>
                <View style={styles.queueItemIcon}>
                  <Feather name="file-text" size={20} color={Colors.primary} />
                </View>
                <View style={styles.queueItemInfo}>
                  <Text style={styles.queueItemLabel}>{doc.categoriaNome}</Text>
                  <Text style={styles.queueItemMeta}>
                    {doc.pages.length} página{doc.pages.length !== 1 ? "s" : ""}
                  </Text>
                </View>
                <Pressable
                  style={styles.queueItemRemove}
                  onPress={() => handleRemoveDoc(doc.id)}
                  hitSlop={8}
                >
                  <Feather name="trash-2" size={16} color={Colors.error} />
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {/* Section title */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Tipo de Documento</Text>
          <Text style={styles.sectionSub}>Toque para escanear</Text>
        </View>

        {/* Category grid */}
        <View style={styles.grid}>
          {CATEGORIAS.map((cat) => {
            const catDocs = clientQueue.filter((d) => d.categoria === cat.id);
            const catPages = catDocs.reduce((a, d) => a + d.pages.length, 0);
            return (
              <Pressable
                key={cat.id}
                style={({ pressed }) => [styles.catCard, { opacity: pressed ? 0.85 : 1 }]}
                onPress={() => handleCategoria(cat.id)}
                testID={`cat-${cat.id}`}
              >
                {catPages > 0 && (
                  <View style={styles.catQueueBadge}>
                    <Text style={styles.catQueueBadgeText}>{catPages}</Text>
                  </View>
                )}
                <View style={[styles.catIconBox, { backgroundColor: cat.color + "18" }]}>
                  <Feather name={cat.icon as any} size={26} color={cat.color} />
                </View>
                <Text style={styles.catLabel} numberOfLines={2}>{cat.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {/* ENVIAR TODOS bottom bar */}
      {clientQueue.length > 0 && (
        <View style={[styles.sendAllBar, { paddingBottom: bottomPad + 12 }]}>
          {sending && progress && (
            <View style={styles.progressRow}>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={styles.progressText}>
                Enviando {progress.current} de {progress.total}...
              </Text>
            </View>
          )}
          {!sending && (
            <Pressable style={styles.sendAllBtn} onPress={handleEnviarTodos}>
              <Feather name="upload-cloud" size={22} color="#fff" />
              <Text style={styles.sendAllBtnText}>
                Enviar Todos ({clientQueue.length} doc{clientQueue.length !== 1 ? "s" : ""} · {totalPages} pág.)
              </Text>
            </Pressable>
          )}
        </View>
      )}
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
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.card,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 1,
  },
  galeriaBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.accentLight,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  clientCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.card,
    borderRadius: 20,
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 20,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 3,
  },
  clientAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  clientAvatarText: { color: "#fff", fontSize: 20, fontFamily: "Inter_700Bold" },
  clientInfo: { flex: 1 },
  clientName: { fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.text, marginBottom: 3 },
  clientCpf: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginBottom: 8 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.accentLight,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: "flex-start",
    gap: 4,
  },
  badgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: Colors.accent },

  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#16A34A",
    borderRadius: 14,
    marginHorizontal: 20,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  successBannerText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold", flex: 1 },

  queueSection: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: Colors.card,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: Colors.primary + "25",
  },
  queueHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.primary + "08",
  },
  queueHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  queueTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: Colors.primary },
  queueBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  queueBadgeText: { color: "#fff", fontSize: 11, fontFamily: "Inter_700Bold" },
  queueItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  queueItemIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.primary + "12",
    alignItems: "center",
    justifyContent: "center",
  },
  queueItemInfo: { flex: 1 },
  queueItemLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.text },
  queueItemMeta: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginTop: 2 },
  queueItemRemove: { padding: 6 },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: Colors.text },
  sectionSub: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary },

  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 14, gap: 10 },
  catCard: {
    width: "47%",
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
    position: "relative",
  },
  catQueueBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  catQueueBadgeText: { color: "#fff", fontSize: 11, fontFamily: "Inter_700Bold" },
  catIconBox: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  catLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.text, textAlign: "center", lineHeight: 18 },

  sendAllBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 14,
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
  sendAllBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
  },
  sendAllBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 14,
    backgroundColor: Colors.primary,
    borderRadius: 16,
  },
  progressText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
