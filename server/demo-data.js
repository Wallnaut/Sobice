const moment = require('moment');
const { zadd } = require('./redis');
const { createUser, createPrivateRoom, getPrivateRoomId } = require('./utils');

const demoPassword = 'password123';

const demoUsers = ["Pavle","Momcilo","Mihajlo"];

const greetings = ["Najtopliji pozdravi"];

const messages = [];

const getGreeting = () => greetings[Math.floor(Math.random() * greetings.length)];

const addMessage = async (roomId, fromId, content, timestamp = moment().unix()) => {
  const roomKey = `room:${roomId}`;

  const message = {
    from: fromId,
    date: timestamp,
    message: content,
    roomId,
  };
  
  await zadd(roomKey, "" + message.date, JSON.stringify(message));
};

const createDemoData = async () => {
  /** za svako Demo ime se kreira korisnik */
  const users = [];
  for (let x = 0; x < demoUsers.length; x++) {
    const user = await createUser(demoUsers[x], demoPassword);
    
    users.push(user);
  }

  const rooms = {};
  /** Kada se demo korisnici naprave, salju se poruke ostalima */
  for (let userIndex = 0; userIndex < users.length; userIndex++) {
    const user = users[userIndex];
    const otherUsers = users.filter(x => x.id !== user.id);

    for (let otherUserIndex = 0; otherUserIndex < otherUsers.length; otherUserIndex++) {
      const otherUser = otherUsers[otherUserIndex];
      let privateRoomId = getPrivateRoomId(user.id, otherUser.id);
      let room = rooms[privateRoomId];
      if (room === undefined) {
        const res = await createPrivateRoom(user.id, otherUser.id);
        room = res[0];
        rooms[privateRoomId] = room;
      }

      await addMessage(privateRoomId, otherUser.id, getGreeting(), moment().unix() - Math.random() * 222);
    }
  }
  const randomUserId = () => users[Math.floor(users.length * Math.random())].id;
  for (let messageIndex = 0; messageIndex < messages.length; messageIndex++) {
    await addMessage('0', randomUserId(), messages[messageIndex], moment().unix() - ((messages.length - messageIndex) * 200));
  }
};

module.exports = {
  createDemoData
};