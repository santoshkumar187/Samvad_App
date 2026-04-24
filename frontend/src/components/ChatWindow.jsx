import React, { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import { 
  MdChat, MdVideocam, MdCall, MdMoreVert, MdArrowBack, MdDoneAll, MdCheck,
  MdDeleteOutline, MdReply, MdForward, MdContentCopy, MdCheckCircleOutline, 
  MdInfoOutline, MdPushPin, MdFullscreen, MdFullscreenExit, MdInsertDriveFile,
  MdPalette, MdPhotoLibrary, MdClose
} from 'react-icons/md'

export default function ChatWindow({ currentUser, selectedUser, messages, onSendMessage, serverUrl, onBack, onClearChat, onDeleteMessage, onReactMessage, onPinMessage, onReplyMessage, onForwardMessage, isSidebarHidden, onToggleSidebar, isTyping, onViewImage, onStartCall }) {
  const [showMenu, setShowMenu] = useState(false)
  const [activeMessageMenu, setActiveMessageMenu] = useState(null)
  const [reactionMenuId, setReactionMenuId] = useState(null)
  const [showThemeSelector, setShowThemeSelector] = useState(false)
  const [previewFile, setPreviewFile] = useState(null)
  const [chatTheme, setChatTheme] = useState(() => localStorage.getItem('samvad_chat_theme') || 'default')
  const [customWallpaperUrl, setCustomWallpaperUrl] = useState(() => localStorage.getItem('samvad_custom_wallpaper') || '')
  const [longPressTimer, setLongPressTimer] = useState(null)
  const fileInputRef = useRef(null)
  const touchStartX = useRef(null)
  const touchStartY = useRef(null)
  const [swipingMessageId, setSwipingMessageId] = useState(null)
  const [swipeOffset, setSwipeOffset] = useState(0)
  const [isReturning, setIsReturning] = useState(false)
  const scrollRef = useRef(null)

  const handleLongPress = (msg) => {
    setActiveMessageMenu(msg)
  }

  const themes = [
    { id: 'default', name: 'Signal Black', class: 'theme-default' },
    { id: 'violet-night', name: 'Violet Night', class: 'theme-violet-night' },
    { id: 'stellar', name: 'Stellar Dot', class: 'theme-stellar' },
    { id: 'geometric', name: 'Geometric', class: 'theme-geometric' },
    { id: 'mesh', name: 'Mesh Glow', class: 'theme-mesh' },
    { id: 'doodle', name: 'Doodle Chat', class: 'theme-doodle' },
    { id: 'obsidian', name: 'Obsidian', class: 'theme-obsidian' },
    { id: 'aurora', name: 'Aurora', class: 'theme-aurora' },
    { id: 'sunset', name: 'Sunset Violet', class: 'theme-sunset' },
    { id: 'oceanic', name: 'Oceanic Blue', class: 'theme-oceanic' },
    { id: 'carbon', name: 'Carbon Fiber', class: 'theme-carbon' },
    { id: 'circuit', name: 'Circuit Board', class: 'theme-circuit' },
    { id: 'lavender', name: 'Lavender Mist', class: 'theme-lavender' },
    { id: 'cyberpunk', name: 'Cyber Neon', class: 'theme-cyberpunk' },
    { id: 'desert', name: 'Desert Sand', class: 'theme-desert' },
    { id: 'glacier', name: 'Glacier Glow', class: 'theme-glacier' },
  ];

  const handleSetTheme = (themeId) => {
    setChatTheme(themeId);
    localStorage.setItem('samvad_chat_theme', themeId);
  }

  const handleGalleryUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await axios.post(`${serverUrl}/api/upload`, formData);
      const url = res.data.url.startsWith('http') ? res.data.url : `${serverUrl}${res.data.url}`;
      setCustomWallpaperUrl(url);
      localStorage.setItem('samvad_custom_wallpaper', url);
      setChatTheme('custom');
      localStorage.setItem('samvad_chat_theme', 'custom');
    } catch (err) {
      console.error('Wallpaper upload failed', err);
      alert('Failed to upload wallpaper');
    }
  }

  const handleTouchStart = (e, msg) => {
    const touch = e.touches ? e.touches[0] : e;
    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;
    
    // Clear any pending return animation
    if (swipingMessageId === msg.id && isReturning) {
       setIsReturning(false);
    }
    
    // Start long press
    const timer = setTimeout(() => handleLongPress(msg), 500)
    setLongPressTimer(timer)
  }

  const handleTouchMove = (e, msg) => {
    if (touchStartX.current === null) return;
    
    const touch = e.touches ? e.touches[0] : e;
    const diffX = touch.clientX - touchStartX.current;
    const diffY = touch.clientY - touchStartY.current;

    // If scrolling vertically, let it scroll and cancel long press
    if (Math.abs(diffY) > 15) {
       if (longPressTimer) clearTimeout(longPressTimer);
       setLongPressTimer(null);
       return;
    }

    // Only allow swipe left-to-right
    if (diffX > 10) {
      if (longPressTimer) clearTimeout(longPressTimer);
      setLongPressTimer(null);
      
      // Implement rubber-band resistance
      let offset = diffX;
      const threshold = 50;
      if (diffX > threshold) {
        offset = threshold + (diffX - threshold) * 0.25; // More resistance past threshold
      }
      
      // Limit absolute swipe distance
      if (offset < 80) { // Slightly tighter max distance
        setSwipingMessageId(msg.id);
        setSwipeOffset(offset);
      }
    }
  }

  const handleTouchEnd = (e, msg) => {
    if (swipeOffset > 50 && swipingMessageId === msg.id) {
      onReplyMessage(msg);
    }
    
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
    
    if (swipingMessageId === msg.id) {
      setIsReturning(true);
      setSwipeOffset(0);
      // Wait for animation to finish before clearing swiping Id
      setTimeout(() => {
        setSwipingMessageId(null);
        setIsReturning(false);
      }, 500);
    }
    
    touchStartX.current = null;
    touchStartY.current = null;
  }

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  if (!selectedUser) {
    return (
      <div className="chat-area">
        <div className="empty-chat" style={{ textAlign: 'center' }}>
          <MdChat size={64} color="#2c2c36" />
        </div>
      </div>
    )
  }

  const renderTextWithLinks = (text) => {
    if (!text || typeof text !== 'string') return text;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    return parts.map((part, i) => {
      if (part.match(urlRegex)) {
        return (
          <a 
            key={i} 
            href={part} 
            target="_blank" 
            rel="noopener noreferrer" 
            style={{ color: '#c084fc', textDecoration: 'underline', wordBreak: 'break-all' }}
            onClick={(e) => e.stopPropagation()}
          >
            {part}
          </a>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  const renderMessageContent = (msg) => {
    switch (msg.type) {
      case 'image':
        return (
          <img 
            src={msg.file_url?.startsWith('http') ? msg.file_url : `${serverUrl}${msg.file_url}`}
            alt="sent image" 
            className="message-image" 
            onClick={(e) => {
              e.stopPropagation();
              const src = msg.file_url?.startsWith('http') ? msg.file_url : `${serverUrl}${msg.file_url}`;
              onViewImage(src);
            }}
          />
        )
      case 'video':
        return <video src={msg.file_url?.startsWith('http') ? msg.file_url : `${serverUrl}${msg.file_url}`} controls className="message-video" />
      case 'audio':
        return <audio src={msg.file_url?.startsWith('http') ? msg.file_url : `${serverUrl}${msg.file_url}`} controls className="message-audio" />
      case 'file':
        return (
          <div 
            className="file-message-card" 
            onClick={(e) => {
              e.stopPropagation();
              const src = msg.file_url?.startsWith('http') ? msg.file_url : `${serverUrl}${msg.file_url}`;
              const fileName = msg.content || '';
              const isPdf = /\\.(pdf)$/i.test(fileName);
              const isOffice = /\\.(doc|docx|ppt|pptx|xls|xlsx|csv)$/i.test(fileName);
              
              if (isPdf) {
                setPreviewFile({ url: `https://docs.google.com/gview?url=${encodeURIComponent(src)}&embedded=true`, name: fileName });
              } else if (isOffice) {
                setPreviewFile({ url: `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(src)}`, name: fileName });
              } else {
                window.open(src, '_blank');
              }
            }}
          >
            <div className="file-icon">
              <MdInsertDriveFile />
            </div>
            <div className="file-info">
              <span className="file-name">{msg.content}</span>
              <span className="file-size-tap">Tap to open</span>
            </div>
          </div>
        )
      default:
        return <span className="message-text-content">{renderTextWithLinks(msg.content)}</span>
    }
  }

  const isOnlyEmojis = (text) => {
    if (!text || typeof text !== 'string') return false;
    const stripped = text.replace(/\s/g, '');
    if (!stripped) return false;
    return /^[\p{Extended_Pictographic}]+$/u.test(stripped);
  }

  const formatHeaderDate = () => {
    const today = new Date();
    const current = new Date();
    const isToday = current.getDate() === today.getDate() && 
                    current.getMonth() === today.getMonth() && 
                    current.getFullYear() === today.getFullYear();
    
    if (isToday) return 'Today';

    return today.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  }

  const formatLastSeen = (timestamp) => {
    if (!timestamp) return 'Offline';
    const date = new Date(timestamp);
    const today = new Date();
    const isToday = date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
    if (isToday) {
      return `last seen today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    return `last seen ${date.toLocaleDateString()} at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }

  return (
    <div className="chat-area">
      <div className="chat-header">
        <div className="back-btn" onClick={onBack}>
          <MdArrowBack />
        </div>
        <div className="user-avatar" 
          onClick={() => selectedUser.profile_pic && onViewImage(selectedUser.profile_pic.startsWith('http') ? selectedUser.profile_pic : `${serverUrl}${selectedUser.profile_pic}`)}
          style={{width: '40px', height:'40px', fontSize:'1.1rem', margin:0, background: 'var(--brand-violet)', cursor: 'pointer'}}>
          {selectedUser.profile_pic ? (
            <img src={selectedUser.profile_pic.startsWith('http') ? selectedUser.profile_pic : `${serverUrl}${selectedUser.profile_pic}`} alt="dp" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            selectedUser.username.charAt(0).toUpperCase()
          )}
        </div>
        <div className="chat-header-info">
          <h3>{selectedUser.username}</h3>
          <span style={{ textTransform: 'lowercase' }}>{selectedUser.online ? 'Online' : formatLastSeen(selectedUser.last_seen)}</span>
        </div>
        <div className="chat-header-actions" style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div className="header-action-btn" onClick={() => onStartCall('audio')} title="Audio Call" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <MdCall size={22} />
          </div>
          <div className="header-action-btn" onClick={() => onStartCall('video')} title="Video Call" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <MdVideocam size={22} />
          </div>
          <div className="header-action-btn desktop-only" onClick={onToggleSidebar} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }} title={isSidebarHidden ? "Exit Fullscreen" : "Fullscreen Chat"}>
            {isSidebarHidden ? <MdFullscreenExit size={24} /> : <MdFullscreen size={24} />}
          </div>
          <MdMoreVert onClick={() => setShowMenu(!showMenu)} style={{ cursor: 'pointer' }} />
          
          {showMenu && (
            <div className="header-dropdown">
              <div className="dropdown-item" onClick={() => { setShowThemeSelector(true); setShowMenu(false); }}>
                <MdPalette /> Chat Theme
              </div>
              <div className="dropdown-item" onClick={async (e) => {
                e.stopPropagation();
                console.log('Bulk delete requested');
                if (window.confirm('Clear all messages in this chat?')) {
                  try {
                    await axios.delete(`${serverUrl}/api/messages/${currentUser.id}/${selectedUser.id}`)
                    console.log('Bulk delete success');
                    onClearChat()
                    setShowMenu(false)
                  } catch (err) {
                    console.error('Bulk delete failed', err);
                    alert('Failed to clear chat')
                  }
                }
              }}>
                <MdDeleteOutline /> Clear Chat
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Pinned Messages Header */}
      {messages.some(m => m.is_pinned) && (
        <div className="pinned-messages-bar" onClick={() => {
          const firstPinned = [...messages].reverse().find(m => m.is_pinned);
          if (firstPinned) {
            const el = document.getElementById(`msg-${firstPinned.id}`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }}>
          <MdPushPin size={16} />
          <div className="pinned-info">
            <span className="pinned-label">Pinned Message</span>
            <p className="pinned-preview">
              {messages.filter(m => m.is_pinned).pop()?.content || 'Media'}
            </p>
          </div>
          <div className="pinned-count">{messages.filter(m => m.is_pinned).length}</div>
        </div>
      )}
      
      <div 
        className={`messages-container ${activeMessageMenu ? 'blurred' : ''} theme-${chatTheme} ${chatTheme === 'custom' ? 'has-custom-bg' : ''}`} 
        ref={scrollRef}
        style={chatTheme === 'custom' ? { backgroundImage: `url(${customWallpaperUrl})` } : {}}
      >
        <div className="date-separator">
          {formatHeaderDate()}
        </div>
        {messages.map(msg => {
          const isSender = msg.sender_id === currentUser.id
          const emojiOnly = msg.type === 'text' && isOnlyEmojis(msg.content);
          
          return (
            <div 
              key={msg.id} 
              id={`msg-${msg.id}`}
              className={`message-wrapper ${isSender ? 'sent' : 'received'} ${activeMessageMenu?.id === msg.id ? 'context-active' : ''}`}
              onContextMenu={(e) => {
                e.preventDefault();
                setActiveMessageMenu(msg);
              }}
              onClick={(e) => {
                e.stopPropagation();
                // We let the specific content (like images) handle their own clicks.
                // General clicks on message bubbles shouldn't open context menu on mobile
                // as that's reserved for long-press.
              }}
              style={{ position: 'relative' }}
            >
              {swipingMessageId === msg.id && (
                <div style={{
                  position: 'absolute',
                  left: `${Math.min(swipeOffset - 45, 10)}px`,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  opacity: isReturning ? 0 : Math.min(swipeOffset / 30, 1),
                  color: swipeOffset >= 50 ? 'var(--brand-violet)' : 'rgba(255,255,255,0.4)',
                  transition: 'color 0.2s cubic-bezier(0.18, 0.89, 0.32, 1.28), opacity 0.5s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 0,
                  animation: (swipeOffset >= 50 && !isReturning) ? 'replyIconPop 0.3s forwards' : 'none'
                }}>
                  <MdReply 
                    size={26} 
                    style={{ 
                      filter: swipeOffset >= 50 ? 'drop-shadow(0 0 10px rgba(139, 92, 246, 0.6))' : 'none',
                      transform: `scale(${Math.min(0.6 + swipeOffset / 100, 1.3)})`
                    }} 
                  />
                </div>
              )}
              <div 
                className={`message-bubble ${emojiOnly ? 'emoji-only-msg' : ''} ${msg.type === 'image' || msg.type === 'video' ? 'media-bubble' : ''}`}
                style={{
                  transform: swipingMessageId === msg.id ? `translateX(${swipeOffset}px) rotate(${swipeOffset / 12}deg)` : 'translateX(0px) rotate(0deg)',
                  transition: (swipingMessageId === msg.id && !isReturning) ? 'none' : 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  zIndex: 1,
                  transformOrigin: isSender ? 'right center' : 'left center',
                  willChange: 'transform'
                }}
                onTouchStart={(e) => handleTouchStart(e, msg)}
                onTouchMove={(e) => handleTouchMove(e, msg)}
                onTouchEnd={(e) => handleTouchEnd(e, msg)}
                onMouseDown={(e) => handleTouchStart(e, msg)}
                onMouseMove={(e) => e.buttons === 1 && handleTouchMove(e, msg)}
                onMouseUp={(e) => handleTouchEnd(e, msg)}
                onMouseLeave={(e) => swipingMessageId === msg.id && handleTouchEnd(e, msg)}
              >
                {msg.reply_to && (
                  <div className="message-reply-quote">
                    <strong>{msg.parent_sender_name === currentUser.username ? 'You' : msg.parent_sender_name}</strong>
                    <p>{msg.parent_content || 'Media'}</p>
                  </div>
                )}
                {!!msg.is_pinned && (
                  <div className="message-pin-indicator">
                    <MdPushPin size={12} />
                  </div>
                )}
                {renderMessageContent(msg)}
                <div className="bubble-meta">
                  {!!msg.is_forwarded && <span className="forwarded-label">Forwarded</span>}
                  {(Date.now() - new Date(msg.timestamp).getTime() < 60000) 
                    ? 'Now' 
                    : new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {isSender && (
                    msg.status === 'read' ? <MdDoneAll size={15} color="#a78bfa" /> :
                    msg.status === 'delivered' ? <MdDoneAll size={15} color="rgba(255,255,255,0.6)" /> :
                    <MdCheck size={15} color="rgba(255,255,255,0.6)" />
                  )}
                </div>
                {msg.reaction && (
                  <div 
                    className="message-reaction-display"
                    onClick={(e) => {
                      e.stopPropagation();
                      setReactionMenuId(msg.id);
                    }}
                  >
                    {msg.reaction}
                  </div>
                )}
              </div>
            </div>
          )
        })}
        {isTyping && (
          <div className="message-wrapper received typing-indicator-wrapper">
            <div className="message-bubble typing-bubble">
              <span className="dot"></span>
              <span className="dot"></span>
              <span className="dot"></span>
            </div>
          </div>
        )}
      </div>

      {activeMessageMenu && (
        <div className="context-menu-overlay" onClick={() => setActiveMessageMenu(null)}>
          <div className="reaction-bar" onClick={(e) => e.stopPropagation()}>
            {['❤️', '👍', '👎', '😂', '😮', '😢'].map(emoji => (
              <span key={emoji} className="reaction-item" onClick={() => {
                 const newReaction = activeMessageMenu.reaction === emoji ? null : emoji;
                 onReactMessage(activeMessageMenu.id, newReaction);
                 setActiveMessageMenu(null);
              }}>
                {emoji}
              </span>
            ))}
            <span className="reaction-item more">+</span>
          </div>
          
          <div className="context-menu" onClick={(e) => e.stopPropagation()}>
            <div className="context-list">
              <div className="context-item" onClick={() => { onReplyMessage(activeMessageMenu); setActiveMessageMenu(null); }}>
                <MdReply /> Reply
              </div>
              <div className="context-item" onClick={() => { onForwardMessage(activeMessageMenu); setActiveMessageMenu(null); }}>
                <MdForward /> Forward
              </div>
              <div className="context-item" onClick={() => {
                navigator.clipboard.writeText(activeMessageMenu.content || '');
                alert('Copied to clipboard');
                setActiveMessageMenu(null);
              }}>
                <MdContentCopy /> Copy
              </div>
              <div className="context-item" onClick={() => { alert('Select triggered'); setActiveMessageMenu(null); }}>
                <MdCheckCircleOutline /> Select
              </div>
              <div className="context-item" onClick={() => {
                 alert(`Message Details\nAt: ${new Date(activeMessageMenu.timestamp).toLocaleString()}`);
                 setActiveMessageMenu(null); 
              }}>
                <MdInfoOutline /> Info
              </div>
              <div className="context-item" onClick={() => {
                 onPinMessage(activeMessageMenu.id, !activeMessageMenu.is_pinned);
                 setActiveMessageMenu(null); 
              }}>
                <MdPushPin /> {activeMessageMenu.is_pinned ? 'Unpin Message' : 'Pin Message'}
              </div>
              
              <div className="context-item delete" onClick={() => {
                  onDeleteMessage(activeMessageMenu.id, 'me');
                  setActiveMessageMenu(null);
              }}>
                <MdDeleteOutline /> Delete for me
              </div>
              
              {activeMessageMenu.sender_id === currentUser.id && (
                <div className="context-item delete" onClick={() => {
                  if (window.confirm('Delete for everyone?')) {
                    onDeleteMessage(activeMessageMenu.id, 'everyone');
                    setActiveMessageMenu(null);
                  }
                }}>
                  <MdDeleteOutline /> Delete for everyone
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {reactionMenuId && (
        <div className="context-menu-overlay" onClick={() => setReactionMenuId(null)}>
          <div className="context-menu" onClick={(e) => e.stopPropagation()} style={{ padding: '20px' }}>
            <div style={{ textAlign: 'center', marginBottom: '15px' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '5px' }}>
                {messages.find(m => m.id === reactionMenuId)?.reaction}
              </div>
              <span style={{ fontSize: '0.85rem', color: 'var(--signal-text-muted)' }}>Reacted to this message</span>
            </div>
            {messages.find(m => m.id === reactionMenuId)?.react_user_id === currentUser.id ? (
              <div className="context-item delete" onClick={() => {
                  onReactMessage(reactionMenuId, null);
                  setReactionMenuId(null);
              }} style={{ justifyContent: 'center', borderRadius: '10px', marginTop: '10px' }}>
                Tap to remove
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--signal-text-muted)', fontSize: '0.9rem', marginTop: '10px' }}>
                Reacted by {messages.find(m => m.id === reactionMenuId)?.react_user_id === selectedUser.id ? selectedUser.username : 'Someone'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Theme Selector */}
      {showThemeSelector && (
        <div className="chat-theme-overlay" onClick={() => setShowThemeSelector(false)}>
          <div className="theme-selector-card" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: '10px' }}>Choose Theme</h3>
            <p style={{ color: 'var(--signal-text-muted)', fontSize: '0.9rem', marginBottom: '20px' }}>
              Select a pattern or color for your chat background.
            </p>
            <div className="theme-grid">
              <div 
                className={`theme-option theme-gallery ${chatTheme === 'custom' ? 'active' : ''}`}
                onClick={() => fileInputRef.current.click()}
              >
                <MdPhotoLibrary size={28} />
                <span>Gallery</span>
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                style={{ display: 'none' }} 
                accept="image/*"
                onChange={handleGalleryUpload}
              />
              {themes.map(t => (
                <div 
                  key={t.id} 
                  className={`theme-option ${t.class} ${chatTheme === t.id ? 'active' : ''}`}
                  onClick={() => handleSetTheme(t.id)}
                >
                  <span className="theme-name">{t.name}</span>
                </div>
              ))}
            </div>
            <button className="primary-btn" onClick={() => setShowThemeSelector(false)}>Done</button>
          </div>
        </div>
      )}

      {/* Document Preview Modal */}
      {previewFile && (
        <div className="context-menu-overlay" style={{ zIndex: 9999, display: 'flex', flexDirection: 'column' }} onClick={() => setPreviewFile(null)}>
          <div className="preview-header" style={{ width: '100%', padding: '15px 20px', background: '#1c1c24', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <MdInsertDriveFile size={24} color="#a78bfa" />
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '250px' }}>{previewFile.name}</h3>
            </div>
            <MdClose size={28} color="#fff" style={{ cursor: 'pointer' }} onClick={() => setPreviewFile(null)} />
          </div>
          <div className="preview-body" style={{ flex: 1, width: '100%', background: '#fff' }} onClick={e => e.stopPropagation()}>
            <iframe 
              src={previewFile.url} 
              style={{ width: '100%', height: '100%', border: 'none' }}
              title="Document Preview"
            />
          </div>
        </div>
      )}
    </div>
  )
}
