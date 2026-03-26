import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { apiPost } from "@/config/api";
import type { PromarcoUser } from "@/contexts/AuthContext";

interface LoginResponse {
  codigo?: number;
  nome?: string;
  nomecompleto?: string;
  email?: string;
  login?: string;
  mensagem?: string;
}

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [showSenha, setShowSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const senhaRef = useRef<TextInput>(null);

  async function handleLogin() {
    if (!email.trim() || !senha.trim()) {
      Alert.alert("Campos obrigatórios", "Preencha e-mail e senha.");
      return;
    }
    setLoading(true);
    try {
      const data = await apiPost<LoginResponse>("/promarcos/login", {
        email: email.trim(),
        senha: senha.trim(),
      });

      if (data.mensagem && !data.codigo) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert("Acesso negado", data.mensagem);
        return;
      }

      const user: PromarcoUser = {
        codigo: data.codigo ?? 0,
        nome: data.nome ?? data.nomecompleto ?? email,
        email: data.email ?? email,
        login: data.login ?? email,
      };

      await login(user);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/home");
    } catch (err) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const msg = err instanceof Error ? err.message : "Erro ao fazer login";
      Alert.alert("Erro", msg);
    } finally {
      setLoading(false);
    }
  }

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.scroll, { paddingTop: topPad + 32, paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoArea}>
          <View style={styles.logoBox}>
            <Feather name="briefcase" size={40} color={Colors.accent} />
          </View>
          <Text style={styles.appName}>Mendes Advocacia</Text>
          <Text style={styles.appSub}>Scanner de Documentos</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Entrar</Text>
          <Text style={styles.cardSub}>Use suas credenciais do Promarcos</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>E-mail</Text>
            <View style={styles.inputRow}>
              <Feather name="mail" size={18} color={Colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="seu@email.com"
                placeholderTextColor={Colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => senhaRef.current?.focus()}
                testID="email-input"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Senha</Text>
            <View style={styles.inputRow}>
              <Feather name="lock" size={18} color={Colors.textMuted} style={styles.inputIcon} />
              <TextInput
                ref={senhaRef}
                style={styles.input}
                value={senha}
                onChangeText={setSenha}
                placeholder="••••••••"
                placeholderTextColor={Colors.textMuted}
                secureTextEntry={!showSenha}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="go"
                onSubmitEditing={handleLogin}
                testID="senha-input"
              />
              <Pressable onPress={() => setShowSenha(!showSenha)} hitSlop={8}>
                <Feather name={showSenha ? "eye-off" : "eye"} size={18} color={Colors.textMuted} />
              </Pressable>
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [styles.btn, { opacity: pressed ? 0.85 : 1 }]}
            onPress={handleLogin}
            disabled={loading}
            testID="login-btn"
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Entrar</Text>
            )}
          </Pressable>
        </View>

        <Text style={styles.footer}>
          Mendes Advocacia · Promarcos v2
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingHorizontal: 24, flexGrow: 1, justifyContent: "center" },
  logoArea: { alignItems: "center", marginBottom: 36 },
  logoBox: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  appName: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    marginBottom: 4,
  },
  appSub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 24,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 4,
  },
  cardTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    marginBottom: 4,
  },
  cardSub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    marginBottom: 24,
  },
  inputGroup: { marginBottom: 16 },
  label: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    height: 50,
  },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
  },
  btn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  btnText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  footer: {
    textAlign: "center",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    marginTop: 32,
  },
});
