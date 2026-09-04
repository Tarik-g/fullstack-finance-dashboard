import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { collapseCategoryData, formatTimelineData } from "../utils/analytics";
import { formatCompactCurrency, formatCurrency } from "../utils/formatters";

const CATEGORY_COLORS = [
  "#7c5cff",
  "#3ddc97",
  "#ffb454",
  "#ff6b7a",
  "#5ba8ff",
  "#c27aff",
  "#7f8ba3",
];

const tooltipStyle = {
  background: "#151f31",
  border: "1px solid #354464",
  borderRadius: "10px",
  color: "#e8edf7",
};

function AnalyticsDashboard({ timeline, categories, periodMode, isLoading }) {
  const isDailyView = periodMode === "month";
  const timelineData = useMemo(
    () => formatTimelineData(timeline, isDailyView ? "day" : "month"),
    [isDailyView, timeline],
  );
  const categoryData = useMemo(
    () => collapseCategoryData(categories),
    [categories],
  );
  const totalCategoryExpenses = categoryData.reduce(
    (sum, category) => sum + category.amount,
    0,
  );

  return (
    <section
      className="analytics-grid"
      aria-label="Finanzanalysen"
      aria-busy={isLoading}
    >
      <article className="panel chart-panel monthly-chart-panel">
        <div className="section-heading chart-heading">
          <div>
            <p className="eyebrow">Verlauf</p>
            <h2>
              {isDailyView ? "Tägliche Entwicklung" : "Monatliche Entwicklung"}
            </h2>
          </div>
          <div className="chart-key" aria-label="Legende">
            <span>
              <i className="income-key" />
              Einnahmen
            </span>
            <span>
              <i className="expense-key" />
              Ausgaben
            </span>
          </div>
        </div>

        {isLoading ? (
          <p className="chart-empty" role="status">
            Auswertung wird geladen …
          </p>
        ) : timelineData.length === 0 ? (
          <p className="chart-empty">Keine Daten für diese Auswahl.</p>
        ) : (
          <div
            className="chart-container"
            aria-label={`Einnahmen und Ausgaben pro ${isDailyView ? "Tag" : "Monat"}`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={timelineData}
                margin={{ top: 8, right: 4, bottom: 0, left: 0 }}
                accessibilityLayer
              >
                <CartesianGrid
                  stroke="#243047"
                  strokeDasharray="4 4"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#8d9ab0", fontSize: 12 }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#8d9ab0", fontSize: 12 }}
                  tickFormatter={formatCompactCurrency}
                  width={68}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  itemStyle={{ color: "#e8edf7" }}
                  labelStyle={{ color: "#ffffff" }}
                  cursor={{ fill: "rgba(124, 92, 255, 0.08)" }}
                  formatter={(value) => formatCurrency(Number(value))}
                />
                <Bar dataKey="income" name="Einnahmen" radius={[5, 5, 0, 0]}>
                  {timelineData.map((period) => (
                    <Cell
                      key={`income-${period.key}`}
                      fill={period.isCurrentPeriod ? "#5ce6ab" : "#2b9c6a"}
                    />
                  ))}
                </Bar>
                <Bar dataKey="expenses" name="Ausgaben" radius={[5, 5, 0, 0]}>
                  {timelineData.map((period) => (
                    <Cell
                      key={`expense-${period.key}`}
                      fill={period.isCurrentPeriod ? "#ff7b88" : "#b94c5b"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <p className="chart-note">
          {isDailyView ? "Der aktuelle Tag" : "Der aktuelle Monat"} wird heller
          dargestellt. Alle Dashboard-Filter wirken auch auf dieses Diagramm.
        </p>
      </article>

      <article className="panel chart-panel category-chart-panel">
        <div className="section-heading chart-heading">
          <div>
            <p className="eyebrow">Verteilung</p>
            <h2>Ausgaben nach Kategorie</h2>
          </div>
        </div>

        {isLoading ? (
          <p className="chart-empty" role="status">
            Auswertung wird geladen …
          </p>
        ) : categoryData.length === 0 ? (
          <p className="chart-empty">Keine Ausgaben für diese Auswahl.</p>
        ) : (
          <>
            <div className="donut-wrap" aria-label="Ausgaben nach Kategorie">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart accessibilityLayer>
                  <Pie
                    data={categoryData}
                    dataKey="amount"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius="62%"
                    outerRadius="86%"
                    paddingAngle={2}
                    stroke="transparent"
                  >
                    {categoryData.map((category, index) => (
                      <Cell
                        key={category.name}
                        fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipStyle}
                    itemStyle={{ color: "#e8edf7" }}
                    labelStyle={{ color: "#ffffff" }}
                    formatter={(value) => formatCurrency(Number(value))}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="donut-total" aria-hidden="true">
                <span>Ausgaben</span>
                <strong>{formatCurrency(totalCategoryExpenses)}</strong>
              </div>
            </div>

            <ul className="category-legend">
              {categoryData.map((category, index) => (
                <li key={category.name}>
                  <span
                    className="category-swatch"
                    style={{
                      backgroundColor:
                        CATEGORY_COLORS[index % CATEGORY_COLORS.length],
                    }}
                  />
                  <span className="category-name">{category.name}</span>
                  <strong>{formatCurrency(category.amount)}</strong>
                </li>
              ))}
            </ul>
          </>
        )}
      </article>
    </section>
  );
}

export default AnalyticsDashboard;
