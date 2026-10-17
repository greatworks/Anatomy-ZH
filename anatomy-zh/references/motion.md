# 动态与交互

当图的机构像真实事物那样运动时，图才显得有生命：滑架滑行后停稳，弹簧过一次冲，指针摆向新的读数。动态应当平缓到足以看清，并忠于模型。

## 原则
- **基于时间。** 从 `requestAnimationFrame` 的时间戳取 `dt`，并将其限制在 1/30 s，以免后台标签页出现跳变。绝不要每帧步进固定量。
- **缓向目标。** 指针设备与键盘设置一个 *目标*，部件以指数缓动（`x += (target − x)·(1 − e^(−dt/τ))`，τ = 0.1–0.3 s）或弹簧跟随。部件绝不瞬移到光标处。
- **对象有弹性时用真实弹簧。** 刚度与阻尼取自真实模型，为求稳定每秒子步进约 240 次。一旦误差与速度都低于 5e-4，就吸附到目标。
- **每图一个循环。** 单个 `tick(dt)` 更新模型，然后通过 ref 写入 DOM：`setAttribute("transform" | "d")`、`textContent`、`dataset`。不要每帧重新渲染 React。
- **静止或离屏时停止。** 使用 `IntersectionObserver`，rootMargin 为 `120px 0px`，并读取最新的条目（`entries[entries.length - 1]`）：当舞台在两次回调之间离开又回来时，一次回调会按从旧到新的顺序交付两个条目，而读取第一个会让图冻结在屏幕上。一旦一切到达目标，就停止循环。
- **减弱动态。** 当设置了 `prefers-reduced-motion: reduce` 时，直接跳到目标，没有巡游、流动或脉动。图仍必须响应输入。
- **空闲巡游。** 当无人交互时，约 1.4 s 后播放一段脚本化的循环，展示图的要点。悬停、聚焦或按下时暂停，并在最后一次交互后约 3.6 s 恢复。巡游驱动的是用户会驱动的相同目标。
- **读数实时更新**，取自同一模型，用真实单位并保持简短：`block 2 · reads 14.0 px`、`120.0 × 32.0 · lean 10.6 px`。从部件当前所在位置读取，而不是从目标读取：只要有弹簧在运动或有待处理项，Raptor 就说 `taking apart` 或 `closing up`，只有在那之后才说 `apart · 11 assemblies` 或 `1,630 kg · cold`。阶段词与其旁的数字要取自同一来源的同一瞬间：一个盲测台架打印了 `end of stroke · relief 85 bar`（词来自模型，数字来自滞后它 0.25 s 的表针），尽管其溢流阀在 92 时才开启，刚回缩后打印的是 `idle · 44 bar`。

## 指针设备
- 用一条坐标轴的屏幕向量把指针设备映射到世界空间。沿 x 的运动用 `axisVector(P, [1, 0, 0])`，或者把图的宽度比例映射到部件的行程范围。行程短时，范围映射更简单，手感也更好。
- 悬停预览，按下生效。触屏上没有悬停，所以让轻点即生效，并保留 `touch-action: pan-y`，使页面仍可滚动。
- 拖动时使用指针捕获，并在 `pointerup` 或 `pointercancel` 时释放。

## 键盘与无障碍
- 图的根元素可聚焦（`tabIndex=0`），带 `role="slider"`（有离散选项时为 `"group"` 加按钮）、解释控件用途的 `aria-label`，以及用文字表述的 `aria-valuenow`/`aria-valuetext`，例如 "Pressed: 129.6 by 34.6 pixels, leaning 10.6 px"。在读者的选择发生变化（选中某部件、拆开或合拢、点火或冷却）时写值文本，而不是在循环中写：屏幕阅读器会播报聚焦滑块值文本的每次变化，于是每帧刷新的读数（"Pc 290 bar · 222 tf"）会变成一股数字流。把视觉读数与可访问的值分开（Raptor 的 `say()` 只写读数，`describe()` 写值文本）；实时区域承载各阶段。
- 按键：方向键以合理单位步进（Shift 加大步长），Home 与 End 到两端，空格或回车按下或切换，Escape 释放。
- 显示焦点环：`outline: 1px solid var(--anatomy-muted); outline-offset: 6px`。
- `<svg>` 带 `role="img"` 与描述对象及其所示内容的 `aria-label`。

## 原生循环（无框架）
```js
let frame = 0, last = 0, visible = false, touring = !still.matches, clock = 0;
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  const calm = still.matches;
  if (touring) { clock += dt; target = tourAt(clock); }
  x = calm ? target : x + (target - x) * (1 - Math.exp(-dt / 0.28));
  springTo(tip, heightUnder(x), dt, 420, 26, calm);
  draw();                                   // setAttribute on refs, readout.textContent = …
  const settled = !touring && x === target && tip.rate === 0;
  frame = visible && !settled ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
```
`examples-dial-indicator/build.mjs` 包含完整版本，带巡游、指针映射与键盘止点。

## React 循环
把静态美术保留在服务端构建的 props 中，只移动 `<g>` 包装器与改变形状的路径：

```tsx
"use client";
export function RigLive(props: { base: React.ReactNode; carriage: React.ReactNode; dial: React.ReactNode }) {
  const { anchor, say } = useReadout<HTMLDivElement>();
  const car = React.useRef<SVGGElement>(null);
  const needle = React.useRef<SVGPathElement>(null);
  const state = React.useRef({ x: REST, target: REST, tip: { at: 0, rate: 0 } });
  const visible = useInView(anchor);
  const kick = useLoop((dt, calm) => {
    const s = state.current;
    s.x = follow(s.x, s.target, dt, 0.28, calm);
    const settled = spring(s.tip, heightUnder(s.x), dt, 420, 26, calm);
    car.current?.setAttribute("transform", translateAlong(P, [s.x, 0, 0]));
    needle.current?.setAttribute("d", needleAt(s.tip.at));
    say(readoutOf(s));
    return !(settled && s.x === s.target);
  }, visible);
  return (
    <div ref={anchor} tabIndex={0} role="slider" onPointerMove={(e) => { state.current.target = toWorld(e); kick(); }}>
      <IsoFigure width={W} height={H} label={LABEL}>
        {props.base}
        <g ref={car}>{props.carriage}</g>
        {props.dial}
        <path ref={needle} className="iso-line" data-tone="lit" d={NEEDLE_REST} />
      </IsoFigure>
    </div>
  );
}
```
`examples-test-rig/live.tsx` 是完整生产版本，带弹簧、巡游、按压与拉拽、键盘处理与 aria。

## 会改变的形状
当部件改变的是形状而非位置（膨胀的胶囊、压缩的弹簧、转动的指针）时，每帧只用工具库重建它的路径，用 `slabOf`、`coil` 或 `lineOnTop`，并写入它的路径：`fill`、`shades[0..3]`、`top`、`crease`、`bevel`、`outline`。一个实体耗时远低于 0.1 ms。要测量：每帧脚本应控制在约 1 ms 以内。
- **预计算帧的台阶。** 一根杠杆用 ±15° 内 41 个预建帧绘制，其旋钮每帧移动约 0.8 px，慢放时可见。要么每帧重建旋转部件，要么预计算足够多的帧，使一步移动不超过 0.25 px。
- **从压盖滑出的杆**并不改变形状：它是一根移动的整长杆，由一个保持不动的裁剪在压盖面处裁剪（`G.rodOut`、`holdStill`、`craft.md` 第 3 节）。绝不要画成几个相互重叠的副本。

## 一次性事件的包络
闪光、咔嗒、砰然、抖动或冲击是一个带年龄的事件，而不是你设定的值。用带起振与衰减的包络驱动它。`kit/gl.mjs` 导出 `smooth(a, b, x)`（smoothstep）与 `burst(age, rise, fall)`，后者在峰值后为 `smooth(0, rise, age)` 乘以 `exp(−(age − rise)/fall)`，事件发生前为 0：
```js
import { smooth, burst, settle } from "../../kit/gl.mjs";
const flash = calm ? 0 : burst(clock - mainAt, 0.08, 0.13);
```
在独立页面上 `glScript()` 已内联全部三者，所以直接使用，不要再自行声明：在同一模块脚本里再写一个 `const smooth` 会导致 SyntaxError。
- 起振为 40–120 ms，smoothstep 使其在起点斜率为零。一帧内把值设为 1 就是砰然一跳。
- 保存事件的起始时间（`mainAt = clock`），每帧从其年龄计算每个包络。两个重叠的事件届时简单相加。
- 给每个事件自己的标志（`popped`），这样快速重启不会吞掉下一个事件，也不会截断一个仍在淡出的事件。
- 减弱动态下每个事件包络都为 0。

## 临界阻尼收敛
对于应无过冲到达的值（色相、亮度、灯、行程、频率），使用工具库的 `settle(state, target, dt, seconds, calm)`：它是作用于 `state = { x, v }` 的临界阻尼弹簧，时间常数为 `seconds`，`v += (w²·(target − x) − 2w·v)·dt`，其中 `w = 1/seconds`，分四个子步。它比指数跟随更平滑，因为速度也是连续的。一旦误差与速度都低于 1e-4 就吸附到目标，`calm` 下直接跳到目标，仍在移动时返回 true，从而可以让循环保持存活：
```js
const moving = settle(freq, state.tf, dt, 0.625, calm);
```
波纹槽把它的频率（0.625 s）与滴头间距（0.4 s）都经过 `settle`，因此按键或指针移动绝不会让波长跳变。
- **分离一个阶段所改变的东西。** 当一个物理量（比如腔压）同时驱动颜色、形状与亮度时，该量上的快弹簧会让三者同时跳变。给颜色自己更慢的 `settle`（0.3–1 s），并让亮度的计算在变化过程中单向移动。
- **淡出只会变暗。** 停机开始时，把亮度冻结在当前水平，只用下降的量去缩放它。
- **改一个弹簧会牵动相邻者。** 把一个弹簧调到临界阻尼，会让每个依赖它旧有过冲的阶段变慢，所以要逐一复查。

## 爆炸视图
悬停时把机器拆开是展示其部件的强有力方式（`examples-raptor-engine/`）：
- **把每个零件都建在合拢位置**，标记组件名，并给每个组件一条世界移动向量（`PIECES.nozzle.move = [0, 0, -120]`）。移动遵循真实装配：喷管下落最多，侧件沿径向滑出（`out(deg, r, z)`），支架不动。
- **每个组件一条弹簧**，合拢为 0，拆开为 1。Raptor 用刚度 64、阻力 14.2，略低于临界，使部件带着一点重量感停稳，每帧子步进 4 次。
- **错开各弹簧。** 打开时每个组件的目标比前一个晚 35 ms 变化，顺序要保证任何东西都不穿过任何东西（Raptor：`nozzle, downcomer, controller, plumbing, lox, ftp, hotgas, chamber, orpb, otp, gimbal, stand`，见下文“安排错开顺序”）。合拢用相反顺序，于是机器由内向外折回。待处理的目标保存为 `{ value, at }`，在 `clock >= at` 时应用。
- **反向时只重排改变的部分。** 当读者中途反向（快速悬停、空格、轻点）时，取消每个尚未离开的组件的待处理目标，只对目标改变的组件按它们在这个更短列表中的索引错开。于是最后出去的第一个回来，立即回。整表重排会让早期组件朝拆开方向飞 0.3 s，而后期组件还待在原位，爆炸之所以还能成立，只是因为下一个组件在 35 ms 后移开了：在那个窗口内反向会把热气导管推进一个尚未离开的甲烷泵。用这条规则，错开序列中各份额每帧都保持有序（早期组件总是领先），这正是下面前缀规则所依赖的。
- **用变换移动。** 每个条目的屏幕偏移是其移动向量投影后乘以弹簧值：`translate(tx ty)`。为 0 时移除该属性，使合拢状态的图恰好就是静态美术。
- **让线始终有着落。** 连接两个组件的部件（机架与泵耳之间的作动器，或盒与插头之间的电缆）属于它在物理上随附的组件，且拆开后仍要落在某个东西上。电缆两端加点。
- **选中。** 悬停、键盘方向键与零件表都会选中一个组件。被选中的部件成为唯一的 `lit` 强调：`.it[data-on]` 上的 CSS 把 `hi` 移到 `lit`、`mid` 移到 `hi`，并把顶面与侧面切到 lit 填充。其他每个部件通过 `[data-focus]` 上的 CSS 降一个色调（`hi` 到 `mid`，`mid` 到 `lo`），读数说明被选中部件的作用。

## 移动部件的深度重排
朝读者靠近或远离的部件在移动时会改变绘制顺序。当它们确实如此时，每帧排序：
- 给每个条目一个静态键 `k = dot3(ref, viewOf(P)) + bias`，其中 `ref` 是其中心，`bias` 解决相接触部件之间的平局。再给它一个抬升：`lift = dot3(move, viewOf(P))`。
- 每帧，其键为 `k + lift × spring`。按该键对索引排序，并**仅在顺序确实改变时**重新追加 DOM 节点（用一个 `DocumentFragment`）。多数帧什么也不变。
- 把键与移动向量存在元素上（`data-k`、`data-m`），使实时脚本不需要任何几何。
- 管子按段排序（`tubePieces` → `piece.mid`），使一根管能在一个部件前面、另一个部件后面经过。
- **从动态确定静态键，而不只是静止姿态。** 每个条目的键是 `k + lift × spring`，但弹簧错开时每个组件在任一帧都有自己的份额，于是两个在合拢与拆开状态下排序正确的条目，在中间过程仍可能被画反：在第一个 Raptor 里，一根增压管在每次爆炸的 40% 时间里藏到了一个作动器柱后面，而合拢时它本在其前面。Raptor 在 0、0.1 … 1 处、在按真实错开重放自身弹簧直到收敛的每第四帧、以及在打开、合拢与每个错开边界两侧的反转中，测量每一对重叠件的真实深度，还包括前缀状态（`A.explodeStates(STAGGER, SPRING).depth`，即 `[...A.uniformStates(10), ...A.springStates(STAGGER, { ...SPRING, stride: 4, reversals: A.reversalsOf(STAGGER, SPRING.stagger) }), ...A.prefixStates(STAGGER)]`，1,119 个状态，以及用 `{ order: STAGGER, spring: SPRING }` 制作的录制器的 `A.settle(R, P)` 默认值），而 `orderKeys` 一次性求解全部（每条规则都用该帧的份额）。只查打开与合拢会漏掉快速悬停所产生的帧中的错误配对：一个本该位于腔体带前面的吹扫法兰，在 0.20 s 的反转中消失到了它后面。审计在静止状态和任何重放帧中只要有错误配对即失败；只有无人得见的均匀状态可以存在互锁。
- **弹簧单一来源。** 把错开顺序与弹簧常数（`SPRING = { stagger, stiffness, damping, substeps }`）放在构建中，并通过其数据传给页面，使审计精确重放观者所见。
- **让部件随其安装对象移动（`ride`）。** 一个螺栓拧在腔体上的传感器随管路一起高亮，但骑在腔体的弹簧上。每个条目在 `piece`（它随哪个组件高亮）旁边记录 `ride`（哪条弹簧移动它，从其移动向量推断），页面读 `data-ride`，`place()` 对平移与排序都用 `piece[node.ride].x`。借用另一组件的向量却保留自己弹簧的条目，会沿其安装面滑动并在飞行中段陷入其中。
- **前缀规则。** 每个组件的路径都必须避开每一个停在原地的后续离开组件，而前面的那些已经出去：那就是错开边界处反转所冻结的帧。`A.prefixStates(STAGGER)` 精确摆出这些姿态（前 `k − 1` 个在外，第 `k` 个在 0.25 … 1，其余在家），审计用重放帧检查它们。在 Raptor 上，它把热气集气管移到它所螺栓固定的甲烷泵之后（其向量指向泵内），并把控制器移到管路之前（从氧到预燃器的管线被控制器的感测线包围，所以它只能在它们之后离开）。
- **安排错开顺序，使任何东西都不必穿过。** 弹簧彼此重叠：起点相隔 35 ms、收敛约一秒，每个组件都在同时运动，相对运动是各向量的混合。第一个 Raptor 爆炸在飞行中有 66 对相互穿过。以下规则把它降到零，由审计逐帧并在反转时检查：
  - **谁在外面谁先离开。** 在每一侧，其他所有东西都藏在它后面或下面的部件先动：Raptor 的喷管最先下落（一切都架在它上面），接着是降液管，它走在每根伸向甲烷泵的感测线与线束的外侧。合拢时顺序反过来，于是在外的部件也是最后回家的。
  - **当一个部件的爆炸向量指向另一组件的某个面时，那个组件在顺序中更靠前。** 降液管下落 84 到喷管的接口三通上；喷管下落 120 且早 35 ms 离开，于是开口始终在法兰下方，打开与合拢都一样。
  - **在另一侧仍就位时，让每个向量都背离该部件接触的每一个面**，而不只是它螺栓固定的两个面：一根穿在腔体与泵之间的线，必须沿两个安装法线共同允许的扇区移动（Raptor 的套管线走到 −120°，不下落，从两个垫块上滑脱），绕在核心部件上的电缆只能沿对整个绕程都朝外的扇区移动（绕 90° 允许 90°；绕超过 180° 什么都不允许，那就缩短它或让它在近侧收尾），而会向下扫过其下方螺栓固定的部件的线绝不能下落。
  - **相互穿过的东西共享一条弹簧。** 穿过线束环升入线块的感测线，以及该线块下方的线束，不能有各自独立的弹簧：它们相隔 35 ms 时会相互剪切而过。Raptor 的感测线与线块骑在控制器上（`BLOCK_MOVE = PIECES.controller.move`，于是 `ride` 解析为 `controller`），同时仍作为管路高亮。
  - **每根只装在一个部件上的线，就只给那个部件的移动。**
  - **检查观者能走出的路径**，而不只是从静止出发的两条：快速悬停会让弹簧中途反向（`reversals`），一个回家路上迟到的组件可能扫过一根已经到家的电缆。在每个错开边界处反转（`A.reversalsOf`），而不是在几个整数时刻：坏窗口约 15 ms 宽，0.15、0.3 和 0.5 s 全都错过了它们。把这些帧喂给深度状态，也喂给间隙检查，并且也做实体对实体的检测（`A.solidClearances`）：一个塞在其宿主悬挑下方的法兰，在回家路上遇到了宿主弹簧的尾部，深度 0.67，而所有管子检查都是零。

## 手动转动
对于 3D 图（`references/3d.md`）：
- **拖动。** `controller.angleAt(clientX, clientY, zFace, "dial")` 是指针设备在该面平面上的角度，跨圈时展开。指针按下时，保存它与当前目标。移动时，设 target = start + Δ，移动超过约 1.5° 时捕获指针。组以指数跟随（τ = 0.12 s）跟进。舞台保留 `touch-action: pan-y`。
- **按键。** 方向键步进一格，Shift 步进十格，Home 回到刻度。
- **联动组。** 通过 `follow(values)` 从一个值驱动它们（轮子取表盘的四分之一，手指链取单个 `lift`），使工具、拖动与巡游彼此一致。
- **手势与片段是时间的纯函数**（`tapAt(t)`、`breakAt(t)`）：构建对它们采样，审计逐帧走查，页面可以倒播它们以无跳变复位。
- **钩子接管。** 任何 `window.__isoTurn` 调用都会运行 `onHold`：停止巡游，并保留工具设定的值，直到读者再次操作。
- **半速率。** 密集的图保持 `controller.set` 时间的平均值，超过 14 ms 时隔帧渲染，低于 9 ms 时每帧渲染，基于时间的动态不变。
- 减弱动态只得到一帧静止画面。离屏时循环停止（IntersectionObserver）。

## 预置
如果一个动作需要机器处于某个状态（点火前合拢、旋转前关门），先预置：
1. 设定把它带入该状态的目标（`setApart(false)`、`select(null)`）。
2. 标记为已预置：按钮显示 `data-state="armed"`，读数说 `closing up · arming`。
3. 只有每条弹簧都已到达且无待处理事项时，才启动该动作的时钟。

绝不在半拆开的机器上运行动作，也绝不为省时而把部件弹回家。

## 从巡游接管
用户在空闲巡游期间操作时，停止巡游并让状态保持原样。如果你的接管辅助函数会重置某些东西（例如它强制开机），而用户的操作本身是对该东西的切换，两者会在同一帧相互抵消并重播一段动画。给辅助函数传一个标志（`takeOver(switching)`），并在巡游的每个阶段测试每个切换，而不只是默认阶段。

巡游期间按下的步进键必须从读者看到的值开始步进，而不是从巡游的目标，后者可能远超在前。波纹槽的按键在巡游时从 `freq.x` 与 `gap.x` 起步（否则从 `state.tf` 与 `state.td`），`steer()` 在接管时把两条弹簧的速度都归零，使值只沿按键方向移动。

## 播报阶段
对于有阶段的机器，加一个视觉隐藏的 `aria-live="polite"` 元素，只把阶段变化写进去：`arming`、`chill-down, venting`、`preburners lit`、`main stage`、`shutdown`、`cold`。绝不把每帧数字写进去。对于连续控件，等输入安静约 700 ms 后再播报（波纹槽的 `announce`）。加载时让实时区域保持空白，在 `focus` 时填入当前状态，使屏幕阅读器在到达时听到的是当前状态，而不是过期的一行。标签会变的按钮（"Ignite" 到 "Shut down"）不需要再设 `aria-pressed`。

## CSS 动态
- `.iso-line[data-flow]` 让虚线动起来，用于沿路径行进的东西。
- `.iso-dots circle[data-pulse]` 让点阵缓慢闪烁，用于“激活”表面。
- 悬停抬升时，用 `transition: transform 700ms var(--anatomy-ease)` 包住一个组，并在悬停时向上平移。

这些都会在 `ISO_CSS` 中于减弱动态下关闭。
