// SEP_SaigonBistro/backend/src/modules/orders/orders.routes.js

const express = require("express");
const { requireAuth, requireStaffOrAdmin } = require("../../middlewares/auth");

const router = express.Router();

const DELIVERY_FEE = 5;

/**
 * Generate short customer-facing order code
 * Example: SB-7QK2M9
 */
function generateOrderCode() {
  return "SB-" + Math.random().toString(36).slice(2, 8).toUpperCase();
}

/**
 * Ensure uniqueness in DB (public_orderid is UNIQUE)
 */
async function generateUniqueOrderCode(sb) {
  for (let i = 0; i < 10; i++) {
    const code = generateOrderCode();
    const { data, error } = await sb
      .from("orders")
      .select("public_orderid")
      .eq("public_orderid", code)
      .maybeSingle();

    if (error) {
      // If lookup fails, we can still try next code
      continue;
    }
    if (!data) return code; // not found => unique
  }
  // Fallback (very unlikely)
  return "SB-" + Date.now().toString(36).toUpperCase().slice(-6);
}

/**
 * CREATE ORDER
 * POST /api/orders
 */
router.post("/", requireAuth, async (req, res) => {
  try {
    const incoming = req.body || {};
    const cart = incoming.cart;

    if (!Array.isArray(cart) || cart.length === 0) {
      return res.status(400).json({ message: "Invalid order data (cart required)" });
    }

    // Validate delivery fields (these match your DB columns)
    const delivery_address = incoming?.delivery?.address ?? incoming.delivery_address ?? null;
    const block_unit_number = incoming?.delivery?.block_unit_number ?? incoming.block_unit_number ?? null;
    const delivery_city = incoming?.delivery?.city ?? incoming.delivery_city ?? null;
    const delivery_state = incoming?.delivery?.state ?? incoming.delivery_state ?? null;
    const delivery_zip = incoming?.delivery?.zip ?? incoming.delivery_zip ?? null;
    const delivery_notes = incoming?.delivery?.notes ?? incoming.delivery_notes ?? null;

    // menu_item_id are UUID strings in your DB
    const menuIds = cart.map((x) => x.menu_item_id).filter(Boolean);

    if (menuIds.length !== cart.length) {
      return res.status(400).json({ message: "Invalid cart: missing menu_item_id" });
    }

    const { data: menuRows, error: menuErr } = await req.sb
      .from("menu_items")
      .select("id, price")
      .in("id", menuIds);

    if (menuErr) return res.status(400).json({ message: menuErr.message });

    const priceById = Object.fromEntries((menuRows || []).map((r) => [r.id, Number(r.price)]));

    let subtotal = 0;
    for (const line of cart) {
      const price = priceById[line.menu_item_id];
      if (!price) return res.status(400).json({ message: "Invalid menu_item_id in cart" });

      const qty = Number(line.qty);
      if (!Number.isInteger(qty) || qty <= 0) {
        return res.status(400).json({ message: "Invalid quantity" });
      }

      subtotal += price * qty;
    }

    const delivery_fee = DELIVERY_FEE;
    const total = subtotal + delivery_fee;

    const public_orderid = await generateUniqueOrderCode(req.sb);

    const { data: orderInserted, error: orderErr } = await req.sb
      .from("orders")
      .insert([
        {
          public_orderid, //  short id
          customer_id: req.user.id,
          customer_name: incoming.customer_name || null,
          customer_email: incoming.customer_email || req.user.email || null,

          //  delivery fields (match schema)
          delivery_address,
          block_unit_number,
          delivery_city,
          delivery_state,
          delivery_zip,
          delivery_notes,

          status: "Order confirmed",
          total, // your DB has total NOT NULL
        },
      ])
      .select(
        "id, public_orderid, status, total, created_at, delivery_address, block_unit_number, delivery_city, delivery_state, delivery_zip, delivery_notes"
      )
      .single();

    if (orderErr) return res.status(400).json({ message: orderErr.message });

    const orderItems = cart.map((line) => ({
      order_id: orderInserted.id,
      menu_item_id: line.menu_item_id,
      qty: Number(line.qty),
      unit_price: priceById[line.menu_item_id],
    }));

    const { error: itemsErr } = await req.sb.from("order_items").insert(orderItems);
    if (itemsErr) return res.status(400).json({ message: itemsErr.message });

    return res.status(201).json({ success: true, order: orderInserted });
  } catch (err) {
    console.error("ORDER ERROR:", err);
    return res.status(500).json({ message: "Failed to save order" });
  }
});

/**
 * GET ORDER BY UUID (Customer)
 * GET /api/orders/:id
 */
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await req.sb
      .from("orders")
      .select(
        "id, public_orderid, status, total, created_at, customer_id, customer_name, customer_email, delivery_address, block_unit_number, delivery_city, delivery_state, delivery_zip, delivery_notes"
      )
      .eq("id", id)
      .single();

    if (error) return res.status(404).json({ message: "Order not found" });
    return res.json({ success: true, order: data });
  } catch (err) {
    console.error("GET ORDER ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * GET ALL ORDERS (Admin / Staff)
 * GET /api/orders
 */
router.get("/", requireStaffOrAdmin, async (req, res) => {
  try {
    const { data, error } = await req.sb
      .from("orders")
      .select(
        "id, public_orderid, customer_id, customer_name, customer_email, status, total, created_at"
      )
      .order("created_at", { ascending: false });

    if (error) return res.status(400).json({ message: error.message });
    return res.json({ success: true, orders: data });
  } catch (err) {
    console.error("GET ORDERS ERROR:", err);
    return res.status(500).json({ message: "Failed to load orders" });
  }
});

module.exports = router;
