import { WebSocketServer } from "ws";
import express from "express";
import http from "http";
import fs from "fs";
import cors from "cors";
import bodyParser from "body-parser";
import jsonfile from "jsonfile";

const ID = process.env.ID || 1;

const DATABASE_PATH =
  process.env.NODE_ENV === "development"
    ? "./database/"
    : `/var/www/socket-server-${process.env.ID}/database/`;
const PORT = process.env.PORT || 8080;

const whitelist = ["http://67.219.103.204", "http://localhost:3000"];
const corsOptionsDelegate = (req, callback) => {
  let corsOptions = {
    origin: false,
    optionsSuccessStatus: 200,
  };

  if (whitelist.indexOf(req.header("Origin")) !== -1) {
    corsOptions.origin = true; // reflect (enable) the requested origin in the CORS response
  }

  callback(null, corsOptions); // callback expects two parameters: error and options
};

let getJsonData = (path) => {
  let data = fs.readFileSync(path);
  return data.length ? JSON.parse(data) : [];
};

// Create an Express app
const app = express();

// Create an HTTP server that will listen on port 8080
const server = http.createServer(app);

// Create a WebSocket server attached to the HTTP server
const wss = new WebSocketServer({ server });

// Start the HTTP server
server.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});

// App config
app.use(function (req, res, next) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  next();
});
app.use(bodyParser.json({ limit: "512mb" }));

// Database
app.get("/database", cors(corsOptionsDelegate), (req, res) => {
  let data = {};

  ["session", "options", "themes", "bank"].map((key) => {
    data[key] = getJsonData(`${DATABASE_PATH}${key}.json`);
  });

  res.send(data);
});

// Archive
app.get("/archive", cors(corsOptionsDelegate), (req, res) => {
  let data = getJsonData(`${DATABASE_PATH}published.json`);
  res.send(data);
});

// Update database
app.post("/update", cors(corsOptionsDelegate), (req, res) => {
  let { key, data, type, property } = req.body;
  let file = `${DATABASE_PATH}${key}.json`;

  // Merge with existing database
  jsonfile.readFile(file).then((obj) => {
    if (data) {
      // Options
      if (key === "options") {
        if (!obj[property]) {
          obj[property] = [];
          obj[property].push(data);
        } else {
          obj[property] = [data, ...obj[property]];
        }
        // Bank
      } else if (key === "bank") {
        if (!obj[property]) {
          obj[property] = [];
          obj[property].push(data);
        } else {
          if (type === "remove") {
            obj[property] = obj[property].filter((item) => item.id !== data.id);
          } else {
            obj[property] = [data, ...obj[property]];
          }
        }
        // Everything else
      } else {
        if (type === "remove") {
          obj = obj.filter((item) => item.id !== data.id);
        } else {
          let itemExists = obj.find((item) => item?.id === data?.id);
          if (itemExists && data?.id) {
            obj = obj.map((item) => (item?.id === data?.id ? data : item));
          } else {
            obj = [data, ...obj];
          }
        }
      }
    }
    // Update with merged data
    jsonfile.writeFile(file, obj, { spaces: 2 }, function (err) {
      if (err) {
        console.error(err);
      }
      res.send({ success: true });
    });
  });
});

// Handle errors
wss.on("error", (error) => {
  console.error("WebSocket server error:", error);
});

// Create a Set to store all connected WebSocket instances
const clients = new Set();

wss.on("connection", function connection(ws) {
  // Handle WebSocket connection errors
  ws.on("error", console.error);

  // Log a new connection to the WebSocket server
  console.log("New connection", ws._socket.remoteAddress);

  // Add the new WebSocket instance to the clients Set
  clients.add(ws);

  ws.on("message", function message(data) {
    try {
      // Parse incoming data to JSON
      const jsonData = JSON.parse(data);

      // Add to database
      let db = getJsonData(`${DATABASE_PATH}published.json`);
      db.push(jsonData);
      jsonfile.writeFile(
        `${DATABASE_PATH}published.json`,
        db,
        { spaces: 2 },
        function (err) {
          if (err) console.error(err);
        }
      );

      // You can also send JSON data back to the individual client if needed
      ws.send(JSON.stringify({ success: true }));

      // Broadcast the message to all connected clients
      broadcast(JSON.stringify(jsonData), ws);
    } catch (error) {
      console.error("Error parsing JSON:", error);
    }
  });

  // Handle WebSocket connection closure
  ws.on("close", function () {
    // Remove the WebSocket instance from the clients Set
    clients.delete(ws);
  });
});

// Function to broadcast a message to all connected clients
let broadcast = (message, sender) => {
  clients.forEach((client) => {
    if (client !== sender) {
      client.send(message);
    }
  });
};
