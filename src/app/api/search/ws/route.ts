/* eslint-disable @typescript-eslint/no-explicit-any,no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getAvailableApiSites, getConfig } from '@/lib/config';
import { searchFromApi } from '@/lib/downstream';
import { yellowWords } from '@/lib/yellow';

// 短剧搜索函数
async function searchShortDrama(
  query: string,
  page = 1,
  limit = 20
): Promise<any[]> {
  try {
    // 使用 AbortController 实现超时控制
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(
      `https://api.r2afosne.dpdns.org/vod/search?name=${encodeURIComponent(
        query
      )}&page=${page}&limit=${limit}`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': 'LunaTV/1.0',
        },
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Short drama API returned ${response.status}`);
    }

    const data = await response.json();

    if (!data.list || !Array.isArray(data.list)) {
      return [];
    }

    // 将短剧数据转换为统一的搜索结果格式，限制数量避免卡顿
    const limitedResults = data.list.slice(0, limit);
    return limitedResults.map((item: any) => ({
      id: item.id?.toString() || '',
      title: item.name || '',
      poster: item.cover || '',
      year: item.update_time
        ? new Date(item.update_time).getFullYear().toString()
        : 'unknown',
      episodes: [{ id: '1', name: '第1集' }], // 短剧通常有多集，但这里简化处理
      source: 'shortdrama',
      source_name: '短剧',
      douban_id: 0,
      type_name: '短剧',
      // 短剧特有字段
      score: item.score || 0,
      update_time: item.update_time || '',
      vod_class: '',
      vod_tag: '',
    }));
  } catch (error) {
    console.warn('短剧搜索失败:', error);
    return [];
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authInfo = getAuthInfoFromCookie(request);
  if (!authInfo || !authInfo.username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query) {
    return new Response(JSON.stringify({ error: '搜索关键词不能为空' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  const config = await getConfig();
  const apiSites = await getAvailableApiSites(authInfo.username);

  // 共享状态
  let streamClosed = false;

  // 创建可读流
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      // 辅助函数：安全地向控制器写入数据
      const safeEnqueue = (data: Uint8Array) => {
        try {
          if (
            streamClosed ||
            (!controller.desiredSize && controller.desiredSize !== 0)
          ) {
            // 流已标记为关闭或控制器已关闭
            return false;
          }
          controller.enqueue(data);
          return true;
        } catch (error) {
          // 控制器已关闭或出现其他错误
          console.warn('Failed to enqueue data:', error);
          streamClosed = true;
          return false;
        }
      };

      // 发送开始事件 (不包含短剧搜索源，因为它是独立处理的)
      const startEvent = `data: ${JSON.stringify({
        type: 'start',
        query,
        totalSources: apiSites.length, // 只计算API源，短剧搜索独立处理
        timestamp: Date.now(),
      })}\n\n`;

      if (!safeEnqueue(encoder.encode(startEvent))) {
        return; // 连接已关闭，提前退出
      }

      // 记录已完成的源数量和总结果数
      let completedSources = 0;
      const allResults: any[] = [];
      const maxTotalResults =
        (config.SiteConfig.SearchDownstreamMaxPage || 5) * 10;

      // 为每个源创建搜索 Promise
      const searchPromises = [
        ...apiSites.map(async (site) => {
          try {
            // 添加超时控制
            const searchPromise = Promise.race([
              searchFromApi(site, query),
              new Promise((_, reject) =>
                setTimeout(
                  () => reject(new Error(`${site.name} timeout`)),
                  20000
                )
              ),
            ]);

            const results = (await searchPromise) as any[];

            // 过滤黄色内容
            let filteredResults = results;
            if (!config.SiteConfig.DisableYellowFilter) {
              filteredResults = results.filter((result) => {
                const typeName = result.type_name || '';
                return !yellowWords.some((word: string) =>
                  typeName.includes(word)
                );
              });
            }

            // 检查是否已达到总结果数限制
            const remainingSlots = maxTotalResults - allResults.length;
            const limitedResults =
              remainingSlots > 0
                ? filteredResults.slice(0, remainingSlots)
                : [];

            // 发送该源的搜索结果
            completedSources++;

            if (!streamClosed && limitedResults.length > 0) {
              const sourceEvent = `data: ${JSON.stringify({
                type: 'source_result',
                source: site.key,
                sourceName: site.name,
                results: limitedResults,
                timestamp: Date.now(),
              })}\n\n`;

              if (!safeEnqueue(encoder.encode(sourceEvent))) {
                streamClosed = true;
                return; // 连接已关闭，停止处理
              }

              allResults.push(...limitedResults);
            }
          } catch (error) {
            console.warn(`搜索失败 ${site.name}:`, error);

            // 发送源错误事件
            completedSources++;

            if (!streamClosed) {
              const errorEvent = `data: ${JSON.stringify({
                type: 'source_error',
                source: site.key,
                sourceName: site.name,
                error: error instanceof Error ? error.message : '搜索失败',
                timestamp: Date.now(),
              })}\n\n`;

              if (!safeEnqueue(encoder.encode(errorEvent))) {
                streamClosed = true;
                return; // 连接已关闭，停止处理
              }
            }
          }

          // 检查是否所有API源都已完成 (不包括短剧搜索)
          if (completedSources === apiSites.length) {
            if (!streamClosed) {
              // 发送最终完成事件
              const completeEvent = `data: ${JSON.stringify({
                type: 'complete',
                totalResults: allResults.length,
                completedSources,
                timestamp: Date.now(),
              })}\n\n`;

              if (safeEnqueue(encoder.encode(completeEvent))) {
                // 只有在成功发送完成事件后才关闭流
                try {
                  controller.close();
                } catch (error) {
                  console.warn('Failed to close controller:', error);
                }
              }
            }
          }
        }),
        // 短剧搜索Promise
        async () => {
          try {
            const results = await searchShortDrama(query, 1, 20);

            if (!streamClosed) {
              if (results.length > 0) {
                const sourceEvent = `data: ${JSON.stringify({
                  type: 'source_result',
                  source: 'shortdrama',
                  sourceName: '短剧',
                  results: results,
                  timestamp: Date.now(),
                })}\n\n`;

                if (safeEnqueue(encoder.encode(sourceEvent))) {
                  allResults.push(...results);
                } else {
                  streamClosed = true;
                }
              } else {
                // 即使没有结果，也要发送完成事件
                const sourceEvent = `data: ${JSON.stringify({
                  type: 'source_result',
                  source: 'shortdrama',
                  sourceName: '短剧',
                  results: [],
                  timestamp: Date.now(),
                })}\n\n`;

                if (!safeEnqueue(encoder.encode(sourceEvent))) {
                  streamClosed = true;
                }
              }
            }
          } catch (error) {
            console.warn('短剧搜索失败:', error);

            if (!streamClosed) {
              const errorEvent = `data: ${JSON.stringify({
                type: 'source_error',
                source: 'shortdrama',
                sourceName: '短剧',
                error: error instanceof Error ? error.message : '搜索失败',
                timestamp: Date.now(),
              })}\n\n`;

              if (!safeEnqueue(encoder.encode(errorEvent))) {
                streamClosed = true;
              }
            }
          } finally {
            // 短剧搜索不计入completedSources，因为它是独立处理的
            // 不增加计数，避免与API源计数混淆
          }

          // 短剧搜索完成后不需要检查总数，因为它是独立的
          // API源完成后会自动关闭流
        },
      ];

      // 等待所有搜索完成
      await Promise.allSettled(searchPromises);
    },

    cancel() {
      // 客户端断开连接时，标记流已关闭
      streamClosed = true;
    },
  });

  // 返回流式响应
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
