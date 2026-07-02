import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";
import Stripe from "stripe";
import { createServer as createViteServer } from "vite";
import crypto from "crypto";

// Handle ESM globals
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy-loaded Stripe instance helper
let stripeClient: Stripe | null = null;

function getStripe(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY environment variable is not configured on the server.");
  }
  if (!stripeClient) {
    stripeClient = new Stripe(secretKey, {
      apiVersion: "2025-01-27.acacia" as any, // Using a stable API version
    });
  }
  return stripeClient;
}

import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";

const firebaseConfig = {
  projectId: "gen-lang-client-0198820455",
  appId: "1:446581031176:web:99934ad9fce3592ca2ecbd",
  apiKey: "AIzaSyCBcHLWdB7EnQSpkmxnDEbmcFs7ICQyeoA",
  authDomain: "gen-lang-client-0198820455.firebaseapp.com",
  storageBucket: "gen-lang-client-0198820455.firebasestorage.app",
  messagingSenderId: "446581031176"
};

const databaseId = "ai-studio-d5cae848-c1ed-4f2e-9f89-e9c69ed15c6c";

let dbInstance: any = null;

function getFirestoreDb() {
  if (!dbInstance) {
    try {
      const appInstance = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
      dbInstance = getFirestore(appInstance, databaseId);
    } catch (e) {
      console.error("Failed to initialize firebase inside server.ts:", e);
    }
  }
  return dbInstance;
}

async function getFreelancerProfile(freelancerId: string) {
  if (!freelancerId) return null;
  const db = getFirestoreDb();
  if (!db) return null;
  try {
    const docRef = doc(db, "freelancers", freelancerId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data();
    }
  } catch (e) {
    console.error("Error fetching freelancer profile in server.ts:", e);
  }
  return null;
}

// API Routes
// 1. Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", stripeConfigured: !!process.env.STRIPE_SECRET_KEY });
});

// 2. Fetch public Stripe config
app.get("/api/stripe/config", (req, res) => {
  res.json({
    publishableKey: process.env.VITE_STRIPE_PUBLISHABLE_KEY || null,
    isConfigured: !!process.env.STRIPE_SECRET_KEY,
  });
});

// 3. Create Checkout Session
app.post("/api/stripe/create-checkout-session", async (req, res) => {
  try {
    const { freelancerId, planName, priceAmount, currencyCode, isIndia } = req.body;

    if (!freelancerId) {
      return res.status(400).json({ error: "Missing required parameter: freelancerId" });
    }

    const stripe = getStripe();

    // Default to USD $2.99 or INR ₹99
    const amountInCents = isIndia ? 9900 : 299; // 99.00 INR or 2.99 USD
    const currentCurrency = isIndia ? "inr" : "usd";

    // Build the success and cancel URLs with the APP_URL
    const baseUrl = process.env.APP_URL || `http://localhost:${PORT}`;
    const successUrl = `${baseUrl}?stripe_status=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl}?stripe_status=cancel`;

    // Create a Checkout Session
    // We use a custom price ID if provided, otherwise fallback to dynamic price_data
    const priceId = process.env.STRIPE_PRICE_ID;
    let resolvedPriceId = priceId;

    if (priceId && priceId.startsWith("prod_")) {
      console.log(`Resolving Stripe Product ID ${priceId} to an active price...`);
      try {
        const prices = await stripe.prices.list({
          product: priceId,
          active: true,
          limit: 1,
        });

        if (prices.data.length > 0) {
          resolvedPriceId = prices.data[0].id;
          console.log(`Found existing price ${resolvedPriceId} for product ${priceId}`);
        } else {
          console.log(`No active price found for product ${priceId}. Creating one dynamically...`);
          const newPrice = await stripe.prices.create({
            product: priceId,
            unit_amount: amountInCents,
            currency: currentCurrency,
            recurring: {
              interval: "month",
            },
          });
          resolvedPriceId = newPrice.id;
          console.log(`Created new price ${resolvedPriceId} for product ${priceId}`);
        }
      } catch (priceErr) {
        console.warn(`Failed to retrieve or create a price for product ID ${priceId}:`, priceErr);
        // Fall back to original priceId anyway so Stripe can throw its native descriptive error if needed
      }
    }

    const lineItems = resolvedPriceId
      ? [{ price: resolvedPriceId, quantity: 1 }]
      : [
          {
            price_data: {
              currency: currentCurrency,
              product_data: {
                name: `Freelancer CRM Pro Plan`,
                description: `Monthly subscription for full workspace access (unlimited clients, projects, secure document vault, and advanced analytics).`,
              },
              unit_amount: amountInCents,
              recurring: {
                interval: "month",
              },
            },
            quantity: 1,
          },
        ];

    const session = await stripe.checkout.sessions.create({
      payment_method_types: isIndia ? ["card"] : ["card"], // Expandable if needed
      line_items: lineItems as any,
      mode: "subscription",
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        freelancerId,
        planName,
      },
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (err: any) {
    console.error("Stripe Create Session Error:", err);
    res.status(500).json({
      error: err.message || "Failed to create Stripe Checkout session. Please verify your Stripe API keys in settings.",
    });
  }
});

// 4. Verify Stripe Session
app.get("/api/stripe/verify-session", async (req, res) => {
  try {
    const { session_id } = req.query;
    if (!session_id || typeof session_id !== "string") {
      return res.status(400).json({ error: "Missing session_id parameter" });
    }

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (session.payment_status === "paid" || session.status === "complete") {
      res.json({
        success: true,
        paymentStatus: session.payment_status,
        freelancerId: session.metadata?.freelancerId || null,
        customerId: typeof session.customer === "string" ? session.customer : null,
        subscriptionId: typeof session.subscription === "string" ? session.subscription : null,
      });
    } else {
      res.json({
        success: false,
        paymentStatus: session.payment_status,
        message: "Payment is not completed yet.",
      });
    }
  } catch (err: any) {
    console.error("Stripe Verification Error:", err);
    res.status(500).json({ error: err.message || "Failed to verify Stripe Session." });
  }
});

// ==========================================
// Razorpay & PayPal Integrations
// ==========================================

// 1. Fetch public payment config (Keys are safe on backend, client IDs exposed securely)
app.get("/api/payment/config", async (req, res) => {
  const { freelancerId } = req.query;
  let customRazorpayKeyId = null;

  if (typeof freelancerId === "string" && freelancerId) {
    const profile = await getFreelancerProfile(freelancerId);
    if (profile && profile.razorpayKeyId) {
      customRazorpayKeyId = profile.razorpayKeyId;
    }
  }

  const finalRazorpayKeyId = customRazorpayKeyId || process.env.VITE_RAZORPAY_KEY_ID || "rzp_test_simulated123";
  const hasRazorpayConfigured = !!customRazorpayKeyId || !!process.env.VITE_RAZORPAY_KEY_ID;

  res.json({
    razorpayKeyId: finalRazorpayKeyId,
    paypalClientId: process.env.VITE_PAYPAL_CLIENT_ID || "sb", // 'sb' is the standard sandbox client-id for PayPal
    razorpayConfigured: hasRazorpayConfigured,
    paypalConfigured: !!process.env.VITE_PAYPAL_CLIENT_ID,
  });
});

// 2. Razorpay Order Creation
app.post("/api/razorpay/create-order", async (req, res) => {
  try {
    const { freelancerId, planName, amount } = req.body;
    if (!freelancerId || !planName || !amount) {
      return res.status(400).json({ error: "Missing required parameters: freelancerId, planName, amount" });
    }

    // Amount should be in paise for Indian currency
    const amountInPaise = Math.round(amount * 100);

    let keyId = process.env.VITE_RAZORPAY_KEY_ID;
    let keySecret = process.env.RAZORPAY_KEY_SECRET;

    const profile = await getFreelancerProfile(freelancerId);
    if (profile && profile.razorpayKeyId && profile.razorpayKeySecret) {
      keyId = profile.razorpayKeyId;
      keySecret = profile.razorpayKeySecret;
      console.log(`[Razorpay] Creating real order with custom keys for freelancer: ${freelancerId}`);
    }

    if (keyId && keySecret) {
      console.log(`[Razorpay] Creating real order for ${freelancerId} (${planName}, Amount: ₹${amount})`);
      const basicAuth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
      
      const response = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
          "Authorization": `Basic ${basicAuth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: amountInPaise,
          currency: "INR",
          receipt: `rcpt_f_${freelancerId.substring(0, 8)}_${Date.now()}`,
          notes: {
            freelancerId,
            planName,
          }
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Razorpay API responded with status ${response.status}: ${errText}`);
      }

      const data = await response.json();
      return res.json({
        success: true,
        orderId: data.id,
        amount: data.amount,
        currency: data.currency,
        isSimulated: false,
      });
    } else {
      console.log(`[Razorpay] Keys not configured. Creating high-fidelity simulated Razorpay order for ${freelancerId}...`);
      const mockOrderId = `order_rzp_sim_${Math.random().toString(36).substring(2, 12)}`;
      return res.json({
        success: true,
        orderId: mockOrderId,
        amount: amountInPaise,
        currency: "INR",
        isSimulated: true,
      });
    }
  } catch (err: any) {
    console.error("Razorpay Order Creation Error:", err);
    res.status(500).json({ error: err.message || "Failed to create Razorpay order" });
  }
});

// 3. Razorpay Signature Verification
app.post("/api/razorpay/verify-payment", async (req, res) => {
  try {
    const { freelancerId, planName, orderId, paymentId, signature } = req.body;
    if (!freelancerId || !planName || !orderId || !paymentId) {
      return res.status(400).json({ error: "Missing required fields for payment verification" });
    }

    let keyId = process.env.VITE_RAZORPAY_KEY_ID;
    let keySecret = process.env.RAZORPAY_KEY_SECRET;

    const profile = await getFreelancerProfile(freelancerId);
    if (profile && profile.razorpayKeyId && profile.razorpayKeySecret) {
      keyId = profile.razorpayKeyId;
      keySecret = profile.razorpayKeySecret;
      console.log(`[Razorpay] Verifying signature with custom keys for freelancer: ${freelancerId}`);
    }

    if (keyId && keySecret) {
      if (!signature) {
        return res.status(400).json({ error: "Missing signature for real verification" });
      }

      const generatedSignature = crypto
        .createHmac("sha256", keySecret)
        .update(`${orderId}|${paymentId}`)
        .digest("hex");

      if (generatedSignature !== signature) {
        console.warn(`[Razorpay] Verification FAILED for freelancer: ${freelancerId}. Signature mismatch.`);
        return res.status(400).json({ error: "Payment verification failed. Invalid signature." });
      }

      console.log(`[Razorpay] Payment VERIFIED successfully for freelancer: ${freelancerId}`);
      return res.json({
        success: true,
        message: "Razorpay subscription payment verified and authorized successfully.",
        gateway: "Razorpay",
        transactionId: paymentId,
      });
    } else {
      console.log(`[Razorpay] Simulator validation successful for order ${orderId}, payment ${paymentId}`);
      return res.json({
        success: true,
        message: "Simulated Razorpay subscription payment authorized successfully.",
        gateway: "Razorpay",
        transactionId: paymentId || `pay_rzp_sim_${Math.random().toString(36).substring(2, 10)}`,
        isSimulated: true,
      });
    }
  } catch (err: any) {
    console.error("Razorpay Payment Verification Error:", err);
    res.status(500).json({ error: err.message || "Failed to verify Razorpay payment" });
  }
});

// 4. PayPal Order Creation
app.post("/api/paypal/create-order", async (req, res) => {
  try {
    const { freelancerId, planName, amount } = req.body;
    if (!freelancerId || !planName || !amount) {
      return res.status(400).json({ error: "Missing required parameters: freelancerId, planName, amount" });
    }

    const clientId = process.env.VITE_PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    const apiUrl = process.env.PAYPAL_API_URL || "https://api-m.sandbox.paypal.com";

    if (clientId && clientSecret) {
      console.log(`[PayPal] Creating real checkout order for freelancer: ${freelancerId}, Plan: ${planName}, Amount: $${amount}`);
      
      // Obtain access token via OAuth
      const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
      const tokenRes = await fetch(`${apiUrl}/v1/oauth2/token`, {
        method: "POST",
        headers: {
          "Authorization": `Basic ${basicAuth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
      });

      if (!tokenRes.ok) {
        const errText = await tokenRes.text();
        throw new Error(`PayPal authentication failed: ${errText}`);
      }

      const tokenData = await tokenRes.json();
      const accessToken = tokenData.access_token;

      // Create PayPal order
      const orderRes = await fetch(`${apiUrl}/v2/checkout/orders`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          intent: "CAPTURE",
          purchase_units: [
            {
              amount: {
                currency_code: "USD",
                value: amount.toString(),
              },
              description: `Freelancer CRM - ${planName} Subscription`,
              custom_id: freelancerId,
            },
          ],
        }),
      });

      if (!orderRes.ok) {
        const errText = await orderRes.text();
        throw new Error(`PayPal Order Creation failed: ${errText}`);
      }

      const orderData = await orderRes.json();
      return res.json({
        success: true,
        orderId: orderData.id,
        status: orderData.status,
        isSimulated: false,
      });
    } else {
      console.log(`[PayPal] Credentials missing. Creating simulated PayPal order for ${freelancerId}...`);
      const mockOrderId = `order_pp_sim_${Math.random().toString(36).substring(2, 12)}`;
      return res.json({
        success: true,
        orderId: mockOrderId,
        status: "CREATED",
        isSimulated: true,
      });
    }
  } catch (err: any) {
    console.error("PayPal Order Creation Error:", err);
    res.status(500).json({ error: err.message || "Failed to create PayPal order" });
  }
});

// 5. PayPal Order Capture
app.post("/api/paypal/capture-order", async (req, res) => {
  try {
    const { freelancerId, planName, orderId } = req.body;
    if (!freelancerId || !planName || !orderId) {
      return res.status(400).json({ error: "Missing required fields for capture" });
    }

    const clientId = process.env.VITE_PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    const apiUrl = process.env.PAYPAL_API_URL || "https://api-m.sandbox.paypal.com";

    if (clientId && clientSecret) {
      console.log(`[PayPal] Capturing real order: ${orderId} for ${freelancerId}`);
      
      // Obtain access token
      const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
      const tokenRes = await fetch(`${apiUrl}/v1/oauth2/token`, {
        method: "POST",
        headers: {
          "Authorization": `Basic ${basicAuth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
      });

      if (!tokenRes.ok) {
        const errText = await tokenRes.text();
        throw new Error(`PayPal Auth failed during capture: ${errText}`);
      }

      const tokenData = await tokenRes.json();
      const accessToken = tokenData.access_token;

      // Capture PayPal payment
      const captureRes = await fetch(`${apiUrl}/v2/checkout/orders/${orderId}/capture`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!captureRes.ok) {
        const errText = await captureRes.text();
        throw new Error(`PayPal Capture Order API failed: ${errText}`);
      }

      const captureData = await captureRes.json();
      if (captureData.status === "COMPLETED") {
        const captureId = captureData.purchase_units?.[0]?.payments?.captures?.[0]?.id || orderId;
        console.log(`[PayPal] Order capture successful! Transaction ID: ${captureId}`);
        return res.json({
          success: true,
          gateway: "PayPal",
          transactionId: captureId,
          status: captureData.status,
        });
      } else {
        return res.status(400).json({
          error: `PayPal order capture status was not completed: ${captureData.status}`,
        });
      }
    } else {
      console.log(`[PayPal] Simulator capture successful for order ${orderId}`);
      const mockTxId = `pay_pp_sim_${Math.random().toString(36).substring(2, 10)}`;
      return res.json({
        success: true,
        gateway: "PayPal",
        transactionId: mockTxId,
        status: "COMPLETED",
        isSimulated: true,
      });
    }
  } catch (err: any) {
    console.error("PayPal Capture Error:", err);
    res.status(500).json({ error: err.message || "Failed to capture PayPal order" });
  }
});

// Vite server integrations
async function init() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

init();
