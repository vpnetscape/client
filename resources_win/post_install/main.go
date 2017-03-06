package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"sync"
)

func main() {
	wait := &sync.WaitGroup{}

	rootDir, err := filepath.Abs(filepath.Dir(os.Args[0]))
	if err != nil {
		panic(err)
	}

	cmd := exec.Command(filepath.Join(rootDir, "nssm.exe"),
		"stop", "vpnetscape")
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Run()

	wait.Add(1)
	go func() {
		defer wait.Done()

		cmd := exec.Command(filepath.Join(rootDir, "tuntap", "tuntap.exe"),
			"uninstall")
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		cmd.Run()
		cmd = exec.Command(filepath.Join(rootDir, "tuntap", "tuntap.exe"),
			"install")
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		cmd.Run()
		cmd = exec.Command(filepath.Join(rootDir, "tuntap", "tuntap.exe"),
			"install")
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		cmd.Run()
		cmd = exec.Command(filepath.Join(rootDir, "tuntap", "tuntap.exe"),
			"install")
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		cmd.Run()
		cmd = exec.Command(filepath.Join(rootDir, "tuntap", "tuntap.exe"),
			"install")
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		cmd.Run()
		cmd = exec.Command(filepath.Join(rootDir, "tuntap", "tuntap.exe"),
			"install")
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		cmd.Run()
		cmd = exec.Command(filepath.Join(rootDir, "tuntap", "tuntap.exe"),
			"install")
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		cmd.Run()
		cmd = exec.Command(filepath.Join(rootDir, "tuntap", "tuntap.exe"),
			"install")
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		cmd.Run()
	}()

	cmd = exec.Command(filepath.Join(rootDir, "nssm.exe"),
		"remove", "vpnetscape", "confirm")
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Run()
	cmd = exec.Command(filepath.Join(rootDir, "nssm.exe"), "install",
		"vpnetscape", filepath.Join(rootDir, "vpnetscape.exe"))
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Run()
	cmd = exec.Command(filepath.Join(rootDir, "nssm.exe"),
		"set", "vpnetscape", "DisplayName", "Vpnetscape Helper Service")
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Run()
	cmd = exec.Command(filepath.Join(rootDir, "nssm.exe"),
		"set", "vpnetscape", "Start", "SERVICE_AUTO_START")
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Run()
	cmd = exec.Command(filepath.Join(rootDir, "nssm.exe"),
		"set", "vpnetscape", "AppStdout",
		"C:\\ProgramData\\vpnetscape\\service.log")
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Run()
	cmd = exec.Command(filepath.Join(rootDir, "nssm.exe"),
		"set", "vpnetscape", "AppStderr",
		"C:\\ProgramData\\vpnetscape\\service.log")
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Run()
	cmd = exec.Command(filepath.Join(rootDir, "nssm.exe"),
		"set", "vpnetscape", "Start", "SERVICE_AUTO_START")
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Run()
	cmd = exec.Command(filepath.Join(rootDir, "nssm.exe"),
		"start", "vpnetscape")
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Run()

	wait.Wait()
}
