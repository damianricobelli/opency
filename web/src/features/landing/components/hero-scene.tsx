import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  CanvasTexture,
  Euler,
  type Group,
  MathUtils,
  type Mesh,
  Quaternion,
  Shape,
  ShapeGeometry,
  SRGBColorSpace,
  Vector3,
} from "three";

/** A slide is 4:5, like the feed format the product renders by default. */
const CARD = { width: 1.76, height: 2.2, radius: 0.11 } as const;
const TEXTURE = { width: 704, height: 880 } as const;

type Palette = {
  paper: string;
  ink: string;
  muted: string;
  line: string;
  brand: string;
};

function readPalette(): Palette {
  const styles = getComputedStyle(document.documentElement);
  const token = (name: string) => styles.getPropertyValue(name).trim();
  return {
    paper: token("--card"),
    ink: token("--foreground"),
    muted: token("--muted"),
    // The darker of the two hairlines: a paper slide on a paper page needs it.
    line: token("--input"),
    brand: token("--brand"),
  };
}

type SlideKind = "statement" | "steps" | "cover" | "photo" | "closer";

/** Left to right once settled; the cover sits in the middle, in front. */
const SLIDES: readonly SlideKind[] = [
  "statement",
  "photo",
  "cover",
  "steps",
  "closer",
];

/**
 * Draws a slide as a skeleton: bars for text, a block for a photo. The
 * layouts are the point (cover, steps, photo, closer), not their words.
 */
function drawSlide(kind: SlideKind, index: number, palette: Palette) {
  const canvas = document.createElement("canvas");
  canvas.width = TEXTURE.width;
  canvas.height = TEXTURE.height;
  const context = canvas.getContext("2d");
  if (!context) return canvas;
  const { width: w, height: h } = TEXTURE;
  const dark = kind === "cover";
  const background = dark ? palette.ink : palette.paper;
  const foreground = dark ? palette.paper : palette.ink;
  const pad = 64;

  const bar = (x: number, y: number, width: number, height: number) => {
    context.beginPath();
    context.roundRect(x, y, width, height, height / 2);
    context.fill();
  };

  context.fillStyle = background;
  context.fillRect(0, 0, w, h);

  // Eyebrow.
  context.fillStyle = palette.brand;
  bar(pad, pad, 20, 20);
  context.fillStyle = foreground;
  context.globalAlpha = 0.35;
  bar(pad + 36, pad + 4, 150, 12);
  context.globalAlpha = 1;

  if (kind === "cover" || kind === "statement") {
    const top = kind === "cover" ? 300 : 240;
    context.fillStyle = foreground;
    bar(pad, top, w - pad * 2 - 40, 46);
    bar(pad, top + 76, w - pad * 2 - 150, 46);
    if (kind === "cover") {
      context.fillStyle = palette.brand;
      bar(pad, top + 152, 250, 46);
    } else {
      bar(pad, top + 152, 300, 46);
      context.globalAlpha = 0.4;
      bar(pad, top + 260, w - pad * 2 - 90, 14);
      bar(pad, top + 292, w - pad * 2 - 200, 14);
      context.globalAlpha = 1;
    }
  }

  if (kind === "steps") {
    for (let row = 0; row < 3; row++) {
      const y = 210 + row * 170;
      context.fillStyle = row === 1 ? palette.brand : palette.muted;
      context.beginPath();
      context.arc(pad + 34, y + 34, 34, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = foreground;
      bar(pad + 104, y + 6, 330, 22);
      context.globalAlpha = 0.4;
      bar(pad + 104, y + 46, 420, 12);
      context.globalAlpha = 1;
    }
  }

  if (kind === "photo") {
    context.fillStyle = palette.muted;
    context.beginPath();
    context.roundRect(pad, 140, w - pad * 2, 420, 28);
    context.fill();
    // A horizon and a sun: enough to read as a photograph.
    context.fillStyle = palette.line;
    context.beginPath();
    context.roundRect(pad, 400, w - pad * 2, 160, [0, 0, 28, 28]);
    context.fill();
    context.fillStyle = palette.paper;
    context.beginPath();
    context.arc(w - pad - 130, 290, 46, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = foreground;
    bar(pad, 610, 400, 30);
    context.globalAlpha = 0.4;
    bar(pad, 664, w - pad * 2 - 60, 12);
    bar(pad, 694, w - pad * 2 - 190, 12);
    context.globalAlpha = 1;
  }

  if (kind === "closer") {
    context.fillStyle = foreground;
    bar(pad, 300, w - pad * 2 - 120, 40);
    bar(pad, 366, 330, 40);
    context.beginPath();
    context.roundRect(pad, 470, 260, 76, 38);
    context.fill();
    context.fillStyle = background;
    bar(pad + 50, 501, 160, 14);
  }

  // Bottom bar: brand mark and pager, in the same place on every slide.
  context.fillStyle = foreground;
  context.globalAlpha = 0.9;
  context.beginPath();
  context.roundRect(pad, h - pad - 30, 24, 30, 7);
  context.fill();
  for (let dot = 0; dot < SLIDES.length; dot++) {
    context.globalAlpha = dot === index ? 0.9 : 0.2;
    context.beginPath();
    context.arc(
      w - pad - 8 - (SLIDES.length - 1 - dot) * 24,
      h - pad - 15,
      6,
      0,
      Math.PI * 2,
    );
    context.fill();
  }
  context.globalAlpha = 1;

  // A hairline so paper cards keep their edge on a paper page.
  context.strokeStyle = palette.line;
  context.lineWidth = 8;
  context.beginPath();
  context.roundRect(3, 3, w - 6, h - 6, (CARD.radius / CARD.width) * w);
  context.stroke();

  return canvas;
}

/** A rounded rectangle whose UVs span 0..1, so a texture fills it. */
function createCardGeometry() {
  const { width, height, radius } = CARD;
  const x = -width / 2;
  const y = -height / 2;
  const shape = new Shape();
  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + height - radius);
  shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  shape.lineTo(x + radius, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);
  const geometry = new ShapeGeometry(shape, 8);
  const position = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  if (position && uv) {
    for (let i = 0; i < position.count; i++) {
      uv.setXY(
        i,
        (position.getX(i) - x) / width,
        (position.getY(i) - y) / height,
      );
    }
  }
  return geometry;
}

// Where each slide starts, loose on the table. Fixed numbers, not random:
// the server and every visit see the same opening frame.
const SCATTER: readonly (readonly [
  number,
  number,
  number,
  number,
  number,
  number,
])[] = [
  [-3.4, 1.1, -2.6, 0.5, 0.9, -0.5],
  [2.9, -1.3, -1.8, -0.6, -0.7, 0.4],
  [0.4, 1.7, -3.4, 0.9, 0.2, 0.8],
  [-1.8, -1.5, -1.2, -0.4, 0.8, -0.7],
  [3.6, 1.2, -2.9, 0.3, -1.0, 0.3],
];

type Pose = { position: Vector3; quaternion: Quaternion };

function createPoses(spacing: number) {
  const middle = (SLIDES.length - 1) / 2;
  return SLIDES.map((_, index) => {
    const offset = index - middle;
    const distance = Math.abs(offset);
    const scatter = SCATTER[index] ?? [0, 0, 0, 0, 0, 0];
    const from: Pose = {
      position: new Vector3(scatter[0], scatter[1], scatter[2]),
      quaternion: new Quaternion().setFromEuler(
        new Euler(scatter[3], scatter[4], scatter[5]),
      ),
    };
    // A fanned row: the cover in front, the rest stepping back and turning in.
    const to: Pose = {
      position: new Vector3(
        offset * spacing,
        -distance * 0.05,
        -distance * 0.5,
      ),
      quaternion: new Quaternion().setFromEuler(
        new Euler(0, -offset * 0.26, -offset * 0.015),
      ),
    };
    return { from, to };
  });
}

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

function Slides({ scheme }: { scheme: string }) {
  const group = useRef<Group>(null);
  const cards = useRef<(Mesh | null)[]>([]);
  const elapsed = useRef(0);
  const pointer = useRef({ x: 0, y: 0 });
  const viewportWidth = useThree((state) => state.viewport.width);

  const geometry = useMemo(createCardGeometry, []);
  // On a phone the slides overlap more instead of all shrinking to fit.
  const compact = viewportWidth < 5.6;
  const spacing = compact ? 0.86 : 1.22;
  const poses = useMemo(() => createPoses(spacing), [spacing]);
  // Repainted when the system's scheme flips: the slides use the page's tokens.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `scheme` is the repaint signal.
  const textures = useMemo(() => {
    const palette = readPalette();
    return SLIDES.map((kind, index) => {
      const texture = new CanvasTexture(drawSlide(kind, index, palette));
      texture.colorSpace = SRGBColorSpace;
      texture.anisotropy = 8;
      return texture;
    });
  }, [scheme]);

  useEffect(
    () => () => {
      for (const texture of textures) texture.dispose();
    },
    [textures],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);

  // The canvas takes no pointer events (it must never eat a scroll), so the
  // parallax listens on the window.
  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      pointer.current.x = (event.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (event.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  useFrame((_, delta) => {
    // A long frame after the tab was hidden must not skip the entrance.
    elapsed.current += Math.min(delta, 0.05);
    const time = elapsed.current;

    for (let index = 0; index < poses.length; index++) {
      const card = cards.current[index];
      const pose = poses[index];
      if (!card || !pose) continue;
      // Each slide leaves a beat after the previous one.
      const progress = easeOutCubic(
        MathUtils.clamp((time - 0.2 - index * 0.09) / 1.6, 0, 1),
      );
      card.position.lerpVectors(pose.from.position, pose.to.position, progress);
      card.quaternion.slerpQuaternions(
        pose.from.quaternion,
        pose.to.quaternion,
        progress,
      );
      // Once in place, each one breathes on its own phase.
      card.position.y += Math.sin(time * 0.7 + index * 1.3) * 0.035 * progress;
    }

    if (group.current) {
      group.current.rotation.y = MathUtils.damp(
        group.current.rotation.y,
        pointer.current.x * 0.16 + Math.sin(time * 0.25) * 0.04,
        3,
        delta,
      );
      group.current.rotation.x = MathUtils.damp(
        group.current.rotation.x,
        pointer.current.y * 0.07,
        3,
        delta,
      );
    }
  });

  // The fan is four steps and one slide wide; narrower viewports shrink it.
  const scale = Math.min(1, viewportWidth / (spacing * 4 + CARD.width + 0.3));

  return (
    <group ref={group} scale={scale}>
      {SLIDES.map((kind, index) => (
        <mesh
          key={kind}
          ref={(mesh) => {
            cards.current[index] = mesh;
          }}
          geometry={geometry}
        >
          <meshBasicMaterial map={textures[index]} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Five loose slides gather into a carousel: what the product does, in one
 * motion. Loaded only in the browser, after the page is interactive.
 */
export default function HeroScene({
  running,
  scheme,
  onReady,
}: {
  /** False while the hero is off screen: the loop stops. */
  running: boolean;
  /** "light" or "dark"; a change repaints the slides. */
  scheme: string;
  onReady: () => void;
}) {
  return (
    <Canvas
      flat
      dpr={[1, 1.75]}
      frameloop={running ? "always" : "never"}
      camera={{ position: [0, 0, 6.2], fov: 32 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      // No object listens for pointers, and the page must scroll through it.
      style={{ pointerEvents: "none" }}
      onCreated={onReady}
    >
      <Slides scheme={scheme} />
    </Canvas>
  );
}
