import type { FormEvent } from "react";

/** Reads a form as strings, leaving out blanks so optional fields are simply omitted. */
export function formValues(e: FormEvent<HTMLFormElement>) {
  e.preventDefault();
  const entries = [...new FormData(e.currentTarget)].filter(([, v]) => v !== "");
  return Object.fromEntries(entries) as Record<string, string>;
}
