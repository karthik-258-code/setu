import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { L } from "./l";
import { LANG_STORAGE_KEY, LangProvider, useLang } from "./lang-context";
import { strings } from "./strings";
import { translate } from "./translate";

describe("translate", () => {
  it("returns the Telugu text without fallback when it exists", () => {
    expect(translate({ en: "Add", te: "కూడండి" }, "te")).toEqual({
      text: "కూడండి",
      fallback: false,
    });
  });

  it("falls back to English and flags it when Telugu is missing", () => {
    expect(translate({ en: "Add" }, "te")).toEqual({ text: "Add", fallback: true });
  });

  it("treats blank Telugu as missing", () => {
    expect(translate({ en: "Add", te: "  " }, "te").fallback).toBe(true);
  });

  it("never flags English requests as fallback", () => {
    expect(translate({ en: "Add" }, "en")).toEqual({ text: "Add", fallback: false });
  });
});

describe("strings", () => {
  it("has real Telugu (Telugu script) for every UI key", () => {
    for (const [key, value] of Object.entries(strings)) {
      expect(value.te, key).toMatch(/[\u0C00-\u0C7F]/);
    }
  });
});

function Probe() {
  const { lang, setLang, ui } = useLang();
  return (
    <div>
      <span data-testid="lang">{lang}</span>
      <span data-testid="ui">{ui("language")}</span>
      <button onClick={() => setLang("te")}>to-te</button>
      <L text={{ en: "Only in English" }} />
      <L text={{ en: "Hello", te: "నమస్తే" }} />
    </div>
  );
}

describe("LangProvider", () => {
  it("defaults to English and shows the English only marker for English-only text in Telugu", async () => {
    render(
      <LangProvider>
        <Probe />
      </LangProvider>,
    );
    expect(screen.getByTestId("lang")).toHaveTextContent("en");
    expect(screen.queryByTestId("english-only")).toBeNull();
    await userEvent.click(screen.getByText("to-te"));
    expect(screen.getByTestId("lang")).toHaveTextContent("te");
    expect(screen.getByTestId("ui")).toHaveTextContent(strings.language.te);
    expect(screen.getAllByTestId("english-only")).toHaveLength(1);
    expect(screen.getByText("నమస్తే")).toBeInTheDocument();
  });

  it("persists the language in localStorage and restores it", async () => {
    const first = render(
      <LangProvider>
        <Probe />
      </LangProvider>,
    );
    await userEvent.click(screen.getByText("to-te"));
    expect(window.localStorage.getItem(LANG_STORAGE_KEY)).toBe("te");
    first.unmount();
    render(
      <LangProvider>
        <Probe />
      </LangProvider>,
    );
    expect(screen.getByTestId("lang")).toHaveTextContent("te");
  });
});
