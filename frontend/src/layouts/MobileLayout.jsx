import { useState } from 'react'

// Import components normally
import MobileHeader from './MobileHeader'
import MobileNav from './MobileNav'
import MobileDashboard from '../screens/MobileDashboard'
import Vitals from '../components/Vitals'
import Appointments from '../components/Appointments'
import Medication from '../components/Medication'
import Nutrition from '../components/Nutrition'
import Fitness from '../components/Fitness'
import Hydration from '../components/Hydration'
import VideoChat from '../components/VideoChat'

const MobileLayout = () => {
  const [activeScreen, setActiveScreen] = useState('dashboard')

  const handleNavigate = (screen) => {
    setActiveScreen(screen)
  }

  const renderScreen = () => {
    switch (activeScreen) {
      case 'dashboard':
        return <MobileDashboard onNavigate={handleNavigate} />
      case 'health':
        return <Vitals variant="mobile" onNavigate={handleNavigate} />
      case 'schedule':
        return <Appointments variant="mobile" onNavigate={handleNavigate} />
      case 'medication':
        return <Medication variant="mobile" onNavigate={handleNavigate} />
      case 'nutrition':
        return <Nutrition variant="mobile" onNavigate={handleNavigate} />
      case 'fitness':
        return <Fitness variant="mobile" onNavigate={handleNavigate} />
      case 'hydration':
        return <Hydration variant="mobile" onNavigate={handleNavigate} />
      case 'video':
        return <VideoChat variant="mobile" onNavigate={handleNavigate} />
      default:
        return <MobileDashboard onNavigate={handleNavigate} />
    }
  }

  return (
    <div className="mobile-app" style={{ background: '#0a0a0a', minHeight: '100vh' }}>
      <MobileHeader />
      <main className="mobile-content" style={{
        paddingTop: '80px',
        paddingBottom: '104px',
        overflowY: 'auto',
        height: '100vh'
      }}>
        {renderScreen()}
      </main>

      <MobileNav activeScreen={activeScreen} onNavigate={handleNavigate} />
    </div>
  )
}

export default MobileLayout