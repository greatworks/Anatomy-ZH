# React 与 Next.js

## 一个图的文件布局
```
components/iso/                 the kit: iso-kit.ts, iso.css, react/draw.tsx, react/live.tsx
components/figures/rig/
  model.ts       pure model: true numbers, springs, readout text (no DOM)
  view.ts        world layout constants, the projection P (fitProjection), helpers like at(point)
  geometry.ts    every static path, computed once at module load
  frame.ts       paths for the parts that change shape: frameOf(state) -> { glass, coils, needle, ... }
  art.tsx        server component: static parts as JSX constants, passed to the live component
  live.tsx       "use client": refs, loop, pointer and keyboard, aria, writes the readout
  rig.css        scoped tokens and styles (e.g. .rig { … })
  figure.tsx     <Plate fig title hint readout keys caption><RigArt /></Plate>
```
`examples-test-rig/` 遵循此布局。它用 `rig.ts`、`view.ts`、`geometry.ts`、`pose.ts`、`art.tsx`、`live.tsx` 和 `figure.tsx`。

## 服务端/客户端拆分
- 几何是纯 TypeScript，所以它在服务端运行，客户端收到的是成品路径字符串。除非某个运动部件需要每帧重建，否则不发布几何代码。此时 `frame.ts` 由 `live.tsx` 导入并发布到客户端。
- `art.tsx` 把静态部件构建为 JSX（`<Solid paths={BASE_ART.slab} tone="mid" />` 等），并作为元素 props（如 `base`、`rail`、`carriage` 和 `dial`）传给 `"use client"` 实时组件。实时组件按绘制顺序摆放它们，并把运动部件包进 `<g ref>`。
- 只有实时组件与 `kit-react/live.tsx` 是客户端代码。`draw.tsx` 是服务端安全的。

## 大页面 key 警告陷阱
在大页面上服务端载荷很大，React 会把一些元素 props 作为延迟（懒加载）块流式传输。客户端在兄弟节点中渲染 `{props.dial}`。它无法把懒加载标记为已检查 key，于是懒加载一旦解析为没有 key 的元素，React 就会记录 "Each child in a list should have a unique key"，指向你的实时组件或 `IsoFigure`。同一个图在小测试页面上什么都不记录，所以一次只查一个图会漏掉它。

有两个修复，你应该从一开始就都做：

1. **给每个元素 props 的根一个稳定的 key：** `const DIAL = (<g key="dial">…</g>)`，片段用 `<React.Fragment key="sled">`。单个元素上的 key 不花代价。
2. **让 `"use client"` 组件远离服务端构建的美术。** 服务端树里的每个客户端组件元素都会变成懒加载引用，这会让它的所有祖先也变成懒加载。如果美术的某些部分需要交互性（例如悬停高亮），就把它们做成朴素的 `<g data-part="…">`，并在实时组件中用事件委托处理事件。

你用 `.map` 构建的任何数组照例需要 key。

## 样式
- 全局或在图内导入一次 `iso.css`。在包装器（或 `<body>`）上放 `className="iso"` 以启用 token，浅色主题再加 `data-theme="light"`。
- 把每个图的 token 限定在图的类中（`.rig { --rig-glass-top: … }`），并仅在卡片需要时才在 `.iso-plate` 内覆盖工具库 token。
- 不要把图的 token 放在 `:root` 上。

## 读数
`useReadout()` 从其 `anchor` 找到最近的 `.iso-plate [data-readout]`，`say(text)` 写入它而不重新渲染。在服务端渲染静止文本，使水合前它就是正确的。

## 水合
在服务端与客户端首次渲染时都渲染静止姿态；只在 effect 中启动动态。渲染时不要读 `window`。`asksForStillness()` 是安全的，因为它只在 effect 与循环内调用。
