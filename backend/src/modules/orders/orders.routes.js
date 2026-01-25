// SEP_SaigonBistro/backend/src/modules/orders/orders.routes.js

const express = require("express");
const { requireAuth, requireStaffOrAdmin } = require("../../middlewares/auth");

const router = express.Router();

// controller
router.post("/", requireAuth, async (req, res) => {
  try {
    const incoming = req.body || {};
    if (!incoming.cart || !Array.isArray(incoming.cart) || incoming.cart.length === 0) {
      return res.status(400).json({ message: "Invalid order data (cart required)" });
    }

    const cart = incoming.cart;
    const menuIds = cart.map((x) => x.menu_item_id);

    const { data: menuRows, error: mErr } = await req.sb
      .from("menu_items")
      .select("id, price")
      .in("id", menuIds);

    if (mErr) return res.status(400).json({ message: mErr.message });

    const priceById = Object.fromEntries((menuRows || []).map((r) => [r.id, Number(r.price)]));

    let total = 0;
    for (const line of cart) {
      const p = priceById[line.menu_item_id];
      if (!p) return res.status(400).json({ message: "Invalid menu_item_id in cart" });
      if (!Number.isInteger(line.qty) || line.qty <= 0) return res.status(400).json({ message: "Invalid qty" });
      total += p * line.qty;
    }

    const { data: orderInserted, error: oErr } = await req.sb
      .from("orders")
      .insert([
        {
          customer_id: req.user.id,
          customer_name: incoming.customer_name || null,
          customer_email: incoming.customer_email || req.user.email || null,
          status: "Order confirmed",
          total,
        },
      ])
      .select("id, status, total, created_at")
      .single();

    if (oErr) return res.status(400).json({ message: oErr.message });

    const itemPayload = cart.map((line) => ({
      order_id: orderInserted.id,
      menu_item_id: line.menu_item_id,
      qty: line.qty,
      unit_price: priceById[line.menu_item_id],
    }));

    const { error: oiErr } = await req.sb.from("order_items").insert(itemPayload);
    if (oiErr) return res.status(400).json({ message: oiErr.message });

    return res.status(201).json({ success: true, order: orderInserted });
  } catch (err) {
    console.error("ORDER ERROR:", err);
    res.status(500).json({ message: "Failed to save order" });
  }
});

router.get("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await req.sb
      .from("orders")
      .select("id, status, total, created_at, customer_id, customer_name, customer_email")
      .eq("id", id)
      .single();

    if (error) return res.status(404).json({ message: "Order not found" });
    return res.json({ success: true, order: data });
  } catch (err) {
    console.error("GET ORDER ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/", requireStaffOrAdmin, async (req, res) => {
  try {
    const { data, error } = await req.sb
      .from("orders")
      .select("id, customer_id, customer_name, customer_email, status, total, created_at")
      .order("created_at", { ascending: false });

    if (error) return res.status(400).json({ message: error.message });
    res.json({ success: true, orders: data });
  } catch (err) {
    console.error("GET ORDERS ERROR:", err);
    res.status(500).json({ message: "Failed to load orders" });
  }
});

router.patch("/:id", requireStaffOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};
    if (!status) return res.status(400).json({ message: "Status required" });

    const { data, error } = await req.sb
      .from("orders")
      .update({ status })
      .eq("id", id)
      .select("id, status, total, created_at")
      .single();

    if (error) return res.status(400).json({ message: error.message });
    res.json({ success: true, order: data });
  } catch (err) {
    console.error("UPDATE ORDER ERROR:", err);
    res.status(500).json({ message: "Failed to update status" });
  }
});

module.exports = router;
