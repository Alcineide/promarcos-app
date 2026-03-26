import { Feather } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";
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

import { apiPost } from "@/config/api";
import Colors from "@/constants/colors";

interface ScannedPhoto {
  id: string;
  uri: string;
  uploaded: boolean;
  error?: string;
}

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

  const [photos, setPhotos] = useState<ScannedPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [done, setDone] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  async function handleTakePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permissão necessária",
        "Permita o acesso à câmera nas configurações do dispositivo."
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.85,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      const newPhoto: ScannedPhoto = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        uri: asset.uri,
        uploaded: false,
      };
      setPhotos((prev) => [...prev, newPhoto]);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }

  async function handlePickFromGallery() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permissão necessária",
        "Permita o acesso à galeria nas configurações."
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
      allowsMultipleSelection: true,
      selectionLimit: 10,
    });

    if (!result.canceled && result.assets.length > 0) {
      const newPhotos: ScannedPhoto[] = result.assets.map((a) => ({
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        uri: a.uri,
        uploaded: false,
      }));
      setPhotos((prev) => [...prev, ...newPhotos]);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }

  function handleRemovePhoto(id: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  }

  async function handleUpload() {
    if (photos.length === 0) {
      Alert.alert("Sem fotos", "Tire pelo menos uma foto para enviar.");
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    let successCount = 0;
    let failCount = 0;

    const pessoaCodigo = parseInt(clienteId, 10);
    const nomeCliente = (clienteNome ?? "cliente").toUpperCase().replace(/\s+/g, "_");

    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      try {
        const base64 = await FileSystem.readAsStringAsync(photo.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const ext = photo.uri.split(".").pop() ?? "jpg";
        const ts = Date.now();
        const fileName = `${nomeCliente}_${tipoPromarcos.replace(/\s+/g, "_")}_${ts}_${i + 1}.${ext}`;
        const mimeType = ext.toLowerCase() === "png" ? "image/png" : "image/jpeg";

        await apiPost("/promarcos/arquivo", {
          pessoaCodigo,
          fileName,
          fileBase64: base64,
          tipo: tipoPromarcos,
          nome: `${tipoPromarcos} - ${clienteNome}`,
          mimeType,
        });

        if (Platform.OS !== "web") {
          try {
            const { status } = await MediaLibrary.requestPermissionsAsync();
            if (status === "granted") {
              const asset = await MediaLibrary.createAssetAsync(photo.uri);
              const albumName = `Mendes - ${clienteNome}`;
              let album = await MediaLibrary.getAlbumAsync(albumName);
              if (!album) {
                album = await MediaLibrary.createAlbumAsync(albumName, asset, false);
              } else {
                await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
              }
            }
          } catch {
          }
        }

        setPhotos((prev) =>
          prev.map((p) => (p.id === photo.id ? { ...p, uploaded: true } : p))
        );
        successCount++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro";
        setPhotos((prev) =>
          prev.map((p) => (p.id === photo.id ? { ...p, error: msg } : p))
        );
        failCount++;
      }

      setUploadProgress(((i + 1) / photos.length) * 100);
    }

    setUploading(false);

    if (failCount === 0) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setDone(true);
    } else {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        "Resultado",
        `${successCount} enviado(s) com sucesso. ${failCount} falhou.`
      );
    }
  }

  const pendingCount = photos.filter((p) => !p.uploaded && !p.error).length;

  if (done) {
    return (
      <View style={[styles.container, { paddingTop: topPad, paddingBottom: bottomPad }]}>
        <View style={styles.doneContainer}>
          <View style={styles.doneIconBox}>
            <Feather name="check-circle" size={64} color={Colors.success} />
          </View>
          <Text style={styles.doneTitle}>Enviado com sucesso!</Text>
          <Text style={styles.doneSub}>
            {photos.length} documento(s) de "{tipoPromarcos}" enviados para o Promarcos
            {Platform.OS !== "web" ? " e salvos na galeria do celular" : ""}
          </Text>
          <Text style={styles.doneClient}>{clienteNome}</Text>

          <Pressable
            style={[styles.btn, styles.btnPrimary, { marginTop: 32 }]}
            onPress={() => {
              setPhotos([]);
              setDone(false);
            }}
          >
            <Feather name="camera" size={18} color="#fff" />
            <Text style={styles.btnText}>Escanear mais</Text>
          </Pressable>

          <Pressable
            style={[styles.btn, styles.btnOutline, { marginTop: 12 }]}
            onPress={() => router.back()}
          >
            <Text style={[styles.btnText, { color: Colors.primary }]}>Voltar ao cliente</Text>
          </Pressable>
        </View>
      </View>
    );
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
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad + 100 }]}
      >
        {photos.length === 0 ? (
          <View style={styles.emptyCamera}>
            <View style={styles.cameraIconBox}>
              <Feather name="camera" size={48} color={Colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>Nenhuma foto ainda</Text>
            <Text style={styles.emptyText}>
              Tire fotos dos documentos do cliente. Você pode adicionar quantas fotos quiser.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.photosGrid}>
              {photos.map((photo) => (
                <View key={photo.id} style={styles.photoItem}>
                  <Image source={{ uri: photo.uri }} style={styles.photoThumb} />
                  {photo.uploaded && (
                    <View style={styles.photoOverlaySuccess}>
                      <Feather name="check" size={20} color="#fff" />
                    </View>
                  )}
                  {photo.error && (
                    <View style={styles.photoOverlayError}>
                      <Feather name="alert-circle" size={20} color="#fff" />
                    </View>
                  )}
                  {!photo.uploaded && !photo.error && !uploading && (
                    <Pressable
                      style={styles.removeBtn}
                      onPress={() => handleRemovePhoto(photo.id)}
                    >
                      <Feather name="x" size={14} color="#fff" />
                    </Pressable>
                  )}
                </View>
              ))}
            </View>

            {uploading && (
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${uploadProgress}%` as any },
                  ]}
                />
              </View>
            )}

            {uploading && (
              <Text style={styles.progressText}>
                Enviando... {Math.round(uploadProgress)}%
              </Text>
            )}
          </>
        )}
      </ScrollView>

      {/* Bottom actions */}
      <View style={[styles.actions, { paddingBottom: bottomPad + 12 }]}>
        <Pressable
          style={[styles.actionBtn, styles.actionBtnOutline]}
          onPress={handlePickFromGallery}
          disabled={uploading}
        >
          <Feather name="image" size={20} color={Colors.primary} />
        </Pressable>

        <Pressable
          style={[styles.actionBtn, styles.actionBtnCamera]}
          onPress={handleTakePhoto}
          disabled={uploading}
          testID="camera-btn"
        >
          <Feather name="camera" size={28} color="#fff" />
        </Pressable>

        <Pressable
          style={[
            styles.actionBtn,
            photos.length > 0 && pendingCount > 0 ? styles.actionBtnSend : styles.actionBtnDisabled,
          ]}
          onPress={handleUpload}
          disabled={uploading || photos.length === 0 || pendingCount === 0}
          testID="upload-btn"
        >
          {uploading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Feather name="upload-cloud" size={20} color="#fff" />
          )}
        </Pressable>
      </View>

      {photos.length > 0 && (
        <View style={[styles.photoCount, { bottom: bottomPad + 88 }]}>
          <Text style={styles.photoCountText}>
            {photos.length} foto{photos.length !== 1 ? "s" : ""}
            {pendingCount > 0 && ` · ${pendingCount} para enviar`}
          </Text>
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
    paddingBottom: 16,
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
  scrollContent: { padding: 16, flexGrow: 1 },
  emptyCamera: {
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 32,
  },
  cameraIconBox: {
    width: 100,
    height: 100,
    borderRadius: 24,
    backgroundColor: Colors.accentLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
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
  photosGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  photoItem: {
    width: "31%",
    aspectRatio: 1,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
  },
  photoThumb: {
    width: "100%",
    height: "100%",
  },
  photoOverlaySuccess: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(16, 185, 129, 0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  photoOverlayError: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(239, 68, 68, 0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  removeBtn: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  progressBar: {
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: 3,
    overflow: "hidden",
    marginTop: 20,
    marginHorizontal: 4,
  },
  progressFill: {
    height: "100%",
    backgroundColor: Colors.success,
    borderRadius: 3,
  },
  progressText: {
    textAlign: "center",
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
    marginTop: 8,
  },
  actions: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingTop: 12,
    paddingHorizontal: 32,
    backgroundColor: Colors.card,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  actionBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },
  actionBtnOutline: {
    backgroundColor: Colors.card,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  actionBtnCamera: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primary,
  },
  actionBtnSend: {
    backgroundColor: Colors.accent,
  },
  actionBtnDisabled: {
    backgroundColor: Colors.border,
  },
  photoCount: {
    position: "absolute",
    alignSelf: "center",
    backgroundColor: Colors.text,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  photoCountText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  doneContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  doneIconBox: {
    width: 120,
    height: 120,
    borderRadius: 30,
    backgroundColor: "#ECFDF5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  doneTitle: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    marginBottom: 12,
    textAlign: "center",
  },
  doneSub: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 8,
  },
  doneClient: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.primary,
    textAlign: "center",
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    height: 52,
    paddingHorizontal: 28,
    gap: 8,
    width: "100%",
  },
  btnPrimary: {
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  btnOutline: {
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: Colors.border,
  },
  btnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
});
