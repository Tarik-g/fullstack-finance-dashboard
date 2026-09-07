import { vi } from "vitest";

export const expense = {
  id: 1,
  booking_date: "2026-09-02",
  counterparty: "REWE Testmarkt",
  iban: null,
  purpose: "Wocheneinkauf",
  amount: "-45.82",
  category: "Lebensmittel",
  status: "Gebucht",
};

export const income = {
  ...expense,
  id: 2,
  booking_date: "2026-09-01",
  counterparty: "Demo Arbeitgeber",
  purpose: "Gehalt",
  amount: "3000.00",
  category: "Gehalt",
};

export const summary = {
  transaction_count: 2,
  income: "3000.00",
  expenses: "45.82",
  balance: "2954.18",
};

export function page(items = [expense, income], overrides = {}) {
  return {
    items,
    total: items.length,
    page: 1,
    page_size: 10,
    total_pages: 1,
    ...overrides,
  };
}

export function jsonResponse(body, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

export function createApiMock() {
  const handlers = new Map();
  const requests = [];
  function respondWith(path, handler, method = "GET") {
    handlers.set(`${method} ${path}`, handler);
  }
  respondWith("/api/v1/transactions", () => jsonResponse(page()));
  respondWith("/api/v1/analytics/summary", () => jsonResponse(summary));
  respondWith("/api/v1/categories", () =>
    jsonResponse(["Gehalt", "Lebensmittel"]),
  );
  respondWith("/api/v1/years", () => jsonResponse([2026, 2025]));
  respondWith("/api/v1/analytics/timeline", () =>
    jsonResponse([
      { period: "2026-09-01", income: "3000.00", expenses: "45.82" },
    ]),
  );
  respondWith("/api/v1/analytics/categories", () =>
    jsonResponse([{ category: "Lebensmittel", amount: "45.82" }]),
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input, options = {}) => {
      const url = new URL(input, "http://localhost");
      const method = options.method ?? "GET";
      requests.push({ url, method, options });
      const handler = handlers.get(`${method} ${url.pathname}`);
      if (!handler)
        throw new Error(`Unexpected request: ${method} ${url.pathname}`);
      // Deliberately allow late responses: the real hook must ignore aborted ones.
      return handler(url, options);
    }),
  );
  function callsFor(path, method = "GET") {
    return requests.filter(
      (request) => request.url.pathname === path && request.method === method,
    );
  }
  return { respondWith, callsFor };
}
