const dns = require("dns");

dns.setServers([
    "8.8.8.8",
    "1.1.1.1"
]);

const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");

const connectDB = require("./config/db");

const hostRoutes = require("./routes/hostRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const checkinRoutes = require("./routes/checkinRoutes");

dotenv.config();

connectDB();

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/hosts", hostRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/checkin", checkinRoutes);

app.get("/", (req, res) => {
    res.send("ParkShare Backend Running...");
});

const PORT = process.env.PORT || 1495;

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on Port ${PORT}`);
});