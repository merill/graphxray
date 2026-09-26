import React from "react";
import { render, screen } from "@testing-library/react";
import Options from "./Options";

test("renders the help heading", () => {
  render(<Options />);
  expect(
    screen.getByText(/Viewing the Graph call stack trace/i)
  ).toBeInTheDocument();
});

test("renders the step by step guide", () => {
  render(<Options />);
  expect(screen.getByText(/Step by step guide/i)).toBeInTheDocument();
});
