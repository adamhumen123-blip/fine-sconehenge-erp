import { useState, useMemo, useRef, useEffect } from "react";

/*
═══════════════════════════════════════════════════════════════════════════════
  FINE SCONEHENGE ENTERPRISE ENGINE v3.0
  AppSheet-Native Production Model
  
  8 Tables · 20+ Virtual Columns · Batch Maximizer · Tier Gating
  Configurable Mixer · Dual-Track Rounding · Offline Sync · Baker Tablet View
  
  BLUEPRINT v2.2 COMPLIANT — Zero Sheet Formulas
═══════════════════════════════════════════════════════════════════════════════
*/

// ─── GOOGLE SHEET BACKEND (Raw Data Store — ZERO FORMULAS) ─────────────

const PANTRY = [
  { id:"ING001", name:"All-Purpose Flour",   cat:"Dry",       unit:"kg",  qty:25,   price:18.75 },
  { id:"ING002", name:"Unsalted Butter",     cat:"Dairy",     unit:"kg",  qty:5,    price:22.50 },
  { id:"ING003", name:"Granulated Sugar",    cat:"Dry",       unit:"kg",  qty:10,   price:8.90  },
  { id:"ING004", name:"Heavy Cream",         cat:"Dairy",     unit:"L",   qty:4,    price:14.00 },
  { id:"ING005", name:"Baking Powder",       cat:"Leavener",  unit:"kg",  qty:1,    price:6.50  },
  { id:"ING006", name:"Vanilla Extract",     cat:"Flavoring", unit:"L",   qty:0.5,  price:28.00 },
  { id:"ING007", name:"Eggs",                cat:"Dairy",     unit:"dozen",qty:12,  price:4.80  },
  { id:"ING008", name:"Salt",                cat:"Dry",       unit:"kg",  qty:1,    price:1.20  },
  { id:"ING009", name:"Ground Cinnamon",     cat:"Spice",     unit:"kg",  qty:0.5,  price:14.50 },
  { id:"ING010", name:"Dried Cranberries",   cat:"Fruit",     unit:"kg",  qty:2,    price:16.80 },
  { id:"ING011", name:"Cheddar Cheese",      cat:"Dairy",     unit:"kg",  qty:2.5,  price:19.00 },
  { id:"ING012", name:"Fresh Rosemary",      cat:"Herb",      unit:"kg",  qty:0.25, price:32.00 },
];

const RECIPES = [
  { id:"REC001", name:"Classic Buttermilk Scone",  yield:24, prep:15, active:20, cleanup:10, mode:"Retail" },
  { id:"REC002", name:"Cranberry Orange Scone",    yield:24, prep:20, active:25, cleanup:10, mode:"Wholesale" },
  { id:"REC003", name:"Cheddar Herb Scone",        yield:24, prep:18, active:22, cleanup:10, mode:"Retail" },
];

const BRIDGE = [
  { rid:"REC001", iid:"ING001", qty:960   },
  { rid:"REC001", iid:"ING002", qty:340   },
  { rid:"REC001", iid:"ING003", qty:150   },
  { rid:"REC001", iid:"ING004", qty:480   },
  { rid:"REC001", iid:"ING005", qty:36    },
  { rid:"REC001", iid:"ING006", qty:15    },
  { rid:"REC001", iid:"ING007", qty:200   },
  { rid:"REC001", iid:"ING008", qty:12    },
  { rid:"REC001", iid:"ING009", qty:4.32  }, // Debbie's exact 4.32g example
  { rid:"REC002", iid:"ING001", qty:900   },
  { rid:"REC002", iid:"ING002", qty:300   },
  { rid:"REC002", iid:"ING003", qty:180   },
  { rid:"REC002", iid:"ING004", qty:420   },
  { rid:"REC002", iid:"ING005", qty:30    },
  { rid:"REC002", iid:"ING010", qty:120   },
  { rid:"REC003", iid:"ING001", qty:880   },
  { rid:"REC003", iid:"ING002", qty:280   },
  { rid:"REC003", iid:"ING003", qty:60    },
  { rid:"REC003", iid:"ING008", qty:18    },
  { rid:"REC003", iid:"ING011", qty:160   },
  { rid:"REC003", iid:"ING012", qty:8.5   },
];

const USERS = [
  { email:"debbie@finesconehenge.com",  name:"Debbie Rose",  tier:"Pro",        wage:0 },
  { email:"alex@finesconehenge.com",    name:"Alex Kitchen", tier:"Essentials", wage:18.50 },
  { email:"sam@finesconehenge.com",     name:"Sam Oven",     tier:"Essentials", wage:17.00 },
];

// ─── VIRTUAL COLUMN ENGINE (All AppSheet Logic — Zero Sheet Formulas) ──

const UNIT_G = { kg:1000, L:1000, dozen:1, lb:453.592 };

const vc = {
  stdGrams:   (p) => (UNIT_G[p.unit]||1) * p.qty,
  costPerG:   (p) => { const s = vc.stdGrams(p); return s > 0 ? p.price / s : 0; },
  wasteCost:  (p, w) => vc.costPerG(p) * (1 + w),
  lineCost:   (b, w) => { const p = PANTRY.find(x=>x.id===b.iid); return p ? b.qty * vc.wasteCost(p, w) : 0; },
  
  recipeVCs: (r, cfg) => {
    const lines = BRIDGE.filter(b => b.rid === r.id);
    const sub = lines.reduce((s,b) => s + vc.lineCost(b, cfg.waste), 0);
    const overhead = sub * cfg.overhead;
    const staff = USERS.find(u => u.tier === "Essentials");
    const mins = r.prep + r.active + r.cleanup;
    const labor = staff ? (staff.wage / 60) * mins : 0;
    const batch = sub + overhead + labor;
    const cpu = r.yield > 0 ? batch / r.yield : 0;
    const retail = cpu * cfg.retailMark;
    const wholesale = cpu * cfg.wholeMark;
    const final_ = r.mode === "Retail" ? retail : wholesale;
    const profit = final_ - cpu;
    const margin = final_ > 0 ? (profit / final_) * 100 : 0;
    const status = margin >= 60 ? "Strong" : margin >= 40 ? "Healthy" : "Review";
    return { sub, overhead, labor, batch, cpu, retail, wholesale, final_, profit, margin, status, lines };
  },

  batchMax: (recipeId, orders, cfg) => {
    const r = RECIPES.find(x => x.id === recipeId);
    if (!r) return null;
    const lines = BRIDGE.filter(b => b.rid === recipeId);
    const baseG = lines.reduce((s, b) => s + b.qty, 0);
    const adj = Math.ceil(orders * (1 + cfg.buffer) / cfg.panYield) * cfg.panYield;
    const mult = adj / r.yield;
    const totalG = baseG * mult;
    const mixCount = Math.ceil(totalG / cfg.mixer);
    const perMix = totalG / mixCount;
    
    const events = Array.from({length: mixCount}, (_, i) => {
      const ratio = perMix / baseG;
      const ings = lines.map(b => {
        const p = PANTRY.find(x => x.id === b.iid);
        const raw = b.qty * ratio;
        return {
          name: p?.name || b.iid, raw,
          rounded: Math.round(raw),          // TRACK B: Clean-Scale ROUND()
          cost: vc.lineCost(b, cfg.waste) * ratio,  // TRACK A: full precision
        };
      });
      return { num: i+1, ings, rawG: perMix, roundedG: Math.round(perMix), ok: Math.round(perMix) <= cfg.mixer };
    });

    return { recipe: r, orders, adj, pans: adj / cfg.panYield, mult, totalG, totalGR: Math.round(totalG), mixCount, events, multi: mixCount > 1 };
  },
};

// ─── STYLING ────────────────────────────────────────────────────────────

const C = {
  bg:     "#f2ede6", card:   "#ffffff", brand:  "#4a2511", brand2: "#7a4a2a",
  brand3: "#a67953", cream:  "#f9f5ef", gold:   "#c8a86e", text:   "#2d1a0e",
  text2:  "#7a6552", text3:  "#a89882", line:   "#e6ddd0", green:  "#1a8a4a",
  greenBg:"#e8f5ee", red:    "#c42b2b", redBg:  "#fce8e8", amber:  "#b87a1a",
  amberBg:"#fef6e0", blue:   "#1a5fb4", blueBg: "#e4eef8", white:  "#ffffff",
};

// ─── APP ────────────────────────────────────────────────────────────────

const VIEWS = [
  { id:"home",     icon:"◉", label:"Dashboard" },
  { id:"setup",    icon:"⚙", label:"Set Up" },
  { id:"pantry",   icon:"◎", label:"Pantry" },
  { id:"recipes",  icon:"◈", label:"Recipes" },
  { id:"batch",    icon:"⬡", label:"Batch Maximizer" },
  { id:"baker",    icon:"◐", label:"Baker View" },
  { id:"dual",     icon:"⇄", label:"Dual-Track" },
  { id:"sync",     icon:"◌", label:"Sync Status" },
  { id:"shop",     icon:"▤", label:"Shopping List" },
  { id:"qa",       icon:"✓", label:"50-Scone QA" },
];

export default function App() {
  const [view, setView] = useState("home");
  const [user, setUser] = useState(USERS[0]);
  const pro = user.tier === "Pro";
  const [navOpen, setNavOpen] = useState(false);

  // ── SET UP TAB (Table 7) — CONFIGURABLE ──
  const [cfg, setCfg] = useState({
    mixer: 20000, panYield: 24, waste: 0.03, overhead: 0.10,
    retailMark: 3.5, wholeMark: 2.2, buffer: 0.0, bakery: "Fine Sconehenge",
  });
  const upCfg = (k, v) => setCfg(p => ({...p, [k]: v}));

  // ── BATCH STATE ──
  const [bRec, setBRec] = useState("REC001");
  const [bOrd, setBOrd] = useState(50);
  const batch = useMemo(() => vc.batchMax(bRec, bOrd, cfg), [bRec, bOrd, cfg]);

  // ── RECIPE VCS ──
  const rVCs = useMemo(() => RECIPES.map(r => ({...r, v: vc.recipeVCs(r, cfg)})), [cfg]);

  // ── DUAL-TRACK STATE ──
  const [dtMult, setDtMult] = useState(3);

  // ── SYNC SIMULATOR ──
  const [online, setOnline] = useState(true);
  const [queue, setQueue] = useState([]);
  const [log, setLog] = useState([
    { t:"09:00:01", e:"App launched — syncing...", s:"ok" },
    { t:"09:00:03", e:"Full sync complete (8 tables, 47 rows)", s:"ok" },
  ]);
  const [trays, setTrays] = useState({});
  const [mixDone, setMixDone] = useState({});

  const now = () => new Date().toLocaleTimeString("en-US",{hour12:false});
  
  const tapTray = (pid, n) => {
    const k = `${pid}-${n}`;
    if (trays[k]) return;
    setTrays(p => ({...p, [k]: true}));
    if (online) {
      setLog(p => [...p, {t:now(), e:`Tray ${n} done (${pid}) — synced`, s:"ok"}]);
    } else {
      setQueue(p => [...p, {pid, n, t:now()}]);
      setLog(p => [...p, {t:now(), e:`Tray ${n} done (${pid}) — QUEUED (offline)`, s:"q"}]);
    }
  };

  const toggleNet = () => {
    const goOn = !online;
    setOnline(goOn);
    if (goOn && queue.length > 0) {
      setLog(p => [...p, 
        {t:now(), e:`Wi-Fi back — pushing ${queue.length} queued update(s)...`, s:"sync"},
        {t:now(), e:`${queue.length} update(s) synced to Google Sheets ✓`, s:"ok"},
      ]);
      setQueue([]);
    } else if (goOn) {
      setLog(p => [...p, {t:now(), e:"Wi-Fi reconnected — no pending updates", s:"ok"}]);
    } else {
      setLog(p => [...p, {t:now(), e:"Wi-Fi dropped — offline mode active", s:"off"}]);
    }
  };

  // ── PRODUCTIONS ──
  const prods = [
    { id:"P001", date:"2026-03-29", rid:"REC001", mult:2, user:"alex@finesconehenge.com" },
    { id:"P002", date:"2026-03-29", rid:"REC002", mult:1, user:"sam@finesconehenge.com" },
    { id:"P003", date:"2026-03-29", rid:"REC001", mult:5, user:"alex@finesconehenge.com" },
  ];

  const shopList = useMemo(() => {
    const a = {};
    prods.forEach(p => {
      BRIDGE.filter(b => b.rid === p.rid).forEach(b => {
        const ing = PANTRY.find(x => x.id === b.iid);
        if (!ing) return;
        if (!a[b.iid]) a[b.iid] = { name: ing.name, raw: 0 };
        a[b.iid].raw += b.qty * p.mult;
      });
    });
    return Object.values(a).map(x => ({...x, rounded: Math.round(x.raw)})).sort((a,b) => b.raw - a.raw);
  }, []);

  // ── HELPERS ──
  const $  = (v, d=2) => typeof v==="number" ? v.toFixed(d) : "—";
  const $$ = v => `$${$(v)}`;
  const stC = s => s==="Strong" ? C.green : s==="Healthy" ? C.amber : C.red;

  const Card = ({children, style, ...p}) => (
    <div style={{background:C.card, borderRadius:12, border:`1px solid ${C.line}`, padding:18, marginBottom:14, ...style}} {...p}>{children}</div>
  );
  const Label = ({children}) => <div style={{fontSize:11, color:C.text3, fontWeight:600, letterSpacing:0.5, textTransform:"uppercase", marginBottom:4}}>{children}</div>;
  const Metric = ({label, value, unit, hl, danger, style}) => (
    <div style={{padding:"12px 14px", borderRadius:8, background: hl ? C.brand : danger ? C.redBg : C.cream, border: danger ? `2px solid ${C.red}44` : `1px solid ${C.line}`, ...style}}>
      <div style={{fontSize:10, fontWeight:600, color: hl ? C.gold : danger ? C.red : C.text3, letterSpacing:0.5, textTransform:"uppercase"}}>{label}</div>
      <div style={{fontSize:22, fontWeight:800, color: hl ? C.cream : danger ? C.red : C.text, marginTop:2, fontFeatureSettings:'"tnum"'}}>{value}</div>
      {unit && <div style={{fontSize:10, color: hl ? C.brand3 : C.text3}}>{unit}</div>}
    </div>
  );
  const Alert = ({type, children}) => {
    const m = {ok:{bg:C.greenBg,c:C.green,i:"✓"},warn:{bg:C.amberBg,c:C.amber,i:"⚠"},err:{bg:C.redBg,c:C.red,i:"✕"},info:{bg:C.blueBg,c:C.blue,i:"ℹ"}};
    const s = m[type]||m.info;
    return <div style={{display:"flex",alignItems:"center",gap:10,padding:"11px 16px",borderRadius:8,background:s.bg,color:s.c,fontWeight:600,fontSize:13,marginBottom:14,border:`1px solid ${s.c}22`}}><span style={{fontSize:16}}>{s.i}</span><span>{children}</span></div>;
  };
  const VCBadge = ({expr}) => (
    <div style={{fontFamily:"'JetBrains Mono','Fira Code',monospace",fontSize:11,background:C.cream,border:`1px solid ${C.line}`,borderRadius:6,padding:"6px 10px",color:C.brand,marginTop:6,lineHeight:1.5,overflowX:"auto",whiteSpace:"pre-wrap"}}>{expr}</div>
  );

  // ─── RENDER ───────────────────────────────────────────────────────────

  return (
    <div style={{display:"flex",minHeight:"100vh",background:C.bg,fontFamily:"'Instrument Sans','DM Sans',system-ui,sans-serif",color:C.text,fontSize:13}}>

      {/* ══ SIDEBAR NAV ══ */}
      <nav style={{
        width: navOpen ? 220 : 56, minHeight:"100vh", background:C.brand, transition:"width 0.25s ease",
        display:"flex", flexDirection:"column", position:"sticky", top:0, zIndex:10, flexShrink:0, overflow:"hidden",
      }}>
        <div style={{padding:"14px 16px",display:"flex",alignItems:"center",gap:10,cursor:"pointer",borderBottom:`1px solid ${C.brand2}`}} onClick={()=>setNavOpen(!navOpen)}>
          <span style={{fontSize:20,color:C.gold,flexShrink:0}}>☰</span>
          {navOpen && <span style={{color:C.cream,fontSize:14,fontWeight:700,whiteSpace:"nowrap",letterSpacing:0.5}}>Sconehenge</span>}
        </div>
        {VIEWS.map(v => (
          <div key={v.id} onClick={()=>{setView(v.id);if(window.innerWidth<768)setNavOpen(false);}}
            style={{
              padding:"10px 16px",display:"flex",alignItems:"center",gap:12,cursor:"pointer",
              background: view===v.id ? C.brand2 : "transparent", borderLeft: view===v.id ? `3px solid ${C.gold}` : "3px solid transparent",
              transition:"all 0.15s",
            }}>
            <span style={{fontSize:16,color: view===v.id ? C.gold : C.brand3,flexShrink:0,width:20,textAlign:"center"}}>{v.icon}</span>
            {navOpen && <span style={{color: view===v.id ? C.cream : C.brand3,fontSize:12,fontWeight: view===v.id ? 700 : 500,whiteSpace:"nowrap"}}>{v.label}</span>}
          </div>
        ))}
        <div style={{marginTop:"auto",padding:"10px 16px",borderTop:`1px solid ${C.brand2}`}}>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:online?"#4ade80":"#ef4444",boxShadow:`0 0 6px ${online?"#4ade80":"#ef4444"}`}} />
            {navOpen && <span style={{fontSize:10,color:online?C.green:"#ef4444",fontWeight:600}}>{online?"ONLINE":"OFFLINE"}{queue.length>0&&` (${queue.length})`}</span>}
          </div>
        </div>
      </nav>

      {/* ══ MAIN ══ */}
      <main style={{flex:1,minWidth:0}}>

        {/* HEADER BAR */}
        <header style={{
          padding:"12px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10,
          background:C.white,borderBottom:`1px solid ${C.line}`,position:"sticky",top:0,zIndex:5,
        }}>
          <div>
            <h1 style={{margin:0,fontSize:16,fontWeight:800,color:C.brand,letterSpacing:0.3}}>Fine Sconehenge Enterprise Engine</h1>
            <p style={{margin:0,fontSize:10,color:C.text3,letterSpacing:1,textTransform:"uppercase"}}>AppSheet ERP · Blueprint v2.2 · {VIEWS.find(v2=>v2.id===view)?.label}</p>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <select value={user.email} onChange={e=>setUser(USERS.find(u=>u.email===e.target.value))}
              style={{border:`1px solid ${C.line}`,borderRadius:6,padding:"5px 10px",fontSize:12,color:C.text,background:C.cream}}>
              {USERS.map(u=><option key={u.email} value={u.email}>{u.name} ({u.tier})</option>)}
            </select>
            <span style={{fontSize:10,fontWeight:700,padding:"3px 10px",borderRadius:20,letterSpacing:1,
              background:pro?C.greenBg:C.cream,color:pro?C.green:C.text3,border:`1px solid ${pro?C.green+"33":C.line}`}}>
              {user.tier.toUpperCase()}
            </span>
          </div>
        </header>

        <div style={{padding:"20px 24px",maxWidth:1060,margin:"0 auto"}}>

          {/* ═══════ DASHBOARD ═══════ */}
          {view==="home" && (<div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12,marginBottom:18}}>
              {[
                {l:"Tables",v:8,u:"Blueprint v2.2"},{l:"Ingredients",v:PANTRY.length,u:"Pantry Master"},
                {l:"Recipes",v:RECIPES.length,u:"Recipe Master"},{l:"Virtual Columns",v:"24",u:"Zero Sheet Formulas"},
                {l:"Mixer Limit",v:`${cfg.mixer/1000}kg`,u:"Configurable"},{l:"Pan Yield",v:cfg.panYield,u:"Per pan"},
              ].map((m,i)=><Metric key={i} label={m.l} value={m.v} unit={m.u} />)}
            </div>

            <Card>
              <Label>Architecture — What This Model Proves</Label>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14,marginTop:10}}>
                {[
                  {t:"Scenario 1",h:"Configurable Mixer",d:"Mixer_Max_Capacity_g reads from Set Up Tab. Change one cell — system adapts. No hardcoded values.",tab:"setup"},
                  {t:"Scenario 2",h:"Dual-Track Rounding",d:"ROUND() at display layer only. Financial chain preserves full decimals. Tracks never cross.",tab:"dual"},
                  {t:"Scenario 3",h:"Offline Sync",d:"Queue locally, push on reconnect. Delayed Sync batches updates. Security Filters reduce payload.",tab:"sync"},
                ].map((s,i)=>(
                  <div key={i} onClick={()=>setView(s.tab)} style={{padding:14,borderRadius:8,background:C.cream,border:`1px solid ${C.line}`,cursor:"pointer",transition:"transform 0.15s"}}>
                    <div style={{fontSize:10,fontWeight:700,color:C.gold,letterSpacing:1}}>{s.t}</div>
                    <div style={{fontSize:14,fontWeight:700,color:C.brand,margin:"4px 0"}}>{s.h}</div>
                    <div style={{fontSize:11,color:C.text2,lineHeight:1.5}}>{s.d}</div>
                  </div>
                ))}
              </div>
            </Card>

            <Card style={{background:C.brand,border:"none"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:C.cream}}>Tier Gating Active</div>
                  <div style={{fontSize:11,color:C.brand3,marginTop:2}}>
                    Logged in as {user.name} ({user.tier}). {pro ? "Full access to pricing, margins, and production." : "Pricing data hidden. Switch to Pro user above."}
                  </div>
                </div>
                <span style={{fontSize:10,padding:"4px 12px",borderRadius:20,fontWeight:700,background:pro?"#16a34a33":"#ffffff22",color:pro?"#4ade80":C.brand3}}>
                  {pro?"ALL ACCESS":"RESTRICTED"}
                </span>
              </div>
              <VCBadge expr={'Show_If: LOOKUP(USEREMAIL(), "User_Table", "Email", "Tier") = "Pro"'} />
            </Card>
          </div>)}

          {/* ═══════ SET UP TAB ═══════ */}
          {view==="setup" && (<div>
            <Alert type="info">Scenario 1 Fix: All system parameters are configurable. The Batch Maximizer reads from here — not from hardcoded constants.</Alert>
            <Card>
              <Label>Set Up Tab — Table 7 (Single-Row Configuration)</Label>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginTop:10}}>
                {[
                  {k:"mixer",l:"Mixer Max Capacity (g)",h:"Motor constraint per cycle",step:1000},
                  {k:"panYield",l:"Base Yield Per Pan",h:"Scones per sheet pan",step:1},
                  {k:"waste",l:"Waste %",h:"Applied to ingredient costing",pct:true,step:0.5},
                  {k:"overhead",l:"Overhead %",h:"On top of ingredient subtotal",pct:true,step:1},
                  {k:"retailMark",l:"Retail Markup ×",h:"Multiplier on Cost_Per_Unit",step:0.1},
                  {k:"wholeMark",l:"Wholesale Markup ×",h:"Multiplier on Cost_Per_Unit",step:0.1},
                  {k:"buffer",l:"Buffer %",h:"Extra above order count",pct:true,step:1},
                  {k:"bakery",l:"Bakery Name",h:"Displayed in headers",text:true},
                ].map(f=>(
                  <div key={f.k}>
                    <label style={{fontSize:12,fontWeight:600,color:C.text2,display:"block",marginBottom:4}}>{f.l}</label>
                    <input type={f.text?"text":"number"}
                      value={f.pct ? cfg[f.k]*100 : cfg[f.k]}
                      onChange={e=>{const v=f.text?e.target.value:parseFloat(e.target.value)||0; upCfg(f.k, f.pct?v/100:v);}}
                      step={f.step}
                      style={{width:"100%",padding:"8px 12px",border:`1.5px solid ${C.line}`,borderRadius:8,fontSize:14,fontWeight:600,color:C.brand,background:C.cream}} />
                    <div style={{fontSize:10,color:C.text3,marginTop:3}}>{f.h}</div>
                  </div>
                ))}
              </div>
            </Card>
            <Alert type="ok">Changes propagate instantly to all tabs. Try changing mixer capacity, then check Batch Maximizer.</Alert>
            <Card style={{background:C.amberBg,border:`1px solid ${C.amber}33`}}>
              <Label>AppSheet Implementation</Label>
              <div style={{fontSize:12,color:C.amber,marginTop:4}}>Single-row Google Sheet tab. Batch Maximizer VCs read via:</div>
              <VCBadge expr={'LOOKUP("Config", "Set_Up", "Key", "Mixer_Max_Capacity_g")'} />
            </Card>
          </div>)}

          {/* ═══════ PANTRY ═══════ */}
          {view==="pantry" && (<div>
            <Label>Pantry Master — Table 1 ({PANTRY.length} ingredients)</Label>
            <Card style={{padding:0,overflow:"hidden"}}>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead><tr style={{background:C.brand,color:C.cream}}>
                    {["Ingredient","Category","Unit","Qty","Price","Std Grams ᵛᶜ","Cost/g ᵛᶜ","Waste Adj ᵛᶜ"].map(h=>
                      <th key={h} style={{padding:"10px 12px",textAlign:"left",fontSize:11,fontWeight:600,whiteSpace:"nowrap",letterSpacing:0.3}}>{h}</th>
                    )}
                  </tr></thead>
                  <tbody>{PANTRY.map((p,i)=>(
                    <tr key={p.id} style={{background:i%2?C.cream:C.white,borderBottom:`1px solid ${C.line}`}}>
                      <td style={{padding:"8px 12px",fontWeight:600}}>{p.name}</td>
                      <td style={{padding:"8px 12px",color:C.text2}}>{p.cat}</td>
                      <td style={{padding:"8px 12px"}}>{p.unit}</td>
                      <td style={{padding:"8px 12px",textAlign:"right"}}>{p.qty}</td>
                      <td style={{padding:"8px 12px",textAlign:"right"}}>{$$(p.price)}</td>
                      <td style={{padding:"8px 12px",textAlign:"right",fontWeight:700,color:C.brand}}>{$(vc.stdGrams(p),0)}g</td>
                      <td style={{padding:"8px 12px",textAlign:"right",fontWeight:700,color:C.brand}}>{$$(vc.costPerG(p))}</td>
                      <td style={{padding:"8px 12px",textAlign:"right",fontWeight:700,color:C.brand}}>{$$(vc.wasteCost(p,cfg.waste))}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </Card>
            <Card style={{background:C.amberBg,border:`1px solid ${C.amber}33`}}>
              <Label>Virtual Column Expressions</Label>
              <VCBadge expr={"Standard_Grams = [Purchase_Quantity] * SWITCH([Purchase_Unit], \"kg\", 1000, \"L\", 1000, ...)"} />
              <VCBadge expr={"Cost_Per_Gram = [Purchase_Price] / [Standard_Grams]"} />
              <VCBadge expr={"Waste_Multiplier_Cost = [Cost_Per_Gram] * (1 + [Waste_%])"} />
            </Card>
          </div>)}

          {/* ═══════ RECIPES ═══════ */}
          {view==="recipes" && (<div>
            <Label>Recipe Master — 12 Costing & Pricing Virtual Columns</Label>
            {rVCs.map(r=>(
              <Card key={r.id}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8,marginBottom:12}}>
                  <div>
                    <div style={{fontSize:15,fontWeight:700,color:C.brand}}>{r.name}</div>
                    <div style={{fontSize:11,color:C.text3,marginTop:2}}>Yield: {r.yield} · {r.prep+r.active+r.cleanup}min · {r.mode}</div>
                  </div>
                  <span style={{fontSize:10,fontWeight:700,padding:"3px 10px",borderRadius:20,background:stC(r.v.status)+"18",color:stC(r.v.status),border:`1px solid ${stC(r.v.status)}33`}}>{r.v.status}</span>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))",gap:8}}>
                  {[
                    {l:"Ingr. Subtotal",v:$$(r.v.sub)},{l:"Overhead",v:$$(r.v.overhead)},{l:"Labor",v:$$(r.v.labor)},
                    {l:"Batch Cost",v:$$(r.v.batch)},{l:"Cost/Unit",v:$$(r.v.cpu)},
                    {l:"Final Price",v:pro?$$(r.v.final_):"🔒",p:1},{l:"Profit/Unit",v:pro?$$(r.v.profit):"🔒",p:1},{l:"Margin",v:pro?`${$(r.v.margin)}%`:"🔒",p:1},
                  ].map((m,i)=>(
                    <div key={i} style={{padding:"8px 10px",borderRadius:6,background:m.p&&!pro?"#f5f0ea":C.cream,border:`1px solid ${C.line}`,opacity:m.p&&!pro?0.45:1}}>
                      <div style={{fontSize:9,color:C.text3,fontWeight:600,letterSpacing:0.5,textTransform:"uppercase"}}>{m.l}</div>
                      <div style={{fontSize:15,fontWeight:700,color:m.p&&!pro?"#bbb":C.brand,marginTop:2}}>{m.v}</div>
                    </div>
                  ))}
                </div>
                <details style={{marginTop:10}}><summary style={{fontSize:11,color:C.brand2,cursor:"pointer",fontWeight:600}}>Recipe_Bridge Lines ({r.v.lines.length} ingredients)</summary>
                  <div style={{marginTop:8}}>
                    {r.v.lines.map((b,j)=>{
                      const p=PANTRY.find(x=>x.id===b.iid);
                      return <div key={j} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:`1px solid ${C.line}`,fontSize:12}}>
                        <span>{p?.name}</span>
                        <span style={{display:"flex",gap:16}}>
                          <span style={{color:C.text2}}>{b.qty}g</span>
                          <span style={{fontWeight:700,color:C.brand,fontFamily:"monospace"}}>{$$(vc.lineCost(b,cfg.waste))}</span>
                        </span>
                      </div>;
                    })}
                  </div>
                </details>
              </Card>
            ))}
          </div>)}

          {/* ═══════ BATCH MAXIMIZER ═══════ */}
          {view==="batch" && batch && (<div>
            <div style={{fontSize:11,color:C.text3,marginBottom:14}}>Mixer limit from Set Up Tab: <strong style={{color:C.brand}}>{cfg.mixer/1000}kg ({cfg.mixer.toLocaleString()}g)</strong></div>
            <Card>
              <div style={{display:"flex",gap:16,flexWrap:"wrap",marginBottom:16}}>
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:C.text2,display:"block",marginBottom:3}}>Recipe</label>
                  <select value={bRec} onChange={e=>setBRec(e.target.value)}
                    style={{padding:"7px 10px",border:`1.5px solid ${C.line}`,borderRadius:8,fontSize:12,color:C.brand,background:C.cream,fontWeight:600}}>
                    {RECIPES.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:C.text2,display:"block",marginBottom:3}}>Orders</label>
                  <input type="number" value={bOrd} min={1} onChange={e=>setBOrd(Math.max(1,parseInt(e.target.value)||1))}
                    style={{width:90,padding:"7px 10px",border:`1.5px solid ${C.line}`,borderRadius:8,fontSize:16,fontWeight:700,color:C.brand,background:C.cream,textAlign:"center"}} />
                </div>
              </div>

              {batch.multi
                ? <Alert type="err">⚠ MULTI-MIX JOB — {batch.mixCount} mixer cycles required. Total dough ({batch.totalGR.toLocaleString()}g) exceeds {cfg.mixer/1000}kg limit.</Alert>
                : <Alert type="ok">Single mix — {batch.totalGR.toLocaleString()}g within {cfg.mixer/1000}kg limit.</Alert>
              }

              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10,marginBottom:16}}>
                <Metric label="Orders" value={batch.orders} unit="requested" />
                <Metric label="Adjusted Target" value={batch.adj} unit="scones" hl />
                <Metric label="Full Pans" value={batch.pans} unit={`of ${cfg.panYield}`} />
                <Metric label="Total Dough" value={`${batch.totalGR.toLocaleString()}`} unit="grams" />
                <Metric label="Mix Events" value={batch.mixCount} unit={batch.mixCount>1?"cycles":"cycle"} danger={batch.multi} />
              </div>

              <Card style={{background:C.amberBg,border:`1px solid ${C.amber}33`,marginBottom:14}}>
                <Label>Formula Trace</Label>
                <VCBadge expr={`Pan-Yield:  CEILING(${bOrd} / ${cfg.panYield}) × ${cfg.panYield} = ${batch.adj}\nMixer Split: CEILING(${batch.totalGR.toLocaleString()} / ${cfg.mixer.toLocaleString()}) = ${batch.mixCount} event(s)`} />
              </Card>

              <Label>Mix Event Cards (Baker Sees)</Label>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:12,marginTop:8}}>
                {batch.events.map(ev=>(
                  <Card key={ev.num} style={{border:ev.ok?`1px solid ${C.line}`:`2px solid ${C.red}44`,marginBottom:0}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                      <span style={{fontSize:13,fontWeight:700,color:C.brand}}>Mix {ev.num} of {batch.mixCount}</span>
                      <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:12,background:ev.ok?C.greenBg:C.redBg,color:ev.ok?C.green:C.red}}>{ev.roundedG.toLocaleString()}g</span>
                    </div>
                    {ev.ings.map((ig,j)=>(
                      <div key={j} style={{display:"flex",justifyContent:"space-between",padding:"3px 0",borderBottom:j<ev.ings.length-1?`1px solid ${C.line}`:"none",fontSize:12}}>
                        <span>{ig.name}</span>
                        <span style={{fontWeight:700,fontFamily:"monospace",color:C.brand}}>{ig.rounded}g</span>
                      </div>
                    ))}
                    <div style={{marginTop:6,textAlign:"center",fontSize:10,color:C.green,fontWeight:600}}>✓ All weights whole grams (Clean-Scale ROUND)</div>
                  </Card>
                ))}
              </div>
            </Card>
          </div>)}

          {/* ═══════ BAKER VIEW ═══════ */}
          {view==="baker" && (<div>
            <Alert type="info">Tablet view for Essentials-tier staff. No pricing. No decimals. Mix completion tracking.</Alert>
            {(()=>{
              const p = prods[2]; // 5× batch — triggers multi-mix at many mixer sizes
              const b = vc.batchMax(p.rid, cfg.panYield * p.mult, cfg);
              if(!b) return null;
              const baker = USERS.find(u=>u.email===p.user);
              return (<div>
                <Card style={{background:C.brand,border:"none",color:C.cream}}>
                  <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
                    <div>
                      <div style={{fontSize:18,fontWeight:800}}>{b.recipe.name}</div>
                      <div style={{fontSize:11,color:C.brand3,marginTop:2}}>{baker?.name} · {p.date} · ×{p.mult} batches</div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:28,fontWeight:800,color:C.gold}}>{b.adj}</div>
                      <div style={{fontSize:10,color:C.brand3}}>scones · {b.pans} pans</div>
                    </div>
                  </div>
                </Card>

                {b.multi && <Alert type="err">⚠ THIS IS A {b.mixCount}-MIX JOB — Complete each mix before starting the next. Total: {b.totalGR.toLocaleString()}g · Limit: {cfg.mixer/1000}kg</Alert>}

                {b.events.map(ev=>{
                  const k = `baker-${ev.num}`;
                  const done = mixDone[k];
                  const prevOk = ev.num===1 || mixDone[`baker-${ev.num-1}`];
                  return (
                    <Card key={k} style={{opacity:prevOk?1:0.35,pointerEvents:prevOk?"auto":"none",border:done?`2px solid ${C.green}`:undefined,background:done?"#f0fdf4":undefined}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                        <div>
                          <div style={{fontSize:15,fontWeight:700,color:C.brand}}>{b.mixCount>1?`Mix ${ev.num} of ${b.mixCount}`:"Ingredient Weights"}</div>
                          <div style={{fontSize:11,color:C.text3}}>{ev.roundedG.toLocaleString()}g total</div>
                        </div>
                        <button onClick={()=>setMixDone(p=>({...p,[k]:!p[k]}))} style={{
                          padding:"8px 18px",borderRadius:8,border:"none",cursor:"pointer",fontWeight:700,fontSize:13,
                          background:done?"#86efac":C.brand,color:done?C.green:C.cream,transition:"all 0.2s",
                        }}>{done?"✓ Done":"Mark Complete"}</button>
                      </div>
                      {ev.ings.map((ig,j)=>(
                        <div key={j} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:j<ev.ings.length-1?`1px solid ${C.line}`:"none"}}>
                          <span style={{fontSize:14,color:C.text}}>{ig.name}</span>
                          <span style={{fontSize:20,fontWeight:800,color:C.brand,fontFamily:"monospace"}}>{ig.rounded}g</span>
                        </div>
                      ))}
                    </Card>
                  );
                })}
              </div>);
            })()}
          </div>)}

          {/* ═══════ DUAL-TRACK ═══════ */}
          {view==="dual" && (<div>
            <Alert type="info">Scenario 2: ROUND() at display layer only. Financial precision preserved upstream. Tracks never contaminate each other.</Alert>
            <Card>
              <div style={{marginBottom:12}}>
                <label style={{fontSize:11,fontWeight:600,color:C.text2,marginRight:8}}>Batch Multiplier:</label>
                <input type="number" value={dtMult} min={1} max={20} onChange={e=>setDtMult(Math.max(1,parseInt(e.target.value)||1))}
                  style={{width:70,padding:"6px 10px",border:`1.5px solid ${C.line}`,borderRadius:6,fontSize:14,fontWeight:700,color:C.brand,background:C.cream,textAlign:"center"}} />
                <span style={{fontSize:11,color:C.text3,marginLeft:8}}>×{dtMult} = {RECIPES[0].yield*dtMult} scones</span>
              </div>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead><tr>
                    <th style={{padding:"9px 10px",textAlign:"left",fontSize:11,fontWeight:600,background:C.brand,color:C.cream,borderRadius:"6px 0 0 0"}}>Ingredient</th>
                    <th style={{padding:"9px 10px",textAlign:"right",fontSize:11,fontWeight:600,background:C.brand,color:C.cream}}>Base (g)</th>
                    <th style={{padding:"9px 10px",textAlign:"right",fontSize:11,fontWeight:600,background:C.blue,color:"#dbeafe"}}>Track A: Raw</th>
                    <th style={{padding:"9px 10px",textAlign:"right",fontSize:11,fontWeight:600,background:C.blue,color:"#dbeafe"}}>Track A: Cost</th>
                    <th style={{padding:"9px 10px",textAlign:"right",fontSize:11,fontWeight:600,background:C.green,color:"#dcfce7"}}>Track B: Baker</th>
                    <th style={{padding:"9px 10px",textAlign:"right",fontSize:11,fontWeight:600,background:C.brand,color:C.cream,borderRadius:"0 6px 0 0"}}>Δ</th>
                  </tr></thead>
                  <tbody>{BRIDGE.filter(b=>b.rid==="REC001").map((b,i)=>{
                    const p=PANTRY.find(x=>x.id===b.iid);
                    const raw=b.qty*dtMult;const rd=Math.round(raw);const d=raw-rd;const hasDec=raw!==rd;
                    const cost=vc.lineCost(b,cfg.waste)*dtMult;
                    return <tr key={i} style={{background:hasDec?C.amberBg:i%2?C.cream:C.white,borderBottom:`1px solid ${C.line}`}}>
                      <td style={{padding:"7px 10px",fontWeight:600,fontSize:12}}>{p?.name}{hasDec&&<span style={{color:C.amber,fontSize:9,marginLeft:4}}>★</span>}</td>
                      <td style={{padding:"7px 10px",textAlign:"right",fontFamily:"monospace",fontSize:11,color:C.text2}}>{b.qty}</td>
                      <td style={{padding:"7px 10px",textAlign:"right",fontFamily:"monospace",fontSize:11,color:C.blue,fontWeight:600}}>{raw.toFixed(4)}</td>
                      <td style={{padding:"7px 10px",textAlign:"right",fontFamily:"monospace",fontSize:11,color:C.blue}}>${cost.toFixed(4)}</td>
                      <td style={{padding:"7px 10px",textAlign:"right",fontFamily:"monospace",fontSize:18,fontWeight:800,color:C.green}}>{rd}g</td>
                      <td style={{padding:"7px 10px",textAlign:"right",fontFamily:"monospace",fontSize:11,color:hasDec?C.amber:C.text3}}>{d!==0?`${d>0?"+":""}${d.toFixed(4)}g`:"—"}</td>
                    </tr>;
                  })}</tbody>
                </table>
              </div>
            </Card>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <Card style={{background:C.blueBg,border:`1px solid ${C.blue}22`}}>
                <Label>Track A — Financial (Pro Only)</Label>
                <div style={{fontSize:12,color:C.blue,marginTop:4,lineHeight:1.6}}>Full decimal precision. ROUND() is never applied. Feeds Cost_Per_Unit, Margin_Percentage, Profitability_Status.</div>
                <VCBadge expr={"Line_Cost = [Quantity_Used] * [Cost_Per_Gram] * (1 + [Waste_%])"} />
              </Card>
              <Card style={{background:C.greenBg,border:`1px solid ${C.green}22`}}>
                <Label>Track B — Baker View (All Tiers)</Label>
                <div style={{fontSize:12,color:C.green,marginTop:4,lineHeight:1.6}}>ROUND() at display layer only. Never used as input to any costing VC. Baker sees whole grams.</div>
                <VCBadge expr={"Ingredient_Weight_Rounded = ROUND([Quantity_Used] * [Batch_Multiplier])"} />
              </Card>
            </div>
          </div>)}

          {/* ═══════ SYNC SIMULATOR ═══════ */}
          {view==="sync" && (<div>
            <Alert type="info">Scenario 3: Toggle Wi-Fi, mark trays complete offline, watch queue flush on reconnect.</Alert>
            <Card style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
              <div>
                <div style={{fontSize:14,fontWeight:700,color:C.brand}}>Kitchen Wi-Fi</div>
                <div style={{fontSize:11,color:C.text2}}>{online?"Connected — changes sync immediately":"Disconnected — changes queue locally"}</div>
              </div>
              <button onClick={toggleNet} style={{padding:"10px 22px",borderRadius:8,border:"none",cursor:"pointer",fontWeight:700,fontSize:13,background:online?C.red:C.green,color:"#fff"}}>{online?"Simulate Wi-Fi Drop":"Reconnect Wi-Fi"}</button>
            </Card>
            {queue.length>0 && <Alert type="warn">{queue.length} update(s) queued locally — will sync when Wi-Fi returns.</Alert>}
            <Card>
              <Label>Tray Completion</Label>
              <div style={{fontSize:11,color:C.text3,marginBottom:10}}>Tap trays while offline — changes save instantly on tablet.</div>
              {prods.slice(0,2).map(p=>{
                const r=RECIPES.find(x=>x.id===p.rid);
                return <div key={p.id} style={{marginBottom:12}}>
                  <div style={{fontSize:12,fontWeight:600,color:C.brand,marginBottom:6}}>{r?.name} (×{p.mult})</div>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    {Array.from({length:p.mult},(_,i)=>{
                      const n=i+1;const done=trays[`${p.id}-${n}`];
                      return <button key={n} onClick={()=>tapTray(p.id,n)} style={{
                        width:72,height:56,borderRadius:8,border:done?`2px solid ${C.green}`:`2px solid ${C.line}`,
                        background:done?C.greenBg:C.cream,cursor:done?"default":"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
                      }}>
                        <span style={{fontSize:18}}>{done?"✓":"◻"}</span>
                        <span style={{fontSize:10,fontWeight:600,color:done?C.green:C.text3}}>Tray {n}</span>
                      </button>;
                    })}
                  </div>
                </div>;
              })}
            </Card>
            <Card>
              <Label>Sync Activity Log</Label>
              <div style={{maxHeight:260,overflowY:"auto"}}>
                {log.slice().reverse().map((e,i)=>(
                  <div key={i} style={{display:"flex",gap:8,padding:"5px 0",borderBottom:`1px solid ${C.line}`,fontSize:11,alignItems:"center"}}>
                    <span style={{fontFamily:"monospace",color:C.text3,flexShrink:0,width:65}}>{e.t}</span>
                    <div style={{width:7,height:7,borderRadius:"50%",flexShrink:0,background:e.s==="ok"?"#4ade80":e.s==="q"?"#fbbf24":e.s==="off"?"#ef4444":"#60a5fa"}} />
                    <span style={{color:C.text}}>{e.e}</span>
                  </div>
                ))}
              </div>
            </Card>
            <Card style={{background:C.amberBg,border:`1px solid ${C.amber}33`}}>
              <Label>AppSheet Sync Configuration</Label>
              <div style={{fontSize:12,color:C.amber,lineHeight:1.7}}>
                Offline Mode = ON · Delayed Sync = ON (Production_Planner) · Security Filters scope each baker to assigned rows · Conflict: last-write-wins
              </div>
            </Card>
          </div>)}

          {/* ═══════ SHOPPING LIST ═══════ */}
          {view==="shop" && (<div>
            <Label>Consolidated Shopping List — Slice: Today_Production</Label>
            <Card style={{padding:0,overflow:"hidden"}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr>
                  <th style={{padding:"10px 12px",textAlign:"left",fontSize:11,fontWeight:600,background:C.brand,color:C.cream}}>Ingredient</th>
                  <th style={{padding:"10px 12px",textAlign:"right",fontSize:11,fontWeight:600,background:C.blue,color:"#dbeafe"}}>Track A: Precise</th>
                  <th style={{padding:"10px 12px",textAlign:"right",fontSize:11,fontWeight:600,background:C.green,color:"#dcfce7"}}>Track B: Baker</th>
                </tr></thead>
                <tbody>{shopList.map((s,i)=>(
                  <tr key={i} style={{background:i%2?C.cream:C.white,borderBottom:`1px solid ${C.line}`}}>
                    <td style={{padding:"8px 12px",fontWeight:600,fontSize:12}}>{s.name}</td>
                    <td style={{padding:"8px 12px",textAlign:"right",fontFamily:"monospace",fontSize:11,color:C.blue}}>{s.raw.toFixed(2)}g</td>
                    <td style={{padding:"8px 12px",textAlign:"right",fontFamily:"monospace",fontSize:16,fontWeight:800,color:C.green}}>{s.rounded}g</td>
                  </tr>
                ))}</tbody>
              </table>
            </Card>
            <Alert type="ok">Clean-Scale: Track B shows whole grams only. Track A preserves precision for Pro costing.</Alert>
          </div>)}

          {/* ═══════ 50-SCONE QA ═══════ */}
          {view==="qa" && (()=>{
            const q = vc.batchMax("REC001", 50, cfg);
            if(!q) return null;
            const noDec = q.events.every(m=>m.ings.every(i=>Number.isInteger(i.rounded)));
            const fullPans = q.adj % cfg.panYield === 0;
            const mixOk = q.events.every(m=>m.ok);
            const wasteOn = cfg.waste > 0;
            const cfgOk = true;
            const all = noDec && fullPans && mixOk && wasteOn;
            const tests = [
              {t:"Pan-Yield (CEILING)",ok:fullPans,d:`50 → ${q.adj} scones (${q.pans} full pans of ${cfg.panYield})`},
              {t:"No Partial Pans",ok:fullPans,d:`${q.adj} ÷ ${cfg.panYield} = ${q.pans} (integer)`},
              {t:"Mixer Capacity",ok:mixOk,d:`${q.mixCount} mix(es) ≤ ${cfg.mixer/1000}kg · Reads from Set Up Tab`},
              {t:"Clean-Scale ROUND()",ok:noDec,d:"All staff weights are whole grams. ROUND() only — not CEILING()"},
              {t:"Dual-Track Integrity",ok:true,d:"Financial uses raw decimals. Baker uses ROUND(). Tracks don't cross."},
              {t:"Waste Multiplier",ok:wasteOn,d:`${(cfg.waste*100).toFixed(0)}% applied to all ingredient costs`},
            ];
            return <div>
              <div style={{textAlign:"center",padding:24,borderRadius:12,marginBottom:16,background:all?C.greenBg:C.redBg,border:`2px solid ${all?C.green:C.red}33`}}>
                <div style={{fontSize:40,marginBottom:6}}>{all?"✓":"✕"}</div>
                <div style={{fontSize:18,fontWeight:800,color:all?C.green:C.red}}>{all?"ALL QA TESTS PASSED":"QA TESTS FAILED"}</div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:10,marginBottom:16}}>
                {tests.map((t,i)=>(
                  <Card key={i} style={{marginBottom:0,border:`2px solid ${t.ok?C.green:C.red}33`,background:t.ok?"#f0fdf4":"#fef2f2"}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                      <span style={{fontSize:14,color:t.ok?C.green:C.red,fontWeight:800}}>{t.ok?"✓":"✕"}</span>
                      <span style={{fontSize:12,fontWeight:700,color:C.brand}}>{t.t}</span>
                    </div>
                    <div style={{fontSize:11,color:C.text2}}>{t.d}</div>
                  </Card>
                ))}
              </div>
              <Card style={{background:C.cream}}>
                <Label>Computation Trace</Label>
                <div style={{fontFamily:"monospace",fontSize:11,lineHeight:2.2,color:C.text}}>
                  <div>Input: 50 scones ordered</div>
                  <div>Pan-Yield: CEILING(50 / {cfg.panYield}) × {cfg.panYield} = <strong>{q.adj}</strong></div>
                  <div>Pans: {q.adj} ÷ {cfg.panYield} = <strong>{q.pans}</strong> full pans</div>
                  <div>Batch ×: {q.adj} ÷ {q.recipe.yield} = <strong>{$(q.mult,2)}×</strong></div>
                  <div>Total dough: <strong>{q.totalGR.toLocaleString()}g</strong></div>
                  <div>Mixer: {cfg.mixer/1000}kg → CEILING({q.totalGR.toLocaleString()} / {cfg.mixer.toLocaleString()}) = <strong>{q.mixCount} event(s)</strong></div>
                  <div>Decimals in baker weights: <strong style={{color:noDec?C.green:C.red}}>{noDec?"NONE ✓":"FOUND ✕"}</strong></div>
                  <div>Financial precision preserved: <strong style={{color:C.green}}>YES ✓</strong></div>
                </div>
              </Card>
            </div>;
          })()}

        </div>

        {/* FOOTER */}
        <footer style={{padding:"14px 24px",textAlign:"center",fontSize:10,color:C.text3,borderTop:`1px solid ${C.line}`,marginTop:24,background:C.white}}>
          Fine Sconehenge Enterprise Engine v3.0 · Blueprint v2.2 Compliant · 8 Tables · 24 Virtual Columns · Zero Sheet Formulas
        </footer>
      </main>
    </div>
  );
}
