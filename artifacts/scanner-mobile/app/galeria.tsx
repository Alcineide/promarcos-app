import { Feather } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/src/legacy/FileSystem";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import * as Sharing from "expo-sharing";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { OfflineBanner } from "@/components/OfflineBanner";
import Colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { QueuedDoc, useScanQueue } from "@/contexts/ScanQueue";
import { useNetworkStatus } from "@/lib/network";
import { triggerSync } from "@/lib/upload-sync";

const BASE_DIR = FileSystem.documentDirectory + "MendesAdvocacia/";

interface DirEntry {
  name: string;
  uri: string;
  isDir: boolean;
  modificationTime?: number;
  size?: number;
}

function formatSize(bytes?: number) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(ts?: number) {
  if (!ts) return "";
  return new Date(ts * 1000).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatIsoDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function fileIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "file-text";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".png")) return "image";
  return "file";
}

function fileColor(name: string) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "#E53E3E";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".png")) return "#3182CE";
  return Colors.textSecondary;
}

function statusLabel(status: string) {
  switch (status) {
    case "pending": return "Aguardando";
    case "syncing": return "Enviando...";
    case "failed": return "Falhou";
    default: return status;
  }
}

function statusColor(status: string) {
  switch (status) {
    case "pending": return "#D97706";
    case "syncing": return "#2563EB";
    case "failed": return "#DC2626";
    default: return Colors.textSecondary;
  }
}

export default function GaleriaScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ dir?: string; titulo?: string }>();
  const currentDir = params.dir ?? BASE_DIR;
  const titulo = params.titulo ?? "Documentos";
  const isRoot = currentDir === BASE_DIR;

  const { logout } = useAuth();
  const { isOnline } = useNetworkStatus();
  const { queue, removeFromQueue, markForRetry, clearAll } = useScanQueue();
  const [entries, setEntries] = useState<DirEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"files" | "queue">(isRoot ? "queue" : "files");

  const pendingQueue = queue.filter((d) => d.uploadStatus !== "synced");

  const loadDir = useCallback(async () => {
    try {
      const info = await FileSystem.getInfoAsync(currentDir);
      if (!info.exists) {
        setEntries([]);
        return;
      }
      const names = await FileSystem.readDirectoryAsync(currentDir);
      const detailed = await Promise.all(
        names.map(async (name) => {
          const uri = currentDir + name;
          const stat = await FileSystem.getInfoAsync(uri, { md5: false });
          const isDir = stat.isDirectory ?? false;
          return {
            name,
            uri,
            isDir,
            modificationTime: (stat as any).modificationTime,
            size: (stat as any).size,
          } as DirEntry;
        })
      );
      detailed.sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
        return (b.modificationTime ?? 0) - (a.modificationTime ?? 0);
      });
      setEntries(detailed);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentDir]);

  useEffect(() => { loadDir(); }, [loadDir]);

  function handleRefresh() {
    setRefreshing(true);
    loadDir();
  }

  async function handleLogout() {
    Alert.alert("Sair", "Deseja encerrar a sessão?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Sair",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/login");
        },
      },
    ]);
  }

  function openEntry(entry: DirEntry) {
    if (entry.isDir) {
      router.push({
        pathname: "/galeria",
        params: { dir: entry.uri + "/", titulo: entry.name },
      });
    } else {
      handleShare(entry);
    }
  }

  async function handleShare(entry: DirEntry) {
    try {
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert("Compartilhar", "Compartilhamento não disponível neste dispositivo.");
        return;
      }
      await Sharing.shareAsync(entry.uri, { dialogTitle: entry.name });
    } catch {
      Alert.alert("Erro", "Não foi possível compartilhar o arquivo.");
    }
  }

  async function handleDelete(entry: DirEntry) {
    Alert.alert(
      entry.isDir ? "Excluir pasta" : "Excluir arquivo",
      `Deseja apagar "${entry.name}" permanentemente?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            try {
              await FileSystem.deleteAsync(entry.uri, { idempotent: true });
              loadDir();
            } catch {
              Alert.alert("Erro", "Não foi possível excluir.");
            }
          },
        },
      ]
    );
  }

  function handleRetryDoc(doc: QueuedDoc) {
    markForRetry(doc.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isOnline) {
      setTimeout(() => triggerSync(), 300);
    }
  }

  function handleRemoveQueueDoc(doc: QueuedDoc) {
    Alert.alert(
      "Remover da fila",
      `Remover "${doc.categoriaNome}" de ${doc.clienteNome}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Remover",
          style: "destructive",
          onPress: () => {
            removeFromQueue(doc.id);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          },
        },
      ]
    );
  }

  function handleClearQueue() {
    Alert.alert(
      "Limpar fila",
      "Remover todos os documentos pendentes da fila de envio?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Limpar tudo",
          style: "destructive",
          onPress: () => clearAll(),
        },
      ]
    );
  }

  function handleSyncNow() {
    if (!isOnline) {
      Alert.alert("Sem conexão", "Conecte-se à internet para enviar documentos.");
      return;
    }
    triggerSync();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <OfflineBanner />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Feather name="arrow-left" size={22} color={Colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{titulo}</Text>
          <Text style={styles.headerSub}>
            {isRoot
              ? activeTab === "queue"
                ? `${pendingQueue.length} na fila de envio`
                : `${entries.length} pasta${entries.length !== 1 ? "s" : ""}`
              : `${entries.length} item${entries.length !== 1 ? "s" : ""}`}
          </Text>
        </View>
        <View style={{ flexDirection: "row", gap: 6 }}>
          <Pressable
            onPress={() => router.replace("/home")}
            style={styles.refreshBtn}
            hitSlop={8}
          >
            <Feather name="user-plus" size={20} color={Colors.primary} />
          </Pressable>
          <Pressable onPress={handleRefresh} style={styles.refreshBtn} hitSlop={8}>
            <Feather name="refresh-cw" size={20} color={Colors.primary} />
          </Pressable>
          <Pressable
            onPress={handleLogout}
            style={[styles.refreshBtn, { backgroundColor: "#FFF5F5", borderColor: "#FED7D7" }]}
            hitSlop={8}
          >
            <Feather name="log-out" size={18} color="#E53E3E" />
          </Pressable>
        </View>
      </View>

      {isRoot && (
        <View style={styles.tabRow}>
          <Pressable
            style={[styles.tabBtn, activeTab === "queue" && styles.tabBtnActive]}
            onPress={() => setActiveTab("queue")}
          >
            <Feather name="upload-cloud" size={16} color={activeTab === "queue" ? Colors.primary : Colors.textMuted} />
            <Text style={[styles.tabText, activeTab === "queue" && styles.tabTextActive]}>
              Fila de Envio
            </Text>
            {pendingQueue.length > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{pendingQueue.length}</Text>
              </View>
            )}
          </Pressable>
          <Pressable
            style={[styles.tabBtn, activeTab === "files" && styles.tabBtnActive]}
            onPress={() => setActiveTab("files")}
          >
            <Feather name="folder" size={16} color={activeTab === "files" ? Colors.primary : Colors.textMuted} />
            <Text style={[styles.tabText, activeTab === "files" && styles.tabTextActive]}>
              Salvos no Dispositivo
            </Text>
          </Pressable>
        </View>
      )}

      {(isRoot && activeTab === "queue") ? (
        <View style={{ flex: 1 }}>
          {pendingQueue.length > 0 && (
            <View style={styles.queueActions}>
              <Pressable style={styles.syncNowBtn} onPress={handleSyncNow}>
                <Feather name="upload-cloud" size={16} color="#fff" />
                <Text style={styles.syncNowText}>Enviar agora</Text>
              </Pressable>
              <Pressable style={styles.clearQueueBtn} onPress={handleClearQueue}>
                <Feather name="trash-2" size={16} color="#E53E3E" />
              </Pressable>
            </View>
          )}

          <FlatList
            data={pendingQueue}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24, flexGrow: 1 }]}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Feather name="check-circle" size={52} color={Colors.border} />
                <Text style={styles.emptyTitle}>Fila vazia</Text>
                <Text style={styles.emptyText}>
                  Todos os documentos foram enviados com sucesso
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <QueueDocRow
                doc={item}
                onRetry={() => handleRetryDoc(item)}
                onRemove={() => handleRemoveQueueDoc(item)}
              />
            )}
          />
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.uri}
          numColumns={isRoot ? 2 : 1}
          key={isRoot ? "grid" : "list"}
          contentContainerStyle={[
            isRoot ? styles.gridContent : styles.listContent,
            { paddingBottom: insets.bottom + 24 },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[Colors.primary]} />}
          ListEmptyComponent={
            !loading ? (
              <View style={styles.emptyState}>
                <Feather name="folder-minus" size={52} color={Colors.border} />
                <Text style={styles.emptyTitle}>
                  {isRoot ? "Nenhum documento salvo" : "Pasta vazia"}
                </Text>
                <Text style={styles.emptyText}>
                  {isRoot
                    ? "Os documentos escaneados e salvos localmente aparecerão aqui"
                    : "Nenhum arquivo encontrado nesta pasta"}
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item }) =>
            isRoot ? (
              <FolderCard entry={item} onOpen={openEntry} onDelete={handleDelete} />
            ) : (
              <FileRow entry={item} onOpen={openEntry} onShare={handleShare} onDelete={handleDelete} />
            )
          }
        />
      )}
    </View>
  );
}

function QueueDocRow({
  doc,
  onRetry,
  onRemove,
}: {
  doc: QueuedDoc;
  onRetry: () => void;
  onRemove: () => void;
}) {
  const isFailed = doc.uploadStatus === "failed";
  const isSyncing = doc.uploadStatus === "syncing";

  return (
    <View style={styles.queueRow}>
      <View style={[styles.queueIconWrap, { backgroundColor: statusColor(doc.uploadStatus) + "18" }]}>
        {isSyncing ? (
          <ActivityIndicator size="small" color={statusColor(doc.uploadStatus)} />
        ) : (
          <Feather
            name={isFailed ? "alert-circle" : "clock"}
            size={22}
            color={statusColor(doc.uploadStatus)}
          />
        )}
      </View>
      <View style={styles.queueInfo}>
        <Text style={styles.queueDocName} numberOfLines={1}>{doc.categoriaNome}</Text>
        <Text style={styles.queueClientName} numberOfLines={1}>{doc.clienteNome}</Text>
        <View style={styles.queueMeta}>
          <Text style={[styles.queueStatus, { color: statusColor(doc.uploadStatus) }]}>
            {statusLabel(doc.uploadStatus)}
          </Text>
          <Text style={styles.queueDate}>{formatIsoDate(doc.addedAt)}</Text>
          {doc.pages.length > 0 && (
            <Text style={styles.queuePages}>{doc.pages.length} pg</Text>
          )}
        </View>
        {isFailed && doc.lastError && (
          <Text style={styles.queueError} numberOfLines={2}>{doc.lastError}</Text>
        )}
      </View>
      <View style={styles.queueActions2}>
        {isFailed && (
          <Pressable onPress={onRetry} style={styles.retryBtn} hitSlop={8}>
            <Feather name="refresh-cw" size={17} color="#2563EB" />
          </Pressable>
        )}
        <Pressable onPress={onRemove} style={styles.removeBtn} hitSlop={8}>
          <Feather name="x" size={17} color="#E53E3E" />
        </Pressable>
      </View>
    </View>
  );
}

function FolderCard({
  entry,
  onOpen,
  onDelete,
}: {
  entry: DirEntry;
  onOpen: (e: DirEntry) => void;
  onDelete: (e: DirEntry) => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.folderCard, { opacity: pressed ? 0.85 : 1 }]}
      onPress={() => onOpen(entry)}
      onLongPress={() => onDelete(entry)}
    >
      <View style={styles.folderIconWrap}>
        <Feather name="folder" size={38} color="#F6AD55" />
      </View>
      <Text style={styles.folderName} numberOfLines={2}>{entry.name}</Text>
      <Text style={styles.folderDate}>{formatDate(entry.modificationTime)}</Text>
    </Pressable>
  );
}

function FileRow({
  entry,
  onOpen,
  onShare,
  onDelete,
}: {
  entry: DirEntry;
  onOpen: (e: DirEntry) => void;
  onShare: (e: DirEntry) => void;
  onDelete: (e: DirEntry) => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.fileRow, { opacity: pressed ? 0.85 : 1 }]}
      onPress={() => onOpen(entry)}
    >
      <View style={[styles.fileIconWrap, { backgroundColor: fileColor(entry.name) + "18" }]}>
        {entry.isDir ? (
          <Feather name="folder" size={26} color="#F6AD55" />
        ) : (
          <Feather name={fileIcon(entry.name)} size={26} color={fileColor(entry.name)} />
        )}
      </View>
      <View style={styles.fileInfo}>
        <Text style={styles.fileName} numberOfLines={2}>{entry.name}</Text>
        <Text style={styles.fileMeta}>
          {[formatSize(entry.size), formatDate(entry.modificationTime)].filter(Boolean).join(" · ")}
        </Text>
      </View>
      <View style={styles.fileActions}>
        {!entry.isDir && (
          <Pressable onPress={() => onShare(entry)} style={styles.iconBtn} hitSlop={8}>
            <Feather name="share-2" size={19} color={Colors.primary} />
          </Pressable>
        )}
        <Pressable onPress={() => onDelete(entry)} style={styles.iconBtn} hitSlop={8}>
          <Feather name="trash-2" size={19} color="#E53E3E" />
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 8,
    gap: 10,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: Colors.card,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.text },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginTop: 1 },
  refreshBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: Colors.accentLight,
    alignItems: "center",
    justifyContent: "center",
  },

  tabRow: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: Colors.card,
    padding: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabBtnActive: {
    backgroundColor: Colors.accentLight,
  },
  tabText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.textMuted,
  },
  tabTextActive: {
    color: Colors.primary,
    fontFamily: "Inter_600SemiBold",
  },
  tabBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  tabBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },

  queueActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    marginBottom: 8,
    gap: 8,
  },
  syncNowBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  syncNowText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  clearQueueBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#FFF5F5",
    alignItems: "center",
    justifyContent: "center",
  },

  queueRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
    gap: 12,
  },
  queueIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  queueInfo: { flex: 1 },
  queueDocName: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
    marginBottom: 2,
  },
  queueClientName: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  queueMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  queueStatus: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  queueDate: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  queuePages: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  queueError: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#DC2626",
    marginTop: 4,
    lineHeight: 14,
  },
  queueActions2: {
    flexDirection: "row",
    gap: 6,
  },
  retryBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  removeBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#FFF5F5",
    alignItems: "center",
    justifyContent: "center",
  },

  gridContent: { paddingHorizontal: 16, paddingTop: 4 },
  listContent: { paddingHorizontal: 16, paddingTop: 4 },

  folderCard: {
    flex: 1,
    margin: 6,
    backgroundColor: Colors.card,
    borderRadius: 18,
    padding: 16,
    alignItems: "center",
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
    minHeight: 130,
  },
  folderIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: "#FEFCE8",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  folderName: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
    textAlign: "center",
    marginBottom: 4,
  },
  folderDate: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
  },

  fileRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
    gap: 12,
  },
  fileIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  fileInfo: { flex: 1 },
  fileName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.text, marginBottom: 3 },
  fileMeta: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  fileActions: { flexDirection: "row", gap: 4 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.background,
  },

  emptyState: {
    alignItems: "center",
    paddingTop: 80,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
    marginTop: 16,
    marginBottom: 8,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
});
