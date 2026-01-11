const SUPABASE_URL = "https://mapethfwgkdufhxftjxc.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_30NQrYBXJTL4Lu_sISmxaA_S5Kd8rMK";

const supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

const loginView = document.querySelector("[data-view='login']");
const appView = document.querySelector("[data-view='app']");
const loginForm = document.getElementById("login-form");
const loginMessage = document.getElementById("login-message");
const receiptForm = document.getElementById("receipt-form");
const receiptMessage = document.getElementById("receipt-message");
const dateInput = receiptForm.querySelector("input[name='date']");
const serviceSelect = receiptForm.querySelector("select[name='service']");
const priceInput = receiptForm.querySelector("input[name='price']");
const taxSelect = receiptForm.querySelector("select[name='taxRate']");
const paymentSelect = receiptForm.querySelector("select[name='payment']");
const summaryTotal = document.getElementById("summary-total");
const summaryTax = document.getElementById("summary-tax");
const summaryPayment = document.getElementById("summary-payment");
const summaryDayTotal = document.getElementById("summary-day-total");
const summaryDayTax = document.getElementById("summary-day-tax");
const summaryDayCount = document.getElementById("summary-day-count");
const recentList = document.getElementById("recent-list");
const signOutButton = document.getElementById("sign-out");

const fallbackServices = [
  { name: "Manikuere inkl. Shellac", price: 30.0 },
  { name: "Pedikuere inkl. Massage", price: 31.0 },
  { name: "Pedikuere inkl. Shellac", price: 43.0 },
  { name: "Ablosen", price: 15.0 },
  { name: "UV-Gel Natur (Neu)", price: 32.0 },
  { name: "UV-Gel Natur (Auffuellen)", price: 29.0 },
  { name: "UV-Gel French (Neu)", price: 38.0 },
  { name: "UV-Gel French (Auffuellen)", price: 35.0 },
  { name: "UV-Lack / Farb-Gel (Neu)", price: 39.0 },
  { name: "UV-Lack / Farb-Gel (Auffuellen)", price: 36.0 },
  { name: "Babyboomer (Neu)", price: 40.0 },
  { name: "Babyboomer (Auffuellen)", price: 37.0 },
  { name: "Extra Lang (Zuschlag)", price: 2.0 },
  { name: "Design pro Nagel", price: 2.0 },
  { name: "Design Set", price: 10.0 },
  { name: "Strass / Steindesign", price: 0.5 },
  { name: "Reparatur pro Nagel", price: 5.0 },
];

const formatCurrency = (value) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(value);

const parsePrice = (value) => Math.round(Number(value) * 100);

const calcTaxFromGross = (grossCents, rate) => {
  if (rate === 0) return 0;
  return Math.round((grossCents * rate) / (100 + rate));
};

const setSummary = () => {
  const grossCents = parsePrice(priceInput.value || 0);
  const rate = Number(taxSelect.value || 0);
  const taxCents = calcTaxFromGross(grossCents, rate);

  summaryTotal.textContent = formatCurrency(grossCents / 100);
  summaryTax.textContent = formatCurrency(taxCents / 100);
  summaryPayment.textContent =
    paymentSelect.value === "karte" ? "Karte" : "Bar";
};

const toggleView = (loggedIn) => {
  loginView.classList.toggle("hidden", loggedIn);
  appView.classList.toggle("hidden", !loggedIn);
};

const loadServices = async () => {
  serviceSelect.innerHTML = "";
  let services = fallbackServices;

  const { data, error } = await supabaseClient
    .from("services")
    .select("id,name,price_cents,tax_rate")
    .eq("active", true)
    .order("sort_order", { ascending: true });

  if (!error && data && data.length) {
    services = data.map((item) => ({
      id: item.id,
      name: item.name,
      price: item.price_cents / 100,
      taxRate: Number(item.tax_rate),
    }));
  }

  services.forEach((service) => {
    const option = document.createElement("option");
    option.value = service.name;
    option.textContent = `${service.name} (${formatCurrency(service.price)})`;
    option.dataset.price = service.price;
    option.dataset.taxRate = service.taxRate ?? 19;
    if (service.id) {
      option.dataset.id = service.id;
    }
    serviceSelect.appendChild(option);
  });

  if (serviceSelect.options.length) {
    const first = serviceSelect.options[0];
    priceInput.value = first.dataset.price;
    taxSelect.value = first.dataset.taxRate || "19";
  }

  setSummary();
};

const loadRecent = async () => {
  recentList.innerHTML = "";
  const { data, error } = await supabaseClient
    .from("receipts")
    .select("id,created_at,service_name,total_cents,payment_method")
    .order("created_at", { ascending: false })
    .limit(8);

  if (error || !data) {
    return;
  }

  data.forEach((row) => {
    const item = document.createElement("li");
    const date = new Date(row.created_at).toLocaleDateString("de-DE");
    item.innerHTML = `
      <span>#${row.id} ${row.service_name}</span>
      <strong>${formatCurrency(row.total_cents / 100)} (${row.payment_method})</strong>
    `;
    item.title = date;
    recentList.appendChild(item);
  });
};

const loadDailySummary = async (dateValue) => {
  if (!dateValue) return;

  const start = new Date(`${dateValue}T00:00:00`);
  const end = new Date(`${dateValue}T23:59:59.999`);

  const { data, error } = await supabaseClient
    .from("receipts")
    .select("total_cents,tax_cents")
    .gte("created_at", start.toISOString())
    .lte("created_at", end.toISOString());

  if (error || !data) {
    return;
  }

  const totals = data.reduce(
    (acc, row) => {
      acc.total += row.total_cents || 0;
      acc.tax += row.tax_cents || 0;
      acc.count += 1;
      return acc;
    },
    { total: 0, tax: 0, count: 0 }
  );

  summaryDayTotal.textContent = formatCurrency(totals.total / 100);
  summaryDayTax.textContent = formatCurrency(totals.tax / 100);
  summaryDayCount.textContent = `${totals.count}`;
};

const setDefaults = () => {
  const today = new Date().toISOString().slice(0, 10);
  dateInput.value = today;
  setSummary();
};

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginMessage.textContent = "";

  const formData = new FormData(loginForm);
  const email = formData.get("email");
  const password = formData.get("password");

  const { error } = await supabaseClient.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    loginMessage.textContent = "Login fehlgeschlagen.";
    return;
  }

  toggleView(true);
  await loadServices();
  await loadRecent();
  await loadDailySummary(dateInput.value);
});

receiptForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  receiptMessage.textContent = "";

  const formData = new FormData(receiptForm);
  const serviceOption = serviceSelect.options[serviceSelect.selectedIndex];
  const grossCents = parsePrice(formData.get("price"));
  const rate = Number(formData.get("taxRate"));
  const taxCents = calcTaxFromGross(grossCents, rate);

  const payload = {
    created_at: new Date(formData.get("date")).toISOString(),
    service_id: serviceOption.dataset.id
      ? Number(serviceOption.dataset.id)
      : null,
    service_name: serviceOption.value,
    price_cents: grossCents,
    tax_rate: rate,
    tax_cents: taxCents,
    total_cents: grossCents,
    payment_method: formData.get("payment"),
    customer_name: formData.get("customer") || null,
    note: formData.get("note") || null,
  };

  const { error } = await supabaseClient.from("receipts").insert(payload);

  if (error) {
    receiptMessage.textContent = "Speichern fehlgeschlagen.";
    return;
  }

  receiptMessage.textContent = "Gespeichert.";
  receiptForm.reset();
  setDefaults();
  await loadRecent();
  await loadDailySummary(dateInput.value);
});

serviceSelect.addEventListener("change", () => {
  const option = serviceSelect.options[serviceSelect.selectedIndex];
  priceInput.value = option.dataset.price || "";
  taxSelect.value = option.dataset.taxRate || "19";
  setSummary();
});

[priceInput, taxSelect, paymentSelect].forEach((input) => {
  input.addEventListener("input", setSummary);
});

signOutButton.addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  toggleView(false);
});

dateInput.addEventListener("change", () => {
  loadDailySummary(dateInput.value);
});

const init = async () => {
  toggleView(false);
  setDefaults();

  const { data } = await supabaseClient.auth.getSession();
  if (data.session) {
    toggleView(true);
    await loadServices();
    await loadRecent();
    await loadDailySummary(dateInput.value);
  }
};

init();
