import React, { useState, useRef } from 'react'
import EmojiPicker, { Theme } from 'emoji-picker-react'
import axios from 'axios'
import { MdInsertEmoticon, MdAdd, MdMic, MdInsertPhoto, MdSend, MdCameraAlt } from 'react-icons/md'

export default function MessageInput({ onSendMessage, serverUrl, replyingTo, onCancelReply, onTyping }) {
  const [text, setText] = useState('')
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  
  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const typingTimeoutRef = useRef(null)

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

  const onEmojiClick = (emojiObject) => {
    setText(prev => prev + emojiObject.emoji)
  }

  const startRecording = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('Your browser does not support audio recording or you are not in a secure (HTTPS) context.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        const audioFile = new File([audioBlob], `voice-note-${Date.now()}.webm`, { type: 'audio/webm' })
        
        // Upload the recorded file
        await uploadFile(audioFile)
        
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)
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

  const uploadFile = async (file) => {
    setIsUploading(true)
    const formData = new FormData()
    formData.append('file', file)

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
        <div className="input-pill-wrapper">
          <div className="emoji-icon" onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
            <MdInsertEmoticon />
          </div>

          {showEmojiPicker && (
            <div className="emoji-picker-container">
              <EmojiPicker onEmojiClick={onEmojiClick} theme={Theme.DARK} />
            </div>
          )}
          
          <input 
            type="text" 
            className="message-input"
            placeholder={isRecording ? "Recording audio..." : (isUploading ? "Uploading..." : "Message")}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            disabled={isUploading || isRecording}
          />

          <div className="input-pill-actions">
            <MdCameraAlt onClick={() => cameraInputRef.current.click()} />
            <MdMic onClick={startRecording} />
          </div>
        </div>

        <div className="action-circle-btn">
          {text.trim().length > 0 ? (
            <MdSend onClick={handleSend} />
          ) : (
            isRecording ? (
              <div className="stop-recording-btn" onClick={stopRecording}>
                <div className="pulsating-dot"></div>
                <MdSend style={{color: '#ff4b4b'}} />
              </div>
            ) : (
              <MdAdd onClick={() => fileInputRef.current.click()} />
            )
          )}
        </div>
      </div>

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
