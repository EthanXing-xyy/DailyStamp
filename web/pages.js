// The home's functions that live in their own layer (everything but 今日一枚 and 工作室): each page script registers
// a mount(root, deps) returning {ready, anchor(), source(), enter?(), leave?(), receive?(st)}; app.js flies stamps in
// and out of them. A page with receive() takes the stamp that flew in (it lands where anchor() says, and stays).
const Pages = (() => {
  const defs = new Map();
  return {
    define(key, mount) { defs.set(key, mount); },
    has: key => defs.has(key),
    keys: () => [...defs.keys()],
    mount: (key, root, deps) => defs.get(key)(root, deps),
  };
})();
