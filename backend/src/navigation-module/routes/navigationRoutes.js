/**
 * Navigation route — Module 1, Maidul Islam.
 * Mount in the shared app with:
 *   const navigationRoutes = require("./routes/navigationRoutes");
 *   app.use("/api/navigation", navigationRoutes);
 *
 * Resulting endpoint: GET /api/navigation/route
 */

const express = require("express");
const router = express.Router();
const navigationController = require("../controllers/navigationController");

router.get("/route", navigationController.getRoute);

module.exports = router;
