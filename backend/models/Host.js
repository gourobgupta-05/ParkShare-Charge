const mongoose = require("mongoose");

const hostSchema = new mongoose.Schema({

    hostName: {
        type: String,
        required: true
    },
    nidNumber: {
    type: String
    },
    nidVerified: {
        type: Boolean,
        default: false
    },

    propertyVerified: {
        type: Boolean,
        default: false
    },

    chargerCapacity: {
        type: String
    },

    verificationStatus: {
        type: String,
        default: "Pending"
    },

    latitude: {
        type: Number,
        required: true
    },

    longitude: {
        type: Number,
        required: true
    }

});

module.exports = mongoose.model("Host", hostSchema);