/**
 * ALZO Cognitive Games Module
 * 
 * This module integrates all cognitive assessment games and provides a unified API
 * for initializing and managing them in the ALZO patient dashboard.
 * 
 * @author Zen Coder
 * @version 1.0.0
 */

// Import individual game components
import ClockDrawingGame from './clock.js';
import TrailMakingPuzzle from './trail.js';
import NBackMemoryGame from './nback.js';
import MazeNavigationTask from './maze.js';

/**
 * ALZO Cognitive Games API
 * 
 * @namespace
 */
// Create the module with proper binding
const ALZOGames = (function() {
  // Private variables
  let activeGame = null;
  let activeGameType = null;
  let resultsCallback = null;
  
  /**
   * Initialize a cognitive game in the specified container
   * 
   * @param {string} gameType - Type of game to initialize ('clock', 'trail', 'nback', or 'maze')
   * @param {HTMLElement} containerEl - Container element to render the game in
   * @param {Object} options - Game-specific options
   * @param {Function} onComplete - Callback when game is completed with results
   * @returns {Object} - Game instance API
   * 
   * @example
   * // Initialize a clock drawing game
   * const game = ALZOGames.init('clock', document.getElementById('game-container'), {
   *   targetTime: "10:10"
   * }, (score) => {
   *   console.log(`Clock test completed with score: ${score}`);
   *   saveResults('clock-test', score);
   * });
   */
  function init(gameType, containerEl, options = {}, onComplete = null) {
    // Clear container
    containerEl.innerHTML = '';
    
    // Store callback
    resultsCallback = onComplete;
    
    // Initialize the requested game
    switch (gameType.toLowerCase()) {
      case 'clock':
        activeGame = ClockDrawingGame.init(containerEl, {
          ...options,
          onComplete: handleGameComplete
        });
        activeGameType = 'clock';
        break;
        
      case 'trail':
        activeGame = TrailMakingPuzzle.init(containerEl, {
          ...options,
          onComplete: handleGameComplete
        });
        activeGameType = 'trail';
        break;
        
      case 'nback':
        activeGame = NBackMemoryGame.init(containerEl, {
          ...options,
          onComplete: handleGameComplete
        });
        activeGameType = 'nback';
        break;
        
      case 'maze':
        activeGame = MazeNavigationTask.init(containerEl, {
          ...options,
          onComplete: handleGameComplete
        });
        activeGameType = 'maze';
        break;
        
      default:
        console.error(`Unknown game type: ${gameType}`);
        return null;
    }
    
    return activeGame;
  }
  
  /**
   * Handle game completion and forward results to callback
   * @param {*} results - Game-specific results
   */
  function handleGameComplete(results) {
    if (typeof resultsCallback === 'function') {
      resultsCallback(results);
    }
  }
  
  /**
   * Get all available game types
   * @returns {Array} - Array of game type strings
   */
  function getAvailableGames() {
    return ['clock', 'trail', 'nback', 'maze'];
  }
  
  /**
   * Get game description by type
   * @param {string} gameType - Type of game
   * @returns {Object} - Game description object
   */
  function getGameDescription(gameType) {
    const descriptions = {
      clock: {
        title: 'Clock Drawing Test',
        description: 'Set the clock hands to show the requested time.',
        skills: ['Visuospatial abilities', 'Executive function', 'Fine motor skills'],
        duration: '1-2 minutes'
      },
      trail: {
        title: 'Trail Making Test',
        description: 'Connect numbered dots in sequential order.',
        skills: ['Visual attention', 'Task switching', 'Processing speed'],
        duration: '1-3 minutes'
      },
      nback: {
        title: 'N-Back Memory Test',
        description: 'Press the button when you see a shape that matches the one shown previously.',
        skills: ['Working memory', 'Attention', 'Cognitive control'],
        duration: '2-3 minutes'
      },
      maze: {
        title: 'Maze Navigation Task',
        description: 'Navigate through the maze to reach the exit using arrow keys.',
        skills: ['Spatial navigation', 'Planning', 'Problem solving'],
        duration: '1-4 minutes'
      }
    };
    
    return descriptions[gameType.toLowerCase()] || null;
  }
  
  // Create the public API object with bound methods
  const api = {
    init: init,
    getAvailableGames: getAvailableGames,
    getGameDescription: getGameDescription
  };
  
  // Return the API
  return api;
})();

// Export the module
export default ALZOGames;