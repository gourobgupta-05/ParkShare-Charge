const express = require("express");
const router = express.Router();

const {
    createBooking,
    getBookings,
    getBookingById,
    autoCheckIn
} = require("../controllers/bookingController");

router.post("/", createBooking);
router.post("/:id/auto-checkin", autoCheckIn);

router.get("/", getBookings);

router.get("/:id", getBookingById);





module.exports = router;