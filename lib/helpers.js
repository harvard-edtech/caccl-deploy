const fs = require('fs');
const net = require('net');
const path = require('path');
const semver = require('semver');

const LOOKS_LIKE_SEMVER_REGEX = new RegExp(
  [
    '(?<Major>0|(?:[1-9]\\d*))',
    '(?:\\.(?<Minor>0|(?:[1-9]\\d*))',
    '(?:\\.(?<Patch>0|(?:[1-9]\\d*))))',
  ].join(''),
);

module.exports = {
  readJson: (filePath) => {
    return JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
  },

  readFile: (filePath) => {
    return fs.readFileSync(require.resolve(filePath), 'utf8');
  },

  tagsForAws: (tags = {}) => {
    return Object.entries(tags).map(([k, v]) => {
      return { Key: k, Value: v };
    });
  },

  sleep: (ms) => {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  },

  /**
   * Resolves (with no value) once something is accepting connections on the
   * local port, retrying every intervalMs; rejects if the timeout is reached
   * first. Callers should treat completion as success and catch the rejection
   * as failure — there is no boolean result.
   */
  waitForLocalPortOpen: async (
    port,
    { timeoutSeconds = 60, intervalMs = 500 } = {},
  ) => {
    const deadline = Date.now() + timeoutSeconds * 1000;
    const tryOnce = () => {
      return new Promise((resolve) => {
        const socket = net.createConnection({ port, host: '127.0.0.1' });
        socket.on('connect', () => {
          socket.destroy();
          resolve(true);
        });
        socket.on('error', () => {
          socket.destroy();
          resolve(false);
        });
      });
    };
    while (Date.now() < deadline) {
      if (await tryOnce()) return;
      await new Promise((resolve) => {
        setTimeout(resolve, intervalMs);
      });
    }
    throw new Error(
      `nothing listening on local port ${port} after ${timeoutSeconds}s`,
    );
  },

  /**
   * Resolves true if the local port can be bound (i.e. nothing is using it)
   */
  localPortIsFree: (port) => {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.once('error', () => {
        resolve(false);
      });
      server.once('listening', () => {
        server.close(() => {
          resolve(true);
        });
      });
      server.listen(port, '127.0.0.1');
    });
  },

  looksLikeSemver: (s) => {
    return LOOKS_LIKE_SEMVER_REGEX.test(s);
  },

  validSSMParamName: (name) => {
    return /^([a-z0-9:/_-]+)$/i.test(name);
  },

  warnAboutVersionDiff: (versionString1, versionString2) => {
    let v1;
    let v2;

    // if only one of the versions indicates a branch that's a diff
    if (
      [versionString1, versionString2].filter((v) => {
        return v.includes('branch=');
      }).length === 1
    ) {
      return true;
    }

    try {
      v1 = versionString1.match(/^package=(?<version>[^:]+)/).groups.version;
      v2 = versionString2.match(/^package=(?<version>[^:]+)/).groups.version;
    } catch (err) {
      if (err instanceof TypeError) {
        // seems like we've got bigger problems if those regexes throw an exception
        return true;
      }
      throw err;
    }
    if (v1 === v2) return false;
    // warn if either is invalid
    if (!semver.valid(v1) || !semver.valid(v2)) {
      return true;
    }
    // warn if diff is greater than a patch version
    return !semver.satisfies(v1, `${v2.slice(0, -1)}x`);
  },
};
