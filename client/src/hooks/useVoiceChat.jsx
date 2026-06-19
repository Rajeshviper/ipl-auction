import { useCallback, useEffect, useRef, useState } from "react";
import { useSocket } from "../context/SocketContext";

// Simple mesh WebRTC voice chat. Good for small auction rooms (host + ~10 buyers).
// For larger participant counts, swap this for an SFU (e.g. mediasoup/LiveKit) later -
// the socket signaling channel ("voice:signal") is already structured to support that swap.
const ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];

export function useVoiceChat(roomId) {
  const { socket } = useSocket();
  const [isVoiceOn, setIsVoiceOn] = useState(false);
  const [speakingPeers, setSpeakingPeers] = useState(new Set());
  const localStreamRef = useRef(null);
  const peersRef = useRef(new Map()); // socketId -> RTCPeerConnection

  const cleanupPeer = useCallback((socketId) => {
    const pc = peersRef.current.get(socketId);
    if (pc) {
      pc.close();
      peersRef.current.delete(socketId);
    }
  }, []);

  const createPeerConnection = useCallback(
    (targetSocketId) => {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current);
        });
      }

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("voice:signal", {
            targetSocketId,
            signal: { type: "ice", candidate: event.candidate },
          });
        }
      };

      pc.ontrack = (event) => {
        let audioEl = document.getElementById(`voice-audio-${targetSocketId}`);
        if (!audioEl) {
          audioEl = document.createElement("audio");
          audioEl.id = `voice-audio-${targetSocketId}`;
          audioEl.autoplay = true;
          document.body.appendChild(audioEl);
        }
        audioEl.srcObject = event.streams[0];
      };

      peersRef.current.set(targetSocketId, pc);
      return pc;
    },
    [socket]
  );

  const startVoice = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      setIsVoiceOn(true);
      socket.emit("voice:join", { roomId });
    } catch (err) {
      console.error("Microphone access denied or unavailable", err);
      throw err;
    }
  }, [socket, roomId]);

  const stopVoice = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    peersRef.current.forEach((pc) => pc.close());
    peersRef.current.clear();
    document.querySelectorAll("audio[id^='voice-audio-']").forEach((el) => el.remove());
    socket.emit("voice:leave", { roomId });
    setIsVoiceOn(false);
  }, [socket, roomId]);

  useEffect(() => {
    async function handlePeerJoined({ socketId }) {
      const pc = createPeerConnection(socketId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("voice:signal", { targetSocketId: socketId, signal: { type: "offer", sdp: offer } });
    }

    async function handleSignal({ fromSocketId, signal }) {
      let pc = peersRef.current.get(fromSocketId);
      if (signal.type === "offer") {
        if (!pc) pc = createPeerConnection(fromSocketId);
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("voice:signal", { targetSocketId: fromSocketId, signal: { type: "answer", sdp: answer } });
      } else if (signal.type === "answer" && pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
      } else if (signal.type === "ice" && pc) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        } catch (e) {
          console.warn("ICE candidate error", e);
        }
      }
    }

    function handlePeerLeft({ socketId }) {
      cleanupPeer(socketId);
      const el = document.getElementById(`voice-audio-${socketId}`);
      if (el) el.remove();
    }

    socket.on("voice:peer-joined", handlePeerJoined);
    socket.on("voice:signal", handleSignal);
    socket.on("voice:peer-left", handlePeerLeft);

    return () => {
      socket.off("voice:peer-joined", handlePeerJoined);
      socket.off("voice:signal", handleSignal);
      socket.off("voice:peer-left", handlePeerLeft);
    };
  }, [socket, createPeerConnection, cleanupPeer]);

  useEffect(() => {
    return () => {
      if (isVoiceOn) stopVoice();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { isVoiceOn, startVoice, stopVoice, speakingPeers };
}
