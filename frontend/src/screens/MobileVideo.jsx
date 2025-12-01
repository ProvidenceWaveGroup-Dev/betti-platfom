import React, { useState, useRef, useEffect } from 'react'
import '../styles/mobileVideo.scss'

const MobileVideo = ({ onNavigate }) => {
  const [connectionStatus, setConnectionStatus] = useState('disconnected')
  const [mediaStream, setMediaStream] = useState(null)
  const [peerConnection, setPeerConnection] = useState(null)
  const peerConnectionRef = useRef(null)
  const [signalingWs, setSignalingWs] = useState(null)
  const signalingWsRef = useRef(null)
  const [isCallActive, setIsCallActive] = useState(false)
  const [roomJoined, setRoomJoined] = useState(false)
  const [waitingParticipants, setWaitingParticipants] = useState([])
  const [isMuted, setIsMuted] = useState(false)
  const [isCameraOff, setIsCameraOff] = useState(false)
  const [showControls, setShowControls] = useState(true)

  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)

  const roomId = 'main-room'
  const userId = useRef(Math.random().toString(36).substr(2, 9)).current

  // WebRTC configuration with STUN servers
  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  }

  useEffect(() => {
    // Initialize local video preview immediately
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

    // Initialize WebSocket connection using proxy path for ngrok compatibility
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/video`

    console.log('🔌 Attempting to connect to video server via proxy:', wsUrl)
    console.log('📍 Window location:', window.location.href)

    const ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      console.log('✅ Connected to signaling server:', wsUrl)
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
      console.log('📴 Disconnected from signaling server:', {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean
      })
      setConnectionStatus('disconnected')
      setSignalingWs(null)
      signalingWsRef.current = null
    }

    ws.onerror = (error) => {
      console.error('❌ WebSocket error:', error)
      console.error('🌐 Failed to connect to:', wsUrl)
      setConnectionStatus('connection failed')
    }

    // Hide controls after 3 seconds of no interaction
    const hideControlsTimer = setTimeout(() => {
      setShowControls(false)
    }, 3000)

    // Cleanup on component unmount
    return () => {
      clearTimeout(hideControlsTimer)
      if (ws.readyState === WebSocket.OPEN) {
        ws.close()
      }
      // Don't stop media stream tracks on cleanup - let endCall handle it
      // This prevents issues when the component re-renders
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

      // Only create offer if our user ID is lexicographically smaller (prevents glare)
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

  const getUserMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user' // Front camera for mobile
        },
        audio: true
      })
      setMediaStream(stream)
      if (localVideoRef.current) {
        const videoElement = localVideoRef.current

        // Clear any existing event handlers to prevent conflicts
        videoElement.onloadedmetadata = null
        videoElement.oncanplay = null

        // Pause any existing playback to prevent AbortError
        try {
          videoElement.pause()
        } catch (e) {
          // Ignore pause errors on uninitialized video
        }

        // Set the new stream
        videoElement.srcObject = stream

        // Use a more robust event handling approach
        const handleVideoReady = async () => {
          try {
            // Double-check the video element is still valid and has the correct stream
            if (videoElement.srcObject === stream && videoElement.readyState >= 1) {
              const playPromise = videoElement.play()
              if (playPromise !== undefined) {
                await playPromise
                console.log('Local video started successfully')
              }
            }
          } catch (playError) {
            console.warn('Local video autoplay failed:', playError)
            // On mobile, user interaction might be required for video to play
            if (playError.name === 'NotAllowedError') {
              console.log('Video autoplay blocked - user interaction required')
            } else if (playError.name === 'AbortError') {
              console.log('Video play request was interrupted - this is normal during stream setup')
            }
          } finally {
            // Clean up event listeners
            videoElement.removeEventListener('loadedmetadata', handleVideoReady)
            videoElement.removeEventListener('canplay', handleVideoReady)
          }
        }

        // Listen for both events to handle different browser behaviors
        videoElement.addEventListener('loadedmetadata', handleVideoReady, { once: true })
        videoElement.addEventListener('canplay', handleVideoReady, { once: true })
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

    // Add local stream tracks to peer connection
    if (stream) {
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream)
      })
    }

    // Handle remote stream
    pc.ontrack = (event) => {
      const [remoteStream] = event.streams
      if (remoteVideoRef.current) {
        const videoElement = remoteVideoRef.current

        // Clear any existing event handlers
        videoElement.onloadedmetadata = null
        videoElement.oncanplay = null

        // Pause any existing playback to prevent AbortError
        try {
          videoElement.pause()
        } catch (e) {
          // Ignore pause errors on uninitialized video
        }

        // Set the new stream
        videoElement.srcObject = remoteStream

        // Handle remote video playback more robustly
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
            if (playError.name === 'AbortError') {
              console.log('Remote video play request was interrupted - this is normal')
            }
          } finally {
            // Clean up event listeners
            videoElement.removeEventListener('loadedmetadata', handleRemoteVideoReady)
            videoElement.removeEventListener('canplay', handleRemoteVideoReady)
          }
        }

        // Listen for video ready events
        videoElement.addEventListener('loadedmetadata', handleRemoteVideoReady, { once: true })
        videoElement.addEventListener('canplay', handleRemoteVideoReady, { once: true })
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
    console.log('🚀 Start Call button clicked')
    console.log('📡 WebSocket state:', signalingWs ? signalingWs.readyState : 'null')
    console.log('📱 Media stream exists:', !!mediaStream)
    console.log('👤 User ID:', userId)
    console.log('🏠 Room ID:', roomId)

    if (!signalingWs || signalingWs.readyState !== WebSocket.OPEN) {
      console.error('❌ WebSocket not connected:', {
        exists: !!signalingWs,
        readyState: signalingWs?.readyState,
        expected: WebSocket.OPEN
      })
      setConnectionStatus('not connected to server')
      return
    }

    console.log('✅ WebSocket is connected, proceeding with call setup')
    setConnectionStatus('joining room...')

    try {
      // Use existing media stream or get new one
      let stream = mediaStream
      if (!stream) {
        console.log('🎥 Getting new media stream...')
        stream = await getUserMedia()
        if (!stream) {
          console.error('❌ Failed to get media stream')
          setConnectionStatus('media access failed')
          return
        }
        console.log('✅ Media stream obtained successfully')
      } else {
        console.log('✅ Using existing media stream')
      }

      // Create peer connection with the stream
      console.log('🔗 Creating peer connection...')
      createPeerConnection(stream)

      // Join room
      console.log('🏠 Sending join-room message...')
      signalingWs.send(JSON.stringify({
        type: 'join-room',
        roomId,
        userId
      }))
      console.log('✅ Join room message sent')
    } catch (error) {
      console.error('❌ Error in startCall:', error)
      setConnectionStatus('call setup failed')
    }
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

    console.log('We are the answerer - processing offer')

    let pc = peerConnectionRef.current || peerConnection
    let currentStream = mediaStream

    if (!pc) {
      console.log('No peer connection exists, creating new one')
      const stream = await getUserMedia()
      if (!stream) return
      pc = createPeerConnection(stream)
      currentStream = stream
      setMediaStream(stream) // Update state
    } else if (!currentStream) {
      console.log('Peer connection exists but no media stream, getting media')
      const stream = await getUserMedia()
      if (!stream) return
      stream.getTracks().forEach(track => {
        console.log('Adding track to existing peer connection:', track.kind)
        pc.addTrack(track, stream)
      })
      currentStream = stream
      setMediaStream(stream) // Update state
    } else {
      console.log('Using existing peer connection and media stream')
    }

    try {
      console.log('Setting remote description from offer')
      await pc.setRemoteDescription(data.offer)
      console.log('Creating answer')
      const answer = await pc.createAnswer()
      console.log('Setting local description (answer)')
      await pc.setLocalDescription(answer)

      const wsToUse = websocket || signalingWs
      if (wsToUse && wsToUse.readyState === WebSocket.OPEN) {
        wsToUse.send(JSON.stringify({
          type: 'answer',
          roomId,
          answer
        }))
        console.log('Answer sent successfully')
      } else {
        console.error('Cannot send answer - WebSocket not connected')
      }
    } catch (error) {
      console.error('Error handling offer:', error)
    }
  }

  const handleAnswer = async (data) => {
    console.log('Received answer from:', data.fromUserId)
    console.log('Current peer connection state:', !!peerConnectionRef.current)

    if (peerConnectionRef.current) {
      try {
        console.log('Setting remote description from answer')
        await peerConnectionRef.current.setRemoteDescription(data.answer)
        console.log('Answer processed successfully')
      } catch (error) {
        console.error('Error handling answer:', error)
      }
    } else {
      console.error('No peer connection available to handle answer')
      console.error('Peer connection is null - this should not happen after sending an offer')
    }
  }

  const handleIceCandidate = async (data) => {
    console.log('Received ICE candidate from:', data.fromUserId)
    console.log('Peer connection available:', !!peerConnectionRef.current)

    if (peerConnectionRef.current) {
      try {
        await peerConnectionRef.current.addIceCandidate(data.candidate)
        console.log('ICE candidate added successfully')
      } catch (error) {
        console.error('Error handling ICE candidate:', error)
      }
    } else {
      console.error('Cannot handle ICE candidate - no peer connection')
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
    setShowControls(true)
    setTimeout(() => {
      setShowControls(false)
    }, 3000)
  }

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

export default MobileVideo