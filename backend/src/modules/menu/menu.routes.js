// SEP_SaigonBistro/backend/src/modules/menu/menu.routes.js

const express = require("express");
const { supabaseBase } = require("../../config/supabase");

const router = express.Router();

// Business logic function for unit testing
function mapMenuItems(items) { 
  return (items || []).map((it) => ({ 
    id: it.id, 
    item_id: it.item_id, 
    name: it.name, 
    image: it.image, 
    price: Number(it.price), 
    description: it.description, 
    category: it.category_name, 
  })); 
}

router.get("/", async (req, res) => {
  try {
    const [
      { data: categories, error: cErr },
      { data: items, error: iErr },
    ] = await Promise.all([
      supabaseBase
        .from("menu_categories")
        .select("id, category_name, category_image")
        .order("category_name"),
      supabaseBase
        .from("menu_items")
        .select("id, item_id, name, image, price, description, category_name")
        .order("item_id"),
    ]);

    if (cErr) return res.status(500).json({ message: cErr.message });
    if (iErr) return res.status(500).json({ message: iErr.message });

    // items exists here, so mapMenuItems can safely use it
    const mappedItems = mapMenuItems(items);

    // const mappedItems = (items || []).map((it) => ({
    //   id: it.id,
    //   item_id: it.item_id,
    //   name: it.name,
    //   image: it.image,
    //   price: Number(it.price),  // risk: no validation on the data returned, a missing or malformed price field would silently display as $0.00 or NaN with no error raised
    //   description: it.description,
    //   category: it.category_name,
    // }));

    return res.json({ 
      categories, 
      items: mappedItems, 
      assets: {} 
    });
  } catch (err) {
    console.error("MENU ERROR:", err);
    res.status(500).json({ message: "Failed to load menu" });
  }
});

// Keep exporting the router because routes/index.js expects an Express router
module.exports = router; 
// expose the business-logic function for Jest
module.exports.mapMenuItems = mapMenuItems; 

