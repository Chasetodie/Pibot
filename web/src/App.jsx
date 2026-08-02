import { useEffect } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import Divider from "./components/Divider";
import Features from "./components/Features";
import Commands from "./components/Commands";
import Leaderboard from "./components/Leaderboard";
import AuthCallback from "./pages/AuthCallback";
import Dashboard from "./pages/Dashboard";
import GuildDashboard from "./pages/GuildDashboard";
import NotFound from "./pages/NotFound";

export default function App() {
  const location = useLocation();
  const ocultarNavbar = location.pathname === "/auth/callback";

  useEffect(() => {
    if (location.hash) {
      const id = location.hash.replace('#', '');
      setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [location]);

  return (
    <div className="min-h-screen bg-pibot-bg text-pibot-text antialiased selection:bg-pibot-pink selection:text-pibot-bg">
      {!ocultarNavbar && <Navbar />}
      <main>
        <Routes>
          <Route path="/" element={
            <>
              <Hero />
              <Divider />
              <Features />
              <Divider />
              <Leaderboard />
              <Divider />
              <Commands />
            </>
          } />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/dashboard/:guildId" element={<GuildDashboard />} />
          <Route path="/404" element={<NotFound />} />
          <Route path="/sin-acceso" element={<NotFound tipo="denegado" />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  );
}