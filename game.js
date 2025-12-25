// Delivery Wars — MVP (static)
// Chip = prediction engine + policy levers (implicit)
// Floyd = repair choices + wear sink
// Goal: "one more run" loop.

const $ = (id) => document.getElementById(id);

const state = {
  day: 1,
  cash: 1000,
  carma: 20,
  heat: 0,       // enforcement attention
  fleet: 1,      // number of vehicles
  wear: 0,       // 0..100
  reliability: 70, // 0..100 affects breakdown odds
  log: [],
  jobs: [],
};

function fmtMoney(n) {
  return `$${n.toLocaleString()}`;
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function addLog(text, cls) {
  state.log.unshift({ text, cls });
  state.log = state.log.slice(0, 10);
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
  $("day").textContent = String(state.day);
  $("cash").textContent = fmtMoney(state.cash);
  $("carma").textContent = String(state.carma);
  $("heat").textContent = String(state.heat);
  $("fleet").textContent = String(state.fleet);
  $("wear").textContent = `${state.wear}%`;
}

function rngInt(min, max) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
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
  const distance = rngInt(4, 22); // miles
  const deadline = rngInt(10, 35); // minutes
  const basePay = rngInt(180, 520) + distance * rngInt(8, 18);

  // risk is influenced by heat and zone
  let zone = "Houston";
  let enforce = rngInt(5, 30);
  if (name.includes("Sugartown")) { zone = "Sugartown"; enforce += 25; }
  if (name.includes("Night")) { enforce -= 10; }
  if (name.includes("Gift") || name.includes("Medical")) { basePay + 120; }

  enforce = clamp(enforce + state.heat * 2, 0, 95);

  let rep = 0;
  if (name.includes("Human")) rep = 2;

  return {
    id: cryptoRandomId(),
    name,
    zone,
    distance,
    deadline,
    basePay,
    enforce, // % chance of enforcement event if risky
    rep,     // small rep bump (we keep it minimal in MVP)
  };
}

function cryptoRandomId() {
  // safe enough for UI keys
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
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

    const right = document.createElement("div");
    right.innerHTML = `<button class="btn" data-job="${job.id}">Select</button>`;

    top.appendChild(left);
    top.appendChild(right);
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

function runJob(job, strategy) {
  // Strategy modifiers
  let etaMod = 0;          // affects on-time odds
  let payMod = 0;          // affects payout
  let enforceMod = 0;      // affects enforcement odds
  let wearMod = 0;         // affects wear gain
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

  // Chip prediction (we show it as a log line)
  const baseOnTime = clamp(70 - Math.floor(job.distance / 2) - Math.floor(state.wear / 4), 20, 85);
  const onTimeChance = clamp(baseOnTime + etaMod + Math.floor(state.reliability / 10), 10, 95);
  const enforceChance = clamp(job.enforce + enforceMod + Math.floor(state.wear / 3), 0, 98);

  addLog(`Chip: Forecast — On-time ${onTimeChance}% • Enforcement ${enforceChance}% • Strategy: ${strategy}`, "good");

  // Resolve outcome
  const onTimeRoll = Math.random() * 100;
  const enforceRoll = Math.random() * 100;

  const onTime = onTimeRoll <= onTimeChance;

  let ticketed = false;
  let ticketCost = 0;

  if (enforceRoll <= enforceChance) {
    ticketed = true;
    ticketCost = rngInt(120, 520) + state.heat * 15;
  }

  // Breakdown check (only if wear high)
  let brokeDown = false;
  if (state.wear >= 70) {
    const breakChance = clamp(10 + (state.wear - 70) * 1.2 - state.reliability * 0.2, 5, 55);
    if (Math.random() * 100 <= breakChance) {
      brokeDown = true;
    }
  }

  // Apply deltas
  state.carma = clamp(state.carma + carmaDelta, 0, 99);

  let payout = job.basePay + payMod;
  if (!onTime) payout = Math.floor(payout * 0.65);
  if (brokeDown) payout = Math.floor(payout * 0.35);

  state.cash += payout;

  // Wear + heat changes
  const wearGain = clamp(rngInt(6, 14) + wearMod + Math.floor(job.distance / 6), 4, 30);
  state.wear = clamp(state.wear + wearGain, 0, 100);

  if (ticketed) {
    state.cash -= ticketCost;
    state.heat = clamp(state.heat + 2, 0, 20);
  } else {
    // heat slowly cools
    state.heat = clamp(state.heat - 1, 0, 20);
  }

  // Reliability drifts down if wear ignored
  if (state.wear >= 60) state.reliability = clamp(state.reliability - rngInt(0, 2), 20, 95);
  if (state.wear < 30) state.reliability = clamp(state.reliability + 1, 20, 95);

  // Log outcome
  const outcome = [];
  outcome.push(onTime ? "On time" : "Late");
  if (ticketed) outcome.push(`Ticket -${fmtMoney(ticketCost)}`);
  if (brokeDown) outcome.push("Breakdown (limped in)");

  addLog(`Delivery: ${job.name} → +${fmtMoney(payout)} • ${outcome.join(" • ")} • Wear +${wearGain}%`, onTime ? "good" : "bad");

  // Refresh jobs for "one more"
  refreshJobs();
  renderStats();
}

function endDay() {
  // Daily overhead creates pressure
  const overhead = 280 + state.fleet * 120;
  state.cash -= overhead;

  state.day += 1;

  // mild wear decay overnight (but not much)
  state.wear = clamp(state.wear - rngInt(3, 8), 0, 100);

  addLog(`Day ended. Overhead -${fmtMoney(overhead)}. New day begins.`, state.cash >= 0 ? "good" : "bad");

  // Lose condition: broke
  if (state.cash < 0) {
    addLog("Chip: Insolvency detected. Run ended. Press 'New Run' to restart.", "bad");
  }

  // Small growth carrot
  if (state.day === 4 || state.day === 7) {
    const cost = 1800 + state.fleet * 900;
    if (state.cash >= cost) {
      state.cash -= cost;
      state.fleet += 1;
      addLog(`Expansion: Bought a vehicle slot for ${fmtMoney(cost)}. Fleet is now ${state.fleet}.`, "good");
    } else {
      addLog(`Expansion opportunity missed. Need ${fmtMoney(cost)} to add a vehicle slot.`, "bad");
    }
  }

  refreshJobs();
  renderStats();
}

function quickFix() {
  if (state.cash < 150) {
    addLog("Floyd: Come back with money. I don't repair promises.", "bad");
    return;
  }
  state.cash -= 150;
  // quick patch boosts reliability but doesn't reduce wear much
  state.reliability = clamp(state.reliability + 10, 20, 95);
  state.wear = clamp(state.wear - 8, 0, 100);
  // hidden risk: heat impact later (simulated via wear gain already)
  addLog("Floyd: Quick patch done. It'll hold… until it doesn't.", "good");
  renderStats();
}

function properFix() {
  if (state.cash < 400) {
    addLog("Floyd: Proper work costs proper money.", "bad");
    return;
  }
  state.cash -= 400;
  state.wear = 0;
  state.reliability = clamp(state.reliability + 4, 20, 95);
  addLog("Floyd: Proper repair. Machine's honest again.", "good");
  renderStats();
}

function newRun() {
  state.day = 1;
  state.cash = 1000;
  state.carma = 20;
  state.heat = 0;
  state.fleet = 1;
  state.wear = 0;
  state.reliability = 70;
  state.log = [];
  addLog("Chip: New run initiated. Keep going.", "good");
  refreshJobs();
  renderStats();
}

function wire() {
  $("endDayBtn").addEventListener("click", endDay);
  $("quickFixBtn").addEventListener("click", quickFix);
  $("properFixBtn").addEventListener("click", properFix);
  $("newGameBtn").addEventListener("click", newRun);
}

wire();
newRun();
