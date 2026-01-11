import {
  calcTaxFromGross,
  formatCurrency,
  formatReceiptNumber,
  parsePrice,
} from "./admin-utils.js";

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
const serviceOptions = document.getElementById("service-options");
const priceInput = receiptForm.querySelector("input[name='price']");
const taxInput = receiptForm.querySelector("input[name='taxRate']");
const paymentSelect = receiptForm.querySelector("select[name='payment']");
const summaryTotal = document.getElementById("summary-total");
const summaryTax = document.getElementById("summary-tax");
const summaryPayment = document.getElementById("summary-payment");
const summaryDayTotal = document.getElementById("summary-day-total");
const summaryDayTax = document.getElementById("summary-day-tax");
const summaryDayCount = document.getElementById("summary-day-count");
const summaryMonthTotal = document.getElementById("summary-month-total");
const summaryMonthTax = document.getElementById("summary-month-tax");
const summaryMonthCount = document.getElementById("summary-month-count");
const recentList = document.getElementById("recent-list");
const signOutButton = document.getElementById("sign-out");
const dailyTableBody = document.getElementById("daily-table-body");
const exportCsvButton = document.getElementById("export-csv");
const exportPdfButton = document.getElementById("export-pdf");

let dailyRows = [];
let servicesCatalog = [];

const fallbackServices = [
  { name: "Manikuere inkl. Shellac", price: 30.0 },
  { name: "Pedikuere inkl. Massage", price: 31.0 },
  { name: "Pedikuere inkl. Shellac", price: 43.0 },
  { name: "Abloesen", price: 15.0 },
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

const getSelectedServices = () =>
  Array.from(serviceOptions.querySelectorAll("input:checked")).map((input) => ({
    id: input.dataset.id ? Number(input.dataset.id) : null,
    name: input.value,
    price: Number(input.dataset.price || 0),
  }));

const setSummary = () => {
  const selected = getSelectedServices();
  const grossTotal = selected.reduce((sum, item) => sum + item.price, 0);
  priceInput.value = grossTotal.toFixed(2);

  const grossCents = parsePrice(priceInput.value || 0);
  const rate = 19;
  const taxCents = calcTaxFromGross(grossCents, rate);

  summaryTotal.textContent = formatCurrency(grossCents / 100);
  summaryTax.textContent = formatCurrency(taxCents / 100);
  summaryPayment.textContent =
    paymentSelect.value === "karte" ? "Karte" : "Bar";
};

const toggleView = (loggedIn) => {
  loginView.classList.toggle("hidden", loggedIn);
  appView.classList.toggle("hidden", !loggedIn);
  document
    .querySelectorAll("[data-view='table']")
    .forEach((panel) => panel.classList.toggle("hidden", !loggedIn));
};

const loadServices = async () => {
  serviceOptions.innerHTML = "";
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

  servicesCatalog = services;

  servicesCatalog.forEach((service) => {
    const label = document.createElement("label");
    const input = document.createElement("input");
    const name = document.createElement("span");
    const price = document.createElement("span");

    input.type = "checkbox";
    input.name = "service";
    input.value = service.name;
    input.dataset.price = service.price;
    input.dataset.taxRate = 19;
    if (service.id) {
      input.dataset.id = service.id;
    }

    name.textContent = service.name;
    price.textContent = formatCurrency(service.price);

    label.appendChild(input);
    label.appendChild(name);
    label.appendChild(price);
    serviceOptions.appendChild(label);
  });

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
    const receiptNumber = formatReceiptNumber(row.created_at, row.id);
    const paymentLabel = row.payment_method === "karte" ? "Karte" : "Bar";
    item.innerHTML = `
      <span>${receiptNumber} ${row.service_name}</span>
      <strong>${formatCurrency(row.total_cents / 100)} (${paymentLabel})</strong>
    `;
    item.title = date;
    recentList.appendChild(item);
  });
};

const loadDailyData = async (dateValue) => {
  if (!dateValue) return;

  const start = new Date(`${dateValue}T00:00:00`);
  const end = new Date(`${dateValue}T23:59:59.999`);

  const { data, error } = await supabaseClient
    .from("receipts")
    .select(
      "id,created_at,service_name,total_cents,tax_cents,payment_method"
    )
    .gte("created_at", start.toISOString())
    .lte("created_at", end.toISOString());

  if (error || !data) {
    return;
  }

  dailyRows = data.sort(
    (a, b) => new Date(a.created_at) - new Date(b.created_at)
  );

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

  dailyTableBody.innerHTML = "";
  dailyRows.forEach((row) => {
      const item = document.createElement("tr");
      const time = new Date(row.created_at).toLocaleTimeString("de-DE", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const receiptNumber = formatReceiptNumber(row.created_at, row.id);
      const paymentLabel = row.payment_method === "karte" ? "Karte" : "Bar";
      item.innerHTML = `
        <td>${receiptNumber}</td>
        <td>${time}</td>
        <td>${row.service_name}</td>
        <td>${paymentLabel}</td>
        <td>${formatCurrency(row.total_cents / 100)}</td>
        <td>${formatCurrency((row.tax_cents || 0) / 100)}</td>
      `;
      dailyTableBody.appendChild(item);
    });
};

const loadMonthlySummary = async (dateValue) => {
  if (!dateValue) return;

  const base = new Date(`${dateValue}T00:00:00`);
  const monthStart = new Date(base.getFullYear(), base.getMonth(), 1);
  const monthEnd = new Date(base.getFullYear(), base.getMonth() + 1, 0);
  monthEnd.setHours(23, 59, 59, 999);

  const { data, error } = await supabaseClient
    .from("receipts")
    .select("total_cents,tax_cents")
    .gte("created_at", monthStart.toISOString())
    .lte("created_at", monthEnd.toISOString());

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

  summaryMonthTotal.textContent = formatCurrency(totals.total / 100);
  summaryMonthTax.textContent = formatCurrency(totals.tax / 100);
  summaryMonthCount.textContent = `${totals.count}`;
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
  await loadDailyData(dateInput.value);
  await loadMonthlySummary(dateInput.value);
});

receiptForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  receiptMessage.textContent = "";

  const selected = getSelectedServices();
  if (!selected.length) {
    receiptMessage.textContent = "Bitte mindestens eine Leistung waehlen.";
    return;
  }

  const formData = new FormData(receiptForm);
  const serviceNames = selected.map((item) => item.name).join(" + ");
  const serviceId = selected.length === 1 ? selected[0].id : null;
  const grossCents = parsePrice(formData.get("price"));
  const rate = 19;
  const taxCents = calcTaxFromGross(grossCents, rate);

  const payload = {
    created_at: new Date(formData.get("date")).toISOString(),
    service_id: serviceId,
    service_name: serviceNames || "Unbekannt",
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
  await loadDailyData(dateInput.value);
  await loadMonthlySummary(dateInput.value);
});

serviceOptions.addEventListener("change", () => {
  setSummary();
});

[paymentSelect].forEach((input) => {
  input.addEventListener("input", setSummary);
});

signOutButton.addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  toggleView(false);
});

dateInput.addEventListener("change", () => {
  const today = new Date().toISOString().slice(0, 10);
  dateInput.value = today;
  loadDailyData(dateInput.value);
  loadMonthlySummary(dateInput.value);
});

const init = async () => {
  toggleView(false);
  setDefaults();

  const { data } = await supabaseClient.auth.getSession();
  if (data.session) {
    toggleView(true);
    await loadServices();
    await loadRecent();
    await loadDailyData(dateInput.value);
    await loadMonthlySummary(dateInput.value);
  }
};

init();

const exportCsv = () => {
  if (!dailyRows.length) return;
  const header = [
    "Beleg",
    "Datum",
    "Uhrzeit",
    "Leistung",
    "Zahlart",
    "Brutto",
    "Steuer",
  ];
  const lines = dailyRows.map((row) => {
    const date = new Date(row.created_at);
    const dateText = date.toLocaleDateString("de-DE");
    const timeText = date.toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const receiptNumber = formatReceiptNumber(row.created_at, row.id);
    return [
      receiptNumber,
      dateText,
      timeText,
      row.service_name,
      row.payment_method === "karte" ? "Karte" : "Bar",
      (row.total_cents / 100).toFixed(2).replace(".", ","),
      ((row.tax_cents || 0) / 100).toFixed(2).replace(".", ","),
    ];
  });

  const csvContent = [header, ...lines]
    .map((line) => line.map((value) => `"${value}"`).join(";"))
    .join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `lia-spa-tagesliste-${dateInput.value}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const exportPdf = () => {
  if (!dailyRows.length) return;
  const dateLabel = dateInput.value;
  const rows = dailyRows
    .map((row) => {
      const date = new Date(row.created_at);
      const timeText = date.toLocaleTimeString("de-DE", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const receiptNumber = formatReceiptNumber(row.created_at, row.id);
      return `
        <tr>
          <td>${receiptNumber}</td>
          <td>${timeText}</td>
          <td>${row.service_name}</td>
          <td>${row.payment_method === "karte" ? "Karte" : "Bar"}</td>
          <td>${formatCurrency(row.total_cents / 100)}</td>
          <td>${formatCurrency((row.tax_cents || 0) / 100)}</td>
        </tr>
      `;
    })
    .join("");

  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  printWindow.document.write(`
    <html>
      <head>
        <title>Tagesliste ${dateLabel}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #222; }
          h1 { font-size: 20px; margin-bottom: 12px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border-bottom: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background: #f6f6f6; }
        </style>
      </head>
      <body>
        <h1>Lia Spa Tagesliste - ${dateLabel}</h1>
        <table>
          <thead>
            <tr>
              <th>Beleg</th>
              <th>Uhrzeit</th>
              <th>Leistung</th>
              <th>Zahlart</th>
              <th>Brutto</th>
              <th>Steuer</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
};

exportCsvButton.addEventListener("click", exportCsv);
exportPdfButton.addEventListener("click", exportPdf);
