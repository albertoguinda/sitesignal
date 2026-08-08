import { Suspense, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { ContactShadows, Edges, Grid, Html, OrbitControls } from "@react-three/drei";
import type { Group, Mesh, MeshStandardMaterial } from "three";
import type { AssetRow, AssetType } from "@shared/types";
import { readToken, statusColor } from "@/theme/tokens";
import { splitAssetName } from "@/lib/format";
import { cn } from "@/lib/utils";

function hasWebGL(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

/** Footprint and extrusion per machine type, in scene metres. */
const ASSET_GEOMETRY: Record<AssetType, [width: number, height: number, depth: number]> = {
  pump: [1.6, 1.0, 1.2],
  compressor: [1.8, 1.4, 1.4],
  chiller: [2.0, 1.6, 1.2],
  turbine: [2.6, 1.8, 1.6],
  transformer: [1.8, 1.5, 1.8],
  conveyor: [3.2, 0.5, 1.0],
  boiler: [1.6, 2.2, 1.6],
  hvac: [2.0, 0.9, 1.4],
  tank: [1.6, 2.0, 1.6],
};

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * A pulsing ring above an asset. It is the affordance that says "there is a
 * sensor readout behind this box" — critical assets pulse fastest.
 */
function Hotspot({
  color,
  urgency,
  active,
  reducedMotion,
}: {
  color: string;
  urgency: number;
  active: boolean;
  reducedMotion: boolean;
}) {
  const ring = useRef<Mesh>(null);
  const core = useRef<Mesh>(null);

  useFrame(({ clock }) => {
    if (reducedMotion || !ring.current) return;
    const phase = (clock.elapsedTime * urgency) % 1;
    const scale = 0.5 + phase * 1.4;
    ring.current.scale.setScalar(scale);
    const material = ring.current.material as MeshStandardMaterial;
    material.opacity = (1 - phase) * (active ? 0.85 : 0.55);
    if (core.current) {
      core.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * urgency * 3) * 0.12);
    }
  });

  return (
    <group>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.24, 0.34, 36]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.4}
          transparent
          opacity={0.6}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={core}>
        <sphereGeometry args={[0.16, 20, 20]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={active ? 2.4 : 1.5}
          roughness={0.25}
        />
      </mesh>
    </group>
  );
}

function AssetBox({
  asset,
  selected,
  onSelect,
  reducedMotion,
}: {
  asset: AssetRow;
  selected: boolean;
  onSelect: (asset: AssetRow) => void;
  reducedMotion: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const group = useRef<Group>(null);

  const [width, height, depth] = ASSET_GEOMETRY[asset.type] ?? [1.5, 1.2, 1.5];
  const color = statusColor(asset.status);
  const urgency = asset.status === "critical" ? 0.85 : asset.status === "warning" ? 0.55 : 0.32;
  const active = selected || hovered;

  useFrame(({ clock }) => {
    if (!group.current) return;
    // A slow bob on the selected asset separates it from its neighbours without
    // needing an outline pass.
    const lift = reducedMotion || !selected ? 0 : Math.sin(clock.elapsedTime * 1.6) * 0.05;
    group.current.position.y = asset.posY + lift;
  });

  const handleSelect = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onSelect(asset);
  };

  const { code } = splitAssetName(asset.name);

  return (
    <group ref={group} position={[asset.posX, asset.posY, asset.posZ]}>
      {/* Plinth: reads as a machine base and catches the floor light. */}
      <mesh position={[0, 0.04, 0]} receiveShadow>
        <boxGeometry args={[width + 0.35, 0.08, depth + 0.35]} />
        <meshStandardMaterial
          color={readToken("--sig-graphite-800")}
          roughness={0.9}
          metalness={0.1}
        />
      </mesh>

      <mesh
        position={[0, height / 2 + 0.08, 0]}
        castShadow
        onClick={handleSelect}
        onPointerOver={(event) => {
          event.stopPropagation();
          setHovered(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = "";
        }}
      >
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={active ? 0.55 : 0.2}
          roughness={0.42}
          metalness={0.35}
        />
        {/* Edges, not `wireframe`: a wireframe box also draws the triangulation
            diagonal across every face, which reads as a low-poly artefact. */}
        <Edges
          scale={1.006}
          threshold={15}
          color={active ? readToken("--sig-graphite-50") : readToken("--sig-graphite-1000")}
        />
      </mesh>

      <group
        position={[0, height + 0.55, 0]}
        onClick={handleSelect}
        onPointerOver={(event) => {
          event.stopPropagation();
          setHovered(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = "";
        }}
      >
        <Hotspot color={color} urgency={urgency} active={active} reducedMotion={reducedMotion} />
        {/* Invisible, larger hit area: a 0.11 sphere is not a click target. */}
        <mesh visible={false}>
          <sphereGeometry args={[0.42, 8, 8]} />
        </mesh>
      </group>

      <Html position={[0, height + 1.05, 0]} center distanceFactor={16} zIndexRange={[20, 0]}>
        <button
          type="button"
          onClick={() => onSelect(asset)}
          className={cn(
            "tabular whitespace-nowrap rounded-sm border px-1.5 py-0.5 text-[0.65rem] font-semibold transition-colors motion-fast",
            active
              ? "border-brand bg-overlay text-brand"
              : "border-line bg-overlay/85 text-ink-muted hover:text-ink",
          )}
        >
          {code}
        </button>
      </Html>
    </group>
  );
}

function SceneContent({
  assets,
  selectedId,
  onSelect,
  reducedMotion,
}: {
  assets: AssetRow[];
  selectedId: number;
  onSelect: (asset: AssetRow) => void;
  reducedMotion: boolean;
}) {
  const gridColor = readToken("--sig-scene-grid");
  const keyLight = readToken("--sig-scene-key-light");
  const fillLight = readToken("--sig-scene-fill-light");

  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[7, 11, 6]} intensity={1.5} color={keyLight} castShadow />
      <directionalLight position={[-8, 5, -6]} intensity={0.5} color={fillLight} />

      <Grid
        args={[26, 26]}
        cellSize={1}
        cellThickness={0.5}
        cellColor={gridColor}
        sectionSize={4}
        sectionThickness={1}
        sectionColor={gridColor}
        fadeDistance={30}
        fadeStrength={1.4}
        infiniteGrid={false}
        position={[0, 0, 0]}
      />

      {assets.map((asset) => (
        <AssetBox
          key={asset.id}
          asset={asset}
          selected={asset.id === selectedId}
          onSelect={onSelect}
          reducedMotion={reducedMotion}
        />
      ))}

      <ContactShadows position={[0, 0.01, 0]} opacity={0.5} scale={26} blur={2.4} far={9} />

      <OrbitControls
        makeDefault
        enablePan={false}
        minDistance={9}
        maxDistance={26}
        minPolarAngle={0.25}
        maxPolarAngle={Math.PI / 2.35}
        autoRotate={!reducedMotion}
        autoRotateSpeed={0.35}
        target={[0, 0.8, 0]}
      />
    </>
  );
}

/**
 * Floor plan of one site. Assets are extruded boxes placed at their stored
 * pos_x / pos_y / pos_z, tinted by status; clicking a box or its hotspot raises
 * the sensor readout for that asset.
 */
export function AssetScene({
  assets,
  selectedId,
  onSelect,
  className,
}: {
  assets: AssetRow[];
  selectedId: number;
  onSelect: (asset: AssetRow) => void;
  className?: string;
}) {
  const reducedMotion = useMemo(prefersReducedMotion, []);
  const [webglSupported] = useState(hasWebGL);
  const [sceneError, setSceneError] = useState(false);

  if (!webglSupported) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-lg border border-line bg-sunken p-8 text-center",
          className,
        )}
      >
        <p className="text-sm font-medium text-ink">
          3D visualization requires WebGL
        </p>
        <p className="text-xs text-ink-faint">
          Your browser or device does not support WebGL. The floor plan is not available, but all other dashboard features work normally.
        </p>
      </div>
    );
  }

  if (sceneError) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-lg border border-line bg-sunken p-8 text-center",
          className,
        )}
      >
        <p className="text-sm font-medium text-ink">
          3D scene failed to load
        </p>
        <p className="text-xs text-ink-faint">
          There was an error rendering the floor plan. Try refreshing the page.
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-lg border border-line bg-sunken",
        className,
      )}
    >
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ position: [11, 9, 13], fov: 38 }}
        gl={{ antialias: true }}
        onCreated={() => setSceneError(false)}
      >
        <Suspense fallback={null}>
          <SceneContent
            assets={assets}
            selectedId={selectedId}
            onSelect={onSelect}
            reducedMotion={reducedMotion}
          />
        </Suspense>
      </Canvas>

      <p className="pointer-events-none absolute bottom-2 left-3 text-2xs text-ink-faint">
        Drag to orbit · scroll to zoom · click a hotspot for its readout
      </p>
    </div>
  );
}
