const currencyFormatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

const dateFormatter = new Intl.DateTimeFormat("de-DE");

const compactCurrencyFormatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  notation: "compact",
  maximumFractionDigits: 1,
});

export function formatCurrency(value) {
  return currencyFormatter.format(value);
}

export function formatDate(value) {
  return dateFormatter.format(new Date(`${value}T00:00:00`));
}

export function formatCompactCurrency(value) {
  return compactCurrencyFormatter.format(value);
}
