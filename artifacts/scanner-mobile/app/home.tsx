import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { apiGet } from "@/config/api";

interface PromarcosPessoa {
  codigo: number;
  nomecompleto: string;
  cpf?: string;
  nome?: string;
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const [termo, setTermo] = useState("");
  const [results, setResults] = useState<PromarcosPessoa[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  async function handleSearch() {
    const t = termo.trim();
    if (t.length < 2) {
      Alert.alert("Busca", "Digite pelo menos 2 caracteres.");
      return;
    }
    setLoading(true);
    setSearched(false);
    try {
      const data = await apiGet<PromarcosPessoa[]>(
        `/promarcos/buscarsocio/${encodeURIComponent(t)}`
      );
      setResults(Array.isArray(data) ? data : []);
      setSearched(true);
    } catch {
      setResults([]);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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

  function handleSelectClient(pessoa: PromarcosPessoa) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: "/cliente/[id]",
      params: {
        id: String(pessoa.codigo),
        nome: pessoa.nomecompleto || pessoa.nome || "Cliente",
        cpf: pessoa.cpf || "",
      },
    });
  }

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Olá, {user?.nome?.split(" ")[0] ?? "Colaborador"}</Text>
          <Text style={styles.headerSub}>Busque um cliente para escanear documentos</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => router.push("/galeria")}
            style={[styles.avatar, { marginRight: 8 }]}
            hitSlop={8}
          >
            <Feather name="folder" size={18} color={Colors.primary} />
          </Pressable>
          <Pressable onPress={handleLogout} style={styles.avatarBtn} hitSlop={8}>
            <View style={styles.avatar}>
              <Feather name="log-out" size={18} color={Colors.primary} />
            </View>
          </Pressable>
        </View>
      </View>

      {/* Search bar */}
      <View style={styles.searchBox}>
        <Feather name="search" size={20} color={Colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={termo}
          onChangeText={setTermo}
          placeholder="Nome ou CPF do cliente..."
          placeholderTextColor={Colors.textMuted}
          returnKeyType="search"
          onSubmitEditing={handleSearch}
          autoCorrect={false}
          testID="search-input"
        />
        {termo.length > 0 && (
          <Pressable onPress={() => { setTermo(""); setResults([]); setSearched(false); }} hitSlop={8}>
            <Feather name="x" size={18} color={Colors.textMuted} />
          </Pressable>
        )}
        <Pressable
          style={styles.searchBtn}
          onPress={handleSearch}
          disabled={loading}
          testID="search-btn"
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Feather name="arrow-right" size={18} color="#fff" />
          )}
        </Pressable>
      </View>

      {/* Results */}
      <FlatList
        data={results}
        keyExtractor={(item) => String(item.codigo)}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: bottomPad + 16 },
        ]}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!!results.length}
        ListEmptyComponent={
          searched && !loading ? (
            <View style={styles.emptyState}>
              <Feather name="users" size={48} color={Colors.border} />
              <Text style={styles.emptyTitle}>Nenhum cliente encontrado</Text>
              <Text style={styles.emptyText}>Tente outro nome ou CPF</Text>
            </View>
          ) : !searched ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconBox}>
                <Feather name="file-text" size={36} color={Colors.accent} />
              </View>
              <Text style={styles.emptyTitle}>Escaneie documentos</Text>
              <Text style={styles.emptyText}>
                Busque um cliente pelo nome ou CPF para iniciar o escaneamento de documentos
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.clientCard, { opacity: pressed ? 0.9 : 1 }]}
            onPress={() => handleSelectClient(item)}
            testID={`client-${item.codigo}`}
          >
            <View style={styles.clientAvatar}>
              <Text style={styles.clientAvatarText}>{initials(item.nomecompleto || item.nome || "?")}</Text>
            </View>
            <View style={styles.clientInfo}>
              <Text style={styles.clientName} numberOfLines={1}>
                {item.nomecompleto || item.nome}
              </Text>
              {item.cpf ? (
                <Text style={styles.clientCpf}>CPF: {item.cpf}</Text>
              ) : null}
            </View>
            <Feather name="chevron-right" size={20} color={Colors.textMuted} />
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 8,
  },
  greeting: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    marginBottom: 2,
  },
  headerSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    maxWidth: 220,
  },
  headerActions: { flexDirection: "row", alignItems: "center" },
  avatarBtn: {},
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.accentLight,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.card,
    borderRadius: 16,
    marginHorizontal: 20,
    marginBottom: 16,
    paddingLeft: 14,
    paddingRight: 6,
    height: 54,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  searchIcon: { marginRight: 10 },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
    height: "100%",
  },
  searchBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  listContent: { paddingHorizontal: 20, paddingTop: 4, flexGrow: 1 },
  clientCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  clientAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  clientAvatarText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  clientInfo: { flex: 1 },
  clientName: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
    marginBottom: 2,
  },
  clientCpf: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 32,
  },
  emptyIconBox: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: Colors.accentLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
    marginTop: 12,
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
