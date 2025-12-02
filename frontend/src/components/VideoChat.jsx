import React, { useState, useRef, useEffect } from 'react'
import './VideoChat.css'
import '../styles/mobileVideo.scss'

function VideoChat({ variant = 'desktop', onNavigate }) {
  const [connectionStatus, setConnectionStatus] = useState('disconnected')
  const [mediaStream, setMediaStream] = useState(null)
  const [peerConnection, setPeerConnection] = useState(null)
  const peerConnectionRef = useRef(null)
  const [signalingWs, setSignalingWs] = useState(null)
  const signalingWsRef = useRef(null)
  const [isCallActive, setIsCallActive] = useState(false)
  const [roomJoined, setRoomJoined] = useState(false)
  const [waitingParticipants, setWaitingParticipants] = useState([])

  // Mobile-specific state
  const [isMuted, setIsMuted] = useState(false)
  const [isCameraOff, setIsCameraOff] = useState(false)
  const [showControls, setShowControls] = useState(true)

  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)

  const roomId = 'main-room'
  const userId = useRef(Math.random().toString(36).substr(2, 9)).current

  const isMobile = variant === 'mobile'

  // WebRTC configuration with STUN servers
  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  }

  useEffect(() => {
    // Mobile: Initialize local video preview immediately
    if (isMobile) {
      const initializePreview = async () => {
        try {
          const stream = await getUserMedia()
          if (stream) {
            console.log('Local video preview initialized')
          }
        } catch (error) {
          console.error('Failed to initialize video preview:', error)
        }
      }
      initializePreview()
    }

    // Initialize WebSocket connection
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'

    let wsUrl
    if (isMobile) {
      // Mobile: Always use proxy path for ngrok compatibility
      wsUrl = `${protocol}//${window.location.host}/video`
    } else {
      // Desktop: More complex logic
      const isProxied = window.location.hostname.includes('ngrok') ||
                        window.location.hostname.includes('localhost')

      if (isProxied && !import.meta.env.VITE_VIDEO_SERVER_URL) {
        wsUrl = `${protocol}//${window.location.host}/video`
      } else {
        const VIDEO_SERVER = import.meta.env.VITE_VIDEO_SERVER_URL || `${window.location.hostname}:8080`
        wsUrl = `${protocol}//${VIDEO_SERVER}`
      }
    }

    console.log('Connecting to video server at:', wsUrl)
    const ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      console.log('Connected to signaling server')
      setConnectionStatus('connected')
      setSignalingWs(ws)
      signalingWsRef.current = ws
    }

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      console.log('Received signaling message:', data.type)

      switch (data.type) {
        case 'joined-room':
          handleJoinedRoom(data)
          break
        case 'user-joined':
          handleUserJoined(data, ws)
          break
        case 'offer':
          handleOffer(data, ws)
          break
        case 'answer':
          handleAnswer(data)
          break
        case 'ice-candidate':
          handleIceCandidate(data)
          break
        case 'user-left':
          handleUserLeft(data)
          break
        case 'error':
          console.error('Signaling error:', data.message)
          setConnectionStatus('error: ' + data.message)
          break
        default:
          console.log('Unknown message type:', data.type)
      }
    }

    ws.onclose = (event) => {
      console.log('Disconnected from signaling server', event.code, event.reason)
      setConnectionStatus('disconnected')
      setSignalingWs(null)
      signalingWsRef.current = null
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
      setConnectionStatus('connection failed')
    }

    // Mobile: Hide controls after 3 seconds
    let hideControlsTimer
    if (isMobile) {
      hideControlsTimer = setTimeout(() => {
        setShowControls(false)
      }, 3000)
    }

    // Cleanup on component unmount
    return () => {
      if (hideControlsTimer) clearTimeout(hideControlsTimer)
      if (ws.readyState === WebSocket.OPEN) {
        ws.close()
      }
      if (!isMobile && mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop())
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close()
        peerConnectionRef.current = null
        setPeerConnection(null)
      }
    }
  }, [])

  // Handle waiting participants after peer connection is created
  useEffect(() => {
    if (peerConnectionRef.current && waitingParticipants.length > 0) {
      const otherUserId = waitingParticipants[0]

      if (userId < otherUserId) {
        console.log('We are the offerer, creating offer for waiting participants')
        setConnectionStatus('creating offer...')
        createOffer(peerConnectionRef.current, signalingWs)
      } else {
        console.log('We are the answerer, waiting for offer')
        setConnectionStatus('waiting for offer...')
      }
      setWaitingParticipants([])
    }
  }, [peerConnection, waitingParticipants])

  // Debug peer connection state changes (desktop only)
  useEffect(() => {
    if (!isMobile) {
      console.log('PEER CONNECTION STATE CHANGED:', peerConnection ? 'EXISTS' : 'NULL')
    }
  }, [peerConnection])

  const getUserMedia = async () => {
    try {
      const constraints = isMobile
        ? {
            video: {
              width: { ideal: 640 },
              height: { ideal: 480 },
              facingMode: 'user'
            },
            audio: true
          }
        : { video: true, audio: true }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      setMediaStream(stream)

      if (localVideoRef.current) {
        const videoElement = localVideoRef.current

        if (isMobile) {
          // Mobile: More robust video handling
          videoElement.onloadedmetadata = null
          videoElement.oncanplay = null

          try {
            videoElement.pause()
          } catch (e) {}

          videoElement.srcObject = stream

          const handleVideoReady = async () => {
            try {
              if (videoElement.srcObject === stream && videoElement.readyState >= 1) {
                const playPromise = videoElement.play()
                if (playPromise !== undefined) {
                  await playPromise
                  console.log('Local video started successfully')
                }
              }
            } catch (playError) {
              console.warn('Local video autoplay failed:', playError)
            } finally {
              videoElement.removeEventListener('loadedmetadata', handleVideoReady)
              videoElement.removeEventListener('canplay', handleVideoReady)
            }
          }

          videoElement.addEventListener('loadedmetadata', handleVideoReady, { once: true })
          videoElement.addEventListener('canplay', handleVideoReady, { once: true })
        } else {
          // Desktop: Simple assignment
          videoElement.srcObject = stream
        }
      }
      return stream
    } catch (error) {
      console.error('Error accessing media devices:', error)
      setConnectionStatus('media access denied')
      return null
    }
  }

  const createPeerConnection = (stream) => {
    const pc = new RTCPeerConnection(rtcConfig)

    if (stream) {
      console.log('Adding local stream tracks to peer connection')
      stream.getTracks().forEach(track => {
        console.log('Adding track:', track.kind, track.label)
        pc.addTrack(track, stream)
      })
    }

    // Handle remote stream
    pc.ontrack = (event) => {
      console.log('Received remote stream')
      const [remoteStream] = event.streams

      if (remoteVideoRef.current) {
        const videoElement = remoteVideoRef.current

        if (isMobile) {
          // Mobile: More robust handling
          videoElement.onloadedmetadata = null
          videoElement.oncanplay = null

          try {
            videoElement.pause()
          } catch (e) {}

          videoElement.srcObject = remoteStream

          const handleRemoteVideoReady = async () => {
            try {
              if (videoElement.srcObject === remoteStream && videoElement.readyState >= 1) {
                const playPromise = videoElement.play()
                if (playPromise !== undefined) {
                  await playPromise
                  console.log('Remote video started successfully')
                }
              }
            } catch (playError) {
              console.warn('Remote video autoplay failed:', playError)
            } finally {
              videoElement.removeEventListener('loadedmetadata', handleRemoteVideoReady)
              videoElement.removeEventListener('canplay', handleRemoteVideoReady)
            }
          }

          videoElement.addEventListener('loadedmetadata', handleRemoteVideoReady, { once: true })
          videoElement.addEventListener('canplay', handleRemoteVideoReady, { once: true })
        } else {
          // Desktop: Simple assignment
          videoElement.srcObject = remoteStream
        }
      }
    }

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && signalingWsRef.current && signalingWsRef.current.readyState === WebSocket.OPEN) {
        signalingWsRef.current.send(JSON.stringify({
          type: 'ice-candidate',
          roomId,
          candidate: event.candidate
        }))
      }
    }

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log('Peer connection state changed to:', pc.connectionState)
      if (pc.connectionState === 'connected') {
        setIsCallActive(true)
        setConnectionStatus('call active')
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setIsCallActive(false)
        setConnectionStatus('call ended')
      }
    }

    setPeerConnection(pc)
    peerConnectionRef.current = pc
    return pc
  }

  const startCall = async () => {
    if (!signalingWs || signalingWs.readyState !== WebSocket.OPEN) {
      setConnectionStatus('not connected to server')
      return
    }

    setConnectionStatus('joining room...')

    // Use existing media stream or get new one
    let stream = mediaStream
    if (!stream) {
      stream = await getUserMedia()
      if (!stream) {
        setConnectionStatus('media access failed')
        return
      }
    }

    // Create peer connection
    createPeerConnection(stream)

    // Join room
    signalingWs.send(JSON.stringify({
      type: 'join-room',
      roomId,
      userId
    }))
  }

  const createOffer = async (pc, websocket) => {
    try {
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      const wsToUse = websocket || signalingWs
      if (wsToUse && wsToUse.readyState === WebSocket.OPEN) {
        wsToUse.send(JSON.stringify({
          type: 'offer',
          roomId,
          offer
        }))
        console.log('Offer sent')
      }
    } catch (error) {
      console.error('Error creating offer:', error)
    }
  }

  const handleJoinedRoom = (data) => {
    console.log('Joined room:', data.roomId)
    setRoomJoined(true)
    setConnectionStatus('in room')

    if (data.participants && data.participants.length > 0) {
      setWaitingParticipants(data.participants)
    }
  }

  const handleUserJoined = (data, websocket) => {
    console.log('User joined:', data.userId)

    if (userId < data.userId) {
      setConnectionStatus('user joined, creating offer...')
      const pc = peerConnectionRef.current || peerConnection
      if (pc) {
        createOffer(pc, websocket)
      }
    } else {
      setConnectionStatus('waiting for offer from new user...')
    }
  }

  const handleOffer = async (data, websocket) => {
    console.log('Received offer from:', data.fromUserId)

    if (userId < data.fromUserId) {
      console.log('Ignoring offer - we should be the offerer')
      return
    }

    let pc = peerConnectionRef.current || peerConnection
    let currentStream = mediaStream

    if (!pc) {
      const stream = await getUserMedia()
      if (!stream) return
      pc = createPeerConnection(stream)
      currentStream = stream
      setMediaStream(stream)
    } else if (!currentStream) {
      const stream = await getUserMedia()
      if (!stream) return
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream)
      })
      currentStream = stream
      setMediaStream(stream)
    }

    try {
      await pc.setRemoteDescription(data.offer)
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)

      const wsToUse = websocket || signalingWs
      if (wsToUse && wsToUse.readyState === WebSocket.OPEN) {
        wsToUse.send(JSON.stringify({
          type: 'answer',
          roomId,
          answer
        }))
        console.log('Answer sent')
      }
    } catch (error) {
      console.error('Error handling offer:', error)
    }
  }

  const handleAnswer = async (data) => {
    console.log('Received answer from:', data.fromUserId)

    if (peerConnectionRef.current) {
      try {
        await peerConnectionRef.current.setRemoteDescription(data.answer)
        console.log('Answer processed')
      } catch (error) {
        console.error('Error handling answer:', error)
      }
    }
  }

  const handleIceCandidate = async (data) => {
    if (peerConnectionRef.current) {
      try {
        await peerConnectionRef.current.addIceCandidate(data.candidate)
      } catch (error) {
        console.error('Error handling ICE candidate:', error)
      }
    }
  }

  const handleUserLeft = (data) => {
    console.log('User left:', data.userId)
    setIsCallActive(false)
    setConnectionStatus('user left')

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null
    }
  }

  const endCall = () => {
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop())
      setMediaStream(null)
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
      setPeerConnection(null)
      peerConnectionRef.current = null
    }

    if (signalingWs && roomJoined) {
      signalingWs.send(JSON.stringify({
        type: 'leave-room',
        roomId,
        userId
      }))
    }

    setIsCallActive(false)
    setRoomJoined(false)
    setConnectionStatus('disconnected')

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null
    }
  }

  // Mobile-specific controls
  const toggleMute = () => {
    if (mediaStream) {
      const audioTrack = mediaStream.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        setIsMuted(!audioTrack.enabled)
      }
    }
  }

  const toggleCamera = () => {
    if (mediaStream) {
      const videoTrack = mediaStream.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled
        setIsCameraOff(!videoTrack.enabled)
      }
    }
  }

  const handleScreenTap = () => {
    if (isMobile) {
      setShowControls(true)
      setTimeout(() => {
        setShowControls(false)
      }, 3000)
    }
  }

  // Mobile layout
  if (isMobile) {
    return (
      <div className="mobile-video" onClick={handleScreenTap}>
        {/* Status Bar */}
        <div className="video-status-bar">
          <div className="status-indicator">
            <span className={`status-dot ${connectionStatus === 'call active' ? 'active' : 'inactive'}`}></span>
            <span className="status-text">{connectionStatus}</span>
          </div>
        </div>

        {/* Video Container */}
        <div className="mobile-video-container">
          {/* Remote Video (Main) */}
          <div className="remote-video-container">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="remote-video"
            />
            {!isCallActive && (
              <div className="waiting-message">
                {connectionStatus === 'disconnected' ? 'Start a call to connect' : 'Waiting for participant...'}
              </div>
            )}
          </div>

          {/* Local Video (Picture-in-Picture) */}
          <div className="local-video-container">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="local-video"
              style={{ display: !mediaStream ? 'none' : 'block' }}
            />
            {!mediaStream && (
              <div className="camera-preview-placeholder">
                <span>📷</span>
                <span>Camera Loading...</span>
              </div>
            )}
            {isCameraOff && mediaStream && (
              <div className="camera-off-indicator">
                <span>📷</span>
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className={`mobile-video-controls ${showControls ? 'visible' : 'hidden'}`}>
          {!roomJoined ? (
            <div className="control-group">
              <button
                onClick={startCall}
                disabled={!signalingWs || signalingWs.readyState !== WebSocket.OPEN}
                className="control-button start-call"
                style={{
                  opacity: (!signalingWs || signalingWs.readyState !== WebSocket.OPEN) ? 0.6 : 1,
                  pointerEvents: (!signalingWs || signalingWs.readyState !== WebSocket.OPEN) ? 'none' : 'auto'
                }}
              >
                <span className="control-icon">📞</span>
                <span className="control-label">Start Call</span>
              </button>
            </div>
          ) : (
            <div className="control-group">
              <button
                onClick={toggleMute}
                className={`control-button ${isMuted ? 'muted' : ''}`}
              >
                <span className="control-icon">{isMuted ? '🔇' : '🔊'}</span>
                <span className="control-label">{isMuted ? 'Unmute' : 'Mute'}</span>
              </button>

              <button
                onClick={toggleCamera}
                className={`control-button ${isCameraOff ? 'camera-off' : ''}`}
              >
                <span className="control-icon">{isCameraOff ? '📹' : '📷'}</span>
                <span className="control-label">{isCameraOff ? 'Camera On' : 'Camera Off'}</span>
              </button>

              <button
                onClick={endCall}
                className="control-button end-call"
              >
                <span className="control-icon">📵</span>
                <span className="control-label">End Call</span>
              </button>
            </div>
          )}
        </div>

        {/* Room Info */}
        {roomJoined && (
          <div className="room-info">
            <span>Room: {roomId}</span>
          </div>
        )}
      </div>
    )
  }

  // Desktop layout
  return (
    <div className="video-chat">
      <div className="video-chat-header">
        <h2>Video Chat</h2>
        <div className="connection-status">
          Status: {connectionStatus}
        </div>
      </div>

      <div className="video-container">
        <div className="video-local">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="video-element"
          />
          <div className="video-label">Local Video</div>
        </div>

        <div className="video-remote">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="video-element"
          />
          <div className="video-label">Remote Video</div>
        </div>
      </div>

      <div className="video-controls">
        {!roomJoined ? (
          <button
            onClick={startCall}
            disabled={!signalingWs}
            className="call-button start-call"
          >
            Start Call
          </button>
        ) : (
          <button
            onClick={endCall}
            className="call-button end-call"
          >
            End Call
          </button>
        )}
      </div>

      <div className="status-message">
        Room ID: {roomId} | User ID: {userId}
      </div>
    </div>
  )
}

export default VideoChat
