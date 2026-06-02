import { useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import axios from 'axios'
import UserList from './components/UserList'
import ChatWindow from './components/ChatWindow'
import MessageInput from './components/MessageInput'
import CallModal from './components/CallModal'
import CallWindow from './components/CallWindow'
import { MdVisibility, MdVisibilityOff, MdChatBubble, MdPerson, MdEmail, MdLock, MdCall } from 'react-icons/md'
import { FaGoogle, FaApple } from 'react-icons/fa'
import { playNotificationSound, playSentSound, startIncomingCallRing, startDialingSound, stopCallSound } from './utils/audio'

const SERVER_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') 
  ? `http://${window.location.hostname}:3000` 
  : '';

// Axios interceptor for JWT
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('samvad_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

function App() {
  const [currentUser, setCurrentUser] = useState(null)
  const [usernameInput, setUsernameInput] = useState('')
  const [emailInput, setEmailInput] = useState('')
  const [passwordInput, setPasswordInput] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoginMode, setIsLoginMode] = useState(true)
  const [socketInstance, setSocketInstance] = useState(null)
  const [toasts, setToasts] = useState([])

  // Request Notification Permissions on Startup
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const showInAppToast = (msg, sender) => {
    const id = Date.now();
    const newToast = {
      id,
      message: msg.content || 'Sent a media file',
      senderName: sender.username,
      senderId: sender.id,
      senderAvatar: sender.profile_pic
    };
    setToasts(prev => [...prev, newToast]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };
  
  const [selectedUser, setSelectedUser] = useState(null)
  const [users, setUsers] = useState([])
  const [messages, setMessages] = useState([])
  
  const [replyingTo, setReplyingTo] = useState(null)
  const [forwardingMessage, setForwardingMessage] = useState(null)
  const [isSidebarHidden, setIsSidebarHidden] = useState(false)
  const [typingUserId, setTypingUserId] = useState(null)
  const [viewingImageUrl, setViewingImageUrl] = useState(null)
  const [hasMoreMessages, setHasMoreMessages] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const lastTypingEmitRef = useRef(0)

  // Call state
  const [incomingCall, setIncomingCall] = useState(null)
  const [activeCall, setActiveCall] = useState(null)

  // Ref to always have the latest users list (avoids stale closure in socket handlers)
  const usersRef = useRef([])
  useEffect(() => { usersRef.current = users }, [users])

  // Persistent Auth
  useEffect(() => {
    const token = localStorage.getItem('samvad_token');
    if (token) {
      const verifyToken = async () => {
        try {
          const res = await axios.get(`${SERVER_URL}/api/auth/me`);
          setCurrentUser(res.data);
          const newSocket = io(SERVER_URL, {
            auth: { token: localStorage.getItem('samvad_token') }
          });
          setSocketInstance(newSocket);
          newSocket.emit('join', res.data.id);
        } catch (err) {
          console.error('Session expired', err);
          localStorage.removeItem('samvad_token');
        }
      };
      verifyToken();
    }
  }, []);

  const handleAuth = async (e) => {
    e.preventDefault()
    if (!passwordInput.trim()) return
    if (isLoginMode && !usernameInput.trim()) return 
    if (!isLoginMode && (!usernameInput.trim() || !emailInput.trim())) return

    try {
      const endpoint = isLoginMode ? '/api/login' : '/api/register'
      const payload = isLoginMode 
        ? { identifier: usernameInput, password: passwordInput }
        : { username: usernameInput, email: emailInput, password: passwordInput }
        
      const res = await axios.post(`${SERVER_URL}${endpoint}`, payload)
      const { user, token } = res.data;
      
      setCurrentUser(user)
      localStorage.setItem('samvad_token', token);
      
      const newSocket = io(SERVER_URL, {
        auth: { token: localStorage.getItem('samvad_token') }
      })
      setSocketInstance(newSocket)
      newSocket.emit('join', user.id)
    } catch (err) {
      console.error('Auth failed', err)
      alert(err.response?.data?.error || 'Authentication failed')
    }
  }

  // Fetch users and listen to socket events
  useEffect(() => {
    if (!currentUser || !socketInstance) return

    // Initial fetch - only friends
    const fetchFriends = async () => {
      try {
        const res = await axios.get(`${SERVER_URL}/api/friends`)
        setUsers(res.data)
      } catch (err) {
        console.error('Failed to load friends', err)
      }
    }
    fetchFriends()

    // Socket events
    socketInstance.on('user_status_change', ({ userId, online, last_seen }) => {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, online, last_seen } : u))
    })

    socketInstance.on('receive_message', (msg) => {
      setMessages(prev => [...prev, msg]);
      
      // Play native audio chime
      playNotificationSound();

      // Trigger standard/in-app notification check
      const isAppFocused = document.hasFocus();
      const isChattingWithSender = selectedUser && Number(selectedUser.id) === Number(msg.sender_id);

      if (!isAppFocused || !isChattingWithSender) {
        const sender = usersRef.current.find(u => Number(u.id) === Number(msg.sender_id));
        const senderName = sender ? sender.username : 'Someone';
        
        // Native browser desktop notification
        if ('Notification' in window && Notification.permission === 'granted') {
          const iconUrl = sender?.profile_pic 
            ? (sender.profile_pic.startsWith('http') ? sender.profile_pic : `${SERVER_URL}${sender.profile_pic}`)
            : 'https://api.dicebear.com/7.x/bottts/svg?seed=Samvad';
            
          const n = new Notification(`New message from ${senderName}`, {
            body: msg.content || 'Sent a media file',
            icon: iconUrl
          });
          
          n.onclick = () => {
            window.focus();
            if (sender) setSelectedUser(sender);
          };
        }

        // In-App Toast banner
        if (isAppFocused && sender) {
          showInAppToast(msg, sender);
        }
      }
    })

    socketInstance.on('user_deleted', ({ userId }) => {
      setUsers(prev => prev.filter(u => u.id !== userId))
      if (selectedUser?.id === userId) {
        setSelectedUser(null)
      }
    })

    socketInstance.on('message_deleted', ({ messageId }) => {
      setMessages(prev => prev.filter(m => m.id !== messageId))
    })

    socketInstance.on('message_sent', (realMsg) => {
      setMessages(prev => prev.map(m => {
        if (m.correlationId && m.correlationId === realMsg.correlationId) {
          return { ...realMsg, isOptimistic: false };
        }
        return m;
      }))
    })

    socketInstance.on('message_reaction', ({ messageId, reaction, react_user_id }) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reaction, react_user_id } : m))
    })

    socketInstance.on('user_typing', ({ userId }) => {
      setTypingUserId(userId)
    })

    socketInstance.on('user_stopped_typing', ({ userId }) => {
      if (typingUserId === userId) setTypingUserId(null)
    })

    socketInstance.on('messages_read', ({ receiver_id }) => {
      setMessages(prev => prev.map(m => m.receiver_id === receiver_id ? { ...m, status: 'read' } : m))
    })

    socketInstance.on('message_pinned', ({ messageId, isPinned }) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, is_pinned: isPinned } : m))
    })

    // ── Call Events ────────────────────────────────────
    socketInstance.on('incoming_call', ({ from, signal, callType }) => {
      startIncomingCallRing(); // Start looped ringtone
      const callerUser = usersRef.current.find(u => Number(u.id) === Number(from));
      if (!callerUser) {
        setIncomingCall({ from: Number(from), signal, callType, caller: { id: Number(from), username: 'Unknown' } });
        return;
      }
      setIncomingCall({ from: Number(from), signal, callType, caller: callerUser });
    });

    socketInstance.on('call_rejected', () => {
      stopCallSound(); // Stop dial/ring
      setActiveCall(null);
      alert('Call was rejected.');
    });

    socketInstance.on('call_ended', () => {
      stopCallSound(); // Stop dial/ring
      setActiveCall(null);
    });
    // ──────────────────────────────────────────────────

    return () => {
      socketInstance.off('user_status_change')
      socketInstance.off('receive_message')
      socketInstance.off('user_deleted')
      socketInstance.off('message_deleted')
      socketInstance.off('message_sent')
      socketInstance.off('message_reaction')
      socketInstance.off('user_typing')
      socketInstance.off('user_stopped_typing')
      socketInstance.off('message_pinned')
      socketInstance.off('messages_read')
      socketInstance.off('incoming_call')
      socketInstance.off('call_rejected')
      socketInstance.off('call_ended')
    }
  }, [currentUser, socketInstance, selectedUser, typingUserId])

  useEffect(() => {
    if (!currentUser || !selectedUser) return
    
    const fetchHistory = async () => {
      try {
        setHasMoreMessages(true)
        const res = await axios.get(`${SERVER_URL}/api/messages/${currentUser.id}/${selectedUser.id}?limit=30`)
        setMessages(res.data)
        if (res.data.length < 30) {
          setHasMoreMessages(false)
        }
        
        if (socketInstance) {
          socketInstance.emit('mark_messages_read', { sender_id: selectedUser.id, receiver_id: currentUser.id })
        }
      } catch (err) {
        console.error('Failed to load messages', err)
      }
    }
    fetchHistory()
  }, [currentUser, selectedUser, socketInstance])

  const handleLoadMoreMessages = async () => {
    if (loadingMore || !hasMoreMessages || !currentUser || !selectedUser) return;
    setLoadingMore(true);
    const oldestId = messages[0]?.id;
    if (!oldestId) {
      setLoadingMore(false);
      return;
    }

    try {
      const res = await axios.get(
        `${SERVER_URL}/api/messages/${currentUser.id}/${selectedUser.id}?beforeId=${oldestId}&limit=30`
      );
      if (res.data.length < 30) {
        setHasMoreMessages(false);
      }
      if (res.data.length > 0) {
        setMessages(prev => [...res.data, ...prev]);
      }
    } catch (err) {
      console.error('Failed to load older messages:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleSendMessage = (msgData) => {
    if (!socketInstance || !selectedUser) return
    
    const correlationId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newMsg = {
      sender_id: currentUser.id,
      receiver_id: selectedUser.id,
      content: msgData.content,
      type: msgData.type,
      file_url: msgData.file_url,
      reply_to: replyingTo?.id || null,
      is_forwarded: msgData.is_forwarded || false,
      correlationId: correlationId
    }
    
    socketInstance.emit('send_message', newMsg)
    playSentSound(); // Play Synthesized Sent Sound!
    
    const parentInfo = replyingTo ? {
      parent_content: replyingTo.content,
      parent_sender_name: replyingTo.sender_id === currentUser.id ? 'You' : (selectedUser.username)
    } : {};

    setMessages(prev => [...prev, {
      ...newMsg,
      ...parentInfo,
      id: Date.now(),
      timestamp: new Date().toISOString(),
      isOptimistic: true
    }])

    setReplyingTo(null)
  }

  const handleTyping = (isTyping) => {
    if (!socketInstance || !selectedUser) return;
    if (isTyping) {
      const now = Date.now();
      if (now - lastTypingEmitRef.current > 3000) {
        socketInstance.emit('typing', { receiver_id: selectedUser.id });
        lastTypingEmitRef.current = now;
      }
    } else {
      socketInstance.emit('stop_typing', { receiver_id: selectedUser.id });
      lastTypingEmitRef.current = 0; // Reset
    }
  }

  const handleDeleteAccount = async () => {
    if (!currentUser) return
    if (window.confirm('PERMANENTLY delete your account and all data? This cannot be undone.')) {
      try {
        await axios.delete(`${SERVER_URL}/api/users/${currentUser.id}`)
        handleLogout()
      } catch (err) {
        alert('Failed to delete account')
      }
    }
  }

  const handleLogout = () => {
    setCurrentUser(null);
    setSocketInstance(null);
    setSelectedUser(null);
    localStorage.removeItem('samvad_token');
  }

  const handleDeleteMessage = async (messageId, type) => {
    setMessages(prev => prev.filter(m => m.id !== messageId));
    try {
      await axios.post(`${SERVER_URL}/api/messages/${messageId}/delete`, {
        userId: currentUser.id,
        type: type 
      });
    } catch (err) {
      console.error('Background delete failed:', err);
    }
  }

  const handleReactMessage = (messageId, reaction) => {
    if (!socketInstance || !selectedUser) return;
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reaction, react_user_id: reaction ? currentUser.id : null } : m));
    socketInstance.emit('react_message', { messageId, reaction, receiver_id: selectedUser.id });
  }

  const handlePinMessage = (messageId, isPinned) => {
    if (!socketInstance || !selectedUser) return;
    socketInstance.emit('pin_message', { messageId, isPinned, receiver_id: selectedUser.id });
  }

  const handleForward = (userId) => {
    if (!forwardingMessage || !socketInstance) return;
    const correlationId = `${Date.now()}-fw-${Math.random().toString(36).substr(2, 9)}`;
    const forwardedMsg = {
      sender_id: currentUser.id,
      receiver_id: userId,
      content: forwardingMessage.content,
      type: forwardingMessage.type,
      file_url: forwardingMessage.file_url,
      is_forwarded: true,
      correlationId: correlationId
    };
    socketInstance.emit('send_message', forwardedMsg);
    if (selectedUser?.id === userId) {
      setMessages(prev => [...prev, { ...forwardedMsg, id: Date.now(), timestamp: new Date().toISOString(), isOptimistic: true }]);
    }
    setForwardingMessage(null);
    alert('Message forwarded!');
  }

  const handleDeleteSpecificUser = async (userId, targetUsername) => {
    if (window.confirm(`PERMANENTLY delete account "${targetUsername}" and all their data? This cannot be undone.`)) {
      try {
        await axios.delete(`${SERVER_URL}/api/users/${userId}`);
      } catch (err) {
        alert('Failed to delete specific account');
      }
    }
  }

  const handleCameraUpload = async (file) => {
    if (!selectedUser) {
      alert('Please select a chat first to send a photo.')
      return
    }
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await axios.post(`${SERVER_URL}/api/upload`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      const { url, type } = res.data
      let msgType = 'file'
      if (type.startsWith('image/')) msgType = 'image'
      else if (type.startsWith('audio/')) msgType = 'audio'
      else if (type.startsWith('video/')) msgType = 'video'
      handleSendMessage({ content: file.name, type: msgType, file_url: url })
    } catch (err) {
      console.error('Camera upload failed', err)
      alert('Failed to upload camera photo.')
    }
  }

  const handleProfileUpdate = async (formData) => {
    try {
      const res = await axios.put(`${SERVER_URL}/api/users/${currentUser.id}/profile`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      setCurrentUser(res.data)
      alert('Profile updated successfully!')
    } catch (err) {
      console.error('Profile update failed', err)
      alert('Failed to update profile.')
    }
  }

  const handleAddFriend = async (friendId) => {
    try {
      await axios.post(`${SERVER_URL}/api/friends/add`, { friendId });
      const res = await axios.get(`${SERVER_URL}/api/friends`);
      setUsers(res.data);
      alert('Friend added!');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to add friend');
    }
  }

  // ── Call Handlers ──────────────────────────────────────────────
  const handleStartCall = (callType) => {
    if (!selectedUser || !socketInstance) return;
    if (!selectedUser.online) {
      alert(`${selectedUser.username} is offline. You can only call online users.`);
      return;
    }
    startDialingSound(); // Play dialing hums
    setActiveCall({ remoteUser: selectedUser, callType, isInitiator: true, signal: null });
  };

  const handleAcceptCall = () => {
    if (!incomingCall) return;
    stopCallSound(); // Stop ringtone
    setActiveCall({
      remoteUser: incomingCall.caller,
      callType: incomingCall.callType,
      isInitiator: false,
      signal: incomingCall.signal
    });
    setIncomingCall(null);
  };

  const handleRejectCall = () => {
    if (!incomingCall || !socketInstance) return;
    stopCallSound(); // Stop ringtone
    socketInstance.emit('reject_call', { to: incomingCall.from });
    setIncomingCall(null);
  };

  const handleEndCall = () => {
    stopCallSound(); // Stop dial/ring
    setActiveCall(null);
  };
  // ──────────────────────────────────────────────────────────────

  if (!currentUser) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <div className="login-header">
            <h1 className="brand-title">Samvad App</h1>
            <div className="app-logo">
              <div className="css-chat-bubble">
                <MdCall className="bubble-icon" />
                <div className="bubble-tail"></div>
              </div>
            </div>
            <h2>{isLoginMode ? 'Welcome Back' : 'Create Account'}</h2>
            <p className="subtitle">{isLoginMode ? 'Enter your details to continue chatting' : 'Join our secure messaging platform'}</p>
          </div>

          <form onSubmit={handleAuth} className="input-group">
            <div className="input-wrapper">
              <MdPerson className="input-icon" />
              <input 
                type="text" 
                className="input-field" 
                placeholder={isLoginMode ? "Email, Username or samvadId" : "Enter Username"} 
                value={usernameInput}
                onChange={e => setUsernameInput(e.target.value)}
                autoFocus
              />
            </div>

            {!isLoginMode && (
              <div className="input-wrapper">
                <MdEmail className="input-icon" />
                <input 
                  type="email" 
                  className="input-field" 
                  placeholder="Enter Email Address" 
                  value={emailInput}
                  onChange={e => setEmailInput(e.target.value)}
                />
              </div>
            )}

            <div className="input-wrapper">
              <MdLock className="input-icon" />
              <input 
                type={showPassword ? "text" : "password"}  
                className="input-field" 
                placeholder="Enter Password" 
                value={passwordInput}
                onChange={e => setPasswordInput(e.target.value)}
              />
              <div className="password-toggle-icon" onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? <MdVisibilityOff size={18} /> : <MdVisibility size={18} />}
              </div>
            </div>

            {isLoginMode && (
              <div className="auth-secondary">
                <label className="checkbox-label">
                  <input type="checkbox" /> Remember me
                </label>
                <span className="forgot-link">Forgot Password?</span>
              </div>
            )}

            <button type="submit" className="primary-btn">
              {isLoginMode ? 'Sign In' : 'Get Started'}
            </button>
          </form>

          <div className="auth-footer">
            <p>
              {isLoginMode ? "Don't have an account?" : "Already have an account?"}
              <span className="toggle-link" onClick={() => setIsLoginMode(!isLoginMode)}>
                {isLoginMode ? ' Sign Up' : ' Sign In'}
              </span>
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app-container">
      <div className={`user-list-sidebar ${selectedUser ? 'mobile-hide' : ''} ${isSidebarHidden ? 'desktop-hide' : ''}`}>
        <UserList 
          currentUser={currentUser} 
          users={users} 
          selectedUser={selectedUser}
          onSelectUser={setSelectedUser} 
          onDeleteAccount={handleDeleteAccount}
          onLogout={handleLogout}
          onDeleteSpecificUser={handleDeleteSpecificUser}
          onCameraClick={handleCameraUpload}
          onProfileUpdate={handleProfileUpdate}
          serverUrl={SERVER_URL}
          onViewImage={setViewingImageUrl}
          onAddFriend={handleAddFriend}
        />
      </div>
      
      <div className={`chat-window-container ${!selectedUser ? 'mobile-hide' : 'mobile-show'}`}>
        <ChatWindow 
          currentUser={currentUser}
          selectedUser={selectedUser}
          messages={messages}
          onSendMessage={handleSendMessage}
          serverUrl={SERVER_URL}
          onBack={() => setSelectedUser(null)}
          onClearChat={() => setMessages([])}
          onDeleteMessage={handleDeleteMessage}
          onReactMessage={handleReactMessage}
          onPinMessage={handlePinMessage}
          onReplyMessage={setReplyingTo}
          onForwardMessage={setForwardingMessage}
          isSidebarHidden={isSidebarHidden}
          onToggleSidebar={() => setIsSidebarHidden(!isSidebarHidden)}
          isTyping={typingUserId === selectedUser?.id}
          onViewImage={setViewingImageUrl}
          onStartCall={handleStartCall}
          hasMoreMessages={hasMoreMessages}
          loadingMore={loadingMore}
          onLoadMoreMessages={handleLoadMoreMessages}
        />
        {selectedUser && (
          <MessageInput 
            onSendMessage={handleSendMessage} 
            serverUrl={SERVER_URL} 
            replyingTo={replyingTo}
            onCancelReply={() => setReplyingTo(null)}
            onTyping={handleTyping}
          />
        )}
      </div>

      {forwardingMessage && (
        <div className="forward-modal-overlay" onClick={() => setForwardingMessage(null)}>
          <div className="forward-modal" onClick={e => e.stopPropagation()}>
            <h3>Forward to...</h3>
            <div className="forward-user-list">
              {users.map(u => (
                <div key={u.id} className="forward-user-item" onClick={() => handleForward(u.id)}>
                   <div className="user-avatar" style={{width: '32px', height: '32px', fontSize: '0.9rem', marginRight: '10px'}}>
                     {u.username.charAt(0).toUpperCase()}
                   </div>
                   <span>{u.username}</span>
                </div>
              ))}
            </div>
            <button className="cancel-btn" onClick={() => setForwardingMessage(null)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Incoming Call Modal */}
      {incomingCall && !activeCall && (
        <CallModal
          caller={incomingCall.caller}
          callType={incomingCall.callType}
          onAccept={handleAcceptCall}
          onReject={handleRejectCall}
        />
      )}

      {/* Active Call Window */}
      {activeCall && socketInstance && (
        <CallWindow
          currentUser={currentUser}
          remoteUser={activeCall.remoteUser}
          callType={activeCall.callType}
          isInitiator={activeCall.isInitiator}
          socket={socketInstance}
          incomingSignal={activeCall.signal}
          onEndCall={handleEndCall}
        />
      )}

      {viewingImageUrl && (
        <div className="image-viewer-overlay" onClick={() => setViewingImageUrl(null)}>
          <div className="image-viewer-close" onClick={(e) => { e.stopPropagation(); setViewingImageUrl(null); }}>&times;</div>
          <img 
            src={viewingImageUrl} 
            alt="full screen" 
            onClick={(e) => e.stopPropagation()} 
          />
        </div>
      )}

      {/* In-app glassmorphic notifications */}
      <div className="in-app-toast-container">
        {toasts.map(t => (
          <div key={t.id} className="in-app-toast" onClick={() => {
            const senderUser = users.find(u => Number(u.id) === Number(t.senderId));
            if (senderUser) setSelectedUser(senderUser);
            setToasts(prev => prev.filter(toast => toast.id !== t.id));
          }}>
            <div className="toast-avatar">
              {t.senderAvatar ? (
                <img src={t.senderAvatar.startsWith('http') ? t.senderAvatar : `${SERVER_URL}${t.senderAvatar}`} alt="" />
              ) : (
                t.senderName.charAt(0).toUpperCase()
              )}
            </div>
            <div className="toast-details">
              <h4>{t.senderName}</h4>
              <p>{t.message}</p>
            </div>
            <div className="toast-close" onClick={(e) => { e.stopPropagation(); setToasts(prev => prev.filter(toast => toast.id !== t.id)); }}>&times;</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default App
