import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, UserRole } from "@/contexts/AuthContext";
import { Wrench, Eye, EyeOff } from "lucide-react";

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!username.trim()) { setError("Username is required"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    const role = login(username, password);
    // if (success) navigate("/dashboard");
    if (role) navigate("/dashboard");
    else setError("Invalid credentials");
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex flex-1 flex-col items-center justify-center p-6">
        {/* Logo */}
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20">
            <Wrench size={20} className="text-primary" />
          </div>
          <span className="text-sm font-semibold text-foreground">Calibration Management System</span>
        </div>

        {/* Login Card */}
        <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 space-y-6">
          <h2 className="text-center text-xl font-bold text-foreground uppercase" style={{ fontVariationSettings: "'GRAD' 50" }}>
            {/* {userRole === "admin" ? "ADMIN" : "USER"} */} LOGIN
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Username</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface-1 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                autoComplete="username"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface-1 px-3 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  autoComplete="current-password"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <button type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] uppercase tracking-wider">
              LOGIN
            </button>
          </form>
        </div>

        <button onClick={() => navigate("/")} className="mt-6 text-sm text-muted-foreground hover:text-foreground transition-colors">
          ← Back to portal selection
        </button>
      </div>

      <footer className="border-t border-border py-4 text-center text-xs text-muted-foreground">
        © 2026 PENS X GARUDAFOOD
      </footer>
    </div>
  );
};

export default Login;
