import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const port = process.env.PORT || 3333;

app.use(express.static("public"));

server.listen(port, () => {
  console.log("listening on:", port);
});

//grid size of our farm grid
const GRID_SIZE = 3;
// EXPERIENCE STATE server is the authority
let experienceState = {
  users: {},            // socket.id -> avatar data
  farm: createFarm(GRID_SIZE),   // each number in array represents is water per farm land
  gridSize: GRID_SIZE,
  serverTime: 0
};

let lastUpdate = Date.now(); // for managing time passing in server land

// track time the server / farm has been running / growing
setInterval(() => {
  const now = Date.now();
  const deltaSeconds = (now - lastUpdate) / 1000;
  lastUpdate = now;

  experienceState.serverTime += deltaSeconds;

  for (let i = 0; i < experienceState.farm.length; i++) {
    // while there is water remove it and "grow" the farm
    if(experienceState.farm[i].water > 0){
      experienceState.farm[i].growth += deltaSeconds;
      experienceState.farm[i].water = Math.max(0,experienceState.farm[i].water - (deltaSeconds*2));
    }

    // dry up / kill off the farm at a slower rate
    if(experienceState.farm[i].growth > 0){
      experienceState.farm[i].growth = Math.max(0,experienceState.farm[i].growth - (deltaSeconds*0.1));
    }
  }

  io.emit("farmUpdate", {
    farm: experienceState.farm,
    serverTime: experienceState.serverTime
  });

}, 1000);

function createFarm(GRID_SIZE) {
  let farm = [];

  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      let plot = {
        water: 0,
        growth: 0
      };
      console.log(plot);
      farm.push(plot); // start each plot with 0 water
    }
  }

  return farm;
}

io.on("connection", (socket) => {
  console.log("user connected:", socket.id);

  // Create user
  experienceState.users[socket.id] = {
    x: 0,
    y: 0,
    color: Math.floor(Math.random() * 155) + 100
  };

  // Send FULL state once (on join only)
  socket.emit("init", {
    id: socket.id,
    state: experienceState
  });

  // Tell others a new user joined
  socket.broadcast.emit("userJoined", {
    id: socket.id,
    user: experienceState.users[socket.id]
  });

  // ---- MOVEMENT UPDATES (small + frequent) ----
  socket.on("move", (data) => {
    const user = experienceState.users[socket.id];
    if (!user) return;

    user.x = data.x;
    user.y = data.y;

    // Send ONLY this user's update
    socket.broadcast.emit("userMoved", {
      id: socket.id,
      x: user.x,
      y: user.y
    });
  });

  socket.on("waterPlot", (plotIndex) => {
    if (experienceState.farm[plotIndex] === undefined) return;

    // add water
    experienceState.farm[plotIndex].water += 10;

    // send updated farm to everyone
    io.emit("farmUpdate", {
      farm: experienceState.farm,
      gridSize: GRID_SIZE,
      serverTime: experienceState.serverTime
    });
  });

  socket.on("disconnect", () => {
    delete experienceState.users[socket.id];

    io.emit("userLeft", socket.id);
    console.log("user disconnected:", socket.id);
  });

});