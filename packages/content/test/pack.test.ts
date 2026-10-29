import { describe, expect, it } from "vitest";
import { loadContent } from "../src/load";
import { MAX_PACK_BYTES, buildPack, chapterScope, packSources, questionCounts } from "../src/pack";

const { input } = loadContent();
const sources = packSources(input);
const CHAPTER = "CH.M8.LINEAR_EQ_ONE_VAR";
const AT = "2026-10-28T00:00:00.000Z";

describe("pack builder", () => {
  it("builds the Class 8 pack from the whole graph and the content in its scope", () => {
    const pack = buildPack(sources, CHAPTER, AT);
    const scope = chapterScope(pack.graph, CHAPTER);
    expect(scope.size).toBe(25);
    expect(pack.chapterId).toBe(CHAPTER);
    expect(pack.builtAt).toBe(AT);
    expect(Object.keys(pack.graph.concepts)).toHaveLength(sources.concepts.length);
    expect(pack.questions.length).toBeGreaterThanOrEqual(280);
    expect(pack.questions.every((q) => scope.has(q.conceptId))).toBe(true);
    expect(pack.questions.some((q) => q.templateId !== undefined)).toBe(true);
    expect(pack.resources).toHaveLength(
      sources.resources.filter((r) => scope.has(r.conceptId)).length,
    );
    expect(Object.keys(pack.misconceptions).sort()).toEqual(
      Object.keys(sources.misconceptions).sort(),
    );
    expect(Object.keys(pack.reasonTemplates).sort()).toEqual(Object.keys(sources.reasons).sort());
  });

  it("carries exactly the question count the builder reports for every chapter", () => {
    for (const c of questionCounts(sources.concepts, sources.chapters, sources.questions)) {
      expect(buildPack(sources, c.chapterId, AT).questions, c.chapterId).toHaveLength(c.total);
    }
  });

  it("versions a pack by its content, not by when it was built", () => {
    const a = buildPack(sources, CHAPTER, AT);
    expect(a.packVersion).toMatch(/^[0-9a-f]{12}$/);
    expect(buildPack(sources, CHAPTER, "2026-10-29T08:00:00.000Z").packVersion).toBe(a.packVersion);
    const target = a.questions[0];
    if (!target) throw new Error("the Class 8 pack has no questions");
    const edited = sources.questions.map((q) =>
      q.id === target.id ? { ...q, stem: { ...q.stem, en: `${q.stem.en} (edited)` } } : q,
    );
    expect(buildPack({ ...sources, questions: edited }, CHAPTER, AT).packVersion).not.toBe(
      a.packVersion,
    );
  });

  it("lists questions and resources in id order", () => {
    const pack = buildPack(sources, CHAPTER, AT);
    const questionIds = pack.questions.map((q) => q.id);
    const resourceIds = pack.resources.map((r) => r.id);
    expect(questionIds).toEqual([...questionIds].sort());
    expect(resourceIds).toEqual([...resourceIds].sort());
  });

  it("keeps every chapter's pack under 5 MB", () => {
    for (const chapter of sources.chapters) {
      const bytes = Buffer.byteLength(JSON.stringify(buildPack(sources, chapter.id, AT)));
      expect(bytes, chapter.id).toBeLessThan(MAX_PACK_BYTES);
    }
  });

  it("throws on an unknown chapter", () => {
    expect(() => buildPack(sources, "CH.NOPE", AT)).toThrow("Unknown chapter id: CH.NOPE");
  });
});
