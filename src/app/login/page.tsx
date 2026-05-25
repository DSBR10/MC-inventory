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

function getAuthAlert(
  error: string | undefined | null,
  username: string,
): AlertMessage {
  if (!username.trim())
    return {
      type: "warning",
      title: "Campo requerido",
      body: "Por favor ingresa tu nombre de usuario antes de continuar.",
    };
  switch (error) {
    case "CredentialsSignin":
      return {
        type: "error",
        title: "Credenciales incorrectas",
        body: "El usuario o la contraseña no son válidos. Verifica e intenta de nuevo.",
      };
    case "SessionRequired":
      return {
        type: "warning",
        title: "Sesión requerida",
        body: "Debes iniciar sesión para acceder a esta sección.",
      };
    case "AccessDenied":
      return {
        type: "error",
        title: "Acceso denegado",
        body: "Tu cuenta no tiene permisos. Contacta al administrador.",
      };
    case "OAuthAccountNotLinked":
      return {
        type: "warning",
        title: "Cuenta no vinculada",
        body: "Ya existe una cuenta con ese correo con otro método de inicio.",
      };
    default:
      return {
        type: "error",
        title: "Error de autenticación",
        body: "No se pudo completar el inicio de sesión. Intenta de nuevo.",
      };
  }
}

function Alert({
  alert,
  onClose,
}: {
  alert: AlertMessage;
  onClose: () => void;
}) {
  const styles = {
    error: {
      accent: "#f87171",
      bg: "rgba(248,113,113,0.08)",
      icon: "M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    },
    warning: {
      accent: "#fbbf24",
      bg: "rgba(251,191,36,0.08)",
      icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
    },
    info: {
      accent: "#60a5fa",
      bg: "rgba(96,165,250,0.08)",
      icon: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    },
  };
  const { accent, bg, icon } = styles[alert.type];
  return (
    <div
      style={{ background: bg, borderColor: accent }}
      className="w-full border rounded-xl p-3.5 animate-[alertIn_0.2s_ease]"
    >
      <div className="flex items-start gap-2.5">
        <svg
          className="w-4 h-4 mt-0.5 flex-shrink-0"
          style={{ color: accent }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d={icon}
          />
        </svg>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold mb-0.5" style={{ color: accent }}>
            {alert.title}
          </p>
          <p className="text-xs text-[var(--text-primary)]/60 leading-relaxed">
            {alert.body}
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-[var(--text-primary)]/30 hover:text-[var(--text-primary)]/70 transition-colors flex-shrink-0 mt-0.5"
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

type Mode = "office365" | "local";

export default function LoginPage() {
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<Mode>("office365");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [alert, setAlert] = useState<AlertMessage | null>(null);

  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);
  useEffect(() => {
    if (status === "authenticated" && mounted) router.push("/");
  }, [status, router, mounted]);
  useEffect(() => {
    if (!alert) return;
    const t = setTimeout(() => setAlert(null), 6000);
    return () => clearTimeout(t);
  }, [alert]);

  const handleLocalSignIn = async () => {
    if (isLoading) return;
    if (!username.trim()) {
      setAlert(getAuthAlert(null, ""));
      return;
    }
    setIsLoading(true);
    setAlert(null);
    const res = await signIn("credentials", {
      username,
      password,
      redirect: false,
    });
    if (res?.ok) {
      router.push("/");
    } else {
      setAlert(getAuthAlert(res?.error, username));
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleLocalSignIn();
  };

  if (!mounted)
    return (
      <div className="fixed inset-0 bg-[#080c14] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );

  return (
    <>
      <style jsx global>{`
        @keyframes alertIn {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes float {
          0%,
          100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-8px);
          }
        }
        @keyframes pulse-ring {
          0% {
            transform: scale(0.95);
            opacity: 0.5;
          }
          70% {
            transform: scale(1.05);
            opacity: 0;
          }
          100% {
            transform: scale(0.95);
            opacity: 0;
          }
        }
        @keyframes orb1 {
          0%,
          100% {
            transform: translate(0, 0) scale(1);
          }
          33% {
            transform: translate(40px, -30px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
        }
        @keyframes orb2 {
          0%,
          100% {
            transform: translate(0, 0) scale(1);
          }
          33% {
            transform: translate(-30px, 40px) scale(0.9);
          }
          66% {
            transform: translate(20px, -20px) scale(1.1);
          }
        }
        @keyframes orb3 {
          0%,
          100% {
            transform: translate(0, 0) scale(1);
          }
          50% {
            transform: translate(25px, 35px) scale(1.05);
          }
        }
        .login-card {
          animation: fadeUp 0.5s ease both;
        }
        .orb-1 {
          animation: orb1 12s ease-in-out infinite;
        }
        .orb-2 {
          animation: orb2 15s ease-in-out infinite;
        }
        .orb-3 {
          animation: orb3 10s ease-in-out infinite;
        }
        .tab-active {
          position: relative;
        }
        .tab-active::after {
          content: "";
          position: absolute;
          bottom: -1px;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(90deg, #06b6d4, #8b5cf6);
          border-radius: 2px;
        }
        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus {
          -webkit-box-shadow: 0 0 0 1000px #0f172a inset !important;
          -webkit-text-fill-color: #fff !important;
          transition: background-color 5000s ease-in-out 0s;
        }
      `}</style>

      <div className="fixed inset-0 bg-[#080c14] flex items-center justify-center overflow-hidden">
        {/* Background orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            className="orb-1 absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-20"
            style={{
              background:
                "radial-gradient(circle, #7c3aed 0%, transparent 70%)",
              filter: "blur(40px)",
            }}
          />
          <div
            className="orb-2 absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full opacity-15"
            style={{
              background:
                "radial-gradient(circle, #0891b2 0%, transparent 70%)",
              filter: "blur(40px)",
            }}
          />
          <div
            className="orb-3 absolute top-1/2 right-1/3 w-64 h-64 rounded-full opacity-10"
            style={{
              background:
                "radial-gradient(circle, #db2777 0%, transparent 70%)",
              filter: "blur(40px)",
            }}
          />
          {/* Grid */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
              backgroundSize: "48px 48px",
            }}
          />
        </div>

        {/* Card */}
        <div className="login-card relative z-10 w-full max-w-md mx-4">
          <div
            className="relative rounded-2xl overflow-hidden"
            style={{
              background: "rgba(15,23,42,0.85)",
              backdropFilter: "blur(24px)",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow:
                "0 32px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04) inset",
            }}
          >
            {/* Top accent line */}
            <div
              className="h-px w-full"
              style={{
                background:
                  "linear-gradient(90deg, transparent, #7c3aed 30%, #06b6d4 70%, transparent)",
              }}
            />

            <div className="p-8">
              {/* Logo / Brand */}
              <div className="text-center mb-8">
                <div
                  className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4 relative"
                  style={{
                    background: "linear-gradient(135deg, #7c3aed20, #06b6d420)",
                    border: "1px solid rgba(124,58,237,0.3)",
                  }}
                >
                  <svg
                    className="w-7 h-7"
                    fill="none"
                    stroke="url(#logoGrad)"
                    strokeWidth="1.5"
                    viewBox="0 0 24 24"
                  >
                    <defs>
                      <linearGradient id="logoGrad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#7c3aed" />
                        <stop offset="100%" stopColor="#06b6d4" />
                      </linearGradient>
                    </defs>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z"
                    />
                  </svg>
                </div>
                <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
                  MC Inventory
                </h1>
                <p className="text-sm text-[var(--text-primary)]/40 mt-1">
                  Multi Cloud Inventory Platform
                </p>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-[var(--border)] mb-6">
                <button
                  onClick={() => {
                    setMode("office365");
                    setAlert(null);
                  }}
                  className={`flex-1 pb-3 text-sm font-medium transition-colors ${mode === "office365" ? "tab-active text-[var(--text-primary)]" : "text-[var(--text-primary)]/40 hover:text-[var(--text-primary)]/70"}`}
                >
                  <div className="flex items-center justify-center gap-2">
                    {/* Microsoft icon */}
                    <svg className="w-4 h-4" viewBox="0 0 21 21" fill="none">
                      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
                      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
                    </svg>
                    Office 365
                  </div>
                </button>
                <button
                  onClick={() => {
                    setMode("local");
                    setAlert(null);
                  }}
                  className={`flex-1 pb-3 text-sm font-medium transition-colors ${mode === "local" ? "tab-active text-[var(--text-primary)]" : "text-[var(--text-primary)]/40 hover:text-[var(--text-primary)]/70"}`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                    Local
                  </div>
                </button>
              </div>

              {/* Alert */}
              {alert && (
                <div className="mb-4">
                  <Alert alert={alert} onClose={() => setAlert(null)} />
                </div>
              )}

              {/* Office 365 mode */}
              {mode === "office365" && (
                <div className="space-y-4">
                  <p className="text-sm text-[var(--text-primary)]/50 text-center leading-relaxed">
                    Inicia sesión con tu cuenta corporativa
                    <br />
                    <span className="text-cyan-400/80">@ux.local</span>
                  </p>
                  <button
                    onClick={() => signIn("azure-ad", { callbackUrl: "/" })}
                    className="w-full py-3 rounded-xl font-semibold text-[var(--text-primary)] text-sm flex items-center justify-center gap-3 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                    style={{
                      background: "linear-gradient(135deg, #0078d4, #2b5797)",
                      boxShadow: "0 4px 20px rgba(0,120,212,0.3)",
                    }}
                  >
                    <svg className="w-5 h-5" viewBox="0 0 21 21" fill="none">
                      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
                      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
                    </svg>
                    Continuar con Microsoft
                  </button>
                  <div className="flex items-center gap-3 my-2">
                    <div className="flex-1 h-px bg-[var(--bg-hover)]" />
                    <span className="text-xs text-[var(--text-primary)]/25">
                      SSO corporativo
                    </span>
                    <div className="flex-1 h-px bg-[var(--bg-hover)]" />
                  </div>
                  <div className="flex items-center justify-center gap-4 text-xs text-[var(--text-primary)]/25">
                    <div className="flex items-center gap-1.5">
                      <svg
                        className="w-3 h-3 text-emerald-400/60"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                        />
                      </svg>
                      <span>Azure AD protegido</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <svg
                        className="w-3 h-3 text-cyan-400/60"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                        />
                      </svg>
                      <span>MFA disponible</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Local mode */}
              {mode === "local" && (
                <div className="space-y-3">
                  {/* Username */}
                  <div className="relative group">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-primary)]/30 group-focus-within:text-cyan-400 transition-colors">
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                    </div>
                    <input
                      type="text"
                      placeholder="Usuario"
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value);
                        setAlert(null);
                      }}
                      onKeyDown={handleKeyDown}
                      disabled={isLoading}
                      className="w-full pl-10 pr-4 py-3 rounded-xl text-sm text-[var(--text-primary)] placeholder:text-[var(--text-primary)]/25 outline-none transition-all duration-200 disabled:opacity-50"
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.1)",
                      }}
                      onFocus={(e) =>
                        (e.target.style.borderColor = "rgba(6,182,212,0.5)")
                      }
                      onBlur={(e) =>
                        (e.target.style.borderColor = "rgba(255,255,255,0.1)")
                      }
                    />
                  </div>

                  {/* Password */}
                  <div className="relative group">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-primary)]/30 group-focus-within:text-cyan-400 transition-colors">
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                        />
                      </svg>
                    </div>
                    <input
                      type={showPass ? "text" : "password"}
                      placeholder="Contraseña"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setAlert(null);
                      }}
                      onKeyDown={handleKeyDown}
                      disabled={isLoading}
                      className="w-full pl-10 pr-10 py-3 rounded-xl text-sm text-[var(--text-primary)] placeholder:text-[var(--text-primary)]/25 outline-none transition-all duration-200 disabled:opacity-50"
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.1)",
                      }}
                      onFocus={(e) =>
                        (e.target.style.borderColor = "rgba(6,182,212,0.5)")
                      }
                      onBlur={(e) =>
                        (e.target.style.borderColor = "rgba(255,255,255,0.1)")
                      }
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--text-primary)]/25 hover:text-[var(--text-primary)]/60 transition-colors"
                    >
                      {showPass ? (
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                          />
                        </svg>
                      )}
                    </button>
                  </div>

                  {/* Submit */}
                  <button
                    onClick={handleLocalSignIn}
                    disabled={isLoading}
                    className="w-full py-3 rounded-xl font-semibold text-sm text-[var(--text-primary)] transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2 mt-1"
                    style={{
                      background: "linear-gradient(135deg, #7c3aed, #06b6d4)",
                      boxShadow: "0 4px 20px rgba(124,58,237,0.3)",
                    }}
                  >
                    {isLoading ? (
                      <>
                        <svg
                          className="w-4 h-4 animate-spin"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                          />
                        </svg>
                        Iniciando sesión...
                      </>
                    ) : (
                      <>
                        Iniciar sesión
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13 7l5 5m0 0l-5 5m5-5H6"
                          />
                        </svg>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-8 pb-6 flex items-center justify-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-[var(--text-primary)]/25 tracking-widest uppercase">
                UX Technology
              </span>
            </div>

            {/* Bottom accent line */}
            <div
              className="h-px w-full"
              style={{
                background:
                  "linear-gradient(90deg, transparent, #06b6d430 50%, transparent)",
              }}
            />
          </div>
        </div>
      </div>
    </>
  );
}
