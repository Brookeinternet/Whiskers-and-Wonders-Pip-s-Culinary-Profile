// This is a conceptual backend file for demonstration purposes only.
// It cannot be run directly within this collaborative environment.
// To run a real backend, you would need to deploy it on a server environment.

// Required installations (on your server environment):
// npm install express stripe firebase-admin dotenv

const express = require('express');
const stripe = require('stripe');
const admin = require('firebase-admin');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

// --- Configuration (REPLACE WITH YOUR ACTUAL SECURE CONFIGURATION) ---
// For a real application, these should be loaded from environment variables
// or a secure configuration management system, NOT hardcoded.
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const FIREBASE_SERVICE_ACCOUNT_PATH = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
const FIREBASE_APP_ID = process.env.FIREBASE_APP_ID;

// Initialize Express app
const app = express();

// Initialize Firebase Admin SDK
try {
    const serviceAccount = require(FIREBASE_SERVICE_ACCOUNT_PATH);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    const db = admin.firestore();
    console.log("Firebase Admin SDK initialized successfully.");
} catch (e) {
    console.error(`Error initializing Firebase Admin SDK: ${e}`);
    db = null; // Set db to null if initialization fails
}

// Stripe webhook endpoint
app.post('/stripe-webhook', express.raw({type: 'application/json'}), (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        // Verify webhook signature for security
        event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error(`Webhook Error: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        console.log(`Checkout session completed: ${session.id}`);

        // Extract user ID from metadata (assuming you pass it during checkout session creation)
        const userId = session.metadata.userId;

        if (userId && db) {
            const userProfileRef = db.collection(`artifacts/${FIREBASE_APP_ID}/users/${userId}/profile`).doc('membership');
            userProfileRef.set({
                status: 'premium',
                activatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true })
            .then(() => {
                console.log(`User ${userId} membership updated to premium in Firestore.`);
            })
            .catch((error) => {
                console.error(`Error updating Firestore for user ${userId}: ${error}`);
            });
        } else if (!db) {
            console.error("Firestore client is not initialized. Cannot update user membership.");
        } else {
            console.log(`User ID not found in Stripe session metadata for session ${session.id}.`);
        }
    } else {
        // Log other event types for debugging purposes
        console.log(`Unhandled event type ${event.type}`);
    }

    // Return a 200 response to acknowledge receipt of the event
    res.status(200).send({ received: true });
});

// Start the server
const PORT = process.env.PORT || 4242;
app.listen(PORT, () => console.log(`Node.js Express server listening on port ${PORT}`));
