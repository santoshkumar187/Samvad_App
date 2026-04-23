import React, { useEffect } from 'react';
import { MdCall, MdCallEnd, MdVideocam } from 'react-icons/md';

export default function CallModal({ caller, callType, onAccept, onReject }) {
  // Auto-reject after 30 seconds (missed call)
  useEffect(() => {
    const timeout = setTimeout(() => {
      onReject();
    }, 30000);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <div className="call-modal-overlay">
      <div className="call-modal">
        <div className="call-modal-avatar-wrap">
          <div className="call-modal-avatar">
            {caller.profile_pic ? (
              <img
                src={caller.profile_pic.startsWith('http') ? caller.profile_pic : caller.profile_pic}
                alt={caller.username}
                style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : (
              caller.username.charAt(0).toUpperCase()
            )}
          </div>
          <div className="ringing-ring ring-1" />
          <div className="ringing-ring ring-2" />
          <div className="ringing-ring ring-3" />
        </div>

        <h3 className="call-modal-name">{caller.username}</h3>
        <p className="call-modal-type">
          {callType === 'video' ? (
            <><MdVideocam size={16} style={{ marginRight: 4 }} />Incoming video call</>
          ) : (
            <><MdCall size={16} style={{ marginRight: 4 }} />Incoming audio call</>
          )}
        </p>

        <div className="call-modal-actions">
          <button className="call-action-btn reject" onClick={onReject} title="Reject">
            <MdCallEnd size={28} />
          </button>
          <button className="call-action-btn accept" onClick={onAccept} title="Accept">
            <MdCall size={28} />
          </button>
        </div>
      </div>
    </div>
  );
}
