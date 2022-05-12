const { MessageMentions: { ChannelsPattern, RolesPattern, UsersPattern } } = require('discord.js');
const { Embed } = require('guilded.js');
module.exports = async (discord, guilded, config, oldmsg, newmsg) => {
	// Get the server config and check if it exists
	const srv = config.servers.find(s => s.discord.serverId == newmsg.guild.id);
	if (!srv) return;

	// Get the channel config and check if it and the cached message exists
	const bridge = srv.channels.find(b => b.discord.channelId == newmsg.channel.id);
	if (!bridge || !bridge.messages[newmsg.id]) return;

	// Parse all channel mentions
	const channelMatches = [...newmsg.content.matchAll(ChannelsPattern)];
	channelMatches.forEach(match => {
		const channel = discord.channels.cache.get(match[1]);
		newmsg.content = newmsg.content.replace(match[0], `#${channel.name}`);
	});

	// Parse all role mentions
	const roleMatches = [...newmsg.content.matchAll(RolesPattern)];
	roleMatches.forEach(match => {
		const role = newmsg.guild.roles.cache.get(match[1]);
		newmsg.content = newmsg.content.replace(match[0], `@${role.name}`);
	});

	// Parse all user mentions
	const userMatches = [...newmsg.content.matchAll(UsersPattern)];
	userMatches.forEach(match => {
		const user = discord.users.cache.get(match[1]);
		newmsg.content = newmsg.content.replace(match[0], `@${user.tag}`);
	});

	const attachment = newmsg.attachments.first();
	if (attachment) {
		const imgurl = attachment.url;
		const attachEmbed = new Embed()
			.setColor(0x32343d)
			.setTitle('**Attachment**')
			.setDescription(`**[${attachment.name}](${imgurl})**`);
		if (attachment.contentType.split('/')[0] == 'image') attachEmbed.setImage(imgurl);
		newmsg.embeds.push(attachEmbed);
	}

	// Get the nameformat from the configs
	const nameformat = (bridge.guilded.nameformat ?? srv.guilded.nameformat ?? config.guilded.nameformat).replace(/{name}/g, newmsg.author.tag);

	// Edit the message
	const { channelId, id } = bridge.messages[newmsg.id];
	guilded.messages.update(channelId, id, { content: `${nameformat}${newmsg.content}`, embeds: [newmsg.embeds[0]] });
};