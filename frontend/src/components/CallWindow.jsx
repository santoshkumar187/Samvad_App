import React, { useEffect, useRef, useState } from 'react';
import { MdMic, MdMicOff, MdVideocam, MdVideocamOff, MdCallEnd } from 'react-icons/md';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' }
  ]
};

export default function CallWindow({ currentUser, remoteUser, callType, isInitiator, socket, incomingSignal, onEndCall }) {
  const localVideoRef  = useRef(null);
  const remoteAudioRef = useRef(null); // dedicated audio element for audio calls
  const remoteVideoRef = useRef(null);
  const peerRef        = useRef(null);
  const localStreamRef = useRef(null);
  const iceCandidatesQueue = useRef([]);
  const remoteDescSet  = useRef(false);
  const cleanedUp      = useRef(false);

  // Store the ICE handler so we can remove only it on cleanup
  const iceHandlerRef  = useRef(null);
  const callAcceptedHandlerRef = useRef(null);

  const [isMuted, setIsMuted]       = useState(false);
  const [isCameraOff, setCameraOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [isConnected, setIsConnected]   = useState(false);
  const [statusText, setStatusText]     = useState(isInitiator ? 'Calling...' : 'Connecting...');

  useEffect(() => {
    initCall();
    return () => doCleanup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isConnected) return;
    const interval = setInterval(() => setCallDuration(d => d + 1), 1000);
    return () => clearInterval(interval);
  }, [isConnected]);

  // ─── Flush ICE queue once remote description is set ────────────
  const flushIceQueue = async (peer) => {
    const queue = iceCandidatesQueue.current.splice(0);
    for (const c of queue) {
      try { await peer.addIceCandidate(new RTCIceCandidate(c)); }
      catch (e) { console.warn('ICE flush error:', e); }
    }
  };

  // ─── Main call setup ───────────────────────────────────────────
  const initCall = async () => {
    try {
      // 1. Get local media
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === 'video'
      });
      localStreamRef.current = stream;

      // Attach local preview for video
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // 2. Create peer connection
      const peer = new RTCPeerConnection(ICE_SERVERS);
      peerRef.current = peer;

      // 3. Add local tracks BEFORE creating offer/answer
      stream.getTracks().forEach(track => peer.addTrack(track, stream));

      // 4. Handle incoming remote tracks
      peer.ontrack = (event) => {
        const remoteStream = event.streams[0];
        if (callType === 'video' && remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
          remoteVideoRef.current.play().catch(() => {});
        } else if (callType === 'audio' && remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = remoteStream;
          remoteAudioRef.current.play().catch(() => {});
        }
        setIsConnected(true);
        setStatusText('');
      };

      // 5. Send our ICE candidates to the remote peer
      peer.onicecandidate = (event) => {
        if (event.candidate && !cleanedUp.current) {
          socket.emit('ice_candidate', { to: remoteUser.id, candidate: event.candidate });
        }
      };

      // Log connection state changes for debugging
      peer.onconnectionstatechange = () => {
        console.log('[WebRTC] connection state:', peer.connectionState);
        if ((peer.connectionState === 'disconnected' || peer.connectionState === 'failed') && !cleanedUp.current) {
          doCleanup();
          onEndCall();
        }
      };

      peer.oniceconnectionstatechange = () => {
        console.log('[WebRTC] ICE state:', peer.iceConnectionState);
        if (peer.iceConnectionState === 'connected' || peer.iceConnectionState === 'completed') {
          setIsConnected(true);
          setStatusText('');
        }
      };

      // 6. Register ICE candidate listener (store ref for proper cleanup)
      const handleIceCandidate = async ({ candidate }) => {
        if (!candidate || cleanedUp.current) return;
        if (remoteDescSet.current) {
          try { await peer.addIceCandidate(new RTCIceCandidate(candidate)); }
          catch (e) { console.warn('addIceCandidate error:', e); }
        } else {
          // Queue it until remote description is set
          iceCandidatesQueue.current.push(candidate);
        }
      };
      iceHandlerRef.current = handleIceCandidate;
      socket.on('ice_candidate', handleIceCandidate);

      // ── CALLER FLOW ──────────────────────────────────────────
      if (isInitiator) {
        setStatusText('Ringing...');

        const offer = await peer.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: callType === 'video'
        });
        await peer.setLocalDescription(offer);
        socket.emit('call_user', { to: remoteUser.id, signal: offer, callType });

        // Wait for the callee to accept
        const handleCallAccepted = async ({ signal }) => {
          if (cleanedUp.current) return;
          try {
            await peer.setRemoteDescription(new RTCSessionDescription(signal));
            remoteDescSet.current = true;
            setStatusText('Connected');
            await flushIceQueue(peer);
          } catch (e) {
            console.error('setRemoteDescription (answer) error:', e);
          }
        };
        callAcceptedHandlerRef.current = handleCallAccepted;
        socket.once('call_accepted', handleCallAccepted);

      // ── CALLEE FLOW ──────────────────────────────────────────
      } else {
        // incomingSignal is the caller's SDP offer
        await peer.setRemoteDescription(new RTCSessionDescription(incomingSignal));
        remoteDescSet.current = true;
        await flushIceQueue(peer); // flush any candidates that arrived before this

        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        socket.emit('accept_call', { to: remoteUser.id, signal: answer });
        setStatusText('Connecting...');
      }

    } catch (err) {
      console.error('[Call] initCall error:', err);
      if (err.name === 'NotAllowedError') {
        alert('Microphone/camera access denied. Please allow permissions in your browser settings and try again.');
      } else if (err.name === 'NotFoundError') {
        alert('No microphone/camera found. Please connect a device and try again.');
      } else {
        alert('Failed to start call: ' + err.message);
      }
      if (!cleanedUp.current) onEndCall();
    }
  };

  // ─── Cleanup ───────────────────────────────────────────────────
  const doCleanup = () => {
    if (cleanedUp.current) return;
    cleanedUp.current = true;

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
    }
    if (peerRef.current) {
      peerRef.current.close();
    }
    // Remove only our specific handlers (not all listeners for the event)
    if (iceHandlerRef.current) {
      socket.off('ice_candidate', iceHandlerRef.current);
    }
    if (callAcceptedHandlerRef.current) {
      socket.off('call_accepted', callAcceptedHandlerRef.current);
    }
  };

  const handleEndCall = () => {
    socket.emit('end_call', { to: remoteUser.id });
    doCleanup();
    onEndCall();
  };

  const toggleMute = () => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) { track.enabled = !track.enabled; setIsMuted(m => !m); }
  };

  const toggleCamera = () => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (track) { track.enabled = !track.enabled; setCameraOff(c => !c); }
  };

  const formatDuration = (s) => {
    const m   = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  const avatarSrc = remoteUser.profile_pic?.startsWith('http')
    ? remoteUser.profile_pic
    : remoteUser.profile_pic;

  return (
    <div className="call-window">

      {/* ── Hidden audio element for audio calls ── */}
      <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />

      {callType === 'video' ? (
        <div className="video-container">
          <video ref={remoteVideoRef} autoPlay playsInline className="remote-video" />
          <video ref={localVideoRef}  autoPlay playsInline muted className="local-video" />
          {!isConnected && (
            <div className="video-connecting-overlay">
              <div className="call-avatar-large">
                {remoteUser.profile_pic
                  ? <img src={avatarSrc} alt={remoteUser.username} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                  : remoteUser.username.charAt(0).toUpperCase()
                }
              </div>
              <p className="call-status-text">{statusText}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="audio-call-display">
          <div className="call-avatar-large">
            {remoteUser.profile_pic
              ? <img src={avatarSrc} alt={remoteUser.username} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
              : remoteUser.username.charAt(0).toUpperCase()
            }
          </div>
          {isConnected && (
            <div className="sound-waves">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="wave-bar" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="call-info-overlay">
        <h3>{remoteUser.username}</h3>
        <p>{isConnected ? formatDuration(callDuration) : statusText}</p>
      </div>

      <div className="call-controls">
        <button className={`call-ctrl-btn ${isMuted ? 'ctrl-active' : ''}`} onClick={toggleMute} title={isMuted ? 'Unmute' : 'Mute'}>
          {isMuted ? <MdMicOff size={24} /> : <MdMic size={24} />}
        </button>
        {callType === 'video' && (
          <button className={`call-ctrl-btn ${isCameraOff ? 'ctrl-active' : ''}`} onClick={toggleCamera} title={isCameraOff ? 'Camera on' : 'Camera off'}>
            {isCameraOff ? <MdVideocamOff size={24} /> : <MdVideocam size={24} />}
          </button>
        )}
        <button className="call-ctrl-btn end-call-btn" onClick={handleEndCall} title="End call">
          <MdCallEnd size={24} />
        </button>
      </div>
    </div>
  );
}
