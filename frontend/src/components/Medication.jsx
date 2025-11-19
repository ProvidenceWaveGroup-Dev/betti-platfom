import React, { useState, useEffect } from 'react'
import './Medication.css'

function Medication({ isCollapsed = false }) {
  const [todayMeds, setTodayMeds] = useState([])
  const [completedCount, setCompletedCount] = useState(0)
  const [totalCount, setTotalCount] = useState(0)

  useEffect(() => {
    loadMedicationData()
  }, [])

  const loadMedicationData = () => {
    const today = new Date().toISOString().split('T')[0]
    const savedMeds = localStorage.getItem(`medications_${today}`)

    // Default medications schedule
    const defaultMeds = [
      { id: 1, name: 'Morning Vitamins', time: '08:00', taken: false, type: 'vitamin' },
      { id: 2, name: 'Blood Pressure', time: '12:00', taken: false, type: 'prescription' },
      { id: 3, name: 'Evening Supplement', time: '18:00', taken: false, type: 'supplement' }
    ]

    let medications = defaultMeds
    if (savedMeds) {
      medications = JSON.parse(savedMeds)
    }

    setTodayMeds(medications)
    const completed = medications.filter(med => med.taken).length
    setCompletedCount(completed)
    setTotalCount(medications.length)
  }

  const toggleMedication = (medId) => {
    const updatedMeds = todayMeds.map(med =>
      med.id === medId ? { ...med, taken: !med.taken } : med
    )

    setTodayMeds(updatedMeds)

    const completed = updatedMeds.filter(med => med.taken).length
    setCompletedCount(completed)

    // Save to localStorage
    const today = new Date().toISOString().split('T')[0]
    localStorage.setItem(`medications_${today}`, JSON.stringify(updatedMeds))
  }

  const getCompletionPercentage = () => {
    return totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
  }

  const getMedIcon = (type) => {
    switch (type) {
      case 'prescription': return '💊'
      case 'vitamin': return '🟡'
      case 'supplement': return '🟢'
      default: return '💊'
    }
  }

  const isOverdue = (time) => {
    const now = new Date()
    const [hour, minute] = time.split(':')
    const medTime = new Date()
    medTime.setHours(parseInt(hour), parseInt(minute), 0, 0)
    return now > medTime
  }

  if (isCollapsed) {
    return (
      <div className="medication-card collapsed">
        <div className="card-header">
          <h3 className="card-title">💊 Medication</h3>
          <div className="completion-badge">
            {completedCount}/{totalCount}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="medication-card">
      <div className="card-header">
        <h2 className="card-title">💊 Medication</h2>
        <div className="completion-stats">
          <span className="completion-text">{completedCount}/{totalCount} taken</span>
          <span className="completion-percentage">{getCompletionPercentage()}%</span>
        </div>
      </div>

      <div className="progress-section">
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{
              width: `${getCompletionPercentage()}%`,
              backgroundColor: getCompletionPercentage() === 100 ? '#4CAF50' : '#4a9eff'
            }}
          ></div>
        </div>
      </div>

      <div className="medications-list">
        {todayMeds.map((med) => (
          <div
            key={med.id}
            className={`medication-item ${med.taken ? 'completed' : ''} ${isOverdue(med.time) && !med.taken ? 'overdue' : ''}`}
          >
            <div className="med-info">
              <span className="med-icon">{getMedIcon(med.type)}</span>
              <div className="med-details">
                <span className="med-name">{med.name}</span>
                <span className="med-time">{med.time}</span>
              </div>
            </div>
            <button
              className={`med-button ${med.taken ? 'taken' : 'pending'}`}
              onClick={() => toggleMedication(med.id)}
            >
              {med.taken ? '✓' : '○'}
            </button>
          </div>
        ))}
      </div>

      {completedCount === totalCount && totalCount > 0 && (
        <div className="completion-message">
          🎉 All medications taken today!
        </div>
      )}
    </div>
  )
}

export default Medication