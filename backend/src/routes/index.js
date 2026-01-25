// SEP_SaigonBistro/backend/src/routes/index.js
// routes/: URL paths -> controller functions (e.g., /users, /orders)

const express = require("express");

const authRoutes = require("../modules/auth/auth.routes");
const profileRoutes = require("../modules/profiles/profiles.routes");
const menuRoutes = require("../modules/menu/menu.routes");
const orderRoutes = require("../modules/orders/orders.routes");
const ticketRoutes = require("../modules/tickets/tickets.routes");

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/profiles", profileRoutes);
router.use("/menu", menuRoutes);
router.use("/orders", orderRoutes);
router.use("/tickets", ticketRoutes);

module.exports = router;
