import { render } from "@testing-library/react";
import App from "./App";

describe("App", () => {
  it("renders the shell root element", () => {
    const { container } = render(<App />);
    expect(container.querySelector("#samagra-os-shell")).toBeInTheDocument();
  });
});
