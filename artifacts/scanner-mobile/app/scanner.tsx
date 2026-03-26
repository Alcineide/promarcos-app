import { Feather } from "@expo/vector-icons";
import { File, documentDirectory, makeDirectoryAsync, copyAsync, getInfoAsync } from "expo-file-system";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";
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

import { apiPost } from "@/config/api";
import Colors from "@/constants/colors";

type Step = "capture" | "review" | "sending" | "done";

interface ScannedPage {
  id: string;
  uri: string;
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

function makeId() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
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

  const [step, setStep] = useState<Step>("capture");
  const [pages, setPages] = useState<ScannedPage[]>([]);
  const [pdfUri, setPdfUri] = useState<string | null>(null);
  const [pdfFileName, setPdfFileName] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [localSaved, setLocalSaved] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  async function handleScanDocument() {
    const { status: camStatus } = await ImagePicker.requestCameraPermissionsAsync();
    if (camStatus !== "granted") {
      Alert.alert(
        "Permissão de câmera necessária",
        "Permita o acesso à câmera para escanear documentos. Vá em Configurações > Câmera e ative o acesso."
      );
      return;
    }

    if (Platform.OS === "web") {
      // On web: use browser camera directly
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 0.9,
        allowsEditing: false,
      });
      if (!result.canceled && result.assets.length > 0) {
        const newPages: ScannedPage[] = result.assets.map((a) => ({
          id: makeId(),
          uri: a.uri,
        }));
        setPages((prev) => [...prev, ...newPages]);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      return;
    }

    // On native: use document scanner with edge detection
    try {
      const DocumentScanner = (await import("react-native-document-scanner-plugin")).default;
      const { scannedImages } = await DocumentScanner.scanDocument({
        croppedImageQuality: 85,
      });
      if (scannedImages && scannedImages.length > 0) {
        const newPages: ScannedPage[] = scannedImages.map((uri) => ({
          id: makeId(),
          uri,
        }));
        setPages((prev) => [...prev, ...newPages]);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (
        !msg.toLowerCase().includes("cancel") &&
        !msg.toLowerCase().includes("user cancel")
      ) {
        Alert.alert("Erro no scanner", msg);
      }
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

  async function handleGeneratePdf() {
    if (pages.length === 0) return;

    setStep("sending");
    setUploading(false);

    try {
      const base64Images = await Promise.all(
        pages.map(async (page) => {
          const file = new File(page.uri);
          const b64 = await file.base64();
          const ext = page.uri.split(".").pop()?.toLowerCase() ?? "jpg";
          const mime = ext === "png" ? "image/png" : "image/jpeg";
          return { b64, mime };
        })
      );

      const pageHtmlItems = base64Images.map(
        ({ b64, mime }) =>
          `<div style="page-break-after: always; width:100%; height:100vh; display:flex; align-items:center; justify-content:center; margin:0; padding:0;">
            <img src="data:${mime};base64,${b64}" style="max-width:100%; max-height:100vh; object-fit:contain;" />
          </div>`
      );

      const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:#fff; }
</style>
</head>
<body>${pageHtmlItems.join("\n")}</body>
</html>`;

      const { uri } = await Print.printToFileAsync({ html });

      const nomeCliente = (clienteNome ?? "cliente").toUpperCase().replace(/\s+/g, "_");
      const ts = Date.now();
      const fileName = `${nomeCliente}_${tipoPromarcos.replace(/\s+/g, "_")}_${ts}.pdf`;

      setPdfUri(uri);
      setPdfFileName(fileName);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao gerar PDF";
      Alert.alert("Erro", msg);
      setStep("review");
    }
  }

  async function saveToDeviceStorage(): Promise<boolean> {
    if (!pdfUri || Platform.OS === "web") return false;
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
      if (!info.exists) {
        await copyAsync({ from: pdfUri, to: dest });
      }
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
          // MediaLibrary may not support PDFs on all Android versions — ignore silently
        }
      }
      return true;
    } catch {
      return false;
    }
  }

  async function handleSendPdf() {
    if (!pdfUri) return;

    setUploading(true);
    try {
      const pdfFile = new File(pdfUri);
      const pdfBase64 = await pdfFile.base64();

      const pessoaCodigo = parseInt(clienteId, 10);

      await apiPost("/promarcos/arquivo", {
        pessoaCodigo,
        fileName: pdfFileName,
        fileBase64: pdfBase64,
        tipo: tipoPromarcos,
        nome: `${tipoPromarcos} - ${clienteNome}`,
        mimeType: "application/pdf",
      });

      const saved = await saveToDeviceStorage();
      setLocalSaved(saved);

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep("done");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao enviar";
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Erro ao enviar", msg);
    } finally {
      setUploading(false);
    }
  }

  function handleReset() {
    setPages([]);
    setPdfUri(null);
    setPdfFileName("");
    setStep("capture");
  }

  if (step === "done") {
    return (
      <View style={[styles.container, { paddingTop: topPad, paddingBottom: bottomPad }]}>
        <View style={styles.centeredContent}>
          <View style={styles.successIconBox}>
            <Feather name="check-circle" size={72} color={Colors.success} />
          </View>
          <Text style={styles.doneTitle}>Enviado com sucesso!</Text>
          <Text style={styles.doneSub}>
            O arquivo <Text style={styles.doneFileName}>"{pdfFileName}"</Text> foi salvo:
          </Text>
          <View style={styles.doneChecklist}>
            <View style={styles.doneCheckRow}>
              <Feather name="check-circle" size={18} color={Colors.success} />
              <Text style={styles.doneCheckText}>Pasta do cliente no Promarcos ({tipoPromarcos})</Text>
            </View>
            {localSaved && (
              <View style={styles.doneCheckRow}>
                <Feather name="check-circle" size={18} color={Colors.success} />
                <Text style={styles.doneCheckText}>Memória interna · MendesAdvocacia/{clienteNome.substring(0, 25)}</Text>
              </View>
            )}
          </View>
          <Text style={styles.doneClient}>{clienteNome}</Text>

          <Pressable
            style={[styles.btn, styles.btnPrimary, { marginTop: 32 }]}
            onPress={handleReset}
          >
            <Feather name="file-plus" size={18} color="#fff" />
            <Text style={styles.btnText}>Escanear mais documentos</Text>
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

  if (step === "sending") {
    return (
      <View style={[styles.container, { paddingTop: topPad }]}>
        <View style={styles.header}>
          <Pressable
            onPress={() => { if (!uploading) setStep("review"); }}
            style={styles.backBtn}
            hitSlop={12}
            disabled={uploading}
          >
            <Feather name="arrow-left" size={22} color={Colors.text} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerCategory}>{tipoPromarcos}</Text>
            <Text style={styles.headerClient} numberOfLines={1}>{clienteNome}</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad + 120 }]}
        >
          <View style={styles.sectionHeader}>
            <Feather name="file-text" size={18} color={Colors.primary} />
            <Text style={styles.sectionTitle}>PDF Gerado</Text>
          </View>

          <View style={styles.pdfPreviewCard}>
            <View style={styles.pdfIconBox}>
              <Feather name="file-text" size={48} color={Colors.primary} />
            </View>
            <Text style={styles.pdfFileName} numberOfLines={2}>{pdfFileName}</Text>
            <Text style={styles.pdfMeta}>
              {pages.length} página{pages.length !== 1 ? "s" : ""} · application/pdf
            </Text>
          </View>

          <View style={styles.sectionHeader}>
            <Feather name="image" size={18} color={Colors.textSecondary} />
            <Text style={[styles.sectionTitle, { color: Colors.textSecondary }]}>
              Páginas incluídas
            </Text>
          </View>

          <View style={styles.thumbRow}>
            {pages.map((page, idx) => (
              <View key={page.id} style={styles.thumbItem}>
                <Image source={{ uri: page.uri }} style={styles.thumbImg} />
                <Text style={styles.thumbLabel}>{idx + 1}</Text>
              </View>
            ))}
          </View>
        </ScrollView>

        <View style={[styles.bottomBar, { paddingBottom: bottomPad + 12 }]}>
          <Pressable
            style={[styles.btn, styles.btnOutline, { flex: 1 }]}
            onPress={() => setStep("review")}
            disabled={uploading}
          >
            <Feather name="edit-2" size={18} color={Colors.primary} />
            <Text style={[styles.btnText, { color: Colors.primary }]}>Revisar</Text>
          </Pressable>

          <Pressable
            style={[styles.btn, styles.btnPrimary, { flex: 2 }]}
            onPress={handleSendPdf}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Feather name="upload-cloud" size={18} color="#fff" />
            )}
            <Text style={styles.btnText}>
              {uploading ? "Enviando..." : "Enviar para Promarcos"}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (step === "review") {
    return (
      <View style={[styles.container, { paddingTop: topPad }]}>
        <View style={styles.header}>
          <Pressable onPress={() => setStep("capture")} style={styles.backBtn} hitSlop={12}>
            <Feather name="arrow-left" size={22} color={Colors.text} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerCategory}>{tipoPromarcos}</Text>
            <Text style={styles.headerClient} numberOfLines={1}>{clienteNome}</Text>
          </View>
          <View style={styles.pageCountBadge}>
            <Text style={styles.pageCountText}>{pages.length}p</Text>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad + 140 }]}
        >
          <Text style={styles.reviewHint}>
            Revise as páginas abaixo. Toque no X para remover.
          </Text>

          {pages.map((page, idx) => (
            <View key={page.id} style={styles.reviewPage}>
              <View style={styles.reviewPageNum}>
                <Text style={styles.reviewPageNumText}>{idx + 1}</Text>
              </View>
              <Image source={{ uri: page.uri }} style={styles.reviewPageImg} resizeMode="contain" />
              <Pressable
                style={styles.reviewRemoveBtn}
                onPress={() => handleRemovePage(page.id)}
              >
                <Feather name="x" size={16} color="#fff" />
              </Pressable>
            </View>
          ))}

          {pages.length === 0 && (
            <View style={styles.emptyReview}>
              <Feather name="alert-circle" size={36} color={Colors.textMuted} />
              <Text style={styles.emptyReviewText}>
                Nenhuma página. Volte e adicione documentos.
              </Text>
            </View>
          )}
        </ScrollView>

        <View style={[styles.bottomBar, { paddingBottom: bottomPad + 12 }]}>
          <Pressable
            style={[styles.btn, styles.btnOutline, { flex: 1 }]}
            onPress={() => setStep("capture")}
          >
            <Feather name="plus" size={18} color={Colors.primary} />
            <Text style={[styles.btnText, { color: Colors.primary }]}>Adicionar</Text>
          </Pressable>

          <Pressable
            style={[
              styles.btn,
              pages.length > 0 ? styles.btnPrimary : styles.btnDisabled,
              { flex: 2 },
            ]}
            onPress={handleGeneratePdf}
            disabled={pages.length === 0}
          >
            <Feather name="file-text" size={18} color="#fff" />
            <Text style={styles.btnText}>Gerar PDF</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Feather name="x" size={22} color={Colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerCategory}>{tipoPromarcos}</Text>
          <Text style={styles.headerClient} numberOfLines={1}>{clienteNome}</Text>
        </View>
        {pages.length > 0 ? (
          <Pressable
            style={styles.reviewHeaderBtn}
            onPress={() => setStep("review")}
          >
            <Text style={styles.reviewHeaderBtnText}>Revisar ({pages.length})</Text>
          </Pressable>
        ) : (
          <View style={{ width: 60 }} />
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad + 130 }]}
      >
        {pages.length === 0 ? (
          <View style={styles.emptyCamera}>
            <View style={styles.cameraIconBox}>
              <Feather name="camera" size={48} color={Colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>Nenhuma página ainda</Text>
            <Text style={styles.emptyText}>
              Use o scanner para detectar automaticamente as bordas do documento, ou selecione da galeria.
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.captureHint}>
              Toque em + Scanner para adicionar mais páginas
            </Text>
            <View style={styles.thumbGrid}>
              {pages.map((page, idx) => (
                <View key={page.id} style={styles.thumbGridItem}>
                  <Image source={{ uri: page.uri }} style={styles.thumbGridImg} />
                  <View style={styles.thumbGridBadge}>
                    <Text style={styles.thumbGridBadgeText}>{idx + 1}</Text>
                  </View>
                  <Pressable
                    style={styles.thumbGridRemove}
                    onPress={() => handleRemovePage(page.id)}
                  >
                    <Feather name="x" size={12} color="#fff" />
                  </Pressable>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: bottomPad + 12 }]}>
        <Pressable
          style={[styles.actionIconBtn]}
          onPress={handlePickFromGallery}
          testID="gallery-btn"
        >
          <Feather name="image" size={22} color={Colors.primary} />
          <Text style={styles.actionIconLabel}>Galeria</Text>
        </Pressable>

        <Pressable
          style={[styles.scanBtn]}
          onPress={handleScanDocument}
          testID="scan-btn"
        >
          <Feather name="camera" size={28} color="#fff" />
          <Text style={styles.scanBtnLabel}>+ Scanner</Text>
        </Pressable>

        <Pressable
          style={[
            styles.actionIconBtn,
            pages.length === 0 && styles.actionIconBtnDisabled,
          ]}
          onPress={() => pages.length > 0 && setStep("review")}
          testID="review-btn"
        >
          <Feather name="check-square" size={22} color={pages.length > 0 ? Colors.accent : Colors.textMuted} />
          <Text style={[styles.actionIconLabel, pages.length === 0 && { color: Colors.textMuted }]}>
            Revisar
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
    paddingBottom: 14,
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
  reviewHeaderBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.accentLight,
  },
  reviewHeaderBtnText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.accent,
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

  captureHint: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
    marginBottom: 16,
  },

  thumbGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  thumbGridItem: {
    width: "30%",
    aspectRatio: 0.75,
    borderRadius: 10,
    overflow: "hidden",
    position: "relative",
    backgroundColor: Colors.border,
  },
  thumbGridImg: {
    width: "100%",
    height: "100%",
  },
  thumbGridBadge: {
    position: "absolute",
    bottom: 6,
    left: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  thumbGridBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  thumbGridRemove: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.55)",
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
    justifyContent: "center",
    gap: 16,
    paddingTop: 14,
    paddingHorizontal: 24,
    backgroundColor: Colors.card,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  actionIconBtn: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    padding: 8,
    borderRadius: 12,
    minWidth: 64,
  },
  actionIconBtnDisabled: {
    opacity: 0.4,
  },
  actionIconLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: Colors.primary,
  },
  scanBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 56,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
  },
  scanBtnLabel: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },

  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 50,
    borderRadius: 14,
    paddingHorizontal: 16,
  },
  btnPrimary: {
    backgroundColor: Colors.primary,
  },
  btnOutline: {
    borderWidth: 1.5,
    borderColor: Colors.primary,
    backgroundColor: "transparent",
  },
  btnDisabled: {
    backgroundColor: Colors.border,
  },
  btnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },

  reviewHint: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
    marginBottom: 16,
  },
  reviewPage: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 14,
    position: "relative",
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  reviewPageNum: {
    position: "absolute",
    top: 10,
    left: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  reviewPageNumText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  reviewPageImg: {
    width: "100%",
    height: 280,
    backgroundColor: Colors.background,
  },
  reviewRemoveBtn: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(239,68,68,0.85)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  emptyReview: {
    alignItems: "center",
    paddingTop: 60,
    gap: 12,
  },
  emptyReviewText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    textAlign: "center",
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },

  pdfPreviewCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    marginBottom: 24,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 3,
  },
  pdfIconBox: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: Colors.accentLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  pdfFileName: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
    textAlign: "center",
    marginBottom: 6,
  },
  pdfMeta: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },

  thumbRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  thumbItem: {
    position: "relative",
  },
  thumbImg: {
    width: 70,
    height: 90,
    borderRadius: 8,
    backgroundColor: Colors.border,
  },
  thumbLabel: {
    position: "absolute",
    bottom: 4,
    right: 4,
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },

  centeredContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  successIconBox: {
    width: 120,
    height: 120,
    borderRadius: 30,
    backgroundColor: "#ECFDF5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  doneTitle: {
    fontSize: 24,
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
  doneFileName: {
    fontFamily: "Inter_600SemiBold",
    color: Colors.primary,
  },
  doneClient: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.accent,
    marginTop: 8,
  },
  doneChecklist: {
    alignSelf: "stretch",
    gap: 10,
    marginVertical: 12,
    paddingHorizontal: 8,
  },
  doneCheckRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#ECFDF5",
    borderRadius: 10,
    padding: 10,
  },
  doneCheckText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
    lineHeight: 18,
  },
});
