import React, { useEffect, useRef, useState } from 'react';
import { MdMic, MdMicOff, MdVideocam, MdVideocamOff, MdCallEnd, MdVolumeUp } from 'react-icons/md';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]
};

export default function CallWindow({ remoteUser, callType, isInitiator, socket, incomingSignal, onEndCall }) {
  const localVideoRef  = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const peerRef        = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const iceQueue       = useRef([]);
  const remoteDescReady= useRef(false);
  const cleanedUp      = useRef(false);
  const iceHandler     = useRef(null);
  const acceptHandler  = useRef(null);

  const [isMuted,     setIsMuted]     = useState(false);
  const [camOff,      setCamOff]      = useState(false);
  const [duration,    setDuration]    = useState(0);
  const [connected,   setConnected]   = useState(false);
  const [status,      setStatus]      = useState(isInitiator ? 'Ringing...' : 'Connecting...');
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  useEffect(() => { startCall(); return () => cleanup(); }, []);

  useEffect(() => {
    if (!connected) return;
    const t = setInterval(() => setDuration(d => d + 1), 1000);
    return () => clearInterval(t);
  }, [connected]);

  const flushQueue = async (peer) => {
    for (const c of iceQueue.current.splice(0)) {
      try { await peer.addIceCandidate(new RTCIceCandidate(c)); } catch (_) {}
    }
  };

  const playRemote = () => {
    const s = remoteStreamRef.current;
    if (!s) return;

    if (callType === 'video' && remoteVideoRef.current) {
      if (remoteVideoRef.current.srcObject !== s) {
        remoteVideoRef.current.srcObject = s;
      }
      remoteVideoRef.current.play().catch(err => {
        if (err.name === 'NotAllowedError') setAutoplayBlocked(true);
      });
    }
    
    if (remoteAudioRef.current) {
      if (remoteAudioRef.current.srcObject !== s) {
        remoteAudioRef.current.srcObject = s;
      }
      remoteAudioRef.current.play().catch(err => {
        if (err.name === 'NotAllowedError') setAutoplayBlocked(true);
      });
    }
  };

  const handleResumeAudio = () => {
    setAutoplayBlocked(false);
    if (remoteVideoRef.current) remoteVideoRef.current.play().catch(() => {});
    if (remoteAudioRef.current) remoteAudioRef.current.play().catch(() => {});
  };

  const startCall = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === 'video'
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const peer = new RTCPeerConnection(ICE_SERVERS);
      peerRef.current = peer;
      stream.getTracks().forEach(t => peer.addTrack(t, stream));

      peer.ontrack = (e) => {
        if (!remoteStreamRef.current) {
          remoteStreamRef.current = e.streams[0] || new MediaStream([e.track]);
        } else {
          if (!remoteStreamRef.current.getTracks().find(t => t.id === e.track.id)) {
            remoteStreamRef.current.addTrack(e.track);
          }
        }
        playRemote();
        setConnected(true);
        setStatus('');
      };

      peer.onicecandidate = (e) => {
        if (e.candidate && !cleanedUp.current) {
          socket.emit('ice_candidate', { to: remoteUser.id, candidate: e.candidate });
        }
      };

      peer.onconnectionstatechange = () => {
        if ((peer.connectionState === 'disconnected' || peer.connectionState === 'failed') && !cleanedUp.current) {
          cleanup(); onEndCall();
        }
      };

      const onIce = async ({ candidate }) => {
        if (!candidate || cleanedUp.current) return;
        if (remoteDescReady.current) {
          try { await peer.addIceCandidate(new RTCIceCandidate(candidate)); } catch (_) {}
        } else {
          iceQueue.current.push(candidate);
        }
      };
      iceHandler.current = onIce;
      socket.on('ice_candidate', onIce);

      if (isInitiator) {
        const offer = await peer.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: callType === 'video' });
        await peer.setLocalDescription(offer);
        socket.emit('call_user', { to: remoteUser.id, signal: offer, callType });

        const onAccepted = async ({ signal }) => {
          if (cleanedUp.current) return;
          await peer.setRemoteDescription(new RTCSessionDescription(signal));
          remoteDescReady.current = true;
          await flushQueue(peer);
        };
        acceptHandler.current = onAccepted;
        socket.once('call_accepted', onAccepted);
      } else {
        await peer.setRemoteDescription(new RTCSessionDescription(incomingSignal));
        remoteDescReady.current = true;
        await flushQueue(peer);
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        socket.emit('accept_call', { to: remoteUser.id, signal: answer });
      }
    } catch (err) {
      if (err.name === 'NotAllowedError') alert('Microphone/camera permission denied.');
      else alert('Call failed: ' + err.message);
      if (!cleanedUp.current) onEndCall();
    }
  };

  const cleanup = () => {
    if (cleanedUp.current) return;
    cleanedUp.current = true;
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    peerRef.current?.close();
    if (iceHandler.current)    socket.off('ice_candidate', iceHandler.current);
    if (acceptHandler.current) socket.off('call_accepted', acceptHandler.current);
  };

  const handleEnd = () => { socket.emit('end_call', { to: remoteUser.id }); cleanup(); onEndCall(); };
  const toggleMute = () => { const t = localStreamRef.current?.getAudioTracks()[0]; if (t) { t.enabled = !t.enabled; setIsMuted(m => !m); } };
  const toggleCam  = () => { const t = localStreamRef.current?.getVideoTracks()[0];  if (t) { t.enabled = !t.enabled; setCamOff(c => !c); } };
  const fmt = s => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;

  const avatar = remoteUser.profile_pic
    ? <img src={remoteUser.profile_pic} alt="" style={{ width:'100%',height:'100%',borderRadius:'50%',objectFit:'cover' }} />
    : remoteUser.username.charAt(0).toUpperCase();

  return (
    <div className="call-window">
      <audio ref={remoteAudioRef} autoPlay playsInline muted={false} style={{ position:'absolute', width:0, height:0, opacity:0, pointerEvents: 'none' }} />

      {callType === 'video' ? (
        <div className="video-container">
          <video ref={remoteVideoRef} autoPlay playsInline muted={false} className="remote-video" />
          <video ref={localVideoRef}  autoPlay playsInline muted className="local-video" />
          {!connected && (
            <div className="video-connecting-overlay">
              <div className="call-avatar-large">{avatar}</div>
              <p className="call-status-text">{status}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="audio-call-display">
          <div className="call-avatar-large">{avatar}</div>
          {connected && (
            <div className="sound-waves">
              {[...Array(5)].map((_, i) => <div key={i} className="wave-bar" style={{ animationDelay:`${i*0.15}s` }} />)}
            </div>
          )}
        </div>
      )}

      {autoplayBlocked && (
        <div className="autoplay-blocked-overlay" onClick={handleResumeAudio}>
          <div className="autoplay-blocked-card">
            <MdVolumeUp size={48} color="#8b5cf6" />
            <p>Click to join audio</p>
          </div>
        </div>
      )}

      <div className="call-info-overlay">
        <h3>{remoteUser.username}</h3>
        <p>{connected ? fmt(duration) : status}</p>
      </div>

      <div className="call-controls">
        <button className={`call-ctrl-btn ${isMuted ? 'ctrl-active' : ''}`} onClick={toggleMute}>
          {isMuted ? <MdMicOff size={24} /> : <MdMic size={24} />}
        </button>
        {callType === 'video' && (
          <button className={`call-ctrl-btn ${camOff ? 'ctrl-active' : ''}`} onClick={toggleCam}>
            {camOff ? <MdVideocamOff size={24} /> : <MdVideocam size={24} />}
          </button>
        )}
        <button className="call-ctrl-btn end-call-btn" onClick={handleEnd}>
          <MdCallEnd size={24} />
        </button>
      </div>
    </div>
  );
}
