const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

async function request(path, options, errorMessage) {
  const response = await fetch(`${API_BASE_URL}${path}`, options);

  if (!response.ok) {
    throw new Error(`${errorMessage} (HTTP ${response.status})`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function toApiTransaction(transaction) {
  return {
    datum: transaction.bookingDate,
    empfaenger_sender: transaction.counterparty,
    iban: transaction.iban || null,
    verwendungszweck: transaction.purpose || null,
    betrag_euro: transaction.amount,
    kategorie: transaction.category || null,
    status: transaction.status || null,
  };
}

function toFrontendTransaction(transaction) {
  return {
    id: transaction.id,
    bookingDate: transaction.datum,
    counterparty: transaction.empfaenger_sender,
    iban: transaction.iban,
    purpose: transaction.verwendungszweck,
    amount: Number(transaction.betrag_euro),
    category: transaction.kategorie,
    status: transaction.status,
  };
}

function buildQuery(parameters = {}) {
  const query = new URLSearchParams();

  Object.entries(parameters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, value);
    }
  });

  return query.toString();
}

export async function getTransactions(parameters, options) {
  const data = await request(
    `/api/v1/transactions?${buildQuery(parameters)}`,
    options,
    "Transaktionen konnten nicht geladen werden",
  );

  return {
    items: data.items.map(toFrontendTransaction),
    total: data.total,
    page: data.page,
    pageSize: data.page_size,
    totalPages: data.total_pages,
  };
}

export function getCategories(options) {
  return request(
    "/api/v1/categories",
    options,
    "Kategorien konnten nicht geladen werden",
  );
}

export async function getAvailableYears(options) {
  const years = await request(
    "/api/v1/years",
    options,
    "Verfügbare Jahre konnten nicht geladen werden",
  );

  return years.map(String);
}

export async function getFinancialSummary(options) {
  const data = await request(
    "/api/v1/analytics/summary",
    options,
    "Kennzahlen konnten nicht geladen werden",
  );

  return {
    transactionCount: data.transaction_count,
    income: Number(data.income),
    expenses: Number(data.expenses),
    balance: Number(data.balance),
  };
}

export async function getTimeline(parameters, options) {
  const data = await request(
    `/api/v1/analytics/timeline?${buildQuery(parameters)}`,
    options,
    "Zeitverlauf konnte nicht geladen werden",
  );

  return data.map((point) => ({
    period: point.period,
    income: Number(point.income),
    expenses: Number(point.expenses),
  }));
}

export async function getCategoryTotals(parameters, options) {
  const data = await request(
    `/api/v1/analytics/categories?${buildQuery(parameters)}`,
    options,
    "Kategorieauswertung konnte nicht geladen werden",
  );

  return data.map((category) => ({
    name: category.category,
    amount: Number(category.amount),
  }));
}

export function createTransaction(transaction) {
  return request(
    "/transactions",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toApiTransaction(transaction)),
    },
    "Transaktion konnte nicht angelegt werden",
  );
}

export function updateTransaction(id, transaction) {
  return request(
    `/transactions/${id}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toApiTransaction(transaction)),
    },
    "Transaktion konnte nicht aktualisiert werden",
  );
}

export function deleteTransaction(id) {
  return request(
    `/transactions/${id}`,
    { method: "DELETE" },
    "Transaktion konnte nicht gelöscht werden",
  );
}
