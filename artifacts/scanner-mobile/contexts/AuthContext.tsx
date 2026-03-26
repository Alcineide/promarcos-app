import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
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

const AUTH_KEY = "@mendes_auth_user";

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PromarcoUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(AUTH_KEY)
      .then((raw) => {
        if (raw) setUser(JSON.parse(raw) as PromarcoUser);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (u: PromarcoUser) => {
    setUser(u);
    await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(u));
  }, []);

  const logout = useCallback(async () => {
    setUser(null);
    await AsyncStorage.removeItem(AUTH_KEY);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
