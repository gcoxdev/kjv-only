# Bible Quiz and Mastery Plan

Draft for review · Updated October 26, 2026

**Implementation status (October 25, 2026): Stages 3 and 4 complete.** The app has **8,965 independently reviewed objectives in 8,971 question forms**, retaining all **1,189 initial chapter sets**. Stage 4 added **608 objectives and six shared-credit alternate forms**. Coverage includes 357 book exercises across all 66 books, 57 testament/Bible exercises, 146 vocabulary objectives, 35 timelines, 142 matches, eight family trees, and 12 maps. All 285 book-depth recommendations and the dense-chapter decision queue are resolved; four shorter-chapter supplements were also reviewed and published. All original 8,357 IDs, answers, and versions remain, with historical reward compatibility for two difficulty corrections. Final validation passed: 29 unit tests, 10 browser scenarios, scoped lint, and production/package checks. See [current inventory](quiz-stage4-coverage.md), [Stage 4 completion details](quiz-stage4-status.md), and [final publication ledger](quiz-stage4-completion-publication.json). Stage 5 is in progress; see [current work](quiz-stage5-status.md).

Add **Quiz** to both panel Home and sidebar Home, using the same page and shared progress. Build toward comprehensive coverage of all **66 books and 1,189 chapters**, with easy, medium, and hard questions, short resumable sessions, earned rewards, and a visible path toward mastery of the published question bank.

The recommended structure is **one shared question bank with multiple scopes**, supplemented by questions written specifically for book, testament, and whole-Bible understanding. This combines detailed chapter knowledge with broader connections without maintaining four largely duplicated collections. Include dedicated **KJV vocabulary, Bible structure, event sequence, genealogy, and geography** objectives alongside passage comprehension.

## Reader experience

Place Quiz after Search in the shared home-button list. Opening it shows three primary actions: **Start a quiz**, **Continue**, and **Review mistakes**. A compact progress card links to **Mastery**. Continue appears when a saved session exists; Review mistakes shows its available count.

The setup defaults to the last active Bible chapter, Mixed difficulty, Practice mode, and 10 questions. Readers can choose another scope and session length, with an optional skill filter for Passage Comprehension, Vocabulary, Bible Structure, Event Sequence, People and Family, or Geography. Keep All Skills as the default. A short chapter may offer fewer questions; show the actual count before starting rather than repeating questions to fill a quota. Show when a session contains longer sorting, tree, or map exercises; ten interactions need not take the same time as ten multiple-choice questions.

```text
Panel Home or Sidebar Home
  → Quiz setup or Continue
  → Answer one question at a time
  → Feedback and cited verses
  → Session results and earned rewards
  → Review weak areas or continue to another chapter

Quiz → Mastery → Testament → Book → Chapter → Learning objectives
```

Keep the existing panel header and sidebar Home behavior. Going Home, changing tabs, closing the mobile sidebar, or reloading saves the session. Reading another chapter must not silently change an active quiz. In the narrow sidebar, use a single column and a compact question header, with an option to continue the same session in a normal panel.

## Quizzes after marking a chapter read

Add a **Quiz after reading** preference in Settings, with **Off** (default), **Chapter only**, and **Chapter and milestone quizzes**. When enabled, explicitly marking an unread chapter as read opens its quiz. Reading progress is saved immediately; taking or passing the quiz is optional and never a condition of marking the chapter read.

With milestone quizzes enabled, offer a sequence from the narrowest scope to the broadest:

| Chapter marked read | Quiz sequence |
|---|---|
| Ordinary chapter | Chapter |
| Last chapter of a book | Chapter → Book |
| Malachi 4, the last chapter of the Old Testament | Chapter → Malachi → Old Testament |
| Revelation 22, the last chapter of the Bible and New Testament | Chapter → Revelation → New Testament → Whole Bible |

Show the pending scopes up front. After each quiz, offer **Continue to [next scope]**, **Skip this quiz**, or **Finish for now**, with the remaining sequence saved for later. Use the existing session length, difficulty, scope selection, and shared objective/reward rules; broader quizzes remain manageable samples rather than exhaustive examinations. Preserve the reader's place and provide an easy return to reading.

These are **canonical end-of-book/testament/Bible triggers**, not proof that every preceding chapter has been read. A reader opening Revelation 22 out of order can still be offered all four levels, but must not receive a reading-completion or mastery badge merely for reaching that boundary. Keep the existing **Only chapters marked read** filter effective, explain restricted coverage, and skip any scope with no eligible questions rather than silently widening it. Detect true reading completion separately from these boundary prompts.

Only an explicit individual chapter transition from unread to read triggers this flow. Importing/restoring progress, bulk marking, synchronization, reload, and marking a chapter unread must not launch quizzes. Repeated clicks or another open tab must not duplicate the same queue. Deliberately marking the chapter unread and then read can offer practice again, without duplicate first-learning rewards. If a quiz is already in progress, offer to resume it or save it before starting the reading quiz; never overwrite it or interrupt an answer. Save the queue and its current step across navigation/reload, and let the reader dismiss it. Turning the setting off stops new automatic prompts while existing saved quizzes remain manually accessible.

**Status:** Implemented as Stage 5 increment 2. Settings → Other includes the three options. Pending sequences are saved with quiz progress, support skip/resume/dismiss, and preserve existing sessions. Broader scopes use the saved quiz filters; empty pools are explicitly skipped. Final validation is recorded in the Stage 5 status file.

## Scopes and question selection

| Scope | Content | Selection approach |
|---|---|---|
| Chapter | People, places, actions, statements, sequence, vocabulary, and main content of that chapter | Cover distinct learning objectives; adapt to chapter density. |
| Book | Questions drawn from its chapters plus dedicated book-wide questions | Rotate through chapters and cover the book's major sections; include connections across chapters. |
| Old or New Testament | Chapter/book material plus testament-wide questions | Rotate through books, include broad relationships, and avoid repeatedly favoring the longest books. |
| Whole Bible | Material from every scope plus explicitly supported cross-testament connections | Cover both testaments and all books over successive sessions. |

A book or Bible quiz is a sample, not proof of complete scope mastery. Its results contribute to the same underlying objectives as chapter quizzes. Answering a Genesis question in a whole-Bible session should advance Genesis progress once, not generate a duplicate achievement.

Broad sessions should prioritize due review and less-covered areas while still offering variety. With too few slots to represent every book, rotate coverage across sessions rather than implying that a 10-question quiz comprehensively tests the Bible. Start with a transparent mix such as roughly half fresh objectives and half review, redistributing when either pool is empty.

All scopes and difficulties remain accessible. An optional **Only chapters marked read** filter uses existing reading progress, but reading is not a prerequisite for taking a quiz.

## Difficulty and formats

Difficulty describes the knowledge or reasoning required, separately from the question format. Multiple choice can be hard; a short written answer can be easy.

| Level | Purpose | Suitable questions |
|---|---|---|
| Easy | Recognize the chapter's essential content | Identify a person, place, action, speaker, or stated fact. |
| Medium | Recall details and understand their immediate context | Match speakers to statements, distinguish similar events, identify an explicitly stated reason, or complete a short phrase. |
| Hard | Connect and distinguish several textual facts | Reconstruct an explicit sequence, match similar passages to their contexts, or compare information across cited chapters. |

Include **single-answer multiple choice**, **short-answer recall with reviewed accepted answers**, and **matching/ordering** in the initial interaction prototype. Also prototype one timeline, genealogy, and map exercise before scaling their content. An event-ordering question must have an explicit textual order; do not grade debated cross-book chronology as settled fact. Book ordering instead follows the app's KJV table of contents and must be labeled accordingly.

Avoid making questions harder merely through obscure spelling, trick wording, or ambiguous distractors. Exact verse-number recall and exact KJV wording belong in a clearly labeled **Memory practice** option, not a hidden requirement for general comprehension.

Example content boundaries:

- Easy, Genesis 1: what God calls the light. Evidence: Genesis 1:5.
- Medium, Genesis 1: distinguish the day light appears from the day the sun and moon are described. Evidence: Genesis 1:3–5, 14–19.
- Hard, Genesis: given passage excerpts with enough context, match the land promises to Abraham, Isaac, and Jacob. Evidence: Genesis 12:7; 26:3; 28:13. This tests the recipients and contexts, not memorization of verse numbers.

Use readable modern American English in prompts and explanations, KJV spellings for names, and exact KJV wording when quoting. Accept appropriate modern equivalents in ordinary short answers; distinguish those from exact-wording memory exercises. Normalize case, surrounding whitespace, and nonessential punctuation. Do not accept arbitrary fuzzy matches that could turn a different person's name or an incorrect number into a correct answer.

## Vocabulary and interactive exercises

Vocabulary is a core part of the curriculum, available both within the selected chapter and as a dedicated practice set. Broader scopes collect the relevant vocabulary without repeatedly awarding credit for the same word sense.

**Vocabulary scope:** Include any word or expression likely to be unfamiliar to a modern reader, whether or not it is archaic or distinctive to the KJV. This includes uncommon English words, specialized biblical terms, and words of Hebrew or Greek origin appearing in the English text. Terms also used in other translations remain eligible. Cover objects and garments (such as **ephod**), religious offices and practices, customs, measures, money, and unfamiliar theological language. Select vocabulary for its usefulness in understanding the passage, not its age or language of origin. Readers do not need to learn Hebrew or Greek to complete these exercises.

| Skill | Example exercise | Scope and grading |
|---|---|---|
| KJV vocabulary | Match **kine** with cows; identify **conversation** as conduct or manner of life in its passage; explain **prevent** as precede in its passage. | Cite Genesis 41:2, Philippians 1:27, and 1 Thessalonians 4:15 respectively. Test meaning in context, not a universal substitution for every occurrence. |
| Biblical terms | Identify an **ephod** among the priestly garments described in the passage; explain an unfamiliar object or practice in plain English. | For this example, cite Exodus 28:4–12. Explain the use established by the passage; do not assume every occurrence refers to the same material or design. |
| Weights and measurements | Explain **ephah**, **hin**, **furlong**, and **span**; distinguish capacity from length and weight; match a measure to an approximate modern equivalent. | Include other relevant units such as cubit, bath, shekel, and talent. Preserve the KJV term, identify its use in the passage, and distinguish textual unit relationships from historically estimated modern conversions. |
| Bible structure | Drag a shuffled group of books into KJV order; place a missing book between its neighbors; sort books into Old and New Testaments. | Whole-Bible/testament practice. Use the shipped 66-book sequence as evidence. Book order is not the chronological order of the events in those books. |
| Chapter sequence | Place creation-day event cards into numbered positions. | Genesis 1 covers days one through six; an exercise including the seventh day must include Genesis 2:1–3 in its scope. |
| Timeline relationships | Arrange explicitly ordered events, place an event before/after another, or match an event to a stated duration. | Chapter, book, and broader scopes. Prefer relative order and textually stated durations. Estimated historical dates stay out of scored exercises in the initial release; any later model-specific practice must identify its assumptions explicitly. |
| Genealogy | Place people into a small family tree; match parent/child relationships; identify a missing ancestor. | Use cited, explicit relationships and stable person identities. Distinguish parents, spouses, children, and more distant ancestors. |
| Geography | Match place names to a simple map, select a region, or place stops along an explicitly described journey. | Use reviewed locations and routes, with passage evidence for the biblical association and geographic sourcing for the map position. |

**Modern measurement equivalents:** Show the original term with a concise explanation and, where supportable, an approximate modern equivalent. Default to familiar U.S. customary units with metric alongside (for example, inches/centimeters, miles/kilometers, U.S. gallons/liters, or pounds/kilograms as appropriate). Label dry versus liquid capacity and avoid ambiguous gallon or ounce labels. Use rounded estimates or ranges when historical standards vary; do not imply one universal exact conversion across all passages. Record the conversion source, applicable standard, and uncertainty in the content data, while keeping reader-facing explanations brief. Biblical statements of relationships between units take priority over external estimates. Teach what the measure represents and its practical scale; do not require memorizing disputed conversion values. If an exercise asks for a numerical conversion, supply the assumed conversion and accept reasonable rounding. Keep weight distinct from monetary value where a term such as shekel or talent occurs in a financial context; do not present a fixed modern currency equivalent.

**Vocabulary progression:** Easy questions recognize a meaning in a quoted passage; Medium questions recall a modern equivalent, explain a term's function, or distinguish similar senses; Hard questions compare two contexts where the same word has different uses or interpret a longer expression. Include archaic words, familiar words whose meanings have shifted, uncommon current words, specialized biblical terms, and unfamiliar phrases. Preserve the original KJV wording and explain it in modern American English. Use the existing word-book and dictionary resources as authoring leads, checking definitions and any usage rights before incorporating their wording. Distinguish a term's contextual meaning from its etymology; a word's origin alone does not establish what it means in a particular passage.

Each vocabulary objective identifies a **word or phrase, its sense, and its cited context**. A correct answer for one sense must not automatically master every occurrence of the word. Do not let an automatically displayed dictionary tooltip reveal the answer before submission; opening an in-app definition or hint marks the attempt assisted. In ordinary comprehension questions, explanatory glosses remain appropriate.

**Book and event ordering:** Start with manageable groups of 4–8 cards, with smaller groups for simple exercises. Build toward an optional full-testament or 66-book challenge through saved sections, not a requirement to drag 66 cards around a phone screen. Keep book arrangement, narrative presentation order, and historical event order explicitly distinct. Where Scripture establishes only some before/after relationships, accept every arrangement satisfying those relationships; never impose an invented order on unrelated or simultaneous events.

**Genealogy:** Start with small trees, clear relationship labels, and a limited choice pool. People sharing a name need passage/context labels. Do not combine distinct people or treat a place with the same name as a person. Unknown parentage, estimated lifespan dates, and unresolved lineage interpretations cannot become unqualified right/wrong answers.

**Maps:** Prefer lightweight quiz-specific maps with only the labels necessary to understand the task. Hide answer-revealing labels and overlays until submission. Use selectable regions or markers with generous hit areas, not pixel-perfect coordinate entry. If a location is disputed, test a broader established relationship or omit it from scored geography. Route ordering must follow the cited journey, not the shortest route calculated by a map service. Provide an accessible text/region-matching version assessing the same intended relationship. Download required maps with the question pack so a quiz does not depend on a live map service.

**Interaction and scoring:** Dragging is optional. Every sorting or placement exercise also supports selecting a card and its destination, keyboard movement, and clearly labeled move controls. Announce positions and successful moves to screen readers; provide Undo and Reset Arrangement. Only Submit grades an arrangement, so correcting a drag before submission is not an additional attempt. Save partial arrangements when the reader leaves.

Give useful partial feedback on a submitted composite exercise, such as four of six placements correct, but specify its mastery rule in advance. A composite objective requires a fully correct submission; an exercise assessing several separately authored objectives can award evidence only for the correctly answered components. Do not create automatic new objectives for every possible ordering pair or inflate points based on the number of draggable pieces. Equivalent text and visual formats share objective IDs and rewards.

## Practice and assessment

**Practice** provides feedback after submission, a concise explanation, and clickable verse evidence. Readers may request a hint, reveal the answer, or skip. Track assisted answers separately. Incorrect items reappear after intervening questions or in a later review, rather than immediately teaching the reader to click the same option.

**Assessment** gives feedback after the session. It uses first submissions, has no hints, and permits returning to unanswered items before final submission. Leaving the page saves it. Do not impose a timer by default. Since the Bible remains accessible elsewhere in the app, call these unassisted attempts according to in-app assistance use, not a guaranteed closed-book examination.

Offer 5, 10, 20, or 30 questions, capped at the distinct eligible exercises available. Avoid retesting an objective through sibling variants or overlapping composite exercises within one scored session. Save the selected question versions, order, shuffled choices, answers, placements, and mode so resuming does not change the test or its score. Report exercise completion separately from the number of learning objectives assessed.

Results show accuracy, assistance used, newly learned objectives, newly earned mastery, and what to review next. Assessment skips count as unanswered in its score; practice skips stay unlearned without a punitive point deduction.

## Comprehensive coverage and content volume

The shipped KJV contains **31,102 verses**, with **929 Old Testament chapters and 260 New Testament chapters**. Verse count is a useful first estimate of content size, but a short, dense chapter may warrant more questions than a long repeated list.

Plan coverage around **learning objectives**: distinct facts or relationships worth knowing. Multiple question variants may test one objective; variants do not increase coverage or mastery totals.

| Chapter type | Initial authoring guideline for distinct objectives |
|---|---:|
| Very short or narrowly focused | 3–6, fewer if the text cannot support meaningful distinctions |
| Typical chapter | 10–18 |
| Long or dense chapter | 20–35 |
| Exceptional chapter, such as Psalm 119 | 40–60, divided among its sections |

These are editorial guidelines, not quotas. A comprehensive planning envelope is roughly **12,000–25,000 chapter-level objectives**, followed by alternate question forms. Add approximately **5–15 book-wide objectives per book** and **50–150 broader testament/Bible objectives combined**, with substantial books receiving more where warranted. The pilot must refine these estimates; this is not a promise that every verse needs its own question.

Track each chapter's major sections, people/events, principal statements, vocabulary, and relevant distinctions in an editorial coverage checklist. Include ordering, genealogy, and geography where the text supports worthwhile questions; not every chapter needs every format. Review narrative, law, poetry, genealogies, prophecy, and letters differently. Explicitly record justified omissions instead of filling quotas with repetitive trivia. The volume estimates include these skill categories rather than adding a duplicate vocabulary or visual-question bank on top.

**Cover the whole Bible broadly before extensively deepening individual books.** A first coverage pass might average 6–10 meaningful objectives per chapter, roughly 7,000–12,000 total, with exceptions for very short chapters. Deeper coverage and variants follow. Always distinguish authored content coverage from learner progress.

## Mastery that is achievable and meaningful

Track progress by objective and difficulty, with these initial rules proposed for the pilot:

| State | Requirement |
|---|---|
| Not started | No submitted attempt. |
| Practicing | Attempted, but not yet answered correctly without assistance. |
| Learned | One correct first submission without a hint or revealed answer. |
| Mastered | Two correct unassisted first submissions in separate sessions at least seven days apart; use different reviewed variants when available. |

The seven-day interval is a product starting point to test, not a scientifically established threshold for Bible mastery. A single assessment cannot award durable mastery of an entire book. Do not require unavailable variants: one-question objectives remain eligible through delayed recall, while clearly recording variant coverage.

Maintain **earned mastery** and **review status** separately. A later mistake or overdue review marks an objective for practice without removing its earned milestone. Show current review needs beside mastery, so old achievements do not imply perfect current recall. Begin with a simple review schedule: missed items next session; a first successful recall after one day; subsequent reviews after seven and thirty days. Only qualifying attempts at least seven days apart award mastery.

Chapter mastery means all its applicable published objectives are mastered. Book mastery also requires its dedicated book-wide objectives; testament and whole-Bible mastery additionally require their broader objectives. Deduplicate objectives before calculating totals. Difficulty filters change the displayed subset, not the underlying all-level achievement.

The mastery page shows:

- Overall mastered objectives and percentage, with the question-bank version.
- Separate Easy, Medium, and Hard progress.
- Skill breakdowns for Vocabulary, Bible Structure, Event Sequence, People and Family, Geography, and Passage Comprehension. An objective may appear in several breakdowns but counts once overall.
- Expandable testament, book, and chapter rows, similar to reading progress.
- Learned but not yet mastered objectives, missed items, and reviews due.
- Content availability, such as **Questions available for 80 of 1,189 chapters**.

Do not show 100% Bible mastery while content is unpublished. Say **100% of available objectives mastered** instead. Once a coverage release includes every chapter, award its completion badge; later added content can increase the denominator while the earned versioned badge remains. “Mastery” measures this quiz curriculum, not spiritual standing or exhaustive knowledge of Scripture.

**Stage 5 implementation:** Progress now groups objectives under Bible → testament → book → chapter, with skill/difficulty filters and scoped practice/review. Cross-context objectives belong to the smallest eligible scope containing their passages. The first frozen coverage release is `coverage-2026-10-26`, containing 8,965 distinct objectives. Learned and Mastered badges replay from backed-up attempts; display filters and later mistakes never remove awards. Parents require complete chapter coverage plus all published broader objectives. Badge history adds no points. When publishing another release, append a new immutable manifest under `src/lib/quiz/releases/` and register it in `releases.ts`; retain earlier manifests and their membership. The manifest test pins the first release's checksum and validates its membership.

## Rewards

Use rewards to recognize learning and persistence:

- Award **10 / 20 / 30 points** for first learning an Easy / Medium / Hard objective. Variants do not award the first-learning reward again.
- Award a small **5-point review bonus** once per objective per day for a correct due review. Immediate retries do not earn repeat bonuses.
- Give chapter-completion, book-completion, testament, and whole-Bible badges, with separate recognition for learned and mastered coverage.
- Add cumulative milestones such as 100 objectives learned or 10 chapters mastered. Offer a gentle, optional practice streak; skipping a day never removes points or mastery.
- Include skill milestones such as KJV vocabulary learned, testament book order mastered, and reviewed family/geography sets completed. Accessible alternative formats earn identical rewards.
- Reuse the app's completion celebration where practical, respecting reduced motion and a celebration preference.

**Implemented rewards:** Quiz → Progress → Practice rewards includes opt-in streaks, skill and memory milestones, and complete book-order achievement status. Streaks count local calendar days with non-skipped submitted answers, including wrong/assisted practice; assessments count on finish. They preserve best streaks and do not change points/mastery. Both streak display and quiz celebrations default off and synchronize between Settings → Other and Quiz views. Celebrations use the shared reading confetti, suppress animation for reduced motion, and trigger only from a successful explicit finish in the current view. Imports/reloads never trigger them. Skill milestones and cumulative milestones (up to 5,000 learned) derive from existing objective evidence; new learning/mastery in completion summaries is attributed to the actual earning session. Preferences remain local; backups restore progress-derived rewards.

Keep mastery independent of points: repeating easy questions cannot replace unfinished harder objectives. Rewards are local and personal. Accounts, public rankings, competitive anti-cheat systems, paid rewards, and forced difficulty unlocks are outside the initial scope.

## Content accuracy and review

Every published question needs stable objective IDs, a precise prompt, correct answer or permitted solution constraints, explanation, difficulty, and appropriate evidence. Biblical claims require valid KJV references; canonical book-order questions cite the app's edition/catalog order; geographic positions also require reviewed geographic sourcing. Vocabulary questions require a checked context-specific definition. Distractors must be demonstrably incorrect for the question as phrased. Avoid questions that treat disputed dates, prophetic models, or unstated identifications as facts.

Use the shipped KJV as the primary source. Existing summaries can help identify coverage gaps, but cannot serve as the sole evidence for an answer. Cross-references, genealogy, and timeline data are leads that must be checked against the actual verses. The unconfirmed prophetic dates in our research must not become quiz answers.

Author and review content before publication; no live AI-generated questions or AI grading is required in the app. Use this workflow:

1. Outline each chapter's objectives and coverage.
2. Draft questions, accepted answers, explanations, and distractors.
3. Validate references, quotations, IDs, duplicate objectives, and answer structures automatically.
4. Independently review factual accuracy, ambiguity, KJV spellings, and difficulty.
5. Publish only reviewed content and maintain a correction history.

A “Report a problem” action should create a copyable question ID and feedback summary for the existing support route; do not add a submission service merely for the pilot. Corrected questions get explicit versions. A materially changed answer invalidates that question's old mastery evidence and schedules a recheck; cosmetic edits preserve it. Keep earned historical badges and explain any affected progress.

## Implementation fit and persistence

The app already shares panel/sidebar destinations through `src/lib/panel-home.ts` and `PanelHome`. Add a quiz view to the existing panel/sidebar navigation, title/icon mapping, layout persistence, and restoration validation. Lazy-load the quiz page and its data, following the existing heavy-tool approach. Keep current reading progress unchanged.

Use a versioned question-bank manifest and book-sized data packs, plus separate packs for broader questions. Include counts and coverage metadata so setup and progress do not require loading the complete bank. Download a selected session's required packs before it starts; integrate pack availability and removal with the existing offline-download interface. Offline setup must show which scopes are available, and a started session must remain usable offline.

Separate three records:

| Record | Essential information |
|---|---|
| Question content | Question/objective IDs, skill tags, scope and chapter links, difficulty, format, answer IDs or accepted text, references, explanation, review status, content version. Vocabulary also stores sense IDs; visual questions store placement targets, allowed relationships/orders, map assets/accepted regions, person/place IDs, and an accessible equivalent. |
| Attempt evidence | Unique attempt ID, question/version, first submitted answer or arrangement, per-objective grading, correctness, assistance, timestamp, session ID. |
| Session and derived progress | Frozen session selection/order, current position, answers, per-objective learning/mastery dates, review due dates, reward ledger, bank version. |

Use IndexedDB for sessions and growing attempt/progress records; reuse the app's storage-protection and failure-notification patterns. Reading progress currently uses a smaller synchronized local-storage set, which should not be expanded into a large answer-history log. Persist an answer and its reward atomically, deduplicate repeated submissions, and notify other tabs after a successful write.

Support several separate quiz sessions across panels, but opening the same session elsewhere should resume it with one active editor. Another tab can show that it is already open and offer to take over. Navigation and reload must not duplicate rewards or lose submitted answers. If saving fails, preserve the in-memory answer, show that it is unsaved, and allow retry/export.

Provide a versioned quiz-progress export/import, validated before changes are applied. Merge by stable IDs without double-counting rewards; explicitly confirm replacing or resetting progress. Explain that local-only progress is device/browser-specific and browser data clearing can remove it. No server or account is needed for the initial feature.

## Delivery stages

| Stage | Deliverable and review gate |
|---|---|
| 1. Interaction and content pilot | A standalone prototype in `design/`, 8–12 representative chapters across narrative, law, poetry, genealogy, prophecy, and letters; about 100–200 reviewed objectives. Include dedicated vocabulary, book ordering, creation-day ordering, one relative timeline, one small family tree, and one map exercise, with accessible alternatives. Review question quality, session length, difficulty, and rewards before scaling. |
| 2. App foundation | Home buttons, shared quiz page, all scope/skill selectors, Practice and Assessment, vocabulary and matching/ordering, autosave/resume, evidence links, local progress, basic rewards, backup, and offline packs. Integrate timeline/tree/map interactions once their pilot designs pass review. Clearly mark content not yet available. |
| 3. Broad Bible coverage | **Done — 66 books, 1,189 chapters, 8,357 reviewed objectives.** Publish reviewed batches covering all 66 books and 1,189 chapters. Track chapters remaining and avoid concentrating the entire early bank in Genesis. Prioritize at least representative coverage in every book, then complete chapters. |
| 4. Depth and broader understanding | **Done — 608 new reviewed objectives and six shared-credit alternate forms.** Completed the planned dense-chapter reviews, all 66 book-depth reviews, vocabulary and broader-scope expansion, visual formats, and editorial difficulty adjustments. Totals: 357 book exercises, 57 testament/Bible exercises, 146 vocabulary objectives, 35 timelines, 142 matches, eight family trees, and 12 maps. Completion records distinguish this reviewed depth pass from exhaustive future coverage. |
| 5. Full mastery path | **Main deliverables complete and verified.** Spaced reviews, optional quizzes after reading, release-specific badges, hierarchical mastery, 12 optional KJV verse-memory exercises, and full 39/27/66-book ordering challenges. Optional streaks, skill milestones, book-order achievements, and reduced-motion-aware completion celebrations are implemented and verified. See [Stage 5 status](quiz-stage5-status.md). |

Basic progress recording and the objective/version model belong in Stage 2 even if the richer mastery display comes later. Content authoring and independent review are likely the largest ongoing effort; estimate their throughput from the pilot before promising a completion date. Technical completion and question-bank completion should be reported separately.

### Optional challenges implemented

Quiz → Start → Optional challenges provides a reviewed starter set of 12 complete KJV verses and complete Old Testament (39), New Testament (27), and Bible (66) book-order lists. These are explicit opt-ins, not normal quiz/after-reading questions. Memory checks exact words in order while ignoring capitalization, punctuation, and extra whitespace; reading the passage or revealing the answer marks the attempt assisted. Long ordering lists support direct position entry as well as drag/up/down controls. They reuse saved sessions, backup, points, and spaced review. Mastery explorer defaults to core quizzes and has separate optional exercise sets. All 8,971 prior forms are unchanged; totals are 8,980 objectives in 8,986 forms. The frozen 8,965-objective release still governs existing completion badges. More independently reviewed memory passages can be added later.

## Question quality follow-up (2026-10-31)

The accuracy assessment identified answer cues that need a separate editorial pass. Broad coverage is complete; distractor quality is still being improved. The first four reviewed corrections address the John 15 prompt and the highlighted Numbers 31, Deuteronomy 29, and Matthew 4 examples.

- **Severe-case review completed:** independently reviewed all 872 remaining severe answer-length cases and 15 additional absolute-word cases. Published 886 distractor/prompt revisions plus the separately corrected Pashur answer, across 57 books. Severe flags fell from 872 to 0, answers over 1.5 times the longest alternative from 2,165 to 1,279, and all-absolute distractor sets from 454 to 371.
- **Done — factual correction:** `24-20-2` now distinguishes household captivity from the death-and-burial statement naming Pashur and his friends (Jeremiah 20:6). Its full original choice set and key are retained in `previousChoiceEditions`. New quizzes use the corrected answer; old saved quizzes retain their original grading and show the correction in feedback/reveal-answer. The learning objective and its version remain stable, preserving earned rewards and release badges. Historical keys are valid only for their exact recognized option sets, never as alternate current answers.
- Run `npm run check:quiz-quality` to refresh `reports/quiz-quality-current.json`. The remaining 1,583 flagged questions form an editorial queue, not a count of factual errors. Continue with moderate length differences and absolute wording in subsequent editorial batches. Both uniquely longest and uniquely shortest answers are monitored so balancing does not merely reverse a cue.
- Use plausible alternatives from the relevant passage or setting, with comparable detail and grammatical form. Do not pad options, strip legitimate biblical absolutes, or force a statistical quota. Verify every alternative is unambiguously wrong as phrased and obtain an independent KJV content review before publishing each batch.
- The aggregate cue ceilings in `scripts/quiz-quality.test.mjs` run in the normal test suite. Tighten them as batches land. They detect overall regression, not individual accuracy, and do not replace review of new or changed questions.
- For distractor-only changes, retain the exact old option set in `previousChoices`. Keep the answer, objective, version, and earned credit stable. Old sessions retain their displayed choices; new sessions use the revised choices. Never delete published historical sets. A narrow factual wording correction to the same objective can retain a complete old key/set in `previousChoiceEditions` with a reader-facing correction. Changes to what an objective assesses still need a separate objective-version/migration decision.
- After each batch, run quiz tests (including choice-history and full KJV evidence checks), record independent review, and regenerate the queue. No earned progress or mastery badges are reset because of this audit.

## Future extension: KJV history and translation background

**Deferred.** Consider a separate KJV background question set after reviewing the facts on the “Why KJV Only?” page. Possible subjects include first publication, who commissioned the translation, the translators and their working groups, and the translation process. Verify counts carefully: appointed scholars, actual participants, and committee membership may describe different groups.

Before authoring questions, check that page against reliable historical sources and correct or qualify unsupported claims. Keep documented historical facts distinct from theological positions and disputed claims; neither advocacy nor an unverified number should become a scored answer. These questions need historical citations and a clearly labeled background scope, rather than being presented as facts stated in the biblical text. This extension is not part of the current Stage 4 batch.

## Acceptance checks

- The same Quiz destination works in panels, tabs, and the sidebar; Home and mobile dismissal preserve a session.
- Every scored answer has valid evidence and an unambiguous grading rule; no unreviewed content is selected.
- Refresh, offline use, multiple tabs, repeated submission, export/import, and storage failure do not lose answers or duplicate rewards.
- Scope sampling respects requested books, skills, difficulty, available content, and the optional read-chapter filter. Cross-chapter exercises require all of their cited chapter contexts to qualify for that filter.
- Progress distinguishes reading, authored coverage, learned objectives, earned mastery, and review needs.
- With Quiz after reading enabled, verify ordinary chapters, book endings, Malachi 4, and Revelation 22 offer the intended scopes in order. Verify Off/Chapter only settings, out-of-order reading, the read-chapter filter, empty pools, skip/resume, existing sessions, repeated clicks, and multiple tabs. Imports, bulk updates, reload, and synchronization must not launch quizzes or duplicate queues/rewards; reading remains marked read even when quizzes are declined.
- Answer options work on narrow mobile screens and by keyboard; feedback is announced accessibly and is not conveyed by color alone. Every sorting, tree, timeline, and map exercise has a non-drag accessible alternative with equivalent scoring.
- Vocabulary grading distinguishes word senses; ordering accepts every permitted solution; maps accept the defined region; family trees preserve person identity and relationship type. Saving and resuming preserves unfinished placements.
- The large bank does not delay reader startup; only needed content is loaded, and offline packs report their size before download.

## Recommended approval scope

Approve **Stage 1 first**, using Quiz as the name, all four scope levels, three difficulty levels, dedicated KJV vocabulary, interactive ordering/timeline/genealogy/map examples, short sessions, cited KJV answers, personal points/badges, and separate reading/quiz progress. Review the prototype before approving bulk authoring or application integration.

The main choices to revisit during that review are how strict mastery should be, how much short-answer recall to require, the desired visibility of rewards, and whether exact-wording memory practice belongs in the first release. The defaults above make these reviewable without requiring every detail to be settled before the pilot.
