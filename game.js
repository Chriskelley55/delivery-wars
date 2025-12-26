// Delivery Wars — MVP (static)
// Adds: named fleet + per-vehicle wear/reliability + energy model (elec + gas)
// 2039 tuning: slightly better efficiency (lower kWh/mi) by class.

const $ = (id) => document.getElementById(id);

const VEHICLE_NAMES = [
  "Clyde",
  "Earl",
  "Betsy",
  "Dream",
  "Bags",
  "Screw",
  "Rocket",
  "Colt",
  "Big Jim",
  "Queen Bee",
];

// Energy specs (kWh/mi + battery kWh) with 2039 efficiency improvements applied.
// NOTE: Big Jim is anchored as a very large pack vehicle; we keep the drama.
const ENERGY = {
  elecPricePerKwh: 0.22,
  gasPricePerGallon: 4.20,

  locations: {
    garage: { markupElec: 1.00, markupGas: 1.00, heatDelta: 0, wearDelta: 0 },
    publicDock: { markupElec: 1.35, markupGas: 1.15, heatDelta: 1, wearDelta: 2 },
    grayDock: { markupElec: 0.80, markupGas: 1.00, heatDelta: 3, wearDelta: 6 }, // risky
  },

  vehicles: {
    "Rocket":    { fuel: "electric", kwhPerMile: 0.200, batteryKwh: 60  },   // -20%
    "Betsy":     { fuel: "electric", kwhPerMile: 0.240, batteryKwh: 90  },   // -25%
    "Bags":      { fuel: "electric", kwhPerMile: 0.440, batteryKwh: 120 },   // -20%
    "Screw":     { fuel: "electric", kwhPerMile: 0.645, batteryKwh: 180 },   // -14%
    "Dream":     { fuel: "electric", kwhPerMile: 0.808, batteryKwh: 250 },   // -15%
    "Earl":      { fuel: "electric", kwhPerMile: 0.792, batteryKwh: 220 },   // -12%
    "Clyde":     { fuel: "electric", kwhPerMile: 0.817, batteryKwh: 240 },   // -14%
    "Queen Bee": { fuel: "electric", kwhPerMile: 0.924, batteryKwh: 300 },   // -12%
    "Big Jim":   { fuel: "electric", kwhPerMile: 2.030, batteryKwh: 2000 },  // -18% (still brutal)
    "Colt":      { fuel: "hybrid",   kwhPerMile: 0.280, batteryKwh: 18, gasMpg: 18, tankGallons: 12 }, // -20% EV mode
  }
};

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
function rngInt(min, max) { return Math.floor(min + Math.random() * (max - min + 1)); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function fmtMoney(n) { return `$${Math.round(n).toLocaleString()}`; }
function fmtPrice(n) { return `$${n.toFixed(2)}`; }

function cryptoRandomId() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function newVehicle(name) {
  const spec = ENERGY.vehicles[name];
  if (!spec) throw new Error(`Missing ENERGY spec for vehicle: ${name}`);

  const v = {
    name,
    wear: 0,          // 0..100
    reliability: 70,  // 0..100
    fuel: spec.fuel,

    batteryKwh: spec.batteryKwh,
    kwhPerMile: spec.kwhPerMile,
    chargeKwh: spec.batteryKwh, // start full

    // hybrid only:
    gasMpg: spec.gasMpg ?? null,
    tankGallons: spec.tankGallons ?? null,
    gasGallons: spec.tankGallons ?? null,
  };

  return v;
}

const state = {
  day: 1,
  cash: 1000,
  carma: 20,
  heat: 0,
  vehicles: [newVehicle("Dream")], // start with Dream for flavor; can swap if you want Clyde-first
  activeIdx: 0,
  log: [],
  jobs: [],
};

function activeVehicle() {
  return state.vehicles[state.activeIdx];
}

function addLog(text, cls) {
  state.log.unshift({ text, cls });
  state.log = state.log.slice(0, 12);
  renderLog();
}

function renderLog() {
  const ul = $("log");
  ul.innerHTML = "";
  state.log.forEach((e) => {
    const li = document.createElement("li");
    li.textContent = e.text;
    if (e.cls) li.classList.add(e.cls);
    ul.appendChild(li);
  });
}

function renderStats() {
  const v = activeVehicle();

  $("day").textContent = String(state.day);
  $("cash").textContent = fmtMoney(state.cash);
  $("carma").textContent = String(state.carma);
  $("heat").textContent = String(state.heat);
  $("fleet").textContent = String(state.vehicles.length);

  $("activeCar").textContent = v?.name ?? "—";
  $("wear").textContent = `${v?.wear ?? 0}%`;

  const chargePct = v ? Math.round((v.chargeKwh / v.batteryKwh) * 100) : 0;
  $("charge").textContent = `${clamp(chargePct, 0, 100)}%`;
  $("fuel").textContent = v?.fuel === "hybrid" ? "Hybrid" : "EV";

  $("elecPrice").textContent = fmtPrice(ENERGY.elecPricePerKwh);
  $("gasPrice").textContent = fmtPrice(ENERGY.gasPricePerGallon);

  // Show/hide gas UI
  const gasBlock = $("gasBlock");
  if (v?.fuel === "hybrid") gasBlock.style.display = "block";
  else gasBlock.style.display = "none";
}

function genJob() {
  const names = [
    "Warehouse Run (Steppe)",
    "Sugartown Priority",
    "Medical Drop (Cold Chain)",
    "High-Value Gift (Human Tag)",
    "Night Loop (Low Visibility)",
    "Downtown Bundle",
  ];

  const name = pick(names);
  const distance = rngInt(5, 26);      // miles
  const deadline = rngInt(10, 36);     // minutes
  const basePay = rngInt(180, 520) + distance * rngInt(8, 18);
  let pay = basePay;
  if (name.includes("Gift") || name.includes("Medical")) pay += 120;

  let zone = "Houston";
  let enforce = rngInt(5, 30);
  if (name.includes("Sugartown")) { zone = "Sugartown"; enforce += 25; }
  if (name.includes("Night")) { enforce -= 10; }

  enforce = clamp(enforce + state.heat * 2, 0, 95);

  return {
    id: cryptoRandomId(),
    name,
    zone,
    distance,
    deadline,
    basePay: pay,
    enforce
  };
}

function refreshJobs() {
  state.jobs = [genJob(), genJob(), genJob()];
  renderJobs();
}

function renderJobs() {
  const root = $("jobs");
  root.innerHTML = "";

  state.jobs.forEach((job) => {
    const div = document.createElement("div");
    div.className = "job";

    const top = document.createElement("div");
    top.className = "jobTop";

    const left = document.createElement("div");
    left.innerHTML = `<div class="jobName">${job.name}</div>
      <div class="jobMeta">
        Zone: <b>${job.zone}</b> • Distance: <b>${job.distance}mi</b> • Window: <b>${job.deadline}m</b><br/>
        Base Pay: <b>${fmtMoney(job.basePay)}</b> • Enforcement Risk: <b>${job.enforce}%</b>
      </div>`;

    top.appendChild(left);
    div.appendChild(top);

    const pills = document.createElement("div");
    pills.className = "pills";

    ["Spend CARMA", "Earn CARMA", "Gray Route", "Safe Route"].forEach((label) => {
      const b = document.createElement("button");
      b.className = "btn secondary";
      b.textContent = label;
      b.addEventListener("click", () => runJob(job, label));
      pills.appendChild(b);
    });

    div.appendChild(pills);
    root.appendChild(div);
  });
}

function energyNeededForJob(vehicle, miles) {
  return miles * vehicle.kwhPerMile;
}

function runJob(job, strategy) {
  const v = activeVehicle();
  if (!v) return;

  // Must have enough charge to run the route
  const needKwh = energyNeededForJob(v, job.distance);
  if (v.chargeKwh < needKwh) {
    addLog(`Chip: (${v.name}) Not enough charge for ${job.distance}mi. Need ${needKwh.toFixed(1)} kWh, have ${v.chargeKwh.toFixed(1)}. Charge up.`, "bad");
    return;
  }

  // Strategy modifiers
  let etaMod = 0;
  let payMod = 0;
  let enforceMod = 0;
  let wearMod = 0;
  let carmaDelta = 0;

  if (strategy === "Spend CARMA") {
    if (state.carma <= 0) {
      addLog("Chip: CARMA depleted. Can't spend what you don't have.", "bad");
      return;
    }
    carmaDelta = -rngInt(3, 7);
    etaMod = +18;
    enforceMod = +8;
    wearMod = +6;
  }

  if (strategy === "Earn CARMA") {
    carmaDelta = +rngInt(3, 6);
    etaMod = -10;
    enforceMod = -6;
    wearMod = +2;
    payMod = -rngInt(20, 90);
  }

  if (strategy === "Gray Route") {
    etaMod = +25;
    payMod = +rngInt(40, 160);
    enforceMod = +22;
    wearMod = +10;
  }

  if (strategy === "Safe Route") {
    etaMod = +6;
    payMod = -rngInt(10, 80);
    enforceMod = -18;
    wearMod = +1;
  }

  // Chip prediction
  const baseOnTime = clamp(70 - Math.floor(job.distance / 2) - Math.floor(v.wear / 4), 20, 85);
  const onTimeChance = clamp(baseOnTime + etaMod + Math.floor(v.reliability / 10), 10, 95);
  const enforceChance = clamp(job.enforce + enforceMod + Math.floor(v.wear / 3), 0, 98);

  addLog(`Chip: (${v.name}) Forecast — On-time ${onTimeChance}% • Enforcement ${enforceChance}% • Strategy: ${strategy}`, "good");

  // Resolve outcome
  const onTime = (Math.random() * 100) <= onTimeChance;

  let ticketed = false;
  let ticketCost = 0;

  if ((Math.random() * 100) <= enforceChance) {
    ticketed = true;
    ticketCost = rngInt(120, 520) + state.heat * 15;
  }

  // Breakdown check
  let brokeDown = false;
  if (v.wear >= 70) {
    const breakChance = clamp(10 + (v.wear - 70) * 1.2 - v.reliability * 0.2, 5, 55);
    if ((Math.random() * 100) <= breakChance) brokeDown = true;
  }

  // Apply CARMA
  state.carma = clamp(state.carma + carmaDelta, 0, 99);

  // Apply payout
  let payout = job.basePay + payMod;
  if (!onTime) payout = Math.floor(payout * 0.65);
  if (brokeDown) payout = Math.floor(payout * 0.35);
  state.cash += payout;

  // Consume electricity
  v.chargeKwh = clamp(v.chargeKwh - needKwh, 0, v.batteryKwh);

  // Wear + heat
  const wearGain = clamp(rngInt(6, 14) + wearMod + Math.floor(job.distance / 6), 4, 30);
  v.wear = clamp(v.wear + wearGain, 0, 100);

  if (ticketed) {
    state.cash -= ticketCost;
    state.heat = clamp(state.heat + 2, 0, 25);
  } else {
    state.heat = clamp(state.heat - 1, 0, 25);
  }

  // Reliability drift
  if (v.wear >= 60) v.reliability = clamp(v.reliability - rngInt(0, 2), 20, 95);
  if (v.wear < 30) v.reliability = clamp(v.reliability + 1, 20, 95);

  const outcome = [];
  outcome.push(onTime ? "On time" : "Late");
  if (ticketed) outcome.push(`Ticket -${fmtMoney(ticketCost)}`);
  if (brokeDown) outcome.push("Breakdown (limped in)");
  outcome.push(`Energy -${needKwh.toFixed(1)} kWh`);

  addLog(`Delivery: (${v.name}) ${job.name} → +${fmtMoney(payout)} • ${outcome.join(" • ")} • Wear +${wearGain}%`, onTime ? "good" : "bad");

  // Rotate to next vehicle (so the fleet matters)
  state.activeIdx = (state.activeIdx + 1) % state.vehicles.length;

  refreshJobs();
  renderStats();
}

function chargeToFull(whereKey) {
  const v = activeVehicle();
  if (!v) return;

  const loc = ENERGY.locations[whereKey];
  const needed = clamp(v.batteryKwh - v.chargeKwh, 0, v.batteryKwh);
  if (needed <= 0.01) {
    addLog(`Chip: (${v.name}) Already full.`, "good");
    return;
  }

  const cost = needed * ENERGY.elecPricePerKwh * loc.markupElec;

  if (state.cash < cost) {
    addLog(`Floyd: Not enough cash to charge ${
