// @ts-check
import React, { useEffect, useCallback } from "react";
import Login from "./components/Login";
import Chat from "./components/Chat";
import { getOnlineUsers, getRooms } from "./api";
import useAppStateContext, { AppContext } from "./state";
import moment from "moment";
import { parseRoomName } from "./utils";
import { LoadingScreen } from "./components/LoadingScreen";
import { useSocket, useUser } from "./hooks";

const App = () => {
  const {
    loading,
    user,
    state,
    dispatch,
    onLogIn,
    onMessageSend,
    onLogOut,
  } = useAppHandlers();

  if (loading) {
    return <LoadingScreen />;
  }

  const showLogin = !user;

  return (
    <AppContext.Provider value={[state, dispatch]}>
      <div
        className={`full-height ${showLogin ? "bg-light" : ""}`}
        style={{
          backgroundColor: !showLogin ? "#495057" : undefined,
        }}
      >
        {showLogin ? (
          <Login onLogIn={onLogIn} />
        ) : (
          <Chat user={user} onMessageSend={onMessageSend} onLogOut={onLogOut} />
        )}
      </div>
    </AppContext.Provider>
  );
};

const useAppHandlers = () => {
  const [state, dispatch] = useAppStateContext();
  const onUserLoaded = useCallback(
    (user) => {
      if (user !== null) {
        if (!state.users[user.id]) {
          dispatch({ type: "set user", payload: { ...user, online: true } });
        }
      }
    },
    [dispatch, state.users]
  );

  const { user, onLogIn, onLogOut, loading } = useUser(onUserLoaded, dispatch);
  const [socket, connected] = useSocket(user, dispatch);

  
  useEffect(() => {
    if (user === null) {
      return;
    }
    if (connected) {
      const newRooms = [];
      Object.keys(state.rooms).forEach((roomId) => {
        const room = state.rooms[roomId];
        if (room.connected) {
          return;
        }
        newRooms.push({ ...room, connected: true });
        socket.emit("room.join", room.id);
      });
      if (newRooms.length !== 0) {
        dispatch({ type: "set rooms", payload: newRooms });
      }
    } else {
      
      const newRooms = [];
      Object.keys(state.rooms).forEach((roomId) => {
        const room = state.rooms[roomId];
        if (!room.connected) {
          return;
        }
        newRooms.push({ ...room, connected: false });
      });
     
      if (newRooms.length !== 0) {
        dispatch({ type: "set rooms", payload: newRooms });
      }
    }
  }, [user, connected, dispatch, socket, state.rooms, state.users]);

  
  useEffect(() => {
    if (Object.values(state.rooms).length === 0 && user !== null) {
      getOnlineUsers().then((users) => {
        dispatch({
          type: "append users",
          payload: users,
        });
      });
      
      getRooms(user.id).then((rooms) => {
        const payload = [];
        rooms.forEach(({ id, names }) => {
          payload.push({ id, name: parseRoomName(names, user.username) });
        });
        
        dispatch({
          type: "set rooms",
          payload,
        });
        dispatch({ type: "set current room", payload: "0" });
      });
    }
  }, [dispatch, state.rooms, user]);

  const onMessageSend = useCallback(
    (message, roomId) => {
      if (typeof message !== "string" || message.trim().length === 0) {
        return;
      }
      if (!socket) {
        console.error("Couldn't send message");
      }
      socket.emit("message", {
        roomId: roomId,
        message,
        from: user.id,
        date: moment(new Date()).unix(),
      });
    },
    [user, socket]
  );

  return {
    loading,
    user,
    state,
    dispatch,
    onLogIn,
    onMessageSend,
    onLogOut,
  };
};

export default App;
