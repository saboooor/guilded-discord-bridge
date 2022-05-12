const G = require('guilded.js');
const fs = require('fs');
module.exports = async (discord, guilded, config) => {
	// Load webhook clients and inject them into the servers object
	config.servers.forEach(async srv => {
		// Check if the serverId is set
		if (!srv.discord.serverId) return discord.logger.error('Discord serverId not specified in config!');
		if (!srv.guilded.serverId) return guilded.logger.error('Guilded serverId not specified in config!');

		// Get the discord server and check if it exists
		const discserver = await discord.guilds.fetch(srv.discord.serverId).catch(err => discord.logger.error(err));
		if (!discserver) return discord.logger.error(`${srv.discord.serverId} Discord server doesn't exist!`);

		// Get the guilded server's webhook and check if it exists
		const guilwebhook = await guilded.webhooks.getWebhook(srv.guilded.serverId, srv.guilded.webhookId);
		if (!guilwebhook) return guilded.logger.error(`${srv.guilded.serverId} Guilded webhook doesn't exist!`);

		// Get the discord server's webhooks and check if a webhook by the bot exists
		let discwebhook = (await discserver.fetchWebhooks()).find(w => w.owner.id == discord.user.id);

		// If the webhook doesn't exist, create it
		if (!discwebhook) {
			const channel = discserver.channels.cache.filter(c => c.isText()).first();
			discwebhook = await channel.createWebhook('Guilded-Discord Bridge', { reason: 'Webhook for Guilded-Discord Bridge' }).catch(err => discord.logger.error(err));
			if (!discwebhook) return discord.logger.error(`${discserver.name}'s Webhook couldn't be created!`);
			else discord.logger.warn(`${discserver.name}'s Webhook wasn't found, so it was created.`);
		}

		// Create a webhook client and inject it into the server's guilded object
		const guilwhclient = new G.WebhookClient({ id: srv.guilded.webhookId, token: srv.guilded.webhookToken });
		srv.guilded = {
			serverId: srv.guilded.serverId,
			webhook: guilwebhook,
			whclient: guilwhclient,
		};

		// Inject the webhook into the server's discord object
		srv.discord = {
			serverId: discserver.id,
			webhook: discwebhook,
		};

		// Log
		discord.logger.info(`${discserver.name}'s Webhook loaded`);
	});

	// Load events
	[discord, guilded].forEach(client => {
		let count = 0;
		const files = fs.readdirSync(`./bridge/events/${client.type.name}/`);
		files.forEach(file => {
			if (!file.endsWith('.js')) return;
			const event = require(`./events/${client.type.name}/${file}`);
			const eventName = file.split('.')[0];
			client.on(eventName, event.bind(null, discord, guilded, config));
			delete require.cache[require.resolve(`./events/${client.type.name}/${file}`)];
			count++;
		});
		client.logger.info(`${count} event listeners loaded`);
	});
};