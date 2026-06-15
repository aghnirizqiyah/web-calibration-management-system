import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import ManageAssets from "@/pages/ManageAssets";
import AppLayout from "@/components/AppLayout";

const ProtectedRoute: React.FC<{ children: React.ReactNode; adminOnly?: boolean }> = ({ children, adminOnly }) => {
  const { isAuthenticated, role } = useAuth();

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (adminOnly && role !== "admin") return <Navigate to="/dashboard" replace />;

  return <AppLayout>{children}</AppLayout>;
};

const AppRoutes = () => {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route path="/" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />} />
      <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />}/>
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/assets" element={<ProtectedRoute adminOnly><ManageAssets /></ProtectedRoute>} />
    </Routes>
  );
};

const App = () => (
  // ─── BrowserRouter ditaruh paling luar agar semua sub-komponen aman menggunakan hook navigasi ───
  <BrowserRouter>
    <AuthProvider>
      <TooltipProvider>
        <Sonner />
        <AppRoutes />
      </TooltipProvider>
    </AuthProvider>
  </BrowserRouter>
);

export default App;