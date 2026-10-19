#!/usr/bin/env python3
"""Import OSIS XML into SQLite and reader JSON.

This script expects an OSIS source file (for example, from a CrossWire/SWORD
OSIS package) and produces:
1) A normalized SQLite database for advanced search.
2) A JSON file optimized for the basic reader UI.
"""

from __future__ import annotations

import argparse
import json
import re
import sqlite3
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from pathlib import Path
from typing import Any


BOOK_ORDER = [
    "Gen",
    "Exod",
    "Lev",
    "Num",
    "Deut",
    "Josh",
    "Judg",
    "Ruth",
    "1Sam",
    "2Sam",
    "1Kgs",
    "2Kgs",
    "1Chr",
    "2Chr",
    "Ezra",
    "Neh",
    "Esth",
    "Job",
    "Ps",
    "Prov",
    "Eccl",
    "Song",
    "Isa",
    "Jer",
    "Lam",
    "Ezek",
    "Dan",
    "Hos",
    "Joel",
    "Amos",
    "Obad",
    "Jonah",
    "Mic",
    "Nah",
    "Hab",
    "Zeph",
    "Hag",
    "Zech",
    "Mal",
    "Matt",
    "Mark",
    "Luke",
    "John",
    "Acts",
    "Rom",
    "1Cor",
    "2Cor",
    "Gal",
    "Eph",
    "Phil",
    "Col",
    "1Thess",
    "2Thess",
    "1Tim",
    "2Tim",
    "Titus",
    "Phlm",
    "Heb",
    "Jas",
    "1Pet",
    "2Pet",
    "1John",
    "2John",
    "3John",
    "Jude",
    "Rev",
]

BOOK_NAMES = {
    "Gen": "Genesis",
    "Exod": "Exodus",
    "Lev": "Leviticus",
    "Num": "Numbers",
    "Deut": "Deuteronomy",
    "Josh": "Joshua",
    "Judg": "Judges",
    "Ruth": "Ruth",
    "1Sam": "1 Samuel",
    "2Sam": "2 Samuel",
    "1Kgs": "1 Kings",
    "2Kgs": "2 Kings",
    "1Chr": "1 Chronicles",
    "2Chr": "2 Chronicles",
    "Ezra": "Ezra",
    "Neh": "Nehemiah",
    "Esth": "Esther",
    "Job": "Job",
    "Ps": "Psalms",
    "Prov": "Proverbs",
    "Eccl": "Ecclesiastes",
    "Song": "Song of Solomon",
    "Isa": "Isaiah",
    "Jer": "Jeremiah",
    "Lam": "Lamentations",
    "Ezek": "Ezekiel",
    "Dan": "Daniel",
    "Hos": "Hosea",
    "Joel": "Joel",
    "Amos": "Amos",
    "Obad": "Obadiah",
    "Jonah": "Jonah",
    "Mic": "Micah",
    "Nah": "Nahum",
    "Hab": "Habakkuk",
    "Zeph": "Zephaniah",
    "Hag": "Haggai",
    "Zech": "Zechariah",
    "Mal": "Malachi",
    "Matt": "Matthew",
    "Mark": "Mark",
    "Luke": "Luke",
    "John": "John",
    "Acts": "Acts",
    "Rom": "Romans",
    "1Cor": "1 Corinthians",
    "2Cor": "2 Corinthians",
    "Gal": "Galatians",
    "Eph": "Ephesians",
    "Phil": "Philippians",
    "Col": "Colossians",
    "1Thess": "1 Thessalonians",
    "2Thess": "2 Thessalonians",
    "1Tim": "1 Timothy",
    "2Tim": "2 Timothy",
    "Titus": "Titus",
    "Phlm": "Philemon",
    "Heb": "Hebrews",
    "Jas": "James",
    "1Pet": "1 Peter",
    "2Pet": "2 Peter",
    "1John": "1 John",
    "2John": "2 John",
    "3John": "3 John",
    "Jude": "Jude",
    "Rev": "Revelation",
}

BOOK_INDEX = {code: i + 1 for i, code in enumerate(BOOK_ORDER)}


@dataclass
class Token:
    text: str
    strongs: list[str]
    lemma: str | None
    morph: str | None
    added: bool
    divine_name: bool
    red_letter: bool


def local_tag(tag: str) -> str:
    if "}" in tag:
        return tag.split("}", 1)[1]
    return tag


def parse_int_suffix(value: str) -> int | None:
    match = re.search(r"(\d+)", value)
    return int(match.group(1)) if match else None


def extract_strongs(value: str | None) -> list[str]:
    if not value:
        return []
    normalized = value.replace("strong:", "").replace("x-Strongs:", "")
    strongs: list[str] = []
    seen: set[str] = set()
    for match in re.finditer(r"([HG]\d{1,5})", normalized, flags=re.IGNORECASE):
        strong = match.group(1).upper()
        if strong[1:].isdigit():
            strong = f"{strong[0]}{int(strong[1:])}"
        if strong not in seen:
            seen.add(strong)
            strongs.append(strong)
    return strongs


def normalize_ref_value(value: str | None) -> str | None:
    if not value:
        return None
    return " ".join(value.split())


def flatten_text(elem: ET.Element) -> str:
    parts: list[str] = []
    if elem.text:
        parts.append(elem.text)

    for child in list(elem):
        parts.append(flatten_text(child))
        if child.tail:
            parts.append(child.tail)

    return " ".join(" ".join(parts).split())


def parse_note(note_elem: ET.Element) -> dict[str, Any]:
    note_type = note_elem.attrib.get("type") or "unknown"
    catch_word: str | None = None
    readings: list[dict[str, str]] = []

    for child in note_elem.iter():
        tag = local_tag(child.tag)
        if tag == "catchWord" and not catch_word:
            catch_word = normalize_ref_value(child.text)
        if tag == "rdg":
            rdg_type = child.attrib.get("type") or "unspecified"
            rdg_text = normalize_ref_value(flatten_text(child))
            if rdg_text:
                readings.append({"type": rdg_type, "text": rdg_text})

    note_text = normalize_ref_value(flatten_text(note_elem)) or ""
    payload: dict[str, Any] = {"type": note_type, "text": note_text}
    if catch_word:
        payload["catchWord"] = catch_word
    if readings:
        payload["readings"] = readings
    return payload


def is_red_quote(elem: ET.Element) -> bool:
    if local_tag(elem.tag) != "q":
        return False
    who = (elem.attrib.get("who") or "").lower()
    return "jesus" in who or "christ" in who or "messiah" in who


def tokenize(
    text: str | None,
    strongs: list[str],
    lemma: str | None,
    morph: str | None,
    added: bool,
    divine_name: bool,
    red_letter: bool,
) -> list[Token]:
    if not text:
        return []
    tokens: list[Token] = []
    for part in re.split(r"\s+", text.strip()):
        if not part:
            continue
        tokens.append(
            Token(
                text=part,
                strongs=strongs,
                lemma=lemma,
                morph=morph,
                added=added,
                divine_name=divine_name,
                red_letter=red_letter,
            )
        )
    return tokens


def parse_osis_ref(osis_id: str) -> tuple[str, int, int] | None:
    parts = osis_id.split(".")
    if len(parts) < 3:
        return None
    chapter_num = parse_int_suffix(parts[1])
    verse_num = parse_int_suffix(parts[2])
    if not chapter_num or not verse_num:
        return None
    return parts[0], chapter_num, verse_num


SKIP_TAGS = {"header"}


def collect_chapter_tokens(
    chapter_elem: ET.Element, osis_book: str, chapter_num: int
) -> dict[int, dict[str, Any]]:
    verses: dict[int, dict[str, Any]] = {}
    state = {"current_verse": None, "pending_paragraph_marker": None}

    def ensure_verse(verse_num: int) -> dict[str, Any]:
        if verse_num not in verses:
            verses[verse_num] = {
                "tokens": [],
                "notes": [],
                "paragraphStart": False,
                "paragraphMarker": None,
            }
        return verses[verse_num]

    def push_text(
        text: str | None,
        strongs: list[str],
        lemma: str | None,
        morph: str | None,
        added: bool,
        divine_name: bool,
        red: bool,
    ) -> None:
        current_verse = state["current_verse"]
        if current_verse is None:
            return
        verse_data = ensure_verse(current_verse)
        for token in tokenize(text, strongs, lemma, morph, added, divine_name, red):
            verse_data["tokens"].append(token)

    def visit(
        elem: ET.Element,
        red_context: bool,
        strongs_hint: list[str],
        lemma_hint: str | None,
        morph_hint: str | None,
        added_context: bool,
        divine_context: bool,
    ) -> None:
        tag = local_tag(elem.tag)

        if tag in SKIP_TAGS:
            return

        if tag == "note":
            current_verse = state["current_verse"]
            if current_verse is not None:
                verse_data = ensure_verse(current_verse)
                verse_data["notes"].append(parse_note(elem))
            return

        if tag == "milestone" and (elem.attrib.get("type") or "") == "x-p":
            marker = normalize_ref_value(elem.attrib.get("marker")) or "¶"
            current_verse = state["current_verse"]
            if current_verse is None:
                state["pending_paragraph_marker"] = marker
            else:
                verse_data = ensure_verse(current_verse)
                verse_data["paragraphStart"] = True
                verse_data["paragraphMarker"] = marker

        container_verse = False
        restore_verse = None

        if tag == "verse":
            e_id = elem.attrib.get("eID")
            if e_id:
                state["current_verse"] = None
                return

            osis_id = elem.attrib.get("osisID") or elem.attrib.get("sID")
            if osis_id:
                parsed = parse_osis_ref(osis_id)
                if parsed:
                    parsed_book, parsed_chapter, parsed_verse = parsed
                    if parsed_book == osis_book and parsed_chapter == chapter_num:
                        restore_verse = state["current_verse"]
                        state["current_verse"] = parsed_verse
                        verse_data = ensure_verse(parsed_verse)
                        pending_marker = state["pending_paragraph_marker"]
                        if pending_marker:
                            verse_data["paragraphStart"] = True
                            verse_data["paragraphMarker"] = pending_marker
                            state["pending_paragraph_marker"] = None
                        has_sid = "sID" in elem.attrib
                        has_direct_text = bool(elem.text and elem.text.strip())
                        has_children = len(list(elem)) > 0
                        # Non-milestone verse container: close when element ends.
                        container_verse = not has_sid or has_direct_text or has_children

        current_red = red_context or is_red_quote(elem)
        current_strongs = strongs_hint
        current_lemma = lemma_hint
        current_morph = morph_hint
        current_added = added_context
        current_divine = divine_context or tag == "divineName"

        if tag == "w":
            lemma_value = normalize_ref_value(elem.attrib.get("lemma"))
            current_lemma = lemma_value
            current_strongs = extract_strongs(lemma_value)
            current_morph = normalize_ref_value(elem.attrib.get("morph"))
        elif tag == "transChange" and (elem.attrib.get("type") or "").lower() == "added":
            current_added = True

        push_text(
            elem.text,
            current_strongs,
            current_lemma,
            current_morph,
            current_added,
            current_divine,
            current_red,
        )

        for child in list(elem):
            visit(
                child,
                current_red,
                current_strongs,
                current_lemma,
                current_morph,
                current_added,
                current_divine,
            )
            push_text(
                child.tail,
                current_strongs,
                current_lemma,
                current_morph,
                current_added,
                current_divine,
                current_red,
            )

        if container_verse:
            state["current_verse"] = restore_verse

    visit(chapter_elem, False, [], None, None, False, False)
    return verses


def parse_osis(input_path: Path) -> list[dict[str, Any]]:
    tree = ET.parse(input_path)
    root = tree.getroot()

    books: list[dict[str, Any]] = []

    for div in root.iter():
        if local_tag(div.tag) != "div":
            continue
        if div.attrib.get("type") != "book":
            continue

        osis_book = div.attrib.get("osisID") or div.attrib.get("n") or ""
        osis_book = osis_book.strip()
        if osis_book not in BOOK_INDEX:
            continue

        chapters_by_number: dict[int, dict[str, Any]] = {}

        for chapter in div.iter():
            if local_tag(chapter.tag) != "chapter":
                continue

            chapter_osis = chapter.attrib.get("osisID") or ""
            if "." not in chapter_osis:
                continue
            chapter_num = parse_int_suffix(chapter_osis.split(".", 1)[1])
            if not chapter_num:
                continue

            verses_by_number: dict[int, dict[str, Any]] = {}
            chapter_tokens = collect_chapter_tokens(chapter, osis_book, chapter_num)

            for verse_num, verse_data in chapter_tokens.items():
                tokens = verse_data["tokens"]
                if not tokens:
                    continue
                red_letter = any(token.red_letter for token in tokens)
                verses_by_number[verse_num] = {
                    "verse": verse_num,
                    "redLetter": red_letter,
                    "paragraphStart": bool(verse_data["paragraphStart"]),
                    "paragraphMarker": verse_data["paragraphMarker"],
                    "notes": verse_data["notes"],
                    "tokens": [
                        {
                            "text": token.text,
                            **({"strong": token.strongs[0]} if token.strongs else {}),
                            **({"strongs": token.strongs} if len(token.strongs) > 1 else {}),
                            **({"lemma": token.lemma} if token.lemma else {}),
                            **({"morph": token.morph} if token.morph else {}),
                            **({"added": True} if token.added else {}),
                            **({"divineName": True} if token.divine_name else {}),
                        }
                        for token in tokens
                    ],
                    "text": " ".join(token.text for token in tokens),
                    "tokenRows": [
                        {
                            "text": token.text,
                            "strong": token.strongs[0] if token.strongs else None,
                            "strongs": token.strongs,
                            "lemma": token.lemma,
                            "morph": token.morph,
                            "added": token.added,
                            "divineName": token.divine_name,
                            "redLetter": token.red_letter,
                        }
                        for token in tokens
                    ],
                }

            if verses_by_number:
                chapters_by_number[chapter_num] = {
                    "chapter": chapter_num,
                    "verses": [verses_by_number[n] for n in sorted(verses_by_number)],
                }

        if chapters_by_number:
            books.append(
                {
                    "osisID": osis_book,
                    "name": BOOK_NAMES.get(osis_book, osis_book),
                    "order": BOOK_INDEX[osis_book],
                    "testament": "ot" if BOOK_INDEX[osis_book] <= 39 else "nt",
                    "chapters": [
                        chapters_by_number[n] for n in sorted(chapters_by_number)
                    ],
                }
            )

    books.sort(key=lambda book: book["order"])
    return books


def write_sqlite(db_path: Path, books: list[dict[str, Any]]) -> None:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")

    conn.executescript(
        """
        DROP TABLE IF EXISTS verse_fts;
        DROP TABLE IF EXISTS verse_notes;
        DROP TABLE IF EXISTS token_strongs;
        DROP TABLE IF EXISTS tokens;
        DROP TABLE IF EXISTS verses;
        DROP TABLE IF EXISTS chapters;
        DROP TABLE IF EXISTS books;

        CREATE TABLE books (
          id INTEGER PRIMARY KEY,
          osis_id TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          testament TEXT NOT NULL,
          book_order INTEGER NOT NULL
        );

        CREATE TABLE chapters (
          id INTEGER PRIMARY KEY,
          book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
          chapter_num INTEGER NOT NULL,
          UNIQUE(book_id, chapter_num)
        );

        CREATE TABLE verses (
          id INTEGER PRIMARY KEY,
          chapter_id INTEGER NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
          verse_num INTEGER NOT NULL,
          text TEXT NOT NULL,
          paragraph_start INTEGER NOT NULL DEFAULT 0,
          paragraph_marker TEXT,
          red_letter INTEGER NOT NULL DEFAULT 0,
          UNIQUE(chapter_id, verse_num)
        );

        CREATE TABLE tokens (
          id INTEGER PRIMARY KEY,
          verse_id INTEGER NOT NULL REFERENCES verses(id) ON DELETE CASCADE,
          token_index INTEGER NOT NULL,
          token_text TEXT NOT NULL,
          strong TEXT,
          lemma TEXT,
          morph TEXT,
          added INTEGER NOT NULL DEFAULT 0,
          divine_name INTEGER NOT NULL DEFAULT 0,
          red_letter INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE token_strongs (
          token_id INTEGER NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
          position INTEGER NOT NULL,
          strong TEXT NOT NULL,
          PRIMARY KEY(token_id, position),
          UNIQUE(token_id, strong)
        );

        CREATE TABLE verse_notes (
          id INTEGER PRIMARY KEY,
          verse_id INTEGER NOT NULL REFERENCES verses(id) ON DELETE CASCADE,
          note_index INTEGER NOT NULL,
          note_type TEXT NOT NULL,
          catch_word TEXT,
          note_text TEXT NOT NULL,
          readings_json TEXT
        );

        CREATE VIRTUAL TABLE verse_fts USING fts5(
          reference,
          text
        );

        CREATE INDEX idx_books_order ON books(book_order);
        CREATE INDEX idx_chapters_book_chapter ON chapters(book_id, chapter_num);
        CREATE INDEX idx_verses_chapter_verse ON verses(chapter_id, verse_num);
        CREATE INDEX idx_tokens_verse_token ON tokens(verse_id, token_index);
        CREATE INDEX idx_tokens_strong ON tokens(strong);
        CREATE INDEX idx_token_strongs_strong ON token_strongs(strong);
        CREATE INDEX idx_tokens_divine_name ON tokens(divine_name);
        CREATE INDEX idx_notes_verse ON verse_notes(verse_id, note_index);
        """
    )

    for book in books:
        book_cur = conn.execute(
            "INSERT INTO books (osis_id, name, testament, book_order) VALUES (?, ?, ?, ?)",
            (book["osisID"], book["name"], book["testament"], book["order"]),
        )
        book_id = int(book_cur.lastrowid)

        for chapter in book["chapters"]:
            chapter_cur = conn.execute(
                "INSERT INTO chapters (book_id, chapter_num) VALUES (?, ?)",
                (book_id, chapter["chapter"]),
            )
            chapter_id = int(chapter_cur.lastrowid)

            for verse in chapter["verses"]:
                verse_cur = conn.execute(
                    """
                    INSERT INTO verses (
                      chapter_id,
                      verse_num,
                      text,
                      paragraph_start,
                      paragraph_marker,
                      red_letter
                    )
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        chapter_id,
                        verse["verse"],
                        verse["text"],
                        1 if verse.get("paragraphStart") else 0,
                        verse.get("paragraphMarker"),
                        1 if verse["redLetter"] else 0,
                    ),
                )
                verse_id = int(verse_cur.lastrowid)

                reference = f"{book['name']} {chapter['chapter']}:{verse['verse']}"
                conn.execute(
                    "INSERT INTO verse_fts(rowid, reference, text) VALUES (?, ?, ?)",
                    (verse_id, reference, verse["text"]),
                )

                for token_idx, token in enumerate(verse["tokenRows"]):
                    token_cur = conn.execute(
                        """
                        INSERT INTO tokens (
                          verse_id,
                          token_index,
                          token_text,
                          strong,
                          lemma,
                          morph,
                          added,
                          divine_name,
                          red_letter
                        )
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            verse_id,
                            token_idx,
                            token["text"],
                            token["strong"],
                            token["lemma"],
                            token["morph"],
                            1 if token["added"] else 0,
                            1 if token["divineName"] else 0,
                            1 if token["redLetter"] else 0,
                        ),
                    )
                    token_id = int(token_cur.lastrowid)
                    conn.executemany(
                        """
                        INSERT INTO token_strongs (token_id, position, strong)
                        VALUES (?, ?, ?)
                        """,
                        [
                            (token_id, position, strong)
                            for position, strong in enumerate(token["strongs"])
                        ],
                    )

                for note_idx, note in enumerate(verse.get("notes", [])):
                    conn.execute(
                        """
                        INSERT INTO verse_notes (
                          verse_id,
                          note_index,
                          note_type,
                          catch_word,
                          note_text,
                          readings_json
                        )
                        VALUES (?, ?, ?, ?, ?, ?)
                        """,
                        (
                            verse_id,
                            note_idx,
                            note.get("type", "unknown"),
                            note.get("catchWord"),
                            note.get("text", ""),
                            json.dumps(note.get("readings", []), ensure_ascii=True),
                        ),
                    )

    conn.commit()
    conn.close()


def write_reader_json(json_path: Path, books: list[dict[str, Any]], source: str) -> None:
    json_path.parent.mkdir(parents=True, exist_ok=True)

    reader_books = []
    for book in books:
        reader_books.append(
            {
                "name": book["name"],
                "chapters": [
                    {
                        "chapter": chapter["chapter"],
                        "verses": [
                            {
                                "verse": verse["verse"],
                                "redLetter": verse["redLetter"],
                                "paragraphStart": verse.get("paragraphStart", False),
                                **(
                                    {"paragraphMarker": verse["paragraphMarker"]}
                                    if verse.get("paragraphMarker")
                                    else {}
                                ),
                                **({"notes": verse["notes"]} if verse.get("notes") else {}),
                                "tokens": verse["tokens"],
                            }
                            for verse in chapter["verses"]
                        ],
                    }
                    for chapter in book["chapters"]
                ],
            }
        )

    payload = {
        "metadata": {
            "source": source,
            "bookCount": len(reader_books),
            "chapterCount": sum(len(book["chapters"]) for book in reader_books),
            "verseCount": sum(
                len(chapter["verses"])
                for book in reader_books
                for chapter in book["chapters"]
            ),
        },
        "books": reader_books,
    }

    json_path.write_text(json.dumps(payload, ensure_ascii=True, separators=(",", ":")), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Import OSIS XML into SQLite and reader JSON")
    parser.add_argument("--input", required=True, help="Path to OSIS XML")
    parser.add_argument("--db", required=True, help="Output SQLite path")
    parser.add_argument("--json", required=True, help="Output reader JSON path")
    parser.add_argument(
        "--source-label",
        default="SWORD/OSIS",
        help="Metadata label stored in generated JSON",
    )
    args = parser.parse_args()

    input_path = Path(args.input)
    if not input_path.exists():
        print(
            f"Input file not found: {input_path}. Place a SWORD OSIS file there and run again.")
        return 1

    books = parse_osis(input_path)
    if not books:
        print(
            "No canonical book/chapter/verse content found in OSIS source. Verify the file format.")
        return 1

    write_sqlite(Path(args.db), books)
    write_reader_json(Path(args.json), books, args.source_label)

    verse_count = sum(
        len(chapter["verses"]) for book in books for chapter in book["chapters"]
    )
    print(
        "Built data artifacts:",
        f"books={len(books)}",
        f"verses={verse_count}",
        f"sqlite={args.db}",
        f"json={args.json}",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
