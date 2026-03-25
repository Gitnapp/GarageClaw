# Changelog

## [2026-03-25] 版本升级至 0.3.0-alpha.1

**改动文件：**
- `package.json` — version 从 `0.3.0-alpha.0` 升至 `0.3.0-alpha.1`

**变更说明：**
Bump 版本号以触发 CI 构建新的 release 包（含 deep link 邮箱验证功能）。

**影响范围：**
打包 / CI

---

## [2026-03-25] Supabase 邮箱验证 Deep Link 支持

**改动文件：**
- `electron-builder.yml` — 注册 `garageclaw://` 自定义协议
- `electron/main/index.ts` — 协议处理：open-url (macOS)、second-instance argv (Windows/Linux)、pending URL 队列
- `electron/preload/index.ts` — 白名单添加 `auth:deep-link` IPC 通道
- `src/stores/platform.ts` — 监听 deep link IPC，调用 `supabase.auth.setSession()` 完成登录
- `src/pages/Setup/index.tsx` — signUp 添加 `emailRedirectTo` 指向 Web 中转页

**变更说明：**
编译后的 Electron 应用无法接收 Supabase 默认的 localhost 回调，导致邮箱验证后无法完成注册登录。
方案：注册 `garageclaw://` 自定义协议，Supabase 验证邮件重定向到 `garageclaw-web.vercel.app/auth/callback`（Web 中转页），
中转页将 hash 中的 token 转发到 `garageclaw://auth/callback#access_token=...`，Electron 捕获后完成 session 设置。

**影响范围：**
前端 / Electron Main / 打包配置

---

## [2026-03-24] CI/CD 自动发布

**改动文件：**
- `.github/workflows/release.yml` — 添加 push to main 自动触发、auto-tag job、跳过签名、禁用 fail-fast

**变更说明：**
- 推送到 main 自动从 package.json 读取版本号，创建 git tag，触发三平台构建并发布 GitHub Release + OSS
- macOS 未配证书时跳过签名（`CSC_IDENTITY_AUTO_DISCOVERY=false`），避免构建崩溃
- `fail-fast: false` 使 Linux/Windows 构建不受 macOS 失败影响
- 保留 tag 推送和 workflow_dispatch 手动触发方式

**影响范围：**
CI/CD

---

## [2026-03-24] 平台集成 & LiteLLM 计费

**改动文件：**
- `src/stores/platform.ts` — Zustand platform store（auth、profile、balance、LiteLLM key、可用模型、marketplace）
- `src/lib/supabase.ts` — Supabase 客户端单例
- `src/pages/Profile/index.tsx` — Profile 页（登录/用户信息/credits 历史/可用模型展示）
- `src/pages/Marketplace/index.tsx` — Marketplace 页（公开 agents/skills）
- `src/pages/Setup/index.tsx` — Onboarding 添加登录步骤，合并登录注册为单一入口，自动分配 $20 赠金
- `src/App.tsx` — 路由、auth 初始化、未登录强制跳转 onboarding
- `src/components/layout/Sidebar.tsx` — 添加 Marketplace/Profile 导航
- `src/components/settings/ProvidersSettings.tsx` — 隐藏添加提供商按钮，只显示 GarageClaw Platform，模型选择改为下拉菜单
- `electron/shared/providers/registry.ts` — 添加 GarageClaw Platform 内置 provider
- `electron/shared/providers/types.ts` — 添加 garageclaw-platform 类型
- `src/lib/providers.ts` — 前端 provider 列表添加 GarageClaw Platform
- `electron/main/ipc/host-api-proxy.ts` — 修复 PORTS.CLAWX_HOST_API → GARAGECLAW_HOST_API
- `package.json` — 添加 @supabase/supabase-js 依赖
- `pnpm-workspace.yaml` — 还原为单根目录（移除 apps/\* packages/\*）
- `src/i18n/locales/{en,zh,ja}/setup.json` — 添加 login 步骤 i18n
- `docs/plans/2026-03-24-litellm-billing-design.md` — LiteLLM 计费集成设计文档
- Supabase migration: profiles.litellm_key、\_spend_sync_state 表、credit_ledger.request_id 去重索引、grant_welcome_credits RPC、get_balance 改为 SECURITY DEFINER
- Supabase Edge Function: sync-litellm-spend v2（每分钟全量同步 LiteLLM SpendLogs → credit_ledger，靠 request_id 去重）

**变更说明：**

1. **Supabase 原生集成** — renderer 直接使用 supabase-js，auth session 通过 localStorage 持久化，不经过 main 进程
2. **LiteLLM 计费** — 登录时自动创建 LiteLLM virtual key 并注册为默认 provider，LiteLLM 内置 budget 拦截防超额，Edge Function 每分钟同步 spend 到 credit_ledger
3. **Onboarding 强制登录** — 新增 LOGIN 步骤，合并登录/注册为单一入口（先尝试登录，不存在则注册），邮件确认提示用友好蓝色样式，新用户获 $20 欢迎赠金
4. **退出登录保护** — 退出后自动跳回 onboarding 登录页，跳过 Welcome 直达 LOGIN 步骤
5. **Provider 配置锁定** — 隐藏添加提供商按钮，只显示 GarageClaw Platform，模型选择从自由输入改为 LiteLLM 可用模型下拉菜单
6. **Web 服务独立** — apps/web 抽取到独立仓库 GarageClaw-Web，desktop 移除 webview 嵌入方式
7. **Bug 修复**
   - host-api-proxy 端口常量名遗漏导致 Gateway 状态显示 error
   - credit_ledger 缺少 INSERT RLS 策略，赠金静默失败 → 改用 SECURITY DEFINER RPC
   - get_balance 函数非 SECURITY DEFINER，客户端查余额返回 0 → 修复
   - LiteLLM virtual key 创建时 budget=0（赠金在 key 创建后才分配）→ 调整为先赠金再建 key，且每次登录自动同步 budget
   - Edge Function spend sync 日期格式不兼容 LiteLLM API → 改为全量获取 + request_id 去重

**影响范围：**
前端 / Electron 主进程 / Supabase 数据库 / Supabase Edge Functions / LiteLLM proxy
