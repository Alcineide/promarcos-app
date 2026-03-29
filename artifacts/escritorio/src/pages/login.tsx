import { useState } from "react";
import { LogIn, Eye, EyeOff, Lock, Mail, UserPlus, ArrowLeft, CheckCircle, Clock } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

type LoginStep = "login" | "register" | "pending" | "success";

export default function LoginPage() {
  const { login, requestAccess } = useAuth();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [nomeCompleto, setNomeCompleto] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<LoginStep>("login");
  const [successMessage, setSuccessMessage] = useState("");

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
      if (result.needsRegistration) {
        setStep("register");
        setError("");
      } else if (result.pending) {
        setStep("pending");
        setError("");
      } else {
        setError(result.message || "Credenciais inválidas");
      }
    }
  };

  const handleRequestAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeCompleto || nomeCompleto.trim().length < 3) {
      setError("Informe seu nome completo (mínimo 3 caracteres)");
      return;
    }
    setError("");
    setLoading(true);
    const result = await requestAccess(email, nomeCompleto);
    setLoading(false);
    if (result.success) {
      setSuccessMessage(result.message || "Solicitação enviada!");
      setStep("success");
    } else {
      setError(result.message || "Erro ao enviar solicitação");
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

          {step === "login" && (
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
          )}

          {step === "register" && (
            <form onSubmit={handleRequestAccess} className="space-y-5">
              <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-center">
                <UserPlus className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                <p className="text-sm font-semibold text-blue-800">Primeiro acesso detectado</p>
                <p className="text-xs text-blue-600 mt-1">
                  Informe seu nome completo para solicitar acesso ao sistema.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
                <p className="text-xs text-gray-500">Email</p>
                <p className="text-sm font-medium text-gray-800">{email}</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Nome Completo</label>
                <input
                  type="text"
                  value={nomeCompleto}
                  onChange={e => setNomeCompleto(e.target.value)}
                  placeholder="Seu nome completo"
                  autoFocus
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 border-2 border-gray-200 text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-[#2a5080] focus:ring-4 focus:ring-[#2a5080]/10 transition-all"
                />
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
                    <UserPlus className="w-4 h-4" />
                    SOLICITAR ACESSO
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => { setStep("login"); setError(""); }}
                className="w-full flex items-center justify-center gap-2 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar ao login
              </button>
            </form>
          )}

          {step === "pending" && (
            <div className="space-y-5 text-center">
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                <Clock className="w-10 h-10 text-amber-500 mx-auto mb-3" />
                <p className="text-sm font-semibold text-amber-800">Aguardando aprovação</p>
                <p className="text-xs text-amber-600 mt-2">
                  Sua solicitação de acesso foi enviada e está aguardando aprovação do administrador.
                </p>
              </div>

              <button
                type="button"
                onClick={() => { setStep("login"); setError(""); }}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-medium text-gray-600 border-2 border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar ao login
              </button>
            </div>
          )}

          {step === "success" && (
            <div className="space-y-5 text-center">
              <div className="p-4 rounded-xl bg-green-50 border border-green-200">
                <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-3" />
                <p className="text-sm font-semibold text-green-800">Solicitação enviada!</p>
                <p className="text-xs text-green-600 mt-2">
                  {successMessage}
                </p>
              </div>

              <button
                type="button"
                onClick={() => { setStep("login"); setError(""); setNomeCompleto(""); }}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-medium text-gray-600 border-2 border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar ao login
              </button>
            </div>
          )}

          <p className="text-center text-xs text-gray-400 mt-6">
            &copy; 2026 Promarcos &bull; Todos os direitos reservados
          </p>
        </div>
      </div>
    </div>
  );
}
