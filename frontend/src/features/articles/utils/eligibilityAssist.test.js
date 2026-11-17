import { beforeEach, describe, expect, it, vi } from "vitest";

const sendChatMessage = vi.fn();
vi.mock("@/services/chatService", () => ({ chatService: { sendChatMessage: (...args) => sendChatMessage(...args) } }));
vi.mock("@features/ai/public/pdf", () => ({ extractArticlePdfContent: vi.fn() }));

const { requestEligibilityAssist } = await import("./eligibilityAssist");

const checklist = [{ key: "item-1", label: "Avalia estudantes" }, { key: "item-2", label: "Usa IA" }];

describe("requestEligibilityAssist", () => {
  beforeEach(() => sendChatMessage.mockReset());

  it("normalizes the AI draft into checklist items", async () => {
    sendChatMessage.mockResolvedValue({
      content: "```json\n{\"items\":[{\"key\":\"item-1\",\"status\":\"atende\",\"evidence\":\"80 students\",\"note\":\"amostra\"},{\"key\":\"item-2\",\"status\":\"???\"}],\"reasonText\":\" Atende \",\"suggestedDecision\":\"included\"}\n```",
    });

    const result = await requestEligibilityAssist({ article: { title: "Estudo" }, checklist });

    expect(result).toEqual({
      items: [
        { key: "item-1", status: "met", evidence: "80 students\namostra" },
        { key: "item-2", status: "unclear", evidence: "" },
      ],
      answeredRQs: [],
      reasonText: "Atende",
      suggestedDecision: "included",
    });
    expect(sendChatMessage.mock.calls[0][0].messages[0].content).toContain("[key=item-2]");
  });

  it("keeps only valid research questions the AI marked as answered", async () => {
    sendChatMessage.mockResolvedValue({
      content: "{\"items\":[],\"answeredRQs\":[{\"rq\":2,\"evidence\":\"x\"},\"RQ 1\",3,{\"rq\":9},2],\"suggestedDecision\":\"included\"}",
    });

    const result = await requestEligibilityAssist({ article: {}, checklist, researchQuestions: ["A?", "B?", "C?"] });

    expect(result.answeredRQs).toEqual([1, 2, 3]);
    expect(sendChatMessage.mock.calls[0][0].messages[0].content).toContain("RQ 3: C?");
    expect(sendChatMessage.mock.calls[0][0].messages[0].content).toContain("answeredRQs");
  });

  it("rejects answers without JSON so the form can show its fallback", async () => {
    sendChatMessage.mockResolvedValue({ content: "Não consegui avaliar." });

    await expect(requestEligibilityAssist({ article: {}, checklist })).rejects.toThrow();
  });
});
