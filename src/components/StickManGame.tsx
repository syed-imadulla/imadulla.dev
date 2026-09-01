import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

export function StickManGame() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const scoreRef     = useRef<HTMLDivElement>(null);
  const highScoreRef = useRef<HTMLDivElement>(null);
  const scoreBarRef  = useRef<HTMLDivElement>(null);
  const introRef     = useRef<HTMLDivElement>(null);
  const perfectRef   = useRef<HTMLDivElement>(null);
  const newHighScoreRef = useRef<HTMLDivElement>(null);
  const restartRef   = useRef<HTMLDivElement>(null);
  const jumpBtnRef   = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!containerRef.current || !canvasRef.current || !scoreRef.current || !introRef.current || !perfectRef.current || !restartRef.current) return;

    const container = containerRef.current!;
    const canvas    = canvasRef.current!;
    const scoreBarEl = scoreBarRef.current;
    const introEl   = introRef.current!;
    const perfectEl = perfectRef.current!;
    const newHighScoreEl = newHighScoreRef.current;
    const restartBtn = restartRef.current!;
    const jumpBtn    = jumpBtnRef.current;

    // ── Personal High Score Logic ───────────────────────────────────────────────
    let hasEndedGame = false;
    let runStartHighScore = 0;

    function getPersonalHighScore(): number {
      try {
        const stored = localStorage.getItem('stickman-high-score');
        return stored ? parseInt(stored, 10) || 0 : 0;
      } catch {
        return 0;
      }
    }

    function setPersonalHighScore(val: number) {
      try {
        localStorage.setItem('stickman-high-score', val.toString());
      } catch (err) {
        console.warn('Failed to save personal high score', err);
      }
    }

    // ── Anti-Cheat Layer 1: DevTools Keyboard Shortcut Blocker ─────────────
    const preventDevToolsHotkeys = (e: KeyboardEvent) => {
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) ||
        (e.ctrlKey && (e.key === 'u' || e.key === 'U'))
      ) {
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', preventDevToolsHotkeys);

    // ── Anti-Cheat Layer 3: In-Memory XOR Masking ────
    let _sMask = Math.floor(Math.random() * 0xffff) + 1;
    let _sEnc = 0 ^ _sMask;

    function getScore(): number {
      return _sEnc ^ _sMask;
    }

    function setScore(val: number) {
      _sMask = Math.floor(Math.random() * 0xffff) + 1;
      _sEnc = val ^ _sMask;
    }

    // ── Anti-Cheat Layer 4: Physics & Timing Rate Limiter ───────────────────
    let lastJumpTimestamp = Date.now();

    function addScorePoints(pts: number): boolean {
      const now = Date.now();
      const diff = now - lastJumpTimestamp;
      // Single jump takes > 700ms. If points > 2 or diff < 700ms, flag as cheated!
      if (pts > 2 || (diff < 700 && getScore() > 0)) {
        setScore(0);
        enforceScoreBarDOM();
        return false;
      }
      lastJumpTimestamp = now;
      const newScore = getScore() + pts;
      setScore(newScore);
      enforceScoreBarDOM();
      return true;
    }

    // ── Anti-Cheat Layer 5: Deep Observer & Polling DOM Audit ───────────────
    let isUpdatingDOM = false;

    function enforceScoreBarDOM() {
      if (isUpdatingDOM || !scoreBarEl) return;
      isUpdatingDOM = true;

      const currentScoreSpan = scoreBarEl.querySelector('.score-stat-card:not(.highlight) .stat-val');
      const currentHighSpan  = scoreBarEl.querySelector('.score-stat-card.highlight .stat-val');
      const curScore = getScore();
      const curHigh  = getPersonalHighScore();

      if (!currentScoreSpan || !currentHighSpan || currentScoreSpan.tagName !== 'SPAN' || currentHighSpan.tagName !== 'SPAN') {
        scoreBarEl.innerHTML = `
          <div class="score-stat-card">
            <span class="stat-label">SCORE</span>
            <span class="stat-val">${curScore}</span>
          </div>
          <div class="score-stat-card highlight">
            <span class="stat-label">HIGH SCORE</span>
            <span class="stat-val">${curHigh}</span>
          </div>
        `;
      } else {
        if (currentScoreSpan.textContent !== String(curScore)) {
          currentScoreSpan.textContent = String(curScore);
        }
        if (currentHighSpan.textContent !== String(curHigh)) {
          currentHighSpan.textContent = String(curHigh);
        }
      }

      isUpdatingDOM = false;
    }

    const domObserver = new MutationObserver(() => {
      enforceScoreBarDOM();
    });

    if (scoreBarEl) {
      domObserver.observe(scoreBarEl, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true
      });
    }

    const auditTimer = setInterval(enforceScoreBarDOM, 350);

    enforceScoreBarDOM();

    // ── Helpers ──────────────────────────────────────────────────────────────
    const lastOf = <T,>(arr: T[]): T => arr[arr.length - 1];
    const sinus = (degree: number) => Math.sin((degree / 180) * Math.PI);

    // ── Config ──────────────────────────────────────────────────────────────
    const canvasWidth          = 375;
    const canvasHeight         = 375;
    const platformHeight       = 100;
    const heroDistanceFromEdge = 10;
    const paddingX             = 100;
    const perfectAreaSize      = 10;
    const bgSpeedMult          = 0.2;
    const hill1Base = 100, hill1Amp = 10, hill1Stretch = 1;
    const hill2Base = 70,  hill2Amp = 20, hill2Stretch = 0.5;
    const stretchingSpeed    = 4;
    const turningSpeed       = 4;
    const walkingSpeed       = 4;
    const transitioningSpeed = 2;
    const fallingSpeed       = 2;
    const heroWidth  = 17;
    const heroHeight = 30;

    // ── State ────────────────────────────────────────────────────────────────
    type Phase = 'waiting' | 'stretching' | 'turning' | 'walking' | 'transitioning' | 'falling';
    let phase: Phase = 'waiting';
    let lastTimestamp: number | undefined;
    let heroX = 0, heroY = 0, sceneOffset = 0;
    let isActive = true;
    let animId = 0;

    type Platform = { x: number; w: number };
    type Stick    = { x: number; length: number; rotation: number };
    type Tree     = { x: number; color: string };

    let platforms: Platform[] = [];
    let sticks:    Stick[]    = [];
    let trees:     Tree[]     = [];

    // ── Canvas sizing ────────────────────────────────────────────────────────
    const resize = () => {
      canvas.width  = container.clientWidth;
      canvas.height = container.clientHeight;
    };
    resize();

    const ctx = canvas.getContext('2d')!;

    // ── Generation helpers ───────────────────────────────────────────────────
    function generateTree() {
      const last = trees[trees.length - 1];
      const x = (last ? last.x : 0) + 30 + Math.floor(Math.random() * 120);
      const treeColors = ['#6D8821', '#8FAC34', '#98B333'];
      trees.push({ x, color: treeColors[Math.floor(Math.random() * 3)] });
    }

    function generatePlatform() {
      const last = lastOf(platforms);
      const x = last.x + last.w + 40 + Math.floor(Math.random() * 160);
      const w = 20 + Math.floor(Math.random() * 80);
      platforms.push({ x, w });
    }

    // ── Reset ────────────────────────────────────────────────────────────────
    function resetGame() {
      hasEndedGame = false;
      runStartHighScore = getPersonalHighScore();
      phase = 'waiting';
      lastTimestamp = undefined;
      sceneOffset = 0;
      setScore(0);
      enforceScoreBarDOM();

      introEl.style.opacity  = '1';
      perfectEl.style.opacity = '0';
      if (newHighScoreEl) newHighScoreEl.style.opacity = '0';
      restartBtn.style.display = 'none';

      if (jumpBtn) {
        jumpBtn.innerText = 'HOLD TO STRETCH';
      }

      platforms = [{ x: 50, w: 50 }];
      for (let i = 0; i < 4; i++) generatePlatform();

      sticks = [{ x: platforms[0].x + platforms[0].w, length: 0, rotation: 0 }];

      trees = [];
      for (let i = 0; i < 10; i++) generateTree();

      heroX = platforms[0].x + platforms[0].w - heroDistanceFromEdge;
      heroY = 0;

      draw();
    }

    // ── Hit detection ─────────────────────────────────────────────────────────
    function thePlatformTheStickHits(): [Platform | undefined, boolean] {
      const stick = lastOf(sticks);
      if (stick.rotation !== 90) throw Error(`Stick is ${stick.rotation}°`);
      const farX = stick.x + stick.length;
      const hit  = platforms.find(p => p.x < farX && farX < p.x + p.w);
      if (hit) {
        const mid = hit.x + hit.w / 2;
        const perfect = mid - perfectAreaSize / 2 < farX && farX < mid + perfectAreaSize / 2;
        return [hit, perfect];
      }
      return [undefined, false];
    }

    // ── Main loop ─────────────────────────────────────────────────────────────
    function animate(timestamp: number) {
      if (!isActive) return;
      if (!lastTimestamp) {
        lastTimestamp = timestamp;
        animId = requestAnimationFrame(animate);
        return;
      }
      const dt = timestamp - lastTimestamp;
      const stick = lastOf(sticks);

      switch (phase) {
        case 'waiting': return;

        case 'stretching':
          stick.length += dt / stretchingSpeed;
          break;

        case 'turning':
          stick.rotation += dt / turningSpeed;
          if (stick.rotation > 90) {
            stick.rotation = 90;
            const [next, perf] = thePlatformTheStickHits();
            if (next) {
              addScorePoints(perf ? 2 : 1);
              if (perf) {
                perfectEl.style.opacity = '1';
                setTimeout(() => { perfectEl.style.opacity = '0'; }, 1000);
              }
              generatePlatform();
              generateTree();
              generateTree();
            }
            phase = 'walking';
          }
          break;

        case 'walking': {
          heroX += dt / walkingSpeed;
          const [next] = thePlatformTheStickHits();
          if (next) {
            const maxX = next.x + next.w - heroDistanceFromEdge;
            if (heroX > maxX) { heroX = maxX; phase = 'transitioning'; }
          } else {
            const maxX = stick.x + stick.length + heroWidth;
            if (heroX > maxX) { heroX = maxX; phase = 'falling'; }
          }
          break;
        }

        case 'transitioning': {
          sceneOffset += dt / transitioningSpeed;
          const [next] = thePlatformTheStickHits();
          if (next && sceneOffset > next.x + next.w - paddingX) {
            sticks.push({ x: next.x + next.w, length: 0, rotation: 0 });
            phase = 'waiting';
          }
          break;
        }

        case 'falling': {
          if (stick.rotation < 180) stick.rotation += dt / turningSpeed;
          heroY += dt / fallingSpeed;
          const maxHeroY = platformHeight + 100 + (canvas.height - canvasHeight) / 2;
          if (heroY > maxHeroY) {
            restartBtn.style.display = 'flex';
            if (jumpBtn) {
              jumpBtn.innerText = 'RESTART GAME';
            }
            if (!hasEndedGame) {
              hasEndedGame = true;
              const finalScore = getScore();
              
              if (finalScore > runStartHighScore) {
                setPersonalHighScore(finalScore);
                enforceScoreBarDOM();
                
                if (newHighScoreEl) {
                  newHighScoreEl.style.opacity = '1';
                  setTimeout(() => {
                    if (newHighScoreEl) newHighScoreEl.style.opacity = '0';
                  }, 1000);
                }
              }
            }
            return;
          }
          break;
        }

        default: throw Error('Wrong phase');
      }

      draw();
      lastTimestamp = timestamp;
      animId = requestAnimationFrame(animate);
    }

    // ── Draw helpers ──────────────────────────────────────────────────────────
    function getHillY(wx: number, base: number, amp: number, stretch: number) {
      return sinus((sceneOffset * bgSpeedMult + wx) * stretch) * amp + (canvas.height - base);
    }

    function getTreeY(x: number, base: number, amp: number) {
      return sinus(x) * amp + (canvas.height - base);
    }

    function drawHill(base: number, amp: number, stretch: number, color: string) {
      ctx.beginPath();
      ctx.moveTo(0, canvas.height);
      ctx.lineTo(0, getHillY(0, base, amp, stretch));
      for (let i = 0; i < canvas.width; i++) {
        ctx.lineTo(i, getHillY(i, base, amp, stretch));
      }
      ctx.lineTo(canvas.width, canvas.height);
      ctx.fillStyle = color;
      ctx.fill();
    }

    function drawTree(x: number, color: string) {
      ctx.save();
      ctx.translate(
        (-sceneOffset * bgSpeedMult + x) * hill1Stretch,
        getTreeY(x, hill1Base, hill1Amp)
      );
      ctx.fillStyle = '#7D833C';
      ctx.fillRect(-1, -5, 2, 5);
      ctx.beginPath();
      ctx.moveTo(-5, -5);
      ctx.lineTo(0, -30);
      ctx.lineTo(5, -5);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.restore();
    }

    function drawBackground() {
      const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
      grad.addColorStop(0, '#BBD691');
      grad.addColorStop(1, '#FEF1E1');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      drawHill(hill1Base, hill1Amp, hill1Stretch, '#95C629');
      drawHill(hill2Base, hill2Amp, hill2Stretch, '#659F1C');
      trees.forEach(t => drawTree(t.x, t.color));
    }

    function drawPlatforms() {
      const stick = lastOf(sticks);
      platforms.forEach(({ x, w }) => {
        ctx.fillStyle = 'black';
        ctx.fillRect(x, canvasHeight - platformHeight, w, platformHeight + (canvas.height - canvasHeight) / 2);
        if (stick.x < x) {
          ctx.fillStyle = 'red';
          ctx.fillRect(x + w / 2 - perfectAreaSize / 2, canvasHeight - platformHeight, perfectAreaSize, perfectAreaSize);
        }
      });
    }

    function drawRoundedRect(x: number, y: number, w: number, h: number, r: number) {
      ctx.beginPath();
      ctx.moveTo(x, y + r);
      ctx.lineTo(x, y + h - r);
      ctx.arcTo(x, y + h, x + r, y + h, r);
      ctx.lineTo(x + w - r, y + h);
      ctx.arcTo(x + w, y + h, x + w, y + h - r, r);
      ctx.lineTo(x + w, y + r);
      ctx.arcTo(x + w, y, x + w - r, y, r);
      ctx.lineTo(x + r, y);
      ctx.arcTo(x, y, x, y + r, r);
      ctx.fill();
    }

    function drawHero() {
      ctx.save();
      ctx.fillStyle = 'black';
      ctx.translate(heroX - heroWidth / 2, heroY + canvasHeight - platformHeight - heroHeight / 2);
      drawRoundedRect(-heroWidth / 2, -heroHeight / 2, heroWidth, heroHeight - 4, 5);
      ctx.beginPath(); ctx.arc(5, 11.5, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(-5, 11.5, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.fillStyle = 'white'; ctx.arc(5, -7, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'red';
      ctx.fillRect(-heroWidth / 2 - 1, -12, heroWidth + 2, 4.5);
      ctx.beginPath(); ctx.moveTo(-9, -14.5); ctx.lineTo(-17, -18.5); ctx.lineTo(-14, -8.5); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-10, -10.5); ctx.lineTo(-15, -3.5); ctx.lineTo(-5, -7); ctx.fill();
      ctx.restore();
    }

    function drawSticks() {
      sticks.forEach(stick => {
        ctx.save();
        ctx.translate(stick.x, canvasHeight - platformHeight);
        ctx.rotate((Math.PI / 180) * stick.rotation);
        ctx.beginPath();
        ctx.lineWidth = 2;
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -stick.length);
        ctx.stroke();
        ctx.restore();
      });
    }

    function draw() {
      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawBackground();
      ctx.translate((canvas.width - canvasWidth) / 2 - sceneOffset, (canvas.height - canvasHeight) / 2);
      drawPlatforms();
      drawHero();
      drawSticks();
      ctx.restore();
    }

    // ── Event listeners ───────────────────────────────────────────────────────
    const onMouseDown = () => {
      if (jumpBtn && jumpBtn.innerText === 'RESTART GAME') {
        resetGame();
        return;
      }

      if (phase === 'waiting') {
        lastTimestamp = undefined;
        introEl.style.opacity = '0';
        phase = 'stretching';
        animId = requestAnimationFrame(animate);
      }
    };

    const onMouseUp = () => {
      if (phase === 'stretching') phase = 'turning';
    };

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      onMouseDown();
    };

    const onResize = () => { resize(); draw(); };

    if (jumpBtn) {
      jumpBtn.addEventListener('mousedown',  onMouseDown);
      jumpBtn.addEventListener('touchstart', onTouchStart, { passive: false });
    }
    
    window.addEventListener('mouseup',   onMouseUp);
    window.addEventListener('touchend',  onMouseUp);
    window.addEventListener('resize',    onResize);

    restartBtn.addEventListener('click', (e) => {
      e.preventDefault();
      resetGame();
    });

    resetGame();
    animId = requestAnimationFrame(animate);

    return () => {
      isActive = false;
      window.removeEventListener('keydown', preventDevToolsHotkeys);
      clearInterval(auditTimer);
      domObserver.disconnect();
      cancelAnimationFrame(animId);
      if (jumpBtn) {
        jumpBtn.removeEventListener('mousedown',  onMouseDown);
        jumpBtn.removeEventListener('touchstart', onTouchStart);
      }
      window.removeEventListener('mouseup',   onMouseUp);
      window.removeEventListener('touchend',  onMouseUp);
      window.removeEventListener('resize',    onResize);
    };
  }, []);

  return (

        <motion.div
          className="game-box-wrapper"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
        >
          {/* Top Score & High Score Bar */}
          <div ref={scoreBarRef} className="game-score-bar">
            <div className="score-stat-card">
              <span className="stat-label">SCORE</span>
              <span ref={scoreRef} className="stat-val">0</span>
            </div>
            <div className="score-stat-card highlight">
              <span className="stat-label">HIGH SCORE</span>
              <span ref={highScoreRef} className="stat-val">0</span>
            </div>
          </div>

          {/* The rectangular game canvas area */}
          <div ref={containerRef} className="game-canvas-container-new game-canvas-rect">
            {/* Canvas */}
            <canvas
              ref={canvasRef}
              className="game-canvas-new"
              style={{ cursor: 'pointer', display: 'block' }}
            />

            {/* Intro overlay */}
            <div ref={introRef} className="game-intro-new">
              Tap &amp; hold on the button below<br />
              to stretch out a stick
            </div>

            {/* Perfect text */}
            <div ref={perfectRef} className="game-perfect-new">
              DOUBLE SCORE!
            </div>

            {/* New High Score text */}
            <div ref={newHighScoreRef} className="game-perfect-new">
              HIGH SCORE!
            </div>

            {/* Restart overlay text */}
            <div ref={restartRef} className="game-over-text">
              GAME OVER
            </div>
          </div>

          {/* Action button */}
          <div className="game-bottom-controls">
            <button ref={jumpBtnRef} className="game-action-btn">
              HOLD TO STRETCH
            </button>
          </div>
        </motion.div>
  );
}
