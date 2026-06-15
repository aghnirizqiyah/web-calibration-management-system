import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, CalendarCheck, Settings, LogOut, Menu, X, Wrench } from "lucide-react";

interface AppLayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { label: "Calibration Schedule", path: "/dashboard", icon: CalendarCheck, roles: ["admin", "user"] },
  { label: "Manage Assets", path: "/assets", icon: Settings, roles: ["admin"] },
];

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { role, username, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const filteredNav = navItems.filter(item => role && item.roles.includes(role));

  const handleLogout = () => { logout(); navigate("/"); };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top bar - mobile */}
      <header className="flex h-14 items-center justify-between border-b border-border px-4 lg:hidden">
        <button onClick={() => setSidebarOpen(true)} className="rounded-lg p-2 text-muted-foreground hover:bg-surface-1 hover:text-foreground">
          <Menu size={20} />
        </button>
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
            <Wrench size={14} className="text-primary" />
          </div>
        </div>
        <button onClick={handleLogout} className="rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
          Logout
        </button>
      </header>

      <div className="flex flex-1">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex lg:w-60 lg:flex-col lg:border-r lg:border-border">
          <div className="flex h-14 items-center gap-3 border-b border-border px-4">
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
              <Wrench size={14} className="text-primary" />
            </div>
            <span className="text-sm font-semibold text-foreground">Calibration MS</span>
          </div>
          <nav className="flex-1 space-y-1 p-3">
            {filteredNav.map(item => {
              const isActive = location.pathname === item.path;
              return (
                <NavLink key={item.path} to={item.path}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-surface-1 hover:text-foreground"
                  }`}>
                  <item.icon size={18} />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
          <div className="border-t border-border p-3 space-y-2">
            <div className="px-3 py-2">
              <p className="text-sm font-medium text-foreground">{username}</p>
              <p className="text-xs text-muted-foreground capitalize">{role}</p>
            </div>
            <button onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-surface-1 hover:text-foreground">
              <LogOut size={18} />
              <span>Logout</span>
            </button>
          </div>
        </aside>

        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="absolute inset-0 bg-background/80" onClick={() => setSidebarOpen(false)} />
            <aside className="relative z-50 w-64 h-full bg-background border-r border-border flex flex-col">
              <div className="flex h-14 items-center justify-between border-b border-border px-4">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                    <Wrench size={14} className="text-primary" />
                  </div>
                  <span className="text-sm font-semibold text-foreground">Calibration MS</span>
                </div>
                <button onClick={() => setSidebarOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <X size={18} />
                </button>
              </div>
              <nav className="flex-1 space-y-1 p-3">
                {filteredNav.map(item => {
                  const isActive = location.pathname === item.path;
                  return (
                    <NavLink key={item.path} to={item.path} onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                        isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-surface-1 hover:text-foreground"
                      }`}>
                      <item.icon size={18} />
                      <span>{item.label}</span>
                    </NavLink>
                  );
                })}
              </nav>
              <div className="border-t border-border p-3">
                <div className="px-3 py-2">
                  <p className="text-sm font-medium text-foreground">{username}</p>
                  <p className="text-xs text-muted-foreground capitalize">{role}</p>
                </div>
              </div>
            </aside>
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 overflow-auto">
          <div className="p-4 lg:p-6">
            {children}
          </div>
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t border-border py-3 text-center text-xs text-muted-foreground">
        © 2026 PENS X GARUDAFOOD
      </footer>
    </div>
  );
};

export default AppLayout;
