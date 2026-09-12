import { describe, it, expect } from "vitest";
import { formatRoomDisplay, formatRoomLabel, roomLabelToCode } from "./rooms";

describe("rooms utility", () => {
  describe("formatRoomDisplay", () => {
    it("returns '--' for undefined, null, or empty string", () => {
      expect(formatRoomDisplay(undefined)).toBe("--");
      expect(formatRoomDisplay(null)).toBe("--");
      expect(formatRoomDisplay("")).toBe("--");
      expect(formatRoomDisplay("   ")).toBe("--");
    });

    it("returns '--' for unassigned or placeholder strings", () => {
      expect(formatRoomDisplay("Chưa phân công buồng")).toBe("--");
      expect(formatRoomDisplay("Chưa gán buồng")).toBe("--");
      expect(formatRoomDisplay("Chưa cập nhật")).toBe("--");
      expect(formatRoomDisplay("No assigned room")).toBe("--");
      expect(formatRoomDisplay("any invalid string")).toBe("--");
    });

    it("formats valid room codes and labels with default Vietnamese prefix", () => {
      expect(formatRoomDisplay("ROOM_1")).toBe("Buồng 1");
      expect(formatRoomDisplay("ROOM_2")).toBe("Buồng 2");
      expect(formatRoomDisplay("buồng 3")).toBe("Buồng 3");
      expect(formatRoomDisplay("Room 4")).toBe("Buồng 4");
    });

    it("formats valid room codes and labels with custom/English prefix", () => {
      expect(formatRoomDisplay("ROOM_1", "Room")).toBe("Room 1");
      expect(formatRoomDisplay("Buồng 2", "Room")).toBe("Room 2");
      expect(formatRoomDisplay("ROOM_3", "Room")).toBe("Room 3");
      expect(formatRoomDisplay("room 4", "Room")).toBe("Room 4");
    });
  });

  describe("roomLabelToCode", () => {
    it("resolves English 'Room X' formats to canonical room code", () => {
      expect(roomLabelToCode("Room 1")).toBe("ROOM_1");
      expect(roomLabelToCode("room 2")).toBe("ROOM_2");
    });

    it("returns undefined for placeholder strings", () => {
      expect(roomLabelToCode("Chưa phân công buồng")).toBeUndefined();
      expect(roomLabelToCode("Chưa gán buồng")).toBeUndefined();
      expect(roomLabelToCode("Chưa cập nhật")).toBeUndefined();
      expect(roomLabelToCode("")).toBeUndefined();
      expect(roomLabelToCode(undefined)).toBeUndefined();
    });
  });
});
