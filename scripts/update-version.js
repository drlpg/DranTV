#!/usr/bin/env node

/* eslint-disable */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * 版本更新脚本
 * 用法: node scripts/update-version.js <version> [--skip-changelog]
 *
 * 示例:
 *   node scripts/update-version.js 1.0.4
 *   node scripts/update-version.js 1.0.4 --skip-changelog
 *
 * 功能:
 * 1. 在 CHANGELOG 顶部添加新版本模板（可选）
 * 2. 更新 VERSION.txt
 * 3. 运行 convert-changelog.js 生成 changelog.ts
 * 4. 更新 src/lib/version.ts
 */

function printUsage() {
  console.log(`
📦 版本更新脚本

用法:
  node scripts/update-version.js <version> [options]

参数:
  <version>           新版本号 (例如: 1.0.4)

选项:
  --skip-changelog    跳过 CHANGELOG 模板添加（如果已手动编辑）
  --help, -h          显示帮助信息

示例:
  node scripts/update-version.js 1.0.4
  node scripts/update-version.js 1.0.4 --skip-changelog

流程:
  1. 在 CHANGELOG 顶部添加新版本模板
  2. 更新 VERSION.txt
  3. 更新 package.json
  4. 运行 convert-changelog.js 生成 changelog.ts
  5. 更新 src/lib/version.ts
`);
}

function validateVersion(version) {
  const versionRegex = /^\d+\.\d+\.\d+$/;
  if (!versionRegex.test(version)) {
    console.error('❌ 版本号格式错误，应为 X.Y.Z 格式（例如: 1.0.4）');
    process.exit(1);
  }
}

function getCurrentDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addChangelogTemplate(version) {
  const changelogPath = path.join(process.cwd(), 'CHANGELOG');
  const date = getCurrentDate();

  try {
    const existingContent = fs.readFileSync(changelogPath, 'utf8');

    // 检查版本是否已存在
    if (existingContent.includes(`## [${version}]`)) {
      console.log(`⚠️  版本 ${version} 已存在于 CHANGELOG 中，跳过模板添加`);
      return;
    }

    const template = `## [${version}] - ${date}

### Added

- 

### Changed

- 

### Fixed

- 

`;

    const newContent = template + existingContent;
    fs.writeFileSync(changelogPath, newContent, 'utf8');
    console.log(`✅ 已在 CHANGELOG 顶部添加版本 ${version} 模板`);
    console.log(`📝 请编辑 CHANGELOG 文件，填写更新内容后继续`);
  } catch (error) {
    console.error(`❌ 无法更新 CHANGELOG:`, error.message);
    process.exit(1);
  }
}

function updateVersionTxt(version) {
  const versionTxtPath = path.join(process.cwd(), 'VERSION.txt');
  try {
    fs.writeFileSync(versionTxtPath, version, 'utf8');
    console.log(`✅ 已更新 VERSION.txt: ${version}`);
  } catch (error) {
    console.error(`❌ 无法更新 VERSION.txt:`, error.message);
    process.exit(1);
  }
}

function runConvertChangelog() {
  const scriptPath = path.join(process.cwd(), 'scripts/convert-changelog.js');
  try {
    console.log('🔄 正在运行 convert-changelog.js...');
    execSync(`node "${scriptPath}"`, { stdio: 'inherit' });
  } catch (error) {
    console.error(`❌ 运行 convert-changelog.js 失败:`, error.message);
    process.exit(1);
  }
}

function updatePackageJson(version) {
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    packageJson.version = version;
    fs.writeFileSync(
      packageJsonPath,
      JSON.stringify(packageJson, null, 2) + '\n',
      'utf8'
    );
    console.log(`✅ 已更新 package.json: ${version}`);
  } catch (error) {
    console.error(`❌ 无法更新 package.json:`, error.message);
    process.exit(1);
  }
}

function updateVersionTs(version) {
  const versionTsPath = path.join(process.cwd(), 'src/lib/version.ts');
  try {
    let content = fs.readFileSync(versionTsPath, 'utf8');

    // 替换 CURRENT_VERSION 常量
    const updatedContent = content.replace(
      /const CURRENT_VERSION = ['"`][^'"`]+['"`];/,
      `const CURRENT_VERSION = '${version}';`
    );

    fs.writeFileSync(versionTsPath, updatedContent, 'utf8');
    console.log(`✅ 已更新 src/lib/version.ts: ${version}`);
  } catch (error) {
    console.error(`❌ 无法更新 version.ts:`, error.message);
    process.exit(1);
  }
}

function main() {
  const args = process.argv.slice(2);

  // 显示帮助
  if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    printUsage();
    process.exit(0);
  }

  const version = args[0];
  const skipChangelog = args.includes('--skip-changelog');

  // 验证版本号
  validateVersion(version);

  console.log(`\n🚀 开始更新版本到 ${version}\n`);

  // 步骤 1: 添加 CHANGELOG 模板（可选）
  if (!skipChangelog) {
    addChangelogTemplate(version);
    console.log('\n⏸️  请编辑 CHANGELOG 文件，填写更新内容');
    console.log('完成后，运行以下命令继续:');
    console.log(
      `   node scripts/update-version.js ${version} --skip-changelog\n`
    );
    process.exit(0);
  }

  // 步骤 2: 更新 VERSION.txt
  console.log('📝 步骤 1/4: 更新 VERSION.txt');
  updateVersionTxt(version);

  // 步骤 3: 更新 package.json
  console.log('\n📝 步骤 2/4: 更新 package.json');
  updatePackageJson(version);

  // 步骤 4: 运行 convert-changelog.js
  console.log('\n📝 步骤 3/4: 生成 changelog.ts');
  runConvertChangelog();

  // 步骤 5: 更新 version.ts
  console.log('\n📝 步骤 4/4: 更新 version.ts');
  updateVersionTs(version);

  console.log('\n✨ 版本更新完成！\n');
  console.log('📋 后续步骤:');
  console.log('   1. 检查生成的文件是否正确');
  console.log(
    '   2. 提交更改: git add . && git commit -m "chore: release v' +
      version +
      '"'
  );
  console.log('   3. 创建标签: git tag v' + version);
  console.log('   4. 推送代码: git push && git push --tags\n');
}

if (require.main === module) {
  main();
}
