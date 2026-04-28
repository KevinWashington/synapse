const BASE_EXTRACTION_COLUMNS = [
  { key: "articleId", label: "articleId" },
  { key: "paperId", label: "paperId" },
  { key: "title", label: "title" },
  { key: "year", label: "year" },
  { key: "sourceName", label: "sourceName" },
  { key: "rqs", label: "rqs" },
  { key: "qualityScore", label: "qualityScore" },
  { key: "qualityRating", label: "qualityRating" },
];

function escapeCsvValue(value) {
  const safeValue = Array.isArray(value)
    ? value.join("|")
    : value === true
    ? "true"
    : value === false
    ? "false"
    : value ?? "";

  return `"${String(safeValue).replace(/"/g, '""')}"`;
}

function buildExtractionMatrixCsv(data) {
  const dynamicColumns = (data?.extractionColumns || []).map((column) => ({
    key: column.key,
    label: column.key,
  }));
  const columns = [...BASE_EXTRACTION_COLUMNS, ...dynamicColumns];
  const lines = [columns.map((column) => escapeCsvValue(column.label)).join(",")];

  (data?.extractionRows || []).forEach((row) => {
    const values = columns.map((column) => {
      if (BASE_EXTRACTION_COLUMNS.some((baseColumn) => baseColumn.key === column.key)) {
        return escapeCsvValue(row?.[column.key]);
      }
      return escapeCsvValue(row?.values?.[column.key]);
    });
    lines.push(values.join(","));
  });

  return lines.join("\n");
}

function buildDistributionsCsv(data) {
  const header = ["metricKey", "metricLabel", "value", "count", "percentage"];
  const lines = [header.map(escapeCsvValue).join(",")];

  (data?.distributionCharts || []).forEach((chart) => {
    (chart.rows || []).forEach((row) => {
      lines.push(
        [
          escapeCsvValue(chart.key),
          escapeCsvValue(chart.label),
          escapeCsvValue(row.value),
          escapeCsvValue(row.count),
          escapeCsvValue(row.percentage),
        ].join(",")
      );
    });
  });

  return lines.join("\n");
}

function buildQualitySummaryCsv(data) {
  const header = [
    "section",
    "criterionKey",
    "criterionLabel",
    "value",
    "count",
    "percentage",
  ];
  const lines = [header.map(escapeCsvValue).join(",")];

  (data?.qualitySummary?.byRating || []).forEach((row) => {
    lines.push(
      [
        escapeCsvValue("overall_rating"),
        escapeCsvValue(""),
        escapeCsvValue(""),
        escapeCsvValue(row.value),
        escapeCsvValue(row.count),
        escapeCsvValue(row.percentage),
      ].join(",")
    );
  });

  (data?.qualitySummary?.byCriterion || []).forEach((criterion) => {
    (criterion.rows || []).forEach((row) => {
      lines.push(
        [
          escapeCsvValue("criterion_response"),
          escapeCsvValue(criterion.key),
          escapeCsvValue(criterion.label),
          escapeCsvValue(row.value),
          escapeCsvValue(row.count),
          escapeCsvValue(row.percentage),
        ].join(",")
      );
    });
  });

  return lines.join("\n");
}

function buildSynthesisReportJson(data) {
  return JSON.stringify(data, null, 2);
}

export {
  BASE_EXTRACTION_COLUMNS,
  buildDistributionsCsv,
  buildExtractionMatrixCsv,
  buildQualitySummaryCsv,
  buildSynthesisReportJson,
};
