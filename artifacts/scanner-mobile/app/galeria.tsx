import { Feather } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/build/legacy/FileSystem";
import { router, useLocalSearchParams } from "expo-router";
import * as Sharing from "expo-sharing";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";

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

export default function GaleriaScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ dir?: string; titulo?: string }>();

  const currentDir = params.dir ?? BASE_DIR;
  const titulo = params.titulo ?? "Documentos Escaneados";
  const isRoot = currentDir === BASE_DIR;

  const { logout } = useAuth();
  const [entries, setEntries] = useState<DirEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

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
      // Sort: folders first, then files by date desc
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

  function handleRefresh() { setRefreshing(true); loadDir(); }

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
    } catch (e) {
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

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Feather name="arrow-left" size={22} color={Colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{titulo}</Text>
          <Text style={styles.headerSub}>
            {isRoot ? "Documentos salvos por cliente" : `${entries.length} item${entries.length !== 1 ? "s" : ""}`}
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

      {/* List */}
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
    </View>
  );
}

// ── Folder card (grid layout for root) ──────────────────────────────
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

// ── File row (list layout for subdir) ───────────────────────────────
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
    paddingBottom: 16,
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

  gridContent: { paddingHorizontal: 16, paddingTop: 4 },
  listContent: { paddingHorizontal: 16, paddingTop: 4 },

  // Folder grid card
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

  // File list row
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
