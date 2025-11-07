/* eslint-disable no-console,no-case-declarations */

import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getConfig, setCachedConfig } from '@/lib/config';
import { db } from '@/lib/db';
import { deleteCachedLiveChannels, refreshLiveChannels } from '@/lib/live';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    // 权限检查
    const authInfo = getAuthInfoFromCookie(request);
    const username = authInfo?.username;
    const config = await getConfig();
    if (username !== process.env.LOGIN_USERNAME) {
      // 管理员
      const user = config.UserConfig.Users.find((u) => u.username === username);
      if (!user || user.role !== 'admin' || user.banned) {
        return NextResponse.json({ error: '权限不足' }, { status: 401 });
      }
    }

    const body = await request.json();
    const { action, key, name, url, ua, epg } = body;

    if (!config) {
      return NextResponse.json({ error: '配置不存在' }, { status: 404 });
    }

    // 确保 LiveConfig 存在
    if (!config.LiveConfig) {
      config.LiveConfig = [];
    }

    switch (action) {
      case 'add':
        // 检查是否已存在相同的 key
        if (config.LiveConfig.some((l) => l.key === key)) {
          return NextResponse.json(
            { error: '直播源 key 已存在' },
            { status: 400 }
          );
        }

        const liveInfo = {
          key: key as string,
          name: name as string,
          url: url as string,
          ua: ua || '',
          epg: epg || '',
          from: 'custom' as 'custom' | 'config',
          channelNumber: 0,
          disabled: false,
        };

        try {
          const nums = await refreshLiveChannels(liveInfo);
          liveInfo.channelNumber = nums;
        } catch (error) {
          console.error('刷新直播源失败:', error);
          liveInfo.channelNumber = 0;
        }

        // 添加新的直播源
        config.LiveConfig.push(liveInfo);
        break;

      case 'delete':
        // 删除直播源
        const deleteIndex = config.LiveConfig.findIndex((l) => l.key === key);
        if (deleteIndex === -1) {
          return NextResponse.json({ error: '直播源不存在' }, { status: 404 });
        }

        const liveSource = config.LiveConfig[deleteIndex];
        if (liveSource.from === 'config') {
          return NextResponse.json(
            { error: '不能删除配置文件中的直播源' },
            { status: 400 }
          );
        }

        deleteCachedLiveChannels(key);

        config.LiveConfig.splice(deleteIndex, 1);

        // 如果删除后没有直播源了，清除订阅配置
        if (config.LiveConfig.length === 0) {
          config.LiveSubscription = undefined;
        }
        break;

      case 'enable':
        // 启用直播源
        const enableSource = config.LiveConfig.find((l) => l.key === key);
        if (!enableSource) {
          return NextResponse.json({ error: '直播源不存在' }, { status: 404 });
        }
        enableSource.disabled = false;
        break;

      case 'disable':
        // 禁用直播源
        const disableSource = config.LiveConfig.find((l) => l.key === key);
        if (!disableSource) {
          return NextResponse.json({ error: '直播源不存在' }, { status: 404 });
        }
        disableSource.disabled = true;
        break;

      case 'edit':
        // 编辑直播源
        const editSource = config.LiveConfig.find((l) => l.key === key);
        if (!editSource) {
          return NextResponse.json({ error: '直播源不存在' }, { status: 404 });
        }

        // 配置文件中的直播源不允许编辑
        if (editSource.from === 'config') {
          return NextResponse.json(
            { error: '不能编辑配置文件中的直播源' },
            { status: 400 }
          );
        }

        // 更新字段（除了 key 和 from）
        editSource.name = name as string;
        editSource.url = url as string;
        editSource.ua = ua || '';
        editSource.epg = epg || '';

        // 刷新频道数
        try {
          const nums = await refreshLiveChannels(editSource);
          editSource.channelNumber = nums;
        } catch (error) {
          console.error('刷新直播源失败:', error);
          editSource.channelNumber = 0;
        }
        break;

      case 'sort':
        // 排序直播源
        const { order } = body;
        if (!Array.isArray(order)) {
          return NextResponse.json(
            { error: '排序数据格式错误' },
            { status: 400 }
          );
        }

        // 创建新的排序后的数组
        const sortedLiveConfig: typeof config.LiveConfig = [];
        order.forEach((key) => {
          const source = config.LiveConfig?.find((l) => l.key === key);
          if (source) {
            sortedLiveConfig.push(source);
          }
        });

        // 添加未在排序列表中的直播源（保持原有顺序）
        config.LiveConfig.forEach((source) => {
          if (!order.includes(source.key)) {
            sortedLiveConfig.push(source);
          }
        });

        config.LiveConfig = sortedLiveConfig;
        break;

      case 'batch_enable':
        // 批量启用直播源
        const { keys: enableKeys } = body;
        if (!Array.isArray(enableKeys) || enableKeys.length === 0) {
          return NextResponse.json(
            { error: '缺少 keys 参数或为空' },
            { status: 400 }
          );
        }
        enableKeys.forEach((key) => {
          const source = config.LiveConfig?.find((l) => l.key === key);
          if (source) {
            source.disabled = false;
          }
        });
        break;

      case 'batch_disable':
        // 批量禁用直播源
        const { keys: disableKeys } = body;
        if (!Array.isArray(disableKeys) || disableKeys.length === 0) {
          return NextResponse.json(
            { error: '缺少 keys 参数或为空' },
            { status: 400 }
          );
        }
        disableKeys.forEach((key) => {
          const source = config.LiveConfig?.find((l) => l.key === key);
          if (source) {
            source.disabled = true;
          }
        });
        break;

      case 'batch_delete':
        // 批量删除直播源
        const { keys: deleteKeys } = body;
        if (!Array.isArray(deleteKeys) || deleteKeys.length === 0) {
          return NextResponse.json(
            { error: '缺少 keys 参数或为空' },
            { status: 400 }
          );
        }
        // 只能删除custom来源的直播源
        const keysToDelete = deleteKeys.filter((key) => {
          const source = config.LiveConfig?.find((l) => l.key === key);
          if (!source) return false;
          // 配置文件中的直播源不能删除
          return source.from !== 'config';
        });

        // 批量删除
        keysToDelete.forEach((key) => {
          const idx = config.LiveConfig?.findIndex((l) => l.key === key);
          if (idx !== undefined && idx !== -1) {
            deleteCachedLiveChannels(key);
            config.LiveConfig?.splice(idx, 1);
          }
        });

        // 如果删除后没有直播源了，清除订阅配置
        if (config.LiveConfig && config.LiveConfig.length === 0) {
          config.LiveSubscription = undefined;
          console.log('已清除直播源订阅配置（所有直播源已删除）');
        }
        break;

      default:
        return NextResponse.json({ error: '未知操作' }, { status: 400 });
    }

    console.log(`[Admin Live API] 操作完成: ${action}`);
    console.log(
      `[Admin Live API] 当前直播源数量: ${config.LiveConfig?.length || 0}`
    );

    // 保存配置
    await db.saveAdminConfig(config);
    console.log(`[Admin Live API] 配置已保存到数据库`);

    // 更新内存缓存
    await setCachedConfig(config);
    console.log(`[Admin Live API] 内存缓存已更新`);

    return NextResponse.json({
      success: true,
      config: config, // 返回更新后的配置，避免前端重新请求
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '操作失败' },
      { status: 500 }
    );
  }
}
