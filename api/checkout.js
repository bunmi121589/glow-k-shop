// Glow K Shop — secure checkout handoff
// Creates a Stripe Checkout Session from the customer's cart and returns the URL.
// The customer's browser sends only product NAMES + quantities; prices are looked
// up here on the server, so they can never be tampered with from the browser.

const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// ── Authoritative catalog ────────────────────────────────────────────────
// Mirror of the products on the site. Masks = $10, creams/serums = $15.
// If you add or rename a product on the site, add/rename it here too.
const PRODUCTS = [
  { name: "Golden Smooth Hair Removal Cream", cat: "cream" },
  { name: "24K Gold Radiance Glow Serum", cat: "cream" },
  { name: "Yeast & Collagen Smoothing Peel", cat: "cream" },
  { name: "Golden Bounce & Glow Serum", cat: "cream" },
  { name: "Blueberry Dew", cat: "mask" },
  { name: "Shea Butter Glow", cat: "mask" },
  { name: "Orange Vitamin C Radiance", cat: "mask" },
  { name: "Strawberry Quench", cat: "mask" },
  { name: "Apple Hydra Fresh", cat: "mask" },
  { name: "Tea Tree Fresh Radiance", cat: "mask" },
  { name: "Mango Nourish", cat: "mask" },
  { name: "Aloe Hydrate & Soothe", cat: "mask" },
  { name: "Cactus Hydra Plump", cat: "mask" },
  { name: "Cherry Antioxidant Glow", cat: "mask" },
  { name: "Lemon Vitality Glow", cat: "mask" },
  { name: "Oat Silk", cat: "mask" },
  { name: "Green Nutrient Glow", cat: "mask" },
  { name: "Hyaluronic Acid Deep Hydration", cat: "mask" },
  { name: "Snail Mucin Glow", cat: "mask" },
  { name: "Honey Replenish", cat: "mask" },
  { name: "Coffee Wake-Up Glow", cat: "mask" },
  { name: "Kiwi Antioxidant Boost", cat: "mask" },
  { name: "Cyan Lemon \u2013 Refresh & Brighten", cat: "mask" },
  { name: "Tomato \u2013 Bright and Even", cat: "mask" },
  { name: "Grape \u2013 Bright & Bounce", cat: "mask" },
  { name: "Pomegranate \u2013 Antioxidant Glow", cat: "mask" },
  { name: "Golden Glow Ritual", cat: "mask" },
  { name: "Goat Milk \u2013 Smooth & Bright", cat: "mask" },
  { name: "Chamomile \u2013 Calm & Soothe", cat: "mask" },
  { name: "Carrot \u2013 Nourish & Glow", cat: "mask" },
  { name: "Bamboo \u2013 Hydrate & Bounce", cat: "mask" },
  { name: "Cucumber \u2013 Cool & Hydrate", cat: "mask" },
  { name: "Rose \u2013 Dewy Glow", cat: "mask" },
  { name: "Avocado \u2013 Vitamin E Glow", cat: "mask" },
  { name: "Green Tea \u2013 Smooth & Soothe", cat: "mask" },
  { name: "Pink Peach \u2013 Soft Glow", cat: "mask" },
  { name: "Coconut \u2013 Deep Hydrate, Smooth & Soften", cat: "mask" },
  { name: "Lavender \u2013 Calm & Hydrate", cat: "mask" }
];

// Prices in cents (Stripe works in the smallest currency unit).
const PRICE = { cream: 1500, mask: 1000 };
const CATALOG = Object.fromEntries(PRODUCTS.map(p => [p.name, PRICE[p.cat]]));

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const items = Array.isArray(body.items) ? body.items : [];

    if (!items.length) {
      return res.status(400).json({ error: 'Your bag is empty.' });
    }

    const line_items = [];
    for (const it of items) {
      const name = (it && it.name) ? String(it.name) : '';
      const cents = CATALOG[name];
      if (!cents) {
        return res.status(400).json({ error: 'We could not find one of the items in your bag. Please refresh and try again.' });
      }
      let qty = parseInt(it.qty, 10);
      if (!Number.isFinite(qty) || qty < 1) qty = 1;
      if (qty > 99) qty = 99;

      line_items.push({
        quantity: qty,
        price_data: {
          currency: 'usd',
          unit_amount: cents,
          product_data: { name }
        }
      });
    }

    // Build absolute URLs for the success / cancel redirects from the request host,
    // so this works on glowkshop.com and on any Vercel preview URL.
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'glowkshop.com';
    const proto = host.includes('localhost') ? 'http' : 'https';
    const origin = `${proto}://${host}`;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items,
      shipping_address_collection: { allowed_countries: ['US'] },
      phone_number_collection: { enabled: true },
      success_url: `${origin}/success.html`,
      cancel_url: `${origin}/shop.html`
      // Free shipping: no shipping_options added, so nothing is charged for delivery.
      // Sales tax can be switched on later with automatic_tax: { enabled: true }
      // once you've set your origin address in the Stripe dashboard.
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Checkout error:', err);
    return res.status(500).json({ error: 'Something went wrong starting checkout. Please try again.' });
  }
};
