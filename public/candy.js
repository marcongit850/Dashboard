// Visitor on the office floor. No fetches, no polling, no page refresh.
// pure:start
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function nearestIndex(points, radius) {
  let best = -1;
  let bestDistance = Infinity;
  for (let index = 0; index < points.length; index += 1) {
    const distance = Math.hypot(points[index].x, points[index].y);
    if (distance <= radius && distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  }
  return best;
}

function shouldResumeWander(lastInput, now, idleMs, keysHeld) {
  return !keysHeld && now - lastInput >= idleMs;
}

function typingInField(target) {
  if (!target || !target.tagName) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return Boolean(target.isContentEditable);
}

function officeInView(rect, viewHeight) {
  if (!rect || viewHeight <= 0) return false;
  const visible = Math.min(rect.bottom, viewHeight) - Math.max(rect.top, 0);
  return visible > viewHeight * 0.4;
}
// pure:end

(function () {
  const root = document.querySelector("[data-candy-walker]");
  const office = document.querySelector(".office");
  if (!root || !office) return;

  const IDLE_MS = 10000;
  const WALK_SPEED = 11;
  const DRIVE_SPEED = 26;
  const DESKS = [
    [14, 50], [32, 50], [50, 50], [70, 50], [86, 50],
    [18, 72], [40, 72], [62, 72], [82, 72],
    [20, 90], [42, 90], [64, 90], [84, 90],
    [50, 62], [34, 82],
  ];

  let x = 48;
  let y = 72;
  let tx = 48;
  let ty = 72;
  let mode = "wander";
  let lastInput = 0;
  let waitUntil = 0;
  let nextAuto = 0;
  let hopUntil = 0;
  let shrugUntil = 0;
  let last = 0;
  let act = null;
  const held = new Set();
  const autoReady = new Map();
  const manualReady = new Map();
  const gifts = [];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const REACH_MS = 280;
  const HOLD_MS = 200;
  const EXTEND_MS = 380;
  const RETURN_MS = 280;
  const ARC_MS = 480;
  const FADE_MS = 1000;

  function phone() {
    return window.matchMedia("(max-width: 700px)").matches;
  }

  function bounds() {
    if (phone()) return { minX: 8, maxX: 92, minY: 22, maxY: 97 };
    return { minX: 8, maxX: 92, minY: 46, maxY: 97 };
  }

  function place() {
    const box = bounds();
    const officeRect = office.getBoundingClientRect();
    const spriteH = root.getBoundingClientRect().height || 0;
    let minY = box.minY;
    if (officeRect.height > 0 && spriteH > 0) {
      minY = Math.max(box.minY, ((spriteH + 52) / officeRect.height) * 100);
    }
    if (minY > box.maxY - 1) minY = box.minY;
    x = clamp(x, box.minX, box.maxX);
    y = clamp(y, minY, box.maxY);
    root.style.left = x.toFixed(2) + "%";
    root.style.top = y.toFixed(2) + "%";
    const depth = y < 55 ? 1 : y < 76 ? 2 : y < 90 ? 3 : 4;
    root.classList.remove("depth-1", "depth-2", "depth-3", "depth-4");
    root.classList.add("depth-" + depth);
  }

  function face(dir) {
    if (dir < -0.2) {
      root.classList.add("face-left");
      root.classList.remove("face-right");
    } else if (dir > 0.2) {
      root.classList.add("face-right");
      root.classList.remove("face-left");
    }
  }

  function seats() {
    return [...office.querySelectorAll("a.seat")];
  }

  function targetPoints() {
    if (!phone()) return DESKS;
    const officeRect = office.getBoundingClientRect();
    if (officeRect.width < 1 || officeRect.height < 1) return DESKS;
    const spots = seats().map((seat) => {
      const rect = seat.getBoundingClientRect();
      const px = ((rect.left + rect.width / 2 - officeRect.left) / officeRect.width) * 100;
      const py = ((rect.top + rect.height * 0.78 - officeRect.top) / officeRect.height) * 100;
      return [px, py];
    });
    return spots.length ? spots : DESKS;
  }

  function pickTarget() {
    const spots = targetPoints();
    const spot = spots[Math.floor(Math.random() * spots.length)];
    const box = bounds();
    tx = clamp(spot[0] + (Math.random() * 6 - 3), box.minX, box.maxX);
    ty = clamp(spot[1] + (Math.random() * 4 - 2), box.minY, box.maxY);
  }

  function reach() {
    return phone() ? 110 : 156;
  }

  function nearestSeat() {
    const nodes = seats();
    if (!nodes.length) return null;
    const body = root.getBoundingClientRect();
    const originX = body.left + body.width / 2;
    const originY = body.top + body.height * 0.62;
    const points = nodes.map((seat) => {
      const rect = seat.getBoundingClientRect();
      return {
        x: rect.left + rect.width / 2 - originX,
        y: rect.top + rect.height * 0.45 - originY,
      };
    });
    const index = nearestIndex(points, reach());
    return index < 0 ? null : nodes[index];
  }

  function showThanks(seat) {
    seat.querySelectorAll(".thanks").forEach((node) => node.remove());
    const thanks = document.createElement("p");
    thanks.className = "bubble thanks";
    thanks.textContent = "Thanks!";
    seat.classList.add("thanking");
    seat.append(thanks);
    gifts.push({ seat, thanks, until: performance.now() + 1700 });
  }

  function pointOf(el) {
    const rect = el.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }

  function officePercent(clientX, clientY) {
    const rect = office.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * 100,
      y: ((clientY - rect.top) / rect.height) * 100,
    };
  }

  function easeOut(t) {
    return 1 - (1 - t) * (1 - t);
  }

  function easeIn(t) {
    return t * t;
  }

  function lerp(from, to, t) {
    return from + (to - from) * t;
  }

  function quad(p0, p1, p2, t) {
    const u = 1 - t;
    return {
      x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
      y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
    };
  }

  function wrapAngle(delta) {
    let angle = delta;
    while (angle > 180) angle -= 360;
    while (angle < -180) angle += 360;
    return angle;
  }

  function nearestArm(seat) {
    const seatRect = seat.getBoundingClientRect();
    const sx = seatRect.left + seatRect.width / 2;
    const sy = seatRect.top + seatRect.height * 0.45;
    let best = null;
    let bestDistance = Infinity;
    for (const arm of root.querySelectorAll(".arm")) {
      const tip = arm.querySelector(".hand-tip");
      if (!tip) continue;
      const hand = pointOf(tip);
      const distance = Math.hypot(hand.x - sx, hand.y - sy);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = arm;
      }
    }
    return best;
  }

  function restAngle(arm) {
    const origin = pointOf(arm.querySelector(".pivot"));
    const hand = pointOf(arm.querySelector(".hand-tip"));
    return Math.atan2(hand.y - origin.y, hand.x - origin.x);
  }

  function aimLocal(arm, seat, rest) {
    const origin = pointOf(arm.querySelector(".pivot"));
    const seatRect = seat.getBoundingClientRect();
    const aim = Math.atan2(seatRect.top + seatRect.height * 0.42 - origin.y, seatRect.left + seatRect.width / 2 - origin.x);
    let delta = wrapAngle((aim - rest) * 180 / Math.PI);
    if (root.classList.contains("face-left")) delta = -delta;
    return clamp(delta, -80, 80);
  }

  function inwardAngle(arm) {
    return arm.classList.contains("arm-l") ? -36 : 36;
  }

  function placeToss(toss, now) {
    if (!toss.landed) {
      const t = Math.min(1, (now - toss.t0) / ARC_MS);
      const point = quad(toss.from, toss.mid, toss.to, t);
      toss.node.style.left = point.x.toFixed(2) + "%";
      toss.node.style.top = point.y.toFixed(2) + "%";
      if (t >= 1) {
        toss.landed = true;
        toss.landAt = now;
        toss.node.classList.add("landed");
        showThanks(toss.seat);
      }
    }
    if (toss.landed && now - toss.landAt >= FADE_MS) {
      toss.node.remove();
      return false;
    }
    return true;
  }

  function launchToss(arm, seat) {
    const hand = pointOf(arm.querySelector(".hand-tip"));
    const seatRect = seat.getBoundingClientRect();
    const officeRect = office.getBoundingClientRect();
    const from = officePercent(hand.x, hand.y);
    const to = officePercent(seatRect.left + seatRect.width / 2, seatRect.top + seatRect.height * 0.62);
    const lift = officeRect.height > 0 ? (72 / officeRect.height) * 100 : 8;
    const mid = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - lift };
    const node = document.createElement("span");
    node.className = "tossed-candy";
    node.textContent = "🍬";
    node.setAttribute("aria-hidden", "true");
    node.style.left = from.x.toFixed(2) + "%";
    node.style.top = from.y.toFixed(2) + "%";
    office.append(node);
    return { node, from, mid, to, seat, t0: performance.now(), landed: false, landAt: 0 };
  }

  function dropOnDesk(seat) {
    const seatRect = seat.getBoundingClientRect();
    const spot = officePercent(seatRect.left + seatRect.width / 2, seatRect.top + seatRect.height * 0.62);
    const node = document.createElement("span");
    node.className = "tossed-candy landed";
    node.textContent = "🍬";
    node.setAttribute("aria-hidden", "true");
    node.style.left = spot.x.toFixed(2) + "%";
    node.style.top = spot.y.toFixed(2) + "%";
    office.append(node);
    showThanks(seat);
    act = {
      arm: null,
      seat,
      toss: { node, landed: true, landAt: performance.now(), seat },
    };
  }

  function finishArm() {
    if (!act || !act.arm) return;
    act.arm.style.transform = "";
    act.arm.classList.remove("offering", "holding");
    act.arm = null;
  }

  function tickAct(now) {
    if (!act) return;
    if (act.arm) {
      const elapsed = now - act.t0;
      const reachEnd = REACH_MS;
      const holdEnd = reachEnd + HOLD_MS;
      const extendEnd = holdEnd + EXTEND_MS;
      const returnEnd = extendEnd + RETURN_MS;
      const inward = inwardAngle(act.arm);
      let angle = 0;
      if (elapsed < reachEnd) {
        angle = lerp(0, inward, easeOut(elapsed / reachEnd));
      } else if (elapsed < holdEnd) {
        angle = inward;
        if (!act.held) {
          act.held = true;
          act.arm.classList.add("holding");
        }
      } else if (elapsed < extendEnd) {
        if (act.aim == null) act.aim = aimLocal(act.arm, act.seat, act.rest);
        angle = lerp(inward, act.aim, easeOut((elapsed - holdEnd) / EXTEND_MS));
      } else if (elapsed < returnEnd) {
        if (!act.released) {
          act.released = true;
          act.arm.classList.remove("holding");
          act.toss = launchToss(act.arm, act.seat);
        }
        const aim = act.aim == null ? 0 : act.aim;
        angle = lerp(aim, 0, easeIn((elapsed - extendEnd) / RETURN_MS));
      } else {
        finishArm();
      }
      if (act.arm) act.arm.style.transform = "rotate(" + angle.toFixed(2) + "deg)";
    }
    if (act && act.toss && !placeToss(act.toss, now)) act.toss = null;
    if (act && !act.arm && !act.toss) act = null;
  }

  function startHandoff(seat, manual) {
    if (act) return false;
    const now = performance.now();
    const key = seat.getAttribute("href") || seat.getAttribute("aria-label") || "seat";
    const gate = manual ? manualReady : autoReady;
    if ((gate.get(key) || 0) > now) return false;
    gate.set(key, now + (manual ? 900 : 16000));
    if (manual) autoReady.set(key, now + 16000);
    const arm = nearestArm(seat);
    if (reduceMotion.matches || !arm) {
      dropOnDesk(seat);
      return true;
    }
    root.classList.remove("hop");
    hopUntil = 0;
    act = {
      arm,
      seat,
      t0: now,
      rest: restAngle(arm),
      held: false,
      released: false,
      aim: null,
      toss: null,
    };
    arm.classList.add("offering");
    return true;
  }

  function shrug() {
    shrugUntil = performance.now() + 480;
    root.classList.add("shrug");
  }

  function offer() {
    if (act) return;
    const seat = nearestSeat();
    if (!seat || !startHandoff(seat, true)) shrug();
  }

  function jump() {
    if (act && act.arm) return;
    hopUntil = performance.now() + 660;
    root.classList.add("hop");
  }

  function onKeyDown(event) {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (typingInField(event.target)) return;
    if (!officeInView(office.getBoundingClientRect(), window.innerHeight || 0)) return;
    const key = event.key;
    if (key === "ArrowLeft" || key === "ArrowRight" || key === "ArrowUp" || key === "ArrowDown") {
      event.preventDefault();
      held.add(key);
      mode = "drive";
      lastInput = performance.now();
      return;
    }
    if (key === " " || key === "Spacebar") {
      if (event.target && event.target.tagName === "BUTTON") return;
      event.preventDefault();
      if (mode === "drive") lastInput = performance.now();
      if (!event.repeat) jump();
      return;
    }
    if (key === "Enter") {
      const tag = event.target && event.target.tagName;
      if (tag === "BUTTON" || tag === "A") return;
      event.preventDefault();
      if (mode === "drive") lastInput = performance.now();
      if (!event.repeat) offer();
    }
  }

  function onKeyUp(event) {
    held.delete(event.key);
  }

  window.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("keyup", onKeyUp, true);
  window.addEventListener("blur", () => held.clear());

  pickTarget();
  nextAuto = performance.now() + 5000 + Math.random() * 4000;

  function frame(now) {
    window.requestAnimationFrame(frame);
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;

    tickAct(now);

    for (let index = gifts.length - 1; index >= 0; index -= 1) {
      const gift = gifts[index];
      if (now < gift.until) continue;
      gift.thanks.remove();
      if (!gift.seat.querySelector(".thanks")) gift.seat.classList.remove("thanking");
      gifts.splice(index, 1);
    }
    if (hopUntil && now >= hopUntil) {
      root.classList.remove("hop");
      hopUntil = 0;
    }
    if (shrugUntil && now >= shrugUntil) {
      root.classList.remove("shrug");
      shrugUntil = 0;
    }

    if (mode === "drive" && shouldResumeWander(lastInput, now, IDLE_MS, held.size > 0)) {
      mode = "wander";
      pickTarget();
      waitUntil = 0;
    }

    let moving = false;
    const offering = act && act.arm;
    if (offering) {
      moving = false;
    } else if (mode === "drive") {
      let vx = 0;
      let vy = 0;
      if (held.has("ArrowLeft")) vx -= 1;
      if (held.has("ArrowRight")) vx += 1;
      if (held.has("ArrowUp")) vy -= 1;
      if (held.has("ArrowDown")) vy += 1;
      const mag = Math.hypot(vx, vy);
      if (mag > 0) {
        x += (vx / mag) * DRIVE_SPEED * dt;
        y += (vy / mag) * DRIVE_SPEED * dt;
        face(vx);
        moving = true;
      }
    } else if (now < waitUntil) {
      moving = false;
    } else {
      const dx = tx - x;
      const dy = ty - y;
      const dist = Math.hypot(dx, dy);
      if (dist < 0.8) {
        waitUntil = now + 700 + Math.random() * 1400;
        const near = nearestSeat();
        if (near && Math.random() < 0.45) startHandoff(near, false);
        pickTarget();
      } else {
        const step = Math.min(dist, WALK_SPEED * dt);
        x += (dx / dist) * step;
        y += (dy / dist) * step;
        face(dx);
        moving = step > 0.01;
      }
    }

    root.classList.toggle("walking", moving && !root.classList.contains("hop"));
    place();

    if (mode === "wander" && now >= nextAuto) {
      const gap = phone() ? 7000 : 11000;
      const spread = phone() ? 6000 : 8000;
      nextAuto = now + gap + Math.random() * spread;
      const near = nearestSeat();
      if (near) startHandoff(near, false);
    }
  }

  window.requestAnimationFrame(frame);
})();
