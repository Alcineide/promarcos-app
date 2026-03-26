import React, {
  createContext,
  useCallback,
  useContext,
  useState,
} from "react";

export interface PromarcoUser {
  codigo: number;
  nome: string;
  email: string;
  login?: string;
}

interface AuthContextValue {
  user: PromarcoUser | null;
  isLoading: boolean;
  login: (user: PromarcoUser) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PromarcoUser | null>(null);

  const login = useCallback(async (u: PromarcoUser) => {
    setUser(u);
  }, []);

  const logout = useCallback(async () => {
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading: false, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
