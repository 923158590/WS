/**
 * 发送 !start 命令到测试系统
 */

const mineflayer = require('mineflayer');

const bot = mineflayer.createBot({
  host: 'localhost',
  port: 25565,
  username: 'Bot_0'
});

bot.on('spawn', () => {
  console.log('✅ 已连接到服务器');

  // 发送 !start 命令
  console.log('📤 发送 !start 命令...');
  bot.chat('!start');

  // 等待 2 秒后断开
  setTimeout(() => {
    console.log('✅ 命令已发送，断开连接');
    bot.quit();
  }, 2000);
});

bot.on('error', (err) => {
  console.error('❌ 错误:', err);
  process.exit(1);
});

bot.on('end', () => {
  console.log('🔌 已断开连接');
  process.exit(0);
});
