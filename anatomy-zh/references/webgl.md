# 绘制内部的 WebGL

如何把着色器效果（火焰、水、光、辉光）放进一个等轴测图（图示）中，让它看起来像是同一个物体的一部分，透过同一台相机看到。两个已发布的示例做到了这一点：`examples-raptor-engine/`（火箭发动机下方的羽流、激波、飞溅和蒸汽）和 `examples-ripple-tank/`（焦散、阴影和起伏的水面）。请结合本页阅读它们的 `live.js`。

用户喜欢第一个着色器图（图示），但注意到它的各个相位之间颜色瞬间变化，仿佛效果被切断了。因此标准是：**不跳变，不切断，一切都位于绘图的透视之中。** 下面的每一条规则都来自一个打破该标准的 bug。

## Contents
1. 着色器何时名副其实
2. 层栈
3. 相机契约
4. 等轴测相机中的射线步进（ray-marching）
5. 将着色器内容注册到 SVG
6. API 与最小页面
7. 工艺规则，每条都附有教会它的 bug
8. 浅色主题（8b. 旋转组上的着色器）
9. 验证
10. 性能

## 1. 着色器何时名副其实

用着色器画线条画不出来的东西：自发光与辉光、火焰与排气、水面、焦散、真实灯光的柔和阴影、烟与蒸汽。这些都是连续场，它们要么是主体，要么是主体所做的动作。

不要用于：
- **实体。** 零件、边缘、刻度和螺丝保持工具库（kit）中的 SVG。着色器绝不画 SVG 能画的零件。
- **装饰。** 微光、背景渐变、每条边缘上的泛光，或为了让图（图示）看起来"丰富"而添加的噪声。如果删掉效果后解释依然成立，就删掉它。
- **SVG 已经表现得很好的东西。** 发光的 LED 是一个 `lit` 点，不是着色器。

SVG 必须仍然能够独立表意。没有 WebGL 的 Raptor 仍然显示发动机，带有一圈轮廓光和 CSS 甲板辉光。ripple tank 将其波峰和节线画成 SVG 线条（`model.mjs` 中的 `patternOf`），裁剪到水箱在纸面上阴影的绘制轮廓，并在 WebGL 运行时用 `.rt-stage[data-gl] .rt-fallback { display: none }` 隐藏它们。

## 2. 层栈

着色器无法与 SVG 做深度测试，因此改为排列层。基本栈是三层，位于同一个 `position: relative` 舞台中，全部使用相同的 viewBox：

```
back SVG     what the effect covers        (k.figureSvg: role="img" and the label)
canvas       the effect                     (position:absolute; inset:0; pointer-events:none)
front SVG    what covers the effect        (aria-hidden)
```

对每个零件，问一个问题：**它会被效果覆盖，还是它覆盖效果？** 被覆盖的零件放进 back SVG，覆盖的零件放进 front SVG。如果一个零件两者兼有，你有三个选择：

- **拆分美术。** 把零件切成块，把每一块送到它所属的层，以及该层中它所属的位置。ripple tank 的电机线缆是三组 `tubePieces`：跨过桥的那一段在 bar 之前放进 front SVG，沿近侧边缘的那一段在近侧端盖之后放进 front SVG，沿左腿下行到控制箱的那一段放进 middle SVG。
- **在着色器中建模。** 如果零件是简单形状（盒体、圆柱、圆环）且留在 back SVG 中，就把该形状作为遮挡体交给着色器。Raptor 的立柱是不透明盒体（`columnNear`），所以每个空气积分都从 `max(tGround, tColumn)` 开始。导流环是 `groundHit` 内的一个圆环，所以飞溅照亮它的内侧而外侧保持黑暗。
- **拆分效果。** 当效果经过 front SVG 零件前方时，在 front SVG 之上加第二个画布（canvas）。遮挡零件的解析代理决定每个采样是去背景画布（权重 `1 − f`）还是前景画布（权重 `f`）。每个采样只画一次，因此没有接缝。让代理宽松一些：在真实轮廓之外，两层看起来相同。

### 实例分析：Raptor
```
back SVG    deck, feet, flame cone, deluge ring, columns, ladder, cable tray
canvas      .rp-plume: plume volume, shock (back half), flash, splash, ground ring, steam behind the engine
front SVG   every engine item (depth-sorted .it groups), pipes, harness, crosshead
glow SVG    .rp-glow: the two nozzle-lip rims, screen-blended so they can only add light
canvas      .rp-veil: steam and shock samples that lie in front of the engine
div         .rp-flash: a CSS radial gradient (closest-side) for the ignition flash
```
发动机代理是 `engineR(z)`，一个关于钟形喷管、燃烧室和泵的半径函数。`inFront(p, V)` 判断采样点 `p` 是否位于发动机与观察者之间。`side(front, veil)` 把采样送到其中一个画布。

### 实例分析：ripple tank
```
back SVG    base plate, feet, ruler, label plate, paper sheet with tape, lamp cable over the base edge, SVG fallback pattern
canvas      .rt-paper-gl: lamp light on the paper and base, caustics, shadows of the legs, post, bridge, motor, control box and foam beach, refraction
middle SVG  post, arm, lamp and its cables, control box, motor cable down the left leg in clips, legs with levelling screws,
            far rails, three corner posts, far glass, foam beach, plain-water fill
canvas      .rt-water-gl: window reflection and room-light glints, meniscus tilt at the walls, dipper contact rings,
            the water band behind the near glass, glass tint, the lamp's beam (dark only)
front SVG   far caps, motor cable over the bridge, far pillar and spring, bar, dippers, motor, near spring, near rails,
            glass bottom, water lines, near glass, near caps, motor cable on the rim, near corner post, near pillar, beam
```
两个画布位于两个深度，因为有两个效果位于两个高度：纸面上的光（在支腿下方），以及水面（在水箱内部）。控制箱立在水箱旁的底座上，低于水画布，所以它在 middle SVG 中；近侧角柱在它所支撑的端盖之后绘制。

栈的 CSS（改编自 `ripple.css`）：
```css
.fx-stage { position: relative; touch-action: pan-y; }
.fx-stage > svg, .fx-stage > canvas { display: block; width: 100%; height: auto; }
.fx-stage > .fx-layer { position: absolute; inset: 0; height: 100% !important; pointer-events: none; }
.iso:not([data-theme="light"]) .fx-gl { mix-blend-mode: screen; }
```
screen（滤色）混合只能变亮。一个还必须压暗其所覆盖内容的画布（ripple tank 的水，它给透过它看到的纸面染色）在深色下也保持普通预乘混合：只有 `.rt-paper-gl` 使用 screen 混合。
如果 front SVG 必须接收悬停（Raptor 的零件需要），给它 `pointer-events: none`，给它的条目 `pointer-events: visiblePainted`，这样画布和空白区域永远不会捕获指针。

## 3. 相机契约

`kit/gl.mjs` 会把 `GLSL_ISO` 预置到你的片段（fragment）之前。它声明了使着色器看到与 `iso()` 相同相机的 uniform 和函数：

| 名称 | 说明 |
|---|---|
| `uCanvas` | 以设备像素表示的画布尺寸。 |
| `uView` | viewBox 尺寸 `[W, H]`。 |
| `uOrigin`、`uK` | 投影原点以及每世界单位对应的屏幕单位数（`glCamera(P).k`，等于 `scaleOf(P)`）。 |
| `uCam` | 方位角与仰角的 `(sinA, cosA, sinE, cosE)`。 |
| `uTime` | 你传给 `draw` 的时间。 |
| `viewOf(gl_FragCoord.xy)` | 设备像素转 viewBox 点（会翻转 y）。 |
| `project(vec3 p)` | 世界空间到 viewBox，与工具库的 `iso()` 完全一致。 |
| `towardViewer()` | 单位 3D 视线方向 `(cosA·cosE, sinA·cosE, sinE)`。每个 `p + t·towardViewer()` 都落在同一个像素上。与工具库的 JS `towardViewer(P)` 不同，后者返回 2D 地面方向。 |
| `rayOf(vb)` | `vb` 下方位于过原点、面向相机的竖直平面上的世界点，因此 `rayOf(vb) + t·towardViewer()` 就是该像素的射线。 |
| `pixelOf()` | 横跨屏幕每画布像素对应的世界单位数，`(uView.x / uCanvas.x) / uK`。 |
| `lightDir()` | 工具库的光照，等于 `lightOf(P)`，使着色器明暗与 SVG 色调一致。 |
| `onFloor(vb, z)` | 该像素下方高度为 `z` 的水平面上的世界点。 |
| `onWallX(vb, x)`、`onWallY(vb, y)` | 该像素下方竖直平面 `x = const` 或 `y = const` 上的世界点。 |
| `hash12`、`hash13`、`noise2`、`noise3`、`fbm2`、`fbm3` | 哈希与值噪声，外加 4 个八度的 fbm。 |
| `window(x, a, b, soft)` | 在 `[a + soft, b − soft]` 内为 1，在 `[a − soft, b + soft]` 外为 0：即在每个边界处居中、宽 `2·soft` 的 smoothstep，所以在 `a` 和 `b` 处为 0.5。 |
| `tonemap(c, exposure)` | `1 − exp(−c·exposure)`。用它代替 `clamp`。 |

`onFloor` 与墙面函数同 `iso()` 精确往返：`project(onFloor(vb, z)) == vb`。正是这一点让着色器内容能与 SVG 线条对齐注册。

**为什么用世界空间。** 图（图示）的透视就是投影。如果你在屏幕空间绘制效果（凭肉眼定尺寸的椭圆、以像素为单位的辉光柱），它就无法与绘图一致。它会浮在地板上方、穿过甲板，或者在相机改变时保持同样的形状。一切从世界点和世界尺寸构建。屏幕尺寸只来自世界单位乘以 `uK`。

以世界单位做抗锯齿：`pixelOf()` 是横跨屏幕每设备像素对应的世界单位数。在深度方向的地板上，除以 `uCam.z`（sinE）；在墙面上向上，除以 `uCam.w`（cosE）。把注册的边缘柔化约 `0.7 * px`，使它们出来时为一个像素的柔和：像 SVG 一样清晰，但不混叠。在折射拉伸图像的地方，固定的柔和度会呈阶梯状；ripple tank 启用 `GL_OES_standard_derivatives`，并将其阴影半影展宽 `length(fwidth(q.xy)) / length(fwidth(rest))`，即移位点的足迹除以未移位点的足迹，静止时恰好为 1，并带有 `#ifdef GL_OES_standard_derivatives` 回退。

## 4. 等轴测相机中的射线步进（ray-marching）

相机是等比例的正交相机：投影的两行都正交归一。由此推出三件事。

- **每个像素都是一条直线射线** `p(t) = p0 + t·V`，其中 `V = towardViewer()`，`p0` 是该像素下方任意一个世界点。取 `p0 = onFloor(vb, h)`，或工具库的 `rayOf(vb)`，即过原点、面向相机的竖直平面上的点（Raptor 的射线状态就从那里开始：`S.g0 = rayOf(vb)`）。`t` 越大越靠近观察者。
- **到点的距离就是屏幕距离。** 屏幕距离除以 `uK` 就是像素射线到某个世界点的精确垂直距离。球形闪光、激波壳或辉光球都可以由该距离算出，且仍然世界正确。最近接近参数为 `tc = dot(C − p0, V)`。
- **遮挡体后方的可见比例。** 如果沿射线的第一个不透明表面位于 `tLow`，那么以 `tc` 为中心、宽为 `sigma` 的高斯的可见度为 `1/(1 + exp(2.41·(tLow − tc)/sigma))`（Raptor 的 `beyond`）。这给出的是柔和切断，但仍是几何性的。

要步进一个体积：
1. **找到沿射线的第一个不透明命中**：地板，加上 SVG 绘制的任何高度场。Raptor 从火焰锥尖上方到甲板步进 28 次，然后在一个由与 SVG 车削轮廓相同的数字构建的 `ground(r)` 高度场上二分 7 次。只有命中点前方的射线部分（`t > tLow`）才是空气。
2. **用简单形状界定步进范围**（Raptor 使用半径 132 的圆柱，从地面命中点向上到出射平面）。在该界定之前把每一项都窗化到恰好为 0，使界定只是优化。
3. **用抖动采样。** 使用 `t = ta + (i + hash12(gl_FragCoord.xy))·dt`，使 28 个采样不出现条带。
4. **按弦长归一化每一项**，使中心像素无论步数多少都得到预期亮度。对于竖直轴体积 `r² = u² + (t·cosE)²`，半径为 `σ` 的高斯沿射线积分为 `σ√π / cosE`：按 `dt·cosE/(σ·1.772)` 给每个采样加权。
5. **预期均匀圆柱看起来更柔和。** 它的投影轮廓呈 sqrt 形，因此失去平面绘图所具有的清晰边缘。在深色下，加一层边缘壳（Raptor 位于 `0.9·Re` 的橙色剪切层）把边缘找回来。在浅色下同一层壳会给中空的火焰勾出轮廓，所以那里改为把主体向轴心加权（第 8.4 节）。

有些项不需要步进：
- 沿射线看到的薄水平圆盘是一个精确椭圆。Raptor 的马赫盘保持解析：`u² + ((s0 − sc)/tanE)² < rm²`。
- 沿射线积分的薄球壳是边缘增亮的：亮度与 `rs·w / sqrt(rs² − d² + 2·rs·w)` 成正比。对归一化轮廓取平方，否则内部看起来像乳白色气泡。

## 5. 将着色器内容注册到 SVG

任何位于一个平面上的东西都必须与该平面的 SVG 线条精确对齐。
- **数字相同。** 通过 `DATA` 把 SVG 的平面图和高度传给着色器（ripple tank 传入 `inside`、`outside`、`paper`、`base`、`round`、`z` 以及所有投影物的平面图），并一次性作为 `fixed` uniform（其 `FIXED`）交给 `glLayer`。用带符号距离 `sdRect` 对相同的圆角矩形做测试，使受光照的纸角落在绘制的圆角半径上。
- **平面相同。** ripple tank 对玻璃后方的水带使用 `onFloor(vb, uZ.x)`（纸面）、`onFloor(vb, uZ.z)`（水面）以及 `onWallX(vb, uNear.x)` 和 `onWallY(vb, uNear.y)`（两个近侧玻璃壁）。绝不使用屏幕偏移。
- **透过开口看，双重遮罩。** 位于较近平面开口后方的内容（视窗玻璃、窗口、凹槽、表圈下方的表盘面）由它自己的平面遮罩（`onWallY(vb, back)`），并由在开口所在平面中测试的开口遮罩（`onWallY(vb, face)`），两个柔和遮罩相乘。只在后平面中遮罩时，一个盲测视窗玻璃把它的油和玻璃溅出顶缘约 0.4 px 到机体面上，并且在底部偏移会在开口内露出一条裸露机体。把凹槽的内壁画在 front SVG 中，按朝向着色（`craft.md`，第 10 节），使两个平面之间的偏移读作墙，而不是裸露面。
- **只移动偏差。** 如果效果位移你所见的内容（涟漪折射），只应用与静止状态不同的部分。ripple tank 计算被起伏水面和静止水面分别弯折的视线，只应用两者的差。静止时，水面下的纸面与 SVG 纸面对齐。只要通往纸面的视线在几单位内经过支腿（`legClear`），该位移也淡出到 0，使折射纸面永远不会从 middle SVG 覆盖它的支腿后面滑出。
- **高度场与车削匹配。** Raptor 的 `ground(r)` 是甲板圆盘加火焰锥轮廓，其半径和高度与 `build.mjs` 中的 `G.solidOf` 轮廓相同。锥后的流动被几何隐藏，硬边缘只出现在 SVG 绘制真实轮廓的地方。

以 4× 检查注册（第 9 节）。

## 6. API 与最小页面

```js
import { GLSL_ISO, glCamera, glLayer, smooth, burst, settle } from "../../kit/gl.mjs";
import { kitScript, glScript } from "../../scripts/inline-kit.mjs";
```

| 函数 | 作用 |
|---|---|
| `glCamera(P)` | 工具库投影的 `{ origin, k, cam }`。在 Node 和浏览器中都可用。把它放进页面的 `DATA` 中。 |
| `glLayer({ canvas, fragment, view, camera, uniforms = [], fixed = {}, extensions = [], maxRatio = 1.5, onError })` | 在 `canvas` 上以预乘 alpha 的 WebGL1 上下文编译 `GLSL_ISO + fragment`。`view` 是 viewBox 的 `[W, H]`，`camera` 是 `glCamera(P)`，`uniforms` 列出你每帧发送的 uniform 名。`fixed` 是 `{ name: value }`，用于创建时只设置一次的 uniform（几何、主题常量）。`extensions` 列出 GLSL 扩展（`["GL_OES_standard_derivatives"]`）；上下文支持的每一个都会被启用并作为 `#extension` 指令前置。返回 `{ gl, extensions, set(values), draw(values, time), clear() }`，其中 `extensions` 列出实际启用的那些；当 WebGL 缺失或着色器编译失败时返回 `null`（`onError`（默认为 `console.error`）会收到日志）。 |
| `set(values)` | 只设置 uniform，不绘制。 |
| `draw(values, time)` | 把画布大小调整为其 CSS 盒 × `min(maxRatio, devicePixelRatio)`，设置相机 uniform，设置 `uTime = time`，设置 `values` 中的每个值，并绘制一个全屏三角形。 |
| `clear()` | 清屏为透明，仅在有内容绘制过时。 |
| `smooth(a, b, x)`、`burst(age, rise, fall)`、`settle(state, target, dt, seconds, calm)` | 每个着色器 uniform 都应当搭载的 JS 包络（第 7 节和 `motion.md`）。`settle` 在仍在移动时返回 true。 |
| `glScript()` | 去掉 `export` 的 `kit/gl.mjs` 源码，用于在 `kitScript()` 之后内联进独立页面。该页面上的实时代码直接使用 `glLayer`、`smooth`、`burst` 和 `settle`，不得自行声明。 |

uniform 值（在 `fixed`、`set` 或 `draw` 中）可以是数字（float）、长度 2–4 的数组（`vec2`–`vec4`），或长于 4 的数组或 `Float32Array`，通过 `uniform1fv` 发送给 `uniform float name[N]`：24 个采样的历史就是一个 `uH[24]`。这些调用不支持 int、矩阵或采样器。数据量超过 uniform 数组容量时，使用纹理：`sampler2D` 默认读取单元 0，所以在 `layer.gl` 上创建和更新它。ripple tank 把 32 × 2 的历史打包进 RGBA8 纹理，每个值 16 位（`PACK`、`put`、`unpack`），每层一个纹理，因为每层有自己的上下文。未知名称和被编译器优化掉的 uniform 会被跳过。

你的片段声明自己的额外 uniform 和一个写入**预乘** `gl_FragColor` 的 `main()`。画布必须覆盖与 SVG 完全相同的盒，并具有相同的纵横比，因为 `viewOf` 假定单一均匀缩放。

一个最小页面：一块热板在方形甲板顶部发光。热板与半径 40 的 SVG 圆环注册（`k.ring(0, 0, 40, 0, P, 72)`），辉光停在甲板的圆角边缘，因为其外没有任何东西可照亮。

`build.mjs`:
```js
const P = k.fitProjection(points, W, H, { pad: 28, azimuth: 40 });
const DECK = { x: -90, y: -90, w: 180, d: 180, r: 8 };
const DATA = { W, H, camera: glCamera(P), plateR: 40, deck: [DECK.w / 2, DECK.r] };
const backSvg = k.figureSvg({ width: W, height: H, label: LABEL, body: back });
const frontSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="iso-svg fx-layer" viewBox="0 0 ${W} ${H}" aria-hidden="true">${front.join("")}</svg>`;
const stage = `<div class="fx-stage" tabindex="0">${backSvg}<canvas class="fx-layer fx-gl" aria-hidden="true"></canvas>${frontSvg}</div>`;
const page = k.pageHtml({ title, theme, body: `<style>${CSS}</style>${k.plateHtml({ ...card, body: stage })}`, script: kitScript() + glScript() + LIVE.replace("__DATA__", JSON.stringify(DATA)) });
```

`live.js`:
```js
const D = __DATA__;
const stage = document.querySelector(".fx-stage");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const LIGHT = document.body.dataset.theme === "light" ? 1 : 0;
const FRAGMENT = `
uniform float uHeat;
uniform float uLight;
const float R=${D.plateR.toFixed(1)};
const vec2 DECK=vec2(${D.deck[0].toFixed(1)},${D.deck[1].toFixed(1)});
float deckDist(vec2 p){vec2 q=abs(p)-DECK.x+DECK.y;return length(max(q,0.))+min(max(q.x,q.y),0.)-DECK.y;}
void main(){
  vec2 vb=viewOf(gl_FragCoord.xy);
  float px=pixelOf()/uCam.z;
  vec3 p=onFloor(vb,0.);
  float r=length(p.xy);
  float disc=1.-smoothstep(R-.7*px,R+.7*px,r);
  float onDeck=1.-smoothstep(-.7*px,.7*px,deckDist(p.xy));
  float halo=exp(-pow(r/(R*1.6),2.))*onDeck;
  vec3 col=tonemap(vec3(1.,.42,.12)*(disc*.9+halo*.35)*uHeat,1.2);
  float a=max(col.r,max(col.g,col.b));
  vec4 dark=vec4(col,a);
  vec4 light=vec4(vec3(.62,.24,.08)*a*.8,a*.8);
  gl_FragColor=mix(dark,light,uLight);
}`;
const layer = glLayer({ canvas: stage.querySelector(".fx-gl"), fragment: FRAGMENT, view: [D.W, D.H], camera: D.camera, uniforms: ["uHeat"], fixed: { uLight: LIGHT } });
if (layer) stage.setAttribute("data-gl", "");
const heat = { x: 0, v: 0 };
let target = 1, clock = 0, last = 0, frame = 0, visible = false;
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  clock += dt;
  const moving = settle(heat, target, dt, 0.35, still.matches);
  if (layer) heat.x > 1e-3 ? layer.draw({ uHeat: heat.x }, still.matches ? 0.8 : clock) : layer.clear();
  frame = visible && moving ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
```
没有 `uTime` 动画时，一旦热量稳定，该循环就停止。对于有动画的场（闪烁、流动），只要效果高于其活动阈值且可见就继续运行，否则停止。

## 7. 工艺规则，每条都附有教会它的 bug

### 不跳变
每个 uniform 都沿平滑包络随时间移动，有起振和衰减。绝不在单帧内把值设为 1。

- **一次性事件使用 `burst`。** 第一个点火闪光在一帧内从 0 到满值，把卡片冲白了。现在每个事件（闪光、激波、地面光环、关机跳变、卡片震动）都使用 `kit/gl.mjs` 中工具库的 `burst(age, rise, fall)`，即 smoothstep 起振后接指数衰减：
  ```js
  const flash = calm ? 0 : burst(sinceMain, 0.08, 0.13);
  ```
  起振 50–90 ms（起始斜率为零）。alpha 函数 `t·e^(−t)` 把衰减与起振绑定，会白得太久。整卡闪光也要压低：闪光加 0.9 不透明度的 CSS 面纱把整张卡片冲白了六帧，所以面纱现在是 `flash × 0.32`。
- **相位变化是由物理量驱动的交叉淡化。** 一个独立的预燃器项在主羽流增长时消亡，读起来像瞬间的颜色切换。现在颜色、亮度、参差程度、火舌长度和飞溅都是室压的函数，而压力以弹簧方式朝每个相位的目标移动。
- **颜色要有自己的慢包络。** 即使由压力驱动，橙到紫的变化在快弹簧上也用约 0.23 s 越过其 smoothstep 窗口，而亮度下降了 33% 并在 130 ms 闪光内回升：被闪光掩盖的切断。修复：
  - 色相有自己的临界阻尼包络，即工具库的 `settle`：`settle(burn.hue, lit && burn.pc > 0.2 ? 1 : 0, dt, lit ? 0.32 : 0.5, calm)`，作为 `uHue` 发送。
  - 亮度是单独的 `uGlow`，在 JS 中计算，使它在色相上升时从 1.15 单调降到 1.0。
  - 压力弹簧是临界阻尼的（刚度 20，阻力 2√20），使其不会过冲到 318 bar。
- **淡出期间亮度只降。** 关机时羽流又蹿成橙色火焰，因为 `mix(a, b, hue)` 在 `b < a` 时随 hue 衰减又升了回去。现在辉光等级在关机开始时冻结，之后只由下降的量缩放。
- **改动弹簧时重新检查邻近项。** 压力弹簧改为临界阻尼后，预燃器火舌几乎消失。该支路需要自己更硬的临界弹簧（刚度 64）。
- **一次性标志属于事件。** 关机后 2 s 内重新点火会丢掉下一次关机跳变，因为跳变的时钟只在静默期后才重置。现在由每次点火的 `popped` 标志决定。在 `ignite()` 中重置时钟会切断一个仍在淡出的跳变。
- **变化通过介质传播。** ripple tank 频率改变时，新波长不会立刻重新铺满整个场。页面每帧记录波源的真实相位、ω、k、每 mm 阻尼和 1/群速度，保留间隔 50 ms 的 32 个采样，并把它们作为 32 × 2 纹理上传给两个着色器。每个点用其自身历史的群速度做一步定点运算找到自己的年龄 `r / groupSpeed`，并从该年龄读取 k 和阻尼，使新波长以真实的方式从振源向外扩散。
- **变化过程中保持相位连续。** 第一个版本使用 `θ = k(age)·r − φ(t)`。扫描期间 `r·dk/dt` 项使远处波峰狂奔并混叠，而在频率移动时衰减幅度（`calm`）会把图案抹白：纸面平均亮度下降 17%。现在 `θ = kE·r − uPhase + Ψ(age)`，其中 `Ψ` 是该采样之后波源获得的、超出其 ω 预测的相位（`packHistory` 中的 `lag`）。在固定点上，波峰随后只以 ω 变化的速度移动，因此无需幅度衰减，而一个小的动态模糊项（`gMove`，波峰每帧移动的距离）在快速变化期间柔化焦散。
- **初次光照淡入，且在浅色下只变亮。** ripple 灯在首次查看时用 0.9 s 淡入（`smooth(0, 1, (lampClock − 0.15) / 0.9)`）。在深色下 SVG 静水填充通过 CSS 变量（`--rt-lamp`）按同一值淡出。在浅色下第一个版本从裸纸开始，所以灯亮时波谷的墨色使水箱变暗，静水填充进一步压暗。现在只要 WebGL 运行就隐藏水填充，并且纸面从第一帧（灯 0）起以其未点亮灰色（`off`）绘制，再由 `uLight` 向点亮墨色混合，使初次光照只变亮。对于纸面上的发光体，同一规则反过来读：其墨色只随光进入而增长，场景绝不会先变白或先变暗（第 8.2 节）。

### 没有空间硬切断
每一项在任何边界（`if`、界定形状、平面或画布边缘）之前到达 0。只在该项可证明约为 0 的地方把 `if` 用作优化。
- 一个珠状项曾在其范围两端被 `if` 锐利切断。现在用 smoothstep 淡入淡出。
- 羽流曾有一个 `if` 盒、一个 `s < .01 continue` 和一个 `step(ax, R0)` 光晕遮罩。三处都显示为接缝。
- 一个屏幕空间辉光柱从喷口一直画到画布底部。画布最后几行的 alpha 仍为 11–19/255，使它在甲板下以一条水平直线收尾。它现在是由地面界定的世界空间光晕，最后 10 行和列读出来恰好为 0。
- 一个宽 `exp()` 闪光和地面坐标蒸汽在画布边缘仍可见。两者现在都在画布内降到 0。
- 单元噪声只看自己单元内部，所以一个其偏移加半径加柔和尾部超出单元半宽的特征会在单元边缘被平切。保持 `offset + wobble + radius + tail` 小于半个单元，或测试 3 × 3 邻近单元。一个盲测气泡场让一个中心偏离单元中心 0.31 个单元，触达 0.86，而半单元为 0.85。
- 使用 `atan` 的径向噪声在某个角度上有一条接缝。改用方向向量的 `noise3(vec3(dir, r·k − t))`。
- 使用百分比色标的 CSS `radial-gradient` 会结束在其元素之外。使用 `circle closest-side`，使渐变结束在其内部。

### 世界空间，在相机中
- 点火激波曾是围绕投影出口的 2D 圆。它的下弧在甲板上下穿过，并涂过两根立柱。它现在是一个真正的球：每条像素射线在两个根处命中它，地面下方的根被柔和隐藏，每个根按边缘加权，每个根由发动机代理决定去背景或前景画布。
- 地面飞溅曾平铺在导流环上，使管子失去体积。该环现在是圆环遮挡体，用 `max(dot(n, toPlume), 0.)` 照亮。
- 近侧立柱后的雾霭曾涂过它的正面。立柱现在在着色器中是不透明盒体。

### 分层与混合
- 在深色主题中，只发光的画布使用 `mix-blend-mode: screen`，并写入预乘颜色，alpha = 最大通道。同时压暗其所覆盖内容的画布保持普通混合：ripple tank 的水给透过它看到的纸面染色，而 screen 混合会悄悄丢掉这一点。在浅色主题中每个画布都是普通混合，其墨色由纸面应显示的颜色解出（第 8 节），而不是从深色主题的颜色压暗。
- 在普通混合下画在白热核心上的模糊橙边读作喷口唇下一条暗棕领圈，画得略偏离唇部又会形成双弧。着色器上的辉光轮廓现在放进它们自己的覆盖 SVG（`.rp-glow`），在深色下 screen 混合，位于精确的唇部。在浅色下没有什么能增加光，所以边缘是墨色本身的一部分：围绕苍白核心、位于主体边缘的饱和带（第 8.1 节）。
- 应经过钟形喷管前方的蒸汽总在它后面。它现在用发动机代理拆分到两个画布（第 2 节）。

### 色调映射（tonemap）与抖动
- 使用 `tonemap()`，绝不使用 `clamp`，使亮核心滚降而不是被压平。
- 没有输出抖动时，大而柔和的项会变成 8-bit 阶梯（每级 18–34 px 的连续段），而 screen 混合使其更糟。色调映射后用约 ±1 LSB 的动画三角噪声做抖动，并加门控使空像素恰好保持 0（Raptor 的 `inkOf`）：
  ```glsl
  col=tonemap(col,1.15);
  float m=max(col.r,max(col.g,col.b));
  float n=(hash12(gl_FragCoord.xy+fract(uTime*.61)*91.)+hash12(gl_FragCoord.yx*1.37+fract(uTime*.37)*57.)-1.)/255.;
  col=max(col+n*smoothstep(0.,1.5/255.,m),0.);
  ```
- 对精细细节做带限。ripple tank 淡出每一条投影波长低于 2.5–5 设备像素的波（其 `fine` 项）。否则 28 Hz 的图案会变成摩尔纹。

### 只在重要时渲染
- 把设备比上限设为 1.5（`maxRatio` 默认值）。只在效果活动时绘制：Raptor 清空两个画布，并让循环在每个包络低于 1e-3 时停止。用与图（图示）其余部分相同的 `IntersectionObserver` 停止离屏渲染，并在 `resize` 时重绘。
- 一个永不停歇的效果（回流中的气泡、引燃火焰）在空闲时仍让着色器绘制，但不让图（图示）其余部分：拆分循环，使 SVG 工作（深度排序、仪表、读数）只在其中有东西变化时运行，并单独运行效果，若慢则降频。一个盲测台因为一个包络稳定在 0.54 而不是 0，使其整个 tick 永远保持 60 fps。
- 用 uniform 检查给昂贵项加门控（`if(uSmoke<.0004&&uVent<.0004)return vec3(0.);`）。这些对整个绘制都相同，所以关闭时不花代价。

### 减弱动态
直接跳到有代表性的稳态（Raptor 跳到主级，ripple tank 跳到其当前 f 和 d），冻结 `uTime`（Raptor 用 0.8），把每个事件包络归零（无闪光、激波或震动），只在 uniform 的 JSON 变化时重绘。图（图示）仍必须响应输入。

### 回退
`glLayer` 返回 `null`，所以守卫每次调用。WebGL 运行时给舞台打标记（`data-gl`），使 CSS 能在 SVG 回退与着色器之间切换。通过打桩 WebGL 测试（第 9 节）。

## 8. 浅色主题

浅色是发布主题。浅色页面得到的是为纸面设计的着色器，而不是最后从深色底板辉光转换来的。等轴测网站上的七个图（图示）先在深色底板上构建再转换：池式反应堆、铸造浇注、加力燃烧室、glory hole、托卡马克、等离子切割机和锻炉。每次转换用了三轮评审，本节每条规则都是其发现之一。

Raptor 的浅色羽流（`examples-raptor-engine/live.js` 中的 `inkOf`）示范了不该做什么。它把每个色相乘以固定的暗红 `vec3(.62,.34,.3)`，并把 alpha 设为亮度，使最热的气体出来最暗最不透明。评审称之为"红墨烟"。不要照抄。ripple tank 的灰色墨色（`uPale`）仍是非辉光类光的良好范例：色调曲线 `1 − uExpo.x/(1 + (e/uExpo.y)^uExpo.z)` 把波峰带到接近纸白，波谷带到工具库的灰色，其水只写入相对静水的变化。

### 8.1 纸面上的墨色
在白底上，画布是普通混合、预乘的，绝不 `screen`，因为白底上 screen 就是白。没有像素能比纸面更亮，所以光必须通过**饱和度和局部对比**来表达：
- **辉光是饱和主体、接近白的苍白核心和彩色边缘。** 苍白核心读起来热，只是因为周围的主体饱和，而再周围的地面更暗。
- **光照到的东西染上色调**（类 multiply，alpha 设上限）。它不会变亮。
- **承载光的体积更暗，有物理原因**：煤烟、耐火材料、深水或阴影（第 8.3 节）。它绝不是一个黑盒。

**设计纸面应显示的颜色，再解出墨色。** 写一条从光能到读者在白底上应见颜色的斜坡。然后对白底上的普通合成求逆，其显示为 `rgb + (1 − a)`：
```glsl
vec4 inkFor(vec3 seen,float cover){
  vec3 absorbed=1.-seen;
  float a=max(max(absorbed.r,max(absorbed.g,absorbed.b)),cover);
  return vec4(vec3(a)-absorbed,a);
}
```
在白底上这恰好合成为 `seen`。
- **反应堆。** `inkOf` 用它的 `paperOf(e)` 斜坡做到这一点，其中 `e = 1 − exp(−2.3·max(lin))`。斜坡从白 → `TINT (.85,.93,1)` → `BODY (.2,.46,.94)`（到 e .12–.5）→ `RIM (.2,.68,1)`（.4–.65）→ `ICE (.9,.98,1)`（.6–.9）。
- **加力燃烧室。** 它的 `paperOf` 混合白 → 主体 → 苍白核心，然后以同样方式求逆。
- **`cover` 是热端的 alpha 下限**：反应堆中为 `WASH·smoothstep(.6,.9,e)`，WASH .52；加力燃烧室中为 `COVER·smoothstep(.45,.92,m)`，COVER .94。没有它，接近白的核心 alpha 接近 0，其后的 SVG 线条直接透出，读作洞而不是光。

其他图（图示）使用形式 `vec4(colour·a, a)`：`colour` 来自斜坡，`a` 来自能量的饱和曲线。托卡马克的 `glowInk` 是一个例子。两种形式都可行；`inkFor` 还保证读者看到的颜色。

**每种光一种墨色，在着色器中合成。** 保持独立的累加器，给每种自己的墨色，并用 `vec4 over(vec4 top,vec4 under){return top+under*(1.-top.a);}` 从后往前叠放：

| 项 | 墨色 | 见于 |
|---|---|---|
| 发射，发热体本身 | 斜坡主体加苍白核心，alpha 最高 .96–.97 | plasma cutter `bodyInk`、forge `barInk`、tokamak `glowInk` |
| 落在表面上的光 | 色相拉向暖或冷，alpha 上限 .5–.8 | foundry `castInk` 和 `tintInk`、tokamak `tintInk`（.5）、plasma cutter `tintInk`（.75–.8） |
| 雾霭：蒸汽、烟、烟气、击穿气体 | 灰色或轻染色，alpha `1 − exp(−density·k)` | plasma cutter `hazeInk`、tokamak `gasInk`、forge 蒸汽 |
| 火花与条纹 | 叠在一切之上 | foundry 和 forge `sparks` |

plasma cutter 的 `lightInkOf` 是最清楚的例子：`over(arcCore, over(bodyInk(body), over(arc, over(fumeInk, over(steamInk, tintInk(tint))))))`。如果先把能量相加再给和上墨色，一切都会得到同一个色相，苍白核心也会丢失。

**收尾。**
- 每次求和后钳制 `rgb ≤ a`：加力燃烧室曾出现 1 LSB 的预乘溢出。
- 对最终预乘值做抖动，rgb 和 alpha 都要，由 `smoothstep(0.,1.5/255.,a)` 门控（玻璃炉的 `paperOut`、foundry 的 `dithered`）。
- 让画布边缘恰好为 0。
- 在能量进入斜坡之前做色调映射（tonemap）（`tonemap`，或 `1 − exp(−k·e)`），绝不 `clamp`。

### 8.2 墨色随光增长
在深色下，更多光只是增加。在纸面上，更多光意味着更多墨色，而一个粗心的公式可能在光下降时增加墨色，或在光上升时拿走墨色。这些是评审最常发现的缺陷：
- **只淡出完成的墨色一次。** 把预乘墨色乘以 `u` 是从裸纸到完整画面的精确线性交叉淡化，在每个像素上单调：反应堆的 `ink*=uFirst`，玻璃炉的 `paperOut(overInk(gas, ink)*uLit)`。glory hole 先在上墨色前淡出每一项（`holeOf` 中的 `*uLit`，即孔口和球体）。苍白核心先于其饱和主体到达，然后地面变暗，所以初次光照先变白再变暗。用未淡出的色调构建每盏灯的墨色（其 `litOf()` 在浅色下返回 1），只淡出结果。
- **同时按能量和 alpha 淡出辉光。** 如果只淡出 alpha，苍白核心保持苍白，变薄的辉光变成乳白灰：托卡马克的接触带就这样。如果只淡出能量，辉光会沿其斜坡回落。托卡马克现在把能量缩到一个下限，alpha 走完剩下的路：`hot+=glowInk(c*level*(.3+.7*hold))*hold*(1.-hot.a)`。带子在消退过程中保持粉紫。
- **在稳定亮度处取色相。** 能量下降时，色调映射（tonemap）使色相变红变暗，而 alpha 接近上限时墨色上升：加力燃烧室的腔体在火焰熄灭时墨色重了 55%。修复：
  - 取色相前先把燃烧量除以局部点亮强度（`burn/lit`，`lit = la.x·glowOf(la.y)/LIT_GLOW`）。
  - 按每部分占能量的份额混合色相。
  - 把 alpha 与能量绑定：`cap·(1 − exp(−1.6·e/cap))`。
  - 在低覆盖下，把色相暖向 `EMBER`，并按 `inkOf(hue)/inkOf(ember)` 缩放 alpha，使墨色保持不变。

  如此，切口处窗口的墨色从 1894 单调降到 155。
- **交接就是普通的预乘混合。** 加力燃烧室的射流有两份拷贝，干态蓝和点亮暖，用 `mix(blue, warm, lift)` 交叉淡化。那里的 `max(alpha)` 覆盖使干态射流的墨色翻倍。还要给每份拷贝加门控，使其不会拾取另一份的项：干态激波盘曾作为奶油斑漏进暖态拷贝。
- **相乘的包络可能在淡出期间上升。** 如果初次光照包络仍在上升而效果自身边缘在下降，淡出会变亮：托卡马克在按下 Home 的前半秒就这样。效果下降时冻结初次光照增长。
- **从 SVG 回退的交接必须精确**，否则场景会在着色器进入时下陷（第 8.5 节）。

### 8.3 光的落脚处
白底上一无所有的辉光读作污渍。给它真实拥有的地面：
- **SVG 中的腔体使用更暗的 token 集。** 组类为其中一切重定义工具库 token：
  - 加力燃烧室的 `.ab-inside`：纸面 `#4a453f`，明暗 `#3c3833` 到 `#544e47`，线条 `#5e5952` 到 `#9b958b`；
  - 托卡马克的 `.tk-cavity`：`#66646e` 到 `#8b8992`；
  - foundry 的熏黑孔壁色调（`--fd-bore-*-sooted`，即 `--anatomy-shade-0` 与 `--fd-soot-ink: #2f2a25` 的 `color-mix`）；
  - glory hole 的 `--gf-void` 和 `--gf-bore`；
  - 反应堆的水柱渐变（`--rx-water-top`、`-mid`、`-deep`，从 `#edf2f4` 到 `#c9d7e0`）。

  在深色下相同 token 设为 `inherit`。四种明暗色调都保留，使内部仍有形体，读作耐火材料、煤烟或深水，而不是洞。
- **地面实时染上光的色调。** 相同的 token 按循环写入的变量向光的色相 `color-mix`：面和背板上 `--ab-flame` 为 30%，线条上 55%，`--tk-cold-mix` 用于击穿的紫。这样即使没有 WebGL，SVG 地面也随火焰变暖。
- **着色器的地面等于 SVG 的。** 在着色器绘制不透明腔体处（glory hole 的 `holeOf = overInk(emberInk(t,1.), vec4(SOOT,1.))`），读取 token 而不是重新输入。foundry 添加一条探针路径，把其填充设为每个 `var(--fd-…)`，读取 `getComputedStyle(probe).fill`，并把结果作为 `fixed` uniform 传入（其 `mount.ts` 中的 `paintOf`）。
- **光源周围的光是长尾色调。** 托卡马克的容器在平顶期读作灰色，直到一个长程泛光（`skin*(.14*exp(-gap/(.22*U))+.17*exp(-gap/(.9*U)))`）把它的壁染成品红。在立柱上实测：等离子关闭时 `#6e6c76`，泛光在 .17 时 `#786778`，读作已点亮。在 .1 时仍读作灰色。
- **空气中不泛光。** 在浅色下，悬在空中的流或片周围的光晕是纸上的污痕（foundry 的流和缺口辉光就是）。在浅色下去掉空气中的光晕。把边缘轮廓保持在主体内部，把色调保留在光到达的表面上。
- **光只落在光源能看到的地方。** 反应堆的表面光漏到屏蔽件的切割面和顶盖上，直到其密封测试使用水箱唇部的真实顶部（`RIMZ`）而不是甲板。plasma cutter 照亮了射流下端下方的板条舱，而射流明显在隔壁舱；其 `bayLight` 现在按射流柱的份额照亮每个舱，使光随射流移动在舱与舱之间交叉淡化。

### 8.4 按现象给出配方
热体按暗红 → 橙 → 黄 → 接近白，只按这个顺序。在模型中保留一张色标表，把它编译成 GLSL，并为回退使用同一张表：foundry 的 `INK_STOPS`（`inkRampGlsl`，以及用于 SVG 的 `glowInk`），forge 的 `STEEL_INK`（`steelInk`、`steelInkOf`）。
- **熔融金属、锻钢、坯料、切口。**
  - 用亮度温度索引表，使昏暗的远墙和明亮的浇注从同一张表读出。foundry 的 `brightOf` 从绿色通道反推 Wien。
  - forge 的色标：560 °C `(.45,.09,.05)`，680 `(.56,.07,.04)`，780 `(.78,.10,.03)`，950 `(.95,.38,.06)`，1150 `(1,.78,.12)`，1260 `(1,.93,.78)`。
  - alpha 在可见辉光处开启：`steelGlows` 覆盖 560–820 °C，或 foundry 的 `INK_FROM`/`INK_FULL` 覆盖 470–590 °C，从金属自身的地面色调交叉淡化。
  - 边缘更冷更暗（`steelInk(t − 140)`，foundry 的 150 K 边缘下降）。奶油核心只出现在最热的中心（`steelPale` 覆盖 1050–1280 °C，在 .8）。
  - 暗皮位于辉光之下，随金属冷却而增长：forge 的 `barInk` 从氧化色 `(.28,.29,.32)` 到皮色 `(.24,.22,.23)`，覆盖度最高 .86。
  - 评审对 foundry 金属流的评语："奶油核心包橙色皮"。
- **玻璃聚集。**
  - alpha 是亮度门：`GLOW_SEEN` .008–.028，约 600–710 °C。
  - 颜色为 `pow(hue, mix(1.6,.8,warm))*mix(.62,1.,warm)`，由深樱桃 → 红 → 橙。
  - 苍白核心（`CORE_PALE (1,.88,.62)`）位于像素自身发射最亮处（`cored`，亮度 .14–.24），而不是固定半径处。
  - 冷皮（`SKIN_COOL (.3,.11,.07)`）只后退。
  - 第一个版本有一段鲑鱼色阶段。红混向白就是鲑鱼色，而没有温度看起来是那样：先经橙和黄，然后才有东西变白。
- **火花。**
  - 饱和的头部和更暗更冷的尾。plasma cutter 的 `tailCooling` 把尾设为头部温度的 0.62；forge 的尾墨色是 `(.42,.07,.02)`，alpha .75 上限 .8。只有最年轻的三分之一火花有苍白核心（`u < .35`）。
  - 条纹保持至少约 1.25 设备像素宽（`max(.35+.6px, 1.25px)`），否则斜条纹在 10–24× 时成珠。
  - 在白底上火花是墨色，所以在更热的发光体上它必须消失。foundry 把火花墨色乘以 `1 − cover·smoothstep(sparkT−60, sparkT+60, tb)`，对金属和发光孔壁都如此。
  - 经过射流后方的火花按深度淡出：`cover*smoothstep(-.4,.4,tJet-tS)`。
- **火焰与排气。**
  - 饱和橙黄主体，边缘半透明，在浅色下向轴心加权：`mix(1.,1.3-.6*smoothstep(0.,rf,r),uLight)`。
  - 切掉边缘幔（`mix(.8,.3,uLight)`）。给深色羽流边缘的边缘壳（第 4 节）会在纸上勾出轮廓，使火焰中空。
  - 参差只留在外部，加宽热轴，苍白核心放在喷口，沿长度的 .4–.9 淡出。
  - 检查横截面。加力燃烧室的最终火焰从边缘到边缘的墨色读作 `0 2 13 33 31 49 78 72 78 52 40 32 8`。
  - 干态射流是淡蓝柱。激波菱形是苍白奶油盘（`CREAM (1,.95,.86)`），带暖边和柔边（约盘半径的 .65）。再加强，第二个菱形读作旋钮或垫圈，所以它保持为淡淡的透镜。
- **烟与蒸汽。**
  - 浅灰，绝不叠加暗辉光墨色。边缘 `(.84,.87,.90)`，顶部 `(.97,.975,.98)`，底面 `(.72,.76,.81)`（由云自身的自阴影）；alpha `1 − exp(−density·k)`。
  - 靠近热源时，把云暖向淡琥珀（`mix(steelInk(T), CREAM, .5)`）。forge 最初在云上叠辉光墨色，评审看到一坨鲑鱼色。
  - 淬火喷团是一团离开水槽的 `burst`：它从水面以上 4 单位升到约 40 单位，越升越慢（forge 的 `shader.ts` 中的 `PUFF`），在约 0.15 s 内离开边缘，从 7 展宽到 13，越长大越薄，并共享柱的高度窗口，使其永不切断。
- **等离子体（tokamak）。**
  - 饱和品红紫：`inkBody(chroma)=pow(chroma,vec3(1.8))*vec3(.93,.86,.97)`。
  - m 超过 .55 后核心变白，向白并保留 8% 的色度。
  - alpha：`.97*smoothstep(.02,.42,m)*(1.-exp(-2.6*(m+2.*m*m)))`。
  - 击穿气体是紫雾，`(.52,.44,1)` 到 `(.74,.68,1)`，alpha 最高 .64。透过剖切看，容器内部使用腔体 token 集。
- **切伦科夫（反应堆）。**
  - 蓝染水柱中鲜艳的青蓝：8.1 的纸面斜坡，叠在 SVG 水渐变上，热端由 `WASH` 设下限，使核心覆盖其后的燃料管线。
  - 压缩临界以上的脉冲（`1.+.75*log(level)`），使 1.5 GW 脉冲照亮水池而不冲白卡片。
  - 大厅墙上的辉光使用单独的更弱墨色（`HALL_INK` .35）。
- **等离子弧（plasma cutter）。**
  - 紫弧 `vec3(.6,.34,1.)`，苍白核心 `vec3(.96,.95,1.)`。
  - 板和水上的暖色墨色：`mix(vec3(1.,.5,.08),vec3(1.,.68,.3),…)`，alpha `.75*(1.-exp(-3.2*sqrt(m)))`。

### 8.5 浅色下的 SVG 与回退
- **只读一次主题。** 在构建时选择主题（`pageHtml({ theme })`，或 React 包装上的 `data-theme`；在等轴测网站上，图（图示）的构建返回 `theme`，`LivePlate` 用其自己的 `.iso[data-theme="dark"]` 包裹深色底板）。实时代码从最近的 `[data-theme]` 读取（`root.closest("[data-theme]")?.getAttribute("data-theme") !== "dark"`），并把 `uLight` 作为 `fixed` 传入。用 `uLight` 给每个仅浅色的变化加门控（`mix(dark, light, uLight)`，或对该 uniform 分支），使深色输出保持原样。如果便宜就保持深色可用。
- **不用颜色字面量。** 如果图（图示）在 CSS 中硬编码了深色，把它们转成带深色覆盖的 token：`.x { --x: light }` 然后 `.iso[data-theme="dark"] .x { --x: dark }`。必须匹配 token 的着色器常量来自探针（8.3）。
- **嵌套主题。** `.iso:not([data-theme="dark"]) .x` 也会穿过深色底板周围的浅色页面匹配。反应堆的深色回退就是这样被乘成全黑的。把深色规则放在浅色规则之后，特异性相等，或以底板自身的主题为键：forge 使用 `.iso-plate[data-plate="light"]`。
- **回退如何混合。** 其饱和色调用 multiply，会变暗并让其下的线条可见。其苍白核心用普通混合，因为 multiply 不能变亮：反应堆的无 WebGL 核心是从 `#fff`（.85）到 `#dcefff`（.3）的径向渐变，普通混合。
  - 回退颜色来自与着色器相同的斜坡：foundry 的 `glowLightCss`，以及玻璃炉的 `gatherInk`，它精确镜像着色器的聚集墨色。
  - 苍白 token 上的不透明度会淡成灰，所以给回退饱和色相：tokamak 的回退环设置 `--anatomy-lit: #e0409c` 和 `--anatomy-hi: #f27ec0`。
- **回退形状变化做交叉淡化。** tokamak 的无 WebGL 等离子环是 11 个预计算环（`LIMITED_RINGS`）。相邻环用和为 1 的线性权重交叉淡化，位于着色器绘制的相同缓动半径上。用 6 个环时，淡化中会出现双轮廓。
- **有间隙的东西不要放在半透明墨色之下。** SVG 画的任何东西都会透出不完全不透明的墨色。forge 的热带曾是一组笔画，其间有纸，透过棒材 14% 的透明度印出灰条纹。它现在是一个填充热梯度的面。
- **从回退到着色器的交接必须精确。** 初次光照时画布墨色按 `u` 上升，其下回退消退。回退上用线性 `1 − u` 会使淡化中段比两端都白。要精确线性交叉淡化，把回退的不透明度设为 `(1 − u)/(1 − u·α)`，其中 α 是关键处画布墨色的 alpha：玻璃炉的 `--gf-gather-fade`，α 取聚集的中间色标。它的其他回退保持全强度，直到着色器几乎进入：`clamp(0, calc(var(--gf-fallback, 1) * 12), 1)`。
- **着色器绘制的每个物体都有回退。** foundry 的 tap 流没有，所以没有 WebGL 时它缺失。它现在是从着色器读取的同一历史每帧重建的 SVG 轮廓。

### 8.6 墨色与线相遇处
画布位于 back SVG 的 0.6 px 笔画之上。在浅色下，未对齐注册的边缘显示为苍白间隙或笔画上的彩线，而不是暗缝。
- **停在笔画内边缘。** 把面的墨色在笔画下升至满值，并在笔画内边缘处结束，即线宽一半处：工具库 0.6 px 线条为 0.3 vb。测量计算出的笔画宽度；forge 的评审猜的是 1.1。例子：反应堆的 `cutFade=smoothstep(-SEAM-.5*px,-SEAM+.5*px,gap)`，`SEAM=.3`，以及 forge 的 `strokeMeet`。色调按同一半笔画外扩（foundry 的 `ringLight`），使其永不涂过线条，也不在内部留苍白带。
- **不在没有笔画的地方清空墨色。** forge 的面纱在两个面共享的折痕处清空，而 SVG 不描该处，棒材上出现白缝。改为在墨色中画这样的折痕：×0.72，至少 0.8 画布像素宽（更锐出来是点状的）。
- **在相邻射线不一致处超采样。** 反应堆追踪四条子像素射线，当其命中、深度、种类、法线或切口份额不同（`apart`）时取 16 个采样，使切割面边缘不成阶梯。在 dpr 1 时画布像素约与笔画同宽，所以保留一个像素的柔和。
- **从画外进入的物体** 可以在屏幕空间中从画布边缘淡入。foundry 的 tap 流用 11 vb 淡入，从画布顶下方 10.5 设备像素处开始，使边缘仍读作 0，流读作来自上方。

### 8.7 评审所见与修复

| 在浅色下所见 | 原因 | 修复 |
|---|---|---|
| 红棕"墨烟"羽流 | 色相 × 暗乘数，alpha 设为亮度 | 纸面斜坡：饱和主体、苍白核心、alpha 下限（8.1） |
| 画成轮廓、内部中空的火焰 | 深色边缘幔 | 主体向轴心加权，切掉幔（8.4） |
| 初次光照先白后暗 | 上墨色前逐项淡出 | 只淡出完成的预乘墨色一次（8.2） |
| 辉光经乳白灰淡出 | 苍白墨色只淡 alpha | 同时压暗能量和 alpha（8.2） |
| 火熄灭时腔体变暗 | 色调映射（tonemap）在 alpha 保持时使色相变红 | 稳定亮度处取色相、alpha 取自能量、余烬匹配（8.2） |
| 玻璃或钢冷却时的鲑鱼色阶段 | 红混向白 | 黑体顺序的斜坡，过黄才变白，核心在发射峰处（8.4） |
| 火花像金属上的污垢 | 更热发光体上的暗墨色 | 在更热物体上压没火花；饱和头、更暗尾（8.4） |
| 火花条纹放大时成珠 | 尾太细 | 至少约 1.25 px 宽；尾部少收细（8.4） |
| 火花透过射流可见 | 对射流无深度测试 | 按射流后方深度淡出（8.4） |
| 光晕在流周围染污纸面 | 空气中的深色主题泛光 | 浅色下空气中不光晕（8.3） |
| 蒸汽中的鲑鱼色团 | 云上叠辉光墨色 | 把云染向淡琥珀（8.4） |
| 等离子开启时容器读作灰 | 色调衰减太快 | 长程泛光项（8.3） |
| 沿边缘的苍白边饰或白缝 | 墨色停在笔画之前，或清空未描的折痕 | 墨色结束于笔画内边缘；在墨色中画折痕（8.6） |
| 射流中的奶油斑 | 一份拷贝拾取另一份的项 | 给每份拷贝加门控（8.2） |
| 深色底板的回退不可见 | `:not([data-theme="dark"])` 规则穿过浅色页面匹配 | 深色规则排最后，或以底板为键（8.5） |
| 灰色发白的回退辉光 | 苍白 token 上的不透明度 | 饱和 token；色调 multiply、苍白核心普通（8.5） |
| 热面上的灰条纹 | 半透明墨色下有间隙的 SVG 笔画 | 填充该面（8.5） |
| 光照到光源看不到的面 | 表面光没有真实遮挡体 | 使用与 SVG 相同的几何（8.3） |

## 8b. 旋转组上的着色器
在 3D 图（图示）（`references/3d.md`）中零件作为刚体组移动，所以着色器必须跟随它们。
- **锚定到零件**：`controller.anchor(group, restPoint, restDir)` 每帧给出 `{ world, screen, direction }`。把它们作为 uniform 传入。LED 就是这样骑在弯曲的指尖上、火焰留在破裂管线末端、火花源坐在关节上。
- **锚定到表面**：前置 `glslPose("Dial")`（单个组用 `GLSL_TURN`），并传入 `TURN.poseUniforms(controller, "dial", "uDial")`。然后 `vec3 q = toDial(onFloor(vb, z))` 是该表面点在组的静止世界坐标中的位置。转盘上积聚的油、光揭示的纹理和焦痕都随它转动。
- **世界空间保持世界空间。** 烟、离开源后的火花和台面上的油从不接触组变换。在锚点的世界位置发射，然后在世界中积分。
- **活动零件的遮挡。** 前景画布位于活动层之上。用在效果自身零件之后绘制的零件遮罩其墨色：`TURN.cover(controller, [partName])` → `uCoverEdge`、`uCoverCount`，然后 `ink *= 1. - coverOf(vb, .7 * px)`。遮罩是精确凸轮廓外扩 0.3 vb，使墨色停在遮挡体的笔画处。每个十条边的六个多边形。读取 `MAX_FRAGMENT_UNIFORM_VECTORS` 并把 SVG 回退保持在 128 以下。
- **活动层之间的背景画布** 不需要遮罩：把受光的表面放在它自己的活动层中，位于覆盖它的零件之下（指针下方的旋转表盘面）。
- 向量 uniform 数组（`uniform vec3 uSpark[24]`）通过 `draw` 接受 `Float32Array`。
- **活动零件上的 SVG 回退** 是 `T.billboard({ part, at, normal, svg })`。其标记以投影点为中心、使用 viewBox 像素，而不是世界单位，所以按 `G.scaleOf(P)` 缩放世界尺寸：为半径 1.1 的镜片定尺寸的辉光是 `<circle r="${(1.1 * G.scaleOf(P)).toFixed(2)}"/>`。写成 `r="1.1"`，它画出约镜片三分之一大小的针点。用 `--no-webgl` 和 4× 缩放检查。

## 9. 验证

任何会动的用 `scripts/drive.mjs`；`capture.mjs` 现在也支持 WebGL，所以拍着色器页面的静止帧没问题。用法见 `references/verify.md`。在常规清单之外：

- **跨每个过渡的接触单**：开始、每次相位变化、稳态和停止。重 WebGL 页面上的实时接触单太稀疏，因为无头捕获要 60–200 ms 并阻塞动画帧。先用 `["slow", 0.05]` 放慢页面时钟（对 `requestAnimationFrame` 和 `performance.now` 是 20× 慢放），拍接触单，然后 `["slow", 1]`。要捕捉从第一帧开始的东西，比如初次光照淡入，就给 `--preload` 传一个包含 `window.__driveSpeed=0.04` 的文件，使页面从第一帧起慢跑。用 `["until", "document.querySelector('[data-readout]').textContent.includes('main stage')", 8000]` 等待某个相位，而不是猜一个 `wait`。每张接触单前先停掉空闲巡游：其恢复计时器走挂钟，不走放慢的时钟，所以会在接触单中途把目标带走。按一次键能按住它几真实秒；对于长的放慢接触单，用 `--preload` 打桩该计时器，并先等待静止（`verify.md`，"Slow mode doesn't slow timers"）。
- **要数字，不只是图。** `canvas.getContext("webgl")` 返回页面自己的上下文。在 `requestAnimationFrame` 回调中，用 `gl.getUniform(gl.getParameter(gl.CURRENT_PROGRAM), location)` 读取 uniform，用 `gl.readPixels` 读取画布平均 RGB。回读只在与绘制相同的任务中有效，因为 `preserveDrawingBuffer` 是关的：来自单独任务的全零帧是测试假象。整个运行每帧记录一行。除故意的爆发外，色相和平均亮度在相位变化时都应单调移动。
- **边缘读作 0。** 每个相位期间回读画布最后 10 行和列。任何高于 0 的值都是会在 screen 混合下显露的切断。
- **在浅色下记录墨色，不是亮度。** 每帧记录一个区域铺在白底上的墨色，`1 − lum(rgb + 1 − a)`，钩子见 `verify.md`（"Light-theme shaders"）。对每个要紧的区域（腔体、核心、仅回退区域）在初次光照、每次相位变化和淡出时都做。墨色必须跟随物理量：光进入时升，光离开时降，无隆起无下陷。用数字说，加力燃烧室的切口窗口从 1894 降到 155，其熄灯从 154 升到 1959 并稳在 1914。
- **在浅色下沿物理斜坡探测颜色。** 对于升温或冷却的东西，在几个温度读中心和边缘像素。它们必须按暗红 → 橙 → 黄 → 接近白，边缘比中心冷，无鲑鱼色或灰色阶段。glory hole 的表从 930 °C 的 255/179/99 中心和 252/114/25 边缘，经约 620 °C 的 211/63/6 和 165/28/1，到 465 °C 的清玻璃。对于体积，读从边缘到边缘的墨色横截面：它应在轴上达峰。
- **在浅色下也检查深色路径。** 每个浅色变化都在 `uLight` 之后，所以深色构建的帧应与其基线匹配。还在浅色页面内渲染深色底板，有 WebGL 和无 WebGL 各一次（嵌套主题陷阱，第 8.5 节）。
- **效果与 SVG 相遇的每个地方拍 2× 和 4× 裁切**：边缘、唇、甲板边缘、壁带、纸角、遮挡体，以及效果透过的每个开口（它在四边都停在缘上吗，下方显出凹槽壁吗？）。寻找接缝、硬边、条带、暗领圈、双线或突然的颜色切换。在浅色下，墨色与笔画相遇处也拍 8–16× 裁切（切割面、边缘、口、折痕），寻找墨色与线之间的苍白间隙、涂过线的墨色、或被墨色清空的笔画。隐藏 front SVG 和隐藏画布各拍同一裁切比较（用 `eval` 设 `style.display="none"`）。
- **回退。** 用 `--no-webgl` 运行 `drive.mjs`（每个 `getContext("webgl")` 返回 `null`），检查 `data-gl` 不存在且仅 SVG 仍可读，两种主题都查。在浅色下，回退应显示与着色器相同的墨色和相同的暗地面，着色器绘制的每个物体都应存在。用 `--preload` 从第一帧放慢页面拍摄接触单上的初次光照：回退到着色器的交接不得下陷（第 8.5 节）。
- **减弱动态**（`--reduced`）：一帧有代表性的静止帧。
- **控制台干净。** 着色器编译错误会以来自 `onError` 的 `console.error` 到达。

## 10. 性能

- 成本大致是像素 × 采样。Raptor 每画布运行 28 个体积采样（每个带四个激波单元项）、一次 28 步地面搜索加 7 次二分、一个 8 采样光晕、一道 10 采样飞溅帘和 6 个蒸汽采样，设备比最高 1.5×。它在 SwiftShader 中能跑，但其帧时间未在真实 GPU 上测量。发布更重的东西前，在真实浏览器的 Performance 面板中测量，如果太慢，先减采样，再减 `maxRatio`。
- ripple tank 的纸面着色器每像素求值双源场四次（折射位移一次，焦散定点反演三次），每个源读取其历史六次纹理，而不是 24 步 uniform 循环。在笔记本 GPU 上测得每次绘制约 1 ms；手机开销未测。
- 知道你测的是哪块 GPU。`drive.mjs` 和 `capture.mjs` 中的无头 Chrome 能用时用真实 GPU，否则用 SwiftShader；在相信帧时间前记录 `gl.getParameter(gl.RENDERER)`。
- 只在要紧处花采样。界定步进（圆柱或盒），从地面命中开始，用 uniform 给整项加门控。
- 两个画布花费两次全屏通道。清空没有内容可显示的那个（Raptor 的面纱只在蒸汽、水汽或激波存在时绘制）。
- 如果场中没有东西需要，就不要动画 `uTime`。ripple tank 传 `draw(values, 0)`，只移动波相位，使减弱动态的帧真正静止。
- 空闲时停止循环。什么都没发生却保持 60 fps 的着色器页面是 bug。
