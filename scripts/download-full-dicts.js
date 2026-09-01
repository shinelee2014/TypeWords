const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE = 'https://typewords.cc';

function downloadFile(url, dest, force = false) {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(dest);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    if (!force && fs.existsSync(dest) && fs.statSync(dest).size > 100) {
      return resolve({ cached: true, file: dest });
    }

    const file = fs.createWriteStream(dest);
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      if (res.statusCode !== 200) {
        fs.unlink(dest, () => {});
        return reject(new Error('Failed to download ' + url + ', status: ' + res.statusCode));
      }
      res.pipe(file);
      file.on('finish', () => {
        file.close(() => resolve({ cached: false, file: dest }));
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function asyncPool(poolLimit, array, iteratorFn) {
  const ret = [];
  const executing = [];
  for (const item of array) {
    const p = Promise.resolve().then(() => iteratorFn(item));
    ret.push(p);
    if (poolLimit <= array.length) {
      const e = p.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);
      if (executing.length >= poolLimit) {
        await Promise.race(executing);
      }
    }
  }
  return Promise.all(ret);
}

async function main() {
  console.log('📦 1. 正在同步词库与文章索引列表...');
  const listDir = path.resolve(process.cwd(), 'public/list');
  if (!fs.existsSync(listDir)) fs.mkdirSync(listDir, { recursive: true });

  const listFiles = [
    'list/word.json',
    'list/recommend_word.json',
    'list/article.json',
    'list/recommend_article.json'
  ];

  for (const file of listFiles) {
    const target = path.resolve(process.cwd(), 'public', file);
    await downloadFile(BASE + '/' + file, target, true);
    console.log('  ✓ 已同步: ' + file);
  }

  const words = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'public/list/word.json'), 'utf8'));
  const articles = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'public/list/article.json'), 'utf8'));

  console.log('\n📚 2. 开始下载全部单词词库 (共 ' + words.length + ' 本)...');
  let downloadedWords = 0;
  await asyncPool(8, words, async (item) => {
    const lang = item.language || 'en';
    const relPath = 'dicts/' + lang + '/word/' + item.url;
    const dest = path.resolve(process.cwd(), 'public', relPath);
    try {
      const res = await downloadFile(BASE + '/' + relPath, dest);
      downloadedWords++;
      process.stdout.write('\r  进度: [' + downloadedWords + '/' + words.length + '] ' + item.name + ' (' + item.url + ') ' + (res.cached ? '(已存在)' : '(已下载)'));
    } catch (e) {
      console.error('\n  ❌ 下载失败: ' + item.name + ' (' + item.url + '): ' + e.message);
    }
  });

  console.log('\n\n📖 3. 开始下载全部文章书籍 (共 ' + articles.length + ' 本)...');
  let downloadedArticles = 0;
  await asyncPool(8, articles, async (item) => {
    const lang = item.language || 'en';
    const relPath = 'dicts/' + lang + '/article/' + item.url;
    const dest = path.resolve(process.cwd(), 'public', relPath);
    try {
      const res = await downloadFile(BASE + '/' + relPath, dest);
      downloadedArticles++;
      process.stdout.write('\r  进度: [' + downloadedArticles + '/' + articles.length + '] ' + item.name + ' (' + item.url + ') ' + (res.cached ? '(已存在)' : '(已下载)'));
    } catch (e) {
      console.error('\n  ❌ 下载失败: ' + item.name + ' (' + item.url + '): ' + e.message);
    }
  });

  console.log('\n\n🎉 全部词库与文章数据已完整拉取到本地！');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
