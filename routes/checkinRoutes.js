const express = require("express");

const router = express.Router();

const { autoCheckIn } = require("../controllers/checkinController");


router.put("/", autoCheckIn);


module.exports = router;