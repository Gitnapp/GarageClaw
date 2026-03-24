# ClawX Client — MVP 开发计划

## 项目定位

OpenClaw 的 fork 版本，定位为保留原生 OpenClaw 管理能力的 Desktop Shell，并增量集成 Web 平台登录、Marketplace、Credits 与 Profile。当前 desktop 仍保留本地 Chat / Agents / Skills / Channels / Cron / Settings，只是在其上增加平台登录态和嵌入式 Web 能力，而不是退化为纯 IM 网关。

## 架构原则

```
ClawX 只做三件事：
1. 接收IM消息，识别目标agent
2. 转发到平台API
3. 把结果发回IM
```

```
Feishu群消息
WeChat群消息     →  ClawX  →  POST platform/api/agents/:id/invoke  →  返回结果
Telegram消息                                                            ↓
                      ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←  回复到IM
```

## 技术栈

| 层 | 选型 | 原因 |
|---|------|------|
| 基础 | OpenClaw (Python) | 已有IM接入能力，fork后改 |
| HTTP客户端 | aiohttp | OpenClaw已有依赖 |
| 配置 | YAML + 环境变量 | 简单，OpenClaw原有模式 |
| 缓存 | 内存dict + TTL | MVP不引入Redis |
| 部署 | 阿里云VPS (175.24.128.56) | 现有环境 |
| 进程管理 | PM2 或 systemd | 已有方案 |

## 仓库结构

```
clawx/
├── ... (OpenClaw原有代码，保持不动)
│
├── platform/                          # 新增：平台对接层
│   ├── __init__.py
│   ├── client.py                      # 平台API客户端
│   ├── auth.py                        # 用户认证（IM用户 → 平台用户绑定）
│   ├── router.py                      # 消息路由（@mention → agent_id）
│   ├── cache.py                       # 本地缓存（agent配置、用户token）
│   └── formatter.py                   # 回复格式化（不同IM渠道适配）
│
├── plugins/
│   └── platform_agent/                # 核心插件
│       ├── __init__.py
│       ├── platform_agent.py          # 插件主逻辑
│       └── config.json                # 插件配置
│
├── config/
│   ├── platform.yaml                  # 平台连接配置
│   └── agent_bindings.yaml            # 群 → agent 静态绑定（备用）
│
├── contracts/                         # 从web平台同步的契约文件
│   ├── api-contract.md
│   ├── error-codes.md
│   └── types.py                       # Pydantic模型（手动同步）
│
├── tests/
│   ├── test_client.py
│   ├── test_router.py
│   └── test_auth.py
│
├── scripts/
│   ├── bind_user.py                   # 手动绑定用户脚本
│   └── sync_agents.py                 # 手动同步agent列表脚本
│
└── CHANGELOG.md
```

---

## 契约类型定义（Python侧）

### contracts/types.py

```python
"""
与Web平台共享的类型定义。
手动与 packages/shared/api-types.ts 保持同步。
变更时两边同时改，在CHANGELOG里记录。
"""

from pydantic import BaseModel
from typing import Optional, List
from enum import Enum


# ===== Agent =====

class AgentInfo(BaseModel):
    """GET /api/agents/installed 返回的单个agent"""
    id: str
    name: str
    slug: str
    model: str
    pricing_type: str  # 'free' | 'per_call' | 'per_token'


class AgentConfig(BaseModel):
    """GET /api/agents/:id/config 返回的完整配置"""
    id: str
    name: str
    system_prompt: str
    model: str
    temperature: float
    skills: List[str]
    pricing_type: str
    token_markup: float


# ===== Invoke =====

class Message(BaseModel):
    role: str  # 'user' | 'assistant'
    content: str


class ChannelContext(BaseModel):
    channel: str  # 'feishu' | 'wechat' | 'telegram' | 'web'
    group_id: Optional[str] = None
    message_id: Optional[str] = None


class InvokeRequest(BaseModel):
    messages: List[Message]
    user_id: str
    stream: bool = False
    context: Optional[ChannelContext] = None


class UsageInfo(BaseModel):
    input_tokens: int
    output_tokens: int
    total_tokens: int
    credits_charged: float


class InvokeResponse(BaseModel):
    content: str
    usage: UsageInfo
    agent_id: str
    model: str


# ===== Credits =====

class BalanceResponse(BaseModel):
    balance: float
    currency: str = "credits"


class CreditCheckRequest(BaseModel):
    user_id: str
    estimated_tokens: int


class CreditCheckResponse(BaseModel):
    allowed: bool
    balance: float


# ===== Errors =====

class ErrorCode(str, Enum):
    UNAUTHORIZED = "unauthorized"
    INSUFFICIENT_CREDITS = "insufficient_credits"
    AGENT_NOT_INSTALLED = "agent_not_installed"
    AGENT_NOT_FOUND = "agent_not_found"
    RATE_LIMITED = "rate_limited"
    INTERNAL_ERROR = "internal_error"
    LLM_UNAVAILABLE = "llm_unavailable"
    INVALID_REQUEST = "invalid_request"


class ErrorResponse(BaseModel):
    error: ErrorCode
    balance: Optional[float] = None
    retry_after: Optional[int] = None
    model: Optional[str] = None


# ===== Error → IM展示文案映射 =====

ERROR_MESSAGES = {
    ErrorCode.UNAUTHORIZED: "🔑 请先绑定平台账号。绑定方式：私聊我发送「绑定」",
    ErrorCode.INSUFFICIENT_CREDITS: "💰 余额不足，请充值后继续使用。\n充值链接：{topup_url}",
    ErrorCode.AGENT_NOT_INSTALLED: "📦 你还没有安装这个Agent。\n去商店看看：{store_url}",
    ErrorCode.AGENT_NOT_FOUND: "❓ 没找到名为「{agent_name}」的Agent，请检查名称",
    ErrorCode.RATE_LIMITED: "⏳ 调用太频繁，请{retry_after}秒后重试",
    ErrorCode.INTERNAL_ERROR: "⚠️ 系统异常，请稍后重试",
    ErrorCode.LLM_UNAVAILABLE: "🔧 AI服务暂时不可用，请稍后重试",
}
```

---

## 核心模块实现

### platform/client.py

```python
"""平台API客户端，所有与Web平台的通信集中在这里"""

import aiohttp
import logging
from typing import Optional, List
from contracts.types import (
    InvokeRequest, InvokeResponse, AgentInfo, AgentConfig,
    BalanceResponse, ErrorResponse, ErrorCode
)

logger = logging.getLogger(__name__)


class PlatformClient:

    def __init__(self, base_url: str, timeout: int = 30):
        self.base_url = base_url.rstrip('/')
        self.timeout = aiohttp.ClientTimeout(total=timeout)

    async def invoke_agent(
        self,
        agent_id: str,
        request: InvokeRequest,
        user_token: str
    ) -> InvokeResponse | ErrorResponse:
        """调用agent执行"""
        async with aiohttp.ClientSession(timeout=self.timeout) as session:
            try:
                resp = await session.post(
                    f"{self.base_url}/api/agents/{agent_id}/invoke",
                    json=request.model_dump(),
                    headers=self._auth_headers(user_token)
                )

                data = await resp.json()

                if resp.status == 200:
                    return InvokeResponse(**data)
                else:
                    return ErrorResponse(**data)

            except aiohttp.ClientTimeout:
                return ErrorResponse(error=ErrorCode.LLM_UNAVAILABLE)
            except Exception as e:
                logger.error(f"Invoke failed: {e}")
                return ErrorResponse(error=ErrorCode.INTERNAL_ERROR)

    async def get_installed_agents(
        self,
        user_id: str,
        user_token: str
    ) -> List[AgentInfo]:
        """获取用户已安装的agent列表"""
        async with aiohttp.ClientSession(timeout=self.timeout) as session:
            try:
                resp = await session.get(
                    f"{self.base_url}/api/agents/installed",
                    params={"user_id": user_id},
                    headers=self._auth_headers(user_token)
                )

                if resp.status == 200:
                    data = await resp.json()
                    return [AgentInfo(**a) for a in data.get("agents", [])]
                return []

            except Exception as e:
                logger.error(f"Get installed agents failed: {e}")
                return []

    async def get_agent_config(
        self,
        agent_id: str,
        user_token: str
    ) -> Optional[AgentConfig]:
        """获取agent完整配置"""
        async with aiohttp.ClientSession(timeout=self.timeout) as session:
            try:
                resp = await session.get(
                    f"{self.base_url}/api/agents/{agent_id}/config",
                    headers=self._auth_headers(user_token)
                )

                if resp.status == 200:
                    data = await resp.json()
                    return AgentConfig(**data)
                return None

            except Exception as e:
                logger.error(f"Get agent config failed: {e}")
                return None

    async def get_balance(self, user_id: str, user_token: str) -> float:
        """查询用户余额"""
        async with aiohttp.ClientSession(timeout=self.timeout) as session:
            try:
                resp = await session.get(
                    f"{self.base_url}/api/credits/balance",
                    params={"user_id": user_id},
                    headers=self._auth_headers(user_token)
                )
                if resp.status == 200:
                    data = await resp.json()
                    return data.get("balance", 0)
                return 0
            except:
                return 0

    def _auth_headers(self, token: str) -> dict:
        return {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
```

### platform/auth.py

```python
"""
IM用户 → 平台用户 绑定管理

绑定流程：
1. 用户在IM里私聊ClawX发送「绑定 {api_token}」
2. ClawX用这个token调平台API验证身份
3. 验证通过后，本地存储 im_user_id → (platform_user_id, api_token) 映射
4. 后续该IM用户的所有消息自动带上platform身份

存储：MVP用本地JSON文件，后续可换Redis/SQLite
"""

import json
import os
import logging
from typing import Optional, Tuple

logger = logging.getLogger(__name__)

BINDINGS_FILE = "data/user_bindings.json"


class UserBinding:
    platform_user_id: str
    api_token: str
    display_name: str


class AuthManager:

    def __init__(self, platform_client):
        self.platform_client = platform_client
        self.bindings: dict = {}  # im_user_id → {platform_user_id, api_token, display_name}
        self._load()

    def _load(self):
        """从文件加载绑定关系"""
        if os.path.exists(BINDINGS_FILE):
            with open(BINDINGS_FILE, 'r') as f:
                self.bindings = json.load(f)

    def _save(self):
        """持久化到文件"""
        os.makedirs(os.path.dirname(BINDINGS_FILE), exist_ok=True)
        with open(BINDINGS_FILE, 'w') as f:
            json.dump(self.bindings, f, ensure_ascii=False, indent=2)

    async def bind(self, im_user_id: str, api_token: str) -> Tuple[bool, str]:
        """
        绑定IM用户到平台账号
        返回 (success, message)
        """
        # 用token调平台验证身份
        # MVP: 调 /api/credits/balance 如果返回200说明token有效
        balance = await self.platform_client.get_balance("self", api_token)

        # TODO: 需要平台提供一个 GET /api/auth/me 接口返回user信息
        # MVP先简化：token有效就绑定
        self.bindings[im_user_id] = {
            "api_token": api_token,
            "platform_user_id": "pending",  # 等平台提供me接口后补全
            "display_name": im_user_id
        }
        self._save()
        return True, "✅ 绑定成功！现在可以在群里@Agent使用了。"

    def get_token(self, im_user_id: str) -> Optional[str]:
        """获取IM用户对应的平台API token"""
        binding = self.bindings.get(im_user_id)
        return binding["api_token"] if binding else None

    def get_user_id(self, im_user_id: str) -> Optional[str]:
        """获取IM用户对应的平台user_id"""
        binding = self.bindings.get(im_user_id)
        return binding["platform_user_id"] if binding else None

    def is_bound(self, im_user_id: str) -> bool:
        return im_user_id in self.bindings

    def unbind(self, im_user_id: str):
        if im_user_id in self.bindings:
            del self.bindings[im_user_id]
            self._save()
```

### platform/router.py

```python
"""
消息路由：解析@mention → agent_id

路由优先级：
1. @mention名称匹配（@认知教练 → agent_id）
2. 群绑定匹配（某个群固定绑定某个agent）
3. 默认agent（如果配置了的话）
4. 无匹配 → 走OpenClaw原有逻辑
"""

import time
import logging
import re
from typing import Optional, Dict, List

logger = logging.getLogger(__name__)

CACHE_TTL = 300  # 5分钟缓存


class AgentRouter:

    def __init__(self, platform_client):
        self.platform_client = platform_client
        # 用户级缓存：user_id → {name_map, last_sync}
        self.user_cache: Dict[str, dict] = {}
        # 群级绑定：group_id → agent_id（静态配置 + 动态设置）
        self.group_bindings: Dict[str, str] = {}

    async def resolve(
        self,
        message_text: str,
        im_user_id: str,
        user_token: str,
        group_id: Optional[str] = None
    ) -> Optional[dict]:
        """
        解析消息，返回目标agent信息
        返回 {"agent_id": "xxx", "agent_name": "xxx", "clean_text": "去掉@后的文本"}
        返回 None 表示不走平台agent
        """

        # 1. 检查@mention
        mention_match = re.match(r'^@(\S+)\s*(.*)', message_text, re.DOTALL)
        if mention_match:
            agent_name = mention_match.group(1)
            clean_text = mention_match.group(2).strip()

            agent_id = await self._resolve_name(agent_name, im_user_id, user_token)
            if agent_id:
                return {
                    "agent_id": agent_id,
                    "agent_name": agent_name,
                    "clean_text": clean_text or agent_name  # 如果@后面没内容，把名字当query
                }

        # 2. 检查群绑定
        if group_id and group_id in self.group_bindings:
            return {
                "agent_id": self.group_bindings[group_id],
                "agent_name": "",
                "clean_text": message_text
            }

        # 3. 无匹配
        return None

    async def _resolve_name(
        self,
        name: str,
        im_user_id: str,
        user_token: str
    ) -> Optional[str]:
        """名称 → agent_id，带缓存"""

        cache = self.user_cache.get(im_user_id)
        now = time.time()

        # 缓存过期或不存在，重新拉取
        if not cache or (now - cache["last_sync"]) > CACHE_TTL:
            agents = await self.platform_client.get_installed_agents(
                im_user_id, user_token
            )
            name_map = {}
            for a in agents:
                name_map[a.name] = a.id
                name_map[a.slug] = a.id
            self.user_cache[im_user_id] = {
                "name_map": name_map,
                "last_sync": now
            }
            cache = self.user_cache[im_user_id]

        return cache["name_map"].get(name)

    def bind_group(self, group_id: str, agent_id: str):
        """把群绑定到指定agent（群内所有消息自动走这个agent）"""
        self.group_bindings[group_id] = agent_id

    def unbind_group(self, group_id: str):
        self.group_bindings.pop(group_id, None)

    def invalidate_cache(self, im_user_id: str):
        """清除用户缓存，下次请求会重新拉取"""
        self.user_cache.pop(im_user_id, None)
```

### platform/formatter.py

```python
"""
回复格式化：把平台返回的内容适配到不同IM渠道

不同渠道的限制：
- Feishu: 支持Markdown，消息长度限制较大
- WeChat: 不支持Markdown，消息2048字符限制
- Telegram: 支持Markdown，4096字符限制
"""

from contracts.types import (
    InvokeResponse, ErrorResponse, ErrorCode, ERROR_MESSAGES
)


class Formatter:

    def __init__(self, config: dict):
        self.platform_url = config.get("platform_url", "")
        self.topup_url = f"{self.platform_url}/credits"
        self.store_url = f"{self.platform_url}/store"

    def format_response(
        self,
        response: InvokeResponse,
        channel: str,
        show_usage: bool = False
    ) -> str:
        """格式化成功回复"""

        content = response.content

        if show_usage:
            usage_line = f"\n\n---\n📊 消耗: {response.usage.credits_charged:.4f} credits | {response.usage.total_tokens} tokens"
            if channel == "wechat":
                # 微信不支持Markdown
                usage_line = f"\n\n[消耗: {response.usage.credits_charged:.4f} credits]"
            content += usage_line

        # 微信截断
        if channel == "wechat" and len(content) > 2000:
            content = content[:1997] + "..."

        # Telegram截断
        if channel == "telegram" and len(content) > 4000:
            content = content[:3997] + "..."

        return content

    def format_error(
        self,
        error: ErrorResponse,
        channel: str,
        agent_name: str = ""
    ) -> str:
        """格式化错误回复"""

        template = ERROR_MESSAGES.get(
            error.error,
            "⚠️ 未知错误，请稍后重试"
        )

        message = template.format(
            topup_url=self.topup_url,
            store_url=self.store_url,
            agent_name=agent_name,
            retry_after=error.retry_after or 60,
        )

        # 余额不足时附加余额信息
        if error.error == ErrorCode.INSUFFICIENT_CREDITS and error.balance is not None:
            message += f"\n当前余额: {error.balance:.2f} credits"

        return message
```

### plugins/platform_agent/platform_agent.py

```python
"""
ClawX核心插件：platform_agent

职责：
1. 拦截@mention消息
2. 检查用户绑定状态
3. 转发到平台API
4. 格式化回复

此插件注册为OpenClaw的消息处理器，优先级高于默认处理器。
当消息匹配到平台agent时，直接处理并返回；不匹配时放行给OpenClaw原有逻辑。
"""

import logging
from platform.client import PlatformClient
from platform.auth import AuthManager
from platform.router import AgentRouter
from platform.formatter import Formatter
from contracts.types import (
    InvokeRequest, InvokeResponse, ErrorResponse,
    Message, ChannelContext
)

logger = logging.getLogger(__name__)


class PlatformAgentPlugin:
    """OpenClaw插件接口实现"""

    name = "platform_agent"
    priority = 10  # 高优先级，先于其他插件处理

    def __init__(self, config: dict):
        self.client = PlatformClient(
            base_url=config["platform_url"],
            timeout=config.get("timeout", 60)
        )
        self.auth = AuthManager(self.client)
        self.router = AgentRouter(self.client)
        self.formatter = Formatter(config)
        self.show_usage = config.get("show_usage", False)

    async def handle_message(self, message, context) -> str | None:
        """
        主处理入口
        返回 str → 回复内容，ClawX直接发送
        返回 None → 不处理，交给下一个插件或OpenClaw默认逻辑
        """

        im_user_id = self._get_im_user_id(context)
        channel = self._get_channel(context)
        text = message.text.strip()

        # === 特殊命令处理 ===

        # 绑定命令：「绑定 sk-xxxxx」
        if text.startswith("绑定 ") or text.startswith("bind "):
            token = text.split(" ", 1)[1].strip()
            success, msg = await self.auth.bind(im_user_id, token)
            return msg

        # 余额查询：「余额」
        if text in ("余额", "balance", "credits"):
            return await self._handle_balance(im_user_id)

        # 我的agent：「我的agent」
        if text in ("我的agent", "my agents", "agent列表"):
            return await self._handle_list_agents(im_user_id)

        # === Agent路由 ===

        # 未绑定用户直接@agent → 提示绑定
        if not self.auth.is_bound(im_user_id):
            if text.startswith("@"):
                return "🔑 请先绑定平台账号。\n私聊我发送：绑定 你的API_TOKEN\n获取Token：{url}/settings".format(
                    url=self.formatter.platform_url
                )
            return None  # 非@消息，不处理

        user_token = self.auth.get_token(im_user_id)
        user_id = self.auth.get_user_id(im_user_id)
        group_id = self._get_group_id(context)

        # 路由解析
        route = await self.router.resolve(text, im_user_id, user_token, group_id)
        if not route:
            return None  # 不匹配任何agent，交给OpenClaw

        # === 调用平台Agent ===

        request = InvokeRequest(
            messages=[Message(role="user", content=route["clean_text"])],
            user_id=user_id,
            stream=False,
            context=ChannelContext(
                channel=channel,
                group_id=group_id,
                message_id=self._get_message_id(context)
            )
        )

        result = await self.client.invoke_agent(
            agent_id=route["agent_id"],
            request=request,
            user_token=user_token
        )

        # 格式化返回
        if isinstance(result, InvokeResponse):
            return self.formatter.format_response(
                result, channel, show_usage=self.show_usage
            )
        elif isinstance(result, ErrorResponse):
            return self.formatter.format_error(
                result, channel, agent_name=route.get("agent_name", "")
            )

    async def _handle_balance(self, im_user_id: str) -> str:
        if not self.auth.is_bound(im_user_id):
            return "🔑 请先绑定平台账号"
        token = self.auth.get_token(im_user_id)
        user_id = self.auth.get_user_id(im_user_id)
        balance = await self.client.get_balance(user_id, token)
        return f"💰 当前余额: {balance:.2f} credits\n充值：{self.formatter.topup_url}"

    async def _handle_list_agents(self, im_user_id: str) -> str:
        if not self.auth.is_bound(im_user_id):
            return "🔑 请先绑定平台账号"
        token = self.auth.get_token(im_user_id)
        user_id = self.auth.get_user_id(im_user_id)
        agents = await self.client.get_installed_agents(user_id, token)
        if not agents:
            return f"📦 你还没有安装任何Agent\n去商店看看：{self.formatter.store_url}"
        lines = ["📋 已安装的Agent："]
        for a in agents:
            price_tag = "免费" if a.pricing_type == "free" else "付费"
            lines.append(f"  • @{a.name} ({price_tag})")
        lines.append(f"\n在群里发 @agent名 + 问题 即可使用")
        return "\n".join(lines)

    # === IM上下文提取（根据OpenClaw的context结构适配） ===

    def _get_im_user_id(self, context) -> str:
        """提取IM平台的用户标识"""
        # Feishu: open_id
        # WeChat: wxid
        # Telegram: user_id
        # 根据OpenClaw实际context结构实现
        return getattr(context, 'user_id', '') or getattr(context, 'open_id', '') or str(context.get('from_user_id', ''))

    def _get_channel(self, context) -> str:
        return getattr(context, 'channel_type', 'unknown')

    def _get_group_id(self, context) -> str | None:
        return getattr(context, 'group_id', None) or getattr(context, 'chat_id', None)

    def _get_message_id(self, context) -> str | None:
        return getattr(context, 'message_id', None) or getattr(context, 'msg_id', None)
```

### config/platform.yaml

```yaml
# ClawX 平台连接配置

platform:
  url: "https://your-platform.vercel.app"  # 平台API地址
  timeout: 60                               # API调用超时（秒）
  show_usage: false                         # 回复中是否展示token消耗

  # 群绑定（可选：把特定群固定绑定到某个agent）
  group_bindings:
    # "feishu_group_id_123": "agent_uuid_456"
    # "wechat_room_id_789": "agent_uuid_012"

  # 默认agent（可选：未@时所有消息都走这个agent）
  # default_agent_id: "agent_uuid_xxx"

  # 缓存
  cache_ttl: 300  # agent列表缓存时间（秒）
```

---

## 对OpenClaw的改动清单

### 必须改的

| 改动 | 位置 | 说明 |
|------|------|------|
| 加载platform_agent插件 | 启动入口 | 读取platform.yaml，初始化PlatformAgentPlugin |
| 消息处理优先级 | 消息分发器 | platform_agent.handle_message 在其他handler之前执行 |
| 私聊命令 | 消息处理 | 识别「绑定」「余额」等命令，交给platform_agent处理 |

### 不改的

| 保持不动 | 原因 |
|----------|------|
| 原有skill系统 | 不匹配平台agent的消息继续走原有逻辑 |
| 原有模型调用 | ClawX本地的对话能力保留 |
| Feishu/WeChat/Telegram channel代码 | 只在上层加路由，不改底层IM接入 |
| 配置体系 | platform.yaml是新增，不改原有config |

---

## 分周执行计划

### Week 1：基础框架 + API客户端

**Day 1：Fork + 结构搭建**
- [ ] Fork OpenClaw → clawx repo
- [ ] 创建 `platform/` 目录结构
- [ ] 创建 `contracts/` 目录，从web平台复制api-contract.md和error-codes.md
- [ ] 写 `contracts/types.py`（Pydantic模型）
- [ ] 创建 `config/platform.yaml`
- [ ] 验证：ClawX正常启动，新目录不影响原有功能

**Day 2：Platform Client**
- [ ] 实现 `platform/client.py` 全部方法
- [ ] 写 `tests/test_client.py`（mock HTTP测试）
- [ ] 用真实的平台API测试（前提：web平台invoke接口已部署）
- [ ] 验证：client.invoke_agent 能拿到正确response

**Day 3：Auth Manager**
- [ ] 实现 `platform/auth.py`
- [ ] 绑定数据持久化（JSON文件）
- [ ] 写 `scripts/bind_user.py`（命令行手动绑定工具）
- [ ] 写 `tests/test_auth.py`
- [ ] 验证：绑定 → 保存 → 重启后恢复

**Day 4：Agent Router**
- [ ] 实现 `platform/router.py`
- [ ] @mention解析（正则）
- [ ] 名称→ID缓存
- [ ] 群绑定逻辑
- [ ] 写 `tests/test_router.py`
- [ ] 验证：@认知教练 → 解析出正确agent_id

**Day 5：Formatter**
- [ ] 实现 `platform/formatter.py`
- [ ] 错误码→文案映射
- [ ] 各渠道长度截断
- [ ] usage信息格式化
- [ ] 验证：各种response/error正确格式化

### Week 2：插件集成 + IM实测

**Day 1：插件主体**
- [ ] 实现 `plugins/platform_agent/platform_agent.py`
- [ ] 消息处理主流程：识别→路由→调用→格式化→返回
- [ ] 特殊命令处理（绑定、余额、agent列表）
- [ ] 验证：插件代码无语法错误，能被import

**Day 2：接入OpenClaw消息分发**
- [ ] 研究OpenClaw的消息处理入口（找到hook点）
- [ ] 在消息分发器中注入platform_agent.handle_message
- [ ] 确保返回None时正确fallback到原有逻辑
- [ ] 验证：普通消息不受影响，@消息被platform_agent拦截

**Day 3：Feishu实测**
- [ ] 在测试Feishu群中部署
- [ ] 测试绑定流程：私聊发「绑定 token」
- [ ] 测试@agent调用：群里发「@认知教练 帮我分析字节的AI布局」
- [ ] 测试余额不足场景
- [ ] 测试未绑定用户@agent
- [ ] 测试不存在的agent名
- [ ] 记录所有bug

**Day 4：Bug修复 + 微信测试**
- [ ] 修复Day 3发现的问题
- [ ] 适配微信渠道的context结构（user_id提取方式不同）
- [ ] 微信群测试同样的流程
- [ ] 验证：Feishu和微信都能正常调用平台agent

**Day 5：稳定性**
- [ ] 超时处理：平台API无响应时的降级
- [ ] 重试逻辑：5xx错误重试一次
- [ ] 日志完善：每次invoke记录agent_id、耗时、结果状态
- [ ] PM2配置：自动重启 + 日志轮转
- [ ] 验证：长时间运行稳定

### Week 3：增强功能

**Day 1：多轮对话**
- [ ] 内存中维护每个(user, agent)的最近N轮对话
- [ ] invoke时带上历史messages
- [ ] TTL过期自动清除（30分钟无活动清空）
- [ ] 验证：连续提问有上下文

**Day 2：群绑定管理**
- [ ] 群内命令：「绑定agent 认知教练」→ 该群所有消息自动走这个agent
- [ ] 群内命令：「解绑agent」→ 恢复普通模式
- [ ] 持久化群绑定到config文件
- [ ] 验证：绑定后不用@也能触发agent

**Day 3：Agent列表同步脚本**
- [ ] `scripts/sync_agents.py` → 从平台拉取所有public agent
- [ ] 定时同步（cron每10分钟）
- [ ] 验证：平台新增agent后，ClawX能识别

**Day 4：监控 + 告警**
- [ ] 记录每次调用的延迟到日志
- [ ] 平台API连续失败时发告警（Feishu webhook通知你）
- [ ] 统计：每日调用量、错误率
- [ ] 验证：模拟平台故障 → 收到告警

**Day 5：文档 + 部署优化**
- [ ] README.md：安装、配置、绑定流程说明
- [ ] CHANGELOG.md 开始记录
- [ ] 部署脚本：一键拉取 + 重启
- [ ] 验证：新环境能按README跑起来

---

## 验收标准

以下全部通过 = ClawX客户端MVP完成：

1. ✅ ClawX启动不影响OpenClaw原有功能
2. ✅ 用户私聊发「绑定 token」完成账号绑定
3. ✅ 用户发「余额」查看credits余额
4. ✅ 用户发「我的agent」查看已安装列表
5. ✅ 群里@agent名 + 问题 → 收到agent回复
6. ✅ 余额不足 → 收到充值提示（带链接）
7. ✅ 未绑定用户@agent → 收到绑定提示
8. ✅ 不存在的agent名 → 收到友好提示
9. ✅ 平台API超时 → 收到重试提示（不崩溃）
10. ✅ Feishu和微信渠道都能正常工作
11. ✅ 群绑定模式：绑定后不用@直接对话
12. ✅ 多轮对话：连续提问有上下文
13. ✅ 长时间运行稳定，PM2管理进程

---

## 不做清单（MVP范围外）

- ❌ Telegram渠道适配（后面按需加）
- ❌ 语音消息处理
- ❌ 图片/文件消息处理
- ❌ Streaming流式回复
- ❌ 本地agent执行能力（全走平台）
- ❌ agent间消息转发
- ❌ 用户画像/偏好学习
- ❌ 自动注册平台账号
- ❌ OAuth绑定（先用token手动绑）
