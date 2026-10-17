# 把图发布到社区画廊

本功能依赖 GitHub 与 gh CLI，并且只会在用户明确要求分享或发布时才会执行；未经用户明确同意，不会自动向外部发送任何数据。

社区画廊是仓库 `wheresryan22/anatomy-community`。人们在那里分享纯 HTML 图：一个把独立页面写在自己旁边的构建脚本，如本技能的示例所做，可用任何主题。React 与 Next.js 图不能提交。

只在用户要求分享或发布一个图时才发布。没有他们明确同意，绝不发送任何东西。

## 步骤

1. **确认图已完成。** 它的页面已构建且为最新，线条检查通过，有管道、电缆或圆形部件时 `--audit` 通过，开启减弱动态时保持一个静止姿态。画廊也会检查这一切。
2. **向用户索取只有他们能提供的东西：**
   - 他们的 GitHub 用户名（作者）；`gh api user --jq .login` 显示 GitHub CLI 当前登录的是谁；
   - 一个标题（最多 80 个字符）与一个短的 kebab-case id；
   - 许可证：MIT（默认）或 CC-BY-4.0；
   - 确认这是他们自己的作品且他们乐意分享。
   提示词是做出该图的那个请求；复用它，裁剪到 600 个字符。
3. **获取画廊的本地克隆**，若他们还没有：`gh repo clone wheresryan22/anatomy-community -- --single-branch`（只取 `main`：previews 分支保存每张图片，会变得很大）。克隆主仓库没问题：提交步骤会在他们需要时为他们创建复刻。
4. **展示计划**，不做任何实际操作：
   ```sh
   node <skill>/scripts/publish.mjs <figure folder> --into <clone> --id <kebab-id> \
     --title "..." --author <github user> --prompt "..." \
     [--agent "Claude Code"|OpenCode|Codex|Antigravity|Other] --model "..." [--minutes 45] [--tokens 1.2M] \
     [--license MIT|CC-BY-4.0] \
     [--tags a,b] [--audit] [--pages a.html,b.html] --submit --dry-run
   ```
   `--agent` 传你运行所处的 agent，`--model` 传你使用的模型（画廊要求此项，如 `claude-opus-5-5` 或 `gpt-5-codex`）。在 Claude Code 中，制作耗时与消耗的 token 会自行从本会话日志读取：从做出该图的请求到发布它的请求，10 分钟以上的空闲间隙排除，缓存读取不计。在其他 agent 中，如果你能看到会话用量就传 `--minutes` 和 `--tokens`；否则宁可留空也不要猜。把计划读回给用户：它会点明复刻（如有）、分支、新增的文件夹以及拉取请求发往何处。
5. **只有在用户同意之后**，才用 `--yes` 代替 `--dry-run` 运行相同命令。它只把图的源代码拷入 `figures/<author>/<id>/src/`，把它的工具库导入指向克隆的 `.skill/` 链接，记录工具库指纹，检查构建，把预览保存到 `shots/<author>-<id>/preview.png`，然后只提交那个文件夹、推送并打开拉取请求。把它打印出的链接给用户。
   - 如果它说某个文件伸到了图文件夹与技能之外，就把该文件所需的内容拷进图文件夹，重新构建，再发布一次。
   - 如果它无法分辨哪些页面是这个图，就传 `--pages`。
   - 以后要发送更新版本，用 `--force` 再跑一次；它会更新同一个拉取请求。
6. **不带 `--submit`** 时，脚本在准备好文件夹后停下，改为打印 git 与 `gh` 命令；用户想自己发送时就用这个。

没有终端的人也可以通过画廊的 **Submit a figure** 议题表单提交，附上一个 GitHub Gist 的链接，里面放着该图的源代码。

## 画廊会拒绝什么

- 网络调用或外部地址；
- `eval` 或 `new Function`；
- 框架、cookie，或触及图周围的页面；
- 技能、图自身文件以及 `node:fs`、`node:path`、`node:url`、`node:crypto` 或 `node:process` 之外的构建导入；
- 读取环境变量；
- `src/` 下源代码文本以外的文件，或提交的已构建页面；
- 写入页面以外任何东西的构建，或两次运行结果不同的构建；
- 开启减弱动态后仍持续运动的图。

如果用户打算分享，从一开始就按这个方式写图。
