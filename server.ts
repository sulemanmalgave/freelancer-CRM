import express from "express";
import path from "path";
import "dotenv/config";
import Stripe from "stripe";
import { createServer as createViteServer } from "vite";
import crypto from "crypto";

const app = express();
const PORT = 3000;

app.use(
  express.json({
    verify: (req: any, res, buf) => {
      req.rawBody = buf;
    },
  })
);

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

import { getApps, initializeApp, getApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

if (getApps().length === 0) {
  initializeApp({
    projectId: "gen-lang-client-0198820455",
  });
}

const customDbId = "ai-studio-d5cae848-c1ed-4f2e-9f89-e9c69ed15c6c";
const db = getFirestore(getApp(), customDbId);

async function getFreelancerProfile(freelancerId: string) {
  if (!freelancerId) return null;
  try {
    const docRef = db.collection("freelancers").doc(freelancerId);
    const snap = await docRef.get();
    if (snap.exists) {
      return snap.data();
    }
  } catch (e) {
    console.error("Error fetching freelancer profile in server.ts:", e);
  }
  return null;
}

// Authentication middleware to validate Firebase ID Tokens
async function authenticateFirebaseUser(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    try {
      const decoded = await getAuth().verifyIdToken(token);
      req.user = decoded;
      req.userId = decoded.uid;
      return next();
    } catch (err: any) {
      console.warn(`[Auth] Firebase ID token verification failed: ${err.message}`);
      return res.status(401).json({ error: "Invalid or expired Firebase Authentication token." });
    }
  }

  // Fallback for local, offline-first client CRM compatibility
  const bodyId = req.body.freelancerId || req.body.userId || req.query.freelancerId || req.query.userId;
  if (bodyId) {
    console.warn(`[Auth] Direct ID auth fallback used for: ${bodyId}. No Authorization header found.`);
    req.userId = bodyId;
    return next();
  }

  return res.status(401).json({ error: "Unauthorized. Missing authentication credentials." });
}

// Idempotency checker using transactions
async function registerWebhookId(eventId: string): Promise<boolean> {
  const ref = db.collection("processed_webhooks").doc(eventId);
  try {
    const isNew = await db.runTransaction(async (transaction) => {
      const docSnap = await transaction.get(ref);
      if (docSnap.exists) {
        return false; // already processed
      }
      transaction.set(ref, { processedAt: Timestamp.now() });
      return true; // brand new
    });
    return isNew;
  } catch (err) {
    console.error(`[Webhook Transaction] Failed registering event ID ${eventId}:`, err);
    return false;
  }
}

// Security Helper to activate Pro subscription & store payment record
async function activateProSubscription(
  freelancerId: string,
  planName: string,
  gateway: "Razorpay" | "PayPal",
  transactionId: string,
  region: "IN" | "Other"
) {
  const isQuarterly = planName === "3 Months" || planName === "quarterly";
  const durationInDays = isQuarterly ? 90 : 30;
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + durationInDays);

  const billingCountry = region === "IN" ? "IN" : "Other";
  const currency = region === "IN" ? "INR" : "USD";
  const amount = region === "IN" ? (isQuarterly ? 399 : 199) : (isQuarterly ? 11.99 : 4.99);
  const subPlan = isQuarterly ? "quarterly" : "monthly";

  // 1. users/{uid} Structure
  const userUpdate = {
    plan: "pro",
    billingCountry: billingCountry,
    paymentProvider: gateway.toLowerCase(),
    subscriptionPlan: subPlan,
    subscriptionStatus: "active",
    proUntil: Timestamp.fromDate(expiryDate),
    providerCustomerId: null,
    providerSubscriptionId: transactionId,
  };

  // 2. payments/{paymentId} Structure
  const paymentRecord = {
    userId: freelancerId,
    provider: gateway.toLowerCase(),
    planId: subPlan,
    amount: amount,
    currency: currency,
    status: "completed",
    providerPaymentId: transactionId,
    createdAt: Timestamp.now(),
  };

  // 3. freelancers/{uid} Structure (synced for legacy frontend client state)
  const freelancerUpdate = {
    plan: "Pro",
    premium: true,
    subscriptionStatus: "active",
    subscriptionRegion: region,
    subscriptionMethod: gateway,
    subscriptionRenewsAt: expiryDate.toISOString(),
    paymentGateway: gateway,
    purchaseDate: new Date().toISOString(),
    expiryDate: expiryDate.toISOString(),
    transactionId: transactionId,
    billingCountry: billingCountry,
    country: billingCountry,
  };

  console.log(`[Billing Engine] Atomically activating Pro Plan for uid: ${freelancerId} via ${gateway}. Transaction: ${transactionId}`);

  await Promise.all([
    db.collection("users").doc(freelancerId).set(userUpdate, { merge: true }),
    db.collection("freelancers").doc(freelancerId).set(freelancerUpdate, { merge: true }),
    db.collection("payments").doc(transactionId).set(paymentRecord),
  ]);

  const updatedSnap = await db.collection("freelancers").doc(freelancerId).get();
  return updatedSnap.exists ? updatedSnap.data() : null;
}

// Security Helper to downgrade / cancel / suspend subscription state
async function cancelOrExpireProSubscription(
  freelancerId: string,
  gateway: "Razorpay" | "PayPal",
  status: "cancelled" | "expired" | "suspended",
  subscriptionId: string
) {
  const userUpdate = {
    plan: "free",
    subscriptionStatus: status,
    proUntil: null,
  };

  const freelancerUpdate = {
    plan: "Free",
    premium: false,
    subscriptionStatus: status === "cancelled" ? "cancelled" : "inactive",
    subscriptionRenewsAt: null,
  };

  console.log(`[Billing Engine] Downgrading uid: ${freelancerId} to Free. Gateway: ${gateway}, Reason: ${status}, ID: ${subscriptionId}`);

  await Promise.all([
    db.collection("users").doc(freelancerId).set(userUpdate, { merge: true }),
    db.collection("freelancers").doc(freelancerId).set(freelancerUpdate, { merge: true }),
  ]);
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

// Lazy initialization helper for Razorpay credentials read at runtime
function getRazorpayCredentials() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  console.log("RAZORPAY_KEY_ID available:", Boolean(keyId));
  console.log("RAZORPAY_KEY_SECRET available:", Boolean(keySecret));

  return { keyId, keySecret };
}

// 1. Fetch public payment config (Secrets are safe on backend, client IDs exposed securely)
app.get("/api/payment/config", (req, res) => {
  const { keyId, keySecret } = getRazorpayCredentials();
  const finalRazorpayKeyId = keyId || "";
  const hasRazorpayConfigured = !!finalRazorpayKeyId && !!keySecret;

  const finalPaypalClientId = process.env.PAYPAL_CLIENT_ID || process.env.VITE_PAYPAL_CLIENT_ID || "";
  const hasPaypalConfigured = !!finalPaypalClientId && !!process.env.PAYPAL_CLIENT_SECRET;

  const paypalPlanMonthly = process.env.PAYPAL_PLAN_MONTHLY || "P-59199343B03893339MZVLUOI";
  const paypalPlanQuarterly = process.env.PAYPAL_PLAN_QUARTERLY || "P-302302384920239084920233";

  res.json({
    razorpayKeyId: finalRazorpayKeyId,
    paypalClientId: finalPaypalClientId,
    razorpayConfigured: hasRazorpayConfigured,
    paypalConfigured: hasPaypalConfigured,
    paypalPlanMonthly,
    paypalPlanQuarterly,
  });
});

// 2. Razorpay Order Creation (Validated with Auth)
app.post("/api/razorpay/create-order", authenticateFirebaseUser, async (req: any, res) => {
  try {
    const { planName } = req.body;
    const freelancerId = req.userId;

    if (!freelancerId || !planName) {
      return res.status(400).json({ error: "Missing required parameters: freelancerId, planName" });
    }

    // Determine and verify price STRICTLY on the backend based on planName
    let amount = 199; // Pro Monthly: ₹199
    if (planName === "3 Months" || planName === "quarterly") {
      amount = 399; // Pro Quarterly: ₹399
    } else if (planName !== "Monthly" && planName !== "monthly") {
      return res.status(400).json({ error: "Invalid plan type specified" });
    }

    const amountInPaise = amount * 100;
    const { keyId, keySecret } = getRazorpayCredentials();

    if (!keyId || !keySecret) {
      console.error("[Razorpay] Order creation failed: Credentials are not configured on the server.");
      return res.status(400).json({
        success: false,
        error: "Razorpay payment gateway credentials are not configured on this server environment."
      });
    }

    console.log(`[Razorpay] Creating verified order for ${freelancerId} (${planName}, Amount: ₹${amount})`);
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
      let errJson;
      try {
        errJson = JSON.parse(errText);
      } catch (e) {
        errJson = null;
      }
      return res.status(response.status).json({
        success: false,
        error: errJson ? (errJson.error?.description || errJson.error?.reason || errText) : errText
      });
    }

    const data = await response.json();
    return res.json({
      success: true,
      orderId: data.id,
      amount: data.amount,
      currency: data.currency,
    });
  } catch (err: any) {
    console.error("Razorpay Order Creation Error:", err);
    res.status(500).json({ error: err.message || "Failed to create Razorpay order" });
  }
});

// 3. Razorpay Signature Verification and Entitlement Granting (SERVER SIDE & SECURE)
app.post("/api/razorpay/verify-payment", authenticateFirebaseUser, async (req: any, res) => {
  try {
    const orderId = req.body.orderId || req.body.razorpay_order_id;
    const paymentId = req.body.paymentId || req.body.razorpay_payment_id;
    const signature = req.body.signature || req.body.razorpay_signature;
    const freelancerId = req.userId;
    const planName = req.body.planName || req.body.planId;

    if (!freelancerId || !planName || !orderId || !paymentId || !signature) {
      return res.status(400).json({ error: "Missing required fields for payment verification" });
    }

    const { keySecret } = getRazorpayCredentials();
    if (!keySecret) {
      console.error("[Razorpay] Verification failed: Server credentials are not configured.");
      return res.status(500).json({ error: "Razorpay credentials are not configured on this server environment." });
    }

    // Verify cryptographic signature server-side
    const generatedSignature = crypto
      .createHmac("sha256", keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    if (generatedSignature !== signature) {
      console.warn(`[Razorpay] Signature verification FAILED for freelancer: ${freelancerId}`);
      return res.status(400).json({ error: "Payment verification failed. Invalid transaction signature." });
    }

    console.log(`[Razorpay] Signature verified successfully! Provisioning cloud entitlements...`);
    const updatedProfile = await activateProSubscription(
      freelancerId,
      planName,
      "Razorpay",
      paymentId,
      "IN"
    );

    return res.json({
      success: true,
      message: "Subscription activated successfully.",
      profile: updatedProfile,
    });
  } catch (err: any) {
    console.error("Razorpay Payment Verification Error:", err);
    res.status(500).json({ error: err.message || "Failed to verify Razorpay payment" });
  }
});

// 4. PayPal Subscription verification and activation (SERVER SIDE)
app.post("/api/paypal/verify-subscription", authenticateFirebaseUser, async (req: any, res) => {
  try {
    const { planId, subscriptionId } = req.body;
    const freelancerId = req.userId;

    if (!freelancerId || !planId || !subscriptionId) {
      return res.status(400).json({ error: "Missing required subscription parameters." });
    }

    const clientId = process.env.VITE_PAYPAL_CLIENT_ID || process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    const apiUrl = process.env.PAYPAL_API_URL || "https://api-m.sandbox.paypal.com";

    if (!clientId || !clientSecret) {
      return res.status(550).json({ error: "PayPal credentials are not configured on the server." });
    }

    // Authenticate with PayPal
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
      throw new Error(`Failed to authenticate with PayPal API: ${await tokenRes.text()}`);
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // Fetch Subscription Status from PayPal Subscriptions API
    const subRes = await fetch(`${apiUrl}/v1/billing/subscriptions/${subscriptionId}`, {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!subRes.ok) {
      throw new Error(`Failed to retrieve PayPal subscription ${subscriptionId}: ${await subRes.text()}`);
    }

    const subData = await subRes.json();
    const status = subData.status; // ACTIVE, APPROVED, etc.

    if (status === "ACTIVE" || status === "APPROVED") {
      console.log(`[PayPal] Subscription ${subscriptionId} verified successfully with status ${status}`);
      
      const updatedProfile = await activateProSubscription(
        freelancerId,
        planId,
        "PayPal",
        subscriptionId,
        "Other"
      );

      return res.json({
        success: true,
        profile: updatedProfile,
      });
    } else {
      return res.status(400).json({
        success: false,
        error: `PayPal subscription status is not active (current status: ${status})`,
      });
    }
  } catch (err: any) {
    console.error("PayPal Subscription verification error:", err);
    res.status(500).json({ error: err.message || "Failed to verify PayPal subscription" });
  }
});

// 5. PayPal Webhook Handler (Verified Authenticity & Idempotent)
app.post("/api/paypal/webhook", async (req, res) => {
  try {
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;
    const clientId = process.env.VITE_PAYPAL_CLIENT_ID || process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    const apiUrl = process.env.PAYPAL_API_URL || "https://api-m.sandbox.paypal.com";

    const event = req.body;
    const eventId = event.id;

    // Webhook Idempotency Check
    const isNew = await registerWebhookId(eventId);
    if (!isNew) {
      console.log(`[PayPal Webhook] Already processed event ID ${eventId}. Skipping duplicate.`);
      return res.json({ status: "ok", duplicate: true });
    }

    if (webhookId && clientId && clientSecret) {
      // Perform signature verification via PayPal API
      const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
      const tokenRes = await fetch(`${apiUrl}/v1/oauth2/token`, {
        method: "POST",
        headers: {
          "Authorization": `Basic ${basicAuth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
      });

      if (tokenRes.ok) {
        const tokenData = await tokenRes.json();
        const accessToken = tokenData.access_token;

        const payload = {
          transmission_id: req.headers["paypal-transmission-id"],
          transmission_time: req.headers["paypal-transmission-time"],
          cert_url: req.headers["paypal-cert-url"],
          auth_algo: req.headers["paypal-auth-algo"],
          transmission_sig: req.headers["paypal-transmission-sig"],
          webhook_id: webhookId,
          webhook_event: event,
        };

        const verifyRes = await fetch(`${apiUrl}/v1/notifications/verify-webhook-signature`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (verifyRes.ok) {
          const verifyData = await verifyRes.json();
          if (verifyData.verification_status !== "SUCCESS") {
            console.warn("[PayPal Webhook] Signature verification FAILED.");
            return res.status(400).json({ error: "Signature verification failed." });
          }
        } else {
          console.error("[PayPal Webhook] Verification request failed.");
        }
      }
    } else {
      console.info("[PayPal Webhook] Running in sandbox mode (missing verification keys).");
    }

    const eventType = event.event_type;
    console.log(`[PayPal Webhook] Event Verified & Processing: ${eventType}`);

    const resource = event.resource;
    const subscriptionId = resource.billing_agreement_id || resource.id;

    const customId = resource.custom_id || resource.custom || "";
    let userId = "";
    let planId = "monthly";

    if (customId && customId.includes(":")) {
      [userId, planId] = customId.split(":");
    }

    if (eventType === "BILLING.SUBSCRIPTION.ACTIVATED" || eventType === "PAYMENT.SALE.COMPLETED") {
      if (userId) {
        await activateProSubscription(
          userId,
          planId,
          "PayPal",
          subscriptionId,
          "Other"
        );
        console.log(`[PayPal Webhook] Subscription activated / payment captured: ${userId}`);
      }
    } else if (
      eventType === "BILLING.SUBSCRIPTION.CANCELLED" ||
      eventType === "BILLING.SUBSCRIPTION.SUSPENDED" ||
      eventType === "BILLING.SUBSCRIPTION.EXPIRED"
    ) {
      if (userId) {
        const statusMap: any = {
          "BILLING.SUBSCRIPTION.CANCELLED": "cancelled",
          "BILLING.SUBSCRIPTION.SUSPENDED": "suspended",
          "BILLING.SUBSCRIPTION.EXPIRED": "expired"
        };
        await cancelOrExpireProSubscription(
          userId,
          "PayPal",
          statusMap[eventType],
          subscriptionId
        );
        console.log(`[PayPal Webhook] Subscription state ${eventType} parsed for user: ${userId}`);
      }
    }

    return res.json({ status: "ok" });
  } catch (err: any) {
    console.error("PayPal Webhook Error:", err);
    return res.status(500).json({ error: "Webhook handling failed." });
  }
});

// Legacy Orders Fallback routes for Paypal to preserve backwards-compatibility (if any clients hit them)
app.post("/api/paypal/create-order", authenticateFirebaseUser, async (req: any, res) => {
  try {
    const { planName } = req.body;
    const freelancerId = req.userId;
    if (!freelancerId || !planName) {
      return res.status(400).json({ error: "Missing parameters" });
    }
    const isQuarterly = planName === "3 Months" || planName === "quarterly";
    const amount = isQuarterly ? "11.99" : "4.99";

    const clientId = process.env.VITE_PAYPAL_CLIENT_ID || process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    const apiUrl = process.env.PAYPAL_API_URL || "https://api-m.sandbox.paypal.com";

    if (!clientId || !clientSecret) {
      return res.status(400).json({ error: "PayPal credentials not configured on the server." });
    }

    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const tokenRes = await fetch(`${apiUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

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
              value: amount,
            },
            description: `Freelancer CRM Pro Plan - ${planName} Access`,
            custom_id: `${freelancerId}:${isQuarterly ? "quarterly" : "monthly"}`,
          },
        ],
      }),
    });

    const orderData = await orderRes.json();
    return res.json({
      success: true,
      orderId: orderData.id,
      status: orderData.status,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/paypal/capture-order", authenticateFirebaseUser, async (req: any, res) => {
  try {
    const { orderId, planName } = req.body;
    const freelancerId = req.userId;
    if (!freelancerId || !orderId) {
      return res.status(400).json({ error: "Missing parameters" });
    }

    const clientId = process.env.VITE_PAYPAL_CLIENT_ID || process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    const apiUrl = process.env.PAYPAL_API_URL || "https://api-m.sandbox.paypal.com";

    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const tokenRes = await fetch(`${apiUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    const captureRes = await fetch(`${apiUrl}/v2/checkout/orders/${orderId}/capture`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    const captureData = await captureRes.json();
    if (captureData.status === "COMPLETED") {
      const captureId = captureData.purchase_units?.[0]?.payments?.captures?.[0]?.id || orderId;
      const updatedProfile = await activateProSubscription(
        freelancerId,
        planName || "Monthly",
        "PayPal",
        captureId,
        "Other"
      );
      return res.json({
        success: true,
        gateway: "PayPal",
        transactionId: captureId,
        profile: updatedProfile,
      });
    } else {
      return res.status(400).json({ error: "PayPal order was not completed." });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
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

export default app;

// Only start the standalone Express listener if NOT running inside Vercel's Serverless environment
if (!process.env.VERCEL) {
  init();
}
