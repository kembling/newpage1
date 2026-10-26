// Jobs shown on the repair tag and at the top of the price table.
const JOBS = [
  { id: "flat", name: "Flat tyre", price: 12, mins: 20 },
  { id: "brakes", name: "Brakes weak or squealing", price: 18, mins: 30 },
  { id: "gears", name: "Gears skipping", price: 22, mins: 40 },
  { id: "chain", name: "Chain noisy or rusty", price: 15, mins: 25 },
  { id: "wheel", name: "Wheel wobbles", price: 20, mins: 40 },
  { id: "service", name: "Full service", price: 75, mins: 240 },
];

// Price-table wording for the same jobs.
const JOB_LABELS = {
  flat: ["Puncture repair", "tube extra if it can't be patched"],
  brakes: ["Brake adjustment", "front and back"],
  gears: ["Gear tune", "cables extra if frayed"],
  chain: ["Chain clean and lube", ""],
  wheel: ["Wheel truing", "per wheel"],
  service: ["Full service", "brakes, gears, wheels, bearings and a clean"],
};

// Opening hours by weekday (0 = Sunday). null = closed.
const HOURS = { 0: null, 1: null, 2: [8, 18], 3: [8, 18], 4: [8, 18], 5: [8, 18], 6: [9, 16] };
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const LAST_SAME_DAY_DROP = 14;

const $ = (sel) => document.querySelector(sel);

function fmtHour(h) {
  const suffix = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return h12 + suffix;
}

function fmtDate(d) {
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  x.setHours(0, 0, 0, 0);
  return x;
}

function isSameDay(a, b) {
  return a.toDateString() === b.toDateString();
}

function nextOpenDay(from) {
  let d = addDays(from, 1);
  while (!HOURS[d.getDay()]) d = addDays(d, 1);
  return d;
}

// The first day a bike dropped off now would be worked on.
function dropOffDay(now) {
  const today = HOURS[now.getDay()];
  const hour = now.getHours() + now.getMinutes() / 60;
  if (today && hour < LAST_SAME_DAY_DROP) return addDays(now, 0);
  return nextOpenDay(now);
}

function relativeDay(d, now) {
  if (isSameDay(d, now)) return "Today";
  if (isSameDay(d, addDays(now, 1))) return "Tomorrow";
  return fmtDate(d);
}

function readyText(mins, now) {
  let day = dropOffDay(now);
  if (mins > 120) day = nextOpenDay(day);
  if (mins >= 240) day = nextOpenDay(day);
  const close = HOURS[day.getDay()][1];
  return relativeDay(day, now) + ", by " + fmtHour(close - 1);
}

/* Open/closed status in the header */

function renderStatus(now) {
  const el = $("#status");
  const today = HOURS[now.getDay()];
  const hour = now.getHours() + now.getMinutes() / 60;
  if (today && hour >= today[0] && hour < today[1]) {
    el.textContent = "Open now, until " + fmtHour(today[1]);
    el.classList.add("is-open");
    return;
  }
  let d = today && hour < today[0] ? addDays(now, 0) : nextOpenDay(now);
  const label = isSameDay(d, now) ? "today" : isSameDay(d, addDays(now, 1)) ? "tomorrow" : DAY_NAMES[d.getDay()];
  el.textContent = "Closed. Opens " + label + " at " + fmtHour(HOURS[d.getDay()][0]);
}

/* Repair tag */

function renderTag() {
  $("#tagRows").innerHTML = JOBS.map((j) => `
    <label class="job">
      <input type="checkbox" name="job" value="${j.id}">
      <span>${j.name}</span>
      <span class="job-price">$${j.price}</span>
    </label>`).join("");
}

function selectedJobs() {
  const ids = [...document.querySelectorAll('#tagRows input:checked')].map((i) => i.value);
  // A full service covers the smaller adjustments, so don't charge twice.
  if (ids.includes("service")) return JOBS.filter((j) => j.id === "service" || j.id === "flat" && ids.includes("flat"));
  return JOBS.filter((j) => ids.includes(j.id));
}

function updateTag() {
  const jobs = selectedJobs();
  const book = $("#tagBook");
  if (!jobs.length) {
    $("#total").textContent = "—";
    $("#ready").textContent = "—";
    book.setAttribute("aria-disabled", "true");
    return;
  }
  const price = jobs.reduce((s, j) => s + j.price, 0);
  const mins = jobs.reduce((s, j) => s + j.mins, 0);
  $("#total").textContent = "$" + price;
  $("#ready").textContent = readyText(mins, new Date());
  book.removeAttribute("aria-disabled");
}

function nudgeTag() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const hang = $("#tagHang");
  hang.classList.remove("nudge");
  void hang.offsetWidth;
  hang.classList.add("nudge");
}

/* Price table and hours */

function renderPrices() {
  $("#priceRows").innerHTML = JOBS.map((j) => {
    const [label, note] = JOB_LABELS[j.id];
    const time = j.mins >= 60 ? (j.mins / 60) + " hr" + (j.mins > 60 ? "s" : "") : j.mins + " min";
    return `<tr><th scope="row">${label}${note ? `<small>${note}</small>` : ""}</th><td>${time}</td><td class="num">$${j.price}</td></tr>`;
  }).join("");
}

function renderHours(now) {
  const order = [1, 2, 3, 4, 5, 6, 0];
  $("#hoursRows").innerHTML = order.map((d) => {
    const h = HOURS[d];
    const cls = d === now.getDay() ? ' class="is-today"' : "";
    const time = h ? `${fmtHour(h[0])} to ${fmtHour(h[1])}` : '<span class="closed">Closed</span>';
    return `<tr${cls}><th scope="row">${DAY_NAMES[d]}</th><td>${time}</td></tr>`;
  }).join("");
}

/* Booking form */

function renderDays(now) {
  const select = $("#day");
  let d = dropOffDay(now);
  const opts = [];
  for (let i = 0; i < 8; i++) {
    opts.push(`<option value="${d.toISOString()}">${relativeDay(d, now) === fmtDate(d) ? fmtDate(d) : relativeDay(d, now) + " (" + fmtDate(d) + ")"}</option>`);
    d = nextOpenDay(d);
  }
  select.innerHTML = opts.join("");
}

const FIELD_NAMES = { name: "your name", phone: "a mobile number", work: "what needs doing", day: "a drop-off day" };

function setupBooking() {
  const form = $("#bookForm");
  const error = $("#formError");

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const missing = [];
    form.querySelectorAll("[required]").forEach((field) => {
      const empty = !field.value.trim();
      field.setAttribute("aria-invalid", empty ? "true" : "false");
      if (empty) missing.push(FIELD_NAMES[field.name]);
    });
    if (missing.length) {
      error.textContent = "Add " + missing.join(" and ") + " so we can book you in.";
      form.querySelector('[aria-invalid="true"]').focus();
      return;
    }
    error.textContent = "";

    // Not connected to a server yet: hook this up to email or a booking service.
    const data = new FormData(form);
    const day = $("#day").selectedOptions[0].textContent;
    $("#bookedText").textContent =
      `Drop-off ${day}. We'll text ${data.get("phone").trim()} to confirm, usually within the hour while we're open.`;
    form.hidden = true;
    const booked = $("#booked");
    booked.hidden = false;
    booked.focus();
  });
}

/* Start */

const now = new Date();
renderStatus(now);
renderTag();
renderPrices();
renderHours(now);
renderDays(now);
setupBooking();
updateTag();

$("#tagRows").addEventListener("change", () => {
  updateTag();
  nudgeTag();
});

$("#tagBook").addEventListener("click", () => {
  const jobs = selectedJobs();
  if (jobs.length) $("#work").value = jobs.map((j) => j.name).join(", ");
});
