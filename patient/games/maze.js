const MazeNavigationTask = (function() {
  let container, canvas, ctx;
  let maze = [];
  let playerPos = { x: 0, y: 0 };
  let exitPos = { x: 0, y: 0 };
  let startTime, endTime;
  let completeCallback;
  let instructions, startButton, resetButton, timeDisplay;
  let gameStarted = false;
  let gameCompleted = false;
  let mazeSize = 10;
  let cellSize = 40;
  let complexity = 0.7;
  let updateTimer = null;
  let keyboardListener = null;
  
  const WALL = 1;
  const PATH = 0;
  const PLAYER = 2;
  const EXIT = 3;
  const COLORS = {
    wall: '#333',
    path: '#F9FAFB',
    player: '#57B5E7',
    exit: '#4CAF50',
    border: '#DDD'
  };
  
  const DIRECTIONS = [
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 }
  ];
  
  function generateMaze(width, height, complexity) {
    const grid = Array(height).fill().map(() => Array(width).fill(WALL));
    
    const startX = Math.floor(Math.random() * Math.floor(width / 2)) * 2;
    const startY = Math.floor(Math.random() * Math.floor(height / 2)) * 2;
    grid[startY][startX] = PATH;
    
    const stack = [{ x: startX, y: startY }];
    
    while (stack.length > 0) {
      const current = stack[stack.length - 1];
      
      const neighbors = [];
      for (const dir of DIRECTIONS) {
        const nx = current.x + dir.x * 2;
        const ny = current.y + dir.y * 2;
        
        if (nx >= 0 && nx < width && ny >= 0 && ny < height && grid[ny][nx] === WALL) {
          neighbors.push({ x: nx, y: ny, dx: dir.x, dy: dir.y });
        }
      }
      
      if (neighbors.length > 0) {
        const next = neighbors[Math.floor(Math.random() * neighbors.length)];
        
        grid[current.y + next.dy][current.x + next.dx] = PATH;
        grid[next.y][next.x] = PATH;
        
        stack.push({ x: next.x, y: next.y });
      } else {
        stack.pop();
      }
    }
    
    const pathCount = Math.floor((1 - complexity) * width * height * 0.1);
    for (let i = 0; i < pathCount; i++) {
      const x = 1 + Math.floor(Math.random() * (width - 2));
      const y = 1 + Math.floor(Math.random() * (height - 2));
      grid[y][x] = PATH;
    }
    
    playerPos = { x: 1, y: 1 };
    if (grid[playerPos.y][playerPos.x] === WALL) {
      grid[playerPos.y][playerPos.x] = PATH;
    }
    
    exitPos = { x: width - 2, y: height - 2 };
    if (grid[exitPos.y][exitPos.x] === WALL) {
      grid[exitPos.y][exitPos.x] = PATH;
    }
    
    ensurePathToExit(grid, playerPos, exitPos);
    
    return grid;
  }
  
  function ensurePathToExit(grid, start, end) {
    const height = grid.length;
    const width = grid[0].length;
    
    const openSet = [{ x: start.x, y: start.y, g: 0, h: 0, f: 0 }];
    const closedSet = new Set();
    const cameFrom = {};
    
    while (openSet.length > 0) {
      let current = openSet[0];
      let currentIndex = 0;
      
      for (let i = 1; i < openSet.length; i++) {
        if (openSet[i].f < current.f) {
          current = openSet[i];
          currentIndex = i;
        }
      }
      
      openSet.splice(currentIndex, 1);
      
      const key = `${current.x},${current.y}`;
      closedSet.add(key);
      
      if (current.x === end.x && current.y === end.y) {
        return;
      }
      
      for (const dir of DIRECTIONS) {
        const nx = current.x + dir.x;
        const ny = current.y + dir.y;
        
        if (nx < 0 || nx >= width || ny < 0 || ny >= height || grid[ny][nx] === WALL) {
          continue;
        }
        
        const neighborKey = `${nx},${ny}`;
        if (closedSet.has(neighborKey)) {
          continue;
        }
        
        const g = current.g + 1;
        const h = Math.abs(nx - end.x) + Math.abs(ny - end.y);
        const f = g + h;
        
        let inOpenSet = false;
        for (const node of openSet) {
          if (node.x === nx && node.y === ny) {
            inOpenSet = true;
            if (g < node.g) {
              node.g = g;
              node.f = f;
              cameFrom[neighborKey] = key;
            }
            break;
          }
        }
        
        if (!inOpenSet) {
          openSet.push({ x: nx, y: ny, g, h, f });
          cameFrom[neighborKey] = key;
        }
      }
    }
    
    let x = end.x;
    let y = end.y;
    
    while (x !== start.x || y !== start.y) {
      grid[y][x] = PATH;
      
      if (x > start.x) x--;
      else if (x < start.x) x++;
      else if (y > start.y) y--;
      else if (y < start.y) y++;
    }
  }
  
  function drawMaze() {
    if (!ctx) return;
    
    ctx.fillStyle = COLORS.path;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    for (let y = 0; y < maze.length; y++) {
      for (let x = 0; x < maze[y].length; x++) {
        const cellType = maze[y][x];
        
        if (cellType === WALL) {
          ctx.fillStyle = COLORS.wall;
          ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        } else {
          ctx.fillStyle = COLORS.path;
          ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
          
          ctx.strokeStyle = COLORS.border;
          ctx.strokeRect(x * cellSize, y * cellSize, cellSize, cellSize);
        }
      }
    }
    
    ctx.fillStyle = COLORS.exit;
    ctx.beginPath();
    ctx.arc(
      exitPos.x * cellSize + cellSize / 2,
      exitPos.y * cellSize + cellSize / 2,
      cellSize / 3,
      0,
      Math.PI * 2
    );
    ctx.fill();
    
    ctx.fillStyle = COLORS.player;
    ctx.beginPath();
    ctx.arc(
      playerPos.x * cellSize + cellSize / 2,
      playerPos.y * cellSize + cellSize / 2,
      cellSize / 3,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
  
  function movePlayer(dx, dy) {
    if (!gameStarted || gameCompleted) return;
    
    const newX = playerPos.x + dx;
    const newY = playerPos.y + dy;
    
    if (
      newX >= 0 && newX < maze[0].length &&
      newY >= 0 && newY < maze.length &&
      maze[newY][newX] !== WALL
    ) {
      playerPos.x = newX;
      playerPos.y = newY;
      drawMaze();
      
      if (playerPos.x === exitPos.x && playerPos.y === exitPos.y) {
        endTime = new Date();
        gameCompleted = true;
        completeGame();
      }
    }
  }
  
  function handleKeyDown(e) {
    if (!gameStarted || gameCompleted) return;
    
    switch (e.key) {
      case 'ArrowUp':
        movePlayer(0, -1);
        e.preventDefault();
        break;
      case 'ArrowRight':
        movePlayer(1, 0);
        e.preventDefault();
        break;
      case 'ArrowDown':
        movePlayer(0, 1);
        e.preventDefault();
        break;
      case 'ArrowLeft':
        movePlayer(-1, 0);
        e.preventDefault();
        break;
    }
  }
  
  function updateTime() {
    if (!gameStarted || gameCompleted || !timeDisplay) return;
    
    const currentTime = new Date();
    const elapsedSeconds = Math.floor((currentTime - startTime) / 1000);
    const minutes = Math.floor(elapsedSeconds / 60);
    const seconds = elapsedSeconds % 60;
    
    timeDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    updateTimer = setTimeout(updateTime, 1000);
  }
  
  function completeGame() {
    clearTimeout(updateTimer);
    
    const timeTaken = (endTime - startTime) / 1000;
    
    const resultsElement = document.createElement('div');
    resultsElement.className = 'mt-4 text-center';
    resultsElement.innerHTML = `
      <p class="text-green-600 font-bold">Maze Completed!</p>
      <p class="text-sm">Time: ${formatTime(timeTaken)}</p>
    `;
    container.appendChild(resultsElement);
    
    resetButton.style.display = 'block';
    
    const record = {
      game: 'maze',
      results: { time: timeTaken },
      timestamp: new Date().toISOString()
    };
    
    let gameRecords = JSON.parse(localStorage.getItem('gameRecords')) || [];
    gameRecords.push(record);
    if (gameRecords.length > 50) {
      gameRecords = gameRecords.slice(-50);
    }
    localStorage.setItem('gameRecords', JSON.stringify(gameRecords));
    
    if (typeof completeCallback === 'function') {
      completeCallback(timeTaken);
    }
  }
  
  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  
  function createControls() {
    instructions = document.createElement('div');
    instructions.className = 'mt-4 text-center text-gray-700';
    instructions.innerHTML = `
      <p class="font-medium">Navigate through the maze to reach the green exit</p>
      <p class="text-sm mt-1">Use arrow keys to move</p>
    `;
    container.appendChild(instructions);
    
    const timeContainer = document.createElement('div');
    timeContainer.className = 'mt-4 flex items-center justify-center';
    timeContainer.innerHTML = `
      <div class="text-sm text-gray-600 mr-2">Time:</div>
    `;
    
    timeDisplay = document.createElement('div');
    timeDisplay.className = 'font-mono font-medium';
    timeDisplay.textContent = '00:00';
    timeContainer.appendChild(timeDisplay);
    
    container.appendChild(timeContainer);
    
    startButton = document.createElement('button');
    startButton.className = 'mt-4 bg-primary text-white px-6 py-2 rounded-button font-semibold hover:bg-primary/90 w-full';
    startButton.textContent = 'Start Maze';
    startButton.addEventListener('click', startGame);
    container.appendChild(startButton);
    
    resetButton = document.createElement('button');
    resetButton.className = 'mt-4 bg-gray-500 text-white px-6 py-2 rounded-button font-semibold hover:bg-gray-600 w-full';
    resetButton.textContent = 'Try Another Maze';
    resetButton.style.display = 'none';
    resetButton.addEventListener('click', reset);
    container.appendChild(resetButton);
    
    const touchControls = document.createElement('div');
    touchControls.className = 'mt-4 grid grid-cols-3 gap-2 w-full max-w-xs';
    touchControls.innerHTML = `
      <div></div>
      <button class="bg-gray-200 p-3 rounded-lg flex items-center justify-center" data-dir="up">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
        </svg>
      </button>
      <div></div>
      
      <button class="bg-gray-200 p-3 rounded-lg flex items-center justify-center" data-dir="left">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <div></div>
      <button class="bg-gray-200 p-3 rounded-lg flex items-center justify-center" data-dir="right">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </button>
      
      <div></div>
      <button class="bg-gray-200 p-3 rounded-lg flex items-center justify-center" data-dir="down">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div></div>
    `;
    container.appendChild(touchControls);
    
    touchControls.querySelectorAll('button').forEach(button => {
      button.addEventListener('click', () => {
        const direction = button.getAttribute('data-dir');
        switch (direction) {
          case 'up': movePlayer(0, -1); break;
          case 'right': movePlayer(1, 0); break;
          case 'down': movePlayer(0, 1); break;
          case 'left': movePlayer(-1, 0); break;
        }
      });
    });
  }
  
  function startGame() {
    maze = generateMaze(mazeSize, mazeSize, complexity);
    
    gameStarted = true;
    gameCompleted = false;
    startTime = new Date();
    
    startButton.style.display = 'none';
    resetButton.style.display = 'none';
    
    const resultsElement = container.querySelector('div:last-child');
    if (resultsElement !== resetButton && resultsElement !== startButton && 
        resultsElement !== timeDisplay.parentNode && resultsElement !== instructions) {
      resultsElement.remove();
    }
    
    updateTime();
    
    if (!keyboardListener) {
      keyboardListener = handleKeyDown;
      document.addEventListener('keydown', keyboardListener);
    }
    
    drawMaze();
  }
  
  function reset() {
    clearTimeout(updateTimer);
    
    startButton.style.display = 'block';
    resetButton.style.display = 'none';
    timeDisplay.textContent = '00:00';
    
    gameStarted = false;
    gameCompleted = false;
    
    const resultsElement = container.querySelector('div:last-child');
    if (resultsElement !== resetButton && resultsElement !== startButton && 
        resultsElement !== timeDisplay.parentNode && resultsElement !== instructions) {
      resultsElement.remove();
    }
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  
  function init(containerEl, options = {}) {
    const defaultOptions = {
      mazeSize: 10,
      cellSize: 40,
      complexity: 0.7,
      onComplete: null
    };
    
    const gameOptions = { ...defaultOptions, ...options };
    
    container = containerEl;
    container.classList.add('flex', 'flex-col', 'items-center', 'p-4');
    completeCallback = gameOptions.onComplete;
    mazeSize = gameOptions.mazeSize;
    cellSize = gameOptions.cellSize;
    complexity = gameOptions.complexity;
    
    canvas = document.createElement('canvas');
    canvas.width = mazeSize * cellSize;
    canvas.height = mazeSize * cellSize;
    canvas.className = 'border border-gray-300 rounded-lg';
    container.appendChild(canvas);
    
    ctx = canvas.getContext('2d');
    
    createControls();
    
    return {
      reset,
      getTime: () => {
        if (!startTime) return 0;
        const endTimeValue = endTime || new Date();
        return (endTimeValue - startTime) / 1000;
      }
    };
  }
  
  return {
    init
  };
})();

export default MazeNavigationTask;