// The home's functions that live in their own layer (everything but 今日一枚 and 工作室): each page script registers
// a mount(root, deps) returning {ready, anchor(), source(), enter?(), leave?(), receive?(st)}; app.js flies stamps in
// and out of them. A page with receive() takes the stamp that flew in (it lands where anchor() says, and stays).
// A page is mounted when it is first opened and may be closed again once six others were opened after it: its section
// is then swapped for an empty one, so anything it hooks outside that section must go through Kit.on / Kit.hold
// (web/shell/kit.js), and an optional close() in its api runs first. Work in progress not saved is gone with it.
const Pages = (() => {
  const defs = new Map();
  return {
    define(key, mount) { defs.set(key, mount); },
    has: key => defs.has(key),
    keys: () => [...defs.keys()],
    mount: (key, root, deps) => defs.get(key)(root, deps),
  };
})();
