# 验证（verify）

在任何人之前，先以苛刻审阅者的眼光审视这个图。渲染它很便宜，猜测则很昂贵。

## 截图（capture）
`scripts/capture.mjs` 会启动自己的无头 Chrome（若找不到，可设置 `CHROME_PATH`），加载文件或 URL，并默认裁剪到 `.iso-plate`。它还会打印读数、任何控制台错误或异常，以及页面是否横向滚动。

```sh
node scripts/capture.mjs page.html --out shots/desk.png                         # desktop 1440, dpr 2
node scripts/capture.mjs page.html --out shots/phone.png --width 390            # phone
node scripts/capture.mjs page.html --out shots/hover.png --hover 0.7,0.5        # pointer at 70% across
node scripts/capture.mjs page.html --out shots/tour.png --times 1200,2400,3600  # motion: extra shots over time
node scripts/capture.mjs page.html --out shots/keys.png --key ArrowRight,ArrowRight
node scripts/capture.mjs page.html --out shots/joint.png --zoom 200,80,220,170  # close-up at 4x, in card px
node scripts/capture.mjs page.html --out shots/still.png --reduced              # reduced motion
node scripts/capture.mjs http://localhost:3000/docs --select "figure:nth-of-type(3) .iso-plate"   # one figure on a dev-server page
```
`--select` 接受任意 CSS 选择器；默认裁剪到第一个 `.iso-plate`。每个 `--times` 延迟都从第一张截图起算，因此 `1200,2400,3600` 会在其后约 1.2、2.4 和 3.6 s 时拍摄（一次截图（capture）耗时 60–200 ms，间隔比这更短的延迟会拍晚），保存为 `name-<ms>.png`。`--key` 发送与 `drive.mjs` 相同的按键代码（`7` 为 `Digit7`，`.` 为 `Period`；逗号写作 `Comma`，因为列表以逗号分隔）。其他选项有 `--height`（1000）、`--scale`（2）、`--wait`（第一张截图前 2500 ms）、`--zoom-scale`（4）和 `--theme dark|light`。查看你制作的每一张 PNG：打开它，仔细看。

两个脚本都会以启用 WebGL 的方式启动 Chrome（`--enable-unsafe-swiftshader --ignore-gpu-blocklist`），因此着色器也会出现在 `capture.mjs` 的静止帧中。凡需要计时或放慢的内容，请使用 `drive.mjs`。

## 脚本驱动（drive）
`scripts/drive.mjs` 在启用 WebGL 的无头 Chrome 中运行脚本化会话。用它执行序列：悬停，然后点击，然后输入，然后等待某个阶段。也用它制作放慢的连拍表（contact sheet）以捕捉跳变，以及检查无 WebGL 的回退。它在每次截图后打印读数，然后打印任何控制台错误和异常。

```sh
node scripts/drive.mjs page.html '[["wait",1500],["move",".rt-stage",0.7,0.4],["wait",600],["shot","shots/hover.png"]]'
node scripts/drive.mjs page.html --actions steps.json --height 1300
node scripts/drive.mjs page.html --actions steps.json --width 390
node scripts/drive.mjs page-light.html --actions steps.json --reduced
node scripts/drive.mjs page.html --actions steps.json --no-webgl
node scripts/drive.mjs page-light.html --actions steps.json --preload slow.js
```
选项有 `--width`（1440）、`--height`（1100）、`--scale`（1）、`--reduced`、`--theme dark|light`、`--no-webgl`（每个 `getContext("webgl")` 或 `"webgl2"` 都返回 `null`，用于检查 SVG 回退）、`--preload file.js`（一个在页面自身脚本之前运行的脚本：计数器、桩、钩子，或 `window.__driveSpeed=0.04` 以从第一帧起放慢运行）和 `--actions file.json`。选择器默认为第一个 `.iso-plate`，分数在元素上按 0..1 取值。

`--theme`（在两个脚本中）仅模拟 `prefers-color-scheme`。工具库（kit）页面在构建时选定其主题（`<body>` 上的 `data-theme`）并忽略该媒体查询，因此要检查浅色主题，请用 `--light` 构建，并对 `-light.html` 文件运行脚本驱动（drive）。

| 动作 | 作用 |
|---|---|
| `["scroll", sel]` | 将元素滚动到视口中间。 |
| `["wait", ms]` | 等待。 |
| `["move", sel, fx, fy]` | 分 10 步将鼠标平滑移动到该处，触发 `pointermove`。 |
| `["click", sel, fx?, fy?]` | 点击，默认在中心。 |
| `["drag", sel, fx0, fy0, fx1, fy1, steps?]` | 在一点按下，以相隔一帧的 `steps`（20）次移动平滑滑到另一点，然后释放。这些是真实的输入事件（pointer id 1），因此调用 `setPointerCapture` 的处理函数能正常工作。用它测试拖拽旋转：从 `eval` 派发的 `PointerEvent` 没有活动指针，`setPointerCapture` 会抛出 `NotFoundError` 并中止处理函数。 |
| `["key", key, sel?, code?]` | 聚焦 `sel`（默认 `[tabindex="0"]`）并按下一个键：`"i"`、`"Escape"`、`"ArrowRight"`、`" "`、`"7"`。数字发送 `DigitN`，字母发送 `KeyX`，标点发送其正确的代码（`Space`、`Minus`、`Comma`…）。对共享名称的键传入 `code`：`["key", "Shift", null, "ShiftRight"]`、`["key", "Enter", null, "NumpadEnter"]`。 |
| `["slow", factor]` | 以 `factor` × 真实时间的倍率运行页面的 `requestAnimationFrame` 时间戳和 `performance.now`：`["slow", 0.05]` 是 20× 慢放，因此连拍表能用许多帧捕捉到 100 ms 的事件。`["slow", 1]` 恢复真实时间。 |
| `["until", js, timeoutMs?]` | 每 25 ms 轮询一次 JS 表达式，直到其为真值（默认 10 s），超时时打印一行。 |
| `["eval", js]` | 在页面中运行 JS 并打印结果。Promise 会被 await。 |
| `["shot", out, sel?, scale?, [x,y,w,h]?]` | 截图一个元素，或其在 CSS px 中的一个区域。 |
| `["sheet", out, every, count, sel?, scale?, [x,y,w,h]?, columns?]` | 每隔 `every` ms 拍摄 `count` 帧，并将它们平铺成一张带编号的 PNG。 |
| `["turn", value, group?]` | 3D 图：设置 `window.__isoTurn`（数字设置第一个旋转组，`group` 指定另一组，对象设置多组）并等待两帧。 |
| `["orbit", out, from, to, step, sel?, scale?, [x,y,w,h]?, columns?]` | 3D 图：跨第一个旋转组各角度的连拍表（contact sheet），每帧带标签。`["orbit", "swap.png", 129.7, 130.2, 0.1, null, 6, [x, y, w, h]]` 是一次顺序变化的 6× 特写。 |
| `["lines", out?, sel?, { tolerance }?]` | 下面的线条检查，作用于此前动作使图停留的姿态（分开、行程中）。`out` 会写出卡片，并为每个浮动端画上圈。失败会使运行以退出码 1 结束。 |

陷阱：
- **在 `scroll` 之后截图是正确的**，因此你可以滚动到页面中位置较低的图。高到足以容纳整张卡片的视口（`--height 1300`）仍然是最简单的：图在滚动位置 0 处可见，其 `IntersectionObserver` 会启动它。
- **连拍表中的帧间距是 `every` 加上截图（capture）耗时**（60–200 ms，在繁重的 WebGL 页面上更长，那里截图还会停滞动画帧）。对于比这更快的过渡，在连拍表前放 `["slow", 0.05]`，在其后放 `["slow", 1]`。`wait`、`every` 和页面的 `setTimeout` 定时器都保持真实时间，因此在 0.05 下每 100 ms 一张的连拍表相隔 5 ms 的页面时间，而空闲巡游的恢复定时器仍按墙上时间触发：一次按键只能将其挡开约 3.6 s 的真实时间，因此在每张放慢的连拍表之前要再按一次无害的键。对于加载时即开始的事件，需要页面从第一帧起就放慢：`--preload` 一个包含 `window.__driveSpeed=0.04` 的文件。
- **慢放模式不会放慢定时器。** `setTimeout` 按墙上时间运行，因此在长时间放慢截图期间，空闲巡游的恢复定时器（Raptor 的 3.6 s `quietTour`）可能重启巡游，并在连拍表制作途中关闭引擎。在每张放慢的连拍表之前，先停止巡游并等待其静止：为该定时器预加载一个桩（`const st = window.setTimeout; window.setTimeout = (f, d, ...a) => (d === 3600 ? 0 : st(f, d, ...a));`），按 `Escape`，执行 `["until", "document.querySelector('[data-readout]').textContent.includes('cold')"]`，然后才按下启动过渡的键。一张标注为 "opening" 的连拍表，如果从已经打开过的巡游开始，拍到的是关闭。
- **等待某个阶段，不要猜测。** `["until", "document.querySelector('[data-readout]').textContent.includes('main stage')", 8000]` 会在读数到达该阶段时立即返回。
- **`null` 选择器即默认值。** 在每个动作中，缺失或 `null` 的选择器都表示第一个 `.iso-plate`（对于 `key`，是可聚焦的 `[tabindex="0"]`），因此 `["sheet", "s.png", 200, 16, null, 0.5]` 拍摄的是整张卡片。
- **过长的 eval 字符串会破坏内联 JSON 的引号。** 将任何包含 `eval` 或 `until` 的内容放进 `--actions steps.json`。
- **页面把实际代码内联为 `<script type="module">`，** 因此顶层变量对 `eval` 不可见。改为通过 DOM 读取状态：读数文本、`aria-valuetext`、`data-*` 属性。要统计帧数或逐帧读取数值，请用 `--preload` 安装一个钩子（它在页面之前运行，因此可以包装 `requestAnimationFrame` 或 `HTMLCanvasElement.prototype.getContext`）。

## 线条端点
审计（audit）看到的是记录的形状，从不是线条标记，因此它看不到停在面中间的接缝、标尺线、肋条或刻度。`scripts/lines.mjs` 检查绘图本身，在无头 Chrome 中运行：

```sh
node scripts/lines.mjs page.html --out shots/lines.png
node scripts/lines.mjs page-light.html --out shots/lines-light.png --reduced
node scripts/drive.mjs page.html '[["key"," "],["wait",2000],["lines","shots/lines-apart.png"]]'
```
```
line ends: 3 of 1148 ends on 295 lines float
  iso-line faint in it k -0.080  end  7.25 px from anything   at card 507.4,407.2   length 75.7   d M392.1 381.7L507.4 407.2…
```
卡片中每条 `.iso-line` 的每个开放子路径（接缝、凹槽、来自 `fadedSvg` 的肋条、标尺线、刻度、指针、指示器、导线）都必须在另一条笔画、一个点或一条轮廓的 1 viewBox px 范围内结束，或者结束于其后绘制的填充之下。一条短的直线标记（最多 7 px：一个刻度）需要有一端在 2 px 内有所附着；两端都浮动则失败。工具库（kit）自身的轮廓、折痕、斜面和管边不受检查，被 `fadeLineSvg` 斜坡淡出的端也不受检查。`lineSvg(d, { free: true })`（或 `"start"`、`"end"`）标记一个本就应当停止的端：代表印刷文字的标尺线、指针的尾端、指示器的尖端。除此之外一概不要使用。它打印每个浮动端（以卡片 px 为单位，可直接用于 `capture.mjs --zoom`），并附上其 `d` 的开头，方便你在构建结果中找到它；`--out` 会在卡片的 2× 截图上为它们画圈。在两种主题下、在图停留的每个姿态下运行它，并修复每条线，直到它打印 0：

| 你看到的 | 修复 |
|---|---|
| 箱体上一条从角部向内缩的接缝或焊缝线 | `k.sideSeam(plan, z, P, steps)` 作为板材的 `inner`：它会绕过角部并结束于轮廓上（`craft.md` 第 3 节）。 |
| 一个面上两端都向内缩的加强筋或面板线 | 让它首尾贯穿：从该面的底部到顶部，或从一端到另一端。 |
| 在到达接缝前就停止的肋条 | `ribsOf(…, { seams: true })`，或在带两端的 `s0`、`s1`。 |
| 在光板上浮动或挂在边缘下方的刻度 | 把它们放到标尺条上，并附着在其边缘上（该面顶边上的 `topTicks` 的 `edge`、`sideTicks` 的 `top`）。 |
| 通风口或格栅线 | 闭合的槽：一个细的圆角轮廓，而不是一条线。 |
| 一条从部件下方穿过并在其刚过一点处停止的线 | 在部件之前以全长绘制它，让部件把它遮住。 |
| 标签板上的标尺线 | `free: true`。它们代表文字。 |

## 审计（audit）
截图能捕捉到你想要查看的内容。带有管道、缆线和圆形部件的图还需要检查几何，因为穿过导管的一段缆线，或绘制在位于其前方的东西之上的部件，在 1× 下不可见，在 4× 下却显而易见。将 `kit/audit.mjs` 接入构建（`kit.md` 第 12 节）：各辅助对象集中到一个 `A.recorder(P, { order, spring })`，构建调用 `A.settle(R, P)` 并以 `A.auditOrExit(R, P)` 结束，然后运行：

```sh
node examples-raptor-engine/build.mjs --audit
```
```
clearance: 0 problems
clearance apart: 0 problems
terminals: 0 ends not on a mount
loose ends: 0
screen folds: 0
support: 0 unsupported solids · 0 hanging tubes · 0 sunk pairs
depth order: 0 problems
through in mid-flight: 0 pairs
self-overlap: 0 chunks whose outline crosses itself on screen
wobble: 0 smoothed profiles whose slope turns between its ends
saddles off their host apart: 0
stand-in shapes: 0 items whose recorded shape covers too little of what it draws
crowding: 0 pairs where a bend or end touches another line on screen
free ends apart (marked free, not failing): 35
audit · 80 tubes · 267 solids · 478 items · 1119 depth states · 1707702 overlaps · 4292 order rules · 151.9 s
audit passed
```
它打印 `audit passed` 或 `audit failed: n problems`，任何失败都会以非零退出码结束。每一行都算数，包括飞行中发生的事情和 `items with no shape`，只有两个列表是供阅读的：`in passing` 和 `free ends apart`。深度顺序和穿透（管对一切，以及实体对实体）都在相同的重放帧上检查：弹簧打开和关闭直到其静止的每一帧、每个错峰边界两侧各 8 ms 内每次反转的每一帧（`reversalsOf`：0.027、0.043、0.062、0.078 … 0.393 s，在 Raptor 的 35 ms 错峰上），以及前缀状态（`prefixStates`）。深度使用这些帧中每第四帧。如何阅读并修复每一行：

| 行 | 含义 | 修复 |
|---|---|---|
| `through A × B  clearance -2.4` | 管 A 在该弧长范围内与 B 相交。 | 让 A 绕开 B 改道，留出约 1.5 个半径的余量，或移动 B。只有 A 的端缘所坐落的形状会被豁免，且仅限在该端约一个半径的范围内。 |
| `close A × B  clearance 0.2 < 0.6` | A 经过 B 时余量不足其半径的一半。 | 微调路线；加大线束车道间距。 |
| `clearance apart: through share 1 …` | 在分开状态下，一段管穿过了某个东西。 | 更改该装配的爆炸向量。 |
| `terminals: A end 1.40 from B (rim -1.1…1.3)` | A 的端，或其端法兰的缘，没有坐落在其安装座上：它浮动、倾斜，或者法兰比其下的凸台更宽。 | 让路线精确地结束于表面上，并沿表面法线；让凸台至少与法兰同宽；在曲面上，把法兰安放在鞍座上。缆线永远不结束于卡箍上。 |
| `loose ends: share 1 A end touches nothing that moves with it` | 分开时，该端悬在空中：没有另一个所有者的任何部分随它一起移动（其自身的法兰或外壳不算）。 | 给它一个能随它一起移动的安装座；或者，如果它本就应当脱开（一个带法兰的导管、另一装配上的接头），把它标记为 `free`，这样它就会作为一项选择被列在 "free ends" 下。 |
| `self-overlap: A:3 its outline folds back on screen` | 一个块的轮廓自交：线条在屏幕上以小于其自身半宽的屏幕半径转弯（一条指向观者并在接口附近转弯的管腿）。 | 让管路通过弯头球离开接口（Raptor 的 `elbow`），给转弯留出更长的直管段，或者在面向观者的平面内弯曲（Raptor 的 `sideOn`，`craft.md` 第 8 节）。 |
| `wobble: A dr/ds turns at s = …` | 由键入的型值点平滑而来的轮廓，其斜率出现平台并反转，因此其色调带呈阶梯状。 | 给它一个解析的 `r(s)`，并传入 `smooth: { slope }`。 |
| `saddles off their host apart: A (piece) is cut to B (host piece)` | 一个鞍座随另一装配飞走，露出其被切割的基面。 | 把该垫划归宿主的装配；移动的管随之离开其平整面。 |
| `solid  state  A × B  sunk 1.81 deep` | 在该帧中，不同装配的两个实体互相穿过。 | 与管相同：修复顺序或向量，或打开悬垂下方的间隙。 |
| `screen folds: A turns 150° on screen for 78° in 3D` | 路线在屏幕上折回，读起来像一个尖点。 | 让转弯前的管腿在屏幕上侧向走。 |
| `screen folds: A turns 110° on screen round a 0.4 px bend` | 一个可见的弯折收缩成一个点：其圆角被侧视看到，于是两条管腿以 V 形相接。 | 在接头内转弯（一个三通球，线条以 45° 离开），在面向观者的平面内弯曲，或移动接口，使其法线横跨屏幕。 |
| `through in mid-flight: apart 0.233 s A × B clearance -1.6` | 在该重放帧中，A 穿过 B。 | 修复顺序或向量（`motion.md`，"Order the stagger"）：外侧的部件先离开，指向另一装配表面的向量需要该装配更早离开，螺纹部件共享一个弹簧。 |
| `crowding: A bend × B outlines overlap 0.05 px` | A 的弯折或端落在屏幕上 B 的轮廓上，读起来像一个接头，或一条穿过 B 的线。 | 改道，使交会处成为两条直线的清晰交叉，或留出一个可见的间隙。只有在以 8× 查看过之后，才可以豁免一对（`allow`）。 |
| `crowding: A end × B (rod)` | A 的端或弯折落在一个细长实体的轮廓上：拉杆、活塞杆、立柱、导轨或手柄（任何长于其半径或半宽 4× 的实体）。这读起来像杆插入了 A 的接头。 | 横跨杆接近接口，或转动弯头，使最后一段管腿横跨屏幕。 |
| `stand-in shapes: A its shapes cover 4% of its drawing` | 为 A 记录的形状覆盖的屏幕范围远小于 A 所绘制的，因此审计只检查了一条细片，对其余部分无从谈起。 | 记录你所绘制内容的真实形状（对于从密封套中滑出的杆，用 `A.slide`）。只有当其绘制确实超出其本体时，才可以豁免一个项目（`cover: [name]`），并且只有在查看过之后。 |
| `crowding: C fitting × B` | 一个卡箍落在另一条线的 2 px 范围内，读起来像那条线从它上面长出来。 | 更改爆炸向量或卡箍的角度。 |
| `support: loose A` / `hanging A` / `sunk A × B 1.2 deep` | 一个实体，或一段刚性管，没有接触到任何通向支架的东西，或者被埋入 B 中。 | 添加固定它的支架、螺柱或板；对于下沉的部件，修复接触（缘落在表面上；由其宿主切割出的垫标记为 `seated`，`seated` 只在其 `cut` 中豁免宿主）。 |
| `order  A is in front of B but drawn first` | 在它们重叠的任何地方，A 的表面都更近，但 B 画在了它上面，无论是在静止时还是在飞行中的帧里。 | `orderKeys` 通常会修复这些问题；剩下一个意味着某个循环中漏掉了一条规则，因此到该循环中寻找互锁的一对。 |
| `cycle  A … (n the other way)` | A 和 B 在某个地方各自位于另一个的前方：它们在屏幕上互相穿插。 | 更改几何：在其套环处给管留缝、在环处断开带、让杆结束于球上、使涡卷相切、把阀门放到直管上、让垫避开其宿主的轮廓。 |
| `in passing` | 只出现在均匀状态下的互锁，或无法被任何 `k + lift · share` 排序的情况（所有装配处于同一 share，页面从不显示这种状态）。 | 不是失败。同一件事出现在重放帧中就是 `depth order` 问题。 |
| `items with no shape` | 有东西被绘制却没有记录的形状，因此没有任何东西检查它。 | 在绘制它的辅助函数中记录它。 |

零问题的审计（audit）是必要的，但不是充分的：它看不到接缝、阶梯或中途停止的纹理，而且它只检查你记录的内容。一个能让审计（audit）沉默的代用形状是 bug，审计（audit）正因如此才会让它失败。运行线条检查，然后查看。

## 环绕（3D 图）
带有旋转组的图（`references/3d.md`）会增加环绕审计和浏览器检查。在浅色页面和深色页面上运行它们。
```sh
node build.mjs --light --audit > audit.txt 2>&1 &   # the full run, in the background: ends "turn audit passed"
node build.mjs --light --audit --quick    # ≈ 10× fewer states while iterating: ends "turn audit quick"
node build.mjs --light --audit --quick --only=order,continuity   # a subset: the rest print "skipped", ends "turn audit partial"
node build.mjs --light --verify           # a page with window.__isoVerify (recorded shapes) for --order
node ../../scripts/turn-check.mjs build.mjs --fidelity
node ../../scripts/turn-check.mjs page-verify-light.html --order --step 1
node ../../scripts/turn-check.mjs page-verify-light.html --order --states clip.json     # hinges and clips: --step turns the first turn group only
node ../../scripts/turn-check.mjs page-light.html --pops --no-webgl --states tilt-path.json   # one hinge as a continuous path at 0.02°
node ../../scripts/turn-check.mjs page-light.html --pops --no-webgl --step 1 --out shots/pops
node ../../scripts/turn-check.mjs page-light.html --lines
node ../../scripts/turn-check.mjs page-light.html --perf --width 1440
node ../../scripts/turn-check.mjs page-light.html --perf --width 390 --throttle 4
node ../../scripts/drive.mjs page-light.html '[["orbit", "shots/orbit.png", 0, 345, 15]]'
```
**时间。** 一个包含一次旋转、一个铰链和一个片段的 28 部件图，快速运行耗时 85 s，完整运行耗时 17 分钟，超过了 10 分钟的 shell 超时：请在后台运行完整审计。快速运行会欠采样（`continuity` 检查 100 个二分候选而不是 800 个，顺序扫描只覆盖十分之一的状态），因此它们只起指引作用，只有完整运行得到的 `turn audit passed` 才算数。带 `--only` 的运行以 `turn audit partial` 结束，绝不会是 `passed`。

**状态。** 审计（audit）以 0.3°（order）和 0.05°（continuity）扫描每个旋转组，外加 2000 个随机状态和每个顺序变化事件 ± 0.001°。运动片段（`clips: [{ name, at(t), from, to, frame }]`）会被逐帧走过：一个手势、一次抓握、一次拆开。自由组和铰链组只在你给定的状态上得到验证，因此要给出每个片段，并在多个旋转角度下给出。

**各行。** `separation`、`unseparated`、`cycles`、`forced`、`swaps`、`layers`、`rigid`、`swept`、`posed`、`folds`、`self`、`crowding`、`endon`、`coverage`、`depth`、`continuity`。`3d.md` 第 13 节列出了每一行的失败与修复。一个植入的故障会让对应的行失败：一个下沉的垫（`separation`）、三根倾斜棍子呈风车状排列（`cycles`）、在竖直平面内弯折的纤维（`folds`）、呈 30° 的管（`endon`）、一行中途停止的肋条（`continuity`）。

**浏览器检查**（每项先运行其对照；对照没有失败，即意味着该检查本身已坏）：
- `--order`：WebGL z 缓冲中记录的形状与 DOM 的填充相对照：在每个角度和片段状态下，具有 4+ 内部像素的活动对为 0。
- `--pops`：每度的第一差分（θ → θ + 0.02°）和整圈旋转上 0.1° 的第二差分：存活区域为 0，6+ px 的核为 0。阅读它列出的 1–5 px 的核。
- `--lines`：24 个角度下浮动端为 0。
- `--perf`：`3d.md` 第 15 节中的各项预算，在 1440 和 390 下以 4× CPU 测量。

**环绕连拍表。** 0–345° 每 15°，然后在三个最大的顺序变化上以 0.1° 步进（由审计（audit）列在 "order changes" 下），然后每个片段放慢（`["slow", 0.05]`）。阅读它们，寻找蜘蛛角度（从某个侧面看像腿的手）、消失在其他部件背后的部件，以及结束在另一部件轮廓上的线。

### 3D 图检查清单
- [ ] `turn audit passed`，使用完整状态集（不是 `--quick`，不是 `--only`），包含各片段。
- [ ] 对每个铰链和片段在 `--states` 上运行 `--order`；对每个铰链在 0.02° 路径上运行 `--pops`（`3d.md` 第 14 节）。
- [ ] `turn-check` 的 order、pops 和 lines 均为 0，fidelity 通过，每个对照都按设计失败。
- [ ] 以 15° 阅读环绕连拍表；每个关节、交叉处和纹理端在 8 个角度下的 8× 裁剪，浅色和深色都要。
- [ ] 在浅色页面上材质读起来像金属：高光带随旋转移动，在色调交叉淡变时没有任何跳变。
- [ ] 每个锚定到其组的着色器在 0.1° 步进下跟随该组；世界效果不旋转；墨在遮挡笔画处停止（8× 裁剪覆盖遮罩与部件相接处）。
- [ ] 已在 1440 和 390 × 4 下测量预算；如果密集的图需要，使用半速率开关。

## 特写
所有者是在浅色主题的一张特写中发现 Raptor 的缺陷的：主导管上方的缆线、一个呈阶梯状的钟体、完全停滞的螺栓行。在任何人之前，自己在所有地方拍摄那张特写。

1. **构建两种主题**（`node build.mjs` 和 `node build.mjs --light`）并列出各连接处：每个法兰、三通、弯头、球接头、卡箍、阀门、波纹管、带、鞍座和交叉处；每个曲面体（钟体、喉部、穹顶、锥体、阀门凸包、球）；用 `bandsOf` 切割的体的每个带接缝；以及每处纹理结束的地方。平面部件也要列出：箱体每个面上的每条接缝、焊缝、加强筋和饰线（它到达两个角了吗？）；板上每行刻度或标记（它在标尺条上吗？）；每条肋条沿其轴的两个端；每根带纹理的软管在块接缝处和在其套圈处；每根滑动的杆（在静止、行程中和全行程时）；以及每个内含文字或着色器内容的窗口或屏幕。
2. **在两种主题下、在装配状态下，以 4× 拍摄每个区域。** `--zoom x,y,w,h` 取卡片 px 中的一个区域，并按 `--zoom-scale`（4）缩放：
   ```sh
   node scripts/capture.mjs page.html --out shots/joint-dark.png --zoom 200,80,220,170
   node scripts/capture.mjs page-light.html --out shots/joint-light.png --zoom 200,80,220,170
   ```
3. **还有分开状态**，如果图可以分开。用脚本驱动（drive）到该状态，等待静止，然后以 4 倍缩放拍摄一个区域。Raptor 以空格键切换为分开状态，且只有在每个弹簧都到位之后，其读数才以 `apart ·` 开头，因此 `apart.json` 为
   ```json
   [["key", " "], ["until", "document.querySelector('[data-readout]').textContent.startsWith('apart')"], ["wait", 400],
    ["shot", "shots/apart-joint.png", null, 4, [200, 80, 220, 170]]]
   ```
   用 `node scripts/drive.mjs page.html --actions apart.json` 运行，然后在 `page-light.html` 上再运行一次。
4. **按此顺序查看每张 PNG 中的这些缺陷：** 一条穿过或进入某个东西的线；一个其较近的线被画在后面的交叉；一个落在另一条线轮廓上的弯折、端或卡箍；一个从其接口翘起或沉入其中的法兰；曲面上成阶梯状的色调块、扇贝纹或一个浅色楔形；一个以直切结束的带；一行在表面中间停止的肋条、点或标尺线；块接缝处横跨管的高光或暗部的细线；一条在轮廓上切出缺口的接缝；一条在到达它应当到达的边缘前停止的接缝、加强筋或肋条；一个碰不到任何东西的顶部短标记；一个边缘直硬的软管纹理，或一个在块接缝处重新开始或被切断的软管纹理；一根在移动时轮廓断裂的杆；越过其窗口的文字；溢出一个开口之缘的着色器内容。与上一轮同一区域的拍摄进行比较。
5. **着色器：** 效果期间的相同区域，加上用 `["slow", 0.05]` 放慢的连拍表（contact sheet）（`webgl.md` 第 9 节）。

**细节遍查。** 最后，以 4× 在一组网格裁剪中扫查（Figure 拍其主体和机构，Hero 或 Epic 拍整幅图；`SKILL.md` 工作流第 1 步），寻找任何上面没有真实内容的面、角或基座片段。每个图都高度详细（`SKILL.md`，"Every creation is highly detailed"）：添加属于那里的真实部件（螺钉、接缝、斜面、标签板、刻度尺、固定东西的支架），绝不添加不属于任何部件的装饰。

## 浅色主题着色器
浅色是发布主题，而在纸上，辉光就是墨。到目前为止，每次浅色转换都首先在单帧图像无法显示的东西上未通过评审：光下降时墨上升、辉光出现前的浅色闪光、一个鲑鱼色阶段、笔画旁的浅色边纹。因此，既要查看墨，也要测量墨（`webgl.md` 第 8 节）。

**每帧墨量。** 将此保存为 `ink.js` 并通过 `--preload` 传入。在页面绘制的每一帧中，它记录一个画布区域铺在白上的平均墨量，即 `255 − lum(rgb + 255 − a)`，在与绘制相同的任务中读回：
```js
const get = HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext = function (kind, ...rest) {
  const gl = get.call(this, kind, ...rest);
  if (gl && String(kind).startsWith("webgl") && !this.__gl) {
    this.__gl = gl;
    for (const name of ["drawArrays", "clear"]) {
      const call = gl[name].bind(gl);
      gl[name] = (...args) => { gl.__drew = true; return call(...args); };
    }
  }
  return gl;
};
const raf = window.requestAnimationFrame.bind(window);
window.__ink = [];
window.requestAnimationFrame = (callback) => raf((now) => {
  callback(now);
  const canvas = document.querySelector(window.__inkCanvas || "canvas");
  const gl = canvas && canvas.__gl;
  if (!gl || !gl.__drew) return;
  gl.__drew = false;
  const [x, y, w, h] = window.__inkBox || [0, 0, canvas.width, canvas.height];
  const px = new Uint8Array(w * h * 4);
  gl.readPixels(x, y, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
  let ink = 0;
  for (let i = 0; i < px.length; i += 4) {
    const bare = 255 - px[i + 3];
    ink += 255 - (0.2126 * (px[i] + bare) + 0.7152 * (px[i + 1] + bare) + 0.0722 * (px[i + 2] + bare));
  }
  window.__ink.push(Math.round((ink / (w * h)) * 100) / 100);
});
```
- **选择要测量的内容。** 在过渡之前，用一个 `eval` 设置 `window.__inkCanvas`（一个选择器）和 `window.__inkBox`（画布的 device px 中的 `[x, y, w, h]`，自其左下角起算；用 `canvas.width / canvas.clientWidth` 把 CSS px 换算过去）。之后用 `["eval", "window.__ink.join(' ')"]` 读取各行。
- **每个要紧的区域做一次：** 一个腔体、核心，或一个只有回退覆盖的区域。放慢运行它，跨越初光（`--preload` 一个包含 `window.__driveSpeed=0.04` 的第二个文件）、每次相位变化和淡出。
- **要寻找什么。** 墨单调地跟随物理量：光进来时上升，光离开时下降。交接处没有凸起，初光时没有下陷。
- **它捕捉到了什么。** 加力燃烧室的腔体在修复前那一版上峰值为 3600；此后它从 1894 单调下降到 155。那些数值行以该图自身的单位计，是其窗口区域上的总和，而非此钩子的均值。在波纹槽的浅色页面上，该钩子在静止时读数为 14.2，并随着灯亮起而下降，因为那个页面的光会提亮纸面。

**沿斜坡的颜色。** 对于任何会加热或冷却的东西，在若干个温度下（或一个放慢运行中相当于若干个温度的量）用 `eval` 读取中心和缘的像素，并把它们记下来。顺序必须是暗红 → 橙 → 黄 → 近白，缘比中心更冷，途中没有鲑鱼色或灰色阶段。

**横截面。** 读取横跨火焰、射流或流的一行墨。它在轴上达到峰值，并下降到半透明的边缘。偏重边缘的剖面是一个空心的、仅有轮廓的火焰。

**8–16× 下的笔画。** 在浅色下以 8–16× 裁剪每一处墨与 SVG 笔画相接的地方（切面、缘、口、折痕、有物体进入的画布边缘）。寻找墨与线之间的浅色间隙、压在线上的墨，或被墨清掉的笔画。

**两条路径，以及嵌套情况。** 深色构建应当与其基线一致，因为每处浅色更改都以 `uLight` 为门控。在浅色页面上渲染一个深色板，并单独渲染一个浅色板，每种情况都在有 WebGL 和无 WebGL 下各做一遍：一条 `:not([data-theme="dark"])` 规则可能穿过页面作用到深色板上。

## 评审检查清单
**它是一个物件**
- [ ] 一眼看去，它读起来像一个真实的、制作精良的物件，而且你能叫出它的名字。
- [ ] 它的机构映射到概念：什么在动、那意味着什么，可以用一句话说清。
- [ ] 它不是一叠抽象的板，也不是一块光秃秃的板材。

**部件与体量**
- [ ] 内联图 30–60 个实体；一个确实有更多部件的主角主体可以远超此数（Raptor 约有 270 个）。每个部件都倚靠在另一个部件上，并且各有其功用。
- [ ] 侧面着色、顶部较亮；主板材上有斜面；基座下方和被抬起的部件下方有光晕。
- [ ] 小细节属于部件：板角处的螺钉、凹槽、标尺、滚花、标签板。

**线条**
- [ ] 在 4× 下，每条线都结束于一个面、另一条线或一个终端点。没有任何东西停在空中。
- [ ] 没有引出线、气球标注、尺寸箭头或浮动标签；最多一个蚀刻标签。
- [ ] 画家顺序（由后向前绘制）处处正确：后面的东西不穿透显示，弹簧和框架被拆分。
- [ ] **审计（audit）归零。** 当图中含有管道、缆线或圆形部件时，`node build.mjs --audit` 以 `audit passed` 结束：每条会失败的行的数值都为零，包括装配状态、分开状态以及重放爆炸的每一帧（打开、关闭和反转）。没有用键偏置隐藏任何互锁，每一对被豁免的对（`allow`、`crowd`）都已以 8× 查看过。
- [ ] 没有管道或缆线穿过另一条管道、缆线或实体，并且每个交叉都按深度顺序绘制：较近的线在上面，在直管段上交叉，在深度上充分分开。
- [ ] 没有线在本可以沿结构旁边走的时候横穿主体的表面；屏幕上没有弯折收缩成 V；装配或分开状态下，没有弯折、端或卡箍落在另一条线的轮廓上。
- [ ] 每个法兰都坐落在其接口上（若接口是曲面，则坐在鞍座上）；每个套环、卡箍、带、波纹管和阀门都与它所缠绕的管之间留有间隙；每个阀门和波纹管都坐在一段直管上；屏幕上没有路线折回；每个端（分开时也一样）都结束于一个法兰、联轴器、接头或终端点。
- [ ] **连接处特写。** 每个连接处都已以 4× 在两种主题下、装配和分开状态下拍过（见"特写"），并且每张 PNG 都已看过。
- [ ] **无阶梯。** 每个曲面在 4× 下都是平滑着色的：没有阶梯状的色调块、没有扇贝状台地、没有浅色楔形、没有以直切结束的带、带接缝处没有扭结；收腰的体遵循其真实轮廓；接缝与轮廓相接处没有缺口。
- [ ] **线条端点归零。** `node scripts/lines.mjs` 在两种主题下和每个静止姿态下都打印 `line ends: 0`；每个 `free` 端都是代表文字的标尺线、指针尾端或指示器尖端。
- [ ] **形状真实。** 没有代用形状：记录的就是绘制的，包括会滑动的杆。
- [ ] **无突兀的纹理端。** 每行肋条、螺栓点、标尺线或凹槽都结束于一个真实的边缘或淡出；没有一行在表面中间以全强度停止，平面也包括在内。箱体上的接缝绕过其角部，肋条行结束于其接缝，刻度坐在标尺条上，软管上的纹理遵循其横截面并穿过每个块接缝。管道条纹延伸到其端盖上，并在任何块接缝处都不显示细线，在强弯曲的锥形管（涡卷）上也是如此。

**色调与颜色**
- [ ] 基座 `lo`、结构 `mid`、主体 `hi`，恰好一个 `lit` 强调色。
- [ ] 单色，除非颜色就是主体。

**卡片与文字**
- [ ] `Fig n` / 标题 / 提示 / 实时读数在角上，图例键和说明文字在卡片下方。
- [ ] 每个数字都真实且来自模型。读数随东西的移动而变化，其文字和数字来自同一时刻：模型给出的阶段词旁边配上滞后仪表给出的数字，会在阀门开启前读出 `relief 85 bar`。
- [ ] 机器显示的文字在其最宽字符串下适配其窗口，并被裁剪到窗口内。

**动态与可访问性**
- [ ] 缓动、平静、无突变；有空闲巡游；交互时暂停。
- [ ] 离屏时停止；在 `--reduced` 下静止；无控制台错误（包括 React key 警告）。
- [ ] 键盘可用，焦点环显示，`aria-valuetext` 用文字读出状态。

**着色器（如果图有；`references/webgl.md`）**
- [ ] 一张跨越每次过渡（开始、每次相位变化、稳定、停止）的连拍表（contact sheet），用 `["slow", 0.05]` 放慢（或对加载时即开始的效果，用 `--preload` 加 `window.__driveSpeed=0.04`），使每次交叉淡变的每一帧都显示出来：没有突然的颜色切换、没有单帧闪光、没有东西被切掉，并且淡出期间亮度绝不上升。
- [ ] 效果与 SVG 相接处的 2× 和 4× 裁剪：没有接缝、硬边、带状纹、深色套环或双线；平面上的东西与该平面的线对齐。
- [ ] 画布的外围行和列在每个相位下都读出 alpha 0。
- [ ] 没有 WebGL（`--no-webgl`）时，单靠 SVG 仍然可读；在减弱动态下，你得到一个静止的、有代表性的帧；循环在空闲和离屏时停止。
- [ ] **浅色主题**（`webgl.md` 第 8 节；上面的"浅色主题着色器"）：
  - 辉光通过饱和度来表现，具有饱和的主体、浅色的核心和带颜色的缘，绝不表现为深色或棕色的墨。
  - 光所照到的东西被着色，容纳光的腔体是更深的物理基底。
  - 热的体按黑体顺序变化，没有鲑鱼色阶段。
  - 烟和蒸汽是浅灰色。
  - 空气中没有光晕。
  - 每帧墨量在初光、每次交接和淡出过程中都单调地跟随光。
  - 在 8–16× 下，墨停在每条笔画的内缘。
  - 回退显示相同的墨和基底，并在没有下陷的情况下交接给着色器。
  - 深色不变，浅色页面上的深色板仍然有效。

**构图**
- [ ] 居中，填充约卡片的 55–65%；不触碰角上的标签。
- [ ] 在 390 px 下仍然可读，无横向滚动，包括在选中部件时和燃烧期间，不仅在静止时：最长的读数不得伸到控件下方。

## 常见缺陷与修复
| 你看到的 | 修复 |
|---|---|
| 一个部件从位于其前方的东西中透出 | 它画得太晚。把它移到更早绘制，或拆分前面的部件。 |
| 一个椭圆在立柱与面相接处横穿立柱显示 | 在延续的圆柱上绘制的完整 `ring` 会显示其后半。使用 `sideArc`（仅前半），或让圆柱自身的轮廓构成该边缘。 |
| 一根立柱看起来贴在它穿过的块上 | 分两段绘制它，下方一段、上方一段，块画在它们之间。 |
| 一条折痕或斜面在到达角部前停止 | 在 `slabOf`/`cylinder` 上使用 `bevel`。它已经结束于轮廓上。不要手绘边缘线。 |
| 平坦、死板的侧面 | 你传了 `flat`，或该实体高度为 0。给它厚度。 |
| 太稀疏 | 添加结构，而不是纹理：支脚、带标尺和端挡的导轨、标签板、螺钉、旋钮、第二级。 |
| 太杂乱 | 把类似纹理的重复和色调凹槽降到 `faint`；保留一个 `lit` 强调色。 |
| 图在卡片中太小 | 用更小的 `pad` 适配，或收紧传给 `fitProjection` 的点。 |
| 标签页重新获得焦点时它跳变 | 把 `dt` 限制在 1/30 s。 |
| 只有在大页面上出现 key 警告 | 见 `react.md`：给元素 props 的根加 key。 |
| 着色器颜色在相位变化时跳变 | 给颜色自己的慢包络，并从物理量驱动它，而不是从相位标志驱动。见 `webgl.md` 第 7 节。 |
| 辉光中的直边，通常在画布边界处 | 某一项在边界处不为零。在每个 `if`、边界和画布边缘之前，对它加窗到零。 |
| 辉光穿过地板或越过立柱 | 它处于屏幕空间。用光线和地面命中在世界空间中重建它，并把简单部件作为遮挡物交给着色器。 |
| 发光缘下方的深色套环 | 该缘以 normal 混合叠在着色器上。把它移到带 `mix-blend-mode: screen` 的叠加 SVG 上。 |
| 柔和辉光中的平坦色带 | 在 `tonemap` 之后添加门控三角抖动。 |
| 浅色下，辉光读起来像深红或棕色的烟 | 那是把深色再加深，alpha 设为亮度。从一个纸面斜坡求解墨，要有饱和的主体、浅色的核心和一个 alpha 下限（`webgl.md` 第 8.1 节）。 |
| 浅色下，初光先变浅再变深，或淡出变灰或变重 | 逐项淡变、仅 alpha 的淡变，或在固定 alpha 下发红的色相。把成品墨一次性淡变，能量和 alpha 一起调暗，色相取在稳定亮度下（`webgl.md` 第 8.2 节）。 |
| 浅色下，沿边缘的浅色边纹或白缝 | 墨在笔画前停下，或清开了一条没有人描的折痕。让它在笔画的内缘（0.3 vb）结束，并用墨画出折痕（`webgl.md` 第 8.6 节）。 |
| 深色板的回退在浅色页面上消失 | 一条 `.iso:not([data-theme="dark"])` 规则穿过页面匹配到了。把深色规则放到最后，或键接在板自身的主题上（`webgl.md` 第 8.5 节）。 |
| 一段管道或缆线看起来贴在部件上或切入部件 | 它的各段在同一层中。按 `mid` 对每个 `tubePieces` 块做深度排序，并在它穿梭处使用更短的段。如果它真的穿过该部件，就改道；`--audit` 列出每种情况。 |
| 缆线或感应线呈扇形展开在主体的表面并越过主导管 | 它们是点对点布线的。沿结构重新布线：沿管道旁边上行，以受卡箍约束的车道绕体，绕侧面到远处的接口（`craft.md`，"Choosing waypoints"）。 |
| 修复一个交叉的顺序会破坏另一个，或破坏分开姿态 | 键是手工调的。记录形状，让 `A.settle` 设置键，并修复它报告为互锁的几何。 |
| 套环、带或卡箍遮住管的近侧，或管画在套环的面上 | 管作为一个整块穿过它。在套环处给管留缝（`gaps`），使一段结束在每个面上。 |
| 体上的环在体上显示出其后半 | 该体在环下方是一个长带。在环处把它断开。 |
| 阀门或波纹管在两端切入其管 | 它坐在弯折处。把它移到一段直管上，长度至少为它自身长度加上两处圆角切除。 |
| 钟体、穹顶或锥体上的阶梯状色调块 | 小平面着色。把弯曲的型值点标记为平滑（`[s, r, 1]`，默认平滑着色），或传入 `smooth: true`；用 `G.bandsOf` 把体切成带。 |
| 喉部、锥体或圆盘上的色调带停滞并呈扇贝状顿挫 | 手工键入的型值点的平滑轮廓：其斜率在每个型值点处出现平台。把轮廓写成解析的 `r(s)`，并把其导数作为 `smooth: { slope }` 传入（`wobble` 会列出它们）。 |
| 平滑着色部件内部的细缝 | 色调片彼此紧贴。使用工具库（kit）的 `solidSvg` 配合 `seamless` 路径（平滑车削和 `sphereOf` 会设置它）以及 `ISO_CSS`。 |
| 一行肋条或螺栓点在表面中间停止 | 一个生硬的 `least` 截止。在 `ribsOf` 或 `dotsOf` 上使用 `fade: [lo, hi]`。 |
| 平滑着色的锥体或钟体上带直边的浅色楔形 | 色调片之间的裸填充：同一色调的片以相反方向缠绕，在 nonzero 规则下相互抵消，或一个带结束时没有收窄。工具库（kit）会为每个色调多边形定向并给带收窄；如果你自己构建色调路径，就给它们定向。 |
| 一个收窄的体看起来像一个带浅色条纹的直锥 | 它被包壳了。让 `lathe` 选择 `fill: "auto"`（或传入 `"surface"`）。 |
| 一条细线横跨管的高光或暗部带 | 在块接缝处，体和条纹切在同一条线上。`tubePieces` 让条纹越过体；如果你改它，保留这一点。 |
| 接缝与轮廓相接处轮廓呈虚线 | 接缝画在实体之后。把它们作为 `inner` 传入。 |
| 管道的条纹在其端部前停止 | 一个没有盖的端。`tubePieces` 默认给每个端加盖；对于可见的端，不要传 `caps: false`。 |
| 图分开时部件沿其安装座滑动 | 它们以另一装配的弹簧上某一装配的向量移动。给该项目该装配的 `ride`。 |
| 一个长车削体在带接缝处有扭结的轮廓 | 用 `G.bandsOf` 构建它，并用其 `sidesOf` 一次性绘制各侧面（`kit.md` 第 10 节）。 |
| 一条纹理线在面的中间停止 | 让它结束于一个真实的边缘，或用 `fadeLineSvg(points, { fade })` 绘制它，使其渐出。`scripts/lines.mjs` 列出每一条。 |
| 箱体上的一条接缝在到达其角部前停止 | `k.sideSeam(plan, z, P, steps)` 作为 `inner`。 |
| 边缘直硬的软管编织层或波纹，或在块接缝处断裂 | `tubePieces(…, { rings: { pitch, twist, cross: true } })`。 |
| 杆滑动时其轮廓出现缺口 | 一根来自 `G.rodOut` 的杆，在密封套处裁剪，用 `A.slide` 记录；绝不使用重叠的副本。 |
| LCD 或计数器数字越过窗口 | 让字体适配窗口的高度和最宽字符串，并裁剪它。 |
| 阀门或凸包上散落的轮廓三角形 | 旧工具库（kit）连接了一段断裂的轮廓；当一侧的轮廓有缺口时，工具库（kit）现在回退到凸壳。用当前的 `lathe.mjs` 重建。 |
