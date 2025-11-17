import React, { useState, useEffect } from 'react'
import wsClient from '../services/websocket'
import './BLEDevices.css'

function BLEDevices({ isCollapsed = false }) {
  const [devices, setDevices] = useState([])
  const [scanStatus, setScanStatus] = useState('idle')
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    // Connect to WebSocket
    wsClient.connect()

    // Listen for connection status
    const handleConnection = (data) => {
      setIsConnected(data.status === 'connected')
    }

    // Listen for BLE device discoveries
    const handleBLEDevice = (data) => {
      setDevices((prevDevices) => {
        const existingIndex = prevDevices.findIndex((d) => d.id === data.device.id)
        if (existingIndex >= 0) {
          // Update existing device
          const updated = [...prevDevices]
          updated[existingIndex] = data.device
          return updated
        } else {
          // Add new device
          return [...prevDevices, data.device]
        }
      })
    }

    // Listen for scan status updates
    const handleScanStatus = (data) => {
      setScanStatus(data.status)
      if (data.status === 'idle') {
        console.log(`Scan complete. Found ${data.devicesFound} devices`)
      }
    }

    wsClient.on('connection', handleConnection)
    wsClient.on('ble-device', handleBLEDevice)
    wsClient.on('ble-scan-status', handleScanStatus)

    // Cleanup
    return () => {
      wsClient.off('connection', handleConnection)
      wsClient.off('ble-device', handleBLEDevice)
      wsClient.off('ble-scan-status', handleScanStatus)
    }
  }, [])

  const startScan = async () => {
    try {
      // Clear previous devices when starting new scan
      setDevices([])
      setScanStatus('scanning')

      const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:'
      const response = await fetch(`${protocol}//${window.location.hostname}:3001/api/ble/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const data = await response.json()

      if (!data.success) {
        console.error('Failed to start scan:', data.error)
        setScanStatus('idle')
        alert(`Failed to start scan: ${data.error}`)
      }
    } catch (error) {
      console.error('Error starting BLE scan:', error)
      setScanStatus('idle')
      alert('Error starting BLE scan. Make sure the backend is running.')
    }
  }

  const getSignalStrength = (rssi) => {
    if (rssi >= -50) return 'excellent'
    if (rssi >= -70) return 'good'
    if (rssi >= -85) return 'fair'
    return 'weak'
  }

  const getSignalBars = (rssi) => {
    const strength = getSignalStrength(rssi)
    switch (strength) {
      case 'excellent':
        return '📶'
      case 'good':
        return '📶'
      case 'fair':
        return '📱'
      case 'weak':
        return '📵'
      default:
        return '📡'
    }
  }

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    })
  }

  if (isCollapsed) {
    const recentDevices = devices.slice(0, 3) // Show last 3 discovered devices

    return (
      <div className="ble-mini">
        <div className="mini-header">
          <span className="mini-icon">📡</span>
          <span className="mini-title">BLE Sensors</span>
          <span className={`mini-status ${isConnected ? 'connected' : 'disconnected'}`}>
            ● {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        <div className="mini-ble-content">
          <div className="mini-device-count">
            {devices.length} {devices.length === 1 ? 'device' : 'devices'} found
          </div>
          {recentDevices.length > 0 && (
            <div className="mini-device-list">
              {recentDevices.map((device, index) => (
                <div key={device.id} className="mini-device">
                  <span className="mini-device-signal">{getSignalBars(device.rssi)}</span>
                  <span className="mini-device-name">{device.name}</span>
                  <span className="mini-device-rssi">{device.rssi}dBm</span>
                </div>
              ))}
            </div>
          )}
          {scanStatus === 'scanning' && (
            <div className="mini-scanning">
              <span className="mini-spinner">🔍</span>
              <span>Scanning...</span>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="ble-devices-widget">
      <div className="ble-header">
        <div className="ble-title-section">
          <h2 className="widget-title">BLE Devices</h2>
          <div className="connection-status">
            <span className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}></span>
            <span className="status-label">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>

        <div className="ble-controls">
          <button
            onClick={startScan}
            disabled={scanStatus === 'scanning'}
            className={`scan-button ${scanStatus === 'scanning' ? 'scanning' : ''}`}
          >
            {scanStatus === 'scanning' ? (
              <>
                <span className="spinner"></span>
                Scanning...
              </>
            ) : (
              <>
                <span className="scan-icon">🔍</span>
                Scan for Devices
              </>
            )}
          </button>

          <div className="device-count">
            {devices.length} {devices.length === 1 ? 'device' : 'devices'} found
          </div>
        </div>
      </div>

      <div className="ble-devices-list">
        {devices.length === 0 ? (
          <div className="no-devices">
            <div className="no-devices-icon">📡</div>
            <div className="no-devices-text">
              {scanStatus === 'scanning'
                ? 'Scanning for BLE devices...'
                : 'No devices found. Click "Scan for Devices" to start.'}
            </div>
          </div>
        ) : (
          devices.map((device) => (
            <div key={device.id} className={`ble-device-item signal-${getSignalStrength(device.rssi)}`}>
              <div className="device-icon">{getSignalBars(device.rssi)}</div>
              <div className="device-info">
                <div className="device-name">{device.name}</div>
                <div className="device-details">
                  <span className="device-address">{device.address}</span>
                  <span className="device-divider">•</span>
                  <span className="device-rssi">RSSI: {device.rssi} dBm</span>
                  <span className="device-divider">•</span>
                  <span className="device-time">{formatTimestamp(device.lastSeen)}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default BLEDevices
