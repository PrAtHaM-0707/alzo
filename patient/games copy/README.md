# ALZO Cognitive Games

A collection of interactive cognitive assessment games for the ALZO patient dashboard.

## Overview

This package contains four standalone, modular game components that can be used to assess different cognitive functions:

1. **Clock-Drawing Game** - Tests visuospatial abilities and executive function
2. **Trail-Making Puzzle** - Tests visual attention and task switching
3. **N-Back Memory Game** - Tests working memory and attention
4. **Maze Navigation Task** - Tests spatial navigation and planning

All games are built with vanilla JavaScript, HTML5 Canvas, and Tailwind CSS, making them lightweight and easy to integrate into the ALZO dashboard.

## Installation

1. Copy the `games` directory to your ALZO patient dashboard directory
2. Include the necessary scripts and styles in your HTML:

```html
<!-- In the head section -->
<link href="games/games.css" rel="stylesheet">

<!-- At the end of the body -->
<script type="module">
  import ALZOGames from './games/index.js';
  
  // Your initialization code here
</script>
```

## Usage

### Basic Integration

To add a cognitive game to your dashboard:

```javascript
// Get a reference to your container element
const gameContainer = document.getElementById('game-container');

// Initialize a game (e.g., the Clock Drawing Game)
const clockGame = ALZOGames.init('clock', gameContainer, {
  // Game-specific options
  targetTime: "10:10" // 10 past 10
}, (score) => {
  // Handle completion
  console.log(`Clock test completed with score: ${score}`);
  // Save results to server
  saveResultsToServer('clock-test', score);
});
```

### Game Selection UI

You can create a game selection interface:

```javascript
// Get available games
const games = ALZOGames.getAvailableGames();

// Get game descriptions
games.forEach(gameType => {
  const gameInfo = ALZOGames.getGameDescription(gameType);
  
  // Create a selection card for each game
  const card = document.createElement('div');
  card.className = 'card game-card cursor-pointer';
  card.innerHTML = `
    <h3>${gameInfo.title}</h3>
    <p>${gameInfo.description}</p>
    <div>Skills: ${gameInfo.skills.join(', ')}</div>
  `;
  
  card.addEventListener('click', () => {
    // Initialize the selected game
    ALZOGames.init(gameType, gameContainer, {}, handleGameComplete);
  });
  
  // Add card to your UI
  gameSelectionContainer.appendChild(card);
});
```

## Game-Specific Options

### Clock Drawing Game

```javascript
const clockGame = ALZOGames.init('clock', container, {
  targetTime: "10:10",  // Time to set (default: "10:10")
  clockSize: 300,       // Clock diameter in pixels (default: 300)
  onComplete: (score) => {
    // score is a number from 0-100 representing accuracy
  }
});
```

### Trail Making Puzzle

```javascript
const trailGame = ALZOGames.init('trail', container, {
  dotCount: 10,        // Number of dots to connect (default: 10)
  gridSize: 400,       // Size of the grid in pixels (default: 400)
  onComplete: (results) => {
    // results.time - Time taken in seconds
    // results.errors - Number of incorrect connections
  }
});
```

### N-Back Memory Game

```javascript
const nbackGame = ALZOGames.init('nback', container, {
  nValue: 1,              // N value for the test (default: 1)
  sequenceLength: 20,     // Number of stimuli (default: 20)
  stimulusDuration: 1500, // Duration to show each stimulus in ms (default: 1500)
  onComplete: (results) => {
    // results.correct - Number of correct responses
    // results.incorrect - Number of incorrect responses
    // results.missed - Number of missed matches
    // results.total - Total possible matches
    // results.percentageScore - Score as percentage
  }
});
```

### Maze Navigation Task

```javascript
const mazeGame = ALZOGames.init('maze', container, {
  mazeSize: 10,       // Size of the maze in cells (default: 10)
  cellSize: 40,       // Size of each cell in pixels (default: 40)
  complexity: 0.7,    // Maze complexity from 0.0 to 1.0 (default: 0.7)
  onComplete: (time) => {
    // time - Time taken to complete the maze in seconds
  }
});
```

## Integration with ALZO Dashboard

To integrate these games with the existing ALZO patient dashboard:

1. Update the "Memory Test" card in `pat.html` to launch the games:

```html
<div class="card">
  <div class="flex justify-between items-center mb-4">
    <h2 class="text-lg font-semibold">Memory Test</h2>
    <button id="startTestBtn" class="text-sm text-primary font-medium">Start Test</button>
  </div>
  <div id="memoryTestContainer" class="text-sm">
    <p class="text-gray-500">Complete cognitive assessments to track your memory and cognitive function.</p>
  </div>
</div>

<script type="module">
  import ALZOGames from './games/index.js';
  
  document.getElementById('startTestBtn').addEventListener('click', () => {
    const container = document.getElementById('memoryTestContainer');
    container.innerHTML = '';
    
    // Start with the N-Back memory game
    ALZOGames.init('nback', container, {}, (results) => {
      // Save results to server
      saveTestResults('nback', results);
      
      // Show results summary
      container.innerHTML = `
        <div class="mt-4 text-center">
          <p class="font-bold text-green-600">Test Completed!</p>
          <p>Score: ${results.percentageScore}%</p>
          <button id="viewAllTestsBtn" class="mt-2 text-primary">View All Tests</button>
        </div>
      `;
      
      // Add button to view all tests
      document.getElementById('viewAllTestsBtn').addEventListener('click', () => {
        window.location.href = '/patient/games/demo.html';
      });
    });
  });
  
  async function saveTestResults(testType, results) {
    try {
      const response = await fetch('/api/auth/patient/cognitive-tests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          testType,
          results,
          timestamp: new Date().toISOString()
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to save test results');
      }
      
      console.log('Test results saved successfully');
    } catch (err) {
      console.error('Error saving test results:', err);
    }
  }
</script>
```

2. Add a new "Tests" page to the patient dashboard for a full testing experience.

## Demo

A demo page is included at `games/demo.html` that showcases all four games. You can use this to test the games and as a reference for integration.

## Browser Compatibility

These games are compatible with all modern browsers:
- Chrome 60+
- Firefox 60+
- Safari 12+
- Edge 79+

## Accessibility

The games include keyboard navigation support and touch controls for mobile devices. High contrast colors are used for better visibility.

## License

Copyright © 2024 ALZO Health. All rights reserved.