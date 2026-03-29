import { useState } from "react";
import { LogIn, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !senha) {
      setError("Preencha todos os campos");
      return;
    }
    setError("");
    setLoading(true);
    const result = await login(email, senha);
    setLoading(false);
    if (!result.success) {
      setError(result.message || "Credenciais inválidas");
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{
        background: "linear-gradient(135deg, #1a2e45 0%, #1c3654 30%, #2a5080 60%, #4a7aab 100%)",
      }}
    >
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl p-8 md:p-10">
          <div className="flex flex-col items-center mb-8">
            <img
              src="/logo-promarcos.png"
              alt="Mendes Advocacia"
              className="w-24 h-24 rounded-2xl object-cover mb-4 shadow-lg"
            />
            <h1 className="text-2xl font-bold text-[#1c3654] tracking-tight">Promarcos</h1>
            <p className="text-[10px] font-medium text-[#6ba3d6] tracking-[0.2em] uppercase mt-1">Clientes</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  autoComplete="email"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-gray-50 border-2 border-gray-200 text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-[#2a5080] focus:ring-4 focus:ring-[#2a5080]/10 transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={senha}
                  onChange={e => setSenha(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full pl-10 pr-12 py-3 rounded-xl bg-gray-50 border-2 border-gray-200 text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-[#2a5080] focus:ring-4 focus:ring-[#2a5080]/10 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-medium text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-white bg-gradient-to-r from-[#1c3654] to-[#2a5080] shadow-lg shadow-[#1c3654]/20 hover:shadow-xl hover:shadow-[#1c3654]/30 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  ENTRAR
                </>
              )}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-6">
            &copy; 2026 Promarcos &bull; Todos os direitos reservados
          </p>
        </div>
      </div>
    </div>
  );
}
