// SEP_SaigonBistro/backend/src/modules/menu/menu.routes.js

const express = require("express");
const { supabaseBase } = require("../../config/supabase");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const { data: categories, error: cErr } = await supabaseBase
      .from("menu_categories")
      .select("id, category_name, category_image")
      .order("category_name");

    if (cErr) return res.status(500).json({ message: cErr.message });

    const { data: items, error: iErr } = await supabaseBase
      .from("menu_items")
      .select("id, item_id, name, image, price, description, category_name")
      .order("item_id");

    if (iErr) return res.status(500).json({ message: iErr.message });

    const mappedItems = (items || []).map((it) => ({
      id: it.id,
      item_id: it.item_id,
      name: it.name,
      image: it.image,
      price: Number(it.price),
      description: it.description,
      category: it.category_name,
    }));

    return res.json({ categories, items: mappedItems, assets: {} });
  } catch (err) {
    console.error("MENU ERROR:", err);
    res.status(500).json({ message: "Failed to load menu" });
  }
});

module.exports = router;
