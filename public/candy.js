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
  const held = new Set();
  const cooldown = new Map();
  const gifts = [];

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
      minY = Math.max(box.minY, ((spriteH + 18) / officeRect.height) * 100);
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

  function give(seat, manual) {
    const now = performance.now();
    const key = seat.getAttribute("href") || seat.getAttribute("aria-label") || "seat";
    if ((cooldown.get(key) || 0) > now) return false;
    cooldown.set(key, now + (manual ? 2500 : 16000));
    seat.querySelectorAll(".thanks, .candy-pop").forEach((node) => node.remove());
    const pop = document.createElement("span");
    pop.className = "candy-pop";
    pop.textContent = "🍬";
    pop.setAttribute("aria-hidden", "true");
    const thanks = document.createElement("p");
    thanks.className = "bubble thanks";
    thanks.textContent = "Thanks!";
    seat.classList.add("thanking");
    seat.append(pop, thanks);
    gifts.push({ seat, pop, thanks, until: now + 1700 });
    return true;
  }

  function shrug() {
    shrugUntil = performance.now() + 480;
    root.classList.add("shrug");
  }

  function offer() {
    const seat = nearestSeat();
    if (!seat || !give(seat, true)) shrug();
  }

  function jump() {
    hopUntil = performance.now() + 420;
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

    for (let index = gifts.length - 1; index >= 0; index -= 1) {
      const gift = gifts[index];
      if (now < gift.until) continue;
      gift.pop.remove();
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
    if (mode === "drive") {
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
        if (near && Math.random() < 0.45) give(near, false);
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
      if (near) give(near, false);
    }
  }

  window.requestAnimationFrame(frame);
})();
