import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

interface User {
  id: number;
  nome: string;
  email: string;
  role: "admin" | "user";
  isSuperAdmin: boolean;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  login: (email: string, senha: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  refreshRole: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const SESSION_KEY = "promarcos_session";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRole = async (email: string): Promise<{ role: "admin" | "user"; isSuperAdmin: boolean }> => {
    try {
      const res = await fetch("/api/usuarios/me", {
        headers: { "x-user-email": email },
      });
      if (res.ok) {
        const data = await res.json();
        return {
          role: data.role === "admin" ? "admin" : "user",
          isSuperAdmin: !!data.isSuperAdmin,
        };
      }
    } catch {}
    return { role: "user", isSuperAdmin: false };
  };

  useEffect(() => {
    const restore = async () => {
      const stored = sessionStorage.getItem(SESSION_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as User;
          const roleInfo = await fetchRole(parsed.email);
          const fullUser = { ...parsed, ...roleInfo };
          setUser(fullUser);
          sessionStorage.setItem(SESSION_KEY, JSON.stringify(fullUser));
        } catch {
          sessionStorage.removeItem(SESSION_KEY);
        }
      }
      setIsLoading(false);
    };
    restore();
  }, []);

  const login = async (email: string, senha: string): Promise<{ success: boolean; message?: string }> => {
    try {
      const res = await fetch("/api/promarcos/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, senha }),
      });
      const data = await res.json() as Record<string, unknown>;
      if (!res.ok || data?.error) {
        return { success: false, message: (data?.mensagem as string) || (data?.message as string) || "Credenciais inválidas" };
      }
      if (data?.mensagem && !data?.id && !data?.codigo && !data?.token) {
        return { success: false, message: data.mensagem as string };
      }

      const roleInfo = await fetchRole(email);

      const userData: User = {
        id: (data?.id as number) || (data?.codigo as number) || 0,
        nome: (data?.nome as string) || (data?.razao_social as string) || email,
        email,
        ...roleInfo,
      };
      setUser(userData);
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(userData));
      return { success: true };
    } catch {
      return { success: false, message: "Erro ao conectar com o servidor" };
    }
  };

  const logout = () => {
    setUser(null);
    sessionStorage.removeItem(SESSION_KEY);
  };

  const refreshRole = async () => {
    if (!user) return;
    const roleInfo = await fetchRole(user.email);
    const updated = { ...user, ...roleInfo };
    setUser(updated);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(updated));
  };

  const isAdmin = user?.role === "admin";
  const isSuperAdmin = !!user?.isSuperAdmin;

  return (
    <AuthContext.Provider value={{ user, isLoading, isAdmin, isSuperAdmin, login, logout, refreshRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
