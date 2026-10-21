require('dotenv').config();
const { ipcMain } = require('electron');
const fetch = require('node-fetch');

// Hanuman: never phone home by default. Notifications are only fetched when the
// user explicitly points the app at an endpoint they control.
const getNotificationsEndpoint = () => process.env.HANUMAN_INFO_ENDPOINT || process.env.BRUNO_INFO_ENDPOINT;

const fetchNotifications = async () => {
  const url = getNotificationsEndpoint();
  if (!url) {
    return [];
  }
  const data = await fetch(url).then((res) => res.json());
  return data?.notifications || [];
};

const pushNotifications = async (mainWindow) => {
  try {
    const notifications = await fetchNotifications();
    mainWindow.webContents.send('main:load-notifications', notifications);
  } catch (error) {
    console.error('Error while fetching notifications!', error);
  }
};

const registerNotificationsIpc = (mainWindow, watcher) => {
  mainWindow.webContents.on('did-finish-load', () => pushNotifications(mainWindow));
  ipcMain.on('renderer:notifications-opened', () => pushNotifications(mainWindow));
};

module.exports = registerNotificationsIpc;
