// Canonical navigation metadata, available before the full verse corpus loads.
export const BIBLE_BOOKS = [
  {
    "name": "Genesis",
    "chapterCount": 50
  },
  {
    "name": "Exodus",
    "chapterCount": 40
  },
  {
    "name": "Leviticus",
    "chapterCount": 27
  },
  {
    "name": "Numbers",
    "chapterCount": 36
  },
  {
    "name": "Deuteronomy",
    "chapterCount": 34
  },
  {
    "name": "Joshua",
    "chapterCount": 24
  },
  {
    "name": "Judges",
    "chapterCount": 21
  },
  {
    "name": "Ruth",
    "chapterCount": 4
  },
  {
    "name": "1 Samuel",
    "chapterCount": 31
  },
  {
    "name": "2 Samuel",
    "chapterCount": 24
  },
  {
    "name": "1 Kings",
    "chapterCount": 22
  },
  {
    "name": "2 Kings",
    "chapterCount": 25
  },
  {
    "name": "1 Chronicles",
    "chapterCount": 29
  },
  {
    "name": "2 Chronicles",
    "chapterCount": 36
  },
  {
    "name": "Ezra",
    "chapterCount": 10
  },
  {
    "name": "Nehemiah",
    "chapterCount": 13
  },
  {
    "name": "Esther",
    "chapterCount": 10
  },
  {
    "name": "Job",
    "chapterCount": 42
  },
  {
    "name": "Psalms",
    "chapterCount": 150
  },
  {
    "name": "Proverbs",
    "chapterCount": 31
  },
  {
    "name": "Ecclesiastes",
    "chapterCount": 12
  },
  {
    "name": "Song of Solomon",
    "chapterCount": 8
  },
  {
    "name": "Isaiah",
    "chapterCount": 66
  },
  {
    "name": "Jeremiah",
    "chapterCount": 52
  },
  {
    "name": "Lamentations",
    "chapterCount": 5
  },
  {
    "name": "Ezekiel",
    "chapterCount": 48
  },
  {
    "name": "Daniel",
    "chapterCount": 12
  },
  {
    "name": "Hosea",
    "chapterCount": 14
  },
  {
    "name": "Joel",
    "chapterCount": 3
  },
  {
    "name": "Amos",
    "chapterCount": 9
  },
  {
    "name": "Obadiah",
    "chapterCount": 1
  },
  {
    "name": "Jonah",
    "chapterCount": 4
  },
  {
    "name": "Micah",
    "chapterCount": 7
  },
  {
    "name": "Nahum",
    "chapterCount": 3
  },
  {
    "name": "Habakkuk",
    "chapterCount": 3
  },
  {
    "name": "Zephaniah",
    "chapterCount": 3
  },
  {
    "name": "Haggai",
    "chapterCount": 2
  },
  {
    "name": "Zechariah",
    "chapterCount": 14
  },
  {
    "name": "Malachi",
    "chapterCount": 4
  },
  {
    "name": "Matthew",
    "chapterCount": 28
  },
  {
    "name": "Mark",
    "chapterCount": 16
  },
  {
    "name": "Luke",
    "chapterCount": 24
  },
  {
    "name": "John",
    "chapterCount": 21
  },
  {
    "name": "Acts",
    "chapterCount": 28
  },
  {
    "name": "Romans",
    "chapterCount": 16
  },
  {
    "name": "1 Corinthians",
    "chapterCount": 16
  },
  {
    "name": "2 Corinthians",
    "chapterCount": 13
  },
  {
    "name": "Galatians",
    "chapterCount": 6
  },
  {
    "name": "Ephesians",
    "chapterCount": 6
  },
  {
    "name": "Philippians",
    "chapterCount": 4
  },
  {
    "name": "Colossians",
    "chapterCount": 4
  },
  {
    "name": "1 Thessalonians",
    "chapterCount": 5
  },
  {
    "name": "2 Thessalonians",
    "chapterCount": 3
  },
  {
    "name": "1 Timothy",
    "chapterCount": 6
  },
  {
    "name": "2 Timothy",
    "chapterCount": 4
  },
  {
    "name": "Titus",
    "chapterCount": 3
  },
  {
    "name": "Philemon",
    "chapterCount": 1
  },
  {
    "name": "Hebrews",
    "chapterCount": 13
  },
  {
    "name": "James",
    "chapterCount": 5
  },
  {
    "name": "1 Peter",
    "chapterCount": 5
  },
  {
    "name": "2 Peter",
    "chapterCount": 3
  },
  {
    "name": "1 John",
    "chapterCount": 5
  },
  {
    "name": "2 John",
    "chapterCount": 1
  },
  {
    "name": "3 John",
    "chapterCount": 1
  },
  {
    "name": "Jude",
    "chapterCount": 1
  },
  {
    "name": "Revelation",
    "chapterCount": 22
  }
] as const;

export function chapterLabel(book: string, chapter: number) {
  return `${book === "Psalms" ? "Psalm" : book} ${chapter}`;
}
