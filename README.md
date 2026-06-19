# 🏏 IPL Live Auction — Mobile Web App

A real-time, mobile-only (Android browser optimized) IPL-style player auction app.
Host runs the auction, Buyers bid for players on their phones, Participants watch live — all through one shared link.

> **Note:** This app is portrait-mode and mobile-optimized only. It is not designed to have a separate desktop layout — that was an intentional choice per the project requirements.

---

## ⚙️ Tech Stack

- **Backend:** Node.js, Express, Socket.IO (WebSockets), Prisma ORM, SQLite
- **Frontend:** React (Vite), React Router, Socket.IO client
- **Voice Chat:** WebRTC (mesh) signaled over the same WebSocket connection — works for host + a handful of buyers today; swap-ready for an SFU (e.g. LiveKit) if you scale to large rooms.

---

## 📂 Project Structure

```
ipl-auction/
├── server/                  # Backend (Express + Socket.IO + Prisma)
│   ├── prisma/schema.prisma # Database models (Room, Team, Player, Bid, User)
│   ├── src/
│   │   ├── index.js         # Entry point
│   │   ├── routes/api.js    # REST routes (room/team/player setup)
│   │   ├── sockets/         # WebSocket handlers + auction state machine
│   │   └── utils/           # Bid increment rules, prisma client
│   └── package.json
├── client/                  # Frontend (React mobile-only PWA-style site)
│   ├── src/
│   │   ├── pages/           # Login, HostSetup, HostConsole, BuyerConsole, Watch
│   │   ├── components/      # CurrentPlayerCard, BottomNav, EventToast
│   │   ├── context/         # Socket + Auction state providers
│   │   └── hooks/           # useVoiceChat (WebRTC)
│   └── package.json
├── render.yaml               # One-click Render.com deployment blueprint
└── server/Procfile           # Railway/Heroku-style deployment
```

---

## 🚀 Run Locally (for testing on your own phone over WiFi)

### 1. Backend
```bash
cd server
cp .env.example .env
npm install
npx prisma generate
npx prisma db push      # creates dev.db SQLite file with all tables
npm run dev              # starts on http://localhost:4000
```

### 2. Frontend
```bash
cd client
cp .env.example .env
# Edit .env -> set VITE_SERVER_URL to your computer's LAN IP, e.g.:
# VITE_SERVER_URL=http://192.168.1.50:4000
npm install
npm run dev               # starts on http://localhost:5173, also exposed on your LAN
```

### 3. Open on your Android phone
Find your computer's LAN IP (e.g. `192.168.1.50`), connect your phone to the **same WiFi**, then visit:
```
http://192.168.1.50:5173
```
This is enough to test the full flow — Host setup, Buyer bidding, Participant watching — across multiple phones before deploying for real.

---

## 🌍 Deploy for Real (so anyone can join via a public link)

You need **two deployed pieces**: the backend (needs to stay running for WebSockets) and the frontend (static site).

### Option A — Render.com (easiest, free tier available)
1. Push this whole project to a GitHub repo.
2. On [render.com](https://render.com), click **New → Blueprint**, and point it at your repo (it will read `render.yaml` automatically).
3. Render will spin up two services: `ipl-auction-server` and `ipl-auction-client`.
4. Once both are live, update:
   - In the **server** service env vars: `CLIENT_ORIGIN` → your client's live URL.
   - In the **client** service env vars: `VITE_SERVER_URL` → your server's live URL.
5. Share `https://your-client-url.onrender.com` — that's your auction link.

> Free tier services on Render sleep after inactivity, causing a ~30s cold start. For an actual live auction night, consider a paid tier ($7/mo) so the connection is instant.

### Option B — Railway.app
1. Push to GitHub.
2. Create a new Railway project from the repo, set the **root directory to `server`** for one service, and **`client`** for another (Railway supports static site builds too, or use Vercel for the client — see Option C).
3. Set the same env vars as above.

### Option C — Split deploy (Vercel for frontend + Render/Railway for backend)
Frontend (Vite/React) deploys cleanly to **Vercel** (`vercel.com` → import repo → set root directory to `client` → set `VITE_SERVER_URL` env var). Backend (needs persistent WebSocket support) should go on **Render** or **Railway**, not Vercel (Vercel serverless functions don't support long-lived WebSocket connections).

---

## 🔑 How the Roles Work

| Role | How they join | What they can do |
|---|---|---|
| **Host** | Creates the room first at `/host/setup`, sets up teams + players, then enters the console | Start/Pause/Resume/End auction, force-mark Unsold, re-auction, voice announce |
| **Buyer** | Opens the shared link → selects "Buyer" → picks an unclaimed team | Places bids (tap-to-bid buttons), views own squad & purse |
| **Participant** | Opens the shared link → selects "Participant" | Watches live bidding, sees sold/unsold lists, listens to voice chat |

Only **one Host** can exist per room (enforced server-side). Each **Team** can only be claimed by one Buyer (enforced server-side) — once taken, others see it as "Taken" on the join screen.

---

## ⏱️ Auction Timer Rules (as implemented)

- Each player starts with a **90-second** countdown when brought up for auction.
- Every **valid bid resets the timer to 60 seconds**.
- When the timer hits 0:
  - If there's at least one bid → player is marked **SOLD** to the highest bidder, and that team's purse is deducted automatically.
  - If there are no bids → player is marked **UNSOLD**.
- Host can re-auction any **UNSOLD** player at any time, which puts them back at the end of the queue.
- Bid increments follow IPL-style slabs (₹5L steps below ₹1Cr, scaling up to ₹50L steps above ₹10Cr) — adjust in `server/src/utils/bidIncrement.js` if you want different slabs.

---

## 🎙️ Voice Chat (Future Support — already wired in)

Voice chat uses WebRTC with signaling sent over the existing Socket.IO connection (`voice:join`, `voice:signal`, `voice:leave` events) — no separate server needed. It currently uses a **mesh** topology, meaning every participant connects directly to every other voice participant. This works great for a host + several buyers, but if you expect 20+ people on voice simultaneously at once, you'll want to swap in an SFU media server (e.g., LiveKit, mediasoup) later — the signaling structure was built so that swap doesn't require changing the rest of the app.

To enable it, each role has a "🎙️ Start/Join Voice Chat" button which requests microphone permission from the browser.

---

## 🗄️ Database Notes

- Uses **SQLite** by default (`server/prisma/schema.prisma` → `provider = "sqlite"`) so there's zero setup — perfect for a single auction event hosted from one server instance.
- If you want to run multiple simultaneous auction rooms at scale or need persistence guarantees beyond a single file, switch the datasource to PostgreSQL:
  ```prisma
  datasource db {
    provider = "postgresql"
    url      = env("DATABASE_URL")
  }
  ```
  Then set `DATABASE_URL` to a Postgres connection string (Render/Railway both offer free Postgres add-ons).

---

## 🧪 Things Worth Testing Before Game Day

- [ ] Open the host link, create 2-4 teams and a handful of players, then open the join link from a second phone as a Buyer and confirm bidding works and purse deducts correctly.
- [ ] Let the 90s timer expire with zero bids → confirm player goes to **Unsold** tab.
- [ ] Place a bid with 5s left → confirm timer resets to 60s.
- [ ] Re-auction an unsold player → confirm it reappears at the end of the queue.
- [ ] Lock your phone screen mid-auction, unlock, confirm you reconnect into the same session automatically (session is saved to localStorage).
- [ ] Test on an actual Android Chrome browser, not just desktop dev tools' mobile emulation — real touch targets and viewport behavior can differ.
