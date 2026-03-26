import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";

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

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export default function ClienteScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string; nome: string; cpf: string }>();
  const { id, nome, cpf } = params;

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  function handleCategoria(catId: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: "/scanner",
      params: {
        clienteId: id,
        clienteNome: nome,
        categoria: catId,
        categoriaNome: TIPO_MAP[catId] ?? catId,
      },
    });
  }

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Feather name="arrow-left" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>Documentos</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPad + 24 }}
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

        {/* Section title */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Tipo de Documento</Text>
          <Text style={styles.sectionSub}>Toque para escanear</Text>
        </View>

        {/* Category grid */}
        <View style={styles.grid}>
          {CATEGORIAS.map((cat) => (
            <Pressable
              key={cat.id}
              style={({ pressed }) => [styles.catCard, { opacity: pressed ? 0.85 : 1 }]}
              onPress={() => handleCategoria(cat.id)}
              testID={`cat-${cat.id}`}
            >
              <View style={[styles.catIconBox, { backgroundColor: cat.color + "18" }]}>
                <Feather name={cat.icon as any} size={26} color={cat.color} />
              </View>
              <Text style={styles.catLabel} numberOfLines={2}>{cat.label}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
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
    marginBottom: 24,
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
  clientAvatarText: {
    color: "#fff",
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  clientInfo: { flex: 1 },
  clientName: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    marginBottom: 3,
  },
  clientCpf: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    marginBottom: 8,
  },
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
  badgeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: Colors.accent,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  sectionSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 14,
    gap: 10,
  },
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
  },
  catIconBox: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  catLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
    textAlign: "center",
    lineHeight: 18,
  },
});
