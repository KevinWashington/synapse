import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import NewProjectModal from "./NewProjectModal";
const mocks = vi.hoisted(() => ({ getFrameworks: vi.fn(), createProject: vi.fn() }));
vi.mock("../services/projectService", () => ({ projectService: mocks }));
vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
beforeEach(() => vi.clearAllMocks());
it("creates the explicitly selected framework supplied by the API", async () => {
  mocks.getFrameworks.mockResolvedValue([{ name: "NEW", description: "New framework", components: [] }]);
  mocks.createProject.mockResolvedValue({ project: { id: 9, framework: "NEW" } });
  const onSuccess = vi.fn();
  render(<NewProjectModal isOpen onClose={vi.fn()} onSuccess={onSuccess} />);
  fireEvent.change(screen.getByLabelText(/Titulo/), { target: { value: "Projeto" } });
  fireEvent.change(screen.getByLabelText(/Objetivo/), { target: { value: "Objetivo de estudo" } });
  fireEvent.click(await screen.findByRole("button", { name: /NEW/ }));
  fireEvent.click(screen.getByRole("button", { name: "Criar Projeto" }));
  await waitFor(() => expect(onSuccess).toHaveBeenCalledWith({ id: 9, framework: "NEW" }));
});
it("shows a catalog error and retries while creation is disabled", async () => {
  mocks.getFrameworks.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce([{ name: "PICOC", components: [] }]);
  render(<NewProjectModal isOpen onClose={vi.fn()} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("offline");
  expect(screen.getByRole("button", { name: "Criar Projeto" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Cancelar" })).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Criar Projeto" })).toBeEnabled());
});
