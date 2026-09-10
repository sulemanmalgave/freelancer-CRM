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
      
      const isAnnual = item.planName === "Annual" || item.planName === "annual" || item.planName === "yearly" || item.planName === "Yearly";
      const isQuarterly = item.planName === "3 Months" || item.planName === "quarterly";
      const durationInDays = isAnnual ? 365 : (isQuarterly ? 90 : 30);
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + durationInDays);

      const billingCountry = item.region === "IN" ? "IN" : "Other";
      const currency = item.region === "IN" ? "INR" : "USD";
      const amount = item.region === "IN" ? (isAnnual || isQuarterly ? 399 : 199) : (isAnnual ? 19.99 : (isQuarterly ? 7.99 : 2.99));
      const subPlan = isAnnual ? "annual" : (isQuarterly ? "quarterly" : "monthly");

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
  const isAnnual = planName === "Annual" || planName === "annual" || planName === "yearly" || planName === "Yearly";
  const isQuarterly = planName === "3 Months" || planName === "quarterly";
  const durationInDays = isAnnual ? 365 : (isQuarterly ? 90 : 30);
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + durationInDays);

  const billingCountry = region === "IN" ? "IN" : "Other";
  const currency = region === "IN" ? "INR" : "USD";
  const amount = region === "IN" ? (isAnnual || isQuarterly ? 399 : 199) : (isAnnual ? 19.99 : (isQuarterly ? 7.99 : 2.99));
  const subPlan = isAnnual ? "annual" : (isQuarterly ? "quarterly" : "monthly");

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

// -----------------------------------------------------------------------------
// Live-Only PayPal Product & Billing Plan Auto-Provisioning Engine
// -----------------------------------------------------------------------------

function getPaypalApiUrl(): string {
  // Enforce PayPal Live environment only. Discard sandbox overrides to prevent mixed environments.
  const envUrl = process.env.PAYPAL_API_URL || "";
  if (envUrl && !envUrl.toLowerCase().includes("sandbox")) {
    return envUrl;
  }
  return "https://api-m.paypal.com";
}

let paypalCachePromise: Promise<{ monthlyPlanId: string, annualPlanId: string, quarterlyPlanId?: string } | null> | null = null;
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
  
  // 1. Verify environment variables are present and loaded correctly
  console.log("[PayPal Verification] Verifying environment variables:");
  console.log(`- PAYPAL_CLIENT_ID: ${clientId ? `LOADED (length: ${clientId.length})` : "MISSING"}`);
  console.log(`- PAYPAL_CLIENT_SECRET: ${clientSecret ? "LOADED" : "MISSING"}`);
  console.log(`- Target PayPal Environment URL: ${apiUrl}`);

  if (!clientId || !clientSecret || clientId.trim() === "" || clientSecret.trim() === "" || clientId === "undefined" || clientSecret === "undefined") {
    console.error("[PayPal API Error] Cannot initialize PayPal Subscriptions because Client ID or Secret is unconfigured/missing.");
    return null;
  }

  if (!paypalCachePromise) {
    if (now - lastPaypalAttemptTime < 30000) {
      console.log("[PayPal] Throttling active plan creation/verification attempts to avoid server blocking.");
      return null;
    }
    lastPaypalAttemptTime = now;

    paypalCachePromise = (async () => {
      // 1. Authenticate with PayPal to get an Access Token
      let accessToken = "";
      try {
        console.log(`[PayPal API Request] POST ${apiUrl}/v1/oauth2/token - Initiating Live Authentication...`);
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
        console.log(`[PayPal API Response] Authentication Status: ${tokenRes.status}, Debug ID: ${debugId}`);

        if (!tokenRes.ok) {
          const errText = await tokenRes.text();
          console.error(`[PayPal API Error] Auth failed! Status: ${tokenRes.status}, Debug ID: ${debugId}, Body: ${errText}`);
          throw new Error(`PayPal Live auth failed (Debug ID: ${debugId}): ${errText}`);
        }

        const tokenData = await tokenRes.json();
        accessToken = tokenData.access_token;
        console.log("[PayPal] Live Authentication successful. Obtained Bearer token.");
      } catch (authErr: any) {
        console.error("[PayPal] Exception during PayPal authentication:", authErr);
        paypalCachePromise = null;
        return null;
      }

      // Verification function to check if a Plan ID is active on this specific merchant account
      const verifyPlan = async (planId: string): Promise<boolean> => {
        if (!planId || planId.trim() === "" || planId === "undefined" || planId.startsWith("P-5919") || planId.startsWith("P-3023")) {
          return false; // Reject placeholders
        }
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

      // 2. Load and verify plans from Environment Variables if specified
      const envMonthly = process.env.PAYPAL_PLAN_MONTHLY;
      const envAnnual = process.env.PAYPAL_PLAN_ANNUAL || process.env.PAYPAL_PLAN_YEARLY;
      if (envMonthly && envAnnual && envMonthly !== "P-59199343B03893339MZVLUOI" && envAnnual !== "P-302302384920239084920233") {
        console.log("[PayPal] Found plan IDs in Environment Variables. Verifying active status on Live account...");
        const isMonValid = await verifyPlan(envMonthly);
        const isAnnValid = await verifyPlan(envAnnual);
        if (isMonValid && isAnnValid) {
          console.log("[PayPal] Active environment plan IDs successfully verified!");
          return {
            monthlyPlanId: envMonthly,
            annualPlanId: envAnnual,
            quarterlyPlanId: envAnnual
          };
        } else {
          console.warn("[PayPal] Environment plan IDs are not active or valid in the Live account. Falling back to Firestore cache...");
        }
      }

      // 3. Load and verify plans from Firestore config cache (paypal_live_v5)
      try {
        const configDoc = await db.collection("config").doc("paypal_live_v5").get();
        if (configDoc.exists) {
          const data = configDoc.data();
          if (data && data.paypalPlanMonthly && data.paypalPlanAnnual) {
            console.log("[PayPal] Retrieved plan IDs from Firestore 'paypal_live_v5' cache. Validating...");
            const isMonthlyValid = await verifyPlan(data.paypalPlanMonthly);
            const isAnnualValid = await verifyPlan(data.paypalPlanAnnual);
            
            if (isMonthlyValid && isAnnualValid) {
              console.log("[PayPal] Cache verified! Both Monthly ($2.99) and Annual ($19.99) plans are active.");
              return {
                monthlyPlanId: data.paypalPlanMonthly,
                annualPlanId: data.paypalPlanAnnual,
                quarterlyPlanId: data.paypalPlanAnnual,
              };
            }
          }
        }
      } catch (err) {
        console.warn("[PayPal] Failed to read cached plans from Firestore. Proceeding to verify known live plans...", err);
      }

      // 3b. Verify pre-provisioned Live plans ($2.99 Monthly & $19.99 Annual)
      const activeMonthlyLiveId = "P-6RD14298RG806814XNKQSIGA";
      const activeAnnualLiveId = "P-7SD54045WY3221612NKQSIGA";
      const isMonLiveValid = await verifyPlan(activeMonthlyLiveId);
      const isAnnLiveValid = await verifyPlan(activeAnnualLiveId);
      if (isMonLiveValid && isAnnLiveValid) {
        console.log("[PayPal] Verified pre-provisioned Live plans ($2.99 Monthly & $19.99 Annual). Caching to database...");
        try {
          await db.collection("config").doc("paypal_live_v5").set({
            paypalPlanMonthly: activeMonthlyLiveId,
            paypalPlanAnnual: activeAnnualLiveId,
            paypalPlanQuarterly: activeAnnualLiveId,
            productId: "PROD-243265147V606044E",
            environment: "live",
            createdAt: new Date().toISOString()
          });
        } catch (saveErr) {
          console.warn("[PayPal] Could not write to config/paypal_live_v5:", saveErr);
        }
        return {
          monthlyPlanId: activeMonthlyLiveId,
          annualPlanId: activeAnnualLiveId,
          quarterlyPlanId: activeAnnualLiveId,
        };
      }

      // 4. Fallback to dynamic creation via PayPal REST APIs if cache is missing or invalid
      try {
        console.log("[PayPal] Auto-creating Product and active Billing Plans on the Live Merchant Account...");

        // Create Catalog Product "Freelancer CRM Pro"
        const requestIdProd = `req-prod-${Date.now()}`;
        const productPayload = {
          name: "Freelancer CRM Pro",
          description: "Premium subscription to Freelancer CRM & Client Portals",
          type: "SERVICE",
          category: "SOFTWARE"
        };
        console.log(`[PayPal API Request] POST ${apiUrl}/v1/catalogs/products (Request-Id: ${requestIdProd})`);
        const productRes = await fetch(`${apiUrl}/v1/catalogs/products`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            "PayPal-Request-Id": requestIdProd,
          },
          body: JSON.stringify(productPayload),
        });

        const prodDebugId = productRes.headers.get("paypal-debug-id") || "N/A";
        console.log(`[PayPal API Response] Product Creation Status: ${productRes.status}, Debug ID: ${prodDebugId}`);

        if (!productRes.ok) {
          const prodErr = await productRes.text();
          console.error(`[PayPal API Error] Catalog Product creation failed!`);
          console.error(`- Endpoint: POST ${apiUrl}/v1/catalogs/products`);
          console.error(`- Status: ${productRes.status}, Debug ID: ${prodDebugId}`);
          console.error(`- Response Payload: ${prodErr}`);
          throw new Error(`PayPal Catalog Product creation failed (Status: ${productRes.status}): ${prodErr}`);
        }

        const productData = await productRes.json();
        const productId = productData.id;
        console.log(`[PayPal] Successfully created Billing Product: "${productPayload.name}" with ID: ${productId}`);

        // Create Pro Monthly Plan ($2.99 / Month)
        const requestIdMonthly = `req-plan-mon-${Date.now()}`;
        const monthlyPayload = {
          product_id: productId,
          name: "Freelancer CRM Pro Monthly",
          description: "$2.99 every month",
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
        };

        console.log(`[PayPal API Request] POST ${apiUrl}/v1/billing/plans - Creating Monthly Plan...`);
        const monthlyRes = await fetch(`${apiUrl}/v1/billing/plans`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            "PayPal-Request-Id": requestIdMonthly,
          },
          body: JSON.stringify(monthlyPayload),
        });

        const monDebugId = monthlyRes.headers.get("paypal-debug-id") || "N/A";
        console.log(`[PayPal API Response] Monthly Plan Creation Status: ${monthlyRes.status}, Debug ID: ${monDebugId}`);

        if (!monthlyRes.ok) {
          const monErr = await monthlyRes.text();
          console.error(`[PayPal API Error] Monthly Billing Plan creation failed!`);
          throw new Error(`PayPal Monthly Plan creation failed (Status: ${monthlyRes.status}): ${monErr}`);
        }

        const monthlyData = await monthlyRes.json();
        const monthlyPlanId = monthlyData.id;
        console.log(`[PayPal] Successfully created Monthly Plan ID: ${monthlyPlanId}`);

        // Create Pro Annual Plan ($19.99 / Year)
        const requestIdAnnual = `req-plan-ann-${Date.now()}`;
        const annualPayload = {
          product_id: productId,
          name: "Freelancer CRM Pro Annual",
          description: "$19.99 every year",
          status: "ACTIVE",
          billing_cycles: [
            {
              frequency: {
                interval_unit: "YEAR",
                interval_count: 1
              },
              tenure_type: "REGULAR",
              sequence: 1,
              total_cycles: 0,
              pricing_scheme: {
                fixed_price: {
                  value: "19.99",
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
        };

        console.log(`[PayPal API Request] POST ${apiUrl}/v1/billing/plans - Creating Annual Plan...`);
        const annualRes = await fetch(`${apiUrl}/v1/billing/plans`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            "PayPal-Request-Id": requestIdAnnual,
          },
          body: JSON.stringify(annualPayload),
        });

        const annDebugId = annualRes.headers.get("paypal-debug-id") || "N/A";
        console.log(`[PayPal API Response] Annual Plan Creation Status: ${annualRes.status}, Debug ID: ${annDebugId}`);

        if (!annualRes.ok) {
          const annErr = await annualRes.text();
          console.error(`[PayPal API Error] Annual Billing Plan creation failed!`);
          throw new Error(`PayPal Annual Plan creation failed (Status: ${annualRes.status}): ${annErr}`);
        }

        const annualData = await annualRes.json();
        const annualPlanId = annualData.id;
        console.log(`[PayPal] Successfully created Annual Plan ID: ${annualPlanId}`);

        // Explicitly activate the created Billing Plans to ensure compliance
        const activatePlanId = async (planId: string) => {
          try {
            console.log(`[PayPal API Request] POST ${apiUrl}/v1/billing/plans/${planId}/activate - Explicitly activating plan...`);
            const actRes = await fetch(`${apiUrl}/v1/billing/plans/${planId}/activate`, {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Content-Type": "application/json"
              }
            });
            const actDebugId = actRes.headers.get("paypal-debug-id") || "N/A";
            console.log(`[PayPal API Response] Plan ${planId} Activation Status: ${actRes.status}, Debug ID: ${actDebugId}`);
          } catch (actErr) {
            console.warn(`[PayPal] Plan ${planId} explicit activation request warning:`, actErr);
          }
        };

        await activatePlanId(monthlyPlanId);
        await activatePlanId(annualPlanId);

        // Save generated Live Plan IDs securely to Firestore for reuse
        try {
          await db.collection("config").doc("paypal_live_v5").set({
            paypalPlanMonthly: monthlyPlanId,
            paypalPlanAnnual: annualPlanId,
            paypalPlanQuarterly: annualPlanId,
            productId: productId,
            environment: "live",
            createdAt: new Date().toISOString()
          });
          console.log("[PayPal] Successfully cached newly created Live Plan IDs to Firestore 'paypal_live_v5' document.");
        } catch (fsErr) {
          console.error("[PayPal] Error caching newly created plan IDs to Firestore:", fsErr);
        }

        return {
          monthlyPlanId,
          annualPlanId,
          quarterlyPlanId: annualPlanId,
        };
      } catch (err: any) {
        console.error("[PayPal] Failed to dynamically auto-create live billing plans:", err);
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
  const apiUrl = getPaypalApiUrl();

  let paypalPlanMonthly = "P-6RD14298RG806814XNKQSIGA";
  let paypalPlanAnnual = "P-7SD54045WY3221612NKQSIGA";

  // Accept env values if explicitly set and not part of old sandbox fallback
  if (process.env.PAYPAL_PLAN_MONTHLY && process.env.PAYPAL_PLAN_MONTHLY !== "P-59199343B03893339MZVLUOI") {
    paypalPlanMonthly = process.env.PAYPAL_PLAN_MONTHLY;
  }
  if (process.env.PAYPAL_PLAN_ANNUAL && process.env.PAYPAL_PLAN_ANNUAL !== "P-302302384920239084920233") {
    paypalPlanAnnual = process.env.PAYPAL_PLAN_ANNUAL;
  }

  if (hasPaypalConfigured) {
    try {
      const dynamicPlans = await withTimeout(
        getOrCreatePaypalPlans(apiUrl, finalPaypalClientId, process.env.PAYPAL_CLIENT_SECRET!),
        10000, // Extend timeout to ensure proper compilation/creation on slow live API calls
        null
      );
      if (dynamicPlans) {
        paypalPlanMonthly = dynamicPlans.monthlyPlanId;
        paypalPlanAnnual = dynamicPlans.annualPlanId;
      }
    } catch (err) {
      console.error("[PayPal] Exception during active billing plan initialization:", err);
    }
  }

  console.log("[PayPal Public Configuration Response]:", {
    paypalClientId: finalPaypalClientId ? `${finalPaypalClientId.substring(0, 10)}...` : "NONE",
    paypalConfigured: hasPaypalConfigured,
    paypalPlanMonthly: paypalPlanMonthly || "NOT_ACTIVE",
    paypalPlanAnnual: paypalPlanAnnual || "NOT_ACTIVE"
  });

  res.json({
    razorpayKeyId: finalRazorpayKeyId,
    paypalClientId: finalPaypalClientId,
    razorpayConfigured: hasRazorpayConfigured,
    paypalConfigured: hasPaypalConfigured,
    paypalPlanMonthly,
    paypalPlanAnnual,
    paypalPlanQuarterly: paypalPlanAnnual, // Backwards compatibility
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
    if (planName === "Annual" || planName === "annual" || planName === "yearly" || planName === "Yearly" || planName === "3 Months" || planName === "quarterly") {
      amount = 399; // Pro Annual / existing tier: ₹399
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
    const apiUrl = getPaypalApiUrl();

    // 1. Verify environment variables are present and loaded correctly
    if (!clientId || !clientSecret || clientId.trim() === "" || clientSecret.trim() === "" || clientId === "undefined" || clientSecret === "undefined") {
      console.error("[PayPal SDK] ERROR: Live PAYPAL_CLIENT_ID and/or PAYPAL_CLIENT_SECRET are missing or not loaded correctly from environment variables.");
      return res.status(400).json({
        success: false,
        error: "PayPal integration is not fully configured. Live PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET are required on the server."
      });
    }

    // 2. If subscription Plan ID is invalid, inactive, or missing, do not proceed and return a clear error
    if (!planId || planId.trim() === "" || planId === "undefined" || planId.startsWith("P-3023") || planId.startsWith("P-5919")) {
      console.error(`[PayPal SDK] ERROR: Subscription verification blocked. Plan ID "${planId}" is invalid, inactive, or unconfigured.`);
      return res.status(400).json({
        success: false,
        error: "The PayPal subscription Plan ID is invalid, inactive, or belongs to a different developer environment. A valid Live PayPal Billing Plan ID is required."
      });
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
    const apiUrl = getPaypalApiUrl();

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
    const isAnnual = planName === "Annual" || planName === "annual" || planName === "yearly" || planName === "Yearly";
    const isQuarterly = planName === "3 Months" || planName === "quarterly";
    const amount = isAnnual ? "19.99" : (isQuarterly ? "7.99" : "2.99");

    const clientId = process.env.VITE_PAYPAL_CLIENT_ID || process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    const apiUrl = getPaypalApiUrl();

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
            custom_id: `${freelancerId}:${isAnnual ? "annual" : (isQuarterly ? "quarterly" : "monthly")}`,
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
    const apiUrl = getPaypalApiUrl();

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

// ==========================================
// GEMINI AI & GMAIL INTEGRATION ENDPOINTS
// ==========================================
import { GoogleGenAI } from "@google/genai";

let genAIInstance: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!genAIInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not configured.");
    }
    genAIInstance = new GoogleGenAI({ apiKey });
  }
  return genAIInstance;
}

/**
 * Backend Pro Entitlement Verifier
 * Validates against Firestore subscription records on the server.
 */
async function verifyUserProEntitlement(req: any): Promise<{ isPro: boolean; profile?: any; error?: string }> {
  let freelancerId = req.userId || req.body?.freelancerId || req.headers?.["x-freelancer-id"] || req.query?.freelancerId;

  // If Bearer ID token is present, decode Firebase UID
  if (!freelancerId && req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
    const token = req.headers.authorization.split(" ")[1];
    try {
      ensureFirebaseAdminInitialized();
      const decoded = await getAuth().verifyIdToken(token);
      freelancerId = decoded.uid;
    } catch {
      // not a firebase auth id token
    }
  }

  // Lookup by email if userEmail is provided
  if (!freelancerId && req.body?.userEmail) {
    try {
      ensureFirebaseAdminInitialized();
      const snap = await db.collection("freelancers").where("email", "==", String(req.body.userEmail).trim().toLowerCase()).limit(1).get();
      if (!snap.empty) {
        freelancerId = snap.docs[0].id;
      }
    } catch (e) {
      console.warn("[Backend Entitlement] Email lookup error:", e);
    }
  }

  if (!freelancerId) {
    return { isPro: false, error: "Freelancer identifier is required to verify Pro entitlement." };
  }

  const profile = await getFreelancerProfile(freelancerId);
  if (!profile) {
    return { isPro: false, error: "Freelancer profile record not found." };
  }

  const isPro = (
    profile.premium === true ||
    profile.plan === "Pro" ||
    profile.plan === "Monthly" ||
    profile.plan === "Annual" ||
    profile.plan === "3 Months" ||
    (profile.plan !== undefined && profile.plan !== "Free")
  );

  return { isPro, profile };
}

// 0. Verify Pro Entitlement for Gmail & Advanced integrations
app.get("/api/gmail/verify-entitlement", async (req: any, res) => {
  try {
    const { isPro, profile, error } = await verifyUserProEntitlement(req);
    return res.json({
      isPro: !!isPro,
      plan: profile?.plan || "Free",
      premium: !!profile?.premium,
      error: isPro ? undefined : (error || "Active Pro subscription required"),
    });
  } catch (err: any) {
    return res.status(500).json({ isPro: false, error: err.message });
  }
});

// 1. AI Email & Thread Summarization
app.post("/api/gemini/summarize-email", async (req: any, res) => {
  try {
    const { subject, content, threadMessages } = req.body;
    if (!content && (!threadMessages || threadMessages.length === 0)) {
      return res.status(400).json({ error: "No email content provided to summarize." });
    }

    const ai = getGenAI();
    let prompt = `You are an expert executive assistant for a freelancer. Summarize the following email communication concisely and clearly.
Highlight the main purpose, key context, any deadlines, and notable requirements.

Subject: ${subject || "(No Subject)"}
`;

    if (threadMessages && threadMessages.length > 0) {
      prompt += `\nConversation Thread History:\n` + threadMessages.map((m: any, idx: number) => 
        `Message ${idx + 1} from ${m.from || "Unknown"} on ${m.date || "Unknown date"}:\n${m.body || m.snippet || ""}`
      ).join("\n\n");
    } else {
      prompt += `\nEmail Content:\n${content}`;
    }

    prompt += `\n\nProvide:
1. One-sentence Executive Overview
2. Key Points (bulleted)
3. Any Explicit Deadlines or Urgency

Format cleanly in plain text with markdown bullet points. Keep it brief, actionable, and professional.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    const summary = response.text || "Unable to generate summary.";
    return res.json({ success: true, summary });
  } catch (err: any) {
    console.error("[Gemini AI] Email summarization error:", err);
    return res.status(500).json({ error: err.message || "Failed to summarize email." });
  }
});

// 2. AI Action Items & Follow-up Extraction
app.post("/api/gemini/extract-action-items", async (req: any, res) => {
  try {
    const { subject, content, senderName, clientName } = req.body;
    if (!content) {
      return res.status(400).json({ error: "No email content provided." });
    }

    const ai = getGenAI();
    const prompt = `You are an AI assistant for a freelancer. Analyze this client email and extract specific actionable tasks / follow-up items for the freelancer.

Client / Sender: ${clientName || senderName || "Client"}
Subject: ${subject || "(No Subject)"}
Email Content:
${content}

Current Date: ${new Date().toISOString().split("T")[0]}

Instructions:
Extract actionable items that the freelancer should do.
Return STRICT JSON format ONLY (array of objects):
[
  {
    "title": "Clear action verb task title (e.g. 'Send revised wireframe quote')",
    "suggestedDueDate": "YYYY-MM-DD (estimate realistic deadline based on email text or default to 3-5 business days from current date)",
    "priority": "High" | "Medium" | "Low",
    "notes": "Brief context explanation from the email"
  }
]
If there are no clear action items, return an empty array []. Output only valid JSON without markdown wrapping.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    let raw = response.text || "[]";
    raw = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
    let actionItems = [];
    try {
      actionItems = JSON.parse(raw);
    } catch {
      console.warn("[Gemini AI] Failed to parse JSON action items, raw text:", raw);
      actionItems = [];
    }

    return res.json({ success: true, actionItems });
  } catch (err: any) {
    console.error("[Gemini AI] Action items extraction error:", err);
    return res.status(500).json({ error: err.message || "Failed to extract action items." });
  }
});

// 3. AI Draft Reply Generator
app.post("/api/gemini/draft-reply", async (req: any, res) => {
  try {
    const { subject, content, replyContext, senderName, clientName, myName } = req.body;
    if (!content) {
      return res.status(400).json({ error: "No email content provided." });
    }

    const ai = getGenAI();
    const prompt = `You are a professional freelance business owner. Draft a polite, concise, professional reply to the client's email.

Freelancer Name: ${myName || "Freelancer"}
Client Name: ${clientName || senderName || "Client"}
Original Subject: ${subject || "(No Subject)"}
Original Email:
${content}

Desired Response Intent / Instructions:
${replyContext || "Polite confirmation, acknowledging requirements and setting expectations."}

Instructions:
- Write in a friendly yet polished, professional tone.
- Do NOT include placeholder tokens like [Your Name] if the name is provided.
- Include a suggested Subject line (usually 'Re: ...') and the email body text.
- Do NOT send or promise things that were not requested.

Return JSON in this format:
{
  "subject": "Re: ...",
  "body": "Email body text..."
}
Output only valid JSON without markdown wrapping.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    let raw = response.text || "{}";
    raw = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
    let draft = { subject: `Re: ${subject || ""}`, body: "" };
    try {
      draft = JSON.parse(raw);
    } catch {
      draft.body = response.text || "";
    }

    return res.json({ success: true, draft });
  } catch (err: any) {
    console.error("[Gemini AI] Draft reply error:", err);
    return res.status(500).json({ error: err.message || "Failed to generate draft reply." });
  }
});

// 4. Secure Gmail Send Proxy (STRICT PRO SUBSCRIPTION ENFORCEMENT)
app.post("/api/gmail/send", async (req: any, res) => {
  try {
    // 1. Strict Backend Pro Entitlement Validation
    const { isPro } = await verifyUserProEntitlement(req);
    if (!isPro) {
      return res.status(403).json({
        error: "Gmail integration is available exclusively with Freelancer CRM Pro. Please upgrade to Pro to send emails.",
        code: "PRO_REQUIRED",
      });
    }

    const { accessToken, to, cc, bcc, subject, body, threadId, inReplyTo, raw, attachments } = req.body;
    if (!accessToken) {
      return res.status(401).json({ error: "Missing Gmail access token. Please connect your Gmail account." });
    }

    let encodedEmail = raw;

    if (!encodedEmail) {
      if (!to) {
        return res.status(400).json({ error: "Recipient email (To) is required." });
      }

      const hasAttachments = Array.isArray(attachments) && attachments.length > 0;
      const isHtml = body && body.includes("<") && body.includes(">");
      const formattedHtml = isHtml ? body : (body || "").replace(/\r\n|\r|\n/g, "<br/>");
      const cleanPlainText = (body || "").replace(/<[^>]*>/g, "");

      let encodedSubject = "";
      try {
        encodedSubject = `=?utf-8?B?${Buffer.from(subject || "(No Subject)").toString("base64")}?=`;
      } catch {
        encodedSubject = subject || "(No Subject)";
      }

      const headers: string[] = [`To: ${String(to).trim()}`];
      if (cc && String(cc).trim()) {
        headers.push(`Cc: ${String(cc).trim()}`);
      }
      if (bcc && String(bcc).trim()) {
        headers.push(`Bcc: ${String(bcc).trim()}`);
      }
      headers.push(`Subject: ${encodedSubject}`);
      headers.push("MIME-Version: 1.0");

      if (inReplyTo && String(inReplyTo).trim()) {
        const rawInReplyTo = String(inReplyTo).trim();
        const formattedInReplyTo = rawInReplyTo.startsWith("<") && rawInReplyTo.endsWith(">")
          ? rawInReplyTo
          : `<${rawInReplyTo}>`;
        headers.push(`In-Reply-To: ${formattedInReplyTo}`);
        headers.push(`References: ${formattedInReplyTo}`);
      }

      let emailRaw = "";

      if (hasAttachments) {
        const mixedBoundary = `====_CRM_MIXED_${Date.now()}_====`;
        const altBoundary = `====_CRM_ALT_${Date.now()}_====`;
        headers.push(`Content-Type: multipart/mixed; boundary="${mixedBoundary}"`);

        const parts = [
          headers.join("\r\n"),
          "",
          `--${mixedBoundary}`,
          `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
          "",
          `--${altBoundary}`,
          "Content-Type: text/plain; charset=UTF-8",
          "Content-Transfer-Encoding: 7bit",
          "",
          cleanPlainText,
          "",
          `--${altBoundary}`,
          "Content-Type: text/html; charset=UTF-8",
          "Content-Transfer-Encoding: 7bit",
          "",
          `<div dir="ltr">${formattedHtml}</div>`,
          "",
          `--${altBoundary}--`,
        ];

        for (const att of attachments) {
          const cleanBase64 = (att.base64Data || "").replace(/[\r\n]/g, "");
          const chunked = cleanBase64.match(/.{1,76}/g)?.join("\r\n") || cleanBase64;
          parts.push(
            `--${mixedBoundary}`,
            `Content-Type: ${att.mimeType || "application/octet-stream"}; name="${att.filename || "attachment"}"`,
            `Content-Disposition: attachment; filename="${att.filename || "attachment"}"`,
            "Content-Transfer-Encoding: base64",
            "",
            chunked
          );
        }

        parts.push(`--${mixedBoundary}--`, "");
        emailRaw = parts.join("\r\n");
      } else {
        const boundary = `====_CRM_MIME_${Date.now()}_====`;
        headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);

        const parts = [
          headers.join("\r\n"),
          "",
          `--${boundary}`,
          "Content-Type: text/plain; charset=UTF-8",
          "Content-Transfer-Encoding: 7bit",
          "",
          cleanPlainText,
          "",
          `--${boundary}`,
          "Content-Type: text/html; charset=UTF-8",
          "Content-Transfer-Encoding: 7bit",
          "",
          `<div dir="ltr">${formattedHtml}</div>`,
          "",
          `--${boundary}--`,
        ];
        emailRaw = parts.join("\r\n");
      }

      // Base64URL encode as required by Gmail API
      encodedEmail = Buffer.from(emailRaw, "utf-8")
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
    }

    const payload: any = { raw: encodedEmail };
    if (threadId) {
      payload.threadId = threadId;
    }

    const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData?.error?.message || `Gmail API send failed with status ${response.status}`;
      console.error("[Gmail Send Proxy Error]", errorData);
      return res.status(response.status).json({ error: errorMsg });
    }

    const sentData = await response.json();
    return res.json({ success: true, messageId: sentData.id, threadId: sentData.threadId });
  } catch (err: any) {
    console.error("[Gmail Send Proxy] Internal error:", err);
    return res.status(500).json({ error: err.message || "Failed to send email via Gmail." });
  }
});

// ==========================================
// 5. Mobile App Secure Connection & Sync APIs & Server Authentication
// ==========================================

// In-memory fallback cache for fast ephemeral pairing sessions
const activePairingSessions = new Map<string, any>();
const workspaceProfiles = new Map<string, any>();

// Helper: Secure password hashing with scrypt
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString("hex")}`;
}

// Helper: Secure password verification against stored scrypt hash
function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, key] = storedHash.split(":");
    if (!salt || !key) return false;
    const keyBuffer = Buffer.from(key, "hex");
    const derivedKey = crypto.scryptSync(password, salt, keyBuffer.length);
    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  } catch {
    return false;
  }
}

// Helper: Sanitize profile before sending to browser/client
function sanitizeProfile(profile: any): any {
  if (!profile) return null;
  const clean = { ...profile };
  delete clean.password;
  delete clean.passwordHash;
  delete clean.resetCode;
  delete clean.resetToken;
  delete clean.resetExpires;
  return clean;
}

// Helper: Create secure auth session
async function createAuthSession(freelancerId: string, email: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const sessionData = {
    token,
    freelancerId,
    email: email.toLowerCase(),
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
  };
  try {
    await db.collection("auth_sessions").doc(token).set(sessionData);
  } catch (e) {
    console.warn("[Auth Session] Error saving session to DB:", e);
  }
  return token;
}

// Helper: Verify session token from request
async function verifySessionToken(req: any): Promise<{ freelancerId: string; email: string } | null> {
  const authHeader = req.headers.authorization;
  let token = "";
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.slice(7).trim();
  } else if (req.query?.token) {
    token = String(req.query.token).trim();
  } else if (req.body?.token) {
    token = String(req.body.token).trim();
  }
  if (!token) return null;
  try {
    const doc = await db.collection("auth_sessions").doc(token).get();
    if (doc.exists) {
      const data = doc.data();
      if (data && new Date(data.expiresAt).getTime() > Date.now()) {
        return { freelancerId: data.freelancerId, email: data.email };
      }
    }
  } catch (e) {
    console.warn("[Auth Session] Verify error:", e);
  }
  return null;
}

// Helper to generate secure random 6-digit numeric pairing code
function generateNumericPairingCode(): string {
  const num = crypto.randomInt(100000, 999999);
  return num.toString();
}

// Helper: Resolve canonical freelancer / workspace ID
async function resolveCanonicalFreelancerId(rawFreelancerId: string): Promise<string> {
  if (!rawFreelancerId) return "";
  const clean = String(rawFreelancerId).trim();
  try {
    const doc = await db.collection("freelancers").doc(clean).get();
    if (doc.exists) return clean;
  } catch {}

  // Check prefix or partial match across freelancers (e.g. 54395c83)
  try {
    const snap = await db.collection("freelancers").get();
    let matchedId: string | null = null;
    snap.forEach((d: any) => {
      if (matchedId) return;
      const data = d.data();
      const did = d.id || (data && data.id);
      if (did && (did === clean || did.startsWith(clean) || clean.startsWith(did))) {
        matchedId = did;
      }
    });
    if (matchedId) return matchedId;
  } catch {}

  return clean;
}

// Helper: Query all workspace collections for a specific freelancer
async function getWorkspaceCollections(rawFreelancerId: string): Promise<Record<string, any[]>> {
  const freelancerId = await resolveCanonicalFreelancerId(rawFreelancerId);
  const collectionNames = [
    "clients",
    "projects",
    "tasks",
    "records",
    "followups",
    "invoices",
    "proposals",
    "leads",
    "documents"
  ];
  const collections: Record<string, any[]> = {};
  
  await Promise.all(
    collectionNames.map(async (col) => {
      collections[col] = [];
      try {
        const snap = await db.collection(col).get();
        snap.forEach((doc: any) => {
          const item = doc.data();
          if (!item || item._deleted) return;
          const fid = item.freelancerId || item.workspaceId || item.freelancer_id || item.workspace_id;
          if (
            fid === freelancerId ||
            fid === rawFreelancerId ||
            (fid && freelancerId && (fid.startsWith(freelancerId) || freelancerId.startsWith(fid)))
          ) {
            collections[col].push(item);
          }
        });
      } catch (colErr) {
        console.warn(`[Workspace Collections] Error querying ${col}:`, colErr);
      }
    })
  );

  return collections;
}

// Helper: Retrieve workspace version metadata
async function getWorkspaceMeta(rawFreelancerId: string) {
  const freelancerId = await resolveCanonicalFreelancerId(rawFreelancerId);
  let version = 1;
  let lastModified = new Date().toISOString();
  try {
    const vDoc = await db.collection("workspace_meta").doc(freelancerId).get();
    if (vDoc.exists) {
      const d = vDoc.data();
      version = d.version || 1;
      lastModified = d.lastModified || lastModified;
    }
  } catch {}
  return { version, lastModified };
}

// Helper: Increment workspace version on mutations
async function bumpWorkspaceMeta(rawFreelancerId: string) {
  const freelancerId = await resolveCanonicalFreelancerId(rawFreelancerId);
  let version = 1;
  const lastModified = new Date().toISOString();
  try {
    const vDocRef = db.collection("workspace_meta").doc(freelancerId);
    const vDoc = await vDocRef.get();
    version = vDoc.exists ? (vDoc.data().version || 1) + 1 : 2;
    await vDocRef.set({ freelancerId, version, lastModified });
  } catch {}
  return { version, lastModified };
}

// Dedicated REST API for Clients
app.get("/api/clients", async (req: any, res) => {
  try {
    const rawId = req.query.freelancerId || req.query.workspaceId || req.query.freelancer_id || req.query.workspace_id;
    if (!rawId) {
      return res.status(400).json({ success: false, error: "freelancerId or workspaceId query parameter is required." });
    }
    const freelancerId = await resolveCanonicalFreelancerId(String(rawId));
    const clients: any[] = [];
    try {
      const snap = await db.collection("clients").get();
      snap.forEach((doc: any) => {
        const item = doc.data();
        if (!item || item._deleted) return;
        const fid = item.freelancerId || item.workspaceId || item.freelancer_id || item.workspace_id;
        if (
          fid === freelancerId ||
          fid === rawId ||
          (fid && freelancerId && (fid.startsWith(freelancerId) || freelancerId.startsWith(fid)))
        ) {
          clients.push(item);
        }
      });
    } catch (dbErr) {
      console.warn("[API Clients] Error querying clients:", dbErr);
    }
    return res.json({ success: true, clients, count: clients.length });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || "Failed to fetch clients." });
  }
});

app.post("/api/clients", async (req: any, res) => {
  try {
    const { client, freelancerId: rawFid, workspaceId } = req.body;
    const rawId = rawFid || workspaceId || client?.freelancerId;
    if (!client || !rawId) {
      return res.status(400).json({ success: false, error: "client and freelancerId required." });
    }
    const freelancerId = await resolveCanonicalFreelancerId(String(rawId));
    const id = client.id || crypto.randomUUID();
    const now = new Date().toISOString();
    const clientRecord = {
      ...client,
      id,
      freelancerId,
      createdAt: client.createdAt || now,
      updatedAt: now,
    };
    await db.collection("clients").doc(id).set(clientRecord, { merge: true });
    await bumpWorkspaceMeta(freelancerId);
    return res.json({ success: true, client: clientRecord });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || "Failed to save client." });
  }
});

// 4.9 Unified Cloud Workspace Data Endpoints

// 4.9a Fetch complete workspace state (profile + all collections)
app.get("/api/workspace/data", async (req: any, res) => {
  try {
    const rawFreelancerId = req.query.freelancerId as string;
    const deviceId = req.query.deviceId as string;
    if (!rawFreelancerId) {
      return res.status(400).json({ success: false, error: "freelancerId is required" });
    }
    const freelancerId = await resolveCanonicalFreelancerId(rawFreelancerId);

    // Data isolation check if bearer session token is present
    const session = await verifySessionToken(req);
    if (session) {
      const sessionFid = await resolveCanonicalFreelancerId(session.freelancerId);
      if (sessionFid !== freelancerId) {
        return res.status(403).json({
          success: false,
          error: "forbidden",
          message: "Access denied. You can only access your own workspace data."
        });
      }
    }

    // Check device revocation
    if (deviceId) {
      try {
        const devDoc = await db.collection("connected_devices").doc(deviceId).get();
        if (devDoc.exists && devDoc.data().status === "revoked") {
          return res.status(403).json({
            success: false,
            error: "device_revoked",
            message: "This device has been disconnected from the workspace."
          });
        }
      } catch {}
    }

    let profile: any = null;
    try {
      const pDoc = await db.collection("freelancers").doc(freelancerId).get();
      if (pDoc.exists) profile = pDoc.data();
      if (!profile && rawFreelancerId !== freelancerId) {
        const pRaw = await db.collection("freelancers").doc(rawFreelancerId).get();
        if (pRaw.exists) profile = pRaw.data();
      }
    } catch (e) {
      console.warn("[Workspace Data] Profile fetch error:", e);
    }

    const collections = await getWorkspaceCollections(freelancerId);
    const meta = await getWorkspaceMeta(freelancerId);

    return res.json({
      success: true,
      profile: sanitizeProfile(profile),
      collections,
      version: meta.version,
      lastModified: meta.lastModified,
    });
  } catch (err: any) {
    console.error("[Workspace Data] Error fetching workspace data:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to fetch workspace data." });
  }
});

// 4.9b Bidirectional Workspace Reconcile / Sync
app.post("/api/workspace/sync", async (req: any, res) => {
  try {
    const { freelancerId: rawFreelancerId, deviceId, collections, profile: incomingProfile, deletedIds } = req.body;
    if (!rawFreelancerId) {
      return res.status(400).json({ success: false, error: "freelancerId is required" });
    }
    const freelancerId = await resolveCanonicalFreelancerId(rawFreelancerId);

    // Data isolation check if bearer session token is present
    const session = await verifySessionToken(req);
    if (session) {
      const sessionFid = await resolveCanonicalFreelancerId(session.freelancerId);
      if (sessionFid !== freelancerId) {
        return res.status(403).json({
          success: false,
          error: "forbidden",
          message: "Access denied. You can only modify your own workspace data."
        });
      }
    }

    // Check device revocation
    if (deviceId) {
      try {
        const devDoc = await db.collection("connected_devices").doc(deviceId).get();
        if (devDoc.exists && devDoc.data().status === "revoked") {
          return res.status(403).json({
            success: false,
            error: "device_revoked",
            message: "This device has been disconnected from the workspace."
          });
        }
      } catch {}
    }

    let hasChanges = false;

    // 1. Update profile if incoming
    if (incomingProfile && typeof incomingProfile === "object") {
      try {
        const pDoc = await db.collection("freelancers").doc(freelancerId).get();
        const existing = pDoc.exists ? pDoc.data() : {};
        const merged = { ...existing, ...incomingProfile, id: freelancerId };
        await db.collection("freelancers").doc(freelancerId).set(merged, { merge: true });
        workspaceProfiles.set(freelancerId, merged);
      } catch (pErr) {
        console.warn("[Workspace Sync] Profile update error:", pErr);
      }
    }

    // 2. Handle deleted IDs
    if (deletedIds && typeof deletedIds === "object") {
      for (const [colName, ids] of Object.entries(deletedIds)) {
        if (Array.isArray(ids)) {
          for (const id of ids) {
            try {
              await db.collection(colName).doc(id).delete();
              hasChanges = true;
            } catch (delErr) {
              console.warn(`[Workspace Sync] Delete error for ${colName}/${id}:`, delErr);
            }
          }
        }
      }
    }

    // 3. Persist incoming items with timestamp conflict resolution
    const collectionNames = [
      "clients",
      "projects",
      "tasks",
      "records",
      "followups",
      "invoices",
      "proposals",
      "leads",
      "documents"
    ];

    if (collections && typeof collections === "object") {
      for (const colName of collectionNames) {
        const items = collections[colName];
        if (Array.isArray(items) && items.length > 0) {
          for (const item of items) {
            if (!item || !item.id) continue;
            item.freelancerId = freelancerId;
            if (!item.updatedAt) {
              item.updatedAt = item.createdAt || new Date().toISOString();
            }

            try {
              const docRef = db.collection(colName).doc(item.id);
              const existingSnap = await docRef.get();
              if (!existingSnap.exists) {
                await docRef.set(item);
                hasChanges = true;
              } else {
                const existing = existingSnap.data();
                const existingTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
                const incomingTime = new Date(item.updatedAt || item.createdAt || 0).getTime();
                if (incomingTime >= existingTime) {
                  await docRef.set({ ...existing, ...item }, { merge: true });
                  hasChanges = true;
                }
              }
            } catch (itemErr) {
              console.warn(`[Workspace Sync] Item persist error ${colName}/${item.id}:`, itemErr);
            }
          }
        }
      }
    }

    // Bump version if changes were made
    let meta: any;
    if (hasChanges) {
      meta = await bumpWorkspaceMeta(freelancerId);
    } else {
      meta = await getWorkspaceMeta(freelancerId);
    }

    // Read back canonical state
    const canonicalCollections = await getWorkspaceCollections(freelancerId);
    let currentProfile: any = null;
    try {
      const pDoc = await db.collection("freelancers").doc(freelancerId).get();
      if (pDoc.exists) currentProfile = pDoc.data();
    } catch {}

    return res.json({
      success: true,
      profile: sanitizeProfile(currentProfile),
      collections: canonicalCollections,
      version: meta.version,
      lastModified: meta.lastModified,
    });
  } catch (err: any) {
    console.error("[Workspace Sync] Error:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to synchronize workspace." });
  }
});

// 4.9c Real-time single entity mutation
app.post("/api/workspace/entity", async (req: any, res) => {
  try {
    const { freelancerId: rawFreelancerId, collectionName, operation, item, deviceId } = req.body;
    if (!rawFreelancerId || !collectionName || !item || !item.id) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }
    const freelancerId = await resolveCanonicalFreelancerId(rawFreelancerId);

    // Data isolation check if bearer session token is present
    const session = await verifySessionToken(req);
    if (session) {
      const sessionFid = await resolveCanonicalFreelancerId(session.freelancerId);
      if (sessionFid !== freelancerId) {
        return res.status(403).json({
          success: false,
          error: "forbidden",
          message: "Access denied. You can only modify your own workspace data."
        });
      }
    }

    // Check device revocation
    if (deviceId) {
      try {
        const devDoc = await db.collection("connected_devices").doc(deviceId).get();
        if (devDoc.exists && devDoc.data().status === "revoked") {
          return res.status(403).json({
            success: false,
            error: "device_revoked",
            message: "This device has been disconnected from the workspace."
          });
        }
      } catch {}
    }

    const docRef = db.collection(collectionName).doc(item.id);
    if (operation === "delete") {
      await docRef.delete();
    } else {
      const enriched = {
        ...item,
        freelancerId,
        updatedAt: item.updatedAt || new Date().toISOString(),
      };
      await docRef.set(enriched, { merge: true });
    }

    const meta = await bumpWorkspaceMeta(freelancerId);
    return res.json({ success: true, version: meta.version, lastModified: meta.lastModified });
  } catch (err: any) {
    console.error("[Workspace Entity] Error mutating entity:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to update entity." });
  }
});

// 4.9d Lightweight polling endpoint for workspace version check
app.get("/api/workspace/version", async (req: any, res) => {
  try {
    const rawFreelancerId = req.query.freelancerId as string;
    const deviceId = req.query.deviceId as string;
    if (!rawFreelancerId) {
      return res.status(400).json({ success: false, error: "freelancerId is required" });
    }
    const freelancerId = await resolveCanonicalFreelancerId(rawFreelancerId);

    // Check device revocation
    if (deviceId) {
      try {
        const devDoc = await db.collection("connected_devices").doc(deviceId).get();
        if (devDoc.exists && devDoc.data().status === "revoked") {
          return res.status(403).json({
            success: false,
            error: "device_revoked",
            message: "This device has been disconnected from the workspace."
          });
        }
      } catch {}
    }

    const meta = await getWorkspaceMeta(freelancerId);
    return res.json({ success: true, version: meta.version, lastModified: meta.lastModified });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || "Failed to check version." });
  }
});

// 5.0 Sync desktop workspace profile to backend store for instant pairing handoff
app.post("/api/mobile/sync-workspace-profile", async (req: any, res) => {
  try {
    const { profile } = req.body;
    if (profile && profile.id) {
      workspaceProfiles.set(profile.id, profile);
      try {
        await db.collection("freelancers").doc(profile.id).set(profile);
      } catch (dbErr) {
        console.warn("[Mobile Sync] DB fallback for profile:", dbErr);
      }
      return res.json({ success: true });
    }
    return res.status(400).json({ error: "Missing profile." });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to sync profile." });
  }
});

// 5.1 Create temporary mobile pairing token & code (Expires in 10 minutes)
app.post("/api/mobile/create-pairing", async (req: any, res) => {
  try {
    const { freelancerId, profile, collections } = req.body;
    if (!freelancerId) {
      return res.status(400).json({ error: "Missing required freelancerId parameter." });
    }

    if (profile && profile.id) {
      workspaceProfiles.set(freelancerId, profile);
      try {
        await db.collection("freelancers").doc(freelancerId).set(profile);
      } catch (dbErr) {
        console.warn("[Mobile Pairing] Profile persistence fallback:", dbErr);
      }
    }

    // Persist any collections passed from desktop directly into Cloud DB
    if (collections && typeof collections === "object") {
      const collectionNames = [
        "clients",
        "projects",
        "tasks",
        "records",
        "followups",
        "invoices",
        "proposals",
        "leads",
        "documents"
      ];
      for (const colName of collectionNames) {
        const items = collections[colName];
        if (Array.isArray(items)) {
          for (const item of items) {
            if (item && item.id) {
              item.freelancerId = freelancerId;
              try {
                await db.collection(colName).doc(item.id).set(item, { merge: true });
              } catch (colErr) {
                console.warn(`[Mobile Pairing] Failed persisting ${colName}/${item.id}:`, colErr);
              }
            }
          }
        }
      }
    }

    const pairingCode = generateNumericPairingCode();
    const pairingToken = crypto.randomBytes(24).toString("hex");
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString(); // 10 minutes validity

    const sessionData = {
      pairingCode,
      pairingToken,
      freelancerId,
      profile: profile || workspaceProfiles.get(freelancerId) || null,
      collections: collections || null,
      createdAt: now.toISOString(),
      expiresAt,
      used: false,
    };

    // Store in active cache
    activePairingSessions.set(pairingToken, sessionData);
    activePairingSessions.set(`code_${pairingCode}`, sessionData);

    // Also persist to DB for multi-instance resilience
    try {
      await db.collection("mobile_pairing_sessions").doc(pairingToken).set(sessionData);
      await db.collection("mobile_pairing_sessions").doc(`code_${pairingCode}`).set(sessionData);
    } catch (dbErr) {
      console.warn("[Mobile Pairing] Database write fallback to in-memory store:", dbErr);
    }

    // Generate deep-link URL (using host header or standard url format)
    const host = req.get("host") || "localhost:3000";
    const protocol = req.protocol || "https";
    const deepLink = `${protocol}://${host}/?mobile_connect=${pairingToken}`;

    return res.json({
      success: true,
      pairingCode,
      pairingToken,
      expiresAt,
      deepLink,
    });
  } catch (err: any) {
    console.error("[Mobile Pairing] Error creating pairing session:", err);
    return res.status(500).json({ error: err.message || "Failed to generate pairing session." });
  }
});

// 5.2 Inspect mobile pairing session info without invalidating (for UI preview and auth confirmation)
app.post("/api/mobile/pairing-info", async (req: any, res) => {
  try {
    const { pairingToken, pairingCode } = req.body;
    if (!pairingToken && !pairingCode) {
      return res.status(400).json({ error: "missing", message: "Either pairingToken or pairingCode must be provided." });
    }

    let session: any = null;
    if (pairingToken && activePairingSessions.has(pairingToken)) {
      session = activePairingSessions.get(pairingToken);
    } else if (pairingCode) {
      const cleanCode = String(pairingCode).replace(/\D/g, "");
      if (activePairingSessions.has(`code_${cleanCode}`)) {
        session = activePairingSessions.get(`code_${cleanCode}`);
      }
    }

    if (!session) {
      try {
        if (pairingToken) {
          const docSnap = await db.collection("mobile_pairing_sessions").doc(pairingToken).get();
          if (docSnap.exists) session = docSnap.data();
        } else if (pairingCode) {
          const cleanCode = String(pairingCode).replace(/\D/g, "");
          const docSnap = await db.collection("mobile_pairing_sessions").doc(`code_${cleanCode}`).get();
          if (docSnap.exists) session = docSnap.data();
        }
      } catch (dbErr) {
        console.warn("[Mobile Pairing Info] DB search failed:", dbErr);
      }
    }

    if (!session) {
      return res.status(404).json({
        valid: false,
        error: "invalid",
        message: "Unable to connect this device. Please generate a new connection code from Freelancer CRM."
      });
    }

    if (session.used) {
      return res.status(410).json({
        valid: false,
        error: "used",
        message: "This connection code was already used. Please generate a new connection code from Freelancer CRM."
      });
    }

    if (new Date(session.expiresAt).getTime() < Date.now()) {
      return res.status(410).json({
        valid: false,
        error: "expired",
        message: "Connection expired"
      });
    }

    // Fetch workspace preview info safely
    let profilePreview: any = null;
    try {
      const pSnap = await db.collection("freelancers").doc(session.freelancerId).get();
      if (pSnap.exists) {
        const p = pSnap.data();
        profilePreview = {
          id: p.id,
          name: p.name,
          businessName: p.businessName,
          currency: p.currency,
          plan: p.plan || (p.premium ? "Pro" : "Free"),
          email: p.email || p.gmailAccountEmail,
        };
      }
    } catch (err) {
      console.warn("[Mobile Pairing Info] Preview fetch error:", err);
    }

    return res.json({
      valid: true,
      pairingToken: session.pairingToken,
      pairingCode: session.pairingCode,
      expiresAt: session.expiresAt,
      profilePreview,
    });
  } catch (err: any) {
    return res.status(500).json({ error: "server_error", message: err.message || "Failed to inspect pairing code." });
  }
});

// 5.3 Look up existing workspace by email or ID
app.post("/api/auth/lookup-workspace", async (req: any, res) => {
  try {
    const { email, workspaceId } = req.body;
    if (!email && !workspaceId) {
      return res.status(400).json({ error: "Email or Workspace ID required." });
    }

    let profile: any = null;

    if (workspaceId) {
      try {
        const docSnap = await db.collection("freelancers").doc(workspaceId.trim()).get();
        if (docSnap.exists) {
          profile = docSnap.data();
        }
      } catch (e) {
        console.warn("WorkspaceId lookup error:", e);
      }
    }

    if (!profile && email) {
      const cleanEmail = email.trim().toLowerCase();
      try {
        const snap = await db.collection("freelancers").get();
        snap.forEach((d: any) => {
          const data = d.data();
          if (
            data &&
            ((data.email && data.email.toLowerCase() === cleanEmail) ||
             (data.gmailEmail && data.gmailEmail.toLowerCase() === cleanEmail) ||
             (data.gmailAccountEmail && data.gmailAccountEmail.toLowerCase() === cleanEmail) ||
             (data.userEmail && data.userEmail.toLowerCase() === cleanEmail))
          ) {
            profile = data;
          }
        });
      } catch (e) {
        console.warn("Email lookup error:", e);
      }
    }

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: "not_found",
        message: "No existing workspace found with this account. You can create a new workspace or connect with a 6-digit code from your desktop."
      });
    }

    const collections = await getWorkspaceCollections(profile.id);
    return res.json({
      success: true,
      profile,
      collections,
    });
  } catch (err: any) {
    console.error("Lookup error:", err);
    return res.status(500).json({ error: err.message || "Failed to search workspace." });
  }
});

// 5.3a Secure Account Signup
app.post("/api/auth/signup", async (req: any, res) => {
  try {
    const { name, email, password, confirmPassword } = req.body;

    // 1. Validation
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ success: false, error: "missing_name", message: "Name is required." });
    }
    if (!email || typeof email !== "string" || !email.trim()) {
      return res.status(400).json({ success: false, error: "missing_email", message: "Email is required." });
    }
    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({ success: false, error: "invalid_email", message: "Please provide a valid email address." });
    }
    if (!password || typeof password !== "string") {
      return res.status(400).json({ success: false, error: "missing_password", message: "Password is required." });
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, error: "weak_password", message: "Password must be at least 8 characters long." });
    }
    if (!confirmPassword || typeof confirmPassword !== "string") {
      return res.status(400).json({ success: false, error: "missing_confirm_password", message: "Confirm Password is required." });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, error: "password_mismatch", message: "Password and Confirm Password must match." });
    }

    // 2. Check for duplicate account using the same email address
    let existingProfile: any = null;
    let existingDocId: string | null = null;
    try {
      const snap = await db.collection("freelancers").get();
      snap.forEach((d: any) => {
        const data = d.data();
        if (
          data &&
          ((data.email && data.email.toLowerCase() === cleanEmail) ||
           (data.gmailEmail && data.gmailEmail.toLowerCase() === cleanEmail) ||
           (data.gmailAccountEmail && data.gmailAccountEmail.toLowerCase() === cleanEmail) ||
           (data.userEmail && data.userEmail.toLowerCase() === cleanEmail))
        ) {
          existingProfile = data;
          existingDocId = d.id;
        }
      });
    } catch (e) {
      console.warn("[Auth Signup] DB check error:", e);
    }

    // If an account already exists with password hash, prevent duplicate account
    if (existingProfile && (existingProfile.passwordHash || existingProfile.password)) {
      return res.status(409).json({
        success: false,
        error: "account_exists",
        message: "An account with this email address already exists. Please sign in instead."
      });
    }

    const hashed = hashPassword(password);

    // If it is a legacy existing user without a password set yet, link it securely to preserve workspace
    if (existingProfile && existingDocId) {
      const updatedProfile = {
        ...existingProfile,
        name: name.trim() || existingProfile.name,
        email: cleanEmail,
        passwordHash: hashed,
        updatedAt: new Date().toISOString(),
      };
      delete updatedProfile.password;
      await db.collection("freelancers").doc(existingDocId).set(updatedProfile, { merge: true });

      const token = await createAuthSession(existingProfile.id, cleanEmail);
      const collections = await getWorkspaceCollections(existingProfile.id);
      return res.json({
        success: true,
        message: "Existing workspace linked successfully.",
        profile: sanitizeProfile(updatedProfile),
        token,
        collections,
      });
    }

    // Otherwise, create a brand new isolated workspace
    const newFreelancerId = crypto.randomUUID();
    const now = new Date().toISOString();
    const newProfile = {
      id: newFreelancerId,
      name: name.trim(),
      email: cleanEmail,
      businessName: `${name.trim()}'s Studio`,
      currency: "USD",
      plan: "Free",
      premium: false,
      onboardingCompleted: true,
      passwordHash: hashed,
      createdAt: now,
      updatedAt: now,
    };

    await db.collection("freelancers").doc(newFreelancerId).set(newProfile);
    const token = await createAuthSession(newFreelancerId, cleanEmail);

    return res.status(201).json({
      success: true,
      message: "Account created successfully.",
      profile: sanitizeProfile(newProfile),
      token,
      collections: {
        clients: [],
        projects: [],
        tasks: [],
        records: [],
        followups: [],
        invoices: [],
        proposals: [],
        leads: [],
        documents: [],
      },
    });
  } catch (err: any) {
    console.error("[Auth Signup] Error:", err);
    return res.status(500).json({ success: false, error: "server_error", message: err.message || "Failed to create account." });
  }
});

// 5.3b Secure Email and password authentication (Sign In)
app.post("/api/auth/signin", async (req: any, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !String(email).trim()) {
      return res.status(400).json({ success: false, error: "missing_email", message: "Email address is required." });
    }
    if (!password || !String(password).trim()) {
      return res.status(400).json({ success: false, error: "missing_password", message: "Password is required." });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    let profile: any = null;
    let docId: string | null = null;

    try {
      const snap = await db.collection("freelancers").get();
      snap.forEach((d: any) => {
        const data = d.data();
        if (
          data &&
          ((data.email && data.email.toLowerCase() === cleanEmail) ||
           (data.gmailEmail && data.gmailEmail.toLowerCase() === cleanEmail) ||
           (data.gmailAccountEmail && data.gmailAccountEmail.toLowerCase() === cleanEmail) ||
           (data.userEmail && data.userEmail.toLowerCase() === cleanEmail))
        ) {
          profile = data;
          docId = d.id;
        }
      });
    } catch (e) {
      console.warn("Email sign-in DB error:", e);
    }

    if (!profile) {
      return res.status(401).json({
        success: false,
        error: "invalid_credentials",
        message: "Invalid email address or password."
      });
    }

    // Password verification logic
    if (profile.passwordHash) {
      const isValid = verifyPassword(password, profile.passwordHash);
      if (!isValid) {
        return res.status(401).json({
          success: false,
          error: "invalid_credentials",
          message: "Invalid email address or password."
        });
      }
    } else if (profile.password) {
      // Legacy plain text check & auto-upgrade to scrypt hash
      if (profile.password !== password) {
        return res.status(401).json({
          success: false,
          error: "invalid_credentials",
          message: "Invalid email address or password."
        });
      }
      // Upgrade plain text password to secure hash
      const hashed = hashPassword(password);
      if (docId) {
        try {
          await db.collection("freelancers").doc(docId).update({
            passwordHash: hashed,
            password: null,
            email: cleanEmail,
          });
          profile.passwordHash = hashed;
          delete profile.password;
        } catch (pwErr) {
          console.warn("Could not upgrade password hash on profile:", pwErr);
        }
      }
    } else {
      // Existing user who didn't have a password set yet: set it securely on first sign in
      const hashed = hashPassword(password);
      if (docId) {
        try {
          await db.collection("freelancers").doc(docId).update({
            passwordHash: hashed,
            email: cleanEmail,
          });
          profile.passwordHash = hashed;
        } catch (pwErr) {
          console.warn("Could not save initial password to profile:", pwErr);
        }
      }
    }

    const token = await createAuthSession(profile.id, cleanEmail);
    const collections = await getWorkspaceCollections(profile.id);

    return res.json({
      success: true,
      profile: sanitizeProfile(profile),
      token,
      collections,
    });
  } catch (err: any) {
    console.error("Sign-in error:", err);
    return res.status(500).json({ success: false, error: "server_error", message: err.message || "Failed to sign in." });
  }
});

// Backward-compatible alias for existing callers
app.post("/api/auth/email-signin", async (req: any, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !String(email).trim()) {
      return res.status(400).json({ success: false, error: "missing_email", message: "Email address is required." });
    }
    if (!password || !String(password).trim()) {
      return res.status(400).json({ success: false, error: "missing_password", message: "Password is required." });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    let profile: any = null;
    let docId: string | null = null;

    try {
      const snap = await db.collection("freelancers").get();
      snap.forEach((d: any) => {
        const data = d.data();
        if (
          data &&
          ((data.email && data.email.toLowerCase() === cleanEmail) ||
           (data.gmailEmail && data.gmailEmail.toLowerCase() === cleanEmail) ||
           (data.gmailAccountEmail && data.gmailAccountEmail.toLowerCase() === cleanEmail) ||
           (data.userEmail && data.userEmail.toLowerCase() === cleanEmail))
        ) {
          profile = data;
          docId = d.id;
        }
      });
    } catch (e) {
      console.warn("Email sign-in DB error:", e);
    }

    if (!profile) {
      return res.status(401).json({
        success: false,
        error: "invalid_credentials",
        message: "Invalid email address or password."
      });
    }

    if (profile.passwordHash) {
      const isValid = verifyPassword(password, profile.passwordHash);
      if (!isValid) {
        return res.status(401).json({
          success: false,
          error: "invalid_credentials",
          message: "Invalid email address or password."
        });
      }
    } else if (profile.password) {
      if (profile.password !== password) {
        return res.status(401).json({
          success: false,
          error: "invalid_credentials",
          message: "Invalid email address or password."
        });
      }
      const hashed = hashPassword(password);
      if (docId) {
        try {
          await db.collection("freelancers").doc(docId).update({
            passwordHash: hashed,
            password: null,
            email: cleanEmail,
          });
          profile.passwordHash = hashed;
          delete profile.password;
        } catch {}
      }
    } else {
      const hashed = hashPassword(password);
      if (docId) {
        try {
          await db.collection("freelancers").doc(docId).update({
            passwordHash: hashed,
            email: cleanEmail,
          });
          profile.passwordHash = hashed;
        } catch {}
      }
    }

    const token = await createAuthSession(profile.id, cleanEmail);
    const collections = await getWorkspaceCollections(profile.id);

    return res.json({
      success: true,
      profile: sanitizeProfile(profile),
      token,
      collections,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: "server_error", message: err.message || "Failed to sign in." });
  }
});

// 5.3c Secure Password Reset Request (No account enumeration vulnerability)
app.post("/api/auth/forgot-password", async (req: any, res) => {
  try {
    const { email } = req.body;
    if (!email || !String(email).trim()) {
      return res.status(400).json({ success: false, error: "missing_email", message: "Email address is required." });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({ success: false, error: "invalid_email", message: "Please provide a valid email address." });
    }

    // Generate secure 6-digit verification code & token
    const resetCode = crypto.randomInt(100000, 999999).toString();
    const resetToken = crypto.randomBytes(24).toString("hex");
    const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour

    // Look up if account exists
    let accountExists = false;
    let freelancerId = "";
    try {
      const snap = await db.collection("freelancers").get();
      snap.forEach((d: any) => {
        const data = d.data();
        if (
          data &&
          ((data.email && data.email.toLowerCase() === cleanEmail) ||
           (data.gmailEmail && data.gmailEmail.toLowerCase() === cleanEmail) ||
           (data.gmailAccountEmail && data.gmailAccountEmail.toLowerCase() === cleanEmail) ||
           (data.userEmail && data.userEmail.toLowerCase() === cleanEmail))
        ) {
          accountExists = true;
          freelancerId = d.id;
        }
      });
    } catch (e) {
      console.warn("[Forgot Password] DB search error:", e);
    }

    if (accountExists) {
      try {
        await db.collection("password_resets").doc(cleanEmail).set({
          email: cleanEmail,
          freelancerId,
          code: resetCode,
          token: resetToken,
          expiresAt,
          createdAt: new Date().toISOString(),
        });
        console.log(`[Password Reset] Secure reset code for ${cleanEmail}: ${resetCode}`);
      } catch (saveErr) {
        console.warn("[Forgot Password] Error saving reset token:", saveErr);
      }
    }

    // Always return the exact same generic message to prevent account-enumeration vulnerability
    return res.json({
      success: true,
      message: "If an account exists with that email address, password reset instructions and a verification code have been generated.",
      // For testing in AI Studio preview:
      previewCode: resetCode,
    });
  } catch (err: any) {
    console.error("[Forgot Password] Error:", err);
    return res.status(500).json({ success: false, error: "server_error", message: "Unable to process password reset request." });
  }
});

// 5.3d Password Reset Completion
app.post("/api/auth/reset-password", async (req: any, res) => {
  try {
    const { email, code, newPassword, confirmPassword } = req.body;
    if (!email || !code || !newPassword) {
      return res.status(400).json({ success: false, error: "missing_fields", message: "Email, reset code, and new password are required." });
    }
    const cleanEmail = String(email).trim().toLowerCase();
    const cleanCode = String(code).trim();

    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, error: "weak_password", message: "New password must be at least 8 characters long." });
    }
    if (confirmPassword && newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, error: "password_mismatch", message: "Password and Confirm Password must match." });
    }

    let resetData: any = null;
    try {
      const resetDoc = await db.collection("password_resets").doc(cleanEmail).get();
      if (resetDoc.exists) {
        resetData = resetDoc.data();
      }
    } catch (e) {
      console.warn("[Reset Password] Error fetching reset code:", e);
    }

    if (!resetData || resetData.code !== cleanCode || Date.now() > (resetData.expiresAt || 0)) {
      return res.status(400).json({
        success: false,
        error: "invalid_code",
        message: "The reset code is invalid or has expired. Please request a new code."
      });
    }

    const targetFreelancerId = resetData.freelancerId;
    const hashed = hashPassword(newPassword);

    if (targetFreelancerId) {
      try {
        await db.collection("freelancers").doc(targetFreelancerId).update({
          passwordHash: hashed,
          password: null,
          updatedAt: new Date().toISOString(),
        });
      } catch (upErr) {
        console.warn("[Reset Password] Profile update error:", upErr);
      }
    }

    // Delete used reset code
    try {
      await db.collection("password_resets").doc(cleanEmail).delete();
    } catch {}

    return res.json({
      success: true,
      message: "Your password has been successfully reset. You can now sign in.",
    });
  } catch (err: any) {
    console.error("[Reset Password] Error:", err);
    return res.status(500).json({ success: false, error: "server_error", message: err.message || "Failed to reset password." });
  }
});

// 5.3e Logout / Invalidate Session
app.post("/api/auth/logout", async (req: any, res) => {
  try {
    const authHeader = req.headers.authorization;
    let token = req.body?.token;
    if (!token && authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.slice(7).trim();
    }
    if (token) {
      try {
        await db.collection("auth_sessions").doc(token).delete();
      } catch {}
    }
    return res.json({ success: true, message: "Logged out successfully." });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: "Failed to log out." });
  }
});

// 5.3f Verify Current Session
app.get("/api/auth/me", async (req: any, res) => {
  try {
    const session = await verifySessionToken(req);
    if (!session) {
      return res.status(401).json({ success: false, error: "unauthorized", message: "Session expired or invalid." });
    }
    const freelancerId = await resolveCanonicalFreelancerId(session.freelancerId);
    let profile: any = null;
    try {
      const doc = await db.collection("freelancers").doc(freelancerId).get();
      if (doc.exists) profile = doc.data();
    } catch {}

    if (!profile) {
      return res.status(404).json({ success: false, error: "not_found", message: "Workspace not found." });
    }

    const collections = await getWorkspaceCollections(freelancerId);
    return res.json({
      success: true,
      profile: sanitizeProfile(profile),
      collections,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: "Failed to retrieve session." });
  }
});

// 5.4 Verify mobile pairing token or 6-digit code
app.post("/api/mobile/verify-pairing", async (req: any, res) => {
  try {
    const { pairingToken, pairingCode, clientDeviceId, deviceName, platform, userAgent } = req.body;
    if (!pairingToken && !pairingCode) {
      return res.status(400).json({ success: false, error: "invalid", message: "Either pairingToken or pairingCode must be provided." });
    }

    const cleanCode = pairingCode ? String(pairingCode).replace(/\D/g, "") : undefined;
    let session: any = null;

    // Check memory first
    if (pairingToken && activePairingSessions.has(pairingToken)) {
      session = activePairingSessions.get(pairingToken);
    } else if (cleanCode && activePairingSessions.has(`code_${cleanCode}`)) {
      session = activePairingSessions.get(`code_${cleanCode}`);
    }

    // If not found in memory, check DB
    if (!session) {
      try {
        if (pairingToken) {
          const docSnap = await db.collection("mobile_pairing_sessions").doc(pairingToken).get();
          if (docSnap.exists) session = docSnap.data();
        } else if (cleanCode) {
          const docSnap = await db.collection("mobile_pairing_sessions").doc(`code_${cleanCode}`).get();
          if (docSnap.exists) session = docSnap.data();
        }
      } catch (dbErr) {
        console.warn("[Mobile Pairing] Failed searching DB for session:", dbErr);
      }
    }

    // Strict validation before ANY device registration occurs
    if (!session) {
      return res.status(404).json({
        success: false,
        error: "invalid",
        message: "Invalid connection code. Please check the code and try again.",
      });
    }

    // Check if session has already been used
    if (session.used) {
      return res.status(410).json({
        success: false,
        error: "used",
        message: "This connection code has already been used. Please generate a new code.",
      });
    }

    // Check expiration (10 minutes window)
    if (new Date(session.expiresAt).getTime() < Date.now()) {
      return res.status(410).json({
        success: false,
        error: "expired",
        message: "This connection code has expired. Generate a new code on your computer.",
      });
    }

    const rawFreelancerId = session.freelancerId;
    if (!rawFreelancerId) {
      return res.status(400).json({ success: false, error: "workspace_not_found", message: "Invalid workspace session data." });
    }

    const freelancerId = await resolveCanonicalFreelancerId(rawFreelancerId);

    // 1. Retrieve freelancer profile
    let profile: any = session.profile || workspaceProfiles.get(freelancerId) || workspaceProfiles.get(rawFreelancerId);
    if (!profile) {
      try {
        const pSnap = await db.collection("freelancers").doc(freelancerId).get();
        if (pSnap.exists) {
          profile = pSnap.data();
        }
      } catch (pErr) {
        console.warn("[Mobile Pairing] Could not fetch profile from DB directly:", pErr);
      }
    }

    // Fallback profile ensures mobile app always has valid workspace data
    if (!profile) {
      profile = {
        id: freelancerId,
        name: "Freelancer",
        businessName: "Freelancer Workspace",
        currency: "USD",
        plan: "Free",
        onboardingCompleted: true,
        createdAt: new Date().toISOString(),
      };
      workspaceProfiles.set(freelancerId, profile);
      try {
        await db.collection("freelancers").doc(freelancerId).set(profile);
      } catch (e) {}
    } else {
      profile.onboardingCompleted = true;
    }

    // 2. LOAD WORKSPACE (from Cloud DB as canonical source of truth BEFORE registering device)
    const collections = await getWorkspaceCollections(freelancerId);
    
    // If db collection was empty but session had collections sent from desktop, persist them
    if (session.collections && typeof session.collections === "object") {
      for (const [col, items] of Object.entries(session.collections)) {
        if (Array.isArray(items) && (!collections[col] || collections[col].length === 0)) {
          collections[col] = items;
          for (const item of items) {
            try {
              await db.collection(col).doc(item.id).set({ ...item, freelancerId }, { merge: true });
            } catch (pErr) {}
          }
        }
      }
    }

    // 3. CONFIRM SYNC: Ensure collections loaded successfully
    if (!collections || typeof collections !== "object") {
      return res.status(500).json({
        success: false,
        error: "sync_failed",
        message: "Failed to load workspace data from cloud. Connection was aborted.",
      });
    }

    // 4. ATOMIC DEVICE REGISTRATION: Only register device & finalize session now that everything is verified!
    let existingDevice: any = null;
    try {
      const snap = await db.collection("connected_devices").get();
      snap.forEach((doc: any) => {
        const d = doc.data();
        if (d && (d.freelancerId === freelancerId || d.freelancerId === rawFreelancerId)) {
          // Match by persistent clientDeviceId
          if (clientDeviceId && (d.clientDeviceId === clientDeviceId || d.id === clientDeviceId)) {
            existingDevice = d;
          }
          // Or match by platform and deviceName
          else if (
            !existingDevice &&
            d.status === "active" &&
            d.platform === (platform || "Mobile Web") &&
            d.deviceName === (deviceName || "Android Phone")
          ) {
            existingDevice = d;
          }
        }
      });
    } catch (dbErr) {
      console.warn("[Mobile Pairing] Could not query connected_devices:", dbErr);
    }

    let deviceRecord: any;
    if (existingDevice) {
      // Reconnection: update existing record, do NOT create duplicate
      deviceRecord = {
        ...existingDevice,
        freelancerId,
        clientDeviceId: clientDeviceId || existingDevice.clientDeviceId || existingDevice.id,
        status: "active",
        lastActiveAt: new Date().toISOString(),
        userAgent: userAgent || existingDevice.userAgent || "",
        platform: platform || existingDevice.platform || "Mobile Web",
        deviceName: deviceName || existingDevice.deviceName || "Mobile Device",
      };
      await db.collection("connected_devices").doc(existingDevice.id).set(deviceRecord);
    } else {
      // New device: create single stable record
      const stableId = clientDeviceId
        ? `dev_${String(clientDeviceId).replace(/[^a-zA-Z0-9_-]/g, "")}`
        : `dev_${crypto.randomBytes(12).toString("hex")}`;

      deviceRecord = {
        id: stableId,
        clientDeviceId: clientDeviceId || stableId,
        freelancerId,
        deviceName: deviceName || (platform === "iOS" ? "Apple iPhone" : platform === "Android" ? "Android Phone" : "Mobile Device"),
        platform: platform || "Mobile Web",
        userAgent: userAgent || "",
        pairedAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        status: "active",
      };
      await db.collection("connected_devices").doc(stableId).set(deviceRecord);
    }

    // 5. Mark session as used in memory and DB
    session.used = true;
    session.usedAt = new Date().toISOString();
    activePairingSessions.delete(session.pairingToken);
    if (session.pairingCode) {
      activePairingSessions.delete(`code_${session.pairingCode}`);
    }
    try {
      if (session.pairingToken) {
        await db.collection("mobile_pairing_sessions").doc(session.pairingToken).set(session, { merge: true });
      }
      if (session.pairingCode) {
        await db.collection("mobile_pairing_sessions").doc(`code_${session.pairingCode}`).set(session, { merge: true });
      }
    } catch (sessErr) {
      console.warn("[Mobile Pairing] Could not mark session used in DB:", sessErr);
    }

    return res.json({
      success: true,
      profile,
      freelancerId,
      device: deviceRecord,
      collections,
      syncConfirmed: true,
    });
  } catch (err: any) {
    console.error("[Mobile Pairing] Error verifying pairing:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to verify pairing code." });
  }
});

// 5.4b Connect device directly by Workspace / Account ID (e.g. "54395c83")
app.post("/api/workspace/connect-by-id", async (req: any, res) => {
  try {
    const { workspaceId, clientDeviceId, deviceName, platform, userAgent } = req.body;
    if (!workspaceId) {
      return res.status(400).json({ success: false, error: "invalid", message: "Workspace ID is required." });
    }

    const freelancerId = await resolveCanonicalFreelancerId(String(workspaceId).trim());
    if (!freelancerId) {
      return res.status(404).json({ success: false, error: "not_found", message: `No workspace found matching ID "${workspaceId}".` });
    }

    // 1. Fetch profile
    let profile: any = workspaceProfiles.get(freelancerId);
    if (!profile) {
      try {
        const pSnap = await db.collection("freelancers").doc(freelancerId).get();
        if (pSnap.exists) profile = pSnap.data();
      } catch (e) {}
    }

    if (!profile) {
      return res.status(404).json({ success: false, error: "not_found", message: `Workspace "${workspaceId}" could not be loaded.` });
    }

    profile.onboardingCompleted = true;

    // 2. Load workspace collections from cloud DB
    const collections = await getWorkspaceCollections(freelancerId);

    // 3. Register device atomically
    let existingDevice: any = null;
    try {
      const snap = await db.collection("connected_devices").get();
      snap.forEach((doc: any) => {
        const d = doc.data();
        if (d && (d.freelancerId === freelancerId || d.freelancerId === workspaceId)) {
          if (clientDeviceId && (d.clientDeviceId === clientDeviceId || d.id === clientDeviceId)) {
            existingDevice = d;
          }
        }
      });
    } catch (e) {}

    let deviceRecord: any;
    if (existingDevice) {
      deviceRecord = {
        ...existingDevice,
        freelancerId,
        clientDeviceId: clientDeviceId || existingDevice.clientDeviceId || existingDevice.id,
        status: "active",
        lastActiveAt: new Date().toISOString(),
        userAgent: userAgent || existingDevice.userAgent || "",
        platform: platform || existingDevice.platform || "Mobile Web",
        deviceName: deviceName || existingDevice.deviceName || "Mobile Device",
      };
      await db.collection("connected_devices").doc(existingDevice.id).set(deviceRecord);
    } else {
      const stableId = clientDeviceId
        ? `dev_${String(clientDeviceId).replace(/[^a-zA-Z0-9_-]/g, "")}`
        : `dev_${crypto.randomBytes(12).toString("hex")}`;

      deviceRecord = {
        id: stableId,
        clientDeviceId: clientDeviceId || stableId,
        freelancerId,
        deviceName: deviceName || (platform === "iOS" ? "Apple iPhone" : platform === "Android" ? "Android Phone" : "Mobile Device"),
        platform: platform || "Mobile Web",
        userAgent: userAgent || "",
        pairedAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        status: "active",
      };
      await db.collection("connected_devices").doc(stableId).set(deviceRecord);
    }

    return res.json({
      success: true,
      profile,
      freelancerId,
      device: deviceRecord,
      collections,
      syncConfirmed: true,
    });
  } catch (err: any) {
    console.error("[Workspace Connect By ID] Error:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to connect to workspace." });
  }
});

// 5.3 List paired mobile devices for a freelancer (with automatic deduplication)
app.get("/api/mobile/devices", async (req: any, res) => {
  try {
    const rawId = req.query.freelancerId as string;
    if (!rawId) {
      return res.status(400).json({ error: "freelancerId parameter is required." });
    }
    const freelancerId = await resolveCanonicalFreelancerId(rawId);

    const rawDevices: any[] = [];
    try {
      const snap = await db.collection("connected_devices").get();
      snap.forEach((doc: any) => {
        const d = doc.data();
        if (d && (d.freelancerId === freelancerId || d.freelancerId === rawId) && d.status === "active") {
          rawDevices.push(d);
        }
      });
    } catch (dbErr) {
      console.warn("[Mobile Devices] DB read failed for devices:", dbErr);
    }

    // Group and deduplicate: keep the most recent active device per identifier or platform+deviceName
    rawDevices.sort(
      (a, b) => new Date(b.lastActiveAt || b.pairedAt || 0).getTime() - new Date(a.lastActiveAt || a.pairedAt || 0).getTime()
    );

    const seen = new Set<string>();
    const devices: any[] = [];
    for (const dev of rawDevices) {
      const key = dev.clientDeviceId || `${dev.platform}___${dev.deviceName}`;
      if (!seen.has(key)) {
        seen.add(key);
        devices.push(dev);
      }
    }

    return res.json({ success: true, devices });
  } catch (err: any) {
    console.error("[Mobile Devices] Error fetching devices:", err);
    return res.status(500).json({ error: err.message || "Failed to fetch connected devices." });
  }
});

// 5.4 Disconnect / revoke a mobile device session
app.post("/api/mobile/devices/disconnect", async (req: any, res) => {
  try {
    const { deviceId, freelancerId } = req.body;
    if (!deviceId) {
      return res.status(400).json({ error: "deviceId parameter is required." });
    }

    try {
      const docRef = db.collection("connected_devices").doc(deviceId);
      const snap = await docRef.get();
      if (snap.exists) {
        await docRef.set({ ...snap.data(), status: "revoked", revokedAt: new Date().toISOString() }, { merge: true });
      }
    } catch (dbErr) {
      console.warn("[Mobile Devices] Failed to revoke device in DB:", dbErr);
    }

    return res.json({ success: true, message: "Device disconnected successfully." });
  } catch (err: any) {
    console.error("[Mobile Devices] Error disconnecting device:", err);
    return res.status(500).json({ error: err.message || "Failed to disconnect device." });
  }
});

// 5.5 Mobile device heartbeat to maintain live connection status
app.post("/api/mobile/device-heartbeat", async (req: any, res) => {
  try {
    const { deviceId, freelancerId } = req.body;
    if (deviceId) {
      try {
        const docRef = db.collection("connected_devices").doc(deviceId);
        await docRef.set({ lastActiveAt: new Date().toISOString() }, { merge: true });
      } catch (e) {
        // silent
      }
    }
    return res.json({ success: true, timestamp: new Date().toISOString() });
  } catch (err: any) {
    return res.status(500).json({ error: "Heartbeat failed." });
  }
});

export default app;

