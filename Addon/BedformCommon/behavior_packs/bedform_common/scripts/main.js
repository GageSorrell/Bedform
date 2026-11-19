var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// ../../Package/Bedform/Source/Internal/DiageticConfiguration.ts
var Builtin = Object.freeze({
  lever: "bedform:diagetic_lever",
  slider: "bedform:diagetic_slider",
  wheel: "bedform:diagetic_wheel"
});
var CheckValue = (value, limits) => {
  if (!Number.isFinite(value) || limits && (value < limits.Min || value > limits.Max)) {
    throw new RangeError("Diagetic value must be finite and within its limits");
  }
  return value;
};
var Parameter = (value, name, positive = false) => {
  if (!Number.isFinite(value) || (positive ? value <= 0 : value < 0)) {
    throw new RangeError(`Diagetic ${name} must be finite and ${positive ? "positive" : "nonnegative"}`);
  }
  return value;
};
var Identifier = (value) => {
  if (typeof value !== "string" || !/^[a-z0-9_]+:[a-z0-9_./-]+$/u.test(value)) {
    throw new TypeError("Diagetic entity and block types must be namespaced identifiers");
  }
  return value;
};
var Coordinates = (value) => {
  if (!value || ![value.x, value.y, value.z].every(Number.isFinite)) {
    throw new RangeError("Diagetic coordinates must be finite");
  }
  return Object.freeze({
    x: value.x,
    y: value.y,
    z: value.z
  });
};
var Binding = (value) => {
  if (!value) {
    return void 0;
  }
  if (typeof value.Dimension !== "string" || !value.Dimension.trim() || !["Up", "Down", "North", "South", "East", "West"].includes(value.Face)) {
    throw new TypeError("Diagetic binding requires a dimension and native block face");
  }
  const position = Coordinates(value.Position);
  if (![position.x, position.y, position.z].every(Number.isInteger)) {
    throw new RangeError("Diagetic support position must contain integer block coordinates");
  }
  return Object.freeze({
    Dimension: value.Dimension,
    Position: position,
    Face: value.Face,
    ExpectedBlockType: Identifier(value.ExpectedBlockType)
  });
};
var Configure = (input) => {
  if (!input || !Object.hasOwn(Builtin, input.Kind)) {
    throw new TypeError("Diagetic Kind must be lever, slider or wheel; buttons are unsupported");
  }
  const limits = input.Limits ?? (input.Kind === "wheel" ? void 0 : {
    Min: 0,
    Max: 1
  });
  if (limits && (!Number.isFinite(limits.Min) || !Number.isFinite(limits.Max) || limits.Min >= limits.Max)) {
    throw new RangeError("Diagetic limits require finite Min < Max");
  }
  const detents = input.Detents ?? (input.Kind === "lever" && limits ? [limits.Min, limits.Max] : []);
  if (!Array.isArray(detents)) {
    throw new TypeError("Diagetic detents must be an array");
  }
  for (const detent of detents) {
    CheckValue(detent, limits);
  }
  if (input.Spring) {
    CheckValue(input.Spring.Target, limits);
    Parameter(input.Spring.Strength, "spring strength");
  }
  for (const name of ["Eligible", "OnGrab", "OnChange", "OnRelease", "OnCancel"]) {
    if (input[name] !== void 0 && typeof input[name] !== "function") {
      throw new TypeError(`Diagetic ${name} must be a function`);
    }
  }
  const geometry = input.Kind === "lever" ? {
    ArcDegrees: Parameter(input.ArcDegrees ?? 90, "arc", true),
    ArmLength: Parameter(input.ArmLength ?? 0.375, "arm length", true)
  } : input.Kind === "slider" ? { Length: Parameter(input.Length ?? 0.5, "length", true) } : {
    Radius: Parameter(input.Radius ?? 0.25, "radius", true),
    DeadZone: Parameter(input.DeadZone ?? 0.05, "dead zone")
  };
  if (geometry.DeadZone !== void 0 && geometry.Radius !== void 0 && geometry.DeadZone >= geometry.Radius) {
    throw new RangeError("Diagetic dead zone must be smaller than the wheel radius");
  }
  return Object.freeze({
    ...input,
    ...geometry,
    EntityType: Identifier(input.EntityType ?? Builtin[input.Kind]),
    InitialValue: CheckValue(input.InitialValue ?? limits?.Min ?? 0, limits),
    Sensitivity: Parameter(input.Sensitivity ?? 1, "sensitivity"),
    Inertia: Parameter(input.Inertia ?? 1, "inertia", true),
    Damping: Parameter(input.Damping ?? 8, "damping"),
    Friction: Parameter(input.Friction ?? 0, "friction"),
    DriveStrength: Parameter(input.DriveStrength ?? 120, "drive strength", true),
    DetentStrength: Parameter(input.DetentStrength ?? 40, "detent strength"),
    InteractionRange: Parameter(input.InteractionRange ?? 3, "interaction range", true),
    Limits: limits && Object.freeze({
      Min: limits.Min,
      Max: limits.Max
    }),
    Detents: Object.freeze([...detents]),
    Spring: input.Spring && Object.freeze({
      Target: input.Spring.Target,
      Strength: input.Spring.Strength
    })
  });
};

// ../../Package/Bedform/Source/Diagetic/Simulation.ts
var StepSeconds = 0.05;
var Radians = Math.PI / 180;
var Degrees = 180 / Math.PI;
var GeometryEpsilon = 1e-8;
var Finite = (value) => {
  if (!Number.isFinite(value)) {
    throw new RangeError("Diagetic motion arithmetic must remain finite");
  }
  return value;
};
var Pair = (value) => {
  if (!value) {
    throw new RangeError("Diagetic motion requires finite pointer coordinates");
  }
  return Object.freeze({
    x: Finite(value.x),
    y: Finite(value.y)
  });
};
var Dot = (a, b) => {
  return Finite(a.x * b.x + a.y * b.y + a.z * b.z);
};
var Subtract = (a, b) => {
  return Coordinates({
    x: a.x - b.x,
    y: a.y - b.y,
    z: a.z - b.z
  });
};
var Basis = (right, up, normal) => {
  const cross = {
    x: right.y * up.z - right.z * up.y,
    y: right.z * up.x - right.x * up.z,
    z: right.x * up.y - right.y * up.x
  };
  if ([right, up, normal].some((axis) => Math.abs(Math.hypot(
    axis.x,
    axis.y,
    axis.z
  ) - 1) > 1e-6) || Math.abs(Dot(right, up)) > 1e-6 || Math.abs(Dot(right, normal)) > 1e-6 || Math.abs(Dot(up, normal)) > 1e-6 || Dot(cross, normal) < 1 - 1e-6) {
    throw new RangeError("Diagetic motion requires an orthonormal camera and mounting frame");
  }
};
var CopyFrame = (input) => {
  if (!input?.Camera || !input.Mount) {
    throw new RangeError("Diagetic motion requires camera and mount frames");
  }
  const Camera = Object.freeze({
    Position: Coordinates(input.Camera.Position),
    Right: Coordinates(input.Camera.Right),
    Up: Coordinates(input.Camera.Up),
    Forward: Coordinates(input.Camera.Forward)
  });
  const Mount = Object.freeze({
    Position: Coordinates(input.Mount.Position),
    Right: Coordinates(input.Mount.Right),
    Up: Coordinates(input.Mount.Up),
    Normal: Coordinates(input.Mount.Normal)
  });
  Basis(Camera.Right, Camera.Up, {
    x: -Camera.Forward.x,
    y: -Camera.Forward.y,
    z: -Camera.Forward.z
  });
  Basis(Mount.Right, Mount.Up, Mount.Normal);
  return Object.freeze({
    Camera,
    Mount
  });
};
var Screen = (frame, point) => {
  const { Camera, Mount } = frame;
  const world2 = Coordinates({
    x: Mount.Position.x + Mount.Right.x * point.x + Mount.Up.x * point.y,
    y: Mount.Position.y + Mount.Right.y * point.x + Mount.Up.y * point.y,
    z: Mount.Position.z + Mount.Right.z * point.x + Mount.Up.z * point.y
  });
  const offset = Subtract(world2, Camera.Position);
  const depth = Dot(offset, Camera.Forward);
  if (depth <= GeometryEpsilon) {
    throw new RangeError("Diagetic grab point must be in front of the frozen camera");
  }
  return Pair({
    x: Dot(offset, Camera.Right) / depth,
    y: Dot(offset, Camera.Up) / depth
  });
};
var Project = (frame, screen) => {
  const { Camera, Mount } = frame;
  const ray = Coordinates({
    x: Camera.Forward.x + Camera.Right.x * screen.x + Camera.Up.x * screen.y,
    y: Camera.Forward.y + Camera.Right.y * screen.x + Camera.Up.y * screen.y,
    z: Camera.Forward.z + Camera.Right.z * screen.x + Camera.Up.z * screen.y
  });
  const denominator = Dot(Mount.Normal, ray);
  if (Math.abs(denominator) <= GeometryEpsilon) {
    return void 0;
  }
  const t = Finite(Dot(Mount.Normal, Subtract(Mount.Position, Camera.Position)) / denominator);
  if (t <= GeometryEpsilon) {
    return void 0;
  }
  const offset = Coordinates({
    x: Camera.Position.x + ray.x * t - Mount.Position.x,
    y: Camera.Position.y + ray.y * t - Mount.Position.y,
    z: Camera.Position.z + ray.z * t - Mount.Position.z
  });
  return Pair({
    x: Dot(offset, Mount.Right),
    y: Dot(offset, Mount.Up)
  });
};
var Point = (policy, value) => {
  if (policy.Kind === "slider") {
    return Coordinates({
      x: ((value - policy.Limits.Min) / policy.Range - 0.5) * policy.Length,
      y: 0,
      z: 0
    });
  }
  const angle = policy.Kind === "wheel" ? value % 360 : Finite(((value - policy.Limits.Min) / policy.Range - 0.5) * policy.Arc) % 360;
  const radians = angle * Radians;
  return policy.Kind === "wheel" ? Coordinates({
    x: policy.Radius * Math.cos(radians),
    y: policy.Radius * Math.sin(radians),
    z: 0
  }) : Coordinates({
    x: policy.Arm * Math.sin(radians),
    y: policy.Arm * Math.cos(radians),
    z: 0
  });
};
var CrossesHub = (from, to, deadZone) => {
  const dx = Finite(to.x - from.x);
  const dy = Finite(to.y - from.y);
  const length = Finite(Math.hypot(dx, dy));
  if (length === 0) {
    return Math.hypot(from.x, from.y) <= deadZone;
  }
  const ux = dx / length;
  const uy = dy / length;
  const t = Math.max(0, Math.min(length, -Finite(from.x * ux + from.y * uy)));
  return Math.hypot(Finite(from.x + t * ux), Finite(from.y + t * uy)) <= deadZone;
};
var NumericPolicy = (config) => {
  return Object.freeze({
    Kind: config.Kind,
    Initial: config.InitialValue,
    Sensitivity: config.Sensitivity,
    Inertia: config.Inertia,
    Damping: config.Damping,
    Friction: config.Friction,
    DriveStrength: config.DriveStrength,
    DetentStrength: config.DetentStrength,
    Limits: config.Limits,
    Detents: config.Detents,
    Spring: config.Spring,
    Range: config.Limits ? Finite(config.Limits.Max - config.Limits.Min) : 360,
    Arc: config.Kind === "lever" ? config.ArcDegrees : 0,
    Arm: config.Kind === "lever" ? config.ArmLength : 0,
    Length: config.Kind === "slider" ? config.Length : 0,
    Radius: config.Kind === "wheel" ? config.Radius : 0,
    DeadZone: config.Kind === "wheel" ? config.DeadZone : GeometryEpsilon
  });
};
var Create = (policy, initial) => {
  const drive = Finite(policy.DriveStrength / policy.Inertia);
  const damping = Finite(policy.Damping / policy.Inertia);
  const friction = Finite(policy.Friction / policy.Inertia);
  const restoring = Finite((policy.Spring?.Strength || policy.DetentStrength) / policy.Inertia);
  const epsilon = Math.max(1, policy.Range) * 1e-7;
  const velocityEpsilon = epsilon / StepSeconds;
  let value = CheckValue(initial, policy.Limits);
  let velocity = 0;
  let target = value;
  let dragging = false;
  let estimated = false;
  let frame;
  let screen;
  let pointer;
  const clamp = (next) => policy.Limits ? Math.max(policy.Limits.Min, Math.min(policy.Limits.Max, Finite(next))) : Finite(next);
  const rest = (position, speed) => {
    if (policy.Spring && policy.Spring.Strength > 0) {
      return policy.Spring.Target;
    }
    let nearest = position;
    let distance = Infinity;
    if (policy.DetentStrength > 0) {
      for (const detent of policy.Detents) {
        const delta = Math.abs(Finite(detent - position));
        if (delta < distance || delta === distance && (speed > 0 ? detent > nearest : detent < nearest)) {
          nearest = detent;
          distance = delta;
        }
      }
    }
    return nearest;
  };
  const restRate = () => (policy.Spring?.Strength ?? 0) > 0 || policy.Detents.length > 0 && policy.DetentStrength > 0 ? restoring : 0;
  const settled = (position, speed, goal, rate) => Math.abs(speed) <= velocityEpsilon && (rate === 0 || Math.abs(goal - position) <= epsilon || Math.abs(goal - position) <= friction / rate);
  const snapshot = () => Object.freeze({
    Value: value,
    Velocity: velocity,
    Target: target,
    Dragging: dragging,
    Settled: settled(value, velocity, target, dragging ? drive : restRate()),
    Estimated: estimated,
    Pointer: pointer,
    Point: Point(policy, value)
  });
  target = rest(value, 0);
  Finite(target - value);
  Point(policy, value);
  return Object.freeze({
    get State() {
      return snapshot();
    },
    Begin(input, grabPoint) {
      const nextFrame = CopyFrame(input);
      const nextPointer = Pair(grabPoint ?? Point(policy, value));
      const nextScreen = Screen(nextFrame, nextPointer);
      if (!Project(nextFrame, nextScreen)) {
        throw new RangeError("Diagetic interaction plane cannot be projected from this camera");
      }
      frame = nextFrame;
      screen = nextScreen;
      pointer = nextPointer;
      velocity = 0;
      target = value;
      dragging = true;
      estimated = false;
    },
    Look(sample) {
      if (!dragging || !frame || !screen || !pointer) {
        throw new Error("Diagetic Look requires an active drag");
      }
      const delta = Pair(sample?.Delta);
      if (sample.Estimated !== void 0 && typeof sample.Estimated !== "boolean") {
        throw new TypeError("Diagetic Estimated must be a boolean");
      }
      const nextScreen = Pair({
        x: screen.x + delta.x * Radians * policy.Sensitivity,
        y: screen.y - delta.y * Radians * policy.Sensitivity
      });
      const nextPointer = Project(frame, nextScreen);
      if (!nextPointer) {
        return false;
      }
      let change = 0;
      if (policy.Kind === "slider") {
        change = Finite((nextPointer.x - pointer.x) / policy.Length * policy.Range);
      } else {
        const fromRadius = Finite(Math.hypot(pointer.x, pointer.y));
        const toRadius = Finite(Math.hypot(nextPointer.x, nextPointer.y));
        const deadZone = Math.max(GeometryEpsilon, policy.DeadZone);
        if (fromRadius > deadZone && toRadius > deadZone && !CrossesHub(pointer, nextPointer, deadZone)) {
          const ax = pointer.x / fromRadius;
          const ay = pointer.y / fromRadius;
          const bx = nextPointer.x / toRadius;
          const by = nextPointer.y / toRadius;
          const angle = Math.atan2(ax * by - ay * bx, ax * bx + ay * by) * Degrees;
          change = policy.Kind === "wheel" ? angle : -angle / policy.Arc * policy.Range;
        }
      }
      const nextTarget = clamp(Finite(target + change));
      Finite(nextTarget - value);
      target = nextTarget;
      screen = nextScreen;
      pointer = nextPointer;
      estimated = sample.Estimated ?? false;
      return true;
    },
    Release() {
      if (dragging) {
        const nextTarget = rest(value, velocity);
        Finite(nextTarget - value);
        target = nextTarget;
        dragging = false;
        estimated = false;
        frame = void 0;
        screen = void 0;
        pointer = void 0;
      }
    },
    SetValue(next) {
      CheckValue(next, policy.Limits);
      Point(policy, next);
      const nextPointer = dragging ? Pair(Point(policy, next)) : void 0;
      const nextScreen = frame && nextPointer ? Screen(frame, nextPointer) : void 0;
      if (frame && nextScreen && !Project(frame, nextScreen)) {
        throw new RangeError("Diagetic updated handle cannot be projected from this camera");
      }
      const nextTarget = dragging ? next : rest(next, 0);
      Finite(nextTarget - next);
      value = next;
      velocity = 0;
      target = nextTarget;
      pointer = nextPointer;
      screen = nextScreen;
      estimated = false;
    },
    Step() {
      const rate = dragging ? drive : restRate();
      const error = Finite(target - value);
      const denominator = Finite(1 + StepSeconds * damping + StepSeconds * StepSeconds * rate);
      const driven = Finite(velocity / denominator + StepSeconds * rate / denominator * error);
      let nextVelocity = Math.sign(driven) * Math.max(
        0,
        Math.abs(driven) - StepSeconds * friction / denominator
      );
      let nextValue = clamp(Finite(value + StepSeconds * nextVelocity));
      if (policy.Limits && (nextValue === policy.Limits.Min && nextVelocity < 0 || nextValue === policy.Limits.Max && nextVelocity > 0)) {
        nextVelocity = 0;
      }
      if (Math.abs(nextVelocity) <= velocityEpsilon && (rate === 0 || Math.abs(target - nextValue) <= epsilon)) {
        nextVelocity = 0;
        if (rate > 0) {
          nextValue = target;
        }
      }
      Point(policy, nextValue);
      value = nextValue;
      velocity = nextVelocity;
      if (!dragging && rate === 0) {
        target = nextValue;
      }
      return snapshot();
    }
  });
};
var Make = (configuration, initialValue) => {
  const policy = NumericPolicy(Configure(configuration));
  return Create(policy, initialValue ?? policy.Initial);
};

// ../../Package/Bedform/Source/Diagetic/Keys.ts
var Keys_exports = {};
__export(Keys_exports, {
  CameraPreset: () => CameraPreset,
  DynamicProperty: () => DynamicProperty,
  DynamicPropertyPrefix: () => DynamicPropertyPrefix,
  EntityEvent: () => EntityEvent,
  EntityGroup: () => EntityGroup,
  EntityProperty: () => EntityProperty,
  NativePermission: () => NativePermission,
  PoseProperty: () => PoseProperty,
  PoseRange: () => PoseRange,
  ReleasePrompt: () => ReleasePrompt,
  ReleaseTarget: () => ReleaseTarget,
  ScriptEvent: () => ScriptEvent,
  TagPrefix: () => TagPrefix
});
var DynamicProperty = Object.freeze({
  Sequence: "bedform:diagetic_sequence",
  Control: "bedform:diagetic_control",
  Retired: "bedform:diagetic_retired"
});
var DynamicPropertyPrefix = Object.freeze({ Recovery: "bedform:diagetic_recovery:" });
var TagPrefix = Object.freeze({ Session: "bedform:diagetic_session:" });
var EntityEvent = Object.freeze({
  Lock: "bedform:diagetic_lock",
  Unlock: "bedform:diagetic_unlock",
  RefreshTarget: "bedform:diagetic_refresh_target",
  ExpireTarget: "bedform:diagetic_expire_target"
});
var EntityGroup = Object.freeze({ Locked: "bedform:diagetic_locked" });
var EntityProperty = Object.freeze({
  CameraActive: "bedform:diagetic_camera_active",
  Highlighted: "bedform:diagetic_highlighted"
});
var PoseProperty = Object.freeze({
  OffsetX: "bedform:diagetic_offset_x",
  OffsetY: "bedform:diagetic_offset_y",
  OffsetZ: "bedform:diagetic_offset_z",
  Yaw: "bedform:diagetic_yaw",
  Pitch: "bedform:diagetic_pitch",
  Roll: "bedform:diagetic_roll",
  Motion: "bedform:diagetic_motion"
});
var PoseRange = Object.freeze({
  Offset: Object.freeze([-256.5, 256.5]),
  Angle: Object.freeze([-180.5, 180.5]),
  Motion: Object.freeze([-360.5, 360.5])
});
var ScriptEvent = Object.freeze({ Place: "bedform:diagetic_place" });
var CameraPreset = "bedform:diagetic_snapshot";
var ReleasePrompt = "\xA7o\xA77Press \xA7e:_input_key.use: \xA7o\xA77to let go.\xA7r";
var NativePermission = Object.freeze({
  Movement: 2,
  LateralMovement: 4,
  Sneak: 5,
  Jump: 6,
  Mount: 7,
  Dismount: 8,
  MoveForward: 9,
  MoveBackward: 10,
  MoveLeft: 11,
  MoveRight: 12,
  Camera: 1
});
var ReleaseTarget = "bedform:diagetic_release_target";

// ../../Package/Bedform/Source/Diagetic/Camera.ts
var FreezeCamera = (player, preset) => {
  const result = player.runCommand(`execute as @s at @s anchored eyes run camera @s set ${preset} pos ^ ^ ^ rot ~ ~`);
  if (result.successCount === 0) {
    throw new Error("The native eye-anchored camera command did not apply");
  }
};
var RestoreCamera = (camera) => {
  const errors = [];
  for (const restore of [() => camera.clear(), () => camera.setFov()]) {
    try {
      restore();
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length) {
    throw new AggregateError(errors, "Native camera restoration failed");
  }
};

// ../../Package/Bedform/Source/Internal/DiageticRecovery.ts
var Rotation = (value) => {
  if (!value || !Number.isFinite(value.x) || !Number.isFinite(value.y) || Math.abs(value.x) > 90) {
    throw new Error("Invalid Diagetic recovery rotation");
  }
  return Object.freeze({
    x: value.x,
    y: value.y
  });
};
var ReadJournal = (world2, playerId) => {
  const raw = world2.getDynamicProperty(DynamicPropertyPrefix.Recovery + playerId);
  if (raw === void 0) {
    return void 0;
  }
  if (typeof raw !== "string" || raw.length > 4096) {
    throw new Error("Malformed Diagetic recovery receipt; acquisition is blocked");
  }
  const receipt = JSON.parse(raw);
  const categories = Object.values(NativePermission);
  if (!receipt || receipt.Version !== 1 || receipt.Player !== playerId || typeof receipt.Actor !== "string" || !receipt.Actor || typeof receipt.Dimension !== "string" || !receipt.Dimension || typeof receipt.Tag !== "string" || !receipt.Tag.startsWith(TagPrefix.Session) || receipt.Tag.length > 255 || !Array.isArray(receipt.Permissions) || receipt.Permissions.length !== categories.length || receipt.Permissions.some(
    (entry, index) => !Array.isArray(entry) || entry.length !== 2 || entry[0] !== categories[index] || typeof entry[1] !== "boolean"
  )) {
    throw new Error("Malformed Diagetic recovery receipt; acquisition is blocked");
  }
  Rotation(receipt.Rotation);
  return {
    Raw: raw,
    Receipt: receipt
  };
};
var PrepareJournal = (world2, player, actor, tick) => {
  const key = DynamicPropertyPrefix.Recovery + player.id;
  if (world2.getDynamicProperty(key) !== void 0) {
    throw new Error("Diagetic player requires recovery before acquisition");
  }
  const previous = world2.getDynamicProperty(DynamicProperty.Sequence) ?? 0;
  if (typeof previous !== "number" || !Number.isSafeInteger(previous) || previous < 0 || previous >= Number.MAX_SAFE_INTEGER) {
    throw new Error("Invalid Diagetic recovery sequence");
  }
  const receipt = {
    Version: 1,
    Player: player.id,
    Actor: actor.id,
    Dimension: player.dimension.id,
    Tag: TagPrefix.Session + (previous + 1).toString(36) + ":" + tick.toString(36) + ":" + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2),
    Rotation: Rotation(player.getRotation()),
    Permissions: Object.values(NativePermission).map((category) => [category, player.inputPermissions.isPermissionCategoryEnabled(category)])
  };
  const raw = JSON.stringify(receipt);
  world2.setDynamicProperty(DynamicProperty.Sequence, previous + 1);
  world2.setDynamicProperty(key, raw);
  if (world2.getDynamicProperty(key) !== raw) {
    throw new Error("Diagetic recovery receipt did not commit");
  }
  return {
    Raw: raw,
    Receipt: receipt
  };
};
var RestoreJournal = (world2, player, journal) => {
  const errors = [];
  const attempt = (action) => {
    try {
      action();
    } catch (error) {
      errors.push(error);
    }
  };
  const { Receipt: receipt, Raw: raw } = journal;
  const key = DynamicPropertyPrefix.Recovery + receipt.Player;
  try {
    if (world2.getDynamicProperty(key) !== raw || !player.isValid || player.getTags().some((tag) => tag.startsWith(TagPrefix.Session) && tag !== receipt.Tag)) {
      throw new Error("Diagetic recovery is stale, unavailable or blocked by another owner");
    }
  } catch (error) {
    return [error];
  }
  attempt(() => player.teleport(player.location, { rotation: receipt.Rotation }));
  attempt(() => RestoreCamera(player.camera));
  attempt(() => player.triggerEvent(EntityEvent.Unlock));
  for (const [category, enabled] of receipt.Permissions) {
    attempt(() => player.inputPermissions.setPermissionCategory(category, enabled));
  }
  attempt(() => player.onScreenDisplay.setActionBar(""));
  if (errors.length === 0) {
    attempt(() => {
      const actor = world2.getEntity(receipt.Actor);
      if (actor?.isValid) {
        actor.removeTag(receipt.Tag);
      }
    });
    if (errors.length === 0) {
      attempt(() => player.removeTag(receipt.Tag));
    }
    if (errors.length === 0) {
      attempt(() => {
        if (world2.getDynamicProperty(key) !== raw) {
          throw new Error("Diagetic recovery receipt changed during restoration");
        }
        world2.setDynamicProperty(key, void 0);
        if (world2.getDynamicProperty(key) !== void 0) {
          throw new Error("Diagetic recovery receipt was not cleared");
        }
      });
    }
  }
  return errors;
};

// ../../Package/Bedform/Source/Internal/DiageticFrame.ts
var FaceRotation = (face) => {
  return {
    x: face === "Up" ? -90 : face === "Down" ? 90 : 0,
    y: face === "North" ? 180 : face === "East" ? -90 : face === "West" ? 90 : 0,
    z: 0
  };
};
var Rotate = (vector, rotation) => {
  const r = Coordinates(rotation);
  const pitch = r.x * Math.PI / 180;
  const yaw = r.y * Math.PI / 180;
  const roll = r.z * Math.PI / 180;
  const x = vector.x * Math.cos(roll) - vector.y * Math.sin(roll);
  const y = vector.x * Math.sin(roll) + vector.y * Math.cos(roll);
  const py = y * Math.cos(pitch) - vector.z * Math.sin(pitch);
  const pz = y * Math.sin(pitch) + vector.z * Math.cos(pitch);
  return Coordinates({
    x: x * Math.cos(yaw) - pz * Math.sin(yaw),
    y: py,
    z: x * Math.sin(yaw) + pz * Math.cos(yaw)
  });
};
var MountFrame = (control) => {
  const native = control.Entity.getRotation();
  const root = control.Binding ? FaceRotation(control.Binding.Face) : {
    x: native.x,
    y: native.y,
    z: 0
  };
  const local = (value) => Rotate(Rotate(value, control.Pose.Rotation), root);
  const offset = Rotate(control.Pose.Offset, root);
  const normal = Rotate({
    x: 0,
    y: 0,
    z: 1
  }, root);
  const location = control.Binding ? Coordinates({
    x: control.Binding.Position.x + 0.5 + normal.x * 0.5,
    y: control.Binding.Position.y + 0.5 + normal.y * 0.5,
    z: control.Binding.Position.z + 0.5 + normal.z * 0.5
  }) : Coordinates(control.Entity.location);
  return {
    Position: Coordinates({
      x: location.x + offset.x,
      y: location.y + offset.y,
      z: location.z + offset.z
    }),
    Right: local({
      x: 1,
      y: 0,
      z: 0
    }),
    Up: local({
      x: 0,
      y: 1,
      z: 0
    }),
    Normal: local({
      x: 0,
      y: 0,
      z: 1
    })
  };
};
var CaptureFrame = (player, control, activation) => {
  const eye = Coordinates(player.getHeadLocation());
  const camera = {
    x: activation.x,
    y: activation.y,
    z: 0
  };
  return {
    Camera: {
      Position: eye,
      Right: Rotate({
        x: -1,
        y: 0,
        z: 0
      }, camera),
      Up: Rotate({
        x: 0,
        y: 1,
        z: 0
      }, camera),
      Forward: Rotate({
        x: 0,
        y: 0,
        z: 1
      }, camera)
    },
    Mount: MountFrame(control)
  };
};

// ../../Package/Bedform/Source/Diagetic/Look.ts
var SampleAxis = (axis, raw, resetting, pendingBefore, pendingAfter) => {
  if (resetting && !pendingBefore) {
    let total = 0;
    let weight = 0;
    for (let index = 0; index < axis.history.length; index++) {
      total += axis.history[index] * (index + 1);
      weight += index + 1;
    }
    axis.velocity = weight > 0 ? total / weight : raw;
    if (Math.abs(axis.velocity) < 1e-3 || axis.velocity * raw < 0) {
      axis.velocity = raw;
    }
    axis.estimatedTicks = 0;
    axis.recoveryTicks = 6;
    return {
      estimated: true,
      value: axis.velocity
    };
  }
  if (pendingBefore || axis.recoveryTicks > 0) {
    axis.estimatedTicks++;
    const attenuation = Math.max(0, Math.min(1, (16 - axis.estimatedTicks) / 8));
    const predicted = axis.velocity * attenuation;
    if (pendingBefore) {
      if (!pendingAfter) {
        axis.recoveryTicks = 6;
      }
      return {
        estimated: true,
        value: predicted
      };
    }
    const reversed = raw * axis.velocity < 0 && Math.abs(raw) > 0.01;
    const converged = Math.abs(raw - axis.velocity) <= Math.max(0.01, Math.abs(axis.velocity) * 0.2);
    if (reversed || converged || Math.abs(axis.velocity) < 1e-3) {
      axis.recoveryTicks = 0;
      axis.history = [];
    } else {
      axis.recoveryTicks--;
      const measuredWeight = Math.max(0, (3 - axis.recoveryTicks) / 3);
      if (axis.recoveryTicks > 0) {
        return {
          estimated: true,
          value: predicted * (1 - measuredWeight) + raw * measuredWeight
        };
      }
      axis.history = [];
    }
  }
  axis.history.push(raw);
  if (axis.history.length > 3) {
    axis.history.shift();
  }
  return {
    estimated: false,
    value: raw
  };
};
var MeasureLook = (state, current) => {
  const horizontal = AngleDelta(current.y, state.previousRotation.y);
  const vertical = current.x - state.previousRotation.x;
  const yawOffset = AngleDelta(current.y, state.yawOrigin);
  const pitchPendingBefore = state.pendingPitchReset ?? false;
  const yawPendingBefore = state.pendingYawReset ?? false;
  if (state.pendingPitchReset) {
    state.pendingPitchReset = Math.abs(current.x) > 45;
  }
  if (state.pendingYawReset) {
    state.pendingYawReset = Math.abs(yawOffset) > 22.5;
  }
  state.resetPendingTicks = Math.max(0, state.resetPendingTicks - 1);
  const resetPitch = !state.pendingPitchReset && Math.abs(current.x) >= 85;
  const resetYaw = !state.pendingYawReset && Math.abs(yawOffset) >= 45;
  const retry = state.resetPendingTicks === 0 && (state.pendingPitchReset || state.pendingYawReset);
  state.previousRotation = current;
  state.horizontal ??= {
    estimatedTicks: 0,
    history: [],
    recoveryTicks: 0,
    velocity: 0
  };
  state.vertical ??= {
    estimatedTicks: 0,
    history: [],
    recoveryTicks: 0,
    velocity: 0
  };
  const resetting = resetPitch || resetYaw;
  const horizontalSample = SampleAxis(
    state.horizontal,
    horizontal,
    resetting,
    yawPendingBefore,
    Boolean(state.pendingYawReset)
  );
  const verticalSample = SampleAxis(
    state.vertical,
    vertical,
    resetting,
    pitchPendingBefore,
    Boolean(state.pendingPitchReset)
  );
  const delta = {
    x: horizontalSample.value,
    y: verticalSample.value
  };
  const estimated = horizontalSample.estimated || verticalSample.estimated;
  if (resetPitch || resetYaw || retry) {
    state.pendingPitchReset ||= resetPitch;
    state.pendingYawReset ||= resetYaw;
    state.resetPendingTicks = 10;
    return {
      delta,
      estimated,
      resetRotation: {
        x: state.pendingPitchReset ? 0 : current.x,
        y: state.pendingYawReset ? state.yawOrigin : current.y
      }
    };
  }
  if (!state.pendingPitchReset && !state.pendingYawReset) {
    state.resetPendingTicks = 0;
  }
  return {
    delta,
    estimated
  };
};
var AngleDelta = (current, previous) => {
  return ((current - previous + 180) % 360 + 360) % 360 - 180;
};

// ../../Package/Bedform/Source/Internal/DiageticSupport.ts
var Support = (world2, control) => {
  try {
    const retired = control.Entity.getDynamicProperty(DynamicProperty.Retired);
    if (retired !== void 0) {
      return retired === true ? "missing" : "unavailable";
    }
    const binding = control.Binding;
    if (!binding) {
      return "valid";
    }
    const dimension = world2.getDimension(binding.Dimension);
    if (dimension.id !== control.Entity.dimension.id) {
      return "missing";
    }
    const block = dimension.getBlock(binding.Position);
    if (!block) {
      return "unavailable";
    }
    return block.isAir || block.typeId !== binding.ExpectedBlockType ? "missing" : "valid";
  } catch {
    return "unavailable";
  }
};

// ../../Package/Bedform/Source/Internal/DiageticRuntime.ts
var Registries = /* @__PURE__ */ new WeakMap();
var Hosts = /* @__PURE__ */ new Map();
var RegisterDefinition = (definition) => {
  Registries.set(definition, {
    Watchers: /* @__PURE__ */ new Set(),
    Lookups: /* @__PURE__ */ new Set()
  });
};
var FindAttached = (definition, id) => {
  for (const lookup of Registries.get(definition)?.Lookups ?? []) {
    const handle = lookup(id);
    if (handle?.IsValid) {
      return handle;
    }
  }
  return void 0;
};
var Wake = (definition, handle) => {
  for (const watcher of Registries.get(definition)?.Watchers ?? []) {
    watcher(handle);
  }
};
var IsDefinition = (definition) => {
  return typeof definition === "object" && definition !== null && Registries.has(definition);
};
var IsCustom = (control) => {
  return control.Definition.Kind === "custom";
};
var Policy = (control) => {
  return control.Definition.Configuration;
};
var Begin = (control, frame, player) => {
  if (IsCustom(control)) {
    control.Motion.Begin(frame, player);
  } else {
    control.Motion.Begin(frame);
  }
};
var Look = (control, sample, player) => {
  if (IsCustom(control)) {
    control.Motion.Look(sample, player);
  } else {
    control.Motion.Look(sample);
  }
};
var End = (control, player, reason) => {
  if (IsCustom(control)) {
    control.Motion.Release(player, reason);
  } else {
    control.Motion.Release();
  }
};
var Report = (context, error) => {
  try {
    if (context.Options.OnError) {
      context.Options.OnError(error);
    } else {
      const Globals = globalThis;
      const Logger = Globals.console;
      Logger?.error(`Diagetic: ${String(error)}`);
    }
  } catch {
  }
};
var Prune = (context, actor) => {
  const tags = actor.getTags().filter((tag) => tag.startsWith(TagPrefix.Session));
  if (tags.length === 0) {
    return;
  }
  const players = context.Options.World.getAllPlayers();
  for (const tag of tags) {
    if (!players.some((player) => player.isValid && player.hasTag(tag))) {
      actor.removeTag(tag);
    }
  }
};
var Recover = (context, player) => {
  if (context.Host.Players.has(player.id)) {
    return false;
  }
  try {
    const journal = ReadJournal(context.Options.World, player.id);
    if (journal) {
      const errors = RestoreJournal(context.Options.World, player, journal);
      if (errors.length) {
        throw new AggregateError(errors, "Diagetic player recovery incomplete");
      }
    }
    context.RecoveryErrors.delete(player.id);
    return true;
  } catch (error) {
    if (!context.RecoveryErrors.has(player.id)) {
      context.RecoveryErrors.add(player.id);
      Report(context, error);
    }
    return false;
  }
};
var Invalidate = (context, playerId) => {
  const run = context.Pending.get(playerId);
  context.Pending.delete(playerId);
  if (run !== void 0) {
    context.Runs.delete(run);
    try {
      context.Options.System.clearRun(run);
    } catch (error) {
      Report(context, error);
    }
  }
};
var Finish = (session, reason) => {
  const { Context: context, Player: player, Control: control } = session;
  if (session.Closing || !context.Sessions.has(session)) {
    return;
  }
  session.Closing = true;
  Invalidate(context, player.id);
  const errors = [];
  try {
    if (session.Target?.isValid) {
      session.Target.remove();
    }
  } catch (error) {
    errors.push(error);
  }
  try {
    End(control, player, reason);
  } catch (error) {
    errors.push(error);
  }
  try {
    if (session.Journal && !IsCustom(control)) {
      if (reason) {
        control.Definition.Configuration.OnCancel?.({
          Control: control,
          Player: player.isValid ? player : void 0,
          Reason: reason
        });
      } else {
        control.Definition.Configuration.OnRelease?.({
          Control: control,
          Player: player
        });
      }
    }
  } catch (error) {
    errors.push(error);
  } finally {
    try {
      if (session.Journal) {
        errors.push(...RestoreJournal(context.Options.World, player, session.Journal));
      }
    } catch (error) {
      errors.push(error);
    } finally {
      context.Sessions.delete(session);
      if (context.Host.Players.get(player.id) === session) {
        context.Host.Players.delete(player.id);
      }
      if (context.Host.Actors.get(control.Entity.id) === session) {
        context.Host.Actors.delete(control.Entity.id);
      }
      if (!context.Disposed && control.IsValid) {
        context.Active.set(control.Entity.id, control);
      }
    }
  }
  if (errors.length) {
    Report(context, new AggregateError(errors, "Diagetic session retirement incomplete"));
  }
};
var UpdateTarget = (session) => {
  const player = session.Player;
  const head = player.getHeadLocation();
  const aim = player.getViewDirection();
  const position = {
    x: head.x + aim.x * 1.5,
    y: head.y + aim.y * 1.5 - 0.3,
    z: head.z + aim.z * 1.5
  };
  if (!session.Target) {
    session.Target = player.dimension.spawnEntity(ReleaseTarget, position);
  }
  if (!session.Target.isValid) {
    throw new Error("Diagetic release target was lost");
  }
  const previous = session.Target.location;
  if (Math.hypot(previous.x - position.x, previous.y - position.y, previous.z - position.z) > 1e-3) {
    session.Target.teleport(position);
  }
  const tick = session.Context.Options.System.currentTick;
  if (session.TargetRefreshTick === void 0 || tick - session.TargetRefreshTick >= 5) {
    session.Target.triggerEvent(EntityEvent.RefreshTarget);
    session.TargetRefreshTick = tick;
  }
};
var Acquire = (context, player, actor) => {
  const active = context.Host.Players.get(player.id);
  if (active) {
    if (active.Context === context && !active.Closing) {
      Finish(active);
    }
    return;
  }
  if (context.Disposed || !player.isValid || !actor.isValid || context.Dead.has(player.id) || context.Host.Actors.has(actor.id) || context.Retiring.has(actor.id) || !Recover(context, player)) {
    return;
  }
  const definition = context.Options.Controls.find((control) => control.EntityType === actor.typeId);
  if (!definition) {
    return;
  }
  try {
    Prune(context, actor);
    if ([...player.getTags(), ...actor.getTags()].some((tag) => tag.startsWith(TagPrefix.Session))) {
      return;
    }
    const control = context.Controls.get(actor.id) ?? definition.Attach(actor);
    if (Support(context.Options.World, control) !== "valid") {
      return;
    }
    const session = {
      Context: context,
      Player: player,
      Control: control,
      Closing: false
    };
    context.Sessions.add(session);
    context.Host.Players.set(player.id, session);
    context.Host.Actors.set(actor.id, session);
    try {
      const configuration = Policy(control);
      const rotation = player.getRotation();
      const frame = CaptureFrame(player, control, rotation);
      if (actor.dimension.id !== player.dimension.id || Math.hypot(
        frame.Mount.Position.x - frame.Camera.Position.x,
        frame.Mount.Position.y - frame.Camera.Position.y,
        frame.Mount.Position.z - frame.Camera.Position.z
      ) > configuration.InteractionRange || configuration.Eligible?.(player, control) === false) {
        Finish(session, "error");
        return;
      }
      if (context.Disposed || session.Closing) {
        return;
      }
      if (typeof player.getProperty(EntityProperty.CameraActive) !== "boolean") {
        throw new Error("BedformCommon player presentation assets are missing or overridden");
      }
      session.Journal = PrepareJournal(
        context.Options.World,
        player,
        actor,
        context.Options.System.currentTick
      );
      if (!player.addTag(session.Journal.Receipt.Tag) || !actor.addTag(session.Journal.Receipt.Tag)) {
        throw new Error("Diagetic native ownership claim did not commit");
      }
      if (typeof actor.getProperty(EntityProperty.Highlighted) === "boolean") {
        actor.setProperty(EntityProperty.Highlighted, false);
      }
      player.triggerEvent(EntityEvent.Lock);
      player.inputPermissions.setPermissionCategory(NativePermission.Camera, true);
      player.inputPermissions.setPermissionCategory(NativePermission.Movement, false);
      player.clearVelocity();
      player.teleport(player.location, { rotation: session.Journal.Receipt.Rotation });
      Begin(control, CaptureFrame(player, control, session.Journal.Receipt.Rotation), player);
      FreezeCamera(player, CameraPreset);
      session.Look = {
        previousRotation: { ...session.Journal.Receipt.Rotation },
        resetPendingTicks: 0,
        yawOrigin: session.Journal.Receipt.Rotation.y
      };
      UpdateTarget(session);
      player.onScreenDisplay.setActionBar(ReleasePrompt);
      if (!IsCustom(control)) {
        configuration.OnGrab?.({
          Control: control,
          Player: player
        });
      }
      if (!session.Closing && !context.Disposed) {
        player.onScreenDisplay.setActionBar(ReleasePrompt);
        context.Active.set(actor.id, control);
      }
    } catch (error) {
      Finish(session, "error");
      Report(context, error);
    }
  } catch (error) {
    Report(context, error);
  }
};
var Observe = (context, player, actor) => {
  if (context.Disposed || !player.isValid) {
    return false;
  }
  const active = context.Host.Players.get(player.id);
  if (actor.typeId === ReleaseTarget && active?.Target?.id !== actor.id) {
    return false;
  }
  if (!active && (!actor.isValid || player.getTags().some((tag) => tag.startsWith(TagPrefix.Session)))) {
    return false;
  }
  if (active ? active.Context !== context : context.Host.Types.get(actor.typeId) !== context) {
    return false;
  }
  if (context.Pending.has(player.id) || context.LastUse.get(player.id) === context.Options.System.currentTick) {
    return true;
  }
  context.LastUse.set(player.id, context.Options.System.currentTick);
  const id = context.Options.System.run(() => {
    context.Runs.delete(id);
    if (context.Pending.get(player.id) !== id || context.Disposed) {
      return;
    }
    context.Pending.delete(player.id);
    Acquire(context, player, actor);
  });
  context.Pending.set(player.id, id);
  context.Runs.add(id);
  return true;
};
var Release = (context, player) => {
  const session = context.Host.Players.get(player.id);
  if (session?.Context === context && !session.Closing && session.Control.IsValid) {
    Observe(context, player, session.Control.Entity);
  }
};
var Listen = (context, signal, callback) => {
  const guarded = (event) => {
    if (context.Disposed) {
      return;
    }
    try {
      callback(event);
    } catch (error) {
      Report(context, error);
    }
  };
  signal.subscribe(guarded);
  context.Cleanup.push(() => signal.unsubscribe(guarded));
};
var CancelPlayer = (context, playerId, reason) => {
  Invalidate(context, playerId);
  const session = context.Host.Players.get(playerId);
  if (session?.Context === context) {
    Finish(session, reason);
  }
};
var Loaded = (context, entity) => {
  const definition = context.Options.Controls.find((control) => control.EntityType === entity.typeId);
  if (definition && entity.isValid) {
    Prune(context, entity);
    definition.Attach(entity);
  }
};
var ChangedSupport = (context, dimension, position) => {
  for (const [id, control] of context.Controls) {
    const binding = control.Binding;
    if (binding && (binding.Dimension === dimension || "minecraft:" + binding.Dimension === dimension) && binding.Position.x === position.x && binding.Position.y === position.y && binding.Position.z === position.z) {
      MarkRetiring(context, id, control);
    }
  }
};
var MarkRetiring = (context, id, control) => {
  context.Retiring.add(id);
  try {
    if (control.Entity.getDynamicProperty(DynamicProperty.Retired) !== true) {
      control.Entity.setDynamicProperty(DynamicProperty.Retired, true);
    }
    if (control.Entity.getDynamicProperty(DynamicProperty.Retired) !== true) {
      throw new Error("Diagetic retirement marker did not commit");
    }
  } catch (error) {
    if (!context.RetirementErrors.has(id)) {
      context.RetirementErrors.add(id);
      Report(context, error);
    }
  }
};
var CheckSupports = (context) => {
  for (const [id, control] of context.Controls) {
    if (context.Disposed) {
      return;
    }
    if (!control.IsValid) {
      context.Controls.delete(id);
      context.Active.delete(id);
      context.Retiring.delete(id);
      context.RetirementErrors.delete(id);
      continue;
    }
    if (!context.Retiring.has(id) && Support(context.Options.World, control) !== "missing") {
      continue;
    }
    MarkRetiring(context, id, control);
    const session = context.Host.Actors.get(id);
    if (session?.Context === context) {
      Finish(session, "entityLost");
    }
    if (context.Disposed) {
      return;
    }
    try {
      control.Remove();
      context.Controls.delete(id);
      context.Active.delete(id);
      context.Retiring.delete(id);
      context.RetirementErrors.delete(id);
    } catch (error) {
      if (!context.RetirementErrors.has(id)) {
        context.RetirementErrors.add(id);
        Report(context, error);
      }
    }
  }
};
var Highlight = (context, clearing = false) => {
  const highlighted = /* @__PURE__ */ new Set();
  const range = Math.max(0, ...context.Options.Controls.map((definition) => definition.Configuration.InteractionRange ?? 3));
  for (const player of context.Options.World.getAllPlayers()) {
    if (clearing || !player.isValid || context.Host.Players.has(player.id)) {
      continue;
    }
    try {
      const hit = player.getEntitiesFromViewDirection({
        maxDistance: range,
        ignoreBlockCollision: false
      }).sort((left, right) => left.distance - right.distance)[0];
      const control = hit && context.Controls.get(hit.entity.id);
      if (control && hit.distance <= (Policy(control).InteractionRange ?? 3)) {
        highlighted.add(hit.entity.id);
      }
    } catch (error) {
      Report(context, error);
    }
  }
  for (const [id, control] of context.Controls) {
    try {
      if (!control.IsValid || typeof control.Entity.getProperty(EntityProperty.Highlighted) !== "boolean") {
        continue;
      }
      const value = !clearing && highlighted.has(id) && !context.Host.Actors.has(id) && !context.Retiring.has(id) && !control.Entity.getTags().some((tag) => tag.startsWith(TagPrefix.Session));
      if (control.Entity.getProperty(EntityProperty.Highlighted) !== value) {
        control.Entity.setProperty(EntityProperty.Highlighted, value);
      }
    } catch (error) {
      Report(context, error);
    }
  }
};
var Tick = (context) => {
  if (context.Disposed) {
    return;
  }
  CheckSupports(context);
  if (context.Disposed) {
    return;
  }
  for (const player of context.Options.World.getAllPlayers()) {
    if (!context.Host.Players.has(player.id)) {
      Recover(context, player);
    }
  }
  Highlight(context);
  for (const session of [...context.Sessions]) {
    if (session.Closing || context.Disposed) {
      continue;
    }
    const { Player: player, Control: control } = session;
    try {
      if (!player.isValid) {
        Finish(session, "disconnect");
        continue;
      }
      if (!control.IsValid || control.Entity.dimension.id !== session.Journal.Receipt.Dimension) {
        Finish(session, "entityLost");
        continue;
      }
      if (player.dimension.id !== session.Journal.Receipt.Dimension) {
        Finish(session, "dimensionChange");
        continue;
      }
      const currentFrame = CaptureFrame(player, control, session.Journal.Receipt.Rotation);
      if (Math.hypot(
        currentFrame.Mount.Position.x - currentFrame.Camera.Position.x,
        currentFrame.Mount.Position.y - currentFrame.Camera.Position.y,
        currentFrame.Mount.Position.z - currentFrame.Camera.Position.z
      ) > Policy(control).InteractionRange) {
        Finish(session, "outOfRange");
        continue;
      }
      if (!player.hasTag(session.Journal.Receipt.Tag) || !control.Entity.hasTag(session.Journal.Receipt.Tag)) {
        throw new Error("Diagetic session lost its ownership receipt");
      }
      const sample = MeasureLook(session.Look, player.getRotation());
      Look(control, {
        Delta: sample.delta,
        Estimated: sample.estimated
      }, player);
      if (sample.resetRotation) {
        player.teleport(player.location, { rotation: sample.resetRotation });
      }
      UpdateTarget(session);
      context.Active.set(control.Entity.id, control);
    } catch (error) {
      Finish(session, "error");
      Report(context, error);
    }
  }
  for (const [id, control] of [...context.Active]) {
    if (context.Disposed) {
      break;
    }
    try {
      if (!control.IsValid) {
        context.Active.delete(id);
        context.Controls.delete(id);
        continue;
      }
      const state = control.Motion.Step();
      if (state.Settled) {
        context.Active.delete(id);
      }
    } catch (error) {
      context.Active.delete(id);
      const session = context.Host.Actors.get(id);
      if (session?.Context === context) {
        Finish(session, "error");
      }
      Report(context, error);
    }
  }
  for (const session of [...context.Sessions]) {
    if (!session.Closing && !context.Disposed) {
      try {
        session.Player.onScreenDisplay.setActionBar(ReleasePrompt);
      } catch (error) {
        Finish(session, "error");
        Report(context, error);
      }
    }
  }
};
var StartRuntime = (options) => {
  options = {
    ...options,
    Controls: Object.freeze([...options.Controls])
  };
  const hostKey = options.World.beforeEvents.playerInteractWithEntity;
  const host = Hosts.get(hostKey) ?? {
    Players: /* @__PURE__ */ new Map(),
    Actors: /* @__PURE__ */ new Map(),
    Types: /* @__PURE__ */ new Map(),
    System: options.System
  };
  if (host.System !== options.System || options.Controls.some((control) => host.Types.has(control.EntityType))) {
    throw new Error("Diagetic runtimes must share System and register distinct entity types");
  }
  const context = {
    Options: {
      ...options,
      Controls: Object.freeze([...options.Controls])
    },
    Host: host,
    Controls: /* @__PURE__ */ new Map(),
    Active: /* @__PURE__ */ new Map(),
    Sessions: /* @__PURE__ */ new Set(),
    Pending: /* @__PURE__ */ new Map(),
    Runs: /* @__PURE__ */ new Set(),
    LastUse: /* @__PURE__ */ new Map(),
    Dead: /* @__PURE__ */ new Set(),
    RecoveryErrors: /* @__PURE__ */ new Set(),
    Retiring: /* @__PURE__ */ new Set(),
    RetirementErrors: /* @__PURE__ */ new Set(),
    Cleanup: [],
    Disposed: false
  };
  Hosts.set(hostKey, host);
  const dispose = () => {
    if (context.Disposed) {
      return;
    }
    context.Disposed = true;
    Highlight(context, true);
    for (const session of [...context.Sessions]) {
      Finish(session, "disposed");
    }
    const errors = [];
    for (const cleanup of context.Cleanup.reverse()) {
      try {
        cleanup();
      } catch (error) {
        errors.push(error);
      }
    }
    for (const run of context.Runs) {
      try {
        options.System.clearRun(run);
      } catch (error) {
        errors.push(error);
      }
    }
    for (const definition of options.Controls) {
      if (host.Types.get(definition.EntityType) === context) {
        host.Types.delete(definition.EntityType);
      }
    }
    context.Runs.clear();
    context.Pending.clear();
    context.Active.clear();
    context.Controls.clear();
    context.LastUse.clear();
    context.Dead.clear();
    context.RecoveryErrors.clear();
    context.Retiring.clear();
    context.RetirementErrors.clear();
    context.Cleanup.length = 0;
    if (host.Types.size === 0 && Hosts.get(hostKey) === host) {
      Hosts.delete(hostKey);
    }
    if (errors.length) {
      throw new AggregateError(errors, "Diagetic runtime disposal incomplete");
    }
  };
  try {
    for (const definition of options.Controls) {
      host.Types.set(definition.EntityType, context);
      const registry = Registries.get(definition);
      const wake = (handle) => {
        if (!context.Disposed) {
          context.Controls.set(handle.Entity.id, handle);
          context.Active.set(handle.Entity.id, handle);
        }
      };
      const lookup = (id) => context.Disposed ? void 0 : context.Controls.get(id);
      registry.Watchers.add(wake);
      registry.Lookups.add(lookup);
      context.Cleanup.push(() => {
        registry.Watchers.delete(wake);
        registry.Lookups.delete(lookup);
      });
    }
    const { beforeEvents: before, afterEvents: after } = options.World;
    Listen(context, before.playerInteractWithEntity, (event) => {
      if (Observe(context, event.player, event.target)) {
        event.cancel = true;
      }
    });
    Listen(context, before.playerInteractWithBlock, (event) => {
      if (host.Players.get(event.player.id)?.Context === context || context.Pending.has(event.player.id)) {
        event.cancel = true;
        if (event.isFirstEvent) {
          Release(context, event.player);
        }
      }
    });
    Listen(context, before.itemUse, (event) => {
      if (host.Players.get(event.source.id)?.Context === context || context.Pending.has(event.source.id)) {
        event.cancel = true;
        Release(context, event.source);
      }
    });
    Listen(context, after.playerSpawn, (event) => {
      CancelPlayer(context, event.player.id, "respawn");
      context.Dead.delete(event.player.id);
      context.LastUse.delete(event.player.id);
      Recover(context, event.player);
    });
    Listen(context, after.playerLeave, (event) => {
      CancelPlayer(context, event.playerId, "disconnect");
      context.Dead.delete(event.playerId);
      context.LastUse.delete(event.playerId);
    });
    Listen(context, after.playerDimensionChange, (event) => CancelPlayer(context, event.player.id, "dimensionChange"));
    Listen(context, after.entityDie, (event) => {
      if (event.deadEntity.typeId === "minecraft:player") {
        context.Dead.add(event.deadEntity.id);
        CancelPlayer(context, event.deadEntity.id, "death");
      }
      const session = host.Actors.get(event.deadEntity.id);
      if (session?.Context === context) {
        Finish(session, "entityLost");
      }
    });
    Listen(context, after.entityRemove, (event) => {
      if (event.typeId === "minecraft:player") {
        CancelPlayer(context, event.removedEntityId, "disconnect");
      }
      const session = host.Actors.get(event.removedEntityId);
      if (session?.Context === context) {
        Finish(session, "entityLost");
      }
      context.Active.delete(event.removedEntityId);
      context.Controls.delete(event.removedEntityId);
    });
    Listen(context, after.entityLoad, (event) => Loaded(context, event.entity));
    Listen(context, after.entitySpawn, (event) => Loaded(context, event.entity));
    Listen(context, after.playerBreakBlock, (event) => ChangedSupport(context, event.dimension.id, event.block.location));
    Listen(context, after.playerPlaceBlock, (event) => ChangedSupport(context, event.dimension.id, event.block.location));
    Listen(context, after.blockExplode, (event) => ChangedSupport(context, event.dimension.id, event.block.location));
    const bootstrap = options.System.run(() => {
      context.Runs.delete(bootstrap);
      if (context.Disposed) {
        return;
      }
      try {
        for (const player of options.World.getAllPlayers()) {
          Recover(context, player);
        }
        for (const dimension of ["overworld", "nether", "the_end"]) {
          for (const definition of options.Controls) {
            const entities = options.World.getDimension(dimension).getEntities({ type: definition.EntityType });
            for (const entity of entities) {
              try {
                Loaded(context, entity);
              } catch (error) {
                Report(context, error);
              }
            }
          }
        }
      } catch (error) {
        Report(context, error);
      }
    });
    context.Runs.add(bootstrap);
    const timer = options.System.runInterval(() => {
      try {
        Tick(context);
      } catch (error) {
        Report(context, error);
      }
    }, 1);
    context.Cleanup.push(() => options.System.clearRun(timer));
  } catch (error) {
    try {
      dispose();
    } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], "Diagetic startup rollback failed");
    }
    throw error;
  }
  return Object.freeze({
    Controls: context.Options.Controls,
    get Disposed() {
      return context.Disposed;
    },
    Dispose: dispose,
    Interact: (player, entity) => Observe(context, player, entity),
    IsInteracting: (player) => host.Players.get(player.id)?.Context === context
  });
};

// ../../Package/Bedform/Source/Internal/DiageticPose.ts
var Degrees2 = 180 / Math.PI;
var Wrap = (degrees) => {
  const wrapped = ((degrees + 180) % 360 + 360) % 360 - 180;
  return wrapped === 0 ? 0 : wrapped;
};
var MountAngles = (mount) => {
  const { Right: r, Up: u, Normal: n } = mount;
  const b = Math.asin(Math.max(-1, Math.min(1, -n.y)));
  let a;
  let c;
  if (Math.cos(b) > 1e-6) {
    a = Math.atan2(n.x, n.z);
    c = Math.atan2(r.y, u.y);
  } else {
    a = Math.atan2(-r.z, r.x);
    c = 0;
  }
  return {
    Yaw: Wrap(-a * Degrees2),
    Pitch: Wrap(b * Degrees2),
    Roll: Wrap(-c * Degrees2)
  };
};
var MotionValue = (configuration, value) => {
  const limits = configuration.Limits;
  const fraction = limits ? (value - limits.Min) / (limits.Max - limits.Min) - 0.5 : 0;
  switch (configuration.Kind) {
    case "lever":
      return -fraction * configuration.ArcDegrees + 0;
    case "slider":
      return fraction * configuration.Length * 16 + 0;
    default:
      return Wrap(-value);
  }
};
var Pose = (control, motion) => {
  const mount = MountFrame(control);
  const location = control.Entity.location;
  return {
    OffsetX: (mount.Position.x - location.x) * 16,
    OffsetY: (mount.Position.y - location.y) * 16,
    OffsetZ: -(mount.Position.z - location.z) * 16,
    ...MountAngles(mount),
    Motion: motion
  };
};
var PublishPose = (control, motion) => {
  const entity = control.Entity;
  if (!entity.isValid || typeof entity.getProperty(PoseProperty.Motion) !== "number") {
    return false;
  }
  const values = Pose(control, motion);
  for (const name of Object.keys(PoseProperty)) {
    const [min, max] = name.startsWith("Offset") ? PoseRange.Offset : name === "Motion" ? PoseRange.Motion : PoseRange.Angle;
    const value = Math.max(min, Math.min(max, values[name]));
    const current = entity.getProperty(PoseProperty[name]);
    if (typeof current !== "number" || Math.abs(current - value) > 1e-6 * Math.max(1, Math.abs(value))) {
      entity.setProperty(PoseProperty[name], value);
    }
  }
  return true;
};

// ../../Package/Bedform/Source/Internal/DiageticPersistence.ts
var Pose2 = (input) => {
  return Object.freeze({
    Offset: Coordinates(input?.Offset ?? {
      x: 0,
      y: 0,
      z: 0
    }),
    Rotation: Coordinates(input?.Rotation ?? {
      x: 0,
      y: 0,
      z: 0
    })
  });
};
var ReadRecord = (entity, kind) => {
  const retired = entity.getDynamicProperty(DynamicProperty.Retired);
  if (retired !== void 0 && retired !== true) {
    throw new Error("Malformed Diagetic retirement marker");
  }
  const raw = entity.getDynamicProperty(DynamicProperty.Control);
  if (raw === void 0) {
    return void 0;
  }
  if (typeof raw !== "string" || raw.length > 16384) {
    throw new Error("Malformed Diagetic control record");
  }
  const value = JSON.parse(raw);
  if (!value || value.Version !== 1 || value.Kind !== kind || value.Value === void 0 || !value.Pose || !value.Pose.Offset || !value.Pose.Rotation || value.Binding !== void 0 && (!value.Binding || typeof value.Binding !== "object")) {
    throw new Error("Unsupported or malformed Diagetic control record");
  }
  return Object.freeze({
    Version: 1,
    Value: value.Value,
    Pose: Pose2(value.Pose),
    Binding: Binding(value.Binding)
  });
};
var ReadControl = (entity, configuration) => {
  const value = ReadRecord(entity, configuration.Kind);
  return value && Object.freeze({
    Version: 1,
    Kind: configuration.Kind,
    Value: CheckValue(value.Value, configuration.Limits),
    Pose: value.Pose,
    Binding: value.Binding
  });
};
var WriteControl = (entity, value) => {
  const raw = JSON.stringify(value);
  if (raw.length > 16384) {
    throw new Error("Diagetic control record is too large");
  }
  entity.setDynamicProperty(DynamicProperty.Control, raw);
  if (entity.getDynamicProperty(DynamicProperty.Control) !== raw) {
    throw new Error("Diagetic control record did not commit");
  }
};

// ../../Package/Bedform/Source/Diagetic.ts
var CarrierSize = 0.75;
var Handles = /* @__PURE__ */ new WeakMap();
var Make2 = (configuration) => {
  const config = Configure(configuration);
  const owner = Object.freeze({});
  const attach = (entity, initial, pose, binding) => {
    if (!entity?.isValid || entity.typeId !== config.EntityType) {
      throw new TypeError("Diagetic Attach requires a valid entity of the configured type");
    }
    const tracked = FindAttached(definition, entity.id);
    if (tracked) {
      return tracked;
    }
    const existing = Handles.get(entity);
    if (existing) {
      if (existing.Owner !== owner) {
        throw new TypeError("Diagetic entity is already attached to another definition");
      }
    }
    const saved = existing ? void 0 : ReadControl(entity, config);
    const state = existing ?? {
      Owner: owner,
      Motion: Make(config, saved?.Value ?? initial),
      Pose: saved?.Pose ?? pose,
      Binding: saved?.Binding ?? binding,
      Removed: false
    };
    const persist = (value) => WriteControl(entity, {
      Version: 1,
      Kind: config.Kind,
      Value: value,
      Pose: state.Pose,
      Binding: state.Binding
    });
    if (!existing && !saved) {
      persist(initial);
    }
    const handle = Object.freeze({
      Definition: definition,
      Entity: entity,
      get Value() {
        return state.Motion.State.Value;
      },
      Pose: state.Pose,
      Binding: state.Binding,
      get IsValid() {
        return !state.Removed && entity.isValid;
      },
      SetValue(next) {
        if (!handle.IsValid) {
          throw new Error("Diagetic handle no longer refers to a valid entity");
        }
        const previous = state.Motion.State.Value;
        CheckValue(next, config.Limits);
        if (next !== previous) {
          persist(next);
        }
        state.Motion.SetValue(next);
        if (next !== previous) {
          try {
            present(next);
            config.OnChange?.(Object.freeze({
              Control: handle,
              PreviousValue: previous,
              Value: next,
              Source: "programmatic"
            }));
          } finally {
            Wake(definition, handle);
          }
        } else {
          Wake(definition, handle);
        }
      },
      Motion: Object.freeze({
        get State() {
          return state.Motion.State;
        },
        Begin(frame, pointer) {
          if (!handle.IsValid) {
            throw new Error("Diagetic handle no longer refers to a valid entity");
          }
          state.Motion.Begin(frame, pointer);
          Wake(definition, handle);
        },
        Look(sample) {
          if (!handle.IsValid) {
            throw new Error("Diagetic handle no longer refers to a valid entity");
          }
          const accepted = state.Motion.Look(sample);
          Wake(definition, handle);
          return accepted;
        },
        Release() {
          state.Motion.Release();
          Wake(definition, handle);
        },
        SetValue(next) {
          handle.SetValue(next);
        },
        Step() {
          if (!handle.IsValid) {
            throw new Error("Diagetic handle no longer refers to a valid entity");
          }
          const previous = handle.Value;
          const next = state.Motion.Step();
          if (next.Value !== previous) {
            try {
              persist(next.Value);
            } catch (error) {
              state.Motion.SetValue(previous);
              throw error;
            }
            present(next.Value);
            config.OnChange?.(Object.freeze({
              Control: handle,
              PreviousValue: previous,
              Value: next.Value,
              Source: next.Dragging ? "input" : "simulation"
            }));
          }
          return next;
        }
      }),
      Remove() {
        if (!state.Removed) {
          if (entity.isValid) {
            entity.remove();
          }
          state.Removed = true;
          Handles.delete(entity);
          state.Motion.Release();
        }
      }
    });
    const present = (value) => {
      PublishPose(handle, MotionValue(config, value));
    };
    Handles.set(entity, state);
    present(state.Motion.State.Value);
    Wake(definition, handle);
    return handle;
  };
  const definition = Object.freeze({
    Kind: config.Kind,
    EntityType: config.EntityType,
    Configuration: config,
    Spawn(dimension, location, options = {}) {
      const { Value, Pose: Pose3, Binding: receipt, Initialize, ...nativeOptions } = options;
      const initial = CheckValue(Value ?? config.InitialValue, config.Limits);
      const modelPose = Pose2(Pose3);
      const binding = Binding(receipt);
      const position = Coordinates(location);
      if (Initialize !== void 0 && typeof Initialize !== "function") {
        throw new TypeError("Diagetic Initialize must be a function");
      }
      const entity = dimension.spawnEntity(config.EntityType, position, nativeOptions);
      try {
        const handle = attach(entity, initial, modelPose, binding);
        Initialize?.(entity, handle);
        if (!handle.IsValid) {
          throw new Error("Diagetic initialization removed or invalidated the spawned entity");
        }
        return handle;
      } catch (error) {
        const state = Handles.get(entity);
        if (state) {
          state.Removed = true;
        }
        Handles.delete(entity);
        if (entity.isValid) {
          try {
            entity.remove();
          } catch (cleanupError) {
            throw new AggregateError([error, cleanupError], "Diagetic spawn rollback failed");
          }
        }
        throw error;
      }
    },
    Attach(entity) {
      return attach(entity, config.InitialValue, Pose2());
    }
  });
  RegisterDefinition(definition);
  return definition;
};
var Lever = (options = {}) => {
  return Make2({
    ...options,
    Kind: "lever"
  });
};
var Slider = (options = {}) => {
  return Make2({
    ...options,
    Kind: "slider"
  });
};
var Wheel = (options = {}) => {
  return Make2({
    ...options,
    Kind: "wheel"
  });
};
var BindingLocation = (binding) => {
  const { Position: position, Face: face } = Binding(binding);
  const normal = {
    x: face === "East" ? 1 : face === "West" ? -1 : 0,
    y: face === "Up" ? 1 : face === "Down" ? -1 : 0,
    z: face === "South" ? 1 : face === "North" ? -1 : 0
  };
  return {
    x: position.x + 0.5 + normal.x * 0.75,
    y: position.y + 0.5 + normal.y * 0.75 - CarrierSize / 2,
    z: position.z + 0.5 + normal.z * 0.75
  };
};
var Start = (options) => {
  if (!options?.World || typeof options.World.getDimension !== "function" || !options.System || typeof options.System.runInterval !== "function" || typeof options.System.clearRun !== "function" || !Array.isArray(options.Controls)) {
    throw new TypeError("Diagetic Start requires explicit World, System and Controls");
  }
  if (options.OnError !== void 0 && typeof options.OnError !== "function") {
    throw new TypeError("Diagetic OnError must be a function");
  }
  const types = /* @__PURE__ */ new Set();
  for (const control of options.Controls) {
    if (!IsDefinition(control) || types.has(control.EntityType)) {
      throw new TypeError("Diagetic Controls must be definitions with unique entity types");
    }
    types.add(control.EntityType);
  }
  return StartRuntime(options);
};

// Script/Main.ts
import { system, world } from "@minecraft/server";
var Controls = Object.freeze({
  lever: Lever(),
  slider: Slider(),
  wheel: Wheel()
});
var Faces = ["Up", "Down", "North", "South", "East", "West"];
var Reach = 8;
function KindOf(value) {
  if (value !== "lever" && value !== "slider" && value !== "wheel") {
    throw new TypeError("Diagetic placement kind must be lever, slider or wheel");
  }
  return value;
}
function Bind(kind, dimension, position, face, value) {
  const block = dimension.getBlock(position);
  if (!block || block.isAir) {
    throw new Error("Diagetic placement requires a loaded, solid supporting block");
  }
  const binding = {
    Dimension: dimension.id,
    Position: block.location,
    Face: face,
    ExpectedBlockType: block.typeId
  };
  return Controls[kind].Spawn(dimension, BindingLocation(binding), {
    Binding: binding,
    Value: value,
    initialPersistence: true
  });
}
function Free(kind, dimension, location, yaw, value) {
  return Controls[kind].Spawn(dimension, location, {
    initialRotation: yaw,
    initialPersistence: true,
    Value: value,
    Pose: { Offset: {
      x: 0,
      y: CarrierSize / 2,
      z: 0
    } }
  });
}
function PlaceFromPlayer(player, words) {
  const kind = KindOf(words[0]);
  const free = words.includes("free");
  const number = words.slice(1).find((word) => word !== "free");
  const value = number === void 0 ? void 0 : Number(number);
  if (value !== void 0 && !Number.isFinite(value)) {
    throw new TypeError("Diagetic placement value must be a number");
  }
  const hit = free ? void 0 : player.getBlockFromViewDirection({
    maxDistance: Reach,
    includeLiquidBlocks: false,
    includePassableBlocks: false
  });
  if (hit) {
    return Bind(kind, player.dimension, hit.block.location, hit.face, value);
  }
  const eye = player.getHeadLocation();
  const view = player.getViewDirection();
  return Free(kind, player.dimension, {
    x: eye.x + view.x * 1.5,
    y: eye.y + view.y * 1.5 - CarrierSize / 2,
    z: eye.z + view.z * 1.5
  }, player.getRotation().y + 180, value);
}
function PlaceFromRequest(request, source) {
  const kind = KindOf(request?.Kind);
  const dimension = world.getDimension(request.Dimension ?? source?.dimension.id ?? "overworld");
  if (request.Face !== void 0) {
    if (!Faces.includes(request.Face)) {
      throw new TypeError("Diagetic placement face must be a native block face");
    }
    return Bind(kind, dimension, request.Position, request.Face, request.Value);
  }
  return Free(kind, dimension, request.Position, request.Yaw ?? 0, request.Value);
}
function Place(event) {
  if (event.id !== Keys_exports.ScriptEvent.Place) {
    return;
  }
  const source = event.sourceEntity;
  const player = source?.typeId === "minecraft:player" ? source : void 0;
  try {
    const message = event.message.trim();
    const handle = message.startsWith("{") ? PlaceFromRequest(JSON.parse(message), event.sourceEntity) : player ? PlaceFromPlayer(player, message.toLowerCase().split(/\s+/u)) : (() => {
      throw new Error("Word placement requires a player; send a JSON request instead");
    })();
    player?.sendMessage(`Placed ${handle.Definition.Kind}${handle.Binding ? " on " + handle.Binding.Face.toLowerCase() + " face" : ""}.`);
  } catch (error) {
    const text = `Diagetic placement failed: ${error instanceof Error ? error.message : String(error)}`;
    if (player) {
      player.sendMessage(`\xA7c${text}`);
    } else {
      console.warn(text);
    }
  }
}
Start({
  World: world,
  System: system,
  Controls: Object.values(Controls),
  OnError: (error) => console.warn(`[BedformCommon] ${String(error)}`)
});
system.afterEvents.scriptEventReceive.subscribe(Place, { namespaces: ["bedform"] });
export {
  Controls
};
