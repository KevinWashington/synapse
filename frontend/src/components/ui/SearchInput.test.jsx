import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SearchInput } from "./SearchInput";

describe("SearchInput", () => {
  it("renders an accessible search input and forwards ordinary input props", () => {
    const onChange = vi.fn();
    render(
      <SearchInput
        aria-label="Buscar registros"
        className="custom-search"
        disabled
        onChange={onChange}
        placeholder="Digite para buscar"
        value=""
      />
    );

    const input = screen.getByRole("searchbox", { name: "Buscar registros" });
    expect(input).toBeDisabled();
    expect(input).toHaveAttribute("placeholder", "Digite para buscar");
    expect(input).toHaveClass("w-full", "h-11", "rounded-lg", "bg-white", "pl-10", "custom-search");
  });

  it("forwards change events", () => {
    const onChange = vi.fn();
    render(<SearchInput aria-label="Buscar" onChange={onChange} />);

    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar" }), {
      target: { value: "síntese" },
    });

    expect(onChange).toHaveBeenCalledOnce();
  });
});
