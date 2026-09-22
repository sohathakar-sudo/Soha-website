// Keyboard state. Held keys live in a Set and are read once per tick — nothing
// moves inside an event handler.
const HELD = new Set();

const LEFT  = ['KeyA', 'ArrowLeft'];
const RIGHT = ['KeyD', 'ArrowRight'];
const UP    = ['KeyW', 'ArrowUp'];
const DOWN  = ['KeyS', 'ArrowDown'];

const MOVEMENT = [...LEFT, ...RIGHT, ...UP, ...DOWN];

// Keys that fire once per press rather than every tick. A pressed key lands here
// and is removed by whoever consumes it.
const PRESSED = new Set();
const EDGE_TRIGGERED = ['Enter', 'Backquote'];

// Is the player typing rather than walking? The game listens on the window, so
// without this it eats W, A, S, D, the arrows, Enter and the backtick before
// they reach a text box — which is most of a name.
//
// Bailing out is better than only skipping preventDefault: someone typing their
// name should not also be marching across the room behind the title screen.
function isTyping(event) {
  const el = event.target;
  if (!el || !el.tagName) return false;
  const tag = el.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
}

export function attachInput(target = window) {
  target.addEventListener('keydown', (e) => {
    if (isTyping(e)) return;
    if (e.repeat) {
      // Holding a key must not re-fire an edge-triggered action.
      if (EDGE_TRIGGERED.includes(e.code)) return;
    } else if (EDGE_TRIGGERED.includes(e.code)) {
      PRESSED.add(e.code);
    }
    if (MOVEMENT.includes(e.code) || EDGE_TRIGGERED.includes(e.code)) {
      HELD.add(e.code);
      e.preventDefault();
    }
  });

  target.addEventListener('keyup', (e) => {
    if (isTyping(e)) return;
    HELD.delete(e.code);
  });

  // Keys stay stuck down if the window loses focus mid-press.
  target.addEventListener('blur', () => {
    HELD.clear();
    PRESSED.clear();
  });
}

const some = (codes) => codes.some((code) => HELD.has(code));

// A plain serializable snapshot of intent — this is exactly what gets sent to a
// server later, so it holds no key codes and no DOM state.
export function readInput() {
  return {
    left: some(LEFT),
    right: some(RIGHT),
    up: some(UP),
    down: some(DOWN),
    interact: consumePress('Enter'),
  };
}

export function consumePress(code) {
  if (!PRESSED.has(code)) return false;
  PRESSED.delete(code);
  return true;
}

export function hasMovement(input) {
  return input.left || input.right || input.up || input.down;
}
