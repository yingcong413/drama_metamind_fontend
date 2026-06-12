import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { CSS2DRenderer, CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { cn } from "@/lib/cn";
import { useThemeStore } from "@/stores/theme";
import { CloseIcon } from "@/components/icons";

// ────────────────────────────────────────────────────────────────────────────
// 数据模型(全部可 JSON 序列化,随工作流节点持久化)
// ────────────────────────────────────────────────────────────────────────────

type Vec3 = [number, number, number];
type BodyType = "male" | "female" | "broad" | "muscle" | "slim" | "teen" | "child" | "chibi";
type ModelShape = "box" | "sphere" | "cylinder" | "torus" | "cone" | "pyramid" | "plane" | "backdrop" | "glb";

export interface DcChar {
  kind: "char";
  id: string;
  name: string;
  body: BodyType;
  color: string;
  pos: Vec3;
  rot: Vec3;
  scale: Vec3;
  pose: Record<string, number>;
  preset?: string;
}
export interface DcModel {
  kind: "model";
  id: string;
  name: string;
  shape: ModelShape;
  color: string;
  pos: Vec3;
  rot: Vec3;
  scale: Vec3;
  url?: string;
}
export interface DcCam {
  kind: "cam";
  id: string;
  name: string;
  pos: Vec3;
  target: Vec3;
  fov: number;
  look: string; // "manual" | 角色 id(注视目标跟随角色)
}
export interface DcShot { id: string; name: string; url: string; camId: string }
export interface DcRef { id: string; name: string; url: string }

export interface DirectorSave {
  v: 1;
  chars: DcChar[];
  models: DcModel[];
  cams: DcCam[];
  shots: DcShot[];
  refs: DcRef[];
  ratio: string;
}

type DcEntity = DcChar | DcModel | DcCam;

const uid = () => Math.random().toString(36).slice(2, 9);
const deg = (v: number) => THREE.MathUtils.degToRad(v);
const r2 = (v: number) => Math.round(v * 100) / 100;

// ── 素体体型参数(对照参考图):w 横宽 / head 头围 / limb 四肢粗细
//    torso/leg/arm 躯干·腿·臂长度比例 / shoulder 肩宽 / chest 胸廓 / waist 腰围 / hip 髋宽
//    tone 肌肉线条(胸肌+腹肌 0~1)/ belly 大肚 / bust 胸部 ──
interface BodyDef {
  label: string;
  color: string; // 默认配色,与参考图(Archive.zip)一一对应
  w: number; head: number; limb: number;
  torso: number; leg: number; arm: number;
  shoulder: number; chest: number; waist: number; hip: number;
  tone?: number; belly?: boolean; bust?: boolean;
}
// 对照参考图:男=红(运动型) 女=蓝 宽厚=橙 健壮=黄(健美型) 纤细=紫 少年=绿 儿童=浅蓝 二头身=粉
const BODY: Record<BodyType, BodyDef> = {
  male:   { label: "男性素体", color: "#D8453A", w: 1,    head: 1,    limb: 1.08, torso: 1,    leg: 1,    arm: 1,    shoulder: 1.12, chest: 1.12, waist: 0.8,  hip: 0.9,  tone: 0.75 },
  female: { label: "女性素体", color: "#5B8FD9", w: 0.9,  head: 0.97, limb: 0.74, torso: 0.97, leg: 1,    arm: 0.97, shoulder: 0.8,  chest: 0.88, waist: 0.62, hip: 1.04, bust: true },
  broad:  { label: "宽厚素体", color: "#E8862E", w: 1.2,  head: 1.02, limb: 1.34, torso: 1,    leg: 0.95, arm: 0.95, shoulder: 1.08, chest: 1.22, waist: 1.42, hip: 1.22, belly: true },
  muscle: { label: "健壮素体", color: "#E0B33C", w: 1.14, head: 1,    limb: 1.48, torso: 1.03, leg: 1.02, arm: 1,    shoulder: 1.36, chest: 1.32, waist: 0.82, hip: 0.94, tone: 1 },
  slim:   { label: "纤细素体", color: "#9B6FD0", w: 0.8,  head: 0.97, limb: 0.6,  torso: 1.02, leg: 1.05, arm: 1.05, shoulder: 0.9,  chest: 0.8,  waist: 0.58, hip: 0.76 },
  teen:   { label: "少年素体", color: "#5FA86B", w: 0.85, head: 1.05, limb: 0.74, torso: 0.88, leg: 0.88, arm: 0.88, shoulder: 0.9,  chest: 0.85, waist: 0.7,  hip: 0.82 },
  child:  { label: "儿童素体", color: "#8FB8E8", w: 0.8,  head: 1.5,  limb: 0.85, torso: 0.66, leg: 0.55, arm: 0.6,  shoulder: 0.95, chest: 0.95, waist: 0.88, hip: 0.92 },
  chibi:  { label: "二头身",   color: "#E0608A", w: 1.02, head: 2,    limb: 1.08, torso: 0.46, leg: 0.36, arm: 0.44, shoulder: 1,    chest: 1,    waist: 0.95, hip: 1 },
};
const BODY_ORDER: BodyType[] = ["male", "female", "broad", "muscle", "slim", "teen", "child", "chibi"];

const GEOM_SHAPES: { shape: ModelShape; label: string }[] = [
  { shape: "box", label: "立方体" },
  { shape: "sphere", label: "球体" },
  { shape: "cylinder", label: "圆柱体" },
  { shape: "torus", label: "环状体" },
  { shape: "cone", label: "圆锥" },
  { shape: "pyramid", label: "棱锥" },
];

// ── 姿势参数(角度,°)──
const POSE_KEYS = [
  "bodyBend", "bodyTurn", "bodyLean",
  "torsoBend", "torsoTwist", "torsoLean",
  "headNod", "headTurn", "headTilt",
  "armLRaise", "armLSpread", "armLTwist", "armRRaise", "armRSpread", "armRTwist",
  "elbowLBend", "elbowRBend",
  "legLRaise", "legLSpread", "legLTwist", "legRRaise", "legRSpread", "legRTwist",
  "kneeLBend", "kneeRBend",
  "drop", // 整体下沉(米,坐/蹲/跪用,不出滑杆)
] as const;

const ZERO_POSE: Record<string, number> = Object.fromEntries(POSE_KEYS.map((k) => [k, 0]));
const STAND: Record<string, number> = {
  ...ZERO_POSE,
  torsoBend: 2, armLRaise: -5, armRRaise: -5, armLSpread: 7, armRSpread: 7, elbowLBend: 15, elbowRBend: 15,
};

const POSE_PRESETS: { name: string; pose: Record<string, number> }[] = [
  { name: "站立", pose: STAND },
  { name: "T型", pose: { ...ZERO_POSE, armLSpread: 90, armRSpread: 90 } },
  { name: "行走", pose: { ...ZERO_POSE, torsoBend: 4, armLRaise: 35, armRRaise: -32, elbowLBend: 22, elbowRBend: 22, legLRaise: -24, legRRaise: 28, kneeLBend: 28, kneeRBend: 8 } },
  { name: "跑步", pose: { ...ZERO_POSE, bodyBend: 12, armLRaise: 62, armRRaise: -46, elbowLBend: 96, elbowRBend: 96, legLRaise: -42, legRRaise: 56, kneeLBend: 84, kneeRBend: 26, drop: 0.06 } },
  { name: "坐姿", pose: { ...ZERO_POSE, torsoBend: 5, legLRaise: 86, legRRaise: 86, legLSpread: 6, legRSpread: 6, kneeLBend: 86, kneeRBend: 86, armLRaise: 26, armRRaise: 26, elbowLBend: 28, elbowRBend: 28, drop: 0.42 } },
  { name: "蹲下", pose: { ...ZERO_POSE, bodyBend: 18, legLRaise: 108, legRRaise: 108, legLSpread: 10, legRSpread: 10, kneeLBend: 132, kneeRBend: 132, armLRaise: 38, armRRaise: 38, elbowLBend: 42, elbowRBend: 42, drop: 0.62 } },
  { name: "单膝跪", pose: { ...ZERO_POSE, torsoBend: 5, legLRaise: 88, kneeLBend: 88, kneeRBend: 96, drop: 0.46, armLRaise: 18, armRRaise: 4, elbowLBend: 36, elbowRBend: 12 } },
  { name: "双膝跪", pose: { ...ZERO_POSE, torsoBend: 2, kneeLBend: 96, kneeRBend: 96, drop: 0.5, armLRaise: -4, armRRaise: -4, armLSpread: 6, armRSpread: 6 } },
  { name: "叉腰", pose: { ...ZERO_POSE, armLRaise: -8, armRRaise: -8, armLSpread: 52, armRSpread: 52, armLTwist: -72, armRTwist: -72, elbowLBend: 122, elbowRBend: 122 } },
  { name: "倚靠", pose: { ...ZERO_POSE, bodyLean: 10, bodyTurn: 6, headTilt: 7, legLSpread: 15, kneeLBend: 14, armLSpread: 18, armRSpread: 8, elbowRBend: 22 } },
  { name: "鞠躬", pose: { ...ZERO_POSE, torsoBend: 80, headNod: 10, armLRaise: -8, armRRaise: -8 } },
  { name: "思考", pose: { ...ZERO_POSE, torsoBend: 5, headNod: 14, headTilt: 9, armRRaise: 46, armRTwist: 22, elbowRBend: 126, armLRaise: 16, armLTwist: 32, elbowLBend: 72 } },
  { name: "格斗", pose: { ...ZERO_POSE, bodyTurn: 18, bodyBend: 8, armLRaise: 56, armRRaise: 70, elbowLBend: 112, elbowRBend: 96, legLRaise: -12, legLSpread: 16, legRRaise: 14, legRSpread: 12, kneeLBend: 20, kneeRBend: 26, drop: 0.08 } },
  { name: "踢球", pose: { ...ZERO_POSE, bodyBend: -6, bodyLean: -6, legRRaise: 66, kneeRBend: 16, kneeLBend: 10, armLSpread: 46, armRSpread: 28, armLRaise: 20 } },
  { name: "投掷", pose: { ...ZERO_POSE, bodyTurn: -22, torsoTwist: -14, armRRaise: 132, elbowRBend: 72, armLRaise: 42, legLRaise: -18, legRRaise: 10, kneeRBend: 14 } },
  { name: "推进", pose: { ...ZERO_POSE, bodyBend: 16, armLRaise: 76, armRRaise: 76, elbowLBend: 16, elbowRBend: 16, legLRaise: -22, legRRaise: 12, kneeRBend: 26, drop: 0.05 } },
  { name: "招手", pose: { ...ZERO_POSE, armRRaise: 52, armRSpread: 66, elbowRBend: 66, headTilt: -5, armLRaise: -5, armLSpread: 7, elbowLBend: 15 } },
  { name: "伸手", pose: { ...ZERO_POSE, armRRaise: 82, elbowRBend: 6, armLRaise: -5, armLSpread: 7, elbowLBend: 15 } },
  { name: "抱臂", pose: { ...ZERO_POSE, armLRaise: 56, armRRaise: 64, elbowLBend: 116, elbowRBend: 116, armLTwist: -36, armRTwist: -36 } },
  { name: "看手机", pose: { ...ZERO_POSE, torsoBend: 4, headNod: 28, armLRaise: 32, armRRaise: 32, elbowLBend: 106, elbowRBend: 106 } },
];

type PoseRow = { k: string; lb: string; min: number; max: number };
const POSE_UI: { sec: string; rows: PoseRow[] }[] = [
  { sec: "身体", rows: [{ k: "bodyBend", lb: "前倾", min: -60, max: 60 }, { k: "bodyTurn", lb: "转身", min: -180, max: 180 }, { k: "bodyLean", lb: "侧倾", min: -45, max: 45 }] },
  { sec: "躯干", rows: [{ k: "torsoBend", lb: "前倾", min: -45, max: 90 }, { k: "torsoTwist", lb: "扭转", min: -60, max: 60 }, { k: "torsoLean", lb: "侧倾", min: -45, max: 45 }] },
  { sec: "头部", rows: [{ k: "headNod", lb: "点头", min: -45, max: 60 }, { k: "headTurn", lb: "转头", min: -80, max: 80 }, { k: "headTilt", lb: "歪头", min: -45, max: 45 }] },
];
const POSE_SIDED: { sec: string; mk: (s: "L" | "R") => PoseRow[] }[] = [
  { sec: "手臂 — 肩", mk: (s) => [{ k: `arm${s}Raise`, lb: "前举", min: -60, max: 180 }, { k: `arm${s}Spread`, lb: "外展", min: -30, max: 180 }, { k: `arm${s}Twist`, lb: "扭转", min: -90, max: 90 }] },
  { sec: "肘部", mk: (s) => [{ k: `elbow${s}Bend`, lb: "弯曲", min: 0, max: 150 }] },
  { sec: "腿部 — 髋", mk: (s) => [{ k: `leg${s}Raise`, lb: "前抬", min: -45, max: 120 }, { k: `leg${s}Spread`, lb: "外展", min: -30, max: 90 }, { k: `leg${s}Twist`, lb: "扭转", min: -45, max: 45 }] },
  { sec: "膝部", mk: (s) => [{ k: `knee${s}Bend`, lb: "弯曲", min: 0, max: 150 }] },
];

// ── 机位预设(角色局部坐标,角色面朝 +Z)──
const CAM_PRESETS: { id: string; label: string; off?: Vec3; tgt?: Vec3; fov?: number }[] = [
  { id: "cur", label: "当前视角" },
  { id: "front-mid", label: "正面中景", off: [0, 1.35, 2.6], tgt: [0, 1.25, 0] },
  { id: "front-close", label: "正面特写", off: [0, 1.55, 1.05], tgt: [0, 1.52, 0], fov: 38 },
  { id: "front-full", label: "正面全景", off: [0, 1.6, 6.5], tgt: [0, 0.95, 0] },
  { id: "side-follow", label: "侧面跟拍", off: [2.8, 1.4, 0], tgt: [0, 1.3, 0] },
  { id: "side-near", label: "侧面近景", off: [1.6, 1.5, 0.25], tgt: [0, 1.45, 0], fov: 42 },
  { id: "back-mid", label: "背面中景", off: [0, 1.45, -2.7], tgt: [0, 1.3, 0] },
  { id: "top-full", label: "俯拍全景", off: [0, 6.5, 4.2], tgt: [0, 0.9, 0] },
  { id: "top-45", label: "45° 俯拍", off: [2.6, 3.4, 2.6], tgt: [0, 1.1, 0] },
  { id: "low-up", label: "低角度仰拍", off: [0, 0.45, 2.3], tgt: [0, 1.5, 0] },
  { id: "low-wide", label: "低角度广角", off: [0.9, 0.35, 1.9], tgt: [0, 1.45, 0], fov: 78 },
  { id: "ots-l", label: "过肩镜头", off: [-0.55, 1.62, -0.85], tgt: [0, 1.35, 2.6] },
  { id: "ots-r", label: "过肩镜头（右）", off: [0.55, 1.62, -0.85], tgt: [0, 1.35, 2.6] },
  { id: "bird", label: "鸟瞰", off: [0, 9.5, 0.06], tgt: [0, 0, 0] },
];

const RATIOS = ["Auto", "21:9", "16:9", "4:3", "1:1", "3:4", "9:16"];
const ratioVal = (r: string): number | null => {
  if (r === "Auto") return null;
  const [a, b] = r.split(":").map(Number);
  return a / b;
};

// ────────────────────────────────────────────────────────────────────────────
// Three 构建器
// ────────────────────────────────────────────────────────────────────────────

// ── GLB 素体:用户提供的带骨骼高模(Tripo 图生3D + AccuRig),按体型逐个替换程序化素体 ──
// 暂时停用:先把程序化素体的全部姿势调正确,GLB 姿势重定向再继续(管线与重定向代码保留)
const GLB_BODIES: Partial<Record<BodyType, string>> = {
  // male: "/models/body-male.glb",
};

// 姿势重定向:把姿势参数(以"直立垂手"为零姿态)映射到 AccuRig 骨骼。
// 绑定姿态(T/A-pose)的手臂方向先校正到垂直向下,姿势语义与程序化素体完全一致。
interface RigData {
  rootBone: THREE.Bone;
  baseQ: THREE.Quaternion;
  rest: Map<THREE.Object3D, { q: THREE.Quaternion; p: THREE.Vector3 }>;
  mapped: Map<THREE.Object3D, { kind: string; ref: THREE.Quaternion }>;
  hip: THREE.Bone;
  hipsWorldY: number;
  dropUnit: number; // 世界 1 米对应的骨骼局部单位
  hipParentInvQ: THREE.Quaternion; // Hip 父级绑定世界姿态的逆(世界位移 → 局部位移)
}
function buildRig(root: THREE.Object3D): RigData | null {
  root.updateMatrixWorld(true);
  const byName = new Map<string, THREE.Bone>();
  let rootBone: THREE.Bone | null = null;
  root.traverse((o) => {
    if ((o as THREE.Bone).isBone) {
      byName.set(o.name, o as THREE.Bone);
      if (!rootBone) rootBone = o as THREE.Bone;
    }
  });
  const need = ["Hip", "Spine01", "Spine02", "NeckTwist01", "NeckTwist02", "Head", "L_Upperarm", "L_Forearm", "L_Hand", "R_Upperarm", "R_Forearm", "R_Hand", "L_Thigh", "L_Calf", "L_Foot", "R_Thigh", "R_Calf", "R_Foot"];
  if (!rootBone || need.some((n) => !byName.has(n))) return null;
  const rest = new Map<THREE.Object3D, { q: THREE.Quaternion; p: THREE.Vector3 }>();
  root.traverse((o) => {
    if ((o as THREE.Bone).isBone) rest.set(o, { q: o.quaternion.clone(), p: o.position.clone() });
  });
  const wq = (o: THREE.Object3D) => o.getWorldQuaternion(new THREE.Quaternion());
  const wp = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3());
  const rb = rootBone as THREE.Bone;
  const baseQ = rb.parent ? wq(rb.parent) : new THREE.Quaternion();
  // 肢段绑定方向 → 垂直向下 的校正(T-pose 手臂放下;腿本就向下≈恒等)
  const corr = (up: string, lo: string) =>
    new THREE.Quaternion().setFromUnitVectors(wp(byName.get(lo)!).sub(wp(byName.get(up)!)).normalize(), new THREE.Vector3(0, -1, 0));
  // 躯干段绑定方向 → 竖直向上 的校正(绑定姿态常带前倾/低头,立正作为零姿态)
  const corrUp = (lo: string, up: string) =>
    new THREE.Quaternion().setFromUnitVectors(wp(byName.get(up)!).sub(wp(byName.get(lo)!)).normalize(), new THREE.Vector3(0, 1, 0));
  const mapped = new Map<THREE.Object3D, { kind: string; ref: THREE.Quaternion }>();
  const add = (name: string, kind: string, c?: THREE.Quaternion) => {
    const b = byName.get(name)!;
    const ref = wq(b);
    if (c) ref.premultiply(c);
    mapped.set(b, { kind, ref });
  };
  add("Hip", "hips", corrUp("Hip", "Spine02"));
  add("Spine01", "spine", corrUp("Spine01", "NeckTwist01"));
  add("Head", "head", corrUp("NeckTwist02", "Head"));
  add("L_Upperarm", "shL", corr("L_Upperarm", "L_Forearm"));
  add("L_Forearm", "elL", corr("L_Forearm", "L_Hand"));
  add("R_Upperarm", "shR", corr("R_Upperarm", "R_Forearm"));
  add("R_Forearm", "elR", corr("R_Forearm", "R_Hand"));
  add("L_Thigh", "hipL", corr("L_Thigh", "L_Calf"));
  add("L_Calf", "knL", corr("L_Calf", "L_Foot"));
  add("R_Thigh", "hipR", corr("R_Thigh", "R_Calf"));
  add("R_Calf", "knR", corr("R_Calf", "R_Foot"));
  const hip = byName.get("Hip")!;
  const ps = new THREE.Vector3();
  const pq = new THREE.Quaternion();
  hip.parent!.matrixWorld.decompose(new THREE.Vector3(), pq, ps);
  return {
    rootBone: rb, baseQ, rest, mapped, hip,
    hipsWorldY: wp(hip).y,
    dropUnit: 1 / Math.max(Math.abs(ps.y), 1e-6),
    hipParentInvQ: pq.invert(),
  };
}
function applyPoseRig(rig: RigData, p: Record<string, number>) {
  const v = (k: string) => p[k] ?? 0;
  const E = (x: number, y: number, z: number, o: THREE.EulerOrder = "XYZ") =>
    new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, o));
  const deltas: Record<string, THREE.Quaternion> = {
    hips: E(deg(v("bodyBend")), deg(v("bodyTurn")), deg(v("bodyLean"))),
    spine: E(deg(v("torsoBend")), deg(v("torsoTwist")), deg(v("torsoLean"))),
    head: E(deg(v("headNod")), deg(v("headTurn")), deg(v("headTilt"))),
    shL: E(deg(-v("armLRaise")), deg(v("armLTwist")), deg(v("armLSpread")), "ZYX"),
    shR: E(deg(-v("armRRaise")), deg(-v("armRTwist")), deg(-v("armRSpread")), "ZYX"),
    elL: E(deg(-v("elbowLBend")), 0, 0),
    elR: E(deg(-v("elbowRBend")), 0, 0),
    hipL: E(deg(-v("legLRaise")), deg(v("legLTwist")), deg(v("legLSpread")), "ZYX"),
    hipR: E(deg(-v("legRRaise")), deg(-v("legRTwist")), deg(-v("legRSpread")), "ZYX"),
    knL: E(deg(v("kneeLBend")), 0, 0),
    knR: E(deg(v("kneeRBend")), 0, 0),
  };
  // 语义链:子关节旋转叠加在父关节之上(肘随肩、头随脊柱、四肢随躯干),与程序化素体的层级一致
  const CHAIN: [string, string | null][] = [
    ["hips", null], ["spine", "hips"], ["head", "spine"],
    ["shL", "spine"], ["elL", "shL"], ["shR", "spine"], ["elR", "shR"],
    ["hipL", "hips"], ["knL", "hipL"], ["hipR", "hips"], ["knR", "hipR"],
  ];
  const D: Record<string, THREE.Quaternion> = {};
  for (const [k, pk] of CHAIN) D[k] = pk ? D[pk].clone().multiply(deltas[k]) : deltas[k].clone();
  const inv = new THREE.Quaternion();
  const walk = (o: THREE.Object3D, parentQ: THREE.Quaternion) => {
    const r = rig.rest.get(o);
    if (r) {
      const m = rig.mapped.get(o);
      if (m) {
        const target = D[m.kind].clone().multiply(m.ref);
        o.quaternion.copy(inv.copy(parentQ).invert().multiply(target));
      } else {
        o.quaternion.copy(r.q);
      }
      if (o === rig.hip) {
        // 世界竖直下沉 → 变换到 Hip 父级局部空间(该 rig 的骨骼局部轴与世界轴不对齐)
        const worldDrop = (v("drop") / 0.94) * rig.hipsWorldY;
        const delta = new THREE.Vector3(0, -worldDrop, 0).applyQuaternion(rig.hipParentInvQ).multiplyScalar(rig.dropUnit);
        o.position.set(r.p.x + delta.x, r.p.y + delta.y, r.p.z + delta.z);
      }
    }
    const w = r ? parentQ.clone().multiply(o.quaternion) : parentQ;
    for (const c of o.children) walk(c, w);
  };
  walk(rig.rootBone, rig.baseQ.clone());
}
const glbTplCache = new Map<string, Promise<THREE.Group>>();
function loadBodyTemplate(url: string): Promise<THREE.Group> {
  let p = glbTplCache.get(url);
  if (!p) {
    p = new Promise((resolve, reject) => {
      new GLTFLoader().load(url, (gltf) => {
        const sc = gltf.scene;
        // 统一姿态:z-up 导出的立起来 → 身高归一 1.72m → 脚底落地、水平居中
        let box = new THREE.Box3().setFromObject(sc);
        let size = box.getSize(new THREE.Vector3());
        if (size.z > size.y * 1.2) {
          sc.rotation.x = -Math.PI / 2;
          sc.updateMatrixWorld(true);
        }
        box = new THREE.Box3().setFromObject(sc);
        size = box.getSize(new THREE.Vector3());
        sc.scale.setScalar(1.72 / Math.max(size.y, 0.001));
        sc.updateMatrixWorld(true);
        box = new THREE.Box3().setFromObject(sc);
        const c = box.getCenter(new THREE.Vector3());
        sc.position.x -= c.x;
        sc.position.z -= c.z;
        sc.position.y -= box.min.y;
        resolve(sc);
      }, undefined, reject);
    });
    glbTplCache.set(url, p);
  }
  return p;
}

function buildMannequin(color: string, body: BodyType): THREE.Group {
  const B = BODY[body];
  const glbUrl = GLB_BODIES[body];
  if (glbUrl) {
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.34, metalness: 0.04 });
    const g = new THREE.Group();
    g.userData = { joints: null, mats: [mat], hipsY: 0.94 * B.leg, buildKey: body };
    loadBodyTemplate(glbUrl).then((tpl) => {
      const inst = cloneSkeleton(tpl);
      // 统一替换为纯色材质:颜色可调、选中高亮可用,几何细节由法线呈现
      inst.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.material = mat;
          mesh.frustumCulled = false;
        }
      });
      g.add(inst);
      // 接姿势系统:有骨骼则重定向,默认套用当前姿势(站立=双手下垂)
      g.userData.rig = buildRig(inst);
      applyPose(g, (g.userData.lastPose as Record<string, number>) ?? STAND);
    }).catch(() => { /* 模型缺失时保持空组 */ });
    return g;
  }
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.34, metalness: 0.04 });
  const g = new THREE.Group();
  const J: Record<string, THREE.Object3D> = {};
  const mesh = (geo: THREE.BufferGeometry) => new THREE.Mesh(geo, mat);
  const orb = (rx: number, ry: number, rz: number, x = 0, y = 0, z = 0) => {
    const m = mesh(new THREE.SphereGeometry(1, 24, 18));
    m.scale.set(rx, ry, rz);
    m.position.set(x, y, z);
    return m;
  };
  const ball = (r: number) => mesh(new THREE.SphereGeometry(r, 20, 16));
  // 车削躯干:向心 Catmull-Rom 采样(均匀样条会过冲出"轮胎圈",必须用 centripetal)
  const lathe = (pts: [number, number][], sz: number) => {
    const c = new THREE.CatmullRomCurve3(pts.map(([x, y]) => new THREE.Vector3(x, y, 0)), false, "centripetal");
    const sampled = c.getPoints(48).map((v) => new THREE.Vector2(Math.max(0.001, v.x), v.y));
    const m = mesh(new THREE.LatheGeometry(sampled, 36));
    m.scale.z = sz;
    return m;
  };
  // 大肚只朝身前隆起(参考图的胖是前凸,不是四面均匀的游泳圈)
  const bulgeFront = (m: THREE.Mesh, amt: number, y0: number, y1: number) => {
    const geo = m.geometry as THREE.BufferGeometry;
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y < y0 || y > y1) continue;
      const x = pos.getX(i), z = pos.getZ(i);
      const r = Math.hypot(x, z);
      if (z <= 0 || r < 1e-4) continue;
      const k = Math.sin(((y - y0) / (y1 - y0)) * Math.PI);
      const f = z / r;
      pos.setZ(i, z + amt * k * f * f);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  };
  // 渐细肢段
  const taper = (parent: THREE.Object3D, rTop: number, rBot: number, span: number) => {
    const cyl = mesh(new THREE.CylinderGeometry(rTop, rBot, span, 20));
    cyl.position.y = -span / 2;
    parent.add(cyl);
  };
  const w = B.w, lb = B.limb, t = B.torso, lg = B.leg, ar = B.arm;
  const ts = Math.max(t, 0.72);
  const hipsY = 0.94 * lg;
  const depth = B.belly ? 0.86 : 0.66;

  const hips = new THREE.Group();
  hips.position.y = hipsY;
  g.add(hips);
  J.hips = hips;

  // 下躯干:裆 → 髋 → 腰
  const lower = lathe([
    [0.05 * w, -0.16 * ts],
    [0.128 * w * B.hip, -0.125 * ts],
    [0.163 * w * B.hip, -0.05 * ts],
    [0.16 * w * B.hip, 0.01 * ts],
    [0.15 * w * Math.max(B.waist, 0.78), 0.05 * ts],
    [0.146 * w * Math.max(B.waist, 0.78), 0.088 * ts],
  ], depth);
  if (B.belly) bulgeFront(lower, 0.05, -0.06 * ts, 0.09 * ts);
  hips.add(lower);

  const spine = new THREE.Group();
  spine.position.y = 0.085 * ts;
  hips.add(spine);
  J.spine = spine;

  // 上躯干:腰 → 胸 → 肩,连续光滑;宽厚体型在前方加腹凸
  const upper = lathe([
    [0.146 * w * Math.max(B.waist, 0.78), 0],
    [0.152 * w * Math.max(B.waist, 0.82), 0.075 * t],
    [0.162 * w * B.chest, 0.17 * t],
    [0.17 * w * B.chest, 0.25 * t],
    [0.156 * w * B.chest, 0.3 * t],
    [0.112 * w * B.shoulder, 0.34 * t],
    [0.05 * w, 0.36 * t],
  ], depth);
  if (B.belly) bulgeFront(upper, 0.075, -0.01 * t, 0.21 * t);
  spine.add(upper);
  // 肌肉线条:贴胸口表面的微凸
  if (B.tone) {
    const k = B.tone;
    const zf = 0.17 * B.chest * w * depth;
    spine.add(orb(0.08 * w * k, 0.055 * k, 0.05, 0.072 * w, 0.262 * t, zf - 0.026));
    spine.add(orb(0.08 * w * k, 0.055 * k, 0.05, -0.072 * w, 0.262 * t, zf - 0.026));
    spine.add(orb(0.054 * w * k, 0.1 * k * t, 0.045, 0, 0.12 * t, zf * 0.84 - 0.025));
  }
  if (B.bust) {
    const zf = 0.17 * B.chest * w * depth;
    spine.add(orb(0.058 * w, 0.052, 0.052, 0.06 * w, 0.252 * t, zf - 0.023));
    spine.add(orb(0.058 * w, 0.052, 0.052, -0.06 * w, 0.252 * t, zf - 0.023));
  }
  // 脖子:宽厚体型几乎没脖子,头坐进肩膀
  const neckH = (B.belly ? 0.05 : 0.085) * Math.max(t, 0.6);
  const neck = mesh(new THREE.CylinderGeometry(0.036, 0.046, neckH, 16));
  neck.position.y = (B.belly ? 0.375 : 0.39) * t;
  spine.add(neck);

  const headG = new THREE.Group();
  headG.position.y = (B.belly ? 0.395 : 0.42) * t;
  spine.add(headG);
  J.head = headG;
  const hd = B.head;
  headG.add(orb(0.093 * hd, 0.119 * hd, 0.1 * hd, 0, 0.026 + 0.119 * hd, 0.004));
  headG.add(orb(0.073 * hd, 0.07 * hd, 0.084 * hd, 0, 0.026 + 0.054 * hd, 0.012));

  for (const side of ["L", "R"] as const) {
    const sx = side === "L" ? 1 : -1;
    const sh = new THREE.Group();
    // 肩球嵌在躯干顶部两角,圆肩并入手臂
    sh.position.set(sx * 0.155 * w * B.shoulder, 0.305 * t, 0);
    // ZYX:外展(Z)在最外层、扭转(Y)贴着肢体轴,叉腰/抱臂等动作的肘部弯曲方向才正确
    sh.rotation.order = "ZYX";
    spine.add(sh);
    J[`sh${side}`] = sh;
    sh.add(ball(0.066 * Math.max(lb, 0.85)));
    taper(sh, 0.054 * lb, 0.044 * lb, 0.26 * ar);
    const el = new THREE.Group();
    el.position.y = -0.26 * ar;
    sh.add(el);
    J[`el${side}`] = el;
    el.add(ball(0.047 * lb));
    taper(el, 0.044 * lb, 0.03 * lb, 0.255 * ar);
    const wrist = ball(0.028 * lb);
    wrist.position.y = -0.255 * ar;
    el.add(wrist);
    const hs = Math.max(lb, 0.75) * Math.max(ar, 0.7);
    el.add(orb(0.041 * hs, 0.062 * hs, 0.023 * hs, 0, -0.305 * ar, 0.006));
    el.add(orb(0.016 * hs, 0.034 * hs, 0.015 * hs, sx * 0.033 * hs, -0.285 * ar, 0.02 * hs));

    const hip = new THREE.Group();
    hip.position.set(sx * 0.085 * w * B.hip, -0.06, 0);
    hip.rotation.order = "ZYX";
    hips.add(hip);
    J[`hip${side}`] = hip;
    hip.add(ball(0.072 * lb));
    taper(hip, 0.078 * lb, 0.054 * lb, 0.42 * lg);
    const kn = new THREE.Group();
    kn.position.y = -0.42 * lg;
    hip.add(kn);
    J[`kn${side}`] = kn;
    kn.add(ball(0.056 * lb));
    taper(kn, 0.052 * lb, 0.031 * lb, 0.4 * lg);
    const ankle = ball(0.031 * lb);
    ankle.position.y = -0.4 * lg;
    kn.add(ankle);
    // 鞋:鞋身 + 圆头鞋尖 + 后跟
    const fs = Math.max(lg, 0.55);
    const fw = Math.max(lb, 0.8);
    kn.add(orb(0.047 * fw, 0.034, 0.095 * fs, 0, -0.422 * lg, 0.045 * fs));
    kn.add(orb(0.043 * fw, 0.027, 0.05, 0, -0.428 * lg, 0.105 * fs));
    kn.add(orb(0.04 * fw, 0.04, 0.042, 0, -0.418 * lg, -0.01));
  }

  g.userData = { joints: J, mats: [mat], hipsY, buildKey: body };
  return g;
}

function applyPose(g: THREE.Group, p: Record<string, number>) {
  g.userData.lastPose = p;
  if (g.userData.rig) {
    applyPoseRig(g.userData.rig as RigData, p);
    return;
  }
  const J = g.userData.joints as Record<string, THREE.Object3D> | null;
  if (!J || !J.hips) return; // GLB 素体加载中/无关节,姿势暂不生效
  const v = (k: string) => p[k] ?? 0;
  J.hips.rotation.set(deg(v("bodyBend")), deg(v("bodyTurn")), deg(v("bodyLean")));
  // drop 按腿长比例缩放,儿童/二头身坐蹲跪不会沉到地面以下
  J.hips.position.y = (g.userData.hipsY as number) * (1 - v("drop") / 0.94);
  J.spine.rotation.set(deg(v("torsoBend")), deg(v("torsoTwist")), deg(v("torsoLean")));
  J.head.rotation.set(deg(v("headNod")), deg(v("headTurn")), deg(v("headTilt")));
  J.shL.rotation.set(deg(-v("armLRaise")), deg(v("armLTwist")), deg(v("armLSpread")));
  J.shR.rotation.set(deg(-v("armRRaise")), deg(-v("armRTwist")), deg(-v("armRSpread")));
  J.elL.rotation.x = deg(-v("elbowLBend"));
  J.elR.rotation.x = deg(-v("elbowRBend"));
  J.hipL.rotation.set(deg(-v("legLRaise")), deg(v("legLTwist")), deg(v("legLSpread")));
  J.hipR.rotation.set(deg(-v("legRRaise")), deg(-v("legRTwist")), deg(-v("legRSpread")));
  J.knL.rotation.x = deg(v("kneeLBend"));
  J.knR.rotation.x = deg(v("kneeRBend"));
}

function buildCamModel(): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xf0a132, roughness: 0.45, metalness: 0.15 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.6 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.17), mat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.02), dark);
  back.position.set(0, -0.005, -0.09);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.056, 0.1, 16), mat);
  lens.rotation.x = Math.PI / 2;
  lens.position.set(0, 0.012, 0.125);
  const lensCap = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.012, 14), dark);
  lensCap.rotation.x = Math.PI / 2;
  lensCap.position.set(0, 0.012, 0.178);
  const top1 = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.035, 0.06), dark);
  top1.position.set(0.05, 0.115, 0);
  const top2 = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.032, 10), dark);
  top2.position.set(-0.062, 0.114, 0.02);
  g.add(body, back, lens, lensCap, top1, top2);

  const pcam = new THREE.PerspectiveCamera(50, 16 / 9, 0.05, 200);
  pcam.rotation.y = Math.PI; // 组 +Z 朝向注视点,相机 -Z 对齐组 +Z
  g.add(pcam);

  const fr = new THREE.LineSegments(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.38 }),
  );
  fr.raycast = () => {};
  g.add(fr);
  g.userData = { mats: [mat], pcam, frustum: fr, frKey: "" };
  return g;
}

function updateFrustum(g: THREE.Group, fov: number, aspect: number) {
  const key = `${fov.toFixed(1)}|${aspect.toFixed(3)}`;
  if (g.userData.frKey === key) return;
  g.userData.frKey = key;
  const d = 1.8;
  const hh = Math.tan(deg(fov / 2)) * d;
  const hw = hh * aspect;
  const o = [0, 0, 0];
  const a = [-hw, hh, d], b = [hw, hh, d], c = [hw, -hh, d], e = [-hw, -hh, d];
  const pts = [o, a, o, b, o, c, o, e, a, b, b, c, c, e, e, a].flat();
  const fr = g.userData.frustum as THREE.LineSegments;
  fr.geometry.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  fr.geometry.computeBoundingSphere();
}

const texCache = new Map<string, THREE.Texture>();
function buildModelMesh(m: DcModel): THREE.Group {
  const g = new THREE.Group();
  if (m.shape === "glb" && m.url) {
    const loader = new GLTFLoader();
    loader.load(m.url, (gltf) => {
      const sc = gltf.scene;
      const box = new THREE.Box3().setFromObject(sc);
      const size = box.getSize(new THREE.Vector3());
      const s = 1.7 / Math.max(size.x, size.y, size.z, 0.001);
      sc.scale.setScalar(s);
      const box2 = new THREE.Box3().setFromObject(sc);
      sc.position.y -= box2.min.y;
      g.add(sc);
    });
    g.userData = { mats: [], buildKey: `glb|${m.url.slice(0, 60)}` };
    return g;
  }
  if (m.shape === "plane" || m.shape === "backdrop") {
    const mt = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: m.shape === "plane" ? 0.92 : 1 });
    if (m.url) {
      const cached = texCache.get(m.url);
      if (cached) mt.map = cached;
      else {
        new THREE.TextureLoader().load(m.url, (tx) => {
          tx.colorSpace = THREE.SRGBColorSpace;
          texCache.set(m.url!, tx);
          mt.map = tx;
          mt.needsUpdate = true;
        });
      }
    }
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mt);
    if (m.shape === "backdrop") {
      mesh.position.y = 0.5; // 底边落地,缩放时向上长
      const shadow = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 0.16),
        new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.26, depthWrite: false }),
      );
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.set(0, 0.002, 0.08);
      shadow.raycast = () => {};
      g.add(shadow);
    }
    g.add(mesh);
    g.userData = { mats: [], buildKey: `${m.shape}|${m.url?.slice(0, 60)}` };
    return g;
  }
  const mat = new THREE.MeshStandardMaterial({ color: m.color, roughness: 0.55, metalness: 0.1 });
  let geo: THREE.BufferGeometry;
  switch (m.shape) {
    case "sphere": geo = new THREE.SphereGeometry(0.32, 24, 18); break;
    case "cylinder": geo = new THREE.CylinderGeometry(0.26, 0.26, 0.64, 24); break;
    case "torus": geo = new THREE.TorusGeometry(0.26, 0.09, 14, 28); break;
    case "cone": geo = new THREE.ConeGeometry(0.3, 0.66, 24); break;
    case "pyramid": geo = new THREE.ConeGeometry(0.34, 0.66, 4); break;
    default: geo = new THREE.BoxGeometry(0.55, 0.55, 0.55);
  }
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = m.shape === "torus" ? 0.35 : 0.33;
  g.add(mesh);
  g.userData = { mats: [mat], buildKey: m.shape };
  return g;
}

function mkLabel(text: string, cls: string): CSS2DObject {
  const div = document.createElement("div");
  div.className = cls;
  div.textContent = text;
  const o = new CSS2DObject(div);
  return o;
}

// ── 通用小控件(必须在模块层定义:若放组件体内,每次渲染都是新组件类型,
//    input 会被整棵重挂载,滑杆拖到一半就断) ──
function Num({ v, on, step = 0.1, dis }: { v: number; on: (n: number) => void; step?: number; dis?: boolean }) {
  return (
    <input
      type="number"
      className="dc-num"
      step={step}
      disabled={dis}
      value={Number.isFinite(v) ? v : 0}
      onChange={(e) => { const n = parseFloat(e.target.value); if (Number.isFinite(n)) on(n); }}
    />
  );
}
function Xyz({ v, on, step = 0.1, dis }: { v: Vec3; on: (nv: Vec3) => void; step?: number; dis?: boolean }) {
  return (
    <div className="dc-xyz">
      {(["X", "Y", "Z"] as const).map((ax, i) => (
        <label key={ax} className="dc-xyz-it">
          <span>{ax}</span>
          <Num v={v[i]} step={step} dis={dis} on={(n) => { const nv = [...v] as Vec3; nv[i] = n; on(nv); }} />
        </label>
      ))}
    </div>
  );
}
function Slider({ lb, v, min, max, step = 1, on, fmt }: { lb: string; v: number; min: number; max: number; step?: number; on: (n: number) => void; fmt?: (n: number) => string }) {
  return (
    <div className="dc-sld-row">
      <span className="dc-sld-lb">{lb}</span>
      <input type="range" className="dc-sld" min={min} max={max} step={step} value={v} onChange={(e) => on(Number(e.target.value))} />
      <span className="dc-sld-val">{fmt ? fmt(v) : Math.round(v)}</span>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// 组件
// ────────────────────────────────────────────────────────────────────────────

function mkChar(name: string, color: string, body: BodyType, pos: Vec3, rotY = 0): DcChar {
  return { kind: "char", id: uid(), name, body, color, pos, rot: [0, rotY, 0], scale: [1, 1, 1], pose: { ...STAND }, preset: "站立" };
}
function mkCam(name: string, pos: Vec3, target: Vec3, fov = 50): DcCam {
  return { kind: "cam", id: uid(), name, pos, target, fov, look: "manual" };
}

function defaultDoc(): DirectorSave {
  return {
    v: 1,
    chars: [
      mkChar("角色A", "#4F8EF7", "male", [0, 0, 0]),
      mkChar("角色B", "#E1574C", "male", [0.6, 0, -0.45]),
    ],
    models: [],
    cams: [
      mkCam("机位1", [0, 1.4, 3.6], [0, 1.2, 0]),
      mkCam("机位2", [-3.4, 1.5, 1.7], [0, 1.2, 0]),
    ],
    shots: [],
    refs: [],
    ratio: "Auto",
  };
}

interface Props {
  initial?: DirectorSave;
  onSave: (d: DirectorSave) => void;
  onClose: () => void;
  onExportImage?: (url: string, name: string) => void;
  // 截图「导出到画布」:生成图片节点并与导演台节点连线
  onExportShot?: (url: string, name: string) => void;
}

type Tool = "translate" | "rotate" | "scale";
type Pop = null | "tool" | "add" | "cam" | "ratio" | "help" | "gen";

// 旧版站位参考是平铺地面的 plane,统一迁移为立体布景 backdrop
function migrateDoc(d: DirectorSave): DirectorSave {
  if (!d.models?.some((m) => m.shape === "plane")) return d;
  return {
    ...d,
    models: d.models.map((m) =>
      m.shape === "plane" ? { ...m, shape: "backdrop" as ModelShape, rot: [0, 0, 0] as Vec3, pos: [m.pos[0], 0, m.pos[2]] as Vec3 } : m,
    ),
  };
}

export function DirectorConsole({ initial, onSave, onClose, onExportImage, onExportShot }: Props) {
  const [doc, setDoc] = useState<DirectorSave>(() => (initial && initial.chars ? migrateDoc(initial) : defaultDoc()));
  const [mode, setMode] = useState<"dir" | "cam">("dir");
  const [activeCam, setActiveCam] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>("translate");
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggle);
  const [pop, setPop] = useState<Pop>(null);
  const [addSub, setAddSub] = useState<null | "geo" | "crowd">(null);
  const [crowd, setCrowd] = useState({ rows: 3, cols: 3, gap: 1.2 });
  const [search, setSearch] = useState("");
  const [charTab, setCharTab] = useState<"prop" | "pose">("prop");
  const [camTab, setCamTab] = useState<"prop" | "shots">("prop");
  const [vp, setVp] = useState({ w: 1280, h: 720 });
  const [flash, setFlash] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<DcShot | null>(null);
  const [upModal, setUpModal] = useState(false);
  const [upTab, setUpTab] = useState<"local" | "history">("local");
  const [upImg, setUpImg] = useState<{ url: string; name: string } | null>(null);
  const [upCover, setUpCover] = useState(false);
  const [isFs, setIsFs] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const navRef = useRef<HTMLCanvasElement>(null);
  const upFileRef = useRef<HTMLInputElement>(null);
  const glbFileRef = useRef<HTMLInputElement>(null);
  const directUpRef = useRef(false); // 菜单「本地上传」:选完文件直接进场景,不过弹窗

  const docRef = useRef(doc); docRef.current = doc;
  const modeRef = useRef(mode); modeRef.current = mode;
  const activeCamRef = useRef(activeCam); activeCamRef.current = activeCam;
  const selRef = useRef(sel); selRef.current = sel;
  const onSaveRef = useRef(onSave); onSaveRef.current = onSave;

  const three = useRef<{
    scene: THREE.Scene;
    renderer: THREE.WebGLRenderer;
    labelRenderer: CSS2DRenderer;
    orbitCam: THREE.PerspectiveCamera;
    orbit: OrbitControls;
    tc: TransformControls;
    objs: Map<string, THREE.Group>;
    labels: Map<string, CSS2DObject>;
    ground: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
    grid: THREE.GridHelper;
    hemi: THREE.HemisphereLight;
    raf: number;
  } | null>(null);
  const dragStart = useRef<{ pos: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  const justDragged = useRef(false);
  // 落地反馈:贴地瞬间在脚下扩散两圈波纹光环 + 模型短促发光脉冲
  const groundedRef = useRef(false);
  const ripplesRef = useRef<{ mesh: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>; t0: number; id: string }[]>([]);
  const flashRef = useRef<{ id: string; t0: number } | null>(null);

  const toastTimer = useRef<number | null>(null);
  const say = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2400);
  };

  // 自动保存(防抖);卸载时强制落盘,避免关闭前 400ms 内的改动丢失
  useEffect(() => {
    const t = window.setTimeout(() => onSaveRef.current(doc), 400);
    return () => window.clearTimeout(t);
  }, [doc]);
  useEffect(() => () => onSaveRef.current(docRef.current), []);

  const entities: DcEntity[] = [...doc.cams, ...doc.chars, ...doc.models];
  const entityOf = (id: string | null): DcEntity | null => (id ? entities.find((e) => e.id === id) ?? null : null);
  const selE = entityOf(sel);

  const patchChar = (id: string, p: Partial<DcChar>) =>
    setDoc((d) => ({ ...d, chars: d.chars.map((c) => (c.id === id ? { ...c, ...p } : c)) }));
  const patchModel = (id: string, p: Partial<DcModel>) =>
    setDoc((d) => ({ ...d, models: d.models.map((m) => (m.id === id ? { ...m, ...p } : m)) }));
  const patchCam = (id: string, p: Partial<DcCam>) =>
    setDoc((d) => ({ ...d, cams: d.cams.map((c) => (c.id === id ? { ...c, ...p } : c)) }));
  const removeEntity = (id: string) => {
    setDoc((d) => ({
      ...d,
      chars: d.chars.filter((c) => c.id !== id),
      models: d.models.filter((m) => m.id !== id),
      cams: d.cams.filter((c) => c.id !== id),
    }));
    if (sel === id) setSel(null);
    if (activeCam === id) setActiveCam(null);
  };

  const nextName = (base: string, list: { name: string }[]) => {
    const re = new RegExp(`^${base}(\\d+)$`);
    const max = Math.max(0, ...list.map((x) => { const m = x.name.match(re); return m ? parseInt(m[1], 10) : 0; }));
    return `${base}${max + 1}`;
  };
  const nextCharName = () => {
    const used = new Set(doc.chars.map((c) => c.name));
    for (let i = 0; i < 26; i++) {
      const nm = `角色${String.fromCharCode(65 + i)}`;
      if (!used.has(nm)) return nm;
    }
    return nextName("角色", doc.chars);
  };

  // 添加角色:落在导演相机注视点附近的空位
  const dropPoint = (): Vec3 => {
    const t3 = three.current;
    const c = t3 ? t3.orbit.target : new THREE.Vector3();
    const taken = [...doc.chars, ...doc.models].map((e) => e.pos);
    for (let ring = 0; ring < 8; ring++) {
      for (let k = 0; k < Math.max(1, ring * 4); k++) {
        const ang = (k / Math.max(1, ring * 4)) * Math.PI * 2;
        const x = Math.round((c.x + Math.cos(ang) * ring * 0.7) * 2) / 2;
        const z = Math.round((c.z + Math.sin(ang) * ring * 0.7) * 2) / 2;
        if (!taken.some((p) => Math.abs(p[0] - x) < 0.45 && Math.abs(p[2] - z) < 0.45)) return [x, 0, z];
      }
    }
    return [r2(c.x), 0, r2(c.z)];
  };

  const addChar = (body: BodyType) => {
    const ch = mkChar(nextCharName(), BODY[body].color, body, dropPoint());
    setDoc((d) => ({ ...d, chars: [...d.chars, ch] }));
    setSel(ch.id);
    setPop(null);
  };
  const addCrowd = () => {
    const at = dropPoint();
    const rows = Math.min(10, Math.max(1, Math.round(crowd.rows)));
    const cols = Math.min(10, Math.max(1, Math.round(crowd.cols)));
    const gap = Math.min(5, Math.max(0.5, crowd.gap));
    const list: DcChar[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cc = mkChar(
          nextName("群众", [...doc.chars, ...list]), "#9aa3af", "male",
          [r2(at[0] + (c - (cols - 1) / 2) * gap), 0, r2(at[2] + (r - (rows - 1) / 2) * gap)],
        );
        list.push(cc);
      }
    }
    setDoc((d) => ({ ...d, chars: [...d.chars, ...list] }));
    setPop(null);
    setAddSub(null);
    say(`已添加 ${rows} × ${cols} 群众阵列`);
  };
  const addModel = (shape: ModelShape) => {
    const def = GEOM_SHAPES.find((s) => s.shape === shape);
    const m: DcModel = {
      kind: "model", id: uid(), shape,
      name: nextName(def?.label ?? "模型", doc.models),
      color: "#8d97a8", pos: dropPoint(), rot: [0, 0, 0], scale: [1, 1, 1],
    };
    setDoc((d) => ({ ...d, models: [...d.models, m] }));
    setSel(m.id);
    setPop(null);
    setAddSub(null);
  };

  // 添加机位:基于选中角色(否则第一个角色 / 世界原点)的局部偏移
  const addCam = (presetId: string) => {
    const t3 = three.current;
    let cam: DcCam;
    if (presetId === "cur" && t3) {
      cam = mkCam(nextName("机位", doc.cams), t3.orbitCam.position.toArray() as Vec3, t3.orbit.target.toArray() as Vec3, 50);
    } else {
      const p = CAM_PRESETS.find((x) => x.id === presetId);
      if (!p?.off || !p.tgt) return;
      const subject = (selE?.kind === "char" ? (selE as DcChar) : doc.chars[0]) ?? null;
      const base = subject ? new THREE.Vector3(...subject.pos) : new THREE.Vector3();
      const rotY = subject ? deg(subject.rot[1]) : 0;
      const turn = (v: Vec3) => new THREE.Vector3(...v).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY).add(base);
      const pos = turn(p.off);
      const tgt = turn(p.tgt);
      cam = mkCam(nextName("机位", doc.cams), [r2(pos.x), r2(pos.y), r2(pos.z)], [r2(tgt.x), r2(tgt.y), r2(tgt.z)], p.fov ?? 50);
      if (subject && p.tgt[2] === 0) cam.look = subject.id;
    }
    setDoc((d) => ({ ...d, cams: [...d.cams, cam] }));
    setSel(cam.id);
    setPop(null);
    say(`已添加 ${cam.name}`);
  };

  // ── Three 初始化 ──
  // 延迟到下一帧:点击后覆盖层 UI 先绘制(否则 WebGL 初始化阻塞首帧,打开显得慢);
  // 同时 StrictMode 的首次试探性挂载会在 rAF 触发前被 cancel,避免双重初始化
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cleanup: (() => void) | null = null;
    const raf = requestAnimationFrame(() => {
      cleanup = initThree();
      setReady(true);
    });
    return () => {
      cancelAnimationFrame(raf);
      cleanup?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const initThree = () => {
    const mount = mountRef.current!;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x05070c);

    const hemi = new THREE.HemisphereLight(0x96a8c8, 0x1a2030, 1.05);
    const dir = new THREE.DirectionalLight(0xffffff, 1.5);
    dir.position.set(5, 9, 6);
    scene.add(hemi, dir);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(300, 300),
      new THREE.MeshBasicMaterial({ color: 0x070a11 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    ground.raycast = () => {};
    scene.add(ground);
    const grid = new THREE.GridHelper(40, 40, 0x5d7cb5, 0x33456e);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.85;
    grid.raycast = () => {};
    scene.add(grid);

    const orbitCam = new THREE.PerspectiveCamera(55, 16 / 9, 0.1, 400);
    orbitCam.position.set(6.5, 5.2, 9);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.className = "dc-canvas";
    mount.appendChild(renderer.domElement);

    const labelRenderer = new CSS2DRenderer();
    labelRenderer.domElement.className = "dc-labels";
    mount.appendChild(labelRenderer.domElement);

    const orbit = new OrbitControls(orbitCam, renderer.domElement);
    orbit.target.set(0, 1, 0);
    orbit.enableDamping = true;
    orbit.dampingFactor = 0.12;
    orbit.screenSpacePanning = true;
    orbit.minDistance = 0.6;
    orbit.maxDistance = 80;

    const tc = new TransformControls(orbitCam, renderer.domElement);
    tc.setTranslationSnap(0.1);
    tc.setRotationSnap(deg(5));
    tc.setSize(0.9);
    scene.add(tc.getHelper());
    // 拖动中只动 Three 对象(60fps 顺滑),松手才提交一次 React 状态
    const commitDrag = () => {
      const obj = tc.object;
      if (!obj) return;
      const id = obj.userData.eid as string;
      const d = docRef.current;
      const pos: Vec3 = [r2(obj.position.x), r2(obj.position.y), r2(obj.position.z)];
      const cam = d.cams.find((c) => c.id === id);
      if (cam) {
        const st = dragStart.current;
        if (tc.mode === "rotate") {
          const dist = st ? Math.max(0.2, st.target.distanceTo(st.pos)) : 2;
          const dirv = new THREE.Vector3(0, 0, 1).applyQuaternion(obj.quaternion);
          const tgt = obj.position.clone().add(dirv.multiplyScalar(dist));
          setDoc((dd) => ({ ...dd, cams: dd.cams.map((c) => c.id === id ? { ...c, pos, target: [r2(tgt.x), r2(tgt.y), r2(tgt.z)], look: "manual" } : c) }));
        } else {
          const delta = st ? obj.position.clone().sub(st.pos) : new THREE.Vector3();
          const tgt = st ? st.target.clone().add(delta) : new THREE.Vector3(...cam.target);
          setDoc((dd) => ({ ...dd, cams: dd.cams.map((c) => c.id === id ? { ...c, pos, target: c.look === "manual" ? [r2(tgt.x), r2(tgt.y), r2(tgt.z)] : c.target } : c) }));
        }
        return;
      }
      const ent = d.chars.find((c) => c.id === id) ?? d.models.find((m) => m.id === id);
      if (!ent) return;
      if (Math.abs(pos[1]) < 0.12) pos[1] = 0; // 贴地吸附(落地震动后收口)
      const rot: Vec3 = [r2(THREE.MathUtils.radToDeg(obj.rotation.x)), r2(THREE.MathUtils.radToDeg(obj.rotation.y)), r2(THREE.MathUtils.radToDeg(obj.rotation.z))];
      const scale: Vec3 = [r2(obj.scale.x), r2(obj.scale.y), r2(obj.scale.z)];
      if (ent.kind === "char") setDoc((dd) => ({ ...dd, chars: dd.chars.map((c) => (c.id === id ? { ...c, pos, rot, scale } : c)) }));
      else setDoc((dd) => ({ ...dd, models: dd.models.map((m) => (m.id === id ? { ...m, pos, rot, scale } : m)) }));
    };
    tc.addEventListener("dragging-changed", (e: { value?: unknown }) => {
      orbit.enabled = !e.value;
      if (e.value) {
        justDragged.current = true;
        const obj = tc.object;
        const id = obj?.userData.eid as string | undefined;
        const cam = id ? docRef.current.cams.find((c) => c.id === id) : null;
        dragStart.current = obj
          ? { pos: obj.position.clone(), target: cam ? new THREE.Vector3(...cam.target) : new THREE.Vector3() }
          : null;
        groundedRef.current = !!obj && Math.abs(obj.position.y) < 0.001;
      } else {
        commitDrag();
        dragStart.current = null;
      }
    });
    // 拖动中:角色/模型接近地面时吸附到 y=0,首次贴地触发落地波纹 + 发光提示
    const spawnRipple = (id: string, x: number, z: number) => {
      for (const delay of [0, 130]) {
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(0.3, 0.4, 42),
          new THREE.MeshBasicMaterial({ color: 0x4da3ff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }),
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(x, 0.012, z);
        ring.raycast = () => {};
        scene.add(ring);
        ripplesRef.current.push({ mesh: ring, t0: performance.now() + delay, id });
      }
      flashRef.current = { id, t0: performance.now() };
    };
    tc.addEventListener("objectChange", () => {
      const obj = tc.object;
      if (!obj || tc.mode !== "translate") return;
      const id = obj.userData.eid as string;
      if (docRef.current.cams.some((c) => c.id === id)) return;
      if (obj.position.y !== 0 && Math.abs(obj.position.y) < 0.15) obj.position.y = 0;
      if (obj.position.y === 0) {
        if (!groundedRef.current) {
          groundedRef.current = true;
          spawnRipple(id, obj.position.x, obj.position.z);
        }
      } else {
        groundedRef.current = false;
      }
    });

    const objs = new Map<string, THREE.Group>();
    const labels = new Map<string, CSS2DObject>();
    three.current = { scene, renderer, labelRenderer, orbitCam, orbit, tc, objs, labels, ground, grid, hemi, raf: 0 };
    (window as unknown as Record<string, unknown>).__dcScene = scene; // 调试入口

    // 点选:按下/抬起位移很小才算点击
    const downAt = { x: 0, y: 0 };
    const onDown = (e: PointerEvent) => { downAt.x = e.clientX; downAt.y = e.clientY; justDragged.current = false; };
    const onUp = (e: PointerEvent) => {
      if (e.button !== 0 || justDragged.current) return;
      if (Math.abs(e.clientX - downAt.x) > 5 || Math.abs(e.clientY - downAt.y) > 5) return;
      const r = renderer.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      const cam = currentRenderCam();
      const ray = new THREE.Raycaster();
      ray.setFromCamera(ndc, cam);
      const pool: THREE.Object3D[] = [];
      objs.forEach((g) => pool.push(g));
      const hits = ray.intersectObjects(pool, true);
      for (const h of hits) {
        let o: THREE.Object3D | null = h.object;
        while (o) {
          if (o.userData.eid) { setSel(o.userData.eid as string); return; }
          o = o.parent;
        }
      }
      setSel(null);
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);

    const ro = new ResizeObserver(() => {
      const w = mount.clientWidth, h = mount.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h);
      labelRenderer.setSize(w, h);
      orbitCam.aspect = w / h;
      orbitCam.updateProjectionMatrix();
      setVp({ w, h });
    });
    ro.observe(mount);

    const currentRenderCam = (): THREE.PerspectiveCamera => {
      const t3 = three.current!;
      if (modeRef.current === "cam") {
        const id = activeCamRef.current ?? docRef.current.cams[0]?.id;
        const g = id ? t3.objs.get(id) : null;
        const pc = g?.userData.pcam as THREE.PerspectiveCamera | undefined;
        if (pc) return pc;
      }
      return t3.orbitCam;
    };

    let frame = 0;
    const tick = () => {
      const t3 = three.current;
      if (!t3) return;
      t3.raf = requestAnimationFrame(tick);
      frame++;
      t3.orbit.update();
      const d = docRef.current;
      const vw = mount.clientWidth || 1, vh = mount.clientHeight || 1;

      // 机位朝向/视锥跟随
      for (const c of d.cams) {
        const g = t3.objs.get(c.id);
        if (!g) continue;
        const pc = g.userData.pcam as THREE.PerspectiveCamera;
        if (!(t3.tc.dragging && t3.tc.object === g)) {
          let tv: THREE.Vector3;
          const ch = c.look !== "manual" ? d.chars.find((x) => x.id === c.look) : null;
          if (ch) tv = new THREE.Vector3(ch.pos[0], ch.pos[1] + ch.scale[1] * (0.94 * BODY[ch.body].leg + 0.36 * BODY[ch.body].torso), ch.pos[2]);
          else tv = new THREE.Vector3(...c.target);
          g.lookAt(tv);
        }
        if (pc.fov !== c.fov) { pc.fov = c.fov; pc.updateProjectionMatrix(); }
        if (pc.aspect !== vw / vh) { pc.aspect = vw / vh; pc.updateProjectionMatrix(); }
        updateFrustum(g, c.fov, ratioVal(docRef.current.ratio) ?? 16 / 9);
      }

      // 落地波纹:跟随模型脚下扩散、淡出
      const rl = ripplesRef.current;
      for (let i = rl.length - 1; i >= 0; i--) {
        const rp = rl[i];
        const el = performance.now() - rp.t0;
        if (el < 0) continue;
        if (el > 520) {
          t3.scene.remove(rp.mesh);
          rp.mesh.geometry.dispose();
          rp.mesh.material.dispose();
          rl.splice(i, 1);
          continue;
        }
        const k = el / 520;
        const host = t3.objs.get(rp.id);
        if (host) { rp.mesh.position.x = host.position.x; rp.mesh.position.z = host.position.z; }
        rp.mesh.scale.setScalar(0.55 + k * 2.1);
        rp.mesh.material.opacity = 0.85 * (1 - k) * (1 - k);
      }
      // 落地发光脉冲:材质 emissive 短暂泛蓝后回到选中态
      if (flashRef.current) {
        const fl = flashRef.current;
        const host = t3.objs.get(fl.id);
        const mats = host?.userData.mats as THREE.MeshStandardMaterial[] | undefined;
        const el = performance.now() - fl.t0;
        if (!mats?.[0] || el > 380) {
          mats?.[0]?.emissive.set(selRef.current === fl.id ? 0x223044 : 0x000000);
          flashRef.current = null;
        } else {
          const k = 1 - el / 380;
          mats[0].emissive.setRGB(0.18 * k, 0.32 * k, 0.55 * k);
        }
      }

      // 右栏机位实时预览(隔帧)
      const pv = previewRef.current;
      const selId = selRef.current;
      if (pv && selId && frame % 3 === 0 && modeRef.current === "dir") {
        const g = t3.objs.get(selId);
        const pc = g?.userData.pcam as THREE.PerspectiveCamera | undefined;
        if (g && pc) {
          g.visible = false;
          const lb = t3.labels.get(selId);
          if (lb) lb.visible = false;
          t3.renderer.render(t3.scene, pc);
          const ctx = pv.getContext("2d");
          if (ctx) {
            ctx.fillStyle = document.documentElement.getAttribute("data-theme") === "light" ? "#dde4ee" : "#05070c";
            ctx.fillRect(0, 0, pv.width, pv.height);
            const src = t3.renderer.domElement;
            const sa = src.width / src.height, da = pv.width / pv.height;
            let sx = 0, sy = 0, sw = src.width, sh = src.height;
            if (sa > da) { sw = sh * da; sx = (src.width - sw) / 2; }
            else { sh = sw / da; sy = (src.height - sh) / 2; }
            ctx.drawImage(src, sx, sy, sw, sh, 0, 0, pv.width, pv.height);
          }
          g.visible = true;
          if (lb) lb.visible = true;
        }
      }

      // 导航球(2D 投影)
      const nav = navRef.current;
      if (nav && frame % 2 === 0) {
        const ctx = nav.getContext("2d");
        if (ctx) {
          const S = nav.width, C = S / 2, R = S * 0.36;
          ctx.clearRect(0, 0, S, S);
          ctx.fillStyle = "rgba(16,19,26,.85)";
          ctx.beginPath(); ctx.arc(C, C, C - 1, 0, Math.PI * 2); ctx.fill();
          const q = t3.orbitCam.quaternion.clone().invert();
          const axes: [THREE.Vector3, string][] = [
            [new THREE.Vector3(1, 0, 0), "#e1574c"],
            [new THREE.Vector3(0, 1, 0), "#34b37e"],
            [new THREE.Vector3(0, 0, 1), "#4f8ef7"],
          ];
          const pts: { x: number; y: number; z: number; c: string; neg: boolean }[] = [];
          for (const [v, c] of axes) {
            const p = v.clone().applyQuaternion(q);
            pts.push({ x: C + p.x * R, y: C - p.y * R, z: p.z, c, neg: false });
            pts.push({ x: C - p.x * R, y: C + p.y * R, z: -p.z, c, neg: true });
          }
          pts.sort((a, b) => a.z - b.z);
          for (const p of pts) {
            if (!p.neg) {
              ctx.strokeStyle = p.c; ctx.lineWidth = 1.6; ctx.globalAlpha = 0.9;
              ctx.beginPath(); ctx.moveTo(C, C); ctx.lineTo(p.x, p.y); ctx.stroke();
            }
            ctx.globalAlpha = p.neg ? 0.45 : 1;
            ctx.fillStyle = p.c;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.neg ? 3 : 4.4, 0, Math.PI * 2); ctx.fill();
          }
          ctx.globalAlpha = 1;
        }
      }

      // 主渲染
      const rc = currentRenderCam();
      let hidden: THREE.Group | null = null;
      let hiddenLb: CSS2DObject | null = null;
      if (modeRef.current === "cam") {
        const id = activeCamRef.current ?? d.cams[0]?.id;
        const g = id ? t3.objs.get(id) : null;
        if (g) {
          hidden = g; g.visible = false;
          hiddenLb = (id && t3.labels.get(id)) || null;
          if (hiddenLb) hiddenLb.visible = false;
        }
      }
      t3.renderer.render(t3.scene, rc);
      t3.labelRenderer.render(t3.scene, rc);
      if (hidden) hidden.visible = true;
      if (hiddenLb) hiddenLb.visible = true;
    };
    tick();

    return () => {
      const t3 = three.current;
      if (!t3) return;
      cancelAnimationFrame(t3.raf);
      ro.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      tc.detach();
      tc.dispose();
      orbit.dispose();
      t3.labels.forEach((l) => l.element.remove());
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      mount.removeChild(labelRenderer.domElement);
      three.current = null;
    };
  };

  // ── 实体同步(状态 → 场景图)──
  useEffect(() => {
    const t3 = three.current;
    if (!t3) return;
    const seen = new Set<string>();

    const ensureLabel = (id: string, text: string, cls: string, parent: THREE.Group, y: number) => {
      let lb = t3.labels.get(id);
      if (!lb) {
        lb = mkLabel(text, cls);
        t3.labels.set(id, lb);
        parent.add(lb);
      }
      lb.element.textContent = text;
      lb.element.className = cn(cls, sel === id && "on");
      lb.position.set(0, y, 0);
    };

    for (const c of doc.chars) {
      seen.add(c.id);
      let g = t3.objs.get(c.id);
      if (g && g.userData.buildKey !== c.body) {
        t3.tc.object === g && t3.tc.detach();
        t3.labels.get(c.id)?.element.remove();
        t3.labels.delete(c.id);
        t3.scene.remove(g);
        g = undefined;
      }
      if (!g) {
        g = buildMannequin(c.color, c.body);
        g.userData.eid = c.id;
        t3.scene.add(g);
        t3.objs.set(c.id, g);
      }
      if (!(t3.tc.dragging && t3.tc.object === g)) {
        g.position.set(...c.pos);
        g.rotation.set(deg(c.rot[0]), deg(c.rot[1]), deg(c.rot[2]));
        g.scale.set(...c.scale);
      }
      applyPose(g, c.pose);
      const mats = g.userData.mats as THREE.MeshStandardMaterial[];
      mats[0]?.color.set(c.color);
      mats[0]?.emissive.set(sel === c.id ? 0x223044 : 0x000000);
      ensureLabel(c.id, c.name, "dc-label", g, 0.94 * BODY[c.body].leg + 0.5 * BODY[c.body].torso + 0.27 * BODY[c.body].head + 0.16);
    }

    for (const m of doc.models) {
      seen.add(m.id);
      const key = m.shape === "glb" || m.shape === "plane" ? `${m.shape}|${m.url?.slice(0, 60)}` : m.shape;
      let g = t3.objs.get(m.id);
      if (g && g.userData.buildKey !== key) {
        t3.tc.object === g && t3.tc.detach();
        t3.labels.get(m.id)?.element.remove();
        t3.labels.delete(m.id);
        t3.scene.remove(g);
        g = undefined;
      }
      if (!g) {
        g = buildModelMesh(m);
        g.userData.eid = m.id;
        t3.scene.add(g);
        t3.objs.set(m.id, g);
      }
      if (!(t3.tc.dragging && t3.tc.object === g)) {
        g.position.set(...m.pos);
        g.rotation.set(deg(m.rot[0]), deg(m.rot[1]), deg(m.rot[2]));
        g.scale.set(...m.scale);
      }
      const mats = g.userData.mats as THREE.MeshStandardMaterial[];
      mats[0]?.color.set(m.color);
      mats[0]?.emissive.set(sel === m.id ? 0x223044 : 0x000000);
      ensureLabel(m.id, m.name, "dc-label sm", g, m.shape === "plane" ? 0.25 : m.shape === "backdrop" ? 1.04 : 0.95);
    }

    for (const c of doc.cams) {
      seen.add(c.id);
      let g = t3.objs.get(c.id);
      if (!g) {
        g = buildCamModel();
        g.userData.eid = c.id;
        t3.scene.add(g);
        t3.objs.set(c.id, g);
      }
      if (!(t3.tc.dragging && t3.tc.object === g)) g.position.set(...c.pos);
      const mats = g.userData.mats as THREE.MeshStandardMaterial[];
      mats[0]?.emissive.set(sel === c.id ? 0x553300 : 0x000000);
      mats[0]?.emissive && (mats[0].emissiveIntensity = sel === c.id ? 0.6 : 0);
      ensureLabel(c.id, c.name, "dc-label cam", g, 0.32);
    }

    // 清理已删除实体
    for (const [id, g] of [...t3.objs]) {
      if (seen.has(id)) continue;
      if (t3.tc.object === g) t3.tc.detach();
      t3.labels.get(id)?.element.remove();
      t3.labels.delete(id);
      t3.scene.remove(g);
      t3.objs.delete(id);
    }
  }, [doc, sel, ready]);

  // ── 选中 → gizmo ──
  useEffect(() => {
    const t3 = three.current;
    if (!t3) return;
    const g = sel ? t3.objs.get(sel) : null;
    const isCam = !!sel && doc.cams.some((c) => c.id === sel);
    if (mode === "dir" && g) {
      t3.tc.attach(g);
      t3.tc.setMode(isCam && tool === "scale" ? "translate" : tool);
    } else {
      t3.tc.detach();
    }
  }, [sel, tool, mode, doc.cams, ready]);

  // 主题:同步 3D 场景配色(背景/地面/网格/环境光)
  useEffect(() => {
    const t3 = three.current;
    if (!t3) return;
    const dark = theme === "dark";
    t3.scene.background = new THREE.Color(dark ? 0x05070c : 0xdde4ee);
    t3.ground.material.color.set(dark ? 0x070a11 : 0xe7ecf4);
    t3.scene.remove(t3.grid);
    t3.grid.geometry.dispose();
    (t3.grid.material as THREE.Material).dispose();
    const grid = new THREE.GridHelper(40, 40, dark ? 0x5d7cb5 : 0x5a6f93, dark ? 0x33456e : 0x9fafc9);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = dark ? 0.85 : 0.95;
    grid.raycast = () => {};
    t3.scene.add(grid);
    t3.grid = grid;
    t3.hemi.color.set(dark ? 0x96a8c8 : 0xffffff);
    t3.hemi.groundColor.set(dark ? 0x1a2030 : 0x8d99ad);
    t3.hemi.intensity = dark ? 1.05 : 1.15;
  }, [theme, ready]);

  // 键盘直接变换:方向键移动(X/Z)、PageUp/Down 升降、Q/E 绕 Y 旋转;Shift 微调
  const nudge = (dx: number, dy: number, dz: number, ry: number) => {
    const id = selRef.current;
    if (!id) return;
    const d = docRef.current;
    const cam = d.cams.find((c) => c.id === id);
    if (cam) {
      if (ry !== 0) {
        const pos = new THREE.Vector3(...cam.pos);
        const v = new THREE.Vector3(...cam.target).sub(pos).applyAxisAngle(new THREE.Vector3(0, 1, 0), deg(ry)).add(pos);
        patchCam(id, { target: [r2(v.x), r2(v.y), r2(v.z)], look: "manual" });
      } else {
        patchCam(id, {
          pos: [r2(cam.pos[0] + dx), r2(cam.pos[1] + dy), r2(cam.pos[2] + dz)],
          target: cam.look === "manual" ? [r2(cam.target[0] + dx), r2(cam.target[1] + dy), r2(cam.target[2] + dz)] : cam.target,
        });
      }
      return;
    }
    const ch = d.chars.find((c) => c.id === id);
    const md = ch ? null : d.models.find((m) => m.id === id);
    const ent = ch ?? md;
    if (!ent) return;
    const patch = {
      pos: [r2(ent.pos[0] + dx), r2(ent.pos[1] + dy), r2(ent.pos[2] + dz)] as Vec3,
      rot: [ent.rot[0], r2(ent.rot[1] + ry), ent.rot[2]] as Vec3,
    };
    if (ch) patchChar(id, patch);
    else patchModel(id, patch);
  };

  // 快捷键
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ae = document.activeElement;
      if (ae && /TEXTAREA|INPUT|SELECT/.test(ae.tagName)) return;
      if (selRef.current) {
        const step = e.shiftKey ? 0.05 : 0.25;
        const ang = e.shiftKey ? 5 : 15;
        let used = true;
        switch (e.key) {
          case "ArrowLeft": nudge(-step, 0, 0, 0); break;
          case "ArrowRight": nudge(step, 0, 0, 0); break;
          case "ArrowUp": nudge(0, 0, -step, 0); break;
          case "ArrowDown": nudge(0, 0, step, 0); break;
          case "PageUp": nudge(0, step, 0, 0); break;
          case "PageDown": nudge(0, -step, 0, 0); break;
          case "q": case "Q": nudge(0, 0, 0, ang); break;
          case "e": case "E": nudge(0, 0, 0, -ang); break;
          default: used = false;
        }
        if (used) { e.preventDefault(); return; }
      }
      if (e.key === "v" || e.key === "V") setTool("translate");
      if (e.key === "r" || e.key === "R") setTool("rotate");
      if (e.key === "s" || e.key === "S") setTool("scale");
      if (e.key === "Escape") {
        if (pop) setPop(null);
        else if (lightbox) setLightbox(null);
        else if (upModal) setUpModal(false);
        else setSel(null);
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selRef.current) removeEntity(selRef.current);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pop, lightbox, upModal, doc]);

  useEffect(() => {
    const onFs = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  // ── 截图 ──
  const takeShot = () => {
    const t3 = three.current;
    if (!t3) return;
    const d = docRef.current;
    let cam: THREE.PerspectiveCamera = t3.orbitCam;
    let camId = "dir";
    let camName = "导演台";
    const viaCam = mode === "cam" ? (activeCam ?? d.cams[0]?.id ?? null) : (selE?.kind === "cam" ? selE.id : null);
    if (viaCam) {
      const g = t3.objs.get(viaCam);
      const pc = g?.userData.pcam as THREE.PerspectiveCamera | undefined;
      if (g && pc) {
        cam = pc;
        camId = viaCam;
        camName = d.cams.find((c) => c.id === viaCam)?.name ?? "机位";
        g.visible = false;
        const lb = t3.labels.get(viaCam);
        if (lb) lb.visible = false;
        t3.renderer.render(t3.scene, cam);
        g.visible = true;
        if (lb) lb.visible = true;
      }
    } else {
      t3.renderer.render(t3.scene, cam);
    }
    const src = t3.renderer.domElement;
    const rv = ratioVal(doc.ratio);
    let sx = 0, sy = 0, sw = src.width, sh = src.height;
    if (rv) {
      if (sw / sh > rv) { sw = sh * rv; sx = (src.width - sw) / 2; }
      else { sh = sw / rv; sy = (src.height - sh) / 2; }
    }
    const dw = 640, dh = Math.max(1, Math.round((640 * sh) / sw));
    const cv = document.createElement("canvas");
    cv.width = dw; cv.height = dh;
    cv.getContext("2d")!.drawImage(src, sx, sy, sw, sh, 0, 0, dw, dh);
    const url = cv.toDataURL("image/jpeg", 0.78);
    const count = doc.shots.filter((s) => s.camId === camId).length;
    const shot: DcShot = { id: uid(), name: `${camName}-截图${String(count + 1).padStart(2, "0")}`, url, camId };
    setDoc((dd) => ({ ...dd, shots: [...dd.shots, shot] }));
    setFlash(true);
    window.setTimeout(() => setFlash(false), 240);
    say(`已保存 ${shot.name}`);
  };

  // ── 场景图 / 站位参考:以立体布景(竖立幕墙)导入,底边落地,可移动旋转缩放 ──
  const addBackdrop = (url: string, name: string, cover: boolean) => {
    const img = new Image();
    img.onload = () => {
      const ar = img.height / Math.max(1, img.width);
      const W = 8;
      const bd: DcModel = {
        kind: "model", id: uid(), shape: "backdrop", name: name || "场景图",
        color: "#ffffff", url,
        pos: [0, 0, -2.5], rot: [0, 0, 0], scale: [W, W * ar, 1],
      };
      setDoc((d) => ({
        ...d,
        chars: cover ? [] : d.chars,
        cams: cover ? [] : d.cams,
        models: [...(cover ? [] : d.models.filter((m) => m.shape !== "plane" && m.shape !== "backdrop")), bd],
        refs: d.refs.some((r) => r.url === url) ? d.refs : [...d.refs, { id: uid(), name, url }],
      }));
      setSel(bd.id);
      onExportImage?.(url, name);
      say("场景图已立体导入 — 选中后可移动 / 旋转,右栏「统一缩放」调大小");
    };
    img.src = url;
  };
  const applyRef = () => {
    if (!upImg) return;
    addBackdrop(upImg.url, upImg.name, upCover);
    setUpModal(false);
    setUpImg(null);
  };

  const toggleFs = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else rootRef.current?.requestFullscreen?.();
  };

  const resetView = () => {
    const t3 = three.current;
    if (!t3) return;
    t3.orbitCam.position.set(6.5, 5.2, 9);
    t3.orbit.target.set(0, 1, 0);
  };

  const enterCamMode = () => {
    setMode("cam");
    const first = (selE?.kind === "cam" ? selE.id : null) ?? activeCam ?? doc.cams[0]?.id ?? null;
    setActiveCam(first);
  };

  const listItems = entities.filter((e) => !search.trim() || e.name.toLowerCase().includes(search.trim().toLowerCase()));

  const rv = ratioVal(doc.ratio);
  const maskBox = (() => {
    if (!rv) return null;
    let w = vp.w, h = vp.h;
    if (w / h > rv) w = h * rv; else h = w / rv;
    return { width: Math.round(w), height: Math.round(h) };
  })();

  // 截图缩略图(悬浮:导出到画布 / 删除)
  const exportShot = (s: DcShot) => {
    onExportShot?.(s.url, s.name);
    say(`已导出「${s.name}」到画布并连线`);
  };
  const renderShots = (list: DcShot[], big = false) => (
    <div className={cn("dc-shots", big && "big")}>
      {list.map((s) => (
        <button key={s.id} className="dc-shot" onClick={() => setLightbox(s)}>
          <img src={s.url} alt={s.name} draggable={false} />
          <span className="nm">{s.name}</span>
          <span className="ex" title="导出到画布" onClick={(e) => { e.stopPropagation(); exportShot(s); }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15V4m0 0 4 4m-4-4-4 4" /><path d="M5 16v3h14v-3" /></svg>
          </span>
          <span className="x" title="删除" onClick={(e) => { e.stopPropagation(); setDoc((d) => ({ ...d, shots: d.shots.filter((x) => x.id !== s.id) })); }}><CloseIcon /></span>
        </button>
      ))}
    </div>
  );

  // ── 右栏内容 ──
  const renderRight = () => {
    if (!selE) return null;
    if (selE.kind === "cam") {
      const c = selE;
      const camShots = doc.shots.filter((s) => s.camId === c.id);
      return (
        <aside className="dc-right" onPointerDown={(e) => e.stopPropagation()}>
          <div className="dc-right-title">摄像机</div>
          <div className="dc-rtabs">
            <button className={cn(camTab === "prop" && "on")} onClick={() => setCamTab("prop")}>属性</button>
            <button className={cn(camTab === "shots" && "on")} onClick={() => setCamTab("shots")}>摄像机截图</button>
          </div>
          {camTab === "prop" ? (
            <div className="dc-rbody">
              <div className="dc-preview">
                <canvas ref={previewRef} width={440} height={248} />
                <span className="fov">FOV {Math.round(c.fov)}°</span>
              </div>
              <div className="dc-field">
                <span className="lb">名称</span>
                <input className="dc-in" value={c.name} onChange={(e) => patchCam(c.id, { name: e.target.value })} />
              </div>
              <div className="dc-field">
                <span className="lb">切换机位</span>
                <select className="dc-in" value={c.id} onChange={(e) => { setSel(e.target.value); if (mode === "cam") setActiveCam(e.target.value); }}>
                  {doc.cams.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
              </div>
              <div className="dc-field">
                <span className="lb">位置</span>
                <Xyz v={c.pos} on={(nv) => patchCam(c.id, { pos: nv })} />
              </div>
              <div className="dc-field">
                <span className="lb">注视目标</span>
                <select className="dc-in" value={c.look} onChange={(e) => patchCam(c.id, { look: e.target.value })}>
                  <option value="manual">手动坐标</option>
                  {doc.chars.map((ch) => <option key={ch.id} value={ch.id}>{ch.name}</option>)}
                </select>
              </div>
              <div className="dc-field">
                <span className="lb">注视坐标</span>
                <Xyz v={c.target} dis={c.look !== "manual"} on={(nv) => patchCam(c.id, { target: nv })} />
              </div>
              <div className="dc-field">
                <span className="lb">视野角度 (FOV)</span>
                <div className="dc-fov">
                  <input type="range" className="dc-sld" min={20} max={120} step={1} value={c.fov} onChange={(e) => patchCam(c.id, { fov: Number(e.target.value) })} />
                  <span className="dc-fov-val">{c.fov.toFixed(1)}</span>
                </div>
              </div>
              {camShots.length > 0 && (
                <>
                  <div className="dc-rsec">相机截图</div>
                  {renderShots(camShots)}
                </>
              )}
            </div>
          ) : (
            <div className="dc-rbody">
              {camShots.length === 0 && <div className="dc-empty">暂无截图,点击下方工具栏相机按钮截取当前画面。</div>}
              {renderShots(camShots, true)}
            </div>
          )}
        </aside>
      );
    }
    if (selE.kind === "char") {
      const c = selE;
      return (
        <aside className="dc-right" onPointerDown={(e) => e.stopPropagation()}>
          <div className="dc-right-title">角色</div>
          <div className="dc-rtabs">
            <button className={cn(charTab === "prop" && "on")} onClick={() => setCharTab("prop")}>属性</button>
            <button className={cn(charTab === "pose" && "on")} onClick={() => setCharTab("pose")}>姿势</button>
          </div>
          {charTab === "prop" ? (
            <div className="dc-rbody">
              <div className="dc-field">
                <span className="lb">名称</span>
                <input className="dc-in" value={c.name} onChange={(e) => patchChar(c.id, { name: e.target.value })} />
              </div>
              <div className="dc-field">
                <span className="lb">素体</span>
                <select className="dc-in" value={c.body} onChange={(e) => patchChar(c.id, { body: e.target.value as BodyType })}>
                  {BODY_ORDER.map((b) => <option key={b} value={b}>{BODY[b].label}</option>)}
                </select>
              </div>
              <div className="dc-field">
                <span className="lb">位置</span>
                <Xyz v={c.pos} on={(nv) => patchChar(c.id, { pos: nv })} />
              </div>
              <div className="dc-field">
                <span className="lb">旋转</span>
                <Xyz v={c.rot} step={1} on={(nv) => patchChar(c.id, { rot: nv })} />
              </div>
              <div className="dc-field">
                <span className="lb">统一缩放</span>
                <div className="dc-fov">
                  <input type="range" className="dc-sld" min={0.2} max={3} step={0.01} value={c.scale[0]} onChange={(e) => { const v = Number(e.target.value); patchChar(c.id, { scale: [v, v, v] }); }} />
                  <span className="dc-fov-val">{c.scale[0].toFixed(2)}</span>
                </div>
              </div>
              <div className="dc-field">
                <span className="lb">颜色</span>
                <div className="dc-color">
                  <input type="color" value={c.color} onChange={(e) => patchChar(c.id, { color: e.target.value })} />
                  <input className="dc-in" value={c.color.toUpperCase()} onChange={(e) => { const v = e.target.value.trim(); if (/^#[0-9a-fA-F]{6}$/.test(v)) patchChar(c.id, { color: v }); }} />
                </div>
              </div>
              {doc.shots.length > 0 && (
                <>
                  <div className="dc-rsec">截图</div>
                  {renderShots(doc.shots)}
                </>
              )}
            </div>
          ) : (
            <div className="dc-rbody">
              <div className="dc-rsec">姿势预设</div>
              <div className="dc-poses">
                {POSE_PRESETS.map((p) => (
                  <button
                    key={p.name}
                    className={cn("dc-pose", c.preset === p.name && "on")}
                    onClick={() => patchChar(c.id, { pose: { ...p.pose }, preset: p.name })}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
              <div className="dc-rsec row">
                姿势调节
                <button className="dc-mini" onClick={() => patchChar(c.id, { pose: { ...STAND }, preset: "站立" })}>重置</button>
              </div>
              {POSE_UI.map((sec) => (
                <div key={sec.sec}>
                  <div className="dc-psec">{sec.sec}</div>
                  {sec.rows.map((rw) => (
                    <Slider key={rw.k} lb={rw.lb} v={c.pose[rw.k] ?? 0} min={rw.min} max={rw.max}
                      on={(n) => patchChar(c.id, { pose: { ...c.pose, [rw.k]: n }, preset: undefined })} />
                  ))}
                </div>
              ))}
              {POSE_SIDED.map((sec) => (
                <div key={sec.sec}>
                  <div className="dc-psec">{sec.sec}</div>
                  {(["L", "R"] as const).map((s) => (
                    <div key={s}>
                      <span className={cn("dc-side-tag", s === "R" && "r")}>{s === "L" ? "左" : "右"}</span>
                      {sec.mk(s).map((rw) => (
                        <Slider key={rw.k} lb={rw.lb} v={c.pose[rw.k] ?? 0} min={rw.min} max={rw.max}
                          on={(n) => patchChar(c.id, { pose: { ...c.pose, [rw.k]: n }, preset: undefined })} />
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </aside>
      );
    }
    const m = selE;
    return (
      <aside className="dc-right" onPointerDown={(e) => e.stopPropagation()}>
        <div className="dc-right-title">模型</div>
        <div className="dc-rtabs"><button className="on">属性</button></div>
        <div className="dc-rbody">
          <div className="dc-field">
            <span className="lb">名称</span>
            <input className="dc-in" value={m.name} onChange={(e) => patchModel(m.id, { name: e.target.value })} />
          </div>
          <div className="dc-field"><span className="lb">位置</span><Xyz v={m.pos} on={(nv) => patchModel(m.id, { pos: nv })} /></div>
          <div className="dc-field"><span className="lb">旋转</span><Xyz v={m.rot} step={1} on={(nv) => patchModel(m.id, { rot: nv })} /></div>
          <div className="dc-field">
            <span className="lb">统一缩放</span>
            <div className="dc-fov">
              <input type="range" className="dc-sld" min={0.1} max={m.shape === "backdrop" ? 24 : 6} step={0.01} value={m.scale[0]} onChange={(e) => { const v = Number(e.target.value); patchModel(m.id, { scale: m.shape === "plane" || m.shape === "backdrop" ? [v, v * (m.scale[1] / Math.max(0.001, m.scale[0])), 1] : [v, v, v] }); }} />
              <span className="dc-fov-val">{m.scale[0].toFixed(2)}</span>
            </div>
          </div>
          {m.shape !== "plane" && m.shape !== "backdrop" && m.shape !== "glb" && (
            <div className="dc-field">
              <span className="lb">颜色</span>
              <div className="dc-color">
                <input type="color" value={m.color} onChange={(e) => patchModel(m.id, { color: e.target.value })} />
                <input className="dc-in" value={m.color.toUpperCase()} onChange={(e) => { const v = e.target.value.trim(); if (/^#[0-9a-fA-F]{6}$/.test(v)) patchModel(m.id, { color: v }); }} />
              </div>
            </div>
          )}
          {doc.shots.length > 0 && (
            <>
              <div className="dc-rsec">截图</div>
              {renderShots(doc.shots)}
            </>
          )}
        </div>
      </aside>
    );
  };

  const TOOL_ITEMS: { id: Tool; lb: string; key: string }[] = [
    { id: "translate", lb: "移动", key: "V" },
    { id: "rotate", lb: "旋转", key: "R" },
    { id: "scale", lb: "缩放", key: "S" },
  ];

  return createPortal(
    <div className="dc-root" ref={rootRef}>
      {/* 顶栏 */}
      <div className="dc-top">
        <div className="dc-top-title">3D 导演台</div>
        <div className="dc-seg">
          <button className={cn(mode === "dir" && "on")} onClick={() => setMode("dir")}>导演视角</button>
          <button className={cn(mode === "cam" && "on")} onClick={enterCamMode}>机位视角</button>
        </div>
        <div className="dc-top-acts">
          <button className="dc-iconbtn" title={theme === "dark" ? "切换亮色模式" : "切换暗色模式"} onClick={toggleTheme}>
            {theme === "dark" ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4.2" /><path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5 5l1.7 1.7M17.3 17.3 19 19M19 5l-1.7 1.7M6.7 17.3 5 19" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.6 14.4A8.5 8.5 0 1 1 9.6 3.4a7 7 0 1 0 11 11z" /></svg>
            )}
          </button>
          <div className="dc-dd">
            <button className="dc-iconbtn" title="操作说明" onClick={() => setPop(pop === "help" ? null : "help")}>?</button>
            {pop === "help" && (
              <div className="dc-pop dc-help" onPointerDown={(e) => e.stopPropagation()}>
                <div className="t">操作说明</div>
                <p>左键拖拽 — 旋转视角；右键拖拽 — 平移；滚轮 — 缩放</p>
                <p>点击模型选中；V 移动 / R 旋转 / S 缩放拉伸</p>
                <p>方向键 — 前后左右移动；PgUp / PgDn — 升降；Q / E — 旋转（按住 Shift 微调）</p>
                <p>机位视角下点击左侧机位即可切换到该机位画面</p>
                <p>Delete 删除选中对象；Esc 取消选择</p>
              </div>
            )}
          </div>
          <button className="dc-iconbtn" title="关闭" onClick={onClose}><CloseIcon /></button>
        </div>
      </div>

      <div className="dc-main">
        {/* 左栏:场景列表 */}
        <aside className="dc-left">
          <div className="dc-left-title">场景</div>
          <div className="dc-search">
            <input placeholder="请输入搜索内容" value={search} onChange={(e) => setSearch(e.target.value)} />
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          </div>
          <div className="dc-list">
            {listItems.map((e) => (
              <button
                key={e.id}
                className={cn("dc-item", sel === e.id && "on", mode === "cam" && activeCam === e.id && "live")}
                onClick={() => { setSel(e.id); if (mode === "cam" && e.kind === "cam") setActiveCam(e.id); }}
              >
                {e.kind === "cam" ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="13" height="12" rx="2.5" /><path d="m15 10 6-3v10l-6-3z" /></svg>
                ) : e.kind === "char" ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="6" r="3.2" /><path d="M5.5 21c.8-4.2 3.3-6.4 6.5-6.4s5.7 2.2 6.5 6.4" /></svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m12 2 8 4.5v9L12 20l-8-4.5v-9z" /><path d="M12 11 4 6.5M12 11l8-4.5M12 11v9" /></svg>
                )}
                <span className="nm">{e.name}</span>
              </button>
            ))}
            {listItems.length === 0 && <div className="dc-empty">无匹配对象</div>}
          </div>
        </aside>

        {/* 视口 */}
        <div className="dc-view">
          <div className="dc-mount" ref={mountRef} />

          {maskBox && (
            <div className="dc-maskwrap">
              <div className="dc-maskbox" style={{ width: maskBox.width, height: maskBox.height }} />
            </div>
          )}

          {/* 导航球 + 重置视角 */}
          <div className="dc-nav">
            <canvas ref={navRef} width={76} height={76} />
            <button onClick={resetView}>重置视角</button>
          </div>

          {mode === "cam" && doc.cams.length === 0 && (
            <div className="dc-cam-hint">暂无机位 — 点击下方「添加机位」创建一个吧</div>
          )}
          {mode === "cam" && doc.cams.length > 0 && (
            <div className="dc-cam-live">
              <span className="dot" />
              {doc.cams.find((c) => c.id === (activeCam ?? doc.cams[0]?.id))?.name}
            </div>
          )}

          {/* 底部工具栏 */}
          <div className="dc-tools" onPointerDown={(e) => e.stopPropagation()}>
            <div className="dc-dd up">
              <button className={cn("dc-tool", pop === "tool" && "open")} title="变换工具"
                onClick={() => setPop(pop === "tool" ? null : "tool")}>
                {tool === "translate" ? (
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3l13.5 6.2-5.7 1.9-1.9 5.7z" /></svg>
                ) : tool === "rotate" ? (
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-2.6-6.4" /><path d="M21 3v5h-5" /></svg>
                ) : (
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg>
                )}
              </button>
              {pop === "tool" && (
                <div className="dc-pop dc-tmenu">
                  {TOOL_ITEMS.map((ti) => (
                    <button key={ti.id} className={cn(tool === ti.id && "on")} onClick={() => { setTool(ti.id); setPop(null); }}>
                      {ti.id === "translate" ? (
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3l13.5 6.2-5.7 1.9-1.9 5.7z" /></svg>
                      ) : ti.id === "rotate" ? (
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-2.6-6.4" /><path d="M21 3v5h-5" /></svg>
                      ) : (
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg>
                      )}
                      <span className="nm">{ti.lb}</span>
                      <span className="kbd">{ti.key}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="dc-dd up">
              <button className={cn("dc-tool", pop === "add" && "open")} title="添加人物 / 模型"
                onClick={() => { setPop(pop === "add" ? null : "add"); setAddSub(null); }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="5.5" r="2.8" /><path d="M6.5 21c.6-3.8 2.8-5.8 5.5-5.8s4.9 2 5.5 5.8" /><path d="M12 9v4M10 11h4" /></svg>
              </button>
              {pop === "add" && (
                <div className="dc-pop dc-addmenu">
                  <button className="it" onClick={() => { glbFileRef.current?.click(); setPop(null); }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15V4m0 0 4 4m-4-4-4 4" /><path d="M5 16v3h14v-3" /></svg>
                    本地上传
                  </button>
                  <div className="sep" />
                  {BODY_ORDER.map((b) => (
                    <button key={b} className="it" onClick={() => addChar(b)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="6" r="3" /><path d="M6 21c.7-4 3-6 6-6s5.3 2 6 6" /></svg>
                      {BODY[b].label}
                    </button>
                  ))}
                  <button className={cn("it sub", addSub === "crowd" && "on")} onClick={() => setAddSub(addSub === "crowd" ? null : "crowd")}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="7" r="2.6" /><circle cx="16.5" cy="8.5" r="2.1" /><path d="M3.5 20c.6-3.4 2.6-5.2 5.5-5.2s4.9 1.8 5.5 5.2M14.5 14.6c2.3.3 3.9 1.9 4.5 4.6" /></svg>
                    群众 ({crowd.rows}x{crowd.cols})
                    <span className="ar">›</span>
                  </button>
                  {addSub === "crowd" && (
                    <div className="dc-pop dc-sub dc-crowd" onPointerDown={(e) => e.stopPropagation()}>
                      <div className="dc-crowd-head">
                        添加群众阵列
                        <span className="cnt">共{Math.min(10, Math.max(1, Math.round(crowd.rows))) * Math.min(10, Math.max(1, Math.round(crowd.cols)))}人</span>
                      </div>
                      <div className="dc-crowd-row">
                        <span>行数</span>
                        <input type="number" min={1} max={10} value={crowd.rows} onChange={(e) => setCrowd({ ...crowd, rows: Number(e.target.value) || 1 })} />
                        <span className="x">×</span>
                        <span>列数</span>
                        <input type="number" min={1} max={10} value={crowd.cols} onChange={(e) => setCrowd({ ...crowd, cols: Number(e.target.value) || 1 })} />
                      </div>
                      <div className="dc-crowd-row">
                        <span>间距</span>
                        <input type="number" min={0.5} max={5} step={0.1} value={crowd.gap} onChange={(e) => setCrowd({ ...crowd, gap: Number(e.target.value) || 1.2 })} />
                      </div>
                      <div className="dc-crowd-acts">
                        <button className="cancel" onClick={() => setAddSub(null)}>取消</button>
                        <button className="ok" onClick={addCrowd}>添加</button>
                      </div>
                    </div>
                  )}
                  <div className="sep" />
                  <button className={cn("it sub", addSub === "geo" && "on")} onClick={() => setAddSub(addSub === "geo" ? null : "geo")}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m12 2 8 4.5v9L12 20l-8-4.5v-9z" /><path d="M12 11 4 6.5M12 11l8-4.5M12 11v9" /></svg>
                    几何模型
                    <span className="ar">›</span>
                  </button>
                  {addSub === "geo" && (
                    <div className="dc-pop dc-sub">
                      <button className="it" onClick={() => { glbFileRef.current?.click(); setPop(null); setAddSub(null); }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15V4m0 0 4 4m-4-4-4 4" /><path d="M5 16v3h14v-3" /></svg>
                        上传文件
                      </button>
                      <div className="sep" />
                      {GEOM_SHAPES.map((s) => (
                        <button key={s.shape} className="it" onClick={() => addModel(s.shape)}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m12 2 8 4.5v9L12 20l-8-4.5v-9z" /></svg>
                          {s.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="dc-dd up">
              <button className={cn("dc-tool", pop === "gen" && "open")} title="生成站位参考"
                onClick={() => setPop(pop === "gen" ? null : "gen")}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <text x="11" y="12.5" textAnchor="middle" fontSize="9" fontWeight="700" fill="currentColor" stroke="none">720</text>
                  <path d="M4.5 16.5c2.2 2.6 13 2.6 15-.4" />
                  <path d="m19.9 18.7-.3-2.7-2.7.4" />
                </svg>
              </button>
              {pop === "gen" && (
                <div className="dc-pop dc-genmenu">
                  <button className="it" onClick={() => { directUpRef.current = true; setPop(null); upFileRef.current?.click(); }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15V4m0 0 4 4m-4-4-4 4" /><path d="M5 16v3h14v-3" /></svg>
                    本地上传
                  </button>
                  <button className="it" onClick={() => { setUpTab("history"); setUpModal(true); setPop(null); }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                    历史记录
                  </button>
                  <button className="it" onClick={() => { setUpTab("local"); setUpModal(true); setPop(null); }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                      <text x="11" y="12" textAnchor="middle" fontSize="8" fontWeight="700" fill="currentColor" stroke="none">720</text>
                      <path d="M4.5 16c2.2 2.6 13 2.6 15-.4" />
                      <path d="m19.9 18.2-.3-2.7-2.7.4" />
                    </svg>
                    AI生成
                  </button>
                </div>
              )}
            </div>

            <div className="dc-dd up">
              <button className={cn("dc-tool", pop === "cam" && "open")} title="添加机位"
                onClick={() => setPop(pop === "cam" ? null : "cam")}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="13" height="12" rx="2.5" /><path d="m15 10 6-3v10l-6-3z" /></svg>
              </button>
              {pop === "cam" && (
                <div className="dc-pop dc-campick">
                  <div className="t">选择机位视角</div>
                  <div className="grid">
                    {CAM_PRESETS.map((p) => (
                      <button key={p.id} onClick={() => addCam(p.id)}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="13" height="12" rx="2.5" /><path d="m15 10 6-3v10l-6-3z" /></svg>
                        <span>{p.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="dc-dd up">
              <button className={cn("dc-tool", pop === "ratio" && "open")} title="画幅比例"
                onClick={() => setPop(pop === "ratio" ? null : "ratio")}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M8 5v3H3" /></svg>
              </button>
              {pop === "ratio" && (
                <div className="dc-pop dc-ratio">
                  <div className="t">比例</div>
                  <div className="grid">
                    {RATIOS.map((rr) => {
                      const v = ratioVal(rr);
                      const bw = v ? (v >= 1 ? 24 : 24 * v) : 19;
                      const bh = v ? (v >= 1 ? 24 / v : 24) : 19;
                      return (
                        <button key={rr} className={cn(doc.ratio === rr && "on")} onClick={() => { setDoc((d) => ({ ...d, ratio: rr })); setPop(null); }}>
                          <span className="bx" style={{ width: Math.max(7, bw), height: Math.max(7, bh), borderStyle: v ? "solid" : "dashed" }} />
                          <span>{rr}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <button className="dc-tool" title="截图" onClick={takeShot}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h3l2-2.5h6L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" /><circle cx="12" cy="13.5" r="3.4" /></svg>
            </button>

            <button className="dc-tool" title="生成站位参考" onClick={() => { setUpTab("local"); setUpModal(true); }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="14" rx="2.5" /><circle cx="8.5" cy="8" r="1.6" /><path d="m21 13-4-4-7 8" /><path d="M12 21v-4m0 0 2.5 2.5M12 17l-2.5 2.5" /></svg>
            </button>

            <button className="dc-tool" title={isFs ? "退出全屏" : "全屏"} onClick={toggleFs}>
              {isFs ? (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /></svg>
              ) : (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>
              )}
            </button>
          </div>

          {flash && <div className="dc-flash" />}
          {toast && <div className="dc-toast">{toast}</div>}
        </div>

        {renderRight()}
      </div>

      {/* 生成站位参考弹窗 */}
      {upModal && (
        <div className="dc-modal-mask" onPointerDown={() => setUpModal(false)}>
          <div className="dc-modal" onPointerDown={(e) => e.stopPropagation()}>
            <div className="dc-modal-head">
              生成站位参考
              <button className="dc-iconbtn" onClick={() => setUpModal(false)}><CloseIcon /></button>
            </div>
            <div className="dc-modal-tabs">
              <button className={cn(upTab === "local" && "on")} onClick={() => setUpTab("local")}>本地上传</button>
              <button className={cn(upTab === "history" && "on")} onClick={() => setUpTab("history")}>历史记录</button>
            </div>
            {upTab === "local" ? (
              <div
                className="dc-drop"
                onClick={() => upFileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files?.[0];
                  if (f && f.type.startsWith("image")) {
                    const fr = new FileReader();
                    fr.onload = () => setUpImg({ url: String(fr.result), name: f.name.replace(/\.[^.]+$/, "") });
                    fr.readAsDataURL(f);
                  }
                }}
              >
                {upImg ? (
                  <img className="pv" src={upImg.url} alt={upImg.name} draggable={false} />
                ) : (
                  <>
                    <span className="t1"><u>点击上传</u> 或 拖拽本地图片至此上传</span>
                    <span className="t2">上传后画布将新建一个图片节点并自动替换当前图源</span>
                  </>
                )}
              </div>
            ) : (
              <div className="dc-refs">
                {doc.refs.length === 0 && <div className="dc-empty">暂无历史记录</div>}
                {doc.refs.map((rf) => (
                  <button key={rf.id} className={cn("dc-refit", upImg?.url === rf.url && "on")} onClick={() => setUpImg({ url: rf.url, name: rf.name })}>
                    <img src={rf.url} alt={rf.name} draggable={false} />
                    <span className="nm">{rf.name}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="dc-modal-sub">选择是否覆盖场景</div>
            <div className="dc-radios">
              <button className={cn("dc-radio", !upCover && "on")} onClick={() => setUpCover(false)}>
                <span className="ck" />
                <span className="tx"><b>插入当前导演台</b><small>作为站位参考层插入,不覆盖当前全景、角色和机位</small></span>
              </button>
              <button className={cn("dc-radio", upCover && "on")} onClick={() => setUpCover(true)}>
                <span className="ck" />
                <span className="tx"><b>覆盖当前导演台</b><small>作为站位参考层插入,覆盖当前全景、角色和机位</small></span>
              </button>
            </div>
            <div className="dc-modal-foot">
              <span className="dim">关闭不会中断识图任务,生成站位参考后自动导入导演台</span>
              <button className="dc-primary" disabled={!upImg} onClick={applyRef}>生成站位参考</button>
            </div>
          </div>
        </div>
      )}

      {/* 截图大图 */}
      {lightbox && (
        <div className="dc-modal-mask" onPointerDown={() => setLightbox(null)}>
          <div className="dc-lightbox" onPointerDown={(e) => e.stopPropagation()}>
            <img src={lightbox.url} alt={lightbox.name} />
            <div className="bar">
              <span>{lightbox.name}</span>
              <button className="dc-mini" onClick={() => { exportShot(lightbox); setLightbox(null); }}>导出到画布</button>
              <a className="dc-mini" href={lightbox.url} download={`${lightbox.name}.jpg`}>下载</a>
              <button className="dc-mini" onClick={() => setLightbox(null)}>关闭</button>
            </div>
          </div>
        </div>
      )}

      <input
        ref={upFileRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          const direct = directUpRef.current;
          directUpRef.current = false;
          if (f) {
            const fr = new FileReader();
            fr.onload = () => {
              const url = String(fr.result);
              const name = f.name.replace(/\.[^.]+$/, "");
              if (direct) addBackdrop(url, name, false);
              else setUpImg({ url, name });
            };
            fr.readAsDataURL(f);
          }
          e.target.value = "";
        }}
      />
      <input
        ref={glbFileRef}
        type="file"
        accept=".glb,.gltf,model/gltf-binary"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            if (f.size > 12 * 1024 * 1024) { say("模型文件过大(限 12MB)"); }
            else {
              const fr = new FileReader();
              fr.onload = () => {
                const m: DcModel = {
                  kind: "model", id: uid(), shape: "glb",
                  name: f.name.replace(/\.[^.]+$/, ""),
                  color: "#8d97a8", url: String(fr.result),
                  pos: dropPoint(), rot: [0, 0, 0], scale: [1, 1, 1],
                };
                setDoc((d) => ({ ...d, models: [...d.models, m] }));
                setSel(m.id);
              };
              fr.readAsDataURL(f);
            }
          }
          e.target.value = "";
        }}
      />
    </div>,
    document.body,
  );
}
