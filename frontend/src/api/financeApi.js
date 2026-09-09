const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";
const DEMO_SESSION_STORAGE_KEY = "finance-dashboard-demo-session-id";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let inMemorySessionId;

function createDemoSessionId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
    /[xy]/g,
    (character) => {
      const random = Math.floor(Math.random() * 16);
      const value = character === "x" ? random : (random & 0x3) | 0x8;
      return value.toString(16);
    },
  );
}

export function getDemoSessionId() {
  try {
    const storedSessionId = localStorage.getItem(DEMO_SESSION_STORAGE_KEY);
    if (storedSessionId && UUID_PATTERN.test(storedSessionId)) {
      return storedSessionId;
    }

    const sessionId = createDemoSessionId();
    localStorage.setItem(DEMO_SESSION_STORAGE_KEY, sessionId);
    return sessionId;
  } catch {
    inMemorySessionId ??= createDemoSessionId();
    return inMemorySessionId;
  }
}

async function request(path, options, errorMessage) {
  const headers = new Headers(options?.headers);
  headers.set("X-Demo-Session-ID", getDemoSessionId());
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

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
    booking_date: transaction.bookingDate,
    counterparty: transaction.counterparty,
    iban: transaction.iban || null,
    purpose: transaction.purpose || null,
    amount: transaction.amount,
    category: transaction.category || null,
    status: transaction.status || null,
  };
}

function toFrontendTransaction(transaction) {
  return {
    id: transaction.id,
    bookingDate: transaction.booking_date,
    counterparty: transaction.counterparty,
    iban: transaction.iban,
    purpose: transaction.purpose,
    amount: Number(transaction.amount),
    category: transaction.category,
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
    "/api/v1/transactions",
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
    `/api/v1/transactions/${id}`,
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
    `/api/v1/transactions/${id}`,
    { method: "DELETE" },
    "Transaktion konnte nicht gelöscht werden",
  );
}

export function importTransactionsCsv(file) {
  const formData = new FormData();
  formData.append("file", file);

  return request(
    "/api/v1/imports/csv",
    { method: "POST", body: formData },
    "CSV-Datei konnte nicht importiert werden",
  );
}
