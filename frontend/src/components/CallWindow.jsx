import React, { useEffect, useRef, useState } from 'react';
import { MdMic, MdMicOff, MdVideocam, MdVideocamOff, MdCallEnd } from 'react-icons/md';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]
};

export default function CallWindow({ currentUser, remoteUser, callType, isInitiator, socket, incomingSignal, onEndCall }) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const iceCandidatesQueue = useRef([]);

  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [status, setStatus] = useState('Connecting...');

  useEffect(() => {
    initCall();
    return () => cleanup();
  }, []);

  // Call duration timer
  useEffect(() => {
    if (!isConnected) return;
    const interval = setInterval(() => setCallDuration(d => d + 1), 1000);
    return () => clearInterval(interval);
  }, [isConnected]);

  const initCall = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === 'video'
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const peer = new RTCPeerConnection(ICE_SERVERS);
      peerRef.current = peer;

      stream.getTracks().forEach(track => peer.addTrack(track, stream));

      peer.ontrack = (event) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
          setIsConnected(true);
          setStatus('');
        }
      };

      peer.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('ice_candidate', { to: remoteUser.id, candidate: event.candidate });
        }
      };

      peer.onconnectionstatechange = () => {
        if (peer.connectionState === 'disconnected' || peer.connectionState === 'failed') {
          handleEndCall();
        }
      };

      // ICE candidates listener
      const handleIceCandidate = async ({ candidate }) => {
        try {
          if (peer.remoteDescription) {
            await peer.addIceCandidate(new RTCIceCandidate(candidate));
          } else {
            iceCandidatesQueue.current.push(candidate);
          }
        } catch (err) {
          console.error('ICE error:', err);
        }
      };
      socket.on('ice_candidate', handleIceCandidate);

      if (isInitiator) {
        // Caller: create offer
        const offer = await peer.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: callType === 'video' });
        await peer.setLocalDescription(offer);
        socket.emit('call_user', { to: remoteUser.id, signal: offer, callType });

        // Wait for answer
        socket.once('call_accepted', async ({ signal }) => {
          await peer.setRemoteDescription(new RTCSessionDescription(signal));
          // Flush queued ICE candidates
          for (const c of iceCandidatesQueue.current) {
            await peer.addIceCandidate(new RTCIceCandidate(c));
          }
          iceCandidatesQueue.current = [];
        });
      } else {
        // Callee: set remote description from offer
        await peer.setRemoteDescription(new RTCSessionDescription(incomingSignal));
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        socket.emit('accept_call', { to: remoteUser.id, signal: answer });

        // Flush queued ICE candidates
        for (const c of iceCandidatesQueue.current) {
          await peer.addIceCandidate(new RTCIceCandidate(c));
        }
        iceCandidatesQueue.current = [];
      }

    } catch (err) {
      console.error('Call error:', err);
      alert('Could not access camera/microphone. Please check permissions.');
      onEndCall();
    }
  };

  const cleanup = () => {
    if (localStreamRef.current) localStreamRef.current.getTracks().forEach(t => t.stop());
    if (peerRef.current) peerRef.current.close();
    socket.off('ice_candidate');
    socket.off('call_accepted');
  };

  const handleEndCall = () => {
    socket.emit('end_call', { to: remoteUser.id });
    cleanup();
    onEndCall();
  };

  const toggleMute = () => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) { track.enabled = !track.enabled; setIsMuted(m => !m); }
  };

  const toggleCamera = () => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (track) { track.enabled = !track.enabled; setIsCameraOff(c => !c); }
  };

  const formatDuration = (s) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  return (
    <div className="call-window">
      {callType === 'video' ? (
        <div className="video-container">
          <video ref={remoteVideoRef} autoPlay playsInline className="remote-video" />
          <video ref={localVideoRef} autoPlay playsInline muted className="local-video" />
          {!isConnected && (
            <div className="video-connecting-overlay">
              <div className="call-avatar-large">
                {remoteUser.profile_pic
                  ? <img src={remoteUser.profile_pic.startsWith('http') ? remoteUser.profile_pic : remoteUser.profile_pic} alt={remoteUser.username} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                  : remoteUser.username.charAt(0).toUpperCase()
                }
              </div>
              <p className="call-status-text">Connecting video...</p>
            </div>
          )}
        </div>
      ) : (
        <div className="audio-call-display">
          <div className="call-avatar-large">
            {remoteUser.profile_pic
              ? <img src={remoteUser.profile_pic.startsWith('http') ? remoteUser.profile_pic : remoteUser.profile_pic} alt={remoteUser.username} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
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
        <p>{isConnected ? formatDuration(callDuration) : status || 'Calling...'}</p>
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
