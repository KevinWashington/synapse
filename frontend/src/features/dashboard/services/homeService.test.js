import { expect, it, vi } from "vitest";
import { apiService } from "@/services/api";
import { homeService } from "./homeService";
vi.mock("@/services/api", () => ({ apiService: { get: vi.fn().mockResolvedValue({ items: [] }) } }));
it("sends bounded task and activity pagination to home endpoints", async () => {
  await homeService.getTasks({ phase: "eligibility", page: 2, pageSize: 4 });
  expect(apiService.get).toHaveBeenLastCalledWith("/api/home/tasks?phase=eligibility&page=2&pageSize=4");
  await homeService.getActivity();
  expect(apiService.get).toHaveBeenLastCalledWith("/api/home/activity?page=1&pageSize=4");
});
