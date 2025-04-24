const ClockDrawingGame = (function() {
  let svg, hourHand, minuteHand, clockFace;
  let isDraggingHour = false;
  let isDraggingMinute = false;
  let clockCenterX, clockCenterY, clockRadius;
  let targetHourAngle, targetMinuteAngle;
  let currentHourAngle = 0;
  let currentMinuteAngle = 0;
  let container, completeCallback;
  let submitButton;
  let instructions;
  let targetTime;
  
  const HOUR_HAND_LENGTH_RATIO = 0.5;
  const MINUTE_HAND_LENGTH_RATIO = 0.8;
  const HOUR_HAND_WIDTH = 8;
  const MINUTE_HAND_WIDTH = 4;
  const TOLERANCE_DEGREES = 5;
  
  function calculateAngle(unit, isHour) {
    if (isHour) {
      return ((unit % 12) * 30) - 90;
    } else {
      return (unit * 6) - 90;
    }
  }
  
  function parseTime(timeStr) {
    const [hourStr, minuteStr] = timeStr.split(':');
    return {
      hour: parseInt(hourStr, 10),
      minute: parseInt(minuteStr, 10)
    };
  }
  
  function calculateScore() {
    const hourDiff = Math.abs(((currentHourAngle - targetHourAngle + 180) % 360) - 180);
    const minuteDiff = Math.abs(((currentMinuteAngle - targetMinuteAngle + 180) % 360) - 180);
    
    const hourAccuracy = Math.max(0, 100 - (hourDiff / 1.8));
    const minuteAccuracy = Math.max(0, 100 - (minuteDiff / 1.8));
    
    return Math.round((hourAccuracy * 0.6) + (minuteAccuracy * 0.4));
  }
  
  function createClockSVG(size) {
    if (container.querySelector('svg')) {
      container.querySelector('svg').remove();
    }
    
    clockRadius = size / 2;
    clockCenterX = clockRadius;
    clockCenterY = clockRadius;
    
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('class', 'clock-svg');
    container.appendChild(svg);
    
    clockFace = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    clockFace.setAttribute('cx', clockCenterX);
    clockFace.setAttribute('cy', clockCenterY);
    clockFace.setAttribute('r', clockRadius - 2);
    clockFace.setAttribute('fill', 'white');
    clockFace.setAttribute('stroke', '#57B5E7');
    clockFace.setAttribute('stroke-width', '2');
    svg.appendChild(clockFace);
    
    for (let i = 0; i < 12; i++) {
      const angle = (i * 30) * (Math.PI / 180);
      const markerLength = i % 3 === 0 ? 15 : 10;
      
      const x1 = clockCenterX + (clockRadius - markerLength) * Math.cos(angle);
      const y1 = clockCenterY + (clockRadius - markerLength) * Math.sin(angle);
      const x2 = clockCenterX + (clockRadius - 2) * Math.cos(angle);
      const y2 = clockCenterY + (clockRadius - 2) * Math.sin(angle);
      
      const marker = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      marker.setAttribute('x1', x1);
      marker.setAttribute('y1', y1);
      marker.setAttribute('x2', x2);
      marker.setAttribute('y2', y2);
      marker.setAttribute('stroke', '#333');
      marker.setAttribute('stroke-width', i % 3 === 0 ? '3' : '2');
      svg.appendChild(marker);
      
      if (i % 3 === 0) {
        const numX = clockCenterX + (clockRadius - 30) * Math.cos(angle);
        const numY = clockCenterY + (clockRadius - 30) * Math.sin(angle);
        
        const num = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        num.setAttribute('x', numX);
        num.setAttribute('y', numY);
        num.setAttribute('text-anchor', 'middle');
        num.setAttribute('dominant-baseline', 'middle');
        num.setAttribute('font-size', '18');
        num.setAttribute('font-weight', 'bold');
        num.setAttribute('fill', '#333');
        num.textContent = i === 0 ? '12' : (i / 3).toString();
        svg.appendChild(num);
      }
    }
    
    hourHand = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    hourHand.setAttribute('x1', clockCenterX);
    hourHand.setAttribute('y1', clockCenterY);
    hourHand.setAttribute('x2', clockCenterX);
    hourHand.setAttribute('y2', clockCenterY - (clockRadius * HOUR_HAND_LENGTH_RATIO));
    hourHand.setAttribute('stroke', '#333');
    hourHand.setAttribute('stroke-width', HOUR_HAND_WIDTH);
    hourHand.setAttribute('stroke-linecap', 'round');
    hourHand.classList.add('hour-hand');
    hourHand.style.cursor = 'pointer';
    svg.appendChild(hourHand);
    
    minuteHand = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    minuteHand.setAttribute('x1', clockCenterX);
    minuteHand.setAttribute('y1', clockCenterY);
    minuteHand.setAttribute('x2', clockCenterX);
    minuteHand.setAttribute('y2', clockCenterY - (clockRadius * MINUTE_HAND_LENGTH_RATIO));
    minuteHand.setAttribute('stroke', '#666');
    minuteHand.setAttribute('stroke-width', MINUTE_HAND_WIDTH);
    minuteHand.setAttribute('stroke-linecap', 'round');
    minuteHand.classList.add('minute-hand');
    minuteHand.style.cursor = 'pointer';
    svg.appendChild(minuteHand);
    
    const centerDot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    centerDot.setAttribute('cx', clockCenterX);
    centerDot.setAttribute('cy', clockCenterY);
    centerDot.setAttribute('r', 5);
    centerDot.setAttribute('fill', '#333');
    svg.appendChild(centerDot);
    
    setupDragHandlers();
  }
  
  function setupDragHandlers() {
    hourHand.addEventListener('mousedown', (e) => {
      e.preventDefault();
      isDraggingHour = true;
    });
    
    minuteHand.addEventListener('mousedown', (e) => {
      e.preventDefault();
      isDraggingMinute = true;
    });
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', () => {
      isDraggingHour = false;
      isDraggingMinute = false;
    });
    
    hourHand.addEventListener('touchstart', (e) => {
      e.preventDefault();
      isDraggingHour = true;
    });
    
    minuteHand.addEventListener('touchstart', (e) => {
      e.preventDefault();
      isDraggingMinute = true;
    });
    
    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', () => {
      isDraggingHour = false;
      isDraggingMinute = false;
    });
  }
  
  function handleMouseMove(e) {
    if (!isDraggingHour && !isDraggingMinute) return;
    
    const rect = svg.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    updateHandPosition(mouseX, mouseY);
  }
  
  function handleTouchMove(e) {
    if (!isDraggingHour && !isDraggingMinute) return;
    
    const rect = svg.getBoundingClientRect();
    const touch = e.touches[0];
    const touchX = touch.clientX - rect.left;
    const touchY = touch.clientY - rect.top;
    
    updateHandPosition(touchX, touchY);
    e.preventDefault();
  }
  
  function updateHandPosition(pointerX, pointerY) {
    const deltaX = pointerX - clockCenterX;
    const deltaY = pointerY - clockCenterY;
    let angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI) + 90;
    
    if (angle < 0) angle += 360;
    
    if (isDraggingHour) {
      currentHourAngle = angle;
      rotateHand(hourHand, angle, HOUR_HAND_LENGTH_RATIO);
    } else if (isDraggingMinute) {
      currentMinuteAngle = angle;
      rotateHand(minuteHand, angle, MINUTE_HAND_LENGTH_RATIO);
    }
  }
  
  function rotateHand(hand, angle, lengthRatio) {
    const radians = (angle - 90) * (Math.PI / 180);
    const handLength = clockRadius * lengthRatio;
    
    const endX = clockCenterX + handLength * Math.cos(radians);
    const endY = clockCenterY + handLength * Math.sin(radians);
    
    hand.setAttribute('x2', endX);
    hand.setAttribute('y2', endY);
  }
  
  function createControls() {
    instructions = document.createElement('div');
    instructions.className = 'mt-4 text-center text-gray-700';
    instructions.innerHTML = `
      <p class="font-medium">Please set the clock to show <span class="text-primary font-bold">10:10</span> (10 past 10)</p>
      <p class="text-sm mt-1">Drag the hour and minute hands to position them</p>
    `;
    container.appendChild(instructions);
    
    submitButton = document.createElement('button');
    submitButton.className = 'mt-4 bg-primary text-white px-6 py-2 rounded-button font-semibold hover:bg-primary/90 w-full';
    submitButton.textContent = 'Submit';
    submitButton.addEventListener('click', handleSubmit);
    container.appendChild(submitButton);
  }
  
  function handleSubmit() {
    const score = calculateScore();
    
    const resultElement = document.createElement('div');
    resultElement.className = 'mt-4 text-center';
    
    if (score >= 90) {
      resultElement.innerHTML = `
        <p class="text-green-600 font-bold">Excellent!</p>
        <p class="text-sm">Your clock setting was very accurate.</p>
      `;
    } else if (score >= 70) {
      resultElement.innerHTML = `
        <p class="text-blue-600 font-bold">Good job!</p>
        <p class="text-sm">Your clock setting was mostly accurate.</p>
      `;
    } else {
      resultElement.innerHTML = `
        <p class="text-orange-600 font-bold">Nice try!</p>
        <p class="text-sm">The clock setting could be more accurate.</p>
      `;
    }
    
    container.appendChild(resultElement);
    
    hourHand.style.pointerEvents = 'none';
    minuteHand.style.pointerEvents = 'none';
    submitButton.disabled = true;
    submitButton.classList.add('opacity-50');
    
    const record = {
      game: 'clock',
      results: { score: score },
      timestamp: new Date().toISOString()
    };
    
    let gameRecords = JSON.parse(localStorage.getItem('gameRecords')) || [];
    gameRecords.push(record);
    if (gameRecords.length > 50) {
      gameRecords = gameRecords.slice(-50);
    }
    localStorage.setItem('gameRecords', JSON.stringify(gameRecords));
    
    if (typeof completeCallback === 'function') {
      completeCallback(score);
    }
  }
  
  function init(containerEl, options = {}) {
    const defaultOptions = {
      targetTime: '10:10',
      clockSize: 300,
      onComplete: null
    };
    
    const gameOptions = { ...defaultOptions, ...options };
    
    container = containerEl;
    container.classList.add('flex', 'flex-col', 'items-center', 'p-4');
    completeCallback = gameOptions.onComplete;
    targetTime = gameOptions.targetTime;
    
    const { hour, minute } = parseTime(targetTime);
    targetHourAngle = calculateAngle(hour + (minute / 60), true);
    targetMinuteAngle = calculateAngle(minute, false);
    
    createClockSVG(gameOptions.clockSize);
    createControls();
    
    const timeText = targetTime === '10:55' ? '5 minutes to 11' : 
                    (targetTime === '10:10' ? '10 past 10' : targetTime);
    instructions.querySelector('p').innerHTML = `
      Please set the clock to show <span class="text-primary font-bold">${timeText}</span>
    `;
    
    return {
      reset: () => {
        rotateHand(hourHand, 0, HOUR_HAND_LENGTH_RATIO);
        rotateHand(minuteHand, 0, MINUTE_HAND_LENGTH_RATIO);
        currentHourAngle = 0;
        currentMinuteAngle = 0;
        
        const resultElement = container.querySelector('div:last-child');
        if (resultElement !== submitButton && resultElement !== instructions) {
          resultElement.remove();
        }
        
        hourHand.style.pointerEvents = 'auto';
        minuteHand.style.pointerEvents = 'auto';
        submitButton.disabled = false;
        submitButton.classList.remove('opacity-50');
      },
      getScore: calculateScore
    };
  }
  
  return {
    init
  };
})();

export default ClockDrawingGame;