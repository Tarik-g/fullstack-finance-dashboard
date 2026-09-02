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

export async function getTransactions() {
  const data = await request(
    "/transactions",
    undefined,
    "Transaktionen konnten nicht geladen werden",
  );

  return data.map((transaction) => ({
    id: transaction.id,
    bookingDate: transaction.datum,
    counterparty: transaction.empfaenger_sender,
    iban: transaction.iban,
    purpose: transaction.verwendungszweck,
    amount: Number(transaction.betrag_euro),
    category: transaction.kategorie,
    status: transaction.status,
  }));
}

export function getCategories() {
  return request(
    "/categories",
    undefined,
    "Kategorien konnten nicht geladen werden",
  );
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
