import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

interface User {
  id: number;
  nome: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, senha: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const SESSION_KEY = "promarcos_session";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        localStorage.removeItem(SESSION_KEY);
      }
    }
    setIsLoading(false);
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
      const userData: User = {
        id: (data?.id as number) || (data?.codigo as number) || 0,
        nome: (data?.nome as string) || (data?.razao_social as string) || email,
        email,
      };
      setUser(userData);
      localStorage.setItem(SESSION_KEY, JSON.stringify(userData));
      return { success: true };
    } catch {
      return { success: false, message: "Erro ao conectar com o servidor" };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(SESSION_KEY);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
