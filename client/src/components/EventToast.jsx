import { useEffect, useState } from "react";

export default function EventToast({ event }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!event) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 2800);
    return () => clearTimeout(t);
  }, [event]);

  if (!event || !visible) return null;

  let content = null;
  let bg = "var(--bg-card-2)";

  if (event.type === "bid") {
    content = `💰 ${event.teamShortName} bid ₹${event.amount}L`;
    bg = "var(--bg-card-2)";
  } else if (event.type === "sold") {
    content = `✅ SOLD to ${event.teamName} for ₹${event.amount}L`;
    bg = "rgba(0, 212, 170, 0.18)";
  } else if (event.type === "unsold") {
    content = `❌ Player UNSOLD`;
    bg = "rgba(255, 71, 87, 0.18)";
  } else if (event.type === "ended") {
    content = `🏁 Auction has ended`;
    bg = "rgba(255, 201, 74, 0.18)";
  }

  return (
    <div
      className="pop-in"
      style={{
        position: "fixed",
        top: "calc(12px + env(safe-area-inset-top, 0px))",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 999,
        background: bg,
        border: "1px solid var(--border)",
        borderRadius: 14,
        padding: "10px 18px",
        fontWeight: 700,
        fontSize: 14,
        whiteSpace: "nowrap",
        backdropFilter: "blur(8px)",
        maxWidth: "92vw",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}
    >
      {content}
    </div>
  );
}
