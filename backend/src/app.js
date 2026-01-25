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

app.use("/api", apiRoutes);

module.exports = app;

