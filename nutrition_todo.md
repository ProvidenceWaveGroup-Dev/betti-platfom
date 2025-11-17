# Nutrition Feature Implementation TODO

## Completed Features ✅

### Phase 1: Data Structures and Basic Components
- ✅ Created `frontend/src/data/nutrition.json` with daily summary structure
- ✅ Created `frontend/src/data/foods-database.json` with 20 common food items
- ✅ Built `frontend/src/components/Nutrition.jsx` component with collapsed/expanded states
- ✅ Added `frontend/src/components/Nutrition.css` with responsive styling
- ✅ Integrated nutrition panel into `frontend/src/App.jsx` panel system
- ✅ Added nutrition navigation to `frontend/src/components/Header.jsx`
- ✅ Created compact mini-view for collapsed state (80px height, horizontal layout)
- ✅ Updated initial panel state to show nutrition as 'collapsed' by default
- ✅ Implemented three-state system: hidden -> collapsed -> visible -> hidden

### Current State
- Frontend displays nutrition data from static JSON files
- Shows daily calories, macros (protein, carbs, fat) with progress bars
- Responsive design works in 1-4 panel layouts
- Touch-optimized for 13.3" touchscreen (1920x1080)
- Action buttons present but not functional yet

## Pending Features 🔄

### Phase 2: Backend APIs and Data Persistence
- [ ] **Backend nutrition API endpoints**
  - [ ] `POST /api/nutrition/log-meal` - Add new meal entry
  - [ ] `GET /api/nutrition/daily` - Get daily nutrition summary
  - [ ] `GET /api/nutrition/foods` - Search food database
  - [ ] `PUT /api/nutrition/goals` - Update nutrition goals
  - [ ] `GET /api/nutrition/history` - Get historical data

- [ ] **Database integration**
  - [ ] Create nutrition database schema (meals, foods, user_goals)
  - [ ] Migrate static JSON data to database
  - [ ] Add data persistence for meal logging

- [ ] **Frontend API integration**
  - [ ] Connect Nutrition.jsx to backend APIs
  - [ ] Implement real meal logging functionality
  - [ ] Add loading states and error handling
  - [ ] Real-time data updates

### Phase 3: Advanced Features
- [ ] **Food Search and Entry**
  - [ ] Food search with autocomplete
  - [ ] Barcode scanning integration (camera API)
  - [ ] Custom food entry form
  - [ ] Portion size calculator

- [ ] **Smart Features**
  - [ ] Meal suggestions based on remaining macros
  - [ ] Quick-add favorite foods
  - [ ] Recipe builder with ingredient breakdown
  - [ ] Photo meal logging with AI recognition

- [ ] **Goal Management**
  - [ ] Customizable macro targets
  - [ ] Activity level adjustments
  - [ ] Weight goals integration
  - [ ] Dietary preference settings (keto, vegan, etc.)

### Phase 4: Analytics and Insights
- [ ] **Expanded Views**
  - [ ] Weekly nutrition trends
  - [ ] Monthly analytics dashboard
  - [ ] Macro timing analysis
  - [ ] Progress photos integration

- [ ] **Reports and Insights**
  - [ ] Nutrition score calculations
  - [ ] Deficiency warnings
  - [ ] Export data functionality
  - [ ] Integration with fitness trackers

## Technical Notes

### File Structure
```
frontend/src/
├── components/
│   ├── Nutrition.jsx           ✅ Main component
│   └── Nutrition.css           ✅ Styling
├── data/
│   ├── nutrition.json          ✅ Sample daily data
│   └── foods-database.json     ✅ Food database
└── services/
    └── nutritionApi.js         🔄 TODO: API service layer
```

### Backend Structure (TODO)
```
backend/src/
├── routes/
│   └── nutrition.js            🔄 TODO: API routes
├── models/
│   ├── Meal.js                🔄 TODO: Database models
│   ├── Food.js                🔄 TODO: Food database model
│   └── NutritionGoals.js      🔄 TODO: User goals model
└── services/
    └── nutritionService.js     🔄 TODO: Business logic
```

### Priority Order
1. **High Priority**: Backend APIs and database persistence (Phase 2)
2. **Medium Priority**: Food search and meal logging (Phase 3)
3. **Low Priority**: Analytics and advanced features (Phase 4)

## Integration Notes
- Works with existing panel system (drag-and-drop removed as requested)
- Follows same collapsed/expanded pattern as Health, Appointments, BLE Sensors
- Uses consistent styling with orange accent color (#ff8800)
- Responsive design supports 1-4 panel layouts
- Touch-optimized for smart mirror hardware

Last Updated: 2025-11-16