import { Platform } from "react-native";
import type * as ExpoLocation from "expo-location";
import { insertAuditRecord } from "./audit-db";

let locationModule: typeof ExpoLocation | null = null;

async function getLocation(): Promise<{ latitude: string; longitude: string } | null> {
  if (Platform.OS === "web") return null;

  try {
    if (!locationModule) {
      locationModule = await import("expo-location");
    }

    const { status } = await locationModule.getForegroundPermissionsAsync();
    if (status !== "granted") return null;

    const loc = await locationModule.getLastKnownPositionAsync();
    if (loc) {
      return {
        latitude: String(loc.coords.latitude),
        longitude: String(loc.coords.longitude),
      };
    }
    return null;
  } catch {
    return null;
  }
}

function getDeviceId(): string {
  return Platform.OS + "_" + Platform.Version;
}

interface AuditUser {
  email: string;
  codigo?: number;
}

export async function registrarConsulta(
  user: AuditUser,
  termoBuscado: string
): Promise<void> {
  try {
    const loc = await getLocation();
    await insertAuditRecord({
      colaborador_email: user.email,
      colaborador_codigo: user.codigo,
      tipo_acao: "consulta",
      termo_buscado: termoBuscado,
      latitude: loc?.latitude,
      longitude: loc?.longitude,
      data_hora: new Date().toISOString(),
      device_id: getDeviceId(),
    });
  } catch {
  }
}

export async function registrarPesquisaCpf(
  user: AuditUser,
  cpf: string,
  haviaCadastro: boolean
): Promise<void> {
  try {
    const loc = await getLocation();
    await insertAuditRecord({
      colaborador_email: user.email,
      colaborador_codigo: user.codigo,
      tipo_acao: "pesquisa_cpf",
      cpf_consultado: cpf,
      havia_cadastro: haviaCadastro ? "sim" : "nao",
      latitude: loc?.latitude,
      longitude: loc?.longitude,
      data_hora: new Date().toISOString(),
      device_id: getDeviceId(),
    });
  } catch {
  }
}

export async function registrarAlteracao(
  user: AuditUser,
  cpf: string | undefined,
  camposAlterados: Record<string, { antes: unknown; depois: unknown }>
): Promise<void> {
  try {
    const loc = await getLocation();
    await insertAuditRecord({
      colaborador_email: user.email,
      colaborador_codigo: user.codigo,
      tipo_acao: "alteracao",
      cpf_consultado: cpf,
      campos_alterados: JSON.stringify(camposAlterados),
      latitude: loc?.latitude,
      longitude: loc?.longitude,
      data_hora: new Date().toISOString(),
      device_id: getDeviceId(),
    });
  } catch {
  }
}

export async function registrarCadastro(
  user: AuditUser,
  cpf: string
): Promise<void> {
  try {
    const loc = await getLocation();
    await insertAuditRecord({
      colaborador_email: user.email,
      colaborador_codigo: user.codigo,
      tipo_acao: "cadastro_novo",
      cpf_consultado: cpf,
      latitude: loc?.latitude,
      longitude: loc?.longitude,
      data_hora: new Date().toISOString(),
      device_id: getDeviceId(),
    });
  } catch {
  }
}

export async function registrarUpload(
  user: AuditUser,
  clienteNome: string,
  categoria: string
): Promise<void> {
  try {
    const loc = await getLocation();
    await insertAuditRecord({
      colaborador_email: user.email,
      colaborador_codigo: user.codigo,
      tipo_acao: "upload_documento",
      termo_buscado: `${clienteNome} - ${categoria}`,
      latitude: loc?.latitude,
      longitude: loc?.longitude,
      data_hora: new Date().toISOString(),
      device_id: getDeviceId(),
    });
  } catch {
  }
}
