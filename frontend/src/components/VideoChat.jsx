import React, { useState, useRef, useEffect } from 'react'
import './VideoChat.css'

function VideoChat() {
  const [connectionStatus, setConnectionStatus] = useState('disconnected')
  const [mediaStream, setMediaStream] = useState(null)
  const [peerConnection, setPeerConnection] = useState(null)
  const peerConnectionRef = useRef(null)
  const [signalingWs, setSignalingWs] = useState(null)
  const signalingWsRef = useRef(null)
  const [isCallActive, setIsCallActive] = useState(false)
  const [roomJoined, setRoomJoined] = useState(false)
  const [waitingParticipants, setWaitingParticipants] = useState([])

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
    // Initialize WebSocket connection
    const VIDEO_SERVER = import.meta.env.VITE_VIDEO_SERVER_URL || `${window.location.hostname}:8080`
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${protocol}//${VIDEO_SERVER}`)

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
          handleUserJoined(data, ws) // Pass WebSocket reference
          break
        case 'offer':
          handleOffer(data, ws) // Pass WebSocket reference directly
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

    ws.onclose = () => {
      console.log('Disconnected from signaling server')
      setConnectionStatus('disconnected')
      setSignalingWs(null)
      signalingWsRef.current = null
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
      setConnectionStatus('connection failed - check certificate')
    }

    // Cleanup on component unmount
    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close()
      }
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop())
      }
      if (peerConnection) {
        peerConnection.close()
      }
    }
  }, [])

  // Handle waiting participants after peer connection is created
  useEffect(() => {
    console.log('useEffect triggered - peerConnection:', !!peerConnectionRef.current, 'waitingParticipants:', waitingParticipants)
    if (peerConnectionRef.current && waitingParticipants.length > 0) {
      const otherUserId = waitingParticipants[0]

      // Only create offer if our user ID is lexicographically smaller (prevents glare)
      if (userId < otherUserId) {
        console.log('We are the offerer (lower user ID), creating offer for waiting participants:', waitingParticipants)
        setConnectionStatus('creating offer for waiting participants...')
        createOffer(peerConnectionRef.current, signalingWs)
      } else {
        console.log('We are the answerer (higher user ID), waiting for offer from:', otherUserId)
        setConnectionStatus('waiting for offer from other participant...')
      }
      setWaitingParticipants([]) // Clear waiting participants
    }
  }, [peerConnection, waitingParticipants])

  // Debug peer connection state changes
  useEffect(() => {
    console.log('PEER CONNECTION STATE CHANGED:', peerConnection ? 'EXISTS' : 'NULL')
    if (peerConnectionRef.current) {
      console.log('Peer connection is now set to a valid RTCPeerConnection')
    } else {
      console.log('Peer connection is now NULL - this might be the problem!')
      console.trace('Peer connection set to null - stack trace:')
    }
  }, [peerConnection])

  const getUserMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      })
      setMediaStream(stream)
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
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
      console.log('Adding local stream tracks to peer connection:')
      stream.getTracks().forEach(track => {
        console.log('Adding track:', track.kind, track.label, 'enabled:', track.enabled)
        pc.addTrack(track, stream)
      })
      console.log('Local tracks added to peer connection')
    } else {
      console.error('No stream provided to createPeerConnection!')
    }

    // Handle remote stream
    pc.ontrack = (event) => {
      console.log('Received remote stream:', event)
      console.log('Event streams:', event.streams)
      console.log('Event track:', event.track)
      const [remoteStream] = event.streams
      console.log('Remote stream:', remoteStream)
      console.log('Remote stream tracks:', remoteStream ? remoteStream.getTracks() : 'No stream')

      if (remoteVideoRef.current) {
        console.log('Setting remote video srcObject')
        remoteVideoRef.current.srcObject = remoteStream
        console.log('Remote video element srcObject set to:', remoteVideoRef.current.srcObject)
      } else {
        console.error('Remote video ref is null!')
      }
    }

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        // Use ref to get current WebSocket
        if (signalingWsRef.current && signalingWsRef.current.readyState === WebSocket.OPEN) {
          signalingWsRef.current.send(JSON.stringify({
            type: 'ice-candidate',
            roomId,
            candidate: event.candidate
          }))
        } else {
          console.warn('Cannot send ICE candidate - WebSocket not connected')
        }
      }
    }

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log('Peer connection state changed to:', pc.connectionState)
      console.log('ICE connection state:', pc.iceConnectionState)
      console.log('ICE gathering state:', pc.iceGatheringState)

      if (pc.connectionState === 'connected') {
        setIsCallActive(true)
        setConnectionStatus('call active')
        console.log('✅ Peer connection established successfully!')
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setIsCallActive(false)
        setConnectionStatus('call ended')
        console.log('❌ Peer connection ended/failed')
      }
    }

    // Handle ICE connection state changes
    pc.oniceconnectionstatechange = () => {
      console.log('ICE connection state changed to:', pc.iceConnectionState)
    }

    // Debug: Check what senders we have after setting up the peer connection
    setTimeout(() => {
      const senders = pc.getSenders()
      console.log('Peer connection senders after creation:', senders.length)
      senders.forEach((sender, index) => {
        console.log(`Sender ${index}:`, sender.track ? sender.track.kind : 'no track')
      })
    }, 100)

    console.log('Setting peer connection state to:', pc ? 'valid peer connection' : 'null')
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

    // Get user media
    const stream = await getUserMedia()
    if (!stream) return

    // Create peer connection
    const pc = createPeerConnection(stream)

    // Join room
    signalingWs.send(JSON.stringify({
      type: 'join-room',
      roomId,
      userId
    }))
  }

  const createOffer = async (pc, websocket) => {
    try {
      // Check what tracks we're offering
      const senders = pc.getSenders()
      console.log('Creating offer with senders:', senders.length)
      senders.forEach((sender, index) => {
        console.log(`Offering sender ${index}:`, sender.track ? `${sender.track.kind} (${sender.track.label})` : 'no track')
      })

      const offer = await pc.createOffer()
      console.log('Created offer:', offer)
      await pc.setLocalDescription(offer)

      // Use the passed websocket parameter first, fall back to signalingWs
      const wsToUse = websocket || signalingWs

      if (wsToUse && wsToUse.readyState === WebSocket.OPEN) {
        wsToUse.send(JSON.stringify({
          type: 'offer',
          roomId,
          offer
        }))
        console.log('Offer sent to remote peer')
      } else {
        console.error('Cannot send offer - WebSocket is not connected:',
          wsToUse ? `state: ${wsToUse.readyState}` : 'WebSocket is null')
      }
    } catch (error) {
      console.error('Error creating offer:', error)
    }
  }

  const handleJoinedRoom = (data) => {
    console.log('Joined room:', data.roomId)
    setRoomJoined(true)
    setConnectionStatus('in room')

    // Store participants to handle after peer connection is created
    if (data.participants && data.participants.length > 0) {
      setWaitingParticipants(data.participants)
    }
  }

  const handleUserJoined = (data, websocket) => {
    console.log('User joined:', data.userId)

    // Only create offer if our user ID is lexicographically smaller (prevents glare)
    if (userId < data.userId) {
      console.log('We are the offerer (lower user ID)')
      setConnectionStatus('user joined, creating offer...')

      // Create offer for new user - use ref to get immediate value
      const pc = peerConnectionRef.current || peerConnection
      if (pc) {
        console.log('Creating offer immediately with existing peer connection')
        createOffer(pc, websocket)
      } else {
        console.error('Cannot create offer - no peer connection available!')
        console.log('This should not happen - peer connection should exist by now')
        console.log('peerConnectionRef.current:', !!peerConnectionRef.current)
        console.log('peerConnection state:', !!peerConnection)
        console.log('peerConnectionRef.current:', !!peerConnectionRef.current)
      }
    } else {
      console.log('We are the answerer (higher user ID), waiting for offer')
      setConnectionStatus('waiting for offer from new user...')
    }
  }

  const handleOffer = async (data, websocket) => {
    console.log('Received offer from:', data.fromUserId)

    // Check if we should be the answerer - prevent glare by comparing user IDs
    if (userId < data.fromUserId) {
      console.log('Ignoring offer - we should be the offerer (lower user ID)')
      console.log('This prevents WebRTC glare - only one peer should send offers')
      return
    }

    console.log('We are the answerer - processing offer from offerer')

    let pc = peerConnectionRef.current || peerConnection
    let currentStream = mediaStream

    // If no peer connection exists, create one
    if (!pc) {
      const stream = await getUserMedia()
      if (!stream) return
      pc = createPeerConnection(stream)
      currentStream = stream
    } else {
      // If peer connection exists but no media stream, get one and add tracks
      if (!currentStream) {
        console.log('Peer connection exists but no media stream, getting media...')
        const stream = await getUserMedia()
        if (!stream) return

        // Add tracks to existing peer connection
        stream.getTracks().forEach(track => {
          console.log('Adding track to existing peer connection:', track.kind, track.label)
          pc.addTrack(track, stream)
        })
        currentStream = stream
      } else {
        console.log('Using existing peer connection and media stream')
        // Verify tracks are added
        const senders = pc.getSenders()
        console.log('Current peer connection senders:', senders.length)
      }
    }

    try {
      console.log('Setting remote description from offer...')
      await pc.setRemoteDescription(data.offer)
      console.log('Creating answer...')
      const answer = await pc.createAnswer()
      console.log('Setting local description (answer)...')
      await pc.setLocalDescription(answer)

      console.log('Sending answer back...')
      console.log('WebSocket state check - websocket:', !!websocket, 'signalingWs:', !!signalingWs)

      // Use the passed websocket parameter first, fall back to signalingWs
      const wsToUse = websocket || signalingWs

      if (wsToUse && wsToUse.readyState === WebSocket.OPEN) {
        wsToUse.send(JSON.stringify({
          type: 'answer',
          roomId,
          answer
        }))
        console.log('Answer sent successfully')
      } else {
        console.error('Cannot send answer - WebSocket is not connected:',
          wsToUse ? `state: ${wsToUse.readyState}` : 'WebSocket is null')
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
        console.log('Setting remote description from answer...')
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

    // Reset remote video
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

    // Clear video elements
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null
    }
  }

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