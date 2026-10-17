# 工具库（Kit）API

所有内容都在 `kit/iso-kit.ts` 中，`kit/iso-kit.mjs` 提供相同的 API。世界坐标为 `[x, y, z]`，其中 x 和 y 位于地面上，z 向上，单位约为 1 px。屏幕坐标为 SVG viewBox 中的 `[sx, sy]`。路径以 SVG `d` 字符串返回，并四舍五入到 0.1。

## 目录
1. 类型
2. 相机
3. 实体
4. 面上的线条
5. 零件库
6. 移动物体
7. SVG 字符串（无框架）
8. 卡片与页面
9. React 组件
10. 任意轴上的回转零件（`kit/lathe.mjs`）
11. 管道、管件与线缆（`kit/tube.mjs`）
12. 审计（audit）（`kit/audit.mjs`）
13. WebGL 层（`kit/gl.mjs`）
14. 工具
15. 旋转组（`kit/turn.mjs`、`turn-build.mjs`、`turn-audit.mjs`）

## 1. 类型
```ts
type Flat = [number, number];            // screen point
type Point3 = [number, number, number];  // world point
type Plane = [number, number];           // floor point (x, y)
interface Plan { x: number; y: number; w: number; d: number; r: number }   // rounded rectangle on the floor
interface Projection { origin: Flat; scale: number; azimuth?: number; elevation?: number }
interface SolidPaths { fill; outline; crease; top; shades: string[4]; bevel?; seamless? }
type Tone = "hi" | "mid" | "lo" | "faint";
type LineTone = Tone | "lit" | "red" | "green" | "blue";
```

## 2. 相机
| 函数 | 功能 |
|---|---|
| `fitProjection(points: Point3[], width, height, { pad = 24, headroom = 0, azimuth = 45, elevation = 30 })` | 一个将这些点居中并适配到 viewBox 中的投影。传入每一个极值点，例如 `boxCorners(plan, z0, z1)` 和最高的尖端。 |
| `iso(point, P)` | 世界坐标转屏幕坐标。 |
| `depthOf(point, P)` | 值越大表示离观察者越近。升序排序即可由后向前绘制。 |
| `towardViewer(P)` | 指向观察者的地面方向，`[cos a, sin a]`。法线指向该方向的面是可见的。 |
| `screenRise(h, P)` | 高度 `h` 覆盖多少个屏幕像素。 |
| `cameraOf(P)` | 原始的正弦与余弦值。 |

## 3. 实体
所有实体都是棱柱：一个地面轮廓直接向上挤出。

| 函数 | 功能 |
|---|---|
| `slabOf(plan, z, h, P, steps = 8, bevel = 0)` | 一个圆角盒子。`steps` 是每个角的点数（小零件 2–4，大圆角件 8–10）。`bevel`（0.3–1.6）在顶部沿可见边添加一条内缩的高光线，延伸至轮廓角。 |
| `cylinder(cx, cy, r, z, h, P, steps = 32, bevel = 0)` | 圆形立柱、圆盘、支脚、旋钮或垫块。小件用 16–20 步，大圆盘用 56–72 步。 |
| `extrude(ring: Plane[], z, h, P, { convex = true, bevel })` | 任意地面轮廓。对于凹轮廓传入 `convex: false`（填充变为面而非包络）。 |
| `ringOf(plan, steps)` | 以点表示的圆角矩形轮廓。 |
| `roundedPlan(plan, steps)` | 同上。 |
| `circleRing(cx, cy, r, steps)` | 以点表示的圆形轮廓。 |
| `insetPlan(plan, by)` | 缩小一个 plan（`by` 取负值可放大）。保持半径合理。 |
| `corners(plan, inset)` | 从角部内缩的四个地面点，用于支脚和螺钉。 |
| `boxCorners(plan, z0, z1)` | 八个角，用于 `fitProjection`。 |
| `haloOf(plan, z, h, P)` | 柔和阴影的填充路径：`<path class="iso-halo" d=…>`。 |

`SolidPaths` 包含的内容：
- `fill`：纸色，遮挡其后方的一切。
- `shades[0..3]`：可见侧面，按受光方式分桶。
- `top`：顶面，颜色更浅。
- `crease`：顶面与可见侧面的交界。
- `bevel`：可选。
- `outline`：轮廓。

`solidSvg` 和 `<Solid>` 按该顺序绘制它们。

## 4. 面上的线条
| 函数 | 绘制内容 |
|---|---|
| `onTop(points: Plane[], z, P, closed?)` | 水平面上的一条折线。 |
| `lineOnTop(a, b, z, P)` | 水平面上的一条线段。 |
| `planOutline(plan, z, P, steps)` | 面上的圆角矩形轮廓，用于凹槽与镶嵌（`insetPlan`）。 |
| `ring(cx, cy, r, z, P, steps)` | 面上的圆，用于螺钉环、表圈与座圈。 |
| `segment(a, b, P)` | 任意 3D 线段。 |
| `rise(at, z0, z1, P)` | 垂直的线段。 |
| `pointsAt(points, P)` | 投影一系列点，用于螺钉和铆钉点。 |
| `dotGrid(x, y, cols, rows, gap, z, P)` | 投影的穿孔。 |
| `topMatrix(at, z, P, along = "x")` | 将文本平铺在顶面上的变换，用于 `faceTextSvg`/`FaceText`。 |
| `sideMatrix(at, z, P, "left" \| "right")` | 同上，用于垂直面。 |

## 5. 零件库
| 函数 | 返回 |
|---|---|
| `knurl(cx, cy, r, z0, z1, count, P, inset = 0.4)` | 圆柱可见半边上的垂直线。 |
| `sideArc(cx, cy, r, z, P, steps)` | 圆柱侧面上水平圆的可见前半部分：接缝与环带。 |
| `sideSeam(plan, z, P, steps = 8)` | 盒子的同类物：高度 `z` 处圆角 plan 的可见近侧半边，绕过其角部并精确终止于 slab 的垂直轮廓边。传入 slab 自身的 `steps`，并将其作为 slab 的 `inner` 绘制。这是在盒子上绘制焊珠、环带、盖缝或饰线的方式：绝不要用从角部内缩的 `segment`。 |
| `ringSeam(ring, z, P)` | 用于任意地面轮廓（即传给 `extrude` 的 ring）的 `sideSeam`。 |
| `sideRing(center: Point3, r, "x" \| "y", P)` | 垂直面上的圆：孔、杆端、镜片。 |
| `coil(from, to, [cy, cz], r, turns, "x" \| "y", P)` | `{ back, front }` 两个弹簧半边，从而可以按 后 → 杆 → 前 的顺序绘制。 |
| `topTicks(from, to, step, every, edge, z, [minor, major], P, axis)` | 顶面上的 `{ minor, major }` 标尺刻度，自线 `edge` 向 +y（或 +x）生长。 |
| `sideTicks(from, to, step, every, face, top, [minor, major], P, axis)` | 沿垂直面向下垂落的刻度。 |
| `radialTicks(cx, cy, r, count, every, z, [minor, major], P, from = 0, span = 2π)` | 表盘与转台刻度。角度 0 指向 −y，从上方看顺时针递增。 |

## 6. 移动物体
| 函数 | 功能 |
|---|---|
| `translateAlong(P, [dx, dy, dz])` | 一个 `"translate(x y)"` 字符串，按世界偏移量移动一个预建的组。用于滑架、抽屉、柱塞与升降装置。 |
| `holdStill(element, [dx, dy])` | 为 `element` 内每个 `[data-hold]` 元素赋予相反的平移，使剪辑在其所在的组按 `[dx, dy]` 屏幕单位移动期间保持原位。每当移动一个持有 `G.rodOut` 剪辑的物体时，都以相同的偏移量调用它。 |
| `axisVector(P, [1, 0, 0])` | 一个世界单位在屏幕上的向量。用它把指针移动转换为世界移动。 |

绕 z 轴的旋转无法通过屏幕变换完成：为每一帧或每一步重新构建旋转路径。这对于指针、指示器或小零件而言开销很小。

## 7. SVG 字符串（无框架）
| 函数 | 说明 |
|---|---|
| `solidSvg(paths, { tone = "hi", crease = "faint", halo, lit, flat, className, inner })` | 当设置了 `paths.seamless`（平滑车削着色，`sphereOf`）时，该组获得 `data-seamless`，且 `ISO_CSS` 以各自的颜色、0.4 宽度描边每个色调区域，使众多相邻的色调片不显露发丝接缝。`inner` 是刚好置于轮廓（`iso-edge`）之前的额外线条标记，用于必须位于轮廓描边之下的接缝、焊缝与环带线；React 的 `Solid` 将其作为 prop 接收。 |
| `lineSvg(d, { tone = "lo", dotted, dashed, flow, className, free })` | `flow` 使虚线产生动画；用于沿路径移动的物体。`free: true`（或 `"start"`、`"end"`）写入 `data-free`，告知 `scripts/lines.mjs` 某一端意在止于裸露的面上：代表印刷文字的标尺线、指针的尾端、指示器的尖端。其余所有线端都必须落在某个物体上。 |
| `dotsSvg(points, { size = 0.5, tone = "mid", pulse })` | 一个点可以携带第三个值，即其不透明度（`[x, y, 0.4]`），这正是 `dotsOf(..., { fade })` 使螺栓圆逐渐淡出而非骤然停止的方式。 |
| `fadedSvg(list, style)` | 绘制一组各带不透明度的线条，`[{ d, alpha }]` 或 `[d, alpha]`，如 `ribsOf(..., { fade })` 所返回。线条按 0.05 的不透明度步长分组，每组置于一个 `<g opacity>` 中，低于 0.02 的线条被丢弃。用于其成员朝边缘逐一淡出的任何纹理：肋、鳍、滚花、标尺线。 |
| `fadeLineSvg(points, { fade = [start, end], tone = "lo", className, stops = 6 })` | 一条（屏幕点）线，在其前 `start` 与后 `end` 像素内淡出，而非骤然停止（每段斜坡在其淡化端携带 `data-free`，从而通过线端检查）。每段斜坡沿其自身的弦以 `userSpaceOnUse` 线性渐变描边（在 `stops` 步内的平滑步进，颜色取自 `var(--anatomy-<tone>)`，从而浅色与深色主题均适用），中间部分则是普通的 `lineSvg`，因而没有重叠的线帽、圆点或接缝。用于终止于面中间的纹理线：中途消失的凹槽、在角前停止的焊缝、曲面板上的标尺线。保持斜坡短于该线的四分之一圈，因为线性渐变沿弦方向。渐变 id 是路径的哈希，因此同一条线绘制两次共享同一个。 |
| `wireSvg(from, to, { via = [], tone = "lo", dotted, dashed, flow, ends: "both" \| "from" \| "to" \| "none", size = 1.2 })` | 带终端点的连接器。 |
| `faceTextSvg(transform, text, { size = 3, tone = "mid", anchor })` | |
| `groupSvg(children, { class, transform, "data-part": … })` | |
| `figureSvg({ width, height, label, body, standalone: false \| "dark" \| "light", className })` | `<svg>`。`label` 是无障碍描述：说明物体是什么以及它展示什么。`className` 会追加到其 class 中，这在将其叠放于画布之下时很有用（`rt-back`、`rp-back`）。 |

## 8. 卡片与页面
| 函数 | 说明 |
|---|---|
| `plateHtml({ fig, title, hint, readout, keys: [{ mark, label }], caption, body })` | 卡片。`mark` 为 `raised`、`flat`、`lit`、`edge`、`dim`、`dotted`、`dashed`、`red`、`green`、`blue` 之一。读数元素携带 `data-readout`，因此实时代码可向其写入。 |
| `pageHtml({ title, theme = "dark", body, script, width = 650 })` | 一个内联了 `ISO_CSS` 的独立文档。 |
| `kitScript()` | 来自 `scripts/inline-kit.mjs`。将其前置到 `script`，使页面在动画期间能够调用 kit 函数，如 `lineOnTop` 与 `translateAlong`。 |
| `glScript()` | 来自 `scripts/inline-kit.mjs`。`kit/gl.mjs` 的源代码（`GLSL_ISO`、`glCamera`、`glLayer`、`smooth`、`burst`、`settle`），用于在带着色器的页面中内联于 `kitScript()` 之后：`script: kitScript() + glScript() + live`。它不依赖 kit，因此实时代码不调用任何 kit 函数的页面可以单独内联它（Raptor 使用 `glScript() + LIVE`）。一切皆为单一模块脚本，因此实时代码不得重新声明 `smooth`、`burst` 或 `settle`：第二个 `const smooth` 是会导致页面失效的 SyntaxError。 |
| `turnScript()` | 来自 `scripts/inline-kit.mjs`。带实时代码的页面所用的 3D 运行时（`TURN`、`TURN_CSS`），已剥离 `export`：`script: turnScript() + glScript() + live`。其内部以 `t3`/`T3_` 为前缀，因此可与 kit 和 WebGL 层并排内联。 |
| `ISO_CSS` | 所有样式。`kit/iso.css` 为相同的文本。 |

## 9. React 组件
来自 `kit-react/draw.tsx`，它是服务端安全的：

- `<Solid paths tone crease halo lit flat className inner />`（`inner` 是置于轮廓之下的线条标记，与 `solidSvg` 相同）
- `<Line d tone dotted dashed flow free />`
- `<Wire from to via tone dotted dashed flow ends size />`
- `<Dots points size tone pulse />`（一个点可携带不透明度 `[x, y, alpha]`，与 `dotsSvg` 相同）
- `<FaceText transform size tone anchor>text</FaceText>`
- `<IsoFigure width height label>` …svg 子节点… `</IsoFigure>`
- `<Plate fig title hint readout keys caption>` …图示… `</Plate>`

来自 `kit-react/live.tsx`，它是 `"use client"`：

- `useReadout()` 返回 `{ anchor, say }`。将 `anchor` 置于根元素上；`say(text)` 写入卡片的读数。
- `useLoop(tick: (dt, calm) => keepGoing, running)` 在 `running` 期间且 `tick` 返回 true 时运行一个帧循环。它返回 `kick()` 以重新启动。
- `follow(current, target, dt, seconds, calm)` 是指数缓动。
- `spring(state, target, dt, stiffness, damping, calm)` 是子步进的弹簧。稳定时返回 true。
- `useEased(target, seconds)` 以 React 状态返回缓动后的数值。适用于小图示。
- `useInView(ref)`、`useStillness()`、`asksForStillness()`。
- `Stage` 是 `IsoFigure` 使用的包装器。它为 CSS 动画添加 `data-inview`。

## 10. 任意轴上的回转零件（`kit/lathe.mjs`）
`kit/iso-kit.mjs` 构建立于地面的棱柱。`kit/lathe.mjs` 绕**任意**轴回转一个轮廓，用于钟形件、腔体、法兰、阀门体、泵蜗壳、管件、倾斜放置的作动器，以及垂直面上的连接器。它返回与 `slabOf` 相同的 `SolidPaths`，因此 `solidSvg` 可以绘制它们。导入方式为 `import * as G from "../../kit/lathe.mjs"`。

**坐标系。** 一个坐标系（frame）是 `{ o, a, u, v }`：一个原点、单位轴和两个单位径向方向。零件上的一点为 `(s, r, angle)`：`s` 为自 `o` 沿轴的距离，`r` 为到轴的距离，`angle` 为自 `u` 转向 `v` 的角度。

| 函数 | 功能 |
|---|---|
| `frameAlong(o, a)` | 过 `o` 沿轴 `a` 的坐标系，`u` 与 `v` 由系统选取。用于任意角度的管道、凸台与法兰。 |
| `frameOf(o, a, u, v)` | 具有显式径向方向的坐标系，从而使角度具有含义：`G.frameOf([0, 0, z], [0, 0, 1], [1, 0, 0], [0, 1, 0])` 使角度 0 指向 +x。 |
| `pointOf(F, s, r, angle)` | 世界坐标点。 |
| `radialOf(F, angle)`、`tangentOf(F, angle)`、`angleToward(F, direction)` | 坐标系中的方向，以及朝向某方向的角度。 |

**实体。** 子午线是沿轴排列的 `[s, r]` 点列表。添加第三个元素（`[s, r, 1]`）以标记平滑环，从而不在该处绘制折线。将其用于钟形件或穹顶等弯曲轮廓。任何含平滑顶点的子午线都会自行平滑着色（`smooth` 默认为 `"auto"`，即 `softOf(meridian)`）；传入 `smooth: false` 可退出，传入 `true` 或 `{ rows }` 可在不含平滑顶点的轮廓上强制启用，传入 `{ slope }` 或 `{ slope, radius }` 用于解析曲线。

**平滑着色。** 没有它时，每一小面行只获得一个平坦色调，弯曲轮廓会呈现出色调块的阶梯（最早的 Raptor 钟形件与喉部正是如此，审阅者一眼便看出）。使用 `smooth` 时，每个子午线段的一侧依据插值法线着色：色调边界成为真实的等轴测光照曲线，按 `rows` 个层级采样并为每个色调区域生成一个多边形，从而以干净的曲线贯穿整个零件。
- `smooth: true` 以单调三次 Hermite 曲线（Fritsch–Carlson 斜率：轮廓转折处为零，其余位置为加权调和平均）插值每一段平滑顶点（`[s, r, 1]`），并将该单一曲线用于法线、色调片、轮廓与包络，重采样直至其与弦的偏差在 0.2 px 以内。此时着色与轮廓描述同一形状，且法线只可能在轮廓改变符号之处改变符号。将其用于任何含平滑顶点的轮廓：穹顶、喉部、锥体、阀门凸起、火焰锥。（自然样条在峰值附近会过冲；在阀门凸起上，它使色调带在体上锯齿形穿行。）
- `smooth: { slope }` 从解析的 `dr/ds` 取得法线，因此被切分为环带的身体共享同一法线场，色调曲线无台阶地跨过环带接缝。仅使用 `slope` 时轮廓点以直线相连，因此需密集采样解析的 `r(s)`（喉部取 20–30 个节点），且收腰身体的轮廓使用同一 `slope`，从而轮廓也遵循真实曲线。
- `smooth: { slope, radius }` 还从解析的 `r(s)` 取得曲面：色调片、包络与轮廓在节点之间都遵循 `radius`，因此两个节点足以构成一个环带。这正是 `bandsOf` 传递给每个环带的内容。
- **手工键入的节点不是曲线。** 单调 Hermite 仅为 C1：其 `dr/ds` 是分段二次函数，在每个节点处趋于平缓并在节点之间过冲，因此色调带会停滞继而突进，形成扇贝状的阶梯。Raptor 喉部（`[128, 31, 1], [134, 27.6, 1], …`）在 5 倍放大下暴露了此问题。任何大于接头的弯曲体都应获得解析轮廓与 `smooth: { slope }`：喉部为 `r = √(24.2² + (c·(s − 146))²)`，火焰锥为 `r = 48·(1 − x)^0.8` 并在尖端闭合至 `r = 0`，阀门凸起为椭圆，万向节压盘为 `18.4 − a·|s − 297.5|⁴`。审计的 `wobble` 列出每一个未带 `slope` 平滑而其 `dr/ds` 在两端之间发生转折的轮廓。
- `rows`（默认 6）是沿每一段的起始采样数。随后各行不断细分，直至每个色调边界与直线弦的偏差在 `error`（0.35 px）以内，并在带数变化处细分至 `depth`（8）个层级或屏幕上的 `fineness`（0.1 px），以先到者为准，从而一个出现或消失的带以零宽度生于细条之中，而非终结于一次直线切割。随后每个色调在其自身区域数保持不变的范围内作为一个多边形发射，横跨身体的每个子午线段与平滑节点，且仅在其数量变化之处桥接该色调；一个时隐时现的带不再会把其他色调切割成行。这使一个小车削球体的体积约减半，并消除了行接缝。可见性使用所绘制小面的法线，因此色调总能到达轮廓；每个色调多边形的绕向一致，因此同一色调的重叠部分绝不会抵消成一个孔。
- 结果被标记为 `seamless`（参见 `solidSvg`）。平盖（`s` 不变的环）保留其小面着色。

| 函数 | 功能 |
|---|---|
| `lathe(meridian, F, P, { steps = stepsFor(rMax, 32, 160, scaleOf(P)), fill = "auto", hole = null, bevel = 0, rims = "all", smooth = "auto", waist = 0.5 })` | 通用的回转体。小面按 kit 的光源以四种色调着色，并如 `extrude` 般分桶。`fill: "auto"` 使用各环的包络，除非真实轮廓落入其内侧超过 `waist` px（喉部、纺锤体），此时以 `silhouettePoints` 在两侧填充并勾勒身体，由可见的端弧连接（仅当轮廓沿整侧不间断时：表面某处正对观察者的身体——如以直角脱离颈部的阀门凸起——回退至包络，因为连接断裂的片段会横穿过它绘出杂散三角形）；`"surface"` 强制采用该方式，`"hull"` 强制使用包络；`fill: "facets"` 仅填充可见小面且不绘制轮廓，从内部观察凹形或开放形状时需要它。`hole: [s, r]` 在填充与轮廓中切出一个圆孔，用于管件的端部。`bevel` 自闭合盖（子午线终止于 `r = 0` 处）起添加内缩高光。`rims` 保留端环上的轮廓：`"all"`、`"none"`、`"first"`、`"last"` 或 `"ends"`。仅丢弃沿第一个或最后一个环的包络边；沿内部环的边始终保留，因此侧轮廓保持完整。 |
| `solidOf(profile, F, P, options)` | 在两端将轮廓闭合至轴，并从最大半径选取 `steps`。这是制作车削体的常用方式：`G.solidOf([[0, 12], [6, 12], [8, 9, 1], [20, 9]], F, P)`。 |
| `bandOfProfile(profile, F, P, options)` | 无盖的开放环带，用于被切分为按深度排序之片段的长身体中的一段。优先使用 `bandsOf`，它一次切分整个身体。 |
| `bandsOf(profile, cuts, F, P, { slope, radius, steps, rows = 6, rims = "none", fill = "auto", samples = 72 })` | 一个弯曲的身体（`s` 沿 `profile` 上升）在 `cuts` 中的 `s` 值处被切分为可深度排序的环带，这些环带共享一个法线场、一个曲面和一个小面数。传入解析的 `slope` 和 `radius`，或两者都不传：此时 `profileCurve(profile)` 从轮廓生成它们（每段平滑节点间的单调 Hermite，其他位置为直线），从而任何环带都不会有自己的端部斜率。返回 `{ bands, sidesOf, radius, slope, steps, s0, s1 }`。每个环带为 `{ s0, s1, profile, paths, outline, seam }`：`paths` 已清除轮廓，可直接用于 `solidSvg`；`outline` 是环带自身的弦轮廓，需要时使用（Raptor 裙板的最后一个环带保留了它）；`seam` 是它与下一个环带相接的可见弧（放入 `inner`）；`profile` 是记录到审计所需的内容（`A.solid(F, band.profile, { radius })`）。`sidesOf(from = s0, to = s1, { ends = false \| true \| "first" \| "last", count = samples })` 返回 `{ d, points }`：身体在该跨度上的两条解析侧边合为一条路径，可选附带其端部的可见轮缘弧，以及要记录的 3D 点（`points.map((list) => A.tube(list, 0.4 / scale))`）。将 `d` 作为一个条目以较小的深度偏置绘制在环带之上，使轮廓成为一条连续的曲线。 |
| `profileCurve(profile, { slope, radius })` | `{ s0, s1, radius(s), slope(s) }`，用于 `s` 上升的轮廓：即 `smooth` 所绘制的曲线。若 `s` 不上升则抛出异常，因为轮廓中的台阶是折线，应属于独立的实体。 |
| `outlineOf(meridian, F, P, { steps, fill, hole, rims, smooth, waist })` | 仅 `lathe` 的 `fill` 与 `outline`，不含着色，用于自行绘制轮廓的身体。 |
| `softOf(meridian)` | 任一顶点被标记为平滑时为真。 |
| `disc(s0, s1, r, F, P, options)` | 轴上的短圆柱：压盘、法兰、凸台、销、塞。 |
| `ringBand(s0, s1, rIn, rOut, F, P, options)` | 带厚度的环形：某物周围的法兰或轴环。 |
| `stepsFor(radius, least = 16, most = 112, scale = 0)` | 小面数。配合 `scale`（每世界单位的屏幕像素数，`scaleOf(P)`），它使每个小面在屏幕上约 3 px 长；未传 `steps` 时，`disc`、`ringBand`、`solidOf`、`bandOfProfile` 与 `lathe` 采用该值（32–160）。小面只决定色调填充：轮廓、轮缘、折线与倒角自真实圆按约 1.5 px 采样，并在面背离之处精确终止。 |
| `saddleOf(F, a, start, s1, P, { steps })` | 鞍座垫：半径 `a` 的圆柱沿 `F.a` 自弯曲的主体表面延伸至 `s1` 处的平面。`start(angle)` 是各条母线离开主体的位置（通过对主体的 `sdf` 二分查找求得），或对垂直于 `F.a` 的主体圆柱取一个数值 `R`（此时 `saddleStart(R, a, angle)` 给出各条母线的起点）。填充是其可见小面与面的并集，轮廓是其两条侧母线、鞍座曲线的可见部分与面轮缘，从而沿真实交线与主体相接。凡平坦法兰置于弯曲身体上会留下轮缘间隙之处，都把座法兰安于其上。 |
| `prismOf(F, polygon, s0, s1, P)` 和 `stadium(r0, r1, offset)` | 坐标系 `u`、`v` 平面内任意凸 `[x, y]` 多边形沿 `F.a` 挤出的棱柱，带小面色调，以包络作为填充与轮廓，折线仅出现于尖角处。`stadium` 是两个圆的包络，用于连接电机与作动器的变速箱板。 |
| `sphereOf(centre, r, P, { steps = 48 })` | 具有精确平滑色调的球：每个色调区域是球冠的投影包络，因此只需四个小多边形，而非车削轮廓。用于杆端轴承、三通接头与旋钮。它是 `seamless` 的。 |
| `silhouettePoints(profile, F, P, { samples = 72, slope, radius })` | `silhouetteOf` 的两条侧边，以 3D 点列表形式，用于向审计记录轮廓的形状。 |
| `silhouetteOf(profile, F, P, { samples = 72, slope, radius })` | 通过 `profile`（`[s, r]` 点，线性插值）的回转面的两条解析侧边，合为由两条折线组成的一条路径：即表面背离观察者的位置（`cos(θ − φ) = r′·aV/|V⊥|`）。用于在以环带构建的身体上绘制一条连续轮廓。表面正对观察者之处（`|c| > 1`）跳过采样。传入解析的 `slope`（与环带着色所用相同），使该边不在每个轮廓点处折曲。 |

**回转面上的线条与点。** 这些只绘制朝向观察者的部分。`slope` 是曲面上该环处的 `dr/ds`，因此锥体或钟形件上的线会在真实表面背离之处隐藏。

| 函数 | 功能 |
|---|---|
| `arcOf(F, s, r, P, { slope = 0, steps, least = 0.02, inward = false, from = 0, to = 2π, trim = 0.3 })` | 曲面上环的可见弧：接缝、环带、焊缝、凸缘。边缘角被精确求解（`t = φ ± acos(c)`），每个止于边缘的末端缩短 `trim` px，使其圆头保持在轮廓描边之内。`inward: true` 绘制内表面（如喷嘴内部）上可见的弧。`least: -1` 给出整个环。将接缝绘制在轮廓*之下*：`solidSvg(paths, { inner: lineSvg(arcOf(…), { tone: "faint" }) })`。附加在实体之后，一个微弱的接缝端点会涂覆在边描边之上，并在每个接缝处啃咬轮廓。 |
| `circleOf(F, s, r, P, steps)` | 完整的闭合圆，如面环、孔或要填充的空洞。 |
| `ribsOf(F, s0, s1, r, count, P, { phase, twist, least = 0.12, r1 = r, fade, seams })` | 可见的轴向线：沿任意轴的滚花、肋或鳍。`twist` 使其呈螺旋状，`r1` 使其沿锥体延伸。配合 `fade: [lo, hi]` 返回 `[{ d, alpha }]`，每条肋的不透明度是其朝向观察者程度的平滑步进，从而整组朝转折处淡出，而非在 `least` 处停止。用 `fadedSvg` 绘制它们。`seams: true`（或 `"first"`、`"last"`）将 `s0` 与 `s1` 处的接缝弧加入结果（全不透明度），从而一排肋与其终止处的接缝始终共享同一个 `s`；仅在肋终止于已绘制的台阶或环带端部之处才将其省略。 |
| `rodOut(F, from, to, r, P, { stroke, ...latheOptions })` | 自 `s = from` 处的压盖滑出的杆（`F.a` 指向其外方），其尖端静止时位于 `to`，可再向外行进至多 `stroke`，或同一根杆缩回其中。返回 `{ paths, clip, from, to, stroke, reach }`：`paths` 是从 `from − stroke` 到 `to` 的一根杆，`clip` 是覆盖自压盖面至 `to + stroke` 之杆的路径。绘制 `<clipPath id><path data-hold d=clip/></clipPath><g clip-path=url(#id)>solidSvg(paths)</g>`，移动该物体，调用 `holdStill`，并记录 `A.slide(F, from, to, r)`（`craft.md` 第 3 节）。 |
| `spokesOf(F, s, r0, r1, count, P, { phase, sweep, from, to })` | 面上的径向线，用于叶片与涡轮叶片。 |
| `dotsOf(F, s, r, count, P, { phase, slope, least = 0.08, all = false, fade })` | 可见侧螺栓圆的屏幕点。将它们传给 `dotsSvg`。对正对观察者的面使用 `all: true`。远高于 0 的 `least` 会使圆在曲面中间停止；改为传入 `fade: [0.04, 0.42]`，这些点便携带递减的不透明度。 |
| `fadeOf(value, [lo, hi])` | 两种淡化共用的平滑步进。 |
| `facingOf(F, angle, P, slope)` | 该角度处的曲面朝向观察者的程度。正值表示可见。 |

**3D 路径**，用于管道与线缆。

| 函数 | 功能 |
|---|---|
| `fillet(points, radius, perArc = 7, { P, tube, margin = 1.3 })` | 以 `radius` 的弯曲倒圆折线的每个角，并限制在可用空间之内（较短边的 0.48）。将管道布设为若干直段，然后对其倒圆。配合 `P` 与 `tube`（管道半径），每个角的弯曲增大到 `margin · tube / (0.7 · f²)`，其中 `f = |n · V|` 表示弯曲平面正对观察者的程度：侧视的弯曲投影为半径 `R·f²`，低于管道自身半径时轮廓会自身折回。直段仍为其封端，因此紧邻正对观察者之接口的转弯需要长直段或一个弯头接头。 |
| `resample(points, spacing)`、`pathLength(points)`、`cut(points, from, to)` | 均匀间距、总长度，以及按弧长截取的子路径。 |
| `pointAlong(points, at)`、`tangentAlong(points, at)` | 某一弧长处的位置与方向。用它们在路线上安放法兰、环带、阀门与卡箍。 |
| `spiral(F, s, r0, r1, a0, a1, steps = 28)` | 渐扩螺旋的 3D 点，如泵蜗壳。将它们连同半径函数一并喂给 `tubePieces`。 |
| `arcPoints(F, s, r, a0, a1, steps = 24)` | 绕环的 3D 点，如歧管、灭火环或线束通道。 |

**相机与向量。**
- `viewOf(P)` 是指向观察者的单位方向，因此 `dot3(p, viewOf(P))` 等于 `depthOf(p, P)`。
- `lightOf(P)` 是 kit 的光源。
- `scaleOf(P)` 是每个世界单位对应的屏幕单位数。
- `toneOf(normal, P)` 与 `bandOf(score)` 给出四色调分桶。
- `hullOf(points)` 与 `runsOf(flags)` 是该模块自用的包络与段辅助函数。
- 向量辅助函数有 `dot3`、`add3`、`sub3`、`mul3`、`len3`、`unit3`、`cross3` 与 `lerp3`。

**以环带构建的长弯曲身体。** 用 `bandsOf` 切分它，使每个环带能与缠绕它的管道进行深度排序。每个环带共享身体的 `steps`、其法线场与其曲面，从而色调曲线无台阶地跨过每个接缝，且轮廓来自 `sidesOf` 的一条曲线，而非每个环带各一条在每个接缝处折曲的弦。Raptor 钟形件：
```js
const BELL = G.bandsOf([[3.2, bell(3.2)], [116, bell(116)]], [14, 28, 44, 60, 76, 92, 106], ENGINE, P, { radius: bell, slope: bellSlope, steps: 96, rows: 8 });
BELL.bands.forEach((band, index) => put("nozzle", ex(ENGINE, (band.s0 + band.s1) / 2), S(band.paths, { tone: "hi", inner: index === 2 ? Ln(band.seam, { tone: "faint" }) : "" }), { shapes: [record(A.solid(ENGINE, band.profile, { radius: bell }))] }));
const SIDES = BELL.sidesOf(3.2, 106, { ends: "first" });
put("nozzle", ex(ENGINE, 105), Ln(SIDES.d, { tone: "hi" }), { bias: 0.2, shapes: SIDES.points.map((points) => A.tube(points, 0.4 / KS)) });
```
不要在两节点弦上以各自 Hermite 拟合的多次单独 `bandOfProfile` 调用手工构建环带：这样每个环带都会有自己的端部斜率，其色调在每个接缝处出现台阶，其弦轮廓也会折曲。

**已知陷阱。**
- 当身体未平滑时，**四色调量化沿每一小面行的斜率**进行。将每个弯曲节点标记为平滑（`[s, r, 1]`），着色便会自行跟上；由硬节点构成但仍描述一条曲线的轮廓需要 `smooth: true`。对切分为环带的身体使用 `bandsOf`。
- **平滑着色开销更大。** 一个带 `smooth` 的小车削球体约耗 9 KB；`sphereOf` 不到 3 KB。球体用 `sphereOf`，小零件保持较低的 `rows`。

## 11. 管道、管件与线缆（`kit/tube.mjs`）
```js
import { tubePieces, tubeSvg, runsOf, crossingsOf } from "../../kit/tube.mjs";
```
| 函数 | 功能 |
|---|---|
| `tubePieces(points3, radius, P, { maxLength = 30, spacing = 2.2, closed = false, breaks = [], gaps = [], caps = true, stripes = "auto" })` | 将一条 3D 路线切分为最多 `maxLength` 世界单位的块。每一块绘制为一条 2D 带，包含纸色主体、朝光的亮带、背光的暗带和两条边线。相邻块重叠 0.5 单位，边线从与主体相同的重叠跨度上截取，从而接缝处既不显示接缝也不显示轮廓上的缺口。亮带和暗带在每个开口端比主体多延伸 0.5，从而一条条纹覆盖其下方主体的抗锯齿切口，且其自身的切口落在邻块完全相同的条纹上；每一帧的法线是沿整条路线的中心差分，从而两块条纹在重叠处完全一致（两者在同一直线上截断时，每处接缝都会有一根发丝线划过蜗壳的暗带）。`radius` 是数值或 `t`（沿路线 0 到 1）的函数，用于锥形与蜗壳。`breaks` 是块必须结束的弧长位置（在交叉处，或管道折回过零件之处）。`gaps` 是被跳过的 `[from, to]` 弧长跨度，因为套环、卡箍、阀门或接头覆盖它们；管道在间隙每一侧平切。紧邻间隙的每个端部获得一个椭圆盖（投影的截面，其外侧半弧作为一条边），路线自身的两个端部也是如此，除非传入 `caps: false`（或 `[start, end]`，例如起点隐藏在三通套环内的支管用 `[false, true]`），从而管道沿正确的曲线与法兰面接触，而不是一条直切。亮暗条纹随盖延伸：端面背对时延伸到椭圆的外半部，端面正对时直到其内缘（绘制为一条边），从而没有条纹在端部前停止。无间隙的闭合路线将其首尾两块相互环绕。返回 `[{ mid, body, shine, shade, edges, wide, points, radii, ends, from, to }]`：`mid` 是块在世界空间中的中心，用于深度排序；当路线在屏幕上足够宽以容纳其亮带与暗带时 `wide` 为真（从路线最宽处为整条路线一次性决定，从而锥形不会在某一接块处丢失条纹；`stripes: true` 或 `false` 可覆盖它）；`points` 和 `radii` 是块的 3D 中心线和半径（为审计记录它们）；`ends` 指明哪些端部是真实端部而非与邻块的接缝。 |
| `tubeSvg(piece, { tone = "hi" })` | 单个块作为 `<g class="tb">`。亮带与暗带仅出现在 `wide` 块上，随后是该块的环（`.tb-ring`），再是边线。 |
| `tubePieces(…, { rings: { pitch = 3, twist = 0, cross = false, fade = [0.1, 0.55], phase = 0, steps = 16, tone = "lo" } })` | 一种跟随管道截面的纹理：编织、波纹、缠带或铠装。站位自路线起点起每 `pitch` 单位 3D 弧长分布一处（`phase` 使其偏移），从而图案在每个块的接缝处保持连续；每处绘制为该处截面的可见前弧，切分为短段，其不透明度为 `fadeOf(facing, fade)`，从而纹理朝两个边缘淡出，而非终结于一条硬线。`twist`（以半径为单位）将每个环变为一条螺旋线，使其自边缘至边缘推进相应距离，`cross: true` 添加另一旋向以形成编织。环跨越每个块的条纹外伸部分，从而接缝处较后的块在其自身主体的切口上绘出完全相同的一段，并在真实端部与间隙面处停止（环保持距端面三分之一个间距，螺旋线终止于端面）。每块携带 `rings: [{ d, alpha }]`；`ringsSvg(rings, tone)` 单独绘制它们。 |
| `runsOf(total, gaps)` | 路线长度 `total` 在扣除 `gaps` 后被绘制的 `[from, to]` 跨度。将每一段作为独立的 tube 记录到审计。 |
| `crossingsOf(points, centre, axis, radius)` | 路线穿过卡箍或套环之盘的弧长位置（过 `centre`、法向为 `axis`、半径 `radius` 的平面内的盘）。将每个转化为该卡箍厚度的间隙。 |

`.tb-body`、`.tb-shine` 与 `.tb-shade` 的填充是 `ISO_CSS`（以及 `kit/iso.css`）的一部分，因此 `tubeSvg` 在任何 kit 页面上都无需额外 CSS 即可工作。仅在页面 CSS 中覆盖它们以重新设定管件样式，正如 Raptor 对所选零件所做的那样（`.it[data-on] .tb-body`）。

**管的深度排序。** 管道在许多深度上穿行于零件之间，因此以各自的深度绘制每一块：以键 `G.dot3(piece.mid, G.viewOf(P))` 将其放入你的物体列表，与它经过的实体相邻。在管道于邻件之间穿行之处使用短块（`maxLength` 6–18），对平置于地面的环使用长块（400）。要在 SVG 层之间拆分管道，测试 `piece.mid`。涟漪箱的电机线缆分三路：跨过桥的块（`piece.mid[2] > Z.top - 1 && piece.mid[1] < IN.y + IN.d - 10`）到杆前的前层 SVG，其余在轮缘之上到近侧盖之后的前层 SVG，以及沿支腿下行至控制箱的一段到中间层 SVG。其灯线缆将悬于基座边缘之上的块（`piece.mid[1] < BASE.y - 0.2`）送到后层 SVG。在如 Raptor 般密集的图示中，不要凭眼睛调这些键：记录这些块，让 `orderKeys`（第 12 节）来定夺。

**任何缠绕管道之物都会将其拆分。** 套环、环带、波纹盘、卡箍或阀门体比其所坐落的管道更宽。若管道作为一个块穿过它，该块既在套环之后又在其之前，任何键都无法为二者排序：要么套环隐藏管道的近侧，要么管道涂覆在套环的面之上。在套环处为管道开间隙（`gaps: [[at - t/2, at + t/2]]`）：远侧块终止于套环的背面，近侧块起始于其正面，两者都能干净排序。Raptor 的 `pipe()` 对其自身的端法兰、环带、波纹管与阀门这样做，`cable()` 则通过 `crossingsOf` 对线束卡箍这样做。

Raptor 的 `pipe()` 辅助函数是一个良好范式：
1. 以 2.6 × r（至少 3）的弯曲对控制点 `fillet`。阀门或波纹管需要一段长度至少为其本体加两处倒圆切除（各 `r_bend · tan(turn / 2)`）的直段；把它放在弯上，其两端会切入管道。
2. 首先确定套环（端法兰、环带、波纹盘、阀门体），并将其跨度作为 `gaps` 传入。
3. 对路线执行 `tubePieces`，以每个块的 `points` 与 `radii` 记录之，并将每一段绘制的 run 作为 tube 记录到审计。
4. 绘制由管道拥有的套环（`owner`），使审计不把管道自身的法兰计为碰撞。

`cable()` 在留在自身组件上的端部添加一个终端点，在落到另一个组件上的端部添加一个连接器外壳（`shells: [start, end]`），从而即使图示拆开，每条线缆仍然终止于某个物体。两个辅助函数都接受 `free: [start, end]`，用于图示拆开时脱离其安装座的端部，并以 `{ P, tube: r }` 倒圆（参见 `fillet`）。必须离开正对观察者之接口的线自一个 `elbow`（凸台上的球，两个接头处均为球上轮缘，线离它朝向下一个点）起始，从而转弯发生在接头内部。`pipe()` 将每个端法兰的背面置于路线端部，并可以 `coupling`（快断处的联管螺母）而非法兰终结一条线。

## 12. 审计（audit）（`kit/audit.mjs`）
```js
import * as A from "../../kit/audit.mjs";
```
**单行挂钩。** 创建一个记录器，让每个绘制辅助函数将其物体放入并记录其形状，settle 这些键，并以 `auditOrExit` 结束构建：
```js
const R = A.recorder(P, { order: STAGGER, spring: SPRING });
R.put({ piece: "base", at: centre, bias: 0.1, svg, shapes: [R.solid(A.slab(plan, 0, 6, { name: "base.plate" }))] });
R.route("base.cable", route, 0.6, { piece: "base", gaps, limp: true });
A.settle(R, P);
R.items.sort((a, b) => a.key - b.key);
A.auditOrExit(R, P, { crowd: [] });
```
随后 `node build.mjs --audit` 打印报告，并在任何失败的行上以非零码退出；没有该标志时，`auditOrExit` 立即返回。不拆开的图示不传 `order`，每个拆开检查都退化为静止位。

| 函数 | 功能 |
|---|---|
| `recorder(P, { order = [], spring = {}, ground = grounded })` | `{ items, solids, tubes, routes, put, solid, route, nameFor }`。`put({ at, bias, key, name, piece, move, ride, shapes, ...rest })` 添加一个已绘制的物体（除非传入 `key`，其键为 `dot3(at, V) + bias`；其余内容如 `svg`、`route` 与 `chunk` 保留在物体上）并以该物体的 `move`、`ride` 与 `piece` 标记其形状。`solid(shape)` 记录一个形状并返回它，用于物体的 `shapes` 或绘制于排序层之外的静态零件。`route(name, points, radius, { owner, touch, bundle, limp, gaps, closed, ends, rims, free, piece, move, ride })` 记录一条管道或线缆：`gaps` 之间每一段绘制的 run 对应一个 tube，附带其 `tips`、`tipAxes`、`tipRims` 与 `free` 端，外加供 `folds` 与 `crowding` 使用的路线。`nameFor(base)` 为重复的名称编号（`base`、`base#2`、…）。`order` 与 `spring` 是实页面的交错与弹簧。 |
| `explodeStates(order, spring, { uniform = 10, stride = 4 })` | `{ depth, frames, apart }`：深度求解器状态（均匀份额、每第 `stride` 个重放帧并在每个交错边界处反向、前缀状态）与间隙帧（每个重放帧加前缀状态）。无物拆开时为 `{ depth: [0], frames: [] }`。 |
| `settle(R, P, { states, skip = sameRun, ...overlapOptions })` | 运行 `overlapsOf` 与 `orderKeys`，并将键写到物体上。它保持物体原有的顺序，因此之后可以排序 `R.items`。每次构建都运行它。 |
| `audit(R, P, { allow, crowd, cover, ground, frames, apart })` | 对记录的形状执行下述每一项检查，汇总为 `report` 与 `failures` 的一个结果：静止位、拆开位与每一帧的间隙，实体间隙，静止位与拆开位的拥挤（也对细长实体），替身形状，终端，松端，弯折，自重叠，摆动，座，支撑与深度顺序。`allow` 豁免深度对，`crowd` 豁免拥挤对，`cover` 豁免替身物体。它从来看不到线条标记：为此在页面上运行 `scripts/lines.mjs`。 |
| `auditOrExit(R, P, { flag = "--audit", argv, ...auditOptions })` | 带有该标志时：执行 `audit`，打印报告与一行汇总，并在任何失败时设置 `process.exitCode = 1`。 |
| `sameRun(a, b)`、`grounded(shape)` | 一条路线的相邻块（被重叠检查跳过），以及默认地面（其 meta 中带 `ground: true` 或名称以 `stand.` 开头的形状）。 |
| `keyAt(item, state, V)`、`labelOf(state)`、`cameraBasis(P)` | 物体在拆开状态中的排序键（`key + lift · share`）、状态的可打印标签，以及相机的屏幕向右、屏幕向下与朝向观察者单位向量 `{ R, D, V }`，供你自己的探查使用。 |

一个细致的图示会以眼睛察觉不到的方式失败，直到审阅者放大：穿过某物的管道或线缆，在静止位或拆开的任何帧中；脱离安装座浮起的法兰；悬空或陷入邻件中的零件；折回或在屏幕上收缩成一点的路线；落在另一条线轮廓上的弯或端；图示拆开时垂落的线缆端；以及重叠时绘制顺序错误的两个物体。审计从真实几何测量这一切。在 Raptor 上（478 个物体、1,119 个深度状态、约 4,400 个重放与前缀帧用于间隙检查），每次构建的键求解约需一分钟，完整的 `--audit` 总共约三分钟，其中大部分是逐帧间隙检查。

**形状。** 为你绘制的一切记录形状，以世界单位，随构建随记：

| 构造器 | 形状 |
|---|---|
| `solid(F, profile, { radius, ...meta })` | 车削体：两端闭合至轴的轮廓，即你传给 `solidOf` 的同一 `[s, r]` 列表。平滑节点的各段沿绘制所用的同一条 Hermite 曲线描绘（或沿 `radius(s)`，如 `bandsOf` 的环带），从而记录的表面是被绘制的那个，而非其弦。 |
| `lathe(F, meridian, { radius, ...meta })` | `G.lathe(meridian, F, P)` 的形状，描绘方式相同：任何闭合子午线（环、阀门体、罐）。 |
| `body(F, polygon, meta)` | 绕 `F` 回转的任何闭合 `[s, r]` 多边形，按原样取用。位于轴上的边不算表面，从而盘深处的点测得其真实深度。 |
| `disc(F, s0, s1, r, meta)`、`ring(F, s0, s1, rIn, rOut, meta)` | 法兰、凸台、销、套环。 |
| `box(min, max, meta)`、`orientedBox(centre, axes, half, meta)` | 方形块；45° 的梁。 |
| `slab(plan, z, height, meta, steps = 8)`、`extruded(ring, z, height, meta)`、`cylinder(cx, cy, r, z, height, meta)` | `slabOf`、`extrude` 与 `cylinder` 的形状：同一圆角 plan 或立于地面的任意多边形环（凸或非凸），从而圆角甲板角或 L 形支架按绘制接受检查。 |
| `prism(F, polygon, s0, s1, meta)` | `G.prismOf` 的形状：坐标系 `u`、`v` 平面内任意多边形沿 `F.a` 挤出。 |
| `traced(meridian, { radius, error = 0.02, depth = 6 })` | `solid` 与 `lathe` 所记录的多边形。 |
| `ball(at, r, meta)` | 球与终端点（`size / scale` 世界单位）。`meta.flats: [[nx, ny, nz, d]]` 切出平面（保留半空间 n·(p − c) ≤ d）：`sdf` 为 `max(|p − c| − r, n·(p − c) − d …)`，表面采样包含这些平面的轮缘，`boundsOf` 不变（保守）。3D 模式的关节球记录此形状。 |
| `tube(points, radius, meta)` | 带半径的管道或线缆中心线（数值、0..1 的函数，或每点一个的列表）。 |
| `slide(F, from, to, r, meta)` | 自 `from` 处压盖滑出的杆（自 `from` 至 `to` 的一个 `disc`）。在拆开或行程状态中摆位时，它自压盖面拉伸至 `to + offset · F.a`，而非平移，从而每项检查都看到被绘制的杆。将其置于运动物体上（带行程 `move` 的那个）。 |
| `moved(shape, offset)`、`sdf(shape, p)`、`boundsOf(shape)` | 辅助函数：平移、有向距离（内部为负）、世界包围盒。 |

`meta` 携带 `name`（用于报告，并按前缀匹配：`"nozzle.bell*"`）、`owner`（管道自身的法兰、环带与阀门）、`touch`（一条 tube 可以有意触碰的名称，如线束周围的卡箍）、`bundle`（同一线束中的线缆可以并排而置，且一个卡箍携带其线束的 bundle）、`joined`（一条带间隙管道的一段）、`limp`（一条线缆：它不支撑任何东西）、`anchor: false`（一个卡箍：端部不得将其计为安装座）、`fitting`（一个卡箍或套环，其中心参与对其他线的 `crowding` 检查）、`seated`（一个按设计沉入主体的垫或球面轮缘接合）、`cut`（自本形状减去的形状或形状列表：鞍座垫被其主体切除）与 `curve`（无解析斜率的车削体的平滑轮廓，用于 `wobble`）。Tube 的各段还携带 `tips`（路线的真实端点，或对并入物体的端部取 `null`，如蜗壳的起点）、`tipAxes`、`tipRims`（每端的法兰或连接器半径）、`free`（意在拆开时脱离安装座的端部）、`offset` 与 `total`（该段在其路线上的位置）。每个形状都携带绘制它的物体的 `move`、`ride` 与 `piece`，从而可在任何拆开状态中摆位。

**状态。** 一个拆开状态是一个数字（每个组件均为该份额）或 `{ label, shares }`（每个组件一个份额）。`uniformStates(10)` 给出 0、0.1 … 1；它们不是任何人看到的帧，因此只喂给键求解器。`springStates(order, { stagger, stiffness, damping, substeps, fps = 60, settle = 1e-3, stride = 1, reversals = [] })` 以其实页面的弹簧连同交错一起重放，从静止位打开、从拆开位关闭，每帧一个状态直至每个弹簧在其目标的 `settle` 之内（Raptor 上每个方向约 1.2 秒，从而每次塌缩的慢尾也被检查）。`stride: 4` 保留每第四帧，用于深度栅格。`reversals` 添加快速悬停产生的路径：打开，然后经过那么多秒后再关闭（以及反向），采用页面自身的调度：反向时只有目标变化的组件被重新调度，在彼此之间交错，从而一个刚离开的径直返回，一个仍在等待的干脆留在原地。**`reversalsOf(order, stagger)`** 在每个交错边界的任一侧 8 ms 处给出一个反向：坏窗口正在于此（下一次开始前 15 ms 的一次反向，使热气管飞入一个仍停在原地的甲烷泵），而三个手工挑选的时刻全部错过。**`prefixStates(order, { shares = [0.25, 0.5, 0.75, 1] }`)** 添加前缀规则背后的静态状态：前 `k − 1` 个组件完全在外，第 `k` 个处于每个份额，其余在家。沿交错的份额始终非递增（较早的组件领先，打开、关闭与反向），从而每个可达帧都落在这些之间。一次 40 ms 的采样错过了整段穿越：两次采样之间喷嘴行进了 15 单位，是最宽管道的两倍多。`shareOf(item, state)` 从物体的 `ride`（或 `piece`）读取其份额，`offsetOf(item, state)` 是其 move 乘以该份额。

**`overlapsOf(items, P, { step = 0.25, tolerance = 0.3, least = 0.25, states = [0], skip })`** 在每个状态中找出每一对其屏幕足迹重叠的已绘制物体，并在重叠区域上按 `step` 个 viewBox 单位的栅格，沿相机射线对两个形状做射线投射。当一个表面近得超过 `tolerance` 时该单元计入。每一侧被标记的单元被闭合（一次膨胀、一次腐蚀，从而带锯齿的细条变为实心），再腐蚀一次（从而真实接触沿线脱落），并测量最大的连通块，单位为 px²；当该面积至少为 `least` 时该侧为“在前”。在旧的 0.5 步长配 4 邻域核心计数下，整个沉入泵壳的法兰与每一处线缆交叉（0.5 的线缆宽度不足三个单元）都读作噪声。每个物体在其本位于原位投射一次；在任何状态中其栅格即那一次按偏移在屏幕上的平移（四舍五入到栅格）与深度上按 `offset · V` 的平移，后者对平移是精确的。成对结果按该对的相对平移缓存，从而一起移动的对只测一次。在 Raptor 上，1,119 个状态（均匀、每条重放路径的每第四帧、前缀状态）的耗费低于旧的 61 个。`skip(a, b)` 排除成对者，如一条管道的相邻块。

**`orderKeys(items, overlaps, { gap = 0.02 })`** 在该对的状态中把每一个单侧对转化为一条规则：`keyFront − keyBack ≥ gap + shareBack · liftBack − shareFront · liftFront`。它关于键是线性的，从而一次最长路径松弛即可同时解决所有状态，且只把物体往后移。无法满足的环丢弃其最弱的规则（`dropped`）。在不同位置彼此在前的对为 `cycles`。

**`depthOrder(items, P, { overlaps, solved, rest, allow })`** 在每个状态中检查最终顺序。在静止位（`rest`，默认为状态 0 与 1）与每个重放的弹簧帧中，每一个错误的对都是问题：干净的错序、互锁，以及没有任何形如 `k + lift · share` 的键能在全部状态中维持的对，都会显示在屏幕上。在均匀状态中只有干净的错序计入；其中的互锁被列为通过。`allow` 接受 `[patternA, patternB]` 对以显式豁免。

**`clearances(tubes, solids, { ratio = 0.5, least = 0.2, state, only, mounts })`** 采样每条 tube，并列出它比 `max(least, ratio · r)` 更接近一个实体或另一条 tube 的每一处。在一段平端附近它测量端环，而非一个会悬在切口之上的球。只有端部自身的安装座（其轮缘所坐的形状，参见 `mountsOf`）、该安装座的管道，以及共享该安装座或落到此 tube 上的线的接头被豁免，且仅在端部的 `r + gap + 1` 之内；靠近端部处其他任何东西仍不得被进入超过 0.1。传入 `state` 以摆位一切（豁免仅在 tube 与安装座相距其共同就位处 0.05 以内时成立），并传入 `only: "through"` 以只列出穿透。一条 tube 到另一条 tube 的距离是真实的封顶圆柱距离，从而平终止于法兰之下的一段不会长出下一个段似要进入的幻影圆盖。

**`mountsOf(tubes, solids)`**、**`terminals(tubes, solids)`** 为每个 tube 端找出距其端轮缘（法兰或连接器半径处 12 个点）最近的锚定形状，并列出每一个轮缘不在其 0.15 之内的端部：立在接口上的法兰、位于弯曲身体上的平法兰（轮缘间隙）、止于线束旁或卡箍内的线缆。

**`looseEnds(tubes, solids, { state = 1 })`** 列出在该拆开状态中不触碰任何随之运动的其他所有者的实体的每个 tube 端。其自身的法兰、联管螺母或连接器外壳不计入（若计入，此检查永不会失败：25 个 Raptor 端仅支撑在自身的接头上）。标记为 `free` 的端作为蓄意的列表单独报告；其余全部失败。

**`supports(solids, tubes, { ground, touch = 0.15, sunk = 0.5 })`** 构建实体与刚性 tube 的接触图，并列出每一个未连接到 `ground`（默认：名称以 `stand.` 开头）的实体，外加每一对相互陷入超过 `sunk` 的实体对，除非它们共享所有者或其中一个 `seated` 于另一个（在其 `cut` 中指名）。就座的垫仅对其主体被豁免：Raptor 的点火法兰沉入另一组件的热气垫 0.5，曾被一条笼统的 `seated` 标志所掩盖。`hanging` 列出未连接到任何被支撑之物的刚性 tube，同样失败。

**`solidClearances(solids, { state, sunk = 0.5 })`** 摆位各实体，并对在该状态中处于不同偏移的每一对，用另一个的 `sdf` 测试其每一个的表面点；陷入超过 `sunk` 的任何东西失败（就座的垫与其主体被豁免）。在状态 1 与每个重放及前缀状态中运行它：一个组件的壳体、垫或法兰扫过另一个组件的身体，是 tube 检查看不见的。

**`seats(solids)`** 列出每一个被切到一个随另一组件运动的主体的 `seated` 形状。拆开时，其切除的底部显露出来：热气管的鞍座，被切到甲烷泵的涡轮与环，飞出时成为带尖尾的锯齿碎片。鞍座属于其主体的组件；运动线在其平面上与之相接。

**`selfOverlaps(items, P, { fold = 0.25, least = 0.5 })`** 检查每个已绘制的 tube 块自身：在屏幕中心线以小于该 tube 屏幕半宽的半径转折之处，带的内缘向后运行，单块轮廓自相交叉（隐藏支腿的边缘透显出来）。当该弯折至少为 `least` px 且该点未被另一个物体覆盖时失败。一条指向观察者并在一两个接口半径内转弯的支腿是常见原因。

**`wobble(solids, { samples = 20 })`** 对每个记录的 `curve` 采样其 `dr/ds`，每段 20 点，并列出其在该段两端之间发生转折的 `s` 值。

**`folds(routes, P, { fold = 140, turn = 110, pinch = 2, items })`** 列出每一条路线（`{ name, points, r }`）中屏幕方向在四个半径内转折超过 `fold` 度而其真实转弯小于 `turn` 之处（逃离观察者随即下落的管道之尖点），以及每一个在屏幕上绕小于 `pinch` 倍该 tube 屏幕半径的半径转折超过 90° 的弯，按 1.5、3 与 6 个半径的跨度测量（侧视的倒圆：指向观察者随即爬升的支腿之 V 形）。距端部三个管宽以内的尖点被视为端视的残端，不计入。带有 `items` 时，只计你能看见的弯：每一个都对每个已绘制形状做射线投射。

**`crowding(routes, P, { gap = 1, bend = 30, links, items, allow, state, clear = 2 })`** 列出路线的弯（±2 个半径内超过 `bend` 度的 3D 转弯）或端落在屏幕上另一条路线轮廓上的每一处：轮廓相距小于 `gap` px 或重叠，且两条线在那里都可见（对 `items` 做射线投射；路线自身的法兰、外壳与卡箍计为路线）。无论真实深度如何，这些读作一个接头或一条穿过另一条的线。一个弯绝不会因深度重叠而被豁免；一个端只有当另一条线在那里是直的且该端的尖端本身离开它时才被豁免。每个 `fitting`（线束卡箍）也被检查：轮廓落在另一条线 `clear` px 之内的卡箍，读作那条线从卡箍中长出，正如 Raptor 的线束卡箍在拆开位中落在氧到预燃器线上那样。`links`（来自 **`linksOf(tubes, mounts)`**）豁免真正相遇的线：一条装在另一条上，或两者同装于一个安装座。`state` 在拆开状态中摆位路线与物体，从而拆开位也被检查（路线携带 `move`、`ride`、`piece`）。`allow` 接受你已看过并判定为清楚的 `[patternA, patternB]` 对。

**`slenderOf(solids, { ratio = 4, least = 0.3 })`** 将每个细长的已记录实体（车削体、棱柱或长度超过 `ratio` 倍其半径或半宽的块：拉杆、活塞杆、立柱、导轨、手柄）转化为一条伪路线，`audit` 将其作为 `rods` 传给 `crowding`。落在其上的 tube 的弯或端，与落在另一条 tube 上一样失败（`crowding: hose.B end × cyl.tie-rod (rod)`），除非该 tube 装于其上或装于与之相连之物。杆永远只是被落上的线：它们自身的端不被检查。

**`coverage(items, P, { least = 0.6, pad = 1, allow })`** 对每个带 `svg` 字符串的物体，比较其所绘内容的屏幕盒（`markupBox(svg)`：每条路径、圆、线、矩形与折线，穿过 `transform` 与 `clip-path`，不含高光、文本与 defs）与其已记录形状的屏幕盒（`footprintOf(shape, cameraBasis(P))`），并列出其形状覆盖绘图少于 `least` 的每个物体：`stand-in shapes: rod.rod  its shapes cover 4% of its drawing`。为长杆记录的一个细条，或为绘制三个零件的物体记录的一个形状，使其他每个检查对余下部分视而不见。`audit` 接受 `cover: [names]` 以豁免其绘图确实超出其身体的物体；先逐个查看。

**`report(result)`** 格式化一切；**`failures(result)`** 计数应使构建失败者。

Raptor 如此接线（`examples-raptor-engine/build.mjs`）：其 `put`、`tubeItems` 与 `record` 是 `R.put`、`R.route` 与 `R.solid` 的薄封装，构建的结尾为
```js
A.settle(R, P);
items.sort((a, b) => a.key - b.key);
A.auditOrExit(R, P, { crowd: CROWD_OK });
```
实页面从其数据读取相同的 `STAGGER` 与 `SPRING`，从而审计与页面不会漂移。每个辅助函数（`turned`、`band`、`flangeAt`、`boss`、`padOn`、`boxAt`、`valveOn`、`pipe`、`cable`、`clampAt`、`strut`、作动器）都在放置其物体时记录其形状，且绘制于后层的静态支架（甲板、火焰锥、灭火环与供料、立柱、拼接）被记录为由 `stand.frame` 拥有的固定形状，从而一个把零件驱入支架的拆开向量也会失败。无一逃过检查。

## 13. WebGL 层（`kit/gl.mjs`）
| 导出 | 是什么 |
|---|---|
| `GLSL_ISO` | `glLayer` 前置的 GLSL 前奏。它容纳相机 uniform（`uCanvas`、`uView`、`uOrigin`、`uK`、`uCam`、`uTime`）与函数 `viewOf`、`project`、`towardViewer`、`rayOf`、`pixelOf`、`lightDir`、`onFloor`、`onWallX`、`onWallY`、`hash12`、`hash13`、`noise2`、`noise3`、`fbm2`、`fbm3`、`window` 与 `tonemap`。不要在片元中重新定义任何一个：GLSL 拒绝第二个 `rayOf`。 |
| `rayOf(vb)` (GLSL) | 面向相机的过原点垂直平面上 viewBox 点 `vb` 之下的世界点。`rayOf(vb) + t·towardViewer()` 是该像素的整条射线；`t` 越大越靠近观察者。 |
| `pixelOf()` (GLSL) | 每画布像素的世界单位数，`(uView.x / uCanvas.x) / uK`。对地面的深度方向除以 `uCam.z`，或沿墙向上除以 `uCam.w`。 |
| `glCamera(P)` | 一个投影对应的 `{ origin, k, cam }`。可在 Node 中工作，因此放入页面 `DATA`。 |
| `glLayer({ canvas, fragment, view, camera, uniforms = [], fixed = {}, extensions = [], maxRatio = 1.5, onError })` | 返回 `{ gl, extensions, set(values), draw(values, time), clear() }`，无 WebGL 或编译出错时为 `null`。`uniforms` 指名你每帧发送的 uniform。`fixed` 是 `{ name: value }`，创建时设置一次，用于一切不变之物（plan、高度、主题常量）。`extensions` 列出 GLSL 扩展，如 `"GL_OES_standard_derivatives"`；上下文支持的每一个都被启用并前置为 `#extension … : enable`，返回的 `extensions` 列出实际启用的那些。 |
| `set(values)` | 设置 uniform 而不绘制，用于很少变化的值。 |
| `draw(values, time)` | 适配画布，设置相机 uniform 与 `uTime`，然后 `values`，再绘制。 |
| `clear()` | 清除为透明，仅在绘制过某物时。 |
| `smooth(a, b, x)` | JS 中的平滑步进。 |
| `burst(age, rise, fall)` | 事件包络：`rise` 秒内的平滑步进起振，继而以时间常数 `fall` 指数衰减。`age ≤ 0` 时为 0。 |
| `settle(state, target, dt, seconds, calm = false)` | 作用于 `state = { x, v }` 的临界阻尼弹簧，时间常数 `seconds`，四个子步。误差与速度均低于 1e-4 时立即锁定目标。仍在运动时返回 true。`calm` 直接跳至目标。 |

| `GLSL_TURN` | 3D 图示的可选 GLSL，由图示前置到其片元：`uGroupX/Y/Z/T`、`toGroup(p)`（世界 → 该组的静止世界坐标）、`toWorld(g)`、`dirToGroup(d)`、`dirToWorld(d)`，以及遮罩 `uCoverEdge[60]`、`uCoverCount[6]`、`coverOf(vb, soft)`（在效果之后绘制的零件内部为 1）。它定义 `toWorld`：不要将其前置到声明了自身 `toWorld` 的片元。该块使用 70 个 uniform 向量。 |
| `glslPose(Name, prefix = "uName")` | 任意组的同样四个函数：`toName`、`fromName`、`dirToName`、`dirFromName`，作用于 `prefixX/Y/Z/T`，从而一个着色器可以跟随多个组。喂给它 `TURN.poseUniforms(controller, group, prefix)`。 |

`fixed`、`set` 或 `draw` 的值可以是数值（float）、长度 2–4 的数组（`vec2`–`vec4`），或长于 4 的数组或 `Float32Array`，后者进入所声明类型的 uniform 数组：`uniform3fv` 用于 `uniform vec3 name[N]`（覆盖边、火花位置），`uniform2fv`/`uniform4fv` 同理，`uniform1fv` 用于 `uniform float name[N]`。这些调用不涉及 int、矩阵或 sampler；`sampler2D` 默认为纹理单元 0，从而用 `layer.gl` 绑定纹理（涟漪箱的历史纹理）。不在 `uniforms` 或 `fixed` 中的名称，以及被编译器优化掉的 uniform，被跳过。

`smooth`、`burst` 与 `settle` 是纯 JS：在模块中从 `kit/gl.mjs` 导入它们，或在内联了 `glScript()` 的页面上免费获得。`references/webgl.md` 有完整的契约、一个最小页面与工艺规则。

## 14. 工具
| 脚本 | 用途 |
|---|---|
| `scripts/capture.mjs` | 一次性截图：桌面、手机、悬停、按键、定时拍摄、4 倍缩放、减弱动态、控制台检查。Chrome 以开启 WebGL 启动（允许 SwiftShader），从而着色器可见。`--times` 延迟自第一次拍摄起算；`--key` 发送与 `drive.mjs` 相同的键码（`7` 是 `Digit7`，`Comma` 发送 `,`）。 |
| `scripts/drive.mjs` | 无头 Chrome 中开启 WebGL 的脚本化会话：滚动、移动、点击、按键、减速、直至、求值、拍摄与接触表。`--no-webgl` 检查 SVG 回退，`--preload file.js` 在页面自身脚本之前运行一个脚本。用于着色器过渡与任何带序列的事物。参见 `references/verify.md`。 |
| `scripts/lines.mjs` | 线端检查：卡片中的每条纹理线必须终止于一条描边、一个点或一条轮廓，或位于后续填充之下。`--out` 圈出失败；有任何失败即以 1 退出。同一检查是 `drive.mjs` 的 `["lines"]` 动作。参见 `references/verify.md`，"Line ends"。 |
| `scripts/inline-kit.mjs` | `kitScript()`、`glScript()` 与 `turnScript()` 将 kit、WebGL 层与 3D 运行时作为纯脚本返回，以内联进独立页面。 |
| `scripts/drive.mjs` `["turn", value, group?]` | 3D 图示：通过 `window.__isoTurn` 设置第一个旋转组（或 `group`，或一个 values 对象）并等待两帧。 |
| `scripts/drive.mjs` `["orbit", out.png, from, to, step, sel?, scale?, [x,y,w,h]?, columns?]` | 3D 图示：跨角度的接触表，每帧标注 θ°。整圈 15°；顺序变化处 0.1°；易弯折的弯处 1°。 |
| `scripts/turn-check.mjs` | 3D 图示。`build.mjs --fidelity`（Node：在 P′(θ) 处对照 kit 构建器的棱柱、回转、车削体与管件）；`page.html --order`（需要一次 `--verify` 构建）、`--pops`、`--lines`、`--perf`、`--states file.json`、`--part name`、`--out dir`。每项检查都先运行其预设的对照。`references/3d.md` 第 14 节。 |
| `scripts/turn-bench.mjs` | 3D 图示：Node 中 360 个角度上每种零件类型（7 次的中位数）的 `emit` 与 `order` CPU 时间。 |

## 15. 旋转组（`kit/turn.mjs`、`turn-build.mjs`、`turn-audit.mjs`）
可选的 3D 模式。`references/3d.md` 是指南；此处为参考。
```js
import { turning, separate, gjk } from "../../kit/turn-build.mjs";
import { TURN, TURN_CSS } from "../../kit/turn.mjs";
import * as TA from "../../kit/turn-audit.mjs";
```

### `turning(P, { recorder, scale = 1 })` → `T`
| 成员 | 功能 |
|---|---|
| `T.group(name, { parent?, turn: { pivot } \| slide: { direction, travel } \| hinge: { point, axis, range } \| free: { origin } })` | 刚性组。值：度（turn、hinge）、世界单位（slide）、`{ R \| q \| axis+angle, t, world? }` 或 `null`（free）。 |
| `T.layer(name)`、`T.stack(names)` | 实层，以及活动与静态层名完整的由后向前栈。 |
| `T.prism`、`T.round`、`T.lathe`、`T.ball`、`T.tube`、`T.fixed`、`T.plane`、`T.billboard`、`T.split` | 静止位世界坐标中的零件。公共选项 `{ name, group, layer, tone, crease, lit, material, owner, details }`。签名见 `3d.md` 第 4 节。 |
| `T.build({ statics, poses, verify, strict })` | `{ svg, data, css, report, layerSvg(name, { width, height }), verify, planesByName }`。 |
| `T.parts`、`T.groups`、`T.layers`、`T.routes`、`T.data`、`T.built` | 场景，供审计与各项检查使用。 |

`details`：`seams`、`ribs: { s0, s1, count, phase, twist, fade, seams, tone }`、`bolts: [{ s, r, count, phase, size, tone, fade }]`、`dots: [{ at, normal, size, tone }]`、`rings: [{ at, normal, r, tone }]`、`rules: [{ points, tone, free }]`、`bevel`。每个构造器在其自身的坐标系中取其自身的子集（球的 `s` 沿其第一个平面的法向运行；棱柱只取 dots、seams 与 bevel）：表见 `3d.md` 第 4 节。材质：`gold`、`chrome`、`steel`、`gunmetal`、`rubber`、`brass`、`copper`。

`separate(A, B, hints)` 与 `gjk(A, B, warm)` 对两个点集返回 `{ n, d, margin }`（构建的平面求解器）。

### `TURN`（运行时）
| 成员 | 功能 |
|---|---|
| `TURN.mount(stage, data, { onHold, onFrame, follow })` | 控制器：`set(values \| θ, { detail })`、`render()`、`angleAt(x, y, z, group)`、`values`、`pose(name)`、`detach(name)`、`anchor(group, restPoint, restDir?)`、`cover(names, options)`、`order(layer)`、`orderIndex(layer)`、`events()`、`stats()`、`frames()`、`cams()`、`scene()`、`destroy()`。安装 `window.__isoTurn`。 |
| `TURN.cover(controller, names \| [names…], { polygons = 6, edges = 10, pad = 0.3, layers })` | 供 `coverOf` 使用的 `{ uCoverEdge, uCoverCount, dropped, parts }`。 |
| `TURN.poseUniforms(controller, group, prefix = "uGroup")` | 供 `GLSL_TURN` 或 `glslPose` 使用的四个 `vec3`。 |
| `TURN.anchor(scene, cams, group, point, dir)`、`TURN.floorOf(scene, group, R)` | 控制器之外的锚点；一个组在旋转下的最低 z。 |
| `TURN.rotation(axis, deg)`、`TURN.quat(q)`、`TURN.compose(A, B)` | 以 `[9]` 表示的旋转，用于自由摆位。 |
| `TURN.materials`、`TURN.materialCss()`、`TURN.css()`、`TURN_CSS` | 材质名称；CSS。 |
| `TURN.camera`、`TURN.poses`、`TURN.cams`、`TURN.prepare`、`TURN.emit`、`TURN.order`、`TURN.frame`、`TURN.gjk`、`TURN.disjoint`、`TURN.q`、`TURN.levels` | 流水线，供工具使用：每组相机、就绪场景、一个零件的帧、一个层的顺序。 |

### 轨道审计（`kit/turn-audit.mjs`）
| 导出 | 功能 |
|---|---|
| `orbitOrExit(T, R, P, { flag = "--audit", argv, sweep, clips, poses, crowd, cover, fittings, quick, only, log })` | 存在该标志时运行 `orbit`，打印报告，任何失败时设置退出码 1。仅在完整运行时以 `turn audit passed` 结束；带 `only` 时以 `turn audit partial` 结束，带 `quick` 时以 `turn audit quick` 结束（`3d.md` 第 13 节）。 |
| `orbit(T, R, P, options)`、`orbitReport(result)`、`orbitFailures(result)` | 检查、文本、计数。`result.skipped` 列出 `only` 遗漏的行（打印为 `skipped`）；快速运行时会设置 `result.quick`。 |
| `posed(shape, pose)`、`eventsOf(T, layer)` | 被组摆位移动的已记录形状；一个层的侧视角。 |
