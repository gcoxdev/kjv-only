import october2026 from "./releases/coverage-2026-10-26.json";
import type { QuizCoverageRelease } from "./mastery";

// Append new coverage releases; never rewrite the membership of an old one.
// Imported only by the lazy Progress view. Unit checks protect the manifest.
export const QUIZ_COVERAGE_RELEASES = [october2026 as unknown as QuizCoverageRelease];
