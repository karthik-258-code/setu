import { describe, expect, it } from "vitest";
import { classroomCode, newPin, parseRoster, splitCsvLine } from "../src/roster";

describe("roster CSV", () => {
  it("reads rows with any column order, quotes, a BOM and a default language", () => {
    const csv = '\uFEFFfirst_name,class,Section,roll,lang\n"Ravi, K",8,b,02,te\nAnjali,8,B,1,\n\n';
    const { rows, errors } = parseRoster(csv);
    expect(errors).toEqual([]);
    expect(rows).toEqual([
      { classLevel: 8, section: "B", rollNo: "2", firstName: "Ravi, K", lang: "te" },
      { classLevel: 8, section: "B", rollNo: "1", firstName: "Anjali", lang: "en" },
    ]);
    expect(splitCsvLine('a,"b ""c""",d')).toEqual(["a", 'b "c"', "d"]);
  });

  it("reports bad values and duplicate rolls with their line numbers", () => {
    const csv = "class,section,roll,first_name\n11,B,1,Ravi\n8,B,x,\n8,B,3,Kavya\n8,B,3,Arjun\n";
    const { rows, errors } = parseRoster(csv);
    expect(rows.map((r) => r.firstName)).toEqual(["Kavya"]);
    expect(errors).toEqual([
      { line: 2, message: "class must be 6 to 10" },
      { line: 3, message: "roll must be a number; first_name must be 1 to 40 characters" },
      { line: 5, message: "duplicate roll 3 in class 8 B" },
    ]);
  });

  it("refuses a file without the required columns", () => {
    expect(parseRoster("name,class\nRavi,8\n").errors[0]?.message).toMatch(/missing column/);
  });

  it("makes readable classroom codes and four-digit PINs", () => {
    let n = 0;
    const fixed = (max: number) => n++ % max;
    expect(classroomCode(8, "B", fixed)).toBe("8B-ABC");
    expect(newPin(() => 0)).toBe("1000");
    expect(newPin((max) => max - 1)).toBe("9999");
  });
});
