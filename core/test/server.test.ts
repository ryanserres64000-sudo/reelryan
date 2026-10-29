import { test } from "node:test";
import assert from "node:assert/strict";
import { serverUrl } from "../server.ts";

test("l'adresse du serveur est lue même mal écrite", () => {
  assert.equal(serverUrl("https://reelryan.vercel.app"), "https://reelryan.vercel.app");
  assert.equal(serverUrl("reelryan.vercel.app"), "https://reelryan.vercel.app");
  assert.equal(serverUrl("  https://reelryan.vercel.app/ \n"), "https://reelryan.vercel.app");
  assert.equal(serverUrl("https://reelryan.vercel.app/api"), "https://reelryan.vercel.app");
  assert.equal(serverUrl("\"https://reelryan.vercel.app\""), "https://reelryan.vercel.app");
  assert.equal(serverUrl("http://localhost:8766"), "http://localhost:8766");
});

test("sans adresse lisible, pas de serveur", () => {
  assert.equal(serverUrl(""), null);
  assert.equal(serverUrl(undefined), null);
  assert.equal(serverUrl("pas une adresse"), null);
});
