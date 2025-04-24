# ALZO Cognitive Games - File Structure

```
patient/games/
├── README.md                # Integration documentation
├── SUMMARY.md               # This file
├── index.js                 # Main module that exports all games
├── games.css                # Additional CSS styles
├── demo.html                # Demo page showcasing all games
├── clock.js                 # Clock Drawing Game component
├── trail.js                 # Trail Making Puzzle component
├── nback.js                 # N-Back Memory Game component
└── maze.js                  # Maze Navigation Task component
```

## File Descriptions

### index.js
The main entry point that exports all game components with a unified API. It provides methods to initialize games, get available game types, and retrieve game descriptions.

### clock.js
Implements the Clock Drawing Game where users set an analog clock to a specific time. Tests visuospatial abilities and executive function.

### trail.js
Implements the Trail Making Puzzle where users connect numbered dots in sequence. Tests visual attention and task switching.

### nback.js
Implements the N-Back Memory Game where users identify when the current stimulus matches the one shown n steps back. Tests working memory and attention.

### maze.js
Implements the Maze Navigation Task where users navigate through a 2D maze using arrow keys. Tests spatial navigation and planning.

### games.css
Contains additional CSS styles beyond Tailwind classes for game-specific elements and animations.

### demo.html
A standalone demo page that showcases all four games with a selection interface and results display.

### README.md
Comprehensive documentation on how to integrate the games into the ALZO dashboard, including code examples and API references.

## Integration Points

The games have been integrated into the ALZO patient dashboard in the following ways:

1. Added a link to the games in the sidebar navigation
2. Updated the "Memory Test" card to launch the N-Back Memory Game
3. Added a button to view all tests that links to the demo page

## Technologies Used

- Vanilla JavaScript (ES6+)
- HTML5 Canvas for rendering
- Tailwind CSS for styling
- Module pattern for encapsulation
- ES Modules for code organization