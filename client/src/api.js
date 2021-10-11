import axios from 'axios';
axios.defaults.withCredentials = true;

const BASE_URL = '';

export const MESSAGES_TO_LOAD = 15;

const url = x => `${BASE_URL}${x}`;

export const getMe = () => {
  return axios.get(url('/me'))
    .then(x => x.data)
    .catch(_ => null);
};

export const login = (username, password) => {
  return axios.post(url('/login'), {
    username,
    password
  }).then(x =>
    x.data
  )
    .catch(e => { throw new Error(e.response && e.response.data && e.response.data.message); });
};

export const logOut = () => {
  return axios.post(url('/logout'));
};

/** 
 *
 * 
 * @returns {Promise<{
 *   heroku?: string;
 *   google_cloud?: string;
 *   vercel?: string;
 *   github?: string;
 * }>} 
 */


export const getRandomName = () => {
  return axios.get(url('/randomname')).then(x => x.data);
};

/**
 * 
 * 
 * @param {string} id room id
 * @param {number} offset 
 * @param {number} size 
 */
export const getMessages = (id,
  offset = 0,
  size = MESSAGES_TO_LOAD
) => {
  return axios.get(url(`/room/${id}/messages`), {
    params: {
      offset,
      size
    }
  })
    .then(x => x.data.reverse());
};

/**
 * @returns {Promise<{ name: string, id: string, messages: Array<import('./state').Message> }>}
 */
export const getPreloadedRoom = async () => {
  return axios.get(url(`/room/0/preload`)).then(x => x.data);
};

/** 
 * 
 * @param {Array<number | string>} ids
 */
export const getUsers = (ids) => {
  return axios.get(url(`/users`), { params: { ids } }).then(x => x.data);
};


export const getOnlineUsers = () => {
  return axios.get(url(`/users/online`)).then(x => x.data);
};


export const addRoom = async (user1, user2) => {
  return axios.post(url(`/room`), { user1, user2 }).then(x => x.data);
};

/** 
 * @returns {Promise<Array<{ names: string[]; id: string }>>} 
 */
export const getRooms = async (userId) => {
  return axios.get(url(`/rooms/${userId}`)).then(x => x.data);
};
