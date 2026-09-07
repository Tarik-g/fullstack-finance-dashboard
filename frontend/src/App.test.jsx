import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import {
  createApiMock,
  deferred,
  expense,
  income,
  jsonResponse,
  page,
  summary,
} from "./test/apiMock";

// Test the real App, fetch service and data hook; chart layout belongs in browser tests.
vi.mock("./components/AnalyticsDashboard", () => ({
  default: ({ timeline, categories, isLoading, periodMode }) => (
    <section data-testid="analytics" aria-busy={isLoading}>
      {JSON.stringify({ timeline, categories, periodMode })}
    </section>
  ),
}));

const transactionsPath = "/api/v1/transactions";
const timelinePath = "/api/v1/analytics/timeline";
const categoriesPath = "/api/v1/analytics/categories";
const summaryPath = "/api/v1/analytics/summary";
let api;
let user;

beforeEach(() => {
  api = createApiMock();
  user = userEvent.setup();
});

async function openDashboard() {
  render(<App />);
  await screen.findByText(expense.counterparty);
  await waitFor(() =>
    expect(screen.getByTestId("analytics")).toHaveAttribute(
      "aria-busy",
      "false",
    ),
  );
}

async function fillExpense(name = "Demo Einkauf", amount = "12,50") {
  await user.click(screen.getByRole("button", { name: "Ausgabe hinzufügen" }));
  const dialog = screen.getByRole("dialog");
  await user.type(within(dialog).getByLabelText("Empfänger / Sender"), name);
  await user.type(within(dialog).getByLabelText(/^Betrag/), amount);
  await user.selectOptions(
    within(dialog).getByLabelText("Kategorie"),
    "Lebensmittel",
  );
  return dialog;
}

describe("dashboard loading and filters", () => {
  it("shows a loading state until the initial metadata arrives", async () => {
    const pending = deferred();
    api.respondWith(summaryPath, () => pending.promise);
    render(<App />);
    expect(
      screen.getByText("Transaktionen werden geladen …"),
    ).toBeInTheDocument();
    await act(async () => pending.resolve(jsonResponse(summary)));
    expect(await screen.findByText(expense.counterparty)).toBeInTheDocument();
    expect(screen.getByText("2.954,18 €")).toBeInTheDocument();
  });

  it("renders API fields and requests a page of ten instead of the legacy full list", async () => {
    await openDashboard();
    expect(screen.getByText("Wocheneinkauf")).toBeInTheDocument();
    expect(screen.getByText("-45,82 €")).toBeInTheDocument();
    const query = api.callsFor(transactionsPath)[0].url.searchParams;
    expect(query.get("page_size")).toBe("10");
    expect(query.get("sort_by")).toBe("booking_date");
    expect(api.callsFor("/api/v1/transactions")).toHaveLength(1);
  });

  it("debounces search and applies it to the table and both analytics requests", async () => {
    await openDashboard();
    api.respondWith(transactionsPath, () => jsonResponse(page([expense])));
    await user.type(screen.getByRole("searchbox"), "REWE");
    expect(screen.getByText("Ergebnisse werden geladen …")).toBeInTheDocument();
    expect(api.callsFor(transactionsPath)).toHaveLength(1);
    await waitFor(() => expect(api.callsFor(transactionsPath)).toHaveLength(2));
    for (const path of [transactionsPath, timelinePath, categoriesPath]) {
      expect(api.callsFor(path).at(-1).url.searchParams.get("search")).toBe(
        "REWE",
      );
    }
    expect(await screen.findByText(expense.counterparty)).toBeInTheDocument();
    expect(api.callsFor(summaryPath)).toHaveLength(1);
    expect(screen.getByText("2.954,18 €")).toBeInTheDocument();
  });

  it("keeps pagination and sorting independent of chart and summary requests", async () => {
    api.respondWith(summaryPath, () =>
      jsonResponse({ ...summary, transaction_count: 11 }),
    );
    api.respondWith(transactionsPath, (url) =>
      jsonResponse(
        page(url.searchParams.get("page") === "2" ? [income] : [expense], {
          page: Number(url.searchParams.get("page")),
          total: 11,
          total_pages: 2,
        }),
      ),
    );
    await openDashboard();
    await user.click(
      screen.getByRole("button", { name: "Weiter", exact: true }),
    );
    await screen.findByText("Seite 2 von 2");
    // The initial empty-search timer must not send the user back to page one.
    await act(async () => new Promise((resolve) => setTimeout(resolve, 300)));
    expect(screen.getByText("Seite 2 von 2")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Weiter", exact: true }),
    ).toBeDisabled();
    await user.click(
      screen.getByRole("button", { name: "Betrag", exact: true }),
    );
    await screen.findByText("Seite 1 von 2");
    expect(
      api.callsFor(transactionsPath).at(-1).url.searchParams.get("sort_by"),
    ).toBe("amount");
    expect(api.callsFor(timelinePath)).toHaveLength(1);
    expect(api.callsFor(categoriesPath)).toHaveLength(1);
    expect(api.callsFor(summaryPath)).toHaveLength(1);
  });

  it("sends identical period, category and type filters and resets them", async () => {
    await openDashboard();
    await user.click(
      screen.getByRole("button", { name: "Monat", exact: true }),
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Jahr" }),
      "2025",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Monat" }),
      "12",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Kategorie" }),
      "Lebensmittel",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Typ" }),
      "expense",
    );
    await waitFor(() => {
      for (const path of [transactionsPath, timelinePath, categoriesPath]) {
        const params = api.callsFor(path).at(-1).url.searchParams;
        expect(params.get("year")).toBe("2025");
        expect(params.get("month")).toBe("12");
        expect(params.get("category")).toBe("Lebensmittel");
        expect(params.get("transaction_type")).toBe("expense");
      }
    });
    expect(
      api.callsFor(timelinePath).at(-1).url.searchParams.get("granularity"),
    ).toBe("day");
    await user.click(
      screen.getByRole("button", { name: "Filter zurücksetzen" }),
    );
    await waitFor(() =>
      expect(
        api.callsFor(transactionsPath).at(-1).url.searchParams.has("year"),
      ).toBe(false),
    );
    expect(screen.getByRole("combobox", { name: "Kategorie" })).toHaveValue(
      "all",
    );
    expect(screen.getByText("2.954,18 €")).toBeInTheDocument();
  });

  it("renders an empty result without showing pagination", async () => {
    api.respondWith(transactionsPath, () => jsonResponse(page([])));
    render(<App />);
    expect(
      await screen.findByText("Keine passenden Transaktionen gefunden."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Seitennavigation" }),
    ).not.toBeInTheDocument();
  });

  it("shows an API error and retries successfully", async () => {
    api.respondWith(transactionsPath, () => jsonResponse({}, 503));
    render(<App />);
    expect(await screen.findByRole("alert")).toHaveTextContent("HTTP 503");
    expect(screen.queryByText(expense.counterparty)).not.toBeInTheDocument();
    api.respondWith(transactionsPath, () => jsonResponse(page()));
    await user.click(screen.getByRole("button", { name: "Erneut laden" }));
    expect(await screen.findByText(expense.counterparty)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("transaction forms and mutations", () => {
  it("imports a CSV file, shows the report and refreshes dashboard data", async () => {
    api.respondWith(
      "/api/v1/imports/csv",
      () =>
        jsonResponse({
          total_rows: 3,
          inserted: 1,
          skipped: 1,
          failed: 1,
          errors: ["Row 4: amount is invalid"],
        }),
      "POST",
    );
    await openDashboard();
    await user.click(screen.getByRole("button", { name: "CSV importieren" }));
    const dialog = screen.getByRole("dialog", { name: "CSV importieren" });
    const file = new File(
      ["booking_date,counterparty,amount\n2026-09-02,Demo,-12.50"],
      "transactions.csv",
      { type: "text/csv" },
    );
    await user.upload(within(dialog).getByLabelText("CSV-Datei"), file);
    await user.click(
      within(dialog).getByRole("button", { name: "Datei importieren" }),
    );

    expect(
      await within(dialog).findByText("Import abgeschlossen"),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("Duplikate")).toBeInTheDocument();
    expect(api.callsFor("/api/v1/imports/csv", "POST")).toHaveLength(1);
    expect(
      api.callsFor("/api/v1/imports/csv", "POST")[0].options.body,
    ).toBeInstanceOf(FormData);
    await waitFor(() => expect(api.callsFor(summaryPath)).toHaveLength(2));
  });

  it("rejects a whitespace-only name without sending a POST", async () => {
    await openDashboard();
    const dialog = await fillExpense("   ");
    await user.click(
      within(dialog).getByRole("button", { name: "Ausgabe speichern" }),
    );
    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "Bitte gib einen Namen ein.",
    );
    expect(api.callsFor("/api/v1/transactions", "POST")).toHaveLength(0);
  });

  it("rejects a non-numeric amount without sending a POST", async () => {
    await openDashboard();
    const dialog = await fillExpense("Demo Einkauf", "abc");
    await user.click(
      within(dialog).getByRole("button", { name: "Ausgabe speichern" }),
    );
    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "gültigen Betrag",
    );
    expect(api.callsFor("/api/v1/transactions", "POST")).toHaveLength(0);
  });

  it("saves an expense with a decimal comma and refreshes table, cards and charts", async () => {
    const created = {
      ...expense,
      id: 3,
      counterparty: "Demo Einkauf",
      amount: "-12.50",
    };
    api.respondWith(
      "/api/v1/transactions",
      () => {
        api.respondWith(transactionsPath, () =>
          jsonResponse(page([created, expense, income])),
        );
        api.respondWith(summaryPath, () =>
          jsonResponse({
            ...summary,
            expenses: "58.32",
            balance: "2941.68",
            transaction_count: 3,
          }),
        );
        api.respondWith(categoriesPath, () =>
          jsonResponse([{ category: "Lebensmittel", amount: "58.32" }]),
        );
        return jsonResponse({ detail: { message: "Created" } }, 201);
      },
      "POST",
    );
    await openDashboard();
    const dialog = await fillExpense();
    await user.click(
      within(dialog).getByRole("button", { name: "Ausgabe speichern" }),
    );
    expect(await screen.findByText("Demo Einkauf")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const payload = JSON.parse(
      api.callsFor("/api/v1/transactions", "POST")[0].options.body,
    );
    expect(payload).toMatchObject({
      counterparty: "Demo Einkauf",
      amount: -12.5,
      category: "Lebensmittel",
    });
    await waitFor(() =>
      expect(screen.getByText("2.941,68 €")).toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(screen.getByTestId("analytics")).toHaveTextContent(
        '"amount":58.32',
      ),
    );
    expect(api.callsFor(timelinePath)).toHaveLength(2);
  });

  it("keeps form input and shows the error if saving fails", async () => {
    api.respondWith(
      "/api/v1/transactions",
      () => jsonResponse({}, 500),
      "POST",
    );
    await openDashboard();
    const dialog = await fillExpense();
    await user.click(
      within(dialog).getByRole("button", { name: "Ausgabe speichern" }),
    );
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "HTTP 500",
    );
    expect(within(dialog).getByLabelText("Empfänger / Sender")).toHaveValue(
      "Demo Einkauf",
    );
    expect(
      within(dialog).getByRole("button", { name: "Ausgabe speichern" }),
    ).toBeEnabled();
    expect(api.callsFor(summaryPath)).toHaveLength(1);
  });

  it("opens an existing transaction in the modal and PATCHes its ID", async () => {
    const updated = { ...expense, counterparty: "Neuer Testname" };
    api.respondWith(
      "/api/v1/transactions/1",
      () => {
        api.respondWith(transactionsPath, () =>
          jsonResponse(page([updated, income])),
        );
        return jsonResponse(updated);
      },
      "PATCH",
    );
    await openDashboard();
    await user.click(
      screen.getByRole("button", { name: "REWE Testmarkt bearbeiten" }),
    );
    const dialog = screen.getByRole("dialog", {
      name: "Buchung aktualisieren",
    });
    const name = within(dialog).getByLabelText("Empfänger / Sender");
    expect(name).toHaveValue("REWE Testmarkt");
    expect(within(dialog).getByLabelText(/^Betrag/)).toHaveValue("-45,82");
    await user.clear(name);
    await user.type(name, "Neuer Testname");
    await user.click(
      within(dialog).getByRole("button", { name: "Änderungen speichern" }),
    );
    expect(await screen.findByText("Neuer Testname")).toBeInTheDocument();
    expect(
      JSON.parse(
        api.callsFor("/api/v1/transactions/1", "PATCH")[0].options.body,
      ).amount,
    ).toBe(-45.82);
    expect(api.callsFor("/api/v1/transactions", "POST")).toHaveLength(0);
    expect(api.callsFor(summaryPath)).toHaveLength(2);
  });

  it("reloads the server page and analytics after deleting", async () => {
    api.respondWith(
      "/api/v1/transactions/1",
      () => {
        api.respondWith(transactionsPath, () => jsonResponse(page([income])));
        api.respondWith(summaryPath, () =>
          jsonResponse({
            ...summary,
            expenses: "0.00",
            balance: "3000.00",
            transaction_count: 1,
          }),
        );
        api.respondWith(categoriesPath, () => jsonResponse([]));
        return jsonResponse({ detail: { message: "Deleted" } });
      },
      "DELETE",
    );
    await openDashboard();
    await user.click(
      screen.getByRole("button", { name: "REWE Testmarkt löschen" }),
    );
    await waitFor(() => expect(api.callsFor(transactionsPath)).toHaveLength(2));
    await waitFor(() =>
      expect(screen.queryByText("REWE Testmarkt")).not.toBeInTheDocument(),
    );
    expect(await screen.findByText(income.counterparty)).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByTestId("analytics")).toHaveTextContent(
        '"categories":[]',
      ),
    );
    expect(api.callsFor("/api/v1/transactions/1", "DELETE")).toHaveLength(1);
  });

  it("closes the modal on cancel without writing and restores scroll position", async () => {
    await openDashboard();
    await user.click(
      screen.getByRole("button", { name: "Einnahme hinzufügen" }),
    );
    const dialog = screen.getByRole("dialog");
    expect(document.body.style.position).toBe("fixed");
    within(dialog).getByLabelText("Empfänger / Sender").focus();
    fireEvent(dialog, new Event("cancel", { bubbles: true, cancelable: true }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.body.style.position).toBe("");
    expect(
      screen.getByRole("button", { name: "Einnahme hinzufügen" }),
    ).toHaveFocus();
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
    expect(api.callsFor("/api/v1/transactions", "POST")).toHaveLength(0);
  });
});
