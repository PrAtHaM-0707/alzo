const NBackMemoryGame = (function() {
  let container, canvas, ctx;
  let sequence = [];
  let currentIndex = -1;
  let timer = null;
  let completeCallback;
  let instructions, startButton, matchButton, scoreDisplay;
  let gameStarted = false;
  let gameCompleted = false;
  let score = {
    correct: 0,
    incorrect: 0,
    missed: 0,
    total: 0
  };
  let nValue = 1;
  let sequenceLength = 20;
  let stimulusDuration = 1500;
  let interStimulusInterval = 500;
  
  const SHAPES = ['square', 'circle', 'triangle'];
  const COLORS = {
    square: '#57B5E7',
    circle: '#8DD3C7',
    triangle: '#FF9F7F',
    background: '#F9FAFB'
  };
  
  function generateSequence(length) {
    const seq = [];
    
    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * SHAPES.length);
      seq.push(SHAPES[randomIndex]);
    }
    
    const matchCount = Math.floor((length - nValue) * 0.3);
    for (let i = 0; i < matchCount; i++) {
      const matchPos = nValue + Math.floor(Math.random() * (length - nValue));
      seq[matchPos] = seq[matchPos - nValue];
    }
    
    return seq;
  }
  
  function drawShape(shape) {
    if (!ctx) return;
    
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const size = Math.min(canvas.width, canvas.height) * 0.3;
    
    ctx.fillStyle = COLORS[shape];
    
    switch (shape) {
      case 'square':
        ctx.fillRect(centerX - size / 2, centerY - size / 2, size, size);
        break;
        
      case 'circle':
        ctx.beginPath();
        ctx.arc(centerX, centerY, size / 2, 0, Math.PI * 2);
        ctx.fill();
        break;
        
      case 'triangle':
        ctx.beginPath();
        ctx.moveTo(centerX, centerY - size / 2);
        ctx.lineTo(centerX + size / 2, centerY + size / 2);
        ctx.lineTo(centerX - size / 2, centerY + size / 2);
        ctx.closePath();
        ctx.fill();
        break;
    }
  }
  
  function clearCanvas() {
    if (!ctx) return;
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  
  function showNextShape() {
    currentIndex++;
    
    if (currentIndex >= sequence.length) {
      completeGame();
      return;
    }
    
    const currentShape = sequence[currentIndex];
    drawShape(currentShape);
    
    if (currentIndex >= nValue) {
      const isMatch = sequence[currentIndex] === sequence[currentIndex - nValue];
      score.total += isMatch ? 1 : 0;
    }
    
    timer = setTimeout(() => {
      clearCanvas();
      
      timer = setTimeout(showNextShape, interStimulusInterval);
    }, stimulusDuration);
    
    updateScoreDisplay();
  }
  
  function handleMatchClick() {
    if (!gameStarted || gameCompleted || currentIndex < nValue) return;
    
    const isMatch = sequence[currentIndex] === sequence[currentIndex - nValue];
    
    if (isMatch) {
      score.correct++;
    } else {
      score.incorrect++;
    }
    
    matchButton.classList.add(isMatch ? 'bg-green-500' : 'bg-red-500');
    matchButton.classList.remove('bg-primary');
    
    setTimeout(() => {
      matchButton.classList.remove(isMatch ? 'bg-green-500' : 'bg-red-500');
      matchButton.classList.add('bg-primary');
    }, 300);
    
    updateScoreDisplay();
  }
  
  function updateScoreDisplay() {
    if (!scoreDisplay) return;
    
    scoreDisplay.innerHTML = `
      <div class="flex justify-between w-full">
        <div class="text-center">
          <div class="text-green-500 font-bold">${score.correct}</div>
          <div class="text-xs text-gray-500">Correct</div>
        </div>
        <div class="text-center">
          <div class="text-red-500 font-bold">${score.incorrect}</div>
          <div class="text-xs text-gray-500">Incorrect</div>
        </div>
        <div class="text-center">
          <div class="text-orange-500 font-bold">${score.missed}</div>
          <div class="text-xs text-gray-500">Missed</div>
        </div>
      </div>
    `;
  }
  
  function completeGame() {
    gameCompleted = true;
    clearTimeout(timer);
    
    let totalMatches = 0;
    for (let i = nValue; i < sequence.length; i++) {
      if (sequence[i] === sequence[i - nValue]) {
        totalMatches++;
      }
    }
    score.missed = totalMatches - score.correct;
    
    updateScoreDisplay();
    
    const resultsElement = document.createElement('div');
    resultsElement.className = 'mt-4 p-4 bg-white rounded-lg shadow-sm text-center w-full';
    
    const totalPossible = totalMatches;
    const percentageScore = totalPossible > 0 ? Math.round((score.correct / totalPossible) * 100) : 0;
    
    resultsElement.innerHTML = `
      <p class="font-bold text-lg">Test Complete</p>
      <div class="mt-2 grid grid-cols-2 gap-4">
        <div>
          <p class="text-sm text-gray-600">Correct Matches</p>
          <p class="font-bold text-green-500">${score.correct} / ${totalMatches}</p>
        </div>
        <div>
          <p class="text-sm text-gray-600">Score</p>
          <p class="font-bold text-primary">${percentageScore}%</p>
        </div>
        <div>
          <p class="text-sm text-gray-600">Incorrect Responses</p>
          <p class="font-bold text-red-500">${score.incorrect}</p>
        </div>
        <div>
          <p class="text-sm text-gray-600">Missed Matches</p>
          <p class="font-bold text-orange-500">${score.missed}</p>
        </div>
      </div>
    `;
    container.appendChild(resultsElement);
    
    startButton.textContent = 'Try Again';
    startButton.style.display = 'block';
    matchButton.style.display = 'none';
    
    const record = {
      game: 'nback',
      results: {
        correct: score.correct,
        incorrect: score.incorrect,
        missed: score.missed,
        total: totalMatches,
        percentageScore: percentageScore
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
        correct: score.correct,
        incorrect: score.incorrect,
        missed: score.missed,
        total: totalMatches,
        percentageScore
      });
    }
  }
  
  function createControls() {
    instructions = document.createElement('div');
    instructions.className = 'mt-4 text-center text-gray-700 w-full';
    instructions.innerHTML = `
      <p class="font-medium">Press the button when you see a shape that matches the one shown ${nValue} step${nValue !== 1 ? 's' : ''} ago</p>
      <p class="text-sm mt-1">Each shape will appear for ${stimulusDuration/1000} seconds</p>
    `;
    container.appendChild(instructions);
    
    scoreDisplay = document.createElement('div');
    scoreDisplay.className = 'mt-4 p-3 bg-white rounded-lg shadow-sm w-full';
    updateScoreDisplay();
    container.appendChild(scoreDisplay);
    
    startButton = document.createElement('button');
    startButton.className = 'mt-4 bg-primary text-white px-6 py-2 rounded-button font-semibold hover:bg-primary/90 w-full';
    startButton.textContent = 'Start Test';
    startButton.addEventListener('click', startGame);
    container.appendChild(startButton);
    
    matchButton = document.createElement('button');
    matchButton.className = 'mt-4 bg-primary text-white px-6 py-3 rounded-button font-semibold hover:bg-primary/90 w-full text-lg';
    matchButton.textContent = 'Match!';
    matchButton.style.display = 'none';
    matchButton.addEventListener('click', handleMatchClick);
    container.appendChild(matchButton);
  }
  
  function startGame() {
    currentIndex = -1;
    score = {
      correct: 0,
      incorrect: 0,
      missed: 0,
      total: 0
    };
    gameStarted = true;
    gameCompleted = false;
    clearTimeout(timer);
    
    sequence = generateSequence(sequenceLength);
    
    startButton.style.display = 'none';
    matchButton.style.display = 'block';
    updateScoreDisplay();
    
    const resultsElement = container.querySelector('div:last-child');
    if (resultsElement !== matchButton && resultsElement !== startButton && 
        resultsElement !== scoreDisplay && resultsElement !== instructions) {
      resultsElement.remove();
    }
    
    clearCanvas();
    setTimeout(showNextShape, 1000);
  }
  
  function reset() {
    clearTimeout(timer);
    clearCanvas();
    
    startButton.textContent = 'Start Test';
    startButton.style.display = 'block';
    matchButton.style.display = 'none';
    
    gameStarted = false;
    gameCompleted = false;
    currentIndex = -1;
    score = {
      correct: 0,
      incorrect: 0,
      missed: 0,
      total: 0
    };
    updateScoreDisplay();
    
    const resultsElement = container.querySelector('div:last-child');
    if (resultsElement !== matchButton && resultsElement !== startButton && 
        resultsElement !== scoreDisplay && resultsElement !== instructions) {
      resultsElement.remove();
    }
  }
  
  function init(containerEl, options = {}) {
    const defaultOptions = {
      nValue: 1,
      sequenceLength: 20,
      stimulusDuration: 1500,
      interStimulusInterval: 500,
      onComplete: null
    };
    
    const gameOptions = { ...defaultOptions, ...options };
    
    container = containerEl;
    container.classList.add('flex', 'flex-col', 'items-center', 'p-4');
    completeCallback = gameOptions.onComplete;
    nValue = gameOptions.nValue;
    sequenceLength = gameOptions.sequenceLength;
    stimulusDuration = gameOptions.stimulusDuration;
    interStimulusInterval = gameOptions.interStimulusInterval;
    
    canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 300;
    canvas.className = 'border border-gray-300 rounded-lg bg-white';
    container.appendChild(canvas);
    
    ctx = canvas.getContext('2d');
    clearCanvas();
    
    createControls();
    
    return {
      reset,
      getScore: () => ({ ...score })
    };
  }
  
  return {
    init
  };
})();

export default NBackMemoryGame;