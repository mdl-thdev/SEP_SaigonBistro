// SEP_SaigonBistro/backend/src/app.js
// configure middleware, routes, app logic

require("dotenv").config();

const express = require("express");
const path = require("path");

const corsMiddleware = require("./middlewares/cors");
const apiRoutes = require("./routes");

const app = express();

// Middleware
app.use(corsMiddleware);
app.use(express.json());

app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) {
    console.log(`[API] ${req.method} ${req.path}`);
  }
  next();
});

app.get("/", (req, res) => {
  res.status(200).json({ message: "Saigon Bistro API is running" });
});

app.use("/api", apiRoutes);

module.exports = app;

