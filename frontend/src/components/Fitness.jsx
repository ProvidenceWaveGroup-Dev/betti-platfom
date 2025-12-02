import React, { useState, useEffect } from 'react'
import fitnessApi from '../services/fitnessApi'
import './Fitness.css'
import '../styles/mobileFitness.scss'

function Fitness({ isCollapsed = false, variant = 'desktop', onNavigate }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchMode, setSearchMode] = useState('exercises') // 'exercises' or 'videos'
  const [searchResults, setSearchResults] = useState([])
  const [videoResults, setVideoResults] = useState([])
  const [recentWorkouts, setRecentWorkouts] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [todayStats, setTodayStats] = useState({ workouts: 0, calories: 0, minutes: 0 })
  const [showVideoModal, setShowVideoModal] = useState(false)
  const [selectedVideo, setSelectedVideo] = useState(null)
  const [validatedVideos, setValidatedVideos] = useState({})
  const [loading, setLoading] = useState(true)

  const isMobile = variant === 'mobile'

  // YouTube workout videos - using only channels known to allow embedding
  const workoutVideos = {
    'strength': [
      { id: 'oqBk1E6IcMM', title: '20 MIN Full Body Workout - Dig Deeper', channel: 'MadFit', duration: '20:11', category: 'Strength Training' },
      { id: 'ml6cT4AZdqI', title: '15 MIN HIIT CARDIO WORKOUT', channel: 'MadFit', duration: '15:32', category: 'Strength Training' },
      { id: '2Z9g-AZinUc', title: '20 MIN FULL BODY WORKOUT - Small Space Friendly (No Equipment, No Jumping)', channel: 'Hanna Smith', duration: '22:07', category: 'Strength Training' }
    ],
    'hiit': [
      { id: 'ml6cT4AZdqI', title: '15 MIN HIIT CARDIO WORKOUT', channel: 'MadFit', duration: '15:32', category: 'HIIT' },
      { id: 'TQZ5UA8r04s', title: '10 MIN AB WORKOUT', channel: 'Chloe Ting', duration: '10:35', category: 'HIIT' },
      { id: 'oqBk1E6IcMM', title: '20 MIN Full Body Workout', channel: 'MadFit', duration: '20:11', category: 'HIIT' }
    ],
    'yoga': [
      { id: 'v7AYKMP6rOE', title: 'Yoga For Complete Beginners', channel: 'Yoga With Adriene', duration: '20:21', category: 'Yoga' },
      { id: 'hJbRpHZr_d0', title: '20 min Morning Yoga Flow', channel: 'Yoga with Adriene', duration: '20:21', category: 'Yoga' },
      { id: 'X655B_QKM5g', title: '30 min Yoga Flow', channel: 'Yoga with Kassandra', duration: '30:15', category: 'Yoga' }
    ],
    'cardio': [
      { id: 'ml6cT4AZdqI', title: '15 MIN HIIT CARDIO', channel: 'MadFit', duration: '15:32', category: 'Cardio' },
      { id: 'TQZ5UA8r04s', title: '10 MIN High Intensity Cardio', channel: 'Chloe Ting', duration: '10:35', category: 'Cardio' },
      { id: 'gBxeju8dMho', title: '20 MIN Cardio Workout', channel: 'POPSUGAR Fitness', duration: '20:18', category: 'Cardio' }
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

  // Check if a YouTube video allows embedding using oEmbed API
  const checkVideoEmbeddable = async (videoId) => {
    try {
      const response = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`)
      if (response.ok) {
        const data = await response.json()
        return { embeddable: true, title: data.title, author: data.author_name }
      }
      return { embeddable: false, error: 'Not embeddable' }
    } catch (error) {
      return { embeddable: false, error: 'API error' }
    }
  }

  // Validate all videos on component mount (desktop only for performance)
  const validateAllVideos = async () => {
    if (isMobile) return // Skip validation on mobile for performance

    const validation = {}
    for (const video of allVideos) {
      if (!validatedVideos[video.id]) {
        const result = await checkVideoEmbeddable(video.id)
        validation[video.id] = result
        // Add a small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }
    setValidatedVideos(prev => ({ ...prev, ...validation }))
  }

  useEffect(() => {
    loadQuickStats()
    validateAllVideos()
  }, [])

  const loadQuickStats = async () => {
    try {
      setLoading(true)

      // Load from backend API
      const response = await fitnessApi.getTodaySummary()

      if (response.success && response.data) {
        const data = response.data
        setTodayStats({
          workouts: data.workouts_count || 0,
          calories: data.calories_burned || 0,
          minutes: data.active_minutes || 0
        })

        // Transform workouts for display
        const transformedWorkouts = (data.workouts || []).slice(0, 3).map(w => ({
          type: w.workout_type,
          duration: w.duration_min,
          caloriesBurned: w.calories_burned,
          timestamp: w.started_at
        }))
        setRecentWorkouts(transformedWorkouts)
      }
    } catch (error) {
      console.error('Failed to load fitness stats:', error)
      // Fallback to zeros on error
      setTodayStats({ workouts: 0, calories: 0, minutes: 0 })
      setRecentWorkouts([])
    } finally {
      setLoading(false)
    }
  }

  const updateDailyStats = (workoutData) => {
    // Optimistically update state immediately for responsive UI
    setTodayStats(prev => ({
      workouts: prev.workouts + 1,
      calories: prev.calories + workoutData.caloriesBurned,
      minutes: prev.minutes + workoutData.duration
    }))

    // Add to recent workouts (keep last 3)
    const newWorkout = {
      type: workoutData.type,
      duration: workoutData.duration,
      caloriesBurned: workoutData.caloriesBurned,
      timestamp: new Date().toISOString()
    }
    setRecentWorkouts(prev => [newWorkout, ...prev.slice(0, 2)])

    // Reload from backend to ensure consistency (non-blocking)
    loadQuickStats().catch(err => console.error('Failed to refresh stats:', err))
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

        // Filter out videos that we know are not embeddable (desktop only)
        if (!isMobile) {
          const embeddableResults = results.filter(video => {
            const validation = validatedVideos[video.id]
            return validation && validation.embeddable === true
          })
          setVideoResults(embeddableResults.slice(0, 6))
        } else {
          // Mobile: show results directly without validation
          setVideoResults(results.slice(0, 6))
        }
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

      // Mobile haptic feedback
      if (isMobile && navigator.vibrate) {
        navigator.vibrate(50)
      }

      // Show success feedback
      if (isMobile) {
        alert(`Workout logged: ${exercise.name} for ${duration} minutes!`)
      } else {
        showWorkoutLogged(exercise.name, duration, workoutData.caloriesBurned)
      }

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

      // Mobile haptic feedback
      if (isMobile && navigator.vibrate) {
        navigator.vibrate(50)
      }

      // Show success feedback (desktop only - mobile shows in video modal)
      if (!isMobile) {
        showWorkoutLogged(video.title, durationMinutes, estimatedCalories)
      }

      // Open video in modal
      setSelectedVideo(video)
      setShowVideoModal(true)

    } catch (error) {
      console.error('Failed to log video workout:', error)
    }
  }

  const showWorkoutLogged = (name, duration, calories) => {
    // Simple visual feedback - could be enhanced with toast notifications
    console.log(`Workout Logged: ${name} - ${duration}min, ${calories}cal`)
  }

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'strength': return '💪'
      case 'hiit': return '⚡'
      case 'yoga': return '🧘'
      case 'cardio': return '🏃'
      default: return '💪'
    }
  }

  const getWorkoutIcon = (type) => {
    if (type === 'Strength Training') return '💪'
    if (type === 'Cardio') return '🏃'
    if (type === 'HIIT') return '⚡'
    if (type === 'Yoga') return '🧘'
    return '💪'
  }

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  // Collapsed desktop view
  if (isCollapsed && !isMobile) {
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

  // Mobile loading state
  if (loading && isMobile) {
    return (
      <div className="mobile-fitness">
        <h2>Fitness Tracker</h2>
        <div className="loading-state">
          <span>Loading fitness data...</span>
        </div>
      </div>
    )
  }

  // Duration Picker Modal (shared)
  const renderDurationModal = () => {
    if (!showDurationPicker || !selectedExercise) return null

    return (
      <div className="modal-overlay">
        <div className="duration-modal">
          <h3>Log {selectedExercise.name}</h3>
          <p>How many minutes did you exercise?</p>

          <div className={isMobile ? "duration-buttons" : "duration-selector"}>
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
                inputMode={isMobile ? "numeric" : undefined}
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
              className={isMobile ? "log-btn" : "log-btn-modal"}
              onClick={() => logQuickWorkout(selectedExercise, customDuration)}
            >
              Log Workout
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Video Player Modal (shared)
  const renderVideoModal = () => {
    if (!showVideoModal || !selectedVideo) return null

    return (
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
                height={isMobile ? "300" : "400"}
                src={`https://www.youtube.com/embed/${selectedVideo.id}?autoplay=1&rel=0&modestbranding=1&showinfo=0`}
                title={selectedVideo.title}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                loading="lazy"
              ></iframe>
            </div>
            <div className="video-details">
              <div className="video-info">
                {isMobile ? (
                  <div className="video-meta">
                    <span className="video-channel">By {selectedVideo.channel}</span>
                    <span className="video-duration">{selectedVideo.duration}</span>
                    <span className="video-category">{selectedVideo.category}</span>
                  </div>
                ) : (
                  <>
                    <span className="video-channel">By {selectedVideo.channel}</span>
                    <span className="video-duration">{selectedVideo.duration}</span>
                    <span className="video-category">{selectedVideo.category}</span>
                  </>
                )}
                {isMobile && (
                  <div className="video-logged-message">
                    ✅ Workout logged successfully!
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Mobile layout
  if (isMobile) {
    return (
      <div className="mobile-fitness">
        <h2>Fitness Tracker</h2>

        {/* Daily Stats Overview */}
        <section className="fitness-overview">
          <div className="stats-grid">
            <div className="stat-item">
              <div className="stat-icon">💪</div>
              <div className="stat-content">
                <div className="stat-value">{todayStats.workouts}</div>
                <div className="stat-label">Workouts</div>
              </div>
            </div>
            <div className="stat-item">
              <div className="stat-icon">🔥</div>
              <div className="stat-content">
                <div className="stat-value">{todayStats.calories}</div>
                <div className="stat-label">Calories</div>
              </div>
            </div>
            <div className="stat-item">
              <div className="stat-icon">⏱️</div>
              <div className="stat-content">
                <div className="stat-value">{todayStats.minutes}</div>
                <div className="stat-label">Minutes</div>
              </div>
            </div>
          </div>
        </section>

        {/* Search Section */}
        <section className="search-section">
          <h3>Log Workout</h3>

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
            inputMode="search"
            placeholder={searchMode === 'exercises' ? "Search exercises..." : "Search workout videos..."}
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="search-input"
          />

          {isSearching && (
            <div className="search-loading">Searching...</div>
          )}

          {searchResults.length > 0 && (
            <div className="search-results">
              {searchResults.map((result, index) => (
                <div key={index} className="search-result-item">
                  <button
                    className="exercise-result"
                    onClick={() => handleExerciseSelect(result)}
                  >
                    <div className="exercise-info">
                      <div className="exercise-name">{result.name}</div>
                      <div className="exercise-details">{result.category} • {result.calories_per_minute} cal/min</div>
                    </div>
                    <div className="exercise-action">+</div>
                  </button>
                </div>
              ))}
            </div>
          )}

          {videoResults.length > 0 && (
            <div className="search-results">
              {videoResults.map((video, index) => (
                <div key={index} className="search-result-item">
                  <button
                    className="video-result"
                    onClick={() => logVideoWorkout(video)}
                  >
                    <div className="video-info">
                      <div className="video-title">{video.title}</div>
                      <div className="video-details">{video.channel} • {video.duration}</div>
                    </div>
                    <div className="video-action">▶️</div>
                  </button>
                </div>
              ))}
            </div>
          )}

          {searchQuery.length === 0 && searchMode === 'videos' && (
            <div className="category-shortcuts">
              <div className="category-label">Quick Categories</div>
              <div className="category-buttons">
                {['strength', 'hiit', 'yoga', 'cardio'].map((category) => (
                  <button
                    key={category}
                    className="category-btn"
                    onClick={() => handleSearch(category)}
                  >
                    <span className="category-icon">{getCategoryIcon(category)}</span>
                    <span className="category-name">{category.toUpperCase()}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Today's Workouts */}
        {recentWorkouts.length > 0 && (
          <section className="todays-workouts">
            <h3>Today's Workouts</h3>
            <div className="workouts-list">
              {recentWorkouts.map((workout, index) => (
                <div key={index} className="workout-item">
                  <div className="workout-icon">
                    {getWorkoutIcon(workout.type)}
                  </div>
                  <div className="workout-content">
                    <div className="workout-header">
                      <div className="workout-type">{workout.type}</div>
                      <div className="workout-time">{formatTime(workout.timestamp)}</div>
                    </div>
                    <div className="workout-stats">
                      {workout.duration}min • {workout.caloriesBurned} calories
                    </div>
                  </div>
                  <div className="workout-status">✓</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {searchQuery.length === 0 && recentWorkouts.length === 0 && (
          <section className="no-workouts">
            <div className="no-workouts-content">
              <div className="no-workouts-icon">💪</div>
              <div className="no-workouts-text">No workouts logged today</div>
              <div className="no-workouts-hint">Search exercises or videos to get started!</div>
            </div>
          </section>
        )}

        {renderDurationModal()}
        {renderVideoModal()}
      </div>
    )
  }

  // Desktop full layout
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
                  <span className="video-meta">
                    {video.channel} • {video.duration}
                  </span>
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
                  <span className="recent-time">{formatTime(workout.timestamp)}</span>
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
                  {getCategoryIcon(category)}
                  <span>{category.toUpperCase()}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {renderDurationModal()}
      {renderVideoModal()}
    </div>
  )
}

export default Fitness
