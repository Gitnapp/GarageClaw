export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">平台设置</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          管理 API Token、通知偏好等平台配置
        </p>
      </div>
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold">设置</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          设置页面正在建设中，后续会支持 API Token 管理、通知偏好等配置。
        </p>
      </div>
    </div>
  );
}
