import React, { useState } from 'react'
import Header from './components/Header'
import Appointments from './components/Appointments'
import Vitals from './components/Vitals'
import Nutrition from './components/Nutrition'
import BLEDevices from './components/BLEDevices'
import VideoChat from './components/VideoChat'
import './App.css'

function App() {
  const [activeView, setActiveView] = useState('home')
  const [panelState, setPanelState] = useState({
    health: 'collapsed',
    nutrition: 'collapsed',
    appointments: 'collapsed',
    sensors: 'collapsed',
    video: 'hidden'
  })

  // Static panel order
  const panelOrder = ['health', 'appointments', 'nutrition', 'sensors']

  // Helper function for main panels: only toggle between collapsed and visible
  const getNextPanelState = (currentState) => {
    switch (currentState) {
      case 'collapsed':
        return 'visible'
      case 'visible':
        return 'collapsed'
      default:
        return 'collapsed'
    }
  }

  const handleNavigate = (view) => {
    setActiveView(view)

    // Cycle panels through hidden -> collapsed -> visible -> hidden
    if (view === 'health') {
      setPanelState(prev => ({
        ...prev,
        health: getNextPanelState(prev.health)
      }))
    } else if (view === 'nutrition') {
      setPanelState(prev => ({
        ...prev,
        nutrition: getNextPanelState(prev.nutrition)
      }))
    } else if (view === 'appointments') {
      setPanelState(prev => ({
        ...prev,
        appointments: getNextPanelState(prev.appointments)
      }))
    } else if (view === 'sensors') {
      setPanelState(prev => ({
        ...prev,
        sensors: getNextPanelState(prev.sensors)
      }))
    } else if (view === 'video') {
      setPanelState(prev => ({
        ...prev,
        video: prev.video === 'visible' ? 'hidden' : 'visible'
      }))
    }

    console.log('Navigated to:', view, 'State:', panelState)
  }

  // Calculate dynamic layout based on visible and collapsed panels
  const getLayoutConfig = () => {
    const isVideoActive = panelState.video === 'visible'

    if (isVideoActive) {
      return { isVideoActive: true }
    }

    // Count visible and collapsed panels for dynamic scaling
    const activePanels = []

    if (panelState.health === 'visible' || panelState.health === 'collapsed') activePanels.push('health')
    if (panelState.nutrition === 'visible' || panelState.nutrition === 'collapsed') activePanels.push('nutrition')
    if (panelState.appointments === 'visible' || panelState.appointments === 'collapsed') activePanels.push('appointments')
    if (panelState.sensors === 'visible' || panelState.sensors === 'collapsed') activePanels.push('sensors')

    return {
      isVideoActive: false,
      activePanels,
      totalActive: activePanels.length
    }
  }

  const layoutConfig = getLayoutConfig()

  // Helper function to get panel component by key with correct collapsed state
  const getPanelComponent = (key) => {
    const isCollapsed = panelState[key] === 'collapsed'

    switch (key) {
      case 'health':
        return <Vitals isCollapsed={isCollapsed} />
      case 'appointments':
        return <Appointments isCollapsed={isCollapsed} />
      case 'nutrition':
        return <Nutrition isCollapsed={isCollapsed} />
      case 'sensors':
        return <BLEDevices isCollapsed={isCollapsed} />
      default:
        return null
    }
  }

  const renderLayout = () => {
    if (layoutConfig.isVideoActive) {
      // Show all panels in sidebar as mini cards, in user-defined order
      const sidebarPanels = panelOrder.map(panelKey => {
        let component;
        const isEnabled = panelState[panelKey] === 'visible' || panelState[panelKey] === 'collapsed'

        switch (panelKey) {
          case 'health':
            component = <Vitals isCollapsed={true} />
            break
          case 'nutrition':
            component = <Nutrition isCollapsed={true} />
            break
          case 'appointments':
            component = <Appointments isCollapsed={true} />
            break
          case 'sensors':
            component = <BLEDevices isCollapsed={true} />
            break
          default:
            return null
        }

        return (
          <div key={panelKey} className={`sidebar-item ${isEnabled ? 'enabled' : 'disabled'}`}>
            {component}
          </div>
        )
      }).filter(Boolean) // Remove any null components

      return (
        <main className="main-content video-active">
          <div className="video-section">
            <VideoChat />
          </div>
          <div className="sidebar-section">
            {sidebarPanels}
          </div>
        </main>
      )
    }

    // Dynamic scaling layout based on visible and collapsed panels in user-defined order
    const activePanels = panelOrder
      .filter(panelKey => panelState[panelKey] === 'visible' || panelState[panelKey] === 'collapsed')
      .map((panelKey, index) => ({
        key: panelKey,
        component: getPanelComponent(panelKey),
        index: index
      }))

    // Calculate grid columns based on active panels
    const gridColumns = Math.max(1, activePanels.length)

    return (
      <main className="main-content dynamic-layout">
        {activePanels.length > 0 ? (
          <div className="dynamic-grid" style={{
            gridTemplateColumns: `repeat(${gridColumns}, 1fr)`
          }}>
            {activePanels.map(({ key, component }) => (
              <div key={key} className="panel-column">
                {component}
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <p>Click the icons above to show panels</p>
          </div>
        )}
      </main>
    )
  }

  return (
    <div className="app">
      <Header onNavigate={handleNavigate} activeView={activeView} />
      {renderLayout()}
    </div>
  )
}

export default App
