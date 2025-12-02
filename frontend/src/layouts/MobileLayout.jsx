import { useState } from 'react'

// Import components normally
import MobileHeader from './MobileHeader'
import MobileNav from './MobileNav'
import MobileDashboard from '../screens/MobileDashboard'
import MobileHealth from '../screens/MobileHealth'
import MobileSchedule from '../screens/MobileSchedule'
import MobileMedication from '../screens/MobileMedication'
import Nutrition from '../components/Nutrition'
import MobileFitness from '../screens/MobileFitness'
import MobileHydration from '../screens/MobileHydration'
import MobileVideo from '../screens/MobileVideo'

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
        return <MobileHealth onNavigate={handleNavigate} />
      case 'schedule':
        return <MobileSchedule onNavigate={handleNavigate} />
      case 'medication':
        return <MobileMedication onNavigate={handleNavigate} />
      case 'nutrition':
        return <Nutrition variant="mobile" onNavigate={handleNavigate} />
      case 'fitness':
        return <MobileFitness onNavigate={handleNavigate} />
      case 'hydration':
        return <MobileHydration onNavigate={handleNavigate} />
      case 'video':
        return <MobileVideo onNavigate={handleNavigate} />
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