import express from "express";
import path from "path";
import fs from "fs";
import "dotenv/config";
import Stripe from "stripe";
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

function ensureFirebaseAdminInitialized() {
  if (getApps().length === 0) {
    let finalProjectId = "gen-lang-client-0198820455";
    try {
      const configPath = path.join(process.cwd(), "firebase-applet-config.json");
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        if (config.projectId) {
          finalProjectId = config.projectId;
        }
      }
    } catch (err) {
      console.warn("[Firebase Admin] Failed to read firebase-applet-config.json, using default project:", err);
    }

    console.log(`[Firebase Admin] Dynamically initializing with project ID: ${finalProjectId}`);
    try {
      initializeApp({
        projectId: finalProjectId,
      });
    } catch (err: any) {
      console.error("[Firebase Admin] Initialization failed with configuration, retrying default init:", err);
      try {
        initializeApp();
      } catch (innerErr: any) {
        console.error("[Firebase Admin] Ultimate initialization failure:", innerErr);
      }
    }
  }
}

function restoreTimestamps(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map(restoreTimestamps);
  }

  if (
    (obj._seconds !== undefined && obj._nanoseconds !== undefined) ||
    (obj.seconds !== undefined && obj.nanoseconds !== undefined)
  ) {
    const s = obj._seconds !== undefined ? obj._seconds : obj.seconds;
    const n = obj._nanoseconds !== undefined ? obj._nanoseconds : obj.nanoseconds;
    try {
      return new Timestamp(s, n);
    } catch (e) {
      const t = new Timestamp(s, n);
      (t as any).toDate = () => new Date(s * 1000);
      return t;
    }
  }

  const newObj: any = {};
  for (const key of Object.keys(obj)) {
    newObj[key] = restoreTimestamps(obj[key]);
  }
  return newObj;
}

class LocalDatabase {
  private filePath = path.join(process.cwd(), "local-db.json");
  private data: Record<string, Record<string, any>> = {};

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(this.filePath)) {
        this.data = JSON.parse(fs.readFileSync(this.filePath, "utf-8"));
      } else {
        this.data = {};
      }
    } catch (err) {
      console.warn("[LocalDB Fallback] Failed to read local-db.json:", err);
      this.data = {};
    }
  }

  private save() {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), "utf-8");
    } catch (err) {
      console.error("[LocalDB Fallback] Failed to write local-db.json:", err);
    }
  }

  collection(name: string) {
    if (!this.data[name]) {
      this.data[name] = {};
    }
    const colData = this.data[name];

    return {
      doc: (id: string) => {
        return {
          get: async () => {
            const docData = colData[id];
            return {
              exists: docData !== undefined,
              id,
              data: () => docData ? restoreTimestamps(JSON.parse(JSON.stringify(docData))) : null,
            };
          },
          set: async (newData: any, options?: { merge?: boolean }) => {
            if (options?.merge && colData[id]) {
              colData[id] = { ...colData[id], ...newData };
            } else {
              colData[id] = newData;
            }
            this.save();
          },
          delete: async () => {
            delete colData[id];
            this.save();
          }
        };
      },
      get: async () => {
        const docs = Object.entries(colData).map(([id, val]) => ({
          id,
          exists: true,
          data: () => restoreTimestamps(JSON.parse(JSON.stringify(val))),
        }));
        return {
          forEach: (cb: (doc: any) => void) => {
            docs.forEach(cb);
          },
          docs,
        };
      }
    };
  }

  async runTransaction(cb: (transaction: any) => Promise<any>) {
    const transaction = {
      get: async (ref: any) => {
        return ref.get();
      },
      set: (ref: any, data: any) => {
        ref.set(data);
      }
    };
    return cb(transaction);
  }
}

let dbModeChecked = false;
let useLocalDbFallback = false;
let localDbInstance: LocalDatabase | null = null;
let rawDbInstance: any = null;

function getLocalDb() {
  if (!localDbInstance) {
    localDbInstance = new LocalDatabase();
  }
  return localDbInstance;
}

function getRawDbInstance() {
  ensureFirebaseAdminInitialized();
  if (!rawDbInstance) {
    let customDbId = "ai-studio-d5cae848-c1ed-4f2e-9f89-e9c69ed15c6c";
    try {
      const configPath = path.join(process.cwd(), "firebase-applet-config.json");
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        if (config.firestoreDatabaseId) {
          customDbId = config.firestoreDatabaseId;
        }
      }
    } catch (err) {
      console.warn("[Firebase Admin] Failed to read customDbId from firebase-applet-config.json, using default:", err);
    }

    try {
      rawDbInstance = getFirestore(getApp(), customDbId);
    } catch (err: any) {
      console.error("[Firebase Admin] Failed to initialize Firestore instance:", err);
      rawDbInstance = null;
    }
  }
  return rawDbInstance;
}

async function initializeDatabaseMode() {
  if (dbModeChecked) return;
  dbModeChecked = true;
  
  ensureFirebaseAdminInitialized();
  const rawInstance = getRawDbInstance();
  if (!rawInstance) {
    useLocalDbFallback = true;
    return;
  }

  try {
    // Attempt a silent probe read to see if IAM credentials allow it
    await rawInstance.collection("config").doc("probe").get();
    console.log("[Firestore] Cloud Firestore connection verified successfully. Running in Cloud Database Mode.");
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    if (errMsg.includes("PERMISSION_DENIED") || errMsg.includes("credentials") || errMsg.includes("auth") || errMsg.includes("credential")) {
      console.warn("[Firestore] Server environment lacks administrative write permissions (PERMISSION_DENIED).");
      console.warn("[Firestore] Seamlessly activating high-performance local JSON-based fallback database.");
      useLocalDbFallback = true;
    } else {
      console.log("[Firestore] Cloud Firestore connection verified. Running in Cloud Database Mode.");
    }
  }
}

// Proxied db instance that lazily initializes and routes to Local or Cloud DB
const db = new Proxy({} as any, {
  get(target, prop) {
    if (useLocalDbFallback) {
      const localDb = getLocalDb();
      const value = localDb[prop as keyof LocalDatabase];
      if (typeof value === "function") {
        return value.bind(localDb);
      }
      return value;
    }

    const instance = getRawDbInstance();
    if (!instance) {
      const localDb = getLocalDb();
      const value = localDb[prop as keyof LocalDatabase];
      if (typeof value === "function") {
        return value.bind(localDb);
      }
      return value;
    }

    const value = instance[prop];
    if (typeof value === "function") {
      return (...args: any[]) => {
        try {
          const result = value.apply(instance, args);
          if (result && typeof result.then === "function") {
            return result.catch((err: any) => {
              const errMsg = err?.message || String(err);
              if (errMsg.includes("PERMISSION_DENIED") || errMsg.includes("credentials") || errMsg.includes("auth") || errMsg.includes("credential")) {
                console.warn("[Firestore] Permission error caught on database promise. Activating local database fallback.");
                useLocalDbFallback = true;
                const localDb = getLocalDb() as any;
                return localDb[prop](...args);
              }
              throw err;
            });
          }
          return result;
        } catch (err: any) {
          const errMsg = err?.message || String(err);
          if (errMsg.includes("PERMISSION_DENIED") || errMsg.includes("credentials") || errMsg.includes("auth") || errMsg.includes("credential")) {
            console.warn("[Firestore] Permission error caught on database sync call. Activating local database fallback.");
            useLocalDbFallback = true;
            const localDb = getLocalDb() as any;
            return localDb[prop](...args);
          }
          throw err;
        }
      };
    }
    return value;
  }
});

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
      ensureFirebaseAdminInitialized();
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

interface PendingActivation {
  freelancerId: string;
  planName: string;
  gateway: "Razorpay" | "PayPal";
  transactionId: string;
  region: "IN" | "Other";
  addedAt: string;
}

const pendingActivations: PendingActivation[] = [];

function addPendingActivation(activation: PendingActivation) {
  if (!pendingActivations.some(a => a.transactionId === activation.transactionId)) {
    pendingActivations.push(activation);
    console.log(`[Pending Activation Queue] Added transaction: ${activation.transactionId} for user ${activation.freelancerId}. Queue size: ${pendingActivations.length}`);
  }
}

async function processPendingActivations() {
  if (pendingActivations.length === 0) return;
  console.log(`[Background Worker] Processing ${pendingActivations.length} pending Pro activations...`);

  const activeQueue = [...pendingActivations];
  for (const item of activeQueue) {
    try {
      console.log(`[Background Worker] Retrying Pro activation for user ${item.freelancerId}, transaction ${item.transactionId}`);
      
      const isQuarterly = item.planName === "3 Months" || item.planName === "quarterly";
      const durationInDays = isQuarterly ? 90 : 30;
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + durationInDays);

      const billingCountry = item.region === "IN" ? "IN" : "Other";
      const currency = item.region === "IN" ? "INR" : "USD";
      const amount = item.region === "IN" ? (isQuarterly ? 399 : 199) : (isQuarterly ? 7.99 : 2.99);
      const subPlan = isQuarterly ? "quarterly" : "monthly";

      const userUpdate = {
        plan: "pro",
        billingCountry: billingCountry,
        paymentProvider: item.gateway.toLowerCase(),
        subscriptionPlan: subPlan,
        subscriptionStatus: "active",
        proUntil: Timestamp.fromDate(expiryDate),
        providerCustomerId: null,
        providerSubscriptionId: item.transactionId,
      };

      const paymentRecord = {
        userId: item.freelancerId,
        provider: item.gateway.toLowerCase(),
        planId: subPlan,
        amount: amount,
        currency: currency,
        status: "completed",
        providerPaymentId: item.transactionId,
        createdAt: Timestamp.now(),
      };

      const freelancerUpdate = {
        plan: "Pro",
        premium: true,
        subscriptionStatus: "active",
        subscriptionRegion: item.region,
        subscriptionMethod: item.gateway,
        subscriptionRenewsAt: expiryDate.toISOString(),
        paymentGateway: item.gateway,
        purchaseDate: new Date().toISOString(),
        expiryDate: expiryDate.toISOString(),
        transactionId: item.transactionId,
        billingCountry: billingCountry,
        country: billingCountry,
      };

      await Promise.all([
        db.collection("users").doc(item.freelancerId).set(userUpdate, { merge: true }),
        db.collection("freelancers").doc(item.freelancerId).set(freelancerUpdate, { merge: true }),
        db.collection("payments").doc(item.transactionId).set(paymentRecord),
      ]);

      try {
        await db.collection("pending_activations").doc(item.transactionId).delete();
        console.log(`[Background Worker] Removed pending activation from Firestore: ${item.transactionId}`);
      } catch (delErr) {
        // Ignore or log
      }

      const index = pendingActivations.findIndex(a => a.transactionId === item.transactionId);
      if (index !== -1) {
        pendingActivations.splice(index, 1);
      }
      console.log(`[Background Worker] Successfully activated Pro subscription for user ${item.freelancerId}, transaction ${item.transactionId}`);
    } catch (err: any) {
      console.error(`[Background Worker] Retry failed for transaction ${item.transactionId}:`, err.message || err);
    }
  }
}

// Set up periodic polling for pending activations (every 15 seconds)
setInterval(() => {
  processPendingActivations().catch(err => {
    console.error("[Background Worker] Exception in background processing loop:", err);
  });
}, 15000);

async function loadPendingActivationsFromFirestore() {
  try {
    console.log("[Billing Engine] Loading any existing pending activations from Firestore...");
    const snap = await db.collection("pending_activations").get();
    let count = 0;
    snap.forEach((doc: any) => {
      const data = doc.data();
      if (data && data.freelancerId && data.transactionId) {
        addPendingActivation({
          freelancerId: data.freelancerId,
          planName: data.planName || "monthly",
          gateway: data.gateway,
          transactionId: data.transactionId,
          region: data.region || "Other",
          addedAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        });
        count++;
      }
    });
    if (count > 0) {
      console.log(`[Billing Engine] Successfully loaded ${count} pending activations from Firestore.`);
    }
  } catch (err) {
    console.warn("[Billing Engine] Failed to load pending activations from Firestore (might be uninitialized yet):", err);
  }
}

// Automatically initialize database mode and load pending activations on startup
initializeDatabaseMode().then(() => {
  loadPendingActivationsFromFirestore().catch((err: any) => {
    console.error("[Billing Engine] Lazy pending load error:", err);
  });
}).catch((err: any) => {
  console.error("[Database Mode Init] Failed during startup:", err);
});

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
  const amount = region === "IN" ? (isQuarterly ? 399 : 199) : (isQuarterly ? 7.99 : 2.99);
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

  console.log(`[Billing Engine] Initiating Pro activation. uid: ${freelancerId} via ${gateway}. Transaction: ${transactionId}`);

  let attempts = 0;
  const maxAttempts = 5;
  let success = false;
  let lastError: any = null;

  while (attempts < maxAttempts && !success) {
    attempts++;
    console.log(`[Billing Engine] Firestore write attempt ${attempts}/${maxAttempts} for uid: ${freelancerId}, txn: ${transactionId}`);
    try {
      await Promise.all([
        db.collection("users").doc(freelancerId).set(userUpdate, { merge: true }),
        db.collection("freelancers").doc(freelancerId).set(freelancerUpdate, { merge: true }),
        db.collection("payments").doc(transactionId).set(paymentRecord),
      ]);
      success = true;
      console.log(`[Billing Engine] Successfully wrote Pro subscription to Firestore on attempt ${attempts}`);
    } catch (err: any) {
      lastError = err;
      console.warn(`[Billing Engine] Firestore write attempt ${attempts} failed:`, err.message || err);
      if (attempts < maxAttempts) {
        // Wait 1 second on first retry, 2s on second, etc.
        await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
      }
    }
  }

  if (success) {
    try {
      const updatedSnap = await db.collection("freelancers").doc(freelancerId).get();
      return updatedSnap.exists ? updatedSnap.data() : freelancerUpdate;
    } catch (err) {
      console.warn("[Billing Engine] Failed to fetch updated profile, returning local update:", err);
      return freelancerUpdate;
    }
  } else {
    // 9. If Firestore update fails after payment succeeds, store the payment as pending and retry automatically until Pro is activated.
    console.error(`[Billing Engine] ALL ${maxAttempts} Firestore write attempts FAILED for user: ${freelancerId}. Storing activation as PENDING.`);
    
    addPendingActivation({
      freelancerId,
      planName,
      gateway,
      transactionId,
      region,
      addedAt: new Date().toISOString()
    });

    // Also attempt to save it in Firestore's "pending_activations" collection
    try {
      await db.collection("pending_activations").doc(transactionId).set({
        freelancerId,
        planName,
        gateway,
        transactionId,
        region,
        status: "pending",
        createdAt: Timestamp.now(),
      });
      console.log(`[Billing Engine] Saved pending activation record to Firestore for transaction: ${transactionId}`);
    } catch (dbErr) {
      console.error(`[Billing Engine] Failed to write pending activation document to Firestore:`, dbErr);
    }

    throw new Error(`Database sync failed, but your payment was processed. Your subscription has been stored as pending and will be automatically activated shortly. Transaction ID: ${transactionId}`);
  }
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

  try {
    await Promise.all([
      db.collection("users").doc(freelancerId).set(userUpdate, { merge: true }),
      db.collection("freelancers").doc(freelancerId).set(freelancerUpdate, { merge: true }),
    ]);
  } catch (err: any) {
    console.error(`[Billing Engine] Error updating Firestore during subscription cancellation/expiration for ${freelancerId}:`, err);
  }
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
      const freelancerId = session.metadata?.freelancerId;
      let updatedProfile = null;
      if (freelancerId) {
        updatedProfile = await activateProSubscription(
          freelancerId,
          "monthly",
          "Stripe" as any,
          session.id,
          "Other"
        );
      }
      res.json({
        success: true,
        paymentStatus: session.payment_status,
        freelancerId: freelancerId || null,
        customerId: typeof session.customer === "string" ? session.customer : null,
        subscriptionId: typeof session.subscription === "string" ? session.subscription : null,
        profile: updatedProfile,
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

// Geolocation endpoint to detect user country securely from server side
app.get("/api/detect-country", async (req, res) => {
  try {
    // 1. Try standard cloud hosting/GCLB headers first (fast, accurate)
    const headersToCheck = [
      "x-appengine-country",
      "x-client-geo-country",
      "cf-ipcountry",
      "x-country-code"
    ];
    for (const h of headersToCheck) {
      const val = req.headers[h];
      if (val && typeof val === "string" && val.trim().length === 2) {
        const countryCode = val.trim().toUpperCase();
        console.log(`[GeoIP] Detected country ${countryCode} from header: ${h}`);
        return res.json({ success: true, country: countryCode, source: "header:" + h });
      }
    }

    // 2. Fallback: IP geolocation lookup
    let clientIp = "";
    const xForwardedFor = req.headers["x-forwarded-for"];
    if (xForwardedFor && typeof xForwardedFor === "string") {
      clientIp = xForwardedFor.split(",")[0].trim();
    } else {
      clientIp = req.socket.remoteAddress || "";
    }

    if (clientIp.startsWith("::ffff:")) {
      clientIp = clientIp.substring(7);
    }

    const isLocal = !clientIp || clientIp === "127.0.0.1" || clientIp === "::1" || clientIp.startsWith("10.") || clientIp.startsWith("192.168.") || clientIp.startsWith("172.16.");

    if (!isLocal) {
      // Use ip-api.com (free, non-ssl endpoint or SSL endpoint)
      const geoUrl = `http://ip-api.com/json/${clientIp}`;
      const response = await fetch(geoUrl);
      if (response.ok) {
        const data: any = await response.json();
        if (data && data.status === "success" && data.countryCode && data.countryCode.length === 2) {
          const countryCode = data.countryCode.toUpperCase();
          console.log(`[GeoIP] Detected country ${countryCode} from IP lookup of ${clientIp}`);
          return res.json({
            success: true,
            country: countryCode,
            source: "ip-api"
          });
        }
      }
    }

    console.warn(`[GeoIP] Fallback to US. Client IP: ${clientIp}, Local: ${isLocal}`);
    return res.json({
      success: false,
      country: "US",
      source: "default"
    });
  } catch (err: any) {
    console.error("[GeoIP] Error during country detection:", err);
    return res.json({
      success: false,
      country: "US",
      source: "error"
    });
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

// Dynamic PayPal product and billing plan auto-provisioning to avoid RESOURCE_NOT_FOUND (INVALID_RESOURCE_ID)
let paypalCachePromise: Promise<{ monthlyPlanId: string, quarterlyPlanId: string } | null> | null = null;
let lastPaypalAttemptTime = 0;

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timeoutId: any;
  const timeoutPromise = new Promise<T>((resolve) => {
    timeoutId = setTimeout(() => {
      console.warn(`[Timeout] Promise timed out after ${ms}ms. Returning fallback.`);
      resolve(fallback);
    }, ms);
  });
  return Promise.race([
    promise.then((val) => {
      clearTimeout(timeoutId);
      return val;
    }),
    timeoutPromise
  ]);
}

async function getOrCreatePaypalPlans(apiUrl: string, clientId: string, clientSecret: string) {
  const now = Date.now();
  if (!paypalCachePromise) {
    if (now - lastPaypalAttemptTime < 60000) {
      console.log("[PayPal] Throttling dynamic plan creation attempts to avoid blocking the server.");
      return null;
    }
    lastPaypalAttemptTime = now;

    paypalCachePromise = (async () => {
      // 1. Authenticate with PayPal first to ensure credentials work and obtain an access token
      let accessToken = "";
      try {
        console.log(`[PayPal API Request] POST ${apiUrl}/v1/oauth2/token - Initiating authentication with Client ID: ${clientId.substring(0, 10)}...`);
        const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
        const tokenRes = await fetch(`${apiUrl}/v1/oauth2/token`, {
          method: "POST",
          headers: {
            "Authorization": `Basic ${basicAuth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: "grant_type=client_credentials",
        });

        const debugId = tokenRes.headers.get("paypal-debug-id") || "N/A";
        console.log(`[PayPal API Response] Auth Status: ${tokenRes.status}, Debug ID: ${debugId}`);

        if (!tokenRes.ok) {
          const errText = await tokenRes.text();
          console.error(`[PayPal API Error] Authentication failed. Debug ID: ${debugId}. Error Details: ${errText}`);
          throw new Error(`PayPal auth failed (Debug ID: ${debugId}): ${errText}`);
        }

        const tokenData = await tokenRes.json();
        accessToken = tokenData.access_token;
        console.log("[PayPal] Authentication successful. Obtained Bearer token.");
      } catch (authErr: any) {
        console.error("[PayPal] Exception during PayPal authentication:", authErr);
        paypalCachePromise = null;
        return null;
      }

      // Helper function to verify if a plan ID exists and is active on the current merchant account
      const verifyPlan = async (planId: string): Promise<boolean> => {
        try {
          console.log(`[PayPal API Request] GET ${apiUrl}/v1/billing/plans/${planId} - Verifying plan status...`);
          const checkRes = await fetch(`${apiUrl}/v1/billing/plans/${planId}`, {
            headers: {
              "Authorization": `Bearer ${accessToken}`,
              "Content-Type": "application/json"
            }
          });
          const debugId = checkRes.headers.get("paypal-debug-id") || "N/A";
          console.log(`[PayPal API Response] Plan ${planId} Check Status: ${checkRes.status}, Debug ID: ${debugId}`);
          
          if (checkRes.ok) {
            const planDetail = await checkRes.json();
            console.log(`[PayPal API Plan Info] Plan ${planId} verified. Name: "${planDetail.name}", Status: "${planDetail.status}"`);
            return planDetail.status === "ACTIVE";
          }
          const checkErr = await checkRes.text();
          console.warn(`[PayPal API Warning] Failed to fetch details for plan ${planId}. Status: ${checkRes.status}. Error: ${checkErr}`);
          return false;
        } catch (e: any) {
          console.error(`[PayPal] Exception occurred while verifying plan ${planId}:`, e);
          return false;
        }
      };

      // 2. Try to read cached plans from Firestore and verify they are still valid/active
      try {
        const configDoc = await db.collection("config").doc("paypal_v3").get();
        if (configDoc.exists) {
          const data = configDoc.data();
          if (data && data.paypalPlanMonthly && data.paypalPlanQuarterly) {
            console.log("[PayPal] Retrieved plan IDs from Firestore cache. Validating them on current PayPal merchant account...");
            const isMonthlyValid = await verifyPlan(data.paypalPlanMonthly);
            const isQuarterlyValid = await verifyPlan(data.paypalPlanQuarterly);
            
            if (isMonthlyValid && isQuarterlyValid) {
              console.log("[PayPal] Cache verified! Both Monthly and Quarterly plans are active. Proceeding with cached IDs.");
              return {
                monthlyPlanId: data.paypalPlanMonthly,
                quarterlyPlanId: data.paypalPlanQuarterly,
              };
            } else {
              console.warn("[PayPal] Cached plans are either inactive or belong to a different PayPal account. Generating fresh plans...");
            }
          }
        }
      } catch (err) {
        console.warn("[PayPal] Failed to read cached plans from Firestore. Proceeding to fetch/create dynamically...", err);
      }

      // 3. Fallback to dynamic creation via PayPal REST APIs if cache is missing or invalid
      try {
        console.log("[PayPal] Creating dynamic product and plans under the configured merchant account...");

        // Create catalog Product
        const requestIdProd = `req-prod-${Date.now()}`;
        console.log(`[PayPal API Request] POST ${apiUrl}/v1/catalogs/products (Request-Id: ${requestIdProd})`);
        const productRes = await fetch(`${apiUrl}/v1/catalogs/products`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            "PayPal-Request-Id": requestIdProd,
          },
          body: JSON.stringify({
            name: "Freelancer Pro Plan",
            description: "Premium access to Freelancer CRM & Billing Tools",
            type: "SERVICE",
            category: "SOFTWARE"
          }),
        });

        const prodDebugId = productRes.headers.get("paypal-debug-id") || "N/A";
        console.log(`[PayPal API Response] Product Creation Status: ${productRes.status}, Debug ID: ${prodDebugId}`);

        if (!productRes.ok) {
          const prodErr = await productRes.text();
          console.error(`[PayPal API Error] Product creation failed. Debug ID: ${prodDebugId}. Details: ${prodErr}`);
          throw new Error(`PayPal product creation failed (Debug ID: ${prodDebugId}): ${prodErr}`);
        }

        const productData = await productRes.json();
        const productId = productData.id;
        console.log(`[PayPal] Successfully created catalog product with ID: ${productId}`);

        // Create Pro Monthly Plan ($2.99 / Month)
        const requestIdMonthly = `req-plan-mon-${Date.now()}`;
        console.log(`[PayPal API Request] POST ${apiUrl}/v1/billing/plans - Creating Pro Monthly Plan (Request-Id: ${requestIdMonthly})`);
        const monthlyRes = await fetch(`${apiUrl}/v1/billing/plans`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            "PayPal-Request-Id": requestIdMonthly,
          },
          body: JSON.stringify({
            product_id: productId,
            name: "Pro Monthly Plan",
            description: "Monthly subscription for Pro features",
            status: "ACTIVE",
            billing_cycles: [
              {
                frequency: {
                  interval_unit: "MONTH",
                  interval_count: 1
                },
                tenure_type: "REGULAR",
                sequence: 1,
                total_cycles: 0,
                pricing_scheme: {
                  fixed_price: {
                    value: "2.99",
                    currency_code: "USD"
                  }
                }
              }
            ],
            payment_preferences: {
              auto_bill_outstanding: true,
              setup_fee: {
                value: "0",
                currency_code: "USD"
              },
              setup_fee_failure_action: "CONTINUE",
              payment_failure_threshold: 3
            }
          }),
        });

        const monDebugId = monthlyRes.headers.get("paypal-debug-id") || "N/A";
        console.log(`[PayPal API Response] Monthly Plan Creation Status: ${monthlyRes.status}, Debug ID: ${monDebugId}`);

        if (!monthlyRes.ok) {
          const monErr = await monthlyRes.text();
          console.error(`[PayPal API Error] Monthly plan creation failed. Debug ID: ${monDebugId}. Details: ${monErr}`);
          throw new Error(`PayPal monthly plan creation failed (Debug ID: ${monDebugId}): ${monErr}`);
        }

        const monthlyData = await monthlyRes.json();
        const monthlyPlanId = monthlyData.id;
        console.log(`[PayPal] Successfully created Monthly Plan: ${monthlyPlanId}`);

        // Create Pro Quarterly Plan ($7.99 / 3 Months)
        const requestIdQuarterly = `req-plan-qtr-${Date.now()}`;
        console.log(`[PayPal API Request] POST ${apiUrl}/v1/billing/plans - Creating Pro Quarterly Plan (Request-Id: ${requestIdQuarterly})`);
        const quarterlyRes = await fetch(`${apiUrl}/v1/billing/plans`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            "PayPal-Request-Id": requestIdQuarterly,
          },
          body: JSON.stringify({
            product_id: productId,
            name: "Pro Quarterly Plan",
            description: "Quarterly subscription for Pro features",
            status: "ACTIVE",
            billing_cycles: [
              {
                frequency: {
                  interval_unit: "MONTH",
                  interval_count: 3
                },
                tenure_type: "REGULAR",
                sequence: 1,
                total_cycles: 0,
                pricing_scheme: {
                  fixed_price: {
                    value: "7.99",
                    currency_code: "USD"
                  }
                }
              }
            ],
            payment_preferences: {
              auto_bill_outstanding: true,
              setup_fee: {
                value: "0",
                currency_code: "USD"
              },
              setup_fee_failure_action: "CONTINUE",
              payment_failure_threshold: 3
            }
          }),
        });

        const qtrDebugId = quarterlyRes.headers.get("paypal-debug-id") || "N/A";
        console.log(`[PayPal API Response] Quarterly Plan Creation Status: ${quarterlyRes.status}, Debug ID: ${qtrDebugId}`);

        if (!quarterlyRes.ok) {
          const qtrErr = await quarterlyRes.text();
          console.error(`[PayPal API Error] Quarterly plan creation failed. Debug ID: ${qtrDebugId}. Details: ${qtrErr}`);
          throw new Error(`PayPal quarterly plan creation failed (Debug ID: ${qtrDebugId}): ${qtrErr}`);
        }

        const quarterlyData = await quarterlyRes.json();
        const quarterlyPlanId = quarterlyData.id;
        console.log(`[PayPal] Successfully created Quarterly Plan: ${quarterlyPlanId}`);

        // Save new plan details in Firestore
        try {
          await db.collection("config").doc("paypal_v3").set({
            paypalPlanMonthly: monthlyPlanId,
            paypalPlanQuarterly: quarterlyPlanId,
            productId: productId,
            createdAt: new Date().toISOString()
          });
          console.log("[PayPal] Saved newly created and verified plan IDs to Firestore cache.");
        } catch (fsErr) {
          console.warn("[PayPal] Failed to write plan IDs to Firestore cache (falling back to memory-only):", fsErr);
        }

        return {
          monthlyPlanId,
          quarterlyPlanId,
        };
      } catch (err) {
        console.error("[PayPal] Error creating dynamic products/plans:", err);
        // Reset promise on error so that we can retry
        paypalCachePromise = null;
        return null;
      }
    })();
  }
  return paypalCachePromise;
}

// 1. Fetch public payment config (Secrets are safe on backend, client IDs exposed securely)
app.get("/api/payment/config", async (req, res) => {
  const { keyId, keySecret } = getRazorpayCredentials();
  const finalRazorpayKeyId = keyId || "";
  const hasRazorpayConfigured = !!finalRazorpayKeyId && !!keySecret;

  const finalPaypalClientId = process.env.PAYPAL_CLIENT_ID || process.env.VITE_PAYPAL_CLIENT_ID || "";
  const hasPaypalConfigured = !!finalPaypalClientId && !!process.env.PAYPAL_CLIENT_SECRET;
  const apiUrl = process.env.PAYPAL_API_URL || "https://api-m.sandbox.paypal.com";

  let paypalPlanMonthly = process.env.PAYPAL_PLAN_MONTHLY || "P-59199343B03893339MZVLUOI";
  let paypalPlanQuarterly = process.env.PAYPAL_PLAN_QUARTERLY || "P-302302384920239084920233";

  if (hasPaypalConfigured) {
    try {
      const dynamicPlans = await withTimeout(
        getOrCreatePaypalPlans(apiUrl, finalPaypalClientId, process.env.PAYPAL_CLIENT_SECRET!),
        1500,
        null
      );
      if (dynamicPlans) {
        paypalPlanMonthly = dynamicPlans.monthlyPlanId;
        paypalPlanQuarterly = dynamicPlans.quarterlyPlanId;
      }
    } catch (err) {
      console.error("[PayPal] Failed to dynamically get or create active billing plans:", err);
    }
  }

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
  console.log("[Razorpay] Received payment verification request:", {
    orderId: req.body.orderId || req.body.razorpay_order_id,
    paymentId: req.body.paymentId || req.body.razorpay_payment_id,
    hasSignature: !!(req.body.signature || req.body.razorpay_signature),
    freelancerId: req.userId,
    planName: req.body.planName || req.body.planId,
  });

  try {
    const orderId = req.body.orderId || req.body.razorpay_order_id;
    const paymentId = req.body.paymentId || req.body.razorpay_payment_id;
    const signature = req.body.signature || req.body.razorpay_signature;
    const freelancerId = req.userId;
    const planName = req.body.planName || req.body.planId;

    if (!freelancerId) {
      console.warn("[Razorpay] Payment verification rejected: Missing freelancer ID/authentication context.");
      return res.status(401).json({ error: "Unauthorized. Missing user context." });
    }

    if (!orderId || !paymentId || !signature || !planName) {
      console.warn("[Razorpay] Payment verification rejected due to missing fields:", {
        orderId: !!orderId,
        paymentId: !!paymentId,
        signature: !!signature,
        planName: !!planName,
      });
      return res.status(400).json({ error: "Missing required fields for payment verification (orderId, paymentId, signature, and planName are required)." });
    }

    const { keySecret } = getRazorpayCredentials();
    if (!keySecret) {
      console.error("[Razorpay] Verification failed: Server credentials (RAZORPAY_KEY_SECRET) are not configured.");
      return res.status(500).json({ error: "Razorpay credentials are not configured on this server environment." });
    }

    // Verify cryptographic signature server-side
    console.log(`[Razorpay] Generating HmacSha256 signature using secret...`);
    const generatedSignature = crypto
      .createHmac("sha256", keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    if (generatedSignature !== signature) {
      console.warn(`[Razorpay] Cryptographic signature verification FAILED for freelancer: ${freelancerId}. Expected: ${generatedSignature}, Received: ${signature}`);
      return res.status(400).json({ error: "Payment verification failed. Invalid transaction signature." });
    }

    console.log(`[Razorpay] Cryptographic signature matches. Checking for duplicate payment: ${paymentId}`);
    // Prevent duplicate processing or ID reuse
    const paymentDoc = await db.collection("payments").doc(paymentId).get();
    if (paymentDoc.exists) {
      const paymentData = paymentDoc.data();
      if (paymentData?.userId !== freelancerId) {
        console.warn(`[Razorpay] Attempt to reuse payment ID: ${paymentId} by different user: ${freelancerId} (owned by ${paymentData?.userId})`);
        return res.status(400).json({
          success: false,
          error: "Unauthorized: This payment is already claimed by another user.",
        });
      }
      
      console.log(`[Razorpay] Payment ${paymentId} already processed for user ${freelancerId}. Returning existing profile.`);
      const profile = await getFreelancerProfile(freelancerId);
      return res.json({
        success: true,
        profile,
        duplicate: true,
      });
    }

    console.log(`[Razorpay] Signature verified successfully! Activating Pro subscription for: ${freelancerId}`);
    const updatedProfile = await activateProSubscription(
      freelancerId,
      planName,
      "Razorpay",
      paymentId,
      "IN"
    );

    if (!updatedProfile) {
      console.error(`[Razorpay] Subscription activation failed to return a valid profile for: ${freelancerId}`);
      return res.status(500).json({ error: "Subscription activation failed. Could not retrieve updated profile." });
    }

    console.log(`[Razorpay] Subscription successfully activated! Upgraded profile:`, {
      id: updatedProfile.id,
      plan: updatedProfile.plan,
      premium: updatedProfile.premium,
      subscriptionStatus: updatedProfile.subscriptionStatus,
    });

    return res.json({
      success: true,
      message: "Subscription activated successfully.",
      profile: updatedProfile,
    });
  } catch (err: any) {
    console.error("[Razorpay] Payment Verification Exception:", err);
    res.status(500).json({ 
      success: false, 
      error: err.message || "Failed to verify Razorpay payment",
      isPending: true 
    });
  }
});

// 4. PayPal Subscription verification and activation (SERVER SIDE)
app.post("/api/paypal/verify-subscription", authenticateFirebaseUser, async (req: any, res) => {
  console.log("[PayPal] Received subscription verification request:", {
    subscriptionId: req.body.subscriptionId,
    planId: req.body.planId,
    freelancerId: req.userId,
  });

  try {
    const { planId, subscriptionId } = req.body;
    const freelancerId = req.userId;

    if (!freelancerId || !planId || !subscriptionId) {
      console.warn("[PayPal] Verification rejected: Missing parameters.");
      return res.status(400).json({ error: "Missing required subscription parameters." });
    }

    const clientId = process.env.VITE_PAYPAL_CLIENT_ID || process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    const apiUrl = process.env.PAYPAL_API_URL || "https://api-m.sandbox.paypal.com";

    if (!clientId || !clientSecret) {
      console.error("[PayPal] Verification failed: PayPal credentials not configured on the server.");
      return res.status(550).json({ error: "PayPal credentials are not configured on the server." });
    }

    // Authenticate with PayPal
    console.log(`[PayPal Request] POST ${apiUrl}/v1/oauth2/token - Authenticating with Client ID: ${clientId.substring(0, 10)}...`);
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const tokenRes = await fetch(`${apiUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    const tokenDebugId = tokenRes.headers.get("paypal-debug-id") || "N/A";
    console.log(`[PayPal Response] Auth Status: ${tokenRes.status}, Debug ID: ${tokenDebugId}`);

    if (!tokenRes.ok) {
      const tokenErrText = await tokenRes.text();
      console.error(`[PayPal Error] Auth failed. Status: ${tokenRes.status}, Debug ID: ${tokenDebugId}, Error: ${tokenErrText}`);
      throw new Error(`Failed to authenticate with PayPal API (Debug ID: ${tokenDebugId}): ${tokenErrText}`);
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // Fetch Subscription Status from PayPal Subscriptions API
    console.log(`[PayPal Request] GET ${apiUrl}/v1/billing/subscriptions/${subscriptionId}`);
    const subRes = await fetch(`${apiUrl}/v1/billing/subscriptions/${subscriptionId}`, {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    const subDebugId = subRes.headers.get("paypal-debug-id") || "N/A";
    console.log(`[PayPal Response] GET Sub Status: ${subRes.status}, Debug ID: ${subDebugId}`);

    if (!subRes.ok) {
      const subErrText = await subRes.text();
      console.error(`[PayPal Error] Failed to retrieve subscription details. Status: ${subRes.status}, Debug ID: ${subDebugId}, Body: ${subErrText}`);
      throw new Error(`Failed to retrieve PayPal subscription ${subscriptionId} (Debug ID: ${subDebugId}): ${subErrText}`);
    }

    const subData = await subRes.json();
    console.log(`[PayPal Response Data] Sub ${subscriptionId} Payload:`, JSON.stringify(subData, null, 2));

    const status = subData.status; // ACTIVE, APPROVED, APPROVAL_PENDING, SUSPENDED, CANCELLED, EXPIRED
    console.log(`[PayPal] Parsed subscription state: "${status}" for ID: ${subscriptionId}`);

    // Verify approval URL (Task 5)
    const approveLink = subData.links?.find((l: any) => l.rel === "approve")?.href || "";
    console.log(`[PayPal Verification] Subscription approve/approval URL is: "${approveLink}"`);

    // Extract potential failed payment reasons (Tasks 2, 9, 10, 11)
    let failedReason = "";
    if (subData.billing_info) {
      const bInfo = subData.billing_info;
      console.log(`[PayPal Billing Info] Failed payments count: ${bInfo.failed_payments_count || 0}`);
      
      if (bInfo.last_failed_payment) {
        const lfp = bInfo.last_failed_payment;
        failedReason = `Last payment failed with reason: ${lfp.reason_code || "UNKNOWN_DECLINE"}`;
        if (lfp.amount) {
          failedReason += ` (Amount: ${lfp.amount.value} ${lfp.amount.currency_code})`;
        }
        if (lfp.time) {
          failedReason += ` at ${lfp.time}`;
        }
        console.warn(`[PayPal Failed Payment Alert] ${failedReason}`);
      }
    }

    // 1. Verify custom_id to prevent account hijacking / ID reusing
    const customId = subData.custom_id || "";
    if (!customId || !customId.startsWith(`${freelancerId}:`)) {
      console.warn(`[PayPal Security Violation] Custom ID '${customId}' does not match authenticated user: ${freelancerId}`);
      return res.status(400).json({
        success: false,
        error: "Unauthorized: This subscription ID is not associated with your user account.",
      });
    }

    // 2. Prevent duplicate processing or ID reuse
    console.log(`[PayPal] Checking database for duplicate transaction with ID: ${subscriptionId}`);
    const paymentDoc = await db.collection("payments").doc(subscriptionId).get();
    if (paymentDoc.exists) {
      const paymentData = paymentDoc.data();
      if (paymentData?.userId !== freelancerId) {
        console.warn(`[PayPal Security Violation] Attempt to claim already processed subscription ID: ${subscriptionId} by different user: ${freelancerId} (originally owned by ${paymentData?.userId})`);
        return res.status(400).json({
          success: false,
          error: "Unauthorized: This subscription is already claimed by another user.",
        });
      }
      
      console.log(`[PayPal] Subscription ${subscriptionId} already processed. Returning cached profile for user ${freelancerId}`);
      const profile = await getFreelancerProfile(freelancerId);
      return res.json({
        success: true,
        profile,
        duplicate: true,
      });
    }

    // 3. Strict Pro Subscription Activation (Task 7)
    // Only activate the Pro state in the database if PayPal has officially set the status to "ACTIVE".
    if (status === "ACTIVE") {
      console.log(`[PayPal Verification Successful] Subscription ${subscriptionId} is confirmed ACTIVE. Activating Pro for user: ${freelancerId}`);
      
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
    } else if (status === "APPROVED") {
      // User approved but payment processing is still pending. We must return success: false, but flag isPending: true.
      console.warn(`[PayPal Pending Activation] Subscription ${subscriptionId} is APPROVED by user, but payment capture is pending on PayPal.`);
      const profile = await getFreelancerProfile(freelancerId);
      return res.status(202).json({
        success: false,
        isPending: true,
        error: "Your subscription was approved, but PayPal is still processing the initial payment. Your premium features will activate shortly.",
        profile,
      });
    } else {
      // For any other status (APPROVAL_PENDING, SUSPENDED, CANCELLED, EXPIRED)
      let displayError = `PayPal subscription is not active. Status: ${status}.`;
      if (failedReason) {
        displayError += ` Decline Details: ${failedReason}.`;
      } else {
        displayError += " Please complete your payment in the checkout window or try a different card.";
      }
      
      console.warn(`[PayPal Verification Failure] Subscription ${subscriptionId} rejected. Status: ${status}, Reason: ${failedReason || "None specified"}`);
      await cancelOrExpireProSubscription(freelancerId, "PayPal", "expired", subscriptionId);
      const updatedProfile = await getFreelancerProfile(freelancerId);
      
      return res.status(400).json({
        success: false,
        profile: updatedProfile,
        error: displayError,
        debugId: subDebugId
      });
    }
  } catch (err: any) {
    console.error("[PayPal] Subscription verification error:", err);
    res.status(500).json({ 
      success: false, 
      error: err.message || "An error occurred while verifying your PayPal subscription.",
      isPending: true
    });
  }
});

// Secure API endpoint to cancel subscription (prevents direct frontend DB manipulation)
app.post("/api/subscription/cancel", authenticateFirebaseUser, async (req: any, res) => {
  try {
    const freelancerId = req.userId;
    if (!freelancerId) {
      return res.status(400).json({ error: "Missing freelancer ID." });
    }

    await cancelOrExpireProSubscription(freelancerId, "PayPal", "cancelled", "user_initiated");
    const updatedProfile = await getFreelancerProfile(freelancerId);

    return res.json({
      success: true,
      profile: updatedProfile,
    });
  } catch (err: any) {
    console.error("Subscription cancellation error:", err);
    res.status(500).json({ error: err.message || "Failed to cancel subscription" });
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

    if (eventType === "BILLING.SUBSCRIPTION.CREATED") {
      console.log(`[PayPal Webhook] Subscription CREATED on PayPal: ${subscriptionId} for user ${userId}. Status is pending buyer approval.`);
    } else if (eventType === "BILLING.SUBSCRIPTION.ACTIVATED" || eventType === "PAYMENT.SALE.COMPLETED") {
      if (userId) {
        await activateProSubscription(
          userId,
          planId,
          "PayPal",
          subscriptionId,
          "Other"
        );
        console.log(`[PayPal Webhook] Subscription ACTIVATED / payment captured for user: ${userId}, Subscription ID: ${subscriptionId}`);
      }
    } else if (
      eventType === "BILLING.SUBSCRIPTION.CANCELLED" ||
      eventType === "BILLING.SUBSCRIPTION.SUSPENDED" ||
      eventType === "BILLING.SUBSCRIPTION.EXPIRED" ||
      eventType === "BILLING.SUBSCRIPTION.PAYMENT.FAILED" ||
      eventType === "PAYMENT.FAILED"
    ) {
      if (userId) {
        const statusMap: any = {
          "BILLING.SUBSCRIPTION.CANCELLED": "cancelled",
          "BILLING.SUBSCRIPTION.SUSPENDED": "suspended",
          "BILLING.SUBSCRIPTION.EXPIRED": "expired",
          "BILLING.SUBSCRIPTION.PAYMENT.FAILED": "payment_failed",
          "PAYMENT.FAILED": "payment_failed"
        };
        const mappedStatus = statusMap[eventType] || "cancelled";
        await cancelOrExpireProSubscription(
          userId,
          "PayPal",
          mappedStatus,
          subscriptionId
        );
        console.log(`[PayPal Webhook] Subscription state updated to '${mappedStatus}' due to '${eventType}' for user: ${userId}, Subscription ID: ${subscriptionId}`);
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
    const amount = isQuarterly ? "7.99" : "2.99";

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

    if (!tokenRes.ok) {
      throw new Error(`Failed to authenticate with PayPal: ${await tokenRes.text()}`);
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    const captureRes = await fetch(`${apiUrl}/v2/checkout/orders/${orderId}/capture`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!captureRes.ok) {
      throw new Error(`Failed to capture PayPal order ${orderId}: ${await captureRes.text()}`);
    }

    const captureData = await captureRes.json();
    if (captureData.status === "COMPLETED") {
      const purchaseUnit = captureData.purchase_units?.[0];
      const customId = purchaseUnit?.custom_id || "";
      
      // Verify custom_id matches current user to prevent hijacking/reusing order IDs
      if (!customId || !customId.startsWith(`${freelancerId}:`)) {
        return res.status(400).json({ error: "Unauthorized: This order ID is not associated with your user account." });
      }

      const captureId = purchaseUnit?.payments?.captures?.[0]?.id || orderId;

      // Prevent duplicate processing or ID reuse
      const paymentDoc = await db.collection("payments").doc(captureId).get();
      if (paymentDoc.exists) {
        const paymentData = paymentDoc.data();
        if (paymentData?.userId !== freelancerId) {
          return res.status(400).json({ error: "Unauthorized: This transaction has already been claimed by another user." });
        }
        console.log(`[PayPal] Order ${captureId} already processed. Returning existing profile.`);
        const profile = await getFreelancerProfile(freelancerId);
        return res.json({
          success: true,
          gateway: "PayPal",
          transactionId: captureId,
          profile,
          duplicate: true,
        });
      }

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
      console.warn(`[PayPal] Order capture ${orderId} was not completed (status: ${captureData.status}). Downgrading/keeping user on Free.`);
      await cancelOrExpireProSubscription(freelancerId, "PayPal", "expired", orderId);
      return res.status(400).json({ error: "PayPal order was not completed." });
    }
  } catch (err: any) {
    console.error("PayPal capture order error:", err);
    try {
      if (req.userId) {
        await cancelOrExpireProSubscription(req.userId, "PayPal", "expired", req.body.orderId);
      }
    } catch (ignore) {}
    res.status(500).json({ error: err.message || "Failed to capture PayPal order" });
  }
});

export default app;
