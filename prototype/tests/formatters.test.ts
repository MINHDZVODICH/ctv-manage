import assert from "node:assert/strict";
import test from "node:test";
import { formatDateOnly } from "../src/utils/formatters";

test("formatDateOnly extracts Vietnamese dates regardless of time order", () => {
  assert.equal(formatDateOnly("15/10/2023 09:30"), "15/10/2023");
  assert.equal(formatDateOnly("10:05 17/08/2026"), "17/08/2026");
  assert.equal(formatDateOnly("17/8/2026, 10:05"), "17/08/2026");
});

test("formatDateOnly converts ISO dates without timezone parsing", () => {
  assert.equal(formatDateOnly("2026-08-17T10:05:00.000Z"), "17/08/2026");
  assert.equal(formatDateOnly("2026-8-7 10:05"), "07/08/2026");
});

test("formatDateOnly preserves unknown non-empty values", () => {
  assert.equal(formatDateOnly("không xác định"), "không xác định");
  assert.equal(formatDateOnly(""), "");
  assert.equal(formatDateOnly(undefined), "");
});
