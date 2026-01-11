export const formatCurrency = (value) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(value);

export const parsePrice = (value) => Math.round(Number(value) * 100);

export const calcTaxFromGross = (grossCents, rate) => {
  if (rate === 0) return 0;
  return Math.round((grossCents * rate) / (100 + rate));
};

export const formatReceiptNumber = (dateString, id) => {
  const year = dateString ? new Date(dateString).getFullYear() : new Date().getFullYear();
  return `${year}-${String(id).padStart(5, "0")}`;
};
