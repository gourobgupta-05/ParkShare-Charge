import { useEffect, useState } from "react";

import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";

import * as Location from "expo-location";

import {
  LOCATION_TASK_NAME
} from "../locationTask";

const BOOKING_ID =
    "6a810c4a39e770b7c2781a4d";

const BACKEND_URL =
    "http://192.168.0.104:1495";

export default function HomeScreen() {

    const [tracking, setTracking] =
        useState(false);

    const [distance, setDistance] =
        useState<string>("--");

    const [bookingStatus, setBookingStatus] =
        useState("ACCEPTED");

    const [message, setMessage] =
        useState(
            "Waiting for GPS..."
        );

    const startTracking = async () => {

        try {

            const foreground =
                await Location.requestForegroundPermissionsAsync();

            if (
                foreground.status !==
                Location.PermissionStatus.GRANTED
            ) {

                setMessage(
                    "Location permission denied"
                );

                return;
            }

            const background =
                await Location.requestBackgroundPermissionsAsync();

            if (
                background.status !==
                Location.PermissionStatus.GRANTED
            ) {

                setMessage(
                    "Background location permission denied"
                );

                return;
            }

            const running =
                await Location.hasStartedLocationUpdatesAsync(
                    LOCATION_TASK_NAME
                );

            if (!running) {

                await Location.startLocationUpdatesAsync(
                    LOCATION_TASK_NAME,
                    {
                        accuracy:
                            Location.Accuracy.High,

                        timeInterval: 5000,

                        distanceInterval: 5,

                        showsBackgroundLocationIndicator:
                            true,

                        foregroundService: {
                            notificationTitle:
                                "ParkShare",

                            notificationBody:
                                "Monitoring your location for automatic check-in."
                        }
                    }
                );
            }

            setTracking(true);

            setMessage(
                "Live GPS monitoring active"
            );

        } catch (error) {

            console.log(error);

            setMessage(
                "Could not start GPS"
            );
        }
    };

    const stopTracking = async () => {

        try {

            const running =
                await Location.hasStartedLocationUpdatesAsync(
                    LOCATION_TASK_NAME
                );

            if (running) {

                await Location.stopLocationUpdatesAsync(
                    LOCATION_TASK_NAME
                );
            }

            setTracking(false);

            setMessage(
                "GPS monitoring stopped"
            );

        } catch (error) {

            console.log(error);
        }
    };

    const checkCurrentLocation = async () => {

        try {

            const location =
                await Location.getCurrentPositionAsync({
                    accuracy:
                        Location.Accuracy.High
                });

            const latitude =
                location.coords.latitude;

            const longitude =
                location.coords.longitude;

            console.log(
                "CURRENT LOCATION:",
                latitude,
                longitude
            );

            const response =
                await fetch(
                    `${BACKEND_URL}/api/bookings/${BOOKING_ID}/auto-checkin`,
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                      body: JSON.stringify({
                          driverLatitude: latitude,
                          driverLongitude: longitude,
                          accuracy: location.coords.accuracy
                      })
                        
                    }
                );

            const result =
                await response.json();

            console.log(
                "CHECK-IN RESULT:",
                result
            );

            if (
                result.distance !== undefined
            ) {

                setDistance(
                    `${result.distance}`
                );
            }

            if (
                result.status === "ACTIVE"
            ) {

                setBookingStatus(
                    "ACTIVE"
                );

                setMessage(
                    "✅ Automatically checked in!"
                );

            } else {

                setMessage(
                    result.message ||
                    "Outside check-in radius"
                );
            }

        } catch (error) {

            console.log(
                "CHECK-IN ERROR:",
                error
            );

            setMessage(
                "Unable to contact server"
            );
        }
    };

    useEffect(() => {

        startTracking();

        return () => {
            // Keep background task running.
        };

    }, []);

    return (

        <View style={styles.container}>

            <Text style={styles.title}>
                ParkShare
            </Text>

            <Text style={styles.subtitle}>
                Automated Proximity Check-In
            </Text>

            <View style={styles.card}>

                <Text style={styles.sectionTitle}>
                    Current Booking
                </Text>

                <Text style={styles.booking}>
                    Booking ID
                </Text>

                <Text style={styles.bookingId}>
                    {BOOKING_ID}
                </Text>

                <View style={styles.divider} />

                <Text style={styles.label}>
                    Booking Status
                </Text>

                <Text
                    style={[
                        styles.status,
                        bookingStatus ===
                            "ACTIVE"
                            ? styles.active
                            : styles.accepted
                    ]}
                >
                    {bookingStatus}
                </Text>

                <View style={styles.divider} />

                <Text style={styles.label}>
                    Distance from parking location
                </Text>

                <Text style={styles.distance}>
                    {distance}{" "}
                    {distance !== "--"
                        ? "meters"
                        : ""}
                </Text>

                <Text style={styles.radius}>
                    Automatic check-in radius:
                    15 meters
                </Text>

                <Text style={styles.message}>
                    {message}
                </Text>

            </View>

            <TouchableOpacity
                style={styles.button}
                onPress={
                    checkCurrentLocation
                }
            >

                <Text style={styles.buttonText}>
                    Check Current Location
                </Text>

            </TouchableOpacity>

            <TouchableOpacity
                style={styles.secondaryButton}
                onPress={
                    tracking
                        ? stopTracking
                        : startTracking
                }
            >

                <Text
                    style={
                        styles.secondaryText
                    }
                >
                    {tracking
                        ? "Stop GPS Monitoring"
                        : "Start GPS Monitoring"}
                </Text>

            </TouchableOpacity>

        </View>
    );
}

const styles = StyleSheet.create({

    container: {
        flex: 1,
        backgroundColor: "#F4F7FB",
        padding: 24,
        justifyContent: "center"
    },

    title: {
        fontSize: 36,
        fontWeight: "bold",
        textAlign: "center",
        color: "#208AEF"
    },

    subtitle: {
        fontSize: 17,
        textAlign: "center",
        marginTop: 5,
        marginBottom: 25,
        color: "#555"
    },

    card: {
        backgroundColor: "white",
        borderRadius: 20,
        padding: 22,
        elevation: 5
    },

    sectionTitle: {
        fontSize: 21,
        fontWeight: "bold",
        marginBottom: 18
    },

    booking: {
        fontSize: 13,
        color: "#777"
    },

    bookingId: {
        fontSize: 13,
        marginTop: 5
    },

    divider: {
        height: 1,
        backgroundColor: "#EEEEEE",
        marginVertical: 18
    },

    label: {
        fontSize: 14,
        color: "#777"
    },

    status: {
        fontSize: 25,
        fontWeight: "bold",
        marginTop: 5
    },

    accepted: {
        color: "#F39C12"
    },

    active: {
        color: "#20A05A"
    },

    distance: {
        fontSize: 30,
        fontWeight: "bold",
        marginTop: 5
    },

    radius: {
        marginTop: 5,
        color: "#777"
    },

    message: {
        marginTop: 20,
        fontSize: 16,
        fontWeight: "600"
    },

    button: {
        backgroundColor: "#208AEF",
        padding: 17,
        borderRadius: 14,
        marginTop: 20
    },

    buttonText: {
        color: "white",
        textAlign: "center",
        fontSize: 16,
        fontWeight: "bold"
    },

    secondaryButton: {
        padding: 15,
        marginTop: 10
    },

    secondaryText: {
        textAlign: "center",
        color: "#208AEF",
        fontWeight: "bold"
    }

});