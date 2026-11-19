// Top-down plan of the maze: what the found camera shows the player.
import { layout, CELL, doorFor, entryFor } from './layout.js';

export function drawMap(ctx, data) {
  const { n, seed, cols, rows, self, others, monster, spots, puzzle } = data;
  const cells = layout(n, seed || 0);
  const half = (n - 1) / 2;
  const pad = 10;
  const size = Math.min(cols, rows) - pad * 2;
  const step = size / n;
  const ox = (cols - size) / 2, oy = (rows - size) / 2;

  const toX = (wx) => ox + (wx / CELL + half + 0.5) * step;
  const toY = (wz) => oy + (wz / CELL + half + 0.5) * step;

  ctx.clearRect(0, 0, cols, rows);
  ctx.fillStyle = '#120b09';
  ctx.fillRect(0, 0, cols, rows);

  // rooms
  for (let i = 0; i < cells.length; i++) {
    const x = i % n, z = Math.floor(i / n);
    ctx.fillStyle = '#2a1f1a';
    ctx.fillRect(ox + x * step + 1, oy + z * step + 1, step - 2, step - 2);
  }
  // walls
  ctx.strokeStyle = '#8a4a33';
  ctx.lineWidth = Math.max(1, step * 0.12);
  ctx.beginPath();
  for (let i = 0; i < cells.length; i++) {
    const x = i % n, z = Math.floor(i / n);
    const x0 = ox + x * step, y0 = oy + z * step;
    if (!cells[i].open[0]) { ctx.moveTo(x0, y0); ctx.lineTo(x0 + step, y0); }
    if (!cells[i].open[3]) { ctx.moveTo(x0, y0); ctx.lineTo(x0, y0 + step); }
    if (z === n - 1) { ctx.moveTo(x0, y0 + step); ctx.lineTo(x0 + step, y0 + step); }
    if (x === n - 1) { ctx.moveTo(x0 + step, y0); ctx.lineTo(x0 + step, y0 + step); }
  }
  ctx.stroke();

  // lift square
  const entry = entryFor(n);
  ctx.fillStyle = '#2f6b3a';
  ctx.fillRect(toX(entry.x) - step * 0.9, toY(entry.z) - step * 0.9, step * 1.8, step * 1.8);

  // central door
  const door = doorFor();
  ctx.fillStyle = puzzle && puzzle.door ? '#ffcf6b' : '#e0300f';
  ctx.fillRect(toX(door.x) - step * 0.8, toY(door.z) - step * 0.2, step * 1.6, step * 0.4);

  // items still on the floor
  const colours = { hammer: '#b9b2a4', crowbar: '#c85a3a', akA: '#d8452b', akB: '#3a72d8', rpg: '#7b8a4a', cameraA: '#39d6c8', cameraB: '#39d6c8' };
  for (const spot of spots || []) {
    if (puzzle && puzzle[spot.name]) continue;
    ctx.fillStyle = colours[spot.name] || '#ddd';
    ctx.beginPath();
    ctx.arc(toX(spot.x), toY(spot.z), Math.max(2.5, step * 0.22), 0, Math.PI * 2);
    ctx.fill();
  }

  const dot = (wx, wz, colour, size0) => {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.arc(toX(wx), toY(wz), Math.max(3, step * size0), 0, Math.PI * 2);
    ctx.fill();
  };
  for (const other of others || []) dot(other.x, other.z, other.down ? '#7a7a7a' : '#63c8ff', 0.3);
  if (self) dot(self.x, self.z, '#8dff7a', 0.34);
  if (monster) {
    dot(monster.x, monster.z, monster.sleeping ? '#8a5a3a' : '#ff2a08', 0.42);
    ctx.strokeStyle = monster.sleeping ? 'rgba(140,90,60,.5)' : 'rgba(255,60,20,.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(toX(monster.x), toY(monster.z), Math.max(6, step * 0.75), 0, Math.PI * 2);
    ctx.stroke();
  }
}
