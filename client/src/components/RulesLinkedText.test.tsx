import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RulesLinkedText } from "./RulesLinkedText";

describe("RulesLinkedText", () => {
  it("renders plain text unchanged when nothing matches the glossary", () => {
    render(<RulesLinkedText text="Melee Weapon Attack: +4 to hit, reach 5 ft., one target." />);
    expect(screen.getByText(/Melee Weapon Attack/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("wraps a matched condition in a clickable term and reveals its definition on click", () => {
    render(<RulesLinkedText text="The target must succeed on a saving throw or be knocked prone." />);
    const trigger = screen.getByRole("button", { name: "prone" });
    expect(trigger).toBeInTheDocument();
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    fireEvent.click(trigger);
    expect(screen.getByRole("tooltip")).toHaveTextContent(/Can only crawl/);

    fireEvent.click(trigger);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("matches case-insensitively and handles multiple distinct terms in one string", () => {
    render(<RulesLinkedText text="It is grappled and frightened until the effect ends." />);
    expect(screen.getByRole("button", { name: "grappled" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "frightened" })).toBeInTheDocument();
  });

  it("does not link common words outside the glossary (e.g. plain 'attack')", () => {
    render(<RulesLinkedText text="The dragon makes an attack against the nearest target." />);
    expect(screen.queryByRole("button", { name: "attack" })).not.toBeInTheDocument();
  });
});
