import React, { useState } from 'react'
import Header from './components/Header'
import Appointments from './components/Appointments'
import Vitals from './components/Vitals'
import Nutrition from './components/Nutrition'
import Fitness from './components/Fitness'
import Hydration from './components/Hydration'
import Medication from './components/Medication'
import BLEDevices from './components/BLEDevices'
import VideoChat from './components/VideoChat'
import './App.css'

function App() {
  const [activeView, setActiveView] = useState('home')
  const [panelState, setPanelState] = useState({
    health: 'collapsed',
    nutrition: 'collapsed',
    fitness: 'collapsed',
    hydration: 'collapsed',
    medication: 'collapsed',
    appointments: 'collapsed',
    sensors: 'hidden',
    video: 'hidden'
  })
  const [maximizedPanel, setMaximizedPanel] = useState(null)

  // Static panel order for sidebar
  const panelOrder = ['health', 'appointments', 'medication', 'nutrition', 'fitness', 'hydration', 'sensors']

  const handleNavigate = (view) => {
    setActiveView(view)

    // Single panel system - only one panel can be maximized at a time
    if (view === 'home') {
      setMaximizedPanel(null)
      // Show all panels as collapsed for quick status overview
      setPanelState({
        health: 'collapsed',
        nutrition: 'collapsed',
        fitness: 'collapsed',
        hydration: 'collapsed',
        medication: 'collapsed',
        appointments: 'collapsed',
        sensors: 'hidden',
        video: 'hidden'
      })
      return
    }

    if (view === 'video') {
      // Video follows same pattern as other panels
      if (maximizedPanel === 'video') {
        setMaximizedPanel(null)
        setPanelState(prev => ({ ...prev, video: 'hidden' }))
      } else {
        setMaximizedPanel('video')
        const newState = {
          health: 'collapsed',
          nutrition: 'collapsed',
          fitness: 'collapsed',
          hydration: 'collapsed',
          medication: 'collapsed',
          appointments: 'collapsed',
          sensors: 'hidden',
          video: 'visible'
        }
        setPanelState(newState)
      }
      return
    }

    // For all other panels
    if (maximizedPanel === view) {
      // If this panel is already maximized, close it
      setMaximizedPanel(null)
      setPanelState(prev => ({ ...prev, [view]: 'hidden' }))
    } else {
      // Maximize this panel and show others as collapsed in sidebar
      setMaximizedPanel(view)
      const newState = {
        health: 'collapsed',
        nutrition: 'collapsed',
        fitness: 'collapsed',
        hydration: 'collapsed',
        medication: 'collapsed',
        appointments: 'collapsed',
        sensors: 'hidden',
        video: 'hidden'
      }
      newState[view] = 'visible'
      setPanelState(newState)
    }

    console.log('Navigated to:', view, 'Maximized:', view === maximizedPanel ? null : view)
  }

  const layoutConfig = {
    isVideoActive: panelState.video === 'visible',
    maximizedPanel,
    sidebarPanels: panelOrder.filter(panel =>
      panelState[panel] === 'collapsed' && panel !== maximizedPanel
    )
  }

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
      case 'fitness':
        return <Fitness isCollapsed={isCollapsed} />
      case 'hydration':
        return <Hydration isCollapsed={isCollapsed} />
      case 'medication':
        return <Medication isCollapsed={isCollapsed} />
      case 'sensors':
        return <BLEDevices isCollapsed={isCollapsed} />
      case 'video':
        return <VideoChat />
      default:
        return null
    }
  }

  const renderLayout = () => {
    if (layoutConfig.maximizedPanel) {
      // Single panel layout - 2/3 width centered with sidebar
      const maximizedComponent = getPanelComponent(layoutConfig.maximizedPanel)
      const sidebarComponents = layoutConfig.sidebarPanels.map(panelKey => ({
        key: panelKey,
        component: getPanelComponent(panelKey)
      }))

      return (
        <main className="main-content single-panel-layout">
          <div className="sidebar-left">
            {sidebarComponents.slice(0, Math.ceil(sidebarComponents.length / 2)).map(({ key, component }) => (
              <div key={key} className="sidebar-item">
                {component}
              </div>
            ))}
          </div>

          <div className="maximized-panel">
            {maximizedComponent}
          </div>

          <div className="sidebar-right">
            {sidebarComponents.slice(Math.ceil(sidebarComponents.length / 2)).map(({ key, component }) => (
              <div key={key} className="sidebar-item">
                {component}
              </div>
            ))}
          </div>
        </main>
      )
    }

    // Default state - show all panels as collapsed for quick status overview
    const collapsedPanels = panelOrder
      .filter(panelKey => panelState[panelKey] === 'collapsed')
      .map(panelKey => ({
        key: panelKey,
        component: getPanelComponent(panelKey)
      }))

    return (
      <main className="main-content overview-layout">
        <div className="overview-grid">
          {collapsedPanels.map(({ key, component }) => (
            <div
              key={key}
              className="overview-panel"
              onClick={() => handleNavigate(key)}
            >
              {component}
            </div>
          ))}
        </div>
        <div className="overview-message">
          <p>Click any panel above to maximize it, or use the header icons</p>
        </div>
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
