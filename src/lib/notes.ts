import { chapterLabel } from "@/lib/bible-books";
import type { Book } from "@/types/bible";
import type { NoteScope, NotesContext, ReaderNote } from "@/types/notes";

export function contextLabel(context: NotesContext | null, books: Book[]) {
  if (!context) {
    return "No context selected";
  }
  const book = books[context.bookIndex];
  const bookName = book?.name ?? `Book ${context.bookIndex + 1}`;
  const chapter = context.chapterIndex + 1;
  if (context.word && context.verseNumber) {
    return `${chapterLabel(bookName, chapter)}:${context.verseNumber} • "${context.word}"`;
  }
  if (context.word) {
    return `${chapterLabel(bookName, chapter)} • "${context.word}"`;
  }
  if (context.verseNumber) {
    return `${chapterLabel(bookName, chapter)}:${context.verseNumber}`;
  }
  return `${chapterLabel(bookName, chapter)}`;
}

export function noteScopeLabel(scope: NoteScope, books: Book[]) {
  if (scope.type === "general") {
    return "General";
  }
  const book = books[scope.bookIndex];
  const bookName = book?.name ?? `Book ${scope.bookIndex + 1}`;
  if (scope.type === "book") {
    return bookName;
  }
  if (scope.type === "chapter") {
    return `${chapterLabel(bookName, scope.chapterIndex + 1)}`;
  }
  if (scope.type === "verse") {
    return `${chapterLabel(bookName, scope.chapterIndex + 1)}:${scope.verseNumber}`;
  }
  if (scope.verseNumber) {
    return `${chapterLabel(bookName, scope.chapterIndex + 1)}:${scope.verseNumber} • "${scope.word}"`;
  }
  return `${chapterLabel(bookName, scope.chapterIndex + 1)} • "${scope.word}"`;
}

export function noteMatchesContext(note: ReaderNote, context: NotesContext | null) {
  if (!context) {
    return note.scope.type === "general";
  }
  if (note.scope.type === "general") {
    return true;
  }
  if (note.scope.bookIndex !== context.bookIndex) {
    return false;
  }
  if (note.scope.type === "book") {
    return true;
  }
  if (note.scope.chapterIndex !== context.chapterIndex) {
    return false;
  }
  if (note.scope.type === "chapter") {
    return true;
  }
  if (note.scope.type === "verse") {
    return context.verseNumber ? note.scope.verseNumber === context.verseNumber : true;
  }
  if (note.scope.type === "word") {
    const wordMatches = context.word
      ? note.scope.word.toLowerCase() === context.word.toLowerCase()
      : true;
    const verseMatches = context.verseNumber
      ? note.scope.verseNumber === undefined ||
        note.scope.verseNumber === context.verseNumber
      : true;
    return wordMatches && verseMatches;
  }
  return false;
}
