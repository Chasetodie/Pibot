module.exports = {
    canModifyQueue(member) {
        const { channel } = member.voice;
        const botChannel = member.guild.members.me.voice.channel;

        if (channel !== botChannel) {
            return false;
        }
        return true;
    }
};