import assert from "node:assert/strict";
import {
  calcTaxFromGross,
  formatReceiptNumber,
  parsePrice,
} from "./admin-utils.js";

assert.equal(parsePrice("10.00"), 1000);
assert.equal(parsePrice("0"), 0);

assert.equal(calcTaxFromGross(11900, 19), 1900);
assert.equal(calcTaxFromGross(7000, 7), 458);
assert.equal(calcTaxFromGross(1000, 0), 0);

assert.equal(formatReceiptNumber("2024-01-05T10:00:00Z", 7), "2024-00007");

console.log("admin-utils tests passed");
