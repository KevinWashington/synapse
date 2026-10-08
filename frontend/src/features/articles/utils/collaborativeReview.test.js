import { describe, expect, it } from "vitest";

import { collaborativeReview } from "./collaborativeReview";

describe("collaborativeReview", () => {
  it("uses the server authorization for an unassigned reviewer even without managed metadata", () => {
    const review = collaborativeReview({
      hasActiveReviewAssignments: false,
      myReviewAssignment: null,
      canWriteReview: false,
      canDecideReview: false,
      canManageArticle: false,
    });

    expect(review.canWrite).toBe(false);
    expect(review.canDecide).toBe(false);
  });

  it("keeps the solo owner workflow available", () => {
    const review = collaborativeReview({
      hasActiveReviewAssignments: false,
      canWriteReview: true,
      canDecideReview: true,
      canManageArticle: true,
    });

    expect(review.canWrite).toBe(true);
    expect(review.canDecide).toBe(true);
  });

  it("keeps a coordinator from using the solo decision path", () => {
    const review = collaborativeReview({
      hasActiveReviewAssignments: false,
      canWriteReview: true,
      canDecideReview: false,
      canManageArticle: true,
    });

    expect(review.canWrite).toBe(true);
    expect(review.canDecide).toBe(false);
  });
});
