"use client";

import { signIn, useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type AlertType = "error" | "warning" | "info";
interface AlertMessage {
  type: AlertType;
  title: string;
  body: string;
}

function getAuthAlert(error: string | undefined | null, username: string): AlertMessage {
  switch (error) {
    case "CredentialsSignin": return { type: "error", title: "Credenciales incorrectas", body: "El usuario o la contraseña no son válidos. Verifica e intenta de nuevo." };
    case "SessionRequired": return { type: "warning", title: "Sesión requerida", body: "Debes iniciar sesión para acceder a esta sección." };
    case "AccessDenied": return { type: "warning", title: "Acceso denegado", body: "Tu cuenta se autenticó correctamente, pero no coincide con los usuarios o dominios autorizados. Contacta a un administrador." };
    case "OAuthAccountNotLinked": return { type: "warning", title: "Cuenta no vinculada", body: "Ya existe una cuenta con ese correo con otro método de inicio." };
  }

  if (!username.trim()) return { type: "warning", title: "Campo requerido", body: "Por favor ingresa tu nombre de usuario antes de continuar." };
  return { type: "error", title: "Error de autenticación", body: "No se pudo completar el inicio de sesión. Intenta de nuevo." };
}

function Alert({ alert, onClose }: { alert: AlertMessage; onClose: () => void }) {
  const styles = {
    error: { accent: "#f87171", bg: "rgba(248,113,113,0.08)", icon: "M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
    warning: { accent: "#fbbf24", bg: "rgba(251,191,36,0.08)", icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" },
    info: { accent: "#60a5fa", bg: "rgba(96,165,250,0.08)", icon: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  };
  const { accent, bg, icon } = styles[alert.type];
  return (
    <div style={{ background: bg, borderColor: accent }} className="w-full border rounded-xl p-3.5 animate-[alertIn_0.2s_ease]">
      <div className="flex items-start gap-2.5">
        <svg className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: accent }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} /></svg>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold mb-0.5" style={{ color: accent }}>{alert.title}</p>
          <p className="text-xs text-white/60 leading-relaxed">{alert.body}</p>
        </div>
        <button onClick={onClose} className="text-white/30 hover:text-white/70 transition-colors flex-shrink-0 mt-0.5">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
    </div>
  );
}

type Mode = "office365" | "local";

const FEATURES = [
  { icon: "M3 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 003 15z", label: "AWS & Huawei Cloud", desc: "Inventario multicloud unificado" },
  { icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z", label: "Seguridad empresarial", desc: "AES-256-GCM + Azure AD SSO" },
  { icon: "M3 13.125C3 12.504 3.504 12 4.125 12h2.25C6.996 12 7.5 12.504 7.5 13.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25C3.504 21 3 20.496 3 19.875v-6.75zM9.75 13.125c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v6.75C14.25 20.496 13.746 21 13.125 21h-2.25c-.621 0-1.125-.504-1.125-1.125v-6.75zM16.5 13.125c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v6.75c0 .621-.504 1.125-1.125 1.125h-2.25c-.621 0-1.125-.504-1.125-1.125v-6.75z", label: "Monitoreo en tiempo real", desc: "CloudWatch, LTS, métricas" },
];

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("office365");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [alert, setAlert] = useState<AlertMessage | null>(null);

  const { status } = useSession();
  const router = useRouter();

  useEffect(() => { if (status === "authenticated") router.push("/"); }, [status, router]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    if (!error) return;

    window.history.replaceState({}, "", "/login");
    const timer = window.setTimeout(() => {
      setAlert(getAuthAlert(error, ""));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => { if (!alert) return; const t = setTimeout(() => setAlert(null), 6000); return () => clearTimeout(t); }, [alert]);

  const handleLocalSignIn = async () => {
    if (isLoading) return;
    if (!username.trim()) { setAlert(getAuthAlert(null, "")); return; }
    if (!password) { setAlert({ type: "warning", title: "Contraseña requerida", body: "Ingresa tu contraseña." }); return; }
    setIsLoading(true); setAlert(null);
    // Safety: si signIn no responde, liberar el spinner y mostrar ayuda (evita "se queda cargando").
    const safety = setTimeout(() => {
      setIsLoading(false);
      setAlert({ type: "error", title: "Tiempo agotado", body: "El servidor no respondió. Recarga con Ctrl+Shift+R y reintenta. Si persiste, abre F12 → Network y revisa POST /api/auth/callback/credentials." });
    }, 10000);
    try {
      const res: any = await Promise.race([
        signIn("credentials", { username: username.trim(), password, redirect: false }),
        new Promise((_, rej) => setTimeout(() => rej(new Error("timeout_signIn")), 9000)),
      ]);
      clearTimeout(safety);
      if (res?.ok) { router.push("/"); router.refresh(); return; }
      setAlert(getAuthAlert(res?.error, username));
      setIsLoading(false);
    } catch (e: any) {
      clearTimeout(safety);
      const isTimeout = e?.message === "timeout_signIn";
      setAlert({ type: "error", title: isTimeout ? "Sin respuesta del servidor" : "Error de red", body: isTimeout ? "El servidor no respondió. Verifica que Docker esté corriendo y el puerto 3000 accesible, luego recarga." : "No se pudo conectar. Abre F12 → Console/Network para más detalles." });
      setIsLoading(false);
    }
  };
  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === "Enter") handleLocalSignIn(); };

  if (status === "loading") return (
    <div className="fixed inset-0 bg-[#080c14] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <>
      <style jsx global>{`
        @keyframes alertIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideRight { from { opacity: 0; transform: translateX(-30px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes pulseGlow { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.8; } }
        @keyframes float1 { 0%, 100% { transform: translate(0, 0) scale(1); } 33% { transform: translate(30px, -20px) scale(1.05); } 66% { transform: translate(-15px, 15px) scale(0.95); } }
        @keyframes float2 { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(-25px, 30px) scale(1.08); } }
        @keyframes gridMove { 0% { transform: translateY(0); } 100% { transform: translateY(48px); } }
        .login-form { animation: fadeUp 0.6s ease both; }
        .brand-panel { animation: slideRight 0.7s ease both; }
        .feature-item { animation: fadeUp 0.5s ease both; }
        .float-1 { animation: float1 14s ease-in-out infinite; }
        .float-2 { animation: float2 18s ease-in-out infinite; }
        .grid-scroll { animation: gridMove 8s linear infinite; }
        input:-webkit-autofill, input:-webkit-autofill:hover, input:-webkit-autofill:focus {
          -webkit-box-shadow: 0 0 0 1000px #0f172a inset !important;
          -webkit-text-fill-color: #fff !important;
          transition: background-color 5000s ease-in-out 0s;
        }
      `}</style>

      <div className="fixed inset-0 bg-[#080c14] flex overflow-hidden">
        {/* ── Left brand panel ── */}
        <div className="brand-panel hidden lg:flex flex-col justify-between relative overflow-hidden" style={{ width: "45%", background: "linear-gradient(135deg, #0c1222 0%, #111827 50%, #0f172a 100%)" }}>
          {/* Animated background elements */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="float-1 absolute top-1/4 left-1/4 w-80 h-80 rounded-full opacity-20" style={{ background: "radial-gradient(circle, #7c3aed 0%, transparent 70%)", filter: "blur(50px)" }} />
            <div className="float-2 absolute bottom-1/3 right-1/4 w-72 h-72 rounded-full opacity-15" style={{ background: "radial-gradient(circle, #06b6d4 0%, transparent 70%)", filter: "blur(50px)" }} />
            <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)", backgroundSize: "48px 48px" }} />
            <div className="grid-scroll absolute inset-0 opacity-[0.02]" style={{ backgroundImage: "linear-gradient(#06b6d4 1px, transparent 1px)", backgroundSize: "48px 48px" }} />
          </div>

          <div className="relative z-10 p-12">
            <div className="flex items-center gap-3 mb-2">
              <img src="/logo-dark.png" alt="UX Technology" width={120} height={64} style={{ objectFit: "contain" }} />
            </div>
          </div>

          <div className="relative z-10 px-12 flex-1 flex flex-col justify-center">
            <h2 className="text-3xl font-bold text-white leading-tight mb-3">
              Centraliza tu<br />
              <span style={{ background: "linear-gradient(90deg, #7c3aed, #06b6d4)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>infraestructura cloud</span>
            </h2>
            <p className="text-white/40 text-sm leading-relaxed mb-10 max-w-sm">
              Gestiona inventario, monitoreo, costos y seguridad de AWS y Huawei Cloud desde una sola plataforma.
            </p>

            <div className="space-y-5">
              {FEATURES.map((f, i) => (
                <div key={i} className="feature-item flex items-start gap-4" style={{ animationDelay: `${0.3 + i * 0.15}s` }}>
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.15), rgba(6,182,212,0.15))", border: "1px solid rgba(124,58,237,0.2)" }}>
                    <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={f.icon} /></svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white/90">{f.label}</p>
                    <p className="text-xs text-white/35 mt-0.5">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative z-10 p-12">
            <div className="flex items-center gap-4 text-xs text-white/20">
              <span>UX Technology</span>
              <span className="w-1 h-1 rounded-full bg-white/20" />
              <span>v10.7</span>
              <span className="w-1 h-1 rounded-full bg-white/20" />
              <span>Multi Cloud</span>
            </div>
          </div>

          {/* Right edge glow */}
          <div className="absolute top-0 right-0 bottom-0 w-px" style={{ background: "linear-gradient(180deg, transparent, rgba(124,58,237,0.3) 30%, rgba(6,182,212,0.3) 70%, transparent)" }} />
        </div>

        {/* ── Right form panel ── */}
        <div className="flex-1 flex items-center justify-center relative overflow-hidden">
          {/* Subtle background */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/3 right-1/4 w-64 h-64 rounded-full opacity-10" style={{ background: "radial-gradient(circle, #7c3aed 0%, transparent 70%)", filter: "blur(60px)" }} />
            <div className="absolute bottom-1/4 left-1/3 w-48 h-48 rounded-full opacity-8" style={{ background: "radial-gradient(circle, #06b6d4 0%, transparent 70%)", filter: "blur(60px)" }} />
          </div>

          <div className="login-form relative z-10 w-full max-w-[420px] mx-8">
            {/* Mobile logo */}
            <div className="flex lg:hidden items-center justify-center mb-8">
              <img src="/logo-dark.png" alt="UX Technology" width={100} height={54} style={{ objectFit: "contain" }} />
            </div>

            {/* Header */}
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-white tracking-tight">Iniciar sesión</h1>
              <p className="text-sm text-white/40 mt-1.5">Accede a tu plataforma de inventario cloud</p>
            </div>

            {/* Mode tabs */}
            <div className="flex rounded-xl p-1 mb-6" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <button
                onClick={() => { setMode("office365"); setAlert(null); }}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 ${mode === "office365" ? "text-white" : "text-white/35 hover:text-white/60"}`}
                style={mode === "office365" ? { background: "rgba(255,255,255,0.08)", boxShadow: "0 2px 8px rgba(0,0,0,0.3)" } : {}}
              >
                <svg className="w-4 h-4" viewBox="0 0 21 21" fill="none"><rect x="1" y="1" width="9" height="9" fill="#f25022" /><rect x="11" y="1" width="9" height="9" fill="#7fba00" /><rect x="1" y="11" width="9" height="9" fill="#00a4ef" /><rect x="11" y="11" width="9" height="9" fill="#ffb900" /></svg>
                Office 365
              </button>
              <button
                onClick={() => { setMode("local"); setAlert(null); }}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 ${mode === "local" ? "text-white" : "text-white/35 hover:text-white/60"}`}
                style={mode === "local" ? { background: "rgba(255,255,255,0.08)", boxShadow: "0 2px 8px rgba(0,0,0,0.3)" } : {}}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                Local
              </button>
            </div>

            {/* Alert */}
            {alert && <div className="mb-5"><Alert alert={alert} onClose={() => setAlert(null)} /></div>}

            {/* Office 365 mode */}
            {mode === "office365" && (
              <div className="space-y-5">
                <div className="rounded-xl p-4" style={{ background: "rgba(0,120,212,0.06)", border: "1px solid rgba(0,120,212,0.12)" }}>
                  <p className="text-sm text-white/70 leading-relaxed text-center">
                    Inicia sesión con la cuenta corporativa
                    <br />
                    <span className="text-cyan-400 font-medium">autorizada por la organización</span>
                  </p>
                </div>
                <button
                  onClick={() => signIn("azure-ad", { callbackUrl: "/" })}
                  className="w-full py-3.5 rounded-xl font-semibold text-white text-sm flex items-center justify-center gap-3 transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
                  style={{ background: "linear-gradient(135deg, #0078d4, #2b5797)", boxShadow: "0 4px 24px rgba(0,120,212,0.35)" }}
                >
                  <svg className="w-5 h-5" viewBox="0 0 21 21" fill="none"><rect x="1" y="1" width="9" height="9" fill="#f25022" /><rect x="11" y="1" width="9" height="9" fill="#7fba00" /><rect x="1" y="11" width="9" height="9" fill="#00a4ef" /><rect x="11" y="11" width="9" height="9" fill="#ffb900" /></svg>
                  Continuar con Microsoft
                </button>
                <div className="flex items-center justify-center gap-5 pt-2">
                  <div className="flex items-center gap-1.5 text-xs text-white/25">
                    <svg className="w-3.5 h-3.5 text-emerald-400/50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                    <span>Azure AD</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-white/25">
                    <svg className="w-3.5 h-3.5 text-cyan-400/50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    <span>MFA</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-white/25">
                    <svg className="w-3.5 h-3.5 text-violet-400/50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    <span>SSO</span>
                  </div>
                </div>
              </div>
            )}

            {/* Local mode */}
            {mode === "local" && (
              <div className="space-y-4">
                <div className="relative group">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-cyan-400 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  </div>
                  <input
                    type="text" placeholder="Usuario" value={username}
                    onChange={(e) => { setUsername(e.target.value); setAlert(null); }}
                    onKeyDown={handleKeyDown} disabled={isLoading}
                    className="w-full pl-10 pr-4 py-3.5 rounded-xl text-sm text-white placeholder:text-white/20 outline-none transition-all duration-200 disabled:opacity-50"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                    onFocus={(e) => { e.target.style.borderColor = "rgba(6,182,212,0.5)"; e.target.style.background = "rgba(255,255,255,0.06)"; }}
                    onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.08)"; e.target.style.background = "rgba(255,255,255,0.04)"; }}
                  />
                </div>

                <div className="relative group">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-cyan-400 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  </div>
                  <input
                    type={showPass ? "text" : "password"} placeholder="Contraseña" value={password}
                    onChange={(e) => { setPassword(e.target.value); setAlert(null); }}
                    onKeyDown={handleKeyDown} disabled={isLoading}
                    className="w-full pl-10 pr-10 py-3.5 rounded-xl text-sm text-white placeholder:text-white/20 outline-none transition-all duration-200 disabled:opacity-50"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                    onFocus={(e) => { e.target.style.borderColor = "rgba(6,182,212,0.5)"; e.target.style.background = "rgba(255,255,255,0.06)"; }}
                    onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.08)"; e.target.style.background = "rgba(255,255,255,0.04)"; }}
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/50 transition-colors">
                    {showPass ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    )}
                  </button>
                </div>

                <button
                  onClick={handleLocalSignIn} disabled={isLoading}
                  className="w-full py-3.5 rounded-xl font-semibold text-sm text-white transition-all duration-200 hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
                  style={{ background: "linear-gradient(135deg, #7c3aed, #06b6d4)", boxShadow: "0 4px 24px rgba(124,58,237,0.3)" }}
                >
                  {isLoading ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      Iniciando sesión...
                    </>
                  ) : (
                    <>
                      Iniciar sesión
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Footer */}
            <div className="mt-10 pt-6 flex items-center justify-center gap-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-white/20 tracking-wider uppercase">UX Technology</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
