var __defProp = Object.defineProperty;
var __export = (target, all2) => {
  for (var name in all2)
    __defProp(target, name, { get: all2[name], enumerable: true });
};

// Source/Main.js
import {
  CommandPermissionLevel,
  CustomCommandStatus,
  ItemStack,
  Player,
  TextPrimitive as TextPrimitive4,
  system as system6,
  world as world7
} from "@minecraft/server";
import { ObservableNumber as ObservableNumber3, ObservableString as ObservableString2 } from "@minecraft/server-ui";

// ../../Package/Bedform/Source/Internal/CommonResourcePack.ts
var CommonResourcePack = "c15f802e-ae6c-4b64-9037-db7fb035f1e8";

// ../../Package/Bedform/Source/Internal/DirectionPreview.ts
var DirectionResourcePack = CommonResourcePack;
var DirectionAxes = Object.freeze(["+Y", "-Y", "-Z", "+Z", "+X", "-X"]);
var DirectionPreviewPath = (selected, mask, labels, excluded) => {
  const style = excluded === true || mask === 63 ? "show" : excluded === false ? "hide" : "dim";
  const name = `${style}_${style === "show" ? 63 : mask}_${selected + 1}.png`;
  return `textures/bedform/direction/${labels ?? "none"}/${name}`;
};

// ../../Package/Bedform/Source/DDUI/Direction.ts
import {
  ObservableNumber,
  ObservableString
} from "@minecraft/server-ui";

// ../../Package/Bedform/Source/Internal/FormInputs.ts
var Registries = /* @__PURE__ */ new WeakMap();
var RegistryOf = (form) => {
  let registry = Registries.get(form);
  if (registry === void 0) {
    registry = {
      Inputs: [],
      Observers: /* @__PURE__ */ new Set(),
      Suppressed: 0
    };
    Registries.set(form, registry);
  }
  return registry;
};
var RegisterInput = (form, input) => {
  const registry = RegistryOf(form);
  if (registry.Suppressed > 0 || registry.Inputs.includes(input)) {
    return;
  }
  registry.Inputs.push(input);
  for (const observer of [...registry.Observers]) {
    observer(input);
  }
};
var ObserveInputs = (form, callback) => {
  const registry = RegistryOf(form);
  const observer = (input) => callback(input);
  registry.Observers.add(observer);
  for (const input of [...registry.Inputs]) {
    if (registry.Observers.has(observer)) {
      callback(input);
    }
  }
  return () => {
    registry.Observers.delete(observer);
  };
};
var Untracked = (form, body) => {
  const registry = RegistryOf(form);
  registry.Suppressed++;
  try {
    return body();
  } finally {
    registry.Suppressed--;
  }
};
var ObservableInput = (observable) => {
  return {
    read: () => observable.getData(),
    subscribe: (listener) => {
      const callback = (data) => listener(data);
      observable.subscribe(callback);
      return () => {
        observable.unsubscribe(callback);
      };
    },
    write: (value) => {
      const current = observable.getData();
      if (typeof value !== typeof current) {
        throw new TypeError(`Cannot write a ${typeof value} to a ${typeof current} observable.`);
      }
      observable.setData(value);
    }
  };
};

// ../../Package/Effect/Distribution/Pipeable.js
var pipeArguments = (self, args2) => {
  switch (args2.length) {
    case 0:
      return self;
    case 1:
      return args2[0](self);
    case 2:
      return args2[1](args2[0](self));
    case 3:
      return args2[2](args2[1](args2[0](self)));
    case 4:
      return args2[3](args2[2](args2[1](args2[0](self))));
    case 5:
      return args2[4](args2[3](args2[2](args2[1](args2[0](self)))));
    case 6:
      return args2[5](args2[4](args2[3](args2[2](args2[1](args2[0](self))))));
    case 7:
      return args2[6](args2[5](args2[4](args2[3](args2[2](args2[1](args2[0](self)))))));
    case 8:
      return args2[7](args2[6](args2[5](args2[4](args2[3](args2[2](args2[1](args2[0](self))))))));
    case 9:
      return args2[8](args2[7](args2[6](args2[5](args2[4](args2[3](args2[2](args2[1](args2[0](self)))))))));
    default: {
      let ret = self;
      for (let i = 0, len = args2.length; i < len; i++) {
        ret = args2[i](ret);
      }
      return ret;
    }
  }
};
var Prototype = {
  pipe() {
    return pipeArguments(this, arguments);
  }
};
var Class = (function() {
  function PipeableBase() {
  }
  PipeableBase.prototype = Prototype;
  return PipeableBase;
})();

// ../../Package/Effect/Distribution/Function.js
var dual = function(arity, body) {
  if (typeof arity === "function") {
    return function() {
      return arity(arguments) ? body.apply(this, arguments) : ((self) => body(self, ...arguments));
    };
  }
  switch (arity) {
    case 0:
    case 1:
      throw new RangeError(`Invalid arity ${arity}`);
    case 2:
      return function(a, b) {
        if (arguments.length >= 2) {
          return body(a, b);
        }
        return function(self) {
          return body(self, a);
        };
      };
    case 3:
      return function(a, b, c) {
        if (arguments.length >= 3) {
          return body(a, b, c);
        }
        return function(self) {
          return body(self, a, b);
        };
      };
    default:
      return function() {
        if (arguments.length >= arity) {
          return body.apply(this, arguments);
        }
        const args2 = arguments;
        return function(self) {
          return body(self, ...args2);
        };
      };
  }
};
var identity = (a) => a;
var cast = identity;
var constant = (value) => () => value;
var constTrue = constant(true);
var constFalse = constant(false);
var constNull = constant(null);
var constUndefined = constant(void 0);
var compose = dual(2, (ab, bc) => (a) => bc(ab(a)));
var absurd = (_) => {
  throw new Error("Called `absurd` function which should be uncallable");
};
var hole = cast(absurd);

// ../../Package/Effect/Distribution/Internal/record.js
function assignProperty(self, key, value) {
  if (key === "__proto__") {
    Object.defineProperty(self, key, {
      value,
      writable: true,
      enumerable: true,
      configurable: true
    });
  } else {
    ;
    self[key] = value;
  }
}
function assignProperties(self, source) {
  for (const key of Reflect.ownKeys(source)) {
    if (Object.prototype.propertyIsEnumerable.call(source, key)) {
      assignProperty(self, key, source[key]);
    }
  }
}

// ../../Package/Effect/Distribution/Predicate.js
var mapInput = dual(2, (self, f) => (b) => self(f(b)));
var isTupleOf = dual(2, (self, n) => self.length === n);
var isTupleOfAtLeast = dual(2, (self, n) => self.length >= n);
function isFunction(input) {
  return typeof input === "function";
}
function isObjectKeyword(input) {
  return typeof input === "object" && input !== null || isFunction(input);
}
var hasProperty = dual(2, (self, property) => isObjectKeyword(self) && property in self);
var isTagged = dual(2, (self, tag) => hasProperty(self, "_tag") && self["_tag"] === tag);
var compose2 = dual(2, (ab, bc) => (a) => ab(a) && bc(a));
var or = dual(2, (self, that) => (a) => self(a) || that(a));
var and = dual(2, (self, that) => (a) => self(a) && that(a));
var xor = dual(2, (self, that) => (a) => self(a) !== that(a));
var eqv = dual(2, (self, that) => (a) => self(a) === that(a));
var implies = dual(2, (antecedent, consequent) => (a) => antecedent(a) ? consequent(a) : true);
var nor = dual(2, (self, that) => (a) => !(self(a) || that(a)));
var nand = dual(2, (self, that) => (a) => !(self(a) && that(a)));

// ../../Package/Effect/Distribution/Internal/hash.js
var backEdges = 0;
var addBackEdge = () => {
  backEdges++;
};

// ../../Package/Effect/Distribution/Internal/equal.js
var getAllObjectKeys = (obj) => {
  const keys2 = new Set(Reflect.ownKeys(obj));
  if (obj.constructor === Object) {
    return keys2;
  }
  if (obj instanceof Error) {
    keys2.delete("stack");
  }
  const proto = Object.getPrototypeOf(obj);
  let current = proto;
  while (current !== null && current !== Object.prototype) {
    const ownKeys = Reflect.ownKeys(current);
    for (let i = 0; i < ownKeys.length; i++) {
      keys2.add(ownKeys[i]);
    }
    current = Object.getPrototypeOf(current);
  }
  if (keys2.has("constructor") && typeof obj.constructor === "function" && proto === obj.constructor.prototype) {
    keys2.delete("constructor");
  }
  return keys2;
};
var byReferenceInstances = /* @__PURE__ */ new WeakSet();
var viewBytes = (view) => new Uint8Array(view.buffer, view.byteOffset, view.byteLength);

// ../../Package/Effect/Distribution/Hash.js
var symbol = "~effect/Hash";
var hash = (self) => {
  switch (typeof self) {
    case "number":
      return number(self);
    case "bigint":
      return string(self.toString(10));
    case "string":
      return string(self);
    case "function":
    case "object": {
      if (self === null) {
        break;
      } else if (self instanceof Date) {
        if (Number.isNaN(self.getTime())) {
          return string("Invalid Date");
        }
        return string(self.toISOString());
      } else if (self instanceof RegExp) {
        return string(self.toString());
      } else {
        if (byReferenceInstances.has(self)) {
          return random(self);
        }
        const cached = hashCache.get(self);
        if (cached !== void 0) {
          return cached;
        }
        if (visitedObjects.has(self)) {
          addBackEdge();
          return string("[Circular]");
        }
        visitedObjects.add(self);
        const seen = backEdges;
        let h;
        try {
          if (symbol in self) {
            h = self[symbol]();
          } else if (typeof self === "function") {
            h = random(self);
          } else if (self instanceof DataView) {
            h = array(viewBytes(self));
          } else if (Array.isArray(self) || ArrayBuffer.isView(self)) {
            h = array(self);
          } else if (self instanceof Map) {
            h = hashMap(self);
          } else if (self instanceof Set) {
            h = hashSet(self);
          } else {
            h = structure(self);
          }
        } finally {
          visitedObjects.delete(self);
        }
        if (seen === backEdges) {
          hashCache.set(self, h);
        }
        return h;
      }
    }
  }
  return optimize(mix(string(String(self))));
};
var random = (self) => {
  if (!randomHashCache.has(self)) {
    randomHashCache.set(self, optimize(Math.random() * 4294967296 | 0));
  }
  return randomHashCache.get(self);
};
var mix = (h) => {
  h ^= h >>> 16;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  h = Math.imul(h, 3266489909);
  return h ^ h >>> 16;
};
var combine = dual(2, (self, b) => mix(Math.imul(self, 2654435761) + Math.imul(b, 2246822507)));
var optimize = (n) => n & 3221225471 | n >>> 1 & 1073741824;
var float64 = new DataView(new ArrayBuffer(8));
var number = (n) => {
  const h = n | 0;
  if (h === n) {
    return optimize(h);
  }
  float64.setFloat64(0, n !== n ? NaN : n);
  return optimize(combine(float64.getInt32(0), float64.getInt32(4)));
};
var string = (str) => {
  let h = 5381;
  let i = str.length;
  while (i) {
    h = h * 33 ^ str.charCodeAt(--i);
  }
  return optimize(h);
};
var structureKeys = (o, keys2) => {
  let h = 12289;
  for (const key of keys2) {
    h ^= combine(hash(key), hash(o[key]));
  }
  return optimize(h);
};
var structure = (o) => structureKeys(o, getAllObjectKeys(o));
var unordered = (seed, f) => (iter) => {
  let h = seed;
  for (const element of iter) {
    h ^= f(element);
  }
  return optimize(h);
};
var array = (arr) => {
  let h = 6151;
  for (const element of arr) {
    h = combine(h, hash(element));
  }
  return optimize(h);
};
var hashMap = unordered(string("Map"), ([k, v]) => combine(hash(k), hash(v)));
var setSeed = string("Set");
var hashSet = unordered(setSeed, (element) => combine(setSeed, hash(element)));
var randomHashCache = /* @__PURE__ */ new WeakMap();
var hashCache = /* @__PURE__ */ new WeakMap();
var visitedObjects = /* @__PURE__ */ new WeakSet();

// ../../Package/Effect/Distribution/Equal.js
var symbol2 = "~effect/Equal";
function equals() {
  if (arguments.length === 1) {
    return (self) => compareBoth(self, arguments[0]);
  }
  return compareBoth(arguments[0], arguments[1]);
}
function compareBoth(self, that) {
  if (self === that) {
    return true;
  }
  if (self == null || that == null) {
    return false;
  }
  const selfType = typeof self;
  if (selfType !== typeof that) {
    return false;
  }
  if (selfType === "number" && self !== self && that !== that) {
    return true;
  }
  if (selfType !== "object" && selfType !== "function") {
    return false;
  }
  if (byReferenceInstances.has(self) || byReferenceInstances.has(that)) {
    return false;
  }
  return compareObjects(self, that);
}
function compareObjects(self, that) {
  const depth = pathLeft.length;
  for (let i = depth; i-- > 0; ) {
    if (pathLeft[i] === self && pathRight[i] === that) {
      return true;
    }
  }
  if (depth) {
    return compareOnPath(self, that);
  }
  let known = results.get(self);
  if (!known) {
    results.set(self, known = /* @__PURE__ */ new WeakMap());
  }
  let result = known.get(that);
  if (result === void 0) {
    known.set(that, result = compareOnPath(self, that));
  }
  return result;
}
function compareOnPath(self, that) {
  pathLeft.push(self);
  pathRight.push(that);
  try {
    return compareStructure(self, that);
  } finally {
    pathLeft.pop();
    pathRight.pop();
  }
}
var pathLeft = [];
var pathRight = [];
var results = /* @__PURE__ */ new WeakMap();
function compareStructure(self, that) {
  if (hash(self) !== hash(that)) {
    return false;
  } else if (self instanceof Date) {
    if (!(that instanceof Date)) {
      return false;
    }
    const selfTime = self.getTime();
    const thatTime = that.getTime();
    return selfTime === thatTime || Number.isNaN(selfTime) && Number.isNaN(thatTime);
  } else if (self instanceof RegExp) {
    return that instanceof RegExp && self.toString() === that.toString();
  }
  const bothEquals = isEqual(self);
  if (bothEquals !== isEqual(that) || typeof self === "function" && !bothEquals) {
    return false;
  } else if (bothEquals) {
    return self[symbol2](that);
  } else if (Array.isArray(self)) {
    if (!Array.isArray(that) || self.length !== that.length) {
      return false;
    }
    return compareArrays(self, that);
  } else if (ArrayBuffer.isView(self)) {
    const selfIsDataView = self instanceof DataView;
    if (!ArrayBuffer.isView(that) || self.byteLength !== that.byteLength || selfIsDataView !== that instanceof DataView) {
      return false;
    }
    if (selfIsDataView) {
      return compareTypedArrays(viewBytes(self), viewBytes(that));
    }
    return compareTypedArrays(self, that);
  } else if (self instanceof Map) {
    if (!(that instanceof Map) || self.size !== that.size) {
      return false;
    }
    return compareHashed(self, that, entryHash, equalEntries);
  } else if (self instanceof Set) {
    if (!(that instanceof Set) || self.size !== that.size) {
      return false;
    }
    return compareHashed(self, that, hash, compareBoth);
  }
  return compareRecords(self, that);
}
function compareArrays(self, that) {
  for (let i = 0; i < self.length; i++) {
    if (!compareBoth(self[i], that[i])) {
      return false;
    }
  }
  return true;
}
function compareTypedArrays(self, that) {
  if (self.length !== that.length) {
    return false;
  }
  for (let i = 0; i < self.length; i++) {
    if (self[i] !== that[i]) {
      return false;
    }
  }
  return true;
}
function compareRecords(self, that) {
  const selfKeys = getAllObjectKeys(self);
  const thatKeys = getAllObjectKeys(that);
  if (selfKeys.size !== thatKeys.size) {
    return false;
  }
  for (const key of selfKeys) {
    if (!thatKeys.has(key) || !compareBoth(self[key], that[key])) {
      return false;
    }
  }
  return true;
}
function compareHashed(self, that, hashOf, equivalent) {
  const groups = /* @__PURE__ */ new Map();
  let remaining = 0;
  for (const item of that) {
    const h = hashOf(item);
    const group = groups.get(h);
    if (group) {
      group.push(item);
    } else {
      groups.set(h, [item]);
    }
    remaining++;
  }
  outer: for (const item of self) {
    const group = groups.get(hashOf(item));
    if (group) {
      for (let i = 0; i < group.length; i++) {
        if (equivalent(item, group[i])) {
          group[i] = group[group.length - 1];
          group.pop();
          remaining--;
          continue outer;
        }
      }
    }
    return false;
  }
  return remaining === 0;
}
var entryHash = (entry) => hash(entry[0]);
var equalEntries = (self, that) => compareBoth(self[0], that[0]) && compareBoth(self[1], that[1]);
var isEqual = (u) => hasProperty(u, symbol2);
var asEquivalence = () => equals;

// ../../Package/Effect/Distribution/Redactable.js
var symbolRedactable = Symbol.for("~effect/Redactable");
var isRedactable = (u) => hasProperty(u, symbolRedactable);
function redact(u) {
  if (isRedactable(u)) {
    return getRedacted(u);
  }
  return u;
}
function getRedacted(redactable) {
  return redactable[symbolRedactable](globalThis[currentFiberTypeId]?.context ?? emptyContext);
}
var currentFiberTypeId = "~effect/Fiber/currentFiber";
var emptyMap = /* @__PURE__ */ new Map();
var emptyContext = {
  "~effect/Context": {},
  base: emptyMap,
  depth: 0,
  mapUnsafe: emptyMap,
  pipe() {
    return pipeArguments(this, arguments);
  }
};

// ../../Package/Effect/Distribution/Formatter.js
function format(input, options) {
  const space = options?.space ?? 0;
  const ancestors = /* @__PURE__ */ new WeakSet();
  const gap = !space ? "" : typeof space === "number" ? " ".repeat(space) : space;
  const ind = (d) => gap.repeat(d);
  const wrap = (v, body) => {
    const ctor = v?.constructor;
    return ctor && ctor !== Object.prototype.constructor && ctor.name ? `${ctor.name}(${body})` : body;
  };
  const ownKeys = (o) => {
    try {
      return Reflect.ownKeys(o);
    } catch {
      return ["[ownKeys threw]"];
    }
  };
  function recur(v, d = 0) {
    try {
      return recurUnsafe(v, d);
    } catch {
      if (typeof v === "object" && v !== null || typeof v === "function") {
        ancestors.delete(v);
      }
      return "[inspection threw]";
    }
  }
  function recurUnsafe(v, d = 0) {
    if (typeof v === "string") {
      return JSON.stringify(v);
    }
    if (typeof v === "number" || v == null || typeof v === "boolean" || typeof v === "symbol") {
      return String(v);
    }
    if (typeof v === "bigint") {
      return String(v) + "n";
    }
    if (typeof v === "object" || typeof v === "function") {
      if (ancestors.has(v)) {
        return Circular;
      }
      ancestors.add(v);
      let output;
      if (symbolRedactable in v) {
        output = recur(getRedacted(v), d);
      } else if (Array.isArray(v)) {
        output = !gap || v.length <= 1 ? `[${v.map((x) => recur(x, d)).join(",")}]` : `[
${ind(d + 1)}${v.map((x) => recur(x, d + 1)).join(",\n" + ind(d + 1))}
${ind(d)}]`;
      } else if (v instanceof Date) {
        output = formatDate(v);
      } else if (!options?.ignoreToString && hasProperty(v, "toString") && typeof v["toString"] === "function" && v["toString"] !== Object.prototype.toString && v["toString"] !== Array.prototype.toString) {
        const s = safeToString(v);
        output = v instanceof Error && v.cause !== void 0 ? `${s} (cause: ${recur(v.cause, d)})` : s;
      } else if (Symbol.iterator in v) {
        output = `${v.constructor.name}(${recur(Array.from(v), d)})`;
      } else {
        const keys2 = ownKeys(v);
        if (!gap || keys2.length <= 1) {
          const body = `{${keys2.map((k) => `${formatPropertyKey(k)}:${recur(safeGet(v, k), d)}`).join(",")}}`;
          output = wrap(v, body);
        } else {
          const body = `{
${keys2.map((k) => `${ind(d + 1)}${formatPropertyKey(k)}: ${recur(safeGet(v, k), d + 1)}`).join(",\n")}
${ind(d)}}`;
          output = wrap(v, body);
        }
      }
      ancestors.delete(v);
      return output;
    }
    return String(v);
  }
  return recur(input, 0);
}
var Circular = "[Circular]";
function formatPropertyKey(name) {
  return typeof name === "string" ? JSON.stringify(name) : String(name);
}
function formatDate(date) {
  try {
    return date.toISOString();
  } catch {
    return "Invalid Date";
  }
}
function safeToString(input) {
  try {
    const s = input.toString();
    return typeof s === "string" ? s : String(s);
  } catch {
    return "[toString threw]";
  }
}
function safeGet(input, key) {
  try {
    return input[key];
  } catch {
    return "[property access threw]";
  }
}

// ../../Package/Effect/Distribution/Inspectable.js
var NodeInspectSymbol = Symbol.for("nodejs.util.inspect.custom");
var toJson = (input) => {
  try {
    input = redact(input);
    if (hasProperty(input, "toJSON") && isFunction(input["toJSON"]) && input["toJSON"].length === 0) {
      return input.toJSON();
    } else if (Array.isArray(input)) {
      return input.map(toJson);
    }
    return input;
  } catch {
    return "[toJSON threw]";
  }
};
var BaseProto = {
  toJSON() {
    return toJson(this);
  },
  [NodeInspectSymbol]() {
    return this.toJSON();
  },
  toString() {
    return format(this.toJSON());
  }
};
var Class2 = class {
  /**
   * Node.js custom inspection method.
   *
   * **When to use**
   *
   * Use to expose the class JSON representation to Node.js inspection.
   *
   * @category Annotation
   * @since 1.0.0
   */
  [NodeInspectSymbol]() {
    return this.toJSON();
  }
  /**
   * Returns a formatted string representation of this object.
   *
   * **When to use**
   *
   * Use to format the class JSON representation as a string.
   *
   * @category Annotation
   * @since 1.0.0
   */
  toString() {
    return format(this.toJSON());
  }
};

// ../../Package/Effect/Distribution/Internal/stackTraceLimit.js
var isStackTraceLimitWritable = () => {
  const desc = Object.getOwnPropertyDescriptor(Error, "stackTraceLimit");
  if (desc === void 0) {
    return Object.isExtensible(Error);
  }
  return Object.hasOwn(desc, "writable") ? desc.writable === true : desc.set !== void 0;
};
var canWriteStackTraceLimit = isStackTraceLimitWritable();
var getStackTraceLimit = () => Error.stackTraceLimit;
var setStackTraceLimit = (value) => {
  if (canWriteStackTraceLimit) {
    ;
    Error.stackTraceLimit = value;
  }
};

// ../../Package/Effect/Distribution/Utils.js
var SingleShotGen = class {
  constructor(self) {
    this.value = self;
    this.done = false;
  }
  /**
   * Yields the stored value once, then completes with the value sent back in.
   *
   * **When to use**
   *
   * Use to advance a `SingleShotGen` through its single yield and completion
   * step.
   *
   * @category Annotation
   * @since 1.0.0
   */
  next(a) {
    if (this.done) {
      this.value = a;
      return this;
    }
    this.done = true;
    return {
      value: this.value,
      done: false
    };
  }
};
var pickInternalCall = () => {
  const InternalTypeId = "~effect/Utils/internal";
  const standard = {
    [InternalTypeId]: (body) => {
      return body();
    }
  };
  const forced = {
    [InternalTypeId]: (body) => {
      try {
        return body();
      } finally {
      }
    }
  };
  const limit = getStackTraceLimit();
  if (limit === 0) {
    return forced[InternalTypeId];
  }
  setStackTraceLimit(2);
  const error = standard[InternalTypeId](() => new Error());
  setStackTraceLimit(limit);
  return error.stack?.includes(InternalTypeId) === true ? standard[InternalTypeId] : forced[InternalTypeId];
};
var internalCall = pickInternalCall();

// ../../Package/Effect/Distribution/Internal/core.js
var EffectTypeId = "~effect/Effect";
var ExitTypeId = "~effect/Exit";
var effectVariance = {
  _A: identity,
  _E: identity,
  _R: identity
};
var identifier = `${EffectTypeId}/identifier`;
var args = `${EffectTypeId}/args`;
var evaluate = `${EffectTypeId}/evaluate`;
var contA = `${EffectTypeId}/successCont`;
var contE = `${EffectTypeId}/failureCont`;
var contAll = `${EffectTypeId}/ensureCont`;
var Yield = Symbol.for("effect/Effect/Yield");
var PipeInspectableProto = {
  pipe() {
    return pipeArguments(this, arguments);
  },
  toJSON() {
    return { ...this };
  },
  toString() {
    return format(this.toJSON(), {
      ignoreToString: true,
      space: 2
    });
  },
  [NodeInspectSymbol]() {
    return this.toJSON();
  }
};
var StructuralProto = {
  [symbol]() {
    return structureKeys(this, Object.keys(this));
  },
  [symbol2](that) {
    const selfKeys = Object.keys(this);
    const thatKeys = Object.keys(that);
    if (selfKeys.length !== thatKeys.length) {
      return false;
    }
    for (let i = 0; i < selfKeys.length; i++) {
      if (selfKeys[i] !== thatKeys[i] || !equals(this[selfKeys[i]], that[selfKeys[i]])) {
        return false;
      }
    }
    return true;
  }
};
var EffectProto = {
  [EffectTypeId]: effectVariance,
  ...PipeInspectableProto,
  [Symbol.iterator]() {
    return new SingleShotGen(this);
  },
  toJSON() {
    return {
      _id: "Effect",
      op: this[identifier],
      ...args in this ? { args: this[args] } : void 0
    };
  }
};
var isExit = (u) => hasProperty(u, ExitTypeId);
var CauseTypeId = "~effect/Cause";
var CauseReasonTypeId = "~effect/Cause/Reason";
var isCause = (self) => hasProperty(self, CauseTypeId);
var CauseImpl = class {
  constructor(failures) {
    this[CauseTypeId] = CauseTypeId;
    this.reasons = failures;
  }
  pipe() {
    return pipeArguments(this, arguments);
  }
  toJSON() {
    return {
      _id: "Cause",
      failures: this.reasons.map((f) => f.toJSON())
    };
  }
  toString() {
    return `Cause(${format(this.reasons)})`;
  }
  [NodeInspectSymbol]() {
    return this.toJSON();
  }
  [symbol2](that) {
    return isCause(that) && this.reasons.length === that.reasons.length && this.reasons.every((e, i) => equals(e, that.reasons[i]));
  }
  [symbol]() {
    return array(this.reasons);
  }
};
var annotationsMap = /* @__PURE__ */ new WeakMap();
var ReasonBase = class {
  [CauseReasonTypeId];
  annotations;
  _tag;
  constructor(_tag, annotations, originalError) {
    this[CauseReasonTypeId] = CauseReasonTypeId;
    this._tag = _tag;
    if (annotations !== constEmptyAnnotations && typeof originalError === "object" && originalError !== null && annotations.size > 0) {
      const prevAnnotations = annotationsMap.get(originalError);
      if (prevAnnotations) {
        annotations = new Map([
          ...prevAnnotations,
          ...annotations
        ]);
      }
      annotationsMap.set(originalError, annotations);
    }
    this.annotations = annotations;
  }
  annotate(annotations, options) {
    if (annotations.mapUnsafe.size === 0) {
      return this;
    }
    const newAnnotations = new Map(this.annotations);
    annotations.mapUnsafe.forEach((value, key) => {
      if (options?.overwrite !== true && newAnnotations.has(key)) {
        return;
      }
      newAnnotations.set(key, value);
    });
    const self = Object.assign(Object.create(Object.getPrototypeOf(this)), this);
    self.annotations = newAnnotations;
    return self;
  }
  pipe() {
    return pipeArguments(this, arguments);
  }
  toString() {
    return format(this);
  }
  [NodeInspectSymbol]() {
    return this.toString();
  }
};
var constEmptyAnnotations = /* @__PURE__ */ new Map();
var Fail = class extends ReasonBase {
  constructor(error, annotations = constEmptyAnnotations) {
    super("Fail", annotations, error);
    this.error = error;
  }
  toString() {
    return `Fail(${format(this.error)})`;
  }
  toJSON() {
    return {
      _tag: "Fail",
      error: this.error
    };
  }
  [symbol2](that) {
    return isFailReason(that) && equals(this.error, that.error) && equals(this.annotations, that.annotations);
  }
  [symbol]() {
    return combine(string(this._tag))(combine(hash(this.error))(hash(this.annotations)));
  }
};
var causeFromReasons = (reasons) => new CauseImpl(reasons);
var dedupeReasons = (self, that) => {
  const buckets = /* @__PURE__ */ new Map();
  const out = [];
  for (const reason of self.concat(that)) {
    const hash2 = hash(reason);
    const bucket = buckets.get(hash2);
    if (bucket === void 0) {
      buckets.set(hash2, [reason]);
    } else if (bucket.some((previous) => equals(previous, reason))) {
      continue;
    } else {
      bucket.push(reason);
    }
    out.push(reason);
  }
  return out;
};
var causeCombine = dual(2, (self, that) => {
  if (self.reasons.length === 0) {
    return that;
  } else if (that.reasons.length === 0) {
    return self;
  }
  const newCause = new CauseImpl(dedupeReasons(self.reasons, that.reasons));
  return equals(self, newCause) ? self : newCause;
});
var causeAddInterrupts = (self, interrupts) => {
  const reasons = self.reasons.slice();
  for (const reason of interrupts.reasons) {
    if (isInterruptReason(reason) && !reasons.some((r) => isInterruptReason(r) && r.fiberId === reason.fiberId && r.annotations === reason.annotations)) {
      reasons.push(reason);
    }
  }
  return reasons.length === self.reasons.length ? self : new CauseImpl(reasons);
};
var causeEmpty = new CauseImpl([]);
var causeFail = (error) => new CauseImpl([new Fail(error)]);
var Die = class extends ReasonBase {
  constructor(defect, annotations = constEmptyAnnotations) {
    super("Die", annotations, defect);
    this.defect = defect;
  }
  toString() {
    return `Die(${format(this.defect)})`;
  }
  toJSON() {
    return {
      _tag: "Die",
      defect: this.defect
    };
  }
  [symbol2](that) {
    return isDieReason(that) && equals(this.defect, that.defect) && equals(this.annotations, that.annotations);
  }
  [symbol]() {
    return combine(string(this._tag))(combine(hash(this.defect))(hash(this.annotations)));
  }
};
var causeDie = (defect) => new CauseImpl([new Die(defect)]);
var causeAnnotate = dual((args2) => isCause(args2[0]), (self, annotations, options) => {
  if (annotations.mapUnsafe.size === 0) {
    return self;
  }
  return new CauseImpl(self.reasons.map((f) => f.annotate(annotations, options)));
});
var isFailReason = (self) => self._tag === "Fail";
var isDieReason = (self) => self._tag === "Die";
var isInterruptReason = (self) => self._tag === "Interrupt";
function defaultEvaluate(_fiber) {
  return exitDie("Effect.evaluate: Not implemented");
}
var makePrimitiveProto = (options) => ({
  ...EffectProto,
  [identifier]: options.op,
  [evaluate]: options[evaluate] ?? defaultEvaluate,
  [contA]: options[contA],
  [contE]: options[contE],
  [contAll]: options[contAll]
});
var makePrimitive = (options) => {
  const Proto = makePrimitiveProto(options);
  const PrimitiveImpl = function(value) {
    this[args] = value;
  };
  PrimitiveImpl.prototype = Proto;
  return function(value) {
    return new PrimitiveImpl(value);
  };
};
var makeExit = (options) => {
  const Proto = {
    [ExitTypeId]: ExitTypeId,
    _tag: options.op,
    get [options.prop]() {
      return this[args];
    },
    ...makePrimitiveProto(options),
    toString() {
      return `${options.op}(${format(this[args])})`;
    },
    toJSON() {
      return {
        _id: "Exit",
        _tag: options.op,
        [options.prop]: this[args]
      };
    },
    [symbol2](that) {
      return isExit(that) && that._tag === this._tag && equals(this[args], that[args]);
    },
    [symbol]() {
      return combine(string(options.op), hash(this[args]));
    }
  };
  const ExitPrimitive = function(value) {
    this[args] = value;
  };
  ExitPrimitive.prototype = Proto;
  return function(value) {
    return new ExitPrimitive(value);
  };
};
var exitSucceed = makeExit({
  op: "Success",
  prop: "value",
  [evaluate](fiber) {
    const cont = fiber.getCont(contA);
    return cont ? cont[contA](this[args], fiber, this) : fiber.yieldWith(this);
  }
});
var StackTraceKey = {
  key: "effect/Cause/StackTrace"
};
var exitFailCause = makeExit({
  op: "Failure",
  prop: "cause",
  [evaluate](fiber) {
    let cause = this[args];
    let annotated = false;
    if (fiber.cache.stackFrame) {
      cause = causeAnnotate(cause, { mapUnsafe: /* @__PURE__ */ new Map([[StackTraceKey.key, fiber.cache.stackFrame]]) });
      annotated = true;
    }
    let cont = fiber.getCont(contE);
    const interruptedCause = fiber._interruptedCause;
    if (interruptedCause && fiber.interruptible) {
      let skippedHandler = false;
      while (cont && fiber.interruptible) {
        skippedHandler ||= identifier in cont;
        cont = fiber.getCont(contE);
      }
      if (skippedHandler) {
        cause = causeFromReasons(cause.reasons.filter((reason) => reason._tag !== "Fail"));
      }
      cause = causeAddInterrupts(cause, interruptedCause);
      annotated = true;
    }
    return cont ? cont[contE](cause, fiber, annotated ? void 0 : this) : fiber.yieldWith(annotated ? exitFailCause(cause) : this);
  }
});
var exitFail = (e) => exitFailCause(causeFail(e));
var exitDie = (defect) => exitFailCause(causeDie(defect));
var withFiber = makePrimitive({
  op: "WithFiber",
  [evaluate](fiber) {
    return this[args](fiber);
  }
});
var withFiberSucceed = makePrimitive({
  op: "WithFiberSucceed",
  [evaluate](fiber) {
    const value = this[args](fiber);
    const cont = fiber.getCont(contA);
    return cont ? cont[contA](value, fiber) : fiber.yieldWith(exitSucceed(value));
  }
});
var YieldableError = (function() {
  class YieldableError2 extends globalThis.Error {
  }
  const proto = makePrimitiveProto({
    op: "YieldableError",
    [evaluate]() {
      return exitFail(this);
    }
  });
  delete proto.toString;
  Object.assign(YieldableError2.prototype, proto);
  return YieldableError2;
})();
var Error2 = (function() {
  const plainArgsSymbol = Symbol.for("effect/Data/Error/plainArgs");
  return class Base extends YieldableError {
    constructor(args2) {
      super(args2?.message, args2?.cause ? { cause: args2.cause } : void 0);
      if (args2) {
        assignProperties(this, args2);
        Object.defineProperty(this, plainArgsSymbol, {
          value: args2,
          enumerable: false
        });
      }
    }
    toJSON() {
      return {
        ...this[plainArgsSymbol],
        ...this
      };
    }
  };
})();
var TaggedError = (tag) => {
  class Base extends Error2 {
    _tag = tag;
  }
  ;
  Base.prototype.name = tag;
  return Base;
};
var NoSuchElementErrorTypeId = "~effect/Cause/NoSuchElementError";
var NoSuchElementError = class extends TaggedError("NoSuchElementError") {
  [NoSuchElementErrorTypeId] = NoSuchElementErrorTypeId;
  constructor(message) {
    super({ message });
  }
};
var DoneTypeId = "~effect/Cause/Done";
var DoneVoid = {
  [DoneTypeId]: DoneTypeId,
  _tag: "Done",
  value: void 0
};
var doneVoid = exitFail(DoneVoid);

// ../../Package/Effect/Distribution/Option.js
var Option_exports = {};
__export(Option_exports, {
  Do: () => Do,
  TypeId: () => TypeId3,
  all: () => all,
  andThen: () => andThen,
  as: () => as,
  asVoid: () => asVoid,
  bind: () => bind2,
  bindTo: () => bindTo2,
  composeK: () => composeK,
  contains: () => contains,
  containsWith: () => containsWith,
  exists: () => exists,
  filter: () => filter,
  filterMap: () => filterMap,
  firstSomeOf: () => firstSomeOf,
  flatMap: () => flatMap,
  flatMapNullishOr: () => flatMapNullishOr,
  flatten: () => flatten,
  fromIterable: () => fromIterable,
  fromNullOr: () => fromNullOr,
  fromNullishOr: () => fromNullishOr,
  fromUndefinedOr: () => fromUndefinedOr,
  gen: () => gen,
  getFailure: () => getFailure2,
  getOrElse: () => getOrElse,
  getOrNull: () => getOrNull,
  getOrThrow: () => getOrThrow,
  getOrThrowWith: () => getOrThrowWith,
  getOrUndefined: () => getOrUndefined,
  getSuccess: () => getSuccess2,
  isNone: () => isNone2,
  isOption: () => isOption2,
  isSome: () => isSome2,
  let: () => letInternal,
  lift2: () => lift2,
  liftNullishOr: () => liftNullishOr,
  liftPredicate: () => liftPredicate,
  liftThrowable: () => liftThrowable,
  makeCombinerFailFast: () => makeCombinerFailFast,
  makeEquivalence: () => makeEquivalence,
  makeOrder: () => makeOrder,
  makeReducer: () => makeReducer,
  makeReducerFailFast: () => makeReducerFailFast,
  map: () => map,
  match: () => match,
  none: () => none2,
  orElse: () => orElse,
  orElseResult: () => orElseResult,
  orElseSome: () => orElseSome,
  partitionMap: () => partitionMap,
  product: () => product,
  productMany: () => productMany,
  reduceCompact: () => reduceCompact,
  some: () => some2,
  tap: () => tap,
  toArray: () => toArray,
  toRefinement: () => toRefinement,
  void: () => _void,
  zipLeft: () => zipLeft,
  zipRight: () => zipRight,
  zipWith: () => zipWith
});

// ../../Package/Effect/Distribution/Combiner.js
function make(combine4) {
  return { combine: combine4 };
}

// ../../Package/Effect/Distribution/Reducer.js
function make2(combine4, initialValue, combineAll) {
  return {
    combine: combine4,
    initialValue,
    combineAll: combineAll ?? ((collection) => {
      let out = initialValue;
      for (const value of collection) {
        out = combine4(out, value);
      }
      return out;
    })
  };
}

// ../../Package/Effect/Distribution/Equivalence.js
var make3 = (isEquivalent) => (self, that) => self === that || isEquivalent(self, that);
var Number2 = make3((self, that) => globalThis.Number.isNaN(self) && globalThis.Number.isNaN(that));
var combine2 = dual(2, (self, that) => make3((x, y) => self(x, y) && that(x, y)));
var mapInput2 = dual(2, (self, f) => make3((x, y) => self(f(x), f(y))));
function Struct(fields) {
  const keys2 = Reflect.ownKeys(fields);
  return make3((self, that) => {
    for (const key of keys2) {
      if (!fields[key](self[key], that[key])) {
        return false;
      }
    }
    return true;
  });
}
var Date2 = mapInput2(Number2, (d) => d.getTime());

// ../../Package/Effect/Distribution/Internal/doNotation.js
var let_ = (map3) => dual(3, (self, name, f) => map3(self, (a) => ({
  ...a,
  [name]: f(a)
})));
var bindTo = (map3) => dual(2, (self, name) => map3(self, (a) => ({ [name]: a })));
var bind = (map3, flatMap2) => dual(3, (self, name, f) => flatMap2(self, (a) => map3(f(a), (b) => ({
  ...a,
  [name]: b
}))));

// ../../Package/Effect/Distribution/Internal/option.js
var TypeId = "~effect/Option";
var CommonProto = {
  [TypeId]: {
    _A: (_) => _
  },
  ...PipeInspectableProto,
  [Symbol.iterator]() {
    return new SingleShotGen(this);
  }
};
var SomeProto = Object.defineProperty(Object.assign(Object.create(CommonProto), {
  _tag: "Some",
  _op: "Some",
  [symbol2](that) {
    return isOption(that) && isSome(that) && equals(this.value, that.value);
  },
  [symbol]() {
    return combine(hash(this._tag))(hash(this.value));
  },
  toString() {
    return `some(${format(this.value)})`;
  },
  toJSON() {
    return {
      _id: "Option",
      _tag: this._tag,
      value: toJson(this.value)
    };
  }
}), "valueOrUndefined", {
  get() {
    return this.value;
  }
});
var NoneHash = hash("None");
var NoneProto = Object.assign(Object.create(CommonProto), {
  _tag: "None",
  _op: "None",
  valueOrUndefined: void 0,
  [symbol2](that) {
    return isOption(that) && isNone(that);
  },
  [symbol]() {
    return NoneHash;
  },
  toString() {
    return "none()";
  },
  toJSON() {
    return {
      _id: "Option",
      _tag: this._tag
    };
  }
});
var isOption = (input) => hasProperty(input, TypeId);
var isNone = (fa) => fa._tag === "None";
var isSome = (fa) => fa._tag === "Some";
var none = Object.create(NoneProto);
var SomeImpl = function(value) {
  this.value = value;
};
SomeImpl.prototype = SomeProto;
var some = (value) => new SomeImpl(value);

// ../../Package/Effect/Distribution/Order.js
function make4(compare) {
  return (self, that) => self === that ? 0 : compare(self, that);
}
var String2 = make4((self, that) => self < that ? -1 : 1);
var Number3 = make4((self, that) => {
  if (globalThis.Number.isNaN(self) && globalThis.Number.isNaN(that)) {
    return 0;
  }
  if (globalThis.Number.isNaN(self)) {
    return -1;
  }
  if (globalThis.Number.isNaN(that)) {
    return 1;
  }
  return self < that ? -1 : 1;
});
var Boolean2 = make4((self, that) => self < that ? -1 : 1);
var BigInt = make4((self, that) => self < that ? -1 : 1);
var combine3 = dual(2, (self, that) => make4((a1, a2) => {
  const out = self(a1, a2);
  if (out !== 0) {
    return out;
  }
  return that(a1, a2);
}));
var mapInput3 = dual(2, (self, f) => make4((b1, b2) => self(f(b1), f(b2))));
var Date3 = mapInput3(Number3, (date) => date.getTime());
function Struct2(fields) {
  const keys2 = Object.keys(fields);
  return make4((self, that) => {
    for (const key of keys2) {
      const o = fields[key](self[key], that[key]);
      if (o !== 0) {
        return o;
      }
    }
    return 0;
  });
}

// ../../Package/Effect/Distribution/Internal/result.js
var TypeId2 = "~effect/Result";
var CommonProto2 = {
  [TypeId2]: {
    /* v8 ignore next 2 */
    _A: (_) => _,
    _E: (_) => _
  },
  ...PipeInspectableProto,
  [Symbol.iterator]() {
    return new SingleShotGen(this);
  }
};
var SuccessProto = Object.assign(Object.create(CommonProto2), {
  _tag: "Success",
  _op: "Success",
  [symbol2](that) {
    return isResult(that) && isSuccess(that) && equals(this.success, that.success);
  },
  [symbol]() {
    return combine(hash(this._tag))(hash(this.success));
  },
  toString() {
    return `success(${format(this.success)})`;
  },
  toJSON() {
    return {
      _id: "Result",
      _tag: this._tag,
      value: toJson(this.success)
    };
  }
});
var FailureProto = Object.assign(Object.create(CommonProto2), {
  _tag: "Failure",
  _op: "Failure",
  [symbol2](that) {
    return isResult(that) && isFailure(that) && equals(this.failure, that.failure);
  },
  [symbol]() {
    return combine(hash(this._tag))(hash(this.failure));
  },
  toString() {
    return `failure(${format(this.failure)})`;
  },
  toJSON() {
    return {
      _id: "Result",
      _tag: this._tag,
      failure: toJson(this.failure)
    };
  }
});
var isResult = (input) => hasProperty(input, TypeId2);
var isFailure = (result) => result._tag === "Failure";
var isSuccess = (result) => result._tag === "Success";
var FailureImpl = function(failure) {
  this.failure = failure;
};
FailureImpl.prototype = FailureProto;
var fail = (failure) => new FailureImpl(failure);
var SuccessImpl = function(success) {
  this.success = success;
};
SuccessImpl.prototype = SuccessProto;
var succeed = (success) => new SuccessImpl(success);
var getFailure = (self) => isSuccess(self) ? none : some(self.failure);
var getSuccess = (self) => isFailure(self) ? none : some(self.success);
var fromOption = dual(2, (self, onNone) => isNone(self) ? fail(onNone()) : succeed(self.value));

// ../../Package/Effect/Distribution/Option.js
var TypeId3 = "~effect/Option";
var none2 = () => none;
var some2 = some;
var isOption2 = isOption;
var isNone2 = isNone;
var isSome2 = isSome;
var match = dual(2, (self, { onNone, onSome }) => isNone2(self) ? onNone() : onSome(self.value));
var toRefinement = (f) => (a) => isSome2(f(a));
var fromIterable = (collection) => {
  for (const a of collection) {
    return some2(a);
  }
  return none2();
};
var getSuccess2 = getSuccess;
var getFailure2 = getFailure;
var getOrElse = dual(2, (self, onNone) => isNone2(self) ? onNone() : self.value);
var orElse = dual(2, (self, that) => isNone2(self) ? that() : self);
var orElseSome = dual(2, (self, onNone) => isNone2(self) ? some2(onNone()) : self);
var orElseResult = dual(2, (self, that) => isNone2(self) ? map(that(), succeed) : map(self, fail));
var firstSomeOf = (collection) => {
  let out = none2();
  for (out of collection) {
    if (isSome2(out)) {
      return out;
    }
  }
  return out;
};
var fromNullishOr = (a) => a == null ? none2() : some2(a);
var fromUndefinedOr = (a) => a === void 0 ? none2() : some2(a);
var fromNullOr = (a) => a === null ? none2() : some2(a);
var liftNullishOr = (f) => (...a) => fromNullishOr(f(...a));
var getOrNull = getOrElse(constNull);
var getOrUndefined = getOrElse(constUndefined);
var liftThrowable = (f) => (...a) => {
  try {
    return some2(f(...a));
  } catch {
    return none2();
  }
};
var getOrThrowWith = dual(2, (self, onNone) => {
  if (isSome2(self)) {
    return self.value;
  }
  throw onNone();
});
var getOrThrow = getOrThrowWith(() => new Error("getOrThrow called on a None"));
var map = dual(2, (self, f) => isNone2(self) ? none2() : some2(f(self.value)));
var as = dual(2, (self, b) => map(self, () => b));
var asVoid = as(void 0);
var _void = some2(void 0);
var flatMap = dual(2, (self, f) => isNone2(self) ? none2() : f(self.value));
var andThen = dual(2, (self, f) => flatMap(self, (a) => {
  const b = isFunction(f) ? f(a) : f;
  return isOption2(b) ? b : some2(b);
}));
var flatMapNullishOr = dual(2, (self, f) => isNone2(self) ? none2() : fromNullishOr(f(self.value)));
var flatten = flatMap(identity);
var zipRight = dual(2, (self, that) => flatMap(self, () => that));
var zipLeft = dual(2, (self, that) => tap(self, () => that));
var composeK = dual(2, (afb, bfc) => (a) => flatMap(afb(a), bfc));
var tap = dual(2, (self, f) => flatMap(self, (a) => map(f(a), () => a)));
var product = dual(2, (self, that) => isSome2(self) && isSome2(that) ? some2([self.value, that.value]) : none2());
var productMany = dual(2, (self, collection) => {
  if (isNone2(self)) {
    return none2();
  }
  const out = [self.value];
  for (const o of collection) {
    if (isNone2(o)) {
      return none2();
    }
    out.push(o.value);
  }
  return some2(out);
});
var all = (input) => {
  if (Symbol.iterator in input) {
    const out2 = [];
    for (const o of input) {
      if (isNone2(o)) {
        return none2();
      }
      out2.push(o.value);
    }
    return some2(out2);
  }
  const out = {};
  for (const key of Object.keys(input)) {
    const o = input[key];
    if (isNone2(o)) {
      return none2();
    }
    assignProperty(out, key, o.value);
  }
  return some2(out);
};
var zipWith = dual(3, (self, that, f) => map(product(self, that), ([a, b]) => f(a, b)));
var reduceCompact = dual(3, (self, b, f) => {
  let out = b;
  for (const oa of self) {
    if (isSome2(oa)) {
      out = f(out, oa.value);
    }
  }
  return out;
});
var toArray = (self) => isNone2(self) ? [] : [self.value];
var partitionMap = dual(2, (self, f) => {
  if (isNone2(self)) {
    return [none2(), none2()];
  }
  const e = f(self.value);
  return isFailure(e) ? [none2(), some2(e.failure)] : [some2(e.success), none2()];
});
var filterMap = dual(2, (self, f) => {
  if (isNone2(self)) {
    return none2();
  }
  const next = f(self.value);
  return isSuccess(next) ? some2(next.success) : none2();
});
var filter = dual(2, (self, predicate) => isNone2(self) ? none2() : predicate(self.value) ? some2(self.value) : none2());
var makeEquivalence = (isEquivalent) => make3((x, y) => isNone2(x) ? isNone2(y) : isNone2(y) ? false : isEquivalent(x.value, y.value));
var makeOrder = (O) => make4((self, that) => isSome2(self) ? isSome2(that) ? O(self.value, that.value) : 1 : -1);
var lift2 = (f) => dual(2, (self, that) => zipWith(self, that, f));
var liftPredicate = dual(2, (b, predicate) => predicate(b) ? some2(b) : none2());
var containsWith = (isEquivalent) => dual(2, (self, a) => isNone2(self) ? false : isEquivalent(self.value, a));
var contains = containsWith(asEquivalence());
var exists = dual(2, (self, refinement) => isNone2(self) ? false : refinement(self.value));
var bindTo2 = bindTo(map);
var letInternal = let_(map);
var bind2 = bind(map, flatMap);
var Do = some2({});
var gen = (...args2) => {
  const f = args2.length === 1 ? args2[0] : args2[1].bind(args2[0]);
  const iterator = f();
  let state = iterator.next();
  while (!state.done) {
    const current = state.value;
    if (isNone2(current)) {
      return current;
    }
    state = iterator.next(current.value);
  }
  return some2(state.value);
};
function makeReducer(combiner) {
  return make2((self, that) => {
    if (isNone2(self)) {
      return that;
    }
    if (isNone2(that)) {
      return self;
    }
    return some2(combiner.combine(self.value, that.value));
  }, none2());
}
function makeCombinerFailFast(combiner) {
  return make((self, that) => {
    if (isNone2(self) || isNone2(that)) {
      return none2();
    }
    return some2(combiner.combine(self.value, that.value));
  });
}
function makeReducerFailFast(reducer) {
  const combine4 = makeCombinerFailFast(reducer).combine;
  const initialValue = some2(reducer.initialValue);
  return make2(combine4, initialValue, (collection) => {
    let out = initialValue;
    for (const value of collection) {
      out = combine4(out, value);
      if (isNone2(out)) {
        return out;
      }
    }
    return out;
  });
}

// ../../Package/Effect/Distribution/Struct.js
var Struct_exports = {};
__export(Struct_exports, {
  Record: () => Record,
  assign: () => assign,
  evolve: () => evolve,
  evolveEntries: () => evolveEntries,
  evolveKeys: () => evolveKeys,
  get: () => get,
  keys: () => keys,
  lambda: () => lambda,
  makeCombiner: () => makeCombiner,
  makeEquivalence: () => makeEquivalence2,
  makeOrder: () => makeOrder2,
  makeReducer: () => makeReducer2,
  map: () => map2,
  mapOmit: () => mapOmit,
  mapPick: () => mapPick,
  omit: () => omit,
  pick: () => pick,
  renameKeys: () => renameKeys
});
var get = dual(2, (self, key) => self[key]);
var keys = (self) => Object.keys(self);
var pick = dual(2, (self, keys2) => {
  return buildStruct(self, (k, v) => hasPropertyKey(keys2, k) ? [k, v] : void 0);
});
var omit = dual(2, (self, keys2) => {
  return buildStruct(self, (k, v) => !hasPropertyKey(keys2, k) ? [k, v] : void 0);
});
var assign = dual(2, (self, that) => {
  return {
    ...self,
    ...that
  };
});
var evolve = dual(2, (self, e) => {
  return buildStruct(self, (k, v) => [k, Object.hasOwn(e, k) ? e[k](v) : v]);
});
var evolveKeys = dual(2, (self, e) => {
  return buildStruct(self, (k, v) => [Object.hasOwn(e, k) ? e[k](k) : k, v]);
});
var evolveEntries = dual(2, (self, e) => {
  return buildStruct(self, (k, v) => Object.hasOwn(e, k) ? e[k](k, v) : [k, v]);
});
var renameKeys = dual(2, (self, mapping) => {
  return buildStruct(self, (k, v) => [Object.hasOwn(mapping, k) ? mapping[k] : k, v]);
});
var makeEquivalence2 = Struct;
var makeOrder2 = Struct2;
var lambda = (f) => f;
var map2 = dual(2, (self, lambda2) => {
  return buildStruct(self, (k, v) => [k, lambda2(v)]);
});
var mapPick = dual(3, (self, keys2, lambda2) => {
  return buildStruct(self, (k, v) => [k, hasPropertyKey(keys2, k) ? lambda2(v) : v]);
});
var mapOmit = dual(3, (self, keys2, lambda2) => {
  return buildStruct(self, (k, v) => [k, !hasPropertyKey(keys2, k) ? lambda2(v) : v]);
});
function hasPropertyKey(keys2, key) {
  return keys2.some((candidate) => candidate === key || typeof candidate === "number" && String(candidate) === key);
}
function buildStruct(source, f) {
  const out = {};
  for (const k of Reflect.ownKeys(source)) {
    if (!Object.prototype.propertyIsEnumerable.call(source, k)) {
      continue;
    }
    const res = f(k, source[k]);
    if (res) {
      const [nk, nv] = res;
      assignProperty(out, nk, nv);
    }
  }
  return out;
}
function makeCombiner(combiners, options) {
  const omitKeyWhen = options?.omitKeyWhen ?? (() => false);
  return make((self, that) => {
    const keys2 = Reflect.ownKeys(combiners);
    const out = {};
    for (const key of keys2) {
      const merge = combiners[key].combine(self[key], that[key]);
      if (omitKeyWhen(merge)) {
        continue;
      }
      assignProperty(out, key, merge);
    }
    return out;
  });
}
function makeReducer2(reducers, options) {
  const combine4 = makeCombiner(reducers, options).combine;
  const initialValue = {};
  for (const key of Reflect.ownKeys(reducers)) {
    const iv = reducers[key].initialValue;
    if (options?.omitKeyWhen?.(iv)) {
      continue;
    }
    assignProperty(initialValue, key, iv);
  }
  return make2(combine4, initialValue);
}
function Record(keys2, value) {
  const out = {};
  for (const key of keys2) {
    assignProperty(out, key, value);
  }
  return out;
}

// ../../Package/Bedform/Source/DDUI/Direction.ts
import { Direction } from "@minecraft/server";
var Directions = Object.freeze([
  Direction.Up,
  Direction.Down,
  Direction.North,
  Direction.South,
  Direction.East,
  Direction.West
]);
var Arrows = Object.freeze(["\u2191", "\u2193", "\u2197", "\u2199", "\u2192", "\u2190"]);
var ChoiceLabel = (index, style) => {
  const resolved = typeof style === "string" ? {
    main: style,
    prefix: "arrow",
    suffix: void 0
  } : {
    main: "localized",
    prefix: "arrow",
    suffix: "xyz",
    ...style
  };
  const part = (format2) => format2 === "localized" ? { translate: `bedform.direction.${Directions[index].toLowerCase()}` } : { text: format2 === "arrow" ? Arrows[index] : DirectionAxes[index] };
  return { rawtext: [
    ...resolved.prefix === void 0 ? [] : [part(resolved.prefix), { text: " " }],
    part(resolved.main),
    ...resolved.suffix === void 0 ? [] : [{ text: " (" }, part(resolved.suffix), { text: ")" }]
  ] };
};
var DirectionInput = (value) => {
  return {
    read: () => Option_exports.getOrUndefined(value.getData()),
    subscribe: (listener) => {
      const callback = (data) => listener(Option_exports.getOrUndefined(data));
      value.subscribe(callback);
      return () => {
        value.unsubscribe(callback);
      };
    },
    write: (snapshot) => {
      if (snapshot === void 0) {
        value.clear();
      } else if (Directions.includes(snapshot)) {
        value.setData(snapshot);
      } else {
        throw new TypeError(`Cannot write ${String(snapshot)} to a direction observable.`);
      }
    }
  };
};
function direction(label, value, items, options) {
  const Choices = items ?? Directions.map((label2) => ({ label: label2 }));
  const Indices = Choices.map((item) => Directions.indexOf(item.label));
  if (Indices.length === 0 || Indices.some((index) => index < 0) || new Set(Indices).size !== Indices.length) {
    throw new Error("A direction dropdown requires a nonempty list of distinct valid directions.");
  }
  const Preview = typeof options?.imagePreview === "object" ? options.imagePreview : {};
  const ShowImage = options?.imagePreview !== false && (Preview.displayImage ?? true);
  const Labels = Preview.showAxisLabels === false ? void 0 : Preview.showAxisLabels === void 0 || Preview.showAxisLabels === true ? "xyz" : Preview.showAxisLabels;
  const Mask = Indices.reduce((mask, index) => mask | 1 << index, 0);
  const Selected = (data) => Option_exports.isSome(data) && Choices.some((item) => item.label === data.value) ? Directions.indexOf(data.value) : -1;
  const ImagePath = (selected) => DirectionPreviewPath(
    selected,
    Mask,
    Labels,
    Preview.excludedValuesStyle ?? "dim"
  );
  const Initial = Selected(value.getData());
  const Index = new ObservableNumber(Initial, { clientWritable: true });
  const Image = ShowImage ? new ObservableString(ImagePath(Initial)) : void 0;
  const Items = Choices.map((item, index) => ({
    ...Struct_exports.pick(item, ["description"]),
    label: ChoiceLabel(Indices[index], options?.choiceLabelStyle),
    value: Indices[index]
  }));
  let Updating = false;
  Index.subscribe((selected) => {
    if (Updating) {
      return;
    }
    if (Indices.includes(selected)) {
      value.setData(Directions[selected]);
    } else {
      Index.setData(Selected(value.getData()));
    }
  });
  value.subscribe((data) => {
    Updating = true;
    try {
      const selected = Selected(data);
      Index.setData(selected);
      Image?.setData(ImagePath(selected));
    } finally {
      Updating = false;
    }
  });
  const AddImage = () => {
    if (Image !== void 0) {
      this.image(Image, DirectionResourcePack, {
        tooltip: Preview.tooltip,
        visible: options?.visible ?? true,
        width: 0.5
      });
    }
  };
  if ((Preview.imagePosition ?? "before") === "before") {
    AddImage();
  }
  Untracked(this, () => this.dropdown(
    label,
    Index,
    Items,
    Struct_exports.pick(options ?? {}, ["description", "disabled", "tooltip", "visible"])
  ));
  RegisterInput(this, DirectionInput(value));
  if (Preview.imagePosition === "after") {
    AddImage();
  }
  return this;
}

// ../../Package/Bedform/Source/DDUI/Transactional.ts
import { ObservableBoolean } from "@minecraft/server-ui";

// ../../Package/Bedform/Source/Internal/TransactionalAssets.ts
var TransactionalIcon = Object.freeze({
  Cancel: "textures/bedform/transactional/cancel.png",
  Confirm: "textures/bedform/transactional/confirm.png",
  Redo: "textures/bedform/transactional/redo.png",
  Reset: "textures/bedform/transactional/reset.png",
  Undo: "textures/bedform/transactional/undo.png"
});
var TransactionalText = Object.freeze({
  Cancel: Object.freeze({
    English: "Cancel",
    Key: "bedform.transactional.cancel"
  }),
  Complete: Object.freeze({
    English: "Reset complete!",
    Key: "bedform.transactional.complete"
  }),
  Confirm: Object.freeze({
    English: "Reset",
    Key: "bedform.transactional.confirm"
  }),
  Question: Object.freeze({
    English: "Are you sure?",
    Key: "bedform.transactional.question"
  }),
  Redo: Object.freeze({
    English: "Redo",
    Key: "bedform.transactional.redo"
  }),
  Reset: Object.freeze({
    English: "Reset",
    Key: "bedform.transactional.reset"
  }),
  Undo: Object.freeze({
    English: "Undo",
    Key: "bedform.transactional.undo"
  })
});

// ../../Package/Bedform/Source/Internal/TransactionHistory.ts
var Same = (left, right) => {
  return left === right || Number.isNaN(left) && Number.isNaN(right);
};
var TransactionHistory = class {
  ChunkWindow;
  HistoryLimit;
  Now;
  Inputs = [];
  Known = /* @__PURE__ */ new Map();
  Initial = /* @__PURE__ */ new Map();
  Unsubscribes = [];
  Listeners = /* @__PURE__ */ new Set();
  Entries = [];
  Cursor = 0;
  Open = void 0;
  TurnInput = void 0;
  LastTime = 0;
  InTurn = false;
  Applying = 0;
  Disposed = false;
  constructor(options) {
    this.ChunkWindow = options?.chunkWindow ?? 1e3;
    this.HistoryLimit = options?.historyLimit ?? 100;
    this.Now = options?.now ?? Date.now;
    if (!Number.isFinite(this.ChunkWindow) || this.ChunkWindow < 0) {
      throw new RangeError("A transaction chunk window must be a finite, nonnegative number.");
    }
    if (!Number.isSafeInteger(this.HistoryLimit) || this.HistoryLimit < 1) {
      throw new RangeError("A transaction history limit must be a positive integer.");
    }
  }
  /**
   * Whether an entry can be undone.
   *
   * @category Getter
   * @since 1.0.0
   */
  get canUndo() {
    return this.Cursor > 0;
  }
  /**
   * Whether an undone entry can be redone.
   *
   * @category Getter
   * @since 1.0.0
   */
  get canRedo() {
    return this.Cursor < this.Entries.length;
  }
  /**
   * Whether any tracked input differs from the value it held when tracked.
   *
   * @category Getter
   * @since 1.0.0
   */
  get canReset() {
    return this.Inputs.some((input) => !Same(this.Known.get(input), this.Initial.get(input)));
  }
  /**
   * Starts recording an input, taking its current value as both its initial
   * and last known value. Tracking an input again, or after disposal, does nothing.
   *
   * @category Registry
   * @since 1.0.0
   */
  track(input) {
    if (this.Disposed || this.Known.has(input)) {
      return;
    }
    const value = input.read();
    this.Inputs.push(input);
    this.Known.set(input, value);
    this.Initial.set(input, value);
    this.Unsubscribes.push(input.subscribe((snapshot) => this.Changed(input, snapshot)));
  }
  /**
   * Calls the listener after each recorded edit, undo, redo and reset, until
   * the returned function is called.
   *
   * @category Observable
   * @since 1.0.0
   */
  subscribe(listener) {
    const callback = (event) => listener(event);
    this.Listeners.add(callback);
    return () => {
      this.Listeners.delete(callback);
    };
  }
  /**
   * Ends the open chunk, so the next edit begins a new entry.
   *
   * @category Mutation
   * @since 1.0.0
   */
  seal() {
    this.Open = void 0;
    this.TurnInput = void 0;
  }
  /**
   * Restores the latest entry's earlier values, last change first. Returns
   * false when there is nothing to undo.
   *
   * @category Mutation
   * @since 1.0.0
   */
  undo() {
    if (this.Disposed || !this.canUndo) {
      return false;
    }
    this.seal();
    this.Cursor--;
    const changes = [...this.Entries[this.Cursor]].reverse();
    this.Apply(changes.map(([input, change]) => [input, change.Before]));
    this.Notify("Undo");
    return true;
  }
  /**
   * Reapplies the earliest undone entry's later values, in their original
   * order. Returns false when there is nothing to redo.
   *
   * @category Mutation
   * @since 1.0.0
   */
  redo() {
    if (this.Disposed || !this.canRedo) {
      return false;
    }
    this.seal();
    const changes = [...this.Entries[this.Cursor]];
    this.Cursor++;
    this.Apply(changes.map(([input, change]) => [input, change.After]));
    this.Notify("Redo");
    return true;
  }
  /**
   * Records one entry returning every changed input to its initial value,
   * then applies it, discarding any undone entries. Returns false, recording
   * nothing, when every input already holds its initial value.
   *
   * @category Mutation
   * @since 1.0.0
   */
  reset() {
    if (this.Disposed) {
      return false;
    }
    this.seal();
    const entry = /* @__PURE__ */ new Map();
    for (const input of this.Inputs) {
      const before = this.Known.get(input);
      const after = this.Initial.get(input);
      if (!Same(before, after)) {
        entry.set(input, {
          After: after,
          Before: before
        });
      }
    }
    if (entry.size === 0) {
      return false;
    }
    this.Push(entry);
    this.Apply([...entry].map(([input, change]) => [input, change.After]));
    this.Notify("Reset");
    return true;
  }
  /**
   * Stops observing every tracked input and listener; later calls do nothing.
   *
   * @category Lifecycle
   * @since 1.0.0
   */
  dispose() {
    this.Disposed = true;
    for (const unsubscribe of this.Unsubscribes.splice(0)) {
      unsubscribe();
    }
    this.Listeners.clear();
  }
  /**
   * Records a reported input value according to the chunking rules.
   *
   * @category Mutation
   * @since 1.0.0
   */
  Changed(input, value) {
    const before = this.Known.get(input);
    if (this.Disposed || Same(value, before)) {
      return;
    }
    this.Known.set(input, value);
    if (this.Applying > 0) {
      return;
    }
    const now = this.Now();
    const merge = this.Open !== void 0 && (this.InTurn || input === this.TurnInput && now - this.LastTime < this.ChunkWindow);
    if (!this.InTurn) {
      this.InTurn = true;
      this.TurnInput = input;
      void Promise.resolve().then(() => {
        this.InTurn = false;
      });
    }
    this.LastTime = now;
    if (merge && this.Open !== void 0) {
      const change = this.Open.get(input);
      if (change === void 0) {
        this.Open.set(input, {
          After: value,
          Before: before
        });
      } else {
        change.After = value;
      }
      if ([...this.Open.values()].every((item) => Same(item.Before, item.After))) {
        this.Entries.splice(this.Entries.indexOf(this.Open), 1);
        this.Cursor = this.Entries.length;
        this.Open = void 0;
      }
    } else {
      this.Open = /* @__PURE__ */ new Map([[input, {
        After: value,
        Before: before
      }]]);
      this.Push(this.Open);
    }
    this.Notify("Record");
  }
  /**
   * Discards undone entries, appends an entry and drops the oldest entries
   * beyond the history limit.
   *
   * @category Mutation
   * @since 1.0.0
   */
  Push(entry) {
    this.Entries.length = this.Cursor;
    this.Entries.push(entry);
    if (this.Entries.length > this.HistoryLimit) {
      this.Entries.splice(0, this.Entries.length - this.HistoryLimit);
    }
    this.Cursor = this.Entries.length;
  }
  /**
   * Writes values in order, updating each known value first, without
   * recording the writes or anything they cause.
   *
   * @category Mutation
   * @since 1.0.0
   */
  Apply(values) {
    this.Applying++;
    try {
      for (const [input, value] of values) {
        this.Known.set(input, value);
        input.write(value);
      }
    } finally {
      this.Applying--;
    }
  }
  /**
   * Reports a state change to every listener.
   *
   * @category Observable
   * @since 1.0.0
   */
  Notify(event) {
    for (const listener of [...this.Listeners]) {
      listener(event);
    }
  }
};

// ../../Package/Bedform/Source/DDUI/Transactional.ts
var Forms = /* @__PURE__ */ new WeakSet();
var Button = (label, icon, onClick, disabled, compact = false) => {
  return {
    label: compact ? "" : label,
    onClick,
    options: {
      ...disabled === void 0 ? {} : { disabled },
      ...compact ? { tooltip: label } : {},
      imageDetails: {
        imagePackId: CommonResourcePack,
        imageSrc: icon
      }
    }
  };
};
function transactional(options) {
  if (Forms.has(this)) {
    throw new Error("A CustomForm can have only one transactional component.");
  }
  const History = new TransactionHistory({
    ...options?.chunkWindow === void 0 ? {} : { chunkWindow: options.chunkWindow },
    ...options?.historyLimit === void 0 ? {} : { historyLimit: options.historyLimit }
  });
  Forms.add(this);
  const UndoDisabled = new ObservableBoolean(true);
  const RedoDisabled = new ObservableBoolean(true);
  const ResetDisabled = new ObservableBoolean(true);
  const Open = new ObservableBoolean(false);
  const Asking = new ObservableBoolean(false);
  const Done = new ObservableBoolean(false);
  const Text2 = (text) => ({ translate: text.Key });
  const Update = () => {
    UndoDisabled.setData(!History.canUndo);
    RedoDisabled.setData(!History.canRedo);
    ResetDisabled.setData(!History.canReset);
  };
  const Collapse = () => {
    Open.setData(false);
    Asking.setData(false);
    Done.setData(false);
  };
  History.subscribe((event) => {
    Update();
    if (event !== "Reset") {
      Collapse();
    }
  });
  const Compact = options?.IsCompact === true;
  const Row = [
    Button(
      Text2(TransactionalText.Undo),
      TransactionalIcon.Undo,
      () => History.undo(),
      UndoDisabled,
      Compact
    ),
    Button(
      Text2(TransactionalText.Redo),
      TransactionalIcon.Redo,
      () => History.redo(),
      RedoDisabled,
      Compact
    )
  ];
  const Reset = Button(Text2(TransactionalText.Reset), TransactionalIcon.Reset, () => {
    History.seal();
    Open.setData(true);
    Asking.setData(true);
    Done.setData(false);
  }, ResetDisabled, Compact);
  if (options?.reset === true && Compact) {
    Row.push(Reset);
  }
  this.multiButtonRow(Row);
  if (options?.reset === true && !Compact) {
    this.button(Reset.label, Reset.onClick, Reset.options);
  }
  if (options?.reset === true) {
    this.spacer({ visible: Open });
    this.label(Text2(TransactionalText.Question), { visible: Asking });
    this.multiButtonRow([
      Button(Text2(TransactionalText.Cancel), TransactionalIcon.Cancel, Collapse),
      Button(Text2(TransactionalText.Confirm), TransactionalIcon.Confirm, () => {
        History.reset();
        Asking.setData(false);
        Done.setData(true);
      })
    ], { visible: Asking });
    this.label({ rawtext: [{ text: "\xA7e" }, Text2(TransactionalText.Complete)] }, { visible: Done });
    this.divider({ visible: Open });
  }
  ObserveInputs(this, (input) => {
    History.track(input);
    Update();
  });
  Update();
  return this;
}

// ../../Package/Bedform/Source/DDUI/CustomForm.ts
import {
  CustomForm as NativeCustomForm,
  ObservableNumber as ObservableNumber2
} from "@minecraft/server-ui";
var CustomForm = class extends NativeCustomForm {
  /* eslint-disable @typescript-eslint/typedef */
  /** {@inheritDoc Direction!direction} */
  direction = direction;
  /** {@inheritDoc Transactional!transactional} */
  transactional = transactional;
  /* eslint-enable @typescript-eslint/typedef */
  /**
   * Adds a native text field and registers its bound text observable.
   *
   * @category Builder
   * @since 1.0.0
   */
  textField(label, text, options) {
    super.textField(label, text, options);
    RegisterInput(this, ObservableInput(text));
    return this;
  }
  /**
   * Adds a native toggle and registers its bound boolean observable.
   *
   * @category Builder
   * @since 1.0.0
   */
  toggle(label, toggled, options) {
    super.toggle(label, toggled, options);
    RegisterInput(this, ObservableInput(toggled));
    return this;
  }
  /**
   * Adds a native slider and registers its bound value observable. Observable
   * bounds are not tracked.
   *
   * @category Builder
   * @since 1.0.0
   */
  slider(label, value, min, max, options) {
    super.slider(label, value, min, max, options);
    RegisterInput(this, ObservableInput(value));
    return this;
  }
  dropdown(label, value, items, options) {
    if (Array.isArray(items) && value instanceof ObservableNumber2 && items.every(
      (item) => typeof item === "object" && "label" in item && "value" in item && typeof item.value === "number"
    )) {
      super.dropdown(label, value, items, options);
      RegisterInput(this, ObservableInput(value));
      return this;
    }
    const observable = value;
    const entries = Array.isArray(items) ? items.map((text) => [text, text]) : Array.from(items);
    const selected = () => entries.findIndex(
      (entry) => Object.is(entry[1], observable.getData())
    );
    const index = new ObservableNumber2(selected(), { clientWritable: true });
    super.dropdown(label, index, entries.map(
      (entry, position) => ({
        label: entry[0],
        value: position
      })
    ), options);
    let updating = false;
    index.subscribe((position) => {
      if (updating) {
        return;
      }
      if (Number.isInteger(position) && position >= 0 && position < entries.length) {
        observable.setData(entries[position][1]);
      } else {
        index.setData(selected());
      }
    });
    observable.subscribe(() => {
      updating = true;
      try {
        index.setData(selected());
      } finally {
        updating = false;
      }
    });
    const snapshots = [];
    const snapshot = (data) => {
      const existing = snapshots.findIndex((item) => Object.is(item, data));
      return existing < 0 ? snapshots.push(data) - 1 : existing;
    };
    RegisterInput(this, {
      read: () => snapshot(observable.getData()),
      subscribe: (listener) => {
        const callback = observable.subscribe((data) => listener(snapshot(data)));
        return () => {
          observable.unsubscribe(callback);
        };
      },
      write: (data) => {
        if (typeof data !== "number" || !Number.isInteger(data) || data < 0 || data >= snapshots.length) {
          throw new TypeError("Invalid dropdown history snapshot.");
        }
        observable.setData(snapshots[data]);
      }
    });
    return this;
  }
};

// Source/CharacterSets.js
function Range(First, Last) {
  return Array.from({ length: Last - First + 1 }, (_, Index) => String.fromCodePoint(First + Index));
}
var CharacterSets = Object.freeze([
  { Name: "Braille", Ranges: "2800-28FF", Characters: Range(10240, 10495) },
  { Name: "Block elements", Ranges: "2580-259F", Characters: Range(9600, 9631) },
  { Name: "Shading", Ranges: "2591-2593", Characters: Range(9617, 9619) },
  { Name: "Quadrants", Ranges: "2596-259F", Characters: Range(9622, 9631) },
  { Name: "Box drawing", Ranges: "2500-257F", Characters: Range(9472, 9599) },
  { Name: "Sextants", Ranges: "1FB00-1FB3B", Characters: Range(129792, 129851) },
  // The other 26 of the 256 octant patterns reuse existing block, quadrant and sextant characters.
  { Name: "Octants", Ranges: "1CD00-1CDE5", Characters: Range(118016, 118245) },
  { Name: "Geometric shapes", Ranges: "25A0-25FF", Characters: Range(9632, 9727) },
  { Name: "Arrows", Ranges: "2190-21FF", Characters: Range(8592, 8703) },
  {
    Name: "Diagonal lines",
    Ranges: "2571-2573 / 1FBA0-1FBAE / 1FBD0-1FBDF",
    Characters: [...Range(9585, 9587), ...Range(129952, 129966), ...Range(13e4, 130015)]
  },
  {
    Name: "Mathematical Monospace",
    Ranges: "1D670-1D6A3 / 1D7F6-1D7FF",
    Characters: [...Range(120432, 120483), ...Range(120822, 120831)]
  },
  {
    Name: "Fullwidth Latin and digits",
    Ranges: "FF21-FF3A / FF41-FF5A / FF10-FF19",
    TextColor: "\xA7d",
    Characters: [...Range(65313, 65338), ...Range(65345, 65370), ...Range(65296, 65305)]
  }
].map((Set2) => Object.freeze({ ...Set2, Characters: Object.freeze(Set2.Characters) })));
function CharacterChart(Set2) {
  const Rows = [];
  for (let Index = 0; Index < Set2.Characters.length; Index += 16) {
    Rows.push(Set2.Characters.slice(Index, Index + 16).join(" "));
  }
  return `${Set2.Name} (${Set2.Characters.length})
${Set2.Ranges}
${Rows.join("\n")}`;
}
var GroupSeparator = "";
var RightToLeftOverride = "\u202E";
var SeparatorTestText = [
  "a".repeat(20),
  "a" + GroupSeparator + "a".repeat(19),
  "a" + GroupSeparator.repeat(10) + "a".repeat(19),
  "a" + GroupSeparator + "a".repeat(3) + RightToLeftOverride + GroupSeparator + RightToLeftOverride + "a".repeat(16)
].join("\n");

// Source/GlyphWidths.js
var MissingGlyphWidth = 9;
var LargeFontCharacters = "\0 !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~\xA1\xA3\xA7\xA9\xAA\xAB\xAC\xAE\xB0\xB1\xB2\xB7\xBA\xBB\xBC\xBD\xBF\xC0\xC1\xC2\xC3\xC4\xC5\xC6\xC7\xC8\xC9\xCA\xCB\xCD\xCF\xD1\xD3\xD4\xD5\xD6\xD7\xD8\xDA\xDC\xDD\xDF\xE0\xE1\xE2\xE3\xE4\xE5\xE6\xE7\xE8\xE9\xEA\xEB\xEC\xED\xEE\xEF\xF1\xF2\xF3\xF4\xF5\xF6\xF7\xF8\xF9\xFA\xFB\xFC\xFD\xFF\u0104\u0105\u0106\u0107\u010C\u010D\u010E\u010F\u0118\u0119\u011A\u011B\u011E\u011F\u0130\u0131\u0139\u013A\u013D\u013E\u0141\u0142\u0143\u0144\u0147\u0148\u0150\u0151\u0152\u0153\u0154\u0155\u0158\u0159\u015A\u015B\u015E\u015F\u0160\u0161\u0164\u0165\u016E\u016F\u0170\u0171\u0174\u0175\u0179\u017A\u017B\u017C\u017D\u017E\u0192\u0207\u0386\u0388\u0389\u038A\u038C\u038E\u038F\u0390\u0391\u0392\u0393\u0394\u0395\u0396\u0397\u0398\u0399\u039A\u039B\u039C\u039D\u039E\u039F\u03A0\u03A1\u03A3\u03A4\u03A5\u03A6\u03A7\u03A8\u03A9\u03AA\u03AB\u03AC\u03AD\u03AE\u03AF\u03B0\u03B1\u03B2\u03B3\u03B4\u03B5\u03B6\u03B7\u03B8\u03B9\u03BA\u03BB\u03BC\u03BD\u03BE\u03BF\u03C0\u03C1\u03C2\u03C3\u03C4\u03C5\u03C6\u03C7\u03C8\u03C9\u03CA\u03CB\u03CC\u03CD\u03CE\u0401\u0404\u0406\u0407\u0410\u0411\u0412\u0413\u0414\u0415\u0416\u0417\u0418\u0419\u041A\u041B\u041C\u041D\u041E\u041F\u0420\u0421\u0422\u0423\u0424\u0425\u0426\u0427\u0428\u0429\u042A\u042B\u042C\u042D\u042E\u042F\u0430\u0431\u0432\u0433\u0434\u0435\u0436\u0437\u0438\u0439\u043A\u043B\u043C\u043D\u043E\u043F\u0440\u0441\u0442\u0443\u0444\u0445\u0446\u0447\u0448\u0449\u044A\u044B\u044C\u044D\u044E\u044F\u0451\u0454\u0456\u0457\u0490\u0491\u2013\u2014\u2018\u2019\u201C\u201D\u201E\u2026\u207F\u2122\u2205\u2208\u2219\u221A\u221E\u2229\u2248\u2261\u2264\u2265\u2320\u2321\u2500\u2502\u250C\u2510\u2514\u2518\u251C\u2524\u252C\u2534\u253C\u2550\u2551\u2552\u2553\u2554\u2555\u2556\u2557\u2558\u2559\u255A\u255B\u255C\u255D\u255E\u255F\u2560\u2561\u2562\u2563\u2564\u2565\u2566\u2567\u2568\u2569\u256A\u256B\u256C\u2580\u2584\u2588\u258C\u2590\u2591\u2592\u2593\u25A0";
var LargeFontWidths = "B848<<<<4888<4<4<<<<<<<<<<<44:<:<><<<<<<<<8<<<<<<<<<<<<<<<<<8<8<<6<<<<<:<<4<:6<<<<<<<8<<<<<<848>4<<@:><@:<:<:>@@<<<<<<<@<<<<<88<<<<<<<<<<<<<<<<<@<<<<<66:8<<<<<<<<<<<<<<<<<<<<<@<<<<<<84<6<8>:<<<<<<BB<<<<<<<<<<<:<<<<<<<<<<<<<<@@@<@@@:<<<<<<<<8<<<<<<<<<<<<<<<8<<<<6<<<<<<<<<6:<<<<<<<<><<<<<@8B<<@<<88<<<<><@<<<<<<<<<<<<<@<><@B>@<<@<<<<:><<<<<:<<<<<<<<<<<<<<>>><<@<<<48<<BB66<::<:B@<<>@<>><<@:B<B<B<B<BBBB@BBB<@@BBB<@@BBB<@@BBBBBBBBBBBB:B@BB<";
var UnicodeFontPages = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143, 144, 145, 146, 147, 148, 149, 150, 151, 152, 153, 154, 155, 156, 157, 158, 159, 160, 161, 162, 163, 164, 165, 166, 167, 168, 169, 170, 171, 172, 173, 174, 175, 176, 177, 178, 179, 180, 181, 182, 183, 184, 185, 186, 187, 188, 189, 190, 191, 192, 193, 194, 195, 196, 197, 198, 199, 200, 201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 213, 214, 215, 224, 225, 249, 250, 251, 252, 253, 254, 255];
var UnicodeFontWidthTable = "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB83789993559948488788888888447878888888888798888889889898898585895888887887787988888878898885359BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB39989386:788B:85977578455788888888888988888777798888888888889888888889888887777888888888888887888889988888888889988888888888888888888:988778877778798998878787879788998888888889999889988888888889797978888888899898998988888869988888999988888897988778878998888889998887797999889988888888878357399999:999887788888888888888888999988888888888999888888889988998899889988998899889988889788888987888888888888889869879999989988889889999988998888889988988989988888887578869999998899988988888887778789888989998888888889788898899999998898797767797775844466886699663666366655667777846589987577777777767887755658884555588855888:84866883688844445555855557666486465389888888::86:8:586984:557475886488895B558655:54778:::::::775776669667678976689BB48884BBBBB3785888B8B99788898888789888898B899989979888588898878857888888889889899688898899999998888878787:9878888:888998887877888898888889888778:9988998888:89888888888889998989:9888888888989888888888889898989:988888888888777:988887999899999999998899889899999999998898988:@@9988888899889988889999::999999888899979799::9988888888799889988998899588889988888899888888888888888898989988888887888888999999::9988998888::::::988988::::BBBBBBBBBBBBB98998888998898888989898889898988897889BB4456577B989989789987998889997898899989988699899B48BBBBBB88888888988899:9988888888888998888888888888888838858868BBBBBBBB898885788588799568988788898BBBBB99958BBBBBBBBBBBBBBBBB>=>79<47>99;<=<9:88884BB59B6958583878888888889999888899888:888878<88888888888988888888888B567988999974498:8788579998888888888888888888888888988988889999988888888889@9888999999989888888886888888888888988889966=<89:9;BA8888;879:8A888889567989899999868<;4444888888@?@BBB8>@@88@<5@@@6@?<????@@@@=8@?@@98888888888888;;8888888888:8BB<@@8888888888899888889997788888898898857898889999985898766666688767=677867:96588===886666888889898886BBBBBBBBBBBBBB88766578873897777876677687887868777766778878888888885579556BBBBB<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<B:8;@AABBBBBBBBBBAAAABBBBBBBBBBBBBBBB?B?BBBBB@BBBBBBBBBBBBBB8;===9988899:====8BB@8888BBBBBBBBBBBBB::47:8;:>::=<:74ABBBBBBBBBB:BBB8=<BBBBBBBA@BB@@BB@@B@@B>BBBB@BBBB?BAB>BBABBBBBBBBBBBABBBBB8@=?>8988BB==BBBB8:BBBBBBBB=BBBBBBBBA:9<BB<;<>==>;?>BB;>;>>4==@BBBBBB88=BBBBABBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB8B><=99BBBB::BB::<BBB9BBBBBBBBBBBBBBBBBBBB<::;9>;:<<88BB?8BBBBBBBBBBB88=B@B:;:>?>@B@@BBBB8=<;;>;=;<778;=:;7::B<9?>;;9B;<B:<:=;BB87===9988<B<<=B==9BB@BBBBBBBBBBBBBBB@>:<BB<::;<<<<9:B?BBBBBBBBBBBBBBB8==B=?<<<=;8BB8<BB9==::;>:;:;<:9;;;<;<9;B;>;<==:B==B;;;<<BB87:;::989BB=@BB?@8BBBBBBBB;;BBBB;;B?<8;;BB<::<:<::99=;BBBBBBBBBBBBBBBB8>B<><<=?BBB>>=B==@=BBB=<B=B>;BBBB=BBB=?7BBB:;:<=?;=?>>ABBBB=<8=:BBB==ABBBB8BBBBBBBBB=BBBBBBBBBBBBBB8=?>??@>=@;=?=?B:@B>@BBBBBB===B==;=>@?<B<<<B;;<9<7>;>>;=<=9====999<B<<>?>>9===B<:=<>BBB:=89====B99:B<><:BBBBBBB::B>;BBBBBBB@;>BB8:=8:;>:?>BBBBBBBB9379<::<BB==B==;>>A@<B>>>B>>>:><?>??<=<=9==>;999<B>>>>??9=<=B><?<;BB88=8=====B<>>B>>>:BBBBBBB==BBBBBBB=BBA;=BB8:9<:>>:<>B9=BBBBBBBBBBBBBBB==B@B=?9=;=B??BB<>?>??@>=>>A?98>=>>>:==B>>>:<>=;=<;>>>??BBB9=======B===BBBB=BBBBBBBBB=BBBBBBBB>?==BB8=>?:<@9;=>=@<<=BBB@?=;>=?BB==B<AAA;;;@BB@B;>B??BBBB?==<=@;?=A@A?;===A=?=:=@B9===?==;9B=BB=><<?>=BBB=BBBB===;;;B;B==B=BBB=BBBBBBBBBBBBBBBBBB==ABBBBBBBBBBBB8788887887898887899888878779999888788878998989768788888464BBBB84798878837956468888888889879BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB88B8BB78B8BB8BBBBBB8889B888:999B888B8B8BB8:B8876969787846B988BB47889B8B379565BB8878888888BB::BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB99??:8::8894B474489:6:@AA869959987889999999999999999598899??889999999999B998998989989999999999989989989999999BBBB88988898999::88899959889999BBBB99999999B998998999999999999999999999999999999B9997899=?A==AAAB==?87?:BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB?::@9:?;<;>;9:<?==99;:99<9=;=9<=9>==>;;9:AB<=8889=888889=88<@88A;978877797368:=?99998:==899;:98889<<<89<<<<<<<??=9898:::>>>>===9>99==88<<<=<=99<8787899888BBBB7;99997999779979989789978777888879988799BBBBBBBBBB777977897797797897889797877788777777787778777BBB9999999997;79:999:9>>>>>>>>>>=>>>>@@?@@>>>>;>======@?=======<<:=;==>=>?=====7>;=>>>>;<><>=BBBBBBB66665858???<??<?<??<3=?????<????????>?????????@????@???88???66:?;<BBBBB9;<9;<99;;;<;<<99<;=79;99:9?@>>=@>>>A>>B>@AAB=@>>?>>>=A???9>>?9<===;=?>>7=?>:????9BBBBBB:>:99;=@9==9=:>=<@@<?<<@>A@>@==?<?@<><<@:<;=<:<=9==9<99<;>>;>;;=<<<<<<<<=BA<<@BB<<<<<=<B=BA<<@BB9==9==9<;>>;>>;=>>>>>>>>>>>>>?>>:>>:>:>>?B@=>?BB799;8:=;<===<<==9==9=99;;??;?;;=?B@>??BB=AA=A>=BBBB@ABBB=A===A=@:>>;>::B9==9=<9<>??>??>>9:<9<==@<>=:==;=:>=:=<;=<?><>><?9=<9<;99>B>9<>BB:=<:<;9;;??;?=;>ABB@B@@@:>>:>=:=:>>:==:=:>>:>::=<;<<=:<<<<<<<<<<<>=BBBB:<4888874:;;::;;;<::<<<:<:=;:>BBBBB?A=>;@=><<==<>46446>8@@8BBBBBB8999979888898889889888888988898989888998899899889988999999899888998999899998988988898BBBBBBBBBBBB999988888889999999999899998987669966965777998899998888888999999999999998636999999999999999999999999997999977777787799999999999999966999977777787799999999999999966777777877999999999999999666689999999999999999999999999999999999999999999687877778779999999999999995858555=>==999999999999999999999988888888899999999999999967779999997777779956899999999:9799999999999979999=99999999999787=======977779999AAAAAAA9A88889999999999999999999799999777788889999999999888899888899888899999988888888889888999979988889988989988987889999998898888888999=====::????<<7777<<9999999999;;::::>>????99<<<<9999<<<<============7==================95=AAAAAAABBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB@@BBB9989897779979669997999999799959793599979996735997877799995899999?9?99993979559999BBBBBBBBBBBBBBB@@:@>@@@;@>@@B@;??;:8BBBBBBBBBBB??9;;;<=>?:>><<@@<;:>7<BBBBBBBBB==:;9=@=:>9<><<<=9;:BBBBBBBBBBBB@@5=?@@@?@>@@B@@?B;:BBBBBBBBBBBB:8:=9<:?=89;?>>::<;8;:;;;=7=8;<<=<==?9>9:;:;=;<:;9::BB<:9::888>BB===AA8=<8:8::8<;<B88:6@B9B87:BB9;==<:;?<=BBBBBB673:775957BBBBBB?499:A47<<4BBBBB>>>>>=>>=>BBBBBB<>=<<<<<>=<=<?==;=:<9:9:8>==99=>>987<<<><<::<>><:8::989>=9?=:?9:=8:@=><<<;:>>>=<<=>:?9><BBBBBBBB<6:==8A<=>>:989999=?@?><8<><=;>==<>>>>7:==>BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB;8<;;=;::8;:;;:8=;;::999;<7:;BBB:::<==>:;=<<BBBB==8;===;=:89BBBB;BBB6;9:;9=99:;:777998998696969:79836666666669BB97787BBBBBBBBBBB::;8;;::8:;89;;8;9;9<<;;:;9;<;:;;8;98;;9;;BBBBBB=================7:7;;8;==BBBBBB:;87:;8=@9BBBB>>;7;;887;97>>@@>>98;;798;98>>@@>>9<7:<99<999<<<?@?7??9??<====BB:7BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB;989=>A=B:=<A?B:B=B@@??=<>=BB==><B@<<><<=A>=?<A<B=<A8=::==:>>A<=AB:?=@B@<<<BBBBB6A?=7::A=@BB698>767778::5A5888889988768866684BBB8:<:89=:9:>?:9==;><<7><<?:=8:9><><:988==88=BBBAA::9:9@9:<9BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB;9:<>9:<<=8::;;;<<;9:;:<==8;;<99;9=;=====@==888898;;==;8BBB3679<76::::;787BBB;;=7888888888888889888988989899998:99:8899944495736BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB78998787877787788999977788898899988889899898787977788777777787889888889778888876988877878898989898788889798:997:9999:89888>77999997987998898888899998<887:887777776776778756999978767899787799878888888999899:88998999:8888888888888888BBBBBBBBBBBBBBBBBBBBBBB8898888888888888888888888888888887887878888899887788888887878787898989888888888888888888888888888888888888889797979888888888889897898989797977889888888887988677887888888889897878789898788888888888888888777788888888888888999999999988889999999999989898989:87888888889999999999888888BB999999BB88888888999999995577778899999999888888BB999999BB88888888B:B:B:B:99999999::::::9988888855888899BB8888888899999999888888889999999999999999::::::::88888B888899845488888B88999987787688BB887799B7788888888899::9884BB999B9999::944BBBBBBBBBBBBBBBBB66889:5:4444888899764794BBBBBBBB::6::6::755968888896855888797794898:896B7739733BBBBBBBBBBBBBBBBB73BB777777777447757777777777744B77787BBBBBBBBBBB888:9999998889998:8::8BBBBBBBBBBBBBBBBBBBBBBBBBB88998888:::89A@AA:@@?88?8:=888888BBBBBBBBBBBBBBB99998998899::98979:8:9::9899:988::::889988789887888:989898=@==9=<8889<<98989?:7?BBB888889888888858999:::999988895899999:9999589988;8899:?BBBBBBB8787:788889999:7:799878779999::8777797::8888885588558:88:8:889:98787:7888899::77979788:9:99999999997?::::=>>?::>968889998888888998899887669998988884868998879:79:888884888888899488888888888988888888888888888888888888888::68778888888888888888888888888888888888888999999999999988996688988888888888999977778899887477777778998899787799888888888888888888884:::=;8;;8;;=;8;8;99877775666666668999999:98:86666558899:9866:9:989:9988979999999::9999999999799999779999977979999997779998869987998868988698@@?<79???>;@@=???@>>;;;;?@97??A?74774774774766646663:88@@@@@933::::77===========88?@93999AAA@@@9BBBAA@@?;@??ABBBBBBBBBBBBBBBBBBBBBBBB@@??@@?@<=======>????@@??=@@;;;;;@88898BBBBBBBBBBBBBBBBBBBBBBBBB7777778:99:BBBBBBBBBBBBBBBBBBBBBAAAAAAAAAA@@@@@@@@@@AAAAAAAAAAAAAAAAAAAA8;;<;;<;;?>@@?@@@@@?@@@@@@@@@@@@@@@@@@@@@@@@@@AAAAAAAAAAAAAAAAAAAAAAAAAA@@@@@@@@@@@@@@@@@@@@@@@@@@B@@@@@@@@@@BBBBBBBBBB@::34::34993466777777667777776677777777777777::::::::::::::::::::::::::::::::9934:5677788677788677788:::::::::6776:::63636464:4:4BBBBBBBBB@><:864:ABBB4:::BBBB:BB9999999999669966::88888866888888886688999989999999999966::::6666998888788889988:8888::::888886689:9B99978:::799999979>==?@999696:6?A?77879:==:9?????????9:::9887779889:89999:999988899998899998899799979:68::88899BAAAAAAAABAA?>;;;;;;??????????88B@?;A==?A?AABB?8==<:=A9@997==?@=9899?88:999BBB>>@@BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBA@AABAAA@BBAA>A>AA?A=A>>AAAA;??AAAAABAABAAAAAAABAAAAA?AAAAAAAAAAAAAAAA@AAAAB?B>>>>BBB?B46:99AABB@;;A?A@66777788995588AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABBB=A=AAAAAAA@@@AA9A@@AAAABBB@A=@==A=AAAAAB8=7<<779@@5B>BBB;9;88>>@;;??@@@59?AAAA7766886655==>>AAA@AA@@@@@A7777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777AAAA?@A@77;;AAAA@A99@@@@@@@@@AA@@??>>>>@?@?>>????@@@??<<66>>>>>>==@@@AAAA7@@77@5@5AA77AA77??77??77@;@;@@@@@@@@;;@AAAAA;@;;@;99;;7668866666655666677====6635?>>??==????88????>>>>;;;;;=;;;;;;=;====?>=====>??AA;==99999995599=;=@>?=@@@@;??;999999999@777999999??===:;;;@@=;;@9999=99:99;99999=86<677878977777997777;::=A;???885<::::;;666699::;;?;;==>><<?====;;;;;;==99==8888=88888=?@8>;;<<99999999::99::88::88778899999999::::;;>;?;;;;;;;;=;;;;;;;;;;;;@@==88888888==8888@@;;;;8888??;;;;;6;;=<><>>;;;;;<<77779:9=3==99=9:55====@?99====@9@@@@<<<<<<<<=@@66>>==@@9999777AA88@@@@@@@@@@@@@@@@@@@@@AA@@@@@@BBB?====BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB79999799:999:69=979899:99999:99<9998999>>@:9598B77999799:999968=878799999987997<8997889>>@98588B87988::889988888B:999779989757BB::8787:999889988::5588:99797:999:8888899::9999::999787987698::::9999:866::8899;:87886698:8:99988::998::A99ABBBBBBBBBBBBBB977968689979<8<86<77=::;78<<998868;<78:=7778;BBBBBBBBBB6999999778889979994:7989<579968393669974:9997998775969BBBBBBBBB6BBBBBBBBBBBBBBBBA??<=<<<==<;===>@>=?@=@BBBBBBBBB=??=?<>B<<<<<=>B@@@@@@@BBBBABAAB<<<<<=<B;<<;<<;B>AA>A>>B;==;=:;B8888888888888888888889888888888966666677888777?@@A4===688:8977996666668888888:846BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB;@=;A8=A<79>;=A@A@>>A>8?8AB@=;@A>7@@?@8A8A8=A8A:8==?A>AAAAAA>?AAA@8?AA?>8=AAAAA69AAA?<7AA@?AAA9:9A@AAA??AA?AAAAAAAAABBBBBBBBBBBBB38;A5BA@@AA>A8@?>??<?>A98A@A=?AAAA;AAA@AAA@=??A?=A?AA@@=>?9A?@A@AAAAAA;?=@AAA@A?A>@A?AAA>A@@A@AAAAA@=AAA=AA<AAAA>A@AAA?@?@?A@@A@>?<A>AAA??@A?AAAA??@AAA?=AAA@AAAA?AAAAA>A@AA@A@AAAA@AA@AA?@AA?>?@?@?AAAAAAA@?A?AAAAA@BBBBBBBBBBBBBBBBBBBBBBBBBBAAAAAAAAAAAABBBBB669A;<?9999889977><669966::>:::@48<?:?@A?======B8<9=:BAAAA7=?B9B<=;>9:;=<>>?;>8<>?<><><<>?>?=>=>=?<>?>?;===>>==??=>=???>>>=??;?>><<><>:<::<?<;>=>====<BB<=668:;8;<:;:<;=:=<>=>;>=><?=><=<?=>;><?=>:=?=>9;==<=:>??;<<;>>???<>>=:=<=;=;=9;<9=;<;<==;<?::?>>>6>9:<BBBBB===>=?==:?@97??9?9<?=<????<;;=<?=?3==??@?BBB>?B>AB?@=A@?A@BB=;>@>A;>A>>=??98988:8:AA?>AA>>>AA>5BABABB@BAA?@A>BABBAA==A@A@B=@=AA?B?A>>>?>5:B37::<;:::::;;;=:==9>?????<@@?@?<???78989BBBBBBBB:5;A:<<<@=:>7@<<@3887<?=<858<?=;@><?BBBBBBBBBBBB89969;89:9<98<8;@@@@@@@@@@@@@@@@@@@@@@@@@@@@AAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABBBBBBBBBBBB@AAAAAAAAAAAAAAA@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@?AAAAAAA@AA?AAAAAA?AAAAAAAAA@AAA@ABAAAA?AAA@A@AA@@AAAAAAAAAAAAAAAA?>>>>>>>>@@@?A@@???????????????????????????????????????????????B@>@>B>>B>>>>>>AA@A>B>BAAAAB>>>>>AB>>A>>===>AAAAA>?B=B>B?@>@@@@A>@>>>>>>A>=B@B>>>>>>AB>B>?@????????@@@@@@@@@@BBBBB@@@@A@?AA?BAABB@@@@A@@@AA@@A?>?@AAAA@@@@??A>??@A>A@A>AAA>AAA@AA??@?@?A?@A@@A@AA@A@>??BAA@>@?A??@@A@>@B@@A@@@A@@?>>>>>>>>??????????@@@@@@@@@@@@AAAAA@>@AA?AAA?A@AA@AA?AAAAA@A@A?AAAAAAA@AAAAAAAA@AAA@AA@AAAAAAAAA@@@AAA@AAA@AA@AA@AAAAAAAAAAAAAAA@AAA@AAAAAAAAAAAAAAAAAAAAAAAAAA@@AAAAAAAAAAA@AAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAA?A?A?AA?AAAA@AAAAAAAAAA@AAAA@@AAAAAA@A?@@@@@@?@@@@@@@@@?@@@@@@@AA@@@@@@@@@@A@@@@AAA@@@AA@@@AAAAA@@@@A@@@?@A@@@?AA@AAA@@@AA@A@@@@@@@@@@@AAA?>A?@AAAAAAAAAAAAAAAAAAA>AAAAAAAAA@AAAA@@A?@@@@@@@?@@A@@@@?@@A@@@@A@@?@?@@@A@@AA@A@A@@@@@A@@AA@AA@A@AA@@@A@@A@@@AA??AA@@@A@@@AA@@AAA@@@@?@@@A?@@AA@@AAA@@?A@?AAA@@@@A@@A@A@?@@@A@A@@@@@AA@@A@@@AAA@@A@@AAAAAAA@AAAA@AA@@@AAA@A@A????????A@AAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA?A@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAA@AA@A@AAA@AAA@AAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAA@@@A@@@AA@AAA@@AAAAA@@@@AAAA>>@=?@@A@A@@AAAA@AA@@?@@A@@A@@@@A@@AAAA?A??@@A?@@AAAAAAAAA@@@@A@@AAA@AAA@@AAA@A@@A@AAA?@AAA@AAAAA@A?AAA@AAAAA@A@A@AAAAAAAAAAAAAAA<@A@A?A@@@@@A@@A@?@@@@@@@@A@@@A@AA@@AA@@A@@@@AAAAAAAAAA@AAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@A?@?A@A@AAAAA@>AA@A@AA?AAAAAAAAAA@AAAA@A?AAAAAAAA@@@@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA?A@AA@AAAAAAAAAAAAAAAAAAAAA@AA@AAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAA@A@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAA?AAAAAAAAAAAAAAAA@AA@@@@@@@AAAAAA@AAAAAAAA@AA?A@AAAA@AAA@AAAAAA@@AAAAAAAAAAAAAA@AAAAAA@AA?AAAAA@AAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@@AAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAA@@@AAAAAAAAAAAAAA??AAAAAAAAAAAAAAAAAAAAAAAAAAAA>?A@AAAAA@>@@@@@@A@?A?AA@AAA?A@A@A@A@@@AA@@A@@@@@A@AAA@@@@A@A@?@@A@@A@A@@@AAA@@AA@@A@A@AA@AAA@AAAAAAAAAAAAAAAA?AA@AAAAAAAAAAAA@AAA@AAAAAAAAAAAAAA@@@AAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA?@AAAAAAAAAAAAAAAAAA@AAAAAAAA@AAAAAA@AAAAAAAAAAAAAAAAAA@AAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA?AAAAAA@AAAAAAA@AAAAAAAAAA@AAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAA@AA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAA@AAAAA@AAAAAAAAAAAAAAAAAA@AAAA@AAAAAAAAAAAA@A@AAA@AA@AAAAAAA@@AAAAAAAAA@AAAAAAAAAAAAAAAAAA@AAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAA@AAAA@AAAAAAAAA@AAAAAAAAAAAAAAAAAA@A@AAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA?AAAAAAA@AAAAAAAAAA?A@A@AAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@A@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@A@@?AAAAAAAAAAAAAA@AAA@AA@AAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAABAAAAAAAAAAAAAA@AAAAAA@AAAB?AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAA@?@@@A?A@=@@AAA@@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA?@?@@??@@A@@@A@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@@@@@@??@@@@??>@@@?@@@A@@@@@@@@@@@@@@@@@@@@@@@@@AA@@@@@@@AAA@@@A@@@@@@@@@@@@?@@AA@@@A@@@@@A@A@@@AAA@@@A@AAA@@A@@@AAAAA@A@AAAAAAAA@@AAAAAA@A@AAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA?A@AAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAA@A@A@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAA@AAAAAAAAA@AAA@AAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAA@AAA@A@A@AAAAAAAAAA@A@AAAAAAAA@AAA@A@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAA@AAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@A@AAAAAAAAAAAAAAAAAAAAA=AAA@@???AA@?@AAAAA?AAA@AAAAAAAAA@AAAAAAAAAAAAAAAA@A@@?A@AAAAAAAA@AAAAAAAA@AAAA@AAAAAAAAAAAAAAA@AAAA@AA@AAAA@AAAAAAAAAAAAA@AAA=AAA>AAAA@AAAA@AAAAAAAA@AAA@AAAAAAAAAAA@AAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAA@AAAA@@AAA@AAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAA@@@AAAAAAA@AAAAA@AAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@A@AAAAAAAAAAAAAA?AAAAAA@?@AAA@A@A@AAA@AAAAAAAAAA?A@AAAAAAAAA@AAAAAAAAAAAAAAAAAAA@A?AAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAA@AAAAAAA@AAAAAAAAAAAAAAA@@AAAAAAA@AAA@AAAAA@AAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@A@AAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@@A@A@AAAAAA?AAAAAAAAA@@BAAAAAAAAAAA?AAA@AA?@@AAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@@AAAAAAAAAAAAAAAAAA@AA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@>AAAA@AAA?AAAAA@AA?AAAAAAAAAAA@@AAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@A@AAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAA@@AAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@@@@AA@?@AA@A@A@@@AA@@@@AAAAAAAAA?AAAAAAAAAAAAAAAAA@AAAAAAAAAA@A@AAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAA@AAAA@AAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAA@AAA@A@AAAAAAAAA?????????????????????????????????????????????@@@@@@?@???@@@@@@@@@@@@@@@?@@@@@@@@@@@@@@@@@@@@@@@@@@@@AAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAA?AA?AAAAAAAAAAAAAAAAAAAAAA@AAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAA@A@AAAAAAAAAAAAAAA@AAAAAA@@@AAAAAAAAAAAAAAAA@AAAA@AA@AAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAA@A@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@@AA@A@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAA@AA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAA@AABAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAA?AAAAAAAAAAAA@AAAAA?AAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAA@AAAAAAAAAAAAA@AA@AAAAAAAAAAAAA?AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@@AAAA@AAAAAA@A@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAA@AAAAAAAAA@AAA@@AAAAAAAAAAAAAAAAAAAAABBBBBBBBBB????????????????????????????????????????????????????????????????A?A@AAAAAAAAA@@AAAAAAAAAAAAA?AAAAAAAAAAA39A<8=A?A@??@A7=AA?AAAA8@?A@<AA@?A?@?AAA?AAAAAAAA?=@AA@A>?@AA?@?A@A@?A?AAAAA@A?@AA@A@@AA@AAAA5>?@AAAAAAAAAAAAAAAAAAAAAAAAAAAA?AAAAAAAAAAAAAAAAAAAAA7AA?AAA@AAA@AAAAAA@A@AAAAAAAAA@AAAA@AAA@AA?AAAAAA@AAA@A@A@AAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@A@AAAA@AAAAA@A@@A@AA@AA@@A@AAAAAAA@AAAAAAAAAAAAAAAAA@AAAAA@AAAAAA@AAAAAAA@AAAAAAAAAAAAA@AAAAAAA@AA@AAAAAAAAA@A@AA@AAAAAAAA@AAA@AAAAAAAAAAAAAA@@AAAAA@AAAAAAAAAAAAAAAAA?@@AAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAA@AAAA@AAAAA@@A@AA@@AAA@AAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAA@AAAAAAAA@AAAAAA@AAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@A@AAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@?AAAAAAAA???AAAAAAAAA?AAAAAAAAA@?AAA@AAA>A@AAAAAAAAAAAAAAAA??A??A?AA?AA??===A@@AA?AAAAAAAAAAAAAAAAAA7AAA@AA@AAA@AAAAAA@AAAAAAA@AAAAA@AAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA??????A???A>>7>AAA@@@@@@?@@@@@@@@@@@@?@A@@@A@@?@@@@@@@@@@@@@A@@@@@AA@@@@@@@?@@@@?>@?@?A@A@@@@@@@A@@@AA@@@@@@@@@@@@@@AAA@@@@AA@@@@@@@@AA@A@@@AA@@@A@AAA@A@@@AAAAA@AAAAA>A@@@@A@@@@@@@@A@@@@@?A@AAA@?@@A@@@@@@@@@A@?>@AA@@A@@@@@@@@@@@AA?@AAA@@AA@?@@@@AAAAA@AA@AAAAAA@??@??@@A@@@@@@?@@@@@@A@@@@@=AA@A@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@A@@@@@@@@AAAAAAAAAAAABAABAAAAAAAAAAA8AA??A@???@@?99A?@A??@@?@?@A@@A@A?@@@AA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA>AAAAA?A@AAAAAAAAAAAAAAA@AA@AAAAAAAA?AAAAAAAA=A?>??????@@@?@AAA@@A>@@??@=@@@A@A?@@AA=@>?AA@?@@@=@?@@@A@AA@@@AA@@A@@@@A@@@@@@?AA@A@@@@?@@AA@?=@A@AAAAA@@@@@?A@@@@@@??@@@@?@@@@@@@?@?@@@?@@@A@@@?@A@@@@>@A@@@@@@@A@@@@@@@@A@@@A@@@@@@@@@@@@@A@A@@@A@A@@AA@@@??@A@@@@A@@@?@@AA?@?@@@@AAA@A?@@@@@@@?@@@@@A@A@@@=@@@AA@?A@@@A@@@@@@@@@@@@A@@A@A@@A?@@@A@A@@@@@@AAA@A@@@A@@AA@@A@@@@A@@?@@A@@@@@@?@@A@@@@@@@@AAA@@A@@@??@@@@@@A>A@@AA?A?AAA@@@@AAA@@@@@@@A?@A@A@@@@A@@@@@@@A@@@@@@@@A@A?@@@@@@@A@@@@@@@@AAA@A?@@@@@@@@?@A@A@A@A@@A@A@@A@?A@@@@AAA@@@A@AA@@@@A@@@@@AAA@A@@@@@@A@@A@@?@A@AA?A@AAAA?@A@@A@@A@@@@A@@@@@@@@AA@A@AAA@AA@@A@A@A@A@A@@?AA@@?A@AA@@@@A@@A@A@@A@A@@AAAA@@A@AA@@A@@A@@@@A@A@@@@A@AAAA@@AAAA@@A?A@@@AAA@A@@@@@A@@A@@AA@A@A@@@@@@@AA@AAA@@@AA@A@@@@@AA@>A@@A@@AAA@@@@@A@A@AAA@@AAA@@AAA@@@@@@A@AAAA@@@@A@AAAAA?@@@@A???????=??????????????????????????????????????????????????????????????AAA@AAA@AAAAAAAAAAAAAA@@AAA@A@AA@AAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAA@AAAA@AAAAAAAAAAAAAAAAAAAA@AAAAAAAA@AAAAAAAAAAAAAAAA@AAAAAAAAA@AAAAAAAAAAAAAAAAAAAA@@AAAAAAAAAAAAAAAAAA@@AAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAA>@A@A>AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAA@AA@@AAAA@@AAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAA@A@AAAAAAAAAAA@AAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AA@AAAAAAA@AAAAAAAAAAAAAAA@AAAAA@AAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA?AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@@?AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAA@AAAAAAAAAAAAAAA@?AAA?AAA?=AAAAAAAAAAAAAAAAAAAAAAAAAAAAA?AAAAAA@@@AAAA@@@A?AAAA@A?A@AA@AA@AAA@@AA@AA@AAAAAAA@A=AA=?A>@??@@@?@@?@??>>?@@?@??@A@@@@A@@AA@=@AA>?@@@@?A?A@A?@@???@@@AA@A@@?@A?A@@?@>=?@A@@@AAA=?@A?@@A@@@AA@@@A@A=@@@@A@@@A@@A@A@?AA@A?A@A>AAA@A@@A@?AAA@@AAA@AA@@@A@?AA@@A?@AAAA@AA@A@AA@AA@@@?AA=@@?@AA@A@@AAA@AA@A@A@AAAAAAA@AAAAA@??AA@AAAAAAAA@@A@@AA@AAA@AAA@@@A@AA@AAA@A@AAA@@@@A@AAAA@A@@@AA@AA@AAAAAAA@@A?A@AA?AA@@A@AAA@@AA@@AAAA@AA@AAAAAAA@AAAAA@AAA@AAA@AA@AA@AAAA==@@AAAAA?AAA>A?AAAAAA>>>?AAA@AAA?A=A???A@?@A@@@?A@@@@AA@@?@@A@A=@A@@=@@A@?A@@?@@AA@A@A@@@AA@AA@AA@@A@@A@A@@AAA@A@@AAAA@AAA@A@@@@@AAAAA@@@AA@A@A@AAAA@AAAAAAAAA>@@?A@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAA>>>A?@@?A?@@?A@@AAAAA@@@@@AAA??@AAAAAAABAAAAAAAAAAA@AAAAAAAAA>A?>AAAAAAAAAAAAA<AAA@@AAAAAAAAAAAA7@@AAAAA@AAAAAAAAAAA@AA@AAAAAAAAAAAAAAAAAAAA@AAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAA8AA@A@AAAAAAAAAAAAA?AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAA@AAAA@AAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAA@AAAA@AAAAAAAAAAAAAAA@AAAAA@A@@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAA?AAAAAAAAAAA@AABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AA@AAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAA@AAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAA@AAAAA@AAAA@AAA@AA?AAAAAAAAAAAAAAAAAAAAAAAAAA?>?@AAAAA@A@@@@@A@AAAA8A@A@@AA@@AAAA@AAAAAAAA@AAAA@A@@AAAAAAAAAAAAAAAAAA@AAAAAAAAA@AAAAAAAA@AAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAA@@AAAAAAAAAAAAAAA@AA@AAAAAA@@AA@AAAAAAAAA@AAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAA?AAAAAAA@AAAAAAAAA@AAAAAA@AAAAAAAAAAAAAAAA?AAAAAAAAAAAAAAAAAA@@AAAAA@A@A@AAAAAAAAAA@AAA@AAAAAAAAAAA@AAB@AAAAAAAAAAAAAAAAAAAAAAAAAAAA?AAAAAAA@AAA@AAAAAAAAAA@AAAAAAAA@A@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA?AAA?A@AAA?AAAAAAAAAAAAAAA@AAAAAAAA@AA@AAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAA@AAAAAAAAAAA@AA@A@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAABAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAA@AAAAA@@AAAAAAAAAAAAAAAAAAAAAAAAAAA@@AAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAA@AAAAAAAAAAAAAAAAAAAAA@AAAAAAAA@@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@@@@A;A>=A@?@AA@@AA?@=@@@A@A@@A@?@?A@@>A@@AA=???@@??A@@?AAA@AA@?@@?@@AA@@@A?>?@AAA@@?@AA@@?@A@A@@@@A@@@@@A@A?@@A@=@@@A@@@@@@?A@@@@@@@@@@A@@@@@AAA@@A@A?AA@@@AA@@@@AA@AAAA@@@@@@@@A@A@@@@@A@@A@@@A@@@@@A@A@@@@@A@A@@@A@A@AA@@@@A@@A@@@?AA@@@@?@@AAAAAA@A@@@AAAA@AAA@AA@A@AAAAAAA@?=?AAA>@AAAAA==AA@AA@AAA>AA@AAA@@A@A@AA?A@AAAAA@AAAA@AAAAAAAA@AAAAAA@AA@@AA@@AAAAAAAAAAAAA@AAAAAAA@@AAAAAAA@AAAAAAA@AAAAA@AAAAAAAAAAAAAAAAAAAAAAAA@@@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAA@AAA@AAAAAAAAAAAAAAAAAAA@AA@AAAAAA@AA@@@AAAAAAAAAAAAAAAAAA@AAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAA@AAAA@AA@A@AAAAAAAA@AAAAAAAAAAAAAAAAAA@@AAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAA@A@AAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@A@AAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@A@AAAAAAAAAAA@@AAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAA@AAA@AAAAAAAAAAAAAAAAAAAAAAAAAAA@@AA@AAAAAAAAAA@AAAAAAAA@AAAAA@AAAAA@AAAAAAAAAAAAAAAAAAAAA@AAAA@AAAAAAAAAAAAAAAAAAAAAAAAAA?AA@>A@@AA@A@AA@AAAAAAAAAAAAAAA@AAA@AAAAAAAAAAAAA@AAAAAAAA@??>AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA7AAAA@@AAAAAA@AAAAA@AA@@AAA@AAAA@AAAAAAAAAAAAAA@AAA@@AAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAA@@AAAAAAAA@AAAAAAAAA@@AAAAAA@AAAAAA@@@@@AAA@A@@A@AAAA@AAAA@A@AAAA@@AAA@AA@AAAAAAAAAAA@AAA@AAA@AAAAAAAAAAAAAAAAAAAA@AAAAAA@AAAAAAAAAAAAAA@@AAAAAAAAAAAAAAAAAAA@AA@@A@A@A@AAAAAAAA@AAAAA@AAA@AAAAAA@AAA@AAAAAAAA@AAAAAAAAAAAA@AAAAAAAAAA@AAA@AAA@AAAA?AAA@AAAAAA@A@AAAAAAAAAA@@AAAA@@AAAAAAAAAAAAA@AA@AAAAA@AAAAA@AAAAA@A@@AA@AAAA@A@@AA@@AAAAAAAAAAAAAAAAAAAAAA@A@AAAA@AAAA@AAAAAA@@AA@AAA@AAAAAA@@AAAAAAAAAAAAAAA@AAA@AA@AAAA@A@AAAAAA@AAAA@AAA@AAAAAAAAAAA@AAAAAAA@AAAAAA@A@@AAAA@AAAAAAAAA@AAAAAAAAAAAA@AAAAAAAAAAAAAAAAAA@AAAAAAAAAA@AA@AAAA@AAAAAAAAAAAAAA@AAAAAA@@AAAAAAAAAAAAA@AAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@@AAAAAAAAAA@AAAAAAAAA@AAAAAAAAAA@AAAAAAAA@AAAAAAAAAAAAAAAAAA@AAAAA@AAAAAAAAAAAAAAAAAAAAAAAA@AAAA@AAAAAAAAAA@AAA@@AA@AAAA@@AAA@@AAAAAAAAAAAA@AAAAAAA@AAAAAAA@AAAAAA@@AAAA@AAAAAAAAAAAAAA@@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAA@AAAAAAAAAAAAAA@AAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAA@AAAA@@@AAAAAAAA@AA@A@AAAAAAA@AAAAAAAAAAAAAAAA@AAAAA@AAA@AAAAA@AAAAA@AAAAAAAA@@AAAAAAAAAAAAA@AAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA?AAAAAAAA@AAAAAAA@AAAAAAAAAAA?AAAAA@AAAA@A@AAA@AAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAA@AAAAAAAA@@AAAAA@AAAAA@AAAAAAAA@AAAAAAAAAAAAA@?AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA?AAAA@AA@A@AAAAAAAAA=AAAAAAA?AA@AAAAAAAAAAAAAA@AA9@@AAAA@AAAAA@AAA@AA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAA@AAAAAAAAAAAAAAAAAAAAAAAAA8AAAAA@AAAA@AAAAAAAAAAAAA@AAAAAAA@AAAAAA@A@AAA@AAAAAAAAA@AAAAAAAAAAAAAAAAA@AAAAAAAAA@AAAAAAAAAAAAA@AA@AAA@AAAAAAAAAAAAAAAAAAAAA@AAAAAAAA@AA@AAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAA@@AAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAA@@@@AAAA@AAAAAAAAAAAAAAAAAAAA@AAAAAAAA@AAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAA@A@AAAAAAAAA?AA?AAAAAAAA?AAAAAA?A@AAAAAAA@AAAAAAA?A?A=A?A=====?=??A@AA@=@AA@@>?A?@@@@A@@AA@AA@=@A@?A@?AAA=@?A@A@AA@AAA@@AA?AAAAAA@AA@@@AAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=A?>A@??@>A@@@A@=@@A@@@@A@?@A@?@A@@@@@@@@@@AA@@@@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=@@@A@A@@?@@@@@@@@?@@@@@@@@?@A?@@@@@?@?@@?A@A@@@@A@@A@@@@?@@@@@@@@@@@??@@A@@@@@@A@A@?@?@@@@@@@@@@@@@@@@@@?A@@@@@@@@A@A@@@@@@A@@?@@@@@@@@@A?@@@@@AAA@A@@A@@@A@@@A@A@@A@@@?@@@@A@@@@@AA@@@@@AAA@AAA@A@@@@A@@@AA@@A?@AA@@@@@@@@A@@A@@@@@@@A@AAA@AAA?AAAAA@@@@AAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAA@@AAAAA@AA@AAAAAA@AAAAAAAAAAAAAAAA@AAAA@AAAAAAAAA@AAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAA@A@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA?AAAAAAAAAAAAAAAAAA8@@A@A@A@AAAAAAAA@AAAAA@AAAAAAAAAAA@A@AAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA???A?AAAAAAAAAAA@AAAA@AAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAA@AAAAAAA@AAAAAAAAA@AAAAA@AAAA@AAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@A@AAAAAA@AAAAAA@AAAAAAAA@AAA@AAAAAAAAAAA@AAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA?:@?@A@@AAAA@AAAA@AAAAAAAAAAAA@AAAAAAAAAAAAAA?A?AAA@@A@>@AA@AAAAA@AAAAAA@AAAAAA@@AAAAAAAAA@AAAAAAAAA?AAAAA@AAAAAAA@?AA@AAAAAAAA@A@AAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@A@AAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA?AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=AAAAAAAAAAAAAAAAA8@AAAAAAAAAA@AAAAAA@AAAAAAAAA@AAAAAAAA@@AA@AA@@AAAAAAAAAAAA@AAAAAA@@AAAAAAAAAAAAAAAAAAAA@AAAAAAAAA@AAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA?==?AA?AA@AAAAA?AAA??AAAAA@AAAA?AAAA???AAAAAA=AA@@AAA?AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA?A@AAAAAAA@?@AAAA@AA@?@@A@AAAAAAAA@A?AAA@A@@AAAAAAAA@A?AA@AAAA@AAAAAAAAAAAAAAAA?AAAAAAAAAAAAAAA@A@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAA?AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA?AAAAAAA@AAA@=AA=AAAAAAAAAAAAAAA?AAAAAAAAA@AAAAAAA?AA?@AA@==AAAA@@A@AAA@AAA@AAAAAA@AAAAA?AAAAAAAA@AA@AAAAAA@AA@A@AAAAAAAAAAA?AAAAA?AAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA>@@AA@A;@AA?AAAAAAAAAAAAA=?AA?AA@@>AAAAAAAAA@AAAAAAAAAAAA@AAA@A@AAAAAAAAAAAA@AAA@AA@AAA@@AAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA??AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA?AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@@@AAAAAAAAA@@A@A@AAAAAAAAAAAA?@AA@A@A@AAAAAAAAA?AAAAA?AAAAAAAAAA@@@AA@AAAAAAA@AAAAAAAAAAAAAAAAAAAA@AAAAAAAAAA@@AAAA@AAAAAAAAAAAAAA@AAAAAA?AAAAAAAAAAAAAAA@AA?AAAAA@AAAAAAA@@AAAAAA@AAAAAA@AA@AAAAAA@AAAAAAAA?AAAAAAAAAAAAAA@AAAAAAAAAAA@AA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAA@?AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AA@AAAAAAAAAAAAAAAAAAAA@AAAAAAAAAA@AAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA8?AAAAA@AAAAAAAAA@@AAAAAAAAA@AAAAAAAAAAAAA@AA@AAAA@AA@AAAAAAAAAAAA@@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAA@AAAAAAAAAAAAA@AAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAA@AAAAAAAAAAA??AAAAAAAAAAA@AAAAAAAAA@@AAAAAAAAAAAAAAAAAA@AAAAAAAAAAAA@AAAAAAAAAAAA@A@?A@AAAAAAA?@A@AAAAAA@AAAAA?AAAAAAAAAAAAAAAAAAAAA@AAAAAAAA9A@AA@@AAA@AAAAAA@@A@AAAA?AAAAA@AAAAAAAAAAAAAAAAA@AA@A@AAAAA@@AAAAAAAAAAAAAAAAAAAAA@AAA@AAAAA@AAA@AAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAA@AAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAA?@AAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA8AA@AAAAAA@AA@AAA@AAAAAAAAAAAAAAAAAAAAA@AAAA@@@@AAAAAAAAAAAAAAAAAA@AAAAAA@AAAA@AAAAAA@AAAAAAAAAAAAA@@A@AAAAAAAAAAA@@AAAAAAAAA@AAAAAAAAAAAA@AAAAA@A@AAAAAAAAAAAAAAAAAAAAAAAAAAAAA?AAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAA?AAAA@@AAAAA@@A@@AAAAAAAAAAAAAAAAAAAAAAAAA?>?@AAAAAAA@AAAAAAA?A@AAAA?AAA?AAA?@AA@AAAA?AAAAAAAAAAAAAAAAAAAAAAAAA@AAAAA?AAAAAAAAA@AAAAAAAAAAA@A?@AAAAAAAAAAAAAAAA@A?AAAAAAAA=@>>?AA@AA@AAAAA@AAAAAAAAAA??@AA@?A@@AA@AAAAAAAAAA?A?@AAAAAAAAA@AAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAA@AAAAAAAAAAAAAA@AAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAA@AAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAA@@AAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAA@A@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAA@AAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA?@@??@@@A@@@A@@@AA@@@@AA@AAAA?AAAA@@AA@@@A@@@@AAAA@AAAAAA@@AA?AAA@AAA@A@AAAAA?AAA@@@@@AAAAAA@AAAA@@AAAAA@@AAA@@AAAA@AAA@AA?AAAAAAAAAA@@A@A@AA@AAAAA@AAA@AAAA@AAAAA@@AAAAAAAAA@AAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAA9@A@@@A@A@AAAAAAA@AA@@AAAAAAAA@AAAAAAA@AAAAAAAAAAAA@AAAAAAAA@@AAAAAAAAAAAAAA@AA@AA@AAAAAAAAAA@AAAAAAAAAAAAAA@@@AAAAAAAAA@AAAAAA@AAAAAAAAAAAAAAAAAA@AAAAAA@@A@A@AAAAAAAAAAAAAAAAAAA@@AAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAA@@AAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA9@@AA@@@AA@@AA@AA@AAAAAAAA@AA@AA@A@A@AAAAAAAAAAAAAAAAAA@A@@@A@AAAAAAAAAAAA@AAAAAAAAAAA@@AAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAA@AAA@AAAAAAAAAAAA@@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAA@AAAAAAAAAAAAAAAA>>??@??????>???????>????????>??????????????????????????A???????????????????????A????????????????????????????????????????????????????????????????????????????A7?@@@@@@@@@@@@@@@@@@@@??@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@?@@@@@@@@@@@@@@@@?@@@@@@@@@@@@@??@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@A@AAAA@@AA@AA@AAAAAA@AAA@AAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAA@AAAAAAAAAAAAAAAAA@AAAAAAAA@AAAAAA@AAAAAAAAAAAAAAAAA@AAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AA@@AAAAAAAAAAAAA@@AAA@AAAAAA@A?AAAAAAAAAAAAAAAA@@AAAAAAAAAAAAA@@@A@AAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAA?A?AAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAA@AAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA:AAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA9AAAAAAAAAAAAAA@@AAA@AAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA?A@A@AAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAA@AAA@AAAAAAAAAAA?AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AA@AA@A@AA@A@@AA@?AAA?@AAAAAAAAAAAAAAAAAAAA@AAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA?AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@@@@@AAAAA>AAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAA@AA@AAA@AAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAA@A@@AAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA?AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA?AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAA@AAAAAAAAAAAAAAAA@AAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAA@AA@AAAAAAAAA@AAAAAAAAAAAAAAAAAAAAA@AAAAAAA@AA@AAAAAAAAAAAAAAAAAAAAAA@@AAAAAAAAAAAAAAAAAAAAA?AAAA?A@AAAAAAA@AAA@AAAAAAAAAAAAAAAAAAAAAAA@AAAAA@AAAAAAAAAAAAAAAAA@AAAA@AAAAAAAAA@AAAAA@AA@AAAAAAAAAAAAAAAAAAAAA@AAAAAAAA@AAAAA@AAAAAAAAAAAAAAAAAAA?AAAAAAAAAAAAAAAAAAAAAAA?AAAAAA@AA@AAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAA@AAAAAA@AAAAAAAAAAAAAAA@AAAAAAAA@AAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAA?AAA@A@AAAAAAAAAAA@AAAAA@@AAAAAAAAAA@AAA@AAAAA@AAAAAAAAAAA?AAAAAAAAAAA?AAAAAAA@AAAAAAA?AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAA@AAAAAAAAAAAA@AAA@AAAAAAAAAAAAAAAAAAAAAAAAAAA??AAAAAAAAA@AAAAA@AA@@AAAAAAAAAAAAA?AAAAA@AA@AAAAAAAAAAAAAAAAAA@AAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AA@AAA?@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA>BBAAAAA@?AA?AAAAA9AAAAAAAAABBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB====;99:=99;;;:;>>>==;9;;9=;;;9;;;::9;99;;;9;99899;::<??=::;;;;;;;::::;99:8:::;;;==<;;;;;=;>><>@@;99;;99;<<>><<<::;;;9:::<;;9>;;;=;;;:::;??:;;@==9;;;;;:=>>><<=<==9999;;;:::;;;;;<==<<;;;;;;>;;;:>><;;<;;:;;:;99:?<<<::;;==;==;<<<;==;<;;=;;;=<<<>;;><<;::?;;>;;>;;;>>@<<<?999===;;<:==;<<=<<<<<::;;:?::?9==?<<;;;;<==<;;<===;>>=9999;;;99=;;;<;;<999==<<<=:;;;>>=9;;;;;<<<==;;@<==9==?>>99>@=::;;;=<<<==::@@>99=:;;<;;<;;;<<::;;<99=>>=;;;<::;==:<<<??=88;9889<99>:<<=;99999<;;;?==?<<<88=::=;;;=;;;;???;?==;=99=;;;;==8;:;===<<<=<<9;;;;;99;;;;;99;99<<<<::=:==;=998;;;=<;;;;;@@;<<>==99;;<;;==99;;;:==;8;;:>>>>=88;999=;;=<<@=<<==77;99<99;<<<;<<<<==;<;;=>>9><<<:::::9<<<;;;:<<<<<<;88>9??;<<9977;??<88:>><;;9@99;;;;<;;9===;;;;>??;::9889;;<==8;;;<<;;;::;::;;;<88;::999:99:;;;999<;;;;88;;?;;;87;;;=;;;??;<;;;8898;;9::;;::<;;;;;;;;<99<<<<;==;<;;;99;<;;;;===;;;;;===9=;;;===;><<9<<9;;:<<9999===>A<<?;;;=<<:??<<<:<<>>;;=99;>99<;;;=99<:::<<;;;::::<>>;9>>?;;:<<;<<<==?99<;;;>;<<<9==:::<88;::<<<999;=99=::;9<<;99<99><<9<<<>??:;;;<;;;;;88:;;<999<<>99;>==<:;;;;;;;:;;;;;<999;;9;;;:==9;;<>??;;::9::=99:;;;>;;;;;;?@@988:>>;;;9;;;<<8@@@?::==::9;:::;<<9;;;=99;<<A9<<<<<=>>9>;;;;;;:;:::9;;999988;==BBB3888988=<<86::98999<;9=9;7;9;;<8778;?;?=:::8799=<=>99;7BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=====??;;;;;77<<??<<=<99;;??==A=>;>?<==8<>9@;;===;;==::8:<@==<>9???99==9;7=>@?===@>=;=;:9<;;<>::=>;;;?<=;?9>=@?9?<<<<<::;@9=9==::@@==?===7;99<6??=??9>>>A=>>?<<===?@9:;?<<<<;;;;<<<<=779;9;==>?;>@@<<>>??::;<;<8:==:<:<:<<9;?;;:@<@>=@==9<:;@@???;;??<@;;;;????=========<;==>7:?@;@8>?9==;===<@<;3;;9::;8<?9BBBBBBBBBBBBBBBBBBBB888888669788??99<<888898889999<:BB><>=>=8899>>A8@8A9BBBBBBBB8885:986@@99:9::999999<<87::BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB6666666655555555556666656777733388768788=>8777::78>>>>>>===>==889988998797::::>>99::::99<<8898:989879898777788888>=?>;>=998878888798779984633BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB8887BBB8BBB9BBBB:BBBBBBBBBBBBBBBBBBBBBBB==B8=66?;BBBBBBBBBBBBBBBBBBBB<<<<<<<<<<<<<<<<<<<::<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<;<=<<BBBBBBBB<<;<;;;;;<;;;;;;;;:=;;;;;;;;;;;;;;:;;;;;;<;;;;;;;;;;<<<<<<<<<<<<<<<<:BBBBBBBBB36:7:87;8889BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB>>;;;<<<<==>;>=<;>:<<>;=;::==<>;?<><>>89;::8::<3::?:;>:;=;??>><?<=<=>?;===<===<<<<<<BBBBBBBBBBB<BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB@=9=<<;?<?===@?>AAA<>=<???>>A=@@>>@;=>@>>;===<===<;==;=BBBBBBBBB;<>;><@=@<=?8=BB:<???9;<>>BB<369BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB8888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888????????????????????????????>>>>>>>>>>>>>>>>>>>>>>>>>>>>????????????????????????????>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>????????????????????????????>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>===>=>>=====>=====>>>======>????????????????????????????>>>>>>>>>>>>>>>>>>>>>>>>>>>>????????????????????????????>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>????????????????????????????>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>===>=>>=====>=====>>>======>????????????????????????????>>>>>>>>>>>>>>>>>>>>>>>>>>>>????????????????????????????>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>????????????????????????????>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>===>=>>=====>=====>>>======>????????????????????????????>>>>>>>>>>>>>>>>>>>>>>>>>>>>????????????????????????????>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>????????????????????????????>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>===>=>>=====>=====>>>======>????????????????????????????>>>>>>>>>>>>>>>>>>>>>>>>>>>>????????????????????????????>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>????????????????????????????>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>===>=>>=====>=====>>>======>????????????????????????????>>>>>>>>>>>>>>>>>>>>>>>>>>>>????????????????????????????>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>????????????????????????????>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>===>=>>=====>=====>>>======>????????????????????????????>>>>>>>>>>>>>>>>>>>>>>>>>>>>????????????????????????????>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>????????????????????????????>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>===>=>>=====>=====>>>======>????????????????????????????>>>>>>>>>>>>>>>>>>>>>>>>>>>>????????????????????????????>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>????????????????????????????>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>===>=>>=====>=====>>>======>????????????????????????????>>>>>>>>>>>>>>>>>>>>>>>>>>>>????????????????????????????>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>????????????????????????????>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>===>=>>=====>=====>>>======>????????????????????????????>>>>>>>>>>>>>>>>>>>>>>>>>>>>????????????????????????????>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>????????????????????????????>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>===>=>>=====>=====>>>======>????????????????????????????>>>>>>>>>>>>>>>>>>>>>>>>>>>>????????????????????????????>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>????????????????????????????>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>===>=>>=====>=====>>>======>????????????????????????????>>>>>>>>>>>>>>>>>>>>>>>>>>>>????????????????????????????>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>????????????????????????????>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>===>=>>=====>=====>>>======>????????????????????????????>>>>>>>>>>>>>>>>>>>>>>>>>>>>????????????????????????????>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>????????????????????????????>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>===>=>>=====>=====>>>======>????????????????????????????>>>>>>>>>>>>>>>>>>>>>>>>>>>>????????????????????????????>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>????????????????????????????>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>===>=>>=====>=====>>>======>????????????????????????????>>>>>>>>>>>>>>>>>>>>>>>>>>>>????????????????????????????>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>????????????????????????????>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>===>=>>=====>=====>>>======>????????????????????????????>>>>>>>>>>>>>>>>>>>>>>>>>>>>????????????????????????????>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>????????????????????????????>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>===>=>>=====>=====>>>======>????????????????????????????>>>>>>>>>>>>>>>>>>>>>>>>>>>>????????????????????????????>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>????????????????????????????>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>===>=>>=====>=====>>>======>????????????????????????????>>>>>>>>>>>>>>>>>>>>>>>>>>>>????????????????????????????>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>????????????????????????????>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>===>=>>=====>=====>>>======>????????????????????????????>>>>>>>>>>>>>>>>>>>>>>>>>>>>????????????????????????????>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>@???????????????????????????>>>>>>>>>>>>>>>>>>>>>>>>>>>>>==>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>===>=>>=====>=====>>>======>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>==>=>>=====>=====>>>======>===>=>>=====>=====>>>======>BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB9999>>==99<<====9999:::7:::::::;9999<<==>9<<9;9;BBBBBBBBBBBBBBBB9999==??99<<9999BBBBBBBBBBBBBBBB9999<888888888;;8888B<<BBBBBBBBB::::::;;;;;;:=:=BBBBBBBBBBBBBBBB@@BBBBBBBBBBBBBBBBBBBBBBBBBBBBBB::9<<========:BB=>=>=>=>BBBBBBBB999::<<<<99BBBBBBBBBBBBBBBBBBBBB;;=>B;<<?BBB;@@>BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBAAAAA?@AAAA@AAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@AAAAA@AAA@AAAAAAAAAAAAAAAAA@AAAAAAAAAAAA@AAAAAAAAAAAAAAAA?AAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@@AAAAAAAAAAAAAAAAA@AAAA@@AAAAA@AAAAAAA@AA@AAAABBAAAAA@AA@A@@?AAAAAA@AA@A@>AAAAAAAAAAA@@AA@@A@@@@AAAA@AAAA@ABBBBBAAA@AA>???A@AAAAAAAAAAAAAAAAAAAAA@?AAAAAAAAAA@@AAA?AAAAAA@AAAAAAAAAAAAAAA@AAAAAAAAAAAA@AAAAAAAAAAAA@@AAAAABBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB9888888BBBBBBBBBBBB9999:BBBBB5899>>>><@>>99999999988857B85887B9B68B88B88898598887:898:898:898:898:898:898:898:898:898:898:898:898:8989898989899:9:9:9:9:9:9:9:89898:68698:899:9999BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB899:898989:898989898:8:79899999::99799899898:9998898899988998899888989889999>9>99:>8998999:::6888688988997;;99978888898888898887998889998898888879:9:9999999999999999999999998:8::7888:99999999999999999:8889:9999:99:9:9:@@@:@@>@@@>9:9898999797999988889999998889:::99999:::::::::BBBB::::::::::998888@@@@889988999999:9::::999999AAAA::::::::::::::::::@@@@@@:BBBBBB::77@@BBBBBBBBBBBBBBBB@A@@@@?@A@AABBBBAAAABBABABAAAABBAAAABA@AB@BBA@AA?@@?AA@@?@@B@@@@BB@AA?AA?BAA?ABBBBBAABBBBBBBAAAAAAAB@?BB?B?AA@BBBABBBABBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB@=??>@B@@@BA?BBBBBBBBBBBBBBBBBBB4564438>>4BBBBBB999999:BBBBBBBBB43335@@@@@@@@@@@@@@@@67@@?@BB?@B554B5453744555576576556B6766BBBB6:756B6:7:6:7:6:69:598959898:38898:78898:898:899:898:898:89898989999:999:999:999:899:899:899:899:898:898:899:898:789:898:689:8989898:9:897979BBBB58=;?@566;=4?4?<9;<=;;;<;44=>=:>?<=<<;?>9<=<??><?=<=>>@==<7?77B5;:9:9::;58;5=;:::99:;;>;;:737><<5666488888888686:98::8:8:8:9:988:::6::8:8:88:::6:99::887:888955B87988887689999:978997:77:78889BBB555557BB577897BB776867BB853BBB;@><3=?B3878788BBBBBBBBBBBBBB8BB";

// Source/Layout.js
var LargeFont = new Uint8Array(65536);
[...LargeFontCharacters].forEach((Character2, Index) => {
  LargeFont[Character2.codePointAt(0)] = LargeFontWidths.charCodeAt(Index) - 48;
});
var FormattingCodes = /§./gu;
var Visible = (Line) => Line.includes("\xA7") ? Line.replace(FormattingCodes, "") : Line;
function AllLarge(Text2) {
  for (let Index = 0; Index < Text2.length; Index++) {
    if (LargeFont[Text2.charCodeAt(Index)] === 0) return false;
  }
  return true;
}
function UsesLargeFont(Line) {
  return AllLarge(Visible(String(Line)));
}
function LineWidth(Line) {
  const Text2 = Visible(String(Line));
  let Total = 0;
  if (AllLarge(Text2)) {
    for (let Index = 0; Index < Text2.length; Index++) Total += LargeFont[Text2.charCodeAt(Index)];
  } else {
    for (let Index = 0; Index < Text2.length; Index++) {
      const Unit = Text2.charCodeAt(Index);
      if (Unit >= 55296 && Unit <= 56319 && Index + 1 < Text2.length) {
        Total += MissingGlyphWidth * 2;
        Index++;
      } else Total += UnicodeFontWidthTable.charCodeAt(Unit) - 48;
    }
  }
  return Total / 2;
}
var LineHeight = 12;
var UnicodeLineHeight = 10;
var LineByteLimit = 128;
function LongestLineBytes(Text2) {
  return Math.max(...String(Text2).split("\n").map((Line) => {
    let Bytes = 0;
    for (const Character2 of Line) {
      const CodePoint = Character2.codePointAt(0);
      Bytes += CodePoint < 128 ? 1 : CodePoint < 2048 ? 2 : CodePoint < 65536 ? 3 : 4;
    }
    return Bytes;
  }));
}
function MeasureText(Text2) {
  const Lines = String(Text2).split("\0")[0].split("\n");
  return { Lines: Lines.length, Width: Math.max(...Lines.map(LineWidth)) };
}
function RowLayout(Entries, {
  Anchor = "Center",
  Center: Through,
  Clearance = 0.1,
  Distance = 30,
  EyeHeight = 1.62,
  Facing,
  Gap = 0.5,
  GroundTop,
  Origin,
  PixelSize: PixelSize3
}) {
  const Sizes = Entries.map(({ Measure, Scale, LineGap: LineGap2 = 0, Pitch = LineHeight }) => ({
    Width: Measure.Width * PixelSize3 * Scale,
    Height: Measure.Lines * (Pitch + LineGap2) * PixelSize3 * Scale,
    // The client seems to center a block on 12 pixels per line whatever the gap, so with a negative gap the
    // text reaches higher than half its height (1.1.51: titles overlapped 17-line charts at a gap of -4).
    Reach: Measure.Lines * Math.max(LineHeight, LineHeight + LineGap2) * PixelSize3 * Scale / 2
  }));
  const Total = Sizes.reduce((Sum, { Width }) => Sum + Width, 0) + Gap * Math.max(0, Entries.length - 1);
  const Right = { x: -Math.cos(Facing), z: Math.sin(Facing) };
  const Center = Through ?? { x: Origin.x + Math.sin(Facing) * Distance, z: Origin.z + Math.cos(Facing) * Distance };
  const Y = GroundTop + Math.max(EyeHeight, Clearance + Math.max(...Sizes.map(({ Height }) => Height)) / 2);
  const AnchorIndex = Anchor === "First" ? 0 : Anchor;
  let Offset = -Total / 2;
  if (typeof AnchorIndex === "number") {
    Offset = -(Sizes[AnchorIndex]?.Width ?? 0) / 2;
    for (let Index = 0; Index < AnchorIndex; Index++) Offset -= Sizes[Index].Width + Gap;
  }
  return Sizes.map(({ Width, Height, Reach }) => {
    const Middle = Offset + Width / 2;
    Offset += Width + Gap;
    return { Height, Location: { x: Center.x + Right.x * Middle, y: Y, z: Center.z + Right.z * Middle }, Reach, Width };
  });
}
function WrapText(Text2, Width) {
  const Lines = [];
  let Line = "";
  for (const Word of String(Text2).split(" ")) {
    const Candidate = Line ? `${Line} ${Word}` : Word;
    if (Line && MeasureText(Candidate).Width > Width) {
      Lines.push(Line);
      Line = Word;
    } else Line = Candidate;
  }
  Lines.push(Line);
  return Lines.join("\n");
}

// Source/UnicodeData.js
var UnicodeVersion = "18.0.0";
var Blocks = [[0, 127, "Basic Latin"], [128, 255, "Latin-1 Supplement"], [256, 383, "Latin Extended-A"], [384, 591, "Latin Extended-B"], [592, 687, "IPA Extensions"], [688, 767, "Spacing Modifier Letters"], [768, 879, "Combining Diacritical Marks"], [880, 1023, "Greek and Coptic"], [1024, 1279, "Cyrillic"], [1280, 1327, "Cyrillic Supplement"], [1328, 1423, "Armenian"], [1424, 1535, "Hebrew"], [1536, 1791, "Arabic"], [1792, 1871, "Syriac"], [1872, 1919, "Arabic Supplement"], [1920, 1983, "Thaana"], [1984, 2047, "NKo"], [2048, 2111, "Samaritan"], [2112, 2143, "Mandaic"], [2144, 2159, "Syriac Supplement"], [2160, 2207, "Arabic Extended-B"], [2208, 2303, "Arabic Extended-A"], [2304, 2431, "Devanagari"], [2432, 2559, "Bengali"], [2560, 2687, "Gurmukhi"], [2688, 2815, "Gujarati"], [2816, 2943, "Oriya"], [2944, 3071, "Tamil"], [3072, 3199, "Telugu"], [3200, 3327, "Kannada"], [3328, 3455, "Malayalam"], [3456, 3583, "Sinhala"], [3584, 3711, "Thai"], [3712, 3839, "Lao"], [3840, 4095, "Tibetan"], [4096, 4255, "Myanmar"], [4256, 4351, "Georgian"], [4352, 4607, "Hangul Jamo"], [4608, 4991, "Ethiopic"], [4992, 5023, "Ethiopic Supplement"], [5024, 5119, "Cherokee"], [5120, 5759, "Unified Canadian Aboriginal Syllabics"], [5760, 5791, "Ogham"], [5792, 5887, "Runic"], [5888, 5919, "Tagalog"], [5920, 5951, "Hanunoo"], [5952, 5983, "Buhid"], [5984, 6015, "Tagbanwa"], [6016, 6143, "Khmer"], [6144, 6319, "Mongolian"], [6320, 6399, "Unified Canadian Aboriginal Syllabics Extended"], [6400, 6479, "Limbu"], [6480, 6527, "Tai Le"], [6528, 6623, "New Tai Lue"], [6624, 6655, "Khmer Symbols"], [6656, 6687, "Buginese"], [6688, 6831, "Tai Tham"], [6832, 6911, "Combining Diacritical Marks Extended"], [6912, 7039, "Balinese"], [7040, 7103, "Sundanese"], [7104, 7167, "Batak"], [7168, 7247, "Lepcha"], [7248, 7295, "Ol Chiki"], [7296, 7311, "Cyrillic Extended-C"], [7312, 7359, "Georgian Extended"], [7360, 7375, "Sundanese Supplement"], [7376, 7423, "Vedic Extensions"], [7424, 7551, "Phonetic Extensions"], [7552, 7615, "Phonetic Extensions Supplement"], [7616, 7679, "Combining Diacritical Marks Supplement"], [7680, 7935, "Latin Extended Additional"], [7936, 8191, "Greek Extended"], [8192, 8303, "General Punctuation"], [8304, 8351, "Superscripts and Subscripts"], [8352, 8399, "Currency Symbols"], [8400, 8447, "Combining Diacritical Marks for Symbols"], [8448, 8527, "Letterlike Symbols"], [8528, 8591, "Number Forms"], [8592, 8703, "Arrows"], [8704, 8959, "Mathematical Operators"], [8960, 9215, "Miscellaneous Technical"], [9216, 9279, "Control Pictures"], [9280, 9311, "Optical Character Recognition"], [9312, 9471, "Enclosed Alphanumerics"], [9472, 9599, "Box Drawing"], [9600, 9631, "Block Elements"], [9632, 9727, "Geometric Shapes"], [9728, 9983, "Miscellaneous Symbols"], [9984, 10175, "Dingbats"], [10176, 10223, "Miscellaneous Mathematical Symbols-A"], [10224, 10239, "Supplemental Arrows-A"], [10240, 10495, "Braille Patterns"], [10496, 10623, "Supplemental Arrows-B"], [10624, 10751, "Miscellaneous Mathematical Symbols-B"], [10752, 11007, "Supplemental Mathematical Operators"], [11008, 11263, "Miscellaneous Symbols and Arrows"], [11264, 11359, "Glagolitic"], [11360, 11391, "Latin Extended-C"], [11392, 11519, "Coptic"], [11520, 11567, "Georgian Supplement"], [11568, 11647, "Tifinagh"], [11648, 11743, "Ethiopic Extended"], [11744, 11775, "Cyrillic Extended-A"], [11776, 11903, "Supplemental Punctuation"], [11904, 12031, "CJK Radicals Supplement"], [12032, 12255, "Kangxi Radicals"], [12272, 12287, "Ideographic Description Characters"], [12288, 12351, "CJK Symbols and Punctuation"], [12352, 12447, "Hiragana"], [12448, 12543, "Katakana"], [12544, 12591, "Bopomofo"], [12592, 12687, "Hangul Compatibility Jamo"], [12688, 12703, "Kanbun"], [12704, 12735, "Bopomofo Extended"], [12736, 12783, "CJK Strokes"], [12784, 12799, "Katakana Phonetic Extensions"], [12800, 13055, "Enclosed CJK Letters and Months"], [13056, 13311, "CJK Compatibility"], [13312, 19903, "CJK Unified Ideographs Extension A"], [19904, 19967, "Yijing Hexagram Symbols"], [19968, 40959, "CJK Unified Ideographs"], [40960, 42127, "Yi Syllables"], [42128, 42191, "Yi Radicals"], [42192, 42239, "Lisu"], [42240, 42559, "Vai"], [42560, 42655, "Cyrillic Extended-B"], [42656, 42751, "Bamum"], [42752, 42783, "Modifier Tone Letters"], [42784, 43007, "Latin Extended-D"], [43008, 43055, "Syloti Nagri"], [43056, 43071, "Common Indic Number Forms"], [43072, 43135, "Phags-pa"], [43136, 43231, "Saurashtra"], [43232, 43263, "Devanagari Extended"], [43264, 43311, "Kayah Li"], [43312, 43359, "Rejang"], [43360, 43391, "Hangul Jamo Extended-A"], [43392, 43487, "Javanese"], [43488, 43519, "Myanmar Extended-B"], [43520, 43615, "Cham"], [43616, 43647, "Myanmar Extended-A"], [43648, 43743, "Tai Viet"], [43744, 43775, "Meetei Mayek Extensions"], [43776, 43823, "Ethiopic Extended-A"], [43824, 43887, "Latin Extended-E"], [43888, 43967, "Cherokee Supplement"], [43968, 44031, "Meetei Mayek"], [44032, 55215, "Hangul Syllables"], [55216, 55295, "Hangul Jamo Extended-B"], [55296, 56191, "High Surrogates"], [56192, 56319, "High Private Use Surrogates"], [56320, 57343, "Low Surrogates"], [57344, 63743, "Private Use Area"], [63744, 64255, "CJK Compatibility Ideographs"], [64256, 64335, "Alphabetic Presentation Forms"], [64336, 65023, "Arabic Presentation Forms-A"], [65024, 65039, "Variation Selectors"], [65040, 65055, "Vertical Forms"], [65056, 65071, "Combining Half Marks"], [65072, 65103, "CJK Compatibility Forms"], [65104, 65135, "Small Form Variants"], [65136, 65279, "Arabic Presentation Forms-B"], [65280, 65519, "Halfwidth and Fullwidth Forms"], [65520, 65535, "Specials"], [65536, 65663, "Linear B Syllabary"], [65664, 65791, "Linear B Ideograms"], [65792, 65855, "Aegean Numbers"], [65856, 65935, "Ancient Greek Numbers"], [65936, 65999, "Ancient Symbols"], [66e3, 66047, "Phaistos Disc"], [66176, 66207, "Lycian"], [66208, 66271, "Carian"], [66272, 66303, "Coptic Epact Numbers"], [66304, 66351, "Old Italic"], [66352, 66383, "Gothic"], [66384, 66431, "Old Permic"], [66432, 66463, "Ugaritic"], [66464, 66527, "Old Persian"], [66560, 66639, "Deseret"], [66640, 66687, "Shavian"], [66688, 66735, "Osmanya"], [66736, 66815, "Osage"], [66816, 66863, "Elbasan"], [66864, 66927, "Caucasian Albanian"], [66928, 67007, "Vithkuqi"], [67008, 67071, "Todhri"], [67072, 67455, "Linear A"], [67456, 67519, "Latin Extended-F"], [67584, 67647, "Cypriot Syllabary"], [67648, 67679, "Imperial Aramaic"], [67680, 67711, "Palmyrene"], [67712, 67759, "Nabataean"], [67808, 67839, "Hatran"], [67840, 67871, "Phoenician"], [67872, 67903, "Lydian"], [67904, 67935, "Sidetic"], [67968, 67999, "Meroitic Hieroglyphs"], [68e3, 68095, "Meroitic Cursive"], [68096, 68191, "Kharoshthi"], [68192, 68223, "Old South Arabian"], [68224, 68255, "Old North Arabian"], [68288, 68351, "Manichaean"], [68352, 68415, "Avestan"], [68416, 68447, "Inscriptional Parthian"], [68448, 68479, "Inscriptional Pahlavi"], [68480, 68527, "Psalter Pahlavi"], [68608, 68687, "Old Turkic"], [68736, 68863, "Old Hungarian"], [68864, 68927, "Hanifi Rohingya"], [68928, 69007, "Garay"], [69216, 69247, "Rumi Numeral Symbols"], [69248, 69311, "Yezidi"], [69312, 69375, "Arabic Extended-C"], [69376, 69423, "Old Sogdian"], [69424, 69487, "Sogdian"], [69488, 69551, "Old Uyghur"], [69552, 69599, "Chorasmian"], [69600, 69631, "Elymaic"], [69632, 69759, "Brahmi"], [69760, 69839, "Kaithi"], [69840, 69887, "Sora Sompeng"], [69888, 69967, "Chakma"], [69968, 70015, "Mahajani"], [70016, 70111, "Sharada"], [70112, 70143, "Sinhala Archaic Numbers"], [70144, 70223, "Khojki"], [70272, 70319, "Multani"], [70320, 70399, "Khudawadi"], [70400, 70527, "Grantha"], [70528, 70655, "Tulu-Tigalari"], [70656, 70783, "Newa"], [70784, 70879, "Tirhuta"], [71040, 71167, "Siddham"], [71168, 71263, "Modi"], [71264, 71295, "Mongolian Supplement"], [71296, 71375, "Takri"], [71376, 71423, "Myanmar Extended-C"], [71424, 71503, "Ahom"], [71680, 71759, "Dogra"], [71840, 71935, "Warang Citi"], [71936, 72031, "Dives Akuru"], [72096, 72191, "Nandinagari"], [72192, 72271, "Zanabazar Square"], [72272, 72367, "Soyombo"], [72368, 72383, "Unified Canadian Aboriginal Syllabics Extended-A"], [72384, 72447, "Pau Cin Hau"], [72448, 72543, "Devanagari Extended-A"], [72544, 72575, "Sharada Supplement"], [72640, 72703, "Sunuwar"], [72704, 72815, "Bhaiksuki"], [72816, 72895, "Marchen"], [72960, 73055, "Masaram Gondi"], [73056, 73135, "Gunjala Gondi"], [73136, 73199, "Tolong Siki"], [73200, 73215, "Bengali Supplement"], [73440, 73471, "Makasar"], [73472, 73567, "Kawi"], [73648, 73663, "Lisu Supplement"], [73664, 73727, "Tamil Supplement"], [73728, 74751, "Cuneiform"], [74752, 74879, "Cuneiform Numbers and Punctuation"], [74880, 75087, "Early Dynastic Cuneiform"], [75088, 75407, "Archaic Cuneiform Numerals"], [77712, 77823, "Cypro-Minoan"], [77824, 78895, "Egyptian Hieroglyphs"], [78896, 78943, "Egyptian Hieroglyph Format Controls"], [78944, 82943, "Egyptian Hieroglyphs Extended-A"], [82944, 83583, "Anatolian Hieroglyphs"], [90368, 90431, "Gurung Khema"], [92160, 92735, "Bamum Supplement"], [92736, 92783, "Mro"], [92784, 92879, "Tangsa"], [92880, 92927, "Bassa Vah"], [92928, 93071, "Pahawh Hmong"], [93504, 93567, "Kirat Rai"], [93760, 93855, "Medefaidrin"], [93856, 93919, "Beria Erfe"], [93952, 94111, "Miao"], [94176, 94207, "Ideographic Symbols and Punctuation"], [94208, 100351, "Tangut"], [100352, 101119, "Tangut Components"], [101120, 101631, "Khitan Small Script"], [101632, 101759, "Tangut Supplement"], [101760, 101887, "Tangut Components Supplement"], [101888, 102815, "Jurchen"], [102816, 102879, "Jurchen Radicals"], [110576, 110591, "Kana Extended-B"], [110592, 110847, "Kana Supplement"], [110848, 110895, "Kana Extended-A"], [110896, 110959, "Small Kana Extension"], [110960, 111359, "Nushu"], [113664, 113823, "Duployan"], [113824, 113839, "Shorthand Format Controls"], [117760, 118463, "Symbols for Legacy Computing Supplement"], [118464, 118527, "Miscellaneous Symbols Supplement"], [118528, 118735, "Znamenny Musical Notation"], [118784, 119039, "Byzantine Musical Symbols"], [119040, 119295, "Musical Symbols"], [119296, 119375, "Ancient Greek Musical Notation"], [119376, 119439, "Musical Symbols Supplement"], [119488, 119519, "Kaktovik Numerals"], [119520, 119551, "Mayan Numerals"], [119552, 119647, "Tai Xuan Jing Symbols"], [119648, 119679, "Counting Rod Numerals"], [119808, 120831, "Mathematical Alphanumeric Symbols"], [120832, 121519, "Sutton SignWriting"], [121600, 121855, "Miscellaneous Symbols and Arrows Extended"], [122624, 122879, "Latin Extended-G"], [122880, 122927, "Glagolitic Supplement"], [122928, 123023, "Cyrillic Extended-D"], [123136, 123215, "Nyiakeng Puachue Hmong"], [123536, 123583, "Toto"], [123584, 123647, "Wancho"], [124112, 124159, "Nag Mundari"], [124368, 124415, "Ol Onal"], [124608, 124671, "Tai Yo"], [124896, 124927, "Ethiopic Extended-B"], [124928, 125151, "Mende Kikakui"], [125184, 125279, "Adlam"], [126064, 126143, "Indic Siyaq Numbers"], [126208, 126287, "Ottoman Siyaq Numbers"], [126464, 126719, "Arabic Mathematical Alphabetic Symbols"], [126976, 127023, "Mahjong Tiles"], [127024, 127135, "Domino Tiles"], [127136, 127231, "Playing Cards"], [127232, 127487, "Enclosed Alphanumeric Supplement"], [127488, 127743, "Enclosed Ideographic Supplement"], [127744, 128511, "Miscellaneous Symbols and Pictographs"], [128512, 128591, "Emoticons"], [128592, 128639, "Ornamental Dingbats"], [128640, 128767, "Transport and Map Symbols"], [128768, 128895, "Alchemical Symbols"], [128896, 129023, "Geometric Shapes Extended"], [129024, 129279, "Supplemental Arrows-C"], [129280, 129535, "Supplemental Symbols and Pictographs"], [129536, 129647, "Chess Symbols"], [129648, 129791, "Symbols and Pictographs Extended-A"], [129792, 130047, "Symbols for Legacy Computing"], [131072, 173791, "CJK Unified Ideographs Extension B"], [173824, 177983, "CJK Unified Ideographs Extension C"], [177984, 178207, "CJK Unified Ideographs Extension D"], [178208, 183983, "CJK Unified Ideographs Extension E"], [183984, 191471, "CJK Unified Ideographs Extension F"], [191472, 192095, "CJK Unified Ideographs Extension I"], [194560, 195103, "CJK Compatibility Ideographs Supplement"], [196608, 201551, "CJK Unified Ideographs Extension G"], [201552, 205743, "CJK Unified Ideographs Extension H"], [205744, 210047, "CJK Unified Ideographs Extension J"], [249856, 261183, "Seal"], [917504, 917631, "Tags"], [917760, 917999, "Variation Selectors Supplement"], [983040, 1048575, "Supplementary Private Use Area-A"], [1048576, 1114111, "Supplementary Private Use Area-B"]];
var NamePatterns = [[13312, 19903, "CJK UNIFIED IDEOGRAPH-"], [19968, 40959, "CJK UNIFIED IDEOGRAPH-"], [63744, 64109, "CJK COMPATIBILITY IDEOGRAPH-"], [64112, 64217, "CJK COMPATIBILITY IDEOGRAPH-"], [78944, 82938, "EGYPTIAN HIEROGLYPH-"], [94208, 100351, "TANGUT IDEOGRAPH-"], [101120, 101594, "KHITAN SMALL SCRIPT CHARACTER-"], [101631, 101631, "KHITAN SMALL SCRIPT CHARACTER-"], [101632, 101664, "TANGUT IDEOGRAPH-"], [101888, 102801, "JURCHEN CHARACTER-"], [110960, 111355, "NUSHU CHARACTER-"], [131072, 173791, "CJK UNIFIED IDEOGRAPH-"], [173824, 178206, "CJK UNIFIED IDEOGRAPH-"], [178208, 183981, "CJK UNIFIED IDEOGRAPH-"], [183984, 191456, "CJK UNIFIED IDEOGRAPH-"], [191472, 192093, "CJK UNIFIED IDEOGRAPH-"], [194560, 195101, "CJK COMPATIBILITY IDEOGRAPH-"], [196608, 201546, "CJK UNIFIED IDEOGRAPH-"], [201552, 210041, "CJK UNIFIED IDEOGRAPH-"], [249856, 261183, "SMALL SEAL CHARACTER-"]];
var NameRuns = "20 5f|a0 2d8|37a 6|384 7|38c 1|38e 14|3a3 18d|531 26|558 38|591 39|5d0 1b|5ef 6|600 10e|70f 3c|74d 65|7c0 3b|7fd 31|830 f|840 1c|85e 1|860 b|870 22|897 ed|985 8|98f 2|993 16|9aa 7|9b2 1|9b6 4|9bc 9|9c7 2|9cb 4|9d7 1|9dc 2|9df 5|9e6 19|a01 3|a05 6|a0f 2|a13 16|a2a 7|a32 2|a35 2|a38 2|a3c 1|a3e 5|a47 2|a4b 3|a51 1|a59 4|a5e 1|a66 11|a81 3|a85 9|a8f 3|a93 16|aaa 7|ab2 2|ab5 5|abc a|ac7 3|acb 3|ad0 1|ae0 4|ae6 c|af9 7|b01 3|b05 8|b0f 2|b13 16|b2a 7|b32 2|b35 5|b3c 9|b47 2|b4b 3|b53 5|b5c 2|b5f 5|b66 12|b82 2|b85 6|b8e 3|b92 4|b99 2|b9c 1|b9e 2|ba3 2|ba8 3|bae c|bbe 5|bc6 3|bca 4|bd0 1|bd7 1|be6 15|c00 d|c0e 3|c12 17|c2a 10|c3c 9|c46 3|c4a 4|c55 2|c58 3|c5c 2|c60 4|c66 a|c77 16|c8e 3|c92 17|caa a|cb5 5|cbc 9|cc6 3|cca 4|cd5 2|cdc 3|ce0 4|ce6 a|cf1 3|d00 d|d0e 3|d12 33|d46 3|d4a 6|d54 10|d66 1a|d81 3|d85 12|d9a 18|db3 9|dbd 1|dc0 7|dca 1|dcf 6|dd6 1|dd8 8|de6 a|df2 3|e01 3a|e3f 1d|e81 2|e84 1|e86 5|e8c 18|ea5 1|ea7 17|ec0 5|ec6 1|ec8 7|ed0 a|edc 4|f00 48|f49 24|f71 27|f99 24|fbe f|fce d|1000 c6|10c7 1|10cd 1|10d0 179|124a 4|1250 7|1258 1|125a 4|1260 29|128a 4|1290 21|12b2 4|12b8 7|12c0 1|12c2 4|12c8 f|12d8 39|1312 4|1318 43|135d 20|1380 1a|13a0 56|13f8 6|1400 29d|16a0 59|1700 16|171f 18|1740 14|1760 d|176e 3|1772 2|1780 5e|17e0 a|17f0 a|1800 1a|1820 59|1880 2b|18b0 46|1900 1f|1920 c|1930 c|1940 1|1944 2a|1970 5|1980 2c|19b0 1a|19d0 b|19de 3e|1a1e 41|1a60 1d|1a7f b|1a90 a|1aa0 e|1ab0 41|1b00 4d|1b4e a6|1bfc 3c|1c3b f|1c4d 3e|1c90 2b|1cbd b|1cd0 2b|1d00 216|1f18 6|1f20 26|1f48 6|1f50 8|1f59 1|1f5b 1|1f5d 1|1f5f 1f|1f80 35|1fb6 f|1fc6 e|1fd6 6|1fdd 13|1ff2 3|1ff6 9|2000 65|2066 c|2074 51|20d0 21|2100 8c|2190 29a|2440 b|2460 714|2b76 17e|2cf9 2d|2d27 1|2d2d 1|2d30 38|2d6f 2|2d7f 18|2da0 7|2da8 7|2db0 7|2db8 7|2dc0 7|2dc8 7|2dd0 7|2dd8 7|2de0 7e|2e60 4|2e80 1a|2e9b 59|2f00 d6|2ff0 50|3041 56|3099 67|3105 2b|3131 5e|3190 56|31ef 30|3220 1e0|4dc0 40|a000 48d|a490 37|a4d0 15c|a640 b8|a700 de|a7e2 1|a7f1 3c|a830 a|a840 38|a880 46|a8ce c|a8e0 74|a95f 1e|a980 4e|a9cf b|a9de 21|aa00 37|aa40 e|aa50 a|aa5c 67|aadb 1c|ab01 6|ab09 6|ab11 6|ab20 7|ab28 7|ab30 3e|ab70 7e|abf0 a|d7b0 17|d7cb 31|fb00 7|fb13 5|fb1d 1a|fb38 5|fb3e 1|fb40 2|fb43 2|fb46 28a|fdf0 2a|fe20 33|fe54 13|fe68 4|fe70 5|fe76 87|feff 1|ff01 be|ffc2 6|ffca 6|ffd2 6|ffda 3|ffe0 7|ffe8 7|fff9 5|10000 c|1000d 1a|10028 13|1003c 2|1003f f|10050 e|10080 7b|10100 3|10107 2d|10137 58|10190 d|101a0 1|101d0 2e|10280 1d|102a0 31|102e0 1c|10300 24|1032d 1e|10350 2b|10380 1e|1039f 25|103c8 e|10400 9e|104a0 a|104b0 24|104d8 24|10500 28|10530 34|1056f c|1057c f|1058c 7|10594 2|10597 b|105a3 f|105b3 7|105bb 2|105c0 34|10600 137|10740 16|10760 8|10780 6|10787 2a|107b2 e|10800 6|10808 1|1080a 2c|10837 2|1083c 1|1083f 17|10857 48|108a7 9|108e0 13|108f4 2|108fb 21|1091f 1b|1093f 1b|10980 38|109bc 14|109d2 32|10a05 2|10a0c 8|10a15 3|10a19 1d|10a38 3|10a3f a|10a50 9|10a60 40|10ac0 27|10aeb c|10b00 36|10b39 1d|10b58 1b|10b78 1a|10b99 4|10ba9 7|10c00 49|10c80 33|10cc0 33|10cfa 2e|10d30 a|10d40 26|10d69 1d|10d8e 2|10e60 1f|10e80 2a|10eab 3|10eb0 2|10ec2 6|10ec9 26|10ef0 38|10f30 2a|10f70 1a|10fb0 1c|10fe0 17|11000 4e|11052 24|1107f 44|110cd 1|110d0 19|110f0 a|11100 35|11136 12|11150 27|11180 60|111e1 14|11200 12|11213 2f|11280 7|11288 1|1128a 4|1128f f|1129f b|112b0 3b|112f0 a|11300 4|11305 8|1130f 2|11313 16|1132a 7|11332 2|11335 5|1133b a|11347 2|1134b 3|11350 1|11357 1|1135d 7|11366 7|11370 5|11380 a|1138b 1|1138e 1|11390 26|113b7 a|113c2 1|113c5 1|113c7 4|113cc a|113d7 2|113e1 2|11400 5c|1145d 5|11480 48|114d0 a|11580 36|115b8 26|11600 45|11650 a|11660 d|11680 3a|116c0 a|116d0 14|11700 1b|1171d f|11730 17|11800 3c|118a0 53|118ff 8|11909 1|1190c 8|11915 2|11918 1e|11937 2|1193b c|11950 a|119a0 8|119aa 2e|119da b|11a00 48|11a50 53|11ab0 49|11b00 b|11b60 8|11bc0 22|11bf0 a|11c00 9|11c0a 2d|11c38 e|11c50 1d|11c70 20|11c92 16|11ca9 e|11d00 7|11d08 2|11d0b 2c|11d3a 1|11d3c 2|11d3f 9|11d50 a|11d60 6|11d67 2|11d6a 25|11d90 2|11d93 6|11da0 a|11db0 2c|11de0 a|11df0 2|11ee0 19|11f00 11|11f12 29|11f3e 1d|11fb0 1|11fc0 32|11fff 39b|12400 144|12550 137|12f90 63|13000 456|14400 247|16100 3a|16800 239|16a40 1f|16a60 a|16a6e 51|16ac0 a|16ad0 1e|16af0 6|16b00 46|16b50 a|16b5b 7|16b63 15|16b7d 13|16d40 3a|16e40 5b|16ea0 19|16ebb 19|16f00 4b|16f4f 39|16f8f 11|16fe0 5|16ff0 7|18800 300|18d80 73|191a0 33|1aff0 4|1aff5 7|1affd 2|1b000 129|1b132 1|1b150 3|1b155 1|1b164 5|1bc00 6b|1bc70 d|1bc80 9|1bc90 a|1bc9c 8|1cc00 fd|1cd00 1b4|1ceba 17|1ced2 3|1cedd 21|1cf00 2e|1cf30 17|1cf50 74|1d000 f6|1d100 146|1d250 32|1d2c0 14|1d2e0 14|1d300 57|1d360 19|1d400 55|1d456 47|1d49e 2|1d4a2 1|1d4a5 2|1d4a9 4|1d4ae c|1d4bb 1|1d4bd 7|1d4c5 41|1d507 4|1d50d 8|1d516 7|1d51e 1c|1d53b 4|1d540 5|1d546 1|1d54a 7|1d552 155|1d6a8 124|1d7ce 2be|1da9b 5|1daa1 f|1db00 1d|1df00 82|1df90 7|1dfcd 3a|1e008 11|1e01b 7|1e023 2|1e026 5|1e030 3e|1e08f 1|1e100 2d|1e130 e|1e140 a|1e14e 2|1e290 1f|1e2c0 3a|1e2ff 1|1e4d0 2a|1e5d0 2b|1e5ff 1|1e6c0 1f|1e6e0 16|1e6fe 2|1e7e0 7|1e7e8 4|1e7ed 2|1e7f0 f|1e800 c5|1e8c7 10|1e900 4c|1e950 a|1e95e 2|1ec71 44|1ed01 3d|1ee00 4|1ee05 1b|1ee21 2|1ee24 1|1ee27 1|1ee29 a|1ee34 4|1ee39 1|1ee3b 1|1ee42 1|1ee47 1|1ee49 1|1ee4b 1|1ee4d 3|1ee51 2|1ee54 1|1ee57 1|1ee59 1|1ee5b 1|1ee5d 1|1ee5f 1|1ee61 2|1ee64 1|1ee67 4|1ee6c 7|1ee74 4|1ee79 4|1ee7e 1|1ee80 a|1ee8b 11|1eea1 3|1eea5 5|1eeab 11|1eef0 2|1f000 2c|1f030 64|1f0a0 f|1f0b1 f|1f0c1 f|1f0d1 25|1f100 af|1f1e6 1d|1f210 2c|1f240 9|1f250 2|1f260 6|1f300 3da|1f6dc 11|1f6f0 d|1f700 dc|1f7e0 c|1f7f0 1c|1f810 38|1f850 a|1f860 28|1f890 1e|1f8b0 c|1f8c0 2|1f8d0 9|1f900 158|1fa60 e|1fa70 d|1fa80 47|1fac8 1|1facc 12|1fadf d|1faef c|1fb00 93|1fb94 67|e0001 1|e0020 60|e0100 f0";
var Names = "#SPACE|#EXCLAMATION MARK|#QUOTATION MARK|#NUMBER SIGN|#DOLLAR SIGN|#PERCENT SIGN|#AMPERSAND|$POSTROPHE|#LEFT PARENTHESIS|#RIGHT PARENTHESIS|#ASTERISK|#PLUS SIGN|#COMMA|#HYPHEN-MINUS|#FULL STOP|#SOLIDUS|#DIGIT ZERO|)ONE|)TWO|*HREE|)FOUR|*IVE|)SIX|*EVEN|)EIGHT|)NINE|#COLON|#SEMICOLON|#LESS-THAN SIGN|#EQUALS SIGN|#GREATER-THAN SIGN|#QUESTION MARK|#COMMERCIAL AT|#LATIN CAPITAL LETTER A|8B|8C|8D|8E|8F|8G|8H|8I|8J|8K|8L|8M|8N|8O|8P|8Q|8R|8S|8T|8U|8V|8W|8X|8Y|8Z|$EFT SQUARE BRACKET|#REVERSE SOLIDUS|$IGHT SQUARE BRACKET|#CIRCUMFLEX ACCENT|#LOW LINE|#GRAVE ACCENT|#LATIN SMALL LETTER A|6B|6C|6D|6E|6F|6G|6H|6I|6J|6K|6L|6M|6N|6O|6P|6Q|6R|6S|6T|6U|6V|6W|6X|6Y|6Z|$EFT CURLY BRACKET|#VERTICAL LINE|#RIGHT CURLY BRACKET|#TILDE|#NO-BREAK SPACE|#INVERTED EXCLAMATION MARK|#CENT SIGN|#POUND SIGN|#CURRENCY SIGN|#YEN SIGN|#BROKEN BAR|#SECTION SIGN|#DIAERESIS|#COPYRIGHT SIGN|#FEMININE ORDINAL INDICATOR|#LEFT-POINTING DOUBLE ANGLE QUOTATION MARK|#NOT SIGN|#SOFT HYPHEN|#REGISTERED SIGN|#MACRON|#DEGREE SIGN|#PLUS-MINUS SIGN|#SUPERSCRIPT TWO|0HREE|#ACUTE ACCENT|#MICRO SIGN|#PILCROW SIGN|#MIDDLE DOT|#CEDILLA|#SUPERSCRIPT ONE|#MASCULINE ORDINAL INDICATOR|#RIGHT-POINTING DOUBLE ANGLE QUOTATION MARK|#VULGAR FRACTION ONE QUARTER|7HALF|3THREE QUARTERS|#INVERTED QUESTION MARK|#LATIN CAPITAL LETTER A WITH GRAVE|?ACUTE|?CIRCUMFLEX|?TILDE|?DIAERESIS|?RING ABOVE|9E|8C WITH CEDILLA|8E WITH GRAVE|?ACUTE|?CIRCUMFLEX|?DIAERESIS|8I WITH GRAVE|?ACUTE|?CIRCUMFLEX|?DIAERESIS|8ETH|8N WITH TILDE|8O WITH GRAVE|?ACUTE|?CIRCUMFLEX|?TILDE|?DIAERESIS|#MULTIPLICATION SIGN|#LATIN CAPITAL LETTER O WITH STROKE|8U WITH GRAVE|?ACUTE|?CIRCUMFLEX|?DIAERESIS|8Y WITH ACUTE|8THORN|)SMALL LETTER SHARP S|6A WITH GRAVE|=ACUTE|=CIRCUMFLEX|=TILDE|=DIAERESIS|=RING ABOVE|7E|6C WITH CEDILLA|6E WITH GRAVE|=ACUTE|=CIRCUMFLEX|=DIAERESIS|6I WITH GRAVE|=ACUTE|=CIRCUMFLEX|=DIAERESIS|6ETH|6N WITH TILDE|6O WITH GRAVE|=ACUTE|=CIRCUMFLEX|=TILDE|=DIAERESIS|#DIVISION SIGN|#LATIN SMALL LETTER O WITH STROKE|6U WITH GRAVE|=ACUTE|=CIRCUMFLEX|=DIAERESIS|6Y WITH ACUTE|6THORN|6Y WITH DIAERESIS|)CAPITAL LETTER A WITH MACRON|)SMALL LETTER A WITH MACRON|)CAPITAL LETTER A WITH BREVE|)SMALL LETTER A WITH BREVE|)CAPITAL LETTER A WITH OGONEK|)SMALL LETTER A WITH OGONEK|)CAPITAL LETTER C WITH ACUTE|)SMALL LETTER C WITH ACUTE|)CAPITAL LETTER C WITH CIRCUMFLEX|)SMALL LETTER C WITH CIRCUMFLEX|)CAPITAL LETTER C WITH DOT ABOVE|)SMALL LETTER C WITH DOT ABOVE|)CAPITAL LETTER C WITH CARON|)SMALL LETTER C WITH CARON|)CAPITAL LETTER D WITH CARON|)SMALL LETTER D WITH CARON|)CAPITAL LETTER D WITH STROKE|)SMALL LETTER D WITH STROKE|)CAPITAL LETTER E WITH MACRON|)SMALL LETTER E WITH MACRON|)CAPITAL LETTER E WITH BREVE|)SMALL LETTER E WITH BREVE|)CAPITAL LETTER E WITH DOT ABOVE|)SMALL LETTER E WITH DOT ABOVE|)CAPITAL LETTER E WITH OGONEK|)SMALL LETTER E WITH OGONEK|)CAPITAL LETTER E WITH CARON|)SMALL LETTER E WITH CARON|)CAPITAL LETTER G WITH CIRCUMFLEX|)SMALL LETTER G WITH CIRCUMFLEX|)CAPITAL LETTER G WITH BREVE|)SMALL LETTER G WITH BREVE|)CAPITAL LETTER G WITH DOT ABOVE|)SMALL LETTER G WITH DOT ABOVE|)CAPITAL LETTER G WITH CEDILLA|)SMALL LETTER G WITH CEDILLA|)CAPITAL LETTER H WITH CIRCUMFLEX|)SMALL LETTER H WITH CIRCUMFLEX|)CAPITAL LETTER H WITH STROKE|)SMALL LETTER H WITH STROKE|)CAPITAL LETTER I WITH TILDE|)SMALL LETTER I WITH TILDE|)CAPITAL LETTER I WITH MACRON|)SMALL LETTER I WITH MACRON|)CAPITAL LETTER I WITH BREVE|)SMALL LETTER I WITH BREVE|)CAPITAL LETTER I WITH OGONEK|)SMALL LETTER I WITH OGONEK|)CAPITAL LETTER I WITH DOT ABOVE|)SMALL LETTER DOTLESS I|)CAPITAL LIGATURE IJ|)SMALL LIGATURE IJ|)CAPITAL LETTER J WITH CIRCUMFLEX|)SMALL LETTER J WITH CIRCUMFLEX|)CAPITAL LETTER K WITH CEDILLA|)SMALL LETTER K WITH CEDILLA|7RA|)CAPITAL LETTER L WITH ACUTE|)SMALL LETTER L WITH ACUTE|)CAPITAL LETTER L WITH CEDILLA|)SMALL LETTER L WITH CEDILLA|)CAPITAL LETTER L WITH CARON|)SMALL LETTER L WITH CARON|)CAPITAL LETTER L WITH MIDDLE DOT|)SMALL LETTER L WITH MIDDLE DOT|)CAPITAL LETTER L WITH STROKE|)SMALL LETTER L WITH STROKE|)CAPITAL LETTER N WITH ACUTE|)SMALL LETTER N WITH ACUTE|)CAPITAL LETTER N WITH CEDILLA|)SMALL LETTER N WITH CEDILLA|)CAPITAL LETTER N WITH CARON|)SMALL LETTER N WITH CARON|8PRECEDED BY APOSTROPHE|)CAPITAL LETTER ENG|)SMALL LETTER ENG|)CAPITAL LETTER O WITH MACRON|)SMALL LETTER O WITH MACRON|)CAPITAL LETTER O WITH BREVE|)SMALL LETTER O WITH BREVE|)CAPITAL LETTER O WITH DOUBLE ACUTE|)SMALL LETTER O WITH DOUBLE ACUTE|)CAPITAL LIGATURE OE|)SMALL LIGATURE OE|)CAPITAL LETTER R WITH ACUTE|)SMALL LETTER R WITH ACUTE|)CAPITAL LETTER R WITH CEDILLA|)SMALL LETTER R WITH CEDILLA|)CAPITAL LETTER R WITH CARON|)SMALL LETTER R WITH CARON|)CAPITAL LETTER S WITH ACUTE|)SMALL LETTER S WITH ACUTE|)CAPITAL LETTER S WITH CIRCUMFLEX|)SMALL LETTER S WITH CIRCUMFLEX|)CAPITAL LETTER S WITH CEDILLA|)SMALL LETTER S WITH CEDILLA|)CAPITAL LETTER S WITH CARON|)SMALL LETTER S WITH CARON|)CAPITAL LETTER T WITH CEDILLA|)SMALL LETTER T WITH CEDILLA|)CAPITAL LETTER T WITH CARON|)SMALL LETTER T WITH CARON|)CAPITAL LETTER T WITH STROKE|)SMALL LETTER T WITH STROKE|)CAPITAL LETTER U WITH TILDE|)SMALL LETTER U WITH TILDE|)CAPITAL LETTER U WITH MACRON|)SMALL LETTER U WITH MACRON|)CAPITAL LETTER U WITH BREVE|)SMALL LETTER U WITH BREVE|)CAPITAL LETTER U WITH RING ABOVE|)SMALL LETTER U WITH RING ABOVE|)CAPITAL LETTER U WITH DOUBLE ACUTE|)SMALL LETTER U WITH DOUBLE ACUTE|)CAPITAL LETTER U WITH OGONEK|)SMALL LETTER U WITH OGONEK|)CAPITAL LETTER W WITH CIRCUMFLEX|)SMALL LETTER W WITH CIRCUMFLEX|)CAPITAL LETTER Y WITH CIRCUMFLEX|)SMALL LETTER Y WITH CIRCUMFLEX|)CAPITAL LETTER Y WITH DIAERESIS|8Z WITH ACUTE|)SMALL LETTER Z WITH ACUTE|)CAPITAL LETTER Z WITH DOT ABOVE|)SMALL LETTER Z WITH DOT ABOVE|)CAPITAL LETTER Z WITH CARON|)SMALL LETTER Z WITH CARON|6LONG S|6B WITH STROKE|)CAPITAL LETTER B WITH HOOK|?TOPBAR|)SMALL LETTER B WITH TOPBAR|)CAPITAL LETTER TONE SIX|)SMALL LETTER TONE SIX|)CAPITAL LETTER OPEN O|8C WITH HOOK|)SMALL LETTER C WITH HOOK|)CAPITAL LETTER AFRICAN D|8D WITH HOOK|?TOPBAR|)SMALL LETTER D WITH TOPBAR|6TURNED DELTA|)CAPITAL LETTER REVERSED E|8SCHWA|8OPEN E|8F WITH HOOK|)SMALL LETTER F WITH HOOK|)CAPITAL LETTER G WITH HOOK|9AMMA|)SMALL LETTER HV|)CAPITAL LETTER IOTA|9 WITH STROKE|8K WITH HOOK|)SMALL LETTER K WITH HOOK|6L WITH BAR|7AMBDA WITH STROKE|)CAPITAL LETTER TURNED M|8N WITH LEFT HOOK|)SMALL LETTER N WITH LONG RIGHT LEG|)CAPITAL LETTER O WITH MIDDLE TILDE|?HORN|)SMALL LETTER O WITH HORN|)CAPITAL LETTER OI|)SMALL LETTER OI|)CAPITAL LETTER P WITH HOOK|)SMALL LETTER P WITH HOOK|)LETTER YR|)CAPITAL LETTER TONE TWO|)SMALL LETTER TONE TWO|)CAPITAL LETTER ESH|)LETTER REVERSED ESH LOOP|)SMALL LETTER T WITH PALATAL HOOK|)CAPITAL LETTER T WITH HOOK|)SMALL LETTER T WITH HOOK|)CAPITAL LETTER T WITH RETROFLEX HOOK|8U WITH HORN|)SMALL LETTER U WITH HORN|)CAPITAL LETTER UPSILON|8V WITH HOOK|8Y WITH HOOK|)SMALL LETTER Y WITH HOOK|)CAPITAL LETTER Z WITH STROKE|)SMALL LETTER Z WITH STROKE|)CAPITAL LETTER EZH|; REVERSED|)SMALL LETTER EZH REVERSED|:WITH TAIL|)LETTER TWO WITH STROKE|)CAPITAL LETTER TONE FIVE|)SMALL LETTER TONE FIVE|)LETTER INVERTED GLOTTAL STOP WITH STROKE|0WYNN|0DENTAL CLICK|0LATERAL CLICK|0ALVEOLAR CLICK|0RETROFLEX CLICK|)CAPITAL LETTER DZ WITH CARON|9 WITH SMALL LETTER Z WITH CARON|)SMALL LETTER DZ WITH CARON|)CAPITAL LETTER LJ|9 WITH SMALL LETTER J|)SMALL LETTER LJ|)CAPITAL LETTER NJ|9 WITH SMALL LETTER J|)SMALL LETTER NJ|)CAPITAL LETTER A WITH CARON|)SMALL LETTER A WITH CARON|)CAPITAL LETTER I WITH CARON|)SMALL LETTER I WITH CARON|)CAPITAL LETTER O WITH CARON|)SMALL LETTER O WITH CARON|)CAPITAL LETTER U WITH CARON|)SMALL LETTER U WITH CARON|)CAPITAL LETTER U WITH DIAERESIS AND MACRON|)SMALL LETTER U WITH DIAERESIS AND MACRON|)CAPITAL LETTER U WITH DIAERESIS AND ACUTE|)SMALL LETTER U WITH DIAERESIS AND ACUTE|)CAPITAL LETTER U WITH DIAERESIS AND CARON|)SMALL LETTER U WITH DIAERESIS AND CARON|)CAPITAL LETTER U WITH DIAERESIS AND GRAVE|)SMALL LETTER U WITH DIAERESIS AND GRAVE|6TURNED E|)CAPITAL LETTER A WITH DIAERESIS AND MACRON|)SMALL LETTER A WITH DIAERESIS AND MACRON|)CAPITAL LETTER A WITH DOT ABOVE AND MACRON|)SMALL LETTER A WITH DOT ABOVE AND MACRON|)CAPITAL LETTER AE WITH MACRON|)SMALL LETTER AE WITH MACRON|)CAPITAL LETTER G WITH STROKE|)SMALL LETTER G WITH STROKE|)CAPITAL LETTER G WITH CARON|)SMALL LETTER G WITH CARON|)CAPITAL LETTER K WITH CARON|)SMALL LETTER K WITH CARON|)CAPITAL LETTER O WITH OGONEK|)SMALL LETTER O WITH OGONEK|)CAPITAL LETTER O WITH OGONEK AND MACRON|)SMALL LETTER O WITH OGONEK AND MACRON|)CAPITAL LETTER EZH WITH CARON|)SMALL LETTER EZH WITH CARON|6J WITH CARON|)CAPITAL LETTER DZ|9 WITH SMALL LETTER Z|)SMALL LETTER DZ|)CAPITAL LETTER G WITH ACUTE|)SMALL LETTER G WITH ACUTE|)CAPITAL LETTER HWAIR|8WYNN|8N WITH GRAVE|)SMALL LETTER N WITH GRAVE|)CAPITAL LETTER A WITH RING ABOVE AND ACUTE|)SMALL LETTER A WITH RING ABOVE AND ACUTE|)CAPITAL LETTER AE WITH ACUTE|)SMALL LETTER AE WITH ACUTE|)CAPITAL LETTER O WITH STROKE AND ACUTE|)SMALL LETTER O WITH STROKE AND ACUTE|)CAPITAL LETTER A WITH DOUBLE GRAVE|)SMALL LETTER A WITH DOUBLE GRAVE|)CAPITAL LETTER A WITH INVERTED BREVE|)SMALL LETTER A WITH INVERTED BREVE|)CAPITAL LETTER E WITH DOUBLE GRAVE|)SMALL LETTER E WITH DOUBLE GRAVE|)CAPITAL LETTER E WITH INVERTED BREVE|)SMALL LETTER E WITH INVERTED BREVE|)CAPITAL LETTER I WITH DOUBLE GRAVE|)SMALL LETTER I WITH DOUBLE GRAVE|)CAPITAL LETTER I WITH INVERTED BREVE|)SMALL LETTER I WITH INVERTED BREVE|)CAPITAL LETTER O WITH DOUBLE GRAVE|)SMALL LETTER O WITH DOUBLE GRAVE|)CAPITAL LETTER O WITH INVERTED BREVE|)SMALL LETTER O WITH INVERTED BREVE|)CAPITAL LETTER R WITH DOUBLE GRAVE|)SMALL LETTER R WITH DOUBLE GRAVE|)CAPITAL LETTER R WITH INVERTED BREVE|)SMALL LETTER R WITH INVERTED BREVE|)CAPITAL LETTER U WITH DOUBLE GRAVE|)SMALL LETTER U WITH DOUBLE GRAVE|)CAPITAL LETTER U WITH INVERTED BREVE|)SMALL LETTER U WITH INVERTED BREVE|)CAPITAL LETTER S WITH COMMA BELOW|)SMALL LETTER S WITH COMMA BELOW|)CAPITAL LETTER T WITH COMMA BELOW|)SMALL LETTER T WITH COMMA BELOW|)CAPITAL LETTER YOGH|)SMALL LETTER YOGH|)CAPITAL LETTER H WITH CARON|)SMALL LETTER H WITH CARON|)CAPITAL LETTER N WITH LONG RIGHT LEG|)SMALL LETTER D WITH CURL|)CAPITAL LETTER OU|)SMALL LETTER OU|)CAPITAL LETTER Z WITH HOOK|)SMALL LETTER Z WITH HOOK|)CAPITAL LETTER A WITH DOT ABOVE|)SMALL LETTER A WITH DOT ABOVE|)CAPITAL LETTER E WITH CEDILLA|)SMALL LETTER E WITH CEDILLA|)CAPITAL LETTER O WITH DIAERESIS AND MACRON|)SMALL LETTER O WITH DIAERESIS AND MACRON|)CAPITAL LETTER O WITH TILDE AND MACRON|)SMALL LETTER O WITH TILDE AND MACRON|)CAPITAL LETTER O WITH DOT ABOVE|)SMALL LETTER O WITH DOT ABOVE|)CAPITAL LETTER O WITH DOT ABOVE AND MACRON|)SMALL LETTER O WITH DOT ABOVE AND MACRON|)CAPITAL LETTER Y WITH MACRON|)SMALL LETTER Y WITH MACRON|6L WITH CURL|6N WITH CURL|6T WITH CURL|6DOTLESS J|7B DIGRAPH|6QP DIGRAPH|)CAPITAL LETTER A WITH STROKE|8C WITH STROKE|)SMALL LETTER C WITH STROKE|)CAPITAL LETTER L WITH BAR|8T WITH DIAGONAL STROKE|)SMALL LETTER S WITH SWASH TAIL|6Z WITH SWASH TAIL|)CAPITAL LETTER GLOTTAL STOP|)SMALL LETTER GLOTTAL STOP|)CAPITAL LETTER B WITH STROKE|8U BAR|8TURNED V|8E WITH STROKE|)SMALL LETTER E WITH STROKE|)CAPITAL LETTER J WITH STROKE|)SMALL LETTER J WITH STROKE|)CAPITAL LETTER SMALL Q WITH HOOK TAIL|)SMALL LETTER Q WITH HOOK TAIL|)CAPITAL LETTER R WITH STROKE|)SMALL LETTER R WITH STROKE|)CAPITAL LETTER Y WITH STROKE|)SMALL LETTER Y WITH STROKE|6TURNED A|6ALPHA|6TURNED ALPHA|6B WITH HOOK|6OPEN O|6C WITH CURL|6D WITH TAIL|=HOOK|6REVERSED E|6SCHWA|; WITH HOOK|6OPEN E|6REVERSED OPEN E|E WITH HOOK|6CLOSED REVERSED OPEN E|6DOTLESS J WITH STROKE|6G WITH HOOK|6SCRIPT G|)LETTER SMALL CAPITAL G|)SMALL LETTER GAMMA|6RAMS HORN|6TURNED H|6H WITH HOOK|7ENG WITH HOOK|6I WITH STROKE|7OTA|)LETTER SMALL CAPITAL I|)SMALL LETTER L WITH MIDDLE TILDE|=BELT|=RETROFLEX HOOK|7EZH|6TURNED M|> WITH LONG LEG|6M WITH HOOK|6N WITH LEFT HOOK|=RETROFLEX HOOK|)LETTER SMALL CAPITAL N|)SMALL LETTER BARRED O|)LETTER SMALL CAPITAL OE|)SMALL LETTER CLOSED OMEGA|6PHI|6TURNED R|> WITH LONG LEG|DHOOK|6R WITH LONG LEG|=TAIL|=FISHHOOK|7EVERSED R WITH FISHHOOK|)LETTER SMALL CAPITAL R|>INVERTED R|)SMALL LETTER S WITH HOOK|6ESH|6DOTLESS J WITH STROKE AND HOOK|6SQUAT REVERSED ESH|6ESH WITH CURL|6TURNED T|7 WITH RETROFLEX HOOK|6U BAR|7PSILON|6V WITH HOOK|6TURNED V|=W|=Y|)LETTER SMALL CAPITAL Y|)SMALL LETTER Z WITH RETROFLEX HOOK|=CURL|6EZH|9 WITH CURL|)LETTER GLOTTAL STOP|0PHARYNGEAL VOICED FRICATIVE|0INVERTED GLOTTAL STOP|0STRETCHED C|0BILABIAL CLICK|0SMALL CAPITAL B|)SMALL LETTER CLOSED OPEN E|)LETTER SMALL CAPITAL G WITH HOOK|>H|)SMALL LETTER J WITH CROSSED-TAIL|6TURNED K|)LETTER SMALL CAPITAL L|)SMALL LETTER Q WITH HOOK|)LETTER GLOTTAL STOP WITH STROKE|0REVERSED GLOTTAL STOP WITH STROKE|)SMALL LETTER DZ DIGRAPH|7EZH DIGRAPH|7Z DIGRAPH WITH CURL|6TS DIGRAPH|7ESH DIGRAPH|7C DIGRAPH WITH CURL|6FENG DIGRAPH|6LS DIGRAPH|7Z DIGRAPH|)LETTER BILABIAL PERCUSSIVE|2DENTAL PERCUSSIVE|)SMALL LETTER TURNED H WITH FISHHOOK|L AND TAIL|#MODIFIER LETTER SMALL H|: WITH HOOK|9J|9R|9TURNED R|A WITH HOOK|9CAPITAL INVERTED R|9W|9Y|3PRIME|3DOUBLE PRIME|3TURNED COMMA|3APOSTROPHE|3REVERSED COMMA|4IGHT HALF RING|3LEFT HALF RING|3GLOTTAL STOP|3REVERSED GLOTTAL STOP|3LEFT ARROWHEAD|3RIGHT ARROWHEAD|3UP ARROWHEAD|3DOWN ARROWHEAD|3CIRCUMFLEX ACCENT|#CARON|#MODIFIER LETTER VERTICAL LINE|3MACRON|3ACUTE ACCENT|3GRAVE ACCENT|3LOW VERTICAL LINE|7MACRON|7GRAVE ACCENT|7ACUTE ACCENT|3TRIANGULAR COLON|3HALF TRIANGULAR COLON|3CENTRED RIGHT HALF RING|;LEFT HALF RING|3UP TACK|3DOWN TACK|3PLUS SIGN|3MINUS SIGN|#BREVE|#DOT ABOVE|#RING ABOVE|#OGONEK|#SMALL TILDE|#DOUBLE ACUTE ACCENT|#MODIFIER LETTER RHOTIC HOOK|3CROSS ACCENT|3SMALL GAMMA|9L|9S|9X|9REVERSED GLOTTAL STOP|3EXTRA-HIGH TONE BAR|3HIGH TONE BAR|3MID TONE BAR|3LOW TONE BAR|3EXTRA-LOW TONE BAR|3YIN DEPARTING TONE MARK|4ANG DEPARTING TONE MARK|3VOICING|3UNASPIRATED|3DOUBLE APOSTROPHE|3LOW DOWN ARROWHEAD|7UP ARROWHEAD|7LEFT ARROWHEAD|7RIGHT ARROWHEAD|9NG|3MIDDLE GRAVE ACCENT|:DOUBLE GRAVE ACCENT|AACUTE ACCENT|3LOW TILDE|3RAISED COLON|3BEGIN HIGH TONE|3END HIGH TONE|3BEGIN LOW TONE|3END LOW TONE|3SHELF|3OPEN SHELF|3LOW LEFT ARROW|#COMBINING GRAVE ACCENT|-ACUTE ACCENT|-CIRCUMFLEX ACCENT|-TILDE|-MACRON|-OVERLINE|-BREVE|-DOT ABOVE|.IAERESIS|-HOOK ABOVE|-RING ABOVE|-DOUBLE ACUTE ACCENT|-CARON|-VERTICAL LINE ABOVE|-DOUBLE VERTICAL LINE ABOVE|4GRAVE ACCENT|-CANDRABINDU|-INVERTED BREVE|-TURNED COMMA ABOVE|-COMMA ABOVE|-REVERSED COMMA ABOVE|-COMMA ABOVE RIGHT|-GRAVE ACCENT BELOW|-ACUTE ACCENT BELOW|-LEFT TACK BELOW|-RIGHT TACK BELOW|-LEFT ANGLE ABOVE|-HORN|-LEFT HALF RING BELOW|-UP TACK BELOW|-DOWN TACK BELOW|-PLUS SIGN BELOW|-MINUS SIGN BELOW|-PALATALIZED HOOK BELOW|-RETROFLEX HOOK BELOW|-DOT BELOW|.IAERESIS BELOW|-RING BELOW|-COMMA BELOW|.EDILLA|-OGONEK|-VERTICAL LINE BELOW|-BRIDGE BELOW|-INVERTED DOUBLE ARCH BELOW|-CARON BELOW|.IRCUMFLEX ACCENT BELOW|-BREVE BELOW|-INVERTED BREVE BELOW|-TILDE BELOW|-MACRON BELOW|-LOW LINE|-DOUBLE LOW LINE|-TILDE OVERLAY|-SHORT STROKE OVERLAY|-LONG STROKE OVERLAY|-SHORT SOLIDUS OVERLAY|-LONG SOLIDUS OVERLAY|-RIGHT HALF RING BELOW|-INVERTED BRIDGE BELOW|-SQUARE BELOW|.EAGULL BELOW|-X ABOVE|-VERTICAL TILDE|-DOUBLE OVERLINE|-GRAVE TONE MARK|-ACUTE TONE MARK|-GREEK PERISPOMENI|3KORONIS|3DIALYTIKA TONOS|3YPOGEGRAMMENI|-BRIDGE ABOVE|-EQUALS SIGN BELOW|-DOUBLE VERTICAL LINE BELOW|-LEFT ANGLE BELOW|-NOT TILDE ABOVE|-HOMOTHETIC ABOVE|-ALMOST EQUAL TO ABOVE|-LEFT RIGHT ARROW BELOW|-UPWARDS ARROW BELOW|-GRAPHEME JOINER|-RIGHT ARROWHEAD ABOVE|-LEFT HALF RING ABOVE|-FERMATA|-X BELOW|-LEFT ARROWHEAD BELOW|-RIGHT ARROWHEAD BELOW|=AND UP ARROWHEAD BELOW|3HALF RING ABOVE|-DOT ABOVE RIGHT|-ASTERISK BELOW|-DOUBLE RING BELOW|-ZIGZAG ABOVE|-DOUBLE BREVE BELOW|9|4MACRON|: BELOW|4TILDE|4INVERTED BREVE|4RIGHTWARDS ARROW BELOW|-LATIN SMALL LETTER A|@E|@I|@O|@U|@C|@D|@H|@M|@R|@T|@V|@X|#GREEK CAPITAL LETTER HETA|)SMALL LETTER HETA|)CAPITAL LETTER ARCHAIC SAMPI|)SMALL LETTER ARCHAIC SAMPI|)NUMERAL SIGN|)LOWER NUMERAL SIGN|)CAPITAL LETTER PAMPHYLIAN DIGAMMA|)SMALL LETTER PAMPHYLIAN DIGAMMA|)YPOGEGRAMMENI|)SMALL REVERSED LUNATE SIGMA SYMBOL|/DOTTED LUNATE SIGMA SYMBOL|/REVERSED DOTTED LUNATE SIGMA SYMBOL|)QUESTION MARK|)CAPITAL LETTER YOT|)TONOS|)DIALYTIKA TONOS|)CAPITAL LETTER ALPHA WITH TONOS|)ANO TELEIA|)CAPITAL LETTER EPSILON WITH TONOS|9TA WITH TONOS|8IOTA WITH TONOS|8OMICRON WITH TONOS|8UPSILON WITH TONOS|8OMEGA WITH TONOS|)SMALL LETTER IOTA WITH DIALYTIKA AND TONOS|)CAPITAL LETTER ALPHA|8BETA|8GAMMA|8DELTA|8EPSILON|8ZETA|8ETA|8THETA|8IOTA|8KAPPA|8LAMDA|8MU|8NU|8XI|8OMICRON|8PI|8RHO|8SIGMA|8TAU|8UPSILON|8PHI|8CHI|8PSI|8OMEGA|8IOTA WITH DIALYTIKA|8UPSILON WITH DIALYTIKA|)SMALL LETTER ALPHA WITH TONOS|6EPSILON WITH TONOS|7TA WITH TONOS|6IOTA WITH TONOS|6UPSILON WITH DIALYTIKA AND TONOS|6ALPHA|6BETA|6GAMMA|6DELTA|6EPSILON|6ZETA|6ETA|6THETA|6IOTA|6KAPPA|6LAMDA|6MU|6NU|6XI|6OMICRON|6PI|6RHO|6FINAL SIGMA|6SIGMA|6TAU|6UPSILON|6PHI|6CHI|6PSI|6OMEGA|6IOTA WITH DIALYTIKA|6UPSILON WITH DIALYTIKA|6OMICRON WITH TONOS|6UPSILON WITH TONOS|6OMEGA WITH TONOS|)CAPITAL KAI SYMBOL|)BETA SYMBOL|)THETA SYMBOL|)UPSILON WITH HOOK SYMBOL|6ACUTE AND HOOK SYMBOL|6DIAERESIS AND HOOK SYMBOL|)PHI SYMBOL|*I SYMBOL|)KAI SYMBOL|)LETTER ARCHAIC KOPPA|)SMALL LETTER ARCHAIC KOPPA|)LETTER STIGMA|)SMALL LETTER STIGMA|)LETTER DIGAMMA|)SMALL LETTER DIGAMMA|)LETTER KOPPA|)SMALL LETTER KOPPA|)LETTER SAMPI|)SMALL LETTER SAMPI|#COPTIC CAPITAL LETTER SHEI|*SMALL LETTER SHEI|*CAPITAL LETTER FEI|*SMALL LETTER FEI|*CAPITAL LETTER KHEI|*SMALL LETTER KHEI|*CAPITAL LETTER HORI|*SMALL LETTER HORI|*CAPITAL LETTER GANGIA|*SMALL LETTER GANGIA|*CAPITAL LETTER SHIMA|*SMALL LETTER SHIMA|*CAPITAL LETTER DEI|*SMALL LETTER DEI|#GREEK KAPPA SYMBOL|)RHO SYMBOL|)LUNATE SIGMA SYMBOL|*ETTER YOT|)CAPITAL THETA SYMBOL|)LUNATE EPSILON SYMBOL|)REVERSED LUNATE EPSILON SYMBOL|)CAPITAL LETTER SHO|)SMALL LETTER SHO|)CAPITAL LUNATE SIGMA SYMBOL|2ETTER SAN|)SMALL LETTER SAN|)RHO WITH STROKE SYMBOL|)CAPITAL REVERSED LUNATE SIGMA SYMBOL|1DOTTED LUNATE SIGMA SYMBOL|1REVERSED DOTTED LUNATE SIGMA SYMBOL|#CYRILLIC CAPITAL LETTER IE WITH GRAVE|<O|;DJE|;GJE|;UKRAINIAN IE|;DZE|;BYELORUSSIAN-UKRAINIAN I|;YI|;JE|;LJE|;NJE|;TSHE|;KJE|;I WITH GRAVE|;SHORT U|;DZHE|;A|;BE|;VE|;GHE|;DE|;IE|;ZHE|<E|;I|;SHORT I|;KA|;EL|<M|<N|;O|;PE|;ER|<S|;TE|;U|;EF|;HA|;TSE|;CHE|;SHA|=CHA|;HARD SIGN|;YERU|;SOFT SIGN|;E|;YU|<A|,SMALL LETTER A|9BE|9VE|9GHE|9DE|9IE|9ZHE|:E|9I|9SHORT I|9KA|9EL|:M|:N|9O|9PE|9ER|:S|9TE|9U|9EF|9HA|9TSE|9CHE|9SHA|;CHA|9HARD SIGN|9YERU|9SOFT SIGN|9E|9YU|:A|9IE WITH GRAVE|:O|9DJE|9GJE|9UKRAINIAN IE|9DZE|9BYELORUSSIAN-UKRAINIAN I|9YI|9JE|9LJE|9NJE|9TSHE|9KJE|9I WITH GRAVE|9SHORT U|9DZHE|,CAPITAL LETTER OMEGA|,SMALL LETTER OMEGA|,CAPITAL LETTER YAT|,SMALL LETTER YAT|,CAPITAL LETTER IOTIFIED E|,SMALL LETTER IOTIFIED E|,CAPITAL LETTER LITTLE YUS|,SMALL LETTER LITTLE YUS|,CAPITAL LETTER IOTIFIED LITTLE YUS|,SMALL LETTER IOTIFIED LITTLE YUS|,CAPITAL LETTER BIG YUS|,SMALL LETTER BIG YUS|,CAPITAL LETTER IOTIFIED BIG YUS|,SMALL LETTER IOTIFIED BIG YUS|,CAPITAL LETTER KSI|,SMALL LETTER KSI|,CAPITAL LETTER PSI|,SMALL LETTER PSI|,CAPITAL LETTER FITA|,SMALL LETTER FITA|,CAPITAL LETTER IZHITSA|,SMALL LETTER IZHITSA|,CAPITAL LETTER IZHITSA WITH DOUBLE GRAVE ACCENT|,SMALL LETTER IZHITSA WITH DOUBLE GRAVE ACCENT|,CAPITAL LETTER UK|,SMALL LETTER UK|,CAPITAL LETTER ROUND OMEGA|,SMALL LETTER ROUND OMEGA|,CAPITAL LETTER OMEGA WITH TITLO|,SMALL LETTER OMEGA WITH TITLO|,CAPITAL LETTER OT|,SMALL LETTER OT|,CAPITAL LETTER KOPPA|,SMALL LETTER KOPPA|,THOUSANDS SIGN|$OMBINING CYRILLIC TITLO|6PALATALIZATION|6DASIA PNEUMATA|6PSILI PNEUMATA|7OKRYTIE|6HUNDRED THOUSANDS SIGN|6MILLIONS SIGN|$YRILLIC CAPITAL LETTER SHORT I WITH TAIL|,SMALL LETTER SHORT I WITH TAIL|,CAPITAL LETTER SEMISOFT SIGN|,SMALL LETTER SEMISOFT SIGN|,CAPITAL LETTER ER WITH TICK|,SMALL LETTER ER WITH TICK|,CAPITAL LETTER GHE WITH UPTURN|,SMALL LETTER GHE WITH UPTURN|,CAPITAL LETTER GHE WITH STROKE|,SMALL LETTER GHE WITH STROKE|,CAPITAL LETTER GHE WITH MIDDLE HOOK|,SMALL LETTER GHE WITH MIDDLE HOOK|,CAPITAL LETTER ZHE WITH DESCENDER|,SMALL LETTER ZHE WITH DESCENDER|,CAPITAL LETTER ZE WITH DESCENDER|,SMALL LETTER ZE WITH DESCENDER|,CAPITAL LETTER KA WITH DESCENDER|,SMALL LETTER KA WITH DESCENDER|,CAPITAL LETTER KA WITH VERTICAL STROKE|,SMALL LETTER KA WITH VERTICAL STROKE|,CAPITAL LETTER KA WITH STROKE|,SMALL LETTER KA WITH STROKE|,CAPITAL LETTER BASHKIR KA|,SMALL LETTER BASHKIR KA|,CAPITAL LETTER EN WITH DESCENDER|,SMALL LETTER EN WITH DESCENDER|,CAPITAL LIGATURE EN GHE|,SMALL LIGATURE EN GHE|,CAPITAL LETTER PE WITH MIDDLE HOOK|,SMALL LETTER PE WITH MIDDLE HOOK|,CAPITAL LETTER ABKHASIAN HA|,SMALL LETTER ABKHASIAN HA|,CAPITAL LETTER ES WITH DESCENDER|,SMALL LETTER ES WITH DESCENDER|,CAPITAL LETTER TE WITH DESCENDER|,SMALL LETTER TE WITH DESCENDER|,CAPITAL LETTER STRAIGHT U|,SMALL LETTER STRAIGHT U|,CAPITAL LETTER STRAIGHT U WITH STROKE|,SMALL LETTER STRAIGHT U WITH STROKE|,CAPITAL LETTER HA WITH DESCENDER|,SMALL LETTER HA WITH DESCENDER|,CAPITAL LIGATURE TE TSE|,SMALL LIGATURE TE TSE|,CAPITAL LETTER CHE WITH DESCENDER|,SMALL LETTER CHE WITH DESCENDER|,CAPITAL LETTER CHE WITH VERTICAL STROKE|,SMALL LETTER CHE WITH VERTICAL STROKE|,CAPITAL LETTER SHHA|,SMALL LETTER SHHA|,CAPITAL LETTER ABKHASIAN CHE|,SMALL LETTER ABKHASIAN CHE|,CAPITAL LETTER ABKHASIAN CHE WITH DESCENDER|,SMALL LETTER ABKHASIAN CHE WITH DESCENDER|,LETTER PALOCHKA|,CAPITAL LETTER ZHE WITH BREVE|,SMALL LETTER ZHE WITH BREVE|,CAPITAL LETTER KA WITH HOOK|,SMALL LETTER KA WITH HOOK|,CAPITAL LETTER EL WITH TAIL|,SMALL LETTER EL WITH TAIL|,CAPITAL LETTER EN WITH HOOK|,SMALL LETTER EN WITH HOOK|,CAPITAL LETTER EN WITH TAIL|,SMALL LETTER EN WITH TAIL|,CAPITAL LETTER KHAKASSIAN CHE|,SMALL LETTER KHAKASSIAN CHE|,CAPITAL LETTER EM WITH TAIL|,SMALL LETTER EM WITH TAIL|9PALOCHKA|,CAPITAL LETTER A WITH BREVE|,SMALL LETTER A WITH BREVE|,CAPITAL LETTER A WITH DIAERESIS|,SMALL LETTER A WITH DIAERESIS|,CAPITAL LIGATURE A IE|,SMALL LIGATURE A IE|,CAPITAL LETTER IE WITH BREVE|,SMALL LETTER IE WITH BREVE|,CAPITAL LETTER SCHWA|,SMALL LETTER SCHWA|,CAPITAL LETTER SCHWA WITH DIAERESIS|,SMALL LETTER SCHWA WITH DIAERESIS|,CAPITAL LETTER ZHE WITH DIAERESIS|,SMALL LETTER ZHE WITH DIAERESIS|,CAPITAL LETTER ZE WITH DIAERESIS|,SMALL LETTER ZE WITH DIAERESIS|,CAPITAL LETTER ABKHASIAN DZE|,SMALL LETTER ABKHASIAN DZE|,CAPITAL LETTER I WITH MACRON|,SMALL LETTER I WITH MACRON|,CAPITAL LETTER I WITH DIAERESIS|,SMALL LETTER I WITH DIAERESIS|,CAPITAL LETTER O WITH DIAERESIS|,SMALL LETTER O WITH DIAERESIS|,CAPITAL LETTER BARRED O|,SMALL LETTER BARRED O|,CAPITAL LETTER BARRED O WITH DIAERESIS|,SMALL LETTER BARRED O WITH DIAERESIS|,CAPITAL LETTER E WITH DIAERESIS|,SMALL LETTER E WITH DIAERESIS|,CAPITAL LETTER U WITH MACRON|,SMALL LETTER U WITH MACRON|,CAPITAL LETTER U WITH DIAERESIS|,SMALL LETTER U WITH DIAERESIS|,CAPITAL LETTER U WITH DOUBLE ACUTE|,SMALL LETTER U WITH DOUBLE ACUTE|,CAPITAL LETTER CHE WITH DIAERESIS|,SMALL LETTER CHE WITH DIAERESIS|,CAPITAL LETTER GHE WITH DESCENDER|,SMALL LETTER GHE WITH DESCENDER|,CAPITAL LETTER YERU WITH DIAERESIS|,SMALL LETTER YERU WITH DIAERESIS|,CAPITAL LETTER GHE WITH STROKE AND HOOK|,SMALL LETTER GHE WITH STROKE AND HOOK|,CAPITAL LETTER HA WITH HOOK|,SMALL LETTER HA WITH HOOK|,CAPITAL LETTER HA WITH STROKE|,SMALL LETTER HA WITH STROKE|,CAPITAL LETTER KOMI DE|,SMALL LETTER KOMI DE|,CAPITAL LETTER KOMI DJE|,SMALL LETTER KOMI DJE|,CAPITAL LETTER KOMI ZJE|,SMALL LETTER KOMI ZJE|,CAPITAL LETTER KOMI DZJE|,SMALL LETTER KOMI DZJE|,CAPITAL LETTER KOMI LJE|,SMALL LETTER KOMI LJE|,CAPITAL LETTER KOMI NJE|,SMALL LETTER KOMI NJE|,CAPITAL LETTER KOMI SJE|,SMALL LETTER KOMI SJE|,CAPITAL LETTER KOMI TJE|,SMALL LETTER KOMI TJE|,CAPITAL LETTER REVERSED ZE|,SMALL LETTER REVERSED ZE|,CAPITAL LETTER EL WITH HOOK|,SMALL LETTER EL WITH HOOK|,CAPITAL LETTER LHA|,SMALL LETTER LHA|,CAPITAL LETTER RHA|,SMALL LETTER RHA|,CAPITAL LETTER YAE|,SMALL LETTER YAE|,CAPITAL LETTER QA|,SMALL LETTER QA|,CAPITAL LETTER WE|,SMALL LETTER WE|,CAPITAL LETTER ALEUT KA|,SMALL LETTER ALEUT KA|,CAPITAL LETTER EL WITH MIDDLE HOOK|,SMALL LETTER EL WITH MIDDLE HOOK|,CAPITAL LETTER EN WITH MIDDLE HOOK|,SMALL LETTER EN WITH MIDDLE HOOK|,CAPITAL LETTER PE WITH DESCENDER|,SMALL LETTER PE WITH DESCENDER|,CAPITAL LETTER SHHA WITH DESCENDER|,SMALL LETTER SHHA WITH DESCENDER|,CAPITAL LETTER EN WITH LEFT HOOK|,SMALL LETTER EN WITH LEFT HOOK|,CAPITAL LETTER DZZHE|,SMALL LETTER DZZHE|,CAPITAL LETTER DCHE|,SMALL LETTER DCHE|,CAPITAL LETTER EL WITH DESCENDER|,SMALL LETTER EL WITH DESCENDER|#ARMENIAN CAPITAL LETTER AYB|;BEN|;GIM|;DA|;ECH|;ZA|;EH|<T|;TO|;ZHE|;INI|;LIWN|;XEH|;CA|;KEN|;HO|;JA|;GHAD|;CHEH|;MEN|;YI|;NOW|;SHA|;VO|;CHA|;PEH|;JHEH|;RA|;SEH|;VEW|;TIWN|;REH|;CO|;YIWN|;PIWR|;KEH|;OH|;FEH|#MODIFIER LETTER ARMENIAN SMALL EH|#ARMENIAN MODIFIER LETTER LEFT HALF RING|,APOSTROPHE|,EMPHASIS MARK|-XCLAMATION MARK|,COMMA|,QUESTION MARK|,ABBREVIATION MARK|,SMALL LETTER TURNED AYB|9AYB|9BEN|9GIM|9DA|9ECH|9ZA|9EH|:T|9TO|9ZHE|9INI|9LIWN|9XEH|9CA|9KEN|9HO|9JA|9GHAD|9CHEH|9MEN|9YI|9NOW|9SHA|9VO|9CHA|9PEH|9JHEH|9RA|9SEH|9VEW|9TIWN|9REH|9CO|9YIWN|9PIWR|9KEH|9OH|9FEH|3IGATURE ECH YIWN|3ETTER YI WITH STROKE|,FULL STOP|,HYPHEN|#MODIFIER LETTER ARMENIAN SMALL INI|BYI|#RIGHT-FACING ARMENIAN ETERNITY SIGN|#LEFT-FACING ARMENIAN ETERNITY SIGN|#ARMENIAN DRAM SIGN|#HEBREW ACCENT ETNAHTA|1SEGOL|2HALSHELET|1ZAQEF QATAN|7GADOL|1TIPEHA|1REVIA|1ZARQA|1PASHTA|1YETIV|1TEVIR|1GERESH|7 MUQDAM|4SHAYIM|1QARNEY PARA|1TELISHA GEDOLA|1PAZER|1ATNAH HAFUKH|1MUNAH|2AHAPAKH|2ERKHA|7 KEFULA|1DARGA|1QADMA|1TELISHA QETANA|1YERAH BEN YOMO|1OLE|1ILUY|1DEHI|1ZINOR|*MARK MASORA CIRCLE|*POINT SHEVA|0HATAF SEGOL|6PATAH|6QAMATS|1IRIQ|0TSERE|0SEGOL|0PATAH|0QAMATS|0HOLAM|5 HASER FOR VAV|0QUBUTS|0DAGESH OR MAPIQ|0METEG|+UNCTUATION MAQAF|+OINT RAFE|+UNCTUATION PASEQ|+OINT SHIN DOT|1IN DOT|+UNCTUATION SOF PASUQ|*MARK UPPER DOT|/LOWER DOT|*PUNCTUATION NUN HAFUKHA|+OINT QAMATS QATAN|0SHEVA NA MUDGASH|0DAGESH HAZAQ MUDGASH|*LETTER ALEF|1BET|1GIMEL|1DALET|1HE|1VAV|1ZAYIN|1HET|1TET|1YOD|1FINAL KAF|1KAF|1LAMED|1FINAL MEM|1MEM|1FINAL NUN|1NUN|1SAMEKH|1AYIN|1FINAL PE|1PE|1FINAL TSADI|1TSADI|1QOF|1RESH|1SHIN|1TAV|*YOD TRIANGLE|*LIGATURE YIDDISH DOUBLE VAV|;VAV YOD|;DOUBLE YOD|*PUNCTUATION GERESH|9SHAYIM|#ARABIC NUMBER SIGN|*SIGN SANAH|*FOOTNOTE MARKER|*SIGN SAFHA|1MVAT|*NUMBER MARK ABOVE|)-INDIC CUBE ROOT|0FOURTH ROOT|) RAY|)-INDIC PER MILLE SIGN|4TEN THOUSAND SIGN|$FGHANI SIGN|$RABIC COMMA|*DATE SEPARATOR|*POETIC VERSE SIGN|*SIGN MISRA|/SALLALLAHOU ALAYHE WASSALLAM|/ALAYHE ASSALLAM|/RAHMATULLAH ALAYHE|1DI ALLAHOU ANHU|/TAKHALLUS|+MALL HIGH TAH|5LIGATURE ALEF WITH LAM WITH YEH|5ZAIN|0FATHA|0DAMMA|0KASRA|+EMICOLON|*LETTER MARK|*END OF TEXT MARK|*TRIPLE DOT PUNCTUATION MARK|*QUESTION MARK|*LETTER KASHMIRI YEH|1HAMZA|1ALEF WITH MADDA ABOVE|;HAMZA ABOVE|1WAW WITH HAMZA ABOVE|1ALEF WITH HAMZA BELOW|1YEH WITH HAMZA ABOVE|1ALEF|1BEH|1TEH MARBUTA|4|2HEH|1JEEM|1HAH|1KHAH|1DAL|1THAL|1REH|1ZAIN|1SEEN|2HEEN|2AD|1DAD|1TAH|1ZAH|1AIN|1GHAIN|1KEHEH WITH TWO DOTS ABOVE|=HREE DOTS BELOW|1FARSI YEH WITH INVERTED V|@TWO DOTS ABOVE|AHREE DOTS ABOVE|*TATWEEL|*LETTER FEH|1QAF|1KAF|1LAM|1MEEM|1NOON|1HEH|1WAW|1ALEF MAKSURA|1YEH|*FATHATAN|*DAMMATAN|*KASRATAN|*FATHA|*DAMMA|*KASRA|*SHADDA|+UKUN|*MADDAH ABOVE|*HAMZA ABOVE|0BELOW|*SUBSCRIPT ALEF|*INVERTED DAMMA|*MARK NOON GHUNNA|*ZWARAKAY|*VOWEL SIGN SMALL V ABOVE|5INVERTED SMALL V ABOVE|5DOT BELOW|*REVERSED DAMMA|*FATHA WITH TWO DOTS|*WAVY HAMZA BELOW|)-INDIC DIGIT ZERO|6ONE|6TWO|7HREE|6FOUR|7IVE|6SIX|7EVEN|6EIGHT|6NINE|) PERCENT SIGN|*DECIMAL SEPARATOR|*THOUSANDS SEPARATOR|*FIVE POINTED STAR|*LETTER DOTLESS BEH|9QAF|1SUPERSCRIPT ALEF|1ALEF WASLA|7ITH WAVY HAMZA ABOVE|FBELOW|1HIGH HAMZA|; ALEF|<WAW|1U WITH HAMZA ABOVE|1HIGH HAMZA YEH|1TTEH|5EH|1BEEH|1TEH WITH RING|:THREE DOTS ABOVE DOWNWARDS|1PEH|1TEHEH|1BEHEH|1HAH WITH HAMZA ABOVE|:TWO DOTS VERTICAL ABOVE|1NYEH|1DYEH|1HAH WITH THREE DOTS ABOVE|1TCHEH|6EH|1DDAL|2AL WITH RING|:DOT BELOW|C AND SMALL TAH|3HAL|2DAHAL|2UL|2AL WITH THREE DOTS ABOVE DOWNWARDS|:FOUR DOTS ABOVE|1RREH|2EH WITH SMALL V|:RING|:DOT BELOW|:SMALL V BELOW|:DOT BELOW AND DOT ABOVE|:TWO DOTS ABOVE|1JEH|1REH WITH FOUR DOTS ABOVE|1SEEN WITH DOT BELOW AND DOT ABOVE|;THREE DOTS BELOW|K AND THREE DOTS ABOVE|2AD WITH TWO DOTS BELOW|;HREE DOTS ABOVE|1TAH WITH THREE DOTS ABOVE|1AIN WITH THREE DOTS ABOVE|1DOTLESS FEH|1FEH WITH DOT MOVED BELOW|>BELOW|1VEH|1FEH WITH THREE DOTS BELOW|1PEHEH|1QAF WITH DOT ABOVE|:THREE DOTS ABOVE|1KEHEH|1SWASH KAF|1KAF WITH RING|:DOT ABOVE|1NG|1KAF WITH THREE DOTS BELOW|1GAF|4 WITH RING|1NGOEH|1GAF WITH TWO DOTS BELOW|2UEH|2AF WITH THREE DOTS ABOVE|1LAM WITH SMALL V|:DOT ABOVE|:THREE DOTS ABOVE|EBELOW|1NOON WITH DOT BELOW|6GHUNNA|1RNOON|1NOON WITH RING|;THREE DOTS ABOVE|1HEH DOACHASHMEE|1TCHEH WITH DOT ABOVE|1HEH WITH YEH ABOVE|5GOAL|9 WITH HAMZA ABOVE|1TEH MARBUTA GOAL|1WAW WITH RING|1KIRGHIZ OE|1OE|1U|1YU|1KIRGHIZ YU|1WAW WITH TWO DOTS ABOVE|1VE|1FARSI YEH|1YEH WITH TAIL|:SMALL V|1WAW WITH DOT ABOVE|1E|1YEH WITH THREE DOTS BELOW|5BARREE|; WITH HAMZA ABOVE|*FULL STOP|*LETTER AE|*SMALL HIGH LIGATURE SAD WITH LAM WITH ALEF MAKSURA|>QAF WITH LAM WITH ALEF MAKSURA|5MEEM INITIAL FORM|5LAM ALEF|5JEEM|5THREE DOTS|5SEEN|*END OF AYAH|*START OF RUB EL HIZB|+MALL HIGH ROUNDED ZERO|5UPRIGHT RECTANGULAR ZERO|5DOTLESS HEAD OF KHAH|5MEEM ISOLATED FORM|0LOW SEEN|0HIGH MADDA|0WAW|0YEH|0HIGH YEH|5NOON|*PLACE OF SAJDAH|*EMPTY CENTRE LOW STOP|7HIGH STOP|*ROUNDED HIGH STOP WITH FILLED CENTRE|*SMALL LOW MEEM|*LETTER DAL WITH INVERTED V|1REH WITH INVERTED V|#EXTENDED ARABIC-INDIC DIGIT ZERO|?ONE|?TWO|@HREE|?FOUR|@IVE|?SIX|@EVEN|?EIGHT|?NINE|#ARABIC LETTER SHEEN WITH DOT BELOW|1DAD WITH DOT BELOW|1GHAIN WITH DOT BELOW|*SIGN SINDHI AMPERSAND|6POSTPOSITION MEN|*LETTER HEH WITH INVERTED V|#SYRIAC END OF PARAGRAPH|*SUPRALINEAR FULL STOP|,BLINEAR FULL STOP|,PRALINEAR COLON|,BLINEAR COLON|*HORIZONTAL COLON|*COLON SKEWED LEFT|7RIGHT|*SUPRALINEAR COLON SKEWED LEFT|,BLINEAR COLON SKEWED RIGHT|*CONTRACTION|*HARKLEAN OBELUS|3METOBELUS|3ASTERISCUS|*ABBREVIATION MARK|*LETTER ALAPH|1SUPERSCRIPT ALAPH|1BETH|1GAMAL|6 GARSHUNI|1DALATH|2OTLESS DALATH RISH|1HE|1WAW|1ZAIN|1HETH|1TETH|5 GARSHUNI|1YUDH|5 HE|1KAPH|1LAMADH|1MIM|1NUN|1SEMKATH|1FINAL SEMKATH|1E|1PE|1REVERSED PE|1SADHE|1QAPH|1RISH|1SHIN|1TAW|1PERSIAN BHETH|9GHAMAL|9DHALATH|*PTHAHA ABOVE|1BELOW|1DOTTED|*ZQAPHA ABOVE|1BELOW|1DOTTED|*RBASA ABOVE|0BELOW|*DOTTED ZLAMA HORIZONTAL|7ANGULAR|*HBASA ABOVE|0BELOW|/-ESASA DOTTED|*ESASA ABOVE|0BELOW|*RWAHA|*FEMININE DOT|*QUSHSHAYA|*RUKKAKHA|*TWO VERTICAL DOTS ABOVE|<BELOW|+HREE DOTS ABOVE|5BELOW|*OBLIQUE LINE ABOVE|7BELOW|*MUSIC|*BARREKH|*LETTER SOGDIAN ZHAIN|9KHAPH|9FE|#ARABIC LETTER BEH WITH THREE DOTS HORIZONTALLY BELOW|:DOT BELOW AND THREE DOTS ABOVE|:THREE DOTS POINTING UPWARDS BELOW|[ AND TWO DOTS ABOVE|;WO DOTS BELOW AND DOT ABOVE|:INVERTED SMALL V BELOW|:SMALL V|1HAH WITH TWO DOTS ABOVE|;HREE DOTS POINTING UPWARDS BELOW|1DAL WITH TWO DOTS VERTICALLY BELOW AND SMALL TAH|:INVERTED SMALL V BELOW|1REH WITH STROKE|1SEEN WITH FOUR DOTS ABOVE|1AIN WITH TWO DOTS ABOVE|;HREE DOTS POINTING DOWNWARDS ABOVE|;WO DOTS VERTICALLY ABOVE|1FEH WITH TWO DOTS BELOW|;HREE DOTS POINTING UPWARDS BELOW|1KEHEH WITH DOT ABOVE|<THREE DOTS ABOVE|GPOINTING UPWARDS BELOW|1MEEM WITH DOT ABOVE|?BELOW|1NOON WITH TWO DOTS BELOW|;SMALL TAH|AV|1LAM WITH BAR|1REH WITH TWO DOTS VERTICALLY ABOVE|:HAMZA ABOVE|1SEEN WITH TWO DOTS VERTICALLY ABOVE|1HAH WITH SMALL ARABIC LETTER TAH BELOW|RAND TWO DOTS|1SEEN WITH SMALL ARABIC LETTER TAH AND TWO DOTS|1REH WITH SMALL ARABIC LETTER TAH AND TWO DOTS|1HAH WITH SMALL ARABIC LETTER TAH ABOVE|1ALEF WITH EXTENDED ARABIC-INDIC DIGIT TWO ABOVE|XHREE ABOVE|1FARSI YEH WITH EXTENDED ARABIC-INDIC DIGIT TWO ABOVE|]HREE ABOVE|\\FOUR BELOW|1WAW WITH EXTENDED ARABIC-INDIC DIGIT TWO ABOVE|WHREE ABOVE|1YEH BARREE WITH EXTENDED ARABIC-INDIC DIGIT TWO ABOVE|^HREE ABOVE|1HAH WITH EXTENDED ARABIC-INDIC DIGIT FOUR BELOW|1SEEN WITH EXTENDED ARABIC-INDIC DIGIT FOUR ABOVE|;INVERTED V|1KAF WITH TWO DOTS ABOVE|#THAANA LETTER HAA|1SHAVIYANI|1NOONU|1RAA|1BAA|1LHAVIYANI|1KAAFU|1ALIFU|1VAAVU|1MEEMU|1FAAFU|1DHAALU|1THAA|1LAAMU|1GAAFU|2NAVIYANI|1SEENU|1DAVIYANI|1ZAVIYANI|1TAVIYANI|1YAA|1PAVIYANI|1JAVIYANI|1CHAVIYANI|1TTAA|1HHAA|1KHAA|1THAALU|1ZAA|1SHEENU|2AADHU|1DAADHU|1TO|1ZO|1AINU|1GHAINU|1QAAFU|1WAAVU|*ABAFILI|+ABAAFILI|*IBIFILI|*EEBEEFILI|*UBUFILI|*OOBOOFILI|*EBEFILI|+YBEYFILI|*OBOFILI|+ABOAFILI|*SUKUN|*LETTER NAA|#NKO DIGIT ZERO|-ONE|-TWO|.HREE|-FOUR|.IVE|-SIX|.EVEN|-EIGHT|-NINE|'LETTER A|.EE|.I|.E|.U|.OO|/|.DAGBASINNA|.N|.BA|.PA|.TA|.JA|.CHA|.DA|.RA|/RA|.SA|.GBA|.FA|.KA|.LA|.NA WOLOSO|.MA|.NYA|/A|.HA|.WA|.YA|.NYA WOLOSO|.JONA JA|3CHA|3RA|'COMBINING SHORT HIGH TONE|7LOW TONE|7RISING TONE|1LONG DESCENDING TONE|6HIGH TONE|6LOW TONE|6RISING TONE|1NASALIZATION MARK|1DOUBLE DOT ABOVE|'HIGH TONE APOSTROPHE|'LOW TONE APOSTROPHE|'SYMBOL OO DENNEN|.GBAKURUNEN|'COMMA|'EXCLAMATION MARK|'LAJANYALAN|'DANTAYALAN|(OROME SIGN|'TAMAN SIGN|#SAMARITAN LETTER ALAF|4BIT|4GAMAN|4DALAT|4IY|4BAA|4ZEN|4IT|4TIT|4YUT|4KAAF|4LABAT|4MIM|4NUN|4SINGAAT|4IN|4FI|4TSAADIY|4QUF|4RISH|4SHAN|4TAAF|-MARK IN|4-ALAF|2OCCLUSION|2DAGESH|.ODIFIER LETTER EPENTHETIC YUT|.ARK EPENTHETIC YUT|-VOWEL SIGN LONG E|8E|8OVERLONG AA|8LONG AA|8AA|8OVERLONG A|8LONG A|8A|-MODIFIER LETTER SHORT A|-VOWEL SIGN SHORT A|8LONG U|8U|-MODIFIER LETTER I|-VOWEL SIGN LONG I|8I|8O|8SUKUN|-MARK NEQUDAA|-PUNCTUATION NEQUDAA|9AFSAAQ|:NGED|9BAU|9ATMAAU|9SHIYYAALAA|-ABBREVIATION MARK|-PUNCTUATION MELODIC QITSA|9ZIQAA|9QITSA|9ZAEF|9TURU|9ARKAANU|9SOF MASHFAAT|9ANNAAU|#MANDAIC LETTER HALQA|2AB|3G|3D|3H|2USHENNA|2AZ|2IT|2ATT|3KSA|4|3L|3M|3N|3S|2IN|2AP|3SZ|3Q|3R|3SH|3T|2DUSHENNA|2KAD|2AIN|+AFFRICATION MARK|+VOCALIZATION MARK|+GEMINATION MARK|+PUNCTUATION|#SYRIAC LETTER MALAYALAM NGA|;JA|;NYA|;TTA|;NNA|=NA|;BHA|;RA|;LLA|=LA|;SSA|#ARABIC LETTER ALEF WITH ATTACHED FATHA|DTOP RIGHT FATHA|;RIGHT MIDDLE STROKE|;LEFT MIDDLE STROKE|;ATTACHED KASRA|DBOTTOM RIGHT KASRA|DROUND DOT ABOVE|EIGHT ROUND DOT|DLEFT ROUND DOT|DROUND DOT BELOW|;DOT ABOVE|;ATTACHED TOP RIGHT FATHA AND DOT ABOVE|;RIGHT MIDDLE STROKE AND DOT ABOVE|;ATTACHED BOTTOM RIGHT KASRA AND DOT ABOVE|DTOP RIGHT FATHA AND LEFT RING|;RIGHT MIDDLE STROKE AND LEFT RING|;ATTACHED BOTTOM RIGHT KASRA AND LEFT RING|DRIGHT HAMZA|DLEFT HAMZA|*TATWEEL WITH OVERSTRUCK HAMZA|BWAW|7TWO DOTS BELOW|*LETTER THIN YEH|*BASELINE ROUND DOT|*RAISED ROUND DOT|*LETTER NOON WITH INVERTED SMALL V|1HAH WITH INVERTED SMALL V BELOW|1TAH WITH DOT BELOW|:THREE DOTS BELOW|1KEHEH WITH TWO DOTS VERTICALLY BELOW|*VERTICAL TAIL|*LETTER NOON WITH RING ABOVE|*POUND MARK ABOVE|+IASTRE MARK ABOVE|+EPET|*SMALL HIGH WORD AL-JUZ|0LOW WORD ISHMAAM|:MAALA|9TASHEEL|*MADDA WAAJIB|*SUPERSCRIPT ALEF MOKHASSAS|*DOUBLED MADDA|*HALF MADDA OVER MADDA|*LETTER BEH WITH SMALL V BELOW|:HAMZA ABOVE|1JEEM WITH TWO DOTS ABOVE|1TAH WITH TWO DOTS ABOVE|1FEH WITH DOT BELOW AND THREE DOTS ABOVE|1QAF WITH DOT BELOW|1LAM WITH DOUBLE BAR|1MEEM WITH THREE DOTS ABOVE|1YEH WITH TWO DOTS BELOW AND HAMZA ABOVE|MDOT ABOVE|1REH WITH LOOP|1WAW WITH DOT WITHIN|1ROHINGYA YEH|1LOW ALEF|1DAL WITH THREE DOTS BELOW|1SAD WITH THREE DOTS BELOW|1GAF WITH INVERTED STROKE|1STRAIGHT WAW|1ZAIN WITH INVERTED V ABOVE|1AIN WITH THREE DOTS BELOW|1KAF WITH DOT BELOW|1QAF WITH DOT BELOW AND NO DOTS ABOVE|1BEH WITH SMALL MEEM ABOVE|1PEH WITH SMALL MEEM ABOVE|1TEH WITH SMALL TEH ABOVE|1REH WITH SMALL NOON ABOVE|1YEH WITH TWO DOTS BELOW AND SMALL NOON ABOVE|1AFRICAN FEH|9QAF|9NOON|1PEH WITH SMALL V|1TEH WITH SMALL V|2TEH WITH SMALL V|2CHEH WITH SMALL V|1KEHEH WITH SMALL V|1GHAIN WITH THREE DOTS ABOVE|1AFRICAN QAF WITH THREE DOTS ABOVE|1JEEM WITH THREE DOTS ABOVE|FBELOW|1LAM WITH SMALL ARABIC LETTER TAH ABOVE|1GRAF|*SMALL FARSI YEH|0HIGH FARSI YEH|5YEH BARREE WITH TWO DOTS BELOW|5WORD SAH|5ZAH|*LARGE ROUND DOT ABOVE|:BELOW|*SUKUN BELOW|*LARGE CIRCLE BELOW|0ROUND DOT INSIDE CIRCLE BELOW|*SMALL LOW WAW|0HIGH WORD AR-RUB|5SAD|5AIN|5QAF|5NOON WITH KASRA|0LOW NOON WITH KASRA|0HIGH WORD ATH-THALATHA|;S-SAJDA|;N-NISF|:SAKTA|:QIF|:WAQFA|5FOOTNOTE MARKER|5SIGN SAFHA|*DISPUTED END OF AYAH|*TURNED DAMMA BELOW|*CURLY FATHA|0DAMMA|0KASRA|0FATHATAN|0DAMMATAN|0KASRATAN|*TONE ONE DOT ABOVE|/TWO DOTS ABOVE|/LOOP ABOVE|/ONE DOT BELOW|/TWO DOTS BELOW|/LOOP BELOW|*OPEN FATHATAN|/DAMMATAN|/KASRATAN|*SMALL HIGH WAW|*FATHA WITH RING|5DOT ABOVE|*KASRA WITH DOT BELOW|*LEFT ARROWHEAD ABOVE|*RIGHT ARROWHEAD ABOVE|*LEFT ARROWHEAD BELOW|*RIGHT ARROWHEAD BELOW|*DOUBLE RIGHT ARROWHEAD ABOVE|F WITH DOT|*RIGHT ARROWHEAD ABOVE WITH DOT|*DAMMA WITH DOT|*MARK SIDEWAYS NOON GHUNNA|#DEVANAGARI SIGN INVERTED CANDRABINDU|3CANDRABINDU|3ANUSVARA|3VISARGA|.LETTER SHORT A|5A|6A|5I|6I|5U|6U|5VOCALIC R|=L|5CANDRA E|5SHORT E|5E|5AI|5CANDRA O|5SHORT O|5O|5AU|5KA|6HA|5GA|6HA|5NGA|5CA|6HA|5JA|6HA|5NYA|5TTA|7HA|5DDA|7HA|5NNA|5TA|6HA|5DA|6HA|5NA|6NNA|5PA|6HA|5BA|6HA|5MA|5YA|5RA|6RA|5LA|6LA|7LA|5VA|5SHA|6SA|6A|5HA|.VOWEL SIGN OE|:OE|.SIGN NUKTA|3AVAGRAHA|.VOWEL SIGN AA|9I|:I|9U|:U|9VOCALIC R|BR|9CANDRA E|9SHORT E|9E|9AI|9CANDRA O|9SHORT O|9O|9AU|.SIGN VIRAMA|.VOWEL SIGN PRISHTHAMATRA E|9AW|.OM|.STRESS SIGN UDATTA|:ANUDATTA|.GRAVE ACCENT|.ACUTE ACCENT|.VOWEL SIGN CANDRA LONG E|9UE|:UE|.LETTER QA|5KHHA|5GHHA|5ZA|5DDDHA|5RHA|5FA|5YYA|5VOCALIC RR|=LL|.VOWEL SIGN VOCALIC L|BL|.DANDA|/OUBLE DANDA|/IGIT ZERO|4ONE|4TWO|5HREE|4FOUR|5IVE|4SIX|5EVEN|4EIGHT|4NINE|.ABBREVIATION SIGN|.SIGN HIGH SPACING DOT|.LETTER CANDRA A|5OE|6OE|5AW|5UE|6UE|5MARWARI DDA|5ZHA|5HEAVY YA|5GGA|5JJA|5GLOTTAL STOP|5DDDA|5BBA|#BENGALI ANJI|+SIGN CANDRABINDU|0ANUSVARA|0VISARGA|+LETTER A|3A|2I|3I|2U|3U|2VOCALIC R|:L|2E|2AI|2O|2AU|2KA|3HA|2GA|3HA|2NGA|2CA|3HA|2JA|3HA|2NYA|2TTA|4HA|2DDA|4HA|2NNA|2TA|3HA|2DA|3HA|2NA|2PA|3HA|2BA|3HA|2MA|2YA|2RA|2LA|2SHA|3SA|3A|2HA|+SIGN NUKTA|0AVAGRAHA|+VOWEL SIGN AA|6I|7I|6U|7U|6VOCALIC R|?R|6E|6AI|6O|6AU|+SIGN VIRAMA|+LETTER KHANDA TA|+AU LENGTH MARK|+LETTER RRA|3HA|2YYA|2VOCALIC RR|:LL|+VOWEL SIGN VOCALIC L|?L|+DIGIT ZERO|1ONE|1TWO|2HREE|1FOUR|2IVE|1SIX|2EVEN|1EIGHT|1NINE|+LETTER RA WITH MIDDLE DIAGONAL|:LOWER DIAGONAL|+RUPEE MARK|1SIGN|+CURRENCY NUMERATOR ONE|>TWO|?HREE|>FOUR|>ONE LESS THAN THE DENOMINATOR|4DENOMINATOR SIXTEEN|+ISSHAR|+GANDA MARK|+LETTER VEDIC ANUSVARA|+ABBREVIATION SIGN|+SANDHI MARK|#GURMUKHI SIGN ADAK BINDI|1BINDI|1VISARGA|,LETTER A|4A|3I|4I|3U|4U|3EE|3AI|3OO|3AU|3KA|4HA|3GA|4HA|3NGA|3CA|4HA|3JA|4HA|3NYA|3TTA|5HA|3DDA|5HA|3NNA|3TA|4HA|3DA|4HA|3NA|3PA|4HA|3BA|4HA|3MA|3YA|3RA|3LA|4LA|3VA|3SHA|4A|3HA|,SIGN NUKTA|,VOWEL SIGN AA|7I|8I|7U|8U|7EE|7AI|7OO|7AU|,SIGN VIRAMA|1UDAAT|,LETTER KHHA|3GHHA|3ZA|3RRA|3FA|,DIGIT ZERO|2ONE|2TWO|3HREE|2FOUR|3IVE|2SIX|3EVEN|2EIGHT|2NINE|,TIPPI|,ADDAK|,IRI|,URA|,EK ONKAR|,SIGN YAKASH|,ABBREVIATION SIGN|%JARATI SIGN CANDRABINDU|1ANUSVARA|1VISARGA|,LETTER A|4A|3I|4I|3U|4U|3VOCALIC R|;L|,VOWEL CANDRA E|,LETTER E|3AI|,VOWEL CANDRA O|,LETTER O|3AU|3KA|4HA|3GA|4HA|3NGA|3CA|4HA|3JA|4HA|3NYA|3TTA|5HA|3DDA|5HA|3NNA|3TA|4HA|3DA|4HA|3NA|3PA|4HA|3BA|4HA|3MA|3YA|3RA|3LA|4LA|3VA|3SHA|4SA|4A|3HA|,SIGN NUKTA|1AVAGRAHA|,VOWEL SIGN AA|7I|8I|7U|8U|7VOCALIC R|@R|7CANDRA E|7E|7AI|7CANDRA O|7O|7AU|,SIGN VIRAMA|,OM|,LETTER VOCALIC RR|;LL|,VOWEL SIGN VOCALIC L|@L|,DIGIT ZERO|2ONE|2TWO|3HREE|2FOUR|3IVE|2SIX|3EVEN|2EIGHT|2NINE|,ABBREVIATION SIGN|,RUPEE SIGN|,LETTER ZHA|,SIGN SUKUN|2HADDA|1MADDAH|1THREE-DOT NUKTA ABOVE|1CIRCLE NUKTA ABOVE|1TWO-CIRCLE NUKTA ABOVE|#ORIYA SIGN CANDRABINDU|.ANUSVARA|.VISARGA|)LETTER A|1A|0I|1I|0U|1U|0VOCALIC R|8L|0E|0AI|0O|0AU|0KA|1HA|0GA|1HA|0NGA|0CA|1HA|0JA|1HA|0NYA|0TTA|2HA|0DDA|2HA|0NNA|0TA|1HA|0DA|1HA|0NA|0PA|1HA|0BA|1HA|0MA|0YA|0RA|0LA|1LA|0VA|0SHA|1SA|1A|0HA|)SIGN NUKTA|.AVAGRAHA|)VOWEL SIGN AA|4I|5I|4U|5U|4VOCALIC R|=R|4E|4AI|4O|4AU|)SIGN VIRAMA|.DOT ABOVE|0UBLE DOT ABOVE|.OVERLINE|)AI LENGTH MARK|*U LENGTH MARK|)LETTER RRA|1HA|0YYA|0VOCALIC RR|8LL|)VOWEL SIGN VOCALIC L|=L|)DIGIT ZERO|/ONE|/TWO|0HREE|/FOUR|0IVE|/SIX|0EVEN|/EIGHT|/NINE|)ISSHAR|)LETTER WA|)FRACTION ONE QUARTER|6HALF|2THREE QUARTERS|2ONE SIXTEENTH|6EIGHTH|2THREE SIXTEENTHS|#TAMIL SIGN ANUSVARA|.VISARGA|)LETTER A|1A|0I|1I|0U|1U|0E|1E|0AI|0O|1O|0AU|0KA|0NGA|0CA|0JA|0NYA|0TTA|0NNA|0TA|0NA|1NNA|0PA|0MA|0YA|0RA|1RA|0LA|1LA|2LA|0VA|0SHA|1SA|1A|0HA|)VOWEL SIGN AA|4I|5I|4U|5U|4E|5E|4AI|4O|5O|4AU|)SIGN VIRAMA|)OM|)AU LENGTH MARK|)DIGIT ZERO|/ONE|/TWO|0HREE|/FOUR|0IVE|/SIX|0EVEN|/EIGHT|/NINE|)NUMBER TEN|0ONE HUNDRED|4THOUSAND|)DAY SIGN|)MONTH SIGN|)YEAR SIGN|)DEBIT SIGN|)CREDIT SIGN|)AS ABOVE SIGN|)RUPEE SIGN|)NUMBER SIGN|$ELUGU SIGN COMBINING CANDRABINDU ABOVE|0ANDRABINDU|/ANUSVARA|/VISARGA|/COMBINING ANUSVARA ABOVE|*LETTER A|2A|1I|2I|1U|2U|1VOCALIC R|9L|1E|2E|1AI|1O|2O|1AU|1KA|2HA|1GA|2HA|1NGA|1CA|2HA|1JA|2HA|1NYA|1TTA|3HA|1DDA|3HA|1NNA|1TA|2HA|1DA|2HA|1NA|1PA|2HA|1BA|2HA|1MA|1YA|1RA|2RA|1LA|2LA|3LA|1VA|1SHA|2SA|2A|1HA|*SIGN NUKTA|/AVAGRAHA|*VOWEL SIGN AA|5I|6I|5U|6U|5VOCALIC R|>R|5E|6E|5AI|5O|6O|5AU|*SIGN VIRAMA|*LENGTH MARK|*AI LENGTH MARK|*LETTER TSA|1DZA|1RRRA|*ARCHAIC SHRII|*LETTER NAKAARA POLLU|1VOCALIC RR|9LL|*VOWEL SIGN VOCALIC L|>L|*DIGIT ZERO|0ONE|0TWO|1HREE|0FOUR|1IVE|0SIX|1EVEN|0EIGHT|0NINE|*SIGN SIDDHAM|*FRACTION DIGIT ZERO FOR ODD POWERS OF FOUR|9ONE FOR ODD POWERS OF FOUR|9TWO FOR ODD POWERS OF FOUR|:HREE FOR ODD POWERS OF FOUR|9ONE FOR EVEN POWERS OF FOUR|9TWO FOR EVEN POWERS OF FOUR|:HREE FOR EVEN POWERS OF FOUR|*SIGN TUUMU|#KANNADA SIGN SPACING CANDRABINDU|0CANDRABINDU|0ANUSVARA|0VISARGA|0SIDDHAM|+LETTER A|3A|2I|3I|2U|3U|2VOCALIC R|:L|2E|3E|2AI|2O|3O|2AU|2KA|3HA|2GA|3HA|2NGA|2CA|3HA|2JA|3HA|2NYA|2TTA|4HA|2DDA|4HA|2NNA|2TA|3HA|2DA|3HA|2NA|2PA|3HA|2BA|3HA|2MA|2YA|2RA|3RA|2LA|3LA|2VA|2SHA|3SA|3A|2HA|+SIGN NUKTA|0AVAGRAHA|+VOWEL SIGN AA|6I|7I|6U|7U|6VOCALIC R|?R|6E|7E|6AI|6O|7O|6AU|+SIGN VIRAMA|+LENGTH MARK|+AI LENGTH MARK|,RCHAIC SHRII|+LETTER NAKAARA POLLU|2FA|2VOCALIC RR|:LL|+VOWEL SIGN VOCALIC L|?L|+DIGIT ZERO|1ONE|1TWO|2HREE|1FOUR|2IVE|1SIX|2EVEN|1EIGHT|1NINE|+SIGN JIHVAMULIYA|0UPADHMANIYA|0COMBINING ANUSVARA ABOVE RIGHT|#MALAYALAM SIGN COMBINING ANUSVARA ABOVE|3ANDRABINDU|2ANUSVARA|2VISARGA|-LETTER VEDIC ANUSVARA|4A|5A|4I|5I|4U|5U|4VOCALIC R|<L|4E|5E|4AI|4O|5O|4AU|4KA|5HA|4GA|5HA|4NGA|4CA|5HA|4JA|5HA|4NYA|4TTA|6HA|4DDA|6HA|4NNA|4TA|5HA|4DA|5HA|4NA|5NNA|4PA|5HA|4BA|5HA|4MA|4YA|4RA|5RA|4LA|5LA|6LA|4VA|4SHA|5SA|5A|4HA|4TTTA|-SIGN VERTICAL BAR VIRAMA|2CIRCULAR VIRAMA|2AVAGRAHA|-VOWEL SIGN AA|8I|9I|8U|9U|8VOCALIC R|AR|8E|9E|8AI|8O|9O|8AU|-SIGN VIRAMA|-LETTER DOT REPH|-SIGN PARA|-LETTER CHILLU M|;Y|;LLL|-AU LENGTH MARK|-FRACTION ONE ONE-HUNDRED-AND-SIXTIETH|:FORTIETH|6THREE EIGHTIETHS|6ONE TWENTIETH|;ENTH|6THREE TWENTIETHS|6ONE FIFTH|-LETTER ARCHAIC II|4VOCALIC RR|<LL|-VOWEL SIGN VOCALIC L|AL|-DIGIT ZERO|3ONE|3TWO|4HREE|3FOUR|4IVE|3SIX|4EVEN|3EIGHT|3NINE|-NUMBER TEN|4ONE HUNDRED|8THOUSAND|-FRACTION ONE QUARTER|:HALF|6THREE QUARTERS|6ONE SIXTEENTH|:EIGHTH|6THREE SIXTEENTHS|-DATE MARK|-LETTER CHILLU NN|<|;RR|;L|<L|;K|#SINHALA SIGN CANDRABINDU|0ANUSVARAYA|0VISARGAYA|+LETTER AYANNA|3AYANNA|3EYANNA|4EYANNA|2IYANNA|3IYANNA|2UYANNA|3UYANNA|2IRUYANNA|5UYANNA|3LUYANNA|5UYANNA|2EYANNA|3EYANNA|2AIYANNA|2OYANNA|3OYANNA|2AUYANNA|3LPAPRAANA KAYANNA|2MAHAAPRAANA KAYANNA|2ALPAPRAANA GAYANNA|2MAHAAPRAANA GAYANNA|2KANTAJA NAASIKYAYA|2SANYAKA GAYANNA|2ALPAPRAANA CAYANNA|2MAHAAPRAANA CAYANNA|2ALPAPRAANA JAYANNA|2MAHAAPRAANA JAYANNA|2TAALUJA NAASIKYAYA|:SANYOOGA NAAKSIKYAYA|2SANYAKA JAYANNA|2ALPAPRAANA TTAYANNA|2MAHAAPRAANA TTAYANNA|2ALPAPRAANA DDAYANNA|2MAHAAPRAANA DDAYANNA|3UURDHAJA NAYANNA|2SANYAKA DDAYANNA|2ALPAPRAANA TAYANNA|2MAHAAPRAANA TAYANNA|2ALPAPRAANA DAYANNA|2MAHAAPRAANA DAYANNA|2DANTAJA NAYANNA|2SANYAKA DAYANNA|2ALPAPRAANA PAYANNA|2MAHAAPRAANA PAYANNA|2ALPAPRAANA BAYANNA|2MAHAAPRAANA BAYANNA|4YANNA|2AMBA BAYANNA|2YAYANNA|2RAYANNA|2DANTAJA LAYANNA|2VAYANNA|2TAALUJA SAYANNA|2MUURDHAJA SAYANNA|2DANTAJA SAYANNA|2HAYANNA|2MUURDHAJA LAYANNA|2FAYANNA|+SIGN AL-LAKUNA|+VOWEL SIGN AELA-PILLA|6KETTI AEDA-PILLA|6DIGA AEDA-PILLA|6KETTI IS-PILLA|6DIGA IS-PILLA|6KETTI PAA-PILLA|6DIGA PAA-PILLA|6GAETTA-PILLA|6KOMBUVA|6DIGA KOMBUVA|6KOMBU DEKA|;VA HAA AELA-PILLA|BDIGA AELA-PILLA|BGAYANUKITTA|6GAYANUKITTA|+LITH DIGIT ZERO|6ONE|6TWO|7HREE|6FOUR|7IVE|6SIX|7EVEN|6EIGHT|6NINE|+VOWEL SIGN DIGA GAETTA-PILLA|=YANUKITTA|+PUNCTUATION KUNDDALIYA|#THAI CHARACTER KO KAI|3HO KHAI|8UAT|8WAI|8ON|6RAKHANG|2NGO NGU|2CHO CHAN|8ING|8ANG|2SO SO|2CHO CHOE|2YO YING|2DO CHADA|2TO PATAK|3HO THAN|6NANGMONTHO|6PHUTHAO|2NO NEN|2DO DEK|2TO TAO|3HO THUNG|8AHAN|8ONG|2NO NU|2BO BAIMAI|2PO PLA|3HO PHUNG|2FO FA|2PHO PHAN|2FO FAN|2PHO SAMPHAO|2MO MA|2YO YAK|2RO RUA|3U|2LO LING|3U|2WO WAEN|2SO SALA|5RUSI|5SUA|2HO HIP|2LO CHULA|2O ANG|2HO NOKHUK|2PAIYANNOI|2SARA A|2MAI HAN-AKAT|2SARA AA|8M|7I|8I|7UE|9E|8|8U|2PHINTHU|)URRENCY SYMBOL BAHT|)HARACTER SARA E|7AE|7O|7AI MAIMUAN|>ALAI|2LAKKHANGYAO|2MAIYAMOK|5TAIKHU|5 EK|6THO|7RI|6CHATTAWA|2THANTHAKHAT|2NIKHAHIT|2YAMAKKAN|2FONGMAN|(DIGIT ZERO|.ONE|.TWO|/HREE|.FOUR|/IVE|.SIX|/EVEN|.EIGHT|.NINE|(CHARACTER ANGKHANKHU|2KHOMUT|#LAO LETTER KO|/HO SUNG|2TAM|.PALI GHA|.NGO|.CO|.PALI CHA|.SO TAM|.PALI JHA|.NYO|.PALI NYA|3TTA|5HA|3DDA|5HA|3NNA|.DO|.TO|/HO SUNG|2TAM|.PALI DHA|.NO|.BO|.PO|/HO SUNG|.FO TAM|.PHO TAM|.FO SUNG|.PALI BHA|.MO|.YO|.LO LING|2OOT|.WO|.SANSKRIT SHA|8SA|/O SUNG|.HO SUNG|.PALI LLA|.O|.HO TAM|'ELLIPSIS|'VOWEL SIGN A|2MAI KAN|2AA|3M|2I|3I|2Y|3Y|2U|3U|'SIGN PALI VIRAMA|'VOWEL SIGN MAI KON|'SEMIVOWEL SIGN LO|6NYO|'VOWEL SIGN E|3I|2O|2AY|3I|'KO LA|'TONE MAI EK|0THO|1I|0CATAWA|'CANCELLATION MARK|'NIGGAHITA|'YAMAKKAN|'DIGIT ZERO|-ONE|-TWO|.HREE|-FOUR|.IVE|-SIX|.EVEN|-EIGHT|-NINE|'HO NO|*MO|'LETTER KHMU GO|3NYO|#TIBETAN SYLLABLE OM|+MARK GTER YIG MGO TRUNCATED A|=-UM RNAM BCAD MA|AGTER TSHEG MA|0INITIAL YIG MGO MDUN MA|0CLOSING YIG MGO SGAB MA|1ARET YIG MGO PHUR SHAD MA|0YIG MGO TSHEG SHAD MA|0SBRUL SHAD|0BSKUR YIG MGO|1KA- SHOG YIG MGO|0INTERSYLLABIC TSHEG|0DELIMITER TSHEG BSTAR|0SHAD|0NYIS SHAD|0TSHEG SHAD|0NYIS TSHEG SHAD|0RIN CHEN SPUNGS SHAD|1GYA GRAM SHAD|0CARET -DZUD RTAGS ME LONG CAN|0GTER TSHEG|+LOGOTYPE SIGN CHAD RTAGS|9LHAG RTAGS|+ASTROLOGICAL SIGN SGRA GCAN -CHAR RTAGS|=-KHYUD PA|=SDONG TSHUGS|+SIGN RDEL DKAR GCIG|;NYIS|;SUM|5NAG GCIG|:NYIS|5DKAR RDEL NAG|+DIGIT ZERO|1ONE|1TWO|2HREE|1FOUR|2IVE|1SIX|2EVEN|1EIGHT|1NINE|1HALF ONE|6TWO|7HREE|6FOUR|7IVE|6SIX|7EVEN|6EIGHT|6NINE|6ZERO|+MARK BSDUS RTAGS|0NGAS BZUNG NYI ZLA|0CARET -DZUD RTAGS BZHI MIG CAN|0NGAS BZUNG SGOR RTAGS|0CHE MGO|0TSA -PHRU|0GUG RTAGS GYON|<AS|0ANG KHANG GYON|<AS|+SIGN YAR TSHES|0MAR TSHES|+LETTER KA|3HA|2GA|3HA|2NGA|2CA|3HA|2JA|2NYA|2TTA|4HA|2DDA|4HA|2NNA|2TA|3HA|2DA|3HA|2NA|2PA|3HA|2BA|3HA|2MA|2TSA|4HA|2DZA|4HA|2WA|2ZHA|3A|2-A|2YA|2RA|2LA|2SHA|3SA|3A|2HA|2A|2KSSA|2FIXED-FORM RA|2KKA|2RRA|+VOWEL SIGN AA|6I|7I|6U|7U|6VOCALIC R|?R|>L|?L|6E|7E|6O|7O|+SIGN RJES SU NGA RO|1NAM BCAD|+VOWEL SIGN REVERSED I|@I|+SIGN NYI ZLA NAA DA|0SNA LDAN|+MARK HALANTA|0PALUTA|+SIGN LCI RTAGS|0YANG RTAGS|0LCE TSA CAN|0MCHU CAN|0GRU CAN RGYINGS|4MED RGYINGS|0INVERTED MCHU CAN|,UBJOINED SIGN LCE TSA CAN|:MCHU CAN|:INVERTED MCHU CAN|5LETTER KA|=HA|<GA|=HA|<NGA|<CA|=HA|<JA|<NYA|<TTA|>HA|<DDA|>HA|<NNA|<TA|=HA|<DA|=HA|<NA|<PA|=HA|<BA|=HA|<MA|<TSA|>HA|<DZA|>HA|<WA|<ZHA|=A|<-A|<YA|<RA|<LA|<SHA|=SA|=A|<HA|<A|<KSSA|<FIXED-FORM WA|GYA|GRA|+KU RU KHA|4 BZHI MIG CAN|+CANTILLATION SIGN HEAVY BEAT|=LIGHT BEAT|=CANG TE-U|=SBUB -CHAL|+SYMBOL DRIL BU|2RDO RJE|2PADMA GDAN|2RDO RJE RGYA GRAM|2PHUR PA|2NOR BU|8 NYIS -KHYIL|9GSUM -KHYIL|9BZHI -KHYIL|,IGN RDEL NAG RDEL DKAR|9GSUM|+MARK BSKA- SHOG GI MGO RGYAN|0MNYAM YIG GI MGO RGYAN|0NYIS TSHEG|0INITIAL BRDA RNYING YIG MGO MDUN MA|0CLOSING BRDA RNYING YIG MGO SGAB MA|#RIGHT-FACING SVASTI SIGN|#LEFT-FACING SVASTI SIGN|#RIGHT-FACING SVASTI SIGN WITH DOTS|#LEFT-FACING SVASTI SIGN WITH DOTS|#TIBETAN MARK LEADING MCHAN RTAGS|0TRAILING MCHAN RTAGS|#MYANMAR LETTER KA|3HA|2GA|3HA|2NGA|2CA|3HA|2JA|3HA|2NYA|3NYA|2TTA|4HA|2DDA|4HA|2NNA|2TA|3HA|2DA|3HA|2NA|2PA|3HA|2BA|3HA|2MA|2YA|2RA|2LA|2WA|2SA|2HA|2LLA|2A|2SHAN A|2I|3I|2U|3U|2E|2MON E|2O|2AU|+VOWEL SIGN TALL AA|6AA|6I|7I|6U|7U|6E|6AI|6MON II|:O|6E ABOVE|+SIGN ANUSVARA|0DOT BELOW|0VISARGA|2RAMA|0ASAT|+CONSONANT SIGN MEDIAL YA|ARA|AWA|AHA|+LETTER GREAT SA|+DIGIT ZERO|1ONE|1TWO|2HREE|1FOUR|2IVE|1SIX|2EVEN|1EIGHT|1NINE|+SIGN LITTLE SECTION|0SECTION|,YMBOL LOCATIVE|2COMPLETED|2AFOREMENTIONED|2GENITIVE|+LETTER SHA|3SA|2VOCALIC R|;R|:L|;L|+VOWEL SIGN VOCALIC R|?R|>L|?L|+LETTER MON NGA|6JHA|6BBA|8E|+CONSONANT SIGN MON MEDIAL NA|EMA|ELA|+LETTER SGAW KAREN SHA|+VOWEL SIGN SGAW KAREN EU|+TONE MARK SGAW KAREN HATHI|@KE PHO|+LETTER WESTERN PWO KAREN THA|DPWA|+VOWEL SIGN WESTERN PWO KAREN EU|HUE|+SIGN WESTERN PWO KAREN TONE-1|G2|G3|G4|G5|+LETTER EASTERN PWO KAREN NNA|DYWA|DGHWA|+VOWEL SIGN GEBA KAREN I|6KAYAH OE|<U|<EE|+LETTER SHAN KA|8HA|7GA|7CA|7ZA|7NYA|7DA|7NA|7PHA|7FA|7BA|7THA|7HA|+CONSONANT SIGN SHAN MEDIAL WA|+VOWEL SIGN SHAN AA|;E|< ABOVE|;FINAL Y|+SIGN SHAN TONE-2|:3|:5|:6|5COUNCIL TONE-2|B3|=EMPHATIC TONE|+LETTER RUMAI PALAUNG FA|+SIGN RUMAI PALAUNG TONE-5|,HAN DIGIT ZERO|6ONE|6TWO|7HREE|6FOUR|7IVE|6SIX|7EVEN|6EIGHT|6NINE|,IGN KHAMTI TONE-1|<3|+VOWEL SIGN AITON A|=I|+SYMBOL SHAN ONE|7EXCLAMATION|#GEORGIAN CAPITAL LETTER AN|;BAN|;GAN|;DON|;EN|;VIN|;ZEN|;TAN|;IN|;KAN|;LAS|;MAN|;NAR|;ON|;PAR|;ZHAR|;RAE|;SAN|;TAR|;UN|;PHAR|;KHAR|;GHAN|;QAR|;SHIN|;CHIN|<AN|;JIL|;CIL|<HAR|;XAN|;JHAN|;HAE|<E|<IE|;WE|;HAR|<OE|;YN|;AEN|,LETTER AN|3BAN|3GAN|3DON|3EN|3VIN|3ZEN|3TAN|3IN|3KAN|3LAS|3MAN|3NAR|3ON|3PAR|3ZHAR|3RAE|3SAN|3TAR|3UN|3PHAR|3KHAR|3GHAN|3QAR|3SHIN|3CHIN|4AN|3JIL|3CIL|4HAR|3XAN|3JHAN|3HAE|4E|4IE|3WE|3HAR|4OE|3FI|3YN|3ELIFI|3TURNED GAN|3AIN|,PARAGRAPH SEPARATOR|#MODIFIER LETTER GEORGIAN NAR|#GEORGIAN LETTER AEN|3HARD SIGN|3LABIAL SIGN|#HANGUL CHOSEONG KIYEOK|3SSANGKIYEOK|3NIEUN|3TIKEUT|3SSANGTIKEUT|3RIEUL|3MIEUM|3PIEUP|3SSANGPIEUP|4IOS|4SANGSIOS|3IEUNG|3CIEUC|3SSANGCIEUC|3CHIEUCH|3KHIEUKH|3THIEUTH|3PHIEUPH|3HIEUH|3NIEUN-KIYEOK|3SSANGNIEUN|3NIEUN-TIKEUT|9PIEUP|3TIKEUT-KIYEOK|3RIEUL-NIEUN|3SSANGRIEUL|3RIEUL-HIEUH|3KAPYEOUNRIEUL|3MIEUM-PIEUP|3KAPYEOUNMIEUM|3PIEUP-KIYEOK|9NIEUN|9TIKEUT|9SIOS|=-KIYEOK|>TIKEUT|>PIEUP|:SANGSIOS|:IOS-CIEUC|9CIEUC|:HIEUCH|9THIEUTH|9PHIEUPH|3KAPYEOUNPIEUP|;SSANGPIEUP|3SIOS-KIYEOK|8NIEUN|8TIKEUT|8RIEUL|8MIEUM|8PIEUP|=-KIYEOK|8SSANGSIOS|8IEUNG|8CIEUC|9HIEUCH|8KHIEUKH|8THIEUTH|8PHIEUPH|8HIEUH|3CHITUEUMSIOS|<SANGSIOS|4EONGCHIEUMSIOS|?SANGSIOS|3PANSIOS|3IEUNG-KIYEOK|9TIKEUT|9MIEUM|9PIEUP|9SIOS|9PANSIOS|3SSANGIEUNG|3IEUNG-CIEUC|:HIEUCH|9THIEUTH|9PHIEUPH|3YESIEUNG|3CIEUC-IEUNG|4HITUEUMCIEUC|;SSANGCIEUC|4EONGCHIEUMCIEUC|>SSANGCIEUC|4HIEUCH-KHIEUKH|;HIEUH|6TUEUMCHIEUCH|4EONGCHIEUMCHIEUCH|3PHIEUPH-PIEUP|3KAPYEOUNPHIEUPH|3SSANGHIEUH|3YEORINHIEUH|3KIYEOK-TIKEUT|3NIEUN-SIOS|9CIEUC|9HIEUH|3TIKEUT-RIEUL|3FILLER|*JUNGSEONG FILLER|4A|5E|4YA|6E|4EO|5|4YEO|6|4O|4WA|6E|4OE|4YO|4U|4WEO|6|5I|4YU|4EU|4YI|4I|4A-O|6U|4YA-O|7YO|4EO-O|7U|7EU|4YEO-O|8U|4O-EO|7|6YE|6O|6U|4YO-YA|9E|8EO|7O|7I|4U-A|7E|6EO-EU|6YE|6U|4YU-A|7EO|8|7YEO|9|7U|7I|4EU-U|7EU|4YI-U|4I-A|6YA|6O|6U|6EU|6ARAEA|4ARAEA|9-EO|:U|:I|4SSANGARAEA|4A-EU|4YA-U|5EO-YA|4O-YA|8E|+ONGSEONG KIYEOK|4SSANGKIYEOK|4KIYEOK-SIOS|4NIEUN|9-CIEUC|:HIEUH|4TIKEUT|4RIEUL|9-KIYEOK|:MIEUM|:PIEUP|:SIOS|:THIEUTH|:PHIEUPH|:HIEUH|4MIEUM|4PIEUP|9-SIOS|4SIOS|5SANGSIOS|4IEUNG|4CIEUC|5HIEUCH|4KHIEUKH|4THIEUTH|4PHIEUPH|4HIEUH|4KIYEOK-RIEUL|;SIOS-KIYEOK|4NIEUN-KIYEOK|:TIKEUT|:SIOS|:PANSIOS|:THIEUTH|4TIKEUT-KIYEOK|;RIEUL|4RIEUL-KIYEOK-SIOS|:NIEUN|:TIKEUT|@-HIEUH|4SSANGRIEUL|4RIEUL-MIEUM-KIYEOK|@SIOS|:PIEUP-SIOS|@HIEUH|:KAPYEOUNPIEUP|:SSANGSIOS|:PANSIOS|:KHIEUKH|:YEORINHIEUH|4MIEUM-KIYEOK|:RIEUL|:PIEUP|:SIOS|;SANGSIOS|:PANSIOS|:CHIEUCH|:HIEUH|4KAPYEOUNMIEUM|4PIEUP-RIEUL|:PHIEUPH|:HIEUH|4KAPYEOUNPIEUP|4SIOS-KIYEOK|9TIKEUT|9RIEUL|9PIEUP|4PANSIOS|4IEUNG-KIYEOK|:SSANGKIYEOK|4SSANGIEUNG|4IEUNG-KHIEUKH|4YESIEUNG|<-SIOS|=PANSIOS|4PHIEUPH-PIEUP|4KAPYEOUNPHIEUPH|4HIEUH-NIEUN|:RIEUL|:MIEUM|:PIEUP|4YEORINHIEUH|4KIYEOK-NIEUN|;PIEUP|;CHIEUCH|;KHIEUKH|;HIEUH|4SSANGNIEUN|#ETHIOPIC SYLLABLE HA|6U|6I|6AA|6EE|7|6O|7A|5LA|6U|6I|6AA|6EE|7|6O|6WA|5HHA|7U|7I|7AA|7EE|8|7O|7WA|5MA|6U|6I|6AA|6EE|7|6O|6WA|5SZA|7U|7I|7AA|7EE|8|7O|7WA|5RA|6U|6I|6AA|6EE|7|6O|6WA|5SA|6U|6I|6AA|6EE|7|6O|6WA|6HA|7U|7I|7AA|7EE|8|7O|7WA|5QA|6U|6I|6AA|6EE|7|6O|7A|6WA|7I|7AA|7EE|8|6HA|7U|7I|7AA|7EE|8|7O|7WA|8I|8AA|8EE|9|5BA|6U|6I|6AA|6EE|7|6O|6WA|5VA|6U|6I|6AA|6EE|7|6O|6WA|5TA|6U|6I|6AA|6EE|7|6O|6WA|5CA|6U|6I|6AA|6EE|7|6O|6WA|5XA|6U|6I|6AA|6EE|7|6O|7A|6WA|7I|7AA|7EE|8|5NA|6U|6I|6AA|6EE|7|6O|6WA|6YA|7U|7I|7AA|7EE|8|7O|7WA|5GLOTTAL A|=U|=I|=AA|=EE|>|=O|=WA|5KA|6U|6I|6AA|6EE|7|6O|7A|6WA|7I|7AA|7EE|8|6XA|7U|7I|7AA|7EE|8|7O|7WA|8I|8AA|8EE|9|5WA|6U|6I|6AA|6EE|7|6O|7A|5PHARYNGEAL A|@U|@I|@AA|@EE|A|@O|5ZA|6U|6I|6AA|6EE|7|6O|6WA|6HA|7U|7I|7AA|7EE|8|7O|7WA|5YA|6U|6I|6AA|6EE|7|6O|7A|5DA|6U|6I|6AA|6EE|7|6O|6WA|6DA|7U|7I|7AA|7EE|8|7O|7WA|5JA|6U|6I|6AA|6EE|7|6O|6WA|5GA|6U|6I|6AA|6EE|7|6O|7A|6WA|7I|7AA|7EE|8|6GA|7U|7I|7AA|7EE|8|7O|7WAA|5THA|7U|7I|7AA|7EE|8|7O|7WA|5CHA|7U|7I|7AA|7EE|8|7O|7WA|5PHA|7U|7I|7AA|7EE|8|7O|7WA|5TSA|7U|7I|7AA|7EE|8|7O|7WA|6ZA|7U|7I|7AA|7EE|8|7O|8A|5FA|6U|6I|6AA|6EE|7|6O|6WA|5PA|6U|6I|6AA|6EE|7|6O|6WA|5RYA|5MYA|5FYA|,COMBINING GEMINATION AND VOWEL LENGTH MARK|6VOWEL LENGTH MARK|6GEMINATION MARK|,SECTION MARK|,WORDSPACE|,FULL STOP|,COMMA|,SEMICOLON|,COLON|,PREFACE COLON|,QUESTION MARK|,PARAGRAPH SEPARATOR|,DIGIT ONE|2TWO|3HREE|2FOUR|3IVE|2SIX|3EVEN|2EIGHT|2NINE|,NUMBER TEN|4WENTY|4HIRTY|3FORTY|4IFTY|3SIXTY|4EVENTY|3EIGHTY|3NINETY|3HUNDRED|3TEN THOUSAND|,SYLLABLE SEBATBEIT MWA|5MWI|7EE|8|5SEBATBEIT BWA|5BWI|7EE|8|5SEBATBEIT FWA|5FWI|7EE|8|5SEBATBEIT PWA|5PWI|7EE|8|,TONAL MARK YIZET|7DERET|7RIKRIK|7SHORT RIKRIK|7DIFAT|7KENAT|7CHIRET|7HIDET|7DERET-HIDET|7KURT|#CHEROKEE LETTER A|3E|3I|3O|3U|3V|3GA|3KA|3GE|4I|4O|4U|4V|3HA|4E|4I|4O|4U|4V|3LA|4E|4I|4O|4U|4V|3MA|4E|4I|4O|4U|3NA|3HNA|3NAH|4E|4I|4O|4U|4V|3QUA|5E|5I|5O|5U|5V|3SA|4|4E|4I|4O|4U|4V|3DA|3TA|3DE|3TE|3DI|3TI|3DO|4U|4V|4LA|3TLA|5E|5I|5O|5U|5V|4SA|5E|5I|5O|5U|5V|3WA|4E|4I|4O|4U|4V|3YA|4E|4I|4O|4U|4V|3MV|,SMALL LETTER YE|:I|:O|:U|:V|9MV|$ANADIAN SYLLABICS HYPHEN|6E|6AAI|6I|7I|6O|7O|6Y-CREE OO|6CARRIER EE|>I|6A|7A|6WE|8ST-CREE WE|7I|7EST-CREE WI|7II|7EST-CREE WII|7O|7EST-CREE WO|7OO|7EST-CREE WOO|6NASKAPI WOO|6WA|7EST-CREE WA|7AA|7EST-CREE WAA|6NASKAPI WAA|6AI|6Y-CREE W|6GLOTTAL STOP|6FINAL ACUTE|<GRAVE|<BOTTOM HALF RING|<TOP HALF RING|<RIGHT HALF RING|>NG|<DOUBLE ACUTE|CSHORT VERTICAL STROKES|<MIDDLE DOT|<SHORT HORIZONTAL STROKE|<PLUS|<DOWN TACK|6EN|6IN|6ON|6AN|6PE|7AAI|7I|8I|7O|8O|6Y-CREE POO|6CARRIER HEE|?I|6PA|8A|7WE|6WEST-CREE PWE|6PWI|6WEST-CREE PWI|6PWII|6WEST-CREE PWII|6PWO|6WEST-CREE PWO|6PWOO|6WEST-CREE PWOO|6PWA|6WEST-CREE PWA|6PWAA|6WEST-CREE PWAA|6Y-CREE PWAA|6P|6WEST-CREE P|6CARRIER H|6TE|7AAI|7I|8I|7O|8O|6Y-CREE TOO|6CARRIER DEE|?I|6TA|8A|7WE|6WEST-CREE TWE|6TWI|6WEST-CREE TWI|6TWII|6WEST-CREE TWII|6TWO|6WEST-CREE TWO|6TWOO|6WEST-CREE TWOO|6TWA|6WEST-CREE TWA|6TWAA|6WEST-CREE TWAA|6NASKAPI TWAA|6T|7TE|8I|8O|8A|6KE|7AAI|7I|8I|7O|8O|6Y-CREE KOO|6KA|8A|7WE|6WEST-CREE KWE|6KWI|6WEST-CREE KWI|6KWII|6WEST-CREE KWII|6KWO|6WEST-CREE KWO|6KWOO|6WEST-CREE KWOO|6KWA|6WEST-CREE KWA|6KWAA|6WEST-CREE KWAA|6NASKAPI KWAA|6K|7W|6SOUTH-SLAVEY KEH|DIH|DOH|DAH|6CE|7AAI|7I|8I|7O|8O|6Y-CREE COO|6CA|8A|7WE|6WEST-CREE CWE|6CWI|6WEST-CREE CWI|6CWII|6WEST-CREE CWII|6CWO|6WEST-CREE CWO|6CWOO|6WEST-CREE CWOO|6CWA|6WEST-CREE CWA|6CWAA|6WEST-CREE CWAA|6NASKAPI CWAA|6C|6SAYISI TH|6ME|7AAI|7I|8I|7O|8O|6Y-CREE MOO|6MA|8A|7WE|6WEST-CREE MWE|6MWI|6WEST-CREE MWI|6MWII|6WEST-CREE MWII|6MWO|6WEST-CREE MWO|6MWOO|6WEST-CREE MWOO|6MWA|6WEST-CREE MWA|6MWAA|6WEST-CREE MWAA|6NASKAPI MWAA|6M|6WEST-CREE M|6MH|6ATHAPASCAN M|6SAYISI M|6NE|7AAI|7I|8I|7O|8O|6Y-CREE NOO|6NA|8A|7WE|6WEST-CREE NWE|6NWA|6WEST-CREE NWA|6NWAA|6WEST-CREE NWAA|6NASKAPI NWAA|7|6CARRIER NG|6NH|6LE|7AAI|7I|8I|7O|8O|6Y-CREE LOO|6LA|8A|7WE|6WEST-CREE LWE|6LWI|6WEST-CREE LWI|6LWII|6WEST-CREE LWII|6LWO|6WEST-CREE LWO|6LWOO|6WEST-CREE LWOO|6LWA|6WEST-CREE LWA|6LWAA|6WEST-CREE LWAA|6L|6WEST-CREE L|6MEDIAL L|6SE|7AAI|7I|8I|7O|8O|6Y-CREE SOO|6SA|8A|7WE|6WEST-CREE SWE|6SWI|6WEST-CREE SWI|6SWII|6WEST-CREE SWII|6SWO|6WEST-CREE SWO|6SWOO|6WEST-CREE SWOO|6SWA|6WEST-CREE SWA|6SWAA|6WEST-CREE SWAA|6NASKAPI SWAA|6S|6ATHAPASCAN S|6SW|6BLACKFOOT S|6MOOSE-CREE SK|6NASKAPI SKW|?-W|?PWA|?TWA|?KWA|?CWA|6SHE|8I|9I|8O|9O|8A|9A|8WE|6WEST-CREE SHWE|6SHWI|6WEST-CREE SHWI|6SHWII|6WEST-CREE SHWII|6SHWO|6WEST-CREE SHWO|6SHWOO|6WEST-CREE SHWOO|6SHWA|6WEST-CREE SHWA|6SHWAA|6WEST-CREE SHWAA|6SH|6YE|7AAI|7I|8I|7O|8O|7-CREE YOO|7A|8A|7WE|6WEST-CREE YWE|6YWI|6WEST-CREE YWI|6YWII|6WEST-CREE YWII|6YWO|6WEST-CREE YWO|6YWOO|6WEST-CREE YWOO|6YWA|6WEST-CREE YWA|6YWAA|6WEST-CREE YWAA|6NASKAPI YWAA|6Y|6BIBLE-CREE Y|6WEST-CREE Y|6SAYISI YI|6RE|7-CREE RE|6WEST-CREE LE|6RAAI|7I|8I|7O|8O|6WEST-CREE LO|6RA|8A|6WEST-CREE LA|6RWAA|6WEST-CREE RWAA|6R|6WEST-CREE R|6MEDIAL R|6FE|7AAI|7I|8I|7O|8O|7A|8A|7WAA|6WEST-CREE FWAA|6F|6THE|6N-CREE THE|6THI|6N-CREE THI|6THII|6N-CREE THII|6THO|9O|8A|9A|8WAA|6WEST-CREE THWAA|6TH|7THE|9I|9O|9A|9|7YE|8I|8O|8A|6NUNAVIK HE|?I|@I|?O|@O|?A|@A|?|;UT H|6HK|6QAAI|7I|8I|7O|8O|7A|8A|7|6TLHE|9I|9O|9A|6WEST-CREE RE|AI|AO|AA|6NGAAI|8I|9I|8O|9O|8A|9A|8|7NG|6SAYISI SHE|?I|?O|?A|6WOODS-CREE THE|CI|CO|CA|C|6LHI|9I|8O|9O|8A|9A|8|6TH-CREE THE|@I|AI|@O|AO|@A|AA|@|6AIVILIK B|6BLACKFOOT E|@I|@O|@A|@WE|AI|AO|AA|@NE|AI|AO|AA|@KE|AI|AO|AA|6SAYISI HE|>I|>O|>A|6CARRIER GHU|@O|@E|AE|@I|@A|>RU|?O|?E|@E|?I|?A|>WU|?O|?E|@E|?I|?A|>HWU|@O|@E|AE|@I|@A|>THU|@O|@E|AE|@I|@A|?TU|@O|@E|AE|@I|@A|>PU|?O|?E|@E|?I|?A|?|>GU|?O|?E|@E|?I|?A|>KHU|@O|@E|AE|@I|@A|?KU|@O|@E|AE|@I|@A|@|>NU|?O|?E|@E|?I|?A|>MU|?O|?E|@E|?I|?A|>YU|?O|?E|@E|?I|?A|>JU|6SAYISI JU|6CARRIER JO|?E|@E|?I|6SAYISI JI|6CARRIER JA|?JU|@O|@E|AE|@I|@A|>LU|?O|?E|@E|?I|?A|>DLU|@O|@E|AE|@I|@A|>LHU|@O|@E|AE|@I|@A|>TLHU|AO|AE|BE|AI|AA|@U|@O|@E|AE|@I|@A|>ZU|?O|?E|@E|?I|?A|?|>INITIAL Z|>DZU|@O|@E|AE|@I|@A|>SU|?O|?E|@E|?I|?A|?HU|@O|@E|AE|@I|@A|@|>TSU|@O|@E|AE|@I|@A|>CHU|@O|@E|AE|@I|@A|>TTSU|AO|AE|BE|AI|AA|7HI SIGN|6FULL STOP|6QAI|6NGAI|7NGI|:I|9O|:O|9A|:A|6WOODS-CREE THWEE|DI|EI|DO|EO|DA|EA|AFINAL TH|6BLACKFOOT W|#OGHAM SPACE MARK|)LETTER BEITH|0LUIS|0FEARN|0SAIL|0NION|0UATH|0DAIR|0TINNE|0COLL|1EIRT|0MUIN|0GORT|0NGEADAL|0STRAIF|0RUIS|0AILM|0ONN|0UR|0EADHADH|0IODHADH|0EABHADH|0OR|0UILLEANN|0IFIN|0EAMHANCHOLL|0PEITH|)FEATHER MARK|)REVERSED FEATHER MARK|#RUNIC LETTER FEHU FEOH FE F|0V|0URUZ UR U|0YR|1|0W|0THURISAZ THURS THORN|0ETH|0ANSUZ A|0OS O|0AC A|1ESC|0LONG-BRANCH-OSS O|0SHORT-TWIG-OSS O|0O|1E|1N|0RAIDO RAD REID R|0KAUNA|0CEN|0KAUN K|0G|0ENG|0GEBO GYFU G|1AR|0WUNJO WYNN W|0HAGLAZ H|2EGL H|0LONG-BRANCH-HAGALL H|0SHORT-TWIG-HAGALL H|0NAUDIZ NYD NAUD N|0SHORT-TWIG-NAUD N|0DOTTED-N|0ISAZ IS ISS I|0E|0JERAN J|0GER|0LONG-BRANCH-AR AE|0SHORT-TWIG-AR A|0IWAZ EOH|0PERTHO PEORTH P|0ALGIZ EOLHX|0SOWILO S|1IGEL LONG-BRANCH-SOL S|1HORT-TWIG-SOL S|0C|0Z|0TIWAZ TIR TYR T|0SHORT-TWIG-TYR T|0D|0BERKANAN BEORC BJARKAN B|0SHORT-TWIG-BJARKAN B|0DOTTED-P|0OPEN-P|0EHWAZ EH E|0MANNAZ MAN M|0LONG-BRANCH-MADR M|0SHORT-TWIG-MADR M|0LAUKAZ LAGU LOGR L|0DOTTED-L|0INGWAZ|3|0DAGAZ DAEG D|0OTHALAN ETHEL O|0EAR|0IOR|0CWEORTH|1ALC|1EALC|0STAN|0LONG-BRANCH-YR|0SHORT-TWIG-YR|0ICELANDIC-YR|0Q|0X|)SINGLE PUNCTUATION|)MULTIPLE PUNCTUATION|)CROSS PUNCTUATION|)ARLAUG SYMBOL|)TVIMADUR SYMBOL|)BELGTHOR SYMBOL|)LETTER K|0SH|0OO|0FRANKS CASKET OS|>IS|>EH|>AC|?ESC|#TAGALOG LETTER A|2I|2U|2KA|2GA|2NGA|2TA|2DA|2NA|2PA|2BA|2MA|2YA|2RA|2LA|2WA|2SA|2HA|+VOWEL SIGN I|6U|+SIGN VIRAMA|0PAMUDPOD|+LETTER ARCHAIC RA|#HANUNOO LETTER A|2I|2U|2KA|2GA|2NGA|2TA|2DA|2NA|2PA|2BA|2MA|2YA|2RA|2LA|2WA|2SA|2HA|+VOWEL SIGN I|6U|+SIGN PAMUDPOD|#PHILIPPINE SINGLE PUNCTUATION|.DOUBLE PUNCTUATION|#BUHID LETTER A|0I|0U|0KA|0GA|0NGA|0TA|0DA|0NA|0PA|0BA|0MA|0YA|0RA|0LA|0WA|0SA|0HA|)VOWEL SIGN I|4U|#TAGBANWA LETTER A|3I|3U|3KA|3GA|3NGA|3TA|3DA|3NA|3PA|3BA|3MA|3YA|3LA|3WA|3SA|,VOWEL SIGN I|7U|#KHMER LETTER KA|1HA|1O|1HO|0NGO|0CA|1HA|1O|1HO|0NYO|0DA|0TTHA|0DO|0TTHO|0NNO|0TA|1HA|1O|1HO|0NO|0BA|0PHA|1O|1HO|0MO|0YO|0RO|0LO|0VO|0SHA|1SO|1A|0HA|0LA|0QA|)INDEPENDENT VOWEL QAQ|=A|<I|=I|<U|=K|=U|>V|;RY|=Y|;LY|=Y|;QE|<AI|<OO TYPE ONE|DTWO|<AU|)VOWEL INHERENT AQ|9A|/SIGN AA|4I|5I|4Y|5Y|4U|5U|5A|4OE|4YA|4IE|4E|4AE|5I|4OO|4AU|)SIGN NIKAHIT|.REAHMUK|.YUUKALEAPINTU|.MUUSIKATOAN|.TRIISAP|.BANTOC|.ROBAT|.TOANDAKHIAT|.KAKABAT|.AHSDA|.SAMYOK SANNYA|.VIRIAM|.COENG|.BATHAMASAT|.KHAN|.BARIYOOSAN|.CAMNUC PII KUUH|.LEK TOO|.BEYYAL|.PHNAEK MUAN|.KOOMUUT|)CURRENCY SYMBOL RIEL|)SIGN AVAKRAHASANYA|/TTHACAN|)DIGIT ZERO|/ONE|/TWO|0HREE|/FOUR|0IVE|/SIX|0EVEN|/EIGHT|/NINE|)SYMBOL LEK ATTAK SON|:MUOY|:PII|:BEI|;UON|:PRAM|>-MUOY|?PII|?BEI|@UON|#MONGOLIAN BIRGA|-ELLIPSIS|-COMMA|-FULL STOP|-COLON|-FOUR DOTS|-TODO SOFT HYPHEN|-SIBE SYLLABLE BOUNDARY MARKER|-MANCHU COMMA|4FULL STOP|-NIRUGU|-FREE VARIATION SELECTOR ONE|ETWO|FHREE|-VOWEL SEPARATOR|-FREE VARIATION SELECTOR FOUR|-DIGIT ZERO|3ONE|3TWO|4HREE|3FOUR|4IVE|3SIX|4EVEN|3EIGHT|3NINE|-LETTER A|4E|4I|4O|4U|4OE|4UE|4EE|4NA|4ANG|4BA|4PA|4QA|4GA|4MA|4LA|4SA|5HA|4TA|4DA|4CHA|4JA|4YA|4RA|4WA|4FA|4KA|5HA|4TSA|4ZA|4HAA|4ZRA|4LHA|4ZHI|4CHI|4TODO LONG VOWEL SIGN|9E|9I|9O|9U|9OE|9UE|9ANG|9BA|9PA|9QA|9GA|9MA|9TA|9DA|9CHA|9JA|9TSA|9YA|9WA|9KA|9GAA|9HAA|9JIA|9NIA|9DZA|4SIBE E|9I|:Y|9UE|:|9ANG|9KA|9GA|9HA|9PA|9SHA|9TA|9DA|9JA|9FA|9GAA|9HAA|9TSA|9ZA|9RAA|9CHA|9ZHA|4MANCHU I|;KA|;RA|;FA|;ZHA|4CHA WITH TWO DOTS|4ALI GALI ANUSVARA ONE|=VISARGA ONE|=DAMARU|=UBADAMA|=INVERTED UBADAMA|=BALUDA|=THREE BALUDA|=A|=I|=KA|=NGA|=CA|=TTA|?HA|=DDA|=NNA|=TA|=DA|=PA|>HA|=SSA|=ZHA|>A|=AH|4TODO ALI GALI TA|BZHA|4MANCHU ALI GALI GHA|DNGA|DCA|DJHA|DTTA|DDDHA|DTA|DDHA|DSSA|DCYA|DZHA|EA|4ALI GALI HALF U|BYA|4MANCHU ALI GALI BHA|4ALI GALI DAGALGA|4MANCHU ALI GALI LHA|#CANADIAN SYLLABICS OY|6AY|7AY|6WAY|6POY|7AY|7WOY|6TAY|6KAY|7WAY|6MAY|6NOY|7AY|6LAY|6SOY|7AY|7HOY|8AY|8WOY|6YOY|7AY|6RAY|6NWI|6OJIBWAY NWI|6NWII|6OJIBWAY NWII|6NWO|6OJIBWAY NWO|6NWOO|6OJIBWAY NWOO|6RWEE|8I|9I|8O|9O|8A|6OJIBWAY P|>T|>K|>C|>M|>N|>S|?H|6EASTERN W|6WESTERN W|6FINAL SMALL RING|<RAISED DOT|6R-CREE RWE|6WEST-CREE LOO|AAA|6THWE|9A|7THWE|9OO|9AA|7LHWE|9OO|6SAYISI SHWE|?OO|=HOO|6CARRIER GWU|>DENE GEE|>GAA|?WA|6SAYISI JUU|6CARRIER JWA|6BEAVER DENE L|BR|6CARRIER DENTAL S|#LIMBU VOWEL-CARRIER LETTER|)LETTER KA|1HA|0GA|1HA|0NGA|0CA|1HA|0JA|1HA|0YAN|0TA|1HA|0DA|1HA|0NA|0PA|1HA|0BA|1HA|0MA|0YA|0RA|0LA|0WA|0SHA|1SA|1A|0HA|0GYAN|0TRA|)VOWEL SIGN A|4I|4U|4EE|4AI|4OO|4AU|4E|4O|)SUBJOINED LETTER YA|:RA|:WA|*MALL LETTER KA|6NGA|6ANUSVARA|6TA|6NA|6PA|6MA|6RA|6LA|*IGN MUKPHRENG|.KEMPHRENG|.SA-I|.LOO|)EXCLAMATION MARK|)QUESTION MARK|)DIGIT ZERO|/ONE|/TWO|0HREE|/FOUR|0IVE|/SIX|0EVEN|/EIGHT|/NINE|#TAI LE LETTER KA|1XA|1NGA|1TSA|1SA|1YA|1TA|2HA|1LA|1PA|2HA|1MA|1FA|1VA|1HA|1QA|1KHA|1TSHA|1NA|1A|1I|1EE|2H|1U|1OO|2|1UE|1E|1AUE|2I|1TONE-2|63|64|65|66|#NEW TAI LUE LETTER HIGH QA|6LOW QA|6HIGH KA|;XA|;NGA|6LOW KA|:XA|:NGA|6HIGH TSA|;SA|;YA|6LOW TSA|:SA|:YA|6HIGH TA|<HA|;NA|6LOW TA|;HA|:NA|6HIGH PA|<HA|;MA|6LOW PA|;HA|:MA|6HIGH FA|;VA|;LA|6LOW FA|:VA|:LA|6HIGH HA|;DA|;BA|6LOW HA|:DA|:BA|6HIGH KVA|;XVA|6LOW KVA|:XVA|6HIGH SUA|6LOW SUA|/VOWEL SIGN VOWEL SHORTENER|:AA|:II|:U|;U|:E|:AE|:O|;A|:UE|:AY|;AY|:UY|:OY|;AY|:UEY|:IY|/LETTER FINAL V|<NG|=|<M|<K|<D|<B|/TONE MARK-1|92|/DIGIT ZERO|5ONE|5TWO|6HREE|5FOUR|6IVE|5SIX|6EVEN|5EIGHT|5NINE|/THAM DIGIT ONE|/SIGN LAE|7V|#KHMER SYMBOL PATHAMASAT|0MUOY KOET|0PII KOET|0BEI KOET|1UON KOET|0PRAM KOET|4-MUOY KOET|5PII KOET|5BEI KOET|6UON KOET|0DAP KOET|3-MUOY KOET|4PII KOET|4BEI KOET|5UON KOET|4PRAM KOET|0TUTEYASAT|0MUOY ROC|0PII ROC|0BEI ROC|1UON ROC|0PRAM ROC|4-MUOY ROC|5PII ROC|5BEI ROC|6UON ROC|0DAP ROC|3-MUOY ROC|4PII ROC|4BEI ROC|5UON ROC|4PRAM ROC|#BUGINESE LETTER KA|3GA|3NGA|5KA|3PA|3BA|3MA|4PA|3TA|3DA|3NA|4RA|3CA|3JA|3NYA|5CA|3YA|3RA|3LA|3VA|3SA|3A|3HA|,VOWEL SIGN I|7U|7E|7O|7AE|,PALLAWA|,END OF SECTION|#TAI THAM LETTER HIGH KA|9HA|9XA|3LOW KA|8XA|8HA|3NGA|3HIGH CA|9HA|3LOW CA|7SA|7CHA|3NYA|3RATA|3HIGH RATHA|3DA|3LOW RATHA|3RANA|3HIGH TA|9HA|3LOW TA|8HA|3NA|3BA|3HIGH PA|9HA|8FA|3LOW PA|7FA|7PHA|3MA|3LOW YA|3HIGH YA|3RA|4UE|3LA|4UE|3WA|3HIGH SHA|9SA|9A|8HA|3LLA|3A|3LOW HA|3I|4I|3U|4U|3EE|3OO|3LAE|3GREAT SA|,CONSONANT SIGN MEDIAL RA|BLA|;LA TANG LAI|,SIGN MAI KANG LAI|,CONSONANT SIGN FINAL NGA|;LOW PA|;HIGH RATHA OR LOW PA|;MA|;BA|;SA|,SIGN SAKOT|,VOWEL SIGN A|7MAI SAT|7AA|7TALL AA|7I|8I|7UE|8UE|8|8U|7O|8A BELOW|8Y|7E|7AE|7OO|7AI|7THAM AI|7OA ABOVE|,SIGN MAI KANG|1TONE-1|62|1KHUEN TONE-3|<4|<5|1RA HAAM|1MAI SAM|1KHUEN-LUE KARAN|,COMBINING CRYPTOGRAMMIC DOT|,HORA DIGIT ZERO|7ONE|7TWO|8HREE|7FOUR|8IVE|7SIX|8EVEN|7EIGHT|7NINE|,THAM DIGIT ZERO|7ONE|7TWO|8HREE|7FOUR|8IVE|7SIX|8EVEN|7EIGHT|7NINE|,SIGN WIANG|6WAAK|1SAWAN|1KEOW|1HOY|1DOKMAI|1REVERSED ROTATED RANA|1MAI YAMOK|1KAAN|5KUU|1SATKAAN|8KUU|1HANG|1CAANG|#COMBINING DOUBLED CIRCUMFLEX ACCENT|.IAERESIS-RING|-INFINITY|-DOWNWARDS ARROW|-TRIPLE DOT|-X-X BELOW|-WIGGLY LINE BELOW|-OPEN MARK BELOW|-DOUBLE OPEN MARK BELOW|-LIGHT CENTRALIZATION STROKE BELOW|-STRONG CENTRALIZATION STROKE BELOW|-PARENTHESES ABOVE|-DOUBLE PARENTHESES ABOVE|-PARENTHESES BELOW|9OVERLAY|-LATIN SMALL LETTER W BELOW|@TURNED W BELOW|.EFT PARENTHESIS ABOVE LEFT|-RIGHT PARENTHESIS ABOVE RIGHT|-LEFT PARENTHESIS BELOW LEFT|-RIGHT PARENTHESIS BELOW RIGHT|-SQUARE BRACKETS ABOVE|-NUMBER SIGN ABOVE|-INVERTED DOUBLE ARCH ABOVE|-PLUS SIGN ABOVE|-DOUBLE PLUS SIGN ABOVE|>BELOW|-TRIPLE ACUTE ACCENT|-LATIN SMALL LETTER INSULAR G|HR|HT|-DOUBLE CARON|-VERTICAL-LINE-ACUTE|-GRAVE-VERTICAL-LINE|-VERTICAL-LINE-GRAVE|-ACUTE-VERTICAL-LINE|-VERTICAL-LINE-MACRON|-MACRON-VERTICAL-LINE|-VERTICAL-LINE-ACUTE-GRAVE|;GRAVE-ACUTE|-MACRON-ACUTE-GRAVE|-SHARP SIGN|-FLAT SIGN|-DOWN TACK ABOVE|.IAERESIS WITH RAISED LEFT DOT|.OT-AND-RING BELOW|-GRAVE-DOT|-DOT-ACUTE|-LEFT TACK ABOVE|-RIGHT TACK ABOVE|-MINUS SIGN ABOVE|-INVERTED BRIDGE ABOVE|-SQUARE ABOVE|.EAGULL ABOVE|-DOUBLE ARCH BELOW|9ABOVE|-EQUALS SIGN ABOVE|-LEFT ANGLE CENTRED ABOVE|-UPWARDS ARROW ABOVE|-DOUBLE RIGHTWARDS ARROW ABOVE|-CARON-ACUTE|-VERTICAL-LINE-DOUBLE-ACUTE|-DOUBLE GRAVE ACCENT BELOW|4ACUTE ACCENT BELOW|4COMMA ABOVE|#BALINESE SIGN ULU RICEM|5CANDRA|1CECEK|1SURANG|1BISAH|,LETTER AKARA|8 TEDUNG|3IKARA|8 TEDUNG|3UKARA|8 TEDUNG|3RA REPA|: TEDUNG|3LA LENGA|; TEDUNG|3EKARA|3AIKARA|3OKARA|8 TEDUNG|3KA|5 MAHAPRANA|3GA|5 GORA|3NGA|3CA|5 LACA|3JA|5 JERA|3NYA|3TA LATIK|6MURDA MAHAPRANA|3DA MURDA ALPAPRANA|<MAHAPRANA|3NA RAMBAT|3TA|5 TAWA|3DA|5 MADU|3NA|3PA|5 KAPAL|3BA|5 KEMBANG|3MA|3YA|3RA|3LA|3WA|3SA SAGA|8PA|5|3HA|,SIGN REREKAN|,VOWEL SIGN TEDUNG|7ULU|: SARI|7SUKU|; ILUT|7RA REPA|> TEDUNG|7LA LENGA|? TEDUNG|7TALING|= REPA|>TEDUNG|>REPA TEDUNG|7PEPET|< TEDUNG|,ADEG ADEG|,LETTER KAF SASAK|4HOT SASAK|3TZIR SASAK|3EF SASAK|3VE SASAK|3ZAL SASAK|3ASYURA SASAK|4RCHAIC JNYA|,INVERTED CARIK SIKI|;PAREREN|,DIGIT ZERO|2ONE|2TWO|3HREE|2FOUR|3IVE|2SIX|3EVEN|2EIGHT|2NINE|,PANTI|.MADA|,WINDU|,CARIK PAMUNGKAH|2SIKI|2PAREREN|,PAMENENG|,MUSICAL SYMBOL DONG|<ENG|<UNG|<ANG|? SURANG|<ING|<AENG|<EUNG|<AING|=NG GEDE|;COMBINING TEGEH|EENDEP|EKEMPUL|ILI|EJEGOGAN|EKEMPUL WITH JEGOGAN|ILI WITH JEGOGAN|EBENDE|EGONG|;RIGHT-HAND OPEN DUG|LAG|FCLOSED TUK|NAK|;LEFT-HAND OPEN PANG|KUNG|ECLOSED PLAK|NUK|EOPEN PING|,PANTI LANTANG|.MADA LANTANG|.NTI BAWAK|#SUNDANESE SIGN PANYECEK|5GLAYAR|6WISAD|-LETTER A|4I|4U|4AE|4O|4E|5U|4KA|4QA|4GA|4NGA|4CA|4JA|4ZA|4NYA|4TA|4DA|4NA|4PA|4FA|4VA|4BA|4MA|4YA|4RA|4LA|4WA|4SA|4XA|4HA|-CONSONANT SIGN PAMINGKAL|>NYAKRA|@IKU|-VOWEL SIGN PANGHULU|;YUKU|;AELAENG|;OLONG|:MEPET|:NEULEUNG|-SIGN PAMAAEH|2VIRAMA|-CONSONANT SIGN PASANGAN MA|EWA|-LETTER KHA|4SYA|-DIGIT ZERO|3ONE|3TWO|4HREE|3FOUR|4IVE|3SIX|4EVEN|3EIGHT|3NINE|-AVAGRAHA|-LETTER REU|4LEU|4BHA|4FINAL K|:M|#BATAK LETTER A|0SIMALUNGUN A|0HA|0SIMALUNGUN HA|0MANDAILING HA|0BA|0KARO BA|0PA|0SIMALUNGUN PA|0NA|0MANDAILING NA|0WA|0SIMALUNGUN WA|0PAKPAK WA|0GA|0SIMALUNGUN GA|0JA|0DA|0RA|0SIMALUNGUN RA|0MA|0SIMALUNGUN MA|1OUTHERN TA|0NORTHERN TA|0SA|1IMALUNGUN SA|0MANDAILING SA|0YA|0SIMALUNGUN YA|0NGA|0LA|0SIMALUNGUN LA|0NYA|0CA|0NDA|0MBA|0I|0U|)SIGN TOMPI|)VOWEL SIGN E|4PAKPAK E|4EE|4I|4KARO I|4O|4KARO O|4U|5 FOR SIMALUNGUN SA|)CONSONANT SIGN NG|8H|)PANGOLAT|,ONGONAN|)SYMBOL BINDU NA METEK|6PINARBORAS|6JUDUL|6PANGOLAT|#LEPCHA LETTER KA|2LA|2HA|1GA|2LA|1NGA|1CA|2HA|1JA|1NYA|1TA|2HA|1DA|1NA|1PA|2LA|2HA|1FA|2LA|1BA|2LA|1MA|2LA|1TSA|3HA|1DZA|1YA|1RA|1LA|1HA|2LA|1VA|1SA|2HA|1WA|1A|*SUBJOINED LETTER YA|;RA|*VOWEL SIGN AA|5I|5O|6O|5U|6U|5E|*CONSONANT SIGN K|9M|9L|9N|9P|9R|9T|9NYIN-DO|9KANG|*SIGN RAN|/NUKTA|*PUNCTUATION TA-ROL|6NYET THYOOM TA-ROL|6CER-WA|6TSHOOK CER-WA|<|*DIGIT ZERO|0ONE|0TWO|1HREE|0FOUR|1IVE|0SIX|1EVEN|0EIGHT|0NINE|*LETTER TTA|3HA|1DDA|#OL CHIKI DIGIT ZERO|2ONE|2TWO|3HREE|2FOUR|3IVE|2SIX|3EVEN|2EIGHT|2NINE|,LETTER LA|3AT|4G|4NG|4L|3LAA|3AAK|5J|5M|5W|3LI|3IS|4H|4NY|4R|3LU|3UC|4D|4NN|4Y|3LE|3EP|4DD|4N|4RR|3LO|3OTT|4B|4V|4H|,MU TTUDDAG|,GAAHLAA TTUDDAAG|,MU-GAAHLAA TTUDDAAG|,RELAA|,PHAARKAA|,AHAD|,PUNCTUATION MUCAAD|8DOUBLE MUCAAD|#CYRILLIC SMALL LETTER ROUNDED VE|9LONG-LEGGED DE|9NARROW O|9WIDE ES|9TALL TE|:HREE-LEGGED TE|:ALL HARD SIGN|>YAT|9UNBLENDED UK|,CAPITAL LETTER TJE|,SMALL LETTER TJE|#GEORGIAN MTAVRULI CAPITAL LETTER AN|DBAN|DGAN|DDON|DEN|DVIN|DZEN|DTAN|DIN|DKAN|DLAS|DMAN|DNAR|DON|DPAR|DZHAR|DRAE|DSAN|DTAR|DUN|DPHAR|DKHAR|DGHAN|DQAR|DSHIN|DCHIN|EAN|DJIL|DCIL|EHAR|DXAN|DJHAN|DHAE|EE|EIE|DWE|DHAR|EOE|DFI|DYN|DELIFI|DTURNED GAN|DAIN|EEN|DHARD SIGN|DLABIAL SIGN|#SUNDANESE PUNCTUATION BINDU SURYA|?PANGLONG|@URNAMA|?CAKRA|?LEU SATANGA|?KA SATANGA|?DA SATANGA|?BA SATANGA|#VEDIC TONE KARSHANA|.SHARA|.PRENKHA|)SIGN NIHSHVASA|.YAJURVEDIC MIDLINE SVARITA|)TONE YAJURVEDIC AGGRAVATED INDEPENDENT SVARITA|9INDEPENDENT SVARITA|9KATHAKA INDEPENDENT SVARITA|.CANDRA BELOW|.YAJURVEDIC KATHAKA INDEPENDENT SVARITA SCHROEDER|.DOUBLE SVARITA|.TRIPLE SVARITA|.KATHAKA ANUDATTA|.DOT BELOW|.TWO DOTS BELOW|/HREE DOTS BELOW|.RIGVEDIC KASHMIRI INDEPENDENT SVARITA|.ATHARVAVEDIC INDEPENDENT SVARITA|)SIGN VISARGA SVARITA|6UDATTA|.REVERSED VISARGA UDATTA|.VISARGA ANUDATTA|.REVERSED VISARGA ANUDATTA|.VISARGA UDATTA WITH TAIL|6ANUDATTA WITH TAIL|.ANUSVARA ANTARGOMUKHA|7BAHIRGOMUKHA|7VAMAGOMUKHA|B WITH TAIL|.TIRYAK|.HEXIFORM LONG ANUSVARA|.LONG ANUSVARA|.RTHANG LONG ANUSVARA|.ANUSVARA UBHAYATO MUKHA|/RDHAVISARGA|.ROTATED ARDHAVISARGA|)TONE CANDRA ABOVE|)SIGN JIHVAMULIYA|.UPADHMANIYA|.ATIKRAMA|)TONE RING ABOVE|.DOUBLE RING ABOVE|)SIGN DOUBLE ANUSVARA ANTARGOMUKHA|#LATIN LETTER SMALL CAPITAL A|?E|)SMALL LETTER TURNED AE|)LETTER SMALL CAPITAL BARRED B|>C|>D|>ETH|?|)SMALL LETTER TURNED OPEN E|=I|)LETTER SMALL CAPITAL J|>K|>L WITH STROKE|>M|>REVERSED N|>O|?PEN O|)SMALL LETTER SIDEWAYS O|@PEN O|@ WITH STROKE|6TURNED OE|)LETTER SMALL CAPITAL OU|)SMALL LETTER TOP HALF O|6BOTTOM HALF O|)LETTER SMALL CAPITAL P|>REVERSED R|>TURNED R|?|>U|)SMALL LETTER SIDEWAYS U|?DIAERESIZED U|?TURNED M|)LETTER SMALL CAPITAL V|>W|>Z|>EZH|0VOICED LARYNGEAL SPIRANT|0AIN|#GREEK LETTER SMALL CAPITAL GAMMA|>LAMDA|>PI|>RHO|>PSI|#CYRILLIC LETTER SMALL CAPITAL EL|#MODIFIER LETTER CAPITAL A|<E|;B|<ARRED B|;D|;E|;REVERSED E|;G|;H|;I|;J|;K|;L|;M|;N|;REVERSED N|;O|<U|;P|;R|;T|;U|;W|3SMALL A|9TURNED A|9ALPHA|9TURNED AE|9B|9D|9E|9SCHWA|9OPEN E|9TURNED OPEN E|9G|9TURNED I|9K|9M|9ENG|9O|:PEN O|9TOP HALF O|9BOTTOM HALF O|9P|9T|9U|9SIDEWAYS U|9TURNED M|9V|9AIN|9BETA|9GREEK GAMMA|9DELTA|9GREEK PHI|9CHI|#LATIN SUBSCRIPT SMALL LETTER I|@R|@U|@V|#GREEK SUBSCRIPT SMALL LETTER BETA|@GAMMA|@RHO|@PHI|@CHI|#LATIN SMALL LETTER UE|6B WITH MIDDLE TILDE|6D WITH MIDDLE TILDE|6F WITH MIDDLE TILDE|6M WITH MIDDLE TILDE|6N WITH MIDDLE TILDE|6P WITH MIDDLE TILDE|6R WITH MIDDLE TILDE|=FISHHOOK AND MIDDLE TILDE|6S WITH MIDDLE TILDE|6T WITH MIDDLE TILDE|6Z WITH MIDDLE TILDE|6TURNED G|#MODIFIER LETTER CYRILLIC EN|#LATIN SMALL LETTER INSULAR G|6TH WITH STRIKETHROUGH|/CAPITAL LETTER I WITH STROKE|/LETTER IOTA WITH STROKE|6P WITH STROKE|/CAPITAL LETTER U WITH STROKE|/LETTER UPSILON WITH STROKE|6B WITH PALATAL HOOK|6D WITH PALATAL HOOK|6F WITH PALATAL HOOK|6G WITH PALATAL HOOK|6K WITH PALATAL HOOK|6L WITH PALATAL HOOK|6M WITH PALATAL HOOK|6N WITH PALATAL HOOK|6P WITH PALATAL HOOK|6R WITH PALATAL HOOK|6S WITH PALATAL HOOK|6ESH WITH PALATAL HOOK|6V WITH PALATAL HOOK|6X WITH PALATAL HOOK|6Z WITH PALATAL HOOK|6A WITH RETROFLEX HOOK|7LPHA WITH RETROFLEX HOOK|6D WITH HOOK AND TAIL|6E WITH RETROFLEX HOOK|6OPEN E WITH RETROFLEX HOOK|6REVERSED OPEN E WITH RETROFLEX HOOK|6SCHWA WITH RETROFLEX HOOK|6I WITH RETROFLEX HOOK|6OPEN O WITH RETROFLEX HOOK|6ESH WITH RETROFLEX HOOK|6U WITH RETROFLEX HOOK|6EZH WITH RETROFLEX HOOK|#MODIFIER LETTER SMALL TURNED ALPHA|9C|: WITH CURL|9ETH|9REVERSED OPEN E|9F|9DOTLESS J WITH STROKE|9SCRIPT G|9TURNED H|9I WITH STROKE|:OTA|9CAPITAL I|B WITH STROKE|9J WITH CROSSED-TAIL|9L WITH RETROFLEX HOOK|@PALATAL HOOK|9CAPITAL L|9M WITH HOOK|9TURNED M WITH LONG LEG|9N WITH LEFT HOOK|@RETROFLEX HOOK|9CAPITAL N|9BARRED O|9PHI|9S WITH HOOK|9ESH|9T WITH PALATAL HOOK|9U BAR|:PSILON|9CAPITAL U|9V WITH HOOK|9TURNED V|9Z|: WITH RETROFLEX HOOK|@CURL|9EZH|9THETA|#COMBINING DOTTED GRAVE ACCENT|4ACUTE ACCENT|-SNAKE BELOW|.USPENSION MARK|-MACRON-ACUTE|-GRAVE-MACRON|-MACRON-GRAVE|-ACUTE-MACRON|-GRAVE-ACUTE-GRAVE|-ACUTE-GRAVE-ACUTE|-LATIN SMALL LETTER R BELOW|-BREVE-MACRON|-MACRON-BREVE|-DOUBLE CIRCUMFLEX ABOVE|-OGONEK ABOVE|-ZIGZAG BELOW|-IS BELOW|-UR ABOVE|.S ABOVE|-LATIN SMALL LETTER FLATTENED OPEN A ABOVE|@AE|AO|AV|@C CEDILLA|@INSULAR D|@ETH|@G|3LETTER SMALL CAPITAL G|3SMALL LETTER K|@L|3LETTER SMALL CAPITAL L|HM|3SMALL LETTER N|3LETTER SMALL CAPITAL N|HR|3SMALL LETTER R ROTUNDA|@S|@LONG S|@Z|@ALPHA|@B|AETA|@SCHWA|@F|@L WITH DOUBLE MIDDLE TILDE|@O WITH LIGHT CENTRALIZATION STROKE|@P|@ESH|@U WITH LIGHT CENTRALIZATION STROKE|@W|@A WITH DIAERESIS|@O WITH DIAERESIS|@U WITH DIAERESIS|-UP TACK ABOVE|-KAVYKA ABOVE RIGHT|:LEFT|-DOT ABOVE LEFT|-WIDE INVERTED BRIDGE BELOW|-DOT BELOW LEFT|.ELETION MARK|.OUBLE INVERTED BREVE BELOW|-ALMOST EQUAL TO BELOW|-LEFT ARROWHEAD ABOVE|-RIGHT ARROWHEAD AND DOWN ARROWHEAD BELOW|#LATIN CAPITAL LETTER A WITH RING BELOW|)SMALL LETTER A WITH RING BELOW|)CAPITAL LETTER B WITH DOT ABOVE|)SMALL LETTER B WITH DOT ABOVE|)CAPITAL LETTER B WITH DOT BELOW|)SMALL LETTER B WITH DOT BELOW|)CAPITAL LETTER B WITH LINE BELOW|)SMALL LETTER B WITH LINE BELOW|)CAPITAL LETTER C WITH CEDILLA AND ACUTE|)SMALL LETTER C WITH CEDILLA AND ACUTE|)CAPITAL LETTER D WITH DOT ABOVE|)SMALL LETTER D WITH DOT ABOVE|)CAPITAL LETTER D WITH DOT BELOW|)SMALL LETTER D WITH DOT BELOW|)CAPITAL LETTER D WITH LINE BELOW|)SMALL LETTER D WITH LINE BELOW|)CAPITAL LETTER D WITH CEDILLA|)SMALL LETTER D WITH CEDILLA|)CAPITAL LETTER D WITH CIRCUMFLEX BELOW|)SMALL LETTER D WITH CIRCUMFLEX BELOW|)CAPITAL LETTER E WITH MACRON AND GRAVE|)SMALL LETTER E WITH MACRON AND GRAVE|)CAPITAL LETTER E WITH MACRON AND ACUTE|)SMALL LETTER E WITH MACRON AND ACUTE|)CAPITAL LETTER E WITH CIRCUMFLEX BELOW|)SMALL LETTER E WITH CIRCUMFLEX BELOW|)CAPITAL LETTER E WITH TILDE BELOW|)SMALL LETTER E WITH TILDE BELOW|)CAPITAL LETTER E WITH CEDILLA AND BREVE|)SMALL LETTER E WITH CEDILLA AND BREVE|)CAPITAL LETTER F WITH DOT ABOVE|)SMALL LETTER F WITH DOT ABOVE|)CAPITAL LETTER G WITH MACRON|)SMALL LETTER G WITH MACRON|)CAPITAL LETTER H WITH DOT ABOVE|)SMALL LETTER H WITH DOT ABOVE|)CAPITAL LETTER H WITH DOT BELOW|)SMALL LETTER H WITH DOT BELOW|)CAPITAL LETTER H WITH DIAERESIS|)SMALL LETTER H WITH DIAERESIS|)CAPITAL LETTER H WITH CEDILLA|)SMALL LETTER H WITH CEDILLA|)CAPITAL LETTER H WITH BREVE BELOW|)SMALL LETTER H WITH BREVE BELOW|)CAPITAL LETTER I WITH TILDE BELOW|)SMALL LETTER I WITH TILDE BELOW|)CAPITAL LETTER I WITH DIAERESIS AND ACUTE|)SMALL LETTER I WITH DIAERESIS AND ACUTE|)CAPITAL LETTER K WITH ACUTE|)SMALL LETTER K WITH ACUTE|)CAPITAL LETTER K WITH DOT BELOW|)SMALL LETTER K WITH DOT BELOW|)CAPITAL LETTER K WITH LINE BELOW|)SMALL LETTER K WITH LINE BELOW|)CAPITAL LETTER L WITH DOT BELOW|)SMALL LETTER L WITH DOT BELOW|)CAPITAL LETTER L WITH DOT BELOW AND MACRON|)SMALL LETTER L WITH DOT BELOW AND MACRON|)CAPITAL LETTER L WITH LINE BELOW|)SMALL LETTER L WITH LINE BELOW|)CAPITAL LETTER L WITH CIRCUMFLEX BELOW|)SMALL LETTER L WITH CIRCUMFLEX BELOW|)CAPITAL LETTER M WITH ACUTE|)SMALL LETTER M WITH ACUTE|)CAPITAL LETTER M WITH DOT ABOVE|)SMALL LETTER M WITH DOT ABOVE|)CAPITAL LETTER M WITH DOT BELOW|)SMALL LETTER M WITH DOT BELOW|)CAPITAL LETTER N WITH DOT ABOVE|)SMALL LETTER N WITH DOT ABOVE|)CAPITAL LETTER N WITH DOT BELOW|)SMALL LETTER N WITH DOT BELOW|)CAPITAL LETTER N WITH LINE BELOW|)SMALL LETTER N WITH LINE BELOW|)CAPITAL LETTER N WITH CIRCUMFLEX BELOW|)SMALL LETTER N WITH CIRCUMFLEX BELOW|)CAPITAL LETTER O WITH TILDE AND ACUTE|)SMALL LETTER O WITH TILDE AND ACUTE|)CAPITAL LETTER O WITH TILDE AND DIAERESIS|)SMALL LETTER O WITH TILDE AND DIAERESIS|)CAPITAL LETTER O WITH MACRON AND GRAVE|)SMALL LETTER O WITH MACRON AND GRAVE|)CAPITAL LETTER O WITH MACRON AND ACUTE|)SMALL LETTER O WITH MACRON AND ACUTE|)CAPITAL LETTER P WITH ACUTE|)SMALL LETTER P WITH ACUTE|)CAPITAL LETTER P WITH DOT ABOVE|)SMALL LETTER P WITH DOT ABOVE|)CAPITAL LETTER R WITH DOT ABOVE|)SMALL LETTER R WITH DOT ABOVE|)CAPITAL LETTER R WITH DOT BELOW|)SMALL LETTER R WITH DOT BELOW|)CAPITAL LETTER R WITH DOT BELOW AND MACRON|)SMALL LETTER R WITH DOT BELOW AND MACRON|)CAPITAL LETTER R WITH LINE BELOW|)SMALL LETTER R WITH LINE BELOW|)CAPITAL LETTER S WITH DOT ABOVE|)SMALL LETTER S WITH DOT ABOVE|)CAPITAL LETTER S WITH DOT BELOW|)SMALL LETTER S WITH DOT BELOW|)CAPITAL LETTER S WITH ACUTE AND DOT ABOVE|)SMALL LETTER S WITH ACUTE AND DOT ABOVE|)CAPITAL LETTER S WITH CARON AND DOT ABOVE|)SMALL LETTER S WITH CARON AND DOT ABOVE|)CAPITAL LETTER S WITH DOT BELOW AND DOT ABOVE|)SMALL LETTER S WITH DOT BELOW AND DOT ABOVE|)CAPITAL LETTER T WITH DOT ABOVE|)SMALL LETTER T WITH DOT ABOVE|)CAPITAL LETTER T WITH DOT BELOW|)SMALL LETTER T WITH DOT BELOW|)CAPITAL LETTER T WITH LINE BELOW|)SMALL LETTER T WITH LINE BELOW|)CAPITAL LETTER T WITH CIRCUMFLEX BELOW|)SMALL LETTER T WITH CIRCUMFLEX BELOW|)CAPITAL LETTER U WITH DIAERESIS BELOW|)SMALL LETTER U WITH DIAERESIS BELOW|)CAPITAL LETTER U WITH TILDE BELOW|)SMALL LETTER U WITH TILDE BELOW|)CAPITAL LETTER U WITH CIRCUMFLEX BELOW|)SMALL LETTER U WITH CIRCUMFLEX BELOW|)CAPITAL LETTER U WITH TILDE AND ACUTE|)SMALL LETTER U WITH TILDE AND ACUTE|)CAPITAL LETTER U WITH MACRON AND DIAERESIS|)SMALL LETTER U WITH MACRON AND DIAERESIS|)CAPITAL LETTER V WITH TILDE|)SMALL LETTER V WITH TILDE|)CAPITAL LETTER V WITH DOT BELOW|)SMALL LETTER V WITH DOT BELOW|)CAPITAL LETTER W WITH GRAVE|)SMALL LETTER W WITH GRAVE|)CAPITAL LETTER W WITH ACUTE|)SMALL LETTER W WITH ACUTE|)CAPITAL LETTER W WITH DIAERESIS|)SMALL LETTER W WITH DIAERESIS|)CAPITAL LETTER W WITH DOT ABOVE|)SMALL LETTER W WITH DOT ABOVE|)CAPITAL LETTER W WITH DOT BELOW|)SMALL LETTER W WITH DOT BELOW|)CAPITAL LETTER X WITH DOT ABOVE|)SMALL LETTER X WITH DOT ABOVE|)CAPITAL LETTER X WITH DIAERESIS|)SMALL LETTER X WITH DIAERESIS|)CAPITAL LETTER Y WITH DOT ABOVE|)SMALL LETTER Y WITH DOT ABOVE|)CAPITAL LETTER Z WITH CIRCUMFLEX|)SMALL LETTER Z WITH CIRCUMFLEX|)CAPITAL LETTER Z WITH DOT BELOW|)SMALL LETTER Z WITH DOT BELOW|)CAPITAL LETTER Z WITH LINE BELOW|)SMALL LETTER Z WITH LINE BELOW|6H WITH LINE BELOW|6T WITH DIAERESIS|6W WITH RING ABOVE|6Y WITH RING ABOVE|6A WITH RIGHT HALF RING|6LONG S WITH DOT ABOVE|CIAGONAL STROKE|BHIGH STROKE|)CAPITAL LETTER SHARP S|)SMALL LETTER DELTA|)CAPITAL LETTER A WITH DOT BELOW|)SMALL LETTER A WITH DOT BELOW|)CAPITAL LETTER A WITH HOOK ABOVE|)SMALL LETTER A WITH HOOK ABOVE|)CAPITAL LETTER A WITH CIRCUMFLEX AND ACUTE|)SMALL LETTER A WITH CIRCUMFLEX AND ACUTE|)CAPITAL LETTER A WITH CIRCUMFLEX AND GRAVE|)SMALL LETTER A WITH CIRCUMFLEX AND GRAVE|)CAPITAL LETTER A WITH CIRCUMFLEX AND HOOK ABOVE|)SMALL LETTER A WITH CIRCUMFLEX AND HOOK ABOVE|)CAPITAL LETTER A WITH CIRCUMFLEX AND TILDE|)SMALL LETTER A WITH CIRCUMFLEX AND TILDE|)CAPITAL LETTER A WITH CIRCUMFLEX AND DOT BELOW|)SMALL LETTER A WITH CIRCUMFLEX AND DOT BELOW|)CAPITAL LETTER A WITH BREVE AND ACUTE|)SMALL LETTER A WITH BREVE AND ACUTE|)CAPITAL LETTER A WITH BREVE AND GRAVE|)SMALL LETTER A WITH BREVE AND GRAVE|)CAPITAL LETTER A WITH BREVE AND HOOK ABOVE|)SMALL LETTER A WITH BREVE AND HOOK ABOVE|)CAPITAL LETTER A WITH BREVE AND TILDE|)SMALL LETTER A WITH BREVE AND TILDE|)CAPITAL LETTER A WITH BREVE AND DOT BELOW|)SMALL LETTER A WITH BREVE AND DOT BELOW|)CAPITAL LETTER E WITH DOT BELOW|)SMALL LETTER E WITH DOT BELOW|)CAPITAL LETTER E WITH HOOK ABOVE|)SMALL LETTER E WITH HOOK ABOVE|)CAPITAL LETTER E WITH TILDE|)SMALL LETTER E WITH TILDE|)CAPITAL LETTER E WITH CIRCUMFLEX AND ACUTE|)SMALL LETTER E WITH CIRCUMFLEX AND ACUTE|)CAPITAL LETTER E WITH CIRCUMFLEX AND GRAVE|)SMALL LETTER E WITH CIRCUMFLEX AND GRAVE|)CAPITAL LETTER E WITH CIRCUMFLEX AND HOOK ABOVE|)SMALL LETTER E WITH CIRCUMFLEX AND HOOK ABOVE|)CAPITAL LETTER E WITH CIRCUMFLEX AND TILDE|)SMALL LETTER E WITH CIRCUMFLEX AND TILDE|)CAPITAL LETTER E WITH CIRCUMFLEX AND DOT BELOW|)SMALL LETTER E WITH CIRCUMFLEX AND DOT BELOW|)CAPITAL LETTER I WITH HOOK ABOVE|)SMALL LETTER I WITH HOOK ABOVE|)CAPITAL LETTER I WITH DOT BELOW|)SMALL LETTER I WITH DOT BELOW|)CAPITAL LETTER O WITH DOT BELOW|)SMALL LETTER O WITH DOT BELOW|)CAPITAL LETTER O WITH HOOK ABOVE|)SMALL LETTER O WITH HOOK ABOVE|)CAPITAL LETTER O WITH CIRCUMFLEX AND ACUTE|)SMALL LETTER O WITH CIRCUMFLEX AND ACUTE|)CAPITAL LETTER O WITH CIRCUMFLEX AND GRAVE|)SMALL LETTER O WITH CIRCUMFLEX AND GRAVE|)CAPITAL LETTER O WITH CIRCUMFLEX AND HOOK ABOVE|)SMALL LETTER O WITH CIRCUMFLEX AND HOOK ABOVE|)CAPITAL LETTER O WITH CIRCUMFLEX AND TILDE|)SMALL LETTER O WITH CIRCUMFLEX AND TILDE|)CAPITAL LETTER O WITH CIRCUMFLEX AND DOT BELOW|)SMALL LETTER O WITH CIRCUMFLEX AND DOT BELOW|)CAPITAL LETTER O WITH HORN AND ACUTE|)SMALL LETTER O WITH HORN AND ACUTE|)CAPITAL LETTER O WITH HORN AND GRAVE|)SMALL LETTER O WITH HORN AND GRAVE|)CAPITAL LETTER O WITH HORN AND HOOK ABOVE|)SMALL LETTER O WITH HORN AND HOOK ABOVE|)CAPITAL LETTER O WITH HORN AND TILDE|)SMALL LETTER O WITH HORN AND TILDE|)CAPITAL LETTER O WITH HORN AND DOT BELOW|)SMALL LETTER O WITH HORN AND DOT BELOW|)CAPITAL LETTER U WITH DOT BELOW|)SMALL LETTER U WITH DOT BELOW|)CAPITAL LETTER U WITH HOOK ABOVE|)SMALL LETTER U WITH HOOK ABOVE|)CAPITAL LETTER U WITH HORN AND ACUTE|)SMALL LETTER U WITH HORN AND ACUTE|)CAPITAL LETTER U WITH HORN AND GRAVE|)SMALL LETTER U WITH HORN AND GRAVE|)CAPITAL LETTER U WITH HORN AND HOOK ABOVE|)SMALL LETTER U WITH HORN AND HOOK ABOVE|)CAPITAL LETTER U WITH HORN AND TILDE|)SMALL LETTER U WITH HORN AND TILDE|)CAPITAL LETTER U WITH HORN AND DOT BELOW|)SMALL LETTER U WITH HORN AND DOT BELOW|)CAPITAL LETTER Y WITH GRAVE|)SMALL LETTER Y WITH GRAVE|)CAPITAL LETTER Y WITH DOT BELOW|)SMALL LETTER Y WITH DOT BELOW|)CAPITAL LETTER Y WITH HOOK ABOVE|)SMALL LETTER Y WITH HOOK ABOVE|)CAPITAL LETTER Y WITH TILDE|)SMALL LETTER Y WITH TILDE|)CAPITAL LETTER MIDDLE-WELSH LL|)SMALL LETTER MIDDLE-WELSH LL|)CAPITAL LETTER MIDDLE-WELSH V|)SMALL LETTER MIDDLE-WELSH V|)CAPITAL LETTER Y WITH LOOP|)SMALL LETTER Y WITH LOOP|#GREEK SMALL LETTER ALPHA WITH PSILI|ADASIA|APSILI AND VARIA|ADASIA AND VARIA|APSILI AND OXIA|ADASIA AND OXIA|APSILI AND PERISPOMENI|ADASIA AND PERISPOMENI|)CAPITAL LETTER ALPHA WITH PSILI|CDASIA|CPSILI AND VARIA|CDASIA AND VARIA|CPSILI AND OXIA|CDASIA AND OXIA|CPSILI AND PERISPOMENI|CDASIA AND PERISPOMENI|)SMALL LETTER EPSILON WITH PSILI|CDASIA|CPSILI AND VARIA|CDASIA AND VARIA|CPSILI AND OXIA|CDASIA AND OXIA|)CAPITAL LETTER EPSILON WITH PSILI|EDASIA|EPSILI AND VARIA|EDASIA AND VARIA|EPSILI AND OXIA|EDASIA AND OXIA|)SMALL LETTER ETA WITH PSILI|?DASIA|?PSILI AND VARIA|?DASIA AND VARIA|?PSILI AND OXIA|?DASIA AND OXIA|?PSILI AND PERISPOMENI|?DASIA AND PERISPOMENI|)CAPITAL LETTER ETA WITH PSILI|ADASIA|APSILI AND VARIA|ADASIA AND VARIA|APSILI AND OXIA|ADASIA AND OXIA|APSILI AND PERISPOMENI|ADASIA AND PERISPOMENI|)SMALL LETTER IOTA WITH PSILI|@DASIA|@PSILI AND VARIA|@DASIA AND VARIA|@PSILI AND OXIA|@DASIA AND OXIA|@PSILI AND PERISPOMENI|@DASIA AND PERISPOMENI|)CAPITAL LETTER IOTA WITH PSILI|BDASIA|BPSILI AND VARIA|BDASIA AND VARIA|BPSILI AND OXIA|BDASIA AND OXIA|BPSILI AND PERISPOMENI|BDASIA AND PERISPOMENI|)SMALL LETTER OMICRON WITH PSILI|CDASIA|CPSILI AND VARIA|CDASIA AND VARIA|CPSILI AND OXIA|CDASIA AND OXIA|)CAPITAL LETTER OMICRON WITH PSILI|EDASIA|EPSILI AND VARIA|EDASIA AND VARIA|EPSILI AND OXIA|EDASIA AND OXIA|)SMALL LETTER UPSILON WITH PSILI|CDASIA|CPSILI AND VARIA|CDASIA AND VARIA|CPSILI AND OXIA|CDASIA AND OXIA|CPSILI AND PERISPOMENI|CDASIA AND PERISPOMENI|)CAPITAL LETTER UPSILON WITH DASIA|J AND VARIA|OOXIA|OPERISPOMENI|)SMALL LETTER OMEGA WITH PSILI|ADASIA|APSILI AND VARIA|ADASIA AND VARIA|APSILI AND OXIA|ADASIA AND OXIA|APSILI AND PERISPOMENI|ADASIA AND PERISPOMENI|)CAPITAL LETTER OMEGA WITH PSILI|CDASIA|CPSILI AND VARIA|CDASIA AND VARIA|CPSILI AND OXIA|CDASIA AND OXIA|CPSILI AND PERISPOMENI|CDASIA AND PERISPOMENI|)SMALL LETTER ALPHA WITH VARIA|AOXIA|6EPSILON WITH VARIA|COXIA|7TA WITH VARIA|?OXIA|6IOTA WITH VARIA|@OXIA|6OMICRON WITH VARIA|COXIA|6UPSILON WITH VARIA|COXIA|6OMEGA WITH VARIA|AOXIA|6ALPHA WITH PSILI AND YPOGEGRAMMENI|ADASIA AND YPOGEGRAMMENI|APSILI AND VARIA AND YPOGEGRAMMENI|ADASIA AND VARIA AND YPOGEGRAMMENI|APSILI AND OXIA AND YPOGEGRAMMENI|ADASIA AND OXIA AND YPOGEGRAMMENI|APSILI AND PERISPOMENI AND YPOGEGRAMMENI|ADASIA AND PERISPOMENI AND YPOGEGRAMMENI|)CAPITAL LETTER ALPHA WITH PSILI AND PROSGEGRAMMENI|CDASIA AND PROSGEGRAMMENI|CPSILI AND VARIA AND PROSGEGRAMMENI|CDASIA AND VARIA AND PROSGEGRAMMENI|CPSILI AND OXIA AND PROSGEGRAMMENI|CDASIA AND OXIA AND PROSGEGRAMMENI|CPSILI AND PERISPOMENI AND PROSGEGRAMMENI|CDASIA AND PERISPOMENI AND PROSGEGRAMMENI|)SMALL LETTER ETA WITH PSILI AND YPOGEGRAMMENI|?DASIA AND YPOGEGRAMMENI|?PSILI AND VARIA AND YPOGEGRAMMENI|?DASIA AND VARIA AND YPOGEGRAMMENI|?PSILI AND OXIA AND YPOGEGRAMMENI|?DASIA AND OXIA AND YPOGEGRAMMENI|?PSILI AND PERISPOMENI AND YPOGEGRAMMENI|?DASIA AND PERISPOMENI AND YPOGEGRAMMENI|)CAPITAL LETTER ETA WITH PSILI AND PROSGEGRAMMENI|ADASIA AND PROSGEGRAMMENI|APSILI AND VARIA AND PROSGEGRAMMENI|ADASIA AND VARIA AND PROSGEGRAMMENI|APSILI AND OXIA AND PROSGEGRAMMENI|ADASIA AND OXIA AND PROSGEGRAMMENI|APSILI AND PERISPOMENI AND PROSGEGRAMMENI|ADASIA AND PERISPOMENI AND PROSGEGRAMMENI|)SMALL LETTER OMEGA WITH PSILI AND YPOGEGRAMMENI|ADASIA AND YPOGEGRAMMENI|APSILI AND VARIA AND YPOGEGRAMMENI|ADASIA AND VARIA AND YPOGEGRAMMENI|APSILI AND OXIA AND YPOGEGRAMMENI|ADASIA AND OXIA AND YPOGEGRAMMENI|APSILI AND PERISPOMENI AND YPOGEGRAMMENI|ADASIA AND PERISPOMENI AND YPOGEGRAMMENI|)CAPITAL LETTER OMEGA WITH PSILI AND PROSGEGRAMMENI|CDASIA AND PROSGEGRAMMENI|CPSILI AND VARIA AND PROSGEGRAMMENI|CDASIA AND VARIA AND PROSGEGRAMMENI|CPSILI AND OXIA AND PROSGEGRAMMENI|CDASIA AND OXIA AND PROSGEGRAMMENI|CPSILI AND PERISPOMENI AND PROSGEGRAMMENI|CDASIA AND PERISPOMENI AND PROSGEGRAMMENI|)SMALL LETTER ALPHA WITH VRACHY|AMACRON|AVARIA AND YPOGEGRAMMENI|AYPOGEGRAMMENI|AOXIA AND YPOGEGRAMMENI|APERISPOMENI|L AND YPOGEGRAMMENI|)CAPITAL LETTER ALPHA WITH VRACHY|CMACRON|CVARIA|COXIA|CPROSGEGRAMMENI|)KORONIS|)PROSGEGRAMMENI|*SILI|*ERISPOMENI|)DIALYTIKA AND PERISPOMENI|)SMALL LETTER ETA WITH VARIA AND YPOGEGRAMMENI|?YPOGEGRAMMENI|?OXIA AND YPOGEGRAMMENI|?PERISPOMENI|J AND YPOGEGRAMMENI|)CAPITAL LETTER EPSILON WITH VARIA|EOXIA|9TA WITH VARIA|AOXIA|APROSGEGRAMMENI|)PSILI AND VARIA|3OXIA|3PERISPOMENI|)SMALL LETTER IOTA WITH VRACHY|@MACRON|@DIALYTIKA AND VARIA|NOXIA|@PERISPOMENI|@DIALYTIKA AND PERISPOMENI|)CAPITAL LETTER IOTA WITH VRACHY|BMACRON|BVARIA|BOXIA|)DASIA AND VARIA|3OXIA|3PERISPOMENI|)SMALL LETTER UPSILON WITH VRACHY|CMACRON|CDIALYTIKA AND VARIA|QOXIA|6RHO WITH PSILI|?DASIA|6UPSILON WITH PERISPOMENI|CDIALYTIKA AND PERISPOMENI|)CAPITAL LETTER UPSILON WITH VRACHY|EMACRON|EVARIA|EOXIA|8RHO WITH DASIA|)DIALYTIKA AND VARIA|7OXIA|)VARIA|)SMALL LETTER OMEGA WITH VARIA AND YPOGEGRAMMENI|AYPOGEGRAMMENI|AOXIA AND YPOGEGRAMMENI|APERISPOMENI|L AND YPOGEGRAMMENI|)CAPITAL LETTER OMICRON WITH VARIA|EOXIA|:EGA WITH VARIA|COXIA|CPROSGEGRAMMENI|)OXIA|)DASIA|#EN QUAD|$M QUAD|$N SPACE|$M SPACE|#THREE-PER-EM SPACE|#FOUR-PER-EM SPACE|#SIX-PER-EM SPACE|#FIGURE SPACE|#PUNCTUATION SPACE|#THIN SPACE|#HAIR SPACE|#ZERO WIDTH SPACE|.NON-JOINER|.JOINER|#LEFT-TO-RIGHT MARK|#RIGHT-TO-LEFT MARK|#HYPHEN|#NON-BREAKING HYPHEN|#FIGURE DASH|#EN DASH|$M DASH|#HORIZONTAL BAR|#DOUBLE VERTICAL LINE|*LOW LINE|#LEFT SINGLE QUOTATION MARK|#RIGHT SINGLE QUOTATION MARK|#SINGLE LOW-9 QUOTATION MARK|*HIGH-REVERSED-9 QUOTATION MARK|#LEFT DOUBLE QUOTATION MARK|#RIGHT DOUBLE QUOTATION MARK|#DOUBLE LOW-9 QUOTATION MARK|*HIGH-REVERSED-9 QUOTATION MARK|$AGGER|$OUBLE DAGGER|#BULLET|#TRIANGULAR BULLET|#ONE DOT LEADER|#TWO DOT LEADER|#HORIZONTAL ELLIPSIS|$YPHENATION POINT|#LINE SEPARATOR|#PARAGRAPH SEPARATOR|#LEFT-TO-RIGHT EMBEDDING|#RIGHT-TO-LEFT EMBEDDING|#POP DIRECTIONAL FORMATTING|#LEFT-TO-RIGHT OVERRIDE|#RIGHT-TO-LEFT OVERRIDE|#NARROW NO-BREAK SPACE|#PER MILLE SIGN|'TEN THOUSAND SIGN|$RIME|#DOUBLE PRIME|#TRIPLE PRIME|#REVERSED PRIME|,DOUBLE PRIME|,TRIPLE PRIME|#CARET|#SINGLE LEFT-POINTING ANGLE QUOTATION MARK|*RIGHT-POINTING ANGLE QUOTATION MARK|#REFERENCE MARK|#DOUBLE EXCLAMATION MARK|#INTERROBANG|#OVERLINE|#UNDERTIE|#CHARACTER TIE|$ARET INSERTION POINT|#ASTERISM|#HYPHEN BULLET|#FRACTION SLASH|#LEFT SQUARE BRACKET WITH QUILL|#RIGHT SQUARE BRACKET WITH QUILL|#DOUBLE QUESTION MARK|#QUESTION EXCLAMATION MARK|#EXCLAMATION QUESTION MARK|#TIRONIAN SIGN ET|#REVERSED PILCROW SIGN|#BLACK LEFTWARDS BULLET|)RIGHTWARDS BULLET|#LOW ASTERISK|#REVERSED SEMICOLON|#CLOSE UP|#TWO ASTERISKS ALIGNED VERTICALLY|#COMMERCIAL MINUS SIGN|#SWUNG DASH|#INVERTED UNDERTIE|#FLOWER PUNCTUATION MARK|#THREE DOT PUNCTUATION|#QUADRUPLE PRIME|#FOUR DOT PUNCTUATION|$IVE DOT PUNCTUATION|#TWO DOT PUNCTUATION|#FOUR DOT MARK|#DOTTED CROSS|#TRICOLON|#VERTICAL FOUR DOTS|#MEDIUM MATHEMATICAL SPACE|#WORD JOINER|#FUNCTION APPLICATION|#INVISIBLE TIMES|-SEPARATOR|-PLUS|#LEFT-TO-RIGHT ISOLATE|#RIGHT-TO-LEFT ISOLATE|#FIRST STRONG ISOLATE|#POP DIRECTIONAL ISOLATE|#INHIBIT SYMMETRIC SWAPPING|#ACTIVATE SYMMETRIC SWAPPING|#INHIBIT ARABIC FORM SHAPING|#ACTIVATE ARABIC FORM SHAPING|#NATIONAL DIGIT SHAPES|$OMINAL DIGIT SHAPES|#SUPERSCRIPT ZERO|/LATIN SMALL LETTER I|/FOUR|0IVE|/SIX|0EVEN|/EIGHT|/NINE|/PLUS SIGN|/MINUS|/EQUALS SIGN|/LEFT PARENTHESIS|/RIGHT PARENTHESIS|/LATIN SMALL LETTER N|%BSCRIPT ZERO|-ONE|-TWO|.HREE|-FOUR|.IVE|-SIX|.EVEN|-EIGHT|-NINE|-PLUS SIGN|-MINUS|-EQUALS SIGN|-LEFT PARENTHESIS|-RIGHT PARENTHESIS|#MODIFIER LETTER HIGH AND LOW VERTICAL LINE|#LATIN SUBSCRIPT SMALL LETTER A|@E|@O|@X|@SCHWA|@H|@K|@L|@M|@N|@P|@S|@T|@W|@Y|@Z|#EURO-CURRENCY SIGN|#COLON SIGN|$RUZEIRO SIGN|#FRENCH FRANC SIGN|#LIRA SIGN|#MILL SIGN|#NAIRA SIGN|#PESETA SIGN|#RUPEE SIGN|#WON SIGN|#NEW SHEQEL SIGN|#DONG SIGN|#EURO SIGN|#KIP SIGN|#TUGRIK SIGN|#DRACHMA SIGN|#GERMAN PENNY SIGN|#PESO SIGN|#GUARANI SIGN|#AUSTRAL SIGN|#HRYVNIA SIGN|#CEDI SIGN|#LIVRE TOURNOIS SIGN|#SPESMILO SIGN|#TENGE SIGN|#INDIAN RUPEE SIGN|#TURKISH LIRA SIGN|#NORDIC MARK SIGN|#MANAT SIGN|#RUBLE SIGN|#LARI SIGN|#BITCOIN SIGN|#SOM SIGN|$AUDI RIYAL SIGN|#RUFIYAA SIGN|#UAE DIRHAM SIGN|#OMANI RIAL SIGN|#COMBINING LEFT HARPOON ABOVE|-RIGHT HARPOON ABOVE|-LONG VERTICAL LINE OVERLAY|-SHORT VERTICAL LINE OVERLAY|-ANTICLOCKWISE ARROW ABOVE|-CLOCKWISE ARROW ABOVE|-LEFT ARROW ABOVE|-RIGHT ARROW ABOVE|/NG OVERLAY|-CLOCKWISE RING OVERLAY|-ANTICLOCKWISE RING OVERLAY|-THREE DOTS ABOVE|-FOUR DOTS ABOVE|-ENCLOSING CIRCLE|7SQUARE|7DIAMOND|7CIRCLE BACKSLASH|-LEFT RIGHT ARROW ABOVE|-ENCLOSING SCREEN|7KEYCAP|7UPWARD POINTING TRIANGLE|-REVERSE SOLIDUS OVERLAY|-DOUBLE VERTICAL STROKE OVERLAY|-ANNUITY SYMBOL|-TRIPLE UNDERDOT|-WIDE BRIDGE ABOVE|-LEFTWARDS ARROW OVERLAY|.ONG DOUBLE SOLIDUS OVERLAY|-RIGHTWARDS HARPOON WITH BARB DOWNWARDS|-LEFTWARDS HARPOON WITH BARB DOWNWARDS|1 ARROW BELOW|-RIGHT ARROW BELOW|-ASTERISK ABOVE|#ACCOUNT OF|$DDRESSED TO THE SUBJECT|#DOUBLE-STRUCK CAPITAL C|$EGREE CELSIUS|#CENTRE LINE SYMBOL|$ARE OF|%DA UNA|#EULER CONSTANT|#SCRUPLE|#DEGREE FAHRENHEIT|#SCRIPT SMALL G|*CAPITAL H|#BLACK-LETTER CAPITAL H|#DOUBLE-STRUCK CAPITAL H|#PLANCK CONSTANT|2 OVER TWO PI|#SCRIPT CAPITAL I|#BLACK-LETTER CAPITAL I|#SCRIPT CAPITAL L|*SMALL L|#L B BAR SYMBOL|#DOUBLE-STRUCK CAPITAL N|#NUMERO SIGN|#SOUND RECORDING COPYRIGHT|$CRIPT CAPITAL P|#DOUBLE-STRUCK CAPITAL P|9Q|#SCRIPT CAPITAL R|#BLACK-LETTER CAPITAL R|#DOUBLE-STRUCK CAPITAL R|#PRESCRIPTION TAKE|#RESPONSE|#SERVICE MARK|#TELEPHONE SIGN|$RADE MARK SIGN|#VERSICLE|#DOUBLE-STRUCK CAPITAL Z|#OUNCE SIGN|$HM SIGN|#INVERTED OHM SIGN|#BLACK-LETTER CAPITAL Z|#TURNED GREEK SMALL LETTER IOTA|#KELVIN SIGN|#ANGSTROM SIGN|#SCRIPT CAPITAL B|#BLACK-LETTER CAPITAL C|#ESTIMATED SYMBOL|#SCRIPT SMALL E|*CAPITAL E|2F|#TURNED CAPITAL F|#SCRIPT CAPITAL M|*SMALL O|#ALEF SYMBOL|#BET SYMBOL|#GIMEL SYMBOL|#DALET SYMBOL|#INFORMATION SOURCE|#ROTATED CAPITAL Q|#FACSIMILE SIGN|#DOUBLE-STRUCK SMALL PI|7GAMMA|1CAPITAL GAMMA|9PI|1N-ARY SUMMATION|#TURNED SANS-SERIF CAPITAL G|=L|#REVERSED SANS-SERIF CAPITAL L|#TURNED SANS-SERIF CAPITAL Y|#DOUBLE-STRUCK ITALIC CAPITAL D|8SMALL D|>E|>I|>J|#PROPERTY LINE|#TURNED AMPERSAND|#PER SIGN|#AKTIESELSKAB|#TURNED SMALL F|#SYMBOL FOR SAMARITAN SOURCE|#VULGAR FRACTION ONE SEVENTH|7NINTH|7TENTH|8HIRD|3TWO THIRDS|3ONE FIFTH|3TWO FIFTHS|4HREE FIFTHS|3FOUR FIFTHS|3ONE SIXTH|3FIVE SIXTHS|3ONE EIGHTH|3THREE EIGHTHS|3FIVE EIGHTHS|3SEVEN EIGHTHS|#FRACTION NUMERATOR ONE|#ROMAN NUMERAL ONE|1TWO|2HREE|1FOUR|2IVE|1SIX|2EVEN|1EIGHT|1NINE|1TEN|1ELEVEN|1TWELVE|1FIFTY|1ONE HUNDRED|1FIVE HUNDRED|1ONE THOUSAND|#SMALL ROMAN NUMERAL ONE|7TWO|8HREE|7FOUR|8IVE|7SIX|8EVEN|7EIGHT|7NINE|7TEN|7ELEVEN|7TWELVE|7FIFTY|7ONE HUNDRED|7FIVE HUNDRED|7ONE THOUSAND|#ROMAN NUMERAL ONE THOUSAND C D|1FIVE THOUSAND|1TEN THOUSAND|1REVERSED ONE HUNDRED|#LATIN SMALL LETTER REVERSED C|#ROMAN NUMERAL SIX LATE FORM|1FIFTY EARLY FORM|7THOUSAND|1ONE HUNDRED THOUSAND|#VULGAR FRACTION ZERO THIRDS|#TURNED DIGIT TWO|1HREE|#LEFTWARDS ARROW|#UPWARDS ARROW|#RIGHTWARDS ARROW|#DOWNWARDS ARROW|#LEFT RIGHT ARROW|#UP DOWN ARROW|#NORTH WEST ARROW|)EAST ARROW|#SOUTH EAST ARROW|)WEST ARROW|#LEFTWARDS ARROW WITH STROKE|#RIGHTWARDS ARROW WITH STROKE|#LEFTWARDS WAVE ARROW|#RIGHTWARDS WAVE ARROW|#LEFTWARDS TWO HEADED ARROW|#UPWARDS TWO HEADED ARROW|#RIGHTWARDS TWO HEADED ARROW|#DOWNWARDS TWO HEADED ARROW|#LEFTWARDS ARROW WITH TAIL|#RIGHTWARDS ARROW WITH TAIL|#LEFTWARDS ARROW FROM BAR|#UPWARDS ARROW FROM BAR|#RIGHTWARDS ARROW FROM BAR|#DOWNWARDS ARROW FROM BAR|#UP DOWN ARROW WITH BASE|#LEFTWARDS ARROW WITH HOOK|#RIGHTWARDS ARROW WITH HOOK|#LEFTWARDS ARROW WITH LOOP|#RIGHTWARDS ARROW WITH LOOP|#LEFT RIGHT WAVE ARROW|.ARROW WITH STROKE|#DOWNWARDS ZIGZAG ARROW|#UPWARDS ARROW WITH TIP LEFTWARDS|:RIGHTWARDS|#DOWNWARDS ARROW WITH TIP LEFTWARDS|<RIGHTWARDS|#RIGHTWARDS ARROW WITH CORNER DOWNWARDS|#DOWNWARDS ARROW WITH CORNER LEFTWARDS|#ANTICLOCKWISE TOP SEMICIRCLE ARROW|#CLOCKWISE TOP SEMICIRCLE ARROW|#NORTH WEST ARROW TO LONG BAR|#LEFTWARDS ARROW TO BAR OVER RIGHTWARDS ARROW TO BAR|#ANTICLOCKWISE OPEN CIRCLE ARROW|#CLOCKWISE OPEN CIRCLE ARROW|#LEFTWARDS HARPOON WITH BARB UPWARDS|?DOWNWARDS|#UPWARDS HARPOON WITH BARB RIGHTWARDS|=LEFTWARDS|#RIGHTWARDS HARPOON WITH BARB UPWARDS|@DOWNWARDS|#DOWNWARDS HARPOON WITH BARB RIGHTWARDS|?LEFTWARDS|#RIGHTWARDS ARROW OVER LEFTWARDS ARROW|#UPWARDS ARROW LEFTWARDS OF DOWNWARDS ARROW|#LEFTWARDS ARROW OVER RIGHTWARDS ARROW|-PAIRED ARROWS|#UPWARDS PAIRED ARROWS|#RIGHTWARDS PAIRED ARROWS|#DOWNWARDS PAIRED ARROWS|#LEFTWARDS HARPOON OVER RIGHTWARDS HARPOON|#RIGHTWARDS HARPOON OVER LEFTWARDS HARPOON|#LEFTWARDS DOUBLE ARROW WITH STROKE|' RIGHT DOUBLE ARROW WITH STROKE|#RIGHTWARDS DOUBLE ARROW WITH STROKE|#LEFTWARDS DOUBLE ARROW|#UPWARDS DOUBLE ARROW|#RIGHTWARDS DOUBLE ARROW|#DOWNWARDS DOUBLE ARROW|#LEFT RIGHT DOUBLE ARROW|#UP DOWN DOUBLE ARROW|#NORTH WEST DOUBLE ARROW|)EAST DOUBLE ARROW|#SOUTH EAST DOUBLE ARROW|)WEST DOUBLE ARROW|#LEFTWARDS TRIPLE ARROW|#RIGHTWARDS TRIPLE ARROW|#LEFTWARDS SQUIGGLE ARROW|#RIGHTWARDS SQUIGGLE ARROW|#UPWARDS ARROW WITH DOUBLE STROKE|#DOWNWARDS ARROW WITH DOUBLE STROKE|#LEFTWARDS DASHED ARROW|#UPWARDS DASHED ARROW|#RIGHTWARDS DASHED ARROW|#DOWNWARDS DASHED ARROW|#LEFTWARDS ARROW TO BAR|#RIGHTWARDS ARROW TO BAR|#LEFTWARDS WHITE ARROW|#UPWARDS WHITE ARROW|#RIGHTWARDS WHITE ARROW|#DOWNWARDS WHITE ARROW|#UPWARDS WHITE ARROW FROM BAR|7ON PEDESTAL|B WITH HORIZONTAL BAR|HVERTICAL BAR|1DOUBLE ARROW|= ON PEDESTAL|#RIGHTWARDS WHITE ARROW FROM WALL|#NORTH WEST ARROW TO CORNER|#SOUTH EAST ARROW TO CORNER|#UP DOWN WHITE ARROW|#RIGHT ARROW WITH SMALL CIRCLE|#DOWNWARDS ARROW LEFTWARDS OF UPWARDS ARROW|#THREE RIGHTWARDS ARROWS|#LEFTWARDS ARROW WITH VERTICAL STROKE|#RIGHTWARDS ARROW WITH VERTICAL STROKE|#LEFT RIGHT ARROW WITH VERTICAL STROKE|'WARDS ARROW WITH DOUBLE VERTICAL STROKE|#RIGHTWARDS ARROW WITH DOUBLE VERTICAL STROKE|#LEFT RIGHT ARROW WITH DOUBLE VERTICAL STROKE|'WARDS OPEN-HEADED ARROW|#RIGHTWARDS OPEN-HEADED ARROW|#LEFT RIGHT OPEN-HEADED ARROW|#FOR ALL|#COMPLEMENT|#PARTIAL DIFFERENTIAL|#THERE EXISTS|)DOES NOT EXIST|#EMPTY SET|#INCREMENT|#NABLA|#ELEMENT OF|#NOT AN ELEMENT OF|#SMALL ELEMENT OF|#CONTAINS AS MEMBER|#DOES NOT CONTAIN AS MEMBER|#SMALL CONTAINS AS MEMBER|#END OF PROOF|#N-ARY PRODUCT|)COPRODUCT|)SUMMATION|#MINUS SIGN|(-OR-PLUS SIGN|#DOT PLUS|$IVISION SLASH|#SET MINUS|#ASTERISK OPERATOR|#RING OPERATOR|#BULLET OPERATOR|#SQUARE ROOT|#CUBE ROOT|#FOURTH ROOT|#PROPORTIONAL TO|#INFINITY|#RIGHT ANGLE|#ANGLE|#MEASURED ANGLE|#SPHERICAL ANGLE|#DIVIDES|$OES NOT DIVIDE|#PARALLEL TO|#NOT PARALLEL TO|#LOGICAL AND|+OR|#INTERSECTION|#UNION|#INTEGRAL|#DOUBLE INTEGRAL|#TRIPLE INTEGRAL|#CONTOUR INTEGRAL|#SURFACE INTEGRAL|#VOLUME INTEGRAL|#CLOCKWISE INTEGRAL|-CONTOUR INTEGRAL|#ANTICLOCKWISE CONTOUR INTEGRAL|#THEREFORE|#BECAUSE|#RATIO|#PROPORTION|#DOT MINUS|#EXCESS|#GEOMETRIC PROPORTION|#HOMOTHETIC|#TILDE OPERATOR|#REVERSED TILDE|#INVERTED LAZY S|#SINE WAVE|#WREATH PRODUCT|#NOT TILDE|#MINUS TILDE|#ASYMPTOTICALLY EQUAL TO|#NOT ASYMPTOTICALLY EQUAL TO|#APPROXIMATELY EQUAL TO|1BUT NOT ACTUALLY EQUAL TO|#NEITHER APPROXIMATELY NOR ACTUALLY EQUAL TO|#ALMOST EQUAL TO|#NOT ALMOST EQUAL TO|#ALMOST EQUAL OR EQUAL TO|#TRIPLE TILDE|#ALL EQUAL TO|#EQUIVALENT TO|#GEOMETRICALLY EQUIVALENT TO|#DIFFERENCE BETWEEN|#APPROACHES THE LIMIT|#GEOMETRICALLY EQUAL TO|#APPROXIMATELY EQUAL TO OR THE IMAGE OF|#IMAGE OF OR APPROXIMATELY EQUAL TO|#COLON EQUALS|#EQUALS COLON|#RING IN EQUAL TO|(EQUAL TO|#CORRESPONDS TO|#ESTIMATES|$QUIANGULAR TO|#STAR EQUALS|#DELTA EQUAL TO|#EQUAL TO BY DEFINITION|#MEASURED BY|#QUESTIONED EQUAL TO|#NOT EQUAL TO|#IDENTICAL TO|#NOT IDENTICAL TO|#STRICTLY EQUIVALENT TO|#LESS-THAN OR EQUAL TO|#GREATER-THAN OR EQUAL TO|#LESS-THAN OVER EQUAL TO|#GREATER-THAN OVER EQUAL TO|#LESS-THAN BUT NOT EQUAL TO|#GREATER-THAN BUT NOT EQUAL TO|#MUCH LESS-THAN|(GREATER-THAN|#BETWEEN|#NOT EQUIVALENT TO|'LESS-THAN|'GREATER-THAN|$EITHER LESS-THAN NOR EQUAL TO|+GREATER-THAN NOR EQUAL TO|#LESS-THAN OR EQUIVALENT TO|#GREATER-THAN OR EQUIVALENT TO|#NEITHER LESS-THAN NOR EQUIVALENT TO|+GREATER-THAN NOR EQUIVALENT TO|#LESS-THAN OR GREATER-THAN|#GREATER-THAN OR LESS-THAN|#NEITHER LESS-THAN NOR GREATER-THAN|+GREATER-THAN NOR LESS-THAN|#PRECEDES|#SUCCEEDS|#PRECEDES OR EQUAL TO|#SUCCEEDS OR EQUAL TO|#PRECEDES OR EQUIVALENT TO|#SUCCEEDS OR EQUIVALENT TO|#DOES NOT PRECEDE|,SUCCEED|#SUBSET OF|%PERSET OF|#NOT A SUBSET OF|+PERSET OF|#SUBSET OF OR EQUAL TO|%PERSET OF OR EQUAL TO|#NEITHER A SUBSET OF NOR EQUAL TO|/PERSET OF NOR EQUAL TO|#SUBSET OF WITH NOT EQUAL TO|%PERSET OF WITH NOT EQUAL TO|#MULTISET|+ MULTIPLICATION|,UNION|#SQUARE IMAGE OF|*ORIGINAL OF|*IMAGE OF OR EQUAL TO|*ORIGINAL OF OR EQUAL TO|*CAP|+UP|#CIRCLED PLUS|+MINUS|+TIMES|+DIVISION SLASH|,OT OPERATOR|+RING OPERATOR|+ASTERISK OPERATOR|+EQUALS|+DASH|#SQUARED PLUS|+MINUS|+TIMES|+DOT OPERATOR|#RIGHT TACK|#LEFT TACK|#DOWN TACK|#UP TACK|#ASSERTION|#MODELS|#TRUE|#FORCES|#TRIPLE VERTICAL BAR RIGHT TURNSTILE|#DOUBLE VERTICAL BAR DOUBLE RIGHT TURNSTILE|%ES NOT PROVE|#NOT TRUE|#DOES NOT FORCE|#NEGATED DOUBLE VERTICAL BAR DOUBLE RIGHT TURNSTILE|#PRECEDES UNDER RELATION|#SUCCEEDS UNDER RELATION|#NORMAL SUBGROUP OF|#CONTAINS AS NORMAL SUBGROUP|#NORMAL SUBGROUP OF OR EQUAL TO|#CONTAINS AS NORMAL SUBGROUP OR EQUAL TO|#ORIGINAL OF|#IMAGE OF|#MULTIMAP|#HERMITIAN CONJUGATE MATRIX|#INTERCALATE|#XOR|#NAND|$OR|#RIGHT ANGLE WITH ARC|)TRIANGLE|#N-ARY LOGICAL AND|1OR|)INTERSECTION|)UNION|#DIAMOND OPERATOR|$OT OPERATOR|#STAR OPERATOR|#DIVISION TIMES|#BOWTIE|#LEFT NORMAL FACTOR SEMIDIRECT PRODUCT|#RIGHT NORMAL FACTOR SEMIDIRECT PRODUCT|#LEFT SEMIDIRECT PRODUCT|#RIGHT SEMIDIRECT PRODUCT|$EVERSED TILDE EQUALS|#CURLY LOGICAL OR|1AND|#DOUBLE SUBSET|,PERSET|*INTERSECTION|*UNION|#PITCHFORK|#EQUAL AND PARALLEL TO|#LESS-THAN WITH DOT|#GREATER-THAN WITH DOT|#VERY MUCH LESS-THAN|-GREATER-THAN|#LESS-THAN EQUAL TO OR GREATER-THAN|#GREATER-THAN EQUAL TO OR LESS-THAN|#EQUAL TO OR LESS-THAN|/GREATER-THAN|/PRECEDES|/SUCCEEDS|#DOES NOT PRECEDE OR EQUAL|,SUCCEED OR EQUAL|#NOT SQUARE IMAGE OF OR EQUAL TO|.ORIGINAL OF OR EQUAL TO|#SQUARE IMAGE OF OR NOT EQUAL TO|*ORIGINAL OF OR NOT EQUAL TO|#LESS-THAN BUT NOT EQUIVALENT TO|#GREATER-THAN BUT NOT EQUIVALENT TO|#PRECEDES BUT NOT EQUIVALENT TO|#SUCCEEDS BUT NOT EQUIVALENT TO|#NOT NORMAL SUBGROUP OF|#DOES NOT CONTAIN AS NORMAL SUBGROUP|#NOT NORMAL SUBGROUP OF OR EQUAL TO|#DOES NOT CONTAIN AS NORMAL SUBGROUP OR EQUAL|#VERTICAL ELLIPSIS|#MIDLINE HORIZONTAL ELLIPSIS|#UP RIGHT DIAGONAL ELLIPSIS|#DOWN RIGHT DIAGONAL ELLIPSIS|#ELEMENT OF WITH LONG HORIZONTAL STROKE|3VERTICAL BAR AT END OF HORIZONTAL STROKE|#SMALL ELEMENT OF WITH VERTICAL BAR AT END OF HORIZONTAL STROKE|#ELEMENT OF WITH DOT ABOVE|3OVERBAR|#SMALL ELEMENT OF WITH OVERBAR|#ELEMENT OF WITH UNDERBAR|3TWO HORIZONTAL STROKES|#CONTAINS WITH LONG HORIZONTAL STROKE|1VERTICAL BAR AT END OF HORIZONTAL STROKE|#SMALL CONTAINS WITH VERTICAL BAR AT END OF HORIZONTAL STROKE|#CONTAINS WITH OVERBAR|#SMALL CONTAINS WITH OVERBAR|#Z NOTATION BAG MEMBERSHIP|#DIAMETER SIGN|#ELECTRIC ARROW|#HOUSE|#UP ARROWHEAD|#DOWN ARROWHEAD|#PROJECTIVE|$ERSPECTIVE|#WAVY LINE|#LEFT CEILING|#RIGHT CEILING|#LEFT FLOOR|#RIGHT FLOOR|#BOTTOM RIGHT CROP|*LEFT CROP|#TOP RIGHT CROP|'LEFT CROP|#REVERSED NOT SIGN|#SQUARE LOZENGE|#ARC|#SEGMENT|%CTOR|#TELEPHONE RECORDER|#POSITION INDICATOR|#VIEWDATA SQUARE|#PLACE OF INTEREST SIGN|#TURNED NOT SIGN|#WATCH|#HOURGLASS|#TOP LEFT CORNER|'RIGHT CORNER|#BOTTOM LEFT CORNER|*RIGHT CORNER|#TOP HALF INTEGRAL|#BOTTOM HALF INTEGRAL|#FROWN|#SMILE|#UP ARROWHEAD BETWEEN TWO HORIZONTAL BARS|#OPTION KEY|#ERASE TO THE RIGHT|#X IN A RECTANGLE BOX|#KEYBOARD|#LEFT-POINTING ANGLE BRACKET|#RIGHT-POINTING ANGLE BRACKET|#ERASE TO THE LEFT|#BENZENE RING|#CYLINDRICITY|#ALL AROUND-PROFILE|#SYMMETRY|#TOTAL RUNOUT|#DIMENSION ORIGIN|#CONICAL TAPER|#SLOPE|#COUNTERBORE|*SINK|#APL FUNCTIONAL SYMBOL I-BEAM|9SQUISH QUAD|9QUAD EQUAL|>DIVIDE|@AMOND|>JOT|>CIRCLE|9CIRCLE STILE|@JOT|9SLASH BAR|9BACKSLASH BAR|9QUAD SLASH|>BACKSLASH|>LESS-THAN|>GREATER-THAN|9LEFTWARDS VANE|9RIGHTWARDS VANE|9QUAD LEFTWARDS ARROW|>RIGHTWARDS ARROW|9CIRCLE BACKSLASH|9DOWN TACK UNDERBAR|:ELTA STILE|9QUAD DOWN CARET|?ELTA|9DOWN TACK JOT|9UPWARDS VANE|9QUAD UPWARDS ARROW|9UP TACK OVERBAR|9DEL STILE|9QUAD UP CARET|>DEL|9UP TACK JOT|9DOWNWARDS VANE|9QUAD DOWNWARDS ARROW|;OTE UNDERBAR|9DELTA UNDERBAR|:IAMOND UNDERBAR|9JOT UNDERBAR|9CIRCLE UNDERBAR|9UP SHOE JOT|9QUOTE QUAD|9CIRCLE STAR|9QUAD COLON|9UP TACK DIAERESIS|9DEL DIAERESIS|9STAR DIAERESIS|9JOT DIAERESIS|9CIRCLE DIAERESIS|9DOWN SHOE STILE|9LEFT SHOE STILE|9TILDE DIAERESIS|9GREATER-THAN DIAERESIS|9COMMA BAR|9DEL TILDE|9ZILDE|9STILE TILDE|:EMICOLON UNDERBAR|9QUAD NOT EQUAL|>QUESTION|9DOWN CARET TILDE|9UP CARET TILDE|9IOTA|9RHO|9OMEGA|9ALPHA UNDERBAR|9EPSILON UNDERBAR|9IOTA UNDERBAR|9OMEGA UNDERBAR|9ALPHA|#NOT CHECK MARK|#RIGHT ANGLE WITH DOWNWARDS ZIGZAG ARROW|#SHOULDERED OPEN BOX|#BELL SYMBOL|#VERTICAL LINE WITH MIDDLE DOT|#INSERTION SYMBOL|#CONTINUOUS UNDERLINE SYMBOL|#DISCONTINUOUS UNDERLINE SYMBOL|#EMPHASIS SYMBOL|#COMPOSITION SYMBOL|#WHITE SQUARE WITH CENTRE VERTICAL LINE|#ENTER SYMBOL|#ALTERNATIVE KEY SYMBOL|#HELM SYMBOL|#CIRCLED HORIZONTAL BAR WITH NOTCH|+TRIANGLE DOWN|#BROKEN CIRCLE WITH NORTHWEST ARROW|#UNDO SYMBOL|#MONOSTABLE SYMBOL|#HYSTERESIS SYMBOL|#OPEN-CIRCUIT-OUTPUT H-TYPE SYMBOL|7L-TYPE SYMBOL|#PASSIVE-PULL-DOWN-OUTPUT SYMBOL|0UP-OUTPUT SYMBOL|#DIRECT CURRENT SYMBOL FORM TWO|#SOFTWARE-FUNCTION SYMBOL|#APL FUNCTIONAL SYMBOL QUAD|#DECIMAL SEPARATOR KEY SYMBOL|#PREVIOUS PAGE|#NEXT PAGE|#PRINT SCREEN SYMBOL|#CLEAR SCREEN SYMBOL|#LEFT PARENTHESIS UPPER HOOK|4EXTENSION|4LOWER HOOK|#RIGHT PARENTHESIS UPPER HOOK|5EXTENSION|5LOWER HOOK|#LEFT SQUARE BRACKET UPPER CORNER|7EXTENSION|7LOWER CORNER|#RIGHT SQUARE BRACKET UPPER CORNER|8EXTENSION|8LOWER CORNER|#LEFT CURLY BRACKET UPPER HOOK|6MIDDLE PIECE|6LOWER HOOK|#CURLY BRACKET EXTENSION|#RIGHT CURLY BRACKET UPPER HOOK|7MIDDLE PIECE|7LOWER HOOK|#INTEGRAL EXTENSION|#HORIZONTAL LINE EXTENSION|#UPPER LEFT OR LOWER RIGHT CURLY BRACKET SECTION|)RIGHT OR LOWER LEFT CURLY BRACKET SECTION|#SUMMATION TOP|-BOTTOM|#TOP SQUARE BRACKET|#BOTTOM SQUARE BRACKET|8 OVER TOP SQUARE BRACKET|#RADICAL SYMBOL BOTTOM|#LEFT VERTICAL BOX LINE|#RIGHT VERTICAL BOX LINE|#HORIZONTAL SCAN LINE-1|83|87|89|#DENTISTRY SYMBOL LIGHT VERTICAL AND TOP RIGHT|GBOTTOM RIGHT|CWITH CIRCLE|:DOWN AND HORIZONTAL WITH CIRCLE|:UP AND HORIZONTAL WITH CIRCLE|:VERTICAL WITH TRIANGLE|:DOWN AND HORIZONTAL WITH TRIANGLE|:UP AND HORIZONTAL WITH TRIANGLE|:VERTICAL AND WAVE|:DOWN AND HORIZONTAL WITH WAVE|:UP AND HORIZONTAL WITH WAVE|:DOWN AND HORIZONTAL|:UP AND HORIZONTAL|:VERTICAL AND TOP LEFT|GBOTTOM LEFT|#SQUARE FOOT|#RETURN SYMBOL|#EJECT SYMBOL|#VERTICAL LINE EXTENSION|#METRICAL BREVE|,LONG OVER SHORT|,SHORT OVER LONG|,LONG OVER TWO SHORTS|,TWO SHORTS OVER LONG|7JOINED|-RISEME|-ETRASEME|,PENTASEME|#EARTH GROUND|#FUSE|#TOP PARENTHESIS|#BOTTOM PARENTHESIS|#TOP CURLY BRACKET|#BOTTOM CURLY BRACKET|#TOP TORTOISE SHELL BRACKET|#BOTTOM TORTOISE SHELL BRACKET|#WHITE TRAPEZIUM|#BENZENE RING WITH CIRCLE|#STRAIGHTNESS|#FLATNESS|#AC CURRENT|#ELECTRICAL INTERSECTION|#DECIMAL EXPONENT SYMBOL|#BLACK RIGHT-POINTING DOUBLE TRIANGLE|)LEFT-POINTING DOUBLE TRIANGLE|)UP-POINTING DOUBLE TRIANGLE|)DOWN-POINTING DOUBLE TRIANGLE|)RIGHT-POINTING DOUBLE TRIANGLE WITH VERTICAL BAR|)LEFT-POINTING DOUBLE TRIANGLE WITH VERTICAL BAR|)RIGHT-POINTING TRIANGLE WITH DOUBLE VERTICAL BAR|#ALARM CLOCK|#STOPWATCH|#TIMER CLOCK|#HOURGLASS WITH FLOWING SAND|#BLACK MEDIUM LEFT-POINTING TRIANGLE|0RIGHT-POINTING TRIANGLE|0UP-POINTING TRIANGLE|0DOWN-POINTING TRIANGLE|#DOUBLE VERTICAL BAR|#BLACK SQUARE FOR STOP|)CIRCLE FOR RECORD|#POWER SYMBOL|)ON-OFF SYMBOL|+ SYMBOL|)SLEEP SYMBOL|#OBSERVER EYE SYMBOL|#SYMBOL FOR NULL|.START OF HEADING|7TEXT|.END OF TEXT|6RANSMISSION|0QUIRY|.ACKNOWLEDGE|.BELL|/ACKSPACE|.HORIZONTAL TABULATION|.LINE FEED|.VERTICAL TABULATION|.FORM FEED|.CARRIAGE RETURN|.SHIFT OUT|4IN|.DATA LINK ESCAPE|/EVICE CONTROL ONE|=TWO|>HREE|=FOUR|.NEGATIVE ACKNOWLEDGE|.SYNCHRONOUS IDLE|.END OF TRANSMISSION BLOCK|.CANCEL|.END OF MEDIUM|.SUBSTITUTE|.ESCAPE|.FILE SEPARATOR|.GROUP SEPARATOR|.RECORD SEPARATOR|.UNIT SEPARATOR|.SPACE|.DELETE|#BLANK SYMBOL|#OPEN BOX|#SYMBOL FOR NEWLINE|.DELETE FORM TWO|.SUBSTITUTE FORM TWO|.DELETE SQUARE CHECKER BOARD FORM|5RECTANGULAR CHECKER BOARD FORM|5MEDIUM SHADE FORM|#OCR HOOK|'CHAIR|'FORK|'INVERTED FORK|'BELT BUCKLE|(OW TIE|(RANCH BANK IDENTIFICATION|'AMOUNT OF CHECK|'DASH|'CUSTOMER ACCOUNT NUMBER|'DOUBLE BACKSLASH|#CIRCLED DIGIT ONE|1TWO|2HREE|1FOUR|2IVE|1SIX|2EVEN|1EIGHT|1NINE|+NUMBER TEN|2ELEVEN|2TWELVE|3HIRTEEN|2FOURTEEN|3IFTEEN|2SIXTEEN|3EVENTEEN|2EIGHTEEN|2NINETEEN|2TWENTY|#PARENTHESIZED DIGIT ONE|7TWO|8HREE|7FOUR|8IVE|7SIX|8EVEN|7EIGHT|7NINE|1NUMBER TEN|8ELEVEN|8TWELVE|9HIRTEEN|8FOURTEEN|9IFTEEN|8SIXTEEN|9EVENTEEN|8EIGHTEEN|8NINETEEN|8TWENTY|#DIGIT ONE FULL STOP|)TWO FULL STOP|*HREE FULL STOP|)FOUR FULL STOP|*IVE FULL STOP|)SIX FULL STOP|*EVEN FULL STOP|)EIGHT FULL STOP|)NINE FULL STOP|#NUMBER TEN FULL STOP|*ELEVEN FULL STOP|*TWELVE FULL STOP|+HIRTEEN FULL STOP|*FOURTEEN FULL STOP|+IFTEEN FULL STOP|*SIXTEEN FULL STOP|+EVENTEEN FULL STOP|*EIGHTEEN FULL STOP|*NINETEEN FULL STOP|*TWENTY FULL STOP|#PARENTHESIZED LATIN SMALL LETTER A|DB|DC|DD|DE|DF|DG|DH|DI|DJ|DK|DL|DM|DN|DO|DP|DQ|DR|DS|DT|DU|DV|DW|DX|DY|DZ|#CIRCLED LATIN CAPITAL LETTER A|@B|@C|@D|@E|@F|@G|@H|@I|@J|@K|@L|@M|@N|@O|@P|@Q|@R|@S|@T|@U|@V|@W|@X|@Y|@Z|1SMALL LETTER A|>B|>C|>D|>E|>F|>G|>H|>I|>J|>K|>L|>M|>N|>O|>P|>Q|>R|>S|>T|>U|>V|>W|>X|>Y|>Z|+DIGIT ZERO|#NEGATIVE CIRCLED NUMBER ELEVEN|;TWELVE|<HIRTEEN|;FOURTEEN|<IFTEEN|;SIXTEEN|<EVENTEEN|;EIGHTEEN|;NINETEEN|;TWENTY|#DOUBLE CIRCLED DIGIT ONE|8TWO|9HREE|8FOUR|9IVE|8SIX|9EVEN|8EIGHT|8NINE|2NUMBER TEN|#NEGATIVE CIRCLED DIGIT ZERO|#BOX DRAWINGS LIGHT HORIZONTAL|0HEAVY HORIZONTAL|0LIGHT VERTICAL|0HEAVY VERTICAL|0LIGHT TRIPLE DASH HORIZONTAL|0HEAVY TRIPLE DASH HORIZONTAL|0LIGHT TRIPLE DASH VERTICAL|0HEAVY TRIPLE DASH VERTICAL|0LIGHT QUADRUPLE DASH HORIZONTAL|0HEAVY QUADRUPLE DASH HORIZONTAL|0LIGHT QUADRUPLE DASH VERTICAL|0HEAVY QUADRUPLE DASH VERTICAL|0LIGHT DOWN AND RIGHT|0DOWN LIGHT AND RIGHT HEAVY|5HEAVY AND RIGHT LIGHT|0HEAVY DOWN AND RIGHT|0LIGHT DOWN AND LEFT|0DOWN LIGHT AND LEFT HEAVY|5HEAVY AND LEFT LIGHT|0HEAVY DOWN AND LEFT|0LIGHT UP AND RIGHT|0UP LIGHT AND RIGHT HEAVY|3HEAVY AND RIGHT LIGHT|0HEAVY UP AND RIGHT|0LIGHT UP AND LEFT|0UP LIGHT AND LEFT HEAVY|3HEAVY AND LEFT LIGHT|0HEAVY UP AND LEFT|0LIGHT VERTICAL AND RIGHT|0VERTICAL LIGHT AND RIGHT HEAVY|0UP HEAVY AND RIGHT DOWN LIGHT|0DOWN HEAVY AND RIGHT UP LIGHT|0VERTICAL HEAVY AND RIGHT LIGHT|0DOWN LIGHT AND RIGHT UP HEAVY|0UP LIGHT AND RIGHT DOWN HEAVY|0HEAVY VERTICAL AND RIGHT|0LIGHT VERTICAL AND LEFT|0VERTICAL LIGHT AND LEFT HEAVY|0UP HEAVY AND LEFT DOWN LIGHT|0DOWN HEAVY AND LEFT UP LIGHT|0VERTICAL HEAVY AND LEFT LIGHT|0DOWN LIGHT AND LEFT UP HEAVY|0UP LIGHT AND LEFT DOWN HEAVY|0HEAVY VERTICAL AND LEFT|0LIGHT DOWN AND HORIZONTAL|1EFT HEAVY AND RIGHT DOWN LIGHT|0RIGHT HEAVY AND LEFT DOWN LIGHT|0DOWN LIGHT AND HORIZONTAL HEAVY|5HEAVY AND HORIZONTAL LIGHT|0RIGHT LIGHT AND LEFT DOWN HEAVY|0LEFT LIGHT AND RIGHT DOWN HEAVY|0HEAVY DOWN AND HORIZONTAL|0LIGHT UP AND HORIZONTAL|1EFT HEAVY AND RIGHT UP LIGHT|0RIGHT HEAVY AND LEFT UP LIGHT|0UP LIGHT AND HORIZONTAL HEAVY|3HEAVY AND HORIZONTAL LIGHT|0RIGHT LIGHT AND LEFT UP HEAVY|0LEFT LIGHT AND RIGHT UP HEAVY|0HEAVY UP AND HORIZONTAL|0LIGHT VERTICAL AND HORIZONTAL|1EFT HEAVY AND RIGHT VERTICAL LIGHT|0RIGHT HEAVY AND LEFT VERTICAL LIGHT|0VERTICAL LIGHT AND HORIZONTAL HEAVY|0UP HEAVY AND DOWN HORIZONTAL LIGHT|0DOWN HEAVY AND UP HORIZONTAL LIGHT|0VERTICAL HEAVY AND HORIZONTAL LIGHT|0LEFT UP HEAVY AND RIGHT DOWN LIGHT|0RIGHT UP HEAVY AND LEFT DOWN LIGHT|0LEFT DOWN HEAVY AND RIGHT UP LIGHT|0RIGHT DOWN HEAVY AND LEFT UP LIGHT|0DOWN LIGHT AND UP HORIZONTAL HEAVY|0UP LIGHT AND DOWN HORIZONTAL HEAVY|0RIGHT LIGHT AND LEFT VERTICAL HEAVY|0LEFT LIGHT AND RIGHT VERTICAL HEAVY|0HEAVY VERTICAL AND HORIZONTAL|0LIGHT DOUBLE DASH HORIZONTAL|0HEAVY DOUBLE DASH HORIZONTAL|0LIGHT DOUBLE DASH VERTICAL|0HEAVY DOUBLE DASH VERTICAL|0DOUBLE HORIZONTAL|7VERTICAL|2WN SINGLE AND RIGHT DOUBLE|5DOUBLE AND RIGHT SINGLE|2UBLE DOWN AND RIGHT|2WN SINGLE AND LEFT DOUBLE|5DOUBLE AND LEFT SINGLE|2UBLE DOWN AND LEFT|0UP SINGLE AND RIGHT DOUBLE|3DOUBLE AND RIGHT SINGLE|0DOUBLE UP AND RIGHT|0UP SINGLE AND LEFT DOUBLE|3DOUBLE AND LEFT SINGLE|0DOUBLE UP AND LEFT|0VERTICAL SINGLE AND RIGHT DOUBLE|9DOUBLE AND RIGHT SINGLE|0DOUBLE VERTICAL AND RIGHT|0VERTICAL SINGLE AND LEFT DOUBLE|9DOUBLE AND LEFT SINGLE|0DOUBLE VERTICAL AND LEFT|2WN SINGLE AND HORIZONTAL DOUBLE|5DOUBLE AND HORIZONTAL SINGLE|2UBLE DOWN AND HORIZONTAL|0UP SINGLE AND HORIZONTAL DOUBLE|3DOUBLE AND HORIZONTAL SINGLE|0DOUBLE UP AND HORIZONTAL|0VERTICAL SINGLE AND HORIZONTAL DOUBLE|9DOUBLE AND HORIZONTAL SINGLE|0DOUBLE VERTICAL AND HORIZONTAL|0LIGHT ARC DOWN AND RIGHT|CLEFT|:UP AND LEFT|ARIGHT|6DIAGONAL UPPER RIGHT TO LOWER LEFT|ELEFT TO LOWER RIGHT|?CROSS|6LEFT|6UP|6RIGHT|6DOWN|0HEAVY LEFT|6UP|6RIGHT|6DOWN|0LIGHT LEFT AND HEAVY RIGHT|6UP AND HEAVY DOWN|0HEAVY LEFT AND LIGHT RIGHT|6UP AND LIGHT DOWN|#UPPER HALF BLOCK|#LOWER ONE EIGHTH BLOCK|-QUARTER BLOCK|)THREE EIGHTHS BLOCK|)HALF BLOCK|)FIVE EIGHTHS BLOCK|)THREE QUARTERS BLOCK|)SEVEN EIGHTHS BLOCK|#FULL BLOCK|#LEFT SEVEN EIGHTHS BLOCK|(THREE QUARTERS BLOCK|(FIVE EIGHTHS BLOCK|(HALF BLOCK|(THREE EIGHTHS BLOCK|(ONE QUARTER BLOCK|,EIGHTH BLOCK|#RIGHT HALF BLOCK|#LIGHT SHADE|#MEDIUM SHADE|#DARK SHADE|#UPPER ONE EIGHTH BLOCK|#RIGHT ONE EIGHTH BLOCK|#QUADRANT LOWER LEFT|2RIGHT|,UPPER LEFT|6 AND LOWER LEFT AND LOWER RIGHT|ARIGHT|;UPPER RIGHT AND LOWER LEFT|QRIGHT|2RIGHT|7 AND LOWER LEFT|F AND LOWER RIGHT|#BLACK SQUARE|#WHITE SQUARE|/ WITH ROUNDED CORNERS|0CONTAINING BLACK SMALL SQUARE|#SQUARE WITH HORIZONTAL FILL|/VERTICAL FILL|/ORTHOGONAL CROSSHATCH FILL|/UPPER LEFT TO LOWER RIGHT FILL|5RIGHT TO LOWER LEFT FILL|/DIAGONAL CROSSHATCH FILL|#BLACK SMALL SQUARE|#WHITE SMALL SQUARE|#BLACK RECTANGLE|#WHITE RECTANGLE|#BLACK VERTICAL RECTANGLE|#WHITE VERTICAL RECTANGLE|#BLACK PARALLELOGRAM|#WHITE PARALLELOGRAM|#BLACK UP-POINTING TRIANGLE|#WHITE UP-POINTING TRIANGLE|#BLACK UP-POINTING SMALL TRIANGLE|#WHITE UP-POINTING SMALL TRIANGLE|#BLACK RIGHT-POINTING TRIANGLE|#WHITE RIGHT-POINTING TRIANGLE|#BLACK RIGHT-POINTING SMALL TRIANGLE|#WHITE RIGHT-POINTING SMALL TRIANGLE|#BLACK RIGHT-POINTING POINTER|#WHITE RIGHT-POINTING POINTER|#BLACK DOWN-POINTING TRIANGLE|#WHITE DOWN-POINTING TRIANGLE|#BLACK DOWN-POINTING SMALL TRIANGLE|#WHITE DOWN-POINTING SMALL TRIANGLE|#BLACK LEFT-POINTING TRIANGLE|#WHITE LEFT-POINTING TRIANGLE|#BLACK LEFT-POINTING SMALL TRIANGLE|#WHITE LEFT-POINTING SMALL TRIANGLE|#BLACK LEFT-POINTING POINTER|#WHITE LEFT-POINTING POINTER|#BLACK DIAMOND|#WHITE DIAMOND|0 CONTAINING BLACK SMALL DIAMOND|#FISHEYE|#LOZENGE|#WHITE CIRCLE|#DOTTED CIRCLE|#CIRCLE WITH VERTICAL FILL|#BULLSEYE|$LACK CIRCLE|#CIRCLE WITH LEFT HALF BLACK|/RIGHT HALF BLACK|/LOWER HALF BLACK|/UPPER HALF BLACK|5RIGHT QUADRANT BLACK|/ALL BUT UPPER LEFT QUADRANT BLACK|#LEFT HALF BLACK CIRCLE|#RIGHT HALF BLACK CIRCLE|#INVERSE BULLET|+WHITE CIRCLE|#UPPER HALF INVERSE WHITE CIRCLE|#LOWER HALF INVERSE WHITE CIRCLE|#UPPER LEFT QUADRANT CIRCULAR ARC|)RIGHT QUADRANT CIRCULAR ARC|#LOWER RIGHT QUADRANT CIRCULAR ARC|)LEFT QUADRANT CIRCULAR ARC|#UPPER HALF CIRCLE|#LOWER HALF CIRCLE|#BLACK LOWER RIGHT TRIANGLE|/LEFT TRIANGLE|)UPPER LEFT TRIANGLE|/RIGHT TRIANGLE|#WHITE BULLET|#SQUARE WITH LEFT HALF BLACK|/RIGHT HALF BLACK|/UPPER LEFT DIAGONAL HALF BLACK|/LOWER RIGHT DIAGONAL HALF BLACK|#WHITE SQUARE WITH VERTICAL BISECTING LINE|)UP-POINTING TRIANGLE WITH DOT|#UP-POINTING TRIANGLE WITH LEFT HALF BLACK|=RIGHT HALF BLACK|#LARGE CIRCLE|#WHITE SQUARE WITH UPPER LEFT QUADRANT|5LOWER LEFT QUADRANT|;RIGHT QUADRANT|5UPPER RIGHT QUADRANT|)CIRCLE WITH UPPER LEFT QUADRANT|5LOWER LEFT QUADRANT|;RIGHT QUADRANT|5UPPER RIGHT QUADRANT|#UPPER LEFT TRIANGLE|)RIGHT TRIANGLE|#LOWER LEFT TRIANGLE|#WHITE MEDIUM SQUARE|#BLACK MEDIUM SQUARE|#WHITE MEDIUM SMALL SQUARE|#BLACK MEDIUM SMALL SQUARE|#LOWER RIGHT TRIANGLE|#BLACK SUN WITH RAYS|#CLOUD|#UMBRELLA|#SNOWMAN|#COMET|#BLACK STAR|#WHITE STAR|#LIGHTNING|#THUNDERSTORM|#SUN|#ASCENDING NODE|#DESCENDING NODE|#CONJUNCTION|#OPPOSITION|#BLACK TELEPHONE|#WHITE TELEPHONE|#BALLOT BOX|- WITH CHECK|3X|#SALTIRE|#UMBRELLA WITH RAIN DROPS|#HOT BEVERAGE|#WHITE SHOGI PIECE|#BLACK SHOGI PIECE|#SHAMROCK|#REVERSED ROTATED FLORAL HEART BULLET|#BLACK LEFT POINTING INDEX|)RIGHT POINTING INDEX|#WHITE LEFT POINTING INDEX|)UP POINTING INDEX|)RIGHT POINTING INDEX|)DOWN POINTING INDEX|#SKULL AND CROSSBONES|#CAUTION SIGN|#RADIOACTIVE SIGN|#BIOHAZARD SIGN|#CADUCEUS|#ANKH|#ORTHODOX CROSS|#CHI RHO|$ROSS OF LORRAINE|,JERUSALEM|#STAR AND CRESCENT|#FARSI SYMBOL|#ADI SHAKTI|#HAMMER AND SICKLE|#PEACE SYMBOL|#YIN YANG|#TRIGRAM FOR HEAVEN|/LAKE|/FIRE|/THUNDER|/WIND|0ATER|/MOUNTAIN|/EARTH|#WHEEL OF DHARMA|%ITE FROWNING FACE|)SMILING FACE|#BLACK SMILING FACE|#WHITE SUN WITH RAYS|#FIRST QUARTER MOON|#LAST QUARTER MOON|#MERCURY|#FEMALE SIGN|#EARTH|#MALE SIGN|#JUPITER|#SATURN|#URANUS|#NEPTUNE|#PLUTO|#ARIES|#TAURUS|#GEMINI|#CANCER|#LEO|#VIRGO|#LIBRA|#SCORPIUS|$AGITTARIUS|#CAPRICORN|#AQUARIUS|#PISCES|#WHITE CHESS KING|/QUEEN|/ROOK|/BISHOP|/KNIGHT|/PAWN|#BLACK CHESS KING|/QUEEN|/ROOK|/BISHOP|/KNIGHT|/PAWN|)SPADE SUIT|#WHITE HEART SUIT|)DIAMOND SUIT|#BLACK CLUB SUIT|#WHITE SPADE SUIT|#BLACK HEART SUIT|)DIAMOND SUIT|#WHITE CLUB SUIT|#HOT SPRINGS|#QUARTER NOTE|#EIGHTH NOTE|#BEAMED EIGHTH NOTES|*SIXTEENTH NOTES|#MUSIC FLAT SIGN|)NATURAL SIGN|)SHARP SIGN|#WEST SYRIAC CROSS|#EAST SYRIAC CROSS|#UNIVERSAL RECYCLING SYMBOL|#RECYCLING SYMBOL FOR TYPE-1 PLASTICS|=2 PLASTICS|=3 PLASTICS|=4 PLASTICS|=5 PLASTICS|=6 PLASTICS|=7 PLASTICS|8GENERIC MATERIALS|#BLACK UNIVERSAL RECYCLING SYMBOL|#RECYCLED PAPER SYMBOL|#PARTIALLY-RECYCLED PAPER SYMBOL|$ERMANENT PAPER SIGN|#WHEELCHAIR SYMBOL|#DIE FACE-1|,2|,3|,4|,5|,6|#WHITE CIRCLE WITH DOT RIGHT|5TWO DOTS|#BLACK CIRCLE WITH WHITE DOT RIGHT|5TWO WHITE DOTS|#MONOGRAM FOR YANG|1IN|#DIGRAM FOR GREATER YANG|.LESSER YIN|6ANG|.GREATER YIN|#WHITE FLAG|#BLACK FLAG|#HAMMER AND PICK|#ANCHOR|#CROSSED SWORDS|#STAFF OF AESCULAPIUS|$CALES|#ALEMBIC|#FLOWER|#GEAR|#STAFF OF HERMES|#ATOM SYMBOL|#FLEUR-DE-LIS|#OUTLINED WHITE STAR|#THREE LINES CONVERGING RIGHT|:LEFT|#WARNING SIGN|#HIGH VOLTAGE SIGN|#DOUBLED FEMALE SIGN|+MALE SIGN|#INTERLOCKED FEMALE AND MALE SIGN|#MALE AND FEMALE SIGN|(WITH STROKE SIGN|4AND MALE AND FEMALE SIGN|#VERTICAL MALE WITH STROKE SIGN|#HORIZONTAL MALE WITH STROKE SIGN|#MEDIUM WHITE CIRCLE|*BLACK CIRCLE|*SMALL WHITE CIRCLE|$ARRIAGE SYMBOL|#DIVORCE SYMBOL|#UNMARRIED PARTNERSHIP SYMBOL|#COFFIN|#FUNERAL URN|#NEUTER|#CERES|#PALLAS|#JUNO|#VESTA|#CHIRON|#BLACK MOON LILITH|#SEXTILE|%MISEXTILE|#QUINCUNX|#SESQUIQUADRATE|$OCCER BALL|#BASEBALL|#SQUARED KEY|#WHITE DRAUGHTS MAN|2KING|#BLACK DRAUGHTS MAN|2KING|#SNOWMAN WITHOUT SNOW|$UN BEHIND CLOUD|#RAIN|#BLACK SNOWMAN|#THUNDER CLOUD AND RAIN|$URNED WHITE SHOGI PIECE|*BLACK SHOGI PIECE|#WHITE DIAMOND IN SQUARE|#CROSSING LANES|#DISABLED CAR|#OPHIUCHUS|#PICK|#CAR SLIDING|#HELMET WITH WHITE CROSS|#CIRCLED CROSSING LANES|$HAINS|#NO ENTRY|#ALTERNATE ONE-WAY LEFT WAY TRAFFIC|#BLACK TWO-WAY LEFT WAY TRAFFIC|#WHITE TWO-WAY LEFT WAY TRAFFIC|#BLACK LEFT LANE MERGE|#WHITE LEFT LANE MERGE|#DRIVE SLOW SIGN|#HEAVY WHITE DOWN-POINTING TRIANGLE|#LEFT CLOSED ENTRY|#SQUARED SALTIRE|#FALLING DIAGONAL IN WHITE CIRCLE IN BLACK SQUARE|#BLACK TRUCK|#RESTRICTED LEFT ENTRY-1|92|#ASTRONOMICAL SYMBOL FOR URANUS|#HEAVY CIRCLE WITH STROKE AND TWO DOTS ABOVE|#PENTAGRAM|#RIGHT-HANDED INTERLACED PENTAGRAM|#LEFT-HANDED INTERLACED PENTAGRAM|#INVERTED PENTAGRAM|#BLACK CROSS ON SHIELD|#SHINTO SHRINE|#CHURCH|$ASTLE|#HISTORIC SITE|#GEAR WITHOUT HUB|, HANDLES|#MAP SYMBOL FOR LIGHTHOUSE|$OUNTAIN|#UMBRELLA ON GROUND|#FOUNTAIN|$LAG IN HOLE|$ERRY|#SAILBOAT|$QUARE FOUR CORNERS|$KIER|#ICE SKATE|#PERSON WITH BALL|#TENT|#JAPANESE BANK SYMBOL|#HEADSTONE GRAVEYARD SYMBOL|#FUEL PUMP|#CUP ON BLACK SQUARE|#WHITE FLAG WITH HORIZONTAL MIDDLE BLACK STRIPE|#BLACK SAFETY SCISSORS|#UPPER BLADE SCISSORS|#BLACK SCISSORS|#LOWER BLADE SCISSORS|#WHITE SCISSORS|)HEAVY CHECK MARK|#TELEPHONE LOCATION SIGN|$APE DRIVE|#AIRPLANE|#ENVELOPE|#RAISED FIST|*HAND|#VICTORY HAND|#WRITING HAND|#LOWER RIGHT PENCIL|#PENCIL|#UPPER RIGHT PENCIL|#WHITE NIB|#BLACK NIB|#CHECK MARK|#HEAVY CHECK MARK|#MULTIPLICATION X|#HEAVY MULTIPLICATION X|#BALLOT X|#HEAVY BALLOT X|#OUTLINED GREEK CROSS|#HEAVY GREEK CROSS|#OPEN CENTRE CROSS|#HEAVY OPEN CENTRE CROSS|#LATIN CROSS|#SHADOWED WHITE LATIN CROSS|#OUTLINED LATIN CROSS|#MALTESE CROSS|#STAR OF DAVID|#FOUR TEARDROP-SPOKED ASTERISK|(BALLOON-SPOKED ASTERISK|#HEAVY FOUR BALLOON-SPOKED ASTERISK|#FOUR CLUB-SPOKED ASTERISK|#BLACK FOUR POINTED STAR|#WHITE FOUR POINTED STAR|#SPARKLES|$TRESS OUTLINED WHITE STAR|#CIRCLED WHITE STAR|#OPEN CENTRE BLACK STAR|#BLACK CENTRE WHITE STAR|#OUTLINED BLACK STAR|#HEAVY OUTLINED BLACK STAR|#PINWHEEL STAR|#SHADOWED WHITE STAR|#HEAVY ASTERISK|#OPEN CENTRE ASTERISK|#EIGHT SPOKED ASTERISK|)POINTED BLACK STAR|1PINWHEEL STAR|#SIX POINTED BLACK STAR|#EIGHT POINTED RECTILINEAR BLACK STAR|#HEAVY EIGHT POINTED RECTILINEAR BLACK STAR|#TWELVE POINTED BLACK STAR|#SIXTEEN POINTED ASTERISK|#TEARDROP-SPOKED ASTERISK|#OPEN CENTRE TEARDROP-SPOKED ASTERISK|#HEAVY TEARDROP-SPOKED ASTERISK|#SIX PETALLED BLACK AND WHITE FLORETTE|#BLACK FLORETTE|#WHITE FLORETTE|#EIGHT PETALLED OUTLINED BLACK FLORETTE|#CIRCLED OPEN CENTRE EIGHT POINTED STAR|#HEAVY TEARDROP-SPOKED PINWHEEL ASTERISK|#SNOWFLAKE|#TIGHT TRIFOLIATE SNOWFLAKE|#HEAVY CHEVRON SNOWFLAKE|#SPARKLE|#HEAVY SPARKLE|#BALLOON-SPOKED ASTERISK|#EIGHT TEARDROP-SPOKED PROPELLER ASTERISK|#HEAVY EIGHT TEARDROP-SPOKED PROPELLER ASTERISK|#CROSS MARK|#SHADOWED WHITE CIRCLE|#NEGATIVE SQUARED CROSS MARK|#LOWER RIGHT DROP-SHADOWED WHITE SQUARE|#UPPER RIGHT DROP-SHADOWED WHITE SQUARE|#LOWER RIGHT SHADOWED WHITE SQUARE|#UPPER RIGHT SHADOWED WHITE SQUARE|#BLACK QUESTION MARK ORNAMENT|#WHITE QUESTION MARK ORNAMENT|)EXCLAMATION MARK ORNAMENT|#BLACK DIAMOND MINUS WHITE X|#HEAVY EXCLAMATION MARK SYMBOL|#LIGHT VERTICAL BAR|#MEDIUM VERTICAL BAR|#HEAVY VERTICAL BAR|)SINGLE TURNED COMMA QUOTATION MARK ORNAMENT|0COMMA QUOTATION MARK ORNAMENT|)DOUBLE TURNED COMMA QUOTATION MARK ORNAMENT|0COMMA QUOTATION MARK ORNAMENT|)LOW SINGLE COMMA QUOTATION MARK ORNAMENT|-DOUBLE COMMA QUOTATION MARK ORNAMENT|#CURVED STEM PARAGRAPH SIGN ORNAMENT|#HEAVY EXCLAMATION MARK ORNAMENT|)HEART EXCLAMATION MARK ORNAMENT|)BLACK HEART|#ROTATED HEAVY BLACK HEART BULLET|#FLORAL HEART|#ROTATED FLORAL HEART BULLET|#MEDIUM LEFT PARENTHESIS ORNAMENT|*RIGHT PARENTHESIS ORNAMENT|*FLATTENED LEFT PARENTHESIS ORNAMENT|4RIGHT PARENTHESIS ORNAMENT|*LEFT-POINTING ANGLE BRACKET ORNAMENT|*RIGHT-POINTING ANGLE BRACKET ORNAMENT|#HEAVY LEFT-POINTING ANGLE QUOTATION MARK ORNAMENT|)RIGHT-POINTING ANGLE QUOTATION MARK ORNAMENT|)LEFT-POINTING ANGLE BRACKET ORNAMENT|)RIGHT-POINTING ANGLE BRACKET ORNAMENT|#LIGHT LEFT TORTOISE SHELL BRACKET ORNAMENT|)RIGHT TORTOISE SHELL BRACKET ORNAMENT|#MEDIUM LEFT CURLY BRACKET ORNAMENT|*RIGHT CURLY BRACKET ORNAMENT|#DINGBAT NEGATIVE CIRCLED DIGIT ONE|BTWO|CHREE|BFOUR|CIVE|BSIX|CEVEN|BEIGHT|BNINE|<NUMBER TEN|+CIRCLED SANS-SERIF DIGIT ONE|DTWO|EHREE|DFOUR|EIVE|DSIX|EEVEN|DEIGHT|DNINE|>NUMBER TEN|+NEGATIVE CIRCLED SANS-SERIF DIGIT ONE|MTWO|NHREE|MFOUR|NIVE|MSIX|NEVEN|MEIGHT|MNINE|GNUMBER TEN|#HEAVY WIDE-HEADED RIGHTWARDS ARROW|)PLUS SIGN|)MINUS SIGN|)DIVISION SIGN|)SOUTH EAST ARROW|)RIGHTWARDS ARROW|)NORTH EAST ARROW|#DRAFTING POINT RIGHTWARDS ARROW|#HEAVY ROUND-TIPPED RIGHTWARDS ARROW|#TRIANGLE-HEADED RIGHTWARDS ARROW|#HEAVY TRIANGLE-HEADED RIGHTWARDS ARROW|#DASHED TRIANGLE-HEADED RIGHTWARDS ARROW|#HEAVY DASHED TRIANGLE-HEADED RIGHTWARDS ARROW|#BLACK RIGHTWARDS ARROW|#THREE-D TOP-LIGHTED RIGHTWARDS ARROWHEAD|+BOTTOM-LIGHTED RIGHTWARDS ARROWHEAD|#BLACK RIGHTWARDS ARROWHEAD|#HEAVY BLACK CURVED DOWNWARDS AND RIGHTWARDS ARROW|6UPWARDS AND RIGHTWARDS ARROW|#SQUAT BLACK RIGHTWARDS ARROW|#HEAVY CONCAVE-POINTED BLACK RIGHTWARDS ARROW|#RIGHT-SHADED WHITE RIGHTWARDS ARROW|#LEFT-SHADED WHITE RIGHTWARDS ARROW|#BACK-TILTED SHADOWED WHITE RIGHTWARDS ARROW|#FRONT-TILTED SHADOWED WHITE RIGHTWARDS ARROW|#HEAVY LOWER RIGHT-SHADOWED WHITE RIGHTWARDS ARROW|)UPPER RIGHT-SHADOWED WHITE RIGHTWARDS ARROW|#NOTCHED LOWER RIGHT-SHADOWED WHITE RIGHTWARDS ARROW|#CURLY LOOP|#NOTCHED UPPER RIGHT-SHADOWED WHITE RIGHTWARDS ARROW|#CIRCLED HEAVY WHITE RIGHTWARDS ARROW|#WHITE-FEATHERED RIGHTWARDS ARROW|#BLACK-FEATHERED SOUTH EAST ARROW|3RIGHTWARDS ARROW|3NORTH EAST ARROW|#HEAVY BLACK-FEATHERED SOUTH EAST ARROW|9RIGHTWARDS ARROW|9NORTH EAST ARROW|#TEARDROP-BARBED RIGHTWARDS ARROW|#HEAVY TEARDROP-SHANKED RIGHTWARDS ARROW|#WEDGE-TAILED RIGHTWARDS ARROW|#HEAVY WEDGE-TAILED RIGHTWARDS ARROW|#OPEN-OUTLINED RIGHTWARDS ARROW|#DOUBLE CURLY LOOP|#THREE DIMENSIONAL ANGLE|#WHITE TRIANGLE CONTAINING SMALL WHITE TRIANGLE|#PERPENDICULAR|#OPEN SUBSET|*PERSET|#LEFT S-SHAPED BAG DELIMITER|#RIGHT S-SHAPED BAG DELIMITER|#OR WITH DOT INSIDE|#REVERSE SOLIDUS PRECEDING SUBSET|#SUPERSET PRECEDING SOLIDUS|#VERTICAL BAR WITH HORIZONTAL STROKE|#MATHEMATICAL RISING DIAGONAL|#LONG DIVISION|#MATHEMATICAL FALLING DIAGONAL|#SQUARED LOGICAL AND|3OR|#WHITE DIAMOND WITH CENTRED DOT|#AND WITH DOT|#ELEMENT OF OPENING UPWARDS|#LOWER RIGHT CORNER WITH DOT|#UPPER LEFT CORNER WITH DOT|#LEFT OUTER JOIN|#RIGHT OUTER JOIN|#FULL OUTER JOIN|#LARGE UP TACK|)DOWN TACK|$EFT AND RIGHT DOUBLE TURNSTILE|2TACK|(MULTIMAP|$ONG RIGHT TACK|(LEFT TACK|#UP TACK WITH CIRCLE ABOVE|#LOZENGE DIVIDED BY HORIZONTAL RULE|#WHITE CONCAVE-SIDED DIAMOND|> WITH LEFTWARDS TICK|DRIGHTWARDS TICK|)SQUARE WITH LEFTWARDS TICK|5RIGHTWARDS TICK|#MATHEMATICAL LEFT WHITE SQUARE BRACKET|0RIGHT WHITE SQUARE BRACKET|0LEFT ANGLE BRACKET|0RIGHT ANGLE BRACKET|0LEFT DOUBLE ANGLE BRACKET|0RIGHT DOUBLE ANGLE BRACKET|0LEFT WHITE TORTOISE SHELL BRACKET|0RIGHT WHITE TORTOISE SHELL BRACKET|0LEFT FLATTENED PARENTHESIS|0RIGHT FLATTENED PARENTHESIS|#UPWARDS QUADRUPLE ARROW|#DOWNWARDS QUADRUPLE ARROW|#ANTICLOCKWISE GAPPED CIRCLE ARROW|#CLOCKWISE GAPPED CIRCLE ARROW|#RIGHT ARROW WITH CIRCLED PLUS|#LONG LEFTWARDS ARROW|(RIGHTWARDS ARROW|(LEFT RIGHT ARROW|,WARDS DOUBLE ARROW|(RIGHTWARDS DOUBLE ARROW|(LEFT RIGHT DOUBLE ARROW|,WARDS ARROW FROM BAR|(RIGHTWARDS ARROW FROM BAR|(LEFTWARDS DOUBLE ARROW FROM BAR|(RIGHTWARDS DOUBLE ARROW FROM BAR|3SQUIGGLE ARROW|#BRAILLE PATTERN BLANK|3DOTS-1|82|812|83|813|823|8123|84|814|824|8124|834|8134|8234|81234|85|815|825|8125|835|8135|8235|81235|845|8145|8245|81245|8345|81345|82345|812345|86|816|826|8126|836|8136|8236|81236|846|8146|8246|81246|8346|81346|82346|812346|856|8156|8256|81256|8356|81356|82356|812356|8456|81456|82456|812456|83456|813456|823456|8123456|87|817|827|8127|837|8137|8237|81237|847|8147|8247|81247|8347|81347|82347|812347|857|8157|8257|81257|8357|81357|82357|812357|8457|81457|82457|812457|83457|813457|823457|8123457|867|8167|8267|81267|8367|81367|82367|812367|8467|81467|82467|812467|83467|813467|823467|8123467|8567|81567|82567|812567|83567|813567|823567|8123567|84567|814567|824567|8124567|834567|8134567|8234567|81234567|88|818|828|8128|838|8138|8238|81238|848|8148|8248|81248|8348|81348|82348|812348|858|8158|8258|81258|8358|81358|82358|812358|8458|81458|82458|812458|83458|813458|823458|8123458|868|8168|8268|81268|8368|81368|82368|812368|8468|81468|82468|812468|83468|813468|823468|8123468|8568|81568|82568|812568|83568|813568|823568|8123568|84568|814568|824568|8124568|834568|8134568|8234568|81234568|878|8178|8278|81278|8378|81378|82378|812378|8478|81478|82478|812478|83478|813478|823478|8123478|8578|81578|82578|812578|83578|813578|823578|8123578|84578|814578|824578|8124578|834578|8134578|8234578|81234578|8678|81678|82678|812678|83678|813678|823678|8123678|84678|814678|824678|8124678|834678|8134678|8234678|81234678|85678|815678|825678|8125678|835678|8135678|8235678|81235678|845678|8145678|8245678|81245678|8345678|81345678|82345678|812345678|#RIGHTWARDS TWO-HEADED ARROW WITH VERTICAL STROKE|DDOUBLE VERTICAL STROKE|#LEFTWARDS DOUBLE ARROW WITH VERTICAL STROKE|#RIGHTWARDS DOUBLE ARROW WITH VERTICAL STROKE|#LEFT RIGHT DOUBLE ARROW WITH VERTICAL STROKE|#RIGHTWARDS TWO-HEADED ARROW FROM BAR|#LEFTWARDS DOUBLE ARROW FROM BAR|#RIGHTWARDS DOUBLE ARROW FROM BAR|#DOWNWARDS ARROW WITH HORIZONTAL STROKE|#UPWARDS ARROW WITH HORIZONTAL STROKE|+TRIPLE ARROW|#DOWNWARDS TRIPLE ARROW|#LEFTWARDS DOUBLE DASH ARROW|#RIGHTWARDS DOUBLE DASH ARROW|#LEFTWARDS TRIPLE DASH ARROW|#RIGHTWARDS TRIPLE DASH ARROW|/WO-HEADED TRIPLE DASH ARROW|.ARROW WITH DOTTED STEM|#UPWARDS ARROW TO BAR|#DOWNWARDS ARROW TO BAR|#RIGHTWARDS ARROW WITH TAIL WITH VERTICAL STROKE|CDOUBLE VERTICAL STROKE|.TWO-HEADED ARROW WITH TAIL|H WITH VERTICAL STROKE|NDOUBLE VERTICAL STROKE|#LEFTWARDS ARROW-TAIL|#RIGHTWARDS ARROW-TAIL|#LEFTWARDS DOUBLE ARROW-TAIL|#RIGHTWARDS DOUBLE ARROW-TAIL|#LEFTWARDS ARROW TO BLACK DIAMOND|#RIGHTWARDS ARROW TO BLACK DIAMOND|#LEFTWARDS ARROW FROM BAR TO BLACK DIAMOND|#RIGHTWARDS ARROW FROM BAR TO BLACK DIAMOND|#NORTH WEST AND SOUTH EAST ARROW|)EAST AND SOUTH WEST ARROW|)WEST ARROW WITH HOOK|)EAST ARROW WITH HOOK|#SOUTH EAST ARROW WITH HOOK|)WEST ARROW WITH HOOK|#NORTH WEST ARROW AND NORTH EAST ARROW|)EAST ARROW AND SOUTH EAST ARROW|#SOUTH EAST ARROW AND SOUTH WEST ARROW|)WEST ARROW AND NORTH WEST ARROW|#RISING DIAGONAL CROSSING FALLING DIAGONAL|#FALLING DIAGONAL CROSSING RISING DIAGONAL|#SOUTH EAST ARROW CROSSING NORTH EAST ARROW|#NORTH EAST ARROW CROSSING SOUTH EAST ARROW|#FALLING DIAGONAL CROSSING NORTH EAST ARROW|#RISING DIAGONAL CROSSING SOUTH EAST ARROW|#NORTH EAST ARROW CROSSING NORTH WEST ARROW|)WEST ARROW CROSSING NORTH EAST ARROW|#WAVE ARROW POINTING DIRECTLY RIGHT|#ARROW POINTING RIGHTWARDS THEN CURVING UPWARDS|JDOWNWARDS|2DOWNWARDS THEN CURVING LEFTWARDS|IRIGHTWARDS|#RIGHT-SIDE ARC CLOCKWISE ARROW|#LEFT-SIDE ARC ANTICLOCKWISE ARROW|#TOP ARC ANTICLOCKWISE ARROW|#BOTTOM ARC ANTICLOCKWISE ARROW|#TOP ARC CLOCKWISE ARROW WITH MINUS|+ANTICLOCKWISE ARROW WITH PLUS|#LOWER RIGHT SEMICIRCULAR CLOCKWISE ARROW|)LEFT SEMICIRCULAR ANTICLOCKWISE ARROW|#ANTICLOCKWISE CLOSED CIRCLE ARROW|#CLOCKWISE CLOSED CIRCLE ARROW|#RIGHTWARDS ARROW ABOVE SHORT LEFTWARDS ARROW|#LEFTWARDS ARROW ABOVE SHORT RIGHTWARDS ARROW|#SHORT RIGHTWARDS ARROW ABOVE LEFTWARDS ARROW|#RIGHTWARDS ARROW WITH PLUS BELOW|#LEFTWARDS ARROW WITH PLUS BELOW|#RIGHTWARDS ARROW THROUGH X|#LEFT RIGHT ARROW THROUGH SMALL CIRCLE|#UPWARDS TWO-HEADED ARROW FROM SMALL CIRCLE|#LEFT BARB UP RIGHT BARB DOWN HARPOON|-DOWN RIGHT BARB UP HARPOON|#UP BARB RIGHT DOWN BARB LEFT HARPOON|+LEFT DOWN BARB RIGHT HARPOON|#LEFT BARB UP RIGHT BARB UP HARPOON|#UP BARB RIGHT DOWN BARB RIGHT HARPOON|#LEFT BARB DOWN RIGHT BARB DOWN HARPOON|#UP BARB LEFT DOWN BARB LEFT HARPOON|#LEFTWARDS HARPOON WITH BARB UP TO BAR|#RIGHTWARDS HARPOON WITH BARB UP TO BAR|#UPWARDS HARPOON WITH BARB RIGHT TO BAR|#DOWNWARDS HARPOON WITH BARB RIGHT TO BAR|#LEFTWARDS HARPOON WITH BARB DOWN TO BAR|#RIGHTWARDS HARPOON WITH BARB DOWN TO BAR|#UPWARDS HARPOON WITH BARB LEFT TO BAR|#DOWNWARDS HARPOON WITH BARB LEFT TO BAR|#LEFTWARDS HARPOON WITH BARB UP FROM BAR|#RIGHTWARDS HARPOON WITH BARB UP FROM BAR|#UPWARDS HARPOON WITH BARB RIGHT FROM BAR|#DOWNWARDS HARPOON WITH BARB RIGHT FROM BAR|#LEFTWARDS HARPOON WITH BARB DOWN FROM BAR|#RIGHTWARDS HARPOON WITH BARB DOWN FROM BAR|#UPWARDS HARPOON WITH BARB LEFT FROM BAR|#DOWNWARDS HARPOON WITH BARB LEFT FROM BAR|#LEFTWARDS HARPOON WITH BARB UP ABOVE LEFTWARDS HARPOON WITH BARB DOWN|#UPWARDS HARPOON WITH BARB LEFT BESIDE UPWARDS HARPOON WITH BARB RIGHT|#RIGHTWARDS HARPOON WITH BARB UP ABOVE RIGHTWARDS HARPOON WITH BARB DOWN|#DOWNWARDS HARPOON WITH BARB LEFT BESIDE DOWNWARDS HARPOON WITH BARB RIGHT|#LEFTWARDS HARPOON WITH BARB UP ABOVE RIGHTWARDS HARPOON WITH BARB UP|?DOWN ABOVE RIGHTWARDS HARPOON WITH BARB DOWN|#RIGHTWARDS HARPOON WITH BARB UP ABOVE LEFTWARDS HARPOON WITH BARB UP|@DOWN ABOVE LEFTWARDS HARPOON WITH BARB DOWN|#LEFTWARDS HARPOON WITH BARB UP ABOVE LONG DASH|?DOWN BELOW LONG DASH|#RIGHTWARDS HARPOON WITH BARB UP ABOVE LONG DASH|@DOWN BELOW LONG DASH|#UPWARDS HARPOON WITH BARB LEFT BESIDE DOWNWARDS HARPOON WITH BARB RIGHT|#DOWNWARDS HARPOON WITH BARB LEFT BESIDE UPWARDS HARPOON WITH BARB RIGHT|#RIGHT DOUBLE ARROW WITH ROUNDED HEAD|#EQUALS SIGN ABOVE RIGHTWARDS ARROW|#TILDE OPERATOR ABOVE RIGHTWARDS ARROW|#LEFTWARDS ARROW ABOVE TILDE OPERATOR|#RIGHTWARDS ARROW ABOVE TILDE OPERATOR|:ALMOST EQUAL TO|#LESS-THAN ABOVE LEFTWARDS ARROW|%FTWARDS ARROW THROUGH LESS-THAN|#GREATER-THAN ABOVE RIGHTWARDS ARROW|#SUBSET ABOVE RIGHTWARDS ARROW|#LEFTWARDS ARROW THROUGH SUBSET|#SUPERSET ABOVE LEFTWARDS ARROW|#LEFT FISH TAIL|#RIGHT FISH TAIL|#UP FISH TAIL|#DOWN FISH TAIL|#TRIPLE VERTICAL BAR DELIMITER|#Z NOTATION SPOT|.TYPE COLON|#LEFT WHITE CURLY BRACKET|#RIGHT WHITE CURLY BRACKET|#LEFT WHITE PARENTHESIS|#RIGHT WHITE PARENTHESIS|#Z NOTATION LEFT IMAGE BRACKET|.RIGHT IMAGE BRACKET|.LEFT BINDING BRACKET|.RIGHT BINDING BRACKET|#LEFT SQUARE BRACKET WITH UNDERBAR|#RIGHT SQUARE BRACKET WITH UNDERBAR|#LEFT SQUARE BRACKET WITH TICK IN TOP CORNER|#RIGHT SQUARE BRACKET WITH TICK IN BOTTOM CORNER|#LEFT SQUARE BRACKET WITH TICK IN BOTTOM CORNER|#RIGHT SQUARE BRACKET WITH TICK IN TOP CORNER|#LEFT ANGLE BRACKET WITH DOT|#RIGHT ANGLE BRACKET WITH DOT|#LEFT ARC LESS-THAN BRACKET|#RIGHT ARC GREATER-THAN BRACKET|#DOUBLE LEFT ARC GREATER-THAN BRACKET|*RIGHT ARC LESS-THAN BRACKET|#LEFT BLACK TORTOISE SHELL BRACKET|#RIGHT BLACK TORTOISE SHELL BRACKET|#DOTTED FENCE|#VERTICAL ZIGZAG LINE|#MEASURED ANGLE OPENING LEFT|#RIGHT ANGLE VARIANT WITH SQUARE|#MEASURED RIGHT ANGLE WITH DOT|#ANGLE WITH S INSIDE|$CUTE ANGLE|#SPHERICAL ANGLE OPENING LEFT|;UP|#TURNED ANGLE|#REVERSED ANGLE|#ANGLE WITH UNDERBAR|#REVERSED ANGLE WITH UNDERBAR|#OBLIQUE ANGLE OPENING UP|9DOWN|#MEASURED ANGLE WITH OPEN ARM ENDING IN ARROW POINTING UP AND RIGHT|`LEFT|YDOWN AND RIGHT|bLEFT|YRIGHT AND UP|YLEFT AND UP|YRIGHT AND DOWN|YLEFT AND DOWN|#REVERSED EMPTY SET|#EMPTY SET WITH OVERBAR|2SMALL CIRCLE ABOVE|2RIGHT ARROW ABOVE|2LEFT ARROW ABOVE|#CIRCLE WITH HORIZONTAL BAR|)D VERTICAL BAR|+PARALLEL|+REVERSE SOLIDUS|+PERPENDICULAR|) DIVIDED BY HORIZONTAL BAR AND TOP HALF DIVIDED BY VERTICAL BAR|*WITH SUPERIMPOSED X|)D ANTICLOCKWISE-ROTATED DIVISION SIGN|#UP ARROW THROUGH CIRCLE|#CIRCLED WHITE BULLET|+BULLET|+LESS-THAN|+GREATER-THAN|) WITH SMALL CIRCLE TO THE RIGHT|/TWO HORIZONTAL STROKES TO THE RIGHT|#SQUARED RISING DIAGONAL SLASH|+FALLING DIAGONAL SLASH|+ASTERISK|+SMALL CIRCLE|,QUARE|#TWO JOINED SQUARES|$RIANGLE WITH DOT ABOVE|1UNDERBAR|#S IN TRIANGLE|#TRIANGLE WITH SERIFS AT BOTTOM|#RIGHT TRIANGLE ABOVE LEFT TRIANGLE|#LEFT TRIANGLE BESIDE VERTICAL BAR|#VERTICAL BAR BESIDE RIGHT TRIANGLE|#BOWTIE WITH LEFT HALF BLACK|/RIGHT HALF BLACK|$LACK BOWTIE|#TIMES WITH LEFT HALF BLACK|.RIGHT HALF BLACK|#WHITE HOURGLASS|#BLACK HOURGLASS|#LEFT WIGGLY FENCE|#RIGHT WIGGLY FENCE|#LEFT DOUBLE WIGGLY FENCE|#RIGHT DOUBLE WIGGLY FENCE|#INCOMPLETE INFINITY|#TIE OVER INFINITY|#INFINITY NEGATED WITH VERTICAL BAR|#DOUBLE-ENDED MULTIMAP|#SQUARE WITH CONTOURED OUTLINE|#INCREASES AS|#SHUFFLE PRODUCT|#EQUALS SIGN AND SLANTED PARALLEL|C WITH TILDE ABOVE|#IDENTICAL TO AND SLANTED PARALLEL|#GLEICH STARK|#THERMODYNAMIC|#DOWN-POINTING TRIANGLE WITH LEFT HALF BLACK|?RIGHT HALF BLACK|#BLACK DIAMOND WITH DOWN ARROW|)LOZENGE|#WHITE CIRCLE WITH DOWN ARROW|#BLACK CIRCLE WITH DOWN ARROW|#ERROR-BARRED WHITE SQUARE|0BLACK SQUARE|0WHITE DIAMOND|0BLACK DIAMOND|0WHITE CIRCLE|0BLACK CIRCLE|#RULE-DELAYED|$EVERSE SOLIDUS OPERATOR|#SOLIDUS WITH OVERBAR|#REVERSE SOLIDUS WITH HORIZONTAL STROKE|#BIG SOLIDUS|'REVERSE SOLIDUS|#DOUBLE PLUS|#TRIPLE PLUS|#LEFT-POINTING CURVED ANGLE BRACKET|#RIGHT-POINTING CURVED ANGLE BRACKET|#TINY|#MINY|#N-ARY CIRCLED DOT OPERATOR|1PLUS OPERATOR|1TIMES OPERATOR|)UNION OPERATOR WITH DOT|=PLUS|)SQUARE INTERSECTION OPERATOR|0UNION OPERATOR|#TWO LOGICAL AND OPERATOR|/OR OPERATOR|#N-ARY TIMES OPERATOR|#MODULO TWO SUM|#SUMMATION WITH INTEGRAL|#QUADRUPLE INTEGRAL OPERATOR|#FINITE PART INTEGRAL|#INTEGRAL WITH DOUBLE STROKE|,AVERAGE WITH SLASH|#CIRCULATION FUNCTION|#ANTICLOCKWISE INTEGRATION|#LINE INTEGRATION WITH RECTANGULAR PATH AROUND POLE|9SEMICIRCULAR PATH AROUND POLE|4NOT INCLUDING THE POLE|#INTEGRAL AROUND A POINT OPERATOR|#QUATERNION INTEGRAL OPERATOR|#INTEGRAL WITH LEFTWARDS ARROW WITH HOOK|1TIMES SIGN|1INTERSECTION|1UNION|1OVERBAR|1UNDERBAR|#JOIN|#LARGE LEFT TRIANGLE OPERATOR|#Z NOTATION SCHEMA COMPOSITION|5PIPING|6ROJECTION|#PLUS SIGN WITH SMALL CIRCLE ABOVE|2CIRCUMFLEX ACCENT ABOVE|2TILDE ABOVE|2DOT BELOW|2TILDE BELOW|2SUBSCRIPT TWO|2BLACK TRIANGLE|#MINUS SIGN WITH COMMA ABOVE|3DOT BELOW|3FALLING DOTS|3RISING DOTS|#PLUS SIGN IN LEFT HALF CIRCLE|0RIGHT HALF CIRCLE|#VECTOR OR CROSS PRODUCT|#MULTIPLICATION SIGN WITH DOT ABOVE|<UNDERBAR|#SEMIDIRECT PRODUCT WITH BOTTOM CLOSED|$MASH PRODUCT|#MULTIPLICATION SIGN IN LEFT HALF CIRCLE|:RIGHT HALF CIRCLE|#CIRCLED MULTIPLICATION SIGN WITH CIRCUMFLEX ACCENT|#MULTIPLICATION SIGN IN DOUBLE CIRCLE|#CIRCLED DIVISION SIGN|#PLUS SIGN IN TRIANGLE|#MINUS SIGN IN TRIANGLE|$ULTIPLICATION SIGN IN TRIANGLE|#INTERIOR PRODUCT|#RIGHTHAND INTERIOR PRODUCT|#Z NOTATION RELATIONAL COMPOSITION|#AMALGAMATION OR COPRODUCT|#INTERSECTION WITH DOT|#UNION WITH MINUS SIGN|.OVERBAR|#INTERSECTION WITH OVERBAR|5LOGICAL AND|#UNION WITH LOGICAL OR|)ABOVE INTERSECTION|#INTERSECTION ABOVE UNION|#UNION ABOVE BAR ABOVE INTERSECTION|#INTERSECTION ABOVE BAR ABOVE UNION|#UNION BESIDE AND JOINED WITH UNION|#INTERSECTION BESIDE AND JOINED WITH INTERSECTION|#CLOSED UNION WITH SERIFS|*INTERSECTION WITH SERIFS|#DOUBLE SQUARE INTERSECTION|1UNION|#CLOSED UNION WITH SERIFS AND SMASH PRODUCT|#LOGICAL AND WITH DOT ABOVE|+OR WITH DOT ABOVE|#DOUBLE LOGICAL AND|2OR|#TWO INTERSECTING LOGICAL AND|<OR|#SLOPING LARGE OR|1AND|#LOGICAL OR OVERLAPPING LOGICAL AND|+AND WITH MIDDLE STEM|+OR WITH MIDDLE STEM|+AND WITH HORIZONTAL DASH|+OR WITH HORIZONTAL DASH|+AND WITH DOUBLE OVERBAR|4UNDERBAR|4DOUBLE UNDERBAR|#SMALL VEE WITH UNDERBAR|#LOGICAL OR WITH DOUBLE OVERBAR|:UNDERBAR|#Z NOTATION DOMAIN ANTIRESTRICTION|.RANGE ANTIRESTRICTION|#EQUALS SIGN WITH DOT BELOW|#IDENTICAL WITH DOT ABOVE|#TRIPLE HORIZONTAL BAR WITH DOUBLE VERTICAL STROKE|>TRIPLE VERTICAL STROKE|$ILDE OPERATOR WITH DOT ABOVE|7RISING DOTS|#SIMILAR MINUS SIMILAR|#CONGRUENT WITH DOT ABOVE|#EQUALS WITH ASTERISK|#ALMOST EQUAL TO WITH CIRCUMFLEX ACCENT|$PPROXIMATELY EQUAL OR EQUAL TO|#EQUALS SIGN ABOVE PLUS SIGN|#PLUS SIGN ABOVE EQUALS SIGN|#EQUALS SIGN ABOVE TILDE OPERATOR|#DOUBLE COLON EQUAL|#TWO CONSECUTIVE EQUALS SIGNS|$HREE CONSECUTIVE EQUALS SIGNS|#EQUALS SIGN WITH TWO DOTS ABOVE AND TWO DOTS BELOW|&IVALENT WITH FOUR DOTS ABOVE|#LESS-THAN WITH CIRCLE INSIDE|#GREATER-THAN WITH CIRCLE INSIDE|#LESS-THAN WITH QUESTION MARK ABOVE|#GREATER-THAN WITH QUESTION MARK ABOVE|#LESS-THAN OR SLANTED EQUAL TO|#GREATER-THAN OR SLANTED EQUAL TO|#LESS-THAN OR SLANTED EQUAL TO WITH DOT INSIDE|#GREATER-THAN OR SLANTED EQUAL TO WITH DOT INSIDE|#LESS-THAN OR SLANTED EQUAL TO WITH DOT ABOVE|#GREATER-THAN OR SLANTED EQUAL TO WITH DOT ABOVE|#LESS-THAN OR SLANTED EQUAL TO WITH DOT ABOVE RIGHT|#GREATER-THAN OR SLANTED EQUAL TO WITH DOT ABOVE LEFT|#LESS-THAN OR APPROXIMATE|#GREATER-THAN OR APPROXIMATE|#LESS-THAN AND SINGLE-LINE NOT EQUAL TO|#GREATER-THAN AND SINGLE-LINE NOT EQUAL TO|#LESS-THAN AND NOT APPROXIMATE|#GREATER-THAN AND NOT APPROXIMATE|#LESS-THAN ABOVE DOUBLE-LINE EQUAL ABOVE GREATER-THAN|#GREATER-THAN ABOVE DOUBLE-LINE EQUAL ABOVE LESS-THAN|#LESS-THAN ABOVE SIMILAR OR EQUAL|#GREATER-THAN ABOVE SIMILAR OR EQUAL|#LESS-THAN ABOVE SIMILAR ABOVE GREATER-THAN|#GREATER-THAN ABOVE SIMILAR ABOVE LESS-THAN|#LESS-THAN ABOVE GREATER-THAN ABOVE DOUBLE-LINE EQUAL|#GREATER-THAN ABOVE LESS-THAN ABOVE DOUBLE-LINE EQUAL|#LESS-THAN ABOVE SLANTED EQUAL ABOVE GREATER-THAN ABOVE SLANTED EQUAL|#GREATER-THAN ABOVE SLANTED EQUAL ABOVE LESS-THAN ABOVE SLANTED EQUAL|#SLANTED EQUAL TO OR LESS-THAN|7GREATER-THAN|7LESS-THAN WITH DOT INSIDE|7GREATER-THAN WITH DOT INSIDE|#DOUBLE-LINE EQUAL TO OR LESS-THAN|;GREATER-THAN|/SLANTED EQUAL TO OR LESS-THAN|CGREATER-THAN|#SIMILAR OR LESS-THAN|.GREATER-THAN|+ABOVE LESS-THAN ABOVE EQUALS SIGN|1GREATER-THAN ABOVE EQUALS SIGN|#DOUBLE NESTED LESS-THAN|1GREATER-THAN|1LESS-THAN WITH UNDERBAR|#GREATER-THAN OVERLAPPING LESS-THAN|0BESIDE LESS-THAN|#LESS-THAN CLOSED BY CURVE|#GREATER-THAN CLOSED BY CURVE|#LESS-THAN CLOSED BY CURVE ABOVE SLANTED EQUAL|#GREATER-THAN CLOSED BY CURVE ABOVE SLANTED EQUAL|#SMALLER THAN|#LARGER THAN|#SMALLER THAN OR EQUAL TO|#LARGER THAN OR EQUAL TO|#EQUALS SIGN WITH BUMPY ABOVE|#PRECEDES ABOVE SINGLE-LINE EQUALS SIGN|#SUCCEEDS ABOVE SINGLE-LINE EQUALS SIGN|#PRECEDES ABOVE SINGLE-LINE NOT EQUAL TO|#SUCCEEDS ABOVE SINGLE-LINE NOT EQUAL TO|#PRECEDES ABOVE EQUALS SIGN|#SUCCEEDS ABOVE EQUALS SIGN|#PRECEDES ABOVE NOT EQUAL TO|#SUCCEEDS ABOVE NOT EQUAL TO|#PRECEDES ABOVE ALMOST EQUAL TO|#SUCCEEDS ABOVE ALMOST EQUAL TO|#PRECEDES ABOVE NOT ALMOST EQUAL TO|#SUCCEEDS ABOVE NOT ALMOST EQUAL TO|#DOUBLE PRECEDES|*SUCCEEDS|#SUBSET WITH DOT|%PERSET WITH DOT|%BSET WITH PLUS SIGN BELOW|%PERSET WITH PLUS SIGN BELOW|%BSET WITH MULTIPLICATION SIGN BELOW|%PERSET WITH MULTIPLICATION SIGN BELOW|%BSET OF OR EQUAL TO WITH DOT ABOVE|%PERSET OF OR EQUAL TO WITH DOT ABOVE|%BSET OF ABOVE EQUALS SIGN|%PERSET OF ABOVE EQUALS SIGN|%BSET OF ABOVE TILDE OPERATOR|%PERSET OF ABOVE TILDE OPERATOR|%BSET OF ABOVE ALMOST EQUAL TO|%PERSET OF ABOVE ALMOST EQUAL TO|%BSET OF ABOVE NOT EQUAL TO|%PERSET OF ABOVE NOT EQUAL TO|$QUARE LEFT OPEN BOX OPERATOR|*RIGHT OPEN BOX OPERATOR|#CLOSED SUBSET|,PERSET|,BSET OR EQUAL TO|,PERSET OR EQUAL TO|#SUBSET ABOVE SUPERSET|%PERSET ABOVE SUBSET|%BSET ABOVE SUBSET|%PERSET ABOVE SUPERSET|,BESIDE SUBSET|3AND JOINED BY DASH WITH SUBSET|#ELEMENT OF OPENING DOWNWARDS|#PITCHFORK WITH TEE TOP|#TRANSVERSAL INTERSECTION|#FORKING|#NONFORKING|#SHORT LEFT TACK|)DOWN TACK|)UP TACK|#PERPENDICULAR WITH S|#VERTICAL BAR TRIPLE RIGHT TURNSTILE|#DOUBLE VERTICAL BAR LEFT TURNSTILE|#VERTICAL BAR DOUBLE LEFT TURNSTILE|#DOUBLE VERTICAL BAR DOUBLE LEFT TURNSTILE|#LONG DASH FROM LEFT MEMBER OF DOUBLE VERTICAL|#SHORT DOWN TACK WITH OVERBAR|)UP TACK WITH UNDERBAR|1ABOVE SHORT DOWN TACK|#DOUBLE DOWN TACK|*UP TACK|*STROKE NOT SIGN|#REVERSED DOUBLE STROKE NOT SIGN|#DOES NOT DIVIDE WITH REVERSED NEGATION SLASH|#VERTICAL LINE WITH CIRCLE ABOVE|=BELOW|#DOWN TACK WITH CIRCLE BELOW|#PARALLEL WITH HORIZONTAL STROKE|1TILDE OPERATOR|#TRIPLE VERTICAL BAR BINARY RELATION|7WITH HORIZONTAL STROKE|*COLON OPERATOR|*NESTED LESS-THAN|1GREATER-THAN|#DOUBLE-LINE SLANTED LESS-THAN OR EQUAL TO|7GREATER-THAN OR EQUAL TO|#TRIPLE SOLIDUS BINARY RELATION|#LARGE TRIPLE VERTICAL BAR OPERATOR|#DOUBLE SOLIDUS OPERATOR|#WHITE VERTICAL BAR|#N-ARY WHITE VERTICAL BAR|$ORTH EAST WHITE ARROW|)WEST WHITE ARROW|#SOUTH EAST WHITE ARROW|)WEST WHITE ARROW|#LEFT RIGHT WHITE ARROW|'WARDS BLACK ARROW|#UPWARDS BLACK ARROW|#DOWNWARDS BLACK ARROW|#NORTH EAST BLACK ARROW|)WEST BLACK ARROW|#SOUTH EAST BLACK ARROW|)WEST BLACK ARROW|#LEFT RIGHT BLACK ARROW|#UP DOWN BLACK ARROW|#RIGHTWARDS ARROW WITH TIP DOWNWARDS|=UPWARDS|#LEFTWARDS ARROW WITH TIP DOWNWARDS|<UPWARDS|#SQUARE WITH TOP HALF BLACK|/BOTTOM HALF BLACK|/UPPER RIGHT DIAGONAL HALF BLACK|/LOWER LEFT DIAGONAL HALF BLACK|#DIAMOND WITH LEFT HALF BLACK|0RIGHT HALF BLACK|0TOP HALF BLACK|0BOTTOM HALF BLACK|$OTTED SQUARE|#BLACK LARGE SQUARE|#WHITE LARGE SQUARE|#BLACK VERY SMALL SQUARE|#WHITE VERY SMALL SQUARE|#BLACK PENTAGON|#WHITE PENTAGON|)HEXAGON|#BLACK HEXAGON|#HORIZONTAL BLACK HEXAGON|#BLACK LARGE CIRCLE|)MEDIUM DIAMOND|#WHITE MEDIUM DIAMOND|#BLACK MEDIUM LOZENGE|#WHITE MEDIUM LOZENGE|#BLACK SMALL DIAMOND|/LOZENGE|#WHITE SMALL LOZENGE|#BLACK HORIZONTAL ELLIPSE|#WHITE HORIZONTAL ELLIPSE|#BLACK VERTICAL ELLIPSE|#WHITE VERTICAL ELLIPSE|#LEFT ARROW WITH SMALL CIRCLE|#THREE LEFTWARDS ARROWS|#LEFT ARROW WITH CIRCLED PLUS|$ONG LEFTWARDS SQUIGGLE ARROW|$EFTWARDS TWO-HEADED ARROW WITH VERTICAL STROKE|CDOUBLE VERTICAL STROKE|>FROM BAR|8TRIPLE DASH ARROW|-ARROW WITH DOTTED STEM|8TAIL WITH VERTICAL STROKE|BDOUBLE VERTICAL STROKE|-TWO-HEADED ARROW WITH TAIL|G WITH VERTICAL STROKE|MDOUBLE VERTICAL STROKE|-ARROW THROUGH X|#WAVE ARROW POINTING DIRECTLY LEFT|#EQUALS SIGN ABOVE LEFTWARDS ARROW|#REVERSE TILDE OPERATOR ABOVE LEFTWARDS ARROW|#LEFTWARDS ARROW ABOVE REVERSE ALMOST EQUAL TO|#RIGHTWARDS ARROW THROUGH GREATER-THAN|<SUPERSET|#LEFTWARDS QUADRUPLE ARROW|#RIGHTWARDS QUADRUPLE ARROW|$EVERSE TILDE OPERATOR ABOVE RIGHTWARDS ARROW|$IGHTWARDS ARROW ABOVE REVERSE ALMOST EQUAL TO|#TILDE OPERATOR ABOVE LEFTWARDS ARROW|#LEFTWARDS ARROW ABOVE ALMOST EQUAL TO|9REVERSE TILDE OPERATOR|#RIGHTWARDS ARROW ABOVE REVERSE TILDE OPERATOR|#DOWNWARDS TRIANGLE-HEADED ZIGZAG ARROW|#SHORT SLANTED NORTH ARROW|)BACKSLANTED SOUTH ARROW|#WHITE MEDIUM STAR|#BLACK SMALL STAR|#WHITE SMALL STAR|#BLACK RIGHT-POINTING PENTAGON|#WHITE RIGHT-POINTING PENTAGON|#HEAVY LARGE CIRCLE|)OVAL WITH OVAL INSIDE|)CIRCLE WITH CIRCLE INSIDE|/|/D SALTIRE|#SLANTED NORTH ARROW WITH HOOKED HEAD|#BACKSLANTED SOUTH ARROW WITH HOOKED TAIL|#SLANTED NORTH ARROW WITH HORIZONTAL TAIL|#BACKSLANTED SOUTH ARROW WITH HORIZONTAL TAIL|$ENT ARROW POINTING DOWNWARDS THEN NORTH EAST|#SHORT BENT ARROW POINTING DOWNWARDS THEN NORTH EAST|#LEFTWARDS TRIANGLE-HEADED ARROW|#UPWARDS TRIANGLE-HEADED ARROW|#RIGHTWARDS TRIANGLE-HEADED ARROW|#DOWNWARDS TRIANGLE-HEADED ARROW|#LEFT RIGHT TRIANGLE-HEADED ARROW|#UP DOWN TRIANGLE-HEADED ARROW|#NORTH WEST TRIANGLE-HEADED ARROW|)EAST TRIANGLE-HEADED ARROW|#SOUTH EAST TRIANGLE-HEADED ARROW|)WEST TRIANGLE-HEADED ARROW|#LEFTWARDS TRIANGLE-HEADED DASHED ARROW|#UPWARDS TRIANGLE-HEADED DASHED ARROW|#RIGHTWARDS TRIANGLE-HEADED DASHED ARROW|#DOWNWARDS TRIANGLE-HEADED DASHED ARROW|#CLOCKWISE TRIANGLE-HEADED OPEN CIRCLE ARROW|#ANTICLOCKWISE TRIANGLE-HEADED OPEN CIRCLE ARROW|#LEFTWARDS TRIANGLE-HEADED ARROW TO BAR|#UPWARDS TRIANGLE-HEADED ARROW TO BAR|#RIGHTWARDS TRIANGLE-HEADED ARROW TO BAR|#DOWNWARDS TRIANGLE-HEADED ARROW TO BAR|#NORTH WEST TRIANGLE-HEADED ARROW TO BAR|)EAST TRIANGLE-HEADED ARROW TO BAR|#SOUTH EAST TRIANGLE-HEADED ARROW TO BAR|)WEST TRIANGLE-HEADED ARROW TO BAR|#LEFTWARDS TRIANGLE-HEADED ARROW WITH DOUBLE HORIZONTAL STROKE|#UPWARDS TRIANGLE-HEADED ARROW WITH DOUBLE HORIZONTAL STROKE|#RIGHTWARDS TRIANGLE-HEADED ARROW WITH DOUBLE HORIZONTAL STROKE|#DOWNWARDS TRIANGLE-HEADED ARROW WITH DOUBLE HORIZONTAL STROKE|#HORIZONTAL TAB KEY|#VERTICAL TAB KEY|#LEFTWARDS TRIANGLE-HEADED ARROW OVER RIGHTWARDS TRIANGLE-HEADED ARROW|#UPWARDS TRIANGLE-HEADED ARROW LEFTWARDS OF DOWNWARDS TRIANGLE-HEADED ARROW|#RIGHTWARDS TRIANGLE-HEADED ARROW OVER LEFTWARDS TRIANGLE-HEADED ARROW|#DOWNWARDS TRIANGLE-HEADED ARROW LEFTWARDS OF UPWARDS TRIANGLE-HEADED ARROW|#LEFTWARDS TRIANGLE-HEADED PAIRED ARROWS|#UPWARDS TRIANGLE-HEADED PAIRED ARROWS|#RIGHTWARDS TRIANGLE-HEADED PAIRED ARROWS|#DOWNWARDS TRIANGLE-HEADED PAIRED ARROWS|#LEFTWARDS BLACK CIRCLED WHITE ARROW|#UPWARDS BLACK CIRCLED WHITE ARROW|#RIGHTWARDS BLACK CIRCLED WHITE ARROW|#DOWNWARDS BLACK CIRCLED WHITE ARROW|#ANTICLOCKWISE TRIANGLE-HEADED RIGHT U-SHAPED ARROW|ABOTTOM U-SHAPED ARROW|ALEFT U-SHAPED ARROW|ATOP U-SHAPED ARROW|#RETURN LEFT|*RIGHT|#NEWLINE LEFT|+RIGHT|#FOUR CORNER ARROWS CIRCLING ANTICLOCKWISE|#RIGHTWARDS BLACK ARROW|#EQUALS SIGN WITH INFINITY ABOVE|#SYMBOL FOR TYPE A ELECTRONICS|#THREE-D TOP-LIGHTED LEFTWARDS EQUILATERAL ARROWHEAD|+RIGHT-LIGHTED UPWARDS EQUILATERAL ARROWHEAD|+TOP-LIGHTED RIGHTWARDS EQUILATERAL ARROWHEAD|+LEFT-LIGHTED DOWNWARDS EQUILATERAL ARROWHEAD|#BLACK LEFTWARDS EQUILATERAL ARROWHEAD|)UPWARDS EQUILATERAL ARROWHEAD|)RIGHTWARDS EQUILATERAL ARROWHEAD|)DOWNWARDS EQUILATERAL ARROWHEAD|#DOWNWARDS TRIANGLE-HEADED ARROW WITH LONG TIP LEFTWARDS|QRIGHTWARDS|#UPWARDS TRIANGLE-HEADED ARROW WITH LONG TIP LEFTWARDS|ORIGHTWARDS|#LEFTWARDS TRIANGLE-HEADED ARROW WITH LONG TIP UPWARDS|#RIGHTWARDS TRIANGLE-HEADED ARROW WITH LONG TIP UPWARDS|#LEFTWARDS TRIANGLE-HEADED ARROW WITH LONG TIP DOWNWARDS|#RIGHTWARDS TRIANGLE-HEADED ARROW WITH LONG TIP DOWNWARDS|#BLACK CURVED DOWNWARDS AND LEFTWARDS ARROW|>RIGHTWARDS ARROW|0UPWARDS AND LEFTWARDS ARROW|<RIGHTWARDS ARROW|0LEFTWARDS AND UPWARDS ARROW|0RIGHTWARDS AND UPWARDS ARROW|0LEFTWARDS AND DOWNWARDS ARROW|0RIGHTWARDS AND DOWNWARDS ARROW|#RIBBON ARROW DOWN LEFT|5RIGHT|0UP LEFT|3RIGHT|0LEFT UP|0RIGHT UP|0LEFT DOWN|0RIGHT DOWN|#UPWARDS WHITE ARROW FROM BAR WITH HORIZONTAL BAR|% ARROWHEAD IN A RECTANGLE BOX|#OVERLAPPING WHITE SQUARES|5AND BLACK SQUARES|/BLACK SQUARES|#BALLOT BOX WITH LIGHT X|#CIRCLED X|+BOLD X|#BLACK SQUARE CENTRED|)DIAMOND CENTRED|#TURNED BLACK PENTAGON|#HORIZONTAL BLACK OCTAGON|#BLACK OCTAGON|)MEDIUM UP-POINTING TRIANGLE CENTRED|0DOWN-POINTING TRIANGLE CENTRED|0LEFT-POINTING TRIANGLE CENTRED|0RIGHT-POINTING TRIANGLE CENTRED|#NEPTUNE FORM TWO|#TOP HALF BLACK CIRCLE|#BOTTOM HALF BLACK CIRCLE|#LIGHT FOUR POINTED BLACK CUSP|#ROTATED LIGHT FOUR POINTED BLACK CUSP|#WHITE FOUR POINTED CUSP|#ROTATED WHITE FOUR POINTED CUSP|#SQUARE POSITION INDICATOR|#UNCERTAINTY SIGN|#GROUP MARK|#PLUTO FORM TWO|/HREE|.FOUR|/IVE|#TRANSPLUTO|#PROSERPINA|#ASTRAEA|#HYGIEA|#PHOLUS|#NESSUS|#WHITE MOON SELENA|#BLACK DIAMOND ON CROSS|#TRUE LIGHT MOON ARTA|#CUPIDO|#HADES|#ZEUS|#KRONOS|#APOLLON|$DMETOS|#VULCANUS|#POSEIDON|#LEFT HALF BLACK STAR|#RIGHT HALF BLACK STAR|#STAR WITH LEFT HALF BLACK|-RIGHT HALF BLACK|#LEFTWARDS TWO-HEADED ARROW WITH TRIANGLE ARROWHEADS|#UPWARDS TWO-HEADED ARROW WITH TRIANGLE ARROWHEADS|#RIGHTWARDS TWO-HEADED ARROW WITH TRIANGLE ARROWHEADS|#DOWNWARDS TWO-HEADED ARROW WITH TRIANGLE ARROWHEADS|#ERIS FORM ONE|-TWO|#SEDNA|#RUSSIAN ASTROLOGICAL SYMBOL VIGINTILE|?NOVILE|?QUINTILE|?BINOVILE|?SENTAGON|?TREDECILE|#EQUALS SIGN WITH INFINITY BELOW|#UNITED SYMBOL|#SEPARATED SYMBOL|#DOUBLED SYMBOL|#PASSED SYMBOL|#REVERSED RIGHT ANGLE|#HELLSCHREIBER PAUSE SYMBOL|#GLAGOLITIC CAPITAL LETTER AZU|=BUKY|=VEDE|=GLAGOLI|=DOBRO|=YESTU|=ZHIVETE|=DZELO|=ZEMLJA|=IZHE|>NITIAL IZHE|>|=DJERVI|=KAKO|=LJUDIJE|=MYSLITE|=NASHI|=ONU|=POKOJI|=RITSI|=SLOVO|=TVRIDO|=UKU|=FRITU|=HERU|=OTU|=PE|=SHTA|=TSI|=CHRIVI|=SHA|=YERU|@I|>ATI|=SPIDERY HA|=YU|=SMALL YUS|F WITH TAIL|=YO|=IOTATED SMALL YUS|=BIG YUS|=IOTATED BIG YUS|=FITA|=IZHITSA|=SHTAPIC|=TROKUTASTI A|=LATINATE MYSLITE|=CAUDATE CHRIVI|.SMALL LETTER AZU|;BUKY|;VEDE|;GLAGOLI|;DOBRO|;YESTU|;ZHIVETE|;DZELO|;ZEMLJA|;IZHE|<NITIAL IZHE|<|;DJERVI|;KAKO|;LJUDIJE|;MYSLITE|;NASHI|;ONU|;POKOJI|;RITSI|;SLOVO|;TVRIDO|;UKU|;FRITU|;HERU|;OTU|;PE|;SHTA|;TSI|;CHRIVI|;SHA|;YERU|>I|<ATI|;SPIDERY HA|;YU|;SMALL YUS|D WITH TAIL|;YO|;IOTATED SMALL YUS|;BIG YUS|;IOTATED BIG YUS|;FITA|;IZHITSA|;SHTAPIC|;TROKUTASTI A|;LATINATE MYSLITE|;CAUDATE CHRIVI|#LATIN CAPITAL LETTER L WITH DOUBLE BAR|)SMALL LETTER L WITH DOUBLE BAR|)CAPITAL LETTER L WITH MIDDLE TILDE|8P WITH STROKE|8R WITH TAIL|)SMALL LETTER A WITH STROKE|6T WITH DIAGONAL STROKE|)CAPITAL LETTER H WITH DESCENDER|)SMALL LETTER H WITH DESCENDER|)CAPITAL LETTER K WITH DESCENDER|)SMALL LETTER K WITH DESCENDER|)CAPITAL LETTER Z WITH DESCENDER|)SMALL LETTER Z WITH DESCENDER|)CAPITAL LETTER ALPHA|8M WITH HOOK|8TURNED A|@LPHA|)SMALL LETTER V WITH RIGHT HOOK|)CAPITAL LETTER W WITH HOOK|)SMALL LETTER W WITH HOOK|6V WITH CURL|)CAPITAL LETTER HALF H|)SMALL LETTER HALF H|6TAILLESS PHI|6E WITH NOTCH|6TURNED R WITH TAIL|6O WITH LOW RING INSIDE|)LETTER SMALL CAPITAL TURNED E|)SUBSCRIPT SMALL LETTER J|#MODIFIER LETTER CAPITAL V|#LATIN CAPITAL LETTER S WITH SWASH TAIL|8Z WITH SWASH TAIL|#COPTIC CAPITAL LETTER ALFA|*SMALL LETTER ALFA|*CAPITAL LETTER VIDA|*SMALL LETTER VIDA|*CAPITAL LETTER GAMMA|*SMALL LETTER GAMMA|*CAPITAL LETTER DALDA|*SMALL LETTER DALDA|*CAPITAL LETTER EIE|*SMALL LETTER EIE|*CAPITAL LETTER SOU|*SMALL LETTER SOU|*CAPITAL LETTER ZATA|*SMALL LETTER ZATA|*CAPITAL LETTER HATE|*SMALL LETTER HATE|*CAPITAL LETTER THETHE|*SMALL LETTER THETHE|*CAPITAL LETTER IAUDA|*SMALL LETTER IAUDA|*CAPITAL LETTER KAPA|*SMALL LETTER KAPA|*CAPITAL LETTER LAULA|*SMALL LETTER LAULA|*CAPITAL LETTER MI|*SMALL LETTER MI|*CAPITAL LETTER NI|*SMALL LETTER NI|*CAPITAL LETTER KSI|*SMALL LETTER KSI|*CAPITAL LETTER O|*SMALL LETTER O|*CAPITAL LETTER PI|*SMALL LETTER PI|*CAPITAL LETTER RO|*SMALL LETTER RO|*CAPITAL LETTER SIMA|*SMALL LETTER SIMA|*CAPITAL LETTER TAU|*SMALL LETTER TAU|*CAPITAL LETTER UA|*SMALL LETTER UA|*CAPITAL LETTER FI|*SMALL LETTER FI|*CAPITAL LETTER KHI|*SMALL LETTER KHI|*CAPITAL LETTER PSI|*SMALL LETTER PSI|*CAPITAL LETTER OOU|*SMALL LETTER OOU|*CAPITAL LETTER DIALECT-P ALEF|*SMALL LETTER DIALECT-P ALEF|*CAPITAL LETTER OLD COPTIC AIN|*SMALL LETTER OLD COPTIC AIN|*CAPITAL LETTER CRYPTOGRAMMIC EIE|*SMALL LETTER CRYPTOGRAMMIC EIE|*CAPITAL LETTER DIALECT-P KAPA|*SMALL LETTER DIALECT-P KAPA|*CAPITAL LETTER DIALECT-P NI|*SMALL LETTER DIALECT-P NI|*CAPITAL LETTER CRYPTOGRAMMIC NI|*SMALL LETTER CRYPTOGRAMMIC NI|*CAPITAL LETTER OLD COPTIC OOU|*SMALL LETTER OLD COPTIC OOU|*CAPITAL LETTER SAMPI|*SMALL LETTER SAMPI|*CAPITAL LETTER CROSSED SHEI|*SMALL LETTER CROSSED SHEI|*CAPITAL LETTER OLD COPTIC SHEI|*SMALL LETTER OLD COPTIC SHEI|*CAPITAL LETTER OLD COPTIC ESH|*SMALL LETTER OLD COPTIC ESH|*CAPITAL LETTER AKHMIMIC KHEI|*SMALL LETTER AKHMIMIC KHEI|*CAPITAL LETTER DIALECT-P HORI|*SMALL LETTER DIALECT-P HORI|*CAPITAL LETTER OLD COPTIC HORI|*SMALL LETTER OLD COPTIC HORI|*CAPITAL LETTER OLD COPTIC HA|*SMALL LETTER OLD COPTIC HA|*CAPITAL LETTER L-SHAPED HA|*SMALL LETTER L-SHAPED HA|*CAPITAL LETTER OLD COPTIC HEI|*SMALL LETTER OLD COPTIC HEI|*CAPITAL LETTER OLD COPTIC HAT|*SMALL LETTER OLD COPTIC HAT|*CAPITAL LETTER OLD COPTIC GANGIA|*SMALL LETTER OLD COPTIC GANGIA|*CAPITAL LETTER OLD COPTIC DJA|*SMALL LETTER OLD COPTIC DJA|*CAPITAL LETTER OLD COPTIC SHIMA|*SMALL LETTER OLD COPTIC SHIMA|*CAPITAL LETTER OLD NUBIAN SHIMA|*SMALL LETTER OLD NUBIAN SHIMA|*CAPITAL LETTER OLD NUBIAN NGI|*SMALL LETTER OLD NUBIAN NGI|*CAPITAL LETTER OLD NUBIAN NYI|*SMALL LETTER OLD NUBIAN NYI|*CAPITAL LETTER OLD NUBIAN WAU|*SMALL LETTER OLD NUBIAN WAU|+YMBOL KAI|1MI RO|1PI RO|1STAUROS|1TAU RO|1KHI RO|1SHIMA SIMA|*CAPITAL LETTER CRYPTOGRAMMIC SHEI|*SMALL LETTER CRYPTOGRAMMIC SHEI|*CAPITAL LETTER CRYPTOGRAMMIC GANGIA|*SMALL LETTER CRYPTOGRAMMIC GANGIA|*COMBINING NI ABOVE|4SPIRITUS ASPER|=LENIS|+APITAL LETTER BOHAIRIC KHEI|*SMALL LETTER BOHAIRIC KHEI|*OLD NUBIAN FULL STOP|5DIRECT QUESTION MARK|5INDIRECT QUESTION MARK|5VERSE DIVIDER|*FRACTION ONE HALF|+ULL STOP|*MORPHOLOGICAL DIVIDER|#GEORGIAN SMALL LETTER AN|9BAN|9GAN|9DON|9EN|9VIN|9ZEN|9TAN|9IN|9KAN|9LAS|9MAN|9NAR|9ON|9PAR|9ZHAR|9RAE|9SAN|9TAR|9UN|9PHAR|9KHAR|9GHAN|9QAR|9SHIN|9CHIN|:AN|9JIL|9CIL|:HAR|9XAN|9JHAN|9HAE|:E|:IE|9WE|9HAR|:OE|9YN|9AEN|#TIFINAGH LETTER YA|5B|6H|5G|6HH|3BERBER ACADEMY YAJ|3YAJ|5D|6H|6D|7H|4EY|4AF|5K|3TUAREG YAK|3YAKHH|5H|3BERBER ACADEMY YAH|3TUAREG YAH|3YAHH|5A|5KH|3TUAREG YAKH|3YAQ|3TUAREG YAQ|3YI|4AZH|3AHAGGAR YAZH|3TUAREG YAZH|3YAL|5M|5N|3TUAREG YAGN|<NG|3YAP|4U|4AR|6R|5GH|3TUAREG YAGH|3AYER YAGH|3YAS|6S|6H|5T|6H|5CH|5TT|5V|5W|5Y|5Z|3TAWELLEMET YAZ|3YAZZ|4E|4O|,MODIFIER LETTER LABIALIZATION MARK|,SEPARATOR MARK|,CONSONANT JOINER|#ETHIOPIC SYLLABLE LOA|5MOA|5ROA|5SOA|6HOA|5BOA|5TOA|5COA|5NOA|6YOA|5GLOTTAL OA|5ZOA|5DOA|6DOA|5JOA|5THOA|5CHOA|5PHOA|6OA|5GGWA|8I|8EE|9|5SSA|7U|7I|7AA|7EE|8|7O|5CCA|7U|7I|7AA|7EE|8|7O|5ZZA|7U|7I|7AA|7EE|8|7O|5CCHA|8U|8I|8AA|8EE|9|8O|5QYA|7U|7I|7AA|7EE|8|7O|5KYA|7U|7I|7AA|7EE|8|7O|5XYA|7U|7I|7AA|7EE|8|7O|5GYA|7U|7I|7AA|7EE|8|7O|#COMBINING CYRILLIC LETTER BE|=VE|=GHE|=DE|=ZHE|>E|=KA|=EL|>M|>N|=O|=PE|=ER|>S|=TE|=HA|=TSE|=CHE|=SHA|?CHA|=FITA|=ES-TE|=A|=IE|=DJERV|=MONOGRAPH UK|=YAT|>U|=IOTIFIED A|=LITTLE YUS|=BIG YUS|=IOTIFIED BIG YUS|#RIGHT ANGLE SUBSTITUTION MARKER|/DOTTED SUBSTITUTION MARKER|#LEFT SUBSTITUTION BRACKET|#RIGHT SUBSTITUTION BRACKET|#LEFT DOTTED SUBSTITUTION BRACKET|#RIGHT DOTTED SUBSTITUTION BRACKET|$AISED INTERPOLATION MARKER|*DOTTED INTERPOLATION MARKER|#DOTTED TRANSPOSITION MARKER|#LEFT TRANSPOSITION BRACKET|#RIGHT TRANSPOSITION BRACKET|$AISED SQUARE|#LEFT RAISED OMISSION BRACKET|#RIGHT RAISED OMISSION BRACKET|#EDITORIAL CORONIS|#PARAGRAPHOS|#FORKED PARAGRAPHOS|#REVERSED FORKED PARAGRAPHOS|#HYPODIASTOLE|#DOTTED OBELOS|%WNWARDS ANCORA|#UPWARDS ANCORA|#DOTTED RIGHT-POINTING ANGLE|%UBLE OBLIQUE HYPHEN|#INVERTED INTERROBANG|#PALM BRANCH|#HYPHEN WITH DIAERESIS|#TILDE WITH RING ABOVE|#LEFT LOW PARAPHRASE BRACKET|#RIGHT LOW PARAPHRASE BRACKET|#TILDE WITH DOT ABOVE|2BELOW|#LEFT VERTICAL BAR WITH QUILL|#RIGHT VERTICAL BAR WITH QUILL|#TOP LEFT HALF BRACKET|'RIGHT HALF BRACKET|#BOTTOM LEFT HALF BRACKET|*RIGHT HALF BRACKET|#LEFT SIDEWAYS U BRACKET|#RIGHT SIDEWAYS U BRACKET|#LEFT DOUBLE PARENTHESIS|#RIGHT DOUBLE PARENTHESIS|#TWO DOTS OVER ONE DOT PUNCTUATION|#ONE DOT OVER TWO DOTS PUNCTUATION|#SQUARED FOUR DOT PUNCTUATION|#FIVE DOT MARK|#REVERSED QUESTION MARK|#VERTICAL TILDE|#RING POINT|#WORD SEPARATOR MIDDLE DOT|#TURNED COMMA|#RAISED DOT|*COMMA|#TURNED SEMICOLON|#DAGGER WITH LEFT GUARD|/RIGHT GUARD|#TURNED DAGGER|$OP HALF SECTION SIGN|$WO-EM DASH|$HREE-EM DASH|#STENOGRAPHIC FULL STOP|#VERTICAL SIX DOTS|#WIGGLY VERTICAL LINE|#CAPITULUM|#DOUBLE HYPHEN|#REVERSED COMMA|#DOUBLE LOW-REVERSED-9 QUOTATION MARK|$ASH WITH LEFT UPTURN|$OUBLE SUSPENSION MARK|#INVERTED LOW KAVYKA|6 WITH KAVYKA ABOVE|#LOW KAVYKA|- WITH DOT|#DOUBLE STACKED COMMA|%TTED SOLIDUS|#TRIPLE DAGGER|#MEDIEVAL COMMA|#PARAGRAPHUS MARK|$UNCTUS ELEVATUS MARK|#CORNISH VERSE DIVIDER|$ROSS PATTY WITH RIGHT CROSSBAR|4LEFT CROSSBAR|#TIRONIAN SIGN CAPITAL ET|#MEDIEVAL EXCLAMATION MARK|,QUESTION MARK|#LEFT SQUARE BRACKET WITH STROKE|#RIGHT SQUARE BRACKET WITH STROKE|#LEFT SQUARE BRACKET WITH DOUBLE STROKE|#RIGHT SQUARE BRACKET WITH DOUBLE STROKE|#TOP HALF LEFT PARENTHESIS|,RIGHT PARENTHESIS|#BOTTOM HALF LEFT PARENTHESIS|/RIGHT PARENTHESIS|#OBLIQUE HYPHEN|#WIGGLY EXCLAMATION MARK|#INVERTED WIGGLY EXCLAMATION MARK|#LEFT PARENTHESIS WITH MIDDLE RING|#RIGHT PARENTHESIS WITH MIDDLE RING|#CJK RADICAL REPEAT|/CLIFF|/SECOND ONE|6TWO|7HREE|/PERSON|/BOX|/TABLE|/KNIFE ONE|5TWO|/DIVINATION|/SEAL|0MALL ONE|5TWO|/LAME ONE|4TWO|5HREE|4FOUR|/SNAKE|/THREAD|/SNOUT ONE|5TWO|/HEART ONE|5TWO|0AND|/RAP|/CHOKE|/SUN|/MOON|/DEATH|/MOTHER|/CIVILIAN|/WATER ONE|5TWO|/FIRE|/PAW ONE|3TWO|/SIMPLIFIED HALF TREE TRUNK|/COW|/DOG|/JADE|/BOLT OF CLOTH|/EYE|/SPIRIT ONE|6TWO|/BAMBOO|/SILK|/C-SIMPLIFIED SILK|/NET ONE|3TWO|4HREE|3FOUR|/MESH|/SHEEP|/RAM|/EWE|/OLD|/BRUSH ONE|5TWO|/MEAT|0ORTAR|/GRASS ONE|5TWO|6HREE|/TIGER|/CLOTHES|/WEST ONE|4TWO|/C-SIMPLIFIED SEE|/SIMPLIFIED HORN|/HORN|/C-SIMPLIFIED SPEECH|=HELL|/FOOT|/C-SIMPLIFIED CART|/SIMPLIFIED WALK|/WALK ONE|4TWO|/CITY|0-SIMPLIFIED GOLD|/LONG ONE|4TWO|/C-SIMPLIFIED LONG|<GATE|/MOUND ONE|5TWO|/RAIN|/BLUE|/C-SIMPLIFIED TANNED LEATHER|<LEAF|<WIND|<FLY|/EAT ONE|3TWO|4HREE|/C-SIMPLIFIED EAT|/HEAD|/C-SIMPLIFIED HORSE|/BONE|/GHOST|/C-SIMPLIFIED FISH|<BIRD|<SALT|/SIMPLIFIED WHEAT|:YELLOW|/C-SIMPLIFIED FROG|/J-SIMPLIFIED EVEN|/C-SIMPLIFIED EVEN|/J-SIMPLIFIED TOOTH|/C-SIMPLIFIED TOOTH|/J-SIMPLIFIED DRAGON|/C-SIMPLIFIED DRAGON|/TURTLE|/J-SIMPLIFIED TURTLE|/C-SIMPLIFIED TURTLE|#KANGXI RADICAL ONE|2LINE|2DOT|2SLASH|3ECOND|2HOOK|2TWO|2LID|2MAN|2LEGS|2ENTER|3IGHT|2DOWN BOX|2COVER|2ICE|2TABLE|2OPEN BOX|2KNIFE|2POWER|2WRAP|2SPOON|2RIGHT OPEN BOX|2HIDING ENCLOSURE|2TEN|2DIVINATION|2SEAL|2CLIFF|2PRIVATE|2AGAIN|2MOUTH|2ENCLOSURE|3ARTH|2SCHOLAR|2GO|4 SLOWLY|2EVENING|2BIG|2WOMAN|2CHILD|2ROOF|2INCH|2SMALL|2LAME|2CORPSE|2SPROUT|2MOUNTAIN|2RIVER|2WORK|2ONESELF|2TURBAN|2DRY|2SHORT THREAD|2DOTTED CLIFF|2LONG STRIDE|2TWO HANDS|2SHOOT|2BOW|2SNOUT|2BRISTLE|2STEP|2HEART|3ALBERD|2DOOR|2HAND|2BRANCH|2RAP|2SCRIPT|2DIPPER|2AXE|2SQUARE|2NOT|2SUN|3AY|2MOON|2TREE|2LACK|2STOP|2DEATH|2WEAPON|2DO NOT|2COMPARE|2FUR|2CLAN|2STEAM|2WATER|2FIRE|2CLAW|2FATHER|2DOUBLE X|2HALF TREE TRUNK|2SLICE|2FANG|2COW|2DOG|2PROFOUND|2JADE|2MELON|2TILE|2SWEET|2LIFE|2USE|2FIELD|2BOLT OF CLOTH|2SICKNESS|2DOTTED TENT|2WHITE|2SKIN|2DISH|2EYE|2SPEAR|2ARROW|2STONE|3PIRIT|2TRACK|2GRAIN|2CAVE|2STAND|2BAMBOO|2RICE|2SILK|2JAR|2NET|2SHEEP|2FEATHER|2OLD|2AND|2PLOW|2EAR|2BRUSH|2MEAT|3INISTER|2SELF|2ARRIVE|2MORTAR|2TONGUE|2OPPOSE|2BOAT|2STOPPING|2COLOR|2GRASS|2TIGER|2INSECT|2BLOOD|2WALK ENCLOSURE|2CLOTHES|2WEST|2SEE|2HORN|2SPEECH|2VALLEY|2BEAN|2PIG|2BADGER|2SHELL|2RED|3UN|2FOOT|2BODY|2CART|2BITTER|2MORNING|2WALK|2CITY|2WINE|2DISTINGUISH|2VILLAGE|2GOLD|2LONG|2GATE|2MOUND|2SLAVE|3HORT TAILED BIRD|2RAIN|2BLUE|2WRONG|2FACE|2LEATHER|2TANNED LEATHER|2LEEK|2SOUND|2LEAF|2WIND|2FLY|2EAT|2HEAD|2FRAGRANT|2HORSE|2BONE|2TALL|2HAIR|2FIGHT|2SACRIFICIAL WINE|2CAULDRON|2GHOST|2FISH|2BIRD|2SALT|2DEER|2WHEAT|2HEMP|2YELLOW|2MILLET|2BLACK|2EMBROIDERY|2FROG|2TRIPOD|2DRUM|2RAT|2NOSE|2EVEN|2TOOTH|2DRAGON|2TURTLE|2FLUTE|#IDEOGRAPHIC DESCRIPTION CHARACTER LEFT TO RIGHT|EABOVE TO BELOW|ELEFT TO MIDDLE AND RIGHT|EABOVE TO MIDDLE AND BELOW|EFULL SURROUND|ESURROUND FROM ABOVE|SBELOW|SLEFT|SUPPER LEFT|YRIGHT|SLOWER LEFT|EOVERLAID|ESURROUND FROM RIGHT|SLOWER RIGHT|EHORIZONTAL REFLECTION|EROTATION|/SPACE|/COMMA|/FULL STOP|#DITTO MARK|#JAPANESE INDUSTRIAL STANDARD SYMBOL|#IDEOGRAPHIC ITERATION MARK|/CLOSING MARK|/NUMBER ZERO|#LEFT ANGLE BRACKET|#RIGHT ANGLE BRACKET|#LEFT DOUBLE ANGLE BRACKET|#RIGHT DOUBLE ANGLE BRACKET|#LEFT CORNER BRACKET|#RIGHT CORNER BRACKET|#LEFT WHITE CORNER BRACKET|#RIGHT WHITE CORNER BRACKET|#LEFT BLACK LENTICULAR BRACKET|#RIGHT BLACK LENTICULAR BRACKET|#POSTAL MARK|#GETA MARK|#LEFT TORTOISE SHELL BRACKET|#RIGHT TORTOISE SHELL BRACKET|#LEFT WHITE LENTICULAR BRACKET|#RIGHT WHITE LENTICULAR BRACKET|#LEFT WHITE TORTOISE SHELL BRACKET|#RIGHT WHITE TORTOISE SHELL BRACKET|#LEFT WHITE SQUARE BRACKET|#RIGHT WHITE SQUARE BRACKET|#WAVE DASH|#REVERSED DOUBLE PRIME QUOTATION MARK|#DOUBLE PRIME QUOTATION MARK|#LOW DOUBLE PRIME QUOTATION MARK|#POSTAL MARK FACE|#HANGZHOU NUMERAL ONE|4TWO|5HREE|4FOUR|5IVE|4SIX|5EVEN|4EIGHT|4NINE|#IDEOGRAPHIC LEVEL TONE MARK|/RISING TONE MARK|/DEPARTING TONE MARK|/ENTERING TONE MARK|#HANGUL SINGLE DOT TONE MARK|*DOUBLE DOT TONE MARK|#WAVY DASH|#VERTICAL KANA REPEAT MARK|8WITH VOICED SOUND MARK|8MARK UPPER HALF|8WITH VOICED SOUND MARK UPPER HALF|8MARK LOWER HALF|#CIRCLED POSTAL MARK|#IDEOGRAPHIC TELEGRAPH LINE FEED SEPARATOR SYMBOL|#HANGZHOU NUMERAL TEN|5WENTY|5HIRTY|#VERTICAL IDEOGRAPHIC ITERATION MARK|#MASU MARK|#PART ALTERNATION MARK|#IDEOGRAPHIC VARIATION INDICATOR|/HALF FILL SPACE|#HIRAGANA LETTER SMALL A|3A|3SMALL I|3I|3SMALL U|3U|3SMALL E|3E|3SMALL O|3O|3KA|3GA|3KI|3GI|3KU|3GU|3KE|3GE|3KO|3GO|3SA|3ZA|3SI|3ZI|3SU|3ZU|3SE|3ZE|3SO|3ZO|3TA|3DA|3TI|3DI|3SMALL TU|3TU|3DU|3TE|3DE|3TO|3DO|3NA|4I|4U|4E|4O|3HA|3BA|3PA|3HI|3BI|3PI|3HU|3BU|3PU|3HE|3BE|3PE|3HO|3BO|3PO|3MA|4I|4U|4E|4O|3SMALL YA|3YA|3SMALL YU|3YU|3SMALL YO|3YO|3RA|4I|4U|4E|4O|3SMALL WA|3WA|4I|4E|4O|3N|3VU|3SMALL KA|:E|#COMBINING KATAKANA-HIRAGANA VOICED SOUND MARK|?SEMI-VOICED SOUND MARK|#KATAKANA-HIRAGANA VOICED SOUND MARK|5SEMI-VOICED SOUND MARK|#HIRAGANA ITERATION MARK|,VOICED ITERATION MARK|,DIGRAPH YORI|#KATAKANA-HIRAGANA DOUBLE HYPHEN|+ LETTER SMALL A|3A|3SMALL I|3I|3SMALL U|3U|3SMALL E|3E|3SMALL O|3O|3KA|3GA|3KI|3GI|3KU|3GU|3KE|3GE|3KO|3GO|3SA|3ZA|3SI|3ZI|3SU|3ZU|3SE|3ZE|3SO|3ZO|3TA|3DA|3TI|3DI|3SMALL TU|3TU|3DU|3TE|3DE|3TO|3DO|3NA|4I|4U|4E|4O|3HA|3BA|3PA|3HI|3BI|3PI|3HU|3BU|3PU|3HE|3BE|3PE|3HO|3BO|3PO|3MA|4I|4U|4E|4O|3SMALL YA|3YA|3SMALL YU|3YU|3SMALL YO|3YO|3RA|4I|4U|4E|4O|3SMALL WA|3WA|4I|4E|4O|3N|3VU|3SMALL KA|:E|3VA|4I|4E|4O|,MIDDLE DOT|+-HIRAGANA PROLONGED SOUND MARK|+ ITERATION MARK|,VOICED ITERATION MARK|,DIGRAPH KOTO|#BOPOMOFO LETTER B|3P|3M|3F|3D|3T|3N|3L|3G|3K|3H|3J|3Q|3X|3ZH|3CH|3SH|3R|3Z|3C|3S|3A|3O|3E|4H|3AI|3EI|3AU|3OU|3AN|3EN|3ANG|3ENG|4R|3I|3U|3IU|3V|3NG|3GN|3IH|3O WITH DOT ABOVE|3NN|#HANGUL LETTER KIYEOK|1SSANGKIYEOK|1KIYEOK-SIOS|1NIEUN|6-CIEUC|7HIEUH|1TIKEUT|1SSANGTIKEUT|1RIEUL|6-KIYEOK|7MIEUM|7PIEUP|7SIOS|7THIEUTH|7PHIEUPH|7HIEUH|1MIEUM|1PIEUP|1SSANGPIEUP|1PIEUP-SIOS|1SIOS|2SANGSIOS|1IEUNG|1CIEUC|1SSANGCIEUC|1CHIEUCH|1KHIEUKH|1THIEUTH|1PHIEUPH|1HIEUH|1A|2E|1YA|3E|1EO|2|1YEO|3|1O|1WA|3E|1OE|1YO|1U|1WEO|3|2I|1YU|1EU|1YI|1I|*FILLER|*LETTER SSANGNIEUN|1NIEUN-TIKEUT|7SIOS|7PANSIOS|1RIEUL-KIYEOK-SIOS|7TIKEUT|7PIEUP-SIOS|8ANSIOS|7YEORINHIEUH|1MIEUM-PIEUP|7SIOS|7PANSIOS|1KAPYEOUNMIEUM|1PIEUP-KIYEOK|7TIKEUT|7SIOS-KIYEOK|<TIKEUT|7CIEUC|7THIEUTH|1KAPYEOUNPIEUP|9SSANGPIEUP|1SIOS-KIYEOK|6NIEUN|6TIKEUT|6PIEUP|6CIEUC|1PANSIOS|1SSANGIEUNG|1YESIEUNG|9-SIOS|:PANSIOS|1KAPYEOUNPHIEUPH|1SSANGHIEUH|1YEORINHIEUH|2O-YA|6E|4I|2U-YEO|6|4I|1ARAEA|6E|#IDEOGRAPHIC ANNOTATION LINKING MARK|:REVERSE MARK|:ONE MARK|:TWO MARK|;HREE MARK|:FOUR MARK|:TOP MARK|:MIDDLE MARK|:BOTTOM MARK|:FIRST MARK|:SECOND MARK|:THIRD MARK|:FOURTH MARK|:HEAVEN MARK|:EARTH MARK|:MAN MARK|#BOPOMOFO LETTER BU|3ZI|3JI|3GU|3EE|4NN|3OO|4NN|3IR|3ANN|3INN|3UNN|3IM|3NGG|3AINN|4UNN|4M|3OM|4NG|3INNN|,FINAL LETTER P|9T|9K|9H|,LETTER GH|3LH|3ZY|,FINAL LETTER G|,LETTER GW|3KW|3OE|3AH|#CJK STROKE T|.WG|.XG|.BXG|.SW|.HZZ|0G|/P|/ZWG|.SZWG|.HZT|0ZP|/PWG|/ZW|0ZZ|.N|.H|.S|.P|.SP|.D|.HZ|/G|.SZ|/WZ|/T|/G|.PD|/Z|.TN|.SZZ|/WG|.HXWG|/ZZZG|.PG|.Q|.HXG|.SZP|#IDEOGRAPHIC DESCRIPTION CHARACTER SUBTRACTION|#KATAKANA LETTER SMALL KU|9SI|:U|9TO|9NU|9HA|:I|:U|:E|:O|9MU|9RA|:I|:U|:E|:O|#PARENTHESIZED HANGUL KIYEOK|8NIEUN|8TIKEUT|8RIEUL|8MIEUM|8PIEUP|8SIOS|8IEUNG|8CIEUC|9HIEUCH|8KHIEUKH|8THIEUTH|8PHIEUPH|8HIEUH|8KIYEOK A|8NIEUN A|8TIKEUT A|8RIEUL A|8MIEUM A|8PIEUP A|8SIOS A|8IEUNG A|8CIEUC A|9HIEUCH A|8KHIEUKH A|8THIEUTH A|8PHIEUPH A|8HIEUH A|8CIEUC U|1KOREAN CHARACTER OJEON|C HU|1IDEOGRAPH ONE|;TWO|<HREE|;FOUR|<IVE|;SIX|<EVEN|;EIGHT|;NINE|;TEN|;MOON|;FIRE|;WATER|<OOD|;METAL|;EARTH|;SUN|<TOCK|;HAVE|;SOCIETY|;NAME|;SPECIAL|;FINANCIAL|;CONGRATULATION|;LABOR|;REPRESENT|;CALL|;STUDY|<UPERVISE|;ENTERPRISE|;RESOURCE|;ALLIANCE|;FESTIVAL|;REST|;SELF|;REACH|#CIRCLED IDEOGRAPH QUESTION|5KINDERGARTEN|5SCHOOL|5KOTO|+NUMBER TEN ON BLACK SQUARE|3WENTY ON BLACK SQUARE|3HIRTY ON BLACK SQUARE|2FORTY ON BLACK SQUARE|3IFTY ON BLACK SQUARE|2SIXTY ON BLACK SQUARE|3EVENTY ON BLACK SQUARE|2EIGHTY ON BLACK SQUARE|#PARTNERSHIP SIGN|#CIRCLED NUMBER TWENTY ONE|9TWO|:HREE|9FOUR|:IVE|9SIX|:EVEN|9EIGHT|9NINE|3HIRTY|8 ONE|9TWO|:HREE|9FOUR|:IVE|+HANGUL KIYEOK|2NIEUN|2TIKEUT|2RIEUL|2MIEUM|2PIEUP|2SIOS|2IEUNG|2CIEUC|3HIEUCH|2KHIEUKH|2THIEUTH|2PHIEUPH|2HIEUH|2KIYEOK A|2NIEUN A|2TIKEUT A|2RIEUL A|2MIEUM A|2PIEUP A|2SIOS A|2IEUNG A|2CIEUC A|3HIEUCH A|2KHIEUKH A|2THIEUTH A|2PHIEUPH A|2HIEUH A|+KOREAN CHARACTER CHAMKO|<JUEUI|+HANGUL IEUNG U|#KOREAN STANDARD SYMBOL|#CIRCLED IDEOGRAPH ONE|5TWO|6HREE|5FOUR|6IVE|5SIX|6EVEN|5EIGHT|5NINE|5TEN|5MOON|5FIRE|5WATER|6OOD|5METAL|5EARTH|5SUN|6TOCK|5HAVE|5SOCIETY|5NAME|5SPECIAL|5FINANCIAL|5CONGRATULATION|5LABOR|5SECRET|5MALE|5FEMALE|5SUITABLE|5EXCELLENT|5PRINT|5ATTENTION|5ITEM|5REST|5COPY|7RRECT|5HIGH|5CENTRE|5LOW|6EFT|5RIGHT|5MEDICINE|5RELIGION|5STUDY|6UPERVISE|5ENTERPRISE|5RESOURCE|5ALLIANCE|5NIGHT|+NUMBER THIRTY SIX|:EVEN|9EIGHT|9NINE|2FORTY|7 ONE|8TWO|9HREE|8FOUR|9IVE|8SIX|9EVEN|8EIGHT|8NINE|3IFTY|#IDEOGRAPHIC TELEGRAPH SYMBOL FOR JANUARY|DFEBRUARY|DMARCH|DAPRIL|DMAY|DJUNE|FLY|DAUGUST|DSEPTEMBER|DOCTOBER|DNOVEMBER|DDECEMBER|#SQUARE HG|*ERG|+V|#LIMITED LIABILITY SIGN|#CIRCLED KATAKANA A|4I|4U|4E|4O|4KA|5I|5U|5E|5O|4SA|5I|5U|5E|5O|4TA|5I|5U|5E|5O|4NA|5I|5U|5E|5O|4HA|5I|5U|5E|5O|4MA|5I|5U|5E|5O|4YA|5U|5O|4RA|5I|5U|5E|5O|4WA|5I|5E|5O|#SQUARE ERA NAME REIWA|*APAATO|+RUHUA|+NPEA|+ARU|*ININGU|,TI|*UON|*ESUKUUDO|+EKAA|*ONSU|+OMU|*KAIRI|,RATTO|-ORII|*GARON|,NMA|+IGA|,NII|*KYURII|*GIRUDAA|*KIRO|.GURAMU|.MEETORU|.WATTO|*GURAMU|0TON|*KURUZEIRO|-OONE|+EESU|+ORUNA|,OPO|*SAIKURU|,NTIIMU|+IRINGU|+ENTI|.O|*DAASU|+ESI|+ORU|*TON|*NANO|+OTTO|*HAITU|*PAASENTO|-TU|*BAARERU|*PIASUTORU|,KURU|-O|*BIRU|*HUARADDO|,IITO|*BUSSYERU|*HURAN|+EKUTAARU|*PESO|,NIHI|*HERUTU|*PENSU|,EZI|*BEETA|*POINTO|*BORUTO|*HON|*PONDO|*HOORU|-N|*MAIKURO|-RU|,HHA|,RUKU|,NSYON|+IKURON|,RI|.BAARU|+EGA|.TON|,ETORU|*YAADO|-RU|+UAN|*RITTORU|,RA|+UPII|,UBURU|+EMU|,NTOGEN|*WATTO|#IDEOGRAPHIC TELEGRAPH SYMBOL FOR HOUR ZERO|IONE|ITWO|JHREE|IFOUR|JIVE|ISIX|JEVEN|IEIGHT|ININE|ITEN|IELEVEN|ITWELVE|JHIRTEEN|IFOURTEEN|JIFTEEN|ISIXTEEN|JEVENTEEN|IEIGHTEEN|ININETEEN|ITWENTY|O-ONE|PTWO|QHREE|PFOUR|#SQUARE HPA|*DA|*AU|*BAR|*OV|*PC|*DM|, SQUARED|-CUBED|*IU|*ERA NAME HEISEI|3SYOUWA|3TAISYOU|3MEIZI|*CORPORATION|*PA AMPS|*NA|*MU A|+A|*KA|+B|*MB|*GB|*CAL|*KCAL|*PF|*NF|*MU F|-G|+G|*KG|*HZ|*KHZ|*MHZ|*GHZ|*THZ|*MU L|+L|*DL|*KL|*FM|*NM|*MU M|+M|*CM|*KM|*MM SQUARED|*CM SQUARED|*M SQUARED|*KM SQUARED|*MM CUBED|*CM CUBED|*M CUBED|*KM CUBED|*M OVER S|2 SQUARED|*PA|*KPA|*MPA|*GPA|*RAD|- OVER S|4 SQUARED|*PS|*NS|*MU S|+S|*PV|*NV|*MU V|+V|*KV|*MV MEGA|*PW|*NW|*MU W|+W|*KW|*MW MEGA|*K OHM|*M OHM|*AM|*BQ|*CC|+D|+ OVER KG|+O|*DB|*GY|*HA|+P|*IN|*KK|+M CAPITAL|+T|*LM|+N|+OG|+X|*MB SMALL|+IL|+OL|*PH|+M|+PM|+R|*SR|+V|*WB|*V OVER M|*A OVER M|#IDEOGRAPHIC TELEGRAPH SYMBOL FOR DAY ONE|HTWO|IHREE|HFOUR|IIVE|HSIX|IEVEN|HEIGHT|HNINE|HTEN|HELEVEN|HTWELVE|IHIRTEEN|HFOURTEEN|IIFTEEN|HSIXTEEN|IEVENTEEN|HEIGHTEEN|HNINETEEN|HTWENTY|N-ONE|OTWO|PHREE|OFOUR|PIVE|OSIX|PEVEN|OEIGHT|ONINE|IHIRTY|N-ONE|#SQUARE GAL|#HEXAGRAM FOR THE CREATIVE HEAVEN|4RECEPTIVE EARTH|0DIFFICULTY AT THE BEGINNING|0YOUTHFUL FOLLY|0WAITING|0CONFLICT|0THE ARMY|0HOLDING TOGETHER|0SMALL TAMING|0TREADING|0PEACE|0STANDSTILL|0FELLOWSHIP|0GREAT POSSESSION|0MODESTY|0ENTHUSIASM|0FOLLOWING|0WORK ON THE DECAYED|0APPROACH|0CONTEMPLATION|0BITING THROUGH|0GRACE|0SPLITTING APART|0RETURN|0INNOCENCE|0GREAT TAMING|0MOUTH CORNERS|0GREAT PREPONDERANCE|0THE ABYSMAL WATER|4CLINGING FIRE|0INFLUENCE|0DURATION|0RETREAT|0GREAT POWER|0PROGRESS|0DARKENING OF THE LIGHT|0THE FAMILY|0OPPOSITION|1BSTRUCTION|0DELIVERANCE|2CREASE|0INCREASE|0BREAKTHROUGH|0COMING TO MEET|0GATHERING TOGETHER|0PUSHING UPWARD|0OPPRESSION|0THE WELL|0REVOLUTION|0THE CAULDRON|4AROUSING THUNDER|4KEEPING STILL MOUNTAIN|0DEVELOPMENT|0THE MARRYING MAIDEN|0ABUNDANCE|0THE WANDERER|4GENTLE WIND|4JOYOUS LAKE|0DISPERSION|0LIMITATION|0INNER TRUTH|0SMALL PREPONDERANCE|0AFTER COMPLETION|0BEFORE COMPLETION|#YI SYLLABLE IT|0X|0|0P|0ET|1X|1|1P|/AT|0X|0|0P|/UOX|1|1P|/OT|0X|0|0P|/EX|0|/WU|/BIT|1X|1|1P|1ET|2X|2|2P|0AT|1X|1|1P|0UOX|2|2P|0OT|1X|1|1P|0EX|1|1P|0UT|1X|1|1P|1RX|2|0YT|1X|1|1P|1RX|2|/PIT|1X|1|1P|1EX|2|2P|0AT|1X|1|1P|0UOX|2|2P|0OT|1X|1|1P|0UT|1X|1|1P|1RX|2|0YT|1X|1|1P|1RX|2|/BBIT|2X|2|2P|2ET|3X|3|3P|1AT|2X|2|2P|1UOX|3|3P|1OT|2X|2|2P|1EX|2|2P|1UT|2X|2|2P|2RX|3|1YT|2X|2|2P|/NBIT|2X|2|2P|2EX|3|3P|1AT|2X|2|2P|1OT|2X|2|2P|1UT|2X|2|2P|2RX|3|1YT|2X|2|2P|2RX|3|/HMIT|2X|2|2P|2EX|3|3P|1AT|2X|2|2P|1UOX|3|3P|1OT|2X|2|2P|1UT|2X|2|2P|2RX|3|1YX|2|2P|2RX|3|/MIT|1X|1|1P|1EX|2|2P|0AT|1X|1|1P|0UOT|2X|2|2P|0OT|1X|1|1P|0EX|1|0UT|1X|1|1P|1RX|2|0YT|1X|1|1P|/FIT|1X|1|1P|0AT|1X|1|1P|0OX|1|1P|0UT|1X|1|1P|1RX|2|0YT|1X|1|1P|/VIT|1X|1|1P|1ET|2X|2|2P|0AT|1X|1|1P|0OT|1X|1|1P|0EX|1P|0UT|1X|1|1P|1RX|2|0YT|1X|1|1P|1RX|2|/DIT|1X|1|1P|1EX|2|2P|0AT|1X|1|1P|0UOX|2|0OT|1X|1|1P|0EX|1|1P|0UT|1X|1|1P|1RX|2|/TIT|1X|1|1P|1EX|2|2P|0AT|1X|1|1P|0UOT|2X|2|2P|0OT|1X|1|1P|0EX|1|1P|0UT|1X|1|1P|1RX|2|/DDIT|2X|2|2P|2EX|3|3P|1AT|2X|2|2P|1UOX|3|3P|1OT|2X|2|2P|1EX|2|2P|1UT|2X|2|2P|2RX|3|/NDIT|2X|2|2P|2EX|3|1AT|2X|2|2P|1OT|2X|2|2P|1EX|2|2P|1UT|2X|2|2P|2RX|3|/HNIT|2X|2|2P|2ET|3X|3|3P|1AT|2X|2|2P|1UOX|3|1OT|2X|2P|1EX|2|2P|1UT|/NIT|1X|1|1P|1EX|2|2P|0AX|1|1P|0UOX|2|2P|0OT|1X|1|1P|0EX|1|1P|0UT|1X|1|1P|1RX|2|/HLIT|2X|2|2P|2EX|3|3P|1AT|2X|2|2P|1UOX|3|3P|1OX|2|2P|1EX|2|2P|1UT|2X|2|2P|2RX|3|1YT|2X|2|2P|2RX|3|/LIT|1X|1|1P|1ET|2X|2|2P|0AT|1X|1|1P|0UOT|2X|2|2P|0OT|1X|1|1P|0EX|1|1P|0UT|1X|1|1P|1RX|2|0YT|1X|1|1P|1RX|2|/GIT|1X|1|1P|1ET|2X|2|2P|0AT|1X|1|1P|0UOT|2X|2|2P|0OT|1X|1|1P|0ET|1X|1|1P|0UT|1X|1|1P|1RX|2|/KIT|1X|1|1P|1EX|2|2P|0AT|1X|1|1P|0UOX|2|2P|0OT|1X|1|1P|0ET|1X|1|1P|0UT|1X|1|1P|1RX|2|/GGIT|2X|2|2EX|3|3P|1AT|2X|2|2P|1UOT|3X|3|3P|1OT|2X|2|2P|1ET|2X|2|2P|1UT|2X|2|2P|2RX|3|/MGIEX|3|1AT|2X|2|2P|1UOX|3|3P|1OT|2X|2|2P|1EX|2|2P|1UT|2X|2|2P|2RX|3|/HXIT|2X|2|2P|2ET|3X|3|3P|1AT|2X|2|2P|1UOT|3X|3|3P|1OT|2X|2|2P|1EX|2|2P|/NGIEX|3|3P|1AT|2X|2|2P|1UOT|3X|3|1OT|2X|2|2P|1EX|2|2P|/HIT|1EX|2|0AT|1X|1|1P|0UOT|2X|2|2P|0OT|1X|1|1P|0EX|1|1P|/WAT|1X|1|1P|0UOX|2|2P|0OX|1|1P|0EX|1|1P|/ZIT|1X|1|1P|1EX|2|2P|0AT|1X|1|1P|0UOX|2|2P|0OT|1X|1|1P|0EX|1|1P|0UT|1X|1|1P|1RX|2|0YT|1X|1|1P|1RX|2|/CIT|1X|1|1P|1ET|2X|2|2P|0AT|1X|1|1P|0UOX|2|2P|0OT|1X|1|1P|0EX|1|1P|0UT|1X|1|1P|1RX|2|0YT|1X|1|1P|1RX|2|/ZZIT|2X|2|2P|2ET|3X|3|3P|1AT|2X|2|2P|1OX|2|2P|1EX|2|2P|1UX|2|2P|2RX|3|1YT|2X|2|2P|2RX|3|/NZIT|2X|2|2P|2EX|3|3P|1AT|2X|2|2P|1UOX|3|1OX|2P|1EX|2|1UX|2|2P|2RX|3|1YT|2X|2|2P|2RX|3|/SIT|1X|1|1P|1EX|2|2P|0AT|1X|1|1P|0UOX|2|2P|0OT|1X|1|1P|0EX|1|1P|0UT|1X|1|1P|1RX|2|0YT|1X|1|1P|1RX|2|0SIT|2X|2|2P|2EX|3|3P|1AT|2X|2|2P|1OT|2X|2|2P|1EX|2|2P|1UT|2X|2|2P|1YT|2X|2|2P|2RX|3|/ZHAT|2X|2|2P|1UOX|3|3P|1OT|2X|2|2P|1ET|2X|2|2P|1UT|2X|2|2P|2RX|3|1YT|2X|2|2P|2RX|3|/CHAT|2X|2|2P|1UOT|3X|3|3P|1OT|2X|2|2P|1ET|2X|2|2P|1UX|2|2P|2RX|3|1YT|2X|2|2P|2RX|3|/RRAX|2|1UOX|3|1OT|2X|2|2P|1ET|2X|2|2P|1UT|2X|2|2P|2RX|3|1YT|2X|2|2P|2RX|3|/NRAT|2X|2|2P|1OX|2|2P|1ET|2X|2|2P|1UT|2X|2|2P|2RX|3|1YT|2X|2|2P|2RX|3|/SHAT|2X|2|2P|1UOX|3|3P|1OT|2X|2|2P|1ET|2X|2|2P|1UT|2X|2|2P|2RX|3|1YT|2X|2|2P|2RX|3|/RAT|1X|1|1P|0UOX|2|2P|0OT|1X|1|1P|0EX|1|1P|0UT|1X|1|1P|1RX|2|0YT|1X|1|1P|1RX|2|/JIT|1X|1|1P|1ET|2X|2|2P|0UOT|2X|2|2P|0OT|1X|1|1P|0UT|1X|1|1P|1RX|2|0YT|1X|1|1P|1RX|2|/QIT|1X|1|1P|1ET|2X|2|2P|0UOT|2X|2|2P|0OT|1X|1|1P|0UT|1X|1|1P|1RX|2|0YT|1X|1|1P|1RX|2|/JJIT|2X|2|2P|2ET|3X|3|3P|1UOX|3|3P|1OT|2X|2|2P|1UT|2X|2|2P|2RX|3|1YT|2X|2|2P|/NJIT|2X|2|2P|2ET|3X|3|3P|1UOX|3|1OT|2X|2|2P|1UX|2|2P|2RX|3|1YT|2X|2|2P|2RX|3|0YIT|2X|2|2P|2ET|3X|3|3P|1UOX|3|3P|1OT|2X|2|2P|1UT|2X|2|2P|/XIT|1X|1|1P|1ET|2X|2|2P|0UOX|2|0OT|1X|1|1P|0YT|1X|1|1P|1RX|2|/YIT|1X|1|1P|1ET|2X|2|2P|0UOT|2X|2|2P|0OT|1X|1|1P|0UT|1X|1|1P|1RX|2|0YT|1X|1|1P|1RX|2|&RADICAL QOT|.LI|.KIT|.NYIP|.CYP|.SSI|.GGOP|/EP|.MI|.HXIT|.LYR|.BBUT|.MOP|.YO|.PUT|.HXUO|.TAT|.GA|.ZUP|.CYT|.DDUR|.BUR|.GGUO|.NYOP|.TU|.OP|.JJUT|.ZOT|.PYT|.HMO|.YIT|.VUR|.SHY|.VEP|.ZA|.JO|.NZUP|.JJY|.GOT|.JJIE|.WO|.DU|.SHUR|.LIE|.CY|/UOP|/IP|.HXOP|.SHAT|.ZUR|.SHOP|.CHE|.ZZIET|.NBIE|.KE|#LISU LETTER BA|/PA|0HA|/DA|/TA|0HA|/GA|/KA|0HA|/JA|/CA|0HA|/DZA|/TSA|1HA|/MA|/NA|/LA|/SA|/ZHA|0A|/NGA|/HA|/XA|/HHA|/FA|/WA|/SHA|/YA|/GHA|/A|0E|/E|0U|/I|/O|/U|0E|0H|/OE|/TONE MYA TI|4NA PO|4MYA CYA|8BO|8NA|8JEU|(PUNCTUATION COMMA|4FULL STOP|#VAI SYLLABLE EE|2N|0HEE|0WEE|3N|0PEE|0BHEE|1EE|0MBEE|0KPEE|0MGBEE|0GBEE|0FEE|0VEE|0TEE|1HEE|0DHEE|2HEE|0LEE|0REE|0DEE|0NDEE|0SEE|1HEE|0ZEE|1HEE|0CEE|0JEE|0NJEE|0YEE|0KEE|0NGGEE|0GEE|0MEE|0NEE|1YEE|0I|1N|0HI|2N|0WI|2N|0PI|0BHI|1I|0MBI|0KPI|0MGBI|0GBI|0FI|0VI|0TI|1HI|0DHI|2HI|0LI|0RI|0DI|0NDI|0SI|1HI|0ZI|1HI|0CI|0JI|0NJI|0YI|0KI|0NGGI|0GI|0MI|0NI|1YI|0A|1N|0NGAN|0HA|2N|0WA|2N|0PA|0BHA|1A|0MBA|0KPA|3N|0MGBA|0GBA|0FA|0VA|0TA|1HA|0DHA|2HA|0LA|0RA|0DA|0NDA|0SA|1HA|0ZA|1HA|0CA|0JA|0NJA|0YA|0KA|2N|0NGGA|0GA|0MA|0NA|1YA|0OO|2N|0HOO|0WOO|3N|0POO|0BHOO|1OO|0MBOO|0KPOO|0MGBOO|0GBOO|0FOO|0VOO|0TOO|1HOO|0DHOO|2HOO|0LOO|0ROO|0DOO|0NDOO|0SOO|1HOO|0ZOO|1HOO|0COO|0JOO|0NJOO|0YOO|0KOO|0NGGOO|0GOO|0MOO|0NOO|1YOO|0U|1N|0HU|2N|0WU|2N|0PU|0BHU|1U|0MBU|0KPU|0MGBU|0GBU|0FU|0VU|0TU|1HU|0DHU|2HU|0LU|0RU|0DU|0NDU|0SU|1HU|0ZU|1HU|0CU|0JU|0NJU|0YU|0KU|0NGGU|0GU|0MU|0NU|1YU|0O|1N|0NGON|0HO|2N|0WO|2N|0PO|0BHO|1O|0MBO|0KPO|0MGBO|0GBO|3N|0FO|0VO|0TO|1HO|0DHO|2HO|0LO|0RO|0DO|0NDO|0SO|1HO|0ZO|1HO|0CO|0JO|0NJO|0YO|0KO|0NGGO|0GO|0MO|0NO|1YO|0E|1N|0NGEN|0HE|2N|0WE|2N|0PE|0BHE|1E|0MBE|0KPE|3N|0MGBE|0GBE|3N|0FE|0VE|0TE|1HE|0DHE|2HE|0LE|0RE|0DE|0NDE|0SE|1HE|0ZE|1HE|0CE|0JE|0NJE|0YE|0KE|0NGGE|4N|0GE|2N|0ME|0NE|1YE|1G|0LENGTHENER|'COMMA|'FULL STOP|'QUESTION MARK|'SYLLABLE NDOLE FA|6KA|6SOO|)MBOL FEENG|.KEENG|.TING|.NII|.BANG|.FAA|.TAA|.DANG|/OONG|.KUNG|.TONG|.DO-O|.JONG|'DIGIT ZERO|-ONE|-TWO|.HREE|-FOUR|.IVE|-SIX|.EVEN|-EIGHT|-NINE|'SYLLABLE NDOLE MA|6DO|#CYRILLIC CAPITAL LETTER ZEMLYA|,SMALL LETTER ZEMLYA|,CAPITAL LETTER DZELO|,SMALL LETTER DZELO|,CAPITAL LETTER REVERSED DZE|,SMALL LETTER REVERSED DZE|,CAPITAL LETTER IOTA|,SMALL LETTER IOTA|,CAPITAL LETTER DJERV|,SMALL LETTER DJERV|,CAPITAL LETTER MONOGRAPH UK|,SMALL LETTER MONOGRAPH UK|,CAPITAL LETTER BROAD OMEGA|,SMALL LETTER BROAD OMEGA|,CAPITAL LETTER NEUTRAL YER|,SMALL LETTER NEUTRAL YER|,CAPITAL LETTER YERU WITH BACK YER|,SMALL LETTER YERU WITH BACK YER|,CAPITAL LETTER IOTIFIED YAT|,SMALL LETTER IOTIFIED YAT|,CAPITAL LETTER REVERSED YU|,SMALL LETTER REVERSED YU|,CAPITAL LETTER IOTIFIED A|,SMALL LETTER IOTIFIED A|,CAPITAL LETTER CLOSED LITTLE YUS|,SMALL LETTER CLOSED LITTLE YUS|,CAPITAL LETTER BLENDED YUS|,SMALL LETTER BLENDED YUS|,CAPITAL LETTER IOTIFIED CLOSED LITTLE YUS|,SMALL LETTER IOTIFIED CLOSED LITTLE YUS|,CAPITAL LETTER YN|,SMALL LETTER YN|,CAPITAL LETTER REVERSED TSE|,SMALL LETTER REVERSED TSE|,CAPITAL LETTER SOFT DE|,SMALL LETTER SOFT DE|,CAPITAL LETTER SOFT EL|,SMALL LETTER SOFT EL|,CAPITAL LETTER SOFT EM|,SMALL LETTER SOFT EM|,CAPITAL LETTER MONOCULAR O|,SMALL LETTER MONOCULAR O|,CAPITAL LETTER BINOCULAR O|,SMALL LETTER BINOCULAR O|,CAPITAL LETTER DOUBLE MONOCULAR O|,SMALL LETTER DOUBLE MONOCULAR O|,LETTER MULTIOCULAR O|$OMBINING CYRILLIC VZMET|6TEN MILLIONS SIGN|6HUNDRED MILLIONS SIGN|6THOUSAND MILLIONS SIGN|#SLAVONIC ASTERISK|#COMBINING CYRILLIC LETTER UKRAINIAN IE|=I|=YI|=U|=HARD SIGN|=YERU|=SOFT SIGN|=OMEGA|6KAVYKA|6PAYEROK|$YRILLIC KAVYKA|,PAYEROK|,CAPITAL LETTER DWE|,SMALL LETTER DWE|,CAPITAL LETTER DZWE|,SMALL LETTER DZWE|,CAPITAL LETTER ZHWE|,SMALL LETTER ZHWE|,CAPITAL LETTER CCHE|,SMALL LETTER CCHE|,CAPITAL LETTER DZZE|,SMALL LETTER DZZE|,CAPITAL LETTER TE WITH MIDDLE HOOK|,SMALL LETTER TE WITH MIDDLE HOOK|,CAPITAL LETTER TWE|,SMALL LETTER TWE|,CAPITAL LETTER TSWE|,SMALL LETTER TSWE|,CAPITAL LETTER TSSE|,SMALL LETTER TSSE|,CAPITAL LETTER TCHE|,SMALL LETTER TCHE|,CAPITAL LETTER HWE|,SMALL LETTER HWE|,CAPITAL LETTER SHWE|,SMALL LETTER SHWE|,CAPITAL LETTER DOUBLE O|,SMALL LETTER DOUBLE O|,CAPITAL LETTER CROSSED O|,SMALL LETTER CROSSED O|#MODIFIER LETTER CYRILLIC HARD SIGN|<SOFT SIGN|#COMBINING CYRILLIC LETTER EF|=IOTIFIED E|#BAMUM LETTER A|0KA|0U|0KU|0EE|0REE|0TAE|0O|0NYI|0I|0LA|0PA|0RII|2EE|0LEEEE|0MEEEE|0TAA|0NDAA|1JAEM|0M|0SUU|0MU|0SHII|1I|1HEUX|1EUX|0KYEE|1ET|0NUAE|2|1JUAE|0YOQ|0SHU|0YUQ|1A|0NSHA|0KEUX|0PEUX|0NJEE|1TEE|0PUE|0WUE|0PEE|0FEE|0RU|0LU|0MI|0NI|0REUX|1AE|0KEN|0NGKWAEN|2GA|2A|0SHO|0PUAE|0FU|1OM|0WA|0NA|0LI|0PI|0LOQ|0KO|0MBEN|0REN|0MEN|1A|0TI|0KI|0MO|1BAA|0TET|0KPA|0TEN|0NTUU|0SAMBA|0FAAMAE|0KOVUU|2GHOM|)COMBINING MARK KOQNDON|8TUKWENTIS|)NJAEMLI|)FULL STOP|)COLON|+MMA|)SEMICOLON|)QUESTION MARK|#MODIFIER LETTER CHINESE TONE YIN PING|AANG PING|AIN SHANG|AANG SHANG|AIN QU|AANG QU|AIN RU|AANG RU|3EXTRA-HIGH DOTTED TONE BAR|3HIGH DOTTED TONE BAR|3MID DOTTED TONE BAR|3LOW DOTTED TONE BAR|3EXTRA-LOW DOTTED TONE BAR|9HIGH DOTTED LEFT-STEM TONE BAR|3HIGH DOTTED LEFT-STEM TONE BAR|3MID DOTTED LEFT-STEM TONE BAR|3LOW DOTTED LEFT-STEM TONE BAR|3EXTRA-LOW DOTTED LEFT-STEM TONE BAR|9HIGH LEFT-STEM TONE BAR|3HIGH LEFT-STEM TONE BAR|3MID LEFT-STEM TONE BAR|3LOW LEFT-STEM TONE BAR|3EXTRA-LOW LEFT-STEM TONE BAR|3DOT VERTICAL BAR|7SLASH|7HORIZONTAL BAR|3LOWER RIGHT CORNER ANGLE|3RAISED UP ARROW|:DOWN ARROW|:EXCLAMATION MARK|:INVERTED EXCLAMATION MARK|3LOW INVERTED EXCLAMATION MARK|3STRESS AND HIGH TONE|>LOW TONE|#LATIN CAPITAL LETTER EGYPTOLOGICAL ALEF|)SMALL LETTER EGYPTOLOGICAL ALEF|)CAPITAL LETTER EGYPTOLOGICAL AIN|)SMALL LETTER EGYPTOLOGICAL AIN|)CAPITAL LETTER HENG|)SMALL LETTER HENG|)CAPITAL LETTER TZ|)SMALL LETTER TZ|)CAPITAL LETTER TRESILLO|)SMALL LETTER TRESILLO|)CAPITAL LETTER CUATRILLO|)SMALL LETTER CUATRILLO|)CAPITAL LETTER CUATRILLO WITH COMMA|)SMALL LETTER CUATRILLO WITH COMMA|)LETTER SMALL CAPITAL F|>S|)CAPITAL LETTER AA|)SMALL LETTER AA|)CAPITAL LETTER AO|)SMALL LETTER AO|)CAPITAL LETTER AU|)SMALL LETTER AU|)CAPITAL LETTER AV|)SMALL LETTER AV|)CAPITAL LETTER AV WITH HORIZONTAL BAR|)SMALL LETTER AV WITH HORIZONTAL BAR|)CAPITAL LETTER AY|)SMALL LETTER AY|)CAPITAL LETTER REVERSED C WITH DOT|)SMALL LETTER REVERSED C WITH DOT|)CAPITAL LETTER K WITH STROKE|)SMALL LETTER K WITH STROKE|)CAPITAL LETTER K WITH DIAGONAL STROKE|)SMALL LETTER K WITH DIAGONAL STROKE|)CAPITAL LETTER K WITH STROKE AND DIAGONAL STROKE|)SMALL LETTER K WITH STROKE AND DIAGONAL STROKE|)CAPITAL LETTER BROKEN L|)SMALL LETTER BROKEN L|)CAPITAL LETTER L WITH HIGH STROKE|)SMALL LETTER L WITH HIGH STROKE|)CAPITAL LETTER O WITH LONG STROKE OVERLAY|)SMALL LETTER O WITH LONG STROKE OVERLAY|)CAPITAL LETTER O WITH LOOP|)SMALL LETTER O WITH LOOP|)CAPITAL LETTER OO|)SMALL LETTER OO|)CAPITAL LETTER P WITH STROKE THROUGH DESCENDER|)SMALL LETTER P WITH STROKE THROUGH DESCENDER|)CAPITAL LETTER P WITH FLOURISH|)SMALL LETTER P WITH FLOURISH|)CAPITAL LETTER P WITH SQUIRREL TAIL|)SMALL LETTER P WITH SQUIRREL TAIL|)CAPITAL LETTER Q WITH STROKE THROUGH DESCENDER|)SMALL LETTER Q WITH STROKE THROUGH DESCENDER|)CAPITAL LETTER Q WITH DIAGONAL STROKE|)SMALL LETTER Q WITH DIAGONAL STROKE|)CAPITAL LETTER R ROTUNDA|)SMALL LETTER R ROTUNDA|)CAPITAL LETTER RUM ROTUNDA|)SMALL LETTER RUM ROTUNDA|)CAPITAL LETTER V WITH DIAGONAL STROKE|)SMALL LETTER V WITH DIAGONAL STROKE|)CAPITAL LETTER VY|)SMALL LETTER VY|)CAPITAL LETTER VISIGOTHIC Z|)SMALL LETTER VISIGOTHIC Z|)CAPITAL LETTER THORN WITH STROKE|)SMALL LETTER THORN WITH STROKE|)CAPITAL LETTER THORN WITH STROKE THROUGH DESCENDER|)SMALL LETTER THORN WITH STROKE THROUGH DESCENDER|)CAPITAL LETTER VEND|)SMALL LETTER VEND|)CAPITAL LETTER ET|)SMALL LETTER ET|)CAPITAL LETTER IS|)SMALL LETTER IS|)CAPITAL LETTER CON|)SMALL LETTER CON|#MODIFIER LETTER US|#LATIN SMALL LETTER DUM|6LUM|6MUM|6NUM|6RUM|)LETTER SMALL CAPITAL RUM|)SMALL LETTER TUM|6UM|)CAPITAL LETTER INSULAR D|)SMALL LETTER INSULAR D|)CAPITAL LETTER INSULAR F|)SMALL LETTER INSULAR F|)CAPITAL LETTER INSULAR G|8TURNED INSULAR G|)SMALL LETTER TURNED INSULAR G|)CAPITAL LETTER TURNED L|)SMALL LETTER TURNED L|)CAPITAL LETTER INSULAR R|)SMALL LETTER INSULAR R|)CAPITAL LETTER INSULAR S|)SMALL LETTER INSULAR S|)CAPITAL LETTER INSULAR T|)SMALL LETTER INSULAR T|#MODIFIER LETTER LOW CIRCUMFLEX ACCENT|3COLON|3SHORT EQUALS SIGN|#LATIN CAPITAL LETTER SALTILLO|)SMALL LETTER SALTILLO|)CAPITAL LETTER TURNED H|)SMALL LETTER L WITH RETROFLEX HOOK AND BELT|)LETTER SINOLOGICAL DOT|)CAPITAL LETTER N WITH DESCENDER|)SMALL LETTER N WITH DESCENDER|)CAPITAL LETTER C WITH BAR|)SMALL LETTER C WITH BAR|=PALATAL HOOK|6H WITH PALATAL HOOK|)CAPITAL LETTER B WITH FLOURISH|)SMALL LETTER B WITH FLOURISH|)CAPITAL LETTER F WITH STROKE|)SMALL LETTER F WITH STROKE|)CAPITAL LETTER VOLAPUK AE|)SMALL LETTER VOLAPUK AE|)CAPITAL LETTER VOLAPUK OE|)SMALL LETTER VOLAPUK OE|)CAPITAL LETTER VOLAPUK UE|)SMALL LETTER VOLAPUK UE|)CAPITAL LETTER G WITH OBLIQUE STROKE|)SMALL LETTER G WITH OBLIQUE STROKE|)CAPITAL LETTER K WITH OBLIQUE STROKE|)SMALL LETTER K WITH OBLIQUE STROKE|)CAPITAL LETTER N WITH OBLIQUE STROKE|)SMALL LETTER N WITH OBLIQUE STROKE|)CAPITAL LETTER R WITH OBLIQUE STROKE|)SMALL LETTER R WITH OBLIQUE STROKE|)CAPITAL LETTER S WITH OBLIQUE STROKE|)SMALL LETTER S WITH OBLIQUE STROKE|)CAPITAL LETTER H WITH HOOK|8REVERSED OPEN E|8SCRIPT G|8L WITH BELT|8SMALL CAPITAL I|)LETTER SMALL CAPITAL Q|)CAPITAL LETTER TURNED K|?T|8J WITH CROSSED-TAIL|8CHI|8BETA|)SMALL LETTER BETA|)CAPITAL LETTER OMEGA|)SMALL LETTER OMEGA|)CAPITAL LETTER U WITH STROKE|)SMALL LETTER U WITH STROKE|)CAPITAL LETTER GLOTTAL A|)SMALL LETTER GLOTTAL A|)CAPITAL LETTER GLOTTAL I|)SMALL LETTER GLOTTAL I|)CAPITAL LETTER GLOTTAL U|)SMALL LETTER GLOTTAL U|)CAPITAL LETTER OLD POLISH O|)SMALL LETTER OLD POLISH O|)CAPITAL LETTER ANGLICANA W|)SMALL LETTER ANGLICANA W|)CAPITAL LETTER C WITH PALATAL HOOK|8S WITH HOOK|8Z WITH PALATAL HOOK|8D WITH SHORT STROKE OVERLAY|)SMALL LETTER D WITH SHORT STROKE OVERLAY|)CAPITAL LETTER S WITH SHORT STROKE OVERLAY|)SMALL LETTER S WITH SHORT STROKE OVERLAY|)CAPITAL LETTER RAMS HORN|8S WITH DIAGONAL STROKE|)SMALL LETTER S WITH DIAGONAL STROKE|)CAPITAL LETTER PHARYNGEAL VOICED FRICATIVE|)SMALL LETTER PHARYNGEAL VOICED FRICATIVE|)CAPITAL LETTER CLOSED INSULAR G|)SMALL LETTER CLOSED INSULAR G|)CAPITAL LETTER DOUBLE THORN|)SMALL LETTER DOUBLE THORN|)CAPITAL LETTER DOUBLE WYNN|)SMALL LETTER DOUBLE WYNN|)CAPITAL LETTER MIDDLE SCOTS S|)SMALL LETTER MIDDLE SCOTS S|)CAPITAL LETTER SIGMOID S|)SMALL LETTER SIGMOID S|)CAPITAL LETTER LAMBDA|)SMALL LETTER LAMBDA|)CAPITAL LETTER LAMBDA WITH STROKE|8CLOSED OMEGA|8R WITH LONG LEG|#MODIFIER LETTER CAPITAL S|;C|;F|;Q|#LATIN CAPITAL LETTER REVERSED HALF H|)SMALL LETTER REVERSED HALF H|)EPIGRAPHIC LETTER SIDEWAYS I|#MODIFIER LETTER CAPITAL H WITH STROKE|3SMALL LIGATURE OE|#LATIN LETTER SMALL CAPITAL TURNED M|)EPIGRAPHIC LETTER REVERSED F|DP|;INVERTED M|< LONGA|;ARCHAIC M|#SYLOTI NAGRI LETTER A|7I|0SIGN DVISVARA|0LETTER U|7E|7O|0SIGN HASANTA|0LETTER KO|8HO|7GO|8HO|0SIGN ANUSVARA|0LETTER CO|8HO|7JO|8HO|7TTO|9HO|7DDO|9HO|7TO|8HO|7DO|8HO|7NO|7PO|8HO|7BO|8HO|7MO|7RO|7LO|7RRO|7SO|7HO|0VOWEL SIGN A|;I|;U|;E|;OO|0POETRY MARK-1|<2|<3|<4|0SIGN ALTERNATE HASANTA|#NORTH INDIC FRACTION ONE QUARTER|<HALF|8THREE QUARTERS|8ONE SIXTEENTH|<EIGHTH|8THREE SIXTEENTHS|/QUARTER MARK|/PLACEHOLDER MARK|/RUPEE MARK|/QUANTITY MARK|#PHAGS-PA LETTER KA|4HA|3GA|3NGA|3CA|4HA|3JA|3NYA|3TA|4HA|3DA|3NA|3PA|4HA|3BA|3MA|3TSA|5HA|3DZA|3WA|3ZHA|4A|3SMALL A|3YA|3RA|3LA|3SHA|4A|3HA|3A|3I|3U|3E|3O|3QA|3XA|3FA|3GGA|3EE|,SUBJOINED LETTER WA|=YA|,LETTER TTA|5HA|3DDA|3NNA|3ALTERNATE YA|3VOICELESS SHA|8D HA|3ASPIRATED FA|,SUBJOINED LETTER RA|.PERFIXED LETTER RA|,LETTER CANDRABINDU|,SINGLE HEAD MARK|,DOUBLE HEAD MARK|,MARK SHAD|1DOUBLE SHAD|#SAURASHTRA SIGN ANUSVARA|3VISARGA|.LETTER A|6A|5I|6I|5U|6U|5VOCALIC R|>R|=L|>L|5E|6E|5AI|5O|6O|5AU|5KA|6HA|5GA|6HA|5NGA|5CA|6HA|5JA|6HA|5NYA|5TTA|7HA|5DDA|7HA|5NNA|5TA|6HA|5DA|6HA|5NA|5PA|6HA|5BA|6HA|5MA|5YA|5RA|5LA|5VA|5SHA|6SA|6A|5HA|5LLA|.CONSONANT SIGN HAARU|.VOWEL SIGN AA|9I|:I|9U|:U|9VOCALIC R|BR|AL|BL|9E|:E|9AI|9O|:O|9AU|.SIGN VIRAMA|3CANDRABINDU|.DANDA|/OUBLE DANDA|/IGIT ZERO|4ONE|4TWO|5HREE|4FOUR|5IVE|4SIX|5EVEN|4EIGHT|4NINE|#COMBINING DEVANAGARI DIGIT ZERO|>ONE|>TWO|?HREE|>FOUR|?IVE|>SIX|?EVEN|>EIGHT|>NINE|8LETTER A|?U|?KA|?NA|?PA|?RA|?VI|8SIGN AVAGRAHA|#DEVANAGARI SIGN SPACING CANDRABINDU|3CANDRABINDU VIRAMA|3DOUBLE CANDRABINDU VIRAMA|3CANDRABINDU TWO|@HREE|?AVAGRAHA|3PUSHPIKA|.GAP FILLER|.CARET|.HEADSTROKE|.SIGN SIDDHAM|.JAIN OM|.LETTER AY|.VOWEL SIGN AY|#KAYAH LI DIGIT ZERO|2ONE|2TWO|3HREE|2FOUR|3IVE|2SIX|3EVEN|2EIGHT|2NINE|,LETTER KA|4HA|3GA|3NGA|3SA|4HA|3ZA|3NYA|3TA|3HTA|3NA|3PA|4HA|3MA|3DA|3BA|3RA|3YA|3LA|3WA|3THA|3HA|3VA|3CA|3A|3OE|3I|3OO|,VOWEL UE|2E|2U|2EE|2O|,TONE PLOPHU|1CALYA|6 PLOPHU|,SIGN CWI|1SHYA|#REJANG LETTER KA|1GA|1NGA|1TA|1DA|1NA|1PA|1BA|1MA|1CA|1JA|1NYA|1SA|1RA|1LA|1YA|1WA|1HA|1MBA|1NGGA|2DA|2YJA|1A|*VOWEL SIGN I|5U|5E|5AI|5O|5AU|5EU|6A|*CONSONANT SIGN NG|:|9R|9H|*VIRAMA|*SECTION MARK|#HANGUL CHOSEONG TIKEUT-MIEUM|:PIEUP|:SIOS|:CIEUC|3RIEUL-KIYEOK|9SSANGKIYEOK|9TIKEUT|9SSANGTIKEUT|9MIEUM|9PIEUP|9SSANGPIEUP|9KAPYEOUNPIEUP|9SIOS|9CIEUC|9KHIEUKH|3MIEUM-KIYEOK|9TIKEUT|9SIOS|3PIEUP-SIOS-THIEUTH|9KHIEUKH|9HIEUH|3SSANGSIOS-PIEUP|3IEUNG-RIEUL|9HIEUH|3SSANGCIEUC-HIEUH|8THIEUTH|3PHIEUPH-HIEUH|3HIEUH-SIOS|3SSANGYEORINHIEUH|#JAVANESE SIGN PANYANGGA|1CECAK|1LAYAR|1WIGNYAN|,LETTER A|3I KAWI|4|4I|3U|3PA CEREK|3NGA LELET|< RASWADI|3E|3AI|3O|3KA|5 SASAK|6MURDA|3GA|5 MURDA|3NGA|3CA|5 MURDA|3JA|3NYA MURDA|3JA MAHAPRANA|3NYA|3TTA|6 MAHAPRANA|3DDA|6 MAHAPRANA|3NA MURDA|3TA|5 MURDA|3DA|5 MAHAPRANA|3NA|3PA|5 MURDA|3BA|5 MURDA|3MA|3YA|3RA|5 AGUNG|3LA|3WA|3SA MURDA|7AHAPRANA|5|3HA|,SIGN CECAK TELU|,VOWEL SIGN TARUNG|8OLONG|7WULU|; MELIK|7SUKU|; MENDUT|7TALING|7DIRGA MURE|7PEPET|,CONSONANT SIGN KERET|;PENGKAL|;CAKRA|,PANGKON|,LEFT RERENGGAN|,RIGHT RERENGGAN|,PADA ANDAP|1MADYA|1LUHUR|1WINDU|1PANGKAT|1LINGSA|2UNGSI|1ADEG|5 ADEG|1PISELEH|,TURNED PADA PISELEH|,PANGRANGKEP|,DIGIT ZERO|2ONE|2TWO|3HREE|2FOUR|3IVE|2SIX|3EVEN|2EIGHT|2NINE|,PADA TIRTA TUMETES|1ISEN-ISEN|#MYANMAR LETTER SHAN GHA|7CHA|7JHA|7NNA|7BHA|+SIGN SHAN SAW|+MODIFIER LETTER SHAN REDUPLICATION|+LETTER TAI LAING NYA|<FA|<GA|=HA|<JA|=HA|<DDA|>HA|<NNA|+TAI LAING DIGIT ZERO|;ONE|;TWO|<HREE|;FOUR|<IVE|;SIX|<EVEN|;EIGHT|;NINE|+LETTER TAI LAING LLA|<DA|=HA|<BA|=HA|#CHAM LETTER A|/I|/U|/E|/AI|/O|/KA|0HA|/GA|0HA|/NGUE|1A|/CHA|1HA|/JA|0HA|/NHUE|1A|1JA|/TA|0HA|/DA|0HA|/NUE|0A|/DDA|/PA|0PA|0HA|/BA|0HA|/MUE|0A|/BBA|/YA|/RA|/LA|/VA|/SSA|0A|/HA|(VOWEL SIGN AA|3I|4I|3EI|3U|3OE|4|3AI|4U|3UE|(CONSONANT SIGN YA|7RA|7LA|7WA|(LETTER FINAL K|5G|5NG|(CONSONANT SIGN FINAL NG|(LETTER FINAL CH|5T|5N|5P|5Y|5R|5L|5SS|(CONSONANT SIGN FINAL M|=H|(DIGIT ZERO|.ONE|.TWO|/HREE|.FOUR|/IVE|.SIX|/EVEN|.EIGHT|.NINE|(PUNCTUATION SPIRAL|4DANDA|5OUBLE DANDA|4TRIPLE DANDA|#MYANMAR LETTER KHAMTI GA|9CA|:HA|9JA|:HA|9NYA|9TTA|;HA|9DDA|;HA|:HA|9NA|9SA|9HA|:HA|9FA|+MODIFIER LETTER KHAMTI REDUPLICATION|+LETTER KHAMTI XA|9ZA|9RA|,OGOGRAM KHAMTI OAY|;QN|;HM|+SYMBOL AITON EXCLAMATION|8ONE|8TWO|+LETTER AITON RA|+SIGN PAO KAREN TONE|0TAI LAING TONE-2|?5|+LETTER SHWE PALAUNG CHA|?SHA|#TAI VIET LETTER LOW KO|3HIGH KO|3LOW KHO|3HIGH KHO|3LOW KHHO|3HIGH KHHO|3LOW GO|3HIGH GO|3LOW NGO|3HIGH NGO|3LOW CO|3HIGH CO|3LOW CHO|3HIGH CHO|3LOW SO|3HIGH SO|3LOW NYO|3HIGH NYO|3LOW DO|3HIGH DO|3LOW TO|3HIGH TO|3LOW THO|3HIGH THO|3LOW NO|3HIGH NO|3LOW BO|3HIGH BO|3LOW PO|3HIGH PO|3LOW PHO|3HIGH PHO|3LOW FO|3HIGH FO|3LOW MO|3HIGH MO|3LOW YO|3HIGH YO|3LOW RO|3HIGH RO|3LOW LO|3HIGH LO|3LOW VO|3HIGH VO|3LOW HO|3HIGH HO|3LOW O|3HIGH O|,MAI KANG|,VOWEL AA|2I|2UE|3|2E|2O|,MAI KHIT|,VOWEL IA|2UEA|3A|2AUE|3Y|3N|3M|,TONE MAI EK|5NUENG|5THO|5SONG|,SYMBOL KON|3NUENG|3SAM|3HO HOI|3KOI KOI|#MEETEI MAYEK LETTER E|7O|7CHA|7NYA|7TTA|9HA|7DDA|9HA|7NNA|7SHA|8SA|0VOWEL SIGN II|;UU|;AAI|<U|<AU|0CHEIKHAN|0AHANG KHUDAM|1NJI|0SYLLABLE REPETITION MARK|0WORD REPETITION MARK|0VOWEL SIGN VISARGA|1IRAMA|#ETHIOPIC SYLLABLE TTHU|8I|8AA|8EE|9|8O|5DDHU|8I|8AA|8EE|9|8O|6ZU|7I|7AA|7EE|8|7O|5CCHHA|9U|9I|9AA|9EE|:|9O|5BBA|7U|7I|7AA|7EE|8|7O|#LATIN SMALL LETTER BARRED ALPHA|6A REVERSED-SCHWA|6BLACKLETTER E|7ARRED E|6E WITH FLOURISH|6LENIS F|6SCRIPT G WITH CROSSED-TAIL|6L WITH INVERTED LAZY S|=DOUBLE MIDDLE TILDE|=MIDDLE RING|6M WITH CROSSED-TAIL|6N WITH CROSSED-TAIL|6ENG WITH CROSSED-TAIL|6BLACKLETTER O|C WITH STROKE|6OPEN O WITH STROKE|6INVERTED OE|6TURNED OE WITH STROKE|EHORIZONTAL STROKE|> OPEN-O|E WITH STROKE|6STIRRUP R|)LETTER SMALL CAPITAL R WITH RIGHT LEG|)SMALL LETTER R WITHOUT HANDLE|6DOUBLE R|6R WITH CROSSED-TAIL|6DOUBLE R WITH CROSSED-TAIL|6SCRIPT R|> WITH RING|6BASELINE ESH|6U WITH SHORT RIGHT LEG|8BAR WITH SHORT RIGHT LEG|7I|6TURNED UI|6U WITH LEFT HOOK|6CHI|9 WITH LOW RIGHT RING|CLEFT SERIF|6X WITH LOW RIGHT RING|?NG LEFT LEG|J AND LOW RIGHT RING|KWITH SERIF|6Y WITH SHORT RIGHT LEG|#MODIFIER BREVE WITH INVERTED BREVE|,LETTER SMALL HENG|9L WITH INVERTED LAZY S|@MIDDLE TILDE|9U WITH LEFT HOOK|#LATIN SMALL LETTER SAKHA YAT|6IOTIFIED E|6OPEN OE|6UO|6INVERTED ALPHA|#GREEK LETTER SMALL CAPITAL OMEGA|#LATIN SMALL LETTER DZ DIGRAPH WITH RETROFLEX HOOK|6TS DIGRAPH WITH RETROFLEX HOOK|7URNED R WITH MIDDLE TILDE|#MODIFIER LETTER SMALL TURNED W|3LEFT TACK|3RIGHT TACK|#LATIN CAPITAL LETTER SCRIPT R|@ WITH RING|#CHEROKEE SMALL LETTER A|9E|9I|9O|9U|9V|9GA|9KA|9GE|:I|:O|:U|:V|9HA|:E|:I|:O|:U|:V|9LA|:E|:I|:O|:U|:V|9MA|:E|:I|:O|:U|9NA|9HNA|9NAH|:E|:I|:O|:U|:V|9QUA|;E|;I|;O|;U|;V|9SA|:|:E|:I|:O|:U|:V|9DA|9TA|9DE|9TE|9DI|9TI|9DO|:U|:V|:LA|9TLA|;E|;I|;O|;U|;V|:SA|;E|;I|;O|;U|;V|9WA|:E|:I|:O|:U|:V|9YA|#MEETEI MAYEK LETTER KOK|7SAM|7LAI|7MIT|7PA|7NA|7CHIL|7TIL|7KHOU|7NGOU|7THOU|7WAI|7YANG|7HUK|7UN|7I|7PHAM|7ATIYA|7GOK|7JHAM|7RAI|7BA|7JIL|7DIL|7GHOU|7DHOU|7BHAM|7KOK LONSUM|7LAI LONSUM|7MIT LONSUM|7PA LONSUM|7NA LONSUM|7TIL LONSUM|7NGOU LONSUM|7I LONSUM|0VOWEL SIGN ONAP|;INAP|;ANAP|;YENAP|;SOUNAP|;UNAP|;CHEINAP|;NUNG|0CHEIKHEI|0LUM IYEK|0APUN IYEK|0DIGIT ZERO|6ONE|6TWO|7HREE|6FOUR|7IVE|6SIX|7EVEN|6EIGHT|6NINE|#HANGUL JUNGSEONG O-YEO|6O-I|4YO-A|8E|7EO|4U-YEO|6I-I|4YU-AE|7O|4EU-A|7EO|8|7O|4I-YA-O|8E|7EO|8|6O-I|6YO|7U|6I|4ARAEA-A|:E|+ONGSEONG NIEUN-RIEUL|:CHIEUCH|4SSANGTIKEUT|?-PIEUP|4TIKEUT-PIEUP|;SIOS|?-KIYEOK|;CIEUC|<HIEUCH|;THIEUTH|4RIEUL-SSANGKIYEOK|:KIYEOK-HIEUH|4SSANGRIEUL-KHIEUKH|4RIEUL-MIEUM-HIEUH|:PIEUP-TIKEUT|@PHIEUPH|:YESIEUNG|<ORINHIEUH-HIEUH|4KAPYEOUNRIEUL|4MIEUM-NIEUN|:SSANGNIEUN|4SSANGMIEUM|4MIEUM-PIEUP-SIOS|:CIEUC|4PIEUP-TIKEUT|:RIEUL-PHIEUPH|:MIEUM|4SSANGPIEUP|4PIEUP-SIOS-TIKEUT|:CIEUC|;HIEUCH|4SIOS-MIEUM|9KAPYEOUNPIEUP|5SANGSIOS-KIYEOK|>TIKEUT|5IOS-PANSIOS|9CIEUC|:HIEUCH|9THIEUTH|9HIEUH|4PANSIOS-PIEUP|<KAPYEOUNPIEUP|4YESIEUNG-MIEUM|=HIEUH|4CIEUC-PIEUP|:SSANGPIEUP|4SSANGCIEUC|4PHIEUPH-SIOS|<THIEUTH|#LATIN SMALL LIGATURE FF|9I|9L|9FI|:L|8LONG S T|8ST|#ARMENIAN SMALL LIGATURE MEN NOW|?ECH|?INI|;VEW NOW|;MEN XEH|#HEBREW LETTER YOD WITH HIRIQ|*POINT JUDEO-SPANISH VARIKA|*LIGATURE YIDDISH YOD YOD PATAH|+ETTER ALTERNATIVE AYIN|1WIDE ALEF|6DALET|6HE|6KAF|6LAMED|6FINAL MEM|6RESH|6TAV|1ALTERNATIVE PLUS SIGN|1SHIN WITH SHIN DOT|<IN DOT|;DAGESH AND SHIN DOT|GIN DOT|1ALEF WITH PATAH|;QAMATS|;MAPIQ|1BET WITH DAGESH|1GIMEL WITH DAGESH|1DALET WITH DAGESH|1HE WITH MAPIQ|1VAV WITH DAGESH|1ZAYIN WITH DAGESH|1TET WITH DAGESH|1YOD WITH DAGESH|1FINAL KAF WITH DAGESH|1KAF WITH DAGESH|1LAMED WITH DAGESH|1MEM WITH DAGESH|1NUN WITH DAGESH|1SAMEKH WITH DAGESH|1FINAL PE WITH DAGESH|1PE WITH DAGESH|1TSADI WITH DAGESH|1QOF WITH DAGESH|1RESH WITH DAGESH|1SHIN WITH DAGESH|1TAV WITH DAGESH|1VAV WITH HOLAM|1BET WITH RAFE|1KAF WITH RAFE|1PE WITH RAFE|+IGATURE ALEF LAMED|#ARABIC LETTER ALEF WASLA ISOLATED FORM|<FINAL FORM|1BEEH ISOLATED FORM|6FINAL FORM|6INITIAL FORM|6MEDIAL FORM|1PEH ISOLATED FORM|5FINAL FORM|5INITIAL FORM|5MEDIAL FORM|1BEHEH ISOLATED FORM|7FINAL FORM|7INITIAL FORM|7MEDIAL FORM|1TTEHEH ISOLATED FORM|8FINAL FORM|8INITIAL FORM|8MEDIAL FORM|2EHEH ISOLATED FORM|7FINAL FORM|7INITIAL FORM|7MEDIAL FORM|2TEH ISOLATED FORM|6FINAL FORM|6INITIAL FORM|6MEDIAL FORM|1VEH ISOLATED FORM|5FINAL FORM|5INITIAL FORM|5MEDIAL FORM|1PEHEH ISOLATED FORM|7FINAL FORM|7INITIAL FORM|7MEDIAL FORM|1DYEH ISOLATED FORM|6FINAL FORM|6INITIAL FORM|6MEDIAL FORM|1NYEH ISOLATED FORM|6FINAL FORM|6INITIAL FORM|6MEDIAL FORM|1TCHEH ISOLATED FORM|7FINAL FORM|7INITIAL FORM|7MEDIAL FORM|6EH ISOLATED FORM|9FINAL FORM|9INITIAL FORM|9MEDIAL FORM|1DDAHAL ISOLATED FORM|8FINAL FORM|2AHAL ISOLATED FORM|7FINAL FORM|2UL ISOLATED FORM|5FINAL FORM|2DAL ISOLATED FORM|6FINAL FORM|1JEH ISOLATED FORM|5FINAL FORM|1RREH ISOLATED FORM|6FINAL FORM|1KEHEH ISOLATED FORM|7FINAL FORM|7INITIAL FORM|7MEDIAL FORM|1GAF ISOLATED FORM|5FINAL FORM|5INITIAL FORM|5MEDIAL FORM|2UEH ISOLATED FORM|6FINAL FORM|6INITIAL FORM|6MEDIAL FORM|1NGOEH ISOLATED FORM|7FINAL FORM|7INITIAL FORM|7MEDIAL FORM|2OON GHUNNA ISOLATED FORM|=FINAL FORM|1RNOON ISOLATED FORM|7FINAL FORM|7INITIAL FORM|7MEDIAL FORM|1HEH WITH YEH ABOVE ISOLATED FORM|DFINAL FORM|5GOAL ISOLATED FORM|:FINAL FORM|:INITIAL FORM|:MEDIAL FORM|5DOACHASHMEE ISOLATED FORM|AFINAL FORM|AINITIAL FORM|AMEDIAL FORM|1YEH BARREE ISOLATED FORM|<FINAL FORM|<WITH HAMZA ABOVE ISOLATED FORM|MFINAL FORM|*SYMBOL DOT ABOVE|5BELOW|1TWO DOTS ABOVE|:BELOW|2HREE DOTS ABOVE|<BELOW|<POINTING DOWNWARDS ABOVE|OBELOW|1FOUR DOTS ABOVE|;BELOW|1DOUBLE VERTICAL BAR BELOW|1TWO DOTS VERTICALLY ABOVE|EBELOW|1RING|1SMALL TAH ABOVE|;BELOW|1WASLA ABOVE|*LIGATURE JALLA WA-ALAA|3DAAMAT BARAKAATUHUM|3RAHMATU ALLAAHI TAAALAA ALAYH|CALAYHIM|JAA|6IMAHUM ALLAAHU TAAALAA|<AA ALLAAH|EU TAAALAA|5DI ALLAAHU TAAALAA ANHUM|3HAFIZAHU ALLAAH|BU TAAALAA|;M ALLAAHU TAAALAA|<AA ALLAAHU TAAALAA|3SALLALLAAHU TAAALAA ALAYHI WA-SALLAM|3AJJAL ALLAAHU FARAJAHU ASH-SHAREEF|4LAYHI AR-RAHMAH|+ETTER NG ISOLATED FORM|4FINAL FORM|4INITIAL FORM|4MEDIAL FORM|1U ISOLATED FORM|3FINAL FORM|1OE ISOLATED FORM|4FINAL FORM|1YU ISOLATED FORM|4FINAL FORM|1U WITH HAMZA ABOVE ISOLATED FORM|1VE ISOLATED FORM|4FINAL FORM|1KIRGHIZ OE ISOLATED FORM|<FINAL FORM|9YU ISOLATED FORM|<FINAL FORM|1E ISOLATED FORM|3FINAL FORM|3INITIAL FORM|3MEDIAL FORM|1UIGHUR KAZAKH KIRGHIZ ALEF MAKSURA INITIAL FORM|TMEDIAL FORM|+IGATURE YEH WITH HAMZA ABOVE WITH ALEF ISOLATED FORM|RFINAL FORM|NE ISOLATED FORM|PFINAL FORM|MWAW ISOLATED FORM|QFINAL FORM|MU ISOLATED FORM|OFINAL FORM|MOE ISOLATED FORM|PFINAL FORM|MYU ISOLATED FORM|PFINAL FORM|ME ISOLATED FORM|OFINAL FORM|OINITIAL FORM|3UIGHUR KIRGHIZ YEH WITH HAMZA ABOVE WITH ALEF MAKSURA ISOLATED FORM|iFINAL FORM|iINITIAL FORM|+ETTER FARSI YEH ISOLATED FORM|;FINAL FORM|;INITIAL FORM|;MEDIAL FORM|+IGATURE YEH WITH HAMZA ABOVE WITH JEEM ISOLATED FORM|MHAH ISOLATED FORM|MMEEM ISOLATED FORM|MALEF MAKSURA ISOLATED FORM|MYEH ISOLATED FORM|3BEH WITH JEEM ISOLATED FORM|<HAH ISOLATED FORM|<KHAH ISOLATED FORM|<MEEM ISOLATED FORM|<ALEF MAKSURA ISOLATED FORM|<YEH ISOLATED FORM|3TEH WITH JEEM ISOLATED FORM|<HAH ISOLATED FORM|<KHAH ISOLATED FORM|<MEEM ISOLATED FORM|<ALEF MAKSURA ISOLATED FORM|<YEH ISOLATED FORM|4HEH WITH JEEM ISOLATED FORM|=MEEM ISOLATED FORM|=ALEF MAKSURA ISOLATED FORM|=YEH ISOLATED FORM|3JEEM WITH HAH ISOLATED FORM|=MEEM ISOLATED FORM|3HAH WITH JEEM ISOLATED FORM|<MEEM ISOLATED FORM|3KHAH WITH JEEM ISOLATED FORM|=HAH ISOLATED FORM|=MEEM ISOLATED FORM|3SEEN WITH JEEM ISOLATED FORM|=HAH ISOLATED FORM|=KHAH ISOLATED FORM|=MEEM ISOLATED FORM|4AD WITH HAH ISOLATED FORM|<MEEM ISOLATED FORM|3DAD WITH JEEM ISOLATED FORM|<HAH ISOLATED FORM|<KHAH ISOLATED FORM|<MEEM ISOLATED FORM|3TAH WITH HAH ISOLATED FORM|<MEEM ISOLATED FORM|3ZAH WITH MEEM ISOLATED FORM|3AIN WITH JEEM ISOLATED FORM|<MEEM ISOLATED FORM|3GHAIN WITH JEEM ISOLATED FORM|>MEEM ISOLATED FORM|3FEH WITH JEEM ISOLATED FORM|<HAH ISOLATED FORM|<KHAH ISOLATED FORM|<MEEM ISOLATED FORM|<ALEF MAKSURA ISOLATED FORM|<YEH ISOLATED FORM|3QAF WITH HAH ISOLATED FORM|<MEEM ISOLATED FORM|<ALEF MAKSURA ISOLATED FORM|<YEH ISOLATED FORM|3KAF WITH ALEF ISOLATED FORM|<JEEM ISOLATED FORM|<HAH ISOLATED FORM|<KHAH ISOLATED FORM|<LAM ISOLATED FORM|<MEEM ISOLATED FORM|<ALEF MAKSURA ISOLATED FORM|<YEH ISOLATED FORM|3LAM WITH JEEM ISOLATED FORM|<HAH ISOLATED FORM|<KHAH ISOLATED FORM|<MEEM ISOLATED FORM|<ALEF MAKSURA ISOLATED FORM|<YEH ISOLATED FORM|3MEEM WITH JEEM ISOLATED FORM|=HAH ISOLATED FORM|=KHAH ISOLATED FORM|=MEEM ISOLATED FORM|=ALEF MAKSURA ISOLATED FORM|=YEH ISOLATED FORM|3NOON WITH JEEM ISOLATED FORM|=HAH ISOLATED FORM|=KHAH ISOLATED FORM|=MEEM ISOLATED FORM|=ALEF MAKSURA ISOLATED FORM|=YEH ISOLATED FORM|3HEH WITH JEEM ISOLATED FORM|<MEEM ISOLATED FORM|<ALEF MAKSURA ISOLATED FORM|<YEH ISOLATED FORM|3YEH WITH JEEM ISOLATED FORM|<HAH ISOLATED FORM|<KHAH ISOLATED FORM|<MEEM ISOLATED FORM|<ALEF MAKSURA ISOLATED FORM|<YEH ISOLATED FORM|3THAL WITH SUPERSCRIPT ALEF ISOLATED FORM|3REH WITH SUPERSCRIPT ALEF ISOLATED FORM|3ALEF MAKSURA WITH SUPERSCRIPT ALEF ISOLATED FORM|3SHADDA WITH DAMMATAN ISOLATED FORM|?KASRATAN ISOLATED FORM|?FATHA ISOLATED FORM|?DAMMA ISOLATED FORM|?KASRA ISOLATED FORM|?SUPERSCRIPT ALEF ISOLATED FORM|3YEH WITH HAMZA ABOVE WITH REH FINAL FORM|MZAIN FINAL FORM|MMEEM FINAL FORM|MNOON FINAL FORM|MALEF MAKSURA FINAL FORM|MYEH FINAL FORM|3BEH WITH REH FINAL FORM|<ZAIN FINAL FORM|<MEEM FINAL FORM|<NOON FINAL FORM|<ALEF MAKSURA FINAL FORM|<YEH FINAL FORM|3TEH WITH REH FINAL FORM|<ZAIN FINAL FORM|<MEEM FINAL FORM|<NOON FINAL FORM|<ALEF MAKSURA FINAL FORM|<YEH FINAL FORM|4HEH WITH REH FINAL FORM|=ZAIN FINAL FORM|=MEEM FINAL FORM|=NOON FINAL FORM|=ALEF MAKSURA FINAL FORM|=YEH FINAL FORM|3FEH WITH ALEF MAKSURA FINAL FORM|<YEH FINAL FORM|3QAF WITH ALEF MAKSURA FINAL FORM|<YEH FINAL FORM|3KAF WITH ALEF FINAL FORM|<LAM FINAL FORM|<MEEM FINAL FORM|<ALEF MAKSURA FINAL FORM|<YEH FINAL FORM|3LAM WITH MEEM FINAL FORM|<ALEF MAKSURA FINAL FORM|<YEH FINAL FORM|3MEEM WITH ALEF FINAL FORM|=MEEM FINAL FORM|3NOON WITH REH FINAL FORM|=ZAIN FINAL FORM|=MEEM FINAL FORM|=NOON FINAL FORM|=ALEF MAKSURA FINAL FORM|=YEH FINAL FORM|3ALEF MAKSURA WITH SUPERSCRIPT ALEF FINAL FORM|3YEH WITH REH FINAL FORM|<ZAIN FINAL FORM|<MEEM FINAL FORM|<NOON FINAL FORM|<ALEF MAKSURA FINAL FORM|<YEH FINAL FORM|<HAMZA ABOVE WITH JEEM INITIAL FORM|MHAH INITIAL FORM|MKHAH INITIAL FORM|MMEEM INITIAL FORM|MHEH INITIAL FORM|3BEH WITH JEEM INITIAL FORM|<HAH INITIAL FORM|<KHAH INITIAL FORM|<MEEM INITIAL FORM|<HEH INITIAL FORM|3TEH WITH JEEM INITIAL FORM|<HAH INITIAL FORM|<KHAH INITIAL FORM|<MEEM INITIAL FORM|<HEH INITIAL FORM|4HEH WITH MEEM INITIAL FORM|3JEEM WITH HAH INITIAL FORM|=MEEM INITIAL FORM|3HAH WITH JEEM INITIAL FORM|<MEEM INITIAL FORM|3KHAH WITH JEEM INITIAL FORM|=MEEM INITIAL FORM|3SEEN WITH JEEM INITIAL FORM|=HAH INITIAL FORM|=KHAH INITIAL FORM|=MEEM INITIAL FORM|4AD WITH HAH INITIAL FORM|<KHAH INITIAL FORM|<MEEM INITIAL FORM|3DAD WITH JEEM INITIAL FORM|<HAH INITIAL FORM|<KHAH INITIAL FORM|<MEEM INITIAL FORM|3TAH WITH HAH INITIAL FORM|3ZAH WITH MEEM INITIAL FORM|3AIN WITH JEEM INITIAL FORM|<MEEM INITIAL FORM|3GHAIN WITH JEEM INITIAL FORM|>MEEM INITIAL FORM|3FEH WITH JEEM INITIAL FORM|<HAH INITIAL FORM|<KHAH INITIAL FORM|<MEEM INITIAL FORM|3QAF WITH HAH INITIAL FORM|<MEEM INITIAL FORM|3KAF WITH JEEM INITIAL FORM|<HAH INITIAL FORM|<KHAH INITIAL FORM|<LAM INITIAL FORM|<MEEM INITIAL FORM|3LAM WITH JEEM INITIAL FORM|<HAH INITIAL FORM|<KHAH INITIAL FORM|<MEEM INITIAL FORM|<HEH INITIAL FORM|3MEEM WITH JEEM INITIAL FORM|=HAH INITIAL FORM|=KHAH INITIAL FORM|=MEEM INITIAL FORM|3NOON WITH JEEM INITIAL FORM|=HAH INITIAL FORM|=KHAH INITIAL FORM|=MEEM INITIAL FORM|=HEH INITIAL FORM|3HEH WITH JEEM INITIAL FORM|<MEEM INITIAL FORM|<SUPERSCRIPT ALEF INITIAL FORM|3YEH WITH JEEM INITIAL FORM|<HAH INITIAL FORM|<KHAH INITIAL FORM|<MEEM INITIAL FORM|<HEH INITIAL FORM|=AMZA ABOVE WITH MEEM MEDIAL FORM|MHEH MEDIAL FORM|3BEH WITH MEEM MEDIAL FORM|<HEH MEDIAL FORM|3TEH WITH MEEM MEDIAL FORM|<HEH MEDIAL FORM|4HEH WITH MEEM MEDIAL FORM|=HEH MEDIAL FORM|3SEEN WITH MEEM MEDIAL FORM|=HEH MEDIAL FORM|4HEEN WITH MEEM MEDIAL FORM|>HEH MEDIAL FORM|3KAF WITH LAM MEDIAL FORM|<MEEM MEDIAL FORM|3LAM WITH MEEM MEDIAL FORM|3NOON WITH MEEM MEDIAL FORM|=HEH MEDIAL FORM|3YEH WITH MEEM MEDIAL FORM|<HEH MEDIAL FORM|3SHADDA WITH FATHA MEDIAL FORM|?DAMMA MEDIAL FORM|?KASRA MEDIAL FORM|3TAH WITH ALEF MAKSURA ISOLATED FORM|<YEH ISOLATED FORM|3AIN WITH ALEF MAKSURA ISOLATED FORM|<YEH ISOLATED FORM|3GHAIN WITH ALEF MAKSURA ISOLATED FORM|>YEH ISOLATED FORM|3SEEN WITH ALEF MAKSURA ISOLATED FORM|=YEH ISOLATED FORM|4HEEN WITH ALEF MAKSURA ISOLATED FORM|>YEH ISOLATED FORM|3HAH WITH ALEF MAKSURA ISOLATED FORM|<YEH ISOLATED FORM|3JEEM WITH ALEF MAKSURA ISOLATED FORM|=YEH ISOLATED FORM|3KHAH WITH ALEF MAKSURA ISOLATED FORM|=YEH ISOLATED FORM|3SAD WITH ALEF MAKSURA ISOLATED FORM|<YEH ISOLATED FORM|3DAD WITH ALEF MAKSURA ISOLATED FORM|<YEH ISOLATED FORM|3SHEEN WITH JEEM ISOLATED FORM|>HAH ISOLATED FORM|>KHAH ISOLATED FORM|>MEEM ISOLATED FORM|>REH ISOLATED FORM|4EEN WITH REH ISOLATED FORM|4AD WITH REH ISOLATED FORM|3DAD WITH REH ISOLATED FORM|3TAH WITH ALEF MAKSURA FINAL FORM|<YEH FINAL FORM|3AIN WITH ALEF MAKSURA FINAL FORM|<YEH FINAL FORM|3GHAIN WITH ALEF MAKSURA FINAL FORM|>YEH FINAL FORM|3SEEN WITH ALEF MAKSURA FINAL FORM|=YEH FINAL FORM|4HEEN WITH ALEF MAKSURA FINAL FORM|>YEH FINAL FORM|3HAH WITH ALEF MAKSURA FINAL FORM|<YEH FINAL FORM|3JEEM WITH ALEF MAKSURA FINAL FORM|=YEH FINAL FORM|3KHAH WITH ALEF MAKSURA FINAL FORM|=YEH FINAL FORM|3SAD WITH ALEF MAKSURA FINAL FORM|<YEH FINAL FORM|3DAD WITH ALEF MAKSURA FINAL FORM|<YEH FINAL FORM|3SHEEN WITH JEEM FINAL FORM|>HAH FINAL FORM|>KHAH FINAL FORM|>MEEM FINAL FORM|>REH FINAL FORM|4EEN WITH REH FINAL FORM|4AD WITH REH FINAL FORM|3DAD WITH REH FINAL FORM|3SHEEN WITH JEEM INITIAL FORM|>HAH INITIAL FORM|>KHAH INITIAL FORM|>MEEM INITIAL FORM|4EEN WITH HEH INITIAL FORM|4HEEN WITH HEH INITIAL FORM|3TAH WITH MEEM INITIAL FORM|3SEEN WITH JEEM MEDIAL FORM|=HAH MEDIAL FORM|=KHAH MEDIAL FORM|4HEEN WITH JEEM MEDIAL FORM|>HAH MEDIAL FORM|>KHAH MEDIAL FORM|3TAH WITH MEEM MEDIAL FORM|3ZAH WITH MEEM MEDIAL FORM|3ALEF WITH FATHATAN FINAL FORM|FISOLATED FORM|#ORNATE LEFT PARENTHESIS|*RIGHT PARENTHESIS|#ARABIC LIGATURE RAHIMAHU ALLAAH|5DI ALLAAHU ANH|CAA|CUM|EAA|DNNA|3SALLALLAAHU ALAYHI WA-AALIH|3ALAYHI AS-SALAAM|9M AS-SALAAM|:AA AS-SALAAM|9 AS-SALAATU WAS-SALAAM|3QUDDISA SIRRAH|3SALLALLAHU ALAYHI WAAALIHEE WA-SALLAM|3ALAYHAA AS-SALAAM|3TABAARAKA WA-TAAALAA|3RAHIMAHUM ALLAAH|3TEH WITH JEEM WITH MEEM INITIAL FORM|<HAH WITH JEEM FINAL FORM|JINITIAL FORM|EMEEM INITIAL FORM|<KHAH WITH MEEM INITIAL FORM|<MEEM WITH JEEM INITIAL FORM|FHAH INITIAL FORM|FKHAH INITIAL FORM|3JEEM WITH MEEM WITH HAH FINAL FORM|KINITIAL FORM|3HAH WITH MEEM WITH YEH FINAL FORM|FALEF MAKSURA FINAL FORM|3SEEN WITH HAH WITH JEEM INITIAL FORM|=JEEM WITH HAH INITIAL FORM|GALEF MAKSURA FINAL FORM|=MEEM WITH HAH FINAL FORM|KINITIAL FORM|GJEEM INITIAL FORM|GMEEM FINAL FORM|LINITIAL FORM|4AD WITH HAH WITH HAH FINAL FORM|IINITIAL FORM|<MEEM WITH MEEM FINAL FORM|4HEEN WITH HAH WITH MEEM FINAL FORM|LINITIAL FORM|>JEEM WITH YEH FINAL FORM|>MEEM WITH KHAH FINAL FORM|MINITIAL FORM|HMEEM FINAL FORM|MINITIAL FORM|3DAD WITH HAH WITH ALEF MAKSURA FINAL FORM|<KHAH WITH MEEM FINAL FORM|KINITIAL FORM|3TAH WITH MEEM WITH HAH FINAL FORM|JINITIAL FORM|FMEEM INITIAL FORM|FYEH FINAL FORM|3AIN WITH JEEM WITH MEEM FINAL FORM|<MEEM WITH MEEM FINAL FORM|KINITIAL FORM|FALEF MAKSURA FINAL FORM|3GHAIN WITH MEEM WITH MEEM FINAL FORM|HYEH FINAL FORM|HALEF MAKSURA FINAL FORM|3FEH WITH KHAH WITH MEEM FINAL FORM|KINITIAL FORM|3QAF WITH MEEM WITH HAH FINAL FORM|FMEEM FINAL FORM|3LAM WITH HAH WITH MEEM FINAL FORM|EYEH FINAL FORM|EALEF MAKSURA FINAL FORM|<JEEM WITH JEEM INITIAL FORM|KFINAL FORM|<KHAH WITH MEEM FINAL FORM|KINITIAL FORM|<MEEM WITH HAH FINAL FORM|JINITIAL FORM|3MEEM WITH HAH WITH JEEM INITIAL FORM|FMEEM INITIAL FORM|FYEH FINAL FORM|=JEEM WITH HAH INITIAL FORM|GMEEM INITIAL FORM|=KHAH WITH JEEM INITIAL FORM|GMEEM INITIAL FORM|3RAHMATU ALLAAHI ALAYH|HAA|3MEEM WITH JEEM WITH KHAH INITIAL FORM|3HEH WITH MEEM WITH JEEM INITIAL FORM|FMEEM INITIAL FORM|3NOON WITH HAH WITH MEEM INITIAL FORM|FALEF MAKSURA FINAL FORM|=JEEM WITH MEEM FINAL FORM|LINITIAL FORM|GALEF MAKSURA FINAL FORM|=MEEM WITH YEH FINAL FORM|GALEF MAKSURA FINAL FORM|3YEH WITH MEEM WITH MEEM FINAL FORM|KINITIAL FORM|3BEH WITH KHAH WITH YEH FINAL FORM|3TEH WITH JEEM WITH YEH FINAL FORM|FALEF MAKSURA FINAL FORM|<KHAH WITH YEH FINAL FORM|FALEF MAKSURA FINAL FORM|<MEEM WITH YEH FINAL FORM|FALEF MAKSURA FINAL FORM|3JEEM WITH MEEM WITH YEH FINAL FORM|=HAH WITH ALEF MAKSURA FINAL FORM|=MEEM WITH ALEF MAKSURA FINAL FORM|3SEEN WITH KHAH WITH ALEF MAKSURA FINAL FORM|4AD WITH HAH WITH YEH FINAL FORM|4HEEN WITH HAH WITH YEH FINAL FORM|3DAD WITH HAH WITH YEH FINAL FORM|3LAM WITH JEEM WITH YEH FINAL FORM|<MEEM WITH YEH FINAL FORM|3YEH WITH HAH WITH YEH FINAL FORM|<JEEM WITH YEH FINAL FORM|<MEEM WITH YEH FINAL FORM|3MEEM WITH MEEM WITH YEH FINAL FORM|3QAF WITH MEEM WITH YEH FINAL FORM|3NOON WITH HAH WITH YEH FINAL FORM|3QAF WITH MEEM WITH HAH INITIAL FORM|3LAM WITH HAH WITH MEEM INITIAL FORM|3AIN WITH MEEM WITH YEH FINAL FORM|3KAF WITH MEEM WITH YEH FINAL FORM|3NOON WITH JEEM WITH HAH INITIAL FORM|3MEEM WITH KHAH WITH YEH FINAL FORM|3LAM WITH JEEM WITH MEEM INITIAL FORM|3KAF WITH MEEM WITH MEEM FINAL FORM|3LAM WITH JEEM WITH MEEM FINAL FORM|3NOON WITH JEEM WITH HAH FINAL FORM|3JEEM WITH HAH WITH YEH FINAL FORM|3HAH WITH JEEM WITH YEH FINAL FORM|3MEEM WITH JEEM WITH YEH FINAL FORM|3FEH WITH MEEM WITH YEH FINAL FORM|3BEH WITH HAH WITH YEH FINAL FORM|3KAF WITH MEEM WITH MEEM INITIAL FORM|3AIN WITH JEEM WITH MEEM INITIAL FORM|3SAD WITH MEEM WITH MEEM INITIAL FORM|4EEN WITH KHAH WITH YEH FINAL FORM|3NOON WITH JEEM WITH YEH FINAL FORM|3RAHIMAHU ALLAAH TAAALAA|5DI ALLAAHU TAAALAA ANH|KAA|KUMAA|3SALLALLAHU ALAYHI WA-ALAA AALIHEE WA-SALLAM|3AJJAL ALLAAHU TAAALAA FARAJAHU ASH-SHAREEF|3KARRAMA ALLAAHU WAJHAH|3SALAAMUHU ALAYNAA|6LA USED AS KORANIC STOP SIGN ISOLATED FORM|3QALA USED AS KORANIC STOP SIGN ISOLATED FORM|3ALLAH ISOLATED FORM|4KBAR ISOLATED FORM|3MOHAMMAD ISOLATED FORM|3SALAM ISOLATED FORM|3RASOUL ISOLATED FORM|3ALAYHE ISOLATED FORM|3WASALLAM ISOLATED FORM|3SALLA ISOLATED FORM|8LLAHOU ALAYHE WASALLAM|3JALLAJALALOUHOU|#RIAL SIGN|#ARABIC LIGATURE BISMILLAH AR-RAHMAN AR-RAHEEM|3SUBHAANAHU WA TAAALAA|3AZZA WA JALL|#VARIATION SELECTOR-1|62|63|64|65|66|67|68|69|610|71|72|73|74|75|76|#PRESENTATION FORM FOR VERTICAL COMMA|BIDEOGRAPHIC COMMA|NFULL STOP|BCOLON|BSEMICOLON|BEXCLAMATION MARK|BQUESTION MARK|BLEFT WHITE LENTICULAR BRACKET|BRIGHT WHITE LENTICULAR BRAKCET|BHORIZONTAL ELLIPSIS|#COMBINING LIGATURE LEFT HALF|6RIGHT HALF|-DOUBLE TILDE LEFT HALF|:RIGHT HALF|-MACRON LEFT HALF|4RIGHT HALF|-CONJOINING MACRON|-LIGATURE LEFT HALF BELOW|6RIGHT HALF BELOW|-TILDE LEFT HALF BELOW|3RIGHT HALF BELOW|-MACRON LEFT HALF BELOW|4RIGHT HALF BELOW|-CONJOINING MACRON BELOW|.YRILLIC TITLO LEFT HALF|<RIGHT HALF|#PRESENTATION FORM FOR VERTICAL TWO DOT LEADER|BEM DASH|CN DASH|BLOW LINE|BWAVY LOW LINE|BLEFT PARENTHESIS|BRIGHT PARENTHESIS|BLEFT CURLY BRACKET|BRIGHT CURLY BRACKET|BLEFT TORTOISE SHELL BRACKET|BRIGHT TORTOISE SHELL BRACKET|BLEFT BLACK LENTICULAR BRACKET|BRIGHT BLACK LENTICULAR BRACKET|BLEFT DOUBLE ANGLE BRACKET|BRIGHT DOUBLE ANGLE BRACKET|BLEFT ANGLE BRACKET|BRIGHT ANGLE BRACKET|BLEFT CORNER BRACKET|BRIGHT CORNER BRACKET|BLEFT WHITE CORNER BRACKET|BRIGHT WHITE CORNER BRACKET|#SESAME DOT|#WHITE SESAME DOT|#PRESENTATION FORM FOR VERTICAL LEFT SQUARE BRACKET|BRIGHT SQUARE BRACKET|#DASHED OVERLINE|#CENTRELINE OVERLINE|#WAVY OVERLINE|#DOUBLE WAVY OVERLINE|$ASHED LOW LINE|#CENTRELINE LOW LINE|#WAVY LOW LINE|#SMALL COMMA|)IDEOGRAPHIC COMMA|)FULL STOP|)SEMICOLON|)COLON|)QUESTION MARK|)EXCLAMATION MARK|*M DASH|)LEFT PARENTHESIS|)RIGHT PARENTHESIS|)LEFT CURLY BRACKET|)RIGHT CURLY BRACKET|)LEFT TORTOISE SHELL BRACKET|)RIGHT TORTOISE SHELL BRACKET|)NUMBER SIGN|)AMPERSAND|*STERISK|)PLUS SIGN|)HYPHEN-MINUS|)LESS-THAN SIGN|)GREATER-THAN SIGN|)EQUALS SIGN|)REVERSE SOLIDUS|)DOLLAR SIGN|)PERCENT SIGN|)COMMERCIAL AT|#ARABIC FATHATAN ISOLATED FORM|*TATWEEL WITH FATHATAN ABOVE|*DAMMATAN ISOLATED FORM|*TAIL FRAGMENT|*KASRATAN ISOLATED FORM|*FATHA ISOLATED FORM|0MEDIAL FORM|*DAMMA ISOLATED FORM|0MEDIAL FORM|*KASRA ISOLATED FORM|0MEDIAL FORM|*SHADDA ISOLATED FORM|1MEDIAL FORM|+UKUN ISOLATED FORM|0MEDIAL FORM|*LETTER HAMZA ISOLATED FORM|1ALEF WITH MADDA ABOVE ISOLATED FORM|GFINAL FORM|;HAMZA ABOVE ISOLATED FORM|GFINAL FORM|1WAW WITH HAMZA ABOVE ISOLATED FORM|FFINAL FORM|1ALEF WITH HAMZA BELOW ISOLATED FORM|GFINAL FORM|1YEH WITH HAMZA ABOVE ISOLATED FORM|FFINAL FORM|FINITIAL FORM|FMEDIAL FORM|1ALEF ISOLATED FORM|6FINAL FORM|1BEH ISOLATED FORM|5FINAL FORM|5INITIAL FORM|5MEDIAL FORM|1TEH MARBUTA ISOLATED FORM|=FINAL FORM|5ISOLATED FORM|5FINAL FORM|5INITIAL FORM|5MEDIAL FORM|2HEH ISOLATED FORM|6FINAL FORM|6INITIAL FORM|6MEDIAL FORM|1JEEM ISOLATED FORM|6FINAL FORM|6INITIAL FORM|6MEDIAL FORM|1HAH ISOLATED FORM|5FINAL FORM|5INITIAL FORM|5MEDIAL FORM|1KHAH ISOLATED FORM|6FINAL FORM|6INITIAL FORM|6MEDIAL FORM|1DAL ISOLATED FORM|5FINAL FORM|1THAL ISOLATED FORM|6FINAL FORM|1REH ISOLATED FORM|5FINAL FORM|1ZAIN ISOLATED FORM|6FINAL FORM|1SEEN ISOLATED FORM|6FINAL FORM|6INITIAL FORM|6MEDIAL FORM|2HEEN ISOLATED FORM|7FINAL FORM|7INITIAL FORM|7MEDIAL FORM|2AD ISOLATED FORM|5FINAL FORM|5INITIAL FORM|5MEDIAL FORM|1DAD ISOLATED FORM|5FINAL FORM|5INITIAL FORM|5MEDIAL FORM|1TAH ISOLATED FORM|5FINAL FORM|5INITIAL FORM|5MEDIAL FORM|1ZAH ISOLATED FORM|5FINAL FORM|5INITIAL FORM|5MEDIAL FORM|1AIN ISOLATED FORM|5FINAL FORM|5INITIAL FORM|5MEDIAL FORM|1GHAIN ISOLATED FORM|7FINAL FORM|7INITIAL FORM|7MEDIAL FORM|1FEH ISOLATED FORM|5FINAL FORM|5INITIAL FORM|5MEDIAL FORM|1QAF ISOLATED FORM|5FINAL FORM|5INITIAL FORM|5MEDIAL FORM|1KAF ISOLATED FORM|5FINAL FORM|5INITIAL FORM|5MEDIAL FORM|1LAM ISOLATED FORM|5FINAL FORM|5INITIAL FORM|5MEDIAL FORM|1MEEM ISOLATED FORM|6FINAL FORM|6INITIAL FORM|6MEDIAL FORM|1NOON ISOLATED FORM|6FINAL FORM|6INITIAL FORM|6MEDIAL FORM|1HEH ISOLATED FORM|5FINAL FORM|5INITIAL FORM|5MEDIAL FORM|1WAW ISOLATED FORM|5FINAL FORM|1ALEF MAKSURA ISOLATED FORM|>FINAL FORM|1YEH ISOLATED FORM|5FINAL FORM|5INITIAL FORM|5MEDIAL FORM|+IGATURE LAM WITH ALEF WITH MADDA ABOVE ISOLATED FORM|RFINAL FORM|FHAMZA ABOVE ISOLATED FORM|RFINAL FORM|LBELOW ISOLATED FORM|RFINAL FORM|AISOLATED FORM|AFINAL FORM|#ZERO WIDTH NO-BREAK SPACE|#FULLWIDTH EXCLAMATION MARK|-QUOTATION MARK|-NUMBER SIGN|-DOLLAR SIGN|-PERCENT SIGN|-AMPERSAND|.POSTROPHE|-LEFT PARENTHESIS|-RIGHT PARENTHESIS|-ASTERISK|-PLUS SIGN|-COMMA|-HYPHEN-MINUS|-FULL STOP|-SOLIDUS|-DIGIT ZERO|3ONE|3TWO|4HREE|3FOUR|4IVE|3SIX|4EVEN|3EIGHT|3NINE|-COLON|-SEMICOLON|-LESS-THAN SIGN|-EQUALS SIGN|-GREATER-THAN SIGN|-QUESTION MARK|-COMMERCIAL AT|-LATIN CAPITAL LETTER A|BB|BC|BD|BE|BF|BG|BH|BI|BJ|BK|BL|BM|BN|BO|BP|BQ|BR|BS|BT|BU|BV|BW|BX|BY|BZ|.EFT SQUARE BRACKET|-REVERSE SOLIDUS|.IGHT SQUARE BRACKET|-CIRCUMFLEX ACCENT|-LOW LINE|-GRAVE ACCENT|-LATIN SMALL LETTER A|@B|@C|@D|@E|@F|@G|@H|@I|@J|@K|@L|@M|@N|@O|@P|@Q|@R|@S|@T|@U|@V|@W|@X|@Y|@Z|.EFT CURLY BRACKET|-VERTICAL LINE|-RIGHT CURLY BRACKET|-TILDE|-LEFT WHITE PARENTHESIS|-RIGHT WHITE PARENTHESIS|#HALFWIDTH IDEOGRAPHIC FULL STOP|-LEFT CORNER BRACKET|-RIGHT CORNER BRACKET|-IDEOGRAPHIC COMMA|-KATAKANA MIDDLE DOT|6LETTER WO|=SMALL A|CI|CU|CE|CO|CYA|DU|DO|CTU|5-HIRAGANA PROLONGED SOUND MARK|5 LETTER A|=I|=U|=E|=O|=KA|>I|>U|>E|>O|=SA|>I|>U|>E|>O|=TA|>I|>U|>E|>O|=NA|>I|>U|>E|>O|=HA|>I|>U|>E|>O|=MA|>I|>U|>E|>O|=YA|>U|>O|=RA|>I|>U|>E|>O|=WA|=N|6VOICED SOUND MARK|6SEMI-VOICED SOUND MARK|-HANGUL FILLER|4LETTER KIYEOK|;SSANGKIYEOK|;KIYEOK-SIOS|;NIEUN|@-CIEUC|AHIEUH|;TIKEUT|;SSANGTIKEUT|;RIEUL|@-KIYEOK|AMIEUM|APIEUP|ASIOS|ATHIEUTH|APHIEUPH|AHIEUH|;MIEUM|;PIEUP|;SSANGPIEUP|;PIEUP-SIOS|;SIOS|<SANGSIOS|;IEUNG|;CIEUC|;SSANGCIEUC|;CHIEUCH|;KHIEUKH|;THIEUTH|;PHIEUPH|;HIEUH|;A|<E|;YA|=E|;EO|<|;YEO|=|;O|;WA|=E|;OE|;YO|;U|;WEO|=|<I|;YU|;EU|;YI|;I|#FULLWIDTH CENT SIGN|-POUND SIGN|-NOT SIGN|-MACRON|-BROKEN BAR|-YEN SIGN|-WON SIGN|#HALFWIDTH FORMS LIGHT VERTICAL|-LEFTWARDS ARROW|-UPWARDS ARROW|-RIGHTWARDS ARROW|-DOWNWARDS ARROW|-BLACK SQUARE|-WHITE CIRCLE|#INTERLINEAR ANNOTATION ANCHOR|:SEPARATOR|:TERMINATOR|#OBJECT REPLACEMENT CHARACTER|#REPLACEMENT CHARACTER|#LINEAR B SYLLABLE B008 A|738 E|728 I|761 O|710 U|701 DA|745 DE|707 DI|714 DO|751 DU|87 JA|746 JE|736 JO|765 JU|777 KA|744 KE|767 KI|770 KO|781 KU|80 MA|713 ME|773 MI|715 MO|723 MU|706 NA|724 NE|730 NI|752 NO|85 NU|703 PA|772 PE|739 PI|711 PO|750 PU|716 QA|778 QE|721 QI|732 QO|760 RA|727 RE|753 RI|702 RO|726 RU|731 SA|709 SE|741 SI|712 SO|758 SU|89 TA|704 TE|737 TI|705 TO|769 TU|754 WA|775 WE|740 WI|82 WO|717 ZA|774 ZE|720 ZO|85 A2|743 A3|785 AU|771 DWE|790 DWO|748 NWA|729 PU2|762 PTE|776 RA2|733 RA3|768 RO2|86 TA2|787 TWE|791 TWO|.MBOL B018|69|522|534|547|69|556|563|64|579|582|63|66|69|,IDEOGRAM B100 MAN|82 WOMAN|84 DEER|85 EQUID|9F MARE|9M STALLION|86F EWE|9M RAM|87F SHE-GOAT|9M HE-GOAT|88F SOW|9M BOAR|89F COW|9M BULL|720 WHEAT|81 BARLEY|82 OLIVE|83 SPICE|85 CYPERUS|,MONOGRAM B127 KAPO|88 KANAKO|,IDEOGRAM B130 OIL|81 WINE|82|,MONOGRAM B133 AREPA|85 MERI|,IDEOGRAM B140 BRONZE|81 GOLD|82|85 WOOL|86|750|81 HORN|82|83|84|,MONOGRAM B156 TURO2|,IDEOGRAM B157|88|89 CLOTH|760|81|82 GARMENT|83 ARMOUR|84|85|86|87|88|89|770|81|82|83 MONTH|84|86 TREE|87|88|89|780|81|82|83|84|85|89|790|81 HELMET|6220 FOOTSTOOL|85 BATHTUB|730 SPEAR|81 ARROW|82|83 SWORD|84|86|740 WHEELED CHARIOT|81 CHARIOT|82 CHARIOT FRAME|83 WHEEL|85|86|,MONOGRAM B247 DIPTE|,IDEOGRAM B248|89|751|82|83|84 DART|85|86|87|88|89|5VESSEL B155|=200|?1|?2|?3|?4|?5|?6|?7|?8|?9|>10|?1|?2|?3|?4|?5|?6|?7|?8|?9|>21|?2|?6|?7|?8|?9|>50|=305|#AEGEAN WORD SEPARATOR LINE|9DOT|*CHECK MARK|*NUMBER ONE|1TWO|2HREE|1FOUR|2IVE|1SIX|2EVEN|1EIGHT|1NINE|1TEN|2WENTY|2HIRTY|1FORTY|2IFTY|1SIXTY|2EVENTY|1EIGHTY|1NINETY|1ONE HUNDRED|1TWO HUNDRED|2HREE HUNDRED|1FOUR HUNDRED|2IVE HUNDRED|1SIX HUNDRED|2EVEN HUNDRED|1EIGHT HUNDRED|1NINE HUNDRED|1ONE THOUSAND|1TWO THOUSAND|2HREE THOUSAND|1FOUR THOUSAND|2IVE THOUSAND|1SIX THOUSAND|2EVEN THOUSAND|1EIGHT THOUSAND|1NINE THOUSAND|1TEN THOUSAND|2WENTY THOUSAND|2HIRTY THOUSAND|1FORTY THOUSAND|2IFTY THOUSAND|1SIXTY THOUSAND|2EVENTY THOUSAND|1EIGHTY THOUSAND|1NINETY THOUSAND|*WEIGHT BASE UNIT|1FIRST SUBUNIT|1SECOND SUBUNIT|1THIRD SUBUNIT|1FOURTH SUBUNIT|*DRY MEASURE FIRST SUBUNIT|*LIQUID MEASURE FIRST SUBUNIT|*MEASURE SECOND SUBUNIT|2THIRD SUBUNIT|#GREEK ACROPHONIC ATTIC ONE QUARTER|>HALF|>DRACHMA|:FIVE|<FTY|<VE HUNDRED|?THOUSAND|<FTY THOUSAND|<VE TALENTS|:TEN TALENTS|:FIFTY TALENTS|:ONE HUNDRED TALENTS|:FIVE HUNDRED TALENTS|:ONE THOUSAND TALENTS|:FIVE THOUSAND TALENTS|?STATERS|:TEN STATERS|:FIFTY STATERS|:ONE HUNDRED STATERS|:FIVE HUNDRED STATERS|:ONE THOUSAND STATERS|:TEN THOUSAND STATERS|:FIFTY THOUSAND STATERS|:TEN MNAS|4HERAEUM ONE PLETHRON|4THESPIAN ONE|4HERMIONIAN ONE|4EPIDAUREAN TWO|4THESPIAN TWO|4CYRENAIC TWO DRACHMAS|4EPIDAUREAN TWO DRACHMAS|4TROEZENIAN FIVE|?TEN|B ALTERNATE FORM|4HERMIONIAN TEN|4MESSENIAN TEN|4THESPIAN TEN|>HIRTY|5ROEZENIAN FIFTY|D ALTERNATE FORM|4HERMIONIAN FIFTY|4THESPIAN FIFTY|=ONE HUNDRED|=THREE HUNDRED|4EPIDAUREAN FIVE HUNDRED|4TROEZENIAN FIVE HUNDRED|5HESPIAN FIVE HUNDRED|4CARYSTIAN FIVE HUNDRED|4NAXIAN FIVE HUNDRED|4THESPIAN ONE THOUSAND|=FIVE THOUSAND|4DELPHIC FIVE MNAS|4STRATIAN FIFTY MNAS|)ONE HALF SIGN|6 ALTERNATE FORM|)TWO THIRDS SIGN|*HREE QUARTERS SIGN|)YEAR SIGN|)TALENT SIGN|)DRACHMA SIGN|)OBOL SIGN|)TWO OBOLS SIGN|*HREE OBOLS SIGN|)FOUR OBOLS SIGN|*IVE OBOLS SIGN|)METRETES SIGN|)KYATHOS BASE SIGN|)LITRA SIGN|)OUNKIA SIGN|)XESTES SIGN|)ARTABE SIGN|+OURA SIGN|)GRAMMA SIGN|)TRYBLION BASE SIGN|)ZERO SIGN|)ONE QUARTER SIGN|)SINUSOID SIGN|)INDICTION SIGN|#NOMISMA SIGN|#ROMAN SEXTANS SIGN|)UNCIA SIGN|)SEMUNCIA SIGN|+XTULA SIGN|)DIMIDIA SEXTULA SIGN|)SILIQUA SIGN|)DENARIUS SIGN|)QUINARIUS SIGN|)SESTERTIUS SIGN|)DUPONDIUS SIGN|)AS SIGN|)CENTURIAL SIGN|#ASCIA SYMBOL|#GREEK SYMBOL TAU RHO|#PHAISTOS DISC SIGN PEDESTRIAN|7LUMED HEAD|6TATTOOED HEAD|6CAPTIVE|7HILD|6WOMAN|6HELMET|6GAUNTLET|6TIARA|6ARROW|6BOW|6SHIELD|6CLUB|6MANACLES|8TTOCK|6SAW|6LID|6BOOMERANG|6CARPENTRY PLANE|6DOLIUM|6COMB|6SLING|6COLUMN|6BEEHIVE|6SHIP|6HORN|7IDE|6BULLS LEG|6CAT|6RAM|6EAGLE|6DOVE|6TUNNY|6BEE|6PLANE TREE|6VINE|6PAPYRUS|6ROSETTE|6LILY|6OX BACK|6FLUTE|6GRATER|6STRAINER|7MALL AXE|6WAVY BAND|6COMBINING OBLIQUE STROKE|#LYCIAN LETTER A|1E|1B|2H|1G|1D|1I|1W|1Z|1TH|1J|1K|1Q|1L|1M|1N|1MM|1NN|1U|1P|1KK|1R|1S|1T|2T|1AN|1EN|1H|1X|#CARIAN LETTER A|1P2|1D|1L|1UUU|1R|1LD|1A2|1Q|1B|1M|1O|1D2|1T|1SH|32|2|1C-18|1U|1NN|1X|1N|1TT2|1P|1SS|1I|1E|1UUUU|1K|22|1ND|1UU|1G|22|1ST|32|1NG|1II|1C-39|1TT|1UUU2|1RR|1MB|32|33|34|1LD2|1E2|1UUU3|$OPTIC EPACT THOUSANDS MARK|0DIGIT ONE|6TWO|7HREE|6FOUR|7IVE|6SIX|7EVEN|6EIGHT|6NINE|0NUMBER TEN|8WENTY|8HIRTY|7FORTY|8IFTY|7SIXTY|8EVENTY|7EIGHTY|7NINETY|7ONE HUNDRED|7TWO HUNDRED|8HREE HUNDRED|7FOUR HUNDRED|8IVE HUNDRED|7SIX HUNDRED|8EVEN HUNDRED|7EIGHT HUNDRED|7NINE HUNDRED|#OLD ITALIC LETTER A|5BE|5KE|5DE|5E|5VE|5ZE|5HE|5THE|5I|5KA|5EL|6M|6N|6SH|5O|5PE|5SHE|5KU|5ER|6S|5TE|5U|5EKS|5PHE|5KHE|5EF|6RS|5CHE|5II|5UU|5ESS|.NUMERAL ONE|6FIVE|6TEN|6FIFTY|.LETTER YE|5NORTHERN TSE|5SOUTHERN TSE|#GOTHIC LETTER AHSA|1BAIRKAN|1GIBA|1DAGS|1AIHVUS|1QAIRTHRA|1IUJA|1HAGL|1THIUTH|1EIS|1KUSMA|1LAGUS|1MANNA|1NAUTHS|1JER|1URUS|1PAIRTHRA|1NINETY|1RAIDA|1SAUIL|1TEIWS|1WINJA|1FAIHU|1IGGWS|1HWAIR|1OTHAL|1NINE HUNDRED|#OLD PERMIC LETTER AN|5BUR|5GAI|5DOI|5E|5ZHOI|5DZHOI|5ZATA|5DZITA|5I|5KOKE|5LEI|5MENOE|5NENOE|5VOOI|5PEEI|5REI|5SII|5TAI|5U|5CHERY|5SHOOI|7CHOOI|5YRY|6ERU|5O|6O|5EF|5HA|5TSIU|5VER|5YER|8I|6AT|5IE|5YU|6A|5IA|#COMBINING OLD PERMIC LETTER AN|?DOI|?ZATA|?NENOE|?SII|#UGARITIC LETTER ALPA|3BETA|3GAMLA|3KHA|3DELTA|3HO|3WO|3ZETA|3HOTA|3TET|3YOD|3KAF|3SHIN|3LAMDA|3MEM|3DHAL|3NUN|3ZU|3SAMKA|3AIN|3PU|3SADE|3QOPA|3RASHA|3THANNA|3GHAIN|3TO|3I|3U|3SSU|,WORD DIVIDER|#OLD PERSIAN SIGN A|4I|4U|4KA|5U|4GA|5U|4XA|4CA|4JA|5I|4TA|5U|4DA|5I|5U|4THA|4PA|4BA|4FA|4NA|5U|4MA|5I|5U|4YA|4VA|5I|4RA|5U|4LA|4SA|4ZA|4SHA|5SA|4HA|4AURAMAZDAA|>-2|>HA|4XSHAAYATHIYA|4DAHYAAUSH|=-2|4BAGA|5UUMISH|/WORD DIVIDER|/NUMBER ONE|6TWO|7EN|7WENTY|6HUNDRED|#DESERET CAPITAL LETTER LONG I|?E|?A|@H|?O|@O|:SHORT I|@E|@A|AH|@O|AO|:AY|:OW|:WU|:YEE|:H|:PEE|:BEE|:TEE|:DEE|:CHEE|:JEE|:KAY|:GAY|:EF|:VEE|:ETH|:THEE|:ES|:ZEE|:ESH|:ZHEE|:ER|;L|;M|;N|<G|:OI|:EW|+SMALL LETTER LONG I|=E|=A|>H|=O|>O|8SHORT I|>E|>A|?H|>O|?O|8AY|8OW|8WU|8YEE|8H|8PEE|8BEE|8TEE|8DEE|8CHEE|8JEE|8KAY|8GAY|8EF|8VEE|8ETH|8THEE|8ES|8ZEE|8ESH|8ZHEE|8ER|9L|9M|9N|:G|8OI|8EW|#SHAVIAN LETTER PEEP|2TOT|2KICK|2FEE|2THIGH|2SO|3URE|2CHURCH|2YEA|2HUNG|2BIB|2DEAD|2GAG|2VOW|2THEY|2ZOO|2MEASURE|2JUDGE|2WOE|2HA-HA|2LOLL|2MIME|2IF|2EGG|2ASH|3DO|2ON|2WOOL|2OUT|2AH|2ROAR|2NUN|2EAT|2AGE|2ICE|2UP|2OAK|3OZE|3IL|2AWE|3RE|2OR|2AIR|2ERR|2ARRAY|2EAR|2IAN|2YEW|#OSMANYA LETTER ALEF|2BA|2TA|2JA|2XA|2KHA|2DEEL|2RA|2SA|3HIIN|2DHA|2CAYN|2GA|2FA|2QAAF|2KAAF|2LAAN|2MIIN|2NUUN|2WAW|2HA|2YA|2A|2E|2I|2O|2U|2AA|2EE|2OO|+DIGIT ZERO|1ONE|1TWO|2HREE|1FOUR|2IVE|1SIX|2EVEN|1EIGHT|1NINE|%AGE CAPITAL LETTER A|9I|:N|9H|8BRA|8CHA|8EHCHA|9|9IN|8HA|9YA|8I|8KA|8EHKA|8KYA|8LA|8MA|8NA|8O|9IN|8PA|8EHPA|8SA|9HA|8TA|8EHTA|8TSA|8EHTSA|8TSHA|8DHA|8U|8WA|8KHA|8GHA|8ZA|9HA|)SMALL LETTER A|7I|8N|7H|6BRA|6CHA|6EHCHA|7|7IN|6HA|7YA|6I|6KA|6EHKA|6KYA|6LA|6MA|6NA|6O|7IN|6PA|6EHPA|6SA|7HA|6TA|6EHTA|6TSA|6EHTSA|6TSHA|6DHA|6U|6WA|6KHA|6GHA|6ZA|7HA|#ELBASAN LETTER A|2BE|2CE|3HE|2DE|2NDE|2DHE|2EI|3|2FE|2GE|3JE|2HE|2I|2JE|2KE|2LE|3LE|2ME|2NE|3A|3JE|2O|2PE|2QE|2RE|3RE|2SE|3HE|2TE|3HE|2U|2VE|2XE|2Y|2ZE|3HE|2GHE|4AMMA|2KHE|#CAUCASIAN ALBANIAN LETTER ALT|=BET|=GIM|=DAT|=EB|=ZARL|=EYN|=ZHIL|=TAS|=CHA|=YOWD|=ZHA|=IRB|=SHA|=LAN|=INYA|=XEYN|=DYAN|=CAR|=JHOX|=KAR|=LYIT|=HEYT|=QAY|=AOR|=CHOY|?I|>YAY|=MAQ|=QAR|=NOWC|=DZYAY|=SHAK|=JAYN|=ON|=TYAY|=FAM|=DZAY|=CHAT|=PEN|=GHEYS|=RAT|=SEYK|=VEYZ|=TIWR|=SHOY|=IWN|=CYAW|>AYN|=YAYD|=PIWR|=KIW|6CITATION MARK|#VITHKUQI CAPITAL LETTER A|;BBE|<E|;CE|<HE|;DE|<HE|;EI|<|;FE|;GA|;HA|<HA|;I|<JE|;JE|;KA|;LA|<LA|;ME|;NE|<JE|;O|;PE|;QA|;RE|;SE|<HE|;TE|<HE|;U|;VE|;XE|;Y|;ZE|,SMALL LETTER A|9BBE|:E|9CE|:HE|9DE|:HE|9EI|:|9FE|9GA|9HA|:HA|9I|:JE|9JE|9KA|9LA|:LA|9ME|9NE|:JE|9O|9PE|9QA|9RE|9SE|:HE|9TE|:HE|9U|9VE|9XE|9Y|9ZE|#TODHRI LETTER A|2S|1BA|1MBA|1CA|2HA|1DA|1NDA|1DHA|1EI|2|1FA|1GA|1NGA|1GJA|1NGJA|1HA|2JA|1I|1JA|1KA|1LA|2LA|1MA|1NA|2JAN|1O|1PA|1QA|1RA|2RA|1SA|2HA|3TA|1TA|2HA|1U|1VA|1XA|1NXA|1XHA|1NXHA|1Y|1JY|1ZA|2HA|1GHA|1STA|2KAN|1KHA|1PSA|1OO|#LINEAR A SIGN AB001|52|53|54|55|56|57|58|59|410|51|53|56|57|420|51|6F|6M|52|6F|6M|53|6M|54|56|57|58|2028B|2B029|430|51|54|57|58|59|440|51|54|55|56|57|58|59|450|51|53|54|55|56|57|58|59|460|51|55|56|57|59|470|53|54|56|57|58|59|480|51|52|55|56|57|2100-102|2B118|420|2120B|2B122|53|431A|6B|2131C|2B164|471|480|58|491|2301|42|43|44|45|46|47|48|49A|5B|5C|310|41|42|43A|5B|5C|44|45|46|47|48|49|320|41|42|43|44|45|46|47|48|49|330|41|42|43|44|45|46|47|48|49|340|41|42|43|44|45|46|47|48|49|350|41|42|43|44|45|46|47|48|49|360|41|42|43|44|45|46|47|48|49|370|41|2400-VAS|41-VAS|42-VAS|43-VAS|44-VAS|45-VAS|46-VAS|47-VAS|48-VAS|49-VAS|310-VAS|41-VAS|42-VAS|43-VAS|44-VAS|45-VAS|46-VAS|47-VAS|48-VAS|2501|42|43|44|45|46|48|49|310|41|42|43|45|46|320|41|43|44|45|46|47|48|49|330|41|42|44|45|46|47|48|49|340|41|42|45|47|48|49|350|41|42|43|44|45|46|47|49|363|44|45|46|48|49|370|41|42|43|44|45|46|47|48|49|380|41|42|43|44|45|46|47|48|49|391|42|44|45|46|48|2600|41|42|43|44|46|48|49|310|41|42|43|44|45|46|47|48|49|320|41|42|43|44|46|47|48|49|334|47|48|340|42|43|44|45|46|48|49|351|42|43|44|45|46|47|48|49|360|41|42|43|44|2701 A|42 B|43 D|44 E|45 F|46 H|47 J|48 K|49 L|5-2 L2|63 L3|64 L4|66 L6|310 W|41 X|42 Y|43 OMEGA|44 ABB|45 BB|47 DD|326 EYYY|332 JE|2800|41|42|43|44|45|46|47|#MODIFIER LETTER SMALL CAPITAL AA|4UPERSCRIPT TRIANGULAR COLON|?HALF TRIANGULAR COLON|4MALL AE|9CAPITAL B|9B WITH HOOK|9DZ DIGRAPH|C WITH RETROFLEX HOOK|ICURL|:EZH DIGRAPH|: WITH TAIL|@HOOK|D AND TAIL|9REVERSED E|9CLOSED REVERSED OPEN E|9FENG DIGRAPH|9RAMS HORN|9CAPITAL G|9G WITH HOOK|9CAPITAL G WITH HOOK|9H WITH STROKE|9CAPITAL H|9HENG WITH HOOK|9DOTLESS J WITH STROKE AND HOOK|9LS DIGRAPH|:Z DIGRAPH|: WITH BELT|9CAPITAL L WITH BELT|9L WITH RETROFLEX HOOK AND BELT|:EZH|= WITH RETROFLEX HOOK|9TURNED Y|A WITH BELT|9O WITH STROKE|9CAPITAL OE|:LOSED OMEGA|9Q|9TURNED R WITH LONG LEG|O AND RETROFLEX HOOK|9R WITH TAIL|@FISHHOOK|9CAPITAL R|9TC DIGRAPH WITH CURL|:S DIGRAPH|C WITH RETROFLEX HOOK|:ESH DIGRAPH|: WITH RETROFLEX HOOK|9V WITH RIGHT HOOK|9CAPITAL Y|3GLOTTAL STOP WITH STROKE|3REVERSED GLOTTAL STOP WITH STROKE|3BILABIAL CLICK|3DENTAL CLICK|3LATERAL CLICK|3ALVEOLAR CLICK|3RETROFLEX CLICK WITH RETROFLEX HOOK|3SMALL S WITH CURL|9TURNED T|3INVERTED GLOTTAL STOP|3STRETCHED C|4MALL TURNED K|9ESH WITH DOUBLE BAR|#CYPRIOT SYLLABLE A|4E|4I|4O|4U|4JA|5O|4KA|5E|5I|5O|5U|4LA|5E|5I|5O|5U|4MA|5E|5I|5O|5U|4NA|5E|5I|5O|5U|4PA|5E|5I|5O|5U|4RA|5E|5I|5O|5U|4SA|5E|5I|5O|5U|4TA|5E|5I|5O|5U|4WA|5E|5I|5O|4XA|5E|4ZA|5O|#IMPERIAL ARAMAIC LETTER ALEPH|;BETH|;GIMEL|;DALETH|;HE|;WAW|;ZAYIN|;HETH|;TETH|;YODH|;KAPH|;LAMEDH|;MEM|;NUN|;SAMEKH|;AYIN|;PE|;SADHE|;QOPH|;RESH|;SHIN|;TAW|4SECTION SIGN|4NUMBER ONE|;TWO|<HREE|<EN|<WENTY|;ONE HUNDRED|?THOUSAND|;TEN THOUSAND|#PALMYRENE LETTER ALEPH|4BETH|4GIMEL|4DALETH|4HE|4WAW|4ZAYIN|4HETH|4TETH|4YODH|4KAPH|4LAMEDH|4MEM|4FINAL NUN|4NUN|4SAMEKH|4AYIN|4PE|4SADHE|4QOPH|4RESH|4SHIN|4TAW|/FT-POINTING FLEURON|-RIGHT-POINTING FLEURON|-NUMBER ONE|4TWO|5HREE|4FOUR|5IVE|4TEN|5WENTY|#NABATAEAN LETTER FINAL ALEPH|4ALEPH|4FINAL BETH|4BETH|4GIMEL|4DALETH|4FINAL HE|4HE|4WAW|4ZAYIN|4HETH|4TETH|4FINAL YODH|4YODH|4FINAL KAPH|4KAPH|4FINAL LAMEDH|4LAMEDH|4FINAL MEM|4MEM|4FINAL NUN|4NUN|4SAMEKH|4AYIN|4PE|4SADHE|4QOPH|4RESH|4FINAL SHIN|4SHIN|4TAW|-NUMBER ONE|4TWO|5HREE|4FOUR|-CRUCIFORM NUMBER FOUR|-NUMBER FIVE|4TEN|5WENTY|4ONE HUNDRED|#HATRAN LETTER ALEPH|1BETH|1GIMEL|1DALETH-RESH|1HE|1WAW|1ZAYN|1HETH|1TETH|1YODH|1KAPH|1LAMEDH|1MEM|1NUN|1SAMEKH|1AYN|1PE|1SADHE|1QOPH|1SHIN|1TAW|*NUMBER ONE|1FIVE|1TEN|2WENTY|1ONE HUNDRED|#PHOENICIAN LETTER ALF|5BET|5GAML|5DELT|5HE|5WAU|5ZAI|5HET|5TET|5YOD|5KAF|5LAMD|5MEM|5NUN|5SEMK|5AIN|5PE|5SADE|5QOF|5ROSH|5SHIN|5TAU|.NUMBER ONE|5TEN|6WENTY|5ONE HUNDRED|5TWO|6HREE|.WORD SEPARATOR|#LYDIAN LETTER A|1B|1G|1D|1E|1V|1I|1Y|1K|1L|1M|1N|1O|1R|1SS|1T|1U|1F|1Q|1S|1TT|1AN|1EN|1LY|1NN|1C|*TRIANGULAR MARK|#SIDETIC LETTER N01|42|43|44|45|46|47|48|49|310|41|42|43|44|45|46|47|48|49|320|41|42|43|44|45|46|#MEROITIC HIEROGLYPHIC LETTER A|@E|@I|@O|@YA|@WA|@BA|B-2|@PA|@MA|@NA|B-2|AE|B-2|@RA|B-2|@LA|@KHA|@HHA|@SA|B-2|AE|@KA|@QA|@TA|B-2|AE|B-2|AO|@DA|9SYMBOL VIDJ|D-2|,CURSIVE LETTER A|;E|;I|;O|;YA|;WA|;BA|;PA|;MA|;NA|<E|;RA|;LA|;KHA|;HHA|;SA|;ARCHAIC SA|;SE|;KA|;QA|;TA|<E|<O|;DA|4FRACTION ELEVEN TWELFTHS|=ONE HALF|4LOGOGRAM RMT|=IMN|4NUMBER ONE|;TWO|<HREE|;FOUR|<IVE|;SIX|<EVEN|;EIGHT|;NINE|;TEN|<WENTY|<HIRTY|;FORTY|<IFTY|;SIXTY|<EVENTY|;ONE HUNDRED|;TWO HUNDRED|<HREE HUNDRED|;FOUR HUNDRED|<IVE HUNDRED|;SIX HUNDRED|<EVEN HUNDRED|;EIGHT HUNDRED|;NINE HUNDRED|;ONE THOUSAND|;TWO THOUSAND|<HREE THOUSAND|;FOUR THOUSAND|<IVE THOUSAND|;SIX THOUSAND|<EVEN THOUSAND|;EIGHT THOUSAND|;NINE THOUSAND|;TEN THOUSAND|<WENTY THOUSAND|<HIRTY THOUSAND|;FORTY THOUSAND|<IFTY THOUSAND|;SIXTY THOUSAND|<EVENTY THOUSAND|;EIGHTY THOUSAND|;NINETY THOUSAND|;ONE HUNDRED THOUSAND|;TWO HUNDRED THOUSAND|<HREE HUNDRED THOUSAND|;FOUR HUNDRED THOUSAND|<IVE HUNDRED THOUSAND|;SIX HUNDRED THOUSAND|<EVEN HUNDRED THOUSAND|;EIGHT HUNDRED THOUSAND|;NINE HUNDRED THOUSAND|4FRACTION ONE TWELFTH|=TWO TWELFTHS|>HREE TWELFTHS|=FOUR TWELFTHS|>IVE TWELFTHS|=SIX TWELFTHS|>EVEN TWELFTHS|=EIGHT TWELFTHS|=NINE TWELFTHS|=TEN TWELFTHS|#KHAROSHTHI LETTER A|.VOWEL SIGN I|9U|9VOCALIC R|9E|9O|4LENGTH MARK|.SIGN DOUBLE RING BELOW|3ANUSVARA|3VISARGA|.LETTER KA|6HA|5GA|6HA|5CA|6HA|5JA|5NYA|5TTA|7HA|5DDA|7HA|5NNA|5TA|6HA|5DA|6HA|5NA|5PA|6HA|5BA|6HA|5MA|5YA|5RA|5LA|5VA|5SHA|6SA|6A|5ZA|5HA|5KKA|5TTTHA|8A|5VHA|.SIGN BAR ABOVE|3CAUDA|3DOT BELOW|.VIRAMA|.DIGIT ONE|4TWO|5HREE|4FOUR|.NUMBER TEN|6WENTY|5ONE HUNDRED|9THOUSAND|.FRACTION ONE HALF|.PUNCTUATION DOT|:SMALL CIRCLE|:CIRCLE|;RESCENT BAR|:MANGALAM|:LOTUS|:DANDA|;OUBLE DANDA|:LINES|#OLD SOUTH ARABIAN LETTER HE|<LAMEDH|<HETH|<MEM|<QOPH|<WAW|<SHIN|<RESH|<BETH|<TAW|<SAT|<KAPH|<NUN|<KHETH|<SADHE|>MEKH|<FE|<ALEF|=YN|<DHADHE|<GIMEL|<DALETH|<GHAYN|<TETH|<ZAYN|<DHALETH|<YODH|<THAW|>ETH|5NUMBER ONE|<FIFTY|8ERIC INDICATOR|'NORTH ARABIAN LETTER HEH|<LAM|<HAH|<MEEM|<QAF|<WAW|<ES-2|<REH|<BEH|<TEH|<ES-1|<KAF|<NOON|<KHAH|<SAD|<ES-3|<FEH|<ALEF|=IN|<DAD|<GEEM|<DAL|<GHAIN|<TAH|<ZAIN|<THAL|<YEH|<THEH|<ZAH|5NUMBER ONE|<TEN|=WENTY|#MANICHAEAN LETTER ALEPH|5BETH|6HETH|5GIMEL|6HIMEL|5DALETH|5HE|5WAW|.SIGN UD|.LETTER ZAYIN|6HAYIN|5JAYIN|6HAYIN|5HETH|5TETH|5YODH|5KAPH|5XAPH|5KHAPH|5LAMEDH|5DHAMEDH|5THAMEDH|5MEM|5NUN|5SAMEKH|5AYIN|6AYIN|5PE|5FE|5SADHE|5QOPH|5XOPH|5QHOPH|5RESH|5SHIN|6SHIN|5TAW|.ABBREVIATION MARK ABOVE|@BELOW|.NUMBER ONE|5FIVE|5TEN|6WENTY|5ONE HUNDRED|.PUNCTUATION STAR|:FLEURON|:DOUBLE DOT WITHIN DOT|<T WITHIN DOT|=|:TWO DOTS|:LINE FILLER|#AVESTAN LETTER A|3A|3O|3AO|3N|3AN|3E|4E|2E|3E|2O|3O|2I|3I|2U|3U|2KE|2XE|3YE|3VE|2GE|3GE|3HE|2CE|2JE|2TE|3HE|2DE|3HE|2TTE|2PE|2FE|2BE|3HE|2NGE|4YE|4VE|3E|3YE|3NE|2ME|2HME|2YYE|3E|2VE|2RE|2LE|2SE|2ZE|2SHE|2ZHE|2SHYE|3SHE|2HE|+ABBREVIATION MARK|#TINY TWO DOTS OVER ONE DOT PUNCTUATION|#SMALL TWO DOTS OVER ONE DOT PUNCTUATION|#LARGE TWO DOTS OVER ONE DOT PUNCTUATION|)ONE DOT OVER TWO DOTS PUNCTUATION|)TWO RINGS OVER ONE RING PUNCTUATION|)ONE RING OVER TWO RINGS PUNCTUATION|#INSCRIPTIONAL PARTHIAN LETTER ALEPH|ABETH|AGIMEL|ADALETH|AHE|AWAW|AZAYIN|AHETH|ATETH|AYODH|AKAPH|ALAMEDH|AMEM|ANUN|ASAMEKH|AAYIN|APE|ASADHE|AQOPH|ARESH|ASHIN|ATAW|:NUMBER ONE|ATWO|BHREE|AFOUR|ATEN|BWENTY|AONE HUNDRED|ETHOUSAND|3HLAVI LETTER ALEPH|@BETH|@GIMEL|@DALETH|@HE|@WAW-AYIN-RESH|@ZAYIN|@HETH|@TETH|@YODH|@KAPH|@LAMEDH|@MEM-QOPH|@NUN|@SAMEKH|@PE|@SADHE|AHIN|@TAW|9NUMBER ONE|@TWO|AHREE|@FOUR|@TEN|AWENTY|@ONE HUNDRED|DTHOUSAND|#PSALTER PAHLAVI LETTER ALEPH|:BETH|:GIMEL|:DALETH|:HE|:WAW-AYIN-RESH|:ZAYIN|:HETH|:YODH|:KAPH|:LAMEDH|:MEM-QOPH|:NUN|:SAMEKH|:PE|:SADHE|;HIN|:TAW|3SECTION MARK|3TURNED SECTION MARK|3FOUR DOTS WITH CROSS|BDOT|3NUMBER ONE|:TWO|;HREE|:FOUR|:TEN|;WENTY|:ONE HUNDRED|#OLD TURKIC LETTER ORKHON A|5YENISEI A|>E|5ORKHON I|5YENISEI I|=E|5ORKHON O|=E|5YENISEI OE|5ORKHON AB|5YENISEI AB|5ORKHON AEB|5YENISEI AEB|5ORKHON AG|5YENISEI AG|5ORKHON AEG|5YENISEI AEG|5ORKHON AD|5YENISEI AD|5ORKHON AED|<EZ|5YENISEI EZ|5ORKHON AY|5YENISEI AY|5ORKHON AEY|5YENISEI AEY|5ORKHON AEK|5YENISEI AEK|5ORKHON OEK|5YENISEI OEK|5ORKHON AL|5YENISEI AL|5ORKHON AEL|<ELT|=M|<AN|=EN|5YENISEI AEN|5ORKHON ENT|5YENISEI ENT|5ORKHON ENC|5YENISEI ENC|5ORKHON ENY|5YENISEI ENY|=ANG|5ORKHON ENG|5YENISEI AENG|5ORKHON EP|<OP|<IC|<EC|5YENISEI EC|5ORKHON AQ|5YENISEI AQ|5ORKHON IQ|5YENISEI IQ|5ORKHON OQ|5YENISEI OQ|5ORKHON AR|5YENISEI AR|5ORKHON AER|=S|=ES|=SH|5YENISEI ASH|5ORKHON ESH|5YENISEI ESH|5ORKHON AT|5YENISEI AT|5ORKHON AET|5YENISEI AET|5ORKHON OT|<BASH|'HUNGARIAN CAPITAL LETTER A|AA|@EB|@AMB|@EC|ANC|ACS|AD|@AND|@E|@CLOSE E|@EE|AF|AG|BY|AH|@I|AI|@EJ|AK|@AK|@UNK|@EL|BY|AM|AN|BY|@O|AO|@NIKOLSBURG OE|@RUDIMENTA OE|@OEE|@EP|AMP|AR|@SHORT ER|@ES|BZ|AT|ANT|ATY|ACH|@U|AU|@NIKOLSBURG UE|@RUDIMENTA UE|@EV|AZ|BS|ANT-SHAPED SIGN|@US|1SMALL LETTER A|?A|>EB|>AMB|>EC|?NC|?CS|?D|>AND|>E|>CLOSE E|>EE|?F|?G|@Y|?H|>I|?I|>EJ|?K|>AK|>UNK|>EL|@Y|?M|?N|@Y|>O|?O|>NIKOLSBURG OE|>RUDIMENTA OE|>OEE|>EP|?MP|?R|>SHORT ER|>ES|@Z|?T|?NT|?TY|?CH|>U|?U|>NIKOLSBURG UE|>RUDIMENTA UE|>EV|?Z|@S|?NT-SHAPED SIGN|>US|1NUMBER ONE|8FIVE|8TEN|8FIFTY|8ONE HUNDRED|<THOUSAND|#HANIFI ROHINGYA LETTER A|:BA|:PA|:TA|;TA|:JA|:CA|:HA|:KHA|:FA|:DA|;DA|:RA|;RA|:ZA|:SA|;HA|:KA|:GA|:LA|:MA|:NA|:WA|:KINNA WA|:YA|:KINNA YA|:NGA|;YA|:VA|3VOWEL A|9I|9U|9E|9O|3MARK SAKIN|8NA KHONNA|3SIGN HARBAHAY|8TAHALA|:NA|:SSI|3DIGIT ZERO|9ONE|9TWO|:HREE|9FOUR|:IVE|9SIX|:EVEN|9EIGHT|9NINE|#GARAY DIGIT ZERO|/ONE|/TWO|0HREE|/FOUR|0IVE|/SIX|0EVEN|/EIGHT|/NINE|)VOWEL SIGN A|4I|4O|4EE|/LENGTH MARK|)SUKUN|)CAPITAL LETTER A|8CA|8MA|8KA|8BA|8JA|8SA|8WA|8LA|8GA|8DA|8XA|8YA|8TA|8RA|8NYA|8FA|8NA|8PA|8HA|8OLD KA|<NA|)VOWEL SIGN E|)CONSONANT GEMINATION MARK|+MBINING DOT ABOVE|5UBLE DOT ABOVE|+NSONANT NASALIZATION MARK|)HYPHEN|)REDUPLICATION MARK|)SMALL LETTER A|6CA|6MA|6KA|6BA|6JA|6SA|6WA|6LA|6GA|6DA|6XA|6YA|6TA|6RA|6NYA|6FA|6NA|6PA|6HA|6OLD KA|:NA|)PLUS SIGN|)MINUS SIGN|#RUMI DIGIT ONE|.TWO|/HREE|.FOUR|/IVE|.SIX|/EVEN|.EIGHT|.NINE|(NUMBER TEN|0WENTY|0HIRTY|/FORTY|0IFTY|/SIXTY|0EVENTY|/EIGHTY|/NINETY|/ONE HUNDRED|/TWO HUNDRED|0HREE HUNDRED|/FOUR HUNDRED|0IVE HUNDRED|/SIX HUNDRED|0EVEN HUNDRED|/EIGHT HUNDRED|/NINE HUNDRED|(FRACTION ONE HALF|5QUARTER|5THIRD|1TWO THIRDS|#YEZIDI LETTER ELIF|1BE|1PE|2HE|1THE|1SE|1CIM|2HIM|3HIM|1HHA|1XA|1DAL|1ZAL|1RA|2HA|1ZA|1JA|1SIN|2HIN|2AD|1DAD|1TA|1ZE|1EYN|1XHEYN|1FA|1VA|3 ALTERNATE FORM|1QAF|1KAF|2HAF|1GAF|1LAM|1MIM|1NUN|1UM|1WAW|1OW|1EW|1HAY|1YOT|1ET|*COMBINING HAMZA MARK|4MADDA MARK|*HYPHENATION MARK|*LETTER LAM WITH DOT ABOVE|1YOT WITH CIRCUMFLEX ABOVE|#ARABIC LETTER DAL WITH TWO DOTS VERTICALLY BELOW|1TAH WITH TWO DOTS VERTICALLY BELOW|1KAF WITH TWO DOTS VERTICALLY BELOW|*SMALL YEH BARREE WITH TWO DOTS BELOW|*LETTER THIN NOON|1YEH WITH FOUR DOTS BELOW|*SMALL BASELINE FATHA|9DOTLESS HEAD OF KHAH|*NORTHEAST POINTING ARROWHEAD ABOVE|GBELOW|*SOUTHWEST POINTING ARROWHEAD BELOW|+MALL CIRCLE ABOVE|*LARGE CIRCLE ABOVE|*BIBLICAL END OF VERSE|*LIGATURE ALAYHAA AS-SALAATU WAS-SALAAM|8IM AS-SALAATU WAS-SALAAM|:AA AS-SALAATU WAS-SALAAM|3QADDASA ALLAAHU SIRRAH|4UDDISA SIRRUHUM|CAA|:T ASRAARUHUM|3NAWWARA ALLAAHU MARQADAH|*CROWN LETTER BEH|7PEH|7TEH|8HEH|7JEEM|7HAH|7KHAH|7SEEN|8HEEN|8AD|7DAD|7TAH|7ZAH|7AIN|7GHAIN|7FEH|7QAF|7KAF|7MEEM|7NOON|7HEH|7YEH|*SMALL LOW UPRIGHT RECTANGULAR ZERO|+QUARE BELOW|*FILLED SQUARE BELOW|*SMALL HIGH NOON WITH FATHA|0LOW NOON WITH FATHA|0HIGH NOON WITH DAMMA|0LOW NOON WITH DAMMA|0HIGH HEH INITIAL FORM|5WORD KABBIR|*MARK CROWN|*DOUBLE VERTICAL BAR BELOW|*SMALL LOW NOON|*COMBINING ALEF OVERLAY|*SMALL LOW WORD SAKTA|9QASR|9MADDA|#OLD SOGDIAN LETTER ALEPH|6FINAL ALEPH|6BETH|6FINAL BETH|6GIMEL|6HE|6FINAL HE|6WAW|6ZAYIN|6HETH|6YODH|6KAPH|6LAMEDH|6MEM|6NUN|6FINAL NUN|? WITH VERTICAL TAIL|6SAMEKH|6AYIN|7LTERNATE AYIN|6PE|6SADHE|6FINAL SADHE|A WITH VERTICAL TAIL|6RESH-AYIN-DALETH|6SHIN|6TAW|6FINAL TAW|? WITH VERTICAL TAIL|/NUMBER ONE|6TWO|7HREE|6FOUR|7IVE|6TEN|7WENTY|7HIRTY|6ONE HUNDRED|/FRACTION ONE HALF|/LIGATURE AYIN-DALETH|#SOGDIAN LETTER ALEPH|2BETH|2GIMEL|2HE|2WAW|2ZAYIN|2HETH|2YODH|2KAPH|2LAMEDH|2MEM|2NUN|2SAMEKH|2AYIN|2PE|2SADHE|2RESH-AYIN|2SHIN|2TAW|2FETH|2LESH|+INDEPENDENT SHIN|+COMBINING DOT BELOW|5TWO DOTS BELOW|5DOT ABOVE|5TWO DOTS ABOVE|5CURVE ABOVE|;BELOW|5HOOK ABOVE|:BELOW|5LONG HOOK BELOW|5RESH BELOW|5STROKE BELOW|+NUMBER ONE|2TEN|3WENTY|2ONE HUNDRED|+PUNCTUATION TWO VERTICAL BARS|H WITH DOTS|7CIRCLE WITH DOT|7TWO CIRCLES WITH DOTS|7HALF CIRCLE WITH DOT|#OLD UYGHUR LETTER ALEPH|5BETH|5GIMEL-HETH|5WAW|5ZAYIN|5FINAL HETH|5YODH|5KAPH|5LAMEDH|5MEM|5NUN|5SAMEKH|5PE|5SADHE|5RESH|5SHIN|5TAW|5LESH|.COMBINING DOT ABOVE|<BELOW|8TWO DOTS ABOVE|ABELOW|.PUNCTUATION BAR|:TWO BARS|>DOTS|:FOUR DOTS|#CHORASMIAN LETTER ALEPH|5SMALL ALEPH|5BETH|5GIMEL|5DALETH|5HE|5WAW|5CURLED WAW|5ZAYIN|5HETH|5YODH|5KAPH|5LAMEDH|5MEM|5NUN|5SAMEKH|5AYIN|5PE|5RESH|5SHIN|5TAW|.NUMBER ONE|5TWO|6HREE|5FOUR|5TEN|6WENTY|5ONE HUNDRED|#ELYMAIC LETTER ALEPH|2BETH|2GIMEL|2DALETH|2HE|2WAW|2ZAYIN|2HETH|2TETH|2YODH|2KAPH|2LAMEDH|2MEM|2NUN|2SAMEKH|2AYIN|2PE|2SADHE|2QOPH|2RESH|2SHIN|2TAW|,IGATURE ZAYIN-YODH|#BRAHMI SIGN CANDRABINDU|/ANUSVARA|/VISARGA|/JIHVAMULIYA|/UPADHMANIYA|*LETTER A|2A|1I|2I|1U|2U|1VOCALIC R|:R|9L|:L|1E|1AI|1O|1AU|1KA|2HA|1GA|2HA|1NGA|1CA|2HA|1JA|2HA|1NYA|1TTA|3HA|1DDA|3HA|1NNA|1TA|2HA|1DA|2HA|1NA|1PA|2HA|1BA|2HA|1MA|1YA|1RA|1LA|1VA|1SHA|2SA|2A|1HA|1LLA|1OLD TAMIL LLLA|;RRA|;NNNA|*VOWEL SIGN AA|5BHATTIPROLU AA|5I|6I|5U|6U|5VOCALIC R|>R|=L|>L|5E|5AI|5O|5AU|+IRAMA|*DANDA|+OUBLE DANDA|*PUNCTUATION DOT|8UBLE DOT|6LINE|6CRESCENT BAR|6LOTUS|*NUMBER ONE|1TWO|2HREE|1FOUR|2IVE|1SIX|2EVEN|1EIGHT|1NINE|1TEN|2WENTY|2HIRTY|1FORTY|2IFTY|1SIXTY|2EVENTY|1EIGHTY|1NINETY|1ONE HUNDRED|5THOUSAND|*DIGIT ZERO|0ONE|0TWO|1HREE|0FOUR|1IVE|0SIX|1EVEN|0EIGHT|0NINE|*SIGN OLD TAMIL VIRAMA|*LETTER OLD TAMIL SHORT E|AO|*VOWEL SIGN OLD TAMIL SHORT E|EO|*LETTER OLD TAMIL LLA|*NUMBER JOINER|#KAITHI SIGN CANDRABINDU|/ANUSVARA|/VISARGA|*LETTER A|2A|1I|2I|1U|2U|1E|1AI|1O|1AU|1KA|2HA|1GA|2HA|1NGA|1CA|2HA|1JA|2HA|1NYA|1TTA|3HA|1DDA|3DHA|3HA|1RHA|1NNA|1TA|2HA|1DA|2HA|1NA|1PA|2HA|1BA|2HA|1MA|1YA|1RA|1LA|1VA|1SHA|2SA|2A|1HA|*VOWEL SIGN AA|5I|6I|5U|6U|5E|5AI|5O|5AU|*SIGN VIRAMA|/NUKTA|*ABBREVIATION SIGN|*ENUMERATION SIGN|*NUMBER SIGN|*SECTION MARK|*DOUBLE SECTION MARK|+ANDA|+OUBLE DANDA|*VOWEL SIGN VOCALIC R|*NUMBER SIGN ABOVE|#SORA SOMPENG LETTER SAH|7TAH|7BAH|7CAH|7DAH|7GAH|7MAH|7NGAH|7LAH|7NAH|7VAH|7PAH|7YAH|7RAH|7HAH|7KAH|7JAH|7NYAH|7AH|7EEH|7IH|7UH|7OH|7EH|7MAE|0DIGIT ZERO|6ONE|6TWO|7HREE|6FOUR|7IVE|6SIX|7EVEN|6EIGHT|6NINE|#CHAKMA SIGN CANDRABINDU|/ANUSVARA|/VISARGA|*LETTER AA|1I|1U|1E|1KAA|2HAA|1GAA|2HAA|1NGAA|1CAA|2HAA|1JAA|2HAA|1NYAA|1TTAA|3HAA|1DDAA|3HAA|1NNAA|1TAA|2HAA|1DAA|2HAA|1NAA|1PAA|2HAA|1BAA|2HAA|1MAA|1YYAA|2AA|1RAA|1LAA|1WAA|1SAA|1HAA|*VOWEL SIGN A|5I|6I|5U|6U|5E|5AI|5O|5AU|5OI|*O MARK|*AU MARK|*VIRAMA|*MAAYYAA|*DIGIT ZERO|0ONE|0TWO|1HREE|0FOUR|1IVE|0SIX|1EVEN|0EIGHT|0NINE|*SECTION MARK|*DANDA|+OUBLE DANDA|*QUESTION MARK|*LETTER LHAA|*VOWEL SIGN AA|5EI|*LETTER VAA|#MAHAJANI LETTER A|3I|3U|3E|3O|3KA|4HA|3GA|4HA|3CA|4HA|3JA|4HA|3NYA|3TTA|5HA|3DDA|5HA|3NNA|3TA|4HA|3DA|4HA|3NA|3PA|4HA|3BA|4HA|3MA|3RA|3LA|3VA|3SA|3HA|3RRA|,SIGN NUKTA|,ABBREVIATION SIGN|,SECTION MARK|,LIGATURE SHRI|#SHARADA SIGN CANDRABINDU|0ANUSVARA|0VISARGA|+LETTER A|3A|2I|3I|2U|3U|2VOCALIC R|;R|:L|;L|2E|2AI|2O|2AU|2KA|3HA|2GA|3HA|2NGA|2CA|3HA|2JA|3HA|2NYA|2TTA|4HA|2DDA|4HA|2NNA|2TA|3HA|2DA|3HA|2NA|2PA|3HA|2BA|3HA|2MA|2YA|2RA|2LA|3LA|2VA|2SHA|3SA|3A|2HA|+VOWEL SIGN AA|6I|7I|6U|7U|6VOCALIC R|?R|>L|?L|6E|6AI|6O|6AU|+SIGN VIRAMA|0AVAGRAHA|0JIHVAMULIYA|0UPADHMANIYA|+OM|+DANDA|,OUBLE DANDA|+ABBREVIATION SIGN|+SEPARATOR|,ANDHI MARK|,IGN NUKTA|+VOWEL MODIFIER MARK|+EXTRA SHORT VOWEL MARK|+SUTRA MARK|+VOWEL SIGN PRISHTHAMATRA E|+SIGN INVERTED CANDRABINDU|+DIGIT ZERO|1ONE|1TWO|2HREE|1FOUR|2IVE|1SIX|2EVEN|1EIGHT|1NINE|+EKAM|+SIGN SIDDHAM|+HEADSTROKE|+CONTINUATION SIGN|+SECTION MARK-1|82|$INHALA ARCHAIC DIGIT ONE|9TWO|:HREE|9FOUR|:IVE|9SIX|:EVEN|9EIGHT|9NINE|3NUMBER TEN|;WENTY|;HIRTY|:FORTY|;IFTY|:SIXTY|;EVENTY|:EIGHTY|:NINETY|:ONE HUNDRED|>THOUSAND|#KHOJKI LETTER A|2A|1I|1U|1E|1AI|1O|1AU|1KA|2HA|1GA|2GA|2HA|1NGA|1CA|2HA|1JA|2JA|1NYA|1TTA|3HA|1DDA|3HA|1NNA|1TA|2HA|1DA|2DDA|2HA|1NA|1PA|2HA|1BA|2BA|2HA|1MA|1YA|1RA|1LA|1VA|1SA|1HA|1LLA|*VOWEL SIGN AA|5I|6I|5U|5E|5AI|5O|5AU|*SIGN ANUSVARA|/VIRAMA|/NUKTA|/SHADDA|*DANDA|+OUBLE DANDA|*WORD SEPARATOR|*SECTION MARK|*DOUBLE SECTION MARK|*ABBREVIATION SIGN|*SIGN SUKUN|*LETTER QA|1SHORT I|*VOWEL SIGN VOCALIC R|#MULTANI LETTER A|2I|2U|2E|2KA|3HA|2GA|3HA|2CA|3HA|2JA|3JA|2NYA|2TTA|4HA|2DDA|4DA|4HA|2NNA|2TA|3HA|2DA|3HA|2NA|2PA|3HA|2BA|3HA|2MA|2YA|2RA|2LA|2VA|2SA|2HA|2RRA|3HA|+SECTION MARK|#KHUDAWADI LETTER A|5A|4I|5I|4U|5U|4E|4AI|4O|4AU|4KA|5HA|4GA|5GA|5HA|4NGA|4CA|5HA|4JA|5JA|5HA|4NYA|4TTA|6HA|4DDA|6DA|4RRA|4DDHA|4NNA|4TA|5HA|4DA|5HA|4NA|4PA|5HA|4BA|5BA|5HA|4MA|4YA|4RA|4LA|4VA|4SHA|5A|4HA|-SIGN ANUSVARA|-VOWEL SIGN AA|8I|9I|8U|9U|8E|8AI|8O|8AU|-SIGN NUKTA|2VIRAMA|-DIGIT ZERO|3ONE|3TWO|4HREE|3FOUR|4IVE|3SIX|4EVEN|3EIGHT|3NINE|#GRANTHA SIGN COMBINING ANUSVARA ABOVE|1ANDRABINDU|0ANUSVARA|0VISARGA|+LETTER A|3A|2I|3I|2U|3U|2VOCALIC R|:L|2EE|2AI|2OO|2AU|2KA|3HA|2GA|3HA|2NGA|2CA|3HA|2JA|3HA|2NYA|2TTA|4HA|2DDA|4HA|2NNA|2TA|3HA|2DA|3HA|2NA|2PA|3HA|2BA|3HA|2MA|2YA|2RA|2LA|3LA|2VA|2SHA|3SA|3A|2HA|#COMBINING BINDU BELOW|#GRANTHA SIGN NUKTA|0AVAGRAHA|+VOWEL SIGN AA|6I|7I|6U|7U|6VOCALIC R|?R|6EE|6AI|6OO|6AU|+SIGN VIRAMA|+OM|+AU LENGTH MARK|+SIGN PLUTA|+LETTER VEDIC ANUSVARA|8DOUBLE ANUSVARA|3OCALIC RR|:LL|+VOWEL SIGN VOCALIC L|?L|#COMBINING GRANTHA DIGIT ZERO|;ONE|;TWO|<HREE|;FOUR|<IVE|;SIX|5LETTER A|<KA|<NA|<VI|<PA|#TULU-TIGALARI LETTER A|9A|8I|9I|8U|9U|8VOCALIC R|AR|@L|AL|8EE|8AI|8OO|8AU|8KA|9HA|8GA|9HA|8NGA|8CA|9HA|8JA|9HA|8NYA|8TTA|:HA|8DDA|:HA|8NNA|8TA|9HA|8DA|9HA|8NA|8PA|9HA|8BA|9HA|8MA|8YA|8RA|8LA|8VA|8SHA|9SA|9A|8HA|8LLA|8RRA|8LLLA|1SIGN AVAGRAHA|1VOWEL SIGN AA|<I|=I|<U|=U|<VOCALIC R|ER|DL|EL|<EE|<AI|<OO|<AU|1AU LENGTH MARK|1SIGN CANDRA ANUNASIKA|6ANUSVARA|6VISARGA|8RAMA|6LOOPED VIRAMA|1CONJOINER|1REPHA|1GEMINATION MARK|1SIGN PLUTA|1DANDA|2OUBLE DANDA|1SIGN OM PUSHPIKA|6SHRII PUSHPIKA|1VEDIC TONE SVARITA|<ANUDATTA|#NEWA LETTER A|0A|/I|0I|/U|0U|/VOCALIC R|8R|7L|8L|/E|/AI|/O|/AU|/KA|0HA|/GA|0HA|/NGA|1HA|/CA|0HA|/JA|0HA|/NYA|1HA|/TTA|1HA|/DDA|1HA|/NNA|/TA|0HA|/DA|0HA|/NA|0HA|/PA|0HA|/BA|0HA|/MA|0HA|/YA|/RA|0HA|/LA|0HA|/WA|/SHA|0SA|0A|/HA|(VOWEL SIGN AA|3I|4I|3U|4U|3VOCALIC R|<R|;L|<L|3E|3AI|3O|3AU|(SIGN VIRAMA|-CANDRABINDU|-ANUSVARA|-VISARGA|-NUKTA|-AVAGRAHA|-FINAL ANUSVARA|(OM|(SIDDHI|(DANDA|)OUBLE DANDA|(COMMA|(GAP FILLER|(ABBREVIATION SIGN|(DIGIT ZERO|.ONE|.TWO|/HREE|.FOUR|/IVE|.SIX|/EVEN|.EIGHT|.NINE|)OUBLE COMMA|(PLACEHOLDER MARK|(INSERTION SIGN|(SANDHI MARK|(LETTER VEDIC ANUSVARA|(SIGN JIHVAMULIYA|-UPADHMANIYA|#TIRHUTA ANJI|+LETTER A|3A|2I|3I|2U|3U|2VOCALIC R|;R|:L|;L|2E|2AI|2O|2AU|2KA|3HA|2GA|3HA|2NGA|2CA|3HA|2JA|3HA|2NYA|2TTA|4HA|2DDA|4HA|2NNA|2TA|3HA|2DA|3HA|2NA|2PA|3HA|2BA|3HA|2MA|2YA|2RA|2LA|2VA|2SHA|3SA|3A|2HA|+VOWEL SIGN AA|6I|7I|6U|7U|6VOCALIC R|?R|>L|?L|6E|6SHORT E|6AI|6O|6SHORT O|6AU|+SIGN CANDRABINDU|0ANUSVARA|0VISARGA|2RAMA|0NUKTA|0AVAGRAHA|+GVANG|+ABBREVIATION SIGN|+OM|+DIGIT ZERO|1ONE|1TWO|2HREE|1FOUR|2IVE|1SIX|2EVEN|1EIGHT|1NINE|#SIDDHAM LETTER A|3A|2I|3I|2U|3U|2VOCALIC R|;R|:L|;L|2E|2AI|2O|2AU|2KA|3HA|2GA|3HA|2NGA|2CA|3HA|2JA|3HA|2NYA|2TTA|4HA|2DDA|4HA|2NNA|2TA|3HA|2DA|3HA|2NA|2PA|3HA|2BA|3HA|2MA|2YA|2RA|2LA|2VA|2SHA|3SA|3A|2HA|+VOWEL SIGN AA|6I|7I|6U|7U|6VOCALIC R|?R|6E|6AI|6O|6AU|+SIGN CANDRABINDU|0ANUSVARA|0VISARGA|2RAMA|0NUKTA|0SIDDHAM|+DANDA|,OUBLE DANDA|+SEPARATOR DOT|5BAR|+REPETITION MARK-1|;2|;3|+END OF TEXT MARK|+SECTION MARK WITH TRIDENT AND U-SHAPED ORNAMENTS|IDOTTED CRESCENTS|=RAYS AND DOTTED CRESCENTS|MDOUBLE CRESCENTS|MTRIPLE CRESCENTS|8DOUBLE RING|C WITH RAYS|8WITH DOUBLE CRESCENTS|=TRIPLE CRESCENTS|=QUADRUPLE CRESCENTS|=SEPTUPLE CRESCENTS|=CIRCLES AND RAYS|ITWO ENCLOSURES|IFOUR ENCLOSURES|+LETTER THREE-CIRCLE ALTERNATE I|3WO-CIRCLE ALTERNATE I|HI|2ALTERNATE U|+VOWEL SIGN ALTERNATE U|AU|#MODI LETTER A|0A|/I|0I|/U|0U|/VOCALIC R|8R|7L|8L|/E|/AI|/O|/AU|/KA|0HA|/GA|0HA|/NGA|/CA|0HA|/JA|0HA|/NYA|/TTA|1HA|/DDA|1HA|/NNA|/TA|0HA|/DA|0HA|/NA|/PA|0HA|/BA|0HA|/MA|/YA|/RA|/LA|/VA|/SHA|0SA|0A|/HA|/LLA|(VOWEL SIGN AA|3I|4I|3U|4U|3VOCALIC R|<R|;L|<L|3E|3AI|3O|3AU|(SIGN ANUSVARA|-VISARGA|/RAMA|-ARDHACANDRA|(DANDA|)OUBLE DANDA|(ABBREVIATION SIGN|(SIGN HUVA|(DIGIT ZERO|.ONE|.TWO|/HREE|.FOUR|/IVE|.SIX|/EVEN|.EIGHT|.NINE|%NGOLIAN BIRGA WITH ORNAMENT|-ROTATED BIRGA|-DOUBLE BIRGA WITH ORNAMENT|-TRIPLE BIRGA WITH ORNAMENT|-BIRGA WITH DOUBLE ORNAMENT|-ROTATED BIRGA WITH ORNAMENT|@DOUBLE ORNAMENT|-INVERTED BIRGA|; WITH DOUBLE ORNAMENT|-SWIRL BIRGA|8 WITH ORNAMENT|>DOUBLE ORNAMENT|-TURNED SWIRL BIRGA WITH DOUBLE ORNAMENT|#TAKRI LETTER A|1A|0I|1I|0U|1U|0E|0AI|0O|0AU|0KA|1HA|0GA|1HA|0NGA|0CA|1HA|0JA|1HA|0NYA|0TTA|2HA|0DDA|2HA|0NNA|0TA|1HA|0DA|1HA|0NA|0PA|1HA|0BA|1HA|0MA|0YA|0RA|0LA|0VA|0SHA|1A|0HA|0RRA|)SIGN ANUSVARA|.VISARGA|)VOWEL SIGN AA|4I|5I|4U|5U|4E|4AI|4O|4AU|)SIGN VIRAMA|.NUKTA|)LETTER ARCHAIC KHA|)ABBREVIATION SIGN|)DIGIT ZERO|/ONE|/TWO|0HREE|/FOUR|0IVE|/SIX|0EVEN|/EIGHT|/NINE|#MYANMAR PAO DIGIT ZERO|5ONE|5TWO|6HREE|5FOUR|6IVE|5SIX|6EVEN|5EIGHT|5NINE|+EASTERN PWO KAREN DIGIT ZERO|CONE|CTWO|DHREE|CFOUR|DIVE|CSIX|DEVEN|CEIGHT|CNINE|#AHOM LETTER KA|0HA|/NGA|0A|/TA|/ALTERNATE TA|/PA|0HA|/BA|/MA|/JA|/CHA|/THA|/RA|/LA|/SA|/NYA|/HA|/A|/DA|0HA|/GA|/ALTERNATE GA|/GHA|/BHA|/JHA|/ALTERNATE BA|(CONSONANT SIGN MEDIAL LA|>RA|>LIGATING RA|(VOWEL SIGN A|4A|3I|4I|3U|4U|3E|3AW|3O|3AI|4M|(SIGN KILLER|(DIGIT ZERO|.ONE|.TWO|/HREE|.FOUR|/IVE|.SIX|/EVEN|.EIGHT|.NINE|(NUMBER TEN|0WENTY|(SIGN SMALL SECTION|.ECTION|-RULAI|)YMBOL VI|(LETTER CA|/TTA|1HA|/DDA|1HA|/NNA|/LLA|#DOGRA LETTER A|1A|0I|1I|0U|1U|0E|0AI|0O|0AU|0KA|1HA|0GA|1HA|0NGA|0CA|1HA|0JA|1HA|0NYA|0TTA|2HA|0DDA|2HA|0NNA|0TA|1HA|0DA|1HA|0NA|0PA|1HA|0BA|1HA|0MA|0YA|0RA|0LA|0VA|0SHA|1SA|1A|0HA|0RRA|)VOWEL SIGN AA|4I|5I|4U|5U|4VOCALIC R|=R|4E|4AI|4O|4AU|)SIGN ANUSVARA|.VISARGA|0RAMA|.NUKTA|)ABBREVIATION SIGN|#WARANG CITI CAPITAL LETTER NGAA|>A|>WI|>YU|?A|?O|>II|>UU|>E|>O|>ANG|>GA|>KO|>ENY|>YUJ|>UC|>ENN|>ODD|>TTE|>NUNG|>DA|>AT|?M|>BU|>PU|>HIYO|?OLO|@RR|?AR|>SSUU|?II|>VIYO|/SMALL LETTER NGAA|<A|<WI|<YU|=A|=O|<II|<UU|<E|<O|<ANG|<GA|<KO|<ENY|<YUJ|<UC|<ENN|<ODD|<TTE|<NUNG|<DA|<AT|=M|<BU|<PU|<HIYO|=OLO|>RR|=AR|<SSUU|=II|<VIYO|/DIGIT ZERO|5ONE|5TWO|6HREE|5FOUR|6IVE|5SIX|6EVEN|5EIGHT|5NINE|/NUMBER TEN|7WENTY|7HIRTY|6FORTY|7IFTY|6SIXTY|7EVENTY|6EIGHTY|6NINETY|/OM|#DIVES AKURU LETTER A|7A|6I|7I|6U|7U|6E|6O|6KA|7HA|6GA|7HA|6NGA|6CA|7HA|6JA|6NYA|6TTA|6DDA|8HA|6NNA|6TA|7HA|6DA|7HA|6NA|6PA|7HA|6BA|7HA|6MA|6YA|7YA|6RA|6LA|6VA|6SHA|7SA|7A|6HA|6LLA|6ZA|/VOWEL SIGN AA|:I|;I|:U|;U|:E|:AI|:O|/SIGN ANUSVARA|4CANDRABINDU|4HALANTA|/VIRAMA|/PREFIXED NASAL SIGN|/MEDIAL YA|/INITIAL RA|/MEDIAL RA|/SIGN NUKTA|/DOUBLE DANDA|/GAP FILLER|/END OF TEXT MARK|/DIGIT ZERO|5ONE|5TWO|6HREE|5FOUR|6IVE|5SIX|6EVEN|5EIGHT|5NINE|#NANDINAGARI LETTER A|7A|6I|7I|6U|7U|6VOCALIC R|?R|6E|6AI|6O|6AU|6KA|7HA|6GA|7HA|6NGA|6CA|7HA|6JA|7HA|6NYA|6TTA|8HA|6DDA|8HA|6NNA|6TA|7HA|6DA|7HA|6NA|6PA|7HA|6BA|7HA|6MA|6YA|6RA|6LA|6VA|6SHA|7SA|7A|6HA|6LLA|6RRA|/VOWEL SIGN AA|:I|;I|:U|;U|:VOCALIC R|CR|:E|:AI|:O|:AU|/SIGN ANUSVARA|4VISARGA|6RAMA|4AVAGRAHA|4SIDDHAM|/HEADSTROKE|/VOWEL SIGN PRISHTHAMATRA E|#ZANABAZAR SQUARE LETTER A|4VOWEL SIGN I|?UE|@|?E|?OE|@|?AI|@U|?REVERSED I|:LENGTH MARK|4LETTER KA|<HA|;GA|<HA|;NGA|;CA|<HA|;JA|;NYA|;TTA|=HA|;DDA|=HA|;NNA|;TA|<HA|;DA|<HA|;NA|;PA|<HA|;BA|<HA|;MA|;TSA|=HA|;DZA|=HA|;ZHA|<A|;-A|;YA|;RA|;LA|;VA|;SHA|<SA|<A|;HA|;KSSA|4FINAL CONSONANT MARK|4SIGN VIRAMA|9CANDRABINDU|D WITH ORNAMENT|? WITH ORNAMENT|9ANUSVARA|9VISARGA|4CLUSTER-INITIAL LETTER RA|<FINAL LETTER YA|IRA|ILA|IVA|4INITIAL HEAD MARK|4CLOSING HEAD MARK|4MARK TSHEG|9SHAD|9DOUBLE SHAD|9LONG TSHEG|4INITIAL DOUBLE-LINED HEAD MARK|4CLOSING DOUBLE-LINED HEAD MARK|4SUBJOINER|#SOYOMBO LETTER A|+VOWEL SIGN I|6UE|7|6E|6O|7E|6AI|7U|6VOCALIC R|>L|1LENGTH MARK|+LETTER KA|3HA|2GA|3HA|2NGA|2CA|3HA|2JA|3HA|2NYA|2TTA|4HA|2DDA|4HA|2NNA|2TA|3HA|2DA|3HA|2NA|2PA|3HA|2BA|3HA|2MA|2TSA|4HA|2DZA|2ZHA|3A|2-A|2YA|2RA|2LA|2VA|2SHA|3SA|3A|2HA|2KSSA|+SIGN JIHVAMULIYA|0UPADHMANIYA|+CLUSTER-INITIAL LETTER RA|BLA|BSHA|CA|+FINAL CONSONANT SIGN G|@K|@NG|@D|@N|@B|@M|@R|@L|@SH|A|@-A|+SIGN ANUSVARA|0VISARGA|+GEMINATION MARK|+SUBJOINER|+MARK TSHEG|0SHAD|0DOUBLE SHAD|0PLUTA|+HEAD MARK WITH MOON AND SUN AND TRIPLE FLAME|KFLAME|F|+TERMINAL MARK-1|92|#CANADIAN SYLLABICS NATTILIK HI|AI|@O|AO|@A|AA|?SHRI|CI|BO|CO|BA|CA|6SPE|8I|8O|8A|#PAU CIN HAU LETTER PA|6KA|6LA|6MA|6DA|6ZA|6VA|6NGA|6HA|6GA|6KHA|6SA|6BA|6CA|6TA|7HA|6NA|6PHA|6RA|6FA|6CHA|6A|6E|6I|6O|6U|7A|6IA|6FINAL P|<K|<T|<M|<N|<L|<W|<NG|<Y|/RISING TONE LONG|:|/SANDHI GLOTTAL STOP|/RISING TONE LONG FINAL|;FINAL|/SANDHI GLOTTAL STOP FINAL|6TONE LONG|:|: LONG FINAL|;FINAL|/MID-LEVEL TONE|/GLOTTAL STOP VARIANT|/MID-LEVEL TONE LONG FINAL|>FINAL|/LOW-FALLING TONE LONG|?|/GLOTTAL STOP|/LOW-FALLING TONE LONG FINAL|@FINAL|/GLOTTAL STOP FINAL|#DEVANAGARI HEAD MARK|7 WITH HEADSTROKE|.SIGN BHALE|8 WITH HOOK|3EXTENDED BHALE|A WITH HOOK|3WESTERN FIVE-LIKE BHALE|;NINE-LIKE BHALE|3REVERSED NINE-LIKE BHALE|3MINDU|.LETTER ALTERNATE DDDA|#SHARADA VOWEL SIGN OE|7OE|6UE|7UE|6SHORT E|<O|6CANDRA E|=O|$UNUWAR LETTER DEVI|2TASLA|2EKO|2IMAR|2REU|2UTTHI|2KIK|2MA|2APPHO|2PIP|2GIL|2HAMSO|2CARMI|2NAH|2BUR|2JYAH|2LOACHA|2OTTHI|2SHYELE|2VARCA|2YAT|2AVA|3AL|2DONGA|2THARI|2PHAR|2NGAR|2KHA|2SHYER|2CHELAP|2TENTU|3HELE|2KLOKO|+SIGN PVO|+DIGIT ZERO|1ONE|1TWO|2HREE|1FOUR|2IVE|1SIX|2EVEN|1EIGHT|1NINE|#BHAIKSUKI LETTER A|5A|4I|5I|4U|5U|4VOCALIC R|=R|<L|4E|4AI|4O|4AU|4KA|5HA|4GA|5HA|4NGA|4CA|5HA|4JA|5HA|4NYA|4TTA|6HA|4DDA|6HA|4NNA|4TA|5HA|4DA|5HA|4NA|4PA|5HA|4BA|5HA|4MA|4YA|4RA|4LA|4VA|4SHA|5SA|5A|4HA|-VOWEL SIGN AA|8I|9I|8U|9U|8VOCALIC R|AR|@L|8E|8AI|8O|8AU|-SIGN CANDRABINDU|2ANUSVARA|2VISARGA|4RAMA|2AVAGRAHA|-DANDA|.OUBLE DANDA|-WORD SEPARATOR|-GAP FILLER-1|82|-DIGIT ZERO|3ONE|3TWO|4HREE|3FOUR|4IVE|3SIX|4EVEN|3EIGHT|3NINE|-NUMBER ONE|4TWO|5HREE|4FOUR|5IVE|4SIX|5EVEN|4EIGHT|4NINE|4TEN|5WENTY|5HIRTY|4FORTY|5IFTY|4SIXTY|5EVENTY|4EIGHTY|4NINETY|-HUNDREDS UNIT MARK|#MARCHEN HEAD MARK|+MARK SHAD|+LETTER KA|3HA|2GA|2NGA|2CA|3HA|2JA|2NYA|2TA|3HA|2DA|2NA|2PA|3HA|2BA|2MA|2TSA|4HA|2DZA|2WA|2ZHA|3A|2-A|2YA|2RA|2LA|2SHA|3A|2HA|2A|+SUBJOINED LETTER KA|=HA|<GA|<NGA|<CA|=HA|<JA|<NYA|<TA|=HA|<DA|<NA|<PA|=HA|<BA|<MA|<TSA|>HA|<DZA|<WA|<ZHA|=A|<YA|<RA|<LA|<SHA|=A|<HA|<A|+VOWEL SIGN AA|6I|6U|6E|6O|+SIGN ANUSVARA|0CANDRABINDU|%SARAM GONDI LETTER A|9A|8I|9I|8U|9U|8E|8AI|8O|8AU|8KA|9HA|8GA|9HA|8NGA|8CA|9HA|8JA|9HA|8NYA|8TTA|:HA|8DDA|:HA|8NNA|8TA|9HA|8DA|9HA|8NA|8PA|9HA|8BA|9HA|8MA|8YA|8RA|8LA|8VA|8SHA|9SA|9A|8HA|8LLA|8KSSA|8JNYA|8TRA|1VOWEL SIGN AA|<I|=I|<U|=U|<VOCALIC R|<E|<AI|<O|<AU|1SIGN ANUSVARA|6VISARGA|6NUKTA|6CANDRA|6HALANTA|1VIRAMA|1REPHA|2A-KARA|1DIGIT ZERO|7ONE|7TWO|8HREE|7FOUR|8IVE|7SIX|8EVEN|7EIGHT|7NINE|#GUNJALA GONDI LETTER A|9A|8I|9I|8U|9U|8EE|8AI|8OO|8AU|8YA|8VA|8BA|9HA|8MA|8KA|9HA|8TA|9HA|8LA|8GA|9HA|8DA|9HA|8NA|8CA|9HA|8TTA|:HA|8LLA|8JA|9HA|8DDA|:HA|8NGA|8PA|9HA|8HA|8RA|8SA|1VOWEL SIGN AA|<I|=I|<U|=U|<EE|<AI|<OO|<AU|1SIGN ANUSVARA|6VISARGA|1VIRAMA|1OM|1DIGIT ZERO|7ONE|7TWO|8HREE|7FOUR|8IVE|7SIX|8EVEN|7EIGHT|7NINE|#TOLONG SIKI LETTER I|6E|6U|6O|6A|7A|6P|7H|6B|7H|6M|6T|7H|6D|7H|6N|6TT|8H|6DD|8H|6NN|6C|7H|6J|7H|6NY|6K|7H|6G|7H|6NG|6Y|6R|6L|6V|6NNY|6S|6H|6X|6RR|8H|/SIGN SELA|4HECAKA|/UNGGA|/DIGIT ZERO|5ONE|5TWO|6HREE|5FOUR|6IVE|5SIX|6EVEN|5EIGHT|5NINE|#BENGALI SIGN COMBINING ANUSVARA ABOVE|+LETTER ALTERNATE BARGIYA BA|#MAKASAR LETTER KA|2GA|2NGA|2PA|2BA|2MA|2TA|2DA|2NA|2CA|2JA|2NYA|2YA|2RA|2LA|2VA|2SA|2A|+ANGKA|+VOWEL SIGN I|6U|6E|6O|+PASSIMBANG|+END OF SECTION|#KAWI SIGN CANDRABINDU|-ANUSVARA|-REPHA|-VISARGA|(LETTER A|0A|/I|0I|/U|0U|/VOCALIC R|8R|7L|8L|/E|/AI|/O|/KA|0HA|/GA|0HA|/NGA|/CA|0HA|/JA|0HA|/NYA|/TTA|1HA|/DDA|1HA|/NNA|/TA|0HA|/DA|0HA|/NA|/PA|0HA|/BA|0HA|/MA|/YA|/RA|/LA|/WA|/SHA|0SA|0A|/HA|/JNYA|(VOWEL SIGN AA|4LTERNATE AA|3I|4I|3U|4U|3VOCALIC R|3E|3AI|3EU|(SIGN KILLER|(CONJOINER|(DANDA|)OUBLE DANDA|(PUNCTUATION SECTION MARKER|4ALTERNATE SECTION MARKER|4FLOWER|4SPACE FILLER|4DOT|6UBLE DOT|4TRIPLE DOT|4CIRCLE|4FILLED CIRCLE|4SPIRAL|4CLOSING SPIRAL|(DIGIT ZERO|.ONE|.TWO|/HREE|.FOUR|/IVE|.SIX|/EVEN|.EIGHT|.NINE|(SIGN NUKTA|#LISU LETTER YHA|#TAMIL FRACTION ONE THREE-HUNDRED-AND-TWENTIETH|6ONE-HUNDRED-AND-SIXTIETH|6EIGHTIETH|6SIXTY-FOURTH|6FORTIETH|6THIRTY-SECOND|2THREE EIGHTIETHS|8SIXTY-FOURTHS|2ONE TWENTIETH|6SIXTEENTH-1|@2|6TENTH|6EIGHTH|2THREE TWENTIETHS|8SIXTEENTHS|2ONE FIFTH|6QUARTER|6HALF-1|;2|2THREE QUARTERS|2DOWNSCALING FACTOR KIIZH|)SIGN NEL|.CEVITU|.AAZHAAKKU|.UZHAKKU|.MUUVUZHAKKU|.KURUNI|.PATHAKKU|.MUKKURUNI|.KAACU|.PANAM|/ON|.VARAAKAN|.PAARAM|.KUZHI|.VELI|)WET CULTIVATION SIGN|)DRY CULTIVATION SIGN|)LAND SIGN|)SALT PAN SIGN|)TRADITIONAL CREDIT SIGN|5NUMBER SIGN|)CURRENT SIGN|)AND ODD SIGN|)SPENT SIGN|)TOTAL SIGN|)IN POSSESSION SIGN|)STARTING FROM SIGN|*IGN MUTHALIYA|.VAKAIYARAA|)PUNCTUATION END OF TEXT|#CUNEIFORM SIGN A|3 TIMES A|:BAD|:GAN2 TENU|:HA|:IGI|:LAGAR GUNU|:MUSH|:SAG|32|3B|4 TIMES ASH2|;DUN3 GUNU|;GAL|=N2 TENU|;HA|;IGI GUNU|<MIN|;LAGAB|;SHESH|;U PLUS U PLUS U|5GUNU|42|5 TIMES BALAG|<GAN2 TENU|<ME PLUS EN|<SHA3|<TAK4|3D|3K|4 TIMES ERIN2|;SHITA PLUS GISH|3L|4 TIMES AL|;DIM2|;GISH|;HA|;KAD3|<I|;SHE|;USH|4AN|4EPH|3MAR|6 TIMES SHE|3N|4 OVER AN|5THREE TIMES|5PLUS NAGA OPPOSING AN PLUS NAGA|?SQUARED|4SHE|3PIN|3RAD|6 TIMES KUR|4KAB|3SAL2|4H|5 ZIDA TENU|6KABA TENU|6OVER ASH TUG2 OVER TUG2 TUG2 OVER TUG2 PAP|?OVER ASH|G CROSSING ASH OVER ASH OVER ASH|52|5GAB|2BA|4D|4G3|4HAR2|4L|5 OVER BAL|5AG|4R|5A2|3I|4 TIMES A|;GAR|;IGI GUNU|3U|4 OVER BU AB|=UN|5CROSSING BU|4LUG|7 OVER BULUG|4R|52|2DA|4G|5 KISIM5 TIMES A PLUS MASH|DMAR|CBALAG|DI|CGA|E PLUS MASH|DI|ER2|DUD|CHA|CIR|E PLUS LU|CKAK|CLA|DU|E PLUS MASH2|EM|CNE|CPAP PLUS PAP|CSI|CTAK4|CU2 PLUS GIR2|DSH|4M|4R|5A3|64|3I|4B|4M|5 TIMES SHE|52|4N|5 KASKAL U GUNU DISH|4SH|3U|4 OVER DU|5GUNU|5SHESHIG|4B|5 TIMES ESH2|52|4G|5UD|4H|4N|53|6 GUNU|; GUNU|54|4R2|2E|3 TIMES PAP|4OVER E NUN OVER NUN|32|4 TIMES A PLUS HA PLUS DA|;GAR|;MI|;SAL|<HE|;U|3DIN|3GIR|3L|3N|4 TIMES GAN2|? TENU|;ME|5CROSSING EN|5OPPOSING EN|5SQUARED|3REN|4IN2|3SH2|3ZEN|6 TIMES A|> PLUS LAL|G TIMES LAL|>N|=BAD|=DUN3 GUNU|F GUNU|=HA|? GUNU|=IGI GUNU|=KASKAL|C SQUARED|>U3|=LA|?L TIMES LAL|>I|>U|=U2|>D|2GA|4 GUNU|42|5 TIMES A PLUS DA PLUS HA|CHA|CIGI|=B2 TENU PLUS TAB|=N|=SH|?2 PLUS GAL|<BAD|>R PLUS RA|=UR|? PLUS RA|<DA|=I|>M TIMES SHE|=UB|<EL|> PLUS LA|=N|> TIMES GAN2 TENU|<GAN2 TENU|>R|=I|>4|? PLUS A|>R2 PLUS SU|<HA PLUS LU PLUS ESH2|>L|? PLUS LA|=I PLUS LI|=UB2|<IGI GUNU|=SH PLUS HU PLUS ASH|<KAK|>SKAL|=ID|? PLUS LAL|=U3 PLUS AN|<LA|<ME PLUS EN|=I|<NUN|? OVER NUN|<PA|<SAL|>R|=HE|? PLUS TUR|>ID|=UM|<TAK4|<U|=D|> PLUS DU|6OVER GA2|4BA|6 CROSSING GABA|4D|5 OVER GAD GAR OVER GAR|4L|5 GAD OVER GAD GAR OVER GAR|5AM|4M|4N|52|6 TENU|7OVER GAN2|7CROSSING GAN2|4R|53|4SHAN|3ESHTIN|9 TIMES KUR|3I|4 TIMES E|;U|5CROSSING GI|44|5 OVER GI4|6CROSSING GI4|4DIM|4R2|6 GUNU|53|6 TIMES A PLUS IGI|=GAN2 TENU|=IGI|=LU PLUS IGI|=PA|4SAL|5H|6 CROSSING GISH|7TIMES BAD|=TAK4|8ENU|3U|4 CROSSING GU|42|5 TIMES KAK|? TIMES IGI GUNU|<NUN|<SAL PLUS TUG2|6GUNU|4D|5 TIMES A PLUS KUR|<KUR|6OVER GUD LUGAL|4L|4M|5 TIMES SHE|4R|57|5UN|6SH|2HA|4 TENU|5GUNU|4L|3I|4 TIMES ASH|>2|;BAD|;DISH|;GAD|;KIN|;NUN|;SHE|;U|3U|4B2|6 TIMES AN|=HAL|=KASKAL|=LISH|=UD|4L2|2I|3 A|3B|3DIM|6 OVER IDIM BUR|ASQUARED|3G|4I|5 DIB|6RI|6OVER IGI SHIR OVER SHIR UD OVER UD|6GUNU|3L|4 TIMES GAN2 TENU|42|3M|4 TIMES TAK4|5CROSSING IM|5OPPOSING IM|5SQUARED|4IN|3N|3R|3SH|2KA|4 TIMES A|<D|= PLUS KU3|<SH2|;BAD|=LAG|=R|<I|;ERIN2|<SH2|;GA|=L|=N2 TENU|=R|> PLUS SHA3 PLUS A|<I|=R2|=SH PLUS SAR|@CROSSING GISH|<U|=R7|;IGI|<M|;KAK|<I|=D|;LI|<U|;ME|= PLUS DU|CGI|CTE|<I|= PLUS NUNUZ|;NE|<UN|;PI|;RU|;SA|=R|<HA|=E|=ID|=U|<IG|<UHUR|;TAR|;U|<2|<D|<MUM TIMES PA|<SH|;ZI|42|5 CROSSING KA2|4B|4D2|53|54|55|6 OVER KAD5|4K|5 TIMES IGI GUNU|4L|5 TIMES BAD|6CROSSING KAL|4M2|54|4SKAL|8 LAGAB TIMES U OVER LAGAB TIMES U|9OVER KASKAL LAGAB TIMES U OVER LAGAB TIMES U|3ESH2|3I|4 TIMES BAD|;U|<D|4D|4N|4SAL|5H|5IM5|8 OVER KISIM5|3U|4 OVER HI TIMES ASH2 KU OVER HI TIMES ASH2|43|44|5 VARIANT FORM|47|4L|5 GUNU|4N|4R|5 OPPOSING KUR|4SHU2|3WU318|2LA|4GAB|7 TIMES A|? PLUS DA PLUS HA|EGAR|ELAL|?L|?N|?SH ZIDA TENU|>BAD|?I|>DAR|>EN|>GA|@R|?UD|A PLUS GUD|>HA|@L|?I TIMES NUN|>IGI GUNU|?M|@ PLUS HA|FLU|>KI|@N|?U3|@L|A PLUS HI PLUS A|>LAGAB|?ISH|?U|@L|>ME|@ PLUS EN|?USH|>NE|>SHE PLUS SUM|@ITA PLUS GISH PLUS ERIN2|NTENU|@U2|B PLUS SHU2|?UM|>TAG|@K4|?E PLUS A PLUS SU PLUS NA|>U|? PLUS A|EU PLUS U|?2 PLUS ASH|?D|?SH|8SQUARED|6R|7 TIMES SHE|A PLUS SUM|8GUNU|< OVER LAGAR GUNU SHE|4HSHU|4L|5 TIMES LAL|4M|5 TIMES KUR|? PLUS RU|3I|4L|4MMU2|4SH|3U|4 TIMES BAD|42|5 TIMES AL|<BAD|<ESH2|@ TENU|<GAN2 TENU|<HI TIMES BAD|<IM|<KAD2|?3|@ PLUS ASH|=I|<LA PLUS ASH|>GAB|<ME PLUS EN|<NE|=U|<SI PLUS ASH|>K2 PLUS BU|<TUG2|7ENU|6CROSSING LU2|6OPPOSING LU2|6SQUARED|7HESHIG|43|4GAL|7 OVER LUGAL|9PPOSING LUGAL|8SHESHIG|4H|4L|4M|5 OVER LUM|> GAR OVER GAR|2MA|4 TIMES TAK4|5GUNU|42|4H|4R|4SH|62|3E|4S|3I|4N|3U|4 OVER MU|4G|5 GUNU|4NSUB|4RGU2|4SH|6 TIMES A|=KUR|=ZA|7OVER MUSH|@ TIMES A PLUS NA|7CROSSING MUSH|63|7 TIMES A|? PLUS DI|>DI|8GUNU|2NA|42|4GA|6 INVERTED|7TIMES SHU TENU|7OPPOSING NAGA|6R|4M NUTILLU|5|52|3E|4 TIMES A|;UD|5SHESHIG|3I|4 TIMES E|42|4M|5 TIMES GAN2 TENU|>R PLUS GAN2 TENU|4NDA2|8 TIMES AN|@SH|B PLUS ASH|?GUD|?ME PLUS GAN2 TENU|?NE|@UN|?SHE|B PLUS A AN|ISH|K PLUS ASH|?U2 PLUS ASH|@SH|4SAG|3U|411|4N|5 LAGAR TIMES GAR|BMASH|BSAL|E OVER NUN LAGAR TIMES SAL|BUSH|6TENU|6OVER NUN|6CROSSING NUN|B LAGAR OVER LAGAR|5UZ|7 AB2 TIMES ASHGAB|BBI|BDUG|BGUD|BIGI GUNU|BKAD3|BLA|BNE|BSILA3|BU2|8KISIM5 TIMES BI|G U|2PA|4D|4N|4P|3ESH2|3I|4 TIMES A|<B|;BI|<U|;E|;I|<B|;U|<2|5CROSSING PI|4RIG|7 TIMES KAL|>UD|>ZA|8OPPOSING PIRIG|2RA|4B|3I|3U|2SA|4G NUTILLU|5|5 TIMES A|<DU|>B|<HA|<KAK|=UR|<LUM|<MI|<NUN|<SAL|=HID|<TAB|<U2|=B|=M|=R|=SH|6OVER SAG|6GUNU|4L|5 LAGAB TIMES ASH2|4NGA2|4R|3HA|53|6 TIMES A|=BAD|=GISH|=NE|=SHU2|=TUR|=U|> PLUS A|56|5B6|5R2|4E|5 HU|6OVER SHE GAD OVER GAD GAR OVER GAR|?TAB OVER TAB GAR OVER GAR|5G9|5N|5SH|72|7LAM|4ID|6 TIMES A|=IM|5M|6 TIMES A|=BAL|>ULUG|=DIN|=GAR|=IGI|@ GUNU|=KUSHU2|=LUL|=MUG|=SAL|5NIG|5R|6 TENU|7OVER SHIR BUR OVER BUR|5TA|4U|5 OVER INVERTED SHU|52|5BUR|3I|4 GUNU|4G|54|6 OVER SIG4 SHU2|4K2|4LA3|3U|4 OVER SU|4D|52|4HUR|4M|5ASH|4R|59|2TA|4 ASTERISK|5TIMES HI|;MI|5GUNU|4B|5 OVER TAB NI OVER NI DISH OVER DISH|6SQUARED|4G|5 TIMES BI|<GUD|<SHE|>U|<TUG2|<UD|4K4|4R|3E|4 GUNU|3I|4 TENU|4L|4R|5 TIMES TAK4|6OVER TIR|> GAD OVER GAD GAR OVER GAR|3U|4G2|4K|4M|4R|5 OVER TUR ZA OVER ZA|2U|3 GUD|4U U|4OVER U PA OVER PA GAR OVER GAR|;SUR OVER SUR|;U REVERSED OVER U REVERSED|32|3B|3D|4 KUSHU2|5TIMES BAD|;MI|;U PLUS U PLUS U|J GUNU|5GUNU|5SHESHIG|< TIMES BAD|4UG|3M|4 TIMES LAGAB|;ME PLUS DA|;SHA3|;U|4BIN|4UM|6 TIMES KASKAL|=PA|3N|4 GUNU|3R|4 CROSSING UR|5SHESHIG|42|5 TIMES A PLUS HA|CNA|=L|<HA|<NUN|<U2|> PLUS ASH|DBI|44|4I|53|4U|5 TIMES A|=SHGAB|<BAR|<DUN|<GA|>L|>N2 TENU|>R|=U|<HA|<IGI|=M|=SH|<KI|<LUM|<MIN|<PA|<SHE|=IG4|<TU|<U PLUS GUD|=D|=RUDA|5DA|7 TIMES U|3SH|5 TIMES A|<KU|>R|<TAK4|5X|52|5UMX|3TUKI|3Z3|5 TIMES KASKAL|4U|2ZA|4 TENU|5SQUARED TIMES KUR|4G|4MX|3E2|3I|4 OVER ZI|43|4B|5 KABA TENU|4G|4Z2|3U|45|5 TIMES A|4BUR|4M|2KAP ELAMITE|2AB TIMES NUN|42 TIMES A|3MAR TIMES KUG|2DAG KISIM5 TIMES U2 PLUS MASH|53|3ISH PLUS SHU|3UB TIMES SHE|2EZEN TIMES GUD|=SHE|2GA2 TIMES AN PLUS KAK PLUS A|=SH2|3E22|3IG|2HUSH|2KA TIMES ANSHE|<SH3|;GISH|<UD|;HI TIMES ASH2|;LUM|;PA|;SHUL|;TU|;UR2|2LAGAB TIMES GI|3U2 SHESHIG TIMES BAD|6TIMES ESH2 PLUS LAL|<SHU|2MESH|3USH3 TIMES ZA|2NA4|3IN|59|5DA2 TIMES BAL|?GI|3U11 ROTATED NINETY DEGREES|2PESH2 ASTERISK|3IR2|2SAG TIMES IGI GUNU|2TI2|2UM TIMES ME|3 U|-NUMERIC SIGN TWO ASH|;HREE ASH|:FOUR ASH|;IVE ASH|:SIX ASH|;EVEN ASH|:EIGHT ASH|:NINE ASH|:THREE DISH|:FOUR DISH|;IVE DISH|:SIX DISH|;EVEN DISH|:EIGHT DISH|:NINE DISH|:FOUR U|;IVE U|:SIX U|;EVEN U|:EIGHT U|:NINE U|:ONE GESH2|:TWO GESH2|;HREE GESH2|:FOUR GESH2|;IVE GESH2|:SIX GESH2|;EVEN GESH2|:EIGHT GESH2|:NINE GESH2|:ONE GESHU|:TWO GESHU|;HREE GESHU|:FOUR GESHU|;IVE GESHU|:TWO SHAR2|;HREE SHAR2|E VARIANT FORM|:FOUR SHAR2|;IVE SHAR2|:SIX SHAR2|;EVEN SHAR2|:EIGHT SHAR2|:NINE SHAR2|:ONE SHARU|:TWO SHARU|;HREE SHARU|E VARIANT FORM|:FOUR SHARU|;IVE SHARU|:SHAR2 TIMES GAL PLUS DISH|OMIN|:ONE BURU|:TWO BURU|;HREE BURU|D VARIANT FORM|:FOUR BURU|;IVE BURU|:THREE VARIANT FORM ESH16|P21|:FOUR VARIANT FORM LIMMU|Q4|Q A|RB|:SIX VARIANT FORM ASH9|;EVEN VARIANT FORM IMIN3|Q A|RB|:EIGHT VARIANT FORM USSU|Q3|:NINE VARIANT FORM ILIMMU|R3|R4|R A|:TWO ASH TENU|;HREE ASH TENU|:FOUR ASH TENU|;IVE ASH TENU|:SIX ASH TENU|:ONE BAN2|:TWO BAN2|;HREE BAN2|:FOUR BAN2|C VARIANT FORM|;IVE BAN2|C VARIANT FORM|:NIGIDAMIN|@ESH|:ONE ESHE3|:TWO ESHE3|:ONE THIRD DISH|:TWO THIRDS DISH|:FIVE SIXTHS DISH|:ONE THIRD VARIANT FORM A|:TWO THIRDS VARIANT FORM A|:ONE EIGHTH ASH|>QUARTER ASH|;LD ASSYRIAN ONE SIXTH|KQUARTER|;NE QUARTER GUR|>HALF GUR|:ELAMITE ONE THIRD|BTWO THIRDS|BFORTY|CIFTY|:FOUR U VARIANT FORM|;IVE U VARIANT FORM|:SIX U VARIANT FORM|;EVEN U VARIANT FORM|:EIGHT U VARIANT FORM|:NINE U VARIANT FORM|:SEVEN ASH TENU|-PUNCTUATION SIGN OLD ASSYRIAN WORD DIVIDER|>VERTICAL COLON|>DIAGONAL COLON|GTRICOLON|GQUADCOLON|-NUMERIC SIGN EIGHT ASH TENU|:NINE ASH TENU|:ASH TIMES ONE DISH TENU|DTWO DISH TENU|EHREE DISH TENU|DFOUR DISH TENU|EIVE DISH TENU|DSIX DISH TENU|EEVEN DISH TENU|DEIGHT DISH TENU|DNINE DISH TENU|-SIGN AB TIMES NUN TENU|;SHU2|3D TIMES ESH2|2BAD TIMES DISH TENU|4HAR2 TIMES AB2|?NI|?ZA|3U OVER BU TIMES NA2|2DA TIMES TAK4|4G TIMES KUR|3IM TIMES IGI|<U U U|52 TIMES UD|3UG TIMES ANSHE|=SH|? AT LEFT|<DIN|=UN|<ERIN2|<GA|=I|>R2 GUNU|>SH|<HA|=I|<IGI GUNU|<KASKAL|=UR|>SHU2|B PLUS KASKAL|<LAK-020|>M|? TIMES KUR|=UH PLUS GISH|<MASH|=ES|=I|<NI|<PI|<SHE|=I GUNU|2E2 TIMES KUR|;PAP|3RIN2 X|3SH2 CROSSING ESH2|3ZEN SHESHIG TIMES ASH|EHI|EIGI GUNU|ELA|GL|EME|GS|ESU|7TIMES SU|2GA2 TIMES BAHAR2|<DIM GUNU|=UG TIMES IGI GUNU|FKASKAL|<EREN|<GA|>R PLUS DI|ENE|<HA PLUS A|<KUSHU2 PLUS KASKAL|<LAM|? TIMES KUR|=UH|<MUSH|<NE|> PLUS E2|DGI|<SHIM|<ZIZ2|4BA ROTATED NINETY DEGREES|3ESHTIN TIMES U|3ISH TIMES GISH CROSSING GISH|3U2 TIMES IGI GUNU|4D PLUS GISH TIMES TAK4|2HA TENU GUNU|3I TIMES ASH OVER HI TIMES ASH|2KA TIMES BU|;KA|;U U U|<R|2LAGAB TIMES ZU OVER ZU|4K-003|721|85|730|750|81|762|779 OVER LAK-079 GUNU|780|81 OVER LAK-081|792|6130|742|6210|89|720|85|88|738|765|86|6343|87|88|783|84|790|6441|89|9 TIMES GU|@IGI|@PAP PLUS LU3|IPAP PLUS LU3|@U2 PLUS BA|750|87|770|783|790|82|83|85|6550|6608|717|9 TIMES ASH|@BAD|@DUN3 GUNU GUNU|@KU3|@LA|@TAR|AE|@U2|AD|ARUDA|736|748|9 TIMES DUB|@GA|@IGI|C GUNU|@NI|@PAP PLUS PAP PLUS LU3|@SHESH PLUS KI|@UD|ARUDA|6724|749|3U2 GUNU TIMES ASH|6TIMES DISH|<HAL|<PAP|? PLUS PAP PLUS LU3|<TAK4|2MI PLUS ZA7|3USH OVER MUSH TIMES GA|GKAK|2NINDA2 TIMES DIM GUNU|?GISH|@UL|?HI|?KESH2|?LAK-050|?MASH|?PAP PLUS PAP|?U|@ PLUS U|@RUDA|2SAG GUNU TIMES HA|6TIMES EN|<SHE AT LEFT|<TAK4|3HA6 TENU|4E OVER SHE|6PLUS HUB2|;NAM2|;SAR|4U2 PLUS DUG TIMES NI|<E2 TIMES AN|3I TIMES TAK4|2TAK4 PLUS SAG|3UM TIMES GAN2 TENU|<THREE DISH|2UR2 INVERTED|6TIMES UD|4U TIMES DARA3|<LAK-668|=U3|2ZA7|3U OVER ZU PLUS SAR|45 TIMES THREE DISH TENU|-NUMERIC SIGN ONE N01|:TWO N01|;HREE N01|:FOUR N01|;IVE N01|:SIX N01|;EVEN N01|:EIGHT N01|:NINE N01|:ONE N08|:TWO N08|;HREE N08|:FOUR N08|;IVE N08|:SIX N08|;EVEN N08|:EIGHT N08|:NINE N08|:ONE N14|:TWO N14|;HREE N14|:FOUR N14|;IVE N14|:SIX N14|;EVEN N14|:EIGHT N14|:NINE N14|:ONE N34|:TWO N34|;HREE N34|:FOUR N34|;IVE N34|:SIX N34|;EVEN N34|:EIGHT N34|:NINE N34|:ONE N48|:TWO N48|;HREE N48|:FOUR N48|;IVE N48|:ONE N45|:TWO N45|;HREE N45|:FOUR N45|;IVE N45|:SIX N45|;EVEN N45|:EIGHT N45|:NINE N45|:ONE N50|:TWO N50|;HREE N50|:FOUR N50|;IVE N50|:ONE EIGHTH IKU CURVED|O VARIANT FORM|>N01 REVERSED|>QUARTER IKU CURVED VARIANT FORM|>HALF IKU CURVED VARIANT FORM|>N22|:TWO N22|:ONE BURU CURVED|:TWO BURU CURVED|;HREE BURU CURVED|:FOUR BURU CURVED|;IVE BURU CURVED|:ONE BAN2 CURVED|:TWO BAN2 CURVED|;HREE BAN2 CURVED|:FOUR BAN2 CURVED|;IVE BAN2 CURVED|:NINDA2 TIMES SHE PLUS ONE ASH CURVED|PTWO ASH CURVED|:ONE N51|:TWO N51|;HREE N51|:FOUR N51|;IVE N51|:SIX N51|;EVEN N51|:EIGHT N51|:NINE N51|:ONE N54|:TWO N54|;HREE N54|:FOUR N54|;IVE N54|:ONE N56|:TWO N56|:ONE N24|@6|@8|@9A|AB|?30A|AC|AD|AE|@1|@2|@3|@9A|:TWO N39A|;HREE N39A|:FOUR N39A|:ONE N39B|:TWO N39B|;HREE N39B|:FOUR N39B|:ONE N02|:TWO N02|;HREE N02|:FOUR N02|;IVE N02|:SIX N02|;EVEN N02|:EIGHT N02|:NINE N02|:ONE N15|:TWO N15|;HREE N15|:FOUR N15|;IVE N15|:ONE N35|:TWO N35|;HREE N35|:FOUR N35|;IVE N35|:ONE N06|:TWO N06|;HREE N06|:FOUR N06|;IVE N06|:SIX N06|;EVEN N06|:EIGHT N06|:NINE N06|:ONE N21|:TWO N21|;HREE N21|:FOUR N21|;IVE N21|:ONE N38|?52|:TWO N52|;HREE N52|:FOUR N52|;IVE N52|:SIX N52|;EVEN N52|:EIGHT N52|:NINE N52|:ONE N60|?24A|?40|:TWO N40|;HREE N40|:FOUR N40|:ONE N03|:TWO N03|;HREE N03|:FOUR N03|;IVE N03|:ONE N18|:TWO N18|;HREE N18|:FOUR N18|;IVE N18|:SIX N18|;EVEN N18|:EIGHT N18|:NINE N18|:ONE N45A|?24B|@6B|@8B|@9AB|?41|:TWO N41|;HREE N41|:FOUR N41|:ONE N04|:TWO N04|;HREE N04|:FOUR N04|;IVE N04|:ONE N19|:TWO N19|;HREE N19|:FOUR N19|;IVE N19|:SIX N19|;EVEN N19|:EIGHT N19|:NINE N19|:ONE N46|:TWO N46|:ONE N36|:TWO N36|;HREE N36|:FOUR N36|;IVE N36|:SIX N36|;EVEN N36|:EIGHT N36|:NINE N36|:ONE N49|:TWO N49|;HREE N49|:FOUR N49|:ONE N25|@7|@8C|@9AC|?30AC|ACC|?42A|:TWO N42A|;HREE N42A|:FOUR N42A|:ONE N42B|:TWO N42B|;HREE N42B|:FOUR N42B|:ONE N05|:TWO N05|;HREE N05|:FOUR N05|;IVE N05|:ONE N20|:TWO N20|;HREE N20|:FOUR N20|;IVE N20|:SIX N20|;EVEN N20|:EIGHT N20|:NINE N20|:ONE N47|:TWO N47|:ONE N37|:TWO N37|:ONE N09|?11|@2|?07A|:TWO N07A|;HREE N07A|:ONE N07B|:TWO N07B|;HREE N07B|:ONE N01 FLAT|:TWO N01 FLAT|;HREE N01 FLAT|:FOUR N01 FLAT|;IVE N01 FLAT|:SIX N01 FLAT|;EVEN N01 FLAT|:EIGHT N01 FLAT|:NINE N01 FLAT|:ONE N08 FLAT|?14 FLAT|:TWO N14 FLAT|;HREE N14 FLAT|:FOUR N14 FLAT|;IVE N14 FLAT|:SIX N14 FLAT|;EVEN N14 FLAT|:EIGHT N14 FLAT|:NINE N14 FLAT|:ONE N34 FLAT|:TWO N34 FLAT|;HREE N34 FLAT|:FOUR N34 FLAT|;IVE N34 FLAT|:SIX N34 FLAT|;EVEN N34 FLAT|:EIGHT N34 FLAT|:NINE N34 FLAT|:ONE N45 FLAT|:TWO N45 FLAT|:ONE N22 FLAT|:TWO N22 FLAT|:ONE N51 FLAT|:TWO N51 FLAT|;HREE N51 FLAT|:FOUR N51 FLAT|;IVE N51 FLAT|:SIX N51 FLAT|;EVEN N51 FLAT|:EIGHT N51 FLAT|:NINE N51 FLAT|:ONE N34 FLAT TENU|?04 FLAT|:TWO N04 FLAT|;HREE N04 FLAT|:FOUR N04 FLAT|;IVE N04 FLAT|:ONE N19 FLAT|:TWO N19 FLAT|;HREE N19 FLAT|:FOUR N19 FLAT|;IVE N19 FLAT|:SIX N19 FLAT|;EVEN N19 FLAT|:EIGHT N19 FLAT|:NINE N19 FLAT|:ONE N46 FLAT|:TWO N46 FLAT|:ONE N36 FLAT|$YPRO-MINOAN SIGN CM001|92|94|95|96|97|98|99|810|91|92|:B|93|95|97|99|821|93|94|95|96|97|98|99|830|93|94|95|96|97|98|99|840|91|94|96|97|99|850|91|92|93|94|95|96|98|99|860|91|92|93|94|96|97|98|99|870|91|92|93|94|95|:B|96|98|99|880|91|92|93|94|95|96|97|98|99|890|91|92|94|95|96|97|98|99|7100|91|92|93|94|95|97|98|99|810|92|94|7301|92|#EGYPTIAN HIEROGLYPH A001|:2|:3|:4|:5|;A|:6|;A|;B|:7|:8|:9|910|:1|:2|:3|:4|;A|:5|:6|:7|;A|:8|:9|920|:1|:2|:3|:4|:5|:6|:7|:8|:9|930|:1|:2|;A|:3|:4|:5|:6|:7|:8|:9|940|;A|:1|:2|;A|:3|;A|:4|:5|;A|:6|:7|:8|:9|950|:1|:2|:3|:4|:5|:6|:7|:8|:9|960|:1|:2|:3|:4|:5|:6|:7|:8|:9|970|7B001|:2|:3|:4|:5|;A|:6|:7|:8|:9|7C001|:2|;A|;B|;C|:3|:4|:5|:6|:7|:8|:9|910|;A|:1|:2|:3|:4|:5|:6|:7|:8|:9|920|:1|:2|:3|:4|7D001|:2|:3|:4|:5|:6|:7|:8|;A|:9|910|:1|:2|:3|:4|:5|:6|:7|:8|:9|920|:1|:2|:3|:4|:5|:6|:7|;A|:8|:9|930|:1|;A|:2|:3|:4|;A|:5|:6|:7|:8|:9|940|:1|:2|:3|:4|:5|:6|;A|:7|:8|;A|:9|950|;A|;B|;C|;D|;E|;F|;G|;H|;I|:1|:2|;A|:3|:4|;A|:5|:6|:7|:8|:9|960|:1|:2|:3|:4|:5|:6|:7|;A|;B|;C|;D|;E|;F|;G|;H|7E001|:2|:3|:4|:5|:6|:7|:8|;A|:9|;A|910|:1|:2|:3|:4|:5|:6|;A|:7|;A|:8|:9|920|;A|:1|:2|:3|:4|:5|:6|:7|:8|;A|:9|930|:1|:2|:3|:4|;A|:6|:7|:8|7F001|;A|:2|:3|:4|:5|:6|:7|:8|:9|910|:1|:2|:3|;A|:4|:5|:6|:7|:8|:9|920|:1|;A|:2|:3|:4|:5|:6|:7|:8|:9|930|:1|;A|:2|:3|:4|:5|:6|:7|;A|:8|;A|:9|940|:1|:2|:3|:4|:5|;A|:6|;A|:7|;A|:8|:9|950|:1|;A|;B|;C|:2|:3|7G001|:2|:3|:4|:5|:6|;A|:7|;A|;B|:8|:9|910|:1|;A|:2|:3|:4|:5|:6|:7|:8|:9|920|;A|:1|:2|:3|:4|:5|:6|;A|:7|:8|:9|930|:1|:2|:3|:4|:5|:6|;A|:7|;A|:8|:9|940|:1|:2|:3|;A|:4|:5|;A|:6|:7|:8|:9|950|:1|:2|:3|:4|7H001|:2|:3|:4|:5|:6|;A|:7|:8|7I001|:2|:3|:4|:5|;A|:6|:7|:8|:9|;A|910|;A|:1|;A|:2|:3|:4|:5|7K001|:2|:3|:4|:5|:6|:7|:8|7L001|:2|;A|:3|:4|:5|:6|;A|:7|:8|7M001|;A|;B|:2|:3|;A|:4|:5|:6|:7|:8|:9|910|;A|:1|:2|;A|;B|;C|;D|;E|;F|;G|;H|:3|:4|:5|;A|:6|;A|:7|;A|:8|:9|920|:1|:2|;A|:3|:4|;A|:5|:6|:7|:8|;A|:9|930|:1|;A|:2|:3|;A|;B|:4|:5|:6|:7|:8|:9|940|;A|:1|:2|:3|:4|7N001|:2|:3|:4|:5|:6|:7|:8|:9|910|:1|:2|:3|:4|:5|:6|:7|:8|;A|;B|:9|920|:1|:2|:3|:4|:5|;A|:6|:7|:8|:9|930|:1|:2|:3|;A|:4|;A|:5|;A|:6|:7|;A|:8|:9|940|:1|:2|8L001|;2|;3|;4|;5|<A|;6|;7|;8|;9|:10|;1|;2|;3|;4|;5|;6|;7|<A|;8|;9|:20|8U001|;2|;3|;4|;5|;6|;7|;8|;9|:10|<A|;1|<A|;2|;3|;4|;5|;6|;7|;8|<A|;9|:20|;1|;2|<A|7O001|;A|:2|:3|:4|:5|;A|:6|;A|;B|;C|;D|;E|;F|:7|:8|:9|910|;A|;B|;C|:1|:2|:3|:4|:5|:6|:7|:8|:9|;A|920|;A|:1|:2|:3|:4|;A|:5|;A|:6|:7|:8|:9|;A|930|;A|:1|:2|:3|;A|:4|:5|:6|;A|;B|;C|;D|:7|:8|:9|940|:1|:2|:3|:4|:5|:6|:7|:8|:9|950|;A|;B|:1|7P001|;A|:2|:3|;A|:4|:5|:6|:7|:8|:9|910|:1|7Q001|:2|:3|:4|:5|:6|:7|7R001|:2|;A|:3|;A|;B|:4|:5|:6|:7|:8|:9|910|;A|:1|:2|:3|:4|:5|:6|;A|:7|:8|:9|920|:1|:2|:3|:4|:5|:6|:7|:8|:9|7S001|:2|;A|:3|:4|:5|:6|;A|:7|:8|:9|910|:1|:2|:3|:4|;A|;B|:5|:6|:7|;A|:8|:9|920|:1|:2|:3|:4|:5|:6|;A|;B|:7|:8|:9|930|:1|:2|:3|:4|:5|;A|:6|:7|:8|:9|940|:1|:2|:3|:4|:5|:6|7T001|:2|:3|;A|:4|:5|:6|:7|;A|:8|;A|:9|;A|910|:1|;A|:2|:3|:4|:5|:6|;A|:7|:8|:9|920|:1|:2|:3|:4|:5|:6|:7|:8|:9|930|:1|:2|;A|:3|;A|:4|:5|:6|7U001|:2|:3|:4|:5|:6|;A|;B|:7|:8|:9|910|:1|:2|:3|:4|:5|:6|:7|:8|:9|920|:1|:2|:3|;A|:4|:5|:6|:7|:8|:9|;A|930|:1|:2|;A|:3|:4|:5|:6|:7|:8|:9|940|:1|:2|7V001|;A|;B|;C|;D|;E|;F|;G|;H|;I|:2|;A|:3|:4|:5|:6|:7|;A|;B|:8|:9|910|:1|;A|;B|;C|:2|;A|;B|:3|:4|:5|:6|:7|:8|:9|920|;A|;B|;C|;D|;E|;F|;G|;H|;I|;J|;K|;L|:1|:2|:3|;A|:4|:5|:6|:7|:8|;A|:9|;A|930|;A|:1|;A|:2|:3|;A|:4|:5|:6|:7|;A|:8|:9|940|;A|7W001|:2|:3|;A|:4|:5|:6|:7|:8|:9|;A|910|;A|:1|:2|:3|:4|;A|:5|:6|:7|;A|:8|;A|:9|920|:1|:2|:3|:4|;A|:5|7X001|:2|:3|:4|;A|;B|:5|:6|;A|:7|:8|;A|7Y001|;A|:2|:3|:4|:5|:6|:7|:8|7Z001|:2|;A|;B|;C|;D|:3|;A|;B|:4|;A|:5|;A|:6|:7|:8|:9|910|:1|:2|:3|:4|:5|;A|;B|;C|;D|;E|;F|;G|;H|;I|:6|;A|;B|;C|;D|;E|;F|;G|;H|7AA001|;2|;3|;4|;5|;6|;7|<A|<B|;8|;9|:10|;1|;2|;3|;4|;5|;6|;7|;8|;9|:20|;1|;2|;3|;4|;5|;6|;7|;8|;9|:30|;1|;2|7V011D|8ERTICAL JOINER|7HORIZONTAL JOINER|7INSERT AT TOP START|ABOTTOM START|ATOP END|ABOTTOM END|7OVERLAY MIDDLE|7BEGIN SEGMENT|7END SEGMENT|7INSERT AT MIDDLE|ATOP|ABOTTOM|7BEGIN ENCLOSURE|7END ENCLOSURE|7BEGIN WALLED ENCLOSURE|7END WALLED ENCLOSURE|7MIRROR HORIZONTALLY|7FULL BLANK|7HALF BLANK|7LOST SIGN|7HALF LOST SIGN|7TALL LOST SIGN|7WIDE LOST SIGN|7MODIFIER DAMAGED AT TOP START|KBOTTOM START|KSTART|KTOP END|N|KBOTTOM START AND TOP END|KSTART AND TOP|KBOTTOM END|KTOP START AND BOTTOM END|KBOTTOM|KSTART AND BOTTOM|KEND|KTOP AND END|KBOTTOM AND END|G|#ANATOLIAN HIEROGLYPH A001|;2|;3|;4|;5|;6|;7|;8|;9|:10|<A|;1|;2|;3|;4|;5|;6|;7|;8|;9|:20|;1|;2|;3|;4|;5|;6|<A|;7|;8|;9|:30|;1|;2|;3|;4|;5|;6|;7|;8|;9|<A|:40|;1|<A|;2|;3|;4|;5|<A|;6|<A|<B|;7|;8|;9|:50|;1|;2|;3|;4|;5|;6|;7|;8|;9|:60|;1|;2|;3|;4|;5|;6|<A|<B|<C|;7|;8|;9|:70|;1|;2|;3|;4|;5|;6|;7|;8|;9|:80|;1|;2|;3|;4|;5|;6|;7|;8|;9|:90|;1|;2|;3|;4|;5|;6|;7|<A|;8|<A|;9|9100|<A|;1|<A|;2|<A|;3|;4|<A|<B|<C|;5|<A|<B|;6|;7|<A|<B|<C|;8|;9|:10|<A|<B|;1|;2|;3|;4|;5|<A|;6|;7|;8|;9|:20|;1|;2|;3|;4|;5|<A|;6|;7|;8|;9|:30|;1|;2|;3|;4|;5|<A|;6|;7|;8|;9|:40|;1|;2|;3|;4|;5|;6|;7|;8|;9|:50|;1|;2|;3|;4|;5|;6|;7|;8|;9|:60|;1|;2|;3|;4|;5|;6|;7|;8|;9|:70|;1|;2|;3|;4|;5|;6|;7|;8|;9|:80|;1|;2|;3|;4|;5|;6|;7|;8|;9|:90|;1|;2|;3|;4|;5|;6|;7|;8|;9|9200|;1|;2|<A|<B|;3|;4|;5|;6|;7|<A|;8|;9|<A|:10|;1|;2|;3|;4|;5|<A|;6|<A|;7|;8|;9|:20|;1|;2|;3|;4|;5|;6|;7|<A|;8|;9|:30|;1|;2|;3|;4|;5|;6|;7|;8|;9|:40|;1|;2|;3|;4|;5|;6|;7|;8|;9|:50|;1|;2|;3|;4|;5|;6|;7|;8|;9|:60|;1|;2|;3|;4|;5|;6|;7|<A|;8|;9|:70|;1|;2|;3|;4|;5|;6|;7|;8|;9|:80|;1|;2|;3|;4|;5|;6|;7|;8|;9|<A|:90|;1|;2|;3|;4|<A|;5|;6|;7|;8|;9|<A|9300|;1|;2|;3|;4|;5|;6|;7|;8|;9|<A|:10|;1|;2|;3|;4|;5|;6|;7|;8|;9|:20|;1|;2|;3|;4|;5|;6|;7|;8|;9|<A|:30|;1|;2A|<B|<C|;3|;4|;5|;6|<A|<B|<C|;7|;8|;9|:40|;1|;2|;3|;4|;5|;6|;7|;8|;9|:50|;1|;2|;3|;4|;5|;6|;7|;8|;9|<A|:60|;1|;2|;3|;4|<A|;5|;6|;7|;8|<A|;9|:70|;1|<A|;2|;3|;4|;5|;6|;7|;8|;9|:80|;1|<A|;2|;3 RA OR RI|<A|;4|;5|;6|<A|;7|;8|;9|:90|;1|;2|;3 EIGHT|;4|;5|;6|;7|;8|;9|9400|;1|;2|;3|;4|;5|;6|;7|;8|;9|:10 BEGIN LOGOGRAM MARK|<A END LOGOGRAM MARK|;1|;2|;3|;4|;5|;6|;7|;8|;9|:20|;1|;2|;3|;4|;5|;6|;7|;8|;9|:30|;1|;2|;3|;4|;5|;6|;7|;8|;9|:40|;1|;2|;3|;4|;5|;6|;7|;8|;9|:50|<A|;1|;2|;3|;4|;5|;6|;7|<A|;8|;9|:60|;1|;2|;3|;4|;5|;6|;7|;8|;9|:70|;1|;2|;3|;4|;5|;6|;7|;8|;9|:80|;1|;2|;3|;4|;5|;6|;7|;8|;9|:90|;1|;2|;3|;4|;5|;6|;7|9501|;2|;3|;4|;5|;6|;7|;8|;9|:10|;1|;2|;3|;4|;5|;6|;7|;8|;9|:20|;1|;2|;3|;4|;5|;6|;7|;8|;9|:30|#GURUNG KHEMA LETTER A|7KA|8HA|7GA|8HA|7NGA|7CA|8HA|7JA|8HA|7HA|7TTA|9HA|7DDA|9HA|7VA|7TA|8HA|7DA|8HA|7NA|7PA|8HA|7BA|8HA|7MA|7YA|7RA|7LA|7SA|0VOWEL SIGN AA|;I|<I|;U|<U|;E|<E|;AI|;O|<O|;AU|6LENGTH MARK|0CONSONANT SIGN MEDIAL YA|FVA|FHA|0SIGN ANUSVARA|0CONSONANT SIGN MEDIAL RA|0SIGN THOLHOMA|0DIGIT ZERO|6ONE|6TWO|7HREE|6FOUR|7IVE|6SIX|7EVEN|6EIGHT|6NINE|#BAMUM LETTER PHASE-A NGKUE MFON|8GBIEE FON|8PON MFON PIPAEMGBIEE|GBA|8NAA MFON|8SHUENSHUET|8TITA MFON|8NZA MFON|8SHINDA PA NJI|8PON PA NJI PIPAEMGBIEE|IBA|8MAEMBGBIEE|8TU MAEMBA|8NGANGU|8MAEMVEUX|:NSUAE|9VEUAENGAM|8SEUNYAM|8NTOQPEN|8KEUKEUTNDA|8NKINDI|8SUU|8NGKUENZEUM|8LAPAQ|9ET KUT|8NTAP MFAA|8MAEKEUP|8PASHAE|8GHEUAERAE|8PAMSHAE|8MON NGGEUAET|8NZUN MEUT|8U YUQ NAE|8GHEUAEGHEUAE|8NTAP NTAA|8SISA|8MGBASA|9EUNJOMNDEUQ|9OOMPUQ|8KAFA|8PA LEERAEWA|8NDA LEERAEWA|8PET|8MAEMKPEN|8NIKA|8PUP|8TUAEP|8LUAEP|8SONJAM|8TEUTEUWEN|8MAENYI|8KET|8NDAANGGEUAET|8KUOQ|8MOOMEUT|8SHUM|8LOMMAE|8FIRI|8ROM|8KPOQ|8SOQ|8MAP PIEET|8SHIRAE|8NTAP|8SHOQ NSHUT YUM|8NYIT MONGKEUAEQ|8PAARAE|8NKAARAE|8UNKNOWN|8NGGEN|8MAESI|8NJAM|8MBANYI|8NYET|8TEUAEN|8SOT|8PAAM|8NSHIEE|8MAEM|8NYI|8KAQ|8NSHA|8VEE|8LU|8NEN|9AQ|8MBAQ|6B NSHUET|8TU MAEMGBIEE|8SIEE|9ET TU|8LOM NTEUM|8MBA MAELEE|8KIEEM|8YEURAE|8MBAARAE|8KAM|8PEESHI|8YAFU LEERAEWA|8LAM NSHUT NYAM|8NTIEE SHEUOQ|9DU NJAA|8GHEUGHEUAEM|8PIT|8TU NSIEE|8SHET NJAQ|;UAEQTU|8MFON TEUAEQ|9BIT MBAAKET|8NYI NTEUM|8KEUPUQ|8GHEUGHEN|8KEUYEUX|8LAANAE|8PARUM|8VEUM|8NGKINDI MVOP|:GEU MBU|8WUAET|8SAKEUAE|8TAAM|8MEUQ|8NGGUOQ|> LARGE|8MFIYAQ|8SUE|8MBEURI|9ONTIEEN|8NYAEMAE|8PUNGAAM|8MEUT NGGEET|8FEUX|8MBUOQ|8FEE|8KEUAEM|8MA NJEUAENA|=UQA|8LET|8NGGAAM|9SEN|8MA|8KIQ|8NGOM|6C NGKUE MAEMBA|9ZA|8YUM|8WANGKUOQ|8NGGEN|9DEUAEREE|9GKAQ|8GHARAE|8MBEEKEET|8GBAYI|8NYIR MKPARAQ MEUN|9TU MBIT|8MBEUM|8PIRIEEN|8NDOMBU|8MBAA CABBAGE-TREE|8KEUSHEUAEP|8GHAP|8KEUKAQ|8YU MUOMAE|8NZEUM|8MBUE|8NSEUAEN|8MBIT|8YEUQ|8KPARAQ|9AA|8SEUX|8NDIDA|8TAASHAE|8NJUEQ|8TITA YUE|8SUAET|8NGGUAEN NYAM|8VEUX|8NANSANAQ|8MA KEUAERI|8NTAA|9GGUON|8LAP|8MBIRIEEN|9GBASAQ|8NTEUNGBA|8TEUTEUX|8NGGUM|8FUE|8NDEUT|9SA|:HAQ|8BUNG|8VEUAEPEN|8MBERAE|8RU|8NJAEM|8LAM|8TITUAEP|8NSUOT NGOM|9JEEEE|8KET|8NGGU|8MAESI|9BUAEM|8LU|8KUT|8NJAM|9GOM|8WUP|8NGGUEET|9SOM|9TEN|8KUOP NKAARAE|8NSUN|9DAM|8MA NSIEE|8YAA|8NDAP|8SHUEQ|9ETFON|8MBI|9AEMBA|9BANYI|8KEUSEUX|8MBEUX|8KEUM|8MBAA PICKET|8YUWOQ|8NJEUX|8MIEE|9UAE|8SHIQ|8KEN LAW|<FATIGUE|8NGAQ|9AQ|8LIQ|8PIN|9EN|8TET|6D MBUO|8WAP|8NJI|8MFON|8NJIEE|8LIEE|8NJEUT|9SHEE|9GGAAMAE|9YAM|8WUAEN|8NGKUN|8SHEE|8NGKAP|8KEUAETMEUN|8TEUT|8SHEUAE|8NJAP|8SUE|8KET|8YAEMMAE|8KUOM|8SAP|8MFEUT|8NDEUX|8MALEERI|9EUT|8SEUAEQ|8YEN|8NJEUAEM|8KEUOT MBUAE|8NGKEURI|8TU|8GHAA|8NGKYEE|8FEUFEUAET|8NDEE|8MGBOFUM|8LEUAEP|8NDON|8MONI|9GBEUN|8PUUT|8MGBIEE|9FO|8LUM|8NSIEEP|8MBAA|8KWAET|8NYET|8TEUAEN|8SOT|8YUWOQ|8KEUM|8RAEM|8TEEEE|8NGKEUAEQ|8MFEUAE|8NSIEET|8KEUP|8PIP|9EUTAE|8NYUE|8LET|8NGGAAM|8MFIEE|8NGGWAEN|8YUOM|8PAP|8YUOP|8NDAM|9TEUM|8SUAE|8KUN|8NGGEUX|:KIEE|8TUOT|8MEUN|8KUQ|8NSUM|8TEUN|8MAENJET|8NGGAP|8LEUM|8NGGUOM|9SHUT|9JUEQ|8GHEUAE|8KU|8REN OLD|8TAE|9OQ|8NYI|8RII|8LEEEE|8MEEEE|9|8SUU|8MU|8SHII|:EUX|8KYEE|8NU|8SHU|8NTEE|8PEE|8NI|8SHOQ|8PUQ|8MVOP|8LOQ|8REN MUCH|8TI|8NTUU|8MBAA SEVEN|8SAQ|8FAA|6E NDAP|8TOON|8MBEUM|8LAP|8VOM|8LOON|8PAA|8SOM|8RAQ|8NSHUOP|9DUN|8PUAE|8TAM|8NGKA|8KPEUX|8WUO|8SEE|8NGGEUAET|8PAAM|8TOO|8KUOP|8LOM|8NSHIEE|9GOP|8MAEM|8NGKEUX|:OQ|9SHUE|8RIMGBA|8NJEUX|8PEEM|8SAA|8NGGURAE|8MGBA|8GHEUX|8NGKEUAEM|9JAEMLI|8MAP|8LOOT|8NGGEEEE|9DIQ|8TAEN NTEUM|8SET|8PUM|8NDAA SOFTNESS|9GGUAESHAE NYAM|8YIEE|8GHEUN|8TUAE|8YEUAE|8PO|8TUMAE|8KEUAE|8SUAEN|8TEUAEQ|8VEUAE|8WEUX|8LAAM|8PU|8TAAQ|8GHAAMAE|8NGEUREUT|8SHEUAEQ|8MGBEN|9BEE|8NZAQ|9KOM|8GBET|8TUM|8KUET|8YAP|8NYI CLEAVER|8YIT|8MFEUQ|8NDIAQ|8PIEEQ|8YUEQ|8LEUAEM|8FUE|8GBEUX|8NGKUP|8KET|8MAE|8NGKAAMI|8GHET|8FA|8NTUM|8PEUT|8YEUM|8NGGEUAE|9YI BETWEEN|9ZUQ|8POON|8MIEE|8FUET|8NAE|8MUAE|8GHEUAE|8FU I|8MVI|8PUAQ|8NGKUM|8KUT|8PIET|8NTAP|8YEUAET|8NGGUP|8PA PEOPLE|8FU CALL|9OM|8NJEE|8A|8TOQ|8O|8I|8LAQ|8PA PLURAL|8TAA|:Q|8NDAA MY HOUSE|8SHIQ|8YEUX|8NGUAE|8YUAEN|9OQ SWIMMING|<COVER|9UQ|:N|8KEUX|8PEUX|8NJEE EPOCH|8PUE|8WUE|8FEE|8VEE|8LU|8MI|8REUX|9AE|8NGUAET|:A|8SHO|;Q|8FU REMEDY|8NA|8PI|8LOQ|8KO|8MEN|9A|:Q|8TEU|8KI|8MON|8TEN|8FAQ|8GHOM|6F KA|8U|8KU|8EE|8REE|8TAE|8NYI|8LA|8RII|:EE|8MEEEE|8TAA|8NDAA|9JAEM|8M|8SUU|9HII|9I|9EUX|8KYEE|9ET|8NUAE|:|9JUAE|8YOQ|8SHU|8YA|8NSHA|8PEUX|8NTEE|8WUE|8PEE|8RU|8NI|8REUX|8KEN|8NGKWAEN|:GA|8SHO|8PUAE|8FOM|8WA|8LI|9OQ|8KO|8MBEN|8REN|8MA|9O|9BAA|8TET|8KPA|8SAMBA|8VUEQ|#MRO LETTER TA|.NGI|.YO|.MIM|.BA|.DA|.A|.PHI|.KHAI|.HAO|.DAI|.CHU|.KEAAE|.OL|.MAEM|.NIN|.PA|.OO|/|.RO|.SHI|.THEA|.EA|.WA|.E|.KO|.LAN|0|.HAI|.RI|.TEK|'DIGIT ZERO|-ONE|-TWO|.HREE|-FOUR|.IVE|-SIX|.EVEN|-EIGHT|-NINE|(ANDA|(OUBLE DANDA|#TANGSA LETTER OZ|2C|2Q|2X|1AZ|2C|2Q|2X|1VZ|2C|2Q|2X|1EZ|2C|2Q|2X|1IZ|2C|2Q|2X|1UZ|2C|2Q|2X|1AWZ|3C|3Q|3X|1UIZ|3C|3Q|3X|1FINAL NG|1LONG UEX|1SHORT UEZ|7AWX|1UEC|3Z|3Q|3X|2IUZ|4C|4Q|4X|1MZ|2C|2Q|2X|1KA|2HA|1GA|1NGA|1SA|1YA|1WA|1PA|1NYA|1PHA|1BA|1MA|1NA|1HA|1LA|1HTA|1TA|1DA|1RA|1NHA|1SHA|1CA|1TSA|1GHA|1HTTA|1THA|1XA|1FA|1DHA|1CHA|1ZA|*DIGIT ZERO|0ONE|0TWO|1HREE|0FOUR|1IVE|0SIX|1EVEN|0EIGHT|0NINE|#BASSA VAH LETTER ENNI|4KA|4SE|4FA|4MBE|4YIE|4GAH|4DHII|4KPAH|4JO|4HWAH|4WA|4ZO|4GBU|4DO|4CE|4UWU|4TO|4BA|4VU|4YEIN|4PA|4WADDA|4A|4O|5O|4U|4EE|5|4I|-COMBINING HIGH TONE|7LOW TONE|7MID TONE|7LOW-MID TONE|7HIGH-LOW TONE|-FULL STOP|#PAHAWH HMONG VOWEL KEEB|9V|7IB|8V|7AUB|9V|7UB|8V|7EB|8V|7AIB|9V|7OOB|9V|7AWB|9V|7UAB|9V|7OB|8V|7IAB|9V|7AB|8V|7WB|8V|7AAB|9V|0CONSONANT VAU|:NTSAU|:LAU|:HAU|:NLAU|:RAU|:NKAU|:QHAU|:YAU|:HLAU|:MAU|:CHAU|:NCHAU|:HNAU|:PLHAU|:NTHAU|;AU|:AU|:XAU|:CAU|0MARK CIM TUB|9SO|9KES|:HAV|9SUAM|9HOM|9TAUM|0SIGN VOS THOM|:SHAB CEEB|5CIM CHEEM|5VOS THIAB|9FEEM|5XYEEM NTXIV|;RHO|;TOV|;FAIB|5VOS SEEV|5MEEJ SUAB|5VOS NRUA|5IB YAM|5XAUS|5CIM TSOV ROG|0DIGIT ZERO|6ONE|6TWO|7HREE|6FOUR|7IVE|6SIX|7EVEN|6EIGHT|6NINE|0NUMBER TENS|7HUNDREDS|7TEN THOUSANDS|7MILLIONS|7HUNDRED MILLIONS|7TEN BILLIONS|8RILLIONS|0SIGN VOS LUB|5XYOO|5HLI|5THIRD-STAGE HLI|5ZWJ THAJ|5HNUB|5NQIG|5XIAB|5NTUJ|5AV|5TXHEEJ CEEV|5MEEJ TSEEB|5TAU|5LOS|5MUS|5CIM HAIS LUS NTOG NTOG|9CUAM TSHOOJ|9TXWV|= CHWV|9PUB DAWB|9NRES TOS|0CLAN SIGN TSHEEJ|:YEEG|:LIS|;AUJ|:XYOOJ|:KOO|:HAWJ|:MUAS|:THOJ|;SAB|:PHAB|:KHAB|:HAM|:VAJ|:FAJ|:YAJ|:TSWB|:KWM|:VWJ|#KIRAT RAI SIGN ANUSVARA|2TONPI|2VISARGA|-LETTER A|4KA|5HA|4GA|5HA|4NGA|4CA|5HA|4JA|5HA|4NYA|4TTA|6HA|4DDA|6HA|4TA|5HA|4DA|5HA|4NA|4PA|5HA|4BA|5HA|4MA|4YA|4RA|4LA|4VA|4SA|5HA|4HA|-VOWEL SIGN AA|8I|8U|9E|8E|8AI|8O|8AU|-SIGN VIRAMA|2SAAT|2YUPI|-DANDA|.OUBLE DANDA|.IGIT ZERO|3ONE|3TWO|4HREE|3FOUR|4IVE|3SIX|4EVEN|3EIGHT|3NINE|#MEDEFAIDRIN CAPITAL LETTER M|>S|>V|>W|>ATIU|>Z|>KP|>P|>T|>G|>F|>I|>K|>A|>J|>E|>B|>C|>U|>YU|>L|>Q|>HP|>NY|>X|>D|>OE|>N|>R|>O|>AI|>Y|/SMALL LETTER M|<S|<V|<W|<ATIU|<Z|<KP|<P|<T|<G|<F|<I|<K|<A|<J|<E|<B|<C|<U|<YU|<L|<Q|<HP|<NY|<X|<D|<OE|<N|<R|<O|<AI|<Y|/DIGIT ZERO|5ONE|5TWO|6HREE|5FOUR|6IVE|5SIX|6EVEN|5EIGHT|5NINE|/NUMBER TEN|6ELEVEN|6TWELVE|7HIRTEEN|6FOURTEEN|7IFTEEN|6SIXTEEN|7EVENTEEN|6EIGHTEEN|6NINETEEN|/DIGIT ONE ALTERNATE FORM|5TWO ALTERNATE FORM|6HREE ALTERNATE FORM|/COMMA|/FULL STOP|/SYMBOL AIVA|/EXCLAMATION OH|#BERIA ERFE CAPITAL LETTER ARKAB|=BASIGNA|=DARBAI|=EH|=FITKO|=GOWAY|=HIRDEABO|=I|=DJAI|=KOBO|=LAKKO|=MERI|=NINI|=GNA|=NGAY|=OI|=PI|=ERIGO|B TAMURA|=SERI|>HEP|=TATASOUE|=UI|=WASSE|=AY|.SMALL LETTER ARKAB|;BASIGNA|;DARBAI|;EH|;FITKO|;GOWAY|;HIRDEABO|;I|;DJAI|;KOBO|;LAKKO|;MERI|;NINI|;GNA|;NGAY|;OI|;PI|;ERIGO|@ TAMURA|;SERI|<HEP|;TATASOUE|;UI|;WASSE|;AY|#MIAO LETTER PA|/BA|/YI PA|/PLA|/MA|0HA|/ARCHAIC MA|/FA|/VA|0FA|/TA|/DA|/YI TTA|3A|/TTA|/DDA|/NA|0HA|/YI NNA|/ARCHAIC NA|/NNA|1HA|/LA|0YA|0HA|1YA|/TLHA|/DLHA|/TLHYA|/DLHYA|/KA|/GA|/YI KA|/QA|0GA|/NGA|1HA|/ARCHAIC NGA|/HA|/XA|/GHA|1HA|/TSSA|/DZZA|/NYA|1HA|/TSHA|/DZHA|/YI TSHA|2DZHA|/REFORMED TSHA|/SHA|0SA|/ZHA|0SHA|/TSA|/DZA|/YI TSA|/SA|/ZA|0SA|0ZA|1SA|/ARCHAIC ZZA|/ZZYA|1SYA|/WA|/AH|/HHA|/BRI|/SYI|/DZYI|/TE|0SE|/RTE|(SIGN CONSONANT MODIFIER BAR|(LETTER NASALIZATION|(SIGN ASPIRATION|-REFORMED VOICING|6ASPIRATION|(VOWEL SIGN A|4A|4HH|4N|5G|3O|4O|3WO|4|3E|4N|5G|3OEY|3I|4A|5N|6G|4O|4E|4I|4U|4NG|3U|4A|5N|6G|4U|4EI|4NG|3Y|4I|3AE|5E|3ERR|3ROUNDED ERR|3ER|3ROUNDED ER|3AI|3EI|3AU|3OU|3N|4G|3UOG|3YUI|3OG|4ER|3VW|3IG|3EA|3IONG|3UI|(TONE RIGHT|-TOP RIGHT|-ABOVE|-BELOW|(LETTER TONE-2|43|44|45|46|47|48|/REFORMED TONE-1|=2|=4|=5|=6|=8|#TANGUT ITERATION MARK|#NUSHU ITERATION MARK|#OLD CHINESE HOOK MARK|/ITERATION MARK|#KHITAN SMALL SCRIPT FILLER|#VIETNAMESE ALTERNATE READING MARK CA|ENHAY|#CHINESE SMALL SIMPLIFIED ER|1TRADITIONAL ER|#YANGQIN SIGN SLOW ONE BEAT|5THREE HALF BEATS|6WO BEATS|#TANGUT COMPONENT-001|62|63|64|65|66|67|68|69|510|61|62|63|64|65|66|67|68|69|520|61|62|63|64|65|66|67|68|69|530|61|62|63|64|65|66|67|68|69|540|61|62|63|64|65|66|67|68|69|550|61|62|63|64|65|66|67|68|69|560|61|62|63|64|65|66|67|68|69|570|61|62|63|64|65|66|67|68|69|580|61|62|63|64|65|66|67|68|69|590|61|62|63|64|65|66|67|68|69|4100|61|62|63|64|65|66|67|68|69|510|61|62|63|64|65|66|67|68|69|520|61|62|63|64|65|66|67|68|69|530|61|62|63|64|65|66|67|68|69|540|61|62|63|64|65|66|67|68|69|550|61|62|63|64|65|66|67|68|69|560|61|62|63|64|65|66|67|68|69|570|61|62|63|64|65|66|67|68|69|580|61|62|63|64|65|66|67|68|69|590|61|62|63|64|65|66|67|68|69|4200|61|62|63|64|65|66|67|68|69|510|61|62|63|64|65|66|67|68|69|520|61|62|63|64|65|66|67|68|69|530|61|62|63|64|65|66|67|68|69|540|61|62|63|64|65|66|67|68|69|550|61|62|63|64|65|66|67|68|69|560|61|62|63|64|65|66|67|68|69|570|61|62|63|64|65|66|67|68|69|580|61|62|63|64|65|66|67|68|69|590|61|62|63|64|65|66|67|68|69|4300|61|62|63|64|65|66|67|68|69|510|61|62|63|64|65|66|67|68|69|520|61|62|63|64|65|66|67|68|69|530|61|62|63|64|65|66|67|68|69|540|61|62|63|64|65|66|67|68|69|550|61|62|63|64|65|66|67|68|69|560|61|62|63|64|65|66|67|68|69|570|61|62|63|64|65|66|67|68|69|580|61|62|63|64|65|66|67|68|69|590|61|62|63|64|65|66|67|68|69|4400|61|62|63|64|65|66|67|68|69|510|61|62|63|64|65|66|67|68|69|520|61|62|63|64|65|66|67|68|69|530|61|62|63|64|65|66|67|68|69|540|61|62|63|64|65|66|67|68|69|550|61|62|63|64|65|66|67|68|69|560|61|62|63|64|65|66|67|68|69|570|61|62|63|64|65|66|67|68|69|580|61|62|63|64|65|66|67|68|69|590|61|62|63|64|65|66|67|68|69|4500|61|62|63|64|65|66|67|68|69|510|61|62|63|64|65|66|67|68|69|520|61|62|63|64|65|66|67|68|69|530|61|62|63|64|65|66|67|68|69|540|61|62|63|64|65|66|67|68|69|550|61|62|63|64|65|66|67|68|69|560|61|62|63|64|65|66|67|68|69|570|61|62|63|64|65|66|67|68|69|580|61|62|63|64|65|66|67|68|69|590|61|62|63|64|65|66|67|68|69|4600|61|62|63|64|65|66|67|68|69|510|61|62|63|64|65|66|67|68|69|520|61|62|63|64|65|66|67|68|69|530|61|62|63|64|65|66|67|68|69|540|61|62|63|64|65|66|67|68|69|550|61|62|63|64|65|66|67|68|69|560|61|62|63|64|65|66|67|68|69|570|61|62|63|64|65|66|67|68|69|580|61|62|63|64|65|66|67|68|69|590|61|62|63|64|65|66|67|68|69|4700|61|62|63|64|65|66|67|68|69|510|61|62|63|64|65|66|67|68|69|520|61|62|63|64|65|66|67|68|69|530|61|62|63|64|65|66|67|68|69|540|61|62|63|64|65|66|67|68|69|550|61|62|63|64|65|66|67|68|69|560|61|62|63|64|65|66|67|68|69|570|61|62|63|64|65|66|67|68|69|580|61|62|63|64|65|66|67|68|69|590|61|62|63|64|65|66|67|68|69|4800|61|62|63|64|65|66|67|68|69|510|61|62|63|64|65|66|67|68|69|520|61|62|63|64|65|66|67|68|69|530|61|62|63|64|65|66|67|68|69|540|61|62|63|64|65|66|67|68|69|550|61|62|63|64|65|66|67|68|69|560|61|62|63|64|65|66|67|68|69|570|61|62|63|64|65|66|67|68|69|580|61|62|63|#JURCHEN RADICAL-01|42|43|44|45|46|47|48|49|310|41|42|43|44|45|46|47|48|49|320|41|42|43|44|45|46|47|48|49|330|41|42|43|44|45|46|47|48|49|340|41|42|43|44|45|46|47|48|49|350|41|#KATAKANA LETTER MINNAN TONE-2|?3|?4|?5|?7|?8|:NASALIZED TONE-1|I2|I3|I4|I5|I7|I8|3ARCHAIC E|#HIRAGANA LETTER ARCHAIC YE|$ENTAIGANA LETTER A-1|72|73|7WO|5I-1|72|73|74|5U-1|72|73|74|75|5E-2|73|74|75|76|5O-1|72|73|5KA-1|82|83|84|85|86|87|88|89|810|91|8KE|6I-1|82|83|84|85|86|87|88|6U-1|82|83|84|85|86|87|6E-1|82|83|84|85|86|6O-1|82|83|8KI|5SA-1|82|83|84|85|86|87|88|6I-1|82|83|84|85|86|6U-1|82|83|84|85|86|87|88|6E-1|82|83|84|85|6O-1|82|83|84|85|86|87|5TA-1|82|83|84|6I-1|82|83|84|85|86|87|6U-1|82|83|84|8TO|6E-1|82|83|84|85|86|87|88|89|6O-1|82|83|84|85|86|8RA|5NA-1|82|83|84|85|86|87|88|89|6I-1|82|83|84|85|86|87|8TE|6U-1|82|83|6E-1|82|83|84|85|86|8KO|6O-1|82|83|84|85|5HA-1|82|83|84|85|86|87|88|89|810|91|6I-1|82|83|84|85|86|87|6U-1|82|83|6E-1|82|83|84|85|86|87|6O-1|82|83|84|85|86|87|88|5MA-1|82|83|84|85|86|87|6I-1|82|83|84|85|86|87|6U-1|82|83|84|6E-1|82|8MA|6O-1|82|83|84|85|86|5YA-1|82|83|84|85|8YO|6U-1|82|83|84|6O-1|82|83|84|85|86|5RA-1|82|83|84|6I-1|82|83|84|85|86|87|6U-1|82|83|84|85|86|6E-1|82|83|84|6O-1|82|83|84|85|86|5WA-1|82|83|84|85|6I-1|82|83|84|85|6E-1|82|83|84|6O-1|82|83|84|85|86|87|5N-MU-MO-1|=2|$IRAGANA LETTER ARCHAIC WU|#KATAKANA LETTER ARCHAIC YI|<E|;WU|#HIRAGANA DIGRAPH KOTO|#KATAKANA DIGRAPH TOKI|6TE|4YORI|,LETTER ALTERNATE NE|=WI|#HIRAGANA LETTER SMALL KO|9WI|:E|:O|#KATAKANA LETTER SMALL KO|9WI|:E|:O|9N|9ARCHAIC YE|#DUPLOYAN LETTER H|3X|3P|3T|3F|3K|3L|3B|3D|3V|3G|3R|3P N|3D S|3F N|3K M|3R S|3TH|3SLOAN DH|3DH|3KK|3SLOAN J|3HL|3LH|3RH|3M|3N|3J|3S|3M N|3N M|3J M|3S J|3M WITH DOT|3N WITH DOT|3J WITH DOT|=S INSIDE AND ABOVE|3S WITH DOT|= BELOW|3M S|3N S|3J S|3S S|3M N S|3N M S|3J M S|3S J S|3J S WITH DOT|5N|6 S|3S T|6 R|5P|6 R|3T S|5R S|3W|4H|4 R|3S N|5M|3K R S|3G R S|3S K|6 R|3A|3SLOAN OW|3OA|4|3AOU|3I|3E|3IE|3SHORT I|3UI|3EE|3SLOAN EH|3ROMANIAN I|3SLOAN EE|3LONG I|3YE|3U|3EU|3XW|3U N|3LONG U|3ROMANIAN U|3UH|3SLOAN U|3OOH|4W|4U|3WA|4O|4I|4EI|4OW|3NASAL U|9O|9I|9A|3PERNIN AN|;M|3SLOAN EN|9AN|9ON|3VOCALIC M|,AFFIX LEFT HORIZONTAL SECANT|2MID HORIZONTAL SECANT|2RIGHT HORIZONTAL SECANT|2LOW VERTICAL SECANT|2MID VERTICAL SECANT|2HIGH VERTICAL SECANT|2ATTACHED SECANT|;LEFT-TO-RIGHT SECANT|;TANGENT|=IL|;E HOOK|;I HOOK|;TANGENT HOOK|2HIGH ACUTE|7TIGHT ACUTE|7GRAVE|7LONG GRAVE|7DOT|7CIRCLE|7LINE|7WAVE|7VERTICAL|2LOW ACUTE|6TIGHT ACUTE|6GRAVE|6LONG GRAVE|6DOT|6CIRCLE|6LINE|6WAVE|6VERTICAL|6ARROW|,SIGN O WITH CROSS|,THICK LETTER SELECTOR|,DOUBLE MARK|,PUNCTUATION CHINOOK FULL STOP|#SHORTHAND FORMAT LETTER OVERLAP|4CONTINUING OVERLAP|4DOWN STEP|4UP STEP|#UP-POINTING GO-KART|#RIGHT-POINTING GO-KART|#LEFT-POINTING STICK FIGURE|#RIGHT-POINTING STICK FIGURE|#DOWN-POINTING STICK FIGURE|#LOWER HORIZONTAL RULER SEGMENT|#RIGHT VERTICAL RULER SEGMENT|#LOWER RIGHT RULER SEGMENT|#ANTENNA|#HORIZONTAL RESISTOR SEGMENT|#VERTICAL RESISTOR SEGMENT|#LEFT THIRD INDUCTOR|#MIDDLE THIRD INDUCTOR|#RIGHT THIRD INDUCTOR|#LEFT-POINTING DIODE|#RIGHT-POINTING DIODE|#NPN TRANSISTOR|#PNP TRANSISTOR|#RECEPTACLE|#HORIZONTAL CAPACITOR|#VERTICAL CAPACITOR|#LOGIC GATE OR|.AND|.INVERTED INPUTS|7OUTPUT|.BUFFER|4 WITH INVERTED INPUT|#BOX DRAWINGS LIGHT HORIZONTAL AND UPPER RIGHT|ELOWER RIGHT|6TOP AND UPPER LEFT|6BOTTOM AND LOWER LEFT|0DOUBLE DIAGONAL UPPER RIGHT TO LOWER LEFT|FLEFT TO LOWER RIGHT|#SEPARATED BLOCK QUADRANT-1|<2|<12|<3|<13|<23|<123|<4|<14|<24|<124|<34|<134|<234|<1234|#UPPER LEFT TWELFTH CIRCLE|)CENTRE LEFT TWELFTH CIRCLE|0RIGHT TWELFTH CIRCLE|)RIGHT TWELFTH CIRCLE|)MIDDLE LEFT TWELFTH CIRCLE|)LEFT QUARTER CIRCLE|)RIGHT QUARTER CIRCLE|)MIDDLE RIGHT TWELFTH CIRCLE|#LOWER MIDDLE LEFT TWELFTH CIRCLE|)LEFT QUARTER CIRCLE|)RIGHT QUARTER CIRCLE|)MIDDLE RIGHT TWELFTH CIRCLE|)LEFT TWELFTH CIRCLE|)CENTRE LEFT TWELFTH CIRCLE|0RIGHT TWELFTH CIRCLE|)RIGHT TWELFTH CIRCLE|#SPARSE HORIZONTAL FILL|*VERTICAL FILL|#ORTHOGONAL CROSSHATCH FILL|#DIAGONAL CROSSHATCH FILL|$ENSE VERTICAL FILL|)HORIZONTAL FILL|#SPECKLE FILL FRAME-1|62|#LEFT-FACING BASSINET|#RIGHT-FACING BASSINET|#FLYING SAUCER WITH BEAMS|5OUT BEAMS|#ALIEN MONSTER OPEN JAWS|1CLOSED JAWS|)SQUID OPEN TENTACLES|/CLOSED TENTACLES|)CRAB STEPPING RIGHT|7LEFT|)SPIDER CROUCHING|0SPREAD|)MONSTER STEP-1|62|#LEFT-POINTING ROCKET SHIP|#UP-POINTING ROCKET SHIP|#RIGHT-POINTING ROCKET SHIP|#DOWN-POINTING ROCKET SHIP|#TOP HALF LEFT-FACING ROBOT|,FORWARD-FACING ROBOT|,RIGHT-FACING ROBOT|#BOTTOM HALF LEFT-FACING ROBOT|/FORWARD-FACING ROBOT|/RIGHT-FACING ROBOT|#LEFT-POINTING ATOMIC BOMB|#UP-POINTING ATOMIC BOMB|#RIGHT-POINTING ATOMIC BOMB|#DOWN-POINTING ATOMIC BOMB|#MUSHROOM CLOUD|#LEFT-POINTING RIFLE|#UP-POINTING RIFLE|#RIGHT-POINTING RIFLE|#DOWN-POINTING RIFLE|#EIGHT RAYS INWARD|.OUTWARD|#BLACK LARGE CIRCLE MINUS LEFT QUARTER SECTION|<UPPER QUARTER SECTION|<RIGHT QUARTER SECTION|<LOWER QUARTER SECTION|)NEUTRAL FACE|#LEFT-FACING SNAKE HEAD WITH OPEN MOUTH|#UP-FACING SNAKE HEAD WITH OPEN MOUTH|#RIGHT-FACING SNAKE HEAD WITH OPEN MOUTH|#DOWN-FACING SNAKE HEAD WITH OPEN MOUTH|#LEFT-FACING SNAKE HEAD WITH CLOSED MOUTH|#UP-FACING SNAKE HEAD WITH CLOSED MOUTH|#RIGHT-FACING SNAKE HEAD WITH CLOSED MOUTH|#DOWN-FACING SNAKE HEAD WITH CLOSED MOUTH|#LEFT-POINTING ENERGY WAVE|#UP-POINTING ENERGY WAVE|#RIGHT-POINTING ENERGY WAVE|#DOWN-POINTING ENERGY WAVE|#SQUARE SPIRAL FROM TOP LEFT|:RIGHT|6BOTTOM RIGHT|=LEFT|$TRIPED LEFT-POINTING TRIANGLE|+UP-POINTING TRIANGLE|+RIGHT-POINTING TRIANGLE|+DOWN-POINTING TRIANGLE|#VERTICAL LADDER|#HORIZONTAL LADDER|#WHITE LOWER LEFT POINTER|/RIGHT POINTER|#TWO RINGS ALIGNED HORIZONTALLY|#SQUARE FOUR CORNER SALTIRES|6DIAGONALS|6BLACK TRIANGLES|*APERTURE|#INVERSE BLACK DIAMOND|#LEFT AND UPPER ONE EIGHTH BLOCK CONTAINING BLACK SMALL SQUARE|#INVERSE BLACK SMALL SQUARE|#VERTICAL LINE WITH FOUR TICK MARKS|#HORIZONTAL LINE WITH FOUR TICK MARKS|#LEFT-FACING FISH|#RIGHT-FACING FISH|#LEFT-FACING FISH WITH OPEN MOUTH|#RIGHT-FACING FISH WITH OPEN MOUTH|#FLAPPING BIRD|#LEFT-POINTING RACING CAR|#UP-POINTING RACING CAR|#RIGHT-POINTING RACING CAR|#DOWN-POINTING RACING CAR|#HORIZONTAL RACING CAR|#VERTICAL RACING CAR|,GO-KART|#LEFT-POINTING TANK|#RIGHT-POINTING TANK|#LEFT-POINTING ROCKET BOOSTER|#RIGHT-POINTING ROCKET BOOSTER|#LEFT-POINTING ROLLER COASTER CAR|#RIGHT-POINTING ROLLER COASTER CAR|#LEFT HALF FLYING SAUCER|#RIGHT HALF FLYING SAUCER|#UPPER LEFT QUADRANT FACE WITH OPEN EYES|)RIGHT QUADRANT FACE WITH OPEN EYES|)LEFT QUADRANT FACE WITH CLOSED EYES|)RIGHT QUADRANT FACE WITH CLOSED EYES|#LOWER LEFT QUADRANT SMILING FACE|)RIGHT QUADRANT SMILING FACE|)LEFT QUADRANT NEUTRAL FACE|)RIGHT QUADRANT NEUTRAL FACE|)LEFT QUADRANT FACE WITH OPEN MOUTH|)RIGHT QUADRANT FACE WITH OPEN MOUTH|)LEFT QUADRANT FROWNING FACE|)RIGHT QUADRANT FROWNING FACE|#UPPER LEFT QUADRANT TELEVISION|)RIGHT QUADRANT TELEVISION|#LOWER LEFT QUADRANT TELEVISION|)RIGHT QUADRANT TELEVISION|#UPPER LEFT QUADRANT MICROCOMPUTER|)RIGHT QUADRANT MICROCOMPUTER|#LOWER LEFT QUADRANT MICROCOMPUTER|)RIGHT QUADRANT MICROCOMPUTER|#UPPER LEFT QUADRANT CHESS KING|)RIGHT QUADRANT CHESS KING|#LOWER LEFT QUADRANT CHESS KING|)RIGHT QUADRANT CHESS KING|#UPPER LEFT QUADRANT CHESS QUEEN|)RIGHT QUADRANT CHESS QUEEN|#LOWER LEFT QUADRANT CHESS QUEEN|)RIGHT QUADRANT CHESS QUEEN|#UPPER LEFT QUADRANT CHESS ROOK|)RIGHT QUADRANT CHESS ROOK|#LOWER LEFT QUADRANT CHESS ROOK|)RIGHT QUADRANT CHESS ROOK|#UPPER LEFT QUADRANT CHESS BISHOP|)RIGHT QUADRANT CHESS BISHOP|#LOWER LEFT QUADRANT CHESS BISHOP|)RIGHT QUADRANT CHESS BISHOP|#UPPER LEFT QUADRANT CHESS KNIGHT|)RIGHT QUADRANT CHESS KNIGHT|#LOWER LEFT QUADRANT CHESS KNIGHT|)RIGHT QUADRANT CHESS KNIGHT|#UPPER LEFT QUADRANT CHESS PAWN|)RIGHT QUADRANT CHESS PAWN|#LOWER LEFT QUADRANT CHESS PAWN|)RIGHT QUADRANT CHESS PAWN|#UPPER LEFT QUADRANT STANDING KNIGHT|)RIGHT QUADRANT STANDING KNIGHT|#LOWER LEFT QUADRANT STANDING KNIGHT|)RIGHT QUADRANT STANDING KNIGHT|#OUTLINED LATIN CAPITAL LETTER A|AB|AC|AD|AE|AF|AG|AH|AI|AJ|AK|AL|AM|AN|AO|AP|AQ|AR|AS|AT|AU|AV|AW|AX|AY|AZ|,DIGIT ZERO|2ONE|2TWO|3HREE|2FOUR|3IVE|2SIX|3EVEN|2EIGHT|2NINE|#SNAKE SYMBOL|#FLYING SAUCER SYMBOL|#NOSE SYMBOL|#BLOCK OCTANT-3|023|0123|04|014|124|034|0134|0234|05|015|025|0125|135|0235|01235|045|0145|0245|01245|0345|01345|02345|012345|06|016|026|0126|036|0136|0236|01236|146|0246|01246|0346|01346|02346|012346|056|0156|0256|01256|0356|01356|02356|012356|0456|01456|02456|012456|03456|013456|023456|017|027|0127|037|0137|0237|01237|047|0147|0247|01247|0347|01347|02347|012347|157|0257|01257|0357|02357|012357|0457|01457|12457|03457|013457|023457|067|0167|0267|01267|0367|01367|02367|012367|0467|01467|02467|012467|03467|013467|023467|0123467|0567|01567|02567|012567|03567|013567|023567|0123567|04567|014567|024567|0124567|034567|0134567|0234567|01234567|18|028|0128|038|0138|0238|01238|048|0148|0248|01248|0348|01348|02348|012348|058|0158|0258|01258|0358|01358|02358|012358|0458|01458|02458|012458|03458|013458|023458|0123458|168|0268|01268|0368|02368|012368|0468|01468|12468|03468|013468|023468|0568|01568|02568|012568|03568|013568|023568|0123568|04568|014568|024568|0124568|034568|0134568|0234568|01234568|178|0278|01278|0378|01378|02378|012378|0478|01478|02478|012478|03478|013478|023478|0123478|0578|01578|02578|012578|03578|013578|023578|0123578|04578|014578|024578|0124578|034578|0134578|0234578|01234578|0678|01678|02678|012678|03678|013678|023678|0123678|04678|014678|024678|0124678|034678|0134678|0234678|01234678|15678|025678|0125678|035678|0235678|01235678|045678|0145678|1245678|1345678|02345678|#TOP HALF STANDING PERSON|#BOTTOM HALF STANDING PERSON|#TOP HALF RIGHT-FACING RUNNER FRAME-1|#BOTTOM HALF RIGHT-FACING RUNNER FRAME-1|#TOP HALF RIGHT-FACING RUNNER FRAME-2|#BOTTOM HALF RIGHT-FACING RUNNER FRAME-2|#TOP HALF LEFT-FACING RUNNER FRAME-1|#BOTTOM HALF LEFT-FACING RUNNER FRAME-1|#TOP HALF LEFT-FACING RUNNER FRAME-2|#BOTTOM HALF LEFT-FACING RUNNER FRAME-2|#TOP HALF FORWARD-FACING RUNNER|#BOTTOM HALF FORWARD-FACING RUNNER FRAME-1|K2|K3|K4|#MOON LANDER|#TOP HALF FLAILING ROBOT FRAME-1|A2|#DOWN-POINTING AIRPLANE|#LEFT-POINTING AIRPLANE|#SMALL UP-POINTING AIRPLANE|#UP-POINTING FROG|#DOWN-POINTING FROG|#EXPLOSION FRAME-1|32|33|#RIGHT HALF AND LEFT HALF WHITE CIRCLE|#LOWER HALF AND UPPER HALF WHITE CIRCLE|#EXPLOSION AT HORIZON|#UPPER HALF HEAVY WHITE SQUARE|#LOWER HALF HEAVY WHITE SQUARE|#HEAVY WHITE SQUARE CONTAINING BLACK VERY SMALL SQUARE|#WHITE VERTICAL RECTANGLE WITH HORIZONTAL BAR|#TOP LEFT BLACK LEFT-POINTING SMALL TRIANGLE|#FUNNEL|#BOX DRAWINGS DOUBLE DIAGONAL LOWER LEFT TO MIDDLE CENTRE TO LOWER RIGHT|@UPPER LEFT TO MIDDLE CENTRE TO UPPER RIGHT|#LEFT HALF WHITE ELLIPSE|#RIGHT HALF WHITE ELLIPSE|#LEFT HALF TRIPLE DASH HORIZONTAL|#RIGHT HALF TRIPLE DASH HORIZONTAL|#HORIZONTAL LINE WITH TICK MARK|#LEFT HALF HORIZONTAL LINE WITH THREE TICK MARKS|#RIGHT HALF HORIZONTAL LINE WITH THREE TICK MARKS|#HORIZONTAL LINE WITH THREE TICK MARKS|#LOWER HALF VERTICAL LINE WITH THREE TICK MARKS|#UPPER HALF VERTICAL LINE WITH THREE TICK MARKS|#VERTICAL LINE WITH THREE TICK MARKS|#BOX DRAWINGS LIGHT VERTICAL AND TOP RIGHT|CBOTTOM RIGHT|CTOP LEFT|CBOTTOM LEFT|#LARGE TYPE PIECE UPPER LEFT ARC|?CORNER|:TERMINAL|:LEFT CROTCH|4LEFT ARM|4CROSSBAR|< WITH LOWER STEM|4UPPER HALF VERTEX OF M|4DIAGONAL LOWER LEFT|4SHORT UPPER TERMINAL|4UPPER RIGHT ARC|4RIGHT ARM|4UPPER RIGHT CROTCH|AORNER|4STEM WITH RIGHT CROSSBAR|8|4DIAGONAL UPPER RIGHT AND LOWER RIGHT|H|=LOWER RIGHT|4SHORT LOWER TERMINAL|4LOWER LEFT AND UPPER LEFT ARC|4CENTRE OF K|4LOWER HALF VERTEX OF M|4UPPER HALF VERTEX OF W|4CENTRE OF X|>Y|>Z WITH CROSSBAR|4RAISED UPPER LEFT ARC|4STEM WITH LEFT CROSSBAR|4LOWER RIGHT AND UPPER RIGHT ARC|4DIAGONAL UPPER LEFT AND LOWER LEFT|4STEM WITH LEFT JOINT|>CROSSBAR|4DIAGONAL UPPER LEFT|4LOWER TERMINAL|:LEFT CORNER|?ARC|?CROTCH|4CROSSBAR WITH UPPER STEM|4VERTEX OF V|4LOWER HALF VERTEX OF W|:RIGHT ARC|@CORNER|@ARC WITH TAIL|@CROTCH|4STEM-45|92345|94|934|9234|91234|93|923|:|912|#SEPARATED BLOCK SEXTANT-1|;2|;12|;3|;13|;23|;123|;4|;14|;24|;124|;34|;134|;234|;1234|;5|;15|;25|;125|;35|;135|;235|;1235|;45|;145|;245|;1245|;345|;1345|;2345|;12345|;6|;16|;26|;126|;36|;136|;236|;1236|;46|;146|;246|;1246|;346|;1346|;2346|;12346|;56|;156|;256|;1256|;356|;1356|;2356|;12356|;456|;1456|;2456|;12456|;3456|;13456|;23456|;123456|#UPPER LEFT ONE SIXTEENTH BLOCK|)CENTRE LEFT ONE SIXTEENTH BLOCK|0RIGHT ONE SIXTEENTH BLOCK|)RIGHT ONE SIXTEENTH BLOCK|)MIDDLE LEFT ONE SIXTEENTH BLOCK|0CENTRE LEFT ONE SIXTEENTH BLOCK|7RIGHT ONE SIXTEENTH BLOCK|0RIGHT ONE SIXTEENTH BLOCK|#LOWER MIDDLE LEFT ONE SIXTEENTH BLOCK|0CENTRE LEFT ONE SIXTEENTH BLOCK|7RIGHT ONE SIXTEENTH BLOCK|0RIGHT ONE SIXTEENTH BLOCK|)LEFT ONE SIXTEENTH BLOCK|)CENTRE LEFT ONE SIXTEENTH BLOCK|0RIGHT ONE SIXTEENTH BLOCK|)RIGHT ONE SIXTEENTH BLOCK|#RIGHT HALF LOWER ONE QUARTER BLOCK|)THREE QUARTERS LOWER ONE QUARTER BLOCK|#LEFT THREE QUARTERS LOWER ONE QUARTER BLOCK|(HALF LOWER ONE QUARTER BLOCK|$OWER HALF LEFT ONE QUARTER BLOCK|)THREE QUARTERS LEFT ONE QUARTER BLOCK|#UPPER THREE QUARTERS LEFT ONE QUARTER BLOCK|)HALF LEFT ONE QUARTER BLOCK|#LEFT HALF UPPER ONE QUARTER BLOCK|(THREE QUARTERS UPPER ONE QUARTER BLOCK|#RIGHT THREE QUARTERS UPPER ONE QUARTER BLOCK|)HALF UPPER ONE QUARTER BLOCK|#UPPER HALF RIGHT ONE QUARTER BLOCK|)THREE QUARTERS RIGHT ONE QUARTER BLOCK|#LOWER THREE QUARTERS RIGHT ONE QUARTER BLOCK|)HALF RIGHT ONE QUARTER BLOCK|#HORIZONTAL ZIGZAG LINE|#KEYHOLE|#OLD PERSONAL COMPUTER WITH MONITOR IN PORTRAIT ORIENTATION|#BLACK RIGHT TRIANGLE CARET|#FRAGILE SYMBOL|#OFFICE BUILDING SYMBOL|#TREE SYMBOL|#APPLE SYMBOL|#CHERRY SYMBOL|#STRAWBERRY SYMBOL|#HEBE|#IRIS|#FLORA|#METIS|#PARTHENOPE|#VICTORIA|#EGERIA|#IRENE|#EUNOMIA|#PSYCHE|#THETIS|#MELPOMENE|#FORTUNA|#ASTRONOMICAL SYMBOL FOR ASTEROID PROSERPINA|#BELLONA|#AMPHITRITE|#LEUKOTHEA|#ALCHEMICAL SYMBOL FOR OIL INVERTED|9MOON-JUPITER|9SALT OF TARTAR|#SQUARE ROOT OF SQUARE ROOT|= OF SQUARE ROOT|L OF SQUARE ROOT|#GEOMANTIC FIGURE POPULUS|4TRISTITIA|4ALBUS|4FORTUNA MAJOR|4RUBEUS|4ACQUISITIO|4CONJUNCTIO|5APUT DRACONIS|4LAETITIA|4CARCER|4AMISSIO|4PUELLA|4FORTUNA MINOR|4PUER|4CAUDA DRACONIS|4VIA|#MEDIUM SMALL WHITE CIRCLE WITH HORIZONTAL BAR|#LEIBNIZIAN DIVISION SIGN|.MULTIPLICATION SIGN|<-DIVISION SIGN|.FRACTION REDUCTION SIGN-1|F2|#SECTOR WITH CHORD|/DOUBLE ARC|/CHORD AND DOTTED ARC|#MEASURED ANGLE WITH DOUBLE ARC|7CONCAVE ARC|7DOUBLE CONCAVE ARC|#ANGLE OPENING UP|#HYPERBOLA|#ZNAMENNY COMBINING MARK GORAZDO NIZKO S KRYZHEM ON LEFT|;NIZKO S KRYZHEM ON LEFT|;TSATA ON LEFT|;GORAZDO NIZKO ON LEFT|;NIZKO ON LEFT|;SREDNE ON LEFT|;MALO POVYSHE ON LEFT|;POVYSHE ON LEFT|;VYSOKO ON LEFT|;MALO POVYSHE S KHOKHLOM ON LEFT|;POVYSHE S KHOKHLOM ON LEFT|;VYSOKO S KHOKHLOM ON LEFT|;GORAZDO NIZKO S KRYZHEM ON RIGHT|;NIZKO S KRYZHEM ON RIGHT|;TSATA ON RIGHT|;GORAZDO NIZKO ON RIGHT|;NIZKO ON RIGHT|;SREDNE ON RIGHT|;MALO POVYSHE ON RIGHT|;POVYSHE ON RIGHT|;VYSOKO ON RIGHT|;MALO POVYSHE S KHOKHLOM ON RIGHT|;POVYSHE S KHOKHLOM ON RIGHT|;VYSOKO S KHOKHLOM ON RIGHT|;TSATA S KRYZHEM|;MALO POVYSHE S KRYZHEM|;STRANNO MALO POVYSHE|;POVYSHE S KRYZHEM|DTRANNO|;VYSOKO S KRYZHEM|;MALO POVYSHE STRANNO|;GORAZDO VYSOKO|;ZELO|;ON|;RAVNO|;TIKHAYA|;BORZAYA|;UDARKA|;PODVERTKA|;LOMKA|;KUPNAYA|<ACHKA|;ZEVOK|;SKOBA|;RAZSEKA|;KRYZH ON LEFT|6TONAL RANGE MARK MRACHNO|GSVETLO|GTRESVETLO|6MARK ZADERZHKA|;DEMESTVENNY ZADERZHKA|;OTSECHKA|;PODCHASHIE|E WITH VERTICAL STROKE|;CHASHKA|B POLNAYA|;OBLACHKO|;SOROCHYA NOZHKA|;TOCHKA|;DVOETOCHIE|6ATTACHING VERTICAL OMET|6MARK CURVED OMET|;KRYZH|6LOWER TONAL RANGE INDICATOR|,PRIZNAK MODIFIER LEVEL-2|C3|=DIRECTION FLIP|=KRYZH|=ROG|,NEUME KRYUK|7 TIKHY|2PARAKLIT|2DVA V CHELNU|2KLYUCH|2ZANOZHEK|2STOPITSA|: S OCHKOM|2PEREVODKA|; NEPOSTOYANNAYA|2STOPITSA WITH SOROCHYA NOZHKA|2CHELYUSTKA|2PALKA|2ZAPYATAYA|2GOLUBCHIK BORZY|<TIKHY|<MRACHNY|<SVETLY|<TRESVETLY|2VRAKHIYA PROSTAYA|;MRACHNAYA|;SVETLAYA|;TRESVETLAYA|;KLYUCHEVAYA PROSTAYA|GMRACHNAYA|GSVETLAYA|GTRESVETLAYA|2DOUBLE ZAPYATAYA|2REVERSED CHELYUSTKA|2DERBITSA|2KHAMILO|2CHASHKA|2PODCHASHIE|2SKAMEYTSA MRACHNAYA|<SVETLAYA|<TRESVETLAYA|=IKHAYA|2DEMESTVENNY KLYUCH|2SKAMEYTSA KLYUCHEVAYA SVETLAYA|CNEPOSTOYANNAYA|CVAYA TIKHAYA|<DVOECHELNAYA PROSTAYA|ISVETLAYA|INEPOSTOYANNAYA|IKLYUCHEVAYA|3LOZHITIE|; S ZAPYATOY|<ZAKRYTOE|<S KRYZHEM|2KRYZH|2ROG|2FITA|2KOBYLA|2ZMEYTSA|2STATYA|8 S ZAPYATOY|;KRYZHEM|;ZAPYATOY I KRYZHEM|;KRYZHEM I ZAPYATOY|9ZAKRYTAYA|B S ZAPYATOY|9S ROGOM|;DVUMYA ZAPYATYMI|;ZAPYATOY I PODCHASHIEM|2POLKULIZMY|2STATYA NEPOSTOYANNAYA|4RELA PROSTAYA|9MRACHNOTIKHAYA|9KRYZHEVAYA|9POLUPOVODNAYA|;VODNAYA|9NEPOSTOYANNAYA|9KLYUCHEPOVODNAYA|@NEPOSTOYANNAYA|9TIKHAYA PUTNAYA|9DVOECHELNAYA|BOKRYZHEVAYA|CPOVODNAYA|BAYA KLYUCHEVAYA|BOPOVODNAYA KLYUCHEVAYA|9GROMNAYA WITH SINGLE ZAPYATAYA|=OPOVODNAYA WITH SINGLE ZAPYATAYA|=NAYA|=OPOVODNAYA|G WITH DOUBLE ZAPYATAYA|>KRYZHEVAYA|H POVODNAYA|2MECHIK|8 POVODNY|9KLYUCHEVOY|@POVODNY|@NEPOSTOYANNY|2STRELA TRYASOGLASNAYA|?POVODNAYA|?STRELNAYA|2OSOKA|7 SVETLAYA|8TRESVETLAYA|8KRYUKOVAYA SVETLAYA|9LYUCHEVAYA SVETLAYA|DNEPOSTOYANNAYA|2STRELA KRYUKOVAYA|C POVODNAYA|DGROMNAYA WITH SINGLE ZAPYATAYA|HOPOVODNAYA WITH SINGLE ZAPYATAYA|HNAYA|HOPOVODNAYA|R WITH DOUBLE ZAPYATAYA|IKRYZHEVAYA|S POVODNAYA|DTRYASKA|2KUFISMA|2OBLAKO|2DUDA|2NEMKA|2PAUK|#BYZANTINE MUSICAL SYMBOL PSILI|<DASEIA|<PERISPOMENI|<OXEIA EKFONITIKON|BDIPLI|<VAREIA EKFONITIKON|CDIPLI|<KATHISTI|<SYRMATIKI|<PARAKLITIKI|<YPOKRISIS|E DIPLI|<KREMASTI|<APESO EKFONITIKON|<EXO EKFONITIKON|<TELEIA|<KENTIMATA|<APOSTROFOS|F DIPLI|<SYNEVMA|<THITA|<OLIGON ARCHAION|<GORGON ARCHAION|<PSILON|<CHAMILON|<VATHY|<ISON ARCHAION|<KENTIMA ARCHAION|CTA ARCHAION|<SAXIMATA|<PARICHON|<STAVROS APODEXIA|<OXEIAI ARCHAION|<VAREIAI ARCHAION|<APODERMA ARCHAION|?THEMA|<KLASMA|<REVMA|<PIASMA ARCHAION|<TINAGMA|<ANATRICHISMA|<SEISMA|=YNAGMA ARCHAION|DMETA STAVROU|<OYRANISMA ARCHAION|<THEMA|<LEMOI|<DYO|<TRIA|=ESSERA|<KRATIMATA|<APESO EXO NEO|<FTHORA ARCHAION|<IMIFTHORA|<TROMIKON ARCHAION|<KATAVA TROMIKON|<PELASTON|=SIFISTON|<KONTEVMA|<CHOREVMA ARCHAION|<RAPISMA|<PARAKALESMA ARCHAION|ALITIKI ARCHAION|<ICHADIN|<NANA|<PETASMA|<KONTEVMA ALLO|<TROMIKON ALLO|<STRAGGISMATA|<GRONTHISMATA|<ISON NEO|<OLIGON NEO|=XEIA NEO|<PETASTI|<KOUFISMA|<PETASTOKOUFISMA|<KRATIMOKOUFISMA|<PELASTON NEO|<KENTIMATA NEO ANO|C NEO ANO|<YPSILI|<APOSTROFOS NEO|EI SYNDESMOS NEO|<YPORROI|<KRATIMOYPORROON|<ELAFRON|<CHAMILI|<MIKRON ISON|<VAREIA NEO|<PIASMA NEO|=SIFISTON NEO|<OMALON|<ANTIKENOMA|<LYGISMA|<PARAKLITIKI NEO|AALESMA NEO|<ETERON PARAKALESMA|<KYLISMA|<ANTIKENOKYLISMA|<TROMIKON NEO|<EKSTREPTON|<SYNAGMA NEO|>RMA|<CHOREVMA NEO|<EPEGERMA|<SEISMA NEO|<XIRON KLASMA|<TROMIKOPSIFISTON|<PSIFISTOLYGISMA|<TROMIKOLYGISMA|CPARAKALESMA|<PSIFISTOPARAKALESMA|<TROMIKOSYNAGMA|<PSIFISTOSYNAGMA|<GORGOSYNTHETON|<ARGOSYNTHETON|<ETERON ARGOSYNTHETON|<OYRANISMA NEO|<THEMATISMOS ESO|IXO|A APLOUN|?S KAI APOTHES|<KATAVASMA|<ENDOFONON|<YFEN KATO|AANO|<STAVROS|<KLASMA ANO|<DIPLI ARCHAION|<KRATIMA ARCHAION|ELLO|DNEO|<APODERMA NEO|>LI|<DIPLI|<TRIPLI|=ETRAPLI|<KORONIS|<LEIMMA ENOS CHRONOU|CDYO CHRONON|CTRION CHRONON|DESSARON CHRONON|CIMISEOS CHRONOU|<GORGON NEO ANO|CPARESTIGMENON ARISTERA|QDEXIA|<DIGORGON|D PARESTIGMENON ARISTERA KATO|\\ANO|SDEXIA|<TRIGORGON|<ARGON|<IMIDIARGON|<DIARGON|<AGOGI POLI ARGI|BARGOTERI|EI|BMETRIA|DSI|BGORGI|FOTERI|BPOLI GORGI|<MARTYRIA PROTOS ICHOS|EALLI PROTOS ICHOS|EDEYTEROS ICHOS|EALLI DEYTEROS ICHOS|ETRITOS ICHOS|HFONIAS|FETARTOS ICHOS|NLEGETOS ICHOS|ELEGETOS ICHOS|EPLAGIOS ICHOS|<ISAKIA TELOUS ICHIMATOS|<APOSTROFOI TELOUS ICHIMATOS|<FANEROSIS TETRAFONIAS|FMONOFONIAS|FDIFONIAS|<MARTYRIA VARYS ICHOS|EPROTOVARYS ICHOS|FLAGIOS TETARTOS ICHOS|<GORTHMIKON N APLOUN|IDIPLOUN|<ENARXIS KAI FTHORA VOU|<IMIFONON|@THORON|<FTHORA ARCHAION DEYTEROU ICHOU|CDIATONIKI PA|MNANA|CNAOS ICHOS|CDIATONIKI DI|CSKLIRON DIATONON DI|CDIATONIKI KE|MZO|MNI KATO|PANO|CMALAKON CHROMA DIFONIAS|RMONOFONIAS|=HTORA SKLIRON CHROMA VASIS|=THORA SKLIRON CHROMA SYNAFI|CNENANO|<CHROA ZYGOS|BKLITON|BSPATHI|<FTHORA I YFESIS TETARTIMORION|CENARMONIOS ANTIFONIA|<YFESIS TRITIMORION|<DIESIS TRITIMORION|DETARTIMORION|CAPLI DYO DODEKATA|CMONOGRAMMOS TESSERA DODEKATA|CDIGRAMMOS EX DODEKATA|CTRIGRAMMOS OKTO DODEKATA|<YFESIS APLI DYO DODEKATA|CMONOGRAMMOS TESSERA DODEKATA|CDIGRAMMOS EX DODEKATA|CTRIGRAMMOS OKTO DODEKATA|<GENIKI DIESIS|CYFESIS|<DIASTOLI APLI MIKRI|KEGALI|EDIPLI|ETHESEOS|<SIMANSIS THESEOS|L DISIMOU|MTRISIMOU|NETRASIMOU|EARSEOS|K DISIMOU|LTRISIMOU|METRASIMOU|<DIGRAMMA GG|>FTOGGOS OU|<STIGMA|<ARKTIKO PA|DVOU|DGA|DDI|DKE|DZO|DNI|<KENTIMATA NEO MESO|C NEO MESO|CTA NEO KATO|C NEO KATO|=LASMA KATO|<GORGON NEO KATO|#MUSICAL SYMBOL SINGLE BARLINE|2DOUBLE BARLINE|2FINAL BARLINE|2REVERSE FINAL BARLINE|2DASHED BARLINE|2SHORT BARLINE|2LEFT REPEAT SIGN|2RIGHT REPEAT SIGN|3EPEAT DOTS|2DAL SEGNO|4 CAPO|2SEGNO|2CODA|2REPEATED FIGURE-1|B2|B3|2FERMATA|9 BELOW|2BREATH MARK|2CAESURA|2BRACE|6KET|2ONE-LINE STAFF|2TWO-LINE STAFF|3HREE-LINE STAFF|2FOUR-LINE STAFF|3IVE-LINE STAFF|2SIX-LINE STAFF|6STRING FRETBOARD|2FOUR-STRING FRETBOARD|2G CLEF|8 OTTAVA ALTA|@BASSA|2C CLEF|2F CLEF|8 OTTAVA ALTA|@BASSA|2DRUM CLEF-1|<2|2COMBINING STRESS|<UNSTRESS|2MULTIPLE MEASURE REST|2DOUBLE SHARP|9FLAT|2FLAT UP|7DOWN|2NATURAL UP|:DOWN|2SHARP UP|8DOWN|2QUARTER TONE SHARP|?FLAT|2COMMON TIME|3UT TIME|2OTTAVA ALTA|9BASSA|2QUINDICESIMA ALTA|?BASSA|2MULTI REST|2WHOLE REST|2HALF REST|2QUARTER REST|2EIGHTH REST|2SIXTEENTH REST|2THIRTY-SECOND REST|2SIXTY-FOURTH REST|2ONE HUNDRED TWENTY-EIGHTH REST|2X NOTEHEAD|2PLUS NOTEHEAD|2CIRCLE X NOTEHEAD|2SQUARE NOTEHEAD WHITE|BBLACK|2TRIANGLE NOTEHEAD UP WHITE|GBLACK|DLEFT WHITE|IBLACK|DRIGHT WHITE|JBLACK|DDOWN WHITE|IBLACK|DUP RIGHT WHITE|MBLACK|2MOON NOTEHEAD WHITE|@BLACK|2TRIANGLE-ROUND NOTEHEAD DOWN WHITE|OBLACK|2PARENTHESIS NOTEHEAD|2VOID NOTEHEAD|2NOTEHEAD BLACK|3ULL NOTEHEAD|2CLUSTER NOTEHEAD WHITE|CBLACK|2BREVE|2WHOLE NOTE|2HALF NOTE|2QUARTER NOTE|2EIGHTH NOTE|2SIXTEENTH NOTE|2THIRTY-SECOND NOTE|2SIXTY-FOURTH NOTE|2ONE HUNDRED TWENTY-EIGHTH NOTE|2COMBINING STEM|=PRECHGESANG STEM|<TREMOLO-1|D2|D3|2FINGERED TREMOLO-1|C2|C3|2COMBINING AUGMENTATION DOT|<FLAG-1|A2|A3|A4|A5|2BEGIN BEAM|2END BEAM|2BEGIN TIE|2END TIE|2BEGIN SLUR|2END SLUR|2BEGIN PHRASE|2END PHRASE|2COMBINING ACCENT|<STACCATO|<TENUTO|<STACCATISSIMO|<MARCATO|C-STACCATO|<ACCENT-STACCATO|<LOURE|2ARPEGGIATO UP|=DOWN|2COMBINING DOIT|<RIP|<FLIP|<SMEAR|<BEND|<DOUBLE TONGUE|<TRIPLE TONGUE|2RINFORZANDO|2SUBITO|2Z|2PIANO|2MEZZO|2FORTE|2CRESCENDO|2DECRESCENDO|2GRACE NOTE SLASH|=NO SLASH|2TR|3URN|2INVERTED TURN|2TURN SLASH|7UP|2ORNAMENT STROKE-1|B2|B3|B4|B5|B6|B7|B8|B9|B10|C1|2HAUPTSTIMME|2NEBENSTIMME|2END OF STIMME|2DEGREE SLASH|2COMBINING DOWN BOW|<UP BOW|<HARMONIC|<SNAP PIZZICATO|2PEDAL MARK|8UP MARK|2HALF PEDAL MARK|2GLISSANDO UP|<DOWN|2WITH FINGERNAILS|2DAMP|6 ALL|2MAXIMA|2LONGA|2BREVIS|2SEMIBREVIS WHITE|=BLACK|2MINIMA|8 BLACK|2SEMIMINIMA WHITE|=BLACK|2FUSA WHITE|7BLACK|2LONGA PERFECTA REST|8IMPERFECTA REST|2BREVIS REST|2SEMIBREVIS REST|2MINIMA REST|2SEMIMINIMA REST|2TEMPUS PERFECTUM CUM PROLATIONE PERFECTA|RIMPERFECTA|RPERFECTA DIMINUTION-1|9IMPERFECTUM CUM PROLATIONE PERFECTA|TIMPERFECTA|^ DIMINUTION-1|j2|j3|2CROIX|2GREGORIAN C CLEF|<F CLEF|2SQUARE B|2VIRGA|2PODATUS|2CLIVIS|2SCANDICUS|2CLIMACUS|2TORCULUS|2PORRECTUS|; FLEXUS|2SCANDICUS FLEXUS|2TORCULUS RESUPINUS|2PES SUBPUNCTIS|2KIEVAN C CLEF|9END OF PIECE|9FINAL NOTE|9RECITATIVE MARK|9WHOLE NOTE|9HALF NOTE|9QUARTER NOTE STEM DOWN|KUP|9EIGHTH NOTE STEM DOWN|JUP|9FLAT SIGN|2SORI|2KORON|2HALF SHARP|2ONE AND A HALF SHARP|2REVERSED FLAT|? AND FLAT|2HALF SHARP UP|=DOWN|2ONE AND A HALF SHARP UP|GDOWN|2REVERSED FLAT UP|@DOWN|@AND FLAT UP|IDOWN|2DIGIT TWO WITH STROKE|8FOUR WITH STROKE|9IVE WITH STROKE|8SIX WITH STROKE|9EVEN WITH STROKE|8NINE WITH STROKE|8FIVE WITH LOW STROKE|8SEVEN WITH LOW STROKE|2LONGA REST|#GREEK VOCAL NOTATION SYMBOL-1|?2|?3|?4|?5|?6|?7|?8|?9|?10|@1|@2|@3|@4|@5|@6|@7|@8|@9|?20|@1|@2|@3|@4|?50|@1|@2|@3|@4|)INSTRUMENTAL NOTATION SYMBOL-1|F2|F4|F5|F7|F8|F11|G2|G3|G4|G7|G8|G9|F23|G4|G5|G6|G7|G9|F30|G2|G6|G7|G8|G9|F40|G2|G3|G5|G7|G8|G9|F50|G1|G2|G3|G4|#COMBINING GREEK MUSICAL TRISEME|<ETRASEME|;PENTASEME|#GREEK MUSICAL LEIMMA|#MUSICAL SYMBOL COMBINING FLAG-6|A7|A8|2TWO HUNDRED FIFTY-SIXTH REST|2FIVE HUNDRED TWELFTH REST|2ONE THOUSAND TWENTY-FOURTH REST|2FLAT WITH STROKE|<DOUBLE STROKE|EEM|2HALF SHARP WITH STROKE|2SHARP WITH STROKE|2COMBINING TREMOLO-4|D5|2FINGERED TREMOLO-4|C5|2COMBINING BUZZ ROLL STEM|2TRIPLE FLAT|2SUSPENSION|2HEAVY DOUBLE BARLINE|2SYSTEM DIVIDER|2NIENTE|2CRESCENDO WITH RING|2DECRESCENDO WITH RING|3IAMOND NOTEHEAD WHOLE|EITE|CBLACK|CHALF-FILLED|2TRIANGULAR FERMATA|2DOUBLE TRIANGULAR FERMATA|2SQUARE FERMATA|2DOUBLE SQUARE FERMATA|2HENZE LONG FERMATA|8SHORT FERMATA|2CURLEW|2SALZEDO BREATH MARK|2ORGAN PEDAL HEEL|>TOE|2G CLEF OPTIONALLY OTTAVA BASSA|2DOUBLE G CLEF|2G CLEF OTTAVA BASSA WITH C CLEF|2C CLEF OTTAVA BASSA|2G CLEF QUINDICESIMA ALTA|FBASSA|2F CLEF QUINDICESIMA ALTA|FBASSA|2C CLEF QUINDICESIMA BASSA|2TABLATURE CLEF|2ARPEGGIATO UP WITH ARROW|2COMBINING STEM BOW BEHIND BRIDGE|EON TOP OF BRIDGE|#KAKTOVIK NUMERAL ZERO|4ONE|4TWO|5HREE|4FOUR|5IVE|4SIX|5EVEN|4EIGHT|4NINE|4TEN|4ELEVEN|4TWELVE|5HIRTEEN|4FOURTEEN|5IFTEEN|4SIXTEEN|5EVENTEEN|4EIGHTEEN|4NINETEEN|#MAYAN NUMERAL ZERO|1ONE|1TWO|2HREE|1FOUR|2IVE|1SIX|2EVEN|1EIGHT|1NINE|1TEN|1ELEVEN|1TWELVE|2HIRTEEN|1FOURTEEN|2IFTEEN|1SIXTEEN|2EVENTEEN|1EIGHTEEN|1NINETEEN|$ONOGRAM FOR EARTH|#DIGRAM FOR HEAVENLY EARTH|/UMAN EARTH|.EARTHLY HEAVEN|7UMAN|3|#TETRAGRAM FOR CENTRE|1FULL CIRCLE|1MIRED|1BARRIER|1KEEPING SMALL|1CONTRARIETY|1ASCENT|1OPPOSITION|1BRANCHING OUT|1DEFECTIVENESS OR DISTORTION|2IVERGENCE|1YOUTHFULNESS|1INCREASE|1PENETRATION|1REACH|1CONTACT|1HOLDING BACK|1WAITING|1FOLLOWING|1ADVANCE|1RELEASE|3SISTANCE|1EASE|1JOY|1CONTENTION|1ENDEAVOUR|1DUTIES|1CHANGE|1DECISIVENESS|1BOLD RESOLUTION|1PACKING|1LEGION|1CLOSENESS|1KINSHIP|1GATHERING|1STRENGTH|1PURITY|1FULLNESS|1RESIDENCE|1LAW OR MODEL|1RESPONSE|1GOING TO MEET|1ENCOUNTERS|1STOVE|1GREATNESS|1ENLARGEMENT|1PATTERN|1RITUAL|1FLIGHT|1VASTNESS OR WASTING|1CONSTANCY|1MEASURE|1ETERNITY|1UNITY|1DIMINISHMENT|1CLOSED MOUTH|1GUARDEDNESS|2ATHERING IN|1MASSING|1ACCUMULATION|1EMBELLISHMENT|1DOUBT|1WATCH|1SINKING|1INNER|1DEPARTURE|2ARKENING|2IMMING|1EXHAUSTION|1SEVERANCE|2TOPPAGE|1HARDNESS|1COMPLETION|2LOSURE|1FAILURE|1AGGRAVATION|1COMPLIANCE|1ON THE VERGE|1DIFFICULTIES|1LABOURING|1FOSTERING|#COUNTING ROD UNIT DIGIT ONE|;TWO|<HREE|;FOUR|<IVE|;SIX|<EVEN|;EIGHT|;NINE|0TENS DIGIT ONE|;TWO|<HREE|;FOUR|<IVE|;SIX|<EVEN|;EIGHT|;NINE|#IDEOGRAPHIC TALLY MARK ONE|:TWO|;HREE|:FOUR|;IVE|#TALLY MARK ONE|.FIVE|#MATHEMATICAL BOLD CAPITAL A|=B|=C|=D|=E|=F|=G|=H|=I|=J|=K|=L|=M|=N|=O|=P|=Q|=R|=S|=T|=U|=V|=W|=X|=Y|=Z|5SMALL A|;B|;C|;D|;E|;F|;G|;H|;I|;J|;K|;L|;M|;N|;O|;P|;Q|;R|;S|;T|;U|;V|;W|;X|;Y|;Z|0ITALIC CAPITAL A|?B|?C|?D|?E|?F|?G|?H|?I|?J|?K|?L|?M|?N|?O|?P|?Q|?R|?S|?T|?U|?V|?W|?X|?Y|?Z|7SMALL A|=B|=C|=D|=E|=F|=G|=I|=J|=K|=L|=M|=N|=O|=P|=Q|=R|=S|=T|=U|=V|=W|=X|=Y|=Z|0BOLD ITALIC CAPITAL A|DB|DC|DD|DE|DF|DG|DH|DI|DJ|DK|DL|DM|DN|DO|DP|DQ|DR|DS|DT|DU|DV|DW|DX|DY|DZ|<SMALL A|BB|BC|BD|BE|BF|BG|BH|BI|BJ|BK|BL|BM|BN|BO|BP|BQ|BR|BS|BT|BU|BV|BW|BX|BY|BZ|0SCRIPT CAPITAL A|?C|?D|?G|?J|?K|?N|?O|?P|?Q|?S|?T|?U|?V|?W|?X|?Y|?Z|7SMALL A|=B|=C|=D|=F|=H|=I|=J|=K|=L|=M|=N|=P|=Q|=R|=S|=T|=U|=V|=W|=X|=Y|=Z|0BOLD SCRIPT CAPITAL A|DB|DC|DD|DE|DF|DG|DH|DI|DJ|DK|DL|DM|DN|DO|DP|DQ|DR|DS|DT|DU|DV|DW|DX|DY|DZ|<SMALL A|BB|BC|BD|BE|BF|BG|BH|BI|BJ|BK|BL|BM|BN|BO|BP|BQ|BR|BS|BT|BU|BV|BW|BX|BY|BZ|0FRAKTUR CAPITAL A|@B|@D|@E|@F|@G|@J|@K|@L|@M|@N|@O|@P|@Q|@S|@T|@U|@V|@W|@X|@Y|8SMALL A|>B|>C|>D|>E|>F|>G|>H|>I|>J|>K|>L|>M|>N|>O|>P|>Q|>R|>S|>T|>U|>V|>W|>X|>Y|>Z|0DOUBLE-STRUCK CAPITAL A|FB|FD|FE|FF|FG|FI|FJ|FK|FL|FM|FO|FS|FT|FU|FV|FW|FX|FY|>SMALL A|DB|DC|DD|DE|DF|DG|DH|DI|DJ|DK|DL|DM|DN|DO|DP|DQ|DR|DS|DT|DU|DV|DW|DX|DY|DZ|0BOLD FRAKTUR CAPITAL A|EB|EC|ED|EE|EF|EG|EH|EI|EJ|EK|EL|EM|EN|EO|EP|EQ|ER|ES|ET|EU|EV|EW|EX|EY|EZ|=SMALL A|CB|CC|CD|CE|CF|CG|CH|CI|CJ|CK|CL|CM|CN|CO|CP|CQ|CR|CS|CT|CU|CV|CW|CX|CY|CZ|0SANS-SERIF CAPITAL A|CB|CC|CD|CE|CF|CG|CH|CI|CJ|CK|CL|CM|CN|CO|CP|CQ|CR|CS|CT|CU|CV|CW|CX|CY|CZ|;SMALL A|AB|AC|AD|AE|AF|AG|AH|AI|AJ|AK|AL|AM|AN|AO|AP|AQ|AR|AS|AT|AU|AV|AW|AX|AY|AZ|;BOLD CAPITAL A|HB|HC|HD|HE|HF|HG|HH|HI|HJ|HK|HL|HM|HN|HO|HP|HQ|HR|HS|HT|HU|HV|HW|HX|HY|HZ|@SMALL A|FB|FC|FD|FE|FF|FG|FH|FI|FJ|FK|FL|FM|FN|FO|FP|FQ|FR|FS|FT|FU|FV|FW|FX|FY|FZ|;ITALIC CAPITAL A|JB|JC|JD|JE|JF|JG|JH|JI|JJ|JK|JL|JM|JN|JO|JP|JQ|JR|JS|JT|JU|JV|JW|JX|JY|JZ|BSMALL A|HB|HC|HD|HE|HF|HG|HH|HI|HJ|HK|HL|HM|HN|HO|HP|HQ|HR|HS|HT|HU|HV|HW|HX|HY|HZ|;BOLD ITALIC CAPITAL A|OB|OC|OD|OE|OF|OG|OH|OI|OJ|OK|OL|OM|ON|OO|OP|OQ|OR|OS|OT|OU|OV|OW|OX|OY|OZ|GSMALL A|MB|MC|MD|ME|MF|MG|MH|MI|MJ|MK|ML|MM|MN|MO|MP|MQ|MR|MS|MT|MU|MV|MW|MX|MY|MZ|0MONOSPACE CAPITAL A|BB|BC|BD|BE|BF|BG|BH|BI|BJ|BK|BL|BM|BN|BO|BP|BQ|BR|BS|BT|BU|BV|BW|BX|BY|BZ|:SMALL A|@B|@C|@D|@E|@F|@G|@H|@I|@J|@K|@L|@M|@N|@O|@P|@Q|@R|@S|@T|@U|@V|@W|@X|@Y|@Z|0ITALIC SMALL DOTLESS I|EJ|=LIGATURE LONG S WITH DESCENDER S|0BOLD CAPITAL ALPHA|=BETA|=GAMMA|=DELTA|=EPSILON|=ZETA|=ETA|=THETA|=IOTA|=KAPPA|=LAMDA|=MU|=NU|=XI|=OMICRON|=PI|=RHO|=THETA SYMBOL|=SIGMA|=TAU|=UPSILON|=PHI|=CHI|=PSI|=OMEGA|5NABLA|5SMALL ALPHA|;BETA|;GAMMA|;DELTA|;EPSILON|;ZETA|;ETA|;THETA|;IOTA|;KAPPA|;LAMDA|;MU|;NU|;XI|;OMICRON|;PI|;RHO|;FINAL SIGMA|;SIGMA|;TAU|;UPSILON|;PHI|;CHI|;PSI|;OMEGA|5PARTIAL DIFFERENTIAL|5EPSILON SYMBOL|5THETA SYMBOL|5KAPPA SYMBOL|5PHI SYMBOL|5RHO SYMBOL|5PI SYMBOL|0ITALIC CAPITAL ALPHA|?BETA|?GAMMA|?DELTA|?EPSILON|?ZETA|?ETA|?THETA|?IOTA|?KAPPA|?LAMDA|?MU|?NU|?XI|?OMICRON|?PI|?RHO|?THETA SYMBOL|?SIGMA|?TAU|?UPSILON|?PHI|?CHI|?PSI|?OMEGA|7NABLA|7SMALL ALPHA|=BETA|=GAMMA|=DELTA|=EPSILON|=ZETA|=ETA|=THETA|=IOTA|=KAPPA|=LAMDA|=MU|=NU|=XI|=OMICRON|=PI|=RHO|=FINAL SIGMA|=SIGMA|=TAU|=UPSILON|=PHI|=CHI|=PSI|=OMEGA|7PARTIAL DIFFERENTIAL|7EPSILON SYMBOL|7THETA SYMBOL|7KAPPA SYMBOL|7PHI SYMBOL|7RHO SYMBOL|7PI SYMBOL|0BOLD ITALIC CAPITAL ALPHA|DBETA|DGAMMA|DDELTA|DEPSILON|DZETA|DETA|DTHETA|DIOTA|DKAPPA|DLAMDA|DMU|DNU|DXI|DOMICRON|DPI|DRHO|DTHETA SYMBOL|DSIGMA|DTAU|DUPSILON|DPHI|DCHI|DPSI|DOMEGA|<NABLA|<SMALL ALPHA|BBETA|BGAMMA|BDELTA|BEPSILON|BZETA|BETA|BTHETA|BIOTA|BKAPPA|BLAMDA|BMU|BNU|BXI|BOMICRON|BPI|BRHO|BFINAL SIGMA|BSIGMA|BTAU|BUPSILON|BPHI|BCHI|BPSI|BOMEGA|<PARTIAL DIFFERENTIAL|<EPSILON SYMBOL|<THETA SYMBOL|<KAPPA SYMBOL|<PHI SYMBOL|<RHO SYMBOL|<PI SYMBOL|0SANS-SERIF BOLD CAPITAL ALPHA|HBETA|HGAMMA|HDELTA|HEPSILON|HZETA|HETA|HTHETA|HIOTA|HKAPPA|HLAMDA|HMU|HNU|HXI|HOMICRON|HPI|HRHO|HTHETA SYMBOL|HSIGMA|HTAU|HUPSILON|HPHI|HCHI|HPSI|HOMEGA|@NABLA|@SMALL ALPHA|FBETA|FGAMMA|FDELTA|FEPSILON|FZETA|FETA|FTHETA|FIOTA|FKAPPA|FLAMDA|FMU|FNU|FXI|FOMICRON|FPI|FRHO|FFINAL SIGMA|FSIGMA|FTAU|FUPSILON|FPHI|FCHI|FPSI|FOMEGA|@PARTIAL DIFFERENTIAL|@EPSILON SYMBOL|@THETA SYMBOL|@KAPPA SYMBOL|@PHI SYMBOL|@RHO SYMBOL|@PI SYMBOL|@ITALIC CAPITAL ALPHA|OBETA|OGAMMA|ODELTA|OEPSILON|OZETA|OETA|OTHETA|OIOTA|OKAPPA|OLAMDA|OMU|ONU|OXI|OOMICRON|OPI|ORHO|OTHETA SYMBOL|OSIGMA|OTAU|OUPSILON|OPHI|OCHI|OPSI|OOMEGA|GNABLA|GSMALL ALPHA|MBETA|MGAMMA|MDELTA|MEPSILON|MZETA|META|MTHETA|MIOTA|MKAPPA|MLAMDA|MMU|MNU|MXI|MOMICRON|MPI|MRHO|MFINAL SIGMA|MSIGMA|MTAU|MUPSILON|MPHI|MCHI|MPSI|MOMEGA|GPARTIAL DIFFERENTIAL|GEPSILON SYMBOL|GTHETA SYMBOL|GKAPPA SYMBOL|GPHI SYMBOL|GRHO SYMBOL|GPI SYMBOL|0BOLD CAPITAL DIGAMMA|5SMALL DIGAMMA|5DIGIT ZERO|;ONE|;TWO|<HREE|;FOUR|<IVE|;SIX|<EVEN|;EIGHT|;NINE|0DOUBLE-STRUCK DIGIT ZERO|DONE|DTWO|EHREE|DFOUR|EIVE|DSIX|EEVEN|DEIGHT|DNINE|0SANS-SERIF DIGIT ZERO|AONE|ATWO|BHREE|AFOUR|BIVE|ASIX|BEVEN|AEIGHT|ANINE|;BOLD DIGIT ZERO|FONE|FTWO|GHREE|FFOUR|GIVE|FSIX|GEVEN|FEIGHT|FNINE|0MONOSPACE DIGIT ZERO|@ONE|@TWO|AHREE|@FOUR|AIVE|@SIX|AEVEN|@EIGHT|@NINE|#SIGNWRITING HAND-FIST INDEX|4CIRCLE INDEX|5UP INDEX|4OVAL INDEX|4HINGE INDEX|4ANGLE INDEX|4FIST INDEX BENT|4CIRCLE INDEX BENT|4FIST THUMB UNDER INDEX BENT|9INDEX RAISED KNUCKLE|?CUPPED|?HINGED|E LOW|4CIRCLE INDEX HINGE|4FIST INDEX MIDDLE|4CIRCLE INDEX MIDDLE|4FIST INDEX MIDDLE BENT|FRAISED KNUCKLES|FHINGED|?UP MIDDLE HINGED|?HINGED MIDDLE UP|?MIDDLE CONJOINED|O INDEX BENT|PMIDDLE BENT|PCUPPED|PHINGED|GROSSED|4CIRCLE INDEX MIDDLE CROSSED|4FIST MIDDLE BENT OVER INDEX|9INDEX BENT OVER MIDDLE|?MIDDLE THUMB|4CIRCLE INDEX MIDDLE THUMB|4FIST INDEX MIDDLE STRAIGHT THUMB BENT|FBENT THUMB STRAIGHT|FTHUMB BENT|FHINGED SPREAD THUMB SIDE|?UP MIDDLE HINGED THUMB SIDE|VCONJOINED|?HINGED MIDDLE UP THUMB SIDE|?MIDDLE UP SPREAD THUMB FORWARD|FTHUMB CUPPED|MIRCLED|LHOOKED|MINGED|9THUMB BETWEEN INDEX MIDDLE STRAIGHT|9INDEX MIDDLE CONJOINED THUMB SIDE|Z CONJOINED|[BENT|9MIDDLE THUMB HOOKED INDEX UP|9INDEX THUMB HOOKED MIDDLE UP|?MIDDLE CONJOINED HINGED THUMB SIDE|GROSSED THUMB SIDE|GONJOINED THUMB FORWARD|PCUPPED THUMB FORWARD|9MIDDLE THUMB CUPPED INDEX UP|9INDEX THUMB CUPPED MIDDLE UP|9MIDDLE THUMB CIRCLED INDEX UP|THINGED|9INDEX THUMB ANGLED OUT MIDDLE UP|LIN MIDDLE UP|ECIRCLED MIDDLE UP|?MIDDLE THUMB CONJOINED HINGED|LANGLED OUT|R|9MIDDLE THUMB ANGLED OUT INDEX UP|WCROSSED|MINDEX UP|9INDEX THUMB HOOKED MIDDLE HINGED|5LAT FOUR FINGERS|E BENT|FHINGED|FCONJOINED|O SPLIT|4CLAW FOUR FINGERS CONJOINED|4FIST FOUR FINGERS CONJOINED BENT|4HINGE FOUR FINGERS CONJOINED|4FLAT FIVE FINGERS SPREAD|9HEEL FIVE FINGERS SPREAD|9FIVE FINGERS SPREAD FOUR BENT|9HEEL FIVE FINGERS SPREAD FOUR BENT|9FIVE FINGERS SPREAD BENT|9HEEL FIVE FINGERS SPREAD BENT|9FIVE FINGERS SPREAD THUMB FORWARD|4CUP FIVE FINGERS SPREAD|K OPEN|4HINGE FIVE FINGERS SPREAD OPEN|4OVAL FIVE FINGERS SPREAD|4FLAT FIVE FINGERS SPREAD HINGED|S THUMB SIDE|TNO THUMB|8|8 BETWEEN PALM FACINGS|9HEEL|9THUMB SIDE|9HEEL THUMB SIDE|9THUMB BENT|?FORWARD|9SPLIT INDEX THUMB SIDE|?CENTRE|E THUMB SIDE|P BENT|?LITTLE|4CLAW|8 THUMB SIDE|9NO THUMB|9THUMB FORWARD|4HOOK CURLICUE|8|4CUP OPEN|7|7 OPEN THUMB SIDE|8THUMB SIDE|8OPEN NO THUMB|8NO THUMB|8OPEN THUMB FORWARD|8THUMB FORWARD|6RLICUE OPEN|<|5IRCLE|4OVAL|8 THUMB SIDE|9NO THUMB|9THUMB FORWARD|4HINGE OPEN|> THUMB FORWARD|9|9 SMALL|:OPEN THUMB SIDE|:THUMB SIDE|:OPEN NO THUMB|:NO THUMB|:THUMB SIDE TOUCHING INDEX|@BETWEEN MIDDLE RING|4ANGLE|4FIST INDEX MIDDLE RING|4CIRCLE INDEX MIDDLE RING|4HINGE INDEX MIDDLE RING|4ANGLE INDEX MIDDLE RING|4HINGE LITTLE|4FIST INDEX MIDDLE RING BENT|KCONJOINED|4HINGE INDEX MIDDLE RING CONJOINED|4FIST LITTLE DOWN|D RIPPLE STRAIGHT|LCURVED|EOTHERS CIRCLED|@UP|9THUMB UNDER LITTLE UP|4CIRCLE LITTLE UP|4OVAL LITTLE UP|4ANGLE LITTLE UP|4FIST LITTLE RAISED KNUCKLE|@BENT|@TOUCHES THUMB|AHUMB|4HINGE LITTLE THUMB|4FIST LITTLE INDEX THUMB|4HINGE LITTLE INDEX THUMB|4ANGLE LITTLE INDEX THUMB INDEX THUMB OUT|X|4FIST LITTLE INDEX|4CIRCLE LITTLE INDEX|4HINGE LITTLE INDEX|4ANGLE LITTLE INDEX|4FIST INDEX MIDDLE LITTLE|4CIRCLE INDEX MIDDLE LITTLE|4HINGE INDEX MIDDLE LITTLE|:RING|4ANGLE INDEX MIDDLE LITTLE|4FIST INDEX MIDDLE CROSS LITTLE|4CIRCLE INDEX MIDDLE CROSS LITTLE|4FIST RING DOWN|4HINGE RING DOWN INDEX THUMB HOOK MIDDLE|4ANGLE RING DOWN MIDDLE THUMB INDEX CROSS|4FIST RING UP|>RAISED KNUCKLE|>LITTLE|4CIRCLE RING LITTLE|4OVAL RING LITTLE|4ANGLE RING LITTLE|4FIST RING MIDDLE|D CONJOINED|ERAISED KNUCKLES|>INDEX|>THUMB|4HOOK RING THUMB|4FIST INDEX RING LITTLE|4CIRCLE INDEX RING LITTLE|5URLICUE INDEX RING LITTLE ON|4HOOK INDEX RING LITTLE OUT|KIN|KUNDER|4CUP INDEX RING LITTLE|4HINGE INDEX RING LITTLE|4ANGLE INDEX RING LITTLE OUT|K|4FIST MIDDLE DOWN|4HINGE MIDDLE|4FIST MIDDLE UP|4CIRCLE MIDDLE UP|4FIST MIDDLE RAISED KNUCKLE|@UP THUMB SIDE|4HOOK MIDDLE THUMB|4FIST MIDDLE THUMB LITTLE|@LITTLE|@RING LITTLE|4CIRCLE MIDDLE RING LITTLE|5URLICUE MIDDLE RING LITTLE ON|6P MIDDLE RING LITTLE|4HINGE MIDDLE RING LITTLE|4ANGLE MIDDLE RING LITTLE OUT|MIN|L|4CIRCLE MIDDLE RING LITTLE BENT|5LAW MIDDLE RING LITTLE CONJOINED|U SIDE|4HOOK MIDDLE RING LITTLE CONJOINED OUT|VIN|U|5INGE INDEX HINGED|4FIST INDEX THUMB SIDE|4HINGE INDEX THUMB SIDE|4FIST INDEX THUMB SIDE THUMB DIAGONAL|PCONJOINED|PBENT|JINDEX BENT|JBOTH BENT|JINDEX HINGE|EFORWARD INDEX STRAIGHT|SBENT|EHOOK|ECURLICUE|HVE THUMB INSIDE|4CLAW INDEX THUMB CURVE THUMB INSIDE|4FIST INDEX THUMB CURVE THUMB UNDER|FIRCLE|4CUP INDEX THUMB|C OPEN|4HINGE INDEX THUMB OPEN|FLARGE|E|E SMALL|4ANGLE INDEX THUMB OUT|FIN|E|4FIST THUMB|> HEEL|?SIDE DIAGONAL|DCONJOINED|DBENT|?FORWARD|?BETWEEN INDEX MIDDLE|GMIDDLE RING|GRING LITTLE|?UNDER TWO FINGERS|?OVER TWO FINGERS|?UNDER THREE FINGERS|EFOUR FINGERS|?OVER FOUR RAISED KNUCKLES|8|8 HEEL|/TOUCH SINGLE|5MULTIPLE|5BETWEEN|/GRASP SINGLE|5MULTIPLE|5BETWEEN|/STRIKE SINGLE|6MULTIPLE|6BETWEEN|/BRUSH SINGLE|5MULTIPLE|5BETWEEN|/RUB SINGLE|3MULTIPLE|3BETWEEN|/SURFACE SYMBOLS|7BETWEEN|0QUEEZE LARGE SINGLE|7SMALL SINGLE|7LARGE MULTIPLE|7SMALL MULTIPLE|8EQUENTIAL|/FLICK LARGE SINGLE|5SMALL SINGLE|5LARGE MULTIPLE|5SMALL MULTIPLE|6EQUENTIAL|/SQUEEZE FLICK ALTERNATING|/MOVEMENT-HINGE UP DOWN LARGE|FSMALL|ASEQUENTIAL|>DOWN SEQUENTIAL|>UP DOWN ALTERNATING LARGE|RSMALL|>SIDE TO SIDE SCISSORS|8WALLPLANE FINGER CONTACT|8FLOORPLANE FINGER CONTACT|8WALLPLANE SINGLE STRAIGHT SMALL|RMEDIUM|RLARGE|WST|IWRIST FLEX|BDOUBLE STRAIGHT|IWRIST FLEX|IALTERNATING|T WRIST FLEX|BCROSS|BTRIPLE STRAIGHT MOVEMENT|IWRIST FLEX|IALTERNATING|T WRIST FLEX|BBEND SMALL|GMEDIUM|GLARGE|BCORNER SMALL|IMEDIUM|ILARGE|IROTATION|CHECK SMALL|HMEDIUM|HLARGE|BBOX SMALL|FMEDIUM|FLARGE|BZIGZAG SMALL|IMEDIUM|ILARGE|BPEAKS SMALL|HMEDIUM|HLARGE|/TRAVEL-WALLPLANE ROTATION-WALLPLANE SINGLE|SDOUBLE|SALTERNATING|IFLOORPLANE SINGLE|TDOUBLE|TALTERNATING|@SHAKING|@ARM SPIRAL SINGLE|KDOUBLE|KTRIPLE|/MOVEMENT-DIAGONAL AWAY SMALL|FMEDIUM|FLARGE|KST|ATOWARDS SMALL|IMEDIUM|ILARGE|NST|ABETWEEN AWAY SMALL|NMEDIUM|NLARGE|SST|ITOWARDS SMALL|QMEDIUM|QLARGE|VST|8FLOORPLANE SINGLE STRAIGHT SMALL|SMEDIUM|SLARGE|XST|JWRIST FLEX|CDOUBLE STRAIGHT|JWRIST FLEX|JALTERNATING|U WRIST FLEX|CCROSS|CTRIPLE STRAIGHT MOVEMENT|JWRIST FLEX|JALTERNATING MOVEMENT|VWRIST FLEX|CBEND|CCORNER SMALL|JMEDIUM|JLARGE|DHECK|CBOX SMALL|GMEDIUM|GLARGE|CZIGZAG SMALL|JMEDIUM|JLARGE|CPEAKS SMALL|IMEDIUM|ILARGE|/TRAVEL-FLOORPLANE ROTATION-FLOORPLANE SINGLE|UDOUBLE|UALTERNATING|JWALLPLANE SINGLE|TDOUBLE|TALTERNATING|ASHAKING|/MOVEMENT-WALLPLANE CURVE QUARTER SMALL|PMEDIUM|PLARGE|UST|HHALF-CIRCLE SMALL|TMEDIUM|TLARGE|YST|HTHREE-QUARTER CIRCLE SMALL|]MEDIUM|BHUMP SMALL|GMEDIUM|GLARGE|BLOOP SMALL|GMEDIUM|GLARGE|GSMALL DOUBLE|BWAVE CURVE DOUBLE SMALL|TMEDIUM|TLARGE|MTRIPLE SMALL|TMEDIUM|TLARGE|BCURVE THEN STRAIGHT|GD CROSS SMALL|OMEDIUM|/ROTATION-WALLPLANE SINGLE|BDOUBLE|BALTERNATE|/MOVEMENT-WALLPLANE SHAKING|BCURVE HITTING FRONT WALL|BHUMP HITTING FRONT WALL|BLOOP HITTING FRONT WALL|BWAVE HITTING FRONT WALL|/ROTATION-WALLPLANE SINGLE HITTING FRONT WALL|BDOUBLE HITTING FRONT WALL|BALTERNATING HITTING FRONT WALL|/MOVEMENT-WALLPLANE CURVE HITTING CHEST|BHUMP HITTING CHEST|BLOOP HITTING CHEST|BWAVE HITTING CHEST|/ROTATION-WALLPLANE SINGLE HITTING CHEST|BDOUBLE HITTING CHEST|BALTERNATING HITTING CHEST|/MOVEMENT-WALLPLANE WAVE DIAGONAL PATH SMALL|UMEDIUM|ULARGE|8FLOORPLANE CURVE HITTING CEILING SMALL|YLARGE|CHUMP HITTING CEILING SMALL DOUBLE|XLARGE DOUBLE|XSMALL TRIPLE|XLARGE TRIPLE|CLOOP HITTING CEILING SMALL SINGLE|XLARGE SINGLE|XSMALL DOUBLE|XLARGE DOUBLE|CWAVE HITTING CEILING SMALL|XLARGE|/ROTATION-FLOORPLANE SINGLE HITTING CEILING|CDOUBLE HITTING CEILING|CALTERNATING HITTING CEILING|/MOVEMENT-FLOORPLANE CURVE HITTING FLOOR SMALL|WLARGE|CHUMP HITTING FLOOR SMALL DOUBLE|VLARGE DOUBLE|VTRIPLE SMALL TRIPLE|]LARGE TRIPLE|CLOOP HITTING FLOOR SMALL SINGLE|VLARGE SINGLE|VSMALL DOUBLE|VLARGE DOUBLE|CWAVE HITTING FLOOR SMALL|VLARGE|/ROTATION-FLOORPLANE SINGLE HITTING FLOOR|CDOUBLE HITTING FLOOR|CALTERNATING HITTING FLOOR|/MOVEMENT-FLOORPLANE CURVE SMALL|IMEDIUM|ILARGE|NST|ICOMBINED|CHUMP SMALL|CLOOP SMALL|CWAVE SNAKE|IMALL|HLARGE|/ROTATION-FLOORPLANE SINGLE|CDOUBLE|CALTERNATING|/MOVEMENT-FLOORPLANE SHAKING PARALLEL|8WALLPLANE ARM CIRCLE SMALL SINGLE|MMEDIUM SINGLE|MSMALL DOUBLE|MMEDIUM DOUBLE|8FLOORPLANE ARM CIRCLE HITTING WALL SMALL SINGLE|[MEDIUM SINGLE|[LARGE SINGLE|[SMALL DOUBLE|[MEDIUM DOUBLE|[LARGE DOUBLE|8WALLPLANE WRIST CIRCLE FRONT SINGLE|UDOUBLE|8FLOORPLANE WRIST CIRCLE HITTING WALL SINGLE|]DOUBLE|8WALLPLANE FINGER CIRCLES SINGLE|QDOUBLE|8FLOORPLANE FINGER CIRCLES HITTING WALL SINGLE|_DOUBLE|/DYNAMIC ARROWHEAD SMALL|ALARGE|7FAST|7SLOW|7TENSE|7RELAXED|7SIMULTANEOUS|C ALTERNATING|7EVERY OTHER TIME|7GRADUAL|/HEAD|3 RIM|4MOVEMENT-WALLPLANE STRAIGHT|GTILT|=FLOORPLANE STRAIGHT|=WALLPLANE CURVE|=FLOORPLANE CURVE|< CIRCLE|/FACE DIRECTION POSITION NOSE FORWARD TILTING|LUP OR DOWN|V TILTING|/EYEBROWS STRAIGHT UP|ANEUTRAL|ADOWN|/DREAMY EYEBROWS NEUTRAL DOWN|?DOWN NEUTRAL|?UP NEUTRAL|?NEUTRAL UP|/FOREHEAD NEUTRAL|8CONTACT|8WRINKLED|/EYES OPEN|4SQUEEZED|4CLOSED|2 BLINK SINGLE|9MULTIPLE|2S HALF OPEN|4WIDE OPEN|4HALF CLOSED|4WIDENING MOVEMENT|2 WINK|2LASHES UP|9DOWN|9FLUTTERING|2GAZE-WALLPLANE STRAIGHT|I DOUBLE|JALTERNATING|7FLOORPLANE STRAIGHT|J DOUBLE|KALTERNATING|7WALLPLANE CURVED|7FLOORPLANE CURVED|7WALLPLANE CIRCLING|/CHEEKS PUFFED|6NEUTRAL|6SUCKED|/TENSE CHEEKS HIGH|<MIDDLE|<LOW|/EARS|/NOSE NEUTRAL|4CONTACT|4WRINKLES|5IGGLES|/AIR BLOWING OUT|3SUCKING IN|3BLOW SMALL ROTATIONS|3SUCK SMALL ROTATIONS|/BREATH INHALE|6EXHALE|/MOUTH CLOSED NEUTRAL|<FORWARD|<CONTACT|5SMILE|: WRINKLED|;OPEN|5FROWN|: WRINKLED|;OPEN|5OPEN CIRCLE|:FORWARD|:WRINKLED|:OVAL|> WRINKLED|?YAWN|:RECTANGLE|C WRINKLED|DYAWN|5KISS|9 FORWARD|:WRINKLED|5TENSE|: FORWARD|;SUCKED|/LIPS PRESSED TOGETHER|2 LOWER OVER UPPER|3UPPER OVER LOWER|/MOUTH CORNERS|5WRINKLES SINGLE|>DOUBLE|/TONGUE STICKING OUT FAR|6LICKING LIPS|6TIP BETWEEN LIPS|:TOUCHING INSIDE MOUTH|6INSIDE MOUTH RELAXED|6MOVES AGAINST CHEEK|6CENTRE STICKING OUT|=INSIDE MOUTH|0EETH|4 MOVEMENT|5ON TONGUE|> MOVEMENT|8LIPS|< MOVEMENT|5BITE LIPS|/MOVEMENT-WALLPLANE JAW|8FLOORPLANE JAW|/NECK|/HAIR|/EXCITEMENT|/SHOULDER HIP SPINE|<POSITIONS|/WALLPLANE SHOULDER HIP MOVE|/FLOORPLANE SHOULDER HIP MOVE|/SHOULDER TILTING FROM WAIST|/TORSO-WALLPLANE STRAIGHT STRETCH|?CURVED BEND|5FLOORPLANE TWISTING|/UPPER BODY TILTING FROM HIP JOINTS|/LIMB COMBINATION|4LENGTH-1|;2|;3|;4|;5|;6|;7|/FINGER|/LOCATION-WALLPLANE SPACE|8FLOORPLANE SPACE|7 HEIGHT|8WIDTH|8DEPTH|8HEAD NECK|8TORSO|8LIMBS DIGITS|/COMMA|/FULL STOP|/SEMICOLON|/COLON|/PARENTHESIS|/FILL MODIFIER-2|=3|=4|=5|=6|/ROTATION MODIFIER-2|A3|A4|A5|A6|A7|A8|A9|A10|B1|B2|B3|B4|B5|B6|#LEIBNIZIAN EQUALS SIGN|9 WITH DOUBLE VERTICALS|?SMALL S|.GREATER-THAN|.LESS-THAN|.GREATER-THAN WITH SMALL P|.LESS-THAN WITH SMALL P|.GREATER-THAN OR LESS-THAN|#INVERTED SQUARE LEFT OPEN BOX OPERATOR|3RIGHT OPEN BOX OPERATOR|#TWO-LINE GREATER-THAN|,LESS-THAN|#COMMENSURABILITY|#INCOMMENSURABILITY|#COMMENSURABILITY IN SQUARE|#INCOMMENSURABILITY IN SQUARE|#CARTESIAN EQUALS SIGN|#LEIBNIZIAN CONGRUENCE|8 WITH VERTICAL BAR|8-2|: INVERTED|;WITH HORIZONTAL BAR|KAND VERTICAL BAR|0INCIDENCE|#INVERTED LAZY S OVER LAZY S|#LEIBNIZIAN SIMILARITY|8-2|.DISSIMILARITY|#FACIT SYMBOL|#LATIN SMALL LETTER FENG DIGRAPH WITH TRILL|6REVERSED SCRIPT G|)LETTER SMALL CAPITAL TURNED G|)SMALL LETTER REVERSED K|)LETTER SMALL CAPITAL L WITH BELT|)SMALL LETTER LEZH WITH RETROFLEX HOOK|6TURNED Y WITH BELT|6REVERSED ENG|6TURNED R WITH LONG LEG AND RETROFLEX HOOK|7 WITH HOOK AND RETROFLEX HOOK|)LETTER RETROFLEX CLICK WITH RETROFLEX HOOK|)SMALL LETTER ESH WITH DOUBLE BAR|I AND CURL|6TURNED T WITH CURL|)LETTER INVERTED GLOTTAL STOP WITH CURL|0STRETCHED C WITH CURL|1MALL CAPITAL TURNED K|)SMALL LETTER L WITH FISHHOOK|6DEZH DIGRAPH WITH PALATAL HOOK|6L WITH BELT AND PALATAL HOOK|6ENG WITH PALATAL HOOK|6TURNED R WITH PALATAL HOOK|6R WITH FISHHOOK AND PALATAL HOOK|6TESH DIGRAPH WITH PALATAL HOOK|6EZH WITH PALATAL HOOK|6DEZH DIGRAPH WITH RETROFLEX HOOK|6I WITH STROKE AND RETROFLEX HOOK|6O WITH RETROFLEX HOOK|6TESH DIGRAPH WITH RETROFLEX HOOK|6C WITH RETROFLEX HOOK|6S WITH CURL|6D-ETH DIGRAPH|8LEZH DIGRAPH|D WITH RETROFLEX HOOK|6TL DIGRAPH WITH BELT|FRETROFLEX HOOK AND BELT|7-THETA DIGRAPH|6D WITH MID-HEIGHT LEFT HOOK|6L WITH MID-HEIGHT LEFT HOOK|6N WITH MID-HEIGHT LEFT HOOK|6R WITH MID-HEIGHT LEFT HOOK|6S WITH MID-HEIGHT LEFT HOOK|6T WITH MID-HEIGHT LEFT HOOK|6DEZH DIGRAPH WITH CURL|6TESH DIGRAPH WITH CURL|6D WITH HOOK AND PALATAL HOOK|7Z DIGRAPH WITH PALATAL HOOK|6ETH WITH PALATAL HOOK|)LETTER SMALL CAPITAL G WITH PALATAL HOOK|)SMALL LETTER GAMMA WITH PALATAL HOOK|6H WITH STROKE AND PALATAL HOOK|6PHI WITH PALATAL HOOK|6Q WITH PALATAL HOOK|)LETTER SMALL CAPITAL R WITH PALATAL HOOK|>INVERTED R WITH PALATAL HOOK|)SMALL LETTER R WITH TAIL AND PALATAL HOOK|6TS DIGRAPH WITH PALATAL HOOK|6V WITH HOOK AND PALATAL HOOK|)LETTER PHARYNGEAL VOICED FRICATIVE WITH PALATAL HOOK|)SMALL LETTER BETA WITH PALATAL HOOK|6THETA WITH PALATAL HOOK|6CHI WITH PALATAL HOOK|6BARRED TURNED H|=W|)CAPITAL LETTER BARRED A|)SMALL LETTER BARRED A|=OPEN O|)LETTER SMALL CAPITAL BARRED E|)SMALL LETTER BARRED OPEN E|6G WITH STROKE AND PALATAL HOOK|6BARRED H|> WITH HOOK|)CAPITAL LETTER BARRED K|)SMALL LETTER BARRED K|)CAPITAL LETTER BARRED M|)SMALL LETTER BARRED M|> WITH HOOK|)CAPITAL LETTER BARRED N|)SMALL LETTER BARRED N|=ENG|6TURNED R WITH STROKE|)CAPITAL LETTER BARRED V|)SMALL LETTER BARRED V|=CLOSED OMEGA|>HI|6Y WITH LOW STROKE|)LETTER GLOTTAL STOP WITH DOUBLE STROKE|)SMALL LETTER TURNED R WITH MID-HEIGHT LEFT HOOK|6SPLIT O|<U|6HALF A|6STRETCHED C-H DIGRAPH|6LUNATE EE|6IE|6OI DIGRAPH|7U DIGRAPH|7MEGA WITH LOOP|6R WITH LEFT TIE|6ESH-H DIGRAPH|6STRETCHED T-H DIGRAPH|6REVERSED T-H DIGRAPH|6WH DIGRAPH|6REVERSED Z|6LEZH WITH CURL|)CAPITAL LETTER PHONOTYPIC A WITH SWASH|)SMALL LETTER PHONOTYPIC A WITH SWASH|)CAPITAL LETTER PHONOTYPIC ROUNDTOP A|)SMALL LETTER PHONOTYPIC ROUNDTOP A|)CAPITAL LETTER REVERSED SCRUPLE|)SMALL LETTER REVERSED SCRUPLE|)CAPITAL LETTER PHONOTYPIC DIPHTHONG AI|)SMALL LETTER PHONOTYPIC DIPHTHONG AI|6I WITH PIGTAIL AT BOTTOM|6STRETCHED I|)CAPITAL LETTER O WITH CURL|)SMALL LETTER O WITH CURL|)CAPITAL LETTER CLOSED OMEGA WITH LONG STEM|)SMALL LETTER CLOSED OMEGA WITH LONG STEM|)CAPITAL LETTER TURNED CLOSED OMEGA|)SMALL LETTER TURNED CLOSED OMEGA|)CAPITAL LETTER PHONOTYPIC TH|)SMALL LETTER PHONOTYPIC TH|)CAPITAL LETTER U WITH HOOK TAIL|)SMALL LETTER U WITH HOOK TAIL|)CAPITAL LETTER U WITH NOTCH AT BOTTOM|)SMALL LETTER U WITH NOTCH AT BOTTOM|)CAPITAL LETTER REVERSED U|)SMALL LETTER REVERSED U|)CAPITAL LETTER A WITH TOPBAR|8E WITH BENT TOPBAR|)SMALL LETTER C WITH LOW SLASH|?OPED CEDILLA|=RIGHT LOOP|6D ROTUNDA WITH DESCENDING CROSSING LOOP|6R ROTUNDA WITH LOOP|0IGATURE LONG S WITH DESCENDER S|0ETTER LONG S WITH TOP LOOP|#MODIFIER LETTER SMALL TURNED R WITH MID-HEIGHT LEFT HOOK|9SPLIT O|?U|#LATIN SUBSCRIPT SMALL LETTER GAMMA|#MODIFIER LETTER SMALL CAPITAL P|9B WITH STROKE|9D WITH STROKE|9G WITH STROKE|9L WITH STROKE|@BAR|9TURNED R WITH STROKE|9BARRED TURNED H|9J WITH STROKE|9UPSILON WITH STROKE|9BARRED W|9N WITH LONG RIGHT LEG|9R WITH LONG LEG|9DB DIGRAPH|9QP DIGRAPH|9DEZH DIGRAPH WITH CURL|KRETROFLEX HOOK|9ESH WITH CURL|BRETROFLEX HOOK|9TESH DIGRAPH WITH CURL|KRETROFLEX HOOK|9EZH WITH CURL|BRETROFLEX HOOK|9CAPITAL D|AA|AE|9REVERSED R WITH FISHHOOK|9SQUAT REVERSED ESH|9TURNED H WITH FISHHOOK|O AND TAIL|9D WITH CURL|9L WITH CURL|9N WITH CURL|9T WITH CURL|9GREEK PSI|?OMEGA|9D WITH PALATAL HOOK|9H WITH PALATAL HOOK|9N WITH PALATAL HOOK|9S WITH PALATAL HOOK|9Z WITH PALATAL HOOK|9C WITH HOOK|9K WITH HOOK|9P WITH HOOK|9Q WITH HOOK|9T WITH HOOK|D AND RETROFLEX HOOK|#COMBINING GLAGOLITIC LETTER AZU|?BUKY|?VEDE|?GLAGOLI|?DOBRO|?YESTU|?ZHIVETE|@EMLJA|?IZHE|@NITIAL IZHE|@|?DJERVI|?KAKO|?LJUDIJE|?MYSLITE|?NASHI|?ONU|?POKOJI|?RITSI|?SLOVO|?TVRIDO|?UKU|?FRITU|?HERU|?SHTA|?TSI|?CHRIVI|?SHA|?YERU|BI|@ATI|@U|?SMALL YUS|?YO|?IOTATED SMALL YUS|?BIG YUS|?IOTATED BIG YUS|?FITA|#MODIFIER LETTER CYRILLIC SMALL A|BBE|BVE|BGHE|BDE|BIE|BZHE|CE|BI|BKA|BEL|CM|BO|BPE|BER|CS|BTE|BU|BEF|BHA|BTSE|BCHE|BSHA|BYERU|BE|BYU|BDZZE|BSCHWA|BBYELORUSSIAN-UKRAINIAN I|BJE|BBARRED O|BSTRAIGHT U|BPALOCHKA|#CYRILLIC SUBSCRIPT SMALL LETTER A|CBE|CVE|CGHE|CDE|CIE|CZHE|DE|CI|CKA|CEL|CO|CPE|CES|CU|CEF|CHA|CTSE|CCHE|CSHA|CHARD SIGN|CYERU|CGHE WITH UPTURN|CBYELORUSSIAN-UKRAINIAN I|CDZE|EHE|#MODIFIER LETTER CYRILLIC SMALL ES WITH DESCENDER|BYERU WITH BACK YER|BSTRAIGHT U WITH STROKE|#COMBINING CYRILLIC SMALL LETTER BYELORUSSIAN-UKRAINIAN I|#NYIAKENG PUACHUE HMONG LETTER MA|ATSA|ANTA|ATA|AHA|ANA|AXA|ANKA|ACA|ALA|ASA|AZA|ANCA|BTSA|AKA|ADA|ANYA|BRA|AVA|ANTXA|ATXA|AFA|ARA|AQA|AYA|ANQA|APA|AXYA|ANPA|ADLA|ANPLA|AHAH|AMLA|APLA|AGA|ARRA|AA|BA|AI|AU|AO|BO|AE|BE|AW|:TONE-B|?M|?J|?V|?S|?G|?D|:SIGN FOR PERSON|CTHING|CLOCATION|CANIMAL|CINVERTEBRATE|?XW XW|;YLLABLE LENGTHENER|:DIGIT ZERO|@ONE|@TWO|AHREE|@FOUR|AIVE|@SIX|AEVEN|@EIGHT|@NINE|:LOGOGRAM NYAJ|:CIRCLED CA|#TOTO LETTER PA|/BA|/TA|/DA|/KA|/GA|/MA|/NA|0GA|/SA|/CHA|/YA|/WA|/JA|/HA|/RA|/LA|/I|/BREATHY I|/IU|/BREATHY IU|/U|/E|/BREATHY E|/EO|/BREATHY EO|/O|/AE|/BREATHY AE|/A|(SIGN RISING TONE|#WANCHO LETTER AA|2|1BA|1CA|1DA|1GA|1YA|1PHA|1LA|1NA|1PA|1TA|2HA|1FA|1SA|2HA|1JA|1ZA|1WA|1VA|1KA|1O|1AU|1RA|1MA|1KHA|1HA|1E|1I|1NGA|1U|1LLHA|1TSA|2RA|1ONG|1AANG|2NG|1ING|1ON|1EN|1AAN|1NYA|1UEN|1YIH|*TONE TUP|2NI|/KOI|2NI|*DIGIT ZERO|0ONE|0TWO|1HREE|0FOUR|1IVE|0SIX|1EVEN|0EIGHT|0NINE|*NGUN SIGN|#NAG MUNDARI LETTER O|7P|7L|7Y|7NG|6A|7J|7B|7NY|7H|6I|7S|7DD|7T|7H|6U|7C|7D|7K|7R|6E|7NN|7G|7M|7N|7TT|7LL|/SIGN OJOD|4MUHOR|4TOYOR|4IKIR|4SUTUH|/DIGIT ZERO|5ONE|5TWO|6HREE|5FOUR|6IVE|5SIX|6EVEN|5EIGHT|5NINE|#OL ONAL LETTER O|3M|3NG|3RR|3O|3Y|2A|3D|3B|3H|3L|3W|2I|3T|3P|3TT|3D|3N|2U|3K|3DD|3J|3NY|3R|2E|3S|3H|3C|3NN|3G|+SIGN MU|0IKIR|0HODDOND|+DIGIT ZERO|1ONE|1TWO|2HREE|1FOUR|2IVE|1SIX|2EVEN|1EIGHT|1NINE|+ABBREVIATION SIGN|#TAI YO LETTER LOW KO|1HIGH KO|1LOW KHO|1HIGH KHO|1GO|1NGO|1CO|1LOW XO|1HIGH XO|1LOW NYO|1HIGH NYO|1DO|1LOW TO|1HIGH TO|1THO|1NO|1BO|1LOW PO|1HIGH PO|1PHO|1LOW FO|1HIGH FO|1MO|1YO|1LO|1VO|1LOW HO|1HIGH HO|1QO|1LOW KVO|1HIGH KVO|1AA|1I|1UE|*SIGN UE|*LETTER U|1AE|*SIGN AU|*LETTER O|1E|1IA|1UEA|2A|1OO|1AUE|*SIGN AY|0NG|*LETTER AN|2M|2K|2T|2P|*SIGN OM|+YMBOL MUEANG|*XAM LAI|#ETHIOPIC SYLLABLE HHYA|8U|8I|8AA|8EE|9|8O|5GURAGE HHWA|5HHWI|8EE|9|5GURAGE MWI|>EE|<QWI|>EE|?|<BWI|>EE|<KWI|>EE|?|<GWI|>EE|?|<FWI|>EE|<PWI|>EE|#MENDE KIKAKUI SYLLABLE M001 KI|=2 KA|=3 KU|<65 KEE|<95 KE|<76 KOO|<48 KO|;179 KUA|;004 WI|=5 WA|=6 WU|;126 WEE|<18 WE|=4 WOO|;045 WO|;194 WUI|<43 WEI|;061 WVI|<49 WVA|;139 WVE|;007 MIN|=8 MAN|=9 MUN|<59 MEN|<94 MON|;154 MUAN|<89 MUEN|;010 BI|=1 BA|=2 BU|;150 BEE|;097 BE|;103 BOO|<38 BO|;013 I|=4 A|=5 U|;163 EE|<00 E|<65 OO|<47 O|<37 EI|=1 IN|=5 IN|<95 AN|<78 EN|;019 SI|<20 SA|=1 SU|;162 SEE|<16 SE|<36 SOO|;079 SO|;196 SIA|;025 LI|=6 LA|=7 LU|<84 LEE|<73 LE|<54 LOO|;153 LO|<10 LONG LE|;016 DI|=7 DA|=8 DU|<89 DEE|;180 DOO|=1 DO|;022 TI|=3 TA|=4 TU|<91 TEE|<55 TE|;104 TOO|;069 TO|<28 JI|=9 JA|<30 JU|;157 JEE|<13 JE|<60 JOO|;063 JO|;175 LONG JO|;031 YI|=2 YA|=3 YU|;109 YEE|;080 YE|;141 YOO|<21 YO|;034 FI|=5 FA|=6 FU|<78 FEE|=5 FE|;133 FOO|;088 FO|;197 FUA|<01 FAN|;037 NIN|=8 NAN|=9 NUN|;117 NEN|<69 NON|<76 HI|;041 HA|;186 HU|;040 HEE|<96 HE|<42 HOO|;140 HO|;083 HEEI|;128 HOOU|;053 HIN|;130 HAN|;087 HUN|<52 HEN|;193 HON|;046 HUAN|<90 NGGI|<43 NGGA|<82 NGGU|;115 NGGEE|<46 NGGE|<56 NGGOO|<20 NGGO|<59 NGGAA|<27 NGGUA|;086 LONG NGGE|;106 LONG NGGOO|<83 LONG NGGO|<55 GI|<11 GA|<68 GU|<90 GEE|<66 GUEI|=7 GUAN|<84 NGEN|;057 NGON|;177 NGUAN|;068 PI|<99 PA|<50 PU|<81 PEE|<51 PE|;102 POO|;066 PO|;145 MBI|;062 MBA|;122 MBU|;047 MBEE|;188 MBEE|;072 MBE|;172 MBOO|=4 MBO|<87 MBUU|<61 LONG MBE|<05 LONG MBOO|<42 LONG MBO|<32 KPI|;092 KPA|<74 KPU|<44 KPEE|;108 KPE|<12 KPOO|<58 KPO|<24 GBI|;056 GBA|;148 GBU|;093 GBEE|;107 GBE|;071 GBOO|=0 GBO|;171 RA|<23 NDI|=9 NDA|=5 NDU|<91 NDEE|<19 NDE|;067 NDOO|=4 NDO|;152 NJA|<92 NJU|<49 NJEE|<34 NJOO|<82 VI|=5 VA|<51 VU|<73 VEE|;085 VE|;144 VOO|;077 VO|;164 NYIN|;058 NYAN|;170 NYUN|;098 NYEN|<60 NYON|1DIGIT ONE|7TWO|8HREE|7FOUR|8IVE|7SIX|8EVEN|7EIGHT|7NINE|1COMBINING NUMBER TEENS|DNS|BHUNDREDS|BTHOUSANDS|CEN THOUSANDS|BHUNDRED THOUSANDS|BMILLIONS|#ADLAM CAPITAL LETTER ALIF|8DAALI|8LAAM|8MIIM|8BA|8SINNYIIYHE|8PE|8BHE|8RA|8E|8FA|8I|8O|8DHA|8YHE|8WAW|8NUN|8KAF|8YA|8U|8JIIM|8CHI|8HA|8QAAF|8GA|8NYA|8TU|8NHA|8VA|8KHA|8GBE|8ZAL|8KPO|8SHA|)SMALL LETTER ALIF|6DAALI|6LAAM|6MIIM|6BA|6SINNYIIYHE|6PE|6BHE|6RA|6E|6FA|6I|6O|6DHA|6YHE|6WAW|6NUN|6KAF|6YA|6U|6JIIM|6CHI|6HA|6QAAF|6GA|6NYA|6TU|6NHA|6VA|6KHA|6GBE|6ZAL|6KPO|6SHA|)ALIF LENGTHENER|)VOWEL LENGTHENER|)GEMINATION MARK|)HAMZA|)CONSONANT MODIFIER|)GEMINATE CONSONANT MODIFIER|)NUKTA|*ASALIZATION MARK|)DIGIT ZERO|/ONE|/TWO|0HREE|/FOUR|0IVE|/SIX|0EVEN|/EIGHT|/NINE|)INITIAL EXCLAMATION MARK|1QUESTION MARK|#INDIC SIYAQ NUMBER ONE|6TWO|7HREE|6FOUR|7IVE|6SIX|7EVEN|6EIGHT|6NINE|6TEN|7WENTY|7HIRTY|6FORTY|7IFTY|6SIXTY|7EVENTY|6EIGHTY|6NINETY|6ONE HUNDRED|6TWO HUNDRED|7HREE HUNDRED|6FOUR HUNDRED|7IVE HUNDRED|6SIX HUNDRED|7EVEN HUNDRED|6EIGHT HUNDRED|6NINE HUNDRED|6ONE THOUSAND|6TWO THOUSAND|7HREE THOUSAND|6FOUR THOUSAND|7IVE THOUSAND|6SIX THOUSAND|7EVEN THOUSAND|6EIGHT THOUSAND|6NINE THOUSAND|6TEN THOUSAND|7WENTY THOUSAND|7HIRTY THOUSAND|6FORTY THOUSAND|7IFTY THOUSAND|6SIXTY THOUSAND|7EVENTY THOUSAND|6EIGHTY THOUSAND|6NINETY THOUSAND|6LAKH|:AN|/LAKH MARK|/NUMBER KAROR|;AN|6PREFIXED ONE|?TWO|@HREE|?FOUR|@IVE|?SIX|@EVEN|?EIGHT|?NINE|/PLACEHOLDER|/FRACTION ONE QUARTER|<HALF|8THREE QUARTERS|/RUPEE MARK|/NUMBER ALTERNATE ONE|@TWO|AEN THOUSAND|/ALTERNATE LAKH MARK|#OTTOMAN SIYAQ NUMBER ONE|8TWO|9HREE|8FOUR|9IVE|8SIX|9EVEN|8EIGHT|8NINE|8TEN|9WENTY|9HIRTY|8FORTY|9IFTY|8SIXTY|9EVENTY|8EIGHTY|8NINETY|8ONE HUNDRED|8TWO HUNDRED|9HREE HUNDRED|8FOUR HUNDRED|9IVE HUNDRED|8SIX HUNDRED|9EVEN HUNDRED|8EIGHT HUNDRED|8NINE HUNDRED|8ONE THOUSAND|8TWO THOUSAND|9HREE THOUSAND|8FOUR THOUSAND|9IVE THOUSAND|8SIX THOUSAND|9EVEN THOUSAND|8EIGHT THOUSAND|8NINE THOUSAND|8TEN THOUSAND|9WENTY THOUSAND|9HIRTY THOUSAND|8FORTY THOUSAND|9IFTY THOUSAND|8SIXTY THOUSAND|9EVENTY THOUSAND|8EIGHTY THOUSAND|8NINETY THOUSAND|1MARRATAN|1ALTERNATE NUMBER TWO|CHREE|BFOUR|CIVE|BSIX|CEVEN|BEIGHT|BNINE|BTEN|BFOUR HUNDRED|BSIX HUNDRED|BTWO THOUSAND|CEN THOUSAND|1FRACTION ONE HALF|>SIXTH|#ARABIC MATHEMATICAL ALEF|7BEH|7JEEM|7DAL|7WAW|7ZAIN|7HAH|7TAH|7YEH|7KAF|7LAM|7MEEM|7NOON|7SEEN|7AIN|7FEH|7SAD|7QAF|7REH|7SHEEN|7TEH|8HEH|7KHAH|7THAL|7DAD|7ZAH|7GHAIN|7DOTLESS BEH|?NOON|?FEH|?QAF|7INITIAL BEH|?JEEM|?HEH|@AH|?YEH|?KAF|?LAM|?MEEM|?NOON|?SEEN|?AIN|?FEH|?SAD|?QAF|?SHEEN|?TEH|@HEH|?KHAH|?DAD|?GHAIN|7TAILED JEEM|>HAH|>YEH|>LAM|>NOON|>SEEN|>AIN|>SAD|>QAF|>SHEEN|>KHAH|>DAD|>GHAIN|>DOTLESS NOON|FQAF|7STRETCHED BEH|AJEEM|AHEH|BAH|ATAH|AYEH|AKAF|AMEEM|ANOON|ASEEN|AAIN|AFEH|ASAD|AQAF|ASHEEN|ATEH|BHEH|AKHAH|ADAD|AZAH|AGHAIN|ADOTLESS BEH|IFEH|7LOOPED ALEF|>BEH|>JEEM|>DAL|>HEH|>WAW|>ZAIN|>HAH|>TAH|>YEH|>LAM|>MEEM|>NOON|>SEEN|>AIN|>FEH|>SAD|>QAF|>REH|>SHEEN|>TEH|?HEH|>KHAH|>THAL|>DAD|>ZAH|>GHAIN|7DOUBLE-STRUCK BEH|EJEEM|EDAL|EWAW|EZAIN|EHAH|ETAH|EYEH|ELAM|EMEEM|ENOON|ESEEN|EAIN|EFEH|ESAD|EQAF|EREH|ESHEEN|ETEH|FHEH|EKHAH|ETHAL|EDAD|EZAH|EGHAIN|7OPERATOR MEEM WITH HAH WITH TATWEEL|@HAH WITH DAL|#MAHJONG TILE EAST WIND|0SOUTH WIND|0WEST WIND|0NORTH WIND|0RED DRAGON|0GREEN DRAGON|0WHITE DRAGON|0ONE OF CHARACTERS|0TWO OF CHARACTERS|1HREE OF CHARACTERS|0FOUR OF CHARACTERS|1IVE OF CHARACTERS|0SIX OF CHARACTERS|1EVEN OF CHARACTERS|0EIGHT OF CHARACTERS|0NINE OF CHARACTERS|0ONE OF BAMBOOS|0TWO OF BAMBOOS|1HREE OF BAMBOOS|0FOUR OF BAMBOOS|1IVE OF BAMBOOS|0SIX OF BAMBOOS|1EVEN OF BAMBOOS|0EIGHT OF BAMBOOS|0NINE OF BAMBOOS|0ONE OF CIRCLES|0TWO OF CIRCLES|1HREE OF CIRCLES|0FOUR OF CIRCLES|1IVE OF CIRCLES|0SIX OF CIRCLES|1EVEN OF CIRCLES|0EIGHT OF CIRCLES|0NINE OF CIRCLES|0PLUM|0ORCHID|0BAMBOO|0CHRYSANTHEMUM|0SPRING|1UMMER|0AUTUMN|0WINTER|0JOKER|0BACK|#DOMINO TILE HORIZONTAL BACK|9-00-00|>1|>2|>3|>4|>5|>6|;1-00|>1|>2|>3|>4|>5|>6|;2-00|>1|>2|>3|>4|>5|>6|;3-00|>1|>2|>3|>4|>5|>6|;4-00|>1|>2|>3|>4|>5|>6|;5-00|>1|>2|>3|>4|>5|>6|;6-00|>1|>2|>3|>4|>5|>6|/VERTICAL BACK|7-00-00|<1|<2|<3|<4|<5|<6|91-00|<1|<2|<3|<4|<5|<6|92-00|<1|<2|<3|<4|<5|<6|93-00|<1|<2|<3|<4|<5|<6|94-00|<1|<2|<3|<4|<5|<6|95-00|<1|<2|<3|<4|<5|<6|96-00|<1|<2|<3|<4|<5|<6|#PLAYING CARD BACK|0ACE OF SPADES|0TWO OF SPADES|1HREE OF SPADES|0FOUR OF SPADES|1IVE OF SPADES|0SIX OF SPADES|1EVEN OF SPADES|0EIGHT OF SPADES|0NINE OF SPADES|0TEN OF SPADES|0JACK OF SPADES|0KNIGHT OF SPADES|0QUEEN OF SPADES|0KING OF SPADES|0ACE OF HEARTS|0TWO OF HEARTS|1HREE OF HEARTS|0FOUR OF HEARTS|1IVE OF HEARTS|0SIX OF HEARTS|1EVEN OF HEARTS|0EIGHT OF HEARTS|0NINE OF HEARTS|0TEN OF HEARTS|0JACK OF HEARTS|0KNIGHT OF HEARTS|0QUEEN OF HEARTS|0KING OF HEARTS|0RED JOKER|0ACE OF DIAMONDS|0TWO OF DIAMONDS|1HREE OF DIAMONDS|0FOUR OF DIAMONDS|1IVE OF DIAMONDS|0SIX OF DIAMONDS|1EVEN OF DIAMONDS|0EIGHT OF DIAMONDS|0NINE OF DIAMONDS|0TEN OF DIAMONDS|0JACK OF DIAMONDS|0KNIGHT OF DIAMONDS|0QUEEN OF DIAMONDS|0KING OF DIAMONDS|0BLACK JOKER|0ACE OF CLUBS|0TWO OF CLUBS|1HREE OF CLUBS|0FOUR OF CLUBS|1IVE OF CLUBS|0SIX OF CLUBS|1EVEN OF CLUBS|0EIGHT OF CLUBS|0NINE OF CLUBS|0TEN OF CLUBS|0JACK OF CLUBS|0KNIGHT OF CLUBS|0QUEEN OF CLUBS|0KING OF CLUBS|0WHITE JOKER|0FOOL|0TRUMP-1|62|63|64|65|66|67|68|69|610|71|72|73|74|75|76|77|78|79|620|71|#DIGIT ZERO FULL STOP|.COMMA|)ONE COMMA|)TWO COMMA|*HREE COMMA|)FOUR COMMA|*IVE COMMA|)SIX COMMA|*EVEN COMMA|)EIGHT COMMA|)NINE COMMA|%NGBAT CIRCLED SANS-SERIF DIGIT ZERO|+NEGATIVE CIRCLED SANS-SERIF DIGIT ZERO|#CIRCLED ZERO WITH SLASH|+ANTICLOCKWISE ARROW|+DOLLAR SIGN WITH OVERLAID BACKSLASH|#PARENTHESIZED LATIN CAPITAL LETTER A|FB|FC|FD|FE|FF|FG|FH|FI|FJ|FK|FL|FM|FN|FO|FP|FQ|FR|FS|FT|FU|FV|FW|FX|FY|FZ|#TORTOISE SHELL BRACKETED LATIN CAPITAL LETTER S|#CIRCLED ITALIC LATIN CAPITAL LETTER C|GR|+CD|+WZ|$OPYLEFT SYMBOL|#SQUARED LATIN CAPITAL LETTER A|@B|@C|@D|@E|@F|@G|@H|@I|@J|@K|@L|@M|@N|@O|@P|@Q|@R|@S|@T|@U|@V|@W|@X|@Y|@Z|+HV|+MV|+SD|,S|+PPV|+WC|#NEGATIVE CIRCLED LATIN CAPITAL LETTER A|IB|IC|ID|IE|IF|IG|IH|II|IJ|IK|IL|IM|IN|IO|IP|IQ|IR|IS|IT|IU|IV|IW|IX|IY|IZ|#RAISED MC SIGN|+D SIGN|+R SIGN|#CIRCLED CC|, WITH OVERLAID BACKSLASH|+HUMAN FIGURE|#NEGATIVE SQUARED LATIN CAPITAL LETTER A|IB|IC|ID|IE|IF|IG|IH|II|IJ|IK|IL|IM|IN|IO|IP|IQ|IR|IS|IT|IU|IV|IW|IX|IY|IZ|#CROSSED NEGATIVE SQUARED LATIN CAPITAL LETTER P|#NEGATIVE SQUARED IC|4PA|4SA|4AB|4WC|#SQUARE DJ|)D CL|,OOL|+FREE|+ID|+NEW|,G|+OK|+SOS|+UP WITH EXCLAMATION MARK|+VS|+THREE D|+SECOND SCREEN|+TWO K|+FOUR K|+EIGHT K|+FIVE POINT ONE|+SEVEN POINT ONE|+TWENTY-TWO POINT TWO|+SIXTY P|+ONE HUNDRED TWENTY P|+LATIN SMALL LETTER D|+HC|,DR|,I-RES|+LOSSLESS|+SHV|+UHD|+VOD|#MASK WORK SYMBOL|#TOMOBIKI SYMBOL|#REGIONAL INDICATOR SYMBOL LETTER A|DB|DC|DD|DE|DF|DG|DH|DI|DJ|DK|DL|DM|DN|DO|DP|DQ|DR|DS|DT|DU|DV|DW|DX|DY|DZ|#SQUARE HIRAGANA HOKA|)D KATAKANA KOKO|4SA|+CJK UNIFIED IDEOGRAPH-624B|A5B57|B3CC|+KATAKANA DE|+CJK UNIFIED IDEOGRAPH-4E8C|A591A|A89E3|A5929|A4EA4|A6620|A7121|A6599|A524D|BF8C|B18D|A65B0|A521D|A7D42|B51F|A8CA9|A58F0|B439|A6F14|B295|B355|A4E00|D9|A904A|A5DE6|A4E2D|A53F3|A6307|A8D70|A6253|A7981|BA7A|A5408|A6E80|B709|D8|A7533|A5272|B5B6|A914D|#TORTOISE SHELL BRACKETED CJK UNIFIED IDEOGRAPH-672C|R4E09|T8C|R5B89|R70B9|R6253|R76D7|R52DD|R6557|#CIRCLED IDEOGRAPH ADVANTAGE|6CCEPT|#ROUNDED SYMBOL FOR FU|6LU|6SHOU|6XI|6SHUANGXI|6CAI|#CYCLONE|#FOGGY|#CLOSED UMBRELLA|#NIGHT WITH STARS|#SUNRISE OVER MOUNTAINS|*|#CITYSCAPE AT DUSK|#SUNSET OVER BUILDINGS|#RAINBOW|#BRIDGE AT NIGHT|#WATER WAVE|#VOLCANO|#MILKY WAY|#EARTH GLOBE EUROPE-AFRICA|/AMERICAS|0SIA-AUSTRALIA|#GLOBE WITH MERIDIANS|#NEW MOON SYMBOL|#WAXING CRESCENT MOON SYMBOL|#FIRST QUARTER MOON SYMBOL|#WAXING GIBBOUS MOON SYMBOL|#FULL MOON SYMBOL|#WANING GIBBOUS MOON SYMBOL|#LAST QUARTER MOON SYMBOL|#WANING CRESCENT MOON SYMBOL|#CRESCENT MOON|#NEW MOON WITH FACE|#FIRST QUARTER MOON WITH FACE|#LAST QUARTER MOON WITH FACE|#FULL MOON WITH FACE|#SUN WITH FACE|#GLOWING STAR|#SHOOTING STAR|#THERMOMETER|#BLACK DROPLET|#WHITE SUN|, WITH SMALL CLOUD|-BEHIND CLOUD|9 WITH RAIN|#CLOUD WITH RAIN|.SNOW|.LIGHTNING|.TORNADO|#FOG|#WIND BLOWING FACE|#HOT DOG|#TACO|#BURRITO|#CHESTNUT|#SEEDLING|#EVERGREEN TREE|#DECIDUOUS TREE|#PALM TREE|#CACTUS|#HOT PEPPER|#TULIP|#CHERRY BLOSSOM|#ROSE|#HIBISCUS|#SUNFLOWER|#BLOSSOM|#EAR OF MAIZE|*RICE|#HERB|#FOUR LEAF CLOVER|#MAPLE LEAF|#FALLEN LEAF|#LEAF FLUTTERING IN WIND|#MUSHROOM|#TOMATO|#AUBERGINE|#GRAPES|#MELON|#WATERMELON|#TANGERINE|#LEMON|#BANANA|#PINEAPPLE|#RED APPLE|#GREEN APPLE|#PEAR|&CH|#CHERRIES|#STRAWBERRY|#HAMBURGER|#SLICE OF PIZZA|#MEAT ON BONE|#POULTRY LEG|#RICE CRACKER|(BALL|#COOKED RICE|$URRY AND RICE|#STEAMING BOWL|$PAGHETTI|#BREAD|#FRENCH FRIES|#ROASTED SWEET POTATO|#DANGO|#ODEN|#SUSHI|#FRIED SHRIMP|$ISH CAKE WITH SWIRL DESIGN|#SOFT ICE CREAM|$HAVED ICE|#ICE CREAM|#DOUGHNUT|#COOKIE|$HOCOLATE BAR|$ANDY|#LOLLIPOP|#CUSTARD|#HONEY POT|#SHORTCAKE|#BENTO BOX|#POT OF FOOD|#COOKING|#FORK AND KNIFE|#TEACUP WITHOUT HANDLE|#SAKE BOTTLE AND CUP|#WINE GLASS|#COCKTAIL GLASS|#TROPICAL DRINK|#BEER MUG|#CLINKING BEER MUGS|#BABY BOTTLE|#FORK AND KNIFE WITH PLATE|#BOTTLE WITH POPPING CORK|#POPCORN|#RIBBON|#WRAPPED PRESENT|#BIRTHDAY CAKE|#JACK-O-LANTERN|#CHRISTMAS TREE|#FATHER CHRISTMAS|$IREWORKS|+ SPARKLER|#BALLOON|#PARTY POPPER|#CONFETTI BALL|#TANABATA TREE|#CROSSED FLAGS|#PINE DECORATION|#JAPANESE DOLLS|#CARP STREAMER|#WIND CHIME|#MOON VIEWING CEREMONY|#SCHOOL SATCHEL|#GRADUATION CAP|#HEART WITH TIP ON THE LEFT|#BOUQUET OF FLOWERS|#MILITARY MEDAL|#REMINDER RIBBON|#MUSICAL KEYBOARD WITH JACKS|#STUDIO MICROPHONE|#LEVEL SLIDER|#CONTROL KNOBS|#BEAMED ASCENDING MUSICAL NOTES|*DESCENDING MUSICAL NOTES|#FILM FRAMES|#ADMISSION TICKETS|#CAROUSEL HORSE|#FERRIS WHEEL|#ROLLER COASTER|#FISHING POLE AND FISH|#MICROPHONE|$OVIE CAMERA|#CINEMA|#HEADPHONE|#ARTIST PALETTE|#TOP HAT|#CIRCUS TENT|#TICKET|#CLAPPER BOARD|#PERFORMING ARTS|#VIDEO GAME|#DIRECT HIT|#SLOT MACHINE|#BILLIARDS|#GAME DIE|#BOWLING|#FLOWER PLAYING CARDS|#MUSICAL NOTE|%LTIPLE MUSICAL NOTES|#SAXOPHONE|#GUITAR|#MUSICAL KEYBOARD|#TRUMPET|#VIOLIN|#MUSICAL SCORE|#RUNNING SHIRT WITH SASH|#TENNIS RACQUET AND BALL|#SKI AND SKI BOOT|#BASKETBALL AND HOOP|#CHEQUERED FLAG|#SNOWBOARDER|#RUNNER|#SURFER|$PORTS MEDAL|#TROPHY|#HORSE RACING|#AMERICAN FOOTBALL|#RUGBY FOOTBALL|#SWIMMER|#WEIGHT LIFTER|#GOLFER|#RACING MOTORCYCLE|*CAR|#CRICKET BAT AND BALL|#VOLLEYBALL|#FIELD HOCKEY STICK AND BALL|#ICE HOCKEY STICK AND PUCK|#TABLE TENNIS PADDLE AND BALL|#SNOW CAPPED MOUNTAIN|#CAMPING|#BEACH WITH UMBRELLA|$UILDING CONSTRUCTION|#HOUSE BUILDINGS|#CITYSCAPE|#DERELICT HOUSE BUILDING|#CLASSICAL BUILDING|#DESERT|) ISLAND|#NATIONAL PARK|#STADIUM|#HOUSE BUILDING|)WITH GARDEN|#OFFICE BUILDING|#JAPANESE POST OFFICE|#EUROPEAN POST OFFICE|#HOSPITAL|#BANK|#AUTOMATED TELLER MACHINE|#HOTEL|#LOVE HOTEL|#CONVENIENCE STORE|#SCHOOL|#DEPARTMENT STORE|#FACTORY|#IZAKAYA LANTERN|#JAPANESE CASTLE|#EUROPEAN CASTLE|#WHITE PENNANT|#BLACK PENNANT|#WAVING WHITE FLAG|*BLACK FLAG|#ROSETTE|#BLACK ROSETTE|#LABEL|#BADMINTON RACQUET AND SHUTTLECOCK|$OW AND ARROW|#AMPHORA|#EMOJI MODIFIER FITZPATRICK TYPE-1-2|C3|C4|C5|C6|#RAT|#MOUSE|#OX|#WATER BUFFALO|#COW|#TIGER|#LEOPARD|#RABBIT|#CAT|#DRAGON|#CROCODILE|#WHALE|#SNAIL|&KE|#HORSE|#RAM|#GOAT|#SHEEP|#MONKEY|#ROOSTER|#CHICKEN|#DOG|#PIG|#BOAR|#ELEPHANT|#OCTOPUS|#SPIRAL SHELL|#BUG|#ANT|#HONEYBEE|#LADY BEETLE|#FISH|#TROPICAL FISH|#BLOWFISH|#TURTLE|#HATCHING CHICK|#BABY CHICK|#FRONT-FACING BABY CHICK|#BIRD|#PENGUIN|#KOALA|#POODLE|#DROMEDARY CAMEL|#BACTRIAN CAMEL|#DOLPHIN|#MOUSE FACE|#COW FACE|#TIGER FACE|#RABBIT FACE|#CAT FACE|#DRAGON FACE|#SPOUTING WHALE|#HORSE FACE|#MONKEY FACE|#DOG FACE|#PIG FACE|#FROG FACE|#HAMSTER FACE|#WOLF FACE|#BEAR FACE|#PANDA FACE|$IG NOSE|$AW PRINTS|#CHIPMUNK|#EYES|&|$AR|#NOSE|#MOUTH|#TONGUE|#WHITE UP POINTING BACKHAND INDEX|)DOWN POINTING BACKHAND INDEX|)LEFT POINTING BACKHAND INDEX|)RIGHT POINTING BACKHAND INDEX|#FISTED HAND SIGN|#WAVING HAND SIGN|#OK HAND SIGN|#THUMBS UP SIGN|*DOWN SIGN|#CLAPPING HANDS SIGN|#OPEN HANDS SIGN|#CROWN|#WOMANS HAT|#EYEGLASSES|#NECKTIE|#T-SHIRT|#JEANS|#DRESS|#KIMONO|#BIKINI|#WOMANS CLOTHES|#PURSE|#HANDBAG|#POUCH|#MANS SHOE|#ATHLETIC SHOE|#HIGH-HEELED SHOE|#WOMANS SANDAL|*BOOTS|#FOOTPRINTS|#BUST IN SILHOUETTE|'S IN SILHOUETTE|$OY|#GIRL|#MAN|#WOMAN|#FAMILY|#MAN AND WOMAN HOLDING HANDS|#TWO MEN HOLDING HANDS|'WOMEN HOLDING HANDS|#POLICE OFFICER|#WOMAN WITH BUNNY EARS|#BRIDE WITH VEIL|#PERSON WITH BLOND HAIR|#MAN WITH GUA PI MAO|,TURBAN|#OLDER MAN|)WOMAN|#BABY|#CONSTRUCTION WORKER|#PRINCESS|#JAPANESE OGRE|,GOBLIN|#GHOST|#BABY ANGEL|#EXTRATERRESTRIAL ALIEN|#ALIEN MONSTER|#IMP|#SKULL|#INFORMATION DESK PERSON|#GUARDSMAN|#DANCER|#LIPSTICK|#NAIL POLISH|#FACE MASSAGE|#HAIRCUT|#BARBER POLE|#SYRINGE|#PILL|#KISS MARK|#LOVE LETTER|#RING|#GEM STONE|#KISS|#BOUQUET|#COUPLE WITH HEART|#WEDDING|#BEATING HEART|$ROKEN HEART|#TWO HEARTS|#SPARKLING HEART|#GROWING HEART|#HEART WITH ARROW|#BLUE HEART|#GREEN HEART|#YELLOW HEART|#PURPLE HEART|#HEART WITH RIBBON|#REVOLVING HEARTS|#HEART DECORATION|#DIAMOND SHAPE WITH A DOT INSIDE|#ELECTRIC LIGHT BULB|#ANGER SYMBOL|#BOMB|#SLEEPING SYMBOL|#COLLISION SYMBOL|#SPLASHING SWEAT SYMBOL|#DROPLET|$ASH SYMBOL|#PILE OF POO|#FLEXED BICEPS|#DIZZY SYMBOL|#SPEECH BALLOON|#THOUGHT BALLOON|#WHITE FLOWER|#HUNDRED POINTS SYMBOL|#MONEY BAG|#CURRENCY EXCHANGE|#HEAVY DOLLAR SIGN|#CREDIT CARD|#BANKNOTE WITH YEN SIGN|1DOLLAR SIGN|1EURO SIGN|1POUND SIGN|#MONEY WITH WINGS|#CHART WITH UPWARDS TREND AND YEN SIGN|#SEAT|#PERSONAL COMPUTER|#BRIEFCASE|#MINIDISC|#FLOPPY DISK|#OPTICAL DISC|#DVD|#FILE FOLDER|#OPEN FILE FOLDER|#PAGE WITH CURL|(FACING UP|#CALENDAR|#TEAR-OFF CALENDAR|#CARD INDEX|$HART WITH UPWARDS TREND|.DOWNWARDS TREND|#BAR CHART|#CLIPBOARD|#PUSHPIN|#ROUND PUSHPIN|#PAPERCLIP|#STRAIGHT RULER|#TRIANGULAR RULER|#BOOKMARK TABS|#LEDGER|#NOTEBOOK|+ WITH DECORATIVE COVER|#CLOSED BOOK|#OPEN BOOK|#GREEN BOOK|#BLUE BOOK|#ORANGE BOOK|#BOOKS|#NAME BADGE|#SCROLL|#MEMO|#TELEPHONE RECEIVER|#PAGER|#FAX MACHINE|#SATELLITE ANTENNA|#PUBLIC ADDRESS LOUDSPEAKER|#CHEERING MEGAPHONE|#OUTBOX TRAY|#INBOX TRAY|#PACKAGE|#E-MAIL SYMBOL|#INCOMING ENVELOPE|#ENVELOPE WITH DOWNWARDS ARROW ABOVE|#CLOSED MAILBOX WITH LOWERED FLAG|7RAISED FLAG|#OPEN MAILBOX WITH RAISED FLAG|5LOWERED FLAG|#POSTBOX|'AL HORN|#NEWSPAPER|#MOBILE PHONE|/ WITH RIGHTWARDS ARROW AT LEFT|#VIBRATION MODE|#MOBILE PHONE OFF|#NO MOBILE PHONES|#ANTENNA WITH BARS|#CAMERA|) WITH FLASH|#VIDEO CAMERA|#TELEVISION|#RADIO|#VIDEOCASSETTE|#FILM PROJECTOR|#PORTABLE STEREO|$RAYER BEADS|#TWISTED RIGHTWARDS ARROWS|#CLOCKWISE RIGHTWARDS AND LEFTWARDS OPEN CIRCLE ARROWS|X WITH CIRCLED ONE OVERLAY|-DOWNWARDS AND UPWARDS OPEN CIRCLE ARROWS|#ANTICLOCKWISE DOWNWARDS AND UPWARDS OPEN CIRCLE ARROWS|#LOW BRIGHTNESS SYMBOL|#HIGH BRIGHTNESS SYMBOL|#SPEAKER WITH CANCELLATION STROKE|*|* WITH ONE SOUND WAVE|0THREE SOUND WAVES|#BATTERY|#ELECTRIC PLUG|#LEFT-POINTING MAGNIFYING GLASS|#RIGHT-POINTING MAGNIFYING GLASS|#LOCK WITH INK PEN|#CLOSED LOCK WITH KEY|#KEY|#LOCK|#OPEN LOCK|#BELL|' WITH CANCELLATION STROKE|$OOKMARK|#LINK SYMBOL|#RADIO BUTTON|#BACK WITH LEFTWARDS ARROW ABOVE|#END WITH LEFTWARDS ARROW ABOVE|#ON WITH EXCLAMATION MARK WITH LEFT RIGHT ARROW ABOVE|#SOON WITH RIGHTWARDS ARROW ABOVE|#TOP WITH UPWARDS ARROW ABOVE|#NO ONE UNDER EIGHTEEN SYMBOL|#KEYCAP TEN|#INPUT SYMBOL FOR LATIN CAPITAL LETTERS|:SMALL LETTERS|4NUMBERS|4SYMBOLS|4LATIN LETTERS|#FIRE|#ELECTRIC TORCH|#WRENCH|#HAMMER|#NUT AND BOLT|#HOCHO|#PISTOL|#MICROSCOPE|#TELESCOPE|#CRYSTAL BALL|#SIX POINTED STAR WITH MIDDLE DOT|#JAPANESE SYMBOL FOR BEGINNER|#TRIDENT EMBLEM|#BLACK SQUARE BUTTON|#WHITE SQUARE BUTTON|#LARGE RED CIRCLE|)BLUE CIRCLE|)ORANGE DIAMOND|)BLUE DIAMOND|#SMALL ORANGE DIAMOND|)BLUE DIAMOND|#UP-POINTING RED TRIANGLE|#DOWN-POINTING RED TRIANGLE|#UP-POINTING SMALL RED TRIANGLE|#DOWN-POINTING SMALL RED TRIANGLE|#LOWER RIGHT SHADOWED WHITE CIRCLE|#UPPER RIGHT SHADOWED WHITE CIRCLE|#CIRCLED CROSS POMMEE|$ROSS POMMEE WITH HALF-CIRCLE BELOW|/|#NOTCHED LEFT SEMICIRCLE WITH THREE DOTS|+RIGHT SEMICIRCLE WITH THREE DOTS|#SYMBOL FOR MARKS CHAPTER|#WHITE LATIN CROSS|#HEAVY LATIN CROSS|#CELTIC CROSS|#OM SYMBOL|#DOVE OF PEACE|#KAABA|#MOSQUE|#SYNAGOGUE|#MENORAH WITH NINE BRANCHES|#BOWL OF HYGIEIA|#CLOCK FACE ONE OCLOCK|.TWO OCLOCK|/HREE OCLOCK|.FOUR OCLOCK|/IVE OCLOCK|.SIX OCLOCK|/EVEN OCLOCK|.EIGHT OCLOCK|.NINE OCLOCK|.TEN OCLOCK|.ELEVEN OCLOCK|.TWELVE OCLOCK|.ONE-THIRTY|.TWO-THIRTY|/HREE-THIRTY|.FOUR-THIRTY|/IVE-THIRTY|.SIX-THIRTY|/EVEN-THIRTY|.EIGHT-THIRTY|.NINE-THIRTY|.TEN-THIRTY|.ELEVEN-THIRTY|.TWELVE-THIRTY|#RIGHT SPEAKER|0 WITH ONE SOUND WAVE|6THREE SOUND WAVES|#BULLHORN|+ WITH SOUND WAVES|#RINGING BELL|#BOOK|#CANDLE|#MANTELPIECE CLOCK|#BLACK SKULL AND CROSSBONES|#NO PIRACY|#HOLE|#MAN IN BUSINESS SUIT LEVITATING|#SLEUTH OR SPY|#DARK SUNGLASSES|#SPIDER|) WEB|#JOYSTICK|#MAN DANCING|#LEFT HAND TELEPHONE RECEIVER|#TELEPHONE RECEIVER WITH PAGE|#RIGHT HAND TELEPHONE RECEIVER|#WHITE TOUCHTONE TELEPHONE|#BLACK TOUCHTONE TELEPHONE|#TELEPHONE ON TOP OF MODEM|#CLAMSHELL MOBILE PHONE|#BACK OF ENVELOPE|#STAMPED ENVELOPE|#ENVELOPE WITH LIGHTNING|#FLYING ENVELOPE|#PEN OVER STAMPED ENVELOPE|#LINKED PAPERCLIPS|#BLACK PUSHPIN|#LOWER LEFT PENCIL|.BALLPOINT PEN|.FOUNTAIN PEN|.PAINTBRUSH|.CRAYON|$EFT WRITING HAND|#TURNED OK HAND SIGN|#RAISED HAND WITH FINGERS SPLAYED|$EVERSED RAISED HAND WITH FINGERS SPLAYED|,THUMBS UP SIGN|3DOWN SIGN|,VICTORY HAND|,HAND WITH MIDDLE FINGER EXTENDED|$AISED HAND WITH PART BETWEEN MIDDLE AND RING FINGERS|#WHITE DOWN POINTING LEFT HAND INDEX|#SIDEWAYS WHITE LEFT POINTING INDEX|2RIGHT POINTING INDEX|,BLACK LEFT POINTING INDEX|2RIGHT POINTING INDEX|#BLACK LEFT POINTING BACKHAND INDEX|)RIGHT POINTING BACKHAND INDEX|#SIDEWAYS WHITE UP POINTING INDEX|2DOWN POINTING INDEX|,BLACK UP POINTING INDEX|2DOWN POINTING INDEX|#BLACK UP POINTING BACKHAND INDEX|)DOWN POINTING BACKHAND INDEX|)HEART|#DESKTOP COMPUTER|#KEYBOARD AND MOUSE|#THREE NETWORKED COMPUTERS|#PRINTER|$OCKET CALCULATOR|#BLACK HARD SHELL FLOPPY DISK|#WHITE HARD SHELL FLOPPY DISK|#SOFT SHELL FLOPPY DISK|#TAPE CARTRIDGE|#WIRED KEYBOARD|#ONE BUTTON MOUSE|#TWO BUTTON MOUSE|$HREE BUTTON MOUSE|$RACKBALL|#OLD PERSONAL COMPUTER|#HARD DISK|#SCREEN|#PRINTER ICON|#FAX ICON|#OPTICAL DISC ICON|#DOCUMENT WITH TEXT|5 AND PICTURE|1PICTURE|#FRAME WITH PICTURE|.TILES|.AN X|#BLACK FOLDER|#FOLDER|#OPEN FOLDER|#CARD INDEX DIVIDERS|(FILE BOX|#FILE CABINET|#EMPTY NOTE|- PAGE|0D|#NOTE|' PAGE|*D|#EMPTY DOCUMENT|)PAGE|-S|#DOCUMENT|#PAGE|'S|#WASTEBASKET|#SPIRAL NOTE PAD|*CALENDAR PAD|#DESKTOP WINDOW|#MINIMIZE|$AXIMIZE|#OVERLAP|#CLOCKWISE RIGHT AND LEFT SEMICIRCLE ARROWS|$ANCELLATION X|#INCREASE FONT SIZE SYMBOL|#DECREASE FONT SIZE SYMBOL|#COMPRESSION|#OLD KEY|#ROLLED-UP NEWSPAPER|#PAGE WITH CIRCLED TEXT|#STOCK CHART|#DAGGER KNIFE|#LIPS|#SPEAKING HEAD IN SILHOUETTE|#THREE RAYS ABOVE|.BELOW|.LEFT|.RIGHT|#LEFT SPEECH BUBBLE|#RIGHT SPEECH BUBBLE|#TWO SPEECH BUBBLES|$HREE SPEECH BUBBLES|#LEFT THOUGHT BUBBLE|#RIGHT THOUGHT BUBBLE|#LEFT ANGER BUBBLE|#RIGHT ANGER BUBBLE|#MOOD BUBBLE|#LIGHTNING MOOD BUBBLE|1|#BALLOT BOX WITH BALLOT|*SCRIPT X|*BOX WITH SCRIPT X|,LD SCRIPT X|,X WITH BOLD SCRIPT X|#LIGHT CHECK MARK|#BALLOT BOX WITH BOLD CHECK|#WORLD MAP|#MOUNT FUJI|#TOKYO TOWER|#STATUE OF LIBERTY|$ILHOUETTE OF JAPAN|#MOYAI|#GRINNING FACE|0 WITH SMILING EYES|#FACE WITH TEARS OF JOY|#SMILING FACE WITH OPEN MOUTH|? AND SMILING EYES|DCOLD SWEAT|DTIGHTLY-CLOSED EYES|5HALO|6ORNS|#WINKING FACE|#SMILING FACE WITH SMILING EYES|#FACE SAVOURING DELICIOUS FOOD|#RELIEVED FACE|#SMILING FACE WITH HEART-SHAPED EYES|5SUNGLASSES|&RKING FACE|#NEUTRAL FACE|#EXPRESSIONLESS FACE|#UNAMUSED FACE|#FACE WITH COLD SWEAT|#PENSIVE FACE|#CONFUSED FACE|'OUNDED FACE|#KISSING FACE|#FACE THROWING A KISS|#KISSING FACE WITH SMILING EYES|5CLOSED EYES|#FACE WITH STUCK-OUT TONGUE|= AND WINKING EYE|BTIGHTLY-CLOSED EYES|#DISAPPOINTED FACE|#WORRIED FACE|#ANGRY FACE|#POUTING FACE|#CRYING FACE|#PERSEVERING FACE|#FACE WITH LOOK OF TRIUMPH|#DISAPPOINTED BUT RELIEVED FACE|#FROWNING FACE WITH OPEN MOUTH|#ANGUISHED FACE|#FEARFUL FACE|#WEARY FACE|#SLEEPY FACE|#TIRED FACE|#GRIMACING FACE|#LOUDLY CRYING FACE|#FACE WITH OPEN MOUTH|#HUSHED FACE|#FACE WITH OPEN MOUTH AND COLD SWEAT|(SCREAMING IN FEAR|#ASTONISHED FACE|#FLUSHED FACE|#SLEEPING FACE|#DIZZY FACE|#FACE WITHOUT MOUTH|, MEDICAL MASK|#GRINNING CAT FACE WITH SMILING EYES|#CAT FACE WITH TEARS OF JOY|#SMILING CAT FACE WITH OPEN MOUTH|9HEART-SHAPED EYES|#CAT FACE WITH WRY SMILE|#KISSING CAT FACE WITH CLOSED EYES|#POUTING CAT FACE|#CRYING CAT FACE|#WEARY CAT FACE|#SLIGHTLY FROWNING FACE|,SMILING FACE|#UPSIDE-DOWN FACE|#FACE WITH ROLLING EYES|-NO GOOD GESTURE|-OK GESTURE|#PERSON BOWING DEEPLY|#SEE-NO-EVIL MONKEY|#HEAR-NO-EVIL MONKEY|#SPEAK-NO-EVIL MONKEY|#HAPPY PERSON RAISING ONE HAND|#PERSON RAISING BOTH HANDS IN CELEBRATION|*FROWNING|*WITH POUTING FACE|/FOLDED HANDS|#NORTH WEST POINTING LEAF|#SOUTH WEST POINTING LEAF|#NORTH EAST POINTING LEAF|#SOUTH EAST POINTING LEAF|#TURNED NORTH WEST POINTING LEAF|*SOUTH WEST POINTING LEAF|*NORTH EAST POINTING LEAF|*SOUTH EAST POINTING LEAF|#NORTH WEST POINTING VINE LEAF|#SOUTH WEST POINTING VINE LEAF|#NORTH EAST POINTING VINE LEAF|#SOUTH EAST POINTING VINE LEAF|#HEAVY NORTH WEST POINTING VINE LEAF|)SOUTH WEST POINTING VINE LEAF|)NORTH EAST POINTING VINE LEAF|)SOUTH EAST POINTING VINE LEAF|#NORTH WEST POINTING BUD|#SOUTH WEST POINTING BUD|#NORTH EAST POINTING BUD|#SOUTH EAST POINTING BUD|#HEAVY NORTH WEST POINTING BUD|)SOUTH WEST POINTING BUD|)NORTH EAST POINTING BUD|)SOUTH EAST POINTING BUD|$OLLOW QUILT SQUARE ORNAMENT|? IN BLACK SQUARE|#SOLID QUILT SQUARE ORNAMENT|> IN BLACK SQUARE|#LEFTWARDS ROCKET|#UPWARDS ROCKET|#RIGHTWARDS ROCKET|#DOWNWARDS ROCKET|#SCRIPT LIGATURE ET ORNAMENT|#HEAVY SCRIPT LIGATURE ET ORNAMENT|#LIGATURE OPEN ET ORNAMENT|#HEAVY LIGATURE OPEN ET ORNAMENT|)AMPERSAND ORNAMENT|#SWASH AMPERSAND ORNAMENT|$ANS-SERIF HEAVY DOUBLE TURNED COMMA QUOTATION MARK ORNAMENT|;COMMA QUOTATION MARK ORNAMENT|4LOW DOUBLE COMMA QUOTATION MARK ORNAMENT|#HEAVY INTERROBANG ORNAMENT|#SANS-SERIF INTERROBANG ORNAMENT|#HEAVY SANS-SERIF INTERROBANG ORNAMENT|#VERY HEAVY SOLIDUS|.REVERSE SOLIDUS|#CHECKER BOARD|#REVERSE CHECKER BOARD|$OCKET|#HELICOPTER|#STEAM LOCOMOTIVE|#RAILWAY CAR|#HIGH-SPEED TRAIN|3 WITH BULLET NOSE|#TRAIN|#METRO|#LIGHT RAIL|#STATION|#TRAM|' CAR|#BUS|#ONCOMING BUS|#TROLLEYBUS|#BUS STOP|#MINIBUS|#AMBULANCE|#FIRE ENGINE|#POLICE CAR|#ONCOMING POLICE CAR|#TAXI|#ONCOMING TAXI|#AUTOMOBILE|#ONCOMING AUTOMOBILE|#RECREATIONAL VEHICLE|#DELIVERY TRUCK|#ARTICULATED LORRY|#TRACTOR|#MONORAIL|%UNTAIN RAILWAY|#SUSPENSION RAILWAY|#MOUNTAIN CABLEWAY|#AERIAL TRAMWAY|#SHIP|#ROWBOAT|#SPEEDBOAT|#HORIZONTAL TRAFFIC LIGHT|#VERTICAL TRAFFIC LIGHT|#CONSTRUCTION SIGN|#POLICE CARS REVOLVING LIGHT|#TRIANGULAR FLAG ON POST|#DOOR|#NO ENTRY SIGN|#SMOKING SYMBOL|#NO SMOKING SYMBOL|#PUT LITTER IN ITS PLACE SYMBOL|#DO NOT LITTER SYMBOL|#POTABLE WATER SYMBOL|#NON-POTABLE WATER SYMBOL|#BICYCLE|#NO BICYCLES|#BICYCLIST|#MOUNTAIN BICYCLIST|#PEDESTRIAN|#NO PEDESTRIANS|#CHILDREN CROSSING|#MENS SYMBOL|#WOMENS SYMBOL|#RESTROOM|#BABY SYMBOL|#TOILET|#WATER CLOSET|#SHOWER|#BATH|'TUB|#PASSPORT CONTROL|#CUSTOMS|#BAGGAGE CLAIM|#LEFT LUGGAGE|#TRIANGLE WITH ROUNDED CORNERS|#PROHIBITED SIGN|#CIRCLED INFORMATION SOURCE|#BOYS SYMBOL|#GIRLS SYMBOL|#COUCH AND LAMP|#SLEEPING ACCOMMODATION|$HOPPING BAGS|#BELLHOP BELL|%D|#PLACE OF WORSHIP|#OCTAGONAL SIGN|#SHOPPING TROLLEY|$TUPA|#PAGODA|#HINDU TEMPLE|$UT|#ELEVATOR|#LANDSLIDE|$IGHTHOUSE|#WIRELESS|#PLAYGROUND SLIDE|#WHEEL|#RING BUOY|#HAMMER AND WRENCH|#SHIELD|#OIL DRUM|#MOTORWAY|#RAILWAY TRACK|#MOTOR BOAT|#UP-POINTING MILITARY AIRPLANE|/AIRPLANE|/SMALL AIRPLANE|#SMALL AIRPLANE|#NORTHEAST-POINTING AIRPLANE|#AIRPLANE DEPARTURE|,ARRIVING|#SATELLITE|#ONCOMING FIRE ENGINE|#DIESEL LOCOMOTIVE|#PASSENGER SHIP|#SCOOTER|#MOTOR SCOOTER|#CANOE|#SLED|#FLYING SAUCER|#SKATEBOARD|#AUTO RICKSHAW|#PICKUP TRUCK|#ROLLER SKATE|#ALCHEMICAL SYMBOL FOR QUINTESSENCE|9AIR|9FIRE|9EARTH|9WATER|9AQUAFORTIS|= REGIA|C-2|>VITAE|C-2|9VINEGAR|@-2|A3|9SULFUR|9PHILOSOPHERS SULFUR|9BLACK SULFUR|9MERCURY SUBLIMATE|J-2|K3|9CINNABAR|9SALT|9NITRE|9VITRIOL|@-2|9ROCK SALT|B-2|9GOLD|9SILVER|9IRON ORE|A-2|9CROCUS OF IRON|9REGULUS OF IRON|9COPPER ORE|9IRON-COPPER ORE|9SUBLIMATE OF COPPER|9CROCUS OF COPPER|I-2|:OPPER ANTIMONIATE|9SALT OF COPPER ANTIMONIATE|:UBLIMATE OF SALT OF COPPER|9VERDIGRIS|9TIN ORE|9LEAD ORE|9ANTIMONY ORE|9SUBLIMATE OF ANTIMONY|:ALT OF ANTIMONY|:UBLIMATE OF SALT OF ANTIMONY|9VINEGAR OF ANTIMONY|9REGULUS OF ANTIMONY|L-2|@|@-2|A3|A4|9ALKALI|?-2|9MARCASITE|9SAL-AMMONIAC|9ARSENIC|9REALGAR|@-2|9AURIPIGMENT|9BISMUTH ORE|9TARTAR|?-2|9QUICK LIME|9BORAX|>-2|?3|9ALUM|9OIL|9SPIRIT|9TINCTURE|9GUM|9WAX|9POWDER|9CALX|9TUTTY|9CAPUT MORTUUM|9SCEPTER OF JOVE|9CADUCEUS|9TRIDENT|9STARRED TRIDENT|9LODESTONE|9SOAP|9URINE|9HORSE DUNG|9ASHES|9POT ASHES|9BRICK|9POWDERED BRICK|9AMALGAM|9STRATUM SUPER STRATUM|N-2|:UBLIMATION|9PRECIPITATE|9DISTILL|<SOLVE|A-2|9PURIFY|;TREFACTION|9CRUCIBLE|A-2|B3|B4|B5|9ALEMBIC|9BATH OF MARY|AVAPOURS|9RETORT|9HOUR|9NIGHT|9DAY-NIGHT|9MONTH|9HALF DRAM|>OUNCE|#LOT OF FORTUNE|#OCCULTATION|#LUNAR ECLIPSE|#VESTA FORM TWO|#ASTRAEA FORM TWO|#HYGIEA FORM TWO|#PARTHENOPE FORM TWO|#HAUMEA|#MAKEMAKE|#GONGGONG|#QUAOAR|#ORCUS|#BLACK LEFT-POINTING ISOSCELES RIGHT TRIANGLE|)UP-POINTING ISOSCELES RIGHT TRIANGLE|)RIGHT-POINTING ISOSCELES RIGHT TRIANGLE|)DOWN-POINTING ISOSCELES RIGHT TRIANGLE|)SLIGHTLY SMALL CIRCLE|#MEDIUM BOLD WHITE CIRCLE|#BOLD WHITE CIRCLE|#HEAVY WHITE CIRCLE|#VERY HEAVY WHITE CIRCLE|#EXTREMELY HEAVY WHITE CIRCLE|#WHITE CIRCLE CONTAINING BLACK SMALL CIRCLE|#ROUND TARGET|#BLACK TINY SQUARE|)SLIGHTLY SMALL SQUARE|#LIGHT WHITE SQUARE|#MEDIUM WHITE SQUARE|#BOLD WHITE SQUARE|#HEAVY WHITE SQUARE|#VERY HEAVY WHITE SQUARE|#EXTREMELY HEAVY WHITE SQUARE|#WHITE SQUARE CONTAINING BLACK VERY SMALL SQUARE|AMEDIUM SQUARE|#SQUARE TARGET|#BLACK TINY DIAMOND|)VERY SMALL DIAMOND|)MEDIUM SMALL DIAMOND|#WHITE DIAMOND CONTAINING BLACK VERY SMALL DIAMOND|BMEDIUM DIAMOND|#DIAMOND TARGET|#BLACK TINY LOZENGE|)VERY SMALL LOZENGE|)MEDIUM SMALL LOZENGE|#WHITE LOZENGE CONTAINING BLACK SMALL LOZENGE|#THIN GREEK CROSS|#LIGHT GREEK CROSS|#MEDIUM GREEK CROSS|#BOLD GREEK CROSS|#VERY BOLD GREEK CROSS|(HEAVY GREEK CROSS|#EXTREMELY HEAVY GREEK CROSS|#THIN SALTIRE|#LIGHT SALTIRE|#MEDIUM SALTIRE|#BOLD SALTIRE|#HEAVY SALTIRE|#VERY HEAVY SALTIRE|#EXTREMELY HEAVY SALTIRE|#LIGHT FIVE SPOKED ASTERISK|#MEDIUM FIVE SPOKED ASTERISK|#BOLD FIVE SPOKED ASTERISK|#HEAVY FIVE SPOKED ASTERISK|#VERY HEAVY FIVE SPOKED ASTERISK|#EXTREMELY HEAVY FIVE SPOKED ASTERISK|#LIGHT SIX SPOKED ASTERISK|#MEDIUM SIX SPOKED ASTERISK|#BOLD SIX SPOKED ASTERISK|#HEAVY SIX SPOKED ASTERISK|#VERY HEAVY SIX SPOKED ASTERISK|#EXTREMELY HEAVY SIX SPOKED ASTERISK|#LIGHT EIGHT SPOKED ASTERISK|#MEDIUM EIGHT SPOKED ASTERISK|#BOLD EIGHT SPOKED ASTERISK|#HEAVY EIGHT SPOKED ASTERISK|#VERY HEAVY EIGHT SPOKED ASTERISK|#LIGHT THREE POINTED BLACK STAR|#MEDIUM THREE POINTED BLACK STAR|#THREE POINTED BLACK STAR|#MEDIUM THREE POINTED PINWHEEL STAR|#LIGHT FOUR POINTED BLACK STAR|#MEDIUM FOUR POINTED BLACK STAR|#FOUR POINTED BLACK STAR|#MEDIUM FOUR POINTED PINWHEEL STAR|#REVERSE LIGHT FOUR POINTED PINWHEEL STAR|#LIGHT FIVE POINTED BLACK STAR|#HEAVY FIVE POINTED BLACK STAR|#MEDIUM SIX POINTED BLACK STAR|#HEAVY SIX POINTED BLACK STAR|#SIX POINTED PINWHEEL STAR|#MEDIUM EIGHT POINTED BLACK STAR|#HEAVY EIGHT POINTED BLACK STAR|#VERY HEAVY EIGHT POINTED BLACK STAR|#HEAVY EIGHT POINTED PINWHEEL STAR|#LIGHT TWELVE POINTED BLACK STAR|#HEAVY TWELVE POINTED BLACK STAR|8PINWHEEL STAR|#CIRCLED TRIANGLE|#NEGATIVE CIRCLED TRIANGLE|#CIRCLED SQUARE|#NEGATIVE CIRCLED SQUARE|$INE POINTED WHITE STAR|#BLACK CIRCLE WITH WHITE VERTICAL BAR|$ULLET IN DOUBLE CIRCLE|#LARGE ORANGE CIRCLE|)YELLOW CIRCLE|)GREEN CIRCLE|)PURPLE CIRCLE|)BROWN CIRCLE|)RED SQUARE|)BLUE SQUARE|)ORANGE SQUARE|)YELLOW SQUARE|)GREEN SQUARE|)PURPLE SQUARE|)BROWN SQUARE|#HEAVY EQUALS SIGN|#CIRCLE WITH DOUBLE VERTICAL AND HORIZONTAL LINE|#DOUBLE CIRCLE WITH DOUBLE HORIZONTAL LINE|#CIRCLED BOTTOM RIGHT OBLIQUE HALF BLACK CIRCLE|#LEFT HALF WHITE CIRCLE|#RIGHT HALF WHITE CIRCLE|#TRANSPARENT CUBE|#WHITE CUBE|#HORIZONTAL DOUBLE WHITE SMALL SQUARE|#VERTICAL DOUBLE WHITE SMALL SQUARE|#WHITE SQUARE WITH BOTTOM HALF BISECTED|5TOP HALF BISECTED|5HORIZONTAL AND VERTICAL BISECTING LINES|#LOWER LEFT FLATTENED RIGHT TRIANGLE|)RIGHT FLATTENED RIGHT TRIANGLE|#RHOMBUS|#LEFTWARDS ARROW WITH SMALL TRIANGLE ARROWHEAD|#UPWARDS ARROW WITH SMALL TRIANGLE ARROWHEAD|#RIGHTWARDS ARROW WITH SMALL TRIANGLE ARROWHEAD|#DOWNWARDS ARROW WITH SMALL TRIANGLE ARROWHEAD|#LEFTWARDS ARROW WITH MEDIUM TRIANGLE ARROWHEAD|#UPWARDS ARROW WITH MEDIUM TRIANGLE ARROWHEAD|#RIGHTWARDS ARROW WITH MEDIUM TRIANGLE ARROWHEAD|#DOWNWARDS ARROW WITH MEDIUM TRIANGLE ARROWHEAD|#LEFTWARDS ARROW WITH LARGE TRIANGLE ARROWHEAD|#UPWARDS ARROW WITH LARGE TRIANGLE ARROWHEAD|#RIGHTWARDS ARROW WITH LARGE TRIANGLE ARROWHEAD|#DOWNWARDS ARROW WITH LARGE TRIANGLE ARROWHEAD|#LEFTWARDS ARROW WITH SMALL EQUILATERAL ARROWHEAD|#UPWARDS ARROW WITH SMALL EQUILATERAL ARROWHEAD|#RIGHTWARDS ARROW WITH SMALL EQUILATERAL ARROWHEAD|#DOWNWARDS ARROW WITH SMALL EQUILATERAL ARROWHEAD|#LEFTWARDS ARROW WITH EQUILATERAL ARROWHEAD|#UPWARDS ARROW WITH EQUILATERAL ARROWHEAD|#RIGHTWARDS ARROW WITH EQUILATERAL ARROWHEAD|#DOWNWARDS ARROW WITH EQUILATERAL ARROWHEAD|#HEAVY LEFTWARDS ARROW WITH EQUILATERAL ARROWHEAD|)UPWARDS ARROW WITH EQUILATERAL ARROWHEAD|)RIGHTWARDS ARROW WITH EQUILATERAL ARROWHEAD|)DOWNWARDS ARROW WITH EQUILATERAL ARROWHEAD|)LEFTWARDS ARROW WITH LARGE EQUILATERAL ARROWHEAD|)UPWARDS ARROW WITH LARGE EQUILATERAL ARROWHEAD|)RIGHTWARDS ARROW WITH LARGE EQUILATERAL ARROWHEAD|)DOWNWARDS ARROW WITH LARGE EQUILATERAL ARROWHEAD|#LEFTWARDS TRIANGLE-HEADED ARROW WITH NARROW SHAFT|#UPWARDS TRIANGLE-HEADED ARROW WITH NARROW SHAFT|#RIGHTWARDS TRIANGLE-HEADED ARROW WITH NARROW SHAFT|#DOWNWARDS TRIANGLE-HEADED ARROW WITH NARROW SHAFT|#LEFTWARDS TRIANGLE-HEADED ARROW WITH MEDIUM SHAFT|#UPWARDS TRIANGLE-HEADED ARROW WITH MEDIUM SHAFT|#RIGHTWARDS TRIANGLE-HEADED ARROW WITH MEDIUM SHAFT|#DOWNWARDS TRIANGLE-HEADED ARROW WITH MEDIUM SHAFT|#LEFTWARDS TRIANGLE-HEADED ARROW WITH BOLD SHAFT|#UPWARDS TRIANGLE-HEADED ARROW WITH BOLD SHAFT|#RIGHTWARDS TRIANGLE-HEADED ARROW WITH BOLD SHAFT|#DOWNWARDS TRIANGLE-HEADED ARROW WITH BOLD SHAFT|#LEFTWARDS TRIANGLE-HEADED ARROW WITH HEAVY SHAFT|#UPWARDS TRIANGLE-HEADED ARROW WITH HEAVY SHAFT|#RIGHTWARDS TRIANGLE-HEADED ARROW WITH HEAVY SHAFT|#DOWNWARDS TRIANGLE-HEADED ARROW WITH HEAVY SHAFT|#LEFTWARDS TRIANGLE-HEADED ARROW WITH VERY HEAVY SHAFT|#UPWARDS TRIANGLE-HEADED ARROW WITH VERY HEAVY SHAFT|#RIGHTWARDS TRIANGLE-HEADED ARROW WITH VERY HEAVY SHAFT|#DOWNWARDS TRIANGLE-HEADED ARROW WITH VERY HEAVY SHAFT|#LEFTWARDS FINGER-POST ARROW|#UPWARDS FINGER-POST ARROW|#RIGHTWARDS FINGER-POST ARROW|#DOWNWARDS FINGER-POST ARROW|#LEFTWARDS SQUARED ARROW|#UPWARDS SQUARED ARROW|#RIGHTWARDS SQUARED ARROW|#DOWNWARDS SQUARED ARROW|#LEFTWARDS COMPRESSED ARROW|#UPWARDS COMPRESSED ARROW|#RIGHTWARDS COMPRESSED ARROW|#DOWNWARDS COMPRESSED ARROW|#LEFTWARDS HEAVY COMPRESSED ARROW|#UPWARDS HEAVY COMPRESSED ARROW|#RIGHTWARDS HEAVY COMPRESSED ARROW|#DOWNWARDS HEAVY COMPRESSED ARROW|#LEFTWARDS HEAVY ARROW|#UPWARDS HEAVY ARROW|#RIGHTWARDS HEAVY ARROW|#DOWNWARDS HEAVY ARROW|#LEFTWARDS SANS-SERIF ARROW|#UPWARDS SANS-SERIF ARROW|#RIGHTWARDS SANS-SERIF ARROW|#DOWNWARDS SANS-SERIF ARROW|#NORTH WEST SANS-SERIF ARROW|)EAST SANS-SERIF ARROW|#SOUTH EAST SANS-SERIF ARROW|)WEST SANS-SERIF ARROW|#LEFT RIGHT SANS-SERIF ARROW|#UP DOWN SANS-SERIF ARROW|#WIDE-HEADED LEFTWARDS LIGHT BARB ARROW|/UPWARDS LIGHT BARB ARROW|/RIGHTWARDS LIGHT BARB ARROW|/DOWNWARDS LIGHT BARB ARROW|/NORTH WEST LIGHT BARB ARROW|5EAST LIGHT BARB ARROW|/SOUTH EAST LIGHT BARB ARROW|5WEST LIGHT BARB ARROW|/LEFTWARDS BARB ARROW|/UPWARDS BARB ARROW|/RIGHTWARDS BARB ARROW|/DOWNWARDS BARB ARROW|/NORTH WEST BARB ARROW|5EAST BARB ARROW|/SOUTH EAST BARB ARROW|5WEST BARB ARROW|/LEFTWARDS MEDIUM BARB ARROW|/UPWARDS MEDIUM BARB ARROW|/RIGHTWARDS MEDIUM BARB ARROW|/DOWNWARDS MEDIUM BARB ARROW|/NORTH WEST MEDIUM BARB ARROW|5EAST MEDIUM BARB ARROW|/SOUTH EAST MEDIUM BARB ARROW|5WEST MEDIUM BARB ARROW|/LEFTWARDS HEAVY BARB ARROW|/UPWARDS HEAVY BARB ARROW|/RIGHTWARDS HEAVY BARB ARROW|/DOWNWARDS HEAVY BARB ARROW|/NORTH WEST HEAVY BARB ARROW|5EAST HEAVY BARB ARROW|/SOUTH EAST HEAVY BARB ARROW|5WEST HEAVY BARB ARROW|/LEFTWARDS VERY HEAVY BARB ARROW|/UPWARDS VERY HEAVY BARB ARROW|/RIGHTWARDS VERY HEAVY BARB ARROW|/DOWNWARDS VERY HEAVY BARB ARROW|/NORTH WEST VERY HEAVY BARB ARROW|5EAST VERY HEAVY BARB ARROW|/SOUTH EAST VERY HEAVY BARB ARROW|5WEST VERY HEAVY BARB ARROW|#LEFTWARDS TRIANGLE ARROWHEAD|#UPWARDS TRIANGLE ARROWHEAD|#RIGHTWARDS TRIANGLE ARROWHEAD|#DOWNWARDS TRIANGLE ARROWHEAD|#LEFTWARDS WHITE ARROW WITHIN TRIANGLE ARROWHEAD|#UPWARDS WHITE ARROW WITHIN TRIANGLE ARROWHEAD|#RIGHTWARDS WHITE ARROW WITHIN TRIANGLE ARROWHEAD|#DOWNWARDS WHITE ARROW WITHIN TRIANGLE ARROWHEAD|#LEFTWARDS ARROW WITH NOTCHED TAIL|#UPWARDS ARROW WITH NOTCHED TAIL|#RIGHTWARDS ARROW WITH NOTCHED TAIL|#DOWNWARDS ARROW WITH NOTCHED TAIL|#HEAVY ARROW SHAFT WIDTH ONE|;TWO THIRDS|;ONE HALF|?THIRD|#LEFTWARDS BOTTOM-SHADED WHITE ARROW|#RIGHTWARDS BOTTOM SHADED WHITE ARROW|#LEFTWARDS TOP SHADED WHITE ARROW|#RIGHTWARDS TOP SHADED WHITE ARROW|#LEFTWARDS LEFT-SHADED WHITE ARROW|#RIGHTWARDS RIGHT-SHADED WHITE ARROW|#LEFTWARDS RIGHT-SHADED WHITE ARROW|#RIGHTWARDS LEFT-SHADED WHITE ARROW|#LEFTWARDS BACK-TILTED SHADOWED WHITE ARROW|#RIGHTWARDS BACK-TILTED SHADOWED WHITE ARROW|#LEFTWARDS FRONT-TILTED SHADOWED WHITE ARROW|#RIGHTWARDS FRONT-TILTED SHADOWED WHITE ARROW|#WHITE ARROW SHAFT WIDTH ONE|;TWO THIRDS|#ARROW POINTING UPWARDS THEN NORTH WEST|2RIGHTWARDS THEN CURVING SOUTH WEST|#RIGHTWARDS ARROW WITH LOWER HOOK|#DOWNWARDS BLACK ARROW TO BAR|#NEGATIVE SQUARED LEFTWARDS ARROW|4UPWARDS ARROW|4RIGHTWARDS ARROW|4DOWNWARDS ARROW|$ORTH WEST ARROW FROM BAR|)EAST ARROW FROM BAR|#SOUTH EAST ARROW FROM BAR|)WEST ARROW FROM BAR|#LEFTWARDS ARROW FROM DOWNWARDS ARROW|#RIGHTWARDS ARROW FROM DOWNWARDS ARROW|#LONG RIGHTWARDS ARROW OVER LONG LEFTWARDS ARROW|3HARPOON OVER LONG LEFTWARDS HARPOON|;ABOVE SHORT LEFTWARDS HARPOON|#SHORT RIGHTWARDS HARPOON ABOVE LONG LEFTWARDS HARPOON|#LONG LEFTWARDS HARPOON ABOVE SHORT RIGHTWARDS HARPOON|#SHORT LEFTWARDS HARPOON ABOVE LONG RIGHTWARDS HARPOON|#LONG RIGHTWARDS ARROW THROUGH X|9WITH DOUBLE SLASH|(LEFT RIGHT ARROW WITH DEPENDENT LOBE|#CIRCLED CROSS FORMEE WITH FOUR DOTS|=TWO DOTS|7|#LEFT HALF CIRCLE WITH FOUR DOTS|9THREE DOTS|:WO DOTS|9DOT|3|#DOWNWARD FACING HOOK|3NOTCHED HOOK|3HOOK WITH DOT|3NOTCHED HOOK WITH DOT|#PINCHED FINGERS|#WHITE HEART|#BROWN HEART|#PINCHING HAND|#ZIPPER-MOUTH FACE|#MONEY-MOUTH FACE|#FACE WITH THERMOMETER|#NERD FACE|#THINKING FACE|#FACE WITH HEAD-BANDAGE|#ROBOT FACE|#HUGGING FACE|#SIGN OF THE HORNS|#CALL ME HAND|#RAISED BACK OF HAND|#LEFT-FACING FIST|#RIGHT-FACING FIST|#HANDSHAKE|' WITH INDEX AND MIDDLE FINGERS CROSSED|#I LOVE YOU HAND SIGN|#FACE WITH COWBOY HAT|#CLOWN FACE|#NAUSEATED FACE|#ROLLING ON THE FLOOR LAUGHING|#DROOLING FACE|#LYING FACE|#FACE PALM|#SNEEZING FACE|#FACE WITH ONE EYEBROW RAISED|#GRINNING FACE WITH STAR EYES|6ONE LARGE AND ONE SMALL EYE|#FACE WITH FINGER COVERING CLOSED LIPS|#SERIOUS FACE WITH SYMBOLS COVERING MOUTH|$MILING FACE WITH SMILING EYES AND HAND COVERING MOUTH|#FACE WITH OPEN MOUTH VOMITING|#SHOCKED FACE WITH EXPLODING HEAD|#PREGNANT WOMAN|#BREAST-FEEDING|#PALMS UP TOGETHER|#SELFIE|#PRINCE|#MAN IN TUXEDO|$OTHER CHRISTMAS|#SHRUG|#PERSON DOING CARTWHEEL|#JUGGLING|#FENCER|#MODERN PENTATHLON|#WRESTLERS|$ATER POLO|#HANDBALL|#DIVING MASK|#WILTED FLOWER|#DRUM WITH DRUMSTICKS|#CLINKING GLASSES|#TUMBLER GLASS|#SPOON|#GOAL NET|#RIFLE|#FIRST PLACE MEDAL|#SECOND PLACE MEDAL|#THIRD PLACE MEDAL|#BOXING GLOVE|#MARTIAL ARTS UNIFORM|#CURLING STONE|#LACROSSE STICK AND BALL|#SOFTBALL|#FLYING DISC|#CROISSANT|#AVOCADO|#CUCUMBER|#BACON|#POTATO|#CARROT|#BAGUETTE BREAD|#GREEN SALAD|#SHALLOW PAN OF FOOD|$TUFFED FLATBREAD|#EGG|#GLASS OF MILK|#PEANUTS|#KIWIFRUIT|#PANCAKES|#DUMPLING|#FORTUNE COOKIE|#TAKEOUT BOX|#CHOPSTICKS|#BOWL WITH SPOON|#CUP WITH STRAW|$OCONUT|#BROCCOLI|#PIE|$RETZEL|#CUT OF MEAT|#SANDWICH|#CANNED FOOD|#LEAFY GREEN|#MANGO|$OON CAKE|#BAGEL|#SMILING FACE WITH SMILING EYES AND THREE HEARTS|#YAWNING FACE|#SMILING FACE WITH TEAR|#FACE WITH PARTY HORN AND PARTY HAT|-UNEVEN EYES AND WAVY MOUTH|#OVERHEATED FACE|#FREEZING FACE|#NINJA|#DISGUISED FACE|#FACE HOLDING BACK TEARS|(WITH PLEADING EYES|#SARI|#LAB COAT|#GOGGLES|#HIKING BOOT|#FLAT SHOE|#CRAB|#LION FACE|#SCORPION|#TURKEY|#UNICORN FACE|#EAGLE|#DUCK|#BAT|#SHARK|#OWL|#FOX FACE|#BUTTERFLY|#DEER|#GORILLA|#LIZARD|#RHINOCEROS|#SHRIMP|$QUID|#GIRAFFE FACE|#ZEBRA FACE|#HEDGEHOG|#SAUROPOD|#T-REX|#CRICKET|#KANGAROO|#LLAMA|#PEACOCK|#HIPPOPOTAMUS|#PARROT|#RACCOON|#LOBSTER|#MOSQUITO|$ICROBE|#BADGER|#SWAN|#MAMMOTH|#DODO|#SLOTH|#OTTER|$RANGUTAN|#SKUNK|#FLAMINGO|#OYSTER|#BEAVER|$ISON|#SEAL|#GUIDE DOG|#PROBING CANE|#EMOJI COMPONENT RED HAIR|3CURLY HAIR|3BALD|3WHITE HAIR|#BONE|#LEG|#FOOT|#TOOTH|#SUPERHERO|(VILLAIN|$AFETY VEST|#EAR WITH HEARING AID|#MOTORIZED WHEELCHAIR|$ANUAL WHEELCHAIR|$ECHANICAL ARM|.LEG|#CHEESE WEDGE|$UPCAKE|#SALT SHAKER|#BEVERAGE BOX|#GARLIC|#ONION|#FALAFEL|#WAFFLE|#BUTTER|#MATE DRINK|#ICE CUBE|#BUBBLE TEA|#TROLL|#STANDING PERSON|#KNEELING PERSON|#DEAF PERSON|#FACE WITH MONOCLE|#ADULT|#CHILD|#OLDER ADULT|#BEARDED PERSON|#PERSON WITH HEADSCARF|*IN STEAMY ROOM|*CLIMBING|*IN LOTUS POSITION|#MAGE|#FAIRY|#VAMPIRE|#MERPERSON|#ELF|#GENIE|#ZOMBIE|#BRAIN|#ORANGE HEART|#BILLED CAP|#SCARF|#GLOVES|#COAT|#SOCKS|#RED GIFT ENVELOPE|#FIRECRACKER|#JIGSAW PUZZLE PIECE|#TEST TUBE|#PETRI DISH|#DNA DOUBLE HELIX|#COMPASS|#ABACUS|#FIRE EXTINGUISHER|#TOOLBOX|#BRICK|#MAGNET|#LUGGAGE|$OTION BOTTLE|#SPOOL OF THREAD|#BALL OF YARN|#SAFETY PIN|#TEDDY BEAR|#BROOM|$ASKET|#ROLL OF PAPER|#BAR OF SOAP|#SPONGE|#RECEIPT|#NAZAR AMULET|$EUTRAL CHESS KING|1QUEEN|1ROOK|1BISHOP|1KNIGHT|1PAWN|#WHITE CHESS KNIGHT ROTATED FORTY-FIVE DEGREES|#BLACK CHESS KNIGHT ROTATED FORTY-FIVE DEGREES|#NEUTRAL CHESS KNIGHT ROTATED FORTY-FIVE DEGREES|#WHITE CHESS KING ROTATED NINETY DEGREES|/QUEEN ROTATED NINETY DEGREES|/ROOK ROTATED NINETY DEGREES|/BISHOP ROTATED NINETY DEGREES|/KNIGHT ROTATED NINETY DEGREES|/PAWN ROTATED NINETY DEGREES|#BLACK CHESS KING ROTATED NINETY DEGREES|/QUEEN ROTATED NINETY DEGREES|/ROOK ROTATED NINETY DEGREES|/BISHOP ROTATED NINETY DEGREES|/KNIGHT ROTATED NINETY DEGREES|/PAWN ROTATED NINETY DEGREES|#NEUTRAL CHESS KING ROTATED NINETY DEGREES|1QUEEN ROTATED NINETY DEGREES|1ROOK ROTATED NINETY DEGREES|1BISHOP ROTATED NINETY DEGREES|1KNIGHT ROTATED NINETY DEGREES|1PAWN ROTATED NINETY DEGREES|#WHITE CHESS KNIGHT ROTATED ONE HUNDRED THIRTY-FIVE DEGREES|#BLACK CHESS KNIGHT ROTATED ONE HUNDRED THIRTY-FIVE DEGREES|#NEUTRAL CHESS KNIGHT ROTATED ONE HUNDRED THIRTY-FIVE DEGREES|#WHITE CHESS TURNED KING|6QUEEN|6ROOK|6BISHOP|6KNIGHT|6PAWN|#BLACK CHESS TURNED KING|6QUEEN|6ROOK|6BISHOP|6KNIGHT|6PAWN|#NEUTRAL CHESS TURNED KING|8QUEEN|8ROOK|8BISHOP|8KNIGHT|8PAWN|#WHITE CHESS KNIGHT ROTATED TWO HUNDRED TWENTY-FIVE DEGREES|#BLACK CHESS KNIGHT ROTATED TWO HUNDRED TWENTY-FIVE DEGREES|#NEUTRAL CHESS KNIGHT ROTATED TWO HUNDRED TWENTY-FIVE DEGREES|#WHITE CHESS KING ROTATED TWO HUNDRED SEVENTY DEGREES|/QUEEN ROTATED TWO HUNDRED SEVENTY DEGREES|/ROOK ROTATED TWO HUNDRED SEVENTY DEGREES|/BISHOP ROTATED TWO HUNDRED SEVENTY DEGREES|/KNIGHT ROTATED TWO HUNDRED SEVENTY DEGREES|/PAWN ROTATED TWO HUNDRED SEVENTY DEGREES|#BLACK CHESS KING ROTATED TWO HUNDRED SEVENTY DEGREES|/QUEEN ROTATED TWO HUNDRED SEVENTY DEGREES|/ROOK ROTATED TWO HUNDRED SEVENTY DEGREES|/BISHOP ROTATED TWO HUNDRED SEVENTY DEGREES|/KNIGHT ROTATED TWO HUNDRED SEVENTY DEGREES|/PAWN ROTATED TWO HUNDRED SEVENTY DEGREES|#NEUTRAL CHESS KING ROTATED TWO HUNDRED SEVENTY DEGREES|1QUEEN ROTATED TWO HUNDRED SEVENTY DEGREES|1ROOK ROTATED TWO HUNDRED SEVENTY DEGREES|1BISHOP ROTATED TWO HUNDRED SEVENTY DEGREES|1KNIGHT ROTATED TWO HUNDRED SEVENTY DEGREES|1PAWN ROTATED TWO HUNDRED SEVENTY DEGREES|#WHITE CHESS KNIGHT ROTATED THREE HUNDRED FIFTEEN DEGREES|#BLACK CHESS KNIGHT ROTATED THREE HUNDRED FIFTEEN DEGREES|#NEUTRAL CHESS KNIGHT ROTATED THREE HUNDRED FIFTEEN DEGREES|#WHITE CHESS EQUIHOPPER|#BLACK CHESS EQUIHOPPER|#NEUTRAL CHESS EQUIHOPPER|#WHITE CHESS EQUIHOPPER ROTATED NINETY DEGREES|#BLACK CHESS EQUIHOPPER ROTATED NINETY DEGREES|#NEUTRAL CHESS EQUIHOPPER ROTATED NINETY DEGREES|#WHITE CHESS KNIGHT-QUEEN|6ROOK|6BISHOP|#BLACK CHESS KNIGHT-QUEEN|6ROOK|6BISHOP|#WHITE CHESS FERZ|/ALFIL|#BLACK CHESS FERZ|/ALFIL|#XIANGQI RED GENERAL|/MANDARIN|/ELEPHANT|/HORSE|/CHARIOT|0ANNON|/SOLDIER|+BLACK GENERAL|1MANDARIN|1ELEPHANT|1HORSE|1CHARIOT|2ANNON|1SOLDIER|#BALLET SHOES|#ONE-PIECE SWIMSUIT|#BRIEFS|#SHORTS|#THONG SANDAL|#LIGHT BLUE HEART|#GREY HEART|#PINK HEART|#DROP OF BLOOD|#ADHESIVE BANDAGE|#STETHOSCOPE|#X-RAY|#CRUTCH|#YO-YO|#KITE|#PARACHUTE|#BOOMERANG|#MAGIC WAND|#PINATA|#NESTING DOLLS|#MARACAS|#FLUTE|#HARP|#TROMBONE|#METEOR|#ERASER|#NET WITH HANDLE|#TREASURE CHEST|#SHOVEL|#RINGED PLANET|#CHAIR|#RAZOR|#AXE|#DIYA LAMP|#BANJO|#MILITARY HELMET|#ACCORDION|#LONG DRUM|#COIN|$ARPENTRY SAW|#SCREWDRIVER|#LADDER|#HOOK|#MIRROR|#WINDOW|#PLUNGER|#SEWING NEEDLE|#KNOT|#BUCKET|#MOUSE TRAP|#TOOTHBRUSH|#HEADSTONE|#PLACARD|#ROCK|#MIRROR BALL|#IDENTIFICATION CARD|#LOW BATTERY|#HAMSA|#FOLDING HAND FAN|#HAIR PICK|#KHANDA|#FLY|#WORM|#BEETLE|#COCKROACH|#POTTED PLANT|#WOOD|#FEATHER|#LOTUS|#CORAL|#EMPTY NEST|#NEST WITH EGGS|#HYACINTH|#JELLYFISH|#WING|#LEAFLESS TREE|#GOOSE|#ANATOMICAL HEART|#LUNGS|#PEOPLE HUGGING|$REGNANT MAN|,PERSON|$ERSON WITH CROWN|#FINGERPRINT|#HAIRY CREATURE|#MONARCH BUTTERFLY|#ORCA|#MOOSE|#DONKEY|#BLUEBERRIES|$ELL PEPPER|#OLIVE|#FLATBREAD|#TAMALE|#FONDUE|#TEAPOT|#POURING LIQUID|#BEANS|#JAR|#GINGER ROOT|#PEA POD|#ROOT VEGETABLE|#PICKLE|#SPLATTER|#MELTING FACE|#SALUTING FACE|#FACE WITH OPEN EYES AND HAND OVER MOUTH|-PEEKING EYE|-DIAGONAL MOUTH|#DOTTED LINE FACE|#BITING LIP|$UBBLES|#SHAKING FACE|#FACE WITH BAGS UNDER EYES|#DISTORTED FACE|#CRACKING FACE|#FIGHT CLOUD|#HAND WITH INDEX FINGER AND THUMB CROSSED|#RIGHTWARDS HAND|#LEFTWARDS HAND|#PALM DOWN HAND|(UP HAND|#INDEX POINTING AT THE VIEWER|#HEART HANDS|#LEFTWARDS PUSHING HAND|#RIGHTWARDS PUSHING HAND|#LEFTWARDS THUMB SIGN|#RIGHTWARDS THUMB SIGN|#BLOCK SEXTANT-1|12|112|13|113|123|1123|14|114|124|1124|134|1134|1234|11234|15|115|125|1125|135|1235|11235|145|1145|1245|11245|1345|11345|12345|112345|16|116|126|1126|136|1136|1236|11236|146|1146|2246|1346|11346|12346|112346|156|1156|1256|11256|1356|11356|12356|112356|1456|11456|12456|112456|13456|113456|123456|#LOWER LEFT BLOCK DIAGONAL LOWER MIDDLE LEFT TO LOWER CENTRE|XRIGHT|=UPPER MIDDLE LEFT TO LOWER CENTRE|XRIGHT|CLEFT TO LOWER CENTRE|)RIGHT BLOCK DIAGONAL UPPER MIDDLE LEFT TO UPPER CENTRE|YRIGHT|>LOWER MIDDLE LEFT TO UPPER CENTRE|YRIGHT|DLEFT TO UPPER CENTRE|DMIDDLE LEFT TO UPPER MIDDLE RIGHT|DCENTRE TO LOWER MIDDLE RIGHT|DLEFT TO LOWER MIDDLE RIGHT|DCENTRE TO UPPER MIDDLE RIGHT|DLEFT TO UPPER MIDDLE RIGHT|DCENTRE TO UPPER RIGHT|)LEFT BLOCK DIAGONAL UPPER CENTRE TO UPPER MIDDLE RIGHT|CLEFT TO UPPER MIDDLE RIGHT|CCENTRE TO LOWER MIDDLE RIGHT|CLEFT TO LOWER MIDDLE RIGHT|CCENTRE TO LOWER RIGHT|CMIDDLE LEFT TO LOWER MIDDLE RIGHT|#UPPER RIGHT BLOCK DIAGONAL LOWER MIDDLE LEFT TO LOWER CENTRE|YRIGHT|>UPPER MIDDLE LEFT TO LOWER CENTRE|YRIGHT|DLEFT TO LOWER CENTRE|)LEFT BLOCK DIAGONAL UPPER MIDDLE LEFT TO UPPER CENTRE|XRIGHT|=LOWER MIDDLE LEFT TO UPPER CENTRE|XRIGHT|CLEFT TO UPPER CENTRE|CMIDDLE LEFT TO UPPER MIDDLE RIGHT|CCENTRE TO LOWER MIDDLE RIGHT|CLEFT TO LOWER MIDDLE RIGHT|CCENTRE TO UPPER MIDDLE RIGHT|CLEFT TO UPPER MIDDLE RIGHT|CCENTRE TO UPPER RIGHT|)RIGHT BLOCK DIAGONAL UPPER CENTRE TO UPPER MIDDLE RIGHT|DLEFT TO UPPER MIDDLE RIGHT|DCENTRE TO LOWER MIDDLE RIGHT|DLEFT TO LOWER MIDDLE RIGHT|DCENTRE TO LOWER RIGHT|DMIDDLE LEFT TO LOWER MIDDLE RIGHT|)AND RIGHT AND LOWER TRIANGULAR THREE QUARTERS BLOCK|#LEFT AND LOWER AND RIGHT TRIANGULAR THREE QUARTERS BLOCK|#UPPER AND LEFT AND LOWER TRIANGULAR THREE QUARTERS BLOCK|#LEFT AND UPPER AND RIGHT TRIANGULAR THREE QUARTERS BLOCK|(TRIANGULAR ONE QUARTER BLOCK|#UPPER TRIANGULAR ONE QUARTER BLOCK|#RIGHT TRIANGULAR ONE QUARTER BLOCK|#LOWER TRIANGULAR ONE QUARTER BLOCK|#VERTICAL ONE EIGHTH BLOCK-2|=3|=4|=5|=6|=7|#HORIZONTAL ONE EIGHTH BLOCK-2|?3|?4|?5|?6|?7|#LEFT AND LOWER ONE EIGHTH BLOCK|,UPPER ONE EIGHTH BLOCK|#RIGHT AND UPPER ONE EIGHTH BLOCK|-LOWER ONE EIGHTH BLOCK|#UPPER AND LOWER ONE EIGHTH BLOCK|#HORIZONTAL ONE EIGHTH BLOCK-1358|#UPPER ONE QUARTER BLOCK|)THREE EIGHTHS BLOCK|)FIVE EIGHTHS BLOCK|)THREE QUARTERS BLOCK|)SEVEN EIGHTHS BLOCK|#RIGHT ONE QUARTER BLOCK|)THREE EIGHTHS BLOCK|)FIVE EIGHTHS BLOCK|)THREE QUARTERS BLOCK|)SEVEN EIGHTHS BLOCK|#LEFT HALF MEDIUM SHADE|#RIGHT HALF MEDIUM SHADE|#UPPER HALF MEDIUM SHADE|#LOWER HALF MEDIUM SHADE|#INVERSE MEDIUM SHADE|#UPPER HALF BLOCK AND LOWER HALF INVERSE MEDIUM SHADE|.INVERSE MEDIUM SHADE AND LOWER HALF BLOCK|#LEFT HALF INVERSE MEDIUM SHADE AND RIGHT HALF BLOCK|#CHECKER BOARD FILL|#INVERSE CHECKER BOARD FILL|#HEAVY HORIZONTAL FILL|#UPPER LEFT TO LOWER RIGHT FILL|)RIGHT TO LOWER LEFT FILL|)AND LOWER TRIANGULAR HALF BLOCK|#LEFT AND RIGHT TRIANGULAR HALF BLOCK|#UPPER LEFT TRIANGULAR MEDIUM SHADE|)RIGHT TRIANGULAR MEDIUM SHADE|#LOWER RIGHT TRIANGULAR MEDIUM SHADE|)LEFT TRIANGULAR MEDIUM SHADE|#BOX DRAWINGS LIGHT DIAGONAL UPPER CENTRE TO MIDDLE LEFT|VRIGHT|?MIDDLE LEFT TO LOWER CENTRE|FRIGHT TO LOWER CENTRE|?UPPER CENTRE TO MIDDLE LEFT TO LOWER CENTRE|VRIGHT TO LOWER CENTRE|?MIDDLE LEFT TO LOWER CENTRE TO MIDDLE RIGHT|NUPPER CENTRE TO MIDDLE RIGHT|?UPPER CENTRE TO MIDDLE LEFT AND MIDDLE RIGHT TO LOWER CENTRE|VRIGHT AND MIDDLE LEFT TO LOWER CENTRE|\\TO LOWER CENTRE TO MIDDLE LEFT|VLEFT TO LOWER CENTRE TO MIDDLE RIGHT|?MIDDLE LEFT TO UPPER CENTRE TO MIDDLE RIGHT TO LOWER CENTRE|FRIGHT TO UPPER CENTRE TO MIDDLE LEFT TO LOWER CENTRE|?DIAMOND|6HORIZONTAL WITH VERTICAL STROKE|#ARROWHEAD-SHAPED POINTER|#INVERSE CHECK MARK|#LEFT HALF RUNNING MAN|#RIGHT HALF RUNNING MAN|#INVERSE DOWNWARDS ARROW WITH TIP LEFTWARDS|#LEFTWARDS ARROW AND UPPER AND LOWER ONE EIGHTH BLOCK|#RIGHTWARDS ARROW AND UPPER AND LOWER ONE EIGHTH BLOCK|#DOWNWARDS ARROW AND RIGHT ONE EIGHTH BLOCK|#UPWARDS ARROW AND RIGHT ONE EIGHTH BLOCK|#LEFT HALF FOLDER|#RIGHT HALF FOLDER|#VOIDED GREEK CROSS|#RIGHT OPEN SQUARED DOT|#NEGATIVE DIAGONAL CROSS|5MIDDLE RIGHT TO LOWER CENTRE|5DIAMOND|#WHITE HEAVY SALTIRE WITH ROUNDED CORNERS|#LEFT THIRD WHITE RIGHT POINTING INDEX|#MIDDLE THIRD WHITE RIGHT POINTING INDEX|#RIGHT THIRD WHITE RIGHT POINTING INDEX|#NEGATIVE SQUARED QUESTION MARK|#STICK FIGURE|/ WITH ARMS RAISED|0LEANING LEFT|8RIGHT|0WITH DRESS|#WHITE UP-POINTING CHEVRON|)CROSS MARK|#RAISED SMALL LEFT SQUARE BRACKET|#BLACK SMALL UP-POINTING CHEVRON|#LEFT TWO THIRDS BLOCK|(ONE THIRD BLOCK|#BOX DRAWINGS LIGHT DIAGONAL MIDDLE RIGHT TO LOWER LEFT|?UPPER RIGHT TO MIDDLE LEFT|ELEFT TO MIDDLE RIGHT|?MIDDLE LEFT TO LOWER RIGHT|?UPPER LEFT TO LOWER CENTRE|ECENTRE TO LOWER RIGHT|ERIGHT TO LOWER CENTRE|ECENTRE TO LOWER LEFT|ELEFT TO MIDDLE CENTRE TO UPPER RIGHT|ERIGHT TO MIDDLE CENTRE TO LOWER RIGHT|?LOWER LEFT TO MIDDLE CENTRE TO LOWER RIGHT|?UPPER LEFT TO MIDDLE CENTRE TO LOWER LEFT|MLOWER CENTRE TO UPPER RIGHT|ERIGHT TO MIDDLE LEFT TO LOWER RIGHT|?LOWER LEFT TO UPPER CENTRE TO LOWER RIGHT|?UPPER LEFT TO MIDDLE RIGHT TO LOWER LEFT|#TOP JUSTIFIED LOWER HALF WHITE CIRCLE|#RIGHT JUSTIFIED LEFT HALF WHITE CIRCLE|#BOTTOM JUSTIFIED UPPER HALF WHITE CIRCLE|#LEFT JUSTIFIED RIGHT HALF WHITE CIRCLE|#UPPER CENTRE ONE QUARTER BLOCK|#LOWER CENTRE ONE QUARTER BLOCK|#MIDDLE LEFT ONE QUARTER BLOCK|*RIGHT ONE QUARTER BLOCK|#TOP JUSTIFIED LOWER HALF BLACK CIRCLE|#RIGHT JUSTIFIED LEFT HALF BLACK CIRCLE|#BOTTOM JUSTIFIED UPPER HALF BLACK CIRCLE|#LEFT JUSTIFIED RIGHT HALF BLACK CIRCLE|#TOP RIGHT JUSTIFIED LOWER LEFT QUARTER BLACK CIRCLE|#BOTTOM LEFT JUSTIFIED UPPER RIGHT QUARTER BLACK CIRCLE|*RIGHT JUSTIFIED UPPER LEFT QUARTER BLACK CIRCLE|#TOP LEFT JUSTIFIED LOWER RIGHT QUARTER BLACK CIRCLE|#SEGMENTED DIGIT ZERO|3ONE|3TWO|4HREE|3FOUR|4IVE|3SIX|4EVEN|3EIGHT|3NINE|#ALARM BELL SYMBOL|#LANGUAGE TAG|#TAG SPACE|'EXCLAMATION MARK|'QUOTATION MARK|'NUMBER SIGN|'DOLLAR SIGN|'PERCENT SIGN|'AMPERSAND|(POSTROPHE|'LEFT PARENTHESIS|'RIGHT PARENTHESIS|'ASTERISK|'PLUS SIGN|'COMMA|'HYPHEN-MINUS|'FULL STOP|'SOLIDUS|'DIGIT ZERO|-ONE|-TWO|.HREE|-FOUR|.IVE|-SIX|.EVEN|-EIGHT|-NINE|'COLON|'SEMICOLON|'LESS-THAN SIGN|'EQUALS SIGN|'GREATER-THAN SIGN|'QUESTION MARK|'COMMERCIAL AT|'LATIN CAPITAL LETTER A|<B|<C|<D|<E|<F|<G|<H|<I|<J|<K|<L|<M|<N|<O|<P|<Q|<R|<S|<T|<U|<V|<W|<X|<Y|<Z|(EFT SQUARE BRACKET|'REVERSE SOLIDUS|(IGHT SQUARE BRACKET|'CIRCUMFLEX ACCENT|'LOW LINE|'GRAVE ACCENT|'LATIN SMALL LETTER A|:B|:C|:D|:E|:F|:G|:H|:I|:J|:K|:L|:M|:N|:O|:P|:Q|:R|:S|:T|:U|:V|:W|:X|:Y|:Z|(EFT CURLY BRACKET|'VERTICAL LINE|'RIGHT CURLY BRACKET|'TILDE|#CANCEL TAG|#VARIATION SELECTOR-17|78|79|620|71|72|73|74|75|76|77|78|79|630|71|72|73|74|75|76|77|78|79|640|71|72|73|74|75|76|77|78|79|650|71|72|73|74|75|76|77|78|79|660|71|72|73|74|75|76|77|78|79|670|71|72|73|74|75|76|77|78|79|680|71|72|73|74|75|76|77|78|79|690|71|72|73|74|75|76|77|78|79|6100|81|82|83|84|85|86|87|88|89|710|81|82|83|84|85|86|87|88|89|720|81|82|83|84|85|86|87|88|89|730|81|82|83|84|85|86|87|88|89|740|81|82|83|84|85|86|87|88|89|750|81|82|83|84|85|86|87|88|89|760|81|82|83|84|85|86|87|88|89|770|81|82|83|84|85|86|87|88|89|780|81|82|83|84|85|86|87|88|89|790|81|82|83|84|85|86|87|88|89|6200|81|82|83|84|85|86|87|88|89|710|81|82|83|84|85|86|87|88|89|720|81|82|83|84|85|86|87|88|89|730|81|82|83|84|85|86|87|88|89|740|81|82|83|84|85|86|87|88|89|750|81|82|83|84|85|86";
var ControlNames = "0 NULL|1 START OF HEADING|2 START OF TEXT|3 END OF TEXT|4 END OF TRANSMISSION|5 ENQUIRY|6 ACKNOWLEDGE|7 BELL|8 BACKSPACE|9 CHARACTER TABULATION|a LINE FEED (LF)|b LINE TABULATION|c FORM FEED (FF)|d CARRIAGE RETURN (CR)|e SHIFT OUT|f SHIFT IN|10 DATA LINK ESCAPE|11 DEVICE CONTROL ONE|12 DEVICE CONTROL TWO|13 DEVICE CONTROL THREE|14 DEVICE CONTROL FOUR|15 NEGATIVE ACKNOWLEDGE|16 SYNCHRONOUS IDLE|17 END OF TRANSMISSION BLOCK|18 CANCEL|19 END OF MEDIUM|1a SUBSTITUTE|1b ESCAPE|1c INFORMATION SEPARATOR FOUR|1d INFORMATION SEPARATOR THREE|1e INFORMATION SEPARATOR TWO|1f INFORMATION SEPARATOR ONE|7f DELETE|82 BREAK PERMITTED HERE|83 NO BREAK HERE|85 NEXT LINE (NEL)|86 START OF SELECTED AREA|87 END OF SELECTED AREA|88 CHARACTER TABULATION SET|89 CHARACTER TABULATION WITH JUSTIFICATION|8a LINE TABULATION SET|8b PARTIAL LINE FORWARD|8c PARTIAL LINE BACKWARD|8d REVERSE LINE FEED|8e SINGLE SHIFT TWO|8f SINGLE SHIFT THREE|90 DEVICE CONTROL STRING|91 PRIVATE USE ONE|92 PRIVATE USE TWO|93 SET TRANSMIT STATE|94 CANCEL CHARACTER|95 MESSAGE WAITING|96 START OF GUARDED AREA|97 END OF GUARDED AREA|98 START OF STRING|9a SINGLE CHARACTER INTRODUCER|9b CONTROL SEQUENCE INTRODUCER|9c STRING TERMINATOR|9d OPERATING SYSTEM COMMAND|9e PRIVACY MESSAGE|9f APPLICATION PROGRAM COMMAND";
var GeneralCategoryRuns = "0 Cc|20 Zs|21 Po|24 Sc|25 Po|28 Ps|29 Pe|2a Po|2b Sm|2c Po|2d Pd|2e Po|30 Nd|3a Po|3c Sm|3f Po|41 Lu|5b Ps|5c Po|5d Pe|5e Sk|5f Pc|60 Sk|61 Ll|7b Ps|7c Sm|7d Pe|7e Sm|7f Cc|a0 Zs|a1 Po|a2 Sc|a6 So|a7 Po|a8 Sk|a9 So|aa Lo|ab Pi|ac Sm|ad Cf|ae So|af Sk|b0 So|b1 Sm|b2 No|b4 Sk|b5 Ll|b6 Po|b8 Sk|b9 No|ba Lo|bb Pf|bc No|bf Po|c0 Lu|d7 Sm|d8 Lu|df Ll|f7 Sm|f8 Ll|100 Lu|101 Ll|102 Lu|103 Ll|104 Lu|105 Ll|106 Lu|107 Ll|108 Lu|109 Ll|10a Lu|10b Ll|10c Lu|10d Ll|10e Lu|10f Ll|110 Lu|111 Ll|112 Lu|113 Ll|114 Lu|115 Ll|116 Lu|117 Ll|118 Lu|119 Ll|11a Lu|11b Ll|11c Lu|11d Ll|11e Lu|11f Ll|120 Lu|121 Ll|122 Lu|123 Ll|124 Lu|125 Ll|126 Lu|127 Ll|128 Lu|129 Ll|12a Lu|12b Ll|12c Lu|12d Ll|12e Lu|12f Ll|130 Lu|131 Ll|132 Lu|133 Ll|134 Lu|135 Ll|136 Lu|137 Ll|139 Lu|13a Ll|13b Lu|13c Ll|13d Lu|13e Ll|13f Lu|140 Ll|141 Lu|142 Ll|143 Lu|144 Ll|145 Lu|146 Ll|147 Lu|148 Ll|14a Lu|14b Ll|14c Lu|14d Ll|14e Lu|14f Ll|150 Lu|151 Ll|152 Lu|153 Ll|154 Lu|155 Ll|156 Lu|157 Ll|158 Lu|159 Ll|15a Lu|15b Ll|15c Lu|15d Ll|15e Lu|15f Ll|160 Lu|161 Ll|162 Lu|163 Ll|164 Lu|165 Ll|166 Lu|167 Ll|168 Lu|169 Ll|16a Lu|16b Ll|16c Lu|16d Ll|16e Lu|16f Ll|170 Lu|171 Ll|172 Lu|173 Ll|174 Lu|175 Ll|176 Lu|177 Ll|178 Lu|17a Ll|17b Lu|17c Ll|17d Lu|17e Ll|181 Lu|183 Ll|184 Lu|185 Ll|186 Lu|188 Ll|189 Lu|18c Ll|18e Lu|192 Ll|193 Lu|195 Ll|196 Lu|199 Ll|19c Lu|19e Ll|19f Lu|1a1 Ll|1a2 Lu|1a3 Ll|1a4 Lu|1a5 Ll|1a6 Lu|1a8 Ll|1a9 Lu|1aa Ll|1ac Lu|1ad Ll|1ae Lu|1b0 Ll|1b1 Lu|1b4 Ll|1b5 Lu|1b6 Ll|1b7 Lu|1b9 Ll|1bb Lo|1bc Lu|1bd Ll|1c0 Lo|1c4 Lu|1c5 Lt|1c6 Ll|1c7 Lu|1c8 Lt|1c9 Ll|1ca Lu|1cb Lt|1cc Ll|1cd Lu|1ce Ll|1cf Lu|1d0 Ll|1d1 Lu|1d2 Ll|1d3 Lu|1d4 Ll|1d5 Lu|1d6 Ll|1d7 Lu|1d8 Ll|1d9 Lu|1da Ll|1db Lu|1dc Ll|1de Lu|1df Ll|1e0 Lu|1e1 Ll|1e2 Lu|1e3 Ll|1e4 Lu|1e5 Ll|1e6 Lu|1e7 Ll|1e8 Lu|1e9 Ll|1ea Lu|1eb Ll|1ec Lu|1ed Ll|1ee Lu|1ef Ll|1f1 Lu|1f2 Lt|1f3 Ll|1f4 Lu|1f5 Ll|1f6 Lu|1f9 Ll|1fa Lu|1fb Ll|1fc Lu|1fd Ll|1fe Lu|1ff Ll|200 Lu|201 Ll|202 Lu|203 Ll|204 Lu|205 Ll|206 Lu|207 Ll|208 Lu|209 Ll|20a Lu|20b Ll|20c Lu|20d Ll|20e Lu|20f Ll|210 Lu|211 Ll|212 Lu|213 Ll|214 Lu|215 Ll|216 Lu|217 Ll|218 Lu|219 Ll|21a Lu|21b Ll|21c Lu|21d Ll|21e Lu|21f Ll|220 Lu|221 Ll|222 Lu|223 Ll|224 Lu|225 Ll|226 Lu|227 Ll|228 Lu|229 Ll|22a Lu|22b Ll|22c Lu|22d Ll|22e Lu|22f Ll|230 Lu|231 Ll|232 Lu|233 Ll|23a Lu|23c Ll|23d Lu|23f Ll|241 Lu|242 Ll|243 Lu|247 Ll|248 Lu|249 Ll|24a Lu|24b Ll|24c Lu|24d Ll|24e Lu|24f Ll|294 Lo|296 Ll|2b0 Lm|2c2 Sk|2c6 Lm|2d2 Sk|2e0 Lm|2e5 Sk|2ec Lm|2ed Sk|2ee Lm|2ef Sk|300 Mn|370 Lu|371 Ll|372 Lu|373 Ll|374 Lm|375 Sk|376 Lu|377 Ll|378 |37a Lm|37b Ll|37e Po|37f Lu|380 |384 Sk|386 Lu|387 Po|388 Lu|38b |38c Lu|38d |38e Lu|390 Ll|391 Lu|3a2 |3a3 Lu|3ac Ll|3cf Lu|3d0 Ll|3d2 Lu|3d5 Ll|3d8 Lu|3d9 Ll|3da Lu|3db Ll|3dc Lu|3dd Ll|3de Lu|3df Ll|3e0 Lu|3e1 Ll|3e2 Lu|3e3 Ll|3e4 Lu|3e5 Ll|3e6 Lu|3e7 Ll|3e8 Lu|3e9 Ll|3ea Lu|3eb Ll|3ec Lu|3ed Ll|3ee Lu|3ef Ll|3f4 Lu|3f5 Ll|3f6 Sm|3f7 Lu|3f8 Ll|3f9 Lu|3fb Ll|3fd Lu|430 Ll|460 Lu|461 Ll|462 Lu|463 Ll|464 Lu|465 Ll|466 Lu|467 Ll|468 Lu|469 Ll|46a Lu|46b Ll|46c Lu|46d Ll|46e Lu|46f Ll|470 Lu|471 Ll|472 Lu|473 Ll|474 Lu|475 Ll|476 Lu|477 Ll|478 Lu|479 Ll|47a Lu|47b Ll|47c Lu|47d Ll|47e Lu|47f Ll|480 Lu|481 Ll|482 So|483 Mn|488 Me|48a Lu|48b Ll|48c Lu|48d Ll|48e Lu|48f Ll|490 Lu|491 Ll|492 Lu|493 Ll|494 Lu|495 Ll|496 Lu|497 Ll|498 Lu|499 Ll|49a Lu|49b Ll|49c Lu|49d Ll|49e Lu|49f Ll|4a0 Lu|4a1 Ll|4a2 Lu|4a3 Ll|4a4 Lu|4a5 Ll|4a6 Lu|4a7 Ll|4a8 Lu|4a9 Ll|4aa Lu|4ab Ll|4ac Lu|4ad Ll|4ae Lu|4af Ll|4b0 Lu|4b1 Ll|4b2 Lu|4b3 Ll|4b4 Lu|4b5 Ll|4b6 Lu|4b7 Ll|4b8 Lu|4b9 Ll|4ba Lu|4bb Ll|4bc Lu|4bd Ll|4be Lu|4bf Ll|4c0 Lu|4c2 Ll|4c3 Lu|4c4 Ll|4c5 Lu|4c6 Ll|4c7 Lu|4c8 Ll|4c9 Lu|4ca Ll|4cb Lu|4cc Ll|4cd Lu|4ce Ll|4d0 Lu|4d1 Ll|4d2 Lu|4d3 Ll|4d4 Lu|4d5 Ll|4d6 Lu|4d7 Ll|4d8 Lu|4d9 Ll|4da Lu|4db Ll|4dc Lu|4dd Ll|4de Lu|4df Ll|4e0 Lu|4e1 Ll|4e2 Lu|4e3 Ll|4e4 Lu|4e5 Ll|4e6 Lu|4e7 Ll|4e8 Lu|4e9 Ll|4ea Lu|4eb Ll|4ec Lu|4ed Ll|4ee Lu|4ef Ll|4f0 Lu|4f1 Ll|4f2 Lu|4f3 Ll|4f4 Lu|4f5 Ll|4f6 Lu|4f7 Ll|4f8 Lu|4f9 Ll|4fa Lu|4fb Ll|4fc Lu|4fd Ll|4fe Lu|4ff Ll|500 Lu|501 Ll|502 Lu|503 Ll|504 Lu|505 Ll|506 Lu|507 Ll|508 Lu|509 Ll|50a Lu|50b Ll|50c Lu|50d Ll|50e Lu|50f Ll|510 Lu|511 Ll|512 Lu|513 Ll|514 Lu|515 Ll|516 Lu|517 Ll|518 Lu|519 Ll|51a Lu|51b Ll|51c Lu|51d Ll|51e Lu|51f Ll|520 Lu|521 Ll|522 Lu|523 Ll|524 Lu|525 Ll|526 Lu|527 Ll|528 Lu|529 Ll|52a Lu|52b Ll|52c Lu|52d Ll|52e Lu|52f Ll|530 |531 Lu|557 |558 Lm|55a Po|560 Ll|589 Po|58a Pd|58b Lm|58d So|58f Sc|590 |591 Mn|5be Pd|5bf Mn|5c0 Po|5c1 Mn|5c3 Po|5c4 Mn|5c6 Po|5c7 Mn|5ca |5d0 Lo|5eb |5ef Lo|5f3 Po|5f5 |600 Cf|606 Sm|609 Po|60b Sc|60c Po|60e So|610 Mn|61b Po|61c Cf|61d Po|620 Lo|640 Lm|641 Lo|64b Mn|660 Nd|66a Po|66e Lo|670 Mn|671 Lo|6d4 Po|6d5 Lo|6d6 Mn|6dd Cf|6de So|6df Mn|6e5 Lm|6e7 Mn|6e9 So|6ea Mn|6ee Lo|6f0 Nd|6fa Lo|6fd So|6ff Lo|700 Po|70e |70f Cf|710 Lo|711 Mn|712 Lo|730 Mn|74b |74d Lo|7a6 Mn|7b1 Lo|7b2 |7c0 Nd|7ca Lo|7eb Mn|7f4 Lm|7f6 So|7f7 Po|7fa Lm|7fb |7fd Mn|7fe Sc|800 Lo|816 Mn|81a Lm|81b Mn|824 Lm|825 Mn|828 Lm|829 Mn|82e |830 Po|83f |840 Lo|859 Mn|85c |85e Po|85f |860 Lo|86b |870 Lo|888 Sk|889 Lo|890 Cf|892 |897 Mn|8a0 Lo|8c9 Lm|8ca Mn|8e2 Cf|8e3 Mn|903 Mc|904 Lo|93a Mn|93b Mc|93c Mn|93d Lo|93e Mc|941 Mn|949 Mc|94d Mn|94e Mc|950 Lo|951 Mn|958 Lo|962 Mn|964 Po|966 Nd|970 Po|971 Lm|972 Lo|981 Mn|982 Mc|984 |985 Lo|98d |98f Lo|991 |993 Lo|9a9 |9aa Lo|9b1 |9b2 Lo|9b3 |9b6 Lo|9ba |9bc Mn|9bd Lo|9be Mc|9c1 Mn|9c5 |9c7 Mc|9c9 |9cb Mc|9cd Mn|9ce Lo|9cf |9d7 Mc|9d8 |9dc Lo|9de |9df Lo|9e2 Mn|9e4 |9e6 Nd|9f0 Lo|9f2 Sc|9f4 No|9fa So|9fb Sc|9fc Lo|9fd Po|9fe Mn|9ff |a01 Mn|a03 Mc|a04 |a05 Lo|a0b |a0f Lo|a11 |a13 Lo|a29 |a2a Lo|a31 |a32 Lo|a34 |a35 Lo|a37 |a38 Lo|a3a |a3c Mn|a3d |a3e Mc|a41 Mn|a43 |a47 Mn|a49 |a4b Mn|a4e |a51 Mn|a52 |a59 Lo|a5d |a5e Lo|a5f |a66 Nd|a70 Mn|a72 Lo|a75 Mn|a76 Po|a77 |a81 Mn|a83 Mc|a84 |a85 Lo|a8e |a8f Lo|a92 |a93 Lo|aa9 |aaa Lo|ab1 |ab2 Lo|ab4 |ab5 Lo|aba |abc Mn|abd Lo|abe Mc|ac1 Mn|ac6 |ac7 Mn|ac9 Mc|aca |acb Mc|acd Mn|ace |ad0 Lo|ad1 |ae0 Lo|ae2 Mn|ae4 |ae6 Nd|af0 Po|af1 Sc|af2 |af9 Lo|afa Mn|b00 |b01 Mn|b02 Mc|b04 |b05 Lo|b0d |b0f Lo|b11 |b13 Lo|b29 |b2a Lo|b31 |b32 Lo|b34 |b35 Lo|b3a |b3c Mn|b3d Lo|b3e Mc|b3f Mn|b40 Mc|b41 Mn|b45 |b47 Mc|b49 |b4b Mc|b4d Mn|b4e |b53 Mn|b57 Mc|b58 |b5c Lo|b5e |b5f Lo|b62 Mn|b64 |b66 Nd|b70 So|b71 Lo|b72 No|b78 |b82 Mn|b83 Lo|b84 |b85 Lo|b8b |b8e Lo|b91 |b92 Lo|b96 |b99 Lo|b9b |b9c Lo|b9d |b9e Lo|ba0 |ba3 Lo|ba5 |ba8 Lo|bab |bae Lo|bba |bbe Mc|bc0 Mn|bc1 Mc|bc3 |bc6 Mc|bc9 |bca Mc|bcd Mn|bce |bd0 Lo|bd1 |bd7 Mc|bd8 |be6 Nd|bf0 No|bf3 So|bf9 Sc|bfa So|bfb |c00 Mn|c01 Mc|c04 Mn|c05 Lo|c0d |c0e Lo|c11 |c12 Lo|c29 |c2a Lo|c3a |c3c Mn|c3d Lo|c3e Mn|c41 Mc|c45 |c46 Mn|c49 |c4a Mn|c4e |c55 Mn|c57 |c58 Lo|c5b |c5c Lo|c5e |c60 Lo|c62 Mn|c64 |c66 Nd|c70 |c77 Po|c78 No|c7f So|c80 Lo|c81 Mn|c82 Mc|c84 Po|c85 Lo|c8d |c8e Lo|c91 |c92 Lo|ca9 |caa Lo|cb4 |cb5 Lo|cba |cbc Mn|cbd Lo|cbe Mc|cbf Mn|cc0 Mc|cc5 |cc6 Mn|cc7 Mc|cc9 |cca Mc|ccc Mn|cce |cd5 Mc|cd7 |cdc Lo|cdf |ce0 Lo|ce2 Mn|ce4 |ce6 Nd|cf0 |cf1 Lo|cf3 Mc|cf4 |d00 Mn|d02 Mc|d04 Lo|d0d |d0e Lo|d11 |d12 Lo|d3b Mn|d3d Lo|d3e Mc|d41 Mn|d45 |d46 Mc|d49 |d4a Mc|d4d Mn|d4e Lo|d4f So|d50 |d54 Lo|d57 Mc|d58 No|d5f Lo|d62 Mn|d64 |d66 Nd|d70 No|d79 So|d7a Lo|d80 |d81 Mn|d82 Mc|d84 |d85 Lo|d97 |d9a Lo|db2 |db3 Lo|dbc |dbd Lo|dbe |dc0 Lo|dc7 |dca Mn|dcb |dcf Mc|dd2 Mn|dd5 |dd6 Mn|dd7 |dd8 Mc|de0 |de6 Nd|df0 |df2 Mc|df4 Po|df5 |e01 Lo|e31 Mn|e32 Lo|e34 Mn|e3b |e3f Sc|e40 Lo|e46 Lm|e47 Mn|e4f Po|e50 Nd|e5a Po|e5c |e81 Lo|e83 |e84 Lo|e85 |e86 Lo|e8b |e8c Lo|ea4 |ea5 Lo|ea6 |ea7 Lo|eb1 Mn|eb2 Lo|eb4 Mn|ebd Lo|ebe |ec0 Lo|ec5 |ec6 Lm|ec7 |ec8 Mn|ecf |ed0 Nd|eda |edc Lo|ee0 |f00 Lo|f01 So|f04 Po|f13 So|f14 Po|f15 So|f18 Mn|f1a So|f20 Nd|f2a No|f34 So|f35 Mn|f36 So|f37 Mn|f38 So|f39 Mn|f3a Ps|f3b Pe|f3c Ps|f3d Pe|f3e Mc|f40 Lo|f48 |f49 Lo|f6d |f71 Mn|f7f Mc|f80 Mn|f85 Po|f86 Mn|f88 Lo|f8d Mn|f98 |f99 Mn|fbd |fbe So|fc6 Mn|fc7 So|fcd |fce So|fd0 Po|fd5 So|fd9 Po|fdb |1000 Lo|102b Mc|102d Mn|1031 Mc|1032 Mn|1038 Mc|1039 Mn|103b Mc|103d Mn|103f Lo|1040 Nd|104a Po|1050 Lo|1056 Mc|1058 Mn|105a Lo|105e Mn|1061 Lo|1062 Mc|1065 Lo|1067 Mc|106e Lo|1071 Mn|1075 Lo|1082 Mn|1083 Mc|1085 Mn|1087 Mc|108d Mn|108e Lo|108f Mc|1090 Nd|109a Mc|109d Mn|109e So|10a0 Lu|10c6 |10c7 Lu|10c8 |10cd Lu|10ce |10d0 Ll|10fb Po|10fc Lm|10fd Ll|1100 Lo|1249 |124a Lo|124e |1250 Lo|1257 |1258 Lo|1259 |125a Lo|125e |1260 Lo|1289 |128a Lo|128e |1290 Lo|12b1 |12b2 Lo|12b6 |12b8 Lo|12bf |12c0 Lo|12c1 |12c2 Lo|12c6 |12c8 Lo|12d7 |12d8 Lo|1311 |1312 Lo|1316 |1318 Lo|135b |135d Mn|1360 Po|1369 No|137d |1380 Lo|1390 So|139a |13a0 Lu|13f6 |13f8 Ll|13fe |1400 Pd|1401 Lo|166d So|166e Po|166f Lo|1680 Zs|1681 Lo|169b Ps|169c Pe|169d |16a0 Lo|16eb Po|16ee Nl|16f1 Lo|16f9 |1700 Lo|1712 Mn|1715 Mc|1716 |171f Lo|1732 Mn|1734 Mc|1735 Po|1737 |1740 Lo|1752 Mn|1754 |1760 Lo|176d |176e Lo|1771 |1772 Mn|1774 |1780 Lo|17b4 Mn|17b6 Mc|17b7 Mn|17be Mc|17c6 Mn|17c7 Mc|17c9 Mn|17d4 Po|17d7 Lm|17d8 Po|17db Sc|17dc Lo|17dd Mn|17de |17e0 Nd|17ea |17f0 No|17fa |1800 Po|1806 Pd|1807 Po|180b Mn|180e Cf|180f Mn|1810 Nd|181a |1820 Lo|1843 Lm|1844 Lo|1879 |1880 Lo|1885 Mn|1887 Lo|18a9 Mn|18aa Lo|18ab |18b0 Lo|18f6 |1900 Lo|191f |1920 Mn|1923 Mc|1927 Mn|1929 Mc|192c |1930 Mc|1932 Mn|1933 Mc|1939 Mn|193c |1940 So|1941 |1944 Po|1946 Nd|1950 Lo|196e |1970 Lo|1975 |1980 Lo|19ac |19b0 Lo|19ca |19d0 Nd|19da No|19db |19de So|1a00 Lo|1a17 Mn|1a19 Mc|1a1b Mn|1a1c |1a1e Po|1a20 Lo|1a55 Mc|1a56 Mn|1a57 Mc|1a58 Mn|1a5f |1a60 Mn|1a61 Mc|1a62 Mn|1a63 Mc|1a65 Mn|1a6d Mc|1a73 Mn|1a7d |1a7f Mn|1a80 Nd|1a8a |1a90 Nd|1a9a |1aa0 Po|1aa7 Lm|1aa8 Po|1aae |1ab0 Mn|1abe Me|1abf Mn|1af1 |1b00 Mn|1b04 Mc|1b05 Lo|1b34 Mn|1b35 Mc|1b36 Mn|1b3b Mc|1b3c Mn|1b3d Mc|1b42 Mn|1b43 Mc|1b45 Lo|1b4d |1b4e Po|1b50 Nd|1b5a Po|1b61 So|1b6b Mn|1b74 So|1b7d Po|1b80 Mn|1b82 Mc|1b83 Lo|1ba1 Mc|1ba2 Mn|1ba6 Mc|1ba8 Mn|1baa Mc|1bab Mn|1bae Lo|1bb0 Nd|1bba Lo|1be6 Mn|1be7 Mc|1be8 Mn|1bea Mc|1bed Mn|1bee Mc|1bef Mn|1bf2 Mc|1bf4 |1bfc Po|1c00 Lo|1c24 Mc|1c2c Mn|1c34 Mc|1c36 Mn|1c38 |1c3b Po|1c40 Nd|1c4a |1c4d Lo|1c50 Nd|1c5a Lo|1c78 Lm|1c7e Po|1c80 Ll|1c89 Lu|1c8a Ll|1c8b |1c90 Lu|1cbb |1cbd Lu|1cc0 Po|1cc8 |1cd0 Mn|1cd3 Po|1cd4 Mn|1ce1 Mc|1ce2 Mn|1ce9 Lo|1ced Mn|1cee Lo|1cf4 Mn|1cf5 Lo|1cf7 Mc|1cf8 Mn|1cfa Lo|1cfb |1d00 Ll|1d2c Lm|1d6b Ll|1d78 Lm|1d79 Ll|1d9b Lm|1dc0 Mn|1e00 Lu|1e01 Ll|1e02 Lu|1e03 Ll|1e04 Lu|1e05 Ll|1e06 Lu|1e07 Ll|1e08 Lu|1e09 Ll|1e0a Lu|1e0b Ll|1e0c Lu|1e0d Ll|1e0e Lu|1e0f Ll|1e10 Lu|1e11 Ll|1e12 Lu|1e13 Ll|1e14 Lu|1e15 Ll|1e16 Lu|1e17 Ll|1e18 Lu|1e19 Ll|1e1a Lu|1e1b Ll|1e1c Lu|1e1d Ll|1e1e Lu|1e1f Ll|1e20 Lu|1e21 Ll|1e22 Lu|1e23 Ll|1e24 Lu|1e25 Ll|1e26 Lu|1e27 Ll|1e28 Lu|1e29 Ll|1e2a Lu|1e2b Ll|1e2c Lu|1e2d Ll|1e2e Lu|1e2f Ll|1e30 Lu|1e31 Ll|1e32 Lu|1e33 Ll|1e34 Lu|1e35 Ll|1e36 Lu|1e37 Ll|1e38 Lu|1e39 Ll|1e3a Lu|1e3b Ll|1e3c Lu|1e3d Ll|1e3e Lu|1e3f Ll|1e40 Lu|1e41 Ll|1e42 Lu|1e43 Ll|1e44 Lu|1e45 Ll|1e46 Lu|1e47 Ll|1e48 Lu|1e49 Ll|1e4a Lu|1e4b Ll|1e4c Lu|1e4d Ll|1e4e Lu|1e4f Ll|1e50 Lu|1e51 Ll|1e52 Lu|1e53 Ll|1e54 Lu|1e55 Ll|1e56 Lu|1e57 Ll|1e58 Lu|1e59 Ll|1e5a Lu|1e5b Ll|1e5c Lu|1e5d Ll|1e5e Lu|1e5f Ll|1e60 Lu|1e61 Ll|1e62 Lu|1e63 Ll|1e64 Lu|1e65 Ll|1e66 Lu|1e67 Ll|1e68 Lu|1e69 Ll|1e6a Lu|1e6b Ll|1e6c Lu|1e6d Ll|1e6e Lu|1e6f Ll|1e70 Lu|1e71 Ll|1e72 Lu|1e73 Ll|1e74 Lu|1e75 Ll|1e76 Lu|1e77 Ll|1e78 Lu|1e79 Ll|1e7a Lu|1e7b Ll|1e7c Lu|1e7d Ll|1e7e Lu|1e7f Ll|1e80 Lu|1e81 Ll|1e82 Lu|1e83 Ll|1e84 Lu|1e85 Ll|1e86 Lu|1e87 Ll|1e88 Lu|1e89 Ll|1e8a Lu|1e8b Ll|1e8c Lu|1e8d Ll|1e8e Lu|1e8f Ll|1e90 Lu|1e91 Ll|1e92 Lu|1e93 Ll|1e94 Lu|1e95 Ll|1e9e Lu|1e9f Ll|1ea0 Lu|1ea1 Ll|1ea2 Lu|1ea3 Ll|1ea4 Lu|1ea5 Ll|1ea6 Lu|1ea7 Ll|1ea8 Lu|1ea9 Ll|1eaa Lu|1eab Ll|1eac Lu|1ead Ll|1eae Lu|1eaf Ll|1eb0 Lu|1eb1 Ll|1eb2 Lu|1eb3 Ll|1eb4 Lu|1eb5 Ll|1eb6 Lu|1eb7 Ll|1eb8 Lu|1eb9 Ll|1eba Lu|1ebb Ll|1ebc Lu|1ebd Ll|1ebe Lu|1ebf Ll|1ec0 Lu|1ec1 Ll|1ec2 Lu|1ec3 Ll|1ec4 Lu|1ec5 Ll|1ec6 Lu|1ec7 Ll|1ec8 Lu|1ec9 Ll|1eca Lu|1ecb Ll|1ecc Lu|1ecd Ll|1ece Lu|1ecf Ll|1ed0 Lu|1ed1 Ll|1ed2 Lu|1ed3 Ll|1ed4 Lu|1ed5 Ll|1ed6 Lu|1ed7 Ll|1ed8 Lu|1ed9 Ll|1eda Lu|1edb Ll|1edc Lu|1edd Ll|1ede Lu|1edf Ll|1ee0 Lu|1ee1 Ll|1ee2 Lu|1ee3 Ll|1ee4 Lu|1ee5 Ll|1ee6 Lu|1ee7 Ll|1ee8 Lu|1ee9 Ll|1eea Lu|1eeb Ll|1eec Lu|1eed Ll|1eee Lu|1eef Ll|1ef0 Lu|1ef1 Ll|1ef2 Lu|1ef3 Ll|1ef4 Lu|1ef5 Ll|1ef6 Lu|1ef7 Ll|1ef8 Lu|1ef9 Ll|1efa Lu|1efb Ll|1efc Lu|1efd Ll|1efe Lu|1eff Ll|1f08 Lu|1f10 Ll|1f16 |1f18 Lu|1f1e |1f20 Ll|1f28 Lu|1f30 Ll|1f38 Lu|1f40 Ll|1f46 |1f48 Lu|1f4e |1f50 Ll|1f58 |1f59 Lu|1f5a |1f5b Lu|1f5c |1f5d Lu|1f5e |1f5f Lu|1f60 Ll|1f68 Lu|1f70 Ll|1f7e |1f80 Ll|1f88 Lt|1f90 Ll|1f98 Lt|1fa0 Ll|1fa8 Lt|1fb0 Ll|1fb5 |1fb6 Ll|1fb8 Lu|1fbc Lt|1fbd Sk|1fbe Ll|1fbf Sk|1fc2 Ll|1fc5 |1fc6 Ll|1fc8 Lu|1fcc Lt|1fcd Sk|1fd0 Ll|1fd4 |1fd6 Ll|1fd8 Lu|1fdc |1fdd Sk|1fe0 Ll|1fe8 Lu|1fed Sk|1ff0 |1ff2 Ll|1ff5 |1ff6 Ll|1ff8 Lu|1ffc Lt|1ffd Sk|1fff |2000 Zs|200b Cf|2010 Pd|2016 Po|2018 Pi|2019 Pf|201a Ps|201b Pi|201d Pf|201e Ps|201f Pi|2020 Po|2028 Zl|2029 Zp|202a Cf|202f Zs|2030 Po|2039 Pi|203a Pf|203b Po|203f Pc|2041 Po|2044 Sm|2045 Ps|2046 Pe|2047 Po|2052 Sm|2053 Po|2054 Pc|2055 Po|205f Zs|2060 Cf|2065 |2066 Cf|2070 No|2071 Lm|2072 |2074 No|207a Sm|207d Ps|207e Pe|207f Lm|2080 No|208a Sm|208d Ps|208e Pe|208f Lm|20a0 Sc|20c5 |20d0 Mn|20dd Me|20e1 Mn|20e2 Me|20e5 Mn|20f1 |2100 So|2102 Lu|2103 So|2107 Lu|2108 So|210a Ll|210b Lu|210e Ll|2110 Lu|2113 Ll|2114 So|2115 Lu|2116 So|2118 Sm|2119 Lu|211e So|2124 Lu|2125 So|2126 Lu|2127 So|2128 Lu|2129 So|212a Lu|212e So|212f Ll|2130 Lu|2134 Ll|2135 Lo|2139 Ll|213a So|213c Ll|213e Lu|2140 Sm|2145 Lu|2146 Ll|214a So|214b Sm|214c So|214e Ll|214f So|2150 No|2160 Nl|2183 Lu|2184 Ll|2185 Nl|2189 No|218a So|218c |2190 Sm|2195 So|219a Sm|219c So|21a0 Sm|21a1 So|21a3 Sm|21a4 So|21a6 Sm|21a7 So|21ae Sm|21af So|21ce Sm|21d0 So|21d2 Sm|21d3 So|21d4 Sm|21d5 So|21f4 Sm|2300 So|2308 Ps|2309 Pe|230a Ps|230b Pe|230c So|2320 Sm|2322 So|2329 Ps|232a Pe|232b So|237c Sm|237d So|239b Sm|23b4 So|23dc Sm|23e2 So|242a |2440 So|244b |2460 No|249c So|24ea No|2500 So|25b7 Sm|25b8 So|25c1 Sm|25c2 So|25f8 Sm|2600 So|266f Sm|2670 So|2768 Ps|2769 Pe|276a Ps|276b Pe|276c Ps|276d Pe|276e Ps|276f Pe|2770 Ps|2771 Pe|2772 Ps|2773 Pe|2774 Ps|2775 Pe|2776 No|2794 So|27c0 Sm|27c5 Ps|27c6 Pe|27c7 Sm|27e6 Ps|27e7 Pe|27e8 Ps|27e9 Pe|27ea Ps|27eb Pe|27ec Ps|27ed Pe|27ee Ps|27ef Pe|27f0 Sm|2800 So|2900 Sm|2983 Ps|2984 Pe|2985 Ps|2986 Pe|2987 Ps|2988 Pe|2989 Ps|298a Pe|298b Ps|298c Pe|298d Ps|298e Pe|298f Ps|2990 Pe|2991 Ps|2992 Pe|2993 Ps|2994 Pe|2995 Ps|2996 Pe|2997 Ps|2998 Pe|2999 Sm|29d8 Ps|29d9 Pe|29da Ps|29db Pe|29dc Sm|29fc Ps|29fd Pe|29fe Sm|2b00 So|2b30 Sm|2b45 So|2b47 Sm|2b4d So|2b74 |2b76 So|2c00 Lu|2c30 Ll|2c60 Lu|2c61 Ll|2c62 Lu|2c65 Ll|2c67 Lu|2c68 Ll|2c69 Lu|2c6a Ll|2c6b Lu|2c6c Ll|2c6d Lu|2c71 Ll|2c72 Lu|2c73 Ll|2c75 Lu|2c76 Ll|2c7c Lm|2c7e Lu|2c81 Ll|2c82 Lu|2c83 Ll|2c84 Lu|2c85 Ll|2c86 Lu|2c87 Ll|2c88 Lu|2c89 Ll|2c8a Lu|2c8b Ll|2c8c Lu|2c8d Ll|2c8e Lu|2c8f Ll|2c90 Lu|2c91 Ll|2c92 Lu|2c93 Ll|2c94 Lu|2c95 Ll|2c96 Lu|2c97 Ll|2c98 Lu|2c99 Ll|2c9a Lu|2c9b Ll|2c9c Lu|2c9d Ll|2c9e Lu|2c9f Ll|2ca0 Lu|2ca1 Ll|2ca2 Lu|2ca3 Ll|2ca4 Lu|2ca5 Ll|2ca6 Lu|2ca7 Ll|2ca8 Lu|2ca9 Ll|2caa Lu|2cab Ll|2cac Lu|2cad Ll|2cae Lu|2caf Ll|2cb0 Lu|2cb1 Ll|2cb2 Lu|2cb3 Ll|2cb4 Lu|2cb5 Ll|2cb6 Lu|2cb7 Ll|2cb8 Lu|2cb9 Ll|2cba Lu|2cbb Ll|2cbc Lu|2cbd Ll|2cbe Lu|2cbf Ll|2cc0 Lu|2cc1 Ll|2cc2 Lu|2cc3 Ll|2cc4 Lu|2cc5 Ll|2cc6 Lu|2cc7 Ll|2cc8 Lu|2cc9 Ll|2cca Lu|2ccb Ll|2ccc Lu|2ccd Ll|2cce Lu|2ccf Ll|2cd0 Lu|2cd1 Ll|2cd2 Lu|2cd3 Ll|2cd4 Lu|2cd5 Ll|2cd6 Lu|2cd7 Ll|2cd8 Lu|2cd9 Ll|2cda Lu|2cdb Ll|2cdc Lu|2cdd Ll|2cde Lu|2cdf Ll|2ce0 Lu|2ce1 Ll|2ce2 Lu|2ce3 Ll|2ce5 So|2ceb Lu|2cec Ll|2ced Lu|2cee Ll|2cef Mn|2cf2 Lu|2cf3 Ll|2cf4 |2cf9 Po|2cfd No|2cfe Po|2d00 Ll|2d26 |2d27 Ll|2d28 |2d2d Ll|2d2e |2d30 Lo|2d68 |2d6f Lm|2d70 Po|2d71 |2d7f Mn|2d80 Lo|2d97 |2da0 Lo|2da7 |2da8 Lo|2daf |2db0 Lo|2db7 |2db8 Lo|2dbf |2dc0 Lo|2dc7 |2dc8 Lo|2dcf |2dd0 Lo|2dd7 |2dd8 Lo|2ddf |2de0 Mn|2e00 Po|2e02 Pi|2e03 Pf|2e04 Pi|2e05 Pf|2e06 Po|2e09 Pi|2e0a Pf|2e0b Po|2e0c Pi|2e0d Pf|2e0e Po|2e17 Pd|2e18 Po|2e1a Pd|2e1b Po|2e1c Pi|2e1d Pf|2e1e Po|2e20 Pi|2e21 Pf|2e22 Ps|2e23 Pe|2e24 Ps|2e25 Pe|2e26 Ps|2e27 Pe|2e28 Ps|2e29 Pe|2e2a Po|2e2f Lm|2e30 Po|2e3a Pd|2e3c Po|2e40 Pd|2e41 Po|2e42 Ps|2e43 Po|2e50 So|2e52 Po|2e55 Ps|2e56 Pe|2e57 Ps|2e58 Pe|2e59 Ps|2e5a Pe|2e5b Ps|2e5c Pe|2e5d Pd|2e5e |2e60 Po|2e62 Ps|2e63 Pe|2e64 |2e80 So|2e9a |2e9b So|2ef4 |2f00 So|2fd6 |2ff0 So|3000 Zs|3001 Po|3004 So|3005 Lm|3006 Lo|3007 Nl|3008 Ps|3009 Pe|300a Ps|300b Pe|300c Ps|300d Pe|300e Ps|300f Pe|3010 Ps|3011 Pe|3012 So|3014 Ps|3015 Pe|3016 Ps|3017 Pe|3018 Ps|3019 Pe|301a Ps|301b Pe|301c Pd|301d Ps|301e Pe|3020 So|3021 Nl|302a Mn|302e Mc|3030 Pd|3031 Lm|3036 So|3038 Nl|303b Lm|303c Lo|303d Po|303e So|3040 |3041 Lo|3097 |3099 Mn|309b Sk|309d Lm|309f Lo|30a0 Pd|30a1 Lo|30fb Po|30fc Lm|30ff Lo|3100 |3105 Lo|3130 |3131 Lo|318f |3190 So|3192 No|3196 So|31a0 Lo|31c0 So|31e6 |31ef So|31f0 Lo|3200 So|321f |3220 No|322a So|3248 No|3250 So|3251 No|3260 So|3280 No|328a So|32b1 No|32c0 So|3400 Lo|4dc0 So|4e00 Lo|a015 Lm|a016 Lo|a48d |a490 So|a4c7 |a4d0 Lo|a4f8 Lm|a4fe Po|a500 Lo|a60c Lm|a60d Po|a610 Lo|a620 Nd|a62a Lo|a62c |a640 Lu|a641 Ll|a642 Lu|a643 Ll|a644 Lu|a645 Ll|a646 Lu|a647 Ll|a648 Lu|a649 Ll|a64a Lu|a64b Ll|a64c Lu|a64d Ll|a64e Lu|a64f Ll|a650 Lu|a651 Ll|a652 Lu|a653 Ll|a654 Lu|a655 Ll|a656 Lu|a657 Ll|a658 Lu|a659 Ll|a65a Lu|a65b Ll|a65c Lu|a65d Ll|a65e Lu|a65f Ll|a660 Lu|a661 Ll|a662 Lu|a663 Ll|a664 Lu|a665 Ll|a666 Lu|a667 Ll|a668 Lu|a669 Ll|a66a Lu|a66b Ll|a66c Lu|a66d Ll|a66e Lo|a66f Mn|a670 Me|a673 Po|a674 Mn|a67e Po|a67f Lm|a680 Lu|a681 Ll|a682 Lu|a683 Ll|a684 Lu|a685 Ll|a686 Lu|a687 Ll|a688 Lu|a689 Ll|a68a Lu|a68b Ll|a68c Lu|a68d Ll|a68e Lu|a68f Ll|a690 Lu|a691 Ll|a692 Lu|a693 Ll|a694 Lu|a695 Ll|a696 Lu|a697 Ll|a698 Lu|a699 Ll|a69a Lu|a69b Ll|a69c Lm|a69e Mn|a6a0 Lo|a6e6 Nl|a6f0 Mn|a6f2 Po|a6f8 |a700 Sk|a717 Lm|a720 Sk|a722 Lu|a723 Ll|a724 Lu|a725 Ll|a726 Lu|a727 Ll|a728 Lu|a729 Ll|a72a Lu|a72b Ll|a72c Lu|a72d Ll|a72e Lu|a72f Ll|a732 Lu|a733 Ll|a734 Lu|a735 Ll|a736 Lu|a737 Ll|a738 Lu|a739 Ll|a73a Lu|a73b Ll|a73c Lu|a73d Ll|a73e Lu|a73f Ll|a740 Lu|a741 Ll|a742 Lu|a743 Ll|a744 Lu|a745 Ll|a746 Lu|a747 Ll|a748 Lu|a749 Ll|a74a Lu|a74b Ll|a74c Lu|a74d Ll|a74e Lu|a74f Ll|a750 Lu|a751 Ll|a752 Lu|a753 Ll|a754 Lu|a755 Ll|a756 Lu|a757 Ll|a758 Lu|a759 Ll|a75a Lu|a75b Ll|a75c Lu|a75d Ll|a75e Lu|a75f Ll|a760 Lu|a761 Ll|a762 Lu|a763 Ll|a764 Lu|a765 Ll|a766 Lu|a767 Ll|a768 Lu|a769 Ll|a76a Lu|a76b Ll|a76c Lu|a76d Ll|a76e Lu|a76f Ll|a770 Lm|a771 Ll|a779 Lu|a77a Ll|a77b Lu|a77c Ll|a77d Lu|a77f Ll|a780 Lu|a781 Ll|a782 Lu|a783 Ll|a784 Lu|a785 Ll|a786 Lu|a787 Ll|a788 Lm|a789 Sk|a78b Lu|a78c Ll|a78d Lu|a78e Ll|a78f Lo|a790 Lu|a791 Ll|a792 Lu|a793 Ll|a796 Lu|a797 Ll|a798 Lu|a799 Ll|a79a Lu|a79b Ll|a79c Lu|a79d Ll|a79e Lu|a79f Ll|a7a0 Lu|a7a1 Ll|a7a2 Lu|a7a3 Ll|a7a4 Lu|a7a5 Ll|a7a6 Lu|a7a7 Ll|a7a8 Lu|a7a9 Ll|a7aa Lu|a7af Ll|a7b0 Lu|a7b5 Ll|a7b6 Lu|a7b7 Ll|a7b8 Lu|a7b9 Ll|a7ba Lu|a7bb Ll|a7bc Lu|a7bd Ll|a7be Lu|a7bf Ll|a7c0 Lu|a7c1 Ll|a7c2 Lu|a7c3 Ll|a7c4 Lu|a7c8 Ll|a7c9 Lu|a7ca Ll|a7cb Lu|a7cd Ll|a7ce Lu|a7cf Ll|a7d0 Lu|a7d1 Ll|a7d2 Lu|a7d3 Ll|a7d4 Lu|a7d5 Ll|a7d6 Lu|a7d7 Ll|a7d8 Lu|a7d9 Ll|a7da Lu|a7db Ll|a7dc Lu|a7de |a7e2 Lu|a7e3 |a7f1 Lm|a7f5 Lu|a7f6 Ll|a7f7 Lo|a7f8 Lm|a7fa Ll|a7fb Lo|a802 Mn|a803 Lo|a806 Mn|a807 Lo|a80b Mn|a80c Lo|a823 Mc|a825 Mn|a827 Mc|a828 So|a82c Mn|a82d |a830 No|a836 So|a838 Sc|a839 So|a83a |a840 Lo|a874 Po|a878 |a880 Mc|a882 Lo|a8b4 Mc|a8c4 Mn|a8c6 |a8ce Po|a8d0 Nd|a8da |a8e0 Mn|a8f2 Lo|a8f8 Po|a8fb Lo|a8fc Po|a8fd Lo|a8ff Mn|a900 Nd|a90a Lo|a926 Mn|a92e Po|a930 Lo|a947 Mn|a952 Mc|a954 |a95f Po|a960 Lo|a97d |a980 Mn|a983 Mc|a984 Lo|a9b3 Mn|a9b4 Mc|a9b6 Mn|a9ba Mc|a9bc Mn|a9be Mc|a9c1 Po|a9ce |a9cf Lm|a9d0 Nd|a9da |a9de Po|a9e0 Lo|a9e5 Mn|a9e6 Lm|a9e7 Lo|a9f0 Nd|a9fa Lo|a9ff |aa00 Lo|aa29 Mn|aa2f Mc|aa31 Mn|aa33 Mc|aa35 Mn|aa37 |aa40 Lo|aa43 Mn|aa44 Lo|aa4c Mn|aa4d Mc|aa4e |aa50 Nd|aa5a |aa5c Po|aa60 Lo|aa70 Lm|aa71 Lo|aa77 So|aa7a Lo|aa7b Mc|aa7c Mn|aa7d Mc|aa7e Lo|aab0 Mn|aab1 Lo|aab2 Mn|aab5 Lo|aab7 Mn|aab9 Lo|aabe Mn|aac0 Lo|aac1 Mn|aac2 Lo|aac3 |aadb Lo|aadd Lm|aade Po|aae0 Lo|aaeb Mc|aaec Mn|aaee Mc|aaf0 Po|aaf2 Lo|aaf3 Lm|aaf5 Mc|aaf6 Mn|aaf7 |ab01 Lo|ab07 |ab09 Lo|ab0f |ab11 Lo|ab17 |ab20 Lo|ab27 |ab28 Lo|ab2f |ab30 Ll|ab5b Sk|ab5c Lm|ab60 Ll|ab69 Lm|ab6a Sk|ab6c Lu|ab6e |ab70 Ll|abc0 Lo|abe3 Mc|abe5 Mn|abe6 Mc|abe8 Mn|abe9 Mc|abeb Po|abec Mc|abed Mn|abee |abf0 Nd|abfa |ac00 Lo|d7a4 |d7b0 Lo|d7c7 |d7cb Lo|d7fc |d800 Cs|e000 Co|f900 Lo|fa6e |fa70 Lo|fada |fb00 Ll|fb07 |fb13 Ll|fb18 |fb1d Lo|fb1e Mn|fb1f Lo|fb29 Sm|fb2a Lo|fb37 |fb38 Lo|fb3d |fb3e Lo|fb3f |fb40 Lo|fb42 |fb43 Lo|fb45 |fb46 Lo|fbb2 Sk|fbc3 So|fbd3 Lo|fd3e Pe|fd3f Ps|fd40 So|fd50 Lo|fd90 So|fd92 Lo|fdc8 So|fdd0 |fdf0 Lo|fdfc Sc|fdfd So|fe00 Mn|fe10 Po|fe17 Ps|fe18 Pe|fe19 Po|fe1a |fe20 Mn|fe30 Po|fe31 Pd|fe33 Pc|fe35 Ps|fe36 Pe|fe37 Ps|fe38 Pe|fe39 Ps|fe3a Pe|fe3b Ps|fe3c Pe|fe3d Ps|fe3e Pe|fe3f Ps|fe40 Pe|fe41 Ps|fe42 Pe|fe43 Ps|fe44 Pe|fe45 Po|fe47 Ps|fe48 Pe|fe49 Po|fe4d Pc|fe50 Po|fe53 |fe54 Po|fe58 Pd|fe59 Ps|fe5a Pe|fe5b Ps|fe5c Pe|fe5d Ps|fe5e Pe|fe5f Po|fe62 Sm|fe63 Pd|fe64 Sm|fe67 |fe68 Po|fe69 Sc|fe6a Po|fe6c |fe70 Lo|fe75 |fe76 Lo|fefd |feff Cf|ff00 |ff01 Po|ff04 Sc|ff05 Po|ff08 Ps|ff09 Pe|ff0a Po|ff0b Sm|ff0c Po|ff0d Pd|ff0e Po|ff10 Nd|ff1a Po|ff1c Sm|ff1f Po|ff21 Lu|ff3b Ps|ff3c Po|ff3d Pe|ff3e Sk|ff3f Pc|ff40 Sk|ff41 Ll|ff5b Ps|ff5c Sm|ff5d Pe|ff5e Sm|ff5f Ps|ff60 Pe|ff61 Po|ff62 Ps|ff63 Pe|ff64 Po|ff66 Lo|ff70 Lm|ff71 Lo|ff9e Lm|ffa0 Lo|ffbf |ffc2 Lo|ffc8 |ffca Lo|ffd0 |ffd2 Lo|ffd8 |ffda Lo|ffdd |ffe0 Sc|ffe2 Sm|ffe3 Sk|ffe4 So|ffe5 Sc|ffe7 |ffe8 So|ffe9 Sm|ffed So|ffef |fff9 Cf|fffc So|fffe |10000 Lo|1000c |1000d Lo|10027 |10028 Lo|1003b |1003c Lo|1003e |1003f Lo|1004e |10050 Lo|1005e |10080 Lo|100fb |10100 Po|10103 |10107 No|10134 |10137 So|10140 Nl|10175 No|10179 So|1018a No|1018c So|1018f |10190 So|1019d |101a0 So|101a1 |101d0 So|101fd Mn|101fe |10280 Lo|1029d |102a0 Lo|102d1 |102e0 Mn|102e1 No|102fc |10300 Lo|10320 No|10324 |1032d Lo|10341 Nl|10342 Lo|1034a Nl|1034b |10350 Lo|10376 Mn|1037b |10380 Lo|1039e |1039f Po|103a0 Lo|103c4 |103c8 Lo|103d0 Po|103d1 Nl|103d6 |10400 Lu|10428 Ll|10450 Lo|1049e |104a0 Nd|104aa |104b0 Lu|104d4 |104d8 Ll|104fc |10500 Lo|10528 |10530 Lo|10564 |1056f Po|10570 Lu|1057b |1057c Lu|1058b |1058c Lu|10593 |10594 Lu|10596 |10597 Ll|105a2 |105a3 Ll|105b2 |105b3 Ll|105ba |105bb Ll|105bd |105c0 Lo|105f4 |10600 Lo|10737 |10740 Lo|10756 |10760 Lo|10768 |10780 Lm|10786 |10787 Lm|107b1 |107b2 Lm|107c0 |10800 Lo|10806 |10808 Lo|10809 |1080a Lo|10836 |10837 Lo|10839 |1083c Lo|1083d |1083f Lo|10856 |10857 Po|10858 No|10860 Lo|10877 So|10879 No|10880 Lo|1089f |108a7 No|108b0 |108e0 Lo|108f3 |108f4 Lo|108f6 |108fb No|10900 Lo|10916 No|1091c |1091f Po|10920 Lo|1093a |1093f Po|10940 Lo|1095a |10980 Lo|109b8 |109bc No|109be Lo|109c0 No|109d0 |109d2 No|10a00 Lo|10a01 Mn|10a04 |10a05 Mn|10a07 |10a0c Mn|10a10 Lo|10a14 |10a15 Lo|10a18 |10a19 Lo|10a36 |10a38 Mn|10a3b |10a3f Mn|10a40 No|10a49 |10a50 Po|10a59 |10a60 Lo|10a7d No|10a7f Po|10a80 Lo|10a9d No|10aa0 |10ac0 Lo|10ac8 So|10ac9 Lo|10ae5 Mn|10ae7 |10aeb No|10af0 Po|10af7 |10b00 Lo|10b36 |10b39 Po|10b40 Lo|10b56 |10b58 No|10b60 Lo|10b73 |10b78 No|10b80 Lo|10b92 |10b99 Po|10b9d |10ba9 No|10bb0 |10c00 Lo|10c49 |10c80 Lu|10cb3 |10cc0 Ll|10cf3 |10cfa No|10d00 Lo|10d24 Mn|10d28 |10d30 Nd|10d3a |10d40 Nd|10d4a Lo|10d4e Lm|10d4f Lo|10d50 Lu|10d66 |10d69 Mn|10d6e Pd|10d6f Lm|10d70 Ll|10d86 |10d8e Sm|10d90 |10e60 No|10e7f |10e80 Lo|10eaa |10eab Mn|10ead Pd|10eae |10eb0 Lo|10eb2 |10ec2 Lo|10ec5 Lm|10ec6 Lo|10ec8 |10ec9 Sk|10ecb Mn|10ed0 Po|10ed1 So|10ed9 Lo|10eef |10ef0 Mn|10f00 Lo|10f1d No|10f27 Lo|10f28 |10f30 Lo|10f46 Mn|10f51 No|10f55 Po|10f5a |10f70 Lo|10f82 Mn|10f86 Po|10f8a |10fb0 Lo|10fc5 No|10fcc |10fe0 Lo|10ff7 |11000 Mc|11001 Mn|11002 Mc|11003 Lo|11038 Mn|11047 Po|1104e |11052 No|11066 Nd|11070 Mn|11071 Lo|11073 Mn|11075 Lo|11076 |1107f Mn|11082 Mc|11083 Lo|110b0 Mc|110b3 Mn|110b7 Mc|110b9 Mn|110bb Po|110bd Cf|110be Po|110c2 Mn|110c3 |110cd Cf|110ce |110d0 Lo|110e9 |110f0 Nd|110fa |11100 Mn|11103 Lo|11127 Mn|1112c Mc|1112d Mn|11135 |11136 Nd|11140 Po|11144 Lo|11145 Mc|11147 Lo|11148 |11150 Lo|11173 Mn|11174 Po|11176 Lo|11177 |11180 Mn|11182 Mc|11183 Lo|111b3 Mc|111b6 Mn|111bf Mc|111c1 Lo|111c5 Po|111c9 Mn|111cd Po|111ce Mc|111cf Mn|111d0 Nd|111da Lo|111db Po|111dc Lo|111dd Po|111e0 |111e1 No|111f5 |11200 Lo|11212 |11213 Lo|1122c Mc|1122f Mn|11232 Mc|11234 Mn|11235 Mc|11236 Mn|11238 Po|1123e Mn|1123f Lo|11241 Mn|11242 |11280 Lo|11287 |11288 Lo|11289 |1128a Lo|1128e |1128f Lo|1129e |1129f Lo|112a9 Po|112aa |112b0 Lo|112df Mn|112e0 Mc|112e3 Mn|112eb |112f0 Nd|112fa |11300 Mn|11302 Mc|11304 |11305 Lo|1130d |1130f Lo|11311 |11313 Lo|11329 |1132a Lo|11331 |11332 Lo|11334 |11335 Lo|1133a |1133b Mn|1133d Lo|1133e Mc|11340 Mn|11341 Mc|11345 |11347 Mc|11349 |1134b Mc|1134e |11350 Lo|11351 |11357 Mc|11358 |1135d Lo|11362 Mc|11364 |11366 Mn|1136d |11370 Mn|11375 |11380 Lo|1138a |1138b Lo|1138c |1138e Lo|1138f |11390 Lo|113b6 |113b7 Lo|113b8 Mc|113bb Mn|113c1 |113c2 Mc|113c3 |113c5 Mc|113c6 |113c7 Mc|113cb |113cc Mc|113ce Mn|113cf Mc|113d0 Mn|113d1 Lo|113d2 Mn|113d3 Lo|113d4 Po|113d6 |113d7 Po|113d9 |113e1 Mn|113e3 |11400 Lo|11435 Mc|11438 Mn|11440 Mc|11442 Mn|11445 Mc|11446 Mn|11447 Lo|1144b Po|11450 Nd|1145a Po|1145c |1145d Po|1145e Mn|1145f Lo|11462 |11480 Lo|114b0 Mc|114b3 Mn|114b9 Mc|114ba Mn|114bb Mc|114bf Mn|114c1 Mc|114c2 Mn|114c4 Lo|114c6 Po|114c7 Lo|114c8 |114d0 Nd|114da |11580 Lo|115af Mc|115b2 Mn|115b6 |115b8 Mc|115bc Mn|115be Mc|115bf Mn|115c1 Po|115d8 Lo|115dc Mn|115de |11600 Lo|11630 Mc|11633 Mn|1163b Mc|1163d Mn|1163e Mc|1163f Mn|11641 Po|11644 Lo|11645 |11650 Nd|1165a |11660 Po|1166d |11680 Lo|116ab Mn|116ac Mc|116ad Mn|116ae Mc|116b0 Mn|116b6 Mc|116b7 Mn|116b8 Lo|116b9 Po|116ba |116c0 Nd|116ca |116d0 Nd|116e4 |11700 Lo|1171b |1171d Mn|1171e Mc|1171f Mn|11720 Mc|11722 Mn|11726 Mc|11727 Mn|1172c |11730 Nd|1173a No|1173c Po|1173f So|11740 Lo|11747 |11800 Lo|1182c Mc|1182f Mn|11838 Mc|11839 Mn|1183b Po|1183c |118a0 Lu|118c0 Ll|118e0 Nd|118ea No|118f3 |118ff Lo|11907 |11909 Lo|1190a |1190c Lo|11914 |11915 Lo|11917 |11918 Lo|11930 Mc|11936 |11937 Mc|11939 |1193b Mn|1193d Mc|1193e Mn|1193f Lo|11940 Mc|11941 Lo|11942 Mc|11943 Mn|11944 Po|11947 |11950 Nd|1195a |119a0 Lo|119a8 |119aa Lo|119d1 Mc|119d4 Mn|119d8 |119da Mn|119dc Mc|119e0 Mn|119e1 Lo|119e2 Po|119e3 Lo|119e4 Mc|119e5 |11a00 Lo|11a01 Mn|11a0b Lo|11a33 Mn|11a39 Mc|11a3a Lo|11a3b Mn|11a3f Po|11a47 Mn|11a48 |11a50 Lo|11a51 Mn|11a57 Mc|11a59 Mn|11a5c Lo|11a8a Mn|11a97 Mc|11a98 Mn|11a9a Po|11a9d Lo|11a9e Po|11aa3 |11ab0 Lo|11af9 |11b00 Po|11b0a Lo|11b0b |11b60 Mn|11b61 Mc|11b62 Mn|11b65 Mc|11b66 Mn|11b67 Mc|11b68 |11bc0 Lo|11be1 Po|11be2 |11bf0 Nd|11bfa |11c00 Lo|11c09 |11c0a Lo|11c2f Mc|11c30 Mn|11c37 |11c38 Mn|11c3e Mc|11c3f Mn|11c40 Lo|11c41 Po|11c46 |11c50 Nd|11c5a No|11c6d |11c70 Po|11c72 Lo|11c90 |11c92 Mn|11ca8 |11ca9 Mc|11caa Mn|11cb1 Mc|11cb2 Mn|11cb4 Mc|11cb5 Mn|11cb7 |11d00 Lo|11d07 |11d08 Lo|11d0a |11d0b Lo|11d31 Mn|11d37 |11d3a Mn|11d3b |11d3c Mn|11d3e |11d3f Mn|11d46 Lo|11d47 Mn|11d48 |11d50 Nd|11d5a |11d60 Lo|11d66 |11d67 Lo|11d69 |11d6a Lo|11d8a Mc|11d8f |11d90 Mn|11d92 |11d93 Mc|11d95 Mn|11d96 Mc|11d97 Mn|11d98 Lo|11d99 |11da0 Nd|11daa |11db0 Lo|11dd9 Lm|11dda Lo|11ddc |11de0 Nd|11dea |11df0 Mn|11df1 Lo|11df2 |11ee0 Lo|11ef3 Mn|11ef5 Mc|11ef7 Po|11ef9 |11f00 Mn|11f02 Lo|11f03 Mc|11f04 Lo|11f11 |11f12 Lo|11f34 Mc|11f36 Mn|11f3b |11f3e Mc|11f40 Mn|11f41 Mc|11f42 Mn|11f43 Po|11f50 Nd|11f5a Mn|11f5b |11fb0 Lo|11fb1 |11fc0 No|11fd5 So|11fdd Sc|11fe1 So|11ff2 |11fff Po|12000 Lo|1239a |12400 Nl|12470 Po|12475 Nl|12480 Lo|12544 |12550 Nl|12687 |12f90 Lo|12ff1 Po|12ff3 |13000 Lo|13430 Cf|13440 Mn|13441 Lo|13447 Mn|13456 |13460 Lo|143fb |14400 Lo|14647 |16100 Lo|1611e Mn|1612a Mc|1612d Mn|16130 Nd|1613a |16800 Lo|16a39 |16a40 Lo|16a5f |16a60 Nd|16a6a |16a6e Po|16a70 Lo|16abf |16ac0 Nd|16aca |16ad0 Lo|16aee |16af0 Mn|16af5 Po|16af6 |16b00 Lo|16b30 Mn|16b37 Po|16b3c So|16b40 Lm|16b44 Po|16b45 So|16b46 |16b50 Nd|16b5a |16b5b No|16b62 |16b63 Lo|16b78 |16b7d Lo|16b90 |16d40 Lm|16d43 Lo|16d6b Lm|16d6d Po|16d70 Nd|16d7a |16e40 Lu|16e60 Ll|16e80 No|16e97 Po|16e9b |16ea0 Lu|16eb9 |16ebb Ll|16ed4 |16f00 Lo|16f4b |16f4f Mn|16f50 Lo|16f51 Mc|16f88 |16f8f Mn|16f93 Lm|16fa0 |16fe0 Lm|16fe2 Po|16fe3 Lm|16fe4 Mn|16fe5 |16ff0 Mc|16ff2 Lm|16ff4 Nl|16ff7 |17000 Lo|18cdb |18cff Lo|18d21 |18d80 Lo|18df3 |18e00 Lo|19192 |191a0 Lo|191d3 |1aff0 Lm|1aff4 |1aff5 Lm|1affc |1affd Lm|1afff |1b000 Lo|1b129 |1b132 Lo|1b133 |1b150 Lo|1b153 |1b155 Lo|1b156 |1b164 Lo|1b169 |1b170 Lo|1b2fc |1bc00 Lo|1bc6b |1bc70 Lo|1bc7d |1bc80 Lo|1bc89 |1bc90 Lo|1bc9a |1bc9c So|1bc9d Mn|1bc9f Po|1bca0 Cf|1bca4 |1cc00 So|1ccf0 Nd|1ccfa So|1ccfd |1cd00 So|1ceb4 |1ceba So|1ced1 |1ced2 So|1ced5 |1cedd Sm|1cee0 So|1cef0 Sm|1cefe |1cf00 Mn|1cf2e |1cf30 Mn|1cf47 |1cf50 So|1cfc4 |1d000 So|1d0f6 |1d100 So|1d127 Mn|1d129 So|1d165 Mc|1d167 Mn|1d16a So|1d16d Mc|1d173 Cf|1d17b Mn|1d183 So|1d185 Mn|1d18c So|1d1aa Mn|1d1ae So|1d242 Mn|1d245 So|1d246 |1d250 Mc|1d253 So|1d25b Mn|1d25d So|1d25f Mc|1d260 So|1d280 Mc|1d282 |1d2c0 No|1d2d4 |1d2e0 No|1d2f4 |1d300 So|1d357 |1d360 No|1d379 |1d400 Lu|1d41a Ll|1d434 Lu|1d44e Ll|1d455 |1d456 Ll|1d468 Lu|1d482 Ll|1d49c Lu|1d49d |1d49e Lu|1d4a0 |1d4a2 Lu|1d4a3 |1d4a5 Lu|1d4a7 |1d4a9 Lu|1d4ad |1d4ae Lu|1d4b6 Ll|1d4ba |1d4bb Ll|1d4bc |1d4bd Ll|1d4c4 |1d4c5 Ll|1d4d0 Lu|1d4ea Ll|1d504 Lu|1d506 |1d507 Lu|1d50b |1d50d Lu|1d515 |1d516 Lu|1d51d |1d51e Ll|1d538 Lu|1d53a |1d53b Lu|1d53f |1d540 Lu|1d545 |1d546 Lu|1d547 |1d54a Lu|1d551 |1d552 Ll|1d56c Lu|1d586 Ll|1d5a0 Lu|1d5ba Ll|1d5d4 Lu|1d5ee Ll|1d608 Lu|1d622 Ll|1d63c Lu|1d656 Ll|1d670 Lu|1d68a Ll|1d6a7 |1d6a8 Lu|1d6c1 Sm|1d6c2 Ll|1d6db Sm|1d6dc Ll|1d6e2 Lu|1d6fb Sm|1d6fc Ll|1d715 Sm|1d716 Ll|1d71c Lu|1d735 Sm|1d736 Ll|1d74f Sm|1d750 Ll|1d756 Lu|1d76f Sm|1d770 Ll|1d789 Sm|1d78a Ll|1d790 Lu|1d7a9 Sm|1d7aa Ll|1d7c3 Sm|1d7c4 Ll|1d7ca Lu|1d7cb Ll|1d7cc |1d7ce Nd|1d800 So|1da00 Mn|1da37 So|1da3b Mn|1da6d So|1da75 Mn|1da76 So|1da84 Mn|1da85 So|1da87 Po|1da8c |1da9b Mn|1daa0 |1daa1 Mn|1dab0 |1db00 Sm|1db1d |1df00 Ll|1df0a Lo|1df0b Ll|1df40 Lu|1df41 Ll|1df48 Lu|1df49 Ll|1df4a Lu|1df4b Ll|1df4d Lu|1df4e Ll|1df51 Lu|1df52 Ll|1df68 Lu|1df69 Ll|1df6a Lu|1df6b Ll|1df6c Lu|1df6d Ll|1df6e Lu|1df6f Ll|1df72 Lu|1df73 Ll|1df74 Lu|1df75 Ll|1df76 Lu|1df77 Ll|1df78 Lu|1df79 Ll|1df7a Lu|1df7b Ll|1df7c Lu|1df7d Ll|1df7e Lu|1df7f Ll|1df80 Lo|1df82 |1df90 Ll|1df97 |1dfcd Lm|1e000 Mn|1e007 |1e008 Mn|1e019 |1e01b Mn|1e022 |1e023 Mn|1e025 |1e026 Mn|1e02b |1e030 Lm|1e06e |1e08f Mn|1e090 |1e100 Lo|1e12d |1e130 Mn|1e137 Lm|1e13e |1e140 Nd|1e14a |1e14e Lo|1e14f So|1e150 |1e290 Lo|1e2ae Mn|1e2af |1e2c0 Lo|1e2ec Mn|1e2f0 Nd|1e2fa |1e2ff Sc|1e300 |1e4d0 Lo|1e4eb Lm|1e4ec Mn|1e4f0 Nd|1e4fa |1e5d0 Lo|1e5ee Mn|1e5f0 Lo|1e5f1 Nd|1e5fb |1e5ff Po|1e600 |1e6c0 Lo|1e6df |1e6e0 Lo|1e6e3 Mn|1e6e4 Lo|1e6e6 Mn|1e6e7 Lo|1e6ee Mn|1e6f0 Lo|1e6f5 Mn|1e6f6 |1e6fe Lo|1e6ff Lm|1e700 |1e7e0 Lo|1e7e7 |1e7e8 Lo|1e7ec |1e7ed Lo|1e7ef |1e7f0 Lo|1e7ff |1e800 Lo|1e8c5 |1e8c7 No|1e8d0 Mn|1e8d7 |1e900 Lu|1e922 Ll|1e944 Mn|1e94b Lm|1e94c |1e950 Nd|1e95a |1e95e Po|1e960 |1ec71 No|1ecac So|1ecad No|1ecb0 Sc|1ecb1 No|1ecb5 |1ed01 No|1ed2e So|1ed2f No|1ed3e |1ee00 Lo|1ee04 |1ee05 Lo|1ee20 |1ee21 Lo|1ee23 |1ee24 Lo|1ee25 |1ee27 Lo|1ee28 |1ee29 Lo|1ee33 |1ee34 Lo|1ee38 |1ee39 Lo|1ee3a |1ee3b Lo|1ee3c |1ee42 Lo|1ee43 |1ee47 Lo|1ee48 |1ee49 Lo|1ee4a |1ee4b Lo|1ee4c |1ee4d Lo|1ee50 |1ee51 Lo|1ee53 |1ee54 Lo|1ee55 |1ee57 Lo|1ee58 |1ee59 Lo|1ee5a |1ee5b Lo|1ee5c |1ee5d Lo|1ee5e |1ee5f Lo|1ee60 |1ee61 Lo|1ee63 |1ee64 Lo|1ee65 |1ee67 Lo|1ee6b |1ee6c Lo|1ee73 |1ee74 Lo|1ee78 |1ee79 Lo|1ee7d |1ee7e Lo|1ee7f |1ee80 Lo|1ee8a |1ee8b Lo|1ee9c |1eea1 Lo|1eea4 |1eea5 Lo|1eeaa |1eeab Lo|1eebc |1eef0 Sm|1eef2 |1f000 So|1f02c |1f030 So|1f094 |1f0a0 So|1f0af |1f0b1 So|1f0c0 |1f0c1 So|1f0d0 |1f0d1 So|1f0f6 |1f100 No|1f10d So|1f1af |1f1e6 So|1f203 |1f210 So|1f23c |1f240 So|1f249 |1f250 So|1f252 |1f260 So|1f266 |1f300 So|1f3fb Sk|1f400 So|1f6da |1f6dc So|1f6ed |1f6f0 So|1f6fd |1f700 So|1f7dc |1f7e0 So|1f7ec |1f7f0 So|1f80c |1f810 So|1f848 |1f850 So|1f85a |1f860 So|1f888 |1f890 So|1f8ae |1f8b0 So|1f8bc |1f8c0 So|1f8c2 |1f8d0 Sm|1f8d9 |1f900 So|1fa58 |1fa60 So|1fa6e |1fa70 So|1fa7d |1fa80 So|1fac7 |1fac8 So|1fac9 |1facc So|1fade |1fadf So|1faec |1faef So|1fafb |1fb00 So|1fb93 |1fb94 So|1fbf0 Nd|1fbfa So|1fbfb |20000 Lo|2a6e0 |2a700 Lo|2b81f |2b820 Lo|2ceae |2ceb0 Lo|2ebe1 |2ebf0 Lo|2ee5e |2f800 Lo|2fa1e |30000 Lo|3134b |31350 Lo|3347a |3d000 Lo|3fc40 |e0001 Cf|e0002 |e0020 Cf|e0080 |e0100 Mn|e01f0 |f0000 Co|ffffe |100000 Co|10fffe ";
var BidiClassRuns = "0 BN|9 S|a B|b S|c WS|d B|e BN|1c B|1f S|20 WS|21 ON|23 ET|26 ON|2b ES|2c CS|2d ES|2e CS|30 EN|3a CS|3b ON|41 L|5b ON|61 L|7b ON|7f BN|85 B|86 BN|a0 CS|a1 ON|a2 ET|a6 ON|aa L|ab ON|ad BN|ae ON|b0 ET|b2 EN|b4 ON|b5 L|b6 ON|b9 EN|ba L|bb ON|c0 L|d7 ON|d8 L|f7 ON|f8 L|2b9 ON|2bb L|2c2 ON|2d0 L|2d2 ON|2e0 L|2e5 ON|2ee L|2ef ON|300 NSM|370 L|374 ON|376 L|378 |37a L|37e ON|37f L|380 |384 ON|386 L|387 ON|388 L|38b |38c L|38d |38e L|3a2 |3a3 L|3f6 ON|3f7 L|483 NSM|48a L|530 |531 L|557 |558 L|58a ON|58b L|58d ON|58f ET|590 |591 NSM|5be R|5bf NSM|5c0 R|5c1 NSM|5c3 R|5c4 NSM|5c6 R|5c7 NSM|5ca |5d0 R|5eb |5ef R|5f5 |600 AN|606 ON|608 AL|609 ET|60b AL|60c CS|60d AL|60e ON|610 NSM|61b AL|64b NSM|660 AN|66a ET|66b AN|66d AL|670 NSM|671 AL|6d6 NSM|6dd AN|6de ON|6df NSM|6e5 AL|6e7 NSM|6e9 ON|6ea NSM|6ee AL|6f0 EN|6fa AL|70e |70f AL|711 NSM|712 AL|730 NSM|74b |74d AL|7a6 NSM|7b1 AL|7b2 |7c0 R|7eb NSM|7f4 R|7f6 ON|7fa R|7fb |7fd NSM|7fe R|816 NSM|81a R|81b NSM|824 R|825 NSM|828 R|829 NSM|82e |830 R|83f |840 R|859 NSM|85c |85e R|85f |860 AL|86b |870 AL|890 AN|892 |897 NSM|8a0 AL|8ca NSM|8e2 AN|8e3 NSM|903 L|93a NSM|93b L|93c NSM|93d L|941 NSM|949 L|94d NSM|94e L|951 NSM|958 L|962 NSM|964 L|981 NSM|982 L|984 |985 L|98d |98f L|991 |993 L|9a9 |9aa L|9b1 |9b2 L|9b3 |9b6 L|9ba |9bc NSM|9bd L|9c1 NSM|9c5 |9c7 L|9c9 |9cb L|9cd NSM|9ce L|9cf |9d7 L|9d8 |9dc L|9de |9df L|9e2 NSM|9e4 |9e6 L|9f2 ET|9f4 L|9fb ET|9fc L|9fe NSM|9ff |a01 NSM|a03 L|a04 |a05 L|a0b |a0f L|a11 |a13 L|a29 |a2a L|a31 |a32 L|a34 |a35 L|a37 |a38 L|a3a |a3c NSM|a3d |a3e L|a41 NSM|a43 |a47 NSM|a49 |a4b NSM|a4e |a51 NSM|a52 |a59 L|a5d |a5e L|a5f |a66 L|a70 NSM|a72 L|a75 NSM|a76 L|a77 |a81 NSM|a83 L|a84 |a85 L|a8e |a8f L|a92 |a93 L|aa9 |aaa L|ab1 |ab2 L|ab4 |ab5 L|aba |abc NSM|abd L|ac1 NSM|ac6 |ac7 NSM|ac9 L|aca |acb L|acd NSM|ace |ad0 L|ad1 |ae0 L|ae2 NSM|ae4 |ae6 L|af1 ET|af2 |af9 L|afa NSM|b00 |b01 NSM|b02 L|b04 |b05 L|b0d |b0f L|b11 |b13 L|b29 |b2a L|b31 |b32 L|b34 |b35 L|b3a |b3c NSM|b3d L|b3f NSM|b40 L|b41 NSM|b45 |b47 L|b49 |b4b L|b4d NSM|b4e |b53 NSM|b57 L|b58 |b5c L|b5e |b5f L|b62 NSM|b64 |b66 L|b78 |b82 NSM|b83 L|b84 |b85 L|b8b |b8e L|b91 |b92 L|b96 |b99 L|b9b |b9c L|b9d |b9e L|ba0 |ba3 L|ba5 |ba8 L|bab |bae L|bba |bbe L|bc0 NSM|bc1 L|bc3 |bc6 L|bc9 |bca L|bcd NSM|bce |bd0 L|bd1 |bd7 L|bd8 |be6 L|bf3 ON|bf9 ET|bfa ON|bfb |c00 NSM|c01 L|c04 NSM|c05 L|c0d |c0e L|c11 |c12 L|c29 |c2a L|c3a |c3c NSM|c3d L|c3e NSM|c41 L|c45 |c46 NSM|c49 |c4a NSM|c4e |c55 NSM|c57 |c58 L|c5b |c5c L|c5e |c60 L|c62 NSM|c64 |c66 L|c70 |c77 L|c78 ON|c7f L|c81 NSM|c82 L|c8d |c8e L|c91 |c92 L|ca9 |caa L|cb4 |cb5 L|cba |cbc NSM|cbd L|cc5 |cc6 L|cc9 |cca L|ccc NSM|cce |cd5 L|cd7 |cdc L|cdf |ce0 L|ce2 NSM|ce4 |ce6 L|cf0 |cf1 L|cf4 |d00 NSM|d02 L|d0d |d0e L|d11 |d12 L|d3b NSM|d3d L|d41 NSM|d45 |d46 L|d49 |d4a L|d4d NSM|d4e L|d50 |d54 L|d62 NSM|d64 |d66 L|d80 |d81 NSM|d82 L|d84 |d85 L|d97 |d9a L|db2 |db3 L|dbc |dbd L|dbe |dc0 L|dc7 |dca NSM|dcb |dcf L|dd2 NSM|dd5 |dd6 NSM|dd7 |dd8 L|de0 |de6 L|df0 |df2 L|df5 |e01 L|e31 NSM|e32 L|e34 NSM|e3b |e3f ET|e40 L|e47 NSM|e4f L|e5c |e81 L|e83 |e84 L|e85 |e86 L|e8b |e8c L|ea4 |ea5 L|ea6 |ea7 L|eb1 NSM|eb2 L|eb4 NSM|ebd L|ebe |ec0 L|ec5 |ec6 L|ec7 |ec8 NSM|ecf |ed0 L|eda |edc L|ee0 |f00 L|f18 NSM|f1a L|f35 NSM|f36 L|f37 NSM|f38 L|f39 NSM|f3a ON|f3e L|f48 |f49 L|f6d |f71 NSM|f7f L|f80 NSM|f85 L|f86 NSM|f88 L|f8d NSM|f98 |f99 NSM|fbd |fbe L|fc6 NSM|fc7 L|fcd |fce L|fdb |1000 L|102d NSM|1031 L|1032 NSM|1038 L|1039 NSM|103b L|103d NSM|103f L|1058 NSM|105a L|105e NSM|1061 L|1071 NSM|1075 L|1082 NSM|1083 L|1085 NSM|1087 L|108d NSM|108e L|109d NSM|109e L|10c6 |10c7 L|10c8 |10cd L|10ce |10d0 L|1249 |124a L|124e |1250 L|1257 |1258 L|1259 |125a L|125e |1260 L|1289 |128a L|128e |1290 L|12b1 |12b2 L|12b6 |12b8 L|12bf |12c0 L|12c1 |12c2 L|12c6 |12c8 L|12d7 |12d8 L|1311 |1312 L|1316 |1318 L|135b |135d NSM|1360 L|137d |1380 L|1390 ON|139a |13a0 L|13f6 |13f8 L|13fe |1400 ON|1401 L|1680 WS|1681 L|169b ON|169d |16a0 L|16f9 |1700 L|1712 NSM|1715 L|1716 |171f L|1732 NSM|1734 L|1737 |1740 L|1752 NSM|1754 |1760 L|176d |176e L|1771 |1772 NSM|1774 |1780 L|17b4 NSM|17b6 L|17b7 NSM|17be L|17c6 NSM|17c7 L|17c9 NSM|17d4 L|17db ET|17dc L|17dd NSM|17de |17e0 L|17ea |17f0 ON|17fa |1800 ON|180b NSM|180e BN|180f NSM|1810 L|181a |1820 L|1879 |1880 L|1885 NSM|1887 L|18a9 NSM|18aa L|18ab |18b0 L|18f6 |1900 L|191f |1920 NSM|1923 L|1927 NSM|1929 L|192c |1930 L|1932 NSM|1933 L|1939 NSM|193c |1940 ON|1941 |1944 ON|1946 L|196e |1970 L|1975 |1980 L|19ac |19b0 L|19ca |19d0 L|19db |19de ON|1a00 L|1a17 NSM|1a19 L|1a1b NSM|1a1c |1a1e L|1a56 NSM|1a57 L|1a58 NSM|1a5f |1a60 NSM|1a61 L|1a62 NSM|1a63 L|1a65 NSM|1a6d L|1a73 NSM|1a7d |1a7f NSM|1a80 L|1a8a |1a90 L|1a9a |1aa0 L|1aae |1ab0 NSM|1af1 |1b00 NSM|1b04 L|1b34 NSM|1b35 L|1b36 NSM|1b3a L|1b4d |1b4e L|1b6b NSM|1b74 L|1b80 NSM|1b82 L|1ba2 NSM|1ba6 L|1ba8 NSM|1baa L|1bab NSM|1bae L|1be6 NSM|1be7 L|1be8 NSM|1bea L|1bed NSM|1bee L|1bef NSM|1bf2 L|1bf4 |1bfc L|1c2c NSM|1c34 L|1c36 NSM|1c38 |1c3b L|1c4a |1c4d L|1c8b |1c90 L|1cbb |1cbd L|1cc8 |1cd0 NSM|1cd3 L|1cd4 NSM|1ce1 L|1ce2 NSM|1ce9 L|1ced NSM|1cee L|1cf4 NSM|1cf5 L|1cf8 NSM|1cfa L|1cfb |1d00 L|1dc0 NSM|1e00 L|1f16 |1f18 L|1f1e |1f20 L|1f46 |1f48 L|1f4e |1f50 L|1f58 |1f59 L|1f5a |1f5b L|1f5c |1f5d L|1f5e |1f5f L|1f7e |1f80 L|1fb5 |1fb6 L|1fbd ON|1fbe L|1fbf ON|1fc2 L|1fc5 |1fc6 L|1fcd ON|1fd0 L|1fd4 |1fd6 L|1fdc |1fdd ON|1fe0 L|1fed ON|1ff0 |1ff2 L|1ff5 |1ff6 L|1ffd ON|1fff |2000 WS|200b BN|200e L|200f R|2010 ON|2028 WS|2029 B|202a LRE|202b RLE|202c PDF|202d LRO|202e RLO|202f CS|2030 ET|2035 ON|2044 CS|2045 ON|205f WS|2060 BN|2065 |2066 LRI|2067 RLI|2068 FSI|2069 PDI|206a BN|2070 EN|2071 L|2072 |2074 EN|207a ES|207c ON|207f L|2080 EN|208a ES|208c ON|2090 L|20a0 ET|20c5 |20d0 NSM|20f1 |2100 ON|2102 L|2103 ON|2107 L|2108 ON|210a L|2114 ON|2115 L|2116 ON|2119 L|211e ON|2124 L|2125 ON|2126 L|2127 ON|2128 L|2129 ON|212a L|212e ET|212f L|213a ON|213c L|2140 ON|2145 L|214a ON|214e L|2150 ON|2160 L|2189 ON|218c |2190 ON|2212 ES|2213 ET|2214 ON|2336 L|237b ON|2395 L|2396 ON|242a |2440 ON|244b |2460 ON|2488 EN|249c L|24ea ON|26ac L|26ad ON|2800 L|2900 ON|2b74 |2b76 ON|2c00 L|2ce5 ON|2ceb L|2cef NSM|2cf2 L|2cf4 |2cf9 ON|2d00 L|2d26 |2d27 L|2d28 |2d2d L|2d2e |2d30 L|2d68 |2d6f L|2d71 |2d7f NSM|2d80 L|2d97 |2da0 L|2da7 |2da8 L|2daf |2db0 L|2db7 |2db8 L|2dbf |2dc0 L|2dc7 |2dc8 L|2dcf |2dd0 L|2dd7 |2dd8 L|2ddf |2de0 NSM|2e00 ON|2e5e |2e60 ON|2e64 |2e80 ON|2e9a |2e9b ON|2ef4 |2f00 ON|2fd6 |2ff0 ON|3000 WS|3001 ON|3005 L|3008 ON|3021 L|302a NSM|302e L|3030 ON|3031 L|3036 ON|3038 L|303d ON|3040 |3041 L|3097 |3099 NSM|309b ON|309d L|30a0 ON|30a1 L|30fb ON|30fc L|3100 |3105 L|3130 |3131 L|318f |3190 L|31c0 ON|31e6 |31ef ON|31f0 L|321d ON|321f |3220 L|3250 ON|3260 L|327c ON|327f L|32b1 ON|32c0 L|32cc ON|32d0 L|3377 ON|337b L|33de ON|33e0 L|33ff ON|3400 L|4dc0 ON|4e00 L|a48d |a490 ON|a4c7 |a4d0 L|a60d ON|a610 L|a62c |a640 L|a66f NSM|a673 ON|a674 NSM|a67e ON|a680 L|a69e NSM|a6a0 L|a6f0 NSM|a6f2 L|a6f8 |a700 ON|a722 L|a788 ON|a789 L|a7de |a7e2 L|a7e3 |a7f1 L|a802 NSM|a803 L|a806 NSM|a807 L|a80b NSM|a80c L|a825 NSM|a827 L|a828 ON|a82c NSM|a82d |a830 L|a838 ET|a83a |a840 L|a874 ON|a878 |a880 L|a8c4 NSM|a8c6 |a8ce L|a8da |a8e0 NSM|a8f2 L|a8ff NSM|a900 L|a926 NSM|a92e L|a947 NSM|a952 L|a954 |a95f L|a97d |a980 NSM|a983 L|a9b3 NSM|a9b4 L|a9b6 NSM|a9ba L|a9bc NSM|a9be L|a9ce |a9cf L|a9da |a9de L|a9e5 NSM|a9e6 L|a9ff |aa00 L|aa29 NSM|aa2f L|aa31 NSM|aa33 L|aa35 NSM|aa37 |aa40 L|aa43 NSM|aa44 L|aa4c NSM|aa4d L|aa4e |aa50 L|aa5a |aa5c L|aa7c NSM|aa7d L|aab0 NSM|aab1 L|aab2 NSM|aab5 L|aab7 NSM|aab9 L|aabe NSM|aac0 L|aac1 NSM|aac2 L|aac3 |aadb L|aaec NSM|aaee L|aaf6 NSM|aaf7 |ab01 L|ab07 |ab09 L|ab0f |ab11 L|ab17 |ab20 L|ab27 |ab28 L|ab2f |ab30 L|ab6a ON|ab6c L|ab6e |ab70 L|abe5 NSM|abe6 L|abe8 NSM|abe9 L|abed NSM|abee |abf0 L|abfa |ac00 L|d7a4 |d7b0 L|d7c7 |d7cb L|d7fc |d800 L|fa6e |fa70 L|fada |fb00 L|fb07 |fb13 L|fb18 |fb1d R|fb1e NSM|fb1f R|fb29 ES|fb2a R|fb37 |fb38 R|fb3d |fb3e R|fb3f |fb40 R|fb42 |fb43 R|fb45 |fb46 R|fb50 AL|fbc3 ON|fbd3 AL|fd3e ON|fd50 AL|fd90 ON|fd92 AL|fdc8 ON|fdd0 |fdf0 AL|fdfd ON|fe00 NSM|fe10 ON|fe1a |fe20 NSM|fe30 ON|fe50 CS|fe51 ON|fe52 CS|fe53 |fe54 ON|fe55 CS|fe56 ON|fe5f ET|fe60 ON|fe62 ES|fe64 ON|fe67 |fe68 ON|fe69 ET|fe6b ON|fe6c |fe70 AL|fe75 |fe76 AL|fefd |feff BN|ff00 |ff01 ON|ff03 ET|ff06 ON|ff0b ES|ff0c CS|ff0d ES|ff0e CS|ff10 EN|ff1a CS|ff1b ON|ff21 L|ff3b ON|ff41 L|ff5b ON|ff66 L|ffbf |ffc2 L|ffc8 |ffca L|ffd0 |ffd2 L|ffd8 |ffda L|ffdd |ffe0 ET|ffe2 ON|ffe5 ET|ffe7 |ffe8 ON|ffef |fff9 ON|fffe |10000 L|1000c |1000d L|10027 |10028 L|1003b |1003c L|1003e |1003f L|1004e |10050 L|1005e |10080 L|100fb |10100 L|10101 ON|10102 L|10103 |10107 L|10134 |10137 L|10140 ON|1018d L|1018f |10190 ON|1019d |101a0 ON|101a1 |101d0 L|101fd NSM|101fe |10280 L|1029d |102a0 L|102d1 |102e0 NSM|102e1 EN|102fc |10300 L|10324 |1032d L|1034b |10350 L|10376 NSM|1037b |10380 L|1039e |1039f L|103c4 |103c8 L|103d6 |10400 L|1049e |104a0 L|104aa |104b0 L|104d4 |104d8 L|104fc |10500 L|10528 |10530 L|10564 |1056f L|1057b |1057c L|1058b |1058c L|10593 |10594 L|10596 |10597 L|105a2 |105a3 L|105b2 |105b3 L|105ba |105bb L|105bd |105c0 L|105f4 |10600 L|10737 |10740 L|10756 |10760 L|10768 |10780 L|10786 |10787 L|107b1 |107b2 L|107c0 |10800 R|10806 |10808 R|10809 |1080a R|10836 |10837 R|10839 |1083c R|1083d |1083f R|10856 |10857 R|1089f |108a7 R|108b0 |108e0 R|108f3 |108f4 R|108f6 |108fb R|1091c |1091f ON|10920 R|1093a |1093f R|1095a |10980 R|109b8 |109bc R|109d0 |109d2 R|10a01 NSM|10a04 |10a05 NSM|10a07 |10a0c NSM|10a10 R|10a14 |10a15 R|10a18 |10a19 R|10a36 |10a38 NSM|10a3b |10a3f NSM|10a40 R|10a49 |10a50 R|10a59 |10a60 R|10aa0 |10ac0 R|10ae5 NSM|10ae7 |10aeb R|10af7 |10b00 R|10b36 |10b39 ON|10b40 R|10b56 |10b58 R|10b73 |10b78 R|10b92 |10b99 R|10b9d |10ba9 R|10bb0 |10c00 R|10c49 |10c80 R|10cb3 |10cc0 R|10cf3 |10cfa R|10d00 AL|10d24 NSM|10d28 |10d30 AN|10d3a |10d40 AN|10d4a R|10d66 |10d69 NSM|10d6e ON|10d6f R|10d86 |10d8e R|10d90 |10e60 AN|10e7f |10e80 R|10eaa |10eab NSM|10ead R|10eae |10eb0 R|10eb2 |10ec2 AL|10ec8 |10ec9 AL|10ecb NSM|10ed0 ON|10ed9 AL|10eef |10ef0 NSM|10f00 R|10f28 |10f30 AL|10f46 NSM|10f51 AL|10f5a |10f70 R|10f82 NSM|10f86 R|10f8a |10fb0 R|10fcc |10fe0 R|10ff7 |11000 L|11001 NSM|11002 L|11038 NSM|11047 L|1104e |11052 ON|11066 L|11070 NSM|11071 L|11073 NSM|11075 L|11076 |1107f NSM|11082 L|110b3 NSM|110b7 L|110b9 NSM|110bb L|110c2 NSM|110c3 |110cd L|110ce |110d0 L|110e9 |110f0 L|110fa |11100 NSM|11103 L|11127 NSM|1112c L|1112d NSM|11135 |11136 L|11148 |11150 L|11173 NSM|11174 L|11177 |11180 NSM|11182 L|111b6 NSM|111bf L|111c9 NSM|111cd L|111cf NSM|111d0 L|111e0 |111e1 L|111f5 |11200 L|11212 |11213 L|1122f NSM|11232 L|11234 NSM|11235 L|11236 NSM|11238 L|1123e NSM|1123f L|11241 NSM|11242 |11280 L|11287 |11288 L|11289 |1128a L|1128e |1128f L|1129e |1129f L|112aa |112b0 L|112df NSM|112e0 L|112e3 NSM|112eb |112f0 L|112fa |11300 NSM|11302 L|11304 |11305 L|1130d |1130f L|11311 |11313 L|11329 |1132a L|11331 |11332 L|11334 |11335 L|1133a |1133b NSM|1133d L|11340 NSM|11341 L|11345 |11347 L|11349 |1134b L|1134e |11350 L|11351 |11357 L|11358 |1135d L|11364 |11366 NSM|1136d |11370 NSM|11375 |11380 L|1138a |1138b L|1138c |1138e L|1138f |11390 L|113b6 |113b7 L|113bb NSM|113c1 |113c2 L|113c3 |113c5 L|113c6 |113c7 L|113cb |113cc L|113ce NSM|113cf L|113d0 NSM|113d1 L|113d2 NSM|113d3 L|113d6 |113d7 L|113d9 |113e1 NSM|113e3 |11400 L|11438 NSM|11440 L|11442 NSM|11445 L|11446 NSM|11447 L|1145c |1145d L|1145e NSM|1145f L|11462 |11480 L|114b3 NSM|114b9 L|114ba NSM|114bb L|114bf NSM|114c1 L|114c2 NSM|114c4 L|114c8 |114d0 L|114da |11580 L|115b2 NSM|115b6 |115b8 L|115bc NSM|115be L|115bf NSM|115c1 L|115dc NSM|115de |11600 L|11633 NSM|1163b L|1163d NSM|1163e L|1163f NSM|11641 L|11645 |11650 L|1165a |11660 ON|1166d |11680 L|116ab NSM|116ac L|116ad NSM|116ae L|116b0 NSM|116b6 L|116b7 NSM|116b8 L|116ba |116c0 L|116ca |116d0 L|116e4 |11700 L|1171b |1171d NSM|1171e L|1171f NSM|11720 L|11722 NSM|11726 L|11727 NSM|1172c |11730 L|11747 |11800 L|1182f NSM|11838 L|11839 NSM|1183b L|1183c |118a0 L|118f3 |118ff L|11907 |11909 L|1190a |1190c L|11914 |11915 L|11917 |11918 L|11936 |11937 L|11939 |1193b NSM|1193d L|1193e NSM|1193f L|11943 NSM|11944 L|11947 |11950 L|1195a |119a0 L|119a8 |119aa L|119d4 NSM|119d8 |119da NSM|119dc L|119e0 NSM|119e1 L|119e5 |11a00 L|11a01 NSM|11a07 L|11a09 NSM|11a0b L|11a33 NSM|11a39 L|11a3b NSM|11a3f L|11a47 NSM|11a48 |11a50 L|11a51 NSM|11a57 L|11a59 NSM|11a5c L|11a8a NSM|11a97 L|11a98 NSM|11a9a L|11aa3 |11ab0 L|11af9 |11b00 L|11b0b |11b60 NSM|11b61 L|11b62 NSM|11b65 L|11b66 NSM|11b67 L|11b68 |11bc0 L|11be2 |11bf0 L|11bfa |11c00 L|11c09 |11c0a L|11c30 NSM|11c37 |11c38 NSM|11c3e L|11c46 |11c50 L|11c6d |11c70 L|11c90 |11c92 NSM|11ca8 |11ca9 L|11caa NSM|11cb1 L|11cb2 NSM|11cb4 L|11cb5 NSM|11cb7 |11d00 L|11d07 |11d08 L|11d0a |11d0b L|11d31 NSM|11d37 |11d3a NSM|11d3b |11d3c NSM|11d3e |11d3f NSM|11d46 L|11d47 NSM|11d48 |11d50 L|11d5a |11d60 L|11d66 |11d67 L|11d69 |11d6a L|11d8f |11d90 NSM|11d92 |11d93 L|11d95 NSM|11d96 L|11d97 NSM|11d98 L|11d99 |11da0 L|11daa |11db0 L|11ddc |11de0 L|11dea |11df0 NSM|11df1 L|11df2 |11ee0 L|11ef3 NSM|11ef5 L|11ef9 |11f00 NSM|11f02 L|11f11 |11f12 L|11f36 NSM|11f3b |11f3e L|11f40 NSM|11f41 L|11f42 NSM|11f43 L|11f5a NSM|11f5b |11fb0 L|11fb1 |11fc0 L|11fd5 ON|11fdd ET|11fe1 ON|11ff2 |11fff L|1239a |12400 L|12544 |12550 L|12687 |12f90 L|12ff3 |13000 L|13440 NSM|13441 L|13447 NSM|13456 |13460 L|143fb |14400 L|14647 |16100 L|1611e NSM|1612a L|1612d NSM|16130 L|1613a |16800 L|16a39 |16a40 L|16a5f |16a60 L|16a6a |16a6e L|16abf |16ac0 L|16aca |16ad0 L|16aee |16af0 NSM|16af5 L|16af6 |16b00 L|16b30 NSM|16b37 L|16b46 |16b50 L|16b5a |16b5b L|16b62 |16b63 L|16b78 |16b7d L|16b90 |16d40 L|16d7a |16e40 L|16e9b |16ea0 L|16eb9 |16ebb L|16ed4 |16f00 L|16f4b |16f4f NSM|16f50 L|16f88 |16f8f NSM|16f93 L|16fa0 |16fe0 L|16fe2 ON|16fe3 L|16fe4 NSM|16fe5 |16ff0 L|16ff7 |17000 L|18cdb |18cff L|18d21 |18d80 L|18df3 |18e00 L|19192 |191a0 L|191d3 |1aff0 L|1aff4 |1aff5 L|1affc |1affd L|1afff |1b000 L|1b129 |1b132 L|1b133 |1b150 L|1b153 |1b155 L|1b156 |1b164 L|1b169 |1b170 L|1b2fc |1bc00 L|1bc6b |1bc70 L|1bc7d |1bc80 L|1bc89 |1bc90 L|1bc9a |1bc9c L|1bc9d NSM|1bc9f L|1bca0 BN|1bca4 |1cc00 ON|1ccd6 L|1ccf0 EN|1ccfa ON|1ccfd |1cd00 ON|1ceb4 |1ceba ON|1ced1 |1ced2 ON|1ced5 |1cedd ON|1cefe |1cf00 NSM|1cf2e |1cf30 NSM|1cf47 |1cf50 L|1cfc4 |1d000 L|1d0f6 |1d100 L|1d127 NSM|1d129 L|1d167 NSM|1d16a L|1d173 BN|1d17b NSM|1d183 L|1d185 NSM|1d18c L|1d1aa NSM|1d1ae L|1d1e9 ON|1d1eb L|1d200 ON|1d242 NSM|1d245 ON|1d246 |1d250 L|1d25b NSM|1d25d L|1d282 |1d2c0 L|1d2d4 |1d2e0 L|1d2f4 |1d300 ON|1d357 |1d360 L|1d379 |1d400 L|1d455 |1d456 L|1d49d |1d49e L|1d4a0 |1d4a2 L|1d4a3 |1d4a5 L|1d4a7 |1d4a9 L|1d4ad |1d4ae L|1d4ba |1d4bb L|1d4bc |1d4bd L|1d4c4 |1d4c5 L|1d506 |1d507 L|1d50b |1d50d L|1d515 |1d516 L|1d51d |1d51e L|1d53a |1d53b L|1d53f |1d540 L|1d545 |1d546 L|1d547 |1d54a L|1d551 |1d552 L|1d6a7 |1d6a8 L|1d6c1 ON|1d6c2 L|1d6db ON|1d6dc L|1d6fb ON|1d6fc L|1d715 ON|1d716 L|1d735 ON|1d736 L|1d74f ON|1d750 L|1d76f ON|1d770 L|1d789 ON|1d78a L|1d7a9 ON|1d7aa L|1d7c3 ON|1d7c4 L|1d7cc |1d7ce EN|1d800 L|1da00 NSM|1da37 L|1da3b NSM|1da6d L|1da75 NSM|1da76 L|1da84 NSM|1da85 L|1da8c |1da9b NSM|1daa0 |1daa1 NSM|1dab0 |1db00 ON|1db1d |1df00 L|1df82 |1df90 L|1df97 |1dfcd L|1e000 NSM|1e007 |1e008 NSM|1e019 |1e01b NSM|1e022 |1e023 NSM|1e025 |1e026 NSM|1e02b |1e030 L|1e06e |1e08f NSM|1e090 |1e100 L|1e12d |1e130 NSM|1e137 L|1e13e |1e140 L|1e14a |1e14e L|1e150 |1e290 L|1e2ae NSM|1e2af |1e2c0 L|1e2ec NSM|1e2f0 L|1e2fa |1e2ff ET|1e300 |1e4d0 L|1e4ec NSM|1e4f0 L|1e4fa |1e5d0 L|1e5ee NSM|1e5f0 L|1e5fb |1e5ff L|1e600 |1e6c0 L|1e6df |1e6e0 L|1e6e3 NSM|1e6e4 L|1e6e6 NSM|1e6e7 L|1e6ee NSM|1e6f0 L|1e6f5 NSM|1e6f6 |1e6fe L|1e700 |1e7e0 L|1e7e7 |1e7e8 L|1e7ec |1e7ed L|1e7ef |1e7f0 L|1e7ff |1e800 R|1e8c5 |1e8c7 R|1e8d0 NSM|1e8d7 |1e900 R|1e944 NSM|1e94b R|1e94c |1e950 R|1e95a |1e95e R|1e960 |1ec71 AL|1ecb5 |1ed01 AL|1ed3e |1ee00 AL|1ee04 |1ee05 AL|1ee20 |1ee21 AL|1ee23 |1ee24 AL|1ee25 |1ee27 AL|1ee28 |1ee29 AL|1ee33 |1ee34 AL|1ee38 |1ee39 AL|1ee3a |1ee3b AL|1ee3c |1ee42 AL|1ee43 |1ee47 AL|1ee48 |1ee49 AL|1ee4a |1ee4b AL|1ee4c |1ee4d AL|1ee50 |1ee51 AL|1ee53 |1ee54 AL|1ee55 |1ee57 AL|1ee58 |1ee59 AL|1ee5a |1ee5b AL|1ee5c |1ee5d AL|1ee5e |1ee5f AL|1ee60 |1ee61 AL|1ee63 |1ee64 AL|1ee65 |1ee67 AL|1ee6b |1ee6c AL|1ee73 |1ee74 AL|1ee78 |1ee79 AL|1ee7d |1ee7e AL|1ee7f |1ee80 AL|1ee8a |1ee8b AL|1ee9c |1eea1 AL|1eea4 |1eea5 AL|1eeaa |1eeab AL|1eebc |1eef0 ON|1eef2 |1f000 ON|1f02c |1f030 ON|1f094 |1f0a0 ON|1f0af |1f0b1 ON|1f0c0 |1f0c1 ON|1f0d0 |1f0d1 ON|1f0f6 |1f100 EN|1f10b ON|1f110 L|1f12f ON|1f130 L|1f16a ON|1f170 L|1f1ad ON|1f1ae L|1f1af |1f1e6 L|1f203 |1f210 L|1f23c |1f240 L|1f249 |1f250 L|1f252 |1f260 ON|1f266 |1f300 ON|1f6da |1f6dc ON|1f6ed |1f6f0 ON|1f6fd |1f700 ON|1f7da L|1f7db ON|1f7dc |1f7e0 ON|1f7ec |1f7f0 ON|1f80c |1f810 ON|1f848 |1f850 ON|1f85a |1f860 ON|1f888 |1f890 ON|1f8ae |1f8b0 ON|1f8bc |1f8c0 ON|1f8c2 |1f8d0 ON|1f8d9 |1f900 ON|1fa58 |1fa60 ON|1fa6e |1fa70 ON|1fa7d |1fa80 ON|1fac7 |1fac8 ON|1fac9 |1facc ON|1fade |1fadf ON|1faec |1faef ON|1fafb |1fb00 ON|1fb93 |1fb94 ON|1fbf0 EN|1fbfa ON|1fbfb |20000 L|2a6e0 |2a700 L|2b81f |2b820 L|2ceae |2ceb0 L|2ebe1 |2ebf0 L|2ee5e |2f800 L|2fa1e |30000 L|3134b |31350 L|3347a |3d000 L|3fc40 |e0001 BN|e0002 |e0020 BN|e0080 |e0100 NSM|e01f0 |f0000 L|ffffe |100000 L|10fffe ";
var ScriptRuns = "0 Common|41 Latin|5b Common|61 Latin|7b Common|aa Latin|ab Common|ba Latin|bb Common|c0 Latin|d7 Common|d8 Latin|f7 Common|f8 Latin|2b9 Common|2e0 Latin|2e5 Common|2ea Bopomofo|2ec Common|300 Inherited|370 Greek|374 Common|375 Greek|378 |37a Greek|37e Common|37f Greek|380 |384 Greek|385 Common|386 Greek|387 Common|388 Greek|38b |38c Greek|38d |38e Greek|3a2 |3a3 Greek|3e2 Coptic|3f0 Greek|400 Cyrillic|485 Inherited|487 Cyrillic|530 |531 Armenian|557 |558 Armenian|590 |591 Hebrew|5ca |5d0 Hebrew|5eb |5ef Hebrew|5f5 |600 Arabic|605 Common|606 Arabic|60c Common|60d Arabic|61b Common|61c Arabic|61f Common|620 Arabic|640 Common|641 Arabic|64b Inherited|656 Arabic|670 Inherited|671 Arabic|6dd Common|6de Arabic|700 Syriac|70e |70f Syriac|74b |74d Syriac|750 Arabic|780 Thaana|7b2 |7c0 Nko|7fb |7fd Nko|800 Samaritan|82e |830 Samaritan|83f |840 Mandaic|85c |85e Mandaic|85f |860 Syriac|86b |870 Arabic|892 |897 Arabic|8e2 Common|8e3 Arabic|900 Devanagari|951 Inherited|955 Devanagari|964 Common|966 Devanagari|980 Bengali|984 |985 Bengali|98d |98f Bengali|991 |993 Bengali|9a9 |9aa Bengali|9b1 |9b2 Bengali|9b3 |9b6 Bengali|9ba |9bc Bengali|9c5 |9c7 Bengali|9c9 |9cb Bengali|9cf |9d7 Bengali|9d8 |9dc Bengali|9de |9df Bengali|9e4 |9e6 Bengali|9ff |a01 Gurmukhi|a04 |a05 Gurmukhi|a0b |a0f Gurmukhi|a11 |a13 Gurmukhi|a29 |a2a Gurmukhi|a31 |a32 Gurmukhi|a34 |a35 Gurmukhi|a37 |a38 Gurmukhi|a3a |a3c Gurmukhi|a3d |a3e Gurmukhi|a43 |a47 Gurmukhi|a49 |a4b Gurmukhi|a4e |a51 Gurmukhi|a52 |a59 Gurmukhi|a5d |a5e Gurmukhi|a5f |a66 Gurmukhi|a77 |a81 Gujarati|a84 |a85 Gujarati|a8e |a8f Gujarati|a92 |a93 Gujarati|aa9 |aaa Gujarati|ab1 |ab2 Gujarati|ab4 |ab5 Gujarati|aba |abc Gujarati|ac6 |ac7 Gujarati|aca |acb Gujarati|ace |ad0 Gujarati|ad1 |ae0 Gujarati|ae4 |ae6 Gujarati|af2 |af9 Gujarati|b00 |b01 Oriya|b04 |b05 Oriya|b0d |b0f Oriya|b11 |b13 Oriya|b29 |b2a Oriya|b31 |b32 Oriya|b34 |b35 Oriya|b3a |b3c Oriya|b45 |b47 Oriya|b49 |b4b Oriya|b4e |b53 Oriya|b58 |b5c Oriya|b5e |b5f Oriya|b64 |b66 Oriya|b78 |b82 Tamil|b84 |b85 Tamil|b8b |b8e Tamil|b91 |b92 Tamil|b96 |b99 Tamil|b9b |b9c Tamil|b9d |b9e Tamil|ba0 |ba3 Tamil|ba5 |ba8 Tamil|bab |bae Tamil|bba |bbe Tamil|bc3 |bc6 Tamil|bc9 |bca Tamil|bce |bd0 Tamil|bd1 |bd7 Tamil|bd8 |be6 Tamil|bfb |c00 Telugu|c0d |c0e Telugu|c11 |c12 Telugu|c29 |c2a Telugu|c3a |c3c Telugu|c45 |c46 Telugu|c49 |c4a Telugu|c4e |c55 Telugu|c57 |c58 Telugu|c5b |c5c Telugu|c5e |c60 Telugu|c64 |c66 Telugu|c70 |c77 Telugu|c80 Kannada|c8d |c8e Kannada|c91 |c92 Kannada|ca9 |caa Kannada|cb4 |cb5 Kannada|cba |cbc Kannada|cc5 |cc6 Kannada|cc9 |cca Kannada|cce |cd5 Kannada|cd7 |cdc Kannada|cdf |ce0 Kannada|ce4 |ce6 Kannada|cf0 |cf1 Kannada|cf4 |d00 Malayalam|d0d |d0e Malayalam|d11 |d12 Malayalam|d45 |d46 Malayalam|d49 |d4a Malayalam|d50 |d54 Malayalam|d64 |d66 Malayalam|d80 |d81 Sinhala|d84 |d85 Sinhala|d97 |d9a Sinhala|db2 |db3 Sinhala|dbc |dbd Sinhala|dbe |dc0 Sinhala|dc7 |dca Sinhala|dcb |dcf Sinhala|dd5 |dd6 Sinhala|dd7 |dd8 Sinhala|de0 |de6 Sinhala|df0 |df2 Sinhala|df5 |e01 Thai|e3b |e3f Common|e40 Thai|e5c |e81 Lao|e83 |e84 Lao|e85 |e86 Lao|e8b |e8c Lao|ea4 |ea5 Lao|ea6 |ea7 Lao|ebe |ec0 Lao|ec5 |ec6 Lao|ec7 |ec8 Lao|ecf |ed0 Lao|eda |edc Lao|ee0 |f00 Tibetan|f48 |f49 Tibetan|f6d |f71 Tibetan|f98 |f99 Tibetan|fbd |fbe Tibetan|fcd |fce Tibetan|fd5 Common|fd9 Tibetan|fdb |1000 Myanmar|10a0 Georgian|10c6 |10c7 Georgian|10c8 |10cd Georgian|10ce |10d0 Georgian|10fb Common|10fc Georgian|1100 Hangul|1200 Ethiopic|1249 |124a Ethiopic|124e |1250 Ethiopic|1257 |1258 Ethiopic|1259 |125a Ethiopic|125e |1260 Ethiopic|1289 |128a Ethiopic|128e |1290 Ethiopic|12b1 |12b2 Ethiopic|12b6 |12b8 Ethiopic|12bf |12c0 Ethiopic|12c1 |12c2 Ethiopic|12c6 |12c8 Ethiopic|12d7 |12d8 Ethiopic|1311 |1312 Ethiopic|1316 |1318 Ethiopic|135b |135d Ethiopic|137d |1380 Ethiopic|139a |13a0 Cherokee|13f6 |13f8 Cherokee|13fe |1400 Canadian Aboriginal|1680 Ogham|169d |16a0 Runic|16eb Common|16ee Runic|16f9 |1700 Tagalog|1716 |171f Tagalog|1720 Hanunoo|1735 Common|1737 |1740 Buhid|1754 |1760 Tagbanwa|176d |176e Tagbanwa|1771 |1772 Tagbanwa|1774 |1780 Khmer|17de |17e0 Khmer|17ea |17f0 Khmer|17fa |1800 Mongolian|1802 Common|1804 Mongolian|1805 Common|1806 Mongolian|181a |1820 Mongolian|1879 |1880 Mongolian|18ab |18b0 Canadian Aboriginal|18f6 |1900 Limbu|191f |1920 Limbu|192c |1930 Limbu|193c |1940 Limbu|1941 |1944 Limbu|1950 Tai Le|196e |1970 Tai Le|1975 |1980 New Tai Lue|19ac |19b0 New Tai Lue|19ca |19d0 New Tai Lue|19db |19de New Tai Lue|19e0 Khmer|1a00 Buginese|1a1c |1a1e Buginese|1a20 Tai Tham|1a5f |1a60 Tai Tham|1a7d |1a7f Tai Tham|1a8a |1a90 Tai Tham|1a9a |1aa0 Tai Tham|1aae |1ab0 Inherited|1af1 |1b00 Balinese|1b4d |1b4e Balinese|1b80 Sundanese|1bc0 Batak|1bf4 |1bfc Batak|1c00 Lepcha|1c38 |1c3b Lepcha|1c4a |1c4d Lepcha|1c50 Ol Chiki|1c80 Cyrillic|1c8b |1c90 Georgian|1cbb |1cbd Georgian|1cc0 Sundanese|1cc8 |1cd0 Inherited|1cd3 Common|1cd4 Inherited|1ce1 Common|1ce2 Inherited|1ce9 Common|1ced Inherited|1cee Common|1cf4 Inherited|1cf5 Common|1cf8 Inherited|1cfa Common|1cfb |1d00 Latin|1d26 Greek|1d2b Cyrillic|1d2c Latin|1d5d Greek|1d62 Latin|1d66 Greek|1d6b Latin|1d78 Cyrillic|1d79 Latin|1dbf Greek|1dc0 Inherited|1e00 Latin|1f00 Greek|1f16 |1f18 Greek|1f1e |1f20 Greek|1f46 |1f48 Greek|1f4e |1f50 Greek|1f58 |1f59 Greek|1f5a |1f5b Greek|1f5c |1f5d Greek|1f5e |1f5f Greek|1f7e |1f80 Greek|1fb5 |1fb6 Greek|1fc5 |1fc6 Greek|1fd4 |1fd6 Greek|1fdc |1fdd Greek|1ff0 |1ff2 Greek|1ff5 |1ff6 Greek|1fff |2000 Common|200c Inherited|200e Common|2065 |2066 Common|2071 Latin|2072 |2074 Common|207f Latin|2080 Common|2090 Latin|20a0 Common|20c5 |20d0 Inherited|20f1 |2100 Common|2126 Greek|2127 Common|212a Latin|212c Common|2132 Latin|2133 Common|214e Latin|214f Common|2160 Latin|2189 Common|218c |2190 Common|242a |2440 Common|244b |2460 Common|2800 Braille|2900 Common|2b74 |2b76 Common|2c00 Glagolitic|2c60 Latin|2c80 Coptic|2cf4 |2cf9 Coptic|2d00 Georgian|2d26 |2d27 Georgian|2d28 |2d2d Georgian|2d2e |2d30 Tifinagh|2d68 |2d6f Tifinagh|2d71 |2d7f Tifinagh|2d80 Ethiopic|2d97 |2da0 Ethiopic|2da7 |2da8 Ethiopic|2daf |2db0 Ethiopic|2db7 |2db8 Ethiopic|2dbf |2dc0 Ethiopic|2dc7 |2dc8 Ethiopic|2dcf |2dd0 Ethiopic|2dd7 |2dd8 Ethiopic|2ddf |2de0 Cyrillic|2e00 Common|2e5e |2e60 Common|2e64 |2e80 Han|2e9a |2e9b Han|2ef4 |2f00 Han|2fd6 |2ff0 Common|3005 Han|3006 Common|3007 Han|3008 Common|3021 Han|302a Inherited|302e Hangul|3030 Common|3038 Han|303c Common|3040 |3041 Hiragana|3097 |3099 Inherited|309b Common|309d Hiragana|30a0 Common|30a1 Katakana|30fb Common|30fd Katakana|3100 |3105 Bopomofo|3130 |3131 Hangul|318f |3190 Common|31a0 Bopomofo|31c0 Common|31e6 |31ef Common|31f0 Katakana|3200 Hangul|321f |3220 Common|3260 Hangul|327f Common|32d0 Katakana|32ff Common|3300 Katakana|3358 Common|3400 Han|4dc0 Common|4e00 Han|a000 Yi|a48d |a490 Yi|a4c7 |a4d0 Lisu|a500 Vai|a62c |a640 Cyrillic|a6a0 Bamum|a6f8 |a700 Common|a722 Latin|a788 Common|a78b Latin|a7de |a7e2 Latin|a7e3 |a7f1 Latin|a800 Syloti Nagri|a82d |a830 Common|a83a |a840 Phags Pa|a878 |a880 Saurashtra|a8c6 |a8ce Saurashtra|a8da |a8e0 Devanagari|a900 Kayah Li|a92e Common|a92f Kayah Li|a930 Rejang|a954 |a95f Rejang|a960 Hangul|a97d |a980 Javanese|a9ce |a9cf Common|a9d0 Javanese|a9da |a9de Javanese|a9e0 Myanmar|a9ff |aa00 Cham|aa37 |aa40 Cham|aa4e |aa50 Cham|aa5a |aa5c Cham|aa60 Myanmar|aa80 Tai Viet|aac3 |aadb Tai Viet|aae0 Meetei Mayek|aaf7 |ab01 Ethiopic|ab07 |ab09 Ethiopic|ab0f |ab11 Ethiopic|ab17 |ab20 Ethiopic|ab27 |ab28 Ethiopic|ab2f |ab30 Latin|ab5b Common|ab5c Latin|ab65 Greek|ab66 Latin|ab6a Common|ab6c Latin|ab6e |ab70 Cherokee|abc0 Meetei Mayek|abee |abf0 Meetei Mayek|abfa |ac00 Hangul|d7a4 |d7b0 Hangul|d7c7 |d7cb Hangul|d7fc |f900 Han|fa6e |fa70 Han|fada |fb00 Latin|fb07 |fb13 Armenian|fb18 |fb1d Hebrew|fb37 |fb38 Hebrew|fb3d |fb3e Hebrew|fb3f |fb40 Hebrew|fb42 |fb43 Hebrew|fb45 |fb46 Hebrew|fb50 Arabic|fd3e Common|fd40 Arabic|fdd0 |fdf0 Arabic|fe00 Inherited|fe10 Common|fe1a |fe20 Inherited|fe2e Cyrillic|fe30 Common|fe53 |fe54 Common|fe67 |fe68 Common|fe6c |fe70 Arabic|fe75 |fe76 Arabic|fefd |feff Common|ff00 |ff01 Common|ff21 Latin|ff3b Common|ff41 Latin|ff5b Common|ff66 Katakana|ff70 Common|ff71 Katakana|ff9e Common|ffa0 Hangul|ffbf |ffc2 Hangul|ffc8 |ffca Hangul|ffd0 |ffd2 Hangul|ffd8 |ffda Hangul|ffdd |ffe0 Common|ffe7 |ffe8 Common|ffef |fff9 Common|fffe |10000 Linear B|1000c |1000d Linear B|10027 |10028 Linear B|1003b |1003c Linear B|1003e |1003f Linear B|1004e |10050 Linear B|1005e |10080 Linear B|100fb |10100 Common|10103 |10107 Common|10134 |10137 Common|10140 Greek|1018f |10190 Common|1019d |101a0 Greek|101a1 |101d0 Common|101fd Inherited|101fe |10280 Lycian|1029d |102a0 Carian|102d1 |102e0 Inherited|102e1 Common|102fc |10300 Old Italic|10324 |1032d Old Italic|10330 Gothic|1034b |10350 Old Permic|1037b |10380 Ugaritic|1039e |1039f Ugaritic|103a0 Old Persian|103c4 |103c8 Old Persian|103d6 |10400 Deseret|10450 Shavian|10480 Osmanya|1049e |104a0 Osmanya|104aa |104b0 Osage|104d4 |104d8 Osage|104fc |10500 Elbasan|10528 |10530 Caucasian Albanian|10564 |1056f Caucasian Albanian|10570 Vithkuqi|1057b |1057c Vithkuqi|1058b |1058c Vithkuqi|10593 |10594 Vithkuqi|10596 |10597 Vithkuqi|105a2 |105a3 Vithkuqi|105b2 |105b3 Vithkuqi|105ba |105bb Vithkuqi|105bd |105c0 Todhri|105f4 |10600 Linear A|10737 |10740 Linear A|10756 |10760 Linear A|10768 |10780 Latin|10786 |10787 Latin|107b1 |107b2 Latin|107c0 |10800 Cypriot|10806 |10808 Cypriot|10809 |1080a Cypriot|10836 |10837 Cypriot|10839 |1083c Cypriot|1083d |1083f Cypriot|10840 Imperial Aramaic|10856 |10857 Imperial Aramaic|10860 Palmyrene|10880 Nabataean|1089f |108a7 Nabataean|108b0 |108e0 Hatran|108f3 |108f4 Hatran|108f6 |108fb Hatran|10900 Phoenician|1091c |1091f Phoenician|10920 Lydian|1093a |1093f Lydian|10940 Sidetic|1095a |10980 Meroitic Hieroglyphs|109a0 Meroitic Cursive|109b8 |109bc Meroitic Cursive|109d0 |109d2 Meroitic Cursive|10a00 Kharoshthi|10a04 |10a05 Kharoshthi|10a07 |10a0c Kharoshthi|10a14 |10a15 Kharoshthi|10a18 |10a19 Kharoshthi|10a36 |10a38 Kharoshthi|10a3b |10a3f Kharoshthi|10a49 |10a50 Kharoshthi|10a59 |10a60 Old South Arabian|10a80 Old North Arabian|10aa0 |10ac0 Manichaean|10ae7 |10aeb Manichaean|10af7 |10b00 Avestan|10b36 |10b39 Avestan|10b40 Inscriptional Parthian|10b56 |10b58 Inscriptional Parthian|10b60 Inscriptional Pahlavi|10b73 |10b78 Inscriptional Pahlavi|10b80 Psalter Pahlavi|10b92 |10b99 Psalter Pahlavi|10b9d |10ba9 Psalter Pahlavi|10bb0 |10c00 Old Turkic|10c49 |10c80 Old Hungarian|10cb3 |10cc0 Old Hungarian|10cf3 |10cfa Old Hungarian|10d00 Hanifi Rohingya|10d28 |10d30 Hanifi Rohingya|10d3a |10d40 Garay|10d66 |10d69 Garay|10d86 |10d8e Garay|10d90 |10e60 Arabic|10e7f |10e80 Yezidi|10eaa |10eab Yezidi|10eae |10eb0 Yezidi|10eb2 |10ec2 Arabic|10ec8 |10ec9 Arabic|10eef |10ef0 Arabic|10f00 Old Sogdian|10f28 |10f30 Sogdian|10f5a |10f70 Old Uyghur|10f8a |10fb0 Chorasmian|10fcc |10fe0 Elymaic|10ff7 |11000 Brahmi|1104e |11052 Brahmi|11076 |1107f Brahmi|11080 Kaithi|110c3 |110cd Kaithi|110ce |110d0 Sora Sompeng|110e9 |110f0 Sora Sompeng|110fa |11100 Chakma|11135 |11136 Chakma|11148 |11150 Mahajani|11177 |11180 Sharada|111e0 |111e1 Sinhala|111f5 |11200 Khojki|11212 |11213 Khojki|11242 |11280 Multani|11287 |11288 Multani|11289 |1128a Multani|1128e |1128f Multani|1129e |1129f Multani|112aa |112b0 Khudawadi|112eb |112f0 Khudawadi|112fa |11300 Grantha|11304 |11305 Grantha|1130d |1130f Grantha|11311 |11313 Grantha|11329 |1132a Grantha|11331 |11332 Grantha|11334 |11335 Grantha|1133a |1133b Inherited|1133c Grantha|11345 |11347 Grantha|11349 |1134b Grantha|1134e |11350 Grantha|11351 |11357 Grantha|11358 |1135d Grantha|11364 |11366 Grantha|1136d |11370 Grantha|11375 |11380 Tulu Tigalari|1138a |1138b Tulu Tigalari|1138c |1138e Tulu Tigalari|1138f |11390 Tulu Tigalari|113b6 |113b7 Tulu Tigalari|113c1 |113c2 Tulu Tigalari|113c3 |113c5 Tulu Tigalari|113c6 |113c7 Tulu Tigalari|113cb |113cc Tulu Tigalari|113d6 |113d7 Tulu Tigalari|113d9 |113e1 Tulu Tigalari|113e3 |11400 Newa|1145c |1145d Newa|11462 |11480 Tirhuta|114c8 |114d0 Tirhuta|114da |11580 Siddham|115b6 |115b8 Siddham|115de |11600 Modi|11645 |11650 Modi|1165a |11660 Mongolian|1166d |11680 Takri|116ba |116c0 Takri|116ca |116d0 Myanmar|116e4 |11700 Ahom|1171b |1171d Ahom|1172c |11730 Ahom|11747 |11800 Dogra|1183c |118a0 Warang Citi|118f3 |118ff Warang Citi|11900 Dives Akuru|11907 |11909 Dives Akuru|1190a |1190c Dives Akuru|11914 |11915 Dives Akuru|11917 |11918 Dives Akuru|11936 |11937 Dives Akuru|11939 |1193b Dives Akuru|11947 |11950 Dives Akuru|1195a |119a0 Nandinagari|119a8 |119aa Nandinagari|119d8 |119da Nandinagari|119e5 |11a00 Zanabazar Square|11a48 |11a50 Soyombo|11aa3 |11ab0 Canadian Aboriginal|11ac0 Pau Cin Hau|11af9 |11b00 Devanagari|11b0b |11b60 Sharada|11b68 |11bc0 Sunuwar|11be2 |11bf0 Sunuwar|11bfa |11c00 Bhaiksuki|11c09 |11c0a Bhaiksuki|11c37 |11c38 Bhaiksuki|11c46 |11c50 Bhaiksuki|11c6d |11c70 Marchen|11c90 |11c92 Marchen|11ca8 |11ca9 Marchen|11cb7 |11d00 Masaram Gondi|11d07 |11d08 Masaram Gondi|11d0a |11d0b Masaram Gondi|11d37 |11d3a Masaram Gondi|11d3b |11d3c Masaram Gondi|11d3e |11d3f Masaram Gondi|11d48 |11d50 Masaram Gondi|11d5a |11d60 Gunjala Gondi|11d66 |11d67 Gunjala Gondi|11d69 |11d6a Gunjala Gondi|11d8f |11d90 Gunjala Gondi|11d92 |11d93 Gunjala Gondi|11d99 |11da0 Gunjala Gondi|11daa |11db0 Tolong Siki|11ddc |11de0 Tolong Siki|11dea |11df0 Bengali|11df2 |11ee0 Makasar|11ef9 |11f00 Kawi|11f11 |11f12 Kawi|11f3b |11f3e Kawi|11f5b |11fb0 Lisu|11fb1 |11fc0 Tamil|11ff2 |11fff Tamil|12000 Cuneiform|1239a |12400 Cuneiform|12544 |12550 Cuneiform|125a8 Proto Cuneiform|1264c Cuneiform|12687 |12f90 Cypro Minoan|12ff3 |13000 Egyptian Hieroglyphs|13456 |13460 Egyptian Hieroglyphs|143fb |14400 Anatolian Hieroglyphs|14647 |16100 Gurung Khema|1613a |16800 Bamum|16a39 |16a40 Mro|16a5f |16a60 Mro|16a6a |16a6e Mro|16a70 Tangsa|16abf |16ac0 Tangsa|16aca |16ad0 Bassa Vah|16aee |16af0 Bassa Vah|16af6 |16b00 Pahawh Hmong|16b46 |16b50 Pahawh Hmong|16b5a |16b5b Pahawh Hmong|16b62 |16b63 Pahawh Hmong|16b78 |16b7d Pahawh Hmong|16b90 |16d40 Kirat Rai|16d7a |16e40 Medefaidrin|16e9b |16ea0 Beria Erfe|16eb9 |16ebb Beria Erfe|16ed4 |16f00 Miao|16f4b |16f4f Miao|16f88 |16f8f Miao|16fa0 |16fe0 Tangut|16fe1 Nushu|16fe2 Han|16fe4 Khitan Small Script|16fe5 |16ff0 Han|16ff7 |17000 Tangut|18b00 Khitan Small Script|18cdb |18cff Khitan Small Script|18d00 Tangut|18d21 |18d80 Tangut|18df3 |18e00 Jurchen|19192 |191a0 Jurchen|191d3 |1aff0 Katakana|1aff4 |1aff5 Katakana|1affc |1affd Katakana|1afff |1b000 Katakana|1b001 Hiragana|1b120 Katakana|1b123 Hiragana|1b124 Katakana|1b129 |1b132 Hiragana|1b133 |1b150 Hiragana|1b153 |1b155 Katakana|1b156 |1b164 Katakana|1b169 |1b170 Nushu|1b2fc |1bc00 Duployan|1bc6b |1bc70 Duployan|1bc7d |1bc80 Duployan|1bc89 |1bc90 Duployan|1bc9a |1bc9c Duployan|1bca0 Common|1bca4 |1cc00 Common|1ccfd |1cd00 Common|1ceb4 |1ceba Common|1ced1 |1ced2 Common|1ced5 |1cedd Common|1cefe |1cf00 Inherited|1cf2e |1cf30 Inherited|1cf47 |1cf50 Common|1cfc4 |1d000 Common|1d0f6 |1d100 Common|1d127 Inherited|1d129 Common|1d167 Inherited|1d16a Common|1d17b Inherited|1d183 Common|1d185 Inherited|1d18c Common|1d1aa Inherited|1d1ae Common|1d200 Greek|1d246 |1d250 Common|1d25b Inherited|1d25d Common|1d282 |1d2c0 Common|1d2d4 |1d2e0 Common|1d2f4 |1d300 Common|1d357 |1d360 Common|1d379 |1d400 Common|1d455 |1d456 Common|1d49d |1d49e Common|1d4a0 |1d4a2 Common|1d4a3 |1d4a5 Common|1d4a7 |1d4a9 Common|1d4ad |1d4ae Common|1d4ba |1d4bb Common|1d4bc |1d4bd Common|1d4c4 |1d4c5 Common|1d506 |1d507 Common|1d50b |1d50d Common|1d515 |1d516 Common|1d51d |1d51e Common|1d53a |1d53b Common|1d53f |1d540 Common|1d545 |1d546 Common|1d547 |1d54a Common|1d551 |1d552 Common|1d6a7 |1d6a8 Common|1d7cc |1d7ce Common|1d800 SignWriting|1da8c |1da9b SignWriting|1daa0 |1daa1 SignWriting|1dab0 |1db00 Common|1db1d |1df00 Latin|1df82 |1df90 Latin|1df97 |1dfcd Latin|1dff3 Greek|1dff5 Latin|1e000 Glagolitic|1e007 |1e008 Glagolitic|1e019 |1e01b Glagolitic|1e022 |1e023 Glagolitic|1e025 |1e026 Glagolitic|1e02b |1e030 Cyrillic|1e06e |1e08f Cyrillic|1e090 |1e100 Nyiakeng Puachue Hmong|1e12d |1e130 Nyiakeng Puachue Hmong|1e13e |1e140 Nyiakeng Puachue Hmong|1e14a |1e14e Nyiakeng Puachue Hmong|1e150 |1e290 Toto|1e2af |1e2c0 Wancho|1e2fa |1e2ff Wancho|1e300 |1e4d0 Nag Mundari|1e4fa |1e5d0 Ol Onal|1e5fb |1e5ff Ol Onal|1e600 |1e6c0 Tai Yo|1e6df |1e6e0 Tai Yo|1e6f6 |1e6fe Tai Yo|1e700 |1e7e0 Ethiopic|1e7e7 |1e7e8 Ethiopic|1e7ec |1e7ed Ethiopic|1e7ef |1e7f0 Ethiopic|1e7ff |1e800 Mende Kikakui|1e8c5 |1e8c7 Mende Kikakui|1e8d7 |1e900 Adlam|1e94c |1e950 Adlam|1e95a |1e95e Adlam|1e960 |1ec71 Common|1ecb5 |1ed01 Common|1ed3e |1ee00 Arabic|1ee04 |1ee05 Arabic|1ee20 |1ee21 Arabic|1ee23 |1ee24 Arabic|1ee25 |1ee27 Arabic|1ee28 |1ee29 Arabic|1ee33 |1ee34 Arabic|1ee38 |1ee39 Arabic|1ee3a |1ee3b Arabic|1ee3c |1ee42 Arabic|1ee43 |1ee47 Arabic|1ee48 |1ee49 Arabic|1ee4a |1ee4b Arabic|1ee4c |1ee4d Arabic|1ee50 |1ee51 Arabic|1ee53 |1ee54 Arabic|1ee55 |1ee57 Arabic|1ee58 |1ee59 Arabic|1ee5a |1ee5b Arabic|1ee5c |1ee5d Arabic|1ee5e |1ee5f Arabic|1ee60 |1ee61 Arabic|1ee63 |1ee64 Arabic|1ee65 |1ee67 Arabic|1ee6b |1ee6c Arabic|1ee73 |1ee74 Arabic|1ee78 |1ee79 Arabic|1ee7d |1ee7e Arabic|1ee7f |1ee80 Arabic|1ee8a |1ee8b Arabic|1ee9c |1eea1 Arabic|1eea4 |1eea5 Arabic|1eeaa |1eeab Arabic|1eebc |1eef0 Arabic|1eef2 |1f000 Common|1f02c |1f030 Common|1f094 |1f0a0 Common|1f0af |1f0b1 Common|1f0c0 |1f0c1 Common|1f0d0 |1f0d1 Common|1f0f6 |1f100 Common|1f1af |1f1e6 Common|1f200 Hiragana|1f201 Common|1f203 |1f210 Common|1f23c |1f240 Common|1f249 |1f250 Common|1f252 |1f260 Common|1f266 |1f300 Common|1f6da |1f6dc Common|1f6ed |1f6f0 Common|1f6fd |1f700 Common|1f7dc |1f7e0 Common|1f7ec |1f7f0 Common|1f80c |1f810 Common|1f848 |1f850 Common|1f85a |1f860 Common|1f888 |1f890 Common|1f8ae |1f8b0 Common|1f8bc |1f8c0 Common|1f8c2 |1f8d0 Common|1f8d9 |1f900 Common|1fa58 |1fa60 Common|1fa6e |1fa70 Common|1fa7d |1fa80 Common|1fac7 |1fac8 Common|1fac9 |1facc Common|1fade |1fadf Common|1faec |1faef Common|1fafb |1fb00 Common|1fb93 |1fb94 Common|1fbfb |20000 Han|2a6e0 |2a700 Han|2b81f |2b820 Han|2ceae |2ceb0 Han|2ebe1 |2ebf0 Han|2ee5e |2f800 Han|2fa1e |30000 Han|3134b |31350 Han|3347a |3d000 Seal|3fc40 |e0001 Common|e0002 |e0020 Common|e0080 |e0100 Inherited|e01f0 ";
var AgeRuns = "0 1.1|1f6 3.0|1fa 1.1|218 3.0|220 3.2|221 4.0|222 3.0|234 4.0|237 4.1|242 5.0|250 1.1|2a9 3.0|2ae 4.0|2b0 1.1|2df 3.0|2e0 1.1|2ea 3.0|2ef 4.0|300 1.1|346 3.0|34f 3.2|350 4.0|358 4.1|35d 4.0|360 1.1|362 3.0|363 3.2|370 5.1|374 1.1|376 5.1|378 |37a 1.1|37b 5.0|37e 1.1|37f 7.0|380 |384 1.1|38b |38c 1.1|38d |38e 1.1|3a2 |3a3 1.1|3cf 5.1|3d0 1.1|3d7 3.0|3d8 3.2|3da 1.1|3db 3.0|3dc 1.1|3dd 3.0|3de 1.1|3df 3.0|3e0 1.1|3e1 3.0|3e2 1.1|3f4 3.1|3f6 3.2|3f7 4.0|3fc 4.1|400 3.0|401 1.1|40d 3.0|40e 1.1|450 3.0|451 1.1|45d 3.0|45e 1.1|487 5.1|488 3.0|48a 3.2|48c 3.0|490 1.1|4c5 3.2|4c7 1.1|4c9 3.2|4cb 1.1|4cd 3.2|4cf 5.0|4d0 1.1|4ec 3.0|4ee 1.1|4f6 4.1|4f8 1.1|4fa 5.0|500 3.2|510 5.0|514 5.1|524 5.2|526 6.0|528 7.0|530 |531 1.1|557 |558 18.0|559 1.1|560 11.0|561 1.1|588 11.0|589 1.1|58a 3.0|58b 18.0|58d 7.0|58f 6.1|590 |591 2.0|5a2 4.1|5a3 2.0|5b0 1.1|5ba 5.0|5bb 1.1|5c4 2.0|5c5 4.1|5c8 18.0|5ca |5d0 1.1|5eb |5ef 11.0|5f0 1.1|5f5 |600 4.0|604 6.1|605 7.0|606 5.1|60b 4.1|60c 1.1|60d 4.0|616 5.1|61b 1.1|61c 6.3|61d 14.0|61e 4.1|61f 1.1|620 6.0|621 1.1|63b 5.1|640 1.1|653 3.0|656 4.0|659 4.1|65f 6.0|660 1.1|66e 3.2|670 1.1|6b8 3.0|6ba 1.1|6bf 3.0|6c0 1.1|6cf 3.0|6d0 1.1|6ee 4.0|6f0 1.1|6fa 3.0|6ff 4.0|700 3.0|70e |70f 3.0|72d 4.0|730 3.0|74b |74d 4.0|750 4.1|76e 5.1|780 3.0|7b1 3.2|7b2 |7c0 5.0|7fb |7fd 11.0|800 5.2|82e |830 5.2|83f |840 6.0|85c |85e 6.0|85f |860 10.0|86b |870 14.0|88f 17.0|890 14.0|892 |897 16.0|898 14.0|8a0 6.1|8a1 7.0|8a2 6.1|8ad 7.0|8b3 8.0|8b5 14.0|8b6 9.0|8be 13.0|8c8 14.0|8d3 11.0|8d4 9.0|8e3 8.0|8e4 6.1|8ff 7.0|900 5.2|901 1.1|904 4.0|905 1.1|93a 6.0|93c 1.1|94e 5.2|94f 6.0|950 1.1|955 5.2|956 6.0|958 1.1|971 5.1|973 6.0|978 7.0|979 5.2|97b 5.0|97d 4.1|97e 5.0|980 7.0|981 1.1|984 |985 1.1|98d |98f 1.1|991 |993 1.1|9a9 |9aa 1.1|9b1 |9b2 1.1|9b3 |9b6 1.1|9ba |9bc 1.1|9bd 4.0|9be 1.1|9c5 |9c7 1.1|9c9 |9cb 1.1|9ce 4.1|9cf |9d7 1.1|9d8 |9dc 1.1|9de |9df 1.1|9e4 |9e6 1.1|9fb 5.2|9fc 10.0|9fe 11.0|9ff |a01 4.0|a02 1.1|a03 4.0|a04 |a05 1.1|a0b |a0f 1.1|a11 |a13 1.1|a29 |a2a 1.1|a31 |a32 1.1|a34 |a35 1.1|a37 |a38 1.1|a3a |a3c 1.1|a3d |a3e 1.1|a43 |a47 1.1|a49 |a4b 1.1|a4e |a51 5.1|a52 |a59 1.1|a5d |a5e 1.1|a5f |a66 1.1|a75 5.1|a76 11.0|a77 |a81 1.1|a84 |a85 1.1|a8c 4.0|a8d 1.1|a8e |a8f 1.1|a92 |a93 1.1|aa9 |aaa 1.1|ab1 |ab2 1.1|ab4 |ab5 1.1|aba |abc 1.1|ac6 |ac7 1.1|aca |acb 1.1|ace |ad0 1.1|ad1 |ae0 1.1|ae1 4.0|ae4 |ae6 1.1|af0 6.1|af1 4.0|af2 |af9 8.0|afa 10.0|b00 |b01 1.1|b04 |b05 1.1|b0d |b0f 1.1|b11 |b13 1.1|b29 |b2a 1.1|b31 |b32 1.1|b34 |b35 4.0|b36 1.1|b3a |b3c 1.1|b44 5.1|b45 |b47 1.1|b49 |b4b 1.1|b4e |b53 18.0|b55 13.0|b56 1.1|b58 |b5c 1.1|b5e |b5f 1.1|b62 5.1|b64 |b66 1.1|b71 4.0|b72 6.0|b78 |b82 1.1|b84 |b85 1.1|b8b |b8e 1.1|b91 |b92 1.1|b96 |b99 1.1|b9b |b9c 1.1|b9d |b9e 1.1|ba0 |ba3 1.1|ba5 |ba8 1.1|bab |bae 1.1|bb6 4.1|bb7 1.1|bba |bbe 1.1|bc3 |bc6 1.1|bc9 |bca 1.1|bce |bd0 5.1|bd1 |bd7 1.1|bd8 |be6 4.1|be7 1.1|bf3 4.0|bfb |c00 7.0|c01 1.1|c04 11.0|c05 1.1|c0d |c0e 1.1|c11 |c12 1.1|c29 |c2a 1.1|c34 7.0|c35 1.1|c3a |c3c 14.0|c3d 5.1|c3e 1.1|c45 |c46 1.1|c49 |c4a 1.1|c4e |c55 1.1|c57 |c58 5.1|c5a 8.0|c5b |c5c 17.0|c5d 14.0|c5e |c60 1.1|c62 5.1|c64 |c66 1.1|c70 |c77 12.0|c78 5.1|c80 9.0|c81 7.0|c82 1.1|c84 11.0|c85 1.1|c8d |c8e 1.1|c91 |c92 1.1|ca9 |caa 1.1|cb4 |cb5 1.1|cba |cbc 4.0|cbe 1.1|cc5 |cc6 1.1|cc9 |cca 1.1|cce |cd5 1.1|cd7 |cdc 17.0|cdd 14.0|cde 1.1|cdf |ce0 1.1|ce2 5.0|ce4 |ce6 1.1|cf0 |cf1 5.0|cf3 15.0|cf4 |d00 10.0|d01 7.0|d02 1.1|d04 13.0|d05 1.1|d0d |d0e 1.1|d11 |d12 1.1|d29 6.0|d2a 1.1|d3a 6.0|d3b 10.0|d3d 5.1|d3e 1.1|d44 5.1|d45 |d46 1.1|d49 |d4a 1.1|d4e 6.0|d4f 9.0|d50 |d54 9.0|d57 1.1|d58 9.0|d5f 8.0|d60 1.1|d62 5.1|d64 |d66 1.1|d70 5.1|d76 9.0|d79 5.1|d80 |d81 13.0|d82 3.0|d84 |d85 3.0|d97 |d9a 3.0|db2 |db3 3.0|dbc |dbd 3.0|dbe |dc0 3.0|dc7 |dca 3.0|dcb |dcf 3.0|dd5 |dd6 3.0|dd7 |dd8 3.0|de0 |de6 7.0|df0 |df2 3.0|df5 |e01 1.1|e3b |e3f 1.1|e5c |e81 1.1|e83 |e84 1.1|e85 |e86 12.0|e87 1.1|e89 12.0|e8a 1.1|e8b |e8c 12.0|e8d 1.1|e8e 12.0|e94 1.1|e98 12.0|e99 1.1|ea0 12.0|ea1 1.1|ea4 |ea5 1.1|ea6 |ea7 1.1|ea8 12.0|eaa 1.1|eac 12.0|ead 1.1|eba 12.0|ebb 1.1|ebe |ec0 1.1|ec5 |ec6 1.1|ec7 |ec8 1.1|ece 15.0|ecf |ed0 1.1|eda |edc 1.1|ede 6.1|ee0 |f00 2.0|f48 |f49 2.0|f6a 3.0|f6b 5.1|f6d |f71 2.0|f8c 6.0|f90 2.0|f96 3.0|f97 2.0|f98 |f99 2.0|fae 3.0|fb1 2.0|fb8 3.0|fb9 2.0|fba 3.0|fbd |fbe 3.0|fcd |fce 5.1|fcf 3.0|fd0 4.1|fd2 5.1|fd5 5.2|fd9 6.0|fdb |1000 3.0|1022 5.1|1023 3.0|1028 5.1|1029 3.0|102b 5.1|102c 3.0|1033 5.1|1036 3.0|103a 5.1|1040 3.0|105a 5.1|109a 5.2|109e 5.1|10a0 1.1|10c6 |10c7 6.1|10c8 |10cd 6.1|10ce |10d0 1.1|10f7 3.2|10f9 4.1|10fb 1.1|10fc 4.1|10fd 6.1|1100 1.1|115a 5.2|115f 1.1|11a3 5.2|11a8 1.1|11fa 5.2|1200 3.0|1207 4.1|1208 3.0|1247 4.1|1248 3.0|1249 |124a 3.0|124e |1250 3.0|1257 |1258 3.0|1259 |125a 3.0|125e |1260 3.0|1287 4.1|1288 3.0|1289 |128a 3.0|128e |1290 3.0|12af 4.1|12b0 3.0|12b1 |12b2 3.0|12b6 |12b8 3.0|12bf |12c0 3.0|12c1 |12c2 3.0|12c6 |12c8 3.0|12cf 4.1|12d0 3.0|12d7 |12d8 3.0|12ef 4.1|12f0 3.0|130f 4.1|1310 3.0|1311 |1312 3.0|1316 |1318 3.0|131f 4.1|1320 3.0|1347 4.1|1348 3.0|135b |135d 6.0|135f 4.1|1361 3.0|137d |1380 4.1|139a |13a0 3.0|13f5 8.0|13f6 |13f8 8.0|13fe |1400 5.2|1401 3.0|1677 5.2|1680 3.0|169d |16a0 3.0|16f1 7.0|16f9 |1700 3.2|170d 14.0|170e 3.2|1715 14.0|1716 |171f 14.0|1720 3.2|1737 |1740 3.2|1754 |1760 3.2|176d |176e 3.2|1771 |1772 3.2|1774 |1780 3.0|17dd 4.0|17de |17e0 3.0|17ea |17f0 4.0|17fa |1800 3.0|180f 14.0|1810 3.0|181a |1820 3.0|1878 11.0|1879 |1880 3.0|18aa 5.1|18ab |18b0 5.2|18f6 |1900 4.0|191d 7.0|191f |1920 4.0|192c |1930 4.0|193c |1940 4.0|1941 |1944 4.0|196e |1970 4.0|1975 |1980 4.1|19aa 5.2|19ac |19b0 4.1|19ca |19d0 4.1|19da 5.2|19db |19de 4.1|19e0 4.0|1a00 4.1|1a1c |1a1e 4.1|1a20 5.2|1a5f |1a60 5.2|1a7d |1a7f 5.2|1a8a |1a90 5.2|1a9a |1aa0 5.2|1aae |1ab0 7.0|1abf 13.0|1ac1 14.0|1acf 17.0|1ade 18.0|1ae0 17.0|1aec 18.0|1af1 |1b00 5.0|1b4c 14.0|1b4d |1b4e 16.0|1b50 5.0|1b7d 14.0|1b7f 16.0|1b80 5.1|1bab 6.1|1bae 5.1|1bba 6.1|1bc0 6.0|1bf4 |1bfc 6.0|1c00 5.1|1c38 |1c3b 5.1|1c4a |1c4d 5.1|1c80 9.0|1c89 16.0|1c8b |1c90 11.0|1cbb |1cbd 11.0|1cc0 6.1|1cc8 |1cd0 5.2|1cf3 6.1|1cf7 10.0|1cf8 7.0|1cfa 12.0|1cfb |1d00 4.0|1d6c 4.1|1dc4 5.0|1dcb 5.1|1de7 7.0|1df6 10.0|1dfa 14.0|1dfb 9.0|1dfc 6.0|1dfd 5.2|1dfe 5.0|1e00 1.1|1e9b 2.0|1e9c 5.1|1ea0 1.1|1efa 5.1|1f00 1.1|1f16 |1f18 1.1|1f1e |1f20 1.1|1f46 |1f48 1.1|1f4e |1f50 1.1|1f58 |1f59 1.1|1f5a |1f5b 1.1|1f5c |1f5d 1.1|1f5e |1f5f 1.1|1f7e |1f80 1.1|1fb5 |1fb6 1.1|1fc5 |1fc6 1.1|1fd4 |1fd6 1.1|1fdc |1fdd 1.1|1ff0 |1ff2 1.1|1ff5 |1ff6 1.1|1fff |2000 1.1|202f 3.0|2030 1.1|2047 3.2|2048 3.0|204e 3.2|2053 4.0|2055 4.1|2057 3.2|2058 4.1|205f 3.2|2064 5.1|2065 |2066 6.3|206a 1.1|2071 3.2|2072 |2074 1.1|208f 18.0|2090 4.1|2095 6.0|209d 18.0|20a0 1.1|20ab 2.0|20ac 2.1|20ad 3.0|20b0 3.2|20b2 4.1|20b6 5.2|20b9 6.0|20ba 6.2|20bb 7.0|20be 8.0|20bf 10.0|20c0 14.0|20c1 17.0|20c2 18.0|20c5 |20d0 1.1|20e2 3.0|20e4 3.2|20eb 4.1|20ec 5.0|20f0 5.1|20f1 |2100 1.1|2139 3.0|213b 4.0|213c 4.1|213d 3.2|214c 4.1|214d 5.0|214f 5.1|2150 5.2|2153 1.1|2183 3.0|2184 5.0|2185 5.1|2189 5.2|218a 8.0|218c |2190 1.1|21eb 3.0|21f4 3.2|2200 1.1|22f2 3.2|2300 1.1|2301 3.0|2302 1.1|237b 3.0|237c 3.2|237d 3.0|239b 3.2|23cf 4.0|23d1 4.1|23dc 5.0|23e8 5.2|23e9 6.0|23f4 7.0|23fb 9.0|23ff 10.0|2400 1.1|2425 3.0|2427 16.0|242a |2440 1.1|244b |2460 1.1|24eb 3.2|24ff 4.0|2500 1.1|2596 3.2|25a0 1.1|25f0 3.0|25f8 3.2|2600 1.1|2614 4.0|2616 3.2|2618 4.1|2619 3.0|261a 1.1|2670 3.0|2672 3.2|267e 4.1|2680 3.2|268a 4.0|2692 4.1|269d 5.1|269e 5.2|26a0 4.0|26a2 4.1|26b2 5.0|26b3 5.1|26bd 5.2|26c0 5.1|26c4 5.2|26ce 6.0|26cf 5.2|26e2 6.0|26e3 5.2|26e4 6.0|26e8 5.2|2700 7.0|2701 1.1|2705 6.0|2706 1.1|270a 6.0|270c 1.1|2728 6.0|2729 1.1|274c 6.0|274d 1.1|274e 6.0|274f 1.1|2753 6.0|2756 1.1|2757 5.2|2758 1.1|275f 6.0|2761 1.1|2768 3.2|2776 1.1|2795 6.0|2798 1.1|27b0 6.0|27b1 1.1|27bf 6.0|27c0 4.1|27c7 5.0|27cb 6.1|27cc 5.1|27cd 6.1|27ce 6.0|27d0 3.2|27ec 5.1|27f0 3.2|2800 3.0|2900 3.2|2b00 4.0|2b0e 4.1|2b14 5.0|2b1b 5.1|2b20 5.0|2b24 5.1|2b4d 7.0|2b50 5.1|2b55 5.2|2b5a 7.0|2b74 |2b76 7.0|2b96 17.0|2b97 13.0|2b98 7.0|2bba 11.0|2bbd 7.0|2bc9 12.0|2bca 7.0|2bd2 10.0|2bd3 11.0|2bec 8.0|2bf0 11.0|2bff 12.0|2c00 4.1|2c2f 14.0|2c30 4.1|2c5f 14.0|2c60 5.0|2c6d 5.1|2c70 5.2|2c71 5.1|2c74 5.0|2c78 5.1|2c7e 5.2|2c80 4.1|2ceb 5.2|2cf2 6.1|2cf4 |2cf9 4.1|2d26 |2d27 6.1|2d28 |2d2d 6.1|2d2e |2d30 4.1|2d66 6.1|2d68 |2d6f 4.1|2d70 6.0|2d71 |2d7f 6.0|2d80 4.1|2d97 |2da0 4.1|2da7 |2da8 4.1|2daf |2db0 4.1|2db7 |2db8 4.1|2dbf |2dc0 4.1|2dc7 |2dc8 4.1|2dcf |2dd0 4.1|2dd7 |2dd8 4.1|2ddf |2de0 5.1|2e00 4.1|2e18 5.1|2e1c 4.1|2e1e 5.1|2e31 5.2|2e32 6.1|2e3c 7.0|2e43 9.0|2e45 10.0|2e4a 11.0|2e4f 12.0|2e50 13.0|2e53 14.0|2e5e |2e60 18.0|2e64 |2e80 3.0|2e9a |2e9b 3.0|2ef4 |2f00 3.0|2fd6 |2ff0 3.0|2ffc 15.1|3000 1.1|3038 3.0|303b 3.2|303e 3.0|303f 1.1|3040 |3041 1.1|3095 3.2|3097 |3099 1.1|309f 3.2|30a1 1.1|30ff 3.2|3100 |3105 1.1|312d 5.1|312e 10.0|312f 11.0|3130 |3131 1.1|318f |3190 1.1|31a0 3.0|31b8 6.0|31bb 13.0|31c0 4.1|31d0 5.1|31e4 16.0|31e6 |31ef 15.1|31f0 3.2|3200 1.1|321d 4.0|321f |3220 1.1|3244 5.2|3250 4.0|3251 3.2|3260 1.1|327c 4.0|327e 4.1|327f 1.1|32b1 3.2|32c0 1.1|32cc 4.0|32d0 1.1|32ff 12.1|3300 1.1|3377 4.0|337b 1.1|33de 4.0|33e0 1.1|33ff 4.0|3400 3.0|4db6 13.0|4dc0 4.0|4e00 1.1|9fa6 4.1|9fbc 5.1|9fc4 5.2|9fcc 6.1|9fcd 8.0|9fd6 10.0|9feb 11.0|9ff0 13.0|9ffd 14.0|a000 3.0|a48d |a490 3.0|a4a2 3.2|a4a4 3.0|a4b4 3.2|a4b5 3.0|a4c1 3.2|a4c2 3.0|a4c5 3.2|a4c6 3.0|a4c7 |a4d0 5.2|a500 5.1|a62c |a640 5.1|a660 6.0|a662 5.1|a674 6.1|a67c 5.1|a698 7.0|a69e 8.0|a69f 6.1|a6a0 5.2|a6f8 |a700 4.1|a717 5.0|a71b 5.1|a720 5.0|a722 5.1|a78d 6.0|a78f 8.0|a790 6.0|a792 6.1|a794 7.0|a7a0 6.0|a7aa 6.1|a7ab 7.0|a7ae 9.0|a7af 11.0|a7b0 7.0|a7b2 8.0|a7b8 11.0|a7ba 12.0|a7c0 14.0|a7c2 12.0|a7c7 13.0|a7cb 16.0|a7ce 17.0|a7d0 14.0|a7d2 17.0|a7d3 14.0|a7d4 17.0|a7d5 14.0|a7da 16.0|a7dd 18.0|a7de |a7e2 18.0|a7e3 |a7f1 17.0|a7f2 14.0|a7f5 13.0|a7f7 7.0|a7f8 6.1|a7fa 6.0|a7fb 5.1|a800 4.1|a82c 13.0|a82d |a830 5.2|a83a |a840 5.0|a878 |a880 5.1|a8c5 9.0|a8c6 |a8ce 5.1|a8da |a8e0 5.2|a8fc 8.0|a8fe 11.0|a900 5.1|a954 |a95f 5.1|a960 5.2|a97d |a980 5.2|a9ce |a9cf 5.2|a9da |a9de 5.2|a9e0 7.0|a9ff |aa00 5.1|aa37 |aa40 5.1|aa4e |aa50 5.1|aa5a |aa5c 5.1|aa60 5.2|aa7c 7.0|aa80 5.2|aac3 |aadb 5.2|aae0 6.1|aaf7 |ab01 6.0|ab07 |ab09 6.0|ab0f |ab11 6.0|ab17 |ab20 6.0|ab27 |ab28 6.0|ab2f |ab30 7.0|ab60 8.0|ab64 7.0|ab66 12.0|ab68 13.0|ab6c 18.0|ab6e |ab70 8.0|abc0 5.2|abee |abf0 5.2|abfa |ac00 2.0|d7a4 |d7b0 5.2|d7c7 |d7cb 5.2|d7fc |d800 2.0|e000 1.1|fa2e 6.1|fa30 3.2|fa6b 5.2|fa6e |fa70 4.1|fada |fb00 1.1|fb07 |fb13 1.1|fb18 |fb1d 3.0|fb1e 1.1|fb37 |fb38 1.1|fb3d |fb3e 1.1|fb3f |fb40 1.1|fb42 |fb43 1.1|fb45 |fb46 1.1|fbb2 6.0|fbc2 14.0|fbc3 17.0|fbd3 1.1|fd40 14.0|fd50 1.1|fd90 17.0|fd92 1.1|fdc8 17.0|fdcf 14.0|fdd0 3.1|fdf0 1.1|fdfc 3.2|fdfd 4.0|fdfe 14.0|fe00 3.2|fe10 4.1|fe1a |fe20 1.1|fe24 5.1|fe27 7.0|fe2e 8.0|fe30 1.1|fe45 3.2|fe47 4.0|fe49 1.1|fe53 |fe54 1.1|fe67 |fe68 1.1|fe6c |fe70 1.1|fe73 3.2|fe74 1.1|fe75 |fe76 1.1|fefd |feff 1.1|ff00 |ff01 1.1|ff5f 3.2|ff61 1.1|ffbf |ffc2 1.1|ffc8 |ffca 1.1|ffd0 |ffd2 1.1|ffd8 |ffda 1.1|ffdd |ffe0 1.1|ffe7 |ffe8 1.1|ffef |fff9 3.0|fffc 2.1|fffd 1.1|10000 4.0|1000c |1000d 4.0|10027 |10028 4.0|1003b |1003c 4.0|1003e |1003f 4.0|1004e |10050 4.0|1005e |10080 4.0|100fb |10100 4.0|10103 |10107 4.0|10134 |10137 4.0|10140 4.1|1018b 7.0|1018d 9.0|1018f |10190 5.1|1019c 13.0|1019d |101a0 7.0|101a1 |101d0 5.1|101fe |10280 5.1|1029d |102a0 5.1|102d1 |102e0 7.0|102fc |10300 3.1|1031f 7.0|10320 3.1|10324 |1032d 10.0|10330 3.1|1034b |10350 7.0|1037b |10380 4.0|1039e |1039f 4.0|103a0 4.1|103c4 |103c8 4.1|103d6 |10400 3.1|10426 4.0|10428 3.1|1044e 4.0|1049e |104a0 4.0|104aa |104b0 9.0|104d4 |104d8 9.0|104fc |10500 7.0|10528 |10530 7.0|10564 |1056f 7.0|10570 14.0|1057b |1057c 14.0|1058b |1058c 14.0|10593 |10594 14.0|10596 |10597 14.0|105a2 |105a3 14.0|105b2 |105b3 14.0|105ba |105bb 14.0|105bd |105c0 16.0|105f4 |10600 7.0|10737 |10740 7.0|10756 |10760 7.0|10768 |10780 14.0|10786 |10787 14.0|107b1 |107b2 14.0|107bb 18.0|107c0 |10800 4.0|10806 |10808 4.0|10809 |1080a 4.0|10836 |10837 4.0|10839 |1083c 4.0|1083d |1083f 4.0|10840 5.2|10856 |10857 5.2|10860 7.0|1089f |108a7 7.0|108b0 |108e0 8.0|108f3 |108f4 8.0|108f6 |108fb 8.0|10900 5.0|1091a 5.2|1091c |1091f 5.0|10920 5.1|1093a |1093f 5.1|10940 17.0|1095a |10980 6.1|109b8 |109bc 8.0|109be 6.1|109c0 8.0|109d0 |109d2 8.0|10a00 4.1|10a04 |10a05 4.1|10a07 |10a0c 4.1|10a14 |10a15 4.1|10a18 |10a19 4.1|10a34 11.0|10a36 |10a38 4.1|10a3b |10a3f 4.1|10a48 11.0|10a49 |10a50 4.1|10a59 |10a60 5.2|10a80 7.0|10aa0 |10ac0 7.0|10ae7 |10aeb 7.0|10af7 |10b00 5.2|10b36 |10b39 5.2|10b56 |10b58 5.2|10b73 |10b78 5.2|10b80 7.0|10b92 |10b99 7.0|10b9d |10ba9 7.0|10bb0 |10c00 5.2|10c49 |10c80 8.0|10cb3 |10cc0 8.0|10cf3 |10cfa 8.0|10d00 11.0|10d28 |10d30 11.0|10d3a |10d40 16.0|10d66 |10d69 16.0|10d86 |10d8e 16.0|10d90 |10e60 5.2|10e7f |10e80 13.0|10eaa |10eab 13.0|10eae |10eb0 13.0|10eb2 |10ec2 16.0|10ec5 17.0|10ec8 |10ec9 18.0|10ed0 17.0|10ed9 18.0|10eef |10ef0 18.0|10efa 17.0|10efc 16.0|10efd 15.0|10f00 11.0|10f28 |10f30 11.0|10f5a |10f70 14.0|10f8a |10fb0 13.0|10fcc |10fe0 12.0|10ff7 |11000 6.0|1104e |11052 6.0|11070 14.0|11076 |1107f 7.0|11080 5.2|110c2 14.0|110c3 |110cd 11.0|110ce |110d0 6.1|110e9 |110f0 6.1|110fa |11100 6.1|11135 |11136 6.1|11144 11.0|11147 13.0|11148 |11150 7.0|11177 |11180 6.1|111c9 8.0|111cd 7.0|111ce 13.0|111d0 6.1|111da 7.0|111db 8.0|111e0 |111e1 7.0|111f5 |11200 7.0|11212 |11213 7.0|1123e 9.0|1123f 15.0|11242 |11280 8.0|11287 |11288 8.0|11289 |1128a 8.0|1128e |1128f 8.0|1129e |1129f 8.0|112aa |112b0 7.0|112eb |112f0 7.0|112fa |11300 8.0|11301 7.0|11304 |11305 7.0|1130d |1130f 7.0|11311 |11313 7.0|11329 |1132a 7.0|11331 |11332 7.0|11334 |11335 7.0|1133a |1133b 11.0|1133c 7.0|11345 |11347 7.0|11349 |1134b 7.0|1134e |11350 8.0|11351 |11357 7.0|11358 |1135d 7.0|11364 |11366 7.0|1136d |11370 7.0|11375 |11380 16.0|1138a |1138b 16.0|1138c |1138e 16.0|1138f |11390 16.0|113b6 |113b7 16.0|113c1 |113c2 16.0|113c3 |113c5 16.0|113c6 |113c7 16.0|113cb |113cc 16.0|113d6 |113d7 16.0|113d9 |113e1 16.0|113e3 |11400 9.0|1145a 13.0|1145b 9.0|1145c |1145d 9.0|1145e 11.0|1145f 12.0|11460 13.0|11462 |11480 7.0|114c8 |114d0 7.0|114da |11580 7.0|115b6 |115b8 7.0|115ca 8.0|115de |11600 7.0|11645 |11650 7.0|1165a |11660 9.0|1166d |11680 6.1|116b8 12.0|116b9 14.0|116ba |116c0 6.1|116ca |116d0 16.0|116e4 |11700 8.0|1171a 11.0|1171b |1171d 8.0|1172c |11730 8.0|11740 14.0|11747 |11800 11.0|1183c |118a0 7.0|118f3 |118ff 7.0|11900 13.0|11907 |11909 13.0|1190a |1190c 13.0|11914 |11915 13.0|11917 |11918 13.0|11936 |11937 13.0|11939 |1193b 13.0|11947 |11950 13.0|1195a |119a0 12.0|119a8 |119aa 12.0|119d8 |119da 12.0|119e5 |11a00 10.0|11a48 |11a50 10.0|11a84 12.0|11a86 10.0|11a9d 11.0|11a9e 10.0|11aa3 |11ab0 14.0|11ac0 7.0|11af9 |11b00 15.0|11b0a 18.0|11b0b |11b60 17.0|11b68 |11bc0 16.0|11be2 |11bf0 16.0|11bfa |11c00 9.0|11c09 |11c0a 9.0|11c37 |11c38 9.0|11c46 |11c50 9.0|11c6d |11c70 9.0|11c90 |11c92 9.0|11ca8 |11ca9 9.0|11cb7 |11d00 10.0|11d07 |11d08 10.0|11d0a |11d0b 10.0|11d37 |11d3a 10.0|11d3b |11d3c 10.0|11d3e |11d3f 10.0|11d48 |11d50 10.0|11d5a |11d60 11.0|11d66 |11d67 11.0|11d69 |11d6a 11.0|11d8f |11d90 11.0|11d92 |11d93 11.0|11d99 |11da0 11.0|11daa |11db0 17.0|11ddc |11de0 17.0|11dea |11df0 18.0|11df2 |11ee0 11.0|11ef9 |11f00 15.0|11f11 |11f12 15.0|11f3b |11f3e 15.0|11f5a 16.0|11f5b |11fb0 13.0|11fb1 |11fc0 12.0|11ff2 |11fff 12.0|12000 5.0|1236f 7.0|12399 8.0|1239a |12400 5.0|12463 7.0|1246f 18.0|12470 5.0|12474 7.0|12475 18.0|12480 8.0|12544 |12550 18.0|12687 |12f90 14.0|12ff3 |13000 5.2|1342f 15.0|13430 12.0|13439 15.0|13456 |13460 16.0|143fb |14400 8.0|14647 |16100 16.0|1613a |16800 6.0|16a39 |16a40 7.0|16a5f |16a60 7.0|16a6a |16a6e 7.0|16a70 14.0|16abf |16ac0 14.0|16aca |16ad0 7.0|16aee |16af0 7.0|16af6 |16b00 7.0|16b46 |16b50 7.0|16b5a |16b5b 7.0|16b62 |16b63 7.0|16b78 |16b7d 7.0|16b90 |16d40 16.0|16d7a |16e40 11.0|16e9b |16ea0 17.0|16eb9 |16ebb 17.0|16ed4 |16f00 6.1|16f45 12.0|16f4b |16f4f 12.0|16f50 6.1|16f7f 12.0|16f88 |16f8f 6.1|16fa0 |16fe0 9.0|16fe1 10.0|16fe2 12.0|16fe4 13.0|16fe5 |16ff0 13.0|16ff2 17.0|16ff7 |17000 9.0|187ed 11.0|187f2 12.0|187f8 17.0|18800 9.0|18af3 13.0|18cd6 18.0|18cdb |18cff 16.0|18d00 13.0|18d09 17.0|18d1f 18.0|18d21 |18d80 17.0|18df3 |18e00 18.0|19192 |191a0 18.0|191d3 |1aff0 14.0|1aff4 |1aff5 14.0|1affc |1affd 14.0|1afff |1b000 6.0|1b002 10.0|1b11f 14.0|1b123 18.0|1b129 |1b132 15.0|1b133 |1b150 12.0|1b153 |1b155 15.0|1b156 |1b164 12.0|1b168 18.0|1b169 |1b170 10.0|1b2fc |1bc00 7.0|1bc6b |1bc70 7.0|1bc7d |1bc80 7.0|1bc89 |1bc90 7.0|1bc9a |1bc9c 7.0|1bca4 |1cc00 16.0|1ccfa 17.0|1ccfd |1cd00 16.0|1ceb4 |1ceba 17.0|1ced1 |1ced2 18.0|1ced5 |1cedd 18.0|1cee0 17.0|1cef1 18.0|1cefe |1cf00 14.0|1cf2e |1cf30 14.0|1cf47 |1cf50 14.0|1cfc4 |1d000 3.1|1d0f6 |1d100 3.1|1d127 18.0|1d129 5.1|1d12a 3.1|1d1de 8.0|1d1e9 14.0|1d1eb 18.0|1d200 4.1|1d246 |1d250 18.0|1d282 |1d2c0 15.0|1d2d4 |1d2e0 11.0|1d2f4 |1d300 4.0|1d357 |1d360 5.0|1d372 11.0|1d379 |1d400 3.1|1d455 |1d456 3.1|1d49d |1d49e 3.1|1d4a0 |1d4a2 3.1|1d4a3 |1d4a5 3.1|1d4a7 |1d4a9 3.1|1d4ad |1d4ae 3.1|1d4ba |1d4bb 3.1|1d4bc |1d4bd 3.1|1d4c1 4.0|1d4c2 3.1|1d4c4 |1d4c5 3.1|1d506 |1d507 3.1|1d50b |1d50d 3.1|1d515 |1d516 3.1|1d51d |1d51e 3.1|1d53a |1d53b 3.1|1d53f |1d540 3.1|1d545 |1d546 3.1|1d547 |1d54a 3.1|1d551 |1d552 3.1|1d6a4 4.1|1d6a6 18.0|1d6a7 |1d6a8 3.1|1d7ca 5.0|1d7cc |1d7ce 3.1|1d800 8.0|1da8c |1da9b 8.0|1daa0 |1daa1 8.0|1dab0 |1db00 18.0|1db1d |1df00 14.0|1df1f 18.0|1df25 15.0|1df2b 18.0|1df82 |1df90 18.0|1df97 |1dfcd 18.0|1e000 9.0|1e007 |1e008 9.0|1e019 |1e01b 9.0|1e022 |1e023 9.0|1e025 |1e026 9.0|1e02b |1e030 15.0|1e06e |1e08f 15.0|1e090 |1e100 12.0|1e12d |1e130 12.0|1e13e |1e140 12.0|1e14a |1e14e 12.0|1e150 |1e290 14.0|1e2af |1e2c0 12.0|1e2fa |1e2ff 12.0|1e300 |1e4d0 15.0|1e4fa |1e5d0 16.0|1e5fb |1e5ff 16.0|1e600 |1e6c0 17.0|1e6df |1e6e0 17.0|1e6f6 |1e6fe 17.0|1e700 |1e7e0 14.0|1e7e7 |1e7e8 14.0|1e7ec |1e7ed 14.0|1e7ef |1e7f0 14.0|1e7ff |1e800 7.0|1e8c5 |1e8c7 7.0|1e8d7 |1e900 9.0|1e94b 12.0|1e94c |1e950 9.0|1e95a |1e95e 9.0|1e960 |1ec71 11.0|1ecb5 |1ed01 12.0|1ed3e |1ee00 6.1|1ee04 |1ee05 6.1|1ee20 |1ee21 6.1|1ee23 |1ee24 6.1|1ee25 |1ee27 6.1|1ee28 |1ee29 6.1|1ee33 |1ee34 6.1|1ee38 |1ee39 6.1|1ee3a |1ee3b 6.1|1ee3c |1ee42 6.1|1ee43 |1ee47 6.1|1ee48 |1ee49 6.1|1ee4a |1ee4b 6.1|1ee4c |1ee4d 6.1|1ee50 |1ee51 6.1|1ee53 |1ee54 6.1|1ee55 |1ee57 6.1|1ee58 |1ee59 6.1|1ee5a |1ee5b 6.1|1ee5c |1ee5d 6.1|1ee5e |1ee5f 6.1|1ee60 |1ee61 6.1|1ee63 |1ee64 6.1|1ee65 |1ee67 6.1|1ee6b |1ee6c 6.1|1ee73 |1ee74 6.1|1ee78 |1ee79 6.1|1ee7d |1ee7e 6.1|1ee7f |1ee80 6.1|1ee8a |1ee8b 6.1|1ee9c |1eea1 6.1|1eea4 |1eea5 6.1|1eeaa |1eeab 6.1|1eebc |1eef0 6.1|1eef2 |1f000 5.1|1f02c |1f030 5.1|1f094 |1f0a0 6.0|1f0af |1f0b1 6.0|1f0bf 7.0|1f0c0 |1f0c1 6.0|1f0d0 |1f0d1 6.0|1f0e0 7.0|1f0f6 |1f100 5.2|1f10b 7.0|1f10d 13.0|1f110 5.2|1f12f 11.0|1f130 6.0|1f131 5.2|1f132 6.0|1f13d 5.2|1f13e 6.0|1f13f 5.2|1f140 6.0|1f142 5.2|1f143 6.0|1f146 5.2|1f147 6.0|1f14a 5.2|1f14f 6.0|1f157 5.2|1f158 6.0|1f15f 5.2|1f160 6.0|1f16a 6.1|1f16c 12.0|1f16d 13.0|1f170 6.0|1f179 5.2|1f17a 6.0|1f17b 5.2|1f17d 6.0|1f17f 5.2|1f180 6.0|1f18a 5.2|1f18e 6.0|1f190 5.2|1f191 6.0|1f19b 9.0|1f1ad 13.0|1f1ae 18.0|1f1af |1f1e6 6.0|1f200 5.2|1f201 6.0|1f203 |1f210 5.2|1f232 6.0|1f23b 9.0|1f23c |1f240 5.2|1f249 |1f250 6.0|1f252 |1f260 10.0|1f266 |1f300 6.0|1f321 7.0|1f32d 8.0|1f330 6.0|1f336 7.0|1f337 6.0|1f37d 7.0|1f37e 8.0|1f380 6.0|1f394 7.0|1f3a0 6.0|1f3c5 7.0|1f3c6 6.0|1f3cb 7.0|1f3cf 8.0|1f3d4 7.0|1f3e0 6.0|1f3f1 7.0|1f3f8 8.0|1f400 6.0|1f43f 7.0|1f440 6.0|1f441 7.0|1f442 6.0|1f4f8 7.0|1f4f9 6.0|1f4fd 7.0|1f4ff 8.0|1f500 6.0|1f53e 7.0|1f540 6.1|1f544 7.0|1f54b 8.0|1f550 6.0|1f568 7.0|1f57a 9.0|1f57b 7.0|1f5a4 9.0|1f5a5 7.0|1f5fb 6.0|1f600 6.1|1f601 6.0|1f611 6.1|1f612 6.0|1f615 6.1|1f616 6.0|1f617 6.1|1f618 6.0|1f619 6.1|1f61a 6.0|1f61b 6.1|1f61c 6.0|1f61f 6.1|1f620 6.0|1f626 6.1|1f628 6.0|1f62c 6.1|1f62d 6.0|1f62e 6.1|1f630 6.0|1f634 6.1|1f635 6.0|1f641 7.0|1f643 8.0|1f645 6.0|1f650 7.0|1f680 6.0|1f6c6 7.0|1f6d0 8.0|1f6d1 9.0|1f6d3 10.0|1f6d5 12.0|1f6d6 13.0|1f6d8 17.0|1f6d9 18.0|1f6da |1f6dc 15.0|1f6dd 14.0|1f6e0 7.0|1f6ed |1f6f0 7.0|1f6f4 9.0|1f6f7 10.0|1f6f9 11.0|1f6fa 12.0|1f6fb 13.0|1f6fd |1f700 6.0|1f774 15.0|1f777 17.0|1f77b 15.0|1f780 7.0|1f7d5 11.0|1f7d9 15.0|1f7da 18.0|1f7dc |1f7e0 12.0|1f7ec |1f7f0 14.0|1f7f1 18.0|1f800 7.0|1f80c |1f810 7.0|1f848 |1f850 7.0|1f85a |1f860 7.0|1f888 |1f890 7.0|1f8ae |1f8b0 13.0|1f8b2 16.0|1f8bc |1f8c0 16.0|1f8c2 |1f8d0 17.0|1f8d9 |1f900 10.0|1f90c 13.0|1f90d 12.0|1f910 8.0|1f919 9.0|1f91f 10.0|1f920 9.0|1f928 10.0|1f930 9.0|1f931 10.0|1f933 9.0|1f93f 12.0|1f940 9.0|1f94c 10.0|1f94d 11.0|1f950 9.0|1f95f 10.0|1f96c 11.0|1f971 12.0|1f972 13.0|1f973 11.0|1f977 13.0|1f979 14.0|1f97a 11.0|1f97b 12.0|1f97c 11.0|1f980 8.0|1f985 9.0|1f992 10.0|1f998 11.0|1f9a3 13.0|1f9a5 12.0|1f9ab 13.0|1f9ae 12.0|1f9b0 11.0|1f9ba 12.0|1f9c0 8.0|1f9c1 11.0|1f9c3 12.0|1f9cb 13.0|1f9cc 14.0|1f9cd 12.0|1f9d0 10.0|1f9e7 11.0|1fa00 12.0|1fa54 17.0|1fa58 |1fa60 11.0|1fa6e |1fa70 12.0|1fa74 13.0|1fa75 15.0|1fa78 12.0|1fa7b 14.0|1fa7d |1fa80 12.0|1fa83 13.0|1fa87 15.0|1fa89 16.0|1fa8a 17.0|1fa8b 18.0|1fa8e 17.0|1fa8f 16.0|1fa90 12.0|1fa96 13.0|1faa9 14.0|1faad 15.0|1fab0 13.0|1fab7 14.0|1fabb 15.0|1fabe 16.0|1fabf 15.0|1fac0 13.0|1fac3 14.0|1fac6 16.0|1fac7 |1fac8 17.0|1fac9 |1facc 18.0|1facd 17.0|1face 15.0|1fad0 13.0|1fad7 14.0|1fada 15.0|1fadc 16.0|1fadd 18.0|1fade |1fadf 16.0|1fae0 14.0|1fae8 15.0|1fae9 16.0|1faea 17.0|1faeb 18.0|1faec |1faef 17.0|1faf0 14.0|1faf7 15.0|1faf9 18.0|1fafb |1fb00 13.0|1fb93 |1fb94 13.0|1fbcb 16.0|1fbf0 13.0|1fbfa 17.0|1fbfb |1fffe 2.0|20000 3.1|2a6d7 13.0|2a6de 14.0|2a6e0 |2a700 5.2|2b735 14.0|2b739 15.0|2b73a 17.0|2b740 6.0|2b81e 18.0|2b81f |2b820 8.0|2cea2 17.0|2ceae |2ceb0 10.0|2ebe1 |2ebf0 15.1|2ee5e |2f800 3.1|2fa1e |2fffe 2.0|30000 13.0|3134b |31350 15.0|323b0 17.0|3347a |3d000 18.0|3fc40 |3fffe 2.0|40000 |4fffe 2.0|50000 |5fffe 2.0|60000 |6fffe 2.0|70000 |7fffe 2.0|80000 |8fffe 2.0|90000 |9fffe 2.0|a0000 |afffe 2.0|b0000 |bfffe 2.0|c0000 |cfffe 2.0|d0000 |dfffe 2.0|e0000 |e0001 3.1|e0002 |e0020 3.1|e0080 |e0100 4.0|e01f0 |efffe 2.0|110000 ";
var UppercaseMappings = "61 0041|62 0042|63 0043|64 0044|65 0045|66 0046|67 0047|68 0048|69 0049|6a 004a|6b 004b|6c 004c|6d 004d|6e 004e|6f 004f|70 0050|71 0051|72 0052|73 0053|74 0054|75 0055|76 0056|77 0057|78 0058|79 0059|7a 005a|b5 039c|e0 00c0|e1 00c1|e2 00c2|e3 00c3|e4 00c4|e5 00c5|e6 00c6|e7 00c7|e8 00c8|e9 00c9|ea 00ca|eb 00cb|ec 00cc|ed 00cd|ee 00ce|ef 00cf|f0 00d0|f1 00d1|f2 00d2|f3 00d3|f4 00d4|f5 00d5|f6 00d6|f8 00d8|f9 00d9|fa 00da|fb 00db|fc 00dc|fd 00dd|fe 00de|ff 0178|101 0100|103 0102|105 0104|107 0106|109 0108|10b 010a|10d 010c|10f 010e|111 0110|113 0112|115 0114|117 0116|119 0118|11b 011a|11d 011c|11f 011e|121 0120|123 0122|125 0124|127 0126|129 0128|12b 012a|12d 012c|12f 012e|131 0049|133 0132|135 0134|137 0136|13a 0139|13c 013b|13e 013d|140 013f|142 0141|144 0143|146 0145|148 0147|14b 014a|14d 014c|14f 014e|151 0150|153 0152|155 0154|157 0156|159 0158|15b 015a|15d 015c|15f 015e|161 0160|163 0162|165 0164|167 0166|169 0168|16b 016a|16d 016c|16f 016e|171 0170|173 0172|175 0174|177 0176|17a 0179|17c 017b|17e 017d|17f 0053|180 0243|183 0182|185 0184|188 0187|18c 018b|192 0191|195 01f6|199 0198|19a 023d|19b a7dc|19e 0220|1a1 01a0|1a3 01a2|1a5 01a4|1a8 01a7|1ad 01ac|1b0 01af|1b4 01b3|1b6 01b5|1b9 01b8|1bd 01bc|1bf 01f7|1c5 01c4|1c6 01c4|1c8 01c7|1c9 01c7|1cb 01ca|1cc 01ca|1ce 01cd|1d0 01cf|1d2 01d1|1d4 01d3|1d6 01d5|1d8 01d7|1da 01d9|1dc 01db|1dd 018e|1df 01de|1e1 01e0|1e3 01e2|1e5 01e4|1e7 01e6|1e9 01e8|1eb 01ea|1ed 01ec|1ef 01ee|1f2 01f1|1f3 01f1|1f5 01f4|1f9 01f8|1fb 01fa|1fd 01fc|1ff 01fe|201 0200|203 0202|205 0204|207 0206|209 0208|20b 020a|20d 020c|20f 020e|211 0210|213 0212|215 0214|217 0216|219 0218|21b 021a|21d 021c|21f 021e|223 0222|225 0224|227 0226|229 0228|22b 022a|22d 022c|22f 022e|231 0230|233 0232|23c 023b|23f 2c7e|240 2c7f|242 0241|247 0246|249 0248|24b 024a|24d 024c|24f 024e|250 2c6f|251 2c6d|252 2c70|253 0181|254 0186|256 0189|257 018a|259 018f|25b 0190|25c a7ab|260 0193|261 a7ac|263 0194|264 a7cb|265 a78d|266 a7aa|268 0197|269 0196|26a a7ae|26b 2c62|26c a7ad|26f 019c|271 2c6e|272 019d|275 019f|277 a7dd|27c a7e2|27d 2c64|280 01a6|282 a7c5|283 01a9|287 a7b1|288 01ae|289 0244|28a 01b1|28b 01b2|28c 0245|292 01b7|29d a7b2|29e a7b0|345 0399|371 0370|373 0372|377 0376|37b 03fd|37c 03fe|37d 03ff|3ac 0386|3ad 0388|3ae 0389|3af 038a|3b1 0391|3b2 0392|3b3 0393|3b4 0394|3b5 0395|3b6 0396|3b7 0397|3b8 0398|3b9 0399|3ba 039a|3bb 039b|3bc 039c|3bd 039d|3be 039e|3bf 039f|3c0 03a0|3c1 03a1|3c2 03a3|3c3 03a3|3c4 03a4|3c5 03a5|3c6 03a6|3c7 03a7|3c8 03a8|3c9 03a9|3ca 03aa|3cb 03ab|3cc 038c|3cd 038e|3ce 038f|3d0 0392|3d1 0398|3d5 03a6|3d6 03a0|3d7 03cf|3d9 03d8|3db 03da|3dd 03dc|3df 03de|3e1 03e0|3e3 03e2|3e5 03e4|3e7 03e6|3e9 03e8|3eb 03ea|3ed 03ec|3ef 03ee|3f0 039a|3f1 03a1|3f2 03f9|3f3 037f|3f5 0395|3f8 03f7|3fb 03fa|430 0410|431 0411|432 0412|433 0413|434 0414|435 0415|436 0416|437 0417|438 0418|439 0419|43a 041a|43b 041b|43c 041c|43d 041d|43e 041e|43f 041f|440 0420|441 0421|442 0422|443 0423|444 0424|445 0425|446 0426|447 0427|448 0428|449 0429|44a 042a|44b 042b|44c 042c|44d 042d|44e 042e|44f 042f|450 0400|451 0401|452 0402|453 0403|454 0404|455 0405|456 0406|457 0407|458 0408|459 0409|45a 040a|45b 040b|45c 040c|45d 040d|45e 040e|45f 040f|461 0460|463 0462|465 0464|467 0466|469 0468|46b 046a|46d 046c|46f 046e|471 0470|473 0472|475 0474|477 0476|479 0478|47b 047a|47d 047c|47f 047e|481 0480|48b 048a|48d 048c|48f 048e|491 0490|493 0492|495 0494|497 0496|499 0498|49b 049a|49d 049c|49f 049e|4a1 04a0|4a3 04a2|4a5 04a4|4a7 04a6|4a9 04a8|4ab 04aa|4ad 04ac|4af 04ae|4b1 04b0|4b3 04b2|4b5 04b4|4b7 04b6|4b9 04b8|4bb 04ba|4bd 04bc|4bf 04be|4c2 04c1|4c4 04c3|4c6 04c5|4c8 04c7|4ca 04c9|4cc 04cb|4ce 04cd|4cf 04c0|4d1 04d0|4d3 04d2|4d5 04d4|4d7 04d6|4d9 04d8|4db 04da|4dd 04dc|4df 04de|4e1 04e0|4e3 04e2|4e5 04e4|4e7 04e6|4e9 04e8|4eb 04ea|4ed 04ec|4ef 04ee|4f1 04f0|4f3 04f2|4f5 04f4|4f7 04f6|4f9 04f8|4fb 04fa|4fd 04fc|4ff 04fe|501 0500|503 0502|505 0504|507 0506|509 0508|50b 050a|50d 050c|50f 050e|511 0510|513 0512|515 0514|517 0516|519 0518|51b 051a|51d 051c|51f 051e|521 0520|523 0522|525 0524|527 0526|529 0528|52b 052a|52d 052c|52f 052e|561 0531|562 0532|563 0533|564 0534|565 0535|566 0536|567 0537|568 0538|569 0539|56a 053a|56b 053b|56c 053c|56d 053d|56e 053e|56f 053f|570 0540|571 0541|572 0542|573 0543|574 0544|575 0545|576 0546|577 0547|578 0548|579 0549|57a 054a|57b 054b|57c 054c|57d 054d|57e 054e|57f 054f|580 0550|581 0551|582 0552|583 0553|584 0554|585 0555|586 0556|10d0 1c90|10d1 1c91|10d2 1c92|10d3 1c93|10d4 1c94|10d5 1c95|10d6 1c96|10d7 1c97|10d8 1c98|10d9 1c99|10da 1c9a|10db 1c9b|10dc 1c9c|10dd 1c9d|10de 1c9e|10df 1c9f|10e0 1ca0|10e1 1ca1|10e2 1ca2|10e3 1ca3|10e4 1ca4|10e5 1ca5|10e6 1ca6|10e7 1ca7|10e8 1ca8|10e9 1ca9|10ea 1caa|10eb 1cab|10ec 1cac|10ed 1cad|10ee 1cae|10ef 1caf|10f0 1cb0|10f1 1cb1|10f2 1cb2|10f3 1cb3|10f4 1cb4|10f5 1cb5|10f6 1cb6|10f7 1cb7|10f8 1cb8|10f9 1cb9|10fa 1cba|10fd 1cbd|10fe 1cbe|10ff 1cbf|13f8 13f0|13f9 13f1|13fa 13f2|13fb 13f3|13fc 13f4|13fd 13f5|1c80 0412|1c81 0414|1c82 041e|1c83 0421|1c84 0422|1c85 0422|1c86 042a|1c87 0462|1c88 a64a|1c8a 1c89|1d79 a77d|1d7d 2c63|1d8e a7c6|1e01 1e00|1e03 1e02|1e05 1e04|1e07 1e06|1e09 1e08|1e0b 1e0a|1e0d 1e0c|1e0f 1e0e|1e11 1e10|1e13 1e12|1e15 1e14|1e17 1e16|1e19 1e18|1e1b 1e1a|1e1d 1e1c|1e1f 1e1e|1e21 1e20|1e23 1e22|1e25 1e24|1e27 1e26|1e29 1e28|1e2b 1e2a|1e2d 1e2c|1e2f 1e2e|1e31 1e30|1e33 1e32|1e35 1e34|1e37 1e36|1e39 1e38|1e3b 1e3a|1e3d 1e3c|1e3f 1e3e|1e41 1e40|1e43 1e42|1e45 1e44|1e47 1e46|1e49 1e48|1e4b 1e4a|1e4d 1e4c|1e4f 1e4e|1e51 1e50|1e53 1e52|1e55 1e54|1e57 1e56|1e59 1e58|1e5b 1e5a|1e5d 1e5c|1e5f 1e5e|1e61 1e60|1e63 1e62|1e65 1e64|1e67 1e66|1e69 1e68|1e6b 1e6a|1e6d 1e6c|1e6f 1e6e|1e71 1e70|1e73 1e72|1e75 1e74|1e77 1e76|1e79 1e78|1e7b 1e7a|1e7d 1e7c|1e7f 1e7e|1e81 1e80|1e83 1e82|1e85 1e84|1e87 1e86|1e89 1e88|1e8b 1e8a|1e8d 1e8c|1e8f 1e8e|1e91 1e90|1e93 1e92|1e95 1e94|1e9b 1e60|1ea1 1ea0|1ea3 1ea2|1ea5 1ea4|1ea7 1ea6|1ea9 1ea8|1eab 1eaa|1ead 1eac|1eaf 1eae|1eb1 1eb0|1eb3 1eb2|1eb5 1eb4|1eb7 1eb6|1eb9 1eb8|1ebb 1eba|1ebd 1ebc|1ebf 1ebe|1ec1 1ec0|1ec3 1ec2|1ec5 1ec4|1ec7 1ec6|1ec9 1ec8|1ecb 1eca|1ecd 1ecc|1ecf 1ece|1ed1 1ed0|1ed3 1ed2|1ed5 1ed4|1ed7 1ed6|1ed9 1ed8|1edb 1eda|1edd 1edc|1edf 1ede|1ee1 1ee0|1ee3 1ee2|1ee5 1ee4|1ee7 1ee6|1ee9 1ee8|1eeb 1eea|1eed 1eec|1eef 1eee|1ef1 1ef0|1ef3 1ef2|1ef5 1ef4|1ef7 1ef6|1ef9 1ef8|1efb 1efa|1efd 1efc|1eff 1efe|1f00 1f08|1f01 1f09|1f02 1f0a|1f03 1f0b|1f04 1f0c|1f05 1f0d|1f06 1f0e|1f07 1f0f|1f10 1f18|1f11 1f19|1f12 1f1a|1f13 1f1b|1f14 1f1c|1f15 1f1d|1f20 1f28|1f21 1f29|1f22 1f2a|1f23 1f2b|1f24 1f2c|1f25 1f2d|1f26 1f2e|1f27 1f2f|1f30 1f38|1f31 1f39|1f32 1f3a|1f33 1f3b|1f34 1f3c|1f35 1f3d|1f36 1f3e|1f37 1f3f|1f40 1f48|1f41 1f49|1f42 1f4a|1f43 1f4b|1f44 1f4c|1f45 1f4d|1f51 1f59|1f53 1f5b|1f55 1f5d|1f57 1f5f|1f60 1f68|1f61 1f69|1f62 1f6a|1f63 1f6b|1f64 1f6c|1f65 1f6d|1f66 1f6e|1f67 1f6f|1f70 1fba|1f71 1fbb|1f72 1fc8|1f73 1fc9|1f74 1fca|1f75 1fcb|1f76 1fda|1f77 1fdb|1f78 1ff8|1f79 1ff9|1f7a 1fea|1f7b 1feb|1f7c 1ffa|1f7d 1ffb|1f80 1f88|1f81 1f89|1f82 1f8a|1f83 1f8b|1f84 1f8c|1f85 1f8d|1f86 1f8e|1f87 1f8f|1f90 1f98|1f91 1f99|1f92 1f9a|1f93 1f9b|1f94 1f9c|1f95 1f9d|1f96 1f9e|1f97 1f9f|1fa0 1fa8|1fa1 1fa9|1fa2 1faa|1fa3 1fab|1fa4 1fac|1fa5 1fad|1fa6 1fae|1fa7 1faf|1fb0 1fb8|1fb1 1fb9|1fb3 1fbc|1fbe 0399|1fc3 1fcc|1fd0 1fd8|1fd1 1fd9|1fe0 1fe8|1fe1 1fe9|1fe5 1fec|1ff3 1ffc|214e 2132|2170 2160|2171 2161|2172 2162|2173 2163|2174 2164|2175 2165|2176 2166|2177 2167|2178 2168|2179 2169|217a 216a|217b 216b|217c 216c|217d 216d|217e 216e|217f 216f|2184 2183|24d0 24b6|24d1 24b7|24d2 24b8|24d3 24b9|24d4 24ba|24d5 24bb|24d6 24bc|24d7 24bd|24d8 24be|24d9 24bf|24da 24c0|24db 24c1|24dc 24c2|24dd 24c3|24de 24c4|24df 24c5|24e0 24c6|24e1 24c7|24e2 24c8|24e3 24c9|24e4 24ca|24e5 24cb|24e6 24cc|24e7 24cd|24e8 24ce|24e9 24cf|2c30 2c00|2c31 2c01|2c32 2c02|2c33 2c03|2c34 2c04|2c35 2c05|2c36 2c06|2c37 2c07|2c38 2c08|2c39 2c09|2c3a 2c0a|2c3b 2c0b|2c3c 2c0c|2c3d 2c0d|2c3e 2c0e|2c3f 2c0f|2c40 2c10|2c41 2c11|2c42 2c12|2c43 2c13|2c44 2c14|2c45 2c15|2c46 2c16|2c47 2c17|2c48 2c18|2c49 2c19|2c4a 2c1a|2c4b 2c1b|2c4c 2c1c|2c4d 2c1d|2c4e 2c1e|2c4f 2c1f|2c50 2c20|2c51 2c21|2c52 2c22|2c53 2c23|2c54 2c24|2c55 2c25|2c56 2c26|2c57 2c27|2c58 2c28|2c59 2c29|2c5a 2c2a|2c5b 2c2b|2c5c 2c2c|2c5d 2c2d|2c5e 2c2e|2c5f 2c2f|2c61 2c60|2c65 023a|2c66 023e|2c68 2c67|2c6a 2c69|2c6c 2c6b|2c73 2c72|2c76 2c75|2c81 2c80|2c83 2c82|2c85 2c84|2c87 2c86|2c89 2c88|2c8b 2c8a|2c8d 2c8c|2c8f 2c8e|2c91 2c90|2c93 2c92|2c95 2c94|2c97 2c96|2c99 2c98|2c9b 2c9a|2c9d 2c9c|2c9f 2c9e|2ca1 2ca0|2ca3 2ca2|2ca5 2ca4|2ca7 2ca6|2ca9 2ca8|2cab 2caa|2cad 2cac|2caf 2cae|2cb1 2cb0|2cb3 2cb2|2cb5 2cb4|2cb7 2cb6|2cb9 2cb8|2cbb 2cba|2cbd 2cbc|2cbf 2cbe|2cc1 2cc0|2cc3 2cc2|2cc5 2cc4|2cc7 2cc6|2cc9 2cc8|2ccb 2cca|2ccd 2ccc|2ccf 2cce|2cd1 2cd0|2cd3 2cd2|2cd5 2cd4|2cd7 2cd6|2cd9 2cd8|2cdb 2cda|2cdd 2cdc|2cdf 2cde|2ce1 2ce0|2ce3 2ce2|2cec 2ceb|2cee 2ced|2cf3 2cf2|2d00 10a0|2d01 10a1|2d02 10a2|2d03 10a3|2d04 10a4|2d05 10a5|2d06 10a6|2d07 10a7|2d08 10a8|2d09 10a9|2d0a 10aa|2d0b 10ab|2d0c 10ac|2d0d 10ad|2d0e 10ae|2d0f 10af|2d10 10b0|2d11 10b1|2d12 10b2|2d13 10b3|2d14 10b4|2d15 10b5|2d16 10b6|2d17 10b7|2d18 10b8|2d19 10b9|2d1a 10ba|2d1b 10bb|2d1c 10bc|2d1d 10bd|2d1e 10be|2d1f 10bf|2d20 10c0|2d21 10c1|2d22 10c2|2d23 10c3|2d24 10c4|2d25 10c5|2d27 10c7|2d2d 10cd|a641 a640|a643 a642|a645 a644|a647 a646|a649 a648|a64b a64a|a64d a64c|a64f a64e|a651 a650|a653 a652|a655 a654|a657 a656|a659 a658|a65b a65a|a65d a65c|a65f a65e|a661 a660|a663 a662|a665 a664|a667 a666|a669 a668|a66b a66a|a66d a66c|a681 a680|a683 a682|a685 a684|a687 a686|a689 a688|a68b a68a|a68d a68c|a68f a68e|a691 a690|a693 a692|a695 a694|a697 a696|a699 a698|a69b a69a|a723 a722|a725 a724|a727 a726|a729 a728|a72b a72a|a72d a72c|a72f a72e|a733 a732|a735 a734|a737 a736|a739 a738|a73b a73a|a73d a73c|a73f a73e|a741 a740|a743 a742|a745 a744|a747 a746|a749 a748|a74b a74a|a74d a74c|a74f a74e|a751 a750|a753 a752|a755 a754|a757 a756|a759 a758|a75b a75a|a75d a75c|a75f a75e|a761 a760|a763 a762|a765 a764|a767 a766|a769 a768|a76b a76a|a76d a76c|a76f a76e|a77a a779|a77c a77b|a77f a77e|a781 a780|a783 a782|a785 a784|a787 a786|a78c a78b|a791 a790|a793 a792|a794 a7c4|a797 a796|a799 a798|a79b a79a|a79d a79c|a79f a79e|a7a1 a7a0|a7a3 a7a2|a7a5 a7a4|a7a7 a7a6|a7a9 a7a8|a7b5 a7b4|a7b7 a7b6|a7b9 a7b8|a7bb a7ba|a7bd a7bc|a7bf a7be|a7c1 a7c0|a7c3 a7c2|a7c8 a7c7|a7ca a7c9|a7cd a7cc|a7cf a7ce|a7d1 a7d0|a7d3 a7d2|a7d5 a7d4|a7d7 a7d6|a7d9 a7d8|a7db a7da|a7f6 a7f5|ab4b ab6c|ab4c ab6d|ab53 a7b3|ab70 13a0|ab71 13a1|ab72 13a2|ab73 13a3|ab74 13a4|ab75 13a5|ab76 13a6|ab77 13a7|ab78 13a8|ab79 13a9|ab7a 13aa|ab7b 13ab|ab7c 13ac|ab7d 13ad|ab7e 13ae|ab7f 13af|ab80 13b0|ab81 13b1|ab82 13b2|ab83 13b3|ab84 13b4|ab85 13b5|ab86 13b6|ab87 13b7|ab88 13b8|ab89 13b9|ab8a 13ba|ab8b 13bb|ab8c 13bc|ab8d 13bd|ab8e 13be|ab8f 13bf|ab90 13c0|ab91 13c1|ab92 13c2|ab93 13c3|ab94 13c4|ab95 13c5|ab96 13c6|ab97 13c7|ab98 13c8|ab99 13c9|ab9a 13ca|ab9b 13cb|ab9c 13cc|ab9d 13cd|ab9e 13ce|ab9f 13cf|aba0 13d0|aba1 13d1|aba2 13d2|aba3 13d3|aba4 13d4|aba5 13d5|aba6 13d6|aba7 13d7|aba8 13d8|aba9 13d9|abaa 13da|abab 13db|abac 13dc|abad 13dd|abae 13de|abaf 13df|abb0 13e0|abb1 13e1|abb2 13e2|abb3 13e3|abb4 13e4|abb5 13e5|abb6 13e6|abb7 13e7|abb8 13e8|abb9 13e9|abba 13ea|abbb 13eb|abbc 13ec|abbd 13ed|abbe 13ee|abbf 13ef|ff41 ff21|ff42 ff22|ff43 ff23|ff44 ff24|ff45 ff25|ff46 ff26|ff47 ff27|ff48 ff28|ff49 ff29|ff4a ff2a|ff4b ff2b|ff4c ff2c|ff4d ff2d|ff4e ff2e|ff4f ff2f|ff50 ff30|ff51 ff31|ff52 ff32|ff53 ff33|ff54 ff34|ff55 ff35|ff56 ff36|ff57 ff37|ff58 ff38|ff59 ff39|ff5a ff3a|10428 10400|10429 10401|1042a 10402|1042b 10403|1042c 10404|1042d 10405|1042e 10406|1042f 10407|10430 10408|10431 10409|10432 1040a|10433 1040b|10434 1040c|10435 1040d|10436 1040e|10437 1040f|10438 10410|10439 10411|1043a 10412|1043b 10413|1043c 10414|1043d 10415|1043e 10416|1043f 10417|10440 10418|10441 10419|10442 1041a|10443 1041b|10444 1041c|10445 1041d|10446 1041e|10447 1041f|10448 10420|10449 10421|1044a 10422|1044b 10423|1044c 10424|1044d 10425|1044e 10426|1044f 10427|104d8 104b0|104d9 104b1|104da 104b2|104db 104b3|104dc 104b4|104dd 104b5|104de 104b6|104df 104b7|104e0 104b8|104e1 104b9|104e2 104ba|104e3 104bb|104e4 104bc|104e5 104bd|104e6 104be|104e7 104bf|104e8 104c0|104e9 104c1|104ea 104c2|104eb 104c3|104ec 104c4|104ed 104c5|104ee 104c6|104ef 104c7|104f0 104c8|104f1 104c9|104f2 104ca|104f3 104cb|104f4 104cc|104f5 104cd|104f6 104ce|104f7 104cf|104f8 104d0|104f9 104d1|104fa 104d2|104fb 104d3|10597 10570|10598 10571|10599 10572|1059a 10573|1059b 10574|1059c 10575|1059d 10576|1059e 10577|1059f 10578|105a0 10579|105a1 1057a|105a3 1057c|105a4 1057d|105a5 1057e|105a6 1057f|105a7 10580|105a8 10581|105a9 10582|105aa 10583|105ab 10584|105ac 10585|105ad 10586|105ae 10587|105af 10588|105b0 10589|105b1 1058a|105b3 1058c|105b4 1058d|105b5 1058e|105b6 1058f|105b7 10590|105b8 10591|105b9 10592|105bb 10594|105bc 10595|10cc0 10c80|10cc1 10c81|10cc2 10c82|10cc3 10c83|10cc4 10c84|10cc5 10c85|10cc6 10c86|10cc7 10c87|10cc8 10c88|10cc9 10c89|10cca 10c8a|10ccb 10c8b|10ccc 10c8c|10ccd 10c8d|10cce 10c8e|10ccf 10c8f|10cd0 10c90|10cd1 10c91|10cd2 10c92|10cd3 10c93|10cd4 10c94|10cd5 10c95|10cd6 10c96|10cd7 10c97|10cd8 10c98|10cd9 10c99|10cda 10c9a|10cdb 10c9b|10cdc 10c9c|10cdd 10c9d|10cde 10c9e|10cdf 10c9f|10ce0 10ca0|10ce1 10ca1|10ce2 10ca2|10ce3 10ca3|10ce4 10ca4|10ce5 10ca5|10ce6 10ca6|10ce7 10ca7|10ce8 10ca8|10ce9 10ca9|10cea 10caa|10ceb 10cab|10cec 10cac|10ced 10cad|10cee 10cae|10cef 10caf|10cf0 10cb0|10cf1 10cb1|10cf2 10cb2|10d70 10d50|10d71 10d51|10d72 10d52|10d73 10d53|10d74 10d54|10d75 10d55|10d76 10d56|10d77 10d57|10d78 10d58|10d79 10d59|10d7a 10d5a|10d7b 10d5b|10d7c 10d5c|10d7d 10d5d|10d7e 10d5e|10d7f 10d5f|10d80 10d60|10d81 10d61|10d82 10d62|10d83 10d63|10d84 10d64|10d85 10d65|118c0 118a0|118c1 118a1|118c2 118a2|118c3 118a3|118c4 118a4|118c5 118a5|118c6 118a6|118c7 118a7|118c8 118a8|118c9 118a9|118ca 118aa|118cb 118ab|118cc 118ac|118cd 118ad|118ce 118ae|118cf 118af|118d0 118b0|118d1 118b1|118d2 118b2|118d3 118b3|118d4 118b4|118d5 118b5|118d6 118b6|118d7 118b7|118d8 118b8|118d9 118b9|118da 118ba|118db 118bb|118dc 118bc|118dd 118bd|118de 118be|118df 118bf|16e60 16e40|16e61 16e41|16e62 16e42|16e63 16e43|16e64 16e44|16e65 16e45|16e66 16e46|16e67 16e47|16e68 16e48|16e69 16e49|16e6a 16e4a|16e6b 16e4b|16e6c 16e4c|16e6d 16e4d|16e6e 16e4e|16e6f 16e4f|16e70 16e50|16e71 16e51|16e72 16e52|16e73 16e53|16e74 16e54|16e75 16e55|16e76 16e56|16e77 16e57|16e78 16e58|16e79 16e59|16e7a 16e5a|16e7b 16e5b|16e7c 16e5c|16e7d 16e5d|16e7e 16e5e|16e7f 16e5f|16ebb 16ea0|16ebc 16ea1|16ebd 16ea2|16ebe 16ea3|16ebf 16ea4|16ec0 16ea5|16ec1 16ea6|16ec2 16ea7|16ec3 16ea8|16ec4 16ea9|16ec5 16eaa|16ec6 16eab|16ec7 16eac|16ec8 16ead|16ec9 16eae|16eca 16eaf|16ecb 16eb0|16ecc 16eb1|16ecd 16eb2|16ece 16eb3|16ecf 16eb4|16ed0 16eb5|16ed1 16eb6|16ed2 16eb7|16ed3 16eb8|1df41 1df40|1df49 1df48|1df4b 1df4a|1df4e 1df4d|1df52 1df51|1df69 1df68|1df6b 1df6a|1df6d 1df6c|1df6f 1df6e|1df73 1df72|1df75 1df74|1df77 1df76|1df79 1df78|1df7b 1df7a|1df7d 1df7c|1df7f 1df7e|1e922 1e900|1e923 1e901|1e924 1e902|1e925 1e903|1e926 1e904|1e927 1e905|1e928 1e906|1e929 1e907|1e92a 1e908|1e92b 1e909|1e92c 1e90a|1e92d 1e90b|1e92e 1e90c|1e92f 1e90d|1e930 1e90e|1e931 1e90f|1e932 1e910|1e933 1e911|1e934 1e912|1e935 1e913|1e936 1e914|1e937 1e915|1e938 1e916|1e939 1e917|1e93a 1e918|1e93b 1e919|1e93c 1e91a|1e93d 1e91b|1e93e 1e91c|1e93f 1e91d|1e940 1e91e|1e941 1e91f|1e942 1e920|1e943 1e921";
var LowercaseMappings = "41 0061|42 0062|43 0063|44 0064|45 0065|46 0066|47 0067|48 0068|49 0069|4a 006a|4b 006b|4c 006c|4d 006d|4e 006e|4f 006f|50 0070|51 0071|52 0072|53 0073|54 0074|55 0075|56 0076|57 0077|58 0078|59 0079|5a 007a|c0 00e0|c1 00e1|c2 00e2|c3 00e3|c4 00e4|c5 00e5|c6 00e6|c7 00e7|c8 00e8|c9 00e9|ca 00ea|cb 00eb|cc 00ec|cd 00ed|ce 00ee|cf 00ef|d0 00f0|d1 00f1|d2 00f2|d3 00f3|d4 00f4|d5 00f5|d6 00f6|d8 00f8|d9 00f9|da 00fa|db 00fb|dc 00fc|dd 00fd|de 00fe|100 0101|102 0103|104 0105|106 0107|108 0109|10a 010b|10c 010d|10e 010f|110 0111|112 0113|114 0115|116 0117|118 0119|11a 011b|11c 011d|11e 011f|120 0121|122 0123|124 0125|126 0127|128 0129|12a 012b|12c 012d|12e 012f|130 0069|132 0133|134 0135|136 0137|139 013a|13b 013c|13d 013e|13f 0140|141 0142|143 0144|145 0146|147 0148|14a 014b|14c 014d|14e 014f|150 0151|152 0153|154 0155|156 0157|158 0159|15a 015b|15c 015d|15e 015f|160 0161|162 0163|164 0165|166 0167|168 0169|16a 016b|16c 016d|16e 016f|170 0171|172 0173|174 0175|176 0177|178 00ff|179 017a|17b 017c|17d 017e|181 0253|182 0183|184 0185|186 0254|187 0188|189 0256|18a 0257|18b 018c|18e 01dd|18f 0259|190 025b|191 0192|193 0260|194 0263|196 0269|197 0268|198 0199|19c 026f|19d 0272|19f 0275|1a0 01a1|1a2 01a3|1a4 01a5|1a6 0280|1a7 01a8|1a9 0283|1ac 01ad|1ae 0288|1af 01b0|1b1 028a|1b2 028b|1b3 01b4|1b5 01b6|1b7 0292|1b8 01b9|1bc 01bd|1c4 01c6|1c5 01c6|1c7 01c9|1c8 01c9|1ca 01cc|1cb 01cc|1cd 01ce|1cf 01d0|1d1 01d2|1d3 01d4|1d5 01d6|1d7 01d8|1d9 01da|1db 01dc|1de 01df|1e0 01e1|1e2 01e3|1e4 01e5|1e6 01e7|1e8 01e9|1ea 01eb|1ec 01ed|1ee 01ef|1f1 01f3|1f2 01f3|1f4 01f5|1f6 0195|1f7 01bf|1f8 01f9|1fa 01fb|1fc 01fd|1fe 01ff|200 0201|202 0203|204 0205|206 0207|208 0209|20a 020b|20c 020d|20e 020f|210 0211|212 0213|214 0215|216 0217|218 0219|21a 021b|21c 021d|21e 021f|220 019e|222 0223|224 0225|226 0227|228 0229|22a 022b|22c 022d|22e 022f|230 0231|232 0233|23a 2c65|23b 023c|23d 019a|23e 2c66|241 0242|243 0180|244 0289|245 028c|246 0247|248 0249|24a 024b|24c 024d|24e 024f|370 0371|372 0373|376 0377|37f 03f3|386 03ac|388 03ad|389 03ae|38a 03af|38c 03cc|38e 03cd|38f 03ce|391 03b1|392 03b2|393 03b3|394 03b4|395 03b5|396 03b6|397 03b7|398 03b8|399 03b9|39a 03ba|39b 03bb|39c 03bc|39d 03bd|39e 03be|39f 03bf|3a0 03c0|3a1 03c1|3a3 03c3|3a4 03c4|3a5 03c5|3a6 03c6|3a7 03c7|3a8 03c8|3a9 03c9|3aa 03ca|3ab 03cb|3cf 03d7|3d8 03d9|3da 03db|3dc 03dd|3de 03df|3e0 03e1|3e2 03e3|3e4 03e5|3e6 03e7|3e8 03e9|3ea 03eb|3ec 03ed|3ee 03ef|3f4 03b8|3f7 03f8|3f9 03f2|3fa 03fb|3fd 037b|3fe 037c|3ff 037d|400 0450|401 0451|402 0452|403 0453|404 0454|405 0455|406 0456|407 0457|408 0458|409 0459|40a 045a|40b 045b|40c 045c|40d 045d|40e 045e|40f 045f|410 0430|411 0431|412 0432|413 0433|414 0434|415 0435|416 0436|417 0437|418 0438|419 0439|41a 043a|41b 043b|41c 043c|41d 043d|41e 043e|41f 043f|420 0440|421 0441|422 0442|423 0443|424 0444|425 0445|426 0446|427 0447|428 0448|429 0449|42a 044a|42b 044b|42c 044c|42d 044d|42e 044e|42f 044f|460 0461|462 0463|464 0465|466 0467|468 0469|46a 046b|46c 046d|46e 046f|470 0471|472 0473|474 0475|476 0477|478 0479|47a 047b|47c 047d|47e 047f|480 0481|48a 048b|48c 048d|48e 048f|490 0491|492 0493|494 0495|496 0497|498 0499|49a 049b|49c 049d|49e 049f|4a0 04a1|4a2 04a3|4a4 04a5|4a6 04a7|4a8 04a9|4aa 04ab|4ac 04ad|4ae 04af|4b0 04b1|4b2 04b3|4b4 04b5|4b6 04b7|4b8 04b9|4ba 04bb|4bc 04bd|4be 04bf|4c0 04cf|4c1 04c2|4c3 04c4|4c5 04c6|4c7 04c8|4c9 04ca|4cb 04cc|4cd 04ce|4d0 04d1|4d2 04d3|4d4 04d5|4d6 04d7|4d8 04d9|4da 04db|4dc 04dd|4de 04df|4e0 04e1|4e2 04e3|4e4 04e5|4e6 04e7|4e8 04e9|4ea 04eb|4ec 04ed|4ee 04ef|4f0 04f1|4f2 04f3|4f4 04f5|4f6 04f7|4f8 04f9|4fa 04fb|4fc 04fd|4fe 04ff|500 0501|502 0503|504 0505|506 0507|508 0509|50a 050b|50c 050d|50e 050f|510 0511|512 0513|514 0515|516 0517|518 0519|51a 051b|51c 051d|51e 051f|520 0521|522 0523|524 0525|526 0527|528 0529|52a 052b|52c 052d|52e 052f|531 0561|532 0562|533 0563|534 0564|535 0565|536 0566|537 0567|538 0568|539 0569|53a 056a|53b 056b|53c 056c|53d 056d|53e 056e|53f 056f|540 0570|541 0571|542 0572|543 0573|544 0574|545 0575|546 0576|547 0577|548 0578|549 0579|54a 057a|54b 057b|54c 057c|54d 057d|54e 057e|54f 057f|550 0580|551 0581|552 0582|553 0583|554 0584|555 0585|556 0586|10a0 2d00|10a1 2d01|10a2 2d02|10a3 2d03|10a4 2d04|10a5 2d05|10a6 2d06|10a7 2d07|10a8 2d08|10a9 2d09|10aa 2d0a|10ab 2d0b|10ac 2d0c|10ad 2d0d|10ae 2d0e|10af 2d0f|10b0 2d10|10b1 2d11|10b2 2d12|10b3 2d13|10b4 2d14|10b5 2d15|10b6 2d16|10b7 2d17|10b8 2d18|10b9 2d19|10ba 2d1a|10bb 2d1b|10bc 2d1c|10bd 2d1d|10be 2d1e|10bf 2d1f|10c0 2d20|10c1 2d21|10c2 2d22|10c3 2d23|10c4 2d24|10c5 2d25|10c7 2d27|10cd 2d2d|13a0 ab70|13a1 ab71|13a2 ab72|13a3 ab73|13a4 ab74|13a5 ab75|13a6 ab76|13a7 ab77|13a8 ab78|13a9 ab79|13aa ab7a|13ab ab7b|13ac ab7c|13ad ab7d|13ae ab7e|13af ab7f|13b0 ab80|13b1 ab81|13b2 ab82|13b3 ab83|13b4 ab84|13b5 ab85|13b6 ab86|13b7 ab87|13b8 ab88|13b9 ab89|13ba ab8a|13bb ab8b|13bc ab8c|13bd ab8d|13be ab8e|13bf ab8f|13c0 ab90|13c1 ab91|13c2 ab92|13c3 ab93|13c4 ab94|13c5 ab95|13c6 ab96|13c7 ab97|13c8 ab98|13c9 ab99|13ca ab9a|13cb ab9b|13cc ab9c|13cd ab9d|13ce ab9e|13cf ab9f|13d0 aba0|13d1 aba1|13d2 aba2|13d3 aba3|13d4 aba4|13d5 aba5|13d6 aba6|13d7 aba7|13d8 aba8|13d9 aba9|13da abaa|13db abab|13dc abac|13dd abad|13de abae|13df abaf|13e0 abb0|13e1 abb1|13e2 abb2|13e3 abb3|13e4 abb4|13e5 abb5|13e6 abb6|13e7 abb7|13e8 abb8|13e9 abb9|13ea abba|13eb abbb|13ec abbc|13ed abbd|13ee abbe|13ef abbf|13f0 13f8|13f1 13f9|13f2 13fa|13f3 13fb|13f4 13fc|13f5 13fd|1c89 1c8a|1c90 10d0|1c91 10d1|1c92 10d2|1c93 10d3|1c94 10d4|1c95 10d5|1c96 10d6|1c97 10d7|1c98 10d8|1c99 10d9|1c9a 10da|1c9b 10db|1c9c 10dc|1c9d 10dd|1c9e 10de|1c9f 10df|1ca0 10e0|1ca1 10e1|1ca2 10e2|1ca3 10e3|1ca4 10e4|1ca5 10e5|1ca6 10e6|1ca7 10e7|1ca8 10e8|1ca9 10e9|1caa 10ea|1cab 10eb|1cac 10ec|1cad 10ed|1cae 10ee|1caf 10ef|1cb0 10f0|1cb1 10f1|1cb2 10f2|1cb3 10f3|1cb4 10f4|1cb5 10f5|1cb6 10f6|1cb7 10f7|1cb8 10f8|1cb9 10f9|1cba 10fa|1cbd 10fd|1cbe 10fe|1cbf 10ff|1e00 1e01|1e02 1e03|1e04 1e05|1e06 1e07|1e08 1e09|1e0a 1e0b|1e0c 1e0d|1e0e 1e0f|1e10 1e11|1e12 1e13|1e14 1e15|1e16 1e17|1e18 1e19|1e1a 1e1b|1e1c 1e1d|1e1e 1e1f|1e20 1e21|1e22 1e23|1e24 1e25|1e26 1e27|1e28 1e29|1e2a 1e2b|1e2c 1e2d|1e2e 1e2f|1e30 1e31|1e32 1e33|1e34 1e35|1e36 1e37|1e38 1e39|1e3a 1e3b|1e3c 1e3d|1e3e 1e3f|1e40 1e41|1e42 1e43|1e44 1e45|1e46 1e47|1e48 1e49|1e4a 1e4b|1e4c 1e4d|1e4e 1e4f|1e50 1e51|1e52 1e53|1e54 1e55|1e56 1e57|1e58 1e59|1e5a 1e5b|1e5c 1e5d|1e5e 1e5f|1e60 1e61|1e62 1e63|1e64 1e65|1e66 1e67|1e68 1e69|1e6a 1e6b|1e6c 1e6d|1e6e 1e6f|1e70 1e71|1e72 1e73|1e74 1e75|1e76 1e77|1e78 1e79|1e7a 1e7b|1e7c 1e7d|1e7e 1e7f|1e80 1e81|1e82 1e83|1e84 1e85|1e86 1e87|1e88 1e89|1e8a 1e8b|1e8c 1e8d|1e8e 1e8f|1e90 1e91|1e92 1e93|1e94 1e95|1e9e 00df|1ea0 1ea1|1ea2 1ea3|1ea4 1ea5|1ea6 1ea7|1ea8 1ea9|1eaa 1eab|1eac 1ead|1eae 1eaf|1eb0 1eb1|1eb2 1eb3|1eb4 1eb5|1eb6 1eb7|1eb8 1eb9|1eba 1ebb|1ebc 1ebd|1ebe 1ebf|1ec0 1ec1|1ec2 1ec3|1ec4 1ec5|1ec6 1ec7|1ec8 1ec9|1eca 1ecb|1ecc 1ecd|1ece 1ecf|1ed0 1ed1|1ed2 1ed3|1ed4 1ed5|1ed6 1ed7|1ed8 1ed9|1eda 1edb|1edc 1edd|1ede 1edf|1ee0 1ee1|1ee2 1ee3|1ee4 1ee5|1ee6 1ee7|1ee8 1ee9|1eea 1eeb|1eec 1eed|1eee 1eef|1ef0 1ef1|1ef2 1ef3|1ef4 1ef5|1ef6 1ef7|1ef8 1ef9|1efa 1efb|1efc 1efd|1efe 1eff|1f08 1f00|1f09 1f01|1f0a 1f02|1f0b 1f03|1f0c 1f04|1f0d 1f05|1f0e 1f06|1f0f 1f07|1f18 1f10|1f19 1f11|1f1a 1f12|1f1b 1f13|1f1c 1f14|1f1d 1f15|1f28 1f20|1f29 1f21|1f2a 1f22|1f2b 1f23|1f2c 1f24|1f2d 1f25|1f2e 1f26|1f2f 1f27|1f38 1f30|1f39 1f31|1f3a 1f32|1f3b 1f33|1f3c 1f34|1f3d 1f35|1f3e 1f36|1f3f 1f37|1f48 1f40|1f49 1f41|1f4a 1f42|1f4b 1f43|1f4c 1f44|1f4d 1f45|1f59 1f51|1f5b 1f53|1f5d 1f55|1f5f 1f57|1f68 1f60|1f69 1f61|1f6a 1f62|1f6b 1f63|1f6c 1f64|1f6d 1f65|1f6e 1f66|1f6f 1f67|1f88 1f80|1f89 1f81|1f8a 1f82|1f8b 1f83|1f8c 1f84|1f8d 1f85|1f8e 1f86|1f8f 1f87|1f98 1f90|1f99 1f91|1f9a 1f92|1f9b 1f93|1f9c 1f94|1f9d 1f95|1f9e 1f96|1f9f 1f97|1fa8 1fa0|1fa9 1fa1|1faa 1fa2|1fab 1fa3|1fac 1fa4|1fad 1fa5|1fae 1fa6|1faf 1fa7|1fb8 1fb0|1fb9 1fb1|1fba 1f70|1fbb 1f71|1fbc 1fb3|1fc8 1f72|1fc9 1f73|1fca 1f74|1fcb 1f75|1fcc 1fc3|1fd8 1fd0|1fd9 1fd1|1fda 1f76|1fdb 1f77|1fe8 1fe0|1fe9 1fe1|1fea 1f7a|1feb 1f7b|1fec 1fe5|1ff8 1f78|1ff9 1f79|1ffa 1f7c|1ffb 1f7d|1ffc 1ff3|2126 03c9|212a 006b|212b 00e5|2132 214e|2160 2170|2161 2171|2162 2172|2163 2173|2164 2174|2165 2175|2166 2176|2167 2177|2168 2178|2169 2179|216a 217a|216b 217b|216c 217c|216d 217d|216e 217e|216f 217f|2183 2184|24b6 24d0|24b7 24d1|24b8 24d2|24b9 24d3|24ba 24d4|24bb 24d5|24bc 24d6|24bd 24d7|24be 24d8|24bf 24d9|24c0 24da|24c1 24db|24c2 24dc|24c3 24dd|24c4 24de|24c5 24df|24c6 24e0|24c7 24e1|24c8 24e2|24c9 24e3|24ca 24e4|24cb 24e5|24cc 24e6|24cd 24e7|24ce 24e8|24cf 24e9|2c00 2c30|2c01 2c31|2c02 2c32|2c03 2c33|2c04 2c34|2c05 2c35|2c06 2c36|2c07 2c37|2c08 2c38|2c09 2c39|2c0a 2c3a|2c0b 2c3b|2c0c 2c3c|2c0d 2c3d|2c0e 2c3e|2c0f 2c3f|2c10 2c40|2c11 2c41|2c12 2c42|2c13 2c43|2c14 2c44|2c15 2c45|2c16 2c46|2c17 2c47|2c18 2c48|2c19 2c49|2c1a 2c4a|2c1b 2c4b|2c1c 2c4c|2c1d 2c4d|2c1e 2c4e|2c1f 2c4f|2c20 2c50|2c21 2c51|2c22 2c52|2c23 2c53|2c24 2c54|2c25 2c55|2c26 2c56|2c27 2c57|2c28 2c58|2c29 2c59|2c2a 2c5a|2c2b 2c5b|2c2c 2c5c|2c2d 2c5d|2c2e 2c5e|2c2f 2c5f|2c60 2c61|2c62 026b|2c63 1d7d|2c64 027d|2c67 2c68|2c69 2c6a|2c6b 2c6c|2c6d 0251|2c6e 0271|2c6f 0250|2c70 0252|2c72 2c73|2c75 2c76|2c7e 023f|2c7f 0240|2c80 2c81|2c82 2c83|2c84 2c85|2c86 2c87|2c88 2c89|2c8a 2c8b|2c8c 2c8d|2c8e 2c8f|2c90 2c91|2c92 2c93|2c94 2c95|2c96 2c97|2c98 2c99|2c9a 2c9b|2c9c 2c9d|2c9e 2c9f|2ca0 2ca1|2ca2 2ca3|2ca4 2ca5|2ca6 2ca7|2ca8 2ca9|2caa 2cab|2cac 2cad|2cae 2caf|2cb0 2cb1|2cb2 2cb3|2cb4 2cb5|2cb6 2cb7|2cb8 2cb9|2cba 2cbb|2cbc 2cbd|2cbe 2cbf|2cc0 2cc1|2cc2 2cc3|2cc4 2cc5|2cc6 2cc7|2cc8 2cc9|2cca 2ccb|2ccc 2ccd|2cce 2ccf|2cd0 2cd1|2cd2 2cd3|2cd4 2cd5|2cd6 2cd7|2cd8 2cd9|2cda 2cdb|2cdc 2cdd|2cde 2cdf|2ce0 2ce1|2ce2 2ce3|2ceb 2cec|2ced 2cee|2cf2 2cf3|a640 a641|a642 a643|a644 a645|a646 a647|a648 a649|a64a a64b|a64c a64d|a64e a64f|a650 a651|a652 a653|a654 a655|a656 a657|a658 a659|a65a a65b|a65c a65d|a65e a65f|a660 a661|a662 a663|a664 a665|a666 a667|a668 a669|a66a a66b|a66c a66d|a680 a681|a682 a683|a684 a685|a686 a687|a688 a689|a68a a68b|a68c a68d|a68e a68f|a690 a691|a692 a693|a694 a695|a696 a697|a698 a699|a69a a69b|a722 a723|a724 a725|a726 a727|a728 a729|a72a a72b|a72c a72d|a72e a72f|a732 a733|a734 a735|a736 a737|a738 a739|a73a a73b|a73c a73d|a73e a73f|a740 a741|a742 a743|a744 a745|a746 a747|a748 a749|a74a a74b|a74c a74d|a74e a74f|a750 a751|a752 a753|a754 a755|a756 a757|a758 a759|a75a a75b|a75c a75d|a75e a75f|a760 a761|a762 a763|a764 a765|a766 a767|a768 a769|a76a a76b|a76c a76d|a76e a76f|a779 a77a|a77b a77c|a77d 1d79|a77e a77f|a780 a781|a782 a783|a784 a785|a786 a787|a78b a78c|a78d 0265|a790 a791|a792 a793|a796 a797|a798 a799|a79a a79b|a79c a79d|a79e a79f|a7a0 a7a1|a7a2 a7a3|a7a4 a7a5|a7a6 a7a7|a7a8 a7a9|a7aa 0266|a7ab 025c|a7ac 0261|a7ad 026c|a7ae 026a|a7b0 029e|a7b1 0287|a7b2 029d|a7b3 ab53|a7b4 a7b5|a7b6 a7b7|a7b8 a7b9|a7ba a7bb|a7bc a7bd|a7be a7bf|a7c0 a7c1|a7c2 a7c3|a7c4 a794|a7c5 0282|a7c6 1d8e|a7c7 a7c8|a7c9 a7ca|a7cb 0264|a7cc a7cd|a7ce a7cf|a7d0 a7d1|a7d2 a7d3|a7d4 a7d5|a7d6 a7d7|a7d8 a7d9|a7da a7db|a7dc 019b|a7dd 0277|a7e2 027c|a7f5 a7f6|ab6c ab4b|ab6d ab4c|ff21 ff41|ff22 ff42|ff23 ff43|ff24 ff44|ff25 ff45|ff26 ff46|ff27 ff47|ff28 ff48|ff29 ff49|ff2a ff4a|ff2b ff4b|ff2c ff4c|ff2d ff4d|ff2e ff4e|ff2f ff4f|ff30 ff50|ff31 ff51|ff32 ff52|ff33 ff53|ff34 ff54|ff35 ff55|ff36 ff56|ff37 ff57|ff38 ff58|ff39 ff59|ff3a ff5a|10400 10428|10401 10429|10402 1042a|10403 1042b|10404 1042c|10405 1042d|10406 1042e|10407 1042f|10408 10430|10409 10431|1040a 10432|1040b 10433|1040c 10434|1040d 10435|1040e 10436|1040f 10437|10410 10438|10411 10439|10412 1043a|10413 1043b|10414 1043c|10415 1043d|10416 1043e|10417 1043f|10418 10440|10419 10441|1041a 10442|1041b 10443|1041c 10444|1041d 10445|1041e 10446|1041f 10447|10420 10448|10421 10449|10422 1044a|10423 1044b|10424 1044c|10425 1044d|10426 1044e|10427 1044f|104b0 104d8|104b1 104d9|104b2 104da|104b3 104db|104b4 104dc|104b5 104dd|104b6 104de|104b7 104df|104b8 104e0|104b9 104e1|104ba 104e2|104bb 104e3|104bc 104e4|104bd 104e5|104be 104e6|104bf 104e7|104c0 104e8|104c1 104e9|104c2 104ea|104c3 104eb|104c4 104ec|104c5 104ed|104c6 104ee|104c7 104ef|104c8 104f0|104c9 104f1|104ca 104f2|104cb 104f3|104cc 104f4|104cd 104f5|104ce 104f6|104cf 104f7|104d0 104f8|104d1 104f9|104d2 104fa|104d3 104fb|10570 10597|10571 10598|10572 10599|10573 1059a|10574 1059b|10575 1059c|10576 1059d|10577 1059e|10578 1059f|10579 105a0|1057a 105a1|1057c 105a3|1057d 105a4|1057e 105a5|1057f 105a6|10580 105a7|10581 105a8|10582 105a9|10583 105aa|10584 105ab|10585 105ac|10586 105ad|10587 105ae|10588 105af|10589 105b0|1058a 105b1|1058c 105b3|1058d 105b4|1058e 105b5|1058f 105b6|10590 105b7|10591 105b8|10592 105b9|10594 105bb|10595 105bc|10c80 10cc0|10c81 10cc1|10c82 10cc2|10c83 10cc3|10c84 10cc4|10c85 10cc5|10c86 10cc6|10c87 10cc7|10c88 10cc8|10c89 10cc9|10c8a 10cca|10c8b 10ccb|10c8c 10ccc|10c8d 10ccd|10c8e 10cce|10c8f 10ccf|10c90 10cd0|10c91 10cd1|10c92 10cd2|10c93 10cd3|10c94 10cd4|10c95 10cd5|10c96 10cd6|10c97 10cd7|10c98 10cd8|10c99 10cd9|10c9a 10cda|10c9b 10cdb|10c9c 10cdc|10c9d 10cdd|10c9e 10cde|10c9f 10cdf|10ca0 10ce0|10ca1 10ce1|10ca2 10ce2|10ca3 10ce3|10ca4 10ce4|10ca5 10ce5|10ca6 10ce6|10ca7 10ce7|10ca8 10ce8|10ca9 10ce9|10caa 10cea|10cab 10ceb|10cac 10cec|10cad 10ced|10cae 10cee|10caf 10cef|10cb0 10cf0|10cb1 10cf1|10cb2 10cf2|10d50 10d70|10d51 10d71|10d52 10d72|10d53 10d73|10d54 10d74|10d55 10d75|10d56 10d76|10d57 10d77|10d58 10d78|10d59 10d79|10d5a 10d7a|10d5b 10d7b|10d5c 10d7c|10d5d 10d7d|10d5e 10d7e|10d5f 10d7f|10d60 10d80|10d61 10d81|10d62 10d82|10d63 10d83|10d64 10d84|10d65 10d85|118a0 118c0|118a1 118c1|118a2 118c2|118a3 118c3|118a4 118c4|118a5 118c5|118a6 118c6|118a7 118c7|118a8 118c8|118a9 118c9|118aa 118ca|118ab 118cb|118ac 118cc|118ad 118cd|118ae 118ce|118af 118cf|118b0 118d0|118b1 118d1|118b2 118d2|118b3 118d3|118b4 118d4|118b5 118d5|118b6 118d6|118b7 118d7|118b8 118d8|118b9 118d9|118ba 118da|118bb 118db|118bc 118dc|118bd 118dd|118be 118de|118bf 118df|16e40 16e60|16e41 16e61|16e42 16e62|16e43 16e63|16e44 16e64|16e45 16e65|16e46 16e66|16e47 16e67|16e48 16e68|16e49 16e69|16e4a 16e6a|16e4b 16e6b|16e4c 16e6c|16e4d 16e6d|16e4e 16e6e|16e4f 16e6f|16e50 16e70|16e51 16e71|16e52 16e72|16e53 16e73|16e54 16e74|16e55 16e75|16e56 16e76|16e57 16e77|16e58 16e78|16e59 16e79|16e5a 16e7a|16e5b 16e7b|16e5c 16e7c|16e5d 16e7d|16e5e 16e7e|16e5f 16e7f|16ea0 16ebb|16ea1 16ebc|16ea2 16ebd|16ea3 16ebe|16ea4 16ebf|16ea5 16ec0|16ea6 16ec1|16ea7 16ec2|16ea8 16ec3|16ea9 16ec4|16eaa 16ec5|16eab 16ec6|16eac 16ec7|16ead 16ec8|16eae 16ec9|16eaf 16eca|16eb0 16ecb|16eb1 16ecc|16eb2 16ecd|16eb3 16ece|16eb4 16ecf|16eb5 16ed0|16eb6 16ed1|16eb7 16ed2|16eb8 16ed3|1df40 1df41|1df48 1df49|1df4a 1df4b|1df4d 1df4e|1df51 1df52|1df68 1df69|1df6a 1df6b|1df6c 1df6d|1df6e 1df6f|1df72 1df73|1df74 1df75|1df76 1df77|1df78 1df79|1df7a 1df7b|1df7c 1df7d|1df7e 1df7f|1e900 1e922|1e901 1e923|1e902 1e924|1e903 1e925|1e904 1e926|1e905 1e927|1e906 1e928|1e907 1e929|1e908 1e92a|1e909 1e92b|1e90a 1e92c|1e90b 1e92d|1e90c 1e92e|1e90d 1e92f|1e90e 1e930|1e90f 1e931|1e910 1e932|1e911 1e933|1e912 1e934|1e913 1e935|1e914 1e936|1e915 1e937|1e916 1e938|1e917 1e939|1e918 1e93a|1e919 1e93b|1e91a 1e93c|1e91b 1e93d|1e91c 1e93e|1e91d 1e93f|1e91e 1e940|1e91f 1e941|1e920 1e942|1e921 1e943";

// Source/UnicodeBrowser.js
var PageColumns = 16;
var PageRows = 16;
var Categories = Object.freeze(Blocks.filter(([, , Name]) => !Name.includes("Surrogate")).map(([First, Last, Name]) => Object.freeze({ First, Last, Name })));
var Pages = [];
var FirstPages = [];
Categories.forEach((Category, Index) => {
  FirstPages.push(Pages.length);
  for (let First = Category.First; First <= Category.Last; First += PageColumns * PageRows) {
    Pages.push(Object.freeze({ Category: Index, First, Last: Math.min(First + PageColumns * PageRows - 1, Category.Last) }));
  }
});
var PageCount = Pages.length;
function Page(Index) {
  return Pages[(Index % PageCount + PageCount) % PageCount];
}
function FirstPageOf(CategoryIndex) {
  return FirstPages[CategoryIndex];
}
function Hex(CodePoint) {
  return CodePoint.toString(16).toUpperCase().padStart(4, "0");
}
var LineBreakPictures = /* @__PURE__ */ new Map([
  [0, 9216],
  [10, 9226],
  [11, 9227],
  [12, 9228],
  [13, 9229],
  [133, 9252],
  [8232, 9252],
  [8233, 9252]
]);
function DisplayCharacter(CodePoint) {
  return String.fromCodePoint(LineBreakPictures.get(CodePoint) ?? CodePoint);
}
function PageText(Index) {
  const { First, Last } = Page(Index);
  const Lines = [];
  for (let Row = First; Row <= Last; Row += PageColumns) {
    const Characters2 = [];
    for (let CodePoint = Row; CodePoint <= Math.min(Row + PageColumns - 1, Last); CodePoint++) {
      Characters2.push(DisplayCharacter(CodePoint));
    }
    Lines.push(Characters2.join(" "));
  }
  return Lines.join("\n");
}
function PageHeading(Index) {
  const { Category, First, Last } = Page(Index);
  return `${Hex(First)}\u2013${Hex(Last)} \u2022 ${Categories[Category].Name}`;
}
function PageRowCount(Index) {
  const { First, Last } = Page(Index);
  return Math.ceil((Last - First + 1) / PageColumns);
}
function CodePointAt(Index, X, Y) {
  const { First, Last } = Page(Index);
  const CodePoint = First + Y * PageColumns + X;
  return X >= 0 && X < PageColumns && Y >= 0 && CodePoint <= Last ? CodePoint : void 0;
}
function RunLookup(Text2) {
  let Starts;
  let Values;
  return (CodePoint) => {
    if (!Starts) {
      Starts = [];
      Values = [];
      for (const Run of Text2.split("|")) {
        const Space = Run.indexOf(" ");
        Starts.push(parseInt(Run.slice(0, Space), 16));
        Values.push(Run.slice(Space + 1));
      }
    }
    let Low = 0;
    let High = Starts.length - 1;
    while (Low < High) {
      const Middle = Low + High + 1 >> 1;
      if (Starts[Middle] <= CodePoint) Low = Middle;
      else High = Middle - 1;
    }
    return Values[Low];
  };
}
function PairLookup(Text2) {
  let Table;
  return (CodePoint) => {
    Table ??= new Map(Text2.split("|").map((Pair) => {
      const Space = Pair.indexOf(" ");
      return [parseInt(Pair.slice(0, Space), 16), Pair.slice(Space + 1)];
    }));
    return Table.get(CodePoint);
  };
}
var GeneralCategory = RunLookup(GeneralCategoryRuns);
var BidiClass = RunLookup(BidiClassRuns);
var Script = RunLookup(ScriptRuns);
var Age = RunLookup(AgeRuns);
var ControlName = PairLookup(ControlNames);
var Uppercase = PairLookup(UppercaseMappings);
var Lowercase = PairLookup(LowercaseMappings);
var NameTable;
function IndividualName(CodePoint) {
  if (!NameTable) {
    NameTable = /* @__PURE__ */ new Map();
    const Entries = Names.split("|");
    let Index = 0;
    let Previous = "";
    for (const Run of NameRuns.split("|")) {
      const [Start, Count] = Run.split(" ").map((Value) => parseInt(Value, 16));
      for (let Offset = 0; Offset < Count; Offset++) {
        const Entry = Entries[Index++];
        Previous = Previous.slice(0, Entry.charCodeAt(0) - 35) + Entry.slice(1);
        NameTable.set(Start + Offset, Previous);
      }
    }
  }
  return NameTable.get(CodePoint);
}
var JamoInitial = ["G", "GG", "N", "D", "DD", "R", "M", "B", "BB", "S", "SS", "", "J", "JJ", "C", "K", "T", "P", "H"];
var JamoMedial = [
  "A",
  "AE",
  "YA",
  "YAE",
  "EO",
  "E",
  "YEO",
  "YE",
  "O",
  "WA",
  "WAE",
  "OE",
  "YO",
  "U",
  "WEO",
  "WE",
  "WI",
  "YU",
  "EU",
  "YI",
  "I"
];
var JamoFinal = [
  "",
  "G",
  "GG",
  "GS",
  "N",
  "NJ",
  "NH",
  "D",
  "L",
  "LG",
  "LM",
  "LB",
  "LS",
  "LT",
  "LP",
  "LH",
  "M",
  "B",
  "BS",
  "S",
  "SS",
  "NG",
  "J",
  "C",
  "K",
  "T",
  "P",
  "H"
];
function CharacterName(CodePoint) {
  if (CodePoint >= 44032 && CodePoint <= 55203) {
    const Index = CodePoint - 44032;
    return "HANGUL SYLLABLE " + JamoInitial[Math.floor(Index / 588)] + JamoMedial[Math.floor(Index % 588 / 28)] + JamoFinal[Index % 28];
  }
  const Name = IndividualName(CodePoint);
  if (Name) return Name;
  const Pattern = NamePatterns.find(([First, Last]) => CodePoint >= First && CodePoint <= Last);
  if (Pattern) return Pattern[2] + Hex(CodePoint);
  const Category = GeneralCategory(CodePoint);
  if (Category === "Cc") return `<control-${Hex(CodePoint)}>`;
  if (Category === "Co") return `<private-use-${Hex(CodePoint)}>`;
  if (Category === "Cs") return `<surrogate-${Hex(CodePoint)}>`;
  if ((CodePoint & 65534) === 65534 || CodePoint >= 64976 && CodePoint <= 65007) return `<noncharacter-${Hex(CodePoint)}>`;
  return `<reserved-${Hex(CodePoint)}>`;
}
var GeneralCategoryNames = Object.freeze({
  Cc: "Control",
  Cf: "Format",
  Cn: "Unassigned",
  Co: "Private Use",
  Cs: "Surrogate",
  Ll: "Lowercase Letter",
  Lm: "Modifier Letter",
  Lo: "Other Letter",
  Lt: "Titlecase Letter",
  Lu: "Uppercase Letter",
  Mc: "Spacing Mark",
  Me: "Enclosing Mark",
  Mn: "Nonspacing Mark",
  Nd: "Decimal Number",
  Nl: "Letter Number",
  No: "Other Number",
  Pc: "Connector Punctuation",
  Pd: "Dash Punctuation",
  Pe: "Close Punctuation",
  Pf: "Final Punctuation",
  Pi: "Initial Punctuation",
  Po: "Other Punctuation",
  Ps: "Open Punctuation",
  Sc: "Currency Symbol",
  Sk: "Modifier Symbol",
  Sm: "Math Symbol",
  So: "Other Symbol",
  Zl: "Line Separator",
  Zp: "Paragraph Separator",
  Zs: "Space Separator"
});
var BidiClassNames = Object.freeze({
  AL: "Arabic Letter",
  AN: "Arabic Number",
  B: "Paragraph Separator",
  BN: "Boundary Neutral",
  CS: "Common Separator",
  EN: "European Number",
  ES: "European Separator",
  ET: "European Terminator",
  FSI: "First Strong Isolate",
  L: "Left To Right",
  LRE: "Left To Right Embedding",
  LRI: "Left To Right Isolate",
  LRO: "Left To Right Override",
  NSM: "Nonspacing Mark",
  ON: "Other Neutral",
  PDF: "Pop Directional Format",
  PDI: "Pop Directional Isolate",
  R: "Right To Left",
  RLE: "Right To Left Embedding",
  RLI: "Right To Left Isolate",
  RLO: "Right To Left Override",
  S: "Segment Separator",
  WS: "White Space"
});
var PlaneNames = Object.freeze({
  0: "Basic Multilingual Plane",
  1: "Supplementary Multilingual Plane",
  2: "Supplementary Ideographic Plane",
  3: "Tertiary Ideographic Plane",
  14: "Supplementary Special-purpose Plane",
  15: "Supplementary Private Use Area-A",
  16: "Supplementary Private Use Area-B"
});
function CharacterLabel(CodePoint) {
  return ControlName(CodePoint) ?? CharacterName(CodePoint);
}
function BlockOf(CodePoint) {
  return Blocks.find(([First, Last]) => CodePoint >= First && CodePoint <= Last)?.[2];
}
function Mapping(Hexadecimal) {
  const CodePoint = parseInt(Hexadecimal, 16);
  return `U+${Hex(CodePoint)} ${DisplayCharacter(CodePoint)}`;
}
function DescribeCharacter(CodePoint) {
  const Shown = DisplayCharacter(CodePoint);
  const Substituted = Shown !== String.fromCodePoint(CodePoint);
  const Category = GeneralCategory(CodePoint) || "Cn";
  const Bidi = BidiClass(CodePoint);
  const Plane = CodePoint >> 16;
  const Utf8 = [];
  for (const Byte of encodeURIComponent(String.fromCodePoint(CodePoint)).match(/%[0-9A-F]{2}|[^%]/gu) ?? []) {
    Utf8.push(Byte.startsWith("%") ? Byte.slice(1) : Byte.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0"));
  }
  const Utf16 = Array.from(
    { length: CodePoint > 65535 ? 2 : 1 },
    (_, Index) => String.fromCodePoint(CodePoint).charCodeAt(Index).toString(16).toUpperCase().padStart(4, "0")
  );
  const Control = ControlName(CodePoint);
  const Lines = [
    `Character:  ${Shown}${Substituted ? "   (a picture: the character itself would break the line)" : ""}`,
    `Name: ${CharacterName(CodePoint)}${Control ? ` (${Control})` : ""}`,
    `Code point: U+${Hex(CodePoint)} (decimal ${CodePoint})`,
    `Block: ${BlockOf(CodePoint) ?? "No block"}`,
    `Plane: ${Plane} (${PlaneNames[Plane] ?? "Unassigned plane"})`,
    `General category: ${Category} (${GeneralCategoryNames[Category] ?? Category})`,
    `Script: ${Script(CodePoint) || "Unknown"}`,
    `Bidi class: ${Bidi ? `${Bidi} (${BidiClassNames[Bidi] ?? Bidi})` : "Unassigned"}`,
    `Introduced: ${Age(CodePoint) ? `Unicode ${Age(CodePoint)}` : "Not assigned"}`,
    `UTF-8: ${Utf8.join(" ")}    UTF-16: ${Utf16.join(" ")}`,
    `HTML: &#${CodePoint}; &#x${Hex(CodePoint)};`
  ];
  const Upper = Uppercase(CodePoint);
  const Lower = Lowercase(CodePoint);
  if (Upper) Lines.push(`Uppercase: ${Mapping(Upper)}`);
  if (Lower) Lines.push(`Lowercase: ${Mapping(Lower)}`);
  Lines.push(`Data: Unicode ${UnicodeVersion}`);
  return Lines.join("\n");
}

// Source/OddCharacters.js
var Character = (CodePoint) => String.fromCodePoint(CodePoint);
var Characters = (...CodePoints) => String.fromCodePoint(...CodePoints);
var FormattingCode = /§./gu;
var PoolLetters = "ABCDEGHJMNOPQRSUVWXYZFKLT";
var AlwaysUpper = "FKLT";
function LetterPool(Reserved2 = "") {
  const Taken = new Set(Reserved2.toUpperCase());
  let Count = 0;
  return (Length2) => {
    let Result = "";
    while (Result.length < Length2) {
      const Letter = [...PoolLetters].find((Candidate) => !Taken.has(Candidate));
      if (!Letter) throw new Error("Out of distinct letters.");
      Taken.add(Letter);
      Result += Count++ % 2 === 0 || AlwaysUpper.includes(Letter) ? Letter : Letter.toLowerCase();
    }
    return Result;
  };
}
function ShownLetters(Text2) {
  return [...Text2.replace(FormattingCode, "").toUpperCase()].filter((Letter) => /[A-Z]/u.test(Letter));
}
function WidthCase(CodePoint) {
  const Glyph = Character(CodePoint);
  const Take = LetterPool();
  const Pair = () => [...Take(2)];
  const [A, B] = Pair(), [C, D] = Pair(), [E, F] = Pair(), [G, H] = Pair();
  const [J, K] = Pair(), [L, M] = Pair();
  return {
    Text: [
      `|${A} ${B}|`,
      `|${C}${Glyph}${D}|`,
      `|${E}    ${F}|`,
      `|${G}${Glyph.repeat(4)}${H}|`,
      `|${Glyph}${J}${K}|`,
      `|${L}${M}${Glyph}|`,
      `${Take(2)}${Glyph}${Take(2)} ${Take(2)}${Glyph}${Take(2)}`
    ].join("\n"),
    Studied: Studied([CodePoint]),
    Title: `U+${Hex(CodePoint)} ${CharacterLabel(CodePoint)}`
  };
}
function MarkCase(CodePoint) {
  const Mark = Character(CodePoint);
  return {
    Text: [
      `|A|B${Mark}|`,
      `|c|d${Mark}|`,
      `|p|q${Mark}|`,
      `|e|o${Mark.repeat(3)}|`,
      `|${Mark}|r${Mark}s|`,
      "|UV|WX|"
    ].join("\n"),
    Studied: Studied([CodePoint]),
    Title: `U+${Hex(CodePoint)} ${CharacterLabel(CodePoint)}`
  };
}
function SampleCase(Title, Sample, Reserved2 = "", Pattern = void 0) {
  const Take = LetterPool(Reserved2 + ShownLetters(typeof Sample === "function" ? "" : [Sample].flat().join("")).join(""));
  const Lines = [typeof Sample === "function" ? Sample(Take) : Sample].flat();
  return {
    Studied: Pattern ?? Studied([...Lines.join("")].map((Glyph) => Glyph.codePointAt(0))),
    Text: [Take(6), ...Lines.map((Line) => `${Take(1)}|${Line}|${Take(1)}`), Take(6)].join("\n"),
    Title
  };
}
function Studied(CodePoints) {
  const Escaped = [...new Set(CodePoints)].filter((CodePoint) => CodePoint !== 32).map((CodePoint) => `\\u{${CodePoint.toString(16)}}`).join("");
  return new RegExp(`[${Escaped}]`, "gu");
}
var FormattingCodes2 = /§./gu;
var SectionSigns = /§/gu;
function BidiCase(Title, Lines, Controls2) {
  return { Bidi: true, Studied: Studied(Controls2), Text: Lines.join("\n"), Title };
}
var Shalom = "\u05E9\u05DC\u05D5\u05DD";
var [LeftToRightMark, RightToLeftMark] = ["\u200E", "\u200F"];
var [RightToLeftEmbedding, PopFormatting, LeftToRightOverride, RightToLeftOverride2] = ["\u202B", "\u202C", "\u202D", "\u202E"];
var [RightToLeftIsolate, FirstStrongIsolate, PopIsolate] = ["\u2067", "\u2068", "\u2069"];
var Controls = (...Texts) => Texts.map((Text2) => Text2.codePointAt(0));
var Flag = (Code) => "\u{1F3F4}" + [...Code].map((Letter) => Character(917504 + Letter.codePointAt(0))).join("") + Character(917631);
var MarksAbove = [781, 782, 772, 773, 831, 785, 774, 784, 850, 855, 849, 775];
var MarksBelow = [790, 791, 792, 793, 796, 797, 798, 799, 800, 804, 805, 806];
var Stacked = (Base) => Base + Characters(...MarksAbove.slice(0, 4), ...MarksBelow.slice(0, 4));
var Sixteenths = Array.from({ length: 16 }, (_, Index) => Character(118416 + Index));
var Quarters = Array.from({ length: 16 }, (_, Index) => Character(118432 + Index));
var OddCharacterCases = Object.freeze([
  {
    Text: [Sixteenths.slice(0, 8).join(" "), Sixteenths.slice(8).join(" ")].join("\n"),
    Studied: Studied(Sixteenths.map((Glyph) => Glyph.codePointAt(0))),
    Title: "Sixteenth blocks 1CE90-1CE9F"
  },
  {
    Text: [0, 4, 8, 12].map((Start) => Sixteenths.slice(Start, Start + 4).join("")).join("\n"),
    Studied: Studied(Sixteenths.map((Glyph) => Glyph.codePointAt(0))),
    Title: "Sixteenth blocks by grid position"
  },
  { Text: [Sixteenths.join(""), Sixteenths.join("")].join("\n"), Studied: Studied(Sixteenths.map((Glyph) => Glyph.codePointAt(0))), Title: "Sixteenth blocks run together" },
  {
    Text: [Quarters.slice(0, 8).join(" "), Quarters.slice(8).join(" ")].join("\n"),
    Studied: Studied(Quarters.map((Glyph) => Glyph.codePointAt(0))),
    Title: "Quarter blocks 1CEA0-1CEAF"
  },
  { Text: [Quarters.join(""), Quarters.join("")].join("\n"), Studied: Studied(Quarters.map((Glyph) => Glyph.codePointAt(0))), Title: "Quarter blocks run together" },
  // Spaces of other widths.
  ...[
    160,
    5760,
    8192,
    8193,
    8194,
    8195,
    8196,
    8197,
    8198,
    8199,
    8200,
    8201,
    8202,
    8239,
    8287,
    12288
  ].map(WidthCase),
  // Zero-width and invisible characters.
  ...[
    8203,
    8204,
    8205,
    8288,
    65279,
    173,
    847,
    8289,
    8290,
    6155,
    6159,
    65024,
    65039,
    6068,
    6069
  ].map(WidthCase),
  // Direction and tag characters.
  ...[
    8206,
    8207,
    1564,
    8234,
    8235,
    8236,
    8237,
    8238,
    8294,
    8295,
    8296,
    8297,
    917505,
    917536,
    917569,
    917631
  ].map(WidthCase),
  // Directional characters as they are used in practice.
  BidiCase("Right-to-left override (RLO ... PDF)", [
    `Ab ${RightToLeftOverride2}xyz${PopFormatting} Cd`,
    "want: Ab zyx Cd",
    `Ef ${RightToLeftOverride2}pqr stu${PopFormatting} Gh`,
    "want: Ef uts rqp Gh"
  ], Controls(RightToLeftOverride2, PopFormatting)),
  BidiCase("Left-to-right override on Hebrew (LRO ... PDF)", [
    Shalom,
    `${LeftToRightOverride}${Shalom}${PopFormatting}`
  ], Controls(LeftToRightOverride, PopFormatting)),
  BidiCase("Isolate around a Hebrew name (RLI, FSI ... PDI)", [
    `Ab: ${Shalom} 3 Cd`,
    `Ab: ${RightToLeftIsolate}${Shalom}${PopIsolate} 3 Cd`,
    `Ab: ${FirstStrongIsolate}${Shalom}${PopIsolate} 3 Cd`
  ], Controls(RightToLeftIsolate, FirstStrongIsolate, PopIsolate)),
  BidiCase("Embedding versus isolate (RLE ... PDF, RLI ... PDI)", [
    `Ab ${RightToLeftEmbedding}${Shalom}${PopFormatting} 3 Cd`,
    `Ab ${RightToLeftIsolate}${Shalom}${PopIsolate} 3 Cd`
  ], Controls(RightToLeftEmbedding, PopFormatting, RightToLeftIsolate, PopIsolate)),
  BidiCase("Marks beside punctuation (RLM, LRM)", [
    `Ab ${Shalom}!`,
    `Ab ${Shalom}!${RightToLeftMark}`,
    `${Shalom} C++`,
    `${Shalom} C++${LeftToRightMark}`
  ], Controls(RightToLeftMark, LeftToRightMark)),
  BidiCase("Subdivision flags (tag sequences)", [
    `England ${Flag("gbeng")}`,
    `Scotland ${Flag("gbsct")}`,
    `Wales ${Flag("gbwls")}`,
    "Black flag \u{1F3F4}"
  ], [...Array.from({ length: 26 }, (_, Index) => 917601 + Index), 917631]),
  // Fillers and controls.
  ...[
    10240,
    12644,
    65440,
    4447,
    4448,
    6158,
    9,
    8,
    27,
    127,
    128,
    159,
    65529,
    65530,
    65531,
    65532
  ].map(WidthCase),
  // Combining marks.
  ...[
    768,
    769,
    770,
    771,
    776,
    778,
    779,
    785,
    803,
    807,
    808,
    818,
    819,
    822,
    824,
    8413,
    8419
  ].map(MarkCase),
  // Glyphs that reach above or below their line.
  SampleCase("Twelve marks above", `a${Characters(...MarksAbove)}`),
  SampleCase("Twelve marks below", `a${Characters(...MarksBelow)}`),
  SampleCase("Four marks above and below", `${Stacked("a")}${Stacked("x")}`),
  SampleCase("Accented capitals", "\xC5\xC9\xCE\xD5\xDC\u01FA\u01FE\u0226\u1E1C\u1EAA\u1ED6"),
  SampleCase("Capitals with two marks", "A\u030A\u0302E\u0301\u0302"),
  SampleCase("Descenders", "gjpqy\xC7\u015E\u0162\u0192\u029D"),
  SampleCase("Tibetan stacks", "\u0F66\u0F90\u0FB1\u0F7C \u0F67\u0FA8\u0FB1\u0F71 \u0F40\u0FB5"),
  SampleCase("Thai marks", "\u0E01\u0E34\u0E48 \u0E1F\u0E38\u0E49 \u0E1B\u0E39\u0E48 \u0E01\u0E47"),
  SampleCase("Devanagari", "\u0915\u094D\u0937\u093F \u0939\u093F\u0928\u094D\u0926\u0940"),
  SampleCase("Hebrew points", "\u05E9\u05C1\u05B8\u05DC\u05D5\u05B9\u05DD"),
  SampleCase("Superscripts and subscripts", "x\xB2 \u2082 \u1D43\u1D47 \u02E2\u1D50\u02E1"),
  SampleCase("Bracket and integral pieces", [
    "\u239B\u2320\u23A1\u23A7",
    "\u239C\u23AE\u23A2\u23A8",
    "\u239D\u2321\u23A3\u23A9"
  ]),
  SampleCase("Large operators", "\u222B\u2211\u220F\u221A"),
  // Glyphs wider than their neighbors, and formatting codes.
  SampleCase("Arabic ligatures", "\uFDFD \uFDFA"),
  SampleCase("Arabic, joined right to left", "\u0633\u0644\u0627\u0645"),
  SampleCase("Three-em, two-em, em and en dashes", "\u2E3B \u2E3A \u2014 \u2013"),
  SampleCase("Wide symbols", "\uA9C1\uA9C2 \uA9C5 \uA66E \u0BF8"),
  SampleCase("CJK, Hangul and halfwidth kana", "\u6F22\u5B57 \uD55C\uAE00 \uFF76\uFF80\uFF85"),
  SampleCase("Fullwidth letters, ideographic space", "\uFF37\uFF21\u3000\uFF2D\uFF30"),
  SampleCase("Private use input icons", "\uE000\uE001\uE002\uE003 \uE100\uE101\uE102"),
  SampleCase("Outside the Basic Multilingual Plane", Characters(128512, 120143, 66376)),
  SampleCase("Replacement and emoji presentation", "\uFFFD \u263A\uFE0F \u263A"),
  SampleCase("Bold", (Take) => `\xA7l${Take(3)}\xA7r ${Take(3)}`, "LR", FormattingCodes2),
  SampleCase("Italic", (Take) => `\xA7o${Take(3)}\xA7r ${Take(3)}`, "OR", FormattingCodes2),
  SampleCase("Obfuscated", (Take) => `\xA7k${Take(3)}\xA7r ${Take(3)}`, "KR", FormattingCodes2),
  SampleCase("Stray section signs", (Take) => `${Take(1)}\xA7 ${Take(1)} ${Take(1)}\xA7\xA7${Take(1)}`, "", SectionSigns),
  SampleCase("Combined codes", (Take) => `\xA7l\xA7o${Take(2)}\xA7r\xA7k\xA7l${Take(2)}\xA7r`, "LORK", FormattingCodes2)
].map(({ Studied: Pattern, ...Case }) => Object.freeze({
  ...Case,
  // Each line without the studied characters, for the reference display beside the case.
  Reference: Case.Text.split("\n").map((Line) => Line.replace(Pattern, "")).join("\n")
})));

// Source/LegacyComputing.js
var LegacyComputingBlocks = Object.freeze([
  Object.freeze({ First: 129792, Last: 130047, Name: "Symbols for Legacy Computing" }),
  Object.freeze({ First: 117760, Last: 118463, Name: "Symbols for Legacy Computing Supplement" })
]);
var LegacyComputingBlock = LegacyComputingBlocks[0];
var LegacyComputingReserved = Object.freeze([
  129939,
  130043,
  130044,
  130045,
  130046,
  130047,
  118013,
  118014,
  118015,
  118452,
  118453,
  118454,
  118455,
  118456,
  118457
]);
var Span = (First, Last) => Array.from({ length: Last - First + 1 }, (_, Index) => First + Index);
var LegacyComputingDropped = Object.freeze([
  ...Span(117836, 117845),
  ...Span(117850, 117855),
  ...Span(117911, 117916),
  ...Span(117918, 117919),
  ...Span(117974, 118009),
  118262,
  118263
]);
var Reserved = /* @__PURE__ */ new Set([...LegacyComputingReserved, ...LegacyComputingDropped]);
var BlockOf2 = (CodePoint) => LegacyComputingBlocks.find((Block) => CodePoint >= Block.First && CodePoint <= Block.Last);
function IsLegacyComputing(CodePoint) {
  return BlockOf2(CodePoint) !== void 0 && !Reserved.has(CodePoint);
}
var GlyphBase = 57856;
var WithGlyphs = (Block) => Span(Block.First, Block.Last).filter((CodePoint) => !Reserved.has(CodePoint));
var StandIns = /* @__PURE__ */ new Map();
var NextSlot = GlyphBase;
for (const CodePoint of WithGlyphs(LegacyComputingBlocks[0])) StandIns.set(CodePoint, NextSlot++);
var ExtraSlot = NextSlot;
NextSlot += 4;
for (const CodePoint of WithGlyphs(LegacyComputingBlocks[1])) {
  StandIns.set(CodePoint, NextSlot++);
}
function LegacyGlyph(CodePoint) {
  return StandIns.get(CodePoint);
}
var LegacyStandIns = new Set(StandIns.values());
function IsLegacyGlyph(CodePoint) {
  return LegacyStandIns.has(CodePoint);
}
var LegacyExtraGlyphs = Object.freeze({
  Blank: ExtraSlot + 3,
  Full: ExtraSlot,
  LeftHalf: ExtraSlot + 1,
  RightHalf: ExtraSlot + 2
});
var Extras = new Set(Object.values(LegacyExtraGlyphs));
var OctantCompleterBase = NextSlot;
var OctantCompleterCount = 26;
var CellGlyphCount = OctantCompleterBase + OctantCompleterCount - GlyphBase;
function IsCellGlyph(CodePoint) {
  return IsLegacyGlyph(CodePoint) || Extras.has(CodePoint);
}
var LegacyWideOffset = CellGlyphCount;
function LegacyWideGlyph(StandIn) {
  return StandIn + LegacyWideOffset;
}
var CellGlyphEnd = GlyphBase + 2 * CellGlyphCount;
function ToLegacyGlyphs(Text2) {
  let Result = "";
  for (const Character2 of String(Text2)) {
    const CodePoint = Character2.codePointAt(0);
    Result += IsLegacyComputing(CodePoint) ? String.fromCodePoint(LegacyGlyph(CodePoint)) : Character2;
  }
  return Result;
}

// Source/CustomGlyph.js
var CustomGlyphAdvance = 8;
function IsCustomGlyph(CodePoint) {
  return IsCellGlyph(CodePoint);
}

// Source/MinecraftTenWidths.js
var MinecraftTenAdvances = "359;9;;59988575;979999999955989:>998999995998<:99:99999<9997;77<5000000000000000000000000008588";

// Source/MinecraftTen.js
var MinecraftTenBase = CellGlyphEnd;
var BeforeLowercase = 97 - 32;
var MinecraftTenCount = 127 - 32 - 26;
function IsTenCharacter(CodePoint) {
  return CodePoint >= 32 && CodePoint <= 126 && !(CodePoint >= 97 && CodePoint <= 122);
}
function MinecraftTenGlyph(CodePoint) {
  return MinecraftTenBase + (CodePoint < 97 ? CodePoint - 32 : CodePoint - 123 + BeforeLowercase);
}
function MinecraftTenCharacter(StandIn) {
  const Index = StandIn - MinecraftTenBase;
  if (Index < 0 || Index >= MinecraftTenCount) return void 0;
  return Index < BeforeLowercase ? Index + 32 : Index - BeforeLowercase + 123;
}
function ToMinecraftTen(Text2) {
  return [...String(Text2)].map((Character2) => {
    const CodePoint = Character2.codePointAt(0);
    return IsTenCharacter(CodePoint) ? String.fromCodePoint(MinecraftTenGlyph(CodePoint)) : Character2;
  }).join("");
}
function MinecraftTenWidth(Line) {
  let Width = 0;
  for (const Character2 of String(Line)) {
    const Code = MinecraftTenCharacter(Character2.codePointAt(0));
    if (Code === void 0) throw new Error(`${JSON.stringify(Character2)} is not a Minecraft Ten stand-in.`);
    Width += MinecraftTenAdvances.charCodeAt(Code - 32) - 48;
  }
  return Width;
}

// Source/Octant.js
var OctantBase = MinecraftTenBase + MinecraftTenCount;
var OctantColors = Object.freeze([
  Object.freeze({ Code: "\xA7r", Rgb: Object.freeze([77, 77, 77]) })
]);
var BrailleDotBase = OctantBase + 256 * OctantColors.length;
var GlyphEnd = BrailleDotBase + 256;
var DotBlocks = Object.freeze([0, 2, 4, 1, 3, 5, 6, 7]);
function BrailleOctant(CodePoint) {
  if (CodePoint < 10240 || CodePoint > 10495) return void 0;
  const Dots = CodePoint - 10240;
  let Pattern = 0;
  DotBlocks.forEach((Block, Dot) => {
    if (Dots & 1 << Dot) Pattern |= 1 << Block;
  });
  return Pattern;
}
function OctantGlyph(Pattern, Code) {
  const Page2 = Math.max(0, OctantColors.findIndex((Color) => Color.Code === Code));
  return OctantBase + (Page2 << 8) + Pattern;
}

// Source/GlyphOverlay.js
var ButtonFace = Object.freeze({ red: 60 / 255, green: 133 / 255, blue: 39 / 255, alpha: 1 });
var OverlayColors = Object.freeze({
  Background: Object.freeze({ red: 197 / 255, green: 197 / 255, blue: 197 / 255, alpha: 1 }),
  Hidden: "\xA77",
  Ink: "\xA7r",
  InkColor: Object.freeze({ red: 77 / 255, green: 77 / 255, blue: 77 / 255, alpha: 1 })
});
var SmallFont = `${OverlayColors.Hidden}\u2800`;
var ColorCode = /^§[0-9a-fr]$/u;
var PadCandidates = Object.freeze(["", "\xB7", "\u2219", "l", "\u2219\u2219", "l\u2219", "ll", "\xB7l"]);
function EvenPad(Line) {
  const Pad = PadCandidates.find((Candidate) => LineWidth(Line + Candidate) % 2 === 0);
  if (Pad === void 0) {
    throw new Error(`No pad makes ${JSON.stringify(Line)} an even width.`);
  }
  return Pad;
}
function SplitOverlay(Text2, { Seamless = false } = {}) {
  if (CustomGlyphAdvance !== 8) {
    throw new Error("A custom glyph must be two spaces wide to take a space's place.");
  }
  const Front = [];
  const Back = [];
  const Middle = [];
  for (const Original of ToLegacyGlyphs(Text2).split("\n")) {
    const Spaced = [...Original].map((Character2) => IsCustomGlyph(Character2.codePointAt(0)) ? " " : Character2).join("");
    const Source = UsesLargeFont(Spaced) ? SmallFont + Original : Original;
    const Characters2 = [...Source];
    const Visible2 = [];
    let FrontLine = "";
    for (let Index = 0; Index < Characters2.length; Index++) {
      const Character2 = Characters2[Index];
      if (Character2 === "\xA7") {
        const Code = Character2 + (Characters2[Index + 1] ?? "");
        if (!ColorCode.test(Code)) {
          throw new Error(`An overlay cannot hold the formatting code ${JSON.stringify(Code)}.`);
        }
        FrontLine += Code;
        Index++;
        continue;
      }
      FrontLine += IsCustomGlyph(Character2.codePointAt(0)) ? " " : Character2;
      Visible2.push({ Character: Character2 });
    }
    const Pad = EvenPad(FrontLine);
    Front.push(Pad ? `${FrontLine}${OverlayColors.Hidden}${Pad}` : FrontLine);
    const Items = [...Visible2, ...[...Pad].map((Character2) => ({ Character: Character2 }))];
    Back.push(LayerLine(Items, Seamless ? 0 : void 0));
    if (Seamless) Middle.push(LayerLine(Items, 1));
  }
  return {
    Back: Back.join("\n"),
    Front: Front.join("\n"),
    ...Seamless ? { Middle: Middle.join("\n") } : {}
  };
}
var BlankCell = String.fromCodePoint(LegacyExtraGlyphs.Blank);
function LayerLine(Items, Parity) {
  let Line = "";
  let Color = "";
  const Emit = (Text2, Wanted) => {
    if (Wanted && Color !== Wanted) {
      Line += Wanted;
      Color = Wanted;
    }
    Line += Text2;
  };
  let Run = 0;
  let Spanned = false;
  for (let Index = 0; Index < Items.length; Index++) {
    const { Character: Character2 } = Items[Index];
    const CodePoint = Character2.codePointAt(0);
    if (!IsCustomGlyph(CodePoint)) {
      Run = 0;
      Spanned = false;
      Emit(Character2 + Character2, Character2 === " " ? "" : OverlayColors.Hidden);
      continue;
    }
    const Cell = IsCellGlyph(CodePoint);
    if (Parity === void 0) {
      Emit(String.fromCodePoint(CodePoint), "\xA7f");
      continue;
    }
    const Owned = Run % 2 === Parity;
    Run++;
    if (Spanned) {
      Spanned = false;
      continue;
    }
    if (!Owned) {
      Emit(BlankCell);
      continue;
    }
    const Next = Items[Index + 1];
    Spanned = Cell && Next !== void 0 && IsCustomGlyph(Next.Character.codePointAt(0));
    Emit(String.fromCodePoint(Spanned ? LegacyWideGlyph(CodePoint) : CodePoint), "\xA7f");
  }
  return Line;
}
var Blank = Object.freeze({ Narrow: LegacyExtraGlyphs.Blank, Wide: LegacyWideGlyph(LegacyExtraGlyphs.Blank) });
function CellLayer(Cells, Parity) {
  let Line = "";
  for (let Index = 0; Index < Cells.length; Index++) {
    const { Narrow, Wide } = Cells[Index];
    if (Parity === void 0) {
      Line += String.fromCodePoint(Narrow);
      continue;
    }
    if (Index % 2 !== Parity) {
      if (Index === 0) Line += String.fromCodePoint(Blank.Narrow);
      continue;
    }
    Line += String.fromCodePoint(Index + 1 < Cells.length ? Wide : Narrow);
  }
  return Line;
}
function GlyphOnly(Text2, { Seamless = true } = {}) {
  const A = [];
  const B = [];
  const Rows = [];
  let Widest = 0;
  for (const Original of ToLegacyGlyphs(Text2).split("\n")) {
    const Characters2 = [...Original];
    const Cells = [];
    let Color = OverlayColors.Ink;
    for (let Index = 0; Index < Characters2.length; Index++) {
      const Character2 = Characters2[Index];
      if (Character2 === "\xA7") {
        Color = Character2 + (Characters2[Index + 1] ?? "");
        if (!ColorCode.test(Color)) throw new Error(`Glyph-only text cannot hold the formatting code ${JSON.stringify(Color)}.`);
        Index++;
        continue;
      }
      const CodePoint = Character2.codePointAt(0);
      const Pattern = BrailleOctant(CodePoint);
      if (Character2 === " " || Pattern === 0) Cells.push(Blank);
      else if (Pattern !== void 0) Cells.push({ Wide: OctantGlyph(Pattern, Color) });
      else if (IsCellGlyph(CodePoint)) {
        Cells.push({ Narrow: CodePoint, Wide: LegacyWideGlyph(CodePoint) });
      } else throw new Error(`${JSON.stringify(Character2)} is not a cell glyph.`);
    }
    if (Cells.length === 0 || Cells.at(-1).Narrow === void 0) Cells.push(Blank);
    if (!Seamless && Cells.some(({ Narrow }) => Narrow === void 0)) {
      throw new Error("Octants exist only as wide glyphs, which only seamless layers use.");
    }
    Widest = Math.max(Widest, Cells.length);
    Rows.push(Cells);
  }
  for (const Cells of Rows) {
    while (Cells.length < Widest) Cells.push(Blank);
    A.push(CellLayer(Cells, Seamless ? 0 : void 0));
    if (Seamless) B.push(CellLayer(Cells, 1));
  }
  return { A: A.join("\n"), Cells: Widest, ...Seamless ? { B: B.join("\n") } : {} };
}
function SextantArt(Columns, Rows, Inside) {
  const Lines = [];
  for (let Row = 0; Row < Rows; Row++) {
    let Line = "";
    for (let Column = 0; Column < Columns; Column++) {
      let Value = 0;
      for (let Sub = 0; Sub < 6; Sub++) {
        const X = Column * 8 + (Sub % 2 === 0 ? 2 : 6);
        const Y = Row * 16 + [2.5, 8, 13.5][Sub >> 1];
        if (Inside(X, Y)) Value |= 1 << Sub;
      }
      const Extra = {
        0: LegacyExtraGlyphs.Blank,
        21: LegacyExtraGlyphs.LeftHalf,
        42: LegacyExtraGlyphs.RightHalf,
        63: LegacyExtraGlyphs.Full
      }[Value];
      Line += String.fromCodePoint(Extra ?? 129792 + Value - 1 - (Value > 21 ? 1 : 0) - (Value > 42 ? 1 : 0));
    }
    Lines.push(Line);
  }
  return Lines.join("\n");
}
function LegacyComputingChart(First, Last) {
  const Rows = [];
  for (let Row = First; Row <= Last; Row += 16) {
    const Color = (Row - First) % 32 === 0 ? OverlayColors.Ink : "\xA7b";
    let Line = `${SmallFont}${Color}${Row.toString(16).toUpperCase().slice(0, 4)}_ `;
    for (let CodePoint = Row; CodePoint < Row + 16; CodePoint++) {
      Line += IsLegacyComputing(CodePoint) ? String.fromCodePoint(CodePoint) : " ";
    }
    Rows.push(Line);
  }
  return Rows.join("\n");
}
var GlyphOnlyLineGap = 6;
var GlyphOnlySample = [
  SextantArt(20, 6, (X, Y) => {
    const Distance = Math.hypot(X - 80, (Y - 48) * 0.75);
    return Distance < 14 || Distance > 22 && Distance < 32 || Distance > 40 && Distance < 50;
  }),
  String.fromCodePoint(13e4, 130001, 130002, 130003).repeat(5),
  String.fromCodePoint(129941).repeat(20)
].join("\n");
var OverlayTests = Object.freeze([
  (() => {
    const Lines = [
      "ABCDEFGHIJKLM",
      "NOPQRSTUVWXYZ",
      "0123456789",
      `!"#$%&'()*+,-./`,
      ":;<=>?@[\\]^_`{|}~",
      "MINECRAFT TEN"
    ].map(ToMinecraftTen);
    return {
      Background: ButtonFace,
      HalfScale: true,
      LineGap: 4,
      Measure: { Lines: Lines.length, Width: Math.max(...Lines.map(MinecraftTenWidth)) },
      Overlaid: true,
      Text: Lines.join("\n"),
      Title: "Minecraft Ten, pixel for pixel (69)"
    };
  })(),
  ...[
    [129792, 130047, "Symbols for Legacy Computing", true],
    [129792, 130047, "Symbols for Legacy Computing, two layers", false],
    [117760, 118015, "Legacy Computing Supplement, 1", true],
    [118016, 118271, "Legacy Computing Supplement, 2", true],
    [118272, 118463, "Legacy Computing Supplement, 3", true]
  ].map(([First, Last, Name, Seamless]) => {
    const { Back, Front, Middle } = SplitOverlay(LegacyComputingChart(First, Last), { Seamless });
    let Count = 0;
    for (let CodePoint = First; CodePoint <= Last; CodePoint++) Count += IsLegacyComputing(CodePoint) ? 1 : 0;
    return {
      Back,
      Middle,
      Text: Front,
      // The range goes on the title, above the chart, rather than on the chart's own first line.
      Title: `${Name} (${Count})
U+${First.toString(16).toUpperCase()}\u2013${Last.toString(16).toUpperCase()}`
    };
  }),
  ...[true, false].map((Seamless) => {
    const { A, B, Cells } = GlyphOnly(GlyphOnlySample, { Seamless });
    return {
      Background: OverlayColors.Background,
      GlyphOnly: true,
      HalfScale: true,
      LineGap: GlyphOnlyLineGap,
      Measure: { Lines: GlyphOnlySample.split("\n").length, Width: Cells * CustomGlyphAdvance },
      Middle: B,
      Pitch: 10,
      Text: A,
      Title: Seamless ? "Glyphs only, seamless (two layers)" : "Glyphs only, one layer"
    };
  })
].map((Test) => Object.freeze(Test)));

// Source/PixelOffsets.js
var BrailleBlank = "\u2800";
var Plain = (Count) => " ".repeat(Count);
var Bold = (Count) => Count > 0 ? `\xA7l${Plain(Count)}\xA7r` : "";
var Divides = "\u2223";
function FontSwitchTest() {
  const Bars = "||||||||";
  const Middle = (Character2) => `[${Bars.slice(0, 4)}${Character2}${Bars.slice(5)}]`;
  const Ends = (Character2) => `${Character2}[${Bars}]${Character2}`;
  return [
    `[${Bars}] control`,
    `${Middle("\u2223")} mid U+2223`,
    `${Middle("\u2502")} mid U+2502`,
    `${Middle("\u258F")} mid U+258F`,
    `${Middle("\u01C0")} mid U+01C0`,
    `${Ends("\xA70\u2223\xA7r")} ends black U+2223`,
    `${Ends("\u2065")} ends U+2065`,
    `${Ends("\u2069")} ends U+2069`,
    `${Ends("\u200B")} ends U+200B`,
    `${Ends("\u2060")} ends U+2060`,
    `${Ends("\uFEFF")} ends U+FEFF`
  ].join("\n");
}
function OffsetTest(Ruler2, Steps, Line, Tick = "|") {
  const RulerLine = `[${Tick.repeat(Ruler2)}]`;
  return [RulerLine, ...Array.from({ length: Steps + 1 }, (_, Step) => Line(Step)), RulerLine].join("\n");
}
var PixelOffsetTests = Object.freeze([
  {
    Text: OffsetTest(28, 6, (Step) => `[${Bold(Step)}${Plain(6 - Step)}|${Plain(Step)}${Bold(6 - Step)}]`),
    Title: "Bold spaces: the bar should move right 1 px per line"
  },
  {
    Text: OffsetTest(31, 8, (Step) => `[${BrailleBlank.repeat(Step)}${Plain(8 - Step)}|${Plain(Step)}${BrailleBlank.repeat(8 - Step)}]`, Divides),
    Title: "Braille blanks: the bar should move left 1/2 px per line"
  },
  {
    Text: FontSwitchTest(),
    Title: "Font switch: which lines use the smaller font?"
  }
].map((Test) => Object.freeze(Test)));

// Source/RegionGlyphs.js
var RegionOctants = Object.freeze([58743, 58744, 58745, 58746, 58303, 58747, 58304, 58305, 58306, 58307, 58748, 58308, 58309, 58310, 58311, 58749, 58312, 58313, 58314, 58315, 58750, 58316, 58317, 58318, 58319, 58320, 58321, 58322, 58323, 58324, 58325, 58326, 58327, 58328, 58329, 58330, 58331, 58332, 58333, 58334, 58751, 58335, 58336, 58337, 58338, 58339, 58340, 58341, 58342, 58343, 58344, 58345, 58346, 58347, 58348, 58349, 58350, 58351, 58352, 58353, 58354, 58355, 58356, 58752, 58753, 58357, 58358, 58359, 58360, 58361, 58362, 58363, 58364, 58365, 58366, 58367, 58368, 58369, 58370, 58371, 58754, 58372, 58373, 58374, 58375, 58755, 58376, 58377, 58378, 58379, 58756, 58380, 58381, 58382, 58383, 58757, 58384, 58385, 58386, 58387, 58388, 58389, 58390, 58391, 58392, 58393, 58394, 58395, 58396, 58397, 58398, 58399, 58400, 58401, 58402, 58403, 58404, 58405, 58406, 58407, 58408, 58409, 58410, 58411, 58412, 58413, 58414, 58415, 58758, 58416, 58417, 58418, 58419, 58420, 58421, 58422, 58423, 58424, 58425, 58426, 58427, 58428, 58429, 58430, 58431, 58432, 58433, 58434, 58435, 58436, 58437, 58438, 58439, 58440, 58441, 58442, 58443, 58444, 58445, 58446, 58759, 58447, 58448, 58449, 58450, 58760, 58451, 58452, 58453, 58454, 58761, 58455, 58456, 58457, 58458, 58762, 58459, 58460, 58461, 58462, 58463, 58464, 58465, 58466, 58467, 58468, 58469, 58470, 58471, 58472, 58473, 58474, 58763, 58475, 58476, 58477, 58478, 58479, 58480, 58481, 58482, 58483, 58484, 58485, 58486, 58487, 58488, 58489, 58490, 58491, 58492, 58493, 58494, 58495, 58496, 58497, 58498, 58499, 58500, 58501, 58502, 58503, 58504, 58505, 58506, 58507, 58508, 58509, 58510, 58511, 58512, 58513, 58514, 58515, 58516, 58517, 58518, 58519, 58520, 58521, 58764, 58522, 58523, 58524, 58525, 58765, 58526, 58527, 58528, 58529, 58766, 58530, 58767, 58531, 58532, 58768]);

// Source/RegionLayer.js
var RegionFamilies = Object.freeze({
  Octant: 4,
  Sextant: 3,
  Quadrant: 2,
  SeparatedSextant: 3,
  SeparatedQuadrant: 2,
  Braille: 4
});
function Blanks(Count) {
  return String.fromCodePoint(LegacyWideGlyph(LegacyExtraGlyphs.Blank)).repeat(Math.floor(Count / 2)) + (Count % 2 ? String.fromCodePoint(LegacyExtraGlyphs.Blank) : "");
}
function PatternGlyph(Family, Pattern) {
  if (Family === "Octant") return RegionOctants[Pattern];
  if (Family === "Braille") return BrailleDotBase + Pattern;
  if (Pattern === 0) return LegacyExtraGlyphs.Blank;
  if (Family === "SeparatedQuadrant") return LegacyGlyph(117792 + Pattern);
  if (Family === "SeparatedSextant") return LegacyGlyph(118352 + Pattern);
  if (Family === "Quadrant") {
    return RegionOctants[(Pattern & 3) * 5 | (Pattern >> 2) * 80];
  }
  const Extra = { 21: LegacyExtraGlyphs.LeftHalf, 42: LegacyExtraGlyphs.RightHalf, 63: LegacyExtraGlyphs.Full }[Pattern];
  return Extra ?? LegacyGlyph(129792 + Pattern - 1 - (Pattern > 21 ? 1 : 0) - (Pattern > 42 ? 1 : 0));
}
function RegionText(Host, Box, K, Family, Inside, Options = {}) {
  const Positive = (Value) => Number.isSafeInteger(Value) && Value > 0;
  if (!Host || !Box || !Positive(Host.Cells) || !Positive(Host.Lines) || !Number.isFinite(Host.Scale) || Host.Scale <= 0 || !Positive(K) || !Positive(Box.Columns) || !Positive(Box.Rows) || !Number.isSafeInteger(Box.Column) || Box.Column < 0 || !Number.isSafeInteger(Box.Row) || Box.Row < 0 || Box.Column + Box.Columns > Host.Cells || Box.Row + Box.Rows > Host.Lines || !Number.isSafeInteger(K * Host.Cells) || !Number.isSafeInteger(K * Host.Lines))
    throw new Error("Region needs a positive integer K and a cell box inside a positive host grid and scale.");
  if (!Object.hasOwn(RegionFamilies, Family)) throw new Error(`Unknown region glyph family ${Family}.`);
  if (Options.WorldOffset && (!Number.isFinite(Options.PixelSize) || Options.PixelSize <= 0))
    throw new Error("WorldOffset needs a positive PixelSize (uncalibrated blocks per pixel).");
  const SubRows = RegionFamilies[Family];
  const Width = K * Box.Columns;
  const Height = K * Box.Rows;
  const Delta = K * (2 * Box.Column + Box.Columns - Host.Cells);
  const Padding = Options.WorldOffset ? 0 : Math.abs(Delta);
  const Bytes = (Factor) => 3 * (Factor * Box.Columns + Math.ceil((Options.WorldOffset ? 0 : Factor * Math.abs(2 * Box.Column + Box.Columns - Host.Cells)) / 2));
  if (Bytes(K) > LineByteLimit) {
    const MaxK = Math.floor(Math.floor(LineByteLimit / 3) / (Box.Columns + (Options.WorldOffset ? 0 : Math.abs(2 * Box.Column + Box.Columns - Host.Cells) / 2)));
    throw new Error(`Region needs ${Bytes(K)} bytes per line; limit ${LineByteLimit}. Use K <= ${MaxK}, or shrink/recentre the box so K*Columns + ceil(padding/2) <= ${Math.floor(LineByteLimit / 3)}.`);
  }
  if (typeof Inside !== "function" && (!Array.isArray(Inside) || Inside.length !== Height * SubRows || Inside.some((Row) => !Array.isArray(Row) || Row.length !== Width * 2)))
    throw new Error(`Region bitmap must be ${Width * 2} \xD7 ${Height * SubRows} sub-pixels.`);
  const Sample = typeof Inside === "function" ? Inside : (X, Y) => Inside[Math.floor(Y)][Math.floor(X)];
  const Left = Blanks(Delta > 0 && !Options.WorldOffset ? Padding : 0);
  const Right = Blanks(Delta < 0 && !Options.WorldOffset ? Padding : 0);
  const Lines = Array(K * Host.Lines).fill(String.fromCodePoint(LegacyExtraGlyphs.Blank));
  for (let Y = 0; Y < Height; Y++) {
    let Line = Left;
    for (let X = 0; X < Width; X++) {
      let Pattern = 0;
      for (let Bit = 0; Bit < SubRows * 2; Bit++)
        if (Sample(X * 2 + (Bit & 1) + 0.5, Y * SubRows + (Bit >> 1) + 0.5)) Pattern |= 1 << Bit;
      Line += String.fromCodePoint(PatternGlyph(Family, Pattern));
    }
    Lines[K * Box.Row + Y] = Line + Right;
  }
  return {
    Text: Lines.join("\n"),
    Scale: Host.Scale / K,
    Lines: Lines.length,
    LocationOffset: { x: Options.WorldOffset ? Delta * 4 * Host.Scale / K * Options.PixelSize : 0, y: 0 }
  };
}
function RegionDemo() {
  const Host = GlyphOnly(Array(5).fill(" ".repeat(12)).join("\n"));
  return {
    Background: void 0,
    GlyphOnly: true,
    HalfScale: true,
    LineGap: GlyphOnlyLineGap,
    Measure: { Lines: 5, Width: 96 },
    Middle: Host.B,
    Pitch: 10,
    Text: Host.A,
    Title: "Octant circle and ring: k = 1, 2, 4",
    Regions: [1, 2, 4].map((K, Index) => ({
      Box: { Column: Index * 4, Row: 1, Columns: 4, Rows: 3 },
      K,
      Family: "Octant",
      Inside: (X, Y) => {
        const Radius = Math.hypot((X / K - 4) * 4, (Y / K - 6) * 4);
        return Radius <= 8 || Radius >= 12 && Radius <= 15;
      }
    }))
  };
}

// Source/GlyphProbe.js
import { HudElement, HudVisibility, TextPrimitive, system, world } from "@minecraft/server";

// Source/GlyphProbePlan.js
var Copies = 8;
var Trigger = "\u01C0";
var Ruler = Object.freeze({ Character: "\u2589", Ink: 14, Long: 8, Short: 2 });
var MarkerColors = Object.freeze(["\xA7c", "\xA79"]);
var HeaderLines = 3;
var Excluded = /* @__PURE__ */ new Set([...Array(32).keys(), 127, 133, 167, 8232, 8233]);
function ProbeCharacters(First = 0, Last = 65535) {
  const Characters2 = [];
  for (const Page2 of UnicodeFontPages) {
    for (let CodePoint = Page2 << 8; CodePoint < Page2 + 1 << 8; CodePoint++) {
      if (CodePoint >= First && CodePoint <= Last && !Excluded.has(CodePoint)) Characters2.push(CodePoint);
    }
  }
  return Characters2;
}
function BatchCount(Total, Columns, Lines) {
  return Math.ceil(Total / (Columns * Lines));
}
function BatchColumns(Characters2, Batch, Columns, Lines) {
  const Start = Batch * Columns * Lines;
  return Array.from({ length: Columns }, (_, Column) => Characters2.slice(Start + Column * Lines, Math.min(Start + (Column + 1) * Lines, Characters2.length)));
}
function ColumnText(CodePoints, Color) {
  return [
    Color + Ruler.Character.repeat(Ruler.Short),
    Color + Ruler.Character.repeat(Ruler.Long),
    `${Color}[${Trigger}]`,
    ...CodePoints.map((CodePoint) => `${Color}[${Trigger}\xA7f${String.fromCodePoint(CodePoint).repeat(Copies)}${Color}]`)
  ].join("\n");
}

// Source/Keys.js
var ScriptEvent = Object.freeze({
  GlyphProbe: "ddui_demo:glyph_probe"
});
var CustomDimension = Object.freeze({
  Flat: "ddui_demo:flat"
});
var TickingArea = Object.freeze({
  FlatSpawn: "ddui_demo:flat_spawn"
});
var Command = Object.freeze({
  Flat: "ddui_demo:flat",
  Gallery: "ddui_demo:gallery"
});

// Source/GlyphProbe.js
var CameraLocation = Object.freeze({ x: 60.5, y: -20, z: 0.5 });
var WaitingLocation = Object.freeze({ x: 60.5, y: -60, z: 0.5 });
var PixelSize = 0.025;
var LineGap = -2;
var ColumnSpacing = 85 * PixelSize;
var ScreenFill = 0.7;
var ScreenCenter = 0.41;
var SettleTicks = 6;
var RepeatTicks = 200;
var Black = Object.freeze({ red: 0, green: 0, blue: 0, alpha: 1 });
var White = Object.freeze({ red: 1, green: 1, blue: 1, alpha: 1 });
var Session;
function Duration(Milliseconds) {
  const Seconds = Math.max(0, Math.round(Milliseconds / 1e3));
  return Seconds >= 60 ? `${Math.floor(Seconds / 60)} min ${Seconds % 60} s` : `${Seconds} s`;
}
function ShowProgress(State) {
  if (!State.Player.isValid) return;
  const Done = State.Batch;
  const Percent = Math.floor(Done * 100 / State.Batches);
  const Left = Done > 0 ? `~${Duration((Date.now() - State.Started) / Done * (State.Batches - Done))} left` : "estimating time left";
  State.Player.onScreenDisplay.setActionBar(
    `\xA7fGlyph widths: batch ${Math.min(Done + 1, State.Batches)} of ${State.Batches} \xA77(${Percent}%) \xA7f${Left}`
  );
}
function EndSession(Outcome, Restore) {
  const State = Session;
  if (!State) return;
  Session = void 0;
  system.clearRun(State.ProgressTimer);
  for (const Display of State.Displays) {
    try {
      Display.remove();
    } catch {
    }
  }
  if (State.Player.isValid) {
    try {
      State.Player.camera.clear();
      State.Player.onScreenDisplay.setHudVisibility(HudVisibility.Reset);
      State.Player.onScreenDisplay.setActionBar(Outcome === "DONE" ? "\xA7aGlyph widths measured" : "\xA7eGlyph width measurement stopped");
      Restore?.(State.Player);
    } catch {
    }
  }
  console.warn(`GLYPH_PROBE_${Outcome} ${State.Batch}/${State.Batches}`);
}
function ShowBatch(State) {
  const Color = MarkerColors[State.Batch % 2];
  const Columns = BatchColumns(State.Characters, State.Batch, State.Options.Columns, State.Options.Lines);
  State.Displays.forEach((Display, Index) => Display.setText(ColumnText(Columns[Index], Color)));
  const Batch = State.Batch;
  system.runTimeout(() => {
    if (Session !== State || State.Batch !== Batch) return;
    State.Displays.forEach((Display) => Display.setText(Display.text));
  }, 2);
  const Announce = () => {
    if (Session !== State || State.Batch !== Batch) return;
    console.warn(`GLYPH_PROBE_SHOT ${JSON.stringify({
      Batch,
      Batches: State.Batches,
      Color: Batch % 2,
      Counts: Columns.map((Column) => Column.length),
      First: Columns[0][0] ?? -1
    })}`);
    system.runTimeout(Announce, RepeatTicks);
  };
  system.runTimeout(Announce, SettleTicks);
  ShowProgress(State);
}
function StartSession(Options, IsBusy, Restore) {
  if (Session?.Waiting) {
    system.clearRun(Session.Pending);
    Session = void 0;
  } else if (Session) EndSession("REPLACED");
  const Player2 = world.getAllPlayers()[0];
  if (!Player2 || IsBusy()) {
    console.warn(`GLYPH_PROBE_WAITING ${Player2 ? "busy" : "no player"}`);
    Session = { Pending: system.runTimeout(() => {
      Session = void 0;
      StartSession(Options, IsBusy, Restore);
    }, 40), Waiting: true };
    return;
  }
  const Characters2 = ProbeCharacters(Options.First, Options.Last);
  const Batches = BatchCount(Characters2.length, Options.Columns, Options.Lines);
  const Height = (Options.Lines + HeaderLines) * (12 + LineGap) * PixelSize;
  const Tangent = Math.tan(Options.Fov * Math.PI / 360);
  const Distance = Height / (ScreenFill * 2 * Tangent);
  const Lift = (0.5 - ScreenCenter) * 2 * Distance * Tangent;
  const Overworld = world.getDimension("overworld");
  Player2.teleport(WaitingLocation, { dimension: Overworld });
  Player2.camera.setCamera("minecraft:free", { location: CameraLocation, rotation: { x: 0, y: -90 } });
  Player2.onScreenDisplay.setHudVisibility(
    HudVisibility.Hide,
    Object.values(HudElement).filter((Value) => typeof Value === "number")
  );
  const Displays = Array.from({ length: Options.Columns }, (_, Column) => {
    const Display = new TextPrimitive({
      dimension: Overworld,
      x: CameraLocation.x + Distance,
      y: CameraLocation.y + Lift,
      z: CameraLocation.z + (Column - (Options.Columns - 1) / 2) * ColumnSpacing
    }, " ");
    Display.useRotation = true;
    Display.rotation = { x: 0, y: 90, z: 0 };
    Display.depthTest = false;
    Display.scale = 1;
    Display.color = White;
    Display.textBackfaceVisible = false;
    Display.backfaceVisible = false;
    Display.lineGapHeight = LineGap;
    Display.backgroundColorOverride = Black;
    world.primitiveShapesManager.addText(Display, Overworld);
    return Display;
  });
  const State = { Batch: 0, Batches, Characters: Characters2, Displays, Options, Player: Player2, Started: Date.now() };
  State.ProgressTimer = system.runInterval(() => {
    if (!State.Player.isValid) EndSession("STOPPED");
    else ShowProgress(State);
  }, 20);
  Session = State;
  console.warn(`GLYPH_PROBE_STARTED ${JSON.stringify({ ...Options, Batches, Characters: Characters2.length, Distance })}`);
  ShowBatch(State);
}
function RegisterGlyphProbe(IsBusy, Restore) {
  system.afterEvents.scriptEventReceive.subscribe(({ id, message }) => {
    if (id !== ScriptEvent.GlyphProbe) return;
    const [Command2, ...Rest] = message.trim().split(" ");
    const Argument = Rest.join(" ");
    if (Command2 === "start") {
      const Given = Argument ? JSON.parse(Argument) : {};
      StartSession({ Columns: 6, Fov: 40, First: 0, Last: 65535, Lines: 23, ...Given }, IsBusy, Restore);
    } else if (Command2 === "next") {
      const State = Session;
      if (!State || State.Waiting || Number(Argument) !== State.Batch) return;
      State.Batch++;
      if (State.Batch >= State.Batches) EndSession("DONE", Restore);
      else ShowBatch(State);
    } else if (Command2 === "stop") {
      if (Session?.Waiting) {
        system.clearRun(Session.Pending);
        Session = void 0;
        console.warn("GLYPH_PROBE_STOPPED waiting");
      } else EndSession("STOPPED", Restore);
    }
  });
}

// Source/TextureTest.js
import { BlockTypes, TextPrimitive as TextPrimitive2, world as world2 } from "@minecraft/server";
var TextureTests = Object.freeze(["menu_button", "play_button", "servers_icon", "stone"]);
var CubeEntity = "ddui_demo:ui_texture_cube";
var Label;
function PlaceTextureTest(Dimension, Page2, GroundTop) {
  for (const Entity of Dimension.getEntities({ type: CubeEntity })) Entity.remove();
  Label?.remove();
  const X = Math.floor(Page2.x) - 6;
  const Z = Math.floor(Page2.z);
  TextureTests.forEach((Name, Index) => {
    const BlockZ = Z + 3 - 2 * Index;
    const Type = `ddui_demo:ui_texture_${Name}`;
    if (!BlockTypes.get(Type)) console.error(`UI_TEXTURE_TEST block type ${Type} is not registered`);
    try {
      Dimension.getBlock({ x: X, y: GroundTop, z: BlockZ })?.setType(Type);
    } catch (Error3) {
      console.error(`UI_TEXTURE_TEST block ${Type}: ${Error3?.name} ${Error3?.message} ${String(Error3)}`);
    }
    try {
      Dimension.spawnEntity(
        CubeEntity,
        { x: X + 0.5, y: GroundTop + 2, z: BlockZ + 0.5 },
        { spawnEvent: `ddui_demo:variant_${Index}` }
      );
    } catch (Error3) {
      console.error(`UI_TEXTURE_TEST entity ${Index}: ${Error3?.name} ${Error3?.message} ${String(Error3)}`);
    }
  });
  Label = new TextPrimitive2(
    { dimension: Dimension, x: X + 0.5, y: GroundTop + 4.4, z: Z + 0.5 },
    "UI textures on cuboids: entities above, blocks below\nmenu button | play button | servers icon | stone"
  );
  Label.useRotation = true;
  Label.rotation = { x: 0, y: -90, z: 0 };
  Label.scale = 0.7875;
  Label.depthTest = false;
  Label.textBackfaceVisible = false;
  Label.backfaceVisible = false;
  Label.backgroundColorOverride = { red: 0, green: 0, blue: 0, alpha: 1 };
  world2.primitiveShapesManager.addText(Label, Dimension);
  console.warn(`UI_TEXTURE_TEST placed at x ${X}, z ${Z - 3}..${Z + 3}, y ${GroundTop}`);
}

// Source/AttachedOrbit.js
import { TextPrimitive as TextPrimitive3, system as system2, world as world3 } from "@minecraft/server";
var OrbitCarrier = "ddui_demo:orbit_carrier";
var OrbitRadius = 2;
var OrbitClearance = 0.1;
var OrbitPeriod = 8;
var OrbitScale = 0.6;
var BoneOrbitEntity = "ddui_demo:bone_orbit";
var BoneOrbitSpacing = 5;
var SnapDistance = 1;
var ReportTicks = OrbitPeriod * 20;
var Black2 = Object.freeze({ red: 0, green: 0, blue: 0, alpha: 1 });
var White2 = Object.freeze({ red: 1, green: 1, blue: 1, alpha: 1 });
var Orbit;
var BoneOrbit;
var MovedOrbit;
var WorstError = 0;
var Snaps = 0;
function OrbitPoint({ Center, Right }, Seconds) {
  const Angle = 2 * Math.PI * Seconds / OrbitPeriod;
  const Across = OrbitRadius * Math.sin(Angle);
  return {
    x: Center.x + Right.x * Across,
    y: Center.y - OrbitRadius * Math.cos(Angle),
    z: Center.z + Right.z * Across
  };
}
function Text(Dimension, Location, Content, YawDegrees, Scale) {
  const Display = new TextPrimitive3({ ...Location, dimension: Dimension }, Content);
  Display.useRotation = true;
  Display.rotation = { x: 0, y: YawDegrees, z: 0 };
  Display.depthTest = false;
  Display.scale = Scale;
  Display.color = White2;
  Display.textBackfaceVisible = false;
  Display.backfaceVisible = false;
  Display.backgroundColorOverride = Black2;
  return Display;
}
function PlaceAttachedOrbit(Dimension, Center, Facing, YawDegrees, GroundTop) {
  RemoveAttachedOrbit();
  for (const Entity of Dimension.getEntities({ type: OrbitCarrier })) Entity.remove();
  const Circle = {
    Center: { x: Center.x, y: GroundTop + OrbitClearance + OrbitRadius, z: Center.z },
    // The row's right, matching RowLayout's.
    Right: { x: -Math.cos(Facing), z: Math.sin(Facing) }
  };
  const Carrier = Dimension.spawnEntity(OrbitCarrier, OrbitPoint(Circle, system2.currentTick / 20));
  try {
    const Display = Text(Dimension, { x: 0, y: 0, z: 0 }, "attachedTo", YawDegrees, OrbitScale);
    Display.attachedTo = Carrier;
    world3.primitiveShapesManager.addText(Display, Dimension);
    const Title = Text(
      Dimension,
      { ...Circle.Center, y: Circle.Center.y + OrbitRadius + 0.6 },
      `TextPrimitive.attachedTo an invisible entity
steered by velocity, a ${OrbitRadius}-block circle every ${OrbitPeriod} s`,
      YawDegrees,
      0.7875
    );
    world3.primitiveShapesManager.addText(Title, Dimension);
    Orbit = { ...Circle, Carrier, Display, Title };
  } catch (Error3) {
    Carrier.remove();
    throw Error3;
  }
  WorstError = 0;
  Snaps = 0;
  const At = (Value) => Value.toFixed(2);
  console.warn(`ATTACHED_ORBIT placed: center ${At(Circle.Center.x)} ${At(Circle.Center.y)} ${At(Circle.Center.z)}, radius ${OrbitRadius}, lowest point ${At(GroundTop + OrbitClearance)}, period ${OrbitPeriod} s`);
}
function RemoveAttachedOrbit() {
  if (!Orbit) return;
  try {
    Orbit.Display.remove();
  } catch {
  }
  try {
    Orbit.Title.remove();
  } catch {
  }
  try {
    if (Orbit.Carrier.isValid) Orbit.Carrier.remove();
  } catch {
  }
  Orbit = void 0;
}
function PlaceBoneOrbit(Dimension, Center, Facing, YawDegrees, GroundTop) {
  RemoveBoneOrbit();
  for (const Entity2 of Dimension.getEntities({ type: BoneOrbitEntity })) Entity2.remove();
  const Location = { x: Center.x, y: GroundTop, z: Center.z };
  const Entity = Dimension.spawnEntity(BoneOrbitEntity, Location);
  try {
    Entity.setRotation({ x: 0, y: -Facing * 180 / Math.PI });
    const Offset = { x: 0, y: OrbitClearance, z: 0 };
    const Display = Text(Dimension, Offset, "attachedTo", YawDegrees, OrbitScale);
    Display.attachedTo = Entity;
    world3.primitiveShapesManager.addText(Display, Dimension);
    const Title = Text(
      Dimension,
      { ...Location, y: GroundTop + OrbitClearance + 2 * OrbitRadius + 0.6 },
      "TextPrimitive.attachedTo a still entity\nwhose root bone loops in a client animation (red cube)",
      YawDegrees,
      0.7875
    );
    world3.primitiveShapesManager.addText(Title, Dimension);
    BoneOrbit = { Display, Entity, Title };
  } catch (Error3) {
    Entity.remove();
    throw Error3;
  }
  const At = (Value) => Value.toFixed(2);
  console.warn(`BONE_ORBIT placed: entity at ${At(Location.x)} ${At(Location.y)} ${At(Location.z)}, yaw ${At(Entity.getRotation().y)}`);
}
function RemoveBoneOrbit() {
  if (!BoneOrbit) return;
  try {
    BoneOrbit.Display.remove();
  } catch {
  }
  try {
    BoneOrbit.Title.remove();
  } catch {
  }
  try {
    if (BoneOrbit.Entity.isValid) BoneOrbit.Entity.remove();
  } catch {
  }
  BoneOrbit = void 0;
}
function PlaceSetLocationOrbit(Dimension, Center, Facing, YawDegrees, GroundTop) {
  RemoveSetLocationOrbit();
  const Circle = {
    Center: { x: Center.x, y: GroundTop + OrbitClearance + OrbitRadius, z: Center.z },
    Right: { x: -Math.cos(Facing), z: Math.sin(Facing) }
  };
  const Start = OrbitPoint(Circle, system2.currentTick / 20);
  const Display = Text(Dimension, Start, "setLocation", YawDegrees, OrbitScale);
  world3.primitiveShapesManager.addText(Display, Dimension);
  const Title = Text(
    Dimension,
    { ...Circle.Center, y: Circle.Center.y + OrbitRadius + 0.6 },
    `TextPrimitive.setLocation every tick, no entity
a ${OrbitRadius}-block circle every ${OrbitPeriod} s`,
    YawDegrees,
    0.7875
  );
  world3.primitiveShapesManager.addText(Title, Dimension);
  MovedOrbit = { ...Circle, Dimension, Display, Title };
  const At = (Value) => Value.toFixed(2);
  console.warn(`SETLOCATION_ORBIT placed: center ${At(Circle.Center.x)} ${At(Circle.Center.y)} ${At(Circle.Center.z)}`);
}
function RemoveSetLocationOrbit() {
  if (!MovedOrbit) return;
  try {
    MovedOrbit.Display.remove();
  } catch {
  }
  try {
    MovedOrbit.Title.remove();
  } catch {
  }
  MovedOrbit = void 0;
}
function PlaceOrbitTests(Dimension, Center, Facing, YawDegrees, GroundTop) {
  const Along = (Offset) => ({
    x: Center.x - Math.cos(Facing) * Offset,
    z: Center.z + Math.sin(Facing) * Offset
  });
  PlaceSetLocationOrbit(Dimension, Along(-BoneOrbitSpacing), Facing, YawDegrees, GroundTop);
  PlaceAttachedOrbit(Dimension, Center, Facing, YawDegrees, GroundTop);
  PlaceBoneOrbit(Dimension, Along(BoneOrbitSpacing), Facing, YawDegrees, GroundTop);
}
function ClearOrbitEntities(Dimension) {
  for (const Type of [OrbitCarrier, BoneOrbitEntity]) {
    for (const Entity of Dimension.getEntities({ type: Type })) Entity.remove();
  }
}
function SteerOrbit() {
  if (!Orbit || !Orbit.Carrier.isValid) return;
  const Tick = system2.currentTick;
  const Here = Orbit.Carrier.location;
  const Now = OrbitPoint(Orbit, Tick / 20);
  WorstError = Math.max(WorstError, Math.hypot(Here.x - Now.x, Here.y - Now.y, Here.z - Now.z));
  const Next = OrbitPoint(Orbit, (Tick + 1) / 20);
  const Step = { x: Next.x - Here.x, y: Next.y - Here.y, z: Next.z - Here.z };
  if (Math.hypot(Step.x, Step.y, Step.z) > SnapDistance) {
    Orbit.Carrier.teleport(Next);
    Snaps++;
  } else {
    Orbit.Carrier.clearVelocity();
    Orbit.Carrier.applyImpulse(Step);
  }
  if (Tick % ReportTicks === 0) {
    console.warn(`ATTACHED_ORBIT largest error ${WorstError.toFixed(3)} blocks, ${Snaps} teleports in the last loop`);
    WorstError = 0;
    Snaps = 0;
  }
}
system2.runInterval(() => {
  try {
    SteerOrbit();
  } catch (Error3) {
    console.error(`Attached orbit: ${Error3?.stack ?? Error3}`);
  }
  try {
    if (MovedOrbit) {
      const Point = OrbitPoint(MovedOrbit, system2.currentTick / 20);
      MovedOrbit.Display.setLocation({ ...Point, dimension: MovedOrbit.Dimension });
    }
  } catch (Error3) {
    console.error(`setLocation orbit: ${Error3?.stack ?? Error3}`);
  }
}, 1);

// Source/HopTest.js
import { system as system3, world as world4 } from "@minecraft/server";
var ImpulseHop = "ddui_demo:impulse_hop";
var AnimatedHop = "ddui_demo:animated_hop";
var HopAnimation = "animation.ddui_demo.hop.launch";
var HopLift = 1;
var HopRise = 4;
var HopGap = 1;
var HopOffset = 11;
var HopLaunch = 0.8028561;
var SnapDistance2 = 1;
var MostCorrection = 1.25;
var ReportFirst = 5;
var ReportEvery = 20;
var Hop;
function PlaceHopTest(Dimension, Center, Facing, YawDegrees, GroundTop) {
  RemoveHopTest();
  for (const Type of [ImpulseHop, AnimatedHop]) {
    for (const Entity of Dimension.getEntities({ type: Type })) Entity.remove();
  }
  const Along = (Offset, Height) => ({
    x: Center.x - Math.cos(Facing) * Offset,
    y: GroundTop + Height,
    z: Center.z + Math.sin(Facing) * Offset
  });
  const Half = (HopGap + 1) / 2;
  const Start = Along(HopOffset - Half, HopLift);
  const Cube = Dimension.spawnEntity(ImpulseHop, Start);
  let Animated;
  const Displays = [];
  try {
    Animated = Dimension.spawnEntity(AnimatedHop, Along(HopOffset + Half, HopLift));
    const Labels = [
      [Along(HopOffset - Half, 0.4), "applyImpulse"],
      [Along(HopOffset + Half, 0.4), "animation"],
      [
        Along(HopOffset, HopLift + HopRise + 1.6),
        `A ${HopRise}-block hop from ${HopLift} block up, looping`
      ]
    ];
    for (const [Location, Content] of Labels) {
      const Display = Text(Dimension, Location, Content, YawDegrees, 0.6);
      world4.primitiveShapesManager.addText(Display, Dimension);
      Displays.push(Display);
    }
  } catch (Error3) {
    for (const Display of Displays) Display.remove();
    Animated?.remove();
    Cube.remove();
    throw Error3;
  }
  Hop = {
    Animated,
    Cube,
    Displays,
    Start,
    // Landing: the cube is at its start and launches on the next tick.
    Phase: "Landing",
    Launch: HopLaunch,
    LaunchY: Start.y,
    LaunchTick: system3.currentTick,
    Apex: Start.y,
    Hops: 0,
    Snaps: 0
  };
  const At = (Value) => Value.toFixed(2);
  console.warn(`HOP_TEST placed: impulse cube at ${At(Start.x)} ${At(Start.y)} ${At(Start.z)}, rise ${HopRise}, launch ${HopLaunch} blocks per tick`);
}
function RemoveHopTest() {
  if (!Hop) return;
  for (const Display of Hop.Displays) {
    try {
      Display.remove();
    } catch {
    }
  }
  for (const Entity of [Hop.Cube, Hop.Animated]) {
    try {
      if (Entity.isValid) Entity.remove();
    } catch {
    }
  }
  Hop = void 0;
}
function Launch() {
  const Here = Hop.Cube.location;
  const Target = Hop.Start.y + HopRise - Here.y;
  if (Hop.Hops > 0 && Number.isFinite(Hop.Apex)) {
    const Rise = Hop.Apex - Hop.LaunchY;
    const Ticks = system3.currentTick - Hop.LaunchTick;
    if (Hop.Hops <= ReportFirst || Hop.Hops % ReportEvery === 0) {
      console.warn(`HOP_TEST hop ${Hop.Hops}: rose ${Rise.toFixed(3)} blocks at ${Hop.Launch.toFixed(4)} blocks per tick, ${Ticks} ticks, landed ${(Here.y - Hop.Start.y).toFixed(3)} blocks from the start, ${Hop.Snaps} teleports so far`);
    }
    if (Rise > 0) {
      const Factor = Math.sqrt(Target / Rise);
      Hop.Launch *= Math.min(MostCorrection, Math.max(1 / MostCorrection, Factor));
    }
  }
  Hop.Cube.clearVelocity();
  Hop.Cube.applyImpulse({ x: 0, y: Hop.Launch, z: 0 });
  Hop.Animated.playAnimation(HopAnimation, { blendOutTime: 0, stopExpression: "query.any_animation_finished" });
  Hop.Phase = "Flying";
  Hop.LaunchY = Here.y;
  Hop.Apex = Here.y;
  Hop.LaunchTick = system3.currentTick;
  Hop.Hops++;
}
function StepHop() {
  if (!Hop || !Hop.Cube.isValid || !Hop.Animated.isValid) return;
  if (Hop.Phase === "Landing") {
    Launch();
    return;
  }
  const Here = Hop.Cube.location;
  const Floor = Hop.Start.y;
  const Aside = Math.hypot(Here.x - Hop.Start.x, Here.z - Hop.Start.z);
  if (Aside > SnapDistance2 || Here.y < Floor - SnapDistance2 || Here.y > Floor + HopRise + SnapDistance2) {
    Hop.Cube.teleport(Hop.Start);
    Hop.Cube.clearVelocity();
    Hop.Phase = "Landing";
    Hop.Apex = Number.NaN;
    Hop.Snaps++;
    return;
  }
  Hop.Apex = Math.max(Hop.Apex, Here.y);
  const Fall = Hop.Cube.getVelocity().y;
  if (Fall >= 0) return;
  if (Here.y <= Floor) {
    Launch();
  } else if (Here.y + Fall < Floor) {
    Hop.Cube.clearVelocity();
    Hop.Cube.applyImpulse({ x: 0, y: Floor - Here.y, z: 0 });
    Hop.Phase = "Landing";
  }
}
system3.runInterval(() => {
  try {
    StepHop();
  } catch (Error3) {
    console.error(`Hop test: ${Error3?.stack ?? Error3}`);
  }
}, 1);

// Source/HeldCube.js
import { system as system5, world as world6 } from "@minecraft/server";

// Source/FlatDimension.js
import { BlockVolume, system as system4, world as world5 } from "@minecraft/server";
var FlatLayers = Object.freeze([
  Object.freeze({ Height: 1, Type: "minecraft:bedrock" }),
  Object.freeze({ Height: 2, Type: "minecraft:dirt" }),
  Object.freeze({ Height: 1, Type: "minecraft:grass_block" })
]);
var SpawnChunks = 3;
var PlayerChunks = 4;
var Laid = /* @__PURE__ */ new Set();
var Waiting = [];
var Ready = false;
system4.beforeEvents.startup.subscribe(({ dimensionRegistry }) => {
  dimensionRegistry.registerCustomDimension(CustomDimension.Flat);
});
function FlatDimension() {
  return world5.getDimension(CustomDimension.Flat);
}
function FlatGroundTop() {
  return FlatDimension().heightRange.min + FlatLayers.reduce((Sum, { Height }) => Sum + Height, 0);
}
function LayChunk(Dimension, ChunkX, ChunkZ) {
  const Key = `${ChunkX},${ChunkZ}`;
  if (Laid.has(Key)) return true;
  const Bottom = Dimension.heightRange.min;
  const Corner = { x: ChunkX * 16, y: Bottom, z: ChunkZ * 16 };
  if (!Dimension.isChunkLoaded(Corner)) return false;
  if (Dimension.getBlock(Corner)?.typeId !== FlatLayers[0].Type) {
    let Y = Bottom;
    for (const { Height, Type } of FlatLayers) {
      const From = { x: Corner.x, y: Y, z: Corner.z };
      const To = { x: Corner.x + 15, y: Y + Height - 1, z: Corner.z + 15 };
      Dimension.fillBlocks(new BlockVolume(From, To), Type);
      Y += Height;
    }
  }
  Laid.add(Key);
  return true;
}
async function PrepareFlatDimension() {
  const Dimension = FlatDimension();
  const Bottom = Dimension.heightRange.min;
  const Options = {
    dimension: Dimension,
    from: { x: -SpawnChunks * 16, y: Bottom, z: -SpawnChunks * 16 },
    to: { x: SpawnChunks * 16 - 1, y: Bottom + 8, z: SpawnChunks * 16 - 1 }
  };
  const Manager = world5.tickingAreaManager;
  if (Manager.hasTickingArea(TickingArea.FlatSpawn)) Manager.removeTickingArea(TickingArea.FlatSpawn);
  if (!Manager.hasCapacity(Options)) {
    throw new Error(`No ticking capacity for the flat spawn area (${Manager.chunkCount} of ${Manager.maxChunkCount} chunks used).`);
  }
  await Manager.createTickingArea(TickingArea.FlatSpawn, Options);
  let Missing = 0;
  for (let X = -SpawnChunks; X < SpawnChunks; X++) {
    for (let Z = -SpawnChunks; Z < SpawnChunks; Z++) {
      if (!LayChunk(Dimension, X, Z)) Missing++;
    }
  }
  if (Missing > 0) throw new Error(`${Missing} spawn chunks of the flat dimension were not loaded.`);
  Ready = true;
  console.warn(`FLAT_DIMENSION_READY ${Dimension.id}, ground top ${FlatGroundTop()}, ${(2 * SpawnChunks) ** 2} spawn chunks ticking`);
  for (const Call of Waiting.splice(0)) Call();
}
function WhenFlatReady(Call) {
  if (Ready) Call();
  else Waiting.push(Call);
}
function MoveToFlat(Player2) {
  WhenFlatReady(() => {
    if (!Player2.isValid) return;
    const Spawn = { x: 0.5, y: FlatGroundTop(), z: 0.5 };
    Player2.teleport(Spawn, { dimension: FlatDimension(), rotation: { x: 0, y: 0 } });
  });
}
system4.runInterval(() => {
  if (!Ready) return;
  try {
    const Dimension = FlatDimension();
    for (const Player2 of Dimension.getPlayers()) {
      const ChunkX = Math.floor(Player2.location.x / 16);
      const ChunkZ = Math.floor(Player2.location.z / 16);
      for (let X = ChunkX - PlayerChunks; X <= ChunkX + PlayerChunks; X++) {
        for (let Z = ChunkZ - PlayerChunks; Z <= ChunkZ + PlayerChunks; Z++) {
          LayChunk(Dimension, X, Z);
        }
      }
    }
  } catch (Error3) {
    console.error(`Flat dimension floor: ${Error3?.stack ?? Error3}`);
  }
}, 10);

// Source/HeldCube.js
var HeldCube = "ddui_demo:held_cube";
var HeldDistance = 2;
var HeldDrop = 0.6;
var HeldStiffness = 0.08;
var HeldDamping = 0.35;
var HeldMostAcceleration = 0.3;
var HeldMostSpeed = 1.5;
var SnapDistance3 = 8;
var Held = /* @__PURE__ */ new Map();
function Length({ x, y, z }) {
  return Math.hypot(x, y, z);
}
function Limit(Vector, Most) {
  const Size = Length(Vector);
  if (Size <= Most) return Vector;
  const Scale = Most / Size;
  return { x: Vector.x * Scale, y: Vector.y * Scale, z: Vector.z * Scale };
}
var HeldMostSpinChange = 10;
var HeldMostSpin = 30;
function Wrap(Degrees) {
  return ((Degrees + 180) % 360 + 360) % 360 - 180;
}
function HeldRest(Player2) {
  const Eyes = Player2.getHeadLocation();
  const { x: PitchDegrees, y: YawDegrees } = Player2.getRotation();
  const Yaw2 = YawDegrees * Math.PI / 180;
  const Pitch = PitchDegrees * Math.PI / 180;
  const Ahead = { x: -Math.sin(Yaw2) * Math.cos(Pitch), y: -Math.sin(Pitch), z: Math.cos(Yaw2) * Math.cos(Pitch) };
  const Up = { x: -Math.sin(Yaw2) * Math.sin(Pitch), y: Math.cos(Pitch), z: Math.cos(Yaw2) * Math.sin(Pitch) };
  return {
    x: Eyes.x + Ahead.x * HeldDistance - Up.x * HeldDrop,
    y: Eyes.y + Ahead.y * HeldDistance - Up.y * HeldDrop - 0.5,
    z: Eyes.z + Ahead.z * HeldDistance - Up.z * HeldDrop
  };
}
function SpawnCube(Player2) {
  const Earlier = Held.get(Player2.id)?.Cube;
  if (Earlier?.isValid) Earlier.remove();
  const Rest = HeldRest(Player2);
  const Yaw2 = Player2.getRotation().y;
  const State = { Cube: void 0, Was: Rest, RestWas: Rest, Yaw: Yaw2, Spin: 0, PlayerYawWas: Yaw2 };
  Held.set(Player2.id, State);
  State.Cube = Player2.dimension.spawnEntity(HeldCube, Rest);
  State.Cube.setRotation({ x: 0, y: Yaw2 });
  const At = (Value) => Value.toFixed(2);
  console.warn(`HELD_CUBE spawned in ${Player2.dimension.id} at ${At(Rest.x)} ${At(Rest.y)} ${At(Rest.z)}`);
}
function StepCube(Player2, State) {
  const Rest = HeldRest(Player2);
  const Cube = State.Cube;
  if (!Cube?.isValid) {
    SpawnCube(Player2);
    return;
  }
  const Here = Cube.location;
  const Off = { x: Rest.x - Here.x, y: Rest.y - Here.y, z: Rest.z - Here.z };
  if (Cube.dimension.id !== Player2.dimension.id || Length(Off) > SnapDistance3) {
    Cube.teleport(Rest, { dimension: Player2.dimension });
    Cube.clearVelocity();
    State.Was = Rest;
    State.RestWas = Rest;
    TurnCube(Player2, State);
    return;
  }
  const Moved = { x: Here.x - State.Was.x, y: Here.y - State.Was.y, z: Here.z - State.Was.z };
  const RestMoved = { x: Rest.x - State.RestWas.x, y: Rest.y - State.RestWas.y, z: Rest.z - State.RestWas.z };
  const Pull = Limit({
    x: HeldStiffness * Off.x + HeldDamping * (RestMoved.x - Moved.x),
    y: HeldStiffness * Off.y + HeldDamping * (RestMoved.y - Moved.y),
    z: HeldStiffness * Off.z + HeldDamping * (RestMoved.z - Moved.z)
  }, HeldMostAcceleration);
  const Velocity = Limit({ x: Moved.x + Pull.x, y: Moved.y + Pull.y, z: Moved.z + Pull.z }, HeldMostSpeed);
  Cube.clearVelocity();
  Cube.applyImpulse(Velocity);
  State.Was = Here;
  State.RestWas = Rest;
  TurnCube(Player2, State);
}
function TurnCube(Player2, State) {
  const PlayerYaw2 = Player2.getRotation().y;
  const Off = Wrap(PlayerYaw2 - State.Yaw);
  const PlayerSpin = Wrap(PlayerYaw2 - State.PlayerYawWas);
  const Clamp = (Value, Most) => Math.max(-Most, Math.min(Most, Value));
  const Change = Clamp(HeldStiffness * Off + HeldDamping * (PlayerSpin - State.Spin), HeldMostSpinChange);
  State.Spin = Clamp(State.Spin + Change, HeldMostSpin);
  State.Yaw = Wrap(State.Yaw + State.Spin);
  State.PlayerYawWas = PlayerYaw2;
  State.Cube.setRotation({ x: 0, y: State.Yaw });
}
function RemoveStrayCubes() {
  const Carried = new Set([...Held.values()].map(({ Cube }) => Cube?.id));
  for (const Dimension of [
    world6.getDimension("overworld"),
    world6.getDimension("nether"),
    world6.getDimension("the_end"),
    FlatDimension()
  ]) {
    for (const Entity of Dimension.getEntities({ type: HeldCube })) {
      if (!Carried.has(Entity.id)) Entity.remove();
    }
  }
}
world6.afterEvents.playerSpawn.subscribe(({ initialSpawn, player }) => {
  if (!initialSpawn) return;
  try {
    SpawnCube(player);
  } catch (Error3) {
    console.error(`Held cube: ${Error3?.stack ?? Error3}`);
  }
});
world6.afterEvents.worldLoad.subscribe(() => {
  try {
    RemoveStrayCubes();
    for (const Player2 of world6.getAllPlayers()) SpawnCube(Player2);
  } catch (Error3) {
    console.error(`Held cube: ${Error3?.stack ?? Error3}`);
  }
});
world6.afterEvents.playerLeave.subscribe(({ playerId }) => {
  const Cube = Held.get(playerId)?.Cube;
  Held.delete(playerId);
  try {
    if (Cube?.isValid) Cube.remove();
  } catch (Error3) {
    console.error(`Held cube: ${Error3?.stack ?? Error3}`);
  }
});
world6.afterEvents.entityLoad.subscribe(({ entity }) => {
  try {
    if (entity.typeId !== HeldCube) return;
    const Carried = [...Held.values()].some(({ Cube }) => Cube?.id === entity.id);
    if (!Carried) entity.remove();
  } catch (Error3) {
    console.error(`Held cube: ${Error3?.stack ?? Error3}`);
  }
});
system5.runInterval(() => {
  for (const Player2 of world6.getAllPlayers()) {
    const State = Held.get(Player2.id);
    if (!State) continue;
    try {
      StepCube(Player2, State);
    } catch (Error3) {
      console.error(`Held cube: ${Error3?.stack ?? Error3}`);
    }
  }
}, 1);

// Source/TerminalArt.js
function Fullwidth(Text2) {
  return Text2.replace(/[A-Za-z0-9]/g, (Character2) => String.fromCodePoint(Character2.codePointAt(0) + 65248));
}
function TerminalTable(Wide = false) {
  const Rows = [
    ["SYSTEM", "LEVEL", "STATE"],
    ["GARDEN", "024", "BLOOM"],
    ["WATER", "086", "FLOW"],
    ["LIGHT", "100", "GLOW"]
  ];
  const Converted = Rows.map((Row) => Row.map((Text2) => Wide ? Fullwidth(Text2) : Text2));
  const Width = (Text2) => [...Text2].reduce((Total, Character2) => Total + (Character2.codePointAt(0) >= 65281 && Character2.codePointAt(0) <= 65376 ? 2 : 1), 0);
  const Widths = Rows[0].map((_, Column) => Math.max(...Converted.map((Row) => Width(Row[Column]))) + 2);
  const Rule = (Left, Middle, Right) => Left + Widths.map((Count) => "\u2500".repeat(Count)).join(Middle) + Right;
  const Content = (Row) => "\u2502" + Row.map((Text2, Index) => " " + Text2 + " ".repeat(Widths[Index] - Width(Text2) - 1)).join("\u2502") + "\u2502";
  return [
    Rule("\u250C", "\u252C", "\u2510"),
    Content(Converted[0]),
    Rule("\u251C", "\u253C", "\u2524"),
    ...Converted.slice(1).map(Content),
    Rule("\u2514", "\u2534", "\u2518")
  ].join("\n");
}
function BrailleCells(Seconds) {
  const Width = 64;
  const Height = 32;
  const Cells = new Uint8Array(32 * 8);
  const Bits = [1, 8, 2, 16, 4, 32, 64, 128];
  const Dot = (X, Y) => {
    X = Math.round(X);
    Y = Math.round(Y);
    if (X < 0 || X >= Width || Y < 0 || Y >= Height) return;
    Cells[Math.floor(Y / 4) * 32 + Math.floor(X / 2)] |= Bits[Y % 4 * 2 + X % 2];
  };
  const Phase = (Seconds % 12 + 12) % 12 * Math.PI / 6;
  for (let X = 0; X < Width; X++) {
    for (let Ribbon = 0; Ribbon < 3; Ribbon++) {
      const Y = 16 + Math.sin(X * Math.PI / 32 + Phase + Ribbon * 1.4) * (5 + Ribbon * 2) + Math.sin(X * Math.PI / 16 - Phase * 2) * 2;
      Dot(X, Y);
      Dot(X, Y + 1);
    }
  }
  for (let Index = 0; Index < 10; Index++) {
    const Angle = Phase + Index * Math.PI / 5;
    const X = 31.5 + Math.cos(Angle) * 25;
    const Y = 15.5 + Math.sin(Angle * 2) * 12;
    Dot(X, Y);
    Dot(X - 1, Y);
    Dot(X + 1, Y);
    Dot(X, Y - 1);
    Dot(X, Y + 1);
  }
  const Rows = [];
  for (let Y = 0; Y < 8; Y++) {
    const Row = Cells.slice(Y * 32, (Y + 1) * 32);
    Rows.push(Array.from(Row, (Value) => String.fromCodePoint(10240 + Value)));
  }
  return Rows;
}
function RowColor(Y) {
  const Row = Y % 8;
  return Row < 3 ? "\xA7b" : Row < 6 ? "\xA73" : "\xA79";
}
function BrailleFrame(Seconds) {
  return "\xA7r\xA7bAnimated Demonstration (Fireflies) \xA7r\xA77~20 fps\n" + BrailleCanvas(Seconds);
}
function BrailleCanvas(Seconds) {
  return BrailleCells(Seconds).map((Characters2, Y) => RowColor(Y) + Characters2.join("")).join("\n");
}
var TerminalText = Object.freeze([
  [0, 2, "ABCDEFGHIJKLM"],
  [0, 24, "NOPQRSTUVWXYZ"],
  [1, 10, "MMMMMWWWWWiiiiilllll"],
  [2, 4, "abcdefghijklm"],
  [2, 22, "nopqrstuvwxyz"],
  [3, 6, "The quick brown fox"],
  [4, 14, "jumps over the lazy dog."],
  [5, 7, "\u2160 \u2161 \u2162 \u2163 \u2164 \u2165 \u2166 \u2167"],
  [5, 24, "\u2168 \u2169 \u216A"],
  [6, 1, "\u216B \u216C \u216D \u216E \u216F"],
  [6, 20, "\u2170 \u2171 \u2172 \u2173 \u2174 \u2175"],
  [7, 8, "\u2176 \u2177 \u2178 \u2179 \u217A \u217B"],
  [7, 26, "\u217C \u217D \u217E \u217F"],
  [8, 3, "0123456789"],
  [8, 20, "MMXXVI = 2026"],
  [9, 1, ". , - _ : ;"],
  [9, 22, "! ? ' \" ` ~"],
  [10, 6, "( ) [ ] { } < >"],
  [10, 26, "/ \\ | @ # $ %"],
  [11, 2, "^ & * + ="],
  [11, 16, "\u2026 \u2013 \u2014 \u2022 \xB0 \xB1"],
  [12, 9, "Hello, world! (v1.1.13)"],
  [13, 6, "$ ls -la ~/bin"],
  [13, 21, "[ OK ] 98.6%"],
  [14, 4, "i, j; k: l."],
  [14, 20, "e.g. A-Z, a-z"],
  [15, 1, "\"quoted\" 'single' `tick`"],
  [15, 30, "iv. Fin."]
]);

// Source/Main.js
var Compass = "ddui_demo:form_compass";
var LineGapTool = "ddui_demo:line_gap_tool";
var PageTurner = "ddui_demo:unicode_page_turner";
var TextWriter = "ddui_demo:text_writer";
var OpenForms = /* @__PURE__ */ new Set();
var Black3 = Object.freeze({ red: 0, green: 0, blue: 0, alpha: 1 });
var White3 = Object.freeze({ red: 1, green: 1, blue: 1, alpha: 1 });
var PixelSize2 = 0.025;
var Clear = Object.freeze({ red: 0, green: 0, blue: 0, alpha: 0 });
var ReferencePurple = Object.freeze({ red: 0.8, green: 0.65, blue: 1, alpha: 0.6 });
var ReferenceGap = 0.1;
var RowScale = 0.7875;
var HeadingScale = 0.65;
var StackGap = 0.25;
var BrowserTitle = "Unicode Browser";
var Colored = (Text2, Color) => Text2.split("\n").map((Line) => `\xA7r${Color}${Line}`).join("\n");
var OverlayCharts = /* @__PURE__ */ new Set(["Sextants", "Octants", "Diagonal lines"]);
var GalleryEntries = [
  { Name: "Selected character", Selected: true },
  { Browser: true, Name: "Unicode browser" },
  ...CharacterSets.map((Set2) => {
    if (!OverlayCharts.has(Set2.Name)) return { Name: Set2.Name, Text: Colored(CharacterChart(Set2), Set2.TextColor ?? "\xA7f") };
    const Text2 = Colored(CharacterChart(Set2), OverlayColors.Ink);
    const { Back, Front } = SplitOverlay(Text2);
    return { Back, Name: Set2.Name, Text: Front };
  }),
  { Name: "Terminal table", Text: Colored("Terminal table\n" + TerminalTable(), "\xA7f") },
  // Its box rules are 126 bytes, so the pink (§d) comes from the display color instead of per-line codes.
  {
    Color: { red: 1, green: 1 / 3, blue: 1, alpha: 1 },
    Name: "Fullwidth terminal table",
    Text: "Fullwidth terminal table\n" + TerminalTable(true)
  },
  // No formatting codes: the top line is only a's. The display color makes it white.
  { Name: "Separator test", Text: SeparatorTestText }
].map((Entry) => Object.freeze({
  ...Entry,
  Measure: Entry.Browser || Entry.Selected ? void 0 : MeasureText(Entry.Text ?? Entry.Frame(0)),
  Scale: RowScale
}));
var BrowserIndex = GalleryEntries.findIndex((Entry) => Entry.Browser);
var SelectedIndex = GalleryEntries.findIndex((Entry) => Entry.Selected);
var BackEntries = OddCharacterCases.map((Entry) => {
  const Measure = MeasureText(Entry.Text);
  const ReferenceWidth = MeasureText(Entry.Reference).Width;
  const TitleText = WrapText(Entry.Title, Measure.Width + ReferenceGap / (PixelSize2 * RowScale) + ReferenceWidth);
  return Object.freeze({
    ...Entry,
    DisplayWidth: Measure.Width,
    Lines: Measure.Lines,
    Name: Entry.Title,
    ReferenceWidth,
    Scale: RowScale,
    TitleText,
    TitleWidth: MeasureText(TitleText).Width
  });
});
var OffsetEntries = [...PixelOffsetTests, ...OverlayTests, RegionDemo()].map((Entry) => {
  const Measure = Entry.Measure ?? MeasureText(Entry.Text);
  const Ratio = Entry.HalfScale ? 2 : 1;
  const TitleText = WrapText(Entry.Title, Measure.Width / Ratio);
  return Object.freeze({
    ...Entry,
    Measure: { Lines: Measure.Lines, Width: Math.max(Measure.Width, MeasureText(TitleText).Width * Ratio) },
    Name: Entry.Title,
    Scale: RowScale / Ratio,
    TitleText
  });
});
var FirefliesGlyphTitle = "Fireflies in octants, glyphs only (two layers)";
var AnimationEntries = (() => {
  const Glyphs = GlyphOnly(BrailleCanvas(0));
  return Object.freeze([
    Object.freeze({ Frame: BrailleFrame, Measure: MeasureText(BrailleFrame(0)), Name: "Fireflies", Scale: RowScale }),
    Object.freeze({
      LineGap: GlyphOnlyLineGap,
      Measure: { Lines: Glyphs.A.split("\n").length, Width: Glyphs.Cells * CustomGlyphAdvance },
      Name: FirefliesGlyphTitle,
      Pitch: UnicodeLineHeight,
      Scale: RowScale / 2,
      Title: FirefliesGlyphTitle
    })
  ]);
})();
var Checked = [
  { Name: "Fireflies", Text: BrailleFrame(0) },
  { Name: "Fireflies glyphs, first layer", Text: GlyphOnly(BrailleCanvas(0)).A },
  { Name: "Fireflies glyphs, second layer", Text: GlyphOnly(BrailleCanvas(0)).B },
  ...GalleryEntries,
  ...BackEntries,
  ...OffsetEntries,
  ...OffsetEntries.flatMap((Entry) => (Entry.Regions ?? []).map((Spec) => ({
    Name: `${Entry.Name} region k=${Spec.K}`,
    Text: RegionText({ Cells: 12, Lines: 5, Scale: Entry.Scale }, Spec.Box, Spec.K, Spec.Family, Spec.Inside).Text
  }))),
  ...[...GalleryEntries, ...OffsetEntries].filter(({ Back }) => Back !== void 0).map(({ Back, Name }) => ({
    Name: `${Name} back`,
    Text: Back
  })),
  ...OffsetEntries.filter(({ Middle }) => Middle !== void 0).map(({ Middle, Name }) => ({
    Name: `${Name} middle`,
    Text: Middle
  })),
  ...BackEntries.map(({ Name, Reference }) => ({ Name: `${Name} reference`, Text: Reference })),
  ...BackEntries.map(({ TitleText }) => ({ Name: TitleText, Text: TitleText }))
];
for (const Entry of Checked) {
  if (Entry.Browser || Entry.Selected) continue;
  const Bytes = LongestLineBytes(Entry.Text ?? Entry.Frame(0));
  if (Bytes > LineByteLimit) {
    console.error(`${Entry.Name}: a ${Bytes}-byte line exceeds the ${LineByteLimit}-byte TextPrimitive limit.`);
  }
}
var GalleryDisplays = [];
var BrowserHeader;
var BackDisplays = [];
var OffsetDisplays = [];
var AnimationDisplays;
var BackPixelSize;
var GalleryPlacement;
var BrowserPage = 0;
var InitialSelectedText = "ab rl";
var SelectedText = InitialSelectedText;
var AdjustableLineGapHeight = -4;
var OffsetLineGap = -4;
var OverlayDrop = 4;
var OverlayFrontGap = -2;
var OverlayBackGap = 2 * (UnicodeLineHeight + OverlayFrontGap) - UnicodeLineHeight;
var OverlayDepth = 5e-3;
function OverlayBack(Location, Facing, Depth = OverlayDepth) {
  return {
    x: Location.x + Math.sin(Facing) * Depth,
    y: Location.y - OverlayDrop * PixelSize2 * RowScale,
    z: Location.z + Math.cos(Facing) * Depth
  };
}
function MiddleLocation(Entry, Location, Facing) {
  if (!Entry.GlyphOnly) {
    return OverlayBack(Location, Facing, OverlayDepth / 2);
  }
  return {
    x: Location.x - Math.sin(Facing) * OverlayDepth / 2,
    y: Location.y,
    z: Location.z - Math.cos(Facing) * OverlayDepth / 2
  };
}
function AddMiddle(Dimension, Entry, Location, Facing) {
  const Middle = AddText(Dimension, MiddleLocation(Entry, Location, Facing), Entry.Middle, Facing, {
    Background: Clear,
    Scale: Entry.GlyphOnly ? Entry.Scale : RowScale / 2
  });
  Middle.lineGapHeight = Entry.GlyphOnly ? Entry.LineGap : OverlayBackGap;
  Middle.depthTest = true;
  return Middle;
}
function RegionLocation(Entry, Location, Facing, Spec) {
  const Anchor = Entry.GlyphOnly ? Location : OverlayBack(Location, Facing);
  const B = MiddleLocation({ GlyphOnly: true }, Anchor, Facing);
  return {
    x: B.x - Math.sin(Facing) * OverlayDepth / 4 - Math.cos(Facing) * Spec.LocationOffset.x,
    y: Anchor.y + Spec.LocationOffset.y,
    z: B.z - Math.cos(Facing) * OverlayDepth / 4 + Math.sin(Facing) * Spec.LocationOffset.x
  };
}
function AddRegions(Dimension, Entry, Location, Facing) {
  const Regions = [];
  try {
    for (const Definition of Entry.Regions ?? []) {
      const Spec = RegionText(
        {
          Cells: Entry.Cells ?? Entry.Measure.Width / 8,
          Lines: Entry.Measure.Lines,
          Scale: Entry.GlyphOnly ? Entry.Scale : RowScale / 2
        },
        Definition.Box,
        Definition.K,
        Definition.Family,
        Definition.Inside,
        { ...Definition.Options, PixelSize: PixelSize2 }
      );
      const Display = AddText(
        Dimension,
        RegionLocation(Entry, Location, Facing, Spec),
        Spec.Text,
        Facing,
        { Background: Clear, Scale: Spec.Scale }
      );
      Regions.push({ Display, Spec, PixelSizeAtCreation: PixelSize2 });
      Display.lineGapHeight = GlyphOnlyLineGap;
      Display.depthTest = true;
    }
    return Regions;
  } catch (Error3) {
    for (const { Display } of Regions) Display.remove();
    throw Error3;
  }
}
function AnimationPrimitives(Record2) {
  if (!Record2) return [];
  const { Regions = [], ...Displays } = Record2;
  return [...Object.values(Displays), ...Regions.map(({ Display }) => Display)];
}
function MoveRegions(Regions, Entry, Location, Facing) {
  for (const { Display, Spec, PixelSizeAtCreation } of Regions)
    Display.setLocation(InOverworld(RegionLocation(Entry, Location, Facing, {
      ...Spec,
      LocationOffset: { ...Spec.LocationOffset, x: Spec.LocationOffset.x * PixelSize2 / PixelSizeAtCreation }
    })));
}
function AddOverlayBack(Dimension, Location, Text2, Facing) {
  const Back = AddText(Dimension, OverlayBack(Location, Facing), Text2, Facing, {
    Background: OverlayColors.Background,
    Scale: RowScale / 2
  });
  Back.lineGapHeight = OverlayBackGap;
  Back.depthTest = true;
  return Back;
}
var GalleryDistance = 6;
var GalleryLowering = 0.2;
var GalleryTurn = Math.PI / 2;
var BackDistance = 3;
var AnimationDistance = 3;
var AisleDistance = 10;
var SpawnSerial = 0;
var LastTurn = /* @__PURE__ */ new Map();
system6.runInterval(() => {
  if (!AnimationDisplays || world7.getAllPlayers().length === 0) return;
  const Seconds = system6.currentTick / 20;
  try {
    const { A, B } = GlyphOnly(BrailleCanvas(Seconds));
    AnimationDisplays.Fireflies.setText(BrailleFrame(Seconds));
    AnimationDisplays.A.setText(A);
    AnimationDisplays.B.setText(B);
  } catch (Error3) {
    AnimationDisplays = void 0;
    console.error(`Braille animation: ${Error3}`);
  }
}, 1);
function EntryText(Entry) {
  if (Entry.Browser) return PageText(BrowserPage);
  if (Entry.Selected) return SelectedText;
  return Entry.Text ?? Entry.Frame(system6.currentTick / 20);
}
function RowEntries(Reference) {
  return GalleryEntries.map((Entry) => {
    let Text2 = EntryText(Entry);
    if (Reference && Entry.Browser) Text2 = PageText(0);
    if (Reference && Entry.Selected) Text2 = InitialSelectedText;
    const LineGap2 = Entry.Frame ? AdjustableLineGapHeight : Entry.Back === void 0 ? 0 : OverlayFrontGap;
    const Pitch = Entry.Back === void 0 ? LineHeight : UnicodeLineHeight;
    return { ...Entry, LineGap: LineGap2, Measure: Entry.Measure ?? MeasureText(Text2), Pitch };
  });
}
function GalleryAnchors(Origin, Facing, GroundTop) {
  const Common = { GroundTop: GroundTop - GalleryLowering, PixelSize: PixelSize2 };
  const Before = RowLayout(RowEntries(true), {
    ...Common,
    Anchor: BrowserIndex,
    Distance: GalleryDistance,
    Facing,
    Origin
  });
  const Pivot = Before[SelectedIndex].Location;
  const After = RowLayout(RowEntries(true), {
    ...Common,
    Anchor: SelectedIndex,
    Center: Pivot,
    Facing: Facing + GalleryTurn
  });
  return { BackCenter: After[BrowserIndex].Location, Pivot };
}
function GalleryLayout(Placement) {
  const Facing = Placement.Facing + GalleryTurn;
  const Common = { GroundTop: Placement.GroundTop - GalleryLowering, PixelSize: PixelSize2 };
  const Row = RowLayout(RowEntries(false), { ...Common, Anchor: SelectedIndex, Center: Placement.Pivot, Facing });
  const Browser = Row[BrowserIndex];
  const Height = (Text2, Scale) => MeasureText(Text2).Lines * LineHeight * PixelSize2 * Scale;
  const Above = (Display, Text2, Scale) => Display.Location.y + Math.max(Display.Height / 2, Display.Reach ?? 0) + StackGap + Height(Text2, Scale) / 2;
  const Heading = PageHeading(BrowserPage);
  const HeadingY = Above(Browser, Heading, HeadingScale);
  const TitleY = HeadingY + Height(Heading, HeadingScale) / 2 + StackGap + Height(BrowserTitle, RowScale) / 2;
  const BackCenter = {
    x: Placement.BackCenter.x + Math.sin(Facing) * BackDistance,
    z: Placement.BackCenter.z + Math.cos(Facing) * BackDistance
  };
  const BackFacing = Facing + Math.PI;
  const Gap = ReferenceGap / (PixelSize2 * RowScale);
  const PairWidth = (Entry) => Entry.DisplayWidth + Gap + Entry.ReferenceWidth;
  const Slots = RowLayout(BackEntries.map((Entry) => ({
    ...Entry,
    Measure: { Lines: Entry.Lines, Width: Math.max(PairWidth(Entry), Entry.TitleWidth) }
  })), { ...Common, Center: BackCenter, Facing: BackFacing });
  const Right = { x: -Math.cos(BackFacing), z: Math.sin(BackFacing) };
  const Block = PixelSize2 * RowScale;
  const Along = (Location, Offset) => ({ ...Location, x: Location.x + Right.x * Offset, z: Location.z + Right.z * Offset });
  const OffsetFacing = Facing + Math.PI;
  const OffsetCenter = {
    x: Placement.BackCenter.x - Math.sin(Facing) * AisleDistance,
    z: Placement.BackCenter.z - Math.cos(Facing) * AisleDistance
  };
  const OffsetSlots = OffsetEntries.map((Entry) => Entry.Back === void 0 ? { ...Entry, LineGap: Entry.LineGap ?? OffsetLineGap } : { ...Entry, LineGap: OverlayFrontGap, Pitch: UnicodeLineHeight });
  const OffsetCases = RowLayout(OffsetSlots, { ...Common, Center: OffsetCenter, Facing: OffsetFacing }).map((Slot, Index) => ({
    Display: Slot.Location,
    Title: { ...Slot.Location, y: Above(Slot, OffsetEntries[Index].TitleText, RowScale) }
  }));
  const BackCases = Slots.map((Slot, Index) => {
    const Entry = BackEntries[Index];
    const Pair = PairWidth(Entry) * Block;
    return {
      Display: Along(Slot.Location, (Entry.DisplayWidth * Block - Pair) / 2),
      Reference: Along(Slot.Location, (Pair - Entry.ReferenceWidth * Block) / 2),
      Title: { ...Slot.Location, y: Above(Slot, Entry.TitleText, RowScale) }
    };
  });
  const AnimationCenter = {
    x: Placement.BackCenter.x - Math.sin(Facing) * (AisleDistance + AnimationDistance),
    z: Placement.BackCenter.z - Math.cos(Facing) * (AisleDistance + AnimationDistance)
  };
  const AnimationSlots = RowLayout(AnimationEntries.map((Entry) => Entry.Frame ? { ...Entry, LineGap: AdjustableLineGapHeight } : Entry), { ...Common, Center: AnimationCenter, Facing });
  const AnimationCases = AnimationSlots.map((Slot, Index) => ({
    Display: Slot.Location,
    Title: AnimationEntries[Index].Title === void 0 ? void 0 : { ...Slot.Location, y: Above(Slot, AnimationEntries[Index].Title, RowScale) }
  }));
  return {
    AnimationCases,
    BackCases,
    BackFacing,
    OffsetCases,
    OffsetFacing,
    Facing,
    Heading: { ...Browser.Location, y: HeadingY },
    Row,
    Title: { ...Browser.Location, y: TitleY }
  };
}
function RefreshGallery() {
  if (!GalleryPlacement) return;
  const Layout = GalleryLayout(GalleryPlacement);
  GalleryDisplays.forEach(({ Back, Display, Entry }, Index) => {
    if (Entry.Frame) Display.lineGapHeight = AdjustableLineGapHeight;
    Back?.setLocation(InOverworld(OverlayBack(Layout.Row[Index].Location, Layout.Facing)));
    Display.setLocation(InOverworld(Layout.Row[Index].Location));
  });
  BrowserHeader?.Heading.setLocation(InOverworld(Layout.Heading));
  BrowserHeader?.Title.setLocation(InOverworld(Layout.Title));
  if (AnimationDisplays) {
    const [Canvas, Copy] = Layout.AnimationCases;
    AnimationDisplays.Fireflies.lineGapHeight = AdjustableLineGapHeight;
    AnimationDisplays.Fireflies.setLocation(InOverworld(Canvas.Display));
    AnimationDisplays.A.setLocation(InOverworld(Copy.Display));
    AnimationDisplays.B.setLocation(InOverworld(MiddleLocation({ GlyphOnly: true }, Copy.Display, Layout.Facing)));
    AnimationDisplays.Title.setLocation(InOverworld(Copy.Title));
    MoveRegions(AnimationDisplays.Regions, { GlyphOnly: true }, Copy.Display, Layout.Facing);
  }
  if (PixelSize2 === BackPixelSize) return;
  BackPixelSize = PixelSize2;
  BackDisplays.forEach(({ Display, Reference, Title }, Index) => {
    Display.setLocation(InOverworld(Layout.BackCases[Index].Display));
    Reference.setLocation(InOverworld(Layout.BackCases[Index].Reference));
    Title.setLocation(InOverworld(Layout.BackCases[Index].Title));
  });
  OffsetDisplays.forEach(({ Back, Display, Entry, Middle, Regions, Title }, Index) => {
    Back?.setLocation(InOverworld(OverlayBack(Layout.OffsetCases[Index].Display, Layout.OffsetFacing)));
    Middle?.setLocation(InOverworld(MiddleLocation(Entry, Layout.OffsetCases[Index].Display, Layout.OffsetFacing)));
    Display.setLocation(InOverworld(Layout.OffsetCases[Index].Display));
    Title.setLocation(InOverworld(Layout.OffsetCases[Index].Title));
    MoveRegions(Regions, Entry, Layout.OffsetCases[Index].Display, Layout.OffsetFacing);
  });
}
function ShowSelectedCharacter(CodePoint) {
  let Character2 = " ";
  if (CodePoint === 0) Character2 = DisplayCharacter(0);
  else if (CodePoint !== void 0) Character2 = String.fromCodePoint(CodePoint);
  SelectedText = `ab${Character2}rl`;
  try {
    for (const { Display, Entry } of GalleryDisplays) if (Entry.Selected) Display.setText(SelectedText);
    RefreshGallery();
  } catch (Error3) {
    console.error(`Selected character: ${Error3?.stack ?? Error3}`);
  }
}
function ShowBrowserPage(Index) {
  BrowserPage = (Index % PageCount + PageCount) % PageCount;
  try {
    for (const { Display, Entry } of GalleryDisplays) if (Entry.Browser) Display.setText(PageText(BrowserPage));
    BrowserHeader?.Heading.setText(PageHeading(BrowserPage));
    RefreshGallery();
  } catch (Error3) {
    console.error(`Unicode browser: ${Error3?.stack ?? Error3}`);
  }
}
function Normalized(Degrees) {
  const Turned = (Degrees % 360 + 360) % 360;
  return Turned > 180 ? Turned - 360 : Turned;
}
function Yaw(Facing) {
  return Normalized(Facing * 180 / Math.PI);
}
function PlayerYaw(Facing) {
  return Normalized(-Facing * 180 / Math.PI);
}
function InOverworld(Location) {
  return { ...Location, dimension: world7.getDimension("overworld") };
}
function LogShapeDimensions(When) {
  const Counts = {};
  for (const Shape of world7.primitiveShapesManager.getShapes()) {
    let Id = "every dimension";
    try {
      Id = Shape.dimension?.id ?? Id;
    } catch {
    }
    Counts[Id] = (Counts[Id] ?? 0) + 1;
  }
  const Summary = Object.entries(Counts).map(([Id, Count]) => `${Id} ${Count}`).join(", ");
  console.warn(`PRIMITIVE_DIMENSIONS ${When}: ${Summary}`);
}
function AddText(Dimension, Location, Text2, Facing, {
  Animated = false,
  Background = Black3,
  Color = White3,
  Scale = RowScale
} = {}) {
  const Display = new TextPrimitive4({ ...Location, dimension: Dimension }, Text2);
  Display.useRotation = true;
  Display.rotation = { x: 0, y: Yaw(Facing), z: 0 };
  Display.depthTest = false;
  Display.scale = Scale;
  Display.color = Color;
  Display.textBackfaceVisible = false;
  Display.backfaceVisible = false;
  Display.lineGapHeight = Animated ? AdjustableLineGapHeight : 0;
  Display.backgroundColorOverride = Background;
  world7.primitiveShapesManager.addText(Display, Dimension);
  if (!Animated) {
    system6.runTimeout(() => {
      try {
        Display.setText(Display.text);
      } catch {
      }
    }, 5);
  }
  return Display;
}
function PlaceGallery(Dimension, Origin, Forward, Serial, Then, Attempt = 0) {
  if (Serial !== SpawnSerial) return;
  const Created = [];
  const Header = [];
  const Behind = [];
  const Across = [];
  let Animation;
  try {
    const Length2 = Math.hypot(Forward.x, Forward.z);
    const Looking = Math.atan2(Length2 > 1e-3 ? Forward.x : 0, Length2 > 1e-3 ? Forward.z : 1);
    const Facing = Math.round(Looking / (Math.PI / 2)) * (Math.PI / 2);
    const X = Math.floor(Origin.x + Math.sin(Facing) * GalleryDistance);
    const Z = Math.floor(Origin.z + Math.cos(Facing) * GalleryDistance);
    let Ground;
    for (let Y = Dimension.heightRange.max - 1; Y >= Dimension.heightRange.min; Y--) {
      const Block = Dimension.getBlock({ x: X, y: Y, z: Z });
      if (!Block) throw new Error("Spawn terrain is not loaded yet.");
      if (!Block.isAir) {
        Ground = Block;
        break;
      }
    }
    if (!Ground) throw new Error("Spawn terrain is not loaded yet.");
    const GroundTop = Ground.location.y + 1;
    const Flat = { x: Origin.x, z: Origin.z };
    const Placement = { Facing, GroundTop, Origin: Flat, ...GalleryAnchors(Flat, Facing, GroundTop) };
    const Layout = GalleryLayout(Placement);
    GalleryEntries.forEach((Entry, Index) => {
      const Location = Layout.Row[Index].Location;
      const Back = Entry.Back === void 0 ? void 0 : AddOverlayBack(Dimension, Location, Entry.Back, Layout.Facing);
      const Display = AddText(Dimension, Location, EntryText(Entry), Layout.Facing, {
        Animated: Boolean(Entry.Frame),
        Background: Back ? Clear : Black3,
        Color: Back ? OverlayColors.InkColor : Entry.Color ?? White3,
        Scale: Entry.Scale
      });
      if (Back) {
        Display.lineGapHeight = OverlayFrontGap;
        Display.depthTest = true;
      }
      Created.push({ Back, Display, Entry });
    });
    Header.push(AddText(Dimension, Layout.Heading, PageHeading(BrowserPage), Layout.Facing, { Scale: HeadingScale }));
    Header.push(AddText(Dimension, Layout.Title, BrowserTitle, Layout.Facing));
    BackEntries.forEach((Entry, Index) => {
      const Place = Layout.BackCases[Index];
      const Display = AddText(Dimension, Place.Display, Entry.Text, Layout.BackFacing);
      const Reference = AddText(
        Dimension,
        Place.Reference,
        Entry.Reference,
        Layout.BackFacing,
        { Background: Clear, Color: ReferencePurple }
      );
      const Title = AddText(Dimension, Place.Title, Entry.TitleText, Layout.BackFacing);
      Behind.push({ Display, Entry, Reference, Title });
    });
    OffsetEntries.forEach((Entry, Index) => {
      const Place = Layout.OffsetCases[Index];
      const Back = Entry.Back === void 0 ? void 0 : AddOverlayBack(Dimension, Place.Display, Entry.Back, Layout.OffsetFacing);
      const Turned = Layout.OffsetFacing;
      const Layered = Entry.Middle !== void 0;
      let Middle = Back && Layered ? AddMiddle(Dimension, Entry, Place.Display, Turned) : void 0;
      const Tinted = Entry.Overlaid || Entry.GlyphOnly;
      const Tint = Entry.Background ?? OverlayColors.Background;
      const Background = Back ? Clear : Tinted ? Tint : void 0;
      const Display = AddText(Dimension, Place.Display, Entry.Text, Turned, {
        ...Background ? { Background } : {},
        ...Back || Tinted ? { Color: OverlayColors.InkColor } : {},
        Scale: Entry.Scale
      });
      Display.lineGapHeight = Back ? OverlayFrontGap : Entry.LineGap ?? OffsetLineGap;
      if (Entry.GlyphOnly && Layered) {
        Middle = AddMiddle(Dimension, Entry, Place.Display, Turned);
      }
      if (Back || Middle) {
        Display.depthTest = true;
      }
      const Title = AddText(Dimension, Place.Title, Entry.TitleText, Layout.OffsetFacing);
      const Record2 = { Back, Display, Entry, Middle, Regions: [], Title };
      Across.push(Record2);
      Record2.Regions = AddRegions(Dimension, Entry, Place.Display, Turned);
    });
    {
      const [Canvas, Copy] = Layout.AnimationCases;
      const Seconds = system6.currentTick / 20;
      const Glyphs = GlyphOnly(BrailleCanvas(Seconds));
      const Fireflies = AddText(Dimension, Canvas.Display, BrailleFrame(Seconds), Layout.Facing, { Animated: true });
      const A = AddText(Dimension, Copy.Display, Glyphs.A, Layout.Facing, { Animated: true, Scale: RowScale / 2 });
      A.lineGapHeight = GlyphOnlyLineGap;
      A.depthTest = true;
      const B = AddText(
        Dimension,
        MiddleLocation({ GlyphOnly: true }, Copy.Display, Layout.Facing),
        Glyphs.B,
        Layout.Facing,
        { Animated: true, Background: Clear, Scale: RowScale / 2 }
      );
      B.lineGapHeight = GlyphOnlyLineGap;
      B.depthTest = true;
      Animation = { A, B, Fireflies, Regions: [], Title: AddText(Dimension, Copy.Title, FirefliesGlyphTitle, Layout.Facing) };
      Animation.Regions = AddRegions(Dimension, { ...AnimationEntries[1], GlyphOnly: true }, Copy.Display, Layout.Facing);
    }
    for (const { Back, Display } of GalleryDisplays) {
      Back?.remove();
      Display.remove();
    }
    BrowserHeader?.Heading.remove();
    BrowserHeader?.Title.remove();
    for (const Display of AnimationPrimitives(AnimationDisplays)) Display.remove();
    for (const { Display, Reference, Title } of BackDisplays) {
      Display.remove();
      Reference.remove();
      Title.remove();
    }
    for (const { Back, Display, Middle, Regions, Title } of OffsetDisplays) {
      Back?.remove();
      Middle?.remove();
      Display.remove();
      Title.remove();
      for (const { Display: Region } of Regions) Region.remove();
    }
    GalleryDisplays = Created;
    BrowserHeader = { Heading: Header[0], Title: Header[1] };
    BackDisplays = Behind;
    OffsetDisplays = Across;
    AnimationDisplays = Animation;
    BackPixelSize = PixelSize2;
    GalleryPlacement = Placement;
    const Span2 = Layout.Row.reduce((Sum, { Width }) => Sum + Width, 0) + 0.5 * (Layout.Row.length - 1);
    const Count = Created.length + Created.filter(({ Back }) => Back).length + Header.length + Behind.length * 3 + Across.length * 2 + Across.filter(({ Back }) => Back).length + Across.filter(({ Middle }) => Middle).length + Across.reduce((Sum, { Regions }) => Sum + Regions.length, 0) + AnimationPrimitives(Animation).length;
    const Degrees = (Facing * 180 / Math.PI).toFixed(1);
    console.warn(`CHARACTER_GALLERY_READY ${Count} TextPrimitives, row ${Span2.toFixed(1)} blocks, facing ${Degrees}\xB0`);
    LogShapeDimensions("after the gallery");
    try {
      PlaceTextureTest(Dimension, Layout.Row[BrowserIndex].Location, GroundTop);
    } catch (Error3) {
      console.error(`UI texture test: ${Error3?.stack ?? Error3}`);
    }
    try {
      ClearOrbitEntities(Dimension);
    } catch (Error3) {
      console.error(`Orbit entity cleanup: ${Error3?.stack ?? Error3}`);
    }
    Then?.();
  } catch (Error3) {
    for (const { Back, Display } of Created) {
      Back?.remove();
      Display.remove();
    }
    for (const Display of Header) Display.remove();
    for (const { Display, Reference, Title } of Behind) {
      Display.remove();
      Reference.remove();
      Title.remove();
    }
    for (const { Back, Display, Middle, Regions, Title } of Across) {
      Back?.remove();
      Middle?.remove();
      Display.remove();
      Title.remove();
      for (const { Display: Region } of Regions) Region.remove();
    }
    for (const Display of AnimationPrimitives(Animation)) Display.remove();
    if (Attempt < 30) system6.runTimeout(() => PlaceGallery(Dimension, Origin, Forward, Serial, Then, Attempt + 1), 10);
    else console.error(`Character gallery: ${Error3?.stack ?? Error3}`);
  }
}
async function OpenUnicodeForm(player) {
  if (OpenForms.has(player.id)) return;
  OpenForms.add(player.id);
  const Cleanup = [];
  try {
    const Shown = BrowserPage;
    const { Category } = Page(Shown);
    const form = new CustomForm(player, BrowserTitle);
    const Choice = new ObservableNumber3(Category, { clientWritable: true });
    const Column = new ObservableNumber3(0, { clientWritable: true });
    const Row = new ObservableNumber3(0, { clientWritable: true });
    const Details = new ObservableString2("");
    const Update = (FromSlider) => {
      const X = Math.round(Column.getData());
      const Y = Math.round(Row.getData());
      const CodePoint = CodePointAt(BrowserPage, X, Y);
      Details.setData(CodePoint === void 0 ? `No character at (${X}, ${Y}): this page has ${PageRowCount(BrowserPage)} row(s).` : `(${X}, ${Y})
${DescribeCharacter(CodePoint)}`);
      if (FromSlider) ShowSelectedCharacter(CodePoint);
    };
    const OnChoice = Choice.subscribe((Value) => {
      if (!Number.isInteger(Value) || Value === Category || Value < 0 || Value >= Categories.length) return;
      form.close();
      ShowBrowserPage(FirstPageOf(Value));
    });
    const OnColumn = Column.subscribe(() => Update(true));
    const OnRow = Row.subscribe(() => Update(true));
    Cleanup.push(() => Choice.unsubscribe(OnChoice), () => Column.unsubscribe(OnColumn), () => Row.unsubscribe(OnRow));
    Update(false);
    form.dropdown("Category", Choice, Categories.map((Entry, Index) => ({
      label: `${Entry.Name} (${Hex(Entry.First)}\u2013${Hex(Entry.Last)})`,
      value: Index
    })));
    form.slider("X: column, 0 at the left", Column, 0, PageColumns - 1, { step: 1 });
    form.slider("Y: row, 0 at the top", Row, 0, Math.max(1, PageRowCount(Shown) - 1), { step: 1 });
    form.label(Details);
    form.button("Close", () => form.close());
    await form.show();
  } catch (error) {
    if (error?.name === "PlayerLeftError") return;
    console.error(`Unicode browser form: ${String(error)}
${error?.stack ?? ""}`);
    if (player.isValid) player.sendMessage(`Unable to open the Unicode browser form: ${error}`);
  } finally {
    for (const Dispose of Cleanup) Dispose();
    OpenForms.delete(player.id);
  }
}
function TurnPage(player) {
  const Last = LastTurn.get(player.id);
  if (Last !== void 0 && system6.currentTick - Last < 4) return;
  LastTurn.set(player.id, system6.currentTick);
  ShowBrowserPage(BrowserPage + (player.isSneaking ? -1 : 1));
  player.onScreenDisplay.setActionBar(PageHeading(BrowserPage));
}
async function OpenLineGapForm(player) {
  if (OpenForms.has(player.id)) return;
  OpenForms.add(player.id);
  try {
    const form = new CustomForm(player, "Display settings");
    const Gap = new ObservableNumber3(AdjustableLineGapHeight, { clientWritable: true });
    const Size = new ObservableNumber3(PixelSize2 * 1e3, { clientWritable: true });
    form.label("lineGapHeight applies to the two animated canvases.");
    form.slider("lineGapHeight", Gap, -20, 20, { step: 0.5 });
    form.label("Font pixel size calibrates the row: raise it if neighbors overlap, lower it if the gaps exceed half a block.");
    form.slider("Font pixel size (mm at scale 1)", Size, 5, 60, { step: 0.5 });
    form.button("Confirm", () => {
      AdjustableLineGapHeight = Gap.getData();
      PixelSize2 = Size.getData() / 1e3;
      RefreshGallery();
      console.warn(`DISPLAY_SETTINGS lineGapHeight ${AdjustableLineGapHeight} pixelSize ${PixelSize2}`);
      if (player.isValid) player.sendMessage(`lineGapHeight ${AdjustableLineGapHeight}; font pixel size ${Size.getData()} mm.`);
      form.close();
    });
    await form.show();
  } catch (error) {
    if (error?.name === "PlayerLeftError") return;
    console.error(`Display settings form: ${String(error)}
${error?.stack ?? ""}`);
    if (player.isValid) player.sendMessage(`Unable to open display settings: ${error}`);
  } finally {
    OpenForms.delete(player.id);
  }
}
var WrittenTexts = /* @__PURE__ */ new Map();
var LastWrite = /* @__PURE__ */ new Map();
var WriterLines = 6;
var WritingDistance = 3;
function PlaceWrittenText(player, Text2) {
  if (Text2.length === 0) {
    player.sendMessage("Nothing to show: the text was empty.");
    return;
  }
  const Bytes = LongestLineBytes(Text2);
  if (Bytes > LineByteLimit) {
    player.sendMessage(`That line is ${Bytes} UTF-8 bytes; a TextPrimitive line holds at most ${LineByteLimit}.`);
    return;
  }
  const View = player.getViewDirection();
  const Length2 = Math.hypot(View.x, View.z);
  const Facing = Math.atan2(Length2 > 1e-3 ? View.x : 0, Length2 > 1e-3 ? View.z : 1);
  const Eyes = player.getHeadLocation();
  const Location = {
    x: Eyes.x + Math.sin(Facing) * WritingDistance,
    y: Eyes.y,
    z: Eyes.z + Math.cos(Facing) * WritingDistance
  };
  WrittenTexts.set(player.id, AddText(player.dimension, Location, Text2, Facing));
  console.warn(`WRITTEN_TEXT ${JSON.stringify(Text2)}`);
}
async function UseTextWriter(player) {
  const Last = LastWrite.get(player.id);
  if (Last !== void 0 && system6.currentTick - Last < 4) return;
  LastWrite.set(player.id, system6.currentTick);
  const Existing = WrittenTexts.get(player.id);
  if (Existing) {
    WrittenTexts.delete(player.id);
    try {
      Existing.remove();
    } catch {
    }
    return;
  }
  if (OpenForms.has(player.id)) return;
  OpenForms.add(player.id);
  try {
    const form = new CustomForm(player, "Text Writer");
    const Lines = Array.from({ length: WriterLines }, () => new ObservableString2("", { clientWritable: true }));
    let Confirmed = false;
    Lines.forEach((Line, Index) => form.textField(`Line ${Index + 1}`, Line));
    form.button("Confirm", () => {
      Confirmed = true;
      form.close();
    });
    form.button("Cancel", () => form.close());
    await form.show();
    if (!Confirmed || !player.isValid) return;
    const Text2 = Lines.map((Line) => Line.getData());
    while (Text2.length > 0 && Text2[Text2.length - 1] === "") Text2.pop();
    PlaceWrittenText(player, Text2.join("\n"));
  } catch (error) {
    if (error?.name === "PlayerLeftError") return;
    console.error(`Text writer form: ${String(error)}
${error?.stack ?? ""}`);
    if (player.isValid) player.sendMessage(`Unable to open the text writer: ${error}`);
  } finally {
    OpenForms.delete(player.id);
  }
}
function GiveHotbarItem(player, Inventory, TypeId4, Preferred) {
  let Slot = -1;
  for (let Index = 0; Index < Inventory.size; Index++) {
    if (Inventory.getItem(Index)?.typeId === TypeId4) {
      Slot = Index;
      break;
    }
  }
  if (Slot < 0) {
    const Item = new ItemStack(TypeId4);
    Item.keepOnDeath = true;
    const Previous = Inventory.getItem(Preferred);
    if (Previous) {
      let Empty = -1;
      for (let Index = 0; Index < Inventory.size; Index++) {
        if (Index !== Preferred && !Inventory.getItem(Index)) {
          Empty = Index;
          break;
        }
      }
      if (Empty < 0) player.dimension.spawnItem(Previous, player.location);
      else Inventory.setItem(Empty, Previous);
    }
    Inventory.setItem(Preferred, Item);
    return Preferred;
  }
  if (Slot > 8) {
    const Previous = Inventory.getItem(Preferred);
    Inventory.setItem(Preferred, Inventory.getItem(Slot));
    Inventory.setItem(Slot, Previous);
    return Preferred;
  }
  return Slot;
}
function RemoveItem(Inventory, TypeId4) {
  for (let Index = 0; Index < Inventory.size; Index++) {
    if (Inventory.getItem(Index)?.typeId === TypeId4) Inventory.setItem(Index, void 0);
  }
}
function RegisterUse(Registry, Name, Action) {
  const Handler = ({ source }) => {
    if (source instanceof Player) system6.run(() => void Action(source));
  };
  Registry.registerCustomComponent(Name, { onUse: Handler, onUseOn: Handler });
}
function RegisterTravel(Registry, Name, Description, Travel) {
  Registry.registerCommand({
    cheatsRequired: false,
    description: Description,
    name: Name,
    permissionLevel: CommandPermissionLevel.Any
  }, ({ sourceEntity }) => {
    if (!(sourceEntity instanceof Player)) {
      return { message: "Only a player can travel.", status: CustomCommandStatus.Failure };
    }
    system6.run(() => Travel(sourceEntity));
    return { status: CustomCommandStatus.Success };
  });
}
system6.beforeEvents.startup.subscribe(({ customCommandRegistry, itemComponentRegistry }) => {
  RegisterUse(itemComponentRegistry, "ddui_demo:open_line_gap_form", OpenLineGapForm);
  RegisterUse(itemComponentRegistry, "ddui_demo:open_form", OpenUnicodeForm);
  RegisterUse(itemComponentRegistry, "ddui_demo:turn_unicode_page", TurnPage);
  RegisterUse(itemComponentRegistry, "ddui_demo:write_text", UseTextWriter);
  RegisterTravel(
    customCommandRegistry,
    Command.Flat,
    "Go to the flat dimension's TextPrimitive movement tests.",
    MoveToFlat
  );
  RegisterTravel(
    customCommandRegistry,
    Command.Gallery,
    "Go back to the character gallery.",
    TeleportToBrowser
  );
});
var GalleryOrigin = Object.freeze({ x: 0, z: 0 });
var GallerySouth = Object.freeze({ x: 0, y: 0, z: 1 });
var ViewingDistance = 4;
var AwaitingGallery = /* @__PURE__ */ new Map();
var GalleryRequested = false;
function TeleportToBrowser(player) {
  if (!GalleryPlacement || !player.isValid) return;
  const Layout = GalleryLayout(GalleryPlacement);
  const Page2 = Layout.Row[BrowserIndex].Location;
  const Feet = {
    x: Page2.x - Math.sin(Layout.Facing) * ViewingDistance,
    y: GalleryPlacement.GroundTop,
    z: Page2.z - Math.cos(Layout.Facing) * ViewingDistance
  };
  const Pitch = -Math.atan2(Page2.y - (Feet.y + 1.62), ViewingDistance) * 180 / Math.PI;
  player.teleport(Feet, { dimension: world7.getDimension("overworld"), rotation: { x: Pitch, y: PlayerYaw(Layout.Facing) } });
}
world7.afterEvents.playerSpawn.subscribe(({ initialSpawn, player }) => {
  system6.run(() => {
    if (!player.isValid) return;
    const Arrive = initialSpawn ? MoveToFlat : TeleportToBrowser;
    if (GalleryPlacement) Arrive(player);
    else {
      AwaitingGallery.set(player, Arrive);
      if (!GalleryRequested) {
        GalleryRequested = true;
        const Overworld = world7.getDimension("overworld");
        player.teleport({ x: GalleryOrigin.x + 0.5, y: -60, z: GalleryOrigin.z + 0.5 }, { dimension: Overworld });
        PlaceGallery(Overworld, GalleryOrigin, GallerySouth, ++SpawnSerial, () => {
          for (const [Waiting2, Then] of AwaitingGallery) Then(Waiting2);
          AwaitingGallery.clear();
        });
      }
    }
    const Inventory = player.getComponent("minecraft:inventory")?.container;
    if (!Inventory) return;
    RemoveItem(Inventory, LineGapTool);
    GiveHotbarItem(player, Inventory, Compass, 0);
    GiveHotbarItem(player, Inventory, PageTurner, 1);
    GiveHotbarItem(player, Inventory, TextWriter, 2);
    player.selectedSlotIndex = GiveHotbarItem(player, Inventory, Compass, 0);
    player.sendMessage("Compass: inspect a character on the Unicode browser page. Page turner: next page; sneak to go back. Text writer: show text in front of you; use again to remove it.");
    player.sendMessage(
      `/${Command.Flat}: the flat dimension's movement tests. /${Command.Gallery}: back to the gallery.`
    );
  });
});
var FlatTestCenter = Object.freeze({ x: 0.5, z: 10.5 });
world7.afterEvents.worldLoad.subscribe(() => {
  PrepareFlatDimension().catch((Error3) => console.error(`Flat dimension: ${Error3?.stack ?? Error3}`));
  WhenFlatReady(() => {
    try {
      PlaceOrbitTests(FlatDimension(), FlatTestCenter, 0, Yaw(0), FlatGroundTop());
    } catch (Error3) {
      console.error(`Movement tests: ${Error3?.stack ?? Error3}`);
    }
    try {
      PlaceHopTest(FlatDimension(), FlatTestCenter, 0, Yaw(0), FlatGroundTop());
    } catch (Error3) {
      console.error(`Hop test: ${Error3?.stack ?? Error3}`);
    }
    LogShapeDimensions("after the movement tests");
  });
});
RegisterGlyphProbe(() => !GalleryPlacement, TeleportToBrowser);
world7.afterEvents.worldLoad.subscribe(() => {
  world7.setDefaultSpawnLocation({ x: 0, y: -60, z: 0 });
  world7.setTimeOfDay(6e3);
  world7.gameRules.doDayLightCycle = false;
  world7.gameRules.doWeatherCycle = false;
  world7.gameRules.doMobSpawning = false;
  console.warn("TRANSACTIONAL_DEMO_READY 1.1.82");
});
/**
 * Identity of the Bedform Common resource pack, which supplies native DDUI artwork.
 *
 * @module bedform/Internal/CommonResourcePack
 *
 * @file      CommonResourcePack.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
/**
 * Shared native direction-preview asset names and signed-axis ordering.
 *
 * @module bedform/Internal/DirectionPreview
 *
 * @file      DirectionPreview.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
/**
 * Per-form registry of value-bearing inputs, so form components can observe
 * and rewrite every input a form holds, including inputs added after them.
 *
 * @module bedform/Internal/FormInputs
 *
 * @file      FormInputs.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
/**
 * The `Pipeable` module defines the shared interface and implementation helpers
 * for values that support Effect-style method chaining with `.pipe(...)`.
 *
 * A `Pipeable` value can pass itself through a sequence of unary functions from
 * left to right, so code can be written as `value.pipe(f, g, h)` instead of
 * deeply nesting calls. This is the method form used by many Effect data types
 * to compose transformations, validations, and effectful operations while
 * keeping the original value as the starting point of the pipeline.
 *
 * @module @bedform/effect/Pipeable
 *
 * @file      Pipeable.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
/**
 * Provides small helpers for defining and reusing TypeScript functions.
 *
 * The main helpers are `pipe` and `flow` for left-to-right composition and
 * `dual` for APIs that support both direct and pipe-friendly call styles. The
 * module also contains small identity, constant, tuple, type-level, and
 * memoization helpers used across the library.
 *
 * Function composition, dual call styles, type helpers, and object memoization.
 *
 * @module @bedform/effect/Function
 *
 * @file      Function.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
/**
 * Internal record construction, traversal and transformation operations.
 *
 * @module @bedform/effect/Internal/record
 *
 * @file      record.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
/**
 * Defines runtime checks for values.
 *
 * A `Predicate<A>` returns `true` or `false` for an `A`. A
 * `Refinement<A, B>` is a predicate that also narrows the TypeScript type when
 * it succeeds. This module includes guards for common JavaScript values,
 * property and tag checks, tuple and struct checks, boolean combinators, and
 * helpers for composing predicates and refinements.
 *
 * @module @bedform/effect/Predicate
 *
 * @file      Predicate.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
/**
 * Internal hashing state and value hash calculations.
 *
 * @module @bedform/effect/Internal/hash
 *
 * @file      hash.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
/**
 * Internal structural equality protocols and comparisons.
 *
 * @module @bedform/effect/Internal/equal
 *
 * @file      equal.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
/**
 * Computes Effect hash values and defines the interface for objects that want
 * to provide their own hash implementation. Hashes are small numeric
 * fingerprints used by Effect data structures to bucket values quickly; they
 * are not cryptographic digests and they are not proof that two values are
 * equal. The module also includes helpers for primitive, structure, array, and
 * reference-based hashes, plus functions for combining and optimizing numeric
 * hash values.
 *
 * @module @bedform/effect/Hash
 *
 * @file      Hash.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
/**
 * Compares values with Effect's structural equality rules.
 *
 * `equals` compares primitives, arrays, plain objects, maps, sets, dates,
 * regular expressions, and values that implement the `Equal` interface. This
 * module also defines the equality symbol, guards, adapters, map and set
 * comparison builders, and helpers for marking objects that should compare only
 * by reference.
 *
 * @module @bedform/effect/Equal
 *
 * @file      Equal.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
/**
 * Context-aware redaction for sensitive values.
 *
 * The `Redactable` module provides a protocol for objects that need to present
 * alternative representations of themselves depending on the runtime context.
 * Typical use cases include masking secrets, tokens, or personal data in logs, traces,
 * and serialized output.
 *
 * @module @bedform/effect/Redactable
 *
 * @file      Redactable.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
/**
 * Formats JavaScript values into readable strings.
 *
 * `format` is intended for logs, diagnostics, and error messages. It handles
 * primitives, objects, arrays, dates, regular expressions, maps, sets, class
 * instances, errors, circular references, and redactable values. `formatJson`
 * wraps JSON formatting with redaction and circular-reference handling, and the
 * module also includes helpers for property keys, paths, and dates.
 *
 * @module @bedform/effect/Formatter
 *
 * @file      Formatter.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
/**
 * Controls how values appear in logs and debugging output.
 *
 * Effect data types use `Inspectable` to provide stable string, JSON, and
 * Node.js inspection output. This keeps custom values readable in logs, REPLs,
 * test failures, and diagnostics. This module defines the Node inspect symbol,
 * the `Inspectable` interface, safe conversion helpers, and shared prototype or
 * class implementations for custom values.
 *
 * @module @bedform/effect/Inspectable
 *
 * @file      Inspectable.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
/**
 * Internal stack trace limit management.
 *
 * @module @bedform/effect/Internal/stackTraceLimit
 *
 * @file      stackTraceLimit.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
/**
 * Internal and advanced utilities used by Effect's generator-based syntax and
 * higher-kinded type support. This is not a general-purpose utility module for
 * application code.
 *
 * `SingleShotGen` makes an Effect-style value work with `yield*` inside
 * generator helpers. `Variance` and `Gen` provide the type-level signatures
 * used by modules such as `Effect`, `Option`, and `Result` to type their
 * `gen` APIs.
 *
 * @module @bedform/effect/Utils
 *
 * @file      Utils.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
/**
 * The core of the Effect runtime: the effect, exit and cause protocols and
 * prototypes, continuation markers, primitive effect constructors, and cause
 * construction and combination. Ported from Effect 4.0.5.
 *
 * @module @bedform/effect/Internal/core
 *
 * @file      core.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
/**
 * Defines reusable rules for merging two values of the same type.
 *
 * A `Combiner<A>` contains one operation, `combine(self, that)`, which returns
 * the merged value. It does not define an initial value for reducing a
 * collection; use a `Reducer` when you need that. This module includes the
 * `Combiner` interface, a constructor for custom combining logic, and common
 * combiners for choosing or ordering values.
 *
 * @module @bedform/effect/Combiner
 *
 * @file      Combiner.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
/**
 * Reusable strategies for reducing many values into one value. A `Reducer<A>`
 * extends `Combiner.Combiner` with an `initialValue` for empty collections and
 * a `combineAll` method for folding an entire iterable. This module provides a
 * constructor for reducers and a helper for reversing the order in which values
 * are combined.
 *
 * @module @bedform/effect/Reducer
 *
 * @file      Reducer.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
/**
 * Defines reusable equality functions for values of the same type.
 *
 * An `Equivalence<A>` returns `true` when two `A` values should be treated as
 * the same for a particular purpose. This module includes strict equality
 * instances for primitive types, constructors for custom comparisons, and
 * helpers for tuples, arrays, structs, records, dates, and values compared
 * through a derived field.
 *
 * @module @bedform/effect/Equivalence
 *
 * @file      Equivalence.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
/**
 * Internal named binding and do-notation composition.
 *
 * @module @bedform/effect/Internal/doNotation
 *
 * @file      doNotation.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
/**
 * Internal optional-value representations and option operations.
 *
 * @module @bedform/effect/Internal/option
 *
 * @file      option.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
/**
 * Defines comparison functions for ordered values.
 *
 * An `Order<A>` compares two `A` values and returns whether the first is less
 * than, equal to, or greater than the second. Orders are used for sorting,
 * choosing minimum or maximum values, checking ranges, and building ordered data
 * structures. This module includes built-in orders, constructors for custom
 * orders, tools for reversing and combining comparisons, tuple and struct
 * helpers, comparison predicates, clamping, and reducer support.
 *
 * @module @bedform/effect/Order
 *
 * @file      Order.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
/**
 * Internal success and failure representations and result operations.
 *
 * @module @bedform/effect/Internal/result
 *
 * @file      result.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
/**
 * Models a value that may be present or absent.
 *
 * An `Option<A>` is `Some<A>` when a value is available and `None` when it is
 * not. This lets code handle missing values explicitly instead of relying on
 * `null` or `undefined`. The module includes helpers for creating, checking,
 * transforming, combining, and extracting optional values, plus conversions to
 * and from common nullable or result-like shapes. It also includes `Option.gen`
 * for writing small generator-based computations that stop at the first `None`.
 *
 * @module @bedform/effect/Option
 *
 * @file      Option.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
/**
 * Works with plain TypeScript objects, also called structs.
 *
 * The runtime helpers in this module create new objects instead of mutating
 * their inputs. They cover common object workflows such as reading properties,
 * listing typed keys, picking or omitting fields, assigning and renaming keys,
 * transforming values, deriving comparison helpers, and creating records from a
 * list of keys. The module also includes type-level helpers for simplifying and
 * merging object shapes.
 *
 * @module @bedform/effect/Struct
 *
 * @file      Struct.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
/**
 * A self-contained port of Effect utilities for Bedrock Dedicated Server.
 *
 * @module @bedform/effect/index
 *
 * @file      index.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
/**
 * Native direction dropdowns with contextual labels and pixelated signed-axis previews.
 *
 * @module bedform/DDUI/Direction
 *
 * @file      Direction.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
/**
 * Texture paths and translation keys of the transactional undo/redo/reset
 * component, shared by its runtime and by the Bedform Common pack builder.
 *
 * @module bedform/Internal/TransactionalAssets
 *
 * @file      TransactionalAssets.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
/**
 * Pure chunked undo/redo history over tracked form inputs, with an undoable
 * reset to every input's initial value and an injectable clock for tests.
 *
 * @module bedform/Internal/TransactionHistory
 *
 * @file      TransactionHistory.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
/**
 * Undo, redo and optional reset buttons for a CustomForm, recording edits to
 * the form's inputs in chunks so one undo reverses one meaningful edit.
 *
 * @module bedform/DDUI/Transactional
 *
 * @file      Transactional.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
/**
 * This module provides a subclass of `@minecraft/server-ui`'s `CustomForm`,
 * with builder methods for the DDUI components provided by `bedform/DDUI`.
 *
 * @module bedform/DDUI/CustomForm
 *
 * @file      CustomForm.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
/**
 * Unicode ranges and labeled grids for the spawn character gallery.
 *
 * @module @sorrell/ddui-image-demo/Source/CharacterSets
 *
 * @file      CharacterSets.js
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
/**
 * Characters of the Bedrock client's large bitmap font with their advance
 * widths, and the advance width of every Basic Multilingual Plane character
 * in its smaller Unicode font, in font pixels including the 1-pixel gap after
 * each glyph.
 *
 * This module is auto-generated by Tool/GlyphWidths.mjs.
 *
 * @module @sorrell/ddui-image-demo/Source/GlyphWidths
 *
 * @file      GlyphWidths.js
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
/**
 * Estimated TextPrimitive extents and the single-row gallery layout, with
 * neighbors a fixed distance apart edge to edge.
 *
 * @module @sorrell/ddui-image-demo/Source/Layout
 *
 * @file      Layout.js
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
/**
 * Unicode 18.0.0 character data for the Unicode browser: blocks, names,
 * general category, bidi class, script, age and simple case mappings.
 *
 * This module is auto-generated by Tool/UnicodeData.mjs.
 *
 * @module @sorrell/ddui-image-demo/Source/UnicodeData
 *
 * @file      UnicodeData.js
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
/**
 * Unicode browser model: pages of code points grouped by block, page text and
 * headings, and lookup-site style details for a single character.
 *
 * @module @sorrell/ddui-image-demo/Source/UnicodeBrowser
 *
 * @file      UnicodeBrowser.js
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
/**
 * Multi-line tests of characters that might render oddly beside other text:
 * blanks of unusual width, zero-width and direction characters, fillers and
 * controls, combining marks, glyphs that reach above, below or beyond their
 * line, formatting codes and the sixteenth block characters. Each case is its
 * own display, and no Latin letter appears twice in one case.
 *
 * @module @sorrell/ddui-image-demo/Source/OddCharacters
 *
 * @file      OddCharacters.js
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
/**
 * The Symbols for Legacy Computing block (U+1FB00 to U+1FBFF) and its
 * supplement (U+1CC00 to U+1CEBF) as custom glyphs. The client has glyph
 * pages only for the Basic Multilingual Plane, so each character with a
 * glyph has a Private Use Area stand-in. Since 1.1.79 the stand-ins are packed
 * with no gaps from `GlyphBase`, U+E200, the first code point the vanilla
 * font leaves free: the block's glyphs in code point order, the four sextant
 * completers, the supplement's glyphs and the 26 octant completers, 913 cell
 * glyphs, then their wide copies. Unassigned and dropped code points take no
 * slot. Each narrow glyph is a 7 by 16 cell for the overlays of
 * Source/GlyphOverlay.js. Source/MinecraftTen.js and Source/Octant.js continue
 * the sequence after `CellGlyphEnd`.
 *
 * @module @sorrell/ddui-image-demo/Source/LegacyComputing
 *
 * @file      LegacyComputing.js
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
/**
 * What every custom glyph shares: its advance, and which code points are
 * custom glyphs. The demo's custom glyphs are the cell glyphs: stand-ins for
 * the Symbols for Legacy Computing characters and the glyphs that complete
 * the sextants. Page E2, with the first test glyph (a custom A) and the
 * alpha tests, was removed in 1.1.76.
 *
 * The client draws every texel of a Private Use Area page as one large-font
 * pixel, twice a Unicode-font pixel, whatever the page's resolution or the
 * glyph's ink, with the cell centered on its line (tested in 1.1.38 to
 * 1.1.40). At half a display's scale, a glyph therefore matches the Unicode
 * font exactly; Source/GlyphOverlay.js draws them that way.
 *
 * @module @sorrell/ddui-image-demo/Source/CustomGlyph
 *
 * @file      CustomGlyph.js
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
/**
 * Advances of the Minecraft Ten stand-ins, in their own pixels: one character
 * per code from U+0020 to U+007E, its code minus 48 the advance (0 for the
 * lowercase letters, which have no stand-in).
 *
 * This module is auto-generated by Tool/CustomGlyph.mjs.
 *
 * @module @sorrell/ddui-image-demo/Source/MinecraftTenWidths
 *
 * @file      MinecraftTenWidths.js
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
/**
 * Minecraft Ten, the game's heading font, as custom glyphs: the printable
 * ASCII characters other than the lowercase letters (Minecraft Ten draws
 * those with its capitals' outlines), each with a Private Use Area stand-in,
 * drawn pixel for pixel from the font by Tool/MinecraftTen.mjs. The 69
 * stand-ins follow the cell glyphs' wide copies with no gaps, in code order
 * with the lowercase letters skipped (since 1.1.79). Each glyph's
 * advance is its ink width plus 1 pixel, by the client's rule; the space,
 * which has no ink, is 3 pixels wide by two pixels at alpha 1.
 *
 * @module @sorrell/ddui-image-demo/Source/MinecraftTen
 *
 * @file      MinecraftTen.js
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
/**
 * Octant cell glyphs for glyph-only displays: every 2 by 4 pattern of
 * blocks, drawn 8 columns wide like the seamless layers' wide glyphs, in the
 * overlays' dark gray, after the Minecraft Ten stand-ins. A Braille
 * character's eight dots map one to one onto an octant's eight blocks, so
 * Braille art can be shown with solid,
 * seamless cells instead of dots.
 *
 * @module @sorrell/ddui-image-demo/Source/Octant
 *
 * @file      Octant.js
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
/**
 * Custom glyphs at the Unicode font's resolution, by layering two or three
 * TextPrimitives at one location: the Symbols for Legacy Computing
 * stand-ins. Seamless overlays add a third layer between the two
 * described below, and glyph-only text needs no front at all (see
 * `SplitOverlay` and `GlyphOnly`). The back one, at half scale with the black
 * background, draws the custom glyphs, whose pixels are large-font pixels and
 * so come out the Unicode font's size; everything else on it is the front's
 * text doubled, in black on black, which only places the glyphs. The front
 * one, at full scale with a
 * transparent background, draws the text itself, with a space where each
 * custom glyph goes. Created first, the back is drawn first.
 *
 * Lines are centered, so the back line must also have the front line's
 * width; mirroring the front gives it that exactly (1.1.44: computing the
 * back from estimated advances put the second test line's glyphs off). The
 * back's lines are spaced and placed a little differently from the front's;
 * see `OverlayDrop` and `OverlayBackGap` in Main.js.
 *
 * @module @sorrell/ddui-image-demo/Source/GlyphOverlay
 *
 * @file      GlyphOverlay.js
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
/**
 * Tests of sub-glyph horizontal offsets in a TextPrimitive: invisible padding
 * of slightly different widths moves a bar between two fixed brackets, one
 * font pixel (bold spaces) or half a pixel (braille blanks) per line. A third
 * test tries ways to switch a line to the smaller Unicode font.
 *
 * @module @sorrell/ddui-image-demo/Source/PixelOffsets
 *
 * @file      PixelOffsets.js
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
/**
 * Narrow octant patterns, bit 2 * row + column, reusing supplement stand-ins.
 *
 * This module is auto-generated by Tool/CustomGlyph.mjs.
 *
 * @module @sorrell/ddui-image-demo/RegionGlyphs
 *
 * @file      RegionGlyphs.js
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
/**
 * Pictures in bounded cell rectangles at an integer multiple of a host's resolution.
 *
 * @module @sorrell/ddui-image-demo/RegionLayer
 *
 * @file      RegionLayer.js
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
/**
 * The plan of the glyph width measurement, shared by the behavior pack, which
 * shows it, and Tool/MeasureGlyphs.mjs, which photographs and reads it: the
 * characters measured, how they are split into batches of display columns,
 * and the text of each column.
 *
 * Each column is one TextPrimitive. Its first two lines are rulers of 2 and 8
 * copies of U+2589, whose ink is a solid block 14 font pixels wide, giving the
 * screen scale. The third is the reference `[ǀ]`, and every further line is
 * `[ǀ`, 8 copies of one measured character in white, and `]`. The brackets
 * and the U+01C0 trigger, which puts every line in the Unicode font, are in
 * the batch's marker color, so the distance between the brackets less the
 * reference's is 8 advances of the measured character.
 *
 * @module @sorrell/ddui-image-demo/Source/GlyphProbePlan
 *
 * @file      GlyphProbePlan.js
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
/**
 * Identifiers the demo's scripts own, shared by the behavior pack and the
 * host-side tools.
 *
 * @module @sorrell/ddui-image-demo/Source/Keys
 *
 * @file      Keys.js
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
/**
 * In-game side of the glyph width measurement: shows each batch of
 * Source/GlyphProbePlan.js on a row of TextPrimitives in front of a fixed
 * camera, waits for Tool/MeasureGlyphs.mjs to photograph it, and shows the
 * progress and the estimated time left on the action bar. Driven by
 * `/scriptevent ddui_demo:glyph_probe start|next|stop` from the server console.
 *
 * @module @sorrell/ddui-image-demo/Source/GlyphProbe
 *
 * @file      GlyphProbe.js
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
/**
 * A test of user interface textures on the faces of world cuboids: four
 * custom blocks and, above them, four custom cube entities, each faced with
 * one vanilla texture by path: the main menu button
 * (textures/ui/button_borderless_light), a play screen button
 * (textures/gui/newgui/play_screen/NormalButtonThinNewBevel), the server list
 * icon (textures/ui/servers), and stone as a control. Blocks take their
 * textures through the terrain atlas (the resource pack's
 * textures/terrain_texture.json), entities directly by path. A texture the
 * client cannot load shows its missing-texture pattern instead.
 *
 * @module @sorrell/ddui-image-demo/Source/TextureTest
 *
 * @file      TextureTest.js
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
/**
 * Three ways to move a TextPrimitive around the same vertical circle, side by
 * side in one row: `setLocation` on the display every tick; `attachedTo` an
 * invisible carrier entity that the server steers by velocity, to see whether
 * attached text glides; and `attachedTo` a still entity whose model's root
 * bone loops in a client animation, which does not move attached text
 * (verified in 1.1.71).
 *
 * @module @sorrell/ddui-image-demo/AttachedOrbit
 *
 * @file      AttachedOrbit.js
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
/**
 * Two stone cubes side by side that hop 4 blocks up from 1 block above the
 * ground and fall back, forever: one launched by `applyImpulse` and pulled
 * down by the engine's gravity, the other still on the server while a client
 * animation of its model's bone draws the same flight, restarted with
 * `playAnimation` at every launch of the first.
 *
 * @module @sorrell/ddui-image-demo/HopTest
 *
 * @file      HopTest.js
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
/**
 * A custom flat grass dimension: registered at startup, generated as void by
 * the engine, and given a superflat-style floor by script, around its spawn
 * and around every player in it.
 *
 * @module @sorrell/ddui-image-demo/FlatDimension
 *
 * @file      FlatDimension.js
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
/**
 * A stone cube that each joining player carries in front of them, in the
 * manner of a held object in Amnesia: The Dark Descent. The cube is not fixed
 * to its place 2 blocks ahead of the player; a damped spring pulls its
 * velocity toward that place every tick, so it lags behind turns and starts,
 * swings past and settles back, and it stops at blocks it meets. Its yaw
 * follows the player's on a spring of its own.
 *
 * @module @sorrell/ddui-image-demo/HeldCube
 *
 * @file      HeldCube.js
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
/**
 * Terminal-style tables and a looping two-dimensional Braille wave animation.
 *
 * @module @sorrell/ddui-image-demo/Source/TerminalArt
 *
 * @file      TerminalArt.js
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
/**
 * Text display fixture: a Unicode browser and a row of TextPrimitive test
 * charts ahead of spawn, with a compass-launched DDUI character inspector.
 *
 * @module @sorrell/ddui-image-demo/Source/Main
 *
 * @file      Main.js
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
