import { useState, useMemo, useCallback } from "react";

// ═══════════════════════════════════════════════════════════════
// FINE SCONEHENGE ENTERPRISE ENGINE — Working AppSheet Model
// Complete ERP: Costing, Pricing, Batch Maximizer, Tier Gating
// ═══════════════════════════════════════════════════════════════

// ── SEED DATA (mirrors Google Sheets backend — zero formulas) ──

const PANTRY_MASTER = [
  { Ingredient_ID: "ING001", Ingredient_Name: "All-Purpose Flour", Category: "Dry", Purchase_Unit: "kg", Purchase_Quantity: 25, Purchase_Price: 18.75 },
  { Ingredient_ID: "ING002", Ingredient_Name: "Unsalted Butter", Category: "Dairy", Purchase_Unit: "kg", Purchase_Quantity: 5, Purchase_Price: 22.50 },
  { Ingredient_ID: "ING003", Ingredient_Name: "Granulated Sugar", Category: "Dry", Purchase_Unit: "kg", Purchase_Quantity: 10, Purchase_Price: 8.90 },
  { Ingredient_ID: "ING004", Ingredient_Name: "Heavy Cream", Category: "Dairy", Purchase_Unit: "L", Purchase_Quantity: 4, Purchase_Price: 14.00 },
  { Ingredient_ID: "ING005", Ingredient_Name: "Baking Powder", Category: "Leavener", Purchase_Unit: "kg", Purchase_Quantity: 1, Purchase_Price: 6.50 },
  { Ingredient_ID: "ING006", Ingredient_Name: "Vanilla Extract", Category: "Flavoring", Purchase_Unit: "L", Purchase_Quantity: 0.5, Purchase_Price: 28.00 },
  { Ingredient_ID: "ING007", Ingredient_Name: "Eggs", Category: "Dairy", Purchase_Unit: "dozen", Purchase_Quantity: 12, Purchase_Price: 4.80 },
  { Ingredient_ID: "ING008", Ingredient_Name: "Salt", Category: "Dry", Purchase_Unit: "kg", Purchase_Quantity: 1, Purchase_Price: 1.20 },
];

const RECIPE_MASTER = [
  { Recipe_ID: "REC001", Recipe_Name: "Classic Buttermilk Scone", Yield: 24, Prep_Min: 15, Active_Min: 20, Cleanup_Min: 10, Pricing_Mode: "Retail" },
  { Recipe_ID: "REC002", Recipe_Name: "Cranberry Orange Scone", Yield: 24, Prep_Min: 20, Active_Min: 25, Cleanup_Min: 10, Pricing_Mode: "Wholesale" },
  { Recipe_ID: "REC003", Recipe_Name: "Cheddar Herb Scone", Yield: 24, Prep_Min: 18, Active_Min: 22, Cleanup_Min: 10, Pricing_Mode: "Retail" },
];

const RECIPE_BRIDGE = [
  { RecipeIngredient_ID: "RI001", Recipe_ID: "REC001", Ingredient_ID: "ING001", Quantity_Used: 960 },
  { RecipeIngredient_ID: "RI002", Recipe_ID: "REC001", Ingredient_ID: "ING002", Quantity_Used: 340 },
  { RecipeIngredient_ID: "RI003", Recipe_ID: "REC001", Ingredient_ID: "ING003", Quantity_Used: 150 },
  { RecipeIngredient_ID: "RI004", Recipe_ID: "REC001", Ingredient_ID: "ING004", Quantity_Used: 480 },
  { RecipeIngredient_ID: "RI005", Recipe_ID: "REC001", Ingredient_ID: "ING005", Quantity_Used: 36 },
  { RecipeIngredient_ID: "RI006", Recipe_ID: "REC001", Ingredient_ID: "ING006", Quantity_Used: 15 },
  { RecipeIngredient_ID: "RI007", Recipe_ID: "REC001", Ingredient_ID: "ING007", Quantity_Used: 200 },
  { RecipeIngredient_ID: "RI008", Recipe_ID: "REC001", Ingredient_ID: "ING008", Quantity_Used: 12 },
  { RecipeIngredient_ID: "RI009", Recipe_ID: "REC002", Ingredient_ID: "ING001", Quantity_Used: 900 },
  { RecipeIngredient_ID: "RI010", Recipe_ID: "REC002", Ingredient_ID: "ING002", Quantity_Used: 300 },
  { RecipeIngredient_ID: "RI011", Recipe_ID: "REC002", Ingredient_ID: "ING003", Quantity_Used: 180 },
  { RecipeIngredient_ID: "RI012", Recipe_ID: "REC002", Ingredient_ID: "ING004", Quantity_Used: 420 },
  { RecipeIngredient_ID: "RI013", Recipe_ID: "REC003", Ingredient_ID: "ING001", Quantity_Used: 880 },
  { RecipeIngredient_ID: "RI014", Recipe_ID: "REC003", Ingredient_ID: "ING002", Quantity_Used: 280 },
  { RecipeIngredient_ID: "RI015", Recipe_ID: "REC003", Ingredient_ID: "ING003", Quantity_Used: 60 },
  { RecipeIngredient_ID: "RI016", Recipe_ID: "REC003", Ingredient_ID: "ING008", Quantity_Used: 18 },
];

const USER_TABLE = [
  { Email: "debbie@finesconehenge.com", Name: "Debbie Rose", Tier: "Pro", Hourly_Wage: 0 },
  { Email: "baker1@finesconehenge.com", Name: "Alex Kitchen", Tier: "Essentials", Hourly_Wage: 18.50 },
  { Email: "baker2@finesconehenge.com", Name: "Sam Oven", Tier: "Essentials", Hourly_Wage: 17.00 },
];

// ── SYSTEM CONSTANTS ──
const WASTE_PCT = 0.03;
const OVERHEAD_PCT = 0.10;
const RETAIL_MARKUP = 3.5;
const WHOLESALE_MARKUP = 2.2;
const MIXER_MAX_GRAMS = 6000;
const BASE_YIELD_PER_PAN = 24;
const BUFFER_PCT = 0.0;

// ── VIRTUAL COLUMN ENGINE (all AppSheet logic lives here) ──

function computeStandardGrams(item) {
  const unitMap = { kg: 1000, L: 1000, dozen: 1, lb: 453.592 };
  return (unitMap[item.Purchase_Unit] || 1) * item.Purchase_Quantity;
}

function computeCostPerGram(item) {
  const sg = computeStandardGrams(item);
  return sg > 0 ? item.Purchase_Price / sg : 0;
}

function computeWasteMultiplierCost(item) {
  return computeCostPerGram(item) * (1 + WASTE_PCT);
}

function computeLineCost(bridge) {
  const ing = PANTRY_MASTER.find(p => p.Ingredient_ID === bridge.Ingredient_ID);
  if (!ing) return 0;
  return bridge.Quantity_Used * computeWasteMultiplierCost(ing);
}

function computeRecipeVCs(recipe) {
  const lines = RECIPE_BRIDGE.filter(b => b.Recipe_ID === recipe.Recipe_ID);
  const ingredientSubtotal = lines.reduce((s, b) => s + computeLineCost(b), 0);
  const overhead = ingredientSubtotal * OVERHEAD_PCT;
  const user = USER_TABLE.find(u => u.Tier === "Essentials");
  const totalMin = recipe.Prep_Min + recipe.Active_Min + recipe.Cleanup_Min;
  const laborCost = user ? (user.Hourly_Wage / 60) * totalMin : 0;
  const totalBatchCost = ingredientSubtotal + overhead + laborCost;
  const costPerUnit = recipe.Yield > 0 ? totalBatchCost / recipe.Yield : 0;
  const retailPrice = costPerUnit * RETAIL_MARKUP;
  const wholesalePrice = costPerUnit * WHOLESALE_MARKUP;
  const finalPrice = recipe.Pricing_Mode === "Retail" ? retailPrice : wholesalePrice;
  const profitPerUnit = finalPrice - costPerUnit;
  const marginPct = finalPrice > 0 ? (profitPerUnit / finalPrice) * 100 : 0;
  const profitabilityStatus = marginPct >= 60 ? "Strong" : marginPct >= 40 ? "Healthy" : "Review";

  return {
    Ingredient_Subtotal: ingredientSubtotal,
    Overhead_10pct: overhead,
    Total_Labor_Cost: laborCost,
    Total_Batch_Cost: totalBatchCost,
    Cost_Per_Unit: costPerUnit,
    Retail_Price: retailPrice,
    Wholesale_Price: wholesalePrice,
    Final_Price: finalPrice,
    Profit_Per_Unit: profitPerUnit,
    Margin_Percentage: marginPct,
    Profitability_Status: profitabilityStatus,
  };
}

// ── BATCH MAXIMIZER ENGINE ──

function batchMaximizer(ordersNeeded, bufferPct = BUFFER_PCT) {
  // Pan-Yield Rounding: CEILING to next full pan
  const rawTarget = ordersNeeded * (1 + bufferPct);
  const adjustedTarget = Math.ceil(rawTarget / BASE_YIELD_PER_PAN) * BASE_YIELD_PER_PAN;

  // Get total grams for Classic Scone recipe as baseline
  const recipe = RECIPE_MASTER[0];
  const lines = RECIPE_BRIDGE.filter(b => b.Recipe_ID === recipe.Recipe_ID);
  const gramsPerBatch = lines.reduce((s, b) => s + b.Quantity_Used, 0);
  const batchesNeeded = adjustedTarget / recipe.Yield;
  const totalGrams = gramsPerBatch * batchesNeeded;

  // Mixer Capacity Split
  const mixEventCount = Math.ceil(totalGrams / MIXER_MAX_GRAMS);
  const gramsPerMix = totalGrams / mixEventCount;

  // Build mix events with Clean-Scale rounding
  const mixEvents = [];
  for (let i = 0; i < mixEventCount; i++) {
    const ratio = gramsPerMix / gramsPerBatch;
    const ingredients = lines.map(b => {
      const ing = PANTRY_MASTER.find(p => p.Ingredient_ID === b.Ingredient_ID);
      return {
        name: ing?.Ingredient_Name || b.Ingredient_ID,
        grams: Math.round(b.Quantity_Used * ratio), // Clean-Scale Rule: ROUND()
      };
    });
    mixEvents.push({ mixNumber: i + 1, ingredients, totalGrams: Math.round(gramsPerMix) });
  }

  return {
    ordersNeeded,
    adjustedTarget,
    pansRequired: adjustedTarget / BASE_YIELD_PER_PAN,
    totalGrams: Math.round(totalGrams),
    mixEventCount,
    mixEvents,
  };
}

// ── CONSOLIDATED SHOPPING LIST ──

function computeShoppingList(productions) {
  const agg = {};
  productions.forEach(prod => {
    const recipe = RECIPE_MASTER.find(r => r.Recipe_ID === prod.Recipe_ID);
    if (!recipe) return;
    const lines = RECIPE_BRIDGE.filter(b => b.Recipe_ID === recipe.Recipe_ID);
    lines.forEach(b => {
      const ing = PANTRY_MASTER.find(p => p.Ingredient_ID === b.Ingredient_ID);
      if (!ing) return;
      const grams = Math.round(b.Quantity_Used * prod.Batch_Multiplier);
      if (!agg[b.Ingredient_ID]) {
        agg[b.Ingredient_ID] = { name: ing.Ingredient_Name, totalGrams: 0, unit: ing.Purchase_Unit };
      }
      agg[b.Ingredient_ID].totalGrams += grams;
    });
  });
  return Object.values(agg).sort((a, b) => b.totalGrams - a.totalGrams);
}

// ═══════════════════════════════════════════════════════════════
// UI COMPONENTS
// ═══════════════════════════════════════════════════════════════

const fmt = (v, d = 2) => typeof v === "number" ? v.toFixed(d) : "—";
const fmtMoney = (v) => `$${fmt(v)}`;

const tabs = [
  { id: "dashboard", label: "Dashboard" },
  { id: "pantry", label: "Pantry" },
  { id: "recipes", label: "Recipes" },
  { id: "batch", label: "Batch Maximizer" },
  { id: "planner", label: "Production" },
  { id: "shopping", label: "Shopping List" },
  { id: "qa", label: "50-Scone QA" },
];

export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [currentUser, setCurrentUser] = useState(USER_TABLE[0]);
  const isPro = currentUser.Tier === "Pro";

  const [batchOrderInput, setBatchOrderInput] = useState(50);
  const [batchBuffer, setBatchBuffer] = useState(0);

  const batchResult = useMemo(() => batchMaximizer(batchOrderInput, batchBuffer / 100), [batchOrderInput, batchBuffer]);

  const recipeVCs = useMemo(() => RECIPE_MASTER.map(r => ({ ...r, vc: computeRecipeVCs(r) })), []);

  const productions = useMemo(() => [
    { Production_ID: "PROD001", Date: "2026-03-29", Recipe_ID: "REC001", Batch_Multiplier: 2, User_Email: "baker1@finesconehenge.com" },
    { Production_ID: "PROD002", Date: "2026-03-29", Recipe_ID: "REC002", Batch_Multiplier: 1, User_Email: "baker2@finesconehenge.com" },
  ], []);

  const shoppingList = useMemo(() => computeShoppingList(productions), [productions]);

  const statusColor = (s) => s === "Strong" ? "#16a34a" : s === "Healthy" ? "#d97706" : "#dc2626";

  return (
    <div style={{
      fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
      background: "#faf7f2",
      minHeight: "100vh",
      color: "#2c1810",
    }}>
      {/* HEADER */}
      <div style={{
        background: "linear-gradient(135deg, #3b1f0b 0%, #6b3a1f 50%, #8b5e3c 100%)",
        padding: "20px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 12,
      }}>
        <div>
          <h1 style={{ color: "#f5e6d3", margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: 1 }}>
            🥐 Fine Sconehenge Enterprise Engine
          </h1>
          <p style={{ color: "#c9a882", margin: "4px 0 0", fontSize: 12, letterSpacing: 2, textTransform: "uppercase" }}>
            AppSheet ERP Model v2.2 — Costing · Pricing · Batch Maximizer
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <select
            value={currentUser.Email}
            onChange={e => setCurrentUser(USER_TABLE.find(u => u.Email === e.target.value))}
            style={{
              background: "#5a3520",
              color: "#f5e6d3",
              border: "1px solid #8b5e3c",
              borderRadius: 6,
              padding: "6px 12px",
              fontSize: 13,
            }}
          >
            {USER_TABLE.map(u => (
              <option key={u.Email} value={u.Email}>{u.Name} ({u.Tier})</option>
            ))}
          </select>
          <span style={{
            background: isPro ? "#16a34a" : "#6b7280",
            color: "#fff",
            padding: "4px 10px",
            borderRadius: 20,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 1,
          }}>
            {currentUser.Tier.toUpperCase()}
          </span>
        </div>
      </div>

      {/* TABS */}
      <div style={{
        display: "flex",
        gap: 0,
        background: "#e8ddd0",
        borderBottom: "2px solid #c9a882",
        overflowX: "auto",
      }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              padding: "10px 18px",
              border: "none",
              background: activeTab === t.id ? "#faf7f2" : "transparent",
              color: activeTab === t.id ? "#3b1f0b" : "#8b5e3c",
              fontWeight: activeTab === t.id ? 700 : 500,
              fontSize: 13,
              cursor: "pointer",
              borderBottom: activeTab === t.id ? "3px solid #3b1f0b" : "3px solid transparent",
              whiteSpace: "nowrap",
              transition: "all 0.2s",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* CONTENT */}
      <div style={{ padding: "20px 24px", maxWidth: 1100, margin: "0 auto" }}>

        {/* ── DASHBOARD ── */}
        {activeTab === "dashboard" && (
          <div>
            <h2 style={{ fontSize: 18, marginBottom: 16, color: "#3b1f0b" }}>System Dashboard</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 24 }}>
              {[
                { label: "Ingredients", value: PANTRY_MASTER.length, sub: "Pantry Master" },
                { label: "Recipes", value: RECIPE_MASTER.length, sub: "Recipe Master" },
                { label: "Virtual Columns", value: "20+", sub: "Zero Sheet Formulas" },
                { label: "Tables", value: 8, sub: "Blueprint v2.2" },
              ].map((c, i) => (
                <div key={i} style={{
                  background: "#fff",
                  borderRadius: 10,
                  padding: "18px 16px",
                  border: "1px solid #e8ddd0",
                  boxShadow: "0 1px 3px rgba(59,31,11,0.06)",
                }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: "#3b1f0b" }}>{c.value}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#6b3a1f", marginTop: 2 }}>{c.label}</div>
                  <div style={{ fontSize: 11, color: "#8b5e3c", marginTop: 2 }}>{c.sub}</div>
                </div>
              ))}
            </div>

            <div style={{
              background: "#fff",
              borderRadius: 10,
              padding: 20,
              border: "1px solid #e8ddd0",
              marginBottom: 20,
            }}>
              <h3 style={{ fontSize: 15, margin: "0 0 14px", color: "#3b1f0b" }}>Core Developer Rules (from Binder v2.2)</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 13 }}>
                {[
                  "Column names must match exactly (case-sensitive)",
                  "All formulas = Virtual Columns only",
                  "Batch Maximizer rules are mandatory",
                  "No change to Sheet structure without owner approval",
                  "Zero-Sheet-Formula policy enforced",
                  "50-Scone Test must pass before delivery",
                ].map((r, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <span style={{ color: "#16a34a", fontWeight: 700, flexShrink: 0 }}>✓</span>
                    <span style={{ color: "#4a3020" }}>{r}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{
              background: "linear-gradient(135deg, #3b1f0b, #6b3a1f)",
              borderRadius: 10,
              padding: 20,
              color: "#f5e6d3",
            }}>
              <h3 style={{ fontSize: 15, margin: "0 0 8px" }}>Tier Gating Status</h3>
              <p style={{ fontSize: 13, margin: 0, opacity: 0.9 }}>
                Logged in as <strong>{currentUser.Name}</strong> ({currentUser.Tier}).
                {isPro
                  ? " Full access to pricing, margins, and production planner."
                  : " Pricing data, margins, and profit columns are hidden. Switch to Pro user above to unlock."}
              </p>
            </div>
          </div>
        )}

        {/* ── PANTRY ── */}
        {activeTab === "pantry" && (
          <div>
            <h2 style={{ fontSize: 18, marginBottom: 4, color: "#3b1f0b" }}>Pantry Master</h2>
            <p style={{ fontSize: 13, color: "#8b5e3c", marginBottom: 16 }}>Real columns stored in Google Sheet. Virtual Columns computed in AppSheet.</p>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, background: "#fff", borderRadius: 8, overflow: "hidden" }}>
                <thead>
                  <tr style={{ background: "#3b1f0b", color: "#f5e6d3" }}>
                    {["ID", "Ingredient", "Category", "Unit", "Qty", "Price", "Std Grams (VC)", "Cost/g (VC)", "Waste Adj (VC)"].map(h => (
                      <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PANTRY_MASTER.map((item, i) => (
                    <tr key={item.Ingredient_ID} style={{ background: i % 2 === 0 ? "#fff" : "#faf7f2", borderBottom: "1px solid #e8ddd0" }}>
                      <td style={{ padding: "8px 12px", fontFamily: "monospace", fontSize: 11, color: "#8b5e3c" }}>{item.Ingredient_ID}</td>
                      <td style={{ padding: "8px 12px", fontWeight: 600 }}>{item.Ingredient_Name}</td>
                      <td style={{ padding: "8px 12px" }}>{item.Category}</td>
                      <td style={{ padding: "8px 12px" }}>{item.Purchase_Unit}</td>
                      <td style={{ padding: "8px 12px", textAlign: "right" }}>{item.Purchase_Quantity}</td>
                      <td style={{ padding: "8px 12px", textAlign: "right" }}>{fmtMoney(item.Purchase_Price)}</td>
                      <td style={{ padding: "8px 12px", textAlign: "right", color: "#6b3a1f", fontWeight: 600 }}>{fmt(computeStandardGrams(item), 0)}g</td>
                      <td style={{ padding: "8px 12px", textAlign: "right", color: "#6b3a1f", fontWeight: 600 }}>{fmtMoney(computeCostPerGram(item))}</td>
                      <td style={{ padding: "8px 12px", textAlign: "right", color: "#6b3a1f", fontWeight: 600 }}>{fmtMoney(computeWasteMultiplierCost(item))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: 14, padding: 12, background: "#fef3c7", borderRadius: 8, fontSize: 12, color: "#92400e", border: "1px solid #fcd34d" }}>
              <strong>VC Logic:</strong> Standard_Grams = Purchase_Quantity × unit_conversion · Cost_Per_Gram = Purchase_Price / Standard_Grams · Waste_Adj = Cost_Per_Gram × (1 + {WASTE_PCT * 100}%)
            </div>
          </div>
        )}

        {/* ── RECIPES ── */}
        {activeTab === "recipes" && (
          <div>
            <h2 style={{ fontSize: 18, marginBottom: 16, color: "#3b1f0b" }}>Recipe Master — Costing & Pricing VCs</h2>
            {recipeVCs.map(r => (
              <div key={r.Recipe_ID} style={{
                background: "#fff",
                borderRadius: 10,
                padding: 20,
                marginBottom: 16,
                border: "1px solid #e8ddd0",
                boxShadow: "0 1px 3px rgba(59,31,11,0.06)",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16, color: "#3b1f0b" }}>{r.Recipe_Name}</h3>
                    <div style={{ fontSize: 12, color: "#8b5e3c", marginTop: 4 }}>
                      Yield: {r.Yield} · Prep: {r.Prep_Min}m · Active: {r.Active_Min}m · Cleanup: {r.Cleanup_Min}m ·
                      Mode: <strong>{r.Pricing_Mode}</strong>
                    </div>
                  </div>
                  <span style={{
                    background: statusColor(r.vc.Profitability_Status) + "18",
                    color: statusColor(r.vc.Profitability_Status),
                    padding: "4px 12px",
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 700,
                    border: `1px solid ${statusColor(r.vc.Profitability_Status)}40`,
                  }}>
                    {r.vc.Profitability_Status}
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
                  {[
                    { label: "Ingredient Subtotal", val: fmtMoney(r.vc.Ingredient_Subtotal) },
                    { label: "Overhead (10%)", val: fmtMoney(r.vc.Overhead_10pct) },
                    { label: "Labor Cost", val: fmtMoney(r.vc.Total_Labor_Cost) },
                    { label: "Batch Cost", val: fmtMoney(r.vc.Total_Batch_Cost) },
                    { label: "Cost/Unit", val: fmtMoney(r.vc.Cost_Per_Unit) },
                    { label: "Final Price", val: isPro ? fmtMoney(r.vc.Final_Price) : "🔒 Pro", pro: true },
                    { label: "Profit/Unit", val: isPro ? fmtMoney(r.vc.Profit_Per_Unit) : "🔒 Pro", pro: true },
                    { label: "Margin %", val: isPro ? `${fmt(r.vc.Margin_Percentage)}%` : "🔒 Pro", pro: true },
                  ].map((c, i) => (
                    <div key={i} style={{
                      padding: "10px 12px",
                      background: c.pro && !isPro ? "#f3f0eb" : "#faf7f2",
                      borderRadius: 8,
                      border: "1px solid #e8ddd0",
                      opacity: c.pro && !isPro ? 0.6 : 1,
                    }}>
                      <div style={{ fontSize: 11, color: "#8b5e3c", marginBottom: 2 }}>{c.label}</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: c.pro && !isPro ? "#999" : "#3b1f0b" }}>{c.val}</div>
                    </div>
                  ))}
                </div>

                {/* Bridge lines */}
                <details style={{ marginTop: 12 }}>
                  <summary style={{ fontSize: 12, color: "#6b3a1f", cursor: "pointer", fontWeight: 600 }}>
                    View Ingredient Lines (Recipe_Bridge)
                  </summary>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginTop: 8 }}>
                    <thead>
                      <tr style={{ borderBottom: "2px solid #e8ddd0" }}>
                        <th style={{ textAlign: "left", padding: "6px 8px", color: "#8b5e3c" }}>Ingredient</th>
                        <th style={{ textAlign: "right", padding: "6px 8px", color: "#8b5e3c" }}>Qty (g)</th>
                        <th style={{ textAlign: "right", padding: "6px 8px", color: "#8b5e3c" }}>Line Cost (VC)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {RECIPE_BRIDGE.filter(b => b.Recipe_ID === r.Recipe_ID).map(b => {
                        const ing = PANTRY_MASTER.find(p => p.Ingredient_ID === b.Ingredient_ID);
                        return (
                          <tr key={b.RecipeIngredient_ID} style={{ borderBottom: "1px solid #f0ebe4" }}>
                            <td style={{ padding: "6px 8px" }}>{ing?.Ingredient_Name}</td>
                            <td style={{ padding: "6px 8px", textAlign: "right" }}>{b.Quantity_Used}g</td>
                            <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 600, color: "#6b3a1f" }}>{fmtMoney(computeLineCost(b))}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </details>
              </div>
            ))}
          </div>
        )}

        {/* ── BATCH MAXIMIZER ── */}
        {activeTab === "batch" && (
          <div>
            <h2 style={{ fontSize: 18, marginBottom: 4, color: "#3b1f0b" }}>Batch Maximizer</h2>
            <p style={{ fontSize: 13, color: "#8b5e3c", marginBottom: 16 }}>Pan-Yield Rounding · Mixer Capacity Split · Clean-Scale Rounding</p>

            <div style={{
              background: "#fff",
              borderRadius: 10,
              padding: 20,
              border: "1px solid #e8ddd0",
              marginBottom: 20,
            }}>
              <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 20 }}>
                <div>
                  <label style={{ fontSize: 12, color: "#8b5e3c", fontWeight: 600, display: "block", marginBottom: 4 }}>Orders Needed</label>
                  <input
                    type="number"
                    value={batchOrderInput}
                    onChange={e => setBatchOrderInput(Math.max(1, parseInt(e.target.value) || 1))}
                    style={{
                      width: 120,
                      padding: "8px 12px",
                      border: "2px solid #c9a882",
                      borderRadius: 8,
                      fontSize: 18,
                      fontWeight: 700,
                      color: "#3b1f0b",
                      textAlign: "center",
                      background: "#faf7f2",
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: "#8b5e3c", fontWeight: 600, display: "block", marginBottom: 4 }}>Buffer %</label>
                  <input
                    type="number"
                    value={batchBuffer}
                    onChange={e => setBatchBuffer(Math.max(0, parseInt(e.target.value) || 0))}
                    style={{
                      width: 80,
                      padding: "8px 12px",
                      border: "2px solid #c9a882",
                      borderRadius: 8,
                      fontSize: 18,
                      fontWeight: 700,
                      color: "#3b1f0b",
                      textAlign: "center",
                      background: "#faf7f2",
                    }}
                  />
                </div>
              </div>

              {/* Results */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
                {[
                  { label: "Orders Requested", val: batchResult.ordersNeeded, unit: "scones" },
                  { label: "Adjusted Target", val: batchResult.adjustedTarget, unit: "scones", highlight: true },
                  { label: "Pans Required", val: batchResult.pansRequired, unit: "full pans" },
                  { label: "Total Dough", val: `${batchResult.totalGrams}`, unit: "grams" },
                  { label: "Mix Events", val: batchResult.mixEventCount, unit: batchResult.mixEventCount > 1 ? "batches" : "batch" },
                  { label: "Mixer Limit", val: `${MIXER_MAX_GRAMS}`, unit: "g max" },
                ].map((c, i) => (
                  <div key={i} style={{
                    padding: "14px 14px",
                    background: c.highlight ? "#3b1f0b" : "#faf7f2",
                    borderRadius: 8,
                    border: c.highlight ? "none" : "1px solid #e8ddd0",
                  }}>
                    <div style={{ fontSize: 11, color: c.highlight ? "#c9a882" : "#8b5e3c", marginBottom: 2, fontWeight: 600 }}>{c.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: c.highlight ? "#f5e6d3" : "#3b1f0b" }}>{c.val}</div>
                    <div style={{ fontSize: 11, color: c.highlight ? "#c9a882" : "#8b5e3c" }}>{c.unit}</div>
                  </div>
                ))}
              </div>

              {/* Formula */}
              <div style={{
                background: "#fef3c7",
                borderRadius: 8,
                padding: 14,
                marginBottom: 20,
                border: "1px solid #fcd34d",
                fontSize: 12,
              }}>
                <strong style={{ color: "#92400e" }}>Pan-Yield Formula (CEILING):</strong>
                <code style={{ display: "block", marginTop: 6, fontFamily: "monospace", color: "#78350f", lineHeight: 1.6 }}>
                  CEILING(({batchOrderInput} × (1 + {batchBuffer}%)) / {BASE_YIELD_PER_PAN}) × {BASE_YIELD_PER_PAN} = {batchResult.adjustedTarget}
                </code>
              </div>

              {/* Mix Events */}
              <h3 style={{ fontSize: 15, margin: "0 0 12px", color: "#3b1f0b" }}>Mix Event Breakdown (Clean-Scale Rounded)</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
                {batchResult.mixEvents.map(mix => (
                  <div key={mix.mixNumber} style={{
                    background: "#faf7f2",
                    borderRadius: 8,
                    padding: 16,
                    border: "1px solid #e8ddd0",
                  }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#3b1f0b", marginBottom: 8 }}>
                      Mix #{mix.mixNumber} — {mix.totalGrams}g total
                    </div>
                    {mix.ingredients.map((ing, j) => (
                      <div key={j} style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "4px 0",
                        borderBottom: j < mix.ingredients.length - 1 ? "1px solid #e8ddd0" : "none",
                        fontSize: 13,
                      }}>
                        <span style={{ color: "#4a3020" }}>{ing.name}</span>
                        <span style={{ fontWeight: 700, color: "#3b1f0b", fontFamily: "monospace" }}>{ing.grams}g</span>
                      </div>
                    ))}
                    <div style={{
                      marginTop: 8,
                      padding: "4px 8px",
                      background: mix.totalGrams <= MIXER_MAX_GRAMS ? "#dcfce7" : "#fee2e2",
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 600,
                      color: mix.totalGrams <= MIXER_MAX_GRAMS ? "#166534" : "#991b1b",
                      textAlign: "center",
                    }}>
                      {mix.totalGrams <= MIXER_MAX_GRAMS ? `✓ Within mixer capacity (${MIXER_MAX_GRAMS}g)` : `✗ EXCEEDS mixer capacity!`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── PRODUCTION PLANNER ── */}
        {activeTab === "planner" && (
          <div>
            <h2 style={{ fontSize: 18, marginBottom: 4, color: "#3b1f0b" }}>Production Planner</h2>
            <p style={{ fontSize: 13, color: "#8b5e3c", marginBottom: 16 }}>
              {isPro ? "Full access to production planning." : "🔒 Production Planner requires Pro tier access."}
            </p>
            {isPro ? (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, background: "#fff", borderRadius: 8, overflow: "hidden" }}>
                  <thead>
                    <tr style={{ background: "#3b1f0b", color: "#f5e6d3" }}>
                      {["ID", "Date", "Recipe", "Multiplier", "Assigned To", "Total Grams (VC)"].map(h => (
                        <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {productions.map((p, i) => {
                      const recipe = RECIPE_MASTER.find(r => r.Recipe_ID === p.Recipe_ID);
                      const lines = RECIPE_BRIDGE.filter(b => b.Recipe_ID === p.Recipe_ID);
                      const totalGrams = Math.round(lines.reduce((s, b) => s + b.Quantity_Used, 0) * p.Batch_Multiplier);
                      const user = USER_TABLE.find(u => u.Email === p.User_Email);
                      return (
                        <tr key={p.Production_ID} style={{ background: i % 2 === 0 ? "#fff" : "#faf7f2", borderBottom: "1px solid #e8ddd0" }}>
                          <td style={{ padding: "8px 12px", fontFamily: "monospace", fontSize: 11, color: "#8b5e3c" }}>{p.Production_ID}</td>
                          <td style={{ padding: "8px 12px" }}>{p.Date}</td>
                          <td style={{ padding: "8px 12px", fontWeight: 600 }}>{recipe?.Recipe_Name}</td>
                          <td style={{ padding: "8px 12px", textAlign: "center" }}>×{p.Batch_Multiplier}</td>
                          <td style={{ padding: "8px 12px" }}>{user?.Name}</td>
                          <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700, color: "#6b3a1f" }}>{totalGrams}g</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{
                background: "#f3f0eb",
                borderRadius: 10,
                padding: 40,
                textAlign: "center",
                border: "1px solid #e8ddd0",
              }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🔒</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: "#6b3a1f" }}>Pro Tier Required</div>
                <div style={{ fontSize: 13, color: "#8b5e3c", marginTop: 6 }}>
                  Switch to a Pro user account to access the Production Planner.
                  <br />Tier gating uses: LOOKUP(USEREMAIL(), "User_Table", "Email", "Tier") = "Pro"
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── SHOPPING LIST ── */}
        {activeTab === "shopping" && (
          <div>
            <h2 style={{ fontSize: 18, marginBottom: 4, color: "#3b1f0b" }}>Consolidated Shopping List</h2>
            <p style={{ fontSize: 13, color: "#8b5e3c", marginBottom: 16 }}>Slice: Today_Production — aggregated across all today's production runs.</p>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, background: "#fff", borderRadius: 8, overflow: "hidden" }}>
                <thead>
                  <tr style={{ background: "#3b1f0b", color: "#f5e6d3" }}>
                    <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600 }}>Ingredient</th>
                    <th style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600 }}>Total Required (g)</th>
                    <th style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600 }}>Rounded (Clean-Scale)</th>
                  </tr>
                </thead>
                <tbody>
                  {shoppingList.map((item, i) => (
                    <tr key={item.name} style={{ background: i % 2 === 0 ? "#fff" : "#faf7f2", borderBottom: "1px solid #e8ddd0" }}>
                      <td style={{ padding: "8px 12px", fontWeight: 600 }}>{item.name}</td>
                      <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "monospace" }}>{item.totalGrams}g</td>
                      <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700, color: "#3b1f0b", fontFamily: "monospace" }}>{Math.round(item.totalGrams)}g</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: 14, padding: 12, background: "#dcfce7", borderRadius: 8, fontSize: 12, color: "#166534", border: "1px solid #86efac" }}>
              <strong>✓ Clean-Scale Rule:</strong> All weights are whole grams — no decimals shown to staff.
            </div>
          </div>
        )}

        {/* ── 50-SCONE QA TEST ── */}
        {activeTab === "qa" && (
          <div>
            <h2 style={{ fontSize: 18, marginBottom: 4, color: "#3b1f0b" }}>50-Scone Test Scenario — QA Validation</h2>
            <p style={{ fontSize: 13, color: "#8b5e3c", marginBottom: 16 }}>Mandatory pass before project delivery. Tests pan rounding, mixer splits, and clean-scale rules.</p>

            {(() => {
              const qa = batchMaximizer(50);
              const noDecimals = qa.mixEvents.every(m => m.ingredients.every(i => Number.isInteger(i.grams)));
              const noPartialPans = qa.adjustedTarget % BASE_YIELD_PER_PAN === 0;
              const noMixOverCapacity = qa.mixEvents.every(m => m.totalGrams <= MIXER_MAX_GRAMS);
              const allPass = noDecimals && noPartialPans && noMixOverCapacity;

              return (
                <div>
                  <div style={{
                    background: allPass ? "#dcfce7" : "#fee2e2",
                    borderRadius: 10,
                    padding: 20,
                    marginBottom: 20,
                    border: `2px solid ${allPass ? "#86efac" : "#fca5a5"}`,
                    textAlign: "center",
                  }}>
                    <div style={{ fontSize: 48, marginBottom: 8 }}>{allPass ? "✅" : "❌"}</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: allPass ? "#166534" : "#991b1b" }}>
                      {allPass ? "ALL QA TESTS PASSED" : "QA TESTS FAILED"}
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14, marginBottom: 20 }}>
                    {[
                      { test: "Pan-Yield Rounding", pass: noPartialPans, detail: `50 scones → ${qa.adjustedTarget} (${qa.pansRequired} full pans of ${BASE_YIELD_PER_PAN})` },
                      { test: "Mixer Capacity Split", pass: noMixOverCapacity, detail: `${qa.mixEventCount} mix event(s), each ≤ ${MIXER_MAX_GRAMS}g` },
                      { test: "Clean-Scale (No Decimals)", pass: noDecimals, detail: "All staff-facing weights are whole grams" },
                      { test: "No Partial Pans", pass: noPartialPans, detail: `${qa.adjustedTarget} ÷ ${BASE_YIELD_PER_PAN} = ${qa.pansRequired} (integer)` },
                    ].map((t, i) => (
                      <div key={i} style={{
                        background: "#fff",
                        borderRadius: 8,
                        padding: 16,
                        border: `2px solid ${t.pass ? "#86efac" : "#fca5a5"}`,
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <span style={{ fontSize: 18 }}>{t.pass ? "✅" : "❌"}</span>
                          <span style={{ fontSize: 14, fontWeight: 700, color: "#3b1f0b" }}>{t.test}</span>
                        </div>
                        <div style={{ fontSize: 12, color: "#6b3a1f" }}>{t.detail}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{
                    background: "#fff",
                    borderRadius: 10,
                    padding: 20,
                    border: "1px solid #e8ddd0",
                  }}>
                    <h3 style={{ fontSize: 15, margin: "0 0 12px", color: "#3b1f0b" }}>50-Scone Trace</h3>
                    <div style={{ fontFamily: "monospace", fontSize: 12, lineHeight: 1.8, color: "#4a3020" }}>
                      <div>Input: 50 scones ordered</div>
                      <div>Formula: CEILING(50 / 24) × 24 = <strong>{qa.adjustedTarget}</strong></div>
                      <div>Pans: {qa.adjustedTarget} ÷ 24 = <strong>{qa.pansRequired}</strong> full pans</div>
                      <div>Total dough: <strong>{qa.totalGrams}g</strong></div>
                      <div>Mixer limit: {MIXER_MAX_GRAMS}g → <strong>{qa.mixEventCount} mix event(s)</strong></div>
                      <div>Decimals in weights: <strong>{noDecimals ? "NONE ✓" : "FOUND ✗"}</strong></div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* FOOTER */}
      <div style={{
        background: "#3b1f0b",
        padding: "16px 24px",
        textAlign: "center",
        fontSize: 11,
        color: "#8b5e3c",
        marginTop: 40,
      }}>
        Fine Sconehenge Enterprise Engine v2.2 · AppSheet Working Model · Zero-Sheet-Formula Policy · Blueprint Adherent
      </div>
    </div>
  );
}
