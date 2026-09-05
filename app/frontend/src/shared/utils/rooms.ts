export const ROOMS = [
  { code: "ROOM_1", label: "Buồng 1" },
  { code: "ROOM_2", label: "Buồng 2" },
  { code: "ROOM_3", label: "Buồng 3" },
  { code: "ROOM_4", label: "Buồng 4" },
] as const;

export type RoomCode = (typeof ROOMS)[number]["code"];
export type RoomLabel = (typeof ROOMS)[number]["label"];

export const ROOM_OPTIONS: RoomLabel[] = ROOMS.map((room) => room.label);

export function formatRoomLabel(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;

  const canonical = ROOMS.find(
    (room) => room.code.toLowerCase() === trimmed.toLowerCase(),
  );
  if (canonical) return canonical.label;

  const legacyMatch = trimmed.match(/^(?:buồng|buong|phòng|phong)\s*([1-4])$/i);
  if (legacyMatch) return `Buồng ${legacyMatch[1]}`;

  return trimmed;
}

export function roomLabelToCode(value?: string | null): RoomCode | undefined {
  const label = formatRoomLabel(value);
  return ROOMS.find((room) => room.label === label)?.code;
}
