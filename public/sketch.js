const socket = io();

let me;

// Mirror of experience state on client side
let experienceState = {
  users: {},
  farm: [],
  gridSize: 0,
  serverTime: 0
};

let dustColor;
let growthColor;
let waterColor;

// throttle mouse updates
let lastSent = 0;
const SEND_RATE = 30; // ms (~33 fps)

function setup() {
  createCanvas(windowWidth,windowHeight);
  noStroke();
  textAlign(CENTER);

  dustColor = color(218, 165, 32);
  growthColor = color(50, 200, 32);
  waterColor = color(72, 61, 255);
}

function draw() {
  background(200);

  drawFarm();

  // draw all users
  for (let id in experienceState.users) {
    const u = experienceState.users[id];

    if (id === me) {
      fill(u.color,0, 0);
      circle(mouseX, mouseY, 30);
    } else {
      fill(u.color, 0, 0);
      circle(u.x, u.y, 15);
    }
  }
}

function drawFarm() {
  if (experienceState.farm.length == 0) {
    return;
  }

  let farm = experienceState.farm;
  let gridSize = experienceState.gridSize;

  let cellW = width / gridSize;
  let cellH = height / gridSize;

  for (let i = 0; i < farm.length; i++) {
    let plot = farm[i];

    // derive x/y from index
    let col = i % gridSize;
    let row = floor(i / gridSize);

    let x = col * cellW;
    let y = row * cellH;

    // growth visualization
    let growth = map(plot.growth, 0, 200, 0, 1, true);
    let landColor = lerpColor(dustColor,growthColor, growth);

    let water = map(plot.water, 0, 200, 0, 1,true);
    let wateredLand = lerpColor(landColor,waterColor, water);

    fill(wateredLand);
    stroke(0);
    rect(x, y, cellW, cellH);

    // debug text
    noStroke();
    fill(0);
    text("water:  " + floor(plot.water), x + cellW * 0.5, y + cellH * 0.4);
    text("growth: " + floor(plot.growth), x + cellW * 0.5, y + cellH * 0.6);
  }
}


// SEND MOVEMENT (throttled, i.e. send less often)
function mouseMoved() {
  const now = millis();
  if (now - lastSent < SEND_RATE){
    return;
  } 

  lastSent = now;

  socket.emit("move", {
    x: mouseX,
    y: mouseY
  });
}

function mousePressed() {
  if (experienceState.farm.length == 0) {
    return;
  }

  const plotIndex = getPlotIndex(mouseX, mouseY);

  if(experienceState.farm[plotIndex].water < 200){
    socket.emit("waterPlot", plotIndex);
  }else{
    //maybe have some sort ux that means too much water
  }
}

function getPlotIndex(mx, my) {
  const col = floor(mx / (width / experienceState.gridSize));
  const row = floor(my / (height / experienceState.gridSize));

  return row * experienceState.gridSize + col;
}

// SOCKET EVENTS 

// initial full state
socket.on("init", (data) => {
  me = data.id;
  experienceState = data.state;
  console.log(experienceState);
});

// someone joined
socket.on("userJoined", ({ id, user }) => {
  experienceState.users[id] = user;
});

// someone left
socket.on("userLeft", (id) => {
  delete experienceState.users[id];
});

// someone moved
socket.on("userMoved", ({ id, x, y }) => {
  if (experienceState.users[id]) {
    experienceState.users[id].x = x;
    experienceState.users[id].y = y;
  }
});

// update to farm grid
socket.on("farmUpdate", (data) => {
  // console.log(data);
  experienceState.farm = data.farm;
  experienceState.serverTime = data.serverTime;
});

function windowResized(){
  resizeCanvas(windowWidth,windowHeight);
}