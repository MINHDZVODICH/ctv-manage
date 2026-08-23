import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const readProjectFile = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("does not expose room management as an application view", () => {
  const appSource = readProjectFile("src/App.tsx");
  const sidebarSource = readProjectFile("src/components/Navigation/Sidebar.tsx");
  const typesSource = readProjectFile("src/types.ts");

  assert.doesNotMatch(appSource, /RoomsScreen|currentTab\s*===\s*["']rooms["']/);
  assert.doesNotMatch(sidebarSource, /onSelectTab\(["']rooms["']\)|nav_rooms|Quản lý phòng/);
  assert.doesNotMatch(typesSource, /["']rooms["']|RoomStatus/);
});

test("schedule registration treats every room as available", () => {
  const sequenceDiagram = readProjectFile(
    "docs/sequence-diagrams/03-dang-ky-cap-nhat-lich-lam-viec.md",
  );

  assert.doesNotMatch(
    sequenceDiagram,
    /Kiểm tra phòng còn hoạt động|Phòng không còn hoạt động|Phòng không khả dụng/,
  );
});
