var crypto = require('crypto');
var path = require('path');
var util = require('util');
var os = require('os');
var errors = require('./errors.js');
var utils = require('./utils.js');
var service = require('./service.js');
var logger = require('./logger.js');
var fs = require('fs');
var childProcess = require('child_process');

var colors = {
  'A': '#ff8a80',
  'B': '#ff5252',
  'C': '#ff1744',
  'D': '#d50000',
  'E': '#ff80ab',
  'F': '#ff4081',
  'G': '#f50057',
  'H': '#c51162',
  'I': '#ea80fc',
  'J': '#e040fb',
  'K': '#d500f9',
  'L': '#aa00ff',
  'M': '#b388ff',
  'N': '#7c4dff',
  'O': '#651fff',
  'P': '#6200ea',
  'Q': '#8c9eff',
  'R': '#536dfe',
  'S': '#3d5afe',
  'T': '#304ffe',
  'U': '#82b1ff',
  'V': '#448aff',
  'W': '#2979ff',
  'X': '#2962ff',
  'Y': '#80d8ff',
  'Z': '#40c4ff',
  'a': '#00b0ff',
  'b': '#0091ea',
  'c': '#84ffff',
  'd': '#18ffff',
  'e': '#00e5ff',
  'f': '#00b8d4',
  'g': '#a7ffeb',
  'h': '#64ffda',
  'i': '#1de9b6',
  'j': '#00bfa5',
  'k': '#b9f6ca',
  'l': '#69f0ae',
  'm': '#00e676',
  'n': '#00c853',
  'o': '#ccff90',
  'p': '#b2ff59',
  'q': '#76ff03',
  'r': '#64dd17',
  's': '#ffff8d',
  't': '#ffff00',
  'u': '#ffea00',
  'v': '#ffd600',
  'w': '#ffd180',
  'x': '#ffab40',
  'y': '#ff9100',
  'z': '#ff6d00',
  '0': '#ff9e80',
  '1': '#ff6e40',
  '2': '#ff3d00',
  '3': '#dd2c00',
  '4': '#d7ccc8',
  '5': '#bcaaa4',
  '6': '#8d6e63',
  '7': '#5d4037',
  '8': '#cfd8dc',
  '9': '#b0bec5',
  '+': '#78909c',
  '/': '#37474f'
};

function Profile(pth) {
  this.onUpdate = null;

  this.id = path.basename(pth);
  this.path = pth;
  this.confPath = pth + '.conf';
  this.ovpnPath = pth + '.ovpn';
  this.logPath = pth + '.log';
  this.data = null;
  this.name = null;
  this.uvName = null;
  this.organizationId = null;
  this.organization = null;
  this.serverId = null;
  this.server = null;
  this.userId = null;
  this.user = null;
  this.passwordMode = null;
  this.token = null;
  this.tokenTtl = null;
  this.authToken = null;
  this.authTokenTime = null;
  this.autostart = false;
  this.syncHosts = [];
  this.syncHash = null;
  this.syncSecret = null;
  this.syncToken = null;
  this.log = null;
}

Profile.prototype.load = function(callback, waitAll) {
  var waiter = new utils.WaitGroup();
  waiter.add(3);

  fs.readFile(this.confPath, function (err, data) {
    var confData;
    try {
      confData = JSON.parse(data);
    } catch (e) {
      err = new errors.ParseError('profile: Failed to parse config (%s)', e);
      logger.error(err);
      confData = {};
    }

    this.import(confData);

    if (waitAll) {
      waiter.done();
    } else if (callback) {
      callback();
    }
  }.bind(this));

  fs.readFile(this.ovpnPath, function(err, data) {
    if (!data) {
      this.data = null;
    } else {
      this.data = data.toString();
    }

    this.parseData();

    if (waitAll) {
      waiter.done();
    }
  }.bind(this));

  fs.readFile(this.logPath, function(err, data) {
    if (!data) {
      this.log = null;
    } else {
      this.log = data.toString();
    }

    if (waitAll) {
      waiter.done();
    }
  }.bind(this));

  waiter.wait(function() {
    if (callback) {
      callback();
    }
  })
};

Profile.prototype.parseData = function() {
  var line;
  var lines = this.data.split('\n');

  this.uvName = null;

  for (var i = 0; i < lines.length; i++) {
    line = lines[i];

    if (line.startsWith('setenv UV_NAME')) {
      line = line.split(' ');
      line.shift();
      line.shift();
      this.uvName = line.join(' ');
      return;
    }
  }
};

Profile.prototype.update = function(data) {
  this.status = data['status'];
  this.timestamp = data['timestamp'];
  this.serverAddr = data['server_addr'];
  this.clientAddr = data['client_addr'];

  if (this.onUpdate) {
    this.onUpdate();
  }
};

Profile.prototype.import = function(data) {
  this.status = 'disconnected';
  this.serverAddr = null;
  this.clientAddr = null;
  this.name = data.name || this.name;
  this.organizationId = data.organization_id || null;
  this.organization = data.organization || null;
  this.serverId = data.server_id || null;
  this.server = data.server || null;
  this.userId = data.user_id || null;
  this.user = data.user || null;
  this.passwordMode = data.password_mode || null;
  this.token = data.token || null;
  this.tokenTtl = data.token_ttl || null;
  this.authToken = data.auth_token || null;
  this.authTokenTime = data.auth_token_time || null;
  this.autostart = data.autostart || null;
  this.syncHosts = data.sync_hosts || [];
  this.syncHash = data.sync_hash || null;
  this.syncSecret = data.sync_secret || null;
  this.syncToken = data.sync_token || null;
};

Profile.prototype.upsert = function(data) {
  this.name = data.name || this.name;
  this.organizationId = data.organization_id || this.organizationId;
  this.organization = data.organization || this.organization;
  this.serverId = data.server_id || this.serverId;
  this.server = data.server || this.server;
  this.userId = data.user_id || this.userId;
  this.user = data.user || this.user;
  this.passwordMode = data.password_mode;
  this.token = data.token;
  this.tokenTtl = data.token_ttl;
  this.autostart = data.autostart || this.autostart;
  this.syncHosts = data.sync_hosts;
  this.syncHash = data.sync_hash;
};

Profile.prototype.exportConf = function() {
  return {
    name: this.name,
    organization_id: this.organizationId,
    organization: this.organization,
    server_id: this.serverId,
    server: this.server,
    user_id: this.userId,
    user: this.user,
    password_mode: this.passwordMode,
    token: this.token,
    token_ttl: this.tokenTtl,
    auth_token: this.authToken,
    auth_token_time: this.authTokenTime,
    autostart: this.autostart,
    sync_hosts: this.syncHosts,
    sync_hash: this.syncHash,
    sync_secret: this.syncSecret,
    sync_token: this.syncToken
  };
};

Profile.prototype.export = function() {
  var nameLogo = this.formatedNameLogo();

  var hash = crypto.createHash('md5');
  hash.update(nameLogo[0]);
  hash = hash.digest('base64');

  var status;
  if (this.status === 'connected') {
    status = this.getUptime();
  } else if (this.status === 'connecting') {
    status = 'Connecting';
  } else if (this.status === 'reconnecting') {
    status = 'Reconnecting';
  } else if (this.status === 'disconnecting') {
    status = 'Disconnecting';
  } else {
    status = 'Disconnected';
  }

  return {
    logo: nameLogo[1],
    logoColor: colors[hash.substr(0, 1)],
    status: status,
    serverAddr: this.serverAddr || '-',
    clientAddr: this.clientAddr || '-',
    name: nameLogo[0],
    organizationId: this.organizationId || '',
    organization: this.organization || '',
    serverId: this.serverId || '',
    server: this.server || '',
    userId: this.userId || '',
    user: this.user || '',
    autostart: this.autostart ? 'On' : 'Off',
    syncHosts: this.syncHosts || [],
    syncHash: this.syncHash || '',
    syncSecret: this.syncSecret || '',
    syncToken: this.syncToken || ''
  }
};

Profile.prototype.formatedNameLogo = function() {
  var logo;
  var name = this.name;

  if (!name) {
    if (this.user) {
      name = this.user;
      if (this.organization) {
        name += '@' + this.organization;
      }

      if (this.server) {
        name += ' (' + this.server + ')';
        logo = this.server.substr(0, 1);
      } else {
        logo = this.user.substr(0, 1);
      }
    } else if (this.server) {
      name = this.server;
      logo = this.server.substr(0, 1);
    } else if (this.uvName) {
      name = this.uvName;
      logo = this.uvName.substr(0, 1);
    } else {
      name = 'Unknown Profile';
      logo = 'U';
    }
  } else {
    logo = name.substr(0, 1);
  }

  return [name, logo];
};

Profile.prototype.pushOutput = function(output) {
  if (this.log) {
    this.log += '\n';
    this.log += output;
  } else {
    this.log = output;
  }

  if (this.onOutput) {
    this.onOutput(output);
  }
};

Profile.prototype.getUptime = function(curTime) {
  if (!this.timestamp || this.status !== 'connected') {
    return;
  }

  curTime = curTime || Math.floor((new Date).getTime() / 1000);

  var uptime = curTime - this.timestamp;
  var units;
  var unitStr;
  var uptimeItems = [];

  if (uptime > 86400) {
    units = Math.floor(uptime / 86400);
    uptime -= units * 86400;
    unitStr = units + ' day';
    if (units > 1) {
      unitStr += 's';
    }
    uptimeItems.push(unitStr);
  }

  if (uptime > 3600) {
    units = Math.floor(uptime / 3600);
    uptime -= units * 3600;
    unitStr = units + ' hour';
    if (units > 1) {
      unitStr += 's';
    }
    uptimeItems.push(unitStr);
  }

  if (uptime > 60) {
    units = Math.floor(uptime / 60);
    uptime -= units * 60;
    unitStr = units + ' min';
    if (units > 1) {
      unitStr += 's';
    }
    uptimeItems.push(unitStr);
  }

  if (uptime) {
    unitStr = uptime + ' sec';
    if (uptime > 1) {
      unitStr += 's';
    }
    uptimeItems.push(unitStr);
  }

  return uptimeItems.join(' ');
};

Profile.prototype.saveConf = function(callback) {
  fs.writeFile(this.confPath,
    JSON.stringify(this.exportConf()), function(err) {
      if (err) {
        err = new errors.WriteError(
          'config: Failed to save profile conf (%s)', err);
        logger.error(err);
      }
      if (this.onUpdate) {
        this.onUpdate();
      }
      if (callback) {
        callback(err);
      }
    }.bind(this));
};

Profile.prototype.saveData = function(callback) {
  if (os.platform() === 'darwin') {
    this.extractKey(this.data);
  }

  fs.writeFile(this.ovpnPath, this.data, function(err) {
    if (err) {
      err = new errors.WriteError(
        'config: Failed to save profile data (%s)', err);
      logger.error(err);
    }
    this.parseData();
    if (callback) {
      callback(err);
    }
  }.bind(this));
};

Profile.prototype.saveLog = function(callback) {
  fs.writeFile(this.logPath, this.log, function(err) {
    if (err) {
      err = new errors.WriteError(
        'config: Failed to save profile log (%s)', err);
      logger.error(err);
    }
    if (callback) {
      callback(err);
    }
  });
};

Profile.prototype.delete = function() {
  this.disconnect();

  if (os.platform() === 'darwin') {
    childProcess.exec('security delete-generic-password -s vpnetscape -a ' +
      this.id, function() {}.bind(this));
  }

  fs.exists(this.confPath, function(exists) {
    if (!exists) {
      return;
    }
    fs.unlink(this.confPath, function(err) {
      if (err) {
        err = new errors.RemoveError(
          'config: Failed to delete profile conf (%s)', err);
        logger.error(err);
      }
    });
  }.bind(this));
  fs.exists(this.ovpnPath, function(exists) {
    if (!exists) {
      return;
    }
    fs.unlink(this.ovpnPath, function(err) {
      if (err) {
        err = new errors.RemoveError(
          'config: Failed to delete profile data (%s)', err);
        logger.error(err);
      }
    });
  }.bind(this));
  fs.exists(this.logPath, function(exists) {
    if (!exists) {
      return;
    }
    fs.unlink(this.logPath, function(err) {
      if (err) {
        err = new errors.RemoveError(
          'config: Failed to delete profile log (%s)', err);
        logger.error(err);
      }
    });
  }.bind(this));
};

Profile.prototype.extractKey = function() {
  var sIndex;
  var eIndex;
  var keyData = '';

  sIndex = this.data.indexOf('<tls-auth>');
  eIndex = this.data.indexOf('</tls-auth>\n');
  if (sIndex > 0 &&  eIndex > 0) {
    keyData += this.data.substring(sIndex, eIndex + 12);
    this.data = this.data.substring(0, sIndex) + this.data.substring(
      eIndex + 12, this.data.length);
  }

  sIndex = this.data.indexOf('<key>');
  eIndex = this.data.indexOf('</key>\n');
  if (sIndex > 0 &&  eIndex > 0) {
    keyData += this.data.substring(sIndex, eIndex + 7);
    this.data = this.data.substring(0, sIndex) + this.data.substring(
      eIndex + 7, this.data.length);
  }

  if (!keyData) {
    return;
  }

  keyData = new Buffer(keyData).toString('base64');

  if (os.platform() === 'darwin') {
    // -U not working
    childProcess.exec('security delete-generic-password -s vpnetscape -a ' +
      this.id, function () {
      childProcess.exec('security add-generic-password -U -s vpnetscape -a ' +
        this.id + ' -w ' + keyData + ' login-keychain',
        function (err, stdout, stderr) {
          if (err) {
            err = new errors.ProcessError(
              'profile: Failed to add key to keychain (%s)', stderr);
            logger.error(err);
          }
        }.bind(this));
    }.bind(this));
  }
};

Profile.prototype.getFullData = function(callback) {
  if (os.platform() !== 'darwin') {
    callback(this.data);
    return;
  }

  childProcess.exec('security find-generic-password -w -s vpnetscape -a ' +
    this.id, function(err, stdout, stderr) {
      if (err) {
        err = new errors.ProcessError(
          'profile: Failed to get key from keychain (%s)', stderr);
        logger.error(err);
        return;
      }

      stdout = new Buffer(stdout.replace('\n', ''), 'base64').toString();
      callback(this.data + stdout);
    }.bind(this));
};

Profile.prototype.getAuthType = function() {
  if (this.passwordMode) {
    return this.passwordMode;
  }

  var n = this.data.indexOf('auth-user-pass');

  if (n !== -1) {
    var authStr = this.data.substring(n, this.data.indexOf('\n', n));
    authStr = authStr.split(' ');
    if (authStr.length > 1 && authStr[1]) {
      return null;
    }

    if (this.user) {
      return 'otp';
    } else {
      return 'username_password';
    }
  } else {
    return null;
  }
};

Profile.prototype.updateSync = function(data) {
  var sIndex;
  var eIndex;
  var tlsAuth = '';
  var cert = '';
  var key = '';
  var jsonData = '';
  var jsonFound = null;

  var dataLines = this.data.split('\n');
  var line;
  var uvId;
  var uvName;
  for (var i = 0; i < dataLines.length; i++) {
    line = dataLines[i];

    if (line.startsWith('setenv UV_ID ')) {
      uvId = line;
    } else if (line.startsWith('setenv UV_NAME ')) {
      uvName = line;
    }
  }

  dataLines = data.split('\n');
  data = '';
  for (i = 0; i < dataLines.length; i++) {
    line = dataLines[i];

    if (jsonFound === null && line === '#{') {
      jsonFound = true;
    }

    if (jsonFound === true && line.startsWith('#')) {
      if (line === '#}') {
        jsonFound = false;
      }
      jsonData += line.replace('#', '');
    } else {
      if (line.startsWith('setenv UV_ID ')) {
        line = uvId;
      } else if (line.startsWith('setenv UV_NAME ')) {
        line = uvName;
      }

      data += line + '\n';
    }
  }

  var confData;
  try {
    confData = JSON.parse(jsonData);
  } catch (e) {
  }

  if (confData) {
    this.upsert(confData);
    this.saveConf();
  }

  if (this.data.indexOf('key-direction') >= 0 && data.indexOf(
      'key-direction') < 0) {
    tlsAuth += 'key-direction 1\n'
  }

  sIndex = this.data.indexOf('<tls-auth>');
  eIndex = this.data.indexOf('</tls-auth>');
  if (sIndex >= 0 &&  eIndex >= 0) {
    tlsAuth += this.data.substring(sIndex, eIndex + 11) + '\n';
  }

  sIndex = this.data.indexOf('<cert>');
  eIndex = this.data.indexOf('</cert>');
  if (sIndex >= 0 && eIndex >= 0) {
    cert = this.data.substring(sIndex, eIndex + 7) + '\n';
  }

  sIndex = this.data.indexOf('<key>');
  eIndex = this.data.indexOf('</key>');
  if (sIndex >= 0 && eIndex >= 0) {
    key = this.data.substring(sIndex, eIndex + 6) + '\n';
  }

  this.data = data + tlsAuth + cert + key;
  this.saveData();
};

Profile.prototype.sync = function(syncHosts, callback) {
  var pth = util.format('/key/sync/%s/%s/%s/%s',
    this.organizationId,
    this.userId,
    this.serverId,
    this.syncHash
  );
  var host = syncHosts.shift();

  if (!host) {
    if (callback) {
      callback();
    }
    return;
  }

  utils.authRequest('get', host, pth, this.syncToken, this.syncSecret, null,
    function(err, resp, body) {
      try {
        var data = JSON.parse(body);
      } catch (_) {
        if (callback) {
          callback();
        }
        return;
      }

      if (!data.signature || !data.conf) {
        if (callback) {
          callback();
        }
        return;
      }

      var confSignature = crypto.createHmac('sha512', this.syncSecret).update(
        data.conf).digest('base64');

      if (confSignature !== data.signature) {
        if (callback) {
          callback();
        }
        return;
      }

      if (err) {
        if (!syncHosts.length) {
          if (resp) {
            logger.warning('profile: Failed to sync config (' +
              resp.statusCode + ')');
          } else {
            logger.warning('profile: Failed to sync config');
          }
        } else {
          this.sync(syncHosts, callback);
          return;
        }
      } else {
        if (resp.statusCode === 480) {
          logger.info('profile: Failed to sync conf, no subscription');
        } else if (resp.statusCode === 404) {
          logger.warning('profile: Failed to sync conf, user not found');
        } else if (resp.statusCode === 401) {
          logger.warning('profile: Failed to sync conf, ' +
            'authentication error');
        } else if (resp.statusCode === 200 && body) {
          this.updateSync(data.conf);
        } else if (resp.statusCode !== 200) {
          logger.warning('profile: Failed to sync conf, unknown error (' +
            resp.statusCode + ')');
          this.sync(syncHosts, callback);
          return;
        }
      }

      if (callback) {
        callback();
      }
    }.bind(this));
};

Profile.prototype.connect = function(timeout, authCallback) {
  if (this.syncHosts.length) {
    this.sync(this.syncHosts.slice(0), function() {
      this.auth(timeout, authCallback);
    }.bind(this));
  } else {
    this.auth(timeout, authCallback);
  }
};

Profile.prototype.auth = function(timeout, callback) {
  var authType = this.getAuthType();
  var authToken;

  if (this.token) {
    if (!this.authToken ||
        !this.authTokenTime ||
        Math.abs(this.authTokenTime - utils.time()) > (
          this.tokenTtl || 604800)) {
      this.authToken = utils.uuid();
      this.authTokenTime = utils.time();
      this.saveConf();
    }
    authToken = this.authToken;
  }

  if (!authType) {
    if (callback) {
      callback(null);
    }
    service.start(this, timeout, authToken);
  } else if (!callback) {
  } else {
    callback(authType, function(user, pass) {
      service.start(this, timeout, authToken, user || 'vpnetscape', pass);
    }.bind(this));
  }
};

Profile.prototype.disconnect = function() {
  service.stop(this);
};

var getProfiles = function(callback, waitAll) {
  var root = path.join(utils.getUserDataPath(), 'profiles');

  var _callback = function(err, prfls) {
    if (prfls) {
      var i;
      var j;
      var name;
      var indexes;
      var newPrfls = [];
      var prflsMap = {};

      for (i = 0; i < prfls.length; i++) {
        name = prfls[i].formatedNameLogo()[0] || 'ZZZZZZZZ';

        if (!prflsMap[name]) {
          prflsMap[name] = [i];
        } else {
          prflsMap[name].push(i);
        }
      }

      var prflsName = Object.keys(prflsMap);
      prflsName.sort();

      for (i = 0; i < prflsName.length; i++) {
        indexes = prflsMap[prflsName[i]];
        for (j = 0; j < indexes.length; j++) {
          newPrfls.push(prfls[indexes[j]]);
        }
      }

      prfls = newPrfls;
    }

    callback(err, prfls);
  };

  fs.exists(root, function(exists) {
    if (!exists) {
      _callback(null, []);
      return;
    }

    fs.readdir(root, function(err, paths) {
      if (err) {
        _callback(err, null);
        return
      }
      paths = paths || [];

      var i;
      var loaded = 0;
      var pth;
      var pathSplit;
      var profilePaths = [];
      var profiles = [];

      for (i = 0; i < paths.length; i++) {
        pth = paths[i];
        pathSplit = pth.split('.');

        if (pathSplit[pathSplit.length - 1] !== 'conf') {
          continue;
        }

        profilePaths.push(root + '/' + pth.substr(0, pth.length - 5));
      }

      if (!profilePaths.length) {
        _callback(null, []);
      }

      for (i = 0; i < profilePaths.length; i++) {
        pth = profilePaths[i];

        var prfl = new Profile(pth);
        profiles.push(prfl);

        prfl.load(function() {
          loaded += 1;

          if (loaded >= profilePaths.length) {
            _callback(null, profiles);
          }
        }, waitAll);
      }
    });
  });
};

module.exports = {
  Profile: Profile,
  getProfiles: getProfiles
};
