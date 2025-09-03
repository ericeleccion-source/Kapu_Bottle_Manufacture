"use client";

import React, { useMemo, useState, useEffect } from "react";

/**
 * Flavored Cold Brew Bottle Calculator - Stable + Bottle Split Mode
 * -----------------------------------------------------------------
 * • Scales linearly by 32 fl oz coconut milk cartons.
 * • Bottle size defaults to 12 fl oz.
 * • Ube concentrate reported ONLY in tbsp.
 * • Split-by-Cartons planner (simple & robust) + Split-by-Bottles (lead clamps; other auto-fills).
 * • Shows Horchata Base, Cold Brew Base, and Total with qt & mL conversions.
 * • Tiny unit test harness rendered at the bottom.
 *
 * NOTE: Self-contained (no external UI libs) to avoid preview/CDN issues.
 */

// ---------------- constants & helpers ----------------
const TOTAL_PER_CARTON_OZ = 32 + 16 + 59 + 59; // 166 (ube tbsp excluded)
const OZ_PER_QT = 32;
const ML_PER_OZ = 29.5735;

// Types (use consistent flavor keys across the file)
type Flavor = "tikiChata" | "dirtyUbe";

type Recipe = {
  coconutOz: number;
  horchataOz: number;
  coffeeConcOz: number;
  waterOz: number;
  ubeTbsp: number;
};

// Base recipes keyed by Flavor
const baseRecipes: Record<Flavor, Recipe> = {
  tikiChata: { coconutOz: 32, horchataOz: 16, coffeeConcOz: 59, waterOz: 59, ubeTbsp: 0 },
  dirtyUbe:  { coconutOz: 32, horchataOz: 16, coffeeConcOz: 59, waterOz: 59, ubeTbsp: 1.5 },
};

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
function fmt(n: number) {
  return round2(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
const toQt = (oz: number) => oz / OZ_PER_QT;
const toMl = (oz: number) => oz * ML_PER_OZ;
const unitTriplet = (oz: number) => `${fmt(oz)} fl oz · ${fmt(toQt(oz))} qt · ${fmt(toMl(oz))} mL`;

function computeScaled(recipe: Recipe, cartons: number) {
  const k = Math.max(0, Math.floor(cartons) || 0);
  const coconut = recipe.coconutOz * k;
  const horchata = recipe.horchataOz * k;
  const coffee = recipe.coffeeConcOz * k;
  const water = recipe.waterOz * k;
  const ubeTbsp = (recipe.ubeTbsp || 0) * k;
  const totalOz = coconut + horchata + coffee + water; // ube tbsp excluded
  return { k, coconut, horchata, coffee, water, ubeTbsp, totalOz };
}

function computeScaledFrac(recipe: Recipe, cartonsEq: number) {
  const k = Math.max(0, Number(cartonsEq) || 0); // <-- fixed var name
  const coconut = recipe.coconutOz * k;
  const horchata = recipe.horchataOz * k;
  const coffee = recipe.coffeeConcOz * k;
  const water = recipe.waterOz * k;
  const ubeTbsp = (recipe.ubeTbsp || 0) * k;
  const totalOz = coconut + horchata + coffee + water;
  return { k, coconut, horchata, coffee, water, ubeTbsp, totalOz };
}

function yieldFor(totalOz: number, bottleSizeOz: number) {
  const size = Math.max(1, bottleSizeOz || 0);
  const fullBottles = Math.floor(totalOz / size);
  const remainderOz = totalOz - fullBottles * size;
  return { fullBottles, remainderOz };
}
function topOff(remainderOz: number, bottleSizeOz: number) {
  const size = Math.max(1, bottleSizeOz || 0);
  const extraBottles = Math.floor(remainderOz / size);
  const leftoverOz = remainderOz - extraBottles * size;
  return { extraBottles, leftoverOz };
}
function basesFromScaled(x: { coconut: number; horchata: number; coffee: number; water: number; totalOz: number }) {
  const horchataBaseOz = x.coconut + x.horchata;
  const coldBrewBaseOz = x.coffee + x.water;
  const totalMixOz = x.totalOz;
  return { horchataBaseOz, coldBrewBaseOz, totalMixOz };
}

// Bottle split helper: clamp second flavor to leftovers after first
function planByBottles(
  cartons: number,
  bottleSizeOz: number,
  leadFlavor: Flavor,
  leadBottlesRaw: number
) {
  const capacityOz = Math.max(0, cartons) * TOTAL_PER_CARTON_OZ;
  const size = Math.max(1, bottleSizeOz || 0);
  const capacityBottles = Math.floor(capacityOz / size);

  const leadBottles = Math.max(0, Math.min(Math.floor(leadBottlesRaw || 0), capacityBottles));
  const remainingBottlesCap = Math.max(0, capacityBottles - leadBottles);
  const otherFlavor: Flavor = leadFlavor === "dirtyUbe" ? "tikiChata" : "dirtyUbe";

  const leadUsedOz = leadBottles * size;
  const otherBottles = remainingBottlesCap; // clamp other to whatever remains
  const otherUsedOz = otherBottles * size;
  const remainderOz = capacityOz - (leadUsedOz + otherUsedOz); // < size

  const leadCartonsEq = leadUsedOz / TOTAL_PER_CARTON_OZ;
  const otherCartonsEq = otherUsedOz / TOTAL_PER_CARTON_OZ;

  const leadScaled = computeScaledFrac(baseRecipes[leadFlavor], leadCartonsEq);
  const otherScaled = computeScaledFrac(baseRecipes[otherFlavor], otherCartonsEq);

  return { capacityOz, capacityBottles, size, leadFlavor, otherFlavor, leadBottles, otherBottles, remainderOz, leadScaled, otherScaled };
}

// Simple inline components to avoid external UI deps
function Card(props: React.HTMLAttributes<HTMLDivElement>) { return <div {...props} className={(props.className || "") + " rounded-2xl border bg-white shadow-sm"} />; }
function CardHeader(props: React.HTMLAttributes<HTMLDivElement>) { return <div {...props} className={(props.className || "") + " p-4 pb-2"} />; }
function CardContent(props: React.HTMLAttributes<HTMLDivElement>) { return <div {...props} className={(props.className || "") + " px-4 pb-4"} />; }
function CardTitle(props: React.HTMLAttributes<HTMLHeadingElement>) { return <h3 {...props} className={(props.className || "") + " text-lg font-semibold"} />; }

function BottleSvg({ className = "inline-block h-4 w-4 align-[-2px]" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 2h4v3l1 1v3l-1 1v9a3 3 0 0 1-3 3h0a3 3 0 0 1-3-3v-9l-1-1V6l1-1V2z" />
    </svg>
  );
}

export default function FlavoredColdBrewBottleCalculator() {
  const [cartons, setCartons] = useState<number>(1);
  const [bottleSizeOz, setBottleSizeOz] = useState<number>(12);

  // Split modes
  const [splitMode, setSplitMode] = useState<"cartons" | "bottles">("cartons");

  // Split-by-Cartons (simple & reliable)
  const [ubeCartons, setUbeCartons] = useState<number>(0);
  const tikiCartons = Math.max(0, cartons - ubeCartons);

  // Split-by-Bottles (lead clamps; other auto-fills)
  const [leadFlavor, setLeadFlavor] = useState<Flavor>("dirtyUbe");
  const [leadBottles, setLeadBottles] = useState<number>(0);

  useEffect(() => {
    // keep ubeCartons in range when cartons changes
    setUbeCartons((c) => Math.min(Math.max(0, Math.floor(c)), Math.max(0, Math.floor(cartons))));
    // clamp lead bottles to new capacity
    const size = Math.max(1, bottleSizeOz || 0);
    const capB = Math.floor((cartons * TOTAL_PER_CARTON_OZ) / size);
    setLeadBottles((b) => Math.max(0, Math.min(Math.floor(b || 0), capB)));
  }, [cartons, bottleSizeOz]);

  // Full-batch for reference (all cartons one flavor)
  const tikiAll = useMemo(() => computeScaled(baseRecipes.tikiChata, cartons), [cartons]);
  const ubeAll  = useMemo(() => computeScaled(baseRecipes.dirtyUbe, cartons), [cartons]);

  // Split results (cartons)
  const tikiSplit  = useMemo(() => computeScaled(baseRecipes.tikiChata, tikiCartons), [tikiCartons]);
  const ubeSplit   = useMemo(() => computeScaled(baseRecipes.dirtyUbe, ubeCartons), [ubeCartons]);
  const tikiSplitY = useMemo(() => yieldFor(tikiSplit.totalOz, bottleSizeOz), [tikiSplit, bottleSizeOz]);
  const ubeSplitY  = useMemo(() => yieldFor(ubeSplit.totalOz, bottleSizeOz), [ubeSplit, bottleSizeOz]);
  const tikiSplitB = useMemo(() => basesFromScaled(tikiSplit), [tikiSplit]);
  const ubeSplitB  = useMemo(() => basesFromScaled(ubeSplit), [ubeSplit]);
  const combinedRem = tikiSplitY.remainderOz + ubeSplitY.remainderOz;
  const topOffPlan = topOff(combinedRem, bottleSizeOz);

  // Split results (bottles)
  const bottlePlan = useMemo(() => planByBottles(cartons, bottleSizeOz, leadFlavor, leadBottles), [cartons, bottleSizeOz, leadFlavor, leadBottles]);
  const leadYield  = useMemo(() => yieldFor(bottlePlan.leadScaled.totalOz, bottleSizeOz), [bottlePlan, bottleSizeOz]);
  const otherYield = useMemo(() => yieldFor(bottlePlan.otherScaled.totalOz, bottleSizeOz), [bottlePlan, bottleSizeOz]);
  const leadBases  = useMemo(() => basesFromScaled(bottlePlan.leadScaled), [bottlePlan]);
  const otherBases = useMemo(() => basesFromScaled(bottlePlan.otherScaled), [bottlePlan]);

  // ------------- tiny tests -------------
  const approxEq = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps;
  const tests: { name: string; run: () => true | string | boolean }[] = [
    { name: "computeScaled tiki (1 carton)", run: () => { const x = computeScaled(baseRecipes.tikiChata, 1); return (x.coconut===32 && x.horchata===16 && x.coffee===59 && x.water===59 && x.ubeTbsp===0 && x.totalOz===166) || `unexpected ${JSON.stringify(x)}`; } },
    { name: "computeScaled dirtyUbe (2 cartons)", run: () => { const x = computeScaled(baseRecipes.dirtyUbe, 2); return (x.ubeTbsp===3 && x.totalOz===332) || `expected ube=3, total=332 got ${x.ubeTbsp}, ${x.totalOz}`; } },
    { name: "yieldFor 166oz @12", run: () => { const y = yieldFor(166, 12); return (y.fullBottles===13 && approxEq(y.remainderOz,10)) || `expected 13 & 10, got ${y.fullBottles} & ${y.remainderOz}`; } },
    { name: "topOff 22 @12", run: () => { const t = topOff(22,12); return (t.extraBottles===1 && approxEq(t.leftoverOz,10)) || `expected 1 & 10, got ${t.extraBottles} & ${t.leftoverOz}`; } },
    { name: "basesFromScaled tiki (1 carton)", run: () => { const b = basesFromScaled(computeScaled(baseRecipes.tikiChata,1)); return (b.horchataBaseOz===48 && b.coldBrewBaseOz===118 && b.totalMixOz===166) || `unexpected ${JSON.stringify(b)}`; } },
    { name: "computeScaledFrac dirtyUbe (0.5 carton)", run: () => { const x = computeScaledFrac(baseRecipes.dirtyUbe,0.5); return (approxEq(x.ubeTbsp,0.75) && approxEq(x.totalOz,83)) || `expected ube=0.75 total=83 got ${x.ubeTbsp} & ${x.totalOz}`; } },
    { name: "capacity calc @1 carton, 12oz", run: () => { const capB = Math.floor(TOTAL_PER_CARTON_OZ/12); const left = TOTAL_PER_CARTON_OZ%12; return (capB===13 && approxEq(left,10)) || `expected 13 & 10, got ${capB} & ${left}`; } },
    { name: "bottle split ube=1 (1 carton @12)", run: () => {
      const size=12; const capOz=TOTAL_PER_CARTON_OZ; const capB=Math.floor(capOz/size);
      const leadB=1; const otherB=capB-leadB; const rem=capOz-capB*size;
      const u=computeScaledFrac(baseRecipes.dirtyUbe,(leadB*size)/TOTAL_PER_CARTON_OZ);
      const t=computeScaledFrac(baseRecipes.tikiChata,(otherB*size)/TOTAL_PER_CARTON_OZ);
      return (otherB===12 && approxEq(rem,10) && approxEq(u.totalOz+t.totalOz, capB*size)) || `expected other=12 rem=10 sum=${capB*size} got other=${otherB} rem=${rem} sum=${u.totalOz+t.totalOz}`;
    }},
  ];
  const results = tests.map(t => { try { const r = t.run(); return { name: t.name, ok: (r === true || r === 1 || r === "true" || r === "OK"), msg: r === true ? "" : String(r) }; } catch (e: any) { return { name: t.name, ok: false, msg: e?.message || String(e) }; } });

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-50 to-white text-slate-900">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <header className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Flavored Cold Brew Bottle Calculator</h1>
          <p className="text-slate-600 mt-1">Scale linearly by 32 fl oz coconut milk cartons. Bottle default: 12 fl oz.</p>
        </header>

        <Card className="mb-6">
          <CardHeader><CardTitle>Inputs</CardTitle></CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium" htmlFor="cartons">Coconut Milk Cartons (32 fl oz each)</label>
                <div className="flex gap-2 mt-1">
                  <input id="cartons" type="number" min={1} step={1} value={cartons} onChange={(e)=>setCartons(Number(e.target.value)||1)} className="border rounded-xl px-3 py-2 w-32"/>
                  <div className="flex gap-2">
                    {[1,2,3].map(n=> (
                      <button key={n} onClick={()=>setCartons(n)} className={`rounded-2xl px-3 py-2 text-sm border ${n===cartons?"bg-slate-900 text-white":"bg-white"}`}>{n}</button>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-1">Each carton = 32 fl oz. Recipes scale linearly by carton count.</p>
              </div>
              <div>
                <label className="text-sm font-medium" htmlFor="bottle">Bottle Size (fl oz)</label>
                <div className="flex gap-2 mt-1">
                  <input id="bottle" type="number" min={1} step={0.5} value={bottleSizeOz} onChange={(e)=>setBottleSizeOz(Number(e.target.value)||12)} className="border rounded-xl px-3 py-2 w-32"/>
                  <div className="flex gap-2">
                    {[10,12,16].map(n=> (
                      <button key={n} onClick={()=>setBottleSizeOz(n)} className={`rounded-2xl px-3 py-2 text-sm border ${n===bottleSizeOz?"bg-slate-900 text-white":"bg-white"}`}>{n}</button>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-1">Default 12 fl oz bottles. Change if you use a different size.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Split Production Planner */}
        <Card className="mt-6">
          <CardHeader><CardTitle className="text-base">Split Production Planner</CardTitle></CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-3">
              <span className="text-xs text-slate-600">Mode:</span>
              <button onClick={()=>setSplitMode("cartons")} className={`rounded-2xl px-3 py-1 text-sm border ${splitMode==="cartons"?"bg-slate-900 text-white":"bg-white"}`}>By Cartons</button>
              <button onClick={()=>setSplitMode("bottles")} className={`rounded-2xl px-3 py-1 text-sm border ${splitMode==="bottles"?"bg-slate-900 text-white":"bg-white"}`}>By Bottles</button>
            </div>

            {splitMode === "cartons" ? (
              <>
                <p className="text-sm text-slate-600 mb-3">Allocate your {cartons} carton(s) between Dirty Ube and Tiki Chata. Slider sets Dirty Ube; Tiki gets the rest.</p>
                <div className="mb-4">
                  <label className="text-sm font-medium">Dirty Ube Cartons: <span className="font-semibold">{ubeCartons}</span> / {cartons} (Tiki: <span className="font-semibold">{tikiCartons}</span>)</label>
                  <input type="range" min={0} max={cartons} step={1} value={ubeCartons} onChange={(e)=>setUbeCartons(Number(e.target.value)||0)} className="w-full mt-2"/>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  {/* Dirty Ube card */}
                  <div className="rounded-xl border p-4 border-fuchsia-300">
                    <p className="font-semibold mb-1">Dirty Ube - {ubeCartons} carton(s)</p>
                    <div className="grid grid-cols-2 text-sm gap-y-1">
                      <div className="text-slate-500">Total Volume</div><div className="font-medium">{fmt(ubeSplit.totalOz)} fl oz</div>
                      <div className="text-slate-500 flex items-center gap-2"><BottleSvg/> Full Bottles</div><div className="font-medium">{ubeSplitY.fullBottles} x  {fmt(bottleSizeOz)} fl oz</div>
                      <div className="text-slate-500">Remainder</div><div className="font-medium">{fmt(ubeSplitY.remainderOz)} fl oz</div>
                      <div className="text-slate-500">Ube Concentrate</div><div className="font-medium">{fmt(ubeSplit.ubeTbsp)} tbsp</div>
                    </div>
                    <div className="mt-3">
                      <p className="text-sm font-semibold mb-1">Scaled Ingredients</p>
                      <ul className="text-sm space-y-1 list-disc pl-5">
                        <li>Coconut Milk: <span className="font-medium">{fmt(ubeSplit.coconut)} fl oz</span></li>
                        <li>Horchata Mix: <span className="font-medium">{fmt(ubeSplit.horchata)} fl oz</span></li>
                        <li>Coffee Concentrate: <span className="font-medium">{fmt(ubeSplit.coffee)} fl oz</span></li>
                        <li>Water: <span className="font-medium">{fmt(ubeSplit.water)} fl oz</span></li>
                        <li>Ube Concentrate: <span className="font-medium">{fmt(ubeSplit.ubeTbsp)} tbsp</span></li>
                      </ul>
                      <div className="mt-3 grid grid-cols-2 text-sm gap-y-1">
                        <div className="text-slate-500">Horchata Base</div><div className="font-medium">{unitTriplet(ubeSplitB.horchataBaseOz)}</div>
                        <div className="text-slate-500">Cold Brew Base</div><div className="font-medium">{unitTriplet(ubeSplitB.coldBrewBaseOz)}</div>
                        <div className="text-slate-500">Horchata + Cold Brew</div><div className="font-medium">{unitTriplet(ubeSplitB.totalMixOz)}</div>
                      </div>
                    </div>
                  </div>

                  {/* Tiki card */}
                  <div className="rounded-xl border p-4 border-amber-300">
                    <p className="font-semibold mb-1">Tiki Chata - {tikiCartons} carton(s)</p>
                    <div className="grid grid-cols-2 text-sm gap-y-1">
                      <div className="text-slate-500">Total Volume</div><div className="font-medium">{fmt(tikiSplit.totalOz)} fl oz</div>
                      <div className="text-slate-500 flex items-center gap-2"><BottleSvg/> Full Bottles</div><div className="font-medium">{tikiSplitY.fullBottles} x  {fmt(bottleSizeOz)} fl oz</div>
                      <div className="text-slate-500">Remainder</div><div className="font-medium">{fmt(tikiSplitY.remainderOz)} fl oz</div>
                    </div>
                    <div className="mt-3">
                      <p className="text-sm font-semibold mb-1">Scaled Ingredients</p>
                      <ul className="text-sm space-y-1 list-disc pl-5">
                        <li>Coconut Milk: <span className="font-medium">{fmt(tikiSplit.coconut)} fl oz</span></li>
                        <li>Horchata Mix: <span className="font-medium">{fmt(tikiSplit.horchata)} fl oz</span></li>
                        <li>Coffee Concentrate: <span className="font-medium">{fmt(tikiSplit.coffee)} fl oz</span></li>
                        <li>Water: <span className="font-medium">{fmt(tikiSplit.water)} fl oz</span></li>
                      </ul>
                      <div className="mt-3 grid grid-cols-2 text-sm gap-y-1">
                        <div className="text-slate-500">Horchata Base</div><div className="font-medium">{unitTriplet(tikiSplitB.horchataBaseOz)}</div>
                        <div className="text-slate-500">Cold Brew Base</div><div className="font-medium">{unitTriplet(tikiSplitB.coldBrewBaseOz)}</div>
                        <div className="text-slate-500">Horchata + Cold Brew</div><div className="font-medium">{unitTriplet(tikiSplitB.totalMixOz)}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-x-6 gap-y-2 text-sm">
                  <div className="text-slate-500">Total Full Bottles</div>
                  <div className="font-semibold col-span-2">{ubeSplitY.fullBottles + tikiSplitY.fullBottles}</div>
                  <div className="text-slate-500">Combined Remainder</div>
                  <div className="font-semibold col-span-2">{fmt(combinedRem)} fl oz</div>
                  <div className="text-slate-500">Extra Bottles from Remainders</div>
                  <div className="font-semibold col-span-2">{topOffPlan.extraBottles}</div>
                  <div className="text-slate-500">Leftover After Extra Bottles</div>
                  <div className="font-semibold col-span-2">{fmt(topOffPlan.leftoverOz)} fl oz</div>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-slate-600 mb-3">Set a target for one flavor (lead). The other flavor automatically uses all remaining capacity from your {cartons} carton(s).</p>
                <div className="flex flex-wrap items-end gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">Lead Flavor:</span>
                    <button onClick={()=>setLeadFlavor("dirtyUbe")} className={`rounded-2xl px-3 py-1 text-sm border ${leadFlavor==="dirtyUbe"?"bg-slate-900 text-white":"bg-white"}`}>Dirty Ube</button>
                    <button onClick={()=>setLeadFlavor("tikiChata")} className={`rounded-2xl px-3 py-1 text-sm border ${leadFlavor==="tikiChata"?"bg-slate-900 text-white":"bg-white"}`}>Tiki Chata</button>
                  </div>
                  <div>
                    <label className="text-sm font-medium" htmlFor="leadBottles">Lead # of bottles</label>
                    <div className="flex items-center gap-2 mt-1">
                      <input id="leadBottles" type="number" min={0} step={1} value={leadBottles} onChange={(e)=>setLeadBottles(Number(e.target.value)||0)} className="border rounded-xl px-3 py-2 w-28"/>
                      <span className="text-xs text-slate-500">Bottle size: {fmt(bottleSizeOz)} fl oz</span>
                    </div>
                  </div>
                  <div className="text-sm text-slate-600 ml-auto">Capacity: {bottlePlan.capacityBottles} bottles total, remainder after plan: {fmt(bottlePlan.remainderOz)} fl oz</div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  {/* Lead card */}
                  <div className={"rounded-xl border p-4 " + (leadFlavor==="dirtyUbe"?"border-fuchsia-300":"border-amber-300")}>
                    <p className="font-semibold mb-1">{leadFlavor==="dirtyUbe"?"Dirty Ube":"Tiki Chata"} - {bottlePlan.leadBottles} bottle(s)</p>
                    <div className="grid grid-cols-2 text-sm gap-y-1">
                      <div className="text-slate-500">Total Volume</div><div className="font-medium">{fmt(bottlePlan.leadScaled.totalOz)} fl oz</div>
                      <div className="text-slate-500 flex items-center gap-2"><BottleSvg/> Full Bottles</div><div className="font-medium">{leadYield.fullBottles} x  {fmt(bottleSizeOz)} fl oz</div>
                      <div className="text-slate-500">Remainder</div><div className="font-medium">{fmt(leadYield.remainderOz)} fl oz</div>
                      {leadFlavor==="dirtyUbe" && <><div className="text-slate-500">Ube Concentrate</div><div className="font-medium">{fmt(bottlePlan.leadScaled.ubeTbsp)} tbsp</div></>}
                    </div>
                    <div className="mt-3">
                      <p className="text-sm font-semibold mb-1">Scaled Ingredients</p>
                      <ul className="text-sm space-y-1 list-disc pl-5">
                        <li>Coconut Milk: <span className="font-medium">{fmt(bottlePlan.leadScaled.coconut)} fl oz</span></li>
                        <li>Horchata Mix: <span className="font-medium">{fmt(bottlePlan.leadScaled.horchata)} fl oz</span></li>
                        <li>Coffee Concentrate: <span className="font-medium">{fmt(bottlePlan.leadScaled.coffee)} fl oz</span></li>
                        <li>Water: <span className="font-medium">{fmt(bottlePlan.leadScaled.water)} fl oz</span></li>
                        {leadFlavor==="dirtyUbe" && <li>Ube Concentrate: <span className="font-medium">{fmt(bottlePlan.leadScaled.ubeTbsp)} tbsp</span></li>}
                      </ul>
                      <div className="mt-3 grid grid-cols-2 text-sm gap-y-1">
                        <div className="text-slate-500">Horchata Base</div><div className="font-medium">{unitTriplet(leadBases.horchataBaseOz)}</div>
                        <div className="text-slate-500">Cold Brew Base</div><div className="font-medium">{unitTriplet(leadBases.coldBrewBaseOz)}</div>
                        <div className="text-slate-500">Horchata + Cold Brew</div><div className="font-medium">{unitTriplet(leadBases.totalMixOz)}</div>
                      </div>
                    </div>
                  </div>

                  {/* Other card */}
                  <div className={"rounded-xl border p-4 " + (bottlePlan.otherFlavor==="dirtyUbe"?"border-fuchsia-300":"border-amber-300")}>
                    <p className="font-semibold mb-1">{bottlePlan.otherFlavor==="dirtyUbe"?"Dirty Ube":"Tiki Chata"} - {bottlePlan.otherBottles} bottle(s)</p>
                    <div className="grid grid-cols-2 text-sm gap-y-1">
                      <div className="text-slate-500">Total Volume</div><div className="font-medium">{fmt(bottlePlan.otherScaled.totalOz)} fl oz</div>
                      <div className="text-slate-500 flex items-center gap-2"><BottleSvg/> Full Bottles</div><div className="font-medium">{otherYield.fullBottles} x  {fmt(bottleSizeOz)} fl oz</div>
                      <div className="text-slate-500">Remainder</div><div className="font-medium">{fmt(otherYield.remainderOz)} fl oz</div>
                      {bottlePlan.otherFlavor==="dirtyUbe" && <><div className="text-slate-500">Ube Concentrate</div><div className="font-medium">{fmt(bottlePlan.otherScaled.ubeTbsp)} tbsp</div></>}
                    </div>
                    <div className="mt-3">
                      <p className="text-sm font-semibold mb-1">Scaled Ingredients</p>
                      <ul className="text-sm space-y-1 list-disc pl-5">
                        <li>Coconut Milk: <span className="font-medium">{fmt(bottlePlan.otherScaled.coconut)} fl oz</span></li>
                        <li>Horchata Mix: <span className="font-medium">{fmt(bottlePlan.otherScaled.horchata)} fl oz</span></li>
                        <li>Coffee Concentrate: <span className="font-medium">{fmt(bottlePlan.otherScaled.coffee)} fl oz</span></li>
                        <li>Water: <span className="font-medium">{fmt(bottlePlan.otherScaled.water)} fl oz</span></li>
                        {bottlePlan.otherFlavor==="dirtyUbe" && <li>Ube Concentrate: <span className="font-medium">{fmt(bottlePlan.otherScaled.ubeTbsp)} tbsp</span></li>}
                      </ul>
                      <div className="mt-3 grid grid-cols-2 text-sm gap-y-1">
                        <div className="text-slate-500">Horchata Base</div><div className="font-medium">{unitTriplet(otherBases.horchataBaseOz)}</div>
                        <div className="text-slate-500">Cold Brew Base</div><div className="font-medium">{unitTriplet(otherBases.coldBrewBaseOz)}</div>
                        <div className="text-slate-500">Horchata + Cold Brew</div><div className="font-medium">{unitTriplet(otherBases.totalMixOz)}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-x-6 gap-y-2 text-sm">
                  <div className="text-slate-500">Planned Full Bottles</div>
                  <div className="font-semibold col-span-2">{bottlePlan.leadBottles + bottlePlan.otherBottles}</div>
                  <div className="text-slate-500">Unused (oz)</div>
                  <div className="font-semibold col-span-2">{fmt(bottlePlan.remainderOz)} fl oz</div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Full-batch reference */}
        <div className="grid lg:grid-cols-2 gap-6 mt-6">
          <Card className="border-fuchsia-300">
            <CardHeader><CardTitle>Dirty Ube (All {cartons} carton)</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                <div className="text-slate-500">Total Volume</div><div className="font-semibold">{fmt(ubeAll.totalOz)} fl oz</div>
                <div className="text-slate-500 flex items-center gap-2"><BottleSvg/> Full Bottles</div><div className="font-semibold">{Math.floor(ubeAll.totalOz/bottleSizeOz)} x  {fmt(bottleSizeOz)} fl oz</div>
                <div className="text-slate-500">Remainder</div><div className="font-semibold">{fmt(ubeAll.totalOz - Math.floor(ubeAll.totalOz/bottleSizeOz)*bottleSizeOz)} fl oz</div>
              </div>
              <div className="mt-3 grid grid-cols-2 text-sm gap-y-1">
                <div className="text-slate-500">Horchata Base</div><div className="font-medium">{unitTriplet(ubeAll.coconut + ubeAll.horchata)}</div>
                <div className="text-slate-500">Cold Brew Base</div><div className="font-medium">{unitTriplet(ubeAll.coffee + ubeAll.water)}</div>
                <div className="text-slate-500">Horchata + Cold Brew</div><div className="font-medium">{unitTriplet(ubeAll.totalOz)}</div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-amber-300">
            <CardHeader><CardTitle>Tiki Chata (All {cartons} carton)</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                <div className="text-slate-500">Total Volume</div><div className="font-semibold">{fmt(tikiAll.totalOz)} fl oz</div>
                <div className="text-slate-500 flex items-center gap-2"><BottleSvg/> Full Bottles</div><div className="font-semibold">{Math.floor(tikiAll.totalOz/bottleSizeOz)} x  {fmt(bottleSizeOz)} fl oz</div>
                <div className="text-slate-500">Remainder</div><div className="font-semibold">{fmt(tikiAll.totalOz - Math.floor(tikiAll.totalOz/bottleSizeOz)*bottleSizeOz)} fl oz</div>
              </div>
              <div className="mt-3 grid grid-cols-2 text-sm gap-y-1">
                <div className="text-slate-500">Horchata Base</div><div className="font-medium">{unitTriplet(tikiAll.coconut + tikiAll.horchata)}</div>
                <div className="text-slate-500">Cold Brew Base</div><div className="font-medium">{unitTriplet(tikiAll.coffee + tikiAll.water)}</div>
                <div className="text-slate-500">Horchata + Cold Brew</div><div className="font-medium">{unitTriplet(tikiAll.totalOz)}</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Unit Tests */}
        <Card className="mt-8">
          <CardHeader><CardTitle className="text-base">Unit Tests</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {results.map((r,i)=> (
                <li key={i} className={r.ok?"text-emerald-700":"text-rose-700"}>
                  <span className="font-medium">{r.ok?"PASS":"FAIL"}</span> - {r.name} {r.msg && <span className="text-slate-500">({r.msg})</span>}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
