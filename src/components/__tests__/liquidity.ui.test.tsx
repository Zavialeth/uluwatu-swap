import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import Liquidity from "../Liquidity";

// UI smoke test: verify component renders and auto-calculates with a test override price.
describe("Liquidity UI", () => {
  it("renders and auto-updates DeFiD when ETH amount changes (with test override)", async () => {
    render(<Liquidity testOverrides={{ price: 100 }} />); // 1 ETH = 100 DeFiD

    // Heading renders
    expect(await screen.findByText(/Add Liquidity \(Full-Range, Auto-calc\)/i)).toBeInTheDocument();

    // Type 0.01 ETH
    const input = screen.getByPlaceholderText(/0\.00/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "0.01" } });

    // Required DeFiD should be exactly 1.000000 (0.01 * 100)
    const readonlyField = await screen.findByDisplayValue("1.000000");
    expect(readonlyField).toBeInTheDocument();

    // Buffer line should show 1.003000 exactly
    expect(await screen.findByText(/Shown with \+0\.3% buffer: 1\.003000/)).toBeInTheDocument();
  });
});
