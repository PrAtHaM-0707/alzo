const TrailMakingPuzzle = (function() {
  let container, canvas, ctx;
  let dots = [];
  let lines = [];
  let currentDot = 1;
  let startTime, endTime;
  let errorCount = 0;
  let isDrawing = false;
  let lastPoint = null;
  let completeCallback;
  let instructions, startButton, resetButton;
  let gameStarted = false;
  let gameCompleted = false;
  
  const DOT_RADIUS = 20;
  const DOT_COLOR = '#57B5E7';
  const LINE_COLOR = '#333';
  const CORRECT_COLOR = '#4CAF50';
  const ERROR_COLOR = '#F44336';
  const TEXT_COLOR = 'white';
  const MIN_DISTANCE = 60;
  
  function generateDots(count, width, height) {
    dots = [];
    const padding = DOT_RADIUS * 2;
    
    for (let i = 1; i <= count; i++) {
      let x, y, overlapping;
      let attempts = 0;
      const maxAttempts = 50;
      
      do {
        overlapping = false;
        x = Math.random() * (width - padding * 2) + padding;
        y = Math.random() * (height - padding * 2) + padding;
        
        for (const dot of dots) {
          const distance = Math.sqrt(Math.pow(x - dot.x, 2) + Math.pow(y - dot.y, 2));
          if (distance < MIN_DISTANCE) {
            overlapping = true;
            break;
          }
        }
        
        attempts++;
      } while (overlapping && attempts < maxAttempts);
      
      if (attempts >= maxAttempts) {
        const gridCols = Math.ceil(Math.sqrt(count));
        const gridRows = Math.ceil(count / gridCols);
        const cellWidth = width / gridCols;
        const cellHeight = height / gridRows;
        
        const col = (i - 1) % gridCols;
        const row = Math.floor((i - 1) / gridCols);
        
        x = col * cellWidth + cellWidth / 2;
        y = row * cellHeight + cellHeight / 2;
      }
      
      dots.push({ x, y, number: i });
    }
  }
  
  function drawCanvas() {
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    for (const line of lines) {
      ctx.beginPath();
      ctx.moveTo(line.start.x, line.start.y);
      ctx.lineTo(line.end.x, line.end.y);
      ctx.strokeStyle = line.isError ? ERROR_COLOR : LINE_COLOR;
      ctx.stroke();
    }
    
    for (const dot of dots) {
      ctx.beginPath();
      ctx.arc(dot.x, dot.y, DOT_RADIUS, 0, Math.PI * 2);
      
      if (dot.number < currentDot) {
        ctx.fillStyle = CORRECT_COLOR;
      } else if (dot.number === currentDot) {
        ctx.fillStyle = DOT_COLOR;
      } else {
        ctx.fillStyle = DOT_COLOR;
        ctx.globalAlpha = 0.7;
      }
      
      ctx.fill();
      ctx.globalAlpha = 1.0;
      
      ctx.fillStyle = TEXT_COLOR;
      ctx.font = 'bold 16px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(dot.number.toString(), dot.x, dot.y);
    }
    
    if (isDrawing && lastPoint) {
      const mousePos = getMousePos(canvas, lastPoint);
      const currentDotObj = dots.find(d => d.number === currentDot - 1);
      
      if (currentDotObj) {
        ctx.beginPath();
        ctx.moveTo(currentDotObj.x, currentDotObj.y);
        ctx.lineTo(mousePos.x, mousePos.y);
        ctx.strokeStyle = LINE_COLOR;
        ctx.stroke();
      }
    }
  }
  
  function getMousePos(canvas, evt) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: evt.clientX - rect.left,
      y: evt.clientY - rect.top
    };
  }
  
  function isPointInDot(point, dot) {
    const distance = Math.sqrt(Math.pow(point.x - dot.x, 2) + Math.pow(point.y - dot.y, 2));
    return distance <= DOT_RADIUS;
  }
  
  function handleMouseDown(e) {
    if (gameCompleted) return;
    
    const mousePos = getMousePos(canvas, e);
    
    const currentDotObj = dots.find(d => d.number === currentDot);
    if (currentDotObj && isPointInDot(mousePos, currentDotObj)) {
      isDrawing = true;
      lastPoint = e;
      
      if (currentDot === 1 && !startTime) {
        startTime = new Date();
        gameStarted = true;
        
        if (startButton) startButton.style.display = 'none';
        if (resetButton) resetButton.style.display = 'block';
      }
    }
  }
  
  function handleMouseMove(e) {
    if (!isDrawing || gameCompleted) return;
    lastPoint = e;
    drawCanvas();
  }
  
  function handleMouseUp(e) {
    if (!isDrawing || gameCompleted) return;
    
    const mousePos = getMousePos(canvas, e);
    
    const nextDotObj = dots.find(d => d.number === currentDot + 1);
    if (nextDotObj && isPointInDot(mousePos, nextDotObj)) {
      const currentDotObj = dots.find(d => d.number === currentDot);
      lines.push({
        start: { x: currentDotObj.x, y: currentDotObj.y },
        end: { x: nextDotObj.x, y: nextDotObj.y },
        isError: false
      });
      
      currentDot++;
      
      if (currentDot === dots.length) {
        endTime = new Date();
        gameCompleted = true;
        completeGame();
      }
    } else {
      const clickedDot = dots.find(d => isPointInDot(mousePos, d));
      if (clickedDot && clickedDot.number !== currentDot) {
        const currentDotObj = dots.find(d => d.number === currentDot);
        lines.push({
          start: { x: currentDotObj.x, y: currentDotObj.y },
          end: { x: clickedDot.x, y: clickedDot.y },
          isError: true
        });
        
        errorCount++;
        
        setTimeout(() => {
          lines = lines.filter(line => !line.isError);
          drawCanvas();
        }, 500);
      }
    }
    
    isDrawing = false;
    drawCanvas();
  }
  
  function handleTouchStart(e) {
    e.preventDefault();
    if (e.touches.length === 1) {
      handleMouseDown(e.touches[0]);
    }
  }
  
  function handleTouchMove(e) {
    e.preventDefault();
    if (e.touches.length === 1) {
      handleMouseMove(e.touches[0]);
    }
  }
  
  function handleTouchEnd(e) {
    e.preventDefault();
    if (lastPoint) {
      handleMouseUp(lastPoint);
    }
  }
  
  function completeGame() {
    const timeTaken = (endTime - startTime) / 1000;
    
    const resultsElement = document.createElement('div');
    resultsElement.className = 'mt-4 text-center';
    resultsElement.innerHTML = `
      <p class="text-green-600 font-bold">Completed!</p>
      <p class="text-sm">Time: ${timeTaken.toFixed(1)} seconds</p>
      <p class="text-sm">Errors: ${errorCount}</p>
    `;
    container.appendChild(resultsElement);
    
    const record = {
      game: 'trail',
      results: {
        time: timeTaken,
        errors: errorCount
      },
      timestamp: new Date().toISOString()
    };
    
    let gameRecords = JSON.parse(localStorage.getItem('gameRecords')) || [];
    gameRecords.push(record);
    if (gameRecords.length > 50) {
      gameRecords = gameRecords.slice(-50);
    }
    localStorage.setItem('gameRecords', JSON.stringify(gameRecords));
    
    if (typeof completeCallback === 'function') {
      completeCallback({
        time: timeTaken,
        errors: errorCount
      });
    }
  }
  
  function createControls() {
    instructions = document.createElement('div');
    instructions.className = 'mt-4 text-center text-gray-700';
    instructions.innerHTML = `
      <p class="font-medium">Connect the dots in numerical order (1→2→3...)</p>
      <p class="text-sm mt-1">Click and drag from one number to the next</p>
    `;
    container.appendChild(instructions);
    
    startButton = document.createElement('button');
    startButton.className = 'mt-4 bg-primary text-white px-6 py-2 rounded-button font-semibold hover:bg-primary/90 w-full';
    startButton.textContent = 'Start Test';
    startButton.addEventListener('click', () => {
      startTime = new Date();
      gameStarted = true;
      startButton.style.display = 'none';
      resetButton.style.display = 'block';
      drawCanvas();
    });
    container.appendChild(startButton);
    
    resetButton = document.createElement('button');
    resetButton.className = 'mt-4 bg-gray-500 text-white px-6 py-2 rounded-button font-semibold hover:bg-gray-600 w-full';
    resetButton.textContent = 'Reset';
    resetButton.style.display = 'none';
    resetButton.addEventListener('click', reset);
    container.appendChild(resetButton);
  }
  
  function reset() {
    currentDot = 1;
    lines = [];
    errorCount = 0;
    startTime = null;
    endTime = null;
    isDrawing = false;
    lastPoint = null;
    gameStarted = false;
    gameCompleted = false;
    
    startButton.style.display = 'block';
    resetButton.style.display = 'none';
    
    const resultsElement = container.querySelector('div:last-child');
    if (resultsElement !== resetButton && resultsElement !== startButton && resultsElement !== instructions) {
      resultsElement.remove();
    }
    
    drawCanvas();
  }
  
  function init(containerEl, options = {}) {
    const defaultOptions = {
      dotCount: 10,
      gridSize: 400,
      onComplete: null
    };
    
    const gameOptions = { ...defaultOptions, ...options };
    
    container = containerEl;
    container.classList.add('flex', 'flex-col', 'items-center', 'p-4');
    completeCallback = gameOptions.onComplete;
    
    canvas = document.createElement('canvas');
    canvas.width = gameOptions.gridSize;
    canvas.height = gameOptions.gridSize;
    canvas.className = 'border border-gray-300 rounded-lg bg-white';
    container.appendChild(canvas);
    
    ctx = canvas.getContext('2d');
    
    generateDots(gameOptions.dotCount, canvas.width, canvas.height);
    
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseUp);
    
    canvas.addEventListener('touchstart', handleTouchStart);
    canvas.addEventListener('touchmove', handleTouchMove);
    canvas.addEventListener('touchend', handleTouchEnd);
    
    createControls();
    
    drawCanvas();
    
    return {
      reset,
      getResults: () => ({
        time: startTime && endTime ? (endTime - startTime) / 1000 : 0,
        errors: errorCount,
        completed: gameCompleted
      })
    };
  }
  
  return {
    init
  };
})();

export default TrailMakingPuzzle;