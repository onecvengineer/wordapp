/**
 * 本地存储封装（替代 @lark-apaas/client-toolkit-lite 的 scopedStorage）。
 *
 * 旧版 scopedStorage 会给所有 key 加上 `__miaoda_<namespace>__:` 前缀，
 * 且依赖 lark 运行时注入的 appId。这里改为使用无前缀的裸 key，
 * 并在首次启动时把旧的带前缀数据自动迁移过来，避免用户本地数据丢失。
 */

const MIGRATED_FLAG = "__storage_migrated_v1";

/**
 * 迁移旧版（__miaoda_*__: 前缀）localStorage 数据到裸 key。
 * 幂等：用 MIGRATED_FLAG 保证只执行一次。
 */
function migrateLegacyStorage(): void {
  try {
    if (localStorage.getItem(MIGRATED_FLAG)) return;

    const legacyKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("__miaoda_")) legacyKeys.push(key);
    }

    for (const legacy of legacyKeys) {
      // 旧格式: `__miaoda_<namespace>__:<realKey>`，取最后一个 `__:` 之后的部分
      const match = legacy.match(/^__miaoda_.*__:(.*)$/);
      if (!match) continue;
      const realKey = match[1];
      const value = localStorage.getItem(legacy);
      if (value != null && localStorage.getItem(realKey) == null) {
        localStorage.setItem(realKey, value);
      }
      localStorage.removeItem(legacy);
    }

    localStorage.setItem(MIGRATED_FLAG, "1");
  } catch {
    // localStorage 不可用（隐私模式等）时静默降级
  }
}

migrateLegacyStorage();

/** 与旧 scopedStorage 同名的封装，便于最小化改动替换。 */
export const scopedStorage = {
  getItem(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // ignore
    }
  },
  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  },
};
