# Changelog

## [2026-03-24] 平台集成 & LiteLLM 计费

**改动文件：**
- `src/stores/platform.ts` — 新建 Zustand platform store（auth、profile、balance、LiteLLM key、marketplace）
- `src/lib/supabase.ts` — 新建 Supabase 客户端单例
- `src/pages/Profile/index.tsx` — 新建 Profile 页（登录表单 + 用户信息 + credits 历史 + 可用模型）
- `src/pages/Marketplace/index.tsx` — 新建 Marketplace 页（公开 agents/skills 列表）
- `src/pages/Setup/index.tsx` — 添加 LOGIN 步骤到 onboarding，强制登录，自动分配赠金
- `src/App.tsx` — 添加路由、auth 初始化、未登录强制跳转 onboarding
- `src/components/layout/Sidebar.tsx` — 添加 Marketplace/Profile 导航
- `electron/shared/providers/registry.ts` — 添加 GarageClaw Platform 内置 provider
- `electron/shared/providers/types.ts` — 添加 garageclaw-platform 类型
- `src/lib/providers.ts` — 前端 provider 列表添加 GarageClaw Platform
- `electron/main/ipc/host-api-proxy.ts` — 修复 PORTS.CLAWX_HOST_API → GARAGECLAW_HOST_API
- `package.json` — 添加 @supabase/supabase-js 依赖
- `pnpm-workspace.yaml` — 还原为单根目录（移除 apps/\* packages/\*）
- `docs/plans/2026-03-24-litellm-billing-design.md` — LiteLLM 计费集成设计文档
- Supabase migration: profiles.litellm_key 字段、\_spend_sync_state 表、credit_ledger.request_id 去重索引、grant_welcome_credits RPC
- Supabase Edge Function: sync-litellm-spend（每分钟同步 LiteLLM SpendLogs → credit_ledger）

**变更说明：**

1. **Supabase 原生集成** — 在 renderer 直接使用 supabase-js，auth session 通过 localStorage 持久化，不经过 main 进程
2. **LiteLLM 计费** — 用户登录时自动创建 LiteLLM virtual key 并注册为默认 provider，LiteLLM 内置 budget 拦截防超额，Edge Function 定时同步 spend 到 credit_ledger
3. **Onboarding 强制登录** — 新增 LOGIN 步骤，新用户自动获得 1.0 credits 欢迎赠金（通过 SECURITY DEFINER RPC 绕过 RLS）
4. **Web 服务独立** — apps/web 抽取到独立仓库 GarageClaw-Web，desktop 移除 webview 嵌入方式
5. **Bug 修复** — host-api-proxy 端口常量名从品牌重命名中遗漏导致 Gateway 状态显示 error

**影响范围：**
前端 / Electron 主进程 / Supabase 数据库 / Supabase Edge Functions / LiteLLM proxy
