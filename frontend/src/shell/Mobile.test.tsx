// RED tests for the E3 mobile shell (proto.md §7 mobile frame + §1.4/§1.11).
// Mobile is a PURE presentational shell: it shows a phone frame with a status
// bar, a home screen (app grid + favorites dock) when no app is open, and a
// single full-screen app (with a Home control) when `mobileApp` is set. All
// state lives in the theme store; Mobile only renders props + dispatches intent.
import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import Mobile from "./Mobile";
import { ORDER, MOBILE_FAVORITES } from "../registry";

describe("Mobile shell (E3 — phone frame)", () => {
  it("renders the phone frame + a status bar showing the clock (home screen)", () => {
    render(<Mobile clock="9:41 AM" mobileApp={null} onOpen={() => {}} onHome={() => {}} />);
    expect(screen.getByTestId("mobile-frame")).toBeInTheDocument();
    const status = screen.getByTestId("mobile-statusbar");
    expect(within(status).getByText("9:41 AM")).toBeInTheDocument();
  });

  it("renders one home-grid launcher per app (inline svg, never a letter badge) + the favorites dock", () => {
    render(<Mobile clock="9:41 AM" mobileApp={null} onOpen={() => {}} onHome={() => {}} />);
    const grid = screen.getByTestId("mobile-grid");
    // FD2: one inline <svg> app glyph per app in ORDER — no letter badges.
    expect(grid.querySelectorAll("svg")).toHaveLength(ORDER.length);
    const dock = screen.getByTestId("mobile-dock");
    expect(dock.querySelectorAll("svg")).toHaveLength(MOBILE_FAVORITES.length);
    // FD2: the glyph is a real inline <svg> (never a 1-char letter badge); the
    // home grid additionally captions each tile with the full app name.
    const dash = within(grid).getByRole("button", { name: /dashboard/i });
    expect(dash.querySelector("svg")).not.toBeNull();
    expect(within(dash).getByText("Dashboard")).toBeInTheDocument();
  });

  it("taps a home-grid launcher → onOpen(id)", () => {
    const onOpen = vi.fn();
    render(<Mobile clock="9:41 AM" mobileApp={null} onOpen={onOpen} onHome={() => {}} />);
    fireEvent.click(within(screen.getByTestId("mobile-grid")).getByRole("button", { name: /notes/i }));
    expect(onOpen).toHaveBeenCalledWith("notes");
  });

  it("taps a favorites-dock launcher → onOpen(id)", () => {
    const onOpen = vi.fn();
    render(<Mobile clock="9:41 AM" mobileApp={null} onOpen={onOpen} onHome={() => {}} />);
    fireEvent.click(within(screen.getByTestId("mobile-dock")).getByRole("button", { name: /clock/i }));
    expect(onOpen).toHaveBeenCalledWith("clock");
  });

  it("shows the open app full-screen (no home grid) with a Home control that calls onHome", () => {
    const onHome = vi.fn();
    render(
      <Mobile
        clock="9:41 AM"
        mobileApp="notes"
        onOpen={() => {}}
        onHome={onHome}
        appBody={<div data-testid="app-body">notes body</div>}
      />,
    );
    expect(screen.queryByTestId("mobile-grid")).toBeNull();
    expect(within(screen.getByTestId("mobile-app")).getByTestId("app-body")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /home/i }));
    expect(onHome).toHaveBeenCalled();
  });
});
