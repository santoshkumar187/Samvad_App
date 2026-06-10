import React, { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import {
  MdChat, MdVideocam, MdCall, MdMoreVert, MdArrowBack, MdDoneAll, MdCheck,
  MdDeleteOutline, MdReply, MdForward, MdContentCopy, MdCheckCircleOutline,
  MdInfoOutline, MdPushPin, MdFullscreen, MdFullscreenExit, MdInsertDriveFile,
  MdPalette, MdPhotoLibrary, MdClose, MdSearch, MdTranslate, MdVolumeUp,
  MdPictureAsPdf, MdDescription, MdSlideshow, MdTableChart, MdArchive,
  MdShare, MdBlock, MdNotificationsOff, MdNotifications, MdLink, MdEdit, MdLibraryMusic
} from 'react-icons/md'

function VoiceNotePlayer({ src, sender, isCurrentUser, serverUrl, fileName }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef(null);

  useEffect(() => {
    const audio = new Audio(src);
    audioRef.current = audio;

    const onLoadedMetadata = () => {
      setDuration(audio.duration || 0);
    };

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime || 0);
    };

    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);

    if (audio.readyState >= 1) {
      setDuration(audio.duration);
    }

    return () => {
      audio.pause();
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
    };
  }, [src]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(err => console.error('Audio play error:', err));
      setIsPlaying(true);
    }
  };

  const handleTimelineChange = (e) => {
    if (!audioRef.current) return;
    const time = Number(e.target.value);
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  };

  const formatTime = (time) => {
    if (isNaN(time)) return '0:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Static wave bars
  const waveBars = [
    12, 18, 14, 25, 30, 20, 15, 28, 35, 40,
    22, 15, 26, 32, 18, 12, 24, 30, 28, 16,
    14, 22, 35, 42, 28, 18, 22, 30, 20, 12
  ];

  const avatarUrl = sender?.profile_pic
    ? (sender.profile_pic.startsWith('http') ? sender.profile_pic : `${serverUrl}${sender.profile_pic}`)
    : null;

  const isMusic = fileName && !fileName.startsWith('voice-note-');

  return (
    <div className={`voice-note-player-card ${isCurrentUser ? 'sent' : 'received'}`} onClick={e => e.stopPropagation()} style={{ position: 'relative' }}>
      {isMusic && (
        <div className="music-file-name" style={{ position: 'absolute', top: '-18px', left: 0, fontSize: '0.75rem', opacity: 0.8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>
          {fileName}
        </div>
      )}
      <div className="voice-note-avatar">
        {isMusic ? (
          <div className={`music-logo ${isPlaying ? 'playing' : ''}`} style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'linear-gradient(135deg, #FF6B6B, #C06C84)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MdLibraryMusic size={24} color="#fff" />
          </div>
        ) : avatarUrl ? (
          <img src={avatarUrl} alt="" />
        ) : (
          <div className="voice-note-avatar-fallback">
            {sender?.username?.charAt(0).toUpperCase() || 'U'}
          </div>
        )}
      </div>

      <button className="voice-note-play-btn" onClick={togglePlay}>
        {isPlaying ? (
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      <div className="voice-note-waveform-container">
        <div className="voice-note-wave-visual">
          {waveBars.map((barHeight, idx) => {
            const barProgress = (idx / waveBars.length) * 100;
            const isPlayed = progressPercent > barProgress;
            return (
              <div
                key={idx}
                className={`voice-note-wave-bar ${isPlayed ? 'played' : ''}`}
                style={{
                  height: `${barHeight}px`,
                  backgroundColor: isPlayed ? 'var(--brand-violet)' : 'rgba(255, 255, 255, 0.25)'
                }}
              />
            );
          })}
        </div>

        <input
          type="range"
          min="0"
          max={duration || 100}
          value={currentTime}
          onChange={handleTimelineChange}
          className="voice-note-slider"
        />

        <div className="voice-note-time-info">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
}

export default function ChatWindow({
  currentUser, selectedUser, messages, onSendMessage, serverUrl, onBack,
  onClearChat, onDeleteMessage, onReactMessage, onPinMessage, onReplyMessage,
  onForwardMessage, isSidebarHidden, onToggleSidebar, isTyping, onViewImage,
  onStartCall, hasMoreMessages, loadingMore, onLoadMoreMessages, onDeleteGroup,
  isBlocked, onToggleBlock
}) {
  const [showMenu, setShowMenu] = useState(false)
  const [activeMessageMenu, setActiveMessageMenu] = useState(null)
  const [reactionMenuId, setReactionMenuId] = useState(null)
  const [showThemeSelector, setShowThemeSelector] = useState(false)
  const [previewFile, setPreviewFile] = useState(null)
  const [previewTextContent, setPreviewTextContent] = useState(null)
  const [chatTheme, setChatTheme] = useState('default')
  const [customWallpaperUrl, setCustomWallpaperUrl] = useState('')

  const [showContactInfoModal, setShowContactInfoModal] = useState(false);
  const [infoModalTab, setInfoModalTab] = useState('actions'); // 'actions' | 'media' | 'links' | 'docs'
  const [isMuted, setIsMuted] = useState(false);
  const [isEditingGroupName, setIsEditingGroupName] = useState(false);
  const [groupNameInput, setGroupNameInput] = useState('');

  useEffect(() => {
    if (!selectedUser) return;
    const chatKey = selectedUser.isGroup ? `group_${selectedUser.id}` : `user_${selectedUser.id}`;
    const savedTheme = localStorage.getItem(`samvad_theme_${chatKey}`) || 'default';
    const savedWallpaper = localStorage.getItem(`samvad_wallpaper_${chatKey}`) || '';
    setChatTheme(savedTheme);
    setCustomWallpaperUrl(savedWallpaper);

    // Mute & Group Name editing init
    const savedMuted = localStorage.getItem(`samvad_muted_${chatKey}`) === 'true';
    setIsMuted(savedMuted);
    setShowContactInfoModal(false);
    setInfoModalTab('actions');
    setIsEditingGroupName(false);
    setGroupNameInput(selectedUser.isGroup ? selectedUser.name : '');
  }, [selectedUser]);

  const handleToggleMute = () => {
    if (!selectedUser) return;
    const chatKey = selectedUser.isGroup ? `group_${selectedUser.id}` : `user_${selectedUser.id}`;
    const nextMuted = !isMuted;
    localStorage.setItem(`samvad_muted_${chatKey}`, String(nextMuted));
    setIsMuted(nextMuted);
  };

  const handleSaveGroupName = async () => {
    if (!selectedUser || !groupNameInput.trim()) return;
    try {
      await axios.put(`${serverUrl}/api/groups/${selectedUser.id}`, {
        name: groupNameInput.trim()
      });
      alert('Group name updated successfully!');
      selectedUser.name = groupNameInput.trim();
      setIsEditingGroupName(false);
    } catch (err) {
      console.error('Failed to update group name:', err);
      alert(err.response?.data?.error || 'Failed to update group name');
    }
  };

  const handleShareContact = () => {
    if (!selectedUser) return;
    const textToCopy = `Contact Name: ${selectedUser.isGroup ? selectedUser.name : selectedUser.username}\nsamvadId: ${selectedUser.samvad_id || 'Group Chat'}`;
    navigator.clipboard.writeText(textToCopy);
    alert('Contact details copied to clipboard!');
  };

  const [longPressTimer, setLongPressTimer] = useState(null)
  const fileInputRef = useRef(null)
  const touchStartX = useRef(null)
  const touchStartY = useRef(null)
  const [swipingMessageId, setSwipingMessageId] = useState(null)
  const [swipeOffset, setSwipeOffset] = useState(0)
  const [isReturning, setIsReturning] = useState(false)
  const scrollRef = useRef(null)

  // AI & Enrichment States
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const [messageTranslations, setMessageTranslations] = useState({});
  const [translatingMessageId, setTranslatingMessageId] = useState(null);

  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [summaryText, setSummaryText] = useState('');
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [showTranslateLanguageSelect, setShowTranslateLanguageSelect] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState(null);

  // Fetch AI Smart Reply suggestions
  useEffect(() => {
    if (!selectedUser || !currentUser) {
      setAiSuggestions([]);
      return;
    }
    const fetchSuggestions = async () => {
      setLoadingSuggestions(true);
      try {
        const res = await axios.get(`${serverUrl}/api/ai/suggestions?receiverId=${selectedUser.id}`);
        if (Array.isArray(res.data)) {
          setAiSuggestions(res.data);
        } else {
          setAiSuggestions([]);
        }
      } catch (err) {
        console.error('Failed to load AI suggestions:', err);
        setAiSuggestions([]);
      } finally {
        setLoadingSuggestions(false);
      }
    };
    // Fetch suggestions when selecting a user or when messages count increases
    const timer = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(timer);
  }, [selectedUser, messages.length]);

  const handleTranslate = async (targetLang) => {
    if (!activeMessageMenu) return;
    const msgId = activeMessageMenu.id;
    const originalText = activeMessageMenu.content;

    setTranslatingMessageId(msgId);
    setActiveMessageMenu(null);
    setShowTranslateLanguageSelect(false);

    try {
      const res = await axios.post(`${serverUrl}/api/ai/translate`, {
        text: originalText,
        targetLang
      });
      setMessageTranslations(prev => ({
        ...prev,
        [msgId]: {
          text: res.data.translation,
          lang: targetLang
        }
      }));
    } catch (err) {
      alert('Failed to translate message.');
    } finally {
      setTranslatingMessageId(null);
    }
  };

  const handleSpeakMessage = async () => {
    if (!activeMessageMenu?.content) return;

    const msg = activeMessageMenu;
    setActiveMessageMenu(null);
    setSpeakingMessageId(msg.id);

    const speakFallback = (text) => {
      if ('speechSynthesis' in window) {
        // Cancel any ongoing speech
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';

        // Choose a preferred English voice if available
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Natural')));
        if (preferredVoice) utterance.voice = preferredVoice;

        utterance.onend = () => setSpeakingMessageId(null);
        utterance.onerror = () => setSpeakingMessageId(null);
        window.speechSynthesis.speak(utterance);
      } else {
        alert('Speech synthesis failed and browser Text-to-Speech is not supported.');
        setSpeakingMessageId(null);
      }
    };

    try {
      const res = await axios.post(
        `${serverUrl}/api/ai/tts`,
        {
          text: msg.content,
          voiceId: 'eve',
          language: 'en'
        },
        { responseType: 'blob' }
      );
      const audioUrl = URL.createObjectURL(res.data);
      const audio = new Audio(audioUrl);

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        setSpeakingMessageId(null);
      };

      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl);
        setSpeakingMessageId(null);
      };

      await audio.play();
    } catch (err) {
      console.warn('Server TTS failed, falling back to browser SpeechSynthesis.', err);
      speakFallback(msg.content);
    }
  };

  const handleSummarize = async () => {
    setShowMenu(false);
    setLoadingSummary(true);
    setShowSummaryModal(true);
    setSummaryText('Analyzing conversation and generating bulleted AI highlights...');

    try {
      const res = await axios.get(`${serverUrl}/api/ai/summarize?userId=${selectedUser.id}`);
      setSummaryText(res.data?.summary || 'No summary returned by AI.');
    } catch (err) {
      setSummaryText('Failed to generate AI conversation summary. Please try again.');
    } finally {
      setLoadingSummary(false);
    }
  };

  const scrollToAndHighlightMessage = (messageId) => {
    if (!messageId) return;
    const el = document.getElementById(`msg-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const bubble = el.querySelector('.message-bubble');
      if (bubble) {
        bubble.classList.remove('highlight-pulse');
        void bubble.offsetWidth; // Trigger reflow
        bubble.classList.add('highlight-pulse');
        setTimeout(() => {
          if (bubble) bubble.classList.remove('highlight-pulse');
        }, 2000);
      }
    }
  };

  const triggerMessageMenu = (msg) => {
    setActiveMessageMenu(msg);
    setTimeout(() => {
      const el = document.getElementById(`msg-${msg.id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 150);
  };

  const handleLongPress = (msg) => {
    triggerMessageMenu(msg);
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
    if (selectedUser) {
      const chatKey = selectedUser.isGroup ? `group_${selectedUser.id}` : `user_${selectedUser.id}`;
      localStorage.setItem(`samvad_theme_${chatKey}`, themeId);
    }
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
      setChatTheme('custom');
      if (selectedUser) {
        const chatKey = selectedUser.isGroup ? `group_${selectedUser.id}` : `user_${selectedUser.id}`;
        localStorage.setItem(`samvad_wallpaper_${chatKey}`, url);
        localStorage.setItem(`samvad_theme_${chatKey}`, 'custom');
      }
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

  const isPagingRef = useRef(false)
  const oldScrollHeightRef = useRef(0)
  const prevSelectedUserRef = useRef(null)

  const handleScroll = () => {
    if (!scrollRef.current || loadingMore || !hasMoreMessages) return;
    if (scrollRef.current.scrollTop <= 10) {
      isPagingRef.current = true;
      oldScrollHeightRef.current = scrollRef.current.scrollHeight;
      onLoadMoreMessages();
    }
  };

  useEffect(() => {
    if (!scrollRef.current) return;

    if (prevSelectedUserRef.current !== selectedUser?.id) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      prevSelectedUserRef.current = selectedUser?.id;
      isPagingRef.current = false;
      return;
    }

    if (isPagingRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight - oldScrollHeightRef.current;
      isPagingRef.current = false;
    } else {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, selectedUser]);

  if (!selectedUser) {
    return (
      <div className="chat-area empty-chat-area">
        <div className="empty-chat-container">
          <div className="empty-chat-glowing-logo">
            <img src="/icons/icon-192.png" alt="Samvad Logo" className="empty-chat-logo" />
            <div className="logo-pulse-ring"></div>
          </div>
          <h2 className="empty-chat-title">Samvad App</h2>
          <p className="empty-chat-subtitle">
            Seamless real-time messaging, secure voice/video calling, and intelligent AI assistance in one premium space.
          </p>
          <div className="empty-chat-divider"></div>
          <p className="empty-chat-encryption">
            🔒 End-to-end encrypted. Your personal messages are secure.
          </p>
        </div>
      </div>
    )
  }

  const renderTextWithLinks = (text) => {
    if (!text || typeof text !== 'string') return text;

    // Split by URLs first
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);

    return parts.map((part, partIdx) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={`url-${partIdx}`}
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

      // Process code blocks ```code```
      const codeBlockRegex = /(```[\s\S]*?```)/g;
      const subParts = part.split(codeBlockRegex);

      return subParts.map((subPart, subIdx) => {
        if (subPart.startsWith('```') && subPart.endsWith('```')) {
          const codeLines = subPart.slice(3, -3).trim().split('\n');
          let lang = '';
          let code = subPart.slice(3, -3).trim();
          if (codeLines.length > 0 && /^[a-zA-Z0-9+#]+$/.test(codeLines[0])) {
            lang = codeLines[0];
            code = codeLines.slice(1).join('\n');
          }
          return (
            <div key={`code-block-${subIdx}`} className="code-block-container" style={{ margin: '8px 0', background: 'rgba(0, 0, 0, 0.4)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
              {lang && <div className="code-block-header" style={{ padding: '4px 12px', fontSize: '0.75rem', background: 'rgba(255, 255, 255, 0.03)', color: '#888', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', textTransform: 'uppercase', fontFamily: 'monospace' }}>{lang}</div>}
              <pre style={{ margin: 0, padding: '10px 12px', overflowX: 'auto', fontFamily: 'monospace', fontSize: '0.88rem', color: '#e5c7ff', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{code}</pre>
            </div>
          );
        }

        // Process inline code `code`
        const inlineCodeRegex = /(`[^`]+`)/g;
        const inlineParts = subPart.split(inlineCodeRegex);

        return inlineParts.map((inlinePart, inlineIdx) => {
          if (inlinePart.startsWith('`') && inlinePart.endsWith('`')) {
            return (
              <code key={`inline-code-${inlineIdx}`} style={{ background: 'rgba(255, 255, 255, 0.1)', padding: '2px 6px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '0.9rem', color: '#ffb3ff' }}>
                {inlinePart.slice(1, -1)}
              </code>
            );
          }

          // Process bold **text**
          const boldRegex = /(\*\*[^*]+\*\*)/g;
          const boldParts = inlinePart.split(boldRegex);

          return boldParts.map((boldPart, boldIdx) => {
            if (boldPart.startsWith('**') && boldPart.endsWith('**')) {
              return <strong key={`bold-${boldIdx}`} style={{ fontWeight: '700', color: '#fff' }}>{boldPart.slice(2, -2)}</strong>;
            }

            // Process italic *text*
            const italicRegex = /(\*[^*]+\*)/g;
            const italicParts = boldPart.split(italicRegex);

            return italicParts.map((italicPart, italicIdx) => {
              if (italicPart.startsWith('*') && italicPart.endsWith('*')) {
                return <em key={`italic-${italicIdx}`} style={{ fontStyle: 'italic' }}>{italicPart.slice(1, -1)}</em>;
              }

              return <span key={`text-${italicIdx}`}>{italicPart}</span>;
            });
          });
        });
      });
    });
  };

  const getFileCardDetails = (fileName) => {
    const lower = String(fileName || '').toLowerCase();
    if (lower.endsWith('.pdf')) {
      return {
        icon: <MdPictureAsPdf style={{ color: '#ef4444' }} />,
        tag: 'PDF Document',
        className: 'file-pdf'
      };
    }
    if (lower.endsWith('.ppt') || lower.endsWith('.pptx')) {
      return {
        icon: <MdSlideshow style={{ color: '#f97316' }} />,
        tag: 'PowerPoint Presentation',
        className: 'file-ppt'
      };
    }
    if (lower.endsWith('.doc') || lower.endsWith('.docx')) {
      return {
        icon: <MdDescription style={{ color: '#3b82f6' }} />,
        tag: 'Word Document',
        className: 'file-word'
      };
    }
    if (lower.endsWith('.xls') || lower.endsWith('.xlsx') || lower.endsWith('.csv')) {
      return {
        icon: <MdTableChart style={{ color: '#22c55e' }} />,
        tag: 'Spreadsheet',
        className: 'file-excel'
      };
    }
    if (lower.endsWith('.zip') || lower.endsWith('.rar') || lower.endsWith('.tar') || lower.endsWith('.gz')) {
      return {
        icon: <MdArchive style={{ color: '#eab308' }} />,
        tag: 'Compressed Archive',
        className: 'file-archive'
      };
    }
    return {
      icon: <MdInsertDriveFile style={{ color: '#a855f7' }} />,
      tag: 'File',
      className: 'file-generic'
    };
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
        const audioSrc = msg.file_url?.startsWith('http') ? msg.file_url : `${serverUrl}${msg.file_url}`;
        const senderObj = msg.sender_id === currentUser.id
          ? currentUser
          : (selectedUser.isGroup
            ? { username: msg.sender_name, profile_pic: msg.sender_profile_pic }
            : selectedUser);
        return <VoiceNotePlayer src={audioSrc} sender={senderObj} isCurrentUser={msg.sender_id === currentUser.id} serverUrl={serverUrl} fileName={msg.content} />
      case 'file':
        const fileDetails = getFileCardDetails(msg.content);
        return (
          <div
            className={`file-message-card ${fileDetails.className}`}
            onClick={(e) => {
              e.stopPropagation();
              const src = msg.file_url?.startsWith('http') ? msg.file_url : `${serverUrl}${msg.file_url}`;
              const fileName = msg.content || '';
              const combinedStr = `${fileName} ${src}`.toLowerCase();
              const isPdf = combinedStr.includes('.pdf');
              const isOffice = combinedStr.match(/\.(doc|docx|ppt|pptx|xls|xlsx)/);
              const isText = combinedStr.match(/\.(txt|csv|json|md)/);

              if (isPdf) {
                const isCloudinary = src.includes('cloudinary.com');
                if (isCloudinary) {
                  window.open(`${serverUrl}/api/view-pdf?url=${encodeURIComponent(src)}`, '_blank');
                } else {
                  window.open(src, '_blank');
                }
              } else if (isOffice) {
                window.open(`https://docs.google.com/viewer?url=${encodeURIComponent(src)}`, '_blank');
              } else if (isText) {
                // Fetch text content directly to preview it
                setPreviewFile({ url: src, name: fileName, type: 'text' });
                setPreviewTextContent('Loading...');
                axios.get(src)
                  .then(res => setPreviewTextContent(typeof res.data === 'object' ? JSON.stringify(res.data, null, 2) : String(res.data)))
                  .catch(err => setPreviewTextContent('Failed to load text content.'));
              } else {
                window.open(src, '_blank');
              }
            }}
          >
            <div className="file-icon">
              {fileDetails.icon}
            </div>
            <div className="file-info">
              <span className="file-name">{msg.content}</span>
              <span className="file-tag">{fileDetails.tag}</span>
              <span className="file-size-tap">
                {msg.content?.toLowerCase().match(/\.(txt|csv|json|md)$/) ? 'Tap to preview' : 'Tap to open'}
              </span>
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

  const isAiChat = selectedUser?.samvad_id === 'ai#9999';

  return (
    <div className={`chat-area ${isAiChat ? 'ai-chat-area' : ''}`}>
      <div className="chat-header">
        <div className="back-btn" onClick={onBack}>
          <MdArrowBack />
        </div>
        <div className="user-avatar"
          onClick={() => setShowContactInfoModal(true)}
          style={{ width: '40px', height: '40px', fontSize: '1.1rem', margin: 0, background: 'var(--brand-violet)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {selectedUser.isGroup ? (
            selectedUser.avatar ? (
              <img src={selectedUser.avatar} alt="dp" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              selectedUser.name.charAt(0).toUpperCase()
            )
          ) : (
            selectedUser.profile_pic ? (
              <img src={selectedUser.profile_pic.startsWith('http') ? selectedUser.profile_pic : `${serverUrl}${selectedUser.profile_pic}`} alt="dp" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              selectedUser.username.charAt(0).toUpperCase()
            )
          )}
        </div>
        <div className="chat-header-info" onClick={() => setShowContactInfoModal(true)} style={{ cursor: 'pointer' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {selectedUser.isGroup ? selectedUser.name : selectedUser.username}
            {isMuted && <MdNotificationsOff size={14} style={{ color: '#ff4b4b' }} />}
            {isBlocked && <span style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: 'bold' }}>(Blocked)</span>}
          </h3>
          {selectedUser.isGroup ? (
            <span style={{ textTransform: 'none', color: isTyping ? 'var(--brand-violet)' : 'inherit' }}>
              {isTyping ? `${isTyping} typing...` : `${selectedUser.members?.length || 0} members: ${selectedUser.members?.map(m => m.username).join(', ')}`}
            </span>
          ) : (
            <span style={{ textTransform: 'lowercase', color: isTyping ? 'var(--brand-violet)' : 'inherit' }}>
              {isTyping ? 'typing...' : (selectedUser.online ? 'Online' : formatLastSeen(selectedUser.last_seen))}
            </span>
          )}
        </div>
        <div className="chat-header-actions" style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div className="header-action-btn" onClick={() => setShowSearch(!showSearch)} title="Search Messages" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <MdSearch size={22} />
          </div>
          {!selectedUser.isGroup && (
            <>
              <div className="header-action-btn" onClick={() => onStartCall('audio')} title="Audio Call" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                <MdCall size={22} />
              </div>
              <div className="header-action-btn" onClick={() => onStartCall('video')} title="Video Call" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                <MdVideocam size={22} />
              </div>
            </>
          )}
          <div className="header-action-btn desktop-only" onClick={onToggleSidebar} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }} title={isSidebarHidden ? "Exit Fullscreen" : "Fullscreen Chat"}>
            {isSidebarHidden ? <MdFullscreenExit size={24} /> : <MdFullscreen size={24} />}
          </div>
          <MdMoreVert onClick={() => setShowMenu(!showMenu)} style={{ cursor: 'pointer' }} />

          {showMenu && (
            <>
              <div
                className="dropdown-overlay"
                onClick={() => setShowMenu(false)}
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  zIndex: 998,
                  background: 'transparent',
                  cursor: 'default'
                }}
              />
              <div className="header-dropdown" style={{ zIndex: 999 }}>
                <div className="dropdown-item" onClick={() => { setShowThemeSelector(true); setShowMenu(false); }}>
                  <MdPalette /> Chat Theme
                </div>
                <div className="dropdown-item" onClick={handleSummarize}>
                  <MdInfoOutline /> AI Summarize Chat
                </div>
                {!selectedUser.isGroup && (
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
                )}
                {selectedUser.isGroup && currentUser && selectedUser.creator_id === currentUser.id && (
                  <div className="dropdown-item" style={{ color: '#ef4444' }} onClick={async (e) => {
                    e.stopPropagation();
                    if (window.confirm(`Are you sure you want to delete the group "${selectedUser.name}"? This will permanently delete all messages and remove all members.`)) {
                      try {
                        await axios.delete(`${serverUrl}/api/groups/${selectedUser.id}`);
                        setShowMenu(false);
                        if (onDeleteGroup) {
                          onDeleteGroup(selectedUser.id);
                        }
                      } catch (err) {
                        console.error('Failed to delete group:', err);
                        alert(err.response?.data?.error || 'Failed to delete group');
                      }
                    }
                  }}>
                    <MdDeleteOutline /> Delete Group
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Real-time Search Input Bar */}
      {showSearch && (
        <div className="chat-search-bar-sliding">
          <MdSearch size={20} color="#8e8e93" />
          <input
            type="text"
            placeholder="Search in this conversation..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            autoFocus
          />
          {searchQuery && (
            <span className="clear-search-btn" onClick={() => setSearchQuery('')}>&times;</span>
          )}
          <span className="close-search-btn" onClick={() => { setShowSearch(false); setSearchQuery(''); }}>Cancel</span>
        </div>
      )}

      {/* Pinned Messages Header */}
      {messages.some(m => m.is_pinned) && (
        <div className="pinned-messages-bar" onClick={() => {
          const firstPinned = [...messages].reverse().find(m => m.is_pinned);
          if (firstPinned) {
            scrollToAndHighlightMessage(firstPinned.id);
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
        onScroll={handleScroll}
        style={chatTheme === 'custom' ? { backgroundImage: `url(${customWallpaperUrl})` } : {}}
      >
        {loadingMore && (
          <div className="paging-loader" style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '12px 10px',
            fontSize: '0.85rem',
            color: '#8b5cf6',
            gap: '8px',
            width: '100%'
          }}>
            <div className="spinner-loader" style={{
              width: '14px',
              height: '14px',
              border: '2px solid rgba(139, 92, 246, 0.2)',
              borderTopColor: '#8b5cf6',
              borderRadius: '50%',
              animation: 'spin 0.6s linear infinite'
            }} />
            <span>Loading chat history...</span>
          </div>
        )}
        <div className="date-separator">
          {formatHeaderDate()}
        </div>
        {messages
          .filter(msg => {
            if (!searchQuery.trim()) return true;
            return msg.content && msg.content.toLowerCase().includes(searchQuery.toLowerCase());
          })
          .map(msg => {
            const isSender = msg.sender_id === currentUser.id
            const emojiOnly = msg.type === 'text' && isOnlyEmojis(msg.content);

            return (
              <div
                key={msg.id}
                id={`msg-${msg.id}`}
                className={`message-wrapper ${isSender ? 'sent' : 'received'} ${activeMessageMenu?.id === msg.id ? 'context-active' : ''}`}
                onContextMenu={(e) => {
                  e.preventDefault();
                  triggerMessageMenu(msg);
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
                  {selectedUser.isGroup && !isSender && (
                    <div className="message-sender-name-tag" style={{ fontWeight: 'bold', fontSize: '0.8rem', color: '#c084fc', marginBottom: '4px', cursor: 'pointer' }}>
                      {msg.sender_name || 'Someone'}
                    </div>
                  )}
                  {msg.reply_to && (
                    <div
                      className="message-reply-quote"
                      onClick={(e) => {
                        e.stopPropagation();
                        scrollToAndHighlightMessage(msg.reply_to);
                      }}
                      style={{ cursor: 'pointer' }}
                    >
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

                  {translatingMessageId === msg.id && (
                    <div className="ai-translation-loader">
                      <span className="translating-spinner"></span> Translating...
                    </div>
                  )}

                  {speakingMessageId === msg.id && (
                    <div className="ai-translation-loader">
                      <span className="translating-spinner"></span> Speaking...
                    </div>
                  )}

                  {messageTranslations[msg.id] && (
                    <div className="ai-translated-container">
                      <div className="translation-divider"></div>
                      <span className="translation-badge"><MdTranslate size={11} /> Translated to {messageTranslations[msg.id].lang}</span>
                      <p className="translation-text">{messageTranslations[msg.id].text}</p>
                    </div>
                  )}
                  <div className="bubble-meta">
                    {!!msg.is_forwarded && <span className="forwarded-label">Forwarded</span>}
                    {(Date.now() - new Date(msg.timestamp).getTime() < 60000)
                      ? 'Now'
                      : new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {isSender && (
                      msg.status === 'read' ? <MdDoneAll size={15} color="#53bdeb" /> :
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

        {/* AI suggested smart replies pills */}
        {Array.isArray(aiSuggestions) && aiSuggestions.length > 0 && !isTyping && (
          <div className="ai-suggestions-container-wrapper">
            <span className="ai-suggestions-title"><MdChat size={12} /> Suggested Replies</span>
            <div className="ai-suggestions-pills-row">
              {aiSuggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className="ai-suggestion-pill"
                  onClick={() => {
                    onSendMessage({ content: suggestion, type: 'text' });
                    setAiSuggestions(prev => Array.isArray(prev) ? prev.filter(s => s !== suggestion) : []);
                  }}
                >
                  {suggestion}
                </div>
              ))}
            </div>
          </div>
        )}
        {activeMessageMenu && <div className="mobile-context-spacer" />}
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
              {activeMessageMenu.type === 'text' && (
                <div className="context-item" onClick={() => setShowTranslateLanguageSelect(true)}>
                  <MdTranslate /> AI Translate
                </div>
              )}
              {activeMessageMenu.type === 'text' && (
                <div className="context-item" onClick={handleSpeakMessage}>
                  <MdVolumeUp /> AI Speak
                </div>
              )}
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
        <div className="context-menu-overlay" style={{ zIndex: 9999, display: 'flex', flexDirection: 'column' }} onClick={() => { setPreviewFile(null); setPreviewTextContent(null); }}>
          <div className="preview-header" style={{ width: '100%', padding: '15px 20px', background: '#1c1c24', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <MdInsertDriveFile size={24} color="#a78bfa" />
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '250px' }}>{previewFile.name}</h3>
            </div>
            <MdClose size={28} color="#fff" style={{ cursor: 'pointer' }} onClick={() => { setPreviewFile(null); setPreviewTextContent(null); }} />
          </div>
          <div className="preview-body" style={{ flex: 1, width: '100%', background: '#fff', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
            {previewFile.type === 'text' ? (
              <pre style={{ padding: '20px', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#000', fontSize: '14px', fontFamily: 'monospace' }}>
                {previewTextContent}
              </pre>
            ) : (
              <iframe
                src={previewFile.url}
                style={{ width: '100%', height: '100%', border: 'none' }}
                title="Document Preview"
              />
            )}
          </div>
        </div>
      )}
      {/* Language Selection overlay */}
      {showTranslateLanguageSelect && (
        <div className="context-menu-overlay" onClick={() => setShowTranslateLanguageSelect(false)}>
          <div className="context-menu" onClick={e => e.stopPropagation()}>
            <div className="context-list">
              <div style={{ padding: '10px 15px', fontSize: '0.8rem', color: 'var(--signal-text-muted)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                Select Target Language
              </div>
              {['English', 'Spanish', 'Hindi', 'French', 'Japanese', 'Tibetan', 'Malayalam', 'Marathi', 'Kannada'].map(lang => (
                <div key={lang} className="context-item" onClick={() => handleTranslate(lang)}>
                  {lang}
                </div>
              ))}
              <div className="context-item delete" onClick={() => setShowTranslateLanguageSelect(false)}>
                Cancel
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Summary Modal */}
      {showSummaryModal && (
        <div className="chat-summary-overlay" onClick={() => setShowSummaryModal(false)}>
          <div className="summary-modal-card" onClick={e => e.stopPropagation()}>
            <div className="summary-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MdInfoOutline size={22} color="var(--brand-violet)" />
                <h3>Samvad AI Chat Summary</h3>
              </div>
              <span className="close-summary-btn" onClick={() => setShowSummaryModal(false)}>&times;</span>
            </div>

            <div className="summary-modal-body">
              {loadingSummary ? (
                <div className="summary-loading-state">
                  <div className="summary-pulse-ring"></div>
                  <p>Samvad AI is reading chat logs...</p>
                </div>
              ) : (
                <div className="summary-markdown-rendered">
                  {(summaryText || '').split('\n').map((line, idx) => {
                    if (line.startsWith('###')) {
                      return <h4 key={idx} style={{ marginTop: '15px', color: 'var(--brand-violet)' }}>{line.replace('###', '').trim()}</h4>;
                    }
                    if (line.startsWith('####')) {
                      return <h5 key={idx} style={{ marginTop: '10px', color: '#fff' }}>{line.replace('####', '').trim()}</h5>;
                    }
                    if (line.startsWith('-')) {
                      return <li key={idx} style={{ marginLeft: '15px', marginBottom: '5px', fontSize: '0.9rem', color: 'var(--signal-text-muted)' }}>{line.replace('-', '').trim()}</li>;
                    }
                    return <p key={idx} style={{ marginBottom: '10px', fontSize: '0.95rem', lineHeight: '1.4' }}>{line}</p>;
                  })}
                </div>
              )}
            </div>
            <button className="primary-btn" style={{ marginTop: '20px' }} onClick={() => setShowSummaryModal(false)}>Close Summary</button>
          </div>
        </div>
      )}

      {/* Contact Details Modal */}
      {showContactInfoModal && (
        <div className="context-menu-overlay" style={{ zIndex: 99999 }} onClick={() => setShowContactInfoModal(false)}>
          <div className="contact-details-modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '10px', marginBottom: '15px' }}>
              <h3 style={{ margin: 0 }}>Contact Details</h3>
              <MdClose size={24} style={{ cursor: 'pointer' }} onClick={() => setShowContactInfoModal(false)} />
            </div>

            {infoModalTab === 'actions' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', alignItems: 'center' }}>
                <div
                  className="user-avatar"
                  onClick={() => {
                    if (selectedUser.isGroup) {
                      if (selectedUser.avatar) onViewImage(selectedUser.avatar);
                    } else if (selectedUser.profile_pic) {
                      onViewImage(selectedUser.profile_pic.startsWith('http') ? selectedUser.profile_pic : `${serverUrl}${selectedUser.profile_pic}`);
                    }
                  }}
                  style={{ width: '80px', height: '80px', fontSize: '2.5rem', background: 'var(--brand-violet)', cursor: 'pointer', margin: '0 auto' }}
                >
                  {selectedUser.isGroup ? (
                    selectedUser.avatar ? (
                      <img src={selectedUser.avatar} alt="dp" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      selectedUser.name.charAt(0).toUpperCase()
                    )
                  ) : (
                    selectedUser.profile_pic ? (
                      <img src={selectedUser.profile_pic.startsWith('http') ? selectedUser.profile_pic : `${serverUrl}${selectedUser.profile_pic}`} alt="dp" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      selectedUser.username.charAt(0).toUpperCase()
                    )
                  )}
                </div>

                <div style={{ textAlign: 'center' }}>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: 'bold', margin: '5px 0' }}>
                    {selectedUser.isGroup ? selectedUser.name : selectedUser.username}
                  </h2>
                  <p style={{ color: 'var(--signal-text-muted)', fontSize: '0.85rem', margin: 0 }}>
                    {selectedUser.isGroup ? 'Group Chat' : `samvadId: ${selectedUser.samvad_id}`}
                  </p>
                </div>

                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                  <div className="context-item" onClick={handleShareContact} style={{ padding: '12px 15px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', borderBottom: 'none' }}>
                    <MdShare /> Share Contact
                  </div>

                  {selectedUser.isGroup && currentUser && selectedUser.creator_id === currentUser.id && (
                    <>
                      <div className="context-item" onClick={() => setIsEditingGroupName(!isEditingGroupName)} style={{ padding: '12px 15px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', borderBottom: 'none' }}>
                        <MdEdit /> {isEditingGroupName ? 'Cancel Edit' : 'Edit Group Name'}
                      </div>

                      {isEditingGroupName && (
                        <div style={{ display: 'flex', gap: '8px', padding: '0 5px', width: '100%' }}>
                          <input
                            id="edit-group-name"
                            name="edit_group_name"
                            type="text"
                            placeholder="Enter group name..."
                            value={groupNameInput}
                            onChange={e => setGroupNameInput(e.target.value)}
                            style={{ padding: '8px 12px', fontSize: '0.9rem', flex: 1, background: '#121212', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '8px' }}
                            autoComplete="off"
                          />
                          <button
                            className="primary-btn"
                            onClick={handleSaveGroupName}
                            style={{ padding: '8px 15px', fontSize: '0.85rem', width: 'auto', marginTop: 0 }}
                          >
                            Save
                          </button>
                        </div>
                      )}
                    </>
                  )}

                  <div className="context-item" onClick={handleToggleMute} style={{ padding: '12px 15px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', borderBottom: 'none' }}>
                    {isMuted ? <MdNotifications /> : <MdNotificationsOff />} {isMuted ? 'Unmute Notifications' : 'Mute Notifications'}
                  </div>

                  {!selectedUser.isGroup && (
                    <div className="context-item delete" onClick={onToggleBlock} style={{ padding: '12px 15px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.05)', borderBottom: 'none' }}>
                      <MdBlock /> {isBlocked ? 'Unblock Contact' : 'Block Contact'}
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginTop: '10px', width: '100%' }}>
                    <button
                      className="social-btn"
                      onClick={() => setInfoModalTab('media')}
                      style={{ fontSize: '0.8rem', padding: '10px 5px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                    >
                      <MdPhotoLibrary size={18} /> Media ({messages.filter(m => m.type === 'image' || m.type === 'video').length})
                    </button>
                    <button
                      className="social-btn"
                      onClick={() => setInfoModalTab('links')}
                      style={{ fontSize: '0.8rem', padding: '10px 5px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                    >
                      <MdLink size={18} /> Links ({messages.filter(m => m.type === 'text' && /(https?:\/\/[^\s]+)/g.test(m.content)).length})
                    </button>
                    <button
                      className="social-btn"
                      onClick={() => setInfoModalTab('docs')}
                      style={{ fontSize: '0.8rem', padding: '10px 5px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                    >
                      <MdInsertDriveFile size={18} /> Docs ({messages.filter(m => m.type === 'file').length})
                    </button>
                  </div>
                </div>
              </div>
            )}

            {infoModalTab !== 'actions' && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '350px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                  <span
                    onClick={() => setInfoModalTab('actions')}
                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.9rem', color: 'var(--brand-violet)' }}
                  >
                    <MdArrowBack size={18} /> Back
                  </span>
                  <h4 style={{ margin: 0, textTransform: 'capitalize' }}>Shared {infoModalTab}</h4>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', paddingRight: '5px' }}>
                  {infoModalTab === 'media' && (
                    messages.filter(m => m.type === 'image' || m.type === 'video').length === 0 ? (
                      <p style={{ color: 'var(--signal-text-muted)', fontSize: '0.9rem', textAlign: 'center', marginTop: '50px' }}>No shared media.</p>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                        {messages.filter(m => m.type === 'image' || m.type === 'video').map(m => {
                          const src = m.file_url?.startsWith('http') ? m.file_url : `${serverUrl}${m.file_url}`;
                          return (
                            <div key={m.id} style={{ position: 'relative', aspectRatio: '1', borderRadius: '8px', overflow: 'hidden', cursor: 'pointer', background: '#000' }} onClick={() => { setShowContactInfoModal(false); if (m.type === 'image') onViewImage(src); }}>
                              {m.type === 'image' ? (
                                <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                <video src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )
                  )}

                  {infoModalTab === 'links' && (
                    messages.filter(m => m.type === 'text' && /(https?:\/\/[^\s]+)/g.test(m.content)).length === 0 ? (
                      <p style={{ color: 'var(--signal-text-muted)', fontSize: '0.9rem', textAlign: 'center', marginTop: '50px' }}>No shared links.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {messages.filter(m => m.type === 'text' && /(https?:\/\/[^\s]+)/g.test(m.content)).map(m => {
                          const urls = m.content.match(/(https?:\/\/[^\s]+)/g);
                          return urls ? urls.map((url, uidx) => (
                            <div key={`${m.id}-${uidx}`} style={{ padding: '10px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', wordBreak: 'break-all' }}>
                              <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: '#c084fc', textDecoration: 'underline', fontSize: '0.85rem' }}>{url}</a>
                              <div style={{ fontSize: '0.7rem', color: 'var(--signal-text-muted)', marginTop: '4px' }}>
                                Sent by {m.sender_name || (m.sender_id === currentUser.id ? 'You' : 'Someone')}
                              </div>
                            </div>
                          )) : null;
                        })}
                      </div>
                    )
                  )}

                  {infoModalTab === 'docs' && (
                    messages.filter(m => m.type === 'file').length === 0 ? (
                      <p style={{ color: 'var(--signal-text-muted)', fontSize: '0.9rem', textAlign: 'center', marginTop: '50px' }}>No shared documents.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {messages.filter(m => m.type === 'file').map(m => {
                          const fileDetails = getFileCardDetails(m.content);
                          const src = m.file_url?.startsWith('http') ? m.file_url : `${serverUrl}${m.file_url}`;
                          return (
                            <div
                              key={m.id}
                              className={`file-message-card ${fileDetails.className}`}
                              style={{ maxWidth: '100%', margin: 0, padding: '8px 12px' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowContactInfoModal(false);
                                const combinedStr = `${m.content || ''} ${src}`.toLowerCase();
                                const isPdf = combinedStr.includes('.pdf');
                                const isOffice = combinedStr.match(/\.(doc|docx|ppt|pptx|xls|xlsx)/);

                                if (isPdf) {
                                  if (src.includes('cloudinary.com')) {
                                    window.open(`${serverUrl}/api/view-pdf?url=${encodeURIComponent(src)}`, '_blank');
                                  } else {
                                    window.open(src, '_blank');
                                  }
                                } else if (isOffice) {
                                  window.open(`https://docs.google.com/viewer?url=${encodeURIComponent(src)}`, '_blank');
                                } else {
                                  window.open(src, '_blank');
                                }
                              }}
                            >
                              <div className="file-icon" style={{ width: '32px', height: '32px', fontSize: '1.2rem' }}>
                                {fileDetails.icon}
                              </div>
                              <div className="file-info" style={{ minWidth: 0 }}>
                                <span className="file-name" style={{ fontSize: '0.85rem' }}>{m.content}</span>
                                <span className="file-tag" style={{ fontSize: '0.65rem' }}>{fileDetails.tag}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
