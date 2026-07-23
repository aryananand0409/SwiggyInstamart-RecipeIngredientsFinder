import express from "express";
import { extractIngredients } from "../../src/ingredients.js";

const app = express();
app.use(express.json());

app.post("/api/extract", async (req, res) => {
  try {
    const { recipeText } = req.body;
    if (!recipeText || typeof recipeText !== "string") {
      return res.status(400).json({ error: "recipeText (string) is required" });
    }
    const ingredients = await extractIngredients(recipeText);
    res.json({ ingredients });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Web server listening on http://localhost:${PORT}`);
});
