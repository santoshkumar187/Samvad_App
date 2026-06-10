import { useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import axios from 'axios'
import UserList from './components/UserList'
import ChatWindow from './components/ChatWindow'
import MessageInput from './components/MessageInput'
import CallModal from './components/CallModal'
import CallWindow from './components/CallWindow'
import { MdVisibility, MdVisibilityOff, MdChatBubble, MdPerson, MdEmail, MdLock, MdCall, MdHelpOutline, MdRefresh, MdShield } from 'react-icons/md'
import { FaGoogle, FaApple } from 'react-icons/fa'
import { playNotificationSound, playSentSound, startIncomingCallRing, startDialingSound, stopCallSound } from './utils/audio'

const SERVER_URL = (
  window.location.hostname === 'localhost' || 
  window.location.hostname === '127.0.0.1' || 
  /^192\.168\./.test(window.location.hostname) || 
  /^10\./.test(window.location.hostname) || 
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(window.location.hostname)
) 
  ? `${window.location.protocol}//${window.location.hostname}:3000` 
  : 'https://samvad-app-2bdl.onrender.com';

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
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('samvad_user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });
  const [usernameInput, setUsernameInput] = useState('')
  const [emailInput, setEmailInput] = useState('')
  const [passwordInput, setPasswordInput] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoginMode, setIsLoginMode] = useState(true)
  const [socketInstance, setSocketInstance] = useState(null)
  const [toasts, setToasts] = useState([])

  const [usernameAvailable, setUsernameAvailable] = useState(null)
  const [emailAvailable, setEmailAvailable] = useState(null)
  const [usernameChecking, setUsernameChecking] = useState(false)
  const [emailChecking, setEmailChecking] = useState(false)
  // Forgot password state
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [forgotIdentifier, setForgotIdentifier] = useState('')
  const [forgotNewPassword, setForgotNewPassword] = useState('')
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('')
  const [captchaCode, setCaptchaCode] = useState('')
  const [captchaInput, setCaptchaInput] = useState('')
  const [forgotError, setForgotError] = useState('')
  const [forgotSuccess, setForgotSuccess] = useState('')

  const generateCaptcha = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setCaptchaCode(result);
    setCaptchaInput('');
  };

  useEffect(() => {
    if (showForgotPassword) {
      generateCaptcha();
      setForgotIdentifier('');
      setForgotAnswer('');
      setForgotNewPassword('');
      setForgotConfirmPassword('');
      setForgotError('');
      setForgotSuccess('');
    }
  }, [showForgotPassword]);

  // Debounced check availability for username
  useEffect(() => {
    if (isLoginMode || !usernameInput.trim()) {
      setUsernameAvailable(null);
      return;
    }
    setUsernameChecking(true);
    const delayDebounce = setTimeout(async () => {
      try {
        const res = await axios.get(`${SERVER_URL}/api/check-availability?username=${encodeURIComponent(usernameInput.trim())}`);
        setUsernameAvailable(res.data.available);
      } catch (err) {
        console.error(err);
      } finally {
        setUsernameChecking(false);
      }
    }, 500);

    return () => clearTimeout(delayDebounce);
  }, [usernameInput, isLoginMode]);

  // Debounced check availability for email
  useEffect(() => {
    if (isLoginMode || !emailInput.trim()) {
      setEmailAvailable(null);
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailInput.trim())) {
      setEmailAvailable(false);
      return;
    }
    setEmailChecking(true);
    const delayDebounce = setTimeout(async () => {
      try {
        const res = await axios.get(`${SERVER_URL}/api/check-availability?email=${encodeURIComponent(emailInput.trim())}`);
        setEmailAvailable(res.data.available);
      } catch (err) {
        console.error(err);
      } finally {
        setEmailChecking(false);
      }
    }, 500);

    return () => clearTimeout(delayDebounce);
  }, [emailInput, isLoginMode]);

  const getPasswordStrength = (pass) => {
    if (!pass) return { score: 0, label: '', color: 'transparent' };
    let score = 0;
    if (pass.length >= 8) score += 1;
    if (/[A-Z]/.test(pass)) score += 1;
    if (/[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;
    
    if (pass.length < 6) {
      return { score: 1, label: 'Too Short', color: '#ef4444' };
    }
    if (score <= 1) return { score: 1, label: 'Weak', color: '#ef4444' };
    if (score === 2) return { score: 2, label: 'Fair', color: '#f97316' };
    if (score === 3) return { score: 3, label: 'Good', color: '#eab308' };
    return { score: 4, label: 'Strong', color: '#22c55e' };
  };

  const handleForgotPasswordReset = async (e) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess('');

    if (!forgotIdentifier.trim() || !forgotNewPassword.trim() || !forgotConfirmPassword.trim()) {
      setForgotError('Please fill in all fields');
      return;
    }

    if (captchaInput.toUpperCase().trim() !== captchaCode) {
      setForgotError('Invalid CAPTCHA code');
      generateCaptcha();
      return;
    }

    if (forgotNewPassword.length < 8) {
      setForgotError('Password must be at least 8 characters');
      return;
    }

    if (forgotNewPassword !== forgotConfirmPassword) {
      setForgotError('Passwords do not match');
      return;
    }

    try {
      const res = await axios.post(`${SERVER_URL}/api/forgot-password/reset`, {
        identifier: forgotIdentifier,
        newPassword: forgotNewPassword
      });
      if (res.data.success) {
        setForgotSuccess('Password reset successfully!');
        setTimeout(() => {
          setShowForgotPassword(false);
        }, 2000);
      }
    } catch (err) {
      setForgotError(err.response?.data?.error || 'Failed to reset password');
      generateCaptcha();
    }
  };

  const renderCaptchaDisplay = () => {
    return (
      <div className="captcha-display-box" onClick={generateCaptcha} title="Click to refresh CAPTCHA">
        <div className="captcha-noise-line-1"></div>
        <div className="captcha-noise-line-2"></div>
        {captchaCode.split('').map((char, index) => {
          const rotation = (index % 2 === 0 ? 1 : -1) * (10 + (index * 5) % 15);
          const offset = (index * 3) % 7 - 3;
          const randomColor = `hsl(${(index * 60) % 360}, 70%, 75%)`;
          return (
            <span 
              key={index} 
              style={{
                transform: `rotate(${rotation}deg) translateY(${offset}px)`,
                color: randomColor,
                display: 'inline-block',
                margin: '0 4px',
                fontWeight: 'bold',
                fontSize: '1.4rem',
                fontFamily: 'monospace',
                textShadow: '1px 1px 2px rgba(0,0,0,0.5)'
              }}
            >
              {char}
            </span>
          );
        })}
      </div>
    );
  };

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
      senderName: sender.username || sender.name || 'Someone',
      senderId: sender.id,
      senderAvatar: sender.profile_pic,
      isGroup: sender.isGroup
    };
    setToasts(prev => [...prev, newToast]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };
  
  const [selectedUser, setSelectedUser] = useState(null)
  const [users, setUsers] = useState([])
  const [messages, setMessages] = useState([])
  const [isBlocked, setIsBlocked] = useState(false)
  
  useEffect(() => {
    if (!selectedUser) {
      setIsBlocked(false);
      return;
    }
    const chatKey = selectedUser.isGroup ? `group_${selectedUser.id}` : `user_${selectedUser.id}`;
    setIsBlocked(localStorage.getItem(`samvad_blocked_${chatKey}`) === 'true');
  }, [selectedUser]);
  
  const [replyingTo, setReplyingTo] = useState(null)
  const [forwardingMessage, setForwardingMessage] = useState(null)
  const [isSidebarHidden, setIsSidebarHidden] = useState(false)
  const [typingUserId, setTypingUserId] = useState(null)
  const [groupTyping, setGroupTyping] = useState({})
  const [viewingImageUrl, setViewingImageUrl] = useState(null)
  const [hasMoreMessages, setHasMoreMessages] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const lastTypingEmitRef = useRef(0)

  // Call state
  const [incomingCall, setIncomingCall] = useState(null)
  const [activeCall, setActiveCall] = useState(null)

  // Sidebar draggable resizing state and handling
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    return Number(localStorage.getItem('samvad_sidebar_width')) || 300;
  });
  const [isResizing, setIsResizing] = useState(false);

  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e) => {
      const newWidth = Math.max(260, Math.min(500, e.clientX));
      setSidebarWidth(newWidth);
      localStorage.setItem('samvad_sidebar_width', newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Ensure sidebar is shown again if no chat is selected (e.g. back navigation)
  useEffect(() => {
    if (!selectedUser) {
      setIsSidebarHidden(false);
    }
  }, [selectedUser]);

  // Ref to always have the latest users list (avoids stale closure in socket handlers)
  const usersRef = useRef([])
  useEffect(() => { usersRef.current = users }, [users])

  // Persistent Auth & Immediate Socket Connection from Local Cache
  useEffect(() => {
    const token = localStorage.getItem('samvad_token');
    const savedUserStr = localStorage.getItem('samvad_user');
    
    if (token && savedUserStr) {
      try {
        const savedUser = JSON.parse(savedUserStr);
        // Connect socket immediately using the cached user details
        const newSocket = io(SERVER_URL, {
          auth: { token }
        });
        setSocketInstance(newSocket);
        newSocket.emit('join', savedUser.id);
      } catch (e) {
        console.error('Failed to parse cached user for socket:', e);
      }
    }

    if (token) {
      const verifyToken = async () => {
        try {
          const res = await axios.get(`${SERVER_URL}/api/auth/me`);
          setCurrentUser(res.data);
          localStorage.setItem('samvad_user', JSON.stringify(res.data));
          
          setSocketInstance(prev => {
            if (!prev) {
              const newSocket = io(SERVER_URL, {
                auth: { token }
              });
              newSocket.emit('join', res.data.id);
              return newSocket;
            }
            return prev;
          });
        } catch (err) {
          console.error('Session expired', err);
          localStorage.removeItem('samvad_token');
          localStorage.removeItem('samvad_user');
          setCurrentUser(null);
          setSocketInstance(prev => {
            if (prev) prev.disconnect();
            return null;
          });
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

    if (!isLoginMode) {
      const strength = getPasswordStrength(passwordInput);
      if (strength.score < 2) {
        alert('Password is too weak. It must be at least 6 characters and should be stronger.');
        return;
      }
      if (usernameAvailable === false) {
        alert('Username is already taken.');
        return;
      }
      if (emailAvailable === false) {
        alert('Email is already taken or invalid.');
        return;
      }
    }

    try {
      const endpoint = isLoginMode ? '/api/login' : '/api/register'
      const payload = isLoginMode 
        ? { identifier: usernameInput.trim(), password: passwordInput }
        : { 
            username: usernameInput.trim(), 
            email: emailInput.trim(), 
            password: passwordInput
          }
        
      const res = await axios.post(`${SERVER_URL}${endpoint}`, payload)
      const { user, token } = res.data;
      
      setCurrentUser(user)
      localStorage.setItem('samvad_user', JSON.stringify(user));
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

    // Initial fetch - friends and groups
    const fetchChats = async () => {
      try {
        const [friendsRes, groupsRes] = await Promise.all([
          axios.get(`${SERVER_URL}/api/friends`),
          axios.get(`${SERVER_URL}/api/groups`)
        ]);
        const merged = [...friendsRes.data, ...groupsRes.data];
        
        merged.sort((a, b) => {
          const pinA = a.is_pinned ? 1 : 0;
          const pinB = b.is_pinned ? 1 : 0;
          if (pinA !== pinB) return pinB - pinA;
          
          const isAiA = a.samvad_id === 'ai#9999' ? 1 : 0;
          const isAiB = b.samvad_id === 'ai#9999' ? 1 : 0;
          if (isAiA !== isAiB) return isAiB - isAiA;
          
          const nameA = a.username || a.name || '';
          const nameB = b.username || b.name || '';
          return nameA.localeCompare(nameB);
        });
        
        setUsers(merged);
      } catch (err) {
        console.error('Failed to load chats', err);
      }
    }
    fetchChats()

    // Socket events
    socketInstance.on('user_status_change', ({ userId, online, last_seen }) => {
      setUsers(prev => prev.map(u => !u.isGroup && u.id === userId ? { ...u, online, last_seen } : u))
    })

    socketInstance.on('receive_message', (msg) => {
      const isFromSelected = msg.group_id 
        ? (selectedUser && selectedUser.isGroup && Number(selectedUser.id) === Number(msg.group_id))
        : (selectedUser && !selectedUser.isGroup && (Number(selectedUser.id) === Number(msg.sender_id) || Number(selectedUser.id) === Number(msg.receiver_id)));

      if (isFromSelected) {
        setMessages(prev => [...prev, msg]);
      }
      
      playNotificationSound();

      const isAppFocused = document.hasFocus();
      const isChattingWithSender = selectedUser && (
        msg.group_id 
          ? (selectedUser.isGroup && Number(selectedUser.id) === Number(msg.group_id))
          : (!selectedUser.isGroup && Number(selectedUser.id) === Number(msg.sender_id))
      );

      if (!isAppFocused || !isChattingWithSender) {
        let senderName = msg.sender_name || 'Someone';
        let notificationTitle = `New message from ${senderName}`;
        let toastTitle = senderName;
        let iconUrl = '/icons/icon-192.png'; // Use app logo as default

        if (msg.group_id) {
          const group = usersRef.current.find(u => u.isGroup && Number(u.id) === Number(msg.group_id));
          const groupName = group ? group.name : 'Group';
          notificationTitle = `New message in ${groupName} from ${senderName}`;
          toastTitle = `${groupName} • ${senderName}`;
          if (group?.avatar) iconUrl = group.avatar;
        } else {
          const sender = usersRef.current.find(u => !u.isGroup && Number(u.id) === Number(msg.sender_id));
          if (sender) {
            senderName = sender.username;
            if (sender.profile_pic) {
              iconUrl = sender.profile_pic.startsWith('http') ? sender.profile_pic : `${SERVER_URL}${sender.profile_pic}`;
            }
          }
        }
        
        // Native browser desktop notification
        if ('Notification' in window && Notification.permission === 'granted') {
          const n = new Notification(notificationTitle, {
            body: msg.content || 'Sent a media file',
            icon: iconUrl,
            badge: '/icons/icon-192.png' // This replaces the Chrome logo on mobile status bars
          });
          
          n.onclick = () => {
            window.focus();
            const activeChat = usersRef.current.find(u => 
              msg.group_id 
                ? (u.isGroup && Number(u.id) === Number(msg.group_id))
                : (!u.isGroup && Number(u.id) === Number(msg.sender_id))
            );
            if (activeChat) setSelectedUser(activeChat);
          };
        }

        // In-App Toast banner
        if (isAppFocused) {
          const senderObj = {
            id: msg.group_id ? msg.group_id : msg.sender_id,
            username: toastTitle,
            profile_pic: msg.group_id ? (usersRef.current.find(u => u.isGroup && Number(u.id) === Number(msg.group_id))?.avatar || null) : (usersRef.current.find(u => !u.isGroup && Number(u.id) === Number(msg.sender_id))?.profile_pic || null),
            isGroup: !!msg.group_id
          };
          showInAppToast(msg, senderObj);
        }
      }
    })

    socketInstance.on('user_deleted', ({ userId }) => {
      setUsers(prev => prev.filter(u => u.isGroup || u.id !== userId))
      if (selectedUser && !selectedUser.isGroup && selectedUser.id === userId) {
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

    socketInstance.on('user_typing', ({ userId, groupId, username }) => {
      if (groupId) {
        setGroupTyping(prev => ({
          ...prev,
          [groupId]: {
            ...(prev[groupId] || {}),
            [userId]: username
          }
        }));
      } else {
        setTypingUserId(userId)
      }
    })

    socketInstance.on('user_stopped_typing', ({ userId, groupId }) => {
      if (groupId) {
        setGroupTyping(prev => {
          const group = { ...(prev[groupId] || {}) };
          delete group[userId];
          return {
            ...prev,
            [groupId]: group
          };
        });
      } else {
        if (typingUserId === userId) setTypingUserId(null)
      }
    })

    socketInstance.on('group_created', ({ group, members }) => {
      setUsers(prev => {
        if (prev.some(u => u.isGroup && u.id === group.id)) return prev;
        const updated = [group, ...prev];
        updated.sort((a, b) => {
          const pinA = a.is_pinned ? 1 : 0;
          const pinB = b.is_pinned ? 1 : 0;
          if (pinA !== pinB) return pinB - pinA;
          
          const isAiA = a.samvad_id === 'ai#9999' ? 1 : 0;
          const isAiB = b.samvad_id === 'ai#9999' ? 1 : 0;
          if (isAiA !== isAiB) return isAiB - isAiA;
          
          const nameA = a.username || a.name || '';
          const nameB = b.username || b.name || '';
          return nameA.localeCompare(nameB);
        });
        return updated;
      });

      socketInstance.emit('join_group', { groupId: group.id });
    });

    socketInstance.on('group_deleted', ({ groupId, name }) => {
      setUsers(prev => prev.filter(u => !(u.isGroup && u.id === groupId)));
      setSelectedUser(prev => {
        if (prev && prev.isGroup && prev.id === groupId) {
          alert(`Group "${name}" has been deleted by the creator.`);
          return null;
        }
        return prev;
      });
    });

    socketInstance.on('group_updated', ({ groupId, name }) => {
      setUsers(prev => prev.map(u => (u.isGroup && u.id === groupId) ? { ...u, name } : u));
      setSelectedUser(prev => {
        if (prev && prev.isGroup && prev.id === groupId) {
          return { ...prev, name };
        }
        return prev;
      });
    });

    socketInstance.on('messages_read', ({ receiver_id }) => {
      setMessages(prev => prev.map(m => m.receiver_id === receiver_id ? { ...m, status: 'read' } : m))
    })

    socketInstance.on('message_pinned', ({ messageId, isPinned }) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, is_pinned: isPinned } : m))
    })

    // ── Call Events ────────────────────────────────────
    socketInstance.on('incoming_call', ({ from, signal, callType }) => {
      startIncomingCallRing(); // Start looped ringtone
      const callerUser = usersRef.current.find(u => !u.isGroup && Number(u.id) === Number(from));
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
      socketInstance.off('group_created')
      socketInstance.off('group_deleted')
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
        const endpoint = selectedUser.isGroup
          ? `${SERVER_URL}/api/messages/group/${selectedUser.id}?limit=30`
          : `${SERVER_URL}/api/messages/${currentUser.id}/${selectedUser.id}?limit=30`;
        const res = await axios.get(endpoint)
        setMessages(res.data)
        if (res.data.length < 30) {
          setHasMoreMessages(false)
        }
        
        if (socketInstance && !selectedUser.isGroup) {
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
      const endpoint = selectedUser.isGroup
        ? `${SERVER_URL}/api/messages/group/${selectedUser.id}?beforeId=${oldestId}&limit=30`
        : `${SERVER_URL}/api/messages/${currentUser.id}/${selectedUser.id}?beforeId=${oldestId}&limit=30`;
      const res = await axios.get(endpoint);
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
      content: msgData.content,
      type: msgData.type,
      file_url: msgData.file_url,
      reply_to: replyingTo?.id || null,
      is_forwarded: msgData.is_forwarded || false,
      correlationId: correlationId
    }

    if (selectedUser.isGroup) {
      newMsg.group_id = selectedUser.id;
    } else {
      newMsg.receiver_id = selectedUser.id;
    }
    
    socketInstance.emit('send_message', newMsg)
    playSentSound();
    
    const parentInfo = replyingTo ? {
      parent_content: replyingTo.content,
      parent_sender_name: replyingTo.sender_id === currentUser.id ? 'You' : (replyingTo.sender_name || selectedUser.username || selectedUser.name)
    } : {};

    setMessages(prev => [...prev, {
      ...newMsg,
      ...parentInfo,
      sender_name: currentUser.username,
      id: Date.now(),
      timestamp: new Date().toISOString(),
      isOptimistic: true
    }])

    setReplyingTo(null)
  }

  const handleTyping = (isTyping) => {
    if (!socketInstance || !selectedUser) return;
    const payload = selectedUser.isGroup
      ? { group_id: selectedUser.id }
      : { receiver_id: selectedUser.id };

    if (isTyping) {
      const now = Date.now();
      if (now - lastTypingEmitRef.current > 3000) {
        socketInstance.emit('typing', payload);
        lastTypingEmitRef.current = now;
      }
    } else {
      socketInstance.emit('stop_typing', payload);
      lastTypingEmitRef.current = 0;
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
    setSocketInstance(prev => {
      if (prev) prev.disconnect();
      return null;
    });
    setSelectedUser(null);
    localStorage.removeItem('samvad_token');
    localStorage.removeItem('samvad_user');
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

  const handleForward = (targetUser) => {
    if (!forwardingMessage || !socketInstance) return;
    const correlationId = `${Date.now()}-fw-${Math.random().toString(36).substr(2, 9)}`;
    const forwardedMsg = {
      sender_id: currentUser.id,
      content: forwardingMessage.content,
      type: forwardingMessage.type,
      file_url: forwardingMessage.file_url,
      is_forwarded: true,
      correlationId: correlationId
    };
    if (targetUser.isGroup) {
      forwardedMsg.group_id = targetUser.id;
    } else {
      forwardedMsg.receiver_id = targetUser.id;
    }
    socketInstance.emit('send_message', forwardedMsg);
    
    const isSameChat = selectedUser && 
      (targetUser.isGroup 
        ? (selectedUser.isGroup && Number(selectedUser.id) === Number(targetUser.id))
        : (!selectedUser.isGroup && Number(selectedUser.id) === Number(targetUser.id)));

    if (isSameChat) {
      setMessages(prev => [...prev, { ...forwardedMsg, sender_name: currentUser.username, id: Date.now(), timestamp: new Date().toISOString(), isOptimistic: true }]);
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
      const { token, ...userData } = res.data
      // If username changed, server returns a new JWT token
      if (token) {
        localStorage.setItem('samvad_token', token)
      }
      setCurrentUser(userData)
      localStorage.setItem('samvad_user', JSON.stringify(userData))
      alert('Profile updated successfully!')
    } catch (err) {
      console.error('Profile update failed', err)
      const errorMsg = err.response?.data?.error || 'Failed to update profile.'
      alert(errorMsg)
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

  const handleTogglePinChat = async (chatId, shouldPin, isGroup) => {
    try {
      const action = shouldPin ? 'pin' : 'unpin';
      const endpoint = isGroup 
        ? `/api/groups/${chatId}/${action}` 
        : `/api/friends/${chatId}/${action}`;
      await axios.post(`${SERVER_URL}${endpoint}`);
      
      // Update local state for immediate feedback
      setUsers(prev => {
        const updated = prev.map(u => (Number(u.id) === Number(chatId) && !!u.isGroup === !!isGroup) ? { ...u, is_pinned: shouldPin } : u);
        
        // Sort immediately to reflect the change
        updated.sort((a, b) => {
          const pinA = a.is_pinned ? 1 : 0;
          const pinB = b.is_pinned ? 1 : 0;
          if (pinA !== pinB) return pinB - pinA;
          
          const isAiA = a.samvad_id === 'ai#9999' ? 1 : 0;
          const isAiB = b.samvad_id === 'ai#9999' ? 1 : 0;
          if (isAiA !== isAiB) return isAiB - isAiA;
          
          const nameA = a.username || a.name || '';
          const nameB = b.username || b.name || '';
          return nameA.localeCompare(nameB);
        });
        
        return updated;
      });

      if (selectedUser && selectedUser.id === chatId && !!selectedUser.isGroup === !!isGroup) {
        setSelectedUser(prev => ({ ...prev, is_pinned: shouldPin }));
      }
    } catch (err) {
      console.error('Failed to toggle pin state:', err);
      alert('Failed to update chat pin state');
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
              <img src="/icons/icon-192.png" alt="Samvad App Logo" className="logo-image" />
            </div>
            <h2>{isLoginMode ? 'Welcome Back' : 'Create Account'}</h2>
            <p className="subtitle">{isLoginMode ? 'Enter your details to continue chatting' : 'Join our secure messaging platform'}</p>
          </div>

          <form onSubmit={handleAuth} className="input-group">
            <div className="input-wrapper-container">
              <div className="input-wrapper">
                <MdPerson className="input-icon" />
                <input 
                  id="auth-username"
                  name="username"
                  type="text" 
                  className="input-field" 
                  placeholder={isLoginMode ? "Email, Username or samvadId" : "Enter Username"} 
                  value={usernameInput}
                  onChange={e => setUsernameInput(e.target.value)}
                  autoComplete="username"
                  autoFocus
                />
              </div>
              {!isLoginMode && usernameInput && (
                <div className={`availability-indicator ${usernameAvailable === true ? 'available' : usernameAvailable === false ? 'taken' : 'checking'}`}>
                  {usernameChecking ? 'Checking...' : usernameAvailable === true ? '✓ Username is available' : usernameAvailable === false ? '✗ Username is already taken' : ''}
                </div>
              )}
            </div>

            {!isLoginMode && (
              <div className="input-wrapper-container">
                <div className="input-wrapper">
                  <MdEmail className="input-icon" />
                  <input 
                    id="auth-email"
                    name="email"
                    type="email" 
                    className="input-field" 
                    placeholder="Enter Email Address" 
                    value={emailInput}
                    onChange={e => setEmailInput(e.target.value)}
                    autoComplete="email"
                  />
                </div>
                {emailInput && (
                  <div className={`availability-indicator ${emailAvailable === true ? 'available' : emailAvailable === false ? 'taken' : 'checking'}`}>
                    {emailChecking ? 'Checking...' : emailAvailable === true ? '✓ Email is available' : emailAvailable === false ? '✗ Email is taken or invalid' : ''}
                  </div>
                )}
              </div>
            )}

            <div className="input-wrapper">
              <MdLock className="input-icon" />
              <input 
                id="auth-password"
                name="password"
                type={showPassword ? "text" : "password"}  
                className="input-field" 
                placeholder="Enter Password" 
                value={passwordInput}
                onChange={e => setPasswordInput(e.target.value)}
                autoComplete={isLoginMode ? "current-password" : "new-password"}
              />
              <div className="password-toggle-icon" onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? <MdVisibilityOff size={18} /> : <MdVisibility size={18} />}
              </div>
            </div>

            {!isLoginMode && passwordInput && (
              <div className="password-strength-container">
                <div className="password-strength-bar-bg">
                  <div 
                    className="password-strength-bar" 
                    style={{ 
                      width: `${(getPasswordStrength(passwordInput).score / 4) * 100}%`, 
                      backgroundColor: getPasswordStrength(passwordInput).color 
                    }}
                  ></div>
                </div>
                <span className="password-strength-label" style={{ color: getPasswordStrength(passwordInput).color }}>
                  Strength: {getPasswordStrength(passwordInput).label}
                </span>
              </div>
            )}

            {/* Security question removed */}

            {isLoginMode && (
              <div className="auth-secondary">
                <label className="checkbox-label">
                  <input id="remember-me" name="remember" type="checkbox" /> Remember me
                </label>
                <span className="forgot-link" onClick={() => setShowForgotPassword(true)}>Forgot Password?</span>
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
    <div className={`app-container ${isResizing ? 'resizing-active' : ''}`}>
      <div 
        className={`user-list-sidebar ${selectedUser ? 'mobile-hide' : ''} ${isSidebarHidden ? 'desktop-hide' : ''}`}
        style={!isSidebarHidden ? { width: `${sidebarWidth}px` } : {}}
      >
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
          onTogglePinChat={handleTogglePinChat}
        />
      </div>

      {!isSidebarHidden && (
        <div 
          className="sidebar-resizer desktop-only" 
          onMouseDown={handleMouseDown}
        />
      )}
      
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
          isTyping={selectedUser?.isGroup 
            ? Object.values(groupTyping[selectedUser.id] || {}).join(', ') 
            : (typingUserId === selectedUser?.id)}
          onViewImage={setViewingImageUrl}
          onStartCall={handleStartCall}
          hasMoreMessages={hasMoreMessages}
          loadingMore={loadingMore}
          onLoadMoreMessages={handleLoadMoreMessages}
          onDeleteGroup={(groupId) => {
            setUsers(prev => prev.filter(u => !(u.isGroup && u.id === groupId)));
            setSelectedUser(null);
          }}
          isBlocked={isBlocked}
          onToggleBlock={() => {
            if (!selectedUser) return;
            const chatKey = selectedUser.isGroup ? `group_${selectedUser.id}` : `user_${selectedUser.id}`;
            const nextBlocked = !isBlocked;
            localStorage.setItem(`samvad_blocked_${chatKey}`, String(nextBlocked));
            setIsBlocked(nextBlocked);
          }}
        />
        {selectedUser && (
          isBlocked ? (
            <div style={{ padding: '16px', textAlign: 'center', background: 'rgba(239, 68, 68, 0.08)', color: '#ef4444', fontWeight: '600', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '0.95rem' }}>
              You have blocked this contact. Tap their name/avatar to unblock.
            </div>
          ) : (
            <MessageInput 
              onSendMessage={handleSendMessage} 
              serverUrl={SERVER_URL} 
              replyingTo={replyingTo}
              onCancelReply={() => setReplyingTo(null)}
              onTyping={handleTyping}
            />
          )
        )}
      </div>

      {forwardingMessage && (
        <div className="forward-modal-overlay" onClick={() => setForwardingMessage(null)}>
          <div className="forward-modal" onClick={e => e.stopPropagation()}>
            <h3>Forward to...</h3>
            <div className="forward-user-list">
              {users.map(u => {
                const displayName = u.isGroup ? u.name : u.username;
                const avatarChar = displayName ? displayName.charAt(0).toUpperCase() : '?';
                return (
                  <div key={u.isGroup ? `group-${u.id}` : `user-${u.id}`} className="forward-user-item" onClick={() => handleForward(u)}>
                     <div className="user-avatar" style={{width: '32px', height: '32px', fontSize: '0.9rem', marginRight: '10px'}}>
                       {avatarChar}
                     </div>
                     <span>{displayName}</span>
                  </div>
                );
              })}
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
            const senderUser = users.find(u => Number(u.id) === Number(t.senderId) && !!u.isGroup === !!t.isGroup);
            if (senderUser) setSelectedUser(senderUser);
            setToasts(prev => prev.filter(toast => toast.id !== t.id));
          }}>
            <div className="toast-avatar">
              {t.senderAvatar ? (
                <img src={t.senderAvatar.startsWith('http') ? t.senderAvatar : `${SERVER_URL}${t.senderAvatar}`} alt="" />
              ) : (
                (t.senderName || 'Someone').charAt(0).toUpperCase()
              )}
            </div>
            <div className="toast-details">
              <h4>{t.senderName || 'Someone'}</h4>
              <p>{t.message}</p>
            </div>
            <div className="toast-close" onClick={(e) => { e.stopPropagation(); setToasts(prev => prev.filter(toast => toast.id !== t.id)); }}>&times;</div>
          </div>
        ))}
      </div>

      {showForgotPassword && (
        <div className="forgot-password-overlay" onClick={() => setShowForgotPassword(false)}>
          <div className="forgot-password-modal" onClick={e => e.stopPropagation()}>
            <div className="forgot-header">
              <h2>Reset Password</h2>
              <p>Verify details and solve the character CAPTCHA to reset password.</p>
              <button className="forgot-close-btn" onClick={() => setShowForgotPassword(false)}>&times;</button>
            </div>
            
            <form onSubmit={handleForgotPasswordReset} className="forgot-form">
              {forgotError && <div className="forgot-error-banner">{forgotError}</div>}
              {forgotSuccess && <div className="forgot-success-banner">{forgotSuccess}</div>}

              <div className="input-wrapper">
                <MdPerson className="input-icon" />
                <input 
                  id="forgot-identifier"
                  name="forgot_identifier"
                  type="text" 
                  className="input-field" 
                  placeholder="Username, Email, or samvadId"
                  value={forgotIdentifier}
                  onChange={e => setForgotIdentifier(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>

              {/* Security question answer fields removed */}

              <div className="captcha-section">
                {renderCaptchaDisplay()}
                <div className="input-wrapper captcha-input-wrapper">
                  <MdRefresh className="captcha-refresh-icon" onClick={generateCaptcha} title="Refresh CAPTCHA" />
                  <input 
                    id="forgot-captcha"
                    name="forgot_captcha"
                    type="text" 
                    className="input-field captcha-input" 
                    placeholder="Enter CAPTCHA Code"
                    value={captchaInput}
                    onChange={e => setCaptchaInput(e.target.value)}
                    autoComplete="off"
                    required
                  />
                </div>
              </div>

              <div className="input-wrapper">
                <MdLock className="input-icon" />
                <input 
                  id="forgot-new-password"
                  name="forgot_new_password"
                  type="password" 
                  className="input-field" 
                  placeholder="New Password (min 8 chars)"
                  value={forgotNewPassword}
                  onChange={e => setForgotNewPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>

              <div className="input-wrapper">
                <MdLock className="input-icon" />
                <input 
                  id="forgot-confirm-password"
                  name="forgot_confirm_password"
                  type="password" 
                  className="input-field" 
                  placeholder="Confirm New Password"
                  value={forgotConfirmPassword}
                  onChange={e => setForgotConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>

              <button type="submit" className="primary-btn reset-btn">
                Reset Password
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
