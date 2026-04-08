import { useEffect, useRef, useState } from "react";

const GAME_WIDTH = 420;
const GAME_HEIGHT = 640;
const PLAYER_WIDTH = 110;
const PLAYER_HEIGHT = 64;
const ROUND_SECONDS = 30;
const TOP_SCORES_KEY = "yemen-coffee-top-scores";
/** Seconds between new cherries while playing (higher = fewer drops). */
const SPAWN_INTERVAL_SEC = 1.8;
/** Pre-seeded cherries above the screen at round start. */
const INITIAL_CHERRY_COUNT = 5;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function loadTopScores() {
  try {
    const raw = localStorage.getItem(TOP_SCORES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((n) => Number.isFinite(n)).sort((a, b) => b - a).slice(0, 5)
      : [];
  } catch {
    return [];
  }
}

function saveTopScores(score) {
  const next = [...loadTopScores(), score]
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => b - a)
    .slice(0, 5);

  localStorage.setItem(TOP_SCORES_KEY, JSON.stringify(next));
  return next;
}

function makeCherry(id) {
  return {
    id,
    x: randomBetween(16, GAME_WIDTH - 44),
    y: -40,
    size: randomBetween(24, 34),
    speed: randomBetween(140, 240),
    drift: randomBetween(-20, 20),
    wobble: randomBetween(0, Math.PI * 2),
  };
}

function Cherry({ cherry }) {
  const size = cherry.size;
  return (
    <div
      style={{
        position: "absolute",
        width: size + 10,
        height: size + 14,
        left: cherry.x,
        top: cherry.y,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 0,
          width: 2,
          height: 9,
          transform: `translateX(-50%) rotate(${Math.sin(cherry.wobble + cherry.y * 0.02) * 20}deg)`,
          transformOrigin: "bottom center",
          background: "#2f6f3e",
          borderRadius: 999,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: 0,
          width: size,
          height: size,
          transform: "translateX(-50%)",
          borderRadius: "50%",
          border: "1px solid rgba(90,0,0,0.22)",
          background:
            "radial-gradient(circle at 32% 30%, #ffd7d7 0%, #f25a5a 24%, #cf2323 60%, #7f1010 100%)",
          boxShadow: "0 6px 10px rgba(0,0,0,0.18)",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: "22%",
            top: "20%",
            width: "26%",
            height: "26%",
            borderRadius: "50%",
            background: "rgba(255,255,255,0.28)",
            filter: "blur(1px)",
          }}
        />
      </div>
    </div>
  );
}

function Basket({ playerX }) {
  return (
    <div
      style={{
        position: "absolute",
        left: playerX,
        bottom: 10,
        width: PLAYER_WIDTH,
        height: PLAYER_HEIGHT,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 0,
          width: 42,
          height: 18,
          transform: "translateX(-50%)",
          border: "4px solid #7a4a12",
          borderBottom: "none",
          borderTopLeftRadius: 999,
          borderTopRightRadius: 999,
          background: "transparent",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 0,
          width: "100%",
          height: 46,
          borderRadius: "18px 18px 30px 30px",
          background: "linear-gradient(180deg, #dba45f 0%, #b7771b 48%, #8a5614 100%)",
          border: "1px solid rgba(70,35,0,0.18)",
          boxShadow: "0 10px 20px rgba(0,0,0,0.22)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 8,
            left: 0,
            right: 0,
            height: 2,
            background: "rgba(80,40,0,0.14)",
          }}
        />
        {[20, 40, 60, 80].map((p) => (
          <div
            key={p}
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: `${p}%`,
              width: 1,
              background: "rgba(80,40,0,0.16)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [started, setStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [topScores, setTopScores] = useState([]);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [playerX, setPlayerX] = useState(GAME_WIDTH / 2 - PLAYER_WIDTH / 2);
  const [cherries, setCherries] = useState([]);
  const [moveLeft, setMoveLeft] = useState(false);
  const [moveRight, setMoveRight] = useState(false);

  const timerRef = useRef(null);
  const animRef = useRef(null);
  const lastTimeRef = useRef(0);
  const spawnRef = useRef(0);
  const idRef = useRef(0);
  const savedRef = useRef(false);
  const gameAreaRef = useRef(null);
  const draggingRef = useRef(false);

  function updatePlayerFromClientX(clientX) {
    const el = gameAreaRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return;
    const scale = GAME_WIDTH / rect.width;
    const gameX = (clientX - rect.left) * scale;
    setPlayerX(clamp(gameX - PLAYER_WIDTH / 2, 0, GAME_WIDTH - PLAYER_WIDTH));
  }

  useEffect(() => {
    const scores = loadTopScores();
    setTopScores(scores);
    setHighScore(scores[0] || 0);
  }, []);

  useEffect(() => {
    const down = (e) => {
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") setMoveLeft(true);
      if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") setMoveRight(true);
    };
    const up = (e) => {
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") setMoveLeft(false);
      if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") setMoveRight(false);
    };

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useEffect(() => {
    if (!started) return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setStarted(false);
          setGameOver(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [started]);

  useEffect(() => {
    if (!started) return;

    const loop = (time) => {
      if (!lastTimeRef.current) lastTimeRef.current = time;
      const delta = (time - lastTimeRef.current) / 1000;
      lastTimeRef.current = time;

      setPlayerX((prev) => {
        let next = prev;
        const speed = 320;
        if (moveLeft) next -= speed * delta;
        if (moveRight) next += speed * delta;
        return clamp(next, 0, GAME_WIDTH - PLAYER_WIDTH);
      });

      spawnRef.current += delta;

      setCherries((prev) => {
        let next = prev.map((c) => ({
          ...c,
          y: c.y + c.speed * delta,
          x: clamp(c.x + Math.sin(c.wobble + c.y * 0.02) * c.drift * delta, 0, GAME_WIDTH - 40),
        }));

        while (spawnRef.current >= SPAWN_INTERVAL_SEC) {
          spawnRef.current -= SPAWN_INTERVAL_SEC;
          idRef.current += 1;
          next.push(makeCherry(idRef.current));
        }

        const basketBox = {
          left: playerX,
          right: playerX + PLAYER_WIDTH,
          top: GAME_HEIGHT - PLAYER_HEIGHT - 4,
          bottom: GAME_HEIGHT,
        };

        let caught = 0;
        next = next.filter((c) => {
          const size = c.size;
          const hit =
            !(basketBox.right < c.x + 4 ||
              basketBox.left > c.x + size - 4 ||
              basketBox.bottom < c.y + 4 ||
              basketBox.top > c.y + size);

          if (hit) {
            caught += 1;
            return false;
          }

          return c.y < GAME_HEIGHT + 50;
        });

        if (caught > 0) {
          setScore((s) => s + caught);
        }

        return next;
      });

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [started, moveLeft, moveRight, playerX]);

  useEffect(() => {
    if (score > highScore) setHighScore(score);
  }, [score, highScore]);

  useEffect(() => {
    if ((gameOver || timeLeft === 0) && !started && !savedRef.current) {
      savedRef.current = true;
      const updated = saveTopScores(score);
      setTopScores(updated);
      setHighScore(updated[0] || 0);
    }
  }, [gameOver, started, timeLeft, score]);

  function stopEverything() {
    if (timerRef.current) clearInterval(timerRef.current);
    if (animRef.current) cancelAnimationFrame(animRef.current);
  }

  function startGame() {
  stopEverything();
  setStarted(true);
  setGameOver(false);
  setScore(0);
  setTimeLeft(ROUND_SECONDS);
  setPlayerX(GAME_WIDTH / 2 - PLAYER_WIDTH / 2);

  const firstCherries = [];
  for (let i = 0; i < INITIAL_CHERRY_COUNT; i += 1) {
    idRef.current += 1;
    firstCherries.push({
      ...makeCherry(idRef.current),
      y: i * -70,
    });
  }
  setCherries(firstCherries);


  setMoveLeft(false);
  setMoveRight(false);
  lastTimeRef.current = 0;
  spawnRef.current = 0;
  savedRef.current = false;
}

  function resetGame() {
    stopEverything();
    setStarted(false);
    setGameOver(false);
    setScore(0);
    setTimeLeft(ROUND_SECONDS);
    setPlayerX(GAME_WIDTH / 2 - PLAYER_WIDTH / 2);
    setCherries([]);
    setMoveLeft(false);
    setMoveRight(false);
    lastTimeRef.current = 0;
    spawnRef.current = 0;
    savedRef.current = false;
  }

  const progress = (timeLeft / ROUND_SECONDS) * 100;

  const touchButtonStyle = {
    minHeight: 64,
    border: "none",
    borderRadius: 18,
    background: "#e5e7eb",
    fontWeight: 800,
    fontSize: 18,
    touchAction: "none",
    WebkitTapHighlightColor: "transparent",
    cursor: "pointer",
    userSelect: "none",
  };

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "linear-gradient(180deg, #f8fafc 0%, #fff7ed 46%, #ffe4e6 100%)",
        paddingTop: "max(12px, env(safe-area-inset-top, 0px))",
        paddingLeft: "max(12px, env(safe-area-inset-left, 0px))",
        paddingRight: "max(12px, env(safe-area-inset-right, 0px))",
        paddingBottom: "max(12px, env(safe-area-inset-bottom, 0px))",
        fontFamily: "Arial, sans-serif",
        color: "#1f2937",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gap: 16 }}>
        <div
          style={{
            background: "rgba(255,255,255,0.95)",
            borderRadius: 28,
            overflow: "hidden",
            boxShadow: "0 18px 50px rgba(0,0,0,0.08)",
            border: "1px solid rgba(0,0,0,0.06)",
          }}
        >
          <div style={{ padding: 18, borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 28, fontWeight: 800 }}>Yemeni Coffee Cherry Collector</div>
            <div style={{ marginTop: 6, color: "#6b7280", fontSize: 14 }}>
              Catch ripe coffee cherries before time runs out.
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
              <div style={{ background: "#f3f4f6", borderRadius: 999, padding: "8px 14px", fontWeight: 700 }}>Score: {score}</div>
              <div style={{ background: "#f3f4f6", borderRadius: 999, padding: "8px 14px", fontWeight: 700 }}>Best: {highScore}</div>
              <div style={{ background: "#f3f4f6", borderRadius: 999, padding: "8px 14px", fontWeight: 700 }}>Time: {timeLeft}s</div>
            </div>

            <div style={{ marginTop: 14, height: 10, background: "#e5e7eb", borderRadius: 999, overflow: "hidden" }}>
              <div style={{ width: `${progress}%`, height: "100%", background: "linear-gradient(90deg, #ef4444 0%, #f59e0b 100%)" }} />
            </div>
          </div>

          <div style={{ padding: 12 }}>
            <div
              style={{
                width: "100%",
                borderRadius: 28,
                overflow: "hidden",
                border: "1px solid rgba(0,0,0,0.08)",
                background: "linear-gradient(180deg, #ffe4e6 0%, #fecdd3 22%, #fdba74 66%, #8b5a1a 100%)",
              }}
            >
              <div
                ref={gameAreaRef}
                onPointerDown={(e) => {
                  if (!started) return;
                  e.preventDefault();
                  draggingRef.current = true;
                  try {
                    e.currentTarget.setPointerCapture(e.pointerId);
                  } catch {
                    /* ignore */
                  }
                  updatePlayerFromClientX(e.clientX);
                }}
                onPointerMove={(e) => {
                  if (!started || !draggingRef.current) return;
                  e.preventDefault();
                  updatePlayerFromClientX(e.clientX);
                }}
                onPointerUp={(e) => {
                  if (!draggingRef.current) return;
                  draggingRef.current = false;
                  try {
                    e.currentTarget.releasePointerCapture(e.pointerId);
                  } catch {
                    /* ignore */
                  }
                }}
                onPointerCancel={() => {
                  draggingRef.current = false;
                }}
                style={{
                  position: "relative",
                  width: "100%",
                  maxWidth: GAME_WIDTH,
                  height: GAME_HEIGHT,
                  margin: "0 auto",
                  userSelect: "none",
                  touchAction: "none",
                  WebkitTapHighlightColor: "transparent",
                  cursor: started ? "grab" : "default",
                }}
              >
                <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 110, background: "linear-gradient(180deg, transparent 0%, rgba(41,24,8,0.55) 100%)" }} />

                {cherries.map((cherry) => (
                  <Cherry key={cherry.id} cherry={cherry} />
                ))}

                <Basket playerX={playerX} />

                {!started && (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "rgba(0,0,0,0.18)",
                      padding: 18,
                    }}
                  >
                    <div
                      style={{
                        width: "100%",
                        maxWidth: 320,
                        background: "rgba(255,255,255,0.95)",
                        borderRadius: 28,
                        padding: 24,
                        textAlign: "center",
                        boxShadow: "0 20px 50px rgba(0,0,0,0.2)",
                      }}
                    >
                      <div style={{ fontSize: 30, fontWeight: 800 }}>
                        {gameOver ? "Round Complete" : "Ready to Play?"}
                      </div>
                      <div style={{ marginTop: 10, color: "#4b5563", lineHeight: 1.6 }}>
                        Collect as many coffee cherries as you can in {ROUND_SECONDS} seconds.
                      </div>
                      {gameOver && <div style={{ marginTop: 12, fontSize: 20, fontWeight: 800 }}>Final score: {score}</div>}
                      <button
                        onClick={startGame}
                        style={{
                          marginTop: 18,
                          border: "none",
                          background: "#111827",
                          color: "#fff",
                          padding: "12px 18px",
                          borderRadius: 18,
                          fontWeight: 700,
                          fontSize: 15,
                          cursor: "pointer",
                        }}
                      >
                        {gameOver ? "Play Again" : "Start Game"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  setMoveLeft(true);
                  try {
                    e.currentTarget.setPointerCapture(e.pointerId);
                  } catch {
                    /* ignore */
                  }
                }}
                onPointerUp={() => setMoveLeft(false)}
                onPointerCancel={() => setMoveLeft(false)}
                onPointerLeave={() => setMoveLeft(false)}
                onLostPointerCapture={() => setMoveLeft(false)}
                style={touchButtonStyle}
              >
                ← Left
              </button>
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  setMoveRight(true);
                  try {
                    e.currentTarget.setPointerCapture(e.pointerId);
                  } catch {
                    /* ignore */
                  }
                }}
                onPointerUp={() => setMoveRight(false)}
                onPointerCancel={() => setMoveRight(false)}
                onPointerLeave={() => setMoveRight(false)}
                onLostPointerCapture={() => setMoveRight(false)}
                style={touchButtonStyle}
              >
                Right →
              </button>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
          <div style={{ background: "#fff", borderRadius: 28, padding: 20, boxShadow: "0 10px 30px rgba(0,0,0,0.05)" }}>
            <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 10 }}>How to play</div>
            <div style={{ color: "#4b5563", lineHeight: 1.8, fontSize: 15 }}>
              <div>On phone, drag on the play area or hold Left / Right.</div>
              <div>On desktop, use Arrow keys or A / D.</div>
              <div>Each cherry adds 1 point.</div>
            </div>
          </div>

          <div style={{ background: "#fff", borderRadius: 28, padding: 20, boxShadow: "0 10px 30px rgba(0,0,0,0.05)" }}>
            <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>Top 5 scores</div>
            <div style={{ display: "grid", gap: 10 }}>
              {Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={index}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderRadius: 18,
                    padding: "12px 14px",
                    background: "#f8fafc",
                  }}
                >
                  <strong>#{index + 1}</strong>
                  <span style={{ fontWeight: 800 }}>{topScores[index] ?? "—"}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: "#fff", borderRadius: 28, padding: 20, boxShadow: "0 10px 30px rgba(0,0,0,0.05)" }}>
            <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>Quick actions</div>
            <div style={{ display: "grid", gap: 10 }}>
              <button
                onClick={startGame}
                style={{ minHeight: 48, border: "none", borderRadius: 18, background: "#111827", color: "#fff", fontWeight: 800 }}
              >
                New Round
              </button>
              <button
                onClick={resetGame}
                style={{ minHeight: 48, borderRadius: 18, background: "#fff", border: "1px solid rgba(0,0,0,0.14)", fontWeight: 800 }}
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}