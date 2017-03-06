require('./js/globals.js');

var app = require('electron').app;
var path = require('path');
var fs = require('fs');
var request = require('request');
var dialog = require('electron').dialog;
var BrowserWindow = require('electron').BrowserWindow;
var Tray = require('electron').Tray;
var Menu = require('electron').Menu;
var constants = require('./js/constants.js');
var events = require('./js/events.js');
var profile = require('./js/profile.js');
var service = require('./js/service.js');
var errors = require('./js/errors.js');
var logger = require('./js/logger.js');

var main = null;
var tray = null;

if (app.dock) {
  app.dock.hide();
}

var authPath;
if (process.platform === 'win32') {
  authPath = path.join('C:\\', 'ProgramData', 'vpnetscape', 'auth');
} else {
  authPath = path.join(path.sep, 'var', 'lib', 'vpnetscape', 'auth');
}

global.key = fs.readFileSync(authPath, 'utf8');
constants.key = global.key;

var connTray;
var disconnTray;
if (process.platform === 'darwin') {
  connTray = path.join(__dirname, 'img',
    'tray_connected_osxTemplate.png');
  disconnTray = path.join(__dirname, 'img',
    'tray_disconnected_osxTemplate.png');
} else if (process.platform === 'win32') {
  connTray = path.join(__dirname, 'img',
    'tray_connected_win.png');
  disconnTray = path.join(__dirname, 'img',
    'tray_disconnected_win.png');
} else if (process.platform === 'linux') {
  connTray = path.join(__dirname, 'img',
    'tray_connected_linux_light.png');
  disconnTray = path.join(__dirname, 'img',
    'tray_disconnected_linux_light.png');
} else {
  connTray = path.join(__dirname, 'img',
    'tray_connected.png');
  disconnTray = path.join(__dirname, 'img',
    'tray_disconnected.png');
}
var icon = path.join(__dirname, 'img', 'logo.png');

var checkService = function(callback) {
  service.ping(function(status) {
    if (!status) {
      var timeout;

      if (callback) {
        timeout = 1000;
      } else {
        timeout = 6000;
      }

      setTimeout(function() {
        service.ping(function(status) {
          if (!status) {
            tray.setImage(disconnTray);
            dialog.showMessageBox(null, {
              type: 'warning',
              buttons: ['Выход', 'Retry'],
              defaultId: 1,
              title: 'VPNetscape',
              message: 'Мы выполняем обновления, ' +
                'попробуй запустить VPN-соединение немного позже...'
            }, function(state) {
              if (state === 0) {
                app.quit();
              }
            });
          }

          if (callback) {
            callback(status);
          }
        });
      }, timeout);
    } else {
      if (callback) {
        callback(true);
      }
    }
  });
};

app.on('open-file', function() {
  openMainWin();
});

app.on('open-url', function() {
  openMainWin();
});

app.on('activate', function() {
  openMainWin();
});


var openMainWin = function() {
  if (main) {
    main.focus();
    return;
  }

app.on('window-all-closed', function() {
  if (app.dock) {
    app.dock.hide();
  }
  checkService();
});
 checkService(function(status) {
     if (!status) {
      return;
    }

    var width;
    var height;
    var maxWidth;
    var maxHeight;
    if (process.platform === 'darwin') {
      width = 800;
      height = 600;
      maxWidth = 800;
      maxHeight = 600;
    } else {
      width = 800;
      height = 600;
      maxWidth = 800;
      maxHeight = 600;
    }

    main = new BrowserWindow({
      title: 'VPNetscape',
      icon: icon,
      frame: false,
      fullscreen: false,
      width: width,
      height: height,
      show: false,
      minWidth: 800,
      minHeight: 600,
      maxWidth: maxWidth,
      maxHeight: maxHeight,
      backgroundColor: '#3f454c'
    });
    main.maximizedPrev = null;

    main.on('closed', function() {
      main = null;
    });

    var shown = false;
    main.on('ready-to-show', function() {
      if (shown) {
        return;
      }
      shown = true;
      main.show();
    });
    setTimeout(function() {
      if (shown) {
        return;
      }
      shown = true;
      main.show();
    }, 600);

    main.loadURL('file://' + path.join(__dirname, 'index.html'));

    if (app.dock) {
      app.dock.show();
    }
  });
};

var sync =  function() {
  request.get({
    url: 'http://' + constants.serviceHost + '/status',
    headers: {
      'Auth-Key': constants.key
    }
  }, function(err, resp, body) {
    if (!body || !tray) {
      return;
    }

    try {
      var data = JSON.parse(body);
    } catch (e) {
      err = new errors.ParseError(
        'main: Failed to parse service status (%s)', e);
      logger.error(err);
      tray.setImage(disconnTray);
      return;
    }

    if (data.status) {
      tray.setImage(connTray);
    } else {
      tray.setImage(disconnTray);
    }
  });
};

app.on('ready', function() {
  service.wakeup(function(status) {
    if (status) {
      app.quit();
      return;
    }

    var profilesPth = path.join(app.getPath('userData'), 'profiles');
    fs.exists(profilesPth, function(exists) {
      if (!exists) {
        fs.mkdir(profilesPth);
      }
    });

    events.subscribe(function(evt) {
      if (evt.type === 'output') {
        var pth = path.join(app.getPath('userData'), 'profiles',
          evt.data.id + '.log');

        fs.appendFile(pth, evt.data.output + '\n', function(err) {
          if (err) {
            err = new errors.ParseError(
              'main: Failed to append profile output (%s)', err);
            logger.error(err);
          }
        });
      } else if (evt.type === 'connected') {
        if (tray) {
          tray.setImage(connTray);
        }
      } else if (evt.type === 'disconnected') {
        if (tray) {
          tray.setImage(disconnTray);
        }
      } else if (evt.type === 'wakeup') {
        openMainWin();
      }
    });

    var noMain = false;
    process.argv.forEach(function(val) {
      if (val === "--no-main") {
        noMain = true;
      }
    });

    if (!noMain) {
      openMainWin();
    }

    tray = new Tray(disconnTray);
    tray.on('click', function() {
      openMainWin();
    });
    tray.on('double-click', function() {
      openMainWin();
    });

    var appMenu = Menu.buildFromTemplate([
      {
        label: 'VPNetscape',
        submenu: [
          {
            label: 'VPNetscape v' + constants.version
          },
          {
            label: 'Close',
            accelerator: 'CmdOrCtrl+Q',
            role: 'close'
          },
          {
            label: 'Exit',
            click: function() {
              request.post({
                url: 'http://' + constants.serviceHost + '/stop',
                headers: {
                  'Auth-Key': constants.key
                }
              }, function() {
                app.quit();
              });
            }
          }
        ]
      },
      {
        label: 'Edit',
        submenu: [
          {
            label: 'Undo',
            accelerator: 'CmdOrCtrl+Z',
            role: 'undo'
          },
          {
            label: 'Redo',
            accelerator: 'Shift+CmdOrCtrl+Z',
            role: 'redo'
          },
          {
            type: 'separator'
          },
          {
            label: 'Cut',
            accelerator: 'CmdOrCtrl+X',
            role: 'cut'
          },
          {
            label: 'Copy',
            accelerator: 'CmdOrCtrl+C',
            role: 'copy'
          },
          {
            label: 'Paste',
            accelerator: 'CmdOrCtrl+V',
            role: 'paste'
          },
          {
            label: 'Select All',
            accelerator: 'CmdOrCtrl+A',
            role: 'selectall'
          }
        ]
      }
    ]);
    Menu.setApplicationMenu(appMenu);

    profile.getProfiles(function(err, prfls) {
      if (err) {
        return;
      }

      var prfl;
      for (var i = 0; i < prfls.length; i++) {
        prfl = prfls[i];

        if (prfl.autostart) {
          prfl.connect(false);
        }
      }
    }, true);

    sync();
    setInterval(function() {
      sync();
    }, 10000);
  });
});
 