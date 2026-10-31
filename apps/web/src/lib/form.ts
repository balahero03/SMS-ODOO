import type { FormEvent } from "react";

/** The API prefixes validation messages with the field name ("email: Invalid email"). */
export const readable = (error: Error | null) => error && error.message.replace(/(^|; )\w+: /g, "$1");

/** Reads a form as strings, leaving out blanks so optional fields are simply omitted. */
export function formValues(e: FormEvent<HTMLFormElement>) {
  e.preventDefault();
  const entries = [...new FormData(e.currentTarget)].filter(([, v]) => v !== "");
  return Object.fromEntries(entries) as Record<string, string>;
}
