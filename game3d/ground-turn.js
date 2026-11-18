// Distance and turn radius use the same units. A planted animal keeps its heading.
export function groundHeading(yaw, target, distance, radius) {
 const difference = Math.atan2(Math.sin(target - yaw), Math.cos(target - yaw));
 const limit = distance / radius;
 return yaw + Math.max(-limit, Math.min(limit, difference));
}

// Walk along the chord of a short arc. Point and goal are in tile coordinates.
export function groundStep(point, goal, yaw, budget, radius) {
 const dx = goal.x - point.x, dy = goal.y - point.y;
 const remaining = Math.hypot(dx, dy), step = Math.min(remaining, budget);
 if (!step) return {x:point.x, y:point.y, yaw, arrived:remaining === 0};
 const desired = Math.atan2(dx, dy);
 // A point inside the turning circle can be passed at the flank.
 const error = desired - yaw;
 if (remaining < radius * (1 - Math.cos(error)) && remaining < radius * 1.5) {
  return {x:point.x, y:point.y, yaw, arrived:true};
 }
 const nextYaw = groundHeading(yaw, desired, step, radius);
 const turn = nextYaw - yaw;
 const direction = yaw + turn / 2;
 const chord = Math.abs(turn) < .00001 ? step : 2 * step * Math.sin(turn / 2) / turn;
 const x = point.x + Math.sin(direction) * chord, y = point.y + Math.cos(direction) * chord;
 // A waypoint is a grazing destination. End a close pass before it becomes an orbit.
 const arrived = Math.hypot(goal.x - x, goal.y - y) < Math.max(radius * .25, budget * .25);
 return {x, y, yaw:nextYaw, arrived};
}
