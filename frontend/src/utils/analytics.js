const monthFormatter = new Intl.DateTimeFormat("de-DE", {
  month: "short",
  year: "2-digit",
});

const dayFormatter = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "short",
});

function getCurrentMonthKey() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${now.getFullYear()}-${month}`;
}

function getCurrentDayKey() {
  const now = new Date();
  const localTime = now.getTime() - now.getTimezoneOffset() * 60_000;
  return new Date(localTime).toISOString().slice(0, 10);
}

export function buildMonthlyData(transactions) {
  const currentMonthKey = getCurrentMonthKey();
  const months = new Map();

  transactions.forEach((transaction) => {
    const monthKey = transaction.bookingDate.slice(0, 7);

    if (!months.has(monthKey)) {
      months.set(monthKey, {
        key: monthKey,
        label: monthFormatter.format(new Date(`${monthKey}-01T00:00:00`)),
        income: 0,
        expenses: 0,
        isCurrentPeriod: monthKey === currentMonthKey,
      });
    }

    const month = months.get(monthKey);

    if (transaction.amount >= 0) {
      month.income += transaction.amount;
    } else {
      month.expenses += Math.abs(transaction.amount);
    }
  });

  return [...months.values()].sort((first, second) =>
    first.key.localeCompare(second.key),
  );
}

export function buildDailyData(transactions) {
  const currentDayKey = getCurrentDayKey();
  const days = new Map();

  transactions.forEach((transaction) => {
    const dayKey = transaction.bookingDate;

    if (!days.has(dayKey)) {
      days.set(dayKey, {
        key: dayKey,
        label: dayFormatter.format(new Date(`${dayKey}T00:00:00`)),
        income: 0,
        expenses: 0,
        isCurrentPeriod: dayKey === currentDayKey,
      });
    }

    const day = days.get(dayKey);

    if (transaction.amount >= 0) {
      day.income += transaction.amount;
    } else {
      day.expenses += Math.abs(transaction.amount);
    }
  });

  return [...days.values()].sort((first, second) =>
    first.key.localeCompare(second.key),
  );
}

export function buildCategoryData(transactions, maximumCategories = 6) {
  const categories = new Map();

  transactions.forEach((transaction) => {
    if (transaction.amount >= 0) {
      return;
    }

    const category = transaction.category || "Ohne Kategorie";
    const currentAmount = categories.get(category) || 0;
    categories.set(category, currentAmount + Math.abs(transaction.amount));
  });

  const sortedCategories = [...categories.entries()]
    .map(([name, amount]) => ({ name, amount }))
    .sort((first, second) => second.amount - first.amount);

  if (sortedCategories.length <= maximumCategories) {
    return sortedCategories;
  }

  const visibleCategories = sortedCategories.slice(0, maximumCategories);
  const remainingAmount = sortedCategories
    .slice(maximumCategories)
    .reduce((sum, category) => sum + category.amount, 0);

  return [...visibleCategories, { name: "Sonstige", amount: remainingAmount }];
}

export function formatTimelineData(points, granularity) {
  const currentPeriod =
    granularity === "day" ? getCurrentDayKey() : getCurrentMonthKey();

  return points.map((point) => {
    const periodKey =
      granularity === "day" ? point.period : point.period.slice(0, 7);
    const formatter = granularity === "day" ? dayFormatter : monthFormatter;

    return {
      key: periodKey,
      label: formatter.format(new Date(`${point.period}T00:00:00`)),
      income: point.income,
      expenses: point.expenses,
      isCurrentPeriod: periodKey === currentPeriod,
    };
  });
}

export function collapseCategoryData(categories, maximumCategories = 6) {
  if (categories.length <= maximumCategories) {
    return categories;
  }

  const visibleCategories = categories.slice(0, maximumCategories);
  const remainingAmount = categories
    .slice(maximumCategories)
    .reduce((sum, category) => sum + category.amount, 0);

  return [...visibleCategories, { name: "Sonstige", amount: remainingAmount }];
}
