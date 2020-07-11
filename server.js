const http = require('http');

const dcc = require('dcc-client');
const Discord = require('discord.js');

const config = {
  alias: process.env.PROJECT_DOMAIN,
  token: process.env.DISCORD_TOKEN,
  intents: Discord.Intents.FLAGS.GUILD_MESSAGES | Discord.Intents.FLAGS.DIRECT_MESSAGES,
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
  dst: 'wss://' + process.env.PROJECT_DOMAIN + '.glitch.me/dcc/v1/any',
  clientSecret: process.env.DCC_SECRET,
  endpoint: 'https://dcc.wh00.ml',
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
const bot = new Discord.Client();
bot.on(Discord.Constants.Events.DEBUG, (info) => {
  console.log('bot debug', info);
});
bot.on(Discord.Constants.Events.WARN, (info) => {
  console.warn('bot warn', info);
});
bot.on(Discord.Constants.Events.ERROR, (error) => {
  console.error('bot error', error);
});

const client = new dcc.Client(config.alias, config.clientSecret, {
  path: '/dcc/v1/any',
  server,
});
client.on('dispatch', (packet) => {
  let channel;
  if ('guild_id' in packet.d) {
    const guild = bot.guilds.add({
      id: packet.d.guild_id,
    });
    guild.available = true;
    channel = bot.channels.add({
      id: packet.d.channel_id,
      guild_id: packet.d.guild_id,
      type: Discord.Constants.ChannelTypes.TEXT,
    });
  } else {
    channel = bot.channels.add({
      id: packet.d.channel_id,
      type: Discord.Constants.ChannelTypes.DM,
    });
  }
  const message = channel.messages.add(packet.d);

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
  dcc.register(config).then(() => {
    console.log('register ok');
  }).catch((e) => {
    console.error('register failed', e);
  });
});
