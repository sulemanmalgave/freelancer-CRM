import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";
import Stripe from "stripe";
import { createServer as createViteServer } from "vite";

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

    // Default to USD $1.99 or INR ₹99
    const amountInCents = isIndia ? 9900 : 199; // 99.00 INR or 1.99 USD
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
