const http = require('http');

const shardsnap = require('shardsnap');
const Discord = require('discord.js');

const config = {
  alias: process.env.PROJECT_DOMAIN,
  token: process.env.DISCORD_TOKEN,
  intents: Discord.GatewayIntentBits.GuildMessages | Discord.GatewayIntentBits.DirectMessages,
  criteria: {
    // corresponds to what we declared in the intents, but further filters out messages like
    // READY, CHANNEL_CREATE, and MESSAGE_UPDATE
    t: 'MESSAGE_CREATE',
    // ignore messages from self and other bots
    $not: {'d.author.bot': true},
    $or: [
      // DMs
      {'d.guild_id': {$exists: false}},
      // mentions
      {'d.mentions': {$elemMatch: {id: process.env.BOT_USER_ID}}},
      // prefix
      {'d.content': {$regex: '^!'}},
    ],
  },
  dst: 'wss://' + process.env.PROJECT_DOMAIN + '.glitch.me/shardsnap/v1/any',
  clientSecret: process.env.SHARDSNAP_SECRET,
  endpoint: 'https://ocdcc.wh00.ml',
};

//
// web service
//

const server = http.createServer((req, res) => {
  res.end(`<a href="https://discord.com/api/oauth2/authorize?client_id=${process.env.BOT_USER_ID}&scope=bot&permissions=0">invite</a>`);
});

//
// bot
//

function logReject(p) {
  p.catch((e) => {
    console.error(e);
  });
}

// discord.js will surreptitiously take the token from the DISCORD_TOKEN environment variable.
// discord.js Client constructor validates that intents option is present, but we won't connect, so we won't use it.
const bot = new Discord.Client({intents: 0});
bot.on(Discord.Events.Debug, (info) => {
  console.log('bot debug', info);
});
bot.on(Discord.Events.Warn, (info) => {
  console.warn('bot warn', info);
});
bot.on(Discord.Events.Error, (error) => {
  console.error('bot error', error);
});
// discord.js normally sets this in login(), but we won't call that, so do it manually.
bot.rest.setToken(bot.token);

const client = new shardsnap.Client(config.alias, config.clientSecret, {
  path: '/shardsnap/v1/any',
  server,
});
client.on('dispatch', (packet) => {
  let channel;
  if ('guild_id' in packet.d) {
    const guild = bot.guilds._add({
      id: packet.d.guild_id,
    });
    channel = bot.channels._add({
      id: packet.d.channel_id,
      guild_id: packet.d.guild_id,
      type: Discord.ChannelType.GuildText,
    });
  } else {
    channel = bot.channels._add({
      id: packet.d.channel_id,
      type: Discord.ChannelType.DM,
    });
  }
  const message = channel.messages._add(packet.d);

  if (message.content.startsWith('!ping')) {
    logReject(message.reply('pong'));
    return;
  }

  console.log('unmatched command');
});

//
// start
//

server.listen(process.env.PORT, () => {
  console.log('listening', process.env.PORT);
  shardsnap.register(config).then(() => {
    console.log('register ok');
  }).catch((e) => {
    console.error('register failed', e);
  });
});
