const { Manager } = require("erela.js");

class MusicHandler {
  constructor(client) {
    this.client = client;
    this.manager = new Manager({
      nodes: [
        {
          host: "TU_DOMINIO_RAILWAY", // sin https://
          port: 2333,
          password: "TU_PASSWORD_LAVALINK",
          secure: true,
        },
      ],
      send: (id, payload) => {
        const guild = this.client.guilds.cache.get(id);
        if (guild) guild.shard.send(payload);
      },
    });

    this.registerEvents();
  }

  init() {
    this.manager.init(this.client.user.id);
  }

  registerEvents() {
    this.manager.on("nodeConnect", node => console.log(`Nodo conectado: ${node.options.identifier}`));
    this.manager.on("nodeError", (node, error) => console.log(`Error en nodo ${node.options.identifier}: ${error.message}`));
    this.manager.on("trackStart", (player, track) => {
      const channel = this.client.channels.cache.get(player.textChannel);
      if (channel) channel.send(`Reproduciendo: **${track.title}**`);
    });
    this.manager.on("queueEnd", player => {
      const channel = this.client.channels.cache.get(player.textChannel);
      if (channel) channel.send("La cola terminó, desconectando...");
      player.destroy();
    });
  }

    async onMessage(message) {
    if (!message.guild || !message.member.voice.channel) return;

    const prefix = "!";
    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    const player = this.manager.players.get(message.guild.id);

    if (command === "mon!play") {
        const query = args.join(" ");
        if (!query) return message.channel.send("Debes escribir el nombre o URL de la canción.");

        let voiceChannel = message.member.voice.channel;
        if (!voiceChannel) return message.channel.send("Debes estar en un canal de voz para reproducir música.");

        let player = this.manager.players.get(message.guild.id);
        if (!player) {
        player = this.manager.create({
            guild: message.guild.id,
            voiceChannel: voiceChannel.id,
            textChannel: message.channel.id,
            selfDeafen: true,
        });
        }

        if (player.state !== "CONNECTED") await player.connect();

        try {
        const searchResult = await this.manager.search(query, message.author);

        if (searchResult.loadType === "NO_MATCHES") return message.channel.send("No se encontraron resultados.");
        if (searchResult.loadType === "LOAD_FAILED") return message.channel.send("Error buscando la canción.");

        if (searchResult.loadType === "PLAYLIST_LOADED") {
            player.queue.add(searchResult.tracks);
            message.channel.send(`Playlist agregada: ${searchResult.playlist.name}`);
        } else {
            player.queue.add(searchResult.tracks[0]);
            message.channel.send(`Canción agregada: ${searchResult.tracks[0].title}`);
        }

        if (!player.playing && !player.paused) player.play();
        } catch (error) {
        console.error(error);
        message.channel.send("Ocurrió un error al buscar o reproducir la canción.");
        }
    }
    else if (command === "mon!pause") {
        if (!player || !player.playing) return message.channel.send("No hay nada reproduciéndose.");
        player.pause(true);
        message.channel.send("⏸️ Música pausada.");
    }
    else if (command === "mon!resume") {
        if (!player || !player.paused) return message.channel.send("La música no está pausada.");
        player.pause(false);
        message.channel.send("▶️ Música reanudada.");
    }
    else if (command === "mon!skip") {
        if (!player || !player.playing) return message.channel.send("No hay nada reproduciéndose.");
        player.stop();
        message.channel.send("⏭️ Canción saltada.");
    }
    else if (command === "mon!stop") {
        if (!player) return message.channel.send("No hay nada reproduciéndose.");
        player.destroy();
        message.channel.send("⏹️ Música detenida y desconectado del canal de voz.");
    }
    }
}

module.exports = MusicHandler;
