import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SocketProvider } from "./context/SocketContext";
import { AuctionProvider } from "./context/AuctionContext";
import LoginPage from "./pages/LoginPage";
import HostSetupPage from "./pages/HostSetupPage";
import HostConsolePage from "./pages/HostConsolePage";
import BuyerConsolePage from "./pages/BuyerConsolePage";
import ParticipantWatchPage from "./pages/ParticipantWatchPage";

export default function App() {
  return (
    <SocketProvider>
      <AuctionProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LoginPage />} />
            <Route path="/host/setup" element={<HostSetupPage />} />
            <Route path="/host" element={<HostConsolePage />} />
            <Route path="/buyer" element={<BuyerConsolePage />} />
            <Route path="/watch" element={<ParticipantWatchPage />} />
          </Routes>
        </BrowserRouter>
      </AuctionProvider>
    </SocketProvider>
  );
}
