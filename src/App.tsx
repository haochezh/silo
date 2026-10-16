import { Route, Routes, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { WalletProvider } from "./wallet";
import Nav from "./components/Nav";
import Footer from "./components/Footer";
import Home from "./pages/Home";
import Coins from "./pages/Coins";
import Lock from "./pages/Lock";
import Vault from "./pages/Vault";
import Verify from "./pages/Verify";
import Docs from "./pages/Docs";

export default function App() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return (
    <WalletProvider>
      <div className="min-h-screen flex flex-col">
        <Nav />
        <main className={`flex-1 ${pathname === "/" ? "" : "pt-24 md:pt-14"}`}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/coins" element={<Coins />} />
            <Route path="/lock" element={<Lock />} />
            <Route path="/silo" element={<Vault />} />
            <Route path="/verify" element={<Verify />} />
            <Route path="/docs" element={<Docs />} />
            <Route path="/docs/:slug" element={<Docs />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </WalletProvider>
  );
}
