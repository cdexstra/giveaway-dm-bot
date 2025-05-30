const { Client, GatewayIntentBits, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
require('dotenv').config();

const GIVEAWAY_BOT_ID = process.env.GIVEAWAY_BOT_ID;
const CLAIM_CHANNEL_ID = process.env.CLAIM_CHANNEL_ID;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers, // Needed to fetch all members
  ]
});

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  console.log(`Expecting giveaway bot ID: ${GIVEAWAY_BOT_ID}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.id !== GIVEAWAY_BOT_ID) return;

  // Match the giveaway end message format:
  // "Congratulations <@805022775022583829>! You won the **100 robux**!"
  const giveawayEndRegex = /^Congratulations <@!?(\d+)>! You won the \*\*(.+)\*\*!$/;
  const match = message.content.match(giveawayEndRegex);

  if (!match) return; // Not a giveaway end message

  const winnerId = match[1];
  const prize = match[2];

  // Fetch all members to DM everyone except bots
  let members;
  try {
    members = await message.guild.members.fetch();
  } catch (err) {
    console.warn(`Could not fetch members: ${err.message}`);
    return;
  }

  // Find original giveaway embed message in this channel to get hostedBy
  let hostedBy = 'Unknown';

  try {
    const fetchedMessages = await message.channel.messages.fetch({ limit: 50 });

    const giveawayEmbedMsg = fetchedMessages.find(msg => {
      if (msg.author.id !== GIVEAWAY_BOT_ID) return false;
      if (!msg.embeds.length) return false;

      const embed = msg.embeds[0];
      const desc = embed.description?.toLowerCase() || '';
      const title = embed.title?.toLowerCase() || '';
      const prizeLower = prize.toLowerCase();

      // Check if prize is mentioned anywhere in embed (title or description) & contains Hosted by
      return (desc.includes(prizeLower) || title.includes(prizeLower)) && desc.includes('hosted by');
    });

    if (giveawayEmbedMsg) {
      const embed = giveawayEmbedMsg.embeds[0];
      const desc = embed.description;

      const hostedByMatch = desc.match(/Hosted by: (.+)/i);
      if (hostedByMatch) hostedBy = hostedByMatch[1].trim();
    }
  } catch (err) {
    console.warn(`Error fetching giveaway embed message: ${err.message}`);
  }

  // Format timestamps for embed footer
  const endedTimestamp = Math.floor(message.createdTimestamp / 1000);
  const d = new Date(message.createdTimestamp);
  const pad = (n) => (n < 10 ? '0' + n : n);
  const footerText = `Today at ${pad(d.getHours())}:${pad(d.getMinutes())}`;

  // DM EVERYONE (except bots)
  members.forEach(async (member) => {
    if (member.user.bot) return;

    // Create embed customized per member (for username)
    const fakeEmbed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle('GIVEAWAY ENDED')
      .setDescription(
        `**${prize}**\n\n` +
        `Ended: <t:${endedTimestamp}:R> (<t:${endedTimestamp}:f>)\n` +
        `Hosted by: ${hostedBy}\n` +
        `Winner: ${member.user.username}`
      )
      .setFooter({ text: footerText });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('Claim')
        .setStyle(ButtonStyle.Link)
        .setURL(`https://discord.com/channels/${message.guild.id}/${CLAIM_CHANNEL_ID}`)
    );

    try {
      await member.send({
        content: `Congratulations ${member.user}! You won the **${prize}**!`,
        embeds: [fakeEmbed],
        components: [row],
      });
      console.log(`[INFO] Sent giveaway DM to ${member.user.tag}`);
    } catch (err) {
      console.warn(`[WARN] Could not DM ${member.user.tag}: ${err.message}`);
    }
  });
});

client.login(process.env.TOKEN);
