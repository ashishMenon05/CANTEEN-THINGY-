import type { NextConfig } from "next";
import fs from "fs";

// Fix Windows exFAT filesystem quirk where readlink returns EISDIR instead of EINVAL on regular files
function patchReadlink() {
  const origSync = fs.readlinkSync;
  fs.readlinkSync = function (path: fs.PathLike, options?: any) {
    try {
      return origSync.call(fs, path, options);
    } catch (err: any) {
      if (err && err.code === "EISDIR") {
        err.code = "EINVAL";
      }
      throw err;
    }
  } as typeof fs.readlinkSync;

  const origAsync = fs.readlink;
  fs.readlink = function (path: fs.PathLike, ...args: any[]) {
    const callback = args[args.length - 1];
    if (typeof callback === "function") {
      args[args.length - 1] = (err: any, linkString: any) => {
        if (err && err.code === "EISDIR") {
          err.code = "EINVAL";
        }
        callback(err, linkString);
      };
    }
    return (origAsync as any).call(fs, path, ...args);
  } as typeof fs.readlink;

  if (fs.promises && fs.promises.readlink) {
    const origPromise = fs.promises.readlink;
    (fs.promises as any).readlink = async function (path: fs.PathLike, options?: any) {
      try {
        return await origPromise.call(fs.promises, path, options);
      } catch (err: any) {
        if (err && err.code === "EISDIR") {
          err.code = "EINVAL";
        }
        throw err;
      }
    };
  }
}

patchReadlink();

const nextConfig: NextConfig = {
  webpack: (config) => {
    config.resolve.symlinks = false;
    return config;
  },
};

export default nextConfig;
