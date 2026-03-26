import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
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

  return (
    <LinearGradient
      colors={["#1d4ed8", "#1e40af", "#1e3a8a"]}
      style={styles.gradient}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: (Platform.OS === "web" ? 67 : insets.top) + 40, paddingBottom: insets.bottom + 32 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            {/* Logo */}
            <View style={styles.logoRow}>
              <Image
                source={require("../assets/images/icon.png")}
                style={styles.logoImg}
                resizeMode="contain"
              />
            </View>

            {/* Title */}
            <Text style={styles.title}>PROMARCOS</Text>
            <Text style={styles.titleSub}>CLIENTES</Text>
            <Text style={styles.subtitle}>Sistema de Gestão Jurídica</Text>

            {/* Email */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>E-mail <Text style={styles.required}>*</Text></Text>
              <View style={styles.inputRow}>
                <Feather name="mail" size={17} color="#6b7280" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="seu@email.com"
                  placeholderTextColor="#9ca3af"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  onSubmitEditing={() => senhaRef.current?.focus()}
                  testID="email-input"
                />
              </View>
            </View>

            {/* Senha */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Senha <Text style={styles.required}>*</Text></Text>
              <View style={styles.inputRow}>
                <Feather name="lock" size={17} color="#6b7280" style={styles.inputIcon} />
                <TextInput
                  ref={senhaRef}
                  style={styles.input}
                  value={senha}
                  onChangeText={setSenha}
                  placeholder="••••••••"
                  placeholderTextColor="#9ca3af"
                  secureTextEntry={!showSenha}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="go"
                  onSubmitEditing={handleLogin}
                  testID="senha-input"
                />
                <Pressable onPress={() => setShowSenha(!showSenha)} hitSlop={10}>
                  <Feather name={showSenha ? "eye-off" : "eye"} size={18} color="#6b7280" />
                </Pressable>
              </View>
            </View>

            {/* Botão */}
            <Pressable
              style={({ pressed }) => [styles.btn, { opacity: pressed ? 0.85 : 1 }]}
              onPress={handleLogin}
              disabled={loading}
              testID="login-btn"
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <View style={styles.btnInner}>
                  <Feather name="log-in" size={18} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.btnText}>ENTRAR</Text>
                </View>
              )}
            </Pressable>

            {/* Footer */}
            <Text style={styles.footer}>
              © 2026 Promarcos • Todos os direitos reservados
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },

  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    paddingHorizontal: 32,
    paddingTop: 36,
    paddingBottom: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },

  logoRow: {
    alignItems: "center",
    marginBottom: 16,
  },
  logoImg: {
    width: 140,
    height: 140,
    borderRadius: 28,
  },

  title: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: "#1e3a8a",
    textAlign: "center",
    letterSpacing: 4,
    marginBottom: 2,
  },
  titleSub: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#3b82f6",
    textAlign: "center",
    letterSpacing: 8,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 24,
  },

  fieldGroup: { marginBottom: 16 },
  label: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#374151",
    marginBottom: 6,
  },
  required: { color: "#ef4444" },

  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 48,
    backgroundColor: "#fff",
  },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "#111827",
  },

  btn: {
    backgroundColor: "#2563eb",
    borderRadius: 8,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    shadowColor: "#1d4ed8",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  btnInner: { flexDirection: "row", alignItems: "center" },
  btnText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.5,
  },

  footer: {
    textAlign: "center",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#9ca3af",
    marginTop: 24,
  },
});
