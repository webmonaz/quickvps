package ncdu

import (
	"bufio"
	"os"
	"os/exec"
	"strings"
)

type Distro string

const (
	DistroApt     Distro = "apt"
	DistroYum     Distro = "yum"
	DistroPacman  Distro = "pacman"
	DistroUnknown Distro = "unknown"
)

func IsInstalled() bool {
	_, err := exec.LookPath("ncdu")
	return err == nil
}

func DetectDistro() Distro {
	f, err := os.Open("/etc/os-release")
	if err != nil {
		return DistroUnknown
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, "ID_LIKE=") || strings.HasPrefix(line, "ID=") {
			val := strings.ToLower(strings.Trim(strings.SplitN(line, "=", 2)[1], `"`))
			if strings.Contains(val, "debian") || strings.Contains(val, "ubuntu") {
				return DistroApt
			}
			if strings.Contains(val, "rhel") || strings.Contains(val, "centos") ||
				strings.Contains(val, "fedora") || strings.Contains(val, "amazon") {
				return DistroYum
			}
			if strings.Contains(val, "arch") || strings.Contains(val, "manjaro") {
				return DistroPacman
			}
		}
	}
	return DistroUnknown
}

func Install() error {
	distro := DetectDistro()
	var cmd *exec.Cmd

	switch distro {
	case DistroApt:
		cmd = exec.Command("apt-get", "install", "-y", "ncdu")
	case DistroYum:
		cmd = exec.Command("yum", "install", "-y", "ncdu")
	case DistroPacman:
		cmd = exec.Command("pacman", "-S", "--noconfirm", "ncdu")
	default:
		// Try apt as a fallback
		cmd = exec.Command("apt-get", "install", "-y", "ncdu")
	}

	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}
