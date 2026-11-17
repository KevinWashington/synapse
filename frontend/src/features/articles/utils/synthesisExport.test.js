import { expect, test } from "vitest";
import {
  buildDistributionsCsv,
  buildExtractionMatrixCsv,
  buildQualitySummaryCsv,
} from "./synthesisExport.js";

const sampleData = {
  projectId: 7,
  extractionColumns: [
    { key: "country", label: "Country", type: "single_select" },
    { key: "techniques", label: "Techniques", type: "multi_select" },
    { key: "peer_reviewed", label: "Peer Reviewed", type: "boolean" },
  ],
  extractionRows: [
    {
      articleId: 1,
      paperId: "paper-1",
      title: "Study A",
      year: 2023,
      sourceName: "Scopus",
      rqs: [1, 2],
      qualityScore: 75,
      qualityRating: "high",
      values: {
        country: "BR",
        techniques: ["survey", "case study"],
        peer_reviewed: true,
      },
    },
  ],
  distributionCharts: [
    {
      key: "techniques",
      label: "Techniques",
      rows: [
        { value: "survey", count: 1, percentage: 50 },
        { value: "case study", count: 1, percentage: 50 },
      ],
    },
    {
      key: "peer_reviewed",
      label: "Peer Reviewed",
      rows: [{ value: "true", count: 1, percentage: 100 }],
    },
  ],
  qualitySummary: {
    byRating: [
      { value: "high", count: 1, percentage: 100 },
      { value: "unrated", count: 0, percentage: 0 },
    ],
    byCriterion: [
      {
        key: "bias",
        label: "Risk of bias",
        rows: [
          { value: "yes", count: 1, percentage: 100 },
          { value: "partial", count: 0, percentage: 0 },
        ],
      },
    ],
  },
};

test("buildExtractionMatrixCsv serializes base and dynamic extraction columns", () => {
  const csv = buildExtractionMatrixCsv(sampleData);

  expect(csv).toMatch(/"Código do estudo","Identificador","Título","Ano","Fonte","Perguntas respondidas","Pontuação","Avaliação","country","techniques","peer_reviewed"/);
  expect(csv).toMatch(/"Study A"/);
  expect(csv).toMatch(/"BR"/);
  expect(csv).toMatch(/"survey\|case study"/);
  expect(csv).toMatch(/"true"/);
});

test("buildDistributionsCsv serializes long-form distribution rows", () => {
  const csv = buildDistributionsCsv(sampleData);

  expect(csv).toMatch(/"metricKey","metricLabel","value","count","percentage"/);
  expect(csv).toMatch(/"techniques","Techniques","survey","1","50"/);
  expect(csv).toMatch(/"peer_reviewed","Peer Reviewed","true","1","100"/);
});

test("buildQualitySummaryCsv serializes rating and criterion sections", () => {
  const csv = buildQualitySummaryCsv(sampleData);

  expect(csv).toMatch(/"overall_rating","","","high","1","100"/);
  expect(csv).toMatch(/"criterion_response","bias","Risk of bias","yes","1","100"/);
});
