import { test, expect } from "@playwright/test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execute = promisify(execFile);
const databaseScript = fileURLToPath(
  new URL("../../tests/e2e/database.py", import.meta.url),
);
const sessionStorageKey = "finance-dashboard-demo-session-id";
const money = (value) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(
    value,
  );

async function database(command, sessionId) {
  const { stdout } = await execute(process.env.E2E_PYTHON, [
    databaseScript,
    command,
    ...(sessionId ? [sessionId] : []),
  ]);
  return command === "snapshot" ? JSON.parse(stdout) : undefined;
}

function getSessionId(page) {
  return page.evaluate((key) => localStorage.getItem(key), sessionStorageKey);
}

async function expectTotals(page, { balance, expenses, food, rent }) {
  const summary = page.getByRole("region", {
    name: "Finanzübersicht",
    exact: true,
  });
  await expect(
    summary
      .getByRole("article")
      .filter({ hasText: "Kontostand" })
      .locator("strong"),
  ).toHaveText(money(balance));
  await expect(
    summary
      .getByRole("article")
      .filter({ hasText: "Einnahmen" })
      .locator("strong"),
  ).toHaveText(money(3000));
  await expect(
    summary
      .getByRole("article")
      .filter({ hasText: "Ausgaben" })
      .locator("strong"),
  ).toHaveText(money(expenses));

  const analytics = page.getByRole("region", { name: "Finanzanalysen" });
  await expect(analytics).toHaveAttribute("aria-busy", "false");
  await expect(analytics.locator(".donut-total strong")).toHaveText(
    money(expenses),
  );
  await expect(
    analytics.getByRole("listitem").filter({ hasText: "Lebensmittel" }),
  ).toContainText(money(food));
  await expect(
    analytics.getByRole("listitem").filter({ hasText: "Wohnen" }),
  ).toContainText(money(rent));
  await expect(analytics.locator(".donut-wrap svg")).toBeVisible();

  // Real Recharts SVG + tooltip: no mocked chart or analytics response.
  const barChart = page.getByLabel("Einnahmen und Ausgaben pro Monat", {
    exact: true,
  });
  await expect(barChart.locator("svg")).toBeVisible();
  await barChart.locator(".recharts-bar-rectangle").last().hover();
  await expect(barChart.locator(".recharts-tooltip-wrapper")).toBeVisible();
  await expect(barChart.locator(".recharts-tooltip-wrapper")).toContainText(
    money(expenses),
  );
}

async function saveAndCheck(page, button, method, status) {
  const response = page.waitForResponse(
    (response) =>
      response.url().startsWith("http://127.0.0.1:8001/api/v1/transactions") &&
      response.request().method() === method,
  );
  await button.click();
  expect((await response).status()).toBe(status);
}

async function expectNoHorizontalOverflow(page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
}

test.beforeEach(async () => {
  // Also reset on retries: a failed mutation test must not contaminate the next run.
  await database("seed");
});

test("create, edit and delete persist in PostgreSQL and refresh the whole dashboard", async ({
  page,
}, testInfo) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (
      response.url().startsWith("http://127.0.0.1:8001/") &&
      response.status() >= 400
    ) {
      errors.push(`${response.status()} ${new URL(response.url()).pathname}`);
    }
  });

  await page.goto("/");
  const sessionId = await getSessionId(page);
  await expectTotals(page, {
    balance: 1900,
    expenses: 1100,
    food: 100,
    rent: 1000,
  });
  await expectNoHorizontalOverflow(page);
  expect(await database("snapshot", sessionId)).toHaveLength(3);

  await test.step("create an expense in the modal", async () => {
    await page
      .getByRole("button", { name: "Ausgabe hinzufügen", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Ausgabe hinzufügen",
      exact: true,
    });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Datum", { exact: true }).fill("2026-09-04");
    await dialog.getByLabel(/^Betrag/).fill("12,50");
    await dialog
      .getByLabel("Empfänger / Sender", { exact: true })
      .fill("Playwright Einkauf");
    await dialog
      .getByLabel("Verwendungszweck", { exact: true })
      .fill("Synthetischer Browsertest");
    await dialog
      .getByRole("combobox", { name: "Kategorie", exact: true })
      .selectOption("Lebensmittel");
    await expectNoHorizontalOverflow(page);
    await saveAndCheck(
      page,
      dialog.getByRole("button", { name: "Ausgabe speichern" }),
      "POST",
      201,
    );
    await expect(dialog).not.toBeVisible();
    await expect(
      page.getByRole("row").filter({ hasText: "Playwright Einkauf" }),
    ).toContainText(money(-12.5));
    await expectTotals(page, {
      balance: 1887.5,
      expenses: 1112.5,
      food: 112.5,
      rent: 1000,
    });
    const rows = await database("snapshot", sessionId);
    expect(rows).toHaveLength(4);
    expect(
      rows.find((row) => row.counterparty === "Playwright Einkauf"),
    ).toMatchObject({ amount: "-12.50", category: "Lebensmittel" });
  });

  await test.step("edit amount and category, then verify a full reload", async () => {
    await page
      .getByRole("button", {
        name: "Playwright Einkauf bearbeiten",
        exact: true,
      })
      .click();
    const dialog = page.getByRole("dialog", { name: "Buchung aktualisieren" });
    await expect(dialog.getByLabel(/^Betrag/)).toHaveValue("-12,5");
    await dialog.getByLabel(/^Betrag/).fill("-25,00");
    await dialog
      .getByLabel("Empfänger / Sender", { exact: true })
      .fill("Playwright aktualisiert");
    await dialog
      .getByRole("combobox", { name: "Kategorie", exact: true })
      .selectOption("Wohnen");
    await saveAndCheck(
      page,
      dialog.getByRole("button", { name: "Änderungen speichern" }),
      "PATCH",
      200,
    );
    await expect(dialog).not.toBeVisible();
    await expectTotals(page, {
      balance: 1875,
      expenses: 1125,
      food: 100,
      rent: 1025,
    });
    await page.reload();
    const row = page
      .getByRole("row")
      .filter({ hasText: "Playwright aktualisiert" });
    await expect(row).toContainText(money(-25));
    await expect(row).toContainText("Wohnen");
    await expectTotals(page, {
      balance: 1875,
      expenses: 1125,
      food: 100,
      rent: 1025,
    });
    const rows = await database("snapshot", sessionId);
    expect(rows).toHaveLength(4);
    expect(
      rows.find((row) => row.counterparty === "Playwright aktualisiert"),
    ).toMatchObject({ amount: "-25.00", category: "Wohnen" });
  });

  await test.step("delete and verify the original totals are restored", async () => {
    await saveAndCheck(
      page,
      page.getByRole("button", {
        name: "Playwright aktualisiert löschen",
        exact: true,
      }),
      "DELETE",
      204,
    );
    await expect(
      page.getByRole("row").filter({ hasText: "Playwright aktualisiert" }),
    ).toHaveCount(0);
    await expectTotals(page, {
      balance: 1900,
      expenses: 1100,
      food: 100,
      rent: 1000,
    });
    await page.reload();
    await expect(
      page.getByText("E2E Supermarkt", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("row").filter({ hasText: "Playwright aktualisiert" }),
    ).toHaveCount(0);
    await expectTotals(page, {
      balance: 1900,
      expenses: 1100,
      food: 100,
      rent: 1000,
    });
    expect(await database("snapshot", sessionId)).toHaveLength(3);
  });

  await expectNoHorizontalOverflow(page);
  expect(errors).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath("dashboard.png"),
    fullPage: true,
  });
});

test("modal remains keyboard accessible and does not write on Escape", async ({
  page,
}) => {
  await page.goto("/");
  const sessionId = await getSessionId(page);
  const trigger = page.getByRole("button", {
    name: "Einnahme hinzufügen",
    exact: true,
  });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", {
    name: "Einnahme hinzufügen",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  expect(
    await dialog.evaluate((element) =>
      element.contains(document.activeElement),
    ),
  ).toBe(true);
  const name = dialog.getByLabel("Empfänger / Sender", { exact: true });
  await name.focus();
  // Native dialogs may let Tab reach browser chrome. The page behind the modal
  // must remain inert, and normal forward/backward form navigation must work.
  await trigger.focus();
  await expect(name).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    dialog.getByLabel("Verwendungszweck", { exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(name).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await expectNoHorizontalOverflow(page);
  expect(await database("snapshot", sessionId)).toHaveLength(3);
});

test("CSV import persists valid rows and reports duplicates and errors", async ({
  page,
}) => {
  await page.goto("/");
  const sessionId = await getSessionId(page);
  await page.getByRole("button", { name: "CSV importieren" }).click();
  const dialog = page.getByRole("dialog", { name: "CSV importieren" });
  const csv = [
    "booking_date,counterparty,iban,purpose,amount,category,status",
    "2026-09-04,CSV Test,DE12345678901234567890,Upload,-15.50,Freizeit,Gebucht",
    "2026-09-04,CSV Test,DE12345678901234567890,Upload,-15.50,Freizeit,Gebucht",
    "invalid-date,Kaputte Zeile,DE999,Upload,-4.00,Freizeit,Gebucht",
  ].join("\n");

  await dialog.getByLabel("CSV-Datei").setInputFiles({
    name: "transactions.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
  const response = page.waitForResponse(
    (candidate) =>
      candidate.url().endsWith("/api/v1/imports/csv") &&
      candidate.request().method() === "POST",
  );
  await dialog.getByRole("button", { name: "Datei importieren" }).click();
  expect((await response).status()).toBe(200);
  await expect(dialog.getByText("Import abgeschlossen")).toBeVisible();
  await expect(dialog.locator("dl")).toContainText("Eingefügt1");
  await expect(dialog.locator("dl")).toContainText("Duplikate1");
  await expect(dialog.locator("dl")).toContainText("Fehlerhaft1");
  await dialog.getByRole("button", { name: "Schließen", exact: true }).click();

  await expect(
    page.getByRole("row").filter({ hasText: "CSV Test" }),
  ).toContainText(money(-15.5));
  const rows = await database("snapshot", sessionId);
  expect(rows).toHaveLength(4);
  expect(rows.find((row) => row.counterparty === "CSV Test")).toMatchObject({
    amount: "-15.50",
    category: "Freizeit",
  });
});

test("each browser receives an isolated demo dataset", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Einnahme hinzufügen", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Einnahme hinzufügen",
    exact: true,
  });
  await dialog.getByLabel("Datum", { exact: true }).fill("2026-09-05");
  await dialog.getByLabel(/^Betrag/).fill("123,45");
  await dialog
    .getByLabel("Empfänger / Sender", { exact: true })
    .fill("Nur Browser A");
  await saveAndCheck(
    page,
    dialog.getByRole("button", { name: "Einnahme speichern" }),
    "POST",
    201,
  );
  await expect(page.getByText("Nur Browser A", { exact: true })).toBeVisible();

  const secondContext = await browser.newContext({
    baseURL: "http://127.0.0.1:4173",
    locale: "de-DE",
    timezoneId: "Europe/Berlin",
  });
  try {
    const secondPage = await secondContext.newPage();
    await secondPage.goto("/");
    await expect(
      secondPage.getByText("Nur Browser A", { exact: true }),
    ).toHaveCount(0);
    await expectTotals(secondPage, {
      balance: 1900,
      expenses: 1100,
      food: 100,
      rent: 1000,
    });

    const firstSessionId = await getSessionId(page);
    const secondSessionId = await getSessionId(secondPage);
    expect(firstSessionId).not.toBe(secondSessionId);
    expect(await database("snapshot", secondSessionId)).toHaveLength(3);
    const firstRows = await database("snapshot", firstSessionId);
    expect(firstRows).toHaveLength(4);

    const browserAOnlyRow = firstRows.find(
      (row) => row.counterparty === "Nur Browser A",
    );
    expect(browserAOnlyRow).toBeDefined();
    const forbiddenUpdate = await secondPage.request.patch(
      `http://127.0.0.1:8001/api/v1/transactions/${browserAOnlyRow.id}`,
      {
        headers: { "X-Demo-Session-ID": secondSessionId },
        data: { amount: "999.00" },
      },
    );
    expect(forbiddenUpdate.status()).toBe(404);
    expect(
      (await database("snapshot", firstSessionId)).find(
        (row) => row.id === browserAOnlyRow.id,
      ).amount,
    ).toBe("123.45");
  } finally {
    await secondContext.close();
  }
});
