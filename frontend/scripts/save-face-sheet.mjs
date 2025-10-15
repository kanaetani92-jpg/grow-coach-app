#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import process from "node:process";

function parseArgs(argv) {
  const args = argv.slice(2);
  const options = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg.startsWith("--")) {
      continue;
    }
    const key = arg.slice(2);
    const next = args[i + 1];
    if (next && !next.startsWith("--")) {
      options[key] = next;
      i += 1;
    } else {
      options[key] = "true";
    }
  }
  return options;
}

function ensureFaceSheetPayload(input) {
  if (input && typeof input === "object" && !Array.isArray(input)) {
    if (Object.prototype.hasOwnProperty.call(input, "faceSheet")) {
      return input;
    }
    return { faceSheet: input };
  }
  throw new Error(
    "The face sheet payload must be an object or contain a `faceSheet` property."
  );
}

async function main() {
  const options = parseArgs(process.argv);
  const backendRaw =
    options["backend-url"] ||
    options.backendUrl ||
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    "";
  const backendBase = backendRaw.replace(/\/+$/, "");
  if (!backendBase) {
    throw new Error(
      "Missing backend URL. Provide --backend-url or set BACKEND_URL / NEXT_PUBLIC_BACKEND_URL."
    );
  }
  const apiBase = backendBase.endsWith("/api")
    ? backendBase
    : `${backendBase}/api`;
  const token =
    options.token || process.env.FIREBASE_ID_TOKEN || process.env.ID_TOKEN || "";
  if (!token) {
    throw new Error(
      "Missing Firebase ID token. Provide --token or set FIREBASE_ID_TOKEN / ID_TOKEN."
    );
  }
  const filePath = options.file || process.env.FACE_SHEET_FILE;
  if (!filePath) {
    throw new Error(
      "Missing face sheet JSON. Provide --file or set FACE_SHEET_FILE with the path to the payload."
    );
  }

  const rawJson = await readFile(filePath, "utf8");
  let parsed;
  try {
    parsed = JSON.parse(rawJson);
  } catch (error) {
    throw new Error(`Failed to parse JSON from ${filePath}: ${error.message}`);
  }
  const payload = ensureFaceSheetPayload(parsed);

  const response = await fetch(`${apiBase}/face-sheet`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Request failed with ${response.status} ${response.statusText}: ${errorBody}`
    );
  }

  const resultText = await response.text();
  try {
    const resultJson = JSON.parse(resultText);
    console.log(JSON.stringify(resultJson, null, 2));
  } catch (error) {
    console.log(resultText);
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
