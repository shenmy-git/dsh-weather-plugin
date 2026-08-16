# dsh-weather-plugin

天气工具 + **沉浸式天气主题**的 DSH UI 增强插件：**常驻生效，无需问答**——
页面打开即按 IP 自动定位并应用整个主页的天气效果；模型问答天气时再按回答
切换。所有组件按天气换色、全屏飘雨/飘雪/阳光/闪电氛围、一只沿页面底部游弋
的**官方 FishLogo 鲸鱼宠物**（右下角 HUD，可点开面板），聊天里还有带环境
音效、动植物伙伴和科普的交互卡片。

- 数据源：[Open-Meteo](https://open-meteo.com/)（免费，不需要 API key）
- 定位：**IP 自动定位**（ipwho.is → ipapi.co 回退链）+ 手动城市覆盖
- 主题：`ctx.theme.overrideTokens` 官方第三方 token 覆盖层（全组件生效）
- UI：`tool.call.toolview` 工具卡片 + 插件体自管的 HUD 与全屏氛围层

## 功能一览

| 功能 | 说明 |
|---|---|
| **常驻生效** | 打开页面即查询（浏览器直连，无需模型问答），30 分钟自动刷新；问答结果覆盖常驻状态 |
| **IP 自动定位** | 不带城市时按公网 IP 自动定位（📍 标签）；HUD 可手动输入城市，记住在 localStorage |
| **全组件换色** | 8 套天气配色覆盖 `--dsw-alias-*`：背景、卡片、侧栏、边框、文字、品牌色，明暗双模式 |
| **全屏氛围层** | 每类天气一套动态效果：晴=太阳光芒（夜=月亮星星）、多云=飘云、阴=色罩、雾=缓慢漂移的雾带、毛毛雨=彩虹+细雨、雨=全屏雨丝、雪=飘雪、雷暴=雨丝+闪电双闪 |
| **季节粒子** | 随季节点缀：春飘花瓣、夏浮光点、秋落树叶（按纬度判断南北半球季节） |
| **天气宠物鲸鱼** | 官方 DeepSeek FishLogo 轮廓（canvas 矢量渲染）：分部件关节动画（尾鳍/背鳍/胸鳍）、呼吸、眨眼、喷泉、随天气换配件（雨伞/围巾/闪电/太阳/月亮/云/雾/雨丝），沿页面底部巡游，点击打开面板 |
| **HUD 悬浮胶囊** | 收起态：鲸鱼+温度+城市；展开：天气手动切换（8 选 1 + 实时）、详情/伙伴/科普 + 声音/深色模式/刷新/**隐藏氛围**开关、城市输入 |
| **交互卡片** | 聊天流内天气卡片：天气图标 + 温度 + 城市 + 状态，可展开看体感/湿度/风力、动植物伙伴、季节与科普；自带 🔊 声音开关 |
| **环境音效** | Web Audio 程序化合成，**自动跟随当前天气**：晴=微风、阴=低频风声、毛毛雨/雨=雨声、雪=轻沙沙、雷暴=雨声+闷雷、雾=静音；HUD 与卡片各有 🔊 开关（首次点击符合自动播放策略） |
| **动植物伙伴** | 每类天气一只动物 + 一株植物，晴天按**季节**变化（南北半球按纬度判断） |
| **科普小知识** | 每类天气一句科普，随 UI 语言切换（zh/en） |
| **无障碍** | `prefers-reduced-motion` 关闭动画保留色罩；全屏层 `pointer-events: none` |

## 安装

```sh
# 已发布到 npm 后
dsh plugin --profile web add dsh-weather-plugin

# 或本地 checkout / tarball
dsh plugin --profile web add ./dsh-plugin
dsh plugin --profile web add ./dsh-weather-plugin-1.0.0.tgz

# 验证配置层并启动
dsh --profile web --dump-config
dsh web
```

打开 Web UI 就能看到效果：**右下角出现鲸鱼宠物 + 天气胶囊，整个页面已按当前
天气换色并渲染氛围层**——不需要问任何问题。提问「今天天气怎么样」会得到
卡片并刷新常驻状态。

## 关于 IP 定位

IP 定位的是**网络出口**，不是设备位置：如果电脑经过代理/VPN/云服务器上网，
定位结果就是出口节点所在城市。插件内置双数据源（ipwho.is → ipapi.co）交叉
验证；如果你所在城市与定位不符，在 HUD 展开面板里输入城市即可覆盖
（记住在 localStorage），或在 profile 配置里设 `defaultCity`。

## 配置

| 字段 | 默认 | 说明 |
|---|---|---|
| `defaultCity` | `'北京'` | IP 定位失败或关闭时的城市 |
| `language` | `'zh'` | 模型可见文案语言（`zh` / `en`） |
| `autoLocate` | `true` | 城市参数为空时按主机公网 IP 自动定位 |
| `timeoutMs` | `10000` | 上游请求超时（毫秒） |

```yaml
# profile 的 cordis.patch.yml 覆盖
- id: weather
  config:
    defaultCity: '上海'
    language: en
    autoLocate: false
```

## 本地开发

```sh
pnpm install
pnpm typecheck     # 类型检查
pnpm build         # tsdown 构建 lib/index.js + lib/client.js，tsc 出 d.ts
pnpm watch         # tsdown --watch（配合 dev:web 的 client HMR 链）
```

在 harness 源码 checkout 中联调：

```sh
pnpm dsh plugin --profile web add <本目录绝对路径>
pnpm dsh web
```

> 注意：`dsh-client-modules` 提供的是构建后的 `lib/client.js`，不是源码；
> client 代码改动后必须重新 `pnpm run build`（或 `pnpm run watch`）才会生效。

## 发布

```sh
pnpm run build
npm publish            # 先发布到 npm（预构建 lib/，用户无需构建授权）
```

plugin.dshdesk.com 市场从 **GitHub 仓库**收录插件（自动校验 `dsh.bundle`
manifest 与 `cordis.patch.yml`）。发布到市场的步骤：

1. 把仓库推送到 GitHub（公开仓库，设置 topics：`deepseek-harness`、`dsh-plugin`）
2. 注册表每 2 小时自动发现；也可在站点「发布」页提交仓库 URL 走人工收录
3. 在 [plugin.dshdesk.com](https://plugin.dshdesk.com/) 确认插件出现且
   「Manifest 检查通过」

打包安装细节见[官方打包教程](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.md)。

## 素材与许可（发布前必读）

| 素材 | 用途 | 许可状态 |
|---|---|---|
| **DeepSeek FishLogo 路径**（`src/client/assets/fish-logo.ts`） | 宠物鲸鱼轮廓，取自 `@deepseek-ai/dsh-client-ui-primitives` 官方图标 | ✅ DeepSeek 自家 logo（与插件同组织），复用官方包内图标路径，零第三方版权风险 |
| 程序化 canvas 矢量绘制（鲸鱼渐变、喷泉、配件） | 宠物动画、天气配件（伞/围巾/闪电/太阳/月亮/云/雾/雨丝） | ✅ 原创代码，无外部素材 |
| Open-Meteo API | 天气数据 | ⚠️ 非商业/个人使用免费；**商业用途需 Open-Meteo 商业许可**（见 open-meteo.com/en/terms），发布到市场前请确认你的发布性质 |
| ipwho.is / ipapi.co | IP 定位 | ⚠️ 免费层有请求限额，需遵守各自服务条款（ipwho.is 商业使用需付费计划） |

**猫动画**已于 0.9.2 起移除：宠物改为程序化绘制的官方 FishLogo 鲸鱼
（canvas 矢量渲染，带尾部/背鳍/胸鳍关节动画、呼吸、眨眼、喷泉与天气配件），
不再依赖任何第三方动画素材。

任何第三方素材的署名/许可要求都必须随插件发布文件一起提供。
