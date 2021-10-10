// @ts-check
const express = require("express");
const bcrypt = require("bcrypt");
const session = require("express-session");
const bodyParser = require("body-parser");
/** @ts-ignore */
const randomName = require("node-random-name");
let RedisStore = require("connect-redis")(session);
const path = require("path");
const fs = require("fs").promises;

const {
  client: redisClient,
  exists,
  set,
  get,
  hgetall,
  sadd,
  zadd,
  hmget,
  smembers,
  sismember,
  srem,
  sub,
  auth: runRedisAuth,
} = require("./redis");
const {
  createUser,
  makeUsernameKey,
  createPrivateRoom,
  sanitise,
  getMessages,
} = require("./utils");
const { createDemoData } = require("./demo-data");
const { PORT, SERVER_ID } = require("./config");

const app = express();
const server = require("http").createServer(app);

/** @type {SocketIO.Server} */
const io =
  /** @ts-ignore */
  require("socket.io")(server);

const sessionMiddleware = session({
  store: new RedisStore({ client: redisClient }),
  secret: "keyboard cat",
  saveUninitialized: true,
  resave: true,
});

const auth = (req, res, next) => {
  if (!req.session.user) {
    return res.sendStatus(403);
  }
  next();
};

const publish = (type, data) => {
  const outgoing = {
    serverId: SERVER_ID,
    type,
    data,
  };
  redisClient.publish("MESSAGES", JSON.stringify(outgoing));
};

const initPubSub = () => {
  /** Ne koristimo kanale zato sto poruka sadrzi sve potrebne podatke */
  sub.on("message", (_, message) => {
    /**
     * @type {{
     *   serverId: string;
     *   type: string;
     *   data: object;
     * }}
     **/
    const { serverId, type, data } = JSON.parse(message);
    /** Ne hendlujemo pub/sub ako su serveri isti */
    if (serverId === SERVER_ID) {
      return;
    }
    io.emit(type, data);
  });
  sub.subscribe("MESSAGES");
};

/** Pokrecemo aplikaciju */
(async () => {
  await runRedisAuth();
  /** Treba nam brojac za sve korisnike*/
  const totalUsersKeyExist = await exists("total_users");
  if (!totalUsersKeyExist) {
    /** brojac za id */
    await set("total_users", 0);
    
    await set(`room:${0}:name`, "General");

    /** koristimo default usere da napravimo demo podatke za prikaz*/
    await createDemoData();
  }

  runApp();
})();

async function runApp() {

  app.use(bodyParser.json());
  app.use("/", express.static(path.dirname(__dirname) + "/client/build"));

  initPubSub();

  /** Session cuvamo u redisu */
  app.use(sessionMiddleware);
  io.use((socket, next) => {
    /** @ts-ignore */
    sessionMiddleware(socket.request, socket.request.res || {}, next);
  });

  io.on("connection", async (socket) => {
    if (socket.request.session.user === undefined) {
      return;
    }
    const userId = socket.request.session.user.id;
    await sadd("online_users", userId);

    const msg = {
      ...socket.request.session.user,
      online: true,
    };

    publish("user.connected", msg);
    socket.broadcast.emit("user.connected", msg);

    socket.on("room.join", (id) => {
      socket.join(`room:${id}`);
    });

    socket.on(
      "message",
      /**
       * @param {{
       *  from: string
       *  date: number
       *  message: string
       *  roomId: string
       * }} message
       **/
      async (message) => {
        
        message = { ...message, message: sanitise(message.message) };
        await sadd("online_users", message.from);
        const messageString = JSON.stringify(message);
        const roomKey = `room:${message.roomId}`;
        
        const isPrivate = !(await exists(`${roomKey}:name`));
        const roomHasMessages = await exists(roomKey);
        if (isPrivate && !roomHasMessages) {
          const ids = message.roomId.split(":");
          const msg = {
            id: message.roomId,
            names: [
              await hmget(`user:${ids[0]}`, "username"),
              await hmget(`user:${ids[1]}`, "username"),
            ],
          };
          publish("show.room", msg);
          socket.broadcast.emit(`show.room`, msg);
        }
        await zadd(roomKey, "" + message.date, messageString);
        publish("message", message);
        io.to(roomKey).emit("message", message);
      }
    );
    socket.on("disconnect", async () => {
      const userId = socket.request.session.user.id;
      await srem("online_users", userId);
      const msg = {
        ...socket.request.session.user,
        online: false,
      };
      publish("user.disconnected", msg);
      socket.broadcast.emit("user.disconnected", msg);
    });
  });

  
  app.get("/randomname", (_, res) => {
    return res.send(randomName({ first: true }));
  });

  
  app.get("/me", (req, res) => {
    /** @ts-ignore */
    const { user } = req.session;
    if (user) {
      return res.json(user);
    }
    
    return res.json(null);
  });

  
  app.post("/login", async (req, res) => {
    const { username, password } = req.body;
    const usernameKey = makeUsernameKey(username);
    const userExists = await exists(usernameKey);
    if (!userExists) {
      const newUser = await createUser(username, password);
      /** @ts-ignore */
      req.session.user = newUser;
      return res.status(201).json(newUser);
    } else {
      const userKey = await get(usernameKey);
      const data = await hgetall(userKey);
      if (await bcrypt.compare(password, data.password)) {
        const user = { id: userKey.split(":").pop(), username };
        /** @ts-ignore */
        req.session.user = user;
        return res.status(200).json(user);
      }
    }
    // user not found
    return res.status(404).json({ message: "Invalid username or password" });
  });

  app.post("/logout", auth, (req, res) => {
    req.session.destroy(() => {});
    return res.sendStatus(200);
  });


  app.post("/room", auth, async (req, res) => {
    const { user1, user2 } = {
      user1: parseInt(req.body.user1),
      user2: parseInt(req.body.user2),
    };

    const [result, hasError] = await createPrivateRoom(user1, user2);
    if (hasError) {
      return res.sendStatus(400);
    }
    return res.status(201).send(result);
  });

  /** pribavljamo poruke iz General chat-a*/
  app.get("/room/0/preload", async (req, res) => {
    const roomId = "0";
    try {
      let name = await get(`room:${roomId}:name`);
      const messages = await getMessages(roomId, 0, 20);
      return res.status(200).send({ id: roomId, name, messages });
    } catch (err) {
      return res.status(400).send(err);
    }
  });

  /** Pribavljamo iz sobe */
  app.get("/room/:id/messages", auth, async (req, res) => {
    const roomId = req.params.id;
    const offset = +req.query.offset;
    const size = +req.query.size;
    try {
      const messages = await getMessages(roomId, offset, size);
      return res.status(200).send(messages);
    } catch (err) {
      return res.status(400).send(err);
    }
  });

  
  app.get(`/users/online`, auth, async (req, res) => {
    const onlineIds = await smembers(`online_users`);
    const users = {};
    for (let onlineId of onlineIds) {
      const user = await hgetall(`user:${onlineId}`);
      users[onlineId] = {
        id: onlineId,
        username: user.username,
        online: true,
      };
    }
    return res.send(users);
  });

  /*vracamo usera po prosledjenom Id */
  app.get(`/users`, async (req, res) => {
    /** @ts-ignore */
    /** @type {string[]} */ const ids = req.query.ids;
    if (typeof ids === "object" && Array.isArray(ids)) {
      
      const users = {};
      for (let x = 0; x < ids.length; x++) {
        /** @type {string} */
        const id = ids[x];
        const user = await hgetall(`user:${id}`);
        users[id] = {
          id: id,
          username: user.username,
          online: !!(await sismember("online_users", id)),
        };
      }
      return res.send(users);
    }
    return res.sendStatus(404);
  });

  /**pribavljamo sobu za korisnika
   */
  app.get(`/rooms/:userId`, auth, async (req, res) => {
    const userId = req.params.userId;
    const roomIds = await smembers(`user:${userId}:rooms`);
    const rooms = [];
    for (let x = 0; x < roomIds.length; x++) {
      const roomId = roomIds[x];

      let name = await get(`room:${roomId}:name`);
      
      if (!name) {
        const roomExists = await exists(`room:${roomId}`);
        if (!roomExists) {
          continue;
        }

        const userIds = roomId.split(":");
        if (userIds.length !== 2) {
          return res.sendStatus(400);
        }
        rooms.push({
          id: roomId,
          names: [
            await hmget(`user:${userIds[0]}`, "username"),
            await hmget(`user:${userIds[1]}`, "username"),
          ],
        });
      } else {
        rooms.push({ id: roomId, names: [name] });
      }
    }
    res.status(200).send(rooms);
  });

  if (process.env.PORT) {
    server.listen(+PORT, "0.0.0.0", () =>
      console.log(`Listening on ${PORT}...`)
    );
  } else {
    server.listen(+PORT, () => console.log(`Listening on ${PORT}...`));
  }
}