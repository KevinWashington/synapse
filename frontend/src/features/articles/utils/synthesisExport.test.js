import test from "node:test";
import assert from "node:assert/strict";
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

  assert.match(csv, /"articleId","paperId","title","year","sourceName","rqs","qualityScore","qualityRating","country","techniques","peer_reviewed"/);
  assert.match(csv, /"Study A"/);
  assert.match(csv, /"BR"/);
  assert.match(csv, /"survey\|case study"/);
  assert.match(csv, /"true"/);
});

test("buildDistributionsCsv serializes long-form distribution rows", () => {
  const csv = buildDistributionsCsv(sampleData);

  assert.match(csv, /"metricKey","metricLabel","value","count","percentage"/);
  assert.match(csv, /"techniques","Techniques","survey","1","50"/);
  assert.match(csv, /"peer_reviewed","Peer Reviewed","true","1","100"/);
});

test("buildQualitySummaryCsv serializes rating and criterion sections", () => {
  const csv = buildQualitySummaryCsv(sampleData);

  assert.match(csv, /"overall_rating","","","high","1","100"/);
  assert.match(csv, /"criterion_response","bias","Risk of bias","yes","1","100"/);
});
