// Which 3D world a mode uses (DESIGN.md "What is shared, and what is not"):
// the move to the v5 shared world (world5.js, the 92 x 64 lobed lake) is one
// mode at a time, not a rescale of the old one (world.js, the 1000 x 700
// ellipse). A mode not yet rebuilt to v5.0 keeps sending sim coordinates in
// the old space, and keeps calling world.js's own API (setCamera(pos, look),
// not world5.js's setCameraMode(mode, target)), so it must keep loading the
// old world. A mode's id is added here only in the same commit that rewrites
// its client script to world5.js's API. Rush 2.0 (prompt-17) is the first,
// Who's Poaching 2.0 the second:
// spec/unit/room-ui.test.ts statically checks every world.* call a mode
// script makes against the module worldModuleFor() actually gives it, so a
// mode left off this list while its script already calls the other API
// fails that test instead of only throwing in a real browser.
export const WORLD5_MODES = ["rush", "poach", "hold"];
export const worldModuleFor = (modeId) => (WORLD5_MODES.includes(modeId) ? "world5.js" : "world.js");
