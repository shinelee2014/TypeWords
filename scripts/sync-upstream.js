const { execSync } = require('child_process');

console.log('🔄 开始从官方上游 (upstream) 拉取最新代码...');

function run(command) {
  try {
    return execSync(command, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch (error) {
    if (error.stderr) console.error(error.stderr.trim());
    throw error;
  }
}

try {
  // 1. 确保 upstream 远程配置存在
  const remotes = run('git remote');
  if (!remotes.includes('upstream')) {
    console.log('➕ 添加 upstream 远程源: https://github.com/zyronon/TypeWords.git');
    run('git remote add upstream https://github.com/zyronon/TypeWords.git');
  }

  // 2. Fetch 上游更新
  console.log('📡 正在获取 upstream/master 提交...');
  run('git fetch upstream master');

  // 3. 检查是否有新提交
  const upstreamHead = run('git rev-parse upstream/master');
  const mergeBase = run('git merge-base HEAD upstream/master');

  if (upstreamHead === mergeBase) {
    console.log('✅ 当前分支已是上游最新版本，无需同步。');
  } else {
    console.log('📥 发现上游有新版本更新，正在合并...');
    run('git merge upstream/master -m "chore(sync): 同步原作者最新版本" --no-edit');
    console.log('🚀 正在推送到您的 GitHub Fork 仓库 (origin master)...');
    run('git push origin master');
    console.log('🎉 同步并推送成功！GitHub Actions 将自动触发部署最新版本。');
  }
} catch (err) {
  console.error('❌ 同步过程中发生错误:', err.message);
  process.exit(1);
}
