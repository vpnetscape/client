
package autoclean

import (
	"github.com/Sirupsen/logrus"
	"github.com/dropbox/godropbox/errors"
	"github.com/vpnetscape/client/service/utils"
	"os"
	"path/filepath"
	"runtime"
	"time"
)

const (
	pathSep = string(os.PathSeparator)
)

func clean() (err error) {
	paths := []string{
		filepath.Join(pathSep, "usr", "local", "bin", "vpnetscape-openvpn"),
		filepath.Join(pathSep, "private", "var", "db", "receipts",
			"com.vpnetscape.pkg.vpnetscape.bom"),
		filepath.Join(pathSep, "private", "var", "db", "receipts",
			"com.vpnetscape.pkg.vpnetscape.plist"),
		filepath.Join(pathSep, "var", "lib", "vpnetscape"),
		filepath.Join(pathSep, "var", "log", "vpnetscape.log"),
		filepath.Join(pathSep, "Applications", "vpnetscape.app"),
		filepath.Join(pathSep, "Library", "LaunchAgents",
			"com.vpnetscape.client.plist"),
	}

	paths = append(paths, filepath.Join(pathSep, "usr", "local",
		"bin", "vpnetscape-service"))
	paths = append(paths, filepath.Join(pathSep, "Library", "LaunchDaemons",
		"com.vpnetscape.service.plist"))

	for _, path := range paths {
		if len(path) < 20 {
			panic("autoclean: Bad path " + path)
		}

		err = os.RemoveAll(path)
		if err != nil {
			err = &RemoveError{
				errors.Wrap(err, "autoclean: Failed to remove file"),
			}
		}
	}

	return
}

// Check for vpnetscape.app and uninstall if missing
func CheckAndClean() (err error) {
	root := utils.GetRootDir()
	if runtime.GOOS != "darwin" || root != "/usr/local/bin" {
		return
	}

	path := filepath.Join(pathSep, "Applications", "vpnetscape.app")
	if _, e := os.Stat(path); !os.IsNotExist(e) {
		return
	}

	err = clean()
	if err != nil {
		return
	}

	os.Exit(0)

	return
}

// Watch for vpnetscape.app removal for next 10 minutes and uninstall if missing
func CheckAndCleanWatch() {
	root := utils.GetRootDir()
	if runtime.GOOS != "darwin" || root != "/usr/local/bin" {
		return
	}

	go func() {
		for i := 0; i < 30; i++ {
			time.Sleep(10 * time.Second)

			err := CheckAndClean()
			if err != nil {
				logrus.WithFields(logrus.Fields{
					"error": err,
				}).Error("autoclean: Failed to run check and clean")
				return
			}
		}
	}()
}
