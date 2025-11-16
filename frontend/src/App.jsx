import React, { useState } from 'react'
import Header from './components/Header'
import Appointments from './components/Appointments'
import Vitals from './components/Vitals'
import BLEDevices from './components/BLEDevices'
import VideoChat from './components/VideoChat'
import './App.css'

function App() {
  const [activeView, setActiveView] = useState('home')
  const [panelState, setPanelState] = useState({
    health: 'expanded',
    appointments: 'expanded',
    sensors: 'collapsed',
    video: 'hidden'
  })

  const handleNavigate = (view) => {
    setActiveView(view)

    // Toggle panels between expanded and collapsed
    if (view === 'health') {
      setPanelState(prev => ({
        ...prev,
        health: prev.health === 'expanded' ? 'collapsed' : 'expanded'
      }))
    } else if (view === 'appointments') {
      setPanelState(prev => ({
        ...prev,
        appointments: prev.appointments === 'expanded' ? 'collapsed' : 'expanded'
      }))
    } else if (view === 'sensors') {
      setPanelState(prev => ({
        ...prev,
        sensors: prev.sensors === 'expanded' ? 'collapsed' : 'expanded'
      }))
    } else if (view === 'video') {
      setPanelState(prev => ({
        ...prev,
        video: prev.video === 'expanded' ? 'hidden' : 'expanded',
        // When video becomes active, force health and appointments to collapsed
        health: prev.video === 'hidden' ? 'collapsed' : prev.health,
        appointments: prev.video === 'hidden' ? 'collapsed' : prev.appointments
      }))
    }

    console.log('Navigated to:', view, 'State:', panelState)
  }

  const isVideoActive = panelState.video === 'expanded'

  return (
    <div className="app">
      <Header onNavigate={handleNavigate} activeView={activeView} />
      <main className={`main-content ${isVideoActive ? 'video-active' : ''}`}>
        {isVideoActive ? (
          // Video-dominant layout
          <>
            <div className="video-section">
              <VideoChat />
            </div>
            <div className="sidebar-section">
              <div className="sidebar-item">
                <Vitals isCollapsed={true} />
              </div>
              <div className="sidebar-item">
                <Appointments isCollapsed={true} />
              </div>
            </div>
          </>
        ) : (
          // Normal layout
          <>
            <div className="content-grid">
              <div className="grid-left">
                <Appointments isCollapsed={panelState.appointments === 'collapsed'} />
              </div>
              <div className="grid-right">
                <Vitals isCollapsed={panelState.health === 'collapsed'} />
              </div>
            </div>
            {panelState.sensors !== 'collapsed' && <BLEDevices isCollapsed={false} />}
          </>
        )}
      </main>
    </div>
  )
}

export default App
