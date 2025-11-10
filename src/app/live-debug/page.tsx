'use client';

import { useState } from 'react';

export default function LiveDebugPage() {
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [m3uTestResults, setM3uTestResults] = useState<any[]>([]);
  const [testingM3u, setTestingM3u] = useState(false);
  const [sourcesApiTest, setSourcesApiTest] = useState<any>(null);
  const [testingSourcesApi, setTestingSourcesApi] = useState(false);
  const [realSourcesTest, setRealSourcesTest] = useState<any>(null);
  const [testingRealSources, setTestingRealSources] = useState(false);
  const [configDebugTest, setConfigDebugTest] = useState<any>(null);
  const [testingConfigDebug, setTestingConfigDebug] = useState(false);
  const [fixConfigResult, setFixConfigResult] = useState<any>(null);
  const [fixingConfig, setFixingConfig] = useState(false);

  const runDiagnostics = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/live/debug');
      const data = await response.json();
      setDebugInfo(data);
    } catch (error) {
      setDebugInfo({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setLoading(false);
    }
  };

  const testM3uUrls = async () => {
    if (!debugInfo?.config?.liveSources) {
      alert('请先运行诊断获取直播源信息');
      return;
    }

    setTestingM3u(true);
    const results: any[] = [];

    for (const source of debugInfo.config.liveSources) {
      if (source.disabled) continue;

      try {
        const response = await fetch(
          `/api/live/test-m3u?url=${encodeURIComponent(source.url || '')}`
        );
        const data = await response.json();
        results.push({
          source: source.name,
          ...data,
        });
      } catch (error) {
        results.push({
          source: source.name,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    setM3uTestResults(results);
    setTestingM3u(false);
  };

  const testSourcesApi = async () => {
    setTestingSourcesApi(true);
    try {
      const response = await fetch('/api/live/test-sources');
      const data = await response.json();
      setSourcesApiTest(data);
    } catch (error) {
      setSourcesApiTest({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setTestingSourcesApi(false);
    }
  };

  const testRealSourcesApi = async () => {
    setTestingRealSources(true);
    try {
      const response = await fetch('/api/live/test-real-sources');
      const data = await response.json();
      setRealSourcesTest(data);
    } catch (error) {
      setRealSourcesTest({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setTestingRealSources(false);
    }
  };

  const testConfigDebug = async () => {
    setTestingConfigDebug(true);
    try {
      const response = await fetch('/api/live/debug-config');
      const data = await response.json();
      setConfigDebugTest(data);
    } catch (error) {
      setConfigDebugTest({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setTestingConfigDebug(false);
    }
  };

  const fixConfig = async () => {
    if (!confirm('确定要尝试修复配置吗？这将从ConfigFile恢复直播源配置。')) {
      return;
    }

    setFixingConfig(true);
    try {
      const response = await fetch('/api/live/fix-config', {
        method: 'POST',
      });
      const data = await response.json();
      setFixConfigResult(data);

      if (data.success) {
        alert('配置修复成功！请刷新页面重新测试。');
      }
    } catch (error) {
      setFixConfigResult({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setFixingConfig(false);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>直播源诊断工具</h1>
      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          onClick={runDiagnostics}
          disabled={loading}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            cursor: loading ? 'not-allowed' : 'pointer',
            backgroundColor: loading ? '#ccc' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
          }}
        >
          {loading ? '诊断中...' : '运行诊断'}
        </button>

        <button
          onClick={testM3uUrls}
          disabled={testingM3u || !debugInfo}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            cursor: testingM3u || !debugInfo ? 'not-allowed' : 'pointer',
            backgroundColor: testingM3u || !debugInfo ? '#ccc' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
          }}
        >
          {testingM3u ? '测试M3U中...' : '测试M3U访问'}
        </button>

        <button
          onClick={testSourcesApi}
          disabled={testingSourcesApi}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            cursor: testingSourcesApi ? 'not-allowed' : 'pointer',
            backgroundColor: testingSourcesApi ? '#ccc' : '#ffc107',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
          }}
        >
          {testingSourcesApi ? '测试API中...' : '测试Sources API'}
        </button>

        <button
          onClick={testRealSourcesApi}
          disabled={testingRealSources}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            cursor: testingRealSources ? 'not-allowed' : 'pointer',
            backgroundColor: testingRealSources ? '#ccc' : '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
          }}
        >
          {testingRealSources ? '测试中...' : '测试真实Sources API'}
        </button>

        <button
          onClick={testConfigDebug}
          disabled={testingConfigDebug}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            cursor: testingConfigDebug ? 'not-allowed' : 'pointer',
            backgroundColor: testingConfigDebug ? '#ccc' : '#6f42c1',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
          }}
        >
          {testingConfigDebug ? '诊断中...' : '深度配置诊断'}
        </button>

        <button
          onClick={fixConfig}
          disabled={fixingConfig}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            cursor: fixingConfig ? 'not-allowed' : 'pointer',
            backgroundColor: fixingConfig ? '#ccc' : '#fd7e14',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontWeight: 'bold',
          }}
        >
          {fixingConfig ? '修复中...' : '🔧 修复配置'}
        </button>
      </div>

      {debugInfo && (
        <div style={{ marginTop: '20px' }}>
          <h2>诊断结果</h2>
          <div
            style={{
              backgroundColor: '#f5f5f5',
              padding: '15px',
              borderRadius: '4px',
              maxHeight: '600px',
              overflow: 'auto',
            }}
          >
            <h3>基本信息</h3>
            <p>
              <strong>状态:</strong> {debugInfo.success ? '✅ 成功' : '❌ 失败'}
            </p>
            <p>
              <strong>时间:</strong> {debugInfo.timestamp}
            </p>
            <p>
              <strong>耗时:</strong> {debugInfo.duration}ms
            </p>

            {debugInfo.config && (
              <>
                <h3>配置信息</h3>
                <p>
                  <strong>视频源数量:</strong> {debugInfo.config.sourceCount}
                </p>
                <p>
                  <strong>直播源总数:</strong>{' '}
                  {debugInfo.config.liveSourceCount}
                </p>
                <p>
                  <strong>启用的直播源:</strong>{' '}
                  {debugInfo.config.enabledLiveSourceCount}
                </p>

                {debugInfo.config.liveSources &&
                  debugInfo.config.liveSources.length > 0 && (
                    <>
                      <h4>直播源列表</h4>
                      <ul>
                        {debugInfo.config.liveSources.map(
                          (source: any, index: number) => (
                            <li key={index}>
                              <strong>{source.name}</strong> ({source.key})
                              <br />
                              状态:{' '}
                              {source.disabled ? '❌ 已禁用' : '✅ 已启用'}
                              <br />
                              来源: {source.from}
                            </li>
                          )
                        )}
                      </ul>
                    </>
                  )}
              </>
            )}

            {debugInfo.logs && debugInfo.logs.length > 0 && (
              <>
                <h3>详细日志</h3>
                <pre
                  style={{
                    backgroundColor: '#000',
                    color: '#0f0',
                    padding: '10px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    overflow: 'auto',
                  }}
                >
                  {debugInfo.logs.join('\n')}
                </pre>
              </>
            )}

            {debugInfo.error && (
              <>
                <h3 style={{ color: 'red' }}>错误信息</h3>
                <p style={{ color: 'red' }}>{debugInfo.error}</p>
                {debugInfo.errorStack && (
                  <pre
                    style={{
                      backgroundColor: '#fee',
                      color: '#c00',
                      padding: '10px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      overflow: 'auto',
                    }}
                  >
                    {debugInfo.errorStack}
                  </pre>
                )}
              </>
            )}

            <h3>完整响应</h3>
            <pre
              style={{
                backgroundColor: '#f0f0f0',
                padding: '10px',
                borderRadius: '4px',
                fontSize: '12px',
                overflow: 'auto',
              }}
            >
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {fixConfigResult && (
        <div style={{ marginTop: '20px' }}>
          <h2>配置修复结果</h2>
          <div
            style={{
              backgroundColor: fixConfigResult.success ? '#d4edda' : '#f8d7da',
              border: `1px solid ${
                fixConfigResult.success ? '#c3e6cb' : '#f5c6cb'
              }`,
              padding: '15px',
              borderRadius: '4px',
            }}
          >
            <h3>{fixConfigResult.success ? '✅ 修复成功' : '❌ 修复失败'}</h3>
            {fixConfigResult.success ? (
              <>
                <p>
                  <strong>恢复的直播源数量:</strong>{' '}
                  {fixConfigResult.recoveredLiveSources}
                </p>
                {fixConfigResult.liveSources &&
                  fixConfigResult.liveSources.length > 0 && (
                    <>
                      <h4>恢复的直播源:</h4>
                      <ul>
                        {fixConfigResult.liveSources.map(
                          (source: any, index: number) => (
                            <li key={index}>
                              {source.name} ({source.key}) -{' '}
                              {source.disabled ? '已禁用' : '已启用'}
                            </li>
                          )
                        )}
                      </ul>
                    </>
                  )}
                <p style={{ color: '#28a745', fontWeight: 'bold' }}>
                  请刷新页面并重新测试直播功能！
                </p>
              </>
            ) : (
              <>
                <p style={{ color: 'red' }}>
                  <strong>错误:</strong> {fixConfigResult.error}
                </p>
                {fixConfigResult.suggestion && (
                  <p
                    style={{
                      color: '#856404',
                      backgroundColor: '#fff3cd',
                      padding: '10px',
                      borderRadius: '4px',
                    }}
                  >
                    <strong>建议:</strong> {fixConfigResult.suggestion}
                  </p>
                )}
              </>
            )}
            {fixConfigResult.logs && (
              <details>
                <summary>查看详细日志</summary>
                <pre
                  style={{
                    backgroundColor: '#000',
                    color: '#0f0',
                    padding: '10px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    overflow: 'auto',
                    marginTop: '10px',
                  }}
                >
                  {fixConfigResult.logs.join('\n')}
                </pre>
              </details>
            )}
          </div>
        </div>
      )}

      {configDebugTest && (
        <div style={{ marginTop: '20px' }}>
          <h2>深度配置诊断结果</h2>
          <div
            style={{
              backgroundColor: configDebugTest.success ? '#d4edda' : '#f8d7da',
              border: `1px solid ${
                configDebugTest.success ? '#c3e6cb' : '#f5c6cb'
              }`,
              padding: '15px',
              borderRadius: '4px',
            }}
          >
            <h3>{configDebugTest.success ? '✅ 成功' : '❌ 失败'}</h3>
            {configDebugTest.success ? (
              <>
                <p>
                  <strong>第一次获取:</strong> LiveConfig数量 ={' '}
                  {configDebugTest.config1?.liveSourceCount || 0}
                </p>
                <p>
                  <strong>第二次获取:</strong> LiveConfig数量 ={' '}
                  {configDebugTest.config2?.liveSourceCount || 0}
                </p>
                <p>
                  <strong>是否同一对象:</strong>{' '}
                  {configDebugTest.sameObject ? '是' : '否'}
                </p>
                {configDebugTest.config1?.liveSources &&
                  configDebugTest.config1.liveSources.length > 0 && (
                    <>
                      <h4>直播源列表:</h4>
                      <ul>
                        {configDebugTest.config1.liveSources.map(
                          (source: any, index: number) => (
                            <li key={index}>
                              {source.name} ({source.key}) -{' '}
                              {source.disabled ? '已禁用' : '已启用'}
                            </li>
                          )
                        )}
                      </ul>
                    </>
                  )}
              </>
            ) : (
              <p style={{ color: 'red' }}>
                <strong>错误:</strong> {configDebugTest.error}
              </p>
            )}
            {configDebugTest.logs && (
              <details>
                <summary>查看详细日志</summary>
                <pre
                  style={{
                    backgroundColor: '#000',
                    color: '#0f0',
                    padding: '10px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    overflow: 'auto',
                    marginTop: '10px',
                  }}
                >
                  {configDebugTest.logs.join('\n')}
                </pre>
              </details>
            )}
          </div>
        </div>
      )}

      {realSourcesTest && (
        <div style={{ marginTop: '20px' }}>
          <h2>真实Sources API测试结果</h2>
          <div
            style={{
              backgroundColor: realSourcesTest.success ? '#d4edda' : '#f8d7da',
              border: `1px solid ${
                realSourcesTest.success ? '#c3e6cb' : '#f5c6cb'
              }`,
              padding: '15px',
              borderRadius: '4px',
            }}
          >
            <h3>{realSourcesTest.success ? '✅ 成功' : '❌ 失败'}</h3>
            {realSourcesTest.success ? (
              <>
                <p>
                  <strong>API响应:</strong>
                </p>
                <pre
                  style={{
                    backgroundColor: '#f0f0f0',
                    padding: '10px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    overflow: 'auto',
                  }}
                >
                  {JSON.stringify(realSourcesTest.apiResponse, null, 2)}
                </pre>
              </>
            ) : (
              <p style={{ color: 'red' }}>
                <strong>错误:</strong> {realSourcesTest.error}
              </p>
            )}
            {realSourcesTest.logs && (
              <details>
                <summary>查看详细日志</summary>
                <pre
                  style={{
                    backgroundColor: '#000',
                    color: '#0f0',
                    padding: '10px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    overflow: 'auto',
                    marginTop: '10px',
                  }}
                >
                  {realSourcesTest.logs.join('\n')}
                </pre>
              </details>
            )}
          </div>
        </div>
      )}

      {sourcesApiTest && (
        <div style={{ marginTop: '20px' }}>
          <h2>Sources API测试结果</h2>
          <div
            style={{
              backgroundColor: sourcesApiTest.success ? '#d4edda' : '#f8d7da',
              border: `1px solid ${
                sourcesApiTest.success ? '#c3e6cb' : '#f5c6cb'
              }`,
              padding: '15px',
              borderRadius: '4px',
            }}
          >
            <h3>{sourcesApiTest.success ? '✅ 成功' : '❌ 失败'}</h3>
            {sourcesApiTest.success ? (
              <>
                <p>
                  <strong>API响应:</strong>
                </p>
                <pre
                  style={{
                    backgroundColor: '#f0f0f0',
                    padding: '10px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    overflow: 'auto',
                  }}
                >
                  {JSON.stringify(sourcesApiTest.apiResponse, null, 2)}
                </pre>
              </>
            ) : (
              <p style={{ color: 'red' }}>
                <strong>错误:</strong> {sourcesApiTest.error}
              </p>
            )}
            {sourcesApiTest.logs && (
              <details>
                <summary>查看详细日志</summary>
                <pre
                  style={{
                    backgroundColor: '#000',
                    color: '#0f0',
                    padding: '10px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    overflow: 'auto',
                    marginTop: '10px',
                  }}
                >
                  {sourcesApiTest.logs.join('\n')}
                </pre>
              </details>
            )}
          </div>
        </div>
      )}

      {m3uTestResults.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <h2>M3U访问测试结果</h2>
          {m3uTestResults.map((result, index) => (
            <div
              key={index}
              style={{
                backgroundColor: result.success ? '#d4edda' : '#f8d7da',
                border: `1px solid ${result.success ? '#c3e6cb' : '#f5c6cb'}`,
                padding: '15px',
                borderRadius: '4px',
                marginBottom: '10px',
              }}
            >
              <h3>
                {result.success ? '✅' : '❌'} {result.source}
              </h3>
              {result.success ? (
                <>
                  <p>
                    <strong>状态:</strong> {result.status}
                  </p>
                  <p>
                    <strong>内容长度:</strong> {result.contentLength} bytes
                  </p>
                  <p>
                    <strong>频道数量:</strong> {result.channelCount}
                  </p>
                  <p>
                    <strong>耗时:</strong> {result.duration}ms
                  </p>
                  {result.logs && (
                    <details>
                      <summary>查看详细日志</summary>
                      <pre
                        style={{
                          backgroundColor: '#000',
                          color: '#0f0',
                          padding: '10px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          overflow: 'auto',
                          marginTop: '10px',
                        }}
                      >
                        {result.logs.join('\n')}
                      </pre>
                    </details>
                  )}
                </>
              ) : (
                <>
                  <p style={{ color: 'red' }}>
                    <strong>错误:</strong> {result.error}
                  </p>
                  {result.logs && (
                    <details>
                      <summary>查看详细日志</summary>
                      <pre
                        style={{
                          backgroundColor: '#000',
                          color: '#f00',
                          padding: '10px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          overflow: 'auto',
                          marginTop: '10px',
                        }}
                      >
                        {result.logs.join('\n')}
                      </pre>
                    </details>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <div
        style={{
          marginTop: '20px',
          padding: '15px',
          backgroundColor: '#fff3cd',
          borderRadius: '4px',
        }}
      >
        <h3>使用说明</h3>
        <ol>
          <li>点击"运行诊断"按钮</li>
          <li>
            查看诊断结果，特别关注：
            <ul>
              <li>启用的直播源数量是否为0</li>
              <li>config.json文件是否存在</li>
              <li>环境变量配置是否正确</li>
            </ul>
          </li>
          <li>点击"测试M3U访问"按钮，测试M3U文件是否可以访问</li>
          <li>点击"测试Sources API"按钮，测试API是否正常工作</li>
          <li>如果发现问题，根据日志信息进行修复</li>
          <li>修复后重新运行诊断确认</li>
        </ol>
        <p>
          <strong>访问路径:</strong> /live-debug
        </p>
      </div>
    </div>
  );
}
