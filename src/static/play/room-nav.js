// When the room page sends you on to the full-screen game. A match that starts
// while you wait in the room takes everyone to it. But if you left a running
// match on purpose (the game's "Back to the room" seal adds ?stay), the room
// page stays put for that match and offers "Go to the game"; the next match
// that starts takes you as usual. Pure, so it can be tested without a page.
export function shouldGoToGame(view, { stay, startedAtOnArrival }) {
  if (view.state !== "play") return false;
  if (stay && view.startedAt === startedAtOnArrival) return false;
  return true;
}
