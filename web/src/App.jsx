import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import Divider from "./components/Divider";
import Features from "./components/Features";
import Commands from "./components/Commands";
import Leaderboard from "./components/Leaderboard";

export default function App() {
  return (
    <div className="min-h-screen bg-pibot-bg text-pibot-text antialiased selection:bg-pibot-pink selection:text-pibot-bg">
      <Navbar />
      <main>
        <Hero />
        <Divider />
        <Features />
        <Divider />
        <Commands />
        <Divider />
        <Leaderboard />
      </main>
    </div>
  );
}