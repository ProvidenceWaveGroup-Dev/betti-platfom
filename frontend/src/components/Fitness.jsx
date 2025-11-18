import React, { useState, useEffect } from 'react'
import fitnessApi from '../services/fitnessApi'
import './Fitness.css'

function Fitness({ isCollapsed = false }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchMode, setSearchMode] = useState('exercises') // 'exercises' or 'videos'
  const [searchResults, setSearchResults] = useState([])
  const [videoResults, setVideoResults] = useState([])
  const [recentWorkouts, setRecentWorkouts] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [todayStats, setTodayStats] = useState({ workouts: 0, calories: 0, minutes: 0 })
  const [showVideoModal, setShowVideoModal] = useState(false)
  const [selectedVideo, setSelectedVideo] = useState(null)

  // Real YouTube workout videos with correct metadata
  const workoutVideos = {
    'strength': [
      { id: 'UItWltVZZmE', title: 'Full Body Strength Training Workout', channel: 'FitnessBlender', duration: '37:14', category: 'Strength Training' },
      { id: 'R4W5zs8EtS0', title: 'Beginner Bodyweight Workout', channel: 'Calisthenic Movement', duration: '15:03', category: 'Strength Training' },
      { id: 'IODxDxX7oi4', title: 'Upper Body Strength - No Equipment', channel: 'HIIT Workouts', duration: '12:45', category: 'Strength Training' }
    ],
    'hiit': [
      { id: 'WjsKpUWUkjk', title: '20-Minute Full Body HIIT Workout', channel: 'POPSUGAR Fitness', duration: '21:03', category: 'HIIT' },
      { id: 'ml6cT4AZdqI', title: '15 MIN HIIT CARDIO WORKOUT', channel: 'MadFit', duration: '15:32', category: 'HIIT' },
      { id: '4J6ZaGNvxr0', title: 'HIIT Workout For Fat Loss', channel: 'Fraser Wilson', duration: '10:47', category: 'HIIT' }
    ],
    'yoga': [
      { id: 'VaoV1PrYft4', title: 'Morning Yoga Flow - Yoga With Adriene', channel: 'Yoga With Adriene', duration: '30:25', category: 'Yoga' },
      { id: 'v7AYKMP6rOE', title: 'Yoga For Complete Beginners', channel: 'Yoga With Adriene', duration: '20:21', category: 'Yoga' },
      { id: 'X3-gKPNyrTA', title: 'Bedtime Yoga - 20 Minute Practice', channel: 'Yoga With Adriene', duration: '20:43', category: 'Yoga' }
    ],
    'cardio': [
      { id: '3uaEsm9-dqQ', title: '30 MIN DANCE PARTY WORKOUT', channel: 'emkfit', duration: '30:12', category: 'Cardio' },
      { id: 'gC_L9qAHVJ8', title: 'Low Impact Cardio Workout', channel: 'HIIT Workouts', duration: '25:34', category: 'Cardio' },
      { id: '8WQDz5oZtyQ', title: 'Cardio Dance Workout', channel: 'MihranTV', duration: '30:51', category: 'Cardio' }
    ]
  }

  // All workout videos in one searchable array
  const allVideos = Object.values(workoutVideos).flat()

  // Exercise database for manual workouts
  const exercises = [
    { name: 'Push-ups', category: 'Strength Training', calories_per_minute: 8 },
    { name: 'Squats', category: 'Strength Training', calories_per_minute: 7 },
    { name: 'Burpees', category: 'HIIT', calories_per_minute: 12 },
    { name: 'Jumping Jacks', category: 'Cardio', calories_per_minute: 9 },
    { name: 'Plank', category: 'Strength Training', calories_per_minute: 4 },
    { name: 'Lunges', category: 'Strength Training', calories_per_minute: 6 },
    { name: 'Mountain Climbers', category: 'HIIT', calories_per_minute: 10 },
    { name: 'Running in Place', category: 'Cardio', calories_per_minute: 11 },
    { name: 'Sit-ups', category: 'Strength Training', calories_per_minute: 5 },
    { name: 'High Knees', category: 'Cardio', calories_per_minute: 8 }
  ]

  const [selectedExercise, setSelectedExercise] = useState(null)
  const [customDuration, setCustomDuration] = useState(30)
  const [showDurationPicker, setShowDurationPicker] = useState(false)

  useEffect(() => {
    loadQuickStats()
  }, [])

  const loadQuickStats = async () => {
    try {
      // Load from localStorage for real-time updates, fallback to JSON file
      const storedStats = localStorage.getItem('daily_fitness_stats')
      const today = new Date().toISOString().split('T')[0]

      if (storedStats) {
        const stats = JSON.parse(storedStats)
        if (stats.date === today) {
          setTodayStats({
            workouts: stats.workouts || 0,
            calories: stats.calories || 0,
            minutes: stats.minutes || 0
          })
          setRecentWorkouts(stats.recentWorkouts || [])
          return
        }
      }

      // Load initial data from JSON file
      const response = await fetch('/src/data/fitness.json')
      const data = await response.json()

      const initialStats = {
        date: today,
        workouts: 0,
        calories: 0,
        minutes: 0,
        recentWorkouts: data.recentWorkouts?.slice(0, 3) || []
      }

      localStorage.setItem('daily_fitness_stats', JSON.stringify(initialStats))

      setTodayStats({
        workouts: initialStats.workouts,
        calories: initialStats.calories,
        minutes: initialStats.minutes
      })
      setRecentWorkouts(initialStats.recentWorkouts)

    } catch (error) {
      console.error('Failed to load fitness stats:', error)
    }
  }

  const updateDailyStats = (workoutData) => {
    const today = new Date().toISOString().split('T')[0]
    const storedStats = localStorage.getItem('daily_fitness_stats')
    let stats = storedStats ? JSON.parse(storedStats) : { date: today, workouts: 0, calories: 0, minutes: 0, recentWorkouts: [] }

    // Reset stats if it's a new day
    if (stats.date !== today) {
      stats = { date: today, workouts: 0, calories: 0, minutes: 0, recentWorkouts: [] }
    }

    // Update stats
    stats.workouts += 1
    stats.calories += workoutData.caloriesBurned
    stats.minutes += workoutData.duration

    // Add to recent workouts (keep last 3)
    const newWorkout = {
      type: workoutData.type,
      duration: workoutData.duration,
      caloriesBurned: workoutData.caloriesBurned,
      timestamp: new Date().toISOString()
    }
    stats.recentWorkouts = [newWorkout, ...stats.recentWorkouts.slice(0, 2)]

    // Save to localStorage
    localStorage.setItem('daily_fitness_stats', JSON.stringify(stats))

    // Update state
    setTodayStats({
      workouts: stats.workouts,
      calories: stats.calories,
      minutes: stats.minutes
    })
    setRecentWorkouts(stats.recentWorkouts)
  }

  const handleSearch = async (query) => {
    setSearchQuery(query)

    if (query.length < 2) {
      setSearchResults([])
      setVideoResults([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)

    try {
      if (searchMode === 'exercises') {
        // Search exercises locally
        const normalizedQuery = query.toLowerCase()
        const filteredExercises = exercises.filter(exercise =>
          exercise.name.toLowerCase().includes(normalizedQuery) ||
          exercise.category.toLowerCase().includes(normalizedQuery)
        )
        setSearchResults(filteredExercises)
        setVideoResults([])
      } else {
        // Search videos
        const normalizedQuery = query.toLowerCase()
        let results = []

        // Search by category name
        Object.keys(workoutVideos).forEach(category => {
          if (normalizedQuery.includes(category) || category.includes(normalizedQuery)) {
            results = [...results, ...workoutVideos[category]]
          }
        })

        // Search by video title or channel
        if (results.length === 0) {
          results = allVideos.filter(video =>
            video.title.toLowerCase().includes(normalizedQuery) ||
            video.channel.toLowerCase().includes(normalizedQuery) ||
            video.category.toLowerCase().includes(normalizedQuery)
          )
        }

        // If no specific matches, show category results
        if (results.length === 0) {
          results = [
            ...workoutVideos['strength'].slice(0, 1),
            ...workoutVideos['cardio'].slice(0, 1),
            ...workoutVideos['hiit'].slice(0, 1)
          ]
        }

        setVideoResults(results.slice(0, 6))
        setSearchResults([])
      }
    } catch (error) {
      console.error('Search failed:', error)
      setSearchResults([])
      setVideoResults([])
    } finally {
      setIsSearching(false)
    }
  }

  const handleExerciseSelect = (exercise) => {
    setSelectedExercise(exercise)
    setShowDurationPicker(true)
  }

  const logQuickWorkout = async (exercise, duration = customDuration) => {
    try {
      const workoutData = {
        type: exercise.category,
        exercise: exercise.name,
        duration: duration,
        caloriesBurned: exercise.calories_per_minute * duration,
        timestamp: new Date().toISOString()
      }

      // Log to API (for historical data)
      await fitnessApi.logWorkout(workoutData)

      // Update local daily stats immediately
      updateDailyStats(workoutData)

      setSearchQuery('')
      setSearchResults([])
      setSelectedExercise(null)
      setShowDurationPicker(false)

      // Show success feedback
      showWorkoutLogged(exercise.name, duration, workoutData.caloriesBurned)

    } catch (error) {
      console.error('Failed to log workout:', error)
    }
  }

  const logVideoWorkout = async (video) => {
    try {
      const durationMinutes = parseInt(video.duration.split(':')[0]) || 30
      const estimatedCalories = durationMinutes * 8 // 8 calories/minute estimate

      const workoutData = {
        type: video.category,
        exercise: video.title,
        duration: durationMinutes,
        caloriesBurned: estimatedCalories,
        videoUrl: `https://youtube.com/watch?v=${video.id}`,
        timestamp: new Date().toISOString()
      }

      // Log to API (for historical data)
      await fitnessApi.logWorkout(workoutData)

      // Update local daily stats immediately
      updateDailyStats(workoutData)

      setSearchQuery('')
      setVideoResults([])

      // Show success feedback
      showWorkoutLogged(video.title, durationMinutes, estimatedCalories)

      // Open video in modal
      setSelectedVideo(video)
      setShowVideoModal(true)

    } catch (error) {
      console.error('Failed to log video workout:', error)
    }
  }

  const showWorkoutLogged = (name, duration, calories) => {
    // Simple visual feedback - could be enhanced with toast notifications
    console.log(`✅ Workout Logged: ${name} - ${duration}min, ${calories}cal`)
  }

  if (isCollapsed) {
    return (
      <div className="fitness-card collapsed">
        <div className="card-header">
          <h3 className="card-title">💪 Fitness</h3>
          <div className="stats-mini">
            {todayStats.workouts}W • {todayStats.calories}C
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fitness-card">
      <div className="card-header">
        <h2 className="card-title">💪 Fitness</h2>
        <div className="today-stats-inline">
          <span>{todayStats.workouts}W</span>
          <span>{todayStats.calories}C</span>
          <span>{todayStats.minutes}M</span>
        </div>
      </div>

      <div className="search-container">
        <div className="search-mode-tabs">
          <button
            className={`mode-tab ${searchMode === 'exercises' ? 'active' : ''}`}
            onClick={() => {
              setSearchMode('exercises')
              setSearchQuery('')
              setSearchResults([])
              setVideoResults([])
            }}
          >
            💪 Exercises
          </button>
          <button
            className={`mode-tab ${searchMode === 'videos' ? 'active' : ''}`}
            onClick={() => {
              setSearchMode('videos')
              setSearchQuery('')
              setSearchResults([])
              setVideoResults([])
            }}
          >
            🎬 Videos
          </button>
        </div>

        <input
          type="text"
          placeholder={searchMode === 'exercises' ? "Search exercises to log..." : "Search workout videos..."}
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          className="exercise-search"
        />

        {isSearching && (
          <div className="search-loading">Searching...</div>
        )}

        {searchResults.length > 0 && (
          <div className="search-results">
            {searchResults.map((exercise, index) => (
              <button
                key={index}
                className="exercise-result"
                onClick={() => handleExerciseSelect(exercise)}
              >
                <div className="exercise-info">
                  <span className="exercise-name">{exercise.name}</span>
                  <span className="exercise-category">{exercise.category} • {exercise.calories_per_minute} cal/min</span>
                </div>
                <span className="log-btn">+</span>
              </button>
            ))}
          </div>
        )}

        {videoResults.length > 0 && (
          <div className="search-results">
            {videoResults.map((video, index) => (
              <button
                key={index}
                className="video-result"
                onClick={() => logVideoWorkout(video)}
              >
                <div className="video-info">
                  <span className="video-title">{video.title}</span>
                  <span className="video-meta">{video.channel} • {video.duration}</span>
                </div>
                <span className="play-btn">▶️</span>
              </button>
            ))}
          </div>
        )}

        {searchQuery.length === 0 && recentWorkouts.length > 0 && (
          <div className="recent-suggestions">
            <div className="section-label">Today's Workouts</div>
            {recentWorkouts.map((workout, index) => (
              <div key={index} className="recent-item">
                <div className="recent-workout-info">
                  <span className="recent-name">{workout.type}</span>
                  <span className="recent-time">{new Date(workout.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </div>
                <span className="recent-stats">{workout.duration}min • {workout.caloriesBurned}cal</span>
              </div>
            ))}
          </div>
        )}

        {searchQuery.length === 0 && recentWorkouts.length === 0 && (
          <div className="no-workouts">
            <div className="no-workouts-message">
              <span className="no-workouts-icon">💪</span>
              <p>No workouts logged today</p>
              <p className="no-workouts-hint">Search exercises or videos to get started!</p>
            </div>
          </div>
        )}

        {searchQuery.length === 0 && searchMode === 'videos' && (
          <div className="video-categories">
            <div className="section-label">Quick Categories</div>
            <div className="category-buttons">
              {['strength', 'hiit', 'yoga', 'cardio'].map((category) => (
                <button
                  key={category}
                  className="category-btn"
                  onClick={() => handleSearch(category)}
                >
                  {category === 'strength' && '💪'}
                  {category === 'hiit' && '⚡'}
                  {category === 'yoga' && '🧘'}
                  {category === 'cardio' && '🏃'}
                  <span>{category.toUpperCase()}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Duration Picker Modal */}
      {showDurationPicker && selectedExercise && (
        <div className="modal-overlay">
          <div className="duration-modal">
            <h3>Log {selectedExercise.name}</h3>
            <p>How many minutes did you exercise?</p>

            <div className="duration-selector">
              <div className="duration-buttons">
                {[5, 10, 15, 20, 30, 45, 60].map(minutes => (
                  <button
                    key={minutes}
                    className={`duration-btn ${customDuration === minutes ? 'active' : ''}`}
                    onClick={() => setCustomDuration(minutes)}
                  >
                    {minutes}m
                  </button>
                ))}
              </div>

              <div className="custom-duration">
                <label>Custom:</label>
                <input
                  type="number"
                  min="1"
                  max="180"
                  value={customDuration}
                  onChange={(e) => setCustomDuration(parseInt(e.target.value) || 1)}
                  className="duration-input"
                />
                <span>minutes</span>
              </div>
            </div>

            <div className="duration-preview">
              <p>
                <strong>{selectedExercise.name}</strong> for <strong>{customDuration} minutes</strong>
              </p>
              <p>Estimated calories: <strong>{selectedExercise.calories_per_minute * customDuration}</strong></p>
            </div>

            <div className="modal-actions">
              <button
                className="cancel-btn"
                onClick={() => {
                  setShowDurationPicker(false)
                  setSelectedExercise(null)
                }}
              >
                Cancel
              </button>
              <button
                className="log-btn-modal"
                onClick={() => logQuickWorkout(selectedExercise, customDuration)}
              >
                Log Workout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Video Player Modal */}
      {showVideoModal && selectedVideo && (
        <div className="modal-overlay">
          <div className="video-player-modal">
            <div className="video-modal-header">
              <h3>{selectedVideo.title}</h3>
              <button
                className="close-video-btn"
                onClick={() => {
                  setShowVideoModal(false)
                  setSelectedVideo(null)
                }}
              >
                ✕
              </button>
            </div>
            <div className="video-modal-content">
              <div className="video-player">
                <iframe
                  width="100%"
                  height="400"
                  src={`https://www.youtube.com/embed/${selectedVideo.id}?autoplay=1`}
                  title={selectedVideo.title}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                ></iframe>
              </div>
              <div className="video-details">
                <div className="video-info">
                  <span className="video-channel">By {selectedVideo.channel}</span>
                  <span className="video-duration">{selectedVideo.duration}</span>
                  <span className="video-category">{selectedVideo.category}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Fitness