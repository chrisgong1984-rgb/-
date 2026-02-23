/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Target, Trophy, AlertTriangle, RefreshCw, Languages, Info, Biohazard, Skull, Activity, Zap } from 'lucide-react';
import confetti from 'canvas-confetti';

// --- Constants & Types ---

type GameStatus = 'START' | 'PLAYING' | 'WON' | 'LOST' | 'SHOP';
type Language = 'EN' | 'ZH';

const TOTAL_ROUNDS = 20;

const THEME = {
  primary: '#8b0000', // Dark Blood Red
  secondary: '#ff0000', // Bright Blood Red
  bg: '#020202',
  accent: '#4a0000', // Deep Maroon
};

interface Point {
  x: number;
  y: number;
}

class BloodStain {
  pos: Point;
  size: number;
  opacity: number = 0.6;
  rotation: number;

  constructor(pos: Point) {
    this.pos = { ...pos };
    this.size = 10 + Math.random() * 30;
    this.rotation = Math.random() * Math.PI * 2;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    ctx.rotate(this.rotation);
    ctx.globalAlpha = this.opacity;
    ctx.fillStyle = THEME.primary;
    
    // Draw irregular splatter shape
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const r = this.size * (0.5 + Math.random() * 0.5);
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    
    ctx.restore();
    ctx.globalAlpha = 1.0;
  }
}

class Zombie {
  id: number;
  start: Point;
  pos: Point;
  target: Point;
  speed: number;
  isDestroyed: boolean = false;
  health: number;
  maxHealth: number;
  isElite: boolean;
  trail: Point[] = [];
  twitchOffset: number = 0;
  limbAngle: number = 0;
  damagedBy: Set<Explosion> = new Set();

  constructor(id: number, width: number, targets: Point[], round: number) {
    this.id = id;
    this.start = { x: Math.random() * width, y: -40 };
    this.pos = { ...this.start };
    this.target = targets[Math.floor(Math.random() * targets.length)];
    
    // Elite chance increases with round
    this.isElite = Math.random() < 0.1 + (round * 0.02);
    this.maxHealth = this.isElite ? 5 : 1;
    this.health = this.maxHealth;
    this.speed = (this.isElite ? 0.3 : 0.5) + Math.random() * 1.0;
  }

  update() {
    this.trail.push({ ...this.pos });
    if (this.trail.length > 20) this.trail.shift();

    const dx = this.target.x - this.start.x;
    const dy = this.target.y - this.start.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const vx = (dx / distance) * this.speed;
    const vy = (dy / distance) * this.speed;

    this.pos.x += vx;
    this.pos.y += vy;

    // Twitching animation
    this.twitchOffset = Math.sin(Date.now() * 0.02) * (this.isElite ? 4 : 2);
    this.limbAngle = Math.sin(Date.now() * 0.01) * 0.5;

    if (this.pos.y >= this.target.y) {
      return true; // Reached target
    }
    return false;
  }

  draw(ctx: CanvasRenderingContext2D) {
    // Draw blood trail
    if (this.trail.length > 1) {
      ctx.beginPath();
      ctx.moveTo(this.trail[0].x, this.trail[0].y);
      for (let i = 1; i < this.trail.length; i++) {
        ctx.lineTo(this.trail[i].x, this.trail[i].y);
      }
      ctx.strokeStyle = this.isElite ? 'rgba(150, 0, 0, 0.5)' : 'rgba(100, 0, 0, 0.3)';
      ctx.lineWidth = this.isElite ? 8 : 4;
      ctx.stroke();
    }

    ctx.save();
    ctx.translate(this.pos.x + this.twitchOffset, this.pos.y);
    const angle = Math.atan2(this.target.y - this.start.y, this.target.x - this.start.x) + Math.PI / 2;
    ctx.rotate(angle);

    // Horrifying Fleshy Body
    ctx.fillStyle = this.isElite ? '#2a0000' : '#3a0000';
    ctx.beginPath();
    const bodyW = this.isElite ? 10 : 6;
    const bodyH = this.isElite ? 16 : 10;
    ctx.ellipse(0, 0, bodyW, bodyH, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Health bar for elites
    if (this.isElite && this.health < this.maxHealth) {
      ctx.fillStyle = '#000';
      ctx.fillRect(-10, -20, 20, 3);
      ctx.fillStyle = '#f00';
      ctx.fillRect(-10, -20, 20 * (this.health / this.maxHealth), 3);
    }

    // Exposed Ribs/Bones
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 1;
    const ribCount = this.isElite ? 8 : 4;
    for (let i = -bodyH/2; i <= bodyH/2; i += bodyH/ribCount) {
      ctx.beginPath();
      ctx.moveTo(-bodyW + 2, i);
      ctx.lineTo(bodyW - 2, i);
      ctx.stroke();
    }

    // Twitching Limbs
    ctx.strokeStyle = this.isElite ? '#4a0000' : '#5a0000';
    ctx.lineWidth = this.isElite ? 4 : 2;
    // Left arm
    ctx.beginPath();
    ctx.moveTo(-bodyW + 1, -2);
    ctx.lineTo(-bodyW - 8, -8 + Math.sin(Date.now() * 0.015) * 5);
    ctx.stroke();
    // Right arm
    ctx.beginPath();
    ctx.moveTo(bodyW - 1, -2);
    ctx.lineTo(bodyW + 8, -8 + Math.cos(Date.now() * 0.015) * 5);
    ctx.stroke();

    // Glowing Undead Eyes
    ctx.fillStyle = this.isElite ? '#ff6a00' : '#ff0000';
    ctx.beginPath();
    ctx.arc(-2, bodyH - 2, 1.5, 0, Math.PI * 2);
    ctx.arc(2, bodyH - 2, 1.5, 0, Math.PI * 2);
    ctx.fill();
    // Eye glow
    ctx.shadowBlur = this.isElite ? 20 : 10;
    ctx.shadowColor = this.isElite ? '#ff6a00' : '#ff0000';
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.restore();
  }
}

class Interceptor {
  pos: Point;
  target: Point;
  start: Point;
  speed: number = 7;
  isExploded: boolean = false;
  trail: Point[] = [];

  constructor(start: Point, target: Point) {
    this.start = { ...start };
    this.pos = { ...start };
    this.target = { ...target };
  }

  update() {
    this.trail.push({ ...this.pos });
    if (this.trail.length > 10) this.trail.shift();

    const dx = this.target.x - this.pos.x;
    const dy = this.target.y - this.pos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < this.speed) {
      this.pos = { ...this.target };
      this.isExploded = true;
      return true;
    }

    this.pos.x += (dx / distance) * this.speed;
    this.pos.y += (dy / distance) * this.speed;
    return false;
  }

  draw(ctx: CanvasRenderingContext2D) {
    // Draw trail
    if (this.trail.length > 1) {
      ctx.beginPath();
      ctx.moveTo(this.trail[0].x, this.trail[0].y);
      for (let i = 1; i < this.trail.length; i++) {
        ctx.lineTo(this.trail[i].x, this.trail[i].y);
      }
      ctx.strokeStyle = `rgba(100, 200, 255, 0.2)`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.moveTo(this.start.x, this.start.y);
    ctx.lineTo(this.pos.x, this.pos.y);
    ctx.strokeStyle = 'rgba(100, 200, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(this.pos.x, this.pos.y, 2, 0, Math.PI * 2);
    ctx.fillStyle = '#64c8ff';
    ctx.fill();

    // Draw target marker
    ctx.beginPath();
    ctx.moveTo(this.target.x - 5, this.target.y - 5);
    ctx.lineTo(this.target.x + 5, this.target.y + 5);
    ctx.moveTo(this.target.x + 5, this.target.y - 5);
    ctx.lineTo(this.target.x - 5, this.target.y + 5);
    ctx.strokeStyle = '#64c8ff';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

class Explosion {
  pos: Point;
  radius: number = 0;
  maxRadius: number = 40;
  growthRate: number = 1.5;
  isFinished: boolean = false;
  phase: 'GROWING' | 'SHRINKING' = 'GROWING';

  constructor(pos: Point) {
    this.pos = { ...pos };
  }

  update() {
    if (this.phase === 'GROWING') {
      this.radius += this.growthRate;
      if (this.radius >= this.maxRadius) {
        this.phase = 'SHRINKING';
      }
    } else {
      this.radius -= this.growthRate * 0.5;
      if (this.radius <= 0) {
        this.isFinished = true;
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    const gradient = ctx.createRadialGradient(
      this.pos.x, this.pos.y, 0,
      this.pos.x, this.pos.y, this.radius
    );
    gradient.addColorStop(0, '#ff0000');
    gradient.addColorStop(0.6, '#8b0000');
    gradient.addColorStop(1, 'rgba(74, 0, 0, 0)');

    ctx.beginPath();
    ctx.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();

    // Add some splatter particles
    if (this.phase === 'GROWING') {
      ctx.fillStyle = '#ff0000';
      for (let i = 0; i < 5; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * this.radius * 1.5;
        ctx.beginPath();
        ctx.arc(this.pos.x + Math.cos(angle) * dist, this.pos.y + Math.sin(angle) * dist, Math.random() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

// --- Main Component ---

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<GameStatus>('START');
  const [lang, setLang] = useState<Language>('ZH');
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(1);
  const [upgrades, setUpgrades] = useState({
    radius: 40,
    speed: 7,
  });
  
  // Game state refs (to avoid closure issues in game loop)
  const zombiesRef = useRef<Zombie[]>([]);
  const interceptorsRef = useRef<Interceptor[]>([]);
  const explosionsRef = useRef<Explosion[]>([]);
  const bloodStainsRef = useRef<BloodStain[]>([]);
  const batteriesRef = useRef<{ x: number, y: number, active: boolean }[]>([]);
  const citiesRef = useRef<{ x: number, y: number, active: boolean }[]>([]);
  const wallsRef = useRef<{ x: number, y: number, health: number, maxHealth: number }[]>([]);
  const lastSpawnTime = useRef(0);
  const lastFireTime = useRef(0);
  const frameId = useRef<number>(0);
  const shake = useRef(0);
  const zombiesSpawned = useRef(0);
  const zombiesProcessed = useRef(0);
  const zombiesToSpawn = useRef(0);

  const t = {
    title: lang === 'ZH' ? 'Tina活死人黎明' : 'Tina Dawn of Dead',
    start: lang === 'ZH' ? '开始处决' : 'Begin Execution',
    restart: lang === 'ZH' ? '再次尝试' : 'Try Again',
    win: lang === 'ZH' ? '肃清完成' : 'Purge Complete',
    loss: lang === 'ZH' ? '末日降临' : 'Doomsday',
    score: lang === 'ZH' ? '处决数' : 'Executions',
    round: lang === 'ZH' ? '尸潮波次' : 'Zombie Wave',
    shop: lang === 'ZH' ? '地下黑市' : 'Black Market',
    nextWave: lang === 'ZH' ? '迎接下一波' : 'Next Wave',
    repairCity: lang === 'ZH' ? '加固幸存者营地' : 'Fortify Camp',
    repairBattery: lang === 'ZH' ? '雇佣武装人员' : 'Hire Personnel',
    buildWall: lang === 'ZH' ? '修筑防御墙' : 'Build Wall',
    upgradeRadius: lang === 'ZH' ? '增强弹药威力' : 'Ammo Power',
    upgradeSpeed: lang === 'ZH' ? '提高射击初速' : 'Muzzle Velocity',
    cost: lang === 'ZH' ? '代价' : 'Cost',
    insufficient: lang === 'ZH' ? '处决数不足' : 'Not enough executions',
    instructions: lang === 'ZH' 
      ? '点击屏幕发射高压血清，处决那些变异的活死人。保护最后的幸存者！' 
      : 'Click to fire high-pressure serum. Execute the mutated living dead. Protect the last survivors!',
    winMsg: lang === 'ZH' ? '你从尸山血海中杀出了一条生路！' : 'You have carved a path through the mountain of corpses!',
    lossMsg: lang === 'ZH' ? '活死人淹没了最后的防线，世界陷入永恒的黑暗...' : 'The living dead have overwhelmed the last line of defense...',
  };

  const startWave = useCallback((waveNum: number) => {
    zombiesSpawned.current = 0;
    zombiesProcessed.current = 0;
    zombiesToSpawn.current = 5 + waveNum * 3;
    setStatus('PLAYING');
  }, []);

  const initGame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const w = canvas.width;
    const h = canvas.height;

    // Initialize batteries
    batteriesRef.current = [
      { x: w * 0.5, y: h - 40, active: true },
    ];

    // Initialize cities
    citiesRef.current = [
      { x: w * 0.25, y: h - 20, active: true },
      { x: w * 0.35, y: h - 20, active: true },
      { x: w * 0.65, y: h - 20, active: true },
      { x: w * 0.75, y: h - 20, active: true },
    ];

    zombiesRef.current = [];
    interceptorsRef.current = [];
    explosionsRef.current = [];
    bloodStainsRef.current = [];
    wallsRef.current = [];
    setScore(0);
    setRound(1);
    setUpgrades({ radius: 40, speed: 7 });
    startWave(1);
  }, [startWave]);

  const handleCanvasClick = (e: React.MouseEvent | React.TouchEvent) => {
    if (status !== 'PLAYING') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    spawnInterceptor(x, y);
  };

  const spawnInterceptor = (x: number, y: number) => {
    const b = batteriesRef.current[0];
    if (!b || !b.active) return;

    lastFireTime.current = Date.now();

    // Single shot logic
    const inter = new Interceptor({ x: b.x, y: b.y }, { x, y });
    inter.speed = upgrades.speed;
    interceptorsRef.current.push(inter);
  };

  const gameLoop = useCallback((time: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    // Clear
    ctx.save(); // Save state before shake
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Apply Screen Shake
    if (shake.current > 0) {
      const sx = (Math.random() - 0.5) * shake.current;
      const sy = (Math.random() - 0.5) * shake.current;
      ctx.translate(sx, sy);
      shake.current *= 0.9;
      if (shake.current < 0.1) shake.current = 0;
    }

    // Draw Stars (Dust/Spores)
    ctx.fillStyle = '#4a0000';
    for (let i = 0; i < 40; i++) {
      const x = (Math.sin(i * 123.45) * 0.5 + 0.5) * canvas.width;
      const y = (Math.cos(i * 678.90) * 0.5 + 0.5) * canvas.height;
      const size = Math.random() * 3;
      ctx.globalAlpha = 0.2 + Math.random() * 0.3;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;

    // Draw Blood Stains
    bloodStainsRef.current.forEach(stain => stain.draw(ctx));

    if (status === 'PLAYING') {
      // Spawn zombies
      const spawnInterval = Math.max(300, 1500 - round * 100);
      if (time - lastSpawnTime.current > spawnInterval && zombiesSpawned.current < zombiesToSpawn.current) {
        const activeTargets = [
          ...batteriesRef.current.filter(b => b.active),
          ...citiesRef.current.filter(c => c.active)
        ];
        
        if (activeTargets.length > 0) {
          const zombie = new Zombie(Date.now(), canvas.width, activeTargets, round);
          zombiesRef.current.push(zombie);
          zombiesSpawned.current++;
          lastSpawnTime.current = time;
        }
      }

      // Update & Draw Zombies
      zombiesRef.current = zombiesRef.current.filter(zombie => {
        const reached = zombie.update();
        if (reached) {
          zombiesProcessed.current++;
          // Check what it hit (Walls first)
          let hitSomething = false;
          wallsRef.current.forEach(w => {
            if (w.health > 0 && Math.abs(zombie.pos.x - w.x) < 30) {
              w.health -= zombie.isElite ? 2 : 1;
              hitSomething = true;
            }
          });

          if (!hitSomething) {
            batteriesRef.current.forEach(b => {
              if (b.active && Math.abs(zombie.pos.x - b.x) < 20) {
                b.active = false;
              }
            });
            citiesRef.current.forEach(c => {
              if (c.active && Math.abs(zombie.pos.x - c.x) < 20) {
                c.active = false;
              }
            });
          }
          
          bloodStainsRef.current.push(new BloodStain(zombie.pos));
          explosionsRef.current.push(new Explosion(zombie.pos));
          shake.current = 10;
          return false;
        }
        zombie.draw(ctx);
        return true;
      });

      // Update & Draw Interceptors
      interceptorsRef.current = interceptorsRef.current.filter(inter => {
        const exploded = inter.update();
        if (exploded) {
          const exp = new Explosion(inter.pos);
          exp.maxRadius = upgrades.radius;
          explosionsRef.current.push(exp);
          shake.current = 5;
          return false;
        }
        inter.draw(ctx);
        return true;
      });

      // Update & Draw Explosions
      explosionsRef.current = explosionsRef.current.filter(exp => {
        exp.update();
        exp.draw(ctx);

        // Check collision with zombies
        zombiesRef.current.forEach(zombie => {
          const dist = Math.sqrt(Math.pow(zombie.pos.x - exp.pos.x, 2) + Math.pow(zombie.pos.y - exp.pos.y, 2));
          if (dist < exp.radius && !zombie.damagedBy.has(exp)) {
            zombie.health -= 1;
            zombie.damagedBy.add(exp);
            if (zombie.health <= 0) {
              if (!zombie.isDestroyed) {
                setScore(s => s + (zombie.isElite ? 100 : 20));
                zombie.isDestroyed = true;
                zombiesProcessed.current++;
              }
            }
          }
        });

        return !exp.isFinished;
      });

      // Remove destroyed zombies
      zombiesRef.current = zombiesRef.current.filter(z => !z.isDestroyed);

      // Check Wave End
      if (zombiesProcessed.current >= zombiesToSpawn.current && zombiesRef.current.length === 0 && explosionsRef.current.length === 0) {
        if (round >= TOTAL_ROUNDS) {
          setStatus('WON');
          confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 }
          });
        } else {
          setStatus('SHOP');
        }
      }

      const activeBatteries = batteriesRef.current.filter(b => b.active).length;
      const activeCities = citiesRef.current.filter(c => c.active).length;
      if (activeBatteries === 0 && activeCities === 0) {
        setStatus('LOST');
      }
    }

    // Draw Ground
    const groundGrad = ctx.createLinearGradient(0, canvas.height - 15, 0, canvas.height);
    groundGrad.addColorStop(0, '#0a0000');
    groundGrad.addColorStop(1, '#2a0000');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, canvas.height - 15, canvas.width, 15);

    // Draw Walls
    wallsRef.current.forEach(w => {
      if (w.health <= 0) return;
      const wallH = 40;
      const wallW = 60;
      ctx.fillStyle = '#333';
      ctx.fillRect(w.x - wallW/2, w.y - wallH, wallW, wallH);
      // Cracks based on health
      if (w.health < w.maxHealth) {
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(w.x - 10, w.y - 30);
        ctx.lineTo(w.x + 10, w.y - 10);
        ctx.stroke();
      }
      // Health bar
      ctx.fillStyle = '#000';
      ctx.fillRect(w.x - 20, w.y - wallH - 10, 40, 4);
      ctx.fillStyle = '#0f0';
      ctx.fillRect(w.x - 20, w.y - wallH - 10, 40 * (w.health / w.maxHealth), 4);
    });

    // Draw Batteries (Armed Personnel)
    batteriesRef.current.forEach((b) => {
      if (!b.active) {
        // Dead body
        ctx.fillStyle = '#3a0000';
        ctx.beginPath();
        ctx.ellipse(b.x, b.y + 5, 10, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      
      // Soldier Body
      ctx.fillStyle = '#1a2a1a'; // Camo green
      ctx.beginPath();
      ctx.ellipse(b.x, b.y - 5, 8, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Head
      ctx.fillStyle = '#d2b48c'; // Tan skin
      ctx.beginPath();
      ctx.arc(b.x, b.y - 20, 5, 0, Math.PI * 2);
      ctx.fill();
      
      // Helmet
      ctx.fillStyle = '#0a1a0a';
      ctx.beginPath();
      ctx.arc(b.x, b.y - 21, 6, Math.PI, 0);
      ctx.fill();
      
      // Rifle
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y - 10);
      ctx.lineTo(b.x + 15, b.y - 15);
      ctx.stroke();
      
      // Muzzle flash hint
      if (Date.now() - lastFireTime.current < 50) {
        const muzzleGrad = ctx.createRadialGradient(b.x + 15, b.y - 15, 0, b.x + 15, b.y - 15, 10);
        muzzleGrad.addColorStop(0, '#fff');
        muzzleGrad.addColorStop(0.5, '#ff0');
        muzzleGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = muzzleGrad;
        ctx.beginPath();
        ctx.arc(b.x + 15, b.y - 15, 10, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Draw Cities (Realistic Bunkers)
    citiesRef.current.forEach(c => {
      if (!c.active) return;
      
      // Bunker Body
      const bunkerGrad = ctx.createLinearGradient(c.x - 15, c.y, c.x + 15, c.y);
      bunkerGrad.addColorStop(0, '#333');
      bunkerGrad.addColorStop(0.5, '#555');
      bunkerGrad.addColorStop(1, '#333');
      ctx.fillStyle = bunkerGrad;
      ctx.beginPath();
      ctx.moveTo(c.x - 15, c.y);
      ctx.lineTo(c.x - 10, c.y - 25);
      ctx.lineTo(c.x + 10, c.y - 25);
      ctx.lineTo(c.x + 15, c.y);
      ctx.closePath();
      ctx.fill();
      
      // Windows
      ctx.fillStyle = '#ff000033';
      ctx.fillRect(c.x - 6, c.y - 18, 12, 4);
      
      // Red Cross Detail
      ctx.fillStyle = '#8b0000';
      ctx.fillRect(c.x - 1, c.y - 10, 2, 6);
      ctx.fillRect(c.x - 3, c.y - 8, 6, 2);
    });

    ctx.restore(); // Restore state after drawing everything

    frameId.current = requestAnimationFrame(gameLoop);
  }, [status, score, round]);

  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    frameId.current = requestAnimationFrame(gameLoop);
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(frameId.current);
    };
  }, [gameLoop]);

  return (
    <div className="relative w-full h-screen bg-[#0a0a1a] overflow-hidden font-sans text-white select-none">
      {/* Game Canvas */}
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-crosshair touch-none"
        onClick={handleCanvasClick}
      />

      {/* HUD */}
      <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-start pointer-events-none">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-4 py-2 rounded-lg border border-red-500/30">
            <Biohazard className="w-4 h-4 text-red-500" />
            <span className="text-sm font-mono tracking-wider text-red-500">{t.score}: {score}</span>
          </div>
          <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-4 py-2 rounded-lg border border-green-500/30">
            <Activity className="w-4 h-4 text-green-500" />
            <span className="text-sm font-mono tracking-wider text-green-500">{t.round}: {round} / {TOTAL_ROUNDS}</span>
          </div>
        </div>

        <button 
          onClick={() => setLang(l => l === 'EN' ? 'ZH' : 'EN')}
          className="pointer-events-auto bg-black/40 backdrop-blur-md p-2 rounded-full border border-white/10 hover:bg-white/10 transition-colors"
        >
          <Languages className="w-5 h-5" />
        </button>
      </div>

      {/* Overlay Screens */}
      <AnimatePresence>
        {status !== 'PLAYING' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center bg-[#0a0a1a]/80 backdrop-blur-sm p-6 z-50"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              className="max-w-lg w-full bg-[#1a1a2e] p-10 rounded-[2.5rem] border border-white/10 shadow-[0_30px_60px_rgba(0,0,0,0.5)] text-center relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#4ecca3] to-transparent opacity-50" />
              {status === 'START' && (
                <div className="flex flex-col items-center">
                  <motion.div 
                    initial={{ y: -20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="w-24 h-24 bg-gradient-to-br from-red-900 to-black rounded-full flex items-center justify-center mb-8 shadow-[0_0_50px_rgba(139,0,0,0.6)] border-4 border-red-900"
                  >
                    <Skull className="w-12 h-12 text-red-500" />
                  </motion.div>
                  
                  <motion.h1 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="text-6xl font-black mb-4 tracking-tighter bg-gradient-to-b from-red-600 to-red-950 bg-clip-text text-transparent uppercase italic"
                  >
                    {t.title}
                  </motion.h1>
                  
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="grid grid-cols-2 gap-4 mb-10 w-full"
                  >
                    <div className="bg-red-950/40 p-4 rounded-2xl border border-red-500/30 text-left">
                      <div className="flex items-center gap-2 text-red-600 mb-2">
                        <Skull className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase tracking-wider">Carnage</span>
                      </div>
                      <p className="text-xs text-white/60 leading-relaxed">
                        {lang === 'ZH' ? '血肉横飞，唯有杀戮才能生存。' : 'Flesh will fly. Only slaughter ensures survival.'}
                      </p>
                    </div>
                    <div className="bg-red-950/40 p-4 rounded-2xl border border-red-500/30 text-left">
                      <div className="flex items-center gap-2 text-red-400 mb-2">
                        <Zap className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase tracking-wider">Violence</span>
                      </div>
                      <p className="text-xs text-white/60 leading-relaxed">
                        {lang === 'ZH' ? '点击屏幕释放高压血清弹幕。' : 'Click to unleash high-pressure serum barrages.'}
                      </p>
                    </div>
                  </motion.div>

                  <motion.button
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    onClick={initGame}
                    className="group relative w-full py-5 bg-red-900 hover:bg-red-800 text-white font-black text-2xl rounded-2xl transition-all transform active:scale-95 overflow-hidden border-b-8 border-black"
                  >
                    <div className="absolute inset-0 bg-red-500/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500 skew-x-12" />
                    <span className="relative flex items-center justify-center gap-3">
                      <Skull className="w-8 h-8 group-hover:scale-125 transition-transform duration-300" />
                      {t.start}
                    </span>
                  </motion.button>
                  
                  {/* Subtitle removed per request */}
                </div>
              )}

              {status === 'SHOP' && (
                <div className="flex flex-col items-center w-full">
                  <div className="w-16 h-16 bg-red-900/20 rounded-full flex items-center justify-center mb-4 border border-red-500/40">
                    <Zap className="w-8 h-8 text-red-500" />
                  </div>
                  <h1 className="text-3xl font-black mb-6 text-red-500 uppercase italic">{t.shop}</h1>
                  
                  <div className="grid grid-cols-1 gap-3 w-full mb-8">
                    {/* Repair City */}
                    <button 
                      disabled={score < 200 || citiesRef.current.every(c => c.active)}
                      onClick={() => {
                        const inactive = citiesRef.current.find(c => !c.active);
                        if (inactive) {
                          inactive.active = true;
                          setScore(s => s - 200);
                        }
                      }}
                      className="flex items-center justify-between p-4 bg-black/40 rounded-xl border border-white/5 hover:border-red-500/40 disabled:opacity-30 disabled:hover:border-white/5 transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <Shield className="w-5 h-5 text-blue-400" />
                        <span className="text-sm font-bold">{t.repairCity}</span>
                      </div>
                      <span className="text-xs font-mono text-red-500">{t.cost}: 200</span>
                    </button>

                    {/* Repair Battery */}
                    <button 
                      disabled={score < 300 || batteriesRef.current[0].active}
                      onClick={() => {
                        if (!batteriesRef.current[0].active) {
                          batteriesRef.current[0].active = true;
                          setScore(s => s - 300);
                        }
                      }}
                      className="flex items-center justify-between p-4 bg-black/40 rounded-xl border border-white/5 hover:border-red-500/40 disabled:opacity-30 disabled:hover:border-white/5 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <RefreshCw className="w-5 h-5 text-green-400" />
                        <span className="text-sm font-bold">{t.repairBattery}</span>
                      </div>
                      <span className="text-xs font-mono text-red-500">{t.cost}: 300</span>
                    </button>

                    {/* Build Wall */}
                    <button 
                      disabled={score < 250 || (wallsRef.current.length >= 3 && wallsRef.current.every(w => w.health === w.maxHealth))}
                      onClick={() => {
                        const canvas = canvasRef.current;
                        if (!canvas) return;
                        const w = canvas.width;
                        const h = canvas.height;
                        
                        // Add or repair walls
                        if (wallsRef.current.length < 3) {
                          const xPositions = [w * 0.3, w * 0.5, w * 0.7];
                          const newX = xPositions[wallsRef.current.length];
                          wallsRef.current.push({ x: newX, y: h - 15, health: 10, maxHealth: 10 });
                        } else {
                          const damaged = wallsRef.current.find(w => w.health < w.maxHealth);
                          if (damaged) damaged.health = damaged.maxHealth;
                        }
                        setScore(s => s - 250);
                      }}
                      className="flex items-center justify-between p-4 bg-black/40 rounded-xl border border-white/5 hover:border-red-500/40 disabled:opacity-30 disabled:hover:border-white/5 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <Shield className="w-5 h-5 text-orange-400" />
                        <span className="text-sm font-bold">{t.buildWall}</span>
                      </div>
                      <span className="text-xs font-mono text-red-500">{t.cost}: 250</span>
                    </button>

                    {/* Upgrade Radius */}
                    <button 
                      disabled={score < 150}
                      onClick={() => {
                        setUpgrades(u => ({ ...u, radius: u.radius + 5 }));
                        setScore(s => s - 150);
                      }}
                      className="flex items-center justify-between p-4 bg-black/40 rounded-xl border border-white/5 hover:border-red-500/40 disabled:opacity-30 disabled:hover:border-white/5 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <Target className="w-5 h-5 text-red-400" />
                        <span className="text-sm font-bold">{t.upgradeRadius}</span>
                      </div>
                      <span className="text-xs font-mono text-red-500">{t.cost}: 150</span>
                    </button>

                    {/* Upgrade Speed */}
                    <button 
                      disabled={score < 100}
                      onClick={() => {
                        setUpgrades(u => ({ ...u, speed: u.speed + 1 }));
                        setScore(s => s - 100);
                      }}
                      className="flex items-center justify-between p-4 bg-black/40 rounded-xl border border-white/5 hover:border-red-500/40 disabled:opacity-30 disabled:hover:border-white/5 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <Zap className="w-5 h-5 text-yellow-400" />
                        <span className="text-sm font-bold">{t.upgradeSpeed}</span>
                      </div>
                      <span className="text-xs font-mono text-red-500">{t.cost}: 100</span>
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      setRound(r => r + 1);
                      startWave(round + 1);
                    }}
                    className="w-full py-4 bg-red-900 hover:bg-red-800 text-white font-black rounded-xl transition-all transform active:scale-95 flex items-center justify-center gap-2 border-b-4 border-black"
                  >
                    {t.nextWave}
                  </button>
                </div>
              )}

              {status === 'WON' && (
                <>
                  <div className="w-20 h-20 bg-yellow-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <Trophy className="w-10 h-10 text-yellow-500" />
                  </div>
                  <h1 className="text-4xl font-bold mb-2 text-yellow-500">{t.win}</h1>
                  <div className="text-2xl font-mono mb-4">{t.score}: {score}</div>
                  <p className="text-white/60 mb-8">{t.winMsg}</p>
                  <button
                    onClick={initGame}
                    className="w-full py-4 bg-yellow-500 hover:bg-yellow-600 text-[#0a0a1a] font-bold rounded-xl transition-all transform active:scale-95 flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-5 h-5" />
                    {t.restart}
                  </button>
                </>
              )}

              {status === 'LOST' && (
                <>
                  <div className="w-20 h-20 bg-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <AlertTriangle className="w-10 h-10 text-red-500" />
                  </div>
                  <h1 className="text-4xl font-bold mb-2 text-red-500">{t.loss}</h1>
                  <div className="text-2xl font-mono mb-4">{t.score}: {score}</div>
                  <p className="text-white/60 mb-8">{t.lossMsg}</p>
                  <button
                    onClick={initGame}
                    className="w-full py-4 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl transition-all transform active:scale-95 flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-5 h-5" />
                    {t.restart}
                  </button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Instructions Hint */}
      {status === 'PLAYING' && score < 100 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-white/5 backdrop-blur-sm px-4 py-2 rounded-full border border-white/10 pointer-events-none"
        >
          <div className="flex items-center gap-2 text-xs text-white/40">
            <Info className="w-3 h-3" />
            {t.instructions}
          </div>
        </motion.div>
      )}
    </div>
  );
}
