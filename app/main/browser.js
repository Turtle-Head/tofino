/*
Copyright 2016 Mozilla

Licensed under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy of the
License at http://www.apache.org/licenses/LICENSE-2.0
Unless required by applicable law or agreed to in writing, software distributed
under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
CONDITIONS OF ANY KIND, either express or implied. See the License for the
specific language governing permissions and limitations under the License.
*/

/* eslint import/imports-first: "off" */

// Must go before any require statements.
const browserStartTime = Date.now();

import electron from 'electron';
import os from 'os';

import * as protocols from './protocols';
import * as hotkeys from './hotkeys';
import * as menu from './menu/index';
import * as instrument from '../services/instrument';
import * as spawn from './spawn';
import * as BW from './browser-window';
import UserAgentClient from '../shared/user-agent-client';
import { logger } from '../shared/logging';
import { version as appVersion, name as appName } from '../../package.json';

const app = electron.app; // control application life.
const ipc = electron.ipcMain;
const globalShortcut = electron.globalShortcut;
const autoUpdater = electron.autoUpdater;
const userAgentClient = new UserAgentClient();

const appStartupTime = Date.now();
instrument.event('app', 'STARTUP');

protocols.registerStandardSchemes();

// Start the content and UA services running on a different process
spawn.startContentService();
spawn.startUserAgentService(userAgentClient);

// Exe name is set to the same as the package name
app.setAppUserModelId(`com.squirrel.${appName}.${appName}`);
autoUpdater.setFeedURL(`http://tofino-update-server.herokuapp.com/update/${os.platform()}_${os.arch()}/${appVersion}`);

autoUpdater.on('update-downloaded', () => {
  logger.info('Downloaded an update!');
});

logger.info(`App version is ${appVersion}`);

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.on('ready', async function() {
  const appReadyTime = Date.now();
  instrument.event('app', 'READY', 'ms', appReadyTime - appStartupTime);

  // Force the menu to be built at least once on startup
  menu.buildAppMenu(menuData);

  // Register http content protocols, e.g. for displaying `tofino://` pages.
  protocols.registerHttpProtocols();

  await BW.createBrowserWindow(userAgentClient, () => {
    instrument.event('browser', 'READY', 'ms', Date.now() - browserStartTime);
  });

  try {
    autoUpdater.checkForUpdates();
  } catch (e) {
    // This happens if the app isn't installed
  }
});

// Unregister all shortcuts.
app.on('will-quit', () => globalShortcut.unregisterAll());

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
    return;
  }

  // Rebuild the menu to get the simplified version
  menu.buildAppMenu(menuData);
});

app.on('activate', async function() {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (electron.BrowserWindow.getAllWindows().length === 0) {
    await BW.createBrowserWindow(userAgentClient, () => menu.buildAppMenu(menuData));
  }
});

ipc.on('new-browser-window', async function() {
  await BW.createBrowserWindow(userAgentClient, () => menu.buildAppMenu(menuData));
});

ipc.on('close-browser-window', BW.onlyWhenFromBrowserWindow(async function(bw) {
  await BW.closeBrowserWindow(bw);
}));

ipc.on('window-ready', BW.onlyWhenFromBrowserWindow((bw, ...args) => {
  // Pass through to the BrowserWindow instance.  This just makes it easier to do things per-BW.
  bw.emit('window-ready', ...args);
}));

ipc.on('open-menu', BW.onlyWhenFromBrowserWindow(bw => {
  menu.buildWindowMenu(menuData).popup(bw);
}));

ipc.on('synthesize-accelerator', (...args) => {
  hotkeys.handleIPCAcceleratorCommand(...args);
  menu.handleIPCAcceleratorCommand(...args);
});

ipc.on('instrument-event', (event, args) => {
  // Until we transpile app/, we can't destructure in the argument list or inline here.
  instrument.event(args.name, args.method, args.label, args.value);
});

const menuData = {};

userAgentClient.on('diff', (command) => {
  if (command.type === 'initial') {
    menuData.recentBookmarks = command.payload.recentStars;
    menu.buildAppMenu(menuData);
    return;
  }

  if (command.type === '/stars/recent') {
    menuData.recentBookmarks = command.payload;
    menu.buildAppMenu(menuData);
  }
});
