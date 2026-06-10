import React, { useState, useRef, useEffect } from 'react'
import EmojiPicker, { Theme, Categories } from 'emoji-picker-react'
import axios from 'axios'
import { MdInsertEmoticon, MdAdd, MdMic, MdInsertPhoto, MdSend, MdCameraAlt, MdDeleteOutline } from 'react-icons/md'

const StickerIcon = ({ className }) => (
  <svg 
    stroke="currentColor" 
    fill="none" 
    strokeWidth="2" 
    viewBox="0 0 24 24" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className} 
    height="1.1em" 
    width="1.1em" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
    <path d="M20 12v-6a2 2 0 0 0 -2 -2h-12a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h6" />
    <path d="M20 12a8 8 0 0 1 -8 8" />
    <path d="M20 12h-5a3 3 0 0 0 -3 3v5" />
  </svg>
);

export default function MessageInput({ onSendMessage, serverUrl, replyingTo, onCancelReply, onTyping }) {
  const [text, setText] = useState('')
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [activeTab, setActiveTab] = useState('emoji')
  const emojiContainerRef = useRef(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  
  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const typingTimeoutRef = useRef(null)

  const canvasRef = useRef(null)
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const animationFrameRef = useRef(null)
  const streamRef = useRef(null)
  const timerIntervalRef = useRef(null)

  const handleSend = () => {
    if (!text.trim()) return
    onSendMessage({
      content: text,
      type: 'text'
    })
    setText('')
    setShowEmojiPicker(false)
    if (onTyping) onTyping(false)
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
  }

  const handleTextChange = (e) => {
    setText(e.target.value)
    if (onTyping) {
      onTyping(true)
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = setTimeout(() => {
        onTyping(false)
      }, 1500)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSend()
    }
  }

  const onEmojiClick = (emojiData) => {
    if (emojiData && emojiData.emoji) {
      setText(prev => prev + emojiData.emoji)
    }
  }

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (emojiContainerRef.current && !emojiContainerRef.current.contains(event.target)) {
        const emojiBtn = event.target.closest('.emoji-icon');
        if (!emojiBtn) {
          setShowEmojiPicker(false);
        }
      }
    };

    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showEmojiPicker]);

  const startVisualizer = (stream) => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioContext();
      audioContextRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256; 
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');

      const draw = () => {
        if (!analyserRef.current) return;
        animationFrameRef.current = requestAnimationFrame(draw);

        analyser.getByteTimeDomainData(dataArray);

        const width = canvas.width;
        const height = canvas.height;

        ctx.fillStyle = '#1e1e2d'; 
        ctx.fillRect(0, 0, width, height);

        // Draw center reference line
        ctx.strokeStyle = 'rgba(139, 92, 246, 0.1)'; 
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();

        // Draw neon glowing wave
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#a78bfa'; 
        ctx.shadowColor = '#8b5cf6'; 
        ctx.shadowBlur = 6;
        ctx.beginPath();

        const sliceWidth = width / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0;
          const y = (v * height) / 2;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }

          x += sliceWidth;
        }

        ctx.lineTo(width, height / 2);
        ctx.stroke();
        
        ctx.shadowBlur = 0; // reset
      };

      draw();
    } catch (err) {
      console.error('Visualizer error:', err);
    }
  };

  const stopVisualizer = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioContextRef.current) {
      if (audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      audioContextRef.current = null;
    }
    analyserRef.current = null;
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('Your browser does not support audio recording or you are not in a secure (HTTPS) context.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        stopVisualizer();
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        const audioFile = new File([audioBlob], `voice-note-${Date.now()}.webm`, { type: 'audio/webm' })
        
        await uploadFile(audioFile)
        
        stream.getTracks().forEach(track => track.stop())
        streamRef.current = null;
      }

      mediaRecorder.start()
      setIsRecording(true)

      // Start Visualizer and Timer
      setTimeout(() => {
        startVisualizer(stream);
      }, 100);

      setRecordingTime(0);
      timerIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error('Microphone access denied', err)
      alert('Microphone access is required to record voice notes.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      audioChunksRef.current = [];
      mediaRecorderRef.current.onstop = null; 
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      stopVisualizer();
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    }
  }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const compressImage = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          const MAX_WIDTH = 1200;
          const MAX_HEIGHT = 1200;
          
          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          
          canvas.toBlob((blob) => {
            if (blob) {
              const compressed = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
                type: 'image/jpeg',
                lastModified: Date.now()
              });
              resolve(compressed);
            } else {
              resolve(file);
            }
          }, 'image/jpeg', 0.8);
        };
        img.onerror = () => resolve(file);
      };
      reader.onerror = () => resolve(file);
    });
  };

  const uploadFile = async (file) => {
    setIsUploading(true)
    let fileToUpload = file;
    
    if (file.type.startsWith('image/')) {
      console.log(`[Compression] Compressing original image of size: ${(file.size / 1024).toFixed(1)} KB`);
      try {
        fileToUpload = await compressImage(file);
        console.log(`[Compression] Compressed image successfully to size: ${(fileToUpload.size / 1024).toFixed(1)} KB`);
      } catch (err) {
        console.error('Image compression failed, using original:', err);
      }
    }

    const formData = new FormData()
    formData.append('file', fileToUpload)

    try {
      const res = await axios.post(`${serverUrl}/api/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })
      
      const { url, type } = res.data
      let msgType = 'file'
      if (type.startsWith('image/')) msgType = 'image'
      else if (type.startsWith('audio/')) msgType = 'audio'
      else if (type.startsWith('video/')) msgType = 'video'
      
      onSendMessage({
        content: file.name,
        type: msgType,
        file_url: url
      })
    } catch (err) {
      console.error('Upload failed', err)
      alert('Failed to upload message.')
    } finally {
      setIsUploading(false)
    }
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    await uploadFile(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="input-area-container">
      {replyingTo && (
        <div className="reply-preview">
          <div className="reply-preview-content">
            <span className="reply-preview-label">Replying to msg</span>
            <p className="reply-preview-text">{replyingTo.content || (replyingTo.type === 'image' ? 'Image' : 'Media')}</p>
          </div>
          <div className="reply-preview-close" onClick={onCancelReply}>
            X
          </div>
        </div>
      )}
      <div className={`input-area ${isRecording ? 'recording' : ''}`}>
        {isRecording ? (
          <div className="recording-panel-wrapper">
            <div className="recording-indicator">
              <span className="blinking-red-dot"></span>
              <span className="recording-timer">{formatTime(recordingTime)}</span>
            </div>
            
            <div className="visualizer-container">
              <canvas ref={canvasRef} className="glowing-waveform-canvas" width="160" height="32" />
            </div>

            <div className="recording-actions">
              <MdDeleteOutline className="cancel-recording-btn" onClick={cancelRecording} title="Discard Recording" />
            </div>
          </div>
        ) : (
          <div className="input-pill-wrapper">
            <div className="emoji-icon" onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
              <MdInsertEmoticon />
            </div>

            <input 
              id="chat-message-input"
              name="chat_message"
              type="text" 
              className="message-input"
              placeholder={isUploading ? "Uploading..." : "Message"}
              value={text}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              disabled={isUploading}
              autoComplete="off"
            />

            <div className="input-pill-actions">
              <MdCameraAlt onClick={() => cameraInputRef.current.click()} />
              <MdMic onClick={startRecording} />
            </div>
          </div>
        )}

        <div className="action-circle-btn">
          {text.trim().length > 0 ? (
            <MdSend onClick={handleSend} />
          ) : (
            isRecording ? (
              <div className="stop-recording-btn send-recording" onClick={stopRecording} title="Send Voice Note">
                <MdSend style={{color: '#fff'}} />
              </div>
            ) : (
              <MdAdd onClick={() => fileInputRef.current.click()} />
            )
          )}
        </div>
      </div>

      {showEmojiPicker && (
        <div className="emoji-picker-container" ref={emojiContainerRef}>
          <div className="emoji-picker-content">
            {activeTab === 'emoji' && (
              <EmojiPicker 
                onEmojiClick={onEmojiClick} 
                theme={Theme.DARK} 
                width="100%"
                height="100%"
                previewConfig={{ showPreview: false }}
                skinTonesDisabled={true}
                emojiSize={22}
                categories={[
                  {
                    category: Categories.SMILEYS_PEOPLE,
                    name: 'Smileys & People'
                  },
                  {
                    category: Categories.ANIMALS_NATURE,
                    name: 'Animals & Nature'
                  },
                  {
                    category: Categories.FOOD_DRINK,
                    name: 'Food & Drink'
                  },
                  {
                    category: Categories.TRAVEL_PLACES,
                    name: 'Travel & Places'
                  },
                  {
                    category: Categories.ACTIVITIES,
                    name: 'Activities'
                  },
                  {
                    category: Categories.OBJECTS,
                    name: 'Objects'
                  },
                  {
                    category: Categories.SYMBOLS,
                    name: 'Symbols'
                  },
                  {
                    category: Categories.FLAGS,
                    name: 'Flags'
                  }
                ]}
              />
            )}
            {activeTab === 'gif' && (
              <div className="gif-picker-content">
                <div className="search-bar-wrapper">
                  <input type="text" placeholder="Search GIF" className="gif-search-input" />
                </div>
                <div className="picker-placeholder-view">
                  <span className="placeholder-icon">🎬</span>
                  <p className="placeholder-title">GIF Search coming soon</p>
                  <p className="placeholder-subtitle">We are working on bringing GIPHY integration to Samvad!</p>
                </div>
              </div>
            )}
            {activeTab === 'sticker' && (
              <div className="sticker-picker-content">
                <div className="picker-placeholder-view">
                  <span className="placeholder-icon">✨</span>
                  <p className="placeholder-title">Sticker Pack coming soon</p>
                  <p className="placeholder-subtitle">Custom and animated sticker packs will be available in the next release!</p>
                </div>
              </div>
            )}
          </div>
          
          <div className="emoji-picker-switcher">
            <div className="switcher-pill">
              <button 
                type="button"
                className={`switcher-btn ${activeTab === 'emoji' ? 'active' : ''}`}
                onClick={() => setActiveTab('emoji')}
                title="Emoji"
              >
                <MdInsertEmoticon size={18} />
              </button>
              <button 
                type="button"
                className={`switcher-btn ${activeTab === 'gif' ? 'active' : ''}`}
                onClick={() => setActiveTab('gif')}
                title="GIF"
              >
                GIF
              </button>
              <button 
                type="button"
                className={`switcher-btn ${activeTab === 'sticker' ? 'active' : ''}`}
                onClick={() => setActiveTab('sticker')}
                title="Sticker"
              >
                <StickerIcon className="sticker-svg-icon" />
              </button>
            </div>
          </div>
        </div>
      )}

      <input 
        type="file" 
        className="hidden-input" 
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="*/*"
      />
      <input 
        type="file" 
        className="hidden-input" 
        ref={cameraInputRef}
        onChange={handleFileUpload}
        accept="image/*"
        capture="environment"
      />
    </div>
  )
}
